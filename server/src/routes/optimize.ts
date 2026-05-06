import { Router } from 'express';
import { balancingEngine } from '../lib/core/optimize.engine.js';
import { advancedOptimize, compareOptimizers } from '../lib/core/optimize.advanced.js';
import { autotuneForTemp, previewTuningChanges } from '../lib/core/autotune.js';
import { diagnoseFeasibility, applyAutoFix } from '../lib/core/diagnostics.js';
import { calcMetricsV2 } from '../lib/core/calc.v2.js';

const router = Router();

// ── Types for /run endpoint ──

interface OptimizerRequest {
    currentRecipe: { ingredient: any; grams: number }[];
    totalTargetMass: number;
    targets: { fat?: number; msnf?: number; sugars?: number; totalSolids?: number };
    lockedIngredientIds: string[];
    freeIngredientIds: string[];
    mode?: string;
}

type Row = { ing: any; grams: number; lock?: boolean; min?: number; max?: number };
type OptimizeTarget = {
    fat_pct?: number;
    msnf_pct?: number;
    totalSugars_pct?: number;
    sugars_pct?: number;
    ts_pct?: number;
};

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

function requestToTargets(request: OptimizerRequest): OptimizeTarget {
    return {
        fat_pct: request.targets.fat,
        msnf_pct: request.targets.msnf,
        totalSugars_pct: request.targets.sugars,
        ts_pct: request.targets.totalSolids,
    };
}

function scoreAgainstTargets(m: any, t: OptimizeTarget): number {
    let score = 0;
    if (t.fat_pct != null) score += Math.abs(m.fat_pct - t.fat_pct);
    if (t.msnf_pct != null) score += Math.abs(m.msnf_pct - t.msnf_pct);
    if (t.totalSugars_pct != null) score += Math.abs(m.totalSugars_pct - t.totalSugars_pct);
    if (t.sugars_pct != null) score += Math.abs(m.nonLactoseSugars_pct - t.sugars_pct);
    if (t.ts_pct != null) score += Math.abs(m.ts_pct - t.ts_pct);
    return score;
}

// ══════════════════════════════════════════════
// POST /run — Full optimizer pipeline adapter
// Tries LP → Hill-climbing → Advanced hybrid
// ══════════════════════════════════════════════

router.post('/run', async (req, res) => {
    try {
        const request: OptimizerRequest = req.body;
        if (!request.currentRecipe || !request.targets) {
            return res.status(400).json({ error: 'Missing currentRecipe or targets' });
        }

        const rows = requestToRows(request);
        const targets = requestToTargets(request);

        // Validate: need at least 1 free ingredient
        const freeCount = rows.filter((r) => !r.lock).length;
        if (freeCount === 0) {
            return res.json({
                success: false,
                status: 'INFEASIBLE',
                optimizedRecipe: request.currentRecipe,
                changes: [],
                message: 'All ingredients are locked. Unlock at least one ingredient to optimize.',
            });
        }

        // Capture "before" metrics
        const metricsBefore = calcMetricsV2(rows);

        // ── Strategy 1: LP Solver ──
        try {
            const lpResult = balancingEngine.balance(rows, targets, (request.mode as any) || 'gelato');
            if (lpResult.success) {
                const metricsAfter = calcMetricsV2(lpResult.rows);
                const changes = buildChangesDiff(request.currentRecipe, lpResult.rows);
                return res.json({
                    success: true,
                    status: 'OPTIMAL',
                    optimizedRecipe: rowsToRecipe(lpResult.rows),
                    changes,
                    metricsBefore,
                    metricsAfter,
                    message: 'Optimal solution found using Linear Programming (Simplex).',
                });
            }
        } catch (e) {
            // LP failed — continue to fallback
        }

        // ── Strategy 2: Advanced Hybrid ──
        try {
            const advancedResult = await advancedOptimize(rows, targets, {
                algorithm: 'hybrid',
                maxIterations: 200,
            });

            const afterMetrics = calcMetricsV2(advancedResult);
            const beforeScore = scoreAgainstTargets(metricsBefore, targets);
            const afterScore = scoreAgainstTargets(afterMetrics, targets);

            if (afterScore < beforeScore * 0.95) {
                const changes = buildChangesDiff(request.currentRecipe, advancedResult);
                return res.json({
                    success: true,
                    status: 'OPTIMAL',
                    optimizedRecipe: rowsToRecipe(advancedResult),
                    changes,
                    metricsBefore,
                    metricsAfter: afterMetrics,
                    message: 'Solution found using hybrid genetic algorithm.',
                });
            }
        } catch (e) {
            // All strategies failed
        }

        // ── All Strategies Failed ──
        res.json({
            success: false,
            status: 'INFEASIBLE',
            optimizedRecipe: request.currentRecipe,
            changes: [],
            metricsBefore,
            message: 'Could not find a better recipe with the current ingredients and constraints. Try unlocking more ingredients or adjusting your targets.',
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

function buildChangesDiff(
    oldRecipe: { ingredient: any; grams: number }[],
    newRows: Row[]
): any[] {
    const changes: any[] = [];
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

function rowsToRecipe(rows: Row[]): { ingredient: any; grams: number }[] {
    return rows
        .filter((r) => r.grams > 0.01)
        .map((r) => ({ ingredient: r.ing, grams: r.grams }));
}

// ══════════════════════════════════════════════
// Existing routes
// ══════════════════════════════════════════════

router.post('/balance', async (req, res) => {
    try {
        const { rows, targets, mode, preferredStrategy } = req.body;
        if (!rows || !targets) {
            return res.status(400).json({ error: 'Missing rows or targets' });
        }
        const result = balancingEngine.balance(rows, targets, mode || 'gelato', preferredStrategy);
        res.json({ success: true, result });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/advanced', async (req, res) => {
    try {
        const { rows, targets, config } = req.body;
        if (!rows || !targets) {
            return res.status(400).json({ error: 'Missing rows or targets' });
        }
        const resultRows = await advancedOptimize(rows, targets, config);
        res.json({ success: true, resultRows });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/compare', async (req, res) => {
    try {
        const { rows, targets } = req.body;
        if (!rows || !targets) {
            return res.status(400).json({ error: 'Missing rows or targets' });
        }
        const results = compareOptimizers(rows, targets);
        res.json({ success: true, results });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/autotune', async (req, res) => {
    try {
        const { rows, targetTemp, keepSP } = req.body;
        if (!rows || typeof targetTemp !== 'number') {
            return res.status(400).json({ error: 'Missing rows or targetTemp' });
        }
        const resultRows = autotuneForTemp(rows, targetTemp, keepSP);
        res.json({ success: true, resultRows });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/preview-tuning', async (req, res) => {
    try {
        const { rows, targetTemp } = req.body;
        if (!rows || typeof targetTemp !== 'number') {
            return res.status(400).json({ error: 'Missing rows or targetTemp' });
        }
        const result = previewTuningChanges(rows, targetTemp);
        res.json({ success: true, result });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/diagnose', async (req, res) => {
    try {
        const { rows, allIngredients, targets, mode } = req.body;
        if (!rows || !allIngredients || !targets) {
            return res.status(400).json({ error: 'Missing required parameters for diagnosis' });
        }
        const feasibility = diagnoseFeasibility(rows, allIngredients, targets, mode);
        res.json({ success: true, feasibility });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/autofix', async (req, res) => {
    try {
        const { rows, allIngredients, mode, feasibility, currentMetrics, targets } = req.body;
        if (!rows || !allIngredients || !mode || !feasibility) {
            return res.status(400).json({ error: 'Missing required parameters for autofix' });
        }
        const result = applyAutoFix(rows, allIngredients, mode, feasibility, currentMetrics, targets);
        res.json({ success: true, result });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export { router as optimizeRouter };
