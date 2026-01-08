import { useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Settings, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { MACHINES, MachineProfile } from '@/types/machine';
import { getOptimalMachineSettings, validateForMachine } from '@/lib/machineAdvice';

interface MachineSelectorProps {
  metrics: any;
  selectedMachine?: 'batch' | 'continuous';
  onMachineChange?: (machine: 'batch' | 'continuous') => void;
}

export default function MachineSelector({
  metrics,
  selectedMachine = 'batch',
  onMachineChange
}: MachineSelectorProps) {
  const [machine, setMachine] = useState<'batch' | 'continuous'>(selectedMachine);

  const isMobile = useIsMobile();
  const currentMachine = MACHINES[machine];
  const settings = getOptimalMachineSettings(metrics, machine);
  const validation = validateForMachine(metrics, machine);

  const handleMachineChange = (newMachine: 'batch' | 'continuous') => {
    setMachine(newMachine);
    onMachineChange?.(newMachine);
  };

  return (
    <Card className={`${isMobile ? 'p-3 space-y-3' : 'p-4 space-y-4'}`}>
      <div className="flex items-center gap-2">
        <Settings className={isMobile ? 'h-4 w-4' : 'h-5 w-5'} />
        <h3 className={`font-semibold ${isMobile ? 'text-sm' : ''}`}>Machine Profile</h3>
      </div>

      {/* Machine selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Freezer Type</label>
        <Select value={machine} onValueChange={handleMachineChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(MACHINES).map(([id, profile]) => (
              <SelectItem key={id} value={id}>
                {profile.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Machine specifications */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Overrun Target</span>
          <Badge variant="outline">
            {currentMachine.overrunTarget_pct[0]}-{currentMachine.overrunTarget_pct[1]}%
          </Badge>
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Shear Level</span>
          <Badge variant="outline" className="capitalize">
            {currentMachine.shearLevel}
          </Badge>
        </div>
      </div>

      {/* Validation status */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {validation.valid ? (
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          )}
          <span className="text-sm font-medium">
            Recipe {validation.valid ? 'Compatible' : 'Needs Attention'}
          </span>
        </div>

        {validation.warnings.length > 0 && (
          <div className="space-y-1">
            {validation.warnings.map((warning, idx) => (
              <div key={idx} className="text-sm text-warning-foreground bg-warning/10 dark:bg-warning/20 rounded p-2 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                {warning}
              </div>
            ))}
          </div>
        )}

        {validation.recommendations.length > 0 && (
          <div className="space-y-1">
            {validation.recommendations.map((rec, idx) => (
              <div key={idx} className="text-sm text-primary bg-primary/10 dark:bg-primary/20 rounded p-2 flex items-start gap-2">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                {rec}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Optimal settings */}
      <div className="border-t pt-4 space-y-3">
        <h4 className="text-sm font-medium">Optimal Settings</h4>
        
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <span className="text-xs text-muted-foreground">Aging Time</span>
            <div className="text-sm font-medium">{settings.agingTime}</div>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Draw Temperature</span>
            <div className="text-sm font-medium">{settings.drawTemp}</div>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Overrun Target</span>
            <div className="text-sm font-medium">{settings.overrunTarget}</div>
          </div>
        </div>

        {settings.notes.length > 0 && (
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Process Notes</span>
            {settings.notes.map((note, idx) => (
              <div key={idx} className="text-xs text-muted-foreground bg-muted rounded p-2">
                • {note}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="text-xs text-muted-foreground bg-muted rounded p-2">
        <strong>Tip:</strong> Batch freezers excel at dense, artisanal textures. 
        Continuous freezers provide consistent overrun and faster production.
      </div>
    </Card>
  );
}