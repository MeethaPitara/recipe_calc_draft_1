import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { useAIUsageLimit } from '@/hooks/useAIUsageLimit';
import { Progress } from '@/components/ui/progress';
import { safeDivide, clamp } from '@/lib/math';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AIUsageCounterProps {
  className?: string;
  compact?: boolean;
}

export const AIUsageCounter: React.FC<AIUsageCounterProps> = ({ 
  className = '', 
  compact = false 
}) => {
  const { used, limit, remaining, isLoading, error } = useAIUsageLimit();

  if (isLoading) {
    return (
      <Card className={`p-3 ${className}`}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading AI usage...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`p-3 border-orange-300 bg-orange-50 dark:bg-orange-950/20 ${className}`}>
        <div className="flex items-center gap-2 text-sm">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <span className="text-orange-900 dark:text-orange-100">
            Unable to load AI usage
          </span>
        </div>
      </Card>
    );
  }

  const percentage = clamp(safeDivide(used, limit) * 100, 0, 100);
  const isNearLimit = remaining <= 2;
  const isAtLimit = remaining === 0;

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant={isAtLimit ? "destructive" : isNearLimit ? "secondary" : "outline"}
              className="cursor-help"
            >
              <Sparkles className="h-3 w-3 mr-1" />
              {remaining}/{limit}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">AI uses remaining this hour</p>
            <p className="text-xs text-muted-foreground">Resets every hour</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Card className={`p-4 ${className}`}>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">AI Usage</span>
          </div>
          <Badge 
            variant={isAtLimit ? "destructive" : isNearLimit ? "secondary" : "outline"}
          >
            {remaining} left
          </Badge>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <Progress 
            value={percentage} 
            className="h-2"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{used} used</span>
            <span>{limit} per hour</span>
          </div>
        </div>

        {/* Warning Message */}
        {isNearLimit && (
          <div className={`text-xs p-2 rounded ${
            isAtLimit 
              ? 'bg-destructive/10 text-destructive' 
              : 'bg-orange-50 dark:bg-orange-950/20 text-orange-600'
          }`}>
            {isAtLimit 
              ? '⚠️ Rate limit reached. Try again in ~1 hour.'
              : '⚠️ Running low on AI uses. Limit resets every hour.'}
          </div>
        )}

        {/* Info */}
        <p className="text-xs text-muted-foreground">
          Resets hourly • Includes suggestions, optimizations, and explanations
        </p>
      </div>
    </Card>
  );
};
