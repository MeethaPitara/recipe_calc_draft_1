import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { authService } from "@/lib/auth/authService";
import { Loader2, ArrowLeft, Calculator, Variable, Save, History, Trash2 } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { calculateProductionRun, ProductionInput, ProductionOutput } from "@/lib/production/level1_engine";
import { RecipeIngredient } from "@/types/recipe";
import { savePlan, getPlans, deletePlan, Plan } from "@/lib/api/plans";
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
import { useIngredients } from "@/contexts/IngredientsContext";
import AIRoundingPanel from "@/components/production/AIRoundingPanel";
import type { ProductionIngredient } from "@/lib/production/productionValidator";

// Simplified recipe type from DB
interface DbRecipe {
    id: string;
    recipe_name: string;
    product_type: string;
    recipe_rows: {
        ingredient: string;
        quantity_g: number;
    }[];
}

export default function QuickProductionPlan() {
    const { toast } = useToast();
    const navigate = useNavigate();
    const location = useLocation();
    const passedRecipe = location.state?.recipe as any[];
    const { ingredients: availableIngredients } = useIngredients();

    // -- State: Data Loading --
    const [recipes, setRecipes] = useState<DbRecipe[]>([]);
    const [isLoadingRecipes, setIsLoadingRecipes] = useState(false);

    // -- State: Inputs --
    const [selectedRecipeId, setSelectedRecipeId] = useState<string>("manual");
    const [targetVolume, setTargetVolume] = useState<number>(100);
    const [targetVolumeStr, setTargetVolumeStr] = useState<string | null>(null);
    const [skuSize, setSkuSize] = useState<number>(0.5);
    const [skuSizeStr, setSkuSizeStr] = useState<string | null>(null);
    const [overrun, setOverrun] = useState<number>(30);
    const [overrunStr, setOverrunStr] = useState<string | null>(null);
    const [loss, setLoss] = useState<number>(5);
    const [lossStr, setLossStr] = useState<string | null>(null);
    const [density, setDensity] = useState<number>(1.1);
    const [densityStr, setDensityStr] = useState<string | null>(null);

    // -- State: Outputs --
    const [result, setResult] = useState<ProductionOutput | null>(null);

    // -- State: Save/Load --
    const [isSaving, setIsSaving] = useState(false);
    const [planName, setPlanName] = useState("");
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
    const [savedPlans, setSavedPlans] = useState<Plan[]>([]);
    const [isLoadingPlans, setIsLoadingPlans] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);

    const handleSavePlan = async () => {
        if (!result || !planName.trim()) return;

        setIsSaving(true);
        try {
            const user = await authService.getUser();
            if (!user?.email) throw new Error("No user email found");

            const inputParams = {
                targetVolumeLiters: targetVolume,
                skuSizeLiters: skuSize,
                overrunPct: overrun,
                lossPct: loss,
                mixDensity: density,
            };

            await savePlan({
                user_email: user.email,
                plan_name: planName,
                input_params: inputParams as any, // Cast to JSON
                recipe_snapshot: result.scaledRecipe as any,
                output_summary: result.skuStats as any,
                original_recipe_id: selectedRecipeId !== "manual" ? selectedRecipeId : null
            });

            toast({
                title: "Plan Saved",
                description: `"${planName}" has been saved to your history.`,
            });
            setIsSaveDialogOpen(false);
            setPlanName("");
        } catch (error: any) {
            toast({
                title: "Error saving plan",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    };

    const loadHistory = async () => {
        if (!isHistoryOpen) return; // Only load when opening

        setIsLoadingPlans(true);
        try {
            const user = await authService.getUser();
            if (!user?.email) return;

            const plans = await getPlans(user.email);
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
            await deletePlan(id);
            setSavedPlans(prev => prev.filter(p => p.id !== id));
            toast({ title: "Plan deleted" });
        } catch (error) {
            toast({ title: "Failed to delete", variant: "destructive" });
        }
    }

    const loadPlanIntoState = (plan: Plan) => {
        const params = plan.input_params as any;

        // Restore Inputs
        setTargetVolume(params.targetVolumeLiters);
        setSkuSize(params.skuSizeLiters);
        setOverrun(params.overrunPct);
        setLoss(params.lossPct);
        setDensity(params.mixDensity);

        // Restore Recipe
        // Note: We can't easily restore "selectedRecipeId" if it was a DB recipe that might have changed or been deleted.
        // So we treat loaded plans as "Manual" snapshot recipes for safety, OR try to match ID.
        // For simplicity v1: Load as manual snapshot.

        // We need to pass this to the effect. 
        // Best implementation: Set a "manual override" state or just set the passedRecipe state via history replace?
        // Let's set it as a manual recipe.

        const snapshot = plan.recipe_snapshot as any[];
        // We can use the route state mechanic or just a local state override.
        // Let's use the browser history state to "simulate" coming from the calculator with this recipe.
        // unique key to force effect re-run
        navigate(".", { replace: true, state: { recipe: snapshot, timestamp: Date.now() } });

        toast({ title: "Plan Loaded", description: `Configuration restored from "${plan.plan_name}"` });
        setIsHistoryOpen(false);
    };

    // -- Load Recipes on Mount --
    useEffect(() => {
        const fetchRecipes = async () => {
            setIsLoadingRecipes(true);
            const { data, error } = await supabase
                .from('recipes')
                .select(`
          id,
          recipe_name,
          product_type,
          recipe_rows (
            ingredient,
            quantity_g
          )
        `)
                .order('created_at', { ascending: false });

            if (error) {
                toast({
                    title: "Error loading recipes",
                    description: error.message,
                    variant: "destructive",
                });
            } else {
                setRecipes(data || []);
            }
            setIsLoadingRecipes(false);
        };

        fetchRecipes();
    }, [toast]);

    useEffect(() => {
        if (passedRecipe && passedRecipe.length > 0) {
            setSelectedRecipeId("manual");
        } else {
            setSelectedRecipeId("");
        }
    }, [passedRecipe]);

    // -- Calculation & Effects --
    useEffect(() => {
        if (!selectedRecipeId) {
            setResult(null);
            return;
        }

        let engineRecipe: RecipeIngredient[] = [];

        if (selectedRecipeId === 'manual') {
            if (passedRecipe && passedRecipe.length > 0) {
                engineRecipe = passedRecipe.map(r => ({
                    ingredient: r.ingredient || r.name || "Unknown",
                    quantity_g: r.quantity_g || r.amount || 0
                }));
            } else {
                setResult(null);
                return;
            }
        } else {
            const recipe = recipes.find(r => r.id === selectedRecipeId);
            if (!recipe) return;

            // Map DB rows to RecipeIngredient type
            engineRecipe = recipe.recipe_rows.map(row => ({
                ingredient: row.ingredient,
                quantity_g: row.quantity_g,
            }));
        }

        const input: ProductionInput = {
            recipe: engineRecipe,
            targetVolumeLiters: targetVolume,
            skuSizeLiters: skuSize,
            overrunPct: overrun,
            lossPct: loss,
            mixDensity: density,
        };

        const output = calculateProductionRun(input);
        setResult(output);

    }, [selectedRecipeId, targetVolume, skuSize, overrun, loss, density, recipes, passedRecipe]);

    // -- Convert scaled recipe to ProductionIngredient format for AI Rounding --
    const productionIngredients: ProductionIngredient[] = useMemo(() => {
        if (!result?.scaledRecipe) return [];
        return result.scaledRecipe.map((item) => {
            // Try to find matching ingredient data
            const ingData = availableIngredients.find(a =>
                a.name.toLowerCase() === item.ingredient.toLowerCase()
            );
            return {
                ingredientId: ingData?.id || item.ingredient,
                name: item.ingredient,
                massGrams: item.quantity_g,
                ingredientData: ingData,
            };
        });
    }, [result, availableIngredients]);

    // Determine product type from selected recipe
    const selectedProductType = useMemo(() => {
        if (selectedRecipeId === 'manual') return 'gelato'; // default
        const recipe = recipes.find(r => r.id === selectedRecipeId);
        return recipe?.product_type || 'gelato';
    }, [selectedRecipeId, recipes]);

    // -- Render Helpers --
    const formatNumber = (num: number, decimals = 1) => num.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals });

    const selectedRecipeName = recipes.find(r => r.id === selectedRecipeId)?.recipe_name || "Select Recipe";

    return (
        <div className="container mx-auto p-4 md:p-8 max-w-7xl animate-fade-in">
            <div className="flex items-center gap-4 mb-8">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Calculator className="h-8 w-8 text-primary" />
                        Quick Production Plan
                    </h1>
                    <p className="text-muted-foreground">Level-1 Production Mode: Calculate batch sizes and SKU counts.</p>
                </div>

                <div className="ml-auto flex gap-2">
                    {/* HISTORY SHEET */}
                    <Sheet open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                        <SheetTrigger asChild>
                            <Button variant="outline" className="gap-2">
                                <History className="h-4 w-4" />
                                History
                            </Button>
                        </SheetTrigger>
                        <SheetContent>
                            <SheetHeader>
                                <SheetTitle>Saved Plans</SheetTitle>
                                <SheetDescription>
                                    Previous production runs. Click to load.
                                </SheetDescription>
                            </SheetHeader>
                            <ScrollArea className="h-[calc(100vh-8rem)] mt-4 pr-4">
                                {isLoadingPlans ? (
                                    <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
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

                    {/* SAVE DIALOG */}
                    <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
                        <DialogTrigger asChild>
                            <Button disabled={!result} className="gap-2">
                                <Save className="h-4 w-4" />
                                Save Plan
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Save Production Plan</DialogTitle>
                                <DialogDescription>
                                    Save this configuration and result for later reference.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Plan Name</Label>
                                    <Input
                                        placeholder="e.g. Summer Strawberry Run"
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
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* --- LEFT COLUMN: Configuration --- */}
                <Card className="lg:col-span-1 h-fit">
                    <CardHeader>
                        <CardTitle>Plan Configuration</CardTitle>
                        <CardDescription>Set your production targets and machine settings.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">

                        <div className="space-y-2">
                            <Label>Recipe</Label>
                            <Select value={selectedRecipeId} onValueChange={setSelectedRecipeId}>
                                <SelectTrigger>
                                    <SelectValue placeholder={isLoadingRecipes ? "Loading..." : "Select a recipe"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {passedRecipe && passedRecipe.length > 0 && (
                                        <SelectItem value="manual">
                                            Current Calculator Recipe <span className="text-muted-foreground text-xs">(Unsaved)</span>
                                        </SelectItem>
                                    )}
                                    {recipes.map(r => (
                                        <SelectItem key={r.id} value={r.id}>
                                            {r.recipe_name} <span className="text-muted-foreground text-xs">({r.product_type})</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Target Volume (Liters)</Label>
                            <Input
                                type="number"
                                value={targetVolumeStr !== null ? targetVolumeStr : (targetVolume || '')}
                                onChange={e => {
                                    let v = e.target.value;
                                    if (v.length > 1 && v.startsWith('0') && v[1] !== '.') v = v.replace(/^0+/, '');
                                    setTargetVolumeStr(v);
                                    const parsed = parseFloat(v);
                                    if (!isNaN(parsed)) setTargetVolume(parsed);
                                }}
                                onBlur={() => setTargetVolumeStr(null)}
                                min={1}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>SKU Pack Size (Liters)</Label>
                            <div className="flex gap-2">
                                <Input
                                    type="number"
                                    value={skuSizeStr !== null ? skuSizeStr : (skuSize || '')}
                                    onChange={e => {
                                        let v = e.target.value;
                                        if (v.length > 1 && v.startsWith('0') && v[1] !== '.') v = v.replace(/^0+/, '');
                                        setSkuSizeStr(v);
                                        const parsed = parseFloat(v);
                                        if (!isNaN(parsed)) setSkuSize(parsed);
                                    }}
                                    onBlur={() => setSkuSizeStr(null)}
                                    step={0.1}
                                    min={0.05}
                                />
                                <Select onValueChange={(v) => {
                                    setSkuSize(Number(v));
                                    setSkuSizeStr(null);
                                }} value={skuSize.toString()}>
                                    <SelectTrigger className="w-[120px]">
                                        <SelectValue placeholder="Preset" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="0.1">0.1 L (Cup)</SelectItem>
                                        <SelectItem value="0.5">0.5 L (Tub)</SelectItem>
                                        <SelectItem value="1.0">1.0 L (Brick)</SelectItem>
                                        <SelectItem value="4.0">4.0 L (Bulk)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="flex items-center gap-1">Overrun % <Variable className="h-3 w-3 text-muted-foreground" /></Label>
                                <Input
                                    type="number"
                                    value={overrunStr !== null ? overrunStr : (overrun || '')}
                                    onChange={e => {
                                        let v = e.target.value;
                                        if (v.length > 1 && v.startsWith('0') && v[1] !== '.') v = v.replace(/^0+/, '');
                                        setOverrunStr(v);
                                        const parsed = parseFloat(v);
                                        if (!isNaN(parsed)) setOverrun(parsed);
                                    }}
                                    onBlur={() => setOverrunStr(null)}
                                    min={0}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="flex items-center gap-1">Loss % <Variable className="h-3 w-3 text-muted-foreground" /></Label>
                                <Input
                                    type="number"
                                    value={lossStr !== null ? lossStr : (loss || '')}
                                    onChange={e => {
                                        let v = e.target.value;
                                        if (v.length > 1 && v.startsWith('0') && v[1] !== '.') v = v.replace(/^0+/, '');
                                        setLossStr(v);
                                        const parsed = parseFloat(v);
                                        if (!isNaN(parsed)) setLoss(parsed);
                                    }}
                                    onBlur={() => setLossStr(null)}
                                    min={0}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Mix Density (kg/L)</Label>
                            <Input
                                type="number"
                                value={densityStr !== null ? densityStr : (density || '')}
                                onChange={e => {
                                    let v = e.target.value;
                                    if (v.length > 1 && v.startsWith('0') && v[1] !== '.') v = v.replace(/^0+/, '');
                                    setDensityStr(v);
                                    const parsed = parseFloat(v);
                                    if (!isNaN(parsed)) setDensity(parsed);
                                }}
                                onBlur={() => setDensityStr(null)}
                                step={0.01}
                            />
                            <p className="text-xs text-muted-foreground">Usually 1.08 - 1.15 for ice cream mix.</p>
                        </div>

                    </CardContent>
                </Card>

                {/* --- RIGHT COLUMN: Results --- */}
                <div className="lg:col-span-2 space-y-6">

                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="bg-primary/5 border-primary/20">
                            <CardContent className="pt-6 text-center">
                                <div className="text-4xl font-bold text-primary mb-1">
                                    {result ? result.skuStats.totalUnits : "-"}
                                </div>
                                <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Total Units</div>
                                {result && <div className="text-xs text-muted-foreground mt-1">@ {skuSize} L / unit</div>}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-6 text-center">
                                <div className="text-4xl font-bold mb-1">
                                    {result ? formatNumber(result.skuStats.plannedVolume) : "-"} <span className="text-base text-muted-foreground font-normal">L</span>
                                </div>
                                <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Planned Frozen Vol</div>
                            </CardContent>
                        </Card>

                        <Card className="bg-secondary/50">
                            <CardContent className="pt-6 text-center">
                                <div className="text-4xl font-bold mb-1">
                                    {result ? formatNumber(result.skuStats.mixRequiredKg) : "-"} <span className="text-base text-muted-foreground font-normal">kg</span>
                                </div>
                                <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Mix Required</div>
                                {result && <div className="text-xs text-muted-foreground mt-1">Inc. {loss}% loss</div>}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Batch Table */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Production Batch Recipe</CardTitle>
                                <CardDescription>
                                    Scaled recipe for {result ? formatNumber(result.skuStats.mixRequiredKg) : "-"} kg of mix.
                                </CardDescription>
                            </div>
                            {result && (
                                <Button variant="outline" onClick={() => window.print()}>
                                    Print Plan
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent>
                            {!selectedRecipeId ? (
                                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground bg-muted/20 rounded-lg dashed border-2 border-muted">
                                    <Calculator className="h-12 w-12 mb-4 opacity-20" />
                                    <p>Select a recipe to generate the plan</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Ingredient</TableHead>
                                            <TableHead className="text-right">Batch Weight (g)</TableHead>
                                            <TableHead className="text-right">Batch Weight (kg)</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {result?.scaledRecipe.map((row, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="font-medium">{row.ingredient}</TableCell>
                                                <TableCell className="text-right font-mono text-base">
                                                    {formatNumber(row.quantity_g, 2)}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-muted-foreground">
                                                    {formatNumber(row.quantity_g / 1000, 3)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {result && (
                                            <TableRow className="bg-muted/50 font-bold">
                                                <TableCell>TOTAL</TableCell>
                                                <TableCell className="text-right">
                                                    {formatNumber(result.scaledRecipe.reduce((a, b) => a + b.quantity_g, 0), 0)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {formatNumber(result.skuStats.mixRequiredKg, 2)}
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>

                    {/* AI Rounding Panel */}
                    {result && productionIngredients.length > 0 && (
                        <AIRoundingPanel
                            ingredients={productionIngredients}
                            productType={selectedProductType}
                            availableIngredients={availableIngredients}
                            recipeName={selectedRecipeName}
                            onRoundingComplete={(roundResult) => {
                                console.log('AI Rounding complete:', roundResult);
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
