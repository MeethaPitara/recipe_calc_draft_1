/**
 * ingredientService — Frontend ingredient operations.
 * All Supabase queries moved to backend. This now delegates to /api/ingredients/*.
 */

import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/apiClient';
import type { IngredientData } from '@/types/ingredients';

// Service wrapper
export const IngredientService = {
  async getIngredients(userEmail?: string): Promise<IngredientData[]> {
    const params = userEmail ? `?userEmail=${encodeURIComponent(userEmail)}` : '';
    return apiGet<IngredientData[]>(`/api/ingredients${params}`);
  },

  async getIngredientById(id: string): Promise<IngredientData | null> {
    try {
      return await apiGet<IngredientData>(`/api/ingredients/${id}`);
    } catch {
      return null;
    }
  },

  async searchIngredients(query: string): Promise<IngredientData[]> {
    return apiGet<IngredientData[]>(`/api/ingredients/search?q=${encodeURIComponent(query)}`);
  },

  async addIngredient(ingredient: Omit<IngredientData, 'id'>, userEmail?: string): Promise<IngredientData> {
    return apiPost<IngredientData>('/api/ingredients', {
      ...ingredient,
      user_email: userEmail,
    });
  },

  async updateIngredient(id: string, updates: Partial<IngredientData>): Promise<IngredientData> {
    return apiPut<IngredientData>(`/api/ingredients/${id}`, updates);
  },

  async deleteIngredient(id: string, userEmail?: string): Promise<void> {
    await apiDelete(`/api/ingredients/${id}`);
  },
};

// Legacy exports for backward compatibility
export async function getAllIngredients(userEmail?: string): Promise<IngredientData[]> {
  return IngredientService.getIngredients(userEmail);
}

export async function getById(id: string): Promise<IngredientData | null> {
  return IngredientService.getIngredientById(id);
}

export async function searchIngredients(q: string): Promise<IngredientData[]> {
  return IngredientService.searchIngredients(q);
}
