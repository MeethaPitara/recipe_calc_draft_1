
import React, { useState } from 'react';
import { Beaker, Calculator, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ProductType } from '../ProductSelector';
import { productParametersService } from '@/services/productParametersService';

interface SugarBlendOptimizerProps {
  productType: ProductType;
  totalSugarAmount: number;
  onOptimizedBlend: (blend: { [sugarType: string]: number }) => void;
}

const SugarBlendOptimizer = ({ productType, totalSugarAmount, onOptimizedBlend }: SugarBlendOptimizerProps) => {
  const [desiredTexture, setDesiredTexture] = useState<'soft' | 'balanced' | 'firm'>('balanced');
  const [optimizedBlend, setOptimizedBlend] = useState<{ [sugarType: string]: number } | null>(null);

  const handleOptimize = () => {
    const blend = productParametersService.calculateOptimalSugarBlend(
      productType,
      totalSugarAmount,
      desiredTexture
    );
    setOptimizedBlend(blend);
    onOptimizedBlend(blend);
  };

  const spectrum = productParametersService.getSugarSpectrum();

  return (
    <Card className="border-warning/30 bg-gradient-to-r from-warning/10 to-warning/5 dark:from-warning/20 dark:to-warning/10">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-warning-foreground">
          <Beaker className="h-5 w-5" />
          Sugar Blend Optimizer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Texture Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Desired Texture</label>
          <Select value={desiredTexture} onValueChange={(value: 'soft' | 'balanced' | 'firm') => setDesiredTexture(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="soft">Soft & Creamy</SelectItem>
              <SelectItem value="balanced">Balanced</SelectItem>
              <SelectItem value="firm">Firm & Compact</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Sugar Spectrum Guidelines */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm text-muted-foreground">Sugar Spectrum Guidelines</h4>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between items-center">
              <span>Disaccharides (Taste, Creaminess):</span>
              <Badge variant="outline">{spectrum.disaccharides[0]}-{spectrum.disaccharides[1]}%</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Monosaccharides (Softness):</span>
              <Badge variant="outline">{spectrum.monosaccharides[0]}-{spectrum.monosaccharides[1]}%</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Polysaccharides (Compactness):</span>
              <Badge variant="outline">{spectrum.polysaccharides[0]}-{spectrum.polysaccharides[1]}%</Badge>
            </div>
          </div>
        </div>

        {/* Optimize Button */}
        <Button 
          onClick={handleOptimize} 
          className="w-full bg-amber-600 hover:bg-amber-700"
          disabled={totalSugarAmount <= 0}
        >
          <Calculator className="h-4 w-4 mr-2" />
          Optimize Sugar Blend
        </Button>

        {/* Optimized Blend Results */}
        {optimizedBlend && (
          <div className="space-y-2 mt-4 p-3 bg-warning/20 dark:bg-warning/30 rounded-lg">
            <h4 className="font-semibold text-sm text-warning-foreground flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Optimized Blend for {desiredTexture} texture
            </h4>
            <div className="space-y-1">
              {Object.entries(optimizedBlend).map(([sugarType, amount]) => (
                <div key={sugarType} className="flex justify-between items-center text-xs">
                  <span className="text-warning-foreground/80">{sugarType}:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{amount.toFixed(1)}g</span>
                    <Badge variant="secondary" className="text-xs">
                      {((amount / totalSugarAmount) * 100).toFixed(0)}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-xs text-warning-foreground/70 mt-2 p-2 bg-warning/10 dark:bg-warning/20 rounded">
              <strong>Benefits:</strong> {
                desiredTexture === 'soft' ? 'Enhanced creaminess and smooth texture' :
                desiredTexture === 'firm' ? 'Better shape retention and controlled melting' :
                'Optimal balance of taste, texture, and stability'
              }
            </div>
          </div>
        )}

        {/* Sugar Information */}
        <div className="text-xs text-muted-foreground space-y-1">
          <div><strong>Disaccharides:</strong> Sucrose - for taste and creaminess</div>
          <div><strong>Monosaccharides:</strong> Dextrose - for softness (High PAC)</div>
          <div><strong>Polysaccharides:</strong> Glucose syrups - for viscosity (Low PAC)</div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SugarBlendOptimizer;
