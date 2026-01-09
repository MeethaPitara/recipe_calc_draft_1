import { IngredientData } from '@/types/ingredients';
import { calcMetricsV2, MetricsV2, CalcOptionsV2 } from './calc.v2';

export type Row = { ing: IngredientData; grams: number; lock?: boolean; min?: number; max?: number; };

export type OptimizeTarget = Partial<{
  totalSugars_pct: number; 
  sugars_pct: number; 
  fat_pct: number; 
  msnf_pct: number; 
  ts_pct: number; 
  fpdt: number;
  sp?: number;        // PHASE 5: Sweetening Power target
  afp_sugars?: number; // PHASE 5: AFP from sugars target
}>;

function objective(m: MetricsV2, t: OptimizeTarget) {
  let s = 0;
  // Weight FPDT more heavily as it's critical for texture
  if (t.totalSugars_pct != null) s += Math.abs(m.totalSugars_pct - t.totalSugars_pct) * 1.0;
  if (t.sugars_pct      != null) s += Math.abs(m.nonLactoseSugars_pct - t.sugars_pct) * 1.0;
  if (t.fat_pct         != null) s += Math.abs(m.fat_pct - t.fat_pct) * 1.5;
  if (t.msnf_pct        != null) s += Math.abs(m.msnf_pct - t.msnf_pct) * 1.5;
  if (t.ts_pct          != null) s += Math.abs(m.ts_pct - t.ts_pct) * 1.0;
  if (t.fpdt            != null) s += Math.abs(m.fpdt - t.fpdt) * 2.0;
  return s;
}

export function optimizeRecipe(
  rowsIn: Row[],
  targets: OptimizeTarget,
  mode: 'gelato' | 'kulfi' = 'gelato',
  maxIters = 1000,
  step = 1.0
): Row[] {
  const rows = rowsIn.map(r => ({ ...r }));
  const opts: CalcOptionsV2 = { mode };
  
  // CRITICAL: Store original total weight to maintain batch size
  const originalTotal = rows.reduce((sum, r) => sum + r.grams, 0);
  
  let bestM = calcMetricsV2(rows, opts);
  let best = objective(bestM, targets);

  // Multi-phase optimization with weight-constrained adjustment
  const phases = [
    { iters: Math.floor(maxIters * 0.4), step: step * 5.0 },  // Coarse search
    { iters: Math.floor(maxIters * 0.4), step: step * 2.0 },  // Medium search
    { iters: Math.floor(maxIters * 0.2), step: step * 0.5 }   // Fine tuning
  ];

  for (const phase of phases) {
    for (let iter = 0; iter < phase.iters; iter++) {
      let improved = false;

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (r.lock) continue;

        // Get ingredient properties for smart adjustments
        const ing = r.ing;
        const isFatSource = (ing.fat_pct ?? 0) > 5;
        const isMSNFSource = (ing.msnf_pct ?? 0) > 5;
        const isSugarSource = (ing.sugars_pct ?? 0) > 80;

        for (const dir of [+1, -1]) {
          const test = rows.map(x => ({ ...x }));
          
          // Adjust current ingredient
          const delta = dir * phase.step;
          test[i].grams = Math.max(
            test[i].min ?? 0,
            Math.min(test[i].max ?? 1e9, test[i].grams + delta)
          );

          // CRITICAL: Compensate by adjusting other ingredients to maintain total weight
          // Find unlocked ingredients of the same category to balance
          const compensation = delta;
          const compensatable = test
            .map((x, idx) => ({ row: x, idx }))
            .filter(x => !x.row.lock && x.idx !== i);

          if (compensatable.length > 0) {
            // Distribute compensation proportionally across unlocked ingredients
            const totalOther = compensatable.reduce((sum, x) => sum + x.row.grams, 0);
            if (totalOther > Math.abs(compensation)) {
              for (const { row, idx } of compensatable) {
                const proportion = row.grams / totalOther;
                const adjust = -compensation * proportion;
                test[idx].grams = Math.max(
                  test[idx].min ?? 0,
                  Math.min(test[idx].max ?? 1e9, test[idx].grams + adjust)
                );
              }
            }
          }

          // Verify total weight is maintained
          const newTotal = test.reduce((sum, x) => sum + x.grams, 0);
          if (Math.abs(newTotal - originalTotal) > 1.0) {
            // Scale to maintain exact original weight
            const scaleFactor = originalTotal / newTotal;
            for (const row of test) {
              if (!row.lock) {
                row.grams *= scaleFactor;
              }
            }
          }

          const m = calcMetricsV2(test, opts);
          const score = objective(m, targets);
          
          // Add penalty for weight deviation to ensure it stays constant
          const weightPenalty = Math.abs(m.total_g - originalTotal) * 10;
          const totalScore = score + weightPenalty;
          
          if (totalScore + 1e-6 < best + Math.abs(bestM.total_g - originalTotal) * 10) {
            best = score; 
            bestM = m;
            rows.splice(0, rows.length, ...test);
            improved = true;
          }
        }
      }
      if (!improved && phase.step <= 1.0) break;
    }
  }
  
  // FINAL: Ensure exact original weight is maintained
  const finalTotal = rows.reduce((sum, r) => sum + r.grams, 0);
  if (Math.abs(finalTotal - originalTotal) > 0.1) {
    const scaleFactor = originalTotal / finalTotal;
    for (const row of rows) {
      if (!row.lock) {
        row.grams *= scaleFactor;
      }
    }
  }
  
  return rows;
}