import { supabase } from "@/integrations/supabase/client";

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
 * Fetches thermo-metrics from the edge function
 * @param input - Ingredient rows with IDs and grams, mode, and serving temperature
 * @returns Base and adjusted thermo-metrics including FPDT and water frozen percentage
 */
export async function fetchThermoMetrics(
  input: ThermoMetricsInput
): Promise<ThermoMetricsResult> {
  const { data, error } = await supabase.functions.invoke<ThermoMetricsResult>(
    'thermo-metrics',
    {
      body: {
        rows: input.rows,
        mode: input.mode || 'gelato',
        serveTempC: input.serveTempC ?? -12,
      },
    }
  );

  if (error) {
    console.error('Error fetching thermo-metrics:', error);
    throw new Error(`Failed to fetch thermo-metrics: ${error.message}`);
  }

  if (!data) {
    throw new Error('No data returned from thermo-metrics function');
  }

  return data;
}
