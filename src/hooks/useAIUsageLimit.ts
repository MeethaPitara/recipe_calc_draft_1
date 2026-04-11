/**
 * useAIUsageLimit — Refactored to call backend API instead of direct Supabase.
 */

import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/apiClient';
import { authService } from '@/lib/auth/authService';

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

      const user = await authService.getUser();
      if (!user) {
        setUsed(0);
        setIsLoading(false);
        return;
      }

      const data = await apiGet<{ used: number; limit: number; remaining: number }>('/api/ai/usage');
      setUsed(data.used);
    } catch (err) {
      console.error('Error fetching AI usage:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch AI usage'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsageCount();
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
