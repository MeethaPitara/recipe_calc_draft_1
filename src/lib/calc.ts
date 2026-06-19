/**
 * Unified Calculation Module — Types Only
 * All computation happens on the backend via /api/calc/metrics
 * Re-exports types from calcApi.ts for backward compatibility
 */

// Re-export v2 types
export type { MetricsV2, CalcOptionsV2, ClassificationResult, ProductClass } from './calcApi';
export { calcMetricsV2 } from './calcApi';

// Legacy Metrics type for backward compatibility (used by UI components)
export type Metrics = {
  total_g: number;
  water_g: number; sugars_g: number; fat_g: number; msnf_g: number; other_g: number;
  water_pct: number; sugars_pct: number; fat_pct: number; msnf_pct: number; other_pct: number;
  ts_add_g: number; ts_mass_g: number;
  ts_add_pct: number; ts_mass_pct: number;
  sp: number;
  pac: number;
  protein_g?: number;
  protein_pct?: number;
  lactose_g?: number;
  lactose_pct?: number;
  totalSugars_g?: number;
  totalSugars_pct?: number;
  fpdt?: number;
  fpdse?: number;
  fpdsa?: number;
  pod_index?: number;
  warnings?: string[];
};

export type CalcOptions = { evaporation_pct?: number };
