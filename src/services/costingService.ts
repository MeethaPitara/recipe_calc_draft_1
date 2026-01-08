/**
 * Costing Service
 * Handles cost calculations, pricing strategies, and export functionality
 */

export interface IngredientCost {
  name: string;
  weight: number;
  costPerKg: number;
  totalCost: number;
}

export interface CostBreakdown {
  ingredients: IngredientCost[];
  totalIngredientCost: number;
  wasteFactor: number;
  wasteAmount: number;
  laborCost: number;
  overheadCost: number;
  packagingCost: number;
  totalDirectCost: number;
  totalCost: number;
}

export interface PricingStrategy {
  strategy: 'markup' | 'margin' | 'competitive';
  value: number; // percentage or absolute value
  suggestedPrice: number;
  profit: number;
  profitMargin: number;
}

export interface CostingParams {
  batchSize: number; // in kg
  wasteFactor: number; // percentage (e.g., 5 = 5%)
  laborCostPerBatch: number;
  overheadPercentage: number; // percentage of ingredient cost
  packagingCostPerKg: number;
}

export const DEFAULT_COSTING_PARAMS: CostingParams = {
  batchSize: 10,
  wasteFactor: 5,
  laborCostPerBatch: 500,
  overheadPercentage: 15,
  packagingCostPerKg: 50,
};

/**
 * Calculate cost breakdown for a recipe
 */
export function calculateCostBreakdown(
  ingredients: Array<{ name: string; weight: number; costPerKg?: number }>,
  params: CostingParams = DEFAULT_COSTING_PARAMS
): CostBreakdown {
  // Calculate ingredient costs
  const ingredientCosts: IngredientCost[] = ingredients.map(ing => ({
    name: ing.name,
    weight: ing.weight,
    costPerKg: ing.costPerKg || 0,
    totalCost: (ing.weight * (ing.costPerKg || 0)) / 1000, // weight in grams, cost per kg
  }));

  const totalIngredientCost = ingredientCosts.reduce((sum, ing) => sum + ing.totalCost, 0);

  // Calculate waste
  const wasteAmount = (totalIngredientCost * params.wasteFactor) / 100;

  // Calculate overhead
  const overheadCost = (totalIngredientCost * params.overheadPercentage) / 100;

  // Calculate packaging cost
  const totalWeight = ingredients.reduce((sum, ing) => sum + ing.weight, 0) / 1000; // in kg
  const packagingCost = totalWeight * params.packagingCostPerKg;

  // Calculate total direct cost
  const totalDirectCost = totalIngredientCost + wasteAmount;

  // Calculate total cost including all factors
  const totalCost = totalDirectCost + params.laborCostPerBatch + overheadCost + packagingCost;

  return {
    ingredients: ingredientCosts,
    totalIngredientCost,
    wasteFactor: params.wasteFactor,
    wasteAmount,
    laborCost: params.laborCostPerBatch,
    overheadCost,
    packagingCost,
    totalDirectCost,
    totalCost,
  };
}

/**
 * Calculate pricing strategies
 */
export function calculatePricingStrategies(
  costBreakdown: CostBreakdown,
  batchSize: number
): PricingStrategy[] {
  const costPerKg = costBreakdown.totalCost / batchSize;

  const strategies: PricingStrategy[] = [
    {
      strategy: 'markup',
      value: 100, // 100% markup
      suggestedPrice: costPerKg * 2,
      profit: costPerKg,
      profitMargin: 50,
    },
    {
      strategy: 'markup',
      value: 150, // 150% markup
      suggestedPrice: costPerKg * 2.5,
      profit: costPerKg * 1.5,
      profitMargin: 60,
    },
    {
      strategy: 'margin',
      value: 40, // 40% margin
      suggestedPrice: costPerKg / 0.6,
      profit: (costPerKg / 0.6) - costPerKg,
      profitMargin: 40,
    },
    {
      strategy: 'margin',
      value: 50, // 50% margin
      suggestedPrice: costPerKg / 0.5,
      profit: (costPerKg / 0.5) - costPerKg,
      profitMargin: 50,
    },
  ];

  return strategies;
}

/**
 * Calculate cost per serving
 */
export function calculateCostPerServing(
  totalCost: number,
  batchSize: number,
  servingSize: number = 100 // in grams
): number {
  const costPerGram = totalCost / (batchSize * 1000);
  return costPerGram * servingSize;
}

/**
 * Export cost analysis to CSV
 */
export function exportToCSV(
  costBreakdown: CostBreakdown,
  pricingStrategies: PricingStrategy[],
  batchSize: number
): string {
  let csv = 'Cost Analysis Report\n\n';
  
  // Ingredient costs
  csv += 'Ingredient Costs\n';
  csv += 'Ingredient,Weight (g),Cost/kg (₹),Total Cost (₹)\n';
  costBreakdown.ingredients.forEach(ing => {
    csv += `${ing.name},${ing.weight},${ing.costPerKg},${ing.totalCost.toFixed(2)}\n`;
  });
  
  csv += '\n';
  
  // Cost summary
  csv += 'Cost Summary\n';
  csv += `Total Ingredient Cost,${costBreakdown.totalIngredientCost.toFixed(2)}\n`;
  csv += `Waste (${costBreakdown.wasteFactor}%),${costBreakdown.wasteAmount.toFixed(2)}\n`;
  csv += `Labor Cost,${costBreakdown.laborCost.toFixed(2)}\n`;
  csv += `Overhead Cost,${costBreakdown.overheadCost.toFixed(2)}\n`;
  csv += `Packaging Cost,${costBreakdown.packagingCost.toFixed(2)}\n`;
  csv += `Total Cost,${costBreakdown.totalCost.toFixed(2)}\n`;
  csv += `Cost per kg,${(costBreakdown.totalCost / batchSize).toFixed(2)}\n`;
  
  csv += '\n';
  
  // Pricing strategies
  csv += 'Pricing Strategies\n';
  csv += 'Strategy,Value,Suggested Price/kg (₹),Profit/kg (₹),Margin (%)\n';
  pricingStrategies.forEach(strategy => {
    const strategyLabel = strategy.strategy === 'markup' 
      ? `Markup ${strategy.value}%` 
      : `Margin ${strategy.value}%`;
    csv += `${strategyLabel},${strategy.value},${strategy.suggestedPrice.toFixed(2)},${strategy.profit.toFixed(2)},${strategy.profitMargin.toFixed(2)}\n`;
  });
  
  return csv;
}

/**
 * Download CSV file
 */
export function downloadCSV(csvContent: string, filename: string = 'cost-analysis.csv') {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
