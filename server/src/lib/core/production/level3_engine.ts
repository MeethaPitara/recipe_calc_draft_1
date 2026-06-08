/**
 * Level 3 Production Engine — "Exact Plan"
 * Demand-based batch calculation: given exact number of units, compute the full recipe.
 * 
 * Migrated from src/lib/production/level3_engine.ts
 */

export interface Level3Input {
    recipeItems: {
        ingredientId: string;
        name: string;
        massGrams: number;
    }[];
    cup100mlCount: number;
    tub500mlCount: number;
    overrunPercent: number;
    processLossPercent: number;
    evaporationLossPercent: number;
    machineCapacityLiters: number;
    density: number;
}

export interface Level3Output {
    stats: {
        cup100mlCount: number;
        tub500mlCount: number;
        packedFrozenLiters: number;
        requiredMixLiters: number;
        requiredMixKg: number;
        numberOfBatches: number;
        batchSizeLiters: number;
        batchSizeKg: number;
    };
    scaledRecipe: {
        ingredientId: string;
        name: string;
        requiredMassKg: number;
        perBatchMassKg: number;
        percentage: number;
    }[];
    totalMassKg: number;
}

export function calculateDemandRun(input: Level3Input): Level3Output {
    const {
        recipeItems,
        cup100mlCount,
        tub500mlCount,
        overrunPercent,
        processLossPercent,
        evaporationLossPercent,
        machineCapacityLiters,
        density
    } = input;

    const O = overrunPercent / 100;
    const PL = processLossPercent / 100;
    const EL = evaporationLossPercent / 100;

    // 1. Calculate Volume Requirements
    const packedFrozenLiters = (cup100mlCount * 0.1) + (tub500mlCount * 0.5);
    const packedMixLiters = packedFrozenLiters / (1 + O);
    const requiredMixLiters = packedMixLiters / ((1 - PL) * (1 - EL));

    // 2. Calculate Mass Requirement
    const requiredMixKg = requiredMixLiters * density;

    // 3. Batch Calculation
    const numberOfBatches = machineCapacityLiters > 0 ? Math.ceil(requiredMixLiters / machineCapacityLiters) : 1;
    const batchSizeLiters = numberOfBatches > 0 ? requiredMixLiters / numberOfBatches : 0;
    const batchSizeKg = numberOfBatches > 0 ? requiredMixKg / numberOfBatches : 0;

    // 4. Scale Recipe
    const recipeTotalGrams = recipeItems.reduce((sum, item) => sum + item.massGrams, 0);
    const recipeTotalKg = recipeTotalGrams / 1000;
    const scaleFactor = recipeTotalKg > 0 ? requiredMixKg / recipeTotalKg : 0;

    // 5. Generate Output List
    const scaledRecipe = recipeItems.map(item => {
        const itemKg = item.massGrams / 1000;
        const requiredMassKg = itemKg * scaleFactor;
        const perBatchMassKg = numberOfBatches > 0 ? requiredMassKg / numberOfBatches : 0;
        const percentage = recipeTotalGrams > 0 ? (item.massGrams / recipeTotalGrams) * 100 : 0;

        return {
            ingredientId: item.ingredientId,
            name: item.name,
            requiredMassKg,
            perBatchMassKg,
            percentage
        };
    });

    return {
        stats: {
            cup100mlCount,
            tub500mlCount,
            packedFrozenLiters,
            requiredMixLiters,
            requiredMixKg,
            numberOfBatches,
            batchSizeLiters,
            batchSizeKg
        },
        scaledRecipe,
        totalMassKg: requiredMixKg
    };
}
