# Gelato Metrics Calculations

This document explains the core calculations behind the **FPDT (Freezing Point)**, **POD Index (Sweetness)**, and **SE (Sucrose Equivalents)** metrics in the Recipe Calculator.

All primary calculation logic resides in `src/lib/calc.v2.ts` within the `calcMetricsV2` function.

---

## 1. SE (Sucrose Equivalents in grams)
**Location:** `src/lib/calc.v2.ts` (Phase 7)

Sucrose Equivalents (SE) measure the freezing point depression power of sugars relative to Sucrose, which serves as the baseline (multiplier of `1.0`).

### How It Works:
Instead of relying on dry-residue interpolation, the engine uses **Carpigiani Verified AFP (Total)** multipliers applied directly against the actual weighed mass of the ingredient.

* **Sucrose:** 1.00
* **Dextrose:** 1.75
* **Fructose:** 1.90
* **Honey:** 1.52
* **Liquid Glucose Syrups:** Differing based on standard DE values (e.g. 42 DE = 0.74).
* **Maltodextrin:** 0.22 (Very low freezing depression relative to sucrose)

For naturally residing sugars (like in chocolate or dairy) where a coefficient is not available, normal sucrose behavior is approximated. For whole fruits, their sugar compositions are extracted and evaluated dynamically using intrinsic dry residues (1.90 for hexoses like glucose/fructose).

---

## 2. FPDT (Total Freezing Point Depression)
**Location:** `src/lib/calc.v2.ts` (Phase 8)

The total freezing point depression is the mathematical accumulation of the depression effects from sugars (`fpdse`) and from salts/milk solids non-fat (`fpdsa`).

### How It Works:
1. **Ratio Calculation:** It calculates the concentration of sugars in the available water: `sucrosePer100gWater = (se_g / water) * 100`.
2. **`fpdse` (From Sugars):** It passes `sucrosePer100gWater` into a lookup function (`leightonLookup`), which interpolates values against the empirically established Leighton Curve table.
3. **`fpdsa` (From MSNF/Salts):** Calculates freezing point depression from salts using the standard approximation: `(MSNF * 2.37) / water`.
4. **Final Value:** **`fpdt = fpdse + fpdsa`**.

---

## 3. POD Index (Sweetness Power / Point of Sweetness)
**Location:** `src/lib/calc.v2.ts` (Phase 9)

The POD Index calculates the relative sweetness power of the recipe, normalized against sucrose (where standard table sugar Sucrose = 100).

### How It Works:
Similar to the SE calculation, the `pod_numerator` is calculated by taking actual sweetener weights and multiplying by their specific **Carpigiani Verified SP (Total)** factors:
* **Fructose:** 170 (Significantly sweeter than sucrose)
* **Sucrose:** 100 (Baseline)
* **Dextrose:** 64
* **Honey:** 104
* **Glucose 42 DE:** 42

Once the `pod_numerator` is fully accumulated for all ingredients, the final index is determined by dividing it over the total physical weight of all sugars in the recipe:

```typescript
pod_index = pod_numerator / totalSugarsWithLactose_g
```

This yields a precise index (usually between 12–28) representing the perceived sweetness intensity of the final formulation.
