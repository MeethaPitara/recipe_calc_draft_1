
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { recipeService } from '@/services/recipeService';
import { useIngredients } from '@/contexts/IngredientsContext';
import { calculateDemandRun, type Level3Input, type Level3Output, type ProductionIngredient } from '@/lib/production/api';
import AIRoundingPanel from '@/components/production/AIRoundingPanel';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Printer, Calculator, ArrowRight, ArrowLeft, Beaker, Save, History, Trash2, Loader2 } from 'lucide-react';
import { toast } from "sonner";
import { authService } from '@/lib/auth/authService';
import { savePlanL3, getPlansL3, deletePlanL3 } from '@/lib/api/plans_l3';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

const ExactPlan = () => {
    const navigate = useNavigate();
    const { ingredients } = useIngredients();

    // --- State ---
    const [selectedRecipeId, setSelectedRecipeId] = useState<string>("");
    const [targetUnits, setTargetUnits] = useState<number>(500);
    const [targetUnitsStr, setTargetUnitsStr] = useState<string | null>(null);
    const [skuSizeLiters, setSkuSizeLiters] = useState<number>(0.5);
    const [skuSizeLitersStr, setSkuSizeLitersStr] = useState<string | null>(null);
    const [overrunPercent, setOverrunPercent] = useState<number>(30);
    const [overrunPercentStr, setOverrunPercentStr] = useState<string | null>(null);
    const [lossPercent, setLossPercent] = useState<number>(5);
    const [lossPercentStr, setLossPercentStr] = useState<string | null>(null);
    const [density, setDensity] = useState<number>(1.1);
    const [densityStr, setDensityStr] = useState<string | null>(null);

    const [calculationResult, setCalculationResult] = useState<Level3Output | null>(null);

    // --- Data Fetching ---
    const { data: savedRecipes, isLoading: isLoadingRecipes } = useQuery({
        queryKey: ['savedRecipes'],
        queryFn: () => recipeService.getRecipes(),
    });

    const { data: fullRecipe, isLoading: isLoadingFullRecipe } = useQuery({
        queryKey: ['recipe', selectedRecipeId],
        queryFn: () => recipeService.getRecipeById(selectedRecipeId),
        enabled: !!selectedRecipeId,
    });

    // --- Calculation Effect ---
    useEffect(() => {
        if (!fullRecipe || !fullRecipe.rows || !selectedRecipeId) {
            setCalculationResult(null);
            return;
        }

        // Map recipe rows to engine input format
        const recipeItems = fullRecipe.rows.map((r: any) => ({
            ingredientId: ingredients.find(i => i.name === r.ingredient)?.id || r.ingredient,
            name: r.ingredient,
            massGrams: r.quantity_g
        }));

        const input: Level3Input = {
            recipeItems,
            targetUnits,
            skuSizeLiters,
            overrunPercent,
            lossPercent,
            density
        };

        calculateDemandRun(input)
            .then(output => setCalculationResult(output))
            .catch(error => {
                console.error("Calculation failed:", error);
                toast.error("Calculation failed. Please check inputs.");
            });

    }, [fullRecipe, targetUnits, skuSizeLiters, overrunPercent, lossPercent, density, ingredients, selectedRecipeId]);


    // --- Convert output for AI Rounding ---
    const productionIngredients: ProductionIngredient[] = useMemo(() => {
        if (!calculationResult?.scaledRecipe) return [];
        return calculationResult.scaledRecipe.map((item) => {
            const ingData = ingredients.find(a =>
                a.id === item.ingredientId || a.name.toLowerCase() === item.name.toLowerCase()
            );
            return {
                ingredientId: item.ingredientId,
                name: item.name,
                massGrams: item.requiredMassKg * 1000,
                ingredientData: ingData,
            };
        });
    }, [calculationResult, ingredients]);

    // --- State: Save/Load ---
    const [isSaving, setIsSaving] = useState(false);
    const [planName, setPlanName] = useState("");
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
    const [savedPlans, setSavedPlans] = useState<any[]>([]);
    const [isLoadingPlans, setIsLoadingPlans] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);

    // --- Imports for Save/Load ---
    // (Ensure these are imported at the top, if not I will add them in a separate block)
    // We need: supabase, savePlanL3, getPlansL3, deletePlanL3, etc.

    const handleSavePlan = async () => {
        if (!calculationResult || !fullRecipe || !planName.trim()) return;

        setIsSaving(true);
        try {
            const user = await authService.getUser();
            if (!user?.email) throw new Error("No user email found");

            const inputParams = {
                recipeId: selectedRecipeId,
                targetUnits,
                skuSizeLiters,
                overrunPercent,
                lossPercent,
                density
            };

            // We store the full recipe as 'recipe_snapshot' to ensure we can load it even if the DB changes
            // We store the calculation result as 'results_snapshot'
            await savePlanL3({
                user_email: user.email,
                plan_name: planName,
                input_params: inputParams as any,
                recipe_snapshot: fullRecipe as any,
                results_snapshot: calculationResult as any
            });

            toast.success(`"${planName}" has been saved.`);
            setIsSaveDialogOpen(false);
            setPlanName("");
        } catch (error: any) {
            toast.error(error.message || "Failed to save plan");
        } finally {
            setIsSaving(false);
        }
    };

    const loadHistory = async () => {
        if (!isHistoryOpen) return;

        setIsLoadingPlans(true);
        try {
            const user = await authService.getUser();
            if (!user?.email) return;

            const plans = await getPlansL3(user.email);
            setSavedPlans(plans || []);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoadingPlans(false);
        }
    };

    useEffect(() => {
        if (isHistoryOpen) {
            loadHistory();
        }
    }, [isHistoryOpen]);

    const handleDeletePlan = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await deletePlanL3(id);
            setSavedPlans(prev => prev.filter(p => p.id !== id));
            toast.success("Plan deleted");
        } catch (error) {
            toast.error("Failed to delete plan");
        }
    }

    const loadPlanIntoState = (plan: any) => {
        const inputs = plan.input_params;

        // 1. Restore Inputs
        setSelectedRecipeId(inputs.recipeId);
        setTargetUnits(inputs.targetUnits);
        setSkuSizeLiters(inputs.skuSizeLiters);
        setOverrunPercent(inputs.overrunPercent);
        setLossPercent(inputs.lossPercent);
        setDensity(inputs.density);

        // 2. Restore Result (Optional: The effect will re-calc, but we could set it directly if we wanted to be instant)
        // Since we are setting the inputs, the useEffect will trigger.
        // HOWEVER, if the recipe changed in the DB, the calculation might differ.
        // For 'Exact Unit' it's usually safer to re-calculate based on current ingredients.
        // We will stick to re-calc for now. 
        // If we wanted strict snapshot loading, we'd need to bypass the effect.

        toast.success(`Restored "${plan.plan_name}"`);
        setIsHistoryOpen(false);
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="container mx-auto p-6 max-w-[1600px] animate-in fade-in duration-500 min-h-screen space-y-8">

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
                        <ArrowLeft className="w-6 h-6" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <Calculator className="w-8 h-8 text-indigo-600" />
                            Exact Batch Calculator
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Calculate exact raw material requirements for a specific production target.
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {/* HISTORY */}
                    <Sheet open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                        <SheetTrigger asChild>
                            <Button variant="outline" className="gap-2">
                                <History className="w-4 h-4" />
                                History
                            </Button>
                        </SheetTrigger>
                        <SheetContent>
                            <SheetHeader>
                                <SheetTitle>Saved Exact Plans</SheetTitle>
                                <SheetDescription>
                                    Previous calculations.
                                </SheetDescription>
                            </SheetHeader>
                            <ScrollArea className="h-[calc(100vh-8rem)] mt-4 pr-4">
                                {isLoadingPlans ? (
                                    <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                                ) : savedPlans.length === 0 ? (
                                    <p className="text-muted-foreground text-center py-8">No saved plans yet.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {savedPlans.map(plan => (
                                            <div
                                                key={plan.id}
                                                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer group"
                                                onClick={() => loadPlanIntoState(plan)}
                                            >
                                                <div className="space-y-1">
                                                    <p className="font-medium leading-none">{plan.plan_name}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {new Date(plan.created_at).toLocaleDateString()}
                                                    </p>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="opacity-0 group-hover:opacity-100 h-8 w-8 text-destructive"
                                                    onClick={(e) => handleDeletePlan(plan.id, e)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                        </SheetContent>
                    </Sheet>

                    {/* SAVE */}
                    <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
                        <DialogTrigger asChild>
                            <Button disabled={!calculationResult} variant="outline" className="gap-2">
                                <Save className="w-4 h-4" />
                                Save
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Save Exact Plan</DialogTitle>
                                <DialogDescription>
                                    Save this calculation for later reference.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Plan Name</Label>
                                    <Input
                                        placeholder="e.g. 500 Tubs Strawberry"
                                        value={planName}
                                        onChange={e => setPlanName(e.target.value)}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>Cancel</Button>
                                <Button onClick={handleSavePlan} disabled={isSaving || !planName.trim()}>
                                    {isSaving ? "Saving..." : "Save Plan"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {calculationResult && (
                        <Button onClick={handlePrint} className="gap-2">
                            <Printer className="w-4 h-4" />
                            Print
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                {/* --- Zone 1: Configuration (Left) --- */}
                <div className="lg:col-span-4 space-y-6">

                    {/* Recipe Selection & Targets */}
                    <Card className="shadow-md border-indigo-100 dark:border-indigo-900">
                        <CardHeader className="bg-slate-50 dark:bg-slate-900/50 pb-4 border-b">
                            <CardTitle className="text-lg">1. Production Order</CardTitle>
                            <CardDescription>Select what and how much to make</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">

                            <div className="space-y-2">
                                <Label>Select Recipe</Label>
                                <Select value={selectedRecipeId} onValueChange={setSelectedRecipeId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Choose a recipe..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {isLoadingRecipes ? (
                                            <SelectItem value="loading" disabled>Loading...</SelectItem>
                                        ) : (
                                            savedRecipes?.map((r: any) => (
                                                <SelectItem key={r.id} value={r.id}>{r.recipe_name}</SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-blue-600 font-semibold">Target Units</Label>
                                    <Input
                                        type="number"
                                        value={targetUnitsStr !== null ? targetUnitsStr : (targetUnits || '')}
                                        onChange={e => {
                                            let v = e.target.value;
                                            if (v.length > 1 && v.startsWith('0') && v[1] !== '.') v = v.replace(/^0+/, '');
                                            setTargetUnitsStr(v);
                                            const parsed = parseInt(v);
                                            if (!isNaN(parsed)) setTargetUnits(parsed);
                                        }}
                                        onBlur={() => setTargetUnitsStr(null)}
                                        className="font-mono text-lg"
                                    />
                                    <p className="text-[10px] text-muted-foreground">Tubs / Cups</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>SKU Size (L)</Label>
                                    <Input
                                        type="number" step={0.1}
                                        value={skuSizeLitersStr !== null ? skuSizeLitersStr : (skuSizeLiters || '')}
                                        onChange={e => {
                                            let v = e.target.value;
                                            if (v.length > 1 && v.startsWith('0') && v[1] !== '.') v = v.replace(/^0+/, '');
                                            setSkuSizeLitersStr(v);
                                            const parsed = parseFloat(v);
                                            if (!isNaN(parsed)) setSkuSizeLiters(parsed);
                                        }}
                                        onBlur={() => setSkuSizeLitersStr(null)}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Process Settings */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg">2. Process Settings</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-3 gap-3">
                            <div className="space-y-2">
                                <Label className="text-xs uppercase text-muted-foreground">Overrun %</Label>
                                <Input
                                    type="number"
                                    value={overrunPercentStr !== null ? overrunPercentStr : (overrunPercent || '')}
                                    onChange={e => {
                                        let v = e.target.value;
                                        if (v.length > 1 && v.startsWith('0') && v[1] !== '.') v = v.replace(/^0+/, '');
                                        setOverrunPercentStr(v);
                                        const parsed = parseFloat(v);
                                        if (!isNaN(parsed)) setOverrunPercent(parsed);
                                    }}
                                    onBlur={() => setOverrunPercentStr(null)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs uppercase text-muted-foreground">Loss %</Label>
                                <Input
                                    type="number"
                                    value={lossPercentStr !== null ? lossPercentStr : (lossPercent || '')}
                                    onChange={e => {
                                        let v = e.target.value;
                                        if (v.length > 1 && v.startsWith('0') && v[1] !== '.') v = v.replace(/^0+/, '');
                                        setLossPercentStr(v);
                                        const parsed = parseFloat(v);
                                        if (!isNaN(parsed)) setLossPercent(parsed);
                                    }}
                                    onBlur={() => setLossPercentStr(null)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs uppercase text-muted-foreground">Density</Label>
                                <Input
                                    type="number" step={0.01}
                                    value={densityStr !== null ? densityStr : (density || '')}
                                    onChange={e => {
                                        let v = e.target.value;
                                        if (v.length > 1 && v.startsWith('0') && v[1] !== '.') v = v.replace(/^0+/, '');
                                        setDensityStr(v);
                                        const parsed = parseFloat(v);
                                        if (!isNaN(parsed)) setDensity(parsed);
                                    }}
                                    onBlur={() => setDensityStr(null)}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Summary Card */}
                    {calculationResult && (
                        <Card className="bg-indigo-600 text-white border-0 shadow-lg ring-1 ring-white/20">
                            <CardContent className="pt-6 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <Beaker className="w-24 h-24" />
                                </div>
                                <div className="relative z-10">
                                    <p className="text-indigo-100 text-sm font-medium mb-1">Total Mix Required</p>
                                    <div className="text-4xl font-bold tracking-tighter mb-4">
                                        {calculationResult.stats.requiredMixKg.toFixed(1)} <span className="text-xl font-normal opacity-80">kg</span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 text-sm border-t border-indigo-500/30 pt-4">
                                        <div>
                                            <span className="block opacity-70 text-xs uppercase">Volume</span>
                                            <span className="font-semibold text-lg">{calculationResult.stats.requiredMixLiters.toFixed(1)} L</span>
                                        </div>
                                        <div>
                                            <span className="block opacity-70 text-xs uppercase">Pack Volume</span>
                                            <span className="font-semibold text-lg">{calculationResult.stats.packedFrozenLiters.toFixed(1)} L</span>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* --- Zone 2: Batch Sheet (Right) --- */}
                <div className="lg:col-span-8">
                    <Card className="h-full min-h-[600px] shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
                            <div>
                                <CardTitle className="text-xl">Manufacturing Instructions</CardTitle>
                                <CardDescription className="mt-1">
                                    Recipe: <span className="font-medium text-foreground">{fullRecipe?.recipe_name || "..."}</span>
                                </CardDescription>
                            </div>
                            <div className="text-right hidden sm:block">
                                <div className="text-2xl font-bold">{calculationResult?.stats.targetUnits}</div>
                                <div className="text-xs text-muted-foreground uppercase tracking-wider">Units to Produce</div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {!calculationResult ? (
                                <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground">
                                    <ArrowRight className="w-12 h-12 mb-2 opacity-20" />
                                    <p>Select a recipe and set targets to generate the plan.</p>
                                </div>
                            ) : (
                                <div className="relative">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b">
                                                <tr>
                                                    <th className="px-6 py-3 font-medium">Ingredient</th>
                                                    <th className="px-6 py-3 font-medium text-right">Percentage</th>
                                                    <th className="px-6 py-3 font-medium text-right">Quantity (kg)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border">
                                                {calculationResult.scaledRecipe.map((item) => (
                                                    <tr key={item.ingredientId} className="hover:bg-muted/50 transition-colors">
                                                        <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">
                                                            {item.name}
                                                        </td>
                                                        <td className="px-6 py-4 text-right text-muted-foreground font-mono">
                                                            {item.percentage.toFixed(2)}%
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                                                                {item.requiredMassKg.toFixed(3)}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                                <tr className="bg-slate-50 dark:bg-slate-900/50 font-bold border-t-2 border-slate-200 dark:border-slate-800">
                                                    <td className="px-6 py-4">Total</td>
                                                    <td className="px-6 py-4 text-right font-mono">100.00%</td>
                                                    <td className="px-6 py-4 text-right text-indigo-700 dark:text-indigo-300">
                                                        {calculationResult.totalMassKg.toFixed(3)} kg
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="p-6 bg-yellow-50 dark:bg-yellow-900/10 border-t border-yellow-100 dark:border-yellow-900/20 text-yellow-800 dark:text-yellow-200 text-sm flex gap-3">
                                        <div className="shrink-0 pt-0.5">⚠️</div>
                                        <div>
                                            <strong>Production Note:</strong> Ensure all ingredients are weighed precisely.
                                            This batch includes a {lossPercent}% buffer for process loss.
                                            Expected yield: ~{calculationResult.stats.packedFrozenLiters.toFixed(1)} Liters of frozen product.
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* AI Rounding Panel */}
                    {calculationResult && productionIngredients.length > 0 && (
                        <div className="mt-6">
                            <AIRoundingPanel
                                ingredients={productionIngredients}
                                productType={fullRecipe?.product_type || "gelato"}
                                availableIngredients={ingredients}
                                recipeName={fullRecipe?.recipe_name}
                                onRoundingComplete={(roundResult) => {
                                    console.log('Level 3 AI Rounding complete:', roundResult);
                                }}
                            />
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default ExactPlan;
