import type { Row, OptimizeTarget } from './optimize';
import type { IngredientData } from '@/types/ingredients';
import { apiPost } from './apiClient';

export interface Feasibility {
  feasible: boolean;
  reason?: string;
  suggestions: string[];
  flags: {
    hasWater: boolean;
    hasFatSource: boolean;
    hasMSNFSource: boolean;
    hasSugarSource: boolean;
  };
  missingCanonicals?: Array<'water' | 'cream35' | 'butter' | 'smp'>;
}

export interface AutoFixResult {
  applied: boolean;
  addedIngredients: Array<{ name: string; grams: number; reason: string }>;
  message: string;
}

/**
 * Frontend stub for pre-flight feasibility check
 * Hits the backend /api/optimize/diagnose endpoint
 */
export async function diagnoseFeasibility(
  rows: Row[],
  allIngredients: IngredientData[],
  targets: OptimizeTarget,
  mode?: 'gelato' | 'ice_cream' | 'sorbet' | 'kulfi'
): Promise<Feasibility> {
  const response = await apiPost('/api/optimize/diagnose', {
    rows,
    allIngredients,
    targets,
    mode
  });

  if (!response || !response.success) {
    throw new Error(response?.error || 'Failed to diagnose recipe feasibility');
  }

  return response.feasibility;
}

/**
 * Frontend stub for minimal auto-fix
 * Hits the backend /api/optimize/autofix endpoint
 */
export async function applyAutoFix(
  rows: Row[],
  allIngredients: IngredientData[],
  mode: 'gelato' | 'ice_cream' | 'sorbet' | 'kulfi',
  feasibility: Feasibility,
  currentMetrics?: { fat_pct: number; msnf_pct: number; totalSugars_pct: number },
  targets?: { fat_pct: number; msnf_pct: number; totalSugars_pct: number }
): Promise<AutoFixResult> {
  const response = await apiPost('/api/optimize/autofix', {
    rows,
    allIngredients,
    mode,
    feasibility,
    currentMetrics,
    targets
  });

  if (!response || !response.success) {
    throw new Error(response?.error || 'Failed to apply auto-fix');
  }

  return response.result;
}
