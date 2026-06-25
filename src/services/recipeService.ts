/**
 * recipeService — Frontend recipe operations.
 * All Supabase queries moved to backend. This now delegates to /api/recipes/*.
 */

import { apiGet, apiPost, apiPut, apiDelete, apiPatch } from '@/lib/apiClient';
import { authService } from '@/lib/auth/authService';
import { MetricsV2 } from '@/lib/calcApi';
import { IngredientData } from '@/types/ingredients';

export interface RecipeRowInput {
  ingredient: string;
  quantity_g: number;
  fat_g: number;
  msnf_g: number;
  sugars_g: number;
  other_solids_g: number;
  total_solids_g: number;
  ingredient_snapshot: IngredientData;
}

export const recipeService = {
  async requireAuth() {
    const user = await authService.getUser();
    if (!user) {
      throw new Error('User not authenticated. Please log in to save recipes.');
    }
    return user;
  },

  async saveRecipe(
    name: string,
    type: string,
    rows: { ing: IngredientData; grams: number }[],
    metrics: MetricsV2,
    existingId?: string,
    tags: string[] = []
  ) {
    await this.requireAuth();

    const dbRows = rows.map((r) => {
      const g = r.grams;
      const fat_g = g * (r.ing.fat_pct || 0) / 100;
      const msnf_g = g * (r.ing.msnf_pct || 0) / 100;
      const sugars_g = g * (r.ing.sugars_pct || 0) / 100;
      const other_g = g * (r.ing.other_solids_pct || 0) / 100;
      const ts_g = fat_g + msnf_g + sugars_g + other_g;

      return {
        ingredient: r.ing.name,
        quantity_g: r.grams,
        fat_g,
        msnf_g,
        sugars_g,
        other_solids_g: other_g,
        total_solids_g: ts_g,
        // PHASE 5.4: freeze the full composition as it was at save time —
        // reload must replay this, not re-resolve the ingredient live.
        ingredient_snapshot: r.ing,
      };
    });

    if (existingId) {
      const result = await apiPut<{ success: boolean; id: string }>(`/api/recipes/${existingId}`, {
        recipe_name: name,
        product_type: type,
        rows: dbRows,
        metrics,
        tags,
      });
      return existingId;
    } else {
      const result = await apiPost<{ id: string }>('/api/recipes', {
        recipe_name: name,
        product_type: type,
        rows: dbRows,
        metrics,
        tags,
      });
      return result.id;
    }
  },

  async getRecipes() {
    await this.requireAuth();
    return apiGet<any[]>('/api/recipes');
  },

  async getRecipeById(id: string) {
    await this.requireAuth();
    return apiGet<any>(`/api/recipes/${id}`);
  },

  async deleteRecipe(id: string) {
    await this.requireAuth();
    await apiDelete(`/api/recipes/${id}`);
  },

  async lockRecipe(id: string) {
    await this.requireAuth();
    return apiPatch<{ success: boolean }>(`/api/recipes/${id}/lock`);
  },

  async cloneRecipe(id: string) {
    await this.requireAuth();
    return apiPost<{ success: boolean; id: string; recipe: any }>(`/api/recipes/${id}/clone`);
  },

  async saveAiRecipe(
    name: string,
    type: string,
    optimizedRecipe: Record<string, number>,
    ingredientDb: any,
    existingId?: string
  ) {
    const rows = Object.entries(optimizedRecipe)
      .filter(([_, qty]) => Number(qty) > 0.01)
      .map(([ingName, qty]) => {
        const props = ingredientDb[ingName] || {
          fat_pct: 0, msnf_pct: 0, sugars_pct: 0, other_solids_pct: 0,
        };
        return {
          ing: { name: ingName, ...props } as IngredientData,
          grams: Number(qty),
        };
      });

    const mockMetrics = {
      totalMass: Object.values(optimizedRecipe).reduce((s, q) => s + (q as number), 0),
    } as any;

    return this.saveRecipe(name, type, rows, mockMetrics, existingId, []);
  },
};
