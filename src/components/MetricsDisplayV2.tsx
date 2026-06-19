import { MetricsV2 } from "@/lib/calcApi";
import { MetricDiagnosisCard } from "./MetricDiagnosisCard";
import { GlossaryTooltip } from "./GlossaryTooltip";
import { PRODUCT_CONSTRAINTS } from "@/lib/productConstraints";

interface MetricsDisplayV2Props {
  metrics: MetricsV2;
  mode: 'gelato' | 'kulfi' | 'ice_cream' | 'sorbet' | string;
  productKey?: string; // e.g. 'gelato_white', 'gelato_finished', 'gelato_fruit'
}

function r(v: [number, number]): { min: number; max: number } {
  return { min: v[0], max: v[1] };
}

export const MetricsDisplayV2 = ({ metrics, mode, productKey }: MetricsDisplayV2Props) => {
  // Pick the right constraint set — prefer productKey override
  const key = productKey || (mode === 'gelato' ? 'gelato_white' : mode) || 'gelato_white';
  const c = PRODUCT_CONSTRAINTS[key] || PRODUCT_CONSTRAINTS['gelato_white'];

  const fat = r(c.fat.optimal);
  const msnf = r(c.msnf.optimal);
  const sugar = r(c.totalSugars.optimal);
  const ts = r(c.totalSolids.optimal);
  const fpdt = c.fpdt ? r(c.fpdt.optimal) : undefined;

  return (
    <div className="space-y-6">
      {/* Basic Composition */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Basic Composition</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <MetricDiagnosisCard
            label="Fat"
            value={metrics.fat_pct}
            targetMin={fat.min}
            targetMax={fat.max}
            risk="Thin body, less creamy mouthfeel"
            cause="Insufficient cream or butter"
            action="Increase cream content or add butter"
            tooltip="Contributes to richness and smooth texture"
          />

          <MetricDiagnosisCard
            label="MSNF"
            sublabel="Milk Solids Non-Fat"
            value={metrics.msnf_pct}
            targetMin={msnf.min}
            targetMax={msnf.max}
            risk={metrics.msnf_pct > msnf.max ? "Sandiness / lactose crystallisation" : "Thin body, poor structure"}
            cause={metrics.msnf_pct > msnf.max ? "SMP quantity too high" : "Insufficient milk or SMP"}
            action={metrics.msnf_pct > msnf.max ? "Reduce SMP or replace part with milk/cream" : "Add SMP or increase milk content"}
            tooltip="Protein + lactose + minerals from dairy. Too high → sandy; too low → thin."
          />

          <MetricDiagnosisCard
            label="Total Sugars"
            sublabel="incl. lactose"
            value={metrics.totalSugars_pct}
            targetMin={sugar.min}
            targetMax={sugar.max}
            risk={metrics.totalSugars_pct > sugar.max ? "Too sweet, icy after freezing" : "Not sweet enough, very hard texture"}
            cause={metrics.totalSugars_pct > sugar.max ? "Added sugars or high MSNF lactose" : "Insufficient added sugars"}
            action={metrics.totalSugars_pct > sugar.max ? "Reduce sucrose or dextrose" : "Add sucrose or dextrose"}
            tooltip="All sugars including lactose from MSNF"
          />

          <MetricDiagnosisCard
            label="Total Solids"
            value={metrics.ts_pct}
            targetMin={ts.min}
            targetMax={ts.max}
            risk={metrics.ts_pct > ts.max ? "Heavy, gummy texture" : "Icy, watery product"}
            cause={metrics.ts_pct > ts.max ? "Excess dry ingredients across fat/sugar/MSNF" : "Low fat, sugar or MSNF"}
            action={metrics.ts_pct > ts.max ? "Reduce SMP or sugars" : "Increase fat or MSNF source"}
            tooltip="Total dry matter — target depends on product type"
          />
        </div>
      </div>

      {/* Sugar Detail */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Sugar Analysis</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <MetricDiagnosisCard
            label="Non-Lactose Sugars"
            value={metrics.nonLactoseSugars_pct}
            tooltip="Added sugars only — sucrose, dextrose, glucose syrup, fructose"
          />

          <MetricDiagnosisCard
            label="Lactose"
            value={metrics.lactose_pct}
            targetMin={0}
            targetMax={11}
            risk="Lactose crystallisation (sandiness)"
            cause="High MSNF or SMP dosage"
            action="Reduce SMP, replace with cream; or add 0.02% lactase enzyme"
            tooltip="Milk sugar — ≥11% risk of crystallisation"
          />

          <MetricDiagnosisCard
            label="POD Index"
            sublabel="Sweetness Power"
            value={metrics.pod_index}
            targetMin={90}
            targetMax={130}
            risk={metrics.pod_index > 130 ? "Overly sweet, masks flavour" : "Flat, muted sweetness"}
            cause={metrics.pod_index > 130 ? "High fructose or invert sugar ratio" : "Low sugar dosage overall"}
            action={metrics.pod_index > 130 ? "Replace some fructose with dextrose or sucrose" : "Increase sucrose or dextrose"}
            tooltip="Normalised sweetness index — sucrose = 100 per 100g total sugars"
          />
        </div>
      </div>

      {/* Freezing Point */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Protein & Freezing Point</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <MetricDiagnosisCard
            label="Protein"
            value={metrics.protein_pct}
            targetMin={mode === 'kulfi' ? 6 : undefined}
            targetMax={mode === 'kulfi' ? 9 : mode === 'gelato' ? 5 : undefined}
            risk={metrics.protein_pct >= 5 && mode !== 'kulfi' ? "Chewiness / sandiness risk" : undefined}
            cause={metrics.protein_pct >= 5 ? "High MSNF content" : undefined}
            action={metrics.protein_pct >= 5 && mode !== 'kulfi' ? "Reduce SMP or total MSNF" : undefined}
            tooltip="Derived from MSNF (0.36 × MSNF%). ≥5% in gelato risks chewy texture."
          />

          <MetricDiagnosisCard
            label="FPDT"
            sublabel="Freezing Point Depression"
            value={metrics.fpdt}
            unit="°C"
            targetMin={fpdt?.min}
            targetMax={fpdt?.max}
            risk={fpdt && metrics.fpdt < fpdt.min ? "Too hard — difficult to scoop at serving temperature" : fpdt && metrics.fpdt > fpdt.max ? "Too soft — melts quickly, icy after refreeze" : undefined}
            cause={fpdt && metrics.fpdt < fpdt.min ? "Low total sugars or high MSNF" : "High total sugars or low MSNF"}
            action={fpdt && metrics.fpdt < fpdt.min ? "Increase dextrose — it has higher PAC than sucrose" : "Replace some dextrose with sucrose; reduce total sugars"}
            tooltip="Total freezing point depression — controls hardness at serving temperature"
          />

          <MetricDiagnosisCard
            label="FPDSE"
            sublabel="From Sugars"
            value={metrics.fpdse}
            unit="°C"
            tooltip="Freezing point depression from sugars (Leighton table)"
          />

          <MetricDiagnosisCard
            label="FPDSA"
            sublabel="From Salts"
            value={metrics.fpdsa}
            unit="°C"
            tooltip="Freezing point depression from MSNF salts"
          />
        </div>
      </div>

      {/* Advanced */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Advanced Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <MetricDiagnosisCard
            label="SE (Sucrose Equiv.)"
            value={metrics.se_g}
            unit="g"
            tooltip="Total sucrose equivalents accounting for different sugar types"
          />

          <MetricDiagnosisCard
            label="Sucrose per 100g Water"
            value={metrics.sucrosePer100gWater}
            unit="g"
            tooltip="Used for Leighton table lookup — affects FPDT accuracy"
          />

          <MetricDiagnosisCard
            label="Water"
            value={metrics.water_pct}
            tooltip="Water content — drives ice crystal formation"
          />
        </div>
      </div>
    </div>
  );
};
