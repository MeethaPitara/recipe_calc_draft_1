import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { apiPost, apiPut, apiGet, apiDelete } from '@/lib/apiClient';
import { authService } from '@/lib/auth/authService';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Save, Trash2, Calculator, Loader2, Search, Zap, BookOpen, Bug, History, HelpCircle, CheckCircle, AlertCircle, Wand2, Brain, Check, X, FileDown, GitCompare, Sparkles, MoreVertical, FilePlus, FolderOpen, Lock, Beaker } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SmartIngredientSearch } from '@/components/SmartIngredientSearch';
import { RecipeTemplates, resolveTemplateIngredients } from '@/components/RecipeTemplates';
import { AddIngredientDialog } from '@/components/AddIngredientDialog';
import { useIngredients } from '@/contexts/IngredientsContext';
import type { IngredientData } from '@/types/ingredients';
import { calcMetricsV2, MetricsV2 } from '@/lib/calcApi';
import { OptimizeTarget, Row } from '@/lib/optimize';
import { balancingEngine } from '@/lib/optimize.engine';
import { RecipeBalancerV2, ScienceValidation, PRODUCT_CONSTRAINTS } from '@/lib/optimize.balancer.v2';
import { diagnoseBalancingFailure, checkDbHealth } from '@/lib/ingredientMapper';
import { diagnoseFeasibility, Feasibility, applyAutoFix } from '@/lib/diagnostics';
import { ScienceValidationPanel } from '@/components/ScienceValidationPanel';
import { MetricsDisplayV2 } from '@/components/MetricsDisplayV2';
import type { Mode } from '@/types/mode';
import { resolveMode } from '@/lib/mode';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useIsMobile } from '@/hooks/use-mobile';
import PairingsDrawer from '@/components/PairingsDrawer';
import TemperaturePanel from '@/components/TemperaturePanel';
import ReverseEngineer from '@/components/ReverseEngineer';
import IngredientAnalyzer from '@/components/flavour-engine/IngredientAnalyzer';
import SugarBlendOptimizer from '@/components/flavour-engine/SugarBlendOptimizer';
import AIOptimization from '@/components/flavour-engine/AIOptimization';
import AiOptimizerDemo from '@/components/AiOptimizerDemo';
import AiRecipeCreator from '@/components/AiRecipeCreator';
import { getBalancingTargets } from '@/lib/productConstraints';
import { advancedOptimize, OptimizerConfig } from '@/lib/optimize.advanced';
import { Wrench } from 'lucide-react';
import { RecipeCompareDialog } from '@/components/RecipeCompareDialog';
import jsPDF from 'jspdf';
import { DatabaseHealthIndicator } from '@/components/DatabaseHealthIndicator';
import { BalancingDebugPanel } from '@/components/BalancingDebugPanel';
import { Checkbox } from '@/components/ui/checkbox';
import { AIInsightsPanel } from '@/components/AIInsightsPanel';
import { OptimizerPanel } from '@/components/calculator/OptimizerPanel';

// Debounce utility for input stability
// Debounce removed - using direct state updates for better input reliability

// Import types and use resolveProductKey from mode.ts
import { resolveProductKey } from '@/lib/mode';
import type { IngredientRow, BalancingSuggestion } from '@/types/calculator';
import { BalancingSuggestionsDialog } from '@/components/recipe/BalancingSuggestionsDialog';
import { TrialRecorder } from '@/components/recipe/TrialRecorder';

// Local productKey helper that uses the centralized resolver
import { getTargets } from './TargetPresets';
function productKey(mode: Mode, rows: IngredientRow[]): string {
  const hasFruit = rows.some(r => r.ingredientData?.category === 'fruit');
  return resolveProductKey(mode, hasFruit);
}

interface RecipeCalculatorV2Props {
  onRecipeChange?: (recipe: any[], metrics: MetricsV2 | null, productType: string) => void;
  externalRecipe?: { rows: IngredientRow[], name: string, type: string, id: string, isProductionLocked?: boolean, versionNumber?: number, tags?: string[] } | null;
  onOpenLibrary?: () => void;
  onOpenSave?: () => void;
  onNewRecipe?: () => void;
}

// PHASE 1: Simplified Quantity Input - Direct controlled input with no buffering
const QuantityInput = ({ value, onChange, step, rowIndex, className, id, disabled }: {
  value: number;
  onChange: (val: number) => void;
  step: number;
  rowIndex: number;
  className?: string;
  id?: string;
  disabled?: boolean;
}) => {
  // Local state to handle typing (allows "1." or empty string)
  const [localValue, setLocalValue] = useState<string>(value.toString());

  // Sync local state when prop changes externally (not from typing)
  useEffect(() => {
    // Only update if the numeric check differs, to avoid cursor jumping if possible
    // or if we aren't currently focused.
    const parsedLocal = parseFloat(localValue);
    if (parsedLocal !== value && !(isNaN(parsedLocal) && value === 0)) {
      setLocalValue(value === 0 && localValue === '' ? '' : value.toString());
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newVal = e.target.value;

    // Prevent preceding zeros (e.g. "05" becomes "5")
    if (newVal.length > 1 && newVal.startsWith('0') && newVal[1] !== '.') {
      newVal = newVal.replace(/^0+/, '');
    }

    setLocalValue(newVal);

    // Parse and send up if valid
    const parsed = parseFloat(newVal);
    if (!isNaN(parsed)) {
      onChange(parsed);
    } else if (newVal === '') {
      onChange(0);
    }
  };

  const handleBlur = () => {
    // On blur, format nicely
    const parsed = parseFloat(localValue);
    if (isNaN(parsed)) {
      setLocalValue("0");
      onChange(0);
    } else {
      setLocalValue(parsed.toString());
      onChange(parsed);
    }
  };

  return (
    <Input
      id={id}
      type="number"
      inputMode="decimal"
      step={step}
      disabled={disabled}
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prevInput = document.getElementById(`quantity-input-${rowIndex - 1}`);
          if (prevInput) prevInput.focus();
          else {
             // Fallback to stepping value if no previous row
             const current = parseFloat(localValue) || 0;
             const next = current + step;
             onChange(next);
             setLocalValue(next.toString());
          }
        } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
          e.preventDefault();
          const nextInput = document.getElementById(`quantity-input-${rowIndex + 1}`);
          if (nextInput) {
             nextInput.focus();
             if (e.key === 'Enter') {
                // Also trigger blur behavior implicitly if needed, handled by native blur
             }
          } else {
             // Fallback to stepping value if no next row, only for ArrowDown
             if (e.key === 'ArrowDown') {
                 const current = parseFloat(localValue) || 0;
                 const next = Math.max(0, current - step);
                 onChange(next);
                 setLocalValue(next.toString());
             }
          }
        }
      }}
      className={cn("text-lg font-semibold", className)}
    />
  );
};


export default function RecipeCalculatorV2({
  onRecipeChange,
  externalRecipe,
  onOpenLibrary,
  onOpenSave,
  onNewRecipe
}: RecipeCalculatorV2Props) {
  const { toast } = useToast();
  const [recipeName, setRecipeName] = useState('');
  const [productType, setProductType] = useState('ice_cream');
  const [rows, setRows] = useState<IngredientRow[]>([]);
  
  // History state for Undo/Redo
  const [pastHistory, setPastHistory] = useState<{name: string, type: string, rows: IngredientRow[]}[]>([]);
  const [futureHistory, setFutureHistory] = useState<{name: string, type: string, rows: IngredientRow[]}[]>([]);

  const [metrics, setMetrics] = useState<MetricsV2 | null>(null);
  const [targetBatchSize, setTargetBatchSize] = useState<number | null>(null);
  const [targetBatchSizeStr, setTargetBatchSizeStr] = useState<string | null>(null);
  const [servings, setServings] = useState<number>(10);
  const [servingsStr, setServingsStr] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [currentRecipeId, setCurrentRecipeId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [searchOpen, setSearchOpen] = useState<number | null>(null);
  const [scienceValidation, setScienceValidation] = useState<ScienceValidation[] | undefined>(undefined);
  const [qualityScore, setQualityScore] = useState<{ score: number; grade: 'A' | 'B' | 'C' | 'D' | 'F'; color: 'success' | 'warning' | 'destructive' } | undefined>(undefined);
  const [showTemplates, setShowTemplates] = useState(false);
  const [addIngredientIndex, setAddIngredientIndex] = useState<number | null>(null);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [balancingDiagnostics, setBalancingDiagnostics] = useState<any>(null);
  const [selectedIngredientForPairing, setSelectedIngredientForPairing] = useState<IngredientData | null>(null);
  const [showAdvancedToolsTutorial, setShowAdvancedToolsTutorial] = useState(() => {
    return !localStorage.getItem('advanced-tools-tutorial-seen');
  });
  const isMobile = useIsMobile();
  const [lastBalanceStrategy, setLastBalanceStrategy] = useState<'LP' | 'Heuristic' | 'Auto-Fix' | undefined>(undefined);
  const [showAddIngredientDialog, setShowAddIngredientDialog] = useState(false);
  const [balancingSuggestions, setBalancingSuggestions] = React.useState<BalancingSuggestion[]>([]);
  const [showSuggestionsDialog, setShowSuggestionsDialog] = React.useState(false);
  const [missingIngredient, setMissingIngredient] = React.useState<{
    name: string;
    id: string;
    suggestion: BalancingSuggestion;
  } | null>(null);
  const [prefilledIngredientData, setPrefilledIngredientData] = React.useState<any>(null);
  const [showCompareDialog, setShowCompareDialog] = React.useState(false);
  const [highlightedRow, setHighlightedRow] = React.useState<number | null>(null);
  const [showOptimizerPanel, setShowOptimizerPanel] = React.useState(false);
  const [showTemplatesDialog, setShowTemplatesDialog] = React.useState(false);
  const [showTrialRecorder, setShowTrialRecorder] = React.useState(false);


  // Helper function to load base sets
  const loadBaseSet = (baseType: 'ice_cream' | 'gelato' | 'sorbet') => {
    let baseIngredients: Array<{ name: string; quantity: number }> = [];

    if (baseType === 'ice_cream') {
      baseIngredients = [
        { name: 'Whole Milk', quantity: 0 },
        { name: 'Heavy Cream', quantity: 0 },
        { name: 'Sugar', quantity: 0 },
        { name: 'Skim Milk Powder', quantity: 0 },
        { name: 'Egg Yolk', quantity: 0 },
        { name: 'Stabilizer', quantity: 0 },
      ];
      setProductType('ice_cream');
    } else if (baseType === 'gelato') {
      baseIngredients = [
        { name: 'Whole Milk', quantity: 0 },
        { name: 'Heavy Cream', quantity: 0 },
        { name: 'Sugar', quantity: 0 },
        { name: 'Skim Milk Powder', quantity: 0 },
        { name: 'Stabilizer', quantity: 0 },
      ];
      setProductType('gelato');
    } else if (baseType === 'sorbet') {
      baseIngredients = [
        { name: 'Fruit Puree', quantity: 0 },
        { name: 'Sugar', quantity: 0 },
        { name: 'Water', quantity: 0 },
        { name: 'Stabilizer', quantity: 0 },
      ];
      setProductType('sorbet');
    }

    // Map to rows with ingredientData
    const newRows = baseIngredients.map(ing => {
      const foundIngredient = availableIngredients.find(
        avail => avail.name.toLowerCase() === ing.name.toLowerCase()
      );
      return {
        id: Math.random().toString(36).substr(2, 9),
        ingredient: ing.name,
        quantity_g: ing.quantity,
        ingredientData: foundIngredient,
        sugars_g: 0,
        fat_g: 0,
        msnf_g: 0,
        other_solids_g: 0,
        total_solids_g: 0,
      };
    });

    setRows(newRows);
    setRecipeName(`${baseType.replace('_', ' ')} Recipe`);
    toast({
      title: "Base set loaded",
      description: `${baseType.replace('_', ' ')} base ingredients loaded. Enter quantities and calculate.`,
    });
  };

  // Helper to render core metrics with dynamic targets
  const renderCoreMetric = (label: string, value: number, metricKeyOrRange: 'fat' | 'msnf' | 'sugar' | 'solids' | number[]) => {
    let targetValue: number;
    let min: number;
    let max: number;
    let tolerance: number;

    if (Array.isArray(metricKeyOrRange)) {
      min = metricKeyOrRange[0];
      max = metricKeyOrRange[1];
      targetValue = (min + max) / 2;
      tolerance = (max - min) / 2;
    } else {
      // Get active targets based on product type
      let pType = productType;
      // Map generic gelato back to specific if determinable
      if (productType === 'gelato') {
        const hasFruit = rows.some(r => r.ingredientData?.category === 'fruit');
        pType = hasFruit ? 'gelato_fruit' : 'gelato_white';
      }
      const targets = getTargets(pType);
      const range = targets[metricKeyOrRange] as [number, number];
      if (range) {
        min = range[0];
        max = range[1];
        targetValue = (min + max) / 2;
        tolerance = (max - min) / 2;
      } else {
        min = 0; max = 0; targetValue = 0; tolerance = 0;
      }
    }

    // Status Logic
    const delta = value - targetValue;
    const isPerfect = Math.abs(delta) < 0.1;
    const isGood = value >= min && value <= max;

    let statusColor = 'text-red-500';
    let bgColor = 'bg-red-500/10 border-red-500/20';
    let icon = null;

    if (isPerfect) {
      statusColor = 'text-green-600 dark:text-green-400';
      bgColor = 'bg-green-500/10 border-green-500/20';
      icon = <CheckCircle className="w-3 h-3 inline mr-1" />;
    } else if (isGood) {
      statusColor = 'text-emerald-600 dark:text-emerald-400';
      bgColor = 'bg-emerald-500/10 border-emerald-500/20';
    } else {
      // Keep Red
    }

    const deltaSign = delta > 0 ? '+' : '';
    const deltaStr = `${deltaSign}${delta.toFixed(1)}%`;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`border rounded-lg p-3 ${bgColor} cursor-help transition-all duration-200 hover:shadow-sm`}>
              <div className="flex justify-between items-center mb-1">
                <div className="text-xs text-muted-foreground">{label}</div>
                {icon}
              </div>
              <div className={`text-lg font-bold ${statusColor}`}>
                {value.toFixed(1)}%
              </div>
              <div className="flex justify-between items-center mt-1 text-xs text-muted-foreground">
                <span>Target: {targetValue}%</span>
                <span className={`${isGood ? 'text-muted-foreground' : 'text-red-500 font-medium'}`}>
                  {deltaStr}
                </span>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="font-semibold mb-1">{productType.replace('_', ' ').toUpperCase()} Standard:</p>
            <p className="text-sm">Target: {targetValue}% ±{tolerance}%</p>
            <p className="text-sm text-muted-foreground">Range: {min.toFixed(1)}% - {max.toFixed(1)}%</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };


  // Controlled tab state for consistent navigation
  const [activeTab, setActiveTab] = useState('analyzer');

  // Basic/Advanced mode toggle - simplified calculator view
  const [basicMode, setBasicMode] = useState(false);

  // Use global ingredients context
  const { ingredients: availableIngredients, isLoading: loadingIngredients, refetch: refetchIngredients } = useIngredients();

  // Helper to get constraints for current product type
  const getConstraints = () => {
    const mode = resolveMode(productType);
    const key = productKey(mode, rows);
    return PRODUCT_CONSTRAINTS[key] || PRODUCT_CONSTRAINTS.gelato_white;
  };

  useEffect(() => {
    const checkAuth = async () => {
      const user = await authService.getUser();
      setIsAuthenticated(!!user);
    };
    checkAuth();

    const { unsubscribe } = authService.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
      // Auto-refetch ingredients after authentication
      if (session && availableIngredients.length === 0) {
        console.log(" Refetching ingredients after auth...");
        refetchIngredients();
      }
    });

    return () => unsubscribe();
  }, [availableIngredients.length, refetchIngredients]);

  // Show Advanced Tools tutorial for first-time users
  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem('advanced-tools-tutorial-seen');
    if (!hasSeenTutorial && rows.length > 0) {
      // Delay showing tutorial slightly so user sees the section render first
      const timer = setTimeout(() => {
        setShowAdvancedToolsTutorial(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [rows.length]);

  // Debounced metrics calculation when rows change
  useEffect(() => {
    if (rows.length === 0) return;

    const timer = setTimeout(() => {
      const runCalc = async () => {
        // Silently calculate metrics without showing toast for auto-calculations
        const calcRows: Row[] = rows
          .filter(r => r.ingredientData && r.quantity_g > 0)
          .map(r => ({
            ing: r.ingredientData!,
            grams: r.quantity_g,
            min: 0,
            max: 1000
          }));

        if (calcRows.length > 0) {
          const mode = resolveMode(productType);
          const calculated = await calcMetricsV2(calcRows, { mode });
          setMetrics(calculated);
        } else {
          setMetrics(null);
        }
      };
      runCalc();
    }, 500);

    return () => clearTimeout(timer);
  }, [rows, productType]);

  // Notify parent component when recipe changes
  useEffect(() => {
    if (onRecipeChange) {
      const recipeData = rows.map(row => ({
        ingredient: row.ingredient,
        quantity_g: row.quantity_g,
        ingredientData: row.ingredientData
      }));
      onRecipeChange(recipeData, metrics, productType);
    }
  }, [rows, metrics, productType, onRecipeChange]);

  // History Helper: Push current state to past and clear future
  const saveHistoryState = (currentRows: IngredientRow[], name: string, type: string) => {
    setPastHistory(prev => [...prev, { name, type, rows: currentRows }].slice(-20)); // Keep last 20 states
    setFutureHistory([]);
  };

  // Wrapper for setRows to automatically save history
  const setRowsWithHistory = (newRowsOrUpdater: React.SetStateAction<IngredientRow[]>) => {
    setRows(prevRows => {
      const newRows = typeof newRowsOrUpdater === 'function' ? (newRowsOrUpdater as any)(prevRows) : newRowsOrUpdater;
      // Deep compare or just save on every change? We'll save on every update action.
      // But we must do it outside the render phase. Actually, we should call saveHistoryState in the handlers before calling setRows.
      return newRows;
    });
  };

  // Undo/Redo actions
  const handleUndo = () => {
    if (pastHistory.length === 0) return;
    const previous = pastHistory[pastHistory.length - 1];
    setFutureHistory(prev => [{ name: recipeName, type: productType, rows }, ...prev]);
    setPastHistory(prev => prev.slice(0, prev.length - 1));
    setRows(previous.rows);
    setRecipeName(previous.name);
    setProductType(previous.type);
    toast({ title: 'Undo', description: 'Reverted last change', duration: 1500 });
  };

  const handleRedo = () => {
    if (futureHistory.length === 0) return;
    const next = futureHistory[0];
    setPastHistory(prev => [...prev, { name: recipeName, type: productType, rows }]);
    setFutureHistory(prev => prev.slice(1));
    setRows(next.rows);
    setRecipeName(next.name);
    setProductType(next.type);
    toast({ title: 'Redo', description: 'Restored change', duration: 1500 });
  };

  // Keyboard Shortcuts for Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pastHistory, futureHistory, recipeName, productType, rows]);

  // Autosave to localStorage
  useEffect(() => {
    // Skip if external recipe is being loaded or if it's empty
    if (rows.length === 0 && !recipeName) return;
    
    // Don't autosave while loading external recipe (to prevent immediate overwrite)
    if (currentRecipeId && !currentRecipeId.startsWith('new-')) return;

    const timer = setTimeout(() => {
      const draft = {
        name: recipeName,
        type: productType,
        rows: rows,
        timestamp: new Date().getTime()
      };
      localStorage.setItem('meetha-draft-recipe', JSON.stringify(draft));
    }, 1000);
    return () => clearTimeout(timer);
  }, [rows, recipeName, productType, currentRecipeId]);

  // Load Autosave on initial mount
  useEffect(() => {
    if (!externalRecipe && rows.length === 0 && availableIngredients.length > 0) {
      const draftStr = localStorage.getItem('meetha-draft-recipe');
      if (draftStr) {
        try {
          const draft = JSON.parse(draftStr);
          // Only load if recent (e.g. less than 7 days old)
          if (new Date().getTime() - draft.timestamp < 7 * 24 * 60 * 60 * 1000) {
            
            // Re-hydrate ingredientData from availableIngredients
            const hydratedRows = draft.rows.map((row: any) => {
               const found = availableIngredients.find(i => i.id === row.ingredientData?.id || i.name === row.ingredient);
               return found ? { ...row, ingredientData: found } : row;
            });

            setRows(hydratedRows);
            setRecipeName(draft.name);
            setProductType(draft.type);
            setCurrentRecipeId('new-draft');
            toast({ title: 'Draft Recovered', description: 'Loaded your unsaved recipe draft.' });
          }
        } catch (e) {
          console.error('Failed to parse autosave draft', e);
        }
      }
    }
  }, [availableIngredients]); // Run once when ingredients load

  // Sync with external recipe (loaded from library)
  // Sync with external recipe (loaded from library)
  useEffect(() => {
    if (externalRecipe && availableIngredients.length > 0) {
      console.log(" Loading external recipe:", externalRecipe.name);

      const hydratedRows = externalRecipe.rows.map((row: any) => {
        // PHASE 5.4: a frozen ingredient_snapshot means this row was saved
        // after the snapshot fix shipped — trust it exactly as saved, never
        // re-resolve against today's (possibly drifted) live ingredient data.
        // Otherwise (older recipes saved before this column existed), fall
        // back to the old live-lookup-and-recompute behavior.
        if (row.ingredient_snapshot) {
          return {
            ...row,
            ingredientData: row.ingredient_snapshot,
          };
        }

        // Try to find by name match (case insensitive)
        const found = availableIngredients.find(i =>
          i.name.toLowerCase() === row.ingredient.toLowerCase() ||
          i.id === row.ingredient // Fallback if we stored ID
        );

        if (found) {
          const qty = row.quantity_g;
          // Recalculate based on current ingredient data to ensure accuracy
          return {
            ...row,
            ingredientData: found,
            ingredient: found.name, // Normalize name
            quantity_g: qty,
            sugars_g: ((found.sugars_pct ?? 0) / 100) * qty,
            fat_g: ((found.fat_pct ?? 0) / 100) * qty,
            msnf_g: ((found.msnf_pct ?? 0) / 100) * qty,
            other_solids_g: ((found.other_solids_pct ?? 0) / 100) * qty,
            total_solids_g: (((found.sugars_pct ?? 0) + (found.fat_pct ?? 0) + (found.msnf_pct ?? 0) + (found.other_solids_pct ?? 0)) / 100) * qty
          };
        }
        return row;
      });

      setRows(hydratedRows);
      setRecipeName(externalRecipe.name);
      setProductType(externalRecipe.type);
      setCurrentRecipeId(externalRecipe.id.startsWith('new-') ? null : externalRecipe.id);

      // Clear metrics and auxiliary state for new/loaded recipes
      setMetrics(null);
      setScienceValidation(undefined);
      setQualityScore(undefined);
      setBalancingDiagnostics(null);
      setLastBalanceStrategy(undefined);

      // Toast to confirm load
      if (!externalRecipe.id.startsWith('new-')) {
        toast({
          title: "Recipe Loaded",
          description: `Loaded "${externalRecipe.name}"`,
        });
      }
    }
  }, [externalRecipe, availableIngredients]);

  const FIXED_STEP_SIZE = 10; // Always ±10g

  // Calculated values
  const totalBatch = useMemo(() => {
    return rows.reduce((sum, r) => sum + r.quantity_g, 0);
  }, [rows]);

  const totalCost = useMemo(() => {
    return rows.reduce((sum, r) => {
      if (r.ingredientData?.cost_per_kg) {
        return sum + (r.quantity_g / 1000) * r.ingredientData.cost_per_kg;
      }
      return sum;
    }, 0);
  }, [rows]);

  const costPerServing = totalCost > 0 && servings > 0 ? totalCost / servings : 0;

  // Recipe scaling function
  const scaleRecipe = (newBatchSize: number) => {
    if (totalBatch === 0) {
      toast({
        title: "Cannot scale",
        description: "Add ingredients first before scaling",
        variant: "destructive"
      });
      return;
    }
    const scaleFactor = newBatchSize / totalBatch;
    setRows(rows.map(r => ({
      ...r,
      quantity_g: Math.round(r.quantity_g * scaleFactor * 100) / 100
    })));
    setTargetBatchSize(newBatchSize);
    toast({
      title: "Recipe Scaled",
      description: `Recipe scaled to ${newBatchSize}g (${scaleFactor.toFixed(2)}x)`
    });
  };

  // Get explanation for metric status
  const getMetricExplanation = (metric: string, value: number, target?: [number, number]) => {
    if (!target) return "";
    const [min, max] = target;
    if (value < min) {
      switch (metric) {
        case "Fat": return "Too low fat → Icy texture, lacks creaminess and richness";
        case "MSNF": return "Too low MSNF → Lacks body, may be too soft";
        case "Sugar": return "Too low sugar → Very hard when frozen, icy texture";
        case "Total Solids": return "Too low solids → Icy, weak body, poor texture";
        default: return "";
      }
    }
    if (value > max) {
      switch (metric) {
        case "Fat": return "Too high fat → Heavy mouthfeel, may coat palate";
        case "MSNF": return "Too high MSNF → Risk of chewiness, sandy texture from lactose";
        case "Sugar": return "Too high sugar → Too soft/slushy when frozen, overly sweet";
        case "Total Solids": return "Too high solids → Dense, hard to scoop, chewy";
        default: return "";
      }
    }
    return " Within optimal range for great texture and scoopability";
  };



  const addRow = () => {
    if (externalRecipe?.isProductionLocked) return;
    saveHistoryState(rows, recipeName, productType);
    setRows([...rows, {
      id: Math.random().toString(36).substring(7),
      ingredient: '',
      quantity_g: 0,
      sugars_g: 0,
      fat_g: 0,
      msnf_g: 0,
      other_solids_g: 0,
      total_solids_g: 0
    }]);
  };

  const removeRow = (index: number) => {
    if (externalRecipe?.isProductionLocked) return;
    saveHistoryState(rows, recipeName, productType);
    setRows(rows.filter((_, i) => i !== index));
  };

  const duplicateRow = (index: number) => {
    if (externalRecipe?.isProductionLocked) return;
    saveHistoryState(rows, recipeName, productType);
    const rowToDuplicate = rows[index];
    const newRow = {
      ...rowToDuplicate,
      id: Math.random().toString(36).substring(7)
    };
    const newRows = [...rows];
    newRows.splice(index + 1, 0, newRow);
    setRows(newRows);
    toast({ title: 'Row Duplicated', duration: 1500 });
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    
    // Parse rows separated by newline
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) return;

    let addedCount = 0;
    const newRows = [...rows];

    for (const line of lines) {
      // Split by tab or comma
      const parts = line.split(/\t|,/);
      if (parts.length >= 2) {
        const name = parts[0].trim();
        const gramsStr = parts[1].trim().replace(/[^0-9.]/g, ''); // Extract numbers
        const grams = parseFloat(gramsStr);

        if (name && !isNaN(grams)) {
          // Try to match with DB
          let matchedData = availableIngredients.find(
            ing => ing.name.toLowerCase() === name.toLowerCase()
          );

          if (!matchedData) {
            // Fuzzy match logic could go here, or just let it be unmatched
            // We'll create it without ingredientData to show the 'Not from DB' warning
          }

          const qty = grams;
          newRows.push({
            id: Math.random().toString(36).substring(7),
            ingredient: matchedData ? matchedData.name : name,
            ingredientData: matchedData,
            quantity_g: qty,
            sugars_g: matchedData ? ((matchedData.sugars_pct ?? 0) / 100) * qty : 0,
            fat_g: matchedData ? ((matchedData.fat_pct ?? 0) / 100) * qty : 0,
            msnf_g: matchedData ? ((matchedData.msnf_pct ?? 0) / 100) * qty : 0,
            other_solids_g: matchedData ? ((matchedData.other_solids_pct ?? 0) / 100) * qty : 0,
            total_solids_g: matchedData ? (((matchedData.sugars_pct ?? 0) + (matchedData.fat_pct ?? 0) + (matchedData.msnf_pct ?? 0) + (matchedData.other_solids_pct ?? 0)) / 100) * qty : 0
          });
          addedCount++;
        }
      }
    }

    if (addedCount > 0) {
      saveHistoryState(rows, recipeName, productType);
      setRows(newRows);
      toast({ title: 'Pasted successfully', description: `Added ${addedCount} ingredients` });
      e.preventDefault(); // Prevent default paste in input if triggered there
    }
  };

  const loadTemplate = (template: any) => {
    // Guard: Check if ingredient library is still loading
    if (loadingIngredients) {
      toast({
        title: 'Ingredient library loading',
        description: 'Please wait a few seconds and try again',
        variant: 'default'
      });
      return;
    }

    // Resolve template ingredients to actual ingredient data
    const resolvedIngredients = resolveTemplateIngredients(template, availableIngredients);

    if (resolvedIngredients.length === 0) {
      toast({
        title: 'Template Error',
        description: `Template "${template.name}" could not load any ingredients. Check your ingredient library and template tags.`,
        variant: 'destructive'
      });
      console.error('Template failed to load:', template.name, 'No ingredients resolved');
      return;
    }

    // Find ingredient data for each resolved ingredient
    const newRows: IngredientRow[] = resolvedIngredients
      .map(({ ingredientId, grams }) => {
        const ingredientData = availableIngredients.find(ing => ing.id === ingredientId);
        if (!ingredientData) {
          console.warn('Ingredient not found in library:', ingredientId);
          return null;
        }

        const qty = grams;
        return {
          ingredientData,
          ingredient: ingredientData.name,
          quantity_g: qty,
          sugars_g: (ingredientData.sugars_pct / 100) * qty,
          fat_g: (ingredientData.fat_pct / 100) * qty,
          msnf_g: (ingredientData.msnf_pct / 100) * qty,
          other_solids_g: (ingredientData.other_solids_pct / 100) * qty,
          total_solids_g: ((ingredientData.sugars_pct + ingredientData.fat_pct + ingredientData.msnf_pct + ingredientData.other_solids_pct) / 100) * qty
        };
      })
      .filter((row) => row !== null) as IngredientRow[];

    if (newRows.length === 0) {
      toast({
        title: 'Template Error',
        description: `Template "${template.name}" could not load. No ingredients found in the library.`,
        variant: 'destructive'
      });
      console.error('Template failed:', template.name, 'All ingredients missing from library');
      return;
    }

    // Check if some ingredients were skipped
    if (newRows.length < resolvedIngredients.length) {
      const skipped = resolvedIngredients.length - newRows.length;
      toast({
        title: 'Template Partially Loaded',
        description: `Loaded ${newRows.length} ingredients, ${skipped} ingredients were not found in the library.`,
        variant: 'default'
      });
    }

    setRows(newRows);
    setRecipeName(template.name);
    setProductType(template.mode === 'kulfi' ? 'kulfi' : 'gelato');
    setShowTemplates(false);

    // Only calculate metrics if we have rows
    if (newRows.length > 0) {
      setTimeout(() => calculateMetrics(), 100);

      if (newRows.length === resolvedIngredients.length) {
        toast({
          title: 'Template Loaded',
          description: `${template.name} loaded with ${newRows.length} ingredients`
        });
      }
    }
  };

  const handleStartFromScratch = () => {
    setShowTemplates(false);
  };

  const updateRow = (index: number, field: keyof IngredientRow, value: string | number | boolean) => {
    // Save history only for meaningful changes, maybe debounce? We'll just save it before setRows
    saveHistoryState(rows, recipeName, productType);
    setRows(prevRows => {
      const newRows = [...prevRows];

      // Validate numeric input
      let numericValue: any = value;
      if (typeof value === 'string' && field !== 'ingredient' && field !== 'id' && field !== 'lockMode') {
         numericValue = parseFloat(value);
      }
      if (typeof numericValue === 'number' && (isNaN(numericValue) || !isFinite(numericValue) || numericValue < 0)) {
        numericValue = 0;
      }

      const oldValue = newRows[index][field];
      newRows[index] = { ...newRows[index], [field]: numericValue };

      // Auto-calculate nutritional values when quantity changes
      if (field === 'quantity_g' && newRows[index].ingredientData) {
        const ing = newRows[index].ingredientData!;
        const qty = numericValue;

        console.log(` UpdateRow[${index}]: quantity_g changed`, {
          ingredient: ing.name,
          oldQty: oldValue,
          newQty: qty,
          hasIngredientData: !!ing
        });

        newRows[index].sugars_g = ((ing.sugars_pct ?? 0) / 100) * qty;
        newRows[index].fat_g = ((ing.fat_pct ?? 0) / 100) * qty;
        newRows[index].msnf_g = ((ing.msnf_pct ?? 0) / 100) * qty;
        newRows[index].other_solids_g = ((ing.other_solids_pct ?? 0) / 100) * qty;
        newRows[index].total_solids_g = newRows[index].sugars_g + newRows[index].fat_g + newRows[index].msnf_g + newRows[index].other_solids_g;
      } else if (field === 'quantity_g') {
        console.log(` UpdateRow[${index}]: quantity_g changed but no ingredientData`, {
          ingredient: newRows[index].ingredient,
          qty: numericValue
        });
      }

      return newRows;
    });
    // Metrics recalculation moved to debounced useEffect
  };

  const handleIngredientSelect = (index: number, ingredient: IngredientData) => {
    console.log(' handleIngredientSelect called:', { index, ingredientName: ingredient.name });

    saveHistoryState(rows, recipeName, productType);
    const newRows = [...rows];
    newRows[index].ingredient = ingredient.name;
    newRows[index].ingredientData = ingredient;

    // Check inventory stock before adding
    const qty = newRows[index].quantity_g || 0;
    if (qty > 0) {
      // Inventory check removed in Phase 2 cleanup
    }

    // Auto-calculate based on current quantity
    newRows[index].sugars_g = ((ingredient.sugars_pct ?? 0) / 100) * qty;
    newRows[index].fat_g = ((ingredient.fat_pct ?? 0) / 100) * qty;
    newRows[index].msnf_g = ((ingredient.msnf_pct ?? 0) / 100) * qty;
    newRows[index].other_solids_g = ((ingredient.other_solids_pct ?? 0) / 100) * qty;
    newRows[index].total_solids_g = newRows[index].sugars_g + newRows[index].fat_g + newRows[index].msnf_g + newRows[index].other_solids_g;

    setRows(newRows);
    setSearchOpen(null);

    // Visual feedback with highlight animation
    setHighlightedRow(index);
    setTimeout(() => setHighlightedRow(null), 2000);

    toast({
      title: ' Ingredient Updated',
      description: `${ingredient.name} selected for row ${index + 1}`,
      duration: 2000,
    });

    console.log(' Ingredient selected successfully:', ingredient.name);
  };

  // Export recipe as PDF
  const exportRecipePDF = () => {
    const doc = new jsPDF();

    // Title
    doc.setFontSize(18);
    doc.text(recipeName || 'Ice Cream Recipe', 20, 20);

    // Product type
    doc.setFontSize(12);
    doc.text(`Product Type: ${productType.replace('_', ' ')}`, 20, 30);

    // Batch info
    if (targetBatchSize || totalBatch > 0) {
      doc.text(`Batch Size: ${(targetBatchSize || totalBatch).toFixed(0)}g`, 20, 40);
    }
    if (totalCost > 0) {
      doc.text(`Total Cost: $${totalCost.toFixed(2)}`, 20, 50);
      doc.text(`Cost Per Serving: $${costPerServing.toFixed(2)}`, 20, 60);
    }

    // Ingredients table
    doc.setFontSize(14);
    doc.text('Ingredients:', 20, 75);
    doc.setFontSize(10);

    let yPos = 85;
    rows.forEach((row, index) => {
      if (row.ingredient && row.quantity_g > 0) {
        doc.text(`${index + 1}. ${row.ingredient}: ${row.quantity_g.toFixed(2)}g`, 25, yPos);
        yPos += 7;
      }
    });

    // Metrics
    if (metrics) {
      yPos += 10;
      doc.setFontSize(14);
      doc.text('Core Metrics:', 20, yPos);
      yPos += 10;
      doc.setFontSize(10);
      doc.text(`Fat: ${metrics.fat_pct.toFixed(1)}%`, 25, yPos);
      yPos += 7;
      doc.text(`MSNF: ${metrics.msnf_pct.toFixed(1)}%`, 25, yPos);
      yPos += 7;
      doc.text(`Sugar: ${metrics.totalSugars_pct.toFixed(1)}%`, 25, yPos);
      yPos += 7;
      doc.text(`Total Solids: ${metrics.ts_pct.toFixed(1)}%`, 25, yPos);
      yPos += 7;
      doc.text(`Water: ${(100 - metrics.ts_pct).toFixed(1)}%`, 25, yPos);

      // Advanced metrics
      if (metrics.fpdt !== undefined) {
        yPos += 7;
        doc.text(`FPD: ${metrics.fpdt.toFixed(2)}°C`, 25, yPos);
      }
    }

    // Save
    doc.save(`${recipeName || 'recipe'}.pdf`);

    toast({
      title: ' PDF Exported',
      description: 'Recipe has been downloaded as PDF',
    });
  };

  const calculateMetrics = async () => {
    console.log(' calculateMetrics called manually');
    const validRows = rows.filter(r => r.ingredientData && r.quantity_g > 0);

    if (validRows.length === 0) {
      toast({
        title: 'Empty Recipe',
        description: 'Add at least one valid ingredient to calculate metrics',
        variant: 'destructive',
      });
      return;
    }

    // Convert rows to format expected by calc.v2
    const calcRows = validRows.map(r => ({
      ing: r.ingredientData!,
      grams: r.quantity_g
    }));

    // Use the comprehensive v2.1 science engine with central mode resolver
    const mode = resolveMode(productType);
    const calculated = await calcMetricsV2(calcRows, { mode });

    setMetrics(calculated);

    console.log(' Metrics calculated', {
      fat_pct: calculated.fat_pct.toFixed(2),
      msnf_pct: calculated.msnf_pct.toFixed(2),
      warnings: calculated.warnings.length
    });

    // Show warnings if any
    if (calculated.warnings.length > 0) {
      toast({
        title: 'Recipe Calculated',
        description: `${calculated.warnings.length} warnings detected`,
      });
    } else {
      toast({
        title: 'Recipe Balanced ',
        description: 'All parameters within target ranges'
      });
    }
  };

  const balanceRecipe = async () => {
    console.log(' balanceRecipe called');
    console.log(`  Rows: ${rows.length}`);
    console.log(`  Has metrics: ${!!metrics}`);
    console.log(`  Product type: ${productType}`);

    const validRows = rows.filter(r => r.ingredientData && r.quantity_g > 0);
    const rowsWithoutData = rows.filter(r => !r.ingredientData && r.ingredient).length;

    if (!metrics) {
      console.warn(' balanceRecipe blocked: no metrics. User must calculate first.');
      toast({
        title: "Calculate metrics first",
        description: "Click the Calculate button to update your mix metrics before balancing.",
        variant: "destructive",
      });
      return;
    }

    if (validRows.length === 0) {
      console.warn(' balanceRecipe blocked: no valid rows with ingredientData.');
      if (rowsWithoutData > 0) {
        toast({
          title: "No valid ingredients",
          description: "All ingredients must be selected from the database list (not manually typed). Click the ingredient cell and choose from the popup.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "No ingredients to balance",
          description: "Add ingredients from the database and enter quantities first.",
          variant: "destructive",
        });
      }
      return;
    }

    console.log(' Starting balancing process...', {
      rowCount: rows.length,
      productType,
      availableIngredientsCount: availableIngredients.length
    });

    setIsOptimizing(true);

    try {
      // Define target ranges based on product type using central resolver
      const mode = resolveMode(productType);

      const targets: OptimizeTarget = mode === 'gelato'
        ? {
          fat_pct: 7.5,           // Target 7.5% fat (6-10% range)
          msnf_pct: 10.5,         // Target 10.5% MSNF (9-12% range)
          totalSugars_pct: 19,    // Target 19% total sugars (18-22% range)
          ts_pct: 40.5,           // Target 40.5% total solids (37-46% range)
          fpdt: 3.0               // Target 3.0°C FPDT (2.5-3.5°C range)
        }
        : mode === 'ice_cream'
          ? {
            fat_pct: 13,            // Target 13% fat (10-16% range)
            msnf_pct: 11,           // Target 11% MSNF (9-14% range)
            totalSugars_pct: 17,    // Target 17% total sugars (14-20% range)
            ts_pct: 39,             // Target 39% total solids (36-42% range)
            fpdt: 2.7               // Target 2.7°C FPDT (2.2-3.2°C range)
          }
          : mode === 'sorbet'
            ? {
              fat_pct: 0.5,           // Target 0.5% fat (0-1% range)
              msnf_pct: 0.5,          // Target 0.5% MSNF (0-1% range)
              totalSugars_pct: 28.5,  // Target 28.5% sugars (26-31% range)
              ts_pct: 37,             // Target 37% total solids (32-42% range)
              fpdt: -3.0              // Target -3.0°C FPDT (negative for sorbet)
            }
            : {
              fat_pct: 11,            // Target 11% fat (10-12% range)
              msnf_pct: 21.5,         // Target 21.5% MSNF (18-25% range)
              totalSugars_pct: 18,    // Target 18% sugars (17-20% range)
              ts_pct: 40,             // Target 40% total solids (38-42% range)
              fpdt: 2.25              // Target 2.25°C FPDT (2.0-2.5°C range)
            };

      console.log(' Balancing targets:', targets);

      // Diagnose BEFORE attempting balance
      const optRows: Row[] = rows
        .filter(r => r.ingredientData && r.quantity_g > 0)
        .map(r => ({
          ing: r.ingredientData!,
          grams: r.quantity_g,
          min: 0,
          max: 1000
        }));

      // Store diagnostics for debugging
      const diagnosis = diagnoseBalancingFailure(optRows, availableIngredients, targets);
      setBalancingDiagnostics({
        targets,
        diagnosis,
        productType,
        mode,
        ingredientCount: optRows.length,
        hasWater: diagnosis.hasWater,
        hasFatSource: diagnosis.hasFatSource,
        hasMSNFSource: diagnosis.hasMSNFSource,
        missingIngredients: diagnosis.missingIngredients,
        suggestions: diagnosis.suggestions
      });

      // ============ GENTLE PREPASS (Auto-Fix BEFORE Feasibility) ============
      // Run auto-fix FIRST to add missing levers before feasibility check
      const prepassFeasibility: Feasibility = diagnoseFeasibility(optRows, availableIngredients, targets, mode);

      if (!prepassFeasibility.feasible && prepassFeasibility.missingCanonicals && prepassFeasibility.missingCanonicals.length > 0) {
        console.log(' Running gentle prepass auto-fix...');
        const prepassAutoFix = applyAutoFix(optRows, availableIngredients, mode, prepassFeasibility);

        if (prepassAutoFix.applied) {
          console.log(' Prepass auto-fix applied:', prepassAutoFix.addedIngredients);

          // Add prepass ingredients to optRows
          prepassAutoFix.addedIngredients.forEach(added => {
            const ing = availableIngredients.find(i => i.name === added.name);
            if (ing) {
              optRows.push({ ing, grams: added.grams, min: 0, max: 1000 });

              // Also add to UI rows for display
              const newRow: IngredientRow = {
                ingredientData: ing,
                ingredient: ing.name,
                quantity_g: added.grams,
                sugars_g: ((ing.sugars_pct ?? 0) / 100) * added.grams,
                fat_g: ((ing.fat_pct ?? 0) / 100) * added.grams,
                msnf_g: ((ing.msnf_pct ?? 0) / 100) * added.grams,
                other_solids_g: ((ing.other_solids_pct ?? 0) / 100) * added.grams,
                total_solids_g: 0
              };
              newRow.total_solids_g = newRow.sugars_g + newRow.fat_g + newRow.msnf_g + newRow.other_solids_g;
              rows.push(newRow);
            }
          });

          toast({
            title: ' Gentle Prepass Applied',
            description: (
              <ul className="text-xs space-y-1">
                {prepassAutoFix.addedIngredients.map((a, i) => (
                  <li key={i}>+ {a.grams.toFixed(1)}g {a.name} ({a.reason})</li>
                ))}
              </ul>
            ),
            duration: 3000
          });
        }
      }

      // ============ HARD FEASIBILITY GATE ============
      // Pre-flight check - must pass before attempting LP/heuristics
      const feasibility: Feasibility = diagnoseFeasibility(optRows, availableIngredients, targets, mode);

      if (!feasibility.feasible) {
        console.log(' Feasibility check FAILED:', feasibility.reason);

        // Try auto-fix before giving up
        const autoFix = applyAutoFix(optRows, availableIngredients, mode, feasibility);

        if (autoFix.applied) {
          console.log(' Auto-fix applied:', autoFix.addedIngredients);

          // Add auto-fixed ingredients to optRows
          autoFix.addedIngredients.forEach(added => {
            const ing = availableIngredients.find(i => i.name === added.name);
            if (ing) {
              optRows.push({ ing, grams: added.grams, min: 0, max: 1000 });

              // Also add to UI rows for display
              const newRow: IngredientRow = {
                ingredientData: ing,
                ingredient: ing.name,
                quantity_g: added.grams,
                sugars_g: ((ing.sugars_pct ?? 0) / 100) * added.grams,
                fat_g: ((ing.fat_pct ?? 0) / 100) * added.grams,
                msnf_g: ((ing.msnf_pct ?? 0) / 100) * added.grams,
                other_solids_g: ((ing.other_solids_pct ?? 0) / 100) * added.grams,
                total_solids_g: 0
              };
              newRow.total_solids_g = newRow.sugars_g + newRow.fat_g + newRow.msnf_g + newRow.other_solids_g;
              rows.push(newRow);
            }
          });

          toast({
            title: autoFix.message,
            description: (
              <ul className="text-xs space-y-1">
                {autoFix.addedIngredients.map((a, i) => (
                  <li key={i}>+ {a.grams.toFixed(1)}g {a.name} ({a.reason})</li>
                ))}
              </ul>
            ),
            duration: 5000
          });

          // Continue to balancing with fixed recipe...
          console.log(' Proceeding with auto-fixed recipe');
        } else {
          // Only stop if auto-fix couldn't help
          console.log(' Auto-fix could not help');
          setIsOptimizing(false);

          toast({
            title: " Cannot balance this recipe",
            description: (
              <div className="text-sm space-y-2">
                {feasibility.reason && (
                  <div className="text-xs font-medium text-destructive">
                    {feasibility.reason}
                  </div>
                )}
                <div className="text-xs font-semibold mb-1"> To fix this:</div>
                <ul className="text-xs space-y-1">
                  {feasibility.suggestions.slice(0, 4).map((s, i) => (
                    <li key={i} className="flex items-start gap-1">
                      <span className="text-primary">•</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ),
            variant: "destructive",
            duration: 8000
          });

          return; // HARD STOP - do not proceed
        }
      }

      console.log(' Feasibility check passed');

      console.log(' Recipe ingredients:', optRows.map(r => ({
        name: r.ing.name,
        grams: r.grams,
        fat_pct: r.ing.fat_pct,
        msnf_pct: r.ing.msnf_pct
      })));

      if (optRows.length === 0) {
        toast({
          title: 'Invalid ingredients',
          description: 'Please select valid ingredients from the database',
          variant: 'destructive'
        });
        setIsOptimizing(false);
        return;
      }

      // Use the new V2 balancing engine with multi-role classification and substitution rules
      console.log(' Calling RecipeBalancerV2.balance...');
      const calcMode = resolveMode(productType);
      const tolerance = calcMode === 'ice_cream' ? 3.0 : 2.0;

      console.log(' Balancing with:', {
        tolerance,
        calcMode,
        targets,
        ingredientCount: optRows.length,
        totalWeight: optRows.reduce((sum, r) => sum + r.grams, 0)
      });

      const result = await RecipeBalancerV2.balance(optRows, targets, availableIngredients, {
        maxIterations: 200, // Increased from 100
        tolerance,
        enableFeasibilityCheck: true,
        useLPSolver: true,
        productType: productType,
        enableScienceValidation: true,
        allowCoreDairy: true  // Allow adjusting milk/cream during balancing
      });

      console.log(' Balancing result:', {
        success: result.success,
        strategy: result.strategy,
        iterations: result.iterations,
        message: result.message
      });

      // PHASE 2: Enhanced error messages with actionable structured suggestions
      if (!result.success) {
        console.log(' Balancing failed, generating suggestions...');
        const currentMetrics = await calcMetricsV2(optRows, { mode: calcMode });
        const structuredSuggestions: BalancingSuggestion[] = [];

        // Calculate ACTUAL gaps between current and target
        const fatGap = targets.fat_pct - currentMetrics.fat_pct;
        const msnfGap = targets.msnf_pct - currentMetrics.msnf_pct;
        const sugarGap = targets.totalSugars_pct - currentMetrics.totalSugars_pct;

        console.log(' Gaps:', { fatGap, msnfGap, sugarGap });

        // Generate actionable suggestions with ingredient IDs
        if (Math.abs(fatGap) > 2) {
          if (fatGap > 0) {
            const amountNeeded = Math.abs(fatGap * 15);
            structuredSuggestions.push({
              id: 'fat-increase',
              action: 'add',
              ingredientName: 'Heavy Cream 35%',
              ingredientId: 'cream_35', // Canonical ID from database
              quantityChange: amountNeeded,
              reason: `to increase fat by ${fatGap.toFixed(1)}%`,
              priority: 1
            });
          } else {
            const amountNeeded = Math.abs(fatGap * 20);
            structuredSuggestions.push({
              id: 'fat-decrease',
              action: 'add',
              ingredientName: 'Water',
              ingredientId: 'water',
              quantityChange: amountNeeded,
              reason: `to dilute fat by ${Math.abs(fatGap).toFixed(1)}%`,
              priority: 2
            });
          }
        }

        if (Math.abs(msnfGap) > 2) {
          if (msnfGap > 0) {
            const amountNeeded = Math.abs(msnfGap * 15);
            structuredSuggestions.push({
              id: 'msnf-increase',
              action: 'add',
              ingredientName: 'Skim Milk Powder (SMP)',
              ingredientId: 'smp',
              quantityChange: amountNeeded,
              reason: `to increase MSNF by ${msnfGap.toFixed(1)}%`,
              priority: 1
            });
          }
        }

        if (Math.abs(sugarGap) > 2) {
          if (sugarGap > 0) {
            const amountNeeded = Math.abs(sugarGap * 15);
            structuredSuggestions.push({
              id: 'sugar-increase',
              action: 'add',
              ingredientName: 'Sucrose',
              ingredientId: 'sucrose',
              quantityChange: amountNeeded,
              reason: `to increase sugars by ${sugarGap.toFixed(1)}%`,
              priority: 2
            });
          }
        }

        console.log(' Generated suggestions:', structuredSuggestions);

        // Show structured suggestions dialog instead of toast
        showBalancingSuggestionsDialog(structuredSuggestions, currentMetrics, targets);
        setIsOptimizing(false);
        return;
      }

      // Success - show original toast logic
      if (result.success) {
        toast({
          title: ' Recipe Balanced',
          description: `Successfully balanced using ${result.strategy}`,
          duration: 15000
        });
        setIsOptimizing(false);
        return;
      }

      // Store validation results
      setScienceValidation(result.scienceValidation);
      setQualityScore(result.qualityScore);

      // Update rows with optimized quantities
      const newRows = rows.map((row, i) => {
        if (i < result.rows.length) {
          const opt = result.rows[i];
          const ing = row.ingredientData!;
          const qty = opt.grams;
          return {
            ...row,
            quantity_g: qty,
            sugars_g: ((ing.sugars_pct ?? 0) / 100) * qty,
            fat_g: ((ing.fat_pct ?? 0) / 100) * qty,
            msnf_g: ((ing.msnf_pct ?? 0) / 100) * qty,
            other_solids_g: ((ing.other_solids_pct ?? 0) / 100) * qty,
            total_solids_g: (((ing.sugars_pct ?? 0) + (ing.fat_pct ?? 0) + (ing.msnf_pct ?? 0) + (ing.other_solids_pct ?? 0)) / 100) * qty
          };
        }
        return row;
      });

      setRows(newRows);

      // ============ POST-BALANCE AUTO-RECALC ============
      // Immediately recalculate metrics with new balanced amounts
      if (result.success) {
        const recalcRows = result.rows
          .filter(r => r.ing && r.grams > 0)
          .map(r => ({ ing: r.ing, grams: r.grams }));

        const recalcMode = resolveMode(productType);
        const recalculatedMetrics = await calcMetricsV2(recalcRows, { mode: recalcMode });

        setMetrics(recalculatedMetrics);
        console.log(' Metrics auto-recalculated post-balance:', recalculatedMetrics);

        // PHASE 2: Scroll metrics into view with highlight animation
        setTimeout(() => {
          const metricsCard = document.querySelector('[data-metrics-card]') as HTMLElement;
          if (metricsCard) {
            metricsCard.scrollIntoView({
              behavior: 'smooth',
              block: 'nearest'
            });

            // Add brief highlight animation
            metricsCard.style.outline = '3px solid hsl(var(--primary))';
            metricsCard.style.outlineOffset = '4px';
            metricsCard.style.transition = 'outline 0.3s ease';
            setTimeout(() => {
              metricsCard.style.outline = 'none';
            }, 2000);
          }
        }, 100);

        // Store strategy for debug panel
        setLastBalanceStrategy(result.strategy as 'LP' | 'Heuristic');
      }

      // Show detailed results
      setTimeout(() => {
        if (!result.success) {
          calculateMetrics(); // Only recalc if balance failed
        }

        if (result.success) {
          const successMsg = mode === 'sorbet'
            ? ' Sorbet Balanced (no dairy)'
            : ` ${mode === 'ice_cream' ? 'Ice Cream' : mode === 'gelato' ? 'Gelato' : 'Kulfi'} Balanced`;

          toast({
            title: `${successMsg} (${result.strategy})`,
            description: (
              <div className="space-y-1 text-sm">
                <div className="text-xs">{result.message}</div>
                {result.adjustmentsSummary.slice(0, 3).map((adj, i) => (
                  <div key={i} className="text-xs opacity-80">{adj}</div>
                ))}
                {result.adjustmentsSummary.length > 3 && (
                  <div className="text-xs opacity-60">+ {result.adjustmentsSummary.length - 3} more adjustments</div>
                )}
                <div className="text-xs opacity-70 mt-1">
                 Iterations: {result.iterations}
                </div>
              </div>
            )
          });
        } else {
          const feasibility = result.feasibilityReport;
          const suggestions = result.adjustmentsSummary || [];

          toast({
            title: ` ${result.message}`,
            description: (
              <div className="space-y-2 text-sm">
                {feasibility?.reason && (
                  <div className="text-xs font-medium text-destructive">{feasibility.reason}</div>
                )}

                {suggestions.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs font-semibold mb-1"> To fix this:</div>
                    <ul className="text-xs space-y-1">
                      {suggestions.slice(0, 4).map((sug, i) => (
                        <li key={i} className="flex items-start gap-1">
                          <span className="text-primary">•</span>
                          <span>{sug}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {feasibility?.suggestions && feasibility.suggestions.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/50">
                    <div className="text-xs font-medium opacity-80">Alternative suggestions:</div>
                    <ul className="text-xs list-disc list-inside mt-1 opacity-70">
                      {feasibility.suggestions.slice(0, 2).map((sug, i) => (
                        <li key={i}>{sug}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ),
            variant: 'destructive',
            duration: 8000
          });
        }
      }, 100);
    } catch (error: any) {
      console.error(' Balancing error:', error);
      console.error('Error stack:', error?.stack);
      toast({
        title: 'Optimization failed',
        description: error.message || 'An unknown error occurred. Check console for details.',
        variant: 'destructive'
      });
    } finally {
      setIsOptimizing(false);
    }
  };

  // PHASE 2: Actionable suggestions system
  const showBalancingSuggestionsDialog = (
    suggestions: BalancingSuggestion[],
    currentMetrics: any,
    targets: any
  ) => {
    setBalancingSuggestions(suggestions);
    setShowSuggestionsDialog(true);
  };

  // PHASE 2: Apply a single suggestion - with auto-create missing ingredients
  const applySuggestion = async (suggestion: BalancingSuggestion) => {
    console.log(` Applying suggestion: ${suggestion.ingredientName} (${suggestion.ingredientId})`);

    // Enhanced ingredient matching with canonical aliases
    const aliases: Record<string, string[]> = {
      'cream_35': ['heavy cream', 'heavy cream 35', 'cream 35', 'double cream', 'whipping cream'],
      'smp': ['skim milk powder', 'skimmed milk powder', 'nonfat milk powder', 'smp', 'dried skim milk'],
      'water': ['water', 'filtered water', 'drinking water', 'purified water'],
      'sucrose': ['sucrose', 'white sugar', 'cane sugar', 'table sugar', 'granulated sugar'],
      'butter': ['butter', 'unsalted butter', 'salted butter', 'sweet cream butter'],
      'milk': ['whole milk', 'milk', 'fresh milk', 'cow milk'],
      'dextrose': ['dextrose', 'glucose', 'corn sugar', 'grape sugar']
    };

    const ingredient = availableIngredients.find(ing => {
      console.log(`  Checking: ${ing.name}`);

      // Exact match
      if (ing.name.toLowerCase() === suggestion.ingredientName.toLowerCase()) {
        console.log('   Exact match');
        return true;
      }

      // Check against all aliases
      const searchTerms = aliases[suggestion.ingredientId] || [];
      const matched = searchTerms.some(term =>
        ing.name.toLowerCase().includes(term.toLowerCase())
      );

      if (matched) console.log('   Alias match');
      return matched;
    });

    if (!ingredient) {
      console.log('   Ingredient not found in database');

      // Default compositions for common ingredients
      const defaultCompositions: Record<string, any> = {
        'cream_35': { name: 'Heavy Cream 35%', fat_pct: 35, msnf_pct: 5.5, water_pct: 58, category: 'dairy', hardening_factor: 1.0 },
        'smp': { name: 'Skim Milk Powder', fat_pct: 1, msnf_pct: 95, water_pct: 4, category: 'dairy', hardening_factor: 1.0 },
        'water': { name: 'Water', water_pct: 100, category: 'other', hardening_factor: 0 },
        'sucrose': { name: 'Sucrose', sugars_pct: 100, category: 'sugar', hardening_factor: 1.0 },
        'butter': { name: 'Butter', fat_pct: 82, msnf_pct: 2, water_pct: 15.5, category: 'dairy', hardening_factor: 1.0 },
        'dextrose': { name: 'Dextrose', sugars_pct: 100, category: 'sugar', hardening_factor: 1.0 }
      };

      const defaults = defaultCompositions[suggestion.ingredientId];

      if (defaults) {
        console.log('   Auto-creating ingredient with defaults:', defaults);

        // Auto-create ingredient in database
        try {
          const newIng = await apiPost('/api/ingredients', defaults);

          if (!newIng) {
            throw new Error('Failed to create ingredient');
          }

          toast({
            title: 'Ingredient Added',
            description: `${newIng.name} has been added to the database.`,
          });

          console.log('   Ingredient auto-created:', newIng);

          // Refresh ingredients list
          await refetchIngredients();

          // Re-apply suggestion with newly created ingredient - add small delay
          setTimeout(() => applySuggestion(suggestion), 500);
          return;

        } catch (error: any) {
          console.error('   Failed to auto-create:', error);
          toast({
            title: ' Failed to add ingredient',
            description: error?.message || 'Please add it manually from the ingredient database',
            variant: 'destructive'
          });
          return;
        }
      }

      // Fallback: show manual add dialog
      toast({
        title: ' Ingredient Not Found',
        description: `"${suggestion.ingredientName}" is not in your database. Please add it manually.`,
        variant: 'destructive',
        duration: 6000
      });
      setShowAddIngredientDialog(true);
      return;
    }

    // Check if ingredient already exists in recipe
    const existingRowIndex = rows.findIndex(r => r.ingredientData?.id === ingredient.id);

    if (existingRowIndex >= 0) {
      // Increase existing quantity
      const currentQty = rows[existingRowIndex].quantity_g;
      const newQty = currentQty + suggestion.quantityChange;
      updateRow(existingRowIndex, 'quantity_g', newQty);

      toast({
        title: ' Suggestion Applied',
        description: `Increased ${ingredient.name} from ${currentQty.toFixed(0)}g to ${newQty.toFixed(0)}g`,
        duration: 3000
      });
    } else {
      // Add new row with ingredient
      const qty = suggestion.quantityChange;
      const newRow: IngredientRow = {
        ingredient: ingredient.name,
        quantity_g: qty,
        sugars_g: ((ingredient.sugars_pct ?? 0) / 100) * qty,
        fat_g: ((ingredient.fat_pct ?? 0) / 100) * qty,
        msnf_g: ((ingredient.msnf_pct ?? 0) / 100) * qty,
        other_solids_g: ((ingredient.other_solids_pct ?? 0) / 100) * qty,
        total_solids_g: (((ingredient.sugars_pct ?? 0) + (ingredient.fat_pct ?? 0) + (ingredient.msnf_pct ?? 0) + (ingredient.other_solids_pct ?? 0)) / 100) * qty,
        ingredientData: ingredient
      };

      setRows(prev => [...prev, newRow]);

      toast({
        title: ' Suggestion Applied',
        description: `Added ${qty.toFixed(0)}g ${ingredient.name} to recipe`,
        duration: 3000
      });
    }

    // Remove this suggestion from the list
    setBalancingSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
  };

  // PHASE 2: Apply ALL suggestions at once - with auto re-balance
  const applyAllSuggestions = async () => {
    for (const suggestion of balancingSuggestions) {
      await applySuggestion(suggestion);
    }
    setShowSuggestionsDialog(false);

    toast({
      title: ' All Suggestions Applied',
      description: 'Re-balancing recipe automatically...',
      duration: 3000
    });

    // Auto-trigger balancing after applying suggestions
    setTimeout(() => {
      balanceRecipe();
    }, 1000);
  };

  const handleIngredientAdded = (newIngredient: IngredientData) => {
    // If this was added from a missing ingredient suggestion, apply it
    if (missingIngredient) {
      const qty = missingIngredient.suggestion.quantityChange;
      const newRow: IngredientRow = {
        ingredient: newIngredient.name,
        quantity_g: qty,
        sugars_g: ((newIngredient.sugars_pct ?? 0) / 100) * qty,
        fat_g: ((newIngredient.fat_pct ?? 0) / 100) * qty,
        msnf_g: ((newIngredient.msnf_pct ?? 0) / 100) * qty,
        other_solids_g: ((newIngredient.other_solids_pct ?? 0) / 100) * qty,
        total_solids_g: (((newIngredient.sugars_pct ?? 0) + (newIngredient.fat_pct ?? 0) + (newIngredient.msnf_pct ?? 0) + (newIngredient.other_solids_pct ?? 0)) / 100) * qty,
        ingredientData: newIngredient
      };

      setRows(prev => [...prev, newRow]);

      // Remove the suggestion
      setBalancingSuggestions(prev => prev.filter(s => s.id !== missingIngredient.suggestion.id));

      toast({
        title: ' Ingredient Added',
        description: `Added ${qty.toFixed(0)}g ${newIngredient.name} to recipe`,
        duration: 3000
      });

      setMissingIngredient(null);
      setPrefilledIngredientData(null);
    }
  };

  const saveRecipe = async () => {
    if (!recipeName.trim()) {
      toast({
        title: 'Recipe name required',
        description: 'Please enter a recipe name',
        variant: 'destructive'
      });
      return;
    }

    if (rows.length === 0 || rows.filter(r => r.quantity_g > 0).length === 0) {
      toast({
        title: 'No ingredients',
        description: 'Add at least one ingredient with quantity before saving',
        variant: 'destructive'
      });
      return;
    }

    // Validate minimum ingredients
    const validRows = rows.filter(r => r.ingredientData && r.quantity_g > 0);
    if (validRows.length < 3) {
      toast({
        title: 'Not enough ingredients',
        description: 'Add at least 3 ingredients to create a balanced recipe',
        variant: 'destructive'
      });
      return;
    }

    if (!isAuthenticated) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to save recipes',
        variant: 'destructive'
      });
      return;
    }

    setIsSaving(true);

    try {
      const user = await authService.getUser();
      if (!user) throw new Error('Not authenticated');

      // Calculate metrics if not already done
      if (!metrics) {
        calculateMetrics();
      }

      let recipeId = currentRecipeId?.startsWith('new-') ? null : currentRecipeId;

      const payload = {
        recipe_name: recipeName,
        product_type: productType,
        rows: rows,
        metrics: metrics
      };

      if (!recipeId) {
        // Create new recipe via API
        const result = await apiPost('/api/recipes', payload);
        recipeId = result.id;
        setCurrentRecipeId(recipeId);
      } else {
        // Update existing recipe via API
        await apiPut(`/api/recipes/${recipeId}`, payload);
      }

      toast({
        title: 'Recipe Saved ',
        description: 'Successfully saved to your library'
      });

      // Save version history after successful save
      if (recipeId) {
        // Version history and inventory deduction removed in Phase 2 cleanup
      }
    } catch (error: any) {
      toast({
        title: 'Save failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const clearRecipe = () => {
    saveHistoryState(rows, recipeName, productType);
    setRecipeName('');
    setProductType('ice_cream');
    setRows([]);
    setMetrics(null);
    setCurrentRecipeId(null);
  };

  const applyOptimizedRecipe = (optimizedRecipe: { [key: string]: number }) => {
    // Determine existing ingredients for update
    const updatedRows = rows.map(row => {
      const newQty = optimizedRecipe[row.ingredient];
      if (newQty !== undefined) {
        const ing = row.ingredientData;
        if (ing) {
          const grams = Number(newQty);
          const updatedRow: IngredientRow = {
            ...row,
            quantity_g: grams,
            sugars_g: ((ing.sugars_pct ?? 0) / 100) * grams,
            fat_g: ((ing.fat_pct ?? 0) / 100) * grams,
            msnf_g: ((ing.msnf_pct ?? 0) / 100) * grams,
            other_solids_g: ((ing.other_solids_pct ?? 0) / 100) * grams,
            total_solids_g: 0
          };
          updatedRow.total_solids_g = updatedRow.sugars_g + updatedRow.fat_g + updatedRow.msnf_g + updatedRow.other_solids_g;
          return updatedRow;
        }
      }
      return row;
    });

    // Check for any NEW ingredients the AI might have added
    const existingNames = new Set(rows.map(r => r.ingredient));
    const newIngredientsRows: IngredientRow[] = [];

   Object.entries(optimizedRecipe).forEach(([name, qty]) => {
      const grams = Number(qty);
      if (!existingNames.has(name) && grams > 0.1) {
        let ing = availableIngredients.find(i => i.name === name);
        if (!ing) {
          // Robust fallback for standard AI ingredients if they don't exactly match DB names
          ing = {
            id: name.toLowerCase().replace(/\s+/g, '_'),
            name: name,
            category: 'other' as const,
            water_pct: 0,
            fat_pct: 0,
            sugars_pct: 0,
          };

          if (name.includes('Sucrose') || name === 'Sugar') {
            ing.sugars_pct = 100;
          } else if (name.includes('Dextrose')) {
            ing.sugars_pct = 91;
            ing.water_pct = 9;
          } else if (name.includes('Glucose Syrup')) {
            ing.sugars_pct = 78;
            ing.water_pct = 22;
          }
        }

        if (ing) {
          const newRow: IngredientRow = {
            ingredientData: ing,
            ingredient: ing.name,
            quantity_g: grams,
            sugars_g: ((ing.sugars_pct ?? 0) / 100) * grams,
            fat_g: ((ing.fat_pct ?? 0) / 100) * grams,
            msnf_g: ((ing.msnf_pct ?? 0) / 100) * grams,
            other_solids_g: ((ing.other_solids_pct ?? 0) / 100) * grams,
            total_solids_g: 0
          };
          newRow.total_solids_g = newRow.sugars_g + newRow.fat_g + newRow.msnf_g + newRow.other_solids_g;
          newIngredientsRows.push(newRow);
        }
      }
    });

    saveHistoryState(rows, recipeName, productType);
    setRows([...updatedRows, ...newIngredientsRows]);
    toast({
      title: "Optimized Recipe Applied",
      description: "Proposed changes loaded into your calculator.",
    });
    // Recalculate metrics immediately
    setTimeout(() => calculateMetrics(), 100);
  };


  // Version history feature removed in Phase 2 cleanup

  return (
    <div className="space-y-6">
      <OptimizerPanel
        open={showOptimizerPanel}
        onOpenChange={setShowOptimizerPanel}
        rows={rows}
        productType={productType}
        onApplyChanges={(newRows) => {
          setRows(newRows);
          // Trigger metrics recalculation
          setTimeout(() => calculateMetrics(), 100);
        }}
      />
      <AddIngredientDialog
        open={addIngredientIndex !== null || showAddIngredientDialog}
        onOpenChange={(open) => {
          if (!open) {
            setAddIngredientIndex(null);
            setShowAddIngredientDialog(false);
            setMissingIngredient(null);
            setPrefilledIngredientData(null);
          }
        }}
        onIngredientAdded={(ing) => {
          if (addIngredientIndex !== null) {
            handleIngredientSelect(addIngredientIndex, ing);
            setAddIngredientIndex(null);
          } else {
            handleIngredientAdded(ing);
            setShowAddIngredientDialog(false);
          }
        }}
        hideTrigger={true}
      />


      <RecipeCompareDialog
        open={showCompareDialog}
        onOpenChange={setShowCompareDialog}
        currentRecipe={{
          name: recipeName,
          rows,
          metrics,
          productType
        }}
      />

      {/* Silenced as per UI cleanup request */}

      {/* Browse Templates Area replaced Quick Start with Base Sets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
           Browse Recipe Templates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-4 bg-muted/20 rounded-lg border border-dashed">
            <Button
              variant="default"
              size="lg"
              onClick={() => setShowTemplatesDialog(true)}
              className="gap-2 px-8 shadow-md"
            >
              <BookOpen className="h-5 w-5" />
             Browse Recipe Templates
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
             Start with a professional Gelato, Ice Cream, or Sorbet foundation
            </p>
          </div>

          <Dialog open={showTemplatesDialog} onOpenChange={setShowTemplatesDialog}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-background border shadow-xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-2xl">
                  <BookOpen className="h-6 w-6 text-primary" />
                 Recipe Library Templates
                </DialogTitle>
                <DialogDescription>
                 Select a template to instantly populate the calculator with a balanced foundation.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4">
                <RecipeTemplates
                  onSelectTemplate={(template) => {
                    loadTemplate(template);
                    setShowTemplatesDialog(false);
                  }}
                  onStartFromScratch={() => {
                    handleStartFromScratch();
                    setShowTemplatesDialog(false);
                  }}
                  availableIngredients={availableIngredients}
                />
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {externalRecipe?.isProductionLocked && (
        <Alert variant="default" className="bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-500 mb-6">
          <Lock className="h-4 w-4" />
          <AlertTitle className="font-bold">Production Locked</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>This recipe is locked to preserve production records. You cannot modify it.</span>
            <Button variant="outline" size="sm" onClick={async () => {
              if (!externalRecipe || externalRecipe.id.startsWith('new-')) return;
              try {
                const res = await apiPost(`/api/recipes/${externalRecipe.id}/clone`);
                toast({ 
                  title: 'Recipe Cloned Successfully', 
                  description: `Created new version: ${res.recipe.name}. Please open the library to load it.` 
                });
                if (onOpenLibrary) onOpenLibrary();
              } catch (err: any) {
                toast({ 
                  title: 'Failed to clone recipe', 
                  description: err.message, 
                  variant: 'destructive' 
                });
              }
            }} className="ml-4 border-amber-500 text-amber-600 hover:bg-amber-500/20">
             Clone to Edit
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
           Recipe Details
            <Badge variant="outline" className="ml-auto">
              {productType === 'ice_cream' ? ' Ice Cream' : productType === 'gelato' ? ' Gelato' : productType === 'sorbet' ? ' Sorbet' : ' Paste'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="recipe-name">Recipe Name</Label>
              <Input
                id="recipe-name"
                value={recipeName}
                onChange={(e) => setRecipeName(e.target.value)}
                placeholder="Enter recipe name"
                disabled={externalRecipe?.isProductionLocked}
              />
            </div>
            <div>
              <Label htmlFor="product-type">Product Type</Label>
              <Select value={productType} onValueChange={setProductType} disabled={externalRecipe?.isProductionLocked}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ice_cream"> Ice Cream</SelectItem>
                  <SelectItem value="gelato"> Gelato</SelectItem>
                  <SelectItem value="sorbet"> Sorbet</SelectItem>
                  <SelectItem value="paste"> Paste</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Basic/Advanced Mode Toggle Removed to force Advanced Mode */}
        </CardContent>
      </Card>

      {/* Consolidate All Science Metrics Above the Recipe */}
      {metrics && (
        <Card className="mb-6 border-primary/20 shadow-md">
          <CardHeader className="bg-muted/10 py-3 border-b flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Calculator className="h-4 w-4 text-primary" />
             Calculated Science Metrics (v2.1)
            </CardTitle>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total Batch</p>
                <p className="text-sm font-bold text-primary">{metrics.total_g.toFixed(1)}g</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {/* PHASE 5.3: aggregate accuracy banner — fires if any in-use
                ingredient's data isn't verified/lab_tested. */}
            {(() => {
              const unverifiedCount = rows.filter(r =>
                r.ingredientData && r.quantity_g > 0 &&
                r.ingredientData.verification_status &&
                r.ingredientData.verification_status !== 'verified' &&
                r.ingredientData.verification_status !== 'lab_tested'
              ).length;
              if (unverifiedCount === 0) return null;
              return (
                <Alert className="py-2 h-auto border-amber-300 bg-amber-50/40 dark:bg-amber-950/20">
                  <AlertCircle className="h-3 w-3 text-amber-600" />
                  <AlertDescription className="text-[11px] leading-tight text-amber-700 dark:text-amber-400">
                    {unverifiedCount} ingredient{unverifiedCount > 1 ? 's' : ''} in this recipe {unverifiedCount > 1 ? 'have' : 'has'} unverified composition data — treat these metrics as estimates until the data is lab-tested or supplier-confirmed.
                  </AlertDescription>
                </Alert>
              );
            })()}

            {/* Main Composition Grid (Gauges) */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {renderCoreMetric('Fat', metrics.fat_pct, 'fat')}
              {renderCoreMetric('MSNF', metrics.msnf_pct, 'msnf')}
              {renderCoreMetric('Sugars', metrics.totalSugars_pct, 'sugar')}
              {renderCoreMetric('Total Solids', metrics.ts_pct, 'solids')}
              <div className="border rounded-lg p-3 bg-muted/10">
                <div className="text-xs text-muted-foreground mb-1">Water Content</div>
                <div className="text-lg font-bold">{metrics.water_pct.toFixed(1)}%</div>
              </div>
            </div>

            {/* Performance & Chemical Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 py-2 border-t border-b bg-muted/5 rounded-md px-2">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Protein</span>
                <span className="text-sm font-semibold">{metrics.protein_pct.toFixed(1)}%</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Lactose</span>
                <span className="text-sm font-semibold">{metrics.lactose_pct.toFixed(1)}%</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">FPDT (Freezing)</span>
                <Badge variant={
                  metrics.fpdt >= getConstraints().fpdt.optimal[0] &&
                    metrics.fpdt <= getConstraints().fpdt.optimal[1]
                    ? 'default'
                    : 'secondary'
                } className="w-fit text-[10px] px-1 h-5">
                  {metrics.fpdt.toFixed(2)}°C
                </Badge>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">POD (Sweetness)</span>
                <span className="text-sm font-semibold">{metrics.pod_index.toFixed(0)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">SE (Sucrose Eq)</span>
                <span className="text-sm font-semibold">{metrics.se_g.toFixed(1)}g</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Overrun Est.</span>
                <span className="text-sm font-semibold">~{metrics.overrunPrediction?.estimatedPct.toFixed(0)}%</span>
              </div>
            </div>

            {/* Scientific Validation Alerts Embedded */}
            {(scienceValidation && scienceValidation.length > 0) || (metrics.warnings && metrics.warnings.length > 0) ? (
              <div className="space-y-2 mt-2">
                {metrics.warnings.map((warning, i) => (
                  <Alert key={i} className="py-2 h-auto border-dashed border-red-200 bg-red-50/30">
                    <AlertCircle className="h-3 w-3 text-red-500" />
                    <AlertDescription className="text-[11px] leading-tight text-red-700">
                      {warning}
                    </AlertDescription>
                  </Alert>
                ))}
                {scienceValidation && scienceValidation.length > 0 && (
                  <ScienceValidationPanel
                    validations={scienceValidation}
                    qualityScore={qualityScore}
                  />
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-green-600 bg-green-50/30 p-2 rounded-md border border-green-100/50">
                <CheckCircle className="h-4 w-4" />
                <span className="text-xs font-medium">Science Validated: All parameters within professional targets.</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Detailed metric diagnosis panel */}
      {metrics && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Metric Diagnosis</CardTitle>
          </CardHeader>
          <CardContent>
            <MetricsDisplayV2
              metrics={metrics}
              mode={resolveMode(productType as any) as any}
              productKey={productKey(resolveMode(productType as any), rows)}
            />
          </CardContent>
        </Card>
      )}

      {/* Recipe Scaling & Cost Section */}
      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Batch Size & Costing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                  <Label htmlFor="batch-size" className="text-sm whitespace-nowrap">Batch Size:</Label>
                  <Input
                    id="batch-size"
                    type="number"
                    value={targetBatchSizeStr !== null ? targetBatchSizeStr : (targetBatchSize || totalBatch || '')}
                    onChange={(e) => {
                      let strVal = e.target.value;
                      // Strip leading zeros
                      if (strVal.length > 1 && strVal.startsWith('0') && strVal[1] !== '.') {
                        strVal = strVal.replace(/^0+/, '');
                      }
                      setTargetBatchSizeStr(strVal);
                      const val = parseFloat(strVal);
                      if (!isNaN(val) && val > 0) scaleRecipe(val);
                    }}
                    onBlur={() => {
                      setTargetBatchSizeStr(null); // Reset to synced number on blur
                    }}
                    className="w-28"
                    placeholder="grams"
                    disabled={externalRecipe?.isProductionLocked}
                  />
                  <span className="text-sm text-muted-foreground">g</span>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="servings" className="text-sm whitespace-nowrap">Servings:</Label>
                  <Input
                    id="servings"
                    type="number"
                    value={servingsStr !== null ? servingsStr : (servings || '')}
                    onChange={(e) => {
                      let strVal = e.target.value;
                      if (strVal.length > 1 && strVal.startsWith('0')) {
                        strVal = strVal.replace(/^0+/, '');
                      }
                      setServingsStr(strVal);
                      const val = parseInt(strVal);
                      if (!isNaN(val)) setServings(val);
                    }}
                    onBlur={() => setServingsStr(null)}
                    className="w-20"
                    min="1"
                    disabled={externalRecipe?.isProductionLocked}
                  />
                </div>
              </div>
              {totalCost > 0 && (
                <div className="flex flex-col gap-1">
                  <div className="text-sm font-medium">
                   Total Cost: ${totalCost.toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                   Per Serving: ${costPerServing.toFixed(2)}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Ingredients</CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Recipe menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={onNewRecipe} className="gap-2 cursor-pointer">
                <FilePlus className="h-4 w-4" />
                <span>New Recipe</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenLibrary} className="gap-2 cursor-pointer">
                <FolderOpen className="h-4 w-4" />
                <span>Load Recipe</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenSave} className="gap-2 cursor-pointer">
                <Save className="h-4 w-4" />
                <span>{currentRecipeId ? "Update Recipe" : "Save Recipe"}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        <CardContent>
          {loadingIngredients && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-3 text-sm text-muted-foreground">Loading ingredients...</span>
            </div>
          )}
          <div className="space-y-4">
            {/* Template and Export Actions - Always accessible */}
            <div className="flex flex-wrap gap-2">
              {/* Toggle removed - moved to the top card */}

              {rows.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportRecipePDF}
                    className="gap-2"
                  >
                    <FileDown className="h-4 w-4" />
                   Export PDF
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCompareDialog(true)}
                    className="gap-2"
                  >
                    <GitCompare className="h-4 w-4" />
                   Compare Recipes
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setRows([]);
                      setRecipeName('');
                      setMetrics(null);
                      toast({
                        title: 'Recipe Cleared',
                        description: 'Starting fresh - add ingredients or load a template',
                      });
                    }}
                    className="gap-2"
                  >
                    <X className="h-4 w-4" />
                   Clear & Start Over
                  </Button>
                </>
              )}
            </div>

            {/* Quick Start Message - Only show when no ingredients */}
            {/* Quick start message removed */}

            {/* Tip for choosing ingredients from database */}
            {/* Silenced as per UI cleanup request */}

            {/* Redundant template area removed */}

            <div className="overflow-x-auto rounded-md border">
              <Table className="min-w-[1200px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Ingredient</TableHead>
                    <TableHead>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help">Qty (g)</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>All quantities in grams (g)</p>
                            <p className="text-xs text-muted-foreground mt-1">Type directly or use arrow keys</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                    <TableHead>Sugars (g)</TableHead>
                    <TableHead>Fat (g)</TableHead>
                    <TableHead>MSNF (g)</TableHead>
                    <TableHead>Other (g)</TableHead>
                    <TableHead>T.Solids (g)</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody onPaste={handlePaste}>
                  {rows.map((row, index) => (
                    <TableRow
                      key={index}
                      className={cn(
                        "transition-colors duration-500",
                        highlightedRow === index && "bg-green-100 dark:bg-green-900/20"
                      )}
                    >
                      <TableCell className="min-w-[280px]">
                        <div className="flex items-center gap-2">
                          <Popover open={searchOpen === index} onOpenChange={(open) => setSearchOpen(open ? index : null)}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                disabled={externalRecipe?.isProductionLocked}
                                className={cn(
                                  "w-full justify-between font-normal",
                                  !row.ingredient && "text-muted-foreground"
                                )}
                              >
                                <span className="truncate">{row.ingredient || "Select ingredient..."}</span>
                                <Search className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0" align="start">
                              <SmartIngredientSearch
                                ingredients={availableIngredients}
                                onSelect={(ing) => {
                                  handleIngredientSelect(index, ing);
                                  setSearchOpen(null);
                                  // After selection, focus the quantity input for the same row
                                  setTimeout(() => {
                                    document.getElementById(`quantity-input-${index}`)?.focus();
                                  }, 50);
                                }}
                                open={searchOpen === index}
                                onOpenChange={(open) => setSearchOpen(open ? index : null)}
                              />
                            </PopoverContent>
                          </Popover>

                          {/* Status Pill */}
                          {row.ingredientData && row.quantity_g > 0 && (
                            <Badge variant="default" className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30 shrink-0">
                              <Check className="h-3 w-3 mr-1" />
                             In use
                            </Badge>
                          )}
                          {row.ingredientData && row.quantity_g === 0 && (
                            <Badge variant="secondary" className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30 shrink-0">
                              <AlertCircle className="h-3 w-3 mr-1" />
                             Add grams
                            </Badge>
                          )}
                          {!row.ingredientData && row.ingredient && (
                            <Badge variant="destructive" className="bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30 shrink-0">
                              <X className="h-3 w-3 mr-1" />
                             Not from DB
                            </Badge>
                          )}
                          {/* Verification status badge */}
                          {row.ingredientData?.verification_status && row.ingredientData.verification_status !== 'verified' && row.ingredientData.verification_status !== 'lab_tested' && (
                            <Badge
                              variant="outline"
                              className={cn(
                                "shrink-0 text-xs",
                                row.ingredientData.verification_status === 'supplier_data' && "border-blue-400 text-blue-700 dark:text-blue-400",
                                row.ingredientData.verification_status === 'estimated' && "border-yellow-500 text-yellow-700 dark:text-yellow-400",
                                row.ingredientData.verification_status === 'ai_estimated' && "border-purple-400 text-purple-700 dark:text-purple-400",
                                row.ingredientData.verification_status === 'user_entered' && "border-gray-400 text-gray-600 dark:text-gray-400",
                              )}
                            >
                              {{
                                supplier_data: 'Supplier',
                                estimated: 'Estimated',
                                ai_estimated: 'AI est.',
                                user_entered: 'Unverified',
                              }[row.ingredientData.verification_status]}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[220px]">
                        <div className="flex items-center gap-2">
                          <QuantityInput
                            id={`quantity-input-${index}`}
                            value={row.quantity_g}
                            onChange={(val) => updateRow(index, 'quantity_g', val)}
                            step={FIXED_STEP_SIZE}
                            rowIndex={index}
                            className="text-lg font-bold"
                            disabled={externalRecipe?.isProductionLocked}
                          />
                          <Badge variant="secondary" className="text-xs whitespace-nowrap">
                            ±{FIXED_STEP_SIZE}g
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[120px]">
                        <Input
                          type="number"
                          value={typeof row.sugars_g === 'number' && !isNaN(row.sugars_g) ? row.sugars_g.toFixed(2) : '0.00'}
                          readOnly
                          className="bg-muted/50 text-muted-foreground cursor-not-allowed font-mono text-sm"
                          title="Auto-calculated from ingredient composition"
                        />
                      </TableCell>
                      <TableCell className="min-w-[120px]">
                        <Input
                          type="number"
                          value={typeof row.fat_g === 'number' && !isNaN(row.fat_g) ? row.fat_g.toFixed(2) : '0.00'}
                          readOnly
                          className="bg-muted/50 text-muted-foreground cursor-not-allowed font-mono text-sm"
                          title="Auto-calculated from ingredient composition"
                        />
                      </TableCell>
                      <TableCell className="min-w-[120px]">
                        <Input
                          type="number"
                          value={typeof row.msnf_g === 'number' && !isNaN(row.msnf_g) ? row.msnf_g.toFixed(2) : '0.00'}
                          readOnly
                          className="bg-muted/50 text-muted-foreground cursor-not-allowed font-mono text-sm"
                          title="Auto-calculated from ingredient composition"
                        />
                      </TableCell>
                      <TableCell className="min-w-[120px]">
                        <Input
                          type="number"
                          value={typeof row.other_solids_g === 'number' && !isNaN(row.other_solids_g) ? row.other_solids_g.toFixed(2) : '0.00'}
                          readOnly
                          className="bg-muted/50 text-muted-foreground cursor-not-allowed font-mono text-sm"
                          title="Auto-calculated from ingredient composition"
                        />
                      </TableCell>
                      <TableCell className="min-w-[140px]">
                        <Input
                          type="number"
                          value={typeof row.total_solids_g === 'number' && !isNaN(row.total_solids_g) ? row.total_solids_g.toFixed(2) : '0.00'}
                          readOnly
                          className="bg-muted/50 text-muted-foreground cursor-not-allowed font-mono text-sm"
                          title="Auto-calculated from ingredient composition"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-7 w-7" 
                            onClick={() => updateRow(index, 'isLocked', !row.isLocked)}
                            title={row.isLocked ? "Unlock ingredient" : "Lock ingredient during optimization"}
                            disabled={externalRecipe?.isProductionLocked}
                          >
                            {row.isLocked ? (
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>
                            )}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => duplicateRow(index)} title="Duplicate Row" disabled={externalRecipe?.isProductionLocked}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeRow(index)} title="Delete Row" disabled={externalRecipe?.isProductionLocked}>
                            <Trash2 className="h-4 w-4 text-destructive opacity-70 hover:opacity-100" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap border-t pt-6 mt-4">
              <div className="flex flex-wrap gap-2">
                <Button onClick={addRow} variant="outline" size="sm" disabled={externalRecipe?.isProductionLocked}>
                  <Plus className="mr-2 h-4 w-4" />
                 Add Ingredient
                </Button>

                <AddIngredientDialog
                  open={showAddIngredientDialog}
                  onOpenChange={setShowAddIngredientDialog}
                  trigger={
                    <Button variant="outline" size="sm" className="gap-2">
                      <Plus className="h-4 w-4" />
                     Add New Ingredient
                    </Button>
                  }
                />
                <Button onClick={calculateMetrics} variant="default" size="sm">
                  <Calculator className="mr-2 h-4 w-4" />
                 Calculate
                </Button>

                {!basicMode && (
                  <>
                    <Button
                      onClick={() => setShowOptimizerPanel(true)}
                      disabled={isOptimizing || rows.length === 0 || externalRecipe?.isProductionLocked}
                      variant="secondary"
                      size="sm"
                    >
                      {isOptimizing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                     Balance Recipe
                    </Button>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Button
                  onClick={saveRecipe}
                  disabled={isSaving || !isAuthenticated || externalRecipe?.isProductionLocked}
                  variant="default"
                  size="sm"
                  className="bg-primary hover:bg-primary/90"
                >
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {currentRecipeId ? "Update Recipe" : "Save Recipe"}
                </Button>
                {currentRecipeId && (
                  <Button
                    onClick={() => setShowTrialRecorder(true)}
                    variant="outline"
                    size="sm"
                    className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
                  >
                    <Beaker className="mr-2 h-4 w-4" />
                   Record Trial
                  </Button>
                )}
                <Button onClick={clearRecipe} variant="outline" size="sm" className="text-muted-foreground hover:text-destructive transition-colors" disabled={externalRecipe?.isProductionLocked}>
                 Clear
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDebugPanel(!showDebugPanel)}
                  className="opacity-50 hover:opacity-100"
                >
                  <Bug className="mr-2 h-4 w-4" />
                  {showDebugPanel ? 'Hide' : 'Show'} Debug
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Debug Panel */}
      {
        showDebugPanel && balancingDiagnostics && (
          <Card className="border-blue-500">
            <CardHeader>
              <CardTitle className="text-sm"> Balancing Diagnostics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div>
                <span className="font-semibold">Product Type:</span> {balancingDiagnostics.productType}
              </div>
              <div>
                <span className="font-semibold">Mode:</span> {balancingDiagnostics.mode}
              </div>
              <div>
                <span className="font-semibold">Ingredient Count:</span> {balancingDiagnostics.ingredientCount}
              </div>

              <Separator />

              <div className="space-y-1">
                <div className="font-semibold">Ingredient Availability:</div>
                <div className={balancingDiagnostics.hasWater ? 'text-green-600' : 'text-red-600'}>
                  {balancingDiagnostics.hasWater ? '' : ''} Water/Diluent (Recipe or DB has 80%+ water)
                </div>
                <div className={balancingDiagnostics.hasFatSource ? 'text-green-600' : 'text-red-600'}>
                  {balancingDiagnostics.hasFatSource ? '' : ''} Fat Source (Recipe has 2%+ fat or DB has cream/butter)
                </div>
                <div className={balancingDiagnostics.hasMSNFSource ? 'text-green-600' : 'text-red-600'}>
                  {balancingDiagnostics.hasMSNFSource ? '' : ''} MSNF Source (Recipe has 5%+ MSNF or DB has SMP)
                </div>
              </div>

              {balancingDiagnostics.missingIngredients.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <div className="font-semibold text-destructive">
                     Missing from Database:
                    </div>
                    <ul className="list-disc list-inside">
                      {balancingDiagnostics.missingIngredients.map((ing: string, i: number) => (
                        <li key={i}>{ing}</li>
                      ))}
                    </ul>
                  </div>
                </>
              )}

              {balancingDiagnostics.suggestions.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <div className="font-semibold">Suggestions:</div>
                    <ul className="list-disc list-inside">
                      {balancingDiagnostics.suggestions.map((sug: string, i: number) => (
                        <li key={i}>{sug}</li>
                      ))}
                    </ul>
                  </div>
                </>
              )}

              <Separator />

              <div className="space-y-1">
                <div className="font-semibold">Targets:</div>
                <div>Fat: {balancingDiagnostics.targets.fat_pct?.toFixed(1)}%</div>
                <div>MSNF: {balancingDiagnostics.targets.msnf_pct?.toFixed(1)}%</div>
                <div>Total Sugars: {balancingDiagnostics.targets.totalSugars_pct?.toFixed(1)}%</div>
                <div>FPDT: {balancingDiagnostics.targets.fpdt?.toFixed(2)}°C</div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="font-semibold">Database Health:</div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const health = checkDbHealth(availableIngredients);
                    setBalancingDiagnostics({
                      ...balancingDiagnostics,
                      dbHealth: health
                    });

                    if (health.healthy) {
                      toast({
                        title: " Database Healthy",
                        description: "All essential ingredients available for balancing",
                        duration: 3000
                      });
                    } else {
                      toast({
                        title: " Database Missing Ingredients",
                        description: (
                          <div className="text-xs space-y-1">
                            <div className="font-medium">Missing:</div>
                            <ul className="list-disc list-inside">
                              {health.missing.map((m, i) => <li key={i}>{m}</li>)}
                            </ul>
                          </div>
                        ),
                        variant: "destructive",
                        duration: 6000
                      });
                    }
                  }}
                >
                 Run DB Health Check
                </Button>

                {balancingDiagnostics.dbHealth && (
                  <div className="text-xs space-y-1 mt-2">
                    <div className={balancingDiagnostics.dbHealth.hasWater ? 'text-green-600' : 'text-red-600'}>
                      {balancingDiagnostics.dbHealth.hasWater ? '' : ''} Water (95%+ water)
                    </div>
                    <div className={balancingDiagnostics.dbHealth.hasCream35OrButter ? 'text-green-600' : 'text-red-600'}>
                      {balancingDiagnostics.dbHealth.hasCream35OrButter ? '' : ''} Heavy Cream 35%+ or Butter
                    </div>
                    <div className={balancingDiagnostics.dbHealth.hasSMP ? 'text-green-600' : 'text-red-600'}>
                      {balancingDiagnostics.dbHealth.hasSMP ? '' : ''} Skim Milk Powder (85%+ MSNF)
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* SE/AFP Audit Panel */}
              {metrics && rows.length > 0 && (
                <div className="space-y-2">
                  <div className="font-semibold"> SE/AFP Audit (Sugar Analysis):</div>
                  <div className="text-xs space-y-1 bg-muted/30 p-2 rounded">
                    {(() => {
                      // Calculate per-sugar SE and AFP breakdown
                      const sugarBreakdown: Array<{
                        name: string;
                        grams: number;
                        spCoeff: number;
                        pacCoeff: number;
                        seContribution: number;
                        afpContribution: number;
                      }> = [];

                      let totalSE = 0;
                      let totalAFP = 0;

                      rows.forEach(row => {
                        if (!row.ingredientData) return;

                        const ing = row.ingredientData;
                        const sugars_g = (ing.sugars_pct / 100) * row.quantity_g;

                        if (sugars_g > 0.1) {
                          const spCoeff = ing.sp_coeff || 1.0;
                          const pacCoeff = ing.pac_coeff || 1.9;

                          // SE = sugars_g * sp_coeff (sucrose equivalents for sweetness)
                          const seContribution = sugars_g * spCoeff;

                          // AFP = sugars_g * pac_coeff (anti-freezing power)
                          const afpContribution = sugars_g * pacCoeff;

                          totalSE += seContribution;
                          totalAFP += afpContribution;

                          sugarBreakdown.push({
                            name: ing.name,
                            grams: sugars_g,
                            spCoeff,
                            pacCoeff,
                            seContribution,
                            afpContribution
                          });
                        }
                      });

                      return (
                        <>
                          <div className="font-semibold mb-1">Sugar Ingredients:</div>
                          {sugarBreakdown.length === 0 && (
                            <div className="text-muted-foreground">No sugar ingredients detected</div>
                          )}
                          {sugarBreakdown.map((sugar, i) => (
                            <div key={i} className="ml-2 space-y-0.5 mb-2 pb-2 border-b border-border/50 last:border-0">
                              <div className="font-medium text-primary">{sugar.name}</div>
                              <div className="ml-2 grid grid-cols-2 gap-x-4 gap-y-0.5">
                                <div>Amount:</div>
                                <div className="font-mono">{sugar.grams.toFixed(1)}g</div>

                                <div>SP Coeff:</div>
                                <div className="font-mono">{sugar.spCoeff.toFixed(2)}</div>

                                <div>PAC Coeff:</div>
                                <div className="font-mono">{sugar.pacCoeff.toFixed(2)}</div>

                                <div className="text-blue-600">SE:</div>
                                <div className="font-mono text-blue-600">
                                  {sugar.seContribution.toFixed(1)}g ({totalSE > 0 ? ((sugar.seContribution / totalSE) * 100).toFixed(0) : 0}%)
                                </div>

                                <div className="text-purple-600">AFP:</div>
                                <div className="font-mono text-purple-600">
                                  {sugar.afpContribution.toFixed(1)} ({totalAFP > 0 ? ((sugar.afpContribution / totalAFP) * 100).toFixed(0) : 0}%)
                                </div>
                              </div>
                            </div>
                          ))}

                          <Separator className="my-2" />

                          <div className="font-semibold bg-primary/10 p-2 rounded space-y-1">
                            <div className="flex justify-between">
                              <span>Total SE (Sucrose Equiv):</span>
                              <span className="font-mono text-blue-600">{totalSE.toFixed(1)}g</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Total AFP (Anti-Freeze):</span>
                              <span className="font-mono text-purple-600">{totalAFP.toFixed(1)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Calculated SE (v2.1):</span>
                              <span className="font-mono text-green-600">{metrics.se_g.toFixed(1)}g</span>
                            </div>
                            <div className="flex justify-between">
                              <span>POD Index:</span>
                              <span className="font-mono">{metrics.pod_index.toFixed(2)}</span>
                            </div>
                          </div>

                          <div className="text-[10px] text-muted-foreground mt-2 space-y-0.5">
                            <div> SE = Sweetness Power × Sugar Weight</div>
                            <div> AFP = PAC Coefficient × Sugar Weight</div>
                            <div> POD = Protein/Other/Dairy balance index</div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )
      }

      {/* PHASE 1: DB Health Check - Before metrics */}
      {
        rows.length > 0 && (
          <div className="mt-4">
            <DatabaseHealthIndicator
              availableIngredients={availableIngredients}
              compact={true}
            />
          </div>
        )
      }

      {/* Redundant metrics cards and validation moved above recipe formulation */}

      {/* PHASE 2: Debug Panel - Below metrics */}
      {
        balancingDiagnostics && (
          <BalancingDebugPanel
            diagnostics={balancingDiagnostics}
            lastStrategy={lastBalanceStrategy}
          />
        )
      }

      {/* Advanced Tools Section - Hidden in Basic Mode */}
      {
        rows.length > 0 && !basicMode && (
          <Card className="mt-6">
            <CardHeader className="gradient-card border-b border-border/50 relative">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Wrench className="h-5 w-5 text-primary" />
                 Advanced Tools
                  {showAdvancedToolsTutorial && (
                    <Badge
                      variant="default"
                      className="ml-2 animate-pulse bg-primary/90 hover:bg-primary"
                    >
                     NEW
                    </Badge>
                  )}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 ml-1">
                        <HelpCircle className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                      <div className="space-y-2">
                        <h4 className="font-semibold"> AI Engine Features</h4>
                        <p className="text-sm text-muted-foreground">
                         All AI Engine features are now here! Use these tools to:
                        </p>
                        <ul className="text-sm space-y-1 ml-4 list-disc">
                          <li>Find flavor pairings</li>
                          <li>Optimize sugar blends</li>
                          <li>Analyze ingredients</li>
                          <li>Tune temperature profiles</li>
                          <li>Reverse engineer recipes</li>
                          <li>AI-powered optimization</li>
                        </ul>
                      </div>
                    </PopoverContent>
                  </Popover>
                </CardTitle>
                {showAdvancedToolsTutorial && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowAdvancedToolsTutorial(false);
                      localStorage.setItem('advanced-tools-tutorial-seen', 'true');
                    }}
                    className="text-xs"
                  >
                   Got it 
                  </Button>
                )}
              </div>
              {showAdvancedToolsTutorial && (
                <Alert className="mt-3 bg-primary/5 border-primary/20">
                  <AlertDescription className="text-sm">
                    <strong> AI Engine features are now here!</strong>
                    <br />
                   All the powerful tools from the AI Engine tab (Flavor Pairings, Temperature Tuning, Reverse Engineer, and more)
                    have been consolidated into these Advanced Tools for easier access.
                  </AlertDescription>
                </Alert>
              )}
            </CardHeader>
            <CardContent className="p-6" id="advanced-tools">
              {isMobile ? (
                // Mobile: Accordion-style with grouping
                <Accordion type="single" collapsible defaultValue="optimization" className="w-full">
                  <AccordionItem value="optimization">
                    <AccordionTrigger className="text-base font-semibold">
                      Optimization Tools
                    </AccordionTrigger>
                    <AccordionContent>
                      <Tabs defaultValue="sugar-blend" className="w-full">
                        <TabsList className="w-full h-auto flex flex-wrap gap-1 p-2 bg-background/80 backdrop-blur-sm">
                          <TabsTrigger value="sugar-blend" className="flex-1 min-w-[140px] text-xs whitespace-nowrap">
                            Sugar Blend
                          </TabsTrigger>
                          <TabsTrigger value="ai-optimize" className="flex-1 min-w-[140px] text-xs whitespace-nowrap">
                            AI Optimizer
                            <Badge variant="secondary" className="ml-1 text-[10px]">NEW</Badge>
                          </TabsTrigger>
                        </TabsList>



                        <TabsContent value="sugar-blend" className="mt-4">
                          {rows.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                              <p className="text-lg font-semibold mb-2">No Recipe Available</p>
                              <p className="text-sm">Add ingredients to optimize sugar blend</p>
                            </div>
                          ) : rows.filter(r => r.ingredientData?.category === 'sugar').length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                              <p className="text-lg font-semibold mb-2">No Sugar Ingredients</p>
                              <p className="text-sm">Add sucrose, dextrose, or glucose syrup to use this tool</p>
                            </div>
                          ) : (
                            <SugarBlendOptimizer
                              productType={productType as 'gelato' | 'ice-cream' | 'sorbet'}
                              totalSugarAmount={rows
                                .filter(r => r.ingredientData?.category === 'sugar')
                                .reduce((sum, r) => sum + r.quantity_g, 0)}
                              onOptimizedBlend={(blend) => {
                                const nonSugarRows = rows.filter(r => r.ingredientData?.category !== 'sugar');
                                const newSugarRows = Object.entries(blend).map(([name, grams]) => {
                                  const ing = availableIngredients.find(i => i.name === name);
                                  if (!ing) return null;
                                  return {
                                    ingredientData: ing,
                                    ingredient: ing.name,
                                    quantity_g: grams,
                                    sugars_g: ((ing.sugars_pct ?? 0) / 100) * grams,
                                    fat_g: ((ing.fat_pct ?? 0) / 100) * grams,
                                    msnf_g: ((ing.msnf_pct ?? 0) / 100) * grams,
                                    other_solids_g: ((ing.other_solids_pct ?? 0) / 100) * grams,
                                    total_solids_g: 0
                                  } as IngredientRow;
                                }).filter((r): r is IngredientRow => r !== null);

                                newSugarRows.forEach(r => {
                                  r.total_solids_g = r.sugars_g + r.fat_g + r.msnf_g + r.other_solids_g;
                                });

                                setRows([...nonSugarRows, ...newSugarRows]);
                                toast({
                                  title: "Sugar Blend Applied",
                                  description: "Recipe updated with optimized sugar blend"
                                });
                              }}
                            />
                          )}
                        </TabsContent>

                        <TabsContent value="ai-optimize" className="mt-4">
                          <AiOptimizerDemo
                            recipe={rows.filter(r => r.ingredient).map(r => ({
                              ingredient: r.ingredient,
                              quantity_g: r.quantity_g
                            }))}
                            idealRanges={{
                              fat_pct: getBalancingTargets(resolveMode(productType)).fat_pct,
                              msnf_pct: getBalancingTargets(resolveMode(productType)).msnf_pct,
                              sugars_pct: getBalancingTargets(resolveMode(productType)).totalSugars_pct
                            }}
                            currentMetrics={metrics}
                            onApplyRecipe={applyOptimizedRecipe}
                          />
                        </TabsContent>
                      </Tabs>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="analysis">
                    <AccordionTrigger className="text-base font-semibold">
                      Analysis Tools
                    </AccordionTrigger>
                    <AccordionContent>
                      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="w-full h-auto flex flex-wrap gap-1 p-2 bg-background/80 backdrop-blur-sm">
                          <TabsTrigger value="analyzer" className="flex-1 min-w-[140px] text-xs whitespace-nowrap">
                            Analyzer
                          </TabsTrigger>
                          <TabsTrigger value="temperature" className="flex-1 min-w-[140px] text-xs whitespace-nowrap">
                            Temperature
                          </TabsTrigger>
                        </TabsList>



                        <TabsContent value="analyzer" className="mt-4">
                          {rows.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                              <p className="text-lg font-semibold mb-2">No Ingredients Added</p>
                              <p className="text-sm">Add ingredients to your recipe to analyze them</p>
                            </div>
                          ) : (
                            <>
                              {rows.filter(r => r.ingredient && !r.ingredientData).length > 0 && (
                                <Alert className="mb-4 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
                                  <AlertDescription className="text-sm">
                                    <strong>Note:</strong> Some rows are missing composition data. Choose ingredients from the list for best analysis.
                                  </AlertDescription>
                                </Alert>
                              )}
                              <IngredientAnalyzer currentRecipe={rows} />
                            </>
                          )}
                        </TabsContent>

                        <TabsContent value="temperature" className="mt-4">
                          {rows.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                              <p className="text-lg font-semibold mb-2">No Ingredients Added</p>
                              <p className="text-sm">Add ingredients to analyze temperature profiles</p>
                            </div>
                          ) : !metrics ? (
                            <div className="text-center py-12 text-muted-foreground">
                              <p className="text-lg font-semibold mb-2">Calculate Recipe First</p>
                              <p className="text-sm">Click 'Calculate' to compute metrics before using temperature tools</p>
                            </div>
                          ) : (
                            <TemperaturePanel
                              metrics={metrics}
                              recipe={rows.map(r => ({
                                ing: r.ingredientData || {
                                  id: r.ingredient.toLowerCase().replace(/\s+/g, '_'),
                                  name: r.ingredient,
                                  category: 'other' as const,
                                  water_pct: 0,
                                  fat_pct: 0
                                },
                                grams: r.quantity_g
                              }))}
                              onApplyTuning={(tunedRecipe) => {
                                const newRows = tunedRecipe
                                  .filter(item => item.grams > 0)
                                  .map(item => {
                                    const ing = item.ing;
                                    return {
                                      ingredientData: ing,
                                      ingredient: ing.name,
                                      quantity_g: item.grams,
                                      sugars_g: ((ing.sugars_pct ?? 0) / 100) * item.grams,
                                      fat_g: ((ing.fat_pct ?? 0) / 100) * item.grams,
                                      msnf_g: ((ing.msnf_pct ?? 0) / 100) * item.grams,
                                      other_solids_g: ((ing.other_solids_pct ?? 0) / 100) * item.grams,
                                      total_solids_g: 0
                                    } as IngredientRow;
                                  });
                                newRows.forEach(r => {
                                  r.total_solids_g = r.sugars_g + r.fat_g + r.msnf_g + r.other_solids_g;
                                });
                                setRows(newRows);
                                toast({
                                  title: "Temperature Tuning Applied",
                                  description: "Recipe optimized for target temperature"
                                });
                              }}
                            />
                          )}
                        </TabsContent>
                      </Tabs>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="utilities">
                    <AccordionTrigger className="text-base font-semibold">
                      Utilities
                    </AccordionTrigger>
                    <AccordionContent>
                      <Tabs defaultValue="reverse" className="w-full">
                        <TabsList className="w-full h-auto flex flex-wrap gap-1 p-2 bg-background/80 backdrop-blur-sm">
                          <TabsTrigger value="reverse" className="flex-1 min-w-[140px] text-xs whitespace-nowrap">
                            Reverse Engineer <span className="ml-1 px-1 py-0.5 text-[9px] border border-current rounded font-semibold opacity-70">Beta</span>
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value="reverse" className="mt-4">
                          <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                            <span className="mt-0.5 text-base"></span>
                            <div>
                              <span className="font-semibold">Beta Version — </span>
                             This feature is still under development. Results may not be fully accurate. Use as a starting point and verify outputs manually.
                            </div>
                          </div>
                          <h3 className="text-lg font-semibold mb-4">AI Recipe Creator</h3>
                          <AiRecipeCreator />
                        </TabsContent>
                      </Tabs>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              ) : (
                // Desktop: Single tab row with all tools
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="w-full h-auto flex flex-wrap lg:grid lg:grid-cols-5 gap-1 lg:gap-2 p-2 bg-background/80 backdrop-blur-sm">
                    <TabsTrigger value="temperature" className="flex-1 min-w-[100px] text-xs lg:text-sm whitespace-nowrap">
                      Temperature
                    </TabsTrigger>
                    <TabsTrigger value="reverse" className="flex-1 min-w-[100px] text-xs lg:text-sm whitespace-nowrap">
                      Reverse <span className="ml-1 px-1 py-0.5 text-[9px] border border-current rounded font-semibold opacity-70">Beta</span>
                    </TabsTrigger>
                    <TabsTrigger value="analyzer" className="flex-1 min-w-[100px] text-xs lg:text-sm whitespace-nowrap">
                      Analyzer
                    </TabsTrigger>
                    <TabsTrigger value="sugar-blend" className="flex-1 min-w-[100px] text-xs lg:text-sm whitespace-nowrap">
                      Sugar Blend
                    </TabsTrigger>
                    <TabsTrigger value="ai-optimize" className="flex-1 min-w-[100px] text-xs lg:text-sm whitespace-nowrap">
                      AI Optimizer
                      <Badge variant="secondary" className="ml-1 text-[10px]">NEW</Badge>
                    </TabsTrigger>
                  </TabsList>



                  <TabsContent value="temperature" className="mt-4">
                    {!metrics ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <p className="text-lg font-semibold mb-2">Calculate Recipe First</p>
                        <p className="text-sm">Click 'Calculate' to compute metrics before using temperature tools</p>
                      </div>
                    ) : (
                      <TemperaturePanel
                        metrics={metrics}
                        recipe={rows.map(r => ({
                          ing: r.ingredientData || {
                            id: r.ingredient.toLowerCase().replace(/\s+/g, '_'),
                            name: r.ingredient,
                            category: 'other' as const,
                            water_pct: 0,
                            fat_pct: 0
                          },
                          grams: r.quantity_g
                        }))}
                        onApplyTuning={(tunedRecipe) => {
                          const newRows = tunedRecipe
                            .filter(item => item.grams > 0)
                            .map(item => {
                              const ing = item.ing;
                              return {
                                ingredientData: ing,
                                ingredient: ing.name,
                                quantity_g: item.grams,
                                sugars_g: ((ing.sugars_pct ?? 0) / 100) * item.grams,
                                fat_g: ((ing.fat_pct ?? 0) / 100) * item.grams,
                                msnf_g: ((ing.msnf_pct ?? 0) / 100) * item.grams,
                                other_solids_g: ((ing.other_solids_pct ?? 0) / 100) * item.grams,
                                total_solids_g: 0
                              } as IngredientRow;
                            });
                          newRows.forEach(r => {
                            r.total_solids_g = r.sugars_g + r.fat_g + r.msnf_g + r.other_solids_g;
                          });
                          setRows(newRows);
                          toast({
                            title: "Temperature Tuning Applied",
                            description: "Recipe optimized for target temperature"
                          });
                        }}
                      />
                    )}
                  </TabsContent>

                  <TabsContent value="reverse" className="mt-4">
                    <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      <span className="mt-0.5 text-base"></span>
                      <div>
                        <span className="font-semibold">Beta Version — </span>
                       This feature is still under development. Results may not be fully accurate. Use as a starting point and verify outputs manually.
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold mb-4 text-center">AI Generation: Create from Scratch</h3>
                    <AiRecipeCreator />
                  </TabsContent>

                  <TabsContent value="analyzer" className="mt-4">
                    {rows.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <p className="text-lg font-semibold mb-2">No Ingredients Added</p>
                        <p className="text-sm">Add ingredients to your recipe to analyze them</p>
                      </div>
                    ) : (
                      <IngredientAnalyzer currentRecipe={rows} />
                    )}
                  </TabsContent>

                  <TabsContent value="sugar-blend" className="mt-4">
                    {rows.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <p className="text-lg font-semibold mb-2">No Recipe Available</p>
                        <p className="text-sm">Add ingredients to optimize sugar blends</p>
                      </div>
                    ) : (
                      <SugarBlendOptimizer
                        productType={productType as 'gelato' | 'ice-cream' | 'sorbet'}
                        totalSugarAmount={rows
                          .filter(r => r.ingredientData?.category === 'sugar')
                          .reduce((sum, r) => sum + r.quantity_g, 0)}
                        onOptimizedBlend={(blend) => {
                          // Remove existing sugar ingredients
                          const nonSugarRows = rows.filter(r => r.ingredientData?.category !== 'sugar');

                          // Add new sugar blend
                          const blendRows = Object.entries(blend).map(([name, grams]) => {
                            const ing = availableIngredients.find(i => i.name === name);
                            if (!ing) return null;

                            const newRow: IngredientRow = {
                              ingredientData: ing,
                              ingredient: ing.name,
                              quantity_g: grams,
                              sugars_g: ((ing.sugars_pct ?? 0) / 100) * grams,
                              fat_g: ((ing.fat_pct ?? 0) / 100) * grams,
                              msnf_g: ((ing.msnf_pct ?? 0) / 100) * grams,
                              other_solids_g: ((ing.other_solids_pct ?? 0) / 100) * grams,
                              total_solids_g: 0
                            };
                            newRow.total_solids_g = newRow.sugars_g + newRow.fat_g + newRow.msnf_g + newRow.other_solids_g;
                            return newRow;
                          }).filter(Boolean) as IngredientRow[];

                          setRows([...nonSugarRows, ...blendRows]);
                          toast({
                            title: "Sugar Blend Applied",
                            description: "Recipe updated with optimized sugar blend"
                          });
                        }}
                      />
                    )}
                  </TabsContent>

                  <TabsContent value="ai-optimize" className="mt-4">
                    <AiOptimizerDemo
                      recipe={rows.filter(r => r.ingredient).map(r => ({
                        ingredient: r.ingredient,
                        quantity_g: r.quantity_g
                      }))}
                      idealRanges={{
                        fat_pct: getBalancingTargets(resolveMode(productType)).fat_pct,
                        msnf_pct: getBalancingTargets(resolveMode(productType)).msnf_pct,
                        sugars_pct: getBalancingTargets(resolveMode(productType)).totalSugars_pct
                      }}
                      currentMetrics={metrics}
                      onApplyRecipe={applyOptimizedRecipe}
                    />
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>
        )
      }
      {/* Mobile Quick Access Button */}
      {
        isMobile && rows.length > 0 && (
          <Button
            className="fixed bottom-4 right-4 rounded-full shadow-lg z-50 h-14 w-14"
            size="icon"
            onClick={() => {
              document.getElementById('advanced-tools')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <Wrench className="h-5 w-5" />
          </Button>
        )
      }

      {/* PHASE 2: Balancing Suggestions Dialog */}
      <Dialog open={showSuggestionsDialog} onOpenChange={setShowSuggestionsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
             Balancing Failed - Auto-Fix Available
            </DialogTitle>
            <DialogDescription>
             The recipe couldn't be automatically balanced. Apply these suggestions to get closer to your targets.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {balancingSuggestions.length > 0 ? (
              <>
                <div className="space-y-2">
                  {balancingSuggestions.map((suggestion) => (
                    <Card key={suggestion.id} className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={suggestion.priority === 1 ? "destructive" : "secondary"}>
                              {suggestion.priority === 1 ? "Critical" : "Recommended"}
                            </Badge>
                            <span className="font-medium">{suggestion.ingredientName}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {suggestion.action === 'add' ? 'Add' : 'Increase'} {suggestion.quantityChange.toFixed(0)}g {suggestion.reason}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => applySuggestion(suggestion)}
                          className="whitespace-nowrap"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                         Apply
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {balancingSuggestions.length} suggestion{balancingSuggestions.length > 1 ? 's' : ''} available
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowSuggestionsDialog(false)}>
                     Cancel
                    </Button>
                    <Button onClick={applyAllSuggestions}>
                      <Wand2 className="h-4 w-4 mr-2" />
                     Apply All & Re-Balance
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-success" />
                <p>All suggestions have been applied!</p>
                <p className="text-sm mt-2">Close this dialog and click "Balance Recipe" again.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      <Dialog open={showTrialRecorder} onOpenChange={setShowTrialRecorder}>
        <DialogContent className="max-w-3xl border-none shadow-none bg-transparent">
          {currentRecipeId && (
            <TrialRecorder
              recipeId={currentRecipeId}
              targetMetrics={{
                fat_pct: metrics?.fat_pct,
                msnf_pct: metrics?.msnf_pct,
                sugars_pct: metrics?.totalSugars_pct,
                total_solids_pct: metrics?.ts_pct,
                fpdt: metrics?.fpdt
              }}
              onSaved={() => setShowTrialRecorder(false)}
              onCancel={() => setShowTrialRecorder(false)}
            />
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
