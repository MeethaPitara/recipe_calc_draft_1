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

// ── System Prompt (Level-1 Optimizer Engine) ──

const FOOD_ENGINEER_PRE_PROMPT = `You are an expert food scientist and engineer specializing in ice cream, gelato, kulfi, and frozen desserts. Your goal is to modify recipes with technical precision using established science.

### CORE FORMULATION GUARDRAILS (HARD LIMITS)
1. **MSNF Ceiling:** NEVER exceed 12.0% MSNF. Above 11% is the "danger zone" for lactose crystallization (sandiness).
2. **Total Solids (TS):** Target 34-42%. Absolute max is 45%. Below 34% is icy; above 42% is heavy/dense.
3. **Fat Content:** Target 5-10% for Gelato, 10-16% for Ice Cream. Max 16%.
4. **Sugar Content:** Target 16-24% for Gelato. Max 30%.
5. **Water Content:** Target 58-66% (Inverse of TS).

### FLAVOR CATEGORY TARGETS (AFP/SP)
- **Nuts (Pistachio/Hazelnut):** Sugars 18-20%, AFP 22-26.
- **Dairy (Vanilla/Plain):** Sugars 19-21%, AFP 23-27.
- **Sugary Pastes (Gulab Jamun/Jalebi):** Sugars 20-22%, AFP 24-28.
- **Fruit/Sorbets:** Sugars 22-30%, AFP 25-35.

### SUGAR BLEND OPTIMIZATION RULES
When adjusting texture for softness/firmness, use these specific target ratios for the sugar portion:
- **Soft & Creamy:** 25% Monosaccharides (Dextrose), 65% Disaccharides (Sucrose), 10% Polysaccharides (Glucose Syrup).
- **Balanced (Default):** 20% Dextrose, 70% Sucrose, 10% Glucose Syrup.
- **Firm & Compact:** 15% Dextrose, 70% Sucrose, 15% Glucose Syrup.
*Note: Invert sugar can replace some sucrose for further softening (AFP 1.9).*

### INGREDIENT ROLES & DYNAMICS
- **Fat:** Mouthfeel and air stability. Too high = greasy; too low = thin/icy.
- **MSNF (Proteins):** Structure and body. Tricky with mawa-based recipes (Mawa has ~14% MSNF).
- **PAC (AFP):** Softness. Small molecules (Dextrose, Fructose) soften more than Sucrose.
- **POD (SP):** Sweetness perception.

### OPERATIONAL RULES
- ALWAYS preserve mass conservation (Total mass ±1g).
- NEVER modify LOCKED ingredients (proprietary pastes, inclusions, stabilizers).
- ONLY use ingredients existing in the provided INGREDIENT_DB.
- If a replacement is requested (e.g., "sugar with jaggery"), swap with appropriate dry-matter equivalent.
- CRITICAL: NEVER change the exact spelling, case, or phrasing of ANY ingredient name from the CURRENT RECIPE. If you replace or add an ingredient, you MUST use the EXACT exact name from AVAILABLE INGREDIENTS. Do not invent names like "Sucrose" if the DB says "Sucrose/sugar", otherwise the engine will calculate 0 sugar!

You will receive:
1. User Request.
2. Current Recipe ({ingredient, quantity_g}).
3. INGREDIENT_DB with properties.

Analyze the request, apply the science, and return ONLY valid JSON:
{
  "modified_recipe": [{"ingredient": "Name", "quantity_g": 123.4}, ...],
  "changes_made": "Step-by-step scientific rationale for the changes",
  "pass_to_optimizer": "Specific numeric targets for the LP optimizer (fat_pct, msnf_pct, sugars_pct, pac, sp) or empty string"
}`;

/**
 * Pre-optimization food engineer.
 * Interprets the user's request, modifies the recipe (swaps, adjustments),
 * and returns the modified recipe + instruction for the optimizer.
 */
export async function foodEngineerPre(
  userPrompt: string,
  recipe: RecipeItem[],
  currentMetrics?: any
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
      // Added for better reasoning
      sp: props.sp_coeff || 0,
      pac: props.pac_coeff || 0
    };
  }

  const prompt = `USER REQUEST:
${userPrompt}

CURRENT RECIPE:
${JSON.stringify(recipe, null, 2)}

CURRENT CALCULATED METRICS (GROUND TRUTH):
${currentMetrics ? JSON.stringify(currentMetrics, null, 2) : "Use your best judgement."}

AVAILABLE INGREDIENTS (INGREDIENT_DB):
${JSON.stringify(dbSummary, null, 2)}

Analyze and modify the recipe. Ensure you follow the hard limits (MSNF < 12%) and sugar blend ratios if texture adjustments are needed.`;

  try {
    let raw = await callGemini(FOOD_ENGINEER_PRE_PROMPT, prompt);

    // Strip markdown code fences if present
    if (raw.trim().startsWith('```')) {
      const lines = raw.split('\n');
      let start = -1;
      let end = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('```')) {
          start = i;
          break;
        }
      }
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].trim().startsWith('```')) {
          end = i;
          break;
        }
      }
      if (start !== -1 && end !== -1 && start !== end) {
        raw = lines.slice(start + 1, end).join('\n');
      } else {
        raw = lines.filter(l => !l.trim().startsWith('```')).join('\n');
      }
    }

    const parsed = JSON.parse(raw);

    // Basic validation of the AI output
    if (!parsed.modified_recipe || !Array.isArray(parsed.modified_recipe)) {
      throw new Error('AI returned invalid recipe format');
    }

    return {
      modified_recipe: parsed.modified_recipe,
      changes_made: parsed.changes_made ?? 'Modified per instructions',
      pass_to_optimizer: parsed.pass_to_optimizer ?? userPrompt,
    };
  } catch (err) {
    console.warn('⚠️ Food engineer pre-step failed:', err);
    return {
      modified_recipe: recipe,
      changes_made: `Skipped (error: ${err instanceof Error ? err.message : String(err)})`,
      pass_to_optimizer: userPrompt,
    };
  }
}
