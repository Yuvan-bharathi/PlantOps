import React from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Sparkline } from './charts';

export type Source = 'live' | 'sim' | 'mixed';

/** Small tag that says where a figure comes from. */
export const SourceTag: React.FC<{ source: Source; className?: string }> = ({ source, className = '' }) => {
  const s = {
    live: { text: 'LIVE', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', tip: 'Live plant data' },
    sim: { text: 'SIM', cls: 'bg-amber-50 text-amber-700 ring-amber-200', tip: 'Simulated yard model (no tracking feed yet)' },
    mixed: { text: 'LIVE+SIM', cls: 'bg-sky-50 text-sky-700 ring-sky-200', tip: 'Live fleet data combined with the simulated yard model' },
  }[source];
  return (
    <span title={s.tip} className={`inline-flex shrink-0 items-center rounded px-1 py-px text-[8.5px] font-black tracking-wider ring-1 ${s.cls} ${className}`}>
      {s.text}
    </span>
  );
};

export interface KpiItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  source: Source;
  spark?: number[];
  sparkMin?: number;
  sparkMax?: number;
  progress?: number;
  delta?: { text: string; good: boolean | null };
}

export const KpiCard: React.FC<{ k: KpiItem }> = ({ k }) => (
  <div className="w-[158px] rounded-2xl border border-white/70 bg-white/95 px-3 py-2.5 shadow-[0_10px_30px_rgba(15,23,42,0.10)] backdrop-blur">
    <div className="flex items-center justify-between gap-1">
      <span className="flex min-w-0 items-center gap-1 truncate text-[9.5px] font-black uppercase tracking-wider text-slate-400">
        {k.icon}
        <span className="truncate">{k.label}</span>
      </span>
      <SourceTag source={k.source} />
    </div>
    <div className="mt-0.5 flex items-baseline gap-1.5">
      <span className="text-[22px] font-black leading-tight tabular-nums text-slate-900">{k.value}</span>
      {k.delta && (
        <span
          className={`inline-flex items-center text-[10px] font-black ${k.delta.good === null ? 'text-slate-400' : k.delta.good ? 'text-emerald-600' : 'text-red-500'}`}
          title="Change vs one hour ago"
        >
          {k.delta.good === false ? <ArrowDownRight size={11} /> : k.delta.good ? <ArrowUpRight size={11} /> : null}
          {k.delta.text}
        </span>
      )}
    </div>
    <div className="truncate text-[10.5px] text-slate-500">{k.sub}</div>
    {k.spark && k.spark.length > 1 ? (
      <Sparkline values={k.spark} min={k.sparkMin} max={k.sparkMax} height={22} className="mt-1" />
    ) : (
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${Math.max(0, Math.min(1, k.progress || 0)) * 100}%` }} />
      </div>
    )}
  </div>
);

/** Delta helper: difference between last and first sample. */
export function deltaOf(series: number[] | undefined, fmt: (d: number) => string, higherIsBetter: boolean | null): KpiItem['delta'] {
  if (!series || series.length < 2) return undefined;
  const d = series[series.length - 1] - series[0];
  if (Math.abs(d) < 0.5) return undefined; // no visible change: show nothing
  return { text: `${d > 0 ? '+' : ''}${fmt(d)}`, good: higherIsBetter === null ? null : d > 0 === higherIsBetter };
}

const SRC_DOT: Record<Source, { color: string; tip: string }> = {
  live: { color: '#16A34A', tip: 'Live plant data' },
  sim: { color: '#F59E0B', tip: 'Simulated yard model (no tracking feed yet)' },
  mixed: { color: '#0EA5E9', tip: 'Live fleet data combined with the simulated yard model' },
};

/** Compact metric for the header strip: label, value + change, one-line context, tiny trend. */
export const KpiStat: React.FC<{ k: KpiItem }> = ({ k }) => {
  const src = SRC_DOT[k.source];
  return (
    <div className="flex min-w-[124px] max-w-[170px] flex-1 flex-col justify-center border-l border-slate-100 px-3 first:border-l-0" title={`${k.label} — ${src.tip}`}>
      <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
        <span className="shrink-0">{k.icon}</span>
        <span className="truncate">{k.label}</span>
        <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: src.color }} />
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-lg font-black leading-tight tabular-nums text-slate-900">{k.value}</span>
        {k.delta && k.delta.good !== null && (
          <span className={`inline-flex items-center text-[10px] font-black ${k.delta.good ? 'text-emerald-600' : 'text-red-500'}`} title="Change vs one hour ago">
            {k.delta.good ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
            {k.delta.text}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[10.5px] text-slate-500">{k.sub}</span>
        {k.spark && k.spark.length > 1 && (
          <span className="w-12 shrink-0">
            <Sparkline values={k.spark} min={k.sparkMin} max={k.sparkMax} height={14} />
          </span>
        )}
      </div>
    </div>
  );
};

export const SourceLegend: React.FC = () => (
  <div className="flex flex-col gap-0.5 text-[9.5px] font-semibold text-slate-400">
    {(['live', 'sim'] as Source[]).map((s) => (
      <span key={s} className="inline-flex items-center gap-1" title={SRC_DOT[s].tip}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: SRC_DOT[s].color }} />
        {s === 'live' ? 'Live' : 'Sim'}
      </span>
    ))}
  </div>
);
