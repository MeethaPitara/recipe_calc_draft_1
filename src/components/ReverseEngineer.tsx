import { useState } from 'react';
import { Calculator, Sparkles, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Row } from '@/lib/optimize';
import { calcMetricsV2 } from '@/lib/calc.v2';
import { advancedOptimize, OptimizerConfig } from '@/lib/optimize.advanced';

interface ReverseEngineerProps {
  onApplyRecipe?: (rows: Row[]) => void;
}

export default function ReverseEngineer({ onApplyRecipe }: ReverseEngineerProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedRecipe, setGeneratedRecipe] = useState<Row[] | null>(null);
  
  const [targets, setTargets] = useState({
    sugars_pct: 16,
    fat_pct: 8,
    msnf_pct: 10,
    ts_pct: 36,
    fpdt: -5.5
  });

  const runReverseEngineering = async () => {
    setIsGenerating(true);
    
    try {
      // Create initial recipe template with common ingredients
      // Note: These are placeholder ingredients - in production, fetch from database
      const initialRows: Row[] = [
        { 
          ing: { 
            id: 'whole_milk', name: 'Whole Milk', category: 'dairy' as const,
            water_pct: 87.5, fat_pct: 3.5, msnf_pct: 9, sugars_pct: 0, other_solids_pct: 0, lactose_pct: 5
          }, 
          grams: 600, min: 400, max: 700 
        },
        { 
          ing: { 
            id: 'cream_35', name: 'Cream 35%', category: 'dairy' as const,
            water_pct: 58, fat_pct: 35, msnf_pct: 7, sugars_pct: 0, other_solids_pct: 0, lactose_pct: 3
          }, 
          grams: 150, min: 50, max: 300 
        },
        { 
          ing: { 
            id: 'sucrose', name: 'Sucrose', category: 'sugar' as const,
            water_pct: 0, fat_pct: 0, msnf_pct: 0, sugars_pct: 100, other_solids_pct: 0
          }, 
          grams: 120, min: 80, max: 180 
        },
        { 
          ing: { 
            id: 'dextrose', name: 'Dextrose', category: 'sugar' as const,
            water_pct: 0, fat_pct: 0, msnf_pct: 0, sugars_pct: 100, other_solids_pct: 0
          }, 
          grams: 40, min: 20, max: 80 
        },
        { 
          ing: { 
            id: 'skim_milk_powder', name: 'Skim Milk Powder', category: 'dairy' as const,
            water_pct: 4, fat_pct: 1, msnf_pct: 95, sugars_pct: 0, other_solids_pct: 0, lactose_pct: 52
          }, 
          grams: 40, min: 20, max: 60 
        },
        { 
          ing: { 
            id: 'stabilizer', name: 'Stabilizer', category: 'other' as const,
            water_pct: 0, fat_pct: 0, msnf_pct: 0, sugars_pct: 0, other_solids_pct: 100
          }, 
          grams: 3, min: 2, max: 5 
        }
      ];

      // Use hybrid optimization (GA + hill-climbing) for best results
      const config: OptimizerConfig = {
        algorithm: 'hybrid',
        maxIterations: 150,
        populationSize: 40
      };

      const optimizedRecipe = advancedOptimize(initialRows, targets, config);
      const metrics = calcMetricsV2(optimizedRecipe);
      
      setGeneratedRecipe(optimizedRecipe);
      
      toast({
        title: "Recipe Generated",
        description: `Created recipe with ${metrics.totalSugars_pct.toFixed(1)}% sugars, ${metrics.fat_pct.toFixed(1)}% fat`,
      });
    } catch (error) {
      console.error('Reverse engineering error:', error);
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate recipe.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const applyRecipe = () => {
    if (generatedRecipe && onApplyRecipe) {
      onApplyRecipe(generatedRecipe);
      toast({
        title: "Recipe Applied",
        description: "Generated recipe has been loaded into the calculator"
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Reverse Engineering
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Define your target metrics and let AI generate a recipe that meets them
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Target Parameters */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              Target Parameters
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Sugars %: {targets.sugars_pct}</Label>
                <Slider
                  value={[targets.sugars_pct]}
                  onValueChange={([val]) => setTargets(t => ({ ...t, sugars_pct: val }))}
                  min={12}
                  max={22}
                  step={0.5}
                />
                <p className="text-xs text-muted-foreground">Typical range: 14-18%</p>
              </div>

              <div className="space-y-2">
                <Label>Fat %: {targets.fat_pct}</Label>
                <Slider
                  value={[targets.fat_pct]}
                  onValueChange={([val]) => setTargets(t => ({ ...t, fat_pct: val }))}
                  min={3}
                  max={16}
                  step={0.5}
                />
                <p className="text-xs text-muted-foreground">Ice cream: 8-14%, Gelato: 4-9%</p>
              </div>

              <div className="space-y-2">
                <Label>MSNF %: {targets.msnf_pct}</Label>
                <Slider
                  value={[targets.msnf_pct]}
                  onValueChange={([val]) => setTargets(t => ({ ...t, msnf_pct: val }))}
                  min={8}
                  max={14}
                  step={0.5}
                />
                <p className="text-xs text-muted-foreground">Typical range: 9-12%</p>
              </div>

              <div className="space-y-2">
                <Label>Total Solids %: {targets.ts_pct}</Label>
                <Slider
                  value={[targets.ts_pct]}
                  onValueChange={([val]) => setTargets(t => ({ ...t, ts_pct: val }))}
                  min={30}
                  max={42}
                  step={0.5}
                />
                <p className="text-xs text-muted-foreground">Ice cream: 36-40%, Gelato: 32-38%</p>
              </div>

              <div className="space-y-2">
                <Label>Freezing Point °C: {targets.fpdt}</Label>
                <Slider
                  value={[targets.fpdt]}
                  onValueChange={([val]) => setTargets(t => ({ ...t, fpdt: val }))}
                  min={-7}
                  max={-4}
                  step={0.1}
                />
                <p className="text-xs text-muted-foreground">Typical: -5°C to -6°C</p>
              </div>
            </div>
          </div>

          <Button 
            onClick={runReverseEngineering} 
            disabled={isGenerating}
            className="w-full"
            size="lg"
          >
            <Sparkles className="h-5 w-5 mr-2" />
            {isGenerating ? 'Generating Recipe...' : 'Generate Recipe'}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {generatedRecipe && (
        <Card>
          <CardHeader>
            <CardTitle>Generated Recipe</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {generatedRecipe.map((row, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 bg-card-secondary rounded-lg">
                  <span className="font-medium">{row.ing.name}</span>
                  <Badge variant="outline">{row.grams.toFixed(1)}g</Badge>
                </div>
              ))}
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
              {(() => {
                const metrics = calcMetricsV2(generatedRecipe);
                return (
                  <>
                    <div className="text-center p-3 bg-primary/5 rounded-lg">
                      <div className="text-xs text-muted-foreground">Sugars</div>
                      <div className="text-lg font-semibold">{metrics.totalSugars_pct.toFixed(1)}%</div>
                    </div>
                    <div className="text-center p-3 bg-primary/5 rounded-lg">
                      <div className="text-xs text-muted-foreground">Fat</div>
                      <div className="text-lg font-semibold">{metrics.fat_pct.toFixed(1)}%</div>
                    </div>
                    <div className="text-center p-3 bg-primary/5 rounded-lg">
                      <div className="text-xs text-muted-foreground">MSNF</div>
                      <div className="text-lg font-semibold">{metrics.msnf_pct.toFixed(1)}%</div>
                    </div>
                    <div className="text-center p-3 bg-primary/5 rounded-lg">
                      <div className="text-xs text-muted-foreground">TS</div>
                      <div className="text-lg font-semibold">{metrics.ts_pct.toFixed(1)}%</div>
                    </div>
                    <div className="text-center p-3 bg-primary/5 rounded-lg">
                      <div className="text-xs text-muted-foreground">FPDT</div>
                      <div className="text-lg font-semibold">{metrics.fpdt.toFixed(1)}°C</div>
                    </div>
                  </>
                );
              })()}
            </div>

            {onApplyRecipe && (
              <Button onClick={applyRecipe} className="w-full" variant="outline">
                Apply Recipe to Calculator
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
