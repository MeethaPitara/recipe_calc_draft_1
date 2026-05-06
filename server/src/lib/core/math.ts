/**
 * Safe mathematical operations to prevent NaN and Infinity
 */

/**
 * Safely divide two numbers, returning a fallback value if the divisor is zero or invalid
 * @param a - Numerator
 * @param b - Denominator
 * @param fallback - Value to return if division is unsafe (default: 0)
 * @returns Result of a/b or fallback
 */
export function safeDivide(a: number, b: number, fallback = 0): number {
  if (!isFinite(a) || !isFinite(b) || b === 0) {
    return fallback;
  }
  const result = a / b;
  return isFinite(result) ? result : fallback;
}

/**
 * Clamp a number between minimum and maximum values
 * @param n - Number to clamp
 * @param lo - Minimum value
 * @param hi - Maximum value
 * @returns Clamped value
 */
export function clamp(n: number, lo: number, hi: number): number {
  if (!isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Safely format a number as a percentage string
 * @param n - Number to format
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage string (e.g., "12.5%")
 */
export function safePercent(n: number, decimals = 1): string {
  if (!isFinite(n)) return "0%";
  return `${n.toFixed(decimals)}%`;
}
