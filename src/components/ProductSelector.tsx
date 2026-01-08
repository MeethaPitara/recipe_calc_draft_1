
import React from 'react';
import { IceCream, Snowflake, Cherry } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type ProductType = 'ice-cream' | 'gelato' | 'sorbet';

interface ProductSelectorProps {
  selectedProduct: ProductType;
  onProductChange: (product: ProductType) => void;
}

const ProductSelector = ({ selectedProduct, onProductChange }: ProductSelectorProps) => {
  return (
    <div className="mb-6">
      <Tabs value={selectedProduct} onValueChange={(value) => onProductChange(value as ProductType)}>
        <TabsList className="grid w-full grid-cols-3 bg-gradient-to-r from-primary/10 to-secondary/10 dark:from-primary/20 dark:to-secondary/20">
          <TabsTrigger 
            value="ice-cream" 
            className="flex items-center gap-2 data-[state=active]:bg-blue-500 data-[state=active]:text-white"
          >
            <IceCream className="h-4 w-4" />
            Ice Cream
          </TabsTrigger>
          <TabsTrigger 
            value="gelato"
            className="flex items-center gap-2 data-[state=active]:bg-purple-500 data-[state=active]:text-white"
          >
            <Snowflake className="h-4 w-4" />
            Gelato
          </TabsTrigger>
          <TabsTrigger 
            value="sorbet"
            className="flex items-center gap-2 data-[state=active]:bg-pink-500 data-[state=active]:text-white"
          >
            <Cherry className="h-4 w-4" />
            Sorbet
          </TabsTrigger>
        </TabsList>
      </Tabs>
      
      <div className="mt-3 p-3 bg-muted rounded-lg">
        <div className="text-sm text-muted-foreground">
          {selectedProduct === 'ice-cream' && (
            <div>
              <strong>Ice Cream Parameters:</strong> Higher fat content (10-20%), churned at higher speeds, 
              served colder (-12°C to -10°C) with higher overrun for light, airy texture.
            </div>
          )}
          {selectedProduct === 'gelato' && (
            <div>
              <strong>Gelato Parameters:</strong> Lower fat content (6-12%), churned slowly for dense texture, 
              served warmer (-8°C to -6°C) for intense flavor experience.
            </div>
          )}
          {selectedProduct === 'sorbet' && (
            <div>
              <strong>Sorbet Parameters:</strong> Fruit-based with no dairy, higher sugar content (22-28%), 
              stabilizers vary by fruit type, served at -10°C to -8°C.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductSelector;
