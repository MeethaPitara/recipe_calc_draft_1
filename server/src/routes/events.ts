import { Router } from 'express';
import { supabase } from '../lib/supabaseClient.js';

const router = Router();

// Endpoint for logging analytics events
// No requireAuth for analytics to prevent blocking users from logging non-sensitive events
router.post('/', async (req, res) => {
    try {
        const { event, meta, user_id } = req.body;

        if (!event) {
            return res.status(400).json({ error: 'Event name is required' });
        }

        const { error } = await supabase.from('events').insert({
            event,
            meta: meta || null,
            user_id: user_id || null,
        });

        if (error) {
            console.error('Analytics DB Error:', error);
            // Return 202 even if DB fails to ensure frontend isn't impacted
            return res.status(202).json({ success: false, error: 'Failed to record event' });
        }

        res.status(201).json({ success: true });
    } catch (e: any) {
        console.error('Analytics Route Error:', e);
        res.status(500).json({ error: e.message });
    }
});

export { router as eventsRouter };
