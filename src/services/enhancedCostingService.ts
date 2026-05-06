/**
 * Enhanced Costing Service
 * Simplified to only use ingredients.cost_per_kg from the ingredients table
 * Refactored to use backend API instead of direct Supabase
 */

import { apiGet } from '@/lib/apiClient';
import { calculateCostBreakdown, CostBreakdown, CostingParams, DEFAULT_COSTING_PARAMS } from './costingService';

/**
 * Get ingredient cost per kg from ingredients table via backend API
 */
export async function getIngredientCost(ingredientName: string): Promise<number> {
  try {
    // Search for the specific ingredient to get its cost
    const ingredients = await apiGet<any[]>(`/api/ingredients/search?q=${encodeURIComponent(ingredientName)}`);
    const match = ingredients.find(ing => ing.name === ingredientName);
    return match?.cost_per_kg || 0;
  } catch (error) {
    console.warn(`Failed to fetch cost for ${ingredientName}:`, error);
    return 0;
  }
}

/**
 * Calculate cost for real recipe with database pricing
 */
export async function calculateRecipeCost(
  ingredients: Array<{ name: string; weight: number }>,
  params: CostingParams = DEFAULT_COSTING_PARAMS
): Promise<CostBreakdown> {
  // Fetch all ingredients once to avoid multiple narrow search calls if possible
  // For better performance, we fetch all and map
  try {
    const allIngredients = await apiGet<any[]>('/api/ingredients');
    const costMap: Record<string, number> = {};
    allIngredients.forEach(ing => {
      costMap[ing.name] = ing.cost_per_kg || 0;
    });

    const ingredientsWithCosts = ingredients.map((ing) => ({
      ...ing,
      costPerKg: costMap[ing.name] || 0,
    }));

    return calculateCostBreakdown(ingredientsWithCosts, params);
  } catch (error) {
    console.warn('Failed to calculate recipe cost via API, falling back to sequential fetch:', error);

    // Fallback to sequential if bulk fetch fails
    const costPromises = ingredients.map(ing => getIngredientCost(ing.name));
    const costs = await Promise.all(costPromises);

    const ingredientsWithCosts = ingredients.map((ing, i) => ({
      ...ing,
      costPerKg: costs[i],
    }));

    return calculateCostBreakdown(ingredientsWithCosts, params);
  }
}
