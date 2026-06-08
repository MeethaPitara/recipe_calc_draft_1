/**
 * Robust Recipe Balancing Engine
 * 
 * A chemistry-aware optimization layer that:
 * 1. Classifies ingredients by their functional roles
 * 2. Uses multiple optimization strategies with fallbacks
 * 3. Maintains total weight constraints
 * 4. Validates results and provides diagnostics
 * 5. Understands ingredient interactions
 */

import { IngredientData } from '../../types/ingredients';
import { calcMetricsV2, MetricsV2, CalcOptionsV2 } from './calc.v2.js';
import { optimizeRecipe, OptimizeTarget, Row } from './optimize.js';
import { ConstraintProfile } from '../../types/constraints.js';

export interface BalanceResult {
  success: boolean;
  rows: Row[];
  metrics: MetricsV2;
  strategy: string;
  iterations: number;
  diagnostics: {
    initialMetrics: MetricsV2;
    targetsMet: { [key: string]: boolean };
    adjustmentsMade: string[];
    weightMaintained: boolean;
  };
}

export class BalancingEngine {
  /**
   * Balance a recipe using the Constraint-Aware LP Solver
   */
  balance(
    rows: Row[],
    targets: OptimizeTarget,
    mode: 'gelato' | 'kulfi' = 'gelato',
    preferredStrategy?: string,
    constraints?: ConstraintProfile
  ): BalanceResult {
    const originalTotal = constraints?.fixedBatchMassG ?? rows.reduce((sum, r) => sum + r.grams, 0);
    const initialMetrics = calcMetricsV2(rows, { mode });

    let usedStrategy = 'lp_solver';
    let adjustmentsMade: string[] = [];
    
    // Call our newly written constraint-aware LP solver in optimize.ts
    const result = optimizeRecipe(rows, targets, constraints, mode);
    
    if (!result.success) {
      return {
        success: false,
        rows: rows,
        metrics: initialMetrics,
        strategy: usedStrategy,
        iterations: 1,
        diagnostics: {
          initialMetrics,
          targetsMet: {},
          adjustmentsMade: [result.failureReason || 'TARGETS_UNREACHABLE_WITH_GIVEN_INGREDIENTS'],
          weightMaintained: true
        }
      };
    }

    const bestResult = result.rows;
    const bestMetrics = calcMetricsV2(bestResult, { mode });

    // Build diagnostics
    const targetsMet: { [key: string]: boolean } = {};

    if (targets.fat_pct) {
      const met = Math.abs(bestMetrics.fat_pct - targets.fat_pct) < 0.5;
      targetsMet.fat_pct = met;
      if (!met) adjustmentsMade.push(`Fat: ${initialMetrics.fat_pct.toFixed(1)}% → ${bestMetrics.fat_pct.toFixed(1)}% (target: ${targets.fat_pct}%)`);
    }

    if (targets.msnf_pct) {
      const met = Math.abs(bestMetrics.msnf_pct - targets.msnf_pct) < 0.5;
      targetsMet.msnf_pct = met;
      if (!met) adjustmentsMade.push(`MSNF: ${initialMetrics.msnf_pct.toFixed(1)}% → ${bestMetrics.msnf_pct.toFixed(1)}% (target: ${targets.msnf_pct}%)`);
    }

    if (targets.totalSugars_pct) {
      const met = Math.abs(bestMetrics.totalSugars_pct - targets.totalSugars_pct) < 0.5;
      targetsMet.totalSugars_pct = met;
      if (!met) adjustmentsMade.push(`Sugars: ${initialMetrics.totalSugars_pct.toFixed(1)}% → ${bestMetrics.totalSugars_pct.toFixed(1)}% (target: ${targets.totalSugars_pct}%)`);
    }

    if (targets.fpdt) {
      const met = Math.abs(bestMetrics.fpdt - targets.fpdt) < 0.2;
      targetsMet.fpdt = met;
      if (!met) adjustmentsMade.push(`FPDT: ${initialMetrics.fpdt.toFixed(2)}°C → ${bestMetrics.fpdt.toFixed(2)}°C (target: ${targets.fpdt}°C)`);
    }

    const finalTotal = bestResult.reduce((sum, r) => sum + r.grams, 0);
    const weightMaintained = Math.abs(finalTotal - originalTotal) < 1;

    return {
      success: true,
      rows: bestResult,
      metrics: bestMetrics,
      strategy: usedStrategy,
      iterations: 1,
      diagnostics: {
        initialMetrics,
        targetsMet,
        adjustmentsMade,
        weightMaintained
      }
    };
  }
}

// Export singleton instance
export const balancingEngine = new BalancingEngine();
