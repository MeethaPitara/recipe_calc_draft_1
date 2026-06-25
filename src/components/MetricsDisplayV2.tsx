import { MetricsV2, Diagnosis, topDiagnosis } from "@/lib/calcApi";
import { MetricDiagnosisCard } from "./MetricDiagnosisCard";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { AlertTriangle } from "lucide-react";

interface MetricsDisplayV2Props {
  metrics: MetricsV2;
  mode: 'gelato' | 'kulfi' | 'ice_cream' | 'sorbet' | string;
  productKey?: string; // unused — kept so existing callers don't need updating
}

/**
 * PHASE 7.3: renders the backend's recipeDiagnosis.ts output instead of its
 * own hardcoded bands. Previously this component pulled target ranges from
 * src/lib/productConstraints.ts and wrote its own risk/cause/action text —
 * a THIRD band source contradicting both scienceConfig.ts and the FPDT
 * direction fixed in Phase 2 (this is what produced the mismatched "Target:
 * 16-19%" vs "16-22%" bug). Bands and diagnosis text now both come from the
 * same calc.v2 response (profileBands + diagnosis), so there's exactly one
 * source of truth rendered here.
 */
function findDiagnosis(diagnosis: Diagnosis[] | undefined, metric: string): Diagnosis | undefined {
  return diagnosis?.find(d => d.metric === metric);
}

export const MetricsDisplayV2 = ({ metrics }: MetricsDisplayV2Props) => {
  const bands = metrics.profileBands;
  const diagnosis = metrics.diagnosis;

  const fpdtD = findDiagnosis(diagnosis, 'FPDT (texture)');
  const tsD = findDiagnosis(diagnosis, 'Total solids');
  const fatD = findDiagnosis(diagnosis, 'Fat');
  const sugarD = findDiagnosis(diagnosis, 'Total sugars');
  const msnfD = findDiagnosis(diagnosis, 'MSNF');
  const lactoseD = findDiagnosis(diagnosis, 'Lactose');
  const proteinD = findDiagnosis(diagnosis, 'Protein');

  const top = topDiagnosis(diagnosis);

  return (
    <div className="space-y-6">
      {/* PHASE 7.3: the single most important issue, shown first. */}
      {top && (
        <Alert variant={top.severity === 'critical' ? 'destructive' : 'default'}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{top.problem}</AlertTitle>
          <AlertDescription>
            <p>{top.why}</p>
            {top.fix && <p className="mt-1 font-medium">{top.fix}</p>}
          </AlertDescription>
        </Alert>
      )}

      {/* PHASE 7.4: advisory only — no fix here is ever auto-applied. */}
      {diagnosis && diagnosis.some(d => d.severity !== 'ok') && (
        <p className="text-xs text-muted-foreground italic">
          These are suggestions, not automatic changes. Apply a fix to the ingredient grams yourself, then press Calculate to see the updated metrics.
        </p>
      )}

      {/* Basic Composition */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Basic Composition</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <MetricDiagnosisCard
            label="Fat"
            value={metrics.fat_pct}
            targetMin={bands?.fat[0]}
            targetMax={bands?.fat[1]}
            risk={fatD?.problem}
            cause={fatD?.why}
            action={fatD?.fix}
            tooltip="Contributes to richness and smooth texture"
          />

          <MetricDiagnosisCard
            label="MSNF"
            sublabel="Milk Solids Non-Fat"
            value={metrics.msnf_pct}
            targetMin={bands?.msnf[0]}
            targetMax={bands?.msnf[1]}
            risk={msnfD?.problem}
            cause={msnfD?.why}
            action={msnfD?.fix}
            tooltip="Protein + lactose + minerals from dairy. Too high → sandy; too low → thin."
          />

          <MetricDiagnosisCard
            label="Total Sugars"
            sublabel="incl. lactose"
            value={metrics.totalSugarsTotal_pct}
            targetMin={bands?.totalSugar[0]}
            targetMax={bands?.totalSugar[1]}
            risk={sugarD?.problem}
            cause={sugarD?.why}
            action={sugarD?.fix}
            tooltip="All sugars including lactose from MSNF"
          />

          <MetricDiagnosisCard
            label="Total Solids"
            value={metrics.ts_pct}
            targetMin={bands?.totalSolids[0]}
            targetMax={bands?.totalSolids[1]}
            risk={tsD?.problem}
            cause={tsD?.why}
            action={tsD?.fix}
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
            targetMax={bands?.lactoseRiskMaxPct}
            risk={lactoseD?.problem}
            cause={lactoseD?.why}
            action={lactoseD?.fix}
            tooltip="Milk sugar — crystallisation risk above the profile's threshold"
          />

          <MetricDiagnosisCard
            label="POD Index"
            sublabel="Sweetness Power"
            value={metrics.pod_index}
            tooltip="Normalised sweetness index — sucrose = 100 per 100g total sugars. Informational only; not validated against a target band."
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
            targetMin={0}
            targetMax={bands?.proteinRiskMaxPct}
            risk={proteinD?.problem}
            cause={proteinD?.why}
            action={proteinD?.fix}
            tooltip="Derived from MSNF. Risk threshold depends on product type — kulfi expects higher protein by design."
          />

          <MetricDiagnosisCard
            label="FPDT"
            sublabel="Freezing Point Depression"
            value={metrics.fpdt}
            unit="°C"
            targetMin={bands?.fpdt[0]}
            targetMax={bands?.fpdt[1]}
            risk={fpdtD?.problem}
            cause={fpdtD?.why}
            action={fpdtD?.fix}
            tooltip="Total freezing point depression — controls hardness at serving temperature. Low = hard/icy, high = soft/fast-melt."
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
