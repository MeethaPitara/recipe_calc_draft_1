
import React, { useEffect, useState } from 'react';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { recipeService } from "@/services/recipeService";
import { supabase } from "@/integrations/supabase/client";
import { Trash2, Loader2, BookOpen } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface RecipeLibraryProps {
    isOpen: boolean;
    onClose: () => void;
    onLoadRecipe: (recipeId: string) => Promise<void>;
}

interface RecipeListItem {
    id: string;
    recipe_name: string;
    product_type: string;
    updated_at: string;
}

export function RecipeLibrary({ isOpen, onClose, onLoadRecipe }: RecipeLibraryProps) {
    const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        // Check auth status on mount/open
        const checkAuth = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setIsAuthenticated(!!user);
            if (user && isOpen) {
                fetchRecipes();
            }
        };
        checkAuth();
    }, [isOpen]);

    const fetchRecipes = async () => {
        setIsLoading(true);
        try {
            const data = await recipeService.getRecipes();
            setRecipes(data as RecipeListItem[]);
        } catch (error) {
            console.error("Failed to fetch recipes:", error);
            toast({
                title: "Error",
                description: "Failed to load your recipes.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent triggering load
        if (!confirm("Are you sure you want to delete this recipe?")) return;

        try {
            await recipeService.deleteRecipe(id);
            setRecipes((prev) => prev.filter((r) => r.id !== id));
            toast({
                title: "Deleted",
                description: "Recipe deleted successfully.",
            });
        } catch (error) {
            console.error("Delete failed:", error);
            toast({
                title: "Error",
                description: "Failed to delete recipe.",
                variant: "destructive",
            });
        }
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="left" className="w-[400px] sm:w-[540px]">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5" />
                        Recipe Library
                    </SheetTitle>
                    <SheetDescription>
                        manage your saved recipes.
                    </SheetDescription>
                </SheetHeader>

                <div className="mt-8 h-full">
                    {!isAuthenticated ? (
                        <div className="flex flex-col items-center justify-center gap-4 py-12 text-center text-muted-foreground">
                            <p>Please log in to save and access your recipes.</p>
                            <Button onClick={() => window.location.reload()} variant="outline">
                                Refresh Login Status
                            </Button>
                        </div>
                    ) : isLoading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : recipes.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            No recipes saved yet.
                        </div>
                    ) : (
                        <ScrollArea className="h-[calc(100vh-200px)] pr-4">
                            <div className="space-y-3">
                                {recipes.map((recipe) => (
                                    <div
                                        key={recipe.id}
                                        onClick={() => {
                                            onLoadRecipe(recipe.id);
                                            onClose();
                                        }}
                                        className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors group"
                                    >
                                        <div className="space-y-1">
                                            <h3 className="font-semibold leading-none tracking-tight">
                                                {recipe.recipe_name}
                                            </h3>
                                            <p className="text-sm text-muted-foreground">
                                                {recipe.product_type} • {format(new Date(recipe.updated_at), 'MMM d, yyyy')}
                                            </p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={(e) => handleDelete(recipe.id, e)}
                                        >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
