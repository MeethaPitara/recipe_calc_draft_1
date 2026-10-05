import { supabase } from './supabaseClient.js';

export async function ownsRecipe(recipeId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
        .from('recipes')
        .select('id')
        .eq('id', recipeId)
        .eq('user_id', userId)
        .maybeSingle();

    if (error) throw error;
    return Boolean(data);
}
