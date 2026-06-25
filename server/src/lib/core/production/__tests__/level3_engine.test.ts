
import { describe, it, expect } from 'vitest';
import { calculateDemandRun, Level3Input } from '../level3_engine.js';

describe('Level 3 Production Engine (Exact Batch Calculator)', () => {

    it('calculates basic mass balance correctly (no overrun, no loss)', () => {
        const input: Level3Input = {
            recipeItems: [
                { ingredientId: 'a', name: 'A', massGrams: 500 },
                { ingredientId: 'b', name: 'B', massGrams: 500 }
            ],
            cup100mlCount: 1000, // 1000 * 0.1L = 100L
            tub500mlCount: 0,
            overrunPercent: 0,
            processLossPercent: 0,
            evaporationLossPercent: 0,
            machineCapacityLiters: 0, // 0 -> single batch
            density: 1.0
        };

        const result = calculateDemandRun(input);

        // 1000 cups * 0.1L = 100L packed frozen
        expect(result.stats.packedFrozenLiters).toBe(100);
        // No overrun -> mix liters = packed liters
        expect(result.stats.requiredMixLiters).toBe(100);
        // Density 1.0 -> mix kg = mix liters
        expect(result.stats.requiredMixKg).toBe(100);

        // Recipe total = 1kg, need 100kg -> scale factor 100
        expect(result.totalMassKg).toBe(100);
        const itemA = result.scaledRecipe.find(r => r.ingredientId === 'a');
        expect(itemA?.requiredMassKg).toBeCloseTo(50);
        expect(itemA?.percentage).toBe(50);
    });

    it('handles overrun correctly (more frozen volume per liter of mix)', () => {
        const input: Level3Input = {
            recipeItems: [{ ingredientId: 'a', name: 'A', massGrams: 1000 }],
            cup100mlCount: 0,
            tub500mlCount: 200, // 200 * 0.5L = 100L
            overrunPercent: 100, // double volume
            processLossPercent: 0,
            evaporationLossPercent: 0,
            machineCapacityLiters: 0,
            density: 1.0
        };

        const result = calculateDemandRun(input);

        expect(result.stats.packedFrozenLiters).toBe(100);
        // Mix = 100 / (1 + 1) = 50L
        expect(result.stats.requiredMixLiters).toBe(50);
        expect(result.stats.requiredMixKg).toBe(50);
    });

    it('handles process + evaporation loss correctly', () => {
        // Packed = 95L. Process loss 5%, evap loss 0% -> required = 95 / 0.95 = 100L
        const input: Level3Input = {
            recipeItems: [{ ingredientId: 'a', name: 'A', massGrams: 1000 }],
            cup100mlCount: 0,
            tub500mlCount: 190, // 190 * 0.5L = 95L
            overrunPercent: 0,
            processLossPercent: 5,
            evaporationLossPercent: 0,
            machineCapacityLiters: 0,
            density: 1.0
        };

        const result = calculateDemandRun(input);

        expect(result.stats.packedFrozenLiters).toBe(95);
        expect(result.stats.requiredMixLiters).toBeCloseTo(100);
        expect(result.stats.requiredMixKg).toBeCloseTo(100);
    });

    it('handles density correctly', () => {
        const input: Level3Input = {
            recipeItems: [{ ingredientId: 'a', name: 'A', massGrams: 1000 }],
            cup100mlCount: 100, // 10L
            tub500mlCount: 0,
            overrunPercent: 0,
            processLossPercent: 0,
            evaporationLossPercent: 0,
            machineCapacityLiters: 0,
            density: 1.5
        };

        const result = calculateDemandRun(input);

        expect(result.stats.requiredMixLiters).toBe(10);
        expect(result.stats.requiredMixKg).toBe(15);
    });

    it('splits into batches according to machine capacity', () => {
        const input: Level3Input = {
            recipeItems: [{ ingredientId: 'a', name: 'A', massGrams: 1000 }],
            cup100mlCount: 0,
            tub500mlCount: 200, // 100L packed
            overrunPercent: 0,
            processLossPercent: 0,
            evaporationLossPercent: 0,
            machineCapacityLiters: 30,
            density: 1.0
        };

        const result = calculateDemandRun(input);

        // 100L mix / 30L capacity -> 4 batches (ceil)
        expect(result.stats.numberOfBatches).toBe(4);
        expect(result.stats.batchSizeLiters).toBeCloseTo(25);
        expect(result.stats.batchSizeKg).toBeCloseTo(25);
    });

    it('includes the QA checklist and process notes (Phase 9.3)', () => {
        const input: Level3Input = {
            recipeItems: [{ ingredientId: 'a', name: 'A', massGrams: 1000 }],
            cup100mlCount: 100,
            tub500mlCount: 0,
            overrunPercent: 30,
            processLossPercent: 5,
            evaporationLossPercent: 2,
            machineCapacityLiters: 30,
            density: 1.1
        };

        const result = calculateDemandRun(input);

        expect(result.qaChecklist.length).toBeGreaterThan(0);
        expect(result.processNotes.length).toBeGreaterThan(0);
        expect(result.processNotes.join(' ')).toContain('batch');
    });

});
