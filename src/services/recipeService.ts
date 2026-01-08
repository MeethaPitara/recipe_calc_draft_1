import { getSupabase } from "@/integrations/supabase/safeClient";

export type RecipeRow = {
  id?: string;
  recipe_name: string;
  product_type?: string;
  created_at?: string;
  updated_at?: string;
  user_id?: string;
};

export async function saveRecipe(r: RecipeRow) {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("recipes")
    .insert({
      recipe_name: r.recipe_name,
      product_type: r.product_type || 'ice_cream'
    } as any)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getMyRecipes(): Promise<RecipeRow[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getRecipeById(id: string): Promise<RecipeRow | null> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateRecipe(id: string, patch: Partial<RecipeRow>) {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("recipes")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteRecipe(id: string) {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("recipes")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// Service wrapper for tests
export const RecipeService = {
  async saveRecipe(params: {
    name: string;
    rows: Array<{ ingredientId: string; grams: number }>;
    metrics?: any;
    product_type?: string;
  }): Promise<{ recipeId: string }> {
    const supabase = await getSupabase();
    
    const { data: recipe, error: recipeError } = await supabase
      .from("recipes")
      .insert({
        recipe_name: params.name,
        product_type: params.product_type || 'ice_cream'
      } as any)
      .select()
      .single();

    if (recipeError) throw new Error(`Failed to save recipe: ${recipeError.message}`);

    return {
      recipeId: recipe.id
    };
  },

  async updateRecipe(recipeId: string, params: {
    name?: string;
    rows?: Array<{ ingredientId: string; grams: number }>;
    metrics?: any;
  }): Promise<{ recipeId: string }> {
    const supabase = await getSupabase();
    
    const { error: updateError } = await supabase
      .from("recipes")
      .update({
        recipe_name: params.name,
      })
      .eq("id", recipeId);

    if (updateError) throw new Error(`Failed to update recipe: ${updateError.message}`);

    return { recipeId };
  },

  async getMyRecipes(): Promise<RecipeRow[]> {
    return getMyRecipes();
  },

  async getRecipe(id: string): Promise<RecipeRow | null> {
    return getRecipeById(id);
  },

  async deleteRecipe(id: string): Promise<void> {
    return deleteRecipe(id);
  },

  async searchRecipes(query: string): Promise<RecipeRow[]> {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("recipes")
      .select("*")
      .ilike("recipe_name", `%${query}%`)
      .order("updated_at", { ascending: false })
      .limit(20);

    if (error) throw new Error(`Failed to search recipes: ${error.message}`);
    return data || [];
  }
};
