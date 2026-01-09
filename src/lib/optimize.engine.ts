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

import { IngredientData } from '@/types/ingredients';
import { calcMetricsV2, MetricsV2, CalcOptionsV2 } from './calc.v2';
import { optimizeRecipe, OptimizeTarget, Row } from './optimize';
import { advancedOptimize } from './optimize.advanced';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type IngredientRole = 'fat_source' | 'msnf_source' | 'sugar_source' | 'water_source' | 'stabilizer' | 'flavor' | 'other';

export interface ClassifiedIngredient extends Row {
  roles: IngredientRole[];
  importance: number; // 1-10 scale for adjustment priority
}

export interface BalanceStrategy {
  name: string;
  description: string;
  execute: (rows: Row[], targets: OptimizeTarget, mode: 'gelato' | 'kulfi') => Row[];
}

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

// ============================================================================
// INGREDIENT CLASSIFICATION
// ============================================================================

function classifyIngredient(ing: IngredientData): { roles: IngredientRole[]; importance: number } {
  const roles: IngredientRole[] = [];
  let importance = 5; // Default medium importance
  
  const fat = ing.fat_pct ?? 0;
  const msnf = ing.msnf_pct ?? 0;
  const sugars = ing.sugars_pct ?? 0;
  const water = ing.water_pct ?? 0;
  const other = ing.other_solids_pct ?? 0;
  
  // Fat sources (cream, butter, oils)
  if (fat > 10) {
    roles.push('fat_source');
    importance = fat > 30 ? 9 : 7; // High-fat sources are very important
  }
  
  // MSNF sources (milk powder, milk, cream with MSNF)
  if (msnf > 8) {
    roles.push('msnf_source');
    importance = Math.max(importance, msnf > 80 ? 8 : 6);
  }
  
  // Sugar sources (pure sugars, syrups)
  if (sugars > 80) {
    roles.push('sugar_source');
    importance = 8; // Sugars are critical for texture
  }
  
  // Water sources (water, milk with high water)
  if (water > 85 && fat < 5 && msnf < 10) {
    roles.push('water_source');
    importance = 4; // Can be adjusted more freely
  }
  
  // Stabilizers
  if (other > 80 || ing.category === 'stabilizer') {
    roles.push('stabilizer');
    importance = 3; // Use sparingly
  }
  
  // Flavors (fruits, pastes, flavoring)
  if (ing.category === 'fruit' || ing.category === 'flavor') {
    roles.push('flavor');
    importance = 6; // Important for taste but adjustable
  }
  
  // If no specific role identified
  if (roles.length === 0) {
    roles.push('other');
  }
  
  return { roles, importance };
}

function classifyIngredients(rows: Row[]): ClassifiedIngredient[] {
  return rows.map(row => {
    const { roles, importance } = classifyIngredient(row.ing);
    return { ...row, roles, importance };
  });
}

// ============================================================================
// CHEMISTRY-AWARE ADJUSTMENTS
// ============================================================================

/**
 * Smart ingredient adjustment that understands chemistry
 * When adjusting one ingredient, compensate with chemically appropriate substitutes
 */
function chemistryAwareAdjustment(
  classified: ClassifiedIngredient[],
  targetParameter: keyof OptimizeTarget,
  targetValue: number,
  currentValue: number,
  mode: 'gelato' | 'kulfi'
): ClassifiedIngredient[] {
  const delta = targetValue - currentValue;
  const result = classified.map(c => ({ ...c }));
  
  // Calculate total weight for proper percentage-based adjustments
  const totalWeight = result.reduce((sum, c) => sum + c.grams, 0);
  
  // Determine which ingredients to adjust based on the target parameter
  let primarySources: ClassifiedIngredient[] = [];
  let compensationSources: ClassifiedIngredient[] = [];
  
  switch (targetParameter) {
    case 'fat_pct':
      primarySources = result.filter(c => c.roles.includes('fat_source') && !c.lock);
      compensationSources = result.filter(c => 
        (c.roles.includes('water_source') || c.roles.includes('msnf_source')) && !c.lock
      );
      break;
      
    case 'msnf_pct':
      // CRITICAL: For MSNF reduction, we need to be aggressive
      primarySources = result.filter(c => c.roles.includes('msnf_source') && !c.lock);
      compensationSources = result.filter(c => 
        c.roles.includes('water_source') && !c.lock
      );
      
      // If no water sources, can use fat sources with caution
      if (compensationSources.length === 0) {
        compensationSources = result.filter(c => 
          (c.roles.includes('fat_source') || c.roles.includes('other')) && !c.lock
        );
      }
      break;
      
    case 'sugars_pct':
    case 'totalSugars_pct':
      primarySources = result.filter(c => c.roles.includes('sugar_source') && !c.lock);
      compensationSources = result.filter(c => 
        c.roles.includes('water_source') && !c.lock
      );
      break;
      
    default:
      // For other targets, use all unlocked ingredients
      primarySources = result.filter(c => !c.lock);
      break;
  }
  
  if (primarySources.length === 0) {
    return result; // Can't adjust anything
  }
  
  // Calculate how many grams need to change to achieve the target percentage
  // For MSNF: If current is 12% and target is 11%, we need to reduce MSNF by 1% of total weight
  const gramsToChange = (delta / 100) * totalWeight;
  
  // Calculate total MSNF/Fat/Sugar content in primary sources
  let totalPrimaryContent = 0;
  for (const source of primarySources) {
    const ing = source.ing;
    switch (targetParameter) {
      case 'msnf_pct':
        totalPrimaryContent += (source.grams * (ing.msnf_pct ?? 0)) / 100;
        break;
      case 'fat_pct':
        totalPrimaryContent += (source.grams * (ing.fat_pct ?? 0)) / 100;
        break;
      case 'totalSugars_pct':
      case 'sugars_pct':
        totalPrimaryContent += (source.grams * (ing.sugars_pct ?? 0)) / 100;
        break;
      default:
        totalPrimaryContent += source.grams;
    }
  }
  
  if (totalPrimaryContent === 0) return result;
  
  // Adjust primary sources proportionally to their content
  for (const source of primarySources) {
    const ing = source.ing;
    let contentPct = 0;
    
    switch (targetParameter) {
      case 'msnf_pct':
        contentPct = (ing.msnf_pct ?? 0) / 100;
        break;
      case 'fat_pct':
        contentPct = (ing.fat_pct ?? 0) / 100;
        break;
      case 'totalSugars_pct':
      case 'sugars_pct':
        contentPct = (ing.sugars_pct ?? 0) / 100;
        break;
      default:
        contentPct = 1;
    }
    
    if (contentPct === 0) continue;
    
    // Calculate how much of this ingredient needs to change
    const currentContent = (source.grams * contentPct);
    const proportion = currentContent / totalPrimaryContent;
    const ingredientChange = (gramsToChange / contentPct) * proportion;
    
    source.grams = Math.max(
      source.min ?? 0,
      Math.min(source.max ?? 1e9, source.grams + ingredientChange)
    );
  }
  
  // Compensate with other sources to maintain weight
  if (compensationSources.length > 0) {
    const actualChange = result.reduce((sum, c) => sum + c.grams, 0) - totalWeight;
    const totalCompensation = compensationSources.reduce((sum, c) => sum + c.grams, 0);
    
    for (const source of compensationSources) {
      if (totalCompensation === 0) continue;
      const proportion = source.grams / totalCompensation;
      const compensationAmount = -actualChange * proportion;
      
      source.grams = Math.max(
        source.min ?? 0,
        Math.min(source.max ?? 1e9, source.grams + compensationAmount)
      );
    }
  }
  
  return result;
}

// ============================================================================
// OPTIMIZATION STRATEGIES
// ============================================================================

/**
 * Strategy 1: Basic hill climbing with weight preservation
 */
const basicHillClimbStrategy: BalanceStrategy = {
  name: 'basic_hill_climb',
  description: 'Standard hill climbing with multi-phase optimization',
  execute: (rows, targets, mode) => {
    return optimizeRecipe(rows, targets, mode, 1000, 1.0);
  }
};

/**
 * Strategy 2: Advanced hybrid optimization
 */
const advancedHybridStrategy: BalanceStrategy = {
  name: 'advanced_hybrid',
  description: 'Genetic algorithm + hill climbing hybrid',
  execute: (rows, targets, mode) => {
    try {
      return advancedOptimize(rows, targets, {
        algorithm: 'hybrid',
        maxIterations: 500
      });
    } catch (error) {
      console.warn('Advanced optimization failed, falling back to basic:', error);
      return optimizeRecipe(rows, targets, mode, 1000, 1.0);
    }
  }
};

/**
 * Strategy 3: Chemistry-aware targeted adjustment
 */
const chemistryAwareStrategy: BalanceStrategy = {
  name: 'chemistry_aware',
  description: 'Uses ingredient roles to make chemically appropriate adjustments',
  execute: (rows, targets, mode) => {
    const classified = classifyIngredients(rows);
    const opts: CalcOptionsV2 = { mode };
    
    let current = classified;
    let bestMetrics = calcMetricsV2(current, opts);
    let bestScore = Infinity;
    
    // Try adjusting each target parameter sequentially
    const targetParams: (keyof OptimizeTarget)[] = ['fat_pct', 'msnf_pct', 'totalSugars_pct', 'fpdt'];
    
    for (let iteration = 0; iteration < 5; iteration++) {
      for (const param of targetParams) {
        const targetValue = targets[param];
        if (targetValue == null) continue;
        
        const currentValue = param === 'totalSugars_pct' ? bestMetrics.totalSugars_pct :
                            param === 'fat_pct' ? bestMetrics.fat_pct :
                            param === 'msnf_pct' ? bestMetrics.msnf_pct :
                            param === 'fpdt' ? bestMetrics.fpdt : 0;
        
        if (Math.abs(currentValue - targetValue) < 0.5) continue; // Close enough
        
        // Make chemistry-aware adjustment
        current = chemistryAwareAdjustment(current, param, targetValue, currentValue, mode);
        
        // Maintain total weight
        const originalTotal = rows.reduce((sum, r) => sum + r.grams, 0);
        const newTotal = current.reduce((sum, r) => sum + r.grams, 0);
        if (Math.abs(newTotal - originalTotal) > 1) {
          const scale = originalTotal / newTotal;
          current.forEach(c => { if (!c.lock) c.grams *= scale; });
        }
        
        // Calculate new metrics
        const newMetrics = calcMetricsV2(current, opts);
        
        // Score the result
        let score = 0;
        if (targets.fat_pct) score += Math.abs(newMetrics.fat_pct - targets.fat_pct);
        if (targets.msnf_pct) score += Math.abs(newMetrics.msnf_pct - targets.msnf_pct);
        if (targets.totalSugars_pct) score += Math.abs(newMetrics.totalSugars_pct - targets.totalSugars_pct);
        if (targets.fpdt) score += Math.abs(newMetrics.fpdt - targets.fpdt) * 2;
        
        if (score < bestScore) {
          bestScore = score;
          bestMetrics = newMetrics;
        }
      }
      
      // Early exit if we're close enough
      if (bestScore < 1.0) break;
    }
    
    return current.map(c => ({ ing: c.ing, grams: c.grams, lock: c.lock, min: c.min, max: c.max }));
  }
};

// ============================================================================
// MAIN ENGINE
// ============================================================================

export class BalancingEngine {
  private strategies: BalanceStrategy[] = [
    basicHillClimbStrategy,
    chemistryAwareStrategy,
    advancedHybridStrategy
  ];
  
  /**
   * Balance a recipe using multiple strategies with fallbacks
   */
  balance(
    rows: Row[],
    targets: OptimizeTarget,
    mode: 'gelato' | 'kulfi' = 'gelato',
    preferredStrategy?: string
  ): BalanceResult {
    const originalTotal = rows.reduce((sum, r) => sum + r.grams, 0);
    const initialMetrics = calcMetricsV2(rows, { mode });
    
    // Sort strategies - preferred first, then by complexity
    const sortedStrategies = [...this.strategies];
    if (preferredStrategy) {
      sortedStrategies.sort((a, b) => 
        a.name === preferredStrategy ? -1 : b.name === preferredStrategy ? 1 : 0
      );
    }
    
    let bestResult: Row[] = rows;
    let bestMetrics = initialMetrics;
    let bestScore = this.scoreMetrics(initialMetrics, targets);
    let usedStrategy = 'none';
    let totalIterations = 0;
    
    // Try each strategy
    for (const strategy of sortedStrategies) {
      if (import.meta.env.DEV) {
        console.log(`🔧 Trying strategy: ${strategy.name}`);
      }
      
      try {
        const result = strategy.execute(rows, targets, mode);
        const metrics = calcMetricsV2(result, { mode });
        const score = this.scoreMetrics(metrics, targets);
        totalIterations++;
        
        // Verify weight is maintained
        const newTotal = result.reduce((sum, r) => sum + r.grams, 0);
        const weightError = Math.abs(newTotal - originalTotal);
        
        if (import.meta.env.DEV) {
          console.log(`  Score: ${score.toFixed(2)}, Weight error: ${weightError.toFixed(2)}g`);
        }
        
        // Accept if better and weight is maintained
        if (score < bestScore && weightError < 10) {
          bestResult = result;
          bestMetrics = metrics;
          bestScore = score;
          usedStrategy = strategy.name;
          
          // If score is very good, we can stop early
          if (score < 2.0) {
            if (import.meta.env.DEV) {
              console.log(`  ✅ Excellent result achieved, stopping early`);
            }
            break;
          }
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn(`  ⚠️ Strategy ${strategy.name} failed:`, error);
        }
        continue;
      }
    }
    
    // Build diagnostics
    const targetsMet: { [key: string]: boolean } = {};
    const adjustmentsMade: string[] = [];
    
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
    
    const success = bestScore < 5.0 && weightMaintained;
    
    return {
      success,
      rows: bestResult,
      metrics: bestMetrics,
      strategy: usedStrategy,
      iterations: totalIterations,
      diagnostics: {
        initialMetrics,
        targetsMet,
        adjustmentsMade,
        weightMaintained
      }
    };
  }
  
  /**
   * Score how close metrics are to targets (lower is better)
   */
  private scoreMetrics(metrics: MetricsV2, targets: OptimizeTarget): number {
    let score = 0;
    
    if (targets.fat_pct != null) {
      score += Math.abs(metrics.fat_pct - targets.fat_pct) * 1.5;
    }
    if (targets.msnf_pct != null) {
      score += Math.abs(metrics.msnf_pct - targets.msnf_pct) * 1.5;
    }
    if (targets.totalSugars_pct != null) {
      score += Math.abs(metrics.totalSugars_pct - targets.totalSugars_pct) * 1.0;
    }
    if (targets.sugars_pct != null) {
      score += Math.abs(metrics.nonLactoseSugars_pct - targets.sugars_pct) * 1.0;
    }
    if (targets.ts_pct != null) {
      score += Math.abs(metrics.ts_pct - targets.ts_pct) * 1.0;
    }
    if (targets.fpdt != null) {
      score += Math.abs(metrics.fpdt - targets.fpdt) * 2.5; // FPDT is critical
    }
    
    return score;
  }
}

// Export singleton instance
export const balancingEngine = new BalancingEngine();
