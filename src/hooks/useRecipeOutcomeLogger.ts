import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook for logging recipe outcomes for ML training
 */
export const useRecipeOutcomeLogger = () => {
  const { toast } = useToast();

  const logOutcome = async (
    recipeId: string | null,
    outcome: 'success' | 'needs_improvement' | 'failed',
    actualTexture?: string,
    notes?: string,
    metrics?: any
  ) => {
    if (!recipeId) {
      toast({
        title: 'Cannot log outcome',
        description: 'Recipe must be saved first',
        variant: 'destructive',
      });
      return false;
    }

    try {
      const { data, error } = await supabase.functions.invoke('log-recipe-outcome', {
        body: {
          recipeId,
          outcome,
          texture: actualTexture,
          notes,
          metrics,
        },
      });

      if (error) throw error;

      toast({
        title: 'Feedback recorded',
        description: 'Thank you! Your feedback helps improve our AI.',
      });

      return true;
    } catch (error: any) {
      console.error('Failed to log outcome:', error);
      toast({
        title: 'Failed to record feedback',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }
  };

  return { logOutcome };
};
