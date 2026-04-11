/**
 * Fix ingredient composition data in Supabase.
 * Run with: npx tsx fix_ingredients.ts
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

// Correct ingredient data based on food science references
const FIXES: { name: string; updates: Record<string, any> }[] = [
    {
        name: 'Sucrose/sugar',
        updates: { sugars_pct: 100, fat_pct: 0, msnf_pct: 0, water_pct: 0, other_solids_pct: 0, category: 'sugar' }
    },
    {
        name: 'Dextrose monohydrate',
        updates: { sugars_pct: 91, fat_pct: 0, msnf_pct: 0, water_pct: 9, other_solids_pct: 0, category: 'sugar' }
    },
    {
        name: 'Glucose Syrup (40-42DE)',
        updates: { sugars_pct: 78, fat_pct: 0, msnf_pct: 0, water_pct: 22, other_solids_pct: 0, category: 'sugar' }
    },
    {
        name: 'Toned Milk 3%',
        updates: { sugars_pct: 4.8, fat_pct: 3.0, msnf_pct: 8.5, water_pct: 87.7, other_solids_pct: 0, category: 'dairy' }
    },
    {
        name: 'Cream 25%',
        updates: { sugars_pct: 3.0, fat_pct: 25.0, msnf_pct: 6.5, water_pct: 64.0, other_solids_pct: 1.5, category: 'dairy' }
    },
    {
        name: 'Skimmed Milk Powder',
        updates: { sugars_pct: 51.0, fat_pct: 0.1, msnf_pct: 95.0, water_pct: 3.5, other_solids_pct: 1.4, category: 'dairy_powder' }
    },
    {
        name: 'SMP 35%',
        updates: { sugars_pct: 51.0, fat_pct: 0.1, msnf_pct: 95.0, water_pct: 3.5, other_solids_pct: 1.4, category: 'dairy_powder' }
    },
    {
        name: 'Condensed Milk Nestle',
        updates: { sugars_pct: 55.0, fat_pct: 8.0, msnf_pct: 20.0, water_pct: 27.0, other_solids_pct: 0, category: 'dairy' }
    },
    {
        name: 'Stabilizer',
        updates: { sugars_pct: 0, fat_pct: 0, msnf_pct: 0, water_pct: 5.0, other_solids_pct: 95.0, category: 'stabilizer' }
    },
    {
        name: 'Brown Sugar',
        updates: { sugars_pct: 97, fat_pct: 0, msnf_pct: 0, water_pct: 1.5, other_solids_pct: 1.5, category: 'sugar' }
    },
    {
        name: 'Honey',
        updates: { sugars_pct: 82, fat_pct: 0, msnf_pct: 0, water_pct: 17, other_solids_pct: 1, category: 'sugar' }
    },
    {
        name: 'Invert Sugar Syrup',
        updates: { sugars_pct: 70, fat_pct: 0, msnf_pct: 0, water_pct: 30, other_solids_pct: 0, category: 'sugar' }
    },
    {
        name: 'Jaggery',
        updates: { sugars_pct: 85, fat_pct: 0, msnf_pct: 0, water_pct: 5, other_solids_pct: 10, category: 'sugar' }
    },
];

async function fixIngredients() {
    console.log('Fetching current ingredients...');
    const { data: allIngredients, error: fetchErr } = await supabase
        .from('ingredients')
        .select('id, name, sugars_pct, fat_pct, msnf_pct, water_pct, category');

    if (fetchErr) {
        console.error('Failed to fetch:', fetchErr.message);
        process.exit(1);
    }

    console.log(`Found ${allIngredients!.length} ingredients.\n`);

    let updated = 0;
    for (const fix of FIXES) {
        const match = allIngredients!.find(i => i.name === fix.name);
        if (!match) {
            console.log(`⏭️  "${fix.name}" — not in DB, skipping`);
            continue;
        }

        console.log(`🔧 ${fix.name}: sugars ${match.sugars_pct}→${fix.updates.sugars_pct}%, cat "${match.category}"→"${fix.updates.category}"`);

        const { error } = await supabase
            .from('ingredients')
            .update(fix.updates)
            .eq('id', match.id);

        if (error) {
            console.log(`   ❌ ${error.message}`);
        } else {
            console.log(`   ✅ OK`);
            updated++;
        }
    }

    console.log(`\n✅ Updated ${updated}/${FIXES.length} ingredients.`);
}

fixIngredients().catch(console.error);
