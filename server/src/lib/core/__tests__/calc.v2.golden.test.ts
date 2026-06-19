/**
 * calc.v2.golden.test.ts — REGRESSION LOCK for the science engine.
 * ----------------------------------------------------------------
 * These numbers were verified by independent hand-calculation (Engineering
 * Brief v2, Part 0). Their ONLY job is to fail the build if a refactor changes
 * what the engine computes. Run this BEFORE moving warnings/classification out
 * of calc.v2.ts, and keep it green through every cleanup commit.
 *
 * If a value here legitimately needs to change (e.g. you fix a coefficient in
 * scienceConfig), update the expected value in the SAME commit, with a comment
 * saying why. Never "make the test pass" by loosening tolerance.
 */
import { describe, it, expect } from 'vitest';
import { calcMetricsV2 } from '../calc.v2.js';

// keep the tracer quiet during tests
process.env.NODE_ENV = 'production';

const I = (o: any) => o; // ingredient shorthand
const near = (got: number, want: number, tol = 0.02) =>
  expect(Math.abs(got - want)).toBeLessThanOrEqual(tol);

describe('calc.v2 golden regression', () => {

  it('Part-0 verified recipe (hand-calculated)', () => {
    const rows = [
      { ing: I({ id:'milk', name:'Milk', category:'dairy', water_pct:87.4, fat_pct:3.6, msnf_pct:9, lactose_pct:4.8, sugars_pct:0, other_solids_pct:0 }), grams:500 },
      { ing: I({ id:'sucrose', name:'Sucrose', category:'sugar', water_pct:0, fat_pct:0, sugars_pct:100 }), grams:160 },
      { ing: I({ id:'dextrose', name:'Dextrose', category:'sugar', water_pct:0, fat_pct:0, sugars_pct:100 }), grams:40 },
      { ing: I({ id:'cream', name:'Cream40', category:'dairy', water_pct:55, fat_pct:40, msnf_pct:5, lactose_pct:2.7, sugars_pct:0 }), grams:200 },
      { ing: I({ id:'smp', name:'SMP', category:'dairy', water_pct:4, fat_pct:0, msnf_pct:96, lactose_pct:51, protein_pct:35, sugars_pct:0 }), grams:50 },
      { ing: I({ id:'water', name:'Water', category:'other', water_pct:100, fat_pct:0 }), grams:50 },
    ];
    const m: any = calcMetricsV2(rows as any, { mode:'gelato' } as any);
    near(m.total_g, 1000, 0.001);
    near(m.fat_pct, 9.80);
    near(m.msnf_pct, 10.30);
    near(m.nonLactoseSugars_pct, 20.00);
    near(m.ts_pct, 40.10);
    near(m.protein_pct, 3.73, 0.05);
    near(m.lactose_pct, 5.49);
    near(m.se_g, 284.90, 0.05);
    near(m.afp_index, 28.49);
    near(m.sp_pct, 19.44, 0.05);
    near(m.pod_index, 76.26, 0.05);
    near(m.fpdt, 3.655, 0.01);
  });

  it('white base (regression snapshot)', () => {
    const rows = [
      { ing: I({ id:'milk', name:'Whole Milk', category:'dairy', water_pct:87.4, fat_pct:3.6, msnf_pct:9, lactose_pct:4.8, sugars_pct:0 }), grams:600 },
      { ing: I({ id:'cream', name:'Cream25', category:'dairy', water_pct:67.5, fat_pct:25, msnf_pct:6.5, lactose_pct:3.5, sugars_pct:0 }), grams:120 },
      { ing: I({ id:'smp', name:'SMP', category:'dairy', water_pct:4, fat_pct:0, msnf_pct:96, lactose_pct:51, protein_pct:35, sugars_pct:0 }), grams:40 },
      { ing: I({ id:'sucrose', name:'Sucrose', category:'sugar', water_pct:0, fat_pct:0, sugars_pct:100 }), grams:140 },
      { ing: I({ id:'dextrose', name:'Dextrose', category:'sugar', water_pct:0, fat_pct:0, sugars_pct:100 }), grams:30 },
      { ing: I({ id:'water', name:'Water', category:'other', water_pct:100, fat_pct:0 }), grams:70 },
    ];
    const m: any = calcMetricsV2(rows as any, { mode:'gelato' } as any);
    near(m.fat_pct, 5.16);  near(m.msnf_pct, 10.02);  near(m.ts_pct, 32.18);
    near(m.se_g, 245.90, 0.05);  near(m.fpdt, 2.5197, 0.01);
    near(m.afp_index, 24.59);  near(m.sp_pct, 16.7744, 0.05);  near(m.pod_index, 75.0868, 0.05);
  });

  it('lemon sorbet (regression snapshot)', () => {
    const rows = [
      { ing: I({ id:'water', name:'Water', category:'other', water_pct:100, fat_pct:0 }), grams:600 },
      { ing: I({ id:'sucrose', name:'Sucrose', category:'sugar', water_pct:0, fat_pct:0, sugars_pct:100 }), grams:220 },
      { ing: I({ id:'dextrose', name:'Dextrose', category:'sugar', water_pct:0, fat_pct:0, sugars_pct:100 }), grams:60 },
      { ing: I({ id:'lemon', name:'Lemon juice', category:'fruit', water_pct:92, fat_pct:0, sugars_pct:2, other_solids_pct:6 }), grams:120 },
    ];
    const m: any = calcMetricsV2(rows as any, { mode:'sorbet' } as any);
    near(m.nonLactoseSugars_pct, 28.24);  near(m.ts_pct, 28.96);
    near(m.se_g, 327.40, 0.05);  near(m.fpdt, 3.4539, 0.01);
    near(m.afp_index, 32.74);  near(m.sp_pct, 26.08, 0.05);
  });

  it('lactose is NOT double-counted in total solids', () => {
    // SMP-only mix: TS must = fat + msnf + addedSugar + other, with lactose living INSIDE msnf
    const rows = [
      { ing: I({ id:'smp', name:'SMP', category:'dairy', water_pct:4, fat_pct:0, msnf_pct:96, lactose_pct:51, protein_pct:35, sugars_pct:0 }), grams:100 },
      { ing: I({ id:'water', name:'Water', category:'other', water_pct:100, fat_pct:0 }), grams:900 },
    ];
    const m: any = calcMetricsV2(rows as any, { mode:'gelato' } as any);
    // TS should be ~9.6% (96% of 100g), NOT inflated by adding lactose again
    near(m.ts_pct, 9.6, 0.1);
  });

  it('dextrose depresses freezing point MORE than sucrose (AFP direction sanity)', () => {
    const base = (sugarId: string) => ([
      { ing: I({ id:'water', name:'Water', category:'other', water_pct:100, fat_pct:0 }), grams:800 },
      { ing: I({ id:sugarId, name:sugarId, category:'sugar', water_pct:0, fat_pct:0, sugars_pct:100 }), grams:200 },
    ]);
    const suc: any = calcMetricsV2(base('sucrose') as any, { mode:'sorbet' } as any);
    const dex: any = calcMetricsV2(base('dextrose') as any, { mode:'sorbet' } as any);
    expect(dex.fpdt).toBeGreaterThan(suc.fpdt); // dextrose AFP 1.75 > sucrose 1.00
  });
});
