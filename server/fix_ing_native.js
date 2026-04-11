import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !serviceKey) {
    console.error("Missing SUPABASE env vars");
    process.exit(1);
}

const FIXES = [
    { name: 'Sucrose/sugar', updates: { sugars_pct: 100, fat_pct: 0, msnf_pct: 0, water_pct: 0, other_solids_pct: 0, category: 'sugar' } },
    { name: 'Dextrose monohydrate', updates: { sugars_pct: 91, fat_pct: 0, msnf_pct: 0, water_pct: 9, other_solids_pct: 0, category: 'sugar' } },
    { name: 'Glucose Syrup (40-42DE)', updates: { sugars_pct: 78, fat_pct: 0, msnf_pct: 0, water_pct: 22, other_solids_pct: 0, category: 'sugar' } },
    { name: 'Brown Sugar', updates: { sugars_pct: 97, fat_pct: 0, msnf_pct: 0, water_pct: 1.5, other_solids_pct: 1.5, category: 'sugar' } }
];

async function run() {
    try {
        const res = await fetch(`${supabaseUrl}/rest/v1/ingredients?select=id,name`, {
            headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
        });
        const allIngredients = await res.json();
        console.log(`Found ${allIngredients.length} ingredients.`);

        for (const fix of FIXES) {
            const match = allIngredients.find(i => i.name === fix.name);
            if (!match) continue;

            const patchRes = await fetch(`${supabaseUrl}/rest/v1/ingredients?id=eq.${match.id}`, {
                method: 'PATCH',
                headers: {
                    'apikey': serviceKey,
                    'Authorization': `Bearer ${serviceKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(fix.updates)
            });
            if (patchRes.ok) {
                console.log(`[OK] Updated ${fix.name}`);
            } else {
                const errText = await patchRes.text();
                console.error(`[ERR] Failed to update ${fix.name}: ${errText}`);
            }
        }
        console.log("Done");
    } catch (err) {
        console.error("Fatal error:", err);
    }
}

run();
