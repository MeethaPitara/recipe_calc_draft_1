import { useState } from 'react';
import { Upload, Brain, Check, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { IngredientService } from '@/services/ingredientService';
import type { IngredientData } from '@/types/ingredients';

type AIAnalysis = {
  format_type: string;
  column_mappings?: any;
  recipes: Array<{
    name: string;
    ingredients: Array<{
      raw_name: string;
      matched_id: string;
      matched_name: string;
      confidence: number;
      quantity: number;
    }>;
  }>;
  parsing_notes?: string;
};

export function IntelligentCSVImporter() {
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [step, setStep] = useState<'upload' | 'analyzing' | 'preview' | 'importing' | 'complete'>('upload');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const analyzeCSV = async () => {
    if (!file) return;

    setIsAnalyzing(true);
    setStep('analyzing');

    try {
      // Load available ingredients
      const ingredients = await IngredientService.getIngredients();

      // Parse CSV to get preview
      Papa.parse(file, {
        complete: async (results) => {
          const preview = results.data.slice(0, 15); // First 15 rows for analysis
          
          // Call AI analysis edge function
          const { data, error } = await supabase.functions.invoke('analyze-csv', {
            body: {
              csvPreview: JSON.stringify(preview),
              availableIngredients: ingredients
            }
          });

          if (error) throw error;

          if (!data.success) {
            throw new Error(data.error || 'Analysis failed');
          }

          setAnalysis(data.analysis);
          setStep('preview');
          toast.success(`AI detected ${data.analysis.recipes.length} recipes in ${data.analysis.format_type} format`);
        },
        error: (error) => {
          console.error('Parse error:', error);
          toast.error('Failed to parse CSV file');
          setStep('upload');
        }
      });
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error(error instanceof Error ? error.message : 'Analysis failed');
      setStep('upload');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleImport = async () => {
    if (!analysis) return;

    setIsImporting(true);
    setStep('importing');
    setImportProgress(0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Fetch all ingredients once for efficiency
      const allIngredients = await IngredientService.getIngredients();
      const ingredientMap = new Map(allIngredients.map(ing => [ing.id, ing]));

      const total = analysis.recipes.length;

      for (let i = 0; i < analysis.recipes.length; i++) {
        const recipe = analysis.recipes[i];

        // Get full ingredient data for calculations using pre-fetched map
        const ingredientData = recipe.ingredients.map(ing => 
          ingredientMap.get(ing.matched_id)
        );

        // Create recipe
        const { data: newRecipe, error: recipeError } = await supabase
          .from('recipes')
          .insert({
            recipe_name: recipe.name,
            product_type: 'ice_cream',
            user_id: user.id
          } as any)
          .select()
          .single();

        if (recipeError) throw recipeError;

        // Insert ingredients with calculated nutritional data
        const rows = recipe.ingredients.map((ing, idx) => {
          const ingredientData = ingredientMap.get(ing.matched_id);
          const qty = ing.quantity;
          
          return {
            recipe_id: newRecipe.id,
            ingredient: ing.matched_name,
            quantity_g: qty,
            sugars_g: ingredientData ? (qty * (Number(ingredientData.sugars_pct) / 100)) : 0,
            fat_g: ingredientData ? (qty * (Number(ingredientData.fat_pct) / 100)) : 0,
            msnf_g: ingredientData ? (qty * (Number(ingredientData.msnf_pct) / 100)) : 0,
            other_solids_g: ingredientData ? (qty * (Number(ingredientData.other_solids_pct) / 100)) : 0,
            total_solids_g: ingredientData ? (qty * ((100 - Number(ingredientData.water_pct)) / 100)) : 0
          };
        });

        const { error: rowsError } = await supabase
          .from('recipe_rows')
          .insert(rows);

        if (rowsError) throw rowsError;

        // Calculate and save metrics
        const totals = rows.reduce((acc, r) => ({
          quantity: acc.quantity + r.quantity_g,
          sugars: acc.sugars + r.sugars_g,
          fat: acc.fat + r.fat_g,
          msnf: acc.msnf + r.msnf_g,
          otherSolids: acc.otherSolids + r.other_solids_g,
          totalSolids: acc.totalSolids + r.total_solids_g
        }), { quantity: 0, sugars: 0, fat: 0, msnf: 0, otherSolids: 0, totalSolids: 0 });

        const metrics = {
          recipe_id: newRecipe.id,
          total_quantity_g: totals.quantity,
          total_sugars_g: totals.sugars,
          total_fat_g: totals.fat,
          total_msnf_g: totals.msnf,
          total_other_solids_g: totals.otherSolids,
          total_solids_g: totals.totalSolids,
          sugars_pct: (totals.sugars / totals.quantity) * 100,
          fat_pct: (totals.fat / totals.quantity) * 100,
          msnf_pct: (totals.msnf / totals.quantity) * 100,
          other_solids_pct: (totals.otherSolids / totals.quantity) * 100,
          total_solids_pct: (totals.totalSolids / totals.quantity) * 100,
          sp: 0,
          pac: 0,
          fpdt: 0,
          pod_index: 0
        };

        const { error: metricsError } = await supabase
          .from('calculated_metrics')
          .insert(metrics);

        if (metricsError) console.error('Metrics save error:', metricsError);

        setImportProgress(((i + 1) / total) * 100);
      }

      setStep('complete');
      toast.success(`Successfully imported ${analysis.recipes.length} recipes!`);
    } catch (error) {
      console.error('Import error:', error);
      toast.error(error instanceof Error ? error.message : 'Import failed');
      setStep('preview');
    } finally {
      setIsImporting(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600';
    if (confidence >= 0.7) return 'text-yellow-600';
    return 'text-orange-600';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          AI-Powered CSV Importer
        </CardTitle>
        <CardDescription>
          Upload any CSV format - AI will automatically detect structure and extract recipes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 'upload' && (
          <div className="space-y-4">
            <Alert>
              <Sparkles className="h-4 w-4" />
              <AlertDescription>
                This intelligent importer uses AI to understand any CSV format automatically.
                No need to format your data - just upload and let AI do the work!
              </AlertDescription>
            </Alert>

            <div>
              <Label htmlFor="csv-upload">Upload CSV File</Label>
              <Input
                id="csv-upload"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                disabled={isAnalyzing}
              />
            </div>

            {file && (
              <Button onClick={analyzeCSV} disabled={isAnalyzing} className="w-full">
                <Brain className="h-4 w-4 mr-2" />
                Analyze with AI
              </Button>
            )}
          </div>
        )}

        {step === 'analyzing' && (
          <div className="space-y-4 py-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div>
                <h3 className="font-semibold mb-1">AI is analyzing your CSV...</h3>
                <p className="text-sm text-muted-foreground">
                  Detecting format, identifying recipes, and matching ingredients
                </p>
              </div>
            </div>
          </div>
        )}

        {step === 'preview' && analysis && (
          <div className="space-y-4">
            <Alert>
              <Check className="h-4 w-4" />
              <AlertDescription>
                <strong>Format detected:</strong> {analysis.format_type} | 
                <strong> Recipes found:</strong> {analysis.recipes.length}
                {analysis.parsing_notes && <div className="mt-2 text-sm">{analysis.parsing_notes}</div>}
              </AlertDescription>
            </Alert>

            <div className="max-h-96 overflow-y-auto space-y-4">
              {analysis.recipes.map((recipe, idx) => (
                <Card key={idx} className="border-muted">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      {recipe.name}
                      <Badge variant="secondary">{recipe.ingredients.length} ingredients</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {recipe.ingredients.map((ing, ingIdx) => (
                      <div key={ingIdx} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Check className={`h-4 w-4 ${getConfidenceColor(ing.confidence)}`} />
                          <div>
                            <div className="font-medium">{ing.matched_name}</div>
                            {ing.raw_name !== ing.matched_name && (
                              <div className="text-xs text-muted-foreground">
                                from: {ing.raw_name}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{ing.quantity.toFixed(1)}g</span>
                          <Badge variant="outline" className="text-xs">
                            {(ing.confidence * 100).toFixed(0)}%
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={() => { setStep('upload'); setAnalysis(null); setFile(null); }} 
                variant="outline"
              >
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={isImporting} className="flex-1">
                <Upload className="h-4 w-4 mr-2" />
                Import {analysis.recipes.length} Recipe(s)
              </Button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="space-y-4 py-8">
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">Importing recipes to database...</p>
              <Progress value={importProgress} className="w-full" />
              <p className="text-xs text-muted-foreground">{importProgress.toFixed(0)}%</p>
            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className="space-y-4 py-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <Check className="h-12 w-12 text-green-600" />
              <div>
                <h3 className="font-semibold mb-1">Import Complete!</h3>
                <p className="text-sm text-muted-foreground">
                  All recipes have been successfully imported
                </p>
              </div>
              <Button onClick={() => { setStep('upload'); setAnalysis(null); setFile(null); }}>
                Import More Recipes
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
