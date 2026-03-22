/**
 * Ingredient Database
 * Direct port of Cell 2 from reverse_engine_stage1.ipynb
 */

import type { IngredientDB, IngredientEntry } from './types';
import { supabase } from '@/integrations/supabase/client';

// ── Default Ingredient Database ──

export const INGREDIENT_DB: IngredientDB = {
    'Toned Milk 3%': {
        fat_pct: 3.0, msnf_pct: 8.5, sugars_pct: 4.8,
        water_pct: 87.7, category: 'dairy', locked: false,
        note: 'Standard toned milk',
    },
    'Cream 25%': {
        fat_pct: 25.0, msnf_pct: 6.5, sugars_pct: 3.0,
        water_pct: 64.0, category: 'dairy', locked: false,
        note: 'Dairy cream 25% fat',
    },
    'Skimmed Milk Powder': {
        fat_pct: 0.1, msnf_pct: 95.0, sugars_pct: 51.0,
        water_pct: 3.5, category: 'dairy_powder', locked: false,
        note: 'SMP — high MSNF source',
    },
    'Condensed Milk Nestle': {
        fat_pct: 8.0, msnf_pct: 20.0, sugars_pct: 55.0,
        water_pct: 27.0, category: 'dairy', locked: false,
        note: 'Sweetened condensed milk',
    },
    'Sucrose/sugar': {
        fat_pct: 0.0, msnf_pct: 0.0, sugars_pct: 100.0,
        water_pct: 0.0, category: 'sugar', locked: false,
        note: 'Table sugar',
    },
    'Dextrose monohydrate': {
        fat_pct: 0.0, msnf_pct: 0.0, sugars_pct: 91.0,
        water_pct: 9.0, category: 'sugar', locked: false,
        note: 'Dextrose mono',
    },
    'Glucose Syrup (40-42DE)': {
        fat_pct: 0.0, msnf_pct: 0.0, sugars_pct: 78.0,
        water_pct: 22.0, category: 'sugar', locked: false,
        note: 'Glucose syrup 40-42 DE',
    },
    'Stabilizer': {
        fat_pct: 0.0, msnf_pct: 0.0, sugars_pct: 0.0,
        water_pct: 5.0, category: 'stabilizer', locked: true,
        note: 'Stabilizer blend — LOCKED',
    },
};

// ── Database Loader ──

/**
 * Replace INGREDIENT_DB contents with rows from Supabase 'ingredients' table.
 */
export async function loadIngredientsFromSupabase(): Promise<void> {
    const { data, error } = await supabase.from('ingredients').select('*');
    if (error) {
        console.error('Failed to load ingredients, falling back to defaults:', error);
        return;
    }
    if (!data || data.length === 0) {
        console.warn('No ingredients found in Supabase, keeping defaults.');
        return;
    }

    // Clear out hardcoded values
    for (const key in INGREDIENT_DB) {
        delete INGREDIENT_DB[key];
    }

    // Populate with DB rows
    for (const row of data) {
        INGREDIENT_DB[row.name] = {
            fat_pct: row.fat_pct ?? 0,
            msnf_pct: row.msnf_pct ?? 0,
            sugars_pct: row.sugars_pct ?? 0,
            water_pct: row.water_pct ?? 0,
            category: row.category || 'other',
            locked: row.category === 'stabilizer',
            note: row.notes ?? '',
        };
    }
}

// ── Runtime extension ──

/**
 * Add a custom ingredient at runtime. Not persisted to disk.
 */
export function addIngredient(
    name: string,
    props: Partial<IngredientEntry> & { fat_pct: number; water_pct: number }
): void {
    INGREDIENT_DB[name] = {
        fat_pct: props.fat_pct,
        msnf_pct: props.msnf_pct ?? 0,
        sugars_pct: props.sugars_pct ?? 0,
        water_pct: props.water_pct,
        category: props.category ?? 'other',
        locked: props.locked ?? false,
        note: props.note ?? '',
    };
}
