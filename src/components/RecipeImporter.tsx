import { useState } from 'react';
import { Upload, Check, AlertCircle, Loader2 } from 'lucide-react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { IngredientService } from '@/services/ingredientService';
import { matchIngredientName } from '@/lib/ingredientMapper';
import type { IngredientData } from '@/types/ingredients';
import { supabase } from '@/integrations/supabase/client';

type ParsedRow = {
  name: string;
  grams: number;
  matchedIngredient?: IngredientData;
  confidence: 'high' | 'medium' | 'low' | 'none';
};

type ParsedRecipe = {
  name: string;
  rows: ParsedRow[];
  totalWeight: number;
};

export function RecipeImporter() {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRecipes, setParsedRecipes] = useState<ParsedRecipe[]>([]);
  const [availableIngredients, setAvailableIngredients] = useState<IngredientData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseFile(selectedFile);
    }
  };

  const parseFile = async (file: File) => {
    setIsLoading(true);
    try {
      // Load available ingredients
      const ingredients = await IngredientService.getIngredients();
      setAvailableIngredients(ingredients);

      // Parse CSV/Excel file
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const recipes = processParseResults(results.data as any[], ingredients);
          setParsedRecipes(recipes);
          setStep('preview');
          setIsLoading(false);
        },
        error: (error) => {
          console.error('Parse error:', error);
          toast.error('Failed to parse file');
          setIsLoading(false);
        }
      });
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to load ingredients');
      setIsLoading(false);
    }
  };

  const processParseResults = (data: any[], ingredients: IngredientData[]): ParsedRecipe[] => {
    // Expected format: Recipe Name, Ingredient Name, Grams
    const recipesMap = new Map<string, ParsedRow[]>();

    data.forEach((row) => {
      const recipeName = row['Recipe Name'] || row['recipe_name'] || 'Untitled Recipe';
      const ingredientName = row['Ingredient'] || row['ingredient_name'] || row['Ingredient Name'];
      const grams = parseFloat(row['Grams'] || row['grams'] || row['Amount'] || '0');

      if (!ingredientName || grams === 0) return;

      // Match ingredient
      const matchedIngredient = matchIngredientName(ingredientName, ingredients);
      
      // Calculate confidence
      let confidence: 'high' | 'medium' | 'low' | 'none' = 'none';
      if (matchedIngredient) {
        if (matchedIngredient.name.toLowerCase() === ingredientName.toLowerCase()) {
          confidence = 'high';
        } else if (matchedIngredient.name.toLowerCase().includes(ingredientName.toLowerCase())) {
          confidence = 'medium';
        } else {
          confidence = 'low';
        }
      }

      const parsedRow: ParsedRow = {
        name: ingredientName,
        grams,
        matchedIngredient,
        confidence
      };

      if (!recipesMap.has(recipeName)) {
        recipesMap.set(recipeName, []);
      }
      recipesMap.get(recipeName)!.push(parsedRow);
    });

    // Convert to array
    return Array.from(recipesMap.entries()).map(([name, rows]) => ({
      name,
      rows,
      totalWeight: rows.reduce((sum, r) => sum + r.grams, 0)
    }));
  };

  const handleImport = async () => {
    setStep('importing');
    setImportProgress(0);

    try {
      for (let i = 0; i < parsedRecipes.length; i++) {
        const recipe = parsedRecipes[i];
        
        // Only import if all ingredients are matched
        const allMatched = recipe.rows.every(r => r.matchedIngredient);
        if (!allMatched) {
          toast.warning(`Skipping "${recipe.name}" - unmapped ingredients`);
          continue;
        }

        // Get user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        // Create recipe
        const { data: newRecipe, error: recipeError } = await supabase
          .from('recipes')
          .insert({
            recipe_name: recipe.name,
            product_type: 'gelato',
            user_id: user.id
          } as any)
          .select()
          .single();

        if (recipeError) throw recipeError;

        // Insert ingredient rows with calculated data
        const rows = recipe.rows.map(r => {
          const ingData = r.matchedIngredient!;
          const qty = r.grams;
          
          return {
            recipe_id: newRecipe.id,
            ingredient: ingData.name,
            quantity_g: qty,
            sugars_g: qty * (ingData.sugars_pct / 100),
            fat_g: qty * (ingData.fat_pct / 100),
            msnf_g: qty * (ingData.msnf_pct / 100),
            other_solids_g: qty * (ingData.other_solids_pct / 100),
            total_solids_g: qty * ((100 - ingData.water_pct) / 100)
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
          sp: 0, // Will be calculated by backend
          pac: 0, // Will be calculated by backend
          fpdt: 0, // Will be calculated by backend
          pod_index: 0 // Will be calculated by backend
        };

        const { error: metricsError } = await supabase
          .from('calculated_metrics')
          .insert(metrics);

        if (metricsError) console.error('Metrics save error:', metricsError);

        setImportProgress(((i + 1) / parsedRecipes.length) * 100);
      }

      setStep('complete');
      toast.success(`Successfully imported ${parsedRecipes.length} recipes!`);
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to import recipes');
      setStep('preview');
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Recipe Importer
        </CardTitle>
        <CardDescription>
          Import recipes from Excel/CSV files. Expected format: Recipe Name, Ingredient, Grams
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 'upload' && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="file-upload">Upload CSV/Excel File</Label>
              <Input
                id="file-upload"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                disabled={isLoading}
              />
            </div>
            {isLoading && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Parsing file...
              </div>
            )}
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Found {parsedRecipes.length} recipe(s). Review ingredient mappings below:
            </div>
            
            <div className="max-h-96 overflow-y-auto space-y-4">
              {parsedRecipes.map((recipe, idx) => (
                <Card key={idx} className="border-muted">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{recipe.name}</CardTitle>
                    <CardDescription>{recipe.totalWeight.toFixed(0)}g total</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {recipe.rows.map((row, rowIdx) => (
                      <div key={rowIdx} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          {row.confidence === 'high' && <Check className="h-4 w-4 text-green-500" />}
                          {row.confidence === 'medium' && <Check className="h-4 w-4 text-yellow-500" />}
                          {row.confidence === 'low' && <AlertCircle className="h-4 w-4 text-orange-500" />}
                          {row.confidence === 'none' && <AlertCircle className="h-4 w-4 text-red-500" />}
                          <span className={row.confidence === 'none' ? 'text-destructive' : ''}>
                            {row.name} → {row.matchedIngredient?.name || 'Not found'}
                          </span>
                        </div>
                        <span className="text-muted-foreground">{row.grams.toFixed(1)}g</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex gap-2">
              <Button onClick={() => { setStep('upload'); setParsedRecipes([]); }} variant="outline">
                Cancel
              </Button>
              <Button onClick={handleImport}>
                Import {parsedRecipes.length} Recipe(s)
              </Button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">Importing recipes...</div>
            <Progress value={importProgress} />
          </div>
        )}

        {step === 'complete' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <Check className="h-5 w-5" />
              <span>Import complete!</span>
            </div>
            <Button onClick={() => { setStep('upload'); setParsedRecipes([]); setFile(null); }}>
              Import More Recipes
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
