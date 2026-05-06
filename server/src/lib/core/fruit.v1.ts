/**
 * Fruit Acidity & Brix Module (Phase 2)
 * Handles citric acid neutralization and PAC adjustment for fruit-based recipes
 */

export interface FruitAcidityInput {
  acidityPct: number;      // % citric acid equivalent (0-3% typical)
  brixPct: number;         // Brix reading (sugar content, 5-25% typical)
  fruitGrams: number;      // Amount of fruit puree/pulp
  totalMixGrams: number;   // Total recipe weight
}

export interface AcidityAdjustment {
  deltaPAC: number;         // Change in PAC due to acidity (negative = reduces PAC)
  acidGrams: number;        // Total grams of citric acid in fruit
  notes: string[];          // Recommendations
  neutralizationNeed?: {    // Optional neutralization guidance
    bakingSodaGrams: number;
    calciumCarbonateGrams: number;
    reason: string;
  };
}

/**
 * Calculate PAC adjustment for fruit acidity
 * 
 * Scientific basis:
 * - Citric acid disrupts ice crystal formation (anti-freeze effect)
 * - But also interferes with sugar's anti-freeze properties
 * - Net effect: ~0.3-0.5 PAC units per 1% citric acid
 * - pH below 4.5 requires neutralization for optimal texture
 */
export function adjustPACforAcids(input: FruitAcidityInput): AcidityAdjustment {
  const { acidityPct, brixPct, fruitGrams, totalMixGrams } = input;
  
  // Calculate absolute acid amount
  const acidGrams = (acidityPct / 100) * fruitGrams;
  const acidInMixPct = (acidGrams / totalMixGrams) * 100;
  
  // PAC adjustment model (empirical)
  // High acidity reduces effective PAC because it interferes with sugar structure
  const pacReductionPerPct = 0.4; // PAC units lost per 1% citric acid
  const deltaPAC = -acidInMixPct * pacReductionPerPct;
  
  const notes: string[] = [];
  
  // Estimate pH (very rough - proper measurement needed)
  // pH ≈ 3.5 - 0.3 * log10(acidityPct) for citric acid
  const estimatedPH = 3.5 - 0.3 * Math.log10(Math.max(0.1, acidityPct));
  
  // Recommendations based on acidity level
  if (acidityPct < 0.5) {
    notes.push(`✅ Low acidity (${acidityPct.toFixed(2)}%) - No PAC adjustment needed`);
  } else if (acidityPct < 1.5) {
    notes.push(`⚠️ Moderate acidity (${acidityPct.toFixed(2)}%) - PAC reduced by ${Math.abs(deltaPAC).toFixed(2)} units`);
    notes.push(`Consider adding 1-2g extra sugar per 100g to compensate for texture`);
  } else {
    notes.push(`🔴 High acidity (${acidityPct.toFixed(2)}%) - PAC reduced by ${Math.abs(deltaPAC).toFixed(2)} units`);
    notes.push(`Strong sour taste - consider neutralization or blending with sweeter fruits`);
  }
  
  // Brix-acidity balance (sugar/acid ratio)
  const sugarAcidRatio = brixPct / Math.max(0.1, acidityPct);
  if (sugarAcidRatio < 10) {
    notes.push(`⚠️ Low sugar/acid ratio (${sugarAcidRatio.toFixed(1)}) - May taste too tart`);
    notes.push(`Recommended: Increase Brix to ${(acidityPct * 12).toFixed(1)}% or reduce acidity`);
  } else if (sugarAcidRatio > 30) {
    notes.push(`💡 High sugar/acid ratio (${sugarAcidRatio.toFixed(1)}) - Fruit flavor may be masked by sweetness`);
  } else {
    notes.push(`✅ Balanced sugar/acid ratio (${sugarAcidRatio.toFixed(1)}) - Good flavor balance`);
  }
  
  // Neutralization guidance (if pH < 4.5 or acidity > 1.5%)
  let neutralizationNeed: AcidityAdjustment['neutralizationNeed'];
  if (estimatedPH < 4.5 || acidityPct > 1.5) {
    // Citric acid (C6H8O7) MW = 192.12 g/mol, pKa1 = 3.13
    // NaHCO3 (baking soda) MW = 84.01 g/mol
    // CaCO3 (chalk) MW = 100.09 g/mol
    
    // To neutralize 1g citric acid:
    // Requires ~0.44g NaHCO3 or ~0.52g CaCO3
    const bakingSodaGrams = acidGrams * 0.44 * 0.7; // 70% neutralization (don't go to pH 7)
    const calciumCarbonateGrams = acidGrams * 0.52 * 0.7;
    
    neutralizationNeed = {
      bakingSodaGrams,
      calciumCarbonateGrams,
      reason: `Estimated pH ${estimatedPH.toFixed(2)} is below 4.5. Partial neutralization improves texture without losing fruit character.`
    };
    
    notes.push(`🧪 Optional neutralization: Add ${bakingSodaGrams.toFixed(1)}g baking soda OR ${calciumCarbonateGrams.toFixed(1)}g calcium carbonate`);
  }
  
  return {
    deltaPAC,
    acidGrams,
    notes,
    neutralizationNeed
  };
}

/**
 * Estimate neutralization need for acidic fruits
 * Simpler version for quick calculations
 */
export function estimateNeutralizationNeed(input: FruitAcidityInput): number {
  const acidGrams = (input.acidityPct / 100) * input.fruitGrams;
  // Return grams of baking soda needed for 70% neutralization
  return acidGrams * 0.44 * 0.7;
}

/**
 * Calculate effective Brix after dilution in mix
 */
export function effectiveBrixInMix(input: FruitAcidityInput): {
  effectiveBrix: number;
  sugarFromFruitGrams: number;
  sugarFromFruitPct: number;
} {
  const sugarFromFruitGrams = (input.brixPct / 100) * input.fruitGrams;
  const sugarFromFruitPct = (sugarFromFruitGrams / input.totalMixGrams) * 100;
  const effectiveBrix = sugarFromFruitPct; // In final mix
  
  return {
    effectiveBrix,
    sugarFromFruitGrams,
    sugarFromFruitPct
  };
}

/**
 * Fruit-specific PAC coefficients (empirical data)
 * Based on common gelato/sorbet fruits
 */
export const FRUIT_PAC_COEFFICIENTS: Record<string, {
  typicalAcidityPct: number;
  typicalBrixPct: number;
  pacModifier: number; // Multiplier on PAC calculation (fruit-specific effects)
  notes: string;
}> = {
  lemon: {
    typicalAcidityPct: 2.5,
    typicalBrixPct: 8,
    pacModifier: 0.85,
    notes: 'Very acidic - strongly reduces PAC, requires neutralization above 2%'
  },
  lime: {
    typicalAcidityPct: 2.2,
    typicalBrixPct: 7,
    pacModifier: 0.85,
    notes: 'Similar to lemon but slightly less acidic'
  },
  passion_fruit: {
    typicalAcidityPct: 1.8,
    typicalBrixPct: 14,
    pacModifier: 0.9,
    notes: 'High acidity but balanced by high Brix'
  },
  raspberry: {
    typicalAcidityPct: 1.5,
    typicalBrixPct: 10,
    pacModifier: 0.95,
    notes: 'Moderate acidity, good balance'
  },
  strawberry: {
    typicalAcidityPct: 0.8,
    typicalBrixPct: 8,
    pacModifier: 1.0,
    notes: 'Low acidity, minimal PAC impact'
  },
  mango: {
    typicalAcidityPct: 0.5,
    typicalBrixPct: 15,
    pacModifier: 1.05,
    notes: 'Very low acidity, high sugar content'
  },
  banana: {
    typicalAcidityPct: 0.3,
    typicalBrixPct: 20,
    pacModifier: 1.1,
    notes: 'Negligible acidity, very high Brix'
  }
};

/**
 * Get recommended acidity/Brix for a fruit type
 */
export function getFruitProfile(fruitName: string): typeof FRUIT_PAC_COEFFICIENTS[string] | null {
  const normalized = fruitName.toLowerCase().replace(/[^a-z]/g, '');
  for (const [key, value] of Object.entries(FRUIT_PAC_COEFFICIENTS)) {
    if (normalized.includes(key.replace(/_/g, ''))) {
      return value;
    }
  }
  return null;
}
