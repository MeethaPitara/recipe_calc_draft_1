import React, { createContext, useContext, useState, useEffect } from 'react';
import { IngredientService } from '@/services/ingredientService';
import type { IngredientData } from '@/types/ingredients';
import { useToast } from '@/hooks/use-toast';
import { trace } from "@/utils/tracer";

interface IngredientsContextType {
  ingredients: IngredientData[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const IngredientsContext = createContext<IngredientsContextType | undefined>(undefined);

export function IngredientsProvider({ children }: { children: React.ReactNode }) {
  const [ingredients, setIngredients] = useState<IngredientData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const { toast } = useToast();

  const loadIngredients = async () => {
    try {
      setIsLoading(true);
      setError(null);
      if (import.meta.env.DEV) {
        console.log('🔄 Loading ingredients from database (global context)...');
      }

      const data = await IngredientService.getIngredients();




      if (import.meta.env.DEV) {
        console.log(`✅ Loaded ${data.length} ingredients globally`);
      }

      trace('IngredientsContext.tsx', 'loadIngredients', 'SET_STATE', { count: data.length, sample: data[0] });
      setIngredients(data);

      // Only show empty database warning after first successful load, not during initial mount
      if (hasLoadedOnce && data.length === 0) {
        toast({
          title: 'No ingredients found',
          description: 'The ingredient database is empty. Please add ingredients first.',
          variant: 'destructive',
        });
      }
      setHasLoadedOnce(true);
    } catch (err: any) {
      console.error('❌ Failed to load ingredients:', err);
      setError(err.message || 'Failed to load ingredients');
      toast({
        title: 'Failed to load ingredients',
        description: err.message || 'Please check your connection and try again',
        variant: 'destructive',
      });
      setHasLoadedOnce(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadIngredients();
  }, []);

  return (
    <IngredientsContext.Provider
      value={{
        ingredients,
        isLoading,
        error,
        refetch: loadIngredients
      }}
    >
      {children}
    </IngredientsContext.Provider>
  );
}

export function useIngredients() {
  const context = useContext(IngredientsContext);
  if (context === undefined) {
    throw new Error('useIngredients must be used within an IngredientsProvider');
  }
  return context;
}
