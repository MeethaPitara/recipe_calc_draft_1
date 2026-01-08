import { Card } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ResponsiveContainer, RadialBarChart, RadialBar, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Legend } from "recharts";
import { useState, useEffect } from "react";
import { fetchThermoMetrics, type ThermoMetricsResult } from "@/services/metricsService";
import { Loader2 } from "lucide-react";
import { showApiErrorToast } from "@/lib/ui/errors";
import { safeDivide, clamp } from "@/lib/math";
import { Badge } from "@/components/ui/badge";

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
  const [isLoadingThermo, setIsLoadingThermo] = useState(false);
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
        setIsLoadingThermo(true);
        const result = await fetchThermoMetrics({ rows, mode, serveTempC });
        setThermoMetrics(result);
      } catch (error) {
        console.error('Failed to fetch thermo metrics:', error);
        showApiErrorToast(error, "Thermo Metrics Failed");
      } finally {
        setIsLoadingThermo(false);
      }
    };

    loadThermoMetrics();
  }, [rows, mode, serveTempC]);
  const podVal = Math.max(0, Math.min(150, Math.round(podIndex)));
  const [lo, hi] = mode==="gelato"? [2.5,3.5] : [2.0,2.5];
  
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

  const TargetBar = ({ label, value, min, max }:{label:string; value:number; min:number; max:number}) => {
    const safeValue = isFinite(value) ? value : 0;
    const ok = safeValue >= min && safeValue <= max;
    const width = clamp(safeValue, 0, 100);
    
    return (
      <div className="mb-2">
        <div className="flex justify-between text-xs mb-1">
          <span>{label}</span><span>{safeValue.toFixed(1)}% (target {min}–{max}%)</span>
        </div>
        <div className="h-2 bg-muted rounded overflow-hidden">
          <div className={`h-2 ${ok?'bg-success':'bg-warning'}`} style={{ width: `${width}%` }} />
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <Card className="p-4">
        <div className="text-sm font-medium mb-2">POD Index</div>
        <div className="text-xs text-muted-foreground mb-3">per 100g sugars</div>
        <div className="min-h-[140px]">
          <ChartContainer config={{ pod: { label: "POD", color: "hsl(var(--primary))" } }} className="h-[140px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart 
                innerRadius="60%" 
                outerRadius="90%" 
                data={[{ name:'POD', value: podVal, fill: podVal >= 80 && podVal <= 120 ? "hsl(var(--success))" : "hsl(var(--warning))" }]}
                startAngle={180}
                endAngle={0}
              >
                <RadialBar 
                  dataKey="value" 
                  cornerRadius={10}
                  background={{ fill: "hsl(var(--muted))" }}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
              </RadialBarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
        <div className="text-center mt-2">
          <div className="text-2xl font-bold">{podVal}</div>
          <div className="text-xs text-muted-foreground mt-1">
            Ideal: 80–120 | Sucrose baseline: 100
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="text-sm font-medium mb-2">Freezing Point Depression (FPDT)</div>
        {isLoadingThermo ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : thermoMetrics ? (
          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <div>
                <div className="text-xs text-muted-foreground">Base FPDT</div>
                <div className="text-2xl font-bold">{thermoMetrics.base.FPDT.toFixed(2)}°C</div>
              </div>
              {thermoMetrics.adjusted.hardeningEffect > 0 && (
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Adjusted</div>
                  <div className="text-lg font-semibold text-primary">{thermoMetrics.adjusted.FPDT.toFixed(2)}°C</div>
                </div>
              )}
            </div>
            
            {/* Thermometer visualization */}
            <div className="relative h-4 rounded-full bg-gradient-to-r from-blue-200 via-blue-300 to-blue-400 overflow-hidden border border-border">
              {/* Ideal range indicator */}
              <div 
                className="absolute top-0 h-full bg-success/30 border-x-2 border-success"
                style={{ 
                  left: `${clamp(safeDivide((lo - 1.0), 3.5) * 100, 0, 100)}%`,
                  width: `${clamp(safeDivide((hi - lo), 3.5) * 100, 0, 100)}%`
                }}
              />
              {/* Current value marker */}
              <div 
                className="absolute top-0 h-full w-1 bg-foreground"
                style={{ left: `${clamp(safeDivide((thermoMetrics.base.FPDT - 1.0), 3.5) * 100, 0, 100)}%` }}
              />
            </div>
            
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1.0°C</span>
              <span className="text-success font-medium">Target: {lo}–{hi}°C</span>
              <span>4.5°C</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            Add ingredients to calculate
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="text-sm font-medium mb-2">Water Frozen @ {serveTempC}°C</div>
        {isLoadingThermo ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : thermoMetrics ? (
          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <div>
                <div className="text-xs text-muted-foreground">Base</div>
                <div className="text-2xl font-bold">{thermoMetrics.base.waterFrozenPct.toFixed(1)}%</div>
              </div>
              {thermoMetrics.adjusted.hardeningEffect > 0 && (
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Adjusted</div>
                  <div className="text-lg font-semibold text-primary">{thermoMetrics.adjusted.waterFrozenPct.toFixed(1)}%</div>
                </div>
              )}
            </div>
            
            {/* Progress bar visualization */}
            <div className="relative h-4 rounded-full bg-muted overflow-hidden border border-border">
              <div 
                className={`h-full transition-all ${
                  thermoMetrics.base.waterFrozenPct >= 65 && thermoMetrics.base.waterFrozenPct <= 75 
                    ? 'bg-success' 
                    : 'bg-primary'
                }`}
                style={{ width: `${thermoMetrics.base.waterFrozenPct}%` }} 
              />
            </div>
            
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">0%</span>
              <span className="text-success font-medium">Ideal: 65-75%</span>
              <span className="text-muted-foreground">100%</span>
            </div>
            
            {thermoMetrics.adjusted.hardeningEffect > 0 && (
              <div className="text-xs text-muted-foreground pt-1 border-t">
                Hardening effect: +{thermoMetrics.adjusted.hardeningEffect.toFixed(2)}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            Add ingredients to calculate
          </div>
        )}
      </Card>

      <Card className="p-4">
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

      <Card className="p-4">
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

      <Card className="p-3">
        <div className="text-sm font-medium mb-2">Targets</div>
        <TargetBar label="Total Solids" value={sugarsPct+fatPct+msnfPct+otherPct} min={mode==='gelato'?36:38} max={mode==='gelato'?45:42} />
        <TargetBar label="Fat" value={fatPct} min={mode==='gelato'?6:10} max={mode==='gelato'?9:12} />
        <TargetBar label="MSNF" value={msnfPct} min={mode==='gelato'?10:18} max={mode==='gelato'?12:25} />
        <TargetBar label="Total Sugars" value={sugarsPct} min={mode==='gelato'?16:18} max={mode==='gelato'?22:22} />
      </Card>
    </div>
  );
}
