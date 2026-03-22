/**
 * Food Engineer — Pre-Optimization AI Agent
 * Port of Cell 10 — food_engineer_pre() from reverse_engine_stage1.ipynb
 *
 * Interprets the user's request (replacements, qualitative adjustments, numeric targets)
 * and modifies the recipe BEFORE the LP optimizer runs.
 */

import { callGemini } from './geminiClient';
import { INGREDIENT_DB } from './ingredientDb';
import type { RecipeItem, FoodEngineerResult } from './types';

// ── System Prompt ──

const FOOD_ENGINEER_PRE_PROMPT = `You are an expert food engineer specialising in ice cream,
gelato, kulfi, and frozen desserts.

You will receive:
  1. The user's request (e.g. "replace sugar with jaggery", "make it less creamy",
     "increase fat to 8%", etc.)
  2. The current recipe as a JSON list of {ingredient, quantity_g}.
  3. The available INGREDIENT_DB with all known ingredients and their properties.

Your job is to MODIFY the recipe based on the user's request BEFORE it goes to the
LP optimizer. You must reason and act:

  - REPLACEMENT requests (e.g. "replace X with Y"):
    Look for the replacement ingredient in INGREDIENT_DB.
    If found, swap it in with an appropriate quantity (use similar mass as the
    original, adjusted for concentration differences).
    Remove the original ingredient being replaced.

  - QUALITATIVE requests (e.g. "less creamy", "more icy", "lighter texture"):
    Reason about which ingredients affect that quality.
    Adjust quantities of existing ingredients, or swap ingredients, as appropriate.
    E.g. "less creamy" → reduce Cream 25% and/or increase Toned Milk 3%.

  - NUMERIC TARGET requests (e.g. "fat to 8%", "sugars to 20%"):
    Pass these through as-is — do NOT try to hit numeric targets yourself.
    The LP optimizer will handle the exact math.
    Just return the recipe unchanged for these.

RULES:
  - NEVER modify LOCKED ingredients (locked=True in the DB).
  - ONLY use ingredients that exist in INGREDIENT_DB.
  - Keep total recipe mass roughly the same (±10%).
  - Be practical: consider taste, texture, and production feasibility.

You MUST respond with ONLY valid JSON in this exact format, nothing else:
{
  "modified_recipe": [
    {"ingredient": "Name", "quantity_g": 1234.56},
    ...
  ],
  "changes_made": "Brief description of what you changed and why",
  "pass_to_optimizer": "The instruction string to pass to the optimizer (numeric targets only, or empty string if none)"
}`;

/**
 * Pre-optimization food engineer.
 * Interprets the user's request, modifies the recipe (swaps, adjustments),
 * and returns the modified recipe + instruction for the optimizer.
 */
export async function foodEngineerPre(
    userPrompt: string,
    recipe: RecipeItem[]
): Promise<FoodEngineerResult> {
    // Build a summary of the ingredient DB for the prompt
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

    const prompt = `USER REQUEST:
${userPrompt}

CURRENT RECIPE:
${JSON.stringify(recipe, null, 2)}

AVAILABLE INGREDIENTS (INGREDIENT_DB):
${JSON.stringify(dbSummary, null, 2)}

Analyze the request and return the modified recipe as JSON.`;

    try {
        let raw = await callGemini(FOOD_ENGINEER_PRE_PROMPT, prompt);

        // Strip markdown code fences if present
        if (raw.startsWith('```')) {
            const lines = raw.split('\n');
            const filtered = lines.filter(l => !l.trim().startsWith('```'));
            raw = filtered.join('\n');
        }

        const parsed = JSON.parse(raw);

        return {
            modified_recipe: parsed.modified_recipe ?? recipe,
            changes_made: parsed.changes_made ?? 'No changes',
            pass_to_optimizer: parsed.pass_to_optimizer ?? userPrompt,
        };
    } catch (err) {
        console.warn('⚠️ Food engineer pre-step failed:', err);
        console.warn('   Passing original recipe to optimizer unchanged.');
        return {
            modified_recipe: recipe,
            changes_made: `Skipped (error: ${err instanceof Error ? err.message : String(err)})`,
            pass_to_optimizer: userPrompt,
        };
    }
}
