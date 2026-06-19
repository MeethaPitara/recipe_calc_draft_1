/**
 * useRecipeSave - Recipe save/load operations hook
 * Refactored to use recipeService (now API-backed) instead of direct Supabase.
 */

import { useState } from 'react';
import { recipeService } from '@/services/recipeService';
import { authService } from '@/lib/auth/authService';
import { useToast } from '@/hooks/use-toast';
import type { IngredientRow } from '@/types/calculator';
import type { MetricsV2 } from '@/lib/calcApi';

interface UseRecipeSaveProps {
  rows: IngredientRow[];
  setRows: React.Dispatch<React.SetStateAction<IngredientRow[]>>;
  recipeName: string;
  setRecipeName: (name: string) => void;
  productType: string;
  setProductType: (type: string) => void;
  metrics: MetricsV2 | null;
  currentRecipeId: string | null;
  setCurrentRecipeId: (id: string | null) => void;
  isAuthenticated: boolean;
}

interface UseRecipeSaveReturn {
  isSaving: boolean;
  saveRecipe: () => Promise<void>;
  clearRecipe: () => void;
}

export function useRecipeSave({
  rows,
  setRows,
  recipeName,
  setRecipeName,
  productType,
  setProductType,
  metrics,
  currentRecipeId,
  setCurrentRecipeId,
  isAuthenticated
}: UseRecipeSaveProps): UseRecipeSaveReturn {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const saveRecipe = async () => {
    if (!isAuthenticated) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to save recipes',
        variant: 'destructive'
      });
      return;
    }

    if (!recipeName.trim()) {
      toast({
        title: 'Recipe name required',
        description: 'Enter a name for your recipe before saving',
        variant: 'destructive'
      });
      return;
    }

    if (rows.length === 0) {
      toast({
        title: 'No ingredients',
        description: 'Add ingredients before saving',
        variant: 'destructive'
      });
      return;
    }

    setIsSaving(true);

    try {
      // Build rows in the format recipeService expects
      const saveRows = rows
        .filter(r => r.ingredient && r.quantity_g > 0)
        .map(r => ({
          ing: r.ingredientData || {
            name: r.ingredient,
            fat_pct: 0,
            msnf_pct: 0,
            sugars_pct: 0,
            other_solids_pct: 0,
          } as any,
          grams: r.quantity_g,
        }));

      const recipeId = await recipeService.saveRecipe(
        recipeName,
        productType,
        saveRows,
        metrics as MetricsV2,
        currentRecipeId || undefined
      );

      if (!currentRecipeId && recipeId) {
        setCurrentRecipeId(recipeId);
      }

      toast({
        title: currentRecipeId ? ' Recipe Updated' : ' Recipe Saved',
        description: `"${recipeName}" saved successfully`
      });
    } catch (error: any) {
      toast({
        title: 'Save failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const clearRecipe = () => {
    setRecipeName('');
    setProductType('ice_cream');
    setRows([]);
    setCurrentRecipeId(null);
  };

  return {
    isSaving,
    saveRecipe,
    clearRecipe
  };
}
