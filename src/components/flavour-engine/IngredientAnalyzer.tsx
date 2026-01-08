import { useState } from 'react';
import { Microscope, TrendingUp, AlertCircle, Info, Snowflake, Zap, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useIngredients } from '@/contexts/IngredientsContext';
import type { IngredientData } from '@/types/ingredients';
import { Separator } from '@/components/ui/separator';

interface IngredientAnalyzerProps {
  currentRecipe?: Array<{ ingredientData?: IngredientData; quantity_g: number }>;
}

export default function IngredientAnalyzer({ currentRecipe }: IngredientAnalyzerProps) {
  const { ingredients: allIngredients } = useIngredients();
  const [selectedIngredient, setSelectedIngredient] = useState<IngredientData | null>(null);

  const analyzeIngredient = (ing: IngredientData) => {
    // Calculate composition breakdown
    const total = (ing.water_pct ?? 0) + (ing.fat_pct ?? 0) + (ing.sugars_pct ?? 0) + 
                  (ing.msnf_pct ?? 0) + (ing.other_solids_pct ?? 0);
    
    // Functional role analysis
    const roles = [];
    if ((ing.fat_pct ?? 0) > 10) roles.push('Fat Source');
    if ((ing.sugars_pct ?? 0) > 20) roles.push('Sweetener');
    if ((ing.msnf_pct ?? 0) > 30) roles.push('Protein/MSNF Source');
    if (ing.category === 'other') roles.push('Texture Modifier');
    if (ing.category === 'flavor') roles.push('Flavor Enhancer');
    
    // Ice cream impact
    const impacts = [];
    if ((ing.fat_pct ?? 0) > 5) impacts.push('Increases creaminess and richness');
    if ((ing.sugars_pct ?? 0) > 15) impacts.push('Lowers freezing point, affects hardness');
    if ((ing.msnf_pct ?? 0) > 20) impacts.push('Improves body and texture');
    if ((ing.water_pct ?? 0) > 70) impacts.push('High water content, dilutes solids');
    
    // Sweetness contribution
    const sweetnessType = (ing.sugars_pct ?? 0) > 50 ? 'High Sweetness' :
                          (ing.sugars_pct ?? 0) > 20 ? 'Moderate Sweetness' : 'Low Sweetness';
    
    return { total, roles, impacts, sweetnessType };
  };

  const getRecipeContext = (ing: IngredientData) => {
    if (!currentRecipe) return null;
    
    const recipeItem = currentRecipe.find(r => r.ingredientData?.id === ing.id);
    if (!recipeItem) return null;
    
    const totalMass = currentRecipe.reduce((sum, r) => sum + r.quantity_g, 0);
    const percentage = (recipeItem.quantity_g / totalMass) * 100;
    
    return {
      grams: recipeItem.quantity_g,
      percentage,
      totalMass
    };
  };

  const analysis = selectedIngredient ? analyzeIngredient(selectedIngredient) : null;
  const recipeContext = selectedIngredient ? getRecipeContext(selectedIngredient) : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Microscope className="h-5 w-5 text-primary" />
            Ingredient Deep Dive
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Analyze the composition, functional roles, and ice cream impact of individual ingredients
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label>Select Ingredient</Label>
            <Select 
              value={selectedIngredient?.id || ''} 
              onValueChange={(id) => {
                const ing = allIngredients.find(i => i.id === id);
                setSelectedIngredient(ing || null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose an ingredient to analyze..." />
              </SelectTrigger>
              <SelectContent>
                {allIngredients
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((ing) => (
                    <SelectItem key={ing.id} value={ing.id}>
                      {ing.name} - {ing.category}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {selectedIngredient && analysis && (
            <>
              {/* Basic Info */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{selectedIngredient.category}</Badge>
                {analysis.roles.map((role, idx) => (
                  <Badge key={idx} variant="secondary">{role}</Badge>
                ))}
              </div>

              {/* Recipe Context */}
              {recipeContext && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>In Current Recipe:</strong> {recipeContext.grams.toFixed(1)}g 
                    ({recipeContext.percentage.toFixed(1)}% of {recipeContext.totalMass.toFixed(0)}g batch)
                  </AlertDescription>
                </Alert>
              )}

              {/* Composition Breakdown */}
              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Composition Breakdown
                </h3>
                <div className="space-y-3">
                  {selectedIngredient.water_pct != null && selectedIngredient.water_pct > 0 && (
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Water</span>
                        <span className="font-medium">{selectedIngredient.water_pct.toFixed(1)}%</span>
                      </div>
                      <Progress value={selectedIngredient.water_pct} className="h-2" />
                    </div>
                  )}
                  
                  {selectedIngredient.fat_pct != null && selectedIngredient.fat_pct > 0 && (
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Fat</span>
                        <span className="font-medium">{selectedIngredient.fat_pct.toFixed(1)}%</span>
                      </div>
                      <Progress value={selectedIngredient.fat_pct} className="h-2" />
                    </div>
                  )}
                  
                  {selectedIngredient.sugars_pct != null && selectedIngredient.sugars_pct > 0 && (
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Sugars ({analysis.sweetnessType})</span>
                        <span className="font-medium">{selectedIngredient.sugars_pct.toFixed(1)}%</span>
                      </div>
                      <Progress value={selectedIngredient.sugars_pct} className="h-2" />
                    </div>
                  )}
                  
                  {selectedIngredient.msnf_pct != null && selectedIngredient.msnf_pct > 0 && (
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>MSNF (Milk Solids Non-Fat)</span>
                        <span className="font-medium">{selectedIngredient.msnf_pct.toFixed(1)}%</span>
                      </div>
                      <Progress value={selectedIngredient.msnf_pct} className="h-2" />
                    </div>
                  )}
                  
                  {selectedIngredient.other_solids_pct != null && selectedIngredient.other_solids_pct > 0 && (
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Other Solids</span>
                        <span className="font-medium">{selectedIngredient.other_solids_pct.toFixed(1)}%</span>
                      </div>
                      <Progress value={selectedIngredient.other_solids_pct} className="h-2" />
                    </div>
                  )}
                </div>
              </div>

              {/* Ice Cream Impact */}
              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Ice Cream Impact
                </h3>
                <div className="space-y-2">
                  {analysis.impacts.map((impact, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm p-2 bg-primary/5 rounded">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{impact}</span>
                    </div>
                  ))}
                  {analysis.impacts.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      This ingredient has a neutral or balanced impact on ice cream properties.
                    </p>
                  )}
                </div>
              </div>

              <Separator className="my-6" />

              {/* Scientific Parameters Section */}
              <div className="space-y-6">
                <h3 className="font-medium text-lg flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Scientific Parameters
                </h3>

                {/* PAC - Freezing Point Depression */}
                {selectedIngredient.pac_coeff != null && selectedIngredient.pac_coeff > 0 && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-3">
                      <Snowflake className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-medium mb-1">PAC (Point of Anti-freezing Coefficient)</div>
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                          {selectedIngredient.pac_coeff.toFixed(1)}
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>• Baseline: Sucrose = 100</p>
                          <p>• {selectedIngredient.pac_coeff > 100 
                            ? `${((selectedIngredient.pac_coeff / 100 - 1) * 100).toFixed(0)}% stronger freezing point depression than sucrose`
                            : selectedIngredient.pac_coeff < 100
                            ? `${((1 - selectedIngredient.pac_coeff / 100) * 100).toFixed(0)}% weaker freezing point depression than sucrose`
                            : 'Same freezing point depression as sucrose'
                          }</p>
                          <p className="font-medium text-foreground mt-2">
                            Impact: {selectedIngredient.pac_coeff > 150 
                              ? 'Very soft texture, may be too soft at typical serving temps'
                              : selectedIngredient.pac_coeff > 120
                              ? 'Softer, scoopable texture'
                              : selectedIngredient.pac_coeff > 80
                              ? 'Standard firmness'
                              : 'Firmer, harder texture'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* SP - Sweetness Power */}
                {selectedIngredient.sp_coeff != null && selectedIngredient.sp_coeff > 0 && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                    <div className="flex items-start gap-3">
                      <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-medium mb-1">SP (Sweetness Power)</div>
                        <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mb-2">
                          {selectedIngredient.sp_coeff.toFixed(2)}
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>• Baseline: Sucrose = 1.00</p>
                          <p>• {selectedIngredient.sp_coeff > 1
                            ? `${((selectedIngredient.sp_coeff - 1) * 100).toFixed(0)}% sweeter than sucrose`
                            : selectedIngredient.sp_coeff < 1
                            ? `${((1 - selectedIngredient.sp_coeff) * 100).toFixed(0)}% less sweet than sucrose`
                            : 'Same sweetness as sucrose'
                          }</p>
                          <p className="font-medium text-foreground mt-2">
                            Taste Profile: {selectedIngredient.sp_coeff > 1.5
                              ? 'Very sweet - use in small amounts'
                              : selectedIngredient.sp_coeff > 1.2
                              ? 'Sweeter than sugar - adjust recipe amounts'
                              : selectedIngredient.sp_coeff > 0.8
                              ? 'Standard sweetness level'
                              : 'Lower sweetness - may need more to achieve target'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Hardening Factor */}
                {selectedIngredient.hardening_factor != null && (
                  <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
                    <div className="flex items-start gap-3">
                      <Activity className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-medium mb-1">Hardening Factor</div>
                        <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-2">
                          {selectedIngredient.hardening_factor.toFixed(2)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <p className="font-medium text-foreground">
                            Texture Impact: {selectedIngredient.hardening_factor > 2
                              ? 'Significant hardening effect - creates firm structure'
                              : selectedIngredient.hardening_factor > 1
                              ? 'Moderate hardening - contributes to body'
                              : selectedIngredient.hardening_factor > 0.5
                              ? 'Slight hardening effect'
                              : selectedIngredient.hardening_factor > 0
                              ? 'Minimal hardening contribution'
                              : 'Softening effect - makes texture more pliable'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sugar Split Breakdown */}
                {selectedIngredient.sugar_split && (
                  <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="font-medium mb-3">Sugar Spectrum Breakdown</div>
                    <div className="space-y-3">
                      {selectedIngredient.sugar_split.glucose != null && selectedIngredient.sugar_split.glucose > 0 && (
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Glucose (Monosaccharide)</span>
                            <span className="font-medium">{selectedIngredient.sugar_split.glucose.toFixed(1)}%</span>
                          </div>
                          <Progress value={selectedIngredient.sugar_split.glucose} className="h-2" />
                          <p className="text-xs text-muted-foreground mt-1">Fast crystallizing, high PAC</p>
                        </div>
                      )}
                      {selectedIngredient.sugar_split.fructose != null && selectedIngredient.sugar_split.fructose > 0 && (
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Fructose (Monosaccharide)</span>
                            <span className="font-medium">{selectedIngredient.sugar_split.fructose.toFixed(1)}%</span>
                          </div>
                          <Progress value={selectedIngredient.sugar_split.fructose} className="h-2" />
                          <p className="text-xs text-muted-foreground mt-1">Very sweet (SP ~1.7), highest PAC</p>
                        </div>
                      )}
                      {selectedIngredient.sugar_split.sucrose != null && selectedIngredient.sugar_split.sucrose > 0 && (
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Sucrose (Disaccharide)</span>
                            <span className="font-medium">{selectedIngredient.sugar_split.sucrose.toFixed(1)}%</span>
                          </div>
                          <Progress value={selectedIngredient.sugar_split.sucrose} className="h-2" />
                          <p className="text-xs text-muted-foreground mt-1">Baseline sweetness, moderate PAC</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* DE for Glucose Syrups */}
                {selectedIngredient.de != null && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-card rounded-lg border">
                      <div className="text-xs text-muted-foreground mb-1">Dextrose Equivalent (DE)</div>
                      <div className="text-xl font-bold">{selectedIngredient.de}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {selectedIngredient.de < 30 ? 'Low DE - less sweet, lower PAC' :
                         selectedIngredient.de < 50 ? 'Medium DE - balanced properties' :
                         'High DE - sweeter, higher PAC'}
                      </p>
                    </div>
                    {selectedIngredient.brix_estimate != null && (
                      <div className="p-3 bg-card rounded-lg border">
                        <div className="text-xs text-muted-foreground mb-1">Brix (°Bx)</div>
                        <div className="text-xl font-bold">{selectedIngredient.brix_estimate}°</div>
                        <p className="text-xs text-muted-foreground mt-1">Total dissolved solids</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Characterization Percentage */}
                {selectedIngredient.characterization_pct != null && selectedIngredient.characterization_pct > 0 && (
                  <div className="p-3 bg-card rounded-lg border">
                    <div className="text-xs text-muted-foreground mb-1">Characterization %</div>
                    <div className="text-xl font-bold">{selectedIngredient.characterization_pct.toFixed(1)}%</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Amount needed to significantly characterize the product's flavor profile
                    </p>
                  </div>
                )}

                {/* Show message if no scientific parameters */}
                {!selectedIngredient.pac_coeff && 
                 !selectedIngredient.sp_coeff && 
                 !selectedIngredient.hardening_factor &&
                 !selectedIngredient.sugar_split &&
                 !selectedIngredient.de && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      No advanced scientific parameters available for this ingredient. Only basic composition data is recorded.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </>
          )}

          {!selectedIngredient && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Select an ingredient above to see detailed composition analysis, functional roles, and impact on ice cream properties.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
