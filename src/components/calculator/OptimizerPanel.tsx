/**
 * OptimizerPanel — slide-out Sheet for the Task 11 " Optimize" flow.
 *
 * Provides:
 *   1. Lock/Unlock checkboxes per ingredient
 *   2. Target inputs for Fat, MSNF, Sugars, Total Solids
 *   3. Run optimizer → show diff
 *   4. Apply changes back to the calculator
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Lock, Unlock, Sparkles, ArrowRight, Check, X, AlertTriangle, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { IngredientRow } from '@/types/calculator';
import type { IngredientData } from '@/types/ingredients';
import { runOptimizer, type OptimizerRequest, type OptimizerResult, type OptimizerChange } from '@/lib/optimizer/api';
import { getActiveParameters } from '@/services/productParametersService';
import { saveTargetProfile } from '@/services/targetProfilesService';

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
            if (r.ingredientData && (r.isLocked || shouldDefaultLock(r.ingredientData))) {
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
    const [targetPAC, setTargetPAC] = useState<string>('');
    const [targetPOD, setTargetPOD] = useState<string>('');
    const [maxCost, setMaxCost] = useState<string>('');
    const [fixedBatch, setFixedBatch] = useState<boolean>(true);

    // Optimizer state
    const [isRunning, setIsRunning] = useState(false);
    const [result, setResult] = useState<OptimizerResult | null>(null);
    
    // Advanced bounds
    const [minMaxBounds, setMinMaxBounds] = useState<Record<string, {min?: number, max?: number}>>({});
    
    // Sugar ratio
    const [sugarRatio, setSugarRatio] = useState<{primary?: string, secondary?: string, ratio: number}>({ratio: 70});

    // Populate from active profile constraint_defaults
    useEffect(() => {
        if (!open) return;
        const profile = getActiveParameters();
        
        // Defaults for bands
        const activeBands = profile.bands[productType as keyof typeof profile.bands] || profile.bands['gelato_finished'] || {
            fat: [8, 10], msnf: [9, 11], sugars: [16, 20], ts: [34, 40]
        };
        const avg = (r: [number, number]) => ((r[0] + r[1]) / 2).toFixed(1);
        setTargetFat(avg(activeBands.fat));
        setTargetMSNF(avg(activeBands.msnf));
        setTargetSugars(avg(activeBands.sugars));
        setTargetTS(avg(activeBands.ts));
        if (activeBands.pac) setTargetPAC(avg(activeBands.pac));
        if (activeBands.sp) setTargetPOD(avg(activeBands.sp));

        const cd = profile.constraint_defaults;
        if (cd) {
            if (cd.maxCostPerKgMix) setMaxCost(cd.maxCostPerKgMix.toString());
            if (cd.fixedBatchMassG !== undefined) setFixedBatch(cd.fixedBatchMassG);
            if (cd.bounds) {
                const bnds: Record<string, {min?: number, max?: number}> = {};
                cd.bounds.forEach((b: any) => {
                    bnds[b.ingredientId] = { min: b.minGrams, max: b.maxGrams };
                    if (b.isLocked) {
                        setLockedIds(prev => new Set([...prev, b.ingredientId]));
                    }
                });
                setMinMaxBounds(bnds);
            }
            if (cd.sugarRatios && cd.sugarRatios.length > 0) {
                setSugarRatio({
                    primary: cd.sugarRatios[0].primarySugarId,
                    secondary: cd.sugarRatios[0].secondarySugarId,
                    ratio: cd.sugarRatios[0].ratio
                });
            }
        }
    }, [open, productType]);

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
                pac: targetPAC ? parseFloat(targetPAC) : undefined,
                pod: targetPOD ? parseFloat(targetPOD) : undefined,
            },
            lockedIngredientIds: Array.from(lockedIds),
            freeIngredientIds: validRows
                .filter((r) => !lockedIds.has(r.ingredientData!.id))
                .map((r) => r.ingredientData!.id),
            mode: productType || 'gelato',
            constraints: {
                maxCostPerKgMix: maxCost ? parseFloat(maxCost) : undefined,
                fixedBatchMassG: fixedBatch ? validRows.reduce((s, r) => s + r.quantity_g, 0) : undefined,
                bounds: validRows.map(r => ({
                    ingredientId: r.ingredientData!.id,
                    isLocked: lockedIds.has(r.ingredientData!.id),
                    minGrams: minMaxBounds[r.ingredientData!.id]?.min,
                    maxGrams: minMaxBounds[r.ingredientData!.id]?.max
                })),
                sugarRatios: (sugarRatio.primary && sugarRatio.secondary) ? [{
                    primarySugarId: sugarRatio.primary,
                    secondarySugarId: sugarRatio.secondary,
                    ratio: sugarRatio.ratio
                }] : undefined
            }
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
    }, [validRows, lockedIds, targetFat, targetMSNF, targetSugars, targetTS, targetPAC, targetPOD, maxCost, fixedBatch, sugarRatio, minMaxBounds]);

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

    const handleSaveProfile = useCallback(async () => {
        const name = prompt("Enter a name for this custom profile:");
        if (!name) return;

        try {
            await saveTargetProfile(name, productType || 'gelato', {
                fat: [parseFloat(targetFat) || 8, parseFloat(targetFat) || 8],
                msnf: [parseFloat(targetMSNF) || 10, parseFloat(targetMSNF) || 10],
                sugars: [parseFloat(targetSugars) || 18, parseFloat(targetSugars) || 18],
                ts: [parseFloat(targetTS) || 36, parseFloat(targetTS) || 36],
                pac: targetPAC ? [parseFloat(targetPAC), parseFloat(targetPAC)] : undefined,
                sp: targetPOD ? [parseFloat(targetPOD), parseFloat(targetPOD)] : undefined
            }, {
                maxCostPerKgMix: maxCost ? parseFloat(maxCost) : undefined,
                fixedBatchMassG: fixedBatch,
                bounds: validRows.map(r => ({
                    ingredientId: r.ingredientData!.id,
                    isLocked: lockedIds.has(r.ingredientData!.id),
                    minGrams: minMaxBounds[r.ingredientData!.id]?.min,
                    maxGrams: minMaxBounds[r.ingredientData!.id]?.max
                })),
                sugarRatios: (sugarRatio.primary && sugarRatio.secondary) ? [{
                    primarySugarId: sugarRatio.primary,
                    secondarySugarId: sugarRatio.secondary,
                    ratio: sugarRatio.ratio
                }] : undefined
            });
            alert("Custom profile saved! It will now appear in your profile switcher.");
            window.location.reload();
        } catch (e: any) {
            alert(`Failed to save profile: ${e.message}`);
        }
    }, [productType, targetFat, targetMSNF, targetSugars, targetTS, maxCost, fixedBatch, validRows, lockedIds, minMaxBounds, sugarRatio]);

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
                    {/* ─── INGREDIENT LOCKS & BOUNDS ─── */}
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
                                        <div className="flex items-center gap-1">
                                            {!isLocked && (
                                                <div className="flex items-center gap-1 mr-2">
                                                    <Input 
                                                        type="number" 
                                                        placeholder="min" 
                                                        className="w-12 h-6 text-[10px] px-1" 
                                                        value={minMaxBounds[id]?.min ?? ''} 
                                                        onChange={e => setMinMaxBounds(prev => ({...prev, [id]: {...prev[id], min: e.target.value ? parseFloat(e.target.value) : undefined}}))} 
                                                    />
                                                    <span className="text-[10px]">-</span>
                                                    <Input 
                                                        type="number" 
                                                        placeholder="max" 
                                                        className="w-12 h-6 text-[10px] px-1" 
                                                        value={minMaxBounds[id]?.max ?? ''} 
                                                        onChange={e => setMinMaxBounds(prev => ({...prev, [id]: {...prev[id], max: e.target.value ? parseFloat(e.target.value) : undefined}}))} 
                                                    />
                                                </div>
                                            )}
                                            <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">
                                                {r.quantity_g.toFixed(0)}g
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <Separator />

                    {/* ─── SUGAR RATIO ─── */}
                    {validRows.filter(r => r.ingredientData?.category === 'sugar' || (r.ingredientData?.sugars_pct && r.ingredientData.sugars_pct > 50)).length >= 2 && (
                        <>
                            <div>
                                <Label className="text-sm font-semibold mb-3 block">
                                   Sugar Blend Ratio
                                </Label>
                                <div className="flex items-center gap-2">
                                    <select 
                                        className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs" 
                                        value={sugarRatio.primary || ''} 
                                        onChange={e => setSugarRatio(p => ({...p, primary: e.target.value}))}
                                    >
                                        <option value="">Primary Sugar...</option>
                                        {validRows.filter(r => r.ingredientData?.category === 'sugar' || (r.ingredientData?.sugars_pct && r.ingredientData.sugars_pct > 50)).map(s => (
                                            <option key={s.ingredientData!.id} value={s.ingredientData!.id}>{s.ingredient}</option>
                                        ))}
                                    </select>
                                    <Input 
                                        type="number" 
                                        className="w-16 h-8 text-xs text-center" 
                                        value={sugarRatio.ratio} 
                                        onChange={e => setSugarRatio(p => ({...p, ratio: parseFloat(e.target.value)}))} 
                                    />
                                    <span className="text-xs font-semibold">%</span>
                                    <select 
                                        className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs" 
                                        value={sugarRatio.secondary || ''} 
                                        onChange={e => setSugarRatio(p => ({...p, secondary: e.target.value}))}
                                    >
                                        <option value="">Secondary Sugar...</option>
                                        {validRows.filter(r => r.ingredientData?.category === 'sugar' || (r.ingredientData?.sugars_pct && r.ingredientData.sugars_pct > 50)).map(s => (
                                            <option key={s.ingredientData!.id} value={s.ingredientData!.id}>{s.ingredient}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <Separator />
                        </>
                    )}

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
                            <div>
                                <Label htmlFor="opt-pac" className="text-xs text-muted-foreground">
                                   PAC (AFP)
                                </Label>
                                <Input
                                    id="opt-pac"
                                    type="number"
                                    step="1"
                                    value={targetPAC}
                                    onChange={(e) => setTargetPAC(e.target.value)}
                                    placeholder="e.g. 25"
                                />
                            </div>
                            <div>
                                <Label htmlFor="opt-pod" className="text-xs text-muted-foreground">
                                   POD (Sweetness)
                                </Label>
                                <Input
                                    id="opt-pod"
                                    type="number"
                                    step="1"
                                    value={targetPOD}
                                    onChange={(e) => setTargetPOD(e.target.value)}
                                    placeholder="e.g. 15"
                                />
                            </div>
                        </div>
                    </div>
                    
                    <Separator />
                    
                    {/* ─── ADDITIONAL CONSTRAINTS ─── */}
                    <div>
                        <Label className="text-sm font-semibold mb-3 block">
                           Additional Constraints
                        </Label>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="opt-batch" className="text-sm font-medium">
                                   Maintain Fixed Batch Weight
                                </Label>
                                <Switch
                                    id="opt-batch"
                                    checked={fixedBatch}
                                    onCheckedChange={setFixedBatch}
                                />
                            </div>
                            <div>
                                <Label htmlFor="opt-cost" className="text-xs text-muted-foreground">
                                   Max Cost per Kg Mix (Optional)
                                </Label>
                                <Input
                                    id="opt-cost"
                                    type="number"
                                    step="10"
                                    value={maxCost}
                                    onChange={(e) => setMaxCost(e.target.value)}
                                    placeholder="e.g. 500"
                                />
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* ─── OPTIMIZE BUTTON ─── */}
                    <div className="flex gap-2">
                        <Button
                            onClick={handleOptimize}
                            disabled={isRunning || validRows.length < 2}
                            className="flex-1 gap-2"
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
                                    Optimize
                                </>
                            )}
                        </Button>
                        <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={handleSaveProfile} title="Save as Custom Profile">
                            <Save className="h-5 w-5" />
                        </Button>
                    </div>

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
