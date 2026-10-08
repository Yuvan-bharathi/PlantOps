import React from 'react';
import { Keyboard, X } from 'lucide-react';

export const SHORTCUTS: [string, string][] = [
  ['Ctrl + K  or  /', 'Search everything'],
  ['A', 'Alerts panel'],
  ['D', 'Analytics drawer'],
  ['L', 'Map layers'],
  ['T', 'Follow the selected truck / forklift'],
  ['R', 'Replay / back to live'],
  ['Space', 'Pause / play replay'],
  ['H', 'Reset the view'],
  ['+  /  −', 'Zoom in / out'],
  ['[  /  ]', 'Rotate left / right'],
  ['PgUp  /  PgDn', 'Tilt up / down'],
  ['X', 'Full screen'],
  ['Esc', 'Back / close'],
  ['?', 'This help'],
];

export const ShortcutsHelp: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-900/25 backdrop-blur-[2px]" onMouseDown={onClose}>
    <div className="w-[min(460px,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-black text-slate-900">
          <Keyboard size={16} className="text-blue-600" /> Keyboard shortcuts
        </div>
        <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
          <X size={16} />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-1">
        {SHORTCUTS.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between rounded-lg px-2 py-1 text-xs hover:bg-slate-50">
            <span className="text-slate-600">{v}</span>
            <kbd className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-700">{k}</kbd>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-slate-400">Mouse: drag to move · right-drag to rotate · scroll to zoom · double-click a building to go inside.</p>
    </div>
  </div>
);
