/**
 * LP Optimizer
 * Port of Cell 6 — run_lp_optimizer() from reverse_engine_stage1.ipynb
 * Uses javascript-lp-solver (Simplex) instead of PuLP (CBC)
 */

import { INGREDIENT_DB } from './ingredientDb';
import type { OptimizationTargets, LPOptimizerResult, ProductMode } from './types';
// @ts-ignore - javascript-lp-solver doesn't have types
import solver from 'javascript-lp-solver';

// ── Sugar-type upper bounds per product mode ──

const SUGAR_BOUNDS: Record<string, Record<string, number>> = {
    gelato: { sucrose_max_pct: 22, dextrose_max_pct: 8, glucose_max_pct: 8 },
    ice_cream: { sucrose_max_pct: 22, dextrose_max_pct: 8, glucose_max_pct: 8 },
    kulfi: { sucrose_max_pct: 20, dextrose_max_pct: 6, glucose_max_pct: 6 },
    sorbet: { sucrose_max_pct: 25, dextrose_max_pct: 15, glucose_max_pct: 12 },
};

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
    const bounds = SUGAR_BOUNDS[mode] ?? SUGAR_BOUNDS.gelato;

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

            const nm = name.toLowerCase();
            if (nm.includes('sucrose') || nm === 'sucrose/sugar') {
                hi = Math.min(hi, totalW * bounds.sucrose_max_pct / 100);
            } else if (nm.includes('dextrose')) {
                hi = Math.min(hi, totalW * bounds.dextrose_max_pct / 100);
            } else if (nm.includes('glucose')) {
                hi = Math.min(hi, totalW * bounds.glucose_max_pct / 100);
            }
        }

        const varName = `x_${i}`;

        // Variable contributes to constraints:
        const variable: Record<string, number> = {
            total_weight: 1,          // mass conservation
            [`bnd_min_${i}`]: 1,      // lower bound
            [`bnd_max_${i}`]: 1,      // upper bound
            [`movement_eq_${i}`]: 1,  // distance constraint
        };

        // Nutritional contributions
        const fatCoeff = (ing?.fat_pct ?? 0) / 100;
        const msnfCoeff = (ing?.msnf_pct ?? 0) / 100;
        const sugCoeff = (ing?.sugars_pct ?? 0) / 100;

        if (optTargets.fat_pct != null) variable.fat_eq = fatCoeff;
        if (optTargets.msnf_pct != null) variable.msnf_eq = msnfCoeff;
        if (optTargets.sugars_pct != null) variable.sug_eq = sugCoeff;

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

    if (optTargets.fat_pct != null) {
        const tg = (optTargets.fat_pct / 100) * totalW;
        model.variables['fat_over'] = { cost: DEVIATION_WEIGHT, fat_eq: -1 };
        model.variables['fat_under'] = { cost: DEVIATION_WEIGHT, fat_eq: 1 };
        model.constraints.fat_eq = { equal: tg };
    }

    if (optTargets.msnf_pct != null) {
        const tg = (optTargets.msnf_pct / 100) * totalW;
        model.variables['msnf_over'] = { cost: DEVIATION_WEIGHT, msnf_eq: -1 };
        model.variables['msnf_under'] = { cost: DEVIATION_WEIGHT, msnf_eq: 1 };
        model.constraints.msnf_eq = { equal: tg };
    }

    if (optTargets.sugars_pct != null) {
        const tg = (optTargets.sugars_pct / 100) * totalW;
        model.variables['sug_over'] = { cost: DEVIATION_WEIGHT, sug_eq: -1 };
        model.variables['sug_under'] = { cost: DEVIATION_WEIGHT, sug_eq: 1 };
        model.constraints.sug_eq = { equal: tg };
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
