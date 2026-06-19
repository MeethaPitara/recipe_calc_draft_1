/**
 * scienceConfig.ts — SINGLE SOURCE OF TRUTH for product science targets.
 * ----------------------------------------------------------------------
 * Every band, threshold and serving-temperature target the app uses MUST come
 * from this file. No UI component, validator, optimizer or service may hardcode
 * its own ranges (see Engineering Brief v2, Item 5 + A4/A5).
 *
 * CONVENTIONS (settle once, used everywhere):
 *   FPDT is a POSITIVE number = total freezing-point depression in °C.
 *   LOW FPDT  = HARD / icy   (less anti-freeze, more ice at serving temp)
 *   HIGH FPDT = SOFT / fast-melting (more anti-freeze, less ice)
 *   SP%  = Carpigiani sweetening power as % of mix weight (sucrose = baseline).
 *   AFP% = anti-freezing power as % of mix weight (sucrose-equivalents / total).
 *   addedSugar = sucrose-type added sugars only (excludes lactose).
 *   totalSugar = added sugars + lactose (use THIS band against the engine's
 *                lactose-inclusive figure — see Brief A6, the display/validate fix).
 *
 * Bands are seeded from: the Carpigiani Gelato University norms, the values
 * currently scattered across calc.v2.ts / productConstraints.ts / classifyProduct,
 * and Meetha Pitara's own architecture (kulfi = high-MSNF/firm, mithai = high-TS).
 * They are STARTING POINTS. Refine each band from real trial data over time.
 */

export type Band = [number, number]; // [min, max]

export interface ProductProfile {
  id: ProductId;
  label: string;
  /** which engine 'mode' this maps to for FPD math */
  mode: 'gelato' | 'ice_cream' | 'sorbet' | 'kulfi';

  fat: Band;            // % of mix
  msnf: Band;           // % of mix
  addedSugar: Band;     // % added (non-lactose) sugars
  totalSugar: Band;     // % total sugars incl. lactose  (validate against this)
  totalSolids: Band;    // %
  sp: Band;             // SP%  (sweetening power as % weight)
  afp: Band;            // AFP% (anti-freeze power as % weight)
  fpdt: Band;           // °C depression (positive; low=hard, high=soft)
  stabilizer: Band;     // % of mix

  /** serving-temperature window °C (negative). Used by the freezing-curve check. */
  servingTempC: Band;
  /** fraction of water that should be frozen at serving temp (0–1). */
  targetFrozenFraction: number;

  lactoseRiskMaxPct: number; // crystallisation risk above this
  proteinRiskMaxPct: number; // chewiness/sandiness risk above this

  notes: string;
}

export type ProductId =
  | 'gelato_white'
  | 'dairy_gelato'
  | 'chocolate_gelato'
  | 'nut_gelato'
  | 'fruit_gelato'
  | 'sorbet'
  | 'kulfi_basundi'
  | 'premium_ice_cream'
  | 'mithai_gelato';

export const PROFILES: Record<ProductId, ProductProfile> = {
  gelato_white: {
    id: 'gelato_white', label: 'White Gelato Base', mode: 'gelato',
    fat: [3, 7], msnf: [8, 12], addedSugar: [16, 19], totalSugar: [18, 22],
    totalSolids: [34, 40], sp: [12, 18], afp: [24, 28], fpdt: [2.6, 3.2],
    stabilizer: [0.3, 0.5], servingTempC: [-13, -11], targetFrozenFraction: 0.68,
    lactoseRiskMaxPct: 9.4, proteinRiskMaxPct: 5.0,
    notes: 'Neutral carrier base. Keep AFP mid-band so flavour pastes can push it without going soft.',
  },
  dairy_gelato: {
    id: 'dairy_gelato', label: 'Finished Dairy Gelato', mode: 'gelato',
    fat: [6, 12], msnf: [7, 11], addedSugar: [18, 22], totalSugar: [20, 24],
    totalSolids: [37, 44], sp: [14, 20], afp: [24, 28], fpdt: [2.6, 3.4],
    stabilizer: [0.3, 0.5], servingTempC: [-13, -11], targetFrozenFraction: 0.68,
    lactoseRiskMaxPct: 9.4, proteinRiskMaxPct: 5.0,
    notes: 'Standard finished gelato after paste integration.',
  },
  chocolate_gelato: {
    id: 'chocolate_gelato', label: 'Chocolate Gelato', mode: 'gelato',
    fat: [6, 10], msnf: [7, 9], addedSugar: [20, 24], totalSugar: [22, 26],
    totalSolids: [38, 46], sp: [16, 22], afp: [25, 29], fpdt: [2.7, 3.5],
    stabilizer: [0.3, 0.5], servingTempC: [-13, -11], targetFrozenFraction: 0.68,
    lactoseRiskMaxPct: 9.0, proteinRiskMaxPct: 5.0,
    notes: 'Cocoa solids add other-solids + bitterness; MSNF runs lower to make room.',
  },
  nut_gelato: {
    id: 'nut_gelato', label: 'Nut Gelato', mode: 'gelato',
    fat: [8, 14], msnf: [8, 10], addedSugar: [17, 21], totalSugar: [19, 23],
    totalSolids: [38, 46], sp: [13, 19], afp: [24, 28], fpdt: [2.6, 3.4],
    stabilizer: [0.3, 0.5], servingTempC: [-13, -11], targetFrozenFraction: 0.68,
    lactoseRiskMaxPct: 9.0, proteinRiskMaxPct: 5.5,
    notes: 'Nut paste fat is part of the fat phase; characterise it before locking.',
  },
  fruit_gelato: {
    id: 'fruit_gelato', label: 'Fruit Gelato', mode: 'gelato',
    fat: [3, 8], msnf: [4, 8], addedSugar: [20, 24], totalSugar: [22, 26],
    totalSolids: [34, 42], sp: [18, 24], afp: [26, 30], fpdt: [3.2, 4.2],
    stabilizer: [0.3, 0.6], servingTempC: [-14, -12], targetFrozenFraction: 0.66,
    lactoseRiskMaxPct: 8.0, proteinRiskMaxPct: 4.5,
    notes: 'Fruit acids raise AFP; expect higher FPDT / softer set.',
  },
  sorbet: {
    id: 'sorbet', label: 'Sorbet', mode: 'sorbet',
    fat: [0, 1], msnf: [0, 0], addedSugar: [24, 30], totalSugar: [26, 31],
    totalSolids: [28, 34], sp: [22, 28], afp: [28, 33], fpdt: [3.6, 4.6],
    stabilizer: [0.3, 0.6], servingTempC: [-15, -13], targetFrozenFraction: 0.58,
    lactoseRiskMaxPct: 0, proteinRiskMaxPct: 0,
    notes: 'No dairy. Sugar + fibre carry body. Lower frozen fraction = scoopable without fat.',
  },
  kulfi_basundi: {
    id: 'kulfi_basundi', label: 'Kulfi / Basundi Base', mode: 'kulfi',
    fat: [8, 14], msnf: [16, 24], addedSugar: [14, 20], totalSugar: [18, 25],
    totalSolids: [38, 46], sp: [12, 20], afp: [22, 28], fpdt: [2.0, 2.8],
    stabilizer: [0.2, 0.4], servingTempC: [-12, -10], targetFrozenFraction: 0.72,
    lactoseRiskMaxPct: 11.0, proteinRiskMaxPct: 8.0,
    notes: 'Dense, low-overrun, firmer set (low FPDT is CORRECT here). High MSNF — watch lactose crystallisation; consider WPC80 for part of the SMP.',
  },
  premium_ice_cream: {
    id: 'premium_ice_cream', label: 'Premium Ice Cream', mode: 'ice_cream',
    fat: [12, 18], msnf: [8, 11], addedSugar: [14, 18], totalSugar: [16, 21],
    totalSolids: [38, 44], sp: [12, 18], afp: [20, 26], fpdt: [2.2, 3.0],
    stabilizer: [0.2, 0.4], servingTempC: [-16, -13], targetFrozenFraction: 0.74,
    lactoseRiskMaxPct: 9.4, proteinRiskMaxPct: 5.0,
    notes: 'High fat carries body; AFP runs lower; served colder/harder than gelato.',
  },
  mithai_gelato: {
    id: 'mithai_gelato', label: 'Indian Mithai Gelato', mode: 'gelato',
    fat: [7, 12], msnf: [7, 11], addedSugar: [18, 24], totalSugar: [20, 26],
    totalSolids: [40, 46], sp: [16, 24], afp: [24, 30], fpdt: [2.6, 3.6],
    stabilizer: [0.3, 0.5], servingTempC: [-13, -11], targetFrozenFraction: 0.68,
    lactoseRiskMaxPct: 9.4, proteinRiskMaxPct: 5.5,
    notes: 'High-solids mithai pastes (13–17% dose) push TS to the top of the band. The maltodextrin-free base buys the headroom — keep TS ≤ 46 after paste.',
  },
};

/** Sweetener coefficients — ONE definition (resolves Brief A7 dextrose 1.75 vs 1.90 split). */
export const SWEETENER_COEFFS: Record<string, { sp: number; afp: number; pod: number }> = {
  sucrose:            { sp: 1.00, afp: 1.00, pod: 100 },
  lactose:            { sp: 0.16, afp: 1.00, pod: 16 },
  dextrose:           { sp: 0.64, afp: 1.75, pod: 64 }, // use the SAME value for fruit glucose
  fructose:           { sp: 1.70, afp: 1.90, pod: 170 },
  invert:             { sp: 0.94, afp: 1.43, pod: 94 },
  honey:              { sp: 1.04, afp: 1.52, pod: 104 },
  agave:              { sp: 1.06, afp: 1.44, pod: 106 },
  trehalose:          { sp: 0.41, afp: 0.91, pod: 41 },
  maple_syrup:        { sp: 0.67, afp: 0.67, pod: 67 },
  glucose_syrup_60:   { sp: 0.51, afp: 0.96, pod: 51 },
  glucose_syrup_42:   { sp: 0.42, afp: 0.74, pod: 42 },
  dry_glucose_38:     { sp: 0.22, afp: 0.43, pod: 22 },
  maltodextrin:       { sp: 0.09, afp: 0.22, pod: 9 },
};

/** Sugar-spectrum policy (Carpigiani): keep mono ≤ 25%, poly ≤ 35%, di ≥ 50% of total sugars. */
export const SUGAR_SPECTRUM = { monoMaxPct: 25, polyMaxPct: 35, diMinPct: 50 };

export function getProfile(id: ProductId): ProductProfile { return PROFILES[id]; }
export const inBand = (v: number, b: Band) => v >= b[0] && v <= b[1];
export const bandMid = (b: Band) => (b[0] + b[1]) / 2;
