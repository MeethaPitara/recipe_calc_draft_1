/**
 * AIRoundingPanel — UI Component for AI Production Rounding
 * 
 * Shows a button to trigger AI rounding, displays progress, iterations,
 * and the final rounded recipe comparison.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from '@/components/ui/collapsible';
import { Loader2, Wand2, CheckCircle, AlertCircle, ChevronDown, RotateCcw, ArrowRight } from 'lucide-react';
import { apiPost } from '@/lib/apiClient';
import type { ProductionIngredient } from '@/lib/production/api';
import { IngredientData } from '@/types/ingredients';
import { useToast } from '@/hooks/use-toast';

// Rounding result types (mirrored from backend response)
export interface RoundingIteration {
    iteration: number;
    recipe: ProductionIngredient[];
    report: {
        allInRange: boolean;
        totalError: number;
        inRangeCount: number;
        totalParams: number;
        params: { param: string; value: number; min: number; max: number; inRange: boolean; error: number }[];
    };
    aiAction: string;
}

export interface RoundingResult {
    success: boolean;
    originalRecipe: ProductionIngredient[];
    roundedRecipe: ProductionIngredient[];
    bestReport: {
        allInRange: boolean;
        totalError: number;
        inRangeCount: number;
        totalParams: number;
        params: { param: string; value: number; min: number; max: number; inRange: boolean; error: number }[];
    };
    iterations: RoundingIteration[];
    totalIterations: number;
    summary: string;
    terminatedEarly: boolean;
}

interface AIRoundingPanelProps {
    /** Raw production recipe ingredients */
    ingredients: ProductionIngredient[];
    /** Product type for target validation */
    productType: string;
    /** Full ingredient database */
    availableIngredients: IngredientData[];
    /** Recipe name for context */
    recipeName?: string;
    /** Callback when rounding is complete - parent can use rounded recipe */
    onRoundingComplete?: (result: RoundingResult) => void;
}

export const AIRoundingPanel: React.FC<AIRoundingPanelProps> = ({
    ingredients,
    productType,
    availableIngredients,
    recipeName = 'Production Recipe',
    onRoundingComplete,
}) => {
    const { toast } = useToast();
    const [isRunning, setIsRunning] = useState(false);
    const [progressStatus, setProgressStatus] = useState('');
    const [progressIteration, setProgressIteration] = useState(0);
    const [result, setResult] = useState<RoundingResult | null>(null);
    const [showIterations, setShowIterations] = useState(false);

    const handleRunRounding = async () => {
        if (ingredients.length === 0) {
            toast({
                title: 'No recipe to round',
                description: 'Calculate production quantities first.',
                variant: 'destructive',
            });
            return;
        }

        setIsRunning(true);
        setResult(null);
        setProgressStatus('Starting AI rounding...');
        setProgressIteration(0);

        try {
            const response = await apiPost<{
                success: boolean;
                originalRecipe: ProductionIngredient[];
                roundedRecipe: ProductionIngredient[];
                summary: string;
            }>('/api/ai/production-round', {
                ingredients,
                productType,
                recipeName,
            });

            // Map to RoundingResult format for UI compatibility
            const roundingResult: RoundingResult = {
                success: response.success,
                originalRecipe: ingredients,
                roundedRecipe: response.roundedRecipe || ingredients,
                bestReport: {
                    allInRange: response.success,
                    totalError: 0,
                    inRangeCount: 0,
                    totalParams: 0,
                    params: [],
                },
                iterations: [],
                totalIterations: 1,
                summary: response.summary || 'Rounding complete',
                terminatedEarly: false,
            };

            setResult(roundingResult);
            onRoundingComplete?.(roundingResult);

            toast({
                title: roundingResult.success ? '✅ Rounding Complete' : '⚠ Best Effort Rounding',
                description: roundingResult.summary,
                duration: 5000,
            });
        } catch (err: any) {
            console.error('[AIRoundingPanel] Error:', err);
            toast({
                title: 'Rounding Failed',
                description: err.message || 'AI rounding encountered an error.',
                variant: 'destructive',
            });
        } finally {
            setIsRunning(false);
            setProgressStatus('');
        }
    };

    const handleReset = () => {
        setResult(null);
        setShowIterations(false);
    };

    const formatMass = (g: number) => {
        if (g >= 1000) return `${(g / 1000).toFixed(2)} kg`;
        return `${g.toFixed(1)} g`;
    };

    return (
        <Card className="border-amber-200 dark:border-amber-900 bg-gradient-to-b from-amber-50/50 to-white dark:from-amber-950/20 dark:to-slate-950">
            <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                    <Wand2 className="h-4 w-4 text-amber-600" />
                    AI Production Rounding
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">

                {/* Description */}
                {!result && !isRunning && (
                    <p className="text-xs text-muted-foreground">
                        Rounds mathematical quantities to practical production numbers (nearest 50/100g)
                        and verifies that target parameters (fat%, MSNF%, sugar%, etc.) remain within range.
                        Uses up to 5 AI iterations to optimize.
                    </p>
                )}

                {/* Action Button */}
                {!result && (
                    <Button
                        onClick={handleRunRounding}
                        disabled={isRunning || ingredients.length === 0}
                        className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white"
                        size="sm"
                    >
                        {isRunning ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {progressStatus || 'Processing...'}
                            </>
                        ) : (
                            <>
                                <Wand2 className="h-4 w-4" />
                                Round & Validate Quantities
                            </>
                        )}
                    </Button>
                )}

                {/* Progress Indicator */}
                {isRunning && (
                    <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900">
                        <Loader2 className="h-5 w-5 animate-spin text-amber-600 shrink-0" />
                        <div>
                            <div className="text-sm font-medium text-amber-800 dark:text-amber-300">
                                {progressStatus}
                            </div>
                            {progressIteration > 0 && (
                                <div className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                                    Iteration {progressIteration} of 5
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Result */}
                {result && (
                    <div className="space-y-3">
                        {/* Status Banner */}
                        <Alert className={result.success
                            ? 'border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-900'
                            : 'border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-900'
                        }>
                            <div className="flex items-start gap-2">
                                {result.success
                                    ? <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                                    : <AlertCircle className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />
                                }
                                <AlertDescription className="text-xs">
                                    <div className="font-medium mb-1">
                                        {result.success ? 'All parameters in range!' : 'Best effort (some params still outside range)'}
                                    </div>
                                    <div>{result.summary}</div>
                                    <div className="mt-1 flex gap-2">
                                        <Badge variant="outline" className="text-[10px]">
                                            {result.bestReport.inRangeCount}/{result.bestReport.totalParams} params ✓
                                        </Badge>
                                        <Badge variant="outline" className="text-[10px]">
                                            {result.totalIterations} iteration{result.totalIterations !== 1 ? 's' : ''}
                                        </Badge>
                                    </div>
                                </AlertDescription>
                            </div>
                        </Alert>

                        {/* Comparison Table */}
                        <div className="rounded-md border overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-50 dark:bg-slate-900">
                                    <TableRow>
                                        <TableHead className="text-xs">Ingredient</TableHead>
                                        <TableHead className="text-xs text-right">Original</TableHead>
                                        <TableHead className="text-xs text-center w-8"></TableHead>
                                        <TableHead className="text-xs text-right font-bold">Rounded</TableHead>
                                        <TableHead className="text-xs text-right">Δ</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {result.roundedRecipe.map((rounded, i) => {
                                        const original = result.originalRecipe[i];
                                        const delta = rounded.massGrams - original.massGrams;
                                        const changed = Math.abs(delta) > 0.01;

                                        return (
                                            <TableRow key={i} className={changed ? 'bg-amber-50/50 dark:bg-amber-950/10' : ''}>
                                                <TableCell className="text-xs font-medium py-1.5">{rounded.name}</TableCell>
                                                <TableCell className="text-xs text-right py-1.5 text-muted-foreground font-mono">
                                                    {formatMass(original.massGrams)}
                                                </TableCell>
                                                <TableCell className="text-center py-1.5">
                                                    {changed && <ArrowRight className="h-3 w-3 text-amber-500 inline" />}
                                                </TableCell>
                                                <TableCell className="text-xs text-right py-1.5 font-mono font-bold">
                                                    {formatMass(rounded.massGrams)}
                                                </TableCell>
                                                <TableCell className={`text-xs text-right py-1.5 font-mono ${delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-500' : 'text-muted-foreground'
                                                    }`}>
                                                    {changed ? (delta > 0 ? '+' : '') + formatMass(Math.abs(delta)) : '—'}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Param Validation Details */}
                        <div className="space-y-1">
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Parameter Check
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                                {result.bestReport.params.map((p, i) => (
                                    <div
                                        key={i}
                                        className={`flex items-center justify-between text-xs px-2 py-1.5 rounded-md ${p.inRange
                                            ? 'bg-green-50 dark:bg-green-950/20 text-green-800 dark:text-green-300'
                                            : 'bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-300'
                                            }`}
                                    >
                                        <span className="font-medium">{p.param}</span>
                                        <span className="font-mono">
                                            {p.value.toFixed(1)}
                                            <span className="text-[10px] ml-1 opacity-60">
                                                [{p.min.toFixed(1)}-{p.max.toFixed(1)}]
                                            </span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Iteration History (Collapsible) */}
                        {result.iterations.length > 1 && (
                            <Collapsible open={showIterations} onOpenChange={setShowIterations}>
                                <CollapsibleTrigger asChild>
                                    <Button variant="ghost" size="sm" className="w-full text-xs gap-1 text-muted-foreground">
                                        <ChevronDown className={`h-3 w-3 transition-transform ${showIterations ? 'rotate-180' : ''}`} />
                                        {showIterations ? 'Hide' : 'Show'} Iteration History ({result.iterations.length} iterations)
                                    </Button>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <div className="space-y-2 mt-2">
                                        {result.iterations.map((iter, i) => (
                                            <div
                                                key={i}
                                                className="text-xs p-2 rounded border bg-slate-50 dark:bg-slate-900"
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="font-medium">
                                                        {iter.iteration === 0 ? 'Initial Round' : `Iteration ${iter.iteration}`}
                                                    </span>
                                                    <Badge
                                                        variant={iter.report.allInRange ? 'default' : 'secondary'}
                                                        className="text-[10px] h-4"
                                                    >
                                                        {iter.report.inRangeCount}/{iter.report.totalParams} ✓
                                                    </Badge>
                                                </div>
                                                <div className="text-muted-foreground">{iter.aiAction}</div>
                                            </div>
                                        ))}
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        )}

                        {/* Reset Button */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleReset}
                            className="w-full gap-2 text-xs"
                        >
                            <RotateCcw className="h-3 w-3" />
                            Reset & Try Again
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default AIRoundingPanel;
