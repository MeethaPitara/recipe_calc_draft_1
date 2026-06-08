// @ts-ignore
import solver from 'javascript-lp-solver';
import { IngredientData } from '../../types/ingredients';
import { calcMetricsV2, MetricsV2, CalcOptionsV2, getSweetenerCoefficients } from './calc.v2.js';
import { ConstraintProfile } from '../../types/constraints.js';

// Sugar spectrum classification — mirrors calc.v2.ts PHASE 4 logic
function classifySugarSpectrum(id: string, name: string): { mono: number; di: number; poly: number } {
    const s = `${id} ${name}`.toLowerCase();
    if (s.includes('dextrose') || s.includes('fructose')) return { mono: 1, di: 0, poly: 0 };
    if (s.includes('invert')) return { mono: 1, di: 0, poly: 0 };
    if (s.includes('honey') || s.includes('agave')) return { mono: 0.80, di: 0.20, poly: 0 };
    if (s.includes('glucose') && !s.includes('syrup')) return { mono: 1, di: 0, poly: 0 };
    if (s.includes('maltodextrin') || s.includes('glucose syrup')) return { mono: 0, di: 0, poly: 1 };
    return { mono: 0, di: 1, poly: 0 }; // sucrose, trehalose, maple syrup default
}

export type Row = { ing: IngredientData; grams: number; lock?: boolean; min?: number; max?: number; };

export type OptimizeTarget = Partial<{
  totalSugars_pct: number;
  sugars_pct: number;
  fat_pct: number;
  msnf_pct: number;
  ts_pct: number;
  fpdt: number;
  sp?: number;
  afp_sugars?: number;
  afp_target?: number;
  pod_target?: number;
}>;

export interface OptimizeResult {
    success: boolean;
    rows: Row[];
    failureReason?: string;
}

export function optimizeRecipe(
  rowsIn: Row[],
  targets: OptimizeTarget,
  constraints?: ConstraintProfile,
  mode: 'gelato' | 'kulfi' = 'gelato'
): OptimizeResult {
    const originalTotalG = constraints?.fixedBatchMassG ?? rowsIn.reduce((s, r) => s + r.grams, 0);

    const model: any = { optimize: 'cost', opType: 'min', constraints: {}, variables: {} };

    const MOVEMENT_WEIGHT = 2.0;
    const DEVIATION_WEIGHT = 100.0;

    // Pre-compute bounds for each ingredient
    const rowBounds = rowsIn.map((row) => {
        const ing = row.ing;
        const initialAmt = row.grams;
        let minG = row.lock ? initialAmt : (row.min ?? 0);
        let maxG = row.lock ? initialAmt : (row.max ?? initialAmt * 3);
        if (constraints?.bounds) {
            const bnd = constraints.bounds.find(b => b.ingredientId === ing.id);
            if (bnd) {
                if (bnd.isLocked) { minG = initialAmt; maxG = initialAmt; }
                else {
                    if (bnd.minGrams !== undefined) minG = bnd.minGrams;
                    if (bnd.maxGrams !== undefined) maxG = bnd.maxGrams;
                }
            }
        }
        return { minG, maxG, lock: row.lock };
    });

    // If the sum of minimum floors exceeds 80% of target batch, scale unlocked floors down
    // proportionally so the LP has at least 20% of batch weight to redistribute freely.
    const lockedSum = rowBounds.reduce((s, b) => b.lock ? s + b.minG : s, 0);
    const unlockedBudget = originalTotalG - lockedSum;
    const unlockedMinSum = rowBounds.reduce((s, b) => !b.lock ? s + b.minG : s, 0);
    if (unlockedMinSum > unlockedBudget * 0.80 && unlockedBudget > 0) {
        const scale = (unlockedBudget * 0.60) / unlockedMinSum;
        rowBounds.forEach(b => { if (!b.lock) b.minG = b.minG * scale; });
    }

    rowsIn.forEach((row, i) => {
        const varName = `x_${i}`;
        const ing = row.ing;
        const initialAmt = row.grams;
        const { minG, maxG } = rowBounds[i];

        const variable: Record<string, number> = {
            total_weight: 1,
            [`bnd_min_${i}`]: 1,
            [`bnd_max_${i}`]: 1,
            [`movement_eq_${i}`]: 1,
        };

        if (targets.fat_pct != null) variable.fat_eq = (ing.fat_pct || 0) / 100;
        if (targets.msnf_pct != null) variable.msnf_eq = (ing.msnf_pct || 0) / 100;
        
        const sug_pct = ((ing.sugars_pct ?? (ing as any).sugar_pct) || 0) / 100;
        const lactose_pct = (ing.lactose_pct || 0) / 100;
        if (targets.totalSugars_pct != null || targets.sugars_pct != null) {
            variable.sug_eq = sug_pct;
        }

        const coeffs = getSweetenerCoefficients(ing.id, ing.name);
        if (targets.afp_target != null) {
            const afp_coeff = coeffs?.afp ?? 1;
            const isRecognizedSweetener = !!coeffs &&
                (ing.category === 'sugar' || ing.category === 'sweetener' || sug_pct > 0.4);
            if (isRecognizedSweetener) {
                // AFP-on-Total convention: afp_coeff × total grams of ingredient
                // Matches calc.v2.ts: se_g += g * coeffs.afp (not g * sugars_pct * coeffs.afp)
                variable.afp_eq = afp_coeff + lactose_pct;
            } else {
                // Unrecognized ingredient with some sugars: treat sugar fraction as sucrose-like
                variable.afp_eq = sug_pct * 1.0 + lactose_pct;
            }
        }

        if (targets.pod_target != null) {
            const sp_coeff = coeffs?.sp ?? 1;
            // SP% target: Σ(sp_coeff_i × 100 × sugars_g_i + 16 × lactose_g_i) / total_g = pod_target
            // Matches calc.v2.ts: pod_numerator += g * (coeffs.sp * 100); then += 16 * lactose_g
            // Then sp_pct = pod_numerator / total_g, so sp_pct == pod_target when constraint = 0
            variable.pod_diff = (sp_coeff * 100 * sug_pct + 16 * lactose_pct) - targets.pod_target;
        }

        // Sugar spectrum: track mono/di/poly sugar contributions per ingredient
        // Only wired up when a sugar target is set (Carpigiani 6-step rule enforcement)
        const sugTargetForSpectrum = targets.totalSugars_pct ?? targets.sugars_pct;
        if (sugTargetForSpectrum != null && sug_pct > 0) {
            const cls = classifySugarSpectrum(ing.id || '', ing.name || '');
            if (cls.mono > 0) variable.mono_sug = sug_pct * cls.mono;
            if (cls.di > 0) variable.di_sug = (variable.di_sug ?? 0) + sug_pct * cls.di;
            if (cls.poly > 0) variable.poly_sug = sug_pct * cls.poly;
            // Lactose always counts as disaccharide
            if (lactose_pct > 0) variable.di_sug = (variable.di_sug ?? 0) + lactose_pct;
        }

        if (constraints?.maxCostPerKgMix != null && ing.cost_per_kg) {
            variable.cost_eq = ing.cost_per_kg / 1000;
        }

        model.variables[varName] = variable;
        model.constraints[`bnd_min_${i}`] = { min: minG };
        model.constraints[`bnd_max_${i}`] = { max: maxG };

        // Soft movement constraints
        model.variables[`x_over_${i}`] = { cost: MOVEMENT_WEIGHT, [`movement_eq_${i}`]: -1 };
        model.variables[`x_under_${i}`] = { cost: MOVEMENT_WEIGHT, [`movement_eq_${i}`]: 1 };
        model.constraints[`movement_eq_${i}`] = { equal: initialAmt };
    });

    const hasTargets = targets.fat_pct != null || targets.msnf_pct != null ||
        (targets.totalSugars_pct ?? targets.sugars_pct) != null;

    // An ingredient can serve as a neutral diluent only if it is:
    //  1. Unlocked (not fixed by lock or constraints)
    //  2. Has zero fat, msnf, and sugars
    //  3. Has meaningful headroom (can absorb ≥5% of batch weight)
    //
    // A locked stabilizer (e.g. 3g fixed) has zero macros but CANNOT be varied
    // by the LP, so it provides no diluent capacity. Without this check,
    // stabilizer falsely suppresses the virtual water variable, leaving the LP
    // with no neutral weight sink — it then forces freed budget into macro
    // ingredients, producing wrong-direction movements.
    const hasAdequateNeutralIngredient = rowsIn.some((r, i) => {
        const b = rowBounds[i];
        if (b.lock || b.minG >= b.maxG - 0.01) return false;
        if ((r.ing.fat_pct ?? 0) !== 0) return false;
        if ((r.ing.msnf_pct ?? 0) !== 0) return false;
        if ((r.ing.sugars_pct ?? 0) !== 0) return false;
        return (b.maxG - b.minG) >= originalTotalG * 0.05;
    });

    if (constraints?.fixedBatchMassG != null) {
        // User explicitly fixed batch weight — honour it exactly
        model.constraints.total_weight = { equal: constraints.fixedBatchMassG };
    } else if (hasTargets) {
        // Macro targets are expressed as percentages of total weight.
        // If total weight floats, the gram targets become wrong percentages.
        // Fix weight to original so all % calculations stay accurate.
        model.constraints.total_weight = { equal: originalTotalG };
    } else {
        model.constraints.total_weight = { min: originalTotalG * 0.95, max: originalTotalG * 1.05 };
    }

    // Virtual water: contributes to batch weight but zero fat/msnf/sugars.
    // Without a neutral diluent, many target combinations are mathematically infeasible
    // (e.g. reducing fat forces freed weight into sugars or MSNF, breaking those targets).
    console.log(`[LP] hasTargets=${hasTargets}  hasAdequateNeutralIngredient=${hasAdequateNeutralIngredient}  originalTotalG=${originalTotalG.toFixed(1)}`);
    if (hasTargets && !hasAdequateNeutralIngredient) {
        model.variables['x_water'] = {
            total_weight: 1,
            bnd_min_water: 1,
            bnd_max_water: 1,
            movement_eq_water: 1,
        };
        model.constraints['bnd_min_water'] = { min: 0 };
        model.constraints['bnd_max_water'] = { max: originalTotalG * 0.25 };
        model.variables['x_over_water'] = { cost: MOVEMENT_WEIGHT, movement_eq_water: -1 };
        model.variables['x_under_water'] = { cost: MOVEMENT_WEIGHT, movement_eq_water: 1 };
        model.constraints['movement_eq_water'] = { equal: 0 };
    }

    if (targets.fat_pct != null) {
        model.variables['fat_over'] = { cost: DEVIATION_WEIGHT, fat_eq: -1 };
        model.variables['fat_under'] = { cost: DEVIATION_WEIGHT, fat_eq: 1 };
        model.constraints.fat_eq = { equal: (targets.fat_pct / 100) * originalTotalG };
    }
    if (targets.msnf_pct != null) {
        model.variables['msnf_over'] = { cost: DEVIATION_WEIGHT, msnf_eq: -1 };
        model.variables['msnf_under'] = { cost: DEVIATION_WEIGHT, msnf_eq: 1 };
        model.constraints.msnf_eq = { equal: (targets.msnf_pct / 100) * originalTotalG };
    }
    const sugTarget = targets.totalSugars_pct ?? targets.sugars_pct;
    if (sugTarget != null) {
        model.variables['sug_over'] = { cost: DEVIATION_WEIGHT, sug_eq: -1 };
        model.variables['sug_under'] = { cost: DEVIATION_WEIGHT, sug_eq: 1 };
        model.constraints.sug_eq = { equal: (sugTarget / 100) * originalTotalG };
    }
    
    if (targets.afp_target != null) {
        model.variables['afp_over'] = { cost: DEVIATION_WEIGHT, afp_eq: -1 };
        model.variables['afp_under'] = { cost: DEVIATION_WEIGHT, afp_eq: 1 };
        model.constraints.afp_eq = { equal: (targets.afp_target / 100) * originalTotalG };
    }
    
    if (targets.pod_target != null) {
        // We want pod_diff = 0
        model.variables['pod_over'] = { cost: DEVIATION_WEIGHT, pod_diff: -1 };
        model.variables['pod_under'] = { cost: DEVIATION_WEIGHT, pod_diff: 1 };
        model.constraints.pod_diff = { equal: 0 };
    }

    if (constraints?.maxCostPerKgMix != null) {
        model.constraints.cost_eq = { max: constraints.maxCostPerKgMix * (originalTotalG / 1000) };
    }

    // Sugar spectrum constraints (Carpigiani 6-step rule)
    // mono ≤ 25%, di ≥ 50%, poly ≤ 35% of total sugar grams
    const sugTargetForSpectrum = targets.totalSugars_pct ?? targets.sugars_pct;
    if (sugTargetForSpectrum != null) {
        const totalSugarTarget_g = (sugTargetForSpectrum / 100) * originalTotalG;
        model.constraints.mono_sug = { max: totalSugarTarget_g * 0.25 };
        model.constraints.di_sug = { min: totalSugarTarget_g * 0.50 };
        model.constraints.poly_sug = { max: totalSugarTarget_g * 0.35 };
    }

    if (constraints?.sugarRatios && constraints.sugarRatios.length > 0) {
        constraints.sugarRatios.forEach((sr, idx) => {
            const pIdx = rowsIn.findIndex(r => r.ing.id === sr.primarySugarId);
            const sIdx = rowsIn.findIndex(r => r.ing.id === sr.secondarySugarId);
            if (pIdx >= 0 && sIdx >= 0) {
                model.variables[`x_${pIdx}`][`sug_ratio_${idx}`] = 100 - sr.ratio;
                model.variables[`x_${sIdx}`][`sug_ratio_${idx}`] = -sr.ratio;
                model.constraints[`sug_ratio_${idx}`] = { equal: 0 };
            }
        });
    }

    const result = solver.Solve(model);
    console.log(`[LP] solver feasible=${result?.feasible}  result keys: ${Object.keys(result || {}).filter(k => !k.startsWith('x_over') && !k.startsWith('x_under') && !k.startsWith('bnd') && !k.startsWith('movement') && !k.startsWith('fat_') && !k.startsWith('msnf_') && !k.startsWith('sug_')).join(', ')}`);

    if (!result || result.feasible === false) {
        // Run fallbacks to determine failure reason
        let failureReason = 'TARGETS_UNREACHABLE_WITH_GIVEN_INGREDIENTS';
        
        // Test 1: Remove cost constraint
        if (constraints?.maxCostPerKgMix != null) {
            delete model.constraints.cost_eq;
            if (solver.Solve(model).feasible) {
                return { success: false, rows: rowsIn, failureReason: 'COST_CEILING_TOO_LOW' };
            }
        }
        
        // Test 2: Remove sugar ratio constraints
        if (constraints?.sugarRatios) {
            constraints.sugarRatios.forEach((_, idx) => { delete model.constraints[`sug_ratio_${idx}`]; });
            if (solver.Solve(model).feasible) {
                return { success: false, rows: rowsIn, failureReason: 'SUGAR_RATIO_CONFLICT' };
            }
        }

        // Test 2b: Remove sugar spectrum constraints
        if (model.constraints.mono_sug || model.constraints.di_sug || model.constraints.poly_sug) {
            delete model.constraints.mono_sug;
            delete model.constraints.di_sug;
            delete model.constraints.poly_sug;
            if (solver.Solve(model).feasible) {
                return { success: false, rows: rowsIn, failureReason: 'SUGAR_SPECTRUM_INFEASIBLE' };
            }
        }

        // Test 3: Relax ingredient bounds
        let hasBounds = false;
        rowsIn.forEach((_, i) => { 
            if (model.constraints[`bnd_min_${i}`].min > 0) hasBounds = true;
            model.constraints[`bnd_min_${i}`] = { min: 0 };
            model.constraints[`bnd_max_${i}`] = { max: 10000 };
        });
        if (hasBounds && solver.Solve(model).feasible) {
            return { success: false, rows: rowsIn, failureReason: 'INGREDIENT_BOUNDS_TOO_TIGHT' };
        }

        return { success: false, rows: rowsIn, failureReason };
    }

    const proposedRows: Row[] = rowsIn.map((r, i) => {
        const amt = Math.max(0, result[`x_${i}`] ?? 0);
        return { ...r, grams: amt };
    });

    if (hasTargets && !hasAdequateNeutralIngredient) {
        const waterGrams = Math.max(0, result['x_water'] ?? 0);
        if (waterGrams > 0.5) {
            proposedRows.push({
                ing: {
                    id: '__water__', name: 'Water (added)', category: 'water',
                    fat_pct: 0, msnf_pct: 0, sugars_pct: 0,
                    other_solids_pct: 0, water_pct: 100,
                } as any,
                grams: waterGrams,
            });
        }
    }

    // Post-LP FPDT refinement: FPDT is non-linear so it can't be an LP constraint.
    // After the LP settles fat/msnf/sugars/afp/sp, nudge dextrose↔sucrose to hit FPDT.
    // FPDT moves ~0.1°C per 1% dextrose change in a 1 kg batch.
    if (targets.fpdt != null) {
        const postMetrics = calcMetricsV2(proposedRows, { mode });
        const fpdtError = postMetrics.fpdt - targets.fpdt; // positive = too soft, negative = too hard

        if (Math.abs(fpdtError) > 0.3) {
            const dexIdx = proposedRows.findIndex(r =>
                r.ing.id?.toLowerCase().includes('dextrose') ||
                r.ing.name.toLowerCase().includes('dextrose'));
            const sucIdx = proposedRows.findIndex(r =>
                r.ing.id?.toLowerCase().includes('sucrose') ||
                r.ing.name.toLowerCase() === 'sugar' ||
                r.ing.name.toLowerCase().includes('sucrose'));

            if (dexIdx >= 0 && sucIdx >= 0 && !proposedRows[dexIdx].lock && !proposedRows[sucIdx].lock) {
                // Increase dextrose lowers FPDT (more anti-freeze), decrease raises it
                const adjustmentG = Math.max(
                    -proposedRows[dexIdx].grams * 0.5,
                    Math.min(proposedRows[dexIdx].grams * 0.5, -fpdtError * 10)
                );
                proposedRows[dexIdx] = { ...proposedRows[dexIdx], grams: Math.max(0, proposedRows[dexIdx].grams + adjustmentG) };
                proposedRows[sucIdx] = { ...proposedRows[sucIdx], grams: Math.max(0, proposedRows[sucIdx].grams - adjustmentG) };
            }
        }
    }

    return { success: true, rows: proposedRows };
}