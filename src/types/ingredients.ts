export type VerificationStatus =
  | 'verified'        // Checked and usable
  | 'supplier_data'   // Based on spec sheet
  | 'lab_tested'      // Based on lab testing
  | 'estimated'       // Use carefully
  | 'ai_estimated'    // Not final
  | 'user_entered';   // Needs review

export type IngredientCategory =
  | 'dairy' | 'sugar' | 'stabilizer' | 'fruit' | 'flavor' | 'fat' | 'other'
  | 'Indian Sweets' | 'Flavorings and Condiments' | 'Gelato flavors' | 'Nuts and Seeds' | 'Fruits' | 'Dairy Products'
  | string; // Allow any string to prevent future crashes

export type SugarSplit = {
  glucose?: number;   // % of fruit sugars
  fructose?: number;  // % of fruit sugars
  sucrose?: number;   // % of fruit sugars
};

export type IngredientData = {
  id: string;
  name: string;
  category: IngredientCategory;

  // Composition (% of ingredient mass)
  water_pct: number;
  sugars_pct?: number;
  fat_pct: number;
  msnf_pct?: number;
  other_solids_pct?: number;

  // Protein (% of ingredient mass). Overrides 0.36×MSNF fallback for this ingredient.
  protein_pct?: number;

  // Coefficients (optional; sucrose baseline 1.00)
  sp_coeff?: number;
  pac_coeff?: number;
  de?: number;
  lactose_pct?: number;
  density_g_per_ml?: number;

  // Fruit helpers (optional)
  brix_estimate?: number;
  sugar_split?: SugarSplit;     // {glucose,fructose,sucrose} sum≈100
  acidity_citric_pct?: number;

  // PHASE 3: Analytical Compensation
  characterization_pct?: number; // Percentage of inclusion used for flavor characterization
  hardening_factor?: number; // Texture hardening effect (0-1 scale)

  // Commerce/UX
  cost_per_kg?: number;
  allergens?: { milk?: boolean; nuts?: boolean; gluten?: boolean };
  veg_flag?: 'veg' | 'non-veg';
  notes?: string[];
  tags?: string[];
  user_email?: string;
  is_custom?: boolean;
  verification_status?: VerificationStatus;
  verified_at?: string;    // ISO date string
  verified_source?: string; // e.g. "Amul spec sheet", "NDDB lab"
  supplier_data_sheet_url?: string;
  formulation_warnings?: string[];
};

export interface Ingredient {
  name: string;
  pac: number; // PAC (Anti-freezing Power) - renamed from AFP
  pod: number; // Protein Other than Dairy
  sp: number;  // Sweetness Power (relative to sucrose)
  fat: number;
  msnf: number; // Milk Solids Non-Fat
  cost: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface RecipeTargets {
  totalSolids: { min: number; max: number };
  fat: { min: number; max: number };
  msnf: { min: number; max: number };
  pac: { min: number; max: number };
  sweetness: { min: number; max: number };
}

export interface RecipeMetrics {
  totalSolids: number;
  fat: number;
  msnf: number;
  pac: number;
  sweetness: number;
  cost: number;
  totalWeight: number;
}

export interface OptimizationSuggestion {
  type: 'warning' | 'info' | 'success';
  message: string;
  action: () => void;
}