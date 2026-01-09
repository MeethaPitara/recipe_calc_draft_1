import { MachineProfile, MACHINES } from '@/types/machine';
import { Metrics } from './calc';

export function machineAdvice(machine: MachineProfile, metrics: Metrics): string[] {
  const tips: string[] = [];
  
  // Overrun band info
  tips.push(`Target overrun ${machine.overrunTarget_pct[0]}–${machine.overrunTarget_pct[1]}%`);
  
  // Draw temperature guidance
  tips.push(`Draw temp: ${machine.expectedDrawTempC[0]}°C to ${machine.expectedDrawTempC[1]}°C`);
  
  // Machine-specific formulation advice
  switch (machine.id) {
    case 'continuous':
      if (metrics.pac < 24) {
        tips.push('Continuous + low PAC → can feel icy; consider small dextrose increase or water reduction');
      }
      if (metrics.fat_pct > 15) {
        tips.push('High fat with continuous freezing may need emulsifier adjustment');
      }
      if (metrics.ts_add_pct < 35) {
        tips.push('Low TS may cause texture issues with high overrun - consider increasing solids');
      }
      break;
      
    case 'batch':
      if (metrics.sp > 24) {
        tips.push('High SP in batch can feel cloying; nudge sucrose→maltodextrin to keep body without extra sweetness');
      }
      if (metrics.fat_pct < 8 && metrics.msnf_pct < 9) {
        tips.push('Low fat+MSNF may need extra stabilizer for batch freezing texture');
      }
      if (metrics.pac > 30) {
        tips.push('Very high PAC may be too soft for batch freezing - consider sugar balance');
      }
      break;
  }
  
  // General texture guidance based on shear level
  if (machine.shearLevel === 'high' && metrics.fat_pct > 18) {
    tips.push('High shear + high fat: watch for over-churning, may need process adjustment');
  } else if (machine.shearLevel === 'low' && metrics.fat_pct < 6) {
    tips.push('Low shear + low fat: ensure adequate stabilization for smooth texture');
  }
  
  // Overrun-specific advice
  const midOverrun = (machine.overrunTarget_pct[0] + machine.overrunTarget_pct[1]) / 2;
  if (midOverrun > 80) {
    tips.push('High overrun target: ensure MSNF and stabilizer levels support air incorporation');
  } else if (midOverrun < 30) {
    tips.push('Low overrun target: focus on dense, creamy mouthfeel - higher fat beneficial');
  }
  
  return tips;
}

export function getOptimalMachineSettings(
  metrics: Metrics, 
  machineType: 'batch' | 'continuous'
): { 
  agingTime: string;
  drawTemp: string;
  overrunTarget: string;
  notes: string[];
} {
  const machine = MACHINES[machineType];
  const notes: string[] = [];
  
  // Aging time based on fat content
  let agingTime = '4-6 hours';
  if (metrics.fat_pct > 15) {
    agingTime = '6-8 hours';
    notes.push('Extended aging for high fat content');
  } else if (metrics.fat_pct < 8) {
    agingTime = '2-4 hours';
    notes.push('Shorter aging for low fat recipes');
  }
  
  // Draw temperature optimization
  let drawTemp = `${machine.expectedDrawTempC[0]}°C to ${machine.expectedDrawTempC[1]}°C`;
  if (metrics.pac > 28) {
    drawTemp = `${machine.expectedDrawTempC[0] - 1}°C to ${machine.expectedDrawTempC[1]}°C`;
    notes.push('Slightly colder draw for high PAC recipe');
  } else if (metrics.pac < 23) {
    drawTemp = `${machine.expectedDrawTempC[0]}°C to ${machine.expectedDrawTempC[1] + 1}°C`;
    notes.push('Slightly warmer draw for low PAC recipe');
  }
  
  // Overrun target refinement
  const [minOverrun, maxOverrun] = machine.overrunTarget_pct;
  let targetOverrun = Math.round((minOverrun + maxOverrun) / 2);
  
  if (metrics.fat_pct > 15) {
    targetOverrun = Math.round(minOverrun + (maxOverrun - minOverrun) * 0.3);
    notes.push('Lower overrun target for rich, dense texture');
  } else if (metrics.fat_pct < 8) {
    targetOverrun = Math.round(minOverrun + (maxOverrun - minOverrun) * 0.7);
    notes.push('Higher overrun target to compensate for lower richness');
  }
  
  return {
    agingTime,
    drawTemp,
    overrunTarget: `${targetOverrun}%`,
    notes: notes.concat(machineAdvice(machine, metrics))
  };
}

export function validateForMachine(
  metrics: Metrics, 
  machineType: 'batch' | 'continuous'
): { valid: boolean; warnings: string[]; recommendations: string[] } {
  const warnings: string[] = [];
  const recommendations: string[] = [];
  let valid = true;
  
  const machine = MACHINES[machineType];
  
  // Check basic compatibility
  if (machineType === 'continuous') {
    if (metrics.ts_add_pct < 32) {
      warnings.push('TS% below 32% may cause texture issues with continuous freezing');
      recommendations.push('Increase total solids to 32-42%');
      valid = false;
    }
    
    if (metrics.fat_pct > 20) {
      warnings.push('Very high fat content may cause processing issues');
      recommendations.push('Consider reducing fat or adjusting emulsifier system');
    }
  } else if (machineType === 'batch') {
    if (metrics.pac > 32) {
      warnings.push('Very high PAC may result in texture too soft for batch freezing');
      recommendations.push('Reduce high-PAC sugars or increase firming agents');
    }
    
    if (metrics.fat_pct < 6 && metrics.msnf_pct < 7) {
      warnings.push('Low fat and MSNF may need enhanced stabilization');
      recommendations.push('Increase MSNF or add stabilizer blend');
    }
  }
  
  // Universal checks
  if (metrics.sp > 28) {
    warnings.push('Very high sweetness may mask other flavors');
    recommendations.push('Consider replacing some sugars with maltodextrin');
  }
  
  if (metrics.water_pct > 70) {
    warnings.push('High water content may cause ice crystal issues');
    recommendations.push('Increase solids or reduce liquid ingredients');
  }
  
  return { valid, warnings, recommendations };
}