/**
 * Level 2 Production Engine — "Base Planner"
 * Calculates allocation of a fixed base ingredient supply across multiple recipes.
 * Follows PRD Task 8 v1.0 logic.
 * 
 * Migrated from src/lib/production/level2_engine.ts
 */

export interface AllocationRequest {
    supply: {
        baseIngredientId: string;
        totalAvailableMassKg: number;
    };

    allocations: {
        recipeId: string;
        recipeName?: string;
        recipeItems: {
            ingredientId: string;
            name: string;
            massGrams: number;
        }[];
        allocationPercent: number;
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
        recipeName: string;
        isValid: boolean;
        error?: string;
        baseFraction: number;
        theoreticalBaseAllocatedKg: number;
        theoreticalFrozenLiters: number;
        producedUnits: number;
        actualPackedFrozenLiters: number;
        actualMixRequiredKg: number;
        actualBaseConsumedKg: number;
        complementaryIngredients: {
            ingredientId: string;
            name: string;
            requiredAmountKg: number;
        }[];
    }[];
}

export function calculateAllocations(request: AllocationRequest): AllocationResult {
    const { supply, allocations } = request;
    const EPSILON = 0.0001;

    const totalAllocationPct = allocations.reduce((sum, a) => sum + a.allocationPercent, 0);
    const isOverAllocated = totalAllocationPct > 100 + EPSILON;

    let totalBaseUsedKg = 0;

    const rows = allocations.map(allocation => {
        const recipeTotalMass = allocation.recipeItems.reduce((sum, item) => sum + item.massGrams, 0);
        const baseItem = allocation.recipeItems.find(item => item.ingredientId === supply.baseIngredientId);

        if (!baseItem || recipeTotalMass <= 0) {
            return {
                recipeId: allocation.recipeId,
                recipeName: allocation.recipeName || "Unknown Recipe",
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

        const O = allocation.targetOverrunPercent / 100;
        const L = allocation.targetLossPercent / 100;
        const D = allocation.targetDensity;

        const allowedBaseKg = supply.totalAvailableMassKg * (allocation.allocationPercent / 100);
        const allowedMixKg = allowedBaseKg / baseFraction;
        const allowedMixLiters = allowedMixKg / D;
        const theoreticalFrozenLiters = allowedMixLiters * (1 - L) * (1 + O);

        const producedUnits = Math.floor(theoreticalFrozenLiters / allocation.targetSkuSizeLiters);

        const actualPackedFrozenLiters = producedUnits * allocation.targetSkuSizeLiters;
        const packedMixLiters = actualPackedFrozenLiters / (1 + O);
        const requiredMixLiters = packedMixLiters / (1 - L);
        const actualMixRequiredKg = requiredMixLiters * D;
        const actualBaseConsumedKg = actualMixRequiredKg * baseFraction;

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

        totalBaseUsedKg += actualBaseConsumedKg;

        return {
            recipeId: allocation.recipeId,
            recipeName: allocation.recipeName || "Unknown Recipe",
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

export const calculateBaseRun = calculateAllocations;
