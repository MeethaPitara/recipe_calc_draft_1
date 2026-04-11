# 08 — Paste and Inclusion Science

## Overview
MeethaPitara's product strategy is built around proprietary pastes — shelf-stable, retort-processed flavor concentrates that carry the mithai identity of each SKU. These pastes are not simple flavorings. They are compositionally significant ingredients that alter every metric of the final product. The agent must understand how pastes interact with the base and how to model their contributions accurately.

---

## What a Paste Is (In This Context)

### Definition
A paste is a semi-solid, concentrated flavor and ingredient preparation designed to be blended into a white base (or chocolate base) to create a finished gelato flavor.

### MeethaPitara paste examples
- **GJ Paste (Gulab Jamun Paste) v2.2:** Mawa-based with saffron bloomed in ghee, retort-processed for shelf stability.
- **Jalebi Paste (Jalebi Praline Paste SOP v2):** Baked fermented batter approach with noisette ghee and extended fermentation.
- **Future pastes:** Paan, Rasmalai, Kaju Katli, etc.

### Why pastes matter for formulation
A paste at 12-15% of the total mix is not a minor addition. At that dosage, the paste's own fat, sugar, MSNF, and water content meaningfully shift the final product's balance. The white base MUST be designed with specific "headroom" for the paste — otherwise, adding the paste will push one or more metrics out of range.

---

## How Pastes Shift the Balance

### The paste-as-ingredient model
The recipe system must treat each paste as a composite ingredient with known composition:
- Fat % of paste
- Sugar % of paste (and which sugars — for PAC/POD)
- MSNF % of paste
- Other solids % of paste
- Water % of paste

These values are computed from the paste's own sub-recipe (the paste is itself a formulation with multiple ingredients).

### Example: GJ Paste v2.2 contribution analysis
If GJ Paste is used at 15% of total mix weight, and the paste composition is (hypothetical numbers for illustration):
- Fat: 18%
- Sugar: 25%
- MSNF: 14%
- Other solids: 3%
- Water: 40%

Then 150g of paste in a 1000g mix contributes:
- Fat: 27g → 2.7% of final mix (on top of base fat)
- Sugar: 37.5g → 3.75% of final mix (on top of base sugar)
- MSNF: 21g → 2.1% of final mix (on top of base MSNF)
- Water: 60g → 6.0% of final mix

If the white base already has 10% MSNF, adding 2.1% from the paste pushes total MSNF to ~10.6% — approaching the danger zone. This is exactly the kind of calculation that caught the MSNF correction issue with mawa.

### Critical insight: the MSNF trap with mawa-based pastes
Mawa carries hidden MSNF (~14% per 100g after the correction). A paste containing 40-50% mawa will have very high MSNF. When this paste is added at 12-15% to a base, the MSNF contribution can be 1.5-3% of the final mix — enough to push a borderline base into sandiness territory.

The agent must ALWAYS compute the full MSNF chain: mawa composition → paste composition → final mix composition.

---

## Paste Addition: When and How

### Timing in the process
- Pastes are typically added AFTER pasteurization and aging, BEFORE the continuous freezer.
- Reason: Pasteurization can damage volatile flavor compounds in the paste (saffron, cardamom, rose). Adding post-pasteurization preserves aromatics.
- Exception: If the paste contains raw dairy components that need pasteurization for safety, it must be pasteurized separately (which is why retort processing of the paste itself is the MeethaPitara strategy — the paste arrives shelf-stable and doesn't need further heat treatment).

### Dispersion
- Paste must be thoroughly blended into the aged base before entering the CF.
- Inadequate dispersion → uneven flavor, pockets of concentrated paste, inconsistent texture.
- Highly viscous pastes may need gentle warming (not above 40°C) to reduce viscosity for blending.

### Dosing precision
- At 12-15% dosing, even a ±1% error in paste addition changes the final product's balance.
- If the plan calls for 150g of paste per 1000g of mix, adding 140g or 160g creates a measurable difference in sweetness, softness, and body.
- The production planning module must calculate paste requirements precisely from the recipe, not from rough estimates.

---

## Inclusions: Pieces, Swirls, and Variegates

### What inclusions are
Inclusions are discrete pieces or swirls added to the gelato, typically during or after the CF step:
- **Hard inclusions:** Nut pieces, biscuit/cookie pieces, chocolate chips, praline fragments.
- **Soft inclusions:** Fruit pieces, marshmallow, brownies.
- **Variegates (ribbons/swirls):** Thick sauces or caramel/fudge/fruit ribbons layered into the product.

### How inclusions differ from pastes
- Pastes are blended INTO the base and become part of the frozen matrix.
- Inclusions remain as SEPARATE elements within the frozen matrix.
- Pastes affect the formulation metrics of the entire product; inclusions create localized compositional differences.

### Formulation considerations for inclusions

#### Water activity (aw) matching
- If an inclusion has a different water activity than the surrounding gelato, water will migrate between them.
- High-aw inclusion (e.g., fresh fruit) in low-aw gelato → the inclusion loses water to the gelato → inclusion becomes hard and icy.
- Low-aw inclusion (e.g., caramel) in higher-aw gelato → the inclusion absorbs water from the gelato → inclusion becomes soft and sticky, surrounding gelato becomes drier.
- Best practice: formulate inclusions to have similar water activity to the surrounding product.

#### Freezing point of inclusions
- Sugar-rich inclusions (caramel, fudge) may not fully freeze even at -18°C — they remain soft and chewy, which can be desirable.
- Water-rich inclusions (fruit pieces) will freeze solid → can create icy, hard chunks.
- Soaking fruit pieces in sugar syrup before adding reduces their water activity and prevents hard freezing.

#### Inclusion rate
- Typical inclusion rate: 10-20% by weight of finished product.
- Inclusions are added AFTER the CF, usually in-line (for continuous production) or manually (for batch).
- The base recipe's metrics (fat, sugar, MSNF, solids) are calculated WITHOUT inclusions. The inclusions sit "on top" of the base composition.
- However, for nutritional labeling, the entire product (base + inclusions) must be declared.

---

## MeethaPitara-Specific Paste Considerations

### Masala Boondi (in Mumbai Chaat Surprise)
- The "surprise element" in the sorbet.
- Boondi is deep-fried besan (gram flour) pearls, optionally spiced.
- Functions as a hard inclusion, not a paste.
- Does not significantly shift the sorbet's balance (small quantity, mostly fat-absorbed starch).
- Texture contrast is the value: crunchy against smooth sorbet.
- Must remain crispy — if boondi absorbs water from the sorbet, it becomes soggy. Sugar-coating or oil-coating the boondi can help.

### Jalebi Paste — the fermentation factor
- Jalebi paste is made from fermented batter (maida + yogurt + yeast, fermented 12-24 hours).
- The fermentation generates: CO2 (drives porosity), organic acids (tanginess), and some ethanol (mostly cooked off during baking).
- The baked/fried product is then soaked in sugar syrup, creating a concentrated sugar + starch + fat ingredient.
- Sugar content of jalebi paste is very high (often 40-50% sugars from the syrup soak).
- PAC contribution is also high because jalebi syrup often contains invert sugar (sucrose inverts in acidic conditions during syrup cooking).
- The agent must account for this high sugar/PAC contribution when calculating the final gelato formulation.

### Churros-Jalebi Fusion Paste
- A concept explored that merges churros (fried choux/dough with cinnamon-sugar) and jalebi (fermented, syrup-soaked) characteristics.
- The adapted formula uses elements of both: fermented batter base + cinnamon + noisette ghee + sugar syrup soak.
- Compositionally similar to jalebi paste with additional cinnamon oil contribution.

---

## Paste as the IP Layer

### Why pastes are Meetha Pitara's moat
- The white base is a standardized, replicable formula. Any competent manufacturer can make it.
- The pastes are proprietary, complex, and embody the R&D investment (fermentation protocols, Maillard optimization, retort stability, ghee-bloomed saffron extraction).
- The Paste Studio concept (shelf-stable retort-processed pastes) is designed to be the defensible IP layer.
- The JUST-ADD-FREEZE model works because the paste carries the differentiation: a white base + GJ Paste = Gulab Jamun Gelato. The base is generic; the paste is the brand.

### Implications for the recipe system
- The recipe system must model pastes as first-class entities with their own sub-recipes, compositions, and version history.
- Changing a paste recipe changes every SKU that uses that paste — the system must propagate these changes and re-validate all downstream recipes.
- Paste versioning (GJ Paste v2.2 → v2.3) must be tracked, and production plans must snapshot which paste version was used.
