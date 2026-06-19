import { IngredientData } from '@/types/ingredients';
import { MetricsV2 } from '@/lib/calcApi';

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
