/**
 * Warnings & Suggestions Sidebar
 * Displays real-time warnings and optimization suggestions
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Info, Lightbulb, CheckCircle } from 'lucide-react';
import { Metrics, generateWarnings, ProductClass } from '@/lib/calc';

interface WarningsSidebarProps {
  metrics: Metrics;
  productType?: ProductClass;
  additionalWarnings?: string[];
}

export const WarningsSidebar: React.FC<WarningsSidebarProps> = ({
  metrics,
  productType,
  additionalWarnings = []
}) => {
  const warnings = generateWarnings(metrics, productType);
  const allWarnings = [...warnings, ...additionalWarnings].filter(Boolean);

  const categorizeWarning = (warning: string): {
    type: 'error' | 'warning' | 'info' | 'success';
    icon: React.ReactNode;
    title: string;
  } => {
    if (warning.includes('Very high') || warning.includes('Very low')) {
      return {
        type: 'error',
        icon: <AlertTriangle className="h-4 w-4" />,
        title: 'Critical Issue'
      };
    }
    if (warning.includes('⚠️')) {
      return {
        type: 'warning',
        icon: <AlertTriangle className="h-4 w-4" />,
        title: 'Warning'
      };
    }
    if (warning.includes('💡')) {
      return {
        type: 'info',
        icon: <Lightbulb className="h-4 w-4" />,
        title: 'Suggestion'
      };
    }
    return {
      type: 'info',
      icon: <Info className="h-4 w-4" />,
      title: 'Info'
    };
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Warnings & Suggestions</CardTitle>
          {allWarnings.length === 0 && (
            <Badge className="bg-green-500">
              <CheckCircle className="h-3 w-3 mr-1" />
              All Clear
            </Badge>
          )}
          {allWarnings.length > 0 && (
            <Badge variant="destructive">
              {allWarnings.length} {allWarnings.length === 1 ? 'Issue' : 'Issues'}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 max-h-[600px] overflow-y-auto">
        {allWarnings.length === 0 ? (
          <Alert>
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-900">Perfect!</AlertTitle>
            <AlertDescription className="text-green-800">
              Your recipe looks balanced with no issues detected. All parameters are within optimal ranges.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {allWarnings.map((warning, idx) => {
              const { type, icon, title } = categorizeWarning(warning);
              const cleanWarning = warning
                .replace(/⚠️/g, '')
                .replace(/💡/g, '')
                .trim();

              return (
                <Alert
                  key={idx}
                  variant={type === 'error' || type === 'warning' ? 'destructive' : 'default'}
                  className={
                    type === 'error' ? 'border-red-300 bg-red-50 dark:bg-red-950/20' :
                    type === 'warning' ? 'border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20' :
                    type === 'info' ? 'border-blue-300 bg-blue-50 dark:bg-blue-950/20' :
                    'border-green-300 bg-green-50 dark:bg-green-950/20'
                  }
                >
                  <div className="flex items-start gap-2">
                    {icon}
                    <div className="flex-1">
                      <AlertTitle className="text-sm font-semibold mb-1">
                        {title}
                      </AlertTitle>
                      <AlertDescription className="text-sm">
                        {cleanWarning}
                      </AlertDescription>
                    </div>
                  </div>
                </Alert>
              );
            })}
          </>
        )}

        {/* Quick Reference */}
        <div className="pt-4 border-t">
          <p className="text-xs font-semibold mb-2 text-muted-foreground">Quick Reference:</p>
          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>SP Range:</span>
              <span className="font-mono">12-28 (typical)</span>
            </div>
            <div className="flex justify-between">
              <span>PAC Range:</span>
              <span className="font-mono">22-33 (typical)</span>
            </div>
            <div className="flex justify-between">
              <span>Total Solids:</span>
              <span className="font-mono">32-46%</span>
            </div>
            <div className="flex justify-between">
              <span>MSNF (dairy):</span>
              <span className="font-mono">7-12%</span>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="pt-3 border-t">
          <p className="text-xs font-semibold mb-2 text-muted-foreground">Legend:</p>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs">
              <AlertTriangle className="h-3 w-3 text-red-600" />
              <span>Critical issues requiring immediate attention</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <AlertTriangle className="h-3 w-3 text-yellow-600" />
              <span>Warnings that may affect quality</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Lightbulb className="h-3 w-3 text-blue-600" />
              <span>Helpful suggestions for optimization</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WarningsSidebar;
