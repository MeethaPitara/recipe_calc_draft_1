import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Beaker, DollarSign, Sparkles, Candy } from 'lucide-react';

interface QuickAccessPanelProps {
  onNavigate: (tab: string) => void;
  hasRecipe: boolean;
}

export function QuickAccessPanel({ onNavigate, hasRecipe }: QuickAccessPanelProps) {
  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Quick Access Tools
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
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
      </CardContent>
    </Card>
  );
}