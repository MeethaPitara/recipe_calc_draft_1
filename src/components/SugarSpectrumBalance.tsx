/**
 * Sugar Spectrum Balance Component
 * Allows users to quickly split total sugars into 3-sugar blend (70/10/20 default)
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Info } from 'lucide-react';
import { balanceSugarSpectrum } from '@/lib/calc';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SugarSpectrumBalanceProps {
  totalSugarGrams: number;
  onApply: (blend: { sucrose_g: number; dextrose_g: number; glucose_g: number }) => void;
}

export const SugarSpectrumBalance: React.FC<SugarSpectrumBalanceProps> = ({
  totalSugarGrams,
  onApply
}) => {
  const [ratios, setRatios] = useState({ sucrose: 70, dextrose: 10, glucose: 20 });
  const [showCustom, setShowCustom] = useState(false);

  const result = balanceSugarSpectrum(totalSugarGrams, ratios);

  const handlePreset = (preset: 'balanced' | 'soft' | 'firm') => {
    switch (preset) {
      case 'balanced':
        setRatios({ sucrose: 70, dextrose: 10, glucose: 20 });
        break;
      case 'soft':
        setRatios({ sucrose: 50, dextrose: 30, glucose: 20 });
        break;
      case 'firm':
        setRatios({ sucrose: 80, dextrose: 5, glucose: 15 });
        break;
    }
  };

  const handleSliderChange = (type: 'sucrose' | 'dextrose' | 'glucose', value: number[]) => {
    const newValue = value[0];
    setRatios(prev => {
      const newRatios = { ...prev, [type]: newValue };
      // Normalize to 100%
      const total = newRatios.sucrose + newRatios.dextrose + newRatios.glucose;
      if (total !== 100) {
        const scale = 100 / total;
        newRatios.sucrose = Math.round(newRatios.sucrose * scale);
        newRatios.dextrose = Math.round(newRatios.dextrose * scale);
        newRatios.glucose = 100 - newRatios.sucrose - newRatios.dextrose;
      }
      return newRatios;
    });
  };

  return (
    <Card className="border-purple-200">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600" />
          <CardTitle>Sugar Spectrum Balance</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Split total sugars into 3 types for optimal balance of sweetness, texture, and anti-freeze properties.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <CardDescription>
          Optimize sugar blend for texture and freeze control
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total Sugar Input */}
        <div className="p-3 bg-primary/10 dark:bg-primary/20 rounded-lg">
          <Label className="text-sm font-medium">Total Sugar Amount</Label>
          <p className="text-2xl font-bold text-primary">{totalSugarGrams.toFixed(0)}g</p>
        </div>

        {/* Presets */}
        <div className="space-y-2">
          <Label className="text-sm">Quick Presets</Label>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={ratios.sucrose === 70 ? 'default' : 'outline'}
              onClick={() => handlePreset('balanced')}
            >
              Balanced (70/10/20)
            </Button>
            <Button
              size="sm"
              variant={ratios.sucrose === 50 ? 'default' : 'outline'}
              onClick={() => handlePreset('soft')}
            >
              Soft (50/30/20)
            </Button>
            <Button
              size="sm"
              variant={ratios.sucrose === 80 ? 'default' : 'outline'}
              onClick={() => handlePreset('firm')}
            >
              Firm (80/5/15)
            </Button>
          </div>
        </div>

        {/* Custom Ratios Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowCustom(!showCustom)}
          className="w-full"
        >
          {showCustom ? 'Hide' : 'Show'} Custom Ratios
        </Button>

        {/* Custom Sliders */}
        {showCustom && (
          <div className="space-y-4 p-4 bg-muted rounded-lg">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Sucrose (Disaccharide)</Label>
                <Badge variant="secondary">{ratios.sucrose}%</Badge>
              </div>
              <Slider
                value={[ratios.sucrose]}
                onValueChange={(v) => handleSliderChange('sucrose', v)}
                min={0}
                max={100}
                step={5}
              />
              <p className="text-xs text-muted-foreground">For taste, creaminess, consistency</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Dextrose (Monosaccharide)</Label>
                <Badge variant="secondary">{ratios.dextrose}%</Badge>
              </div>
              <Slider
                value={[ratios.dextrose]}
                onValueChange={(v) => handleSliderChange('dextrose', v)}
                min={0}
                max={100}
                step={5}
              />
              <p className="text-xs text-muted-foreground">For softness, anti-freeze</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Glucose DE60 (Polysaccharide)</Label>
                <Badge variant="secondary">{ratios.glucose}%</Badge>
              </div>
              <Slider
                value={[ratios.glucose]}
                onValueChange={(v) => handleSliderChange('glucose', v)}
                min={0}
                max={100}
                step={5}
              />
              <p className="text-xs text-muted-foreground">For body, viscosity</p>
            </div>
          </div>
        )}

        {/* Results */}
        <div className="space-y-2 p-4 bg-success/10 dark:bg-success/20 rounded-lg border border-success/30">
          <Label className="text-sm font-semibold">Calculated Blend:</Label>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-xs text-muted-foreground">Sucrose</p>
              <p className="text-lg font-bold">{result.sucrose_g.toFixed(1)}g</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Dextrose</p>
              <p className="text-lg font-bold">{result.dextrose_g.toFixed(1)}g</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Glucose</p>
              <p className="text-lg font-bold">{result.glucose_g.toFixed(1)}g</p>
            </div>
          </div>

          <div className="pt-2 border-t border-success/30">
            <div className="flex justify-between text-sm">
              <span>Expected SP:</span>
              <Badge>{result.expected_sp.toFixed(1)}</Badge>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span>Expected PAC:</span>
              <Badge>{result.expected_pac.toFixed(1)}</Badge>
            </div>
          </div>
        </div>

        {/* Apply Button */}
        <Button
          onClick={() => onApply(result)}
          className="w-full"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Apply This Blend
        </Button>

        {/* Info */}
        <div className="text-xs text-muted-foreground p-3 bg-primary/10 dark:bg-primary/20 rounded border border-primary/30">
          <p><strong>💡 Tip:</strong> Balanced blend (70/10/20) works for most recipes. Increase dextrose for softer texture at serving temp, or increase sucrose for firmer body.</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default SugarSpectrumBalance;
