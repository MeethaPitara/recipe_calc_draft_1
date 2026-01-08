import { useMemo, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2, Beaker, Package, FileText, Download, Sparkles, BookOpen, Calculator } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { pasteAdvisorService } from '@/services/pasteAdvisorService';
import { getAllIngredients } from '@/services/ingredientService';
import { useToast } from '@/hooks/use-toast';
import { generateId } from '@/lib/utils';
import FDPowderGenerator from '@/components/FDPowderGenerator';
import SpreadabilityControls from '@/components/SpreadabilityControls';
import ReverseEngineerPaste from '@/components/ReverseEngineerPaste';
import type { PasteFormula, PreservationAdvice, PasteComponent, ScientificRecipe } from '@/types/paste';
import type { IngredientData } from '@/types/ingredients';

export default function PasteStudio() {
  const { toast } = useToast();
  
  // Load ingredients from Supabase
  const { data: library = [], isLoading: isLoadingIngredients } = useQuery({
    queryKey: ['ingredients'],
    queryFn: getAllIngredients,
    staleTime: 1000 * 60 * 5 // Cache for 5 minutes
  });
  
  const [paste, setPaste] = useState<PasteFormula>(() => ({
    id: generateId(), 
    name: 'New Paste', 
    category: 'mixed',
    components: [], 
    batch_size_g: 1000,
    water_pct: 0, 
    sugars_pct: 0, 
    fat_pct: 0, 
    msnf_pct: 0, 
    other_solids_pct: 0,
    lab: { brix_deg: undefined, pH: undefined }
  }));
  
  const [advice, setAdvice] = useState<PreservationAdvice[] | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PreservationAdvice | null>(null);
  const [scientificRecipe, setScientificRecipe] = useState<ScientificRecipe | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const composed = useMemo(() => {
    const tot = paste.components.reduce((a, c) => a + c.grams, 0) || 1;
    const w = (k: 'water_pct' | 'sugars_pct' | 'fat_pct' | 'msnf_pct' | 'other_solids_pct') =>
      paste.components.reduce((s, c) => s + (c[k] || 0) * c.grams / tot, 0);
    
    return {
      ...paste,
      water_pct: w('water_pct'),
      sugars_pct: w('sugars_pct'),
      fat_pct: w('fat_pct'),
      msnf_pct: w('msnf_pct'),
      other_solids_pct: w('other_solids_pct')
    };
  }, [paste]);

  const viscosityData = useMemo(() => 
    pasteAdvisorService.calculateViscosityProxy(composed),
    [composed]
  );

  const runAdvisor = useCallback(() => {
    const newAdvice = pasteAdvisorService.advise(composed, { 
      ambientPreferred: true, 
      particulate_mm: 3, 
      cleanLabel: true 
    });
    setAdvice(newAdvice);
    toast({
      title: "Preservation Analysis Complete",
      description: `Found ${newAdvice.length} preservation methods for your paste.`
    });
  }, [composed, toast]);

  const addComponent = useCallback(() => {
    const newComponent: PasteComponent = {
      id: generateId(),
      name: '',
      grams: 100,
      water_pct: 0,
      sugars_pct: 0,
      fat_pct: 0,
      msnf_pct: 0,
      other_solids_pct: 0
    };
    setPaste(p => ({
      ...p,
      components: [...p.components, newComponent]
    }));
  }, []);

  const updateComponent = useCallback((id: string, updates: Partial<PasteComponent>) => {
    setPaste(p => ({
      ...p,
      components: p.components.map(c => c.id === id ? { ...c, ...updates } : c)
    }));
  }, []);

  const removeComponent = useCallback((id: string) => {
    setPaste(p => ({
      ...p,
      components: p.components.filter(c => c.id !== id)
    }));
  }, []);

  const loadFromIngredient = useCallback((componentId: string, ingredientName: string) => {
    const ingredient = library.find(i => i.name === ingredientName);
    if (ingredient) {
      updateComponent(componentId, {
        name: ingredient.name,
        water_pct: ingredient.water_pct,
        sugars_pct: ingredient.sugars_pct || 0,
        fat_pct: ingredient.fat_pct,
        msnf_pct: ingredient.msnf_pct || 0,
        other_solids_pct: ingredient.other_solids_pct || 0
      });
    }
  }, [library, updateComponent]);

  const generateAIFormulation = useCallback(async (mode: 'standard' | 'ai_discovery') => {
    if (!paste.name || paste.components.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please add a paste name and at least one component.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    try {
      const recipe = await pasteAdvisorService.generateScientificFormulation(
        paste.name,
        paste.category,
        mode,
        paste.components.map(c => c.name).join(', '),
        `Target batch: ${paste.batch_size_g}g`
      );
      setScientificRecipe(recipe);
      toast({
        title: "Scientific Recipe Generated",
        description: `${recipe.paste_name} formulation complete with ${recipe.references.length} citations.`,
      });
    } catch (error) {
      console.error('Formulation error:', error);
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate recipe. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  }, [paste, toast]);

  const exportAsIngredient = () => {
    toast({
      title: "Paste Exported",
      description: `${composed.name} ready for integration into recipe database`,
    });
    console.log('Export paste:', composed);
  };

  const handleFDExport = (powder: PasteFormula) => {
    toast({
      title: "FD Powder Generated",
      description: `${powder.name} ready for export`,
    });
    console.log('FD Powder:', powder);
  };

  return (
    <main className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Paste Studio</h1>
            <p className="text-muted-foreground mt-1">AI-powered scientific formulation for authentic Indian gelato pastes</p>
          </div>
          <Button onClick={runAdvisor} className="bg-gradient-primary text-primary-foreground shadow-elegant" aria-label="Run AI-powered preservation analysis">
            <Beaker className="h-4 w-4 mr-2" />
            Run Preservation Advisor
          </Button>
        </header>

        {/* AI Generation Buttons */}
        <div className="flex gap-3 justify-end">
          <Button 
            onClick={() => generateAIFormulation('standard')} 
            disabled={isGenerating}
            className="bg-gradient-primary"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {isGenerating ? 'Generating...' : 'AI Recipe Generator'}
          </Button>
          <Button 
            onClick={() => generateAIFormulation('ai_discovery')} 
            disabled={isGenerating}
            variant="outline"
          >
            <BookOpen className="h-4 w-4 mr-2" />
            {isGenerating ? 'Discovering...' : 'AI Discovery Mode'}
          </Button>
        </div>

        <Tabs defaultValue="formulation" className="w-full">
          <TabsList className="w-full h-auto flex flex-wrap md:grid md:grid-cols-7 gap-1 md:gap-2 p-2 overflow-x-auto bg-background/80 backdrop-blur-sm">
            <TabsTrigger value="formulation" className="flex-1 min-w-[100px] text-xs md:text-sm whitespace-nowrap">Formulation</TabsTrigger>
            <TabsTrigger value="viscosity" className="flex-1 min-w-[100px] text-xs md:text-sm whitespace-nowrap">Spreadability</TabsTrigger>
            <TabsTrigger value="reverse" className="flex-1 min-w-[100px] text-xs md:text-sm whitespace-nowrap">Reverse</TabsTrigger>
            <TabsTrigger value="scientific" className="flex-1 min-w-[100px] text-xs md:text-sm whitespace-nowrap">AI Recipe</TabsTrigger>
            <TabsTrigger value="preservation" className="flex-1 min-w-[100px] text-xs md:text-sm whitespace-nowrap">Preservation</TabsTrigger>
            <TabsTrigger value="fd-powder" className="flex-1 min-w-[100px] text-xs md:text-sm whitespace-nowrap">FD Powder</TabsTrigger>
            <TabsTrigger value="export" className="flex-1 min-w-[100px] text-xs md:text-sm whitespace-nowrap">Export</TabsTrigger>
          </TabsList>

          <TabsContent value="formulation" className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold">Paste Formulation</h3>
                  <p className="text-sm text-muted-foreground">Build your paste from sub-ingredients</p>
                </div>
                <Button onClick={addComponent} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Component
                </Button>
              </div>

              {/* Paste Name & Category */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <Label htmlFor="paste-name">Paste Name</Label>
                  <Input
                    id="paste-name"
                    value={paste.name}
                    onChange={(e) => setPaste(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g., Gulab Jamun Paste"
                  />
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select value={paste.category} onValueChange={(value: any) => setPaste(p => ({ ...p, category: value }))}>
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
                <div>
                  <Label htmlFor="batch-size">Batch Size (g)</Label>
                  <Input
                    id="batch-size"
                    type="number"
                    value={paste.batch_size_g}
                    onChange={(e) => setPaste(p => ({ ...p, batch_size_g: Number(e.target.value) }))}
                  />
                </div>
              </div>

              {/* Components Table */}
              <div className="space-y-4">
                {paste.components.map((component) => (
                  <Card key={component.id} className="p-4 bg-card-secondary">
                    <div className="grid grid-cols-1 md:grid-cols-8 gap-4 items-end">
                      <div className="md:col-span-2">
                        <Label>Ingredient</Label>
                        <Select value={component.name} onValueChange={(value) => loadFromIngredient(component.id, value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select ingredient" />
                          </SelectTrigger>
                          <SelectContent>
                            {library.map(ing => (
                              <SelectItem key={ing.id} value={ing.name}>{ing.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Grams</Label>
                        <Input
                          type="number"
                          value={component.grams}
                          onChange={(e) => updateComponent(component.id, { grams: Number(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label>Water %</Label>
                        <Input
                          type="number"
                          value={component.water_pct}
                          onChange={(e) => updateComponent(component.id, { water_pct: Number(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label>Sugars %</Label>
                        <Input
                          type="number"
                          value={component.sugars_pct || 0}
                          onChange={(e) => updateComponent(component.id, { sugars_pct: Number(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label>Fat %</Label>
                        <Input
                          type="number"
                          value={component.fat_pct}
                          onChange={(e) => updateComponent(component.id, { fat_pct: Number(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label>MSNF %</Label>
                        <Input
                          type="number"
                          value={component.msnf_pct || 0}
                          onChange={(e) => updateComponent(component.id, { msnf_pct: Number(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeComponent(component.id)}
                          className="text-destructive hover:text-destructive"
                          aria-label={`Remove ${component.name || 'component'}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Computed Composition */}
              <Separator className="my-6" />
              <div className="space-y-4">
                <h4 className="font-medium">Computed Composition</h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                  <div className="text-center p-3 bg-card-secondary rounded-lg">
                    <div className="font-medium">Water</div>
                    <div className="text-lg text-primary">{composed.water_pct.toFixed(1)}%</div>
                  </div>
                  <div className="text-center p-3 bg-card-secondary rounded-lg">
                    <div className="font-medium">Sugars</div>
                    <div className="text-lg text-primary">{composed.sugars_pct?.toFixed(1) || '0.0'}%</div>
                  </div>
                  <div className="text-center p-3 bg-card-secondary rounded-lg">
                    <div className="font-medium">Fat</div>
                    <div className="text-lg text-primary">{composed.fat_pct.toFixed(1)}%</div>
                  </div>
                  <div className="text-center p-3 bg-card-secondary rounded-lg">
                    <div className="font-medium">MSNF</div>
                    <div className="text-lg text-primary">{composed.msnf_pct?.toFixed(1) || '0.0'}%</div>
                  </div>
                  <div className="text-center p-3 bg-card-secondary rounded-lg">
                    <div className="font-medium">Total Solids</div>
                    <div className="text-lg text-primary">{(100 - composed.water_pct).toFixed(1)}%</div>
                  </div>
                </div>

                {/* Lab Specs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div>
                    <Label htmlFor="brix">°Brix</Label>
                    <Input
                      id="brix"
                      type="number"
                      step="0.1"
                      value={paste.lab?.brix_deg || ''}
                      onChange={(e) => setPaste(p => ({
                        ...p, 
                        lab: { ...p.lab, brix_deg: e.target.value ? Number(e.target.value) : undefined }
                      }))}
                      placeholder="e.g., 65.0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="pH">pH</Label>
                    <Input
                      id="pH"
                      type="number"
                      step="0.1"
                      value={paste.lab?.pH || ''}
                      onChange={(e) => setPaste(p => ({
                        ...p, 
                        lab: { ...p.lab, pH: e.target.value ? Number(e.target.value) : undefined }
                      }))}
                      placeholder="e.g., 4.2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="aw">aw (optional)</Label>
                    <Input
                      id="aw"
                      type="number"
                      step="0.01"
                      value={paste.lab?.aw_est || ''}
                      onChange={(e) => setPaste(p => ({
                        ...p, 
                        lab: { ...p.lab, aw_est: e.target.value ? Number(e.target.value) : undefined }
                      }))}
                      placeholder="e.g., 0.85"
                    />
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>


          <TabsContent value="viscosity" className="space-y-6">
            <SpreadabilityControls paste={composed} viscosityData={viscosityData} />
          </TabsContent>

          <TabsContent value="reverse" className="space-y-6">
            <ReverseEngineerPaste />
          </TabsContent>

          <TabsContent value="scientific" className="space-y-6">
            {!scientificRecipe ? (
              <Card className="p-12 text-center">
                <Sparkles className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">AI Scientific Recipe Generator</h3>
                <p className="text-muted-foreground mb-6">
                  Generate industry-standard recipes with scientific citations, process parameters, and gelato compatibility analysis.
                </p>
                <div className="flex gap-4 justify-center">
                  <Button onClick={() => generateAIFormulation('standard')} disabled={isGenerating}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Recipe
                  </Button>
                  <Button onClick={() => generateAIFormulation('ai_discovery')} disabled={isGenerating} variant="outline">
                    <BookOpen className="h-4 w-4 mr-2" />
                    Discover Novel Pairing
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Recipe Header */}
                <Card className="p-6 bg-gradient-subtle">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-2xl font-bold">{scientificRecipe.paste_name}</h2>
                      <div className="flex gap-3 mt-2">
                        <Badge variant="secondary">{scientificRecipe.category}</Badge>
                        <Badge variant="outline">{scientificRecipe.yield_kg}kg batch</Badge>
                        <Badge>{(scientificRecipe.ai_confidence * 100).toFixed(0)}% confidence</Badge>
                      </div>
                    </div>
                    {scientificRecipe.novel_pairing?.discovered && (
                      <Badge className="bg-gradient-primary text-primary-foreground">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Novel Pairing
                      </Badge>
                    )}
                  </div>
                </Card>

                {/* Composition */}
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Composition Analysis</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="text-center p-3 bg-card-secondary rounded-lg">
                      <div className="text-sm text-muted-foreground">Fat</div>
                      <div className="text-xl font-semibold text-primary">{scientificRecipe.composition.fat_pct.toFixed(1)}%</div>
                    </div>
                    <div className="text-center p-3 bg-card-secondary rounded-lg">
                      <div className="text-sm text-muted-foreground">MSNF</div>
                      <div className="text-xl font-semibold text-primary">{scientificRecipe.composition.msnf_pct.toFixed(1)}%</div>
                    </div>
                    <div className="text-center p-3 bg-card-secondary rounded-lg">
                      <div className="text-sm text-muted-foreground">Sugars</div>
                      <div className="text-xl font-semibold text-primary">{scientificRecipe.composition.sugars_pct.toFixed(1)}%</div>
                    </div>
                    <div className="text-center p-3 bg-card-secondary rounded-lg">
                      <div className="text-sm text-muted-foreground">Water</div>
                      <div className="text-xl font-semibold text-primary">{scientificRecipe.composition.water_pct.toFixed(1)}%</div>
                    </div>
                    <div className="text-center p-3 bg-card-secondary rounded-lg">
                      <div className="text-sm text-muted-foreground">Water Activity</div>
                      <div className="text-xl font-semibold text-primary">{scientificRecipe.composition.water_activity.toFixed(2)}</div>
                    </div>
                  </div>
                </Card>

                {/* Ingredients */}
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Scientific Ingredient Formulation</h3>
                  <div className="space-y-3">
                    {scientificRecipe.ingredients.map((ing, i) => (
                      <div key={i} className="flex items-start gap-4 p-3 bg-card-secondary rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium">{ing.name}</div>
                          <div className="text-sm text-muted-foreground">{ing.function}</div>
                          {ing.alternative && (
                            <div className="text-xs text-muted-foreground mt-1">Alternative: {ing.alternative}</div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{ing.grams}g</div>
                          <div className="text-sm text-muted-foreground">{ing.percentage.toFixed(1)}%</div>
                        </div>
                        <Badge variant="outline" className="text-xs">{ing.reference}</Badge>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Process */}
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Process Steps</h3>
                  <div className="space-y-4">
                    {scientificRecipe.process.map((step) => (
                      <div key={step.step} className="flex gap-4">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                          {step.step}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{step.action}</div>
                          {(step.temperature || step.time) && (
                            <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                              {step.temperature && <span>🌡️ {step.temperature}°C</span>}
                              {step.time && <span>⏱️ {step.time} min</span>}
                            </div>
                          )}
                          {step.critical_control && (
                            <div className="text-sm text-warning mt-1">⚠️ {step.critical_control}</div>
                          )}
                          <div className="text-sm text-muted-foreground mt-2">{step.rationale}</div>
                          <div className="flex gap-2 mt-1">
                            {step.references.map((ref, i) => (
                              <Badge key={i} variant="outline" className="text-xs">{ref}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Gelato Application */}
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Gelato Application</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium mb-2">Dosage Recommendation</h4>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div>Minimum: {scientificRecipe.gelato_dosage.min_pct}%</div>
                        <div>Maximum: {scientificRecipe.gelato_dosage.max_pct}%</div>
                        <div className="font-semibold text-primary">Recommended: {scientificRecipe.gelato_dosage.recommended_pct}%</div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Sensory Prediction</h4>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div><strong>Mouthfeel:</strong> {scientificRecipe.sensory_prediction.mouthfeel}</div>
                        <div><strong>Flavor:</strong> {scientificRecipe.sensory_prediction.flavor_profile}</div>
                        <div><strong>Color:</strong> {scientificRecipe.sensory_prediction.color}</div>
                        <div><strong>Shelf Life:</strong> {scientificRecipe.sensory_prediction.shelf_life}</div>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* References */}
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Scientific References</h3>
                  <div className="space-y-3">
                    {scientificRecipe.references.map((ref) => (
                      <div key={ref.id} className="p-3 bg-card-secondary rounded-lg">
                        <div className="flex items-start gap-3">
                          <Badge variant="outline">{ref.id}</Badge>
                          <div className="flex-1">
                            <div className="font-medium">{ref.source}</div>
                            <div className="text-sm text-muted-foreground">{ref.title}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              <strong>Relevance:</strong> {ref.relevance}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="preservation" className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Preservation Methods</h3>
              
              {!advice ? (
                <div className="text-center py-12">
                  <Beaker className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">Run the Preservation Advisor to get recommendations</p>
                  <Button onClick={runAdvisor} className="bg-gradient-primary">
                    <Beaker className="h-4 w-4 mr-2" />
                    Analyze Preservation Options
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {advice.map((method, i) => (
                    <Card 
                      key={i} 
                      className={`p-4 cursor-pointer transition-all ${
                        selectedMethod?.method === method.method 
                          ? 'ring-2 ring-primary bg-primary/5' 
                          : 'hover:bg-card-secondary'
                      }`}
                      onClick={() => setSelectedMethod(method)}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className="text-lg font-semibold px-3 py-1">
                            {method.method.toUpperCase()}
                          </Badge>
                          <Badge variant="outline">
                            {(method.confidence * 100).toFixed(0)}% Confidence
                          </Badge>
                          <Badge variant={method.storage === 'ambient' ? 'default' : method.storage === 'frozen' ? 'secondary' : 'outline'}>
                            {method.storage.toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div>
                          <strong>Why:</strong> {method.why.join(' • ')}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                          <div>
                            <strong>Targets:</strong>
                            <div className="text-muted-foreground">
                              {method.targets.brix_deg && `°Bx ≥ ${method.targets.brix_deg} `}
                              {method.targets.pH && `pH ≤ ${method.targets.pH} `}
                              {method.targets.aw_max && `aw ≤ ${method.targets.aw_max} `}
                              {method.targets.particle_mm_max && `Particle ≤ ${method.targets.particle_mm_max}mm`}
                            </div>
                          </div>
                          
                          <div>
                            <strong>Packaging:</strong>
                            <div className="text-muted-foreground">{method.packaging.join(', ')}</div>
                          </div>
                        </div>
                        
                        <div>
                          <strong>Gelato Impact:</strong>
                          <div className="flex gap-4 text-muted-foreground">
                            <span>Aroma: {method.impact_on_gelato.aroma_retention}</span>
                            <span>Browning: {method.impact_on_gelato.color_browning}</span>
                          </div>
                        </div>
                        
                        <div className="text-muted-foreground">
                          <strong>Shelf Life:</strong> {method.shelf_life_hint}
                        </div>
                      </div>
                    </Card>
                  ))}
                  
                  <div className="text-xs text-muted-foreground mt-4 p-3 bg-warning/10 rounded-lg border border-warning/20">
                    ⚠️ <strong>Important:</strong> These are guidance recommendations only. All thermal processes must be validated by a qualified process authority for commercial use.
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="sop" className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Standard Operating Procedure</h3>
              </div>
              
              {!selectedMethod ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Select a preservation method to generate SOP template</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
                    <h4 className="font-semibold text-lg mb-2">SOP: {selectedMethod.method.toUpperCase()} Process</h4>
                    <p className="text-sm text-muted-foreground">Method: {paste.name} - {selectedMethod.method}</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h5 className="font-medium">Process Parameters</h5>
                      <div className="space-y-3">
                        <div>
                          <Label>Fill Temperature (°C)</Label>
                          <Input placeholder="e.g., 85" />
                        </div>
                        <div>
                          <Label>Hold Time (minutes)</Label>
                          <Input placeholder="e.g., 15" />
                        </div>
                        <div>
                          <Label>Cooling Rate (°C/min)</Label>
                          <Input placeholder="e.g., 5" />
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <h5 className="font-medium">Quality Control</h5>
                      <div className="space-y-3">
                        <div>
                          <Label>Final pH Target</Label>
                          <Input value={selectedMethod.targets.pH || ''} readOnly />
                        </div>
                        <div>
                          <Label>°Brix Target</Label>
                          <Input value={selectedMethod.targets.brix_deg || ''} readOnly />
                        </div>
                        <div>
                          <Label>Water Activity Target</Label>
                          <Input value={selectedMethod.targets.aw_max || ''} readOnly />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h5 className="font-medium mb-3">Packaging & Storage Instructions</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card className="p-4">
                        <h6 className="font-medium mb-2">Recommended Packaging</h6>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {selectedMethod.packaging.map((pkg, i) => (
                            <li key={i}>• {pkg}</li>
                          ))}
                        </ul>
                      </Card>
                      <Card className="p-4">
                        <h6 className="font-medium mb-2">Storage Conditions</h6>
                        <div className="text-sm text-muted-foreground">
                          <p><strong>Storage:</strong> {selectedMethod.storage}</p>
                          <p><strong>Shelf Life:</strong> {selectedMethod.shelf_life_hint}</p>
                        </div>
                      </Card>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="fd-powder" className="space-y-6">
            <FDPowderGenerator paste={composed} onExport={handleFDExport} />
          </TabsContent>

          <TabsContent value="export" className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Package className="h-5 w-5" />
                <h3 className="text-lg font-semibold">Export Options</h3>
              </div>
              
              <div className="space-y-6">
                <Card className="p-4">
                  <h4 className="font-medium mb-2">Save as Ingredient</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Add this paste to your ingredient database for use in gelato formulations.
                  </p>
                  <Button onClick={exportAsIngredient} className="w-full bg-success text-success-foreground">
                    <Download className="h-4 w-4 mr-2" />
                    Export to Ingredients DB
                  </Button>
                </Card>
                
                {/* Impact Preview */}
                <div className="space-y-4">
                  <h4 className="font-medium">Gelato Base Impact Preview</h4>
                  <p className="text-sm text-muted-foreground">
                    See how this paste affects a standard gelato base at different inclusion rates:
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[5, 8, 12].map(percentage => (
                      <Card key={percentage} className="p-4 text-center">
                        <div className="font-medium text-lg mb-2">{percentage}% Inclusion</div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div>Water: +{((composed.water_pct * percentage) / 100).toFixed(1)}%</div>
                          <div>Sugars: +{((composed.sugars_pct || 0) * percentage / 100).toFixed(1)}%</div>
                          <div>Fat: +{((composed.fat_pct * percentage) / 100).toFixed(1)}%</div>
                        </div>
                        <Button variant="outline" size="sm" className="mt-3" aria-label={`Auto-balance gelato base with ${percentage}% inclusion`}>
                          Auto-balance Base
                        </Button>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
