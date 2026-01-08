import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { IndianRupee, Beaker, TrendingUp, AlertCircle } from 'lucide-react';

interface CostYieldDisplayProps {
  recipe: { [key: string]: number };
  metrics: any;
  overrunPct?: number;
  wastePct?: number;
}

export default function CostYieldDisplay({ 
  recipe, 
  metrics, 
  overrunPct = 50,
  wastePct = 5 
}: CostYieldDisplayProps) {
  // Sample cost data (in production, fetch from database)
  const ingredientCosts: { [key: string]: number } = {
    'Heavy Cream': 450,
    'Whole Milk': 65,
    'Sugar': 45,
    'Sucrose': 45,
    'Dextrose': 120,
    'Fructose': 150,
    'Invert Sugar': 80,
    'Glucose Syrup DE60': 95,
    'Egg Yolks': 280,
    'Stabilizer': 800,
    'Emulsifier': 950,
    'Vanilla Extract': 1200,
    'Cocoa Powder': 650,
    'Strawberry Puree': 220,
    'Mango Puree': 180,
    'Pistachio Paste': 2400,
    'Default': 100
  };

  // Calculate raw cost
  const rawCostRs = Object.entries(recipe).reduce((total, [name, grams]) => {
    const costPerKg = ingredientCosts[name] || ingredientCosts['Default'];
    return total + (grams / 1000) * costPerKg;
  }, 0);

  const totalGrams = Object.values(recipe).reduce((sum, val) => sum + val, 0);
  
  // Account for waste
  const effectiveCost = rawCostRs * (1 + wastePct / 100);
  
  // Cost per kg of base
  const costPerKgBase = (effectiveCost / totalGrams) * 1000;
  
  // After overrun: volume increases, density decreases
  const gramsPerLiter = (totalGrams / (1 + overrunPct / 100));
  const costPerLiterFinished = (effectiveCost / gramsPerLiter) * 1000;

  const profitMargin = costPerLiterFinished * 4; // 4x markup typical

  return (
    <Card className="p-4 space-y-3 bg-gradient-subtle border-primary/20">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <IndianRupee className="h-4 w-4 text-primary" />
          Cost & Yield Analysis
        </h3>
        <Badge variant="outline" className="text-xs">
          {overrunPct}% overrun
        </Badge>
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Beaker className="h-3 w-3" />
            Base Cost/kg
          </div>
          <div className="text-2xl font-bold text-primary">
            ₹{costPerKgBase.toFixed(2)}
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            Finished Cost/L
          </div>
          <div className="text-2xl font-bold text-accent-foreground">
            ₹{costPerLiterFinished.toFixed(2)}
          </div>
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="text-center p-2 bg-card rounded">
          <div className="text-muted-foreground">Raw Cost</div>
          <div className="font-semibold">₹{rawCostRs.toFixed(2)}</div>
        </div>
        <div className="text-center p-2 bg-card rounded">
          <div className="text-muted-foreground">With Waste ({wastePct}%)</div>
          <div className="font-semibold">₹{effectiveCost.toFixed(2)}</div>
        </div>
        <div className="text-center p-2 bg-card rounded">
          <div className="text-muted-foreground">Suggested Retail/L</div>
          <div className="font-semibold text-success">₹{profitMargin.toFixed(2)}</div>
        </div>
      </div>

      {wastePct > 8 && (
        <div className="flex items-start gap-2 p-2 bg-warning-light rounded text-xs text-warning-foreground">
          <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <p>High waste percentage detected. Consider reviewing portion control and production efficiency.</p>
        </div>
      )}
    </Card>
  );
}
