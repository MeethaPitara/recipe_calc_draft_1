/**
 * Recipe Searcher — Stage 2 Step 1
 *
 * Fetches all saved recipes from Supabase, then uses Gemini to find the most
 * similar recipe based on PURE food-science reasoning (flavour profile, base
 * type, technique similarity) — NOT ingredient-count matching or naive metrics.
 *
 * Returns null when no recipe is relevant enough (score < threshold).
 */

import { callGemini } from './geminiClient';
import { supabase } from '@/integrations/supabase/client';
import type { RecipeItem, RecipeSearchResult } from './types';

const RELEVANCE_THRESHOLD = 40; // minimum score (0–100) to accept a match

// ── System Prompt ──

const RECIPE_SEARCH_PROMPT = `You are an expert food engineer specialising in ice cream,
gelato, kulfi, and frozen desserts.

You will receive:
  1. The user's description of the recipe they want to CREATE.
  2. A list of EXISTING recipes from the database, each with its name and ingredient list.

Your job is to identify which existing recipe is the MOST SIMILAR to what the user
wants to create. Similarity must be judged by PURE FOOD-SCIENCE REASONING:

  - Flavour profile (e.g. chocolate-based, fruit-based, nut-based)
  - Base type (dairy, vegan, sorbet, kulfi, gelato)
  - Technique compatibility (does this recipe's structure/approach translate well?)
  - Overall character and intended product category

DO NOT judge similarity based on:
  - Number of matching ingredient names
  - Raw quantity comparisons
  - Superficial keyword overlaps

For each candidate recipe, mentally assess how well its structure, ratios, and
food-science logic could serve as a STARTING POINT for what the user is asking.

You must also give a RELEVANCE SCORE from 0 to 100:
  - 80–100: Very strong match (same flavour family and base type)
  - 60–79: Good match (related category, useful as reference)
  - 40–59: Weak but usable match (some structural overlap)
  - 0–39: Not relevant enough — do NOT recommend it

If NO recipe scores 40 or above, return found=false.

You MUST respond with ONLY valid JSON in this exact format, nothing else:
{
  "found": true/false,
  "chosen_index": <0-based index of chosen recipe, or -1 if not found>,
  "relevance_score": <0–100>,
  "reasoning": "Brief explanation of WHY this recipe is or isn't a good reference"
}`;

// ── Types for DB rows ──

interface DbRecipeRow {
    ingredient: string;
    quantity_g: number;
}

interface DbRecipe {
    id: string;
    recipe_name: string;
    product_type: string;
    recipe_rows: DbRecipeRow[];
}

/**
 * Search the Supabase recipe database for the most similar recipe.
 * Returns null recipe data if nothing meets the relevance threshold.
 */
export async function searchForReferenceRecipe(
    userPrompt: string
): Promise<RecipeSearchResult> {
    // 1. Fetch all recipes with their rows
    const { data, error } = await supabase
        .from('recipes')
        .select(`id, recipe_name, product_type, recipe_rows ( ingredient, quantity_g )`)
        .order('created_at', { ascending: false });

    if (error) {
        console.warn('⚠️ Failed to load recipes from Supabase:', error);
        return {
            found: false,
            recipe_name: null,
            recipe: null,
            relevance_score: 0,
            reasoning: `Database error: ${error.message}`,
        };
    }

    const recipes = (data ?? []) as unknown as DbRecipe[];

    if (recipes.length === 0) {
        return {
            found: false,
            recipe_name: null,
            recipe: null,
            relevance_score: 0,
            reasoning: 'No recipes found in the database.',
        };
    }

    // 2. Build a summary for Gemini (names + ingredients only, no raw quantities)
    const recipeSummaries = recipes.map((r, i) => ({
        index: i,
        name: r.recipe_name,
        product_type: r.product_type,
        ingredients: r.recipe_rows.map(row => row.ingredient),
    }));

    const prompt = `USER REQUEST:
${userPrompt}

EXISTING RECIPES IN DATABASE:
${JSON.stringify(recipeSummaries, null, 2)}

Analyze each recipe's relevance using food-science reasoning and return your choice as JSON.`;

    try {
        let raw = await callGemini(RECIPE_SEARCH_PROMPT, prompt);

        // Strip markdown code fences if present
        if (raw.startsWith('```')) {
            const lines = raw.split('\n');
            const filtered = lines.filter(l => !l.trim().startsWith('```'));
            raw = filtered.join('\n');
        }

        const parsed = JSON.parse(raw);
        const score = parsed.relevance_score ?? 0;
        const chosenIdx = parsed.chosen_index ?? -1;

        if (!parsed.found || score < RELEVANCE_THRESHOLD || chosenIdx < 0 || chosenIdx >= recipes.length) {
            return {
                found: false,
                recipe_name: null,
                recipe: null,
                relevance_score: score,
                reasoning: parsed.reasoning ?? 'No sufficiently relevant recipe found.',
            };
        }

        const chosen = recipes[chosenIdx];
        const recipeItems: RecipeItem[] = chosen.recipe_rows.map(row => ({
            ingredient: row.ingredient,
            quantity_g: row.quantity_g,
        }));

        return {
            found: true,
            recipe_name: chosen.recipe_name,
            recipe: recipeItems,
            relevance_score: score,
            reasoning: parsed.reasoning,
        };
    } catch (err) {
        console.warn('⚠️ Recipe search failed:', err);
        return {
            found: false,
            recipe_name: null,
            recipe: null,
            relevance_score: 0,
            reasoning: `Search error: ${err instanceof Error ? err.message : String(err)}`,
        };
    }
}
