/**
 * RecipeActions - Action buttons for recipe calculator
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Save, Calculator, Loader2, BookOpen, Bug, Zap } from 'lucide-react';

interface RecipeActionsProps {
  // Row actions
  onAddRow: () => void;
  onCalculate: () => void;
  onBalance: () => void;
  onApplySugarPreset: () => void;
  onSave: () => void;
  onClear: () => void;
  onShowTemplates: () => void;
  onToggleDebug: () => void;
  
  // State
  isOptimizing: boolean;
  isSaving: boolean;
  isAuthenticated: boolean;
  basicMode: boolean;
  showDebugPanel: boolean;
  hasRows: boolean;
}

export function RecipeActions({
  onAddRow,
  onCalculate,
  onBalance,
  onApplySugarPreset,
  onSave,
  onClear,
  onShowTemplates,
  onToggleDebug,
  isOptimizing,
  isSaving,
  isAuthenticated,
  basicMode,
  showDebugPanel,
  hasRows
}: RecipeActionsProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      <Button onClick={onAddRow} variant="outline" size="sm">
        <Plus className="mr-2 h-4 w-4" />
        Add Ingredient
      </Button>
      
      <Button onClick={onCalculate} variant="default" size="sm">
        <Calculator className="mr-2 h-4 w-4" />
        Calculate
      </Button>
      
      {/* Advanced features - hidden in basic mode */}
      {!basicMode && (
        <>
          <Button 
            onClick={onBalance} 
            disabled={isOptimizing || !hasRows}
            variant="secondary"
            size="sm"
          >
            {isOptimizing 
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
              : <Zap className="mr-2 h-4 w-4" />
            }
            Balance Recipe
          </Button>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                onClick={onApplySugarPreset}
                disabled={!hasRows}
                variant="outline"
                size="sm"
              >
                70/10/20 Preset
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Apply optimal sugar blend: 70% Sucrose, 10% Dextrose, 20% Glucose Syrup</p>
            </TooltipContent>
          </Tooltip>
        </>
      )}
      
      <div className="flex items-center gap-3">
        <Button 
          onClick={onSave} 
          disabled={isSaving || !isAuthenticated} 
          size="sm"
        >
          {isSaving 
            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
            : <Save className="mr-2 h-4 w-4" />
          }
          Save
        </Button>
      </div>
      
      <Button onClick={onClear} variant="ghost" size="sm">
        Clear
      </Button>
      
      {!hasRows && (
        <Button onClick={onShowTemplates} variant="outline" size="sm">
          <BookOpen className="mr-2 h-4 w-4" />
          Browse Templates
        </Button>
      )}
      
      <Button 
        variant="ghost" 
        size="sm"
        onClick={onToggleDebug}
      >
        <Bug className="mr-2 h-4 w-4" />
        {showDebugPanel ? 'Hide' : 'Show'} Debug
      </Button>
    </div>
  );
}
