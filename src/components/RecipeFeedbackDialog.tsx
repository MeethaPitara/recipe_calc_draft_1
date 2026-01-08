import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Meh, MessageSquare } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useRecipeOutcomeLogger } from '@/hooks/useRecipeOutcomeLogger';

interface RecipeFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipeId: string | null;
  recipeName: string;
  metrics: any;
}

export function RecipeFeedbackDialog({
  open,
  onOpenChange,
  recipeId,
  recipeName,
  metrics,
}: RecipeFeedbackDialogProps) {
  const [outcome, setOutcome] = useState<'success' | 'needs_improvement' | 'failed'>('success');
  const [texture, setTexture] = useState('');
  const [notes, setNotes] = useState('');
  const { logOutcome } = useRecipeOutcomeLogger();

  const handleSubmit = async () => {
    const success = await logOutcome(recipeId, outcome, texture, notes, metrics);
    if (success) {
      setOutcome('success');
      setTexture('');
      setNotes('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>How did "{recipeName}" turn out?</DialogTitle>
          <DialogDescription>
            Your feedback helps improve recipe analysis for future recipes
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Outcome Selection */}
          <div className="space-y-3">
            <Label>Overall Result</Label>
            <RadioGroup value={outcome} onValueChange={(v) => setOutcome(v as any)}>
              <div className="flex items-center space-x-2 p-3 rounded-lg border cursor-pointer hover:bg-accent">
                <RadioGroupItem value="success" id="success" />
                <Label htmlFor="success" className="flex items-center gap-2 cursor-pointer flex-1">
                  <ThumbsUp className="h-4 w-4 text-green-500" />
                  <div>
                    <div className="font-semibold">Success</div>
                    <div className="text-xs text-muted-foreground">Recipe worked perfectly</div>
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-2 p-3 rounded-lg border cursor-pointer hover:bg-accent">
                <RadioGroupItem value="needs_improvement" id="needs_improvement" />
                <Label htmlFor="needs_improvement" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Meh className="h-4 w-4 text-yellow-500" />
                  <div>
                    <div className="font-semibold">Needs Improvement</div>
                    <div className="text-xs text-muted-foreground">Close, but needs tweaking</div>
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-2 p-3 rounded-lg border cursor-pointer hover:bg-accent">
                <RadioGroupItem value="failed" id="failed" />
                <Label htmlFor="failed" className="flex items-center gap-2 cursor-pointer flex-1">
                  <ThumbsDown className="h-4 w-4 text-red-500" />
                  <div>
                    <div className="font-semibold">Failed</div>
                    <div className="text-xs text-muted-foreground">Didn't work as expected</div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Texture */}
          <div className="space-y-2">
            <Label htmlFor="texture">Actual Texture (Optional)</Label>
            <input
              id="texture"
              type="text"
              placeholder="e.g., Creamy, Icy, Dense, Smooth"
              value={texture}
              onChange={(e) => setTexture(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="What worked? What didn't? Any observations..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            <MessageSquare className="h-4 w-4 mr-2" />
            Submit Feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
