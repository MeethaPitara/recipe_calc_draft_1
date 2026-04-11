export interface RecipeTargets {
    fat: [number, number];
    msnf: [number, number];
    sugar: [number, number];
    solids: [number, number];
    other_solids?: [number, number];
}

// "Golden Standard" presets defined
export const TARGET_PRESETS: Record<string, RecipeTargets> = {
    'white_base': {
        fat: [3, 7],
        msnf: [7, 12],
        sugar: [16, 19],
        solids: [32, 37],
        other_solids: [0.3, 0.6]
    },
    'gelato_white': {
        fat: [3, 7],
        msnf: [7, 12],
        sugar: [16, 19],
        solids: [32, 37],
        other_solids: [0.3, 0.6]
    },
    'finished_gelato': {
        fat: [7, 16],
        msnf: [7, 12],
        sugar: [18, 22],
        solids: [37, 46],
        other_solids: [0.2, 10]
    },
    'gelato_finished': {
        fat: [7, 16],
        msnf: [7, 12],
        sugar: [18, 22],
        solids: [37, 46],
        other_solids: [0.2, 10]
    },
    'fruit_gelato': {
        fat: [3, 10],
        msnf: [3, 7],
        sugar: [22, 24],
        solids: [32, 42],
        other_solids: [0.2, 7]
    },
    'gelato_fruit': {
        fat: [3, 10],
        msnf: [3, 7],
        sugar: [22, 24],
        solids: [32, 42],
        other_solids: [0.2, 7]
    },
    'gelato': {
        fat: [3, 7],
        msnf: [7, 12],
        sugar: [16, 19],
        solids: [32, 37],
        other_solids: [0.3, 0.6]
    },
    'ice_cream': {
        fat: [10, 16],
        msnf: [9, 12],
        sugar: [14, 18],
        solids: [36, 40]
    },
    'sorbet': {
        fat: [0, 0],
        msnf: [0, 0],
        sugar: [26, 31],
        solids: [32, 42]
    },
    'sherbet': {
        fat: [1, 2],
        msnf: [2, 5],
        sugar: [20, 24],
        solids: [28, 32]
    },
    'kulfi': {
        fat: [10, 15],
        msnf: [15, 25],
        sugar: [15, 20],
        solids: [38, 45]
    },
    'soft_serve': {
        fat: [4, 8],
        msnf: [11, 14],
        sugar: [15, 18],
        solids: [33, 38]
    }
};

/**
 * Fallback to Gelato if unknown type
 */
export const getTargets = (type: string): RecipeTargets => {
    return TARGET_PRESETS[type] || TARGET_PRESETS['gelato'];
};
