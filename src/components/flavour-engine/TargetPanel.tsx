// Epic 2: Product Targets & Validation UI

import React, { useState } from 'react';
import { Target, Settings, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface ProductTargets {
  sugar: [number, number];
  fat: [number, number];
  msnf: [number, number];
  total_solids: [number, number];
  sp: [number, number];
  pac: [number, number];
}

export const PRODUCT_RANGES: Record<string, ProductTargets> = {
  white_base: { 
    sugar: [16, 19], 
    fat: [3, 7], 
    msnf: [7, 12], 
    total_solids: [32, 37], 
    sp: [12, 22], 
    pac: [22, 28] 
  },
  finished_gelato: { 
    sugar: [18, 22], 
    fat: [7, 16], 
    msnf: [7, 12], 
    total_solids: [37, 46], 
    sp: [12, 22], 
    pac: [22, 28] 
  },
  fruit_gelato: { 
    sugar: [22, 24], 
    fat: [3, 10], 
    msnf: [3, 7], 
    total_solids: [32, 42], 
    sp: [18, 26], 
    pac: [25, 29] 
  },
  sorbet: { 
    sugar: [26, 31], 
    fat: [0, 0], 
    msnf: [0, 0], 
    total_solids: [32, 42], 
    sp: [20, 28], 
    pac: [28, 33] 
  }
};

interface TargetPanelProps {
  currentMetrics: {
    sugars: number;
    fat: number;
    msnf: number;
    ts_additive: number;
    sp: number;
    pac: number;
  };
  targets: ProductTargets;
  onTargetsChange: (newTargets: ProductTargets) => void;
  onPresetChange: (preset: string) => void;
}

const TargetPanel: React.FC<TargetPanelProps> = ({
  currentMetrics,
  targets,
  onTargetsChange,
  onPresetChange
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string>('finished_gelato');

  const getValidationStatus = (value: number, range: [number, number]): 'optimal' | 'warning' | 'critical' => {
    const [min, max] = range;
    if (value >= min && value <= max) return 'optimal';
    if (value >= min * 0.9 && value <= max * 1.1) return 'warning';
    return 'critical';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'optimal': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'critical': return <XCircle className="h-4 w-4 text-red-600" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'optimal': return 'bg-green-100 text-green-800 border-green-200';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset);
    const newTargets = PRODUCT_RANGES[preset];
    if (newTargets) {
      onTargetsChange(newTargets);
      onPresetChange(preset);
    }
  };

  const updateTargetRange = (parameter: keyof ProductTargets, newRange: [number, number]) => {
    onTargetsChange({
      ...targets,
      [parameter]: newRange
    });
  };

  const parameters = [
    { key: 'sugar' as keyof ProductTargets, label: 'Sugar %', value: currentMetrics.sugars, max: 35 },
    { key: 'fat' as keyof ProductTargets, label: 'Fat %', value: currentMetrics.fat, max: 25 },
    { key: 'msnf' as keyof ProductTargets, label: 'MSNF %', value: currentMetrics.msnf, max: 15 },
    { key: 'total_solids' as keyof ProductTargets, label: 'Total Solids %', value: currentMetrics.ts_additive, max: 50 },
    { key: 'sp' as keyof ProductTargets, label: 'SP', value: currentMetrics.sp, max: 30 },
    { key: 'pac' as keyof ProductTargets, label: 'PAC', value: currentMetrics.pac, max: 35 }
  ];

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="h-5 w-5 text-blue-600" />
            Product Targets & Validation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Preset Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Product Preset</label>
            <Select value={selectedPreset} onValueChange={handlePresetChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="white_base">White Base</SelectItem>
                <SelectItem value="finished_gelato">Finished Gelato</SelectItem>
                <SelectItem value="fruit_gelato">Fruit Gelato</SelectItem>
                <SelectItem value="sorbet">Sorbet</SelectItem>
              </SelectContent>
            </Select>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-xs text-muted-foreground cursor-help">
                  Applies target bands for this base and tunes validation accordingly.
                </p>
              </TooltipTrigger>
              <TooltipContent>
                <p>Select a base style to apply recommended target bands and validation.</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Parameter Validation Grid */}
          <div className="space-y-3">
            <div className="text-sm font-medium flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Live Validation
            </div>
            
            {parameters.map(({ key, label, value, max }) => {
              const status = getValidationStatus(value, targets[key]);
              return (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-sm font-medium cursor-help">{label}</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {key === 'pac' && <p>PAC (Anti-freezing power); higher PAC → softer texture at the same temp.</p>}
                        {key === 'sp' && <p>Relative sweetness vs sucrose = 1.00; total SP guides perceived sweetness.</p>}
                        {key === 'total_solids' && <p>Total solids = sugars + fat + MSNF + other solids (stabilizers, fiber, cocoa).</p>}
                      </TooltipContent>
                    </Tooltip>
                    
                    <div className="flex items-center gap-2">
                      {getStatusIcon(status)}
                      <Badge className={`${getStatusColor(status)} text-xs`}>
                        {value.toFixed(1)}{key.includes('_') ? '' : '%'}
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Range Indicator */}
                  <div className="relative">
                    <div className="h-2 bg-muted rounded-full">
                      {/* Target Range */}
                      <div 
                        className="absolute h-2 bg-green-200 rounded-full"
                        style={{
                          left: `${(targets[key][0] / max) * 100}%`,
                          width: `${((targets[key][1] - targets[key][0]) / max) * 100}%`
                        }}
                      />
                      {/* Current Value */}
                      <div 
                        className={`absolute top-0 w-1 h-2 rounded-full ${
                          status === 'optimal' ? 'bg-green-600' : 
                          status === 'warning' ? 'bg-yellow-600' : 'bg-red-600'
                        }`}
                        style={{
                          left: `${Math.min(Math.max((value / max) * 100, 0), 100)}%`
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>Target: {targets[key][0]}-{targets[key][1]}{key.includes('_') ? '' : '%'}</span>
                      <span>Max: {max}</span>
                    </div>
                  </div>

                  {/* Target Range Adjusters */}
                  <div className="space-y-1">
                    <Slider
                      value={[targets[key][0], targets[key][1]]}
                      onValueChange={(newValue) => updateTargetRange(key, [newValue[0], newValue[1]])}
                      max={max}
                      min={0}
                      step={0.1}
                      className="w-full"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <div className="text-sm font-medium mb-2">Validation Summary</div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-600" />
                <span>{parameters.filter(p => getValidationStatus(p.value, targets[p.key]) === 'optimal').length} Optimal</span>
              </div>
              <div className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-yellow-600" />
                <span>{parameters.filter(p => getValidationStatus(p.value, targets[p.key]) === 'warning').length} Warning</span>
              </div>
              <div className="flex items-center gap-1">
                <XCircle className="h-3 w-3 text-red-600" />
                <span>{parameters.filter(p => getValidationStatus(p.value, targets[p.key]) === 'critical').length} Critical</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};

export default TargetPanel;