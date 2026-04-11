# 12 — Sugar Science Reference: SP, AFP, SE, and FPDT

## Overview
This document is the authoritative sugar reference for PitaraLab, built from verified Carpigiani Gelato University data. It supersedes any sugar-related values in earlier documents (04, 11) where they conflict. The agent must use this document as the primary source for all sugar-related calculations and reasoning.

---

## Key Terminology

| Term | Full Name | What It Measures |
|------|-----------|-----------------|
| SP | Sweetening Power (Potere Dolcificante / POD) | Relative perceived sweetness vs sucrose (sucrose = 1.00) |
| AFP | Anti-Freezing Power (Potere Anti-Congelante / PAC) | Relative freezing point depression vs sucrose (sucrose = 1.00) |
| SE | Sucrose Equivalents | Grams of sucrose that would produce the same freezing effect as the actual sugar blend |
| FPDT | Freezing Point Depression Total | Actual predicted temperature depression in °C (via Leighton Curve + MSNF salts) |
| DE | Dextrose Equivalent | Measure of how hydrolyzed a starch syrup is. DE 100 = pure dextrose. DE 0 = unhydrolyzed starch. |

---

## The "Dry Residue" vs "Total" Distinction

This is a critical concept that many formulation errors stem from.

### Why it matters
Not all sugars are 100% pure dry sugar. Some contain moisture or non-sugar components:
- **Sucrose** (table sugar): 100% dry residual → SP/AFP on dry = SP/AFP on total. No difference.
- **Dextrose Monohydrate**: 92% dry residual (8% is water of crystallization) → SP/AFP on total is LOWER than on dry residue.
- **Liquid Glucose Syrup 42-44DE**: 80% dry residual (20% water) → SP/AFP on total is significantly lower than on dry residue.
- **Honey**: 80% dry residual (20% water) → same principle.

### Which to use in the engine?
The engine works with **grams of ingredient as weighed** (not grams of pure dry sugar). Therefore, the engine should use the **"on the Total"** values — these already account for the moisture/purity of the ingredient.

If the engine uses "on Dry Residue" values, it will OVERESTIMATE both sweetness and freezing point depression for any sugar that isn't 100% dry.

### Practical example
100g of Dextrose Monohydrate:
- Using AFP on Dry Residue (1.90): SE = 100 × 1.90 = 190g SE → overestimate
- Using AFP on Total (1.75): SE = 100 × 1.75 = 175g SE → correct for the actual ingredient as weighed

The difference is 8% — meaningful enough to throw off FPDT calculations.

---

## Complete SP and AFP Reference Table (Carpigiani Verified)

| # | Sugar | Dry Residual % | SP (Dry Residue) | AFP (Dry Residue) | SP (Total) | AFP (Total) |
|---|-------|---------------|-------------------|--------------------|-----------|--------------------|
| 1 | Sucrose | 100 | 1.00 | 1.00 | 1.00 | 1.00 |
| 2 | Lactose | 100 | 0.16 | 1.00 | 0.16 | 1.00 |
| 3 | Trehalose | 91 | 0.45 | 1.00 | 0.41 | 0.91 |
| 4 | Maple Syrup | 67 | 1.00 | 1.00 | 0.67 | 0.67 |
| 5 | Dextrose Monohydrate | 92 | 0.70 | 1.90 | 0.64 | 1.75 |
| 6 | Fructose | 100 | 1.70 | 1.90 | 1.70 | 1.90 |
| 7 | Inverted Sugar | 75 | 1.25 | 1.90 | 0.94 | 1.43 |
| 8 | Honey | 80 | 1.30 | 1.90 | 1.04 | 1.52 |
| 9 | Agave Syrup | 76 | 1.40 | 1.90 | 1.06 | 1.44 |
| 10 | Liquid Glucose Syrup 60-62DE | 80 | 0.64 | 1.20 | 0.51 | 0.96 |
| 11 | Liquid Glucose Syrup 42-44DE | 80 | 0.52 | 0.92 | 0.42 | 0.74 |
| 12 | Dry Glucose Syrup 38-40DE | 96 | 0.23 | 0.45 | 0.22 | 0.43 |
| 13 | Maltodextrin 15-19DE | 95 | 0.09 | 0.23 | 0.09 | 0.22 |

---

## DISCREPANCY ALERT: Fructose SP Value

### What the codebase currently uses
The `calc.v2.ts` engine (Lines 272-308) uses a POD multiplier of **120** for Fructose (on the 100-point scale, where Sucrose = 100). This translates to **SP = 1.20** on the decimal scale.

### What the Carpigiani reference shows
Fructose SP on Dry Residue = **1.70** (and on Total = **1.70** since Fructose is 100% dry).

### The gap
1.20 vs 1.70 — a 42% difference. This is NOT a rounding issue. It significantly affects POD calculations for any recipe containing fructose, invert sugar, honey, or agave (all of which contain fructose).

### Possible explanations
- The codebase may be using a different reference source with a more conservative fructose sweetness estimate.
- Fructose sweetness perception is temperature-dependent — it is perceived as sweeter at lower temperatures. The 1.70 value may be for room-temperature perception, while 1.20 may be adjusted for frozen product perception.
- There are different published values for fructose SP in the literature, ranging from 1.10 to 1.80 depending on the source and conditions.

### Recommendation
This needs a decision from the founder:
- **Option A:** Adopt the Carpigiani value (1.70 / 170 on 100-scale). More aligned with the formal gelato science training.
- **Option B:** Keep the current code value (1.20 / 120). More conservative, may better reflect sweetness in frozen products.
- **Option C:** Use the Carpigiani value but note that frozen perception may be lower. This is the safest approach — overpredicting sweetness leads to intentionally less-sweet recipes, which is easier to correct than underpredicting.

The agent should flag this discrepancy whenever fructose-containing ingredients are involved until a decision is recorded.

---

## How to Use This Table in SE Calculation

### For each sugar-type ingredient in the recipe:
```
SE_contribution = ingredient_grams × AFP_on_Total
```

NOT:
```
SE_contribution = ingredient_grams × AFP_on_Dry_Residue   ← WRONG (overestimates)
```

### Examples

**100g Sucrose:**
SE = 100 × 1.00 = 100g SE

**100g Dextrose Monohydrate:**
SE = 100 × 1.75 = 175g SE (not 190g — the 1.90 is for pure anhydrous dextrose)

**100g Liquid Glucose Syrup 42-44DE:**
SE = 100 × 0.74 = 74g SE (accounts for 80% dry residual AND the oligosaccharide composition)

**100g Honey:**
SE = 100 × 1.52 = 152g SE (accounts for 80% dry residual, and the glucose+fructose content)

**100g Inverted Sugar:**
SE = 100 × 1.43 = 143g SE (accounts for 75% dry residual)

---

## How to Use This Table in POD/SP Calculation

### For each sugar-type ingredient:
```
SP_contribution = ingredient_grams × SP_on_Total
```

### Total SP Index:
```
pod_numerator = Σ (each sugar's grams × its SP_on_Total)
totalSugarsWithLactose_g = Σ (all sugar grams in the recipe)
pod_index = pod_numerator / totalSugarsWithLactose_g
```

Or on a per-recipe basis:
```
SP_per_recipe = pod_numerator / recipeTotalMass_g × 100
```

The interpretation scale depends on which denominator is used. When dividing by totalSugarsWithLactose_g, the result tells you "how sweet is this sugar blend relative to pure sucrose." When dividing by recipeTotalMass_g, the result tells you "what is the sweetness intensity of the whole mix."

---

## Glucose Syrup: Understanding DE in Depth

### What DE means physically
DE (Dextrose Equivalent) measures the degree of starch hydrolysis:
- DE 0: Pure starch. Not a sugar. Not soluble.
- DE 20: Maltodextrin. Mostly long-chain oligosaccharides. Barely sweet. Very low AFP.
- DE 42: Standard glucose syrup. Mix of glucose, maltose, maltotriose, higher saccharides. Moderately sweet and moderate AFP.
- DE 60: High-conversion glucose syrup. More free glucose. Sweeter. Higher AFP.
- DE 100: Pure dextrose. Maximum sweetness and AFP for a glucose derivative.

### DE Effects (from Carpigiani reference)

| Function | Effect with Increasing DE |
|----------|--------------------------|
| Sweetening Power (SP) | Increases |
| Anti-Freezing Power (AFP) | Increases |
| Viscosity | Decreases |
| Anti-Crystallizing Power | Increases |
| Hygroscopy (moisture absorption) | Increases |
| Aroma-Enhancing Effect | Increases |
| Foaming | Increases |

### Practical implications for formulation

**Using low-DE syrup (38-42DE):**
- Adds body and chewiness (high viscosity).
- Minimal freezing point depression (AFP 0.43-0.74 on total).
- Barely sweet (SP 0.22-0.42 on total).
- Good for adding solids without making the product too soft or too sweet.
- Acts as a crystallization inhibitor — prevents sucrose from crystallizing out.

**Using high-DE syrup (60-62DE):**
- Less body, less viscosity.
- Moderate freezing point depression (AFP 0.96 on total).
- Moderately sweet (SP 0.51 on total).
- More hygroscopic — product may absorb moisture from air during display.
- Better aroma enhancement.

**Using maltodextrin (15-19DE):**
- Essentially a bulking agent. Almost no sweetness (SP 0.09) or freezing effect (AFP 0.22).
- Use when you need more total solids without changing sweetness or softness.
- Does NOT contribute meaningfully to either SP or AFP calculations.

---

## Flavor-Category Target Ranges (Analytical Compensation)

Different flavor categories have different optimal balances. The sugar load and AFP must be adjusted based on what else is in the recipe.

### Target Ranges by Flavor Category

| Flavoring Category | % Characterizing Ingredient | % Final Sugars in Recipe | AFP (Sugars) Total in Recipe |
|-------------------|---------------------------|--------------------------|------------------------------|
| Nuts (pistachio, hazelnut, almond) | 8–15% | 18–20% | 22–26 |
| Dairy products (fior di latte, vanilla, yogurt) | 5–45% | 19–21% | 23–27 |
| Sugary pastes (GJ Paste, jalebi paste) | 2–10% | 20–22% | 24–28 |
| Sugary/fatty pastes (praline, gianduia) | 5–15% | 19–21% | 23–27 |
| Fruit (mango, strawberry, lemon) | 5–45% | 22–24% | 25–29 |
| Chocolate (dark, milk, white) | 5–25% | 19–21% | 23–27 |

### How to read this table

**"% Characterizing Ingredient"** — how much of the total recipe is the featured flavoring (paste, nut, fruit puree, chocolate, etc.). This is the dosing range for the characterizing ingredient.

**"% Final Sugars in Recipe"** — the total sugar percentage of the finished recipe (base + characterizing ingredient combined). Not just the sugar from added sweeteners — this includes sugars that arrive via the characterizing ingredient itself.

**"AFP (Sugars) Total in Recipe"** — the target AFP index for the complete recipe. This is the sum of (grams × AFP factor) for all sugars, divided by total mix weight.

### Why categories have different targets

**Sugary pastes (AFP 24-28):**
- The paste itself brings significant sugar (often 25-40% sugar by weight).
- This sugar includes invert sugars (from jalebi fermentation, syrup soaking) which have high AFP.
- The base sugar must be reduced to compensate, but AFP will still be higher than a plain dairy flavor.
- Higher AFP is acceptable because the intense sweetness of mithai flavors pairs well with a slightly softer texture.

**Fruit (AFP 25-29):**
- Fruit purees contain glucose + fructose (both monosaccharides, AFP 1.90 on dry residue).
- These high-AFP fruit sugars push the total AFP up.
- Sorbets (which are fruit-based with no dairy) need even higher AFP to achieve scoopability without the structural support of fat and protein.

**Nuts (AFP 22-26):**
- Nut pastes add fat and solids but relatively little sugar.
- The lower AFP target reflects less sugar competition from the characterizing ingredient.
- Nut fats provide structure and melt resistance, reducing the need for higher AFP.

**Chocolate (AFP 23-27):**
- Chocolate adds significant cocoa solids + cocoa butter + sugar (in milk/white chocolate).
- The bitterness of cocoa means the product tolerates lower perceived sweetness.
- AFP is moderate because the sugar profile is primarily sucrose (from the chocolate itself).

---

## Applying This to MeethaPitara SKUs

### GJ Delight (Gulab Jamun Gelato)
- Category: **Sugary pastes** (GJ Paste at 12-15%)
- Target sugars: 20-22%
- Target AFP: 24-28
- Watch for: hidden MSNF from mawa in the paste pushing sandiness risk
- Watch for: high sucrose content from GJ Paste (soaked in sugar syrup) — verify if any invert sugar is present from the cooking process

### Jalebi Praline Gelato
- Category: **Sugary/fatty pastes** (Jalebi paste + praline elements)
- Target sugars: 19-21%
- Target AFP: 23-27
- Watch for: fermented batter creates organic acids that can invert some sucrose in the syrup → higher AFP than expected from pure sucrose syrup
- Watch for: noisette ghee adds fat but no sugar, so fat% may be higher than expected

### French Vanilla
- Category: **Dairy products**
- Target sugars: 19-21%
- Target AFP: 23-27
- Simplest formulation — pure white base with vanilla cold-steep
- Baseline recipe for validating the calculation engine

### Belgian Chocolate
- Category: **Chocolate**
- Target sugars: 19-21%
- Target AFP: 23-27
- Chocolate itself contributes sugar (typically 45-55% sugar in dark chocolate)
- Also contributes cocoa solids (other_solids) and cocoa butter (fat)

### Mumbai Chaat Surprise (Sorbet)
- Category: **Fruit** (tamarind-based)
- Target sugars: 22-24%
- Target AFP: 25-29
- No dairy means: no fat network, no MSNF, no protein — all structure comes from sugar + stabilizer
- Higher sugar and AFP targets compensate for the absence of dairy structure
- Tamarind paste sourcing critical (sodium content from preservatives — see Troubleshooting doc)

### Kaju Katli / Pistachio (Future SKUs)
- Category: **Nuts**
- Target sugars: 18-20%
- Target AFP: 22-26
- Nut pastes add fat — total fat may exceed gelato guidelines if base isn't adjusted

---

## Cross-Reference: How This Updates Earlier Documents

### Document 04 (Sugars and Sweeteners)
- The PAC factors listed in Doc 04 should be treated as approximate conceptual values.
- For actual calculation, use the AFP (on Total) values from this document.
- The POD factors in Doc 04 should be replaced with SP (on Total) values from this document.

### Document 11 (Calculation Methodology)
- The SE multipliers in Doc 11 Step 3 should be updated to use AFP (on Total) from this document.
- The POD multipliers in Doc 11 Step 5 should be updated to use SP (on Total) from this document.
- The SE calculation no longer needs a separate "glucose syrup DE split" formula — specific glucose syrup grades have their own AFP (on Total) values in the table above.
- The worked example in Doc 11 should be recalculated using the corrected values.

### Document 02 (Balance Principles)
- The target ranges in Doc 02 should be replaced with the flavor-category-specific ranges from this document.
- The single universal range was a simplification; the real targets vary by category.

### Document 10 (Formulation Guardrails)
- Soft limit SL-1 (PAC 20-32) should be updated to reference the category-specific AFP ranges in this document.
- Soft limit SL-2 (POD 14-26) should be reviewed against the SP-based approach.
