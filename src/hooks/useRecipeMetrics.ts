/**
 * useRecipeMetrics - Recipe metric calculations hook
 */

import { useState, useEffect, useMemo } from 'react';
import { calcMetricsV2, MetricsV2 } from '@/lib/calc.v2';
import { resolveMode, resolveProductKey } from '@/lib/mode';
import { PRODUCT_CONSTRAINTS } from '@/lib/productConstraints';
import type { IngredientRow } from '@/types/calculator';
import type { Mode } from '@/types/mode';

interface UseRecipeMetricsProps {
  rows: IngredientRow[];
  productType: string;
}

interface UseRecipeMetricsReturn {
  metrics: MetricsV2 | null;
  setMetrics: (metrics: MetricsV2 | null) => void;
  calculateMetrics: () => MetricsV2 | null;
  totalBatch: number;
  totalCost: number;
  mode: Mode;
  productKey: string;
  getConstraints: () => typeof PRODUCT_CONSTRAINTS[keyof typeof PRODUCT_CONSTRAINTS];
}

export function useRecipeMetrics({ rows, productType }: UseRecipeMetricsProps): UseRecipeMetricsReturn {
  const [metrics, setMetrics] = useState<MetricsV2 | null>(null);

  const mode = useMemo(() => resolveMode(productType), [productType]);
  
  const productKeyValue = useMemo(() => {
    const hasFruit = rows.some(r => r.ingredientData?.category === 'fruit');
    return resolveProductKey(mode, hasFruit);
  }, [mode, rows]);

  const getConstraints = () => {
    return PRODUCT_CONSTRAINTS[productKeyValue] || PRODUCT_CONSTRAINTS.gelato_white;
  };

  const totalBatch = useMemo(() => {
    return rows.reduce((sum, r) => sum + r.quantity_g, 0);
  }, [rows]);

  const totalCost = useMemo(() => {
    return rows.reduce((sum, r) => {
      if (r.ingredientData?.cost_per_kg) {
        return sum + (r.quantity_g / 1000) * r.ingredientData.cost_per_kg;
      }
      return sum;
    }, 0);
  }, [rows]);

  // Debounced auto-calculation when rows change
  useEffect(() => {
    if (rows.length === 0) return;
    
    const timer = setTimeout(() => {
      const calcRows = rows
        .filter(r => r.ingredientData && r.quantity_g > 0)
        .map(r => ({
          ing: r.ingredientData!,
          grams: r.quantity_g
        }));
      
      if (calcRows.length > 0) {
        const calculated = calcMetricsV2(calcRows, { mode });
        setMetrics(calculated);
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [rows, mode]);

  const calculateMetrics = (): MetricsV2 | null => {
    const validRows = rows.filter(r => r.ingredientData && r.quantity_g > 0);
    
    if (validRows.length === 0) {
      return null;
    }

    const calcRows = validRows.map(r => ({
      ing: r.ingredientData!,
      grams: r.quantity_g
    }));

    const calculated = calcMetricsV2(calcRows, { mode });
    setMetrics(calculated);
    
    return calculated;
  };

  return {
    metrics,
    setMetrics,
    calculateMetrics,
    totalBatch,
    totalCost,
    mode,
    productKey: productKeyValue,
    getConstraints
  };
}
