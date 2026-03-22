/**
 * Recipe Metrics Calculator
 * Port of Cell 5 — compute_recipe_metrics() from reverse_engine_stage1.ipynb
 */

import { INGREDIENT_DB } from './ingredientDb';
import type { RecipeMetrics } from './types';

/**
 * Given { ingredientName: grams }, compute nutritional metrics.
 */
export function computeRecipeMetrics(
    recipe: Record<string, number>
): RecipeMetrics {
    const total = Object.values(recipe).reduce((s, v) => s + v, 0);

    if (total === 0) {
        return {
            total_mass_g: 0,
            fat_pct: 0,
            msnf_pct: 0,
            sugars_pct: 0,
            water_pct: 0,
            total_solids_pct: 0,
        };
    }

    let fatG = 0;
    let msnfG = 0;
    let sugarsG = 0;
    let waterG = 0;

    for (const [name, grams] of Object.entries(recipe)) {
        const ing = INGREDIENT_DB[name];
        if (!ing) continue;

        fatG += grams * ing.fat_pct / 100;
        msnfG += grams * ing.msnf_pct / 100;
        sugarsG += grams * ing.sugars_pct / 100;
        waterG += grams * ing.water_pct / 100;
    }

    const round3 = (n: number) => Math.round(n * 1000) / 1000;

    return {
        total_mass_g: Math.round(total * 100) / 100,
        fat_pct: round3((fatG / total) * 100),
        msnf_pct: round3((msnfG / total) * 100),
        sugars_pct: round3((sugarsG / total) * 100),
        water_pct: round3((waterG / total) * 100),
        total_solids_pct: round3((1 - waterG / total) * 100),
    };
}
