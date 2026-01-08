/**
 * useRecipeBalance - Recipe balancing logic hook
 */

import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { calcMetricsV2, MetricsV2 } from '@/lib/calc.v2';
import { OptimizeTarget, Row } from '@/lib/optimize';
import { RecipeBalancerV2, ScienceValidation } from '@/lib/optimize.balancer.v2';
import { PRODUCT_CONSTRAINTS, getBalancingTargets } from '@/lib/productConstraints';
import { diagnoseBalancingFailure as diagnoseFailure } from '@/lib/ingredientMapper';
import { diagnoseFeasibility, Feasibility, applyAutoFix } from '@/lib/diagnostics';
import { resolveMode, resolveProductKey } from '@/lib/mode';
import { 
  validateRecipeIngredients, 
  diagnoseBalancingFailure as diagnoseBalancingError,
  getBalancingErrorInfo,
  type BalancingFailureReason 
} from '@/lib/validation';
import type { IngredientRow, BalancingSuggestion, BalancingDiagnostics } from '@/types/calculator';
import type { IngredientData } from '@/types/ingredients';
import type { Mode } from '@/types/mode';

interface UseRecipeBalanceProps {
  rows: IngredientRow[];
  setRows: React.Dispatch<React.SetStateAction<IngredientRow[]>>;
  metrics: MetricsV2 | null;
  setMetrics: (metrics: MetricsV2 | null) => void;
  productType: string;
  availableIngredients: IngredientData[];
  refetchIngredients: () => Promise<void>;
}

interface UseRecipeBalanceReturn {
  isOptimizing: boolean;
  balanceRecipe: () => void;
  scienceValidation: ScienceValidation[] | undefined;
  qualityScore: { score: number; grade: 'A' | 'B' | 'C' | 'D' | 'F'; color: 'success' | 'warning' | 'destructive' } | undefined;
  balancingDiagnostics: BalancingDiagnostics | null;
  setBalancingDiagnostics: (d: BalancingDiagnostics | null) => void;
  lastBalanceStrategy: 'LP' | 'Heuristic' | 'Auto-Fix' | undefined;
  balancingSuggestions: BalancingSuggestion[];
  setBalancingSuggestions: React.Dispatch<React.SetStateAction<BalancingSuggestion[]>>;
  showSuggestionsDialog: boolean;
  setShowSuggestionsDialog: (show: boolean) => void;
  applySuggestion: (suggestion: BalancingSuggestion) => Promise<void>;
  applyAllSuggestions: () => Promise<void>;
}

// Canonical ingredient aliases for matching
const INGREDIENT_ALIASES: Record<string, string[]> = {
  'cream_35': ['heavy cream', 'heavy cream 35', 'cream 35', 'double cream', 'whipping cream'],
  'smp': ['skim milk powder', 'skimmed milk powder', 'nonfat milk powder', 'smp', 'dried skim milk'],
  'water': ['water', 'filtered water', 'drinking water', 'purified water'],
  'sucrose': ['sucrose', 'white sugar', 'cane sugar', 'table sugar', 'granulated sugar'],
  'butter': ['butter', 'unsalted butter', 'salted butter', 'sweet cream butter'],
  'milk': ['whole milk', 'milk', 'fresh milk', 'cow milk'],
  'dextrose': ['dextrose', 'glucose', 'corn sugar', 'grape sugar']
};

// Default compositions for auto-creating missing ingredients
const DEFAULT_COMPOSITIONS: Record<string, Partial<IngredientData>> = {
  'cream_35': { name: 'Heavy Cream 35%', fat_pct: 35, msnf_pct: 5.5, water_pct: 58, category: 'dairy', hardening_factor: 1.0 },
  'smp': { name: 'Skim Milk Powder', fat_pct: 1, msnf_pct: 95, water_pct: 4, category: 'dairy', hardening_factor: 1.0 },
  'water': { name: 'Water', water_pct: 100, category: 'other', hardening_factor: 0 },
  'sucrose': { name: 'Sucrose', sugars_pct: 100, category: 'sugar', hardening_factor: 1.0 },
  'butter': { name: 'Butter', fat_pct: 82, msnf_pct: 2, water_pct: 15.5, category: 'dairy', hardening_factor: 1.0 },
  'dextrose': { name: 'Dextrose', sugars_pct: 100, category: 'sugar', hardening_factor: 1.0 }
};

// Use centralized targets from productConstraints
// (getBalancingTargets is now imported from @/lib/productConstraints)

export function useRecipeBalance({
  rows,
  setRows,
  metrics,
  setMetrics,
  productType,
  availableIngredients,
  refetchIngredients
}: UseRecipeBalanceProps): UseRecipeBalanceReturn {
  const { toast } = useToast();
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [scienceValidation, setScienceValidation] = useState<ScienceValidation[] | undefined>(undefined);
  const [qualityScore, setQualityScore] = useState<{ score: number; grade: 'A' | 'B' | 'C' | 'D' | 'F'; color: 'success' | 'warning' | 'destructive' } | undefined>(undefined);
  const [balancingDiagnostics, setBalancingDiagnostics] = useState<BalancingDiagnostics | null>(null);
  const [lastBalanceStrategy, setLastBalanceStrategy] = useState<'LP' | 'Heuristic' | 'Auto-Fix' | undefined>(undefined);
  const [balancingSuggestions, setBalancingSuggestions] = useState<BalancingSuggestion[]>([]);
  const [showSuggestionsDialog, setShowSuggestionsDialog] = useState(false);

  const createRowFromIngredient = (ingredient: IngredientData, quantity_g: number): IngredientRow => {
    const sugars_g = ((ingredient.sugars_pct ?? 0) / 100) * quantity_g;
    const fat_g = ((ingredient.fat_pct ?? 0) / 100) * quantity_g;
    const msnf_g = ((ingredient.msnf_pct ?? 0) / 100) * quantity_g;
    const other_solids_g = ((ingredient.other_solids_pct ?? 0) / 100) * quantity_g;
    
    return {
      ingredientData: ingredient,
      ingredient: ingredient.name,
      quantity_g,
      sugars_g,
      fat_g,
      msnf_g,
      other_solids_g,
      total_solids_g: sugars_g + fat_g + msnf_g + other_solids_g
    };
  };

  const balanceRecipe = () => {
    const mode = resolveMode(productType);
    const validRows = rows.filter(r => r.ingredientData && r.quantity_g > 0);
    const rowsWithoutData = rows.filter(r => !r.ingredientData && r.ingredient).length;
    
    if (!metrics) {
      toast({
        title: "Calculate metrics first",
        description: "Click the Calculate button to update your mix metrics before balancing.",
        variant: "destructive",
      });
      return;
    }

    if (validRows.length === 0) {
      toast({
        title: rowsWithoutData > 0 ? "No valid ingredients" : "No ingredients to balance",
        description: rowsWithoutData > 0 
          ? "All ingredients must be selected from the database list."
          : "Add ingredients from the database and enter quantities first.",
        variant: "destructive",
      });
      return;
    }

    setIsOptimizing(true);

    try {
      // Validate ingredients before calculation
      const ingredientValidation = validateRecipeIngredients(validRows);
      if (!ingredientValidation.valid) {
        toast({
          title: '⚠️ Invalid Ingredient Data',
          description: ingredientValidation.errors[0], // Show first error
          variant: 'destructive',
          duration: 6000
        });
        setIsOptimizing(false);
        return;
      }
      
      const targets = getBalancingTargets(mode);

      // Convert rows to optimization format
      const optRows: Row[] = validRows.map(r => ({
        ing: r.ingredientData!,
        grams: r.quantity_g,
        min: 0,
        max: 1000
      }));

      // Store diagnostics
      const diagnosis = diagnoseFailure(optRows, availableIngredients, targets);
      const hasFruit = rows.some(r => r.ingredientData?.category === 'fruit');
      
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

      // Run auto-fix prepass if needed
      const prepassFeasibility: Feasibility = diagnoseFeasibility(optRows, availableIngredients, targets, mode);
      
      if (!prepassFeasibility.feasible && prepassFeasibility.missingCanonicals?.length > 0) {
        const prepassAutoFix = applyAutoFix(optRows, availableIngredients, mode, prepassFeasibility);
        
        if (prepassAutoFix.applied) {
          prepassAutoFix.addedIngredients.forEach(added => {
            const ing = availableIngredients.find(i => i.name === added.name);
            if (ing) {
              optRows.push({ ing, grams: added.grams, min: 0, max: 1000 });
              setRows(prev => [...prev, createRowFromIngredient(ing, added.grams)]);
            }
          });
          
          toast({
            title: '🛠️ Gentle Prepass Applied',
            description: prepassAutoFix.addedIngredients.map(a => `+ ${a.grams.toFixed(1)}g ${a.name}`).join(', '),
            duration: 3000
          });
        }
      }

      // Check feasibility
      const feasibility: Feasibility = diagnoseFeasibility(optRows, availableIngredients, targets, mode);
      
      if (!feasibility.feasible) {
        const autoFix = applyAutoFix(optRows, availableIngredients, mode, feasibility);
        
        if (autoFix.applied) {
          autoFix.addedIngredients.forEach(added => {
            const ing = availableIngredients.find(i => i.name === added.name);
            if (ing) {
              optRows.push({ ing, grams: added.grams, min: 0, max: 1000 });
              setRows(prev => [...prev, createRowFromIngredient(ing, added.grams)]);
            }
          });
          setLastBalanceStrategy('Auto-Fix');
        } else {
          // Use improved error messages
          const hasWater = rows.some(r => r.ingredientData && (r.ingredientData.water_pct ?? 0) > 50);
          const hasFat = rows.some(r => r.ingredientData && (r.ingredientData.fat_pct ?? 0) > 5);
          const hasMSNF = rows.some(r => r.ingredientData && (r.ingredientData.msnf_pct ?? 0) > 5);
          const hasSugar = rows.some(r => r.ingredientData && (r.ingredientData.sugars_pct ?? 0) > 10);
          
          const failureReason = diagnoseBalancingError(hasWater, hasFat, hasMSNF, hasSugar, optRows.length, feasibility.reason);
          const errorInfo = getBalancingErrorInfo(failureReason);
          
          toast({
            title: `⚠️ ${errorInfo.title}`,
            description: `${errorInfo.description} ${errorInfo.suggestion}`,
            variant: 'destructive',
            duration: 8000
          });
          setIsOptimizing(false);
          return;
        }
      }

      // Run balancing
      const calcMode = resolveMode(productType);
      const tolerance = calcMode === 'ice_cream' ? 3.0 : 2.0;
      
      const result = RecipeBalancerV2.balance(optRows, targets, availableIngredients, {
        maxIterations: 200,
        tolerance,
        enableFeasibilityCheck: true,
        useLPSolver: true,
        productType: productType,
        enableScienceValidation: true,
        allowCoreDairy: true
      });

      if (!result.success) {
        // Generate suggestions
        const currentMetrics = calcMetricsV2(optRows, { mode: calcMode });
        const structuredSuggestions: BalancingSuggestion[] = [];
        
        const fatGap = targets.fat_pct - currentMetrics.fat_pct;
        const msnfGap = targets.msnf_pct - currentMetrics.msnf_pct;
        const sugarGap = targets.totalSugars_pct - currentMetrics.totalSugars_pct;
        
        if (Math.abs(fatGap) > 2) {
          structuredSuggestions.push({
            id: fatGap > 0 ? 'fat-increase' : 'fat-decrease',
            action: 'add',
            ingredientName: fatGap > 0 ? 'Heavy Cream 35%' : 'Water',
            ingredientId: fatGap > 0 ? 'cream_35' : 'water',
            quantityChange: Math.abs(fatGap * (fatGap > 0 ? 15 : 20)),
            reason: fatGap > 0 ? `to increase fat by ${fatGap.toFixed(1)}%` : `to dilute fat by ${Math.abs(fatGap).toFixed(1)}%`,
            priority: 1
          });
        }
        
        if (Math.abs(msnfGap) > 2 && msnfGap > 0) {
          structuredSuggestions.push({
            id: 'msnf-increase',
            action: 'add',
            ingredientName: 'Skim Milk Powder (SMP)',
            ingredientId: 'smp',
            quantityChange: Math.abs(msnfGap * 15),
            reason: `to increase MSNF by ${msnfGap.toFixed(1)}%`,
            priority: 1
          });
        }
        
        if (Math.abs(sugarGap) > 2 && sugarGap > 0) {
          structuredSuggestions.push({
            id: 'sugar-increase',
            action: 'add',
            ingredientName: 'Sucrose',
            ingredientId: 'sucrose',
            quantityChange: Math.abs(sugarGap * 15),
            reason: `to increase sugars by ${sugarGap.toFixed(1)}%`,
            priority: 2
          });
        }
        
        setBalancingSuggestions(structuredSuggestions);
        setShowSuggestionsDialog(true);
        setIsOptimizing(false);
        return;
      }

      // Success - update state
      setScienceValidation(result.scienceValidation);
      setQualityScore(result.qualityScore);

      const newRows = rows.map((row, i) => {
        if (i < result.rows.length && row.ingredientData) {
          const opt = result.rows[i];
          return createRowFromIngredient(row.ingredientData, opt.grams);
        }
        return row;
      });

      setRows(newRows);
      setLastBalanceStrategy(result.strategy as 'LP' | 'Heuristic');

      // Recalculate metrics
      const recalcRows = result.rows
        .filter(r => r.ing && r.grams > 0)
        .map(r => ({ ing: r.ing, grams: r.grams }));

      const recalculatedMetrics = calcMetricsV2(recalcRows, { mode: calcMode });
      setMetrics(recalculatedMetrics);

      toast({
        title: `✅ ${mode === 'sorbet' ? 'Sorbet' : mode === 'ice_cream' ? 'Ice Cream' : mode === 'gelato' ? 'Gelato' : 'Kulfi'} Balanced (${result.strategy})`,
        description: result.message,
        duration: 5000
      });

    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error('Balancing error:', error);
      }
      
      // Diagnose the failure and provide specific guidance
      const hasWater = rows.some(r => r.ingredientData && (r.ingredientData.water_pct ?? 0) > 50);
      const hasFat = rows.some(r => r.ingredientData && (r.ingredientData.fat_pct ?? 0) > 5);
      const hasMSNF = rows.some(r => r.ingredientData && (r.ingredientData.msnf_pct ?? 0) > 5);
      const hasSugar = rows.some(r => r.ingredientData && (r.ingredientData.sugars_pct ?? 0) > 10);
      
      const failureReason = diagnoseBalancingError(
        hasWater,
        hasFat,
        hasMSNF,
        hasSugar,
        validRows.length,
        error?.message
      );
      
      const errorInfo = getBalancingErrorInfo(failureReason, {
        currentFat: metrics?.fat_pct,
        currentMSNF: metrics?.msnf_pct
      });
      
      toast({
        title: errorInfo.title,
        description: `${errorInfo.description} ${errorInfo.suggestion}`,
        variant: 'destructive',
        duration: 8000
      });
    } finally {
      setIsOptimizing(false);
    }
  };

  const applySuggestion = async (suggestion: BalancingSuggestion) => {
    // Find ingredient using aliases
    const ingredient = availableIngredients.find(ing => {
      if (ing.name.toLowerCase() === suggestion.ingredientName.toLowerCase()) return true;
      
      const searchTerms = INGREDIENT_ALIASES[suggestion.ingredientId] || [];
      return searchTerms.some(term => ing.name.toLowerCase().includes(term.toLowerCase()));
    });
    
    if (!ingredient) {
      // Try auto-creating the ingredient
      const defaults = DEFAULT_COMPOSITIONS[suggestion.ingredientId];
      
      if (defaults) {
        const insertData = {
          name: defaults.name!,
          category: defaults.category || 'other',
          hardening_factor: defaults.hardening_factor ?? 1.0,
          fat_pct: defaults.fat_pct ?? 0,
          msnf_pct: defaults.msnf_pct ?? 0,
          water_pct: defaults.water_pct ?? 0,
          sugars_pct: defaults.sugars_pct ?? 0,
          other_solids_pct: defaults.other_solids_pct ?? 0
        };
        
        const { data: newIng, error } = await supabase
          .from('ingredients')
          .insert(insertData)
          .select()
          .single();
        
        if (error || !newIng) {
          toast({
            title: '❌ Failed to add ingredient',
            description: error?.message || 'Please add it manually',
            variant: 'destructive'
          });
          return;
        }
        
        toast({
          title: '✨ Ingredient Added',
          description: `${defaults.name} was automatically added to your database`,
        });
        
        await refetchIngredients();
        setTimeout(() => applySuggestion(suggestion), 500);
        return;
      }
      
      toast({
        title: '❌ Ingredient Not Found',
        description: `"${suggestion.ingredientName}" is not in your database.`,
        variant: 'destructive',
        duration: 6000
      });
      return;
    }
    
    // Check if ingredient exists in recipe
    const existingRowIndex = rows.findIndex(r => r.ingredientData?.id === ingredient.id);
    
    if (existingRowIndex >= 0) {
      const currentQty = rows[existingRowIndex].quantity_g;
      const newQty = currentQty + suggestion.quantityChange;
      
      setRows(prev => prev.map((r, i) => 
        i === existingRowIndex ? createRowFromIngredient(ingredient, newQty) : r
      ));
      
      toast({
        title: '✅ Suggestion Applied',
        description: `Increased ${ingredient.name} from ${currentQty.toFixed(0)}g to ${newQty.toFixed(0)}g`,
        duration: 3000
      });
    } else {
      setRows(prev => [...prev, createRowFromIngredient(ingredient, suggestion.quantityChange)]);
      
      toast({
        title: '✅ Suggestion Applied',
        description: `Added ${suggestion.quantityChange.toFixed(0)}g ${ingredient.name} to recipe`,
        duration: 3000
      });
    }
    
    setBalancingSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
  };

  const applyAllSuggestions = async () => {
    for (const suggestion of balancingSuggestions) {
      await applySuggestion(suggestion);
    }
    setShowSuggestionsDialog(false);
    
    toast({
      title: '✨ All Suggestions Applied',
      description: 'Re-balancing recipe automatically...',
      duration: 3000
    });
    
    setTimeout(() => balanceRecipe(), 1000);
  };

  return {
    isOptimizing,
    balanceRecipe,
    scienceValidation,
    qualityScore,
    balancingDiagnostics,
    setBalancingDiagnostics,
    lastBalanceStrategy,
    balancingSuggestions,
    setBalancingSuggestions,
    showSuggestionsDialog,
    setShowSuggestionsDialog,
    applySuggestion,
    applyAllSuggestions
  };
}
