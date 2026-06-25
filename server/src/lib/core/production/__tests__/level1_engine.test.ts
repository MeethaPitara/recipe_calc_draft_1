
import { describe, it, expect } from 'vitest';
import { calculateProductionRun, ProductionInput } from '../level1_engine.js';

describe('Level 1 Production Engine', () => {
    const defaultInput: ProductionInput = {
        recipe: [
            { ingredient: 'Milk', quantity_g: 800 },
            { ingredient: 'Sugar', quantity_g: 200 }
        ],
        targetVolumeLiters: 100,
        skuSizeLiters: 1,
        overrunPct: 0,
        lossPct: 10,
        mixDensity: 1 // 1 kg/L for simplicity
    };

    it('should calculate mix required using divisor logic for loss (1 / (1-loss%))', () => {
        const result = calculateProductionRun(defaultInput);

        // Expected Logic:
        // Target: 100L
        // SKU: 1L -> 100 Units -> 100L Planned Frozen
        // Overrun: 0% -> Mix Volume = 100L
        // Loss: 10%
        // Old Logic (Multiplier): 100 * 1.1 = 110
        // New Logic (Divisor): 100 / (1 - 0.1) = 100 / 0.9 = 111.111...

        expect(result.skuStats.totalUnits).toBe(100);
        expect(result.skuStats.plannedVolume).toBe(100);

        const expectedMixVolume = 100 / 0.9;
        expect(result.skuStats.mixRequiredKg).toBeCloseTo(expectedMixVolume, 3);
    });

    it('should handle overrun and loss correctly combined', () => {
        const input = {
            ...defaultInput,
            overrunPct: 100, // 100% overrun -> Mix volume = half of frozen
            lossPct: 50      // 50% loss -> divide by 0.5 (multiply by 2)
        };
        // Expected:
        // Frozen: 100L
        // Mix (no loss): 100 / (1 + 1) = 50L
        // Buffered Mix: 50 / (1 - 0.5) = 50 / 0.5 = 100L

        const result = calculateProductionRun(input);

        expect(result.skuStats.mixRequiredKg).toBeCloseTo(100, 3);
    });
});
