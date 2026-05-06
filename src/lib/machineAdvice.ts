/**
 * Machine Advice — Thin API Wrapper
 * All formulation intelligence runs on the backend via /api/calc/machine-advice
 */

import { apiPost } from './apiClient';
import type { MachineProfile } from '@/types/machine';
import type { Metrics } from './calc';

interface MachineSettingsResponse {
  success: boolean;
  settings: {
    agingTime: string;
    drawTemp: string;
    overrunTarget: string;
    notes: string[];
  };
  validation: {
    valid: boolean;
    warnings: string[];
    recommendations: string[];
  };
}

export async function getOptimalMachineSettings(
  metrics: Metrics,
  machineType: 'batch' | 'continuous'
): Promise<{
  agingTime: string;
  drawTemp: string;
  overrunTarget: string;
  notes: string[];
}> {
  const res = await apiPost<MachineSettingsResponse>('/api/calc/machine-advice', { metrics, machineType });
  return res.settings;
}

export async function validateForMachine(
  metrics: Metrics,
  machineType: 'batch' | 'continuous'
): Promise<{ valid: boolean; warnings: string[]; recommendations: string[] }> {
  const res = await apiPost<MachineSettingsResponse>('/api/calc/machine-advice', { metrics, machineType });
  return res.validation;
}