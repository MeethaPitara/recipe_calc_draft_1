import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TrendingUp, ArrowRight } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface RecipeRow {
  ingredientId: string;
  grams: number;
}

interface OptimizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalRows: RecipeRow[];
  optimizedRows: RecipeRow[];
  onApply: () => void;
  getIngredientName: (id: string) => string;
}

export const OptimizeDialog: React.FC<OptimizeDialogProps> = ({
  open,
  onOpenChange,
  originalRows,
  optimizedRows,
  onApply,
  getIngredientName,
}) => {
  // Build comparison data for all ingredients
  const comparison = optimizedRows.map((optRow, index) => {
    const origRow = originalRows[index];
    const diff = optRow.grams - origRow.grams;
    const percentChange = origRow.grams > 0 ? ((diff / origRow.grams) * 100) : 0;
    
    return {
      name: getIngredientName(optRow.ingredientId),
      original: origRow.grams,
      optimized: optRow.grams,
      diff,
      percentChange,
      hasChange: Math.abs(diff) > 0.01,
    };
  });

  const hasChanges = comparison.some(c => c.hasChange);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Recipe Optimization Preview
          </DialogTitle>
          <DialogDescription>
            Review the suggested changes before applying to your recipe
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!hasChanges ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No optimization changes needed - recipe is already balanced!
              </p>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ingredient</TableHead>
                    <TableHead className="text-right">Before</TableHead>
                    <TableHead className="w-12"></TableHead>
                    <TableHead className="text-right">After</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparison.map((item, index) => (
                    <TableRow 
                      key={index}
                      className={item.hasChange ? 'bg-muted/30' : ''}
                    >
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.original.toFixed(1)}g
                      </TableCell>
                      <TableCell className="text-center">
                        {item.hasChange && (
                          <ArrowRight className="h-4 w-4 text-muted-foreground mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        {item.optimized.toFixed(1)}g
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.hasChange ? (
                          <span className={item.diff > 0 ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}>
                            {item.diff > 0 ? '+' : ''}{item.diff.toFixed(1)}g
                            <span className="text-xs ml-1">
                              ({item.diff > 0 ? '+' : ''}{item.percentChange.toFixed(1)}%)
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={() => {
              onApply();
              onOpenChange(false);
            }}
            disabled={!hasChanges}
          >
            Apply Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
