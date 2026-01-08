/**
 * BalancingSuggestionsDialog - Shows balancing suggestions with apply actions
 * Enhanced with specific quantities and prominent Apply All button
 */

import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Check, Plus, Minus, Trash2, Wand2, ArrowRight, Sparkles } from 'lucide-react';
import type { BalancingSuggestion } from '@/types/calculator';

interface BalancingSuggestionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestions: BalancingSuggestion[];
  onApplySuggestion: (suggestion: BalancingSuggestion) => void;
  onApplyAll: () => void;
  currentMetrics?: {
    fat_pct: number;
    msnf_pct: number;
    totalSugars_pct: number;
  };
  targetMetrics?: {
    fat_pct: number;
    msnf_pct: number;
    totalSugars_pct: number;
  };
}

const ACTION_ICONS = {
  add: Plus,
  increase: Plus,
  decrease: Minus,
  remove: Trash2
};

const PRIORITY_COLORS = {
  1: 'destructive',
  2: 'secondary',
  3: 'outline'
} as const;

export function BalancingSuggestionsDialog({
  open,
  onOpenChange,
  suggestions,
  onApplySuggestion,
  onApplyAll,
  currentMetrics,
  targetMetrics
}: BalancingSuggestionsDialogProps) {
  if (suggestions.length === 0) return null;

  // Calculate total grams to add
  const totalGramsToAdd = suggestions.reduce((sum, s) => 
    s.action === 'add' || s.action === 'increase' ? sum + s.quantityChange : sum, 0
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Recipe Needs Adjustment
          </DialogTitle>
          <DialogDescription>
            Your recipe is out of balance. Apply these specific fixes:
          </DialogDescription>
        </DialogHeader>

        {/* Metrics Preview - Before/After */}
        {currentMetrics && targetMetrics && (
          <div className="bg-muted/50 rounded-lg p-3 mb-2">
            <div className="text-xs font-medium text-muted-foreground mb-2">Metrics Preview</div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center">
                <div className="text-muted-foreground">Fat</div>
                <div className="flex items-center justify-center gap-1">
                  <span className={currentMetrics.fat_pct < targetMetrics.fat_pct - 2 || currentMetrics.fat_pct > targetMetrics.fat_pct + 2 ? 'text-destructive font-medium' : ''}>
                    {currentMetrics.fat_pct.toFixed(1)}%
                  </span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="text-green-600 dark:text-green-400 font-medium">{targetMetrics.fat_pct.toFixed(1)}%</span>
                </div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground">MSNF</div>
                <div className="flex items-center justify-center gap-1">
                  <span className={currentMetrics.msnf_pct < targetMetrics.msnf_pct - 2 || currentMetrics.msnf_pct > targetMetrics.msnf_pct + 2 ? 'text-destructive font-medium' : ''}>
                    {currentMetrics.msnf_pct.toFixed(1)}%
                  </span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="text-green-600 dark:text-green-400 font-medium">{targetMetrics.msnf_pct.toFixed(1)}%</span>
                </div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground">Sugars</div>
                <div className="flex items-center justify-center gap-1">
                  <span className={currentMetrics.totalSugars_pct < targetMetrics.totalSugars_pct - 2 || currentMetrics.totalSugars_pct > targetMetrics.totalSugars_pct + 2 ? 'text-destructive font-medium' : ''}>
                    {currentMetrics.totalSugars_pct.toFixed(1)}%
                  </span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="text-green-600 dark:text-green-400 font-medium">{targetMetrics.totalSugars_pct.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Prominent Apply All Button at TOP */}
        <Button 
          onClick={onApplyAll}
          size="lg"
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
        >
          <Sparkles className="h-5 w-5 mr-2" />
          Apply All Fixes ({suggestions.length} changes, +{totalGramsToAdd.toFixed(0)}g)
        </Button>

        <div className="space-y-2 max-h-[300px] overflow-y-auto py-2">
          {suggestions.map((suggestion) => {
            const Icon = ACTION_ICONS[suggestion.action];
            return (
              <div 
                key={suggestion.id}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex-shrink-0">
                  <Badge variant={PRIORITY_COLORS[suggestion.priority as 1 | 2 | 3] || 'outline'} className="text-xs">
                    <Icon className="h-3 w-3 mr-1" />
                    {suggestion.action}
                  </Badge>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm flex items-center gap-2">
                    <span className="text-primary font-bold">
                      {suggestion.action === 'add' || suggestion.action === 'increase' 
                        ? `+${suggestion.quantityChange.toFixed(0)}g` 
                        : `-${suggestion.quantityChange.toFixed(0)}g`
                      }
                    </span>
                    <span>{suggestion.ingredientName}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {suggestion.reason}
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onApplySuggestion(suggestion)}
                  className="flex-shrink-0"
                >
                  <Check className="h-4 w-4 mr-1" />
                  Apply
                </Button>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 pt-2 border-t">
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button 
            variant="outline"
            onClick={onApplyAll}
            className="flex-1"
          >
            <Wand2 className="h-4 w-4 mr-2" />
            Apply All
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
