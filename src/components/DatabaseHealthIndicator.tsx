import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertTriangle, Database } from 'lucide-react';
import { checkDbHealth } from '@/lib/ingredientMapper';
import type { IngredientData } from '@/types/ingredients';
import { useNavigate } from 'react-router-dom';

interface DatabaseHealthIndicatorProps {
  availableIngredients: IngredientData[];
  compact?: boolean;
}

/**
 * DB Health Check UI - Shows which canonical ingredients are available
 * PHASE 1: Critical Fix - Display missing balancing levers
 */
export function DatabaseHealthIndicator({ 
  availableIngredients, 
  compact = false 
}: DatabaseHealthIndicatorProps) {
  const navigate = useNavigate();
  const health = checkDbHealth(availableIngredients);

  if (health.healthy && compact) {
    return (
      <Alert className="bg-success/10 border-success/20">
        <CheckCircle2 className="h-4 w-4 text-success" />
        <AlertDescription className="text-sm font-medium text-success-foreground">
          ✅ All essential ingredients available
        </AlertDescription>
      </Alert>
    );
  }

  if (compact) {
    return (
      <Alert variant="destructive" className="bg-destructive/10">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="text-sm">
          <strong>Missing {health.missing.length} essential ingredient{health.missing.length > 1 ? 's' : ''}</strong>
          <div className="text-xs mt-1 space-y-0.5">
            {health.missing.map((item, i) => (
              <div key={i}>• {item}</div>
            ))}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2 w-full"
            onClick={() => navigate('/database')}
          >
            <Database className="h-3 w-3 mr-1" />
            Add to Database
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Full card view
  return (
    <Card className={health.healthy ? 'border-success/30' : 'border-destructive/30'}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Database className="h-4 w-4" />
          Database Health Check
          {health.healthy ? (
            <Badge variant="default" className="bg-success text-success-foreground">
              Ready
            </Badge>
          ) : (
            <Badge variant="destructive">
              {health.missing.length} Missing
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2">
            {health.hasWater ? (
              <CheckCircle2 className="h-4 w-4 text-success" />
            ) : (
              <XCircle className="h-4 w-4 text-destructive" />
            )}
            <span className={health.hasWater ? 'text-success-foreground' : 'text-muted-foreground'}>
              Water (diluent)
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {health.hasCream35OrButter ? (
              <CheckCircle2 className="h-4 w-4 text-success" />
            ) : (
              <XCircle className="h-4 w-4 text-destructive" />
            )}
            <span className={health.hasCream35OrButter ? 'text-success-foreground' : 'text-muted-foreground'}>
              Cream/Butter (fat)
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {health.hasSMP ? (
              <CheckCircle2 className="h-4 w-4 text-success" />
            ) : (
              <XCircle className="h-4 w-4 text-destructive" />
            )}
            <span className={health.hasSMP ? 'text-success-foreground' : 'text-muted-foreground'}>
              SMP (MSNF)
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <span className="text-success-foreground">
              Sugars
            </span>
          </div>
        </div>

        {!health.healthy && (
          <>
            <Alert variant="destructive" className="bg-destructive/5">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>Cannot balance recipes without:</strong>
                <ul className="mt-1 space-y-0.5 ml-4 list-disc">
                  {health.missing.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
            
            <Button 
              variant="default" 
              size="sm" 
              className="w-full"
              onClick={() => navigate('/database')}
            >
              <Database className="h-4 w-4 mr-2" />
              Add Missing Ingredients
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
