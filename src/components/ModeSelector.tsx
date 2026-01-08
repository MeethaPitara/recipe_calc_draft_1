import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { IceCream2, Milk } from "lucide-react";

interface ModeSelectorProps {
  mode: 'gelato' | 'kulfi';
  onChange: (mode: 'gelato' | 'kulfi') => void;
}

export const ModeSelector = ({ mode, onChange }: ModeSelectorProps) => {
  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <Label className="text-base font-semibold">Recipe Mode:</Label>
          <ToggleGroup 
            type="single" 
            value={mode} 
            onValueChange={(value) => value && onChange(value as 'gelato' | 'kulfi')}
            className="justify-start"
          >
            <ToggleGroupItem 
              value="gelato" 
              className="flex items-center gap-2"
              aria-label="Switch to Gelato mode"
            >
              <IceCream2 className="h-4 w-4" />
              Gelato
              <Badge variant="secondary" className="ml-1">Western</Badge>
            </ToggleGroupItem>
            <ToggleGroupItem 
              value="kulfi" 
              className="flex items-center gap-2"
              aria-label="Switch to Kulfi mode"
            >
              <Milk className="h-4 w-4" />
              Kulfi
              <Badge variant="secondary" className="ml-1">Indian</Badge>
            </ToggleGroupItem>
          </ToggleGroup>
          
          <div className="ml-auto text-sm text-muted-foreground">
            {mode === 'gelato' ? (
              <span>FPDT: 2.5-3.5°C | Fat: 6-9% | Sugars: 16-22%</span>
            ) : (
              <span>FPDT: 2.0-2.5°C | Fat: 10-12% | Protein: 6-9%</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
