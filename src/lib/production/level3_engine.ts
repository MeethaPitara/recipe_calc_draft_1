
export interface Level3Input {
    recipeItems: {
        ingredientId: string;
        name: string;
        massGrams: number; // The standard recipe values (e.g. sum = 1000g)
    }[];
    targetUnits: number;        // e.g., 500 (Integer)
    skuSizeLiters: number;      // e.g., 0.5
    overrunPercent: number;     // e.g., 30
    lossPercent: number;        // e.g., 5
    density: number;            // e.g., 1.1
}

export interface Level3Output {
    // 1. The Operational Stats
    stats: {
        targetUnits: number;
        packedFrozenLiters: number;  // Volume inside the tubs
        requiredMixLiters: number;   // Volume needed in the tank (includes loss)
        requiredMixKg: number;       // Mass needed in the tank
    };

    // 2. The Production Recipe (What the Chef mixes)
    scaledRecipe: {
        ingredientId: string;
        name: string;
        requiredMassKg: number;      // Scaled amount
        percentage: number;          // Relative % in batch
    }[];

    // 3. The Bill of Materials (Total Raw Mass)
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

    // Normalize percentages
    const O = overrunPercent / 100;
    const L = lossPercent / 100;

    // --- LOGGING START ---
    console.group("Level 3 Engine: Exact Batch Calculation");

    console.log("1. Inputs:");
    console.log(`   - Target Units: ${targetUnits}`);
    console.log(`   - SKU Size: ${skuSizeLiters} L`);
    console.log(`   - Overrun: ${overrunPercent}% (Factor: ${O})`);
    console.log(`   - Loss: ${lossPercent}% (Factor: ${L})`);
    console.log(`   - Density: ${density} kg/L`);

    // 1. Calculate Volume Requirements
    const packedFrozenLiters = targetUnits * skuSizeLiters;
    console.log("2. Volume Calculation (Reverse Math):");
    console.log(`   - Target Frozen Volume: ${packedFrozenLiters.toFixed(3)} L [Units * SKU]`);

    // Packed Mix Liters = Packed Frozen / (1 + Overrun)
    const packedMixLiters = packedFrozenLiters / (1 + O);
    console.log(`   - Packed Mix Volume: ${packedMixLiters.toFixed(3)} L [Frozen / (1+Overrun)]`);

    // Required Mix Liters = Packed Mix / (1 - Loss)
    // We divide by (1 - L) because if we lose L%, we retain (1-L)%.
    // So Required * (1 - L) = Packed => Required = Packed / (1 - L).
    const requiredMixLiters = packedMixLiters / (1 - L);
    console.log(`   - Required Mix Volume (Pre-Loss): ${requiredMixLiters.toFixed(3)} L [PackedMix / (1-Loss)]`);

    // 2. Calculate Mass Requirement
    const requiredMixKg = requiredMixLiters * density;
    console.log("3. Mass Calculation:");
    console.log(`   - Required Mix Mass: ${requiredMixKg.toFixed(3)} kg [Volume * Density]`);

    // 3. Scale Recipe
    const recipeTotalGrams = recipeItems.reduce((sum, item) => sum + item.massGrams, 0);
    const recipeTotalKg = recipeTotalGrams / 1000;
    console.log("4. Recipe Scaling:");
    console.log(`   - Base Recipe Mass: ${recipeTotalGrams.toFixed(1)} g (${recipeTotalKg.toFixed(3)} kg)`);

    // Avoid division by zero
    const scaleFactor = recipeTotalKg > 0 ? requiredMixKg / recipeTotalKg : 0;
    console.log(`   - Scale Factor: ${scaleFactor.toFixed(4)} [RequiredMass / RecipeMass]`);

    console.groupEnd();
    // --- LOGGING END ---

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
