import { apiPost } from './apiClient';
import type { Row, OptimizeTarget } from './optimize';

export interface OptimizerConfig {
  algorithm?: 'hill-climbing' | 'genetic' | 'particle-swarm' | 'hybrid';
  iterations?: number;
  maxIterations?: number;
  populationSize?: number;
  mutationRate?: number;
  crossoverRate?: number;
  inertia?: number;
  cognitive?: number;
  social?: number;
  convergenceThreshold?: number;
}

/**
 * Frontend stub for advanced optimization
 * Hits the backend /api/optimize/advanced endpoint
 */
export async function advancedOptimize(
  rows: Row[],
  targets: OptimizeTarget,
  config?: OptimizerConfig
): Promise<Row[]> {
  const response = await apiPost('/api/optimize/advanced', {
    rows,
    targets,
    config
  });

  if (!response || !response.success) {
    throw new Error(response?.error || 'Failed to perform advanced optimization');
  }

  return response.resultRows;
}

export async function compareOptimizers(
  rows: Row[],
  targets: OptimizeTarget
): Promise<any[]> {
  const response = await apiPost('/api/optimize/compare', {
    rows,
    targets
  });

  if (!response || !response.success) {
    throw new Error(response?.error || 'Failed to compare optimizers');
  }

  return response.results;
}
