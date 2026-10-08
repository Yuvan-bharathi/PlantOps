import React, { useMemo, useState } from 'react';
import { BarChart3, X } from 'lucide-react';
import { EntityRef } from '../sceneKit';
import { FleetState } from '../fleet';
import { equipAt, equipTimeline } from '../yard/equipment';
import { siteEquipment } from '../yard/warehouse';
import { SiteDef } from '../yard/layout';
import { bayVisits, forkliftUtilisation } from '../yard/sim';
import { BarSeries, Gantt, GanttRow, Legend, StackedBar } from './charts';
import { SourceTag } from './KpiStrip';

export interface TimelineSeg {
  startTime: string;
  endTime: string;
  startHour: number;
  endHour: number;
  status: string;
  label: string;
}
export interface DayRow {
  machine_code: string;
  actual_pieces: number;
  target_pieces: number;
  runtime_seconds: number;
  downtime_seconds: number;
  timeline_segments?: TimelineSeg[];
}

const STATE_COLOR: Record<string, string> = {
  RUNNING: '#22C55E',
  WARNING: '#F59E0B',
  FAULT: '#EF4444',
  ESTOP: '#B91C1C',
  MAINTENANCE: '#3B82F6',
  VERIFYING: '#8B5CF6',
  IDLE: '#CBD5E1',
  OFF: '#E2E8F0',
  NO_DATA: '#F1F5F9',
};

const istMidnight = (sec: number) => Math.floor((sec + 19800) / 86400) * 86400 - 19800;
const hourLabel = (sec: number) => new Date(sec * 1000).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false });

type Tab = 'docks' | 'forklifts' | 'throughput' | 'equipment';

export const AnalyticsDrawer: React.FC<{
  scope: SiteDef[];
  title: string;
  nowSec: number;
  fleet: FleetState | null;
  onSelect: (ref: EntityRef) => void;
  onEquipment: (id: string) => void;
  onClose: () => void;
}> = ({ scope, title, nowSec, fleet, onSelect, onEquipment, onClose }) => {
  const [tab, setTab] = useState<Tab>('docks');
  const [hours, setHours] = useState(2);
  const minuteBucket = Math.floor(nowSec / 30); // recompute heavy charts at most every 30 s

  // ── Docks ──
  const dock = useMemo(() => {
    const from = nowSec - hours * 3600;
    const rows: GanttRow[] = [];
    let dockedSec = 0;
    let visits = 0;
    let dwell = 0;
    let bays = 0;
    for (const s of scope) {
      for (const b of s.bays) {
        bays++;
        const vs = bayVisits(s, b, from, nowSec, fleet);
        const spans = vs.flatMap((v) => [
          ...(v.docked > v.start ? [{ from: v.start, to: v.docked, color: '#93C5FD', label: `${v.truckId} arriving` }] : []),
          { from: v.docked, to: Math.min(v.undock, nowSec), color: v.kind === 'in' ? '#34D399' : '#22C55E', label: `${v.truckId} · ${v.carrier} · ${v.kind === 'in' ? 'unloading' : 'loading'} ${v.pallets} pallets` },
          ...(v.gone > v.undock ? [{ from: v.undock, to: Math.min(v.gone, nowSec), color: '#C4B5FD', label: `${v.truckId} departing` }] : []),
        ]).filter((x) => x.to > x.from);
        for (const v of vs) {
          const a = Math.max(from, v.docked);
          const z = Math.min(nowSec, v.undock);
          if (z > a) dockedSec += z - a;
          if (v.undock <= nowSec && v.undock >= from) {
            visits++;
            dwell += (v.undock - v.docked) / 60;
          }
        }
        rows.push({ id: `${s.id}:${b.index}`, label: `${s.code} ${b.id.replace('Bay ', 'B')}`, sub: `${b.kind === 'in' ? 'Inbound' : 'Outbound'} · ${vs.length} visits`, spans });
      }
    }
    return { rows, from, util: bays ? dockedSec / (bays * hours * 3600) : 0, visits, avgDwell: visits ? dwell / visits : 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, hours, minuteBucket, fleet]);

  // ── Forklifts ──
  const forklifts = useMemo(
    () => scope.flatMap((s) => s.forklifts.map((f) => ({ s, f, u: forkliftUtilisation(s, f) }))),
    [scope]
  );

  // ── Throughput (last 12 h) ──
  const throughput = useMemo(() => {
    const hourStart = Math.floor(nowSec / 3600) * 3600;
    const buckets = Array.from({ length: 12 }, (_, i) => hourStart - (11 - i) * 3600);
    const trucks = buckets.map((h) => scope.reduce((a, s) => a + s.bays.reduce((n, b) => n + bayVisits(s, b, h, Math.min(h + 3600, nowSec), fleet).filter((v) => v.undock >= h && v.undock < h + 3600).length, 0), 0));
    // warehouse equipment utilisation per hour (share of powered equipment running)
    const items = scope.flatMap((s) => siteEquipment(s)).filter((e) => equipAt(e, nowSec).powered);
    const run = buckets.map((h) => {
      if (!items.length) return 0;
      let up = 0;
      let n = 0;
      for (let t = h + 300; t < Math.min(h + 3600, nowSec); t += 600) for (const e of items) {
        n++;
        if (equipAt(e, t).status === 'RUNNING') up++;
      }
      return n ? (up / n) * 100 : 0;
    });
    return { labels: buckets.map(hourLabel), trucks, run, hasRun: items.length > 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, minuteBucket, fleet]);

  // ── Equipment ──
  const machines = useMemo(() => {
    const mid = istMidnight(nowSec);
    const rows = scope.flatMap((s) =>
      siteEquipment(s)
        .map((e) => equipAt(e, nowSec))
        .filter((e) => e.powered)
        .map((e) => ({ s, code: e.item.label, id: e.item.id, avail: e.uptimeToday, downMin: (1 - e.uptimeToday) * ((nowSec - mid) / 60), segs: equipTimeline(e.item, nowSec) }))
    );
    const gantt: GanttRow[] = rows.map((r) => ({
      id: r.id,
      label: r.code,
      sub: r.s.code,
      spans: r.segs.map((g) => ({ from: g.from, to: g.to, color: STATE_COLOR[g.status] || '#CBD5E1', label: g.status.toLowerCase() })),
    }));
    return { rows, gantt, mid };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, Math.floor(nowSec / 60)]);

  const tabs: [Tab, string][] = [['docks', 'Docks'], ['forklifts', 'Forklifts'], ['throughput', 'Throughput'], ['equipment', 'Equipment']];

  return (
    <div className="flex max-h-full w-[min(600px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.18)] backdrop-blur">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <BarChart3 size={16} />
          </span>
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-blue-600">Analytics</div>
            <div className="text-sm font-black text-slate-900">{title}</div>
          </div>
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Close analytics">
          <X size={16} />
        </button>
      </div>
      <div className="flex gap-1 border-b border-slate-100 px-3 py-2">
        {tabs.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${tab === k ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
            {l}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === 'docks' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-black text-slate-800">
                Dock timeline <SourceTag source={scope.some((s) => s.liveFleet) ? (scope.every((s) => s.liveFleet) ? 'live' : 'mixed') : 'sim'} />
              </div>
              <div className="flex gap-1">
                {[2, 6, 12].map((h) => (
                  <button key={h} onClick={() => setHours(h)} className={`rounded-md px-2 py-0.5 text-[10px] font-black ${hours === h ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                    {h}h
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Dock utilisation" value={`${Math.round(dock.util * 100)}%`} />
              <Stat label={`Trucks (last ${hours}h)`} value={String(dock.visits)} />
              <Stat label="Avg dwell at dock" value={`${dock.avgDwell.toFixed(1)} min`} />
            </div>
            <Gantt rows={dock.rows} from={dock.from} to={nowSec} now={nowSec} tickEvery={hours <= 2 ? 1800 : 3600} onRow={(id) => onSelect({ kind: 'dock', id })} />
            <Legend items={[{ label: 'Arriving / docking', color: '#93C5FD' }, { label: 'At dock (loading / unloading)', color: '#22C55E' }, { label: 'Departing', color: '#C4B5FD' }]} />
          </div>
        )}
        {tab === 'forklifts' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-black text-slate-800">
              Utilisation per forklift <SourceTag source="sim" />
            </div>
            <Legend items={[{ label: 'Working', color: '#22C55E' }, { label: 'Giving way', color: '#F59E0B' }, { label: 'Idle', color: '#CBD5E1' }, { label: 'Charging', color: '#3B82F6' }]} />
            <div className="space-y-2">
              {forklifts.map(({ s, f, u }) => (
                <button key={f.id} onClick={() => onSelect({ kind: 'forklift', id: f.id })} className="w-full rounded-xl px-2 py-1.5 text-left hover:bg-slate-50">
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="font-black text-slate-800">
                      {f.id} <span className="font-medium text-slate-400">· {s.code} · {f.operator}</span>
                    </span>
                    <span className="font-bold tabular-nums text-slate-600">
                      {Math.round(u.working * 100)}% · {u.movesPerHour} moves/h
                    </span>
                  </div>
                  <StackedBar
                    parts={[
                      { label: 'Working', value: u.working, color: '#22C55E' },
                      { label: 'Giving way', value: u.givingWay, color: '#F59E0B' },
                      { label: 'Idle', value: u.idle, color: '#CBD5E1' },
                      { label: 'Charging', value: u.charging, color: '#3B82F6' },
                    ]}
                  />
                </button>
              ))}
            </div>
          </div>
        )}
        {tab === 'throughput' && (
          <div className="space-y-5">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-black text-slate-800">
                Trucks handled per hour <SourceTag source={scope.some((s) => s.liveFleet) ? 'mixed' : 'sim'} />
              </div>
              <BarSeries values={throughput.trucks} labels={throughput.labels} />
            </div>
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-black text-slate-800">
                Equipment running per hour (% of powered equipment) <SourceTag source="sim" />
              </div>
              {throughput.hasRun ? (
                <BarSeries values={throughput.run} labels={throughput.labels} color="#22C55E" format={(v) => `${Math.round(v)}%`} />
              ) : (
                <p className="text-xs text-slate-400">No powered equipment in this scope.</p>
              )}
            </div>
          </div>
        )}
        {tab === 'equipment' && (
          <div className="space-y-5">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-black text-slate-800">
                Uptime today <SourceTag source="sim" />
              </div>
              <div className="space-y-1.5">
                {machines.rows.map((r) => (
                  <button key={r.id} onClick={() => onEquipment(r.id)} className="flex w-full items-center gap-2 rounded-lg px-1 py-0.5 text-left hover:bg-slate-50">
                    <span className="w-32 shrink-0 truncate text-[11px] font-black text-slate-700">{r.code}</span>
                    <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <span className="block h-full rounded-full" style={{ width: `${(r.avail ?? 0) * 100}%`, background: (r.avail ?? 0) >= 0.9 ? '#22C55E' : (r.avail ?? 0) >= 0.75 ? '#F59E0B' : '#EF4444' }} />
                    </span>
                    <span className="w-10 text-right text-[11px] font-bold tabular-nums text-slate-600">{r.avail == null ? '—' : `${Math.round(r.avail * 100)}%`}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs font-black text-slate-800">Most downtime today</div>
              <div className="space-y-1">
                {[...machines.rows]
                  .filter((r) => r.downMin > 0)
                  .sort((a, b) => b.downMin - a.downMin)
                  .slice(0, 6)
                  .map((r) => (
                    <div key={r.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1 text-[11px]">
                      <span className="font-black text-slate-700">
                        {r.code} <span className="font-medium text-slate-400">· {r.s.code}</span>
                      </span>
                      <span className="font-bold tabular-nums text-red-600">{Math.round(r.downMin)} min</span>
                    </div>
                  ))}
                {!machines.rows.some((r) => r.downMin > 0) && <p className="text-xs text-slate-400">No downtime recorded today.</p>}
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs font-black text-slate-800">Equipment states today</div>
              <Gantt rows={machines.gantt} from={machines.mid} to={nowSec} now={nowSec} tickEvery={4 * 3600} onRow={(id) => onEquipment(id)} />
              <div className="mt-2">
                <Legend items={['RUNNING', 'IDLE', 'WARNING', 'FAULT', 'MAINTENANCE'].map((k) => ({ label: k.toLowerCase(), color: STATE_COLOR[k] }))} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl bg-slate-50 p-2.5">
    <div className="text-[10px] font-bold text-slate-400">{label}</div>
    <div className="text-base font-black tabular-nums text-slate-900">{value}</div>
  </div>
);
