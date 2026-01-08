/**
 * Enhanced Costing Service
 * Simplified to only use ingredients.cost_per_kg from the ingredients table
 */

import { supabase } from '@/integrations/supabase/client';
import { calculateCostBreakdown, CostBreakdown, CostingParams, DEFAULT_COSTING_PARAMS } from './costingService';

/**
 * Get ingredient cost per kg from ingredients table
 */
export async function getIngredientCost(ingredientName: string): Promise<number> {
  const { data, error } = await supabase
    .from('ingredients')
    .select('cost_per_kg')
    .eq('name', ingredientName)
    .maybeSingle();

  if (error || !data) return 0;
  return data.cost_per_kg || 0;
}

/**
 * Calculate cost for real recipe with database pricing
 */
export async function calculateRecipeCost(
  ingredients: Array<{ name: string; weight: number }>,
  params: CostingParams = DEFAULT_COSTING_PARAMS
): Promise<CostBreakdown> {
  // Fetch all ingredient costs at once
  const costPromises = ingredients.map(ing => getIngredientCost(ing.name));
  const costs = await Promise.all(costPromises);

  // Combine ingredients with their costs
  const ingredientsWithCosts = ingredients.map((ing, i) => ({
    ...ing,
    costPerKg: costs[i],
  }));

  return calculateCostBreakdown(ingredientsWithCosts, params);
}
