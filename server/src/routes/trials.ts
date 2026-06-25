import { Router } from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth as any);

// ── GET / — Get trials (optionally filtered by recipe_id) ──
router.get('/', async (req, res) => {
    try {
        const { recipe_id } = req.query;
        let query = supabase
            .from('trial_records')
            .select(`
                *,
                qa_records (*)
            `)
            .order('created_at', { ascending: false });

        if (recipe_id) {
            query = query.eq('recipe_id', recipe_id);
        }

        const { data: trials, error } = await query;

        if (error) throw error;
        res.json(trials || []);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ── POST / — Create a new trial and its QA records ──
router.post('/', async (req, res) => {
    try {
        const {
            recipe_id, trial_date, batch_size_g, outcome, notes, qa_metrics,
            actual_fat_pct, actual_msnf_pct, actual_sugars_pct, actual_ts_pct, actual_overrun_pct,
            draw_temp_c, serving_temp_c, hardness_score, melt_rate, sensory_notes,
        } = req.body;

        if (!recipe_id || !batch_size_g) {
            return res.status(400).json({ error: 'recipe_id and batch_size_g are required.' });
        }

        // PHASE 6.2: freeze the recipe (header + rows + metrics) as it is
        // right now into a version snapshot. The trial links to THIS, not
        // the live recipe — so a later recipe edit can't rewrite what this
        // trial actually tested.
        const [{ data: recipeHeader, error: recipeErr }, { data: recipeRows, error: rowsErr }, { data: recipeMetrics }] = await Promise.all([
            supabase.from('recipes').select('*').eq('id', recipe_id).single(),
            supabase.from('recipe_rows').select('*').eq('recipe_id', recipe_id),
            supabase.from('calculated_metrics').select('*').eq('recipe_id', recipe_id).single(),
        ]);

        if (recipeErr || !recipeHeader) {
            return res.status(404).json({ error: 'Recipe not found.' });
        }

        const { data: version, error: versionError } = await supabase
            .from('recipe_versions')
            .insert({
                recipe_id,
                snapshot: { recipe: recipeHeader, rows: recipeRows || [], metrics: recipeMetrics || null },
            })
            .select()
            .single();

        if (versionError) throw versionError;

        // Insert trial record
        const { data: trial, error: trialError } = await supabase
            .from('trial_records')
            .insert({
                recipe_id,
                recipe_version_id: version.id,
                user_id: req.user!.id,
                trial_date: trial_date || new Date().toISOString().split('T')[0],
                batch_size_g,
                outcome: outcome || 'pending',
                notes,
                actual_fat_pct, actual_msnf_pct, actual_sugars_pct, actual_ts_pct, actual_overrun_pct,
                draw_temp_c, serving_temp_c, hardness_score, melt_rate, sensory_notes,
            })
            .select()
            .single();

        if (trialError) throw trialError;

        // Insert QA records if provided
        if (qa_metrics && Array.isArray(qa_metrics) && qa_metrics.length > 0) {
            const recordsToInsert = qa_metrics.map((metric: any) => ({
                trial_id: trial.id,
                metric_name: metric.metric_name,
                target_value: metric.target_value,
                actual_value: metric.actual_value,
                pass_fail: metric.pass_fail,
                deviation_pct: metric.deviation_pct
            }));

            const { error: qaError } = await supabase
                .from('qa_records')
                .insert(recordsToInsert);

            if (qaError) {
                // Ideally this would be a transaction, but supabase client limits transactions to RPCs.
                // We'll just throw the error, though the trial header was created.
                throw qaError;
            }
        }

        res.status(201).json({ success: true, trial_id: trial.id, trial });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ── PATCH /:id — Update trial metadata ──
router.patch('/:id', async (req, res) => {
    try {
        const updates: Record<string, any> = {};
        const fields = [
            'outcome', 'notes',
            'actual_fat_pct', 'actual_msnf_pct', 'actual_sugars_pct', 'actual_ts_pct', 'actual_overrun_pct',
            'draw_temp_c', 'serving_temp_c', 'hardness_score', 'melt_rate', 'sensory_notes',
        ];
        for (const field of fields) {
            if (req.body[field] !== undefined) updates[field] = req.body[field];
        }

        const { data: trial, error } = await supabase
            .from('trial_records')
            .update(updates)
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;
        res.json({ success: true, trial });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export { router as trialsRouter };
