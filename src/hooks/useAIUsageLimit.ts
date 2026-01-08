import { useState, useEffect } from 'react';
import { getSupabase } from '@/integrations/supabase/safeClient';

interface AIUsageLimit {
  used: number;
  limit: number;
  remaining: number;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to track AI usage limits per user
 * Default limit: 10 uses per hour
 */
export function useAIUsageLimit(limitPerHour: number = 10): AIUsageLimit {
  const [used, setUsed] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUsageCount = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const supabase = await getSupabase();
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError || !userData?.user) {
        // User not logged in - no usage tracking
        setUsed(0);
        setIsLoading(false);
        return;
      }

      const userId = userData.user.id;
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago

      const { count, error: countError } = await supabase
        .from('ai_usage_log')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('function_name', ['suggest-ingredient', 'explain-warning', 'analyze-recipe', 'analyze-csv'])
        .gt('created_at', since);

      if (countError) {
        throw countError;
      }

      setUsed(count || 0);
    } catch (err) {
      console.error('Error fetching AI usage:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch AI usage'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsageCount();

    // Refresh every 30 seconds
    const interval = setInterval(fetchUsageCount, 30000);

    return () => clearInterval(interval);
  }, []);

  return {
    used,
    limit: limitPerHour,
    remaining: Math.max(0, limitPerHour - used),
    isLoading,
    error,
    refetch: fetchUsageCount,
  };
}
