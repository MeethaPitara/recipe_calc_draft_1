import { useState, useEffect } from 'react';
import { recipeValidator } from '@/services/recipeValidator';

interface RecipeValidation {
  status: 'pass' | 'warn' | 'fail';
  score: number;
  suggestions: string[];
  confidence?: number;
}

export function useRecipeValidation(metrics: any, productType: string) {
  const [validation, setValidation] = useState<RecipeValidation | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!metrics || !productType) {
      setValidation(null);
      return;
    }

    setIsLoading(true);
    
    // Debounce validation
    const timer = setTimeout(() => {
      try {
        const result = recipeValidator.predictRecipeSuccess(metrics, productType);
        setValidation({
          status: result.status,
          score: result.score,
          suggestions: result.suggestions,
          confidence: result.confidence
        });
        console.log('Recipe Validation:', result);
      } catch (error) {
        console.error('Recipe validation error:', error);
        // Show a default validation even on error
        setValidation({
          status: 'warn',
          score: 70,
          suggestions: ['Unable to generate validation. Check recipe composition.'],
          confidence: 0.5
        });
      } finally {
        setIsLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [metrics, productType]);

  return { validation, isLoading };
}
