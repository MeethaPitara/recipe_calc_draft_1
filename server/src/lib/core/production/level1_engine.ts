/**
 * Level 1 Production Engine — "Quick Plan"
 * Calculates production run requirements based on target volume and machine settings.
 * Implements "Bucket" logic and "De-aeration" physics.
 * 
 * Migrated from src/lib/production/level1_engine.ts
 */

export const BATCH_QA_CHECKLIST: string[] = [
    "Machine and utensils sanitized",
    "Ingredients weighed and verified",
    "Pasteurization temperature reached (85°C)",
    "Aging time logged",
    "Metal detection passed"
];

export interface ProductionInput {
    recipe: { ingredientId?: string; name?: string; ingredient?: string; quantity_g: number }[];
    targetVolumeLiters: number;
    skuSizeLiters: number;
    overrunPct: number;
    lossPct: number;
    mixDensity: number;
    fillWeightG?: number;
    wasteFactorPct?: number;
    machineCapacityKgPerHour?: number;
    packagingItems?: { name: string; unitsNeededPerSku: number }[];
}

export interface ProductionOutput {
    skuStats: {
        totalUnits: number;
        plannedVolume: number;
        mixRequiredKg: number;
        unitsFromFillWeight?: number;
        expectedWasteKg?: number;
        estimatedRunTimeHours?: number;
    };
    scaledRecipe: { ingredientId?: string; name?: string; ingredient?: string; quantity_g: number }[];
    packagingRequirements?: { name: string; totalUnits: number }[];
    qaChecklist?: string[];
}

export function calculateProductionRun(input: ProductionInput): ProductionOutput {
    const {
        recipe,
        targetVolumeLiters,
        skuSizeLiters,
        overrunPct,
        lossPct,
        mixDensity,
        fillWeightG,
        wasteFactorPct,
        machineCapacityKgPerHour,
        packagingItems
    } = input;

    // --- Phase A: The "Buckets" (SKU Math) ---
    const totalUnits = Math.ceil(targetVolumeLiters / skuSizeLiters);
    const plannedVolume = totalUnits * skuSizeLiters;

    // --- Phase B: The Physics (Mix Calculation) ---
    const expansionFactor = 1 + (overrunPct / 100);
    const mixVolumeLiters = plannedVolume / expansionFactor;

    const lossDivisor = 1 - (lossPct / 100);
    const wasteDivisor = 1 - ((wasteFactorPct || 0) / 100);

    // Mix required before physical trim waste
    const mixVolumeWithoutWaste = mixVolumeLiters / lossDivisor;
    const mixRequiredWithoutWasteKg = mixVolumeWithoutWaste * mixDensity;

    // Mix required after physical trim waste
    const bufferedMixVolumeLiters = mixVolumeWithoutWaste / wasteDivisor;
    const mixRequiredKg = bufferedMixVolumeLiters * mixDensity;

    const expectedWasteKg = mixRequiredKg - mixRequiredWithoutWasteKg;

    // --- Phase C: Alternate Unit Count ---
    const unitsFromFillWeight = fillWeightG && fillWeightG > 0
        ? Math.floor((mixRequiredKg * 1000) / fillWeightG)
        : undefined;

    // --- Phase D: Advanced Outputs ---
    const estimatedRunTimeHours = machineCapacityKgPerHour && machineCapacityKgPerHour > 0
        ? mixRequiredKg / machineCapacityKgPerHour
        : undefined;

    let packagingRequirements = undefined;
    if (packagingItems && packagingItems.length > 0) {
        // Guarantee we have enough by pulling packaging for the higher of the two unit estimates
        const multiplier = Math.max(totalUnits, unitsFromFillWeight || 0);
        packagingRequirements = packagingItems.map(item => ({
            name: item.name,
            totalUnits: item.unitsNeededPerSku * multiplier
        }));
    }

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
            unitsFromFillWeight,
            expectedWasteKg: wasteFactorPct ? expectedWasteKg : undefined,
            estimatedRunTimeHours,
        },
        scaledRecipe,
        packagingRequirements,
        qaChecklist: BATCH_QA_CHECKLIST,
    };
}
