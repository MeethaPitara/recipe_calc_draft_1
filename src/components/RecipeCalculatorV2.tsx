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
import { supabase } from '@/integrations/supabase/client';
import { Plus, Save, Trash2, Calculator, Loader2, Search, Zap, BookOpen, Bug, History, HelpCircle, CheckCircle, AlertCircle, Wand2, Brain, Check, X, FileDown, GitCompare } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SmartIngredientSearch } from '@/components/SmartIngredientSearch';
import { RecipeTemplates, resolveTemplateIngredients } from '@/components/RecipeTemplates';
import { AddIngredientDialog } from '@/components/AddIngredientDialog';
import { useIngredients } from '@/contexts/IngredientsContext';
import type { IngredientData } from '@/types/ingredients';
import { calcMetricsV2, MetricsV2 } from '@/lib/calc.v2';
import { OptimizeTarget, Row } from '@/lib/optimize';
import { balancingEngine } from '@/lib/optimize.engine';
import { RecipeBalancerV2, ScienceValidation, PRODUCT_CONSTRAINTS } from '@/lib/optimize.balancer.v2';
import { diagnoseBalancingFailure, checkDbHealth } from '@/lib/ingredientMapper';
import { diagnoseFeasibility, Feasibility, applyAutoFix } from '@/lib/diagnostics';
import { ScienceValidationPanel } from '@/components/ScienceValidationPanel';
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
import { advancedOptimize, OptimizerConfig } from '@/lib/optimize.advanced';
import { Wrench } from 'lucide-react';
import { RecipeCompareDialog } from '@/components/RecipeCompareDialog';
import jsPDF from 'jspdf';
import { DatabaseHealthIndicator } from '@/components/DatabaseHealthIndicator';
import { BalancingDebugPanel } from '@/components/BalancingDebugPanel';
import { Checkbox } from '@/components/ui/checkbox';
import { AIInsightsPanel } from '@/components/AIInsightsPanel';

// Debounce utility for input stability
// Debounce removed - using direct state updates for better input reliability

// Import types and use resolveProductKey from mode.ts
import { resolveProductKey } from '@/lib/mode';
import type { IngredientRow, BalancingSuggestion } from '@/types/calculator';
import { BalancingSuggestionsDialog } from '@/components/recipe/BalancingSuggestionsDialog';

// Local productKey helper that uses the centralized resolver
function productKey(mode: Mode, rows: IngredientRow[]): string {
  const hasFruit = rows.some(r => r.ingredientData?.category === 'fruit');
  return resolveProductKey(mode, hasFruit);
}

interface RecipeCalculatorV2Props {
  onRecipeChange?: (recipe: any[], metrics: MetricsV2 | null, productType: string) => void;
}

export default function RecipeCalculatorV2({ onRecipeChange }: RecipeCalculatorV2Props) {
  const { toast } = useToast();
  const [recipeName, setRecipeName] = useState('');
  const [productType, setProductType] = useState('ice_cream');
  const [rows, setRows] = useState<IngredientRow[]>([]);
  const [metrics, setMetrics] = useState<MetricsV2 | null>(null);
  const [targetBatchSize, setTargetBatchSize] = useState<number | null>(null);
  const [servings, setServings] = useState<number>(10);
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

  // Helper to render core metrics with color-coded status
  const renderCoreMetric = (label: string, value: number, range: [number, number]) => {
    const [min, max] = range;
    const isInRange = value >= min && value <= max;
    const isClose = !isInRange && ((value >= min - 2 && value < min) || (value > max && value <= max + 2));
    
    let statusColor = 'text-green-600 dark:text-green-400';
    let bgColor = 'bg-green-500/10 border-green-500/20';
    
    if (!isInRange) {
      if (isClose) {
        statusColor = 'text-amber-600 dark:text-amber-400';
        bgColor = 'bg-amber-500/10 border-amber-500/20';
      } else {
        statusColor = 'text-red-600 dark:text-red-400';
        bgColor = 'bg-red-500/10 border-red-500/20';
      }
    }

    const explanation = getMetricExplanation(label, value, [min, max]);
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`border rounded-lg p-3 ${bgColor} cursor-help`}>
              <div className="text-xs text-muted-foreground mb-1">{label}</div>
              <div className={`text-lg font-bold ${statusColor}`}>
                {value.toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Target: {min}–{max}%
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-sm">{explanation}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };
  
  
  // Controlled tab state for consistent navigation
  const [activeTab, setActiveTab] = useState('ai-insights');
  
  // Basic/Advanced mode toggle - simplified calculator view
  const [basicMode, setBasicMode] = useState(() => {
    // Default to basic mode for first-time users
    const saved = localStorage.getItem('calculator-mode');
    return saved ? saved === 'basic' : true;
  });
  
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
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
      // Auto-refetch ingredients after authentication
      if (session && availableIngredients.length === 0) {
        console.log("🔄 Refetching ingredients after auth...");
        refetchIngredients();
      }
    });

    return () => subscription.unsubscribe();
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
        const calculated = calcMetricsV2(calcRows, { mode });
        setMetrics(calculated);
      }
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
      quantity_g: Math.round(r.quantity_g * scaleFactor * 10) / 10
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
    return "✓ Within optimal range for great texture and scoopability";
  };

  // PHASE 1: Simplified Quantity Input - Direct controlled input with no buffering
  const QuantityInput = ({ value, onChange, step, rowIndex, className }: { 
    value: number; 
    onChange: (val: number) => void; 
    step: number;
    rowIndex: number;
    className?: string;
  }) => {
    return (
      <Input
        type="number"
        inputMode="decimal"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => {
          const parsed = parseFloat(e.target.value);
          if (!isNaN(parsed) && parsed >= 0) {
            onChange(parsed);
          } else if (e.target.value === '') {
            onChange(0);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            onChange(value + step);
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            onChange(Math.max(0, value - step));
          }
        }}
        className={cn("text-lg font-semibold", className)}
      />
    );
  };

  const addRow = () => {
    setRows([...rows, {
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
    setRows(rows.filter((_, i) => i !== index));
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

  const updateRow = (index: number, field: keyof IngredientRow, value: string | number) => {
    setRows(prevRows => {
      const newRows = [...prevRows];
      
      // Validate numeric input
      let numericValue = typeof value === 'number' ? value : parseFloat(value);
      if (isNaN(numericValue) || !isFinite(numericValue) || numericValue < 0) {
        numericValue = 0;
      }
      
      const oldValue = newRows[index][field];
      newRows[index] = { ...newRows[index], [field]: numericValue };
      
      // Auto-calculate nutritional values when quantity changes
      if (field === 'quantity_g' && newRows[index].ingredientData) {
        const ing = newRows[index].ingredientData!;
        const qty = numericValue;
        
        console.log(`📝 UpdateRow[${index}]: quantity_g changed`, {
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
        console.log(`⚠️ UpdateRow[${index}]: quantity_g changed but no ingredientData`, {
          ingredient: newRows[index].ingredient,
          qty: numericValue
        });
      }
      
      return newRows;
    });
    // Metrics recalculation moved to debounced useEffect
  };

  const handleIngredientSelect = (index: number, ingredient: IngredientData) => {
    console.log('🔄 handleIngredientSelect called:', { index, ingredientName: ingredient.name });
    
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
      title: '✓ Ingredient Updated',
      description: `${ingredient.name} selected for row ${index + 1}`,
      duration: 2000,
    });
    
    console.log('✅ Ingredient selected successfully:', ingredient.name);
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
        doc.text(`${index + 1}. ${row.ingredient}: ${row.quantity_g.toFixed(1)}g`, 25, yPos);
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
      title: '✓ PDF Exported',
      description: 'Recipe has been downloaded as PDF',
    });
  };

  const calculateMetrics = () => {
    console.log('🧮 calculateMetrics called');
    
    const totalRows = rows.length;
    const rowsWithIngredientData = rows.filter(r => r.ingredientData).length;
    const rowsWithoutData = totalRows - rowsWithIngredientData;
    const validRows = rows.filter(r => r.ingredientData && r.quantity_g > 0);
    
    console.log(`  Total rows: ${totalRows}`);
    console.log(`  Rows with ingredientData: ${rowsWithIngredientData}`);
    console.log(`  Rows without ingredientData: ${rowsWithoutData}`);
    console.log(`  Valid rows (with data + grams > 0): ${validRows.length}`);
    
    // More specific error messages
    if (validRows.length === 0) {
      if (rowsWithoutData > 0 && rowsWithIngredientData === 0) {
        console.warn('⚠ No ingredients from database. All rows are text-only.');
        toast({
          title: "No valid ingredients",
          description: "Choose ingredients from the database list and enter quantities to calculate metrics.",
          variant: "destructive",
        });
      } else if (rows.every(r => r.quantity_g === 0)) {
        console.warn('⚠ All rows have 0 grams.');
        toast({
          title: "No quantities entered",
          description: "Enter gram amounts for your ingredients to calculate metrics.",
          variant: "destructive",
        });
      } else {
        console.warn('⚠ No valid rows to calculate.');
        toast({
          title: "Cannot calculate",
          description: "Ensure ingredients are from the database and have quantities entered.",
          variant: "destructive",
        });
      }
      return;
    }
    
    // Warn if some rows lack data (text-only ingredients)
    if (rowsWithoutData > 0) {
      console.warn(`⚠ ${rowsWithoutData} row(s) have no ingredientData and will be ignored.`);
      toast({
        title: "Some ingredients not recognized",
        description: `${rowsWithoutData} ingredient(s) are not from the database and will be ignored in calculations.`,
      });
    }

    // Convert rows to format expected by calc.v2
    const calcRows = validRows.map(r => ({
      ing: r.ingredientData!,
      grams: r.quantity_g
    }));

    // Use the comprehensive v2.1 science engine with central mode resolver
    const mode = resolveMode(productType);
    const calculated = calcMetricsV2(calcRows, { mode });

    setMetrics(calculated);
    
    console.log('✅ Metrics calculated', {
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
        title: 'Recipe Balanced ✅',
        description: 'All parameters within target ranges'
      });
    }
  };

  const balanceRecipe = () => {
    console.log('⚖ balanceRecipe called');
    console.log(`  Rows: ${rows.length}`);
    console.log(`  Has metrics: ${!!metrics}`);
    console.log(`  Product type: ${productType}`);
    
    const validRows = rows.filter(r => r.ingredientData && r.quantity_g > 0);
    const rowsWithoutData = rows.filter(r => !r.ingredientData && r.ingredient).length;
    
    if (!metrics) {
      console.warn('⚠ balanceRecipe blocked: no metrics. User must calculate first.');
      toast({
        title: "Calculate metrics first",
        description: "Click the Calculate button to update your mix metrics before balancing.",
        variant: "destructive",
      });
      return;
    }

    if (validRows.length === 0) {
      console.warn('⚠ balanceRecipe blocked: no valid rows with ingredientData.');
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

    console.log('🔧 Starting balancing process...', {
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

      console.log('🎯 Balancing targets:', targets);

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
        console.log('🛠️ Running gentle prepass auto-fix...');
        const prepassAutoFix = applyAutoFix(optRows, availableIngredients, mode, prepassFeasibility);
        
        if (prepassAutoFix.applied) {
          console.log('✅ Prepass auto-fix applied:', prepassAutoFix.addedIngredients);
          
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
            title: '🛠️ Gentle Prepass Applied',
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
        console.log('❌ Feasibility check FAILED:', feasibility.reason);
        
        // Try auto-fix before giving up
        const autoFix = applyAutoFix(optRows, availableIngredients, mode, feasibility);
        
        if (autoFix.applied) {
          console.log('🛠️ Auto-fix applied:', autoFix.addedIngredients);
          
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
          console.log('✅ Proceeding with auto-fixed recipe');
        } else {
          // Only stop if auto-fix couldn't help
          console.log('❌ Auto-fix could not help');
          setIsOptimizing(false);
          
          toast({
            title: "⚠️ Cannot balance this recipe",
            description: (
              <div className="text-sm space-y-2">
                {feasibility.reason && (
                  <div className="text-xs font-medium text-destructive">
                    {feasibility.reason}
                  </div>
                )}
                <div className="text-xs font-semibold mb-1">💡 To fix this:</div>
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

      console.log('✅ Feasibility check passed');

      console.log('📊 Recipe ingredients:', optRows.map(r => ({
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
      console.log('⚙️ Calling RecipeBalancerV2.balance...');
      const calcMode = resolveMode(productType);
      const tolerance = calcMode === 'ice_cream' ? 3.0 : 2.0;
      
      console.log('🎯 Balancing with:', {
        tolerance,
        calcMode,
        targets,
        ingredientCount: optRows.length,
        totalWeight: optRows.reduce((sum, r) => sum + r.grams, 0)
      });
      
      const result = RecipeBalancerV2.balance(optRows, targets, availableIngredients, {
        maxIterations: 200, // Increased from 100
        tolerance,
        enableFeasibilityCheck: true,
        useLPSolver: true,
        productType: productType,
        enableScienceValidation: true,
        allowCoreDairy: true  // Allow adjusting milk/cream during balancing
      });

      console.log('✅ Balancing result:', {
        success: result.success,
        strategy: result.strategy,
        iterations: result.iterations,
        message: result.message
      });

      // PHASE 2: Enhanced error messages with actionable structured suggestions
      if (!result.success) {
        console.log('❌ Balancing failed, generating suggestions...');
        const currentMetrics = calcMetricsV2(optRows, { mode: calcMode });
        const structuredSuggestions: BalancingSuggestion[] = [];
        
        // Calculate ACTUAL gaps between current and target
        const fatGap = targets.fat_pct - currentMetrics.fat_pct;
        const msnfGap = targets.msnf_pct - currentMetrics.msnf_pct;
        const sugarGap = targets.totalSugars_pct - currentMetrics.totalSugars_pct;
        
        console.log('📊 Gaps:', { fatGap, msnfGap, sugarGap });
        
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
        
        console.log('💡 Generated suggestions:', structuredSuggestions);
        
        // Show structured suggestions dialog instead of toast
        showBalancingSuggestionsDialog(structuredSuggestions, currentMetrics, targets);
        setIsOptimizing(false);
        return;
      }
      
      // Success - show original toast logic
      if (result.success) {
        toast({
          title: '✅ Recipe Balanced',
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
        const recalculatedMetrics = calcMetricsV2(recalcRows, { mode: recalcMode });

        setMetrics(recalculatedMetrics);
        console.log('🔄 Metrics auto-recalculated post-balance:', recalculatedMetrics);

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
            ? '✅ Sorbet Balanced (no dairy)'
            : `✅ ${mode === 'ice_cream' ? 'Ice Cream' : mode === 'gelato' ? 'Gelato' : 'Kulfi'} Balanced`;
          
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
            title: `⚠️ ${result.message}`,
            description: (
              <div className="space-y-2 text-sm">
                {feasibility?.reason && (
                  <div className="text-xs font-medium text-destructive">{feasibility.reason}</div>
                )}
                
                {suggestions.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs font-semibold mb-1">💡 To fix this:</div>
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
      console.error('❌ Balancing error:', error);
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
    console.log(`🔍 Applying suggestion: ${suggestion.ingredientName} (${suggestion.ingredientId})`);
    
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
        console.log('  ✅ Exact match');
        return true;
      }
      
      // Check against all aliases
      const searchTerms = aliases[suggestion.ingredientId] || [];
      const matched = searchTerms.some(term => 
        ing.name.toLowerCase().includes(term.toLowerCase())
      );
      
      if (matched) console.log('  ✅ Alias match');
      return matched;
    });
    
    if (!ingredient) {
      console.log('  ❌ Ingredient not found in database');
      
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
        console.log('  🔧 Auto-creating ingredient with defaults:', defaults);
        
        // Auto-create ingredient in database
        const { data: newIng, error } = await supabase
          .from('ingredients')
          .insert(defaults)
          .select()
          .single();
        
        if (error || !newIng) {
          console.error('  ❌ Failed to auto-create:', error);
          toast({
            title: '❌ Failed to add ingredient',
            description: error?.message || 'Please add it manually from the ingredient database',
            variant: 'destructive'
          });
          return;
        }
        
        console.log('  ✅ Ingredient auto-created:', newIng);
        toast({
          title: '✨ Ingredient Added',
          description: `${defaults.name} was automatically added to your database`,
        });
        
        // Refresh ingredients list
        await refetchIngredients();
        
        // Re-apply suggestion with newly created ingredient - add small delay
        setTimeout(() => applySuggestion(suggestion), 500);
        return;
      }
      
      // Fallback: show manual add dialog
      toast({
        title: '❌ Ingredient Not Found',
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
        title: '✅ Suggestion Applied',
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
        title: '✅ Suggestion Applied',
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
      title: '✨ All Suggestions Applied',
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
        title: '✅ Ingredient Added',
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Calculate metrics if not already done
      if (!metrics) {
        calculateMetrics();
      }

      let recipeId = currentRecipeId;

      if (!recipeId) {
        // Create new recipe
        const { data: recipe, error: recipeError } = await supabase
          .from('recipes')
          .insert({
            recipe_name: recipeName,
            product_type: productType,
            user_id: user.id
          } as any)
          .select()
          .single();

        if (recipeError) throw recipeError;
        recipeId = recipe.id;
        setCurrentRecipeId(recipeId);
      } else {
        // Update existing recipe
        const { error: updateError } = await supabase
          .from('recipes')
          .update({ recipe_name: recipeName, product_type: productType })
          .eq('id', recipeId);

        if (updateError) throw updateError;

        // Delete existing rows (CASCADE will handle related data)
        await supabase.from('recipe_rows').delete().eq('recipe_id', recipeId);
        await supabase.from('calculated_metrics').delete().eq('recipe_id', recipeId);
      }

      // Insert recipe rows
      const { error: rowsError } = await supabase
        .from('recipe_rows')
        .insert(
          rows.map(r => ({
            recipe_id: recipeId,
            ingredient: r.ingredient,
            quantity_g: r.quantity_g,
            sugars_g: r.sugars_g,
            fat_g: r.fat_g,
            msnf_g: r.msnf_g,
            other_solids_g: r.other_solids_g,
            total_solids_g: r.total_solids_g
          }))
        );

      if (rowsError) throw rowsError;

      // Insert calculated metrics
      if (metrics) {
        const { error: metricsError } = await supabase
          .from('calculated_metrics')
          .insert({
            recipe_id: recipeId,
            total_quantity_g: metrics.total_g,
            total_sugars_g: metrics.totalSugars_g,
            total_fat_g: metrics.fat_g,
            total_msnf_g: metrics.msnf_g,
            total_other_solids_g: metrics.other_g,
            total_solids_g: metrics.ts_g,
            sugars_pct: metrics.totalSugars_pct,
            fat_pct: metrics.fat_pct,
            msnf_pct: metrics.msnf_pct,
            other_solids_pct: metrics.other_pct,
            total_solids_pct: metrics.ts_pct,
            sp: 0, // Legacy field
            pac: 0, // Legacy field
            fpdt: metrics.fpdt,
            pod_index: metrics.pod_index
          } as any);

        if (metricsError) throw metricsError;
      }

      toast({
        title: 'Recipe saved',
        description: `"${recipeName}" has been saved successfully`
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
    setRecipeName('');
    setProductType('ice_cream');
    setRows([]);
    setMetrics(null);
    setCurrentRecipeId(null);
  };

  /**
   * Apply 70/10/20 sugar preset (optimal blend)
   * 70% Sucrose, 10% Dextrose, 20% Glucose Syrup
   */
  const applySugarPreset = () => {
    // Find sugar ingredients
    const sucrose = availableIngredients.find(i => 
      i.name.toLowerCase().includes('sucrose') && (i.sugars_pct || 0) >= 95
    );
    const dextrose = availableIngredients.find(i => 
      i.name.toLowerCase().includes('dextrose') && (i.sugars_pct || 0) >= 95
    );
    const glucoseSyrup = availableIngredients.find(i => 
      (i.name.toLowerCase().includes('glucose') || i.name.toLowerCase().includes('syrup')) && 
      (i.sugars_pct || 0) >= 70
    );

    if (!sucrose || !dextrose || !glucoseSyrup) {
      toast({
        title: 'Missing Sugar Ingredients',
        description: 'Need Sucrose, Dextrose, and Glucose Syrup in database',
        variant: 'destructive'
      });
      return;
    }

    // Calculate current total sugars
    const currentTotalSugars = rows.reduce((sum, r) => sum + r.sugars_g, 0);
    const targetSugars = currentTotalSugars > 0 ? currentTotalSugars : 180; // Default 180g if none

    // Calculate preset amounts (70/10/20)
    const sucroseAmount = targetSugars * 0.70;
    const dextroseAmount = targetSugars * 0.10;
    const glucoseAmount = targetSugars * 0.20;

    // Remove existing sugar rows
    const nonSugarRows = rows.filter(r => 
      !r.ingredientData || (r.ingredientData.sugars_pct || 0) < 90
    );

    // Add preset sugars
    const newRows: IngredientRow[] = [
      ...nonSugarRows,
      {
        ingredientData: sucrose,
        ingredient: sucrose.name,
        quantity_g: sucroseAmount,
        sugars_g: sucroseAmount * (sucrose.sugars_pct || 100) / 100,
        fat_g: 0,
        msnf_g: 0,
        other_solids_g: 0,
        total_solids_g: sucroseAmount * (sucrose.sugars_pct || 100) / 100
      },
      {
        ingredientData: dextrose,
        ingredient: dextrose.name,
        quantity_g: dextroseAmount,
        sugars_g: dextroseAmount * (dextrose.sugars_pct || 100) / 100,
        fat_g: 0,
        msnf_g: 0,
        other_solids_g: 0,
        total_solids_g: dextroseAmount * (dextrose.sugars_pct || 100) / 100
      },
      {
        ingredientData: glucoseSyrup,
        ingredient: glucoseSyrup.name,
        quantity_g: glucoseAmount,
        sugars_g: glucoseAmount * (glucoseSyrup.sugars_pct || 75) / 100,
        fat_g: 0,
        msnf_g: 0,
        other_solids_g: 0,
        total_solids_g: glucoseAmount * (glucoseSyrup.sugars_pct || 75) / 100
      }
    ];

    setRows(newRows);
    
    toast({
      title: '✅ Sugar Preset Applied',
      description: `70% Sucrose (${sucroseAmount.toFixed(0)}g), 10% Dextrose (${dextroseAmount.toFixed(0)}g), 20% Glucose (${glucoseAmount.toFixed(0)}g)`,
      duration: 4000
    });

    // Auto-recalculate
    setTimeout(() => calculateMetrics(), 100);
  };

  // Version history feature removed in Phase 2 cleanup

  return (
    <div className="space-y-6">
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
      
      {!isAuthenticated && (
        <Alert>
          <AlertDescription>
            Please <a href="/auth" className="font-medium underline">sign in</a> to save recipes
          </AlertDescription>
        </Alert>
      )}

      {/* Base Sets Quick Start */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Quick Start with Base Sets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadBaseSet('ice_cream')}
            >
              Classic Ice Cream Base
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadBaseSet('gelato')}
            >
              Gelato Base
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadBaseSet('sorbet')}
            >
              Fruit Sorbet Base
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Recipe Details
            <Badge variant="outline" className="ml-auto">
              {productType === 'ice_cream' ? '🍦 Ice Cream' : productType === 'gelato' ? '🍨 Gelato' : productType === 'sorbet' ? '🍧 Sorbet' : '🧪 Paste'}
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
              />
            </div>
            <div>
              <Label htmlFor="product-type">Product Type</Label>
              <Select value={productType} onValueChange={setProductType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ice_cream">🍦 Ice Cream</SelectItem>
                  <SelectItem value="gelato">🍨 Gelato</SelectItem>
                  <SelectItem value="sorbet">🍧 Sorbet</SelectItem>
                  <SelectItem value="paste">🧪 Paste</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Basic/Advanced Mode Toggle */}
          <div className="flex items-center justify-between pt-2 border-t">
            <Label htmlFor="calculator-mode" className="text-sm text-muted-foreground">
              Calculator Mode
            </Label>
            <div className="flex items-center gap-2">
              <span className={cn("text-xs transition-colors", basicMode ? "font-semibold text-foreground" : "text-muted-foreground")}>
                Basic
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2"
                onClick={() => {
                  const newMode = !basicMode;
                  setBasicMode(newMode);
                  localStorage.setItem('calculator-mode', newMode ? 'basic' : 'advanced');
                  toast({
                    title: newMode ? '📊 Basic Mode' : '🔧 Advanced Mode',
                    description: newMode 
                      ? 'Showing essential calculator features only' 
                      : 'All optimization and analysis tools available'
                  });
                }}
              >
                {basicMode ? '➡️' : '⬅️'}
              </Button>
              <span className={cn("text-xs transition-colors", !basicMode ? "font-semibold text-foreground" : "text-muted-foreground")}>
                Advanced
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Core Metrics Panel (Basic Mode) */}
      {basicMode && metrics && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Core Mix Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {renderCoreMetric('Fat', metrics.fat_pct, [6, 16])}
              {renderCoreMetric('MSNF', metrics.msnf_pct, [7, 12])}
              {renderCoreMetric('Sugar', metrics.totalSugars_pct, [14, 24])}
              {renderCoreMetric('Total Solids', metrics.ts_pct, [30, 42])}
              {renderCoreMetric('Water', 100 - metrics.ts_pct, [58, 70])}
            </div>
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
                    value={targetBatchSize || totalBatch}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (val > 0) scaleRecipe(val);
                    }}
                    className="w-28"
                    placeholder="grams"
                  />
                  <span className="text-sm text-muted-foreground">g</span>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="servings" className="text-sm whitespace-nowrap">Servings:</Label>
                  <Input
                    id="servings"
                    type="number"
                    value={servings}
                    onChange={(e) => setServings(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20"
                    min="1"
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
        <CardHeader>
          <CardTitle>Ingredients</CardTitle>
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTemplates(!showTemplates)}
                className="gap-2"
              >
                <BookOpen className="h-4 w-4" />
                {showTemplates ? 'Hide Templates' : 'Browse Templates'}
              </Button>
              
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
            {rows.length === 0 && !showTemplates && (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-2">
                  Start with a recipe template or build from scratch
                </p>
                <p className="text-sm text-muted-foreground">
                  Click "Browse Templates" above or add ingredients manually below
                </p>
              </div>
            )}
            
            {/* Tip for choosing ingredients from database */}
            {rows.length > 0 && (
              <Alert className="mb-4 bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800">
                <AlertDescription className="text-sm flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span>
                    <strong>Tip:</strong> Click ingredient cells to search and select from the database. Status badges show if each row is ready for calculations.
                  </span>
                </AlertDescription>
              </Alert>
            )}
            
            {showTemplates && (
              <div className="mb-6">
                <RecipeTemplates
                  onSelectTemplate={loadTemplate}
                  onStartFromScratch={handleStartFromScratch}
                  availableIngredients={availableIngredients}
                />
              </div>
            )}

            {!showTemplates && (
              <>
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
              <TableBody>
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
                              onClick={() => setSearchOpen(index)}
                              className="w-full justify-between font-normal"
                            >
                              <span className={row.ingredient ? "text-foreground" : "text-muted-foreground"}>
                                {row.ingredient || "Select ingredient..."}
                              </span>
                              <Search className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full max-w-[400px] p-0 bg-popover border shadow-lg" align="start" sideOffset={8}>
                          {loadingIngredients ? (
                            <div className="p-4 text-center">
                              <p className="text-sm text-muted-foreground">Loading ingredients...</p>
                            </div>
                          ) : availableIngredients.length === 0 ? (
                            <div className="p-4 text-center space-y-3">
                              <p className="text-sm text-destructive">No ingredients found</p>
                              <AddIngredientDialog 
                                onIngredientAdded={(ing) => {
                                  handleIngredientSelect(index, ing);
                                  setSearchOpen(null);
                                }}
                              />
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              <SmartIngredientSearch
                                ingredients={availableIngredients}
                                onSelect={(ing) => handleIngredientSelect(index, ing)}
                                open={searchOpen === index}
                                onOpenChange={(open) => setSearchOpen(open ? index : null)}
                              />
                              <div className="border-t p-2 bg-muted/50">
                                <Button 
                                  type="button"
                                  variant="ghost" 
                                  size="sm" 
                                  className="w-full justify-start text-sm"
                                  onClick={() => {
                                    setSearchOpen(null);
                                    setAddIngredientIndex(index);
                                  }}
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Can't find it? Add new ingredient
                                </Button>
                              </div>
                            </div>
                          )}
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
                    </div>
                  </TableCell>
                <TableCell className="min-w-[220px]">
                  <div className="flex items-center gap-2">
                    <QuantityInput
                      value={row.quantity_g}
                      onChange={(val) => updateRow(index, 'quantity_g', val)}
                      step={FIXED_STEP_SIZE}
                      rowIndex={index}
                      className="text-lg font-bold"
                    />
                    <Badge variant="secondary" className="text-xs whitespace-nowrap">
                      ±{FIXED_STEP_SIZE}g
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="min-w-[120px]">
                  <Input
                    type="number"
                    value={typeof row.sugars_g === 'number' && !isNaN(row.sugars_g) ? row.sugars_g.toFixed(1) : '0.0'}
                    readOnly
                    className="bg-muted/50 text-muted-foreground cursor-not-allowed font-mono text-sm"
                    title="Auto-calculated from ingredient composition"
                  />
                </TableCell>
                <TableCell className="min-w-[120px]">
                  <Input
                    type="number"
                    value={typeof row.fat_g === 'number' && !isNaN(row.fat_g) ? row.fat_g.toFixed(1) : '0.0'}
                    readOnly
                    className="bg-muted/50 text-muted-foreground cursor-not-allowed font-mono text-sm"
                    title="Auto-calculated from ingredient composition"
                  />
                </TableCell>
                <TableCell className="min-w-[120px]">
                  <Input
                    type="number"
                    value={typeof row.msnf_g === 'number' && !isNaN(row.msnf_g) ? row.msnf_g.toFixed(1) : '0.0'}
                    readOnly
                    className="bg-muted/50 text-muted-foreground cursor-not-allowed font-mono text-sm"
                    title="Auto-calculated from ingredient composition"
                  />
                </TableCell>
                <TableCell className="min-w-[120px]">
                  <Input
                    type="number"
                    value={typeof row.other_solids_g === 'number' && !isNaN(row.other_solids_g) ? row.other_solids_g.toFixed(1) : '0.0'}
                    readOnly
                    className="bg-muted/50 text-muted-foreground cursor-not-allowed font-mono text-sm"
                    title="Auto-calculated from ingredient composition"
                  />
                </TableCell>
                <TableCell className="min-w-[140px]">
                  <Input
                    type="number"
                    value={typeof row.total_solids_g === 'number' && !isNaN(row.total_solids_g) ? row.total_solids_g.toFixed(1) : '0.0'}
                    readOnly
                    className="bg-muted/50 text-muted-foreground cursor-not-allowed font-mono text-sm"
                    title="Auto-calculated from ingredient composition"
                  />
                </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => removeRow(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
            
            <div className="flex gap-2 flex-wrap">
              <Button onClick={addRow} variant="outline" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Ingredient
              </Button>
              <Button onClick={calculateMetrics} variant="default" size="sm">
                <Calculator className="mr-2 h-4 w-4" />
                Calculate
              </Button>
              
              {/* Advanced features - hidden in basic mode */}
              {!basicMode && (
                <>
                  <Button 
                    onClick={balanceRecipe} 
                    disabled={isOptimizing || rows.length === 0}
                    variant="secondary"
                    size="sm"
                  >
                    {isOptimizing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                    Balance Recipe
                  </Button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        onClick={applySugarPreset}
                        disabled={rows.length === 0}
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
                <Button onClick={saveRecipe} disabled={isSaving || !isAuthenticated} size="sm">
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save
                </Button>
              </div>
              
              <Button onClick={clearRecipe} variant="ghost" size="sm">
                Clear
              </Button>
              {rows.length === 0 && (
                <Button onClick={() => setShowTemplates(true)} variant="outline" size="sm">
                  <BookOpen className="mr-2 h-4 w-4" />
                  Browse Templates
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowDebugPanel(!showDebugPanel)}
              >
                <Bug className="mr-2 h-4 w-4" />
                {showDebugPanel ? 'Hide' : 'Show'} Debug
              </Button>
            </div>
            </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Debug Panel */}
      {showDebugPanel && balancingDiagnostics && (
        <Card className="border-blue-500">
          <CardHeader>
            <CardTitle className="text-sm">🐛 Balancing Diagnostics</CardTitle>
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
                {balancingDiagnostics.hasWater ? '✓' : '✗'} Water/Diluent (Recipe or DB has 80%+ water)
              </div>
              <div className={balancingDiagnostics.hasFatSource ? 'text-green-600' : 'text-red-600'}>
                {balancingDiagnostics.hasFatSource ? '✓' : '✗'} Fat Source (Recipe has 2%+ fat or DB has cream/butter)
              </div>
              <div className={balancingDiagnostics.hasMSNFSource ? 'text-green-600' : 'text-red-600'}>
                {balancingDiagnostics.hasMSNFSource ? '✓' : '✗'} MSNF Source (Recipe has 5%+ MSNF or DB has SMP)
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
                      title: "✅ Database Healthy",
                      description: "All essential ingredients available for balancing",
                      duration: 3000
                    });
                  } else {
                    toast({
                      title: "⚠️ Database Missing Ingredients",
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
                    {balancingDiagnostics.dbHealth.hasWater ? '✓' : '✗'} Water (95%+ water)
                  </div>
                  <div className={balancingDiagnostics.dbHealth.hasCream35OrButter ? 'text-green-600' : 'text-red-600'}>
                    {balancingDiagnostics.dbHealth.hasCream35OrButter ? '✓' : '✗'} Heavy Cream 35%+ or Butter
                  </div>
                  <div className={balancingDiagnostics.dbHealth.hasSMP ? 'text-green-600' : 'text-red-600'}>
                    {balancingDiagnostics.dbHealth.hasSMP ? '✓' : '✗'} Skim Milk Powder (85%+ MSNF)
                  </div>
                </div>
              )}
            </div>

            <Separator />
            
            {/* SE/AFP Audit Panel */}
            {metrics && rows.length > 0 && (
              <div className="space-y-2">
                <div className="font-semibold">🔬 SE/AFP Audit (Sugar Analysis):</div>
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
                          <div>💡 SE = Sweetness Power × Sugar Weight</div>
                          <div>💡 AFP = PAC Coefficient × Sugar Weight</div>
                          <div>💡 POD = Protein/Other/Dairy balance index</div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* PHASE 1: DB Health Check - Before metrics */}
      {rows.length > 0 && (
        <div className="mt-4">
          <DatabaseHealthIndicator 
            availableIngredients={availableIngredients}
            compact={true}
          />
        </div>
      )}

      {metrics && (
        <Card data-metrics-card>
          <CardHeader>
            <CardTitle>Calculated Metrics (Science v2.1)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Batch</p>
                <p className="text-2xl font-bold">{metrics.total_g.toFixed(1)}g</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Sugars</p>
                <Badge variant="outline">{metrics.totalSugars_pct.toFixed(1)}%</Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fat</p>
                <Badge variant={
                  metrics.fat_pct >= getConstraints().fat.optimal[0] && 
                  metrics.fat_pct <= getConstraints().fat.optimal[1] 
                    ? 'default' 
                    : metrics.fat_pct >= getConstraints().fat.acceptable[0] && 
                      metrics.fat_pct <= getConstraints().fat.acceptable[1]
                    ? 'secondary'
                    : 'destructive'
                }>
                  {metrics.fat_pct.toFixed(1)}%
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">MSNF</p>
                <Badge variant={
                  metrics.msnf_pct >= getConstraints().msnf.optimal[0] && 
                  metrics.msnf_pct <= getConstraints().msnf.optimal[1]
                    ? 'default'
                    : metrics.msnf_pct >= getConstraints().msnf.acceptable[0] && 
                      metrics.msnf_pct <= getConstraints().msnf.acceptable[1]
                    ? 'secondary'
                    : 'destructive'
                }>
                  {metrics.msnf_pct.toFixed(1)}%
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-sm text-muted-foreground">Protein</p>
                <Badge variant="outline">{metrics.protein_pct.toFixed(1)}%</Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Lactose</p>
                <Badge variant="outline">{metrics.lactose_pct.toFixed(1)}%</Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Solids</p>
                <div className="flex items-center gap-2">
                  <Badge variant={
                    metrics.ts_pct >= getConstraints().totalSolids.optimal[0] && 
                    metrics.ts_pct <= getConstraints().totalSolids.optimal[1]
                      ? 'default'
                      : metrics.ts_pct >= getConstraints().totalSolids.acceptable[0] && 
                        metrics.ts_pct <= getConstraints().totalSolids.acceptable[1]
                      ? 'secondary'
                      : 'destructive'
                  }>
                    {metrics.ts_pct.toFixed(1)}%
                  </Badge>
                  {metrics.overrunPrediction && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="text-xs">
                            ~{metrics.overrunPrediction.estimatedPct.toFixed(0)}% overrun
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <div className="space-y-1 text-xs">
                            <div className="font-semibold">{metrics.overrunPrediction.category}</div>
                            <div>Expected: {metrics.overrunPrediction.range[0]}-{metrics.overrunPrediction.range[1]}%</div>
                            <div className="text-muted-foreground">{metrics.overrunPrediction.notes[0]}</div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Water</p>
                <Badge variant="outline">{metrics.water_pct.toFixed(1)}%</Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-sm text-muted-foreground">FPDT (Freezing Point)</p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant={
                        metrics.fpdt >= getConstraints().fpdt.optimal[0] && 
                        metrics.fpdt <= getConstraints().fpdt.optimal[1]
                          ? 'default'
                          : metrics.fpdt >= getConstraints().fpdt.acceptable[0] && 
                            metrics.fpdt <= getConstraints().fpdt.acceptable[1]
                          ? 'secondary'
                          : 'destructive'
                      }>
                        {metrics.fpdt.toFixed(2)}°C
                      </Badge>
                    </TooltipTrigger>
                    {metrics.servingTemp && (
                      <TooltipContent className="max-w-sm">
                        <div className="space-y-2 text-xs">
                          <div className="font-semibold">🌡️ Serving Temperature Guide</div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <div className="text-muted-foreground">Draw Temp:</div>
                              <div className="font-medium">{metrics.servingTemp.drawTempC}°C</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Serve Temp:</div>
                              <div className="font-medium">{metrics.servingTemp.serveTempC}°C</div>
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Hardening:</div>
                            <div>{metrics.servingTemp.hardeningTimeHours}h in blast freezer</div>
                          </div>
                          <div className="text-muted-foreground">{metrics.servingTemp.notes[0]}</div>
                        </div>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">POD Index (Sweetness)</p>
                <Badge variant="outline">{metrics.pod_index.toFixed(0)}</Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">SE (Sucrose Equiv)</p>
                <Badge variant="outline">{metrics.se_g.toFixed(1)}g</Badge>
              </div>
            </div>

            {metrics.warnings.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-semibold text-destructive">⚠️ Warnings & Recommendations:</p>
                {metrics.warnings.map((warning, i) => (
                  <Alert key={i} variant={warning.includes('⚠️') ? 'destructive' : 'default'}>
                    <AlertDescription className="text-xs">{warning}</AlertDescription>
                  </Alert>
                ))}
              </div>
            )}

            {metrics.warnings.length === 0 && (
              <Alert>
                <AlertDescription className="text-sm font-medium text-green-700">
          ✅ All parameters within target ranges! Recipe is balanced.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {scienceValidation && scienceValidation.length > 0 && (
        <ScienceValidationPanel 
          validations={scienceValidation} 
          qualityScore={qualityScore}
        />
      )}

      {/* PHASE 2: Debug Panel - Below metrics */}
      {balancingDiagnostics && (
        <BalancingDebugPanel 
          diagnostics={balancingDiagnostics}
          lastStrategy={lastBalanceStrategy}
        />
      )}

      {/* Advanced Tools Section - Hidden in Basic Mode */}
      {rows.length > 0 && !basicMode && (
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
                      <h4 className="font-semibold">🤖 AI Engine Features</h4>
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
                  Got it ✓
                </Button>
              )}
            </div>
            {showAdvancedToolsTutorial && (
              <Alert className="mt-3 bg-primary/5 border-primary/20">
                <AlertDescription className="text-sm">
                  <strong>🎉 AI Engine features are now here!</strong>
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
                    🎯 Optimization Tools
                  </AccordionTrigger>
                  <AccordionContent>
                    <Tabs defaultValue="pairings" className="w-full">
                      <TabsList className="w-full h-auto flex flex-wrap gap-1 p-2 bg-background/80 backdrop-blur-sm">
                        <TabsTrigger value="pairings" className="flex-1 min-w-[140px] text-xs whitespace-nowrap">
                          🍫 Pairings
                        </TabsTrigger>
                        <TabsTrigger value="sugar-blend" className="flex-1 min-w-[140px] text-xs whitespace-nowrap">
                          🍬 Sugar Blend
                        </TabsTrigger>
                        <TabsTrigger value="ai-optimize" className="flex-1 min-w-[140px] text-xs whitespace-nowrap">
                          🤖 AI Optimize
                          <Badge variant="secondary" className="ml-1 text-[10px]">Popular</Badge>
                        </TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="pairings" className="mt-4">
                        <PairingsDrawer
                          selectedIngredient={selectedIngredientForPairing}
                          availableIngredients={availableIngredients}
                          currentMetrics={metrics}
                          onAddIngredient={(ing, percentage) => {
                            const totalMass = rows.reduce((sum, r) => sum + r.quantity_g, 0) || 1000;
                            const gramsToAdd = (percentage / 100) * totalMass;
                            
                            const existingRow = rows.find(r => r.ingredient === ing.name);
                            if (existingRow) {
                              setRows(rows.map(r => 
                                r.ingredient === ing.name 
                                  ? { ...r, quantity_g: r.quantity_g + gramsToAdd }
                                  : r
                              ));
                            } else {
                              const newRow: IngredientRow = {
                                ingredientData: ing,
                                ingredient: ing.name,
                                quantity_g: gramsToAdd,
                                sugars_g: ((ing.sugars_pct ?? 0) / 100) * gramsToAdd,
                                fat_g: ((ing.fat_pct ?? 0) / 100) * gramsToAdd,
                                msnf_g: ((ing.msnf_pct ?? 0) / 100) * gramsToAdd,
                                other_solids_g: ((ing.other_solids_pct ?? 0) / 100) * gramsToAdd,
                                total_solids_g: 0
                              };
                              newRow.total_solids_g = newRow.sugars_g + newRow.fat_g + newRow.msnf_g + newRow.other_solids_g;
                              setRows([...rows, newRow]);
                            }
                            
                            toast({
                              title: "Pairing Added",
                              description: `${ing.name} added at ${percentage}% (${gramsToAdd.toFixed(0)}g)`
                            });
                          }}
                        />
                        <div className="mt-4">
                          <Label className="text-sm font-semibold mb-2 block">Select ingredient to analyze pairings:</Label>
                          <Select 
                            value={selectedIngredientForPairing?.id || ''} 
                            onValueChange={(id) => {
                              const ing = availableIngredients.find(i => i.id === id);
                              setSelectedIngredientForPairing(ing || null);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Choose an ingredient..." />
                            </SelectTrigger>
                            <SelectContent>
                              {rows.map((row) => row.ingredientData && (
                                <SelectItem key={row.ingredientData.id} value={row.ingredientData.id}>
                                  {row.ingredientData.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </TabsContent>

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
                        {metrics && (
                          <AIOptimization
                            allTargetsMet={metrics.warnings.length === 0}
                            suggestions={[]}
                            isOptimizing={isOptimizing}
                            currentRows={rows
                              .filter(r => r.ingredientData)
                              .map(r => ({
                                ing: r.ingredientData!,
                                grams: r.quantity_g,
                                min: r.quantity_g * 0.5,
                                max: r.quantity_g * 1.5
                              }))}
                            targets={(() => {
                              const mode = resolveMode(productType);
                              const constraints = PRODUCT_CONSTRAINTS[productKey(mode, rows)];
                              return {
                                fat_pct: (constraints.fat.optimal[0] + constraints.fat.optimal[1]) / 2,
                                msnf_pct: (constraints.msnf.optimal[0] + constraints.msnf.optimal[1]) / 2,
                                ts_pct: (constraints.totalSolids.optimal[0] + constraints.totalSolids.optimal[1]) / 2
                              };
                            })()}
                            onApplyResult={(optimizedRows: Row[]) => {
                              const newRows = optimizedRows.map(opt => {
                                const ing = opt.ing;
                                return {
                                  ingredientData: ing,
                                  ingredient: ing.name,
                                  quantity_g: opt.grams,
                                  sugars_g: ((ing.sugars_pct ?? 0) / 100) * opt.grams,
                                  fat_g: ((ing.fat_pct ?? 0) / 100) * opt.grams,
                                  msnf_g: ((ing.msnf_pct ?? 0) / 100) * opt.grams,
                                  other_solids_g: ((ing.other_solids_pct ?? 0) / 100) * opt.grams,
                                  total_solids_g: 0
                                } as IngredientRow;
                              });

                              newRows.forEach(r => {
                                r.total_solids_g = r.sugars_g + r.fat_g + r.msnf_g + r.other_solids_g;
                              });

                              setRows(newRows);
                              toast({
                                title: "AI Optimization Applied",
                                description: "Recipe optimized using AI"
                              });
                            }}
                            onAutoOptimize={async (algorithm: OptimizerConfig['algorithm']) => {
                              setIsOptimizing(true);
                              try {
                                const rowsForOptimize: Row[] = rows
                                  .filter(r => r.ingredientData)
                                  .map(r => ({
                                    ing: r.ingredientData!,
                                    grams: r.quantity_g,
                                    min: r.quantity_g * 0.5,
                                    max: r.quantity_g * 1.5
                                  }));

                                const mode = resolveMode(productType);
                                const constraints = PRODUCT_CONSTRAINTS[productKey(mode, rows)];
                                
                                const targets = {
                                  fat_pct: (constraints.fat.optimal[0] + constraints.fat.optimal[1]) / 2,
                                  msnf_pct: (constraints.msnf.optimal[0] + constraints.msnf.optimal[1]) / 2,
                                  ts_pct: (constraints.totalSolids.optimal[0] + constraints.totalSolids.optimal[1]) / 2
                                };

                                const optimized = advancedOptimize(rowsForOptimize, targets, {
                                  algorithm,
                                  maxIterations: algorithm === 'hybrid' ? 150 : 200,
                                  populationSize: 40
                                });

                                const newRows = optimized.map(opt => {
                                  const ing = opt.ing;
                                  return {
                                    ingredientData: ing,
                                    ingredient: ing.name,
                                    quantity_g: opt.grams,
                                    sugars_g: ((ing.sugars_pct ?? 0) / 100) * opt.grams,
                                    fat_g: ((ing.fat_pct ?? 0) / 100) * opt.grams,
                                    msnf_g: ((ing.msnf_pct ?? 0) / 100) * opt.grams,
                                    other_solids_g: ((ing.other_solids_pct ?? 0) / 100) * opt.grams,
                                    total_solids_g: 0
                                  } as IngredientRow;
                                });

                                newRows.forEach(r => {
                                  r.total_solids_g = r.sugars_g + r.fat_g + r.msnf_g + r.other_solids_g;
                                });

                                setRows(newRows);
                                toast({
                                  title: "AI Optimization Complete",
                                  description: `Recipe optimized using ${algorithm} algorithm`
                                });
                              } catch (error) {
                                console.error('AI optimization error:', error);
                                toast({
                                  title: "Optimization Failed",
                                  description: error instanceof Error ? error.message : "Failed to optimize recipe",
                                  variant: "destructive"
                                });
                              } finally {
                                setIsOptimizing(false);
                              }
                            }}
                          />
                        )}
                      </TabsContent>
                    </Tabs>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="analysis">
                  <AccordionTrigger className="text-base font-semibold">
                    🔬 Analysis Tools
                  </AccordionTrigger>
                  <AccordionContent>
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                      <TabsList className="w-full h-auto flex flex-wrap gap-1 p-2 bg-background/80 backdrop-blur-sm">
                        <TabsTrigger value="ai-insights" className="flex-1 min-w-[140px] text-xs whitespace-nowrap">
                          🤖 AI Insights
                        </TabsTrigger>
                        <TabsTrigger value="analyzer" className="flex-1 min-w-[140px] text-xs whitespace-nowrap">
                          🔬 Analyzer
                        </TabsTrigger>
                        <TabsTrigger value="temperature" className="flex-1 min-w-[140px] text-xs whitespace-nowrap">
                          🌡️ Temperature
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="ai-insights" className="mt-4">
                        <AIInsightsPanel
                          recipe={rows.map(r => ({
                            ingredientId: r.ingredientData?.id || r.ingredient,
                            grams: r.quantity_g
                          }))}
                          metrics={metrics}
                          productType={productType}
                        />
                      </TabsContent>

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
                    🛠️ Utilities
                  </AccordionTrigger>
                  <AccordionContent>
                    <Tabs defaultValue="reverse" className="w-full">
                      <TabsList className="w-full h-auto flex flex-wrap gap-1 p-2 bg-background/80 backdrop-blur-sm">
                        <TabsTrigger value="reverse" className="flex-1 min-w-[140px] text-xs whitespace-nowrap">
                          🔄 Reverse Engineer
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="reverse" className="mt-4">
                        <ReverseEngineer />
                      </TabsContent>
                    </Tabs>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            ) : (
              // Desktop: Single tab row with all tools
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full h-auto flex flex-wrap lg:grid lg:grid-cols-7 gap-1 lg:gap-2 p-2 bg-background/80 backdrop-blur-sm">
                  <TabsTrigger value="ai-insights" className="flex-1 min-w-[100px] text-xs lg:text-sm whitespace-nowrap">
                    🤖 AI Insights
                    <Badge variant="secondary" className="ml-1 text-[10px]">NEW</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="pairings" className="flex-1 min-w-[100px] text-xs lg:text-sm whitespace-nowrap">
                    🍫 Pairings
                  </TabsTrigger>
                  <TabsTrigger value="temperature" className="flex-1 min-w-[100px] text-xs lg:text-sm whitespace-nowrap">
                    🌡️ Temperature
                  </TabsTrigger>
                  <TabsTrigger value="reverse" className="flex-1 min-w-[100px] text-xs lg:text-sm whitespace-nowrap">
                    🔄 Reverse
                  </TabsTrigger>
                  <TabsTrigger value="analyzer" className="flex-1 min-w-[100px] text-xs lg:text-sm whitespace-nowrap">
                    🔬 Analyzer
                  </TabsTrigger>
                  <TabsTrigger value="sugar-blend" className="flex-1 min-w-[100px] text-xs lg:text-sm whitespace-nowrap">
                    🍬 Sugar Blend
                  </TabsTrigger>
                  <TabsTrigger value="ai-optimize" className="flex-1 min-w-[100px] text-xs lg:text-sm whitespace-nowrap">
                    🤖 AI Optimize
                    <Badge variant="secondary" className="ml-1 text-[10px]">Popular</Badge>
                  </TabsTrigger>
                </TabsList>

              <TabsContent value="ai-insights" className="mt-4">
                <AIInsightsPanel
                  recipe={rows.map(r => ({
                    ingredientId: r.ingredientData?.id || r.ingredient,
                    grams: r.quantity_g
                  }))}
                  metrics={metrics}
                  productType={productType}
                />
              </TabsContent>

              <TabsContent value="pairings" className="mt-4">
                {rows.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p className="text-lg font-semibold mb-2">No Ingredients Added</p>
                    <p className="text-sm">Add ingredients to your recipe to analyze flavor pairings</p>
                  </div>
                ) : (
                <>
                <PairingsDrawer
                  selectedIngredient={selectedIngredientForPairing}
                  availableIngredients={availableIngredients}
                  currentMetrics={metrics}
                  onAddIngredient={(ing, percentage) => {
                    const totalMass = rows.reduce((sum, r) => sum + r.quantity_g, 0) || 1000;
                    const gramsToAdd = (percentage / 100) * totalMass;
                    
                    const existingRow = rows.find(r => r.ingredient === ing.name);
                    if (existingRow) {
                      setRows(rows.map(r => 
                        r.ingredient === ing.name 
                          ? { ...r, quantity_g: r.quantity_g + gramsToAdd }
                          : r
                      ));
                    } else {
                      const newRow: IngredientRow = {
                        ingredientData: ing,
                        ingredient: ing.name,
                        quantity_g: gramsToAdd,
                        sugars_g: ((ing.sugars_pct ?? 0) / 100) * gramsToAdd,
                        fat_g: ((ing.fat_pct ?? 0) / 100) * gramsToAdd,
                        msnf_g: ((ing.msnf_pct ?? 0) / 100) * gramsToAdd,
                        other_solids_g: ((ing.other_solids_pct ?? 0) / 100) * gramsToAdd,
                        total_solids_g: 0
                      };
                      newRow.total_solids_g = newRow.sugars_g + newRow.fat_g + newRow.msnf_g + newRow.other_solids_g;
                      setRows([...rows, newRow]);
                    }
                    
                    toast({
                      title: "Pairing Added",
                      description: `${ing.name} added at ${percentage}% (${gramsToAdd.toFixed(0)}g)`
                    });
                  }}
                />
                <div className="mt-4">
                  <Label className="text-sm font-semibold mb-2 block">Select ingredient to analyze pairings:</Label>
                  <Select 
                    value={selectedIngredientForPairing?.id || ''} 
                    onValueChange={(id) => {
                      const ing = availableIngredients.find(i => i.id === id);
                      setSelectedIngredientForPairing(ing || null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an ingredient..." />
                    </SelectTrigger>
                    <SelectContent>
                      {rows.map((row) => row.ingredientData && (
                        <SelectItem key={row.ingredientData.id} value={row.ingredientData.id}>
                          {row.ingredientData.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                </>
                )}
              </TabsContent>

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
                <ReverseEngineer />
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
                {metrics && (
                  <AIOptimization
                    allTargetsMet={metrics.warnings.length === 0}
                    suggestions={[]}
                    isOptimizing={isOptimizing}
                    currentRows={rows
                      .filter(r => r.ingredientData)
                      .map(r => ({
                        ing: r.ingredientData!,
                        grams: r.quantity_g,
                        min: r.quantity_g * 0.5,
                        max: r.quantity_g * 1.5
                      }))}
                    targets={(() => {
                      const mode = resolveMode(productType);
                      const constraints = PRODUCT_CONSTRAINTS[productKey(mode, rows)];
                      return {
                        fat_pct: (constraints.fat.optimal[0] + constraints.fat.optimal[1]) / 2,
                        msnf_pct: (constraints.msnf.optimal[0] + constraints.msnf.optimal[1]) / 2,
                        ts_pct: (constraints.totalSolids.optimal[0] + constraints.totalSolids.optimal[1]) / 2
                      };
                    })()}
                    onApplyResult={(optimizedRows: Row[]) => {
                      // Convert optimized Row[] back to IngredientRow format
                      const newRows = optimizedRows.map(opt => {
                        const ing = opt.ing;
                        return {
                          ingredientData: ing,
                          ingredient: ing.name,
                          quantity_g: opt.grams,
                          sugars_g: ((ing.sugars_pct ?? 0) / 100) * opt.grams,
                          fat_g: ((ing.fat_pct ?? 0) / 100) * opt.grams,
                          msnf_g: ((ing.msnf_pct ?? 0) / 100) * opt.grams,
                          other_solids_g: ((ing.other_solids_pct ?? 0) / 100) * opt.grams,
                          total_solids_g: 0
                        } as IngredientRow;
                      });

                      newRows.forEach(r => {
                        r.total_solids_g = r.sugars_g + r.fat_g + r.msnf_g + r.other_solids_g;
                      });

                      setRows(newRows);
                    }}
                    onAutoOptimize={async (algorithm: OptimizerConfig['algorithm']) => {
                      setIsOptimizing(true);
                      try {
                        // Convert to Row format for optimization
                        const rowsForOptimize: Row[] = rows
                          .filter(r => r.ingredientData)
                          .map(r => ({
                            ing: r.ingredientData!,
                            grams: r.quantity_g,
                            min: r.quantity_g * 0.5,
                            max: r.quantity_g * 1.5
                          }));

                        const mode = resolveMode(productType);
                        const constraints = PRODUCT_CONSTRAINTS[productKey(mode, rows)];
                        
                        const targets = {
                          fat_pct: (constraints.fat.optimal[0] + constraints.fat.optimal[1]) / 2,
                          msnf_pct: (constraints.msnf.optimal[0] + constraints.msnf.optimal[1]) / 2,
                          ts_pct: (constraints.totalSolids.optimal[0] + constraints.totalSolids.optimal[1]) / 2
                        };

                        const optimized = advancedOptimize(rowsForOptimize, targets, {
                          algorithm,
                          maxIterations: algorithm === 'hybrid' ? 150 : 200,
                          populationSize: 40
                        });

                        // Convert back to IngredientRow format
                        const newRows = optimized.map(opt => {
                          const ing = opt.ing;
                          return {
                            ingredientData: ing,
                            ingredient: ing.name,
                            quantity_g: opt.grams,
                            sugars_g: ((ing.sugars_pct ?? 0) / 100) * opt.grams,
                            fat_g: ((ing.fat_pct ?? 0) / 100) * opt.grams,
                            msnf_g: ((ing.msnf_pct ?? 0) / 100) * opt.grams,
                            other_solids_g: ((ing.other_solids_pct ?? 0) / 100) * opt.grams,
                            total_solids_g: 0
                          } as IngredientRow;
                        });

                        newRows.forEach(r => {
                          r.total_solids_g = r.sugars_g + r.fat_g + r.msnf_g + r.other_solids_g;
                        });

                        setRows(newRows);
                        toast({
                          title: "AI Optimization Complete",
                          description: `Recipe optimized using ${algorithm} algorithm`
                        });
                      } catch (error) {
                        console.error('AI optimization error:', error);
                        toast({
                          title: "Optimization Failed",
                          description: error instanceof Error ? error.message : "Failed to optimize recipe",
                          variant: "destructive"
                        });
                      } finally {
                        setIsOptimizing(false);
                      }
                    }}
                  />
                )}
              </TabsContent>
            </Tabs>
            )}
          </CardContent>
        </Card>
      )}
      {/* Mobile Quick Access Button */}
      {isMobile && rows.length > 0 && (
        <Button
          className="fixed bottom-4 right-4 rounded-full shadow-lg z-50 h-14 w-14"
          size="icon"
          onClick={() => {
            document.getElementById('advanced-tools')?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          <Wrench className="h-5 w-5" />
        </Button>
      )}

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
                  {balancingSuggestions.map((suggestion, index) => (
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
    </div>
  );
}
