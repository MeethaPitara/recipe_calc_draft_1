import { useState } from 'react';
import { Sparkles, Zap, CheckCircle, AlertCircle, TrendingUp, Wand2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { balancingEngine } from '@/lib/optimize.engine';
import { Row, OptimizeTarget } from '@/lib/optimize';
import { useToast } from '@/hooks/use-toast';

interface AIOptimizationProps {
  allTargetsMet: boolean;
  suggestions: string[];
  isOptimizing: boolean;
  onAutoOptimize: (algorithm: any) => void;
  onApplyResult?: (result: Row[]) => void;
  currentRows?: Row[];
  targets?: OptimizeTarget;
}

/**
 * PHASE 10.1: this used to offer a choice of 4 "algorithms" (hill-climbing,
 * genetic, particle-swarm, hybrid) compared against each other via
 * compareOptimizers() -> /api/optimize/advanced and /api/optimize/compare.
 * Neither endpoint has ever existed on the backend -- this feature was
 * calling a 404 in production. There is exactly one deterministic
 * optimizer (the LP solver behind /api/optimize/balance); this now calls
 * that directly instead of faking a comparison between algorithms that
 * were never actually implemented.
 */
export default function AIOptimization({
  allTargetsMet,
  suggestions,
  isOptimizing,
  onAutoOptimize,
  onApplyResult,
  currentRows,
  targets
}: AIOptimizationProps) {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<{ rows: Row[]; metrics: any } | null>(null);

  const currentSuggestions = suggestions.length > 0 ? suggestions : [
    allTargetsMet
      ? 'Recipe is already balanced! Consider experimenting with flavor variations.'
      : 'Recipe needs optimization. The deterministic solver can automatically adjust ingredients to meet targets.',
    'Lock any ingredients you want to keep unchanged before optimizing.'
  ];

  const runOptimization = async () => {
    if (!currentRows || !targets) return;

    setIsRunning(true);
    try {
      const balanceResult = await balancingEngine.balance(currentRows, targets);
      setResult({ rows: balanceResult.rows, metrics: balanceResult.metrics });

      toast({
        title: "Optimization Complete",
        description: balanceResult.success !== false
          ? "Recipe adjusted to meet targets."
          : "Could not fully reach targets — review the result before applying.",
      });
    } catch (error) {
      console.error('Optimization error:', error);
      toast({
        title: "Optimization Failed",
        description: error instanceof Error ? error.message : "Failed to optimize recipe",
        variant: "destructive"
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
           Recipe Optimization
          </CardTitle>
          <p className="text-sm text-muted-foreground">
           Deterministic solver to automatically balance your recipe against targets
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status */}
          <Alert variant={allTargetsMet ? 'default' : 'destructive'}>
            {allTargetsMet ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>
              <strong>{allTargetsMet ? 'Recipe Balanced ' : 'Optimization Needed'}</strong>
              <br />
              {allTargetsMet
                ? 'All parameters are within target ranges'
                : 'Some parameters are outside target ranges'}
            </AlertDescription>
          </Alert>

          {/* AI Suggestions */}
          <div>
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
             Insights
            </h3>
            <div className="space-y-2">
              {currentSuggestions.map((suggestion, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm p-3 bg-primary/5 rounded-lg">
                  <Zap className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>{suggestion}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button
              onClick={runOptimization}
              disabled={isOptimizing || isRunning || !currentRows || !targets}
              className="w-full bg-gradient-to-r from-primary to-primary/80 hover:opacity-90"
              size="lg"
            >
              {isRunning ? (
                <>
                  <span className="animate-spin mr-2"></span>
                 Optimizing...
                </>
              ) : (
                <>
                  <Wand2 className="h-5 w-5 mr-2" />
                 Optimize Recipe
                </>
              )}
            </Button>
          </div>

          {/* Info Footer */}
          <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t border-border/50">
            <p><strong>How it works:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Analyzes current recipe and target parameters</li>
              <li>Uses a constraint-aware LP solver to find optimal ingredient quantities</li>
              <li>Respects min/max constraints and locked ingredients</li>
              <li>Never auto-applies — you review the result, then apply it</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Result */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
             Optimization Result
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Fat</span>
                <p className="font-semibold">{result.metrics.fat_pct?.toFixed(1)}%</p>
              </div>
              <div>
                <span className="text-muted-foreground">MSNF</span>
                <p className="font-semibold">{result.metrics.msnf_pct?.toFixed(1)}%</p>
              </div>
              <div>
                <span className="text-muted-foreground">Sugars</span>
                <p className="font-semibold">{result.metrics.totalSugars_pct?.toFixed(1)}%</p>
              </div>
              <div>
                <span className="text-muted-foreground">FPDT</span>
                <p className="font-semibold">{result.metrics.fpdt?.toFixed(2)}°C</p>
              </div>
            </div>

            {onApplyResult && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  onApplyResult(result.rows);
                  toast({ title: "Result Applied", description: "Optimized quantities applied to your recipe." });
                }}
              >
               Apply this result
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
