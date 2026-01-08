import { useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Thermometer, Snowflake, AlertCircle, Info } from 'lucide-react';
import { recommendTemps, calculateIdealServeTemp, getTemperatureGuidance } from '@/lib/scoopability';
import { previewTuningChanges } from '@/lib/autotune';
import { Row } from '@/lib/optimize';

interface TemperaturePanelProps {
  metrics: any;
  recipe: Row[];
  onApplyTuning?: (tunedRecipe: Row[]) => void;
}

export default function TemperaturePanel({
  metrics,
  recipe,
  onApplyTuning
}: TemperaturePanelProps) {
  const [customTemp, setCustomTemp] = useState<number>(-14);
  const [tuningPreview, setTuningPreview] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);

  const isMobile = useIsMobile();
  const advice = recommendTemps(metrics);
  const guidance = getTemperatureGuidance(metrics);

  const previewAutoTune = () => {
    const preview = previewTuningChanges(recipe, customTemp);
    setTuningPreview(preview);
    setShowPreview(true);
  };

  const applyAutoTune = () => {
    if (tuningPreview && onApplyTuning) {
      // Reconstruct tuned recipe from preview data
      const tunedRecipe = recipe.map(row => {
        const change = tuningPreview.changes.find(
          (c: any) => c.ingredient === row.ing.name
        );
        return {
          ...row,
          grams: change ? change.new : row.grams
        };
      });
      onApplyTuning(tunedRecipe);
      setShowPreview(false);
      setTuningPreview(null);
    }
  };

  const getHardnessColor = (hardness: string) => {
    switch (hardness) {
      case 'soft': return 'bg-blue-100 text-blue-800';
      case 'ideal': return 'bg-emerald-100 text-emerald-800';
      case 'firm': return 'bg-amber-100 text-amber-800';
      case 'too_hard': return 'bg-rose-100 text-rose-800';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Card className={`${isMobile ? 'p-3 space-y-3' : 'p-4 space-y-4'}`}>
      <div className="flex items-center gap-2">
        <Thermometer className={isMobile ? 'h-4 w-4' : 'h-5 w-5'} />
        <h3 className={`font-semibold ${isMobile ? 'text-sm' : ''}`}>
          {isMobile ? 'Temperature' : 'Temperature & Scoopability'}
        </h3>
      </div>

      {/* Current recommendations */}
      <div className={`grid gap-3 ${isMobile ? 'grid-cols-1' : 'md:grid-cols-2'}`}>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Snowflake className="h-4 w-4 text-blue-500" />
            <span className={`font-medium ${isMobile ? 'text-xs' : 'text-sm'}`}>Recommended Serving</span>
          </div>
          <div className={`font-bold ${isMobile ? 'text-xl' : 'text-2xl'}`}>{advice.serveTempC.toFixed(1)}°C</div>
          <Badge className={getHardnessColor(advice.hardness)}>
            {advice.hardness.replace('_', ' ')}
          </Badge>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Snowflake className="h-4 w-4 text-muted-foreground" />
            <span className={`font-medium ${isMobile ? 'text-xs' : 'text-sm'}`}>Storage</span>
          </div>
          <div className={`font-bold ${isMobile ? 'text-xl' : 'text-2xl'}`}>{advice.storeTempC}°C</div>
          <div className={`${isMobile ? 'text-xs' : 'text-xs'} text-muted-foreground`}>
            {advice.frozenWaterAtServe_pct.toFixed(1)}% frozen water at serve
          </div>
        </div>
      </div>

      {/* Temperature guidance */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium flex items-center gap-1">
          <Info className="h-4 w-4" />
          Guidance
        </h4>
        <div className="space-y-1">
          {guidance.map((tip, idx) => (
            <div key={idx} className="text-sm text-muted-foreground bg-muted rounded p-2">
              {tip}
            </div>
          ))}
        </div>
      </div>

      {/* Auto-tune section */}
      <div className="border-t pt-4 space-y-3">
        <h4 className="text-sm font-medium">Auto-tune for Cabinet Temperature</h4>
        
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Label htmlFor="customTemp" className="text-xs">Target Serve Temp (°C)</Label>
            <Input
              id="customTemp"
              type="number"
              step="0.1"
              value={customTemp}
              onChange={(e) => setCustomTemp(parseFloat(e.target.value) || -14)}
              className="text-sm"
            />
          </div>
          <Button
            onClick={previewAutoTune}
            variant="outline"
            size="sm"
            disabled={!recipe.length}
          >
            Preview Changes
          </Button>
        </div>

        {showPreview && tuningPreview && (
          <div className="bg-primary/10 dark:bg-primary/20 rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="text-sm font-medium">Auto-tune Preview</h5>
              <Badge variant="secondary">
                Target: {customTemp}°C
              </Badge>
            </div>

            {tuningPreview.changes.length > 0 ? (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">
                  Frozen water at {customTemp}°C: {tuningPreview.metrics.frozenWaterAtTarget.toFixed(1)}%
                </div>
                
                <div className="space-y-1">
                  {tuningPreview.changes.map((change: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{change.ingredient}</span>
                      <span className={change.delta > 0 ? 'text-green-600' : 'text-red-600'}>
                        {change.original.toFixed(1)}g → {change.new.toFixed(1)}g 
                        ({change.delta > 0 ? '+' : ''}{change.delta.toFixed(1)}g)
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={applyAutoTune}
                    size="sm"
                    className="flex-1"
                  >
                    Apply Changes
                  </Button>
                  <Button
                    onClick={() => setShowPreview(false)}
                    variant="outline"
                    size="sm"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                No changes needed - recipe is already optimized for this temperature
              </div>
            )}
          </div>
        )}
      </div>

      <div className="text-xs text-muted-foreground bg-muted rounded p-2">
        <strong>Pro tip:</strong> Lower PAC = firmer texture. Higher PAC = softer texture.
        Auto-tune adjusts sugar ratios while maintaining sweetness level.
      </div>
    </Card>
  );
}