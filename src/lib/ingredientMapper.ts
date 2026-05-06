/**
 * Ingredient Mapper — Lightweight UI Helpers
 * The full mapping intelligence runs on the backend.
 * This file retains only the pure functions needed by UI components.
 */

import type { IngredientData } from '@/types/ingredients';

// ============================================================================
// diagnoseBalancingFailure — pure UI diagnostic (no proprietary math)
// ============================================================================

export function diagnoseBalancingFailure(
  rows: { ing: IngredientData; grams: number }[],
  availableIngredients: IngredientData[],
  targets: any
): {
  missingIngredients: string[];
  suggestions: string[];
  hasWater: boolean;
  hasFatSource: boolean;
  hasMSNFSource: boolean;
} {
  const missingIngredients: string[] = [];
  const suggestions: string[] = [];

  const hasWaterInRecipe = rows.some(r => r.ing.water_pct > 80);
  const hasWaterInDB = availableIngredients.some(ing => ing.water_pct > 95);
  const hasWater = hasWaterInRecipe || hasWaterInDB;

  const hasFatInRecipe = rows.some(r => r.ing.fat_pct > 2);
  const hasFatSourceInDB = availableIngredients.some(ing => ing.fat_pct > 15);
  const hasFatSource = hasFatInRecipe || hasFatSourceInDB;

  const hasMSNFInRecipe = rows.some(r => (r.ing.msnf_pct || 0) > 5);
  const hasMSNFSourceInDB = availableIngredients.some(ing => (ing.msnf_pct || 0) > 70);
  const hasMSNFSource = hasMSNFInRecipe || hasMSNFSourceInDB;

  if (!hasWater) {
    missingIngredients.push('Water');
    suggestions.push('Add "Water" ingredient to enable fat/MSNF dilution');
  }
  if (!hasFatSource && targets.fat_pct !== undefined) {
    missingIngredients.push('High-fat ingredient (Butter or Heavy Cream 35%)');
    suggestions.push('Add heavy cream (35%+) or butter to adjust fat content');
  }
  if (!hasMSNFSource && targets.msnf_pct !== undefined) {
    missingIngredients.push('MSNF source (Skim Milk Powder)');
    suggestions.push('Add skim milk powder (SMP) to adjust MSNF independently of fat');
  }

  const ingredientCount = rows.length;
  if (ingredientCount < 3) {
    suggestions.push(`Add more ingredients (current: ${ingredientCount}, recommended: 4+)`);
  }

  const allLocked = rows.every(r =>
    r.ing.category === 'stabilizer' ||
    r.ing.category === 'flavor' ||
    r.ing.category === 'fruit'
  );
  if (allLocked) {
    suggestions.push('Recipe contains only locked ingredients (flavors/stabilizers). Add dairy or water ingredients.');
  }

  return { missingIngredients, suggestions, hasWater, hasFatSource, hasMSNFSource };
}

// ============================================================================
// checkDbHealth — checks if the ingredient database has essential items
// ============================================================================

export function checkDbHealth(allIngredients: IngredientData[]) {
  const hasWater = allIngredients.some(ing =>
    ing.water_pct >= 95 && ing.fat_pct <= 1
  );
  const hasCream35 = allIngredients.some(ing =>
    ing.fat_pct >= 30 && ing.fat_pct <= 45
  );
  const hasButter = allIngredients.some(ing =>
    ing.fat_pct >= 75
  );
  const hasSMP = allIngredients.some(ing =>
    (ing.msnf_pct || 0) >= 85
  );

  const missing: string[] = [];
  if (!hasWater) missing.push('Water (diluent)');
  if (!hasCream35 && !hasButter) missing.push('Heavy Cream 35%+ or Butter');
  if (!hasSMP) missing.push('Skim Milk Powder (SMP)');

  return {
    hasWater,
    hasCream35OrButter: hasCream35 || hasButter,
    hasSMP,
    missing,
    healthy: missing.length === 0
  };
}

// ============================================================================
// matchIngredientName — simple alias lookup for recipe importer
// ============================================================================

export function matchIngredientName(
  searchName: string,
  availableIngredients: IngredientData[]
): IngredientData | null {
  const aliases: { [key: string]: string } = {
    'sugar': 'Sucrose', 'table sugar': 'Sucrose', 'white sugar': 'Sucrose',
    'cheeni': 'Sucrose', 'shakkar': 'Sucrose',
    'dextrose monohydrate': 'Dextrose',
    'glucose': 'Glucose Syrup DE60', 'corn syrup': 'Glucose Syrup DE60',
    'milk': 'Milk 3% fat', 'whole milk': 'Milk 3% fat', 'doodh': 'Milk 3% fat',
    'cream': 'Cream 25% fat', 'heavy cream': 'Heavy Cream',
    'malai': 'Heavy Cream 35%', 'whipping cream': 'Cream 25% fat',
    'skim milk powder': 'Skim Milk Powder', 'nonfat dry milk': 'Skim Milk Powder',
    'khoya': 'Mawa (Khoya)', 'khoa': 'Mawa (Khoya)', 'mawa': 'Mawa (Khoya)',
    'stabilizer': 'Stabilizer Blend', 'stabiliser': 'Stabilizer Blend',
    'egg yolk': 'Egg Yolks', 'egg yolks': 'Egg Yolks',
    'vanilla': 'Vanilla Extract',
    'pista': 'Pistachio Paste', 'pistachio': 'Pistachio Paste',
    'hazelnut': 'Hazelnut Paste', 'nocciola': 'Hazelnut Paste',
    'badam': 'Almond Paste', 'almond': 'Almond Paste',
    'dark chocolate': 'Dark Chocolate 70%',
    'milk chocolate': 'Milk Chocolate', 'white chocolate': 'White Chocolate',
    'cocoa': 'Cocoa Powder (Dutch)', 'cocoa powder': 'Cocoa Powder (Dutch)',
    'mango': 'Mango Alphonso Pulp', 'aam': 'Mango Alphonso Pulp',
    'strawberry': 'Strawberry Puree', 'raspberry': 'Raspberry Puree',
    'banana': 'Banana Puree', 'lemon': 'Lemon Juice', 'nimbu': 'Lemon Juice',
  };

  const searchLower = searchName.toLowerCase();
  const resolvedName = aliases[searchLower] || searchName;

  return availableIngredients.find(ing =>
    ing.name.toLowerCase() === resolvedName.toLowerCase()
  ) || null;
}
