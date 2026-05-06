/**
 * ML Routes
 * Migrated from src/services/mlService.ts
 *
 * POST /api/ml/train   — Train model
 * GET  /api/ml/export  — Export training data
 */

import { Router } from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth as any);

// ── POST /train ──
router.post('/train', async (req, res) => {
    try {
        console.log('🧠 Starting ML training...');

        const { data: outcomes, error } = await supabase
            .from('recipe_outcomes')
            .select(`
                id,
                recipe_id,
                outcome,
                recipes!inner (
                    id,
                    recipe_name,
                    recipe_rows (
                        ingredient, quantity_g, sugars_g, fat_g, msnf_g,
                        other_solids_g, total_solids_g
                    ),
                    calculated_metrics (
                        total_quantity_g, total_sugars_g, total_fat_g, total_msnf_g,
                        total_solids_g, sugars_pct, fat_pct, msnf_pct,
                        total_solids_pct, sp, pac
                    )
                )
            `)
            .eq('outcome', 'success');

        if (error) throw error;

        if (!outcomes || outcomes.length < 5) {
            res.status(400).json({ error: `Need at least 5 successful recipes (have ${outcomes?.length || 0})` });
            return;
        }

        const features = outcomes.map((outcome: any) => {
            const metrics = outcome.recipes.calculated_metrics[0];
            const rows = outcome.recipes.recipe_rows;

            return {
                fat_pct: metrics?.fat_pct || 0,
                msnf_pct: metrics?.msnf_pct || 0,
                sugars_pct: metrics?.sugars_pct || 0,
                total_solids_pct: metrics?.total_solids_pct || 0,
                sp: metrics?.sp || 0,
                pac: metrics?.pac || 0,
                ingredient_count: rows?.length || 0,
                avg_quantity: rows?.length > 0
                    ? rows.reduce((sum: number, r: any) => sum + r.quantity_g, 0) / rows.length
                    : 0,
            };
        });

        const featureKeys = Object.keys(features[0]) as Array<keyof typeof features[0]>;
        const featureImportance: Record<string, number> = {};
        const thresholds: Record<string, { min: number; max: number }> = {};

        featureKeys.forEach(key => {
            const values = features.map(f => f[key]);
            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
            const stdDev = Math.sqrt(variance);

            featureImportance[key] = variance;
            thresholds[key] = {
                min: Math.max(0, mean - 2 * stdDev),
                max: mean + 2 * stdDev,
            };
        });

        const weights = {
            version: '2.0.0',
            trained_at: new Date().toISOString(),
            accuracy: outcomes.length / (outcomes.length + 1),
            feature_importance: featureImportance,
            success_thresholds: thresholds,
        };

        console.log('✅ Model training complete');

        // Refresh materialized view for better query performance
        try {
            await (supabase as any).rpc('refresh_ml_training_dataset');
        } catch (viewError) {
            console.log('Note: Could not refresh training dataset view:', viewError);
        }

        res.json(weights);
    } catch (e: any) {
        res.status(500).json({ error: e.message || 'Training failed' });
    }
});

// ── GET /export ──
router.get('/export', async (_req, res) => {
    try {
        const { data: recipes } = await supabase
            .from('recipes')
            .select(`
                id, recipe_name, product_type,
                recipe_rows ( ingredient, quantity_g, sugars_g, fat_g, msnf_g, other_solids_g, total_solids_g ),
                calculated_metrics ( total_quantity_g, sp, pac, fat_pct, sugars_pct )
            `)
            .order('created_at', { ascending: false });

        const result = (recipes || []).map((recipe: any) => ({
            id: recipe.id,
            name: recipe.recipe_name,
            product_type: recipe.product_type,
            rows: recipe.recipe_rows,
            metrics: recipe.calculated_metrics?.[0],
        }));

        res.json(result);
    } catch (e: any) {
        res.status(500).json({ error: e.message || 'Export failed' });
    }
});

router.get('/check-training', async (req, res) => {
    try {
        const { lastTrained } = req.query;
        if (!lastTrained) {
            return res.status(400).json({ error: 'Missing lastTrained date' });
        }

        const { count, error } = await supabase
            .from('recipe_outcomes')
            .select('*', { count: 'exact', head: true })
            .eq('outcome', 'success')
            .not('recipe_id', 'is', null)
            .gt('created_at', lastTrained as string);

        if (error) throw error;
        res.json({ count: count || 0 });
    } catch (e: any) {
        res.status(500).json({ error: e.message || 'Check failed' });
    }
});

export { router as mlRouter };
