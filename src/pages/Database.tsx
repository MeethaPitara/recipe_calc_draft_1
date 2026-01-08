import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Upload, Database as DatabaseIcon, Brain, Download, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { mlService } from '@/services/mlService';
import Papa from 'papaparse';
import { z } from 'zod';
import { IntelligentCSVImporter } from '@/components/IntelligentCSVImporter';
import { RecipeImporter } from '@/components/RecipeImporter';

// Flexible validation schema - all columns optional except ingredient and quantity
const ImportRowSchema = z.object({
  'Ingredient': z.string().min(1, "Ingredient name is required"),
  'Quantity (g)': z.number().positive("Quantity must be greater than 0"),
  'Sugars (g)': z.number().min(0).optional().default(0),
  'Fat (g)': z.number().min(0).optional().default(0),
  'MSNF (g)': z.number().min(0).optional().default(0),
  'Other Solids (g)': z.number().min(0).optional().default(0),
  'Total Solids (g)': z.number().min(0).optional().default(0)
});

type RecipeData = {
  name: string;
  rows: z.infer<typeof ImportRowSchema>[];
};

// Helper function to safely parse number with default fallback - flexible for any format
const safeParseNumber = (value: any, defaultValue: number = 0): number => {
  if (value === null || value === undefined || value === '') return defaultValue;
  const str = String(value).trim();
  if (str === '' || str === '-' || str.toLowerCase() === 'n/a') return defaultValue;
  const parsed = parseFloat(str.replace(/[^0-9.-]/g, ''));
  return isNaN(parsed) ? defaultValue : Math.max(0, parsed);
};

// Detect CSV format type
const detectFileFormat = (rows: any[][]): 'side-by-side' | 'simple' | 'unknown' => {
  if (rows.length < 2) return 'unknown';
  
  // Check for multiple sections with "Ingredient" headers
  let ingredientCount = 0;
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const row = rows[i];
    const hasIngredient = row.some((cell: any) => 
      cell && String(cell).toLowerCase() === 'ingredient'
    );
    if (hasIngredient) ingredientCount++;
  }
  
  // Multiple ingredient headers means side-by-side format
  if (ingredientCount >= 2) return 'side-by-side';
  
  // Single ingredient header means simple format
  if (ingredientCount === 1) return 'simple';
  
  return 'unknown';
};

// Parse side-by-side recipe format (handles complex multi-column layouts)
const parseSideBySideFormat = (rows: any[][]): Map<string, z.infer<typeof ImportRowSchema>[]> => {
  const recipesMap = new Map<string, z.infer<typeof ImportRowSchema>[]>();
  
  // Find rows that contain "Ingredient" header
  const ingredientRowIndices: number[] = [];
  rows.forEach((row, idx) => {
    if (row.some((cell: any) => cell && String(cell).toLowerCase().trim() === 'ingredient')) {
      ingredientRowIndices.push(idx);
    }
  });
  
  console.log(`Found ${ingredientRowIndices.length} recipe header sections`);
  
  // Process each recipe table section
  for (const startIdx of ingredientRowIndices) {
    const headerRow = rows[startIdx];
    
    // Find all "Ingredient" column positions
    const recipeColumns: number[] = [];
    headerRow.forEach((cell: any, colIdx: number) => {
      if (cell && String(cell).toLowerCase().trim() === 'ingredient') {
        recipeColumns.push(colIdx);
      }
    });
    
    // For each recipe column, extract the recipe
    for (const colIdx of recipeColumns) {
      // Look backwards for recipe name (usually 1-3 rows above)
      let recipeName = `Recipe ${recipesMap.size + 1}`;
      for (let i = startIdx - 1; i >= Math.max(0, startIdx - 5); i--) {
        const potentialName = rows[i][colIdx];
        if (potentialName && String(potentialName).trim() !== '' && 
            !String(potentialName).toLowerCase().includes('ingredient') &&
            !String(potentialName).toLowerCase().includes('quantity') &&
            !String(potentialName).toLowerCase().includes('balancing') &&
            !String(potentialName).toLowerCase().includes('total')) {
          recipeName = String(potentialName).trim();
          break;
        }
      }
      
      // Map header to column indices for this recipe
      const columnMap: { [key: string]: number } = { 'ingredient': colIdx };
      headerRow.forEach((cell: any, idx: number) => {
        if (!cell || idx < colIdx) return;
        const header = String(cell).toLowerCase().trim();
        if (header.includes('quantity') || header.includes('qty')) columnMap['quantity'] = idx;
        if (header.includes('sugar') && !header.includes('split')) columnMap['sugars'] = idx;
        if (header.includes('fat')) columnMap['fat'] = idx;
        if (header.includes('msnf')) columnMap['msnf'] = idx;
        if (header.includes('other') && header.includes('solid')) columnMap['other_solids'] = idx;
        if (header.includes('total') && header.includes('solid')) columnMap['total_solids'] = idx;
      });
      
      // If no quantity column found, assume it's next to ingredient
      if (!columnMap['quantity']) {
        columnMap['quantity'] = colIdx + 1;
      }
      
      console.log(`📍 Recipe "${recipeName}" column map:`, columnMap);
      
      // Extract ingredient rows
      const ingredients: z.infer<typeof ImportRowSchema>[] = [];
      for (let rowIdx = startIdx + 1; rowIdx < rows.length && rowIdx < startIdx + 100; rowIdx++) {
        const row = rows[rowIdx];
        const ingredient = row[columnMap['ingredient']];
        const quantity = row[columnMap['quantity']];
        
        // Stop if ingredient is empty, numeric, or looks like a total/header
        if (!ingredient || String(ingredient).trim() === '' ||
            /^\d+$/.test(String(ingredient).trim()) ||
            String(ingredient).toLowerCase().includes('total') ||
            String(ingredient).toLowerCase() === 'ingredient') {
          continue;
        }
        
        const parsedQty = safeParseNumber(quantity);
        if (parsedQty <= 0) continue;
        
        try {
          const validated = ImportRowSchema.parse({
            'Ingredient': String(ingredient).trim(),
            'Quantity (g)': parsedQty,
            'Sugars (g)': columnMap['sugars'] ? safeParseNumber(row[columnMap['sugars']]) : 0,
            'Fat (g)': columnMap['fat'] ? safeParseNumber(row[columnMap['fat']]) : 0,
            'MSNF (g)': columnMap['msnf'] ? safeParseNumber(row[columnMap['msnf']]) : 0,
            'Other Solids (g)': columnMap['other_solids'] ? safeParseNumber(row[columnMap['other_solids']]) : 0,
            'Total Solids (g)': columnMap['total_solids'] ? safeParseNumber(row[columnMap['total_solids']]) : 0
          });
          
          ingredients.push(validated);
        } catch (e) {
          // Skip invalid rows silently
        }
      }
      
      if (ingredients.length > 0) {
        const uniqueName = recipeName + (recipesMap.has(recipeName) ? ` (${Date.now()})` : '');
        recipesMap.set(uniqueName, ingredients);
        console.log(`✅ Extracted "${uniqueName}" with ${ingredients.length} ingredients`);
      }
    }
  }
  
  return recipesMap;
};

// Parse simple row-by-row format
const parseSimpleFormat = (rows: any[][]): Map<string, z.infer<typeof ImportRowSchema>[]> => {
  const recipesMap = new Map<string, z.infer<typeof ImportRowSchema>[]>();
  
  // Find header row
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    if (rows[i].some((cell: any) => cell && String(cell).toLowerCase().includes('ingredient'))) {
      headerRowIdx = i;
      break;
    }
  }
  
  const headers = rows[headerRowIdx].map((h: any) => String(h || '').trim().toLowerCase());
  
  // Find column indices
  const getColIdx = (...names: string[]) => {
    for (const name of names) {
      const idx = headers.findIndex(h => h.includes(name.toLowerCase()));
      if (idx >= 0) return idx;
    }
    return -1;
  };
  
  const recipeNameIdx = getColIdx('recipe', 'name');
  const ingredientIdx = getColIdx('ingredient');
  const quantityIdx = getColIdx('quantity', 'grams', 'qty');
  
  if (ingredientIdx < 0 || quantityIdx < 0) {
    throw new Error('Could not find Ingredient and Quantity columns');
  }
  
  let currentRecipeName = 'Unnamed Recipe';
  
  // Process data rows
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((cell: any) => !cell || String(cell).trim() === '')) continue;
    
    try {
      if (recipeNameIdx >= 0 && row[recipeNameIdx]) {
        currentRecipeName = String(row[recipeNameIdx]).trim();
      }
      
      const ingredient = String(row[ingredientIdx] || '').trim();
      
      if (!ingredient || ingredient === '') continue;
      
      const validated = ImportRowSchema.parse({
        'Ingredient': ingredient,
        'Quantity (g)': safeParseNumber(row[quantityIdx]),
        'Sugars (g)': safeParseNumber(row[getColIdx('sugar')]),
        'Fat (g)': safeParseNumber(row[getColIdx('fat')]),
        'MSNF (g)': safeParseNumber(row[getColIdx('msnf')]),
        'Other Solids (g)': safeParseNumber(row[getColIdx('other')]),
        'Total Solids (g)': safeParseNumber(row[getColIdx('total', 'solids')])
      });
      
      if (validated['Quantity (g)'] > 0) {
        if (!recipesMap.has(currentRecipeName)) {
          recipesMap.set(currentRecipeName, []);
        }
        recipesMap.get(currentRecipeName)!.push(validated);
      }
    } catch (e) {
      // Skip invalid rows
    }
  }
  
  return recipesMap;
};

export default function Database() {
  const { toast } = useToast();
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
      setIsCheckingAuth(false);
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch database stats
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['database-stats'],
    queryFn: async () => {
      const [recipesRes, outcomesRes] = await Promise.all([
        supabase.from('recipes').select('id', { count: 'exact', head: true }),
        supabase.from('recipe_outcomes').select('id,outcome', { count: 'exact' })
      ]);

      const successfulOutcomes = outcomesRes.data?.filter(o => o.outcome === 'success').length || 0;

      return {
        totalRecipes: recipesRes.count || 0,
        totalOutcomes: outcomesRes.count || 0,
        successfulOutcomes,
        mlReady: successfulOutcomes >= 5
      };
    },
    refetchInterval: 5000,
    enabled: isAuthenticated
  });

  // Fetch recent recipes
  const { data: recentRecipes } = useQuery({
    queryKey: ['recent-recipes'],
    queryFn: async () => {
      const { data: recipes } = await supabase
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
            msnf_g,
            other_solids_g,
            total_solids_g
          ),
          calculated_metrics (
            total_quantity_g,
            sp,
            pac,
            fat_pct,
            sugars_pct
          )
        `)
        .order('created_at', { ascending: false })
        .limit(10);
      return recipes || [];
    },
    enabled: isAuthenticated
  });

  // Generate and download sample CSV
  const handleDownloadSample = () => {
    const sampleData = [
      ['Recipe Name', 'Ingredient', 'Quantity (g)', 'Sugars (g)', 'Fat (g)', 'MSNF (g)', 'Other Solids (g)', 'Total Solids (g)'],
      ['Vanilla Ice Cream', 'Whole Milk', '500', '0', '17.5', '42.5', '0', '60'],
      ['Vanilla Ice Cream', 'Heavy Cream', '200', '0', '80', '8', '0', '88'],
      ['Vanilla Ice Cream', 'Sugar', '150', '150', '0', '0', '0', '150'],
      ['Vanilla Ice Cream', 'Skim Milk Powder', '50', '0', '0.5', '46.5', '0', '47'],
      ['Vanilla Ice Cream', 'Vanilla Extract', '10', '1', '0', '0', '0', '1'],
      ['Vanilla Ice Cream', 'Stabilizer', '5', '0', '0', '0', '5', '5'],
      ['', '', '', '', '', '', '', ''],
      ['Chocolate Gelato', 'Whole Milk', '600', '0', '21', '51', '0', '72'],
      ['Chocolate Gelato', 'Sugar', '180', '180', '0', '0', '0', '180'],
      ['Chocolate Gelato', 'Cocoa Powder', '80', '0.4', '18.4', '0', '49.92', '68.72'],
      ['Chocolate Gelato', 'Cream', '100', '0', '40', '4', '0', '44'],
      ['Chocolate Gelato', 'Stabilizer', '4', '0', '0', '0', '4', '4']
    ];

    const csv = Papa.unparse(sampleData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'recipe_import_sample.csv';
    link.click();

    toast({
      title: 'Sample Downloaded',
      description: 'Fill in this template and upload to import your recipes'
    });
  };

  const handleImportCSV = async () => {
    if (!importFile) {
      toast({
        title: 'No File Selected',
        description: 'Please select a CSV file to import',
        variant: 'destructive'
      });
      return;
    }

    if (!isAuthenticated) {
      toast({
        title: 'Authentication Required',
        description: 'Please log in to import recipes',
        variant: 'destructive'
      });
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    try {
      console.log('📂 Starting CSV import with intelligent format detection...');

      Papa.parse(importFile, {
        header: false,
        skipEmptyLines: false,
        complete: async (results) => {
          try {
            const allRows = results.data as any[][];
            console.log(`📊 Parsed ${allRows.length} rows from CSV`);
            console.log('📋 First 3 rows:', allRows.slice(0, 3));

            // Detect file format
            const format = detectFileFormat(allRows);
            console.log(`🔍 Detected format: ${format}`);

            let recipesMap = new Map<string, z.infer<typeof ImportRowSchema>[]>();

            if (format === 'side-by-side') {
              recipesMap = parseSideBySideFormat(allRows);
            } else if (format === 'simple') {
              recipesMap = parseSimpleFormat(allRows);
            } else {
              throw new Error('Unable to detect CSV format. Your file may have a complex layout. Try the sample template format.');
            }

            console.log(`✅ Extracted ${recipesMap.size} recipes`);

            if (recipesMap.size === 0) {
              throw new Error(`No valid recipes found in CSV. Please check your file format.`);
            }

            // Import recipes
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');

            let imported = 0;
            const total = recipesMap.size;

            for (const [recipeName, rows] of recipesMap.entries()) {
              try {
                console.log(`💾 Importing recipe: ${recipeName}`);

                // Create recipe
                const { data: recipe, error: recipeError } = await supabase
                  .from('recipes')
                  .insert({
                    recipe_name: recipeName,
                    product_type: 'ice_cream',
                    user_id: user.id
                  } as any)
                  .select()
                  .single();

                if (recipeError) throw recipeError;

                // Insert all rows
                const { error: rowsError } = await supabase
                  .from('recipe_rows')
                  .insert(
                    rows.map(r => ({
                      recipe_id: recipe.id,
                      ingredient: r['Ingredient'],
                      quantity_g: r['Quantity (g)'],
                      sugars_g: r['Sugars (g)'] || 0,
                      fat_g: r['Fat (g)'] || 0,
                      msnf_g: r['MSNF (g)'] || 0,
                      other_solids_g: r['Other Solids (g)'] || 0,
                      total_solids_g: r['Total Solids (g)'] || 0
                    }))
                  );

                if (rowsError) throw rowsError;

                // Calculate metrics
                const totals = rows.reduce((acc, r) => ({
                  quantity: acc.quantity + (r['Quantity (g)'] || 0),
                  sugars: acc.sugars + (r['Sugars (g)'] || 0),
                  fat: acc.fat + (r['Fat (g)'] || 0),
                  msnf: acc.msnf + (r['MSNF (g)'] || 0),
                  other: acc.other + (r['Other Solids (g)'] || 0),
                  solids: acc.solids + (r['Total Solids (g)'] || 0)
                }), { quantity: 0, sugars: 0, fat: 0, msnf: 0, other: 0, solids: 0 });

                const sp = totals.quantity > 0 ? (totals.sugars / totals.quantity) * 100 : 0;
                const pac = totals.quantity > 0 ? ((totals.sugars * 1.9) / totals.quantity) * 100 : 0;

                // Store calculated metrics
                await supabase
                  .from('calculated_metrics')
                  .insert({
                    recipe_id: recipe.id,
                    total_quantity_g: totals.quantity,
                    total_sugars_g: totals.sugars,
                    total_fat_g: totals.fat,
                    total_msnf_g: totals.msnf,
                    total_other_solids_g: totals.other,
                    total_solids_g: totals.solids,
                    sugars_pct: totals.quantity > 0 ? (totals.sugars / totals.quantity) * 100 : 0,
                    fat_pct: totals.quantity > 0 ? (totals.fat / totals.quantity) * 100 : 0,
                    msnf_pct: totals.quantity > 0 ? (totals.msnf / totals.quantity) * 100 : 0,
                    other_solids_pct: totals.quantity > 0 ? (totals.other / totals.quantity) * 100 : 0,
                    total_solids_pct: totals.quantity > 0 ? (totals.solids / totals.quantity) * 100 : 0,
                    sp,
                    pac
                  });

                // Create outcome for ML training
                await supabase.from('recipe_outcomes').insert({
                  recipe_id: recipe.id,
                  user_id: user.id,
                  outcome: 'success',
                  notes: 'Imported from CSV'
                });

                imported++;
                setImportProgress((imported / total) * 100);
                console.log(`✅ Imported recipe "${recipeName}" (${imported}/${total})`);
              } catch (error: any) {
                console.error(`❌ Failed to import "${recipeName}":`, error.message);
              }
            }

            await refetchStats();

            toast({
              title: 'Import Complete',
              description: `Successfully imported ${imported} out of ${recipesMap.size} recipes`
            });

            setImportFile(null);
          } catch (error: any) {
            console.error('❌ Import error:', error);
            toast({
              title: 'Import Failed',
              description: error.message,
              variant: 'destructive'
            });
          } finally {
            setIsImporting(false);
            setImportProgress(0);
          }
        }
      });
    } catch (error: any) {
      toast({
        title: 'Import Failed',
        description: error.message,
        variant: 'destructive'
      });
      setIsImporting(false);
    }
  };

  const handleTrainModel = async () => {
    if (!stats?.mlReady) {
      toast({
        title: 'Insufficient Data',
        description: 'Need at least 5 successful recipes to train the model',
        variant: 'destructive'
      });
      return;
    }

    setIsTraining(true);

    try {
      const result = await mlService.trainModel();
      toast({
        title: 'Training Complete',
        description: `Model trained with ${result.accuracy.toFixed(1)}% confidence`,
      });
    } catch (error: any) {
      toast({
        title: 'Training Failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsTraining(false);
    }
  };

  const handleExportData = async () => {
    try {
      const { data: recipes } = await supabase
        .from('recipes')
        .select(`
          recipe_name,
          recipe_rows (
            ingredient,
            quantity_g,
            water_g,
            sugars_g,
            fat_g,
            msnf_g,
            other_solids_g,
            total_solids_g,
            lactose_g
          )
        `);

      if (!recipes || recipes.length === 0) {
        toast({ title: 'No Data', description: 'No recipes to export', variant: 'destructive' });
        return;
      }

      const flatData: any[] = [];
      recipes.forEach(recipe => {
        (recipe.recipe_rows as any[]).forEach(row => {
          flatData.push({
            'Recipe Name': recipe.recipe_name,
            'Ingredient': row.ingredient,
            'Quantity (g)': row.quantity_g,
            'Water (g)': row.water_g,
            'Sugars (g)': row.sugars_g,
            'Fat (g)': row.fat_g,
            'MSNF (g)': row.msnf_g,
            'Other Solids (g)': row.other_solids_g,
            'Total Solids (g)': row.total_solids_g,
            'Lactose (g)': row.lactose_g
          });
        });
      });

      const csv = Papa.unparse(flatData);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recipes-export-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();

      toast({ title: 'Export Complete', description: `Exported ${recipes.length} recipes` });
    } catch (error: any) {
      toast({ title: 'Export Failed', description: error.message, variant: 'destructive' });
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <DatabaseIcon className="h-8 w-8" />
            Database Manager
          </h1>
          <p className="text-muted-foreground">
            Import, train, and manage recipe data - supports complex CSV layouts
          </p>
        </div>
      </div>

      {!isAuthenticated && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You must be logged in. Please <Link to="/auth" className="font-medium underline">sign in</Link>.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Recipes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalRecipes || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Training Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.successfulOutcomes || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.mlReady ? '✓ Ready for training' : '✗ Need 5+ recipes'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Validation Status</CardTitle>
          </CardHeader>
          <CardContent>
            {mlService.loadModel() ? (
              <Badge variant="outline" className="text-green-600">Model Trained</Badge>
            ) : (
              <Badge variant="outline" className="text-yellow-600">Not Trained</Badge>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="ai-import" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ai-import">🤖 AI Import</TabsTrigger>
          <TabsTrigger value="recipe-import">📋 Recipe Import</TabsTrigger>
          <TabsTrigger value="import">Manual Import</TabsTrigger>
          <TabsTrigger value="recipes">View Recipes</TabsTrigger>
          <TabsTrigger value="train">ML Training</TabsTrigger>
        </TabsList>

        <TabsContent value="ai-import" className="space-y-4">
          <IntelligentCSVImporter />
        </TabsContent>

        <TabsContent value="recipe-import" className="space-y-4">
          <RecipeImporter />
        </TabsContent>

        <TabsContent value="import" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Import CSV Data</CardTitle>
              <CardDescription>
                Supports both simple and complex multi-recipe CSV layouts. Missing nutritional columns will be filled with 0.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>✅ Supports your complex CSV files!</strong>
                  <br />
                  • Works with side-by-side recipe layouts (like your MP_recipes.csv)
                  <br />
                  • Automatically detects recipe sections
                  <br />
                  • Only requires: Recipe Name, Ingredient, and Quantity columns
                  <br />
                  • All other nutritional data columns are optional
                </AlertDescription>
              </Alert>
              <div>
                <Label htmlFor="csv-file">Select CSV File</Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  disabled={!isAuthenticated || isImporting}
                />
              </div>
              {isImporting && (
                <div className="space-y-2">
                  <Progress value={importProgress} />
                  <p className="text-sm text-muted-foreground">Importing... {Math.round(importProgress)}%</p>
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={handleImportCSV} disabled={!importFile || isImporting}>
                  {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Import CSV
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    const sampleData = [
                      {
                        'Recipe Name': 'Vanilla Gelato',
                        'Ingredient': 'Whole Milk',
                        'Quantity (g)': 600,
                        'Sugars (g)': 30,
                        'Fat (g)': 18
                      },
                      {
                        'Recipe Name': 'Vanilla Gelato',
                        'Ingredient': 'Sugar',
                        'Quantity (g)': 150,
                        'Sugars (g)': 150,
                        'Fat (g)': 0
                      }
                    ];
                    const csv = Papa.unparse(sampleData);
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'simple-sample-format.csv';
                    a.click();
                    toast({ title: 'Sample Downloaded', description: 'Simple format template' });
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Sample
                </Button>
                <Button variant="outline" onClick={handleExportData} disabled={!isAuthenticated}>
                  <Download className="mr-2 h-4 w-4" />
                  Export All Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recipes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Recipes</CardTitle>
              <CardDescription>Last 10 imported recipes</CardDescription>
            </CardHeader>
            <CardContent>
              {recentRecipes && recentRecipes.length > 0 ? (
                <div className="space-y-4">
                  {recentRecipes.map((recipe: any) => (
                    <Card key={recipe.id}>
                      <CardHeader>
                        <CardTitle className="text-lg">{recipe.recipe_name}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Ingredient</TableHead>
                              <TableHead>Quantity (g)</TableHead>
                              <TableHead>Sugars (g)</TableHead>
                              <TableHead>Fat (g)</TableHead>
                              <TableHead>MSNF (g)</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(recipe.recipe_rows as any[])?.slice(0, 5).map((row: any, idx: number) => (
                              <TableRow key={idx}>
                                <TableCell>{row.ingredient}</TableCell>
                                <TableCell>{row.quantity_g}</TableCell>
                                <TableCell>{row.sugars_g}</TableCell>
                                <TableCell>{row.fat_g}</TableCell>
                                <TableCell>{row.msnf_g}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {recipe.calculated_metrics && (
                          <div className="mt-4 flex gap-4">
                            <Badge>SP: {recipe.calculated_metrics[0]?.sp?.toFixed(1)}</Badge>
                            <Badge>PAC: {recipe.calculated_metrics[0]?.pac?.toFixed(1)}</Badge>
                            <Badge>Fat: {recipe.calculated_metrics[0]?.fat_pct?.toFixed(1)}%</Badge>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No recipes imported yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="train">
          <Card>
            <CardHeader>
              <CardTitle>Recipe Analysis Training</CardTitle>
              <CardDescription>Mark recipes as successful and train the analysis model</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <div className="text-2xl font-bold">{stats?.totalRecipes || 0}</div>
                  <p className="text-xs text-muted-foreground">Total Recipes</p>
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats?.successfulOutcomes || 0}</div>
                  <p className="text-xs text-muted-foreground">Marked Successful</p>
                </div>
                <div>
                  <Badge variant={stats?.mlReady ? 'default' : 'secondary'}>
                    {stats?.mlReady ? 'Ready' : 'Need 5+'}
                  </Badge>
                </div>
              </div>
              
              <Button onClick={handleTrainModel} disabled={!stats?.mlReady || isTraining} className="w-full">
                {isTraining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
                Train Model Now
              </Button>

              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold mb-3">Recent Recipes - Mark as Successful</h4>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {recentRecipes?.map((recipe: any) => (
                    <div key={recipe.id} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{recipe.recipe_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {recipe.recipe_rows?.length || 0} ingredients
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            const { data: { user } } = await supabase.auth.getUser();
                            await supabase.from('recipe_outcomes').insert({
                              recipe_id: recipe.id,
                              user_id: user!.id,
                              outcome: 'success'
                            });
                            toast({ title: 'Marked Successful' });
                            refetchStats();
                          } catch (error: any) {
                            toast({ title: 'Error', description: error.message, variant: 'destructive' });
                          }
                        }}
                      >
                        Mark Success
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
