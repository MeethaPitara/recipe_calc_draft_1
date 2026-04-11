import { MetricsV2 as Metrics } from './calc.v2';
import leightonTable from './leightonTable.json';
import { ServingContext, SERVING_CONTEXT } from './constants/tempTargets';

export type ScoopAdvice = {
  serveTempC: number;   // recommended cabinet temp
  storeTempC: number;   // recommended storage
  frozenWaterAtServe_pct: number; // estimated at reference temp
  scoopRange: { min: number; max: number };
  status: 'soft' | 'ideal' | 'firm' | 'too_hard' | 'too_soft';
};

/**
 * Given a target FPD in °C, find the sucrose concentration (g/100g water)
 * that would produce that depression. Linear interpolation between table points.
 */
export function leightonReverseLookup(targetFPD: number): number | null {
  const table = leightonTable.data;

  // Below minimum
  if (targetFPD <= 0) return 0;

  // Above maximum table value
  if (targetFPD >= table[table.length - 1].fpdse) return null;

  // Find bracketing entries
  for (let i = 0; i < table.length - 1; i++) {
    if (table[i].fpdse <= targetFPD && targetFPD < table[i + 1].fpdse) {
      const fraction = (targetFPD - table[i].fpdse) / (table[i + 1].fpdse - table[i].fpdse);
      return table[i].sucrosePer100gWater + fraction * (table[i + 1].sucrosePer100gWater - table[i].sucrosePer100gWater);
    }
  }

  return null;
}

/**
 * Scientifically correct freezing curve calculation 
 * using the Leighton Reverse-Lookup Method.
 */
export function estimateFrozenWater(metrics: Metrics, tempC: number): number {
  // tempC is negative (e.g., -18)
  const absTempC = Math.abs(tempC);

  // If temperature is warmer than or equal to the freezing point, nothing is frozen
  // Note: metrics.fpdt is the freezing point depression (positive value)
  if (absTempC <= metrics.fpdt) {
    return 0;
  }

  // Step 1: What sugar concentration (g per 100g water) would have
  // a freezing point depression of |tempC| degrees?
  const sucroseConc_at_T = leightonReverseLookup(absTempC);

  // If we're beyond the table range, cap at high frozen pct
  if (sucroseConc_at_T === null) {
    return 95;
  }

  // Step 2: The ratio of the recipe's actual sugar concentration (SE based)
  // to the concentration required for this temperature tells us the unfrozen fraction.
  const unfrozenFraction = metrics.sucrosePer100gWater / sucroseConc_at_T;

  // Step 3: Frozen fraction
  const frozenFraction = 1 - unfrozenFraction;

  // Clamp to 0–1 range
  return Math.max(0, Math.min(1, frozenFraction)) * 100;
}

/**
 * Find the temperature where frozen water = the context's target midpoint
 */
export function recommendServeTemp(metrics: Metrics, context: ServingContext): number {
  const ctx = SERVING_CONTEXT[context];
  const targetFrozenPct = ctx.targetFrozenMidpoint;

  // Sweep from -5 to -22 in 0.1°C steps
  for (let t = -5.0; t >= -22.0; t -= 0.1) {
    const frozen = estimateFrozenWater(metrics, t);
    if (frozen >= targetFrozenPct) {
      return Math.round(t * 10) / 10;
    }
  }

  return ctx.referenceTemp;
}

/**
 * Find the temperature range where frozen% is within the context's green zone
 */
export function getScoopableRange(metrics: Metrics, context: ServingContext): { min: number; max: number } {
  const ctx = SERVING_CONTEXT[context];
  const [lowerBound, upperBound] = ctx.frozenZone_green;

  let tempAtUpper = -22;
  let tempAtLower = -5;

  for (let t = -5.0; t >= -22.0; t -= 0.1) {
    const frozen = estimateFrozenWater(metrics, t);
    if (frozen >= lowerBound && tempAtLower === -5) {
      tempAtLower = t;
    }
    if (frozen >= upperBound) {
      tempAtUpper = t;
      break;
    }
  }

  return { min: tempAtUpper, max: tempAtLower };
}

export function calculateIdealServeTemp(metrics: Metrics, targetFrozenWater: number = 72): number {
  let tempC = -12;
  // Sweep from -5 to -22
  for (let t = -5.0; t >= -22.0; t -= 0.1) {
    const frozen = estimateFrozenWater(metrics, t);
    if (frozen >= targetFrozenWater) {
      return Math.round(t * 10) / 10;
    }
  }
  return -12;
}

export function getTemperatureGuidance(metrics: Metrics): string[] {
  const advice = recommendTemps(metrics, 'home_freezer');
  const tips: string[] = [];

  tips.push(`Recommended serving: ${advice.serveTempC.toFixed(1)}°C`);
  tips.push(`Frozen water at -18°C: ${advice.frozenWaterAtServe_pct.toFixed(1)}%`);

  switch (advice.status) {
    case 'soft':
      tips.push('Texture: Soft - may be too easy to scoop');
      break;
    case 'ideal':
      tips.push('Texture: Ideal scoopability');
      break;
    case 'firm':
      tips.push('Texture: Firm - good for display');
      break;
    case 'too_hard':
      tips.push('Texture: Too hard - increase AFP');
      break;
  }

  return tips;
}

/**
 * Enhanced recommendation function
 */
export function recommendTemps(metrics: Metrics, context: ServingContext = 'home_freezer'): ScoopAdvice {
  const ctx = SERVING_CONTEXT[context];
  const serveTemp = recommendServeTemp(metrics, context);
  const scoopRange = getScoopableRange(metrics, context);
  const frozenAtRef = estimateFrozenWater(metrics, ctx.referenceTemp);

  let status: ScoopAdvice['status'] = 'ideal';
  if (frozenAtRef < ctx.frozenZone_red_soft) status = 'too_soft';
  else if (frozenAtRef < ctx.frozenZone_green[0]) status = 'soft';
  else if (frozenAtRef < ctx.frozenZone_green[1]) status = 'ideal';
  else if (frozenAtRef < ctx.frozenZone_red_firm) status = 'firm';
  else status = 'too_hard';

  return {
    serveTempC: serveTemp,
    storeTempC: -24, // Typically blast/long-term storage
    frozenWaterAtServe_pct: frozenAtRef,
    scoopRange,
    status
  };
}