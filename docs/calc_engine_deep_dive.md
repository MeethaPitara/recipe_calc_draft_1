# Deep Dive: `calc.v2.ts` (Full Code Walkthrough)

This document provides a complete, line-by-line explanation of the ice cream calculation engine. Every line of code is included and explained.

---

### Lines 1-13: Imports and Setup
```typescript
/**
 * Verified Gelato Science v2.1 Calculator
 * Implements: final-verified-gelato-guide_v2.1.pdf
 */

import { IngredientData } from '@/types/ingredients';
import leightonTable from './leightonTable.json';
import { adjustPACforAcids, AcidityAdjustment, FruitAcidityInput } from './fruit.v1';
import { predictOverrun, suggestServingTemp, OverrunPrediction, ServingTempRecommendation } from './serving.v1';
import type { Mode } from '@/types/mode';
import { resolveMode } from './mode';
import { safeNumber, guardResult, validateIngredientComposition } from './validation';
```
**Explanation**:
- **Lines 1-4**: Documentation comment identifying the scientific standard (v2.1) this code implements.
- **Line 6**: Imports `IngredientData`, the TypeScript interface defining what an ingredient looks like (fat, sugar, water, etc.).
- **Line 7**: Imports `leightonTable.json`, the dataset containing the freezing point depression values for sucrose solutions.
- **Lines 8-9**: Imports specialized physics modules:
    - `fruit.v1`: Handles Ph/Acidity calculations for fruit.
    - `serving.v1`: Predicts Overrun (air) and Serving Temperature.
- **Lines 10-11**: Imports types and logic for "Modes" (Gelato vs Ice Cream vs Sorbet).
- **Line 12**: Imports safety utilities. `safeNumber` converts inputs to numbers (handling strings/NaN), and `guardResult` prevents crashes.

---

### Lines 14-62: Metrics Output Interface
```typescript
export type MetricsV2 = {
  // Basic composition (g)
  total_g: number;
  water_g: number;
  nonLactoseSugars_g: number;
  fat_g: number;
  msnf_g: number;
  other_g: number;

  // Basic composition (%)
  water_pct: number;
  nonLactoseSugars_pct: number;
  fat_pct: number;
  msnf_pct: number;
  other_pct: number;

  // Derived from MSNF
  protein_g: number;
  protein_pct: number;
  lactose_g: number;
  lactose_pct: number;

  // Total sugars (incl. lactose)
  totalSugars_g: number;
  totalSugars_pct: number;

  // Total solids
  ts_g: number;
  ts_pct: number;

  // Freezing point depression
  se_g: number; // Sucrose Equivalents
  sucrosePer100gWater: number;
  fpdse: number; // From sugars (Leighton)
  fpdsa: number; // From salts/MSNF
  fpdt: number;  // Total freezing point depression

  // POD (normalized sweetness index)
  pod_index: number;

  // Warnings
  warnings: string[];
  clampedLeighton?: boolean;

  // P2 Science Features
  fruitAdjustments?: AcidityAdjustment;
  overrunPrediction?: OverrunPrediction;
  servingTemp?: ServingTempRecommendation;
};
```
**Explanation**:
This TypeScript type defines the **shape of the result** returned by the calculator.
- **Composition (16-28)**: Physical mass (g) and Percentage (%) for the big 5 buckets: Water, Sugar, Fat, MSNF, Other.
- **Dairy Components (30-34)**: Breakout of Protein and Lactose from MSNF.
- **Derived Metrics (44-50)**: The physics engine outputs. `fpdt` is the most critical texturization metric.
- **P2 Features (58-61)**: New advanced features added in Science v2.1.

---

### Lines 64-67: Calculation Options
```typescript
export type CalcOptionsV2 = {
  evaporation_pct?: number;
  mode?: 'gelato' | 'ice_cream' | 'sorbet' | 'kulfi';
};
```
**Explanation**:
Configuration passed *into* the calculation.
- `evaporation_pct`: How much water is lost during cooking (0-100%).
- `mode`: The target product type, which changes the validation rules (guardrails).

---

### Lines 69-96: Leighton Lookup Function
```typescript
/**
 * Linear interpolation in Leighton table with clamping
 */
function leightonLookup(sucrosePer100gWater: number): { fpdse: number; clamped: boolean } {
  const data = leightonTable.data;
  const x = sucrosePer100gWater;

  // Clamp to table bounds
  if (x <= data[0].sucrosePer100gWater) {
    return { fpdse: data[0].fpdse, clamped: x < data[0].sucrosePer100gWater };
  }
  if (x >= data[data.length - 1].sucrosePer100gWater) {
    return { fpdse: data[data.length - 1].fpdse, clamped: x > data[data.length - 1].sucrosePer100gWater };
  }

  // Linear interpolation
  for (let i = 0; i < data.length - 1; i++) {
    const p1 = data[i];
    const p2 = data[i + 1];
    if (x >= p1.sucrosePer100gWater && x <= p2.sucrosePer100gWater) {
      const t = (x - p1.sucrosePer100gWater) / (p2.sucrosePer100gWater - p1.sucrosePer100gWater);
      const fpdse = p1.fpdse + t * (p2.fpdse - p1.fpdse);
      return { fpdse, clamped: false };
    }
  }

  return { fpdse: data[data.length - 1].fpdse, clamped: true };
}
```
**Explanation**:
Calculates Freezing Point Depression from Sugar (FPD-SE).
- **Inputs**: `sucrosePer100gWater` (Concentration).
- **Lines 77-82 (Clamping)**: If concentration is outside the table's range, it returns the minimum or maximum value and flags `clamped: true`.
- **Lines 85-93 (Interpolation)**: If concentration falls *between* two table rows (e.g. 30.5%), it linearly estimates the FPD value between them.

---

### Lines 98-105: Glucose Syrup Helper
```typescript
/**
 * Calculate glucose syrup contribution by DE split
 */
function calcGlucoseSyrupSE(solids_g: number, de: number): number {
  const dextrose_g = solids_g * (de / 100);
  const oligo_g = solids_g - dextrose_g;
  return 1.9 * dextrose_g + 1.0 * oligo_g;
}
```
**Explanation**:
Calculates the softening power of Glucose Syrup based on its DE (Dextrose Equivalent).
- **Logic**: Glucose Syrups are a mix of Dextrose (Small molecule, high power) and Oligosaccharides (Large molecule, low power).
- **Line 102**: Uses DE as a proxy for Dextrose percentage.
- **Line 104**: Applies weighting: `1.9x` for Dextrose (Softening), `1.0x` for Oligosaccharides (Neutral).

---

### Lines 108-115: Main Function Signature
```typescript
/**
 * Main v2.1 calculation function
 */
export function calcMetricsV2(
  rows: { ing: IngredientData; grams: number }[],
  opts: CalcOptionsV2 = {}
): MetricsV2 {
  const warnings: string[] = [];
```
**Explanation**:
The entry point of the engine.
- `rows`: The user's recipe (list of Ingredient + Grams).
- `opts`: Options like Evaporation.
- `warnings`: Initializes an empty array to collect error messages.

---

### Lines 116-126: Input Validation
```typescript
  // 0. Validate ingredients before calculation
  for (const { ing, grams } of rows) {
    if (grams <= 0) continue;
    const validation = validateIngredientComposition(ing);
    if (validation.nanValues?.length) {
      warnings.push(`⚠️ "${ing.name}" has invalid data: ${validation.nanValues.join(', ')}`);
    }
    if (validation.totalComposition && !validation.nanValues?.length) {
      warnings.push(`⚠️ "${ing.name}": ${validation.totalComposition}`);
    }
  }
```
**Explanation**:
Loops through every ingredient before starting math.
- **Line 118**: Skips ingredients with 0g.
- **Line 119**: Calls `validateIngredientComposition` to check if Fat + Sugar + Water > 100% or if values are missing (NaN).
- **Lines 120-125**: Adds readable warnings if data is bad.

---

### Lines 128-147: Batch Aggregation (The Summation)
```typescript
  // 1. Calculate batch totals with NaN guards
  const total_g = guardResult(rows.reduce((a, r) => a + safeNumber(r.grams), 0), 0, 'total_g');

  let water_g = 0, nonLactoseSugars_g = 0, fat_g = 0, msnf_g = 0, other_g = 0;
  for (const { ing, grams } of rows) {
    const g = safeNumber(grams);
    
    // Protect against NULL and NaN values
    const water_pct = safeNumber(ing.water_pct);
    const sugars_pct = safeNumber(ing.sugars_pct);
    const fat_pct = safeNumber(ing.fat_pct);
    const msnf_pct = safeNumber(ing.msnf_pct);
    const other_pct = safeNumber(ing.other_solids_pct);
    
    water_g += g * water_pct / 100;
    nonLactoseSugars_g += g * sugars_pct / 100;
    fat_g += g * fat_pct / 100;
    msnf_g += g * msnf_pct / 100;
    other_g += g * other_pct / 100;
  }
```
**Explanation**:
The "Mixing Bowl" phase.
- **Line 129**: Calculates total weight of ingredients. `guardResult` ensures we don't return NaN if something breaks.
- **Lines 131-147**: Iterates through ingredients again to sum up the components (Water, Sugar, Fat).
- **Note**: Water is calculated directly from `water_pct`, preserving accuracy for non-standard ingredients.

---

### Lines 149-154: Safety Guards
```typescript
  // Guard accumulated values
  water_g = guardResult(water_g, 0, 'water_g');
  nonLactoseSugars_g = guardResult(nonLactoseSugars_g, 0, 'nonLactoseSugars_g');
  fat_g = guardResult(fat_g, 0, 'fat_g');
  msnf_g = guardResult(msnf_g, 0, 'msnf_g');
  other_g = guardResult(other_g, 0, 'other_g');
```
**Explanation**:
Ensures that if any summation resulted in an invalid number (NaN), it defaults to 0 to safeguard the rest of the math.

---

### Lines 156-160: Evaporation (Cooking)
```typescript
  // 2. Apply evaporation
  const evap = Math.max(0, Math.min(100, opts.evaporation_pct ?? 0));
  const water_after_evap_g = water_g * (1 - evap / 100);
  const water_loss_g = water_g - water_after_evap_g;
  const total_after_evap_g = total_g - water_loss_g;
```
**Explanation**:
Simulates water loss during cooking.
- **Line 157**: Clamps evaporation between 0-100%.
- **Line 158**: Reduces `water_g` by the evaporation rate.
- **Line 160**: Calculates the new final batch weight (`total_after_evap_g`).

---

### Lines 162-170: Solids Decomposition
```typescript
  // 3. Protein & Lactose from MSNF
  const protein_g = msnf_g * 0.36;
  const lactose_g = msnf_g * 0.545;

  // 4. Total sugars (incl. lactose)
  const totalSugars_g = nonLactoseSugars_g + lactose_g;

  // 5. Total solids
  const ts_g = fat_g + msnf_g + nonLactoseSugars_g + other_g;
```
**Explanation**:
Breaks down complex solids.
- **Line 163-164**: Uses standard dairy constants (36% Protein, 54.5% Lactose) to calculate sub-components of MSNF.
- **Line 167**: Adds Lactose to the Sugar bucket.
- **Line 170**: Sums all solids to get Total Solids (`ts_g`).

---

### Lines 172-183: Percentage Calculation
```typescript
  // 6. Percentages
  const pct = (x: number) => total_after_evap_g > 0 ? (x / total_after_evap_g) * 100 : 0;
  
  const water_pct = pct(water_after_evap_g);
  const nonLactoseSugars_pct = pct(nonLactoseSugars_g);
  const fat_pct = pct(fat_g);
  const msnf_pct = pct(msnf_g);
  const other_pct = pct(other_g);
  const protein_pct = pct(protein_g);
  const lactose_pct = pct(lactose_g);
  const totalSugars_pct = pct(totalSugars_g);
  const ts_pct = pct(ts_g);
```
**Explanation**:
Converts all gram values into percentages of the final cooked batch.
- **Line 173**: Helper function `pct` handles the division and protects against division-by-zero.

---

### Lines 185-204: Sucrose Equivalents (Fruit Split)
```typescript
  // 7. Calculate Sucrose Equivalents (SE)
  let se_g = 0;
  
  for (const { ing, grams } of rows) {
    const g = grams || 0;
    const sug_g = g * (ing.sugars_pct || 0) / 100;
    
    if (sug_g <= 0) continue;

    // Handle fruit with sugar split
    if (ing.category === 'fruit' && ing.sugar_split) {
      const s = ing.sugar_split;
      const norm = (s.glucose ?? 0) + (s.fructose ?? 0) + (s.sucrose ?? 0) || 100;
      const g_glu = sug_g * ((s.glucose ?? 0) / norm);
      const g_fru = sug_g * ((s.fructose ?? 0) / norm);
      const g_suc = sug_g * ((s.sucrose ?? 0) / norm);

      se_g += g_suc + 1.90 * g_glu + 1.90 * g_fru;
      continue;
    }
```
**Explanation**:
Starts calculating "Anti-Freeze Power" (SE).
- **Lines 195-202**: If the ingredient is Fruit, it breaks down the sugar into Glucose, Fructose, and Sucrose using `ing.sugar_split`.
- **Line 202**: Applies **1.9x** multiplier to Glucose/Fructose (they are 2x stronger than sucrose). Sucrose stays 1.0x.

---

### Lines 206-216: Sucrose Equivalents (Syrups)
```typescript
    // Handle glucose syrup with DE split
    const id = (ing.id || '').toLowerCase();
    const name = (ing.name || '').toLowerCase();
    
    if (id.includes('glucose_syrup') || name.includes('glucose syrup')) {
      // Extract DE from name/id (e.g., "glucose_de60" or "Glucose Syrup DE60")
      const deMatch = (id + name).match(/de\s*(\d+)/i);
      const de = deMatch ? parseInt(deMatch[1]) : 60; // default DE60
      se_g += calcGlucoseSyrupSE(sug_g, de);
      continue;
    }
```
**Explanation**:
- **Line 210**: Detects Glucose Syrups.
- **Line 212**: regex extracts "DE" value from the name (e.g., "DE42").
- **Line 214**: Calls the `calcGlucoseSyrupSE` helper to calculate power based on DE.

---

### Lines 218-228: Sucrose Equivalents (Standard Sugars)
```typescript
    // Standard sugar types
    if (id.includes('dextrose') || name.includes('dextrose') || id.includes('glucose') || name.includes('glucose')) {
      se_g += 1.90 * sug_g;
    } else if (id.includes('fructose') || name.includes('fructose')) {
      se_g += 1.90 * sug_g;
    } else if (id.includes('invert') || name.includes('invert')) {
      se_g += 1.90 * sug_g; // Invert ~50/50 glucose/fructose
    } else {
      se_g += sug_g; // Default: sucrose (1.0)
    }
  }
```
**Explanation**:
Applies standard conversion factors:
- Dextrose/Glucose/Fructose/Invert: **1.9 SE**.
- Everything else defaults to Sucrose: **1.0 SE**.

---

### Lines 230-231: SE from Lactose
```typescript
  // Add lactose contribution to SE (0.545 from MSNF)
  se_g += 0.545 * msnf_g;
```
**Explanation**:
Adds the freezing depression effect of Lactose (from MSNF), which is ~half as potent as Sucrose per gram, but since we are calculating SE grams, we use the `0.545` factor directly on `msnf_g`? *Correction*: The comment says "0.545 from MSNF". Wait, Lactose is 54.5% of MSNF. Pure Lactose has SE=1.0. So `0.545 * MSNF_g` = `Expected_Lactose_Grams`. This is correct.

---

### Lines 233-243: Freezing Point Calculation
```typescript
  // 8. Freezing Point Depression
  const sucrosePer100gWater = water_after_evap_g > 0 ? (se_g / water_after_evap_g) * 100 : 0;
  const leightonResult = leightonLookup(sucrosePer100gWater);
  const fpdse = leightonResult.fpdse;
  
  if (leightonResult.clamped) {
    warnings.push(`⚠️ Leighton table clamped: ${sucrosePer100gWater.toFixed(1)} g sucrose/100g water is outside normal range`);
  }

  const fpdsa = water_after_evap_g > 0 ? (msnf_g * 2.37) / water_after_evap_g : 0;
  const fpdt = fpdse + fpdsa;
```
**Explanation**:
- **Line 234**: Calculates Sugar Concentration (`C`).
- **Line 235**: Gets Freezing Point from Sugars (`fpdse`) via Lookup.
- **Line 242**: Calculates Freezing Point from Salts (`fpdsa`). Formula: `(MSNF * 2.37) / Water`.
- **Line 243**: Sums them to get Total FPD (`fpdt`).

---

### Lines 245-280: POD Calculation
```typescript
  // 9. POD (normalized sweetness index per 100g total sugars)
  let pod_numerator = 0;
  
  for (const { ing, grams } of rows) {
    const g = grams || 0;
    const sug_g = g * (ing.sugars_pct || 0) / 100;
    
    if (sug_g <= 0) continue;

    if (ing.category === 'fruit' && ing.sugar_split) {
      const s = ing.sugar_split;
      const norm = (s.glucose ?? 0) + (s.fructose ?? 0) + (s.sucrose ?? 0) || 100;
      const g_glu = sug_g * ((s.glucose ?? 0) / norm);
      const g_fru = sug_g * ((s.fructose ?? 0) / norm);
      const g_suc = sug_g * ((s.sucrose ?? 0) / norm);

      pod_numerator += 70 * g_glu + 120 * g_fru + 100 * g_suc;
    } else {
      const id = (ing.id || '').toLowerCase();
      const name = (ing.name || '').toLowerCase();
      
      if (id.includes('dextrose') || name.includes('dextrose') || id.includes('glucose')) {
        pod_numerator += 70 * sug_g;
      } else if (id.includes('fructose') || name.includes('fructose')) {
        pod_numerator += 120 * sug_g;
      } else {
        pod_numerator += 100 * sug_g; // sucrose baseline
      }
    }
  }

  // Add lactose contribution to POD
  pod_numerator += 16 * lactose_g;
  
  const pod_index = totalSugars_g > 0 ? pod_numerator / totalSugars_g : 100;
```
**Explanation**:
Calculates Sweetness.
- Same loop structure as SE, but different weights:
    - Fructose: **120**
    - Sucrose: **100**
    - Dextrose: **70**
    - Lactose: **16** (Line 277)
- **Line 279**: Divides total sweetness numerator by total sugar weight to get the index.

---

### Lines 281-307: Fruit Acidity (P2)
```typescript
  // 10. P2 Science: Fruit Acidity Analysis
  let fruitAdjustments: AcidityAdjustment | undefined;
  
  for (const { ing, grams } of rows) {
    if (ing.category === 'fruit' && ing.acidity_citric_pct && ing.brix_estimate) {
      const fruitInput: FruitAcidityInput = {
        acidityPct: ing.acidity_citric_pct,
        brixPct: ing.brix_estimate,
        fruitGrams: grams,
        totalMixGrams: total_after_evap_g
      };
      
      const adjustment = adjustPACforAcids(fruitInput);
      
      // Add fruit acidity notes to warnings
      adjustment.notes.forEach(note => {
        warnings.push(`🍋 ${ing.name}: ${note}`);
      });
      
      // Store adjustment for UI display (take first/most significant fruit)
      if (!fruitAdjustments) {
        fruitAdjustments = adjustment;
      }
      
      break; // Process only first fruit for now (can extend to multi-fruit later)
    }
  }
```
**Explanation**:
- Detects if fruit is present.
- Calls `adjustPACforAcids` (imported line 8) to calculate how citric acid interacts with sweetness/freezing point.
- Pushes specific lemon warnings to the UI.

---

### Lines 310-338: Contextual Guardrails
```typescript
  // 11. Validation warnings
  const mode = opts.mode || 'gelato';
  
  // PHASE 2: Context-aware MSNF/Stabilizer guardrails
  const hasChocolate = rows.some(r => 
    r.ing.name.toLowerCase().includes('chocolate') ||
    r.ing.name.toLowerCase().includes('cocoa') ||
    r.ing.name.toLowerCase().includes('cacao')
  );
  
  const hasNutsOrEggs = rows.some(r => 
    (r.ing.category === 'other' && (
      r.ing.name.toLowerCase().includes('nut') ||
      r.ing.name.toLowerCase().includes('almond') ||
      r.ing.name.toLowerCase().includes('pistachio') ||
      r.ing.name.toLowerCase().includes('hazelnut')
    )) ||
    r.ing.name.toLowerCase().includes('egg')
  );
  
  let contextualMSNF: [number, number] = [9, 12]; // Default
  let contextLabel = 'standard';
  
  if (hasChocolate) {
    contextualMSNF = [7, 9];
    contextLabel = 'chocolate';
  } else if (hasNutsOrEggs) {
    contextualMSNF = [8, 10];
    contextLabel = 'nuts/eggs';
  }
```
**Explanation**:
Determines the "Context" of the recipe.
- **Lines 313-327**: Scans for "Chocolate" or "Nuts/Eggs".
- **Lines 329-338**: Adjusts the valid range for MSNF.
    - Chocolate recipes need LESS MSNF (7-9%).
    - Nut recipes need LESS MSNF (8-10%).
    - Standard recipes need 9-12%.

---

### Lines 340-356: Gelato Logic
```typescript
  if (mode === 'gelato') {
    // Gelato guardrails
    if (fat_pct < 6 || fat_pct > 10) {
      warnings.push(`Fat ${fat_pct.toFixed(1)}% outside gelato range 6-10%`);
    }
    if (msnf_pct < contextualMSNF[0] || msnf_pct > contextualMSNF[1]) {
      warnings.push(`⚠️ MSNF ${msnf_pct.toFixed(1)}% outside ${contextLabel} range ${contextualMSNF[0]}-${contextualMSNF[1]}%`);
    }
    if (totalSugars_pct < 16 || totalSugars_pct > 22) {
      warnings.push(`Total sugars ${totalSugars_pct.toFixed(1)}% outside gelato range 16-22%`);
    }
    if (ts_pct < 36 || ts_pct > 45) {
      warnings.push(`Total solids ${ts_pct.toFixed(1)}% outside gelato range 36-45%`);
    }
    if (fpdt < 2.5 || fpdt > 3.5) {
      warnings.push(`FPDT ${fpdt.toFixed(2)}°C outside gelato target 2.5-3.5°C`);
    }
```
**Explanation**:
Validation logic for **Gelato**.
- **Fat**: 6-10%.
- **Sugars**: 16-22%.
- **Solids**: 36-45%.
- **FPDT**: 2.5 - 3.5 (Soft texture).

---

### Lines 357-373: Ice Cream Logic
```typescript
  } else if (mode === 'ice_cream') {
    // Ice Cream guardrails
    if (fat_pct < 10 || fat_pct > 16) {
      warnings.push(`Fat ${fat_pct.toFixed(1)}% outside ice cream range 10-16%`);
    }
    if (msnf_pct < contextualMSNF[0] || msnf_pct > contextualMSNF[1]) {
      warnings.push(`⚠️ MSNF ${msnf_pct.toFixed(1)}% outside ${contextLabel} range ${contextualMSNF[0]}-${contextualMSNF[1]}%`);
    }
    if (totalSugars_pct < 14 || totalSugars_pct > 20) {
      warnings.push(`Total sugars ${totalSugars_pct.toFixed(1)}% outside ice cream range 14-20%`);
    }
    if (ts_pct < 36 || ts_pct > 42) {
      warnings.push(`Total solids ${ts_pct.toFixed(1)}% outside ice cream range 36-42%`);
    }
    if (fpdt < 2.2 || fpdt > 3.2) {
      warnings.push(`FPDT ${fpdt.toFixed(2)}°C outside ice cream target 2.2-3.2°C`);
    }
```
**Explanation**:
Validation logic for **American Ice Cream**.
- **Fat**: 10-16% (Higher than gelato).
- **Sugars**: 14-20% (Lower than gelato).
- **FPDT**: 2.2 - 3.2 (Harder texture/Colder serving).

---

### Lines 374-402: Sorbet & Kulfi Logic
```typescript
  } else if (mode === 'sorbet') {
    // Sorbet guardrails
    if (fat_pct > 1) {
      warnings.push(`Fat ${fat_pct.toFixed(1)}% above sorbet max 1%`);
    }
    if (totalSugars_pct < 26 || totalSugars_pct > 31) {
      warnings.push(`Total sugars ${totalSugars_pct.toFixed(1)}% outside sorbet range 26-31%`);
    }
    if (fpdt > -2.0 || fpdt < -4.0) {
      warnings.push(`FPDT ${fpdt.toFixed(2)}°C outside sorbet target -4.0 to -2.0°C`);
    }
  } else {
    // Kulfi guardrails
    if (fat_pct < 10 || fat_pct > 12) {
      warnings.push(`Fat ${fat_pct.toFixed(1)}% outside kulfi range 10-12%`);
    }
    if (protein_pct < 6 || protein_pct > 9) {
      warnings.push(`Protein ${protein_pct.toFixed(1)}% outside kulfi range 6-9%`);
    }
    // ... (More Kulfi guards)
  }
```
**Explanation**:
- **Sorbet**: Strictly NO fat (<1%). High sugar (26-31%) to compensate for lack of solids. Very depressed FPD (-2 to -4).
- **Kulfi**: High protein (6-9%) for dense texture (boiled milk).

---

### Lines 404-434: Sugar Spectrum Analysis
```typescript
  // PHASE 4: Sugar Spectrum Policy
  let disaccharides_g = lactose_g; // Start with lactose
  let monosaccharides_g = 0;
  let polysaccharides_g = 0;
  
  for (const { ing, grams } of rows) {
    const sug_g = grams * (ing.sugars_pct || 0) / 100;
    if (sug_g <= 0) continue;
    
    const id = (ing.id || '').toLowerCase();
    const name = (ing.name || '').toLowerCase();
    
    if (name.includes('sucrose') || id.includes('sucrose')) {
      disaccharides_g += sug_g;
    } else if (name.includes('dextrose') || id.includes('dextrose')) {
      monosaccharides_g += sug_g;
    } else if ((name.includes('glucose') || id.includes('glucose')) && !name.includes('syrup')) {
      monosaccharides_g += sug_g;
    } else if (name.includes('fructose') || id.includes('fructose')) {
      monosaccharides_g += sug_g;
    } else if (name.includes('glucose syrup') || name.includes('maltodextrin')) {
      polysaccharides_g += sug_g;
    } else if (ing.category === 'fruit' && ing.sugar_split) {
      const s = ing.sugar_split;
      const norm = (s.glucose ?? 0) + (s.fructose ?? 0) + (s.sucrose ?? 0) || 100;
      monosaccharides_g += sug_g * ((s.glucose ?? 0) + (s.fructose ?? 0)) / norm;
      disaccharides_g += sug_g * ((s.sucrose ?? 0) / norm);
    } else {
      disaccharides_g += sug_g; // Default to disaccharides
    }
  }
```
**Explanation**:
Categorizes every gram of sugar into one of three buckets:
1.  **Monosaccharides**: Dextrose, Fructose (Simple sugars).
2.  **Disaccharides**: Sucrose, Lactose (Double sugars).
3.  **Polysaccharides**: Corn Syrup, Maltodextrin (Chains).

---

### Lines 436-450: Sugar Spectrum Validation
```typescript
  if (totalSugars_g > 0) {
    const disaccharides_pct = (disaccharides_g / totalSugars_g) * 100;
    const monosaccharides_pct = (monosaccharides_g / totalSugars_g) * 100;
    const polysaccharides_pct = (polysaccharides_g / totalSugars_g) * 100;
    
    if (disaccharides_pct < 50) {
      warnings.push(`⚠️ Sugar spectrum: Disaccharides ${disaccharides_pct.toFixed(1)}% below target 50-100%`);
    }
    if (monosaccharides_pct > 25) {
      warnings.push(`⚠️ Sugar spectrum: Monosaccharides ${monosaccharides_pct.toFixed(1)}% exceeds target 0-25%`);
    }
    if (polysaccharides_pct > 35) {
      warnings.push(`⚠️ Sugar spectrum: Polysaccharides ${polysaccharides_pct.toFixed(1)}% exceeds target 0-35%`);
    }
  }
```
**Explanation**:
Enforces proper sugar theory.
- **Rule**: You want mostly Disaccharides (>50%) for good body.
- **Risk**: Too many Monosaccharides (>25%) makes ice cream sticky/slimy.
- **Risk**: Too many Polysaccharides (>35%) makes ice cream gummy/chewy.

---

### Lines 452-477: SP/AFP Validation
```typescript
  // PHASE 5: SP/AFP Target Validation
  const sp = pod_index;
  const afp_sugars = sucrosePer100gWater;
  
  if (mode === 'gelato') {
    if (sp < 12 || sp > 22) {
      warnings.push(`⚠️ SP ${sp.toFixed(1)} outside gelato target 12-22`);
    }
    if (afp_sugars < 22 || afp_sugars > 28) {
      warnings.push(`⚠️ AFP(sugars) ${afp_sugars.toFixed(1)} outside gelato target 22-28`);
    }
  } 
  // ... (Ice cream and sorbet guards)
```
**Explanation**:
Additional validation using alternate metrics.
- **SP**: Sweetness Power (POD Index).
- **AFP**: Anti-Freezing Power (Sugar Concentration).
- These are traditional Italian gelato metrics, retained for compatibility.

---

### Lines 480-493: Defect Prevention & Troubleshooting
```typescript
  // Defect prevention flags
  if (protein_pct >= 5) {
    warnings.push(`⚠️ Protein ≥5% (${protein_pct.toFixed(1)}%) → risk of chewiness/sandiness. Consider lowering MSNF.`);
  }
  if (lactose_pct >= 11) {
    warnings.push(`⚠️ Lactose ≥11% (${lactose_pct.toFixed(1)}%) → risk of crystallization. Shift sugars to glucose syrup or reduce MSNF.`);
  }

  // Troubleshooting suggestions
  if (fpdt < 2.5) {
    warnings.push(`🔧 Too soft (FPDT < 2.5°C): Lower dextrose/raise sucrose; reduce total sugars; or raise total solids.`);
  }
  if (fpdt > 3.5) {
    warnings.push(`🔧 Too hard (FPDT > 3.5°C): Add dextrose 2-4% or increase water within guardrails.`);
  }
```
**Explanation**:
- **Line 483**: Checks for **Sandiness**. If Lactose > 11%, it will crystallize in the freezer (sand texture).
- **Lines 488-493**: Human-readable advice. If FPDT is bad, it tells the user *how* to fix it (e.g. "Add dextrose").

---

### Lines 495-503: Overrun Prediction
```typescript
  // 12. P2 Science: Overrun Prediction
  const overrunPrediction = predictOverrun({
    fatPct: fat_pct,
    tsPct: ts_pct,
    stabilizerPct: 0.5, // Assume default stabilizer (can be refined)
    proteinPct: protein_pct,
    processType: 'batch',
    agingTimeHours: 4
  });
```
**Explanation**:
Calls the `predictOverrun` module.
- Inputs: Fat, Solids, Protein.
- Output: How much air (%) the mix is likely to hold.

---

### Lines 505-512: Serving Temp Prediction
```typescript
  // 13. P2 Science: Serving Temperature Guidance
  const servingTemp = suggestServingTemp({
    fpdtC: fpdt,
    fatPct: fat_pct,
    sugarsPct: totalSugars_pct,
    overrunPct: overrunPrediction.estimatedPct,
    productType: mode === 'gelato' ? 'gelato' : mode === 'ice_cream' ? 'ice_cream' : 'kulfi'
  });
```
**Explanation**:
Calls the `suggestServingTemp` module.
- Inputs: Freezing Point (`fpdt`), Fat, Overrun.
- Output: Recommended serving temperature (e.g., "-14°C").

---

### Lines 514-555: Return Statement
```typescript
  return {
    total_g: total_after_evap_g,
    water_g: water_after_evap_g,
    nonLactoseSugars_g,
    fat_g,
    msnf_g,
    other_g,

    water_pct,
    nonLactoseSugars_pct,
    fat_pct,
    msnf_pct,
    other_pct,

    protein_g,
    protein_pct,
    lactose_g,
    lactose_pct,

    totalSugars_g,
    totalSugars_pct,

    ts_g,
    ts_pct,

    se_g,
    sucrosePer100gWater,
    fpdse,
    fpdsa,
    fpdt,

    pod_index,

    warnings,
    clampedLeighton: leightonResult.clamped,

    // P2 Science Features
    fruitAdjustments,
    overrunPrediction,
    servingTemp
  };
}
```
**Explanation**:
Returns the fully calculated `MetricsV2` object. This object drives the main UI dashboard.
