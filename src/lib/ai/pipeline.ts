/**
 * AI Recipe Optimization Pipeline — Main Orchestrator
 * Port of Cell 8 (optimizer_tool) + Cell 12 (run_agent) from reverse_engine_stage1.ipynb
 *
 * Flow: foodEngineerPre → batchSizing → LP optimizer → foodScientistReason
 */

import { INGREDIENT_DB, loadIngredientsFromSupabase } from './ingredientDb';
import { computeBatchSizing } from './batchSizing';
import { computeRecipeMetrics } from './recipeMetrics';
import { parseInstruction } from './instructionParser';
import { runLpOptimizer } from './lpOptimizer';
import { foodEngineerPre } from './foodEngineer';
import { foodScientistReason } from './foodScientist';
import type {
    RecipeItem,
    ProductionTargets,
    ProductMode,
    OptimizerToolResult,
    AgentResult,
    IngredientDiff,
    RunAgentOptions,
} from './types';

// ── Deterministic optimizer tool (no AI) ──

/**
 * Deterministic optimizer tool.
 * Steps: batch sizing → scale recipe → parse targets → LP solve → diff.
 */
export function optimizerTool(
    recipe: RecipeItem[],
    productionTargets: ProductionTargets,
    customInstruction: string,
    mode: ProductMode = 'gelato'
): OptimizerToolResult {
    const warnings: string[] = [];

    // 1. Batch sizing
    const batch = computeBatchSizing(recipe, productionTargets);

    // 2. Scale recipe to batch
    const scaled: Record<string, number> = {};
    for (const item of recipe) {
        if (!(item.ingredient in INGREDIENT_DB)) {
            warnings.push(`⚠️ '${item.ingredient}' not in INGREDIENT_DB`);
        }
        scaled[item.ingredient] = item.quantity_g * batch.scale_factor;
    }

    const metricsBefore = computeRecipeMetrics(scaled);

    // 3. Parse user instruction into numeric targets
    const optTargets = parseInstruction(customInstruction);
    const hasTargets = !!(optTargets.fat_pct || optTargets.msnf_pct || optTargets.sugars_pct);

    if (!hasTargets) {
        return {
            success: true,
            solver_status: 'N/A — Scale Only',
            batch,
            scaled_recipe: scaled,
            optimized_recipe: { ...scaled },
            metrics_before: metricsBefore,
            metrics_after: metricsBefore,
            diffs: [],
            warnings,
        };
    }

    // 4. Run LP optimizer
    const lpResult = runLpOptimizer(scaled, optTargets, mode);
    const proposed = lpResult.proposed_recipe;
    warnings.push(...lpResult.warnings);
    const metricsAfter = computeRecipeMetrics(proposed);

    // 5. Compute diffs
    const diffs: IngredientDiff[] = [];
    for (const name of Object.keys(scaled)) {
        const origG = scaled[name];
        const propG = proposed[name] ?? 0;
        const deltaG = propG - origG;
        if (Math.abs(deltaG) > 0.5) {
            const deltaPct = origG > 0 ? (deltaG / origG) * 100 : 0;
            diffs.push({
                ingredient: name,
                original_g: Math.round(origG * 100) / 100,
                proposed_g: Math.round(propG * 100) / 100,
                delta_g: Math.round(deltaG * 100) / 100,
                delta_pct: Math.round(deltaPct * 100) / 100,
            });
        }
    }
    diffs.sort((a, b) => Math.abs(b.delta_g) - Math.abs(a.delta_g));

    return {
        success: lpResult.success,
        solver_status: lpResult.solver_status,
        batch,
        scaled_recipe: scaled,
        optimized_recipe: proposed,
        metrics_before: metricsBefore,
        metrics_after: metricsAfter,
        diffs,
        warnings,
    };
}

// ── Full AI Agent Pipeline ──

/**
 * Main orchestrator — runs the full AI-powered pipeline.
 *
 * 1. Food Engineer PRE  → interprets user request, modifies recipe
 * 2. Optimizer Tool     → deterministic LP math on the modified recipe
 * 3. Food Scientist POST → reviews optimizer output for practicality
 *
 * @example
 * ```ts
 * import { runAgent } from '@/lib/ai';
 *
 * const result = await runAgent({
 *   userPrompt: 'Increase fat to 8%, MSNF to 10%, sugars to 20%',
 *   recipe: [
 *     { ingredient: 'Toned Milk 3%', quantity_g: 507970.39 },
 *     { ingredient: 'Cream 25%', quantity_g: 142300.70 },
 *     // ...
 *   ],
 *   targetParams: {
 *     lossPct: 5,
 *     mixDensity: 1.04,
 *     overrunPct: 27,
 *     skuSizeLiters: 0.75,
 *     targetVolumeLiters: 1000,
 *   },
 *   mode: 'gelato',
 * });
 * ```
 */
export async function runAgent(options: RunAgentOptions): Promise<AgentResult> {
    const { userPrompt, recipe, targetParams, mode = 'gelato', currentMetrics } = options;

    await loadIngredientsFromSupabase();

    // Step 1/3: Food Engineer (AI) — interpret request & modify recipe
    console.log('🔧 Step 1/3: Food Engineer analyzing request...');
    const preResult = await foodEngineerPre(userPrompt, recipe, currentMetrics);
    const modifiedRecipe = preResult.modified_recipe;
    const engineerChanges = preResult.changes_made;
    const optimizerInstruction = preResult.pass_to_optimizer;
    console.log(`   ✅ Engineer changes: ${engineerChanges}`);

    // Step 2/3: Optimizer Tool (deterministic LP)
    console.log('⚙️  Step 2/3: Running LP optimizer...');
    const optResult = optimizerTool(
        modifiedRecipe,
        targetParams,
        optimizerInstruction,
        mode
    );
    console.log(`   ✅ Solver: ${optResult.solver_status}`);

    // Step 3/3: Food Scientist (AI) — review results
    console.log('🧪 Step 3/3: Food Scientist reviewing results...');
    const aiAnalysis = await foodScientistReason(
        optResult as unknown as Record<string, unknown>,
        userPrompt
    );
    console.log('   ✅ Analysis complete.');

    const finalMetricsBefore = currentMetrics
        ? {
            total_mass_g: currentMetrics.total_g ?? optResult.metrics_before.total_mass_g,
            fat_pct: currentMetrics.fat_pct ?? optResult.metrics_before.fat_pct,
            msnf_pct: currentMetrics.msnf_pct ?? optResult.metrics_before.msnf_pct,
            sugars_pct: currentMetrics.totalSugars_pct ?? optResult.metrics_before.sugars_pct,
            water_pct: currentMetrics.water_pct ?? optResult.metrics_before.water_pct,
            total_solids_pct: currentMetrics.ts_pct ?? optResult.metrics_before.total_solids_pct,
        }
        : optResult.metrics_before;

    return {
        success: optResult.success,
        solver_status: optResult.solver_status,
        batch: optResult.batch,
        optimized_recipe: optResult.optimized_recipe,
        metrics_before: finalMetricsBefore,
        metrics_after: optResult.metrics_after,
        diffs: optResult.diffs,
        engineer_changes: engineerChanges,
        ai_analysis: aiAnalysis,
        warnings: optResult.warnings,
    };
}
