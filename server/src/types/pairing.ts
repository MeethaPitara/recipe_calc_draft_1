export type FlavorVector = {
  volatiles?: Record<string, number>; // e.g., {"linalool": 0.8}
  sensory: Record<'sweet'|'roasted'|'floral'|'green'|'spice_heat'|'cooling'|'tannin'|'acid', number>;
  texture: Record<'creamy'|'crunch'|'juicy'|'oily', number>;
  fatAffinity?: number; // 0..1
  acidity?: number;     // 0..1
};

export type PairingScore = {
  idA: string; 
  idB: string;
  synergy: number;  // 0..1 overlap
  contrast: number; // 0..1 complement
  feasibility: number; // manufacturability penalty applied
  score: number;    // final rank score
  reason?: string;  // why this pairing works
};

export type PairingCategory = 'synergy' | 'novel' | 'classic';