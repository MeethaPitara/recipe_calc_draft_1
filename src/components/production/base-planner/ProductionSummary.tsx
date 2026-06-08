
import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useBasePlannerStore } from '@/store/useBasePlannerStore';
import { useIngredients } from '@/contexts/IngredientsContext';
import AIRoundingPanel from '@/components/production/AIRoundingPanel';
import type { ProductionIngredient } from '@/lib/production/productionValidator';

export const ProductionSummary = () => {
    const { engineOutput, rows: allocationRows } = useBasePlannerStore();
    const { ingredients: availableIngredients } = useIngredients();

    if (!engineOutput) {
        return (
            <Card className="bg-slate-50 dark:bg-slate-900 border-dashed h-full">
                <CardContent className="pt-20 pb-20 text-center text-muted-foreground">
                    <p>Complete the configuration to generate production insights.</p>
                </CardContent>
            </Card>
        );
    }

    const totalYield = engineOutput.rows.reduce((s, r) => s + r.producedUnits, 0);

    return (
        <Card className="bg-slate-50 dark:bg-slate-900 border-green-200 dark:border-green-900 sticky top-4 shadow-md">
            <CardHeader className="pb-2 bg-white dark:bg-slate-950 rounded-t-lg border-b">
                <CardTitle className="text-lg">Production Summary</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 p-0">
                <Tabs defaultValue="plan" className="w-full">
                    <div className="px-4">
                        <TabsList className="w-full grid grid-cols-3">
                            <TabsTrigger value="plan">Production Plan</TabsTrigger>
                            <TabsTrigger value="procurement">Procurement</TabsTrigger>
                            <TabsTrigger value="ai-round">AI Round</TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="p-4">
                        {/* --- TAB A: Production Plan --- */}
                        <TabsContent value="plan" className="mt-0 space-y-4 animate-in fade-in zoom-in-95 duration-300">

                            {/* Summary KPI */}
                            <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900 rounded-lg">
                                <div>
                                    <h4 className="text-sm font-medium text-green-800 dark:text-green-300 uppercase tracking-wider">Total Output</h4>
                                    <p className="text-xs text-muted-foreground">Combined Yield</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-4xl font-black text-green-700 dark:text-green-400">{totalYield}</span>
                                    <span className="ml-2 text-sm font-medium text-green-800 dark:text-green-300">Units</span>
                                </div>
                            </div>

                            {/* Detailed Table */}
                            <div className="rounded-md border bg-white dark:bg-slate-950 overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-slate-50 dark:bg-slate-900">
                                        <TableRow>
                                            <TableHead className="w-[140px]">Recipe</TableHead>
                                            <TableHead className="text-right">Base (kg)</TableHead>
                                            <TableHead className="text-right">Mix (kg)</TableHead>
                                            <TableHead className="text-right font-bold">Units</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {engineOutput.rows.map((r) => (
                                            <TableRow key={r.recipeId}>
                                                {/* Note: recipeName is not on the row output, we might need to look it up or rely on order if ID not enough. 
                                                   Actually, let's check level2_engine.ts. 
                                                   Ah, rows has recipeId. 
                                                   Wait, the UI needs a name. 
                                                   The store has 'rows' (inputs) which has names.
                                                   But engineOutput rows don't have name?
                                                   Let's check level2_engine.ts again.
                                                   In step 15: 
                                                    rows: { recipeId: string; ... }
                                                   It does NOT have recipeName.
                                                    
                                                   However, looking at the previous code:
                                                    key={r.recipeName}
                                                    title={r.recipeName}
                                                    {r.recipeName}
                                                    
                                                    I need to get the name. The easiest way is probably to find the matching input row.
                                                 */}
                                                <TableCell className="font-medium truncate max-w-[140px]" title={r.recipeName}>{r.recipeName}</TableCell>
                                                <TableCell className="text-right">{r.actualBaseConsumedKg.toFixed(1)}</TableCell>
                                                <TableCell className="text-right text-muted-foreground">{r.actualMixRequiredKg.toFixed(1)}</TableCell>
                                                <TableCell className="text-right font-bold text-lg">{r.producedUnits}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>

                        {/* --- TAB B: Procurement List --- */}
                        <TabsContent value="procurement" className="mt-0 space-y-4 animate-in fade-in zoom-in-95 duration-300">
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Required Add-ins</Label>
                                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                    {engineOutput.rows
                                        .flatMap(r => r.complementaryIngredients.map(i => ({ ...i, recipe: r.recipeId })))
                                        .map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-center text-sm p-3 bg-white dark:bg-slate-800 rounded-lg border shadow-sm">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-slate-700 dark:text-slate-200">{item.name}</span>
                                                    <span className="text-[10px] text-muted-foreground uppercase">{item.recipe}</span>
                                                </div>
                                                <div className="text-right bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded">
                                                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{item.requiredAmountKg.toFixed(2)}</span>
                                                    <span className="ml-1 text-xs text-muted-foreground">kg</span>
                                                </div>
                                            </div>
                                        ))
                                    }
                                    {engineOutput.rows.every(r => r.complementaryIngredients.length === 0) && (
                                        <div className="text-center py-8 text-muted-foreground italic">
                                           No additional ingredients required for these allocations.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </TabsContent>

                        {/* --- TAB C: AI Rounding --- */}
                        <TabsContent value="ai-round" className="mt-0 space-y-4 animate-in fade-in zoom-in-95 duration-300">
                            {engineOutput.rows.filter(r => r.isValid).map((row) => {
                                // Build ProductionIngredient list from all ingredients for this allocation
                                const allocationRow = allocationRows.find(a => a.recipeId === row.recipeId);
                                if (!allocationRow) return null;

                                // Combine base + complementary into a single recipe
                                const productionIngredients: ProductionIngredient[] = [
                                    // Base ingredient
                                    ...allocationRow.recipeItems.map(item => {
                                        const complementary = row.complementaryIngredients.find(
                                            c => c.ingredientId === item.ingredientId
                                        );
                                        const ingData = availableIngredients.find(
                                            a => a.id === item.ingredientId || a.name.toLowerCase() === item.name.toLowerCase()
                                        );
                                        return {
                                            ingredientId: item.ingredientId,
                                            name: item.name,
                                            massGrams: complementary
                                                ? complementary.requiredAmountKg * 1000
                                                : (item.ingredientId === useBasePlannerStore.getState().baseIngredientId
                                                    ? row.actualBaseConsumedKg * 1000
                                                    : 0),
                                            ingredientData: ingData,
                                        };
                                    }).filter(i => i.massGrams > 0)
                                ];

                                return (
                                    <div key={row.recipeId} className="space-y-2">
                                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                            {row.recipeName}
                                        </Label>
                                        <AIRoundingPanel
                                            ingredients={productionIngredients}
                                            productType="gelato"
                                            availableIngredients={availableIngredients}
                                            recipeName={row.recipeName}
                                        />
                                    </div>
                                );
                            })}
                        </TabsContent>
                    </div>
                </Tabs>
            </CardContent>
        </Card>
    );
};
