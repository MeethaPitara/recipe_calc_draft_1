import { expect, test, describe } from 'vitest';
import { FOOD_ENGINEER_INTENT_PROMPT } from '../ai';

describe('AI Determinism', () => {
    test('FOOD_ENGINEER_INTENT_PROMPT strictly prohibits returning quantities', () => {
        expect(FOOD_ENGINEER_INTENT_PROMPT).toContain('NEVER attempt to return specific gram amounts or recipe quantities');
        expect(FOOD_ENGINEER_INTENT_PROMPT).toContain('Your goal is to parse their intent into optimization targets');
    });

    test('FOOD_ENGINEER_INTENT_PROMPT defines correct output schema', () => {
        expect(FOOD_ENGINEER_INTENT_PROMPT).toContain('"optimization_targets": {');
        expect(FOOD_ENGINEER_INTENT_PROMPT).toContain('"fat_pct"');
        expect(FOOD_ENGINEER_INTENT_PROMPT).toContain('"msnf_pct"');
        expect(FOOD_ENGINEER_INTENT_PROMPT).toContain('"totalSugars_pct"');
    });
});
