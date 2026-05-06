/**
 * AI Module — Types Only
 * 
 * All AI logic (pipelines, Gemini calls, LP optimizer) has been moved to the backend.
 * This module now only exports types used by frontend UI components.
 */

// Types only — no runtime logic
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
