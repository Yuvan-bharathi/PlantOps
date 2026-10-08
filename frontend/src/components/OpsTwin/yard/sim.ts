/**
 * Deterministic yard simulation. Every truck, forklift and charger state is a pure function
 * of wall-clock time, so all viewers see the same yard and a reload never "resets" it.
 * Bays of a site flagged `liveFleet` are driven by the real PlantOps fleet instead.
 */
import {
  allDoors, along, startHeading, slotNode, SLOT_ROWS, Door, Bay, bayNode, chargerNode, doorById, doorNode, DoorKind, ForkliftDef, polyLength, route, RouteNode, SiteDef,
  truckArrival, truckDeparture, TRUCK_CENTER_Z, V2,
} from './layout';
import { FleetState, shipmentSteps, truckSiteState } from '../fleet';

export const CYCLE = 600; // seconds per bay cycle
const T_FWD = 28; // road → gate → lane (forward)
const T_DOCKED = 46; // reversing finished
const T_UNDOCK = 346;
const T_GONE = 384;
const FL_SPEED = 2.4; // m/s
const HANDLE = 4; // seconds to pick / drop
const CHARGE_LEN = 150;
const DRAIN = 0.085; // battery % per working second
const FULL = 96;
const LANE_OFFSET = 1.05; // metres from the route centre line
const TURN = 1.4; // seconds a forklift takes to pivot before driving off

export type Tone = 'green' | 'blue' | 'amber' | 'purple' | 'slate';

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};
const mod = (a: number, n: number) => ((a % n) + n) % n;
const istMidnightSec = (nowSec: number) => Math.floor((nowSec + 19800) / 86400) * 86400 - 19800;

// ─── Carriers ─────────────────────────────────────────────────────────────────

export interface Carrier {
  name: string;
  cab: string;
  stripe: string;
}
export const CARRIERS: Carrier[] = [
  { name: 'Bluepeak', cab: '#F8FAFC', stripe: '#1E3A8A' },
  { name: 'Nordline', cab: '#F8FAFC', stripe: '#0D9488' },
  { name: 'Cargoviva', cab: '#F8FAFC', stripe: '#F97316' },
  { name: 'SteelLine', cab: '#334155', stripe: '#475569' },
];
export const PLANTOPS: Carrier = { name: 'PlantOps Freight', cab: '#2563EB', stripe: '#2563EB' };
const DRIVERS = ['Sam C', 'Ada L', 'Ines M', 'Alex W', 'Rahul D', 'Farah K', 'Joel P', 'Nisha G', 'Omar F', 'Tara V'];

// ─── Forklift plans ───────────────────────────────────────────────────────────

export type FlStatus = 'loading' | 'unloading' | 'putaway' | 'charging' | 'idle' | 'to-charger' | 'parked';

interface Seg {
  t0: number;
  t1: number;
  type: 'drive' | 'handle' | 'charge' | 'idle';
  pts?: V2[];
  len?: number;
  at?: V2;
  face?: number;
  carrying: boolean;
  status: FlStatus;
  detail: string;
  drop?: boolean;
  work0: number; // working seconds accumulated before this segment
}

interface Plan {
  segs: Seg[];
  offset: number; // frame start (seconds mod CYCLE)
  drops: number[]; // frame times of every drop
  bayDrops: number[]; // frame times of drops into / out of the served truck
  chargeStart: number;
  batteryAtCharge: number;
}

const sitePlans = new Map<string, Plan[]>();

export const bayOffset = (s: SiteDef, bayIndex: number) => mod(hash(s.id) + Math.round((bayIndex * CYCLE) / Math.max(1, s.bays.length)) + bayIndex * 41, CYCLE);

const planFor = (s: SiteDef, f: ForkliftDef): Plan => plansFor(s)[s.forklifts.indexOf(f)];

/**
 * Plans every forklift of a site in priority order (FL index). Each forklift owns its stops
 * (its doors, its bay, its charger, a staging slot if needed), so two forklifts never need
 * the same spot. Before every drive the planner checks the whole trip, every 0.25 s, against
 * the forklifts already planned (and the parked spares); if any footprints would overlap it
 * waits at its current stop — off the shared lanes — and tries again. Forklifts therefore
 * only enter the aisle when the way is clear: collision-free by construction, and still a
 * pure function of time (no runtime traffic simulation, identical for every viewer).
 */
function plansFor(s: SiteDef): Plan[] {
  const hit = sitePlans.get(s.id);
  if (hit) return hit;
  const doors = allDoors(s);
  const nf = Math.max(1, s.forklifts.length);
  const owner = new Map<string, number>();
  const bayDoor: (Door | undefined)[] = s.forklifts.map(() => undefined);
  s.forklifts.forEach((f, i) => {
    if (f.bay === undefined) return;
    const bay = s.bays[f.bay];
    const pref = doorById(s, bay.doorId);
    const free = doors
      .filter((d) => !owner.has(d.id))
      .sort((a, b) => (a.kind === bay.kind ? 0 : 40) + Math.abs(a.x - bay.x) - ((b.kind === bay.kind ? 0 : 40) + Math.abs(b.x - bay.x)));
    const d = pref && !owner.has(pref.id) ? pref : free[0];
    if (d) {
      owner.set(d.id, i);
      bayDoor[i] = d;
    }
  });
  doors.filter((d) => !owner.has(d.id)).forEach((d, j) => owner.set(d.id, j % nf));
  const frontSlots = s.slots.filter((sl) => sl.z === SLOT_ROWS[0]);
  const pools: RouteNode[][] = s.forklifts.map((_, i) => doors.filter((d) => owner.get(d.id) === i).map(doorNode));
  pools.forEach((pool, i) => {
    for (let k = 0; pool.length < 2 && k < 3 && frontSlots.length; k++) pool.push(slotNode(frontSlots[(i * 3 + k) % frontSlots.length]));
  });
  const spareFeet = s.spareParks.map((p) => footprint(p[0], p[1], 0));
  const out: Plan[] = [];
  s.forklifts.forEach((f, i) => out.push(buildPlan(s, f, pools[i], bayDoor[i], out, spareFeet)));
  sitePlans.set(s.id, out);
  return out;
}

function buildPlan(s: SiteDef, f: ForkliftDef, pool: RouteNode[], ownDoor: Door | undefined, higher: Plan[], spareFeet: Quad[]): Plan {
  const home = chargerNode(s.chargers[f.charger]);
  const bay = f.bay !== undefined ? s.bays[f.bay] : undefined;
  const offset = bay ? bayOffset(s, bay.index) : mod(hash(f.id) * 7, CYCLE);
  const segs: Seg[] = [];
  const drops: number[] = [];
  const bayDrops: number[] = [];
  let t = 0;
  let work = 0;
  let cur: RouteNode = home;
  let carrying = false;
  let k = 0;
  const chargerId = s.chargers[f.charger].id;

  /** Would driving `pts` starting at frame time `t0` touch an already-planned forklift? */
  const clear = (pts: V2[], t0: number) => {
    const len = polyLength(pts);
    const dur = len / FL_SPEED;
    for (let dt = 0; dt <= dur + 1e-6; dt += 0.25) {
      const q = drivePose(pts, len, Math.min(len, dt * FL_SPEED));
      const mine = footprint(q.x, q.z, q.heading);
      if (spareFeet.some((F) => overlaps(mine, F))) return false;
      const abs = t0 + dt + offset;
      for (let h = 0; h < higher.length; h++) {
        const other = higher[h];
        const o = poseAt(s, s.forklifts[h], other, mod(abs - other.offset, CYCLE));
        if (overlaps(mine, footprint(o.x, o.z, o.heading))) return false;
      }
    }
    return true;
  };
  const wait = (secs: number, status: FlStatus, detail: string) => {
    const last = segs[segs.length - 1];
    if (last && last.type === 'idle' && Math.abs(last.t1 - t) < 1e-9 && last.detail === detail) last.t1 = t + secs;
    else segs.push({ t0: t, t1: t + secs, type: 'idle', at: cur.stop, face: cur.face, carrying, status, detail, work0: work });
    t += secs;
  };
  const drive = (pts: V2[], status: FlStatus, detail: string, latest = Infinity) => {
    const len = polyLength(pts);
    if (len < 0.01) return true;
    // wait at the current stop until the whole trip is clear of other forklifts
    while (!clear(pts, t)) {
      if (t + 0.5 > latest) return false;
      wait(0.5, status === 'to-charger' ? 'to-charger' : 'idle', 'Giving way to traffic');
    }
    const d = len / FL_SPEED;
    segs.push({ t0: t, t1: t + d, type: 'drive', pts, len, carrying, status, detail, work0: work });
    t += d;
    work += d;
    return true;
  };
  const handle = (n: RouteNode, carryingAfter: boolean, status: FlStatus, detail: string, drop: boolean) => {
    segs.push({ t0: t, t1: t + HANDLE, type: 'handle', at: n.stop, face: n.face, carrying: carryingAfter, status, detail, drop, work0: work });
    carrying = carryingAfter;
    t += HANDLE;
    work += HANDLE;
    if (drop) drops.push(t);
  };
  const trip = (src: RouteNode, dst: RouteNode, status: FlStatus, detail: string, deadline: number, toBay: boolean) => {
    const p1 = route(cur, src);
    const p2 = route(src, dst);
    const dur = (polyLength(p1) + polyLength(p2)) / FL_SPEED + HANDLE * 2;
    if (t + dur > deadline) return false;
    if (!drive(p1, status, detail, deadline - dur)) return false;
    cur = src;
    handle(src, true, status, detail, false);
    // loaded leg: hold the pallet at the stop until the way is clear
    drive(p2, status, detail);
    cur = dst;
    handle(dst, false, status, detail, true);
    if (toBay) bayDrops.push(t);
    return true;
  };
  const idleUntil = (deadline: number, detail: string) => {
    const back = route(cur, home);
    if (cur !== home && deadline - t > polyLength(back) / FL_SPEED + 12 && polyLength(back) > 0.5) {
      if (drive(back, 'to-charger', `Parking at ${chargerId}`, deadline - 4)) {
        cur = home;
        detail = `Parked at ${chargerId}`;
      }
    }
    if (deadline - t > 0.01) segs.push({ t0: t, t1: deadline, type: 'idle', at: cur.stop, face: cur.face, carrying, status: 'idle', detail, work0: work });
    t = Math.max(t, deadline);
  };
  const putawayUntil = (deadline: number) => {
    for (let guard = 0; guard < 80 && pool.length >= 2; guard++) {
      const a = pool[k % pool.length];
      const b = pool[(k + 1) % pool.length];
      if (!trip(a, b, 'putaway', `Moving pallet ${a.label} → ${b.label}`, deadline, false)) break;
      k++;
    }
    idleUntil(deadline, 'Waiting for next task');
  };

  const chargeStart = CYCLE - CHARGE_LEN;
  if (bay && ownDoor) {
    putawayUntil(T_DOCKED + 1);
    const dn = doorNode(ownDoor);
    const bn = bayNode(bay);
    const out = bay.kind === 'out';
    const maxPallets = 6 + (hash(`${s.id}:${bay.index}`) % 3);
    for (let n = 0; n < maxPallets; n++) {
      if (!trip(out ? dn : bn, out ? bn : dn, out ? 'loading' : 'unloading', `${out ? 'Loading' : 'Unloading'} {truck} at ${bay.id}`, T_UNDOCK - 4, true)) break;
    }
  }
  putawayUntil(chargeStart - 60);
  drive(route(cur, home), 'to-charger', `Heading to ${chargerId}`);
  cur = home;
  const cStart = Math.min(t, CYCLE - 20);
  const batteryAtCharge = FULL - DRAIN * work;
  segs.push({ t0: cStart, t1: CYCLE, type: 'charge', at: home.stop, face: home.face, carrying: false, status: 'charging', detail: `Charging at ${chargerId}`, work0: work });
  return { segs, offset, drops, bayDrops, chargeStart: cStart, batteryAtCharge };
}

/** Position on a forklift drive: keeps to one side of the centre line, easing onto it at the stops. */
/**
 * Position on a forklift drive. Forklifts keep to one side of the centre line (so opposite
 * directions pass each other) and steer smoothly into / out of that lane near the stops: the
 * lane offset eases in with a smoothstep and the heading turns by the matching steering angle.
 */
const LANE_EASE = 2.4; // metres to steer fully into the lane
function drivePose(pts: V2[], len: number, d: number) {
  const p = along(pts, d);
  const smooth = (x: number) => x * x * (3 - 2 * x);
  const dSmooth = (x: number) => 6 * x * (1 - x);
  const a = Math.min(1, d / LANE_EASE);
  const b = Math.min(1, (len - d) / LANE_EASE);
  let ramp: number;
  let slope: number; // d(ramp)/d(distance)
  if (a <= b) {
    ramp = smooth(a);
    slope = a < 1 ? dSmooth(a) / LANE_EASE : 0;
  } else {
    ramp = smooth(b);
    slope = b < 1 ? -dSmooth(b) / LANE_EASE : 0;
  }
  const steer = Math.atan(LANE_OFFSET * slope); // + towards the lane side (heading + 90°)
  return {
    x: p.x + Math.cos(p.heading) * LANE_OFFSET * ramp,
    z: p.z - Math.sin(p.heading) * LANE_OFFSET * ramp,
    heading: p.heading + steer,
  };
}

type Quad = number[][];
/** Forklift footprint with a safety margin: 1.6 wide, 1.4 behind / 2.5 ahead of its centre (forks). */
function footprint(x: number, z: number, h: number): Quad {
  const sn = Math.sin(h);
  const cs = Math.cos(h);
  return [[-0.8, -1.4], [0.8, -1.4], [0.8, 2.5], [-0.8, 2.5]].map(([lx, lz]) => [x + lx * cs + lz * sn, z - lx * sn + lz * cs]);
}
function overlaps(A: Quad, B: Quad): boolean {
  for (const poly of [A, B]) {
    for (let i = 0; i < 4; i++) {
      const [x1, z1] = poly[i];
      const [x2, z2] = poly[(i + 1) % 4];
      const nx = z2 - z1;
      const nz = x1 - x2;
      let aMin = Infinity, aMax = -Infinity, bMin = Infinity, bMax = -Infinity;
      for (const [x, z] of A) { const v = x * nx + z * nz; if (v < aMin) aMin = v; if (v > aMax) aMax = v; }
      for (const [x, z] of B) { const v = x * nx + z * nz; if (v < bMin) bMin = v; if (v > bMax) bMax = v; }
      if (aMax < bMin || bMax < aMin) return false;
    }
  }
  return true;
}

// ─── Snapshots ────────────────────────────────────────────────────────────────

export interface ForkliftSnap {
  def: ForkliftDef;
  x: number;
  z: number;
  heading: number;
  carrying: boolean;
  status: FlStatus;
  statusLabel: string;
  tone: Tone;
  detail: string;
  battery: number;
  movesToday: number;
  speedKmh: number;
  charger: string;
  spare?: boolean;
  /** 0..1 fork height while picking / dropping */
  lift: number;
  /** waiting at a stop for another forklift to clear */
  givingWay: boolean;
}

const FL_LABEL: Record<FlStatus, [string, Tone]> = {
  loading: ['Loading truck', 'green'],
  unloading: ['Unloading', 'green'],
  putaway: ['Put-away', 'blue'],
  charging: ['Charging', 'amber'],
  idle: ['Idle', 'slate'],
  'to-charger': ['To charger', 'amber'],
  parked: ['Parked', 'slate'],
};

/** Segment at frame time u (segments are chronological → binary search). */
function segAt(plan: Plan, u: number): Seg {
  const g = plan.segs;
  let lo = 0;
  let hi = g.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (g[mid].t0 <= u) lo = mid;
    else hi = mid - 1;
  }
  return g[lo];
}

export function forkliftAt(s: SiteDef, f: ForkliftDef, nowSec: number): ForkliftSnap {
  const plan = planFor(s, f);
  const u = mod(nowSec - plan.offset, CYCLE);
  return poseAt(s, f, plan, u, segAt(plan, u), nowSec);
}

function poseAt(s: SiteDef, f: ForkliftDef, plan: Plan, u: number, segIn?: Seg, nowSec = 0): ForkliftSnap {
  const seg = segIn || segAt(plan, u);
  let x: number;
  let z: number;
  let heading: number;
  let speedKmh = 0;
  if (seg.type === 'drive' && seg.pts) {
    const len = seg.len || 0;
    const q = drivePose(seg.pts, len, ((u - seg.t0) / (seg.t1 - seg.t0)) * len);
    x = q.x;
    z = q.z;
    heading = q.heading;
    speedKmh = FL_SPEED * 3.6;
  } else {
    [x, z] = seg.at || [0, 0];
    heading = seg.face || 0;
    // pivot on the spot towards the next drive before pulling away (no instant flips). The turn
    // spans the whole time standing at this stop (handling + any give-way wait), so short waits
    // never make the heading jump.
    const idx = plan.segs.indexOf(seg);
    let n = idx;
    let next = plan.segs[(n + 1) % plan.segs.length];
    let departAt = seg.t1;
    for (let guard = 0; guard < 6 && next.type !== 'drive'; guard++) {
      n = (n + 1) % plan.segs.length;
      if (n === 0) break; // don't look past the end of the cycle
      departAt = next.t1;
      next = plan.segs[(n + 1) % plan.segs.length];
    }
    const left = departAt - u;
    if (next.type === 'drive' && next.pts && left < TURN) {
      const target = startHeading(next.pts);
      let dh = target - heading;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      heading += dh * (1 - left / TURN);
    }
  }
  let battery: number;
  if (seg.type === 'charge') battery = plan.batteryAtCharge + ((FULL - plan.batteryAtCharge) * (u - seg.t0)) / Math.max(1, seg.t1 - seg.t0);
  else battery = FULL - DRAIN * (seg.work0 + (seg.type === 'idle' ? 0 : u - seg.t0));
  const elapsed = nowSec - istMidnightSec(nowSec);
  const movesToday = Math.floor(elapsed / CYCLE) * plan.drops.length + plan.drops.filter((d) => d <= u).length;
  let detail = seg.detail;
  if (detail.includes('{truck}') && f.bay !== undefined) detail = detail.replace('{truck}', truckIdentity(s, s.bays[f.bay], nowSec).id);
  const [statusLabel, tone] = FL_LABEL[seg.status];
  const lift = seg.type === 'handle' ? Math.sin(Math.min(1, Math.max(0, (u - seg.t0) / (seg.t1 - seg.t0))) * Math.PI) : 0;
  const givingWay = seg.type === 'idle' && seg.detail === 'Giving way to traffic';
  return {
    def: f, x, z, heading, carrying: seg.carrying, status: seg.status, statusLabel: givingWay ? 'Giving way' : statusLabel, tone: givingWay ? 'amber' : tone,
    detail, battery: Math.round(battery), movesToday, speedKmh, charger: s.chargers[f.charger].id, lift, givingWay,
  };
}

export function spareForklifts(s: SiteDef): ForkliftSnap[] {
  return s.spareParks.map((p, i) => ({
    def: { id: `${s.code}-SP${i + 1}`, operator: 'Unassigned', model: 'Toyota 8FBE18', charger: 0 },
    x: p[0],
    z: p[1],
    heading: 0,
    carrying: false,
    status: 'parked' as FlStatus,
    statusLabel: 'Parked',
    tone: 'slate' as Tone,
    detail: 'Spare · fully charged',
    battery: 100,
    movesToday: 0,
    speedKmh: 0,
    charger: '—',
    spare: true,
    lift: 0,
    givingWay: false,
  }));
}

export interface ChargerSnap {
  id: string;
  busy: boolean;
  forklift?: string;
  battery?: number;
  sessionsToday: number;
  energyKwh: number;
  ratePerMin: number;
}

export function chargerAt(s: SiteDef, index: number, nowSec: number): ChargerSnap {
  const users = s.forklifts.filter((f) => f.charger === index);
  const charging = users.map((f) => forkliftAt(s, f, nowSec)).find((x) => x.status === 'charging');
  const elapsed = nowSec - istMidnightSec(nowSec);
  const sessions = Math.floor(elapsed / CYCLE) * users.length + (charging ? 1 : 0);
  const plan = users[0] ? planFor(s, users[0]) : undefined;
  const rate = plan ? (FULL - plan.batteryAtCharge) / ((CYCLE - plan.chargeStart) / 60) : 0;
  return { id: s.chargers[index].id, busy: !!charging, forklift: charging?.def.id, battery: charging?.battery, sessionsToday: sessions, energyKwh: Math.round(sessions * 2.4 * 10) / 10, ratePerMin: Math.round(rate) };
}

// ─── Trucks ───────────────────────────────────────────────────────────────────

export type TruckPhase = 'road' | 'docking' | 'docked' | 'departing' | 'enroute' | 'away' | 'none';

export interface ShipmentStep {
  label: string;
  at?: string;
  done: boolean;
}

export interface TruckSnap {
  key: string;
  id: string;
  carrier: Carrier;
  driver: string;
  plate: string;
  bay: Bay;
  kind: DoorKind;
  phase: TruckPhase;
  x: number;
  z: number;
  heading: number;
  pallets: { done: number; total: number };
  label: string; // "Loading 3/6", "Docking", "En route"
  tone: Tone;
  detail: string; // "Reversing into Bay 2"
  shipmentId: string;
  from: string;
  to: string;
  steps: ShipmentStep[];
  current: number;
  eta?: string; // ISO
  metersLeft?: number;
  speedKmh: number;
  ribbon?: V2[]; // remaining docking route
  live?: boolean;
  cargoTonnes: number;
}

export function truckIdentity(s: SiteDef, bay: Bay, nowSec: number) {
  const start = bayOffset(s, bay.index);
  const n = Math.floor((nowSec - start) / CYCLE);
  const h = hash(`${s.id}:${bay.index}:${n}`);
  return {
    n,
    id: `TRK-${2000 + (h % 800)}`,
    carrier: CARRIERS[h % CARRIERS.length],
    driver: DRIVERS[(h >>> 5) % DRIVERS.length],
    plate: `TN-${10 + (h % 80)}-${String.fromCharCode(65 + (h % 26))}${String.fromCharCode(65 + ((h >>> 3) % 26))}-${1000 + (h % 9000)}`,
    shipmentId: `SHP-${78000 + (h % 999)}`,
  };
}

const iso = (sec: number) => new Date(sec * 1000).toISOString();
const remaining = (pts: V2[], d: number): V2[] => {
  const p = along(pts, d);
  let acc = 0;
  const out: V2[] = [[p.x, p.z]];
  for (let i = 1; i < pts.length; i++) {
    acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (acc > d) out.push(pts[i]);
  }
  return out;
};

function bayPallets(s: SiteDef, bay: Bay, u: number) {
  const f = s.forklifts.find((x) => x.bay === bay.index);
  if (!f) {
    const total = 6;
    return { total, done: u < T_DOCKED ? 0 : u >= T_UNDOCK ? total : Math.floor(((u - T_DOCKED) / (T_UNDOCK - T_DOCKED)) * total) };
  }
  const plan = planFor(s, f);
  return { total: Math.max(1, plan.bayDrops.length), done: u < T_DOCKED ? 0 : plan.bayDrops.filter((d) => d <= u).length };
}

function simTruck(s: SiteDef, bay: Bay, nowSec: number): TruckSnap {
  const start = bayOffset(s, bay.index);
  const u = mod(nowSec - start, CYCLE);
  const cycleStart = nowSec - u;
  const id = truckIdentity(s, bay, nowSec);
  const { forward, reverse } = truckArrival(s, bay);
  const depart = truckDeparture(s, bay);
  const lf = polyLength(forward);
  const lr = polyLength(reverse);
  const ld = polyLength(depart);
  const pal = bayPallets(s, bay, u);
  const inbound = bay.kind === 'in';
  const arriveAt = cycleStart + T_DOCKED;
  const undockAt = cycleStart + T_UNDOCK;
  const base = {
    key: `${s.id}:${bay.index}`,
    id: id.id,
    carrier: id.carrier,
    driver: id.driver,
    plate: id.plate,
    bay,
    kind: bay.kind,
    shipmentId: id.shipmentId,
    from: inbound ? s.inboundFrom : s.name,
    to: inbound ? s.name : s.outboundTo,
    cargoTonnes: Math.round(pal.total * 0.9 * 10) / 10,
  };
  const steps: ShipmentStep[] = inbound
    ? [
        { label: 'Order confirmed', at: iso(arriveAt - 11400), done: true },
        { label: 'Picked', at: iso(arriveAt - 8400), done: true },
        { label: 'Loaded', at: iso(arriveAt - 5700), done: true },
        { label: 'In transit', at: iso(arriveAt - 3300), done: u >= T_DOCKED },
        { label: `Unloading ${pal.done}/${pal.total}`, at: iso(undockAt), done: u >= T_UNDOCK },
      ]
    : [
        { label: 'Order confirmed', at: iso(arriveAt - 3000), done: true },
        { label: 'Picked', at: iso(arriveAt - 900), done: true },
        { label: `Loading ${pal.done}/${pal.total}`, at: iso(undockAt), done: u >= T_UNDOCK },
        { label: 'In transit', at: iso(undockAt + 30), done: false },
        { label: 'Delivered', at: iso(undockAt + 2400), done: false },
      ];
  const current = Math.max(0, steps.findIndex((x) => !x.done));

  if (u < T_FWD) {
    const d = (u / T_FWD) * lf;
    const p = along(forward, d);
    const nearGate = d < lf * 0.55;
    return {
      ...base, phase: nearGate ? 'road' : 'docking', x: p.x, z: p.z, heading: p.heading, pallets: { done: 0, total: pal.total },
      label: nearGate ? 'At gate' : 'Docking', tone: nearGate ? 'amber' : 'blue', detail: nearGate ? `Arriving · ${bay.id}` : `Heading to ${bay.id}`,
      steps, current, eta: iso(arriveAt), metersLeft: Math.round(lf - d + lr), speedKmh: Math.round((lf / T_FWD) * 3.6), ribbon: [...remaining(forward, d), ...reverse.slice(1)],
    };
  }
  if (u < T_DOCKED) {
    const d = ((u - T_FWD) / (T_DOCKED - T_FWD)) * lr;
    const p = along(reverse, d);
    let heading = p.heading + Math.PI;
    const ease = (u - T_FWD) / 1.5;
    if (ease < 1) {
      const fwdEnd = along(forward, lf).heading;
      let dh = heading - fwdEnd;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      heading = fwdEnd + dh * ease;
    }
    return {
      ...base, phase: 'docking', x: p.x, z: p.z, heading, pallets: { done: 0, total: pal.total },
      label: 'Docking', tone: 'blue', detail: `Reversing into ${bay.id}`, steps, current, eta: iso(arriveAt), metersLeft: Math.round(lr - d),
      speedKmh: Math.round((lr / (T_DOCKED - T_FWD)) * 3.6), ribbon: remaining(reverse, d),
    };
  }
  if (u < T_UNDOCK) {
    const done = pal.done >= pal.total;
    return {
      ...base, phase: 'docked', x: bay.x, z: TRUCK_CENTER_Z, heading: 0, pallets: pal,
      label: done ? (inbound ? 'Unloaded' : 'Loaded') : `${inbound ? 'Unloading' : 'Loading'} ${pal.done}/${pal.total}`, tone: 'green',
      detail: `${s.code} · ${bay.id}`, steps, current, eta: iso(undockAt), speedKmh: 0,
    };
  }
  if (u < T_GONE) {
    const d = ((u - T_UNDOCK) / (T_GONE - T_UNDOCK)) * ld;
    const p = along(depart, d);
    return {
      ...base, phase: 'departing', x: p.x, z: p.z, heading: p.heading, pallets: { done: pal.total, total: pal.total },
      label: 'Departing', tone: 'purple', detail: inbound ? `Returning to ${base.from}` : `To ${base.to}`, steps, current, speedKmh: Math.round((ld / (T_GONE - T_UNDOCK)) * 3.6),
    };
  }
  // Bay empty — the next truck is on its way
  const next = truckIdentity(s, bay, nowSec + CYCLE);
  const etaSec = cycleStart + CYCLE + T_DOCKED;
  return {
    ...base, id: next.id, carrier: next.carrier, driver: next.driver, plate: next.plate, shipmentId: next.shipmentId,
    phase: 'enroute', x: 0, z: 0, heading: 0, pallets: { done: 0, total: pal.total }, label: 'En route', tone: 'blue',
    detail: `ETA ${Math.max(1, Math.round((etaSec - nowSec) / 60))} min`, steps: steps.map((x, i) => ({ ...x, done: i < 3 && inbound ? true : i < 2 })), current: inbound ? 3 : 2,
    eta: iso(etaSec), speedKmh: 0,
  };
}

/** Bays driven by the real fleet: truck i ↔ bay i. */
function liveTruck(s: SiteDef, bay: Bay, nowSec: number, fleet: FleetState | null): TruckSnap | null {
  const truck = fleet?.trucks[bay.index];
  if (!truck) return null;
  const dispatch = dispatchCovering(fleet!, truck.id, nowSec);
  const now = nowSec * 1000;
  const st = truckSiteState(truck, dispatch, now);
  const ship = shipmentSteps(truck, dispatch, now);
  const base = {
    key: `${s.id}:${bay.index}`, id: truck.id, carrier: PLANTOPS, driver: truck.driverName, plate: truck.name, bay, kind: 'out' as DoorKind,
    shipmentId: dispatch?.id || `Next load · ${truck.id}`, from: s.name, to: dispatch?.destinationName || 'Awaiting dispatch',
    steps: ship.steps, current: Math.max(0, ship.current), live: true,
    cargoTonnes: dispatch ? dispatch.tonnage : Math.round(truck.loadedPallets * (fleet!.config.palletTonnes || 1.2) * 10) / 10,
  };
  const pallets = dispatch ? { done: dispatch.palletCount, total: dispatch.palletCount } : { done: truck.loadedPallets, total: truck.capacityPallets };
  if (st.phase === 'docked') {
    return { ...base, phase: 'docked', x: bay.x, z: TRUCK_CENTER_Z, heading: 0, pallets, label: st.label, tone: st.tone, detail: `${s.code} · ${bay.id}`, speedKmh: 0 };
  }
  if (st.phase === 'departing') {
    const path = truckDeparture(s, bay);
    const p = along(path, st.progress * polyLength(path));
    return { ...base, phase: 'departing', x: p.x, z: p.z, heading: p.heading, pallets, label: 'Departing', tone: 'purple', detail: `To ${base.to}`, speedKmh: 24 };
  }
  if (st.phase === 'arriving') {
    const { forward, reverse } = truckArrival(s, bay);
    const lf = polyLength(forward);
    const lr = polyLength(reverse);
    const d = st.progress * (lf + lr);
    if (d < lf) {
      const p = along(forward, d);
      return { ...base, phase: 'docking', x: p.x, z: p.z, heading: p.heading, pallets, label: 'Docking', tone: 'blue', detail: `Heading to ${bay.id}`, metersLeft: Math.round(lf + lr - d), speedKmh: 20, ribbon: [...remaining(forward, d), ...reverse.slice(1)] };
    }
    const p = along(reverse, d - lf);
    return { ...base, phase: 'docking', x: p.x, z: p.z, heading: p.heading + Math.PI, pallets, label: 'Docking', tone: 'blue', detail: `Reversing into ${bay.id}`, metersLeft: Math.round(lf + lr - d), speedKmh: 6, ribbon: remaining(reverse, d - lf) };
  }
  return { ...base, phase: 'away', x: 0, z: 0, heading: 0, pallets, label: st.label.replace(/^To .*/, 'In transit'), tone: st.tone, detail: st.label, speedKmh: 60 };
}

export function truckAt(s: SiteDef, bay: Bay, nowSec: number, fleet: FleetState | null): TruckSnap | null {
  return s.liveFleet ? liveTruck(s, bay, nowSec, fleet) : simTruck(s, bay, nowSec);
}

export const onYard = (t: TruckSnap | null) => !!t && (t.phase === 'road' || t.phase === 'docking' || t.phase === 'docked' || t.phase === 'departing');

// ─── Site summary ─────────────────────────────────────────────────────────────

export interface SiteSnapshot {
  trucks: (TruckSnap | null)[]; // per bay
  forklifts: ForkliftSnap[];
  spares: ForkliftSnap[];
  chargers: ChargerSnap[];
  staged: number;
  docked: number;
  arriving: number;
  outboundToday: number;
  inboundToday: number;
  putawaysToday: number;
}

export function siteSnapshot(s: SiteDef, nowSec: number, fleet: FleetState | null): SiteSnapshot {
  const trucks = s.bays.map((b) => truckAt(s, b, nowSec, fleet));
  const forklifts = s.forklifts.map((f) => forkliftAt(s, f, nowSec));
  const elapsed = nowSec - istMidnightSec(nowSec);
  const cycles = Math.floor(elapsed / CYCLE);
  const staged = s.liveFleet ? Math.min(s.slots.length, fleet?.dock.count ?? 0) : Math.round(s.slots.length * 0.4) + (hash(`${s.id}:${cycles}`) % Math.max(2, Math.round(s.slots.length * 0.35)));
  return {
    trucks,
    forklifts,
    spares: spareForklifts(s),
    chargers: s.chargers.map((_, i) => chargerAt(s, i, nowSec)),
    staged,
    docked: trucks.filter((t) => t?.phase === 'docked').length,
    arriving: trucks.filter((t) => t?.phase === 'road' || t?.phase === 'docking').length,
    outboundToday: s.liveFleet ? fleet?.today.deliveries ?? 0 : cycles * s.bays.filter((b) => b.kind === 'out').length,
    inboundToday: s.liveFleet ? 0 : cycles * s.bays.filter((b) => b.kind === 'in').length,
    putawaysToday: forklifts.reduce((a, f) => a + f.movesToday, 0),
  };
}

// ─── History, events and analytics (all derived from the same deterministic model) ──

export const TIMING = { CYCLE, T_FWD, T_DOCKED, T_UNDOCK, T_GONE, FL_SPEED };

/** The live-fleet dispatch (active or recently completed) whose trip covers `atSec`. */
export function dispatchCovering(fleet: FleetState, truckId: string, atSec: number) {
  const all = [...fleet.activeDispatches, ...(fleet.recentDispatches || [])].filter((d) => d.truckId === truckId);
  return all.find((d) => {
    const t0 = Date.parse(d.dispatchedAt) / 1000;
    return atSec >= t0 && atSec < t0 + d.outboundSeconds + d.unloadSeconds + d.returnSeconds;
  });
}

/** Forklift serving a bay (if any). */
export const forkliftForBay = (s: SiteDef, bayIndex: number) => s.forklifts.find((f) => f.bay === bayIndex);

/** Frame times (within the bay cycle) at which pallets go into / come out of the truck. */
export function bayDropTimes(s: SiteDef, bay: Bay): number[] {
  const f = forkliftForBay(s, bay.index);
  if (f) return planFor(s, f).bayDrops;
  const n = 6;
  return Array.from({ length: n }, (_, i) => T_DOCKED + ((i + 1) * (T_UNDOCK - T_DOCKED)) / (n + 1));
}

export interface BayVisit {
  truckId: string;
  carrier: string;
  kind: DoorKind;
  start: number; // arrives on the road / starts loading (abs sec)
  docked: number;
  undock: number;
  gone: number;
  pallets: number;
  live?: boolean;
}

/** Truck visits at a bay overlapping [fromSec, toSec]. */
export function bayVisits(s: SiteDef, bay: Bay, fromSec: number, toSec: number, fleet: FleetState | null): BayVisit[] {
  if (s.liveFleet) {
    const truck = fleet?.trucks[bay.index];
    if (!truck || !fleet) return [];
    const trips = [...fleet.activeDispatches, ...(fleet.recentDispatches || [])]
      .filter((d) => d.truckId === truck.id)
      .sort((a, b) => Date.parse(a.dispatchedAt) - Date.parse(b.dispatchedAt));
    const out: BayVisit[] = [];
    let prevBack = fromSec;
    for (const d of trips) {
      const t0 = Date.parse(d.dispatchedAt) / 1000;
      const back = t0 + d.outboundSeconds + d.unloadSeconds + d.returnSeconds;
      const loadFrom = Math.max(prevBack, t0 - 1800);
      if (t0 >= fromSec && loadFrom <= toSec) {
        out.push({ truckId: truck.id, carrier: PLANTOPS.name, kind: 'out', start: loadFrom, docked: loadFrom, undock: t0, gone: t0 + d.outboundSeconds * 0.08, pallets: d.palletCount, live: true });
      }
      prevBack = back;
    }
    // currently at the dock (loading, not yet dispatched)
    if (!dispatchCovering(fleet, truck.id, toSec)) {
      const since = Math.max(prevBack, truck.lastReturnedAt ? Date.parse(truck.lastReturnedAt) / 1000 : fromSec, fromSec);
      if (since < toSec) out.push({ truckId: truck.id, carrier: PLANTOPS.name, kind: 'out', start: since, docked: since, undock: toSec, gone: toSec, pallets: truck.loadedPallets, live: true });
    }
    return out;
  }
  const off = bayOffset(s, bay.index);
  const first = Math.floor((fromSec - off - T_GONE) / CYCLE);
  const last = Math.floor((toSec - off) / CYCLE);
  const total = Math.max(1, bayDropTimes(s, bay).length);
  const out: BayVisit[] = [];
  for (let n = first; n <= last; n++) {
    const start = off + n * CYCLE;
    if (start + T_GONE < fromSec || start > toSec) continue;
    const id = truckIdentity(s, bay, start + 1);
    out.push({ truckId: id.id, carrier: id.carrier.name, kind: bay.kind, start, docked: start + T_DOCKED, undock: start + T_UNDOCK, gone: start + T_GONE, pallets: total });
  }
  return out;
}

export interface TimelineEvent {
  label: string;
  at: number; // abs sec
  done: boolean;
}

/** Step-by-step events of the truck currently assigned to a bay (this visit). */
export function truckEvents(s: SiteDef, bay: Bay, nowSec: number, fleet: FleetState | null): TimelineEvent[] {
  if (s.liveFleet) {
    const truck = fleet?.trucks[bay.index];
    if (!truck || !fleet) return [];
    const d = dispatchCovering(fleet, truck.id, nowSec);
    if (!d) {
      const since = truck.lastReturnedAt ? Date.parse(truck.lastReturnedAt) / 1000 : nowSec;
      return [
        { label: `Back at dock · ${bay.id}`, at: since, done: true },
        { label: `Loading ${truck.loadedPallets}/${truck.capacityPallets} pallets`, at: nowSec, done: truck.isReady },
        { label: 'Dispatch when full', at: nowSec, done: false },
      ];
    }
    const t0 = Date.parse(d.dispatchedAt) / 1000;
    const ev = [
      { label: `Dispatched with ${d.palletCount} pallets`, at: t0 },
      { label: 'Gate out', at: t0 + d.outboundSeconds * 0.08 },
      { label: `Arrived at ${d.destinationName}`, at: d.arrivedAt ? Date.parse(d.arrivedAt) / 1000 : t0 + d.outboundSeconds },
      { label: 'Unloaded · heading back', at: t0 + d.outboundSeconds + d.unloadSeconds },
      { label: 'Back at plant', at: t0 + d.outboundSeconds + d.unloadSeconds + d.returnSeconds },
    ];
    return ev.map((e) => ({ ...e, done: e.at <= nowSec }));
  }
  const off = bayOffset(s, bay.index);
  let u = mod(nowSec - off, CYCLE);
  let cycleStart = nowSec - u;
  if (u >= T_GONE) {
    // bay empty: show the next visit
    cycleStart += CYCLE;
    u -= CYCLE;
  }
  const inbound = bay.kind === 'in';
  const drops = bayDropTimes(s, bay);
  const ev: { label: string; at: number }[] = [
    { label: 'On approach road', at: cycleStart },
    { label: 'Through the gate', at: cycleStart + T_FWD * 0.55 },
    { label: `Reversing into ${bay.id}`, at: cycleStart + T_FWD },
    { label: 'Docked', at: cycleStart + T_DOCKED },
    ...drops.map((t, i) => ({ label: `Pallet ${i + 1}/${drops.length} ${inbound ? 'unloaded' : 'loaded'}`, at: cycleStart + t })),
    { label: 'Undocked', at: cycleStart + T_UNDOCK },
    { label: 'Gate out', at: cycleStart + T_UNDOCK + (T_GONE - T_UNDOCK) * 0.45 },
  ];
  return ev.map((e) => ({ ...e, done: e.at <= nowSec }));
}

export interface TaskEntry {
  at: number; // abs sec the pallet was dropped
  label: string;
  status: FlStatus;
}

/** Last `n` completed pallet moves of a forklift. */
export function forkliftTaskLog(s: SiteDef, f: ForkliftDef, nowSec: number, n = 10): TaskEntry[] {
  const plan = planFor(s, f);
  const u = mod(nowSec - plan.offset, CYCLE);
  const cycleStart = nowSec - u;
  const out: TaskEntry[] = [];
  for (const back of [0, 1]) {
    for (const g of plan.segs) {
      if (!g.drop) continue;
      const at = cycleStart - back * CYCLE + g.t1;
      if (at > nowSec) continue;
      let label = g.detail;
      if (label.includes('{truck}') && f.bay !== undefined) label = label.replace('{truck}', truckIdentity(s, s.bays[f.bay], at).id);
      out.push({ at, label, status: g.status });
    }
  }
  return out.sort((a, b) => b.at - a.at).slice(0, n);
}

/** Share of the cycle a forklift spends working / giving way / idle / charging. */
export function forkliftUtilisation(s: SiteDef, f: ForkliftDef) {
  const plan = planFor(s, f);
  const acc = { working: 0, givingWay: 0, idle: 0, charging: 0 };
  for (const g of plan.segs) {
    const d = Math.max(0, Math.min(CYCLE, g.t1) - g.t0);
    if (g.type === 'charge') acc.charging += d;
    else if (g.type === 'idle') (g.detail === 'Giving way to traffic' ? (acc.givingWay += d) : (acc.idle += d));
    else acc.working += d;
  }
  const sum = acc.working + acc.givingWay + acc.idle + acc.charging || 1;
  return { working: acc.working / sum, givingWay: acc.givingWay / sum, idle: acc.idle / sum, charging: acc.charging / sum, movesPerHour: Math.round((plan.drops.length * 3600) / CYCLE) };
}

/** Battery level over the last `minutes` (oldest first). */
export function batterySeries(s: SiteDef, f: ForkliftDef, nowSec: number, minutes = 10, points = 30): number[] {
  return Array.from({ length: points }, (_, i) => forkliftAt(s, f, nowSec - ((points - 1 - i) * minutes * 60) / (points - 1)).battery);
}

/** Positions sampled along every forklift drive of a site (for the traffic heatmap). */
export function forkliftTraffic(s: SiteDef): V2[] {
  const out: V2[] = [];
  for (const f of s.forklifts) {
    for (const g of planFor(s, f).segs) {
      if (g.type !== 'drive' || !g.pts || !g.len) continue;
      for (let d = 0; d <= g.len; d += FL_SPEED) {
        const q = drivePose(g.pts, g.len, d);
        out.push([q.x, q.z]);
      }
    }
  }
  return out;
}
