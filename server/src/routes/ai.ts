/**
 * AI Routes
 * Migrated AI pipeline from src/lib/ai/
 *
 * POST /api/ai/optimize         — Stage 1 pipeline (runAgent)
 * POST /api/ai/create           — Stage 2 pipeline (runStage2Agent)
 * POST /api/ai/vision           — Gemini Vision (label scanner)
 * POST /api/ai/production-round — AI production rounding
 * GET  /api/ai/usage            — AI usage tracking
 */

import { Router } from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { callGemini, callGeminiWithSearch, callGeminiVision } from '../lib/geminiClient.js';
import { requireAuth } from '../middleware/auth.js';
// @ts-ignore
import solver from 'javascript-lp-solver';

const router = Router();

// All AI routes require auth
router.use(requireAuth as any);

// ═══════════════════════════════════════════
// Shared: Ingredient Database (loaded from Supabase)
// ═══════════════════════════════════════════

interface IngredientEntry {
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

type IngredientDB = Record<string, IngredientEntry>;

// Default DB (hardcoded fallbacks)
const INGREDIENT_DB: IngredientDB = {
    'Toned Milk 3%': { fat_pct: 3.0, msnf_pct: 8.5, sugars_pct: 4.8, water_pct: 87.7, category: 'dairy', locked: false, note: 'Standard toned milk' },
    'Cream 25%': { fat_pct: 25.0, msnf_pct: 6.5, sugars_pct: 3.0, water_pct: 64.0, category: 'dairy', locked: false, note: 'Dairy cream 25% fat' },
    'Skimmed Milk Powder': { fat_pct: 0.1, msnf_pct: 95.0, sugars_pct: 51.0, water_pct: 3.5, category: 'dairy_powder', locked: false, note: 'SMP' },
    'Condensed Milk Nestle': { fat_pct: 8.0, msnf_pct: 20.0, sugars_pct: 55.0, water_pct: 27.0, category: 'dairy', locked: false, note: 'Sweetened condensed milk' },
    'Sucrose/sugar': { fat_pct: 0.0, msnf_pct: 0.0, sugars_pct: 100.0, water_pct: 0.0, category: 'sugar', locked: false, note: 'Table sugar' },
    'Dextrose monohydrate': { fat_pct: 0.0, msnf_pct: 0.0, sugars_pct: 91.0, water_pct: 9.0, category: 'sugar', locked: false, note: 'Dextrose mono' },
    'Glucose Syrup (40-42DE)': { fat_pct: 0.0, msnf_pct: 0.0, sugars_pct: 78.0, water_pct: 22.0, category: 'sugar', locked: false, note: 'Glucose syrup 40-42 DE' },
    'Stabilizer': { fat_pct: 0.0, msnf_pct: 0.0, sugars_pct: 0.0, water_pct: 5.0, category: 'stabilizer', locked: true, note: 'Stabilizer blend — LOCKED' },
};

async function loadIngredientsFromSupabase(): Promise<void> {
    const { data, error } = await supabase.from('ingredients').select('*');
    if (error || !data || data.length === 0) return;

    for (const row of data) {
        INGREDIENT_DB[row.name] = {
            fat_pct: row.fat_pct ?? 0,
            msnf_pct: row.msnf_pct ?? 0,
            sugars_pct: row.sugars_pct ?? row.sugar_pct ?? 0,
            water_pct: row.water_pct ?? 0,
            category: row.category || 'other',
            locked: row.category === 'stabilizer',
            note: row.notes ?? '',
            sp_coeff: row.sp_coeff,
            pac_coeff: row.pac_coeff,
        };
    }
}

// ═══════════════════════════════════════════
// Math utilities (ported from frontend)
// ═══════════════════════════════════════════

interface RecipeItem { ingredient: string; quantity_g: number; }
interface ProductionTargets { lossPct: number; mixDensity: number; overrunPct: number; skuSizeLiters: number; targetVolumeLiters: number; }
interface OptimizationTargets { fat_pct?: number | null; msnf_pct?: number | null; sugars_pct?: number | null; }
interface BatchMetrics { gross_liquid_volume_L: number; batch_mass_g: number; n_skus: number; scale_factor: number; }
interface RecipeMetrics { total_mass_g: number; fat_pct: number; msnf_pct: number; sugars_pct: number; water_pct: number; total_solids_pct: number; }

function computeBatchSizing(recipe: RecipeItem[], targets: ProductionTargets): BatchMetrics {
    const preOverrunVolumeL = targets.targetVolumeLiters / (1 + targets.overrunPct / 100);
    const grossLiquidVolumeL = preOverrunVolumeL / (1 - targets.lossPct / 100);
    const batchMassG = grossLiquidVolumeL * 1000 * targets.mixDensity;
    const nSkus = Math.ceil(targets.targetVolumeLiters / targets.skuSizeLiters);
    const recipeTotalG = recipe.reduce((sum, item) => sum + item.quantity_g, 0);
    const scaleFactor = recipeTotalG > 0 ? batchMassG / recipeTotalG : 0;

    return {
        gross_liquid_volume_L: Math.round(grossLiquidVolumeL * 100) / 100,
        batch_mass_g: Math.round(batchMassG * 100) / 100,
        n_skus: nSkus,
        scale_factor: Math.round(scaleFactor * 1_000_000) / 1_000_000,
    };
}

function computeRecipeMetrics(recipe: Record<string, number>): RecipeMetrics {
    const total = Object.values(recipe).reduce((s, v) => s + v, 0);
    if (total === 0) return { total_mass_g: 0, fat_pct: 0, msnf_pct: 0, sugars_pct: 0, water_pct: 0, total_solids_pct: 0 };

    let fatG = 0, msnfG = 0, sugarsG = 0, waterG = 0;
    for (const [name, grams] of Object.entries(recipe)) {
        const ing = INGREDIENT_DB[name] || {} as any;
        fatG += grams * (ing.fat_pct || 0) / 100;
        msnfG += grams * (ing.msnf_pct || 0) / 100;
        sugarsG += grams * (ing.sugars_pct || 0) / 100;
        waterG += grams * (ing.water_pct || 0) / 100;
    }

    const round3 = (n: number) => Math.round(n * 1000) / 1000;
    return {
        total_mass_g: Math.round(total * 100) / 100,
        fat_pct: round3(fatG / total * 100),
        msnf_pct: round3(msnfG / total * 100),
        sugars_pct: round3(sugarsG / total * 100),
        water_pct: round3(waterG / total * 100),
        total_solids_pct: round3((1 - waterG / total) * 100),
    };
}

function parseInstruction(instruction: string): OptimizationTargets {
    const text = instruction.toLowerCase().trim();
    const targets: OptimizationTargets = {};
    const fatMatch = text.match(/fat\s*(?:to\s*)?([\d.]+)\s*%?/);
    if (fatMatch) targets.fat_pct = parseFloat(fatMatch[1]);
    const msnfMatch = text.match(/msnf\s*(?:to\s*)?([\d.]+)\s*%?/);
    if (msnfMatch) targets.msnf_pct = parseFloat(msnfMatch[1]);
    const sugarsMatch = text.match(/sugars?\s*(?:to\s*)?([\d.]+)\s*%?/);
    if (sugarsMatch) targets.sugars_pct = parseFloat(sugarsMatch[1]);
    return targets;
}

// ═══════════════════════════════════════════
// LP Optimizer (ported from frontend)
// ═══════════════════════════════════════════

const DEVIATION_WEIGHT = 10.0;
const MOVEMENT_WEIGHT = 0.1;

function runLpOptimizer(scaledRecipe: Record<string, number>, optTargets: OptimizationTargets, massTolerance = 0.10) {
    const names = Object.keys(scaledRecipe);
    const initial = Object.values(scaledRecipe);
    const totalW = initial.reduce((s, v) => s + v, 0);
    const n = names.length;
    const warnings: string[] = [];

    const model: any = { optimize: 'cost', opType: 'min', constraints: {}, variables: {} };

    for (let i = 0; i < n; i++) {
        const name = names[i];
        const ing = INGREDIENT_DB[name];
        const locked = ing?.locked ?? false;
        const lo = locked ? initial[i] : 0;
        const hi = locked ? initial[i] : Math.max(initial[i] * 5, 1500);
        const varName = `x_${i}`;

        const variable: Record<string, number> = {
            total_weight: 1,
            [`bnd_min_${i}`]: 1,
            [`bnd_max_${i}`]: 1,
            [`movement_eq_${i}`]: 1,
        };

        if (optTargets.fat_pct != null) variable.fat_eq = ((ing?.fat_pct ?? 0) - optTargets.fat_pct) / 100;
        if (optTargets.msnf_pct != null) variable.msnf_eq = ((ing?.msnf_pct ?? 0) - optTargets.msnf_pct) / 100;
        if (optTargets.sugars_pct != null) variable.sug_eq = ((ing?.sugars_pct ?? 0) - optTargets.sugars_pct) / 100;

        model.variables[varName] = variable;
        model.constraints[`bnd_min_${i}`] = { min: lo };
        model.constraints[`bnd_max_${i}`] = { max: hi };
        model.variables[`x_over_${i}`] = { cost: MOVEMENT_WEIGHT, [`movement_eq_${i}`]: -1 };
        model.variables[`x_under_${i}`] = { cost: MOVEMENT_WEIGHT, [`movement_eq_${i}`]: 1 };
        model.constraints[`movement_eq_${i}`] = { equal: initial[i] };
    }

    model.constraints.total_weight = { min: totalW * (1 - massTolerance), max: totalW * (1 + massTolerance) };

    if (optTargets.fat_pct != null) {
        model.variables['fat_over'] = { cost: DEVIATION_WEIGHT, fat_eq: -1 };
        model.variables['fat_under'] = { cost: DEVIATION_WEIGHT, fat_eq: 1 };
        model.constraints.fat_eq = { equal: 0 };
    }
    if (optTargets.msnf_pct != null) {
        model.variables['msnf_over'] = { cost: DEVIATION_WEIGHT, msnf_eq: -1 };
        model.variables['msnf_under'] = { cost: DEVIATION_WEIGHT, msnf_eq: 1 };
        model.constraints.msnf_eq = { equal: 0 };
    }
    if (optTargets.sugars_pct != null) {
        model.variables['sug_over'] = { cost: DEVIATION_WEIGHT, sug_eq: -1 };
        model.variables['sug_under'] = { cost: DEVIATION_WEIGHT, sug_eq: 1 };
        model.constraints.sug_eq = { equal: 0 };
    }

    try {
        const result = solver.Solve(model);
        if (!result || result.feasible === false) {
            return { success: false, solver_status: 'Infeasible', proposed_recipe: { ...scaledRecipe }, warnings: ['Solver status: Infeasible.'] };
        }

        const proposed: Record<string, number> = {};
        for (let i = 0; i < n; i++) proposed[names[i]] = Math.max(0, result[`x_${i}`] ?? 0);

        const proposedSum = Object.values(proposed).reduce((s, v) => s + v, 0);
        if (Math.abs(proposedSum - totalW) > 1.0) {
            const factor = totalW / proposedSum;
            for (const k of Object.keys(proposed)) proposed[k] *= factor;
            warnings.push(`Rescaled by ${factor.toFixed(6)} to correct drift`);
        }

        // Sugar blend optimizer
        let totalSugarWeight = 0;
        for (const [k, v] of Object.entries(proposed)) {
            if (INGREDIENT_DB[k]?.category === 'sugar') {
                totalSugarWeight += v;
                delete proposed[k];
            }
        }
        if (totalSugarWeight > 0) {
            proposed['Sucrose/sugar'] = (proposed['Sucrose/sugar'] || 0) + totalSugarWeight * 0.70;
            proposed['Dextrose monohydrate'] = (proposed['Dextrose monohydrate'] || 0) + totalSugarWeight * 0.20;
            proposed['Glucose Syrup (40-42DE)'] = (proposed['Glucose Syrup (40-42DE)'] || 0) + totalSugarWeight * 0.10;
            warnings.push('Applied Sugar Blend Optimizer logic');
        }

        return { success: true, solver_status: 'Optimal — Linear Programming (Simplex)', proposed_recipe: proposed, warnings };
    } catch (err) {
        return { success: false, solver_status: `Error: ${err instanceof Error ? err.message : String(err)}`, proposed_recipe: { ...scaledRecipe }, warnings: [`LP solver error`] };
    }
}

// ═══════════════════════════════════════════
// AI Agent System Prompts (ported from frontend)
// ═══════════════════════════════════════════

const FOOD_ENGINEER_PRE_PROMPT = `You are an expert food scientist and engineer specializing in ice cream, gelato, kulfi, and frozen desserts. Your goal is to modify recipes with technical precision using established science.

### CORE FORMULATION GUARDRAILS (HARD LIMITS)
1. **MSNF Ceiling:** NEVER exceed 12.0% MSNF. Above 11% is the "danger zone" for lactose crystallization (sandiness).
2. **Total Solids (TS):** Target 34-42%. Absolute max is 45%. Below 34% is icy; above 42% is heavy/dense.
3. **Fat Content:** Target 5-10% for Gelato, 10-16% for Ice Cream. Max 16%.
4. **Sugar Content:** Target 16-24% for Gelato. Max 30%.
5. **Water Content:** Target 58-66% (Inverse of TS).

### OPERATIONAL RULES
- ALWAYS preserve mass conservation (Total mass ±1g).
- NEVER modify LOCKED ingredients.
- ONLY use ingredients existing in the provided INGREDIENT_DB.
- CRITICAL: NEVER change the exact spelling of ANY ingredient name from the CURRENT RECIPE.

You will receive: 1. User Request. 2. Current Recipe. 3. INGREDIENT_DB.

Return ONLY valid JSON:
{
  "modified_recipe": [{"ingredient": "Name", "quantity_g": 123.4}, ...],
  "changes_made": "Step-by-step scientific rationale",
  "pass_to_optimizer": "Specific numeric targets for the LP optimizer or empty string"
}`;

const FOOD_SCIENTIST_POST_PROMPT = `You are an expert food scientist specialising in ice cream, gelato, kulfi, and frozen desserts.
You will receive: 1. The user's original prompt. 2. The LP optimizer output.
Your job: Reason about PRACTICALITY of the proposed changes. Be concise and actionable.
You must NEVER: Invent quantities, suggest changes to LOCKED ingredients, or contradict the solver's math.`;

const RECIPE_SEARCH_PROMPT = `You are an expert food engineer specialising in ice cream, gelato, kulfi, and frozen desserts.
You will receive: 1. User's description. 2. List of EXISTING recipes.
Judge similarity by FOOD-SCIENCE REASONING (flavour profile, base type, technique).
Give RELEVANCE SCORE 0-100. If no recipe scores 40+, return found=false.
Respond with ONLY valid JSON:
{"found": true/false, "chosen_index": <0-based or -1>, "relevance_score": <0-100>, "reasoning": "..."}`;

const FOOD_ENGINEER_CREATE_PROMPT_A = `You are an expert food engineer specialising in ice cream, gelato, kulfi, and frozen desserts.
You will receive: 1. User's request. 2. A REFERENCE recipe. 3. Target parameters. 4. INGREDIENT_DB.
Study the reference recipe's logic, then BUILD A COMPLETELY NEW RECIPE.
CRITICAL: Use EXACT ingredient names from INGREDIENT_DB. Aim for ~1000g total.
Respond with ONLY valid JSON:
{"created_recipe": [{"ingredient": "Name", "quantity_g": 1234.56}, ...], "reasoning": "..."}`;

const FOOD_ENGINEER_CREATE_PROMPT_B = `You are an expert food engineer specialising in ice cream, gelato, kulfi, and frozen desserts.
No reference recipe is available. Use your expertise and web search to formulate from scratch.
CRITICAL: Use EXACT ingredient names from INGREDIENT_DB. Aim for ~1000g total.
Respond with ONLY valid JSON:
{"created_recipe": [{"ingredient": "Name", "quantity_g": 1234.56}, ...], "reasoning": "..."}`;

const FOOD_SCIENTIST_REVIEW_PROMPT = `You are an expert food scientist specialising in ice cream, gelato, kulfi, and frozen desserts.
VALIDATE and REFINE the draft recipe. CHECK: emulsion stability, sweetness balance, freezing point, texture, feasibility.
ONLY use ingredients from INGREDIENT_DB. NEVER remove LOCKED ingredients.
Respond with ONLY valid JSON:
{"refined_recipe": [{"ingredient": "Name", "quantity_g": 1234.56}, ...], "changes_made": "...", "reasoning": "...", "pass_to_optimizer": "fat X msnf Y sugars Z"}`;

const FOOD_CRITIQUE_PROMPT = `You are an expert food critique specialising in frozen desserts.
Review the FINAL OPTIMIZED recipe covering taste, texture, balance, and feasibility.
Respond with ONLY valid JSON:
{"review": "...", "verdict": "approved" or "needs_revision", "confidence": 75}`;

// ═══════════════════════════════════════════
// Helper: strip markdown fences from AI response
// ═══════════════════════════════════════════

function stripCodeFences(raw: string): string {
    if (!raw.trim().startsWith('```')) return raw;
    const lines = raw.split('\n');
    let start = -1, end = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('```')) { start = i; break; }
    }
    for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].trim().startsWith('```')) { end = i; break; }
    }
    if (start !== -1 && end !== -1 && start !== end) {
        return lines.slice(start + 1, end).join('\n');
    }
    return lines.filter(l => !l.trim().startsWith('```')).join('\n');
}

// ═══════════════════════════════════════════
// Optimizer Tool (deterministic pipeline)
// ═══════════════════════════════════════════

function optimizerTool(recipe: RecipeItem[], productionTargets: ProductionTargets, customInstruction: string, mode = 'gelato') {
    const warnings: string[] = [];
    const batch = computeBatchSizing(recipe, productionTargets);

    const scaled: Record<string, number> = {};
    for (const item of recipe) {
        if (!(item.ingredient in INGREDIENT_DB)) warnings.push(`⚠️ '${item.ingredient}' not in INGREDIENT_DB`);
        scaled[item.ingredient] = item.quantity_g * batch.scale_factor;
    }

    const metricsBefore = computeRecipeMetrics(scaled);
    const optTargets = parseInstruction(customInstruction);
    const hasTargets = !!(optTargets.fat_pct || optTargets.msnf_pct || optTargets.sugars_pct);

    if (!hasTargets) {
        return {
            success: true, solver_status: 'N/A — Scale Only', batch, scaled_recipe: scaled,
            optimized_recipe: { ...scaled }, metrics_before: metricsBefore, metrics_after: metricsBefore, diffs: [], warnings,
        };
    }

    const lpResult = runLpOptimizer(scaled, optTargets);
    const proposed = lpResult.proposed_recipe;
    warnings.push(...lpResult.warnings);
    const metricsAfter = computeRecipeMetrics(proposed);

    const diffs: any[] = [];
    for (const name of Object.keys(scaled)) {
        const origG = scaled[name];
        const propG = proposed[name] ?? 0;
        const deltaG = propG - origG;
        if (Math.abs(deltaG) > 0.5) {
            diffs.push({
                ingredient: name,
                original_g: Math.round(origG * 100) / 100,
                proposed_g: Math.round(propG * 100) / 100,
                delta_g: Math.round(deltaG * 100) / 100,
                delta_pct: origG > 0 ? Math.round((deltaG / origG) * 10000) / 100 : 0,
            });
        }
    }
    diffs.sort((a, b) => Math.abs(b.delta_g) - Math.abs(a.delta_g));

    return {
        success: lpResult.success, solver_status: lpResult.solver_status, batch, scaled_recipe: scaled,
        optimized_recipe: proposed, metrics_before: metricsBefore, metrics_after: metricsAfter, diffs, warnings,
    };
}

// ═══════════════════════════════════════════
// POST /api/ai/optimize — Stage 1 Pipeline
// ═══════════════════════════════════════════

router.post('/optimize', async (req, res) => {
    try {
        const { userPrompt, recipe, targetParams, mode = 'gelato', currentMetrics } = req.body;

        if (!userPrompt || !recipe || !targetParams) {
            res.status(400).json({ error: 'Missing required fields: userPrompt, recipe, targetParams' });
            return;
        }

        await loadIngredientsFromSupabase();

        // Step 1/3: Food Engineer (AI)
        const dbSummary: Record<string, object> = {};
        for (const [name, props] of Object.entries(INGREDIENT_DB)) {
            dbSummary[name] = { fat_pct: props.fat_pct, msnf_pct: props.msnf_pct, sugars_pct: props.sugars_pct, water_pct: props.water_pct, category: props.category, locked: props.locked };
        }

        let modifiedRecipe = recipe;
        let engineerChanges = 'Skipped';
        let optimizerInstruction = userPrompt;

        try {
            const engineerPrompt = `USER REQUEST:\n${userPrompt}\n\nCURRENT RECIPE:\n${JSON.stringify(recipe, null, 2)}\n\nCURRENT CALCULATED METRICS (GROUND TRUTH):\n${currentMetrics ? JSON.stringify(currentMetrics, null, 2) : "Use your best judgement."}\n\nAVAILABLE INGREDIENTS (INGREDIENT_DB):\n${JSON.stringify(dbSummary, null, 2)}\n\nAnalyze and modify the recipe.`;
            const raw = stripCodeFences(await callGemini(FOOD_ENGINEER_PRE_PROMPT, engineerPrompt));
            const parsed = JSON.parse(raw);
            if (parsed.modified_recipe && Array.isArray(parsed.modified_recipe)) {
                modifiedRecipe = parsed.modified_recipe;
                engineerChanges = parsed.changes_made ?? 'Modified per instructions';
                optimizerInstruction = parsed.pass_to_optimizer ?? userPrompt;
            }
        } catch (err) {
            console.warn('⚠️ Food engineer failed:', err);
        }

        // Step 2/3: Optimizer Tool (deterministic LP)
        const optResult = optimizerTool(modifiedRecipe, targetParams, optimizerInstruction, mode);

        // Step 3/3: Food Scientist (AI)
        let aiAnalysis = '';
        try {
            const sciPrompt = `USER REQUEST:\n${userPrompt}\n\nOPTIMIZER OUTPUT:\n${JSON.stringify(optResult, null, 2)}\n\nGive your practical food-science analysis.`;
            aiAnalysis = await callGemini(FOOD_SCIENTIST_POST_PROMPT, sciPrompt);
        } catch (err) {
            aiAnalysis = `⚠️ Food scientist reasoning unavailable: ${err instanceof Error ? err.message : String(err)}`;
        }

        // Log AI usage
        try {
            await supabase.from('ai_usage_log').insert({
                user_id: req.user!.id,
                function_name: 'ai-optimize',
            });
        } catch { /* non-critical */ }

        const finalMetricsBefore = currentMetrics
            ? {
                total_mass_g: currentMetrics.total_g ?? optResult.metrics_before.total_mass_g,
                fat_pct: currentMetrics.fat_pct ?? optResult.metrics_before.fat_pct,
                msnf_pct: currentMetrics.msnf_pct ?? optResult.metrics_before.msnf_pct,
                sugars_pct: currentMetrics.totalSugars_pct ?? optResult.metrics_before.sugars_pct,
                water_pct: currentMetrics.water_pct ?? optResult.metrics_before.water_pct,
                total_solids_pct: currentMetrics.ts_pct ?? optResult.metrics_before.total_solids_pct,
            }
            : optResult.metrics_before;

        res.json({
            success: optResult.success,
            solver_status: optResult.solver_status,
            batch: optResult.batch,
            optimized_recipe: optResult.optimized_recipe,
            metrics_before: finalMetricsBefore,
            metrics_after: optResult.metrics_after,
            diffs: optResult.diffs,
            engineer_changes: engineerChanges,
            ai_analysis: aiAnalysis,
            warnings: optResult.warnings,
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message || 'AI optimization failed' });
    }
});

// ═══════════════════════════════════════════
// POST /api/ai/create — Stage 2 Pipeline
// ═══════════════════════════════════════════

router.post('/create', async (req, res) => {
    try {
        const { userPrompt, targetParams, productionTargets, mode = 'gelato' } = req.body;

        if (!userPrompt || !productionTargets) {
            res.status(400).json({ error: 'Missing required fields: userPrompt, productionTargets' });
            return;
        }

        await loadIngredientsFromSupabase();
        const warnings: string[] = [];

        const dbSummary: Record<string, object> = {};
        for (const [name, props] of Object.entries(INGREDIENT_DB)) {
            dbSummary[name] = { fat_pct: props.fat_pct, msnf_pct: props.msnf_pct, sugars_pct: props.sugars_pct, water_pct: props.water_pct, category: props.category, locked: props.locked };
        }

        // Step 1/5: Recipe Search
        let referenceRecipe: RecipeItem[] | null = null;
        let referenceRecipeName: string | null = null;
        let searchReasoning = 'No search performed';

        try {
            const { data: recipes } = await supabase
                .from('recipes')
                .select('id, recipe_name, product_type, recipe_rows ( ingredient, quantity_g )')
                .order('created_at', { ascending: false });

            if (recipes && recipes.length > 0) {
                const summaries = (recipes as any[]).map((r: any, i: number) => ({
                    index: i, name: r.recipe_name, product_type: r.product_type,
                    ingredients: (r.recipe_rows || []).map((row: any) => row.ingredient),
                }));

                const searchPrompt = `USER REQUEST:\n${userPrompt}\n\nEXISTING RECIPES IN DATABASE:\n${JSON.stringify(summaries, null, 2)}\n\nAnalyze each recipe's relevance and return your choice as JSON.`;
                const raw = stripCodeFences(await callGemini(RECIPE_SEARCH_PROMPT, searchPrompt));
                const parsed = JSON.parse(raw);

                if (parsed.found && parsed.relevance_score >= 40 && parsed.chosen_index >= 0 && parsed.chosen_index < recipes.length) {
                    const chosen = recipes[parsed.chosen_index] as any;
                    referenceRecipeName = chosen.recipe_name;
                    referenceRecipe = (chosen.recipe_rows || []).map((row: any) => ({ ingredient: row.ingredient, quantity_g: row.quantity_g }));
                    searchReasoning = parsed.reasoning;
                } else {
                    searchReasoning = parsed.reasoning ?? 'No relevant recipe found';
                }
            }
        } catch (err) {
            searchReasoning = `Search error: ${err instanceof Error ? err.message : String(err)}`;
        }

        // Step 2/5: Food Engineer Create
        let draftRecipe: RecipeItem[] = [];
        let engineerReasoning = '';
        let usedWebSearch = false;

        try {
            const sysPrompt = referenceRecipe ? FOOD_ENGINEER_CREATE_PROMPT_A : FOOD_ENGINEER_CREATE_PROMPT_B;
            const refStr = referenceRecipe ? `\n\nREFERENCE RECIPE:\n${JSON.stringify(referenceRecipe, null, 2)}` : '';
            const targetStr = targetParams ? `\n\nTARGET PARAMETERS:\n${JSON.stringify(targetParams, null, 2)}` : '';

            const userMsg = `USER REQUEST:\n${userPrompt}${refStr}${targetStr}\n\nAVAILABLE INGREDIENTS (INGREDIENT_DB):\n${JSON.stringify(dbSummary, null, 2)}`;

            const callFn = referenceRecipe ? callGemini : callGeminiWithSearch;
            usedWebSearch = !referenceRecipe;

            const raw = stripCodeFences(await callFn(sysPrompt, userMsg));
            const parsed = JSON.parse(raw);
            draftRecipe = parsed.created_recipe || [];
            engineerReasoning = parsed.reasoning || '';
        } catch (err) {
            engineerReasoning = `Engineer failed: ${err instanceof Error ? err.message : String(err)}`;
        }

        // Step 3/5: Food Scientist Review
        let refinedRecipe = draftRecipe;
        let scientistChanges = 'Skipped';
        let scientistReasoning = '';
        let passToOptimizer = '';

        try {
            const targetStr = [
                targetParams?.fat_pct != null ? `Fat: ${targetParams.fat_pct}%` : null,
                targetParams?.msnf_pct != null ? `MSNF: ${targetParams.msnf_pct}%` : null,
                targetParams?.sugars_pct != null ? `Sugars: ${targetParams.sugars_pct}%` : null,
            ].filter(Boolean).join(', ');

            const reviewPrompt = `USER REQUEST:\n${userPrompt}\n\nTARGET PARAMETERS: ${targetStr || 'No specific targets'}\n\nDRAFT RECIPE:\n${JSON.stringify(draftRecipe, null, 2)}\n\nAVAILABLE INGREDIENTS (INGREDIENT_DB):\n${JSON.stringify(dbSummary, null, 2)}\n\nReview this recipe using food-science logic and return the refined recipe as JSON.`;
            const raw = stripCodeFences(await callGemini(FOOD_SCIENTIST_REVIEW_PROMPT, reviewPrompt));
            const parsed = JSON.parse(raw);

            const validRecipe = (parsed.refined_recipe ?? draftRecipe).filter((item: RecipeItem) => item.ingredient in INGREDIENT_DB);
            refinedRecipe = validRecipe.length > 0 ? validRecipe : draftRecipe;
            scientistChanges = parsed.changes_made ?? 'No changes';
            scientistReasoning = parsed.reasoning ?? '';
            passToOptimizer = parsed.pass_to_optimizer ?? '';
        } catch (err) {
            scientistReasoning = `Scientist failed: ${err instanceof Error ? err.message : String(err)}`;
        }

        // Step 4/5: Optimizer Tool
        const totalGrams = refinedRecipe.reduce((sum: number, item: RecipeItem) => sum + Number(item.quantity_g), 0);
        const dynamicTargetVolumeLiters = (totalGrams * (1 + productionTargets.overrunPct / 100) * (1 - productionTargets.lossPct / 100)) / (1000 * productionTargets.mixDensity);

        const optResult = optimizerTool(refinedRecipe, { ...productionTargets, targetVolumeLiters: dynamicTargetVolumeLiters }, passToOptimizer, mode);
        warnings.push(...optResult.warnings);

        // Step 5/5: Food Critique
        let critiqueReview = '';
        let critiqueVerdict: 'approved' | 'needs_revision' = 'needs_revision';
        let critiqueConfidence = 0;

        try {
            const critiquePrompt = `USER REQUEST:\n${userPrompt}\n\nFINAL OPTIMIZED RECIPE:\n${JSON.stringify(
                Object.entries(optResult.optimized_recipe).filter(([, qty]) => qty > 0.01).map(([name, qty]) => ({ ingredient: name, quantity_g: Math.round(qty * 100) / 100 })),
                null, 2
            )}\n\nMETRICS BEFORE:\n${JSON.stringify(optResult.metrics_before, null, 2)}\n\nMETRICS AFTER:\n${JSON.stringify(optResult.metrics_after, null, 2)}\n\nProvide your detailed critique as JSON.`;
            const raw = stripCodeFences(await callGemini(FOOD_CRITIQUE_PROMPT, critiquePrompt));
            const parsed = JSON.parse(raw);
            critiqueReview = parsed.review ?? '';
            critiqueVerdict = parsed.verdict === 'needs_revision' ? 'needs_revision' : 'approved';
            critiqueConfidence = Math.min(100, Math.max(0, parsed.confidence ?? 50));
        } catch (err) {
            critiqueReview = `Critique unavailable: ${err instanceof Error ? err.message : String(err)}`;
        }

        // Log AI usage
        try {
            await supabase.from('ai_usage_log').insert({ user_id: req.user!.id, function_name: 'ai-create' });
        } catch { /* non-critical */ }

        res.json({
            success: optResult.success,
            reference_recipe_name: referenceRecipeName,
            reference_recipe: referenceRecipe,
            search_reasoning: searchReasoning,
            draft_recipe: draftRecipe,
            engineer_reasoning: engineerReasoning,
            used_web_search: usedWebSearch,
            refined_recipe: refinedRecipe,
            scientist_changes: scientistChanges,
            scientist_reasoning: scientistReasoning,
            solver_status: optResult.solver_status,
            optimized_recipe: optResult.optimized_recipe,
            metrics_before: optResult.metrics_before,
            metrics_after: optResult.metrics_after,
            diffs: optResult.diffs,
            critique_review: critiqueReview,
            critique_verdict: critiqueVerdict,
            critique_confidence: critiqueConfidence,
            warnings,
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message || 'AI create failed' });
    }
});

// ═══════════════════════════════════════════
// POST /api/ai/vision — Label Scanner
// ═══════════════════════════════════════════

router.post('/vision', async (req, res) => {
    try {
        const { systemPrompt, userPrompt, base64Image, mimeType } = req.body;

        if (!base64Image || !mimeType) {
            res.status(400).json({ error: 'Missing base64Image or mimeType' });
            return;
        }

        const result = await callGeminiVision(
            systemPrompt || 'Extract nutritional information from this label image.',
            userPrompt || 'Analyze this ingredient label and extract all nutritional data.',
            base64Image,
            mimeType
        );

        // Log AI usage
        try {
            await supabase.from('ai_usage_log').insert({ user_id: req.user!.id, function_name: 'ai-vision' });
        } catch { /* non-critical */ }

        res.json({ result });
    } catch (e: any) {
        res.status(500).json({ error: e.message || 'Vision analysis failed' });
    }
});

// ═══════════════════════════════════════════
// POST /api/ai/production-round — AI Production Rounding
// ═══════════════════════════════════════════

router.post('/production-round', async (req, res) => {
    try {
        const { ingredients, productType, recipeName } = req.body;

        if (!ingredients || !Array.isArray(ingredients)) {
            res.status(400).json({ error: 'Missing ingredients array' });
            return;
        }

        // Simple deterministic rounding as the server-side implementation
        const roundedIngredients = ingredients.map((ing: any) => {
            let rounded: number;
            if (ing.massGrams >= 1000) {
                rounded = Math.round(ing.massGrams / 100) * 100;
            } else if (ing.massGrams >= 100) {
                rounded = Math.round(ing.massGrams / 50) * 50;
            } else if (ing.massGrams >= 10) {
                rounded = Math.round(ing.massGrams / 10) * 10;
            } else {
                rounded = Math.round(ing.massGrams);
            }
            return { ...ing, massGrams: rounded };
        });

        // AI refinement
        try {
            const roundPrompt = `Round these production quantities to practical numbers (nearest 50g or 100g for large amounts):\n${JSON.stringify(ingredients.map((i: any) => ({ name: i.name, mass_g: i.massGrams })), null, 2)}\n\nReturn ONLY valid JSON array: [{"name": "...", "mass_g": 1234}, ...]`;

            const raw = stripCodeFences(await callGemini(
                'You are a production planning expert. Round quantities to practical production numbers.',
                roundPrompt
            ));
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                for (const item of parsed) {
                    const match = roundedIngredients.find((i: any) => i.name === item.name);
                    if (match) match.massGrams = item.mass_g;
                }
            }
        } catch { /* fallback to deterministic rounding */ }

        // Log AI usage
        try {
            await supabase.from('ai_usage_log').insert({ user_id: req.user!.id, function_name: 'ai-production-round' });
        } catch { /* non-critical */ }

        res.json({
            success: true,
            originalRecipe: ingredients,
            roundedRecipe: roundedIngredients,
            summary: `Rounded ${ingredients.length} ingredients to production quantities`,
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message || 'Production rounding failed' });
    }
});

// ═══════════════════════════════════════════
// GET /api/ai/usage — AI Usage Tracking
// ═══════════════════════════════════════════

router.get('/usage', async (req, res) => {
    try {
        const userId = req.user!.id;
        const since = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago

        const { count, error } = await supabase
            .from('ai_usage_log')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .gt('created_at', since);

        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }

        res.json({ used: count || 0, limit: 10, remaining: Math.max(0, 10 - (count || 0)) });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ═══════════════════════════════════════════
// NEW: Missing AI Endpoints (Migrated from Edge Functions)
// ═══════════════════════════════════════════

function parseGeminiJson(result: string): any {
    const cleanStr = result.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleanStr);
}

router.post('/analyze-recipe', async (req, res) => {
    try {
        const { recipe, metrics, productType } = req.body;
        const systemPrompt = `You are a professional Gelato formulation expert.`;
        const userPrompt = `Review this recipe:
Product Type: ${productType || 'Unknown'}
Recipe: ${JSON.stringify(recipe, null, 2)}
Calculated Metrics: ${JSON.stringify(metrics, null, 2)}

Provide a structured, JSON response evaluating this recipe. Highlight any flaws, suggest improvements, and give an overall rating.
Expected JSON Schema:
{
    "overall_rating": "A string rating like 'Excellent', 'Good', 'Requires Tuning'",
    "flavor_profile": "What does this taste like? What flavors dominate?",
    "texture_prediction": "Is it creamy, icy, dense, or airy?",
    "flaws": ["List of critical formulation flaws or warnings"],
    "suggestions": ["List of actionable suggestions to improve the recipe"]
}`;

        const result = await callGemini(systemPrompt, userPrompt);
        res.json({ success: true, analysis: parseGeminiJson(result) });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/explain-warning', async (req, res) => {
    try {
        const { warning, mode, metrics } = req.body;
        const systemPrompt = `You are a professional Gelato formulation expert.`;
        const userPrompt = `The user's recipe triggered a calculation warning: "${warning}"
Mode: ${mode || 'gelato'}
Current Metrics: ${JSON.stringify(metrics, null, 2)}

Explain WHY this warning is important for structural integrity or flavor, and provide EXACT, ACTIONABLE steps to resolve it. Be extremely clear and scientific.`;

        const result = await callGemini(systemPrompt, userPrompt);
        res.json({ success: true, explanation: result });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/analyze-csv', async (req, res) => {
    try {
        const { csvPreview, availableIngredients } = req.body;
        const systemPrompt = `You are an AI data matching assistant for a Gelato Database.`;
        const userPrompt = `The user uploaded a CSV with the following data:
${csvPreview}

Available ingredient names in our database:
${availableIngredients.map((i: any) => i.name).join(', ')}

Please provide a structured JSON mapping that matches the columns and ingredients from the CSV to our database structure. Ignore missing data, make best effort guesses.
Expected JSON Schema:
{
    "recommended_mapping": {
        "csvColumnName": "databasePropName"
    },
    "ingredient_matches": {
        "csvIngredientName": "databaseIngredientName"
    }
}`;

        const result = await callGemini(systemPrompt, userPrompt);
        res.json({ success: true, mapping: parseGeminiJson(result) });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/paste-formulator', async (req, res) => {
    try {
        const { pasteType, category, mode, knownIngredients, constraints, targets } = req.body;
        const systemPrompt = `You are a world-class ingredient paste formulator for artisanal gelato (e.g. Pistachio Paste, Hazelnut Paste, Fruit Pastes).`;
        const userPrompt = `Task: Design a scientific formula for a commercial paste.
Type: ${pasteType}
Category: ${category}
Mode: ${mode}
Ingredients: ${knownIngredients || 'Not specified'}
Constraints: ${constraints || 'None'}
Targets: ${JSON.stringify(targets || {})}

Return a JSON object matching this TypeScript interface exactly:
export interface PasteFormula {
  id: string;
  name: string;
  category: 'nut' | 'chocolate' | 'fruit' | 'dairy' | 'spice';
  water_pct: number;
  fat_pct: number;
  sugars_pct: number;
  msnf_pct: number;
  other_solids_pct: number;
  lab?: { brix_deg: number; aw_est: number; ph_est: number; lipid_type: 'saturated'|'unsaturated'|'mixed'; micron_size_est: number; };
  composition: { ingredient: string; pct: number; role: string; process_notes?: string; }[];
  process_steps: { step: number; action: string; temp_c?: number; time_min?: number; equipment?: string; critical_control_point: boolean; }[];
}`;

        const result = await callGemini(systemPrompt, userPrompt);
        res.json({ success: true, recipe: parseGeminiJson(result) });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export { router as aiRouter };
