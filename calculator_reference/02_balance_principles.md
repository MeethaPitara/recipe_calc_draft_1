# 02 — Balance Principles and Target Ranges

## Overview
A frozen dessert formula is a balancing act. Changing one ingredient affects multiple metrics simultaneously. The formulator's skill lies in understanding these interactions and finding the sweet spot where all metrics fall within acceptable ranges. This document explains how the key metrics interact and what ranges to target.

---

## The Five Core Metrics

Every recipe is evaluated against five compositional metrics. These are percentages of the total mix weight (before freezing, before air incorporation).

### 1. Fat %
- **What it controls:** Creaminess, richness, air stability, melt behavior, flavor carry.
- **Gelato range:** 4.0–8.0% (MeethaPitara targets ~7.0–8.0% for premium mouthfeel without heaviness).
- **Ice cream range (for reference):** 10–16%.
- **If too high:** Heavy, greasy, suppressed flavor, high cost.
- **If too low:** Thin, icy, poor air retention.

### 2. Sugars % (Total Sugars)
- **What it controls:** Sweetness, freezing point depression, total solids contribution, texture softness.
- **Gelato range:** 16–22%.
- **If too high:** Overly sweet, too soft at serving temp, sticky texture.
- **If too low:** Not sweet enough, too hard at serving temp, icy.
- **Note:** Total sugar % alone doesn't tell the full story. The *type* of sugar matters enormously for softness (PAC) vs sweetness (POD). Two recipes at 20% sugar can behave very differently if one uses all sucrose and the other uses a dextrose/sucrose blend.

### 3. MSNF % (Milk Solids Non-Fat)
- **What it controls:** Body, structure, water binding, emulsion stability.
- **Gelato range:** 7.0–11.0%.
- **Hard ceiling:** 12% — above this, lactose crystallization risk becomes significant.
- **If too high:** Sandy/gritty texture (lactose crystals), dense, chewy.
- **If too low:** Weak body, fast collapse, icy texture, poor meltdown.

### 4. Total Solids %
- **What it controls:** Overall density, scoopability, mouthfeel weight, ice crystal size.
- **Gelato range:** 34–42%.
- **MeethaPitara white base target:** ~36–38%.
- **If too high:** Too dense, heavy, gummy, hard to scoop.
- **If too low:** Thin, icy, watery, fast melt.
- **Computed as:** Fat + Sugars + MSNF + Other Solids.

### 5. Water %
- **What it controls:** Ice crystal formation, texture openness, melt behavior.
- **Gelato range:** 58–66% (inverse of total solids).
- **Computed as:** 100 - Total Solids %.
- **If too high:** Icy, coarse, fast liquid melt.
- **If too low:** Dense, heavy, gummy.

---

## The Two Proxy Metrics

Beyond composition, two proxy indices predict sensory behavior at serving temperature.

### POD (Potere Dolcificante / Sweetening Power)
- **What it predicts:** Perceived sweetness of the mix.
- **How it's calculated:** Each sugar contributes its mass × its POD factor (sucrose = 1.0 baseline). Sum across all sugars. Divide by total mix mass. Express as index or percentage.
- **Gelato target range:** 18–24 (depending on flavor — chocolate tolerates lower, fruit needs higher).
- **If too high:** Cloying sweetness, masks other flavors.
- **If too low:** Bland, undersweetened, other flavors taste flat.

### PAC (Potere Anti-Congelante / Anti-Freezing Power)
- **What it predicts:** Softness/scoopability at serving temperature (typically -11°C to -14°C for gelato).
- **How it's calculated:** Each sugar contributes its mass × its PAC factor. Sum across all sugars. Divide by total mix mass.
- **Gelato target range:** 22–30 (higher = softer at serving temp).
- **If too high:** Product is too soft, doesn't hold shape, soupy at display temp.
- **If too low:** Product is rock-hard, difficult to scoop, poor flavor release.
- **Critical insight:** PAC is about molecular count, not sweetness. Small molecules (dextrose, fructose) depress freezing point much more per gram than large molecules (sucrose, glucose syrup solids). This is why sugar type matters as much as sugar amount.

---

## How Metrics Interact — The Tradeoff Web

### Adding more cream (to increase fat)
- Fat % goes up.
- MSNF goes up slightly (cream carries some non-fat solids).
- Water % goes up (cream is 60-75% water depending on fat content).
- Total solids may go up or down depending on what cream replaces.
- If cream replaces milk: fat up, MSNF may drop, water may change slightly.
- If cream is added on top: total mass increases, all percentages shift.

### Adding more SMP (to increase MSNF)
- MSNF goes up significantly (SMP is ~96% MSNF).
- Total solids goes up.
- Water % goes down (SMP is ~3-4% moisture).
- Sugars % goes down as a percentage (diluted by added solids).
- Lactose increases (SMP is ~52% lactose), affecting both sugar % and sandiness risk.
- Slight increase in PAC from lactose (PAC factor ~1.0).

### Adding more sucrose
- Sugars % goes up.
- Total solids goes up.
- Water % goes down.
- POD goes up (sucrose POD = 1.0).
- PAC goes up moderately (sucrose PAC = 1.0).

### Replacing sucrose with dextrose (same grams)
- Sugars % stays the same.
- Total solids stays the same.
- POD goes down (dextrose POD ≈ 0.70).
- PAC goes up significantly (dextrose PAC ≈ 1.90).
- Net effect: less sweet, much softer at serving temp.

### Replacing sucrose with glucose syrup solids (same grams)
- Sugars % stays the same.
- Total solids stays the same.
- POD goes down (glucose syrup POD ≈ 0.40–0.60 depending on DE).
- PAC goes down (glucose syrup PAC ≈ 0.80–1.00 depending on DE).
- Net effect: less sweet, slightly firmer, more body, chewier texture.

### Adding a paste (e.g., GJ Paste at 12-15%)
- Every metric shifts because the paste carries fat, sugars, MSNF, and water.
- The paste's own composition must be known and accounted for.
- If the paste is high in sugar (like jalebi paste), PAC and POD will increase.
- If the paste is high in dairy solids (like mawa-based GJ paste), MSNF may push toward the danger zone.
- The white base must be designed with "room" for the paste's contributions.

---

## The White Base Strategy

### Why a universal white base matters
MeethaPitara uses a Universal White Base (currently v4.0) as the foundation for most flavors. The base is designed to be nutritionally "incomplete" on its own — it leaves room for pastes, inclusions, and flavor-specific adjustments.

### Design principles for the white base
- Fat is set at the target for the final product (currently ~7.6%) because most pastes don't add significant fat relative to their mass.
- MSNF is set conservatively (below 10%) to leave headroom for mawa-based pastes that contribute hidden MSNF.
- Sugars are set below the final target to leave room for sweetness from pastes (especially jalebi, gulab jamun, which are inherently sweet).
- Total solids target is ~36-37% in the base, expecting to reach 38-40% after paste addition.
- PAC/POD are set below final targets, expecting paste sugars to bring them up.

### The headroom principle
- When designing a white base, always ask: "What will the paste add?" and leave room for it.
- A base that hits all targets perfectly on its own will overshoot every target once paste is added.
- The agent must know the paste composition to correctly size the headroom.

---

## Interaction Between Serving Temperature and Formulation

### Why serving temperature matters
- Gelato is typically served at -11°C to -14°C (warmer than ice cream at -18°C).
- At any temperature, the ratio of frozen water to unfrozen water determines texture.
- At -14°C, approximately 65-75% of water is frozen in a typical gelato. At -18°C, it's 75-85%.
- The PAC index predicts where on this curve a formula sits.

### Temperature-texture relationship
- **Too warm for the PAC level:** Product is soupy, drips immediately, no shape retention.
- **Correct match:** Smooth, scoopable, creamy, flavors release well.
- **Too cold for the PAC level:** Hard, requires force to scoop, flavors muted, feels icy on palate.

### Practical implication for MeethaPitara
- Products sold via Zomato delivery are consumed from a freezer, not a display case.
- Home freezers run at -18°C to -22°C, much colder than gelato display (-11°C to -14°C).
- This means the PAC target should be **higher** than traditional gelato to ensure scoopability at colder home freezer temps.
- This is a key formulation difference from gelateria-style products.

---

## Quick Reference — Target Ranges for MeethaPitara Gelato

| Metric | Minimum | Target | Maximum | Danger Zone |
|--------|---------|--------|---------|-------------|
| Fat % | 5.0 | 7.0–8.0 | 10.0 | >12 (heavy) |
| Sugars % | 16.0 | 18–21 | 24.0 | >24 (too sweet/soft) |
| MSNF % | 7.0 | 8.5–10.5 | 11.5 | >12 (sandy) |
| Total Solids % | 34.0 | 36–40 | 42.0 | >42 (dense) |
| Water % | 58.0 | 60–64 | 66.0 | >66 (icy) |
| POD index | 16 | 18–22 | 26 | >26 (cloying) |
| PAC index | 22 | 24–30 | 32 | >32 (soupy) |

Note: These are general gelato ranges. Specific flavors (chocolate, sorbet) have their own adjusted targets. Chocolate typically tolerates lower POD (cocoa bitterness compensates). Sorbets have no fat/MSNF and operate on different balance principles.
