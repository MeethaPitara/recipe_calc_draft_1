/**
 * Food Scientist — Stage 2 Step 3 (Review & Refine)
 *
 * Receives the draft recipe from the Food Engineer (Stage 2) and validates it
 * using food science logic. Can modify quantities, add, remove, or substitute
 * ingredients to ensure the recipe is scientifically sound.
 */

import { callGemini } from './geminiClient';
import { INGREDIENT_DB } from './ingredientDb';
import type { RecipeItem, FoodScientistReviewResult, OptimizationTargets } from './types';

// ── System Prompt ──

const FOOD_SCIENTIST_REVIEW_PROMPT = `You are an expert food scientist specialising in ice cream,
gelato, kulfi, and frozen desserts.

You will receive:
  1. The user's original request.
  2. Target nutritional parameters (fat%, msnf%, sugars%).
  3. A DRAFT recipe created by a food engineer.
  4. The INGREDIENT_DB with all available ingredients and their properties.

Your job is to VALIDATE and REFINE the draft recipe using food science logic:

  1. CHECK the formulation for:
     - Emulsion stability (fat-to-MSNF ratio, emulsifier coverage)
     - Sweetness balance (POD / sweetening power)
     - Freezing point depression (PAC / anti-freezing power)
     - Texture quality (total solids, water content)
     - Production feasibility (practical quantities, no micro-amounts)

  2. If the recipe has issues, you MUST fix them:
     - MODIFY quantities of existing ingredients
     - ADD missing ingredients from INGREDIENT_DB (e.g. if stabilizer is missing)
     - REMOVE unnecessary or conflicting ingredients
     - SUBSTITUTE ingredients for better alternatives from INGREDIENT_DB

  3. If the recipe is already sound, return it unchanged with "No changes needed".

  4. Extract numeric targets for the LP optimizer (fat%, msnf%, sugars%) from
     the target parameters or from the recipe's intended profile.

RULES:
  - ONLY use ingredients from INGREDIENT_DB.
  - NEVER remove or modify LOCKED ingredients (locked=true in DB).
  - Keep total recipe mass reasonable (~800g to ~1200g for a base batch).
  - Be practical and specific — no vague suggestions.

You MUST respond with ONLY valid JSON in this exact format, nothing else:
{
  "refined_recipe": [
    {"ingredient": "Name", "quantity_g": 1234.56},
    ...
  ],
  "changes_made": "Brief description of what you changed and why",
  "reasoning": "Detailed food-science reasoning for your decisions",
  "pass_to_optimizer": "fat 8 msnf 10 sugars 18 (numeric targets string for the LP solver)"
}`;

/**
 * Food Scientist — reviews and refines the draft recipe.
 */
export async function foodScientistReview(
    userPrompt: string,
    targetParams: OptimizationTargets,
    draftRecipe: RecipeItem[]
): Promise<FoodScientistReviewResult> {
    // Build ingredient DB summary
    const dbSummary: Record<string, object> = {};
    for (const [name, props] of Object.entries(INGREDIENT_DB)) {
        dbSummary[name] = {
            fat_pct: props.fat_pct,
            msnf_pct: props.msnf_pct,
            sugars_pct: props.sugars_pct,
            water_pct: props.water_pct,
            category: props.category,
            locked: props.locked,
        };
    }

    const targetStr = [
        targetParams.fat_pct != null ? `Fat: ${targetParams.fat_pct}%` : null,
        targetParams.msnf_pct != null ? `MSNF: ${targetParams.msnf_pct}%` : null,
        targetParams.sugars_pct != null ? `Sugars: ${targetParams.sugars_pct}%` : null,
    ].filter(Boolean).join(', ');

    const prompt = `USER REQUEST:
${userPrompt}

TARGET PARAMETERS: ${targetStr || 'No specific numeric targets'}

DRAFT RECIPE (from food engineer):
${JSON.stringify(draftRecipe, null, 2)}

AVAILABLE INGREDIENTS (INGREDIENT_DB):
${JSON.stringify(dbSummary, null, 2)}

Review this recipe using food-science logic and return the refined recipe as JSON.`;

    try {
        let raw = await callGemini(FOOD_SCIENTIST_REVIEW_PROMPT, prompt);

        // Strip markdown code fences if present
        if (raw.startsWith('```')) {
            const lines = raw.split('\n');
            const filtered = lines.filter(l => !l.trim().startsWith('```'));
            raw = filtered.join('\n');
        }

        const parsed = JSON.parse(raw);

        // Validate that all ingredients exist in INGREDIENT_DB
        const validRecipe = (parsed.refined_recipe ?? draftRecipe).filter(
            (item: RecipeItem) => item.ingredient in INGREDIENT_DB
        );

        // Build optimizer instruction from target params
        const optimizerInstruction = parsed.pass_to_optimizer ?? [
            targetParams.fat_pct != null ? `fat ${targetParams.fat_pct}` : '',
            targetParams.msnf_pct != null ? `msnf ${targetParams.msnf_pct}` : '',
            targetParams.sugars_pct != null ? `sugars ${targetParams.sugars_pct}` : '',
        ].filter(Boolean).join(' ');

        return {
            refined_recipe: validRecipe.length > 0 ? validRecipe : draftRecipe,
            changes_made: parsed.changes_made ?? 'No changes reported',
            reasoning: parsed.reasoning ?? 'No reasoning provided',
            pass_to_optimizer: optimizerInstruction,
        };
    } catch (err) {
        console.warn('⚠️ Food scientist review failed:', err);
        // Fallback: pass the draft recipe through unchanged
        const fallbackInstruction = [
            targetParams.fat_pct != null ? `fat ${targetParams.fat_pct}` : '',
            targetParams.msnf_pct != null ? `msnf ${targetParams.msnf_pct}` : '',
            targetParams.sugars_pct != null ? `sugars ${targetParams.sugars_pct}` : '',
        ].filter(Boolean).join(' ');

        return {
            refined_recipe: draftRecipe,
            changes_made: `Skipped (error: ${err instanceof Error ? err.message : String(err)})`,
            reasoning: 'Food scientist review was skipped due to an error.',
            pass_to_optimizer: fallbackInstruction,
        };
    }
}
