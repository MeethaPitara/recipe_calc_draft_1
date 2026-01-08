import { useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { pairingService } from '@/services/pairingService';
import { PairingScore, PairingCategory } from '@/types/pairing';
import { IngredientData } from '@/types/ingredients';
import { Sparkles, Zap, Star } from 'lucide-react';

interface PairingsDrawerProps {
  selectedIngredient: IngredientData | null;
  availableIngredients: IngredientData[];
  onAddIngredient: (ingredient: IngredientData, percentage: number) => void;
  currentMetrics?: any;
}

export default function PairingsDrawer({
  selectedIngredient,
  availableIngredients,
  onAddIngredient,
  currentMetrics
}: PairingsDrawerProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pairings, setPairings] = useState<Record<PairingCategory, PairingScore[]>>({
    synergy: [],
    novel: [],
    classic: []
  });

  const isMobile = useIsMobile();

  const analyzePairings = async () => {
    if (!selectedIngredient) return;
    
    setIsAnalyzing(true);
    try {
      // Simple feasibility penalty based on current recipe balance
      const feasibilityPenalty = (ingredient: IngredientData) => {
        if (!currentMetrics) return 0;
        
        // Penalize if adding would push metrics out of reasonable bounds
        let penalty = 0;
        
        if (ingredient.category === 'sugar' && currentMetrics.sugars_pct > 25) penalty += 0.3;
        if (ingredient.category === 'dairy' && currentMetrics.fat_pct > 18) penalty += 0.2;
        if (ingredient.category === 'flavor' && currentMetrics.ts_add_pct > 40) penalty += 0.2;
        
        return Math.min(0.5, penalty); // Cap penalty at 0.5
      };

      const suggestions = pairingService.suggestFor(
        selectedIngredient,
        availableIngredients,
        feasibilityPenalty
      );
      
      const categorized = pairingService.categorizeByType(suggestions);
      setPairings(categorized);
    } catch (error) {
      console.error('Error analyzing pairings:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddSuggestion = (pairingScore: PairingScore, percentage: number) => {
    const ingredient = availableIngredients.find(ing => ing.id === pairingScore.idB);
    if (ingredient) {
      onAddIngredient(ingredient, percentage);
    }
  };

  const previewAddition = (ingredient: IngredientData, percentage: number) => {
    if (!currentMetrics) return null;
    
    const totalMass = currentMetrics.total_g || 1000;
    const addedGrams = (percentage / 100) * totalMass;
    
    // Simplified preview calculation
    const newTotalGrams = totalMass + addedGrams;
    const sugarDelta = ((ingredient.sugars_pct || 0) / 100) * addedGrams / newTotalGrams * 100;
    const fatDelta = (ingredient.fat_pct / 100) * addedGrams / newTotalGrams * 100;
    
    const newSugars = (currentMetrics.sugars_pct || 0) + sugarDelta;
    const newFat = (currentMetrics.fat_pct || 0) + fatDelta;
    const newTS = (currentMetrics.ts_add_pct || 0) + sugarDelta + fatDelta;
    
    return { newSugars, newFat, newTS, addedGrams };
  };

  const getScoreColor = (score: number) => {
    if (score > 0.7) return 'bg-success/20 text-success-foreground';
    if (score > 0.5) return 'bg-warning/20 text-warning-foreground';
    return 'bg-muted text-muted-foreground';
  };

  const getCategoryIcon = (category: PairingCategory) => {
    switch (category) {
      case 'synergy': return <Sparkles className="h-4 w-4" />;
      case 'novel': return <Zap className="h-4 w-4" />;
      case 'classic': return <Star className="h-4 w-4" />;
    }
  };

  const getCategoryDescription = (category: PairingCategory) => {
    switch (category) {
      case 'synergy': return 'High compatibility matches';
      case 'novel': return 'Creative new combinations';
      case 'classic': return 'Safe, proven pairings';
    }
  };

  if (!selectedIngredient) {
    return (
      <Card className={isMobile ? 'p-3' : 'p-4'}>
        <div className="text-center text-muted-foreground">
          <Sparkles className={`${isMobile ? 'h-6 w-6' : 'h-8 w-8'} mx-auto mb-2 opacity-50`} />
          <p className={isMobile ? 'text-sm' : ''}>Select an ingredient to discover pairings</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={isMobile ? 'p-3' : 'p-4'}>
      <div className={isMobile ? 'space-y-3' : 'space-y-4'}>
        <div className="flex items-center justify-between">
          <h3 className={`font-semibold ${isMobile ? 'text-sm' : ''}`}>
            {isMobile ? `Pairings: ${selectedIngredient.name}` : `Flavor Pairings for ${selectedIngredient.name}`}
          </h3>
          <Button 
            onClick={analyzePairings} 
            disabled={isAnalyzing}
            size="sm"
            variant="outline"
            className={isMobile ? 'text-xs' : ''}
          >
            {isAnalyzing ? 'Analyzing...' : 'Find Pairings'}
          </Button>
        </div>

        {(pairings.synergy.length > 0 || pairings.novel.length > 0 || pairings.classic.length > 0) && (
          <Tabs defaultValue="synergy" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="synergy" className="text-xs">
                <Sparkles className="h-3 w-3 mr-1" />
                Synergy
              </TabsTrigger>
              <TabsTrigger value="novel" className="text-xs">
                <Zap className="h-3 w-3 mr-1" />
                Novel
              </TabsTrigger>
              <TabsTrigger value="classic" className="text-xs">
                <Star className="h-3 w-3 mr-1" />
                Classic
              </TabsTrigger>
            </TabsList>

            {(['synergy', 'novel', 'classic'] as PairingCategory[]).map(category => (
              <TabsContent key={category} value={category} className="space-y-3">
                <p className="text-sm text-muted-foreground">{getCategoryDescription(category)}</p>
                
                {pairings[category].length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    No {category} pairings found. Try analyzing first.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pairings[category].map((pairing, idx) => {
                      const ingredient = availableIngredients.find(ing => ing.id === pairing.idB);
                      if (!ingredient) return null;

                      const preview5 = previewAddition(ingredient, 5);
                      
                      return (
                        <div key={idx} className="border rounded-lg p-3 space-y-2 hover:border-primary/50 transition-colors">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="font-medium text-sm">{ingredient.name}</div>
                              <div className="text-xs text-muted-foreground">{pairing.reason}</div>
                            </div>
                            <Badge className={getScoreColor(pairing.score)}>
                              {(pairing.score * 100).toFixed(0)}%
                            </Badge>
                          </div>
                          
                          {preview5 && (
                            <div className="bg-card-secondary/50 rounded p-2 text-xs">
                              <div className="font-medium mb-1">Preview @ 5% (+{preview5.addedGrams.toFixed(0)}g):</div>
                              <div className="grid grid-cols-3 gap-1 text-[10px]">
                                <div>
                                  <span className="text-muted-foreground">Sugars:</span>
                                  <span className={`ml-1 font-semibold ${preview5.newSugars > 25 ? 'text-warning' : 'text-success'}`}>
                                    {preview5.newSugars.toFixed(1)}%
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Fat:</span>
                                  <span className={`ml-1 font-semibold ${preview5.newFat > 18 ? 'text-warning' : 'text-success'}`}>
                                    {preview5.newFat.toFixed(1)}%
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">TS:</span>
                                  <span className={`ml-1 font-semibold ${preview5.newTS > 42 ? 'text-warning' : 'text-success'}`}>
                                    {preview5.newTS.toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAddSuggestion(pairing, 3)}
                              className="text-xs flex-1"
                            >
                              Add 3%
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAddSuggestion(pairing, 5)}
                              className="text-xs flex-1"
                            >
                              Add 5%
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAddSuggestion(pairing, 8)}
                              className="text-xs flex-1"
                            >
                              8% Paste
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </Card>
  );
}