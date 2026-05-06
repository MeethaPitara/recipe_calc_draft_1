import { Router } from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth as any);

// Helper to generate typical routes for a specific table
const createPlanRoutes = (level: string, tableName: string) => {
    // GET /api/plans/:level?email=xxx
    router.get(`/${level}`, async (req, res) => {
        try {
            const email = req.query.email as string;
            if (!email) {
                res.status(400).json({ error: 'email query parameter is required' });
                return;
            }

            const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .eq('user_email', email)
                .order('created_at', { ascending: false });

            if (error) throw error;
            res.json(data || []);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    // POST /api/plans/:level
    router.post(`/${level}`, async (req, res) => {
        try {
            const { data, error } = await supabase
                .from(tableName)
                .insert([req.body])
                .select()
                .single();

            if (error) throw error;
            res.status(201).json(data);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    // DELETE /api/plans/:level/:id
    router.delete(`/${level}/:id`, async (req, res) => {
        try {
            const { error } = await supabase
                .from(tableName)
                .delete()
                .eq('id', req.params.id);

            if (error) throw error;
            res.json({ success: true });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });
};

createPlanRoutes('l1', 'production_plans_l1');
createPlanRoutes('l2', 'production_plans_l2');
createPlanRoutes('l3', 'production_plans_l3');

export { router as plansRouter };
