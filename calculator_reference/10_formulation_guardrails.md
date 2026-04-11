# 10 — Formulation Guardrails

## Overview
This document defines the hard limits, safety margins, and invariant rules that the PitaraLab agent must always enforce. These guardrails exist to prevent the agent from generating or approving recipes that would produce defective or unsafe products. The agent must consult this document whenever it creates, modifies, or validates any recipe.

---

## Hard Limits — Never Violate

These are absolute constraints. The agent must reject any recipe that violates them, regardless of other considerations.

### HL-1: MSNF must not exceed 12.0%
- **Why:** Lactose crystallization (sandiness) becomes highly likely above 12%.
- **Warning zone:** 11.0–12.0%. Flag for review.
- **Action if violated:** Identify MSNF sources and recommend reduction. Check mawa/khoya contributions first (they are the most common hidden source).

### HL-2: Total solids must not exceed 45%
- **Why:** Above 45%, the product becomes un-processable (too viscous for the CF, won't aerate properly, hard to fill containers).
- **Warning zone:** 42–45%. Flag as very dense.
- **Action if violated:** Identify the excess solids source and recommend reduction.

### HL-3: Fat must not exceed 16% for gelato/ice cream
- **Why:** Above 16%, the product is legally classified differently in some markets and produces an unpleasantly greasy product.
- **Warning zone for gelato:** >10%. MeethaPitara gelato should be 5–8%.
- **Action if violated:** Audit fat sources (cream, ghee, mawa, paste fat contributions).

### HL-4: No negative ingredient grams
- **Why:** A recipe cannot require a negative amount of any ingredient. This seems obvious but can occur when an optimizer tries to reduce an ingredient below zero.
- **Action if violated:** Clamp to zero. Inform the user that the recipe cannot be balanced as requested — the constraints are over-determined.

### HL-5: Mass conservation
- **Why:** The sum of all ingredient grams must equal the total recipe weight. Grams cannot appear or disappear.
- **Tolerance:** ±0.5g (to allow for floating-point rounding).
- **Action if violated:** Recalculate. If a single ingredient was adjusted, recompute the recipe total.

### HL-6: Water % must be positive and reasonable
- **Why:** A recipe with <40% water is not a frozen dessert — it's a frozen candy. A recipe with >70% water will be unacceptably icy.
- **Gelato range:** 55–68%.
- **Sorbet range:** 65–78%.
- **Action if violated:** Check total solids (water = 100 - total solids).

### HL-7: Sugar % must not exceed 30% for gelato
- **Why:** Above 30% sugar, the product will not freeze properly at any reasonable temperature. It will remain a viscous syrup.
- **Sorbet exception:** Sorbets can go to 32%, but this is the absolute ceiling.
- **Action if violated:** Reduce sugar. Check for hidden sugar sources (condensed milk, pastes, gulkand).

---

## Soft Limits — Flag for Review

These are quality guidelines. The agent should flag recipes that violate them but can proceed if the user explicitly acknowledges the tradeoff.

### SL-1: PAC index should be 20–32
- Below 20: Product will be very hard. Acceptable only if serving from a heated display case.
- Above 32: Product will be very soft. Acceptable only in specific applications (soft-serve style).
- For home-freezer products (Zomato delivery): PAC 24–30 is strongly recommended.

### SL-2: POD index should be 14–26
- Below 14: Product will taste bland. May be acceptable for very bitter/savory flavors.
- Above 26: Product will taste cloying.

### SL-3: Fat:MSNF ratio should be below 1.2:1
- Higher ratios mean insufficient protein to coat fat globules after homogenization.
- Can lead to fat clumping and texture defects.

### SL-4: Stabilizer total should be 0.2–0.8%
- Below 0.2%: Likely under-stabilized. Acceptable for fresh-consume-within-24-hours products only.
- Above 0.8%: Risk of gummy/rubbery texture.

### SL-5: Emulsifier total should be 0.1–0.5%
- Below 0.1%: Likely under-emulsified. Poor overrun and meltdown expected.
- Above 0.5%: Risk of churning and greasy texture.

---

## Calculation Rules

### CR-1: Total solids is always computed, never entered
- total_solids_pct = fat_pct + sugar_pct + msnf_pct + other_solids_pct.
- Never allow direct entry of total solids — it must be derived.

### CR-2: Water is always computed, never entered
- water_pct = 100 - total_solids_pct.
- Never allow direct entry of water — it must be derived.

### CR-3: POD and PAC must use DB-driven factors
- Each sugar has a POD factor and a PAC factor stored in the database.
- The agent must not infer factors from sugar names or string matching.
- If a new sugar is added without factors, the agent must flag it and request factor values before computing.

### CR-4: Recipe total grams is the actual sum, not 1000g
- Never assume a recipe totals 1000g. Always compute: recipe_total_g = sum(ingredient grams).
- This matters for procurement explosion: shares are calculated as ingredient_g / recipe_total_g, not ingredient_g / 1000.

### CR-5: Overrun is entered as percentage, used as decimal
- User enters: "30" (meaning 30%).
- Formula uses: 0.30.
- The agent must handle the conversion and never double-convert.

### CR-6: Loss is entered as percentage, used as decimal
- Same conversion rule as overrun.
- Loss is applied as: mix_required = output / (1 + overrun) / (1 - loss).

---

## Ingredient Governance Rules

### IG-1: Ingredient compositions come from the database, not from hardcoding
- The agent must never hardcode fat%, sugar%, MSNF%, or any composition value.
- All values must be retrieved from the Supabase ingredients table.
- If the database value seems wrong, flag it — don't override it silently.

### IG-2: Composite ingredients (pastes, bases) must have verified compositions
- A paste's composition is derived from its sub-recipe.
- If a paste's sub-recipe changes, its composition changes, which changes every recipe using it.
- The system must re-validate all downstream recipes when a paste composition is updated.

### IG-3: Mawa composition must be supplier-specific
- Never use generic "mawa" composition from a textbook.
- The MSNF of mawa varies from 10% to 16%+ depending on type, milk source, and supplier.
- The database must store the specific mawa being used and its verified composition.

### IG-4: Log all composition changes with reason
- When any ingredient's composition values change in the database, the change must be logged with: old values, new values, reason for change, who made the change, timestamp.
- This is enforced by the ingredient_edit_log table.

---

## Recipe Modification Rules (for Optimizer / AI)

### RM-1: Locked ingredients must never change
- When the optimizer or AI suggests modifications, certain ingredients are "locked" — their grams cannot be changed.
- Locked ingredients typically include: pastes, inclusions, stabilizer blend, emulsifier, spices, and any proprietary components.
- Only "free" ingredients can be adjusted: milk, cream, water, sucrose, dextrose, glucose syrup, SMP.

### RM-2: Suggestions must show before and after
- Any proposed change must display: which ingredients changed, by how much, and the resulting before/after values for all metrics.
- The user must explicitly approve changes before they are applied.

### RM-3: Maximum per-ingredient change cap
- No single suggestion should change any ingredient by more than ±20% of its current value unless the user explicitly requests a larger change.
- This prevents the optimizer from making drastic changes that fundamentally alter the product character.

### RM-4: Deterministic and repeatable
- Given the same inputs, the optimizer must produce the same outputs every time.
- No randomized suggestions. LP-style constrained optimization is preferred for this reason.

---

## Production Planning Guardrails

### PP-1: Allocation percentages must sum to ≤100%
- In Level 2 (supply-driven base allocator), the sum of allocation percentages across all recipes must not exceed 100%.
- If it exceeds 100%, the plan is invalid.

### PP-2: Recipe must contain the base ingredient
- In base-allocation mode, the recipe must actually reference the base being allocated.
- If a recipe doesn't use the white base, it cannot receive an allocation of white base.

### PP-3: Floor, then recompute
- In Level 2, units must be floored (not rounded). Then actual usage must be recomputed from the floored units.
- The theoretical pre-floor calculation is informational only. The post-floor recomputation is the operational truth.

### PP-4: Epsilon tolerance for float arithmetic
- When checking if base supply is fully allocated, use epsilon tolerance (e.g., 0.01 kg) for floating-point comparison.
- Do not compare floats for exact equality.

### PP-5: Guard against recursion in nested bases
- If Base A's recipe contains Base B, and Base B's recipe contains Base A, the system has an infinite loop.
- The procurement explosion must detect and reject recursive base references.

---

## Safety and Regulatory Guardrails

### SR-1: Allergen awareness
- The system should flag common allergens present in a recipe: milk/dairy, nuts, soy, wheat/gluten, eggs.
- MeethaPitara's core line is dairy-based (milk allergen always present) and egg-free.
- Jalebi paste contains wheat (maida) — gluten allergen.
- Nut-based flavors (pistachio, kaju) — tree nut allergen.

### SR-2: No raw dairy in finished product
- All dairy components must be pasteurized (either in the base pasteurization step or via the retort processing of pastes).
- The agent should flag any recipe where a dairy ingredient is added post-pasteurization without its own prior heat treatment.

### SR-3: Labeling accuracy
- The composition values used for nutritional labeling must match the actual recipe used in production.
- If a recipe is modified, the label must be updated.
- The system should eventually be able to generate nutritional panels from the recipe data, but this is out of scope for MVP.
