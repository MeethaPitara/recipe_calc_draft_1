/**
 * Product Constraints - Single Source of Truth
 * 
 * Defines optimal and acceptable ranges for all product types.
 * Used by balancing engine, validation, and UI components.
 */

import type { Mode } from '@/types/mode';

export interface ConstraintRange {
  optimal: [number, number];
  acceptable: [number, number];
}

export interface ProductConstraint {
  fat: ConstraintRange;
  msnf: ConstraintRange;
  totalSugars: ConstraintRange;
  totalSolids: ConstraintRange;
  fpdt?: ConstraintRange;
  stabilizer?: ConstraintRange;
  fruitPct?: ConstraintRange;
}

/**
 * Product constraints for all supported product types.
 * Single source of truth - imported by optimize.balancer.v2 and other modules.
 */
export const PRODUCT_CONSTRAINTS: Record<string, ProductConstraint> = {
  // Ice Cream: Rich, creamy, high-fat American style
  ice_cream: {
    fat: { optimal: [10, 16], acceptable: [8, 18] },
    msnf: { optimal: [9, 12], acceptable: [7, 14] },
    totalSugars: { optimal: [14, 18], acceptable: [12, 20] },
    totalSolids: { optimal: [36, 40], acceptable: [34, 42] },
    fpdt: { optimal: [2.2, 3.2], acceptable: [2.0, 3.5] },
    stabilizer: { optimal: [0.2, 0.4], acceptable: [0.1, 0.5] }
  },

  // Gelato White Base: Low-fat, versatile base for flavoring
  gelato_white: {
    fat: { optimal: [4, 7], acceptable: [3, 9] },
    msnf: { optimal: [9, 11], acceptable: [8, 12] },
    totalSugars: { optimal: [17, 20], acceptable: [15, 22] },
    totalSolids: { optimal: [34, 38], acceptable: [32, 40] },
    fpdt: { optimal: [2.5, 3.5], acceptable: [2.2, 3.8] },
    stabilizer: { optimal: [0.3, 0.5], acceptable: [0.2, 0.6] }
  },

  // Gelato Finished: Standard finished gelato
  gelato_finished: {
    fat: { optimal: [6, 10], acceptable: [4, 12] },
    msnf: { optimal: [8, 11], acceptable: [7, 12] },
    totalSugars: { optimal: [18, 22], acceptable: [16, 24] },
    totalSolids: { optimal: [36, 42], acceptable: [34, 46] },
    fpdt: { optimal: [2.5, 3.5], acceptable: [2.2, 3.8] },
    stabilizer: { optimal: [0.3, 0.5], acceptable: [0.2, 0.6] }
  },

  // Fruit Gelato: Lower dairy, fruit-forward
  gelato_fruit: {
    fat: { optimal: [2, 5], acceptable: [1, 7] },
    msnf: { optimal: [4, 6], acceptable: [3, 8] },
    totalSugars: { optimal: [20, 24], acceptable: [18, 26] },
    totalSolids: { optimal: [32, 38], acceptable: [30, 42] },
    fpdt: { optimal: [2.5, 3.5], acceptable: [2.2, 3.8] },
    stabilizer: { optimal: [0.4, 0.6], acceptable: [0.3, 0.7] },
    fruitPct: { optimal: [20, 30], acceptable: [15, 40] }
  },

  // Sorbet: Fat-free, fruit-based
  sorbet: {
    fat: { optimal: [0, 0], acceptable: [0, 1] },
    msnf: { optimal: [0, 0], acceptable: [0, 1] },
    totalSugars: { optimal: [26, 30], acceptable: [24, 32] },
    totalSolids: { optimal: [28, 34], acceptable: [26, 38] },
    fpdt: { optimal: [-4.0, -2.0], acceptable: [-5.0, -1.0] },
    stabilizer: { optimal: [0.5, 0.8], acceptable: [0.3, 1.0] },
    fruitPct: { optimal: [30, 50], acceptable: [25, 60] }
  },

  // Kulfi: Indian-style dense ice cream
  kulfi: {
    fat: { optimal: [10, 12], acceptable: [8, 14] },
    msnf: { optimal: [18, 22], acceptable: [16, 25] },
    totalSugars: { optimal: [17, 19], acceptable: [15, 21] },
    totalSolids: { optimal: [38, 42], acceptable: [36, 45] },
    fpdt: { optimal: [2.0, 2.5], acceptable: [1.8, 2.8] }
  },

  // Alias for gelato
  gelato: {
    fat: { optimal: [4, 7], acceptable: [3, 9] },
    msnf: { optimal: [9, 11], acceptable: [8, 12] },
    totalSugars: { optimal: [17, 20], acceptable: [15, 22] },
    totalSolids: { optimal: [34, 38], acceptable: [32, 40] },
    fpdt: { optimal: [2.5, 3.5], acceptable: [2.2, 3.8] },
    stabilizer: { optimal: [0.3, 0.5], acceptable: [0.2, 0.6] }
  }
};

/**
 * Get constraints for a specific mode
 */
export function getConstraintsForMode(mode: Mode, hasFruit: boolean = false): ProductConstraint {
  if (mode === 'sorbet') return PRODUCT_CONSTRAINTS.sorbet;
  if (mode === 'ice_cream') return PRODUCT_CONSTRAINTS.ice_cream;
  if (mode === 'kulfi') return PRODUCT_CONSTRAINTS.kulfi;
  if (mode === 'gelato') {
    return hasFruit ? PRODUCT_CONSTRAINTS.gelato_fruit : PRODUCT_CONSTRAINTS.gelato_white;
  }
  return PRODUCT_CONSTRAINTS.gelato_white;
}

/**
 * Balancing targets for each mode - used by balancing engine
 */
export interface BalancingTarget {
  fat_pct: number;
  msnf_pct: number;
  totalSugars_pct: number;
  ts_pct: number;
  fpdt: number;
}

export const BALANCING_TARGETS: Record<Mode, BalancingTarget> = {
  gelato: {
    fat_pct: 7.5,
    msnf_pct: 10.5,
    totalSugars_pct: 19,
    ts_pct: 40.5,
    fpdt: 3.0
  },
  ice_cream: {
    fat_pct: 13,
    msnf_pct: 11,
    totalSugars_pct: 17,
    ts_pct: 39,
    fpdt: 2.7
  },
  sorbet: {
    fat_pct: 0.5,
    msnf_pct: 0.5,
    totalSugars_pct: 28.5,
    ts_pct: 37,
    fpdt: -3.0
  },
  kulfi: {
    fat_pct: 11,
    msnf_pct: 21.5,
    totalSugars_pct: 18,
    ts_pct: 40,
    fpdt: 2.25
  }
};

/**
 * Get balancing targets for a mode
 */
export function getBalancingTargets(mode: Mode): BalancingTarget {
  return BALANCING_TARGETS[mode] || BALANCING_TARGETS.gelato;
}
