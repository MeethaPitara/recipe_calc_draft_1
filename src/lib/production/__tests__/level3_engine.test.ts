
import { describe, it, expect } from 'vitest';
import { calculateDemandRun, Level3Input } from '../level3_engine';

describe('Level 3 Production Engine (Exact Batch Calculator)', () => {

    it('Calculates basic mass balance correctly (No Overrun, No Loss)', () => {
        const input: Level3Input = {
            targetUnits: 100,
            skuSizeLiters: 1.0,
            overrunPercent: 0,
            lossPercent: 0,
            density: 1.0,
            recipeItems: [
                { ingredientId: 'a', name: 'A', massGrams: 500 },
                { ingredientId: 'b', name: 'B', massGrams: 500 }
            ]
        };

        const result = calculateDemandRun(input);

        // 1. Volume
        // 100 units * 1L = 100L Frozen
        expect(result.stats.packedFrozenLiters).toBe(100);
        // 100L Frozen / 1 (Overrun) = 100L Mix
        expect(result.stats.requiredMixLiters).toBe(100);
        // 100L * 1.0 Density = 100kg
        expect(result.stats.requiredMixKg).toBe(100);

        // 2. Recipe Scaling
        // Total Recipe Mass = 1kg. Need 100kg. Scale = 100.
        expect(result.totalMassKg).toBe(100);

        const itemA = result.scaledRecipe.find(r => r.ingredientId === 'a');
        expect(itemA?.requiredMassKg).toBe(50); // 0.5kg * 100
        expect(itemA?.percentage).toBe(50);
    });

    it('Handles Overrun correctly', () => {
        const input: Level3Input = {
            targetUnits: 100,
            skuSizeLiters: 1.0,
            overrunPercent: 100, // Double volume
            lossPercent: 0,
            density: 1.0,
            recipeItems: [
                { ingredientId: 'a', name: 'A', massGrams: 1000 }
            ]
        };

        const result = calculateDemandRun(input);

        // 100L Frozen
        expect(result.stats.packedFrozenLiters).toBe(100);
        // Mix = 100 / (1 + 1) = 50L
        expect(result.stats.requiredMixLiters).toBe(50);
        // Mass = 50kg
        expect(result.stats.requiredMixKg).toBe(50);
    });

    it('Handles Process Loss correctly', () => {
        // We want to END UP with 95L of Mix in the tubs.
        // We have 5% Loss. 
        // Start Amount * (1 - 0.05) = 95.
        // Start Amount = 95 / 0.95 = 100.
        const input: Level3Input = {
            targetUnits: 95,
            skuSizeLiters: 1.0,
            overrunPercent: 0,
            lossPercent: 5,
            density: 1.0,
            recipeItems: [
                { ingredientId: 'a', name: 'A', massGrams: 1000 }
            ]
        };

        const result = calculateDemandRun(input);

        // Packed Mix = 95L
        expect(result.stats.packedFrozenLiters).toBe(95);
        // Required Mix = 95 / 0.95 = 100L
        expect(result.stats.requiredMixLiters).toBeCloseTo(100);
        expect(result.stats.requiredMixKg).toBeCloseTo(100);
    });

    it('Handles Density correctly', () => {
        const input: Level3Input = {
            targetUnits: 10,
            skuSizeLiters: 1.0,
            overrunPercent: 0,
            lossPercent: 0,
            density: 1.5, // Heavy mix
            recipeItems: [
                { ingredientId: 'a', name: 'A', massGrams: 1000 }
            ]
        };

        const result = calculateDemandRun(input);

        // 10L Mix
        expect(result.stats.requiredMixLiters).toBe(10);
        // 10L * 1.5 = 15kg
        expect(result.stats.requiredMixKg).toBe(15);
    });

    it('Handles Complex Real World Scenario', () => {
        // Target: 500 Tubs of 0.5L
        // Overrun: 30%
        // Loss: 5%
        // Density: 1.1
        const input: Level3Input = {
            targetUnits: 500,
            skuSizeLiters: 0.5,
            overrunPercent: 30,
            lossPercent: 5,
            density: 1.1,
            recipeItems: [
                { ingredientId: 'milk', name: 'Milk', massGrams: 600 },
                { ingredientId: 'cream', name: 'Cream', massGrams: 400 }
            ]
        };

        const result = calculateDemandRun(input);

        // 1. Packed Frozen = 500 * 0.5 = 250L
        expect(result.stats.packedFrozenLiters).toBe(250);

        // 2. Packed Mix = 250 / 1.3 = 192.307...
        const expectedPackedMix = 250 / 1.3;

        // 3. Required Mix = Packed Mix / 0.95 = 202.428...
        const expectedRequiredMix = expectedPackedMix / 0.95;
        expect(result.stats.requiredMixLiters).toBeCloseTo(expectedRequiredMix);

        // 4. Required Mass = Required Mix * 1.1 = 222.67...
        const expectedMass = expectedRequiredMix * 1.1;
        expect(result.stats.requiredMixKg).toBeCloseTo(expectedMass);

        // 5. Scaling
        // Recipe Total = 1kg
        // Scale Factor = expectedMass / 1
        const milk = result.scaledRecipe.find(r => r.name === 'Milk');
        const cream = result.scaledRecipe.find(r => r.name === 'Cream');

        // Milk should be 60% of total mass
        expect(milk?.requiredMassKg).toBeCloseTo(expectedMass * 0.6);
        // Cream should be 40% of total mass
        expect(cream?.requiredMassKg).toBeCloseTo(expectedMass * 0.4);
    });

});
