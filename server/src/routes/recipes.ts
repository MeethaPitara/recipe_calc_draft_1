/**
 * Recipes Routes
 * Migrated from src/services/recipeService.ts + src/hooks/useRecipeSave.ts
 *
 * GET    /api/recipes       — List user's recipes
 * GET    /api/recipes/:id   — Get recipe with rows
 * POST   /api/recipes       — Create recipe (header + rows + metrics)
 * PUT    /api/recipes/:id   — Update recipe
 * DELETE /api/recipes/:id   — Delete recipe
 */

import { Router } from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// All recipe routes require auth
router.use(requireAuth as any);

// ── GET / — List user's recipes ──
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('recipes')
            .select('*')
            .eq('user_id', req.user!.id)
            .order('updated_at', { ascending: false });

        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }

        res.json(data || []);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ── GET /:id — Get recipe with rows + metrics ──
router.get('/:id', async (req, res) => {
    try {
        const { data: recipe, error: recipeError } = await supabase
            .from('recipes')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (recipeError || !recipe) {
            res.status(404).json({ error: 'Recipe not found' });
            return;
        }

        const { data: rows, error: rowsError } = await supabase
            .from('recipe_rows')
            .select('*')
            .eq('recipe_id', req.params.id);

        if (rowsError) {
            res.status(500).json({ error: rowsError.message });
            return;
        }

        res.json({ ...recipe, rows: rows || [] });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ── POST / — Create recipe ──
router.post('/', async (req, res) => {
    try {
        const { recipe_name, product_type, rows, metrics } = req.body;

        if (!recipe_name) {
            res.status(400).json({ error: 'Recipe name is required.' });
            return;
        }

        // 1. Insert recipe header
        const { data: newRecipe, error: createError } = await supabase
            .from('recipes')
            .insert({
                recipe_name,
                product_type: product_type || 'ice_cream',
                user_id: req.user!.id,
            })
            .select()
            .single();

        if (createError) {
            res.status(500).json({ error: createError.message });
            return;
        }

        const recipeId = newRecipe.id;

        // 2. Insert rows
        if (rows && Array.isArray(rows) && rows.length > 0) {
            const rowsToInsert = rows
                .filter((r: any) => r.ingredient && r.quantity_g > 0)
                .map((r: any) => ({
                    recipe_id: recipeId,
                    ingredient: r.ingredient,
                    quantity_g: r.quantity_g,
                    sugars_g: r.sugars_g || 0,
                    fat_g: r.fat_g || 0,
                    msnf_g: r.msnf_g || 0,
                    other_solids_g: r.other_solids_g || 0,
                    total_solids_g: r.total_solids_g || 0,
                }));

            const { error: rowsError } = await supabase
                .from('recipe_rows')
                .insert(rowsToInsert);

            if (rowsError) {
                res.status(500).json({ error: rowsError.message });
                return;
            }
        }

        // 3. Insert metrics
        if (metrics) {
            await supabase.from('calculated_metrics').insert({
                recipe_id: recipeId,
                total_quantity_g: metrics.total_g || 0,
                total_solids_g: metrics.ts_g || 0,
                total_solids_pct: metrics.ts_pct || 0,
                sugars_pct: metrics.totalSugars_pct || 0,
                fat_pct: metrics.fat_pct || 0,
                msnf_pct: metrics.msnf_pct || 0,
                other_solids_pct: metrics.other_pct || 0,
                total_sugars_g: metrics.totalSugars_g || 0,
                total_fat_g: metrics.fat_g || 0,
                total_msnf_g: metrics.msnf_g || 0,
                total_other_solids_g: metrics.other_g || 0,
                fpdt: metrics.fpdt || 0,
                sp: metrics.se_g || 0,
                pac: metrics.fpdse || 0,
                pod_index: metrics.pod_index || 0,
            });
        }

        res.status(201).json({ id: recipeId, ...newRecipe });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ── PUT /:id — Update recipe ──
router.put('/:id', async (req, res) => {
    try {
        const recipeId = req.params.id;
        const { recipe_name, product_type, rows, metrics } = req.body;

        // 1. Update header
        const updates: Record<string, any> = {
            updated_at: new Date().toISOString(),
        };
        if (recipe_name) updates.recipe_name = recipe_name;
        if (product_type) updates.product_type = product_type;

        const { error: updateError } = await supabase
            .from('recipes')
            .update(updates)
            .eq('id', recipeId);

        if (updateError) {
            res.status(500).json({ error: updateError.message });
            return;
        }

        // 2. Replace rows
        if (rows && Array.isArray(rows)) {
            await supabase.from('recipe_rows').delete().eq('recipe_id', recipeId);

            if (rows.length > 0) {
                const rowsToInsert = rows
                    .filter((r: any) => r.ingredient && r.quantity_g > 0)
                    .map((r: any) => ({
                        recipe_id: recipeId,
                        ingredient: r.ingredient,
                        quantity_g: r.quantity_g,
                        sugars_g: r.sugars_g || 0,
                        fat_g: r.fat_g || 0,
                        msnf_g: r.msnf_g || 0,
                        other_solids_g: r.other_solids_g || 0,
                        total_solids_g: r.total_solids_g || 0,
                    }));

                await supabase.from('recipe_rows').insert(rowsToInsert);
            }
        }

        // 3. Replace metrics
        if (metrics) {
            await supabase.from('calculated_metrics').delete().eq('recipe_id', recipeId);
            await supabase.from('calculated_metrics').insert({
                recipe_id: recipeId,
                total_quantity_g: metrics.total_g || 0,
                total_solids_g: metrics.ts_g || 0,
                total_solids_pct: metrics.ts_pct || 0,
                sugars_pct: metrics.totalSugars_pct || 0,
                fat_pct: metrics.fat_pct || 0,
                msnf_pct: metrics.msnf_pct || 0,
                other_solids_pct: metrics.other_pct || 0,
                total_sugars_g: metrics.totalSugars_g || 0,
                total_fat_g: metrics.fat_g || 0,
                total_msnf_g: metrics.msnf_g || 0,
                total_other_solids_g: metrics.other_g || 0,
                fpdt: metrics.fpdt || 0,
                sp: metrics.se_g || 0,
                pac: metrics.fpdse || 0,
                pod_index: metrics.pod_index || 0,
            });
        }

        res.json({ success: true, id: recipeId });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ── DELETE /:id ──
router.delete('/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('recipes')
            .delete()
            .eq('id', req.params.id);

        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }

        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export { router as recipesRouter };
