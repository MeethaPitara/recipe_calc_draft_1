import { listProfiles, getActiveParameters } from '@/services/productParametersService';
import { loadProfileState, saveProfileState } from '@/lib/params';
import { useState } from 'react';

export default function ProfileSwitcher() {
  const profiles = listProfiles();
  const state = loadProfileState();
  const [active, setActive] = useState(state.activeProfileId || 'mp-artisan-v2024');

  const onChange = (id: string) => {
    setActive(id);
    saveProfileState({ ...state, activeProfileId: id });
  };

  const eff = getActiveParameters();

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm opacity-70">Profile:</span>
      <select className="rounded-md border px-2 py-1 text-sm" value={active} onChange={(e)=>onChange(e.target.value)}>
        {profiles.map(p => <option key={p.id} value={p.id}>{p.name} {p.version}</option>)}
      </select>
      <span className="text-xs opacity-60">({eff.style})</span>
    </div>
  );
}