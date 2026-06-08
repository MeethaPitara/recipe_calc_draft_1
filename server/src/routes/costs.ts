import { Router } from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth as any);

// ── POST / — Log a cost record ──
router.post('/', async (req, res) => {
    try {
        const { recipe_id, cost_per_kg, batch_size_g } = req.body;

        if (!recipe_id || cost_per_kg === undefined) {
            res.status(400).json({ error: 'recipe_id and cost_per_kg are required.' });
            return;
        }

        const { data: record, error } = await supabase
            .from('cost_records')
            .insert({
                recipe_id,
                user_id: req.user!.id,
                cost_per_kg,
                batch_size_g: batch_size_g || null
            })
            .select()
            .single();

        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }

        res.status(201).json(record);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ── GET / — Get cost history for a recipe ──
router.get('/', async (req, res) => {
    try {
        const { recipe_id } = req.query;
        if (!recipe_id) {
            res.status(400).json({ error: 'recipe_id is required' });
            return;
        }

        const { data: records, error } = await supabase
            .from('cost_records')
            .select('*')
            .eq('recipe_id', recipe_id as string)
            .eq('user_id', req.user!.id)
            .order('recorded_at', { ascending: false });

        if (error) throw error;
        res.json(records || []);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export { router as costsRouter };
