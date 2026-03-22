/**
 * Stage 2 AI Pipeline — Recipe Creation from Scratch
 *
 * 5-step orchestrator:
 *   1. Recipe Searcher   → finds best reference recipe from DB (or null)
 *   2. Food Engineer     → builds draft recipe (with web search if no ref)
 *   3. Food Scientist    → validates & refines the draft
 *   4. Optimizer Tool    → LP solver balances Fat/MSNF/Sugars
 *   5. Food Critique     → reviews the final recipe with verdict
 *
 * Reuses Stage 1's optimizerTool for step 4.
 */

import { loadIngredientsFromSupabase } from './ingredientDb';
import { searchForReferenceRecipe } from './recipeSearch';
import { foodEngineerCreate } from './foodEngineerCreate';
import { foodScientistReview } from './foodScientistReview';
import { optimizerTool } from './pipeline';
import { foodCritiqueReview } from './foodCritique';
import type {
    RunStage2Options,
    Stage2AgentResult,
    ProductMode,
} from './types';

/**
 * Main Stage 2 orchestrator — creates a recipe from scratch.
 *
 * @example
 * ```ts
 * import { runStage2Agent } from '@/lib/ai';
 *
 * const result = await runStage2Agent({
 *   userPrompt: 'Make a rich chocolate gelato',
 *   targetParams: { fat_pct: 8, msnf_pct: 10, sugars_pct: 18 },
 *   productionTargets: {
 *     lossPct: 5, mixDensity: 1.04, overrunPct: 27,
 *     skuSizeLiters: 0.75, targetVolumeLiters: 1000,
 *   },
 *   mode: 'gelato',
 * });
 * ```
 */
export async function runStage2Agent(options: RunStage2Options): Promise<Stage2AgentResult> {
    const {
        userPrompt,
        targetParams,
        productionTargets,
        mode = 'gelato' as ProductMode,
    } = options;

    const warnings: string[] = [];

    // 0. Load ingredients from Supabase
    await loadIngredientsFromSupabase();

    // ── Step 1/5: Recipe Search ──
    console.log('🔍 Step 1/5: Searching for reference recipe...');
    const searchResult = await searchForReferenceRecipe(userPrompt);
    if (searchResult.found) {
        console.log(`   ✅ Found reference: "${searchResult.recipe_name}" (score: ${searchResult.relevance_score})`);
    } else {
        console.log(`   ℹ️ No relevant recipe found (score: ${searchResult.relevance_score}). Will use web search.`);
    }

    // ── Step 2/5: Food Engineer ──
    console.log('🔧 Step 2/5: Food Engineer building recipe...');
    const engineerResult = await foodEngineerCreate(
        userPrompt,
        targetParams,
        searchResult.recipe
    );
    console.log(`   ✅ Draft recipe created (${engineerResult.created_recipe.length} ingredients, web_search=${engineerResult.used_web_search})`);

    // ── Step 3/5: Food Scientist ──
    console.log('🧪 Step 3/5: Food Scientist reviewing recipe...');
    const scientistResult = await foodScientistReview(
        userPrompt,
        targetParams,
        engineerResult.created_recipe
    );
    console.log(`   ✅ Scientist review: ${scientistResult.changes_made}`);

    // ── Step 4/5: Optimizer Tool (LP Solver) ──
    console.log('⚙️  Step 4/5: Running LP optimizer...');

    // Calculate dynamic production targets so the optimizer
    // doesn't auto-scale the recipe mass unexpectedly
    const totalGrams = scientistResult.refined_recipe.reduce(
        (sum, item) => sum + Number(item.quantity_g), 0
    );
    const dynamicTargetVolumeLiters =
        (totalGrams *
            (1 + productionTargets.overrunPct / 100) *
            (1 - productionTargets.lossPct / 100)) /
        (1000 * productionTargets.mixDensity);

    const optResult = optimizerTool(
        scientistResult.refined_recipe,
        {
            ...productionTargets,
            targetVolumeLiters: dynamicTargetVolumeLiters,
        },
        scientistResult.pass_to_optimizer,
        mode
    );
    console.log(`   ✅ Solver: ${optResult.solver_status}`);
    warnings.push(...optResult.warnings);

    // ── Step 5/5: Food Critique ──
    console.log('🍽️  Step 5/5: Food Critique reviewing result...');
    const critiqueResult = await foodCritiqueReview(
        userPrompt,
        optResult.optimized_recipe,
        optResult.metrics_before,
        optResult.metrics_after
    );
    console.log(`   ✅ Verdict: ${critiqueResult.verdict} (confidence: ${critiqueResult.confidence}%)`);

    return {
        success: optResult.success,
        // Step 1
        reference_recipe_name: searchResult.recipe_name,
        reference_recipe: searchResult.recipe,
        search_reasoning: searchResult.reasoning,
        // Step 2
        draft_recipe: engineerResult.created_recipe,
        engineer_reasoning: engineerResult.reasoning,
        used_web_search: engineerResult.used_web_search,
        // Step 3
        refined_recipe: scientistResult.refined_recipe,
        scientist_changes: scientistResult.changes_made,
        scientist_reasoning: scientistResult.reasoning,
        // Step 4
        solver_status: optResult.solver_status,
        optimized_recipe: optResult.optimized_recipe,
        metrics_before: optResult.metrics_before,
        metrics_after: optResult.metrics_after,
        diffs: optResult.diffs,
        // Step 5
        critique_review: critiqueResult.review,
        critique_verdict: critiqueResult.verdict,
        critique_confidence: critiqueResult.confidence,
        // Misc
        warnings,
    };
}
