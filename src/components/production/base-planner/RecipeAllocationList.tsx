
import React from 'react';
import { Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useQuery } from '@tanstack/react-query';
import { recipeService } from '@/services/recipeService';
import { useIngredients } from '@/contexts/IngredientsContext';
import { useBasePlannerStore, AllocationRow as IAllocationRow } from '@/store/useBasePlannerStore';
import { AllocationRow } from './AllocationRow';
import { toast } from "sonner";

export const RecipeAllocationList = () => {
    const { ingredients } = useIngredients();
    const { rows, addRecipeRow } = useBasePlannerStore();

    const { data: savedRecipes, isLoading: isLoadingRecipes } = useQuery({
        queryKey: ['savedRecipes'],
        queryFn: () => recipeService.getRecipes(),
    });

    const handleAddRecipe = async (recipeId: string) => {
        try {
            if (!recipeId) return;

            // Check if already added
            if (rows.some(r => r.recipeId === recipeId)) {
                toast.warning("Recipe already added to the plan.");
                return;
            }

            // Fetch full details
            const fullRecipe = await recipeService.getRecipeById(recipeId);
            if (!fullRecipe || !fullRecipe.rows) {
                toast.error("Could not load recipe details.", { description: "Recipe may rely on deleted ingredients or has no rows." });
                return;
            }

            // Calculate total mass
            const totalMassG = fullRecipe.rows.reduce((sum: number, r: any) => sum + r.quantity_g, 0);

            // Map rows to ProductionIngredient format (needs ID)
            const recipeItems = fullRecipe.rows.map((r: any) => ({
                id: ingredients.find(i => i.name === r.ingredient)?.id || r.ingredient,
                name: r.ingredient,
                quantity: r.quantity_g
            }));

            const newRow: IAllocationRow = {
                id: crypto.randomUUID(),
                recipeId: fullRecipe.id,
                recipeName: fullRecipe.recipe_name,
                recipeItems,
                recipeTotalMassG: totalMassG,
                allocationPct: 0, // Start at 0
                skuSize: 0.5,     // Default 500ml
                overrun: 30,      // Default 30%
                loss: 5,          // Default 5%
                density: 1.1      // Default
            };

            addRecipeRow(newRow);
            toast.success(`Added ${fullRecipe.recipe_name}`);

        } catch (err) {
            console.error(err);
            toast.error("Failed to add recipe.");
        }
    };

    return (
        <Card className="shadow-sm min-h-[500px]">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                    <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">📊</div>
                    Demand Grid
                </CardTitle>
                <div className="flex items-center gap-2">
                    <Select onValueChange={handleAddRecipe}>
                        <SelectTrigger className="w-[180px] border-dashed border-2 bg-muted/20 hover:bg-muted/40">
                            <Plus className="w-4 h-4 mr-2" />
                            <SelectValue placeholder="Add Recipe" />
                        </SelectTrigger>
                        <SelectContent>
                            {isLoadingRecipes ? (
                                <SelectItem value="loading" disabled>Loading...</SelectItem>
                            ) : (
                                savedRecipes?.map(r => (
                                    <SelectItem key={r.id} value={r.id}>{r.recipe_name}</SelectItem>
                                ))
                            )}
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent>
                {rows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center border-2 border-dashed rounded-xl bg-slate-50 dark:bg-slate-900/50">
                        <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
                            <Plus className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-medium">No Recipes Allocated</h3>
                        <p className="text-sm text-muted-foreground max-w-sm mt-1">
                            Add a recipe from the top right to start planning your production batch.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {rows.map((row) => (
                            <AllocationRow key={row.id} row={row} />
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
