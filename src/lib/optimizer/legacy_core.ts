/**
 * Legacy Core — Barrel re-export of existing optimizer modules.
 * Purpose: single import point for the engine adapter without code duplication.
 */

// Hill-climbing optimizer (primary fallback)
export { optimizeRecipe, type Row, type OptimizeTarget } from '../optimize';

// LP (Simplex) solver (primary strategy)
export {
    balanceRecipeLP,
    type LPSolverResult,
} from '../optimize.balancer.v2';

// Advanced algorithms: GA, PSO, Hybrid (secondary fallback)
export { advancedOptimize, type OptimizerConfig } from '../optimize.advanced';

// Metrics calculator
export { calcMetricsV2, type MetricsV2 } from '../calc.v2';
