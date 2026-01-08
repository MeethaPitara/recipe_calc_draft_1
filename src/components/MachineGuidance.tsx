import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Cog, AlertCircle, CheckCircle2, Clock, Thermometer, Wind } from 'lucide-react';
import { getOptimalMachineSettings, validateForMachine } from '@/lib/machineAdvice';
import { Metrics } from '@/lib/calc';

interface MachineGuidanceProps {
  metrics: Metrics;
  machineType: 'batch' | 'continuous';
  onMachineTypeChange: (type: 'batch' | 'continuous') => void;
}

export default function MachineGuidance({ 
  metrics, 
  machineType, 
  onMachineTypeChange 
}: MachineGuidanceProps) {
  const settings = getOptimalMachineSettings(metrics, machineType);
  const validation = validateForMachine(metrics, machineType);
  
  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cog className="h-5 w-5" />
          <h3 className="font-semibold">Machine Guidance</h3>
        </div>
        {validation.valid ? (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Compatible
          </Badge>
        ) : (
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3 mr-1" />
            Issues Found
          </Badge>
        )}
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">Machine Type</label>
        <Select value={machineType} onValueChange={(v) => onMachineTypeChange(v as 'batch' | 'continuous')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="batch">
              <div className="flex flex-col items-start">
                <span className="font-medium">Batch Freezer</span>
                <span className="text-xs text-muted-foreground">Artisan production, small-medium volumes</span>
              </div>
            </SelectItem>
            <SelectItem value="continuous">
              <div className="flex flex-col items-start">
                <span className="font-medium">Continuous Freezer</span>
                <span className="text-xs text-muted-foreground">Industrial production, high volumes</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Optimal Settings */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium">Recommended Settings</h4>
        
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-muted rounded-lg p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Clock className="h-3 w-3" />
              Aging Time
            </div>
            <div className="font-semibold">{settings.agingTime}</div>
          </div>
          
          <div className="bg-muted rounded-lg p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Thermometer className="h-3 w-3" />
              Draw Temp
            </div>
            <div className="font-semibold">{settings.drawTemp}</div>
          </div>
          
          <div className="bg-muted rounded-lg p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Wind className="h-3 w-3" />
              Overrun Target
            </div>
            <div className="font-semibold">{settings.overrunTarget}</div>
          </div>
        </div>
      </div>

      {/* Validation Warnings */}
      {validation.warnings.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-warning-foreground flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            Warnings
          </h4>
          <div className="space-y-1">
            {validation.warnings.map((warning, idx) => (
              <div key={idx} className="text-sm bg-warning/10 dark:bg-warning/20 text-warning-foreground rounded p-2">
                {warning}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {validation.recommendations.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-primary">Recommendations</h4>
          <div className="space-y-1">
            {validation.recommendations.map((rec, idx) => (
              <div key={idx} className="text-sm bg-primary/10 dark:bg-primary/20 text-primary rounded p-2">
                {rec}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Machine-Specific Notes */}
      {settings.notes.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Process Notes</h4>
          <div className="space-y-1">
            {settings.notes.map((note, idx) => (
              <div key={idx} className="text-sm text-muted-foreground bg-muted rounded p-2">
                • {note}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Machine Type Comparison */}
      <div className="pt-3 border-t text-xs text-muted-foreground space-y-1">
        {machineType === 'batch' ? (
          <>
            <p><strong>Batch freezers</strong> are ideal for:</p>
            <ul className="list-disc list-inside pl-2 space-y-0.5">
              <li>Artisan production with frequent flavor changes</li>
              <li>Higher overrun (60-100%+) for lighter texture</li>
              <li>Better incorporation of delicate inclusions</li>
              <li>Smaller batch sizes (5-60L typical)</li>
            </ul>
          </>
        ) : (
          <>
            <p><strong>Continuous freezers</strong> are ideal for:</p>
            <ul className="list-disc list-inside pl-2 space-y-0.5">
              <li>Industrial production with consistent recipes</li>
              <li>Lower overrun (20-60%) for denser gelato style</li>
              <li>High throughput (100-10000 L/hr)</li>
              <li>Tighter draw temperature control</li>
            </ul>
          </>
        )}
      </div>
    </Card>
  );
}
