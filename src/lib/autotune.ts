import { Row } from './optimize';
import { calcMetrics } from './calc';
import { estimateFrozenWater } from './scoopability';

export function autotuneForTemp(rows: Row[], targetServeTempC: number, keepSP = true): Row[] {
  // Create a working copy
  const workingRows = rows.map(r => ({ ...r }));
  
  // Find sugar components
  const findSugar = (id: string) => workingRows.find(r => r.ing.id.includes(id));
  const sucrose = findSugar('sucrose');
  const dextrose = findSugar('dextrose') || findSugar('glucose');
  const invert = findSugar('invert');
  
  if (!sucrose || !dextrose) {
    console.warn('Cannot autotune: missing sucrose or dextrose in recipe');
    return rows; // Return original if we can't tune
  }

  const initialMetrics = calcMetrics(workingRows);
  const targetSP = initialMetrics.sp;
  const targetFrozenWater = 72; // Target 72% frozen water at serve temp

  // Iterative tuning
  for (let i = 0; i < 50; i++) {
    const currentMetrics = calcMetrics(workingRows);
    const currentFrozenWater = estimateFrozenWater(currentMetrics, targetServeTempC);
    
    // Check if we're close enough
    if (Math.abs(currentFrozenWater - targetFrozenWater) < 0.5) {
      break;
    }

    // Determine adjustment direction
    // If too much water is frozen (too hard), we need to increase PAC
    // If too little water is frozen (too soft), we need to decrease PAC
    const needMorePAC = currentFrozenWater > targetFrozenWater;
    const swapAmount = Math.min(5, Math.abs(currentFrozenWater - targetFrozenWater) * 0.5);

    if (needMorePAC) {
      // Move sucrose to dextrose (increases PAC)
      const amountToSwap = Math.min(sucrose.grams, swapAmount);
      sucrose.grams -= amountToSwap;
      dextrose.grams += amountToSwap;
    } else {
      // Move dextrose to sucrose (decreases PAC)
      const amountToSwap = Math.min(dextrose.grams, swapAmount);
      dextrose.grams -= amountToSwap;
      sucrose.grams += amountToSwap;
    }

    // If keepSP is true, try to maintain sweetness level using invert sugar
    if (keepSP && invert) {
      const newMetrics = calcMetrics(workingRows);
      const spDiff = targetSP - newMetrics.sp;
      
      // Adjust invert sugar to compensate for SP changes
      // Invert has higher SP than sucrose, so we can use it to fine-tune
      if (Math.abs(spDiff) > 0.1) {
        const invertAdjustment = spDiff * 2.0; // Rough compensation factor
        invert.grams = Math.max(0, invert.grams + invertAdjustment);
      }
    }

    // Ensure no negative amounts
    workingRows.forEach(row => {
      if (row.grams < 0) row.grams = 0;
    });
  }

  return workingRows;
}

export function previewTuningChanges(
  originalRows: Row[],
  targetTemp: number
): { changes: Array<{ ingredient: string; original: number; new: number; delta: number }>, metrics: any } {
  const tuned = autotuneForTemp(originalRows, targetTemp, true);
  const changes: Array<{ ingredient: string; original: number; new: number; delta: number }> = [];
  
  for (let i = 0; i < originalRows.length; i++) {
    const original = originalRows[i];
    const updated = tuned[i];
    
    if (Math.abs(original.grams - updated.grams) > 0.1) {
      changes.push({
        ingredient: original.ing.name,
        original: original.grams,
        new: updated.grams,
        delta: updated.grams - original.grams
      });
    }
  }
  
  const newMetrics = calcMetrics(tuned);
  const frozenWater = estimateFrozenWater(newMetrics, targetTemp);
  
  return {
    changes,
    metrics: {
      ...newMetrics,
      frozenWaterAtTarget: frozenWater,
      targetTemp
    }
  };
}

export function suggestSugarOptimization(metrics: any, targetHardness: 'softer' | 'firmer'): string[] {
  const suggestions: string[] = [];
  
  if (targetHardness === 'softer') {
    suggestions.push('Increase dextrose ratio for softer texture (higher PAC)');
    suggestions.push('Consider adding invert sugar for enhanced softness');
    suggestions.push('Reduce sucrose proportion slightly');
  } else {
    suggestions.push('Increase sucrose ratio for firmer texture (lower PAC)');
    suggestions.push('Consider adding maltodextrin for body without sweetness');
    suggestions.push('Reduce high-PAC sugars like dextrose');
  }
  
  if (metrics.sp > 26) {
    suggestions.push('Current sweetness is high - consider maltodextrin to add body');
  } else if (metrics.sp < 14) {
    suggestions.push('Current sweetness is low - verify sugar calculations');
  }
  
  return suggestions;
}
