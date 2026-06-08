
import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useIngredients } from '@/contexts/IngredientsContext';
import { useBasePlannerStore } from '@/store/useBasePlannerStore';

export const SupplyHeader = () => {
    const { ingredients } = useIngredients();
    const {
        baseIngredientId,
        totalBaseMassKg,
        rows,
        setBaseIngredientId,
        setTotalBaseMassKg
    } = useBasePlannerStore();

    // Compute metrics for the progress bar
    const totalAllocatedPct = useMemo(() =>
        rows.reduce((sum, row) => sum + row.allocationPct, 0),
        [rows]
    );

    const allocatedMass = (totalBaseMassKg * totalAllocatedPct) / 100;
    const remainingMass = totalBaseMassKg - allocatedMass;
    const isOverAllocated = totalAllocatedPct > 100;

    return (
        <Card className={`border-l-4 shadow-sm transition-colors ${isOverAllocated ? 'border-l-red-500' : 'border-l-blue-500'}`}>
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${isOverAllocated ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'} dark:bg-opacity-20`}>
                        
                    </div>
                   Base Supply Configuration
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Base Ingredient</Label>
                        <Select value={baseIngredientId} onValueChange={setBaseIngredientId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Base (e.g., White Base)" />
                            </SelectTrigger>
                            <SelectContent>
                                {ingredients.map(ing => (
                                    <SelectItem key={ing.id} value={ing.id}>{ing.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Total Available Mass (kg)</Label>
                        <div className="relative">
                            <Input
                                type="number"
                                min={0}
                                value={totalBaseMassKg || ''}
                                onChange={e => setTotalBaseMassKg(parseFloat(e.target.value) || 0)}
                                className="pl-3 pr-12 text-lg font-medium"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">kg</span>
                        </div>
                    </div>
                </div>

                {/* Utilization Bar */}
                <div className="space-y-2">
                    <div className="flex justify-between text-sm font-medium">
                        <span className={isOverAllocated ? "text-red-600" : "text-blue-600"}>
                           Allocated: {allocatedMass.toFixed(1)} kg ({totalAllocatedPct.toFixed(1)}%)
                        </span>
                        <span className={isOverAllocated ? "text-red-600 font-bold" : "text-muted-foreground"}>
                            {remainingMass >= 0
                                ? `Remaining: ${remainingMass.toFixed(1)} kg`
                                : `Over Budget: ${Math.abs(remainingMass).toFixed(1)} kg`
                            }
                        </span>
                    </div>
                    <Progress
                        value={totalAllocatedPct > 100 ? 100 : totalAllocatedPct}
                        className={`h-3 transition-colors ${isOverAllocated
                            ? "[&>div]:bg-red-500 bg-red-100"
                            : "[&>div]:bg-blue-500 bg-blue-50"
                            }`}
                    />
                    {isOverAllocated && (
                        <p className="text-xs text-red-500 font-medium animate-pulse">
                           Warning: You have allocated more base than is available!
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};
