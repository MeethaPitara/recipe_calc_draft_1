import React from 'react';
import { Plus, Save, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MobileActionBarProps {
  onAddIngredient: () => void;
  onViewMetrics: () => void;
  onSave: () => void;
  canSave: boolean;
  isSaving: boolean;
}

export const MobileActionBar: React.FC<MobileActionBarProps> = ({
  onAddIngredient,
  onViewMetrics,
  onSave,
  canSave,
  isSaving,
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border shadow-lg z-50 md:hidden pb-[env(safe-area-inset-bottom,0px)]">
      <div className="grid grid-cols-3 gap-2 p-3">
        <Button
          variant="outline"
          onClick={onAddIngredient}
          className="h-12 flex flex-col items-center justify-center gap-1 touch-target transition-all duration-200 ease-in-out"
        >
          <Plus className="h-5 w-5" />
          <span className="text-xs">Add</span>
        </Button>

        <Button
          variant="outline"
          onClick={onViewMetrics}
          className="h-12 flex flex-col items-center justify-center gap-1 touch-target transition-all duration-200 ease-in-out"
        >
          <BarChart3 className="h-5 w-5" />
          <span className="text-xs">Metrics</span>
        </Button>

        <Button
          variant="default"
          onClick={onSave}
          disabled={!canSave || isSaving}
          className="h-12 flex flex-col items-center justify-center gap-1 touch-target transition-all duration-200 ease-in-out"
        >
          <Save className="h-5 w-5" />
          <span className="text-xs">{isSaving ? 'Saving...' : 'Save'}</span>
        </Button>
      </div>
    </div>
  );
};
