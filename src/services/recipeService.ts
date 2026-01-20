
import { supabase } from "@/integrations/supabase/client";
import { MetricsV2 } from "@/lib/calc.v2";
import { IngredientData } from "@/types/ingredients";

// Define the shape of a recipe row for saving
// We map the UI "rows" to this structure
export interface RecipeRowInput {
  ingredient: string; // Name or ID
  quantity_g: number;
  fat_g: number;
  msnf_g: number;
  sugars_g: number; // Mapping totalSugars_g or similar
  other_solids_g: number;
  total_solids_g: number;
}

export const recipeService = {
  /**
   * Check for active session. Throws if not authenticated.
   */
  async requireAuth() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      throw new Error("User not authenticated. Please log in to save recipes.");
    }
    return user;
  },

  /**
   * Save a recipe (Create or Update).
   */
  async saveRecipe(
    name: string,
    type: string,
    rows: { ing: IngredientData; grams: number }[],
    metrics: MetricsV2,
    existingId?: string
  ) {
    const user = await this.requireAuth();

    // 1. Upsert Recipe Header
    const recipeData = {
      recipe_name: name,
      product_type: type,
      user_id: user.id, // Explicitly safe, though RLS defaults usually handle this too if set up
      updated_at: new Date().toISOString(),
    };

    let recipeId = existingId;

    if (recipeId) {
      // Update
      const { error: updateError } = await supabase
        .from("recipes")
        .update(recipeData)
        .eq("id", recipeId);

      if (updateError) throw updateError;
    } else {
      // Insert
      const { data: newRecipe, error: insertError } = await supabase
        .from("recipes")
        .insert(recipeData)
        .select()
        .single();

      if (insertError) throw insertError;
      recipeId = newRecipe.id;
    }

    if (!recipeId) throw new Error("Failed to resolve recipe ID");

    // 2. Clear existing items (safe due to RLS)
    const { error: deleteError } = await supabase
      .from("recipe_rows")
      .delete()
      .eq("recipe_id", recipeId);

    if (deleteError) throw deleteError;

    // 3. Insert new items
    // precise mapping from calculator rows to DB columns
    const dbRows = rows.map((r) => {
      // Calculate approximate contribution (simplified logic or per-row calc if available)
      // Since `calc.v2` aggregates, we might need to estimate or assuming 0 for now if not available per row in current UI content
      // However, `metrics` is global. We need row-level breakdown.
      // Let's do a mini-calculation per row for storing basic stats found in `recipe_rows` schema
      // Schema: fat_g, msnf_g, sugars_g, other_solids_g, total_solids_g

      const g = r.grams;
      const fat_g = g * (r.ing.fat_pct || 0) / 100;
      const msnf_g = g * (r.ing.msnf_pct || 0) / 100;
      const sugars_g = g * (r.ing.sugars_pct || 0) / 100;
      const other_g = g * (r.ing.other_solids_pct || 0) / 100; // using other_solids_pct from map
      const ts_g = fat_g + msnf_g + sugars_g + other_g;

      return {
        recipe_id: recipeId!,
        ingredient: r.ing.name, // Storing name as primitive reference
        quantity_g: r.grams,
        fat_g,
        msnf_g,
        sugars_g,
        other_solids_g: other_g,
        total_solids_g: ts_g
      };
    });

    const { error: itemsError } = await supabase
      .from("recipe_rows")
      .insert(dbRows);

    if (itemsError) throw itemsError;

    // 4. (Optional) Save global outcomes/metrics to `calculated_metrics` or `recipe_outcomes` if needed
    // For now PRD only focused on loading back ingredients, which `recipe_rows` covers.

    return recipeId;
  },

  /**
   * Get all recipes for the current user.
   */
  async getRecipes() {
    await this.requireAuth(); // Ensure logged in

    const { data, error } = await supabase
      .from("recipes")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return data;
  },

  /**
   * Get full recipe details by ID.
   */
  async getRecipeById(id: string) {
    await this.requireAuth();

    // Fetch header
    const { data: recipe, error: recipeError } = await supabase
      .from("recipes")
      .select("*")
      .eq("id", id)
      .single();

    if (recipeError || !recipe) {
      // Treat as Not Found (could be permission denied or truly missing)
      return null;
    }

    // Fetch rows
    const { data: rows, error: rowsError } = await supabase
      .from("recipe_rows")
      .select("*")
      .eq("recipe_id", id);

    if (rowsError) throw rowsError;

    return { ...recipe, rows };
  },

  /**
   * Delete a recipe.
   */
  async deleteRecipe(id: string) {
    await this.requireAuth();

    const { error } = await supabase
      .from("recipes")
      .delete()
      .eq("id", id);

    if (error) throw error;
  }
};
