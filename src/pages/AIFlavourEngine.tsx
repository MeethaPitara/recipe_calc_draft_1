import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Beaker, Candy, Info, Sparkles } from 'lucide-react';
import { ChemistryDashboard } from '@/components/ChemistryDashboard';
import SugarBlendOptimizer from '@/components/flavour-engine/SugarBlendOptimizer';
import { RecipeIngredient } from '@/types/recipe';
import { MetricsV2 } from '@/lib/calc.v2';

interface AIFlavourEngineProps {
  initialRecipe?: RecipeIngredient[];
  initialMetrics?: MetricsV2 | null;
  initialProductType?: string;
}

export default function AIFlavourEngine({ 
  initialRecipe = [], 
  initialMetrics = null,
  initialProductType = 'ice_cream'
}: AIFlavourEngineProps) {
  const [activeTab, setActiveTab] = useState('chemistry');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (initialRecipe.length > 0) {
      setLastUpdated(new Date());
    }
  }, [initialRecipe, initialMetrics, initialProductType]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-primary" />
                AI Flavour Engine
              </CardTitle>
              <CardDescription className="flex items-center gap-2 flex-wrap">
                Advanced analysis and optimization tools for perfect recipes
                {lastUpdated && (
                  <Badge variant="secondary" className="text-xs">
                    Updated {lastUpdated.toLocaleTimeString()}
                  </Badge>
                )}
              </CardDescription>
            </div>
            {initialRecipe.length > 0 ? (
              <Badge variant="default" className="bg-green-500">
                {initialRecipe.length} ingredients loaded
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-sm">
                ✨ Enhanced Features
              </Badge>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Feature Tour Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Welcome to the AI Flavour Engine!</strong> Here you'll find all advanced analysis tools:
          Chemistry deep-dive, Real-time costing, AI optimization, and Sugar spectrum analysis.
        </AlertDescription>
      </Alert>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="chemistry" className="flex items-center gap-2">
            <Beaker className="h-4 w-4" />
            <span className="hidden sm:inline">Chemistry</span>
          </TabsTrigger>
          <TabsTrigger value="sugar" className="flex items-center gap-2">
            <Candy className="h-4 w-4" />
            <span className="hidden sm:inline">Sugar Blend</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chemistry" className="mt-6">
          <ChemistryDashboard 
            recipe={initialRecipe}
            metrics={initialMetrics}
          />
        </TabsContent>

        <TabsContent value="sugar" className="mt-6">
          <SugarBlendOptimizer 
            productType={initialProductType as any}
            totalSugarAmount={initialMetrics?.totalSugars_g || 200}
            onOptimizedBlend={(blend) => console.log('Optimized blend:', blend)}
          />
        </TabsContent>
      </Tabs>

      {/* Feature Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Feature Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-green-50">
                ✅ Available
              </Badge>
              <span className="text-muted-foreground">Chemistry Analysis (Offline)</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-green-50">
                ✅ Available
              </Badge>
              <span className="text-muted-foreground">Cost Calculator (Offline)</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-green-50">
                ✅ Available
              </Badge>
              <span className="text-muted-foreground">Sugar Optimizer (Offline)</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-blue-50">
                🔌 Backend
              </Badge>
              <span className="text-muted-foreground">AI Optimization (Enhanced)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Debug Panel (Development Only) */}
      {process.env.NODE_ENV === 'development' && initialRecipe.length > 0 && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-xs text-muted-foreground">
              🐛 Debug Info (Dev Only)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-2">
            <div>Recipe Items: {initialRecipe.length}</div>
            <div>Has Metrics: {initialMetrics ? 'Yes' : 'No'}</div>
            <div>Product Type: {initialProductType}</div>
            <div>Sample Data Structure:</div>
            <pre className="bg-muted p-2 rounded text-[10px] overflow-auto max-h-40">
              {JSON.stringify(initialRecipe[0], null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}