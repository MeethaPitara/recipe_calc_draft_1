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
    targetUnits: number;
    skuSizeLiters: number;
    overrunPercent: number;
    lossPercent: number;
    density: number;
}

export interface Level3Output {
    stats: {
        targetUnits: number;
        packedFrozenLiters: number;
        requiredMixLiters: number;
        requiredMixKg: number;
    };
    scaledRecipe: {
        ingredientId: string;
        name: string;
        requiredMassKg: number;
        percentage: number;
    }[];
    totalMassKg: number;
}

export function calculateDemandRun(input: Level3Input): Level3Output {
    const {
        recipeItems,
        targetUnits,
        skuSizeLiters,
        overrunPercent,
        lossPercent,
        density
    } = input;

    const O = overrunPercent / 100;
    const L = lossPercent / 100;

    // 1. Calculate Volume Requirements
    const packedFrozenLiters = targetUnits * skuSizeLiters;
    const packedMixLiters = packedFrozenLiters / (1 + O);
    const requiredMixLiters = packedMixLiters / (1 - L);

    // 2. Calculate Mass Requirement
    const requiredMixKg = requiredMixLiters * density;

    // 3. Scale Recipe
    const recipeTotalGrams = recipeItems.reduce((sum, item) => sum + item.massGrams, 0);
    const recipeTotalKg = recipeTotalGrams / 1000;
    const scaleFactor = recipeTotalKg > 0 ? requiredMixKg / recipeTotalKg : 0;

    // 4. Generate Output List
    const scaledRecipe = recipeItems.map(item => {
        const itemKg = item.massGrams / 1000;
        const requiredMassKg = itemKg * scaleFactor;
        const percentage = recipeTotalGrams > 0 ? (item.massGrams / recipeTotalGrams) * 100 : 0;

        return {
            ingredientId: item.ingredientId,
            name: item.name,
            requiredMassKg,
            percentage
        };
    });

    return {
        stats: {
            targetUnits,
            packedFrozenLiters,
            requiredMixLiters,
            requiredMixKg
        },
        scaledRecipe,
        totalMassKg: requiredMixKg
    };
}
