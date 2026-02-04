export interface AllocationRequest {
    supply: {
        baseIngredientId: string;
        totalAvailableMassKg: number;
    };

    allocations: {
        recipeId: string;
        recipeName?: string; // Optional in input to support UI flexibility, but good to have

        recipeItems: {
            ingredientId: string;
            name: string;
            massGrams: number;
        }[];

        allocationPercent: number; // 0 to 100
        targetSkuSizeLiters: number;
        targetOverrunPercent: number;
        targetLossPercent: number;
        targetDensity: number;
    }[];
}

export interface AllocationResult {
    globalStats: {
        totalBaseAvailableKg: number;
        totalBaseUsedKg: number;
        leftoverBaseKg: number;
        isOverAllocated: boolean;
    };

    rows: {
        recipeId: string;
        isValid: boolean;
        error?: string;

        // 1. The Math Factors
        baseFraction: number;

        // 2. The Theoretical Limits
        theoreticalBaseAllocatedKg: number;
        theoreticalFrozenLiters: number;

        // 3. The Operational Truth
        producedUnits: number;

        // 4. The Backward Calculation
        actualPackedFrozenLiters: number;
        actualMixRequiredKg: number;
        actualBaseConsumedKg: number;

        // 5. The Shopping List
        complementaryIngredients: {
            ingredientId: string;
            name: string;
            requiredAmountKg: number;
        }[];
    }[];
}

/**
 * Calculates allocation of a fixed base ingredient supply across multiple recipes.
 * Strictly follows PRD Task 8 v1.0 logic.
 */
export function calculateAllocations(request: AllocationRequest): AllocationResult {
    const { supply, allocations } = request;
    const EPSILON = 0.0001;

    // --- Phase A: Global Validation ---
    const totalAllocationPct = allocations.reduce((sum, a) => sum + a.allocationPercent, 0);
    const isOverAllocated = totalAllocationPct > 100 + EPSILON;

    let totalBaseUsedKg = 0;

    const rows = allocations.map(allocation => {
        // --- Phase B: Row Processing ---

        // Step 1: Base Identification & Fraction
        const recipeTotalMass = allocation.recipeItems.reduce((sum, item) => sum + item.massGrams, 0);
        const baseItem = allocation.recipeItems.find(item => item.ingredientId === supply.baseIngredientId);

        if (!baseItem || recipeTotalMass <= 0) {
            return {
                recipeId: allocation.recipeId,
                isValid: false,
                error: "Base not found or invalid recipe mass",
                baseFraction: 0,
                theoreticalBaseAllocatedKg: 0,
                theoreticalFrozenLiters: 0,
                producedUnits: 0,
                actualPackedFrozenLiters: 0,
                actualMixRequiredKg: 0,
                actualBaseConsumedKg: 0,
                complementaryIngredients: []
            };
        }

        const baseFraction = baseItem.massGrams / recipeTotalMass;

        // Step 2: Theoretical Limits
        // Normalize inputs
        const O = allocation.targetOverrunPercent / 100;
        const L = allocation.targetLossPercent / 100;
        const D = allocation.targetDensity;

        // Formulas
        const allowedBaseKg = supply.totalAvailableMassKg * (allocation.allocationPercent / 100);
        const allowedMixKg = allowedBaseKg / baseFraction;
        const allowedMixLiters = allowedMixKg / D;

        // Theoretical Frozen Liters = Mix Volume * (1 + Overrun) NOT just Mix Volume. 
        // Wait, PRD says: "TheoreticalFrozenLiters = AllowedMixLiters * (1 + O)"? 
        // CHECK PRD TEXT: "TheoreticalFrozenLiters = AllowedMixLiters * (1 + O)" 
        // Yes, usually Mix expands.
        const theoreticalFrozenLiters = allowedMixLiters * (1 + O);

        // Step 3: Discrete Unit Calculation
        // Floor of theoretical capacity divided by SKU size
        const producedUnits = Math.floor(theoreticalFrozenLiters / allocation.targetSkuSizeLiters);

        // Step 4: Recompute Actuals (Backward Pass)
        const actualPackedFrozenLiters = producedUnits * allocation.targetSkuSizeLiters;

        // Packed Mix Liters (Liquid in the tubs)
        const packedMixLiters = actualPackedFrozenLiters / (1 + O);

        // Required Mix Liters (Liquid brewed including loss)
        // Required = Packed / (1 - Loss)
        const requiredMixLiters = packedMixLiters / (1 - L);

        const actualMixRequiredKg = requiredMixLiters * D;
        const actualBaseConsumedKg = actualMixRequiredKg * baseFraction;

        // Step 5: Calculate Add-ins
        const complementaryIngredients = allocation.recipeItems
            .filter(item => item.ingredientId !== supply.baseIngredientId)
            .map(item => {
                const itemFraction = item.massGrams / recipeTotalMass;
                const requiredAmountKg = actualMixRequiredKg * itemFraction;
                return {
                    ingredientId: item.ingredientId,
                    name: item.name,
                    requiredAmountKg
                };
            });

        // Aggregate User Base
        totalBaseUsedKg += actualBaseConsumedKg;

        return {
            recipeId: allocation.recipeId,
            isValid: true,
            baseFraction,
            theoreticalBaseAllocatedKg: allowedBaseKg,
            theoreticalFrozenLiters,
            producedUnits,
            actualPackedFrozenLiters,
            actualMixRequiredKg,
            actualBaseConsumedKg,
            complementaryIngredients
        };
    });

    // --- Phase C: Aggregation ---
    const leftoverBaseKg = supply.totalAvailableMassKg - totalBaseUsedKg;

    return {
        globalStats: {
            totalBaseAvailableKg: supply.totalAvailableMassKg,
            totalBaseUsedKg,
            leftoverBaseKg,
            isOverAllocated
        },
        rows
    };
}

/**
 * Validates and ensures compatibility with older calls requesting 'calculateBaseRun'.
 */
export const calculateBaseRun = calculateAllocations;
