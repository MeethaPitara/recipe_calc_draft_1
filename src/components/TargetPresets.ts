
export interface RecipeTargets {
    fat: number;
    msnf: number;
    sugar: number;
    solids: number;
    tolerance: number; // ±% tolerance
}

// "Golden Standard" presets defined by Developer
export const TARGET_PRESETS: Record<string, RecipeTargets> = {
    'gelato': {
        fat: 1.0,
        msnf: 8.5,
        sugar: 18.0,
        solids: 36.0,
        tolerance: 2.0
    },
    'ice_cream': {
        fat: 12.0,
        msnf: 10.0,
        sugar: 16.0,
        solids: 40.0,
        tolerance: 2.0
    },
    'sorbet': {
        fat: 0.0,
        msnf: 0.0,
        sugar: 28.0,
        solids: 30.0,
        tolerance: 2.0
    },
    'sherbet': {
        fat: 2.0,
        msnf: 4.0,
        sugar: 22.0,
        solids: 32.0,
        tolerance: 2.0
    },
    'kulfi': {
        fat: 15.0,
        msnf: 12.0,
        sugar: 20.0,
        solids: 48.0,
        tolerance: 3.0 // Higher tolerance for traditional recipes
    },
    'soft_serve': {
        fat: 6.0,
        msnf: 11.0,
        sugar: 18.0,
        solids: 38.0,
        tolerance: 2.0
    }
};

/**
 * Fallback to Gelato if unknown type
 */
export const getTargets = (type: string): RecipeTargets => {
    return TARGET_PRESETS[type] || TARGET_PRESETS['gelato'];
};
