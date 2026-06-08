import { Card } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Legend } from "recharts";
import { useState, useEffect } from "react";
import { fetchThermoMetrics, type ThermoMetricsResult } from "@/services/metricsService";
import { showApiErrorToast } from "@/lib/ui/errors";
import { Badge } from "@/components/ui/badge";
import { MetricDiagnosisCard } from "@/components/MetricDiagnosisCard";
import { diagnoseMetrics } from "@/lib/diagnosis/metricRules";

export default function ScienceMetricsPanel({
  podIndex, fpdt, mode,
  sugars: { sucrose_g, dextrose_g, fructose_g, lactose_g },
  composition: { waterPct, fatPct, msnfPct, sugarsPct, otherPct },
  rows = [],
  serveTempC = -12
}: {
  podIndex: number; fpdt: number; mode:"gelato"|"kulfi";
  sugars:{sucrose_g:number; dextrose_g:number; fructose_g:number; lactose_g:number};
  composition:{waterPct:number; fatPct:number; msnfPct:number; sugarsPct:number; otherPct:number};
  rows?: Array<{ ing_id: string; grams: number }>;
  serveTempC?: number;
}) {
  const [thermoMetrics, setThermoMetrics] = useState<ThermoMetricsResult | null>(null);
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  // Track screen width for responsive chart labels
  useEffect(() => {
    const checkWidth = () => {
      setIsSmallScreen(window.innerWidth < 360);
    };
    
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  useEffect(() => {
    if (rows.length === 0) return;
    
    const loadThermoMetrics = async () => {
      try {
        const result = await fetchThermoMetrics({ rows, mode, serveTempC });
        setThermoMetrics(result);
      } catch (error) {
        console.error('Failed to fetch thermo metrics:', error);
        showApiErrorToast(error, "Thermo Metrics Failed");
      }
    };

    loadThermoMetrics();
  }, [rows, mode, serveTempC]);

  const podVal = Math.max(0, Math.min(150, Math.round(podIndex)));
  
  const sugarData = [
    { name:"Sucrose", value:sucrose_g, fill:"hsl(var(--chart-1))" },
    { name:"Dextrose", value:dextrose_g, fill:"hsl(var(--chart-2))" },
    { name:"Fructose", value:fructose_g, fill:"hsl(var(--chart-3))" },
    { name:"Lactose", value:lactose_g, fill:"hsl(var(--chart-4))" }
  ];
  
  const compData = [{ name:"Mix", Water:waterPct, Fat:fatPct, MSNF:msnfPct, Sugars:sugarsPct, Other:otherPct }];
  
  const sugarChartConfig = {
    sucrose: { label: "Sucrose", color: "hsl(var(--chart-1))" },
    dextrose: { label: "Dextrose", color: "hsl(var(--chart-2))" },
    fructose: { label: "Fructose", color: "hsl(var(--chart-3))" },
    lactose: { label: "Lactose", color: "hsl(var(--chart-4))" },
  };
  
  const compChartConfig = {
    water: { label: "Water", color: "hsl(var(--chart-1))" },
    fat: { label: "Fat", color: "hsl(var(--chart-2))" },
    msnf: { label: "MSNF", color: "hsl(var(--chart-3))" },
    sugars: { label: "Sugars", color: "hsl(var(--chart-4))" },
    other: { label: "Other", color: "hsl(var(--chart-5))" },
  };

  const waterFrozenVal = thermoMetrics ? thermoMetrics.base.waterFrozenPct : NaN;
  const fpdtVal = thermoMetrics ? thermoMetrics.base.FPDT : fpdt;

  const diagnoses = diagnoseMetrics({
    podIndex: podVal,
    fpdt: fpdtVal,
    waterFrozenPct: waterFrozenVal,
    fatPct,
    msnfPct,
    sugarsPct,
    otherPct,
    mode
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {diagnoses.map((d) => (
        <MetricDiagnosisCard key={d.label} {...d} />
      ))}

      <Card className="p-4 lg:col-span-1">
        <div className="text-sm font-medium mb-4">Sugar Spectrum (grams)</div>
        <div className="min-h-[140px]">
          <ChartContainer config={sugarChartConfig} className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={sugarData} 
                  dataKey="value" 
                  nameKey="name" 
                  cx="50%" 
                  cy="50%" 
                  outerRadius={isSmallScreen ? 50 : 70}
                  label={!isSmallScreen && (({ name, value }) => value > 0 ? `${name}: ${value.toFixed(0)}g` : '')}
                  labelLine={!isSmallScreen}
                >
                  {sugarData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
                {!isSmallScreen && <Legend />}
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
        {isSmallScreen && (
          <div className="flex flex-wrap gap-2 mt-3">
            {sugarData.filter(s => s.value > 0).map((sugar) => (
              <Badge key={sugar.name} variant="secondary" className="text-xs">
                {sugar.name}: {sugar.value.toFixed(0)}g
              </Badge>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4 lg:col-span-2">
        <div className="text-sm font-medium mb-4">Mix Composition (%)</div>
        <div className="min-h-[140px]">
          <ChartContainer config={compChartConfig} className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={compData} layout="vertical">
                <XAxis type="number" domain={[0, 100]} />
                <YAxis type="category" dataKey="name" hide />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="Water" stackId="a" fill="hsl(var(--chart-1))" radius={[4, 0, 0, 4]} />
                <Bar dataKey="Fat" stackId="a" fill="hsl(var(--chart-2))" />
                <Bar dataKey="MSNF" stackId="a" fill="hsl(var(--chart-3))" />
                <Bar dataKey="Sugars" stackId="a" fill="hsl(var(--chart-4))" />
                <Bar dataKey="Other" stackId="a" fill="hsl(var(--chart-5))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {isSmallScreen ? (
            <>
              <Badge variant="secondary" className="text-xs">W: {waterPct.toFixed(1)}%</Badge>
              <Badge variant="secondary" className="text-xs">F: {fatPct.toFixed(1)}%</Badge>
              <Badge variant="secondary" className="text-xs">M: {msnfPct.toFixed(1)}%</Badge>
              <Badge variant="secondary" className="text-xs">S: {sugarsPct.toFixed(1)}%</Badge>
              <Badge variant="secondary" className="text-xs">O: {otherPct.toFixed(1)}%</Badge>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1 text-xs">
                <div className="w-3 h-3 rounded-sm bg-chart-1" />
                <span>Water: {waterPct.toFixed(1)}%</span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <div className="w-3 h-3 rounded-sm bg-chart-2" />
                <span>Fat: {fatPct.toFixed(1)}%</span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <div className="w-3 h-3 rounded-sm bg-chart-3" />
                <span>MSNF: {msnfPct.toFixed(1)}%</span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <div className="w-3 h-3 rounded-sm bg-chart-4" />
                <span>Sugars: {sugarsPct.toFixed(1)}%</span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <div className="w-3 h-3 rounded-sm bg-chart-5" />
                <span>Other: {otherPct.toFixed(1)}%</span>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

