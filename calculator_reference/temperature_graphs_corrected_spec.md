# Temperature & Scoopability Graphs — Corrected Spec

## For: Shivang
## From: Kovid
## Date: 06 Apr 2026
## Status: Review corrections, then implement

---

## Context

The original spec had the right structure but several scientific values need correction. MeethaPitara currently sells D2C via Zomato (home freezers at -18°C to -22°C) but will also operate gelateria retail (display cases at -11°C to -14°C). The system must support BOTH serving contexts from day one.

This corrected spec supersedes the original. Follow this exactly.

---

# Serving Context Toggle (Global for this section)

## Purpose
The same recipe behaves differently depending on where it's consumed. A recipe that's perfectly scoopable from a display case at -12°C may be rock-hard at -18°C in a home freezer. The formulator needs to evaluate recipes against both realities.

## Placement
Top of the Temperature & Scoopability section, above all three graphs. Persistent — selection applies to all graphs, recommendations, and diagnostics below it.

## UI
```
Serving Context:  [🏠 Home Freezer]  [🍨 Gelateria Display]
```

Toggle / segmented button. Default: 🏠 Home Freezer (current primary channel).

## What changes per context

```typescript
type ServingContext = 'home_freezer' | 'gelateria';

const SERVING_CONTEXT: Record<ServingContext, {
  label: string;
  referenceTemp: number;        // °C — the "real world" temp to evaluate against
  frozenZone_green: [number, number];   // ideal frozen water %
  frozenZone_amber_soft: [number, number];
  frozenZone_amber_firm: [number, number];
  frozenZone_red_soft: number;   // below this = red
  frozenZone_red_firm: number;   // above this = red
  targetFrozenMidpoint: number;  // for recommendServeTemp calculation
  serveTip: string;
}> = {
  home_freezer: {
    label: "Home Freezer (D2C / Zomato)",
    referenceTemp: -18,
    frozenZone_green: [60, 75],
    frozenZone_amber_soft: [50, 60],
    frozenZone_amber_firm: [75, 82],
    frozenZone_red_soft: 50,
    frozenZone_red_firm: 82,
    targetFrozenMidpoint: 67,
    serveTip: "Let product sit at room temp for 3–5 minutes before serving for best texture.",
  },
  gelateria: {
    label: "Gelateria Display (Pozzetti / Vetrina)",
    referenceTemp: -12,
    frozenZone_green: [55, 70],
    frozenZone_amber_soft: [45, 55],
    frozenZone_amber_firm: [70, 78],
    frozenZone_red_soft: 45,
    frozenZone_red_firm: 78,
    targetFrozenMidpoint: 62,
    serveTip: "Maintain display at -11°C to -13°C. Spatula-work every 15 min to maintain texture.",
  },
};
```

## What changes per context — FPDT targets

```typescript
const FPDT_TARGETS: Record<ServingContext, Record<string, { min: number; max: number }>> = {
  home_freezer: {
    nuts:                { min: 3.2, max: 4.5 },
    dairy:               { min: 3.4, max: 4.8 },
    sugary_pastes:       { min: 3.6, max: 5.0 },
    sugary_fatty_pastes: { min: 3.4, max: 4.8 },
    fruit:               { min: 3.8, max: 5.2 },
    chocolate:           { min: 3.4, max: 4.8 },
    sorbet:              { min: 4.0, max: 5.5 },
  },
  gelateria: {
    nuts:                { min: 2.3, max: 3.6 },
    dairy:               { min: 2.5, max: 3.8 },
    sugary_pastes:       { min: 2.7, max: 4.0 },
    sugary_fatty_pastes: { min: 2.5, max: 3.8 },
    fruit:               { min: 2.8, max: 4.2 },
    chocolate:           { min: 2.5, max: 3.8 },
    sorbet:              { min: 3.0, max: 4.5 },
  },
};
```

## What changes per context — Temperature Zones (Graph 3)

```typescript
const TEMP_ZONES: Record<ServingContext, Array<{
  label: string;
  range: [number, number];
  color: string;
  description: string;
}>> = {
  home_freezer: [
    { label: "Blast Hardening",  range: [-40, -35], color: "#1e3a5f", description: "Rapid freeze to -18°C core" },
    { label: "Cold Storage",     range: [-28, -20], color: "#2d5986", description: "Ideal long-term storage" },
    { label: "Home Freezer",     range: [-20, -15], color: "#4a90d9", description: "Indian home freezer range" },
    { label: "Tempering",        range: [-10, -5],  color: "#ff9800", description: "Room-temp rest before serving" },
  ],
  gelateria: [
    { label: "Blast Hardening",  range: [-40, -35], color: "#1e3a5f", description: "Rapid freeze to -18°C core" },
    { label: "Cold Storage",     range: [-28, -20], color: "#2d5986", description: "Back-of-house storage" },
    { label: "Pre-Display Temper", range: [-16, -14], color: "#4a90d9", description: "Move from storage to display" },
    { label: "Display Case",     range: [-14, -10], color: "#4caf50", description: "Pozzetti / vetrina serve temp" },
    { label: "Counter / Ambient", range: [-8, -5],  color: "#ff9800", description: "Too warm — product losing shape" },
  ],
};
```

## What does NOT change between contexts
- The freezing curve itself (Graph 2 line) — same physics, same recipe, same math.
- The FPDT Breakdown bar (Graph 1) — the depression is a fixed property of the recipe.
- The AFP Index value — same calculation regardless of context.
- The ingredient composition and all recipe metrics.

Only the **interpretation layer** changes: zones, reference lines, targets, recommendations, and diagnostics.

## Dual-Context Report (bonus feature, implement after MVP)

Eventually, add a small summary card:

```
📋 Dual-Context Summary
                        Home Freezer (-18°C)    Gelateria (-12°C)
Frozen water:           72%                      58%
Status:                 ✅ Scoopable             ✅ Soft-scoopable
Recommendation:         Good for D2C             Good for display

This recipe works in BOTH contexts. ✅
```

Or if there's a conflict:
```
⚠️ This recipe is optimized for home freezer but will be TOO SOFT for gelateria display.
To use in gelateria: reduce dextrose by ~15g, replace with sucrose.
```

This is a stretch feature — implement the toggle first, add this summary later.

---

# Graph 1 — FPDT Breakdown Bar Chart

## Purpose
Show the formulator WHERE the freezing point depression is coming from — sugars vs MSNF salts — so they know which lever to pull when FPDT is out of range.

## Visual
Horizontal stacked bar chart. Two segments:
- Segment 1: `fpdse` (from sugars via Leighton Curve) — label: "Sugars"
- Segment 2: `fpdsa` (from MSNF/salts) — label: "MSNF Salts"
- Total bar length = `fpdt`

## Data Source
```
metrics.fpdse   // already computed in calc engine
metrics.fpdsa   // already computed in calc engine
metrics.fpdt    // fpdse + fpdsa
```

## Zone Indicator (colored background band behind the bar)

### ❌ WRONG (original spec):
```
ideal = 2.5 – 4.0°C   ← This is for gelateria display. Not us.
```

### ✅ CORRECT — use serving-context-aware, flavor-category-specific ranges:

```typescript
// Get targets from the global serving context + recipe's flavor category
const targets = FPDT_TARGETS[servingContext][recipe.flavorCategory];
```

See the Serving Context Toggle section above for the complete `FPDT_TARGETS` object with both home_freezer and gelateria values.

### Zone colors:
```
Green:  within target range for the category
Amber:  within 0.5°C outside either boundary
Red:    more than 0.5°C outside
```

### Display format:
```
[███████████████████░░░░] 3.68°C
 Sugars: 3.27°C  |  MSNF Salts: 0.41°C

Target range (sugary_pastes): 3.6 – 5.0°C  ✅ In range
```

## Additional display below the bar:
Show a one-line diagnostic:
```
if fpdsa > 0.6:
    "High salt contribution — check MSNF level ({msnf_pct}%)"
if fpdse < 2.5:
    "Low sugar depression — product may be too hard. Consider adding dextrose."
if fpdt > target.max:
    "FPDT above target — product may be too soft. Reduce monosaccharides (dextrose/fructose/invert)."
if fpdt < target.min:
    "FPDT below target — product may be too hard at home freezer temps."
```

---

# Graph 2 — Scoopable Temperature Range Curve

## Purpose
The most important graph. Shows the actual freezing curve of this specific recipe — how much water is frozen at every temperature from -5°C to -22°C. Lets the formulator SEE where their recipe is scoopable vs rock-hard vs soupy.

## Visual
Line chart (Recharts `<LineChart>`):
- X-axis: Cabinet/Freezer Temperature (°C), from -5 to -22, left to right
- Y-axis: % Frozen Water, from 0% to 100%
- Single line: the recipe's freezing curve
- Background color bands for zones (from serving context thresholds)
- Vertical dashed line: recommended serve temperature for this recipe (computed per-recipe)
- Vertical dotted line: context reference temperature (labeled "Home Freezer -18°C" or "Display Case -12°C" depending on toggle)

## Zone Thresholds

### ❌ WRONG (original spec):
```
Green: 65–78%     ← Too generous on the firm side
Amber: 55–65%, 78–88%  ← 88% is a brick, not amber
```

### ✅ CORRECT — use serving-context-aware thresholds:

```typescript
const ctx = SERVING_CONTEXT[servingContext];

// Green zone:  ctx.frozenZone_green       e.g. [60, 75] for home freezer, [55, 70] for gelateria
// Amber soft:  ctx.frozenZone_amber_soft  e.g. [50, 60] for home freezer
// Amber firm:  ctx.frozenZone_amber_firm  e.g. [75, 82] for home freezer
// Red:         below ctx.frozenZone_red_soft or above ctx.frozenZone_red_firm
```

See the Serving Context Toggle section above for the full threshold values per context.

## Data Generation — The `estimateFrozenWater` Function

### ❌ DO NOT USE the linear Raoult approximation:
```
// WRONG — inaccurate at extremes
frozen_fraction = 1 - (fpdt / |T|)
```

### ✅ USE the Leighton Reverse-Lookup Method:

This is the scientifically correct approach. At any temperature T, we ask: "How concentrated must the sugar solution be to still be liquid at this temperature?" The answer tells us how much water has frozen out.

```typescript
function estimateFrozenWater(metrics: Metrics, tempC: number): number {
  // tempC is negative (e.g., -18)
  const absTempC = Math.abs(tempC);

  // If temperature is warmer than or equal to the freezing point, nothing is frozen
  if (absTempC <= metrics.fpdt) {
    return 0;
  }

  // Step 1: What sugar concentration (g per 100g water) would have
  // a freezing point depression of |tempC| degrees?
  // This is a REVERSE lookup on the Leighton Table.
  const sucroseConc_at_T = leightonReverseLookup(absTempC);

  // If we're beyond the table range, cap at 95% frozen
  if (sucroseConc_at_T === null) {
    return 95;
  }

  // Step 2: The ratio of the recipe's actual sugar concentration
  // to the concentration at this temperature tells us the unfrozen fraction.
  //
  // Logic: At the initial freezing point, the concentration is metrics.sucrosePer100gWater.
  // As temperature drops, water freezes out, concentrating the remaining solution.
  // At temperature T, the concentration in the remaining liquid must equal sucroseConc_at_T.
  // Therefore, the fraction of original water that is still liquid:
  const unfrozenFraction = metrics.sucrosePer100gWater / sucroseConc_at_T;

  // Step 3: Frozen fraction
  const frozenFraction = 1 - unfrozenFraction;

  // Clamp to 0–1 range
  return Math.max(0, Math.min(1, frozenFraction)) * 100;
}
```

### The Reverse Leighton Lookup:

```typescript
// Given a target FPD in °C, find the sucrose concentration (g/100g water)
// that would produce that depression. Linear interpolation between table points.

function leightonReverseLookup(targetFPD: number): number | null {
  const table = LEIGHTON_TABLE; // same table used in forward lookup

  // Below minimum
  if (targetFPD <= 0) return 0;

  // Above maximum table value
  if (targetFPD >= table[table.length - 1].fpd) return null;

  // Find bracketing entries
  for (let i = 0; i < table.length - 1; i++) {
    if (table[i].fpd <= targetFPD && targetFPD < table[i + 1].fpd) {
      const fraction = (targetFPD - table[i].fpd) / (table[i + 1].fpd - table[i].fpd);
      return table[i].concentration + fraction * (table[i + 1].concentration - table[i].concentration);
    }
  }

  return null;
}
```

### LEIGHTON_TABLE (use this exact data):
```typescript
const LEIGHTON_TABLE = [
  { concentration:  1, fpd: 0.056 },
  { concentration:  2, fpd: 0.112 },
  { concentration:  3, fpd: 0.168 },
  { concentration:  4, fpd: 0.225 },
  { concentration:  5, fpd: 0.283 },
  { concentration: 10, fpd: 0.565 },
  { concentration: 15, fpd: 0.870 },
  { concentration: 20, fpd: 1.200 },
  { concentration: 25, fpd: 1.560 },
  { concentration: 30, fpd: 1.950 },
  { concentration: 35, fpd: 2.370 },
  { concentration: 40, fpd: 2.830 },
  { concentration: 45, fpd: 3.330 },
  { concentration: 50, fpd: 3.900 },
  { concentration: 55, fpd: 4.510 },
  { concentration: 60, fpd: 5.200 },
  { concentration: 65, fpd: 5.950 },
  { concentration: 70, fpd: 6.800 },
  { concentration: 75, fpd: 7.700 },
];
```

### Data point generation for the chart:
```typescript
// Generate 18 points along the temperature sweep
const temperatures = [];
for (let t = -5; t >= -22; t -= 1) {
  temperatures.push(t);
}

const curveData = temperatures.map(t => ({
  temperature: t,
  frozenPct: estimateFrozenWater(metrics, t),
}));
```

## Recommended Serve Temperature Calculation

### ❌ DO NOT return a hardcoded value:
```
// WRONG
function recommendTemps() { return { serveTempC: -12 }; }
```

### ✅ Compute per-recipe from the freezing curve:

```typescript
function recommendServeTemp(metrics: Metrics, servingContext: ServingContext): number {
  // Find the temperature where frozen water = the context's target midpoint
  const ctx = SERVING_CONTEXT[servingContext];
  const targetFrozenPct = ctx.targetFrozenMidpoint;
  // home_freezer: 67% (midpoint of 60-75%)
  // gelateria:    62% (midpoint of 55-70%)

  // Sweep from -5 to -22 in 0.1°C steps
  for (let t = -5.0; t >= -22.0; t -= 0.1) {
    const frozen = estimateFrozenWater(metrics, t);
    if (frozen >= targetFrozenPct) {
      return Math.round(t * 10) / 10; // round to 1 decimal
    }
  }

  return ctx.referenceTemp; // fallback
}
```

This means a recipe with high FPDT (lots of dextrose) might have a recommended serve temp of -16°C, while a recipe with low FPDT (all sucrose) might recommend -11°C. **Each recipe gets its own answer.**

## Interactive Features (add these):

### 1. Temperature crosshair / tooltip
When the user hovers over the curve, show:
```
At -18°C: 72% frozen water — Firm but scoopable ✅
```

### 2. Context reference marker
Show a vertical dotted line at `SERVING_CONTEXT[servingContext].referenceTemp`:
- Home Freezer mode: -18°C line labeled "Home Freezer"
- Gelateria mode: -12°C line labeled "Display Case"

### 3. Dynamic update
The curve MUST recalculate and re-render whenever:
- Any ingredient quantity changes
- The serving context toggle is switched (zones and reference line shift, curve stays the same)

---

# Graph 3 — Temperature Zones Ruler

## Purpose
Operational reference showing where this recipe's serve, harden, and store temps sit on a horizontal thermometer.

## Visual
Horizontal band / ruler from -45°C (left) to -5°C (right). CSS/SVG, not Recharts.

## Zone Definitions

### ❌ WRONG (original spec):
```
Hardening: -20 to -25°C    ← This is storage, not hardening
Serve: -10 to -12°C        ← This is gelateria, not home freezer
```

### ✅ CORRECT — use serving-context-aware zones:

```typescript
const zones = TEMP_ZONES[servingContext];
// home_freezer: Blast → Cold Storage → Home Freezer → Tempering
// gelateria:    Blast → Cold Storage → Pre-Display Temper → Display Case → Counter/Ambient
```

See the Serving Context Toggle section above for the full zone definitions per context.

### Scoopable Window — computed per recipe:
```typescript
// Find the temperature range where frozen% is within the context's green zone
function getScoopableRange(metrics: Metrics, servingContext: ServingContext): { min: number; max: number } {
  const ctx = SERVING_CONTEXT[servingContext];
  const [lowerBound, upperBound] = ctx.frozenZone_green;
  // home_freezer: [60, 75]    gelateria: [55, 70]

  let tempAtUpper = -22; // temp where frozen% first hits upperBound (cooling down)
  let tempAtLower = -5;  // temp where frozen% first hits lowerBound (cooling down)

  for (let t = -5.0; t >= -22.0; t -= 0.1) {
    const frozen = estimateFrozenWater(metrics, t);
    if (frozen >= lowerBound && tempAtLower === -5) {
      tempAtLower = t;
    }
    if (frozen >= upperBound) {
      tempAtUpper = t;
      break;
    }
  }

  return { min: tempAtUpper, max: tempAtLower };
  // e.g., { min: -17.2, max: -12.5 } → scoopable from -12.5 to -17.2°C
}
```

### Markers on the ruler:

1. **Recipe serve temp** (green pin) — from `recommendServeTemp(metrics, servingContext)`
2. **Context reference line** (dashed line) — at `SERVING_CONTEXT[servingContext].referenceTemp` (e.g., -18°C for home freezer, -12°C for gelateria)
3. **Scoopable window** (green highlight band) — from `getScoopableRange(metrics, servingContext)`

### Display below the ruler:

```typescript
const ctx = SERVING_CONTEXT[servingContext];
const refTemp = ctx.referenceTemp;
const frozenAtRef = estimateFrozenWater(metrics, refTemp);
const serveTemp = recommendServeTemp(metrics, servingContext);
const scoopRange = getScoopableRange(metrics, servingContext);
```

Home Freezer mode:
```
Recommended serve: -14.8°C
At home freezer (-18°C): 73% frozen — Firm but scoopable ✅
Scoopable window: -12.5°C to -17.2°C
Tip: Let product sit at room temp for 3–5 minutes before serving for best texture.
```

Gelateria mode:
```
Recommended serve: -12.3°C
At display case (-12°C): 61% frozen — Soft-scoopable ✅
Scoopable window: -10.8°C to -14.5°C
Tip: Maintain display at -11°C to -13°C. Spatula-work every 15 min to maintain texture.
```

If the context reference temp falls OUTSIDE the scoopable window:
```
⚠️ At home freezer (-18°C): 81% frozen — Too firm
Suggestion: Increase FPDT by replacing some sucrose with dextrose to improve home-freezer scoopability.
```

---

# Additional Feature: AFP Index Display

## Why this is needed
The Carpigiani Analytical Compensation table (Doc 12) expresses targets as AFP Index per flavor category. The formulator needs to see this number to validate against those targets.

## Placement
Add as a simple metric card above or beside the three graphs, inside the same Temperature & Scoopability section.

## Calculation (from Doc 13, Part A9):
```typescript
const afp_numerator = ingredients.reduce((sum, ing) => {
  const sugarG = ing.grams * ing.sugar_pct / 100;
  return sum + (sugarG * ing.afp_total);
}, 0);

const afp_index = (afp_numerator / recipeTotalMass_g) * 100;
```

## Display:
```
AFP Index: 25.4
Target (sugary_pastes): 24–28  ✅ In range
```

## Zone colors:
```
Green:   within category target
Amber:   within 2 points outside
Red:     more than 2 points outside
```

---

# Implementation Checklist for Shivang

## Files to modify:
```
[MODIFY] src/components/TemperaturePanel.tsx     — add serving context toggle + three graph sections + AFP display
[MODIFY] src/lib/scoopability.ts                 — fix estimateFrozenWater to use Leighton reverse
                                                    add recommendServeTemp(metrics, servingContext)
                                                    add getScoopableRange(metrics, servingContext)
                                                    add leightonReverseLookup()
[MODIFY] src/lib/calc.v2.ts                      — ensure metrics object includes sucrosePer100gWater
[ADD]    src/lib/constants/tempTargets.ts         — SERVING_CONTEXT config, FPDT_TARGETS (both contexts),
                                                    TEMP_ZONES (both contexts), AFP_TARGETS by category
```

## No new dependencies needed:
- Recharts: already available (Graph 1 bar chart, Graph 2 line chart)
- CSS/SVG: for Graph 3 ruler (no library needed)
- State for serving context toggle: `useState<ServingContext>('home_freezer')`

## Verification plan:
1. Load French Vanilla recipe. Toggle between Home Freezer and Gelateria. Verify the green zone shifts on Graph 2, the reference line moves from -18 to -12, and Graph 3 zones change entirely. The freezing curve itself should NOT move.
2. Load GJ Delight recipe. In Home Freezer mode, verify MSNF salt contribution is visibly larger. FPDT should be higher. Scoopable window should shift warmer compared to French Vanilla.
3. Load Mumbai Chaat Surprise (sorbet). Verify MSNF contribution is zero or near-zero. FPDT is entirely from sugars. AFP should be in the fruit range (25-29).
4. Change 50g of sucrose to dextrose in any recipe. Verify Graph 2 curve shifts RIGHT (softer at same temp) and FPDT bar grows. This confirms dynamic recalculation works.
5. Hover over Graph 2 at -18°C in Home Freezer mode and at -12°C in Gelateria mode. Verify tooltips show correct frozen% values.
6. Test a high-FPDT recipe (lots of dextrose) — in Gelateria mode it should show ⚠️ "too soft for display." In Home Freezer mode the same recipe should show ✅.
7. Test a low-FPDT recipe (all sucrose, no dextrose) — in Home Freezer mode it should show ⚠️ "too hard." In Gelateria mode the same recipe may show ✅.

## Acceptance criteria:
- [ ] Serving Context toggle is present and defaults to Home Freezer
- [ ] FPDT zones are context-aware AND flavor-category-specific
- [ ] `estimateFrozenWater` uses Leighton reverse-lookup, not linear approximation
- [ ] `recommendServeTemp` computes per-recipe AND per-context, not constant
- [ ] Graph 2 zone bands shift when context is toggled (curve stays the same)
- [ ] Graph 3 zones switch between home-freezer and gelateria layouts on toggle
- [ ] AFP Index is displayed with category-specific targets
- [ ] All three graphs update dynamically when ingredients change
- [ ] Context reference line is correctly positioned on Graphs 2 and 3
- [ ] Scoopable window is computed per-recipe and per-context
- [ ] Toggling context does NOT trigger a recipe recalculation (only UI interpretation changes)
