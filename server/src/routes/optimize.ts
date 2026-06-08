import { Router } from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { balancingEngine } from '../lib/core/optimize.engine.js';
import { ConstraintProfile } from '../types/constraints.js';
import { autotuneForTemp, previewTuningChanges } from '../lib/core/autotune.js';
import { diagnoseFeasibility, applyAutoFix } from '../lib/core/diagnostics.js';
import { calcMetricsV2 } from '../lib/core/calc.v2.js';

const router = Router();

// ── Types for /run endpoint ──

interface OptimizerRequest {
    currentRecipe: { ingredient: any; grams: number }[];
    totalTargetMass: number;
    targets: { fat?: number; msnf?: number; sugars?: number; totalSolids?: number; pac?: number; pod?: number; };
    lockedIngredientIds: string[];
    freeIngredientIds: string[];
    mode?: string;
    constraints?: ConstraintProfile;
}

type Row = { ing: any; grams: number; lock?: boolean; min?: number; max?: number };
type OptimizeTarget = {
    fat_pct?: number;
    msnf_pct?: number;
    totalSugars_pct?: number;
    sugars_pct?: number;
    ts_pct?: number;
    afp_target?: number;
    pod_target?: number;
};

function requestToRows(request: OptimizerRequest): Row[] {
    return request.currentRecipe.map((item) => {
        const isLocked = request.lockedIngredientIds.includes(item.ingredient.id);
        return {
            ing: item.ingredient,
            grams: item.grams,
            lock: isLocked,
            min: isLocked ? item.grams : item.grams * 0.2,
            max: isLocked ? item.grams : item.grams * 3,
        };
    });
}

function requestToTargets(request: OptimizerRequest): OptimizeTarget {
    return {
        fat_pct: request.targets.fat,
        msnf_pct: request.targets.msnf,
        totalSugars_pct: request.targets.sugars,
        ts_pct: request.targets.totalSolids,
        afp_target: request.targets.pac,
        pod_target: request.targets.pod,
    };
}

// ══════════════════════════════════════════════
// POST /run — Full optimizer pipeline adapter
// Uses pure Constraint-Aware LP Solver
// ══════════════════════════════════════════════

router.post('/run', async (req, res) => {
    try {
        const request: OptimizerRequest = req.body;
        if (!request.currentRecipe || !request.targets) {
            return res.status(400).json({ error: 'Missing currentRecipe or targets' });
        }

        const rows = requestToRows(request);
        const targets = requestToTargets(request);

        console.log('\n[OPTIMIZER] ─────────────────────────────────');
        console.log('[OPTIMIZER] Rows:');
        rows.forEach(r => console.log(`  ${r.ing.name}: ${r.grams.toFixed(1)}g  lock=${r.lock}  min=${r.min?.toFixed(1)}  max=${r.max?.toFixed(1)}  fat=${r.ing.fat_pct}  msnf=${r.ing.msnf_pct}  sug=${r.ing.sugars_pct}`));
        console.log('[OPTIMIZER] Targets:', JSON.stringify(targets));
        console.log('[OPTIMIZER] Constraints:', JSON.stringify({ fixedBatchMassG: request.constraints?.fixedBatchMassG }));

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

        const metricsBefore = calcMetricsV2(rows);

        const lpResult = balancingEngine.balance(rows, targets, (request.mode as any) || 'gelato', 'lp_solver', request.constraints);
        
        const FAILURE_MESSAGES: Record<string, string> = {
            'COST_CEILING_TOO_LOW': 'Optimization failed: The cost ceiling is too low to reach the desired fat/msnf targets.',
            'SUGAR_RATIO_CONFLICT': 'Optimization failed: The requested sugar blend ratio conflicts with the total sweetness or solids targets.',
            'SUGAR_SPECTRUM_INFEASIBLE': 'Optimization failed: Cannot meet the Carpigiani sugar spectrum rules (mono ≤25%, di ≥50%, poly ≤35%) with the current sugar ingredients. Try adding sucrose or reducing dextrose.',
            'INGREDIENT_BOUNDS_TOO_TIGHT': 'Optimization failed: Ingredient min/max limits or locks are too restrictive. Try unlocking some ingredients or relaxing limits.',
            'TARGETS_UNREACHABLE_WITH_GIVEN_INGREDIENTS': 'Optimization failed: Cannot reach the required parameters with the allowed ingredients. Try adding more flexible ingredients.'
        };

        let resPayload: any = {};

        if (lpResult.success) {
            console.log('[OPTIMIZER] Result rows:');
            lpResult.rows.forEach(r => console.log(`  ${r.ing.name}: ${r.grams.toFixed(1)}g`));
            const metricsAfter = calcMetricsV2(lpResult.rows);
            console.log(`[OPTIMIZER] After metrics: fat=${metricsAfter.fat_pct.toFixed(2)}%  msnf=${metricsAfter.msnf_pct.toFixed(2)}%  sugars=${metricsAfter.totalSugars_pct.toFixed(2)}%`);
            const changes = buildChangesDiff(request.currentRecipe, lpResult.rows);
            resPayload = {
                success: true,
                status: 'OPTIMAL',
                optimizedRecipe: rowsToRecipe(lpResult.rows),
                changes,
                metricsBefore,
                metricsAfter,
                message: 'Optimal solution found using Linear Programming (Simplex).',
            };
        } else {
             const rawReason = lpResult.diagnostics.adjustmentsMade[0] || 'Unknown';
             const humanMessage = FAILURE_MESSAGES[rawReason] || rawReason || 'Infeasible with given constraints.';
             resPayload = {
                success: false,
                status: 'INFEASIBLE',
                optimizedRecipe: request.currentRecipe,
                changes: [],
                metricsBefore,
                message: humanMessage,
            };
        }

        // Log solver run
        try {
            await supabase.from('solver_runs').insert({
                targets: targets as any,
                constraints: request.constraints as any,
                result_status: resPayload.status,
                result_rows: lpResult.success ? lpResult.rows as any : null
            });
        } catch (logErr) {
            console.error('Error logging solver run:', logErr);
        }

        return res.json(resPayload);
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
    // Water is a new ingredient not in the original recipe — add it explicitly
    const waterRow = newRows.find(r => r.ing.id === '__water__');
    if (waterRow && waterRow.grams > 0.5) {
        changes.push({
            id: '__water__',
            name: 'Water (added)',
            oldMass: 0,
            newMass: waterRow.grams,
            delta: waterRow.grams,
        });
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
