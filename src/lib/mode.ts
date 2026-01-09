/**
 * Mode Resolver - Single Source of Truth
 * Centralizes product type → calculation mode mapping
 */

import type { Mode } from '@/types/mode';

/**
 * Resolve product type to calculation mode
 * Single source of truth for mode mapping across the entire app
 * 
 * @param productType - Product type string from UI or database
 * @returns Standardized Mode type for calculations
 */
export function resolveMode(productType: string): Mode {
  const normalized = productType.toLowerCase().trim();
  
  if (normalized === 'ice_cream' || normalized === 'ice cream') return 'ice_cream';
  if (normalized === 'gelato') return 'gelato';
  if (normalized === 'sorbet') return 'sorbet';
  if (normalized === 'kulfi') return 'kulfi';
  
  // Safe fallback
  return 'gelato';
}

/**
 * Map mode to product constraints key
 * Detects fruit gelato vs white gelato based on ingredients
 * 
 * @param mode - Calculation mode
 * @param hasfruit - Whether recipe contains fruit ingredients
 * @returns Product constraint key for validation
 */
export function resolveProductKey(mode: Mode, hasfruit: boolean = false): string {
  if (mode === 'sorbet') return 'sorbet';
  if (mode === 'ice_cream') return 'ice_cream';
  if (mode === 'kulfi') return 'kulfi';
  
  // Detect fruit gelato vs white gelato
  if (mode === 'gelato') {
    return hasfruit ? 'gelato_fruit' : 'gelato_white';
  }
  
  return 'gelato_white';
}
