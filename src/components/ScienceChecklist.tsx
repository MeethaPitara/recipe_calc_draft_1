import { getActiveParameters } from '@/services/productParametersService';

export default function ScienceChecklist({
  productType,
  metrics,
  stabilizerPct,
  fruitPct
}: {
  productType: 'ice_cream'|'gelato_white'|'gelato_finished'|'fruit_gelato'|'sorbet';
  metrics: { ts_add_pct:number; fat_pct:number; sugars_pct:number; msnf_pct:number; sp:number; pac:number; };
  stabilizerPct?: number;
  fruitPct?: number;
}) {
  const p = getActiveParameters();
  const b = p.bands[productType];
  if (!b) {
    return (
      <div className="rounded-xl border p-3 space-y-2">
        <div className="font-semibold">Science Checklist</div>
        <div className="text-xs opacity-70">No checklist bands defined for this product/profile.</div>
      </div>
    );
  }
  const row = (label:string, val:number, r:[number,number]) => {
    const pass = val>=r[0] && val<=r[1];
    const near = !pass && (Math.abs(val - (val<r[0]?r[0]:r[1])) <= (0.05*(r[1]-r[0])));
    const cls = pass ? 'text-success-foreground' : near ? 'text-warning-foreground' : 'text-destructive-foreground';
    const bgCls = pass ? 'bg-success-light border-success/20' : near ? 'bg-warning-light border-warning/20' : 'bg-destructive/10 border-destructive/20';
    return (
      <div className={`flex justify-between text-sm p-2 rounded-lg border animate-smooth ${bgCls}`}>
        <span className="font-medium">{label}</span>
        <span className={`${cls} font-semibold`}>
          {val.toFixed(1)} <span className="text-xs text-muted-foreground">(target {r[0]}–{r[1]})</span>
        </span>
      </div>
    );
  };
  return (
    <div className="rounded-xl border gradient-card p-4 space-y-3 shadow-elegant">
      <div className="font-semibold text-lg flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-primary"></div>
        Science Checklist
      </div>
      {row('Total Solids %', metrics.ts_add_pct, b.ts)}
      {row('Fat %',          metrics.fat_pct,    b.fat)}
      {row('Sugar %',        metrics.sugars_pct, b.sugars)}
      {row('MSNF %',         metrics.msnf_pct,   b.msnf)}
      {row('SP',             metrics.sp,         b.sp)}
      {row('PAC',            metrics.pac,        b.pac)}
      {b.stabilizer && typeof stabilizerPct==='number' && row('Stabilizer %', stabilizerPct, b.stabilizer)}
      {b.fruitPct && typeof fruitPct==='number' && row('Fruit %', fruitPct, b.fruitPct)}
      <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded-lg border">
        <strong>Tips:</strong> PAC low → add dextrose/reduce sucrose. TS high → reduce cocoa/stabilizer or add water.
      </div>
    </div>
  );
}