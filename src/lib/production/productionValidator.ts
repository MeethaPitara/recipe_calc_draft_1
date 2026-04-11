/**
 * Production Validator — Pure Math, No AI
 * 
 * Takes a production recipe (ingredient quantities in grams) and checks
 * whether the recipe still meets target parameter ranges (fat%, msnf%, sugars%, etc.)
 * 
 * This is the deterministic "ground truth" checker used between AI rounding iterations.
 */

import { IngredientData } from '@/types/ingredients';
import { calcMetricsV2, MetricsV2 } from '@/lib/calc.v2';
import { getTargets, RecipeTargets } from '@/components/TargetPresets';
import { resolveMode } from '@/lib/mode';

// ── Types ──

export interface ProductionIngredient {
    ingredientId: string;
    name: string;
    massGrams: number;
    ingredientData?: IngredientData;
}

export interface ParamValidation {
    param: string;
    value: number;
    min: number;
    max: number;
    inRange: boolean;
    error: number; // absolute distance from nearest boundary (0 if in range)
}

export interface ValidationReport {
    allInRange: boolean;
    totalError: number;             // sum of all out-of-range errors
    inRangeCount: number;           // how many params are in range
    totalParams: number;            // total number of params checked
    params: ParamValidation[];
    metrics: MetricsV2 | null;      // full metrics for reference
}

// ── Core Validator ──

/**
 * Validates a production recipe against target parameter ranges.
 * 
 * @param ingredients - The recipe ingredients with quantities
 * @param productType - Product type key (e.g., 'gelato', 'ice_cream', 'kulfi')
 * @param availableIngredients - Full ingredient database for lookup
 * @returns ValidationReport with per-param status and overall score
 */
export function validateProductionRecipe(
    ingredients: ProductionIngredient[],
    productType: string,
    availableIngredients: IngredientData[]
): ValidationReport {
    // 1. Resolve ingredient data for each production ingredient
    const calcRows = ingredients
        .filter(ing => ing.massGrams > 0)
        .map(ing => {
            // Use attached ingredientData, or look up from available ingredients
            const ingData = ing.ingredientData
                || availableIngredients.find(a =>
                    a.id === ing.ingredientId
                    || a.name.toLowerCase() === ing.name.toLowerCase()
                );

            if (!ingData) {
                console.warn(`[ProductionValidator] No data for ingredient: ${ing.name}`);
                return null;
            }

            return {
                ing: ingData,
                grams: ing.massGrams
            };
        })
        .filter((r): r is { ing: IngredientData; grams: number } => r !== null);

    if (calcRows.length === 0) {
        return {
            allInRange: false,
            totalError: Infinity,
            inRangeCount: 0,
            totalParams: 0,
            params: [],
            metrics: null
        };
    }

    // 2. Calculate metrics using the science engine
    const mode = resolveMode(productType);
    const metrics = calcMetricsV2(calcRows, { mode });

    // 3. Get target ranges
    const targets = getTargets(productType);

    // 4. Build validation for each parameter
    const paramChecks: ParamValidation[] = [
        buildCheck('Fat %', metrics.fat_pct, targets.fat[0], targets.fat[1]),
        buildCheck('MSNF %', metrics.msnf_pct, targets.msnf[0], targets.msnf[1]),
        buildCheck('Sugar %', metrics.totalSugars_pct, targets.sugar[0], targets.sugar[1]),
        buildCheck('Total Solids %', metrics.ts_pct, targets.solids[0], targets.solids[1]),
    ];

    // Add POD/SE/FPDT if available
    if (metrics.pod !== undefined && metrics.pod !== null) {
        // POD typical range: 15-25 for gelato
        const podMin = mode === 'gelato' ? 15 : mode === 'kulfi' ? 18 : 14;
        const podMax = mode === 'gelato' ? 25 : mode === 'kulfi' ? 28 : 26;
        paramChecks.push(buildCheck('POD', metrics.pod, podMin, podMax));
    }

    if (metrics.se !== undefined && metrics.se !== null) {
        // SE typical range
        const seMin = mode === 'gelato' ? 230 : 220;
        const seMax = mode === 'gelato' ? 300 : 310;
        paramChecks.push(buildCheck('SE', metrics.se, seMin, seMax));
    }

    if (metrics.fpdt !== undefined && metrics.fpdt !== null) {
        // FPDT range
        const fpdtMin = mode === 'gelato' ? -3.5 : mode === 'kulfi' ? -2.5 : -3.2;
        const fpdtMax = mode === 'gelato' ? -2.5 : mode === 'kulfi' ? -2.0 : -2.2;
        paramChecks.push(buildCheck('FPDT °C', metrics.fpdt, fpdtMin, fpdtMax));
    }

    // 5. Aggregate
    const inRangeCount = paramChecks.filter(p => p.inRange).length;
    const totalError = paramChecks.reduce((sum, p) => sum + p.error, 0);

    return {
        allInRange: inRangeCount === paramChecks.length,
        totalError,
        inRangeCount,
        totalParams: paramChecks.length,
        params: paramChecks,
        metrics
    };
}

/**
 * Builds a single parameter validation check.
 */
function buildCheck(param: string, value: number, min: number, max: number): ParamValidation {
    const inRange = value >= min && value <= max;
    let error = 0;

    if (!inRange) {
        if (value < min) {
            error = min - value;
        } else {
            error = value - max;
        }
    }

    return {
        param,
        value: Math.round(value * 100) / 100,
        min: Math.round(min * 100) / 100,
        max: Math.round(max * 100) / 100,
        inRange,
        error: Math.round(error * 100) / 100
    };
}

/**
 * Formats a validation report as a human-readable string for AI consumption.
 */
export function formatReportForAI(report: ValidationReport): string {
    const lines: string[] = [];

    lines.push(`=== PRODUCTION RECIPE VALIDATION REPORT ===`);
    lines.push(`Overall: ${report.allInRange ? '✅ ALL IN RANGE' : '❌ SOME OUT OF RANGE'}`);
    lines.push(`Score: ${report.inRangeCount}/${report.totalParams} params in range`);
    lines.push(`Total Error: ${report.totalError.toFixed(2)}`);
    lines.push('');
    lines.push('Parameter Details:');

    for (const p of report.params) {
        const status = p.inRange ? '✅' : '❌';
        const errorStr = p.inRange ? '' : ` (error: ${p.error.toFixed(2)})`;
        lines.push(`  ${status} ${p.param}: ${p.value.toFixed(2)} [range: ${p.min.toFixed(2)} - ${p.max.toFixed(2)}]${errorStr}`);
    }

    return lines.join('\n');
}

/**
 * Compare two validation reports and return the better one.
 * "Better" = more params in range; on tie, lower total error.
 */
export function isBetterReport(
    candidate: ValidationReport,
    currentBest: ValidationReport | null
): boolean {
    if (!currentBest) return true;
    if (candidate.inRangeCount > currentBest.inRangeCount) return true;
    if (candidate.inRangeCount === currentBest.inRangeCount
        && candidate.totalError < currentBest.totalError) return true;
    return false;
}
