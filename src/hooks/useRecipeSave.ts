/**
 * useRecipeSave - Recipe save/load operations hook
 */

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { IngredientRow } from '@/types/calculator';
import type { MetricsV2 } from '@/lib/calc.v2';

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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error('Not authenticated');
      }
      const userId = session.user.id;

      // Use upsert pattern - update if exists, create if not
      let recipeId = currentRecipeId;

      if (currentRecipeId) {
        // Update existing recipe
        const { error: updateError } = await supabase
          .from('recipes')
          .update({
            recipe_name: recipeName,
            product_type: productType,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentRecipeId);

        if (updateError) throw updateError;

        // Delete old rows
        await supabase
          .from('recipe_rows')
          .delete()
          .eq('recipe_id', currentRecipeId);
      } else {
        // Create new recipe
        const { data: newRecipe, error: createError } = await supabase
          .from('recipes')
          .insert({
            recipe_name: recipeName,
            product_type: productType,
            user_id: userId
          })
          .select()
          .single();

        if (createError) throw createError;
        recipeId = newRecipe.id;
        setCurrentRecipeId(recipeId);
      }

      // Insert new rows
      if (recipeId) {
        const rowsToInsert = rows
          .filter(r => r.ingredient && r.quantity_g > 0)
          .map(r => ({
            recipe_id: recipeId,
            ingredient: r.ingredient,
            quantity_g: r.quantity_g,
            sugars_g: r.sugars_g,
            fat_g: r.fat_g,
            msnf_g: r.msnf_g,
            other_solids_g: r.other_solids_g,
            total_solids_g: r.total_solids_g
          }));

        const { error: rowsError } = await supabase
          .from('recipe_rows')
          .insert(rowsToInsert);

        if (rowsError) throw rowsError;

        // Delete old metrics
        await supabase
          .from('calculated_metrics')
          .delete()
          .eq('recipe_id', recipeId);

        // Insert new metrics
        if (metrics) {
          const { error: metricsError } = await supabase
            .from('calculated_metrics')
            .insert({
              recipe_id: recipeId,
              total_quantity_g: metrics.total_g,
              total_solids_g: metrics.ts_g,
              total_solids_pct: metrics.ts_pct,
              sugars_pct: metrics.totalSugars_pct,
              fat_pct: metrics.fat_pct,
              msnf_pct: metrics.msnf_pct,
              other_solids_pct: metrics.other_pct,
              total_sugars_g: metrics.totalSugars_g,
              total_fat_g: metrics.fat_g,
              total_msnf_g: metrics.msnf_g,
              total_other_solids_g: metrics.other_g,
              fpdt: metrics.fpdt,
              sp: metrics.se_g, // Using SE (sucrose equivalents) as SP
              pac: metrics.fpdse, // Using FPD from sugars as PAC
              pod_index: metrics.pod_index
            });

          if (metricsError) throw metricsError;
        }

        toast({
          title: currentRecipeId ? '✓ Recipe Updated' : '✓ Recipe Saved',
          description: `"${recipeName}" saved successfully`
        });
      }
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
