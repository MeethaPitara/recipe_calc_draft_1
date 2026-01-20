
import { calcMetricsV2 } from '../lib/calc.v2';
import { GOLDEN_TEST_CASES, GoldenTestCase } from '../tests/golden-data';
import { IngredientData } from '@/types/ingredients';

const TOLERANCE_G = 1.0;

function isClose(actual: number, expected: number, tolerance: number = 0.05): boolean {
    return Math.abs(actual - expected) <= tolerance;
}

function runTests() {
    console.log('Running Golden Tests...\n');
    let allPass = true;

    for (const testCase of GOLDEN_TEST_CASES) {
        console.log(`Test Case: ${testCase.name}`);

        // Map inputs to calcMetricsV2 format
        const rows = testCase.inputs.map(input => {
            const ing: IngredientData = {
                id: input.id,
                name: input.name,
                category: 'test_ingredient', // Default category
                water_pct: 100 - input.p_solids,
                sugars_pct: input.sugar,
                fat_pct: input.fat,
                msnf_pct: input.msnf,
                other_solids_pct: input.other,
            };
            return { ing, grams: input.quantity };
        });

        const metrics = calcMetricsV2(rows);
        let casePass = true;

        // Helper to check and log
        const check = (label: string, actual: number, expected: number, tolerance: number) => {
            const pass = isClose(actual, expected, tolerance);
            if (pass) {
                console.log(`  ✅ ${label}: ${actual.toFixed(2)} (Expected: ${expected.toFixed(2)})`);
            } else {
                console.log(`  ❌ ${label}: ${actual.toFixed(2)} (Expected: ${expected.toFixed(2)}) - Diff: ${Math.abs(actual - expected).toFixed(4)}`);
                casePass = false;
                allPass = false;
            }
        };

        check('Total Weight', metrics.total_g, testCase.expected.totalWeight, TOLERANCE_G);
        check('Total Fat', metrics.fat_g, testCase.expected.totalFat, TOLERANCE_G);
        check('Total MSNF', metrics.msnf_g, testCase.expected.totalMSNF, TOLERANCE_G);
        check('Total Sugar', metrics.totalSugars_g, testCase.expected.totalSugar, TOLERANCE_G);
        check('Total Solids', metrics.ts_g, testCase.expected.totalSolids, TOLERANCE_G);

        if (casePass) {
            console.log(`  Result: PASS\n`);
        } else {
            console.log(`  Result: FAIL\n`);
        }
    }

    if (!allPass) {
        console.error('One or more tests failed.');
        process.exit(1);
    } else {
        console.log('All tests passed successfully!');
        process.exit(0);
    }
}

runTests();
