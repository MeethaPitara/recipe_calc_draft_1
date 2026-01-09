import { getSupabase } from "@/integrations/supabase/safeClient";

/**
 * Log a feature usage event for analytics (no PII)
 * Fire-and-forget: errors are silently ignored
 * 
 * @param event - Event name (e.g., 'ai_suggest_open', 'optimize_apply')
 * @param meta - Optional metadata (avoid PII)
 */
export async function logEvent(event: string, meta?: Record<string, any>) {
  try {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    
    await supabase.from("events").insert({
      event,
      meta: meta || null,
      user_id: user?.id || null,
    });
  } catch (error) {
    // Silent fail - analytics should never break user experience
    console.debug('Analytics event failed:', event, error);
  }
}

/**
 * Common event names for consistency
 */
export const ANALYTICS_EVENTS = {
  // AI Features
  AI_SUGGEST_OPEN: 'ai_suggest_open',
  AI_SUGGEST_ACCEPT: 'ai_suggest_accept',
  AI_SUGGEST_DISMISS: 'ai_suggest_dismiss',
  
  // Optimization
  OPTIMIZE_OPEN: 'optimize_open',
  OPTIMIZE_APPLY: 'optimize_apply',
  OPTIMIZE_CANCEL: 'optimize_cancel',
  
  // Warnings
  WARN_EXPLAIN_OPEN: 'warn_explain_open',
  
  // Recipe Operations
  RECIPE_SAVE: 'recipe_save',
  RECIPE_LOAD: 'recipe_load',
  RECIPE_EXPORT: 'recipe_export',
  
  // Version Control
  VERSION_RESTORE: 'version_restore',
  VERSION_COMPARE: 'version_compare',
  
  // Production Mode
  PRODUCTION_MODE_ENABLE: 'production_mode_enable',
  PRODUCTION_MODE_PRINT: 'production_mode_print',
} as const;
