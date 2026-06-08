import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Wand2, Beaker, CheckCircle, AlertCircle, Save } from 'lucide-react';
import { apiPost } from '@/lib/apiClient';

interface TrialRecorderProps {
  recipeId: string;
  targetMetrics: {
    fat_pct?: number;
    msnf_pct?: number;
    sugars_pct?: number;
    total_solids_pct?: number;
    fpdt?: number;
  };
  onSaved?: () => void;
  onCancel?: () => void;
}

export function TrialRecorder({ recipeId, targetMetrics, onSaved, onCancel }: TrialRecorderProps) {
  const { toast } = useToast();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [batchSize, setBatchSize] = useState<number | ''>('');
  const [outcome, setOutcome] = useState('pending');
  const [notes, setNotes] = useState('');
  
  // QA Metrics state
  const [qaActuals, setQaActuals] = useState<Record<string, string>>({
    fat_pct: '',
    msnf_pct: '',
    sugars_pct: '',
    total_solids_pct: '',
    overrun_pct: '',
    hardness_fpdt: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiDiagnosis, setAiDiagnosis] = useState<any>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  const handleMetricChange = (metric: string, value: string) => {
    setQaActuals(prev => ({ ...prev, [metric]: value }));
  };

  const handleSave = async () => {
    if (!recipeId) {
        toast({ title: 'Error', description: 'Recipe ID is required.', variant: 'destructive' });
        return;
    }
    if (!batchSize) {
        toast({ title: 'Error', description: 'Batch size is required.', variant: 'destructive' });
        return;
    }

    setIsSubmitting(true);
    try {
      const qa_metrics = Object.entries(qaActuals)
        .filter(([_, val]) => val !== '')
        .map(([key, val]) => {
          const actual = parseFloat(val);
          // Map internal keys to display names and targets
          let target = null;
          let metric_name = key;
          
          if (key === 'fat_pct') { target = targetMetrics.fat_pct; metric_name = 'Fat %'; }
          else if (key === 'msnf_pct') { target = targetMetrics.msnf_pct; metric_name = 'MSNF %'; }
          else if (key === 'sugars_pct') { target = targetMetrics.sugars_pct; metric_name = 'Sugars %'; }
          else if (key === 'total_solids_pct') { target = targetMetrics.total_solids_pct; metric_name = 'Total Solids %'; }
          else if (key === 'overrun_pct') { metric_name = 'Overrun %'; }
          else if (key === 'hardness_fpdt') { target = targetMetrics.fpdt; metric_name = 'Hardness (FPDT)'; }

          let deviation_pct = 0;
          if (target != null && target !== 0) {
              deviation_pct = ((actual - target) / target) * 100;
          }

          return {
            metric_name,
            target_value: target,
            actual_value: actual,
            pass_fail: target != null ? Math.abs(deviation_pct) <= 5 : true, // simple threshold
            deviation_pct
          };
        });

      const payload = {
        recipe_id: recipeId,
        trial_date: date,
        batch_size_g: Number(batchSize),
        outcome,
        notes,
        qa_metrics
      };

      await apiPost('/api/trials', payload);
      
      toast({ title: 'Success', description: 'Trial record saved successfully.' });
      
      if (outcome === 'fail' || outcome === 'revision') {
          triggerAiDiagnosis(qa_metrics);
      } else {
          if (onSaved) onSaved();
      }

    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to save trial.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const triggerAiDiagnosis = async (formattedQaMetrics: any[]) => {
      setIsDiagnosing(true);
      setAiDiagnosis(null);
      try {
          // Format current metrics for AI
          const currentMetrics: any = {};
          formattedQaMetrics.forEach(m => {
              currentMetrics[m.metric_name] = m.actual_value;
          });

          const res = await apiPost('/api/ai/diagnose-trial', {
              targetMetrics,
              currentMetrics,
              notes
          });

          if (res.success && res.diagnosis) {
              setAiDiagnosis(res.diagnosis);
          }
      } catch (error: any) {
          toast({ title: 'AI Diagnostics Failed', description: error.message, variant: 'destructive' });
      } finally {
          setIsDiagnosing(false);
      }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-sm border-muted">
      <CardHeader className="bg-muted/30 pb-4">
        <div className="flex items-center space-x-2">
            <Beaker className="w-5 h-5 text-primary" />
            <CardTitle>Record Production Trial</CardTitle>
        </div>
        <CardDescription>Log physical trial results and QA measurements.</CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        
        {/* Basic Info */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="trial-date">Trial Date</Label>
            <Input id="trial-date" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="batch-size">Batch Size (g)</Label>
            <Input id="batch-size" type="number" placeholder="e.g. 5000" value={batchSize} onChange={e => setBatchSize(e.target.value ? Number(e.target.value) : '')} />
          </div>
        </div>

        {/* QA Metrics */}
        <div className="space-y-3">
            <Label className="text-base font-semibold">QA Measurements (Actuals)</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-muted/20 p-4 rounded-lg border">
                <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Fat % (Target: {targetMetrics.fat_pct?.toFixed(1) || '-'})</Label>
                    <Input type="number" step="0.1" value={qaActuals.fat_pct} onChange={e => handleMetricChange('fat_pct', e.target.value)} placeholder="Measured %" />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">MSNF % (Target: {targetMetrics.msnf_pct?.toFixed(1) || '-'})</Label>
                    <Input type="number" step="0.1" value={qaActuals.msnf_pct} onChange={e => handleMetricChange('msnf_pct', e.target.value)} placeholder="Measured %" />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Total Solids % (Target: {targetMetrics.total_solids_pct?.toFixed(1) || '-'})</Label>
                    <Input type="number" step="0.1" value={qaActuals.total_solids_pct} onChange={e => handleMetricChange('total_solids_pct', e.target.value)} placeholder="Measured %" />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Sugars % (Target: {targetMetrics.sugars_pct?.toFixed(1) || '-'})</Label>
                    <Input type="number" step="0.1" value={qaActuals.sugars_pct} onChange={e => handleMetricChange('sugars_pct', e.target.value)} placeholder="Measured %" />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Overrun %</Label>
                    <Input type="number" step="1" value={qaActuals.overrun_pct} onChange={e => handleMetricChange('overrun_pct', e.target.value)} placeholder="Measured %" />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Hardness FPD (Target: {targetMetrics.fpdt?.toFixed(1) || '-'})</Label>
                    <Input type="number" step="0.1" value={qaActuals.hardness_fpdt} onChange={e => handleMetricChange('hardness_fpdt', e.target.value)} placeholder="Measured °C" />
                </div>
            </div>
        </div>

        {/* Outcome & Notes */}
        <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label>Trial Outcome</Label>
                <Select value={outcome} onValueChange={setOutcome}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="pending">Pending Review</SelectItem>
                        <SelectItem value="pass">Pass (Approved)</SelectItem>
                        <SelectItem value="revision">Needs Minor Revision</SelectItem>
                        <SelectItem value="fail">Fail (Requires Reformulation)</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
                <Label>Notes / Operator Feedback</Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Texture was too icy, melted quickly..." />
            </div>
        </div>

        {/* AI Diagnosis Panel */}
        {isDiagnosing && (
            <div className="flex flex-col items-center justify-center py-6 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-800">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-2" />
                <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Analyzing QA data with Food Science AI...</p>
            </div>
        )}

        {aiDiagnosis && !isDiagnosing && (
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-900/20 p-5 rounded-lg border border-indigo-100 dark:border-indigo-800/50 space-y-4">
                <div className="flex items-center space-x-2 text-indigo-700 dark:text-indigo-300">
                    <Wand2 className="h-5 w-5" />
                    <h4 className="font-semibold text-lg">AI Formulation Diagnostics</h4>
                </div>
                
                <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-500/70">Diagnosis</span>
                    <p className="text-sm font-medium mt-1">{aiDiagnosis.diagnosis}</p>
                </div>
                
                <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-500/70">Root Cause</span>
                    <p className="text-sm mt-1">{aiDiagnosis.root_cause_analysis}</p>
                </div>

                {aiDiagnosis.actionable_suggestions && aiDiagnosis.actionable_suggestions.length > 0 && (
                    <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-500/70">Actionable Steps</span>
                        <ul className="mt-2 space-y-2">
                            {aiDiagnosis.actionable_suggestions.map((sug: string, idx: number) => (
                                <li key={idx} className="flex items-start text-sm">
                                    <CheckCircle className="h-4 w-4 mr-2 text-green-500 mt-0.5 shrink-0" />
                                    <span>{sug}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        )}

        <div className="flex justify-end space-x-2 pt-4 border-t">
          {onCancel && (
              <Button variant="outline" onClick={onCancel} disabled={isSubmitting || isDiagnosing}>
                 Cancel
              </Button>
          )}
          <Button onClick={handleSave} disabled={isSubmitting || isDiagnosing} className="bg-primary text-primary-foreground">
            {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
           Save Trial {outcome === 'fail' && !aiDiagnosis ? '& Diagnose' : ''}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
