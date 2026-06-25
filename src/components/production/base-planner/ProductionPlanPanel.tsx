import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBasePlannerStore } from '@/store/useBasePlannerStore';
import { useIngredients } from '@/contexts/IngredientsContext';
import { recipeService } from '@/services/recipeService';
import { AllocationRow } from './AllocationRow';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const ProductionPlanPanel = () => {
    const { ingredients } = useIngredients();
    const {
        baseIngredientId,
        totalBaseMassKg,
        rows,
        setBaseIngredientId,
        setTotalBaseMassKg,
        reset
    } = useBasePlannerStore();
    const [totalMassStr, setTotalMassStr] = React.useState<string | null>(null);

    // PHASE 9.2: "base" means a saved recipe flagged is_base_recipe=true,
    // not an arbitrary ingredient. The engine still matches by ingredientId
    // within each allocated recipe's rows, so the selected base recipe is
    // resolved to its corresponding ingredients-table entry by name (the
    // same name-matching pattern AvailableRecipesPanel.tsx already uses).
    const { data: savedRecipes } = useQuery({
        queryKey: ['savedRecipes'],
        queryFn: () => recipeService.getRecipes(),
    });

    const baseRecipeOptions = useMemo(() => {
        const baseRecipes = (savedRecipes || []).filter((r: any) => r.is_base_recipe);
        return baseRecipes
            .map((r: any) => {
                const matchedIngredient = ingredients.find(
                    i => i.name.toLowerCase().trim() === r.recipe_name.toLowerCase().trim()
                );
                return matchedIngredient ? { recipeName: r.recipe_name, ingredientId: matchedIngredient.id } : null;
            })
            .filter((o): o is { recipeName: string; ingredientId: string } => o !== null);
    }, [savedRecipes, ingredients]);

    const unmatchedBaseRecipeCount = (savedRecipes || []).filter((r: any) => r.is_base_recipe).length - baseRecipeOptions.length;

    // Compute active base usage for warning
    const totalAllocatedPct = useMemo(() =>
        rows.reduce((sum, row) => sum + row.allocationPct, 0),
        [rows]
    );

    const isOverAllocated = totalAllocatedPct > 100;
    const remainingPct = 100 - totalAllocatedPct;

    return (
        <Card className="h-full border-none shadow-sm bg-white dark:bg-slate-950">
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
                <CardTitle className="text-lg font-semibold">Production Plan</CardTitle>
                {rows.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={reset} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                        <Trash2 className="w-4 h-4 mr-2" />
                       Clear Plan
                    </Button>
                )}
            </CardHeader>
            <CardContent className="space-y-6 pt-6">

                {/* 1. Configuration Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Base Selection (Context) */}
                    <div className="space-y-2">
                        <Label className="text-xs uppercase text-muted-foreground font-semibold">Base Recipe</Label>
                        <Select value={baseIngredientId} onValueChange={setBaseIngredientId}>
                            <SelectTrigger className="bg-slate-50 dark:bg-slate-900 border-slate-200">
                                <SelectValue placeholder="Select a saved base recipe..." />
                            </SelectTrigger>
                            <SelectContent>
                                {baseRecipeOptions.map(opt => (
                                    <SelectItem key={opt.ingredientId} value={opt.ingredientId}>{opt.recipeName}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {baseRecipeOptions.length === 0 && (
                            <p className="text-xs text-muted-foreground">
                                No base recipes available. Mark a recipe as "Base recipe" in the Recipe Browser first.
                            </p>
                        )}
                        {unmatchedBaseRecipeCount > 0 && (
                            <p className="text-xs text-amber-600">
                                {unmatchedBaseRecipeCount} base recipe{unmatchedBaseRecipeCount > 1 ? 's' : ''} hidden — no matching ingredient entry with the same name exists yet.
                            </p>
                        )}
                    </div>

                    {/* Total Mass Input */}
                    <div className="space-y-2">
                        <Label className="text-xs uppercase text-muted-foreground font-semibold">Total Base Mass (kg)</Label>
                        <div className="relative">
                            <Input
                                type="number"
                                min={0}
                                value={totalMassStr !== null ? totalMassStr : (totalBaseMassKg || '')}
                                onChange={e => {
                                    let v = e.target.value;
                                    if (v.length > 1 && v.startsWith('0') && v[1] !== '.') v = v.replace(/^0+/, '');
                                    setTotalMassStr(v);
                                    const parsed = parseFloat(v);
                                    if (!isNaN(parsed)) setTotalBaseMassKg(parsed);
                                }}
                                onBlur={() => setTotalMassStr(null)}
                                className="pl-3 pr-10 font-mono text-lg bg-slate-50 dark:bg-slate-900 border-slate-200"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">kg</span>
                        </div>
                    </div>
                </div>

                {/* 2. Allocation Status / Warnings */}
                {isOverAllocated && (
                    <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-md font-medium">
                       Warning: Allocations exceed 100% ({totalAllocatedPct.toFixed(1)}%)
                    </div>
                )}
                {!isOverAllocated && totalAllocatedPct < 100 && rows.length > 0 && (
                    <div className="text-sm text-blue-600 bg-blue-50 border border-blue-200 p-3 rounded-md font-medium">
                        {remainingPct.toFixed(1)}% Base Capacity Remaining
                    </div>
                )}

                {/* 3. The List of Rows */}
                <div className="space-y-4">
                    <Label className="text-xs uppercase text-muted-foreground font-semibold">Allocations</Label>

                    {rows.length === 0 ? (
                        <div className="border-2 border-dashed rounded-xl p-8 text-center text-muted-foreground bg-slate-50 dark:bg-slate-900/50">
                           Select recipes from the left panel to start planning.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {rows.map(row => (
                                <AllocationRow key={row.id} row={row} />
                            ))}
                        </div>
                    )}
                </div>

            </CardContent>
        </Card>
    );
};
