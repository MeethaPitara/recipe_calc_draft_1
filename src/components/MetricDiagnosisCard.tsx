import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, CheckCircle2, XCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type MetricStatus = 'ok' | 'warning' | 'high' | 'low';

export interface MetricDiagnosis {
  label: string;
  sublabel?: string;
  value: number;
  unit?: string;
  targetMin?: number;
  targetMax?: number;
  // Diagnosis fields — driven by code, never by AI
  risk?: string;
  cause?: string;
  action?: string;
  tooltip?: string;
}

function getStatus(value: number, min?: number, max?: number): MetricStatus {
  if (min === undefined || max === undefined) return 'ok';
  if (value >= min && value <= max) return 'ok';
  if (value < min) return 'low';
  return 'high';
}

const STATUS_CONFIG: Record<MetricStatus, {
  border: string;
  bg: string;
  icon: React.ReactNode;
  badge: string;
  label: string;
}> = {
  ok: {
    border: 'border-green-500',
    bg: 'bg-green-50 dark:bg-green-950/20',
    icon: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    badge: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    label: 'OK',
  },
  warning: {
    border: 'border-yellow-500',
    bg: 'bg-yellow-50 dark:bg-yellow-950/20',
    icon: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
    badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    label: 'Warning',
  },
  high: {
    border: 'border-red-500',
    bg: 'bg-red-50 dark:bg-red-950/20',
    icon: <XCircle className="h-4 w-4 text-red-500" />,
    badge: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    label: 'High',
  },
  low: {
    border: 'border-orange-500',
    bg: 'bg-orange-50 dark:bg-orange-950/20',
    icon: <AlertTriangle className="h-4 w-4 text-orange-500" />,
    badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    label: 'Low',
  },
};

export function MetricDiagnosisCard({ label, sublabel, value, unit = '%', targetMin, targetMax, risk, cause, action, tooltip }: MetricDiagnosis) {
  const status = getStatus(value, targetMin, targetMax);
  const cfg = STATUS_CONFIG[status];
  const hasTarget = targetMin !== undefined && targetMax !== undefined;
  const gap = hasTarget
    ? status === 'low' ? targetMin! - value : status === 'high' ? value - targetMax! : 0
    : 0;
  const hasDiagnosis = status !== 'ok' && (risk || cause || action);

  return (
    <Card className={cn('transition-all duration-200', hasTarget && status !== 'ok' ? `border ${cfg.border} ${cfg.bg}` : '')}>
      <CardContent className="p-4 space-y-2">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium text-muted-foreground">{label}</span>
            {tooltip && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-sm">{tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          {hasTarget && cfg.icon}
        </div>

        {sublabel && <span className="text-xs text-muted-foreground block -mt-1">{sublabel}</span>}

        {/* Value */}
        <div className="text-2xl font-bold">
          {value.toFixed(2)}{unit}
        </div>

        {/* Target + gap row */}
        {hasTarget && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-xs">
             Target: {targetMin}–{targetMax}{unit}
            </Badge>
            {status !== 'ok' && (
              <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded', cfg.badge)}>
                {cfg.label} {gap > 0 ? `+${gap.toFixed(1)}` : ''}{unit}
              </span>
            )}
          </div>
        )}

        {/* Diagnosis block — only when out of range */}
        {hasDiagnosis && (
          <div className="pt-1 border-t border-border/50 space-y-1 text-xs text-muted-foreground">
            {risk && (
              <div><span className="font-semibold text-foreground">Risk:</span> {risk}</div>
            )}
            {cause && (
              <div><span className="font-semibold text-foreground">Likely cause:</span> {cause}</div>
            )}
            {action && (
              <div><span className="font-semibold text-foreground">Action:</span> {action}</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
