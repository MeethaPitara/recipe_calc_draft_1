/**
 * useAIAnalysis — Refactored to call backend API instead of Supabase edge functions.
 */

import { useState, useCallback } from 'react';
import { apiPost } from '@/lib/apiClient';
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
      console.log(' Calling AI analysis via backend...');
      const data = await apiPost<AIAnalysis>('/api/ai/optimize', {
        userPrompt: `Analyze this ${productType} recipe for quality and suggest improvements`,
        recipe: recipe.map(r => ({
          ingredient: r.ingredient || r.ing?.name,
          quantity_g: r.quantity_g || r.grams,
        })),
        targetParams: {
          lossPct: 5,
          mixDensity: 1.04,
          overrunPct: 27,
          skuSizeLiters: 0.75,
          targetVolumeLiters: 1,
        },
        mode: productType === 'ice_cream' ? 'ice_cream' : 'gelato',
        currentMetrics: metrics,
      });

      console.log(' AI analysis complete:', data);
      setAnalysis(data as any);
    } catch (error: any) {
      console.error('AI analysis error:', error);
      if (error.message?.includes('rate limit') || error.message?.includes('Rate limit')) {
        toast({
          title: 'Rate limit reached',
          description: 'You\'ve used all your AI analyses this hour. Try recipe validation or wait.',
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
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  return { analysis, isLoading, analyze };
}
