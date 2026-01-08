import { useState, useCallback } from 'react';
import { getSupabase } from '@/integrations/supabase/safeClient';
import { useToast } from '@/hooks/use-toast';

interface AIAnalysis {
  successScore: number;
  texturePredict: string;
  warnings: string[];
  suggestions: string[];
  confidence: number;
}

export function useAIAnalysis() {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const analyze = useCallback(async (recipe: any[], metrics: any, productType: string) => {
    if (!recipe || recipe.length === 0) {
      setAnalysis(null);
      return;
    }

    setIsLoading(true);
    
    try {
      const supabase = await getSupabase();
      
      console.log('🤖 Calling AI analysis for recipe...');
      const { data, error } = await supabase.functions.invoke('analyze-recipe', {
        body: { recipe, metrics, productType }
      });

      if (error) {
        console.error('AI analysis error:', error);
        if (error.message?.includes('rate limit') || error.message?.includes('Rate limit')) {
          toast({
            title: 'Rate limit reached',
            description: 'You\'ve used all your AI analyses this hour. Try recipe validation or wait.',
            variant: 'destructive',
          });
        } else if (error.message?.includes('ENV_MISSING')) {
          toast({
            title: 'Backend not available',
            description: 'AI analysis requires backend connection. Using recipe validation.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'AI analysis failed',
            description: error.message || 'Please try again',
            variant: 'destructive',
          });
        }
        setAnalysis(null);
        return;
      }

      console.log('✅ AI analysis complete:', data);
      setAnalysis(data);
    } catch (error: any) {
      console.error('AI analysis error:', error);
      toast({
        title: 'AI analysis failed',
        description: error.message || 'Using recipe validation instead',
        variant: 'destructive',
      });
      setAnalysis(null);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  return { analysis, isLoading, analyze };
}
