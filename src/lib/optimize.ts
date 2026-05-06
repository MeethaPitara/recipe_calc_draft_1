import { apiPost } from './apiClient.js';
import { IngredientData } from '@/types/ingredients';

export type Row = { ing: IngredientData; grams: number; lock?: boolean; min?: number; max?: number; };

export type OptimizeTarget = Partial<{
    totalSugars_pct: number;
    sugars_pct: number;
    fat_pct: number;
    msnf_pct: number;
    ts_pct: number;
    fpdt: number;
    sp?: number;        // PHASE 5: Sweetening Power target
    afp_sugars?: number; // PHASE 5: AFP from sugars target
}>;

export async function optimizeRecipe(
    rows: Row[],
    targets: OptimizeTarget,
    mode: 'gelato' | 'kulfi' = 'gelato',
    maxIters = 1000,
    step = 1.0
): Promise<Row[]> {
    const response = await apiPost('/api/optimize/balance', {
        rows,
        targets,
        mode,
        maxIters,
        step
    });

    if (!response || !response.success) {
        throw new Error(response?.error || 'Failed to optimize recipe');
    }

    return response.result;
}
