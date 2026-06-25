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

  // POD (normalized sweetness index, sucrose=100 baseline)
  pod_index: number;

  // SP% — Carpigiani sweetness as % of recipe weight (Σ sp_coeff_i × grams_i / total × 100)
  sp_pct: number;

  // AFP Index (Total recipe intensity)
  afp_index: number;

  // Total sugars including lactose (for validation against industry bands)
  totalSugarsTotal_g: number;
  totalSugarsTotal_pct: number;

  // Warnings
  warnings: string[];
  clampedLeighton?: boolean;

  fruitAdjustments?: any;
  overrunPrediction?: any;
  servingTemp?: any;

  // Backwards compatibility for classification
  ts_add_pct?: number; // alias for ts_pct
  sp?: number;         // alias for sp_pct (Carpigiani SP%)
  pac?: number;        // alias for afp_index

  // PHASE 7.2: advisory diagnosis from the backend's recipeDiagnosis.ts —
  // never auto-applied, the UI only ever renders problem/why/fix (7.4).
  diagnosis?: Diagnosis[];
  productProfile?: string;
  profileBands?: {
    fat: [number, number]; msnf: [number, number]; totalSugar: [number, number];
    totalSolids: [number, number]; sp: [number, number]; afp: [number, number]; fpdt: [number, number];
    lactoseRiskMaxPct: number; proteinRiskMaxPct: number;
    servingTempC: [number, number];
  };
  // PHASE 7.5: true until Phase 8's freezingCurve.ts replaces serving.v1.ts's
  // estimate with the Leighton-based curve.
  servingTempApprox?: boolean;
  // PHASE 8.2: physically-grounded serving temp from freezingCurve.ts
  // (reuses leightonTable.json, same data the FPDT calc already trusts).
  servingTempC?: number;
  // True when leightonTable.json had to be extrapolated past its real data
  // (current top: 75 g/100g water) to reach this figure — see the TODO at
  // the interpolation site in freezingCurve.ts.
  servingTempExtrapolated?: boolean;
  freezingCurve?: { tempC: number; frozenPct: number; extrapolated: boolean }[];
};

// Mirrors server/src/lib/core/recipeDiagnosis.ts's Diagnosis shape — the
// frontend can't import across the server/client build boundary (Phase 4),
// so this is redefined, not shared.
export interface Diagnosis {
  metric: string;
  status: 'low' | 'high' | 'ok';
  severity: 'ok' | 'warn' | 'critical';
  problem: string;
  why: string;
  fix: string;
}

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
  return {
    ...response.metrics,
    diagnosis: response.diagnosis,
    productProfile: response.productProfile,
    profileBands: response.profileBands,
    servingTempApprox: response.servingTempApprox,
    servingTempC: response.servingTempC,
    servingTempExtrapolated: response.servingTempExtrapolated,
    freezingCurve: response.freezingCurve,
  } as MetricsV2;
}

/** Convenience: the single most important diagnosis to show first. */
export function topDiagnosis(diagnosis?: Diagnosis[]): Diagnosis | null {
  if (!diagnosis || diagnosis.length === 0) return null;
  const order = { critical: 0, warn: 1, ok: 2 };
  return diagnosis.filter(d => d.severity !== 'ok').sort((a, b) => order[a.severity] - order[b.severity])[0] || null;
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
