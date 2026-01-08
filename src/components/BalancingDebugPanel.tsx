import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Bug, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface BalancingDebugPanelProps {
  diagnostics: any;
  lpStatus?: 'success' | 'failed' | 'not_attempted';
  lastStrategy?: 'LP' | 'Heuristic' | 'Auto-Fix';
}

/**
 * Balancing Debug Panel - Shows balancing diagnostics
 * PHASE 2: UX Trust - Expose internal state for troubleshooting
 */
export function BalancingDebugPanel({ 
  diagnostics, 
  lpStatus,
  lastStrategy 
}: BalancingDebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!diagnostics) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-4">
      <Card className="border-muted">
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 hover:bg-transparent">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Bug className="h-4 w-4 text-muted-foreground" />
                🐛 Balancing Debug Panel
                {lastStrategy && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    Strategy: {lastStrategy}
                  </Badge>
                )}
              </CardTitle>
              <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="font-semibold text-muted-foreground mb-1">Product Type</div>
                <Badge variant="secondary">{diagnostics.productType || 'N/A'}</Badge>
              </div>
              
              <div>
                <div className="font-semibold text-muted-foreground mb-1">Mode</div>
                <Badge variant="secondary">{diagnostics.mode || 'N/A'}</Badge>
              </div>
            </div>

            <div>
              <div className="font-semibold text-muted-foreground mb-1">Feasibility Flags</div>
              <div className="grid grid-cols-2 gap-1">
                <div className="flex items-center gap-1">
                  <span className={diagnostics.hasWater ? 'text-success' : 'text-destructive'}>
                    {diagnostics.hasWater ? '✓' : '✗'}
                  </span>
                  <span>Water</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className={diagnostics.hasFatSource ? 'text-success' : 'text-destructive'}>
                    {diagnostics.hasFatSource ? '✓' : '✗'}
                  </span>
                  <span>Fat Source</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className={diagnostics.hasMSNFSource ? 'text-success' : 'text-destructive'}>
                    {diagnostics.hasMSNFSource ? '✓' : '✗'}
                  </span>
                  <span>MSNF Source</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-success">✓</span>
                  <span>Sugars</span>
                </div>
              </div>
            </div>

            {diagnostics.missingIngredients && diagnostics.missingIngredients.length > 0 && (
              <div>
                <div className="font-semibold text-destructive mb-1">Missing Canonicals</div>
                <ul className="space-y-0.5 ml-4 list-disc text-destructive">
                  {diagnostics.missingIngredients.map((item: string, i: number) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <div className="font-semibold text-muted-foreground mb-1">Targets</div>
              <div className="space-y-0.5 font-mono">
                {diagnostics.targets?.fat_pct !== undefined && (
                  <div>Fat: {diagnostics.targets.fat_pct.toFixed(1)}%</div>
                )}
                {diagnostics.targets?.msnf_pct !== undefined && (
                  <div>MSNF: {diagnostics.targets.msnf_pct.toFixed(1)}%</div>
                )}
                {diagnostics.targets?.totalSugars_pct !== undefined && (
                  <div>Sugars: {diagnostics.targets.totalSugars_pct.toFixed(1)}%</div>
                )}
              </div>
            </div>

            {lpStatus && (
              <div>
                <div className="font-semibold text-muted-foreground mb-1">LP Solver Status</div>
                <Badge variant={lpStatus === 'success' ? 'default' : 'destructive'}>
                  {lpStatus === 'success' ? '✓ Success' : lpStatus === 'failed' ? '✗ Failed' : 'Not Attempted'}
                </Badge>
              </div>
            )}

            {diagnostics.suggestions && diagnostics.suggestions.length > 0 && (
              <div>
                <div className="font-semibold text-muted-foreground mb-1">Suggestions</div>
                <ul className="space-y-0.5 ml-4 list-disc">
                  {diagnostics.suggestions.slice(0, 5).map((s: string, i: number) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-2 border-t border-border text-[10px] text-muted-foreground">
              Ingredient count: {diagnostics.ingredientCount || 0}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
