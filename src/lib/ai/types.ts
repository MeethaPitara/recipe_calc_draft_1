/**
 * AI Pipeline Types
 * TypeScript equivalents of the Python Pydantic models from reverse_engine_stage1.ipynb
 */

// ── Ingredient Database ──

export interface IngredientEntry {
    fat_pct: number;
    msnf_pct: number;
    sugars_pct: number;
    water_pct: number;
    category: string;
    locked: boolean;
    note: string;
    sp_coeff?: number;
    pac_coeff?: number;
}

export type IngredientDB = Record<string, IngredientEntry>;

// ── Recipe ──

export interface RecipeItem {
    ingredient: string;
    quantity_g: number;
}

// ── Production Targets (batch sizing inputs) ──

export interface ProductionTargets {
    lossPct: number;       // 0–20
    mixDensity: number;    // 0.9–1.2
    overrunPct: number;    // 0–150
    skuSizeLiters: number; // > 0
    targetVolumeLiters: number; // > 0
}

// ── Optimization Targets (what the LP solver aims for) ──

export interface OptimizationTargets {
    fat_pct?: number | null;
    msnf_pct?: number | null;
    sugars_pct?: number | null;
}

// ── Batch Metrics (batch sizing outputs) ──

export interface BatchMetrics {
    gross_liquid_volume_L: number;
    batch_mass_g: number;
    n_skus: number;
    scale_factor: number;
}

// ── Recipe Metrics (nutritional breakdown) ──

export interface RecipeMetrics {
    total_mass_g: number;
    fat_pct: number;
    msnf_pct: number;
    sugars_pct: number;
    water_pct: number;
    total_solids_pct: number;
}

// ── LP Optimizer Result ──

export interface LPOptimizerResult {
    success: boolean;
    solver_status: string;
    proposed_recipe: Record<string, number>;
    warnings: string[];
}

// ── Diff (ingredient change) ──

export interface IngredientDiff {
    ingredient: string;
    original_g: number;
    proposed_g: number;
    delta_g: number;
    delta_pct: number;
}

// ── Food Engineer Pre-optimization Result ──

export interface FoodEngineerResult {
    modified_recipe: RecipeItem[];
    changes_made: string;
    pass_to_optimizer: string;
}

// ── Optimizer Tool Result (deterministic pipeline) ──

export interface OptimizerToolResult {
    success: boolean;
    solver_status: string;
    batch: BatchMetrics;
    scaled_recipe: Record<string, number>;
    optimized_recipe: Record<string, number>;
    metrics_before: RecipeMetrics;
    metrics_after: RecipeMetrics;
    diffs: IngredientDiff[];
    warnings: string[];
}

// ── Full Agent Result (complete pipeline output) ──

export interface AgentResult {
    success: boolean;
    solver_status: string;
    batch: BatchMetrics;
    optimized_recipe: Record<string, number>;
    metrics_before: RecipeMetrics;
    metrics_after: RecipeMetrics;
    diffs: IngredientDiff[];
    engineer_changes: string;
    ai_analysis: string;
    warnings: string[];
}

// ── Pipeline options ──

export type ProductMode = 'gelato' | 'ice_cream' | 'kulfi' | 'sorbet';

export interface RunAgentOptions {
    userPrompt: string;
    recipe: RecipeItem[];
    targetParams: ProductionTargets;
    mode?: ProductMode;
    currentMetrics?: any;
}

// ══════════════════════════════════════════════════
// Stage 2 Types — Recipe Creation from Scratch
// ══════════════════════════════════════════════════

// ── Recipe Search Result ──

export interface RecipeSearchResult {
    found: boolean;
    recipe_name: string | null;
    recipe: RecipeItem[] | null;
    relevance_score: number;        // 0–100 (Gemini reasoning-based)
    reasoning: string;
}

// ── Food Engineer Create Result ──

export interface FoodEngineerCreateResult {
    created_recipe: RecipeItem[];
    reasoning: string;
    used_web_search: boolean;
}

// ── Food Scientist Review Result ──

export interface FoodScientistReviewResult {
    refined_recipe: RecipeItem[];
    changes_made: string;
    reasoning: string;
    pass_to_optimizer: string;      // numeric targets for LP solver
}

// ── Food Critique Result ──

export type CritiqueVerdict = 'approved' | 'needs_revision';

export interface FoodCritiqueResult {
    review: string;
    verdict: CritiqueVerdict;
    confidence: number;             // 0–100
}

// ── Full Stage 2 Agent Result ──

export interface Stage2AgentResult {
    success: boolean;
    // Step 1: Search
    reference_recipe_name: string | null;
    reference_recipe: RecipeItem[] | null;
    search_reasoning: string;
    // Step 2: Engineer
    draft_recipe: RecipeItem[];
    engineer_reasoning: string;
    used_web_search: boolean;
    // Step 3: Scientist
    refined_recipe: RecipeItem[];
    scientist_changes: string;
    scientist_reasoning: string;
    // Step 4: Optimizer
    solver_status: string;
    optimized_recipe: Record<string, number>;
    metrics_before: RecipeMetrics;
    metrics_after: RecipeMetrics;
    diffs: IngredientDiff[];
    // Step 5: Critique
    critique_review: string;
    critique_verdict: CritiqueVerdict;
    critique_confidence: number;
    // Misc
    warnings: string[];
}

// ── Pipeline Options ──

export interface RunStage2Options {
    userPrompt: string;
    targetParams: OptimizationTargets;
    productionTargets: ProductionTargets;
    mode?: ProductMode;
}
