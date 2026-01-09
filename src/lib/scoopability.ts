import { Metrics } from './calc';

export type ScoopAdvice = {
  serveTempC: number;   // recommended cabinet temp
  storeTempC: number;   // recommended storage
  frozenWaterAtServe_pct: number; // estimated
  hardness: 'soft' | 'ideal' | 'firm' | 'too_hard';
};

export function estimateFrozenWater(metrics: Metrics, tempC: number): number {
  // Heuristic: map Absolute PAC to a curve slope; calibrate later with your batch data.
  // Absolute PAC = PAC / water_pct
  const absPAC = metrics.water_pct > 0 ? metrics.pac / metrics.water_pct : metrics.pac;
  const T_ifp = -0.54 * (metrics.pac / 100); // crude initial freezing point estimate per sucrose-equivalent family
  const alpha = 0.25 + 2.0 * absPAC;         // steeper with higher absPAC
  const F = 1 - Math.exp(alpha * (tempC - T_ifp)); // 0..1
  return Math.max(0, Math.min(1, F)) * 100;
}

export function recommendTemps(metrics: Metrics): ScoopAdvice {
  // Default targets
  const store = -18;
  // Find serve temp where frozen water ≈ 72%
  let t = -12; // start
  for (let k = 0; k < 20; k++) {
    const f = estimateFrozenWater(metrics, t);
    if (Math.abs(f - 72) < 0.5) break;
    t += (f > 72 ? 0.5 : -0.5); // binary-ish search
  }
  
  const frozenWaterAtServe = estimateFrozenWater(metrics, t);
  
  // Determine hardness category
  let hardness: ScoopAdvice['hardness'];
  if (frozenWaterAtServe < 65) hardness = 'soft';
  else if (frozenWaterAtServe < 75) hardness = 'ideal';
  else if (frozenWaterAtServe < 85) hardness = 'firm';
  else hardness = 'too_hard';
  
  return { 
    serveTempC: t, 
    storeTempC: store, 
    frozenWaterAtServe_pct: frozenWaterAtServe,
    hardness
  };
}

export function calculateIdealServeTemp(metrics: Metrics, targetFrozenWater: number = 72): number {
  let tempC = -12;
  for (let i = 0; i < 30; i++) {
    const currentFrozen = estimateFrozenWater(metrics, tempC);
    const diff = currentFrozen - targetFrozenWater;
    
    if (Math.abs(diff) < 0.1) break;
    
    // Adjust temperature based on difference
    tempC += diff > 0 ? 0.2 : -0.2;
    
    // Safety bounds
    if (tempC < -20) tempC = -20;
    if (tempC > -5) tempC = -5;
  }
  
  return Math.round(tempC * 10) / 10; // Round to 0.1°C
}

export function getTemperatureGuidance(metrics: Metrics): string[] {
  const advice = recommendTemps(metrics);
  const tips: string[] = [];
  
  tips.push(`Recommended serving: ${advice.serveTempC.toFixed(1)}°C`);
  tips.push(`Storage: ${advice.storeTempC}°C or colder`);
  tips.push(`Frozen water at serve: ${advice.frozenWaterAtServe_pct.toFixed(1)}%`);
  
  switch (advice.hardness) {
    case 'soft':
      tips.push('Texture: Soft - may be too easy to scoop, consider reducing PAC');
      break;
    case 'ideal':
      tips.push('Texture: Ideal scoopability');
      break;
    case 'firm':
      tips.push('Texture: Firm - good for display, may need warmer cabinet');
      break;
    case 'too_hard':
      tips.push('Texture: Too hard - increase PAC or serve warmer');
      break;
  }
  
  return tips;
}