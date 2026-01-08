import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Brain, CloudOff, Activity } from 'lucide-react';
import { isBackendReady } from '@/integrations/supabase/safeClient';
import { mlService } from '@/services/mlService';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function ValidationStatusIndicator() {
  const [backendStatus, setBackendStatus] = useState<'connected' | 'offline'>('offline');
  const [validationModel, setValidationModel] = useState<any>(null);

  useEffect(() => {
    const checkStatus = () => {
      const backend = isBackendReady();
      setBackendStatus(backend ? 'connected' : 'offline');
      
      const model = mlService.loadModel();
      setValidationModel(model);
    };

    checkStatus();
    const interval = setInterval(checkStatus, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  const getStatusInfo = () => {
    if (backendStatus === 'offline') {
      return {
        icon: <CloudOff className="h-3 w-3" />,
        label: 'Offline',
        variant: 'secondary' as const,
        description: 'Backend offline. Recipe validation uses local rules only.'
      };
    }

    if (validationModel) {
      const accuracy = Math.round(validationModel.accuracy * 100);
      return {
        icon: <Brain className="h-3 w-3" />,
        label: `Validation Active (${accuracy}%)`,
        variant: 'default' as const,
        description: `Model trained ${new Date(validationModel.trained_at).toLocaleDateString()}. Backend connected.`
      };
    }

    return {
      icon: <Activity className="h-3 w-3" />,
      label: 'Connected',
      variant: 'outline' as const,
      description: 'Backend connected. Validation model not yet trained.'
    };
  };

  const status = getStatusInfo();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={status.variant} className="gap-1 cursor-help">
            {status.icon}
            {status.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{status.description}</p>
          {validationModel && (
            <p className="text-xs text-muted-foreground mt-1">
              Features: {Object.keys(validationModel.feature_importance || {}).length}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
