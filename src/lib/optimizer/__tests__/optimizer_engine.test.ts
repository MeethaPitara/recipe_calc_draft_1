import { describe, it, expect } from 'vitest';
import { runOptimizer, type OptimizerRequest } from '../engine';
import type { IngredientData } from '@/types/ingredients';

// ============================================================================
// MOCK DATA
// ============================================================================

const mockWholeMilk: IngredientData = {
    id: 'milk_whole',
    name: 'Whole Milk',
    category: 'dairy',
    water_pct: 87.7,
    fat_pct: 3.5,
    msnf_pct: 8.8,
    sugars_pct: 0,
    other_solids_pct: 0,
    sp_coeff: 0,
    pac_coeff: 0,
};

const mockCream35: IngredientData = {
    id: 'cream_35',
    name: 'Heavy Cream 35%',
    category: 'dairy',
    water_pct: 57.7,
    fat_pct: 35,
    msnf_pct: 5.9,
    sugars_pct: 0,
    other_solids_pct: 1.4,
    sp_coeff: 0,
    pac_coeff: 0,
};

const mockSucrose: IngredientData = {
    id: 'sucrose',
    name: 'Sucrose',
    category: 'sugar',
    water_pct: 0,
    fat_pct: 0,
    msnf_pct: 0,
    sugars_pct: 100,
    other_solids_pct: 0,
    sp_coeff: 1.0,
    pac_coeff: 1.0,
};

const mockSMP: IngredientData = {
    id: 'smp',
    name: 'Skim Milk Powder',
    category: 'dairy',
    water_pct: 4,
    fat_pct: 0.8,
    msnf_pct: 95.2,
    sugars_pct: 0,
    other_solids_pct: 0,
    sp_coeff: 0,
    pac_coeff: 0,
};

const mockWater: IngredientData = {
    id: 'water',
    name: 'Water',
    category: 'other',
    water_pct: 100,
    fat_pct: 0,
    msnf_pct: 0,
    sugars_pct: 0,
    other_solids_pct: 0,
    sp_coeff: 0,
    pac_coeff: 0,
};

const mockStabilizer: IngredientData = {
    id: 'stabilizer_01',
    name: 'Gelato Stabilizer',
    category: 'stabilizer',
    water_pct: 5,
    fat_pct: 0,
    msnf_pct: 0,
    sugars_pct: 0,
    other_solids_pct: 95,
    sp_coeff: 0,
    pac_coeff: 0,
};

// ============================================================================
// TESTS
// ============================================================================

describe('runOptimizer', () => {
    it('returns a valid OptimizerResult with success or infeasible status', () => {
        const request: OptimizerRequest = {
            currentRecipe: [
                { ingredient: mockWholeMilk, grams: 500 },
                { ingredient: mockCream35, grams: 200 },
                { ingredient: mockSucrose, grams: 150 },
                { ingredient: mockSMP, grams: 50 },
                { ingredient: mockWater, grams: 100 },
            ],
            totalTargetMass: 1000,
            targets: {
                fat: 8.0,
                msnf: 10.0,
            },
            lockedIngredientIds: [],
            freeIngredientIds: ['milk_whole', 'cream_35', 'sucrose', 'smp', 'water'],
        };

        const result = runOptimizer(request);

        // Should return a valid result structure
        expect(result).toBeDefined();
        expect(result.status).toMatch(/^(OPTIMAL|INFEASIBLE|ERROR)$/);
        expect(result.optimizedRecipe).toBeDefined();
        expect(Array.isArray(result.optimizedRecipe)).toBe(true);
        expect(typeof result.message).toBe('string');
    });

    it('returns INFEASIBLE when all ingredients are locked', () => {
        const request: OptimizerRequest = {
            currentRecipe: [
                { ingredient: mockWholeMilk, grams: 500 },
                { ingredient: mockCream35, grams: 200 },
            ],
            totalTargetMass: 700,
            targets: { fat: 15.0 },
            lockedIngredientIds: ['milk_whole', 'cream_35'],
            freeIngredientIds: [],
        };

        const result = runOptimizer(request);

        expect(result.success).toBe(false);
        expect(result.status).toBe('INFEASIBLE');
        expect(result.message).toContain('locked');
    });

    it('preserves locked ingredient quantities in the output', () => {
        const request: OptimizerRequest = {
            currentRecipe: [
                { ingredient: mockWholeMilk, grams: 500 },
                { ingredient: mockCream35, grams: 200 },
                { ingredient: mockSucrose, grams: 150 },
                { ingredient: mockStabilizer, grams: 5 },
                { ingredient: mockWater, grams: 145 },
            ],
            totalTargetMass: 1000,
            targets: { fat: 10.0 },
            lockedIngredientIds: ['stabilizer_01'],
            freeIngredientIds: ['milk_whole', 'cream_35', 'sucrose', 'water'],
        };

        const result = runOptimizer(request);

        if (result.success) {
            // Stabilizer should not appear in changes
            const stabilizerChange = result.changes.find(
                (c) => c.id === 'stabilizer_01'
            );
            expect(stabilizerChange).toBeUndefined();
        }
        // Even if infeasible, should still return valid structure
        expect(result.optimizedRecipe).toBeDefined();
    });

    it('populates changes array with diffs when optimization succeeds', () => {
        const request: OptimizerRequest = {
            currentRecipe: [
                { ingredient: mockWholeMilk, grams: 600 },
                { ingredient: mockCream35, grams: 100 },
                { ingredient: mockSucrose, grams: 150 },
                { ingredient: mockSMP, grams: 50 },
                { ingredient: mockWater, grams: 100 },
            ],
            totalTargetMass: 1000,
            targets: { fat: 8.0 },
            lockedIngredientIds: [],
            freeIngredientIds: ['milk_whole', 'cream_35', 'sucrose', 'smp', 'water'],
        };

        const result = runOptimizer(request);

        if (result.success) {
            expect(result.changes.length).toBeGreaterThan(0);
            for (const change of result.changes) {
                expect(change).toHaveProperty('id');
                expect(change).toHaveProperty('name');
                expect(change).toHaveProperty('oldMass');
                expect(change).toHaveProperty('newMass');
                expect(change).toHaveProperty('delta');
                expect(change.delta).toBeCloseTo(
                    change.newMass - change.oldMass,
                    1
                );
            }
        }
    });

    it('includes before/after metrics when optimization succeeds', () => {
        const request: OptimizerRequest = {
            currentRecipe: [
                { ingredient: mockWholeMilk, grams: 500 },
                { ingredient: mockCream35, grams: 200 },
                { ingredient: mockSucrose, grams: 150 },
                { ingredient: mockSMP, grams: 50 },
                { ingredient: mockWater, grams: 100 },
            ],
            totalTargetMass: 1000,
            targets: { fat: 8.0, msnf: 10.0 },
            lockedIngredientIds: [],
            freeIngredientIds: ['milk_whole', 'cream_35', 'sucrose', 'smp', 'water'],
        };

        const result = runOptimizer(request);

        expect(result.metricsBefore).toBeDefined();
        if (result.success) {
            expect(result.metricsAfter).toBeDefined();
            expect(result.metricsAfter!.fat_pct).toBeDefined();
            expect(result.metricsAfter!.msnf_pct).toBeDefined();
        }
    });
});
