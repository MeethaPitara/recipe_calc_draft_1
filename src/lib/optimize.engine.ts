import { apiPost } from '../lib/apiClient';
import { OptimizeTarget, Row } from './optimize';

export class BalancingEngine {
  async balance(
    rows: Row[],
    targets: OptimizeTarget,
    mode: 'gelato' | 'kulfi' = 'gelato',
    preferredStrategy?: string
  ): Promise<any> {
    const response = await apiPost('/api/optimize/balance', { rows, targets, mode, preferredStrategy });
    if (!response || !response.success) {
      throw new Error(response?.error || 'Failed to balance recipe');
    }
    return response.result;
  }
}

export const balancingEngine = new BalancingEngine();
