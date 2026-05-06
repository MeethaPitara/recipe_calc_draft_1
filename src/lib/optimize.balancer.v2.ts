import { apiPost } from '../lib/apiClient.js';
import { Row, OptimizeTarget } from './optimize.js';
import { IngredientData } from '@/types/ingredients';
import { MetricsV2 } from './calc.v2.js';
import { PRODUCT_CONSTRAINTS, getConstraintsForMode, ProductConstraint, ConstraintRange } from './productConstraints.js';

export { PRODUCT_CONSTRAINTS, getConstraintsForMode };
export type { ProductConstraint, ConstraintRange };

export type ValidationSeverity = 'optimal' | 'acceptable' | 'warning' | 'critical';

export interface ScienceValidation {
  parameter: string;
  value: number;
  optimalRange: { min: number; max: number };
  acceptableRange: { min: number; max: number };
  severity: ValidationSeverity;
  message: string;
  recommendation?: string;
}

export interface FeasibilityReport {
  feasible: boolean;
  reason?: string;
  suggestions: string[];
  achievableRanges: {
    fat: { min: number; max: number };
    msnf: { min: number; max: number };
    nonLactoseSugars: { min: number; max: number };
  };
}

export interface BalanceProgress {
  iteration: number;
  metrics: MetricsV2;
  adjustments: string[];
  score: number;
}

export interface BalanceResultV2 {
  success: boolean;
  rows: Row[];
  metrics: MetricsV2;
  originalMetrics: MetricsV2;
  iterations: number;
  progress: BalanceProgress[];
  strategy: string;
  message: string;
  adjustmentsSummary: string[];
  feasibilityReport?: FeasibilityReport;
  scienceValidation?: ScienceValidation[];
  qualityScore?: {
    score: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    color: 'success' | 'warning' | 'destructive';
  };
}

export const RecipeBalancerV2 = {
  balance: async (
    initialRows: Row[],
    targets: OptimizeTarget,
    allIngredients: IngredientData[] = [],
    options: {
      maxIterations?: number;
      tolerance?: number;
      enableFeasibilityCheck?: boolean;
      useLPSolver?: boolean;
      productType?: string;
      enableScienceValidation?: boolean;
      allowCoreDairy?: boolean;
    } = {}
  ): Promise<BalanceResultV2> => {
    // Mode resolution for backend fallback (optional)
    const mode = options.productType && options.productType.includes('kulfi') ? 'kulfi' : 'gelato';

    // Fallback to basic balancing engine API which handles LP logic implicitly
    const response = await apiPost('/api/optimize/balance', {
      rows: initialRows,
      targets,
      mode,
    });

    // Map response structure to exactly what RecipeCalculatorV2 expects
    if (response && response.success) {
      return {
        ...response.result,
        progress: response.result.progress || [],
        scienceValidation: response.result.scienceValidation || [],
        qualityScore: response.result.qualityScore || undefined
      } as BalanceResultV2;
    } else {
      throw new Error(response?.error || 'Failed to balance via AI engine');
    }
  }
};

export async function balanceRecipeLP(
  rows: Row[],
  targets: OptimizeTarget,
  options: any = {}
): Promise<BalanceResultV2> {
  return RecipeBalancerV2.balance(rows, targets, [], options);
}
