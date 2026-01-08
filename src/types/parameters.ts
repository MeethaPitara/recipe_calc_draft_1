export type Range = [number, number];

export type ProductBands = {
  ts: Range; fat: Range; sugars: Range; msnf: Range;
  sp: Range; pac: Range;
  stabilizer?: Range; fruitPct?: Range;
};

export type SugarCoeffs = Record<string, { sp: number; pac: number }>;

export type ProcessTargets = {
  entryTempC?: Range;   // ~1–4
  drawTempC?: Range;    // −7 to −5
  serveTempC?: Range;   // ~−12
  storeTempC?: Range;   // ~−18
  overrunPct?: Range;   // coaching band
};

export type ParameterSet = {
  id: string; name: string; version: string;
  style: 'artisan' | 'science';
  bands: {
    ice_cream?: ProductBands;
    gelato_white?: ProductBands;
    gelato_finished?: ProductBands;
    fruit_gelato?: ProductBands;
    sorbet?: ProductBands;
  };
  sugar: SugarCoeffs;
  process?: ProcessTargets;
  notes?: string[];
};

export type EffectiveParameters = ParameterSet & {
  source: { baseVersion: string; profileId: string; profileVersion: string; overridesHash?: string; }
};