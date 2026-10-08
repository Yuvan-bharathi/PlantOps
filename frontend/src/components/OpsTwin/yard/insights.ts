/**
 * Page-level insights for the Ops Twin: KPI values + trends and operational alerts.
 * Yard figures come from the deterministic yard model (simulated, except the live PlantOps
 * fleet at the outbound terminal); machine figures come from live plant data.
 */
import { Incident, Machine } from '../../../types';
import { EntityRef } from '../sceneKit';
import { FleetState } from '../fleet';
import { SITE_DEFS, SiteDef } from './layout';
import { bayVisits, forkliftUtilisation, onYard, siteSnapshot, SiteSnapshot, TIMING } from './sim';

const WORKING = new Set(['loading', 'unloading', 'putaway', 'to-charger']);

export interface YardMetrics {
  trucksOnSite: number;
  inbound: number;
  dockUtil: number; // 0..1 bays with a docked truck
  forkliftUtil: number; // 0..1 forklifts working right now
  staged: number;
  slots: number;
  movesPerHour: number;
  turnaroundMin: number | null;
  liveShare: number; // 0..1 share of bays that are live fleet
}

export function yardMetrics(sites: SiteDef[], snaps: Record<string, SiteSnapshot>, nowSec: number, fleet: FleetState | null): YardMetrics {
  let trucks = 0, inbound = 0, docked = 0, bays = 0, working = 0, fls = 0, staged = 0, slots = 0, moves = 0, liveBays = 0;
  const turns: number[] = [];
  for (const s of sites) {
    const sn = snaps[s.id] || siteSnapshot(s, nowSec, fleet);
    trucks += sn.trucks.filter(onYard).length;
    inbound += sn.arriving;
    docked += sn.trucks.filter((t) => t?.phase === 'docked').length;
    bays += s.bays.length;
    if (s.liveFleet) liveBays += s.bays.length;
    working += sn.forklifts.filter((f) => WORKING.has(f.status) && !f.givingWay).length;
    fls += sn.forklifts.length;
    staged += sn.staged;
    slots += s.slots.length;
    moves += s.forklifts.reduce((a, f) => a + forkliftUtilisation(s, f).movesPerHour, 0);
    for (const b of s.bays) for (const v of bayVisits(s, b, nowSec - 7200, nowSec, fleet)) if (v.gone <= nowSec) turns.push((v.gone - v.start) / 60);
  }
  return {
    trucksOnSite: trucks,
    inbound,
    dockUtil: bays ? docked / bays : 0,
    forkliftUtil: fls ? working / fls : 0,
    staged,
    slots,
    movesPerHour: moves,
    turnaroundMin: turns.length ? turns.reduce((a, b) => a + b, 0) / turns.length : null,
    liveShare: bays ? liveBays / bays : 0,
  };
}

/** The same metrics sampled over the last hour (oldest first) for sparklines and deltas. */
export function yardSeries(sites: SiteDef[], nowSec: number, fleet: FleetState | null, minutes = 60, points = 13) {
  const out = { trucks: [] as number[], dockUtil: [] as number[], forkliftUtil: [] as number[], staged: [] as number[] };
  for (let i = 0; i < points; i++) {
    const t = nowSec - ((points - 1 - i) * minutes * 60) / (points - 1);
    const snaps = Object.fromEntries(sites.map((s) => [s.id, siteSnapshot(s, t, fleet)]));
    let trucks = 0, docked = 0, bays = 0, working = 0, fls = 0, staged = 0;
    for (const s of sites) {
      const sn = snaps[s.id];
      trucks += sn.trucks.filter(onYard).length;
      docked += sn.trucks.filter((x) => x?.phase === 'docked').length;
      bays += s.bays.length;
      working += sn.forklifts.filter((f) => WORKING.has(f.status) && !f.givingWay).length;
      fls += sn.forklifts.length;
      staged += sn.staged;
    }
    out.trucks.push(trucks);
    out.dockUtil.push(bays ? docked / bays : 0);
    out.forkliftUtil.push(fls ? working / fls : 0);
    out.staged.push(staged);
  }
  return out;
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface OpsAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  siteId: string;
  ref: EntityRef;
  source: 'live' | 'sim';
}

const SEV_ORDER: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };

export function deriveAlerts(args: {
  snaps: Record<string, SiteSnapshot>;
  fleet: FleetState | null;
  machines: Machine[];
  openIncidents: Incident[];
  siteOfMachine: (code: string) => string | undefined;
  codeOfMachineId: (id: string) => string | undefined;
  nowSec: number;
}): OpsAlert[] {
  const { snaps, fleet, machines, openIncidents, siteOfMachine, codeOfMachineId, nowSec } = args;
  const out: OpsAlert[] = [];
  const cycle = Math.floor(nowSec / TIMING.CYCLE);

  // Machines (live)
  const flagged = new Set<string>();
  for (const m of machines) {
    const siteId = siteOfMachine(m.code);
    if (!siteId) continue;
    if (m.status === 'FAULT' || m.status === 'WARNING') {
      flagged.add(m.code);
      out.push({
        id: `mc:${m.code}:${m.status}`,
        severity: m.status === 'FAULT' ? 'critical' : 'warning',
        title: `${m.code} ${m.status === 'FAULT' ? 'fault' : 'warning'}`,
        detail: `${m.name} · health ${Math.round(m.health_score)}%`,
        siteId,
        ref: { kind: 'machine', id: m.code },
        source: 'live',
      });
    }
  }
  for (const i of openIncidents) {
    const code = i.machine_code || codeOfMachineId(i.machine_id);
    if (!code || flagged.has(code)) continue;
    const siteId = siteOfMachine(code);
    if (!siteId) continue;
    out.push({
      id: `inc:${i.id}`,
      severity: i.severity === 'CRITICAL' || i.severity === 'HIGH' ? 'critical' : 'warning',
      title: `${code} · ${i.alert_type.replace(/_/g, ' ').toLowerCase()}`,
      detail: `${i.severity} incident · ${i.status.replace(/_/g, ' ').toLowerCase()}`,
      siteId,
      ref: { kind: 'machine', id: code },
      source: 'live',
    });
  }

  for (const s of SITE_DEFS) {
    const sn = snaps[s.id];
    if (!sn) continue;
    const src = s.liveFleet ? 'live' : 'sim';
    // Forklift batteries
    for (const f of sn.forklifts) {
      if (f.battery < 45 && f.status !== 'charging' && f.status !== 'to-charger') {
        out.push({ id: `bat:${f.def.id}:${cycle}`, severity: 'warning', title: `${f.def.id} battery ${f.battery}%`, detail: `${s.code} · ${f.detail}`, siteId: s.id, ref: { kind: 'forklift', id: f.def.id }, source: 'sim' });
      }
    }
    // Staging capacity
    const fill = sn.staged / Math.max(1, s.slots.length);
    if (fill >= 0.85) {
      out.push({ id: `stage:${s.id}`, severity: fill >= 0.95 ? 'critical' : 'warning', title: `${s.code} staging ${Math.round(fill * 100)}% full`, detail: `${sn.staged}/${s.slots.length} slots · ${s.stagedLabel}`, siteId: s.id, ref: { kind: 'site', id: s.id }, source: src });
    }
    // Trucks
    sn.trucks.forEach((t, i) => {
      if (!t) return;
      const key = `${s.id}:${i}`;
      if (t.live) {
        const truck = fleet?.trucks[i];
        if (truck?.isReady && t.phase === 'docked') {
          out.push({ id: `full:${truck.id}`, severity: 'warning', title: `${truck.id} full · awaiting dispatch`, detail: `${s.code} · ${t.bay.id} · ${truck.loadedPallets}/${truck.capacityPallets} pallets`, siteId: s.id, ref: { kind: 'truck', id: key }, source: 'live' });
        }
        return;
      }
      if (t.phase === 'docked' && t.pallets.done >= t.pallets.total && t.eta) {
        const wait = Date.parse(t.eta) / 1000 - nowSec;
        if (wait > 45) {
          out.push({ id: `wait:${key}:${cycle}`, severity: 'info', title: `${t.id} ready · idle at dock`, detail: `${s.code} · ${t.bay.id} · ${t.kind === 'in' ? 'unloaded' : 'loaded'}, departs in ${Math.ceil(wait / 60)} min`, siteId: s.id, ref: { kind: 'truck', id: key }, source: 'sim' });
        }
      }
    });
    const atGate = sn.trucks.filter((t) => t && (t.phase === 'road' || t.phase === 'docking')).length;
    if (atGate >= 2) {
      out.push({ id: `gate:${s.id}:${Math.floor(nowSec / 120)}`, severity: 'info', title: `${s.code} gate busy`, detail: `${atGate} trucks arriving at once`, siteId: s.id, ref: { kind: 'site', id: s.id }, source: src });
    }
  }
  return out.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || a.siteId.localeCompare(b.siteId));
}

// ─── Acknowledged alerts (per viewer, survives reloads) ───────────────────────

const ACK_KEY = 'opsTwin.ackAlerts';
export function loadAcks(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(ACK_KEY) || '[]'));
  } catch {
    return new Set();
  }
}
export function saveAcks(ids: Set<string>) {
  try {
    localStorage.setItem(ACK_KEY, JSON.stringify([...ids].slice(-300)));
  } catch {
    /* storage unavailable */
  }
}
