import { MetricDiagnosis } from "@/components/MetricDiagnosisCard";

export interface DiagnosticInput {
  podIndex: number;
  fpdt: number;
  waterFrozenPct: number;
  fatPct: number;
  msnfPct: number;
  sugarsPct: number;
  otherPct: number;
  mode: "gelato" | "kulfi";
}

export function diagnoseMetrics(input: DiagnosticInput): MetricDiagnosis[] {
  const {
    podIndex,
    fpdt,
    waterFrozenPct,
    fatPct,
    msnfPct,
    sugarsPct,
    otherPct,
    mode,
  } = input;

  const totalSolids = fatPct + msnfPct + sugarsPct + otherPct;
  const diagnoses: MetricDiagnosis[] = [];

  // Total Solids
  const solidsMin = mode === "gelato" ? 36 : 38;
  const solidsMax = mode === "gelato" ? 45 : 42;
  diagnoses.push({
    label: "Total Solids",
    value: totalSolids,
    targetMin: solidsMin,
    targetMax: solidsMax,
    risk: totalSolids < solidsMin ? "Icy texture, melts too fast" : totalSolids > solidsMax ? "Sandy or overly heavy/pasty texture" : undefined,
    action: totalSolids < solidsMin ? "Increase base solids (sugars, fats, MSNF)" : totalSolids > solidsMax ? "Add water or milk to dilute the solids" : undefined,
  });

  // Fat
  const fatMin = mode === "gelato" ? 6 : 10;
  const fatMax = mode === "gelato" ? 9 : 12;
  diagnoses.push({
    label: "Fat",
    value: fatPct,
    targetMin: fatMin,
    targetMax: fatMax,
    risk: fatPct < fatMin ? "Lacks creaminess, cold mouthfeel" : fatPct > fatMax ? "Buttery texture, coats the palate heavily" : undefined,
    action: fatPct < fatMin ? "Add cream or butter" : fatPct > fatMax ? "Reduce high-fat dairy or fats" : undefined,
  });

  // MSNF
  const msnfMin = mode === "gelato" ? 10 : 18;
  const msnfMax = mode === "gelato" ? 12 : 25;
  diagnoses.push({
    label: "MSNF",
    sublabel: "Milk Solids Non-Fat",
    value: msnfPct,
    targetMin: msnfMin,
    targetMax: msnfMax,
    risk: msnfPct < msnfMin ? "Weak body, lacks milk flavor" : msnfPct > msnfMax ? "High risk of sandiness (lactose crystallization)" : undefined,
    action: msnfPct < msnfMin ? "Add skim milk powder (SMP)" : msnfPct > msnfMax ? "Reduce SMP or substitute with alternative solids" : undefined,
  });

  // Sugars
  const sugarsMin = mode === "gelato" ? 16 : 18;
  const sugarsMax = mode === "gelato" ? 22 : 22;
  diagnoses.push({
    label: "Total Sugars",
    value: sugarsPct,
    targetMin: sugarsMin,
    targetMax: sugarsMax,
    risk: sugarsPct < sugarsMin ? "Hard texture, lacks sweetness" : sugarsPct > sugarsMax ? "Too soft, overly sweet, high freezing point depression" : undefined,
    action: sugarsPct < sugarsMin ? "Add sugars or syrups" : sugarsPct > sugarsMax ? "Reduce total sugars, use lower DE syrups if needed" : undefined,
  });

  // POD
  const podMin = 80;
  const podMax = 120;
  diagnoses.push({
    label: "POD",
    sublabel: "Sweetness Index (Sucrose = 100)",
    value: podIndex,
    unit: "",
    targetMin: podMin,
    targetMax: podMax,
    risk: podIndex < podMin ? "Not sweet enough for standard palate" : podIndex > podMax ? "Cloyingly sweet, masks other flavors" : undefined,
    action: podIndex < podMin ? "Replace low-sweetness sugars with sucrose or dextrose" : podIndex > podMax ? "Use lower sweetness sugars like maltodextrin or lower DE glucose" : undefined,
  });

  // FPDT
  const fpdtMin = mode === "gelato" ? 2.5 : 2.0;
  const fpdtMax = mode === "gelato" ? 3.5 : 2.5;
  diagnoses.push({
    label: "FPDT",
    sublabel: "Freezing Point Depression",
    value: fpdt,
    unit: "°C",
    targetMin: fpdtMin,
    targetMax: fpdtMax,
    risk: fpdt < fpdtMin ? "Product will be too hard at serving temperature" : fpdt > fpdtMax ? "Product will be too soft and melt quickly in display case" : undefined,
    action: fpdt < fpdtMin ? "Increase sugars with high AFP (Dextrose, Fructose)" : fpdt > fpdtMax ? "Decrease sugars with high AFP, replace with Sucrose or Maltodextrin" : undefined,
  });

  // Water Frozen
  const waterFrozenMin = 65;
  const waterFrozenMax = 75;
  if (!isNaN(waterFrozenPct) && isFinite(waterFrozenPct)) {
    diagnoses.push({
      label: "Water Frozen @ Serve Temp",
      value: waterFrozenPct,
      targetMin: waterFrozenMin,
      targetMax: waterFrozenMax,
      risk: waterFrozenPct < waterFrozenMin ? "Too soft, structural collapse, too much antifreeze" : waterFrozenPct > waterFrozenMax ? "Too hard/icy, lacks scoopability" : undefined,
      action: waterFrozenPct < waterFrozenMin ? "Reduce FPDT by using less antifreeze sugars" : waterFrozenPct > waterFrozenMax ? "Increase FPDT by adding antifreeze sugars (Dextrose)" : undefined,
    });
  }

  return diagnoses;
}
