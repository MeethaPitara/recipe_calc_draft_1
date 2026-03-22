/**
 * AI Pipeline — Barrel Export
 *
 * Usage:
 *   import { runAgent, runStage2Agent, optimizerTool, ... } from '@/lib/ai';
 */

// ── Stage 1 Pipeline ──
export { runAgent, optimizerTool } from './pipeline';

// ── Stage 2 Pipeline ──
export { runStage2Agent } from './pipelineStage2';
export { searchForReferenceRecipe } from './recipeSearch';
export { foodEngineerCreate } from './foodEngineerCreate';
export { foodScientistReview } from './foodScientistReview';
export { foodCritiqueReview } from './foodCritique';

// Math utilities
export { computeBatchSizing } from './batchSizing';
export { computeRecipeMetrics } from './recipeMetrics';
export { parseInstruction } from './instructionParser';
export { runLpOptimizer } from './lpOptimizer';

// AI agents (Stage 1 individual)
export { foodEngineerPre } from './foodEngineer';
export { foodScientistReason } from './foodScientist';
export { callGemini, callGeminiWithSearch, resetGeminiClient } from './geminiClient';

// Data
export { INGREDIENT_DB, addIngredient } from './ingredientDb';

// Types
export type {
    IngredientEntry,
    IngredientDB,
    RecipeItem,
    ProductionTargets,
    OptimizationTargets,
    BatchMetrics,
    RecipeMetrics,
    LPOptimizerResult,
    IngredientDiff,
    FoodEngineerResult,
    OptimizerToolResult,
    AgentResult,
    ProductMode,
    RunAgentOptions,
    // Stage 2 types
    RecipeSearchResult,
    FoodEngineerCreateResult,
    FoodScientistReviewResult,
    CritiqueVerdict,
    FoodCritiqueResult,
    Stage2AgentResult,
    RunStage2Options,
} from './types';

