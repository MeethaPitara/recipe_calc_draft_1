import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Info, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: React.ReactNode;
  sublabel?: string;
  value: number;
  unit?: string;
  target?: string;
  warning?: boolean;
  status?: 'success' | 'warning' | 'error';
  tooltip?: string;
}

export const MetricCard = ({
  label,
  sublabel,
  value,
  unit = '',
  target,
  warning,
  status,
  tooltip
}: MetricCardProps) => {
  return (
    <Card className={cn(
      "transition-all duration-200 ease-in-out hover:shadow-elegant",
      warning && "border-warning bg-warning-light",
      status === 'error' && "border-destructive bg-destructive/10",
      status === 'success' && "border-success bg-success-light",
      status === 'warning' && "border-warning bg-warning-light"
    )}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          <div className="flex items-center gap-1">
            {warning && <AlertTriangle className="h-4 w-4 text-warning" />}
            {status === 'success' && <CheckCircle2 className="h-4 w-4 text-success" />}
            {status === 'error' && <AlertTriangle className="h-4 w-4 text-destructive" />}
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
        </div>
        {sublabel && (
          <span className="text-xs text-muted-foreground block mb-2">{sublabel}</span>
        )}
        <div className="text-2xl font-bold">
          {value.toFixed(2)}{unit}
        </div>
        {target && (
          <Badge variant="outline" className="mt-2 text-xs">
            Target: {target}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
};
