import { IngredientData } from './ingredients.js';
import { MetricsV2 } from '../lib/core/calc.v2.js';

export interface RecipeIngredient {
  ingredient: string;
  quantity_g: number;
  ingredientData?: IngredientData;
}

export interface RecipeData {
  recipe: RecipeIngredient[];
  metrics: MetricsV2 | null;
  productType: string;
}
