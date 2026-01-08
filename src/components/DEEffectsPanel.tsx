/**
 * DE Effects Reference Panel
 * Educational reference for Dextrose Equivalent effects on gelato properties
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  TrendingDown, 
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { DE_EFFECTS } from '@/lib/calc';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const DEEffectsPanel: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card className="border-amber-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-amber-600" />
            <CardTitle>DE Effects Reference</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
        <CardDescription>
          How Dextrose Equivalent (DE) affects your gelato properties
        </CardDescription>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="space-y-4">
          {/* What is DE */}
          <div className="p-3 bg-warning/10 dark:bg-warning/20 rounded-lg border border-warning/30">
            <p className="text-sm font-semibold mb-2">What is DE?</p>
            <p className="text-xs text-muted-foreground">
              Dextrose Equivalent (DE) measures the degree of starch hydrolysis. Higher DE = more simple sugars = more sweetness and anti-freeze power. Lower DE = more complex chains = more body and viscosity.
            </p>
          </div>

          {/* Effects When DE Increases */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <h4 className="font-semibold text-sm">When DE Increases ↑</h4>
            </div>
            <div className="space-y-2">
              {DE_EFFECTS.increase.map((effect, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-success/10 dark:bg-success/20 rounded-lg border border-success/30"
                >
                  <div className="flex items-start justify-between mb-1">
                    <span className="font-semibold text-sm">{effect.property}</span>
                    <Badge variant="outline" className="bg-success/20 text-success-foreground border-success/30">
                      {effect.effect}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{effect.explanation}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Effects When DE Increases (Decreasing Properties) */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="h-4 w-4 text-red-600" />
              <h4 className="font-semibold text-sm">When DE Increases (These Decrease) ↓</h4>
            </div>
            <div className="space-y-2">
              {DE_EFFECTS.decrease.map((effect, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-destructive/10 dark:bg-destructive/20 rounded-lg border border-destructive/30"
                >
                  <div className="flex items-start justify-between mb-1">
                    <span className="font-semibold text-sm">{effect.property}</span>
                    <Badge variant="outline" className="bg-destructive/20 text-destructive border-destructive/30">
                      {effect.effect}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{effect.explanation}</p>
                </div>
              ))}
            </div>
          </div>

          {/* DE Reference Guide */}
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="reference">
              <AccordionTrigger className="text-sm font-semibold">
                DE Value Reference Guide
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {Object.entries(DE_EFFECTS.reference).map(([range, description]) => (
                    <div
                      key={range}
                      className="p-3 bg-muted rounded border border-border"
                    >
                      <p className="font-semibold text-sm mb-1">{range}</p>
                      <p className="text-xs text-muted-foreground">{description}</p>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Practical Tips */}
          <div className="p-4 bg-primary/10 dark:bg-primary/20 rounded-lg border border-primary/30">
            <p className="font-semibold text-sm mb-2 flex items-center gap-2">
              <Info className="h-4 w-4" />
              Practical Tips:
            </p>
            <ul className="text-xs text-muted-foreground space-y-1 ml-5 list-disc">
              <li>Use low DE (15-40) for body and texture without much sweetness</li>
              <li>Use medium DE (40-60) for balanced properties - most versatile</li>
              <li>Use high DE (60-100) or pure dextrose for softness and anti-freeze</li>
              <li>Combine different DE values for optimal balance</li>
              <li>Higher DE = softer at serving temp but may become sticky</li>
            </ul>
          </div>

          {/* Common Combinations */}
          <div className="p-4 bg-secondary/50 dark:bg-secondary/30 rounded-lg border border-secondary">
            <p className="font-semibold text-sm mb-2">Common Sugar Combinations:</p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-medium">Balanced Base:</span>
                <span className="text-muted-foreground">70% Sucrose + 15% DE38 + 15% Dextrose</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">Soft Serve:</span>
                <span className="text-muted-foreground">60% Sucrose + 20% Dextrose + 20% Invert</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">Firm Premium:</span>
                <span className="text-muted-foreground">80% Sucrose + 15% DE38 + 5% Dextrose</span>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default DEEffectsPanel;
