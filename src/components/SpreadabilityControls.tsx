import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { PasteFormula } from '@/types/paste';

interface SpreadabilityControlsProps {
  paste: PasteFormula;
  viscosityData: {
    viscosity_index: number;
    texture_prediction: string;
    spreadability: 'spreadable' | 'pourable' | 'thick';
    recommendations: string[];
  };
}

export default function SpreadabilityControls({ paste, viscosityData }: SpreadabilityControlsProps) {
  const getSpreadabilityColor = (type: string) => {
    switch(type) {
      case 'pourable': return 'bg-blue-500';
      case 'spreadable': return 'bg-green-500';
      case 'thick': return 'bg-orange-500';
      default: return 'bg-muted';
    }
  };

  const totalSolids = 100 - paste.water_pct;

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Spreadability & Viscosity</h3>
          <p className="text-sm text-muted-foreground">Nutella-like texture modeling</p>
        </div>
        <Badge className={getSpreadabilityColor(viscosityData.spreadability)}>
          {viscosityData.spreadability}
        </Badge>
      </div>

      {/* Viscosity Index Gauge */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Viscosity Index</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs text-xs">
                  Calculated from total solids, fat, and sugar composition.
                  Higher values = thicker consistency.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="relative">
          <div className="h-6 bg-gradient-to-r from-blue-200 via-green-200 to-orange-200 rounded-full" />
          <div 
            className="absolute top-0 h-6 w-1 bg-foreground rounded-full transition-all"
            style={{ left: `${Math.min(100, (viscosityData.viscosity_index / 80) * 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Pourable (0-40)</span>
          <span>Spreadable (40-60)</span>
          <span>Thick (60+)</span>
        </div>
        <p className="text-center text-lg font-semibold text-primary">
          {viscosityData.viscosity_index.toFixed(1)}
        </p>
      </div>

      {/* Texture Prediction */}
      <div className="p-4 bg-card-secondary rounded-lg">
        <h4 className="font-medium mb-2">Predicted Texture</h4>
        <p className="text-sm text-muted-foreground">{viscosityData.texture_prediction}</p>
      </div>

      {/* Key Factors */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-3 bg-card-secondary rounded-lg">
          <div className="text-xs text-muted-foreground mb-1">Total Solids</div>
          <div className="text-lg font-semibold">{totalSolids.toFixed(1)}%</div>
        </div>
        <div className="text-center p-3 bg-card-secondary rounded-lg">
          <div className="text-xs text-muted-foreground mb-1">Fat</div>
          <div className="text-lg font-semibold">{paste.fat_pct.toFixed(1)}%</div>
        </div>
        <div className="text-center p-3 bg-card-secondary rounded-lg">
          <div className="text-xs text-muted-foreground mb-1">Sugars</div>
          <div className="text-lg font-semibold">{(paste.sugars_pct || 0).toFixed(1)}%</div>
        </div>
      </div>

      {/* Recommendations */}
      {viscosityData.recommendations.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium">Recommendations</h4>
          <ul className="space-y-1">
            {viscosityData.recommendations.map((rec, idx) => (
              <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* DE Effects Reference */}
      <div className="p-4 bg-primary/5 rounded-lg space-y-2">
        <h4 className="font-medium text-sm">DE (Dextrose Equivalent) Effects</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="font-medium">↑ DE →</span>
            <ul className="ml-4 space-y-0.5 text-muted-foreground">
              <li>↑ Sweetness</li>
              <li>↑ AFP (softer)</li>
              <li>↓ Viscosity</li>
            </ul>
          </div>
          <div>
            <span className="font-medium">↓ DE →</span>
            <ul className="ml-4 space-y-0.5 text-muted-foreground">
              <li>↓ Sweetness</li>
              <li>↓ AFP (firmer)</li>
              <li>↑ Viscosity</li>
            </ul>
          </div>
        </div>
        <p className="text-xs text-muted-foreground italic mt-2">
          Use glucose DE42-60 for spreadable texture with anti-crystallization properties
        </p>
      </div>
    </Card>
  );
}
