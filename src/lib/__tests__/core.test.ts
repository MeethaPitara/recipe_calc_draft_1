import { describe, it, expect } from 'vitest';
import { IngredientData } from '@/types/ingredients';

import { calcMetrics } from '../calc';


const createMockIngredient = (overrides: Partial<IngredientData> = {}): IngredientData => ({
  id: 'test-id',
  name: 'Test Ingredient',
  water_pct: 50,
  fat_pct: 10,
  sugars_pct: 30,
  msnf_pct: 5,
  other_solids_pct: 5,
  sp_coeff: 1.0,
  pac_coeff: 1.0,
  category: 'dairy' as const,
  ...overrides,
});

describe('calcMetrics', () => {
  describe('Total Solids Calculation', () => {
    it('should calculate total solids correctly for single ingredient', () => {
      const rows = [
        { ing: createMockIngredient({ water_pct: 60, fat_pct: 20, sugars_pct: 10, msnf_pct: 5, other_solids_pct: 5 }), grams: 100 }
      ];
      const metrics = calcMetrics(rows);
      
      // Total solids = 100 - water = 100 - 60 = 40
      expect(metrics.ts_add_pct).toBeCloseTo(40, 1);
    });

    it('should calculate total solids for multiple ingredients', () => {
      const rows = [
        { ing: createMockIngredient({ water_pct: 50, fat_pct: 10, sugars_pct: 25, msnf_pct: 10, other_solids_pct: 5 }), grams: 500 },
        { ing: createMockIngredient({ water_pct: 10, fat_pct: 30, sugars_pct: 40, msnf_pct: 15, other_solids_pct: 5 }), grams: 300 }
      ];
      const metrics = calcMetrics(rows);
      
      // Weighted average: (500*50 + 300*90) / 800 = (25000 + 27000) / 800 = 65
      expect(metrics.ts_add_pct).toBeCloseTo(65, 1);
    });
  });

  describe('MSNF Calculation', () => {
    it('should calculate MSNF correctly', () => {
      const rows = [
        { ing: createMockIngredient({ msnf_pct: 10 }), grams: 100 }
      ];
      const metrics = calcMetrics(rows);
      
      expect(metrics.msnf_pct).toBeCloseTo(10, 1);
    });

    it('should weight MSNF across multiple ingredients', () => {
      const rows = [
        { ing: createMockIngredient({ msnf_pct: 8 }), grams: 600 },
        { ing: createMockIngredient({ msnf_pct: 12 }), grams: 400 }
      ];
      const metrics = calcMetrics(rows);
      
      // (600*8 + 400*12) / 1000 = (4800 + 4800) / 1000 = 9.6
      expect(metrics.msnf_pct).toBeCloseTo(9.6, 1);
    });
  });

  describe('Fat Calculation', () => {
    it('should calculate fat percentage correctly', () => {
      const rows = [
        { ing: createMockIngredient({ fat_pct: 15 }), grams: 200 }
      ];
      const metrics = calcMetrics(rows);
      
      expect(metrics.fat_pct).toBeCloseTo(15, 1);
    });

    it('should handle zero fat ingredients', () => {
      const rows = [
        { ing: createMockIngredient({ fat_pct: 0 }), grams: 100 }
      ];
      const metrics = calcMetrics(rows);
      
      expect(metrics.fat_pct).toBe(0);
    });
  });

  describe('Sugars Calculation', () => {
    it('should calculate sugar percentage correctly', () => {
      const rows = [
        { ing: createMockIngredient({ sugars_pct: 20 }), grams: 100 }
      ];
      const metrics = calcMetrics(rows);
      
      expect(metrics.sugars_pct).toBeCloseTo(20, 1);
    });

    it('should weight sugars across multiple ingredients', () => {
      const rows = [
        { ing: createMockIngredient({ sugars_pct: 15 }), grams: 400 },
        { ing: createMockIngredient({ sugars_pct: 25 }), grams: 600 }
      ];
      const metrics = calcMetrics(rows);
      
      // (400*15 + 600*25) / 1000 = (6000 + 15000) / 1000 = 21
      expect(metrics.sugars_pct).toBeCloseTo(21, 1);
    });
  });

  describe('SP (Sweetening Power) Calculation', () => {
    it('should calculate SP correctly with coefficient', () => {
      const rows = [
        { ing: createMockIngredient({ sugars_pct: 20, sp_coeff: 1.2 }), grams: 100 }
      ];
      const metrics = calcMetrics(rows);
      
      // SP = sugars_pct * sp_coeff = 20 * 1.2 = 24
      expect(metrics.sp).toBeCloseTo(24, 1);
    });

    it('should weight SP across multiple sugars', () => {
      const rows = [
        { ing: createMockIngredient({ sugars_pct: 10, sp_coeff: 1.0 }), grams: 500 },
        { ing: createMockIngredient({ sugars_pct: 20, sp_coeff: 0.7 }), grams: 500 }
      ];
      const metrics = calcMetrics(rows);
      
      // Weighted SP: (500*10*1.0 + 500*20*0.7) / 1000 = (5000 + 7000) / 1000 = 12
      expect(metrics.sp).toBeCloseTo(12, 1);
    });
  });

  describe('PAC (Anti-freezing Capacity) Calculation', () => {
    it('should calculate PAC correctly with coefficient', () => {
      const rows = [
        { ing: createMockIngredient({ sugars_pct: 20, pac_coeff: 1.9 }), grams: 100 }
      ];
      const metrics = calcMetrics(rows);
      
      // PAC = sugars_pct * pac_coeff = 20 * 1.9 = 38
      expect(metrics.pac).toBeCloseTo(38, 1);
    });

    it('should weight PAC across multiple sugars', () => {
      const rows = [
        { ing: createMockIngredient({ sugars_pct: 15, pac_coeff: 1.9 }), grams: 600 },
        { ing: createMockIngredient({ sugars_pct: 10, pac_coeff: 2.5 }), grams: 400 }
      ];
      const metrics = calcMetrics(rows);
      
      // Weighted PAC: (600*15*1.9 + 400*10*2.5) / 1000 = (17100 + 10000) / 1000 = 27.1
      expect(metrics.pac).toBeCloseTo(27.1, 1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty recipe', () => {
      const metrics = calcMetrics([]);
      
      expect(metrics.ts_add_pct).toBe(0);
      expect(metrics.fat_pct).toBe(0);
      expect(metrics.sugars_pct).toBe(0);
      expect(metrics.sp).toBe(0);
      expect(metrics.pac).toBe(0);
    });

    it('should handle zero gram ingredients', () => {
      const rows = [
        { ing: createMockIngredient(), grams: 0 }
      ];
      const metrics = calcMetrics(rows);
      
      expect(metrics.ts_add_pct).toBe(0);
    });

    it('should handle very large batches', () => {
      const rows = [
        { ing: createMockIngredient({ sugars_pct: 20, fat_pct: 10 }), grams: 10000 }
      ];
      const metrics = calcMetrics(rows);
      
      expect(metrics.sugars_pct).toBeCloseTo(20, 1);
      expect(metrics.fat_pct).toBeCloseTo(10, 1);
    });
  });
});
