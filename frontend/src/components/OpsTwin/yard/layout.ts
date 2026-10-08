/**
 * Yard layouts: every production cell is drawn as its own site (buildings with In/Out doors,
 * truck bays, staging lanes, a forklift charging area, a fenced compound and a gate onto the
 * public road). All coordinates are local to the site; `origin` places the site in the world.
 *
 * Site frame: building fronts sit on z = 0 (buildings extend to -z), the yard opens towards +z
 * and the public road runs along the south fence.
 */

export type V2 = [number, number]; // (x, z)

export const FRONT_Z = 0;
export const AISLE_Z = 6.5; // forklift main aisle (yellow dashed)
export const INSIDE_Z = -3.4; // where forklifts pick / drop inside a door
export const SLOT_ROWS = [11.9, 14.4]; // far enough from the aisle that a forklift at a slot stays out of the lane
export const SLOT_PITCH = 2.3;
export const BAY_REAR_Z = 14; // trailer rear line
export const TRUCK_CENTER_Z = 18.6;
export const LANE_Z = 29; // yard driving lane
export const FENCE_Z = 36;
export const ROAD_Z = 44; // public road centre
export const ROAD_IN_Z = 41.5; // inbound lane (trucks arriving drive west → east)
export const ROAD_OUT_Z = 46.5;
export const BACK_Z = -31;
export const SITE_W = 104;
export const HALF_W = SITE_W / 2;

export type DoorKind = 'in' | 'out';

export interface Door {
  id: string; // "In 1", "Out 2", "D3"
  x: number;
  kind: DoorKind;
  buildingId: string;
}

export interface Building {
  id: string;
  label: string;
  x: number; // centre x
  width: number;
  depth: number;
  height: number;
  roof: 'gable' | 'sawtooth';
  walls: 'light' | 'blue';
  production?: boolean; // the hall whose machines open in the cell view
  doors: Door[];
}

export interface Bay {
  id: string;
  index: number;
  x: number;
  kind: DoorKind; // in = unloading, out = loading
  doorId: string; // door its forklift works from
}

export interface Slot {
  id: string;
  x: number;
  z: number;
}

export interface Charger {
  id: string;
  x: number;
  z: number;
  park: V2; // where the forklift sits while charging
}

export interface ForkliftDef {
  id: string;
  operator: string;
  model: string;
  bay?: number; // bay index it serves; undefined = put-away duty
  charger: number;
}

export interface SiteDef {
  id: string; // = cell id
  code: string; // "MC"
  name: string;
  kind: string; // "Production cell", "Cross-dock" …
  origin: [number, number, number];
  buildings: Building[];
  bays: Bay[];
  slots: Slot[];
  chargers: Charger[];
  forklifts: ForkliftDef[];
  spareParks: V2[]; // spare forklifts parked
  gateX: number;
  /** Bays are the real PlantOps fleet (fleet_trucks / fleet_dispatches) */
  liveFleet?: boolean;
  inboundFrom: string;
  outboundTo: string;
  stagedLabel: string;
  tanks?: V2[];
  truckParking?: V2[];
}

const OPERATORS = ['Ravi K', 'Anita R', 'Suresh M', 'Divya S', 'Karthik P', 'Meena L', 'Arun V', 'Priya N', 'Vikram J', 'Lakshmi T', 'Naveen B', 'Kavya D'];
const MODELS = ['Toyota 8FBE18', 'Jungheinrich EFG 216', 'Linde E20', 'Godrej UNO 2.0', 'Hyster J1.8XNT'];

let forkliftSeq = 0;

function site(def: {
  id: string;
  code: string;
  name: string;
  kind: string;
  col: number;
  row: number;
  buildings: (Omit<Building, 'doors'> & { doors: [number, DoorKind][] })[];
  bays: [number, DoorKind][];
  forklifts: number; // working forklifts
  spare: number;
  gateX: number;
  slotX0: number;
  slotCols: number;
  liveFleet?: boolean;
  inboundFrom: string;
  outboundTo: string;
  stagedLabel: string;
  tanks?: V2[];
  truckParking?: V2[];
  doorNames?: 'inout' | 'dock';
}): SiteDef {
  let inN = 0;
  let outN = 0;
  let dN = 0;
  const buildings: Building[] = def.buildings.map((b) => ({
    ...b,
    doors: b.doors.map(([x, kind]) => ({
      id: def.doorNames === 'dock' && b.walls === 'blue' ? `D${++dN}` : kind === 'in' ? `In ${++inN}` : `Out ${++outN}`,
      x,
      kind,
      buildingId: b.id,
    })),
  }));
  const doors = buildings.flatMap((b) => b.doors);
  const nearestDoor = (x: number, kind: DoorKind) =>
    [...doors].sort((a, b) => (a.kind === kind ? 0 : 50) + Math.abs(a.x - x) - ((b.kind === kind ? 0 : 50) + Math.abs(b.x - x)))[0];
  const bays: Bay[] = def.bays.map(([x, kind], i) => ({ id: `Bay ${i + 1}`, index: i, x, kind, doorId: nearestDoor(x, kind).id }));
  const slots: Slot[] = [];
  SLOT_ROWS.forEach((z, r) => {
    for (let c = 0; c < def.slotCols; c++) slots.push({ id: `S${r + 1}-${c + 1}`, x: def.slotX0 + c * SLOT_PITCH, z });
  });
  const chargers: Charger[] = [10.2, 14.6, 19.0].map((z, i) => ({ id: `C${i + 1}`, x: -HALF_W + 2.4, z, park: [-HALF_W + 5.2, z] }));
  const forklifts: ForkliftDef[] = Array.from({ length: def.forklifts }, (_, i) => {
    const n = ++forkliftSeq;
    return {
      id: `FL-${String(n).padStart(2, '0')}`,
      operator: OPERATORS[(n * 5) % OPERATORS.length],
      model: MODELS[n % MODELS.length],
      bay: def.liveFleet ? undefined : i < bays.length ? i : undefined,
      charger: i % chargers.length,
    };
  });
  const spareParks: V2[] = Array.from({ length: def.spare }, (_, i) => [-HALF_W + 5.2 + (i + 1) * 2.8, 23.2]);
  return {
    id: def.id,
    code: def.code,
    name: def.name,
    kind: def.kind,
    origin: [(def.col - 1) * 126, 0, def.row * 104 - 52],
    buildings,
    bays,
    slots,
    chargers,
    forklifts,
    spareParks,
    gateX: def.gateX,
    liveFleet: def.liveFleet,
    inboundFrom: def.inboundFrom,
    outboundTo: def.outboundTo,
    stagedLabel: def.stagedLabel,
    tanks: def.tanks,
    truckParking: def.truckParking,
  };
}

export const SITE_DEFS: SiteDef[] = [
  site({
    id: 'MACHINING', code: 'WH-01', name: 'Inbound Receiving Hub', kind: 'Inbound cross-dock', col: 0, row: 0,
    buildings: [
      { id: 'MC-A', label: 'Receiving Cross-Dock A', x: -15, width: 58, depth: 24, height: 9, roof: 'sawtooth', walls: 'light', production: true, doors: [[-37, 'in'], [-27, 'in'], [-5, 'out'], [5, 'out']] },
      { id: 'MC-B', label: 'Raw Materials Staging', x: 31, width: 30, depth: 20, height: 8, roof: 'gable', walls: 'blue', doors: [[23, 'in'], [38, 'out']] },
    ],
    bays: [[8, 'in'], [17, 'in'], [26, 'out']],
    forklifts: 3, spare: 1, gateX: -26, slotX0: -36, slotCols: 7,
    inboundFrom: 'Supplier Freight', outboundTo: 'WH-02 Bulk Depot', stagedLabel: 'Inbound pallets',
    truckParking: [[38, 18.6], [44, 18.6]],
  }),
  site({
    id: 'PROCESSING', code: 'WH-02', name: 'Bulk Materials Depot', kind: 'Bulk storage depot', col: 1, row: 0,
    buildings: [
      { id: 'PR-A', label: 'Bulk Storage Hall', x: -10, width: 62, depth: 24, height: 10, roof: 'gable', walls: 'light', production: true, doors: [[-34, 'in'], [-22, 'in'], [2, 'out'], [14, 'out']] },
    ],
    bays: [[12, 'in'], [21, 'out']],
    forklifts: 2, spare: 1, gateX: -24, slotX0: -36, slotCols: 7,
    inboundFrom: 'Inbound Logistics', outboundTo: 'WH-03 Fulfillment Hub', stagedLabel: 'Bulk inventory',
    tanks: [[32, -20], [40, -20], [32, -11], [40, -11], [47, -15]],
    truckParking: [[32, 18.6], [38, 18.6]],
  }),
  site({
    id: 'ROBOT', code: 'WH-03', name: 'Central Fulfillment Hub', kind: 'Automated high-bay hub', col: 2, row: 0,
    buildings: [
      { id: 'RW-A', label: 'High-Bay Fulfillment Hall', x: -6, width: 74, depth: 26, height: 10, roof: 'sawtooth', walls: 'light', production: true, doors: [[-34, 'in'], [-23, 'in'], [3, 'out'], [14, 'out'], [24, 'out']] },
    ],
    bays: [[8, 'in'], [17, 'out'], [26, 'out']],
    forklifts: 3, spare: 1, gateX: -24, slotX0: -36, slotCols: 7,
    inboundFrom: 'WH-01 Receiving', outboundTo: 'OUT-01 Freight Terminal', stagedLabel: 'Picked pallets',
    truckParking: [[38, 18.6], [44, 18.6]],
  }),
  site({
    id: 'ASSEMBLY', code: 'WH-04', name: 'WIP Staging & Kitting Depot', kind: 'Kitting & staging depot', col: 0, row: 1,
    buildings: [
      { id: 'AS-A', label: 'Kitting & Staging Hall', x: -19, width: 50, depth: 24, height: 9, roof: 'gable', walls: 'light', production: true, doors: [[-37, 'in'], [-27, 'in'], [-9, 'out'], [1, 'out']] },
      { id: 'AS-B', label: 'Buffer Store', x: 27, width: 32, depth: 20, height: 8, roof: 'gable', walls: 'blue', doors: [[19, 'in'], [35, 'out']] },
    ],
    bays: [[9, 'in'], [18, 'out'], [27, 'out']],
    forklifts: 3, spare: 1, gateX: -24, slotX0: -36, slotCols: 7,
    inboundFrom: 'WH-02 Bulk Depot', outboundTo: 'OUT-01 Freight Terminal', stagedLabel: 'Staged shipments',
    truckParking: [[38, 18.6], [44, 18.6]],
  }),
  site({
    id: 'MAINTENANCE', code: 'DEPOT', name: 'Fleet Service & Charging Depot', kind: 'Fleet & EV service hub', col: 1, row: 1,
    buildings: [
      { id: 'MB-A', label: 'Fleet Service Bay', x: -16, width: 46, depth: 22, height: 8, roof: 'gable', walls: 'light', production: true, doors: [[-32, 'in'], [-12, 'out'], [-2, 'out']] },
      { id: 'MB-B', label: 'Spares & Tooling Store', x: 25, width: 28, depth: 18, height: 7, roof: 'gable', walls: 'blue', doors: [[18, 'in'], [32, 'out']] },
    ],
    bays: [[8, 'in'], [17, 'out']],
    forklifts: 2, spare: 1, gateX: -24, slotX0: -36, slotCols: 6,
    inboundFrom: 'OEM Spares Depot', outboundTo: 'Yard Fleet', stagedLabel: 'Service spares',
    truckParking: [[30, 18.6], [36, 18.6]],
  }),
  site({
    id: 'PACKAGING', code: 'OUT-01', name: 'Outbound Freight Terminal', kind: 'Outbound freight terminal', col: 2, row: 1,
    buildings: [
      { id: 'PK-A', label: 'Outbound Freight Hall', x: -23, width: 46, depth: 24, height: 9, roof: 'sawtooth', walls: 'light', production: true, doors: [[-39, 'in'], [-29, 'in'], [-15, 'out'], [-5, 'out']] },
      { id: 'PK-B', label: 'Multi-Bay Shipping Terminal', x: 28, width: 40, depth: 24, height: 10, roof: 'gable', walls: 'blue', doors: [[13, 'out'], [22, 'out'], [31, 'out'], [40, 'out']] },
    ],
    bays: [[13, 'out'], [22, 'out'], [31, 'out'], [40, 'out']],
    forklifts: 3, spare: 2, gateX: -10, slotX0: -36, slotCols: 8,
    liveFleet: true, doorNames: 'dock',
    inboundFrom: 'WH-03 Fulfillment Hub', outboundTo: 'Regional Customers', stagedLabel: 'Dispatch pallets',
  }),
];

export const siteById = (id: string) => SITE_DEFS.find((s) => s.id === id);
export const allDoors = (s: SiteDef) => s.buildings.flatMap((b) => b.doors);
export const doorById = (s: SiteDef, id: string) => allDoors(s).find((d) => d.id === id);
export const toWorld = (s: SiteDef, x: number, z: number): [number, number, number] => [s.origin[0] + x, 0, s.origin[2] + z];

export const NETWORK_HOME = { position: [-150, 340, 370] as [number, number, number], target: [0, 0, 0] as [number, number, number] };
export const WORLD_BOUNDS = { minX: -230, maxX: 230, minZ: -130, maxZ: 150 };

// ─── Route graph (forklift lanes) ─────────────────────────────────────────────

export interface RouteNode {
  label?: string; // door / slot / bay id, for task descriptions
  stop: V2; // where the forklift stops to pick / drop / park
  spur: V2[]; // from stop to the main aisle (last point is on the aisle)
  face: number; // heading while stopped
}

export const doorNode = (d: Door): RouteNode => ({ label: d.id, stop: [d.x, INSIDE_Z], spur: [[d.x, INSIDE_Z], [d.x, FRONT_Z], [d.x, AISLE_Z]], face: Math.PI });
export const slotNode = (sl: Slot): RouteNode => ({ label: `slot ${sl.id}`, stop: [sl.x, sl.z - 1.7], spur: [[sl.x, sl.z - 1.7], [sl.x, AISLE_Z]], face: 0 });
export const bayNode = (b: Bay): RouteNode => ({ label: b.id, stop: [b.x, BAY_REAR_Z - 1.5], spur: [[b.x, BAY_REAR_Z - 1.5], [b.x, AISLE_Z]], face: 0 });
/** Exit lane of the charging area, far enough out to clear forklifts parked at the chargers. */
export const CHARGER_LANE = 4.6;
export const chargerNode = (c: Charger): RouteNode => ({ stop: c.park, spur: [c.park, [c.park[0] + CHARGER_LANE, c.park[1]], [c.park[0] + CHARGER_LANE, AISLE_Z]], face: -Math.PI / 2 });

/** Manhattan route: down a's spur to the aisle, along the aisle, up b's spur — with rounded corners. */
export function route(a: RouteNode, b: RouteNode): V2[] {
  // already there: no out-and-back U-turn through the aisle
  if (Math.hypot(a.stop[0] - b.stop[0], a.stop[1] - b.stop[1]) < 1e-6) return [a.stop];
  const pts = [...a.spur, ...[...b.spur].reverse()];
  const clean = pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 1e-6);
  return roundCorners(clean, 1.2, 20);
}

export const polyLength = (pts: V2[]) => pts.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);

/**
 * Replace every interior corner with a short quadratic arc (radius capped at half of each
 * adjacent leg). Unlike a uniform Catmull-Rom spline this never overshoots or loops, however
 * unevenly the control points are spaced, so vehicles can't spin on a path.
 */
export function roundCorners(pts: V2[], radius: number, steps = 8): V2[] {
  if (pts.length < 3) return pts;
  const out: V2[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, pz] = pts[i - 1];
    const [cx, cz] = pts[i];
    const [nx, nz] = pts[i + 1];
    const l1 = Math.hypot(cx - px, cz - pz);
    const l2 = Math.hypot(nx - cx, nz - cz);
    const r = Math.min(radius, l1 / 2, l2 / 2);
    if (r < 0.02 || l1 < 1e-6 || l2 < 1e-6) {
      out.push(pts[i]);
      continue;
    }
    const a: V2 = [cx - ((cx - px) / l1) * r, cz - ((cz - pz) / l1) * r];
    const b: V2 = [cx + ((nx - cx) / l2) * r, cz + ((nz - cz) / l2) * r];
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const w0 = (1 - t) * (1 - t);
      const w1 = 2 * (1 - t) * t;
      const w2 = t * t;
      out.push([w0 * a[0] + w1 * cx + w2 * b[0], w0 * a[1] + w1 * cz + w2 * b[1]]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out.filter((p, i) => i === 0 || Math.hypot(p[0] - out[i - 1][0], p[1] - out[i - 1][1]) > 1e-6);
}

/** Smooth a vehicle path through its control points (corner arcs, no overshoot). */
export function smoothPath(controlPts: V2[], radius = 6): V2[] {
  return roundCorners(controlPts, radius, 24);
}

/** Point + heading at distance `d` along a polyline; heading is the direction of travel there. */
export function along(pts: V2[], d: number): { x: number; z: number; heading: number } {
  if (!pts || pts.length === 0) return { x: 0, z: 0, heading: 0 };
  if (pts.length === 1) return { x: pts[0][0], z: pts[0][1], heading: 0 };
  let rest = Math.max(0, d);
  for (let i = 1; i < pts.length; i++) {
    const [x0, z0] = pts[i - 1];
    const [x1, z1] = pts[i];
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (rest <= len || i === pts.length - 1) {
      const f = len > 1e-6 ? Math.min(1, rest / len) : 1;
      return { x: x0 + (x1 - x0) * f, z: z0 + (z1 - z0) * f, heading: Math.atan2(x1 - x0, z1 - z0) };
    }
    rest -= len;
  }
  const p = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  return { x: p[0], z: p[1], heading: Math.atan2(p[0] - prev[0], p[1] - prev[1]) };
}

/** Heading of the first non-degenerate leg of a path. */
export function startHeading(pts: V2[]): number {
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[0][0];
    const dz = pts[i][1] - pts[0][1];
    if (Math.hypot(dx, dz) > 0.05) return Math.atan2(dx, dz);
  }
  return 0;
}

// ─── Truck paths ──────────────────────────────────────────────────────────────

/** Arrival: along public road, clean wide arc through the gate center, east along lane, then reversing into bay */
/** Two-lane traffic: arrivals keep right (east half of the gate, south lane of the yard), departures the other half. */
export const GATE_IN_DX = 3.3;
export const GATE_OUT_DX = -3.3;
export const LANE_IN_Z = LANE_Z + 2.1;
export const LANE_OUT_Z = LANE_Z - 2.1;

export function truckArrival(s: SiteDef, bay: Bay): { forward: V2[]; reverse: V2[] } {
  const pull = Math.min(bay.x + 14, HALF_W - 3);
  const gx = s.gateX + GATE_IN_DX;
  const forwardControl: V2[] = [
    [-HALF_W - 60, ROAD_IN_Z],
    [gx - 12, ROAD_IN_Z],
    [gx, ROAD_IN_Z],
    [gx, FENCE_Z],
    [gx, LANE_IN_Z],
    [pull, LANE_IN_Z],
  ];
  const reverseControl: V2[] = [
    [pull, LANE_IN_Z],
    [bay.x + 4, LANE_IN_Z - 3],
    [bay.x, TRUCK_CENTER_Z + 6],
    [bay.x, TRUCK_CENTER_Z],
  ];
  return { forward: smoothPath(forwardControl, 5), reverse: smoothPath(reverseControl, 4) };
}

/** Departure: pull forward out of the bay, west along the outbound lane, out through the west half of the gate. */
export function truckDeparture(s: SiteDef, bay: Bay): V2[] {
  const gx = s.gateX + GATE_OUT_DX;
  const departureControl: V2[] = [
    [bay.x, TRUCK_CENTER_Z],
    [bay.x, TRUCK_CENTER_Z + 4],
    [bay.x - 4, LANE_OUT_Z],
    [gx, LANE_OUT_Z],
    [gx, FENCE_Z],
    [gx, ROAD_OUT_Z],
    [gx - 12, ROAD_OUT_Z],
    [-HALF_W - 60, ROAD_OUT_Z],
  ];
  return smoothPath(departureControl, 5);
}
