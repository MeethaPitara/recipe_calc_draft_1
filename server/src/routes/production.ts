/**
 * Production Routes
 * Exposes Level 1/2/3 production engines and AI rounding as API endpoints.
 * 
 * POST /api/production/level1  — Quick plan (volume-based)
 * POST /api/production/level2  — Base planner (allocation-based)
 * POST /api/production/level3  — Exact plan (demand-based)
 * POST /api/production/validate — Validate a production recipe
 */

import { Router } from 'express';
import { calculateProductionRun } from '../lib/core/production/level1_engine.js';
import { calculateAllocations } from '../lib/core/production/level2_engine.js';
import { calculateDemandRun } from '../lib/core/production/level3_engine.js';

const router = Router();

// ── POST /api/production/level1 — Quick Plan ──
router.post('/level1', (req, res) => {
    try {
        const input = req.body;
        if (!input.recipe || !input.targetVolumeLiters) {
            return res.status(400).json({ error: 'Missing recipe or targetVolumeLiters' });
        }
        const result = calculateProductionRun(input);
        res.json({ success: true, result });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ── POST /api/production/level2 — Base Planner ──
router.post('/level2', (req, res) => {
    try {
        const input = req.body;
        if (!input.supply || !input.allocations) {
            return res.status(400).json({ error: 'Missing supply or allocations' });
        }
        const result = calculateAllocations(input);
        res.json({ success: true, result });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ── POST /api/production/level3 — Exact Plan ──
router.post('/level3', (req, res) => {
    try {
        const input = req.body;
        if (!input.recipeItems || !input.targetUnits) {
            return res.status(400).json({ error: 'Missing recipeItems or targetUnits' });
        }
        const result = calculateDemandRun(input);
        res.json({ success: true, result });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export { router as productionRouter };
