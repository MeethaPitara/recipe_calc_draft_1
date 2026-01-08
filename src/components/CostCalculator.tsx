
import React, { useState } from 'react';
import { IndianRupee, TrendingUp, Calculator } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface CostIngredient {
  name: string;
  amount: number;
  unit: string;
  costPerUnit: number;
  totalCost: number;
}

const CostCalculator = () => {
  const [ingredients, setIngredients] = useState<CostIngredient[]>([
    { name: 'Heavy Cream (1L)', amount: 0.5, unit: 'L', costPerUnit: 380, totalCost: 0 },
    { name: 'Milk (1L)', amount: 0.25, unit: 'L', costPerUnit: 60, totalCost: 0 },
    { name: 'Sugar (1kg)', amount: 0.15, unit: 'kg', costPerUnit: 50, totalCost: 0 },
    { name: 'Eggs (dozen)', amount: 0.5, unit: 'dozen', costPerUnit: 120, totalCost: 0 }
  ]);
  
  const [servings, setServings] = useState(8);
  const [markupPercentage, setMarkupPercentage] = useState(300);

  const calculateCosts = () => {
    const updatedIngredients = ingredients.map(ingredient => ({
      ...ingredient,
      totalCost: ingredient.amount * ingredient.costPerUnit
    }));
    setIngredients(updatedIngredients);
  };

  const addIngredient = () => {
    setIngredients([...ingredients, { 
      name: '', 
      amount: 0, 
      unit: 'kg', 
      costPerUnit: 0, 
      totalCost: 0 
    }]);
  };

  const updateIngredient = (index: number, field: keyof CostIngredient, value: string | number) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'amount' || field === 'costPerUnit') {
      updated[index].totalCost = updated[index].amount * updated[index].costPerUnit;
    }
    setIngredients(updated);
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const totalCost = ingredients.reduce((sum, ingredient) => sum + ingredient.totalCost, 0);
  const costPerServing = totalCost / servings;
  const suggestedPrice = costPerServing * (1 + markupPercentage / 100);
  const profit = suggestedPrice - costPerServing;

  const formatCurrency = (amount: number) => `₹${amount.toFixed(2)}`;

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader className="bg-gradient-to-r from-warning/10 to-warning/5 dark:from-warning/20 dark:to-warning/10">
        <CardTitle className="flex items-center gap-2">
          <IndianRupee className="h-5 w-5 text-yellow-600" />
          Cost Calculator
        </CardTitle>
        <CardDescription>
          Calculate ingredient costs and suggested pricing for your ice cream recipes
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <Label className="text-base font-semibold">Recipe Ingredients</Label>
              <Button onClick={calculateCosts} size="sm" className="bg-yellow-600 hover:bg-yellow-700">
                <Calculator className="h-4 w-4 mr-2" />
                Calculate
              </Button>
            </div>
            
            <div className="space-y-3">
              {ingredients.map((ingredient, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end p-3 bg-muted rounded-lg">
                  <div className="col-span-4">
                    <Label className="text-xs text-muted-foreground">Ingredient</Label>
                    <Input
                      placeholder="Ingredient name"
                      value={ingredient.name}
                      onChange={(e) => updateIngredient(index, 'name', e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Amount</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={ingredient.amount}
                      onChange={(e) => updateIngredient(index, 'amount', Number(e.target.value))}
                      className="h-8"
                    />
                  </div>
                  <div className="col-span-1">
                    <Label className="text-xs text-muted-foreground">Unit</Label>
                    <Input
                      value={ingredient.unit}
                      onChange={(e) => updateIngredient(index, 'unit', e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Cost/Unit (₹)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={ingredient.costPerUnit}
                      onChange={(e) => updateIngredient(index, 'costPerUnit', Number(e.target.value))}
                      className="h-8"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Total Cost</Label>
                    <div className="h-8 px-2 py-1 bg-card border rounded text-sm font-medium text-success-foreground flex items-center">
                      {formatCurrency(ingredient.totalCost)}
                    </div>
                  </div>
                  <div className="col-span-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeIngredient(index)}
                      className="h-8 w-8 p-0"
                    >
                      ×
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Button
              onClick={addIngredient}
              variant="outline"
              className="mt-4 w-full border-dashed"
            >
              + Add Ingredient
            </Button>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <IndianRupee className="h-5 w-5" />
                  Pricing Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="servings" className="text-sm">Number of Servings</Label>
                  <Input
                    id="servings"
                    type="number"
                    value={servings}
                    onChange={(e) => setServings(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label htmlFor="markup" className="text-sm">Markup Percentage</Label>
                  <Input
                    id="markup"
                    type="number"
                    value={markupPercentage}
                    onChange={(e) => setMarkupPercentage(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Recipe Cost:</span>
                    <span className="font-semibold">{formatCurrency(totalCost)}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Cost per Serving:</span>
                    <span className="font-semibold">{formatCurrency(costPerServing)}</span>
                  </div>
                  
                  <div className="flex justify-between text-lg">
                    <span className="text-green-700 font-semibold">Suggested Price:</span>
                    <span className="font-bold text-green-700 flex items-center gap-1">
                      <IndianRupee className="h-5 w-5" />
                      {suggestedPrice.toFixed(2)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Profit per Serving:</span>
                    <span className="font-semibold text-green-600">{formatCurrency(profit)}</span>
                  </div>
                </div>

                <div className="pt-3 border-t">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <TrendingUp className="h-4 w-4" />
                    <span>
                      {markupPercentage}% markup = {((profit / costPerServing) * 100).toFixed(0)}% profit margin
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CostCalculator;
