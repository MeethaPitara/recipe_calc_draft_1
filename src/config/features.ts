/**
 * Feature Flags Configuration
 * Control visibility of experimental or optional features via environment variables
 * 
 * Environment Variables:
 * - VITE_FLAG_AI: "on" to enable AI features, "off" or omit to disable
 * - VITE_FLAG_SCIENCE_PANEL: "on" to enable science metrics panel, "off" or omit to disable
 * - VITE_FLAG_PRODUCTION_MODE: "on" to enable production mode toggle, "off" or omit to disable
 * 
 * Defaults to "on" (enabled) if environment variable is not set
 */

const ON = (v?: string) => (v ?? "").toLowerCase() === "on";

export const FEATURES = {
  AI_SUGGESTIONS: ON(import.meta.env.VITE_FLAG_AI) || import.meta.env.VITE_FLAG_AI === undefined,
  SCIENCE_PANEL: ON(import.meta.env.VITE_FLAG_SCIENCE_PANEL) || import.meta.env.VITE_FLAG_SCIENCE_PANEL === undefined,
  PRODUCTION_MODE: ON(import.meta.env.VITE_FLAG_PRODUCTION_MODE) || import.meta.env.VITE_FLAG_PRODUCTION_MODE === undefined
} as const;

export type FeatureKey = keyof typeof FEATURES;
