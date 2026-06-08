export interface IngredientBound {
    ingredientId: string;
    minGrams?: number;
    maxGrams?: number;
    isLocked?: boolean;
}

export interface SugarRatio {
    primarySugarId: string;
    secondarySugarId: string;
    ratio: number; // e.g. 70 means 70:30 ratio (primary is 70% of the total of the two)
}

export interface ConstraintProfile {
    bounds?: IngredientBound[];
    sugarRatios?: SugarRatio[];
    maxCostPerKgMix?: number;
    fixedBatchMassG?: number;
}
