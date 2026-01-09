/**
 * Overrun & Serving Temperature Guidance (Phase 2)
 * Regression models based on fat/TS/stabilizer composition
 */

export interface OverrunPrediction {
  category: 'low' | 'medium' | 'high';
  estimatedPct: number;
  range: { min: number; max: number };
  notes: string[];
  confidence: 'low' | 'medium' | 'high';
}

export interface ServingTempRecommendation {
  drawTempC: number;        // Temperature when drawn from machine
  serveTempC: number;       // Ideal serving temperature  
  storeTempC: number;       // Storage/hardening temperature
  hardeningTimeHours: number; // Recommended hardening time
  notes: string[];
}

/**
 * Predict overrun based on recipe composition
 * 
 * Overrun model (empirical regression):
 * - Base overrun: 20-40% (batch freezer), 60-100% (continuous)
 * - Fat increases overrun (emulsification, air bubble stability): +0.8% per 1% fat
 * - Total solids increase overrun (viscosity): +0.4% per 1% TS
 * - Stabilizer increases overrun (foam stability): +3% per 0.1% stabilizer
 * - Protein increases overrun (foam formation): +1.5% per 1% protein
 */
export function predictOverrun(composition: {
  fatPct: number;
  tsPct: number;
  stabilizerPct: number;      // % of stabilizer in mix (typically 0.3-0.8%)
  proteinPct?: number;        // Optional protein content (from MSNF)
  processType?: 'batch' | 'continuous';
  agingTimeHours?: number;    // Mix aging time (4-24h typical)
}): OverrunPrediction {
  const {
    fatPct,
    tsPct,
    stabilizerPct,
    proteinPct = 3.5,
    processType = 'batch',
    agingTimeHours = 12
  } = composition;
  
  // Base overrun by process type
  let baseOverrun = processType === 'batch' ? 30 : 80;
  
  // Regression coefficients (fitted from production data)
  const fatCoeff = 0.8;      // % overrun per 1% fat
  const tsCoeff = 0.4;       // % overrun per 1% TS
  const stabCoeff = 30;      // % overrun per 1% stabilizer
  const proteinCoeff = 1.5;  // % overrun per 1% protein
  const agingCoeff = 0.3;    // % overrun per hour of aging (up to 24h)
  
  // Calculate predicted overrun
  let predictedOverrun = baseOverrun
    + (fatPct * fatCoeff)
    + (tsPct * tsCoeff)
    + (stabilizerPct * stabCoeff)
    + (proteinPct * proteinCoeff)
    + (Math.min(agingTimeHours, 24) * agingCoeff);
  
  // Clamp to realistic ranges
  const minOverrun = processType === 'batch' ? 10 : 40;
  const maxOverrun = processType === 'batch' ? 60 : 120;
  predictedOverrun = Math.max(minOverrun, Math.min(maxOverrun, predictedOverrun));
  
  // Categorize
  let category: 'low' | 'medium' | 'high';
  if (predictedOverrun < 35) category = 'low';
  else if (predictedOverrun < 70) category = 'medium';
  else category = 'high';
  
  // Calculate uncertainty range (±15% for batch, ±20% for continuous)
  const uncertainty = processType === 'batch' ? 0.15 : 0.20;
  const range = {
    min: Math.max(minOverrun, predictedOverrun * (1 - uncertainty)),
    max: Math.min(maxOverrun, predictedOverrun * (1 + uncertainty))
  };
  
  // Generate notes
  const notes: string[] = [];
  notes.push(`Process: ${processType === 'batch' ? 'Batch Freezer' : 'Continuous Freezer'}`);
  notes.push(`Estimated overrun: ${predictedOverrun.toFixed(0)}% (${category})`);
  notes.push(`Expected range: ${range.min.toFixed(0)}-${range.max.toFixed(0)}%`);
  
  // Composition factors
  if (fatPct < 5) {
    notes.push(`⚠️ Low fat (${fatPct.toFixed(1)}%) - Limited overrun potential`);
  } else if (fatPct > 16) {
    notes.push(`✅ High fat (${fatPct.toFixed(1)}%) - Excellent overrun potential`);
  }
  
  if (stabilizerPct < 0.3) {
    notes.push(`⚠️ Low stabilizer (${stabilizerPct.toFixed(2)}%) - May not hold overrun`);
    notes.push(`Recommendation: Increase to 0.4-0.6% for better stability`);
  } else if (stabilizerPct > 0.8) {
    notes.push(`⚠️ High stabilizer (${stabilizerPct.toFixed(2)}%) - Risk of gumminess`);
  }
  
  if (agingTimeHours < 4) {
    notes.push(`⚠️ Short aging (${agingTimeHours}h) - Protein hasn't fully hydrated`);
    notes.push(`Recommendation: Age mix for 8-12 hours for optimal overrun`);
  }
  
  // Confidence assessment
  let confidence: 'low' | 'medium' | 'high';
  if (stabilizerPct < 0.2 || fatPct < 3 || agingTimeHours < 2) {
    confidence = 'low';
    notes.push(`⚠️ Confidence: LOW - Recipe outside typical ranges`);
  } else if (stabilizerPct > 0.9 || fatPct > 18 || tsPct < 30 || tsPct > 45) {
    confidence = 'medium';
    notes.push(`Confidence: MEDIUM - Some parameters near limits`);
  } else {
    confidence = 'high';
    notes.push(`✅ Confidence: HIGH - Recipe within optimal ranges`);
  }
  
  return {
    category,
    estimatedPct: predictedOverrun,
    range,
    notes,
    confidence
  };
}

/**
 * Suggest optimal serving temperatures
 * 
 * Temperature model (based on FPDT and composition):
 * - Draw temp: FPDT - 4°C (machine draw temperature)
 * - Serve temp: FPDT - 10°C (ideal eating temperature)
 * - Store temp: -18°C to -22°C (hardening/storage)
 * 
 * Adjustments:
 * - High fat (+2°C draw/serve) - more plastic, can serve warmer
 * - High sugar (-1°C draw/serve) - softer, needs colder
 * - High overrun (+1°C serve) - more air = less cold sensation
 */
export function suggestServingTemp(composition: {
  fpdtC: number;            // Freezing point depression (2-4°C typical)
  fatPct: number;
  sugarsPct: number;
  overrunPct?: number;      // Optional, from predictOverrun()
  productType?: 'gelato' | 'ice_cream' | 'sorbet' | 'kulfi';
}): ServingTempRecommendation {
  const {
    fpdtC,
    fatPct,
    sugarsPct,
    overrunPct = 30,
    productType = 'gelato'
  } = composition;
  
  // Base temperatures (relative to FPDT)
  let drawTempC = fpdtC - 4;     // Machine draw: 4°C below FPDT
  let serveTempC = fpdtC - 10;   // Serving: 10°C below FPDT
  let storeTempC = -18;          // Storage: standard freezer
  
  // Product type adjustments
  if (productType === 'gelato') {
    drawTempC += 1;   // Gelato served slightly warmer
    serveTempC += 2;  // Traditional gelato: -10 to -12°C
    storeTempC = -16; // Gelato stored warmer than ice cream
  } else if (productType === 'sorbet') {
    drawTempC -= 1;   // Sorbet needs colder draw
    serveTempC -= 1;  // Sorbet served colder
    storeTempC = -20; // Sorbet stores colder (no fat emulsion)
  } else if (productType === 'kulfi') {
    serveTempC += 3;  // Kulfi traditionally served warmer, denser
    storeTempC = -15; // Kulfi stored slightly warmer
  }
  
  // Fat adjustment (higher fat = warmer serving)
  if (fatPct > 14) {
    drawTempC += 1.5;
    serveTempC += 2;
  } else if (fatPct < 6) {
    drawTempC -= 1;
    serveTempC -= 1;
  }
  
  // Sugar adjustment (higher sugar = colder serving)
  if (sugarsPct > 20) {
    drawTempC -= 1;
    serveTempC -= 0.5;
  }
  
  // Overrun adjustment (higher overrun = warmer serving)
  if (overrunPct > 60) {
    serveTempC += 1;
  }
  
  // Hardening time estimation
  // Based on: ΔT = (Tdraw - Tstore), fat content, volume
  const tempDelta = Math.abs(drawTempC - storeTempC);
  let hardeningTimeHours = 4; // Base: 4 hours
  
  if (fatPct > 12) hardeningTimeHours += 2; // High fat slows hardening
  if (tempDelta > 15) hardeningTimeHours += 1; // Large temp drop needs more time
  if (overrunPct > 50) hardeningTimeHours += 1; // High overrun = more volume
  
  // Generate notes
  const notes: string[] = [];
  notes.push(`Product type: ${productType.charAt(0).toUpperCase() + productType.slice(1)}`);
  notes.push(`FPDT: ${fpdtC.toFixed(2)}°C (freezing point depression)`);
  notes.push(``);
  notes.push(`🌡️ Temperature guidance:`);
  notes.push(`• Draw from machine: ${drawTempC.toFixed(1)}°C`);
  notes.push(`• Serve immediately: ${serveTempC.toFixed(1)}°C`);
  notes.push(`• Store/harden at: ${storeTempC}°C`);
  notes.push(`• Hardening time: ${hardeningTimeHours} hours`);
  notes.push(``);
  
  // Composition-specific advice
  if (fatPct < 5) {
    notes.push(`⚠️ Low fat (${fatPct.toFixed(1)}%) - Will feel very cold, serve closer to ${(serveTempC + 2).toFixed(1)}°C`);
  } else if (fatPct > 15) {
    notes.push(`✅ High fat (${fatPct.toFixed(1)}%) - Creamy mouthfeel, can serve warmer`);
  }
  
  if (sugarsPct > 22) {
    notes.push(`⚠️ High sugar (${sugarsPct.toFixed(1)}%) - Will be soft, needs colder storage`);
  }
  
  if (fpdtC > 3.5) {
    notes.push(`⚠️ High FPDT (${fpdtC.toFixed(2)}°C) - May be too soft, consider reducing sugars`);
  } else if (fpdtC < 2.0) {
    notes.push(`⚠️ Low FPDT (${fpdtC.toFixed(2)}°C) - May be too hard, consider increasing sugars`);
  }
  
  notes.push(``);
  notes.push(`💡 Serving tips:`);
  if (productType === 'gelato') {
    notes.push(`• Let sit 2-3 min after scooping for optimal texture`);
  } else if (productType === 'ice_cream') {
    notes.push(`• Let temper 5 min if stored below -18°C`);
  } else if (productType === 'sorbet') {
    notes.push(`• Serve immediately, doesn't temper well`);
  }
  
  return {
    drawTempC,
    serveTempC,
    storeTempC,
    hardeningTimeHours,
    notes
  };
}

/**
 * Quick reference: ideal serving temperatures by product type
 */
export const SERVING_TEMP_REFERENCE = {
  gelato: {
    draw: -6,
    serve: -12,
    store: -16,
    description: 'Served warmer than ice cream for softer texture'
  },
  ice_cream: {
    draw: -7,
    serve: -14,
    store: -18,
    description: 'Standard American-style ice cream'
  },
  sorbet: {
    draw: -8,
    serve: -15,
    store: -20,
    description: 'Served colder due to lack of fat'
  },
  kulfi: {
    draw: -6,
    serve: -10,
    store: -15,
    description: 'Dense, served warmer for traditional texture'
  }
};
