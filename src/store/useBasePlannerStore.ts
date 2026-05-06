
import { create } from 'zustand';
import { calculateAllocations, type AllocationRequest, type AllocationResult } from '@/lib/production/api';

export interface AllocationRow {
    id: string;          // UUID for React keys
    recipeId: string;    // Selected Recipe ID
    recipeName: string;  // Display Name
    recipeItems: {
        ingredientId: string;
        name: string;
        massGrams: number;
    }[];
    recipeTotalMassG: number;
    allocationPct: number;
    // Machine Settings
    skuSize: number;     // liters
    overrun: number;     // %
    loss: number;        // %
    density: number;     // kg/L
}

interface BasePlannerState {
    // Inputs
    baseIngredientId: string;
    totalBaseMassKg: number;
    rows: AllocationRow[];

    // Computed Results
    engineOutput: AllocationResult | null;
    calcError: string | null;

    // Actions
    setBaseIngredientId: (id: string) => void;
    setTotalBaseMassKg: (mass: number) => void;

    addRecipeRow: (row: AllocationRow) => void;
    removeRow: (id: string) => void;
    updateRow: (id: string, updates: Partial<AllocationRow>) => void;
    setRows: (rows: AllocationRow[]) => void;
    loadState: (baseIngredientId: string, totalBaseMassKg: number, rows: AllocationRow[]) => void;

    calculate: () => void;
    reset: () => void;
}

export const useBasePlannerStore = create<BasePlannerState>((set, get) => ({
    baseIngredientId: '',
    totalBaseMassKg: 0,
    rows: [],
    engineOutput: null,
    calcError: null,

    setBaseIngredientId: (id) => {
        set({ baseIngredientId: id });
        get().calculate();
    },

    setTotalBaseMassKg: (mass) => {
        set({ totalBaseMassKg: mass });
        get().calculate();
    },

    addRecipeRow: (row) => {
        set((state) => ({
            rows: [...state.rows, row]
        }));
        get().calculate();
    },

    removeRow: (id) => {
        set((state) => ({
            rows: state.rows.filter(r => r.id !== id)
        }));
        get().calculate();
    },

    updateRow: (id, updates) => {
        set((state) => ({
            rows: state.rows.map(r => r.id === id ? { ...r, ...updates } : r)
        }));
        get().calculate();
    },

    setRows: (rows) => {
        set({ rows });
        get().calculate();
    },

    loadState: (baseIngredientId, totalBaseMassKg, rows) => {
        set({
            baseIngredientId,
            totalBaseMassKg,
            rows
        });
        get().calculate();
    },

    reset: () => {
        set({
            baseIngredientId: '',
            totalBaseMassKg: 0,
            rows: [],
            engineOutput: null,
            calcError: null
        });
    },

    calculate: async () => {
        const { baseIngredientId, totalBaseMassKg, rows } = get();

        // 1. Validation: Need base and mass to even try
        if (!baseIngredientId || totalBaseMassKg <= 0 || rows.length === 0) {
            set({ engineOutput: null, calcError: null });
            return;
        }

        try {
            const input: AllocationRequest = {
                supply: {
                    baseIngredientId,
                    totalAvailableMassKg: totalBaseMassKg
                },
                allocations: rows.map(a => ({
                    recipeId: a.recipeId, // Using ID for strictness, name is optional
                    recipeName: a.recipeName,
                    recipeItems: a.recipeItems,
                    allocationPercent: a.allocationPct,
                    targetSkuSizeLiters: a.skuSize,
                    targetOverrunPercent: a.overrun,
                    targetLossPercent: a.loss,
                    targetDensity: a.density
                }))
            };

            const result = await calculateAllocations(input);
            set({ engineOutput: result, calcError: null });

        } catch (err: any) {
            console.error("Calculation Error:", err);
            set({
                engineOutput: null,
                calcError: err.message || "Calculation failed"
            });
        }
    }
}));
