/**
 * AI Production Rounder — The Intelligent Bridge Between Math and Reality
 * 
 * Flow:
 * 1. Math engine produces raw quantities (Level 1/2/3) — NO AI
 * 2. AI rounds quantities to nearest 50/100g — AI CALL
 * 3. Deterministic validator checks if rounded recipe still meets targets — NO AI
 * 4. AI analyzes report and suggests adjustments if needed — AI CALL
 * 5. Repeat steps 3-4 for max 5 iterations
 * 6. Return the best recipe found
 */

import { callGemini } from '@/lib/ai/geminiClient';
import { IngredientData } from '@/types/ingredients';
import {
    validateProductionRecipe,
    formatReportForAI,
    isBetterReport,
    ProductionIngredient,
    ValidationReport
} from './productionValidator';

// ── Types ──

export interface RoundingInput {
    /** The raw production recipe from math engine */
    ingredients: ProductionIngredient[];
    /** Product type for target validation */
    productType: string;
    /** Available ingredient database */
    availableIngredients: IngredientData[];
    /** Optional: recipe name for context */
    recipeName?: string;
}

export interface RoundingIteration {
    iteration: number;
    recipe: ProductionIngredient[];
    report: ValidationReport;
    aiAction: string; // What AI did this iteration
}

export interface RoundingResult {
    success: boolean;
    /** The original unrounded recipe */
    originalRecipe: ProductionIngredient[];
    /** The best rounded recipe found */
    roundedRecipe: ProductionIngredient[];
    /** Validation report for the best recipe */
    bestReport: ValidationReport;
    /** All iterations for UI transparency */
    iterations: RoundingIteration[];
    /** Total number of iterations used */
    totalIterations: number;
    /** Human-readable summary */
    summary: string;
    /** Whether early termination happened */
    terminatedEarly: boolean;
}

// ── Constants ──

const MAX_ITERATIONS = 5;
const ROUND_THRESHOLD_KG = 1000; // 1kg = 1000g threshold

// ── Rounding Logic (Deterministic Fallback) ──

/**
 * Simple deterministic rounding to nearest 50g or 100g.
 * Used as fallback if AI rounding fails.
 */
export function deterministicRound(massGrams: number): number {
    if (massGrams <= 0) return 0;

    if (massGrams >= ROUND_THRESHOLD_KG) {
        // Round to nearest 100g for quantities >= 1kg
        return Math.round(massGrams / 100) * 100;
    } else if (massGrams >= 100) {
        // Round to nearest 50g for quantities 100g-1kg  
        return Math.round(massGrams / 50) * 50;
    } else if (massGrams >= 10) {
        // Round to nearest 10g for quantities 10g-100g
        return Math.round(massGrams / 10) * 10;
    } else {
        // Keep small quantities (< 10g) as-is (stabilizers, emulsifiers)
        return Math.round(massGrams);
    }
}

/**
 * Apply deterministic rounding to all ingredients.
 */
export function roundRecipeDeterministic(ingredients: ProductionIngredient[]): ProductionIngredient[] {
    return ingredients.map(ing => ({
        ...ing,
        massGrams: deterministicRound(ing.massGrams)
    }));
}

// ── AI Rounding ──

/**
 * Asks AI to round recipe quantities intelligently.
 */
async function aiRoundRecipe(
    ingredients: ProductionIngredient[],
    recipeName: string
): Promise<ProductionIngredient[]> {
    const recipeListStr = ingredients
        .map(ing => `  - ${ing.name}: ${ing.massGrams.toFixed(2)}g (${(ing.massGrams / 1000).toFixed(3)}kg)`)
        .join('\n');

    const systemPrompt = `You are a production planning assistant for an ice cream / gelato factory.
Your ONLY job is to round recipe ingredient quantities to practical production numbers.

RULES:
- For quantities >= 1 kg (1000g): Round to nearest 100g
- For quantities 100g - 1kg: Round to nearest 50g  
- For quantities 10g - 100g: Round to nearest 10g
- For quantities < 10g: Keep as-is (these are stabilizers/emulsifiers — precision matters)
- NEVER add or remove ingredients
- NEVER change ingredient names
- Prefer rounding to "nice" numbers that production staff can easily measure
- When rounding, prefer slight EXCESS over shortage (better to have a bit more than less)

RESPOND WITH ONLY a JSON array. No explanation, no markdown, no code fences.
Format: [{"name": "...", "massGrams": ...}, ...]`;

    const userPrompt = `Round this ${recipeName || 'production'} recipe to practical quantities:

${recipeListStr}

Return ONLY the JSON array with rounded values.`;

    try {
        const response = await callGemini(systemPrompt, userPrompt);

        // Parse AI response
        const cleaned = response
            .replace(/```json\s*/g, '')
            .replace(/```\s*/g, '')
            .trim();

        const parsed = JSON.parse(cleaned) as Array<{ name: string; massGrams: number }>;

        // Validate parsed result
        if (!Array.isArray(parsed) || parsed.length !== ingredients.length) {
            console.warn('[AIRounder] AI returned wrong number of ingredients, falling back to deterministic');
            return roundRecipeDeterministic(ingredients);
        }

        // Map back to ProductionIngredient format, preserving IDs
        return ingredients.map((original, idx) => ({
            ...original,
            massGrams: parsed[idx]?.massGrams ?? deterministicRound(original.massGrams)
        }));
    } catch (err) {
        console.error('[AIRounder] AI rounding failed, falling back to deterministic:', err);
        return roundRecipeDeterministic(ingredients);
    }
}

/**
 * Asks AI to analyze a validation report and suggest adjustments.
 */
async function aiSuggestAdjustments(
    currentRecipe: ProductionIngredient[],
    report: ValidationReport,
    iteration: number,
    recipeName: string
): Promise<ProductionIngredient[]> {
    const recipeStr = currentRecipe
        .map(ing => `  - ${ing.name}: ${ing.massGrams}g`)
        .join('\n');

    const reportStr = formatReportForAI(report);

    const systemPrompt = `You are a food scientist optimizing a production recipe for ice cream / gelato.
The recipe has been rounded to practical production numbers, but some target parameters are now out of range.

Your job: Suggest MINIMAL adjustments to bring parameters back in range.

RULES:
- Only adjust quantities, NEVER add or remove ingredients
- All adjusted quantities MUST be in round numbers:
  - >= 1kg: multiples of 100g
  - 100g-1kg: multiples of 50g
  - 10g-100g: multiples of 10g
  - < 10g: keep precise
- Make the SMALLEST possible changes
- Consider how changing one ingredient affects multiple parameters
- This is iteration ${iteration} of ${MAX_ITERATIONS}. Be more aggressive if iteration > 3.

RESPOND WITH ONLY a JSON array. No explanation, no markdown, no code fences.
Format: [{"name": "...", "massGrams": ...}, ...]`;

    const userPrompt = `Current ${recipeName} recipe (iteration ${iteration}/${MAX_ITERATIONS}):

${recipeStr}

Validation Report:
${reportStr}

Suggest adjusted quantities to bring ALL parameters in range. Return ONLY the JSON array.`;

    try {
        const response = await callGemini(systemPrompt, userPrompt);

        const cleaned = response
            .replace(/```json\s*/g, '')
            .replace(/```\s*/g, '')
            .trim();

        const parsed = JSON.parse(cleaned) as Array<{ name: string; massGrams: number }>;

        if (!Array.isArray(parsed) || parsed.length !== currentRecipe.length) {
            console.warn('[AIRounder] AI adjustment returned wrong count, no changes applied');
            return currentRecipe;
        }

        return currentRecipe.map((original, idx) => ({
            ...original,
            massGrams: parsed[idx]?.massGrams ?? original.massGrams
        }));
    } catch (err) {
        console.error('[AIRounder] AI adjustment failed:', err);
        return currentRecipe;
    }
}

// ── Main Pipeline ──

/**
 * The main AI Production Rounding pipeline.
 * 
 * Flow:
 * 1. Math output → AI rounds to practical numbers
 * 2. Validator checks targets
 * 3. If all good → done
 * 4. If not → AI suggests adjustments → re-validate → repeat (max 5x)
 * 5. Return best recipe found
 * 
 * @param input - The raw production recipe and context
 * @param onProgress - Optional callback for real-time UI updates
 */
export async function runAIProductionRounding(
    input: RoundingInput,
    onProgress?: (iteration: number, status: string) => void
): Promise<RoundingResult> {
    const { ingredients, productType, availableIngredients, recipeName = 'Production Recipe' } = input;
    const iterations: RoundingIteration[] = [];

    let bestRecipe: ProductionIngredient[] = ingredients;
    let bestReport: ValidationReport | null = null;

    console.group('🏭 AI Production Rounding Pipeline');
    console.log(`Recipe: ${recipeName}, Product: ${productType}`);
    console.log(`Ingredients: ${ingredients.length}, Max iterations: ${MAX_ITERATIONS}`);

    // ── Step 1: Initial AI Rounding ──
    onProgress?.(0, 'Rounding quantities to practical numbers...');
    console.log('Step 1: AI Rounding...');

    let currentRecipe = await aiRoundRecipe(ingredients, recipeName);

    // Log what changed
    ingredients.forEach((orig, i) => {
        const rounded = currentRecipe[i];
        if (orig.massGrams !== rounded.massGrams) {
            console.log(`  ${orig.name}: ${orig.massGrams.toFixed(1)}g → ${rounded.massGrams}g`);
        }
    });

    // ── Step 2: Initial Validation ──
    onProgress?.(0, 'Validating rounded recipe...');
    console.log('Step 2: Initial Validation...');

    let currentReport = validateProductionRecipe(currentRecipe, productType, availableIngredients);

    iterations.push({
        iteration: 0,
        recipe: [...currentRecipe],
        report: currentReport,
        aiAction: 'Initial rounding (nearest 50/100g)'
    });

    // Track best
    if (isBetterReport(currentReport, bestReport)) {
        bestRecipe = [...currentRecipe];
        bestReport = currentReport;
    }

    console.log(`  Score: ${currentReport.inRangeCount}/${currentReport.totalParams} in range`);
    console.log(`  Total error: ${currentReport.totalError.toFixed(3)}`);

    // ── Step 3: Check if already good ──
    if (currentReport.allInRange) {
        console.log('✅ All parameters in range after initial rounding!');
        console.groupEnd();

        return {
            success: true,
            originalRecipe: ingredients,
            roundedRecipe: bestRecipe,
            bestReport: bestReport!,
            iterations,
            totalIterations: 1,
            summary: 'All target parameters satisfied after rounding. No adjustments needed.',
            terminatedEarly: false
        };
    }

    // ── Step 4: Iterative AI Adjustment Loop ──
    for (let iter = 1; iter <= MAX_ITERATIONS; iter++) {
        onProgress?.(iter, `AI adjusting recipe (iteration ${iter}/${MAX_ITERATIONS})...`);
        console.log(`\nIteration ${iter}/${MAX_ITERATIONS}: AI suggesting adjustments...`);

        // 4a. AI suggests adjustments
        currentRecipe = await aiSuggestAdjustments(
            currentRecipe,
            currentReport,
            iter,
            recipeName
        );

        // 4b. Validate adjusted recipe (no AI — pure math)
        onProgress?.(iter, `Validating adjusted recipe (iteration ${iter}/${MAX_ITERATIONS})...`);
        currentReport = validateProductionRecipe(currentRecipe, productType, availableIngredients);

        iterations.push({
            iteration: iter,
            recipe: [...currentRecipe],
            report: currentReport,
            aiAction: `Iteration ${iter}: Adjusted to fix ${currentReport.params.filter(p => !p.inRange).map(p => p.param).join(', ') || 'remaining issues'
                }`
        });

        // Track best
        if (isBetterReport(currentReport, bestReport)) {
            bestRecipe = [...currentRecipe];
            bestReport = currentReport;
            console.log(`  ✨ New best! Score: ${currentReport.inRangeCount}/${currentReport.totalParams}`);
        }

        console.log(`  Score: ${currentReport.inRangeCount}/${currentReport.totalParams} in range`);
        console.log(`  Total error: ${currentReport.totalError.toFixed(3)}`);

        // 4c. Check if all good
        if (currentReport.allInRange) {
            console.log(`✅ All parameters in range after ${iter} adjustment(s)!`);
            console.groupEnd();

            return {
                success: true,
                originalRecipe: ingredients,
                roundedRecipe: bestRecipe,
                bestReport: bestReport!,
                iterations,
                totalIterations: iter + 1,
                summary: `All target parameters satisfied after ${iter} adjustment iteration(s).`,
                terminatedEarly: false
            };
        }
    }

    // ── Step 5: Max iterations reached - return best ──
    const failingParams = bestReport!.params
        .filter(p => !p.inRange)
        .map(p => `${p.param} (${p.value} vs ${p.min}-${p.max})`)
        .join(', ');

    console.warn(`⚠ Max iterations (${MAX_ITERATIONS}) reached. Returning best recipe.`);
    console.log(`  Best score: ${bestReport!.inRangeCount}/${bestReport!.totalParams}`);
    console.log(`  Still failing: ${failingParams}`);
    console.groupEnd();

    return {
        success: false,
        originalRecipe: ingredients,
        roundedRecipe: bestRecipe,
        bestReport: bestReport!,
        iterations,
        totalIterations: MAX_ITERATIONS + 1,
        summary: `Reached max ${MAX_ITERATIONS} iterations. Best result: ${bestReport!.inRangeCount}/${bestReport!.totalParams} params in range. Still failing: ${failingParams}`,
        terminatedEarly: true
    };
}
