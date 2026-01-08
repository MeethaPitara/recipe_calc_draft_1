import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Beaker, Info, ArrowRight, AlertTriangle } from 'lucide-react';
import { analyzeIngredientChemistry, analyzeRecipeChemistry, compareIngredients } from '@/services/chemistryService';
import { MetricsV2 } from '@/lib/calc.v2';
import IngredientAnalyzer from './flavour-engine/IngredientAnalyzer';
import { RecipeIngredient } from '@/types/recipe';

interface ChemistryDashboardProps {
  recipe: RecipeIngredient[];
  metrics: MetricsV2 | null;
}

export function ChemistryDashboard({ recipe, metrics }: ChemistryDashboardProps) {
  const [view, setView] = useState<'overview' | 'ingredient' | 'compare'>('overview');
  const [selectedIngredient, setSelectedIngredient] = useState<any>(null);

  // Filter out rows without proper ingredient data
  const validRecipe = recipe.filter(ing => 
    ing.ingredientData && ing.quantity_g > 0
  );

  // Analyze recipe if available
  const recipeAnalysis = validRecipe.length > 0 && metrics ? 
    analyzeRecipeChemistry(validRecipe, metrics) : null;

  if (recipe.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Beaker className="h-5 w-5" />
            Chemistry Analysis
          </CardTitle>
          <CardDescription>Deep ingredient composition analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              No recipe loaded. Go to the Calculator tab and create a recipe, then click "Analyze Chemistry" to see detailed analysis here.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (validRecipe.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Beaker className="h-5 w-5" />
            Chemistry Analysis
          </CardTitle>
          <CardDescription>Deep ingredient composition analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Recipe contains ingredients without complete data. Please ensure all ingredients are selected from the ingredient database.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (view === 'ingredient' && selectedIngredient) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => setView('overview')}>
          ← Back to Overview
        </Button>
        <IngredientAnalyzer />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Beaker className="h-5 w-5" />
            Recipe Chemistry Overview
          </CardTitle>
          <CardDescription>Complete composition analysis</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {recipeAnalysis && (
            <>
              {/* Composition Breakdown */}
              <div>
                <h3 className="font-semibold mb-3">Composition Breakdown</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Water</span>
                      <span className="font-medium">{recipeAnalysis.overallComposition.water.toFixed(2)}%</span>
                    </div>
                    <Progress value={recipeAnalysis.overallComposition.water} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Sugars</span>
                      <span className="font-medium">{recipeAnalysis.overallComposition.sugars.toFixed(2)}%</span>
                    </div>
                    <Progress value={recipeAnalysis.overallComposition.sugars} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Fat</span>
                      <span className="font-medium">{recipeAnalysis.overallComposition.fat.toFixed(2)}%</span>
                    </div>
                    <Progress value={recipeAnalysis.overallComposition.fat} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>MSNF</span>
                      <span className="font-medium">{recipeAnalysis.overallComposition.msnf.toFixed(2)}%</span>
                    </div>
                    <Progress value={recipeAnalysis.overallComposition.msnf} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Other Solids</span>
                      <span className="font-medium">{recipeAnalysis.overallComposition.otherSolids.toFixed(2)}%</span>
                    </div>
                    <Progress value={recipeAnalysis.overallComposition.otherSolids} className="h-2" />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Functional Balance */}
              <div>
                <h3 className="font-semibold mb-3">Functional Balance</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Sweet Power</p>
                    <p className="text-lg font-bold">{recipeAnalysis.functionalBalance.sweeteningPower.toFixed(1)}</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">FPDT</p>
                    <p className="text-lg font-bold">{recipeAnalysis.functionalBalance.freezingPointDepression.toFixed(2)}°C</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Texture</p>
                    <p className="text-sm font-medium">{recipeAnalysis.functionalBalance.bodyAndTexture}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Nutritional Profile */}
              <div>
                <h3 className="font-semibold mb-3">Nutritional Profile (per 100g)</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Calories</p>
                    <p className="text-lg font-bold">{recipeAnalysis.nutritionalProfile.caloriesPer100g.toFixed(0)}</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Protein</p>
                    <p className="text-lg font-bold">{recipeAnalysis.nutritionalProfile.macros.protein.toFixed(1)}g</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Carbs</p>
                    <p className="text-lg font-bold">{recipeAnalysis.nutritionalProfile.macros.carbs.toFixed(1)}g</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Fat</p>
                    <p className="text-lg font-bold">{recipeAnalysis.nutritionalProfile.macros.fat.toFixed(1)}g</p>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              {recipeAnalysis.recommendations.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-semibold mb-3">Recommendations</h3>
                    <div className="space-y-2">
                      {recipeAnalysis.recommendations.map((rec, i) => (
                        <Alert key={i}>
                          <ArrowRight className="h-4 w-4" />
                          <AlertDescription>{rec}</AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Ingredient List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Individual Ingredient Analysis</CardTitle>
          <CardDescription>Click any ingredient for detailed chemistry</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {recipe.map((ing, i) => {
              if (!ing.ingredientData) {
                return (
                  <div key={i} className="p-3 border border-yellow-200 rounded-lg bg-yellow-50 dark:bg-yellow-950/20">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                      <span className="text-sm text-yellow-700 dark:text-yellow-300">
                        {ing.ingredient}: Missing ingredient data
                      </span>
                    </div>
                  </div>
                );
              }
              
              const analysis = analyzeIngredientChemistry(ing.ingredientData);
              
              return (
                <div
                  key={i}
                  className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => {
                    setSelectedIngredient(ing.ingredientData);
                    setView('ingredient');
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{ing.ingredientData.name}</span>
                    <Badge variant="outline">{ing.quantity_g}g</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">SP: </span>
                      <span className="font-medium">{analysis.functionality.sweetPower}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">PAC: </span>
                      <span className="font-medium">{analysis.functionality.freezingEffect}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Calories: </span>
                      <span className="font-medium">{analysis.nutritionalImpact.calories.toFixed(0)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}