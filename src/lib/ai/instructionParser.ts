/**
 * Custom Instruction Parser
 * Port of Cell 7 — parse_instruction() from reverse_engine_stage1.ipynb
 */

import type { OptimizationTargets } from './types';

/**
 * Extract fat_pct, msnf_pct, sugars_pct from a plain-text instruction string.
 *
 * Examples:
 *   "Increase fat to 8%, MSNF to 10%, sugars to 20%"
 *   "fat 8 msnf 10 sugar 20"
 */
export function parseInstruction(instruction: string): OptimizationTargets {
    const text = instruction.toLowerCase().trim();
    const targets: OptimizationTargets = {};

    const fatMatch = text.match(/fat\s*(?:to\s*)?([\d.]+)\s*%?/);
    if (fatMatch) {
        targets.fat_pct = parseFloat(fatMatch[1]);
    }

    const msnfMatch = text.match(/msnf\s*(?:to\s*)?([\d.]+)\s*%?/);
    if (msnfMatch) {
        targets.msnf_pct = parseFloat(msnfMatch[1]);
    }

    const sugarsMatch = text.match(/sugars?\s*(?:to\s*)?([\d.]+)\s*%?/);
    if (sugarsMatch) {
        targets.sugars_pct = parseFloat(sugarsMatch[1]);
    }

    return targets;
}
