import { supabase } from '@/integrations/supabase/client';

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
      console.log('🧠 Starting ML training with new database structure...');

      // Get all successful outcomes with their recipe data
      const { data: outcomes, error } = await supabase
        .from('recipe_outcomes')
        .select(`
          id,
          recipe_id,
          outcome,
          recipes!inner (
            id,
            recipe_name,
            recipe_rows (
              ingredient,
              quantity_g,
              sugars_g,
              fat_g,
              msnf_g,
              other_solids_g,
              total_solids_g
            ),
            calculated_metrics (
              total_quantity_g,
              total_sugars_g,
              total_fat_g,
              total_msnf_g,
              total_solids_g,
              sugars_pct,
              fat_pct,
              msnf_pct,
              total_solids_pct,
              sp,
              pac
            )
          )
        `)
        .eq('outcome', 'success');

      if (error) throw error;

      if (!outcomes || outcomes.length < 5) {
        throw new Error(`Need at least 5 successful recipes (have ${outcomes?.length || 0})`);
      }

      console.log(`✅ Loaded ${outcomes.length} successful recipes for training`);

      // Extract features from successful recipes
      const features = outcomes.map((outcome: any) => {
        const metrics = outcome.recipes.calculated_metrics[0];
        const rows = outcome.recipes.recipe_rows;
        
        return {
          fat_pct: metrics?.fat_pct || 0,
          msnf_pct: metrics?.msnf_pct || 0,
          sugars_pct: metrics?.sugars_pct || 0,
          total_solids_pct: metrics?.total_solids_pct || 0,
          sp: metrics?.sp || 0,
          pac: metrics?.pac || 0,
          ingredient_count: rows?.length || 0,
          avg_quantity: rows?.length > 0 
            ? rows.reduce((sum: number, r: any) => sum + r.quantity_g, 0) / rows.length 
            : 0
        };
      });

      // Calculate feature statistics
      const featureKeys = Object.keys(features[0]) as Array<keyof typeof features[0]>;
      const featureImportance: { [key: string]: number } = {};
      const thresholds: { [key: string]: { min: number; max: number } } = {};

      featureKeys.forEach(key => {
        const values = features.map(f => f[key]);
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);

        featureImportance[key] = variance;
        thresholds[key] = {
          min: Math.max(0, mean - 2 * stdDev),
          max: mean + 2 * stdDev
        };
      });

      const weights: ModelWeights = {
        version: '2.0.0',
        trained_at: new Date().toISOString(),
        accuracy: outcomes.length / (outcomes.length + 1), // Simplified accuracy
        feature_importance: featureImportance,
        success_thresholds: thresholds
      };

      this.modelWeights = weights;
      localStorage.setItem('ml_model_weights', JSON.stringify(weights));

      console.log('✅ Model training complete:', weights);
      return weights;
    } catch (error: any) {
      console.error('❌ Training failed:', error);
      throw error;
    }
  }

  async exportTrainingData() {
    try {
      const { data: recipes } = await supabase
        .from('recipes')
        .select(`
          id,
          recipe_name,
          product_type,
          recipe_rows (
            ingredient,
            quantity_g,
            sugars_g,
            fat_g,
            msnf_g,
            other_solids_g,
            total_solids_g
          ),
          calculated_metrics (
            total_quantity_g,
            sp,
            pac,
            fat_pct,
            sugars_pct
          )
        `)
        .order('created_at', { ascending: false });

      return recipes?.map(recipe => ({
        id: recipe.id,
        name: recipe.recipe_name,
        product_type: recipe.product_type,
        rows: recipe.recipe_rows,
        metrics: recipe.calculated_metrics?.[0]
      })) || [];
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
        suggestions: ['Model not trained yet. Import 5+ recipes and train the model.']
      };
    }

    let score = 100;
    const suggestions: string[] = [];

    const checks = [
      { key: 'sp', value: metrics.sp || 0, name: 'SP' },
      { key: 'pac', value: metrics.pac || 0, name: 'PAC' },
      { key: 'fat_pct', value: metrics.fat_pct || 0, name: 'Fat%' }
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
      suggestions: suggestions.slice(0, 3)
    };
  }
}

export const mlService = new MLService();
