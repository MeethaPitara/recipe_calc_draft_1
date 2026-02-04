import React, { useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { useBasePlannerStore } from '@/store/useBasePlannerStore';

export const TopStatsBar = () => {
    const { rows, engineOutput } = useBasePlannerStore();

    // 1. Recipes Selected
    const recipesCount = rows.length;

    // 2. Total Ingredients (Unique Procurement Items)
    // We get this from engineOutput -> rows -> complementaryIngredients
    // This requires a valid calculation first.
    // Or we can just sum up from the inputs if engineOutput is null. 
    // But procurement suggests "what we need to buy".
    // Let's rely on engineOutput for accuracy, or calculate distinct from inputs if null.

    const uniqueIngredientsCount = useMemo(() => {
        if (!engineOutput) return 0;
        const allIngredients = new Set<string>();
        engineOutput.rows.forEach(r => {
            r.complementaryIngredients.forEach(i => allIngredients.add(i.ingredientId));
        });
        return allIngredients.size;
    }, [engineOutput]);

    // 3. Total Weight / Output
    const totalOutputUnits = useMemo(() => {
        if (!engineOutput) return 0;
        return engineOutput.rows.reduce((sum, r) => sum + r.producedUnits, 0);
    }, [engineOutput]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-white dark:bg-slate-950 shadow-sm border-none">
                <CardContent className="p-6">
                    <p className="text-4xl font-bold tracking-tight">{recipesCount}</p>
                    <p className="text-sm font-medium text-muted-foreground mt-1">Recipes Selected</p>
                </CardContent>
            </Card>

            <Card className="bg-white dark:bg-slate-950 shadow-sm border-none">
                <CardContent className="p-6">
                    <p className="text-4xl font-bold tracking-tight">{uniqueIngredientsCount}</p>
                    <p className="text-sm font-medium text-muted-foreground mt-1">Total Ingredients to Add</p>
                </CardContent>
            </Card>

            <Card className="bg-white dark:bg-slate-950 shadow-sm border-none">
                <CardContent className="p-6">
                    <p className="text-4xl font-bold tracking-tight">{totalOutputUnits}</p>
                    <p className="text-sm font-medium text-muted-foreground mt-1">Total Units Produced</p>
                </CardContent>
            </Card>
        </div>
    );
};
