/**
 * freezingCurve.ts — the capability the market leaders have and this app didn't.
 * ----------------------------------------------------------------------------
 * Turns FPDT into what the customer actually experiences: a FREEZING CURVE
 * (how much water is frozen at each temperature) and a SERVING TEMPERATURE
 * (the temp where the target frozen fraction is reached).
 *
 * Why this also kills a whole class of bug: once you balance to a serving-temp
 * WINDOW, "too hard / too soft" is unambiguous and can never be coded backwards
 * the way bare FPDT thresholds were (Engineering Brief v2, A1 + B1).
 *
 * METHOD (reuses the project's verified leightonTable.json):
 *   Solutes don't freeze, so as water freezes out the remaining solution
 *   concentrates and its freezing point drops further. At equilibrium temp T,
 *   the freezing point of the UNFROZEN solution equals T. So for a target
 *   frozen fraction x of the original water:
 *       remainingWater = water_g * (1 - x)
 *       concentration  = SE / remainingWater * 100      (g sucrose-eq / 100g water)
 *       FPD            = leighton(concentration)
 *       servingTemp    = -FPD
 *   The curve is this function sampled over x. The inverse (fraction frozen at a
 *   given temp) is found by bisection.
 *
 * HONEST LIMITATION — READ THIS:
 *   leightonTable.json currently stops at 75 g/100g water (FPD 7.7°C). Serving
 *   temperatures (~ -11 to -16°C) require the CONCENTRATED solution to depress
 *   ~11–16°C, which is past the table. Below we linearly extrapolate from the
 *   table's top segment so the math still runs, and we flag `extrapolated:true`.
 *   For production-grade deep-freeze accuracy, EXTEND leightonTable.json up to
 *   ~130 g/100g water using Leighton's published data. When you do, this file
 *   gets more accurate automatically — no code change needed.
 */

import leightonTable from './leightonTable.json';

type Pt = { sucrosePer100gWater: number; fpdse: number };
const DATA: Pt[] = (leightonTable as any).data;

/** Leighton lookup with linear extrapolation beyond the table's top point. */
export function leightonFPD(concPer100gWater: number): { fpd: number; extrapolated: boolean } {
  const x = concPer100gWater;
  if (x <= DATA[0].sucrosePer100gWater) return { fpd: DATA[0].fpdse, extrapolated: false };
  const last = DATA[DATA.length - 1], prev = DATA[DATA.length - 2];
  if (x >= last.sucrosePer100gWater) {
    // TODO: extend leightonTable.json up to ~130 g/100g water (Leighton's
    // published data goes further). Serving temps for gelato/ice cream
    // (~-11 to -16°C) need concentration past this table's current top
    // point (75 g/100g water, FPD 7.7°C), so every deep-freeze serving
    // temp returned today is a linear extrapolation, not a verified value.
    const slope = (last.fpdse - prev.fpdse) / (last.sucrosePer100gWater - prev.sucrosePer100gWater);
    return { fpd: last.fpdse + slope * (x - last.sucrosePer100gWater), extrapolated: true };
  }
  for (let i = 0; i < DATA.length - 1; i++) {
    const p1 = DATA[i], p2 = DATA[i + 1];
    if (x >= p1.sucrosePer100gWater && x <= p2.sucrosePer100gWater) {
      const t = (x - p1.sucrosePer100gWater) / (p2.sucrosePer100gWater - p1.sucrosePer100gWater);
      return { fpd: p1.fpdse + t * (p2.fpdse - p1.fpdse), extrapolated: false };
    }
  }
  return { fpd: last.fpdse, extrapolated: true };
}

export interface FreezingCurveInput {
  se_g: number;     // sucrose equivalents (from MetricsV2.se_g)
  water_g: number;  // water after evaporation (from MetricsV2.water_g)
  /** target fraction of water frozen at serving temp, e.g. 0.68 for gelato */
  targetFrozenFraction: number;
}

export interface FreezingCurvePoint { tempC: number; frozenPct: number; extrapolated: boolean }

export interface FreezingCurveResult {
  initialFreezingPointC: number;          // where ice first forms (negative)
  servingTempC: number;                   // temp at target frozen fraction (negative)
  servingTempExtrapolated: boolean;       // true if beyond verified table range
  frozenFractionAt: (tempC: number) => number; // 0–1 at any serving temp
  curve: FreezingCurvePoint[];            // sampled 0 → 85% frozen
}

/** Serving temp (°C, negative) at a given frozen fraction. */
function tempAtFrozenFraction(se_g: number, water_g: number, x: number): { tempC: number; extrapolated: boolean } {
  const remaining = Math.max(water_g * (1 - x), 1e-6);
  const conc = (se_g / remaining) * 100;
  const { fpd, extrapolated } = leightonFPD(conc);
  return { tempC: -fpd, extrapolated };
}

export function computeFreezingCurve(input: FreezingCurveInput): FreezingCurveResult {
  const { se_g, water_g, targetFrozenFraction } = input;

  const initial = tempAtFrozenFraction(se_g, water_g, 0);
  const serving = tempAtFrozenFraction(se_g, water_g, targetFrozenFraction);

  // sample the curve 0 → 0.85 frozen
  const curve: FreezingCurvePoint[] = [];
  for (let x = 0; x <= 0.85 + 1e-9; x += 0.05) {
    const r = tempAtFrozenFraction(se_g, water_g, x);
    curve.push({ tempC: +r.tempC.toFixed(2), frozenPct: +(x * 100).toFixed(1), extrapolated: r.extrapolated });
  }

  // invert: fraction frozen at an arbitrary serving temp via bisection
  const frozenFractionAt = (tempC: number): number => {
    if (tempC >= initial.tempC) return 0; // warmer than initial FP → nothing frozen
    let lo = 0, hi = 0.95;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      const t = tempAtFrozenFraction(se_g, water_g, mid).tempC;
      if (t < tempC) hi = mid; else lo = mid; // colder target → need more frozen
    }
    return +(((lo + hi) / 2)).toFixed(3);
  };

  return {
    initialFreezingPointC: +initial.tempC.toFixed(2),
    servingTempC: +serving.tempC.toFixed(2),
    servingTempExtrapolated: serving.extrapolated,
    frozenFractionAt,
    curve,
  };
}
