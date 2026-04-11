/**
 * Ingredients Routes
 * Migrated from src/services/ingredientService.ts
 *
 * GET    /api/ingredients         — List all
 * GET    /api/ingredients/search  — Search
 * GET    /api/ingredients/:id     — Get by ID
 * POST   /api/ingredients         — Create
 * PUT    /api/ingredients/:id     — Update
 * DELETE /api/ingredients/:id     — Delete
 */

import { Router } from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';

const router = Router();

// ── GET / — List all ingredients ──
router.get('/', optionalAuth as any, async (req, res) => {
    try {
        const userEmail = req.user?.email;

        let query = supabase
            .from('ingredients')
            .select('*')
            .order('name');

        // Show system ingredients + user's own
        if (userEmail) {
            query = query.or(`user_email.is.null,user_email.eq.${userEmail}`);
        }

        const { data, error } = await query;
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }

        // Transform DB rows → frontend IngredientData shape
        const ingredients = (data || []).map(transformRow);
        res.json(ingredients);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ── GET /search?q= ──
router.get('/search', optionalAuth as any, async (req, res) => {
    try {
        const q = String(req.query.q || '').trim();
        if (!q) {
            res.json([]);
            return;
        }

        const { data, error } = await supabase
            .from('ingredients')
            .select('*')
            .ilike('name', `%${q}%`)
            .order('name')
            .limit(20);

        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }

        res.json((data || []).map(transformRow));
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ── GET /:id ──
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('ingredients')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error || !data) {
            res.status(404).json({ error: 'Ingredient not found' });
            return;
        }

        res.json(transformRow(data));
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ── POST / — Create ──
router.post('/', requireAuth as any, async (req, res) => {
    try {
        const { name, category, fat_pct, msnf_pct, sugars_pct, water_pct, other_solids_pct, sp_coeff, pac_coeff, cost_per_kg, lactose_pct } = req.body;

        if (!name) {
            res.status(400).json({ error: 'Ingredient name is required.' });
            return;
        }

        const insertData: Record<string, any> = {
            name,
            category: category || 'other',
            fat_pct: fat_pct || 0,
            msnf_pct: msnf_pct || 0,
            sugars_pct: sugars_pct || 0,
            water_pct: water_pct || 0,
            other_solids_pct: other_solids_pct || 0,
            user_email: req.user!.email,
        };

        if (sp_coeff != null) insertData.sp_coeff = sp_coeff;
        if (pac_coeff != null) insertData.pac_coeff = pac_coeff;
        if (cost_per_kg != null) insertData.cost_per_kg = cost_per_kg;
        if (lactose_pct != null) insertData.lactose_pct = lactose_pct;

        const { data, error } = await supabase
            .from('ingredients')
            .insert(insertData)
            .select()
            .single();

        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }

        res.status(201).json(transformRow(data));
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ── PUT /:id — Update ──
router.put('/:id', requireAuth as any, async (req, res) => {
    try {
        const updates: Record<string, any> = {};
        const fields = ['name', 'category', 'fat_pct', 'msnf_pct', 'sugars_pct', 'water_pct', 'other_solids_pct', 'sp_coeff', 'pac_coeff', 'cost_per_kg', 'lactose_pct'];

        for (const field of fields) {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        }

        const { data, error } = await supabase
            .from('ingredients')
            .update(updates)
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }

        res.json(transformRow(data));
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ── DELETE /:id ──
router.delete('/:id', requireAuth as any, async (req, res) => {
    try {
        const { error } = await supabase
            .from('ingredients')
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

// ── Helper: transform DB row → frontend IngredientData shape ──
function transformRow(row: any) {
    const safeNum = (val: any, fallback = 0) => (typeof val === 'number' && !isNaN(val)) ? val : fallback;

    return {
        id: row.id,
        name: row.name,
        category: row.category || 'other',
        fat_pct: safeNum(row.fat_pct),
        msnf_pct: safeNum(row.msnf_pct),
        sugars_pct: safeNum(row.sugars_pct ?? row.sugar_pct),
        water_pct: safeNum(row.water_pct),
        other_solids_pct: safeNum(row.other_solids_pct),
        sp_coeff: row.sp_coeff ?? undefined,
        pac_coeff: row.pac_coeff ?? undefined,
        cost_per_kg: row.cost_per_kg ?? undefined,
        lactose_pct: row.lactose_pct ?? undefined,
        user_email: row.user_email ?? undefined,
    };
}

export { router as ingredientsRouter };
