/**
 * Recipe Analysis Training Scheduler
 * Automatically trains analysis models when sufficient feedback is collected
 */

import { mlService } from '@/services/mlService';
import { getSupabase } from '@/integrations/supabase/safeClient';

export class MLTrainingScheduler {
  private static instance: MLTrainingScheduler;
  private intervalId: number | null = null;
  private readonly CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly MIN_OUTCOMES_FOR_TRAINING = 5;

  private constructor() {}

  static getInstance(): MLTrainingScheduler {
    if (!MLTrainingScheduler.instance) {
      MLTrainingScheduler.instance = new MLTrainingScheduler();
    }
    return MLTrainingScheduler.instance;
  }

  async start() {
    if (this.intervalId) {
      console.log('ML training scheduler already running');
      return;
    }

    // Check if backend is available before starting
    const { isBackendReady } = await import('@/integrations/supabase/safeClient');
    if (!isBackendReady()) {
      console.log('🧠 ML training scheduler: Backend not ready, skipping auto-training');
      return;
    }

    console.log('🧠 Starting ML training scheduler');
    
    // Initial check
    await this.checkAndTrain().catch(err => {
      console.log('ML: Initial training check failed, will retry later:', err.message);
    });

    // Schedule periodic checks
    this.intervalId = window.setInterval(() => {
      this.checkAndTrain().catch(err => {
        console.log('ML: Training check failed:', err.message);
      });
    }, this.CHECK_INTERVAL);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('ML training scheduler stopped');
    }
  }

  async checkAndTrain(): Promise<boolean> {
    try {
      // Check backend availability first
      const { isBackendReady } = await import('@/integrations/supabase/safeClient');
      if (!isBackendReady()) {
        return false;
      }

      const supabase = await getSupabase();
      const model = mlService.loadModel();
      const lastTrained = model?.trained_at || '2000-01-01';

      // Count new successful outcomes since last training (must have recipe_id)
      const { count, error } = await supabase
        .from('recipe_outcomes')
        .select('*', { count: 'exact', head: true })
        .eq('outcome', 'success')
        .not('recipe_id', 'is', null)
        .gt('created_at', lastTrained);

      if (error) {
        console.error('Failed to check training status:', error);
        return false;
      }

      if (!count || count < this.MIN_OUTCOMES_FOR_TRAINING) {
        console.log(`ML: ${count} new valid outcomes, need ${this.MIN_OUTCOMES_FOR_TRAINING} to train`);
        return false;
      }

      console.log(`🎯 ML: ${count} new outcomes detected - triggering training`);
      
      const weights = await mlService.trainModel();
      
      console.log(`✅ ML: Auto-trained successfully! Accuracy: ${Math.round(weights.accuracy * 100)}%`);
      
      // Refresh materialized view for better query performance
      try {
        await supabase.rpc('refresh_ml_training_dataset');
      } catch (viewError) {
        console.log('Note: Could not refresh training dataset view:', viewError);
      }

      return true;
    } catch (error: any) {
      console.error('ML auto-training failed:', error);
      return false;
    }
  }

  async manualTrain(): Promise<void> {
    console.log('🚀 Manual ML training triggered');
    await this.checkAndTrain();
  }
}

// Export singleton instance
export const mlScheduler = MLTrainingScheduler.getInstance();
