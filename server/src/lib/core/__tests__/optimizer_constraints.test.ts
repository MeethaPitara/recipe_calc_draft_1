/**
 * optimizer_constraints.test.ts
 *
 * WHY THESE TESTS EXIST — WHAT FAILED IN THE OLD SYSTEM
 * ──────────────────────────────────────────────────────
 * The old system had two root problems that made 3.5 impossible:
 *
 * PROBLEM A — types/constraints.ts did not exist.
 *   optimizeRecipe() imported ConstraintProfile from it, so the module
 *   could not compile. Any constraint-aware call would throw at import time.
 *
 * PROBLEM B — routes/optimize.ts::requestToRows() ignored custom bounds:
 *     min: isLocked ? item.grams : 0          ← hardcoded, never reads caller's value
 *     max: isLocked ? item.grams : item.grams * 10   ← hardcoded
 *   And balancingEngine.balance() was called WITHOUT a ConstraintProfile, so
 *   even if the LP core was correct, the constraints never reached the solver.
 *
 * EACH TEST BELOW documents which specific gap it exercises.
 *
 * HOW TO RUN
 * ──────────
 * Add vitest to server/package.json devDependencies, create server/vitest.config.ts:
 *   import { defineConfig } from 'vitest/config';
 *   export default defineConfig({ test: { globals: true, environment: 'node' } });
 * Then: cd server && npx vitest run
 */

import { expect, test, describe } from 'vitest';
import { optimizeRecipe, Row } from '../optimize';
import { ConstraintProfile } from '../../../types/constraints';
import { IngredientData } from '../../../types/ingredients';

const mockIngredients: IngredientData[] = [
    { id: '1', name: 'Milk',     fat_pct: 3.5, msnf_pct: 8.5,  sugars_pct: 4.8, category: 'dairy',  water_pct: 83.2, cost_per_kg: 1.5 },
    { id: '2', name: 'Cream',    fat_pct: 35,  msnf_pct: 5.8,  sugars_pct: 3.1, category: 'dairy',  water_pct: 56.1, cost_per_kg: 5.0 },
    { id: '3', name: 'SMP',      fat_pct: 1,   msnf_pct: 95,   sugars_pct: 50,  category: 'dairy',  water_pct: 4,    cost_per_kg: 4.0 },
    { id: '4', name: 'Sucrose',  fat_pct: 0,   msnf_pct: 0,    sugars_pct: 100, category: 'sugar',  water_pct: 0,    cost_per_kg: 1.0 },
    { id: '5', name: 'Dextrose', fat_pct: 0,   msnf_pct: 0,    sugars_pct: 100, category: 'sugar',  water_pct: 0,    cost_per_kg: 1.2 },
    { id: '6', name: 'Water',    fat_pct: 0,   msnf_pct: 0,    sugars_pct: 0,   category: 'other',  water_pct: 100,  cost_per_kg: 0.1 },
    { id: '7', name: 'Stabilizer', fat_pct: 0, msnf_pct: 0,    sugars_pct: 0,   category: 'stabilizer', water_pct: 5, cost_per_kg: 9.0 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Standard 1kg gelato base with two sugars and a locked stabilizer */
function baseRows(): Row[] {
    return [
        { ing: mockIngredients[0], grams: 560 }, // Milk
        { ing: mockIngredients[1], grams: 190 }, // Cream
        { ing: mockIngredients[3], grams: 130 }, // Sucrose
        { ing: mockIngredients[4], grams: 70  }, // Dextrose
        { ing: mockIngredients[2], grams: 45  }, // SMP
        { ing: mockIngredients[6], grams: 5   }, // Stabilizer
    ];
}

// ─── 3.5.A — Per-ingredient bounds ───────────────────────────────────────────

describe('Optimizer Constraints (3.5)', () => {

    // ── Previously working tests (kept for regression) ──

    test('maintains fixed batch mass', () => {
        const rows: Row[] = [
            { ing: mockIngredients[0], grams: 600 },
            { ing: mockIngredients[1], grams: 200 },
            { ing: mockIngredients[4], grams: 150 },
            { ing: mockIngredients[5], grams: 50  }
        ];
        const constraints: ConstraintProfile = { fixedBatchMassG: 1000 };
        const result = optimizeRecipe(rows, { fat_pct: 8, msnf_pct: 10 }, constraints);
        expect(result.success).toBe(true);
        const total = result.rows.reduce((s, r) => s + r.grams, 0);
        expect(total).toBeCloseTo(1000, 1);
    });

    test('respects max cost constraint — COST_CEILING_TOO_LOW when impossible', () => {
        const rows: Row[] = [
            { ing: mockIngredients[0], grams: 500 },
            { ing: mockIngredients[1], grams: 300 },
            { ing: mockIngredients[3], grams: 200 }
        ];
        const constraints: ConstraintProfile = { maxCostPerKgMix: 0.5 }; // ₹0.5/kg — impossible
        const result = optimizeRecipe(rows, { fat_pct: 10 }, constraints);
        expect(result.success).toBe(false);
        expect(result.failureReason).toBe('COST_CEILING_TOO_LOW');
    });

    test('enforces sugar ratios — dextrose stays at 30% of sugar pair', () => {
        const rows: Row[] = [
            { ing: mockIngredients[0], grams: 600 },
            { ing: mockIngredients[1], grams: 200 },
            { ing: mockIngredients[3], grams: 100 },
            { ing: mockIngredients[4], grams: 100 }
        ];
        const constraints: ConstraintProfile = {
            sugarRatios: [{ primarySugarId: '4', secondarySugarId: '5', ratio: 30 }]
        };
        const result = optimizeRecipe(rows, { totalSugars_pct: 15 }, constraints);
        expect(result.success).toBe(true);
        const sucroseG  = result.rows.find(r => r.ing.id === '4')?.grams ?? 0;
        const dextroseG = result.rows.find(r => r.ing.id === '5')?.grams ?? 0;
        expect(dextroseG / (sucroseG + dextroseG)).toBeCloseTo(0.30, 2);
    });

    // ── NEW: per-ingredient max_g ─────────────────────────────────────────────

    test('max_g bound: cream does NOT exceed 80g even when solver wants more fat', () => {
        /**
         * OLD SYSTEM FAILURE:
         * requestToRows() set max = grams * 10 for all free ingredients (cream
         * started at 190g → max 1900g). The custom max was never read or passed
         * to the LP. Cream could legally reach hundreds of grams.
         *
         * NEW BEHAVIOUR:
         * ConstraintProfile.bounds[].maxGrams is wired to the LP upper bound.
         * Cream cannot exceed 80g regardless of the fat target.
         */
        const rows = baseRows();
        const constraints: ConstraintProfile = {
            bounds: [{ ingredientId: '2', isLocked: false, maxGrams: 80 }]
        };
        const result = optimizeRecipe(rows, { fat_pct: 12.0 }, constraints);

        const creamRow = result.rows.find(r => r.ing.id === '2');
        expect(creamRow).toBeDefined();
        // Allow 1g rounding slack
        expect(creamRow!.grams).toBeLessThanOrEqual(81);
    });

    test('max_g bound: solver is still free to reduce cream below the cap', () => {
        const rows = baseRows();
        const constraints: ConstraintProfile = {
            bounds: [{ ingredientId: '2', isLocked: false, maxGrams: 300 }] // generous cap
        };
        const result = optimizeRecipe(rows, { fat_pct: 4.0 }, constraints); // very low fat
        // Must succeed — the cap is not the binding constraint
        expect(result.success).toBe(true);
        const creamRow = result.rows.find(r => r.ing.id === '2');
        expect(creamRow!.grams).toBeLessThanOrEqual(301);
    });

    // ── NEW: per-ingredient min_g ─────────────────────────────────────────────

    test('min_g bound: milk does NOT drop below 450g even when solver wants less', () => {
        /**
         * OLD SYSTEM FAILURE:
         * min was always 0 for free ingredients. To reduce fat, the solver could
         * zero out milk entirely. The min_g constraint had no effect.
         *
         * NEW BEHAVIOUR:
         * Milk must always contribute ≥ 450g regardless of optimisation direction.
         */
        const rows = baseRows();
        const constraints: ConstraintProfile = {
            bounds: [{ ingredientId: '1', isLocked: false, minGrams: 450 }]
        };
        const result = optimizeRecipe(rows, { fat_pct: 5.0 }, constraints); // wants less fat → wants less milk

        const milkRow = result.rows.find(r => r.ing.id === '1');
        expect(milkRow).toBeDefined();
        expect(milkRow!.grams).toBeGreaterThanOrEqual(449);
    });

    // ── NEW: isLocked via ConstraintProfile (not just lockedIngredientIds) ────

    test('isLocked via ConstraintProfile: stabilizer grams unchanged after optimisation', () => {
        /**
         * OLD SYSTEM FAILURE:
         * "Locked" was only read from the route's lockedIngredientIds list.
         * If you sent isLocked=true inside the ConstraintProfile, the route
         * ignored it — the LP received no lock signal and could freely move
         * the stabilizer.
         *
         * NEW BEHAVIOUR:
         * ConstraintProfile.bounds[].isLocked = true forces min = max = initial.
         */
        const rows = baseRows(); // stabilizer at 5g (id '7')
        const constraints: ConstraintProfile = {
            bounds: [{ ingredientId: '7', isLocked: true }]
        };
        const result = optimizeRecipe(rows, { fat_pct: 9.0 }, constraints);

        if (result.success) {
            const stabRow = result.rows.find(r => r.ing.id === '7');
            expect(stabRow).toBeDefined();
            expect(stabRow!.grams).toBeCloseTo(5, 1); // original 5g, unchanged
        }
    });

    // ── NEW: fixed batch size — exact match ───────────────────────────────────

    test('fixedBatchMassG=5000: total mass hits exactly 5kg when scaling up', () => {
        /**
         * OLD SYSTEM FAILURE:
         * Without fixedBatchMassG, the LP used ±5% tolerance. A 1kg recipe
         * optimised with a 5kg target could legally return 4750g or 5250g.
         *
         * NEW BEHAVIOUR:
         * When fixedBatchMassG is set, total_weight uses { equal: 5000 }.
         */
        const rows = baseRows(); // 1000g total
        const constraints: ConstraintProfile = { fixedBatchMassG: 5000 };
        const result = optimizeRecipe(rows, { fat_pct: 8.0 }, constraints);

        expect(result.success).toBe(true);
        const total = result.rows.reduce((s, r) => s + r.grams, 0);
        expect(total).toBeCloseTo(5000, 0); // within 1g
    });

    // ── NEW: structured failure reasons ──────────────────────────────────────

    test('INGREDIENT_BOUNDS_TOO_TIGHT: forcing min cream 500g while targeting 3% fat', () => {
        /**
         * OLD SYSTEM FAILURE:
         * All failures returned a plain message string. The UI could not tell
         * the user WHY — "try unlocking more ingredients or adjusting targets"
         * was the only guidance, regardless of the actual cause.
         *
         * NEW BEHAVIOUR:
         * The LP probes relaxed models to identify the bottleneck. Forcing
         * min 500g of 35%-fat cream while targeting 3% fat → bounds too tight.
         */
        const rows = baseRows();
        const constraints: ConstraintProfile = {
            bounds: [{ ingredientId: '2', isLocked: false, minGrams: 500 }]
        };
        const result = optimizeRecipe(rows, { fat_pct: 3.0 }, constraints); // physically impossible

        expect(result.success).toBe(false);
        expect(result.failureReason).toBe('INGREDIENT_BOUNDS_TOO_TIGHT');
    });

    test('every infeasible result has a non-empty string failureReason', () => {
        /**
         * OLD SYSTEM FAILURE:
         * result.failureReason did not exist. result.message was an ad-hoc string.
         * The field name was inconsistent across endpoints.
         *
         * NEW BEHAVIOUR:
         * OptimizeResult always includes failureReason when success=false.
         */
        const rows: Row[] = [
            { ing: mockIngredients[1], grams: 900, lock: true }, // 35% fat, locked
            { ing: mockIngredients[3], grams: 100, lock: true }, // sugar, locked
        ];
        // Both locked → cannot hit fat 2%
        const result = optimizeRecipe(rows, { fat_pct: 2.0 });

        expect(result.success).toBe(false);
        expect(typeof result.failureReason).toBe('string');
        expect((result.failureReason ?? '').length).toBeGreaterThan(0);
    });

    // ── NEW: combined constraints do not over-constrain solvable recipes ──────

    test('all constraints together still solve a realistic gelato recipe', () => {
        /**
         * This is a regression guard: applying multiple constraints at once on a
         * reasonable recipe must not cause spurious INFEASIBLE results.
         */
        const rows = baseRows();
        const constraints: ConstraintProfile = {
            fixedBatchMassG: 1000,
            maxCostPerKgMix: 50, // ₹50/kg — achievable with mostly milk
            bounds: [
                { ingredientId: '7', isLocked: true },           // stabilizer locked at 5g
                { ingredientId: '2', minGrams: 100, maxGrams: 350 }, // cream between 100–350g
            ],
            sugarRatios: [
                { primarySugarId: '4', secondarySugarId: '5', ratio: 70 }, // sucrose 70%
            ],
        };

        const result = optimizeRecipe(rows, { fat_pct: 8.5, totalSugars_pct: 19.0 }, constraints);
        expect(result.success).toBe(true);

        // Batch size
        const total = result.rows.reduce((s, r) => s + r.grams, 0);
        expect(total).toBeCloseTo(1000, 0);

        // Locked stabilizer
        const stab = result.rows.find(r => r.ing.id === '7')!;
        expect(stab.grams).toBeCloseTo(5, 1);

        // Cream bounds
        const cream = result.rows.find(r => r.ing.id === '2')!;
        expect(cream.grams).toBeGreaterThanOrEqual(99);
        expect(cream.grams).toBeLessThanOrEqual(351);

        // Sugar ratio
        const sucroseG  = result.rows.find(r => r.ing.id === '4')!.grams;
        const dextroseG = result.rows.find(r => r.ing.id === '5')!.grams;
        expect(sucroseG / (sucroseG + dextroseG)).toBeCloseTo(0.70, 1);
    });
});
