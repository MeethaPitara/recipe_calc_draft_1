import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface RecipeIngredient {
  ingredient: string;
  quantity: number;
}

interface RecipeInputDialogProps {
  onRecipeSubmit: (recipe: RecipeIngredient[], productType: string) => void;
  trigger?: React.ReactNode;
}

export function RecipeInputDialog({ onRecipeSubmit, trigger }: RecipeInputDialogProps) {
  const [open, setOpen] = useState(false);
  const [productType, setProductType] = useState('ice_cream');
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([
    { ingredient: '', quantity: 0 }
  ]);

  const addIngredient = () => {
    setIngredients([...ingredients, { ingredient: '', quantity: 0 }]);
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const updateIngredient = (index: number, field: 'ingredient' | 'quantity', value: string | number) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };
    setIngredients(updated);
  };

  const handleSubmit = () => {
    const validIngredients = ingredients.filter(
      ing => ing.ingredient.trim() !== '' && ing.quantity > 0
    );
    
    if (validIngredients.length === 0) {
      return;
    }
    
    onRecipeSubmit(validIngredients, productType);
    setOpen(false);
    setIngredients([{ ingredient: '', quantity: 0 }]);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Input Recipe
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Input Recipe for Analysis</DialogTitle>
          <DialogDescription>
            Enter your recipe ingredients to get AI predictions and insights
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Product Type</Label>
            <Select value={productType} onValueChange={setProductType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ice_cream">Ice Cream</SelectItem>
                <SelectItem value="gelato">Gelato</SelectItem>
                <SelectItem value="sorbet">Sorbet</SelectItem>
                <SelectItem value="frozen_yogurt">Frozen Yogurt</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Ingredients</Label>
              <Button onClick={addIngredient} variant="ghost" size="sm" className="gap-1">
                <Plus className="h-3 w-3" />
                Add
              </Button>
            </div>

            {ingredients.map((ing, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder="Ingredient name"
                  value={ing.ingredient}
                  onChange={(e) => updateIngredient(index, 'ingredient', e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="number"
                  placeholder="Quantity (g)"
                  value={ing.quantity || ''}
                  onChange={(e) => updateIngredient(index, 'quantity', parseFloat(e.target.value) || 0)}
                  className="w-32"
                />
                {ingredients.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeIngredient(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              Analyze Recipe
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
