import { apiPost } from '@/lib/apiClient';

export interface ThermoMetricsInput {
  rows: Array<{
    ing_id: string;
    grams: number;
  }>;
  mode?: 'gelato' | 'kulfi';
  serveTempC?: number;
}

export interface ThermoMetricsBase {
  SEper100gWater: number;
  FPDT: number;
  waterFrozenPct: number;
  totalWater: number;
  totalSugars: number;
}

export interface ThermoMetricsAdjusted {
  SEper100gWater: number;
  FPDT: number;
  waterFrozenPct: number;
  hardeningEffect: number;
}

export interface ThermoMetricsResult {
  base: ThermoMetricsBase;
  adjusted: ThermoMetricsAdjusted;
  serveTempC: number;
  mode: string;
}

/**
 * Fetches thermo-metrics from the backend API
 * @param input - Ingredient rows with IDs and grams, mode, and serving temperature
 * @returns Base and adjusted thermo-metrics including FPDT and water frozen percentage
 */
export async function fetchThermoMetrics(
  input: ThermoMetricsInput
): Promise<ThermoMetricsResult> {
  try {
    const data = await apiPost('/api/calc/thermo-metrics', {
      rows: input.rows,
      mode: input.mode || 'gelato',
      serveTempC: input.serveTempC ?? -12,
    });

    if (!data) {
      throw new Error('No data returned from thermo-metrics function');
    }

    return data;
  } catch (error: any) {
    console.error('Error fetching thermo-metrics:', error);
    throw new Error(`Failed to fetch thermo-metrics: ${error.message}`);
  }
}
