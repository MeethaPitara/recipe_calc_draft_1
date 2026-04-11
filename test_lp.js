const solver = require('javascript-lp-solver');

const DEVIATION_WEIGHT = 10.0;
const MOVEMENT_WEIGHT = 0.1;

const INGREDIENT_DB = {
    'Toned Milk 3%': {
        fat_pct: 3.0, msnf_pct: 8.5, sugars_pct: 4.8,
        water_pct: 87.7, category: 'dairy', locked: false,
    },
    'Cream 25%': {
        fat_pct: 25.0, msnf_pct: 6.5, sugars_pct: 3.0,
        water_pct: 64.0, category: 'dairy', locked: false,
    },
    'Skimmed Milk Powder': {
        fat_pct: 0.1, msnf_pct: 95.0, sugars_pct: 51.0,
        water_pct: 3.5, category: 'dairy_powder', locked: false,
    },
    'Condensed Milk Nestle': {
        fat_pct: 8.0, msnf_pct: 20.0, sugars_pct: 55.0,
        water_pct: 27.0, category: 'dairy', locked: false,
    },
    'Sucrose/sugar': {
        fat_pct: 0.0, msnf_pct: 0.0, sugars_pct: 100.0,
        water_pct: 0.0, category: 'sugar', locked: false,
    },
    'Dextrose monohydrate': {
        fat_pct: 0.0, msnf_pct: 0.0, sugars_pct: 91.0,
        water_pct: 9.0, category: 'sugar', locked: false,
    },
    'Glucose Syrup (40-42DE)': {
        fat_pct: 0.0, msnf_pct: 0.0, sugars_pct: 78.0,
        water_pct: 22.0, category: 'sugar', locked: false,
    },
    'Stabilizer': {
        fat_pct: 0.0, msnf_pct: 0.0, sugars_pct: 0.0,
        water_pct: 5.0, category: 'stabilizer', locked: true,
    },
};

function testLp() {
    const scaledRecipe = {
        'Toned Milk 3%': 500,
        'Cream 25%': 150,
        'Sucrose/sugar': 100,
        'Skimmed Milk Powder': 40,
        'Stabilizer': 5,
    };
    const optTargets = { fat_pct: 8, msnf_pct: 10, sugars_pct: 16 };
    const massTolerance = 0.10;

    // Compute current metrics before optimization
    let current_fat = 0, current_msnf = 0, current_sugars = 0, current_total = 0;
    for (const [name, qty] of Object.entries(scaledRecipe)) {
        current_fat += qty * INGREDIENT_DB[name].fat_pct / 100;
        current_msnf += qty * INGREDIENT_DB[name].msnf_pct / 100;
        current_sugars += qty * INGREDIENT_DB[name].sugars_pct / 100;
        current_total += qty;
    }
    console.log("BEFORE:");
    console.log(`Total: ${current_total.toFixed(2)}`);
    console.log(`Fat: ${(current_fat / current_total * 100).toFixed(2)}%`);
    console.log(`MSNF: ${(current_msnf / current_total * 100).toFixed(2)}%`);
    console.log(`Sugars: ${(current_sugars / current_total * 100).toFixed(2)}%`);
    console.log("\n");


    const names = Object.keys(scaledRecipe);
    const initial = Object.values(scaledRecipe);
    const totalW = initial.reduce((s, v) => s + v, 0);
    const n = names.length;

    const bounds = { sucrose_max_pct: 22, dextrose_max_pct: 8, glucose_max_pct: 8 };

    const model = {
        optimize: 'cost',
        opType: 'min',
        constraints: {},
        variables: {},
    };

    for (let i = 0; i < n; i++) {
        const name = names[i];
        const ing = INGREDIENT_DB[name];
        const locked = ing?.locked ?? false;

        let lo;
        let hi;

        if (locked) {
            lo = initial[i];
            hi = initial[i];
        } else {
            lo = 0;
            hi = Math.max(initial[i] * 5, 1500);

            const nm = name.toLowerCase();
            if (nm.includes('sucrose') || nm === 'sucrose/sugar') {
                hi = Math.min(hi, totalW * bounds.sucrose_max_pct / 100);
            } else if (nm.includes('dextrose')) {
                hi = Math.min(hi, totalW * bounds.dextrose_max_pct / 100);
            } else if (nm.includes('glucose')) {
                hi = Math.min(hi, totalW * bounds.glucose_max_pct / 100);
            }
        }

        const varName = `x_${i}`;

        const variable = {
            total_weight: 1,
            [`bnd_min_${i}`]: 1,
            [`bnd_max_${i}`]: 1,
            [`movement_eq_${i}`]: 1,
        };

        const fatCoeff = (ing?.fat_pct ?? 0) / 100;
        const msnfCoeff = (ing?.msnf_pct ?? 0) / 100;
        const sugCoeff = (ing?.sugars_pct ?? 0) / 100;

        if (optTargets.fat_pct != null) variable.fat_eq = fatCoeff;
        if (optTargets.msnf_pct != null) variable.msnf_eq = msnfCoeff;
        if (optTargets.sugars_pct != null) variable.sug_eq = sugCoeff;

        model.variables[varName] = variable;
        model.constraints[`bnd_min_${i}`] = { min: lo };
        model.constraints[`bnd_max_${i}`] = { max: hi };

        model.variables[`x_over_${i}`] = { cost: MOVEMENT_WEIGHT, [`movement_eq_${i}`]: -1 };
        model.variables[`x_under_${i}`] = { cost: MOVEMENT_WEIGHT, [`movement_eq_${i}`]: 1 };
        model.constraints[`movement_eq_${i}`] = { equal: initial[i] };
    }

    model.constraints.total_weight = {
        min: totalW * (1 - massTolerance),
        max: totalW * (1 + massTolerance),
    };

    if (optTargets.fat_pct != null) {
        const tg = (optTargets.fat_pct / 100) * totalW;
        model.variables['fat_over'] = { cost: DEVIATION_WEIGHT, fat_eq: -1 };
        model.variables['fat_under'] = { cost: DEVIATION_WEIGHT, fat_eq: 1 };
        model.constraints.fat_eq = { equal: tg };
    }

    if (optTargets.msnf_pct != null) {
        const tg = (optTargets.msnf_pct / 100) * totalW;
        model.variables['msnf_over'] = { cost: DEVIATION_WEIGHT, msnf_eq: -1 };
        model.variables['msnf_under'] = { cost: DEVIATION_WEIGHT, msnf_eq: 1 };
        model.constraints.msnf_eq = { equal: tg };
    }

    if (optTargets.sugars_pct != null) {
        const tg = (optTargets.sugars_pct / 100) * totalW;
        model.variables['sug_over'] = { cost: DEVIATION_WEIGHT, sug_eq: -1 };
        model.variables['sug_under'] = { cost: DEVIATION_WEIGHT, sug_eq: 1 };
        model.constraints.sug_eq = { equal: tg };
    }

    console.log(JSON.stringify(model, null, 2));

    const result = solver.Solve(model);
    console.log("RESULT:", result);

    // Extract solution
    const proposed = {};
    for (let i = 0; i < n; i++) {
        const varName = `x_${i}`;
        proposed[names[i]] = Math.max(0, result[varName] ?? 0);
    }

    // print metrics of proposed
    let prop_fat = 0, prop_msnf = 0, prop_sugars = 0, prop_total = 0;
    for (const [name, qty] of Object.entries(proposed)) {
        prop_fat += qty * INGREDIENT_DB[name].fat_pct / 100;
        prop_msnf += qty * INGREDIENT_DB[name].msnf_pct / 100;
        prop_sugars += qty * INGREDIENT_DB[name].sugars_pct / 100;
        prop_total += qty;
    }

    console.log("\nPROPOSED:");
    console.log(proposed);
    console.log(`Total: ${prop_total.toFixed(2)}`);
    console.log(`Fat: ${(prop_fat / prop_total * 100).toFixed(2)}% (Target: ${optTargets.fat_pct}%)`);
    console.log(`MSNF: ${(prop_msnf / prop_total * 100).toFixed(2)}% (Target: ${optTargets.msnf_pct}%)`);
    console.log(`Sugars: ${(prop_sugars / prop_total * 100).toFixed(2)}% (Target: ${optTargets.sugars_pct}%)`);

}

testLp();
