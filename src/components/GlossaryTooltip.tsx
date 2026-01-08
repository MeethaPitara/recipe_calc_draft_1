import { HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface GlossaryTooltipProps {
  term: 'fpdt' | 'msnf' | 'pod' | 'pac' | 'sp' | 'se' | 'ts' | 'overrun' | 'protein' | 'lactose';
  brief: string;
}

const TERM_NAMES = {
  fpdt: 'FPDT',
  msnf: 'MSNF',
  pod: 'POD',
  pac: 'PAC',
  sp: 'SP',
  se: 'SE',
  ts: 'Total Solids',
  overrun: 'Overrun',
  protein: 'Protein',
  lactose: 'Lactose'
};

export function GlossaryTooltip({ term, brief }: GlossaryTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link 
          to={`/help/glossary#${term}`}
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </Link>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="font-semibold mb-1">{TERM_NAMES[term]}</p>
        <p className="text-xs">{brief}</p>
        <p className="text-xs text-muted-foreground mt-1">Click to learn more</p>
      </TooltipContent>
    </Tooltip>
  );
}
