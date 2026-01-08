import { useState } from 'react';
import { Brain, Lightbulb, TrendingUp, AlertTriangle, Loader2, Database } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAIUsageLimit } from '@/hooks/useAIUsageLimit';
import { useQuery } from '@tanstack/react-query';

type RecipeRow = {
  ingredient: string;
  quantity_g: number;
};

type Recipe = {
  recipe_name: string;
  product_type: string;
  rows: RecipeRow[];
};

type Metrics = {
  sugars_pct?: number;
  fat_pct?: number;
  msnf_pct?: number;
  total_solids_pct?: number;
  sp?: number;
  pac?: number;
  fpdt?: number;
};

type AIAnalysis = {
  balance_assessment: string;
  optimization_suggestions: string[];
  texture_prediction: string;
  risk_warnings: string[];
  recommended_adjustments: string[];
};

type SmartInsightsPanelProps = {
  recipe?: Recipe | any[];
  metrics?: Metrics;
  productType?: string;
};

export function SmartInsightsPanel({ recipe, metrics, productType }: SmartInsightsPanelProps) {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('');
  const [analysisMode, setAnalysisMode] = useState<string>(productType || 'ice_cream');
  const { remaining, refetch } = useAIUsageLimit();

  // Fetch user's recipes from database with proper typing
  const { data: savedRecipes, isLoading: loadingRecipes } = useQuery({
    queryKey: ['user-recipes-for-analysis'],
    queryFn: async () => {
      const { data: recipes, error } = await supabase
        .from('recipes')
        .select(`
          id,
          recipe_name,
          product_type,
          recipe_rows (
            ingredient,
            quantity_g,
            sugars_g,
            fat_g,
            msnf_g,
            other_solids_g,
            total_solids_g
          ),
          calculated_metrics (
            sugars_pct,
            fat_pct,
            msnf_pct,
            total_solids_pct,
            sp,
            pac,
            fpdt
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) {
        console.error('Error fetching recipes:', error);
        toast.error('Failed to load recipes from database');
        return [];
      }
      
      console.log('📚 Loaded recipes for analysis:', recipes?.length || 0);
      return recipes || [];
    }
  });

  const handleAIAnalysis = async (sourceRecipe?: Recipe | any, sourceMetrics?: Metrics, overrideMode?: string) => {
    if (remaining <= 0) {
      toast.error('AI usage limit reached. Please wait before making more requests.');
      return;
    }

    const recipeToAnalyze = sourceRecipe || recipe;
    const metricsToAnalyze = sourceMetrics || metrics;

    // Handle both Recipe type and array type
    const hasRows = Array.isArray(recipeToAnalyze) 
      ? recipeToAnalyze.length > 0 
      : recipeToAnalyze?.rows && recipeToAnalyze.rows.length > 0;

    if (!hasRows) {
      toast.error('No recipe data to analyze');
      return;
    }

    setIsAnalyzing(true);

    try {
      // Use override mode if provided, otherwise use analysisMode, then fallback to recipe property, then default
      const finalProductType = overrideMode || analysisMode || productType || 
                               (typeof recipeToAnalyze === 'object' && recipeToAnalyze.product_type) || 
                               'ice_cream';
      
      console.log('🎯 Analyzing recipe with product type:', finalProductType);
      
      const { data, error } = await supabase.functions.invoke('analyze-recipe', {
        body: {
          recipe: recipeToAnalyze,
          metrics: metricsToAnalyze,
          productType: finalProductType
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to analyze recipe');
      }

      if (!data) {
        throw new Error('No data returned from analysis');
      }

      console.log('Analysis result:', data);
      setAnalysis(data);
      toast.success('AI analysis complete!');
      refetch(); // Update usage count
    } catch (error) {
      console.error('AI analysis error:', error);
      toast.error('Failed to analyze recipe');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleLoadRecipe = async () => {
    if (!selectedRecipeId || !savedRecipes) {
      toast.error('Please select a recipe to analyze');
      return;
    }

    const selected = savedRecipes.find(r => r.id === selectedRecipeId);
    if (!selected) {
      toast.error('Recipe not found');
      return;
    }

    console.log('🔍 Selected recipe for analysis:', selected);

    // Build recipe data
    const recipeData: Recipe = {
      recipe_name: selected.recipe_name,
      product_type: selected.product_type || 'ice_cream',
      rows: (selected.recipe_rows as any[] || []).map((r: any) => ({
        ingredient: r.ingredient,
        quantity_g: r.quantity_g
      }))
    };

    // Get metrics from calculated_metrics
    const metricsArray = Array.isArray(selected.calculated_metrics) 
      ? selected.calculated_metrics 
      : (selected.calculated_metrics ? [selected.calculated_metrics] : []);
    const metricsData: Metrics = metricsArray.length > 0 ? metricsArray[0] : {};

    console.log('📊 Recipe data:', recipeData);
    console.log('📈 Metrics data:', metricsData);

    if (!recipeData.rows || recipeData.rows.length === 0) {
      toast.error('This recipe has no ingredients to analyze');
      return;
    }

    await handleAIAnalysis(recipeData, metricsData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          AI Recipe Insights
          {productType && (
            <Badge variant="outline" className="ml-auto text-xs">
              Stored as: {productType === 'ice_cream' ? '🍦' : productType === 'gelato' || productType === 'gelato_white' ? '🍨' : productType === 'sorbet' ? '🍧' : productType}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Get intelligent recommendations and analysis powered by AI
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Analysis Mode Selector */}
        <div className="space-y-2 border-b pb-4">
          <Label htmlFor="analysis-mode" className="text-sm font-medium">
            🔬 Analysis Mode
          </Label>
          <Select value={analysisMode} onValueChange={setAnalysisMode}>
            <SelectTrigger id="analysis-mode" className="bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ice_cream">🍦 Ice Cream Mode</SelectItem>
              <SelectItem value="gelato">🍨 Gelato Mode</SelectItem>
              <SelectItem value="gelato_white">🍨 Gelato (White Base)</SelectItem>
              <SelectItem value="sorbet">🍧 Sorbet Mode</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Choose how to analyze this recipe's balance and parameters
          </p>
        </div>
        {/* Recipe selection from database */}
        <div className="space-y-2">
          <label className="text-sm font-medium">📚 Analyze Saved Recipe</label>
          {loadingRecipes ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-sm">Loading recipes...</span>
            </div>
          ) : (
            <div className="flex gap-2">
              <Select value={selectedRecipeId} onValueChange={setSelectedRecipeId}>
                <SelectTrigger>
                  <SelectValue placeholder={savedRecipes && savedRecipes.length > 0 ? "Select a saved recipe" : "No recipes found"} />
                </SelectTrigger>
                <SelectContent>
                  {savedRecipes && savedRecipes.length > 0 ? (
                    savedRecipes.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.recipe_name} ({r.product_type || 'ice_cream'}) - {(r.recipe_rows as any[])?.length || 0} ingredients
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>No saved recipes found</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <Button 
                onClick={handleLoadRecipe} 
                disabled={!selectedRecipeId || isAnalyzing || !savedRecipes || savedRecipes.length === 0}
                variant="outline"
              >
                <Database className="h-4 w-4 mr-2" />
                Analyze
              </Button>
            </div>
          )}
          {savedRecipes && savedRecipes.length === 0 && !loadingRecipes && (
            <p className="text-xs text-muted-foreground">
              No recipes in database. Create and save recipes in the Calculator tab first.
            </p>
          )}
        </div>

        {/* Analyze current calculator recipe */}
        {recipe && (Array.isArray(recipe) ? recipe.length > 0 : recipe.rows && recipe.rows.length > 0) && (
          <Alert>
            <AlertDescription className="flex items-center justify-between">
              <span>Current recipe: {Array.isArray(recipe) ? 'From Calculator' : (recipe.recipe_name || 'Untitled')}</span>
              <Button 
                onClick={() => handleAIAnalysis(undefined, undefined, analysisMode)} 
                disabled={isAnalyzing}
                size="sm"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4 mr-2" />
                    Analyze in {analysisMode === 'ice_cream' ? 'Ice Cream' : analysisMode === 'gelato' ? 'Gelato' : analysisMode === 'gelato_white' ? 'Gelato (White)' : 'Sorbet'} Mode
                  </>
                )}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {isAnalyzing && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {analysis && !isAnalyzing && (
          <div className="space-y-4">
            <Card className="border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Balance Assessment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{analysis.balance_assessment}</p>
              </CardContent>
            </Card>

            {analysis.texture_prediction && (
              <Card className="border-blue-500/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-blue-500" />
                    Texture Prediction
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{analysis.texture_prediction}</p>
                </CardContent>
              </Card>
            )}

            {analysis.optimization_suggestions && analysis.optimization_suggestions.length > 0 && (
              <Card className="border-green-500/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-green-500" />
                    Optimization Suggestions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {analysis.optimization_suggestions.map((suggestion, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Badge variant="outline" className="mt-0.5">
                        {idx + 1}
                      </Badge>
                      <p className="text-sm flex-1">{suggestion}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {analysis.risk_warnings && analysis.risk_warnings.length > 0 && (
              <Card className="border-orange-500/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    Risk Warnings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {analysis.risk_warnings.map((warning, idx) => (
                    <Alert key={idx} variant="destructive">
                      <AlertDescription>{warning}</AlertDescription>
                    </Alert>
                  ))}
                </CardContent>
              </Card>
            )}

            {analysis.recommended_adjustments && analysis.recommended_adjustments.length > 0 && (
              <Card className="border-purple-500/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-purple-500" />
                    Recommended Adjustments
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {analysis.recommended_adjustments.map((adjustment, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Badge variant="secondary" className="mt-0.5">
                        {idx + 1}
                      </Badge>
                      <p className="text-sm flex-1">{adjustment}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {!analysis && !isAnalyzing && (
          <Alert>
            <Brain className="h-4 w-4" />
            <AlertDescription>
              Select a recipe from your database or use the calculator to create a recipe, then click "Analyze" to get AI-powered insights.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
