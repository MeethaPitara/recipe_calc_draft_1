/**
 * Chemistry Analysis Service
 * Provides deep ingredient composition analysis
 */

import { IngredientData } from '@/types/ingredients';
import { MetricsV2 } from '@/lib/calc.v2';

export interface ChemistryAnalysis {
  ingredient: IngredientData;
  composition: {
    water: number;
    sugars: number;
    fat: number;
    msnf: number;
    otherSolids: number;
  };
  functionality: {
    sweetPower: number;
    freezingEffect: number;
    bodyBuilder: boolean;
    stabilizer: boolean;
  };
  substitutions: Array<{
    name: string;
    similarity: number;
    reason: string;
  }>;
  nutritionalImpact: {
    calories: number;
    protein: number;
    carbs: number;
    sugars: number;
  };
}

export interface RecipeChemistryAnalysis {
  overallComposition: {
    water: number;
    sugars: number;
    fat: number;
    msnf: number;
    otherSolids: number;
    totalSolids: number;
  };
  functionalBalance: {
    sweeteningPower: number;
    freezingPointDepression: number;
    bodyAndTexture: string;
  };
  nutritionalProfile: {
    totalCalories: number;
    caloriesPer100g: number;
    macros: {
      protein: number;
      carbs: number;
      fat: number;
    };
  };
  recommendations: string[];
}

/**
 * Analyze individual ingredient chemistry
 */
export function analyzeIngredientChemistry(ingredient: IngredientData): ChemistryAnalysis {
  // Calculate nutritional impact (simplified)
  const calories = (ingredient.fat_pct * 9 + ingredient.sugars_pct * 4 + ingredient.msnf_pct * 4) / 100;
  const protein = ingredient.msnf_pct * 0.36; // Approximate protein from MSNF
  
  return {
    ingredient,
    composition: {
      water: ingredient.water_pct,
      sugars: ingredient.sugars_pct,
      fat: ingredient.fat_pct,
      msnf: ingredient.msnf_pct,
      otherSolids: ingredient.other_solids_pct,
    },
    functionality: {
      sweetPower: ingredient.sp_coeff || 0,
      freezingEffect: ingredient.pac_coeff || 0,
      bodyBuilder: ingredient.msnf_pct > 5 || ingredient.other_solids_pct > 5,
      stabilizer: ingredient.category === 'stabilizer' || ingredient.category === 'other',
    },
    substitutions: findSubstitutions(ingredient),
    nutritionalImpact: {
      calories: calories * 10, // per 100g
      protein: protein,
      carbs: ingredient.sugars_pct + ingredient.other_solids_pct * 0.2,
      sugars: ingredient.sugars_pct,
    },
  };
}

/**
 * Analyze complete recipe chemistry
 */
export function analyzeRecipeChemistry(
  ingredients: Array<{ ingredientData?: IngredientData; quantity_g: number }>,
  metrics: MetricsV2
): RecipeChemistryAnalysis {
  // Filter out ingredients without data
  const validIngredients = ingredients.filter(ing => ing.ingredientData) as Array<{ ingredientData: IngredientData; quantity_g: number }>;
  
  const totalWeight = validIngredients.reduce((sum, ing) => sum + ing.quantity_g, 0);
  
  // Calculate nutritional profile
  let totalCalories = 0;
  validIngredients.forEach(ing => {
    const analysis = analyzeIngredientChemistry(ing.ingredientData);
    totalCalories += (analysis.nutritionalImpact.calories * ing.quantity_g) / 1000;
  });

  const recommendations: string[] = [];
  
  // Generate recommendations
  if (metrics.totalSugars_pct < 18) {
    recommendations.push('Consider adding more sugars for better sweetness and scoopability');
  }
  if (metrics.fat_pct < 4) {
    recommendations.push('Low fat content may result in icy texture - consider cream or milk fat');
  }
  if (metrics.ts_pct < 36) {
    recommendations.push('Total solids are low - product may be too soft or icy');
  }
  if (metrics.fpdt && metrics.fpdt < -6) {
    recommendations.push('Very low freezing point - product will be very soft, may not freeze properly');
  }

  return {
    overallComposition: {
      water: 100 - metrics.ts_pct,
      sugars: metrics.totalSugars_pct,
      fat: metrics.fat_pct,
      msnf: metrics.msnf_pct,
      otherSolids: metrics.other_pct,
      totalSolids: metrics.ts_pct,
    },
    functionalBalance: {
      sweeteningPower: metrics.se_g || 0,
      freezingPointDepression: metrics.fpdt || 0,
      bodyAndTexture: getTextureDescription(metrics),
    },
    nutritionalProfile: {
      totalCalories,
      caloriesPer100g: (totalCalories / totalWeight) * 100,
      macros: {
        protein: metrics.msnf_pct * 0.36,
        carbs: metrics.totalSugars_pct + metrics.other_pct * 0.2,
        fat: metrics.fat_pct,
      },
    },
    recommendations,
  };
}

/**
 * Find similar ingredients for substitution
 */
function findSubstitutions(ingredient: IngredientData): Array<{
  name: string;
  similarity: number;
  reason: string;
}> {
  // This would ideally query the ingredient database
  // For now, return common substitutions based on category
  const substitutions: { [key: string]: Array<{ name: string; reason: string }> } = {
    milk: [
      { name: 'Skim Milk Powder', reason: 'Lower fat, similar MSNF' },
      { name: 'Cream', reason: 'Higher fat content' },
    ],
    sugar: [
      { name: 'Dextrose', reason: 'Lower sweetening power' },
      { name: 'Inverted Sugar', reason: 'Better anti-crystallization' },
    ],
    stabilizer: [
      { name: 'Guar Gum', reason: 'Similar stabilizing effect' },
      { name: 'Carrageenan', reason: 'Stronger body builder' },
    ],
  };

  const categorySubstitutions = substitutions[ingredient.category] || [];
  return categorySubstitutions.map(sub => ({
    name: sub.name,
    similarity: 0.85,
    reason: sub.reason,
  }));
}

/**
 * Get texture description from metrics
 */
function getTextureDescription(metrics: MetricsV2): string {
  if (metrics.fat_pct > 12) return 'Rich and creamy';
  if (metrics.fat_pct > 8) return 'Creamy and smooth';
  if (metrics.fat_pct > 4) return 'Light and smooth';
  if (metrics.fat_pct > 2) return 'Light bodied';
  return 'Lean and icy';
}

/**
 * Compare two ingredients side-by-side
 */
export function compareIngredients(
  ing1: IngredientData,
  ing2: IngredientData
): {
  ingredient1: ChemistryAnalysis;
  ingredient2: ChemistryAnalysis;
  differences: {
    composition: { [key: string]: number };
    functionality: { [key: string]: number };
  };
} {
  const analysis1 = analyzeIngredientChemistry(ing1);
  const analysis2 = analyzeIngredientChemistry(ing2);

  return {
    ingredient1: analysis1,
    ingredient2: analysis2,
    differences: {
      composition: {
        water: analysis2.composition.water - analysis1.composition.water,
        sugars: analysis2.composition.sugars - analysis1.composition.sugars,
        fat: analysis2.composition.fat - analysis1.composition.fat,
        msnf: analysis2.composition.msnf - analysis1.composition.msnf,
      },
      functionality: {
        sweetPower: analysis2.functionality.sweetPower - analysis1.functionality.sweetPower,
        freezingEffect: analysis2.functionality.freezingEffect - analysis1.functionality.freezingEffect,
      },
    },
  };
}