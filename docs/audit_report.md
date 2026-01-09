# Audit Report: Single Source of Truth

## Executive Summary
The codebase is currently in a **hybrid state**. 
- `src/lib/calc.v2.ts` **IS** the core engine.
- `src/lib/calc.ts` acts as a **legacy adapter**, wrapping v2 logic but returning outdated data structures.
- Critical logic (Product Classification, Milk/Cream Balancing) lives in `calc.ts`, effectively "orphaning" it from the v2 engine.
- Data fetching in `ingredientService.ts` is robust but duplicates validation logic found in the calculator.
- **NEW**: Significant hardcoded data ("Shadow Databases") found in frontend and lib files.

---

## Section A: Math Fragmentation (Files & Issues)

### 1. The Legacy Adapter Problem (`calc.ts`)
The file `src/lib/calc.ts` is not just a deprecated file; it is a **middleware** that many components still rely on.
- **The Wrapper**: `calcMetrics()` (Lines 40-76) wraps `calcMetricsV2` but maps the result to a flat `Metrics` object, dropping new v2 features closer to the source.
- **Orphaned Logic**: The following functions exist *only* in `calc.ts` and need to be moved to v2 or a dedicated service:
    - `classifyProduct` (Lines 101-158)
    - `generateWarnings` (Lines 163-184) - *Note: v2 has its own warnings, these might be conflicting.*
    - `calculateMilkCreamMix` (Lines 189-228)
    - `balanceSugarSpectrum` (Lines 233-265)

### 2. Files Using Legacy `calc.ts` imports
These files import from `@/lib/calc` and likely use the legacy `calcMetrics` function or the orphaned logic:
- `src/hooks/useRecipeBalance.ts`
- `src/hooks/useRecipeMetrics.ts`
- `src/services/recipeValidator.ts`
- `ChemistryDashboard.tsx`
- `metricsService.ts`
- `optimize.ts` (Legacy optimization engine)

### 3. Inline Math & Redundancy
- **Validation Duplication**: `src/services/ingredientService.ts` (Lines 23-48) implements `validateIngredientComposition`. `calc.v2.ts` (Lines 119-125) *also* implements validation. We should centralize this.
- **Inline Targets**: `src/components/ScienceMetricsPanel.tsx` contains hardcoded target ranges (e.g., `min={mode==='gelato'?36:38}`) inside the component logic. This duplicates the "Source of Truth" in `productConstraints.ts`.

---

## Section B: Data Fetching (Supabase vs Local)

### 1. Primary Entry Point: `src/services/ingredientService.ts`
This is the main data pipeline.
- **Good News**: It fetches all necessary columns (`water_pct`, `sugars_pct`, `fat_pct`, `msnf_pct`, `sugar_split`).
- **Data Shape**: It uses a Zod schema (`DbIngredientSchema`) that maps cleanly to `IngredientData`.
- **Status**: **Approved** for v2 compatibility, but validation logic should be refactored.

### 2. "Shadow Databases" (Hardcoded Data)
Several files contain hardcoded data that should ideally be in Supabase or a config service:
- `src/lib/productConstraints.ts`: **MAJOR**. Contains the definitive "Scientific Database" for product targets (`PRODUCT_CONSTRAINTS` array). While centralized, it is hardcoded in the build.
- `src/lib/optimize.balancer.v2.ts`: Contains `SUGAR_BOUNDS` (lines 27-59), another hardcoded dataset.
- `src/lib/fruits.seed.json`: A hardcoded list of fruit properties.
- `src/services/pairingService.ts`: Check for hardcoded pairing dictionaries (Pending Confirmation).

### 3. Other Fetchers
The grep scan identified direct Supabase calls in `src/services/recipeService.ts` and `src/hooks/useRecipeBalance.ts`. These should be audited to ensure they use the `ingredients` table consistent with v2 expectations.

---

## Recommendations for Phase 2 (Refactor)

1.  **Migrate "Orphaned Logic"**: Move `classifyProduct`, `milkCreamMix`, etc., from `calc.ts` to modular files (e.g., `src/lib/analysis.ts`, `src/lib/tools.ts`).
2.  **Centralize Constants**: `productConstraints.ts` is actually a *good* pattern for code-constants, but `ScienceMetricsPanel.tsx` should import from it instead of redefining values.
3.  **Data Cleanup**: Move `fruits.seed.json` to the database (if not just for seeding).
4.  **Bypass the Wrapper**: Update `useRecipeBalance.ts` to call `calcMetricsV2` directly.
5.  **Delete `calc.ts`**: The ultimate goal.
