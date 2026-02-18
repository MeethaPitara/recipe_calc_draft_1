/**
 * Optimizer Engine — PRD-specified adapter layer
 *
 * Architecture:  Modern UI → Adapter (Input) → Legacy Solver Math → Adapter (Output) → Modern UI
 *
 * Strategy priority:
 *   1. LP Solver  (balanceRecipeLP — Simplex method, mathematically optimal)
 *   2. Hill-climbing  (optimizeRecipe — deterministic, good fallback)
 *   3. Advanced hybrid  (advancedOptimize — GA+Hill-climb refinement)
 */

import type { IngredientData } from '@/types/ingredients';
import {
    optimizeRecipe,
    balanceRecipeLP,
    advancedOptimize,
    calcMetricsV2,
    type Row,
    type OptimizeTarget,
    type MetricsV2,
} from './legacy_core';

// ============================================================================
// PRD INTERFACES
// ============================================================================

export interface OptimizerRequest {
    /** Current recipe — each ingredient with its quantity */
    currentRecipe: {
        ingredient: IngredientData;
        grams: number;
    }[];

    /** Target total mass in grams (e.g. 1000) */
    totalTargetMass: number;

    /** Composition targets — optimizer will try to hit these */
    targets: {
        fat?: number;        // e.g. 8.0 (%)
        msnf?: number;       // e.g. 10.0 (%)
        sugars?: number;     // e.g. 18.0 (%)
        totalSolids?: number;// e.g. 36.0 (%)
    };

    /** IDs of ingredients that CANNOT change (pastes, stabilizers, spices) */
    lockedIngredientIds: string[];

    /** IDs of ingredients that CAN change (milk, cream, sugar) */
    freeIngredientIds: string[];

    /** Product type / mode (gelato, ice_cream, sorbet, kulfi) */
    mode?: string;
}

export interface OptimizerChange {
    id: string;
    name: string;
    oldMass: number;
    newMass: number;
    delta: number;
}

export interface OptimizerResult {
    success: boolean;
    status: 'OPTIMAL' | 'INFEASIBLE' | 'ERROR';

    /** The full list with new quantities */
    optimizedRecipe: {
        ingredient: IngredientData;
        grams: number;
    }[];

    /** Diff for the UI */
    changes: OptimizerChange[];

    /** Before/After metrics for optional display */
    metricsBefore?: MetricsV2;
    metricsAfter?: MetricsV2;

    /** Human-readable message explaining the result */
    message: string;
}

// ============================================================================
// ADAPTER HELPERS
// ============================================================================

/**
 * Convert OptimizerRequest → legacy Row[] with lock flags.
 */
function requestToRows(request: OptimizerRequest): Row[] {
    return request.currentRecipe.map((item) => {
        const isLocked = request.lockedIngredientIds.includes(item.ingredient.id);
        return {
            ing: item.ingredient,
            grams: item.grams,
            lock: isLocked,
            min: isLocked ? item.grams : 0,
            max: isLocked ? item.grams : item.grams * 10,
        };
    });
}

/**
 * Convert legacy OptimizeTarget from PRD targets.
 */
function requestToTargets(request: OptimizerRequest): OptimizeTarget {
    return {
        fat_pct: request.targets.fat,
        msnf_pct: request.targets.msnf,
        totalSugars_pct: request.targets.sugars,
        ts_pct: request.targets.totalSolids,
    };
}

/**
 * Build changes diff from old rows → new rows.
 */
function buildChangesDiff(
    oldRecipe: OptimizerRequest['currentRecipe'],
    newRows: Row[]
): OptimizerChange[] {
    const changes: OptimizerChange[] = [];

    // Build a map of new grams by ingredient id
    const newGramsMap = new Map<string, number>();
    for (const row of newRows) {
        newGramsMap.set(row.ing.id, row.grams);
    }

    for (const item of oldRecipe) {
        const newMass = newGramsMap.get(item.ingredient.id) ?? 0;
        const delta = newMass - item.grams;

        if (Math.abs(delta) > 0.01) {
            changes.push({
                id: item.ingredient.id,
                name: item.ingredient.name,
                oldMass: item.grams,
                newMass,
                delta,
            });
        }
    }

    return changes;
}

/**
 * Convert new rows back to the public recipe format.
 */
function rowsToRecipe(
    rows: Row[]
): { ingredient: IngredientData; grams: number }[] {
    return rows
        .filter((r) => r.grams > 0.01)
        .map((r) => ({ ingredient: r.ing, grams: r.grams }));
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Run the optimizer. Tries LP solver first, then hill-climbing, then advanced hybrid.
 */
export function runOptimizer(request: OptimizerRequest): OptimizerResult {
    const rows = requestToRows(request);
    const targets = requestToTargets(request);

    // Validate: need at least 1 free ingredient
    const freeCount = rows.filter((r) => !r.lock).length;
    if (freeCount === 0) {
        return {
            success: false,
            status: 'INFEASIBLE',
            optimizedRecipe: request.currentRecipe,
            changes: [],
            message: 'All ingredients are locked. Unlock at least one ingredient to optimize.',
        };
    }

    // Capture "before" metrics
    const metricsBefore = calcMetricsV2(rows);

    // ── Strategy 1: LP Solver ──
    try {
        const lpResult = balanceRecipeLP(rows, targets, {
            tolerance: 2.0,
            weightFlexibility: 0.10,
            mode: (request.mode as any) || 'gelato',
        });

        if (lpResult.success) {
            const metricsAfter = calcMetricsV2(lpResult.rows);
            const changes = buildChangesDiff(request.currentRecipe, lpResult.rows);
            return {
                success: true,
                status: 'OPTIMAL',
                optimizedRecipe: rowsToRecipe(lpResult.rows),
                changes,
                metricsBefore,
                metricsAfter,
                message: 'Optimal solution found using Linear Programming (Simplex).',
            };
        }
    } catch (e) {
        // LP failed — continue to fallback
    }

    // ── Strategy 2: Hill-Climbing ──
    try {
        const hillClimbResult = optimizeRecipe(rows, targets, 'gelato', 300, 2);
        const afterMetrics = calcMetricsV2(hillClimbResult);

        // Verify the result is meaningfully better
        const beforeScore = scoreAgainstTargets(metricsBefore, targets);
        const afterScore = scoreAgainstTargets(afterMetrics, targets);

        if (afterScore < beforeScore * 0.95) {
            // At least 5% improvement
            const changes = buildChangesDiff(request.currentRecipe, hillClimbResult);
            return {
                success: true,
                status: 'OPTIMAL',
                optimizedRecipe: rowsToRecipe(hillClimbResult),
                changes,
                metricsBefore,
                metricsAfter: afterMetrics,
                message: 'Solution found using hill-climbing optimization.',
            };
        }
    } catch (e) {
        // Hill-climb failed — continue to fallback
    }

    // ── Strategy 3: Advanced Hybrid (GA + Hill-climb) ──
    try {
        const advancedResult = advancedOptimize(rows, targets, {
            algorithm: 'hybrid',
            maxIterations: 200,
        });

        const afterMetrics = calcMetricsV2(advancedResult);
        const beforeScore = scoreAgainstTargets(metricsBefore, targets);
        const afterScore = scoreAgainstTargets(afterMetrics, targets);

        if (afterScore < beforeScore * 0.95) {
            const changes = buildChangesDiff(request.currentRecipe, advancedResult);
            return {
                success: true,
                status: 'OPTIMAL',
                optimizedRecipe: rowsToRecipe(advancedResult),
                changes,
                metricsBefore,
                metricsAfter: afterMetrics,
                message: 'Solution found using hybrid genetic algorithm.',
            };
        }
    } catch (e) {
        // All strategies failed
    }

    // ── All Strategies Failed ──
    return {
        success: false,
        status: 'INFEASIBLE',
        optimizedRecipe: request.currentRecipe,
        changes: [],
        metricsBefore,
        message:
            'Could not find a better recipe with the current ingredients and constraints. ' +
            'Try unlocking more ingredients or adjusting your targets.',
    };
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Simple distance score — lower is better.
 */
function scoreAgainstTargets(m: MetricsV2, t: OptimizeTarget): number {
    let score = 0;
    if (t.fat_pct != null) score += Math.abs(m.fat_pct - t.fat_pct);
    if (t.msnf_pct != null) score += Math.abs(m.msnf_pct - t.msnf_pct);
    if (t.totalSugars_pct != null)
        score += Math.abs(m.totalSugars_pct - t.totalSugars_pct);
    if (t.sugars_pct != null)
        score += Math.abs(m.nonLactoseSugars_pct - t.sugars_pct);
    if (t.ts_pct != null) score += Math.abs(m.ts_pct - t.ts_pct);
    return score;
}
