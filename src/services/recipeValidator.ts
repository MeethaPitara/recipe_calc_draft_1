/**
 * ENHANCED ML SERVICE - Professional Recipe Prediction & Optimization
 * 
 * This service eliminates the need for a chef or recipe consultant by providing:
 * 1. Scientific prediction based on Goff/Hartel + MP field experience
 * 2. Smart optimization using hybrid parameter system
 * 3. Actionable recommendations for manufacturers
 * 4. ML enhancement when training data becomes available
 */

import { calcMetricsV2 } from '@/lib/calcApi';
import { optimizeRecipe, Row, OptimizeTarget } from '@/lib/optimize';
import { IngredientData } from '@/types/ingredients';
import { getActiveParameters } from '@/services/productParametersService';

export interface OptimizationResult {
  optimizedRows: Row[];
  metrics: any;
  improvements: string[];
  costImpact: number; // percentage change
}

export class EnhancedMLService {
  // PHASE 4.4: predictRecipeSuccess (band-scoring against hardcoded ranges)
  // removed — it duplicated scienceConfig bands. Its only caller,
  // useRecipeValidation, had zero callers of its own (dead code) and was
  // deleted; Phase 7.2's backend diagnosis field is the replacement.

  /**
   * SMART RECIPE OPTIMIZATION
   * Uses hill-climbing algorithm + scientific target ranges
   */
  async optimizeRecipe(
    rows: { ing: IngredientData; grams: number }[],
    productType: string,
    targetMode: 'balanced' | 'soft' | 'firm' | 'custom' = 'balanced',
    customTargets?: Partial<OptimizeTarget>
  ): Promise<OptimizationResult> {
    const params = getActiveParameters();
    const productKey = this.mapProductType(productType);
    const bands = params.bands[productKey];

    if (!bands) {
      throw new Error(`Unknown product type: ${productType}`);
    }

    // CALCULATE TARGET MIDPOINTS (or use custom)
    const targets: OptimizeTarget = customTargets || {
      ts_pct: (bands.ts[0] + bands.ts[1]) / 2,
      fat_pct: (bands.fat[0] + bands.fat[1]) / 2,
      sugars_pct: (bands.sugars[0] + bands.sugars[1]) / 2,
      msnf_pct: (bands.msnf[0] + bands.msnf[1]) / 2,
      totalSugars_pct: (bands.sugars[0] + bands.sugars[1]) / 2,
      fpdt: 3.0 // Default target
    };

    // ADJUST FOR TEXTURE MODE
    if (targetMode === 'soft') {
      targets.fpdt = 3.3; // Higher FPDT = softer
      targets.fat_pct = bands.fat[0]; // Lower fat = softer
    } else if (targetMode === 'firm') {
      targets.fpdt = 2.7; // Lower FPDT = firmer
      targets.fat_pct = bands.fat[1]; // Higher fat = firmer
    }

    // CONVERT TO Row[] format
    const optimizeRows: Row[] = rows.map(r => ({
      ing: r.ing,
      grams: r.grams,
      min: 0,
      max: r.grams * 2 // Allow doubling
    }));

    // RUN OPTIMIZATION
    const originalMetrics = await calcMetricsV2(rows);
    const optimized = await optimizeRecipe(optimizeRows, targets, 'gelato', 150, 2);
    const newMetrics = await calcMetricsV2(optimized);

    // CALCULATE IMPROVEMENTS
    const improvements: string[] = [];
    if (Math.abs(newMetrics.ts_pct - targets.ts_pct!) < Math.abs(originalMetrics.ts_pct - targets.ts_pct!)) {
      improvements.push(`Total Solids optimized: ${originalMetrics.ts_pct.toFixed(1)}% → ${newMetrics.ts_pct.toFixed(1)}%`);
    }
    if (Math.abs(newMetrics.fpdt - targets.fpdt!) < Math.abs(originalMetrics.fpdt - targets.fpdt!)) {
      improvements.push(`FPDT improved: ${originalMetrics.fpdt.toFixed(2)}°C → ${newMetrics.fpdt.toFixed(2)}°C`);
    }
    if (Math.abs(newMetrics.nonLactoseSugars_pct - targets.sugars_pct!) < Math.abs(originalMetrics.nonLactoseSugars_pct - targets.sugars_pct!)) {
      improvements.push(`Sugars optimized: ${originalMetrics.nonLactoseSugars_pct.toFixed(1)}% → ${newMetrics.nonLactoseSugars_pct.toFixed(1)}%`);
    }

    // COST IMPACT
    const originalCost = rows.reduce((sum, r) => sum + (r.ing.cost_per_kg || 0) * r.grams, 0);
    const newCost = optimized.reduce((sum, r) => sum + (r.ing.cost_per_kg || 0) * r.grams, 0);
    const costImpact = ((newCost - originalCost) / originalCost) * 100;

    return {
      optimizedRows: optimized,
      metrics: newMetrics,
      improvements: improvements.length > 0 ? improvements : ['Recipe already optimal'],
      costImpact: Math.round(costImpact * 100) / 100
    };
  }

  /**
   * HELPER: Map product type strings to parameter keys
   */
  private mapProductType(productType: string): 'ice_cream' | 'gelato_white' | 'gelato_finished' | 'fruit_gelato' | 'sorbet' {
    const lower = productType.toLowerCase();
    if (lower.includes('ice') || lower.includes('cream')) return 'ice_cream';
    if (lower.includes('fruit')) return 'fruit_gelato';
    if (lower.includes('sorbet')) return 'sorbet';
    if (lower.includes('white') || lower.includes('base')) return 'gelato_white';
    return 'gelato_finished';
  }

  // PHASE 4.4: generateImprovement and generateExpertSuggestions removed —
  // both were only called by predictRecipeSuccess (also removed). They
  // duplicated band logic that now lives solely in scienceConfig.ts /
  // recipeDiagnosis.ts.

  /**
   * REVERSE ENGINEERING
   * Create recipe from target composition
   */
  async reverseEngineer(
    productType: string,
    targetComposition: Partial<{ fat_pct: number; msnf_pct: number; sugars_pct: number; ts_add_pct: number }>,
    availableIngredients: IngredientData[],
    totalBatchSize: number = 1000
  ): Promise<{ rows: Row[]; metrics: any; confidence: number }> {
    // Use scientific defaults if targets not provided
    const params = getActiveParameters();
    const productKey = this.mapProductType(productType);
    const bands = params.bands[productKey];

    const targets = {
      fat_pct: targetComposition.fat_pct || (bands.fat[0] + bands.fat[1]) / 2,
      msnf_pct: targetComposition.msnf_pct || (bands.msnf[0] + bands.msnf[1]) / 2,
      sugars_pct: targetComposition.sugars_pct || (bands.sugars[0] + bands.sugars[1]) / 2,
      ts_pct: targetComposition.ts_add_pct || (bands.ts[0] + bands.ts[1]) / 2
    };

    // Initialize rows
    const rows: Row[] = availableIngredients.map(ing => ({
      ing,
      grams: 0,
      min: 0,
      max: totalBatchSize
    }));

    // SEED STRATEGY: Start with base ingredients
    const milk = rows.find(r => r.ing.id.includes('milk') && !r.ing.id.includes('powder'));
    const cream = rows.find(r => r.ing.id.includes('cream'));
    const smp = rows.find(r => r.ing.id.includes('smp') || r.ing.id.toLowerCase().includes('skim'));
    const sucrose = rows.find(r => r.ing.id.includes('sucrose') || r.ing.name.toLowerCase().includes('sucrose'));
    const dextrose = rows.find(r => r.ing.id.includes('dextrose'));

    // Base liquid (milk) - 60-70% of batch
    if (milk) {
      milk.grams = totalBatchSize * 0.65;
    }

    // Fat source (cream)
    if (cream) {
      const targetFatGrams = (targets.fat_pct / 100) * totalBatchSize;
      const fatFromMilk = milk ? (milk.grams * (milk.ing.fat_pct / 100)) : 0;
      const neededFat = targetFatGrams - fatFromMilk;
      cream.grams = Math.max(0, neededFat / (cream.ing.fat_pct / 100));
    }

    // MSNF source (SMP)
    if (smp) {
      const targetMsnfGrams = (targets.msnf_pct / 100) * totalBatchSize;
      const msnfFromMilk = milk ? (milk.grams * (milk.ing.msnf_pct / 100)) : 0;
      const neededMsnf = targetMsnfGrams - msnfFromMilk;
      smp.grams = Math.max(0, neededMsnf / (smp.ing.msnf_pct / 100));
    }

    // Sugars (70% sucrose, 30% dextrose for texture)
    const currentWeight = rows.reduce((sum, r) => sum + r.grams, 0);
    const targetSugarGrams = (targets.sugars_pct / 100) * totalBatchSize;

    if (sucrose) {
      sucrose.grams = targetSugarGrams * 0.70;
    }
    if (dextrose) {
      dextrose.grams = targetSugarGrams * 0.30;
    }

    // Balance to total batch size with water
    const water = rows.find(r => r.ing.id.includes('water') || r.ing.name.toLowerCase() === 'water');
    if (water) {
      const currentTotal = rows.reduce((sum, r) => sum + r.grams, 0);
      water.grams = Math.max(0, totalBatchSize - currentTotal);
    }

    // OPTIMIZE to exact targets
    const optimized = await optimizeRecipe(rows, targets, 'gelato', 200, 2);
    const metrics = await calcMetricsV2(optimized);

    // Calculate confidence based on how close we got
    const fatError = Math.abs(metrics.fat_pct - targets.fat_pct) / targets.fat_pct;
    const sugarError = Math.abs(metrics.nonLactoseSugars_pct - targets.sugars_pct) / targets.sugars_pct;
    const confidence = Math.max(0, 1 - (fatError + sugarError) / 2);

    return {
      rows: optimized.filter(r => r.grams > 0.1), // Remove trace amounts
      metrics,
      confidence: Math.round(confidence * 100) / 100
    };
  }
}

export const recipeValidator = new EnhancedMLService();
