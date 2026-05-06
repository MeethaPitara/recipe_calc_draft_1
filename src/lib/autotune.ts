import { apiPost } from './apiClient';

/**
 * Frontend stub for autotune for temperature
 * Hits the backend /api/optimize/autotune endpoint
 */
export async function autotuneForTemp(
  rows: any[],
  targetTemp: number,
  keepSP: boolean = true
): Promise<any[]> {
  const response = await apiPost('/api/optimize/autotune', {
    rows,
    targetTemp,
    keepSP
  });

  if (!response || !response.success) {
    throw new Error(response?.error || 'Failed to autotune for temperature');
  }

  return response.resultRows;
}

export async function previewTuningChanges(
  rows: any[],
  targetTemp: number
): Promise<{ changes: any[], metrics: any }> {
  const response = await apiPost('/api/optimize/preview-tuning', {
    rows,
    targetTemp
  });

  if (!response || !response.success) {
    throw new Error(response?.error || 'Failed to preview tuning changes');
  }

  return response.result;
}
