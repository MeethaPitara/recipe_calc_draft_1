# 06 — Process Knowledge: From Mix to Finished Product

## Overview
Formulation and process are inseparable. A perfectly balanced formula processed poorly will produce a defective product. Equally, a poor formula cannot be rescued by excellent processing. This document covers the key process steps, what each step does to the mix, and how process parameters interact with formulation choices.

---

## Process Flow (MeethaPitara Standard)

```
Raw ingredients
    ↓
Weighing & Blending (dry + liquid)
    ↓
Two-Stage Homogenization
    ↓
Pasteurization (85°C)
    ↓
Cooling to 4°C
    ↓
Aging (4°C, 4-24 hours)
    ↓
Flavor/Paste Addition
    ↓
Continuous Freezer (CF)
    ↓
Filling (100ml cups / 500ml tubs)
    ↓
Blast Hardening (-38°C)
    ↓
Storage (-18°C to -25°C)
    ↓
Distribution (cold chain)
```

---

## Step 1: Weighing and Blending

### What happens
Dry ingredients (SMP, sugar, stabilizer, cocoa powder) are blended with liquid ingredients (milk, cream, water) in a mixing vat, usually with agitation and gentle heating.

### Critical points
- **Dry ingredient dispersion:** Stabilizers and SMP tend to clump if added too fast. Best practice is to dry-blend all powders together first, then add the dry blend to the liquid under high shear, or sprinkle slowly into a vortex.
- **Temperature:** Warm liquid (40-50°C) helps dissolve sugars and hydrate stabilizers. Not all stabilizers hydrate below 70°C (LBG needs >80°C — it hydrates during pasteurization).
- **Order of addition matters:** Sugars first (to dissolve), then SMP, then stabilizer blend, then cream/fat last (to avoid coating powder particles with fat which prevents hydration).

### Formulation connection
- The total mass of the batch must be precisely calculated from the recipe. The production planning module's procurement explosion directly feeds this step.
- Any error in ingredient quantities propagates through every downstream step.

---

## Step 2: Homogenization

### What happens
The mix is forced through a narrow gap at high pressure, breaking fat globules into very small, uniform particles (typically 0.5-1.0 μm diameter). MeethaPitara uses a two-stage process.

### Two-stage homogenization explained
- **First stage (140-200 bar):** Fat globules are shattered into tiny droplets. However, these newly created droplets have exposed fat surfaces that tend to clump together immediately (a phenomenon called "clustering" or "clumping").
- **Second stage (35-50 bar):** The lower-pressure second stage breaks apart these fat clusters without further reducing droplet size.
- Net effect: uniform, non-clustered, small fat globules evenly distributed throughout the mix.

### Why it matters for the formula
- **Fat level determines homogenization pressure:** Higher fat mixes need LOWER first-stage pressure. If you homogenize a high-fat mix at too high a pressure, you create so many small fat globules that there aren't enough proteins to coat them all → clustering → thick, heavy texture.
- Rule of thumb: For gelato (5-8% fat), first stage 150-180 bar is typical. For ice cream (10-14% fat), reduce to 100-140 bar.
- **MSNF matters here:** Proteins (from MSNF) are the molecules that coat fat globules after homogenization. Insufficient MSNF relative to fat means insufficient protein coating → fat destabilization → clumping.
- The fat:MSNF ratio should ideally be below 1:1 for good emulsification. At MeethaPitara's target of ~7.6% fat and ~9-10% MSNF, this ratio is favorable.

### Homogenization temperature
- Mix should be at 65-75°C during homogenization. Below 50°C, fat is partially solid and won't break up properly. Above 80°C, proteins may denature prematurely.
- In MeethaPitara's process, the mix goes from blending (warm) → homogenization → pasteurization. Some systems combine these steps differently.

---

## Step 3: Pasteurization

### What happens
The mix is heated to a specific temperature for a specific time to kill pathogenic bacteria.

### MeethaPitara protocol
- **85°C hold time:** Standard for gelato. This is a "high-temperature, short-time" (HTST) approach.
- Some operations use 65°C for 30 minutes (batch pasteurization) — this is gentler but slower.

### What pasteurization does beyond safety
- **Protein denaturation:** Whey proteins (β-lactoglobulin, α-lactalbumin) unfold and interact with casein micelles. This improves water binding, viscosity, and meltdown resistance. Higher temperatures → more denaturation → better texture.
- **Stabilizer hydration:** LBG and other heat-requiring stabilizers fully hydrate during pasteurization.
- **Maillard browning:** At 85°C, slight browning between lactose and proteins begins. This adds a subtle "cooked" flavor. More noticeable if held longer or at higher temps.
- **Enzyme inactivation:** Lipases (which break down fat and cause rancid off-flavors) are destroyed.

### Formulation connection
- High-MSNF mixes benefit from higher pasteurization temps because more whey protein denaturation improves body.
- Flavor ingredients that are heat-sensitive (saffron volatiles, cardamom oils, kewra, rose compounds) should be added AFTER pasteurization to preserve aromatics.
- The reason pastes are often added post-pasteurization (but before freezing) is to preserve their flavor compounds while still ensuring they are distributed evenly.

---

## Step 4: Cooling and Aging

### What happens during aging
After pasteurization, the mix is rapidly cooled to 4°C and held for 4-24 hours (minimum 4 hours, 12-24 hours ideal).

### Why aging matters
1. **Fat crystallization:** Milk fat is a complex mixture of triglycerides with different melting points. At 4°C, fat globules partially crystallize. These crystals inside the globule are essential for partial coalescence to work later in the freezer.
2. **Protein hydration:** Proteins continue to bind water and increase viscosity.
3. **Stabilizer full hydration:** Any residual stabilizer that wasn't fully hydrated during pasteurization finishes hydrating.
4. **Emulsifier adsorption:** Emulsifiers slowly displace proteins from fat globule surfaces during aging. This process takes time — insufficient aging means incomplete protein displacement → poor drying and overrun in the freezer.

### What happens if you skip aging
- Fat hasn't crystallized → poor partial coalescence → wet product, low overrun, poor meltdown.
- Emulsifiers haven't had time to work → same issues.
- Product will be detectably worse in texture and air retention.

### Minimum aging time
- 4 hours is the practical minimum for acceptable results.
- 12-24 hours gives noticeably better texture.
- Beyond 24 hours, diminishing returns. Risk of microbial growth if temperature control is imperfect.

---

## Step 5: Continuous Freezer (CF)

### What happens
The aged mix is pumped into the continuous freezer, where three things happen simultaneously:
1. **Freezing:** The mix contacts a refrigerated barrel wall (-25°C to -30°C) and begins to freeze. Ice crystals form at the wall.
2. **Scraping:** A rotating dasher (scraper blades) continuously scrapes ice crystals off the barrel wall, mixing them back into the bulk.
3. **Air incorporation:** Air (or nitrogen) is injected into the mix. The dasher action whips this air into small bubbles. Partially coalesced fat stabilizes these bubbles.

### Key CF parameters
- **Draw temperature:** The temperature of the mix as it exits the freezer. Typically -5°C to -7°C for gelato. Colder draw = smaller ice crystals, higher viscosity, stiffer product.
- **Overrun:** Controlled by the air injection rate relative to the mix flow rate. See overrun document.
- **Dasher speed:** Faster dasher = more shear = more fat coalescence = dryer product. Also affects ice crystal size.
- **Residence time:** How long the mix spends in the barrel. Typically 30-90 seconds.

### Formulation connection
- **High-fat mixes** are more prone to churning in the CF. If the fat level is high AND the emulsifier dose is high AND the dasher speed is fast, the fat can over-coalesce → butter grains.
- **High-sugar/high-PAC mixes** need colder draw temperatures because more water remains unfrozen at any temperature. If the draw temp is the same as a lower-PAC mix, the product will be wetter and softer.
- **Low-MSNF mixes** produce less viscous unfrozen phase → air bubbles are larger and less stable.
- **Under-stabilized mixes** lose air faster after extrusion because the unfrozen phase drains away from air cell walls.

---

## Step 6: Filling and Blast Hardening

### What happens during blast hardening
Filled containers (100ml cups, 500ml tubs) are placed in a blast freezer at -35°C to -40°C (MeethaPitara uses -38°C). The goal is to freeze the product from -5°C (draw temperature) down to -18°C as fast as possible.

### Why speed matters
- Between -5°C and -18°C, water is actively freezing. If this process is slow, existing ice crystals grow large (because water molecules have time to find and attach to existing crystals).
- Fast hardening creates many small ice crystals → smoother texture.
- Rule of thumb: the center of the container should reach -18°C within 2-4 hours for best quality.
- Smaller containers (100ml) harden faster than larger ones (500ml) → potentially smoother texture in 100ml cups.

### Pack weight and formulation
- The filled weight of a container depends on formulation + overrun.
- Expected pack weight = Volume (L) × Density (kg/L) × 1000 / (1 + Overrun).
- Example: 500ml cup, density 1.08 kg/L, 30% overrun → 500 × 0.001 × 1080 / 1.30 = 415g.
- This is used by the production planning module for billing and cost calculations.

---

## Step 7: Storage and Distribution

### Storage temperature
- Ideal: -25°C (below glass transition temperature of the unfrozen phase → maximum stability).
- Acceptable: -18°C to -22°C.
- Above -18°C: ice crystal growth accelerates, texture degrades over days/weeks.

### Temperature cycling (the enemy)
- Every time the product warms up slightly and refreezes, ice crystals grow.
- This is the #1 cause of texture degradation during distribution.
- Stabilizers help slow this process but cannot stop it.
- For Zomato delivery: the cold chain between MeethaPitara's storage → delivery rider → customer's freezer involves multiple temperature abuse events. Formulations for delivery should be more robustly stabilized than those for a controlled display case.

### Home freezer reality
- Indian home freezers typically run at -15°C to -18°C with poor temperature stability (frequent door opening, defrost cycles).
- Products must be formulated to be scoopable at -18°C (requiring higher PAC than gelateria gelato) AND stable enough to withstand temperature cycling (requiring robust stabilization).
