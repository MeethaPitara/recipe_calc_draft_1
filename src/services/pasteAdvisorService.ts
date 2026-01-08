import { PasteFormula, PreservationAdvice, ScientificRecipe } from '@/types/paste';
import { getSupabase } from '@/integrations/supabase/safeClient';

export class PasteAdvisorService {
  
  async generateScientificFormulation(
    pasteType: string, 
    category: string,
    mode: 'standard' | 'ai_discovery' | 'reverse_engineer',
    knownIngredients?: string,
    constraints?: string,
    targets?: {
      sp?: number;
      afp?: number;
      total_solids?: number;
      fat_pct?: number;
      viscosity?: 'spreadable' | 'pourable' | 'thick';
    }
  ): Promise<ScientificRecipe> {
    const supabase = await getSupabase();
    const { data, error } = await supabase.functions.invoke('paste-formulator', {
      body: {
        pasteType,
        category,
        mode,
        knownIngredients,
        constraints,
        targets
      }
    });

    if (error) throw error;
    if (!data.success) throw new Error(data.error);
    
    return data.recipe;
  }

  calculateViscosityProxy(paste: PasteFormula): {
    viscosity_index: number;
    texture_prediction: string;
    spreadability: 'spreadable' | 'pourable' | 'thick';
    recommendations: string[];
  } {
    const totalSolids = 100 - paste.water_pct;
    const fat = paste.fat_pct;
    const sugars = paste.sugars_pct || 0;
    
    // Viscosity proxy formula (empirical model)
    // Higher solids, fat, and certain sugars increase viscosity
    const viscosity_index = 
      (totalSolids * 0.5) + 
      (fat * 0.8) + 
      (sugars * 0.3);
    
    let texture_prediction = '';
    let spreadability: 'spreadable' | 'pourable' | 'thick' = 'spreadable';
    const recommendations: string[] = [];
    
    if (viscosity_index < 40) {
      texture_prediction = 'Thin, syrup-like consistency';
      spreadability = 'pourable';
      recommendations.push('Add fiber (pectin/xanthan 0.2-0.5%) to increase viscosity');
      recommendations.push('Increase total solids through concentration');
    } else if (viscosity_index < 60) {
      texture_prediction = 'Nutella-like spreadable consistency';
      spreadability = 'spreadable';
      recommendations.push('Optimal for gelato infusion at 8-12%');
    } else {
      texture_prediction = 'Very thick, butter-like consistency';
      spreadability = 'thick';
      recommendations.push('May need warming before use');
      recommendations.push('Consider adding liquid glucose (DE42) to reduce viscosity');
    }
    
    // Anti-crystallization check
    const glucose_ratio = 0.2; // Would need actual sugar split data
    if (glucose_ratio < 0.15 && sugars > 40) {
      recommendations.push('Add dextrose/glucose (10-20% of sugars) to prevent crystallization');
    }
    
    return {
      viscosity_index,
      texture_prediction,
      spreadability,
      recommendations
    };
  }

  calculateScientificMetrics(paste: PasteFormula) {
    const totalSolids = 100 - paste.water_pct;
    const fat = paste.fat_pct;
    const msnf = paste.msnf_pct || 0;
    const sugars = paste.sugars_pct || 0;
    
    // Water activity estimation (simplified Norrish equation)
    const brix = paste.lab?.brix_deg || (sugars * 1.2);
    const aw = paste.lab?.aw_est || Math.max(0.75, 1 - 0.005 * brix);
    
    // Industry benchmarks (MEC3/Pregel standards)
    const benchmarks = {
      dairy: { fat: [25, 40], msnf: [12, 18], aw: 0.85 },
      nut: { fat: [35, 55], msnf: [5, 10], aw: 0.80 },
      fruit: { fat: [0, 5], msnf: [2, 8], aw: 0.85 },
      confection: { fat: [10, 25], msnf: [5, 12], aw: 0.75 },
      spice: { fat: [5, 20], msnf: [3, 8], aw: 0.70 },
      mixed: { fat: [15, 35], msnf: [8, 15], aw: 0.80 }
    };
    
    const benchmark = benchmarks[paste.category];
    
    return {
      totalSolids,
      fat,
      msnf,
      sugars,
      aw,
      benchmark,
      warnings: [
        ...(fat < benchmark.fat[0] || fat > benchmark.fat[1] 
          ? [`Fat content (${fat.toFixed(1)}%) outside industry standard (${benchmark.fat[0]}-${benchmark.fat[1]}%)`] 
          : []),
        ...(aw > benchmark.aw 
          ? [`Water activity (${aw.toFixed(2)}) too high for shelf stability (target <${benchmark.aw})`] 
          : []),
        ...(msnf < benchmark.msnf[0] && paste.category === 'dairy'
          ? [`MSNF (${msnf.toFixed(1)}%) below dairy standard (${benchmark.msnf[0]}-${benchmark.msnf[1]}%)`]
          : [])
      ]
    };
  }
  
  advise(paste: PasteFormula, prefs?: { ambientPreferred?: boolean; cleanLabel?: boolean; particulate_mm?: number }): PreservationAdvice[] {
    const pH = paste.lab?.pH;
    const brix = paste.lab?.brix_deg;
    const dairy = paste.category === 'dairy' || (paste.msnf_pct ?? 0) > 1;
    const particulate = prefs?.particulate_mm ?? 2;

    // quick aw proxy from Brix (very rough; model later with your data)
    const aw_est = paste.lab?.aw_est ?? (brix != null ? Math.max(0.75, 1 - 0.45 * (brix / 100)) : undefined);

    const adv: PreservationAdvice[] = [];

    // 1) hot_fill candidate
    if (!dairy && pH != null && pH <= 4.6 && (brix ?? 0) >= 55 && particulate <= 5) {
      adv.push({
        method: 'hot_fill',
        confidence: 0.7,
        why: [
          'High-acid & high °Bx; typical jam-like hot-fill feasible', 
          'No dairy components', 
          particulate > 5 ? 'Particulates borderline; consider size reduction' : 'Particulates ok'
        ],
        targets: { 
          brix_deg: Math.max(60, brix ?? 60), 
          pH: Math.min(3.8, pH ?? 3.8), 
          aw_max: 0.85, 
          particle_mm_max: 5 
        },
        packaging: ['Glass jar + lug cap (hot-fill)', 'HDPE bottle (heat resistant)'],
        storage: 'ambient',
        shelf_life_hint: 'Ambient shelf-life typical for hot-filled jams; verify with process authority',
        impact_on_gelato: { 
          aroma_retention: 'medium', 
          color_browning: 'medium', 
          notes: ['Balanced solids; adds water & sugars to base'] 
        }
      });
    }

    // 2) retort candidate (ambient, dairy or low-acid)
    if ((dairy || (pH != null && pH > 4.6)) && prefs?.ambientPreferred) {
      adv.push({
        method: 'retort',
        confidence: 0.7,
        why: [
          dairy ? 'Dairy present; ambient requires commercial sterility' : 'Low-acid (>4.6) for ambient',
          'Ambient logistics requested'
        ],
        targets: { pH: pH, brix_deg: brix, aw_max: 0.97, particle_mm_max: 10 },
        packaging: ['Retort pouch', 'Cans', 'Glass jar (retortable)'],
        storage: 'ambient',
        shelf_life_hint: 'Ambient; exact lethality to be validated by process authority',
        impact_on_gelato: { 
          aroma_retention: 'low', 
          color_browning: 'high', 
          notes: ['Potential Maillard/caramel notes; adjust color/flavor'] 
        }
      });
    }

    // 3) frozen candidate (quality-first, minimal process)
    adv.push({
      method: 'frozen',
      confidence: 0.8,
      why: ['Minimal thermal impact; best flavor retention', 'Requires frozen logistics'],
      targets: { brix_deg: brix, pH: pH },
      packaging: ['Foodgrade pails', 'Vacuum pouch + blast freeze'],
      storage: 'frozen',
      shelf_life_hint: 'Frozen; quality depends on ice crystal control',
      impact_on_gelato: { 
        aroma_retention: 'high', 
        color_browning: 'low', 
        notes: ['Adds water solids; plan PAC/SP balance'] 
      }
    });

    // 4) freeze_dry candidate (powder)
    adv.push({
      method: 'freeze_dry',
      confidence: 0.8,
      why: ['Zero added water to base', 'Great for delicate aromatics'],
      targets: { brix_deg: brix, pH: pH, aw_max: 0.3 },
      packaging: ['FD jar with desiccant', 'FOIL pouch + nitrogen'],
      storage: 'ambient',
      shelf_life_hint: 'Ambient; protect from moisture uptake',
      impact_on_gelato: { 
        aroma_retention: 'high', 
        color_browning: 'low', 
        notes: ['Boosts TS without PAC; may need sucrose/dextrose adjustment'] 
      }
    });

    return adv.sort((a, b) => b.confidence - a.confidence);
  }
}

export const pasteAdvisorService = new PasteAdvisorService();