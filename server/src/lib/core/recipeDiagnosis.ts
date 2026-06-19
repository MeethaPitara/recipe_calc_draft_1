/**
 * recipeDiagnosis.ts — the "consultant" brain (Engineering Brief v2, B2).
 * ----------------------------------------------------------------------
 * A metric out of range is NOT advice. This module turns each problem into:
 *     Problem (plain language) + Why + an EXACT gram fix that keeps the
 *     batch at its current weight.
 * That is the difference between a calculator and a tool that replaces a
 * formulation consultant.
 *
 * All target ranges come from scienceConfig.ts — never hardcode here.
 * Gram fixes are first-move estimates: apply, then RECOMPUTE (the UI should
 * say so). That is exactly how a consultant works — directional, then verify.
 *
 * FPDT convention (locked): low = HARD/icy, high = SOFT/fast-melt.
 */

import { ProductProfile, SWEETENER_COEFFS, inBand } from './scienceConfig.js';

export interface DiagnosisMetrics {
  total_g: number;
  water_g: number;
  se_g: number;
  fat_pct: number;
  msnf_pct: number;
  nonLactoseSugars_pct: number;   // added sugars %
  totalSugarsTotal_pct: number;   // total incl. lactose %  (validate against this)
  ts_pct: number;
  fpdt: number;
  sp_pct: number;
  afp_index: number;
  lactose_pct: number;
  protein_pct: number;
  servingTempC?: number;          // from freezingCurve (optional but preferred)
}

export type Severity = 'ok' | 'warn' | 'critical';
export type Direction = 'low' | 'high' | 'ok';

export interface Diagnosis {
  metric: string;
  status: Direction;
  severity: Severity;
  problem: string;   // plain language, customer-facing outcome
  why: string;       // the science, one sentence
  fix: string;       // EXACT grams, batch-preserving; "" if none needed
}

const g = (n: number) => `${Math.round(n)} g`;
const sev = (v: number, b: [number, number]): Severity => {
  if (inBand(v, b)) return 'ok';
  const span = b[1] - b[0];
  const dist = v < b[0] ? b[0] - v : v - b[1];
  return dist > span * 0.5 ? 'critical' : 'warn';
};

/** grams of sucrose↔dextrose swap to move FPDT toward target (proportional first estimate). */
function fpdtSwapGrams(m: DiagnosisMetrics, targetFpdt: number): number {
  if (m.fpdt <= 0 || m.water_g <= 0) return 0;
  const targetSE = m.se_g * (targetFpdt / m.fpdt);  // near-proportional via Leighton
  const dSE = targetSE - m.se_g;
  const afpDiff = SWEETENER_COEFFS.dextrose.afp - SWEETENER_COEFFS.sucrose.afp; // 0.75 per g
  return Math.abs(dSE / afpDiff);
}

export function diagnose(m: DiagnosisMetrics, p: ProductProfile): Diagnosis[] {
  const out: Diagnosis[] = [];
  const midFpdt = (p.fpdt[0] + p.fpdt[1]) / 2;

  // ---- FPDT / texture (the headline) ----
  if (m.fpdt < p.fpdt[0]) {
    const grams = fpdtSwapGrams(m, midFpdt);
    out.push({
      metric: 'FPDT (texture)', status: 'low', severity: sev(m.fpdt, p.fpdt),
      problem: `Too hard / icy — difficult to scoop${m.servingTempC != null ? ` (freezes solid before ${p.servingTempC[0]}°C)` : ''}.`,
      why: 'Low freezing-point depression means too much water turns to ice at serving temperature.',
      fix: `Swap ${g(grams)} sucrose → ${g(grams)} dextrose (batch weight unchanged). Raises AFP/FPDT toward ${midFpdt.toFixed(1)}°C. Recompute and re-check.`,
    });
  } else if (m.fpdt > p.fpdt[1]) {
    const grams = fpdtSwapGrams(m, midFpdt);
    out.push({
      metric: 'FPDT (texture)', status: 'high', severity: sev(m.fpdt, p.fpdt),
      problem: 'Too soft / fast-melting — weak structure, melts quickly, icy after refreeze.',
      why: 'High freezing-point depression means too little water freezes at serving temperature.',
      fix: `Swap ${g(grams)} dextrose → ${g(grams)} sucrose (batch weight unchanged). Lowers AFP/FPDT toward ${midFpdt.toFixed(1)}°C. If no high-AFP sugar present, raise total solids instead. Recompute.`,
    });
  } else {
    out.push({ metric: 'FPDT (texture)', status: 'ok', severity: 'ok', problem: 'Texture in target.', why: '', fix: '' });
  }

  // ---- Total solids ----
  if (m.ts_pct < p.totalSolids[0]) {
    const need = (p.totalSolids[0] - m.ts_pct) / 100 * m.total_g;
    out.push({ metric: 'Total solids', status: 'low', severity: sev(m.ts_pct, p.totalSolids),
      problem: 'Thin body, watery, prone to iciness.',
      why: 'Not enough non-water material to hold structure and small ice crystals.',
      fix: `Add ~${g(need)} solids (SMP / sugar / paste) and remove the same weight of water to hold the batch.` });
  } else if (m.ts_pct > p.totalSolids[1]) {
    const excess = (m.ts_pct - p.totalSolids[1]) / 100 * m.total_g;
    out.push({ metric: 'Total solids', status: 'high', severity: sev(m.ts_pct, p.totalSolids),
      problem: 'Heavy, gummy, slow to melt; risk of sandiness.',
      why: 'Too much dissolved/suspended solid for the water phase.',
      fix: `Remove ~${g(excess)} of the highest-solids ingredient (often added sugar or SMP) and replace with milk/water. For mithai SKUs, the maltodextrin-free base is the lever — confirm it is removed.` });
  }

  // ---- Fat ----
  if (m.fat_pct < p.fat[0]) {
    const need = (p.fat[0] - m.fat_pct) / 100 * m.total_g;
    out.push({ metric: 'Fat', status: 'low', severity: sev(m.fat_pct, p.fat),
      problem: 'Lean, less creamy, can feel icy.', why: 'Fat coats crystals and carries flavour/body.',
      fix: `Raise fat by ~${g(need)}: add cream and reduce milk by a similar weight.` });
  } else if (m.fat_pct > p.fat[1]) {
    const excess = (m.fat_pct - p.fat[1]) / 100 * m.total_g;
    out.push({ metric: 'Fat', status: 'high', severity: sev(m.fat_pct, p.fat),
      problem: 'Greasy/heavy mouthfeel; can mute flavour release.', why: 'Excess fat coats the palate.',
      fix: `Cut fat by ~${g(excess)}: replace some cream with milk.` });
  }

  // ---- Total sugars (validate the lactose-INCLUSIVE figure: Brief A6) ----
  if (m.totalSugarsTotal_pct < p.totalSugar[0]) {
    out.push({ metric: 'Total sugars', status: 'low', severity: sev(m.totalSugarsTotal_pct, p.totalSugar),
      problem: 'Under-sweet and firmer/icier than intended.', why: 'Sugars sweeten AND depress the freezing point.',
      fix: 'Increase added sugar within the SP band; prefer sucrose if FPDT is already at/above target.' });
  } else if (m.totalSugarsTotal_pct > p.totalSugar[1]) {
    out.push({ metric: 'Total sugars', status: 'high', severity: sev(m.totalSugarsTotal_pct, p.totalSugar),
      problem: 'Over-sweet and soft/slushy.', why: 'Excess sugar over-depresses the freezing point.',
      fix: 'Reduce added sugar; if you must keep sweetness, shift part to maltodextrin (low SP, low AFP).' });
  }

  // ---- MSNF / lactose risk ----
  if (m.lactose_pct > p.lactoseRiskMaxPct) {
    const excessLactose = (m.lactose_pct - p.lactoseRiskMaxPct) / 100 * m.total_g;
    const smpGrams = excessLactose / 0.51; // SMP ≈ 51% lactose
    out.push({ metric: 'Lactose', status: 'high', severity: 'warn',
      problem: 'Risk of sandiness — lactose can crystallise during storage.', why: `Lactose ${m.lactose_pct.toFixed(1)}% exceeds the ${p.lactoseRiskMaxPct}% crystallisation threshold.`,
      fix: `Reduce SMP by ~${g(smpGrams)} (replace with milk/water), OR swap part of the SMP for WPC80 to cut lactose without losing MSNF.` });
  }
  if (m.msnf_pct < p.msnf[0]) {
    out.push({ metric: 'MSNF', status: 'low', severity: sev(m.msnf_pct, p.msnf),
      problem: 'Weak body, faster melt.', why: 'Milk solids build structure and bind water.',
      fix: 'Add SMP a few grams at a time; re-check lactose after each step.' });
  } else if (m.msnf_pct > p.msnf[1]) {
    out.push({ metric: 'MSNF', status: 'high', severity: sev(m.msnf_pct, p.msnf),
      problem: 'Risk of chewiness/sandiness.', why: 'Excess milk solids over-bind water and add lactose.',
      fix: 'Reduce SMP; replace with cream (for fat) or water to hold the batch.' });
  }

  // ---- Protein risk ----
  if (m.protein_pct >= p.proteinRiskMaxPct) {
    out.push({ metric: 'Protein', status: 'high', severity: 'warn',
      problem: 'Chewy / sandy texture risk.', why: `Protein ${m.protein_pct.toFixed(1)}% is at/above the ${p.proteinRiskMaxPct}% risk line.`,
      fix: 'Lower MSNF (reduce SMP); for kulfi this higher protein is expected — only act if texture is off.' });
  }

  // ---- SP / AFP balance (sweetness vs anti-freeze, kept independent) ----
  if (!inBand(m.sp_pct, p.sp)) {
    out.push({ metric: 'SP (sweetness)', status: m.sp_pct < p.sp[0] ? 'low' : 'high', severity: sev(m.sp_pct, p.sp),
      problem: m.sp_pct < p.sp[0] ? 'Tastes under-sweet.' : 'Tastes over-sweet.', why: 'SP is sweetening power as % of weight.',
      fix: m.sp_pct < p.sp[0] ? 'Add sucrose, or swap some dextrose→sucrose (raises sweetness, lowers AFP).' : 'Swap some sucrose→dextrose (cuts sweetness, raises AFP) or sucrose→maltodextrin (cuts both).' });
  }
  if (!inBand(m.afp_index, p.afp)) {
    out.push({ metric: 'AFP (anti-freeze)', status: m.afp_index < p.afp[0] ? 'low' : 'high', severity: sev(m.afp_index, p.afp),
      problem: m.afp_index < p.afp[0] ? 'Will set hard.' : 'Will set soft.', why: 'AFP is anti-freezing power as % of weight; it tracks FPDT.',
      fix: 'Adjust via the FPDT fix above — SP and AFP move together when you change the sugar blend.' });
  }

  return out;
}

/** convenience: the single most important problem to show first */
export function topDiagnosis(ds: Diagnosis[]): Diagnosis | null {
  const order = { critical: 0, warn: 1, ok: 2 };
  return ds.filter(d => d.severity !== 'ok').sort((a, b) => order[a.severity] - order[b.severity])[0] || null;
}
