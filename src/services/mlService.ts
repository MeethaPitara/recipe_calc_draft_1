/**
 * mlService — Frontend ML operations.
 * All Supabase queries moved to backend. This now delegates to /api/ml/*.
 */

import { apiPost, apiGet } from '@/lib/apiClient';

export interface ModelWeights {
  version: string;
  trained_at: string;
  accuracy: number;
  feature_importance: { [key: string]: number };
  success_thresholds: { [key: string]: { min: number; max: number } };
}

export class MLService {
  private modelWeights: ModelWeights | null = null;

  loadModel(): ModelWeights | null {
    if (this.modelWeights) return this.modelWeights;

    try {
      const stored = localStorage.getItem('ml_model_weights');
      if (stored) {
        this.modelWeights = JSON.parse(stored);
        return this.modelWeights;
      }
    } catch (e) {
      console.error('Failed to load model weights:', e);
    }

    return null;
  }

  async trainModel(): Promise<ModelWeights> {
    try {
      console.log(' Starting ML training via backend...');
      const weights = await apiPost<ModelWeights>('/api/ml/train');

      this.modelWeights = weights;
      localStorage.setItem('ml_model_weights', JSON.stringify(weights));

      console.log(' Model training complete:', weights);
      return weights;
    } catch (error: any) {
      console.error(' Training failed:', error);
      throw error;
    }
  }

  async exportTrainingData() {
    try {
      return await apiGet<any[]>('/api/ml/export');
    } catch (error) {
      console.error('Export failed:', error);
      return [];
    }
  }

  predictSuccess(metrics: any): {
    status: 'pass' | 'warn' | 'fail';
    score: number;
    suggestions: string[];
  } {
    const model = this.loadModel();

    if (!model) {
      return {
        status: 'warn',
        score: 50,
        suggestions: ['Model not trained yet. Import 5+ recipes and train the model.'],
      };
    }

    let score = 100;
    const suggestions: string[] = [];

    const checks = [
      { key: 'sp', value: metrics.sp || 0, name: 'SP' },
      { key: 'pac', value: metrics.pac || 0, name: 'PAC' },
      { key: 'fat_pct', value: metrics.fat_pct || 0, name: 'Fat%' },
    ];

    checks.forEach(check => {
      const threshold = model.success_thresholds[check.key];
      if (threshold) {
        if (check.value < threshold.min) {
          score -= 15;
          suggestions.push(`${check.name} below optimal range`);
        } else if (check.value > threshold.max) {
          score -= 15;
          suggestions.push(`${check.name} above optimal range`);
        }
      }
    });

    return {
      status: score >= 80 ? 'pass' : score >= 60 ? 'warn' : 'fail',
      score: Math.max(0, score),
      suggestions: suggestions.slice(0, 3),
    };
  }
}

export const mlService = new MLService();
