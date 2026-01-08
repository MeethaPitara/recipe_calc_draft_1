/**
 * Calculator-related types - Single source of truth
 */

import type { IngredientData } from '@/types/ingredients';

export interface IngredientRow {
  id?: string;
  ingredientData?: IngredientData;
  ingredient: string;
  quantity_g: number;
  sugars_g: number;
  fat_g: number;
  msnf_g: number;
  other_solids_g: number;
  total_solids_g: number;
}

export interface BalancingSuggestion {
  id: string;
  action: 'add' | 'increase' | 'decrease' | 'remove';
  ingredientName: string;
  ingredientId: string;
  quantityChange: number;
  reason: string;
  priority: number; // 1-3 (1 = critical, 3 = optional)
}

export interface BalancingDiagnostics {
  targets: any;
  diagnosis: any;
  productType: string;
  mode: string;
  ingredientCount: number;
  hasWater: boolean;
  hasFatSource: boolean;
  hasMSNFSource: boolean;
  missingIngredients: string[];
  suggestions: string[];
  dbHealth?: {
    healthy: boolean;
    hasWater: boolean;
    hasCream35OrButter: boolean;
    hasSMP: boolean;
    missing: string[];
  };
}

export interface RecipeState {
  recipeName: string;
  productType: string;
  rows: IngredientRow[];
  currentRecipeId: string | null;
}

/**
 * Create a new ingredient row with calculated values
 */
export function createIngredientRow(
  ingredient: IngredientData,
  quantity_g: number
): IngredientRow {
  const sugars_g = ((ingredient.sugars_pct ?? 0) / 100) * quantity_g;
  const fat_g = ((ingredient.fat_pct ?? 0) / 100) * quantity_g;
  const msnf_g = ((ingredient.msnf_pct ?? 0) / 100) * quantity_g;
  const other_solids_g = ((ingredient.other_solids_pct ?? 0) / 100) * quantity_g;
  
  return {
    ingredientData: ingredient,
    ingredient: ingredient.name,
    quantity_g,
    sugars_g,
    fat_g,
    msnf_g,
    other_solids_g,
    total_solids_g: sugars_g + fat_g + msnf_g + other_solids_g
  };
}

/**
 * Recalculate nutritional values for a row
 */
export function recalculateRowNutrition(row: IngredientRow): IngredientRow {
  if (!row.ingredientData) return row;
  
  const ing = row.ingredientData;
  const qty = row.quantity_g;
  
  return {
    ...row,
    sugars_g: ((ing.sugars_pct ?? 0) / 100) * qty,
    fat_g: ((ing.fat_pct ?? 0) / 100) * qty,
    msnf_g: ((ing.msnf_pct ?? 0) / 100) * qty,
    other_solids_g: ((ing.other_solids_pct ?? 0) / 100) * qty,
    total_solids_g: (((ing.sugars_pct ?? 0) + (ing.fat_pct ?? 0) + (ing.msnf_pct ?? 0) + (ing.other_solids_pct ?? 0)) / 100) * qty
  };
}
