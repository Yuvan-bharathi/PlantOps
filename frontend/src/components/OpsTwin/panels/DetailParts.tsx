import React, { useState } from 'react';
import { Check, ChevronRight, Circle, Crosshair, Link2, X } from 'lucide-react';
import { BayVisit, TaskEntry, TimelineEvent } from '../yard/sim';
import { Sparkline, StackedBar } from './charts';

const t = (sec: number) => new Date(sec * 1000).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
const ago = (sec: number, now: number) => {
  const d = Math.max(0, Math.round(now - sec));
  return d < 60 ? `${d}s ago` : d < 3600 ? `${Math.round(d / 60)}m ago` : `${Math.floor(d / 3600)}h ${Math.round((d % 3600) / 60)}m ago`;
};

/** Overview / Activity / History tabs for the details panel. */
export const DetailTabs: React.FC<{ tabs: { key: string; label: string; content: React.ReactNode }[]; resetKey: string }> = ({ tabs, resetKey }) => {
  const [active, setActive] = useState(tabs[0]?.key);
  const [lastKey, setLastKey] = useState(resetKey);
  if (lastKey !== resetKey) {
    setLastKey(resetKey);
    setActive(tabs[0]?.key);
  }
  const cur = tabs.find((x) => x.key === active) || tabs[0];
  return (
    <div>
      <div className="mb-3 flex gap-1 rounded-xl bg-slate-100 p-1">
        {tabs.map((x) => (
          <button key={x.key} onClick={() => setActive(x.key)} className={`flex-1 rounded-lg py-1.5 text-[11px] font-black ${cur.key === x.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {x.label}
          </button>
        ))}
      </div>
      {cur.content}
    </div>
  );
};

/** Follow / copy-link / entity actions shown under the details header. */
export const ActionBar: React.FC<{
  following?: boolean;
  onFollow?: () => void;
  onCopyLink: () => void;
  actions?: { label: string; icon: React.ReactNode; onClick: () => void; tone?: 'primary' | 'default' }[];
}> = ({ following, onFollow, onCopyLink, actions = [] }) => {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {onFollow && (
        <button
          onClick={onFollow}
          className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${following ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          title="Keep the camera on it (T)"
        >
          <Crosshair size={12} /> {following ? 'Following' : 'Follow'}
        </button>
      )}
      <button
        onClick={() => {
          onCopyLink();
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        }}
        className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-200"
        title="Copy a link to exactly this view"
      >
        {copied ? <Check size={12} /> : <Link2 size={12} />} {copied ? 'Copied' : 'Link'}
      </button>
      {actions.map((a) => (
        <button
          key={a.label}
          onClick={a.onClick}
          className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${a.tone === 'primary' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          {a.icon} {a.label}
        </button>
      ))}
    </div>
  );
};

/** Vertical event timeline (done = filled dot, next = pulsing, later = hollow). */
export const EventTimeline: React.FC<{ events: TimelineEvent[]; now: number }> = ({ events, now }) => {
  const next = events.findIndex((e) => !e.done);
  return (
    <ol className="relative ml-1.5 space-y-2.5 border-l-2 border-slate-100 pl-4">
      {events.map((e, i) => (
        <li key={i} className="relative">
          <span
            className={`absolute -left-[23px] top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 ${
              e.done ? 'border-blue-600 bg-blue-600' : i === next ? 'animate-pulse border-blue-600 bg-white' : 'border-slate-300 bg-white'
            }`}
          >
            {e.done && <Check size={8} strokeWidth={4} className="text-white" />}
          </span>
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className={e.done || i === next ? 'font-bold text-slate-800' : 'text-slate-400'}>{e.label}</span>
            <span className="shrink-0 tabular-nums text-slate-400">
              {t(e.at)}
              {!e.done && e.at > now ? ` · in ${Math.max(1, Math.round((e.at - now) / 60))}m` : ''}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
};

export const TaskLog: React.FC<{ tasks: TaskEntry[]; now: number }> = ({ tasks, now }) => (
  <div className="space-y-1">
    {tasks.length === 0 && <p className="text-xs text-slate-400">No pallet moves yet.</p>}
    {tasks.map((x, i) => (
      <div key={i} className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-[11px] hover:bg-slate-50">
        <Circle size={7} className={`shrink-0 ${x.status === 'loading' || x.status === 'unloading' ? 'fill-emerald-500 text-emerald-500' : 'fill-blue-500 text-blue-500'}`} />
        <span className="min-w-0 flex-1 truncate text-slate-700">{x.label}</span>
        <span className="shrink-0 tabular-nums text-slate-400">{ago(x.at, now)}</span>
      </div>
    ))}
  </div>
);

export const VisitList: React.FC<{ visits: BayVisit[]; now: number; empty?: string }> = ({ visits, now, empty = 'No visits in this window.' }) => (
  <div className="space-y-1">
    {visits.length === 0 && <p className="text-xs text-slate-400">{empty}</p>}
    {visits.map((v, i) => (
      <div key={i} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1.5 text-[11px]">
        <span className="min-w-0">
          <span className="block font-black text-slate-800">
            {v.truckId} <span className="font-medium text-slate-400">· {v.carrier}</span>
          </span>
          <span className="block text-slate-500">
            {t(v.docked)}–{v.undock > now ? 'now' : t(v.undock)} · {v.pallets} pallets {v.kind === 'in' ? 'in' : 'out'}
          </span>
        </span>
        <span className="shrink-0 font-bold tabular-nums text-slate-600">{Math.round((Math.min(v.undock, now) - v.docked) / 60)} min</span>
      </div>
    ))}
  </div>
);

export const Manifest: React.FC<{ rows: { id: string; contents: string; weight: string; done: boolean }[]; doneLabel: string }> = ({ rows, doneLabel }) => (
  <div className="overflow-hidden rounded-xl border border-slate-100">
    <div className="grid grid-cols-[1fr_1fr_54px_20px] gap-2 bg-slate-50 px-2.5 py-1.5 text-[9.5px] font-black uppercase tracking-wider text-slate-400">
      <span>Pallet</span>
      <span>Contents</span>
      <span className="text-right">Weight</span>
      <span />
    </div>
    {rows.map((r) => (
      <div key={r.id} className="grid grid-cols-[1fr_1fr_54px_20px] items-center gap-2 border-t border-slate-100 px-2.5 py-1.5 text-[11px]">
        <span className="truncate font-mono font-bold text-slate-700">{r.id}</span>
        <span className="truncate text-slate-500">{r.contents}</span>
        <span className="text-right tabular-nums text-slate-600">{r.weight}</span>
        <span title={r.done ? doneLabel : 'Pending'}>{r.done ? <Check size={12} className="text-emerald-600" /> : <Circle size={9} className="text-slate-300" />}</span>
      </div>
    ))}
  </div>
);

export const Related: React.FC<{ items: { label: string; sub: string; onClick: () => void }[] }> = ({ items }) =>
  items.length ? (
    <div className="mt-3">
      <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Related</div>
      <div className="space-y-1">
        {items.map((r) => (
          <button key={r.label} onClick={r.onClick} className="flex w-full items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5 text-left text-[11px] hover:bg-blue-50">
            <span>
              <span className="font-black text-slate-800">{r.label}</span> <span className="text-slate-500">· {r.sub}</span>
            </span>
            <ChevronRight size={13} className="text-slate-400" />
          </button>
        ))}
      </div>
    </div>
  ) : null;

export const BatteryChart: React.FC<{ values: number[] }> = ({ values }) => (
  <div>
    <div className="mb-1 flex justify-between text-[10px] font-bold text-slate-400">
      <span>Battery · last 10 min</span>
      <span className="tabular-nums text-slate-600">{values[values.length - 1]}%</span>
    </div>
    <Sparkline values={values} min={0} max={100} height={46} color={values[values.length - 1] < 40 ? '#F59E0B' : '#22C55E'} />
  </div>
);

export const UtilBar: React.FC<{ u: { working: number; givingWay: number; idle: number; charging: number } }> = ({ u }) => (
  <div>
    <div className="mb-1 flex justify-between text-[10px] font-bold text-slate-400">
      <span>Time split per cycle</span>
      <span className="tabular-nums text-slate-600">{Math.round(u.working * 100)}% working</span>
    </div>
    <StackedBar
      parts={[
        { label: 'Working', value: u.working, color: '#22C55E' },
        { label: 'Giving way', value: u.givingWay, color: '#F59E0B' },
        { label: 'Idle', value: u.idle, color: '#CBD5E1' },
        { label: 'Charging', value: u.charging, color: '#3B82F6' },
      ]}
    />
  </div>
);

export const RequestLog: React.FC<{ items: { at: number; text: string; status: string }[]; now: number }> = ({ items, now }) =>
  items.length ? (
    <div className="mt-3">
      <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">Requests from this page</div>
      <div className="space-y-1">
        {items.map((r, i) => (
          <div key={i} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1.5 text-[11px]">
            <span className="min-w-0 truncate text-slate-700">{r.text}</span>
            <span className="shrink-0 text-[10px] font-bold text-slate-400">
              {r.status} · {ago(r.at, now)}
            </span>
          </div>
        ))}
      </div>
    </div>
  ) : null;

/** Small modal for actions that need a confirmation and a note. */
export const RequestDialog: React.FC<{
  title: string;
  description: string;
  confirmLabel: string;
  withPriority?: boolean;
  notePlaceholder: string;
  defaultNote?: string;
  onSubmit: (v: { priority: string; note: string }) => Promise<void> | void;
  onClose: () => void;
}> = ({ title, description, confirmLabel, withPriority, notePlaceholder, defaultNote = '', onSubmit, onClose }) => {
  const [priority, setPriority] = useState('HIGH');
  const [note, setNote] = useState(defaultNote);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div className="w-[min(440px,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <div className="text-sm font-black text-slate-900">{title}</div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <p className="mb-3 text-xs leading-relaxed text-slate-500">{description}</p>
        {withPriority && (
          <div className="mb-3 grid grid-cols-4 gap-1">
            {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((p) => (
              <button key={p} onClick={() => setPriority(p)} className={`rounded-lg py-1.5 text-[10px] font-black ${priority === p ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {p}
              </button>
            ))}
          </div>
        )}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={notePlaceholder}
          rows={3}
          className="w-full resize-none rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 outline-none focus:border-blue-400"
        />
        {err && <p className="mt-2 text-xs font-semibold text-red-600">{err}</p>}
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100">
            Cancel
          </button>
          <button
            disabled={busy || !note.trim()}
            onClick={async () => {
              setBusy(true);
              setErr(null);
              try {
                await onSubmit({ priority, note: note.trim() });
                onClose();
              } catch (e: any) {
                setErr(e?.message || 'Request failed');
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? 'Sending…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
