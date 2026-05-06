/**
 * Level 1 Production Engine — "Quick Plan"
 * Calculates production run requirements based on target volume and machine settings.
 * Implements "Bucket" logic and "De-aeration" physics.
 * 
 * Migrated from src/lib/production/level1_engine.ts
 */

export interface ProductionInput {
    recipe: { ingredientId?: string; name?: string; ingredient?: string; quantity_g: number }[];
    targetVolumeLiters: number;
    skuSizeLiters: number;
    overrunPct: number;
    lossPct: number;
    mixDensity: number;
}

export interface ProductionOutput {
    skuStats: {
        totalUnits: number;
        plannedVolume: number;
        mixRequiredKg: number;
    };
    scaledRecipe: { ingredientId?: string; name?: string; ingredient?: string; quantity_g: number }[];
}

export function calculateProductionRun(input: ProductionInput): ProductionOutput {
    const {
        recipe,
        targetVolumeLiters,
        skuSizeLiters,
        overrunPct,
        lossPct,
        mixDensity
    } = input;

    // --- Phase A: The "Buckets" (SKU Math) ---
    const totalUnits = Math.ceil(targetVolumeLiters / skuSizeLiters);
    const plannedVolume = totalUnits * skuSizeLiters;

    // --- Phase B: The Physics (Mix Calculation) ---
    const expansionFactor = 1 + (overrunPct / 100);
    const mixVolumeLiters = plannedVolume / expansionFactor;

    const lossDivisor = 1 - (lossPct / 100);
    const bufferedMixVolumeLiters = mixVolumeLiters / lossDivisor;

    const mixRequiredKg = bufferedMixVolumeLiters * mixDensity;

    // --- Phase E: Direct Scaling ---
    const currentTotalWeightG = recipe.reduce((sum, item) => sum + item.quantity_g, 0);
    const requiredTotalWeightG = mixRequiredKg * 1000;
    const scalingFactor = currentTotalWeightG > 0 ? requiredTotalWeightG / currentTotalWeightG : 0;

    const scaledRecipe = recipe.map(item => ({
        ...item,
        quantity_g: item.quantity_g * scalingFactor,
    }));

    return {
        skuStats: {
            totalUnits,
            plannedVolume,
            mixRequiredKg,
        },
        scaledRecipe,
    };
}
