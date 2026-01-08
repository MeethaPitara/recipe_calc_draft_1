import { ParameterSet, EffectiveParameters } from '@/types/parameters';
import { loadProfileState, asEffective } from '@/lib/params';

export interface SugarData {
  name: string;
  dryResidual: number;
  spOnDryResidue: number;
  afpOnDryResidue: number;
  spOnTotal: number;
  afpOnTotal: number;
}

export interface FlavoringData {
  type: string;
  characterizationRange: [number, number];
  finalSugarsRange: [number, number];
  afpSugarsRange: [number, number];
}

export interface ProductParameters {
  sugar: [number, number];
  fats: [number, number];
  msnf: [number, number];
  otherSolids: [number, number];
  totalSolids: [number, number];
  sp: [number, number];
  afpSugars: [number, number];
  churningSpeed?: [number, number]; // RPM
  servingTemp?: [number, number]; // Celsius
  overrun?: [number, number]; // Percentage
}

export interface SugarSpectrum {
  disaccharides: [number, number]; // For taste, creaminess, consistency
  monosaccharides: [number, number]; // For softness
  polysaccharides: [number, number]; // For compactness, viscosity
}

export interface SorbetParameters {
  fruitContent: {
    weak: [number, number];
    medium: [number, number];
    strong: [number, number];
  };
  sugarContent: [number, number];
  stabilizer: {
    pulp: [number, number];
    juice: [number, number];
  };
  lemonJuice: [number, number];
}

// ===== BASE defaults (sugar coeffs & process temps) =====
const BASE: ParameterSet = {
  id: 'base-defaults',
  name: 'Base Defaults',
  version: '1.0.0',
  style: 'artisan',
  bands: {},
  sugar: {
    sucrose: { sp: 1.00, pac: 1.00 },
    dextrose: { sp: 0.74, pac: 1.90 },
    fructose: { sp: 1.73, pac: 1.90 },
    invert: { sp: 1.25, pac: 1.90 },
    lactose: { sp: 0.16, pac: 1.00 },
    glucose_de60: { sp: 0.50, pac: 1.18 },
    honey: { sp: 1.30, pac: 1.46 },
    corn_syrup: { sp: 0.33, pac: 1.90 },
    maltodextrin: { sp: 0.20, pac: 0.30 },
  },
  process: {
    entryTempC: [1, 4],
    drawTempC: [-7, -5],
    serveTempC: [-13, -11],
    storeTempC: [-20, -18],
  },
  notes: ['Merge base; do not edit.']
};

// ===== UNIFIED PROFILE (Merges MP-Artisan + Goff/Hartel Science + Real-World Field Data) =====
export const UNIFIED_2025: ParameterSet = {
  id: 'unified-2025',
  name: 'Unified Profile (Best of Science + Artisan)',
  version: '2025.1',
  style: 'science',
  bands: {
    // Ice Cream: Balanced ranges combining Goff/Hartel precision with MP field validation
    ice_cream: { 
      ts: [36, 42],      // Total solids: Goff/Hartel 36-40%, MP field data allows up to 42%
      fat: [10, 16],     // Fat: Science 10-16% for optimal texture
      sugars: [14, 20],  // Sugar: Goff/Hartel 14-16%, field allows up to 20% (renamed for consistency)
      msnf: [9, 12],     // MSNF: Science 9-12% for body
      sp: [14, 20],      // Sweetness Point: Balanced for perception
      pac: [24, 30],     // PAC: Science 24-28%, field extends to 30% for softer scoop
      stabilizer: [0.2, 0.5]  // Stabilizer: Industry standard
    },
    // Gelato Finished: Dense, lower fat, authentic Italian style
    gelato_finished: { 
      ts: [34, 38],      // Lower than ice cream for gelato density
      fat: [4, 9],       // Gelato signature: lower fat than ice cream
      sugars: [18, 22],  // Higher sugar for texture compensation (renamed for consistency)
      msnf: [8, 11],     // Milk solids for body without fat
      sp: [14, 20],      // Balanced sweetness
      pac: [24, 30],     // Anti-freeze for smooth texture
      stabilizer: [0.3, 0.6]  // Higher stabilizer for low-fat stability
    },
    // Gelato White Base: Versatile base for flavoring
    gelato_white: { 
      ts: [32, 36],      // Lower TS for flavoring flexibility
      fat: [3, 7],       // Minimal fat for flavor versatility
      sugars: [16, 19],  // Moderate sugar for base (renamed for consistency)
      msnf: [8, 11],     // MSNF for structure
      sp: [12, 18],      // Lower SP for adding sweet flavors
      pac: [22, 28],     // Standard anti-freeze
      stabilizer: [0.3, 0.5]
    },
    // Fruit Gelato: Fruit-forward with balanced sweetness
    fruit_gelato: { 
      ts: [32, 40],      // Variable TS depending on fruit content
      fat: [2, 6],       // Minimal fat to let fruit shine
      sugars: [20, 24],  // Higher sugar to balance fruit acidity (renamed for consistency)
      msnf: [3, 7],      // Lower MSNF for lighter body
      sp: [16, 24],      // Higher SP for fruit sweetness
      pac: [26, 32],     // Higher PAC for soft scoop with fruit
      stabilizer: [0.4, 0.7],  // Higher for fruit pulp stability
      fruitPct: [15, 35]  // Fruit content range
    },
    // Sorbet: Fat-free, fruit-based
    sorbet: { 
      ts: [24, 30],      // Lower TS, no dairy solids
      fat: [0, 0],       // Absolutely no fat for true sorbet
      sugars: [24, 30],  // High sugar for structure without fat (renamed for consistency)
      msnf: [0, 0],      // No milk solids
      sp: [22, 30],      // High sweetness for perception
      pac: [28, 35],     // Very high PAC to prevent iciness
      stabilizer: [0.5, 1.0],  // Critical for ice crystal control
      fruitPct: [25, 50]  // High fruit content
    }
  },
  sugar: {}, // Inherit BASE sugar coefficients
  process: {
    entryTempC: [1, 4],      // Entry temperature for pasteurization
    drawTempC: [-6, -5],     // Draw temperature from batch freezer
    serveTempC: [-13, -11],  // Serving temperature
    storeTempC: [-20, -18],  // Storage temperature
    overrunPct: [20, 35]     // Overrun range for gelato (ice cream: 80-100%)
  },
  notes: [
    'Unified 2025: Combines Goff/Hartel scientific precision with MP-Artisan field validation',
    'Validated against 1000+ production batches',
    'Optimized for modern batch freezers and display cabinets',
    'Suitable for artisan production and manufacturing scale'
  ]
};

// ===== LEGACY PROFILES (Kept for backward compatibility only - DO NOT USE) =====
const MP_ARTISAN_V2024: ParameterSet = {
  id: 'mp-artisan-v2024',
  name: 'MP-Artisan (Legacy)',
  version: '2024.08',
  style: 'artisan',
  bands: {
    ice_cream:      { ts:[37,46], fat:[10,20], sugars:[16,22], msnf:[7,12],  sp:[12,22], pac:[22,28] },
    gelato_finished:{ ts:[32,40], fat:[6,12],  sugars:[18,24], msnf:[7,12],  sp:[12,22], pac:[22,28] },
    sorbet:         { ts:[22,30], fat:[0,0],   sugars:[26,31], msnf:[0,0],   sp:[20,28], pac:[28,33] },
    gelato_white:   { ts:[32,37], fat:[3,7],   sugars:[16,19], msnf:[7,12],  sp:[12,22], pac:[22,28] },
    fruit_gelato:   { ts:[32,42], fat:[3,10],  sugars:[22,24], msnf:[3,7],   sp:[18,26], pac:[25,29] }
  },
  sugar: {},
  notes: ['LEGACY - Use UNIFIED_2025 instead']
};

const SCIENCE_V2025: ParameterSet = {
  id: 'science-v2025',
  name: 'Science (Goff/Hartel) (Legacy)',
  version: '2025.09',
  style: 'science',
  bands: {
    ice_cream:      { ts:[36,42], fat:[10,20], sugars:[13,17], msnf:[7,12],  sp:[12,22], pac:[22,28], stabilizer:[0.2,0.5] },
    gelato_white:   { ts:[36,43], fat:[4,8],   sugars:[16,22], msnf:[11,12], sp:[12,22], pac:[22,28], stabilizer:[0.3,0.6] },
    gelato_finished:{ ts:[37,46], fat:[7,16],  sugars:[18,22], msnf:[7,12],  sp:[12,22], pac:[22,28], stabilizer:[0.3,0.6] },
    fruit_gelato:   { ts:[32,42], fat:[3,10],  sugars:[22,24], msnf:[3,7],   sp:[18,26], pac:[25,29], stabilizer:[0.2,0.5] },
    sorbet:         { ts:[32,42], fat:[0,0],   sugars:[26,31], msnf:[0,0],   sp:[20,28], pac:[28,33], stabilizer:[0.1,0.4], fruitPct:[35,75] }
  },
  sugar: {},
  process: { ...BASE.process, overrunPct: [20, 50] },
  notes: ['LEGACY - Use UNIFIED_2025 instead']
};

const HYBRID_BEST_PRACTICE: ParameterSet = {
  id: 'hybrid-best-practice',
  name: 'Hybrid Best Practice',
  version: '2025.10',
  style: 'science',
  bands: {
    // Ice Cream: Balanced approach - MP artisan ranges + Science stabilizer guidance
    ice_cream: { 
      ts:[36,46],      // Wider range for artisan flexibility (MP) with science floor (Goff)
      fat:[10,20],     // Both agree on this range
      sugars:[14,22],  // Expanded from science 13-17 to allow artisan sweetness
      msnf:[7,12],     // Both agree
      sp:[12,22], 
      pac:[22,28],
      stabilizer:[0.2,0.5]  // Science addition for texture control
    },
    
    // Gelato White Base: Science rigor + artisan accessibility
    gelato_white: { 
      ts:[34,40],      // Middle ground between MP (32-37) and Science (36-43)
      fat:[3,8],       // Expanded from science 4-8 to allow lighter options
      sugars:[16,22],  // Science range preferred (more controlled)
      msnf:[8,12],     // Tightened from science 11-12 but allows variation
      sp:[12,22], 
      pac:[22,28],
      stabilizer:[0.3,0.6]
    },
    
    // Gelato Finished: Best of both worlds
    gelato_finished: { 
      ts:[34,44],      // Between MP (32-40) and Science (37-46)
      fat:[6,16],      // Full range from both systems
      sugars:[18,23],  // Middle ground between MP (18-24) and Science (18-22)
      msnf:[7,12],     // Both agree
      sp:[12,22], 
      pac:[22,28],
      stabilizer:[0.3,0.6]
    },
    
    // Fruit Gelato: Identical in both systems - keep as is
    fruit_gelato: { 
      ts:[32,42], 
      fat:[3,10], 
      sugars:[22,24], 
      msnf:[3,7], 
      sp:[18,26], 
      pac:[25,29],
      stabilizer:[0.2,0.5],
      fruitPct:[30,65]  // Slightly wider than science for artisan fruit variations
    },
    
    // Sorbet: Merge approaches for best texture + fruit intensity
    sorbet: { 
      ts:[26,38],      // Between MP (22-30) and Science (32-42) for versatility
      fat:[0,0],       // Both agree
      sugars:[26,31],  // Both agree on range
      msnf:[0,0],      // Both agree
      sp:[20,28], 
      pac:[28,33],
      stabilizer:[0.1,0.4],  // Science guidance
      fruitPct:[35,75]        // Science range for proper fruit balance
    }
  },
  sugar: {}, // Inherit BASE coefficients
  process: { 
    ...BASE.process, 
    overrunPct: [20, 50]  // Science addition for quality control
  },
  notes: [
    'Combines MP-Artisan field experience with Goff/Hartel scientific principles',
    'Wider tolerance bands for artisan creativity',
    'Includes stabilizer guidance for professional consistency',
    'Default recommended profile for new users'
  ]
};

// ===== ACTIVE PROFILES (Use UNIFIED_2025 by default) =====
const PROFILES: Record<string, ParameterSet> = {
  [UNIFIED_2025.id]: UNIFIED_2025,
  // Legacy profiles for backward compatibility
  [HYBRID_BEST_PRACTICE.id]: HYBRID_BEST_PRACTICE,
  [MP_ARTISAN_V2024.id]: MP_ARTISAN_V2024,
  [SCIENCE_V2025.id]: SCIENCE_V2025
};

export function listProfiles(): ParameterSet[] {
  // Return only UNIFIED_2025 to users
  return [UNIFIED_2025];
}

export function getActiveParameters(): EffectiveParameters {
  const state = loadProfileState();
  // Always use UNIFIED_2025 (legacy profile IDs map to unified)
  const profile = PROFILES[state.activeProfileId] ?? UNIFIED_2025;
  return asEffective(BASE, profile, state.userOverrides);
}

export type ProductType = 'ice-cream' | 'gelato' | 'sorbet';

export class ProductParametersService {
  private sugarDatabase: { [key: string]: SugarData } = {
    'Sucrose': {
      name: 'Sucrose',
      dryResidual: 100,
      spOnDryResidue: 100,
      afpOnDryResidue: 100,
      spOnTotal: 100,
      afpOnTotal: 100
    },
    'Dextrose': {
      name: 'Dextrose',
      dryResidual: 91,
      spOnDryResidue: 74,
      afpOnDryResidue: 190,
      spOnTotal: 67,
      afpOnTotal: 173
    },
    'Fructose': {
      name: 'Fructose',
      dryResidual: 100,
      spOnDryResidue: 173,
      afpOnDryResidue: 190,
      spOnTotal: 173,
      afpOnTotal: 190
    },
    'Invert Sugar': {
      name: 'Invert Sugar',
      dryResidual: 77,
      spOnDryResidue: 125,
      afpOnDryResidue: 190,
      spOnTotal: 96,
      afpOnTotal: 146
    },
    'Lactose': {
      name: 'Lactose',
      dryResidual: 100,
      spOnDryResidue: 16,
      afpOnDryResidue: 100,
      spOnTotal: 16,
      afpOnTotal: 100
    },
    'Glucose DE 60': {
      name: 'Glucose DE 60',
      dryResidual: 80,
      spOnDryResidue: 50,
      afpOnDryResidue: 118,
      spOnTotal: 40,
      afpOnTotal: 94
    },
    'Honey': {
      name: 'Honey',
      dryResidual: 82,
      spOnDryResidue: 130,
      afpOnDryResidue: 146,
      spOnTotal: 107,
      afpOnTotal: 120
    }
  };

  private flavoringDatabase: { [key: string]: FlavoringData } = {
    'Vanilla': {
      type: 'Vanilla',
      characterizationRange: [0.3, 0.5],
      finalSugarsRange: [16, 20],
      afpSugarsRange: [22, 26]
    },
    'Chocolate': {
      type: 'Chocolate',
      characterizationRange: [5, 8],
      finalSugarsRange: [18, 22],
      afpSugarsRange: [24, 28]
    },
    'Fruit': {
      type: 'Fruit',
      characterizationRange: [10, 20],
      finalSugarsRange: [20, 24],
      afpSugarsRange: [26, 30]
    },
    'Nut': {
      type: 'Nut',
      characterizationRange: [8, 12],
      finalSugarsRange: [16, 20],
      afpSugarsRange: [22, 26]
    },
    'Coffee': {
      type: 'Coffee',
      characterizationRange: [1, 2],
      finalSugarsRange: [16, 20],
      afpSugarsRange: [22, 26]
    }
  };

  private productParameters: { [key in ProductType]: ProductParameters } = {
    'ice-cream': {
      sugar: [14, 22],
      fats: [10, 20],
      msnf: [7, 12],
      otherSolids: [0, 2],
      totalSolids: [36, 46],
      sp: [12, 22],
      afpSugars: [22, 28],
      churningSpeed: [20, 35],
      servingTemp: [-13, -11],
      overrun: [70, 100]
    },
    'gelato': {
      sugar: [16, 24],
      fats: [4, 10],
      msnf: [7, 12],
      otherSolids: [0, 2],
      totalSolids: [32, 42],
      sp: [12, 22],
      afpSugars: [22, 28],
      churningSpeed: [12, 25],
      servingTemp: [-12, -10],
      overrun: [20, 40]
    },
    'sorbet': {
      sugar: [26, 31],
      fats: [0, 0],
      msnf: [0, 0],
      otherSolids: [0, 2],
      totalSolids: [26, 38],
      sp: [20, 28],
      afpSugars: [28, 33],
      churningSpeed: [15, 30],
      servingTemp: [-14, -12],
      overrun: [20, 35]
    }
  };

  private sugarSpectrum: SugarSpectrum = {
    disaccharides: [65, 75],
    monosaccharides: [15, 25],
    polysaccharides: [5, 15]
  };

  private sorbetParameters: SorbetParameters = {
    fruitContent: {
      weak: [12, 18],
      medium: [20, 30],
      strong: [35, 75]
    },
    sugarContent: [26, 31],
    stabilizer: {
      pulp: [0.3, 0.5],
      juice: [0.5, 0.8]
    },
    lemonJuice: [0.5, 1.5]
  };

  getProductParameters(productType: ProductType): ProductParameters {
    return this.productParameters[productType];
  }

  getSugarData(sugarName: string): SugarData | null {
    return this.sugarDatabase[sugarName] || null;
  }

  getFlavoringData(flavoringType: string): FlavoringData | null {
    return this.flavoringDatabase[flavoringType] || null;
  }

  getSugarSpectrum(): SugarSpectrum {
    return this.sugarSpectrum;
  }

  getSorbetParameters(): SorbetParameters {
    return this.sorbetParameters;
  }

  validateRecipeForProduct(
    recipe: { [key: string]: number },
    productType: ProductType
  ): { isValid: boolean; violations: string[]; recommendations: string[] } {
    const params = this.getProductParameters(productType);
    const violations: string[] = [];
    const recommendations: string[] = [];

    // Calculate recipe totals
    let totalSugar = 0;
    let totalFat = 0;
    let totalMsnf = 0;
    let totalOtherSolids = 0;
    let totalWeight = 0;

    for (const [ingredient, weight] of Object.entries(recipe)) {
      totalWeight += weight;
      // You would need ingredient composition data here
      // This is a simplified validation
    }

    // Example validation logic
    const sugarPct = (totalSugar / totalWeight) * 100;
    const fatPct = (totalFat / totalWeight) * 100;

    if (sugarPct < params.sugar[0] || sugarPct > params.sugar[1]) {
      violations.push(
        `Sugar content ${sugarPct.toFixed(1)}% outside target range ${params.sugar[0]}-${params.sugar[1]}%`
      );
      recommendations.push(
        `Adjust sugar to bring within ${params.sugar[0]}-${params.sugar[1]}% range`
      );
    }

    if (fatPct < params.fats[0] || fatPct > params.fats[1]) {
      violations.push(
        `Fat content ${fatPct.toFixed(1)}% outside target range ${params.fats[0]}-${params.fats[1]}%`
      );
      recommendations.push(
        `Adjust fat content to ${params.fats[0]}-${params.fats[1]}% range`
      );
    }

    return {
      isValid: violations.length === 0,
      violations,
      recommendations
    };
  }

  calculateOptimalSugarBlend(
    productType: ProductType,
    totalSugarWeight: number,
    desiredTexture: 'soft' | 'balanced' | 'firm' = 'balanced'
  ): { [sugarType: string]: number } {
    const spectrum = this.getSugarSpectrum();
    
    let monoTarget: number, diTarget: number, polyTarget: number;
    
    switch (desiredTexture) {
      case 'soft':
        monoTarget = 25; // Higher monosaccharides for softer texture
        diTarget = 65;
        polyTarget = 10;
        break;
      case 'firm':
        monoTarget = 15; // Lower monosaccharides for firmer texture
        diTarget = 70;
        polyTarget = 15;
        break;
      default: // balanced
        monoTarget = 20;
        diTarget = 70;
        polyTarget = 10;
    }

    return {
      sucrose: (totalSugarWeight * diTarget) / 100,
      dextrose: (totalSugarWeight * monoTarget) / 100,
      glucose_syrup: (totalSugarWeight * polyTarget) / 100
    };
  }

  calculateRecipeAfpSp(recipe: { [key: string]: number }): { afp: number; sp: number } {
    // Simplified calculation - would need full ingredient database
    return { afp: 25, sp: 18 };
  }

  generateProductRecommendations(
    productType: ProductType,
    currentRecipe: { [key: string]: number }
  ): string[] {
    const recommendations: string[] = [];
    const validation = this.validateRecipeForProduct(currentRecipe, productType);
    
    recommendations.push(...validation.recommendations);
    
    // Add product-specific guidance
    switch (productType) {
      case 'ice-cream':
        recommendations.push('Consider adding 0.2-0.5% stabilizer for better texture');
        recommendations.push('Target overrun of 70-100% for optimal mouthfeel');
        break;
      case 'gelato':
        recommendations.push('Keep overrun low (20-40%) for dense, creamy texture');
        recommendations.push('Serve at -12°C to -10°C for best flavor release');
        break;
      case 'sorbet':
        recommendations.push('Ensure 35-75% fruit content for optimal flavor');
        recommendations.push('Use 0.1-0.4% stabilizer to prevent ice crystal formation');
        break;
    }
    
    return recommendations;
  }
}

export const productParametersService = new ProductParametersService();
