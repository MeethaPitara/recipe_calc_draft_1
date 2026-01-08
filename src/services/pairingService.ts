import { FlavorVector, PairingScore, PairingCategory } from '@/types/pairing';
import { IngredientData } from '@/types/ingredients';

// Flavor knowledge base for common ingredients
const FLAVOR_DATABASE: Record<string, FlavorVector> = {
  // Fruits
  mango: {
    sensory: { sweet: 0.8, roasted: 0, floral: 0.6, green: 0.2, spice_heat: 0, cooling: 0, tannin: 0, acid: 0.3 },
    texture: { creamy: 0.4, crunch: 0, juicy: 0.9, oily: 0.1 },
    fatAffinity: 0.6,
    acidity: 0.3,
    volatiles: { terpenes: 0.7, esters: 0.8 }
  },
  strawberry: {
    sensory: { sweet: 0.6, roasted: 0, floral: 0.4, green: 0.3, spice_heat: 0, cooling: 0, tannin: 0.1, acid: 0.5 },
    texture: { creamy: 0.2, crunch: 0.1, juicy: 0.8, oily: 0 },
    fatAffinity: 0.4,
    acidity: 0.5
  },
  banana: {
    sensory: { sweet: 0.9, roasted: 0.1, floral: 0.2, green: 0.1, spice_heat: 0, cooling: 0, tannin: 0, acid: 0.1 },
    texture: { creamy: 0.7, crunch: 0, juicy: 0.3, oily: 0.1 },
    fatAffinity: 0.7,
    acidity: 0.1
  },
  
  // Indian dessert flavors
  gulab_jamun: {
    sensory: { sweet: 0.9, roasted: 0.3, floral: 0.8, green: 0, spice_heat: 0, cooling: 0, tannin: 0, acid: 0.1 },
    texture: { creamy: 0.8, crunch: 0, juicy: 0.6, oily: 0.4 },
    fatAffinity: 0.8,
    acidity: 0.1,
    volatiles: { phenolics: 0.4, terpenes: 0.6 }
  },
  rabri: {
    sensory: { sweet: 0.7, roasted: 0.4, floral: 0.3, green: 0, spice_heat: 0, cooling: 0, tannin: 0, acid: 0.2 },
    texture: { creamy: 0.9, crunch: 0, juicy: 0.2, oily: 0.6 },
    fatAffinity: 0.9,
    acidity: 0.2
  },
  jalebi: {
    sensory: { sweet: 0.8, roasted: 0.2, floral: 0.4, green: 0, spice_heat: 0, cooling: 0, tannin: 0, acid: 0.3 },
    texture: { creamy: 0.3, crunch: 0.6, juicy: 0.4, oily: 0.5 },
    fatAffinity: 0.5,
    acidity: 0.3
  },
  
  // Spices and aromatics
  cardamom: {
    sensory: { sweet: 0.3, roasted: 0.2, floral: 0.9, green: 0.4, spice_heat: 0.3, cooling: 0.6, tannin: 0, acid: 0 },
    texture: { creamy: 0.1, crunch: 0.2, juicy: 0, oily: 0.3 },
    fatAffinity: 0.7,
    volatiles: { terpenes: 0.9 }
  },
  saffron: {
    sensory: { sweet: 0.2, roasted: 0.1, floral: 0.8, green: 0.1, spice_heat: 0, cooling: 0, tannin: 0.2, acid: 0 },
    texture: { creamy: 0.2, crunch: 0, juicy: 0, oily: 0.1 },
    fatAffinity: 0.8,
    volatiles: { terpenes: 0.7, phenolics: 0.3 }
  },
  rose: {
    sensory: { sweet: 0.4, roasted: 0, floral: 1.0, green: 0.2, spice_heat: 0, cooling: 0.1, tannin: 0.1, acid: 0.1 },
    texture: { creamy: 0.1, crunch: 0, juicy: 0.1, oily: 0 },
    fatAffinity: 0.3,
    volatiles: { terpenes: 1.0 }
  },
  
  // Chocolate and cocoa
  cocoa: {
    sensory: { sweet: 0.1, roasted: 0.9, floral: 0.1, green: 0.1, spice_heat: 0, cooling: 0, tannin: 0.7, acid: 0.2 },
    texture: { creamy: 0.6, crunch: 0.2, juicy: 0, oily: 0.7 },
    fatAffinity: 0.9,
    volatiles: { pyrazines: 0.8, phenolics: 0.6 }
  },
  
  // Nuts
  pistachio: {
    sensory: { sweet: 0.2, roasted: 0.6, floral: 0.2, green: 0.7, spice_heat: 0, cooling: 0, tannin: 0.3, acid: 0.1 },
    texture: { creamy: 0.7, crunch: 0.8, juicy: 0, oily: 0.8 },
    fatAffinity: 0.9,
    volatiles: { terpenes: 0.4, pyrazines: 0.3 }
  }
};

export class PairingService {
  private getVectorFromKB(ingId: string): FlavorVector | null {
    // Try exact match first
    if (FLAVOR_DATABASE[ingId]) return FLAVOR_DATABASE[ingId];
    
    // Try partial matches
    const keys = Object.keys(FLAVOR_DATABASE);
    const match = keys.find(key => 
      ingId.toLowerCase().includes(key) || key.includes(ingId.toLowerCase())
    );
    
    return match ? FLAVOR_DATABASE[match] : null;
  }

  getVector(ingredient: IngredientData): FlavorVector {
    // Check knowledge base first
    const kbVector = this.getVectorFromKB(ingredient.id) || this.getVectorFromKB(ingredient.name.toLowerCase());
    if (kbVector) return kbVector;

    // Generate basic vector from ingredient properties
    return this.inferVector(ingredient);
  }

  private inferVector(ingredient: IngredientData): FlavorVector {
    const vector: FlavorVector = {
      sensory: { sweet: 0, roasted: 0, floral: 0, green: 0, spice_heat: 0, cooling: 0, tannin: 0, acid: 0 },
      texture: { creamy: 0, crunch: 0, juicy: 0, oily: 0 },
      fatAffinity: 0,
      acidity: 0
    };

    // Infer from category and composition
    switch (ingredient.category) {
      case 'fruit':
        vector.sensory.sweet = Math.min(1, (ingredient.sugars_pct || 0) / 20);
        vector.sensory.acid = ingredient.acidity_citric_pct ? ingredient.acidity_citric_pct * 10 : 0.3;
        vector.texture.juicy = 0.8;
        vector.texture.creamy = Math.min(0.5, (ingredient.fat_pct || 0) / 10);
        vector.fatAffinity = Math.min(0.7, (ingredient.fat_pct || 0) / 5);
        break;
        
      case 'dairy':
        vector.sensory.sweet = 0.2;
        vector.texture.creamy = 0.9;
        vector.fatAffinity = Math.min(1, (ingredient.fat_pct || 0) / 25);
        break;
        
      case 'sugar':
        vector.sensory.sweet = 1.0;
        vector.texture.creamy = 0.1;
        vector.fatAffinity = 0.3;
        break;
        
      case 'flavor':
        vector.sensory.sweet = Math.min(0.8, (ingredient.sugars_pct || 0) / 30);
        vector.sensory.floral = 0.4;
        vector.texture.creamy = Math.min(0.8, (ingredient.fat_pct || 0) / 15);
        vector.fatAffinity = Math.min(0.9, (ingredient.fat_pct || 0) / 20);
        break;
    }

    return vector;
  }

  scorePair(a: FlavorVector, b: FlavorVector, feasibilityPenalty = 0.0): number {
    const dot = (x: Record<string, number>, y: Record<string, number>) =>
      Object.keys(x).reduce((s, k) => s + (x[k] || 0) * (y[k] || 0), 0);

    // Synergy from overlap
    const sensorySynergy = dot(a.sensory, b.sensory);
    const textureSynergy = dot(a.texture, b.texture);
    
    // Complementary contrast (sweet vs tannin/acid, creamy vs crunch)
    const sweetTanninContrast = Math.abs((a.sensory.sweet || 0) - (b.sensory.tannin || 0));
    const creamyCrunchContrast = Math.abs((a.texture.creamy || 0) - (b.texture.crunch || 0));
    
    const contrast = (sweetTanninContrast + creamyCrunchContrast) / 2;
    
    // Fat affinity compatibility
    const fatCompatibility = 1 - Math.abs((a.fatAffinity || 0) - (b.fatAffinity || 0));
    
    // Combined score
    const synergy = 0.4 * sensorySynergy + 0.3 * textureSynergy + 0.2 * contrast + 0.1 * fatCompatibility;
    const feasibility = 1 - feasibilityPenalty;
    
    return Math.max(0, Math.min(1, synergy * feasibility));
  }

  suggestFor(
    ingredient: IngredientData, 
    candidateIngredients: IngredientData[], 
    feasibilityPenaltyFn: (ingredient: IngredientData) => number
  ): PairingScore[] {
    const baseVector = this.getVector(ingredient);
    
    return candidateIngredients
      .filter(candidate => candidate.id !== ingredient.id)
      .map(candidate => {
        const candidateVector = this.getVector(candidate);
        const feasibilityPenalty = feasibilityPenaltyFn(candidate);
        const score = this.scorePair(baseVector, candidateVector, feasibilityPenalty);
        
        // Generate reason for pairing
        const reason = this.generateReason(baseVector, candidateVector, ingredient.name, candidate.name);
        
        return {
          idA: ingredient.id,
          idB: candidate.id,
          synergy: score,
          contrast: 0, // Will be calculated properly in scorePair
          feasibility: 1 - feasibilityPenalty,
          score,
          reason
        };
      })
      .sort((x, y) => y.score - x.score)
      .slice(0, 20);
  }

  private generateReason(a: FlavorVector, b: FlavorVector, nameA: string, nameB: string): string {
    const reasons: string[] = [];
    
    // Check for high synergy areas
    if (a.sensory.floral > 0.5 && b.sensory.floral > 0.5) {
      reasons.push("Complementary floral notes");
    }
    if (a.texture.creamy > 0.6 && b.texture.creamy > 0.6) {
      reasons.push("Rich, creamy texture synergy");
    }
    if (a.sensory.sweet > 0.7 && b.sensory.tannin > 0.4) {
      reasons.push("Sweet-tannin balance");
    }
    if ((a.fatAffinity || 0) > 0.7 && (b.fatAffinity || 0) > 0.7) {
      reasons.push("Fat-soluble flavor compatibility");
    }
    
    return reasons.length > 0 ? reasons[0] : "Balanced flavor profile";
  }

  categorizeByType(pairings: PairingScore[]): Record<PairingCategory, PairingScore[]> {
    return {
      synergy: pairings.filter(p => p.synergy > 0.7).slice(0, 5),
      novel: pairings.filter(p => p.synergy > 0.4 && p.synergy <= 0.7).slice(0, 5),
      classic: pairings.filter(p => p.feasibility > 0.8).slice(0, 5)
    };
  }
}

export const pairingService = new PairingService();