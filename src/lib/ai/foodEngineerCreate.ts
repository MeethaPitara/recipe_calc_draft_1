/**
 * Food Engineer — Stage 2 Step 2 (Create from Scratch)
 *
 * Takes the user's prompt, target params, and an optional reference recipe.
 * Two paths:
 *   Path A (reference found): Studies the reference recipe's logic, ratios,
 *           and chef's mindset, then builds a brand-new recipe.
 *   Path B (no reference):    Uses Gemini + Google Search grounding to
 *           research real-world formulations, then builds a recipe.
 *
 * In both cases, ONLY ingredients from INGREDIENT_DB are used.
 */

import { callGemini, callGeminiWithSearch } from './geminiClient';
import { INGREDIENT_DB } from './ingredientDb';
import type { RecipeItem, FoodEngineerCreateResult, OptimizationTargets } from './types';

// ── System Prompt (Path A — with reference recipe) ──

const ENGINEER_WITH_REF_PROMPT = `You are an expert food engineer specialising in ice cream,
gelato, kulfi, and frozen desserts.

### CORE FORMULATION GUARDRAILS (HARD LIMITS)
1. **MSNF Ceiling:** NEVER exceed 12.0% MSNF. Above 11% is the "danger zone".
2. **Total Solids (TS):** Target 34-42%. Absolute max is 45%. Below 34% is icy; above 42% is heavy.
3. **Fat Content:** Target 5-10% for Gelato, 10-16% for Ice Cream. Max 16%.
4. **Sugar Content:** Target 16-24% for Gelato. Max 30%.
5. **Water Content:** Target 58-66% (Inverse of TS).

### SUGAR BLEND OPTIMIZATION RULES
When forming your sugars, structure the ratio as follows to ensure optimal freezing point:
- **Balanced (Default):** 20% Dextrose, 70% Sucrose, 10% Glucose Syrup.
- **Soft & Creamy:** 25% Dextrose, 65% Sucrose, 10% Glucose Syrup.

### OPERATIONAL RULES & ANTI-HALLUCINATION GUARDRAILS
- CRITICAL: You MUST use the EXACT exact ingredient names as they appear in INGREDIENT_DB. Do not alter casing, add spaces, or invent synonyms (e.g. if DB has "Sucrose/sugar", do not write "Sucrose" or "Sugar").
- If you invent ingredient names not exactly matching the DB strings, the backend will assign them 0% sugars, completely ruining the formulation!
- ALWAYS preserve mass conservation limits (Aim for ~1000g total for the created recipe).
- INCLUDE Stabilizer if it exists in INGREDIENT_DB (it's essential for texture).

You will receive:
  1. The user's description of the recipe they want.
  2. Target nutritional parameters (fat%, msnf%, sugars%).
  3. A REFERENCE RECIPE from the database that is structurally similar.
  4. The INGREDIENT_DB with all available ingredients and their properties.

Your job:
  1. STUDY the reference recipe deeply to understand the chef's ratios.
  2. Use those insights to BUILD A COMPLETELY NEW RECIPE incorporating the user's requests.
  3. Aim for the numeric targets, but LP solver will fine-tune later.

You MUST respond with ONLY valid JSON in this exact format, nothing else:
{
  "created_recipe": [
    {"ingredient": "Name", "quantity_g": 1234.56},
    ...
  ],
  "reasoning": "Detailed scientific explanation using the core guardrails"
}`;

// ── System Prompt (Path B — no reference, web search) ──

const ENGINEER_WEB_SEARCH_PROMPT = `You are an expert food engineer specialising in ice cream,
gelato, kulfi, and frozen desserts.

### CORE FORMULATION GUARDRAILS (HARD LIMITS)
1. **MSNF Ceiling:** NEVER exceed 12.0% MSNF. Above 11% is the "danger zone".
2. **Total Solids (TS):** Target 34-42%. Absolute max is 45%. Below 34% is icy; above 42% is heavy.
3. **Fat Content:** Target 5-10% for Gelato, 10-16% for Ice Cream. Max 16%.
4. **Sugar Content:** Target 16-24% for Gelato. Max 30%.
5. **Water Content:** Target 58-66% (Inverse of TS).

### SUGAR BLEND OPTIMIZATION RULES
When forming your sugars, structure the ratio as follows to ensure optimal freezing point:
- **Balanced (Default):** 20% Dextrose, 70% Sucrose, 10% Glucose Syrup.
- **Soft & Creamy:** 25% Dextrose, 65% Sucrose, 10% Glucose Syrup.

### OPERATIONAL RULES & ANTI-HALLUCINATION GUARDRAILS
- CRITICAL: You MUST use the EXACT exact ingredient names as they appear in INGREDIENT_DB. Do not alter casing, add spaces, or invent synonyms (e.g. if DB has "Sucrose/sugar", do not write "Sucrose" or "Sugar").
- If you invent ingredient names not exactly matching the DB strings, the backend will assign them 0% sugars, completely ruining the formulation!
- ALWAYS preserve mass conservation limits (Aim for ~1000g total for the created recipe).
- INCLUDE Stabilizer if it exists in INGREDIENT_DB (it's essential for texture).

You will receive:
  1. The user's description of the recipe they want.
  2. Target nutritional parameters (fat%, msnf%, sugars%).
  3. The INGREDIENT_DB with all available ingredients and their properties.

There is NO reference recipe in the database — you must research the recipe type
using your knowledge and the web search results provided by the grounding tool.

Your job:
  1. RESEARCH the type of frozen dessert the user wants:
     - What are typical ingredient ratios for this kind of product?
     - What techniques or ingredient combinations are industry-standard?
  2. Use that research to BUILD A NEW RECIPE using ONLY DB ingredients.
  3. Aim for the numeric targets, the LP solver will fine-tune later.

You MUST respond with ONLY valid JSON in this exact format, nothing else:
{
  "created_recipe": [
    {"ingredient": "Name", "quantity_g": 1234.56},
    ...
  ],
  "reasoning": "Detailed scientific explanation of your formulation logic and what you learned from research"
}`;

/**
 * Food Engineer — creates a recipe from scratch.
 *
 * @param userPrompt      - What the user wants to create
 * @param targetParams    - Desired fat%, msnf%, sugars%
 * @param referenceRecipe - Similar recipe from DB (null if none found)
 */
export async function foodEngineerCreate(
  userPrompt: string,
  targetParams: OptimizationTargets,
  referenceRecipe: RecipeItem[] | null
): Promise<FoodEngineerCreateResult> {
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

  const useWebSearch = referenceRecipe === null;

  let prompt: string;

  if (referenceRecipe) {
    // Path A: with reference
    prompt = `USER REQUEST:
${userPrompt}

TARGET PARAMETERS: ${targetStr || 'No specific numeric targets'}

REFERENCE RECIPE (use as structural inspiration):
${JSON.stringify(referenceRecipe, null, 2)}

AVAILABLE INGREDIENTS (INGREDIENT_DB):
${JSON.stringify(dbSummary, null, 2)}

Study the reference recipe's logic, then build a new recipe as JSON.`;
  } else {
    // Path B: web search fallback
    prompt = `USER REQUEST:
${userPrompt}

TARGET PARAMETERS: ${targetStr || 'No specific numeric targets'}

AVAILABLE INGREDIENTS (INGREDIENT_DB):
${JSON.stringify(dbSummary, null, 2)}

No reference recipe was found in the database.
Research this type of recipe using web search, then build a new recipe as JSON.`;
  }

  try {
    const systemPrompt = useWebSearch ? ENGINEER_WEB_SEARCH_PROMPT : ENGINEER_WITH_REF_PROMPT;
    let raw: string;

    if (useWebSearch) {
      console.log('   🌐 No DB reference — using web search for research...');
      raw = await callGeminiWithSearch(systemPrompt, prompt);
    } else {
      raw = await callGemini(systemPrompt, prompt);
    }

    // Strip markdown code fences if present
    if (raw.startsWith('```')) {
      const lines = raw.split('\n');
      const filtered = lines.filter(l => !l.trim().startsWith('```'));
      raw = filtered.join('\n');
    }

    const parsed = JSON.parse(raw);

    // Validate that all ingredients exist in INGREDIENT_DB
    const validRecipe = (parsed.created_recipe ?? []).filter(
      (item: RecipeItem) => item.ingredient in INGREDIENT_DB
    );

    if (validRecipe.length === 0) {
      throw new Error('Engineer returned no valid ingredients from INGREDIENT_DB');
    }

    return {
      created_recipe: validRecipe,
      reasoning: parsed.reasoning ?? 'No reasoning provided',
      used_web_search: useWebSearch,
    };
  } catch (err) {
    console.warn('⚠️ Food engineer create failed:', err);
    throw new Error(
      `Food engineer could not create recipe: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
