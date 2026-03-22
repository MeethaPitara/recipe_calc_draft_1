/**
 * Food Scientist — Post-Optimization AI Agent
 * Port of Cell 11 — food_scientist_reason() from reverse_engine_stage1.ipynb
 *
 * Reviews the LP optimizer output and provides practical food-science analysis.
 */

import { callGemini } from './geminiClient';

// ── System Prompt ──

const FOOD_SCIENTIST_POST_PROMPT = `You are an expert food scientist specialising in ice cream,
gelato, kulfi, and frozen desserts.

You will receive:
  1. The user's original prompt / request.
  2. The LP optimizer output (a JSON with optimized_recipe, diffs, metrics, etc.).

Your job:
  - Reason about PRACTICALITY of the proposed changes.
  - Flag any issues: texture problems, taste imbalance, ingredient availability,
    cost concerns, or production feasibility.
  - If the user asked for ingredient REPLACEMENTS, comment on how the replacement
    affects the final product.
  - Be concise and actionable. No fluff.

You must NEVER:
  - Invent quantities not present in the optimizer output.
  - Suggest changes to LOCKED ingredients.
  - Contradict the solver's math — your role is to ADD practical insight on top.`;

/**
 * Post-optimization food scientist.
 * Reviews the optimizer output and gives practical food-science analysis.
 */
export async function foodScientistReason(
    optimizerOutput: Record<string, unknown>,
    userPrompt: string
): Promise<string> {
    const prompt = `USER REQUEST:
${userPrompt}

OPTIMIZER OUTPUT:
${JSON.stringify(optimizerOutput, null, 2)}

Based on the above, give your practical food-science analysis.
Focus on: practicality of the changes, any texture/taste concerns,
and replacement suggestions if the user requested any.`;

    try {
        return await callGemini(FOOD_SCIENTIST_POST_PROMPT, prompt);
    } catch (err) {
        return `⚠️ Food scientist reasoning unavailable: ${err instanceof Error ? err.message : String(err)}`;
    }
}
