import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { recipeService } from '@/services/recipeService';
import { useBasePlannerStore, AllocationRow } from '@/store/useBasePlannerStore';
import { toast } from "sonner";
import { useIngredients } from '@/contexts/IngredientsContext';

export const AvailableRecipesPanel = () => {
    const { rows, addRecipeRow } = useBasePlannerStore();
    const { ingredients, isLoading: ingredientsLoading } = useIngredients();

    const { data: savedRecipes, isLoading } = useQuery({
        queryKey: ['savedRecipes'],
        queryFn: () => recipeService.getRecipes(),
    });

    const handleAddRecipe = async (recipe: any) => {
        try {
            // Check if already added
            if (rows.some(r => r.recipeId === recipe.id)) {
                toast.warning("Recipe already added to the plan.");
                return;
            }

            // Fetch full details (ingredients needed for mass calc)
            // Note: The list item might not have full rows. 
            // Better to fetch full details to be safe, or if the list item has it, use it.
            // Assuming we need to fetch full details like in the original code.
            const fullRecipe = await recipeService.getRecipeById(recipe.id);
            if (!fullRecipe || !fullRecipe.rows) {
                toast.error("Could not load recipe details.");
                return;
            }

            // Calculate total mass
            const totalMassG = fullRecipe.rows.reduce((sum: number, r: any) => sum + r.quantity_g, 0);

            // Map rows to ProductionIngredient format
            const recipeItems = fullRecipe.rows.map((r: any) => {
                // Try exact match first
                let match = ingredients.find(i => i.name === r.ingredient);

                // Try case-insensitive trim match if not found
                if (!match) {
                    const normalizedRowName = r.ingredient.toLowerCase().trim();
                    match = ingredients.find(i => i.name.toLowerCase().trim() === normalizedRowName);
                }

                return {
                    ingredientId: match?.id || r.ingredient,
                    name: r.ingredient,
                    massGrams: r.quantity_g
                };
            });

            const newRow: AllocationRow = {
                id: crypto.randomUUID(),
                recipeId: fullRecipe.id,
                recipeName: fullRecipe.recipe_name,
                recipeItems,
                recipeTotalMassG: totalMassG,
                allocationPct: 0,
                skuSize: 0.5,
                overrun: 30,
                loss: 5,
                density: 1.1
            };

            addRecipeRow(newRow);
            toast.success(`Added ${fullRecipe.recipe_name}`);

        } catch (err) {
            console.error(err);
            toast.error("Failed to add recipe.");
        }
    };

    return (
        <Card className="h-full border-none shadow-sm bg-white dark:bg-slate-950">
            <CardHeader className="pb-3 border-b">
                <CardTitle className="text-lg font-semibold">Available Recipes</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 px-4 overflow-y-auto max-h-[600px]">
                {isLoading ? (
                    <div className="text-sm text-muted-foreground p-4 text-center">Loading recipes...</div>
                ) : (
                    <div className="space-y-3">
                        {savedRecipes?.map((recipe) => {
                            const isAdded = rows.some(r => r.recipeId === recipe.id);
                            return (
                                <div key={recipe.id} className="group flex items-center justify-between p-3 rounded-lg border hover:border-blue-500 hover:shadow-md transition-all bg-card">
                                    <div className="flex flex-col">
                                        <span className="font-medium text-sm">{recipe.recipe_name}</span>
                                        {/* <span className="text-xs text-muted-foreground">{recipe.rows?.length || 0} ingredients</span> */}
                                    </div>
                                    <Button
                                        size="icon"
                                        variant={isAdded ? "secondary" : "default"}
                                        className={`h-8 w-8 ${isAdded ? 'opacity-50' : 'opacity-100'}`}
                                        disabled={isAdded || ingredientsLoading || ingredients.length === 0}
                                        onClick={() => handleAddRecipe(recipe)}
                                    >
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                            );
                        })}
                        {savedRecipes?.length === 0 && (
                            <div className="text-sm text-muted-foreground text-center py-8">No recipes found.</div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
