
import React, { useState } from 'react';
import { Plus, Camera, Mic, Search, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface Ingredient {
  name: string;
  amount: number;
  unit: string;
}

interface MobileRecipeInputProps {
  onRecipeCreated: (recipe: { name: string; ingredients: Ingredient[] }) => void;
}

const MobileRecipeInput = ({ onRecipeCreated }: MobileRecipeInputProps) => {
  const [inputMethod, setInputMethod] = useState<'manual' | 'photo' | 'voice' | 'search'>('manual');
  const [recipeName, setRecipeName] = useState('');
  const [currentIngredient, setCurrentIngredient] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [currentUnit, setCurrentUnit] = useState('g');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const { toast } = useToast();

  const commonIngredients = [
    'Heavy Cream', 'Whole Milk', 'Sugar', 'Egg Yolks', 'Vanilla Extract',
    'Honey', 'Coconut Milk', 'Dark Chocolate', 'Strawberries', 'Lemon Juice',
    'Stabilizer', 'Salt', 'Butter', 'Cocoa Powder', 'Mint Extract'
  ];

  const units = ['g', 'ml', 'tsp', 'tbsp', 'cup', 'pieces', 'drops'];

  const addIngredient = () => {
    if (!currentIngredient.trim() || !currentAmount) {
      toast({
        title: "Missing Information",
        description: "Please enter both ingredient name and amount",
        variant: "destructive"
      });
      return;
    }

    const newIngredient: Ingredient = {
      name: currentIngredient.trim(),
      amount: Number(currentAmount),
      unit: currentUnit
    };

    setIngredients([...ingredients, newIngredient]);
    setCurrentIngredient('');
    setCurrentAmount('');
    
    toast({
      title: "Ingredient Added",
      description: `${newIngredient.name} added to recipe`,
    });
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
    toast({
      title: "Ingredient Removed",
      description: "Ingredient removed from recipe",
    });
  };

  const handleQuickAdd = (ingredientName: string) => {
    setCurrentIngredient(ingredientName);
  };

  const quickAddWithDefaults = (ingredientName: string, defaultAmount: number, defaultUnit: string) => {
    const newIngredient: Ingredient = {
      name: ingredientName,
      amount: defaultAmount,
      unit: defaultUnit
    };

    setIngredients([...ingredients, newIngredient]);
    
    toast({
      title: "Quick Added",
      description: `${ingredientName} (${defaultAmount}${defaultUnit}) added`,
    });
  };

  const createRecipe = () => {
    if (!recipeName.trim() || ingredients.length === 0) {
      toast({
        title: "Recipe Incomplete",
        description: "Please add a recipe name and at least one ingredient",
        variant: "destructive"
      });
      return;
    }

    onRecipeCreated({
      name: recipeName,
      ingredients
    });

    // Reset form
    setRecipeName('');
    setIngredients([]);
    
    toast({
      title: "Recipe Created!",
      description: `${recipeName} has been created with ${ingredients.length} ingredients`,
    });
  };

  const handleVoiceInput = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setCurrentIngredient(transcript);
        toast({
          title: "Voice Input Captured",
          description: `Added: ${transcript}`,
        });
      };

      recognition.onerror = () => {
        toast({
          title: "Voice Input Error",
          description: "Please try again or use manual input",
          variant: "destructive"
        });
      };

      recognition.start();
    } else {
      toast({
        title: "Voice Input Not Supported",
        description: "Please use manual input instead",
        variant: "destructive"
      });
    }
  };

  const handlePhotoInput = () => {
    // Simulate photo recognition
    toast({
      title: "Photo Recognition",
      description: "Photo ingredient recognition coming soon!",
    });
  };

  const adjustAmount = (index: number, delta: number) => {
    setIngredients(prev => prev.map((ingredient, i) => 
      i === index 
        ? { ...ingredient, amount: Math.max(0, ingredient.amount + delta) }
        : ingredient
    ));
  };

  const totalWeight = ingredients.reduce((sum, ing) => sum + ing.amount, 0);

  return (
    <div className="max-w-md mx-auto space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Quick Recipe Builder
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Input Method Selection */}
          <div className="grid grid-cols-3 gap-1">
            <Button
              variant={inputMethod === 'manual' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setInputMethod('manual')}
              className="text-xs px-2"
            >
              Manual
            </Button>
            <Button
              variant={inputMethod === 'voice' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setInputMethod('voice')}
              className="text-xs px-2"
            >
              <Mic className="h-3 w-3 mr-1" />
              Voice
            </Button>
            <Button
              variant={inputMethod === 'photo' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setInputMethod('photo')}
              className="text-xs px-2"
            >
              <Camera className="h-3 w-3 mr-1" />
              Photo
            </Button>
          </div>

          {/* Recipe Name */}
          <div>
            <Input
              placeholder="Recipe name..."
              value={recipeName}
              onChange={(e) => setRecipeName(e.target.value)}
              className="text-base"
            />
          </div>

          {/* Current Ingredients List */}
          {ingredients.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">Ingredients ({ingredients.length})</h4>
                <div className="text-xs text-muted-foreground">Total: {totalWeight.toFixed(0)}g</div>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {ingredients.map((ingredient, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                    <div className="flex-1">
                      <div className="text-sm font-medium">{ingredient.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {ingredient.amount} {ingredient.unit}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => adjustAmount(index, -5)}
                        className="h-6 w-6 p-0 text-xs"
                      >
                        -
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => adjustAmount(index, 5)}
                        className="h-6 w-6 p-0 text-xs"
                      >
                        +
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeIngredient(index)}
                        className="h-6 w-6 p-0 text-red-500"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Add Common Ingredients */}
          <div>
            <h4 className="font-semibold text-sm mb-2">Quick Add (with defaults)</h4>
            <div className="grid grid-cols-2 gap-1">
              <Badge
                variant="outline"
                className="cursor-pointer hover:bg-primary hover:text-primary-foreground text-xs p-2 justify-center"
                onClick={() => quickAddWithDefaults('Heavy Cream', 500, 'ml')}
              >
                Heavy Cream (500ml)
              </Badge>
              <Badge
                variant="outline"
                className="cursor-pointer hover:bg-primary hover:text-primary-foreground text-xs p-2 justify-center"
                onClick={() => quickAddWithDefaults('Whole Milk', 250, 'ml')}
              >
                Milk (250ml)
              </Badge>
              <Badge
                variant="outline"
                className="cursor-pointer hover:bg-primary hover:text-primary-foreground text-xs p-2 justify-center"
                onClick={() => quickAddWithDefaults('Sugar', 120, 'g')}
              >
                Sugar (120g)
              </Badge>
              <Badge
                variant="outline"
                className="cursor-pointer hover:bg-primary hover:text-primary-foreground text-xs p-2 justify-center"
                onClick={() => quickAddWithDefaults('Egg Yolks', 100, 'g')}
              >
                Egg Yolks (100g)
              </Badge>
              <Badge
                variant="outline"
                className="cursor-pointer hover:bg-primary hover:text-primary-foreground text-xs p-2 justify-center"
                onClick={() => quickAddWithDefaults('Vanilla Extract', 5, 'ml')}
              >
                Vanilla (5ml)
              </Badge>
              <Badge
                variant="outline"
                className="cursor-pointer hover:bg-primary hover:text-primary-foreground text-xs p-2 justify-center"
                onClick={() => quickAddWithDefaults('Stabilizer', 2, 'g')}
              >
                Stabilizer (2g)
              </Badge>
            </div>
          </div>

          {/* Manual Ingredient Entry */}
          <div className="space-y-3 p-3 bg-primary/10 dark:bg-primary/20 rounded-lg">
            <h4 className="font-semibold text-sm">Add Custom Ingredient</h4>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Ingredient name"
                  value={currentIngredient}
                  onChange={(e) => setCurrentIngredient(e.target.value)}
                  className="flex-1 text-sm"
                />
                {inputMethod === 'voice' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleVoiceInput}
                    className="px-2"
                  >
                    <Mic className="h-4 w-4" />
                  </Button>
                )}
                {inputMethod === 'photo' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePhotoInput}
                    className="px-2"
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                )}
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                <Input
                  type="number"
                  placeholder="Amount"
                  value={currentAmount}
                  onChange={(e) => setCurrentAmount(e.target.value)}
                  className="text-sm"
                />
                <select
                  value={currentUnit}
                  onChange={(e) => setCurrentUnit(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                >
                  {units.map(unit => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
                <Button onClick={addIngredient} size="sm" className="text-xs">
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>
            </div>
          </div>

          {/* Create Recipe Button */}
          <Button 
            onClick={createRecipe} 
            className="w-full"
            disabled={!recipeName.trim() || ingredients.length === 0}
          >
            Create Recipe ({ingredients.length} ingredients)
          </Button>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setIngredients([]);
                setRecipeName('');
              }}
            >
              Clear All
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                // Load sample recipe
                setRecipeName('Sample Vanilla Ice Cream');
                setIngredients([
                  { name: 'Heavy Cream', amount: 500, unit: 'ml' },
                  { name: 'Whole Milk', amount: 250, unit: 'ml' },
                  { name: 'Sugar', amount: 120, unit: 'g' },
                  { name: 'Egg Yolks', amount: 100, unit: 'g' },
                  { name: 'Vanilla Extract', amount: 5, unit: 'ml' }
                ]);
                toast({
                  title: "Sample Loaded",
                  description: "Sample vanilla ice cream recipe loaded"
                });
              }}
            >
              Load Sample
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MobileRecipeInput;
