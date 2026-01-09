import type { Row, OptimizeTarget } from './optimize';
import type { IngredientData } from '@/types/ingredients';
import { findCanonical } from './ingredientMapper';
import type { Mode } from '@/types/mode';

/**
 * Feasibility analysis for recipe balancing
 * Hard gate to prevent infeasible balance attempts
 */

export interface Feasibility {
  feasible: boolean;
  reason?: string;
  suggestions: string[];
  flags: {
    hasWater: boolean;
    hasFatSource: boolean;
    hasMSNFSource: boolean;
    hasSugarSource: boolean;
  };
  missingCanonicals?: Array<'water' | 'cream35' | 'butter' | 'smp'>;
}

export interface AutoFixResult {
  applied: boolean;
  addedIngredients: Array<{ name: string; grams: number; reason: string }>;
  message: string;
}

/**
 * Pre-flight feasibility check before balancing
 * More strict than diagnoseBalancingFailure - hard gate
 * @param rows - Current recipe rows
 * @param allIngredients - Full ingredient database
 * @param targets - Target ranges for balancing
 * @param mode - Product mode ('gelato' | 'ice_cream' | 'sorbet' | 'kulfi')
 * @returns Feasibility report with actionable suggestions
 */
export function diagnoseFeasibility(
  rows: Row[],
  allIngredients: IngredientData[],
  targets: OptimizeTarget,
  mode?: 'gelato' | 'ice_cream' | 'sorbet' | 'kulfi'
): Feasibility {
  const suggestions: string[] = [];
  
  // Check recipe ingredients AND database availability
  const hasWaterInRecipe = rows.some(r => r.ing.water_pct >= 80);
  const hasWaterInDB = allIngredients.some(ing => ing.water_pct >= 95);
  const hasWater = hasWaterInRecipe || hasWaterInDB;
  
  const hasFatInRecipe = rows.some(r => r.ing.fat_pct >= 2);
  const hasFatSourceInDB = allIngredients.some(ing => ing.fat_pct >= 30);
  const hasFatSource = hasFatInRecipe || hasFatSourceInDB;
  
  const hasMSNFInRecipe = rows.some(r => (r.ing.msnf_pct || 0) >= 5);
  const hasMSNFSourceInDB = allIngredients.some(ing => (ing.msnf_pct || 0) >= 85);
  const hasMSNFSource = hasMSNFInRecipe || hasMSNFSourceInDB;
  
  const hasSugarInRecipe = rows.some(r => (r.ing.sugars_pct || 0) >= 90);
  const hasSugarSource = hasSugarInRecipe || 
    allIngredients.some(ing => (ing.sugars_pct || 0) >= 90);
  
  // SORBET-SPECIFIC CHECKS
  if (mode === 'sorbet') {
    // Block dairy additions
    const hasDairy = rows.some(r => 
      r.ing.category === 'dairy' || 
      (r.ing.fat_pct > 2 && r.ing.msnf_pct && r.ing.msnf_pct > 2)
    );
    
    if (hasDairy) {
      suggestions.unshift('⚠️ Sorbet should not contain dairy - remove milk/cream');
    }
    
    // Suggest fruit % tiers
    const fruitGrams = rows
      .filter(r => r.ing.category === 'fruit')
      .reduce((sum, r) => sum + r.grams, 0);
    const totalGrams = rows.reduce((sum, r) => sum + r.grams, 0);
    const fruitPct = (fruitGrams / totalGrams) * 100;
    
    if (fruitPct < 15) {
      suggestions.push('Consider: Strong fruit sorbet = 15-35% fruit');
    } else if (fruitPct < 35) {
      suggestions.push('Current: Strong fruit tier (15-35%)');
    } else if (fruitPct < 55) {
      suggestions.push('Current: Medium fruit tier (35-55%)');
    } else {
      suggestions.push('Current: Weak fruit tier (55-75%)');
    }
    
    // Must have sugars 26-31%
    if (!hasSugarSource) {
      suggestions.unshift('Add Sucrose/Dextrose (target 26-31% total sugars)');
      return {
        feasible: false,
        reason: 'Sorbet requires sugar source (26-31% total sugars)',
        suggestions,
        flags: { hasWater, hasFatSource, hasMSNFSource, hasSugarSource }
      };
    }
  }
  
  // Build suggestions for missing ingredients
  if (!hasWater) {
    suggestions.push('Add "Water" ingredient (diluent for dilution)');
  }
  
  if (!hasFatSource && targets.fat_pct !== undefined) {
    suggestions.push('Add "Heavy Cream 35%" or "Butter" (fat adjustment)');
  }
  
  if (!hasMSNFSource && targets.msnf_pct !== undefined) {
    suggestions.push('Add "Skim Milk Powder (SMP)" (MSNF adjustment independent of fat)');
  }
  
  if (!hasSugarSource) {
    suggestions.push('Add "Sucrose" or "Dextrose" (sweetness and FPD control)');
  }
  
  // Check ingredient count
  if (rows.length < 3) {
    suggestions.push(`Add more ingredients (current: ${rows.length}, minimum: 3+)`);
  }
  
  // Determine feasibility
  const feasible = hasWater && 
                   (hasFatSource || targets.fat_pct === undefined) &&
                   (hasMSNFSource || targets.msnf_pct === undefined) &&
                   rows.length >= 3;
  
  let reason: string | undefined;
  if (!feasible) {
    if (rows.length < 3) {
      reason = 'Recipe too simple - need at least 3 ingredients for balancing';
    } else if (!hasWater) {
      reason = 'Missing water/diluent - cannot adjust concentrations';
    } else if (!hasFatSource && targets.fat_pct !== undefined) {
      reason = 'Missing high-fat ingredient (cream/butter) in recipe or database';
    } else if (!hasMSNFSource && targets.msnf_pct !== undefined) {
      reason = 'Missing MSNF source (skim milk powder) in recipe or database';
    }
  }
  
  const missingCanonicals: Array<'water' | 'cream35' | 'butter' | 'smp'> = [];
  if (!hasWater) missingCanonicals.push('water');
  if (!hasFatSource && (!mode || mode !== 'sorbet')) missingCanonicals.push('cream35');
  if (!hasMSNFSource && (!mode || mode !== 'sorbet')) missingCanonicals.push('smp');
  
  return {
    feasible,
    reason,
    suggestions,
    flags: {
      hasWater,
      hasFatSource,
      hasMSNFSource,
      hasSugarSource
    },
    missingCanonicals
  };
}

/**
 * Apply minimal auto-fix to add missing balancing ingredients
 * Enhanced to calculate proportional amounts based on gap
 * @param rows - Current recipe rows
 * @param allIngredients - Full ingredient database
 * @param mode - Product mode ('gelato' | 'ice_cream' | 'sorbet' | 'kulfi')
 * @param feasibility - Feasibility report
 * @param currentMetrics - Optional current metrics for gap-based calculations
 * @param targets - Optional targets for gap-based calculations
 */
export function applyAutoFix(
  rows: Row[],
  allIngredients: IngredientData[],
  mode: 'gelato' | 'ice_cream' | 'sorbet' | 'kulfi',
  feasibility: Feasibility,
  currentMetrics?: { fat_pct: number; msnf_pct: number; totalSugars_pct: number },
  targets?: { fat_pct: number; msnf_pct: number; totalSugars_pct: number }
): AutoFixResult {
  const added: Array<{ name: string; grams: number; reason: string }> = [];
  const totalWeight = rows.reduce((sum, r) => sum + r.grams, 0);
  
  // Calculate gaps for proportional additions
  const fatGap = targets && currentMetrics ? targets.fat_pct - currentMetrics.fat_pct : 0;
  const msnfGap = targets && currentMetrics ? targets.msnf_pct - currentMetrics.msnf_pct : 0;
  const sugarGap = targets && currentMetrics ? targets.totalSugars_pct - currentMetrics.totalSugars_pct : 0;
  
  // Don't auto-fix sorbet with dairy
  if (mode === 'sorbet') {
    if (!feasibility.flags.hasSugarSource || sugarGap > 2) {
      const sucrose = allIngredients.find(i => i.name.toLowerCase().includes('sucrose'));
      if (sucrose) {
        // Proportional: ~15g sugar per 1% gap, or 20% baseline
        const gramsToAdd = sugarGap > 0 
          ? Math.max(totalWeight * 0.15, sugarGap * 15)
          : totalWeight * 0.20;
        added.push({ 
          name: sucrose.name, 
          grams: gramsToAdd,
          reason: sugarGap > 0 
            ? `+${sugarGap.toFixed(1)}% sugars needed` 
            : 'Sugar source for sorbet' 
        });
      }
    }
    return {
      applied: added.length > 0,
      addedIngredients: added,
      message: added.length > 0 ? '🛠️ Auto-added sugars for sorbet' : 'No auto-fix needed'
    };
  }
  
  // Auto-fix dairy products (gelato/ice_cream/kulfi)
  if (!feasibility.flags.hasWater) {
    const water = allIngredients.find(i => i.water_pct >= 95);
    if (water) {
      added.push({ 
        name: water.name, 
        grams: totalWeight * 0.02, // 2% of batch
        reason: 'Diluent for concentration control' 
      });
    }
  }
  
  // Fat adjustment: ~15g cream per 1% fat gap (cream is ~35% fat)
  if (!feasibility.flags.hasFatSource || fatGap > 2) {
    const cream = allIngredients.find(i => 
      findCanonical(i) === 'cream_35' || findCanonical(i) === 'butter'
    );
    if (cream) {
      // Calculate proportional amount: for 35% cream, need ~28g per 1% fat
      const gramsToAdd = fatGap > 0 
        ? Math.max(totalWeight * 0.03, fatGap * 28)
        : totalWeight * 0.03;
      added.push({ 
        name: cream.name, 
        grams: gramsToAdd,
        reason: fatGap > 0 
          ? `+${fatGap.toFixed(1)}% fat needed` 
          : 'Fat adjustment' 
      });
    }
  }
  
  // MSNF adjustment: ~12g SMP per 1% MSNF gap (SMP is ~95% MSNF)
  if (!feasibility.flags.hasMSNFSource || msnfGap > 2) {
    const smp = allIngredients.find(i => findCanonical(i) === 'smp');
    if (smp) {
      // Calculate proportional amount: for 95% SMP, need ~10g per 1% MSNF
      const gramsToAdd = msnfGap > 0 
        ? Math.max(totalWeight * 0.01, msnfGap * 10)
        : totalWeight * 0.01;
      added.push({ 
        name: smp.name, 
        grams: gramsToAdd,
        reason: msnfGap > 0 
          ? `+${msnfGap.toFixed(1)}% MSNF needed` 
          : 'MSNF adjustment' 
      });
    }
  }
  
  return {
    applied: added.length > 0,
    addedIngredients: added,
    message: added.length > 0 
      ? `🛠️ Auto-fix: ${added.map(a => `+${a.grams.toFixed(0)}g ${a.name}`).join(', ')}`
      : 'Recipe has all required levers'
  };
}
