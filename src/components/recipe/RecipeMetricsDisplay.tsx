/**
 * RecipeMetricsDisplay - Displays calculated recipe metrics
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { MetricsV2 } from '@/lib/calc.v2';

interface RecipeMetricsDisplayProps {
  metrics: MetricsV2;
  getConstraints: () => {
    fat: { optimal: [number, number]; acceptable: [number, number] };
    msnf: { optimal: [number, number]; acceptable: [number, number] };
    totalSolids: { optimal: [number, number]; acceptable: [number, number] };
  };
}

/**
 * Helper to render core metrics with color-coded status
 */
function CoreMetric({ 
  label, 
  value, 
  range 
}: { 
  label: string; 
  value: number; 
  range: [number, number];
}) {
  const [min, max] = range;
  const isInRange = value >= min && value <= max;
  const isClose = !isInRange && ((value >= min - 2 && value < min) || (value > max && value <= max + 2));
  
  let statusColor = 'text-green-600 dark:text-green-400';
  let bgColor = 'bg-green-500/10 border-green-500/20';
  
  if (!isInRange) {
    if (isClose) {
      statusColor = 'text-amber-600 dark:text-amber-400';
      bgColor = 'bg-amber-500/10 border-amber-500/20';
    } else {
      statusColor = 'text-red-600 dark:text-red-400';
      bgColor = 'bg-red-500/10 border-red-500/20';
    }
  }

  const explanation = getMetricExplanation(label, value, [min, max]);
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`border rounded-lg p-3 ${bgColor} cursor-help`}>
            <div className="text-xs text-muted-foreground mb-1">{label}</div>
            <div className={`text-lg font-bold ${statusColor}`}>
              {value.toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Target: {min}–{max}%
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-sm">{explanation}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function getMetricExplanation(metric: string, value: number, target?: [number, number]) {
  if (!target) return "";
  const [min, max] = target;
  if (value < min) {
    switch (metric) {
      case "Fat": return "Too low fat → Icy texture, lacks creaminess and richness";
      case "MSNF": return "Too low MSNF → Lacks body, may be too soft";
      case "Sugar": return "Too low sugar → Very hard when frozen, icy texture";
      case "Total Solids": return "Too low solids → Icy, weak body, poor texture";
      default: return "";
    }
  }
  if (value > max) {
    switch (metric) {
      case "Fat": return "Too high fat → Heavy mouthfeel, may coat palate";
      case "MSNF": return "Too high MSNF → Risk of chewiness, sandy texture from lactose";
      case "Sugar": return "Too high sugar → Too soft/slushy when frozen, overly sweet";
      case "Total Solids": return "Too high solids → Dense, hard to scoop, chewy";
      default: return "";
    }
  }
  return "✓ Within optimal range for great texture and scoopability";
}

function getBadgeVariant(
  value: number, 
  optimal: [number, number], 
  acceptable: [number, number]
): 'default' | 'secondary' | 'destructive' {
  if (value >= optimal[0] && value <= optimal[1]) return 'default';
  if (value >= acceptable[0] && value <= acceptable[1]) return 'secondary';
  return 'destructive';
}

export function RecipeMetricsDisplay({ metrics, getConstraints }: RecipeMetricsDisplayProps) {
  const constraints = getConstraints();
  
  return (
    <Card data-metrics-card>
      <CardHeader>
        <CardTitle>Calculated Metrics (Science v2.1)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <p className="text-sm text-muted-foreground">Total Batch</p>
            <p className="text-2xl font-bold">{metrics.total_g.toFixed(1)}g</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Sugars</p>
            <Badge variant="outline">{metrics.totalSugars_pct.toFixed(1)}%</Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Fat</p>
            <Badge variant={getBadgeVariant(metrics.fat_pct, constraints.fat.optimal, constraints.fat.acceptable)}>
              {metrics.fat_pct.toFixed(1)}%
            </Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">MSNF</p>
            <Badge variant={getBadgeVariant(metrics.msnf_pct, constraints.msnf.optimal, constraints.msnf.acceptable)}>
              {metrics.msnf_pct.toFixed(1)}%
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <p className="text-sm text-muted-foreground">Protein</p>
            <Badge variant="outline">{metrics.protein_pct.toFixed(1)}%</Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Solids</p>
            <Badge variant={getBadgeVariant(metrics.ts_pct, constraints.totalSolids.optimal, constraints.totalSolids.acceptable)}>
              {metrics.ts_pct.toFixed(1)}%
            </Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Water</p>
            <Badge variant="outline">{(100 - metrics.ts_pct).toFixed(1)}%</Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Other Solids</p>
            <Badge variant="outline">{metrics.other_pct.toFixed(1)}%</Badge>
          </div>
        </div>

        {/* Advanced metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
          <div>
            <p className="text-sm text-muted-foreground">FPD (FPDT)</p>
            <Badge variant="outline">{metrics.fpdt?.toFixed(2) ?? 'N/A'}°C</Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Sucrose Equiv (SE)</p>
            <Badge variant="outline">{metrics.se_g?.toFixed(0) ?? 'N/A'}g</Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">POD Index</p>
            <Badge variant="outline">{metrics.pod_index?.toFixed(2) ?? 'N/A'}</Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">FPD Sugar</p>
            <Badge variant="outline">{metrics.fpdse?.toFixed(2) ?? 'N/A'}°C</Badge>
          </div>
        </div>

        {/* Warnings */}
        {metrics.warnings && metrics.warnings.length > 0 && (
          <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2">
              ⚠️ Warnings ({metrics.warnings.length})
            </p>
            <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
              {metrics.warnings.slice(0, 5).map((warning, i) => (
                <li key={i}>• {warning}</li>
              ))}
              {metrics.warnings.length > 5 && (
                <li className="text-muted-foreground">+ {metrics.warnings.length - 5} more</li>
              )}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { CoreMetric };
