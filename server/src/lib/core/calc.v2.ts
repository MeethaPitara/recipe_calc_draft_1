/**
 * Verified Gelato Science v2.1 Calculator
 * Implements: final-verified-gelato-guide_v2.1.pdf
 */

import { IngredientData } from '../../types/ingredients.js';
import leightonTable from './leightonTable.json';
import { adjustPACforAcids, AcidityAdjustment, FruitAcidityInput } from './fruit.v1.js';
import { predictOverrun, suggestServingTemp, OverrunPrediction, ServingTempRecommendation } from './serving.v1.js';
import type { Mode } from '../../types/mode.js';
import { resolveMode } from './mode.js';
import { safeNumber, guardResult, validateIngredientComposition } from './validation.js';
import { trace } from "../../utils/tracer";
import { PROFILES, SWEETENER_COEFFS, SUGAR_SPECTRUM, ProductId } from './scienceConfig.js';

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

  // P2 Science Features
  fruitAdjustments?: AcidityAdjustment;
  overrunPrediction?: OverrunPrediction;
  servingTemp?: ServingTempRecommendation;

  // Backwards compatibility for classification
  ts_add_pct?: number; // alias for ts_pct
  sp?: number; // alias for pod_index
  pac?: number; // alias for fpdt * 10 (approx)
};

export type CalcOptionsV2 = {
  evaporation_pct?: number;
  mode?: 'gelato' | 'ice_cream' | 'sorbet' | 'kulfi';
};

/**
 * The engine only receives a coarse mode, not the 9 fine ProductIds from
 * scienceConfig. This maps each mode to the profile whose bands drive the
 * engine's internal guardrails (PHASE 4.2). Precise per-profile diagnosis
 * happens in recipeDiagnosis.ts, which takes the explicit profile.
 */
const MODE_DEFAULT_PROFILE: Record<NonNullable<CalcOptionsV2['mode']>, ProductId> = {
  gelato: 'dairy_gelato',
  ice_cream: 'premium_ice_cream',
  sorbet: 'sorbet',
  kulfi: 'kulfi_basundi',
};

/**
 * Linear interpolation in Leighton table with clamping
 */
function leightonLookup(sucrosePer100gWater: number): { fpdse: number; clamped: boolean } {
  const data = leightonTable.data;
  const x = sucrosePer100gWater;
  trace('calc.v2.ts', 'leightonLookup', 'START', { sucrosePer100gWater: x });

  // Clamp to table bounds
  if (x <= data[0].sucrosePer100gWater) {
    return { fpdse: data[0].fpdse, clamped: x < data[0].sucrosePer100gWater };
  }
  if (x >= data[data.length - 1].sucrosePer100gWater) {
    return { fpdse: data[data.length - 1].fpdse, clamped: x > data[data.length - 1].sucrosePer100gWater };
  }

  // Linear interpolation
  for (let i = 0; i < data.length - 1; i++) {
    const p1 = data[i];
    const p2 = data[i + 1];
    if (x >= p1.sucrosePer100gWater && x <= p2.sucrosePer100gWater) {
      const t = (x - p1.sucrosePer100gWater) / (p2.sucrosePer100gWater - p1.sucrosePer100gWater);
      const fpdse = p1.fpdse + t * (p2.fpdse - p1.fpdse);
      return { fpdse, clamped: false };
    }
  }

  return { fpdse: data[data.length - 1].fpdse, clamped: true };
}

/**
 * Identify exact sweetener coefficients based on standard ingredient tags.
 * Coefficients come from scienceConfig.SWEETENER_COEFFS — the single source
 * of truth (resolves Brief A7's dextrose 1.75 vs 1.90 split).
 */
export function getSweetenerCoefficients(id: string, name: string): { sp: number; afp: number } | null {
  const normalizedStr = `${id} ${name}`.toLowerCase();

  if (normalizedStr.includes('maple')) return SWEETENER_COEFFS['maple_syrup'];
  if (normalizedStr.includes('dextrose')) return SWEETENER_COEFFS['dextrose'];
  if (normalizedStr.includes('fructose')) return SWEETENER_COEFFS['fructose'];
  if (normalizedStr.includes('invert')) return SWEETENER_COEFFS['invert'];
  if (normalizedStr.includes('honey')) return SWEETENER_COEFFS['honey'];
  if (normalizedStr.includes('agave')) return SWEETENER_COEFFS['agave'];
  if (normalizedStr.includes('trehalose')) return SWEETENER_COEFFS['trehalose'];
  if (normalizedStr.includes('maltodextrin')) return SWEETENER_COEFFS['maltodextrin'];

  if (normalizedStr.includes('glucose')) {
    const deMatch = normalizedStr.match(/de\s*(\d+)/i);
    const de = deMatch ? parseInt(deMatch[1]) : 0;

    if (normalizedStr.includes('dry') || (de >= 38 && de <= 40)) return SWEETENER_COEFFS['dry_glucose_38'];
    if ((de >= 42 && de <= 44) || normalizedStr.includes('42') || normalizedStr.includes('43')) return SWEETENER_COEFFS['glucose_syrup_42'];
    if (de >= 60 || normalizedStr.includes('60') || normalizedStr.includes('62')) return SWEETENER_COEFFS['glucose_syrup_60'];

    // Default to 42DE if not specified (Standard liquid glucose)
    return SWEETENER_COEFFS['glucose_syrup_42'];
  }

  // Explicit sucrose / table sugar
  if (normalizedStr.includes('sucrose') || normalizedStr === 'sugar' || normalizedStr.includes('caster sugar') || normalizedStr.includes('granulated sugar')) {
    return SWEETENER_COEFFS['sucrose'];
  }

  return null;
}

/**
 * Main v2.1 calculation function
 */
export function calcMetricsV2(
  rows: { ing: IngredientData; grams: number }[],
  opts: CalcOptionsV2 = {}
): MetricsV2 {
  trace('calc.v2.ts', 'calcMetricsV2', 'INPUT_RECEIVED', {
    rowCount: rows.length,
    rowsSample: rows.slice(0, 3).map(r => ({ name: r.ing.name, fat: r.ing.fat_pct, msnf: r.ing.msnf_pct, lactose: r.ing.lactose_pct, grams: r.grams }))
  });

  const warnings: string[] = [];

  // 0. Validate ingredients before calculation
  for (const { ing, grams } of rows) {
    if (grams <= 0) continue;
    const validation = validateIngredientComposition(ing);
    if (validation.nanValues?.length) {
      warnings.push(` "${ing.name}" has invalid data: ${validation.nanValues.join(', ')}`);
    }
    if (validation.totalComposition && !validation.nanValues?.length) {
      warnings.push(` "${ing.name}": ${validation.totalComposition}`);
    }
  }
  trace('calc.v2.ts', 'calcMetricsV2', 'VALIDATION_DONE', { warningsCount: warnings.length });

  // 1. Calculate batch totals with NaN guards
  const total_g = guardResult(rows.reduce((a, r) => a + safeNumber(r.grams), 0), 0, 'total_g');
  trace('calc.v2.ts', 'calcMetricsV2', 'TOTAL_G_CALC', { total_g });

  let water_g = 0, nonLactoseSugars_g = 0, fat_g = 0, msnf_g = 0, other_g = 0, lactose_g = 0;
  let protein_explicit_g = 0, msnf_no_protein_g = 0;
  for (const { ing, grams } of rows) {
    const g = safeNumber(grams);

    // Protect against NULL and NaN values
    const water_pct = safeNumber(ing.water_pct);
    const sugars_pct = safeNumber(ing.sugars_pct);
    const fat_pct = safeNumber(ing.fat_pct);
    const msnf_pct = safeNumber(ing.msnf_pct);
    const other_pct = safeNumber(ing.other_solids_pct);
    const lactose_pct = safeNumber(ing.lactose_pct);

    water_g += g * water_pct / 100;
    nonLactoseSugars_g += g * sugars_pct / 100;
    fat_g += g * fat_pct / 100;
    msnf_g += g * msnf_pct / 100;
    other_g += g * other_pct / 100;
    lactose_g += g * lactose_pct / 100;

    // Track protein: use explicit protein_pct if the ingredient declares it,
    // otherwise accumulate MSNF for the 0.36 fallback (SMP-derived assumption)
    if (typeof ing.protein_pct === 'number' && !isNaN(ing.protein_pct) && ing.protein_pct > 0) {
      protein_explicit_g += g * ing.protein_pct / 100;
    } else {
      msnf_no_protein_g += g * msnf_pct / 100;
    }
  }

  // Guard accumulated values
  water_g = guardResult(water_g, 0, 'water_g');
  nonLactoseSugars_g = guardResult(nonLactoseSugars_g, 0, 'nonLactoseSugars_g');
  fat_g = guardResult(fat_g, 0, 'fat_g');
  msnf_g = guardResult(msnf_g, 0, 'msnf_g');
  other_g = guardResult(other_g, 0, 'other_g');
  lactose_g = guardResult(lactose_g, 0, 'lactose_g');

  // 2. Apply evaporation
  const evap = Math.max(0, Math.min(100, opts.evaporation_pct ?? 0));
  const water_after_evap_g = water_g * (1 - evap / 100);
  const water_loss_g = water_g - water_after_evap_g;
  const total_after_evap_g = total_g - water_loss_g;

  // 3. Protein — use explicit protein_pct per ingredient where available;
  // fall back to 0.36 × MSNF for ingredients without declared protein data.
  const protein_g = protein_explicit_g + msnf_no_protein_g * 0.36;
  // lactose_g calculated above from explicit ingredients

  // 4. Total sugars (incl. lactose) - for internal physics only
  const totalSugarsWithLactose_g = nonLactoseSugars_g + lactose_g;

  // User Requested: Display "Added Sugars" as the primary "Total Sugars" metric
  const totalSugars_g = nonLactoseSugars_g;

  // 5. Total solids
  const ts_g = fat_g + msnf_g + nonLactoseSugars_g + other_g;

  // 6. Percentages
  const pct = (x: number) => total_after_evap_g > 0 ? (x / total_after_evap_g) * 100 : 0;

  const water_pct = pct(water_after_evap_g);
  const nonLactoseSugars_pct = pct(nonLactoseSugars_g);
  const fat_pct = pct(fat_g);
  const msnf_pct = pct(msnf_g);
  const other_pct = pct(other_g);
  const protein_pct = pct(protein_g);
  const lactose_pct = pct(lactose_g);
  const totalSugars_pct = pct(totalSugars_g);
  const ts_pct = pct(ts_g);

  trace('calc.v2.ts', 'calcMetricsV2', 'BASIC_METRICS_CALC', {
    water_pct, fat_pct, msnf_pct, totalSugars_pct, ts_pct, lactose_g, lactose_pct
  });

  // 7. Calculate Sucrose Equivalents (SE)
  let se_g = 0;

  for (const { ing, grams } of rows) {
    const g = grams || 0;
    const sug_g = g * (ing.sugars_pct || 0) / 100;

    if (g <= 0) continue;

    // Handle fruit with sugar split (using dry residue AFP multipliers for individual extracted sugars)
    if (ing.category === 'fruit' && ing.sugar_split) {
      const s = ing.sugar_split;
      const norm = (s.glucose ?? 0) + (s.fructose ?? 0) + (s.sucrose ?? 0) || 100;
      const g_glu = sug_g * ((s.glucose ?? 0) / norm);
      const g_fru = sug_g * ((s.fructose ?? 0) / norm);
      const g_suc = sug_g * ((s.sucrose ?? 0) / norm);

      // Fruit glucose is chemically dextrose — use the same AFP coefficient
      // (Brief A7: was inconsistently 1.90 here vs 1.75 for dextrose elsewhere).
      se_g += g_suc * SWEETENER_COEFFS.sucrose.afp + g_glu * SWEETENER_COEFFS.dextrose.afp + g_fru * SWEETENER_COEFFS.fructose.afp;
      continue;
    }

    const id = (ing.id || '').toLowerCase();
    const name = (ing.name || '').toLowerCase();

    // Attempt lookup for recognized sweeteners (so we can apply coefficient against TOTAL grams, not just sugars)
    const coeffs = getSweetenerCoefficients(id, name);

    if (coeffs && (ing.category === 'sugar' || ing.category === 'sweetener' || sug_g > (g * 0.4) || name.includes('maltodextrin'))) {
      // If it's the pure sweetener itself, multiply its total weighed mass by the total AFP coefficient
      se_g += g * coeffs.afp;
    } else if (sug_g > 0) {
      // For general ingredients (like chocolate, fruit without split, etc.), assume the resident sugar 
      // behaves like sucrose if no specific data is available
      se_g += sug_g * 1.00;
    }
  }

  // Add lactose contribution to SE (using explicit lactose grams)
  se_g += lactose_g;
  trace('calc.v2.ts', 'calcMetricsV2', 'SE_CALC_DONE', { se_g, lactose_contribution_g: lactose_g });

  // 8. Freezing Point Depression
  const sucrosePer100gWater = water_after_evap_g > 0 ? (se_g / water_after_evap_g) * 100 : 0;
  const leightonResult = leightonLookup(sucrosePer100gWater);
  const fpdse = leightonResult.fpdse;

  if (leightonResult.clamped) {
    warnings.push(` Leighton table clamped: ${sucrosePer100gWater.toFixed(1)} g sucrose/100g water is outside normal range`);
  }

  // Coefficient is salts-only (0.19). Lactose FPD contribution is already captured
  // via se_g above — using 2.37 (lumped MSNF) would double-count lactose.
  const fpdsa = water_after_evap_g > 0 ? (msnf_g * 0.19) / water_after_evap_g : 0;
  const fpdt = fpdse + fpdsa;

  // 9. AFP Index (Total anti-freezing power per 100g of mix)
  const afp_index = total_after_evap_g > 0 ? (se_g / total_after_evap_g) * 100 : 0;

  trace('calc.v2.ts', 'calcMetricsV2', 'FPDT_CALC', { sucrosePer100gWater, fpdse, fpdsa, fpdt, afp_index, clamped: leightonResult.clamped });

  // 9. POD (normalized sweetness index per 100g total sugars)
  let pod_numerator = 0;

  for (const { ing, grams } of rows) {
    const g = grams || 0;
    const sug_g = g * (ing.sugars_pct || 0) / 100;

    if (g <= 0) continue;

    if (ing.category === 'fruit' && ing.sugar_split) {
      const s = ing.sugar_split;
      const norm = (s.glucose ?? 0) + (s.fructose ?? 0) + (s.sucrose ?? 0) || 100;
      const g_glu = sug_g * ((s.glucose ?? 0) / norm);
      const g_fru = sug_g * ((s.fructose ?? 0) / norm);
      const g_suc = sug_g * ((s.sucrose ?? 0) / norm);

      // Using Carpigiani Dry Residue SP equivalents * 100 for proper weighting
      pod_numerator += 70 * g_glu + 170 * g_fru + 100 * g_suc;
      continue;
    }

    const id = (ing.id || '').toLowerCase();
    const name = (ing.name || '').toLowerCase();

    // Attempt lookup for recognized sweeteners (SP * 100 to map onto the 100-baseline scale)
    const coeffs = getSweetenerCoefficients(id, name);

    if (coeffs && (ing.category === 'sugar' || ing.category === 'sweetener' || sug_g > (g * 0.4) || name.includes('maltodextrin'))) {
      pod_numerator += g * (coeffs.sp * 100);
    } else if (sug_g > 0) {
      pod_numerator += 100 * sug_g; // Default: sucrose Baseline
    }
  }

  // Add lactose contribution to POD
  pod_numerator += 16 * lactose_g;

  // POD index — relative sweetness, sucrose baseline = 100. Display only.
  const pod_index = totalSugarsWithLactose_g > 0 ? pod_numerator / totalSugarsWithLactose_g : 100;

  // SP% — Carpigiani sweetness as % of recipe weight. Used for classification.
  // pod_numerator = Σ(grams_i × sp_coeff_i × 100), so dividing by total gives sp%.
  const sp_pct = total_after_evap_g > 0 ? pod_numerator / total_after_evap_g : 0;

  trace('calc.v2.ts', 'calcMetricsV2', 'POD_CALC', { pod_numerator, pod_index, sp_pct });

  // 10. P2 Science: Fruit Acidity Analysis
  let fruitAdjustments: AcidityAdjustment | undefined;

  for (const { ing, grams } of rows) {
    if (ing.category === 'fruit' && ing.acidity_citric_pct && ing.brix_estimate) {
      const fruitInput: FruitAcidityInput = {
        acidityPct: ing.acidity_citric_pct,
        brixPct: ing.brix_estimate,
        fruitGrams: grams,
        totalMixGrams: total_after_evap_g
      };

      const adjustment = adjustPACforAcids(fruitInput);

      // Add fruit acidity notes to warnings
      adjustment.notes.forEach(note => {
        warnings.push(` ${ing.name}: ${note}`);
      });
      trace('calc.v2.ts', 'calcMetricsV2', 'FRUIT_ACIDITY_ADJUSTMENT', { ingredient: ing.name, adjustment });

      // Store adjustment for UI display (take first/most significant fruit)
      if (!fruitAdjustments) {
        fruitAdjustments = adjustment;
      }

      break; // Process only first fruit for now (can extend to multi-fruit later)
    }
  }

  // 11. Validation warnings
  const mode = opts.mode || 'gelato';

  // PHASE 2: Context-aware MSNF/Stabilizer guardrails
  const hasChocolate = rows.some(r =>
    r.ing.name.toLowerCase().includes('chocolate') ||
    r.ing.name.toLowerCase().includes('cocoa') ||
    r.ing.name.toLowerCase().includes('cacao')
  );

  const hasNutsOrEggs = rows.some(r =>
    (r.ing.category === 'other' && (
      r.ing.name.toLowerCase().includes('nut') ||
      r.ing.name.toLowerCase().includes('almond') ||
      r.ing.name.toLowerCase().includes('pistachio') ||
      r.ing.name.toLowerCase().includes('hazelnut')
    )) ||
    r.ing.name.toLowerCase().includes('egg')
  );

  trace('calc.v2.ts', 'calcMetricsV2', 'CONTEXT_CHECK', { hasChocolate, hasNutsOrEggs });

  // PHASE 4.2: guardrails now read entirely from scienceConfig via the
  // mode's default profile (the engine only knows the coarse mode, not the
  // 9 fine ProductIds — precise per-profile diagnosis lives in
  // recipeDiagnosis.ts, which takes the explicit profile).
  const profile = PROFILES[MODE_DEFAULT_PROFILE[mode]];

  if (fat_pct < profile.fat[0] || fat_pct > profile.fat[1]) {
    warnings.push(`Fat ${fat_pct.toFixed(1)}% outside ${profile.label} range ${profile.fat[0]}-${profile.fat[1]}%`);
  }
  if (msnf_pct < profile.msnf[0] || msnf_pct > profile.msnf[1]) {
    warnings.push(` MSNF ${msnf_pct.toFixed(1)}% outside ${profile.label} range ${profile.msnf[0]}-${profile.msnf[1]}%`);
  }
  // PHASE 4.5 (Brief A6): validate added sugars only against the addedSugar
  // band — not the lactose-inclusive total against a band meant for added
  // sugar. Same number (nonLactoseSugars_pct) is shown in the headline.
  if (nonLactoseSugars_pct < profile.addedSugar[0] || nonLactoseSugars_pct > profile.addedSugar[1]) {
    warnings.push(`Added sugars ${nonLactoseSugars_pct.toFixed(1)}% outside ${profile.label} range ${profile.addedSugar[0]}-${profile.addedSugar[1]}%`);
  }
  if (ts_pct < profile.totalSolids[0] || ts_pct > profile.totalSolids[1]) {
    warnings.push(`Total solids ${ts_pct.toFixed(1)}% outside ${profile.label} range ${profile.totalSolids[0]}-${profile.totalSolids[1]}%`);
  }
  if (fpdt < profile.fpdt[0] || fpdt > profile.fpdt[1]) {
    warnings.push(`FPDT ${fpdt.toFixed(2)}°C outside ${profile.label} target ${profile.fpdt[0]}-${profile.fpdt[1]}°C`);
  }
  if (mode === 'kulfi' && (protein_pct < 6 || protein_pct > 9)) {
    warnings.push(`Protein ${protein_pct.toFixed(1)}% outside kulfi range 6-9%`);
  }

  // PHASE 4: Sugar Spectrum Policy
  let disaccharides_g = lactose_g; // Start with lactose
  let monosaccharides_g = 0;
  let polysaccharides_g = 0;

  for (const { ing, grams } of rows) {
    const sug_g = grams * (ing.sugars_pct || 0) / 100;
    if (sug_g <= 0) continue;

    if (ing.category === 'fruit' && ing.sugar_split) {
      const s = ing.sugar_split;
      const norm = (s.glucose ?? 0) + (s.fructose ?? 0) + (s.sucrose ?? 0) || 100;
      monosaccharides_g += sug_g * ((s.glucose ?? 0) + (s.fructose ?? 0)) / norm;
      disaccharides_g += sug_g * ((s.sucrose ?? 0) / norm);
      continue;
    }

    const s = `${ing.id || ''} ${ing.name || ''}`.toLowerCase();
    if (s.includes('dextrose') || s.includes('fructose') || s.includes('invert')) {
      monosaccharides_g += sug_g;
    } else if (s.includes('honey') || s.includes('agave')) {
      // ~80% monosaccharide composition
      monosaccharides_g += sug_g * 0.80;
      disaccharides_g += sug_g * 0.20;
    } else if (s.includes('glucose') && !s.includes('syrup')) {
      monosaccharides_g += sug_g;
    } else if (s.includes('maltodextrin') || s.includes('glucose syrup')) {
      polysaccharides_g += sug_g;
    } else {
      disaccharides_g += sug_g; // sucrose, trehalose, maple syrup, default
    }
  }

  if (totalSugars_g > 0) {
    const disaccharides_pct = (disaccharides_g / totalSugars_g) * 100;
    const monosaccharides_pct = (monosaccharides_g / totalSugars_g) * 100;
    const polysaccharides_pct = (polysaccharides_g / totalSugars_g) * 100;

    if (disaccharides_pct < SUGAR_SPECTRUM.diMinPct) {
      warnings.push(` Sugar spectrum: Disaccharides ${disaccharides_pct.toFixed(1)}% below target ${SUGAR_SPECTRUM.diMinPct}-100%`);
    }
    if (monosaccharides_pct > SUGAR_SPECTRUM.monoMaxPct) {
      warnings.push(` Sugar spectrum: Monosaccharides ${monosaccharides_pct.toFixed(1)}% exceeds target 0-${SUGAR_SPECTRUM.monoMaxPct}%`);
    }
    if (polysaccharides_pct > SUGAR_SPECTRUM.polyMaxPct) {
      warnings.push(` Sugar spectrum: Polysaccharides ${polysaccharides_pct.toFixed(1)}% exceeds target 0-${SUGAR_SPECTRUM.polyMaxPct}%`);
    }
  }

  // PHASE 4.2: SP/AFP Target Validation — from the same profile as above.
  if (sp_pct < profile.sp[0] || sp_pct > profile.sp[1]) {
    warnings.push(` SP ${sp_pct.toFixed(1)}% outside ${profile.label} target ${profile.sp[0]}-${profile.sp[1]}%`);
  }
  if (afp_index < profile.afp[0] || afp_index > profile.afp[1]) {
    warnings.push(` AFP ${afp_index.toFixed(1)}% outside ${profile.label} target ${profile.afp[0]}-${profile.afp[1]}%`);
  }

  // Defect prevention flags
  if (protein_pct >= 5) {
    warnings.push(` Protein ≥5% (${protein_pct.toFixed(1)}%) → risk of chewiness/sandiness. Consider lowering MSNF.`);
  }
  if (lactose_pct >= 11) {
    warnings.push(` Lactose ≥11% (${lactose_pct.toFixed(1)}%) → risk of crystallization. Shift sugars to glucose syrup or reduce MSNF.`);
  }

  // PHASE 4.3: the two FPDT troubleshooting strings ("Too hard"/"Too soft")
  // are removed — recipeDiagnosis.ts now owns texture messaging.

  // 12. P2 Science: Overrun Prediction
  const overrunPrediction = predictOverrun({
    fatPct: fat_pct,
    tsPct: ts_pct,
    stabilizerPct: 0.5, // Assume default stabilizer (can be refined)
    proteinPct: protein_pct,
    processType: 'batch',
    agingTimeHours: 4
  });

  // 13. P2 Science: Serving Temperature Guidance
  const servingTemp = suggestServingTemp({
    fpdtC: fpdt,
    fatPct: fat_pct,
    sugarsPct: totalSugars_pct,
    overrunPct: overrunPrediction.estimatedPct,
    productType: mode === 'gelato' ? 'gelato' : mode === 'ice_cream' ? 'ice_cream' : 'kulfi'
  });

  return {
    total_g: total_after_evap_g,
    water_g: water_after_evap_g,
    nonLactoseSugars_g,
    fat_g,
    msnf_g,
    other_g,

    water_pct,
    nonLactoseSugars_pct,
    fat_pct,
    msnf_pct,
    other_pct,

    protein_g,
    protein_pct,
    lactose_g,
    lactose_pct,

    totalSugars_g,
    totalSugars_pct,

    ts_g,
    ts_pct,

    se_g,
    sucrosePer100gWater,
    fpdse,
    fpdsa,
    fpdt,
    afp_index,

    pod_index,
    sp_pct,

    totalSugarsTotal_g: totalSugarsWithLactose_g,
    totalSugarsTotal_pct: pct(totalSugarsWithLactose_g),

    warnings,
    clampedLeighton: leightonResult.clamped,

    // P2 Science Features
    fruitAdjustments,
    overrunPrediction,
    servingTemp,

    // Backwards compatibility assignments
    ts_add_pct: ts_pct,
    sp: sp_pct,       // sp now correctly = Carpigiani SP% (not pod_index)
    pac: afp_index,   // pac now correctly = afp_index (not fpdt*10)
  };
}

// ============================================================================
// Enhanced Features (migrated from calc.ts for centralization)
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
export function classifyProduct(metrics: MetricsV2): ClassificationResult {
  const targets = {
    ice_cream:      { ts: [37, 46], fat: [10, 20], sugar: [16, 22], msnf: [7, 12],  sp: [12, 22], afp: [22, 28] },
    gelato_white:   { ts: [32, 37], fat: [3, 7],   sugar: [16, 19], msnf: [7, 12],  sp: [12, 22], afp: [22, 28] },
    gelato_finished:{ ts: [32, 40], fat: [6, 12],  sugar: [18, 24], msnf: [7, 12],  sp: [12, 22], afp: [22, 28] },
    fruit_gelato:   { ts: [32, 42], fat: [3, 10],  sugar: [22, 24], msnf: [3, 7],   sp: [18, 26], afp: [25, 29] },
    sorbet:         { ts: [22, 30], fat: [0, 0],   sugar: [26, 31], msnf: [0, 0],   sp: [20, 28], afp: [28, 33] },
    kulfi:          { ts: [40, 50], fat: [8, 15],  sugar: [18, 25], msnf: [12, 18], sp: [12, 22], afp: [22, 28] }
  };

  const scores: Record<ProductClass, { score: number; reasons: string[]; deltas: Record<string, number> }> = {} as any;
  trace('calc.v2.ts', 'classifyProduct', 'START', { metrics: { ts: metrics.ts_pct, fat: metrics.fat_pct, sugar: metrics.nonLactoseSugars_pct } });

  for (const [type, bands] of Object.entries(targets)) {
    const reasons: string[] = [];
    const deltas: Record<string, number> = {};
    let totalDelta = 0;
    let matchCount = 0;

    // Logic adapted for v2 metrics
    const checks = [
      { key: 'ts', val: metrics.ts_pct, band: bands.ts, label: 'Total Solids' },
      { key: 'fat', val: metrics.fat_pct, band: bands.fat, label: 'Fat' },
      { key: 'sugar', val: metrics.nonLactoseSugars_pct, band: bands.sugar, label: 'Sugar' }, // Note: check logic on sugar vs total sugars
      { key: 'msnf', val: metrics.msnf_pct, band: bands.msnf, label: 'MSNF' },
      { key: 'sp', val: metrics.sp_pct, band: bands.sp, label: 'SP' },
      { key: 'afp', val: metrics.afp_index, band: bands.afp, label: 'AFP' }
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

  trace('calc.v2.ts', 'classifyProduct', 'RESULT', { productType: bestType, confidence, score: bestMatch.score });

  return { productType: bestType, confidence, reasons: bestMatch.reasons, deltas: bestMatch.deltas };
}

/**
 * Calculate optimal milk/cream volumes to achieve target fat
 */
export function calculateMilkCreamMix(
  milkFatPct: number,
  creamFatPct: number,
  targetFatPct: number,
  targetMass: number = 1000,
  evaporationPct: number = 8,
  targetIsPostEvap: boolean = true
): {
  milk_g: number;
  cream_g: number;
  water_loss_g: number;
  final_mass_g: number;
  actual_fat_pct: number;
  notes: string[];
} {
  trace('calc.v2.ts', 'calculateMilkCreamMix', 'START', { milkFatPct, creamFatPct, targetFatPct, targetMass, targetIsPostEvap });

  // If the target is post-evap fat%, back-solve to a lower pre-evap target so the
  // result after water loss lands at the requested percentage.
  let effectiveTarget = targetFatPct;
  if (targetIsPostEvap && evaporationPct > 0) {
    const creamFrac = (targetFatPct - milkFatPct) / (creamFatPct - milkFatPct);
    const avgWaterFrac = creamFrac * 0.58 + (1 - creamFrac) * 0.88;
    const massLossFrac = avgWaterFrac * (evaporationPct / 100);
    effectiveTarget = targetFatPct * (1 - massLossFrac);
  }

  const cream_g = ((effectiveTarget - milkFatPct) / (creamFatPct - milkFatPct)) * targetMass;
  const milk_g = targetMass - cream_g;

  const milk_water = milk_g * 0.88;
  const cream_water = cream_g * 0.58;
  const total_water = milk_water + cream_water;
  const water_loss_g = total_water * (evaporationPct / 100);
  const final_mass_g = targetMass - water_loss_g;

  const total_fat_g = (milk_g * milkFatPct + cream_g * creamFatPct) / 100;
  const actual_fat_pct = (total_fat_g / final_mass_g) * 100;

  const notes: string[] = [];
  if (cream_g < 0 || milk_g < 0) notes.push(' Impossible to achieve target with given milk/cream.');
  if (evaporationPct > 0) notes.push(` Evaporation will increase fat% from ${targetFatPct.toFixed(1)}% to ${actual_fat_pct.toFixed(1)}%`);
  if (water_loss_g > 50) notes.push(` Significant water loss (${water_loss_g.toFixed(0)}g).`);

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
