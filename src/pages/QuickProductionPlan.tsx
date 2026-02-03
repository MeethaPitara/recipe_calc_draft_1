import { useState, useEffect } from "react";
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
import { Loader2, ArrowLeft, Calculator, Variable } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { calculateProductionRun, ProductionInput, ProductionOutput } from "@/lib/production/level1_engine";
import { RecipeIngredient } from "@/types/recipe";

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

    // -- State: Data Loading --
    const [recipes, setRecipes] = useState<DbRecipe[]>([]);
    const [isLoadingRecipes, setIsLoadingRecipes] = useState(false);

    // -- State: Inputs --
    const [selectedRecipeId, setSelectedRecipeId] = useState<string>("manual");
    const [targetVolume, setTargetVolume] = useState<number>(100);
    const [skuSize, setSkuSize] = useState<number>(0.5);
    const [overrun, setOverrun] = useState<number>(30);
    const [loss, setLoss] = useState<number>(5);
    const [density, setDensity] = useState<number>(1.1);

    // -- State: Outputs --
    const [result, setResult] = useState<ProductionOutput | null>(null);

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
                                value={targetVolume}
                                onChange={e => setTargetVolume(Number(e.target.value))}
                                min={1}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>SKU Pack Size (Liters)</Label>
                            <div className="flex gap-2">
                                <Input
                                    type="number"
                                    value={skuSize}
                                    onChange={e => setSkuSize(Number(e.target.value))}
                                    step={0.1}
                                    min={0.05}
                                />
                                <Select onValueChange={(v) => setSkuSize(Number(v))} value={skuSize.toString()}>
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
                                    value={overrun}
                                    onChange={e => setOverrun(Number(e.target.value))}
                                    min={0}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="flex items-center gap-1">Loss % <Variable className="h-3 w-3 text-muted-foreground" /></Label>
                                <Input
                                    type="number"
                                    value={loss}
                                    onChange={e => setLoss(Number(e.target.value))}
                                    min={0}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Mix Density (kg/L)</Label>
                            <Input
                                type="number"
                                value={density}
                                onChange={e => setDensity(Number(e.target.value))}
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
                </div>
            </div>
        </div>
    );
}
