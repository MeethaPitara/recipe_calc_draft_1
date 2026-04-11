# 13 — Complete Math Specification for PitaraLab

## Purpose
This document contains every calculation formula used in the PitaraLab Recipe & Production OS. Each formula is written in pseudocode with exact variable names, ready for direct translation into TypeScript. No ambiguity, no prose explanations — pure math.

This is the single source of truth for all computation logic.

---

# PART A: RECIPE CALCULATOR

---

## A1. Inputs (Per Ingredient)

From the user:
```
ingredient.grams          // weight in grams as entered by user
```

From Supabase `ingredients` table:
```
ingredient.fat_pct            // fat percentage (0–100)
ingredient.sugar_pct          // total sugar percentage (0–100)
ingredient.msnf_pct           // milk solids non-fat percentage (0–100)
ingredient.other_solids_pct   // other solids percentage (0–100)
ingredient.water_pct          // water percentage (0–100)
ingredient.sugar_type         // enum: 'sucrose' | 'lactose' | 'dextrose' | 'fructose' | 'invert' | 'honey' | 'agave' | 'maple' | 'trehalose' | 'glucose_syrup_60' | 'glucose_syrup_42' | 'dry_glucose_38' | 'maltodextrin' | 'mixed' | 'none'
ingredient.sp_total           // SP on Total (from reference table, decimal)
ingredient.afp_total          // AFP on Total (from reference table, decimal)
ingredient.dry_residual_pct   // dry residual percentage (from reference table)
```

---

## A2. SP and AFP Factor Lookup Table

Store these in the DB or as a constant. These are the verified Carpigiani values. Use **"on Total"** values for all calculations since we work with ingredients as weighed.

```
SUGAR_FACTORS = {
  sucrose:           { dry_pct: 100, sp_dry: 1.00, afp_dry: 1.00, sp_total: 1.00, afp_total: 1.00 },
  lactose:           { dry_pct: 100, sp_dry: 0.16, afp_dry: 1.00, sp_total: 0.16, afp_total: 1.00 },
  trehalose:         { dry_pct:  91, sp_dry: 0.45, afp_dry: 1.00, sp_total: 0.41, afp_total: 0.91 },
  maple_syrup:       { dry_pct:  67, sp_dry: 1.00, afp_dry: 1.00, sp_total: 0.67, afp_total: 0.67 },
  dextrose:          { dry_pct:  92, sp_dry: 0.70, afp_dry: 1.90, sp_total: 0.64, afp_total: 1.75 },
  fructose:          { dry_pct: 100, sp_dry: 1.70, afp_dry: 1.90, sp_total: 1.70, afp_total: 1.90 },
  invert:            { dry_pct:  75, sp_dry: 1.25, afp_dry: 1.90, sp_total: 0.94, afp_total: 1.43 },
  honey:             { dry_pct:  80, sp_dry: 1.30, afp_dry: 1.90, sp_total: 1.04, afp_total: 1.52 },
  agave:             { dry_pct:  76, sp_dry: 1.40, afp_dry: 1.90, sp_total: 1.06, afp_total: 1.44 },
  glucose_syrup_60:  { dry_pct:  80, sp_dry: 0.64, afp_dry: 1.20, sp_total: 0.51, afp_total: 0.96 },
  glucose_syrup_42:  { dry_pct:  80, sp_dry: 0.52, afp_dry: 0.92, sp_total: 0.42, afp_total: 0.74 },
  dry_glucose_38:    { dry_pct:  96, sp_dry: 0.23, afp_dry: 0.45, sp_total: 0.22, afp_total: 0.43 },
  maltodextrin:      { dry_pct:  95, sp_dry: 0.09, afp_dry: 0.23, sp_total: 0.09, afp_total: 0.22 },
}
```

---

## A3. Step 1 — Component Mass Accumulation

For each ingredient `i` in the recipe:

```
fat_g[i]          = ingredient[i].grams × ingredient[i].fat_pct / 100
sugar_g[i]        = ingredient[i].grams × ingredient[i].sugar_pct / 100
msnf_g[i]         = ingredient[i].grams × ingredient[i].msnf_pct / 100
otherSolids_g[i]  = ingredient[i].grams × ingredient[i].other_solids_pct / 100
water_g[i]        = ingredient[i].grams × ingredient[i].water_pct / 100
```

Accumulate totals:

```
totalFat_g          = Σ fat_g[i]
totalSugar_g        = Σ sugar_g[i]
totalMSNF_g         = Σ msnf_g[i]
totalOtherSolids_g  = Σ otherSolids_g[i]
totalWater_g        = Σ water_g[i]
recipeTotalMass_g   = Σ ingredient[i].grams
```

### Integrity check:

```
computedTotal = totalFat_g + totalSugar_g + totalMSNF_g + totalOtherSolids_g + totalWater_g
drift = |computedTotal - recipeTotalMass_g|

if (drift > 0.5):
    FLAG: "One or more ingredient compositions do not sum to 100%"
```

---

## A4. Step 2 — Percentage Metrics

```
fat_pct          = (totalFat_g / recipeTotalMass_g) × 100
sugar_pct        = (totalSugar_g / recipeTotalMass_g) × 100
msnf_pct         = (totalMSNF_g / recipeTotalMass_g) × 100
otherSolids_pct  = (totalOtherSolids_g / recipeTotalMass_g) × 100
totalSolids_pct  = fat_pct + sugar_pct + msnf_pct + otherSolids_pct
water_pct        = 100 - totalSolids_pct
```

### Rules:
- `totalSolids_pct` is ALWAYS computed. Never entered directly.
- `water_pct` is ALWAYS computed. Never entered directly.
- `recipeTotalMass_g` is the actual sum. NEVER assume 1000g.

---

## A5. Step 3 — SE (Sucrose Equivalents in grams)

SE converts all sugars to sucrose-equivalent freezing power using AFP on Total.

For each ingredient `i` where `sugar_type ≠ 'none'`:

```
se_g[i] = sugar_g[i] × ingredient[i].afp_total
```

Where `afp_total` is looked up from `SUGAR_FACTORS` based on `ingredient[i].sugar_type`.

### For composite ingredients (pastes) with `sugar_type = 'mixed'`:

If the paste has a pre-computed blended `afp_total` stored in the DB:
```
se_g[i] = sugar_g[i] × ingredient[i].afp_total
```

If not, trace through the paste's sub-recipe and compute each sugar source's SE individually, then sum.

### Total SE:

```
totalSE_g = Σ se_g[i]
```

---

## A6. Step 4 — FPDT (Freezing Point Depression Total)

### Step 4a: Sugar concentration in available water

```
sucrosePer100gWater = (totalSE_g / totalWater_g) × 100
```

### Step 4b: FPDse via Leighton Curve Lookup

```
fpdse = leightonLookup(sucrosePer100gWater)
```

The lookup function linearly interpolates between the nearest data points:

```
LEIGHTON_TABLE = [
    { concentration:  1, fpd: 0.056 },
    { concentration:  2, fpd: 0.112 },
    { concentration:  3, fpd: 0.168 },
    { concentration:  4, fpd: 0.225 },
    { concentration:  5, fpd: 0.283 },
    { concentration: 10, fpd: 0.565 },
    { concentration: 15, fpd: 0.870 },
    { concentration: 20, fpd: 1.200 },
    { concentration: 25, fpd: 1.560 },
    { concentration: 30, fpd: 1.950 },
    { concentration: 35, fpd: 2.370 },
    { concentration: 40, fpd: 2.830 },
    { concentration: 45, fpd: 3.330 },
    { concentration: 50, fpd: 3.900 },
    { concentration: 55, fpd: 4.510 },
    { concentration: 60, fpd: 5.200 },
    { concentration: 65, fpd: 5.950 },
    { concentration: 70, fpd: 6.800 },
    { concentration: 75, fpd: 7.700 },
]
```

### Interpolation function:

```
function leightonLookup(x):
    if x <= LEIGHTON_TABLE[0].concentration:
        return LEIGHTON_TABLE[0].fpd × (x / LEIGHTON_TABLE[0].concentration)
    
    if x >= LEIGHTON_TABLE[last].concentration:
        FLAG: "Sugar concentration exceeds Leighton table range"
        return LEIGHTON_TABLE[last].fpd  // cap at last known value

    find i such that LEIGHTON_TABLE[i].concentration <= x < LEIGHTON_TABLE[i+1].concentration
    
    lower = LEIGHTON_TABLE[i]
    upper = LEIGHTON_TABLE[i+1]
    
    fraction = (x - lower.concentration) / (upper.concentration - lower.concentration)
    
    return lower.fpd + fraction × (upper.fpd - lower.fpd)
```

### Step 4c: FPDsa from MSNF salts

```
fpdsa = (totalMSNF_g × 2.37) / totalWater_g
```

Where `2.37` is the empirical constant for freezing point depression from milk mineral salts.

### Step 4d: Total FPDT

```
fpdt = fpdse + fpdsa
```

**Unit: °C (degrees Celsius of freezing point depression below 0°C)**

---

## A7. Step 5 — SP Index (Sweetness Power / POD)

### Step 5a: Accumulate SP numerator

For each ingredient `i` where `sugar_type ≠ 'none'`:

```
sp_contribution[i] = sugar_g[i] × ingredient[i].sp_total
```

```
sp_numerator = Σ sp_contribution[i]
```

### Step 5b: Total sugar mass (denominator)

```
totalSugarsAll_g = Σ sugar_g[i]   // for ALL sugar-bearing ingredients, including lactose sources
```

### Step 5c: SP Index (relative blend sweetness)

```
sp_index = sp_numerator / totalSugarsAll_g
```

**Interpretation:** A unitless ratio where 1.00 = pure sucrose sweetness. Values below 1.00 mean the blend is less sweet than pure sucrose. Values above 1.00 mean sweeter.

### Step 5d: SP of total recipe (absolute sweetness intensity)

```
sp_recipe = (sp_numerator / recipeTotalMass_g) × 100
```

**Interpretation:** Sweetness contribution per 100g of mix. Useful for comparing recipes of different sizes.

---

## A8. Step 6 — Serving Temperature Prediction

### Estimating frozen water percentage at a given temperature

Once FPDT is known, we can estimate texture at any serving temperature.

```
// Approximate relationship (Raoult's law simplification):
// At temperature T (in °C, negative), the fraction of water that is frozen:

T_serving = -18    // home freezer, °C
T_freezing_point = -fpdt   // predicted freezing point of the mix

if T_serving >= T_freezing_point:
    frozen_fraction = 0    // product is not frozen at this temperature
else:
    frozen_fraction = 1 - (fpdt / |T_serving|)
    frozen_fraction = clamp(frozen_fraction, 0, 1)

frozen_water_pct = frozen_fraction × 100
unfrozen_water_pct = 100 - frozen_water_pct
```

**Note:** This is a simplified approximation. The real ice curve is non-linear. For the MVP, this gives a reasonable estimate. A more accurate model uses the empirical ice fraction curves from the literature, but this formula is sufficient for the agent to reason about texture.

### Interpretation:
```
frozen_water_pct > 85%  → very hard, difficult to scoop
frozen_water_pct 70-85% → firm, scoopable with effort
frozen_water_pct 55-70% → ideal gelato range at serving temp
frozen_water_pct 40-55% → soft, barely holds shape
frozen_water_pct < 40%  → soupy, will not hold a scoop
```

---

## A9. AFP Index (Total Recipe)

This is the AFP value the Carpigiani Analytical Compensation table references.

```
afp_numerator = Σ (sugar_g[i] × ingredient[i].afp_total)    // for all sugar-bearing ingredients
afp_index = (afp_numerator / recipeTotalMass_g) × 100
```

**Interpretation:** Total anti-freezing power per 100g of mix. Compare against flavor-category targets:

```
TARGET_AFP = {
  nuts:               { min: 22, max: 26 },
  dairy:              { min: 23, max: 27 },
  sugary_pastes:      { min: 24, max: 28 },
  sugary_fatty_pastes:{ min: 23, max: 27 },
  fruit:              { min: 25, max: 29 },
  chocolate:          { min: 23, max: 27 },
}
```

---

## A10. Validation

### Hard limits (reject if violated):

```
if msnf_pct > 12.0    → ERROR: "MSNF exceeds 12% — sandiness risk"
if totalSolids_pct > 45.0 → ERROR: "Total solids exceeds 45% — unprocessable"
if fat_pct > 16.0      → ERROR: "Fat exceeds 16%"
if sugar_pct > 30.0    → ERROR: "Sugar exceeds 30% — will not freeze"
if water_pct < 40.0    → ERROR: "Water below 40% — not a frozen dessert"
if water_pct > 78.0    → ERROR: "Water above 78% — extremely icy"
if any ingredient.grams < 0 → ERROR: "Negative grams"
if drift > 0.5         → ERROR: "Mass does not conserve"
```

### Warning zones (flag for review):

```
if msnf_pct > 11.0 && msnf_pct <= 12.0    → WARNING: "MSNF approaching sandiness limit"
if totalSolids_pct > 42.0 && <= 45.0       → WARNING: "Total solids high — dense product"
if fat_pct > 10.0 && <= 16.0               → WARNING: "Fat above gelato range"
```

### Soft limits (flag, allow override):

```
// Use flavor-category-specific AFP targets
if afp_index < TARGET_AFP[category].min → WARNING: "AFP below target — may be too hard"
if afp_index > TARGET_AFP[category].max → WARNING: "AFP above target — may be too soft"
```

---

# PART B: PRODUCTION MODE — LEVEL 1 (DEMAND-DRIVEN)

---

## B1. Global Inputs

```
totalOutput_L         // total planned finished output in liters
overrunPct            // entered as percentage (e.g., 30)
lossPct               // entered as percentage (e.g., 5)
density_kgL           // mix density in kg/L (e.g., 1.08)
finLitresPerKgBilled  // vendor billing rule: finished liters per kg billed
manufacturerRate_Rs   // manufacturer rate in Rs per kg
```

### Decimal conversions (do once, use everywhere):
```
overrun = overrunPct / 100       // 30 → 0.30
loss    = lossPct / 100          // 5  → 0.05
```

---

## B2. Per-SKU Calculations

For each SKU row `s`:

```
Inputs:
  s.flavour        // flavour name (links to a recipe)
  s.include        // boolean toggle
  s.packSize_L     // pack size in liters (0.1 or 0.5)
  s.splitRatio     // fraction of total output (0–1, all active SKUs must sum to 1.0)
  s.recipeVersion  // linked recipe version ID
```

### Target output:
```
s.targetOutput_L = totalOutput_L × s.splitRatio
```

### Units (always round UP):
```
s.units = ceil(s.targetOutput_L / s.packSize_L)
```

### Planned output (from rounded units):
```
s.plannedOutput_L = s.units × s.packSize_L
```

### Top-up (waste from rounding):
```
s.topUp_L = s.plannedOutput_L - s.targetOutput_L
```

### Mix required (work backwards from frozen output to liquid mix):
```
s.mixRequired_L = s.plannedOutput_L / (1 + overrun) / (1 - loss)
```

### Expected pack weight:
```
s.expectedPackWeight_g = s.packSize_L × density_kgL × 1000 / (1 + overrun)
```

---

## B3. Per-Flavour Aggregation

Group SKUs by flavour (a flavour can have both 100ml and 500ml SKUs):

```
flavour.totalMixRequired_L = Σ s.mixRequired_L   // for all SKUs of this flavour
flavour.totalUnits = Σ s.units
flavour.totalPlannedOutput_L = Σ s.plannedOutput_L
```

### Total production mass for the flavour:
```
flavour.totalProductionMass_g = flavour.totalMixRequired_L × density_kgL × 1000
```

---

## B4. Billing and Cost

Per flavour:

```
flavour.billedKg = flavour.totalPlannedOutput_L / finLitresPerKgBilled
flavour.mfgCost_Rs = flavour.billedKg × manufacturerRate_Rs
flavour.costPerUnit_Rs = flavour.mfgCost_Rs / flavour.totalUnits
```

---

## B5. Procurement Explosion

For each flavour, using the linked recipe version:

### Get recipe data:
```
recipeItems[] = load recipe items for flavour.recipeVersion
recipeTotalMass_g = Σ recipeItems[j].grams
```

### For each ingredient `j` in the recipe:
```
share[j] = recipeItems[j].grams / recipeTotalMass_g
requiredIngredient_g[j] = share[j] × flavour.totalProductionMass_g
```

### CRITICAL: Do NOT assume recipeTotalMass_g = 1000g

### Aggregate across all flavours:
For each unique ingredient across all flavours:
```
totalRequired_g[ingredient] = Σ requiredIngredient_g[j]   // across all flavours using this ingredient
```

### Export: Procurement list with ingredient name, total grams, total kg.

---

## B6. Base Breakdown

If recipes reference bases (e.g., "White Base", "Chocolate Base"):

### Step 1: Aggregate base requirement across flavours
```
For each flavour:
    baseIngredient = find the ingredient in the recipe that IS a base
    baseShare = baseIngredient.grams / recipeTotalMass_g
    baseRequired_g = baseShare × flavour.totalProductionMass_g

totalBaseRequired_g[baseName] = Σ baseRequired_g   // across all flavours using this base
```

### Step 2: Explode the base recipe
The base itself has a recipe. Apply the same share method:

```
baseRecipeItems[] = load recipe items for base recipe
baseTotalMass_g = Σ baseRecipeItems[k].grams

For each ingredient k in the base recipe:
    baseIngredientShare[k] = baseRecipeItems[k].grams / baseTotalMass_g
    baseIngredientRequired_g[k] = baseIngredientShare[k] × totalBaseRequired_g[baseName]
```

### Recursion guard:
```
if base recipe contains another base:
    if that base has already been visited in this chain:
        ERROR: "Recursive base reference detected — infinite loop"
        ABORT
    else:
        recurse (max depth: 3)
```

---

# PART C: PRODUCTION MODE — LEVEL 2 (SUPPLY-DRIVEN BASE ALLOCATOR)

---

## C1. Inputs

```
totalBaseMass_kg      // total available base supply in kg
recipes[]             // array of recipe allocations
  recipe.name
  recipe.allocationPct     // % of total base allocated to this recipe (0–100)
  recipe.recipeVersion     // linked recipe
  recipe.targetOverrunPct  // overrun % for this recipe
  recipe.targetLossPct     // loss % for this recipe
  recipe.targetSkuSize_L   // target SKU size in liters
  recipe.targetDensity_kgL // mix density
```

### Validation:
```
if Σ recipe.allocationPct > 100:
    ERROR: "Total allocation exceeds 100%"
```

---

## C2. Per-Recipe: Theoretical Max (Pre-Floor)

```
// Load recipe and find the base ingredient
recipeItems[] = load recipe items for recipe.recipeVersion
recipeTotalMass_g = Σ recipeItems[j].grams
baseIngredient = find the item that IS the allocated base
baseGrams = baseIngredient.grams

// Base fraction in recipe
F = baseGrams / recipeTotalMass_g
// F must be > 0 and <= 1

// Allocated base for this recipe
allocBaseKg = totalBaseMass_kg × recipe.allocationPct / 100

// Convert percentages to decimals
overrun = recipe.targetOverrunPct / 100
loss    = recipe.targetLossPct / 100
sku     = recipe.targetSkuSize_L
density = recipe.targetDensity_kgL

// How much total mix can this base produce?
allowedTotalMixKg = allocBaseKg / F

// After process loss
packedMixKg_theory = allowedTotalMixKg × (1 - loss)

// After overrun (air adds volume)
frozenLiters_theory = (packedMixKg_theory / density) × (1 + overrun)

// Maximum whole units
units = floor(frozenLiters_theory / sku)
```

---

## C3. Per-Recipe: Actual Usage (Post-Floor — Operational Truth)

```
// Work backwards from floored units to actual consumption
packedFrozenLiters = units × sku

packedMixKg = (packedFrozenLiters / (1 + overrun)) × density

actualTotalMixKg = packedMixKg / (1 - loss)

actualBaseUsedKg = actualTotalMixKg × F

// Scale factor for computing add-in requirements
scaleFactor = (actualTotalMixKg × 1000) / recipeTotalMass_g
```

---

## C4. Per-Recipe: Add-In Requirements

For each non-base ingredient `j` in the recipe:

```
requiredAddInKg[j] = (recipeItems[j].grams × scaleFactor) / 1000
```

---

## C5. Leftover Base

```
totalBaseUsedKg = Σ actualBaseUsedKg   // across all recipes
leftoverBaseKg  = totalBaseMass_kg - totalBaseUsedKg

// Use epsilon for float comparison
if |leftoverBaseKg| < 0.01:
    leftoverBaseKg = 0    // effectively fully allocated
```

---

# PART D: PHASE D — SAFE SUGGESTIONS

All Phase D features are OFF by default. They produce suggestions only. Never apply silently.

---

## D1. Procurement Rounding

For each ingredient in the procurement list:

```
exact_g = totalRequired_g[ingredient]
exact_kg = exact_g / 1000

// Round to procurement-convenient quantities
if exact_kg < 1:
    rounded_kg = ceil(exact_g / 50) × 50 / 1000    // round to nearest 50g
elif exact_kg < 10:
    rounded_kg = ceil(exact_kg × 10) / 10           // round to nearest 100g
else:
    rounded_kg = ceil(exact_kg)                      // round to nearest 1kg

delta_g = (rounded_kg × 1000) - exact_g
delta_pct = (delta_g / exact_g) × 100
```

### Display:
```
"Exact: {exact_kg} kg → Suggested: {rounded_kg} kg (+{delta_g}g / +{delta_pct}%)"
```

### Rule: Rounded values NEVER feed back into recipe or production math.

---

## D2. Top-Up Reduction

For each pair of SKUs of the same flavour (e.g., 100ml + 500ml):

```
current_topUp_L = Σ s.topUp_L   // for the flavour

// Try adjusting splitRatio by ±0.01 increments
for delta in [-0.03, -0.02, -0.01, +0.01, +0.02, +0.03]:
    new_splitRatio = s.splitRatio + delta
    
    // Recompute units, plannedOutput, topUp with new split
    new_targetOutput_L = totalOutput_L × new_splitRatio
    new_units = ceil(new_targetOutput_L / s.packSize_L)
    new_plannedOutput_L = new_units × s.packSize_L
    new_topUp_L = new_plannedOutput_L - new_targetOutput_L
    
    // Keep if total topUp decreases
    if new_topUp_L < current_topUp_L:
        suggest this adjustment
```

### Display: Show before/after units and topUp for each suggested tweak.
### Rule: Only apply on explicit user confirmation.

---

## D3. Balancing Suggestions (Advanced, Gated)

### Ingredient classification:
```
LOCKED ingredients:   pastes, inclusions, stabilizer, emulsifier, spices
FREE ingredients:     milk, cream, water, sucrose, dextrose, glucose_syrup, SMP
```

### Constraints for any suggestion:
```
1. Σ ingredient.grams (after change) = recipeTotalMass_g (before change)    // mass conserved
2. No ingredient.grams < 0                                                  // no negatives
3. |change_g[i]| <= 0.20 × ingredient[i].grams                             // max ±20% per ingredient
4. LOCKED ingredients: change_g = 0                                          // never modify
5. After change: all metrics must be closer to target OR within target range // improvement required
6. Output is deterministic: same inputs → same suggestion every time
```

### Display: Change list showing ingredient name, before grams, after grams, delta grams. Plus before/after values for fat%, sugar%, msnf%, totalSolids%, water%, fpdt, sp_index, afp_index.

### Rule: APPLY button required. Never auto-apply.

---

# PART E: HELPER FORMULAS

---

## E1. Composition Verification

To check if an ingredient's DB composition is valid:

```
compositionSum = fat_pct + sugar_pct + msnf_pct + other_solids_pct + water_pct

if |compositionSum - 100| > 0.5:
    FLAG: "Ingredient {name} compositions sum to {compositionSum}%, expected 100%"
```

---

## E2. MSNF Source Tracing

When MSNF exceeds 11%, identify the top contributors:

```
msnfContributors = []
for each ingredient i:
    msnf_contribution = msnf_g[i]
    msnf_contribution_pct = (msnf_g[i] / totalMSNF_g) × 100
    msnfContributors.push({ name: ingredient[i].name, grams: msnf_g[i], share: msnf_contribution_pct })

sort msnfContributors by share descending
```

### Display: "MSNF is {msnf_pct}%. Top contributors: {name1} ({share1}%), {name2} ({share2}%), ..."

---

## E3. Sugar Source Tracing

Similar to MSNF tracing, for debugging sweetness or softness:

```
sugarContributors = []
for each ingredient i where sugar_g[i] > 0:
    sugarContributors.push({
        name: ingredient[i].name,
        sugar_g: sugar_g[i],
        se_g: se_g[i],
        sp_contribution: sp_contribution[i],
        sugar_type: ingredient[i].sugar_type
    })

sort by sugar_g descending
```

---

## E4. Paste Composition Derivation

To compute a paste's composition from its sub-recipe:

```
pasteRecipeItems[] = load paste sub-recipe
pasteTotalMass_g = Σ pasteRecipeItems[k].grams

paste.fat_pct          = (Σ fat_g[k] / pasteTotalMass_g) × 100
paste.sugar_pct        = (Σ sugar_g[k] / pasteTotalMass_g) × 100
paste.msnf_pct         = (Σ msnf_g[k] / pasteTotalMass_g) × 100
paste.other_solids_pct = (Σ otherSolids_g[k] / pasteTotalMass_g) × 100
paste.water_pct        = 100 - (paste.fat_pct + paste.sugar_pct + paste.msnf_pct + paste.other_solids_pct)
```

For paste SP/AFP:
```
paste.sp_total  = (Σ sp_contribution[k]) / (Σ sugar_g[k])     // blended SP
paste.afp_total = (Σ se_g[k]) / (Σ sugar_g[k])                // blended AFP
```

Store these computed values in the paste's ingredient DB entry.

---

## E5. Quick Formulation Impact Calculator

For evaluating "what if I swap X grams of ingredient A with X grams of ingredient B":

```
function swapImpact(recipe, ingredientA, ingredientB, swapGrams):
    // Remove swapGrams of A, add swapGrams of B
    delta_fat = swapGrams × (B.fat_pct - A.fat_pct) / 100
    delta_sugar = swapGrams × (B.sugar_pct - A.sugar_pct) / 100
    delta_msnf = swapGrams × (B.msnf_pct - A.msnf_pct) / 100
    delta_otherSolids = swapGrams × (B.other_solids_pct - A.other_solids_pct) / 100
    delta_water = swapGrams × (B.water_pct - A.water_pct) / 100

    // SE impact
    delta_se = swapGrams × (B.sugar_pct/100 × B.afp_total - A.sugar_pct/100 × A.afp_total)
    
    // SP impact
    delta_sp = swapGrams × (B.sugar_pct/100 × B.sp_total - A.sugar_pct/100 × A.sp_total)

    return {
        delta_fat_pct: delta_fat / recipeTotalMass_g × 100,
        delta_sugar_pct: delta_sugar / recipeTotalMass_g × 100,
        delta_msnf_pct: delta_msnf / recipeTotalMass_g × 100,
        delta_totalSolids_pct: (delta_fat + delta_sugar + delta_msnf + delta_otherSolids) / recipeTotalMass_g × 100,
        delta_water_pct: delta_water / recipeTotalMass_g × 100,
        delta_se_g: delta_se,
        delta_sp: delta_sp,
        // FPDT would need full recalculation via Leighton Curve
    }
```

---

# PART F: UNIT CONVERSION REFERENCE

```
1 inch = 2.54 cm
1 liter = 1000 ml = 1000 cm³
1 kg = 1000 g
1 kg/L = 1 g/ml

Overrun: always entered as %, used as decimal (30% → 0.30)
Loss: always entered as %, used as decimal (5% → 0.05)
Pack sizes: always in liters (100ml = 0.1L, 500ml = 0.5L)
Billing: finished liters ÷ finLitresPerKgBilled = billed kg
Temperature: all in °C
```

---

# PART G: FORMULA QUICK REFERENCE CARD

```
totalSolids%     = fat% + sugar% + msnf% + otherSolids%
water%           = 100 - totalSolids%
SE_g             = Σ (sugar_g × AFP_total)
sucrose/100gH2O  = (SE_g / water_g) × 100
FPDse            = leightonLookup(sucrose/100gH2O)
FPDsa            = (MSNF_g × 2.37) / water_g
FPDT             = FPDse + FPDsa
SP_index         = Σ(sugar_g × SP_total) / Σ(sugar_g)
AFP_index        = Σ(sugar_g × AFP_total) / recipeMass_g × 100
units            = ceil(targetOutput / packSize)
plannedOutput    = units × packSize
mixRequired      = plannedOutput / (1 + overrun) / (1 - loss)
productionMass_g = mixRequired_L × density × 1000
packWeight_g     = packSize_L × density × 1000 / (1 + overrun)
billedKg         = plannedOutput_L / finLitresPerKgBilled
mfgCost          = billedKg × rate
costPerUnit      = mfgCost / units
share            = ingredient_g / recipeTotalMass_g
required_g       = share × productionMass_g
```
