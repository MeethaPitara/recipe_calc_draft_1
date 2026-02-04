import { describe, it, expect } from 'vitest';
import { calculateAllocations, AllocationRequest } from '../level2_engine';

describe('Level 2 Production Engine (Supply-Driven)', () => {

    // Test Case from PRD Section 4
    it('Passes PRD Verification Test Case: 100kg Base, 50% Base Recipe', () => {
        const request: AllocationRequest = {
            supply: {
                baseIngredientId: 'white-base',
                totalAvailableMassKg: 100
            },
            allocations: [{
                recipeId: 'test-recipe',
                recipeName: 'Test Ice Cream',
                allocationPercent: 100, // 100% of the 100kg base
                targetSkuSizeLiters: 1.0,
                targetOverrunPercent: 0,
                targetLossPercent: 0,
                targetDensity: 1.0,
                recipeItems: [
                    { ingredientId: 'white-base', name: 'White Base', massGrams: 500 },
                    { ingredientId: 'milk', name: 'Milk', massGrams: 500 }
                ]
            }]
        };

        const result = calculateAllocations(request);
        const row = result.rows[0];

        // Step 1: Base Fraction
        // 500g / 1000g = 0.5
        expect(row.baseFraction).toBe(0.5);

        // Step 2: Theoretical Limits
        // AllowedBase = 100kg * 100% = 100kg
        expect(row.theoreticalBaseAllocatedKg).toBe(100);
        // AllowedMix = 100kg / 0.5 = 200kg
        // AllowedMixLiters = 200kg / 1.0 = 200L
        // TheoreticalFrozenLiters = 200L * (1 + 0) = 200L
        expect(row.theoreticalFrozenLiters).toBe(200);

        // Step 3: Discrete Units
        // floor(200 / 1.0) = 200 units
        expect(row.producedUnits).toBe(200);

        // Step 4: Recompute Actuals
        // ActualFrozen = 200 * 1.0 = 200L
        expect(row.actualPackedFrozenLiters).toBe(200);
        // ActualBase = 100kg (calculated back)
        expect(row.actualBaseConsumedKg).toBeCloseTo(100);

        // Global Stats
        expect(result.globalStats.leftoverBaseKg).toBeCloseTo(0);
    });

    it('Passes PRD Verification Test Case: SKU Size 300L (Rounding Down)', () => {
        const request: AllocationRequest = {
            supply: {
                baseIngredientId: 'white-base',
                totalAvailableMassKg: 100
            },
            allocations: [{
                recipeId: 'test-recipe',
                recipeName: 'Test Ice Cream',
                allocationPercent: 100,
                targetSkuSizeLiters: 300.0, // Huge SKU
                targetOverrunPercent: 0,
                targetLossPercent: 0,
                targetDensity: 1.0,
                recipeItems: [
                    { ingredientId: 'white-base', name: 'White Base', massGrams: 500 },
                    { ingredientId: 'milk', name: 'Milk', massGrams: 500 }
                ]
            }]
        };

        const result = calculateAllocations(request);
        const row = result.rows[0];

        // Theoretical is still 200L (from previous test logic)
        expect(row.theoreticalFrozenLiters).toBe(200);

        // Step 3: Discrete Units
        // floor(200 / 300) = 0
        expect(row.producedUnits).toBe(0);

        // Step 4: Actuals
        expect(row.actualBaseConsumedKg).toBe(0);
        expect(result.globalStats.leftoverBaseKg).toBe(100);
    });

    it('Handles Over-allocation flag correctly', () => {
        const request: AllocationRequest = {
            supply: { baseIngredientId: 'b', totalAvailableMassKg: 100 },
            allocations: [
                {
                    recipeId: 'r1', allocationPercent: 60,
                    targetSkuSizeLiters: 1, targetOverrunPercent: 0, targetLossPercent: 0, targetDensity: 1,
                    recipeItems: [{ ingredientId: 'b', name: 'Base', massGrams: 100 }]
                },
                {
                    recipeId: 'r2', allocationPercent: 50, // Total 110%
                    targetSkuSizeLiters: 1, targetOverrunPercent: 0, targetLossPercent: 0, targetDensity: 1,
                    recipeItems: [{ ingredientId: 'b', name: 'Base', massGrams: 100 }]
                }
            ]
        };

        const result = calculateAllocations(request);
        expect(result.globalStats.isOverAllocated).toBe(true);
    });

    it('Calculates Add-ins correctly', () => {
        const request: AllocationRequest = {
            supply: { baseIngredientId: 'base', totalAvailableMassKg: 10 },
            allocations: [{
                recipeId: 'r1',
                allocationPercent: 100,
                targetSkuSizeLiters: 1,
                targetOverrunPercent: 0,
                targetLossPercent: 0,
                targetDensity: 1,
                recipeItems: [
                    { ingredientId: 'base', name: 'Base', massGrams: 80 }, // 80% Base
                    { ingredientId: 'flavor', name: 'Flavor', massGrams: 20 } // 20% Flavor
                ]
            }]
        };
        // 10kg Base / 0.8 = 12.5kg Mix
        // 12.5kg Mix -> 12.5L -> 12 Units
        // Actual Mix for 12 Units = 12kg
        // Actual Flavor = 12kg * 0.2 = 2.4kg

        const result = calculateAllocations(request);
        const row = result.rows[0];

        expect(row.producedUnits).toBe(12);
        expect(row.complementaryIngredients[0].ingredientId).toBe('flavor');
        expect(row.complementaryIngredients[0].requiredAmountKg).toBeCloseTo(2.4);
    });

});
