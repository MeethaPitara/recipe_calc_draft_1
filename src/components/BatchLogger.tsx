import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { FlaskConical, Download } from 'lucide-react';
import { logBatch, getBatchLogs, exportBatchLogs, BatchLog } from '@/lib/batchLogger';
import { useToast } from '@/hooks/use-toast';

interface BatchLoggerProps {
  recipe: { [key: string]: number };
  productType: string;
}

export default function BatchLogger({ recipe, productType }: BatchLoggerProps) {
  const { toast } = useToast();
  const [machineType, setMachineType] = useState<'batch' | 'continuous'>('batch');
  
  // Lab measurements
  const [mixBrix, setMixBrix] = useState<string>('');
  const [pH, setPH] = useState<string>('');
  const [viscosity, setViscosity] = useState<string>('');
  
  // Process data
  const [ageTime, setAgeTime] = useState<string>('');
  const [drawTemp, setDrawTemp] = useState<string>('');
  const [overrun, setOverrun] = useState<string>('');
  
  // Output quality
  const [scoopTemp, setScoopTemp] = useState<string>('');
  const [hardness, setHardness] = useState<string>('');
  const [meltdown, setMeltdown] = useState<string>('');
  const [panelScore, setPanelScore] = useState<string>('');
  
  const [notes, setNotes] = useState<string>('');
  const [showHistory, setShowHistory] = useState(false);
  const logs = getBatchLogs();

  const handleLogBatch = () => {
    const log = logBatch({
      recipe,
      productType,
      machineType,
      mixBrix: mixBrix ? parseFloat(mixBrix) : undefined,
      pH: pH ? parseFloat(pH) : undefined,
      viscosity: viscosity || undefined,
      ageTimeHours: ageTime ? parseFloat(ageTime) : undefined,
      drawTempC: drawTemp ? parseFloat(drawTemp) : undefined,
      overrunPct: overrun ? parseFloat(overrun) : undefined,
      scoopTempC: scoopTemp ? parseFloat(scoopTemp) : undefined,
      hardnessScore: hardness ? parseFloat(hardness) : undefined,
      meltdownMinutes: meltdown ? parseFloat(meltdown) : undefined,
      panelScore: panelScore ? parseFloat(panelScore) : undefined,
      notes: notes || undefined
    });
    
    toast({
      title: "Batch logged!",
      description: `Logged ${log.id} - keep adding batches to build your calibration dataset`
    });
    
    // Clear form
    setMixBrix(''); setPH(''); setViscosity('');
    setAgeTime(''); setDrawTemp(''); setOverrun('');
    setScoopTemp(''); setHardness(''); setMeltdown(''); setPanelScore('');
    setNotes('');
  };

  const handleExport = () => {
    const csv = exportBatchLogs();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch_logs_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "Exported!",
      description: `${logs.length} batches exported to CSV`
    });
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5" />
          <h3 className="font-semibold">Batch Logger & Calibration Kit</h3>
        </div>
        <Badge variant="secondary">{logs.length} logged batches</Badge>
      </div>

      <div className="space-y-3 text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/20 p-3 rounded">
        <p><strong>Why log batches?</strong> After 20-40 batches with real process & sensory data, you can fit a predictive model (PAC × water% × temp → scoopability) to replace heuristics with YOUR plant's actual behavior.</p>
      </div>

      <div className="space-y-3">
        <div>
          <Label>Machine Type</Label>
          <Select value={machineType} onValueChange={(v) => setMachineType(v as 'batch' | 'continuous')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="batch">Batch Freezer</SelectItem>
              <SelectItem value="continuous">Continuous Freezer</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="mixBrix">Mix Brix (°Bx)</Label>
            <Input id="mixBrix" type="number" step="0.1" value={mixBrix} onChange={(e) => setMixBrix(e.target.value)} placeholder="e.g., 28.5" />
          </div>
          <div>
            <Label htmlFor="pH">pH</Label>
            <Input id="pH" type="number" step="0.1" value={pH} onChange={(e) => setPH(e.target.value)} placeholder="e.g., 6.5" />
          </div>
          <div>
            <Label htmlFor="viscosity">Viscosity</Label>
            <Input id="viscosity" value={viscosity} onChange={(e) => setViscosity(e.target.value)} placeholder="e.g., med" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="ageTime">Age Time (h)</Label>
            <Input id="ageTime" type="number" step="0.5" value={ageTime} onChange={(e) => setAgeTime(e.target.value)} placeholder="e.g., 12" />
          </div>
          <div>
            <Label htmlFor="drawTemp">Draw Temp (°C)</Label>
            <Input id="drawTemp" type="number" step="0.1" value={drawTemp} onChange={(e) => setDrawTemp(e.target.value)} placeholder="e.g., -6" />
          </div>
          <div>
            <Label htmlFor="overrun">Overrun (%)</Label>
            <Input id="overrun" type="number" step="1" value={overrun} onChange={(e) => setOverrun(e.target.value)} placeholder="e.g., 40" />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div>
            <Label htmlFor="scoopTemp">Scoop Temp (°C)</Label>
            <Input id="scoopTemp" type="number" step="0.1" value={scoopTemp} onChange={(e) => setScoopTemp(e.target.value)} placeholder="-14" />
          </div>
          <div>
            <Label htmlFor="hardness">Hardness (1-10)</Label>
            <Input id="hardness" type="number" min="1" max="10" value={hardness} onChange={(e) => setHardness(e.target.value)} placeholder="7" />
          </div>
          <div>
            <Label htmlFor="meltdown">Meltdown (min)</Label>
            <Input id="meltdown" type="number" step="0.5" value={meltdown} onChange={(e) => setMeltdown(e.target.value)} placeholder="15" />
          </div>
          <div>
            <Label htmlFor="panelScore">Panel Score (1-10)</Label>
            <Input id="panelScore" type="number" min="1" max="10" value={panelScore} onChange={(e) => setPanelScore(e.target.value)} placeholder="8" />
          </div>
        </div>

        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea 
            id="notes" 
            value={notes} 
            onChange={(e) => setNotes(e.target.value)} 
            placeholder="Observations: texture, flavor, process issues..."
            className="resize-none"
            rows={2}
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={handleLogBatch} className="flex-1">
            Log This Batch
          </Button>
          <Button onClick={handleExport} variant="outline" disabled={logs.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {logs.length > 0 && (
        <div className="pt-3 border-t">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowHistory(!showHistory)}
            className="w-full"
          >
            {showHistory ? 'Hide' : 'Show'} Recent Batches ({logs.length})
          </Button>
          
          {showHistory && (
            <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
              {logs.slice().reverse().slice(0, 10).map((log) => (
                <div key={log.id} className="text-xs bg-muted p-2 rounded">
                  <div className="flex justify-between items-start">
                    <span className="font-mono text-muted-foreground">{log.id}</span>
                    <Badge variant="outline" className="text-xs">{log.machineType}</Badge>
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    {log.drawTempC && `Draw: ${log.drawTempC}°C · `}
                    {log.overrunPct && `OR: ${log.overrunPct}% · `}
                    {log.hardnessScore && `Hardness: ${log.hardnessScore}/10`}
                  </div>
                  {log.notes && <div className="mt-1 text-muted-foreground italic">{log.notes}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
