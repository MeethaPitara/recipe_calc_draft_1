import { useEffect, useState } from 'react';
import { Brain, Zap, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { mlService } from '@/services/mlService';
import { toast } from 'sonner';
import { getSupabase } from '@/integrations/supabase/safeClient';

export function AutoTrainingMonitor() {
  const [outcomeCount, setOutcomeCount] = useState(0);
  const [lastTrainedAt, setLastTrainedAt] = useState<string | null>(null);
  const [isTraining, setIsTraining] = useState(false);

  useEffect(() => {
    checkTrainingStatus();
    
    // Check every 5 minutes
    const interval = setInterval(checkTrainingStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const checkTrainingStatus = async () => {
    try {
      const supabase = await getSupabase();
      
      // Count new outcomes since last training
      const model = mlService.loadModel();
      const lastTrained = model?.trained_at || '2000-01-01';
      
      const { count } = await supabase
        .from('recipe_outcomes')
        .select('*', { count: 'exact', head: true })
        .eq('outcome', 'success')
        .gt('created_at', lastTrained);

      setOutcomeCount(count || 0);
      setLastTrainedAt(model?.trained_at || null);

      // Auto-train if we have 5+ new successful outcomes
      if (count && count >= 5) {
        await handleAutoTrain();
      }
    } catch (error) {
      console.error('Training status check failed:', error);
    }
  };

  const handleAutoTrain = async () => {
    setIsTraining(true);
    
    try {
      const weights = await mlService.trainModel();
      
      setLastTrainedAt(weights.trained_at);
      setOutcomeCount(0);
      
      toast.success('🎉 Model auto-trained!', {
        description: `Accuracy: ${Math.round(weights.accuracy * 100)}%. Predictions improved!`,
      });
    } catch (error: any) {
      console.error('Auto-training failed:', error);
      if (!error.message?.includes('Need at least')) {
        toast.error('Auto-training failed', {
          description: 'Will retry later',
        });
      }
    } finally {
      setIsTraining(false);
    }
  };

  if (outcomeCount === 0 && !lastTrainedAt) {
    return null;
  }

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              {isTraining ? (
                <Zap className="h-5 w-5 text-primary animate-pulse" />
              ) : (
                <Brain className="h-5 w-5 text-primary" />
              )}
            </div>
            <div>
              <div className="font-semibold text-sm">ML Training Monitor</div>
              <div className="text-xs text-muted-foreground">
                {isTraining ? (
                  'Training in progress...'
                ) : lastTrainedAt ? (
                  `Last trained: ${new Date(lastTrainedAt).toLocaleDateString()}`
                ) : (
                  'No model trained yet'
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {outcomeCount > 0 && (
              <Badge variant="secondary" className="gap-1">
                <TrendingUp className="h-3 w-3" />
                {outcomeCount} new
              </Badge>
            )}
            {outcomeCount >= 5 && !isTraining && (
              <Button size="sm" onClick={handleAutoTrain} className="gap-2">
                <Zap className="h-4 w-4" />
                Train Now
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
