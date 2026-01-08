import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Calculator, Download, Loader2, Plus, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Papa from 'papaparse';

interface Recipe {
  id: string;
  recipe_name: string;
  recipe_rows: Array<{
    ingredient: string;
    quantity_g: number;
  }>;
}

interface RecipeAllocation {
  recipe: Recipe;
  batches: number;
}

export default function ProductionPlanner() {
  const { toast } = useToast();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [allocations, setAllocations] = useState<RecipeAllocation[]>([]);
  const [totalLiters, setTotalLiters] = useState(100);
  const [wasteFactor, setWasteFactor] = useState(5);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
      
      if (session) {
        loadRecipes();
      }
    };
    checkAuth();
  }, []);

  const loadRecipes = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('recipes')
        .select(`
          id,
          recipe_name,
          recipe_rows (
            ingredient,
            quantity_g
          )
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setRecipes(data as Recipe[] || []);
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

  const addAllocation = (recipe: Recipe) => {
    if (allocations.find(a => a.recipe.id === recipe.id)) {
      toast({
        title: 'Recipe already added',
        description: 'This recipe is already in the production plan',
        variant: 'destructive'
      });
      return;
    }

    setAllocations([...allocations, { recipe, batches: 1 }]);
  };

  const updateBatches = (recipeId: string, batches: number) => {
    setAllocations(allocations.map(a =>
      a.recipe.id === recipeId ? { ...a, batches: Math.max(1, batches) } : a
    ));
  };

  const removeAllocation = (recipeId: string) => {
    setAllocations(allocations.filter(a => a.recipe.id !== recipeId));
  };

  const calculateProcurement = () => {
    const ingredientTotals: { [key: string]: number } = {};

    allocations.forEach(({ recipe, batches }) => {
      recipe.recipe_rows.forEach(row => {
        const key = row.ingredient;
        const amount = row.quantity_g * batches;
        ingredientTotals[key] = (ingredientTotals[key] || 0) + amount;
      });
    });

    // Apply waste factor
    const wasteMultiplier = 1 + (wasteFactor / 100);
    Object.keys(ingredientTotals).forEach(key => {
      ingredientTotals[key] *= wasteMultiplier;
    });

    return ingredientTotals;
  };

  const exportProcurementList = () => {
    const procurement = calculateProcurement();
    
    const data = Object.entries(procurement).map(([ingredient, amount]) => ({
      'Ingredient': ingredient,
      'Total Amount (g)': amount.toFixed(0),
      'Total Amount (kg)': (amount / 1000).toFixed(2)
    }));

    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `procurement-list-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();

    toast({
      title: 'Export Complete',
      description: 'Procurement list downloaded'
    });
  };

  const procurement = calculateProcurement();
  const totalIngredients = Object.keys(procurement).length;
  const totalWeight = Object.values(procurement).reduce((sum, val) => sum + val, 0);

  return (
    <div className="space-y-6">
      {!isAuthenticated && (
        <Alert>
          <AlertDescription>
            Please <a href="/auth" className="font-medium underline">sign in</a> to use production planner
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{allocations.length}</div>
            <p className="text-xs text-muted-foreground">Recipes Selected</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalIngredients}</div>
            <p className="text-xs text-muted-foreground">Total Ingredients</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{(totalWeight / 1000).toFixed(1)}kg</div>
            <p className="text-xs text-muted-foreground">Total Weight</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Available Recipes</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : recipes.length === 0 ? (
              <Alert>
                <AlertDescription>
                  No recipes available. Import or create recipes first.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {recipes.map(recipe => (
                  <div
                    key={recipe.id}
                    className="flex items-center justify-between p-2 border rounded hover:bg-accent"
                  >
                    <div>
                      <p className="font-medium">{recipe.recipe_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {recipe.recipe_rows?.length || 0} ingredients
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => addAllocation(recipe)}
                      disabled={allocations.some(a => a.recipe.id === recipe.id)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Production Plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Target Production (L)</Label>
                <Input
                  type="number"
                  value={totalLiters}
                  onChange={(e) => setTotalLiters(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label>Waste Factor (%)</Label>
                <Input
                  type="number"
                  value={wasteFactor}
                  onChange={(e) => setWasteFactor(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="space-y-2">
              {allocations.map(({ recipe, batches }) => (
                <div key={recipe.id} className="flex items-center gap-2 p-2 border rounded">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{recipe.recipe_name}</p>
                  </div>
                  <Input
                    type="number"
                    value={batches}
                    onChange={(e) => updateBatches(recipe.id, parseInt(e.target.value) || 1)}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">batches</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeAllocation(recipe.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            {allocations.length === 0 && (
              <Alert>
                <AlertDescription>
                  Add recipes from the list to create a production plan
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      {allocations.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Procurement List</CardTitle>
              <Button onClick={exportProcurementList} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ingredient</TableHead>
                  <TableHead>Amount (g)</TableHead>
                  <TableHead>Amount (kg)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(procurement).map(([ingredient, amount]) => (
                  <TableRow key={ingredient}>
                    <TableCell className="font-medium">{ingredient}</TableCell>
                    <TableCell>{amount.toFixed(0)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{(amount / 1000).toFixed(2)} kg</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
