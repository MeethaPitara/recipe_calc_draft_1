/**
 * Scoopability — Thin API Wrapper
 * All freezing curve math runs on the backend via /api/calc/scoopability
 */

import { apiPost } from './apiClient';
import type { MetricsV2 } from './calcApi';
import type { ServingContext } from './constants/tempTargets';

export type ScoopAdvice = {
  serveTempC: number;
  storeTempC: number;
  frozenWaterAtServe_pct: number;
  scoopRange: { min: number; max: number };
  status: 'soft' | 'ideal' | 'firm' | 'too_hard' | 'too_soft';
};

interface ScoopabilityResponse {
  success: boolean;
  recommendation: ScoopAdvice;
  temperatureGuidance: string[];
  idealServeTemp: number;
  scoopRange: { min: number; max: number };
  serveTemp: number;
  frozenWaterAtTemp?: number;
  freezingCurve: { tempC: number; frozenPct: number }[];
}

async function fetchScoopability(
  metrics: MetricsV2,
  context: ServingContext = 'home_freezer',
  tempC?: number
): Promise<ScoopabilityResponse> {
  return apiPost<ScoopabilityResponse>('/api/calc/scoopability', { metrics, context, tempC });
}

export async function recommendTemps(metrics: MetricsV2, context: ServingContext = 'home_freezer'): Promise<ScoopAdvice> {
  const res = await fetchScoopability(metrics, context);
  return res.recommendation;
}

export async function estimateFrozenWater(metrics: MetricsV2, tempC: number): Promise<number> {
  const res = await fetchScoopability(metrics, 'home_freezer', tempC);
  return res.frozenWaterAtTemp ?? 0;
}

export async function recommendServeTemp(metrics: MetricsV2, context: ServingContext): Promise<number> {
  const res = await fetchScoopability(metrics, context);
  return res.serveTemp;
}

export async function getScoopableRange(metrics: MetricsV2, context: ServingContext): Promise<{ min: number; max: number }> {
  const res = await fetchScoopability(metrics, context);
  return res.scoopRange;
}

export async function calculateIdealServeTemp(metrics: MetricsV2): Promise<number> {
  const res = await fetchScoopability(metrics);
  return res.idealServeTemp;
}

export async function getTemperatureGuidance(metrics: MetricsV2): Promise<string[]> {
  const res = await fetchScoopability(metrics);
  return res.temperatureGuidance;
}

/** Get full freezing curve data for charting */
export async function getFreezingCurve(metrics: MetricsV2, context?: ServingContext): Promise<{ tempC: number; frozenPct: number }[]> {
  const res = await fetchScoopability(metrics, context);
  return res.freezingCurve;
}