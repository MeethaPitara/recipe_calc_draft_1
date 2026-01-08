import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, DollarSign, TrendingUp, Calculator, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  calculateCostBreakdown,
  calculatePricingStrategies,
  calculateCostPerServing,
  exportToCSV,
  downloadCSV,
  DEFAULT_COSTING_PARAMS,
  type CostingParams,
} from "@/services/costingService";

interface CostingModuleProps {
  ingredients: Array<{ name: string; weight: number; costPerKg?: number }>;
  recipeName?: string;
}

export const CostingModule = ({ ingredients, recipeName = "Recipe" }: CostingModuleProps) => {
  const { toast } = useToast();
  const [params, setParams] = useState<CostingParams>(DEFAULT_COSTING_PARAMS);
  const [customMarkup, setCustomMarkup] = useState<number>(100);

  // Calculate cost breakdown
  const costBreakdown = useMemo(() => {
    return calculateCostBreakdown(ingredients, params);
  }, [ingredients, params]);

  // Calculate pricing strategies
  const pricingStrategies = useMemo(() => {
    return calculatePricingStrategies(costBreakdown, params.batchSize);
  }, [costBreakdown, params.batchSize]);

  // Calculate cost per serving
  const costPerServing = useMemo(() => {
    return calculateCostPerServing(costBreakdown.totalCost, params.batchSize);
  }, [costBreakdown.totalCost, params.batchSize]);

  // Calculate cost per kg
  const costPerKg = costBreakdown.totalCost / params.batchSize;

  // Calculate custom pricing
  const customPrice = costPerKg * (1 + customMarkup / 100);
  const customProfit = customPrice - costPerKg;
  const customMargin = (customProfit / customPrice) * 100;

  const handleExport = () => {
    const csvContent = exportToCSV(costBreakdown, pricingStrategies, params.batchSize);
    downloadCSV(csvContent, `${recipeName.toLowerCase().replace(/\s+/g, '-')}-cost-analysis.csv`);
    
    toast({
      title: "Export Successful",
      description: "Cost analysis has been exported to CSV",
    });
  };

  const updateParam = (key: keyof CostingParams, value: number) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      {/* Configuration Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Costing Parameters
          </CardTitle>
          <CardDescription>
            Configure batch size, waste factors, and overhead costs
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="batchSize">Batch Size (kg)</Label>
            <Input
              id="batchSize"
              type="number"
              value={params.batchSize}
              onChange={(e) => updateParam('batchSize', parseFloat(e.target.value) || 0)}
              min="0"
              step="0.1"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wasteFactor">Waste Factor (%)</Label>
            <Input
              id="wasteFactor"
              type="number"
              value={params.wasteFactor}
              onChange={(e) => updateParam('wasteFactor', parseFloat(e.target.value) || 0)}
              min="0"
              step="0.5"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="laborCost">Labor Cost (₹/batch)</Label>
            <Input
              id="laborCost"
              type="number"
              value={params.laborCostPerBatch}
              onChange={(e) => updateParam('laborCostPerBatch', parseFloat(e.target.value) || 0)}
              min="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="overhead">Overhead (%)</Label>
            <Input
              id="overhead"
              type="number"
              value={params.overheadPercentage}
              onChange={(e) => updateParam('overheadPercentage', parseFloat(e.target.value) || 0)}
              min="0"
              step="0.5"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="packaging">Packaging (₹/kg)</Label>
            <Input
              id="packaging"
              type="number"
              value={params.packagingCostPerKg}
              onChange={(e) => updateParam('packagingCostPerKg', parseFloat(e.target.value) || 0)}
              min="0"
            />
          </div>
        </CardContent>
      </Card>

      {/* Cost Breakdown Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Cost Breakdown
          </CardTitle>
          <CardDescription>
            Detailed cost analysis for {recipeName}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Ingredient Costs Table */}
          <div>
            <h4 className="font-semibold mb-2">Ingredient Costs</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ingredient</TableHead>
                  <TableHead className="text-right">Weight (g)</TableHead>
                  <TableHead className="text-right">Cost/kg (₹)</TableHead>
                  <TableHead className="text-right">Total (₹)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costBreakdown.ingredients.map((ing, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{ing.name}</TableCell>
                    <TableCell className="text-right">{ing.weight.toFixed(1)}</TableCell>
                    <TableCell className="text-right">{ing.costPerKg.toFixed(2)}</TableCell>
                    <TableCell className="text-right">₹{ing.totalCost.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Separator />

          {/* Cost Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ingredient Cost:</span>
                <span className="font-medium">₹{costBreakdown.totalIngredientCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Waste ({costBreakdown.wasteFactor}%):</span>
                <span className="font-medium">₹{costBreakdown.wasteAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Labor Cost:</span>
                <span className="font-medium">₹{costBreakdown.laborCost.toFixed(2)}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Overhead:</span>
                <span className="font-medium">₹{costBreakdown.overheadCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Packaging:</span>
                <span className="font-medium">₹{costBreakdown.packagingCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Total Cost:</span>
                <span className="text-primary">₹{costBreakdown.totalCost.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">Cost per kg</p>
                  <p className="text-2xl font-bold text-primary">₹{costPerKg.toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">Cost per 100g serving</p>
                  <p className="text-2xl font-bold text-primary">₹{costPerServing.toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">Batch Size</p>
                  <p className="text-2xl font-bold text-primary">{params.batchSize} kg</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Strategies Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Pricing Strategies
          </CardTitle>
          <CardDescription>
            Recommended pricing based on different strategies
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Strategy</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Price/kg (₹)</TableHead>
                <TableHead className="text-right">Profit/kg (₹)</TableHead>
                <TableHead className="text-right">Margin (%)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pricingStrategies.map((strategy, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <Badge variant={strategy.strategy === 'markup' ? 'default' : 'secondary'}>
                      {strategy.strategy === 'markup' ? 'Markup' : 'Margin'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{strategy.value}%</TableCell>
                  <TableCell className="text-right font-medium">₹{strategy.suggestedPrice.toFixed(2)}</TableCell>
                  <TableCell className="text-right text-green-600">₹{strategy.profit.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{strategy.profitMargin.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Separator />

          {/* Custom Pricing Calculator */}
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Custom Pricing Calculator
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customMarkup">Your Markup (%)</Label>
                <Input
                  id="customMarkup"
                  type="number"
                  value={customMarkup}
                  onChange={(e) => setCustomMarkup(parseFloat(e.target.value) || 0)}
                  min="0"
                  step="5"
                />
              </div>
              <div className="space-y-2">
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Selling Price/kg:</span>
                    <span className="font-bold">₹{customPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Profit/kg:</span>
                    <span className="font-bold text-green-600">₹{customProfit.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Profit Margin:</span>
                    <span className="font-bold">{customMargin.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export Section */}
      <Card>
        <CardContent className="pt-6">
          <Button onClick={handleExport} className="w-full" size="lg">
            <Download className="mr-2 h-4 w-4" />
            Export Cost Analysis to CSV
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
