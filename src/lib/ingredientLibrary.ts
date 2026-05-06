/**
 * Ingredient Library — Types & Validation Only
 * Type definitions and basic validation for ingredient data.
 * All ingredient data comes from Supabase via ingredientService.
 */

// Re-export the canonical type from @/types/ingredients
export type { IngredientData } from '@/types/ingredients';

import type { IngredientData } from '@/types/ingredients';

// Sugar spectrum classification utility (pure, no secrets)
export const classifySugarType = (ingredient: IngredientData): 'disaccharide' | 'monosaccharide' | 'polysaccharide' | 'other' => {
  if (ingredient.id === 'sucrose' || ingredient.id === 'lactose') return 'disaccharide';
  if (ingredient.id === 'dextrose' || ingredient.name.toLowerCase().includes('fructose')) return 'monosaccharide';
  if (ingredient.de && ingredient.de < 50) return 'polysaccharide';
  if (ingredient.name.toLowerCase().includes('glucose') || ingredient.name.toLowerCase().includes('syrup')) return 'polysaccharide';
  return 'other';
};

/**
 * Validate ingredient data completeness — checks for NaN, missing fields, composition sum
 */
export function validateIngredientData(ing: IngredientData): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  if (!ing.name || !ing.id) {
    warnings.push('Missing ingredient name or ID');
  }

  if (ing.water_pct === undefined || ing.fat_pct === undefined) {
    warnings.push('Missing basic composition data (water, fat)');
  }

  const numericFields = {
    'water_pct': ing.water_pct,
    'fat_pct': ing.fat_pct,
    'sugars_pct': ing.sugars_pct,
    'msnf_pct': ing.msnf_pct,
    'other_solids_pct': ing.other_solids_pct,
    'sp_coeff': ing.sp_coeff,
    'pac_coeff': ing.pac_coeff
  };

  for (const [field, value] of Object.entries(numericFields)) {
    if (value !== undefined && (isNaN(value) || !isFinite(value))) {
      warnings.push(`${field} is NaN or infinite - this will break calculations! Defaulting to 0.`);
    }
  }

  if (ing.category === 'sugar' || (ing.sugars_pct && ing.sugars_pct > 0)) {
    if (ing.sp_coeff === undefined || isNaN(ing.sp_coeff)) {
      warnings.push(`Missing or invalid sp_coeff for sugar ingredient - SP calculations will be inaccurate.`);
    }
    if (ing.pac_coeff === undefined || isNaN(ing.pac_coeff)) {
      warnings.push(`Missing or invalid pac_coeff for sugar ingredient - PAC calculations will be inaccurate.`);
    }
  }

  const total = (ing.water_pct || 0) + (ing.fat_pct || 0) + (ing.sugars_pct || 0) +
                (ing.msnf_pct || 0) + (ing.other_solids_pct || 0);

  if (isNaN(total)) {
    warnings.push('Total composition is NaN - check all percentage fields!');
  } else if (Math.abs(total - 100) > 1) {
    warnings.push(`Composition doesn't sum to 100% (currently ${total.toFixed(1)}%)`);
  }

  if (ing.category === 'fruit' && ing.sugar_split) {
    const { glucose = 0, fructose = 0, sucrose = 0 } = ing.sugar_split;
    const splitTotal = glucose + fructose + sucrose;
    if (isNaN(splitTotal)) {
      warnings.push('Fruit sugar split contains NaN values');
    } else if (splitTotal > 0 && Math.abs(splitTotal - 100) > 5) {
      warnings.push(`Fruit sugar split should sum to ~100% (currently ${splitTotal.toFixed(1)}%)`);
    }
  }

  return { valid: warnings.length === 0, warnings };
}
