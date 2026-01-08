import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Search, Loader2, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Recipe {
  id: string;
  recipe_name: string;
  product_type: string;
  created_at: string;
  recipe_rows: Array<{
    ingredient: string;
    quantity_g: number;
    sugars_g: number;
    fat_g: number;
    msnf_g: number;
  }>;
  calculated_metrics: {
    sp: number;
    pac: number;
    fat_pct: number;
    sugars_pct: number;
    total_quantity_g: number;
  }[];
}

interface RecipeBrowserDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoad?: (recipe: Recipe) => void;
}

export function RecipeBrowserDrawer({
  open,
  onOpenChange,
  onLoad
}: RecipeBrowserDrawerProps) {
  const { toast } = useToast();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (open && isAuthenticated) {
      loadRecipes();
    }
  }, [open, isAuthenticated]);

  const loadRecipes = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('recipes')
        .select(`
          id,
          recipe_name,
          product_type,
          created_at,
          recipe_rows (
            ingredient,
            quantity_g,
            sugars_g,
            fat_g,
            msnf_g
          ),
          calculated_metrics (
            sp,
            pac,
            fat_pct,
            sugars_pct,
            total_quantity_g
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setRecipes(data as any || []);
    } catch (error: any) {
      toast({
        title: 'Failed to load recipes',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteRecipe = async (recipeId: string) => {
    try {
      // CASCADE DELETE will automatically clean up related data (recipe_rows, calculated_metrics, recipe_outcomes)
      const { error } = await supabase.from('recipes').delete().eq('id', recipeId);
      
      if (error) throw error;
      
      toast({
        title: 'Recipe deleted',
        description: 'Recipe has been removed'
      });
      
      loadRecipes();
    } catch (error: any) {
      toast({
        title: 'Delete failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const filteredRecipes = recipes.filter(recipe =>
    recipe.recipe_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Recipe Browser</SheetTitle>
        </SheetHeader>
        
        {!isAuthenticated ? (
          <Alert className="mt-4">
            <AlertDescription>
              Please <a href="/auth" className="font-medium underline">sign in</a> to view your recipes
            </AlertDescription>
          </Alert>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search recipes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {isLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : filteredRecipes.length === 0 ? (
              <Alert>
                <AlertDescription>
                  No recipes found. Import recipes or create new ones to get started.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                {filteredRecipes.map((recipe) => (
                  <Card key={recipe.id} className="hover:bg-accent cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold">{recipe.recipe_name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {new Date(recipe.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant="outline">{recipe.product_type}</Badge>
                          {recipe.calculated_metrics?.[0] && (
                            <Badge>SP: {recipe.calculated_metrics[0].sp.toFixed(1)}</Badge>
                          )}
                        </div>
                      </div>

                      <div className="mb-3">
                        <p className="text-sm text-muted-foreground mb-1">
                          {recipe.recipe_rows?.length || 0} ingredients
                        </p>
                        {recipe.calculated_metrics?.[0] && (
                          <div className="flex gap-2 text-xs">
                            <span>Fat: {recipe.calculated_metrics[0].fat_pct.toFixed(1)}%</span>
                            <span>Sugars: {recipe.calculated_metrics[0].sugars_pct.toFixed(1)}%</span>
                            <span>Total: {recipe.calculated_metrics[0].total_quantity_g.toFixed(0)}g</span>
                          </div>
                        )}
                      </div>

                      {selectedRecipe?.id === recipe.id && (
                        <div className="mt-3 border-t pt-3">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Ingredient</TableHead>
                                <TableHead>Qty (g)</TableHead>
                                <TableHead>Sugars (g)</TableHead>
                                <TableHead>Fat (g)</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {recipe.recipe_rows?.slice(0, 5).map((row, idx) => (
                                <TableRow key={idx}>
                                  <TableCell className="text-sm">{row.ingredient}</TableCell>
                                  <TableCell className="text-sm">{row.quantity_g}</TableCell>
                                  <TableCell className="text-sm">{row.sugars_g}</TableCell>
                                  <TableCell className="text-sm">{row.fat_g}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}

                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedRecipe(
                            selectedRecipe?.id === recipe.id ? null : recipe
                          )}
                        >
                          {selectedRecipe?.id === recipe.id ? 'Hide Details' : 'View Details'}
                        </Button>
                        {onLoad && (
                          <Button
                            size="sm"
                            onClick={() => {
                              onLoad(recipe);
                              onOpenChange(false);
                            }}
                          >
                            Load Recipe
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteRecipe(recipe.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
