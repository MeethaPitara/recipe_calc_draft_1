
import React from 'react';
import { Minus } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useBasePlannerStore, AllocationRow as IAllocationRow } from '@/store/useBasePlannerStore';

interface Props {
    row: IAllocationRow;
}

export const AllocationRow = ({ row }: Props) => {
    const { updateRow, removeRow, engineOutput } = useBasePlannerStore();

    // Get live result for this row if available
    const result = engineOutput?.rows.find(r => r.recipeId === row.recipeId);

    const [allocationPctStr, setAllocationPctStr] = React.useState<string | null>(null);
    const [skuSizeStr, setSkuSizeStr] = React.useState<string | null>(null);
    const [overrunStr, setOverrunStr] = React.useState<string | null>(null);
    const [lossStr, setLossStr] = React.useState<string | null>(null);
    const [densityStr, setDensityStr] = React.useState<string | null>(null);

    const handleSliderChange = (vals: number[]) => {
        updateRow(row.id, { allocationPct: vals[0] });
    };

    return (
        <div className="relative group border rounded-lg p-5 bg-card hover:border-blue-300 transition-colors shadow-sm">
            <Button
                variant="ghost"
                size="icon"
                onClick={() => removeRow(row.id)}
                className="absolute top-2 right-2 h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
            >
                <Minus className="h-4 w-4" />
            </Button>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">

                {/* 1. Recipe Identity */}
                <div className="md:col-span-3 space-y-1">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Recipe</Label>
                    <div className="font-semibold text-lg truncate" title={row.recipeName}>
                        {row.recipeName}
                    </div>
                </div>

                {/* 2. The Allocation Slider (Hero Control) */}
                <div className="md:col-span-4 space-y-3">
                    <div className="flex justify-between items-center">
                        <Label className="text-xs text-blue-600 font-bold uppercase">Base Allocation</Label>
                        <div className="flex items-center gap-1">
                            <Input
                                type="number"
                                min={0} max={100}
                                value={allocationPctStr !== null ? allocationPctStr : (row.allocationPct || '')}
                                onChange={e => {
                                    let v = e.target.value;
                                    if (v.length > 1 && v.startsWith('0') && v[1] !== '.') v = v.replace(/^0+/, '');
                                    setAllocationPctStr(v);
                                    const parsed = parseFloat(v);
                                    if (!isNaN(parsed)) updateRow(row.id, { allocationPct: parsed });
                                }}
                                onBlur={() => setAllocationPctStr(null)}
                                className="h-6 w-16 text-right text-xs p-1"
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                        </div>
                    </div>
                    <Slider
                        value={[row.allocationPct]}
                        min={0}
                        max={100}
                        step={1}
                        onValueChange={handleSliderChange}
                        className="py-2"
                    />
                </div>

                {/* 3. Configuration Grid (Mini Inputs) */}
                <div className="md:col-span-3 grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground uppercase">SKU (L)</Label>
                        <Input
                            type="number" step={0.1}
                            value={skuSizeStr !== null ? skuSizeStr : (row.skuSize || '')}
                            className="h-7 text-xs"
                            onChange={e => {
                                let v = e.target.value;
                                if (v.length > 1 && v.startsWith('0') && v[1] !== '.') v = v.replace(/^0+/, '');
                                setSkuSizeStr(v);
                                const parsed = parseFloat(v);
                                if (!isNaN(parsed)) updateRow(row.id, { skuSize: parsed });
                            }}
                            onBlur={() => setSkuSizeStr(null)}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground uppercase">Overrun %</Label>
                        <Input
                            type="number"
                            value={overrunStr !== null ? overrunStr : (row.overrun || '')}
                            className="h-7 text-xs"
                            onChange={e => {
                                let v = e.target.value;
                                if (v.length > 1 && v.startsWith('0') && v[1] !== '.') v = v.replace(/^0+/, '');
                                setOverrunStr(v);
                                const parsed = parseFloat(v);
                                if (!isNaN(parsed)) updateRow(row.id, { overrun: parsed });
                            }}
                            onBlur={() => setOverrunStr(null)}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground uppercase">Loss %</Label>
                        <Input
                            type="number"
                            value={lossStr !== null ? lossStr : (row.loss || '')}
                            className="h-7 text-xs"
                            onChange={e => {
                                let v = e.target.value;
                                if (v.length > 1 && v.startsWith('0') && v[1] !== '.') v = v.replace(/^0+/, '');
                                setLossStr(v);
                                const parsed = parseFloat(v);
                                if (!isNaN(parsed)) updateRow(row.id, { loss: parsed });
                            }}
                            onBlur={() => setLossStr(null)}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground uppercase">Density</Label>
                        <Input
                            type="number" step={0.01}
                            value={densityStr !== null ? densityStr : (row.density || '')}
                            className="h-7 text-xs"
                            onChange={e => {
                                let v = e.target.value;
                                if (v.length > 1 && v.startsWith('0') && v[1] !== '.') v = v.replace(/^0+/, '');
                                setDensityStr(v);
                                const parsed = parseFloat(v);
                                if (!isNaN(parsed)) updateRow(row.id, { density: parsed });
                            }}
                            onBlur={() => setDensityStr(null)}
                        />
                    </div>
                </div>

                {/* 4. Live Result Preview */}
                <div className="md:col-span-2 flex flex-col items-end justify-center h-full pt-1">
                    {result ? (
                        <div className="text-right">
                            {result.isValid ? (
                                <>
                                    <div className="text-sm font-medium text-muted-foreground">Produces</div>
                                    <div className="text-2xl font-bold text-green-600 dark:text-green-400 leading-none my-1">
                                        {result.producedUnits}
                                    </div>
                                    <div className="text-xs text-muted-foreground">units</div>
                                    <div className="text-[10px] text-slate-400 mt-1">
                                        Uses ~{result.actualBaseConsumedKg.toFixed(1)}kg Base
                                    </div>
                                </>
                            ) : (
                                <div className="text-red-500 text-xs font-medium max-w-[150px] flex flex-col items-end">
                                    <span>{result.error || "Invalid Configuration"}</span>
                                    {/* Debug Info for "Base not found" */}
                                    {result.error?.includes("Base not found") && (
                                        <div className="text-[9px] text-slate-400 mt-1 border-t pt-1 w-full">
                                            <div>Need BaseID: {useBasePlannerStore.getState().baseIngredientId?.substring(0, 5)}...</div>
                                            <div>Found: {row.recipeItems.map((i: any) => (i.ingredientId || i.id)?.substring(0, 5) + "...").join(", ")}</div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-xs text-muted-foreground text-right italic">
                            Waiting for calculation...
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
