import React from 'react';
import { Map as MapIcon, Moon, Sun, SunMoon, X } from 'lucide-react';
import { YardLayers } from '../yard/YardScene';

export type TimeOfDay = 'auto' | 'day' | 'night';
export type Theme = 'light' | 'dark';

const LAYERS: { key: keyof YardLayers; label: string; hint: string }[] = [
  { key: 'routes', label: 'Forklift route map', hint: 'Yellow dashed lanes' },
  { key: 'labels', label: 'Labels', hint: 'Site & building tags' },
  { key: 'dockStatus', label: 'Dock status colours', hint: 'Green loading · blue docking · grey free' },
  { key: 'heatmap', label: 'Forklift traffic heatmap', hint: 'Where forklifts drive most' },
  { key: 'stagingFill', label: 'Staging fill', hint: 'Green → amber → red as lanes fill' },
  { key: 'health', label: 'Machine health roofs', hint: 'Roof tint by worst machine status' },
];

const Toggle: React.FC<{ on: boolean; onChange: (v: boolean) => void }> = ({ on, onChange }) => (
  <button
    role="switch"
    aria-checked={on}
    onClick={() => onChange(!on)}
    className={`relative h-5 w-9 shrink-0 rounded-full transition ${on ? 'bg-blue-600' : 'bg-slate-300'}`}
  >
    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
  </button>
);

export const LayersMenu: React.FC<{
  layers: YardLayers;
  setLayers: (l: YardLayers) => void;
  timeOfDay: TimeOfDay;
  setTimeOfDay: (t: TimeOfDay) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  minimap: boolean;
  setMinimap: (v: boolean) => void;
  onClose: () => void;
}> = (p) => (
  <div className="w-[300px] rounded-2xl border border-white/70 bg-white p-3 shadow-[0_20px_50px_rgba(15,23,42,0.18)] backdrop-blur">
    <div className="mb-2 flex items-center justify-between">
      <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Map layers</span>
      <button onClick={p.onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Close layers">
        <X size={14} />
      </button>
    </div>
    <div className="space-y-1">
      {LAYERS.map((l) => (
        <label key={l.key} className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-2 py-1.5 hover:bg-slate-50">
          <span>
            <span className="block text-xs font-bold text-slate-800">{l.label}</span>
            <span className="block text-[10px] text-slate-400">{l.hint}</span>
          </span>
          <Toggle on={p.layers[l.key]} onChange={(v) => p.setLayers({ ...p.layers, [l.key]: v })} />
        </label>
      ))}

    </div>
    <div className="mt-3 border-t border-slate-100 pt-3">
      <div className="mb-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400">Lighting</div>
      <div className="grid grid-cols-3 gap-1">
        {([
          ['auto', 'IST auto', <SunMoon key="a" size={13} />],
          ['day', 'Day', <Sun key="d" size={13} />],
          ['night', 'Night', <Moon key="n" size={13} />],
        ] as const).map(([k, label, icon]) => (
          <button
            key={k}
            onClick={() => p.setTimeOfDay(k)}
            className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-bold ${p.timeOfDay === k ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>
      <div className="mb-1.5 mt-3 text-[11px] font-black uppercase tracking-wider text-slate-400">Panels</div>
      <div className="grid grid-cols-2 gap-1">
        {(['light', 'dark'] as const).map((t) => (
          <button
            key={t}
            onClick={() => p.setTheme(t)}
            className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-bold capitalize ${p.theme === t ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
          >
            {t === 'light' ? <Sun size={13} /> : <Moon size={13} />}
            {t} theme
          </button>
        ))}
      </div>
    </div>
  </div>
);
