/**
 * LP Optimizer
 * Port of Cell 6 — run_lp_optimizer() from reverse_engine_stage1.ipynb
 * Uses javascript-lp-solver (Simplex) instead of PuLP (CBC)
 */

import { INGREDIENT_DB } from './ingredientDb';
import type { OptimizationTargets, LPOptimizerResult, ProductMode } from './types';
// @ts-ignore - javascript-lp-solver doesn't have types
import solver from 'javascript-lp-solver';
import { productParametersService, ProductType } from '@/services/productParametersService';

// Removed SUGAR_BOUNDS as we now use Sugar Blend Optimizer post-processing

const DEVIATION_WEIGHT = 10.0;
const MOVEMENT_WEIGHT = 0.1;

/**
 * LP solver ported from balanceRecipeLP() / Python run_lp_optimizer().
 *
 * @param scaledRecipe  - { ingredientName: grams } after batch scaling
 * @param optTargets    - desired fat_pct / msnf_pct / sugars_pct
 * @param mode          - product type for sugar bounds
 * @param massTolerance - allowed total-mass drift (default 10%)
 */
export function runLpOptimizer(
    scaledRecipe: Record<string, number>,
    optTargets: OptimizationTargets,
    mode: ProductMode = 'gelato',
    massTolerance = 0.10
): LPOptimizerResult {
    const names = Object.keys(scaledRecipe);
    const initial = Object.values(scaledRecipe);
    const totalW = initial.reduce((s, v) => s + v, 0);
    const n = names.length;
    const warnings: string[] = [];

    // ── Build the LP model in javascript-lp-solver's JSON format ──

    const model: {
        optimize: string;
        opType: string;
        constraints: Record<string, { min?: number; max?: number; equal?: number }>;
        variables: Record<string, Record<string, number>>;
    } = {
        optimize: 'cost',
        opType: 'min',
        constraints: {},
        variables: {},
    };

    // ── Per-ingredient decision variables ──

    for (let i = 0; i < n; i++) {
        const name = names[i];
        const ing = INGREDIENT_DB[name];
        const locked = ing?.locked ?? false;

        let lo: number;
        let hi: number;

        if (locked) {
            lo = initial[i];
            hi = initial[i];
        } else {
            lo = 0;
            hi = Math.max(initial[i] * 5, 1500);

            // Sugar optimization is now handled dynamically without strict upper bounds per sugar
        }

        const varName = `x_${i}`;

        // Variable contributes to constraints:
        const variable: Record<string, number> = {
            total_weight: 1,          // mass conservation
            [`bnd_min_${i}`]: 1,      // lower bound
            [`bnd_max_${i}`]: 1,      // upper bound
            [`movement_eq_${i}`]: 1,  // distance constraint
        };

        // Nutritional target equations use proportional difference
        // This ensures the LP mathematically aims for the exact percentage of the proposed mix
        if (optTargets.fat_pct != null) {
            variable.fat_eq = ((ing?.fat_pct ?? 0) - optTargets.fat_pct) / 100;
        }
        if (optTargets.msnf_pct != null) {
            variable.msnf_eq = ((ing?.msnf_pct ?? 0) - optTargets.msnf_pct) / 100;
        }
        if (optTargets.sugars_pct != null) {
            variable.sug_eq = ((ing?.sugars_pct ?? 0) - optTargets.sugars_pct) / 100;
        }

        model.variables[varName] = variable;
        model.constraints[`bnd_min_${i}`] = { min: lo };
        model.constraints[`bnd_max_${i}`] = { max: hi };

        // ── Movement penalty constraints: x_i - over + under = initial_i ──
        model.variables[`x_over_${i}`] = { cost: MOVEMENT_WEIGHT, [`movement_eq_${i}`]: -1 };
        model.variables[`x_under_${i}`] = { cost: MOVEMENT_WEIGHT, [`movement_eq_${i}`]: 1 };
        model.constraints[`movement_eq_${i}`] = { equal: initial[i] };
    }

    // ── Total-weight band ──

    model.constraints.total_weight = {
        min: totalW * (1 - massTolerance),
        max: totalW * (1 + massTolerance),
    };

    // ── Deviation slack variables for each target ──
    // Because variables use proportional difference (val - target), the exact target yields 0
    if (optTargets.fat_pct != null) {
        model.variables['fat_over'] = { cost: DEVIATION_WEIGHT, fat_eq: -1 };
        model.variables['fat_under'] = { cost: DEVIATION_WEIGHT, fat_eq: 1 };
        model.constraints.fat_eq = { equal: 0 };
    }

    if (optTargets.msnf_pct != null) {
        model.variables['msnf_over'] = { cost: DEVIATION_WEIGHT, msnf_eq: -1 };
        model.variables['msnf_under'] = { cost: DEVIATION_WEIGHT, msnf_eq: 1 };
        model.constraints.msnf_eq = { equal: 0 };
    }

    if (optTargets.sugars_pct != null) {
        model.variables['sug_over'] = { cost: DEVIATION_WEIGHT, sug_eq: -1 };
        model.variables['sug_under'] = { cost: DEVIATION_WEIGHT, sug_eq: 1 };
        model.constraints.sug_eq = { equal: 0 };
    }

    // ── Solve ──

    try {
        const result = solver.Solve(model);

        if (!result || result.feasible === false) {
            return {
                success: false,
                solver_status: 'Infeasible',
                proposed_recipe: { ...scaledRecipe },
                warnings: ['Solver status: Infeasible. Recipe unchanged.'],
            };
        }

        // Extract solution
        const proposed: Record<string, number> = {};
        for (let i = 0; i < n; i++) {
            const varName = `x_${i}`;
            proposed[names[i]] = Math.max(0, result[varName] ?? 0);
        }

        // Rescale if total drifted
        const proposedSum = Object.values(proposed).reduce((s, v) => s + v, 0);
        if (Math.abs(proposedSum - totalW) > 1.0) {
            const factor = totalW / proposedSum;
            for (const k of Object.keys(proposed)) {
                proposed[k] *= factor;
            }
            warnings.push(`Rescaled by ${factor.toFixed(6)} to correct drift`);
        }

        // ── AI Optimizer Back-Calculation: Apply Sugar Blend Optimizer ──
        let totalSugarWeight = 0;
        const mappedMode: ProductType = mode === 'ice_cream' ? 'ice-cream' : (mode as ProductType);

        for (const [k, v] of Object.entries(proposed)) {
            if (INGREDIENT_DB[k]?.category === 'sugar') {
                totalSugarWeight += v;
                delete proposed[k]; // Clear existing generic sugar logic distribution
            }
        }

        if (totalSugarWeight > 0) {
            const blend = productParametersService.calculateOptimalSugarBlend(
                mappedMode,
                totalSugarWeight,
                'balanced'
            );

            proposed['Sucrose/sugar'] = (proposed['Sucrose/sugar'] || 0) + blend.sucrose;
            proposed['Dextrose monohydrate'] = (proposed['Dextrose monohydrate'] || 0) + blend.dextrose;
            proposed['Glucose Syrup (40-42DE)'] = (proposed['Glucose Syrup (40-42DE)'] || 0) + blend.glucose_syrup;
            warnings.push('Applied Sugar Blend Optimizer logic to structure sugars');
        }

        return {
            success: true,
            solver_status: 'Optimal — Linear Programming (Simplex)',
            proposed_recipe: proposed,
            warnings,
        };
    } catch (err) {
        return {
            success: false,
            solver_status: `Error: ${err instanceof Error ? err.message : String(err)}`,
            proposed_recipe: { ...scaledRecipe },
            warnings: [`LP solver error: ${err instanceof Error ? err.message : String(err)}`],
        };
    }
}
