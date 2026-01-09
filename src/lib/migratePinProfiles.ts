// pin all existing recipes to MP-Artisan v2024 once
export function migratePinProfiles() {
  const key = 'mp.migration.pinProfiles.v2025-09';
  if (localStorage.getItem(key)) return;

  const recipesKey = 'mp.recipes';
  const raw = localStorage.getItem(recipesKey);
  if (!raw) { localStorage.setItem(key, 'done'); return; }

  try {
    const arr = JSON.parse(raw);
    for (const r of arr) {
      r.meta = r.meta || {};
      if (!r.meta.parameter_profile_id) {
        r.meta.parameter_profile_id = 'mp-artisan-v2024';
        r.meta.parameter_profile_version = '2024.08';
      }
    }
    localStorage.setItem(recipesKey, JSON.stringify(arr));
    localStorage.setItem(key, 'done');
  } catch {
    localStorage.setItem(key, 'error');
  }
}