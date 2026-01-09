/**
 * Dynamic Ingredient Mapping System
 * Maps generic ingredient IDs to actual database ingredients using multiple strategies
 */

import type { IngredientData } from '@/types/ingredients';

/**
 * Core ingredient mappings - maps generic IDs to search patterns and property filters
 * Enhanced with common aliases, regional terminology, and industry abbreviations
 */
export const CORE_INGREDIENT_MAPPINGS: Record<string, {
  aliases: string[];
  searchPatterns: RegExp[];
  propertyFilters?: {
    minFat?: number;
    maxFat?: number;
    minMSNF?: number;
    maxMSNF?: number;
    category?: string;
  };
}> = {
  // Water
  'water': {
    aliases: ['water', 'h2o', 'potable water', 'drinking water'],
    searchPatterns: [/^water$/i, /pure water/i, /potable/i, /drinking.*water/i],
    propertyFilters: { minFat: 0, maxFat: 0, minMSNF: 0, maxMSNF: 0 }
  },
  
  // Cow Whole Milk (3.25-3.5% fat) - Standard whole milk
  'milk_whole_cow': {
    aliases: [
      'whole milk', 'full milk', 'cow whole milk', 'cow milk',
      'full fat milk', 'regular milk', 'full cream milk'
    ],
    searchPatterns: [
      /^whole.*milk$/i, /^milk.*whole$/i, /^full.*milk$/i,
      /cow.*whole.*milk/i, /cow.*milk/i, /regular.*milk/i
    ],
    propertyFilters: { minFat: 3.15, maxFat: 3.65, category: 'dairy' }
  },
  
  // Toned Milk (3% fat EXACTLY) - Indian standardized milk
  'milk_toned': {
    aliases: [
      'toned milk', 'standardized milk', 'milk 3%', '3% milk', '3 percent milk'
    ],
    searchPatterns: [
      /^toned.*milk$/i, /^standardized.*milk$/i, 
      /^milk.*3%?$/i, /^3%?.*milk$/i, /3\s*percent.*milk/i
    ],
    propertyFilters: { minFat: 2.9, maxFat: 3.1, category: 'dairy' }  // ±0.1% only!
  },
  
  // Buffalo Milk (6.5% fat) - Higher fat content
  'milk_buffalo': {
    aliases: [
      'buffalo milk', 'buffalo whole milk', 'bhains milk', 'bhains ka doodh'
    ],
    searchPatterns: [
      /buffalo.*milk/i, /bhains/i
    ],
    propertyFilters: { minFat: 6.3, maxFat: 6.8, category: 'dairy' }  // ±0.2% only
  },
  
  // Double Toned Milk (1.5% fat EXACTLY) - Indian very low-fat milk
  'milk_double_toned': {
    aliases: [
      'double toned milk', 'double toned', 'extra light milk', '1.5% milk', '1.5 percent milk'
    ],
    searchPatterns: [
      /^double.*toned/i, /extra.*light.*milk/i, /^1\.5%?.*milk$/i, /^milk.*1\.5%?$/i
    ],
    propertyFilters: { minFat: 1.4, maxFat: 1.6, category: 'dairy' }  // ±0.1% only!
  },
  
  // Skim Milk (0-0.5% fat) - Fat-free milk
  'milk_skim': {
    aliases: [
      'skim milk', 'skimmed milk', 'fat-free milk', 'nonfat milk',
      'non-fat milk', '0% milk', 'zero fat milk', '0 percent milk'
    ],
    searchPatterns: [
      /^skim.*milk$/i, /^milk.*skim$/i, 
      /fat.?free.*milk/i, /non.?fat.*milk/i, /zero.*fat/i,
      /^0%?.*milk$/i, /^milk.*0%?$/i
    ],
    propertyFilters: { minFat: 0, maxFat: 0.5, category: 'dairy' }
  },
  
  // Single Toned Milk (1.5% fat) - Indian low-fat milk
  'milk_single_toned': {
    aliases: [
      'single toned milk', 'low-fat milk', 'milk 1.5%'
    ],
    searchPatterns: [
      /^single.*toned/i, /low.?fat.*milk/i, /^1\.5%?.*milk$/i
    ],
    propertyFilters: { minFat: 1.4, maxFat: 1.6, category: 'dairy' }  // ±0.1% only!
  },
  
  // Semi-Skimmed Milk (2% fat EXACTLY) - Western low-fat milk
  'milk_semi_skimmed': {
    aliases: [
      'semi-skimmed milk', '2% milk', 'reduced fat milk', '2 percent milk'
    ],
    searchPatterns: [
      /^semi.*skim/i, /^2%?.*milk$/i, /^milk.*2%?$/i, /reduced.*fat.*milk/i, /2\s*percent.*milk/i
    ],
    propertyFilters: { minFat: 1.9, maxFat: 2.1, category: 'dairy' }  // ±0.1% only!
  },
  
  // 1% Milk (EXACTLY) - Very low-fat Western milk
  'milk_1pct': {
    aliases: [
      '1% milk', 'milk 1%', '1 percent milk', 'light milk'
    ],
    searchPatterns: [
      /^1%?.*milk$/i, /^milk.*1%?$/i, /1\s*percent.*milk/i
    ],
    propertyFilters: { minFat: 0.9, maxFat: 1.1, category: 'dairy' }  // ±0.1% only!
  },
  
  // 10% Cream (Half and Half)
  'cream_10': {
    aliases: [
      '10% cream', 'cream 10%', 'half and half', 'half cream', '10 percent cream'
    ],
    searchPatterns: [
      /^10%?.*cream$/i, /^cream.*10%?$/i, /half.*and.*half/i, /half.*cream/i
    ],
    propertyFilters: { minFat: 9.8, maxFat: 10.2, category: 'dairy' }  // ±0.2% only!
  },
  
  // 18% Cream (Light cream UK)
  'cream_18': {
    aliases: [
      '18% cream', 'cream 18%', 'light cream', 'coffee cream', 'single cream'
    ],
    searchPatterns: [
      /^18%?.*cream$/i, /^cream.*18%?$/i, /^light.*cream$/i, /coffee.*cream/i, /single.*cream/i
    ],
    propertyFilters: { minFat: 17.8, maxFat: 18.3, category: 'dairy' }  // ±0.2% only!
  },
  
  // 20% Cream (Table cream)
  'cream_20': {
    aliases: [
      '20% cream', 'cream 20%', 'table cream', '20 percent cream'
    ],
    searchPatterns: [
      /^20%?.*cream$/i, /^cream.*20%?$/i, /table.*cream/i
    ],
    propertyFilters: { minFat: 19.8, maxFat: 20.3, category: 'dairy' }  // ±0.2% only!
  },
  
  // 25% Cream (Medium cream)
  'cream_25': {
    aliases: [
      '25% cream', 'cream 25%', 'medium cream', '25 percent cream'
    ],
    searchPatterns: [
      /^25%?.*cream$/i, /^cream.*25%?$/i, /medium.*cream/i
    ],
    propertyFilters: { minFat: 24.8, maxFat: 25.3, category: 'dairy' }  // ±0.2% only!
  },
  
  // 30% Cream (Whipping cream light)
  'cream_30': {
    aliases: [
      '30% cream', 'cream 30%', 'light whipping cream', '30 percent cream'
    ],
    searchPatterns: [
      /^30%?.*cream$/i, /^cream.*30%?$/i, /light.*whipping/i
    ],
    propertyFilters: { minFat: 29.7, maxFat: 30.5, category: 'dairy' }  // ±0.3% only!
  },
  
  // 35% Cream (Heavy cream / Whipping cream)
  'cream_35': {
    aliases: [
      '35% cream', 'cream 35%', 'heavy cream', 'whipping cream', 
      'heavy whipping cream', '35 percent cream'
    ],
    searchPatterns: [
      /^35%?.*cream$/i, /^cream.*35%?$/i, /^heavy.*cream$/i, 
      /^whipping.*cream$/i, /heavy.*whipping/i
    ],
    propertyFilters: { minFat: 34.7, maxFat: 35.5, category: 'dairy' }  // ±0.3% only!
  },
  
  // 40% Cream (Double cream / Extra heavy)
  'cream_40': {
    aliases: [
      '40% cream', 'cream 40%', 'double cream', 'extra heavy cream',
      'thick cream', '40 percent cream'
    ],
    searchPatterns: [
      /^40%?.*cream$/i, /^cream.*40%?$/i, /^double.*cream$/i, 
      /extra.*heavy/i, /^thick.*cream$/i
    ],
    propertyFilters: { minFat: 39.5, maxFat: 40.5, category: 'dairy' }  // ±0.5% only!
  },
  
  // Skim Milk Powder (SMP) - 90%+ MSNF
  'smp': {
    aliases: [
      'skim milk powder', 'skimmed milk powder', 'non-fat dry milk',
      'smp', 'nfdm', 'skim powder', 'milk powder skim',
      'fat-free milk powder', 'nonfat dry milk'
    ],
    searchPatterns: [
      /\bsmp\b/i, /\bnfdm\b/i,
      /skim.*powder/i, /powder.*skim/i,
      /non.?fat.*dry.*milk/i, /milk.*powder.*skim/i,
      /fat.?free.*powder/i, /skim.*milk.*powder/i
    ],
    propertyFilters: { minMSNF: 90, maxFat: 1.5, category: 'dairy' }
  },
  
  // Whole Milk Powder (WMP) - 25%+ fat
  'wmp': {
    aliases: [
      'whole milk powder', 'full cream milk powder', 'wmp',
      'fcmp', 'whole powder', 'milk powder whole',
      'full fat milk powder', 'full cream powder'
    ],
    searchPatterns: [
      /\bwmp\b/i, /\bfcmp\b/i,
      /whole.*milk.*powder/i, /powder.*whole/i,
      /full.*cream.*powder/i, /full.*fat.*powder/i
    ],
    propertyFilters: { minFat: 20, minMSNF: 60, category: 'dairy' }
  },
  
  // Butter (80%+ fat)
  'butter': {
    aliases: [
      'butter', 'unsalted butter', 'salted butter', 'table butter',
      'white butter', 'makkhan', 'fresh butter'
    ],
    searchPatterns: [
      /^butter$/i, /unsalted.*butter/i, /salted.*butter/i,
      /table.*butter/i, /white.*butter/i, /makkhan/i,
      /fresh.*butter/i
    ],
    propertyFilters: { minFat: 75, category: 'dairy' }
  },
  
  // Condensed Milk (8-10% fat, 20%+ MSNF)
  'condensed_milk': {
    aliases: [
      'condensed milk', 'sweetened condensed milk', 'condensed',
      'milkmaid', 'condensed whole milk'
    ],
    searchPatterns: [
      /condensed.*milk/i, /milk.*condensed/i,
      /sweetened.*condensed/i, /milkmaid/i
    ],
    propertyFilters: { minFat: 7, maxFat: 12, minMSNF: 18, category: 'dairy' }
  },
  
  // Sucrose (table sugar)
  'sucrose': {
    aliases: [
      'sucrose', 'white sugar', 'table sugar', 'sugar', 'cane sugar',
      'refined sugar', 'granulated sugar', 'crystal sugar'
    ],
    searchPatterns: [
      /^sucrose$/i, /white.*sugar/i, /table.*sugar/i, 
      /^sugar$/i, /cane.*sugar/i, /refined.*sugar/i,
      /granulated.*sugar/i, /crystal.*sugar/i
    ],
    propertyFilters: { category: 'sugar' }
  },
  
  // Dextrose (glucose)
  'dextrose': {
    aliases: [
      'dextrose', 'glucose', 'dextrose monohydrate', 'corn sugar',
      'grape sugar', 'glucose powder', 'dextrose powder'
    ],
    searchPatterns: [
      /dextrose/i, /^glucose$/i, /corn.*sugar/i,
      /grape.*sugar/i, /glucose.*powder/i
    ],
    propertyFilters: { category: 'sugar' }
  },
  
  // Fructose
  'fructose': {
    aliases: [
      'fructose', 'fruit sugar', 'levulose', 'fructose powder'
    ],
    searchPatterns: [
      /fructose/i, /fruit.*sugar/i, /levulose/i
    ],
    propertyFilters: { category: 'sugar' }
  },
  
  // Invert Sugar
  'invert_sugar': {
    aliases: [
      'invert sugar', 'inverted sugar', 'trimoline', 'invert syrup'
    ],
    searchPatterns: [
      /invert.*sugar/i, /trimoline/i, /invert.*syrup/i
    ],
    propertyFilters: { category: 'sugar' }
  },
  
  // Honey
  'honey': {
    aliases: [
      'honey', 'natural honey', 'pure honey', 'raw honey', 'shahad'
    ],
    searchPatterns: [
      /honey/i, /shahad/i
    ],
    propertyFilters: { category: 'sugar' }
  }
};

/**
 * Find an ingredient in the database using a generic ID or search term
 * Uses multiple strategies: exact match, alias match, pattern match, property-based filtering
 */
export function findIngredientByGenericId(
  genericId: string,
  availableIngredients: IngredientData[]
): IngredientData | null {
  const searchTerm = genericId.toLowerCase().trim();
  
  // Strategy 0: Check if this matches any alias in any mapping
  for (const [mappingKey, mapping] of Object.entries(CORE_INGREDIENT_MAPPINGS)) {
    // Check if search term matches any alias exactly
    for (const alias of mapping.aliases) {
      if (alias.toLowerCase() === searchTerm) {
        // Found a match! Now find the actual ingredient using full mapping logic
        return findIngredientByMapping(mapping, availableIngredients);
      }
    }
    
    // Check if search term matches any pattern
    for (const pattern of mapping.searchPatterns) {
      if (pattern.test(searchTerm)) {
        return findIngredientByMapping(mapping, availableIngredients);
      }
    }
  }
  
  // Strategy 1: Try direct mapping lookup (for substitution rules using generic IDs)
  const mapping = CORE_INGREDIENT_MAPPINGS[searchTerm];
  if (mapping) {
    return findIngredientByMapping(mapping, availableIngredients);
  }

  // Strategy 2: Try direct name/ID match as fallback
  const directMatch = availableIngredients.find(ing => 
    ing.name.toLowerCase() === searchTerm ||
    ing.id.toLowerCase() === searchTerm
  );
  if (directMatch) return directMatch;

  // Strategy 3: Try fuzzy matching on partial words
  const words = searchTerm.split(/\s+/);
  for (const word of words) {
    if (word.length < 3) continue; // Skip very short words
    
    const fuzzyMatch = availableIngredients.find(ing => 
      ing.name.toLowerCase().includes(word) ||
      ing.id.toLowerCase().includes(word)
    );
    if (fuzzyMatch) return fuzzyMatch;
  }

  // No match found
  return null;
}

/**
 * Helper function to find ingredient using a mapping configuration
 */
function findIngredientByMapping(
  mapping: typeof CORE_INGREDIENT_MAPPINGS[string],
  availableIngredients: IngredientData[]
): IngredientData | null {
  // Strategy 1: Try exact alias matches first
  for (const alias of mapping.aliases) {
    const match = availableIngredients.find(ing => 
      ing.name.toLowerCase() === alias.toLowerCase()
    );
    if (match) return match;
  }

  // Strategy 2: Try regex pattern matching
  for (const pattern of mapping.searchPatterns) {
    const match = availableIngredients.find(ing => 
      pattern.test(ing.name) || pattern.test(ing.id)
    );
    if (match) return match;
  }

  // Strategy 3: Property-based filtering (find best match)
  if (mapping.propertyFilters) {
    const candidates = availableIngredients.filter(ing => {
      const filters = mapping.propertyFilters!;
      
      // Category filter
      if (filters.category && ing.category !== filters.category) {
        return false;
      }
      
      // Fat range filter
      if (filters.minFat !== undefined && ing.fat_pct < filters.minFat) {
        return false;
      }
      if (filters.maxFat !== undefined && ing.fat_pct > filters.maxFat) {
        return false;
      }
      
      // MSNF range filter
      if (filters.minMSNF !== undefined && (ing.msnf_pct || 0) < filters.minMSNF) {
        return false;
      }
      if (filters.maxMSNF !== undefined && (ing.msnf_pct || 0) > filters.maxMSNF) {
        return false;
      }
      
      return true;
    });

    // Return the best candidate (prefer exact property matches)
    if (candidates.length > 0) {
      return candidates[0];
    }
  }

  return null;
}

/**
 * Diagnose why balancing failed and provide actionable suggestions
 */
export function diagnoseBalancingFailure(
  rows: { ing: IngredientData; grams: number }[],
  availableIngredients: IngredientData[],
  targets: any
): {
  missingIngredients: string[];
  suggestions: string[];
  hasWater: boolean;
  hasFatSource: boolean;
  hasMSNFSource: boolean;
} {
  const missingIngredients: string[] = [];
  const suggestions: string[] = [];

  // Check for essential balancing ingredients - RELAXED THRESHOLDS
  // Allow milk (80%+ water) to count as water source
  const hasWaterInRecipe = rows.some(r => r.ing.water_pct > 80);
  const hasWaterInDB = availableIngredients.some(ing => ing.water_pct > 95);
  const hasWater = hasWaterInRecipe || hasWaterInDB;
  
  // Allow any dairy (2%+ fat) to count, but check DB for high-fat sources
  const hasFatInRecipe = rows.some(r => r.ing.fat_pct > 2);
  const hasFatSourceInDB = availableIngredients.some(ing => ing.fat_pct > 15);
  const hasFatSource = hasFatInRecipe || hasFatSourceInDB;
  
  // Allow milk (5%+ MSNF) to count, but check DB for SMP
  const hasMSNFInRecipe = rows.some(r => (r.ing.msnf_pct || 0) > 5);
  const hasMSNFSourceInDB = availableIngredients.some(ing => (ing.msnf_pct || 0) > 70);
  const hasMSNFSource = hasMSNFInRecipe || hasMSNFSourceInDB;

  if (!hasWater) {
    missingIngredients.push('Water');
    suggestions.push('Add "Water" ingredient to enable fat/MSNF dilution');
  }

  if (!hasFatSource && targets.fat_pct !== undefined) {
    missingIngredients.push('High-fat ingredient (Butter or Heavy Cream 35%)');
    suggestions.push('Add heavy cream (35%+) or butter to adjust fat content');
  }

  if (!hasMSNFSource && targets.msnf_pct !== undefined) {
    missingIngredients.push('MSNF source (Skim Milk Powder)');
    suggestions.push('Add skim milk powder (SMP) to adjust MSNF independently of fat');
  }

  // Check ingredient diversity
  const ingredientCount = rows.length;
  if (ingredientCount < 3) {
    suggestions.push(`Add more ingredients (current: ${ingredientCount}, recommended: 4+)`);
  }

  // Check for locked/inflexible ingredients
  const allLocked = rows.every(r => 
    r.ing.category === 'stabilizer' || 
    r.ing.category === 'flavor' || 
    r.ing.category === 'fruit'
  );
  
  if (allLocked) {
    suggestions.push('Recipe contains only locked ingredients (flavors/stabilizers). Add dairy or water ingredients.');
  }

  return {
    missingIngredients,
    suggestions,
    hasWater,
    hasFatSource,
    hasMSNFSource
  };
}

/**
 * Get user-friendly ingredient suggestions based on what's needed
 */
export function getIngredientSuggestions(
  parameter: 'fat' | 'msnf' | 'sugars',
  direction: 'increase' | 'decrease',
  availableIngredients: IngredientData[]
): string[] {
  const suggestions: string[] = [];

  if (parameter === 'fat') {
    if (direction === 'increase') {
      const hasHeavyCream = findIngredientByGenericId('cream_35', availableIngredients);
      const hasButter = findIngredientByGenericId('butter', availableIngredients);
      
      if (!hasHeavyCream) suggestions.push('Add Heavy Cream 35% to increase fat');
      if (!hasButter) suggestions.push('Add Butter for high-fat content');
    } else {
      const hasWater = findIngredientByGenericId('water', availableIngredients);
      const hasSkimMilk = findIngredientByGenericId('milk_skim', availableIngredients);
      
      if (!hasWater) suggestions.push('Add Water to dilute fat content');
      if (!hasSkimMilk) suggestions.push('Add Skim Milk to replace high-fat milk');
    }
  }

  if (parameter === 'msnf') {
    if (direction === 'increase') {
      const hasSMP = findIngredientByGenericId('smp', availableIngredients);
      if (!hasSMP) suggestions.push('Add Skim Milk Powder (SMP) to increase MSNF');
    } else {
      const hasWater = findIngredientByGenericId('water', availableIngredients);
      if (!hasWater) suggestions.push('Add Water to dilute MSNF');
    }
  }

  return suggestions;
}

// ============================================================================
// CONSOLIDATED FROM ingredientMap.ts
// ============================================================================

export const CANONICALS = {
  water: ['water', 'drinking water', 'aqua', 'purified water', 'h2o', 'pani', 'jal'],
  cream_35: ['heavy cream', 'cream 35', 'cream 36', 'heavy cream 35%', 
             'fresh cream 36', 'malai', 'cream 38', 'double cream',
             'whipping cream', 'thickened cream', 'full cream', 'balai'],
  butter: ['butter', 'unsalted butter', 'salted butter', 'white butter',
           'makkhan', 'makhan', 'loni', 'maslo'],
  smp: ['skim milk powder', 'smp', 'low fat milk powder', 
        'non-fat dry milk', 'nfdm', 'skimmed milk powder',
        'fat free milk powder', 'dried skim milk'],
  khoya: ['khoya', 'khoa', 'mawa', 'kova', 'milk solid', 'rabdi base'],
  milk: ['milk', 'doodh', 'dudh', 'whole milk', 'full fat milk', 
         'taza doodh', 'cow milk', 'gai ka doodh', 'buffalo milk', 'bhains ka doodh'],
  condensed: ['condensed milk', 'milkmaid', 'sweetened condensed', 
              'condensed whole milk', 'mithi cream'],
  pistachio: ['pistachio', 'pista', 'pistache', 'pistachio paste', 
              'pistacchio', 'bronte pistachio'],
  hazelnut: ['hazelnut', 'nocciola', 'hazelnuts', 'hazelnut paste',
             'gianduia', 'gianduja'],
  almond: ['almond', 'badam', 'almonds', 'almond paste', 'badaam',
           'mandorla', 'almendra'],
  mango: ['mango', 'aam', 'alphonso', 'mango pulp', 'mango puree',
          'kesar mango', 'hapus', 'ratnagiri'],
  fruit_puree: ['puree', 'pulp', 'fruit puree', 'fruit pulp', 'juice'],
  chocolate: ['chocolate', 'choco', 'cocoa', 'cacao', 'dark chocolate', 
              'milk chocolate', 'white chocolate']
};

export type CanonicalIngredient = 'water' | 'cream_35' | 'butter' | 'smp';

export function findCanonical(ingredient: IngredientData | string): CanonicalIngredient | null {
  const searchTerm = typeof ingredient === 'string' 
    ? ingredient.toLowerCase()
    : ingredient.name.toLowerCase();
    
  for (const [canonical, aliases] of Object.entries(CANONICALS)) {
    if (aliases.some(alias => searchTerm.includes(alias))) {
      return canonical as CanonicalIngredient;
    }
  }
  return null;
}

export type IngredientRole = 'core' | 'balancing';

export function classifyIngredient(ing: IngredientData): IngredientRole {
  const name = ing.name.toLowerCase();
  const coreKeywords = ['fruit', 'cocoa', 'chocolate', 'paste', 'puree', 
                        'vanilla', 'pistachio', 'almond', 'hazelnut', 'berry',
                        'mango', 'strawberry', 'lemon', 'orange', 'banana'];
  if (coreKeywords.some(kw => name.includes(kw))) return 'core';
  if (ing.category === 'fruit' || ing.category === 'flavor') return 'core';
  return 'balancing';
}

export function checkDbHealth(allIngredients: IngredientData[]) {
  const hasWater = allIngredients.some(ing => 
    findCanonical(ing) === 'water' && ing.water_pct >= 95
  );
  const hasCream35 = allIngredients.some(ing => 
    findCanonical(ing) === 'cream_35' && ing.fat_pct >= 30
  );
  const hasButter = allIngredients.some(ing => 
    findCanonical(ing) === 'butter' && ing.fat_pct >= 75
  );
  const hasSMP = allIngredients.some(ing => 
    findCanonical(ing) === 'smp' && (ing.msnf_pct || 0) >= 85
  );
  
  const missing: string[] = [];
  if (!hasWater) missing.push('Water (diluent)');
  if (!hasCream35 && !hasButter) missing.push('Heavy Cream 35%+ or Butter');
  if (!hasSMP) missing.push('Skim Milk Powder (SMP)');
  
  return {
    hasWater,
    hasCream35OrButter: hasCream35 || hasButter,
    hasSMP,
    missing,
    healthy: missing.length === 0
  };
}

// ============================================================================
// CONSOLIDATED FROM ingredientMapping.ts
// ============================================================================

export function convertLegacyRecipeToRows(
  recipe: { [key: string]: number },
  availableIngredients: IngredientData[]
): Array<{ ing: IngredientData; grams: number }> {
  return Object.entries(recipe).map(([name, grams]) => {
    let ing = availableIngredients.find(i => i.name.toLowerCase() === name.toLowerCase());
    
    if (!ing) {
      const nameLower = name.toLowerCase();
      ing = availableIngredients.find(i => 
        i.name.toLowerCase().includes(nameLower) ||
        nameLower.includes(i.name.toLowerCase()) ||
        i.id.toLowerCase() === nameLower.replace(/\s+/g, '_')
      );
    }
    
    if (!ing) {
      ing = {
        id: name.toLowerCase().replace(/\s+/g, '_'),
        name,
        category: 'other',
        water_pct: 88,
        fat_pct: 3,
        sugars_pct: 5,
        other_solids_pct: 0,
        sp_coeff: 0.5,
        pac_coeff: 50,
      };
    }
    
    return { ing, grams: grams || 0 };
  });
}

export function matchIngredientName(
  searchName: string,
  availableIngredients: IngredientData[]
): IngredientData | null {
  const aliases: { [key: string]: string } = {
    // Sugars
    'sugar': 'Sucrose',
    'table sugar': 'Sucrose',
    'white sugar': 'Sucrose',
    'cheeni': 'Sucrose',
    'shakkar': 'Sucrose',
    'dextrose monohydrate': 'Dextrose',
    'glucose': 'Glucose Syrup DE60',
    'corn syrup': 'Glucose Syrup DE60',
    // Dairy
    'milk': 'Milk 3% fat',
    'whole milk': 'Milk 3% fat',
    'doodh': 'Milk 3% fat',
    'cream': 'Cream 25% fat',
    'heavy cream': 'Heavy Cream',
    'malai': 'Heavy Cream 35%',
    'whipping cream': 'Cream 25% fat',
    'skim milk powder': 'Skim Milk Powder',
    'nonfat dry milk': 'Skim Milk Powder',
    'khoya': 'Mawa (Khoya)',
    'khoa': 'Mawa (Khoya)',
    'mawa': 'Mawa (Khoya)',
    // Stabilizers
    'stabilizer': 'Stabilizer Blend',
    'stabiliser': 'Stabilizer Blend',
    // Eggs
    'egg yolk': 'Egg Yolks',
    'egg yolks': 'Egg Yolks',
    // Flavors
    'vanilla': 'Vanilla Extract',
    'pista': 'Pistachio Paste',
    'pistachio': 'Pistachio Paste',
    'hazelnut': 'Hazelnut Paste',
    'nocciola': 'Hazelnut Paste',
    'badam': 'Almond Paste',
    'almond': 'Almond Paste',
    // Chocolates
    'dark chocolate': 'Dark Chocolate 70%',
    'milk chocolate': 'Milk Chocolate',
    'white chocolate': 'White Chocolate',
    'cocoa': 'Cocoa Powder (Dutch)',
    'cocoa powder': 'Cocoa Powder (Dutch)',
    // Fruits
    'mango': 'Mango Alphonso Pulp',
    'aam': 'Mango Alphonso Pulp',
    'strawberry': 'Strawberry Puree',
    'raspberry': 'Raspberry Puree',
    'banana': 'Banana Puree',
    'lemon': 'Lemon Juice',
    'nimbu': 'Lemon Juice',
  };
  
  const searchLower = searchName.toLowerCase();
  const resolvedName = aliases[searchLower] || searchName;
  
  return availableIngredients.find(ing => 
    ing.name.toLowerCase() === resolvedName.toLowerCase()
  ) || null;
}
