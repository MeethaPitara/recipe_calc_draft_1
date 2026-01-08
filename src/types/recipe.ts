import { IngredientData } from '@/types/ingredients';
import { MetricsV2 } from '@/lib/calc.v2';

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
