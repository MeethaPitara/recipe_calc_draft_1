import React, { useState, useEffect } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    BarChart,
    Bar,
    Cell,
    XAxis as RechartsXAxis,
    YAxis as RechartsYAxis,
    Cell as RechartsCell
} from 'recharts';
import { getFreezingCurve, recommendServeTemp, getScoopableRange, estimateFrozenWater } from '@/lib/scoopability';
import { Card, CardContent } from '@/components/ui/card';
import { ServingContext, SERVING_CONTEXT, FPDT_TARGETS, TEMP_ZONES, AFP_TARGETS } from '@/lib/constants/tempTargets';
import { cn } from '@/lib/utils';

interface TemperatureGraphsProps {
    metrics: any;
    servingContext: ServingContext;
    flavorCategory: string;
}

export default function TemperatureGraphs({ metrics, servingContext, flavorCategory }: TemperatureGraphsProps) {
    const ctx = SERVING_CONTEXT[servingContext];
    const targets = FPDT_TARGETS[servingContext][flavorCategory] || FPDT_TARGETS[servingContext]['dairy'];
    const afpTargets = AFP_TARGETS[flavorCategory] || AFP_TARGETS['dairy'];

    const [curveData, setCurveData] = useState<{ temperature: number; frozenPct: number }[]>([]);
    const [serveTemp, setServeTemp] = useState<number>(-12);
    const [scoopRange, setScoopRange] = useState<{ min: number; max: number }>({ min: -18, max: -10 });
    const [frozenAtRef, setFrozenAtRef] = useState<number>(0);

    useEffect(() => {
        if (!metrics) return;
        // Fetch all scoopability data from backend
        getFreezingCurve(metrics, servingContext)
            .then(curve => setCurveData(curve.map(p => ({ temperature: p.tempC, frozenPct: p.frozenPct }))))
            .catch(err => console.error('Freezing curve error:', err));
        recommendServeTemp(metrics, servingContext)
            .then(setServeTemp)
            .catch(err => console.error('Serve temp error:', err));
        getScoopableRange(metrics, servingContext)
            .then(setScoopRange)
            .catch(err => console.error('Scoop range error:', err));
        estimateFrozenWater(metrics, ctx.referenceTemp)
            .then(setFrozenAtRef)
            .catch(err => console.error('Frozen water error:', err));
    }, [metrics, servingContext]);

    // Graph 1: FPDT Breakdown Data
    const fpdtData = [
        {
            name: 'FPDT',
            Sugars: metrics.fpdse,
            Salts: metrics.fpdsa,
            total: metrics.fpdt
        }
    ];

    const getFpdtZoneColor = (val: number) => {
        if (val >= targets.min && val <= targets.max) return 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400';
        if (val >= targets.min - 0.5 && val <= targets.max + 0.5) return 'bg-amber-500/20 text-amber-600 dark:text-amber-400';
        return 'bg-rose-500/20 text-rose-600 dark:text-rose-400';
    };

    // Graph 3: Ruler Zones
    const zones = TEMP_ZONES[servingContext];
    const rulerRange = [-45, -5];
    const totalRulerWidth = rulerRange[1] - rulerRange[0];

    const getPos = (temp: number) => {
        return ((temp - rulerRange[0]) / totalRulerWidth) * 100;
    };

    return (
        <div className="space-y-8">
            {/* AFP Index Card */}
            <Card className="bg-muted/30 border-none shadow-none">
                <CardContent className="p-4 flex justify-between items-center">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">AFP Index</p>
                        <p className="text-3xl font-bold">{metrics.afp_index.toFixed(1)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] text-muted-foreground mb-1">Target ({flavorCategory}): {afpTargets.min}–{afpTargets.max}</p>
                        <div className={cn("px-2 py-1 rounded text-xs font-bold",
                            metrics.afp_index >= afpTargets.min && metrics.afp_index <= afpTargets.max ? "bg-emerald-500/20 text-emerald-600" :
                                Math.abs(metrics.afp_index - (afpTargets.min + afpTargets.max) / 2) < 5 ? "bg-amber-500/20 text-amber-600" : "bg-rose-500/20 text-rose-600"
                        )}>
                            {metrics.afp_index >= afpTargets.min && metrics.afp_index <= afpTargets.max ? "✅ IN RANGE" : "⚠️ ADJUST"}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Graph 1: FPDT Breakdown */}
            <div className="space-y-3">
                <h5 className="text-sm font-bold flex justify-between">
                    FPDT Breakdown
                    <span className="text-muted-foreground font-normal text-xs">Unit: °C</span>
                </h5>
                <div className="h-16 w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            layout="vertical"
                            data={fpdtData}
                            margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                        >
                            <XAxis type="number" hide domain={[0, Math.max(metrics.fpdt * 1.2, 5)]} />
                            <YAxis type="category" dataKey="name" hide />
                            <Tooltip
                                cursor={{ fill: 'transparent' }}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        return (
                                            <div className="bg-background border rounded p-2 shadow-sm text-xs">
                                                <p>Sugars: {Number(payload[0].value).toFixed(2)}°C</p>
                                                <p>MSNF Salts: {Number(payload[1].value).toFixed(2)}°C</p>
                                                <p className="font-bold border-t mt-1 pt-1">Total: {metrics.fpdt.toFixed(2)}°C</p>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Bar dataKey="Sugars" stackId="a" fill="#3b82f6" radius={[4, 0, 0, 4]} />
                            <Bar dataKey="Salts" stackId="a" fill="#10b981" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>

                    {/* Target Zone Indicator in Background */}
                    <div
                        className="absolute top-1/2 -translate-y-1/2 h-8 bg-emerald-500/10 pointer-events-none rounded"
                        style={{
                            left: `${(targets.min / Math.max(metrics.fpdt * 1.2, 5)) * 100}%`,
                            width: `${((targets.max - targets.min) / Math.max(metrics.fpdt * 1.2, 5)) * 100}%`
                        }}
                    />
                </div>
                <div className="flex justify-between items-center text-[11px]">
                    <div className="flex gap-4">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Sugars: {metrics.fpdse.toFixed(2)}°C</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> MSNF Salts: {metrics.fpdsa.toFixed(2)}°C</span>
                    </div>
                    <div className={cn("px-2 py-0.5 rounded font-bold", getFpdtZoneColor(metrics.fpdt))}>
                        Target ({flavorCategory}): {targets.min}–{targets.max}°C
                    </div>
                </div>
            </div>

            {/* Graph 2: Scoopable Curve */}
            <div className="space-y-3">
                <h5 className="text-sm font-bold">Freezing Curve & Scoopability</h5>
                <div className="h-[240px] w-full bg-muted/10 rounded-lg p-2 border border-muted/20 relative">
                    {/* Custom Background Zones */}
                    <div className="absolute inset-0 flex flex-col pointer-events-none p-2 ml-[45px] mb-[30px]">
                        <div className="flex-1 bg-rose-500/5" style={{ height: `${100 - ctx.frozenZone_red_firm}%` }} />
                        <div className="flex-1 bg-amber-500/5" style={{ height: `${ctx.frozenZone_red_firm - ctx.frozenZone_green[1]}%` }} />
                        <div className="bg-emerald-500/10" style={{ height: `${ctx.frozenZone_green[1] - ctx.frozenZone_green[0]}%` }} />
                        <div className="flex-1 bg-amber-500/5" style={{ height: `${ctx.frozenZone_green[0] - ctx.frozenZone_red_soft}%` }} />
                        <div className="flex-1 bg-rose-500/5" style={{ height: `${ctx.frozenZone_red_soft}%` }} />
                    </div>

                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={curveData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                            <XAxis
                                dataKey="temperature"
                                unit="°C"
                                reversed
                                fontSize={10}
                                tick={{ fontSize: 10 }}
                            />
                            <YAxis
                                unit="%"
                                domain={[0, 100]}
                                fontSize={10}
                                tick={{ fontSize: 10 }}
                            />
                            <Tooltip
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const temp = payload[0].payload.temperature;
                                        const frozen = Number(payload[0].value);
                                        let label = "Rock hard";
                                        let color = "text-rose-500";

                                        if (frozen < ctx.frozenZone_red_soft) { label = "Soupy/Too soft"; color = "text-rose-500"; }
                                        else if (frozen < ctx.frozenZone_green[0]) { label = "Soft/Melting"; color = "text-amber-500"; }
                                        else if (frozen <= ctx.frozenZone_green[1]) { label = "Ideal Scoopability"; color = "text-emerald-500"; }
                                        else if (frozen <= ctx.frozenZone_red_firm) { label = "Firm/Hard"; color = "text-amber-500"; }

                                        return (
                                            <div className="bg-background border rounded-lg p-3 shadow-xl text-xs z-50 min-w-[140px]">
                                                <p className="font-bold mb-1">{temp}°C</p>
                                                <p>Frozen Water: <span className="font-bold">{frozen.toFixed(1)}%</span></p>
                                                <p className={cn("font-bold mt-1", color)}>{label}</p>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Line
                                type="monotone"
                                dataKey="frozenPct"
                                stroke="#3b82f6"
                                strokeWidth={3}
                                dot={false}
                                activeDot={{ r: 6, fill: "#3b82f6", stroke: "#fff" }}
                            />

                            {/* Reference Lines */}
                            <ReferenceLine x={ctx.referenceTemp} stroke="#64748b" strokeDasharray="5 5" label={{ value: ctx.label, position: 'insideTopLeft', fontSize: 9, fill: "#64748b" }} />
                            <ReferenceLine x={serveTemp} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'Ideal Serve', position: 'insideBottomRight', fontSize: 9, fill: "#10b981" }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Graph 3: Temperature Ruler */}
            <div className="space-y-4">
                <h5 className="text-sm font-bold">Operation Zones (Horizontal Ruler)</h5>
                <div className="relative h-20 w-full select-none pt-8">
                    {/* Static Background Ruler */}
                    <div className="absolute inset-x-0 h-4 bg-muted/30 rounded-full overflow-hidden flex">
                        {zones.map((zone, idx) => {
                            const left = getPos(zone.range[0]);
                            const right = getPos(zone.range[1]);
                            return (
                                <div
                                    key={idx}
                                    className="absolute h-full h-full"
                                    style={{
                                        left: `${left}%`,
                                        width: `${right - left}%`,
                                        backgroundColor: zone.color,
                                        opacity: 0.6
                                    }}
                                    title={`${zone.label}: ${zone.range[0]} to ${zone.range[1]}°C`}
                                />
                            );
                        })}
                    </div>

                    {/* Scoopable Window Highlight (Green Pin/Band) */}
                    <div
                        className="absolute top-[28px] h-6 bg-emerald-500/20 border-x border-emerald-500/40 z-0"
                        style={{
                            left: `${getPos(scoopRange.min)}%`,
                            width: `${getPos(scoopRange.max) - getPos(scoopRange.min)}%`
                        }}
                    >
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                            SCOOPABLE WINDOW
                        </div>
                    </div>

                    {/* Reference Markers */}
                    {/* Home/Gelateria context marker */}
                    <div
                        className="absolute top-1/2 -translate-y-1/2 w-0.5 h-10 bg-slate-400 z-10"
                        style={{ left: `${getPos(ctx.referenceTemp)}%` }}
                    >
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-500 whitespace-nowrap">
                            {ctx.label.toUpperCase()}
                        </div>
                    </div>

                    {/* Recommended Serve Pin */}
                    <div
                        className="absolute top-1/2 -translate-y-1/2 w-1 h-12 bg-emerald-500 z-20 shadow-lg glow-emerald"
                        style={{ left: `${getPos(serveTemp)}%` }}
                    >
                        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                            {serveTemp}°C
                        </div>
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900 shadow-sm" />
                    </div>

                    {/* Axis Labels */}
                    <div className="absolute inset-x-0 top-16 flex justify-between text-[10px] font-mono text-muted-foreground">
                        <span>-45°C</span>
                        <span>-25°C</span>
                        <span>-5°C</span>
                    </div>
                </div>

                {/* Dynamic Summary Card */}
                <div className="bg-muted p-3 rounded-lg border border-muted-foreground/10 text-xs space-y-1.5">
                    <div className="flex justify-between items-center">
                        <span className="font-medium">Recommended Serve:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{serveTemp}°C</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="font-medium">At {ctx.label} ({ctx.referenceTemp}°C):</span>
                        <span className="flex items-center gap-1 font-bold">
                            {frozenAtRef.toFixed(1)}% frozen —
                            <span className={cn(
                                frozenAtRef >= ctx.frozenZone_green[0] &&
                                    frozenAtRef <= ctx.frozenZone_green[1] ? "text-emerald-600" : "text-amber-600"
                            )}>
                                {frozenAtRef >= ctx.frozenZone_green[0] &&
                                    frozenAtRef <= ctx.frozenZone_green[1] ? "✅ SCOOPABLE" : "⚠️ FIRM"}
                            </span>
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="font-medium">Scoopable Window:</span>
                        <span className="font-bold">{scoopRange.max.toFixed(1)}°C to {scoopRange.min.toFixed(1)}°C</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
