import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  children,
  defaultOpen = true,
  icon,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card className="transition-all duration-200 ease-in-out">
      <CardHeader
        className="cursor-pointer touch-target p-4"
        onClick={() => setIsOpen(!isOpen)}
      >
        <CardTitle className="flex items-center justify-between text-lg font-semibold">
          <div className="flex items-center gap-2">
            {icon}
            {title}
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 transition-all duration-200 ease-in-out">
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CardTitle>
      </CardHeader>
      
      {isOpen && <CardContent className="p-4 pt-0">{children}</CardContent>}
    </Card>
  );
};
