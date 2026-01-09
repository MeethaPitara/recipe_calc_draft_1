/**
 * Ingredient type definitions and utility functions
 * NOTE: All ingredient data now comes from Supabase via ingredientService
 * This file contains only types and pure utility functions
 */

export type IngredientData = {
  id: string;
  name: string;
  category: 'dairy'|'sugar'|'stabilizer'|'fruit'|'flavor'|'fat'|'other';
  water_pct: number;          // %
  fat_pct: number;            // %
  msnf_pct?: number;          // % (dairy only)
  other_solids_pct?: number;  // % (stabilizers, cocoa solids, salts, fiber)
  sugars_pct?: number;        // % total sugars
  sp_coeff?: number;          // relative sweetness (sucrose=1.00)
  pac_coeff?: number;         // anti-freezing coeff (sucrose≈100 baseline)
  de?: number;                // for glucose syrups (e.g., 60)
  lactose_pct?: number;       // dairy specificity
  density_g_per_ml?: number;
  cost_per_kg?: number;
  notes?: string[];
  hardening_factor?: number;  // texture hardening effect
  characterization_pct?: number; // % needed to characterize flavor
  
  // Fruit-specific: sugar breakdown (glucose + fructose + sucrose ≈ 100%)
  sugar_split?: { glucose?: number; fructose?: number; sucrose?: number };
  brix_estimate?: number;     // typical °Brix
  acidity_citric_pct?: number; // % citric acid equivalent
};

// Sugar spectrum classification utility
export const classifySugarType = (ingredient: IngredientData): 'disaccharide' | 'monosaccharide' | 'polysaccharide' | 'other' => {
  if (ingredient.id === 'sucrose' || ingredient.id === 'lactose') return 'disaccharide';
  if (ingredient.id === 'dextrose' || ingredient.name.toLowerCase().includes('fructose')) return 'monosaccharide';
  if (ingredient.de && ingredient.de < 50) return 'polysaccharide';
  if (ingredient.name.toLowerCase().includes('glucose') || ingredient.name.toLowerCase().includes('syrup')) return 'polysaccharide';
  return 'other';
};

/**
 * Validate ingredient data completeness - ENHANCED with NaN checks
 */
export function validateIngredientData(ing: IngredientData): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  
  // Check for missing critical data
  if (!ing.name || !ing.id) {
    warnings.push('Missing ingredient name or ID');
  }
  
  if (ing.water_pct === undefined || ing.fat_pct === undefined) {
    warnings.push('Missing basic composition data (water, fat)');
  }
  
  // Check for NaN or invalid numbers (CRITICAL FIX)
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
  
  // Sugar coefficient validation (prevent NaN in SP/PAC calculations)
  if (ing.category === 'sugar' || (ing.sugars_pct && ing.sugars_pct > 0)) {
    if (ing.sp_coeff === undefined || isNaN(ing.sp_coeff)) {
      warnings.push(`Missing or invalid sp_coeff for sugar ingredient - SP calculations will be inaccurate. Defaulting to 1.0 (sucrose baseline).`);
    }
    if (ing.pac_coeff === undefined || isNaN(ing.pac_coeff)) {
      warnings.push(`Missing or invalid pac_coeff for sugar ingredient - PAC calculations will be inaccurate. Defaulting to 100 (sucrose baseline).`);
    }
  }
  
  // Composition sum validation
  const total = (ing.water_pct || 0) + (ing.fat_pct || 0) + (ing.sugars_pct || 0) + 
                (ing.msnf_pct || 0) + (ing.other_solids_pct || 0);
  
  if (isNaN(total)) {
    warnings.push('Total composition is NaN - check all percentage fields!');
  } else if (Math.abs(total - 100) > 1) {
    warnings.push(`Composition doesn't sum to 100% (currently ${total.toFixed(1)}%)`);
  }
  
  // Fruit sugar split validation
  if (ing.category === 'fruit' && ing.sugar_split) {
    const { glucose = 0, fructose = 0, sucrose = 0 } = ing.sugar_split;
    const splitTotal = glucose + fructose + sucrose;
    if (isNaN(splitTotal)) {
      warnings.push('Fruit sugar split contains NaN values');
    } else if (splitTotal > 0 && Math.abs(splitTotal - 100) > 5) {
      warnings.push(`Fruit sugar split should sum to ~100% (currently ${splitTotal.toFixed(1)}%)`);
    }
  }
  
  return {
    valid: warnings.length === 0,
    warnings
  };
}
