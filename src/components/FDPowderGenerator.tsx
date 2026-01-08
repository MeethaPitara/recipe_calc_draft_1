import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Snowflake, Download, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { PasteFormula } from '@/types/paste';

interface FDPowderGeneratorProps {
  paste: PasteFormula;
  onExport: (powder: PasteFormula) => void;
}

export default function FDPowderGenerator({ paste, onExport }: FDPowderGeneratorProps) {
  const { toast } = useToast();
  const [anticakingPct, setAnticakingPct] = useState(2.0);
  const [dosageRate, setDosageRate] = useState(5); // % in final gelato

  const generateFDPowder = () => {
    // Calculate total solids in original paste
    const originalSolids = 100 - paste.water_pct;
    
    // FD powder: remove ~95% of water, add anticaking agent
    const fdWaterPct = paste.water_pct * 0.05; // ~5% residual moisture
    const fdSolidsPct = 100 - fdWaterPct;
    
    // Concentration factor
    const concentrationFactor = fdSolidsPct / originalSolids;
    
    // Adjust composition (concentrated)
    const fdSugarsPct = (paste.sugars_pct || 0) * concentrationFactor;
    const fdFatPct = paste.fat_pct * concentrationFactor;
    const fdMsnfPct = (paste.msnf_pct || 0) * concentrationFactor;
    
    // Add anticaking agent (reduces other components proportionally)
    const scaleFactor = (100 - anticakingPct) / 100;
    
    const powder: PasteFormula = {
      ...paste,
      id: paste.id + '_FD',
      name: `${paste.name} (FD Powder)`,
      water_pct: fdWaterPct,
      sugars_pct: fdSugarsPct * scaleFactor,
      fat_pct: fdFatPct * scaleFactor,
      msnf_pct: fdMsnfPct * scaleFactor,
      other_solids_pct: (paste.other_solids_pct || 0) * concentrationFactor * scaleFactor + anticakingPct,
      batch_size_g: paste.batch_size_g, // Same batch weight but much less volume
      lab: {
        ...paste.lab,
        aw_est: 0.2 // Very low water activity
      }
    };

    onExport(powder);
    
    toast({
      title: "FD Powder Generated",
      description: `${powder.name} created with ${originalSolids.toFixed(1)}% → ${fdSolidsPct.toFixed(1)}% concentration`,
    });
  };

  const calculateDosageImpact = () => {
    const gramsInBase = (dosageRate / 100) * 1000; // per 1kg base
    const waterAdded = (paste.water_pct / 100) * gramsInBase;
    const sugarsAdded = ((paste.sugars_pct || 0) / 100) * gramsInBase;
    const fatAdded = (paste.fat_pct / 100) * gramsInBase;
    
    return { waterAdded, sugarsAdded, fatAdded };
  };

  const impact = calculateDosageImpact();

  return (
    <Card className="p-6 space-y-4 bg-gradient-subtle">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Snowflake className="h-5 w-5 text-info" />
            Freeze-Dry Powder Generator
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Convert paste to high-intensity powder for dosing into gelato
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          Experimental
        </Badge>
      </div>

      <Separator />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="anticaking">Anticaking Agent (%)</Label>
          <Input
            id="anticaking"
            type="number"
            step="0.5"
            min="0"
            max="5"
            value={anticakingPct}
            onChange={(e) => setAnticakingPct(Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Silicon dioxide or tapioca maltodextrin (typically 1-3%)
          </p>
        </div>

        <div>
          <Label htmlFor="dosage">Target Dosage in Gelato (%)</Label>
          <Input
            id="dosage"
            type="number"
            step="0.5"
            min="1"
            max="15"
            value={dosageRate}
            onChange={(e) => setDosageRate(Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Recommended: 3-8% for intense flavors
          </p>
        </div>
      </div>

      <div className="bg-info-light p-3 rounded border border-info/20">
        <h4 className="text-sm font-semibold mb-2">Impact at {dosageRate}% Dosage (per 1kg base)</h4>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <div className="text-muted-foreground">Water</div>
            <div className="font-semibold">+{impact.waterAdded.toFixed(1)}g</div>
          </div>
          <div>
            <div className="text-muted-foreground">Sugars</div>
            <div className="font-semibold">+{impact.sugarsAdded.toFixed(1)}g</div>
          </div>
          <div>
            <div className="text-muted-foreground">Fat</div>
            <div className="font-semibold">+{impact.fatAdded.toFixed(1)}g</div>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2 p-3 bg-warning-light rounded text-xs">
        <AlertTriangle className="h-4 w-4 text-warning-foreground mt-0.5 flex-shrink-0" />
        <div className="space-y-1">
          <p className="font-semibold">Production Notes:</p>
          <ul className="list-disc list-inside space-y-0.5 text-warning-foreground/80">
            <li>FD equipment required: -40°C freezing, vacuum chamber</li>
            <li>Typical cycle: 24-48h depending on paste moisture</li>
            <li>Store in airtight containers with desiccant</li>
            <li>Shelf life: 12-18 months at room temp (cool, dry place)</li>
          </ul>
        </div>
      </div>

      <Button 
        onClick={generateFDPowder} 
        className="w-full bg-gradient-primary"
      >
        <Download className="h-4 w-4 mr-2" />
        Generate FD Powder Variant
      </Button>
    </Card>
  );
}
