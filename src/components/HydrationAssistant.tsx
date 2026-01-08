import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Droplet, Clock, Thermometer, AlertTriangle } from 'lucide-react';
import { Row } from '@/lib/optimize';
import { useState } from 'react';

interface HydrationAssistantProps {
  recipe: Row[];
}

export default function HydrationAssistant({ recipe }: HydrationAssistantProps) {
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  
  // Detect stabilizers that need hydration
  const stabilizers = recipe.filter(r => 
    r.ing.category === 'stabilizer' || 
    r.ing.id.includes('lbg') || 
    r.ing.id.includes('guar') || 
    r.ing.id.includes('carrageenan')
  );
  
  if (stabilizers.length === 0) {
    return null;
  }
  
  // Get hydration guidance for each stabilizer
  const getHydrationGuidance = (ingredientId: string) => {
    if (ingredientId.includes('lbg') || ingredientId.toLowerCase().includes('locust')) {
      return {
        temp: '70-85°C',
        time: '10-15 min',
        notes: ['Synergistic with carrageenan', 'Full hydration needs hot temperature']
      };
    }
    if (ingredientId.includes('guar')) {
      return {
        temp: 'Room temp to 60°C',
        time: '5-10 min',
        notes: ['Quick viscosity build', 'Can hydrate at lower temps']
      };
    }
    if (ingredientId.includes('carrageenan')) {
      return {
        temp: '75-80°C',
        time: '10-15 min',
        notes: ['Must be heated for activation', 'Prevents wheying off']
      };
    }
    // Generic stabilizer blend
    return {
      temp: '70-80°C',
      time: '10-15 min',
      notes: ['Follow manufacturer guidance', 'Ensure complete dispersion']
    };
  };
  
  return (
    <Card className="p-4 space-y-4 border-l-4 border-l-blue-500">
      <div className="flex items-center gap-2">
        <Droplet className="h-5 w-5 text-blue-500" />
        <h3 className="font-semibold">Hydration & Aging Assistant</h3>
        <Badge variant="secondary">
          {stabilizers.length} stabilizer{stabilizers.length > 1 ? 's' : ''} detected
        </Badge>
      </div>

      <div className="space-y-3">
        {stabilizers.map((row, idx) => {
          const guidance = getHydrationGuidance(row.ing.id);
          const dosagePct = (row.grams / recipe.reduce((sum, r) => sum + r.grams, 0)) * 100;
          
          return (
            <div key={idx} className="bg-primary/10 dark:bg-primary/20 rounded-lg p-3 space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-medium text-sm">{row.ing.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {row.grams.toFixed(1)}g ({dosagePct.toFixed(2)}%)
                  </div>
                </div>
                {dosagePct > 1.0 && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    High dosage
                  </Badge>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Thermometer className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs">
                    <strong>Temp:</strong> {guidance.temp}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs">
                    <strong>Time:</strong> {guidance.time}
                  </span>
                </div>
              </div>
              
              {guidance.notes.length > 0 && (
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {guidance.notes.map((note, nidx) => (
                    <div key={nidx}>• {note}</div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Aging Confirmation */}
      <div className="pt-3 border-t space-y-3">
        <div className="bg-warning/10 dark:bg-warning/20 border border-warning/30 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <Clock className="h-5 w-5 text-warning-foreground mt-0.5 flex-shrink-0" />
            <div className="flex-1 text-sm">
              <div className="font-medium text-warning-foreground mb-1">Aging is Critical</div>
              <p className="text-warning-foreground/80 text-xs mb-2">
                After pasteurization and cooling, age the mix for <strong>4-12 hours at ≤5°C</strong> 
                (ideally overnight). This allows:
              </p>
              <ul className="text-xs text-warning-foreground/80 space-y-0.5 ml-3 list-disc">
                <li>Complete fat crystallization</li>
                <li>Protein hydration</li>
                <li>Stabilizer full functionality</li>
                <li>Better overrun and texture</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox 
            id="age-confirmed" 
            checked={ageConfirmed}
            onCheckedChange={(checked) => setAgeConfirmed(checked as boolean)}
          />
          <label 
            htmlFor="age-confirmed" 
            className="text-sm cursor-pointer select-none"
          >
            Mix will be aged ≥4h @ ≤5°C before freezing
          </label>
        </div>
        
        {ageConfirmed && (
          <div className="text-xs text-success-foreground bg-success/10 dark:bg-success/20 rounded p-2">
            ✓ Excellent! Proper aging will significantly improve texture and stability.
          </div>
        )}
      </div>

      <div className="text-xs text-muted-foreground italic">
        <strong>Pro tip:</strong> Longer aging (8-12h) generally improves results, especially for 
        high-fat or high-stabilizer formulas. Never skip aging for commercial production.
      </div>
    </Card>
  );
}
