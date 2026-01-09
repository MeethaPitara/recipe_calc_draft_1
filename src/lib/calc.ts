/**
 * Unified Calculation Module
 * Re-exports from calc.v2.ts for backward compatibility
 */

import { IngredientData } from '@/types/ingredients';
import { calcMetricsV2, MetricsV2, CalcOptionsV2 } from './calc.v2';

// Re-export v2 types
// Re-export v2 types
export type { MetricsV2, CalcOptionsV2, ClassificationResult, ProductClass } from './calc.v2';
export { calcMetricsV2, classifyProduct, calculateMilkCreamMix, DE_EFFECTS } from './calc.v2';

// Legacy Metrics type for backward compatibility
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

/**
 * Legacy calculation function that wraps v2.1 calculations
 */
export function calcMetrics(
  rows: { ing: IngredientData; grams: number }[],
  opts: CalcOptions = {}
): Metrics {
  const v2 = calcMetricsV2(rows, opts);

  return {
    total_g: v2.total_g,
    water_g: v2.water_g,
    sugars_g: v2.nonLactoseSugars_g,
    fat_g: v2.fat_g,
    msnf_g: v2.msnf_g,
    other_g: v2.other_g,
    water_pct: v2.water_pct,
    sugars_pct: v2.nonLactoseSugars_pct,
    fat_pct: v2.fat_pct,
    msnf_pct: v2.msnf_pct,
    other_pct: v2.other_pct,
    ts_add_g: v2.ts_g,
    ts_mass_g: v2.ts_g,
    ts_add_pct: v2.ts_pct,
    ts_mass_pct: v2.ts_pct,
    sp: v2.pod_index,
    pac: v2.fpdt * 10,
    protein_g: v2.protein_g,
    protein_pct: v2.protein_pct,
    lactose_g: v2.lactose_g,
    lactose_pct: v2.lactose_pct,
    totalSugars_g: v2.totalSugars_g,
    totalSugars_pct: v2.totalSugars_pct,
    fpdt: v2.fpdt,
    fpdse: v2.fpdse,
    fpdsa: v2.fpdsa,
    pod_index: v2.pod_index,
    warnings: v2.warnings
  };
}

// ============================================================================


/**
 * Generate warnings and suggestions based on metrics
 */
export function generateWarnings(metrics: Metrics, productType?: ProductClass): string[] {
  const warnings: string[] = [];

  if (metrics.pac > 33) warnings.push('⚠️ Very high PAC - mix will be too soft. Reduce dextrose/fructose.');
  else if (metrics.pac < 20) warnings.push('⚠️ Low PAC - mix may freeze too hard. Add dextrose or increase sugars.');

  if (metrics.sp > 28) warnings.push('⚠️ Very high sweetness. Consider replacing some sucrose with maltodextrin.');
  else if (metrics.sp < 10) warnings.push('⚠️ Low sweetness. Check if this is intentional.');

  if (productType !== 'sorbet' && metrics.msnf_pct < 5) {
    warnings.push('⚠️ Low MSNF. Add SMP 0.3-0.5% to improve texture.');
  }

  if (metrics.ts_add_pct < 30) warnings.push('⚠️ Very low total solids. Product may be icy.');
  else if (metrics.ts_add_pct > 46) warnings.push('⚠️ Very high total solids. Product may be too dense.');

  if (productType === 'gelato_white' && metrics.fat_pct < 3) {
    warnings.push('⚠️ Fat too low for gelato base. Increase cream or use WMP.');
  }

  return warnings;
}


/**
 * Sugar spectrum balancer - creates 3-sugar blend
 */
export function balanceSugarSpectrum(
  totalSugarGrams: number,
  ratios: { sucrose: number; dextrose: number; glucose: number } = { sucrose: 70, dextrose: 10, glucose: 20 }
): {
  sucrose_g: number;
  dextrose_g: number;
  glucose_g: number;
  expected_sp: number;
  expected_pac: number;
} {
  const total = ratios.sucrose + ratios.dextrose + ratios.glucose || 100;
  const sucrose_g = (totalSugarGrams * ratios.sucrose) / total;
  const dextrose_g = (totalSugarGrams * ratios.dextrose) / total;
  const glucose_g = (totalSugarGrams * ratios.glucose) / total;

  const coeffs = {
    sucrose: { sp: 1.00, pac: 1.00 },
    dextrose: { sp: 0.74, pac: 1.90 },
    glucose_de60: { sp: 0.50, pac: 1.18 }
  };

  const expected_sp =
    (sucrose_g / totalSugarGrams) * coeffs.sucrose.sp * 100 +
    (dextrose_g / totalSugarGrams) * coeffs.dextrose.sp * 100 +
    (glucose_g / totalSugarGrams) * coeffs.glucose_de60.sp * 100;

  const expected_pac =
    (sucrose_g / totalSugarGrams) * coeffs.sucrose.pac * 100 +
    (dextrose_g / totalSugarGrams) * coeffs.dextrose.pac * 100 +
    (glucose_g / totalSugarGrams) * coeffs.glucose_de60.pac * 100;

  return { sucrose_g, dextrose_g, glucose_g, expected_sp, expected_pac };
}

