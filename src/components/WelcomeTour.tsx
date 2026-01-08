import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArrowRight, Search, BarChart3, Save, X } from 'lucide-react';

interface WelcomeTourProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const TOUR_SEEN_KEY = 'meetha-pitara-tour-seen';

export function WelcomeTour({ open: controlledOpen, onOpenChange }: WelcomeTourProps) {
  const [step, setStep] = useState(0);
  const [internalOpen, setInternalOpen] = useState(false);

  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setIsOpen = onOpenChange || setInternalOpen;

  useEffect(() => {
    // Auto-show on first visit if not controlled
    if (controlledOpen === undefined) {
      const hasSeenTour = localStorage.getItem(TOUR_SEEN_KEY);
      if (!hasSeenTour) {
        setInternalOpen(true);
      }
    }
  }, [controlledOpen]);

  const steps = [
    {
      title: '1. Add Ingredients',
      description: 'Search and add ingredients to your recipe. Press "/" for quick search or click the "Add Ingredient" button.',
      icon: <Search className="h-12 w-12 text-primary" />,
      highlight: 'Our database includes 100+ ingredients with precise nutritional data'
    },
    {
      title: '2. Analyze Metrics',
      description: 'Watch real-time metrics update as you build your recipe. Green badges mean you\'re on target!',
      icon: <BarChart3 className="h-12 w-12 text-primary" />,
      highlight: 'FPDT, Total Solids, POD Index, and more - all calculated instantly'
    },
    {
      title: '3. Save Your Recipe',
      description: 'Save recipes to the cloud with automatic versioning. Access from any device and export to CSV.',
      icon: <Save className="h-12 w-12 text-primary" />,
      highlight: 'Never lose a formula - full version history is kept for every recipe'
    }
  ];

  const currentStep = steps[step];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = () => {
    localStorage.setItem(TOUR_SEEN_KEY, 'true');
    setIsOpen(false);
    setStep(0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md p-6">
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-4 transition-all duration-200 ease-in-out"
          onClick={handleSkip}
        >
          <X className="h-4 w-4" />
        </Button>
        
        <DialogHeader className="space-y-4">
          <div className="flex justify-center mb-4">
            {currentStep.icon}
          </div>
          <DialogTitle className="text-center text-2xl font-bold">
            {currentStep.title}
          </DialogTitle>
          <DialogDescription className="text-center text-base text-muted-foreground pt-2">
            {currentStep.description}
          </DialogDescription>
        </DialogHeader>

        <div className="bg-info-light rounded-lg p-4 my-6">
          <p className="text-sm text-center text-foreground">
            {currentStep.highlight}
          </p>
        </div>

        <div className="flex justify-center gap-2 mb-6">
          {steps.map((_, idx) => (
            <div
              key={idx}
              className={`h-2 w-2 rounded-full transition-all duration-200 ease-in-out ${
                idx === step ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
          <Button variant="ghost" onClick={handleSkip} className="transition-all duration-200 ease-in-out">
            Skip Tour
          </Button>
          <Button onClick={handleNext} className="transition-all duration-200 ease-in-out">
            {step < steps.length - 1 ? (
              <>
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </>
            ) : (
              'Get Started'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function showTourAgain() {
  localStorage.removeItem(TOUR_SEEN_KEY);
  window.location.reload();
}
