import re
import sys

with open("server/src/routes/ingredients.ts", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update POST route
post_body = "const { name, category, fat_pct, msnf_pct, sugars_pct, water_pct, other_solids_pct, sp_coeff, pac_coeff, cost_per_kg, lactose_pct, verification_status, verified_at, verified_source } = req.body;"
new_post_body = "const { name, category, fat_pct, msnf_pct, sugars_pct, water_pct, other_solids_pct, sp_coeff, pac_coeff, cost_per_kg, lactose_pct, verification_status, verified_at, verified_source, supplier_data_sheet_url, formulation_warnings } = req.body;"
content = content.replace(post_body, new_post_body)

post_insert = "if (verified_source != null) insertData.verified_source = verified_source;"
new_post_insert = """if (verified_source != null) insertData.verified_source = verified_source;
        if (supplier_data_sheet_url !== undefined) insertData.supplier_data_sheet_url = supplier_data_sheet_url;
        if (formulation_warnings !== undefined) insertData.formulation_warnings = formulation_warnings;"""
content = content.replace(post_insert, new_post_insert)

# 2. Update PUT route
put_fields = "const fields = ['name', 'category', 'fat_pct', 'msnf_pct', 'sugars_pct', 'water_pct', 'other_solids_pct', 'sp_coeff', 'pac_coeff', 'cost_per_kg', 'lactose_pct', 'verification_status', 'verified_at', 'verified_source'];"
new_put_fields = "const fields = ['name', 'category', 'fat_pct', 'msnf_pct', 'sugars_pct', 'water_pct', 'other_solids_pct', 'sp_coeff', 'pac_coeff', 'cost_per_kg', 'lactose_pct', 'verification_status', 'verified_at', 'verified_source', 'supplier_data_sheet_url', 'formulation_warnings'];"
content = content.replace(put_fields, new_put_fields)

# Insert snapshot logic before supabase.update
put_update_call = """const { data, error } = await supabase
            .from('ingredients')
            .update(updates)
            .eq('id', req.params.id)
            .select()
            .single();"""

new_put_update_call = """
        // --- Version History Snapshot ---
        // 1. Fetch current state
        const { data: currentState, error: fetchErr } = await supabase
            .from('ingredients')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (currentState && !fetchErr) {
            // 2. Get max version number for this ingredient
            const { data: versionsData } = await supabase
                .from('ingredient_versions')
                .select('version_number')
                .eq('ingredient_id', req.params.id)
                .order('version_number', { ascending: false })
                .limit(1);
            
            const nextVersion = (versionsData && versionsData.length > 0) ? versionsData[0].version_number + 1 : 1;

            // 3. Insert snapshot
            await supabase
                .from('ingredient_versions')
                .insert({
                    ingredient_id: req.params.id,
                    version_number: nextVersion,
                    snapshot: currentState,
                    changed_by: req.user?.id || null
                });
        }
        // --- End Version History ---

        const { data, error } = await supabase
            .from('ingredients')
            .update(updates)
            .eq('id', req.params.id)
            .select()
            .single();"""
content = content.replace(put_update_call, new_put_update_call)


# 3. Add GET /:id/versions route right before DELETE /:id
delete_route = "// ── DELETE /:id ──"
versions_route = """// ── GET /:id/versions ──
router.get('/:id/versions', requireAuth as any, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('ingredient_versions')
            .select('id, version_number, snapshot, changed_at')
            .eq('ingredient_id', req.params.id)
            .order('version_number', { ascending: false });

        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }

        res.json(data || []);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ── DELETE /:id ──"""
content = content.replace(delete_route, versions_route)


# 4. Update transformRow helper
transform_return = "verified_source: row.verified_source ?? undefined,"
new_transform_return = """verified_source: row.verified_source ?? undefined,
        supplier_data_sheet_url: row.supplier_data_sheet_url ?? undefined,
        formulation_warnings: row.formulation_warnings ?? undefined,"""
content = content.replace(transform_return, new_transform_return)

with open("server/src/routes/ingredients.ts", "w", encoding="utf-8") as f:
    f.write(content)
