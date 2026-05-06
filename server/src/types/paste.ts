export type PreservationMethod = 'retort'|'hot_fill'|'frozen'|'freeze_dry';

export type Reference = {
  id: string;
  source: string; // e.g., "MEC3 (2023)", "Pregel White Paper", "LWT-Food Sci Tech (2022)"
  title: string;
  relevance: string; // what this citation supports
};

export type ProcessStep = {
  step: number;
  action: string;
  temperature?: number; // °C
  time?: number; // minutes
  critical_control?: string;
  rationale: string;
  references: string[]; // reference IDs
};

export type ScientificIngredient = {
  name: string;
  grams: number;
  percentage: number;
  function: string; // e.g., "emulsifier", "stabilizer", "flavor carrier"
  alternative?: string;
  reference: string; // reference ID
};

export type PasteComponent = {
  id: string; 
  name: string; 
  grams: number;
  water_pct: number; 
  sugars_pct?: number; 
  fat_pct: number; 
  msnf_pct?: number; 
  other_solids_pct?: number;
  sugar_split?: { glucose?:number; fructose?:number; sucrose?:number };
  notes?: string[];
};

export type LabSpecs = {
  brix_deg?: number;
  pH?: number;
  aw_est?: number;
};

export type PasteFormula = {
  id: string;
  name: string;
  category: 'dairy'|'fruit'|'confection'|'spice'|'nut'|'mixed';
  components: PasteComponent[];
  batch_size_g: number;
  water_pct: number; 
  sugars_pct?: number; 
  fat_pct: number; 
  msnf_pct?: number; 
  other_solids_pct?: number;
  sugar_split?: { glucose?:number; fructose?:number; sucrose?:number };
  acidity_citric_pct?: number;
  allergens?: { milk?: boolean; nuts?: boolean; gluten?: boolean };
  lab?: LabSpecs;
  cost_per_kg?: number;
};

export type PreservationAdvice = {
  method: PreservationMethod;
  confidence: number;
  why: string[];
  targets: {
    brix_deg?: number; 
    pH?: number; 
    aw_max?: number;
    particle_mm_max?: number;
  };
  packaging: string[];
  storage: 'ambient'|'chilled'|'frozen';
  shelf_life_hint: string;
  impact_on_gelato: {
    aroma_retention: 'low'|'medium'|'high';
    color_browning: 'low'|'medium'|'high';
    notes: string[];
  };
};

export type ScientificRecipe = {
  paste_name: string;
  yield_kg: number;
  category: 'dairy'|'fruit'|'confection'|'spice'|'nut'|'mixed';
  ingredients: ScientificIngredient[];
  composition: {
    fat_pct: number;
    msnf_pct: number;
    sugars_pct: number;
    water_pct: number;
    water_activity: number;
  };
  process: ProcessStep[];
  preservation_method: PreservationMethod;
  gelato_dosage: {
    min_pct: number;
    max_pct: number;
    recommended_pct: number;
  };
  sensory_prediction: {
    mouthfeel: string;
    flavor_profile: string;
    color: string;
    shelf_life: string;
  };
  references: Reference[];
  ai_confidence: number; // 0-1
  novel_pairing?: {
    discovered: boolean;
    ingredients: string[];
    rationale: string;
  };
};
