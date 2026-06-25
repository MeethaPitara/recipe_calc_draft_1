import { Router } from 'express';
import { calcMetricsV2 } from '../lib/core/calc.v2.js';
import { recommendTemps, estimateFrozenWater, recommendServeTemp, getScoopableRange, calculateIdealServeTemp, getTemperatureGuidance } from '../lib/core/scoopability.js';
import { diagnose, DiagnosisMetrics } from '../lib/core/recipeDiagnosis.js';
import { PROFILES, ProductId } from '../lib/core/scienceConfig.js';
import { computeFreezingCurve } from '../lib/core/freezingCurve.js';

const router = Router();

/**
 * PHASE 7.2: the engine only knows a coarse mode (gelato/ice_cream/sorbet/
 * kulfi), but recipeDiagnosis.ts wants one of scienceConfig's 9 fine
 * ProductProfiles. Detect what's detectable from ingredient categories/
 * names (mirrors the hasChocolate/hasNutsOrEggs heuristics already used
 * inside calc.v2.ts, and the hasFruit check the frontend's productKey()
 * already does) — covers 7 of 9 profiles. gelato_white (no flavour yet)
 * and mithai_gelato (paste-specific) have no reliable signal yet and are
 * left for whenever the paste/flavour system can supply one.
 */
function resolveDiagnosisProfile(mode: string, rows: { ing: any }[]): ProductId {
    if (mode === 'sorbet') return 'sorbet';
    if (mode === 'kulfi') return 'kulfi_basundi';
    if (mode === 'ice_cream') return 'premium_ice_cream';

    const hasFruit = rows.some(r => r.ing.category === 'fruit');
    if (hasFruit) return 'fruit_gelato';

    const hasChocolate = rows.some(r => /chocolate|cocoa|cacao/i.test(r.ing.name || ''));
    if (hasChocolate) return 'chocolate_gelato';

    const hasNuts = rows.some(r => /nut|almond|pistachio|hazelnut/i.test(r.ing.name || ''));
    if (hasNuts) return 'nut_gelato';

    return 'dairy_gelato';
}

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

        // PHASE 7.2: advisory diagnosis — never auto-applied (7.4), the UI
        // only renders problem/why/fix and lets the user apply it manually.
        const mode = opts?.mode || 'gelato';
        const profileId = resolveDiagnosisProfile(mode, rows);
        const profile = PROFILES[profileId];
        const diagnosisMetrics: DiagnosisMetrics = {
            total_g: metrics.total_g,
            water_g: metrics.water_g,
            se_g: metrics.se_g,
            fat_pct: metrics.fat_pct,
            msnf_pct: metrics.msnf_pct,
            nonLactoseSugars_pct: metrics.nonLactoseSugars_pct,
            totalSugarsTotal_pct: metrics.totalSugarsTotal_pct,
            ts_pct: metrics.ts_pct,
            fpdt: metrics.fpdt,
            sp_pct: metrics.sp_pct,
            afp_index: metrics.afp_index,
            lactose_pct: metrics.lactose_pct,
            protein_pct: metrics.protein_pct,
            // PHASE 7.5: approximate until Phase 8's freezingCurve.ts lands —
            // serving.v1.ts's recommendation, not the Leighton-based curve.
            servingTempC: metrics.servingTemp?.serveTempC,
        };
        const diagnosis = diagnose(diagnosisMetrics, profile);

        // PHASE 7.3: ship the resolved profile's bands too, so the frontend
        // never needs its own copy of scienceConfig numbers to label targets.
        const profileBands = {
            fat: profile.fat, msnf: profile.msnf, totalSugar: profile.totalSugar,
            totalSolids: profile.totalSolids, sp: profile.sp, afp: profile.afp, fpdt: profile.fpdt,
            lactoseRiskMaxPct: profile.lactoseRiskMaxPct, proteinRiskMaxPct: profile.proteinRiskMaxPct,
            servingTempC: profile.servingTempC,
        };

        // PHASE 8.2: the freezing-curve-derived serving temperature — this
        // is the physically-grounded figure (reuses leightonTable.json,
        // same data calc.v2.ts's FPDT already trusts), distinct from the
        // older heuristic estimates in serving.v1.ts/scoopability.ts. Not a
        // replacement for those yet (see handoff — three serving-temp
        // computations currently coexist); this is the one Phase 8 asks
        // for and the one diagnosis-grade accuracy should come from.
        const freezingCurve = computeFreezingCurve({
            se_g: metrics.se_g,
            water_g: metrics.water_g,
            targetFrozenFraction: profile.targetFrozenFraction,
        });

        res.json({
            success: true,
            metrics,
            diagnosis,
            productProfile: profileId,
            profileBands,
            servingTempApprox: true,
            servingTempC: freezingCurve.servingTempC,
            servingTempExtrapolated: freezingCurve.servingTempExtrapolated,
            freezingCurve: freezingCurve.curve,
        });
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

        // PHASE 7.5: leightonTable.json extrapolates past its real data
        // range (Phase 8's freezingCurve.ts will fix this with a proper
        // servingTempExtrapolated flag) — flag every serve-temp figure as
        // approximate now so users aren't misled in the meantime.
        res.json({ success: true, ...result, approx: true });
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

