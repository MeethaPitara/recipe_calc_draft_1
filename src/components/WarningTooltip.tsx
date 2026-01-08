import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle, BookOpen, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface WarningTooltipProps {
  warning: string;
  onRequestAIHelp?: () => void;
}

export const WarningTooltip: React.FC<WarningTooltipProps> = ({ warning, onRequestAIHelp }) => {
  
  // Generate detailed explanation and quick fix based on warning text
  const getWarningInfo = (warning: string): { explanation: string; quickFix: string; glossaryTerm?: string } => {
    if (warning.includes('Lactose') && warning.includes('11%')) {
      return {
        explanation: 'High lactose content (>11%) can lead to crystallization at low temperatures, creating a gritty, sandy texture. This occurs because lactose has poor solubility in frozen conditions.',
        quickFix: 'Reduce skim milk powder by 10-15g OR replace some MSNF with glucose syrup (2-3%)',
        glossaryTerm: 'msnf'
      };
    }
    if (warning.includes('Protein') && warning.includes('5%')) {
      return {
        explanation: 'Excessive protein content (>5%) causes chewiness and may lead to whey protein aggregation during aging, affecting mouthfeel and texture.',
        quickFix: 'Reduce MSNF by 5-10g or use whey protein isolate instead of SMP',
        glossaryTerm: 'msnf'
      };
    }
    if (warning.includes('Too soft') || warning.includes('FPDT < 2.5')) {
      return {
        explanation: 'Low freezing point depression means the product will be too soft and may not hold its structure properly. This typically results from too much anti-freeze power.',
        quickFix: 'Reduce dextrose by 2-4% OR increase sucrose proportion',
        glossaryTerm: 'fpdt'
      };
    }
    if (warning.includes('Too hard') || warning.includes('FPDT > 3.5')) {
      return {
        explanation: 'High freezing point depression creates an overly firm, icy texture that\'s difficult to scoop. This indicates insufficient anti-freeze components.',
        quickFix: 'Add dextrose (2-4%) OR increase total water content by 2-3%',
        glossaryTerm: 'fpdt'
      };
    }
    if (warning.includes('Fat') && warning.includes('gelato')) {
      return {
        explanation: 'Gelato traditionally has lower fat content (6-9%) than ice cream. Fat affects creaminess, flavor release, and mouthfeel. Too little = icy; too much = coating.',
        quickFix: 'Adjust cream/milk ratio to reach 6-9% fat',
        glossaryTerm: 'msnf'
      };
    }
    if (warning.includes('MSNF') && warning.includes('gelato')) {
      return {
        explanation: 'Milk Solids Non-Fat provide body, improve texture, and contribute to the smooth mouthfeel. For gelato, the ideal range is 10-12%.',
        quickFix: 'Add or remove skim milk powder to reach 10-12% MSNF',
        glossaryTerm: 'msnf'
      };
    }
    if (warning.includes('sugars') || warning.includes('Total Sugars')) {
      return {
        explanation: 'Total sugar content affects sweetness, freezing point, and texture. Too little = hard & icy; too much = soft & overly sweet. Balance is key.',
        quickFix: 'Adjust sugar blend to reach 16-22% total sugars',
        glossaryTerm: 'pod'
      };
    }
    if (warning.includes('Total solids') || warning.includes('TS')) {
      return {
        explanation: 'Total solids determine the density and richness of your gelato. Too low = watery & icy; too high = heavy & gummy.',
        quickFix: 'Rebalance all solid ingredients to reach target 36-45%'
      };
    }
    if (warning.includes('POD')) {
      return {
        explanation: 'POD (Power of Dextrose) Index measures the relative sweetening and freezing point depression compared to sucrose (baseline 100). Ideal range is 80-120 for balanced texture.',
        quickFix: 'Adjust sugar spectrum to reach POD 80-120',
        glossaryTerm: 'pod'
      };
    }
    return {
      explanation: 'This parameter is outside the recommended range and may affect your final product quality.',
      quickFix: 'Review recipe composition and adjust accordingly'
    };
  };

  const warningInfo = getWarningInfo(warning);

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="inline-flex items-center justify-center hover:opacity-70 transition-opacity">
            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </TooltipTrigger>
        <TooltipContent 
          side="right" 
          className="max-w-md p-4 bg-popover text-popover-foreground border shadow-lg z-50"
          sideOffset={5}
        >
          <div className="space-y-3">
            {/* Explanation */}
            <div>
              <p className="text-xs font-semibold text-foreground mb-1">Why this matters:</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{warningInfo.explanation}</p>
            </div>
            
            {/* Quick Fix */}
            <div className="pt-2 border-t">
              <p className="text-xs font-semibold text-foreground mb-1">Quick Fix:</p>
              <p className="text-xs text-primary">{warningInfo.quickFix}</p>
            </div>
            
            {/* Actions */}
            <div className="flex gap-2 pt-2">
              {warningInfo.glossaryTerm && (
                <Link to={`/glossary#${warningInfo.glossaryTerm}`}>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-xs h-7 gap-1"
                  >
                    <BookOpen className="h-3 w-3" />
                    Learn More
                  </Button>
                </Link>
              )}
              
              {onRequestAIHelp && (
                <Button 
                  variant="default" 
                  size="sm" 
                  className="text-xs h-7 gap-1"
                  onClick={onRequestAIHelp}
                >
                  <Sparkles className="h-3 w-3" />
                  AI Help
                </Button>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
