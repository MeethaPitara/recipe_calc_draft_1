/**
 * Calculation Debugger Component
 * Shows detailed breakdown of calculations for debugging
 * Only visible in development mode
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { Metrics } from '@/lib/calc';
import { validateIngredientData } from '@/lib/ingredientLibrary';
import { IngredientData } from '@/types/ingredients';

interface CalculationDebuggerProps {
  recipe: Array<{ ing: IngredientData; grams: number }>;
  metrics: Metrics;
  show?: boolean;
}

export default function CalculationDebugger({ recipe, metrics, show = true }: CalculationDebuggerProps) {
  if (!show || process.env.NODE_ENV === 'production') return null;
  
  const ingredientValidations = recipe.map(row => ({
    name: row.ing.name,
    ...validateIngredientData(row.ing)
  }));
  
  const hasWarnings = ingredientValidations.some(v => !v.valid);
  
  return (
    <Card className="border-dashed border-2 border-warning/50 bg-warning-light">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Info className="h-4 w-4" />
          Calculation Debugger
          <Badge variant="outline" className="text-xs">Dev Only</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        {/* Metrics Summary */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <div className="text-muted-foreground">Total Mass</div>
            <div className="font-mono font-semibold">{metrics.total_g.toFixed(1)}g</div>
          </div>
          <div>
            <div className="text-muted-foreground">Total Solids</div>
            <div className="font-mono font-semibold">{metrics.ts_mass_pct.toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-muted-foreground">Water</div>
            <div className="font-mono font-semibold">{metrics.water_pct.toFixed(1)}%</div>
          </div>
        </div>
        
        {/* Composition Breakdown */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Sugars:</span>
            <span className="font-mono">{metrics.sugars_pct.toFixed(1)}% ({metrics.sugars_g.toFixed(0)}g)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fat:</span>
            <span className="font-mono">{metrics.fat_pct.toFixed(1)}% ({metrics.fat_g.toFixed(0)}g)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">MSNF:</span>
            <span className="font-mono">{metrics.msnf_pct.toFixed(1)}% ({metrics.msnf_g.toFixed(0)}g)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Other:</span>
            <span className="font-mono">{metrics.other_pct.toFixed(1)}% ({metrics.other_g.toFixed(0)}g)</span>
          </div>
        </div>
        
        {/* Sweetness & Freezing */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t">
          <div className="flex justify-between">
            <span className="text-muted-foreground">SP:</span>
            <span className="font-mono font-semibold">{metrics.sp.toFixed(1)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">PAC:</span>
            <span className="font-mono font-semibold">{metrics.pac.toFixed(1)}</span>
          </div>
        </div>
        
        {/* Ingredient Warnings */}
        {hasWarnings && (
          <Alert variant="destructive" className="mt-3">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <div className="font-semibold mb-1">Ingredient Data Issues:</div>
              {ingredientValidations.filter(v => !v.valid).map((v, i) => (
                <div key={i} className="ml-2">
                  <span className="font-mono">{v.name}:</span>
                  <ul className="list-disc ml-4">
                    {v.warnings.map((w, j) => (
                      <li key={j}>{w}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </AlertDescription>
          </Alert>
        )}
        
        {!hasWarnings && (
          <div className="flex items-center gap-2 text-success pt-2 border-t">
            <CheckCircle className="h-4 w-4" />
            <span>All ingredient data valid</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
