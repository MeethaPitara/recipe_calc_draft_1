/**
 * Milk/Cream Converter Component
 * Calculates optimal milk and cream volumes to achieve target fat and MSNF
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Droplet, Flame, Info } from 'lucide-react';
import { calculateMilkCreamMix } from '@/lib/calc';

export const MilkCreamConverter: React.FC = () => {
  const [milkFat, setMilkFat] = useState(3.5);
  const [creamFat, setCreamFat] = useState(35);
  const [targetFat, setTargetFat] = useState(8);
  const [targetMass, setTargetMass] = useState(1000);
  const [evaporation, setEvaporation] = useState(8);

  const result = calculateMilkCreamMix(milkFat, creamFat, targetFat, targetMass, evaporation);

  return (
    <Card className="border-blue-200">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Droplet className="h-5 w-5 text-blue-600" />
          <CardTitle>Milk & Cream Converter</CardTitle>
        </div>
        <CardDescription>
          Calculate exact volumes to reach target fat percentage
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Inputs Section */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="milkFat">Milk Fat %</Label>
            <Input
              id="milkFat"
              type="number"
              step="0.1"
              value={milkFat}
              onChange={(e) => setMilkFat(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="creamFat">Cream Fat %</Label>
            <Input
              id="creamFat"
              type="number"
              step="0.1"
              value={creamFat}
              onChange={(e) => setCreamFat(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetFat">Target Fat %</Label>
            <Input
              id="targetFat"
              type="number"
              step="0.1"
              value={targetFat}
              onChange={(e) => setTargetFat(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetMass">Batch Size (g)</Label>
            <Input
              id="targetMass"
              type="number"
              step="100"
              value={targetMass}
              onChange={(e) => setTargetMass(parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>

        {/* Evaporation Section */}
        <div className="p-3 bg-warning/10 dark:bg-warning/20 rounded-lg border border-warning/30">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="h-4 w-4 text-warning-foreground" />
            <Label htmlFor="evaporation" className="font-semibold">Water Evaporation %</Label>
          </div>
          <Input
            id="evaporation"
            type="number"
            step="1"
            value={evaporation}
            onChange={(e) => setEvaporation(parseFloat(e.target.value) || 0)}
            className="w-32"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Typical: 5-10% during pasteurization (85°C for 30 min)
          </p>
        </div>

        {/* Results Section */}
        <div className="space-y-3 p-4 bg-success/10 dark:bg-success/20 rounded-lg border border-success/30">
          <Label className="text-sm font-semibold">Required Volumes:</Label>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-card rounded">
              <p className="text-xs text-muted-foreground">Milk</p>
              <p className="text-2xl font-bold text-primary">{result.milk_g.toFixed(0)}g</p>
              <p className="text-xs text-muted-foreground">≈ {(result.milk_g / 1.03).toFixed(0)} ml</p>
            </div>

            <div className="text-center p-3 bg-card rounded">
              <p className="text-xs text-muted-foreground">Cream</p>
              <p className="text-2xl font-bold text-primary">{result.cream_g.toFixed(0)}g</p>
              <p className="text-xs text-muted-foreground">≈ {(result.cream_g / 1.01).toFixed(0)} ml</p>
            </div>
          </div>

          {evaporation > 0 && (
            <>
              <div className="pt-2 border-t border-green-300 space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Water Loss:</span>
                  <Badge variant="secondary">{result.water_loss_g.toFixed(0)}g</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Final Mass:</span>
                  <Badge variant="secondary">{result.final_mass_g.toFixed(0)}g</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Actual Fat % (after evap):</span>
                  <Badge className="bg-green-600">{result.actual_fat_pct.toFixed(2)}%</Badge>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Notes/Warnings */}
        {result.notes.length > 0 && (
          <div className="space-y-2">
            {result.notes.map((note, idx) => (
              <Alert key={idx} variant={note.startsWith('⚠️') ? 'destructive' : 'default'}>
                <Info className="h-4 w-4" />
                <AlertDescription>{note}</AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* MSNF Info */}
        <div className="text-xs text-muted-foreground p-3 bg-primary/10 dark:bg-primary/20 rounded border border-primary/30">
          <p><strong>💡 MSNF Handling:</strong> Milk solids non-fat (lactose + protein) will concentrate as water evaporates. For precise MSNF control, add SMP (Skim Milk Powder) separately after calculating base dairy.</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default MilkCreamConverter;
