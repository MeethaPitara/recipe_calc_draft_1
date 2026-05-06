/**
 * Optimizer API Client — Thin wrapper for the /api/optimize/run endpoint.
 * Replaces the local optimizer/engine.ts adapter logic.
 */

import { apiPost } from '../apiClient';
import type { IngredientData } from '@/types/ingredients';
import type { MetricsV2 } from '../calc.v2';

// ── PRD Interfaces (kept frontend-side for UI rendering) ──

export interface OptimizerRequest {
    currentRecipe: {
        ingredient: IngredientData;
        grams: number;
    }[];
    totalTargetMass: number;
    targets: {
        fat?: number;
        msnf?: number;
        sugars?: number;
        totalSolids?: number;
    };
    lockedIngredientIds: string[];
    freeIngredientIds: string[];
    mode?: string;
}

export interface OptimizerChange {
    id: string;
    name: string;
    oldMass: number;
    newMass: number;
    delta: number;
}

export interface OptimizerResult {
    success: boolean;
    status: 'OPTIMAL' | 'INFEASIBLE' | 'ERROR';
    optimizedRecipe: {
        ingredient: IngredientData;
        grams: number;
    }[];
    changes: OptimizerChange[];
    metricsBefore?: MetricsV2;
    metricsAfter?: MetricsV2;
    message: string;
}

// ── API Call ──

export async function runOptimizer(request: OptimizerRequest): Promise<OptimizerResult> {
    const response = await apiPost<OptimizerResult>('/api/optimize/run', request);
    return response;
}
