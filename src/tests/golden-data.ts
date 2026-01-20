
export interface IngredientInput {
    id: string;
    name: string;
    quantity: number;
    // Nutritional values per 100g
    fat: number;
    msnf: number;
    sugar: number;
    other: number;
    p_solids: number; // Total solids
}

export interface ExpectedMetrics {
    totalWeight: number;
    totalFat: number;
    totalMSNF: number;
    totalSugar: number;
    totalSolids: number;
}

export interface GoldenTestCase {
    name: string;
    inputs: IngredientInput[];
    expected: ExpectedMetrics;
}

export const GOLDEN_TEST_CASES: GoldenTestCase[] = [
    {
        name: "Excel Master Validation (Ground Truth)",
        inputs: [
            { id: "milk_3", name: "Milk (3% fat)", quantity: 589, fat: 3.0, msnf: 8.5, sugar: 0, other: 0, p_solids: 11.5 },
            { id: "cream_25", name: "Cream (25% fat)", quantity: 165, fat: 25.0, msnf: 6.8, sugar: 0, other: 0, p_solids: 31.8 },
            { id: "sucrose", name: "Sucrose", quantity: 118, fat: 0, msnf: 0, sugar: 100, other: 0, p_solids: 100 },
            { id: "dextrose", name: "Dextrose", quantity: 18, fat: 0, msnf: 0, sugar: 92, other: 0, p_solids: 92 },
            { id: "glucose_syrup", name: "Glucose Syrup", quantity: 42, fat: 0, msnf: 0, sugar: 80, other: 0, p_solids: 80 },
            { id: "smp", name: "Skimmed Milk Powder", quantity: 44, fat: 1.0, msnf: 95.0, sugar: 0, other: 0, p_solids: 96.0 },
            { id: "stab", name: "Stabilizer", quantity: 6, fat: 0, msnf: 0, sugar: 0, other: 100, p_solids: 100 },
            { id: "condensed", name: "Condensed Milk", quantity: 18, fat: 3.9, msnf: 8.5, sugar: 58.3, other: 0, p_solids: 70.7 }
        ],
        expected: {
            totalWeight: 1000,
            totalFat: 60.06,    // Target: 60.062
            totalMSNF: 104.62,  // Target: 104.615
            totalSugar: 178.65, // Target: 178.654
            totalSolids: 349.33 // Target: 349.331
        }
    },
    {
        name: "Butter Consistency Check",
        inputs: [
            { id: "butter_test", name: "Butter", quantity: 40, fat: 80.0, msnf: 1.0, sugar: 0, other: 18.0, p_solids: 99.0 }
        ],
        expected: {
            totalWeight: 40,
            totalFat: 32.0,
            totalMSNF: 0.4,
            totalSugar: 0,
            totalSolids: 39.6
        }
    }
];
