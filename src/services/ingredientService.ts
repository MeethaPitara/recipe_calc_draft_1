import { getSupabase } from "@/integrations/supabase/safeClient";
import { z } from "zod";
import type { IngredientData } from "@/types/ingredients";
import { trace } from "@/utils/tracer";

const DbIngredientSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  category: z.string(),
  tags: z.array(z.string()).nullable().optional(),
  notes: z.string().nullable().optional(),
  water_pct: z.number(),
  sugar_pct: z.number().nullable().optional(),
  sugars_pct: z.number().nullable().optional(),
  fat_pct: z.number(),
  msnf_pct: z.number().nullable().optional(),
  other_solids_pct: z.number().nullable().optional(),
  sugar_split: z.record(z.number()).nullable().optional(),
  sp_coeff: z.number().nullable().optional(),
  pac_coeff: z.number().nullable().optional(),
  cost_per_kg: z.number().nullable().optional(),
  lactose_pct: z.number().nullable().optional(),
});

// Validate ingredient composition (should sum to ~100%)
function validateIngredientComposition(ing: z.infer<typeof DbIngredientSchema>): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const water = ing.water_pct ?? 0;
  const sugars = ing.sugars_pct ?? 0;
  const fat = ing.fat_pct ?? 0;
  const msnf = ing.msnf_pct ?? 0;
  const other = ing.other_solids_pct ?? 0;

  // Check for negative values
  if (water < 0 || sugars < 0 || fat < 0 || msnf < 0 || other < 0) {
    warnings.push(`${ing.name}: Has negative percentage values`);
  }

  // Check for values > 100%
  if (water > 100 || sugars > 100 || fat > 100 || msnf > 100 || other > 100) {
    warnings.push(`${ing.name}: Has percentage value > 100%`);
  }

  // Check total (allow some tolerance for rounding)
  const total = water + sugars + fat + msnf + other;
  if (total < 0 || total > 110) {
    warnings.push(`${ing.name}: Composition total ${total.toFixed(1)}% is out of range`);
  }

  return { valid: warnings.length === 0, warnings };
}

function transformToIngredientData(dbRow: z.infer<typeof DbIngredientSchema>): IngredientData {
  // Sanitize values to prevent NaN in calculations
  const safeNumber = (val: number | null | undefined, fallback = 0): number => {
    if (val === null || val === undefined || isNaN(val)) return fallback;
    return Math.max(0, Math.min(val, 100)); // Clamp to 0-100
  };

  return {
    id: dbRow.id,
    name: dbRow.name,
    category: dbRow.category,
    tags: dbRow.tags || undefined,
    notes: dbRow.notes ? [dbRow.notes] : undefined,
    water_pct: safeNumber(dbRow.water_pct),
    // Handle both singular (historic/seed) and plural (schema) naming
    sugars_pct: safeNumber(dbRow.sugars_pct) || safeNumber(dbRow.sugar_pct) || undefined,
    fat_pct: safeNumber(dbRow.fat_pct),
    msnf_pct: safeNumber(dbRow.msnf_pct) || undefined,
    other_solids_pct: safeNumber(dbRow.other_solids_pct) || undefined,
    sugar_split: dbRow.sugar_split || undefined,
    sp_coeff: dbRow.sp_coeff ?? undefined,
    pac_coeff: dbRow.pac_coeff ?? undefined,
    cost_per_kg: dbRow.cost_per_kg ?? undefined,
    lactose_pct: safeNumber(dbRow.lactose_pct) || undefined,
  };
}



export async function getAllIngredients(): Promise<IngredientData[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from("ingredients").select("*").order("category").order("name");

  if (data) {
    trace('ingredientService.ts', 'getAllIngredients', 'RAW_FETCH_FROM_DB', { count: data.length, sample: data[0] });
  }

  if (error) {
    console.error('❌ Error fetching ingredients:', error);

    throw error;
  }

  const parsed = DbIngredientSchema.array().parse(data);

  // Validate and filter ingredients
  const allWarnings: string[] = [];
  const validIngredients = parsed.filter(ing => {
    const { valid, warnings } = validateIngredientComposition(ing);
    allWarnings.push(...warnings);
    return valid;
  });

  // Log warnings in development
  if (allWarnings.length > 0 && import.meta.env.DEV) {
    console.warn('⚠️ Ingredient data quality issues:', allWarnings);
  }

  // Return all ingredients but with sanitized values
  return parsed.map(transformToIngredientData);
}

export async function getByCategory(category: IngredientData["category"]): Promise<IngredientData[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from("ingredients").select("*").eq("category", category).order("name");
  if (error) throw error;
  const parsed = DbIngredientSchema.array().parse(data);
  return parsed.map(transformToIngredientData);
}

export async function getById(id: string): Promise<IngredientData | null> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from("ingredients").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? transformToIngredientData(DbIngredientSchema.parse(data)) : null;
}

export async function searchIngredients(q: string): Promise<IngredientData[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from("ingredients").select("*").ilike("name", `%${q}%`).order("name").limit(20);
  if (error) throw error;
  const parsed = DbIngredientSchema.array().parse(data);
  return parsed.map(transformToIngredientData);
}

// Service wrapper for tests
export const IngredientService = {
  async getIngredients(): Promise<IngredientData[]> {
    return getAllIngredients();
  },
  async getIngredientById(id: string): Promise<IngredientData | null> {
    return getById(id);
  },
  async searchIngredients(query: string): Promise<IngredientData[]> {
    return searchIngredients(query);
  },
  async addIngredient(ingredient: Omit<IngredientData, 'id'>): Promise<IngredientData> {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("ingredients")
      .insert({
        name: ingredient.name,
        category: ingredient.category,
        water_pct: ingredient.water_pct,
        fat_pct: ingredient.fat_pct,
        msnf_pct: ingredient.msnf_pct || null,
        sugars_pct: ingredient.sugars_pct || null,
        other_solids_pct: ingredient.other_solids_pct || null,
        sp_coeff: ingredient.sp_coeff || null,
        pac_coeff: ingredient.pac_coeff || null,
        cost_per_kg: ingredient.cost_per_kg || null,
        notes: ingredient.notes?.[0] || null,
        tags: ingredient.tags && ingredient.tags.length > 0 ? ingredient.tags : null,
        sugar_split: ingredient.sugar_split as any,
        lactose_pct: ingredient.lactose_pct || null,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to add ingredient: ${error.message}`);
    return transformToIngredientData(DbIngredientSchema.parse(data));
  },
  async updateIngredient(id: string, updates: Partial<IngredientData>): Promise<IngredientData> {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("ingredients")
      .update({
        name: updates.name,
        category: updates.category,
        water_pct: updates.water_pct,
        fat_pct: updates.fat_pct,
        msnf_pct: updates.msnf_pct,
        sugars_pct: updates.sugars_pct,
        other_solids_pct: updates.other_solids_pct,
        sp_coeff: updates.sp_coeff,
        pac_coeff: updates.pac_coeff,
        cost_per_kg: updates.cost_per_kg,
        notes: updates.notes?.[0],
        tags: updates.tags,
        sugar_split: updates.sugar_split as any,
        lactose_pct: updates.lactose_pct,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update ingredient: ${error.message}`);
    return transformToIngredientData(DbIngredientSchema.parse(data));
  },
  async deleteIngredient(id: string): Promise<void> {
    const supabase = await getSupabase();
    const { error } = await supabase.from("ingredients").delete().eq("id", id);
    if (error) throw new Error(`Failed to delete ingredient: ${error.message}`);
  }
};
