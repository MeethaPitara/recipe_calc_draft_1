/**
 * Advanced Recipe Balancer V2
 * Integrates multi-role classification with intelligent substitution rules
 * Phase 3: Linear Programming solver for optimal balancing
 */

import type { Row, OptimizeTarget } from './optimize';
import type { IngredientData } from '@/types/ingredients';
import type { MetricsV2 } from './calc.v2';
import { calcMetricsV2 } from './calc.v2';
import {
  OptimizeEngineV2,
  type IngredientClassification,
  type SubstitutionRule,
  SUBSTITUTION_PATTERNS
} from './optimize.engine.v2';
import { diagnoseBalancingFailure, findCanonical, classifyIngredient } from './ingredientMapper';
import type { Mode } from '@/types/mode';
import { resolveMode } from './mode';
// @ts-ignore - javascript-lp-solver doesn't have types
import solver from 'javascript-lp-solver';

// ============================================================================
// SUGAR STRATEGY BOUNDS (Mode-Aware)
// ============================================================================

const SUGAR_BOUNDS = {
  gelato: {
    sucrose_max_pct: 22,
    dextrose_max_pct: 8,
    glucose_max_pct: 8,
    invert_max_pct: 8
  },
  gelato_fruit: {
    sucrose_max_pct: 18, // Lower for fruit
    dextrose_max_pct: 8,
    glucose_max_pct: 8,
    invert_max_pct: 8
  },
  ice_cream: {
    sucrose_max_pct: 22,
    dextrose_max_pct: 8,
    glucose_max_pct: 8,
    invert_max_pct: 8
  },
  sorbet: {
    total_sugars_min_pct: 24,
    total_sugars_max_pct: 33,
    sucrose_max_pct: 25,
    dextrose_max_pct: 15, // Higher for texture
    glucose_max_pct: 12
  },
  kulfi: {
    sucrose_max_pct: 20,
    dextrose_max_pct: 6,
    glucose_max_pct: 6,
    invert_max_pct: 6
  }
} as const;

// ============================================================================
// PHASE 3: LINEAR PROGRAMMING SOLVER
// ============================================================================

export interface LPSolverResult {
  success: boolean;
  rows: Row[];
  message: string;
  error?: string;
}

/**
 * Solve recipe balancing using Linear Programming for mathematically optimal solution
 * Uses Simplex method via javascript-lp-solver
 */
export function balanceRecipeLP(
  initialRows: Row[],
  targets: OptimizeTarget,
  options: {
    tolerance?: number;
    mode?: Mode;
    allowCoreDairy?: boolean;
    weightFlexibility?: number; // Allow ±X% weight variation (default 5%)
  } = {}
): LPSolverResult {
  const tolerance = options.tolerance || 4.0; // Increased default tolerance to 4.0 percentage points
  const weightFlexibility = options.weightFlexibility ?? 0.05; // Default ±5% weight flexibility

  if (!initialRows || initialRows.length === 0) {
    return {
      success: false,
      rows: [],
      message: 'No ingredients to optimize',
      error: 'Empty recipe'
    };
  }

  const originalMetrics = calcMetricsV2(initialRows, { mode: options.mode });
  const totalWeight = originalMetrics.total_g;

  // ============ LP BOUNDS & MOVEMENT PENALTY ============
  // Build LP model with category-specific bounds and movement penalties
  const model: any = {
    optimize: 'deviation',
    opType: 'min',
    constraints: {},
    variables: {}
  };

  const lambda = 0.01; // Movement penalty weight - discourages large changes

  // Create variables for each ingredient (amount in grams)
  initialRows.forEach((row, idx) => {
    const varName = `ing_${idx}`;
    const ing = row.ing;
    const initialAmount = row.grams;
    const mode = options.mode || 'gelato';

    // PHASE 2: Calculate category-specific bounds with increased flexibility
    let minGrams = 0; // Can reduce to zero by default
    let maxGrams = Math.max(row.grams * 10, 2000); // Can increase up to 10x OR 2000g maximum

    // PHASE 2: CORE INGREDIENT PROTECTION - only for TRUE core (fruits, flavors, stabilizers)
    // Dairy ingredients are NEVER locked as 'core' for balancing purposes
    const role = classifyIngredient(ing);
    if (role === 'core') {
      const isTrulyCore = ing.category === 'fruit' || 
                          ing.category === 'flavor' || 
                          ing.category === 'stabilizer';
      
      if (isTrulyCore && !options.allowCoreDairy) {
        minGrams = initialAmount * 0.8; // Allow ±20% for true core ingredients
        maxGrams = initialAmount * 1.2;
      }
      // Dairy ingredients (milk, cream, butter) are always flexible, no restrictions
    }

    // Apply category-specific bounds
    if (ing.category === 'other') {
      maxGrams = Math.min(maxGrams, 50); // Max 50g stabilizer/emulsifier
    }
    
    // Apply sugar bounds based on mode
    if (ing.category === 'sugar' || (ing.sugars_pct || 0) >= 90) {
      const sugarBounds = SUGAR_BOUNDS[mode] || SUGAR_BOUNDS.gelato;
      
      if (ing.name.toLowerCase().includes('sucrose')) {
        maxGrams = Math.min(maxGrams, totalWeight * ((sugarBounds as any).sucrose_max_pct / 100));
      } else if (ing.name.toLowerCase().includes('dextrose')) {
        maxGrams = Math.min(maxGrams, totalWeight * ((sugarBounds as any).dextrose_max_pct / 100));
      } else if (ing.name.toLowerCase().includes('glucose')) {
        maxGrams = Math.min(maxGrams, totalWeight * ((sugarBounds as any).glucose_max_pct / 100));
      } else if (ing.name.toLowerCase().includes('invert')) {
        maxGrams = Math.min(maxGrams, totalWeight * ((sugarBounds as any).invert_max_pct || 8) / 100);
      }
    }
    
    // PHASE 1: Mode-aware butter bounds
    if (ing.name.toLowerCase().includes('butter') && ing.fat_pct >= 75) {
      const butterMax = mode === 'kulfi' ? 0.15 : 0.08; // Kulfi allows 15% butter, others 8%
      maxGrams = Math.min(maxGrams, totalWeight * butterMax);
    }

    const variable: any = {
      deviation: 0, // We'll minimize deviation from targets
      movement: lambda, // Penalty for changing amounts (prefer minimal adjustments)
      // Contribution to constraints
      total_weight: 1, // Each gram contributes 1g to total weight
      fat_contribution: ing.fat_pct / 100,
      msnf_contribution: (ing.msnf_pct || 0) / 100,
      sugars_contribution: (ing.sugars_pct || 0) / 100,
      // Bounds
      [`min_${idx}`]: 1,
      [`max_${idx}`]: 1
    };
    
    model.variables[varName] = variable;

    // Store bounds in constraints
    model.constraints[`min_${idx}`] = { min: minGrams };
    model.constraints[`max_${idx}`] = { max: maxGrams };
  });

  // Constraint: Total weight can vary based on weightFlexibility setting
  model.constraints.total_weight = {
    min: totalWeight * (1 - weightFlexibility),
    max: totalWeight * (1 + weightFlexibility)
  };

  // Fat percentage target - WIDER tolerance
  if (targets.fat_pct !== undefined) {
    const targetFatGrams = (targets.fat_pct / 100) * totalWeight;
    const toleranceGrams = (tolerance / 100) * totalWeight;
    model.constraints.fat_contribution = {
      min: targetFatGrams - toleranceGrams * 1.5,
      max: targetFatGrams + toleranceGrams * 1.5
    };
  }

  // MSNF percentage target - WIDER tolerance
  if (targets.msnf_pct !== undefined) {
    const targetMSNFGrams = (targets.msnf_pct / 100) * totalWeight;
    const toleranceGrams = (tolerance / 100) * totalWeight;
    model.constraints.msnf_contribution = {
      min: targetMSNFGrams - toleranceGrams * 1.5,
      max: targetMSNFGrams + toleranceGrams * 1.5
    };
  }

  // Constraint 5: Sugars percentage target (check both property names)
  const sugarTarget = targets.totalSugars_pct ?? targets.sugars_pct;
  if (sugarTarget !== undefined) {
    const targetSugarsGrams = (sugarTarget / 100) * totalWeight;
    const toleranceGrams = (tolerance / 100) * totalWeight;
    model.constraints.sugars_contribution = {
      min: targetSugarsGrams - toleranceGrams * 1.5,
      max: targetSugarsGrams + toleranceGrams * 1.5
    };
  }

  // PHASE 1: Sorbet sugar enforcement (26-31% total sugars, NO dairy)
  const mode = options.mode || 'gelato';
  if (mode === 'sorbet') {
    // Enforce sorbet sugar range (overrides generic target if present)
    model.constraints.sugars_contribution = {
      min: 0.26 * totalWeight,
      max: 0.31 * totalWeight
    };
    
    // Block dairy additions by setting negative fat/MSNF coefficients to zero contribution
    initialRows.forEach((row, idx) => {
      const varName = `ing_${idx}`;
      if (row.ing.fat_pct > 1 || (row.ing.msnf_pct || 0) > 1) {
        // Force dairy ingredients to zero for sorbet
        model.constraints[`max_${idx}`] = { max: 0 };
      }
    });
  }

  try {
    // PHASE 2: Add LP Model debugging before solving
    console.log('🔧 LP Model Summary:');
    console.log('  Variables:', Object.keys(model.variables).length);
    console.log('  Constraints:', Object.keys(model.constraints).length);
    console.log('  Ingredient bounds:', initialRows.map((row, idx) => ({
      name: row.ing.name,
      initial: row.grams.toFixed(1) + 'g',
      min: model.constraints[`min_${idx}`]?.min || 'none',
      max: model.constraints[`max_${idx}`]?.max || 'none'
    })));

    // Solve the LP problem
    const result = solver.Solve(model);

    // PHASE 3: Enhanced LP failure diagnostics
    if (!result || result.feasible === false) {
      // Diagnose constraint conflicts
      const diagnostics = {
        conflictingConstraints: [] as string[]
      };

      // Check if fat target is achievable with available ingredients
      const maxFatPossible = initialRows.reduce((sum, row) => 
        sum + (row.grams * 5 * (row.ing.fat_pct / 100)), 0
      );
      const minFatPossible = initialRows.reduce((sum, row) => 
        sum + (row.grams * 0 * (row.ing.fat_pct / 100)), 0
      );
      
      const targetFatMin = (targets.fat_pct / 100 - tolerance / 100) * totalWeight;
      const targetFatMax = (targets.fat_pct / 100 + tolerance / 100) * totalWeight;
      
      if (targetFatMin > maxFatPossible || targetFatMax < minFatPossible) {
        diagnostics.conflictingConstraints.push(
          `Fat target ${targets.fat_pct}% (${targetFatMin.toFixed(1)}-${targetFatMax.toFixed(1)}g) ` +
          `is outside achievable range ${minFatPossible.toFixed(1)}-${maxFatPossible.toFixed(1)}g`
        );
      }

      // Check MSNF achievability
      const maxMSNFPossible = initialRows.reduce((sum, row) => 
        sum + (row.grams * 5 * (row.ing.msnf_pct / 100)), 0
      );
      const targetMSNFMin = (targets.msnf_pct / 100 - tolerance / 100) * totalWeight;
      const targetMSNFMax = (targets.msnf_pct / 100 + tolerance / 100) * totalWeight;
      
      if (targetMSNFMin > maxMSNFPossible) {
        diagnostics.conflictingConstraints.push(
          `MSNF target ${targets.msnf_pct}% (${targetMSNFMin.toFixed(1)}-${targetMSNFMax.toFixed(1)}g) ` +
          `exceeds max achievable ${maxMSNFPossible.toFixed(1)}g`
        );
      }

      // Check sugar achievability
      const maxSugarPossible = initialRows.reduce((sum, row) => 
        sum + (row.grams * 5 * (row.ing.sugars_pct / 100)), 0
      );
      const targetSugarMin = (targets.totalSugars_pct / 100 - tolerance / 100) * totalWeight;
      const targetSugarMax = (targets.totalSugars_pct / 100 + tolerance / 100) * totalWeight;
      
      if (targetSugarMin > maxSugarPossible) {
        diagnostics.conflictingConstraints.push(
          `Sugar target ${targets.totalSugars_pct}% (${targetSugarMin.toFixed(1)}-${targetSugarMax.toFixed(1)}g) ` +
          `exceeds max achievable ${maxSugarPossible.toFixed(1)}g`
        );
      }

      return {
        success: false,
        rows: initialRows,
        message: diagnostics.conflictingConstraints.length > 0
          ? `Cannot balance: ${diagnostics.conflictingConstraints[0]}`
          : 'LP solver encountered numerical issues',
        error: result?.feasible === false 
          ? 'Infeasible constraints: ' + diagnostics.conflictingConstraints.join('; ')
          : 'Solver failed to find solution'
      };
    }

    // Extract solution and build new rows
    const newRows: Row[] = initialRows.map((row, idx) => {
      const varName = `ing_${idx}`;
      const newGrams = result[varName] || row.grams;
      
      return {
        ...row,
        grams: Math.max(0, newGrams) // Ensure non-negative
      };
    }).filter(row => row.grams > 0.1); // Remove ingredients with negligible amounts

    // Validate solution
    const newMetrics = calcMetricsV2(newRows, { mode: options.mode });
    const weightError = Math.abs(newMetrics.total_g - totalWeight);

    if (weightError > 1) {
      // Normalize to preserve weight
      const scaleFactor = totalWeight / newMetrics.total_g;
      newRows.forEach(row => {
        row.grams *= scaleFactor;
      });
    }

    return {
      success: true,
      rows: newRows,
      message: 'LP solver found optimal solution'
    };

  } catch (error) {
    return {
      success: false,
      rows: initialRows,
      message: 'LP solver encountered an error',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ============================================================================
// FEASIBILITY VALIDATION & TARGET ANALYSIS
// ============================================================================

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

/**
 * Check if targets are theoretically achievable with available ingredients
 * IMPROVED: Now considers ingredients available in database, not just current recipe
 */
export function checkTargetFeasibility(
  rows: Row[],
  targets: OptimizeTarget,
  allIngredients: IngredientData[]
): FeasibilityReport {
  const suggestions: string[] = [];
  
  // Calculate current metrics
  const currentMetrics = calcMetricsV2(rows);
  
  // Find key ingredients in database for theoretical max calculations
  const hasSMP = allIngredients.some(ing => (ing.msnf_pct || 0) > 90); // Skim Milk Powder
  const hasButter = allIngredients.some(ing => ing.fat_pct > 80); // Butter/Anhydrous fat
  const hasHeavyCream = allIngredients.some(ing => ing.fat_pct > 30); // Heavy cream
  const hasWater = allIngredients.some(ing => ing.water_pct > 95);
  
  // Calculate SMARTER achievable ranges considering available substitutions
  const achievableRanges = {
    fat: { 
      min: hasWater ? 0 : Math.max(0, currentMetrics.fat_pct * 0.3),
      max: hasButter ? 35 : (hasHeavyCream ? 20 : currentMetrics.fat_pct * 2)
    },
    msnf: { 
      min: hasWater ? 0 : Math.max(0, currentMetrics.msnf_pct * 0.3),
      max: hasSMP ? 25 : currentMetrics.msnf_pct * 2  // SMP can achieve much higher MSNF!
    },
    nonLactoseSugars: { min: 0, max: 35 }
  };

  // Check if targets are within achievable ranges
  let feasible = true;
  let reason = '';

  if (targets.fat_pct !== undefined) {
    if (targets.fat_pct > achievableRanges.fat.max) {
      feasible = false;
      reason = `Fat target ${targets.fat_pct.toFixed(1)}% exceeds maximum achievable ${achievableRanges.fat.max.toFixed(1)}%`;
      if (!hasButter && !hasHeavyCream) {
        suggestions.push(`❌ CRITICAL: Add heavy cream (35%+ fat) or butter to your ingredient database`);
      } else {
        suggestions.push(`Increase high-fat ingredients`);
      }
    } else if (targets.fat_pct < achievableRanges.fat.min) {
      feasible = false;
      reason = `Fat target ${targets.fat_pct.toFixed(1)}% below minimum achievable ${achievableRanges.fat.min.toFixed(1)}%`;
      if (!hasWater) {
        suggestions.push(`❌ CRITICAL: Add water to your ingredient database to dilute fat`);
      } else {
        suggestions.push(`Replace cream with milk or add water`);
      }
    }
  }

  if (targets.msnf_pct !== undefined) {
    if (targets.msnf_pct > achievableRanges.msnf.max) {
      feasible = false;
      reason = reason || `MSNF target ${targets.msnf_pct.toFixed(1)}% exceeds maximum achievable ${achievableRanges.msnf.max.toFixed(1)}%`;
      if (!hasSMP) {
        suggestions.push(`❌ CRITICAL: Add skim milk powder (SMP) to your ingredient database`);
      } else {
        suggestions.push(`The balancer will add/increase skim milk powder to reach ${targets.msnf_pct.toFixed(1)}% MSNF`);
      }
    } else if (targets.msnf_pct < achievableRanges.msnf.min) {
      feasible = false;
      reason = reason || `MSNF target ${targets.msnf_pct.toFixed(1)}% below minimum achievable ${achievableRanges.msnf.min.toFixed(1)}%`;
      if (!hasWater) {
        suggestions.push(`❌ CRITICAL: Add water to your ingredient database to dilute MSNF`);
      } else {
        suggestions.push(`Replace milk with water and cream to maintain fat while reducing MSNF`);
      }
    }
  }

  if (!feasible && suggestions.length === 0) {
    suggestions.push('Adjust recipe composition or modify targets');
  }

  return { feasible, reason, suggestions, achievableRanges };
}

// ============================================================================
// PHASE 4: ITERATIVE BALANCING WITH SUBSTITUTIONS
// ============================================================================

export interface BalanceProgress {
  iteration: number;
  metrics: MetricsV2;
  adjustments: string[];
  score: number;
}

// ============================================================================
// PHASE 6: ICE CREAM SCIENCE VALIDATION
// ============================================================================

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

// Import from centralized productConstraints
import { 
  PRODUCT_CONSTRAINTS, 
  getConstraintsForMode,
  type ProductConstraint,
  type ConstraintRange 
} from './productConstraints';

// Re-export for backward compatibility
export { PRODUCT_CONSTRAINTS, getConstraintsForMode };
export type ProductConstraints = ProductConstraint;

/**
 * Validate recipe metrics against ice cream science constraints
 */
export function validateRecipeScience(
  metrics: MetricsV2,
  productType: string = 'gelato_white'
): ScienceValidation[] {
  const validations: ScienceValidation[] = [];
  const constraints = PRODUCT_CONSTRAINTS[productType] || PRODUCT_CONSTRAINTS.gelato_white;

  // Total Solids Validation
  const ts = metrics.ts_pct;
  const tsValidation = validateParameter(
    'Total Solids',
    ts,
    constraints.totalSolids.optimal,
    constraints.totalSolids.acceptable,
    '%'
  );
  if (tsValidation.severity === 'critical' && ts < constraints.totalSolids.acceptable[0]) {
    tsValidation.recommendation = 'Increase solids: add milk powder, reduce water, or increase sugar';
  } else if (tsValidation.severity === 'critical' && ts > constraints.totalSolids.acceptable[1]) {
    tsValidation.recommendation = 'Reduce solids: add water or reduce concentrated ingredients';
  }
  validations.push(tsValidation);

  // Fat Validation
  const fat = metrics.fat_pct;
  const fatValidation = validateParameter(
    'Fat',
    fat,
    constraints.fat.optimal,
    constraints.fat.acceptable,
    '%'
  );
  if (fatValidation.severity === 'critical' && fat < constraints.fat.acceptable[0]) {
    fatValidation.recommendation = 'Increase fat: add cream, butter, or egg yolk';
  } else if (fatValidation.severity === 'critical' && fat > constraints.fat.acceptable[1]) {
    fatValidation.recommendation = 'Reduce fat: replace cream with milk or add water';
  }
  validations.push(fatValidation);

  // MSNF Validation
  const msnf = metrics.msnf_pct;
  const msnfValidation = validateParameter(
    'MSNF',
    msnf,
    constraints.msnf.optimal,
    constraints.msnf.acceptable,
    '%'
  );
  if (msnfValidation.severity === 'critical' && msnf < constraints.msnf.acceptable[0]) {
    msnfValidation.recommendation = 'Increase MSNF: add skim milk powder or increase milk';
  } else if (msnfValidation.severity === 'critical' && msnf > constraints.msnf.acceptable[1]) {
    msnfValidation.recommendation = 'Reduce MSNF: replace milk with water and cream';
  }
  validations.push(msnfValidation);

  // FPDT Validation
  const fpdt = metrics.fpdt;
  const fpdtValidation = validateParameter(
    'FPDT',
    fpdt,
    constraints.fpdt.optimal,
    constraints.fpdt.acceptable,
    '°C'
  );
  if (fpdtValidation.severity === 'critical' && fpdt < constraints.fpdt.acceptable[0]) {
    fpdtValidation.recommendation = 'Too hard: increase sugars or use higher-FPDT sugars like dextrose';
  } else if (fpdtValidation.severity === 'critical' && fpdt > constraints.fpdt.acceptable[1]) {
    fpdtValidation.recommendation = 'Too soft: reduce sugars or use lower-FPDT sugars';
  }
  validations.push(fpdtValidation);

  return validations;
}

/**
 * Helper to validate a single parameter against optimal and acceptable ranges
 */
function validateParameter(
  name: string,
  value: number,
  optimal: [number, number],
  acceptable: [number, number],
  unit: string
): ScienceValidation {
  let severity: ValidationSeverity;
  let message: string;

  if (value >= optimal[0] && value <= optimal[1]) {
    severity = 'optimal';
    message = `${name} is in optimal range`;
  } else if (value >= acceptable[0] && value <= acceptable[1]) {
    severity = 'acceptable';
    if (value < optimal[0]) {
      message = `${name} is slightly low but acceptable`;
    } else {
      message = `${name} is slightly high but acceptable`;
    }
  } else if (value < acceptable[0] || value > acceptable[1]) {
    const diff = value < acceptable[0] 
      ? (acceptable[0] - value).toFixed(1)
      : (value - acceptable[1]).toFixed(1);
    severity = 'critical';
    message = value < acceptable[0]
      ? `${name} is ${diff}${unit} below acceptable minimum`
      : `${name} is ${diff}${unit} above acceptable maximum`;
  } else {
    severity = 'warning';
    message = `${name} is approaching limits`;
  }

  return {
    parameter: name,
    value,
    optimalRange: { min: optimal[0], max: optimal[1] },
    acceptableRange: { min: acceptable[0], max: acceptable[1] },
    severity,
    message
  };
}

/**
 * Get overall recipe quality score based on science validations
 */
export function getRecipeQualityScore(validations: ScienceValidation[]): {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  color: 'success' | 'warning' | 'destructive';
} {
  const weights = {
    optimal: 1.0,
    acceptable: 0.7,
    warning: 0.4,
    critical: 0.0
  };

  const totalScore = validations.reduce((sum, v) => sum + weights[v.severity], 0);
  const maxScore = validations.length;
  const score = (totalScore / maxScore) * 100;

  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  let color: 'success' | 'warning' | 'destructive';

  if (score >= 90) {
    grade = 'A';
    color = 'success';
  } else if (score >= 75) {
    grade = 'B';
    color = 'success';
  } else if (score >= 60) {
    grade = 'C';
    color = 'warning';
  } else if (score >= 50) {
    grade = 'D';
    color = 'warning';
  } else {
    grade = 'F';
    color = 'destructive';
  }

  return { score, grade, color };
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

/**
 * Score how close current metrics are to targets
 */
function scoreMetrics(metrics: MetricsV2, targets: OptimizeTarget): number {
  let score = 0;
  let count = 0;

  if (targets.fat_pct !== undefined) {
    score += Math.abs(metrics.fat_pct - targets.fat_pct);
    count++;
  }
  if (targets.msnf_pct !== undefined) {
    score += Math.abs(metrics.msnf_pct - targets.msnf_pct);
    count++;
  }
  
  // Check both sugar property names
  const sugarTarget = targets.totalSugars_pct ?? targets.sugars_pct;
  if (sugarTarget !== undefined) {
    score += Math.abs(metrics.totalSugars_pct - sugarTarget);
    count++;
  }
  
  if (targets.fpdt !== undefined) {
    score += Math.abs(metrics.fpdt - targets.fpdt) * 10; // Weight FPDT more heavily
    count++;
  }

  return count > 0 ? score / count : 0;
}

/**
 * Determine which parameter needs adjustment most urgently
 */
function identifyPriorityAdjustment(
  metrics: MetricsV2,
  targets: OptimizeTarget
): { parameter: 'fat' | 'msnf' | 'sugars' | null; direction: 'increase' | 'decrease' | null; delta: number } {
  let maxDelta = 0;
  let priority: 'fat' | 'msnf' | 'sugars' | null = null;
  let direction: 'increase' | 'decrease' | null = null;

  if (targets.fat_pct !== undefined) {
    const delta = Math.abs(metrics.fat_pct - targets.fat_pct);
    if (delta > maxDelta) {
      maxDelta = delta;
      priority = 'fat';
      direction = metrics.fat_pct > targets.fat_pct ? 'decrease' : 'increase';
    }
  }

  if (targets.msnf_pct !== undefined) {
    const delta = Math.abs(metrics.msnf_pct - targets.msnf_pct);
    if (delta > maxDelta) {
      maxDelta = delta;
      priority = 'msnf';
      direction = metrics.msnf_pct > targets.msnf_pct ? 'decrease' : 'increase';
    }
  }

  // Check both sugar property names
  const sugarTarget = targets.totalSugars_pct ?? targets.sugars_pct;
  if (sugarTarget !== undefined) {
    const delta = Math.abs(metrics.totalSugars_pct - sugarTarget);
    if (delta > maxDelta) {
      maxDelta = delta;
      priority = 'sugars';
      direction = metrics.totalSugars_pct > sugarTarget ? 'decrease' : 'increase';
    }
  }

  return { parameter: priority, direction, delta: maxDelta };
}

/**
 * Main balancing function - tries LP solver first, falls back to heuristic
 */
export function balanceRecipeV2(
  initialRows: Row[],
  targets: OptimizeTarget,
  allIngredients: IngredientData[],
  options: {
    maxIterations?: number;
    tolerance?: number;
    enableFeasibilityCheck?: boolean;
    useLPSolver?: boolean;
    productType?: string;
    enableScienceValidation?: boolean;
    allowCoreDairy?: boolean;
  } = {}
): BalanceResultV2 {
  const maxIterations = options.maxIterations || 200; // Increased from 50
  const tolerance = options.tolerance || 0.5; // Increased default tolerance to 0.5%
  const enableFeasibilityCheck = options.enableFeasibilityCheck !== false;
  const useLPSolver = options.useLPSolver !== false; // Default: try LP first
  const productType = options.productType || 'gelato_white';
  const enableScienceValidation = options.enableScienceValidation !== false;

  // Validation: Check for empty inputs
  if (!initialRows || initialRows.length === 0) {
    return {
      success: false,
      rows: [],
      metrics: {} as MetricsV2,
      originalMetrics: {} as MetricsV2,
      iterations: 0,
      progress: [],
      strategy: 'Validation Failed',
      message: 'No ingredients in recipe. Add ingredients before balancing.',
      adjustmentsSummary: ['Add at least one ingredient to the recipe']
    };
  }

  if (!allIngredients || allIngredients.length === 0) {
    return {
      success: false,
      rows: initialRows,
      metrics: calcMetricsV2(initialRows),
      originalMetrics: calcMetricsV2(initialRows),
      iterations: 0,
      progress: [],
      strategy: 'Validation Failed',
      message: 'No ingredients available in database for substitutions.',
      adjustmentsSummary: ['Ensure ingredient database is loaded']
    };
  }

  const originalMetrics = calcMetricsV2(initialRows);
  const progress: BalanceProgress[] = [];
  const adjustmentsSummary: string[] = [];

  // Step 0: Diagnose ingredient availability FIRST
  const diagnosis = diagnoseBalancingFailure(initialRows, allIngredients, targets);
  
  // If critical ingredients are missing from DATABASE, fail fast with helpful message
  if (diagnosis.missingIngredients.length > 0) {
    return {
      success: false,
      rows: initialRows,
      metrics: originalMetrics,
      originalMetrics,
      iterations: 0,
      progress: [],
      strategy: 'Database Check Failed',
      message: `⚠️ Cannot balance: Missing essential ingredients in database`,
      adjustmentsSummary: [
        `❌ Your ingredient database is missing: ${diagnosis.missingIngredients.join(', ')}`,
        '',
        '💡 To enable balancing, add these to your database:',
        ...diagnosis.suggestions.map(s => `   • ${s}`)
      ]
    };
  }

  // Step 0.5: Try LP Solver first with progressive tolerance relaxation
  if (useLPSolver && initialRows.length >= 2) {
    if (import.meta.env.DEV) console.log('🔧 Attempting LP Solver with progressive tolerance...');
    
    // Progressive tolerance: try 3.0 → 4.0 → 5.0 before failing
    const toleranceLevels = [3.0, 4.0, 5.0];
    let lpSuccess = false;
    let bestLpResult: LPSolverResult | null = null;
    let bestLpScore = Infinity;
    let bestLpMetrics: MetricsV2 | null = null;
    
    for (const tryTolerance of toleranceLevels) {
      if (import.meta.env.DEV) console.log(`  → Trying tolerance: ${tryTolerance}%`);
      
      const lpResult = balanceRecipeLP(initialRows, targets, { 
        tolerance: tryTolerance, 
        mode: resolveMode(productType),
        allowCoreDairy: options.allowCoreDairy,
        weightFlexibility: 0.05 // Allow ±5% weight variation
      });
      
      if (lpResult.success) {
        const lpMetrics = calcMetricsV2(lpResult.rows);
        const lpScore = scoreMetrics(lpMetrics, targets);
        
        if (import.meta.env.DEV) console.log(`  ✅ LP Solver succeeded at tolerance ${tryTolerance}% with score: ${(lpScore * 100).toFixed(2)}%`);
        
        // Track best result
        if (lpScore < bestLpScore) {
          bestLpScore = lpScore;
          bestLpResult = lpResult;
          bestLpMetrics = lpMetrics;
        }
        
        if (lpScore < tolerance) {
          lpSuccess = true;
          break; // Found a good solution, no need to try more
        }
      }
    }
    
    // Use best LP result if it's good enough
    if (bestLpResult && bestLpMetrics && bestLpScore < tolerance * 1.5) {
      const scienceValidation = enableScienceValidation 
        ? validateRecipeScience(bestLpMetrics, productType)
        : undefined;
      const qualityScore = scienceValidation 
        ? getRecipeQualityScore(scienceValidation)
        : undefined;

      return {
        success: true,
        rows: bestLpResult.rows,
        metrics: bestLpMetrics,
        originalMetrics,
        iterations: 1,
        progress: [{
          iteration: 0,
          metrics: bestLpMetrics,
          adjustments: ['LP Solver: Optimal solution found'],
          score: bestLpScore
        }],
        strategy: 'Linear Programming (Simplex)',
        message: `Optimal solution found using LP solver. Score: ${(bestLpScore * 100).toFixed(2)}%`,
        adjustmentsSummary: ['Linear Programming solver found mathematically optimal solution'],
        scienceValidation,
        qualityScore
      };
    } else if (!lpSuccess) {
      if (import.meta.env.DEV) console.log(`❌ LP solver failed at all tolerance levels. Falling back to heuristic approach.`);
      adjustmentsSummary.push(`LP solver could not find optimal solution. Trying heuristic approach.`);
    }
  }

  // Step 1: Check feasibility (now smarter - considers available ingredients)
  let feasibilityReport: FeasibilityReport | undefined;
  if (enableFeasibilityCheck) {
    feasibilityReport = checkTargetFeasibility(initialRows, targets, allIngredients);
    
    // Only fail if it's a CRITICAL missing ingredient (not just difficult targets)
    const hasCriticalMissing = feasibilityReport.suggestions.some(s => s.includes('❌ CRITICAL'));
    
    if (!feasibilityReport.feasible && hasCriticalMissing) {
      return {
        success: false,
        rows: initialRows,
        metrics: originalMetrics,
        originalMetrics,
        iterations: 0,
        progress: [],
        strategy: 'Feasibility Check V2 - Missing Ingredients',
        message: `Cannot achieve targets: ${feasibilityReport.reason}`,
        adjustmentsSummary: feasibilityReport.suggestions,
        feasibilityReport
      };
    } else if (!feasibilityReport.feasible) {
      // Not critical - just log it and try balancing anyway
      adjustmentsSummary.push(`⚠️ Challenging targets: ${feasibilityReport.reason}`);
      adjustmentsSummary.push(`Attempting balancing with substitutions...`);
    }
  }

  // Step 2: Iterative balancing with substitutions
  let currentRows = [...initialRows];
  let bestRows = [...initialRows];
  let bestScore = Infinity;
  const originalWeight = originalMetrics.total_g;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const currentMetrics = calcMetricsV2(currentRows);
    const score = scoreMetrics(currentMetrics, targets);

    // Track progress
    progress.push({
      iteration,
      metrics: currentMetrics,
      adjustments: [],
      score
    });

    // Check if we've achieved targets
    if (score < tolerance) {
      const scienceValidation = enableScienceValidation 
        ? validateRecipeScience(currentMetrics, productType)
        : undefined;
      const qualityScore = scienceValidation 
        ? getRecipeQualityScore(scienceValidation)
        : undefined;

      return {
        success: true,
        rows: currentRows,
        metrics: currentMetrics,
        originalMetrics,
        iterations: iteration + 1,
        progress,
        strategy: 'Substitution Rules V2',
        message: `Successfully balanced recipe in ${iteration + 1} iterations`,
        adjustmentsSummary,
        feasibilityReport,
        scienceValidation,
        qualityScore
      };
    }

    // Track best result
    if (score < bestScore) {
      bestScore = score;
      bestRows = [...currentRows];
    }

    // Identify priority adjustment
    const { parameter, direction, delta } = identifyPriorityAdjustment(currentMetrics, targets);
    
    if (!parameter || !direction) {
      break; // No more adjustments needed or possible
    }

    // Find applicable substitution rules
    const rules = OptimizeEngineV2.findRules(parameter, direction, 
      currentRows.map(r => r.ing));

    if (rules.length === 0) {
      // No rules available - may need different ingredients
      adjustmentsSummary.push(`No substitution rules found for ${parameter} ${direction}`);
      break; // Exit if no rules can be applied
    }

    // Apply the highest priority rule
    const rule = rules[0];
    
    // Calculate adjustment amount based on delta
    // Be conservative: adjust 20% of the needed change per iteration
    const adjustmentGrams = (delta / 100) * originalWeight * 0.2;
    
    const newRows = OptimizeEngineV2.applySubstitution(
      currentRows,
      rule,
      allIngredients,
      adjustmentGrams
    );

    // Validate weight preservation
    const newMetrics = calcMetricsV2(newRows);
    const weightDiff = Math.abs(newMetrics.total_g - originalWeight);
    
    if (weightDiff > 1) {
      // Weight changed too much, adjust to compensate
      const scaleFactor = originalWeight / newMetrics.total_g;
      currentRows = newRows.map(r => ({ ...r, grams: r.grams * scaleFactor }));
    } else {
      currentRows = newRows;
    }

    // Record adjustment
    const adjustmentMsg = `${rule.name}: ${parameter} ${direction} by ${delta.toFixed(2)}%`;
    adjustmentsSummary.push(adjustmentMsg);
    
    if (progress[progress.length - 1]) {
      progress[progress.length - 1].adjustments.push(adjustmentMsg);
    }
  }

  // Return best result found
  const finalMetrics = calcMetricsV2(bestRows);
  const finalScore = scoreMetrics(finalMetrics, targets);
  
  const scienceValidation = enableScienceValidation 
    ? validateRecipeScience(finalMetrics, productType)
    : undefined;
  const qualityScore = scienceValidation 
    ? getRecipeQualityScore(scienceValidation)
    : undefined;

  return {
    success: finalScore < tolerance * 3, // More lenient success criteria
    rows: bestRows,
    metrics: finalMetrics,
    originalMetrics,
    iterations: maxIterations,
    progress,
    strategy: 'Substitution Rules V2 (Max Iterations)',
    message: finalScore < tolerance * 3 
      ? `Recipe balanced within ${(finalScore * 100).toFixed(1)}% of targets`
      : `Could not fully balance recipe. Best score: ${finalScore.toFixed(2)}`,
    adjustmentsSummary,
    feasibilityReport,
    scienceValidation,
    qualityScore
  };
}

// ============================================================================
// EXPORT
// ============================================================================

export const RecipeBalancerV2 = {
  balance: balanceRecipeV2,
  balanceLP: balanceRecipeLP,
  checkFeasibility: checkTargetFeasibility,
  scoreMetrics
};
