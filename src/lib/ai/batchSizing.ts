/**
 * Batch Sizing Calculator
 * Port of Cell 4 — compute_batch_sizing() from reverse_engine_stage1.ipynb
 */

import type { RecipeItem, ProductionTargets, BatchMetrics } from './types';

/**
 * Mirrors Level 1-3 production planning engine exactly.
 *
 *   pre_overrun_volume_L  = targetVolumeLiters / (1 + overrunPct / 100)
 *   gross_liquid_volume_L = pre_overrun_volume_L / (1 - lossPct / 100)
 *   batch_mass_g          = gross_liquid_volume_L * 1000 * mixDensity
 *   n_skus                = ceil(targetVolumeLiters / skuSizeLiters)
 *   scale_factor          = batch_mass_g / sum(recipe quantities)
 */
export function computeBatchSizing(
    recipe: RecipeItem[],
    targets: ProductionTargets
): BatchMetrics {
    const preOverrunVolumeL =
        targets.targetVolumeLiters / (1 + targets.overrunPct / 100);

    const grossLiquidVolumeL =
        preOverrunVolumeL / (1 - targets.lossPct / 100);

    const batchMassG = grossLiquidVolumeL * 1000 * targets.mixDensity;

    const nSkus = Math.ceil(targets.targetVolumeLiters / targets.skuSizeLiters);

    const recipeTotalG = recipe.reduce((sum, item) => sum + item.quantity_g, 0);
    const scaleFactor = recipeTotalG > 0 ? batchMassG / recipeTotalG : 0;

    return {
        gross_liquid_volume_L: Math.round(grossLiquidVolumeL * 100) / 100,
        batch_mass_g: Math.round(batchMassG * 100) / 100,
        n_skus: nSkus,
        scale_factor: Math.round(scaleFactor * 1_000_000) / 1_000_000,
    };
}
