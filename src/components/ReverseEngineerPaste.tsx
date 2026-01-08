import { useState } from 'react';
import { Calculator, Sparkles, TrendingUp, DollarSign, Leaf } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { pasteAdvisorService } from '@/services/pasteAdvisorService';
import type { ScientificRecipe } from '@/types/paste';

export default function ReverseEngineerPaste() {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [recipes, setRecipes] = useState<ScientificRecipe[]>([]);
  
  const [targets, setTargets] = useState({
    pasteType: '',
    category: 'mixed' as const,
    sp: 20,
    afp: 28,
    total_solids: 65,
    fat_pct: 15,
    viscosity: 'spreadable' as const,
    knownIngredients: '',
    constraints: ''
  });

  const runReverseEngineering = async () => {
    if (!targets.pasteType) {
      toast({
        title: "Missing Information",
        description: "Please provide a paste type/name.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    try {
      const recipe = await pasteAdvisorService.generateScientificFormulation(
        targets.pasteType,
        targets.category,
        'reverse_engineer',
        targets.knownIngredients,
        targets.constraints,
        {
          sp: targets.sp,
          afp: targets.afp,
          total_solids: targets.total_solids,
          fat_pct: targets.fat_pct,
          viscosity: targets.viscosity
        }
      );
      
      setRecipes([recipe]);
      toast({
        title: "Reverse Engineering Complete",
        description: `Generated formulations for ${targets.pasteType}`,
      });
    } catch (error) {
      console.error('Reverse engineering error:', error);
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate formulations.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Calculator className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-semibold">Reverse Engineering</h2>
            <p className="text-sm text-muted-foreground">Define targets and let AI propose formulations</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="paste-type">Paste Type/Name</Label>
              <Input
                id="paste-type"
                value={targets.pasteType}
                onChange={(e) => setTargets(t => ({ ...t, pasteType: e.target.value }))}
                placeholder="e.g., Premium Pistachio Paste"
              />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={targets.category} onValueChange={(value: any) => setTargets(t => ({ ...t, category: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dairy">Dairy</SelectItem>
                  <SelectItem value="fruit">Fruit</SelectItem>
                  <SelectItem value="confection">Confection</SelectItem>
                  <SelectItem value="spice">Spice</SelectItem>
                  <SelectItem value="nut">Nut</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Target Parameters */}
          <div className="space-y-4">
            <h3 className="font-medium">Target Parameters</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="sp">Sweetness Power (SP): {targets.sp}</Label>
                <Slider
                  id="sp"
                  value={[targets.sp]}
                  onValueChange={([val]) => setTargets(t => ({ ...t, sp: val }))}
                  min={10}
                  max={30}
                  step={1}
                />
                <p className="text-xs text-muted-foreground">Milk: 12-22, Fruit: 18-26, Sorbet: 20-28</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="afp">Anti-Freezing Power (AFP): {targets.afp}</Label>
                <Slider
                  id="afp"
                  value={[targets.afp]}
                  onValueChange={([val]) => setTargets(t => ({ ...t, afp: val }))}
                  min={20}
                  max={35}
                  step={1}
                />
                <p className="text-xs text-muted-foreground">Milk: 22-28, Fruit: 25-29, Sorbet: 28-33</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="total-solids">Total Solids %: {targets.total_solids}</Label>
                <Slider
                  id="total-solids"
                  value={[targets.total_solids]}
                  onValueChange={([val]) => setTargets(t => ({ ...t, total_solids: val }))}
                  min={40}
                  max={85}
                  step={5}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fat">Fat %: {targets.fat_pct}</Label>
                <Slider
                  id="fat"
                  value={[targets.fat_pct]}
                  onValueChange={([val]) => setTargets(t => ({ ...t, fat_pct: val }))}
                  min={0}
                  max={60}
                  step={5}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="viscosity">Target Texture</Label>
              <Select value={targets.viscosity} onValueChange={(value: any) => setTargets(t => ({ ...t, viscosity: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pourable">Pourable (syrup-like)</SelectItem>
                  <SelectItem value="spreadable">Spreadable (Nutella-like)</SelectItem>
                  <SelectItem value="thick">Thick (butter-like)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Constraints */}
          <div className="space-y-4">
            <h3 className="font-medium">Constraints & Preferences</h3>
            
            <div>
              <Label htmlFor="ingredients">Allowed/Preferred Ingredients (optional)</Label>
              <Input
                id="ingredients"
                value={targets.knownIngredients}
                onChange={(e) => setTargets(t => ({ ...t, knownIngredients: e.target.value }))}
                placeholder="e.g., pistachios, milk powder, glucose"
              />
            </div>

            <div>
              <Label htmlFor="constraints">Additional Constraints (optional)</Label>
              <Textarea
                id="constraints"
                value={targets.constraints}
                onChange={(e) => setTargets(t => ({ ...t, constraints: e.target.value }))}
                placeholder="e.g., organic only, no artificial colors, ambient storage"
                rows={3}
              />
            </div>
          </div>

          <Button 
            onClick={runReverseEngineering} 
            disabled={isGenerating}
            className="w-full bg-gradient-primary"
            size="lg"
          >
            <Sparkles className="h-5 w-5 mr-2" />
            {isGenerating ? 'Generating Formulations...' : 'Generate Formulations'}
          </Button>
        </div>
      </Card>

      {/* Results */}
      {recipes.length > 0 && (
        <div className="space-y-6">
          {recipes.map((recipe, idx) => (
            <Card key={idx} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {idx === 0 ? <TrendingUp className="h-5 w-5 text-primary" /> :
                   idx === 1 ? <DollarSign className="h-5 w-5 text-green-600" /> :
                   <Leaf className="h-5 w-5 text-green-600" />}
                  <h3 className="text-lg font-semibold">{recipe.paste_name}</h3>
                </div>
                <Badge variant="secondary">
                  {Math.round(recipe.ai_confidence * 100)}% Confidence
                </Badge>
              </div>

              {/* Composition */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                <div className="text-center p-3 bg-card-secondary rounded-lg">
                  <div className="text-xs text-muted-foreground">Fat</div>
                  <div className="text-lg font-semibold">{recipe.composition.fat_pct.toFixed(1)}%</div>
                </div>
                <div className="text-center p-3 bg-card-secondary rounded-lg">
                  <div className="text-xs text-muted-foreground">MSNF</div>
                  <div className="text-lg font-semibold">{recipe.composition.msnf_pct.toFixed(1)}%</div>
                </div>
                <div className="text-center p-3 bg-card-secondary rounded-lg">
                  <div className="text-xs text-muted-foreground">Sugars</div>
                  <div className="text-lg font-semibold">{recipe.composition.sugars_pct.toFixed(1)}%</div>
                </div>
                <div className="text-center p-3 bg-card-secondary rounded-lg">
                  <div className="text-xs text-muted-foreground">Water</div>
                  <div className="text-lg font-semibold">{recipe.composition.water_pct.toFixed(1)}%</div>
                </div>
                <div className="text-center p-3 bg-card-secondary rounded-lg">
                  <div className="text-xs text-muted-foreground">aw</div>
                  <div className="text-lg font-semibold">{recipe.composition.water_activity.toFixed(2)}</div>
                </div>
              </div>

              {/* Ingredients */}
              <div className="mb-6">
                <h4 className="font-medium mb-3">Ingredients</h4>
                <div className="space-y-2">
                  {recipe.ingredients.map((ing, i) => (
                    <div key={i} className="flex justify-between items-center p-2 bg-card-secondary rounded">
                      <div className="flex-1">
                        <span className="font-medium">{ing.name}</span>
                        <span className="text-sm text-muted-foreground ml-2">({ing.function})</span>
                      </div>
                      <div className="flex gap-4 text-sm">
                        <span className="font-medium">{ing.grams}g</span>
                        <span className="text-muted-foreground">{ing.percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Gelato Dosage */}
              <div className="p-4 bg-primary/5 rounded-lg">
                <h4 className="font-medium mb-2">Gelato Application</h4>
                <p className="text-sm text-muted-foreground">
                  Recommended dosage: <span className="font-medium text-foreground">{recipe.gelato_dosage.recommended_pct}%</span>
                  {' '}(range: {recipe.gelato_dosage.min_pct}-{recipe.gelato_dosage.max_pct}%)
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
