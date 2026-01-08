import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { IceCream2, Milk, Apple, Sparkles } from "lucide-react";

type ProductCategory = 'base' | 'finished' | 'regional';
type BaseProduct = 'gelato-base' | 'ice-cream-base' | 'kulfi-base';
type FinishedProduct = 'gelato' | 'ice-cream' | 'sorbet' | 'kulfi';
type RegionalProduct = 'indian-traditional' | 'mediterranean' | 'asian-fusion';

export type EnhancedProductMode = BaseProduct | FinishedProduct | RegionalProduct;

interface EnhancedModeSelectorProps {
  mode: EnhancedProductMode;
  onChange: (mode: EnhancedProductMode) => void;
}

const productConfig: Record<EnhancedProductMode, {
  label: string;
  category: ProductCategory;
  icon: React.ComponentType<{ className?: string }>;
  badge: string;
  params: string;
}> = {
  'gelato-base': {
    label: 'Gelato Base',
    category: 'base',
    icon: IceCream2,
    badge: 'White Base',
    params: 'TS: 36-40% | Fat: 6-8% | Sugar: 16-18%'
  },
  'ice-cream-base': {
    label: 'Ice Cream Base',
    category: 'base',
    icon: IceCream2,
    badge: 'White Base',
    params: 'TS: 38-42% | Fat: 10-14% | Sugar: 14-16%'
  },
  'kulfi-base': {
    label: 'Kulfi Base',
    category: 'base',
    icon: Milk,
    badge: 'Indian Base',
    params: 'TS: 40-45% | Fat: 10-12% | Protein: 6-9%'
  },
  'gelato': {
    label: 'Gelato (Finished)',
    category: 'finished',
    icon: IceCream2,
    badge: 'Western',
    params: 'FPDT: 2.5-3.5°C | Fat: 6-9% | Sugar: 16-22%'
  },
  'ice-cream': {
    label: 'Ice Cream (Finished)',
    category: 'finished',
    icon: IceCream2,
    badge: 'American',
    params: 'FPDT: 2.0-3.0°C | Fat: 10-16% | Sugar: 14-18%'
  },
  'sorbet': {
    label: 'Sorbet (Finished)',
    category: 'finished',
    icon: Apple,
    badge: 'Fruit',
    params: 'FPDT: 3.0-4.0°C | Sugar: 20-30% | No dairy'
  },
  'kulfi': {
    label: 'Kulfi (Finished)',
    category: 'finished',
    icon: Milk,
    badge: 'Indian',
    params: 'FPDT: 2.0-2.5°C | Fat: 10-12% | Protein: 6-9%'
  },
  'indian-traditional': {
    label: 'Indian Traditional',
    category: 'regional',
    icon: Sparkles,
    badge: 'Regional',
    params: 'Mango, Pistachio, Saffron, Cardamom'
  },
  'mediterranean': {
    label: 'Mediterranean',
    category: 'regional',
    icon: Sparkles,
    badge: 'Regional',
    params: 'Olive Oil, Fig, Honey, Lavender'
  },
  'asian-fusion': {
    label: 'Asian Fusion',
    category: 'regional',
    icon: Sparkles,
    badge: 'Regional',
    params: 'Matcha, Black Sesame, Yuzu, Ube'
  }
};

export const EnhancedModeSelector = ({ mode, onChange }: EnhancedModeSelectorProps) => {
  const currentConfig = productConfig[mode];
  const Icon = currentConfig.icon;

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold flex items-center gap-2">
              <Icon className="h-5 w-5 text-primary" />
              Product Mode
            </Label>
            <Badge variant="secondary">{currentConfig.badge}</Badge>
          </div>

          <Select value={mode} onValueChange={(value) => onChange(value as EnhancedProductMode)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                BASE PRODUCTS
              </div>
              {(Object.entries(productConfig) as [EnhancedProductMode, typeof productConfig[EnhancedProductMode]][])
                .filter(([_, config]) => config.category === 'base')
                .map(([key, config]) => {
                  const OptionIcon = config.icon;
                  return (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <OptionIcon className="h-4 w-4" />
                        <span>{config.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">
                FINISHED PRODUCTS
              </div>
              {(Object.entries(productConfig) as [EnhancedProductMode, typeof productConfig[EnhancedProductMode]][])
                .filter(([_, config]) => config.category === 'finished')
                .map(([key, config]) => {
                  const OptionIcon = config.icon;
                  return (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <OptionIcon className="h-4 w-4" />
                        <span>{config.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">
                REGIONAL STYLES
              </div>
              {(Object.entries(productConfig) as [EnhancedProductMode, typeof productConfig[EnhancedProductMode]][])
                .filter(([_, config]) => config.category === 'regional')
                .map(([key, config]) => {
                  const OptionIcon = config.icon;
                  return (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <OptionIcon className="h-4 w-4" />
                        <span>{config.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
            </SelectContent>
          </Select>

          <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-md">
            <div className="font-medium mb-1">{currentConfig.label} Parameters:</div>
            <div className="text-xs">{currentConfig.params}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
