/**
 * Feature Flag Utility
 * 
 * Centralizes logic for enabling/disabling advanced features.
 * Controlled by NEXT_PUBLIC_ENABLE_ADVANCED environment variable.
 */

export const isAdvancedMode = (): boolean => {
    // Vite uses import.meta.env
    return import.meta.env.VITE_ENABLE_ADVANCED === 'true';
};
