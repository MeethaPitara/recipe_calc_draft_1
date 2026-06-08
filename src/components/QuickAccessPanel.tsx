import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Beaker, DollarSign, Sparkles, Candy, Wand2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface QuickAccessPanelProps {
  onNavigate: (tab: string) => void;
  hasRecipe: boolean;
  currentRecipe?: any[];
  onOptimize?: () => void;
}

export function QuickAccessPanel({ onNavigate, hasRecipe, currentRecipe, onOptimize }: QuickAccessPanelProps) {
  const navigate = useNavigate();
  const isAdvancedMode = import.meta.env.VITE_ENABLE_ADVANCED === 'true';

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
         Quick Access Tools
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        {isAdvancedMode && (
          <Button
            variant="outline"
            className="h-auto py-3 flex flex-col items-center gap-2"
            onClick={() => onNavigate('chemistry')}
            disabled={!hasRecipe}
          >
            <Beaker className="h-5 w-5" />
            <div className="text-center">
              <div className="font-medium text-xs">Chemistry</div>
              <div className="text-xs text-muted-foreground">Ingredient Analysis</div>
            </div>
            {hasRecipe ? (
              <Badge variant="default" className="text-xs bg-green-500">Ready</Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">Need Recipe</Badge>
            )}
          </Button>
        )}

        {isAdvancedMode && (
          <Button
            variant="outline"
            className="h-auto py-3 flex flex-col items-center gap-2"
            onClick={() => onNavigate('costing')}
            disabled={!hasRecipe}
          >
            <DollarSign className="h-5 w-5" />
            <div className="text-center">
              <div className="font-medium text-xs">Costs</div>
              <div className="text-xs text-muted-foreground">Real-time Pricing</div>
            </div>
            {hasRecipe ? (
              <Badge variant="default" className="text-xs bg-green-500">Ready</Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">Need Recipe</Badge>
            )}
          </Button>
        )}

        <Button
          variant="outline"
          className="h-auto py-3 flex flex-col items-center gap-2"
          onClick={() => onNavigate('ai-flavour-engine')}
          disabled={!hasRecipe}
        >
          <Sparkles className="h-5 w-5" />
          <div className="text-center">
            <div className="font-medium text-xs">AI Optimize</div>
            <div className="text-xs text-muted-foreground">Auto-balance</div>
          </div>
          {hasRecipe ? (
            <Badge variant="default" className="text-xs bg-green-500">Ready</Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">Need Recipe</Badge>
          )}
        </Button>

        {isAdvancedMode && (
          <Button
            variant="outline"
            className="h-auto py-3 flex flex-col items-center gap-2"
            onClick={() => onNavigate('sugar-blend')}
          >
            <Candy className="h-5 w-5" />
            <div className="text-center">
              <div className="font-medium text-xs">Sugar Blend</div>
              <div className="text-xs text-muted-foreground">Optimize Spectrum</div>
            </div>
          </Button>
        )}

        <Button
          variant="outline"
          className="h-auto py-3 flex flex-col items-center gap-2 border-amber-500/30 hover:bg-amber-500/5"
          onClick={() => onOptimize?.()}
          disabled={!hasRecipe}
        >
          <Wand2 className="h-5 w-5 text-amber-500" />
          <div className="text-center">
            <div className="font-medium text-xs"> Optimizer</div>
            <div className="text-xs text-muted-foreground">LP Solver</div>
          </div>
          {hasRecipe ? (
            <Badge variant="default" className="text-xs bg-amber-500">Ready</Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">Need Recipe</Badge>
          )}
        </Button>

        <Button
          variant="outline"
          className="h-auto py-3 flex flex-col items-center gap-2"
          onClick={() => navigate('/production/quick-plan', { state: { recipe: currentRecipe } })}
        >
          <div className="h-5 w-5 flex items-center justify-center"></div>
          <div className="text-center">
            <div className="font-medium text-xs">Production</div>
            <div className="text-xs text-muted-foreground">Quick Plan</div>
          </div>
        </Button>

        <Button
          variant="outline"
          className="h-auto py-3 flex flex-col items-center gap-2"
          onClick={() => navigate('/production/base-planner')}
        >
          <div className="h-5 w-5 flex items-center justify-center"></div>
          <div className="text-center">
            <div className="font-medium text-xs">Level 2</div>
            <div className="text-xs text-muted-foreground">Base Planner</div>
          </div>
        </Button>

        <Button
          variant="outline"
          className="h-auto py-3 flex flex-col items-center gap-2"
          onClick={() => navigate('/production/exact-plan')}
        >
          <div className="h-5 w-5 flex items-center justify-center"></div>
          <div className="text-center">
            <div className="font-medium text-xs">Level 3</div>
            <div className="text-xs text-muted-foreground">Exact Batch</div>
          </div>
        </Button>
      </CardContent>
    </Card>
  );
}