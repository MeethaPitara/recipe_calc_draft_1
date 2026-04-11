/**
 * Recipe Metrics Calculator
 * Grounded in calc.v2.ts (Mathematical Specifications)
 */

import { INGREDIENT_DB } from './ingredientDb';
import type { RecipeMetrics } from './types';
import { calcMetricsV2 } from '../calc.v2';
import type { IngredientData } from '@/types/ingredients';

/**
 * Given { ingredientName: grams }, compute nutritional metrics.
 * Now acts as a bridge to the v2.1 validated science calculator.
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

    const rows = Object.entries(recipe).map(([name, grams]) => {
        const ingDb = INGREDIENT_DB[name] || ({} as any);

        // Build a robust IngredientData stub that calcMetricsV2 can use effectively
        const ingData: IngredientData = {
            id: name.toLowerCase().replace(/\s+/g, '_'),
            name: name,
            category: (ingDb.category || 'other') as any,
            water_pct: ingDb.water_pct ?? 0,
            fat_pct: ingDb.fat_pct ?? 0,
            msnf_pct: ingDb.msnf_pct ?? 0,
            sugars_pct: ingDb.sugars_pct ?? 0,
            // Safe fallback for other properties omitted by simple AI loop
            other_solids_pct: 0,
            pac_coeff: ingDb.pac_coeff,
            sp_coeff: ingDb.sp_coeff
        };

        // Fallback heuristics for standard AI ingredients if DB mapping failed
        if (ingData.sugars_pct === 0) {
            if (name.includes('Sucrose') || name === 'Sugar') {
                ingData.sugars_pct = 100;
            } else if (name.includes('Dextrose')) {
                ingData.sugars_pct = 91;
                ingData.water_pct = 9;
            } else if (name.includes('Glucose Syrup')) {
                ingData.sugars_pct = 78;
                ingData.water_pct = 22;
            }
        }

        return {
            ing: ingData,
            grams
        };
    });

    const v2Metrics = calcMetricsV2(rows);
    const round3 = (n: number) => Math.round(n * 1000) / 1000;

    return {
        total_mass_g: Math.round(v2Metrics.total_g * 100) / 100,
        fat_pct: round3(v2Metrics.fat_pct),
        msnf_pct: round3(v2Metrics.msnf_pct),
        sugars_pct: round3(v2Metrics.totalSugars_pct),
        water_pct: round3(v2Metrics.water_pct),
        total_solids_pct: round3(v2Metrics.ts_pct),
    };
}
