import React, { useState } from 'react';
import { Trash2, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { IngredientData } from '@/types/ingredients';

interface MobileIngredientRowProps {
  index: number;
  ingredientId: string;
  grams: number;
  ingredients: Record<string, IngredientData>;
  percentage?: string;
  onUpdate: (index: number, field: 'ingredientId' | 'grams', value: string | number) => void;
  onAdjust: (index: number, delta: number) => void;
  onRemove: (index: number) => void;
  isProductionMode?: boolean;
}

export const MobileIngredientRow: React.FC<MobileIngredientRowProps> = ({
  index,
  ingredientId,
  grams,
  ingredients,
  percentage,
  onUpdate,
  onAdjust,
  onRemove,
  isProductionMode = false,
}) => {
  const [touchStart, setTouchStart] = useState({ x: 0, y: 0 });
  const [touchEnd, setTouchEnd] = useState({ x: 0, y: 0 });
  const [swipeOffset, setSwipeOffset] = useState(0);

  const ing = ingredients[ingredientId];

  // Calculate composition breakdown
  const sugars_g = ing ? ((ing.sugars_pct ?? 0) / 100) * grams : 0;
  const fat_g = ing ? ((ing.fat_pct ?? 0) / 100) * grams : 0;
  const msnf_g = ing ? ((ing.msnf_pct ?? 0) / 100) * grams : 0;

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart({ 
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY 
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const currentX = e.targetTouches[0].clientX;
    const currentY = e.targetTouches[0].clientY;
    setTouchEnd({ x: currentX, y: currentY });
    
    const deltaX = touchStart.x - currentX;
    const deltaY = Math.abs(touchStart.y - currentY);
    
    // Ignore diagonal swipes (vertical scroll)
    if (deltaY > Math.abs(deltaX)) {
      setSwipeOffset(0);
      return;
    }
    
    if (deltaX > 0 && deltaX < 100) {
      setSwipeOffset(deltaX);
    }
  };

  const handleTouchEnd = () => {
    const deltaX = touchStart.x - touchEnd.x;
    const deltaY = Math.abs(touchStart.y - touchEnd.y);
    
    // Only trigger delete on deliberate horizontal swipes (72px threshold)
    if (deltaX > 72 && deltaY <= Math.abs(deltaX)) {
      onRemove(index);
    }
    setSwipeOffset(0);
  };

  if (isProductionMode) {
    return (
      <div className="py-4 border-b border-border last:border-0">
        <div className="text-base font-semibold mb-1">{ing?.name || ingredientId}</div>
        <div className="text-lg font-bold">{grams}g</div>
        {percentage && (
          <div className="text-sm text-muted-foreground mt-2">
            {percentage}% of batch
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="relative touch-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ transform: `translateX(-${swipeOffset}px)`, transition: swipeOffset === 0 ? 'transform 0.2s ease-in-out' : 'none' }}
    >
      <div className="pb-4 border-b border-border last:border-0">
        <div className="flex justify-between items-center mb-3">
          <Label className="text-base font-medium">Ingredient {index + 1}</Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(index)}
            className="h-11 w-11 p-0 text-destructive touch-target transition-all duration-200 ease-in-out"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <Select value={ingredientId} onValueChange={(value) => onUpdate(index, 'ingredientId', value)}>
          <SelectTrigger className="mb-3 h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.values(ingredients).map((ing) => (
              <SelectItem key={ing.id} value={ing.id}>
                {ing.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Enhanced quantity input with direct numeric entry */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Qty (g)</Label>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="lg"
              onClick={() => onAdjust(index, -10)}
              className="h-12 w-12 p-0 flex-shrink-0 touch-target"
            >
              <Minus className="h-5 w-5" />
            </Button>
            
            {/* Direct numeric input */}
            <Input
              type="number"
              inputMode="decimal"
              value={grams}
              onChange={(e) => {
                const parsed = parseFloat(e.target.value);
                if (!isNaN(parsed) && parsed >= 0) {
                  onUpdate(index, 'grams', parsed);
                } else if (e.target.value === '') {
                  onUpdate(index, 'grams', 0);
                }
              }}
              placeholder="Enter grams"
              className="flex-1 text-center text-xl font-bold h-12"
            />

            <Button
              variant="outline"
              size="lg"
              onClick={() => onAdjust(index, 10)}
              className="h-12 w-12 p-0 flex-shrink-0 touch-target"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>
          
          {/* Percentage display */}
          {percentage && (
            <div className="text-xs text-muted-foreground text-center">
              {percentage}% of batch
            </div>
          )}
        </div>

        {/* Real-time gram breakdown */}
        {ing && grams > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div className="bg-muted/50 rounded p-2 text-center">
              <div className="text-muted-foreground">Sugars</div>
              <div className="font-medium">{sugars_g.toFixed(1)}g</div>
            </div>
            <div className="bg-muted/50 rounded p-2 text-center">
              <div className="text-muted-foreground">Fat</div>
              <div className="font-medium">{fat_g.toFixed(1)}g</div>
            </div>
            <div className="bg-muted/50 rounded p-2 text-center">
              <div className="text-muted-foreground">MSNF</div>
              <div className="font-medium">{msnf_g.toFixed(1)}g</div>
            </div>
          </div>
        )}
      </div>

      {/* Swipe delete indicator */}
      {swipeOffset > 20 && (
        <div
          className="absolute right-0 top-0 bottom-0 flex items-center justify-center bg-destructive text-destructive-foreground px-4"
          style={{ width: `${swipeOffset}px` }}
        >
          <Trash2 className="h-4 w-4" />
        </div>
      )}
    </div>
  );
};
