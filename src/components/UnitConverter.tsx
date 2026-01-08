
import React, { useState } from 'react';
import { ArrowRightLeft, Scale } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const UnitConverter = () => {
  const [weightValue, setWeightValue] = useState('');
  const [weightFromUnit, setWeightFromUnit] = useState('g');
  const [weightToUnit, setWeightToUnit] = useState('oz');
  
  const [volumeValue, setVolumeValue] = useState('');
  const [volumeFromUnit, setVolumeFromUnit] = useState('ml');
  const [volumeToUnit, setVolumeToUnit] = useState('cups');
  
  const [tempValue, setTempValue] = useState('');
  const [tempFromUnit, setTempFromUnit] = useState('celsius');
  const [tempToUnit, setTempToUnit] = useState('fahrenheit');

  // Conversion functions
  const convertWeight = (value: number, from: string, to: string): number => {
    const grams = {
      'g': value,
      'kg': value * 1000,
      'oz': value * 28.3495,
      'lb': value * 453.592
    }[from] || 0;

    return {
      'g': grams,
      'kg': grams / 1000,
      'oz': grams / 28.3495,
      'lb': grams / 453.592
    }[to] || 0;
  };

  const convertVolume = (value: number, from: string, to: string): number => {
    const ml = {
      'ml': value,
      'l': value * 1000,
      'cups': value * 236.588,
      'fl-oz': value * 29.5735,
      'tbsp': value * 14.7868,
      'tsp': value * 4.92892,
      'pint': value * 473.176,
      'quart': value * 946.353,
      'gallon': value * 3785.41
    }[from] || 0;

    return {
      'ml': ml,
      'l': ml / 1000,
      'cups': ml / 236.588,
      'fl-oz': ml / 29.5735,
      'tbsp': ml / 14.7868,
      'tsp': ml / 4.92892,
      'pint': ml / 473.176,
      'quart': ml / 946.353,
      'gallon': ml / 3785.41
    }[to] || 0;
  };

  const convertTemperature = (value: number, from: string, to: string): number => {
    if (from === to) return value;
    
    let celsius = value;
    if (from === 'fahrenheit') {
      celsius = (value - 32) * 5/9;
    } else if (from === 'kelvin') {
      celsius = value - 273.15;
    }
    
    if (to === 'fahrenheit') {
      return celsius * 9/5 + 32;
    } else if (to === 'kelvin') {
      return celsius + 273.15;
    }
    return celsius;
  };

  const weightResult = weightValue ? convertWeight(Number(weightValue), weightFromUnit, weightToUnit) : 0;
  const volumeResult = volumeValue ? convertVolume(Number(volumeValue), volumeFromUnit, volumeToUnit) : 0;
  const tempResult = tempValue ? convertTemperature(Number(tempValue), tempFromUnit, tempToUnit) : 0;

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="bg-gradient-to-r from-success/10 to-primary/10 dark:from-success/20 dark:to-primary/20">
        <CardTitle className="flex items-center gap-2">
          <ArrowRightLeft className="h-5 w-5 text-green-600" />
          Unit Converter
        </CardTitle>
        <CardDescription>
          Convert between different units for precise recipe measurements
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <Tabs defaultValue="weight" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="weight">Weight</TabsTrigger>
            <TabsTrigger value="volume">Volume</TabsTrigger>
            <TabsTrigger value="temperature">Temperature</TabsTrigger>
          </TabsList>
          
          <TabsContent value="weight" className="mt-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="weight-value">Amount</Label>
                  <Input
                    id="weight-value"
                    type="number"
                    step="0.01"
                    placeholder="Enter amount"
                    value={weightValue}
                    onChange={(e) => setWeightValue(e.target.value)}
                  />
                </div>
                <div>
                  <Label>From Unit</Label>
                  <Select value={weightFromUnit} onValueChange={setWeightFromUnit}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="g">Grams (g)</SelectItem>
                      <SelectItem value="kg">Kilograms (kg)</SelectItem>
                      <SelectItem value="oz">Ounces (oz)</SelectItem>
                      <SelectItem value="lb">Pounds (lb)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex items-center justify-center">
                <Scale className="h-6 w-6 text-muted-foreground" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Result</Label>
                  <div className="p-2 bg-success/10 dark:bg-success/20 rounded border text-lg font-semibold text-success-foreground">
                    {weightResult.toFixed(3)}
                  </div>
                </div>
                <div>
                  <Label>To Unit</Label>
                  <Select value={weightToUnit} onValueChange={setWeightToUnit}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="g">Grams (g)</SelectItem>
                      <SelectItem value="kg">Kilograms (kg)</SelectItem>
                      <SelectItem value="oz">Ounces (oz)</SelectItem>
                      <SelectItem value="lb">Pounds (lb)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="volume" className="mt-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="volume-value">Amount</Label>
                  <Input
                    id="volume-value"
                    type="number"
                    step="0.01"
                    placeholder="Enter amount"
                    value={volumeValue}
                    onChange={(e) => setVolumeValue(e.target.value)}
                  />
                </div>
                <div>
                  <Label>From Unit</Label>
                  <Select value={volumeFromUnit} onValueChange={setVolumeFromUnit}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ml">Milliliters (ml)</SelectItem>
                      <SelectItem value="l">Liters (l)</SelectItem>
                      <SelectItem value="cups">Cups</SelectItem>
                      <SelectItem value="fl-oz">Fluid Ounces (fl oz)</SelectItem>
                      <SelectItem value="tbsp">Tablespoons (tbsp)</SelectItem>
                      <SelectItem value="tsp">Teaspoons (tsp)</SelectItem>
                      <SelectItem value="pint">Pints</SelectItem>
                      <SelectItem value="quart">Quarts</SelectItem>
                      <SelectItem value="gallon">Gallons</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex items-center justify-center">
                <Scale className="h-6 w-6 text-muted-foreground" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Result</Label>
                  <div className="p-2 bg-primary/10 dark:bg-primary/20 rounded border text-lg font-semibold text-primary">
                    {volumeResult.toFixed(3)}
                  </div>
                </div>
                <div>
                  <Label>To Unit</Label>
                  <Select value={volumeToUnit} onValueChange={setVolumeToUnit}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ml">Milliliters (ml)</SelectItem>
                      <SelectItem value="l">Liters (l)</SelectItem>
                      <SelectItem value="cups">Cups</SelectItem>
                      <SelectItem value="fl-oz">Fluid Ounces (fl oz)</SelectItem>
                      <SelectItem value="tbsp">Tablespoons (tbsp)</SelectItem>
                      <SelectItem value="tsp">Teaspoons (tsp)</SelectItem>
                      <SelectItem value="pint">Pints</SelectItem>
                      <SelectItem value="quart">Quarts</SelectItem>
                      <SelectItem value="gallon">Gallons</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="temperature" className="mt-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="temp-value">Temperature</Label>
                  <Input
                    id="temp-value"
                    type="number"
                    step="0.1"
                    placeholder="Enter temperature"
                    value={tempValue}
                    onChange={(e) => setTempValue(e.target.value)}
                  />
                </div>
                <div>
                  <Label>From Scale</Label>
                  <Select value={tempFromUnit} onValueChange={setTempFromUnit}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="celsius">Celsius (°C)</SelectItem>
                      <SelectItem value="fahrenheit">Fahrenheit (°F)</SelectItem>
                      <SelectItem value="kelvin">Kelvin (K)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="flex items-center justify-center">
                <Scale className="h-6 w-6 text-muted-foreground" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Result</Label>
                  <div className="p-2 bg-secondary/50 dark:bg-secondary/30 rounded border text-lg font-semibold text-secondary-foreground">
                    {tempResult.toFixed(1)}°
                  </div>
                </div>
                <div>
                  <Label>To Scale</Label>
                  <Select value={tempToUnit} onValueChange={setTempToUnit}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="celsius">Celsius (°C)</SelectItem>
                      <SelectItem value="fahrenheit">Fahrenheit (°F)</SelectItem>
                      <SelectItem value="kelvin">Kelvin (K)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default UnitConverter;
