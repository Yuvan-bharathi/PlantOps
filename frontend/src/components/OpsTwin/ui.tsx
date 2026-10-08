import React, { useState } from 'react';
import { Check, ChevronDown, ChevronUp, X } from 'lucide-react';
import { statusOf } from './status';
import { TONE } from './fleet';

export const fmtTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) : '';

export const ago = (iso?: string) => {
  if (!iso) return 'never';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};

export const fmtDur = (sec?: number) => {
  const s = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
};

export const Pill: React.FC<{ status?: string; children?: React.ReactNode }> = ({ status, children }) => {
  const st = statusOf(status);
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: st.bg, color: st.text }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.color }} />
      {children ?? st.label}
    </span>
  );
};

export const TonePill: React.FC<{ tone: keyof typeof TONE; children: React.ReactNode }> = ({ tone, children }) => {
  const t = TONE[tone];
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: t.bg, color: t.text }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.dot }} />
      {children}
    </span>
  );
};

export const Card: React.FC<{ className?: string; style?: React.CSSProperties; children: React.ReactNode }> = ({ className = '', style, children }) => (
  <div style={style} className={`rounded-2xl border border-white/70 bg-white/95 shadow-[0_10px_30px_rgba(15,23,42,0.10)] backdrop-blur ${className}`}>{children}</div>
);

export const Kpi: React.FC<{ icon?: React.ReactNode; label: string; value: string; sub: string; progress: number }> = ({ icon, label, value, sub, progress }) => (
  <Card className="w-[164px] px-3.5 py-2">
    <div className="flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
      <span className="text-slate-500">{icon}</span>
      <span className="truncate">{label}</span>
    </div>
    <div className="mt-0.5 flex items-baseline justify-between gap-1">
      <span className="text-xl font-black leading-tight text-slate-900">{value}</span>
    </div>
    <div className="mt-0.5 truncate text-[10.5px] text-slate-500">{sub}</div>
    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }} />
    </div>
  </Card>
);

export const Row: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode }> = ({ icon, label, value }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="flex shrink-0 items-center gap-1.5 text-slate-500">
      {icon}
      {label}
    </span>
    <span className="text-right font-bold text-slate-800">{value}</span>
  </div>
);

export const Metric: React.FC<{ icon: React.ReactNode; label: string; value: string; warn?: boolean }> = ({ icon, label, value, warn }) => (
  <div className="rounded-lg bg-white px-2.5 py-2">
    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
      {icon}
      {label}
    </div>
    <div className={`text-sm font-black ${warn ? 'text-amber-600' : 'text-slate-800'}`}>{value}</div>
  </div>
);

export const QueueRow: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left transition ${active ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-slate-50'}`}
  >
    {children}
  </button>
);

export const Empty: React.FC<{ text: string }> = ({ text }) => <div className="px-3 py-6 text-center text-xs text-slate-400">{text}</div>;

export const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{children}</div>
);

/** Horizontal progress stepper (work orders, shipments). */
export const Stepper: React.FC<{
  eyebrow: string;
  title: string;
  subtitle: string;
  steps: { label: string; at?: string; done: boolean }[];
  current: number;
  footnote?: string;
  aside?: React.ReactNode;
  onClose: () => void;
}> = ({ eyebrow, title, subtitle, steps, current, footnote, aside, onClose }) => (
  <Card className={`flex w-full gap-3 p-4 ${aside ? '' : 'max-w-[560px]'}`}>
  <div className="min-w-0 flex-1">
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <SectionLabel>{eyebrow}</SectionLabel>
        <div className="truncate text-sm font-black text-slate-900">{title}</div>
        <div className="truncate text-xs text-slate-500">{subtitle}</div>
      </div>
      <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
        <X size={16} />
      </button>
    </div>
    <div className="flex items-start">
      {steps.map((s, i) => (
        <div key={i} className="flex min-w-0 flex-1 flex-col items-center text-center">
          <div className="flex w-full items-center">
            <div className={`h-0.5 flex-1 ${i === 0 ? 'opacity-0' : s.done || i === current ? 'bg-blue-500' : 'bg-slate-200'}`} />
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-black ${
                s.done ? 'border-blue-600 bg-blue-600 text-white' : i === current ? 'animate-pulse border-blue-600 bg-white text-blue-600' : 'border-slate-200 bg-white text-slate-400'
              }`}
            >
              {s.done ? <Check size={12} strokeWidth={3} /> : i + 1}
            </div>
            <div className={`h-0.5 flex-1 ${i === steps.length - 1 ? 'opacity-0' : steps[i + 1]?.done ? 'bg-blue-500' : 'bg-slate-200'}`} />
          </div>
          <div className={`mt-1 px-0.5 text-[10px] font-bold leading-tight ${s.done || i === current ? 'text-slate-800' : 'text-slate-400'}`}>{s.label}</div>
          <div className="text-[9px] text-slate-400">{fmtTime(s.at)}</div>
        </div>
      ))}
    </div>
    {footnote && <div className="mt-2 text-[11px] text-slate-400">{footnote}</div>}
  </div>
  {aside && <div className="hidden w-[260px] shrink-0 xl:block">{aside}</div>}
  </Card>
);

/** Tabbed queue card; collapses to its tab bar so it never hides the scene for long. */
export function QueueCard<K extends string>({
  tabs,
  active,
  onTab,
  children,
  title,
}: {
  tabs: readonly (readonly [K, string, number])[]; // count < 0 hides the badge
  active: K;
  onTab: (k: K) => void;
  children: React.ReactNode;
  title?: string; // shown on the right, e.g. the site name (widens the card)
}) {
  const [open, setOpen] = useState(true);
  return (
    <Card className="flex max-h-[36vh] w-[min(524px,calc(100vw-2rem))] flex-col">
      <div className="flex items-center gap-1 border-b border-slate-100 p-1.5">
        {tabs.map(([k, label, n]) => (
          <button
            key={k}
            onClick={() => {
              onTab(k);
              setOpen(true);
            }}
            className={`flex ${title ? 'px-3' : 'flex-1'} items-center justify-center gap-1.5 rounded-xl py-1.5 text-xs font-bold ${active === k && open ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            {label}
            {n >= 0 && <span className={`rounded-full px-1.5 text-[10px] ${active === k && open ? 'bg-white/25' : 'bg-slate-100'}`}>{n}</span>}
          </button>
        ))}
        {title && <span className="ml-auto truncate pl-2 text-[11px] font-semibold text-slate-400">{title}</span>}
        <button onClick={() => setOpen((v) => !v)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label={open ? 'Collapse list' : 'Expand list'} title={open ? 'Collapse' : 'Expand'}>
          {open ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
        </button>
      </div>
      {open && <div className="flex-1 overflow-y-auto p-1.5">{children}</div>}
    </Card>
  );
}
