import { IngredientData } from '@/types/ingredients';
import { apiPost } from './apiClient';

export type MetricsV2 = {
  // Basic composition (g)
  total_g: number;
  water_g: number;
  nonLactoseSugars_g: number;
  fat_g: number;
  msnf_g: number;
  other_g: number;

  // Basic composition (%)
  water_pct: number;
  nonLactoseSugars_pct: number;
  fat_pct: number;
  msnf_pct: number;
  other_pct: number;

  // Derived from MSNF
  protein_g: number;
  protein_pct: number;
  lactose_g: number;
  lactose_pct: number;

  // Total sugars (incl. lactose)
  totalSugars_g: number;
  totalSugars_pct: number;

  // Total solids
  ts_g: number;
  ts_pct: number;

  // Freezing point depression
  se_g: number; // Sucrose Equivalents
  sucrosePer100gWater: number;
  fpdse: number; // From sugars (Leighton)
  fpdsa: number; // From salts/MSNF
  fpdt: number;  // Total freezing point depression

  // POD (normalized sweetness index)
  pod_index: number;

  // AFP Index (Total recipe intensity)
  afp_index: number;

  // Warnings
  warnings: string[];
  clampedLeighton?: boolean;

  fruitAdjustments?: any;
  overrunPrediction?: any;
  servingTemp?: any;

  // Backwards compatibility for classification
  ts_add_pct?: number; // alias for ts_pct
  sp?: number; // alias for pod_index
  pac?: number; // alias for fpdt * 10 (approx)
};

export type CalcOptionsV2 = {
  evaporation_pct?: number;
  mode?: 'gelato' | 'ice_cream' | 'sorbet' | 'kulfi';
};

// Async wrapper hitting the backend instead of calculating locally
export async function calcMetricsV2(
  rows: { ing: IngredientData; grams: number }[],
  opts: CalcOptionsV2 = {}
): Promise<MetricsV2> {
  const payload = {
    recipeRows: rows.map(r => ({ ...r.ing, quantity_g: r.grams })),
    opts
  };
  const response = await apiPost('/api/calc/metrics', payload);
  if (!response || !response.metrics) {
    throw new Error("Failed to calculate metrics from backend");
  }
  return response.metrics as MetricsV2;
}

export type ProductClass =
  | 'ice_cream'
  | 'gelato_white'
  | 'gelato_finished'
  | 'fruit_gelato'
  | 'sorbet'
  | 'kulfi'
  | 'unknown';

export interface ClassificationResult {
  productType: ProductClass;
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
  deltas: Record<string, number>;
}
