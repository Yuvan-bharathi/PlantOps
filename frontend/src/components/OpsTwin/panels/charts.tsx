import React from 'react';

/** Small inline line chart with a soft area fill. */
export const Sparkline: React.FC<{ values: number[]; color?: string; height?: number; className?: string; min?: number; max?: number }> = ({
  values,
  color = '#2563EB',
  height = 28,
  className = '',
  min,
  max,
}) => {
  if (values.length < 2) return <div style={{ height }} className={className} />;
  const lo = min ?? Math.min(...values);
  const hi = max ?? Math.max(...values);
  const span = hi - lo || 1;
  const w = 100;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, height - 2 - ((v - lo) / span) * (height - 4)] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const area = `${line} L${w},${height} L0,${height} Z`;
  const id = `spk-${color.replace('#', '')}`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className={className} style={{ width: '100%', height }}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.6} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2.2} fill={color} vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

export interface StackPart {
  value: number; // fraction 0..1
  color: string;
  label: string;
}

/** Horizontal stacked bar (fractions should add up to ~1). */
export const StackedBar: React.FC<{ parts: StackPart[]; height?: number }> = ({ parts, height = 10 }) => (
  <div className="flex w-full overflow-hidden rounded-full bg-slate-100" style={{ height }}>
    {parts.map((p) => (
      <div key={p.label} title={`${p.label} ${Math.round(p.value * 100)}%`} style={{ width: `${Math.max(0, p.value) * 100}%`, background: p.color }} />
    ))}
  </div>
);

export const Legend: React.FC<{ items: { label: string; color: string }[] }> = ({ items }) => (
  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-semibold text-slate-500">
    {items.map((i) => (
      <span key={i.label} className="inline-flex items-center gap-1">
        <span className="h-2 w-2 rounded-sm" style={{ background: i.color }} />
        {i.label}
      </span>
    ))}
  </div>
);

/** Vertical bar series with labels underneath. */
export const BarSeries: React.FC<{ values: number[]; labels: string[]; color?: string; height?: number; format?: (v: number) => string }> = ({
  values,
  labels,
  color = '#2563EB',
  height = 90,
  format = (v) => String(Math.round(v)),
}) => {
  const max = Math.max(1, ...values);
  return (
    <div>
      <div className="flex items-end gap-1" style={{ height }}>
        {values.map((v, i) => (
          <div key={i} className="group relative flex flex-1 flex-col items-center justify-end" style={{ height: '100%' }}>
            <span className="pointer-events-none absolute -top-4 hidden whitespace-nowrap rounded bg-slate-800 px-1 text-[9px] font-bold text-white group-hover:block">{format(v)}</span>
            <div className="w-full rounded-t-sm transition-all" style={{ height: `${(v / max) * 100}%`, minHeight: v > 0 ? 2 : 0, background: color, opacity: i === values.length - 1 ? 1 : 0.75 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1">
        {labels.map((l, i) => (
          <span key={i} className="flex-1 truncate text-center text-[9px] text-slate-400">
            {l}
          </span>
        ))}
      </div>
    </div>
  );
};

export interface GanttSpan {
  from: number; // abs sec
  to: number;
  color: string;
  label: string;
}
export interface GanttRow {
  id: string;
  label: string;
  sub?: string;
  spans: GanttSpan[];
}

/** Rows of time spans over a window, with a "now" marker and hour ticks. */
export const Gantt: React.FC<{ rows: GanttRow[]; from: number; to: number; now: number; onRow?: (id: string) => void; tickEvery?: number }> = ({
  rows,
  from,
  to,
  now,
  onRow,
  tickEvery = 1800,
}) => {
  const span = to - from || 1;
  const pct = (t: number) => `${(Math.max(0, Math.min(1, (t - from) / span)) * 100).toFixed(3)}%`;
  const ticks: number[] = [];
  for (let t = Math.ceil(from / tickEvery) * tickEvery; t <= to; t += tickEvery) ticks.push(t);
  const fmt = (t: number) => new Date(t * 1000).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
  return (
    <div className="text-[10px]">
      <div className="relative ml-[86px] h-4">
        {ticks.map((t) => (
          <span key={t} className="absolute -translate-x-1/2 text-slate-400" style={{ left: pct(t) }}>
            {fmt(t)}
          </span>
        ))}
      </div>
      <div className="space-y-1">
        {rows.map((r) => (
          <button key={r.id} onClick={() => onRow?.(r.id)} className="flex w-full items-center gap-2 rounded-md text-left hover:bg-slate-50">
            <span className="w-[78px] shrink-0 truncate">
              <span className="block font-black text-slate-700">{r.label}</span>
              {r.sub && <span className="block truncate text-[9px] text-slate-400">{r.sub}</span>}
            </span>
            <span className="relative h-5 flex-1 overflow-hidden rounded bg-slate-100">
              {ticks.map((t) => (
                <span key={t} className="absolute top-0 h-full w-px bg-white" style={{ left: pct(t) }} />
              ))}
              {r.spans.map((s, i) => (
                <span
                  key={i}
                  title={`${s.label} · ${fmt(s.from)}–${fmt(s.to)}`}
                  className="absolute top-0.5 h-4 rounded-sm"
                  style={{ left: pct(s.from), width: `calc(${pct(s.to)} - ${pct(s.from)})`, minWidth: 2, background: s.color }}
                />
              ))}
              <span className="absolute top-0 h-full w-0.5 bg-blue-600" style={{ left: pct(now) }} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
