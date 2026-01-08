import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';
import type { ScienceValidation } from '@/lib/optimize.balancer.v2';

interface ScienceValidationPanelProps {
  validations: ScienceValidation[];
  qualityScore?: {
    score: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    color: 'success' | 'warning' | 'destructive';
  };
}

const severityConfig = {
  optimal: {
    icon: CheckCircle2,
    color: 'text-success',
    bgColor: 'bg-success/10',
    borderColor: 'border-success/20',
    label: 'Optimal',
    badgeVariant: 'default' as const
  },
  acceptable: {
    icon: Info,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    borderColor: 'border-primary/20',
    label: 'Acceptable',
    badgeVariant: 'secondary' as const
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    borderColor: 'border-warning/20',
    label: 'Warning',
    badgeVariant: 'outline' as const
  },
  critical: {
    icon: XCircle,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    borderColor: 'border-destructive/20',
    label: 'Critical',
    badgeVariant: 'destructive' as const
  }
};

export function ScienceValidationPanel({ validations, qualityScore }: ScienceValidationPanelProps) {
  if (!validations || validations.length === 0) {
    return null;
  }

  const criticalIssues = validations.filter(v => v.severity === 'critical');
  const warnings = validations.filter(v => v.severity === 'warning');
  const optimal = validations.filter(v => v.severity === 'optimal');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Recipe Quality Analysis</CardTitle>
            <CardDescription>Ice cream science validation</CardDescription>
          </div>
          {qualityScore && (
            <div className="flex items-center gap-2">
              <Badge 
                variant={qualityScore.color === 'success' ? 'default' : qualityScore.color === 'warning' ? 'secondary' : 'destructive'}
                className="text-lg px-3 py-1"
              >
                Grade {qualityScore.grade}
              </Badge>
              <div className="text-right">
                <div className="text-2xl font-bold">{qualityScore.score.toFixed(0)}%</div>
                <div className="text-xs text-muted-foreground">Quality Score</div>
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-success/10">
            <div className="text-2xl font-bold text-success">{optimal.length}</div>
            <div className="text-xs text-muted-foreground">Optimal</div>
          </div>
          <div className="p-2 rounded-lg bg-warning/10">
            <div className="text-2xl font-bold text-warning">{warnings.length}</div>
            <div className="text-xs text-muted-foreground">Warnings</div>
          </div>
          <div className="p-2 rounded-lg bg-destructive/10">
            <div className="text-2xl font-bold text-destructive">{criticalIssues.length}</div>
            <div className="text-xs text-muted-foreground">Critical</div>
          </div>
        </div>

        {/* Critical Issues Alert */}
        {criticalIssues.length > 0 && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>{criticalIssues.length} critical issue{criticalIssues.length > 1 ? 's' : ''}</strong> detected. 
              Address these for proper ice cream texture and stability.
            </AlertDescription>
          </Alert>
        )}

        {/* Validation Details */}
        <div className="space-y-3">
          {validations.map((validation, index) => {
            const config = severityConfig[validation.severity];
            const Icon = config.icon;
            
            // Calculate position within range for progress bar
            const { value, optimalRange, acceptableRange } = validation;
            const min = acceptableRange.min;
            const max = acceptableRange.max;
            const range = max - min;
            const position = ((value - min) / range) * 100;
            const clampedPosition = Math.max(0, Math.min(100, position));
            
            // Determine progress color based on position relative to optimal range
            let progressColor = 'bg-destructive';
            if (value >= optimalRange.min && value <= optimalRange.max) {
              progressColor = 'bg-success';
            } else if (value >= acceptableRange.min && value <= acceptableRange.max) {
              progressColor = 'bg-warning';
            }

            return (
              <div 
                key={index}
                className={`p-3 rounded-lg border ${config.borderColor} ${config.bgColor}`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${config.color}`} />
                    <span className="font-medium">{validation.parameter}</span>
                  </div>
                  <Badge variant={config.badgeVariant} className="shrink-0">
                    {config.label}
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-muted-foreground">Current: <strong>{validation.value.toFixed(2)}</strong></span>
                    <span className="text-muted-foreground text-xs">
                      Optimal: {optimalRange.min}–{optimalRange.max}
                    </span>
                  </div>
                  
                  {/* Visual range indicator */}
                  <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                    {/* Optimal zone (green) */}
                    <div 
                      className="absolute h-full bg-success/30"
                      style={{
                        left: `${((optimalRange.min - min) / range) * 100}%`,
                        width: `${((optimalRange.max - optimalRange.min) / range) * 100}%`
                      }}
                    />
                    {/* Current value indicator */}
                    <div 
                      className={`absolute h-full w-1 ${progressColor}`}
                      style={{ left: `${clampedPosition}%` }}
                    />
                  </div>
                  
                  <p className="text-sm text-muted-foreground">{validation.message}</p>
                  
                  {validation.recommendation && (
                    <p className="text-sm font-medium mt-1">
                      💡 {validation.recommendation}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
