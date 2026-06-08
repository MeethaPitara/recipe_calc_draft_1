import express from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// GET /api/target-profiles
router.get('/', requireAuth, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('target_profiles')
            .select('*')
            .eq('user_id', req.user!.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json(data);
    } catch (e: any) {
        console.error('Fetch target profiles error:', e);
        res.status(500).json({ error: e.message });
    }
});

// POST /api/target-profiles
router.post('/', requireAuth, async (req, res) => {
    try {
        const { name, product_type, ranges, constraint_defaults } = req.body;

        if (!name || !product_type || !ranges) {
            return res.status(400).json({ error: 'Missing required fields (name, product_type, ranges)' });
        }

        const { data, error } = await supabase
            .from('target_profiles')
            .insert({
                user_id: req.user!.id,
                name,
                product_type,
                ranges,
                constraint_defaults: constraint_defaults || null
            })
            .select()
            .single();

        if (error) throw error;

        res.json(data);
    } catch (e: any) {
        console.error('Create target profile error:', e);
        res.status(500).json({ error: e.message });
    }
});

// DELETE /api/target-profiles/:id
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('target_profiles')
            .delete()
            .eq('id', id)
            .eq('user_id', req.user!.id); // Security check

        if (error) throw error;

        res.json({ success: true });
    } catch (e: any) {
        console.error('Delete target profile error:', e);
        res.status(500).json({ error: e.message });
    }
});

export { router as targetProfilesRouter };
