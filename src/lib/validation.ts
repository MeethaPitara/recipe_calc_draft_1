// Input validation and sanitization using best practices
import type { IngredientData } from '@/types/ingredients';

export type ValidationResult<T> = {
  success: boolean;
  data?: T;
  errors: string[];
};

// =============================================================================
// Core Validators
// =============================================================================

/** Safe number that guards against NaN/Infinity */
export function safeNumber(value: any, fallback: number = 0): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return num;
}

/** Guards a calculation result, returning fallback if NaN/Infinity */
export function guardResult(value: number, fallback: number = 0, context?: string): number {
  if (!Number.isFinite(value)) {
    if (import.meta.env.DEV && context) {
      console.warn(`[Validation] Invalid result in ${context}: ${value}, using fallback ${fallback}`);
    }
    return fallback;
  }
  return value;
}

/** Clamp a value between min and max, with NaN guard */
export function clamp(value: number, min: number, max: number): number {
  const safe = safeNumber(value, min);
  return Math.max(min, Math.min(max, safe));
}

// Number validation with bounds
export function validateNumber(
  value: any,
  options: {
    min?: number;
    max?: number;
    integer?: boolean;
    required?: boolean;
  } = {}
): ValidationResult<number> {
  const errors: string[] = [];
  
  if (value === undefined || value === null || value === '') {
    if (options.required) {
      errors.push('Value is required');
      return { success: false, errors };
    }
    return { success: true, data: 0, errors: [] };
  }
  
  const num = Number(value);
  
  if (isNaN(num) || !isFinite(num)) {
    errors.push('Value must be a valid number');
    return { success: false, errors };
  }
  
  if (options.integer && !Number.isInteger(num)) {
    errors.push('Value must be an integer');
  }
  
  if (options.min !== undefined && num < options.min) {
    errors.push(`Value must be at least ${options.min}`);
  }
  
  if (options.max !== undefined && num > options.max) {
    errors.push(`Value must be at most ${options.max}`);
  }
  
  return errors.length > 0
    ? { success: false, errors }
    : { success: true, data: num, errors: [] };
}

// String validation with length and pattern
export function validateString(
  value: any,
  options: {
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    required?: boolean;
    trim?: boolean;
  } = {}
): ValidationResult<string> {
  const errors: string[] = [];
  
  if (value === undefined || value === null || value === '') {
    if (options.required) {
      errors.push('Value is required');
      return { success: false, errors };
    }
    return { success: true, data: '', errors: [] };
  }
  
  let str = String(value);
  if (options.trim) str = str.trim();
  
  if (options.minLength !== undefined && str.length < options.minLength) {
    errors.push(`Value must be at least ${options.minLength} characters`);
  }
  
  if (options.maxLength !== undefined && str.length > options.maxLength) {
    errors.push(`Value must be at most ${options.maxLength} characters`);
  }
  
  if (options.pattern && !options.pattern.test(str)) {
    errors.push('Value format is invalid');
  }
  
  return errors.length > 0
    ? { success: false, errors }
    : { success: true, data: str, errors: [] };
}

// =============================================================================
// Ingredient Validation
// =============================================================================

export interface IngredientCompositionErrors {
  hasErrors: boolean;
  totalComposition?: string;
  negativeValues?: string[];
  missingData?: string[];
  nanValues?: string[];
}

/** Validate ingredient composition sums to ~100% and has no invalid values */
export function validateIngredientComposition(ingredient: IngredientData): IngredientCompositionErrors {
  const errors: IngredientCompositionErrors = { hasErrors: false };
  const negativeValues: string[] = [];
  const nanValues: string[] = [];
  
  // Check for NaN/Infinity
  const fields = ['water_pct', 'fat_pct', 'msnf_pct', 'sugars_pct', 'other_solids_pct'] as const;
  
  for (const field of fields) {
    const val = ingredient[field];
    if (val !== undefined && val !== null && !Number.isFinite(val)) {
      nanValues.push(field.replace('_pct', ''));
    }
    if (val !== undefined && val !== null && val < 0) {
      negativeValues.push(field.replace('_pct', ''));
    }
  }
  
  if (nanValues.length > 0) {
    errors.hasErrors = true;
    errors.nanValues = nanValues;
  }
  
  if (negativeValues.length > 0) {
    errors.hasErrors = true;
    errors.negativeValues = negativeValues;
  }
  
  // Calculate total composition
  const water = safeNumber(ingredient.water_pct);
  const fat = safeNumber(ingredient.fat_pct);
  const msnf = safeNumber(ingredient.msnf_pct);
  const sugars = safeNumber(ingredient.sugars_pct);
  const other = safeNumber(ingredient.other_solids_pct);
  
  const total = water + fat + msnf + sugars + other;
  
  // Allow 1% tolerance for rounding
  if (total < 99 || total > 101) {
    errors.hasErrors = true;
    errors.totalComposition = `Composition sums to ${total.toFixed(1)}% (expected ~100%)`;
  }
  
  return errors;
}

/** Validate all ingredients in a recipe, return user-friendly error messages */
export function validateRecipeIngredients(
  rows: Array<{ ingredientData?: IngredientData | null; ingredient: string; quantity_g: number }>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  for (const row of rows) {
    if (!row.ingredientData) continue;
    if (row.quantity_g <= 0) continue;
    
    const composition = validateIngredientComposition(row.ingredientData);
    
    if (composition.nanValues?.length) {
      errors.push(`"${row.ingredient}" has invalid values: ${composition.nanValues.join(', ')}`);
    }
    
    if (composition.negativeValues?.length) {
      errors.push(`"${row.ingredient}" has negative percentages: ${composition.negativeValues.join(', ')}`);
    }
    
    if (composition.totalComposition && !composition.nanValues?.length) {
      errors.push(`"${row.ingredient}": ${composition.totalComposition}`);
    }
  }
  
  return { valid: errors.length === 0, errors };
}

// =============================================================================
// Balancing Error Messages
// =============================================================================

export type BalancingFailureReason = 
  | 'no_fat_source'
  | 'no_msnf_source'
  | 'no_water_source'
  | 'no_sugar_source'
  | 'insufficient_flexibility'
  | 'conflicting_constraints'
  | 'numerical_instability'
  | 'timeout'
  | 'unknown';

export interface BalancingErrorInfo {
  reason: BalancingFailureReason;
  title: string;
  description: string;
  suggestion: string;
}

const BALANCING_ERROR_MESSAGES: Record<BalancingFailureReason, Omit<BalancingErrorInfo, 'reason'>> = {
  no_fat_source: {
    title: 'Missing Fat Source',
    description: 'Your recipe lacks ingredients that provide fat.',
    suggestion: 'Add cream, butter, or another fat-containing ingredient.'
  },
  no_msnf_source: {
    title: 'Missing Milk Solids',
    description: 'Your recipe lacks ingredients that provide milk solids non-fat (MSNF).',
    suggestion: 'Add skim milk powder (SMP), milk, or cream to provide MSNF.'
  },
  no_water_source: {
    title: 'Missing Water Source',
    description: 'Your recipe needs a water source to balance properly.',
    suggestion: 'Add water, milk, or fruit purée to provide the liquid base.'
  },
  no_sugar_source: {
    title: 'Missing Sweetener',
    description: 'Your recipe lacks sugar or sweetening ingredients.',
    suggestion: 'Add sucrose, dextrose, or another sweetener.'
  },
  insufficient_flexibility: {
    title: 'Not Enough Adjustable Ingredients',
    description: 'The optimizer needs at least 3-4 ingredients to balance properly.',
    suggestion: 'Add water and/or skim milk powder to give the optimizer room to adjust.'
  },
  conflicting_constraints: {
    title: 'Conflicting Requirements',
    description: 'Your ingredient mix cannot meet all target ranges simultaneously.',
    suggestion: 'Try adjusting your base ingredients or switching to a different product type.'
  },
  numerical_instability: {
    title: 'Calculation Error',
    description: 'The optimizer encountered numerical issues with your recipe.',
    suggestion: 'Check for unusual ingredient compositions or very small/large quantities.'
  },
  timeout: {
    title: 'Optimization Timeout',
    description: 'The recipe is too complex to balance within the time limit.',
    suggestion: 'Simplify your recipe by removing specialty ingredients or start with a template.'
  },
  unknown: {
    title: 'Balancing Failed',
    description: 'The optimizer could not find a valid solution.',
    suggestion: 'Try adding water and SMP, or start from a recipe template.'
  }
};

/** Get user-friendly error info for a balancing failure */
export function getBalancingErrorInfo(
  reason: BalancingFailureReason,
  context?: { currentFat?: number; currentMSNF?: number; currentSugar?: number }
): BalancingErrorInfo {
  const info = BALANCING_ERROR_MESSAGES[reason];
  
  // Add context-specific details
  let description = info.description;
  if (context) {
    if (reason === 'no_fat_source' && context.currentFat !== undefined) {
      description += ` Current fat: ${context.currentFat.toFixed(1)}%.`;
    }
    if (reason === 'no_msnf_source' && context.currentMSNF !== undefined) {
      description += ` Current MSNF: ${context.currentMSNF.toFixed(1)}%.`;
    }
  }
  
  return { reason, ...info, description };
}

/** Diagnose balancing failure and return appropriate error */
export function diagnoseBalancingFailure(
  hasWater: boolean,
  hasFat: boolean,
  hasMSNF: boolean,
  hasSugar: boolean,
  ingredientCount: number,
  errorMessage?: string
): BalancingFailureReason {
  if (!hasFat) return 'no_fat_source';
  if (!hasMSNF) return 'no_msnf_source';
  if (!hasWater) return 'no_water_source';
  if (!hasSugar) return 'no_sugar_source';
  if (ingredientCount < 3) return 'insufficient_flexibility';
  
  if (errorMessage?.toLowerCase().includes('infeasible')) return 'conflicting_constraints';
  if (errorMessage?.toLowerCase().includes('nan') || errorMessage?.toLowerCase().includes('infinity')) {
    return 'numerical_instability';
  }
  if (errorMessage?.toLowerCase().includes('timeout') || errorMessage?.toLowerCase().includes('iteration')) {
    return 'timeout';
  }
  
  return 'unknown';
}

// =============================================================================
// Recipe & Form Validators
// =============================================================================

export function validateIngredientAmount(amount: any): ValidationResult<number> {
  return validateNumber(amount, {
    min: 0,
    max: 100000, // 100kg max per ingredient
    required: true
  });
}

export function validateRecipeName(name: any): ValidationResult<string> {
  return validateString(name, {
    minLength: 1,
    maxLength: 100,
    required: true,
    trim: true,
    pattern: /^[a-zA-Z0-9\s\-_()]+$/
  });
}

export function validateTemperature(temp: any, unit: 'C' | 'F' = 'C'): ValidationResult<number> {
  const bounds = unit === 'C' 
    ? { min: -30, max: 150 }
    : { min: -22, max: 302 };
  
  return validateNumber(temp, { ...bounds, required: true });
}

export function validatePercentage(pct: any): ValidationResult<number> {
  return validateNumber(pct, { min: 0, max: 100, required: false });
}

export function validatePH(ph: any): ValidationResult<number> {
  return validateNumber(ph, { min: 0, max: 14, required: false });
}

// Sanitize user input to prevent XSS
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();
}

// Validate and sanitize recipe object
export function validateRecipe(recipe: any): ValidationResult<{ [key: string]: number }> {
  const errors: string[] = [];
  
  if (typeof recipe !== 'object' || recipe === null || Array.isArray(recipe)) {
    return { success: false, errors: ['Recipe must be an object'] };
  }
  
  const validated: { [key: string]: number } = {};
  
  for (const [ingredient, amount] of Object.entries(recipe)) {
    const nameResult = validateString(ingredient, {
      minLength: 1,
      maxLength: 50,
      required: true,
      trim: true
    });
    
    if (!nameResult.success) {
      errors.push(`Invalid ingredient name "${ingredient}": ${nameResult.errors.join(', ')}`);
      continue;
    }
    
    const amountResult = validateIngredientAmount(amount);
    if (!amountResult.success) {
      errors.push(`Invalid amount for "${ingredient}": ${amountResult.errors.join(', ')}`);
      continue;
    }
    
    validated[sanitizeInput(nameResult.data!)] = amountResult.data!;
  }
  
  if (Object.keys(validated).length === 0) {
    errors.push('Recipe must contain at least one valid ingredient');
  }
  
  return errors.length > 0
    ? { success: false, errors }
    : { success: true, data: validated, errors: [] };
}

// Validate batch log data
export function validateBatchLog(log: any): ValidationResult<any> {
  const errors: string[] = [];
  
  if (!log || typeof log !== 'object') {
    return { success: false, errors: ['Log must be an object'] };
  }
  
  const numericFields = [
    { key: 'mixBrix', bounds: { min: 0, max: 100 } },
    { key: 'pH', bounds: { min: 0, max: 14 } },
    { key: 'ageTimeHours', bounds: { min: 0, max: 72 } },
    { key: 'drawTempC', bounds: { min: -30, max: 10 } },
    { key: 'overrunPct', bounds: { min: 0, max: 200 } },
    { key: 'scoopTempC', bounds: { min: -30, max: 0 } },
    { key: 'hardnessScore', bounds: { min: 1, max: 10, integer: true } },
    { key: 'meltdownMinutes', bounds: { min: 0, max: 120 } },
    { key: 'panelScore', bounds: { min: 1, max: 10, integer: true } }
  ];
  
  for (const field of numericFields) {
    if (log[field.key] !== undefined) {
      const result = validateNumber(log[field.key], field.bounds);
      if (!result.success) {
        errors.push(`${field.key}: ${result.errors.join(', ')}`);
      }
    }
  }
  
  if (log.machineType && !['batch', 'continuous'].includes(log.machineType)) {
    errors.push('Machine type must be "batch" or "continuous"');
  }
  
  return errors.length > 0
    ? { success: false, errors }
    : { success: true, data: log, errors: [] };
}

// =============================================================================
// Rate Limiter
// =============================================================================

export class RateLimiter {
  private attempts: Map<string, number[]> = new Map();
  
  constructor(
    private maxAttempts: number = 5,
    private windowMs: number = 60000
  ) {}
  
  check(key: string): { allowed: boolean; remaining: number; resetIn: number } {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    const recentAttempts = attempts.filter(t => now - t < this.windowMs);
    
    if (recentAttempts.length >= this.maxAttempts) {
      const oldestAttempt = Math.min(...recentAttempts);
      const resetIn = this.windowMs - (now - oldestAttempt);
      return { allowed: false, remaining: 0, resetIn };
    }
    
    recentAttempts.push(now);
    this.attempts.set(key, recentAttempts);
    
    return {
      allowed: true,
      remaining: this.maxAttempts - recentAttempts.length,
      resetIn: this.windowMs
    };
  }
  
  reset(key: string) {
    this.attempts.delete(key);
  }
}
