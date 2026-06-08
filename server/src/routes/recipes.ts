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

// ── GET /stats — Get recipe statistics ──
router.get('/stats', async (req, res) => {
    try {
        const [recipesRes, outcomesRes] = await Promise.all([
            supabase.from('recipes').select('id', { count: 'exact', head: true }),
            supabase.from('recipe_outcomes').select('id,outcome', { count: 'exact' })
        ]);

        const { data: outcomes } = await supabase.from('recipe_outcomes').select('outcome');
        const successfulOutcomes = outcomes?.filter(o => o.outcome === 'success').length || 0;

        res.json({
            totalRecipes: recipesRes.count || 0,
            totalOutcomes: outcomesRes.count || 0,
            successfulOutcomes,
            mlReady: successfulOutcomes >= 5
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ── GET /recent — Get recent recipes with manual enrichment ──
router.get('/recent', async (req, res) => {
    try {
        const { data: recipes, error: recipesError } = await supabase
            .from('recipes')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);

        if (recipesError) throw recipesError;
        if (!recipes || recipes.length === 0) return res.json([]);

        const recipeIds = recipes.map(r => r.id);

        const [rowsRes, metricsRes] = await Promise.all([
            supabase.from('recipe_rows').select('*').in('recipe_id', recipeIds),
            supabase.from('calculated_metrics').select('*').in('recipe_id', recipeIds)
        ]);

        const enriched = recipes.map(recipe => ({
            ...recipe,
            recipe_rows: rowsRes.data?.filter(row => row.recipe_id === recipe.id) || [],
            calculated_metrics: metricsRes.data?.find(m => m.recipe_id === recipe.id) || null
        }));

        res.json(enriched);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ── GET /export — Get all recipes with rows for CSV ──
router.get('/export', async (req, res) => {
    try {
        const { data: recipes, error } = await supabase
            .from('recipes')
            .select(`
              recipe_name,
              recipe_rows (
                ingredient, quantity_g, water_g, sugars_g, fat_g, msnf_g, other_solids_g, total_solids_g, lactose_g
              )
            `);

        if (error) throw error;
        res.json(recipes || []);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ── GET / — List user's recipes with manual enrichment ──
router.get('/', async (req, res) => {
    try {
        const { data: recipes, error: recipesError } = await supabase
            .from('recipes')
            .select('*')
            .eq('user_id', req.user!.id)
            .order('updated_at', { ascending: false })
            .limit(50);

        if (recipesError) throw recipesError;
        if (!recipes || recipes.length === 0) return res.json([]);

        const recipeIds = recipes.map(r => r.id);

        const [rowsRes, metricsRes] = await Promise.all([
            supabase.from('recipe_rows').select('*').in('recipe_id', recipeIds),
            supabase.from('calculated_metrics').select('*').in('recipe_id', recipeIds)
        ]);

        const enriched = recipes.map(recipe => ({
            ...recipe,
            recipe_rows: rowsRes.data?.filter(row => row.recipe_id === recipe.id) || [],
            calculated_metrics: metricsRes.data?.find(m => m.recipe_id === recipe.id) || null
        }));

        res.json(enriched);
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

        const { data: metrics, error: metricsError } = await supabase
            .from('calculated_metrics')
            .select('*')
            .eq('recipe_id', req.params.id)
            .single();

        res.json({
            ...recipe,
            rows: rows || [],
            metrics: metrics || null
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ── POST / — Create recipe ──
router.post('/', async (req, res) => {
    try {
        const { recipe_name, product_type, rows, metrics, tags } = req.body;

        if (!recipe_name) {
            res.status(400).json({ error: 'Recipe name is required.' });
            return;
        }

        let cost_per_kg = 0;
        let totalWeight = 0;
        let totalCost = 0;

        if (rows && Array.isArray(rows) && rows.length > 0) {
            const ingredientNames = rows.map((r: any) => r.ingredient);
            const { data: ingredientsData } = await supabase.from('ingredients').select('name, cost_per_kg').in('name', ingredientNames);
            
            if (ingredientsData) {
                const costMap = Object.fromEntries(ingredientsData.map((i: any) => [i.name, i.cost_per_kg || 0]));
                for (const r of rows) {
                    if (r.quantity_g > 0) {
                        totalWeight += r.quantity_g;
                        totalCost += (r.quantity_g / 1000) * (costMap[r.ingredient] || 0);
                    }
                }
            }
            if (totalWeight > 0) {
                cost_per_kg = totalCost / (totalWeight / 1000);
            }
        }

        // 1. Insert recipe header
        const { data: newRecipe, error: createError } = await supabase
            .from('recipes')
            .insert({
                recipe_name,
                product_type: product_type || 'ice_cream',
                user_id: req.user!.id,
                tags: tags || [],
                is_production_locked: false,
                version_number: 1,
                cost_per_kg: cost_per_kg > 0 ? cost_per_kg : null
            })
            .select()
            .single();

        if (createError) {
            res.status(500).json({ error: createError.message });
            return;
        }

        const recipeId = newRecipe.id;

        // Insert cost record
        if (cost_per_kg > 0) {
            await supabase.from('cost_records').insert({
                recipe_id: recipeId,
                user_id: req.user!.id,
                cost_per_kg: cost_per_kg,
                batch_size_g: totalWeight
            });
        }

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

        // 4. Insert ML training outcome if requested
        if (req.body.train) {
            await supabase.from('recipe_outcomes').insert({
                recipe_id: recipeId,
                user_id: req.user!.id,
                outcome: 'success',
                notes: 'Imported from CSV/System'
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
        const { recipe_name, product_type, rows, metrics, tags } = req.body;

        // check if locked
        const { data: existingRecipe } = await supabase.from('recipes').select('is_production_locked').eq('id', recipeId).single();
        if (existingRecipe?.is_production_locked) {
            res.status(403).json({ error: 'Recipe is production locked and cannot be modified. Please clone it to make edits.' });
            return;
        }

        let cost_per_kg = 0;
        let totalWeight = 0;
        let totalCost = 0;

        if (rows && Array.isArray(rows) && rows.length > 0) {
            const ingredientNames = rows.map((r: any) => r.ingredient);
            const { data: ingredientsData } = await supabase.from('ingredients').select('name, cost_per_kg').in('name', ingredientNames);
            
            if (ingredientsData) {
                const costMap = Object.fromEntries(ingredientsData.map((i: any) => [i.name, i.cost_per_kg || 0]));
                for (const r of rows) {
                    if (r.quantity_g > 0) {
                        totalWeight += r.quantity_g;
                        totalCost += (r.quantity_g / 1000) * (costMap[r.ingredient] || 0);
                    }
                }
            }
            if (totalWeight > 0) {
                cost_per_kg = totalCost / (totalWeight / 1000);
            }
        }

        // 1. Update header
        const updates: Record<string, any> = {
            updated_at: new Date().toISOString(),
        };
        if (recipe_name) updates.recipe_name = recipe_name;
        if (product_type) updates.product_type = product_type;
        if (tags) updates.tags = tags;
        if (cost_per_kg > 0) updates.cost_per_kg = cost_per_kg;

        const { error: updateError } = await supabase
            .from('recipes')
            .update(updates)
            .eq('id', recipeId);

        if (updateError) {
            res.status(500).json({ error: updateError.message });
            return;
        }

        // Insert cost record
        if (cost_per_kg > 0) {
            await supabase.from('cost_records').insert({
                recipe_id: recipeId,
                user_id: req.user!.id,
                cost_per_kg: cost_per_kg,
                batch_size_g: totalWeight
            });
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

// ── POST /:id/outcome — Mark recipe as successful for ML ──
router.post('/:id/outcome', async (req, res) => {
    try {
        const { error } = await supabase.from('recipe_outcomes').insert({
            recipe_id: req.params.id,
            user_id: req.user!.id,
            outcome: req.body.outcome || 'success',
            notes: req.body.notes || 'Marked from UI'
        });

        if (error) throw error;
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ── PATCH /:id/lock — Lock recipe for production ──
router.patch('/:id/lock', async (req, res) => {
    try {
        const { error } = await supabase
            .from('recipes')
            .update({ is_production_locked: true, updated_at: new Date().toISOString() })
            .eq('id', req.params.id);

        if (error) throw error;
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ── POST /:id/clone — Clone a recipe ──
router.post('/:id/clone', async (req, res) => {
    try {
        const recipeId = req.params.id;

        // 1. Fetch original recipe
        const { data: original, error: origError } = await supabase
            .from('recipes')
            .select('*')
            .eq('id', recipeId)
            .single();

        if (origError || !original) {
            res.status(404).json({ error: 'Recipe not found' });
            return;
        }

        // 2. Fetch original rows
        const { data: rows } = await supabase.from('recipe_rows').select('*').eq('recipe_id', recipeId);
        
        // 3. Fetch original metrics
        const { data: metrics } = await supabase.from('calculated_metrics').select('*').eq('recipe_id', recipeId).single();

        const newVersion = (original.version_number || 1) + 1;
        // Strip out existing (vX) pattern if present to avoid (v2) (v3) stacking
        const baseName = original.recipe_name.replace(/\s*\(v\d+\)$/, '');
        const newName = `${baseName} (v${newVersion})`;

        // 4. Create new recipe
        const { data: newRecipe, error: createError } = await supabase
            .from('recipes')
            .insert({
                recipe_name: newName,
                product_type: original.product_type,
                user_id: req.user!.id,
                tags: original.tags || [],
                is_production_locked: false,
                version_number: newVersion
            })
            .select()
            .single();

        if (createError) throw createError;
        const newId = newRecipe.id;

        // 5. Clone rows
        if (rows && rows.length > 0) {
            const newRows = rows.map((r: any) => ({
                ...r,
                id: undefined,
                recipe_id: newId
            }));
            await supabase.from('recipe_rows').insert(newRows);
        }

        // 6. Clone metrics
        if (metrics) {
            const newMetrics = { ...metrics, id: undefined, recipe_id: newId };
            await supabase.from('calculated_metrics').insert(newMetrics);
        }

        res.json({ success: true, id: newId, recipe: newRecipe });
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
