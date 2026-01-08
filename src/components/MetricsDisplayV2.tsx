import { MetricsV2 } from "@/lib/calc.v2";
import { MetricCard } from "./MetricCard";
import { GlossaryTooltip } from "./GlossaryTooltip";

interface MetricsDisplayV2Props {
  metrics: MetricsV2;
  mode: 'gelato' | 'kulfi';
}

const getStatus = (value: number, min: number, max: number): 'success' | 'warning' | 'error' => {
  if (value >= min && value <= max) return 'success';
  if (value < min * 0.9 || value > max * 1.1) return 'error';
  return 'warning';
};

export const MetricsDisplayV2 = ({ metrics, mode }: MetricsDisplayV2Props) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold mb-4">Basic Composition</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Fat"
            value={metrics.fat_pct}
            unit="%"
            target={mode === 'gelato' ? '6-9' : '10-12'}
            status={getStatus(metrics.fat_pct, mode === 'gelato' ? 6 : 10, mode === 'gelato' ? 9 : 12)}
            tooltip="Contributes to richness and smooth texture"
          />
          
          <MetricCard
            label={
              <span className="flex items-center gap-1">
                MSNF
                <GlossaryTooltip term="msnf" brief="Milk Solids Non-Fat: protein + lactose + minerals from dairy" />
              </span>
            }
            sublabel="Milk Solids Non-Fat"
            value={metrics.msnf_pct}
            unit="%"
            target={mode === 'gelato' ? '10-12' : '18-25'}
            status={getStatus(metrics.msnf_pct, mode === 'gelato' ? 10 : 18, mode === 'gelato' ? 12 : 25)}
            tooltip="Includes protein and lactose from dairy"
          />
          
          <MetricCard
            label="Water"
            value={metrics.water_pct}
            unit="%"
            target={mode === 'gelato' ? '55-64' : undefined}
            tooltip="Water content affects freeze characteristics"
          />
          
          <MetricCard
            label="Total Solids"
            value={metrics.ts_pct}
            unit="%"
            target={mode === 'gelato' ? '36-45' : '38-42'}
            status={getStatus(metrics.ts_pct, mode === 'gelato' ? 36 : 38, mode === 'gelato' ? 45 : 42)}
            tooltip="Total dry matter in recipe"
          />
        </div>
      </div>

      <div>
        <h3 className="text-2xl font-bold mb-4">Sugar Analysis</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <MetricCard
            label={
              <span className="flex items-center gap-1">
                Total Sugars
                <GlossaryTooltip term="ts" brief="All sugars including lactose from milk solids" />
              </span>
            }
            sublabel="(incl. lactose)"
            value={metrics.totalSugars_pct}
            unit="%"
            target={mode === 'gelato' ? '16-22' : undefined}
            status={mode === 'gelato' ? getStatus(metrics.totalSugars_pct, 16, 22) : undefined}
            tooltip="All sugars including lactose from MSNF"
          />
          
          <MetricCard
            label="Non-Lactose Sugars"
            value={metrics.nonLactoseSugars_pct}
            unit="%"
            tooltip="Added sugars only (sucrose, dextrose, fructose, etc.)"
          />
          
          <MetricCard
            label={
              <span className="flex items-center gap-1">
                Lactose
                <GlossaryTooltip term="lactose" brief="Milk sugar - risk of crystallization if >11%" />
              </span>
            }
            value={metrics.lactose_pct}
            unit="%"
            warning={metrics.lactose_pct >= 11}
            tooltip="≥11% risk of crystallization - consider reducing MSNF or shifting to glucose syrup"
          />
          
          <MetricCard
            label={
              <span className="flex items-center gap-1">
                POD Index
                <GlossaryTooltip term="pod" brief="Protein Other than Dairy: balances total solids, fat, and protein" />
              </span>
            }
            sublabel="Sweetness Power"
            value={metrics.pod_index}
            target="100-120"
            tooltip="Normalized sweetness index (sucrose = 100 per 100g total sugars)"
          />
        </div>
      </div>

      <div>
        <h3 className="text-2xl font-bold mb-4">Protein & Freezing Point</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <MetricCard
            label={
              <span className="flex items-center gap-1">
                Protein
                <GlossaryTooltip term="protein" brief="Dairy protein - affects body and mouthfeel" />
              </span>
            }
            value={metrics.protein_pct}
            unit="%"
            target={mode === 'kulfi' ? '6-9' : undefined}
            warning={metrics.protein_pct >= 5 && mode === 'gelato'}
            status={mode === 'kulfi' ? getStatus(metrics.protein_pct, 6, 9) : undefined}
            tooltip={mode === 'gelato' 
              ? "≥5% risk of chewiness/sandiness - consider lowering MSNF" 
              : "Protein from MSNF (0.36 × MSNF%)"}
          />
          
          <MetricCard
            label={
              <span className="flex items-center gap-1">
                FPDT
                <GlossaryTooltip term="fpdt" brief="Freezing Point Depression Total: how much sugars lower the freezing point" />
              </span>
            }
            sublabel="Freezing Point"
            value={metrics.fpdt}
            unit="°C"
            target={mode === 'gelato' ? '2.5-3.5' : '2.0-2.5'}
            status={getStatus(
              metrics.fpdt,
              mode === 'gelato' ? 2.5 : 2.0,
              mode === 'gelato' ? 3.5 : 2.5
            )}
            tooltip="Total freezing point depression - controls texture hardness"
          />
          
          <MetricCard
            label="FPDSE"
            sublabel="From Sugars"
            value={metrics.fpdse}
            unit="°C"
            tooltip="Freezing point depression from sugars (Leighton table)"
          />
          
          <MetricCard
            label="FPDSA"
            sublabel="From Salts"
            value={metrics.fpdsa}
            unit="°C"
            tooltip="Freezing point depression from MSNF salts"
          />
        </div>
      </div>

      <div>
        <h3 className="text-2xl font-bold mb-4">Advanced Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <MetricCard
            label="SE (Sucrose Equiv.)"
            value={metrics.se_g}
            unit="g"
            tooltip="Total sucrose equivalents accounting for different sugar types"
          />
          
          <MetricCard
            label="Sucrose per 100g Water"
            value={metrics.sucrosePer100gWater}
            unit="g"
            tooltip="Used for Leighton table lookup"
          />
        </div>
      </div>
    </div>
  );
};
