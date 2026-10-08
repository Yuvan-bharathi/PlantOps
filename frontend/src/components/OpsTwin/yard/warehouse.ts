/**
 * Warehouse interior model: pallet racking, receiving / shipping zones, a role-specific process area and
 * reach trucks doing put-away and picking runs. Everything is a deterministic function of the
 * building geometry and wall-clock time (same as the yard model), so every viewer sees the
 * same warehouse and replay works.
 *
 * Interior frame: x across the building (centre 0), front wall (doors) at z = 0, back wall at z = -depth.
 */
import { along, Building, DoorKind, polyLength, roundCorners, SiteDef, V2 } from './layout';
import { EquipItem, EquipKind, KIND } from './equipment';

export const RACK_DEPTH = 1.25; // one rack row (pallet depth)
export const AISLE_W = 3.3;
export const BAY_LEN = 2.7; // one bay along a rack row
export const LEVEL_H = 1.55;
const SPEED = 2.2; // m/s reach-truck speed
const HANDLE = 5; // s to lift / lower a pallet

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};
const mod = (a: number, n: number) => ((a % n) + n) % n;

export interface WhDoor {
  id: string;
  x: number; // interior x
  kind: DoorKind;
}

export interface Aisle {
  id: string; // "A"
  index: number;
  x: number; // aisle centre line
  z0: number; // aisle mouth (front)
  z1: number; // aisle end (back)
  bays: number;
  levels: number;
}

export interface Zone {
  id: string;
  label: string;
  kind: 'receiving' | 'shipping' | 'storage' | 'equipment' | 'charging';
  x0: number;
  x1: number;
  z0: number; // front edge (higher z)
  z1: number; // back edge
}

export interface WhForklift {
  id: string;
  operator: string;
  aisles: number[]; // aisle indices this truck serves
  inDoor: WhDoor;
  outDoor: WhDoor;
  laneZ: number;
  period: number; // seconds per put-away + pick cycle
  offset: number;
}

export type WhRole = 'crossdock' | 'racked' | 'bulk' | 'fulfillment' | 'kitting' | 'service' | 'parts' | 'shipping' | 'terminal';

/** Building → interior type (what this section of the depot actually does). */
const ROLE_BY_BUILDING: Record<string, WhRole> = {
  'MC-A': 'crossdock',
  'MC-B': 'racked',
  'PR-A': 'bulk',
  'RW-A': 'fulfillment',
  'AS-A': 'kitting',
  'AS-B': 'racked',
  'MB-A': 'service',
  'MB-B': 'parts',
  'PK-A': 'shipping',
  'PK-B': 'terminal',
};

interface RoleSpec {
  label: string; // interior type shown in the UI
  area: string; // name of the process area
  rackFrac: number; // share of the width used by pallet racking (0 = none)
  maxLevels?: number;
  kit: EquipKind[]; // equipment in the process area (packed in order)
}

export const ROLE: Record<WhRole, RoleSpec> = {
  crossdock: { label: 'Cross-dock', area: 'Cross-dock lanes & QC', rackFrac: 0.3, kit: ['stagingLane', 'stagingLane', 'stagingLane', 'stagingLane', 'stagingLane', 'qcTable', 'qcTable', 'scale', 'labeler', 'conveyor'] },
  racked: { label: 'Pallet store', area: 'Wrap & dispatch', rackFrac: 0.74, kit: ['scale', 'wrapper', 'chargerBank'] },
  bulk: { label: 'Bulk & liquids store', area: 'Drum & IBC store', rackFrac: 0.36, maxLevels: 4, kit: ['blockStack', 'blockStack', 'blockStack', 'drumRack', 'drumRack', 'ibc', 'ibc', 'dispenser', 'scale'] },
  fulfillment: { label: 'High-bay fulfillment', area: 'Pick, pack & sort', rackFrac: 0.46, maxLevels: 6, kit: ['conveyor', 'conveyor', 'sorter', 'pickStation', 'pickStation', 'pickStation', 'packBench', 'packBench', 'packBench', 'labeler'] },
  kitting: { label: 'Kitting & sequencing', area: 'Kitting cells', rackFrac: 0.36, kit: ['cartonFlow', 'cartonFlow', 'cartonFlow', 'kitBench', 'kitBench', 'kitBench', 'kitBench', 'tugger'] },
  service: { label: 'Fleet service workshop', area: 'Service bays', rackFrac: 0, kit: ['vehicleLift', 'vehicleLift', 'vehicleLift', 'chargerBank', 'chargerBank', 'tyreChanger', 'compressor', 'toolCabinet', 'toolCabinet', 'workbench', 'workbench'] },
  parts: { label: 'Spares & tool crib', area: 'Issue counter & tool crib', rackFrac: 0.5, maxLevels: 4, kit: ['shelving', 'shelving', 'shelving', 'shelving', 'counter', 'toolCabinet', 'toolCabinet'] },
  shipping: { label: 'Outbound consolidation', area: 'Wrap, weigh & label', rackFrac: 0.42, kit: ['stagingLane', 'stagingLane', 'stagingLane', 'stagingLane', 'wrapper', 'wrapper', 'scale', 'labeler'] },
  terminal: { label: 'Shipping terminal', area: 'Dock staging & wrap', rackFrac: 0.45, kit: ['stagingLane', 'stagingLane', 'stagingLane', 'wrapper', 'scale', 'labeler'] },
};

export interface Warehouse {
  key: string; // `${siteId}:${buildingId}`
  site: SiteDef;
  building: Building;
  role: WhRole;
  width: number;
  depth: number;
  height: number;
  doors: WhDoor[];
  zones: Zone[];
  aisles: Aisle[];
  forklifts: WhForklift[];
  equipment: EquipItem[];
  sku: string; // product family stored here
}

const OPS = ['Ravi K', 'Divya S', 'Arun V', 'Meena L', 'Karthik P', 'Priya N', 'Naveen B', 'Kavya D'];
const SKU_FAMILY: Record<string, string> = {
  MACHINING: 'RAW',
  PROCESSING: 'BLK',
  ROBOT: 'FUL',
  ASSEMBLY: 'KIT',
  MAINTENANCE: 'SPR',
  PACKAGING: 'SHP',
};

const cache = new Map<string, Warehouse>();

/** Shelf-pack equipment footprints into a rectangle, row by row (front to back). */
function pack(kinds: EquipKind[], x0: number, x1: number, z0: number, z1: number, gap = 1.2): { kind: EquipKind; x: number; z: number }[] {
  const out: { kind: EquipKind; x: number; z: number }[] = [];
  let x = x0;
  let z = z0;
  let rowD = 0;
  for (const k of kinds) {
    const { w, d } = KIND[k];
    if (x + w > x1 && x > x0) {
      x = x0;
      z -= rowD + gap;
      rowD = 0;
    }
    if (z - d < z1 || x + w > x1) continue; // does not fit: skip
    out.push({ kind: k, x: x + w / 2, z: z - d / 2 });
    x += w + gap;
    rowD = Math.max(rowD, d);
  }
  return out;
}

export function warehouseFor(site: SiteDef, building: Building): Warehouse {
  const key = `${site.id}:${building.id}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const role: WhRole = ROLE_BY_BUILDING[building.id] || 'racked';
  const spec = ROLE[role];
  const w = building.width;
  const d = building.depth;
  const doors: WhDoor[] = building.doors.map((dr) => ({ id: dr.id, x: dr.x - building.x, kind: dr.kind }));
  const inDoors = doors.filter((x) => x.kind === 'in');
  const outDoors = doors.filter((x) => x.kind === 'out');

  // racking on the left part of the hall, the role's process area on the right
  const x0 = -w / 2 + 1.2;
  const pitch = AISLE_W + 2 * RACK_DEPTH;
  const geom = (frac: number) => {
    const racks = frac > 0;
    const n = racks ? Math.max(1, Math.floor(((w - 2.4) * frac) / pitch)) : 0;
    const nFork = !racks ? 0 : n >= 4 ? 3 : 2;
    const laneZs = Array.from({ length: Math.max(1, nFork) }, (_, i) => -7.2 - i * 1.5);
    const rackZ0 = racks ? laneZs[laneZs.length - 1] - 1.6 : -6.5;
    const rackX1 = x0 + n * pitch; // racks snap to whole aisles
    const px0 = (racks ? rackX1 : x0) + 1.2;
    const pz0 = racks ? rackZ0 : -6.8;
    return { racks, n, nFork, laneZs, rackZ0, rackX1, px0, pz0 };
  };
  // racking yields floor space until the whole kit of this building type fits
  let frac = spec.rackFrac;
  const fits = (f: number) => {
    const g = geom(f);
    return pack(spec.kit, g.px0, w / 2 - 1.4, g.pz0 - 0.6, -d + 1.2).length >= spec.kit.length;
  };
  while (frac > 0 && !fits(frac) && geom(frac - 0.04).n >= 1 && frac - 0.04 > 0.08) frac -= 0.04;
  const G = geom(frac);
  const hasRacks = G.racks;
  const { n, nFork, laneZs, rackZ0, rackX1 } = G;
  const rackZ1 = -d + 1.2;
  const bays = Math.max(2, Math.floor((rackZ0 - rackZ1) / BAY_LEN));
  const levels = Math.min(spec.maxLevels ?? 5, Math.max(3, Math.floor((building.height - 0.8) / LEVEL_H)));
  const start = x0 + RACK_DEPTH + AISLE_W / 2;
  const aisles: Aisle[] = Array.from({ length: n }, (_, i) => ({ id: String.fromCharCode(65 + i), index: i, x: start + i * pitch, z0: rackZ0, z1: rackZ0 - bays * BAY_LEN, bays, levels }));

  const zones: Zone[] = [];
  const span = (ds: WhDoor[]) => [Math.max(-w / 2 + 0.6, Math.min(...ds.map((x) => x.x)) - 4), Math.min(w / 2 - 0.6, Math.max(...ds.map((x) => x.x)) + 4)];
  if (inDoors.length) {
    const [a, b] = span(inDoors);
    zones.push({ id: 'RCV', label: role === 'service' ? 'Vehicle intake' : 'Receiving', kind: 'receiving', x0: a, x1: b, z0: -0.6, z1: -5.6 });
  }
  if (outDoors.length) {
    const [a, b] = span(outDoors);
    zones.push({ id: 'SHP', label: role === 'service' ? 'Vehicle release' : 'Shipping', kind: 'shipping', x0: a, x1: b, z0: -0.6, z1: -5.6 });
  }
  if (n) zones.push({ id: 'STO', label: `${role === 'parts' ? 'Spares racking' : 'Pallet racking'} · aisles ${aisles[0].id}–${aisles[n - 1].id}`, kind: 'storage', x0, x1: rackX1, z0: rackZ0 + 0.4, z1: rackZ1 - 0.4 });

  // process area: behind the forklift lanes (or the whole floor when there are no racks)
  const px0 = G.px0;
  const px1 = w / 2 - 1.4;
  const pz0 = G.pz0;
  const pz1 = -d + 1.2;
  zones.push({ id: 'PRC', label: spec.area, kind: 'equipment', x0: px0 - 0.6, x1: px1 + 0.6, z0: pz0 + 0.4, z1: pz1 - 0.4 });
  const counters: Record<string, number> = {};
  const equipment: EquipItem[] = pack(spec.kit, px0, px1, pz0 - 0.6, pz1).map((p) => {
    const ks = KIND[p.kind];
    counters[ks.code] = (counters[ks.code] || 0) + 1;
    const no = String(counters[ks.code]).padStart(2, '0');
    return { id: `${site.code}-${ks.code}-${no}`, kind: p.kind, label: `${ks.label} ${no}`, siteId: site.id, buildingId: building.id, x: p.x, z: p.z, rot: 0 };
  });
  // make ids unique across the buildings of a site
  if (!building.production) equipment.forEach((e) => (e.id = `${e.id.replace(`${site.code}-`, `${site.code}-${building.id.split('-').pop()}-`)}`));

  const forklifts: WhForklift[] = [];
  if (n) {
    const per = Math.ceil(n / nFork);
    for (let i = 0; i < nFork; i++) {
      const mine = aisles.slice(i * per, (i + 1) * per).map((a) => a.index);
      if (!mine.length) continue;
      const cx = aisles[mine[Math.floor(mine.length / 2)]].x;
      const nearest = (ds: WhDoor[]) => [...(ds.length ? ds : doors)].sort((a, b) => Math.abs(a.x - cx) - Math.abs(b.x - cx))[0];
      forklifts.push({
        id: `${site.code}-${building.id.split('-').pop()}-R${i + 1}`,
        operator: OPS[(hash(key) + i * 3) % OPS.length],
        aisles: mine,
        inDoor: nearest(inDoors),
        outDoor: nearest(outDoors),
        laneZ: laneZs[i],
        period: 0,
        offset: hash(`${key}:${i}`) % 997,
      });
    }
  }

  const wh: Warehouse = { key, site, building, role, width: w, depth: d, height: building.height, doors, zones, aisles, forklifts, equipment, sku: SKU_FAMILY[site.id] || 'GEN' };
  for (const f of forklifts) {
    let worst = 0;
    for (const ai of f.aisles) {
      const a = wh.aisles[ai];
      const deep = { aisle: a.index, side: 'L' as const, bay: a.bays, level: 1 };
      worst = Math.max(worst, cycleLength(wh, f, deep, deep));
    }
    f.period = Math.ceil(worst + 8);
  }
  cache.set(key, wh);
  return wh;
}

/** All equipment of a site (every building). */
export const siteEquipment = (site: SiteDef): EquipItem[] => site.buildings.flatMap((b) => warehouseFor(site, b).equipment);

// ─── Storage locations ────────────────────────────────────────────────────────

export interface Loc {
  aisle: number;
  side: 'L' | 'R';
  bay: number; // 1..bays
  level: number; // 1..levels
}

export const locId = (wh: Warehouse, l: Loc) => `${wh.aisles[l.aisle].id}-${l.side}${String(l.bay).padStart(2, '0')}-${l.level}`;

export function parseLoc(wh: Warehouse, id: string): Loc | null {
  const m = /^([A-Z])-([LR])(\d+)-(\d+)$/.exec(id);
  if (!m) return null;
  const aisle = m[1].charCodeAt(0) - 65;
  if (!wh.aisles[aisle]) return null;
  return { aisle, side: m[2] as 'L' | 'R', bay: Number(m[3]), level: Number(m[4]) };
}

/** World position (interior frame) of the pallet at a location. */
export function locPos(wh: Warehouse, l: Loc): [number, number, number] {
  const a = wh.aisles[l.aisle];
  const x = a.x + (l.side === 'L' ? -1 : 1) * (AISLE_W / 2 + RACK_DEPTH / 2);
  const z = a.z0 - (l.bay - 0.5) * BAY_LEN;
  return [x, 0.15 + (l.level - 1) * LEVEL_H, z];
}

export function allLocs(wh: Warehouse): Loc[] {
  const out: Loc[] = [];
  for (const a of wh.aisles) for (const side of ['L', 'R'] as const) for (let bay = 1; bay <= a.bays; bay++) for (let level = 1; level <= a.levels; level++) out.push({ aisle: a.index, side, bay, level });
  return out;
}

/** Target fill of the building drifts slowly through the day. */
export const fillTarget = (wh: Warehouse, nowSec: number) => 0.62 + 0.18 * Math.sin(nowSec / 5400 + (hash(wh.key) % 10)) * 0.9;

const SLOW = 900; // a location can change state at most every 15 min

export interface LocInfo {
  id: string;
  occupied: boolean;
  sku: string;
  description: string;
  qty: number;
  weightKg: number;
  receivedSec: number;
  lot: string;
}

const DESC: Record<string, string[]> = {
  RAW: ['Steel billets Ø60', 'Aluminium bar stock', 'Cold-rolled sheet', 'Bronze bushes'],
  BLK: ['Hydraulic oil 200 L', 'Coolant concentrate', 'Bulk resin', 'Lubricant drums'],
  FUL: ['Welded frames', 'Brackets kit', 'Sub-assembly A', 'Chassis rails'],
  KIT: ['Assembly kits', 'Harness sets', 'Fastener kits', 'Panel kits'],
  SPR: ['Bearings', 'Spindle spares', 'Filters & seals', 'Drive belts'],
  SHP: ['Packed assemblies', 'Export cartons', 'Palletised goods', 'Spare-part orders'],
  GEN: ['Mixed goods'],
};

export function locInfo(wh: Warehouse, l: Loc, nowSec: number): LocInfo {
  const id = locId(wh, l);
  const epoch = Math.floor((nowSec + (hash(id) % SLOW)) / SLOW);
  const h = hash(`${wh.key}:${id}:${epoch}`);
  const occupied = (h % 1000) / 1000 < fillTarget(wh, nowSec) - (l.level === 1 ? -0.08 : 0);
  const fam = DESC[wh.sku] || DESC.GEN;
  const sku = `${wh.sku}-${1000 + ((h >>> 4) % 9000)}`;
  const receivedSec = nowSec - (((h >>> 8) % 20) * 86400 + ((h >>> 12) % 86400));
  return {
    id,
    occupied,
    sku,
    description: fam[(h >>> 3) % fam.length],
    qty: 20 + ((h >>> 6) % 220),
    weightKg: 240 + ((h >>> 9) % 760),
    receivedSec,
    lot: `L${String((h >>> 2) % 100000).padStart(5, '0')}`,
  };
}

export interface WhStats {
  locations: number;
  occupied: number;
  byAisle: { id: string; occupied: number; total: number }[];
  receivingQueue: number;
  shippingQueue: number;
}

export function whStats(wh: Warehouse, nowSec: number): WhStats {
  let occ = 0;
  const byAisle = wh.aisles.map((a) => ({ id: a.id, occupied: 0, total: 0 }));
  for (const l of allLocs(wh)) {
    const o = locInfo(wh, l, nowSec).occupied;
    byAisle[l.aisle].total++;
    if (o) {
      occ++;
      byAisle[l.aisle].occupied++;
    }
  }
  const slot = Math.floor(nowSec / 120);
  return {
    locations: byAisle.reduce((a, b) => a + b.total, 0),
    occupied: occ,
    byAisle,
    receivingQueue: wh.doors.some((d) => d.kind === 'in') ? 2 + (hash(`${wh.key}:rq:${slot}`) % 7) : 0,
    shippingQueue: wh.doors.some((d) => d.kind === 'out') ? 1 + (hash(`${wh.key}:sq:${slot}`) % 6) : 0,
  };
}

// ─── Reach-truck cycles ───────────────────────────────────────────────────────

const doorStop = (d: WhDoor): V2 => [d.x, -2.4];

function legPath(wh: Warehouse, f: WhForklift, from: V2, to: V2, fromAisle: boolean, toAisle: boolean): V2[] {
  const pts: V2[] = [from];
  pts.push([from[0], f.laneZ]);
  pts.push([to[0], f.laneZ]);
  pts.push(to);
  void fromAisle;
  void toAisle;
  const clean = pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 1e-6);
  return roundCorners(clean, 1.1, 12);
}

const bayStop = (wh: Warehouse, l: Loc): V2 => {
  const a = wh.aisles[l.aisle];
  return [a.x, a.z0 - (l.bay - 0.5) * BAY_LEN];
};

function cycleLength(wh: Warehouse, f: WhForklift, put: Loc, pick: Loc) {
  const a = doorStop(f.inDoor);
  const b = bayStop(wh, put);
  const c = bayStop(wh, pick);
  const d = doorStop(f.outDoor);
  return (polyLength(legPath(wh, f, a, b, false, true)) + polyLength(legPath(wh, f, b, c, true, true)) + polyLength(legPath(wh, f, c, d, true, false)) + polyLength(legPath(wh, f, d, a, false, false))) / SPEED + HANDLE * 4;
}

function taskLocs(wh: Warehouse, f: WhForklift, n: number): { put: Loc; pick: Loc } {
  const pickOne = (salt: string): Loc => {
    const h = hash(`${wh.key}:${f.id}:${n}:${salt}`);
    const a = wh.aisles[f.aisles[h % f.aisles.length]];
    return { aisle: a.index, side: (h >>> 3) % 2 ? 'L' : 'R', bay: 1 + ((h >>> 5) % a.bays), level: 1 + ((h >>> 9) % a.levels) };
  };
  return { put: pickOne('put'), pick: pickOne('pick') };
}

export type ReachStatus = 'put-away' | 'retrieving' | 'to shipping' | 'returning' | 'lifting' | 'waiting';

export interface ReachSnap {
  f: WhForklift;
  x: number;
  z: number;
  heading: number;
  carrying: boolean;
  lift: number; // 0..1 mast height (fraction of the target level)
  liftLevel: number;
  status: ReachStatus;
  detail: string;
  battery: number;
  movesToday: number;
}

export function reachAt(wh: Warehouse, f: WhForklift, nowSec: number): ReachSnap {
  const t = nowSec + f.offset;
  const n = Math.floor(t / f.period);
  const u = mod(t, f.period);
  const { put, pick } = taskLocs(wh, f, n);
  const A = doorStop(f.inDoor);
  const B = bayStop(wh, put);
  const C = bayStop(wh, pick);
  const D = doorStop(f.outDoor);
  const legs: { pts: V2[]; carrying: boolean; status: ReachStatus; detail: string }[] = [
    { pts: legPath(wh, f, A, B, false, true), carrying: true, status: 'put-away', detail: `Putting away to ${locId(wh, put)}` },
    { pts: legPath(wh, f, B, C, true, true), carrying: false, status: 'retrieving', detail: `Retrieving from ${locId(wh, pick)}` },
    { pts: legPath(wh, f, C, D, true, false), carrying: true, status: 'to shipping', detail: `To ${f.outDoor.id} with ${locId(wh, pick)}` },
    { pts: legPath(wh, f, D, A, false, false), carrying: false, status: 'returning', detail: `Back to ${f.inDoor.id}` },
  ];
  const handleFace = [put.side === 'L' ? -Math.PI / 2 : Math.PI / 2, pick.side === 'L' ? -Math.PI / 2 : Math.PI / 2, Math.PI, Math.PI];
  const handleLevel = [put.level, pick.level, 1, 1];
  let acc = 0;
  const day = Math.floor((nowSec + 19800) / 86400) * 86400 - 19800;
  const movesToday = Math.max(0, Math.floor((nowSec - day) / f.period) * 2);
  const battery = Math.round(96 - ((nowSec - day) % 14400) / 14400 * 55);
  for (let i = 0; i < legs.length; i++) {
    const L = legs[i];
    const len = polyLength(L.pts);
    const dur = len / SPEED;
    if (u < acc + dur) {
      const p = along(L.pts, ((u - acc) / dur) * len);
      return { f, x: p.x, z: p.z, heading: p.heading, carrying: L.carrying, lift: 0, liftLevel: 1, status: L.status, detail: L.detail, battery, movesToday };
    }
    acc += dur;
    if (u < acc + HANDLE) {
      const end = L.pts[L.pts.length - 1];
      const k = (u - acc) / HANDLE;
      const prev = along(L.pts, len);
      // turn to face the rack / door during the first part of the handling, then lift + lower
      const turn = Math.min(1, k / 0.3);
      let dh = handleFace[i] - prev.heading;
      dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      const lift = k < 0.3 ? 0 : Math.sin(((k - 0.3) / 0.7) * Math.PI);
      const carryingNow = i === 0 ? k < 0.65 : i === 1 ? k >= 0.65 : i === 2 ? k < 0.65 : k >= 0.65;
      return {
        f,
        x: end[0],
        z: end[1],
        heading: prev.heading + dh * turn,
        carrying: carryingNow,
        lift,
        liftLevel: handleLevel[i],
        status: 'lifting',
        detail: i === 0 ? `Storing pallet at ${locId(wh, put)}` : i === 1 ? `Picking pallet at ${locId(wh, pick)}` : i === 2 ? `Dropping at ${f.outDoor.id}` : `Collecting at ${f.inDoor.id}`,
        battery,
        movesToday,
      };
    }
    acc += HANDLE;
  }
  // waiting for the next cycle at the receiving door
  return { f, x: A[0], z: A[1], heading: Math.PI, carrying: true, lift: 0, liftLevel: 1, status: 'waiting', detail: `Waiting at ${f.inDoor.id}`, battery, movesToday };
}

/** Pallet moves per hour across all trucks of the warehouse. */
export const whMovesPerHour = (wh: Warehouse) => wh.forklifts.reduce((a, f) => a + Math.round((2 * 3600) / f.period), 0);

/** Warehouses of a site, main hall first. */
export const siteWarehouses = (site: SiteDef) => [...site.buildings].sort((a, b) => Number(!!b.production) - Number(!!a.production)).map((b) => warehouseFor(site, b));
