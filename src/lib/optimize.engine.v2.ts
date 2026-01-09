/**
 * Advanced Balancing Engine V2
 * Multi-role classification with intelligent substitution rules
 */

import type { Row, OptimizeTarget } from './optimize';
import type { IngredientData } from '@/types/ingredients';
import type { MetricsV2 } from './calc.v2';
import { calcMetricsV2 } from './calc.v2';
import { findIngredientByGenericId, findCanonical } from './ingredientMapper';

// ============================================================================
// PHASE 1: ENHANCED INGREDIENT CLASSIFICATION
// ============================================================================

export type IngredientRole = 
  | 'fat_source' 
  | 'msnf_source' 
  | 'water_source' 
  | 'sugar_source' 
  | 'stabilizer' 
  | 'flavor'
  | 'other';

export interface RoleWeight {
  role: IngredientRole;
  weight: number; // 0.0 to 1.0, how strongly ingredient fulfills this role
}

export interface IngredientClassification {
  ingredient: IngredientData;
  roles: RoleWeight[];
  flexibility: number; // 0.0 to 1.0, how freely this ingredient can be adjusted
  category: string;
  isLocked: boolean; // if true, this ingredient should not be adjusted
}

/**
 * Classify a single ingredient with multiple roles and flexibility score
 */
export function classifyIngredientV2(ing: IngredientData): IngredientClassification {
  const roles: RoleWeight[] = [];
  let flexibility = 0.5; // default medium flexibility
  let isLocked = false;

  const name = ing.name.toLowerCase();
  const cat = ing.category;

  // Fat source classification
  if (ing.fat_pct > 20) {
    roles.push({ role: 'fat_source', weight: 1.0 }); // Heavy cream, butter
    flexibility = 0.7;
  } else if (ing.fat_pct > 10) {
    roles.push({ role: 'fat_source', weight: 0.8 }); // Light cream
    flexibility = 0.6;
  } else if (ing.fat_pct > 2) {
    roles.push({ role: 'fat_source', weight: 0.4 }); // Whole milk
    flexibility = 0.6;
  }

  // MSNF source classification
  if (ing.msnf_pct && ing.msnf_pct > 70) {
    roles.push({ role: 'msnf_source', weight: 1.0 }); // SMP, WMP
    flexibility = 0.7;
  } else if (ing.msnf_pct && ing.msnf_pct > 20) {
    roles.push({ role: 'msnf_source', weight: 0.6 }); // Condensed milk
    flexibility = 0.5;
  } else if (ing.msnf_pct && ing.msnf_pct > 7) {
    roles.push({ role: 'msnf_source', weight: 0.8 }); // Regular milk
    flexibility = 0.6;
  }

  // Water source classification
  if (ing.water_pct > 95) {
    roles.push({ role: 'water_source', weight: 1.0 }); // Pure water
    flexibility = 1.0; // Very flexible
  } else if (ing.water_pct > 80) {
    roles.push({ role: 'water_source', weight: 0.7 }); // Milk, juice
    flexibility = 0.6;
  }

  // Sugar source classification
  if (cat === 'sugar' || (ing.sugars_pct && ing.sugars_pct > 90)) {
    roles.push({ role: 'sugar_source', weight: 1.0 });
    flexibility = 0.4; // Sugars are less flexible due to sweetness balance
  } else if (ing.sugars_pct && ing.sugars_pct > 50) {
    roles.push({ role: 'sugar_source', weight: 0.6 }); // Honey, syrups
    flexibility = 0.3;
  }

  // Stabilizer classification
  if (cat === 'stabilizer' || name.includes('stabilizer') || name.includes('guar') || name.includes('carrageenan')) {
    roles.push({ role: 'stabilizer', weight: 1.0 });
    flexibility = 0.1; // Very low flexibility - critical but minimal amounts
    isLocked = true; // Usually shouldn't adjust stabilizers
  }

  // Flavor classification
  if (cat === 'flavor' || cat === 'fruit' || name.includes('vanilla') || name.includes('chocolate')) {
    roles.push({ role: 'flavor', weight: 1.0 });
    flexibility = 0.2; // Low flexibility - affects taste profile
    isLocked = true; // Usually locked to preserve flavor
  }

  // If no specific role, mark as 'other'
  if (roles.length === 0) {
    roles.push({ role: 'other', weight: 0.5 });
  }

  return {
    ingredient: ing,
    roles,
    flexibility,
    category: cat,
    isLocked
  };
}

/**
 * Classify all ingredients in a recipe
 */
export function classifyRecipeIngredients(rows: Row[]): IngredientClassification[] {
  return rows.map(row => classifyIngredientV2(row.ing));
}

// ============================================================================
// PHASE 2: INGREDIENT SUBSTITUTION RULES ENGINE
// ============================================================================

export interface SubstitutionRule {
  name: string;
  description: string;
  from: string; // ingredient name pattern (regex)
  to: string | string[]; // replacement ingredient(s)
  ratio: number | number[]; // how much to substitute
  affectsPer100g: {
    fat?: number;
    msnf?: number;
    sugars?: number;
    water?: number;
  };
  priority: number; // higher = prefer this substitution
}

export interface SubstitutionPattern {
  targetParameter: 'fat' | 'msnf' | 'sugars' | 'pac';
  direction: 'increase' | 'decrease';
  rules: SubstitutionRule[];
}

/**
 * Comprehensive substitution patterns library
 */
export const SUBSTITUTION_PATTERNS: SubstitutionPattern[] = [
  // ===== FAT REDUCTION PATTERNS =====
  {
    targetParameter: 'fat',
    direction: 'decrease',
    rules: [
      {
        name: 'Heavy Cream to Light Cream',
        description: 'Replace heavy cream (35%+) with light cream (15-20%)',
        from: 'cream.*3[5-9]|cream.*40',
        to: 'cream_20',
        ratio: 1.1,
        affectsPer100g: { fat: -17, msnf: -1 },
        priority: 8
      },
      {
        name: 'Heavy Cream to Whole Milk',
        description: 'Replace heavy cream with whole milk',
        from: 'cream.*3[5-9]|cream.*40',
        to: 'milk_whole',
        ratio: 1.3,
        affectsPer100g: { fat: -31, msnf: +2 },
        priority: 7
      },
      {
        name: 'Light Cream to Whole Milk',
        description: 'Replace light cream with whole milk',
        from: 'cream.*[1-2][0-5]',
        to: 'milk_whole',
        ratio: 1.1,
        affectsPer100g: { fat: -15, msnf: +1.5 },
        priority: 9
      },
      {
        name: 'Whole Milk to Skim + SMP',
        description: 'Replace whole milk with skim milk and SMP to maintain MSNF',
        from: 'milk.*whole|milk.*3',
        to: ['milk_skim', 'smp'],
        ratio: [0.92, 0.03],
        affectsPer100g: { fat: -3.5, msnf: +0.5 },
        priority: 6
      },
      {
        name: 'Whole Milk to Water + SMP',
        description: 'Replace whole milk with water and SMP (more aggressive)',
        from: 'milk.*whole|milk.*3',
        to: ['water', 'smp'],
        ratio: [0.88, 0.04],
        affectsPer100g: { fat: -3.5, msnf: +0.2 },
        priority: 5
      }
    ]
  },

  // ===== FAT INCREASE PATTERNS =====
  {
    targetParameter: 'fat',
    direction: 'increase',
    rules: [
      {
        name: 'Whole Milk to Light Cream',
        description: 'Replace whole milk with light cream',
        from: 'milk.*whole|milk.*3',
        to: 'cream_20',
        ratio: 0.9,
        affectsPer100g: { fat: +15, msnf: -1.5 },
        priority: 8
      },
      {
        name: 'Light Cream to Heavy Cream',
        description: 'Replace light cream with heavy cream',
        from: 'cream.*[1-2][0-5]',
        to: 'cream_35',
        ratio: 0.8,
        affectsPer100g: { fat: +17, msnf: +1 },
        priority: 7
      },
      {
        name: 'Water to Whole Milk',
        description: 'Replace water with whole milk',
        from: 'water',
        to: 'milk_whole',
        ratio: 1.0,
        affectsPer100g: { fat: +3.5, msnf: +8.5, water: -88 },
        priority: 9
      },
      {
        name: 'Add Butter',
        description: 'Add butter to increase fat without much volume',
        from: 'water',
        to: 'butter',
        ratio: 0.05,
        affectsPer100g: { fat: +82, water: -15 },
        priority: 6
      }
    ]
  },

  // ===== MSNF REDUCTION PATTERNS =====
  {
    targetParameter: 'msnf',
    direction: 'decrease',
    rules: [
      {
        name: 'SMP to Water',
        description: 'Replace skim milk powder with water',
        from: 'smp|skim.*powder|milk.*powder.*skim',
        to: 'water',
        ratio: 1.0,
        affectsPer100g: { msnf: -93, fat: -1, water: +96.5 },
        priority: 10
      },
      {
        name: 'Whole Milk to Water + Cream',
        description: 'Replace milk with water and cream to maintain fat',
        from: 'milk.*whole|milk.*3',
        to: ['water', 'cream_35'],
        ratio: [0.90, 0.10],
        affectsPer100g: { msnf: -7.5, fat: 0 },
        priority: 8
      },
      {
        name: 'Condensed Milk to Water + Sugar',
        description: 'Replace condensed milk with water and sugar',
        from: 'condensed|sweetened.*milk',
        to: ['water', 'sucrose'],
        ratio: [0.7, 0.25],
        affectsPer100g: { msnf: -20, sugars: +15 },
        priority: 7
      }
    ]
  },

  // ===== MSNF INCREASE PATTERNS =====
  {
    targetParameter: 'msnf',
    direction: 'increase',
    rules: [
      {
        name: 'Water to SMP',
        description: 'Replace water with skim milk powder',
        from: 'water',
        to: 'smp',
        ratio: 0.05,
        affectsPer100g: { msnf: +4.65, fat: +0.05, water: -4.83 },
        priority: 10
      },
      {
        name: 'Water to Whole Milk',
        description: 'Replace water with whole milk',
        from: 'water',
        to: 'milk_whole',
        ratio: 1.0,
        affectsPer100g: { msnf: +8.5, fat: +3.5, water: -88 },
        priority: 8
      },
      {
        name: 'Whole Milk to Milk + SMP',
        description: 'Add SMP to whole milk',
        from: 'milk.*whole|milk.*3',
        to: ['milk_whole', 'smp'],
        ratio: [0.95, 0.03],
        affectsPer100g: { msnf: +2.8, fat: +0.03 },
        priority: 9
      },
      {
        name: 'Cream to Milk',
        description: 'Replace cream with milk to increase MSNF',
        from: 'cream.*[2-4][0-9]',
        to: 'milk_whole',
        ratio: 1.2,
        affectsPer100g: { msnf: +2, fat: -20 },
        priority: 6
      }
    ]
  }
];

/**
 * Find applicable substitution rules for a given target and direction
 */
export function findApplicableRules(
  targetParameter: 'fat' | 'msnf' | 'sugars' | 'pac',
  direction: 'increase' | 'decrease',
  availableIngredients: IngredientData[]
): SubstitutionRule[] {
  const pattern = SUBSTITUTION_PATTERNS.find(
    p => p.targetParameter === targetParameter && p.direction === direction
  );

  if (!pattern) return [];

  // Filter rules where 'from' ingredients exist in recipe
  return pattern.rules
    .filter(rule => {
      const regex = new RegExp(rule.from, 'i');
      return availableIngredients.some(ing => regex.test(ing.id) || regex.test(ing.name));
    })
    .sort((a, b) => b.priority - a.priority); // Highest priority first
}

/**
 * Apply a substitution rule to a recipe
 * NOW USES INTELLIGENT INGREDIENT MAPPING + CANONICAL ALIASES
 */
export function applySubstitution(
  rows: Row[],
  rule: SubstitutionRule,
  allIngredients: IngredientData[],
  amountToAdjustGrams: number
): Row[] {
  const fromRegex = new RegExp(rule.from, 'i');
  
  // Find the 'from' ingredient
  const fromIndex = rows.findIndex(row => 
    fromRegex.test(row.ing.id) || fromRegex.test(row.ing.name)
  );

  if (fromIndex === -1) return rows; // Ingredient not found

  const newRows = [...rows];
  const fromRow = newRows[fromIndex];
  
  // Calculate how much to reduce
  const reductionGrams = Math.min(amountToAdjustGrams, fromRow.grams * 0.5); // Max 50% reduction per step
  
  if (reductionGrams <= 0) return rows;

  // Reduce 'from' ingredient
  newRows[fromIndex] = {
    ...fromRow,
    grams: fromRow.grams - reductionGrams
  };

  // Add 'to' ingredient(s)
  const toIngredients = Array.isArray(rule.to) ? rule.to : [rule.to];
  const ratios = Array.isArray(rule.ratio) ? rule.ratio : [rule.ratio];

  toIngredients.forEach((toName, i) => {
    const ratio = ratios[i] || ratios[0];
    const addGrams = reductionGrams * ratio;

    // ============ INGREDIENT ALIAS MAP INTEGRATION ============
    // Try canonical alias matching first (e.g., "water" → "Water", "cream_35" → "Heavy Cream 35%")
    let toIngredient: IngredientData | undefined;
    
    // 1. Try to find by canonical type
    const targetCanonical = findCanonical(toName);
    if (targetCanonical) {
      // Look for ingredient matching this canonical type
      toIngredient = allIngredients.find(ing => findCanonical(ing) === targetCanonical);
      
      if (toIngredient) {
        console.log(`✅ Canonical match: "${toName}" → "${toIngredient.name}" (${targetCanonical})`);
      }
    }
    
    // 2. Try intelligent mapping (generic IDs)
    if (!toIngredient) {
      toIngredient = findIngredientByGenericId(toName, allIngredients);
    }
    
    // 3. Fall back to regex matching
    if (!toIngredient) {
      const toRegex = new RegExp(toName, 'i');
      toIngredient = allIngredients.find(ing => 
        toRegex.test(ing.id) || toRegex.test(ing.name)
      );
    }

    if (toIngredient) {
      // Check if ingredient already exists in recipe
      const toIndex = newRows.findIndex(row => row.ing.id === toIngredient!.id);
      
      if (toIndex !== -1) {
        // Ingredient exists, increase amount
        newRows[toIndex] = {
          ...newRows[toIndex],
          grams: newRows[toIndex].grams + addGrams
        };
      } else {
        // Add new ingredient to recipe
        newRows.push({
          ing: toIngredient,
          grams: addGrams
        });
      }
    } else {
      // Ingredient not found - provide helpful message with canonical hint
      const canonicalHint = targetCanonical 
        ? ` (looking for canonical: ${targetCanonical})` 
        : '';
      console.warn(`⚠️ Substitution target "${toName}"${canonicalHint} not found. Add this ingredient to the database.`);
    }
  });

  // Remove ingredients with near-zero amounts
  return newRows.filter(row => row.grams >= 0.1);
}

/**
 * Calculate the impact of a substitution on metrics
 */
export function predictSubstitutionImpact(
  currentMetrics: MetricsV2,
  rule: SubstitutionRule,
  amountGrams: number,
  totalWeight: number
): Partial<MetricsV2> {
  const impactPercentage = (amountGrams / totalWeight) * 100;
  
  return {
    fat_pct: currentMetrics.fat_pct + ((rule.affectsPer100g.fat || 0) * impactPercentage / 100),
    msnf_pct: currentMetrics.msnf_pct + ((rule.affectsPer100g.msnf || 0) * impactPercentage / 100),
    nonLactoseSugars_pct: currentMetrics.nonLactoseSugars_pct + ((rule.affectsPer100g.sugars || 0) * impactPercentage / 100)
  };
}

// ============================================================================
// EXPORT UTILITIES
// ============================================================================

export const OptimizeEngineV2 = {
  classifyIngredient: classifyIngredientV2,
  classifyRecipe: classifyRecipeIngredients,
  findRules: findApplicableRules,
  applySubstitution,
  predictImpact: predictSubstitutionImpact
};
