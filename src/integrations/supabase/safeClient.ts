// Safe, lazy Supabase client accessor to avoid runtime crashes when env is not yet loaded
// Do NOT import client.ts directly in components. Use this instead.

export async function getSupabase() {
  // Fallback to hardcoded values if env vars aren't loaded (Cloud deployment issue)
  const url = import.meta.env.VITE_SUPABASE_URL || 'https://upugwezzqpxzjxpdxuar.supabase.co';
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwdWd3ZXp6cXB4emp4cGR4dWFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1NTE4MzAsImV4cCI6MjA3NTEyNzgzMH0.TYQJNuWk-WtkL0c-NLE-7q3P8xoZoApUXtMEDkek52U';

  console.log('✅ Supabase configured:', { 
    url: url ? '✓' : '✗', 
    key: key ? '✓' : '✗',
    source: import.meta.env.VITE_SUPABASE_URL ? 'env' : 'fallback'
  });

  try {
    const mod = await import('./client');
    console.log('✅ Supabase client loaded successfully');
    return mod.supabase;
  } catch (error) {
    console.error('❌ Failed to load Supabase client:', error);
    throw error;
  }
}

export function isBackendReady() {
  // Always return true since we have fallback values
  return true;
}
