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

            // Auto-lock the recipe if a recipe snapshot was tied to this production plan
            if (req.body.original_recipe_id) {
                const { error: lockError } = await supabase
                    .from('recipes')
                    .update({ is_production_locked: true, updated_at: new Date().toISOString() })
                    .eq('id', req.body.original_recipe_id);
                
                if (lockError) {
                    console.error('Failed to lock recipe during plan creation:', lockError);
                    // Decide if we want to fail the whole plan creation. Usually it's better to just log and continue, 
                    // or we could throw. Let's log it, as the plan itself was successfully created.
                }
            }

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
