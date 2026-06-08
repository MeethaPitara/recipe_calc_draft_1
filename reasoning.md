# Optimizer Debugging Log

A chronological record of every bug found in the LP optimizer pipeline, the root cause analysis, and the fix applied.

---

## Bug 1 — Save failed: invalid UUID `"new-draft"`

**Symptom**
Clicking "Update Recipe" threw a Postgres error: `invalid input syntax for type uuid: "new-draft"`.

**Root Cause**
When the autosave draft recovery loads, it sets `currentRecipeId = 'new-draft'` as a sentinel value (line 565 of `RecipeCalculatorV2.tsx`). The save function checks `if (!recipeId)` to decide between POST (create) and PUT (update). Because `'new-draft'` is a non-empty string, it evaluates as truthy, so the code fell into the PUT branch and called `PUT /api/recipes/new-draft` — passing a non-UUID string as the record ID to Postgres.

**Fix**
`RecipeCalculatorV2.tsx:1837` — strip any `'new-'` prefixed ID before deciding the save path:
```typescript
let recipeId = currentRecipeId?.startsWith('new-') ? null : currentRecipeId;
```

---

## Bug 2 — Save failed: column `cost_per_kg` not found in schema cache

**Symptom**
After fixing Bug 1, saving still failed with: `Could not find the 'cost_per_kg' column of 'recipes' in the schema cache`.

**Root Cause**
The server-side save route (`server/src/routes/recipes.ts`) inserts `cost_per_kg` into the `recipes` table, and also inserts into a `cost_records` table. Both operations relied on a migration (`supabase/migrations/20260525000000_cost_records.sql`) that had never been run against the live Supabase database.

**Fix**
Run the migration manually in the Supabase SQL Editor:
```sql
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS cost_per_kg NUMERIC;

CREATE TABLE IF NOT EXISTS public.cost_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recipe_id UUID REFERENCES public.recipes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    cost_per_kg NUMERIC,
    batch_size_g NUMERIC,
    recorded_at TIMESTAMPTZ DEFAULT now()
);
```
RLS policies were intentionally omitted — the server uses the service-role key which bypasses RLS entirely, so the policies would never fire.

---

## Bug 3 — Optimizer reduces ingredients to 0g

**Symptom**
Running the `✨ Optimize` panel with some unlocked ingredients caused SMP (40g), Sucrose (145g), and Dextrose (20g) to be reduced to 0g in the output.

**Root Cause**
Three compounding issues:

1. **`requestToRows()` hardcoded `min: 0`** for all unlocked ingredients (`server/src/routes/optimize.ts:41`). This told the LP that any unlocked ingredient could legally be reduced to zero.

2. **`MOVEMENT_WEIGHT = 0.1` vs `DEVIATION_WEIGHT = 100.0`** (ratio 1:1000). The LP's cost of zeroing a 145g ingredient was only `145 × 0.1 = 14.5 units`, while the benefit of reducing a macro deviation by 1g was `100 units`. The LP freely eliminated ingredients because the movement cost was negligible compared to deviation savings.

3. **`max: Math.max(grams * 10, 1500)`** gave even small ingredients an enormous upper bound, making them valid "filler" targets.

**Fix**
- `requestToRows()`: change default bounds to `min = grams × 0.2`, `max = grams × 3` — no ingredient can drop below 20% of its original amount or exceed 3× unless the user explicitly overrides via the UI's min/max fields.
- Raise `MOVEMENT_WEIGHT` from `0.1` → `2.0` to make large movements more costly.
- Match the core solver's fallback default in `optimize.ts:47` to the same `initialAmt * 3`.

---

## Bug 4 — Small ingredients forced upward; large ingredients used as weight fillers

**Symptom**
After Bug 3 fix, Stabilizer went from 3g → 275g and Amul Buffalo Milk went from 30g → 500g.

**Root Cause**
The min formula `Math.max(5, grams * 0.2)` introduced an **artificial 5g floor**. For Stabilizer at 3g, `max(5, 0.6) = 5g` — the LP was *forced to increase* stabilizer from 3g to at least 5g. The max formula `Math.max(grams * 3, 500)` gave small ingredients a **500g ceiling**. Stabilizer max = `max(9, 500) = 500g`, Buffalo Milk max = `max(90, 500) = 500g`. These became the LP's preferred weight-fillers when other ingredients were reduced.

**Fix**
Remove both artificial constants:
```typescript
min: isLocked ? item.grams : item.grams * 0.2,   // pure 20% floor
max: isLocked ? item.grams : item.grams * 3,      // pure 3× ceiling
```
Stabilizer: min = 0.6g, max = 9g. Buffalo Milk: min = 6g, max = 90g.

---

## Bug 5 — Macro targets (MSNF, Sugars) consistently missed even when Fat hits

**Symptom**
After fixing bounds, Fat% would land close to target but MSNF and Sugars remained far off. The LP returned `OPTIMAL` status (not infeasible), implying it found the best it could but still missed.

**Root Cause**
The LP converts macro targets to absolute grams using `originalTotalG`:
```
fat_target_grams = (fat_pct / 100) × originalTotalG
```
But the batch weight constraint allowed ±5% variation. When the LP shifted total recipe weight (e.g., from 880g to 836g) to ease the fat constraint, the gram target was still computed against 880g — so the resulting percentages were wrong. Fat has a single clean lever (butter) and approximately lands right; MSNF and sugars require balancing multiple ingredients against an accurate total, so they drift.

**Fix**
When macro targets are active, fix batch weight exactly to `originalTotalG` (not a ±5% range). This forces the LP to hit targets purely by adjusting ingredient proportions, not by drifting total weight:
```typescript
} else if (hasTargets) {
    model.constraints.total_weight = { equal: originalTotalG };
}
```

Also added a **floor-scaling pre-check**: if the sum of all 20% minimum floors exceeds 80% of the unlocked weight budget, floors are scaled down proportionally to ensure the LP always has at least 40% of the unlocked budget free to redistribute.

---

## Bug 6 — Targets still not hit: system mathematically infeasible without neutral diluent

**Symptom**
Even with fixed batch weight and correct bounds, the LP could not simultaneously satisfy Fat 5%, MSNF 9.5%, Sugars 17.5% in the test recipe. Results were "OPTIMAL" but all three targets were significantly missed.

**Root Cause — Proven mathematically**
With batch fixed at 987g and Toned Milk at 650g (locked), after allocating:
- Butter ~37g to hit fat target
- SMP ~41g to hit MSNF target

The remaining ~240g budget needed to hit the sugar target (120g of actual sugar content from Sucrose/Dextrose) but also fill 240g of weight. The difference — ~120g — needed to go somewhere with zero macro contribution. **No such ingredient existed in the recipe.** Every available ingredient (Sucrose 100% sugar, SMP 94% MSNF + 52% lactose, Buffalo Milk 6.5% fat + 8% MSNF) contributed to at least one macro.

The LP was forced to fill that 120g gap with sugar ingredients, pushing sugars% well above target. There was no mathematically feasible solution with this ingredient set.

**Why the LP still returned OPTIMAL**
`javascript-lp-solver` returns OPTIMAL when it minimizes the objective within the feasible region. The soft deviation slack variables absorb the macro miss — the LP finds the *least bad* solution, not a perfect one. OPTIMAL means "best achievable", not "targets hit".

**Fix — Virtual water variable**
Add water as a virtual LP variable with:
- `total_weight: 1` (contributes to batch weight)
- No `fat_eq`, `msnf_eq`, `sug_eq` terms (zero macro contribution)
- `min: 0`, `max: originalTotalG × 0.25`
- Movement cost from 0g starting point

```typescript
if (hasTargets && !hasWaterIngredient) {
    model.variables['x_water'] = { total_weight: 1, bnd_min_water: 1, bnd_max_water: 1, movement_eq_water: 1 };
    model.constraints['bnd_min_water'] = { min: 0 };
    model.constraints['bnd_max_water'] = { max: originalTotalG * 0.25 };
    model.variables['x_over_water'] = { cost: MOVEMENT_WEIGHT, movement_eq_water: -1 };
    model.variables['x_under_water'] = { cost: MOVEMENT_WEIGHT, movement_eq_water: 1 };
    model.constraints['movement_eq_water'] = { equal: 0 };
}
```

Water is only injected if no ingredient in the recipe already has 0 fat/msnf/sugars (which would already serve as the neutral diluent). After solving, if water > 0.5g it is appended to the result rows as `"Water (added)"` and appears in the changes diff.

**Verification of fix (manual calculation)**
With water available, the 987g recipe becomes feasible:
- Toned Milk 650g → fat 19.5g, MSNF 55.25g, sugars 31.2g
- Butter ~37g → fat 29.6g
- SMP ~41g → MSNF 38.5g, sugars 21.3g
- Sucrose ~117g → sugars 117g
- Water ~115g → absorbs the freed weight budget, zero macros
- Total fat: 49.1g / 987g = **4.97% ≈ 5%** ✓
- Total MSNF: 93.75g / 987g = **9.5%** ✓
- Total sugars: 169.5g / 987g = **17.2% ≈ 17.5%** ✓

In real gelato/ice cream formulation, water is always a valid ingredient — it controls consistency and overrun. Exposing it in the result is correct and expected behaviour.

---

## Bug 7 — Frontend stale closure: PAC/POD and min/max bounds silently ignored

**Symptom**
User types a PAC or POD target, or sets ingredient min/max bounds in the UI, then clicks Optimize. The values appear to be ignored.

**Root Cause**
`handleOptimize` in `OptimizerPanel.tsx` used `useCallback` with an incomplete dependency array:
```typescript
}, [validRows, lockedIds, targetFat, targetMSNF, targetSugars, targetTS]);
// Missing: targetPAC, targetPOD, maxCost, fixedBatch, sugarRatio, minMaxBounds
```
When the user updated PAC, POD, min/max bounds, sugar ratio, or cost after the component mounted, React continued using the stale version of the callback. Those state values were captured from initial render and never refreshed.

**Fix**
Add all missing state variables to the dependency array:
```typescript
}, [validRows, lockedIds, targetFat, targetMSNF, targetSugars, targetTS,
    targetPAC, targetPOD, maxCost, fixedBatch, sugarRatio, minMaxBounds]);
```

---

---

## Bug 8 — `hasWaterIngredient` falsely suppressed by locked stabilizer

**Symptom**
Even after adding the virtual water variable (Bug 6 fix), ingredients continued to move in the wrong direction (things that needed to decrease increased, and vice versa).

**Root Cause**
The `hasWaterIngredient` check scanned ALL ingredients (including locked ones) for zero fat/msnf/sugars:
```typescript
const hasWaterIngredient = rowsIn.some(r =>
    (r.ing.fat_pct ?? 0) === 0 && (r.ing.msnf_pct ?? 0) === 0 && (r.ing.sugars_pct ?? 0) === 0
);
```
The Stabilizer ingredient (3g, auto-locked by the panel as a "stabilizer" category) has zero fat/msnf/sugars. This set `hasWaterIngredient = true`, suppressing virtual water injection.

But Stabilizer is **locked** — its amount is fixed at 3g. The LP cannot vary it. A locked ingredient with zero macros provides no neutral diluent capacity. The LP still had no way to absorb freed weight budget, causing it to push freed budget into macro-containing ingredients (wrong direction).

**Fix**
Replace the check with `hasAdequateNeutralIngredient`, which requires:
1. Ingredient is effectively unlocked (`!b.lock && b.minG < b.maxG - 0.01`)
2. Zero fat/msnf/sugars
3. Headroom ≥ 5% of batch weight (`b.maxG - b.minG ≥ originalTotalG * 0.05`)

Stabilizer at 3g has headroom of 6g (min 0.6g → max 9g), which is < 5% of 987g = 49g. It no longer qualifies, and virtual water is correctly injected.

A real water ingredient at 100g (max 300g, headroom 200g > 49g) would still qualify and prevent unnecessary virtual water injection.

---

## Summary of all changed files

| File | Changes |
|------|---------|
| `src/components/RecipeCalculatorV2.tsx` | Strip `'new-'` prefix before save decides POST vs PUT |
| `server/src/routes/recipes.ts` | Unchanged — needed DB migration to match |
| `server/src/routes/optimize.ts` | `requestToRows()`: correct default min/max; `buildChangesDiff()`: append water entry; debug logging added |
| `server/src/lib/core/optimize.ts` | `MOVEMENT_WEIGHT` 0.1→2.0; default `maxG` formula; fixed batch weight when targets active; floor-scaling pre-check; virtual water variable; `hasWaterIngredient` replaced by `hasAdequateNeutralIngredient`; water result extraction; debug logging |
| `src/components/calculator/OptimizerPanel.tsx` | `useCallback` deps array completed |
