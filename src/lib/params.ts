import { EffectiveParameters, ParameterSet } from '@/types/parameters';

export const BASE_VERSION = 'base-1.0.0';

export function deepMerge<T>(a: T, b?: Partial<T>, c?: Partial<T>): T {
  function merge(x: any, y: any): any {
    if (!y) return x;
    const out: any = Array.isArray(x) ? [...x] : { ...x };
    for (const k of Object.keys(y)) {
      const yv = (y as any)[k];
      const xv = (x as any)?.[k];
      out[k] = (yv && typeof yv === 'object' && !Array.isArray(yv))
        ? merge(xv || {}, yv)
        : yv;
    }
    return out;
  }
  return merge(merge(a, b || {}), c || {});
}

export function hashJson(obj: any): string {
  const s = JSON.stringify(obj);
  let h = 0; for (let i=0;i<s.length;i++){ h=(h<<5)-h+s.charCodeAt(i); h|=0; }
  return `h${Math.abs(h)}`;
}

export type ProfileState = {
  activeProfileId: string;
  userOverrides?: Partial<ParameterSet>;
};

const SETTINGS_KEY = 'mp.settings';

export function loadProfileState(): ProfileState {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); }
  catch { return { activeProfileId: 'mp-artisan-v2024' }; }
}

export function saveProfileState(s: ProfileState) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function asEffective(base: ParameterSet, profile: ParameterSet, overrides?: Partial<ParameterSet>): EffectiveParameters {
  const merged = deepMerge(base, profile, overrides);
  return {
    ...merged,
    source: {
      baseVersion: BASE_VERSION,
      profileId: profile.id,
      profileVersion: profile.version,
      overridesHash: overrides ? hashJson(overrides) : undefined
    }
  };
}