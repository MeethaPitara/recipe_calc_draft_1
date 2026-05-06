import { Router } from 'express';
import { calcMetricsV2 } from '../lib/core/calc.v2.js';
import { recommendTemps, estimateFrozenWater, recommendServeTemp, getScoopableRange, calculateIdealServeTemp, getTemperatureGuidance } from '../lib/core/scoopability.js';

const router = Router();

router.post('/metrics', async (req, res) => {
    try {
        const { recipeRows, opts } = req.body;
        if (!recipeRows) {
            return res.status(400).json({ error: 'Missing recipeRows' });
        }

        // Transform incoming rows to the expected format
        const rows = recipeRows.map((r: any) => ({
            ing: {
                ...r,
                // Ensure default values and handle singular/plural variations
                fat_pct: r.fat_pct ?? r.fat ?? 0,
                msnf_pct: r.msnf_pct ?? r.msnf ?? 0,
                sugars_pct: r.sugars_pct ?? r.sugar_pct ?? r.sugar ?? 0,
                water_pct: r.water_pct ?? r.water ?? 0,
                other_solids_pct: r.other_solids_pct ?? r.other_solids ?? 0,
                hardening_factor: r.hardening_factor ?? 1.0,
            },
            grams: r.quantity_g || 0,
        }));

        const metrics = calcMetricsV2(rows, opts);
        res.json({ success: true, metrics });
    } catch (e: any) {
        console.error('Calculation Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// ── Scoopability & Temperature endpoints ──

router.post('/scoopability', (req, res) => {
    try {
        const { metrics, context, tempC } = req.body;
        if (!metrics) {
            return res.status(400).json({ error: 'Missing metrics' });
        }

        const result: any = {};

        // Always include full recommendation
        result.recommendation = recommendTemps(metrics, context || 'home_freezer');
        result.temperatureGuidance = getTemperatureGuidance(metrics);
        result.idealServeTemp = calculateIdealServeTemp(metrics);
        result.scoopRange = getScoopableRange(metrics, context || 'home_freezer');
        result.serveTemp = recommendServeTemp(metrics, context || 'home_freezer');

        // If a specific temperature is requested, calculate frozen water at that temp
        if (tempC !== undefined) {
            result.frozenWaterAtTemp = estimateFrozenWater(metrics, tempC);
        }

        // Generate freezing curve data (from -5 to -22 in 0.5° steps)
        const freezingCurve: { tempC: number; frozenPct: number }[] = [];
        for (let t = -5; t >= -22; t -= 0.5) {
            freezingCurve.push({
                tempC: t,
                frozenPct: estimateFrozenWater(metrics, t),
            });
        }
        result.freezingCurve = freezingCurve;

        res.json({ success: true, ...result });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/machine-advice', (req, res) => {
    try {
        const { metrics, machineType } = req.body;
        if (!metrics || !machineType) {
            return res.status(400).json({ error: 'Missing metrics or machineType' });
        }

        // Import machine advice functions dynamically (they exist in backend core)
        // We'll use the same logic that was in frontend machineAdvice.ts
        const { MACHINES } = require('../../types/machine.js');
        const machine = MACHINES[machineType];
        if (!machine) {
            return res.status(400).json({ error: `Unknown machine type: ${machineType}` });
        }

        // Machine-specific advice generation
        const tips: string[] = [];
        tips.push(`Target overrun ${machine.overrunTarget_pct[0]}–${machine.overrunTarget_pct[1]}%`);
        tips.push(`Draw temp: ${machine.expectedDrawTempC[0]}°C to ${machine.expectedDrawTempC[1]}°C`);

        // Aging time based on fat content
        let agingTime = '4-6 hours';
        if (metrics.fat_pct > 15) { agingTime = '6-8 hours'; }
        else if (metrics.fat_pct < 8) { agingTime = '2-4 hours'; }

        // Draw temperature
        let drawTemp = `${machine.expectedDrawTempC[0]}°C to ${machine.expectedDrawTempC[1]}°C`;
        if (metrics.pac > 28) { drawTemp = `${machine.expectedDrawTempC[0] - 1}°C to ${machine.expectedDrawTempC[1]}°C`; }
        else if (metrics.pac < 23) { drawTemp = `${machine.expectedDrawTempC[0]}°C to ${machine.expectedDrawTempC[1] + 1}°C`; }

        const [minOverrun, maxOverrun] = machine.overrunTarget_pct;
        let targetOverrun = Math.round((minOverrun + maxOverrun) / 2);
        if (metrics.fat_pct > 15) { targetOverrun = Math.round(minOverrun + (maxOverrun - minOverrun) * 0.3); }
        else if (metrics.fat_pct < 8) { targetOverrun = Math.round(minOverrun + (maxOverrun - minOverrun) * 0.7); }

        const warnings: string[] = [];
        const recommendations: string[] = [];

        res.json({
            success: true,
            settings: { agingTime, drawTemp, overrunTarget: `${targetOverrun}%`, notes: tips },
            validation: { valid: warnings.length === 0, warnings, recommendations }
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export { router as calcRouter };

