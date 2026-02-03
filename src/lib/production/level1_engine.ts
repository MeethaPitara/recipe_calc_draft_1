import { RecipeIngredient } from '@/types/recipe';

export interface ProductionInput {
    recipe: RecipeIngredient[]; // Using RecipeIngredient to match project structure
    targetVolumeLiters: number;
    skuSizeLiters: number;
    overrunPct: number; // e.g., 30 for 30%
    lossPct: number;    // e.g., 5 for 5%
    mixDensity: number; // e.g., 1.1 kg/L
}

export interface ProductionOutput {
    skuStats: {
        totalUnits: number;       // The discrete count (e.g., 101 tubs)
        plannedVolume: number;    // The actual frozen volume (e.g., 50.5 Liters)
        mixRequiredKg: number;    // The liquid mass to brew (e.g., 42.5 kg)
    };
    scaledRecipe: RecipeIngredient[]; // The final list with 'quantity_g' scaled to the batch size
}

/**
 * Calculates the production run requirements based on target volume and machine settings.
 * Implements Level-1 "Bucket" logic and "De-aeration" physics.
 */
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
    // Real production is discrete. We must produce enough to fill WHOLE containers.
    // Rule: Always round UP.

    const totalUnits = Math.ceil(targetVolumeLiters / skuSizeLiters);
    const plannedVolume = totalUnits * skuSizeLiters;

    // --- Phase B: The Physics (Mix Calculation) ---
    // Convert "Planned Frozen Volume" into "Liquid Mix Mass".

    // 1. Remove the Air (Overrun)
    // Mix Volume = Frozen Volume / (1 + Overrun%)
    const expansionFactor = 1 + (overrunPct / 100);
    const mixVolumeLiters = plannedVolume / expansionFactor;

    // 2. Add the Waste Buffer (Process Loss)
    // We need extra mix to account for loss in pipes/freezers.
    const lossMultiplier = 1 + (lossPct / 100);
    const bufferedMixVolumeLiters = mixVolumeLiters * lossMultiplier;

    // 3. Convert to Weight (Density)
    // Mass = Volume * Density
    const mixRequiredKg = bufferedMixVolumeLiters * mixDensity;

    // --- Phase E: Direct Scaling (The Explosion) ---
    // Scale the input recipe to match the required Total Mix Mass.

    // 1. Get Recipe Total Weight (input is usually normalized to 100g or 1000g, but we calculate actual sum to be safe)
    const currentTotalWeightG = recipe.reduce((sum, item) => sum + item.quantity_g, 0);

    // 2. Calculate Scaling Factor
    // We need output in Grams for the recipe list.
    // mixRequiredKg * 1000 = mixRequiredGrams
    const requiredTotalWeightG = mixRequiredKg * 1000;

    // Factor = Target / Current
    const scalingFactor = requiredTotalWeightG / currentTotalWeightG;

    // 3. Execute Scaling
    const scaledRecipe: RecipeIngredient[] = recipe.map(item => ({
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
