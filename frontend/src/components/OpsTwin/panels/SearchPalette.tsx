import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, Search } from 'lucide-react';

export interface SearchItem {
  key: string;
  type: 'Site' | 'Building' | 'Equipment' | 'Truck' | 'Shipment' | 'Forklift' | 'Charger' | 'Dock bay' | 'Pallet';
  title: string;
  sub: string;
  keywords: string;
  onPick: () => void;
}

const TYPE_TONE: Record<SearchItem['type'], string> = {
  Site: 'bg-slate-800 text-white',
  Building: 'bg-blue-100 text-blue-700',
  Equipment: 'bg-emerald-100 text-emerald-700',
  Truck: 'bg-indigo-100 text-indigo-700',
  Shipment: 'bg-violet-100 text-violet-700',
  Forklift: 'bg-amber-100 text-amber-800',
  Charger: 'bg-lime-100 text-lime-800',
  'Dock bay': 'bg-sky-100 text-sky-700',
  Pallet: 'bg-orange-100 text-orange-700',
};

export const SearchPalette: React.FC<{ items: SearchItem[]; onClose: () => void }> = ({ items, onClose }) => {
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => input.current?.focus(), []);

  const results = useMemo(() => {
    const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) return items.slice(0, 40);
    return items
      .map((it) => {
        const hay = `${it.title} ${it.sub} ${it.type} ${it.keywords}`.toLowerCase();
        if (!tokens.every((t) => hay.includes(t))) return null;
        const score = (it.title.toLowerCase().startsWith(tokens[0]) ? 0 : 1) + (it.title.toLowerCase().includes(tokens[0]) ? 0 : 1);
        return { it, score };
      })
      .filter(Boolean)
      .sort((a, b) => a!.score - b!.score)
      .slice(0, 60)
      .map((x) => x!.it);
  }, [q, items]);

  useEffect(() => setCursor(0), [q]);
  useEffect(() => {
    list.current?.querySelector(`[data-i="${cursor}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const pick = (it?: SearchItem) => {
    if (!it) return;
    it.onPick();
    onClose();
  };

  return (
    <div className="absolute inset-0 z-40 flex items-start justify-center bg-slate-900/25 pt-[12vh] backdrop-blur-[2px]" onMouseDown={onClose}>
      <div className="w-[min(620px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-slate-100 px-4">
          <Search size={16} className="text-slate-400" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setCursor((c) => Math.min(results.length - 1, c + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setCursor((c) => Math.max(0, c - 1));
              } else if (e.key === 'Enter') pick(results[cursor]);
              else if (e.key === 'Escape') onClose();
            }}
            placeholder="Search trucks, forklifts, equipment, shipments, bays, pallets…"
            className="h-12 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400"
          />
          <kbd className="rounded border border-slate-200 px-1.5 text-[10px] font-bold text-slate-400">Esc</kbd>
        </div>
        <div ref={list} className="max-h-[50vh] overflow-y-auto p-1.5">
          {results.length === 0 && <div className="px-3 py-8 text-center text-xs text-slate-400">No matches for “{q}”.</div>}
          {results.map((it, i) => (
            <button
              key={it.key}
              data-i={i}
              onMouseEnter={() => setCursor(i)}
              onClick={() => pick(it)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left ${i === cursor ? 'bg-blue-50' : ''}`}
            >
              <span className={`w-[70px] shrink-0 rounded-md px-1.5 py-0.5 text-center text-[10px] font-black ${TYPE_TONE[it.type]}`}>{it.type}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black text-slate-800">{it.title}</span>
                <span className="block truncate text-[11px] text-slate-500">{it.sub}</span>
              </span>
              {i === cursor && <CornerDownLeft size={14} className="shrink-0 text-blue-500" />}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-[10px] font-semibold text-slate-400">
          <span>↑ ↓ to move · Enter to fly there · Esc to close</span>
          <span>{results.length} result{results.length === 1 ? '' : 's'}</span>
        </div>
      </div>
    </div>
  );
};
