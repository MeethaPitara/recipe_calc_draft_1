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
import TemperatureGraphs from './calculator/TemperatureGraphs';
import { ServingContext, SERVING_CONTEXT } from '@/lib/constants/tempTargets';
import { cn } from '@/lib/utils';

interface TemperaturePanelProps {
  metrics: any;
  recipe: Row[];
  flavorCategory?: string;
  onApplyTuning?: (tunedRecipe: Row[]) => void;
}

export default function TemperaturePanel({
  metrics,
  recipe,
  flavorCategory,
  onApplyTuning
}: TemperaturePanelProps) {
  const [servingContext, setServingContext] = useState<ServingContext>('home_freezer');
  const [customTemp, setCustomTemp] = useState<number>(-14);
  const [tuningPreview, setTuningPreview] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);

  const isMobile = useIsMobile();
  const advice = recommendTemps(metrics, servingContext);
  const ctx = SERVING_CONTEXT[servingContext];
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'soft': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'ideal': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
      case 'firm': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
      case 'too_hard': return 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300';
      case 'too_soft': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Card className={`${isMobile ? 'p-3 space-y-3' : 'p-4 space-y-4 shadow-xl border-t-4 border-t-primary'}`}>
      {/* Header with Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-2">
          <Thermometer className={isMobile ? 'h-4 w-4' : 'h-5 w-5 text-primary'} />
          <h3 className={`font-bold ${isMobile ? 'text-sm' : 'text-lg'}`}>
            Temperature & Scoopability
          </h3>
        </div>

        <div className="flex bg-muted p-1 rounded-lg self-start">
          <Button
            variant={servingContext === 'home_freezer' ? 'default' : 'ghost'}
            size="sm"
            className="text-[10px] h-7 px-3 uppercase font-bold tracking-tighter"
            onClick={() => setServingContext('home_freezer')}
          >
            🏠 Home Freezer
          </Button>
          <Button
            variant={servingContext === 'gelateria' ? 'default' : 'ghost'}
            size="sm"
            className="text-[10px] h-7 px-3 uppercase font-bold tracking-tighter"
            onClick={() => setServingContext('gelateria')}
          >
            🍨 Gelateria
          </Button>
        </div>
      </div>

      {/* Main Stats */}
      <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'md:grid-cols-2'}`}>
        <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-muted/20 border border-muted/50 shadow-sm">
          <div className="flex items-center gap-2 text-primary">
            <Snowflake className="h-4 w-4" />
            <span className="text-[11px] font-bold uppercase tracking-wider">Target Serve</span>
          </div>
          <div className="text-3xl font-black">{advice.serveTempC.toFixed(1)}°C</div>
          <Badge className={getStatusColor(advice.status)}>
            {advice.status.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>

        <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-muted/20 border border-muted/50 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Snowflake className="h-4 w-4" />
            <span className="text-[11px] font-bold uppercase tracking-wider">{ctx.label}</span>
          </div>
          <div className="text-3xl font-black text-muted-foreground">{ctx.referenceTemp}°C</div>
          <div className="text-[10px] text-muted-foreground font-medium">
            {advice.frozenWaterAtServe_pct.toFixed(1)}% frozen water at {ctx.referenceTemp}°C
          </div>
        </div>
      </div>

      {/* Dynamic Interpretation */}
      <div className="bg-primary/5 rounded-lg p-3 space-y-2 border border-primary/10">
        <div className="flex items-start gap-2 text-xs">
          <Info className="h-4 w-4 mt-0.5 text-primary" />
          <div className="flex-1">
            <p className="font-bold text-foreground">Status Interpreted for {ctx.label}:</p>
            <p className="text-muted-foreground leading-relaxed">{ctx.serveTip}</p>
          </div>
        </div>

        {advice.status === 'too_hard' && (
          <div className="flex items-start gap-2 text-xs border-t border-primary/10 pt-2">
            <AlertCircle className="h-4 w-4 mt-0.5 text-rose-500" />
            <p className="text-muted-foreground font-medium">
              ⚠️ Warning: Product is too hard at {ctx.referenceTemp}°C. This may lead to iciness or brittle texture. Increase PAC.
            </p>
          </div>
        )}
        {advice.status === 'too_soft' && (
          <div className="flex items-start gap-2 text-xs border-t border-primary/10 pt-2">
            <AlertCircle className="h-4 w-4 mt-0.5 text-purple-500" />
            <p className="text-muted-foreground font-medium">
              ⚠️ Warning: Product is too soft at {ctx.referenceTemp}°C. Risk of rapid melting and lack of structural integrity. Decrease PAC.
            </p>
          </div>
        )}
      </div>

      {/* Graph Area */}
      <div className="mt-4">
        <TemperatureGraphs
          metrics={metrics}
          servingContext={servingContext}
          flavorCategory={flavorCategory || 'dairy'}
        />
      </div>

      {/* Auto-tune Toolbar */}
      <div className="border-t border-dashed pt-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Thermodynamic Tuning</h4>
          <Label className="text-[10px] italic text-muted-foreground">EXPERIMENTAL</Label>
        </div>

        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Label htmlFor="customTemp" className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Target Serve Temp (°C)</Label>
            <Input
              id="customTemp"
              type="number"
              step="0.1"
              value={customTemp}
              onChange={(e) => setCustomTemp(parseFloat(e.target.value) || -14)}
              className="h-8 text-xs font-mono"
            />
          </div>
          <Button
            onClick={previewAutoTune}
            variant="outline"
            size="sm"
            className="h-8 text-xs font-bold"
            disabled={!recipe.length}
          >
            Preview Calibration
          </Button>
        </div>

        {showPreview && tuningPreview && (
          <div className="mt-3 bg-muted/40 rounded-lg p-3 border border-muted shadow-inner space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="text-[10px] font-bold uppercase tracking-tighter">Auto-tune Delta Preview</h5>
              <Badge variant="outline" className="text-[9px]">
                CALIBRATED TO {customTemp}°C
              </Badge>
            </div>

            {tuningPreview.changes.length > 0 ? (
              <div className="space-y-3">
                <div className="text-[10px] text-muted-foreground">
                  Frozen water at {customTemp}°C will shift from {advice.frozenWaterAtServe_pct.toFixed(1)}% → {tuningPreview.metrics.frozenWaterAtTarget.toFixed(1)}%
                </div>

                <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-2">
                  {tuningPreview.changes.map((change: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-[11px] bg-background/50 p-1.5 rounded border border-muted/30">
                      <span className="font-medium text-muted-foreground truncate max-w-[140px]">{change.ingredient}</span>
                      <span className={cn("font-bold text-right", change.delta > 0 ? 'text-emerald-500' : 'text-rose-500')}>
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
                    className="flex-1 h-8 text-[11px] font-bold shadow-lg shadow-primary/20"
                  >
                    Commit Changes
                  </Button>
                  <Button
                    onClick={() => setShowPreview(false)}
                    variant="ghost"
                    size="sm"
                    className="h-8 text-[11px]"
                  >
                    Discard
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-muted-foreground flex items-center gap-2 p-2">
                <AlertCircle className="h-4 w-4" />
                No calibration needed - current FPDT already satisfies this temperature
              </div>
            )}
          </div>
        )}
      </div>

      {/* Guidance Footer */}
      <div className="pt-4 mt-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {guidance.slice(0, 4).map((tip, idx) => (
            <div key={idx} className="text-[10px] text-muted-foreground/80 flex items-center gap-2 bg-muted/10 p-2 rounded">
              <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
              {tip}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}