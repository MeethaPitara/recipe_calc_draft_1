/**
 * Production API Client — Thin wrappers for production endpoints.
 * All computation happens on the backend.
 */

import { apiPost } from '../apiClient';

// ── Types (kept frontend-side for UI rendering) ──

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

export interface ProductionIngredient {
    ingredientId: string;
    name: string;
    massGrams: number;
    ingredientData?: any;
}

// ── API Calls ──

export async function calculateProductionRun(input: ProductionInput): Promise<ProductionOutput> {
    const response = await apiPost<{ success: boolean; result: ProductionOutput }>('/api/production/level1', input);
    if (!response?.success) throw new Error('Failed to calculate production run');
    return response.result;
}

export async function calculateAllocations(input: AllocationRequest): Promise<AllocationResult> {
    const response = await apiPost<{ success: boolean; result: AllocationResult }>('/api/production/level2', input);
    if (!response?.success) throw new Error('Failed to calculate allocations');
    return response.result;
}

export async function calculateDemandRun(input: Level3Input): Promise<Level3Output> {
    const response = await apiPost<{ success: boolean; result: Level3Output }>('/api/production/level3', input);
    if (!response?.success) throw new Error('Failed to calculate demand run');
    return response.result;
}
