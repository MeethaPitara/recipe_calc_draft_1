/**
 * Product Classifier Component
 * Auto-detects product type based on recipe metrics
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Target, TrendingUp, TrendingDown, CheckCircle } from 'lucide-react';
import { Metrics, classifyProduct } from '@/lib/calc';

interface ProductClassifierProps {
  metrics: Metrics;
}

export const ProductClassifier: React.FC<ProductClassifierProps> = ({ metrics }) => {
  const classification = classifyProduct(metrics);

  const confidenceColor = 
    classification.confidence === 'high' ? 'bg-green-500' :
    classification.confidence === 'medium' ? 'bg-yellow-500' :
    'bg-red-500';

  const confidencePercentage = 
    classification.confidence === 'high' ? 90 :
    classification.confidence === 'medium' ? 60 :
    30;

  const productTypeLabels: Record<string, string> = {
    ice_cream: 'Ice Cream',
    gelato_white: 'Gelato (White Base)',
    gelato_finished: 'Gelato (Finished)',
    fruit_gelato: 'Fruit Gelato',
    sorbet: 'Sorbet',
    kulfi: 'Kulfi',
    unknown: 'Unknown'
  };

  return (
    <Card className="border-indigo-200">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-indigo-600" />
          <CardTitle>Product Classification</CardTitle>
        </div>
        <CardDescription>
          Auto-detected based on composition analysis
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Classification Result */}
        <div className="text-center p-4 bg-secondary/50 dark:bg-secondary/30 rounded-lg border-2 border-secondary">
          <p className="text-sm text-muted-foreground mb-2">Detected Product Type:</p>
          <h3 className="text-3xl font-bold text-foreground">
            {productTypeLabels[classification.productType]}
          </h3>
          
          <div className="mt-3 flex items-center justify-center gap-2">
            <span className="text-sm font-medium">Confidence:</span>
            <Badge className={confidenceColor}>
              {classification.confidence.toUpperCase()}
            </Badge>
          </div>
          
          <Progress value={confidencePercentage} className="mt-2" />
        </div>

        {/* Analysis Breakdown */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Analysis:</Label>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {classification.reasons.map((reason, idx) => {
              const isMatch = reason.includes('within');
              const isLow = reason.includes('low');
              const isHigh = reason.includes('high');
              
              return (
                <div
                  key={idx}
                  className={`flex items-start gap-2 p-2 rounded text-sm ${
                    isMatch ? 'bg-success/10 dark:bg-success/20 text-success-foreground' :
                    isLow || isHigh ? 'bg-warning/10 dark:bg-warning/20 text-warning-foreground' :
                    'bg-muted text-muted-foreground'
                  }`}
                >
                  {isMatch ? (
                    <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-600" />
                  ) : isLow ? (
                    <TrendingDown className="h-4 w-4 mt-0.5 flex-shrink-0 text-yellow-600" />
                  ) : isHigh ? (
                    <TrendingUp className="h-4 w-4 mt-0.5 flex-shrink-0 text-yellow-600" />
                  ) : (
                    <div className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  )}
                  <span>{reason}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Deltas Summary */}
        <div className="p-3 bg-muted rounded border border-border">
          <Label className="text-xs font-semibold mb-2 block">Parameter Deltas:</Label>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {Object.entries(classification.deltas).map(([key, delta]) => (
              <div key={key} className="text-center">
                <p className="text-muted-foreground uppercase">{key}</p>
                <p className={`font-semibold ${
                  Math.abs(delta) < 0.5 ? 'text-green-600' :
                  Math.abs(delta) < 2 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Help Text */}
        <div className="text-xs text-muted-foreground p-3 bg-primary/10 dark:bg-primary/20 rounded border border-primary/30">
          <p><strong>💡 How it works:</strong> The classifier compares your recipe metrics against standard target bands for each product type. Lower delta values = better match.</p>
        </div>
      </CardContent>
    </Card>
  );
};

const Label: React.FC<React.HTMLAttributes<HTMLLabelElement>> = ({ className, ...props }) => (
  <label className={`text-sm font-medium ${className || ''}`} {...props} />
);

export default ProductClassifier;
