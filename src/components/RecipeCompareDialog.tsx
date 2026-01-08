import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface RecipeCompareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentRecipe: {
    name: string;
    rows: any[];
    metrics: any;
    productType: string;
  };
}

export function RecipeCompareDialog({
  open,
  onOpenChange,
  currentRecipe,
}: RecipeCompareDialogProps) {
  const [savedRecipes, setSavedRecipes] = useState<any[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>("");
  const [compareRecipe, setCompareRecipe] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadSavedRecipes();
    }
  }, [open]);

  const loadSavedRecipes = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: recipes, error } = await supabase
        .from('recipes')
        .select('id, recipe_name, product_type, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setSavedRecipes(recipes || []);
    } catch (error) {
      console.error('Error loading recipes:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecipeForComparison = async (recipeId: string) => {
    setLoading(true);
    try {
      // Load recipe rows
      const { data: rows, error: rowsError } = await supabase
        .from('recipe_rows')
        .select('*')
        .eq('recipe_id', recipeId);

      if (rowsError) throw rowsError;

      // Load metrics
      const { data: metrics, error: metricsError } = await supabase
        .from('calculated_metrics')
        .select('*')
        .eq('recipe_id', recipeId)
        .single();

      if (metricsError) throw metricsError;

      // Load recipe info
      const { data: recipe, error: recipeError } = await supabase
        .from('recipes')
        .select('*')
        .eq('id', recipeId)
        .single();

      if (recipeError) throw recipeError;

      setCompareRecipe({
        name: recipe.recipe_name,
        rows: rows || [],
        metrics: metrics ? {
          fat_pct: metrics.fat_pct,
          msnf_pct: metrics.msnf_pct,
          totalSugars_pct: metrics.sugars_pct,
          ts_pct: metrics.total_solids_pct,
          pac: metrics.pac,
          fpd: metrics.fpdt,
        } : null,
        productType: recipe.product_type,
      });
    } catch (error) {
      console.error('Error loading recipe:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderMetricDiff = (label: string, current: number, compare: number | undefined) => {
    if (compare === undefined) return null;
    
    const diff = current - compare;
    const absDiff = Math.abs(diff);
    
    let icon = <Minus className="h-4 w-4" />;
    let color = "text-muted-foreground";
    
    if (absDiff > 0.5) {
      if (diff > 0) {
        icon = <TrendingUp className="h-4 w-4" />;
        color = "text-green-600 dark:text-green-400";
      } else {
        icon = <TrendingDown className="h-4 w-4" />;
        color = "text-red-600 dark:text-red-400";
      }
    }
    
    return (
      <div className="flex items-center gap-2">
        <span className={cn("font-semibold", color)}>
          {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
        </span>
        <span className={color}>{icon}</span>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compare Recipes</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Recipe selector */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Select Recipe to Compare</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedRecipeId}
                onValueChange={(value) => {
                  setSelectedRecipeId(value);
                  loadRecipeForComparison(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a saved recipe..." />
                </SelectTrigger>
                <SelectContent>
                  {savedRecipes.map((recipe) => (
                    <SelectItem key={recipe.id} value={recipe.id}>
                      {recipe.recipe_name} ({recipe.product_type}) - {new Date(recipe.created_at).toLocaleDateString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {compareRecipe && (
            <>
              {/* Metrics comparison */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Core Metrics Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Current Recipe */}
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        {currentRecipe.name || 'Current Recipe'}
                        <Badge variant="default">Current</Badge>
                      </h3>
                      {currentRecipe.metrics && (
                        <div className="space-y-2">
                          <div className="flex justify-between py-2 border-b">
                            <span className="text-muted-foreground">Fat:</span>
                            <span className="font-semibold">{currentRecipe.metrics.fat_pct.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between py-2 border-b">
                            <span className="text-muted-foreground">MSNF:</span>
                            <span className="font-semibold">{currentRecipe.metrics.msnf_pct.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between py-2 border-b">
                            <span className="text-muted-foreground">Sugar:</span>
                            <span className="font-semibold">{currentRecipe.metrics.totalSugars_pct.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between py-2 border-b">
                            <span className="text-muted-foreground">Total Solids:</span>
                            <span className="font-semibold">{currentRecipe.metrics.ts_pct.toFixed(1)}%</span>
                          </div>
                          {currentRecipe.metrics.pac !== undefined && (
                            <div className="flex justify-between py-2 border-b">
                              <span className="text-muted-foreground">PAC:</span>
                              <span className="font-semibold">{currentRecipe.metrics.pac.toFixed(1)}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Compare Recipe */}
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        {compareRecipe.name}
                        <Badge variant="outline">Saved</Badge>
                      </h3>
                      {compareRecipe.metrics && currentRecipe.metrics && (
                        <div className="space-y-2">
                          <div className="flex justify-between py-2 border-b">
                            <span className="text-muted-foreground">Fat:</span>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{compareRecipe.metrics.fat_pct.toFixed(1)}%</span>
                              {renderMetricDiff('Fat', currentRecipe.metrics.fat_pct, compareRecipe.metrics.fat_pct)}
                            </div>
                          </div>
                          <div className="flex justify-between py-2 border-b">
                            <span className="text-muted-foreground">MSNF:</span>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{compareRecipe.metrics.msnf_pct.toFixed(1)}%</span>
                              {renderMetricDiff('MSNF', currentRecipe.metrics.msnf_pct, compareRecipe.metrics.msnf_pct)}
                            </div>
                          </div>
                          <div className="flex justify-between py-2 border-b">
                            <span className="text-muted-foreground">Sugar:</span>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{compareRecipe.metrics.totalSugars_pct.toFixed(1)}%</span>
                              {renderMetricDiff('Sugar', currentRecipe.metrics.totalSugars_pct, compareRecipe.metrics.totalSugars_pct)}
                            </div>
                          </div>
                          <div className="flex justify-between py-2 border-b">
                            <span className="text-muted-foreground">Total Solids:</span>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{compareRecipe.metrics.ts_pct.toFixed(1)}%</span>
                              {renderMetricDiff('Total Solids', currentRecipe.metrics.ts_pct, compareRecipe.metrics.ts_pct)}
                            </div>
                          </div>
                          {compareRecipe.metrics.pac !== undefined && currentRecipe.metrics.pac !== undefined && (
                            <div className="flex justify-between py-2 border-b">
                              <span className="text-muted-foreground">PAC:</span>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{compareRecipe.metrics.pac.toFixed(1)}</span>
                                {renderMetricDiff('PAC', currentRecipe.metrics.pac, compareRecipe.metrics.pac)}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Ingredients comparison */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Ingredients Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Current Recipe Ingredients */}
                    <div>
                      <h3 className="font-semibold mb-3">Current Recipe</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Ingredient</TableHead>
                            <TableHead className="text-right">Qty (g)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {currentRecipe.rows.filter(r => r.quantity_g > 0).map((row, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{row.ingredient}</TableCell>
                              <TableCell className="text-right font-mono">{row.quantity_g.toFixed(1)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Compare Recipe Ingredients */}
                    <div>
                      <h3 className="font-semibold mb-3">{compareRecipe.name}</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Ingredient</TableHead>
                            <TableHead className="text-right">Qty (g)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {compareRecipe.rows.filter((r: any) => r.quantity_g > 0).map((row: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell>{row.ingredient}</TableCell>
                              <TableCell className="text-right font-mono">{row.quantity_g.toFixed(1)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {!compareRecipe && !loading && (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                Select a saved recipe above to compare with your current recipe
              </p>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
