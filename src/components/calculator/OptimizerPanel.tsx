/**
 * OptimizerPanel — slide-out Sheet for the Task 11 "✨ Optimize" flow.
 *
 * Provides:
 *   1. Lock/Unlock checkboxes per ingredient
 *   2. Target inputs for Fat, MSNF, Sugars, Total Solids
 *   3. Run optimizer → show diff
 *   4. Apply changes back to the calculator
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Lock, Unlock, Sparkles, ArrowRight, Check, X, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { IngredientRow } from '@/types/calculator';
import type { IngredientData } from '@/types/ingredients';
import { runOptimizer, type OptimizerRequest, type OptimizerResult, type OptimizerChange } from '@/lib/optimizer/api';

interface OptimizerPanelProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    rows: IngredientRow[];
    onApplyChanges: (optimizedRows: IngredientRow[]) => void;
    productType?: string;
}

// Default lock: stabilizers, flavors, pastes, spices
const shouldDefaultLock = (ing: IngredientData): boolean => {
    const cat = ing.category?.toLowerCase() ?? '';
    const name = ing.name?.toLowerCase() ?? '';
    return (
        cat === 'stabilizer' ||
        cat === 'emulsifier' ||
        cat === 'flavor' ||
        cat === 'fruit' ||
        cat === 'paste' ||
        name.includes('stabilizer') ||
        name.includes('emulsifier') ||
        name.includes('paste') ||
        name.includes('vanilla') ||
        name.includes('cocoa')
    );
};

export function OptimizerPanel({ open, onOpenChange, rows, onApplyChanges, productType }: OptimizerPanelProps) {
    // Lock state — keyed by ingredient id
    const [lockedIds, setLockedIds] = useState<Set<string>>(() => {
        const defaults = new Set<string>();
        rows.forEach((r) => {
            if (r.ingredientData && shouldDefaultLock(r.ingredientData)) {
                defaults.add(r.ingredientData.id);
            }
        });
        return defaults;
    });

    // Target inputs
    const [targetFat, setTargetFat] = useState<string>('8.0');
    const [targetMSNF, setTargetMSNF] = useState<string>('10.0');
    const [targetSugars, setTargetSugars] = useState<string>('18.0');
    const [targetTS, setTargetTS] = useState<string>('');

    // Optimizer state
    const [isRunning, setIsRunning] = useState(false);
    const [result, setResult] = useState<OptimizerResult | null>(null);

    // Valid rows with ingredient data
    const validRows = useMemo(
        () => rows.filter((r) => r.ingredientData && r.quantity_g > 0),
        [rows]
    );

    const toggleLock = useCallback((id: string) => {
        setLockedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const handleOptimize = useCallback(() => {
        setIsRunning(true);
        setResult(null);

        // Build request
        const request: OptimizerRequest = {
            currentRecipe: validRows.map((r) => ({
                ingredient: r.ingredientData!,
                grams: r.quantity_g,
            })),
            totalTargetMass: validRows.reduce((s, r) => s + r.quantity_g, 0),
            targets: {
                fat: targetFat ? parseFloat(targetFat) : undefined,
                msnf: targetMSNF ? parseFloat(targetMSNF) : undefined,
                sugars: targetSugars ? parseFloat(targetSugars) : undefined,
                totalSolids: targetTS ? parseFloat(targetTS) : undefined,
            },
            lockedIngredientIds: Array.from(lockedIds),
            freeIngredientIds: validRows
                .filter((r) => !lockedIds.has(r.ingredientData!.id))
                .map((r) => r.ingredientData!.id),
            mode: productType || 'gelato',
        };

        // Run asynchronously
        setTimeout(async () => {
            try {
                const res = await runOptimizer(request);
                setResult(res);
            } catch (e) {
                setResult({
                    success: false,
                    status: 'ERROR',
                    optimizedRecipe: request.currentRecipe,
                    changes: [],
                    message: e instanceof Error ? e.message : 'Unknown error',
                });
            } finally {
                setIsRunning(false);
            }
        }, 50);
    }, [validRows, lockedIds, targetFat, targetMSNF, targetSugars, targetTS]);

    const handleApply = useCallback(() => {
        if (!result?.success) return;

        // Map optimized recipe back to IngredientRow[]
        const optimizedMap = new Map<string, number>();
        result.optimizedRecipe.forEach((item) => {
            optimizedMap.set(item.ingredient.id, item.grams);
        });

        const newRows = rows.map((r) => {
            if (!r.ingredientData) return r;
            const newGrams = optimizedMap.get(r.ingredientData.id);
            if (newGrams === undefined) return r;

            const ing = r.ingredientData;
            return {
                ...r,
                quantity_g: newGrams,
                sugars_g: ((ing.sugars_pct ?? 0) / 100) * newGrams,
                fat_g: ((ing.fat_pct ?? 0) / 100) * newGrams,
                msnf_g: ((ing.msnf_pct ?? 0) / 100) * newGrams,
                other_solids_g: ((ing.other_solids_pct ?? 0) / 100) * newGrams,
                total_solids_g:
                    (((ing.sugars_pct ?? 0) +
                        (ing.fat_pct ?? 0) +
                        (ing.msnf_pct ?? 0) +
                        (ing.other_solids_pct ?? 0)) /
                        100) *
                    newGrams,
            };
        });

        onApplyChanges(newRows);
        onOpenChange(false);
        setResult(null);
    }, [result, rows, onApplyChanges, onOpenChange]);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-lg overflow-y-auto" side="right">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-amber-500" />
                        Recipe Optimizer
                    </SheetTitle>
                    <SheetDescription>
                        Lock ingredients you want to preserve, set targets, then optimize.
                    </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                    {/* ─── INGREDIENT LOCKS ─── */}
                    <div>
                        <Label className="text-sm font-semibold mb-3 block">
                            Ingredients ({validRows.length})
                        </Label>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {validRows.map((r) => {
                                const id = r.ingredientData!.id;
                                const isLocked = lockedIds.has(id);
                                return (
                                    <div
                                        key={id}
                                        className={cn(
                                            'flex items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors',
                                            isLocked
                                                ? 'bg-muted/60 border-muted-foreground/20'
                                                : 'bg-background border-border'
                                        )}
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <button
                                                onClick={() => toggleLock(id)}
                                                className="shrink-0"
                                                aria-label={isLocked ? 'Unlock' : 'Lock'}
                                            >
                                                {isLocked ? (
                                                    <Lock className="h-4 w-4 text-amber-500" />
                                                ) : (
                                                    <Unlock className="h-4 w-4 text-muted-foreground" />
                                                )}
                                            </button>
                                            <span className="truncate">{r.ingredient}</span>
                                        </div>
                                        <span className="text-xs text-muted-foreground tabular-nums">
                                            {r.quantity_g.toFixed(0)}g
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <Separator />

                    {/* ─── TARGET INPUTS ─── */}
                    <div>
                        <Label className="text-sm font-semibold mb-3 block">
                            Composition Targets (%)
                        </Label>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label htmlFor="opt-fat" className="text-xs text-muted-foreground">
                                    Fat %
                                </Label>
                                <Input
                                    id="opt-fat"
                                    type="number"
                                    step="0.5"
                                    value={targetFat}
                                    onChange={(e) => setTargetFat(e.target.value)}
                                    placeholder="e.g. 8.0"
                                />
                            </div>
                            <div>
                                <Label htmlFor="opt-msnf" className="text-xs text-muted-foreground">
                                    MSNF %
                                </Label>
                                <Input
                                    id="opt-msnf"
                                    type="number"
                                    step="0.5"
                                    value={targetMSNF}
                                    onChange={(e) => setTargetMSNF(e.target.value)}
                                    placeholder="e.g. 10.0"
                                />
                            </div>
                            <div>
                                <Label htmlFor="opt-sugars" className="text-xs text-muted-foreground">
                                    Sugars %
                                </Label>
                                <Input
                                    id="opt-sugars"
                                    type="number"
                                    step="0.5"
                                    value={targetSugars}
                                    onChange={(e) => setTargetSugars(e.target.value)}
                                    placeholder="e.g. 18.0"
                                />
                            </div>
                            <div>
                                <Label htmlFor="opt-ts" className="text-xs text-muted-foreground">
                                    Total Solids %
                                </Label>
                                <Input
                                    id="opt-ts"
                                    type="number"
                                    step="0.5"
                                    value={targetTS}
                                    onChange={(e) => setTargetTS(e.target.value)}
                                    placeholder="optional"
                                />
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* ─── OPTIMIZE BUTTON ─── */}
                    <Button
                        onClick={handleOptimize}
                        disabled={isRunning || validRows.length < 2}
                        className="w-full gap-2"
                        size="lg"
                    >
                        {isRunning ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Optimizing…
                            </>
                        ) : (
                            <>
                                <Sparkles className="h-4 w-4" />
                                ✨ Optimize
                            </>
                        )}
                    </Button>

                    {/* ─── RESULTS ─── */}
                    {result && (
                        <div className="space-y-4">
                            {/* Status badge */}
                            <div className="flex items-center gap-2">
                                {result.success ? (
                                    <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30">
                                        <Check className="h-3 w-3 mr-1" />
                                        {result.status}
                                    </Badge>
                                ) : (
                                    <Badge variant="destructive">
                                        <AlertTriangle className="h-3 w-3 mr-1" />
                                        {result.status}
                                    </Badge>
                                )}
                                <span className="text-xs text-muted-foreground">{result.message}</span>
                            </div>

                            {/* Metrics before/after */}
                            {result.metricsBefore && result.metricsAfter && (
                                <div className="rounded-md border p-3">
                                    <div className="text-xs font-semibold mb-2">Metrics Comparison</div>
                                    <div className="grid grid-cols-3 gap-1 text-xs">
                                        <div className="font-medium text-muted-foreground"></div>
                                        <div className="font-medium text-center">Before</div>
                                        <div className="font-medium text-center">After</div>

                                        <div>Fat %</div>
                                        <div className="text-center">{result.metricsBefore.fat_pct.toFixed(1)}</div>
                                        <div className="text-center font-semibold">{result.metricsAfter.fat_pct.toFixed(1)}</div>

                                        <div>MSNF %</div>
                                        <div className="text-center">{result.metricsBefore.msnf_pct.toFixed(1)}</div>
                                        <div className="text-center font-semibold">{result.metricsAfter.msnf_pct.toFixed(1)}</div>

                                        <div>Sugars %</div>
                                        <div className="text-center">{result.metricsBefore.totalSugars_pct.toFixed(1)}</div>
                                        <div className="text-center font-semibold">{result.metricsAfter.totalSugars_pct.toFixed(1)}</div>

                                        <div>T.Solids %</div>
                                        <div className="text-center">{result.metricsBefore.ts_pct.toFixed(1)}</div>
                                        <div className="text-center font-semibold">{result.metricsAfter.ts_pct.toFixed(1)}</div>
                                    </div>
                                </div>
                            )}

                            {/* Changes diff */}
                            {result.changes.length > 0 && (
                                <div className="rounded-md border p-3">
                                    <div className="text-xs font-semibold mb-2">
                                        Changes ({result.changes.length})
                                    </div>
                                    <div className="space-y-1">
                                        {result.changes.map((c) => (
                                            <div key={c.id} className="flex items-center text-xs gap-2">
                                                <span className="truncate flex-1">{c.name}</span>
                                                <span className="tabular-nums text-muted-foreground">
                                                    {c.oldMass.toFixed(0)}g
                                                </span>
                                                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                                <span className="tabular-nums font-semibold">
                                                    {c.newMass.toFixed(0)}g
                                                </span>
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        'text-[10px] px-1.5 py-0',
                                                        c.delta > 0
                                                            ? 'text-green-600 border-green-300'
                                                            : 'text-red-600 border-red-300'
                                                    )}
                                                >
                                                    {c.delta > 0 ? '+' : ''}
                                                    {c.delta.toFixed(0)}g
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Apply button */}
                            {result.success && (
                                <Button onClick={handleApply} className="w-full gap-2" variant="default">
                                    <Check className="h-4 w-4" />
                                    Apply Changes
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
