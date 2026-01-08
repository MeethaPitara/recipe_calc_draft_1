import React, { useState, useEffect } from 'react';
import { Brain, AlertTriangle, Lightbulb, TrendingUp, Loader2, Sparkles } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { isBackendReady } from '@/integrations/supabase/safeClient';
import { showApiErrorToast } from '@/lib/ui/errors';
import { useDebounce } from '@/hooks/useDebounce';

interface AIInsightsPanelProps {
  recipe: { ingredientId: string; grams: number }[];
  metrics?: any;
  productType?: string;
}

export const AIInsightsPanel: React.FC<AIInsightsPanelProps> = ({ 
  recipe, 
  metrics,
  productType = 'ice_cream'
}) => {
  const [analysis, setAnalysis] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creditsExhausted, setCreditsExhausted] = useState(false);
  const [lastErrorTime, setLastErrorTime] = useState<number>(0);
  const [lastErrorType, setLastErrorType] = useState<string>('');

  // Debounce recipe and metrics to prevent rapid API calls
  const debouncedRecipe = useDebounce(recipe, 2000);
  const debouncedMetrics = useDebounce(metrics, 2000);

  // Auto-analyze when debounced values change significantly
  useEffect(() => {
    if (!debouncedRecipe || debouncedRecipe.length === 0 || !debouncedMetrics || creditsExhausted) {
      return;
    }
    
    // Auto-trigger analysis when recipe stabilizes
    analyzeRecipe();
  }, [debouncedRecipe, debouncedMetrics, creditsExhausted]);

  const analyzeRecipe = async () => {
    // Don't analyze if credits are exhausted
    if (creditsExhausted) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Check if backend is ready
      if (!isBackendReady()) {
        setError('AI backend not connected. Using recipe validation instead.');
        setIsLoading(false);
        return;
      }

      // Use debounced values to prevent analyzing stale data
      const { data, error: fnError } = await supabase.functions.invoke('analyze-recipe', {
        body: { recipe: debouncedRecipe, metrics: debouncedMetrics, productType }
      });

      if (fnError) {
        throw fnError;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setAnalysis(data);
      setError(null);
      console.log('AI Analysis complete:', data);
    } catch (err: any) {
      console.error('Failed to analyze recipe:', err);
      const errorMsg = err.message || 'Failed to analyze recipe';
      const errorType = err.status?.toString() || 'unknown';
      setError(errorMsg);
      
      // Detect 402 credit exhaustion errors
      if (err.status === 402 || errorMsg.includes('AI credits depleted')) {
        setCreditsExhausted(true);
      }

      // Prevent duplicate error toasts (max 1 per 5 seconds for same error type)
      const now = Date.now();
      const shouldShowToast = 
        errorType !== lastErrorType || 
        (now - lastErrorTime) > 5000;

      if (shouldShowToast) {
        showApiErrorToast(err, 'AI Analysis failed');
        setLastErrorTime(now);
        setLastErrorType(errorType);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Don't show if no recipe data
  if (!recipe || recipe.length === 0) {
    return null;
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-warning';
    return 'text-destructive';
  };

  const getScoreBadgeVariant = (score: number): "default" | "secondary" | "destructive" => {
    if (score >= 80) return 'default';
    if (score >= 60) return 'secondary';
    return 'destructive';
  };

  return (
    <Card className="border-primary/20">
      <Accordion type="single" collapsible defaultValue="">
        <AccordionItem value="ai-insights" className="border-none">
          <CardHeader className="pb-0">
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center justify-between w-full pr-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  AI Recipe Analysis
                </CardTitle>
              </div>
            </AccordionTrigger>
          </CardHeader>
          <AccordionContent>
            <CardContent className="pt-2 space-y-4">
              <p className="text-sm text-muted-foreground">
                Analysis runs automatically when your recipe stabilizes. You can also manually re-analyze anytime.
              </p>
              
              {/* Loading State */}
              {isLoading && (
                <div className="flex flex-col items-center justify-center py-6 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <p className="text-sm text-muted-foreground">Analyzing recipe with AI...</p>
                  </div>
                </div>
              )}
              
              {/* Manual Analyze Button */}
              {!isLoading && (
                <div className="flex justify-center">
                  <Button
                    onClick={analyzeRecipe}
                    disabled={!recipe || recipe.length === 0 || creditsExhausted}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    Re-analyze Now
                  </Button>
                  {creditsExhausted && (
                    <p className="text-xs text-destructive">
                      AI credits depleted. Please add credits to continue.
                    </p>
                  )}
                </div>
              )}

              {error && !creditsExhausted && (
                <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              {creditsExhausted && analysis && (
                <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
                  <p className="text-sm text-warning">
                    AI credits depleted. Analysis shown is from previous request.
                  </p>
                </div>
              )}

              {!isLoading && !error && analysis && (
                <>
                  {/* Success Score */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Recipe Success Score</span>
                      </div>
                      <Badge variant={getScoreBadgeVariant(analysis.successScore)}>
                        {analysis.successScore}%
                      </Badge>
                    </div>
                    <Progress value={analysis.successScore} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      AI-powered analysis based on composition and balance
                    </p>
                  </div>

                  {/* Texture Prediction */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm font-medium">Predicted Texture</span>
                    <Badge variant="secondary">{analysis.texturePredict}</Badge>
                  </div>

                  {/* AI Warnings */}
                  {analysis.warnings && analysis.warnings.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <AlertTriangle className="h-4 w-4 text-warning" />
                        AI Warnings
                      </div>
                      {analysis.warnings.map((warning: string, index: number) => (
                        <div 
                          key={index}
                          className="p-3 rounded-lg bg-warning/10 border-l-4 border-warning"
                        >
                          <p className="text-sm">{warning}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* AI Suggestions */}
                  {analysis.suggestions && analysis.suggestions.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Lightbulb className="h-4 w-4 text-primary" />
                        AI Suggestions
                      </div>
                      {analysis.suggestions.map((suggestion: string, index: number) => (
                        <div 
                          key={index}
                          className="p-3 rounded-lg bg-primary/5 border-l-4 border-primary"
                        >
                          <p className="text-sm">{suggestion}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Analysis Timestamp & Re-analyze Button */}
                  <div className="pt-2 border-t space-y-2">
                    <p className="text-xs text-muted-foreground text-center">
                      🤖 AI-powered analysis • Updated {new Date(analysis.analysisTimestamp).toLocaleTimeString()}
                    </p>
                    {!creditsExhausted && (
                      <div className="flex justify-center">
                        <Button
                          onClick={analyzeRecipe}
                          disabled={isLoading}
                          variant="outline"
                          size="sm"
                          className="gap-2"
                        >
                          <Sparkles className="h-3 w-3" />
                          Re-analyze
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
};
