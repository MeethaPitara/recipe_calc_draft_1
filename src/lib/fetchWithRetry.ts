/**
 * Fetch with exponential backoff retry logic
 * Handles rate limits (429) and temporary failures (5xx)
 */

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<Response> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    onRetry
  } = retryOptions;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Success responses (2xx)
      if (response.ok) {
        return response;
      }

      // Don't retry client errors (4xx) except rate limits (429)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return response;
      }

      // Rate limit or server error - prepare to retry
      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);

      // If this is the last attempt, return the response
      if (attempt === maxRetries) {
        return response;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      
      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 0.3 * delay;
      const totalDelay = delay + jitter;

      console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${Math.round(totalDelay)}ms`);
      
      if (onRetry) {
        onRetry(attempt + 1, lastError);
      }

      await new Promise(resolve => setTimeout(resolve, totalDelay));

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // If this is the last attempt, throw
      if (attempt === maxRetries) {
        throw lastError;
      }

      // Calculate delay
      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      const jitter = Math.random() * 0.3 * delay;
      const totalDelay = delay + jitter;

      console.log(`Network error, retry ${attempt + 1}/${maxRetries} after ${Math.round(totalDelay)}ms`);
      
      if (onRetry) {
        onRetry(attempt + 1, lastError);
      }

      await new Promise(resolve => setTimeout(resolve, totalDelay));
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * Simplified wrapper for Supabase edge function calls with retry
 */
export async function invokeFunctionWithRetry<T = any>(
  supabase: any,
  functionName: string,
  body: any,
  retryOptions?: RetryOptions
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const result = await supabase.functions.invoke(functionName, { body });
    
    if (result.error) {
      return { data: null, error: new Error(result.error.message || 'Function invocation failed') };
    }

    return { data: result.data, error: null };
  } catch (error) {
    return { 
      data: null, 
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}
