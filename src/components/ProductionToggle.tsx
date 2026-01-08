import React, { useEffect } from 'react';
import { EyeOff, Eye, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { logEvent, ANALYTICS_EVENTS } from '@/lib/analytics';

interface ProductionToggleProps {
  isProduction: boolean;
  onToggle: (enabled: boolean) => void;
}

export const ProductionToggle: React.FC<ProductionToggleProps> = ({
  isProduction,
  onToggle,
}) => {
  const { toast } = useToast();

  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      // Cmd/Ctrl+Shift+P (avoid Cmd+P which triggers print)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        onToggle(!isProduction);
        toast({
          title: !isProduction ? "Production Mode Enabled" : "Production Mode Disabled",
          description: !isProduction 
            ? "Kitchen-friendly view activated" 
            : "Full interface restored",
          duration: 2000
        });
      }
    };

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [isProduction, onToggle, toast]);

  return (
    <div className="flex items-center gap-2 production-toggle">
      <Button
        variant={isProduction ? "default" : "outline"}
        size="sm"
        onClick={() => {
          const nextState = !isProduction;
          onToggle(nextState);
          
          if (nextState) {
            logEvent(ANALYTICS_EVENTS.PRODUCTION_MODE_ENABLE);
          }
          
          toast({
            title: !isProduction ? "Production Mode" : "Normal Mode",
            description: !isProduction 
              ? "Showing kitchen view (Cmd/Ctrl+Shift+P to toggle)" 
              : "Showing full interface",
            duration: 2000
          });
        }}
        className="flex items-center gap-2"
        title="Toggle Production Mode (Cmd/Ctrl+Shift+P)"
      >
        {isProduction ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        {isProduction ? "Exit" : "Production"}
      </Button>
      
      {isProduction && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            logEvent(ANALYTICS_EVENTS.PRODUCTION_MODE_PRINT);
            window.print();
            toast({
              title: "Print Preview",
              description: "Kitchen-friendly format ready",
              duration: 2000
            });
          }}
          className="flex items-center gap-2"
          title="Print Recipe (Cmd/Ctrl+P)"
        >
          <Printer className="h-4 w-4" />
          Print
        </Button>
      )}
    </div>
  );
};
