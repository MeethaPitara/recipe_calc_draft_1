/**
 * Unit tests for the AI pipeline's deterministic functions.
 * (AI/Gemini calls are NOT tested here — only pure math.)
 */

import { describe, it, expect } from 'vitest';
import { computeBatchSizing } from '../batchSizing';
import { computeRecipeMetrics } from '../recipeMetrics';
import { parseInstruction } from '../instructionParser';
import { runLpOptimizer } from '../lpOptimizer';
import { optimizerTool } from '../pipeline';
import type { RecipeItem, ProductionTargets } from '../types';

// ── Test data (from Cell 13 of the notebook) ──

const TEST_RECIPE: RecipeItem[] = [
    { ingredient: 'Toned Milk 3%', quantity_g: 507970.39 },
    { ingredient: 'Cream 25%', quantity_g: 142300.70 },
    { ingredient: 'Sucrose/sugar', quantity_g: 101766.56 },
    { ingredient: 'Dextrose monohydrate', quantity_g: 15523.71 },
    { ingredient: 'Glucose Syrup (40-42DE)', quantity_g: 36221.99 },
    { ingredient: 'Condensed Milk Nestle', quantity_g: 15523.71 },
    { ingredient: 'Stabilizer', quantity_g: 5174.57 },
    { ingredient: 'Skimmed Milk Powder', quantity_g: 37946.85 },
];

const TEST_TARGET_PARAMS: ProductionTargets = {
    lossPct: 5,
    mixDensity: 1.04,
    overrunPct: 27,
    skuSizeLiters: 0.75,
    targetVolumeLiters: 1000,
};

// ═══════════════════════════════════════════════════
// computeBatchSizing
// ═══════════════════════════════════════════════════

describe('computeBatchSizing', () => {
    it('computes correct batch metrics for the test recipe', () => {
        const result = computeBatchSizing(TEST_RECIPE, TEST_TARGET_PARAMS);

        expect(result.n_skus).toBe(Math.ceil(1000 / 0.75));
        expect(result.batch_mass_g).toBeGreaterThan(0);
        expect(result.gross_liquid_volume_L).toBeGreaterThan(0);
        expect(result.scale_factor).toBeGreaterThan(0);

        // Manual calculation check:
        // pre_overrun = 1000 / 1.27 ≈ 787.40
        // gross = 787.40 / 0.95 ≈ 828.84
        // batch_mass_g = 828.84 * 1000 * 1.04 ≈ 861,993
        expect(result.gross_liquid_volume_L).toBeCloseTo(828.84, 0);
    });

    it('returns zero scale factor for empty recipe', () => {
        const result = computeBatchSizing([], TEST_TARGET_PARAMS);
        expect(result.scale_factor).toBe(0);
    });
});

// ═══════════════════════════════════════════════════
// computeRecipeMetrics
// ═══════════════════════════════════════════════════

describe('computeRecipeMetrics', () => {
    it('returns zero metrics for empty recipe', () => {
        const result = computeRecipeMetrics({});
        expect(result.total_mass_g).toBe(0);
        expect(result.fat_pct).toBe(0);
    });

    it('computes correct metrics for a simple recipe', () => {
        // 1000g of Toned Milk 3% → fat=3%, msnf=8.5%, sugars=4.8%, water=87.7%
        const result = computeRecipeMetrics({ 'Toned Milk 3%': 1000 });

        expect(result.total_mass_g).toBe(1000);
        expect(result.fat_pct).toBeCloseTo(3.0, 1);
        expect(result.msnf_pct).toBeCloseTo(8.5, 1);
        expect(result.sugars_pct).toBeCloseTo(4.8, 1);
        expect(result.water_pct).toBeCloseTo(87.7, 1);
    });

    it('computes total solids as 100 - water', () => {
        const result = computeRecipeMetrics({ 'Toned Milk 3%': 1000 });
        expect(result.total_solids_pct).toBeCloseTo(100 - 87.7, 1);
    });
});

// ═══════════════════════════════════════════════════
// parseInstruction
// ═══════════════════════════════════════════════════

describe('parseInstruction', () => {
    it('parses all three targets', () => {
        const result = parseInstruction('Increase fat to 8%, MSNF to 10%, sugars to 20%');
        expect(result.fat_pct).toBe(8);
        expect(result.msnf_pct).toBe(10);
        expect(result.sugars_pct).toBe(20);
    });

    it('parses partial targets', () => {
        const result = parseInstruction('fat 6.5');
        expect(result.fat_pct).toBe(6.5);
        expect(result.msnf_pct).toBeUndefined();
        expect(result.sugars_pct).toBeUndefined();
    });

    it('returns empty targets for non-matching instruction', () => {
        const result = parseInstruction('make it more creamy');
        expect(result.fat_pct).toBeUndefined();
        expect(result.msnf_pct).toBeUndefined();
        expect(result.sugars_pct).toBeUndefined();
    });

    it('handles "sugar" and "sugars" both', () => {
        expect(parseInstruction('sugar to 18%').sugars_pct).toBe(18);
        expect(parseInstruction('sugars to 22%').sugars_pct).toBe(22);
    });
});

// ═══════════════════════════════════════════════════
// runLpOptimizer
// ═══════════════════════════════════════════════════

describe('runLpOptimizer', () => {
    const scaledRecipe: Record<string, number> = {
        'Toned Milk 3%': 500,
        'Cream 25%': 150,
        'Sucrose/sugar': 100,
        'Skimmed Milk Powder': 40,
        'Stabilizer': 5,
    };

    it('returns success for achievable targets', () => {
        const result = runLpOptimizer(
            scaledRecipe,
            { fat_pct: 8 },
            'gelato'
        );
        expect(result.success).toBe(true);
        expect(result.solver_status).toContain('Optimal');
        expect(Object.keys(result.proposed_recipe).length).toBe(5);
    });

    it('preserves locked ingredient quantities', () => {
        const result = runLpOptimizer(
            scaledRecipe,
            { fat_pct: 8 },
            'gelato'
        );
        // Stabilizer is locked — should remain close to 5g
        // (may shift slightly due to post-LP total-mass rescaling)
        expect(result.proposed_recipe['Stabilizer']).toBeLessThan(7);
        expect(result.proposed_recipe['Stabilizer']).toBeGreaterThan(3);
    });

    it('returns recipe unchanged when no targets provided', () => {
        const result = runLpOptimizer(scaledRecipe, {}, 'gelato');
        // With no targets, the solver should return feasible (it just minimizes movement)
        expect(result.success).toBe(true);
    });
});

// ═══════════════════════════════════════════════════
// optimizerTool (deterministic pipeline, no AI)
// ═══════════════════════════════════════════════════

describe('optimizerTool', () => {
    it('scales and optimizes a recipe', () => {
        const result = optimizerTool(
           TEST_RECIPE,
           TEST_TARGET_PARAMS,
            'Increase fat to 8%, MSNF to 10%, sugars to 20%',
            'gelato'
        );

        expect(result.success).toBe(true);
        expect(result.batch.n_skus).toBe(Math.ceil(1000 / 0.75));
        expect(result.metrics_before.total_mass_g).toBeGreaterThan(0);
        expect(result.metrics_after.total_mass_g).toBeGreaterThan(0);
        expect(result.diffs.length).toBeGreaterThan(0);
    });

    it('works in scale-only mode (no numeric targets)', () => {
        const result = optimizerTool(
           TEST_RECIPE,
           TEST_TARGET_PARAMS,
            'make it more creamy',
            'gelato'
        );

        expect(result.success).toBe(true);
        expect(result.solver_status).toBe('N/A — Scale Only');
        expect(result.diffs.length).toBe(0);
    });
});
