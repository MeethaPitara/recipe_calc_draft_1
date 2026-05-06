export type MachineProfile = {
  id: 'batch'|'continuous';
  name: string;
  overrunTarget_pct: [number, number];
  shearLevel: 'low'|'medium'|'high';
  expectedDrawTempC: [number, number];
};

export const MACHINES: Record<string, MachineProfile> = {
  batch: { 
    id:'batch', 
    name:'Italian Batch Freezer', 
    overrunTarget_pct:[20,45], 
    shearLevel:'medium', 
    expectedDrawTempC:[-7,-5] 
  },
  continuous: { 
    id:'continuous', 
    name:'Continuous Freezer', 
    overrunTarget_pct:[80,120], 
    shearLevel:'high', 
    expectedDrawTempC:[-8,-6] 
  }
};