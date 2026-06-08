import { Router } from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { callGemini, callGeminiWithSearch, callGeminiVision } from '../lib/geminiClient.js';
import { requireAuth } from '../middleware/auth.js';
import { calcMetricsV2 } from '../lib/core/calc.v2.js';
import { balancingEngine } from '../lib/core/optimize.engine.js';
import type { OptimizeTarget } from '../lib/core/optimize.js';

const router = Router();
router.use(requireAuth as any);

async function fetchIngredientsFromSupabase() {
    const { data } = await supabase.from('ingredients').select('*');
    return data || [];
}

export const FOOD_ENGINEER_INTENT_PROMPT = `You are an expert ice cream and gelato food scientist. You parse recipe
modification requests into precise optimization targets.
You will receive:

User's modification request (natural language)
Current recipe with ingredients (name + grams)
Current recipe metrics with these fields:
  - fat_pct: fat as % of recipe weight (gelato target 6-10)
  - msnf_pct: milk solids non-fat as % (gelato target 9-12)
  - totalSugars_pct: added sugars only as % (for display; gelato 16-22)
  - totalSugarsTotal_pct: total sugars incl. lactose as % (industry validation band)
  - ts_pct: total solids as % (gelato target 36-42)
  - sp_pct: sweetness power as % of recipe weight (gelato target 12-22)
  - afp_index: anti-freeze power as % (gelato target 22-28) — this is THE PAC metric
  - fpdt: freezing point depression in °C (gelato target 2.5-3.5)
  - pod_index: relative sweetness vs sucrose=100 (display only)

Your job: Extract WHAT the user wants to achieve, expressed as target
percentages for the LP optimizer.
You must NEVER output gram quantities. You must NEVER suggest specific
ingredient amounts. That is the solver's job.
You MAY suggest adding or removing an ingredient by name from the
INGREDIENT_DB (only if the user explicitly asks for a new ingredient or
to remove one).
Return ONLY valid JSON:
{
"optimization_targets": {
"fat_pct": <number or null>,
"msnf_pct": <number or null>,
"totalSugars_pct": <number or null>,
"ts_pct": <number or null>,
"afp_target": <number or null>,
"sp_target": <number or null>,
"fpdt_target": <number or null>
},
"add_ingredient_names": ["name from DB" ...],
"remove_ingredient_names": ["exact name" ...],
"intent_summary": "One sentence: what the user is trying to achieve"
}`;

const FOOD_SCIENTIST_POST_PROMPT = `You are an expert food scientist specialising in ice cream, gelato, kulfi, and frozen desserts.
You will receive: 1. The user's original prompt. 2. The LP solver's output metrics and changes.
Your job: Reason about PRACTICALITY of the proposed changes. Be concise and actionable.
You must NEVER: Invent quantities, suggest changes to LOCKED ingredients, or contradict the solver's math.
Input is the solver's output. ONLY explain.
You MUST return a JSON object with exactly these string fields:
{
"fat_impact": "...",
"msnf_impact": "...",
"sugar_impact": "...",
"fpd_impact": "...",
"texture_impact": "...",
"taste_impact": "...",
"what_changed": "...",
"why": "...",
"next_step": "..."
}`;

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
{"refined_recipe": [{"ingredient": "Name", "quantity_g": 1234.56}, ...], "changes_made": "...", "reasoning": "...", "pass_to_optimizer": {"fat_pct": 10, "msnf_pct": 9, "totalSugars_pct": 18}}
IMPORTANT: pass_to_optimizer MUST be a JSON object with numeric targets. Valid keys: fat_pct, msnf_pct, totalSugars_pct, ts_pct, fpdt. Only include keys you have specific targets for.`;

const FOOD_CRITIQUE_PROMPT = `You are an expert food critique specialising in frozen desserts.
Review the FINAL OPTIMIZED recipe covering taste, texture, balance, and feasibility.
Respond with ONLY valid JSON:
{"review": "...", "verdict": "approved" or "needs_revision", "confidence": 75}`;

const DIAGNOSE_TRIAL_PROMPT = `You are an expert food scientist specialising in ice cream and gelato.
A production trial failed QA. You will receive:
1. Target Parameters (the original theoretical recipe metrics).
2. Actual QA Metrics (what was measured during the trial).
3. Notes from the operator (if any).

Analyze the delta between expected vs. actual parameters. Provide actionable formulation adjustments.
Respond with ONLY valid JSON:
{
    "diagnosis": "Brief summary of what went wrong",
    "root_cause_analysis": "Detailed explanation of likely causes",
    "actionable_suggestions": ["Suggestion 1", "Suggestion 2"]
}`;

function stripCodeFences(raw: string): string {
    if (!raw.trim().startsWith('\`\`\`')) return raw;
    const lines = raw.split('\n');
    let start = -1, end = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('\`\`\`')) { start = i; break; }
    }
    for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].trim().startsWith('\`\`\`')) { end = i; break; }
    }
    if (start !== -1 && end !== -1 && start !== end) {
        return lines.slice(start + 1, end).join('\n');
    }
    return lines.filter(l => !l.trim().startsWith('\`\`\`')).join('\n');
}



router.post('/optimize', async (req, res) => {
    try {
        const { userPrompt, recipe, targetParams, mode = 'gelato', currentMetrics } = req.body;

        let totalTokens = 0;
        let totalLatency = 0;

        if (!userPrompt || !recipe || !targetParams) {
            res.status(400).json({ error: 'Missing required fields: userPrompt, recipe, targetParams' });
            return;
        }

        const allIngredients = await fetchIngredientsFromSupabase();
        const dbSummary = allIngredients.map(r => ({ name: r.name, category: r.category, fat_pct: r.fat_pct, msnf_pct: r.msnf_pct, sugars_pct: r.sugars_pct || r.sugar_pct }));

        let intentTargets: any = {};
        let intentSummary = 'No changes';
        let modifiedRecipeRows = recipe.map((r: any) => {
            const ingName = typeof r.ingredient === 'string' ? r.ingredient : (r.ingredient?.name || 'Unknown');
            const ingData = typeof r.ingredient === 'string' ? (allIngredients.find((i: any) => i.name === ingName) || { name: ingName }) : r.ingredient;
            const g = r.grams !== undefined ? r.grams : (r.quantity_g !== undefined ? r.quantity_g : 0);
            return {
                ing: ingData,
                grams: g,
                lock: ingData?.category === 'stabilizer' || r.lock,
                min: (ingData?.category === 'stabilizer' || r.lock) ? g : 0,
                max: (ingData?.category === 'stabilizer' || r.lock) ? g : g * 10
            };
        });

        try {
            const engineerPrompt = `USER REQUEST:\n${userPrompt}\n\nCURRENT RECIPE:\n${JSON.stringify(recipe, null, 2)}\n\nCURRENT METRICS:\n${currentMetrics ? JSON.stringify(currentMetrics, null, 2) : "Use your best judgement."}\n\nAVAILABLE INGREDIENTS:\n${JSON.stringify(dbSummary, null, 2)}`;
            const callRes1 = await callGemini(FOOD_ENGINEER_INTENT_PROMPT, engineerPrompt);
            totalTokens += callRes1.usage?.totalTokenCount || 0;
            totalLatency += callRes1.latencyMs || 0;
            
            const raw = stripCodeFences(callRes1.text);
            const parsed = JSON.parse(raw);
            
            intentTargets = parsed.optimization_targets || {};
            intentSummary = parsed.intent_summary || 'Modified per instructions';
            
            if (parsed.remove_ingredient_names && Array.isArray(parsed.remove_ingredient_names)) {
                modifiedRecipeRows = modifiedRecipeRows.filter((r: any) => !parsed.remove_ingredient_names.includes(r.ing.name));
            }
            if (parsed.add_ingredient_names && Array.isArray(parsed.add_ingredient_names)) {
                for (const name of parsed.add_ingredient_names) {
                    const ingDb = allIngredients.find(i => i.name === name);
                    if (ingDb && !modifiedRecipeRows.some((r: any) => r.ing.name === name)) {
                        modifiedRecipeRows.push({ ing: ingDb, grams: 0, lock: false, min: 0, max: 1000 });
                    }
                }
            }
        } catch (err) {
            console.warn('⚠️ Food engineer intent parser failed:', err);
        }

        const finalTargets = {
            fat_pct: intentTargets.fat_pct ?? undefined,
            msnf_pct: intentTargets.msnf_pct ?? undefined,
            totalSugars_pct: intentTargets.totalSugars_pct ?? undefined,
            ts_pct: intentTargets.ts_pct ?? undefined,
            afp_target: intentTargets.afp_target ?? undefined,
            pod_target: intentTargets.sp_target ?? undefined,   // SP% target maps to pod_target in LP
            fpdt: intentTargets.fpdt_target ?? undefined,       // used by post-LP FPDT refinement
        };

        const lpResult = balancingEngine.balance(modifiedRecipeRows, finalTargets, mode);

        const diffs: any[] = [];
        for (const newRow of lpResult.rows) {
            const oldRow = modifiedRecipeRows.find((r: any) => r.ing.id === newRow.ing.id || r.ing.name === newRow.ing.name);
            const origG = oldRow ? oldRow.grams : 0;
            const propG = newRow.grams;
            const deltaG = propG - origG;
            if (Math.abs(deltaG) > 0.01) {
                diffs.push({
                    ingredient: newRow.ing.name,
                    original_g: Math.round(origG * 100) / 100,
                    proposed_g: Math.round(propG * 100) / 100,
                    delta_g: Math.round(deltaG * 100) / 100,
                    delta_pct: origG > 0 ? Math.round((deltaG / origG) * 10000) / 100 : 100,
                });
            }
        }
        for (const oldRow of modifiedRecipeRows) {
             if (!lpResult.rows.some((r: any) => r.ing.id === oldRow.ing.id || r.ing.name === oldRow.ing.name)) {
                 diffs.push({
                    ingredient: oldRow.ing.name,
                    original_g: oldRow.grams,
                    proposed_g: 0,
                    delta_g: -oldRow.grams,
                    delta_pct: -100,
                 });
             }
        }
        diffs.sort((a, b) => Math.abs(b.delta_g) - Math.abs(a.delta_g));

        let aiAnalysis: any = {};
        try {
            const sciPrompt = `USER REQUEST:\n${userPrompt}\n\nSOLVER METRICS BEFORE:\n${JSON.stringify(currentMetrics || {}, null, 2)}\n\nSOLVER METRICS AFTER:\n${JSON.stringify(lpResult.metrics, null, 2)}\n\nCHANGES MADE:\n${JSON.stringify(diffs, null, 2)}\n\nINTENT SUMMARY:\n${intentSummary}\n\nExplain the solver's results.`;
            const callRes2 = await callGemini(FOOD_SCIENTIST_POST_PROMPT, sciPrompt);
            totalTokens += callRes2.usage?.totalTokenCount || 0;
            totalLatency += callRes2.latencyMs || 0;
            const rawSci = stripCodeFences(callRes2.text);
            try {
                aiAnalysis = JSON.parse(rawSci);
            } catch (e) {
                aiAnalysis = { error: "Failed to parse explanation JSON.", raw: rawSci };
            }
        } catch (err) {
            aiAnalysis = { error: `⚠️ Food scientist reasoning unavailable: ${err instanceof Error ? err.message : String(err)}` };
        }

        // Build optimized_recipe as Record<string, number> (frontend expects this shape)
        const optimizedRecipeMap: Record<string, number> = {};
        for (const r of lpResult.rows) {
            if (r.grams > 0.01) {
                optimizedRecipeMap[r.ing.name] = Math.round(r.grams * 100) / 100;
            }
        }

        // Build metrics in RecipeMetrics shape for frontend
        const metricsBefore = currentMetrics || calcMetricsV2(modifiedRecipeRows.map((r: any) => ({ing: r.ing, grams: r.grams})));
        const metricsAfter = lpResult.metrics;

        const toRecipeMetrics = (m: any) => ({
            total_mass_g: m.total_g || 0,
            fat_pct: m.fat_pct || 0,
            msnf_pct: m.msnf_pct || 0,
            sugars_pct: m.totalSugars_pct || m.sugars_pct || 0,
            water_pct: m.water_pct || 0,
            total_solids_pct: m.ts_pct || 0,
        });

        try {
            await supabase.from('ai_usage_log').insert({ 
                user_id: req.user!.id, 
                function_name: 'ai-optimize',
                tokens_used: totalTokens,
                latency_ms: totalLatency,
                success: lpResult.success
            });
        } catch {}

        // Response shape matches frontend AgentResult type (snake_case keys)
        res.json({
            success: lpResult.success,
            solver_status: lpResult.success ? 'OPTIMAL' : 'INFEASIBLE',
            batch: { gross_liquid_volume_L: 0, batch_mass_g: 0, n_skus: 0, scale_factor: 1 },
            optimized_recipe: optimizedRecipeMap,
            metrics_before: toRecipeMetrics(metricsBefore),
            metrics_after: toRecipeMetrics(metricsAfter),
            diffs,
            engineer_changes: intentSummary,
            ai_analysis: aiAnalysis,
            warnings: [],
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message || 'AI optimization failed' });
    }
});

router.post('/create', async (req, res) => {
    try {
        const { userPrompt, targetParams, productionTargets, mode = 'gelato' } = req.body;
        if (!userPrompt || !productionTargets) {
            res.status(400).json({ error: 'Missing required fields: userPrompt, productionTargets' });
            return;
        }

        let totalTokens = 0;
        let totalLatency = 0;

        const allIngredients = await fetchIngredientsFromSupabase();
        const dbSummary = allIngredients.map(r => ({ name: r.name, category: r.category, fat_pct: r.fat_pct, msnf_pct: r.msnf_pct, sugars_pct: r.sugars_pct || r.sugar_pct }));

        let referenceRecipe: any = null;
        let referenceRecipeName: string | null = null;
        let searchReasoning = 'No search performed';

        try {
            const { data: recipes } = await supabase.from('recipes').select('id, recipe_name, product_type, recipe_rows ( ingredient, quantity_g )').order('created_at', { ascending: false }).limit(50);
            if (recipes && recipes.length > 0) {
                const summaries = (recipes as any[]).map((r: any, i: number) => ({
                    index: i, name: r.recipe_name, product_type: r.product_type,
                    ingredients: (r.recipe_rows || []).map((row: any) => row.ingredient),
                }));
                const searchPrompt = `USER REQUEST:\n${userPrompt}\n\nEXISTING RECIPES IN DATABASE:\n${JSON.stringify(summaries, null, 2)}\n\nAnalyze each recipe's relevance and return your choice as JSON.`;
                const { text: rawSearch, usage, latencyMs } = await callGemini(RECIPE_SEARCH_PROMPT, searchPrompt);
                if (usage) totalTokens += usage.totalTokenCount; if (latencyMs != null) totalLatency += latencyMs;
                const raw = stripCodeFences(rawSearch);
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

        let draftRecipe: any[] = [];
        let engineerReasoning = '';
        let usedWebSearch = false;

        try {
            const sysPrompt = referenceRecipe ? FOOD_ENGINEER_CREATE_PROMPT_A : FOOD_ENGINEER_CREATE_PROMPT_B;
            const refStr = referenceRecipe ? `\n\nREFERENCE RECIPE:\n${JSON.stringify(referenceRecipe, null, 2)}` : '';
            const targetStr = targetParams ? `\n\nTARGET PARAMETERS:\n${JSON.stringify(targetParams, null, 2)}` : '';
            const userMsg = `USER REQUEST:\n${userPrompt}${refStr}${targetStr}\n\nAVAILABLE INGREDIENTS (INGREDIENT_DB):\n${JSON.stringify(dbSummary, null, 2)}`;
            const callFn = referenceRecipe ? callGemini : callGeminiWithSearch;
            usedWebSearch = !referenceRecipe;
            const { text: rawEng, usage, latencyMs } = await callFn(sysPrompt, userMsg);
            if (usage) totalTokens += usage.totalTokenCount; if (latencyMs != null) totalLatency += latencyMs;
            const raw = stripCodeFences(rawEng);
            const parsed = JSON.parse(raw);
            draftRecipe = parsed.created_recipe || [];
            engineerReasoning = parsed.reasoning || '';
        } catch (err) {
            engineerReasoning = `Engineer failed: ${err instanceof Error ? err.message : String(err)}`;
        }

        let refinedRecipe = draftRecipe;
        let scientistChanges = 'Skipped';
        let scientistReasoning = '';
        let passToOptimizer: Record<string, number> = {};

        try {
            const targetStr = [
                targetParams?.fat_pct != null ? `Fat: ${targetParams.fat_pct}%` : null,
                targetParams?.msnf_pct != null ? `MSNF: ${targetParams.msnf_pct}%` : null,
                targetParams?.sugars_pct != null ? `Sugars: ${targetParams.sugars_pct}%` : null,
            ].filter(Boolean).join(', ');
            const reviewPrompt = `USER REQUEST:\n${userPrompt}\n\nTARGET PARAMETERS: ${targetStr || 'No specific targets'}\n\nDRAFT RECIPE:\n${JSON.stringify(draftRecipe, null, 2)}\n\nAVAILABLE INGREDIENTS (INGREDIENT_DB):\n${JSON.stringify(dbSummary, null, 2)}\n\nReview this recipe using food-science logic and return the refined recipe as JSON.`;
            const { text: rawSci, usage, latencyMs } = await callGemini(FOOD_SCIENTIST_REVIEW_PROMPT, reviewPrompt);
            if (usage) totalTokens += usage.totalTokenCount; if (latencyMs != null) totalLatency += latencyMs;
            const raw = stripCodeFences(rawSci);
            const parsed = JSON.parse(raw);
            const validRecipe = (parsed.refined_recipe ?? draftRecipe).filter((item: any) => allIngredients.some(i => i.name === item.ingredient));
            refinedRecipe = validRecipe.length > 0 ? validRecipe : draftRecipe;
            scientistChanges = parsed.changes_made ?? 'No changes';
            scientistReasoning = parsed.reasoning ?? '';
            const rawOpt = parsed.pass_to_optimizer;
            passToOptimizer = (rawOpt && typeof rawOpt === 'object') ? rawOpt : {};
        } catch (err) {
            scientistReasoning = `Scientist failed: ${err instanceof Error ? err.message : String(err)}`;
        }

        const refinedRows = refinedRecipe.map((item: any) => {
            const ingDb = allIngredients.find(i => i.name === item.ingredient) || { name: item.ingredient };
            return { ing: ingDb, grams: item.quantity_g, lock: false, min: 0, max: item.quantity_g * 5 };
        });

        // Merge: scientist's pass_to_optimizer fills gaps, user's explicit targetParams win
        const optTargets: OptimizeTarget = {
            ...passToOptimizer,
            ...(targetParams || {}),
        };
        const lpResult = balancingEngine.balance(refinedRows, optTargets, mode);

        let critiqueReview = '';
        let critiqueVerdict: 'approved' | 'needs_revision' = 'needs_revision';
        let critiqueConfidence = 0;

        try {
            const critiquePrompt = `USER REQUEST:\n${userPrompt}\n\nFINAL OPTIMIZED RECIPE:\n${JSON.stringify(
                lpResult.rows.filter((r: any) => r.grams > 0.01).map((r: any) => ({ ingredient: r.ing.name, quantity_g: Math.round(r.grams * 100) / 100 })),
                null, 2
            )}\n\nMETRICS AFTER:\n${JSON.stringify(lpResult.metrics, null, 2)}\n\nProvide your detailed critique as JSON.`;
            const { text: rawCrit, usage, latencyMs } = await callGemini(FOOD_CRITIQUE_PROMPT, critiquePrompt);
            if (usage) totalTokens += usage.totalTokenCount; if (latencyMs != null) totalLatency += latencyMs;
            const raw = stripCodeFences(rawCrit);
            const parsed = JSON.parse(raw);
            critiqueReview = parsed.review ?? '';
            critiqueVerdict = parsed.verdict === 'needs_revision' ? 'needs_revision' : 'approved';
            critiqueConfidence = Math.min(100, Math.max(0, parsed.confidence ?? 50));
        } catch (err) {
            critiqueReview = `Critique unavailable: ${err instanceof Error ? err.message : String(err)}`;
        }

        try { await supabase.from('ai_usage_log').insert({ 
            user_id: req.user!.id, 
            function_name: 'ai-create',
            tokens_used: totalTokens,
            latency_ms: totalLatency,
            success: lpResult.success
        }); } catch {}

        res.json({
            success: lpResult.success,
            reference_recipe_name: referenceRecipeName,
            reference_recipe: referenceRecipe,
            search_reasoning: searchReasoning,
            draft_recipe: draftRecipe,
            engineer_reasoning: engineerReasoning,
            used_web_search: usedWebSearch,
            refined_recipe: refinedRecipe,
            scientist_changes: scientistChanges,
            scientist_reasoning: scientistReasoning,
            solver_status: lpResult.success ? 'OPTIMAL' : 'INFEASIBLE',
            optimized_recipe: lpResult.rows.reduce((acc: any, cur: any) => { acc[cur.ing.name] = Math.round(cur.grams * 100) / 100; return acc; }, {}),
            metrics_before: (() => { const m = calcMetricsV2(refinedRows); return { total_mass_g: m.total_g || 0, fat_pct: m.fat_pct || 0, msnf_pct: m.msnf_pct || 0, sugars_pct: m.totalSugars_pct || 0, water_pct: m.water_pct || 0, total_solids_pct: m.ts_pct || 0 }; })(),
            metrics_after: (() => { const m = lpResult.metrics; return { total_mass_g: m.total_g || 0, fat_pct: m.fat_pct || 0, msnf_pct: m.msnf_pct || 0, sugars_pct: m.totalSugars_pct || 0, water_pct: m.water_pct || 0, total_solids_pct: m.ts_pct || 0 }; })(),
            diffs: [],
            critique_review: critiqueReview,
            critique_verdict: critiqueVerdict,
            critique_confidence: critiqueConfidence,
            warnings: [],
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message || 'AI create failed' });
    }
});

router.post('/vision', async (req, res) => {
    try {
        const { systemPrompt, userPrompt, base64Image, mimeType } = req.body;
        if (!base64Image || !mimeType) { res.status(400).json({ error: 'Missing base64Image or mimeType' }); return; }
        const { text: result, usage, latencyMs } = await callGeminiVision(systemPrompt || 'Extract nutritional information from this label image.', userPrompt || 'Analyze this ingredient label and extract all nutritional data.', base64Image, mimeType);
        try { await supabase.from('ai_usage_log').insert({ 
            user_id: req.user!.id, 
            function_name: 'ai-vision',
            tokens_used: usage?.totalTokenCount || 0,
            latency_ms: latencyMs,
            success: true
        }); } catch {}
        res.json({ result });
    } catch (e: any) { res.status(500).json({ error: e.message || 'Vision analysis failed' }); }
});

router.post('/production-round', async (req, res) => {
    try {
        const { ingredients, productType, recipeName } = req.body;
        if (!ingredients || !Array.isArray(ingredients)) { res.status(400).json({ error: 'Missing ingredients array' }); return; }
        const roundedIngredients = ingredients.map((ing: any) => {
            let rounded: number;
            if (ing.massGrams >= 1000) { rounded = Math.round(ing.massGrams / 100) * 100; }
            else if (ing.massGrams >= 100) { rounded = Math.round(ing.massGrams / 50) * 50; }
            else if (ing.massGrams >= 10) { rounded = Math.round(ing.massGrams / 10) * 10; }
            else { rounded = Math.round(ing.massGrams); }
            return { ...ing, massGrams: rounded };
        });
        try {
            const roundPrompt = `Round these production quantities to practical numbers (nearest 50g or 100g for large amounts):\n${JSON.stringify(ingredients.map((i: any) => ({ name: i.name, mass_g: i.massGrams })), null, 2)}\n\nReturn ONLY valid JSON array: [{"name": "...", "mass_g": 1234}, ...]`;
            const { text: rawRes, usage, latencyMs } = await callGemini('You are a production planning expert. Round quantities to practical production numbers.', roundPrompt);
            const raw = stripCodeFences(rawRes);
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                for (const item of parsed) {
                    const match = roundedIngredients.find((i: any) => i.name === item.name);
                    if (match) match.massGrams = item.mass_g;
                }
            }
            try { await supabase.from('ai_usage_log').insert({ 
                user_id: req.user!.id, 
                function_name: 'ai-production-round',
                tokens_used: usage?.totalTokenCount || 0,
                latency_ms: latencyMs,
                success: true
            }); } catch {}
        } catch {}
        res.json({ success: true, originalRecipe: ingredients, roundedRecipe: roundedIngredients, summary: `Rounded ${ingredients.length} ingredients to production quantities`, });
    } catch (e: any) { res.status(500).json({ error: e.message || 'Production rounding failed' }); }
});

router.get('/usage', async (req, res) => {
    try {
        const userId = req.user!.id;
        const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { count, error } = await supabase.from('ai_usage_log').select('*', { count: 'exact', head: true }).eq('user_id', userId).gt('created_at', since);
        if (error) { res.status(500).json({ error: error.message }); return; }
        res.json({ used: count || 0, limit: 10, remaining: Math.max(0, 10 - (count || 0)) });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

function parseGeminiJson(result: any): any {
    const text = typeof result === 'string' ? result : result.text;
    const cleanStr = text.replace(/\`\`\`json/gi, '').replace(/\`\`\`/g, '').trim();
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
        const { text: result } = await callGemini(systemPrompt, userPrompt);
        res.json({ success: true, analysis: parseGeminiJson(result) });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/explain-warning', async (req, res) => {
    try {
        const { warning, mode, metrics } = req.body;
        const systemPrompt = `You are a professional Gelato formulation expert.`;
        const userPrompt = `The user's recipe triggered a calculation warning: "${warning}"
Mode: ${mode || 'gelato'}
Current Metrics: ${JSON.stringify(metrics, null, 2)}

Explain WHY this warning is important for structural integrity or flavor, and provide EXACT, ACTIONABLE steps to resolve it. Be extremely clear and scientific.`;
        const { text: result } = await callGemini(systemPrompt, userPrompt);
        res.json({ success: true, explanation: result });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
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
        const { text: result } = await callGemini(systemPrompt, userPrompt);
        res.json({ success: true, mapping: parseGeminiJson(result) });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
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
        const { text: result } = await callGemini(systemPrompt, userPrompt);
        res.json({ success: true, recipe: parseGeminiJson(result) });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/diagnose-trial', async (req, res) => {
    try {
        const { targetMetrics, currentMetrics, notes } = req.body;
        
        if (!targetMetrics || !currentMetrics) {
            return res.status(400).json({ error: 'Missing targetMetrics or currentMetrics' });
        }

        const userPrompt = `TARGET METRICS:
${JSON.stringify(targetMetrics, null, 2)}

ACTUAL QA METRICS:
${JSON.stringify(currentMetrics, null, 2)}

NOTES:
${notes || 'None provided'}
`;

        const { text: result, usage, latencyMs } = await callGemini(DIAGNOSE_TRIAL_PROMPT, userPrompt);
        
        try { 
            await supabase.from('ai_usage_log').insert({ 
                user_id: req.user!.id, 
                function_name: 'ai-diagnose-trial',
                tokens_used: usage?.totalTokenCount || 0,
                latency_ms: latencyMs,
                success: true
            }); 
        } catch {}

        res.json({ success: true, diagnosis: parseGeminiJson(result) });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export { router as aiRouter };
