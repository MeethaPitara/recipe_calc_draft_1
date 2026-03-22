/**
 * Food Critique — Stage 2 Step 5 (Final Review)
 *
 * Reviews the fully optimized recipe and returns a detailed critique
 * with a final verdict (approved / needs_revision) and confidence score.
 */

import { callGemini } from './geminiClient';
import type { RecipeMetrics, FoodCritiqueResult } from './types';

// ── System Prompt ──

const FOOD_CRITIQUE_PROMPT = `You are an expert food critique specialising in frozen desserts —
ice cream, gelato, kulfi, and sorbet. You have decades of experience evaluating
both artisan and industrial formulations.

You will receive:
  1. The user's original request.
  2. The FINAL OPTIMIZED recipe (ingredient names and quantities in grams).
  3. Nutritional metrics before and after optimization (fat%, msnf%, sugars%, etc.).

Your job is to provide a THOROUGH REVIEW of the final recipe:

  1. TASTE & FLAVOUR:
     - Will this recipe taste good? Is the sweetness balanced?
     - Are there any ingredient combinations that might clash?

  2. TEXTURE & MOUTHFEEL:
     - What texture will this produce? Smooth, icy, gummy, etc.?
     - Is the fat-to-MSNF ratio appropriate for the intended product?

  3. BALANCE & NUTRITION:
     - Are the final metrics reasonable for this type of product?
     - Is total solids content appropriate? Water content?

  4. PRODUCTION FEASIBILITY:
     - Are all quantities practical for production?
     - Any shelf-life concerns?

  5. FINAL VERDICT:
     - "approved" — The recipe is good and ready for production/testing
     - "needs_revision" — There are significant issues that should be addressed

  6. CONFIDENCE SCORE (0–100):
     - How confident are you in this recipe succeeding in production?

Be honest and constructive. Focus on actionable insights.

You MUST respond with ONLY valid JSON in this exact format, nothing else:
{
  "review": "Your detailed review covering taste, texture, balance, and feasibility",
  "verdict": "approved" or "needs_revision",
  "confidence": 75
}`;

/**
 * Food Critique — reviews the optimized recipe and returns a verdict.
 */
export async function foodCritiqueReview(
    userPrompt: string,
    optimizedRecipe: Record<string, number>,
    metricsBefore: RecipeMetrics,
    metricsAfter: RecipeMetrics
): Promise<FoodCritiqueResult> {
    const prompt = `USER REQUEST:
${userPrompt}

FINAL OPTIMIZED RECIPE:
${JSON.stringify(
        Object.entries(optimizedRecipe)
            .filter(([, qty]) => qty > 0.01)
            .map(([name, qty]) => ({ ingredient: name, quantity_g: Math.round(qty * 100) / 100 })),
        null, 2
    )}

METRICS BEFORE OPTIMIZATION:
${JSON.stringify(metricsBefore, null, 2)}

METRICS AFTER OPTIMIZATION:
${JSON.stringify(metricsAfter, null, 2)}

Provide your detailed critique and verdict as JSON.`;

    try {
        let raw = await callGemini(FOOD_CRITIQUE_PROMPT, prompt);

        // Strip markdown code fences if present
        if (raw.startsWith('```')) {
            const lines = raw.split('\n');
            const filtered = lines.filter(l => !l.trim().startsWith('```'));
            raw = filtered.join('\n');
        }

        const parsed = JSON.parse(raw);

        return {
            review: parsed.review ?? 'No review provided',
            verdict: parsed.verdict === 'needs_revision' ? 'needs_revision' : 'approved',
            confidence: Math.min(100, Math.max(0, parsed.confidence ?? 50)),
        };
    } catch (err) {
        console.warn('⚠️ Food critique review failed:', err);
        return {
            review: `⚠️ Critique unavailable: ${err instanceof Error ? err.message : String(err)}`,
            verdict: 'needs_revision',
            confidence: 0,
        };
    }
}
