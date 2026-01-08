/**
 * ENHANCED ML SERVICE - Professional Recipe Prediction & Optimization
 * 
 * This service eliminates the need for a chef or recipe consultant by providing:
 * 1. Scientific prediction based on Goff/Hartel + MP field experience
 * 2. Smart optimization using hybrid parameter system
 * 3. Actionable recommendations for manufacturers
 * 4. ML enhancement when training data becomes available
 */

import { calcMetricsV2 } from '@/lib/calc.v2';
import { optimizeRecipe, Row, OptimizeTarget } from '@/lib/optimize';
import { IngredientData } from '@/types/ingredients';
import { getActiveParameters } from '@/services/productParametersService';

export interface RecipePrediction {
  status: 'pass' | 'warn' | 'fail';
  score: number;
  confidence: number;
  suggestions: string[];
  warnings: string[];
  improvements: ActionableImprovement[];
}

export interface ActionableImprovement {
  ingredient: string;
  action: 'increase' | 'decrease' | 'add' | 'remove';
  amount: number; // grams
  reason: string;
  impact: 'critical' | 'high' | 'medium' | 'low';
}

export interface OptimizationResult {
  optimizedRows: Row[];
  metrics: any;
  improvements: string[];
  costImpact: number; // percentage change
}

export class EnhancedMLService {
  /**
   * CORE PREDICTION ENGINE
   * Uses scientific ranges from hybrid parameter system
   * Works IMMEDIATELY without training data
   */
  predictRecipeSuccess(metrics: any, productType: string): RecipePrediction {
    const params = getActiveParameters();
    const productKey = this.mapProductType(productType);
    const bands = params.bands[productKey];

    if (!bands) {
      return {
        status: 'warn',
        score: 50,
        confidence: 0.3,
        suggestions: ['Product type not recognized - using default parameters'],
        warnings: ['Cannot validate without product type'],
        improvements: []
      };
    }

    let score = 100;
    const suggestions: string[] = [];
    const warnings: string[] = [];
    const improvements: ActionableImprovement[] = [];

    // CRITICAL PARAMETERS (40% of score)
    const criticalChecks = [
      { 
        key: 'ts', 
        value: metrics.ts_add_pct, 
        range: bands.ts, 
        weight: 15,
        label: 'Total Solids',
        unit: '%'
      },
      { 
        key: 'pac', 
        value: metrics.pac, 
        range: bands.pac, 
        weight: 15,
        label: 'PAC (Anti-freeze)',
        unit: ''
      },
      { 
        key: 'sp', 
        value: metrics.sp, 
        range: bands.sp, 
        weight: 10,
        label: 'Sweetness Point',
        unit: ''
      }
    ];

    // COMPOSITION PARAMETERS (40% of score)
    const compositionChecks = [
      { 
        key: 'fat', 
        value: metrics.fat_pct, 
        range: bands.fat, 
        weight: 15,
        label: 'Fat Content',
        unit: '%',
        critical: productType !== 'sorbet'
      },
      { 
        key: 'sugars', 
        value: metrics.sugars_pct, 
        range: bands.sugars, 
        weight: 15,
        label: 'Sugar Content',
        unit: '%'
      },
      { 
        key: 'msnf', 
        value: metrics.msnf_pct, 
        range: bands.msnf, 
        weight: 10,
        label: 'MSNF (Milk Solids)',
        unit: '%',
        critical: productType !== 'sorbet'
      }
    ];

    // OPTIONAL PARAMETERS (20% of score)
    const optionalChecks = [];
    if (bands.stabilizer) {
      optionalChecks.push({
        key: 'stabilizer',
        value: metrics.stabilizer_pct || 0,
        range: bands.stabilizer,
        weight: 10,
        label: 'Stabilizer',
        unit: '%'
      });
    }
    if (bands.fruitPct && productType === 'sorbet') {
      optionalChecks.push({
        key: 'fruitPct',
        value: metrics.fruit_pct || 0,
        range: bands.fruitPct,
        weight: 10,
        label: 'Fruit Content',
        unit: '%'
      });
    }

    // EVALUATE ALL PARAMETERS
    const allChecks = [...criticalChecks, ...compositionChecks, ...optionalChecks];
    
    allChecks.forEach(check => {
      const [min, max] = check.range;
      const value = check.value || 0;
      
      if (value < min) {
        const deficit = ((min - value) / min) * 100;
        const penalty = (deficit / 100) * check.weight;
        score -= penalty;

        const severity: 'critical' | 'high' | 'medium' = 
          deficit > 30 ? 'critical' : deficit > 15 ? 'high' : 'medium';

        warnings.push(`${check.label} too low: ${value.toFixed(1)}${check.unit} (target: ${min}-${max}${check.unit})`);
        
        // Generate actionable improvement
        const suggestedIncrease = (min - value) * 1.1; // Add 10% buffer
        this.generateImprovement(check.key, 'increase', suggestedIncrease, check.label, severity, improvements);

      } else if (value > max) {
        const excess = ((value - max) / max) * 100;
        const penalty = (excess / 100) * check.weight;
        score -= penalty;

        const severity: 'critical' | 'high' | 'medium' = 
          excess > 30 ? 'critical' : excess > 15 ? 'high' : 'medium';

        warnings.push(`${check.label} too high: ${value.toFixed(1)}${check.unit} (target: ${min}-${max}${check.unit})`);
        
        // Generate actionable improvement
        const suggestedDecrease = (value - max) * 1.1; // Remove 10% buffer
        this.generateImprovement(check.key, 'decrease', suggestedDecrease, check.label, severity, improvements);
      }
    });

    // GENERATE EXPERT RECOMMENDATIONS
    this.generateExpertSuggestions(metrics, productType, bands, suggestions);

    // CALCULATE CONFIDENCE based on how many parameters we could validate
    const validatedParams = allChecks.filter(c => c.value !== undefined && c.value > 0).length;
    const confidence = Math.min(0.95, validatedParams / allChecks.length);

    // FINAL SCORE & STATUS
    score = Math.max(0, Math.min(100, score));
    const status: 'pass' | 'warn' | 'fail' = 
      score >= 85 ? 'pass' : 
      score >= 65 ? 'warn' : 
      'fail';

    return {
      status,
      score: Math.round(score),
      confidence: Math.round(confidence * 100) / 100,
      suggestions: suggestions.length > 0 ? suggestions : ['Recipe is well-balanced!'],
      warnings,
      improvements: improvements.sort((a, b) => {
        const impactOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return impactOrder[a.impact] - impactOrder[b.impact];
      })
    };
  }

  /**
   * SMART RECIPE OPTIMIZATION
   * Uses hill-climbing algorithm + scientific target ranges
   */
  optimizeRecipe(
    rows: { ing: IngredientData; grams: number }[],
    productType: string,
    targetMode: 'balanced' | 'soft' | 'firm' | 'custom' = 'balanced',
    customTargets?: Partial<OptimizeTarget>
  ): OptimizationResult {
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
      targets.fpdt = 2.7; // Lower FPDT = softer
      targets.fat_pct = bands.fat[0]; // Lower fat = softer
    } else if (targetMode === 'firm') {
      targets.fpdt = 3.3; // Higher FPDT = firmer
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
    const originalMetrics = calcMetricsV2(rows);
    const optimized = optimizeRecipe(optimizeRows, targets, 'gelato', 150, 2);
    const newMetrics = calcMetricsV2(optimized);

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

  /**
   * HELPER: Generate actionable improvements
   */
  private generateImprovement(
    parameter: string,
    action: 'increase' | 'decrease' | 'add' | 'remove',
    amount: number,
    label: string,
    impact: 'critical' | 'high' | 'medium' | 'low',
    improvements: ActionableImprovement[]
  ) {
    const ingredientMap: { [key: string]: string } = {
      'fat': 'Cream 25%',
      'msnf': 'Skim Milk Powder',
      'sugar': 'Sucrose',
      'pac': 'Dextrose',
      'ts': 'Skim Milk Powder',
      'stabilizer': 'Stabilizer Mix'
    };

    const reasonMap: { [key: string]: string } = {
      'fat': 'affects creaminess and mouthfeel',
      'msnf': 'affects body and texture',
      'sugar': 'affects sweetness and freezing point',
      'pac': 'controls anti-freeze performance',
      'ts': 'affects overall structure',
      'stabilizer': 'prevents ice crystal formation'
    };

    improvements.push({
      ingredient: ingredientMap[parameter] || label,
      action,
      amount: Math.abs(amount),
      reason: reasonMap[parameter] || 'balances composition',
      impact
    });
  }

  /**
   * HELPER: Generate expert suggestions based on product type and composition
   */
  private generateExpertSuggestions(
    metrics: any,
    productType: string,
    bands: any,
    suggestions: string[]
  ) {
    // Ice Cream specific
    if (productType.toLowerCase().includes('ice') || productType.toLowerCase().includes('cream')) {
      if (metrics.fat_pct < 12) {
        suggestions.push('Add heavy cream for richer mouthfeel and slower melting');
      }
      if (metrics.pac < 24) {
        suggestions.push('Increase PAC with dextrose to improve scoopability');
      }
      if (!metrics.stabilizer_pct || metrics.stabilizer_pct < 0.2) {
        suggestions.push('Consider adding 0.3-0.5% stabilizer for smoother texture');
      }
    }

    // Gelato specific
    if (productType.toLowerCase().includes('gelato')) {
      if (metrics.fat_pct > 10) {
        suggestions.push('Reduce fat to achieve authentic gelato density (4-9% target)');
      }
      if (metrics.msnf_pct < 9) {
        suggestions.push('Increase MSNF with skim milk powder for proper body');
      }
      if (metrics.overrun && metrics.overrun > 40) {
        suggestions.push('Reduce overrun to 20-35% for dense gelato texture');
      }
    }

    // Sorbet specific
    if (productType.toLowerCase().includes('sorbet')) {
      if (metrics.fat_pct > 1) {
        suggestions.push('Remove fat sources for authentic sorbet (fat-free target)');
      }
      if (metrics.sugars_pct < 26) {
        suggestions.push('Increase sugar to 26-30% to prevent icy texture');
      }
      if (!metrics.fruit_pct || metrics.fruit_pct < 35) {
        suggestions.push('Add fruit puree to reach 35-75% fruit content');
      }
      if (metrics.pac < 28) {
        suggestions.push('Boost PAC with glucose syrup DE40 for smoother scooping');
      }
    }

    // General recommendations
    if (metrics.fpdt && metrics.fpdt < -3) {
      suggestions.push('Freezing point too low - reduce sugar or PAC to improve texture');
    }
    if (metrics.fpdt && metrics.fpdt > -2) {
      suggestions.push('Freezing point too high - increase sugar or add dextrose');
    }
  }

  /**
   * REVERSE ENGINEERING
   * Create recipe from target composition
   */
  reverseEngineer(
    productType: string,
    targetComposition: Partial<{ fat_pct: number; msnf_pct: number; sugars_pct: number; ts_add_pct: number }>,
    availableIngredients: IngredientData[],
    totalBatchSize: number = 1000
  ): { rows: Row[]; metrics: any; confidence: number } {
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
    const optimized = optimizeRecipe(rows, targets, 'gelato', 200, 2);
    const metrics = calcMetricsV2(optimized);

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
