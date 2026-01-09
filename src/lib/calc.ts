/**
 * Unified Calculation Module
 * Re-exports from calc.v2.ts for backward compatibility
 */

import { IngredientData } from '@/types/ingredients';
import { calcMetricsV2, MetricsV2, CalcOptionsV2 } from './calc.v2';

// Re-export v2 types
export type { MetricsV2, CalcOptionsV2 } from './calc.v2';
export { calcMetricsV2 } from './calc.v2';

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
// Enhanced Features (merged from calc.enhanced.ts)
// ============================================================================

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

/**
 * Classify product type based on composition
 */
export function classifyProduct(metrics: Metrics): ClassificationResult {
  const targets = {
    ice_cream: { ts: [37, 46], fat: [10, 20], sugar: [16, 22], msnf: [7, 12], sp: [12, 22], pac: [22, 28] },
    gelato_white: { ts: [32, 37], fat: [3, 7], sugar: [16, 19], msnf: [7, 12], sp: [12, 22], pac: [22, 28] },
    gelato_finished: { ts: [32, 40], fat: [6, 12], sugar: [18, 24], msnf: [7, 12], sp: [12, 22], pac: [22, 28] },
    fruit_gelato: { ts: [32, 42], fat: [3, 10], sugar: [22, 24], msnf: [3, 7], sp: [18, 26], pac: [25, 29] },
    sorbet: { ts: [22, 30], fat: [0, 0], sugar: [26, 31], msnf: [0, 0], sp: [20, 28], pac: [28, 33] },
    kulfi: { ts: [40, 50], fat: [8, 15], sugar: [18, 25], msnf: [12, 18], sp: [12, 22], pac: [22, 28] }
  };
  
  const scores: Record<ProductClass, { score: number; reasons: string[]; deltas: Record<string, number> }> = {} as any;
  
  for (const [type, bands] of Object.entries(targets)) {
    const reasons: string[] = [];
    const deltas: Record<string, number> = {};
    let totalDelta = 0;
    let matchCount = 0;
    
    const checks = [
      { key: 'ts', val: metrics.ts_add_pct, band: bands.ts, label: 'Total Solids' },
      { key: 'fat', val: metrics.fat_pct, band: bands.fat, label: 'Fat' },
      { key: 'sugar', val: metrics.sugars_pct, band: bands.sugar, label: 'Sugar' },
      { key: 'msnf', val: metrics.msnf_pct, band: bands.msnf, label: 'MSNF' },
      { key: 'sp', val: metrics.sp, band: bands.sp, label: 'SP' },
      { key: 'pac', val: metrics.pac, band: bands.pac, label: 'PAC' }
    ];
    
    for (const { key, val, band, label } of checks) {
      const [min, max] = band;
      if (val >= min && val <= max) {
        reasons.push(`${label} within target (${val.toFixed(1)})`);
        deltas[key] = 0;
        matchCount++;
      } else if (val < min) {
        const delta = min - val;
        reasons.push(`${label} low (${val.toFixed(1)} vs ${min.toFixed(1)})`);
        deltas[key] = -delta;
        totalDelta += delta;
      } else {
        const delta = val - max;
        reasons.push(`${label} high (${val.toFixed(1)} vs ${max.toFixed(1)})`);
        deltas[key] = delta;
        totalDelta += delta;
      }
    }
    
    scores[type as ProductClass] = { score: totalDelta - (matchCount * 2), reasons, deltas };
  }
  
  const entries = Object.entries(scores) as Array<[ProductClass, typeof scores[ProductClass]]>;
  entries.sort((a, b) => a[1].score - b[1].score);
  
  const [bestType, bestMatch] = entries[0];
  const matchCount = bestMatch.reasons.filter(r => r.includes('within')).length;
  const confidence: 'high' | 'medium' | 'low' = matchCount >= 5 ? 'high' : matchCount >= 3 ? 'medium' : 'low';
  
  return { productType: bestType, confidence, reasons: bestMatch.reasons, deltas: bestMatch.deltas };
}

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
 * Calculate optimal milk/cream volumes to achieve target fat
 */
export function calculateMilkCreamMix(
  milkFatPct: number,
  creamFatPct: number,
  targetFatPct: number,
  targetMass: number = 1000,
  evaporationPct: number = 8
): {
  milk_g: number;
  cream_g: number;
  water_loss_g: number;
  final_mass_g: number;
  actual_fat_pct: number;
  notes: string[];
} {
  const cream_g = ((targetFatPct - milkFatPct) / (creamFatPct - milkFatPct)) * targetMass;
  const milk_g = targetMass - cream_g;
  
  const milk_water = milk_g * 0.88;
  const cream_water = cream_g * 0.58;
  const total_water = milk_water + cream_water;
  const water_loss_g = total_water * (evaporationPct / 100);
  const final_mass_g = targetMass - water_loss_g;
  
  const total_fat_g = (milk_g * milkFatPct + cream_g * creamFatPct) / 100;
  const actual_fat_pct = (total_fat_g / final_mass_g) * 100;
  
  const notes: string[] = [];
  if (cream_g < 0 || milk_g < 0) notes.push('⚠️ Impossible to achieve target with given milk/cream.');
  if (evaporationPct > 0) notes.push(`💡 Evaporation will increase fat% from ${targetFatPct.toFixed(1)}% to ${actual_fat_pct.toFixed(1)}%`);
  if (water_loss_g > 50) notes.push(`💧 Significant water loss (${water_loss_g.toFixed(0)}g).`);
  
  return {
    milk_g: Math.max(0, milk_g),
    cream_g: Math.max(0, cream_g),
    water_loss_g,
    final_mass_g,
    actual_fat_pct,
    notes
  };
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

/**
 * DE (Dextrose Equivalent) effects reference
 */
export const DE_EFFECTS = {
  increase: [
    { property: 'Sweetness', effect: '↑ Increases', explanation: 'Higher DE = more simple sugars = sweeter' },
    { property: 'Anti-freeze Power (PAC)', effect: '↑ Increases', explanation: 'More monosaccharides lower freezing point' },
    { property: 'Anti-crystallization', effect: '↑ Increases', explanation: 'Prevents sugar crystal formation' },
    { property: 'Hygroscopicity', effect: '↑ Increases', explanation: 'Absorbs moisture from environment' },
    { property: 'Aroma', effect: '↑ Enhances', explanation: 'Volatile compounds more pronounced' },
    { property: 'Foaming', effect: '↑ Increases', explanation: 'Better air incorporation during churning' }
  ],
  decrease: [
    { property: 'Viscosity', effect: '↓ Decreases', explanation: 'Lower molecular weight = less thick' },
    { property: 'Body/Chewiness', effect: '↓ Decreases', explanation: 'Less structure from complex sugars' },
    { property: 'Freezing Point', effect: '↓ Lowers', explanation: 'More dissolved particles = lower FP' }
  ],
  reference: {
    'DE 15-19 (Maltodextrin)': 'Low sweetness, high viscosity, body builder',
    'DE 38-40': 'Balanced, good for structure',
    'DE 60-62': 'Standard glucose syrup, versatile',
    'DE 100 (Dextrose)': 'Maximum sweetness and anti-freeze'
  }
};
