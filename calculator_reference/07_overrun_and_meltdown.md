# 07 — Overrun and Meltdown Science

## Overview
Overrun (air incorporation) is one of the most economically and sensorially important parameters in frozen dessert production. It directly affects cost per unit, texture, flavor intensity, melt behavior, and serving temperature perception. Meltdown behavior is a quality indicator and a consequence of formulation + process decisions.

---

## Overrun: What It Is

### Definition
Overrun is the percentage increase in volume due to air incorporation.
- 0% overrun = no air = dense, solid frozen mix.
- 30% overrun = 30% of the final volume is air. 1 liter of mix becomes 1.3 liters of product.
- 100% overrun = volume doubles. 1 liter of mix becomes 2 liters of product.

### Formula
Overrun % = ((Volume of product - Volume of mix) / Volume of mix) × 100

Or equivalently:
Overrun % = ((Weight of mix in a container - Weight of product in same container) / Weight of product in same container) × 100

### Gelato vs ice cream
- Traditional gelato: 25-40% overrun. Dense, intense flavor, heavy mouthfeel.
- Premium ice cream: 50-80% overrun. Lighter, creamier, less intense.
- Economy ice cream: 80-100%+ overrun. Light, airy, mild flavor — maximum volume from minimum mix.

### MeethaPitara target
- Current target: approximately 30% overrun for premium positioning.
- This means 1 liter of mix produces approximately 1.3 liters of finished product.

---

## How Overrun Affects the Product

### Texture
- Lower overrun → denser, heavier, more "solid" mouthfeel.
- Higher overrun → lighter, softer, more "creamy" perception.
- Very high overrun (>80%) → fluffy, insubstantial, "airy" — can feel cheap.

### Flavor intensity
- Air dilutes flavor. Lower overrun = more concentrated flavor per spoonful.
- This is why gelato tastes more intense than ice cream at the same flavoring level — less air means more flavor compound per bite.
- For MeethaPitara's mithai flavors (which are nuanced and complex), lower overrun preserves the subtlety of saffron, cardamom, and mawa notes.

### Temperature perception
- Air is an insulator. Higher overrun = product feels warmer in the mouth.
- Low-overrun gelato feels colder on the tongue, which can amplify "iciness" if formulation isn't balanced.
- This is why gelato is served at a warmer temperature than ice cream — to compensate for the denser, colder-feeling product.

### Melt behavior
- Higher overrun product holds its shape longer initially (air cells provide structure) but once the fat network collapses, it melts quickly.
- Lower overrun product starts melting sooner but melts more slowly and evenly (less structural collapse).

---

## Overrun and Economics

### The volume multiplier
- At 30% overrun: 1 kg of mix (costing ₹X in ingredients) produces ~1.30 liters of product.
- At 100% overrun: 1 kg of mix produces ~2.00 liters of product.
- Higher overrun = more sellable units per kg of mix = lower cost per unit.

### Pack weight relationship
- A 500ml container at 30% overrun weighs more than the same container at 100% overrun.
- Expected pack weight = Volume(L) × Mix Density(kg/L) / (1 + Overrun fraction) × 1000 (grams).
- 500ml, density 1.08, 30% overrun: 0.5 × 1.08 / 1.30 × 1000 = 415g.
- 500ml, density 1.08, 100% overrun: 0.5 × 1.08 / 2.00 × 1000 = 270g.

### MeethaPitara's production planning uses this formula to calculate:
- BilledKg from the manufacturer (based on finished liters and a billing conversion factor).
- Manufacturing cost per unit.
- Expected fill weights for QC checks.

---

## What Controls Overrun Achievement

### Formulation factors
- **Fat %:** Higher fat = better air retention (fat network stabilizes air cells). Below ~4%, achieving stable overrun is difficult.
- **Emulsifier level:** More emulsifier = more fat coalescence = better air cell stabilization = easier to achieve and hold overrun.
- **Protein (MSNF):** Proteins also stabilize air cells (they form films around bubbles). Higher MSNF improves foam stability.
- **Stabilizer:** Higher stabilizer = more viscous unfrozen phase = air bubbles drain less.
- **Total solids:** Higher solids = more viscous mix = air bubbles are smaller and more stable.

### Process factors
- **CF air injection rate:** Direct control of overrun. More air = higher overrun.
- **CF draw temperature:** Colder draw = stiffer product = air cells are locked in. Warmer draw = air can escape before hardening.
- **CF dasher speed:** Higher speed = more shear = more fat coalescence = better air stabilization. But too high = churning.
- **Aging time:** Insufficient aging = incomplete emulsifier action = poor air retention.

### The overrun-formulation feedback loop
- If a formula change reduces fat or emulsifier, the same CF settings will produce lower overrun.
- The production planning module needs to account for actual achievable overrun, not just target overrun.
- If actual overrun is lower than planned, more mix is needed per unit → procurement quantities increase.

---

## Meltdown Behavior

### Why meltdown matters
Meltdown is a quality indicator and a consumer experience factor. Controlled, slow meltdown is desirable. Fast, liquid meltdown is a defect.

### Phases of meltdown
1. **Lag phase:** Product holds its shape with no visible dripping. Duration depends on fat network integrity and stabilization. Well-made gelato: 5-10 minutes at room temperature.
2. **Steady-state melting:** Product begins to drip or flow at a roughly constant rate. The rate depends on total solids, stabilizer level, and fat network.
3. **Collapse:** The structural network fails and the product collapses into a pool. In well-made product, this should be a gradual transition. In poorly made product, the shape suddenly collapses.

### Good vs bad meltdown

#### Good meltdown
- Long lag phase (5-10+ minutes).
- Slow, creamy drip (not watery).
- Product retains a recognizable shape as it melts.
- Melted pool is smooth, not separated.

#### Bad meltdown — too fast
- Very short or no lag phase.
- Watery, thin drip.
- Product collapses quickly into a pool.
- Melted pool separates into watery and fatty layers.
- **Causes:** Low fat, insufficient emulsifier, low total solids, under-stabilized, insufficient aging.

#### Bad meltdown — too slow (yes, this is a defect)
- Product sits as a rigid dome for an extended time, barely melting.
- When it does melt, it does not flow smoothly.
- Can feel "rubbery" or "plasticky" to eat.
- **Causes:** Over-stabilization (especially carrageenan overdose), extreme fat network (over-emulsified), very high total solids.

### Formulation factors affecting meltdown
- **Fat:** More fat → slower melt (fat network is more robust).
- **Emulsifier:** More emulsifier → more fat coalescence → better structure → slower melt up to a point.
- **Stabilizer:** More stabilizer → more viscous unfrozen phase → slower drip rate.
- **Total solids:** Higher → slower melt (less free water to drain).
- **Overrun:** Higher overrun → initially slower melt (air insulates) but potentially faster collapse.

---

## Overrun in Production Planning

### How overrun enters the production math
- MixRequired_L = PlannedOutput_L / (1 + Overrun) / (1 - Loss).
- Overrun is entered as a percentage but used as a decimal fraction in formulas.
- Example: 30% overrun → used as 0.30 in the formula.
- PlannedOutput is in frozen liters (with air). MixRequired is in liquid liters (without air, before loss).

### Level 2 (supply-driven) overrun handling
- When computing achievable units from fixed base supply:
  - frozenLiters = (packedMixKg / density) × (1 + overrun)
  - This is the reverse calculation — from mix quantity back to frozen volume.
  - Overrun amplifies the yield from a given quantity of mix.

### Overrun monitoring in production
- Actual overrun should be checked during production by weighing a known-volume container.
- If actual overrun deviates from target by more than ±5%, the production plan's unit estimates are wrong.
- The batch logging (Week 5 feature) should capture actual overrun as a variance metric.
