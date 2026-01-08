import { describe, it, expect } from 'vitest';
import { PasteAdvisorService } from '../pasteAdvisorService';
import type { PasteFormula } from '@/types/paste';

const pasteService = new PasteAdvisorService();

const createMockPaste = (overrides: Partial<PasteFormula> = {}): PasteFormula => ({
  id: 'test-paste',
  name: 'Test Paste',
  category: 'mixed',
  components: [],
  batch_size_g: 1000,
  water_pct: 20,
  sugars_pct: 50,
  fat_pct: 20,
  msnf_pct: 5,
  other_solids_pct: 5,
  ...overrides,
});

describe('PasteAdvisorService', () => {
  describe('calculateScientificMetrics', () => {
    it('should calculate total solids correctly', () => {
      const paste = createMockPaste({ water_pct: 30 });
      const metrics = pasteService.calculateScientificMetrics(paste);
      
      expect(metrics.totalSolids).toBe(70); // 100 - 30
    });

    it('should estimate water activity', () => {
      const paste = createMockPaste({
        lab: { brix_deg: 65 }
      });
      const metrics = pasteService.calculateScientificMetrics(paste);
      
      expect(metrics.aw).toBeLessThan(1);
      expect(metrics.aw).toBeGreaterThan(0);
    });

    it('should provide warnings for out-of-range fat', () => {
      const paste = createMockPaste({
        category: 'nut',
        fat_pct: 60 // Above 55% for nuts
      });
      const metrics = pasteService.calculateScientificMetrics(paste);
      
      expect(metrics.warnings.length).toBeGreaterThan(0);
      expect(metrics.warnings.some(w => w.includes('Fat content'))).toBe(true);
    });

    it('should warn about high water activity', () => {
      const paste = createMockPaste({
        lab: { brix_deg: 40, aw_est: 0.92 }
      });
      const metrics = pasteService.calculateScientificMetrics(paste);
      
      expect(metrics.warnings.some(w => w.includes('Water activity'))).toBe(true);
    });
  });

  describe('calculateViscosityProxy', () => {
    it('should classify pourable consistency', () => {
      const paste = createMockPaste({
        water_pct: 60,
        fat_pct: 5,
        sugars_pct: 20
      });
      const result = pasteService.calculateViscosityProxy(paste);
      
      expect(result.spreadability).toBe('pourable');
      expect(result.viscosity_index).toBeLessThan(40);
    });

    it('should classify spreadable consistency', () => {
      const paste = createMockPaste({
        water_pct: 20,
        fat_pct: 30,
        sugars_pct: 40
      });
      const result = pasteService.calculateViscosityProxy(paste);
      
      expect(result.spreadability).toBe('spreadable');
      expect(result.viscosity_index).toBeGreaterThanOrEqual(40);
      expect(result.viscosity_index).toBeLessThan(60);
    });

    it('should classify thick consistency', () => {
      const paste = createMockPaste({
        water_pct: 5,
        fat_pct: 45,
        sugars_pct: 40
      });
      const result = pasteService.calculateViscosityProxy(paste);
      
      expect(result.spreadability).toBe('thick');
      expect(result.viscosity_index).toBeGreaterThanOrEqual(60);
    });

    it('should provide recommendations for thin pastes', () => {
      const paste = createMockPaste({
        water_pct: 70,
        fat_pct: 5,
        sugars_pct: 15
      });
      const result = pasteService.calculateViscosityProxy(paste);
      
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations.some(r => r.includes('viscosity'))).toBe(true);
    });
  });

  describe('advise', () => {
    it('should recommend hot_fill for high-acid fruit paste', () => {
      const paste = createMockPaste({
        category: 'fruit',
        msnf_pct: 0,
        lab: { pH: 3.8, brix_deg: 65 }
      });
      const advice = pasteService.advise(paste);
      
      const hotFill = advice.find(a => a.method === 'hot_fill');
      expect(hotFill).toBeDefined();
      expect(hotFill!.confidence).toBeGreaterThan(0.5);
    });

    it('should recommend retort for dairy pastes', () => {
      const paste = createMockPaste({
        category: 'dairy',
        msnf_pct: 15,
        lab: { pH: 6.5 }
      });
      const advice = pasteService.advise(paste, { ambientPreferred: true });
      
      const retort = advice.find(a => a.method === 'retort');
      expect(retort).toBeDefined();
    });

    it('should always recommend frozen as option', () => {
      const paste = createMockPaste();
      const advice = pasteService.advise(paste);
      
      const frozen = advice.find(a => a.method === 'frozen');
      expect(frozen).toBeDefined();
      expect(frozen!.storage).toBe('frozen');
    });

    it('should recommend freeze_dry', () => {
      const paste = createMockPaste();
      const advice = pasteService.advise(paste);
      
      const freezeDry = advice.find(a => a.method === 'freeze_dry');
      expect(freezeDry).toBeDefined();
      expect(freezeDry!.storage).toBe('ambient');
    });

    it('should sort by confidence', () => {
      const paste = createMockPaste();
      const advice = pasteService.advise(paste);
      
      for (let i = 1; i < advice.length; i++) {
        expect(advice[i - 1].confidence).toBeGreaterThanOrEqual(advice[i].confidence);
      }
    });

    it('should provide packaging recommendations', () => {
      const paste = createMockPaste();
      const advice = pasteService.advise(paste);
      
      advice.forEach(a => {
        expect(a.packaging.length).toBeGreaterThan(0);
      });
    });
  });
});
