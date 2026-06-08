import { listProfiles, getActiveParameters, registerCustomProfile } from '@/services/productParametersService';
import { loadProfileState, saveProfileState } from '@/lib/params';
import { useState, useEffect } from 'react';
import { fetchTargetProfiles } from '@/services/targetProfilesService';
import type { ParameterSet } from '@/types/parameters';

export default function ProfileSwitcher() {
  const [profiles, setProfiles] = useState(() => listProfiles());
  const state = loadProfileState();
  const [active, setActive] = useState(state.activeProfileId || 'unified-2025');

  useEffect(() => {
    fetchTargetProfiles().then(customProfiles => {
      customProfiles.forEach(cp => {
        const pSet: ParameterSet = {
          id: cp.id,
          name: cp.name,
          version: 'custom',
          style: 'artisan',
          bands: { [cp.product_type]: cp.ranges },
          sugar: {},
          constraint_defaults: cp.constraint_defaults
        };
        registerCustomProfile(pSet);
      });
      setProfiles(listProfiles());
    }).catch(err => console.error("Failed to fetch custom profiles:", err));
  }, []);

  const onChange = (id: string) => {
    setActive(id);
    saveProfileState({ ...state, activeProfileId: id });
    window.location.reload(); // Quick way to re-apply global profile state everywhere
  };

  const eff = getActiveParameters();

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm opacity-70">Profile:</span>
      <select className="rounded-md border px-2 py-1 text-sm" value={active} onChange={(e)=>onChange(e.target.value)}>
        {profiles.map(p => <option key={p.id} value={p.id}>{p.name} {p.version !== 'custom' ? p.version : '(Custom)'}</option>)}
      </select>
      <span className="text-xs opacity-60">({eff.style})</span>
    </div>
  );
}