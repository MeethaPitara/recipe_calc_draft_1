import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useIngredients } from '@/contexts/IngredientsContext';
import { IngredientService } from '@/services/ingredientService';
import { Plus, Loader2 } from 'lucide-react';
import type { IngredientData } from '@/types/ingredients';

interface AddIngredientDialogProps {
  onIngredientAdded?: (ingredient: IngredientData) => void;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  prefilledData?: Partial<IngredientData>;
}

export function AddIngredientDialog({ onIngredientAdded, trigger, open: controlledOpen, onOpenChange: externalOnOpenChange, prefilledData }: AddIngredientDialogProps) {
  const { toast } = useToast();
  const { refetch } = useIngredients();
  const [isLoading, setIsLoading] = useState(false);
  
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : undefined;

  const handleOpenChange = (newOpen: boolean) => {
    if (externalOnOpenChange) {
      externalOnOpenChange(newOpen);
    }
  };
  
  const [formData, setFormData] = useState({
    name: prefilledData?.name || '',
    category: (prefilledData?.category || 'other') as IngredientData['category'],
    water_pct: prefilledData?.water_pct || 0,
    sugars_pct: prefilledData?.sugars_pct || 0,
    fat_pct: prefilledData?.fat_pct || 0,
    msnf_pct: prefilledData?.msnf_pct || 0,
    other_solids_pct: prefilledData?.other_solids_pct || 0,
    sp_coeff: prefilledData?.sp_coeff,
    pac_coeff: prefilledData?.pac_coeff,
    cost_per_kg: prefilledData?.cost_per_kg,
    notes: prefilledData?.notes || [] as string[],
    tags: prefilledData?.tags || [] as string[]
  });

  // Update form when prefilledData changes
  useEffect(() => {
    if (prefilledData) {
      setFormData({
        name: prefilledData.name || '',
        category: (prefilledData.category || 'other') as IngredientData['category'],
        water_pct: prefilledData.water_pct || 0,
        sugars_pct: prefilledData.sugars_pct || 0,
        fat_pct: prefilledData.fat_pct || 0,
        msnf_pct: prefilledData.msnf_pct || 0,
        other_solids_pct: prefilledData.other_solids_pct || 0,
        sp_coeff: prefilledData.sp_coeff,
        pac_coeff: prefilledData.pac_coeff,
        cost_per_kg: prefilledData.cost_per_kg,
        notes: prefilledData.notes || [],
        tags: prefilledData.tags || []
      });
    }
  }, [prefilledData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate that composition adds up to ~100%
    const total = formData.water_pct + formData.sugars_pct + formData.fat_pct + 
                  formData.msnf_pct + formData.other_solids_pct;
    
    if (Math.abs(total - 100) > 5) {
      toast({
        title: "Composition Error",
        description: `Total composition is ${total.toFixed(1)}%. It should be close to 100%.`,
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const newIngredient = await IngredientService.addIngredient(formData);
      
      toast({
        title: "Success",
        description: `${formData.name} has been added to the database.`
      });
      
      // Refresh global ingredients list
      await refetch();
      
      if (onIngredientAdded) {
        onIngredientAdded(newIngredient);
      }
      
      // Force a small delay to ensure the dialog closes smoothly
      setTimeout(() => {
        // Reset form
        setFormData({
          name: '',
          category: 'other',
          water_pct: 0,
          sugars_pct: 0,
          fat_pct: 0,
          msnf_pct: 0,
          other_solids_pct: 0,
          sp_coeff: undefined,
          pac_coeff: undefined,
          cost_per_kg: undefined,
          notes: [],
          tags: []
        });
      }, 100);
      
      handleOpenChange(false);
    } catch (error) {
      console.error('Error adding ingredient:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add ingredient",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const totalComposition = formData.water_pct + formData.sugars_pct + formData.fat_pct + 
                           formData.msnf_pct + formData.other_solids_pct;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add New Ingredient
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-background border shadow-lg">
        <DialogHeader>
          <DialogTitle>Add New Ingredient</DialogTitle>
          <DialogDescription>
            Create a new ingredient with its composition data. All percentages should add up to 100%.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="name">Ingredient Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Whole Milk"
                required
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="category">Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value as IngredientData['category'] })}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dairy">Dairy</SelectItem>
                  <SelectItem value="sugar">Sugar</SelectItem>
                  <SelectItem value="stabilizer">Stabilizer</SelectItem>
                  <SelectItem value="fruit">Fruit</SelectItem>
                  <SelectItem value="flavor">Flavor</SelectItem>
                  <SelectItem value="fat">Fat</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="water">Water %</Label>
              <Input
                id="water"
                type="number"
                step="0.01"
                value={formData.water_pct}
                onChange={(e) => setFormData({ ...formData, water_pct: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div>
              <Label htmlFor="sugars">Sugars %</Label>
              <Input
                id="sugars"
                type="number"
                step="0.01"
                value={formData.sugars_pct}
                onChange={(e) => setFormData({ ...formData, sugars_pct: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div>
              <Label htmlFor="fat">Fat %</Label>
              <Input
                id="fat"
                type="number"
                step="0.01"
                value={formData.fat_pct}
                onChange={(e) => setFormData({ ...formData, fat_pct: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div>
              <Label htmlFor="msnf">MSNF %</Label>
              <Input
                id="msnf"
                type="number"
                step="0.01"
                value={formData.msnf_pct}
                onChange={(e) => setFormData({ ...formData, msnf_pct: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="other_solids">Other Solids %</Label>
              <Input
                id="other_solids"
                type="number"
                step="0.01"
                value={formData.other_solids_pct}
                onChange={(e) => setFormData({ ...formData, other_solids_pct: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="col-span-2 p-3 bg-muted rounded-md">
              <p className="text-sm font-medium">
                Total Composition: {totalComposition.toFixed(2)}%
                {Math.abs(totalComposition - 100) > 5 && (
                  <span className="text-destructive ml-2">
                    (should be ~100%)
                  </span>
                )}
              </p>
            </div>

            <div>
              <Label htmlFor="sp_coeff">SP Coefficient (optional)</Label>
              <Input
                id="sp_coeff"
                type="number"
                step="0.01"
                placeholder="e.g., 1.0"
                value={formData.sp_coeff || ''}
                onChange={(e) => setFormData({ ...formData, sp_coeff: e.target.value ? parseFloat(e.target.value) : undefined })}
              />
            </div>

            <div>
              <Label htmlFor="pac_coeff">PAC Coefficient (optional)</Label>
              <Input
                id="pac_coeff"
                type="number"
                step="0.01"
                placeholder="e.g., 1.0"
                value={formData.pac_coeff || ''}
                onChange={(e) => setFormData({ ...formData, pac_coeff: e.target.value ? parseFloat(e.target.value) : undefined })}
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="cost">Cost per Kg (optional)</Label>
              <Input
                id="cost"
                type="number"
                step="0.01"
                placeholder="e.g., 250.00"
                value={formData.cost_per_kg || ''}
                onChange={(e) => setFormData({ ...formData, cost_per_kg: e.target.value ? parseFloat(e.target.value) : undefined })}
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="tags">Tags (comma-separated, optional)</Label>
              <Input
                id="tags"
                placeholder="e.g., organic, premium"
                onChange={(e) => setFormData({ ...formData, tags: e.target.value.split(',').map(t => t.trim()).filter(t => t) })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !formData.name || Math.abs(totalComposition - 100) > 5}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Ingredient
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
