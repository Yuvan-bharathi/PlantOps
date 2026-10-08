/**
 * Spatial layout for the Ops Twin, kept separate from business data: machines are matched to
 * a station by code, so the database stays the source of truth for *what* exists and *what
 * state* it is in, and this file only says *where* it is drawn.
 */

export type Vec3 = [number, number, number];

export type MachineKind = 'CNC' | 'ROBOT' | 'PUMP' | 'MIXER' | 'PRESS' | 'PROCESSING' | 'ASSEMBLY' | 'PACKAGING' | 'MAINTENANCE';

export interface StationConfig {
  code: string;
  kind: MachineKind;
  position: Vec3; // floor centre of the machine bay
  rotationY: number;
  bay: string; // human label, e.g. "Bay A1"
}

export interface CellConfig {
  id: string;
  label: string;
  short: string; // roof / chip code, e.g. "MC"
  areaMatch: string; // matched against machines.area (case-insensitive)
  floor: { width: number; depth: number };
  stations: StationConfig[];
  /** Where technicians enter the cell (start of dispatch routes) */
  techEntry: Vec3;
  /** Closed loop the AGV patrols (material supply route) */
  agvLoop: Vec3[];
  /** Inbound / outbound staging slots */
  staging: { id: string; label: string; position: Vec3; kind: 'raw' | 'finished' }[];
  home: { position: Vec3; target: Vec3 };
}

const BAY_PITCH = 8;
const ROW_Z = 4.6;

function makeCell(def: {
  id: string;
  label: string;
  short: string;
  areaMatch: string;
  machines: { code: string; kind: MachineKind }[];
  raw: string;
  finished: string;
}): CellConfig {
  const cols = Math.ceil(def.machines.length / 2);
  const x0 = -((cols - 1) * BAY_PITCH) / 2;
  const stations: StationConfig[] = def.machines.map((m, i) => {
    const row = i < cols ? 0 : 1;
    const col = row === 0 ? i : i - cols;
    return {
      code: m.code,
      kind: m.kind,
      position: [x0 + col * BAY_PITCH, 0, row === 0 ? -ROW_Z : ROW_Z],
      rotationY: row === 0 ? 0 : Math.PI,
      bay: `Bay ${row === 0 ? 'A' : 'B'}${col + 1}`,
    };
  });
  const width = Math.max(26, cols * BAY_PITCH + 10);
  const half = width / 2;
  const dist = Math.max(44, width * 1.3);
  return {
    id: def.id,
    label: def.label,
    short: def.short,
    areaMatch: def.areaMatch,
    floor: { width, depth: 22 },
    stations,
    techEntry: [-half + 2, 0, 0],
    agvLoop: [
      [-half + 4, 0, -0.8],
      [half - 4.5, 0, -0.8],
      [half - 4.5, 0, 0.8],
      [-half + 4, 0, 0.8],
    ],
    staging: [
      { id: `${def.short}-IN-1`, label: def.raw, position: [-half + 3.5, 0, -7], kind: 'raw' },
      { id: `${def.short}-IN-2`, label: def.raw, position: [-half + 3.5, 0, -4.5], kind: 'raw' },
      { id: `${def.short}-OUT-1`, label: def.finished, position: [half - 3.5, 0, 4.5], kind: 'finished' },
      { id: `${def.short}-OUT-2`, label: def.finished, position: [half - 3.5, 0, 7], kind: 'finished' },
    ],
    home: { position: [dist * 0.58, dist * 0.66, dist * 0.76], target: [0, 0, 0] },
  };
}

export const CELL_CONFIGS: CellConfig[] = [
  makeCell({
    id: 'MACHINING', label: 'WH-01 · Inbound Receiving Hub', short: 'WH-01', areaMatch: 'machining', raw: 'Raw billets & coils', finished: 'Inspected stock',
    machines: ['CNC-01', 'CNC-02', 'CNC-03', 'CNC-04', 'CNC-05', 'CNC-06'].map((code) => ({ code, kind: 'CNC' as const })),
  }),
  makeCell({
    id: 'PROCESSING', label: 'WH-02 · Bulk Materials Depot', short: 'WH-02', areaMatch: 'processing', raw: 'Bulk fluids & chemicals', finished: 'Processed stock',
    machines: [
      { code: 'MIXER-01', kind: 'MIXER' },
      { code: 'PUMP-01', kind: 'PUMP' },
      { code: 'PRESS-01', kind: 'PRESS' },
      { code: 'PROCESS-01', kind: 'PROCESSING' },
      { code: 'PROCESS-02', kind: 'PROCESSING' },
    ],
  }),
  makeCell({
    id: 'ROBOT', label: 'WH-03 · Central Fulfillment Hub', short: 'WH-03', areaMatch: 'robot', raw: 'Palletized components', finished: 'Consolidated pallets',
    machines: ['ROBOT-01', 'ROBOT-02', 'ROBOT-03', 'ROBOT-04'].map((code) => ({ code, kind: 'ROBOT' as const })),
  }),
  makeCell({
    id: 'ASSEMBLY', label: 'WH-04 · WIP Staging & Kitting Depot', short: 'WH-04', areaMatch: 'assembly', raw: 'Kitted sub-parts', finished: 'Completed kits',
    machines: ['ASMB-01', 'ASMB-02', 'ASMB-03', 'ASMB-04'].map((code) => ({ code, kind: 'ASSEMBLY' as const })),
  }),
  makeCell({
    id: 'MAINTENANCE', label: 'DEPOT · Fleet Service & Charging', short: 'DEPOT', areaMatch: 'maintenance', raw: 'OEM spare parts', finished: 'Certified units',
    machines: [
      { code: 'BENCH-01', kind: 'MAINTENANCE' },
      { code: 'BENCH-02', kind: 'MAINTENANCE' },
      { code: 'TEST-01', kind: 'MAINTENANCE' },
    ],
  }),
  makeCell({
    id: 'PACKAGING', label: 'OUT-01 · Outbound Freight Terminal', short: 'OUT-01', areaMatch: 'packaging', raw: 'Finished assemblies', finished: 'Customer pallets',
    machines: ['PACK-01', 'PACK-02', 'PACK-03'].map((code) => ({ code, kind: 'PACKAGING' as const })),
  }),
];

export const cellById = (id: string) => CELL_CONFIGS.find((c) => c.id === id);
export const MACHINING_CELL = CELL_CONFIGS[0];

// ─── Plant site (overview) ────────────────────────────────────────────────────

export interface SiteBuilding {
  cellId: string;
  position: Vec3; // footprint centre
  size: [number, number, number]; // width (x), height, depth (z)
  doorsFace: 1 | -1; // which z face carries the roller doors
}

export interface DockBay {
  id: string; // "Bay 1"
  door: Vec3; // centre of the dock door on the dock building's west wall
  truckPos: Vec3; // where a docked truck's centre sits (cab pointing west)
}

export const SITE = {
  buildings: [
    { cellId: 'MACHINING', position: [-34, 0, -22], size: [22, 7, 14], doorsFace: 1 },
    { cellId: 'PROCESSING', position: [0, 0, -22], size: [22, 8, 14], doorsFace: 1 },
    { cellId: 'ROBOT', position: [34, 0, -22], size: [22, 7, 14], doorsFace: 1 },
    { cellId: 'ASSEMBLY', position: [-34, 0, 12], size: [22, 6.5, 14], doorsFace: 1 },
    { cellId: 'MAINTENANCE', position: [0, 0, 12], size: [18, 6, 12], doorsFace: 1 },
    { cellId: 'PACKAGING', position: [34, 0, 12], size: [22, 7, 14], doorsFace: 1 },
  ] as SiteBuilding[],
  /** Shipping & logistics warehouse (dock doors on its west wall, x = 65) */
  dockBuilding: { position: [72, 0, -4] as Vec3, size: [14, 9, 36] as [number, number, number] },
  dockBays: [-14, -6, 2, 10].map((z, i) => ({
    id: `Bay ${i + 1}`,
    door: [65, 0, z] as Vec3,
    truckPos: [59.6, 0, z] as Vec3,
  })) as DockBay[],
  /** Outbound pallet staging lane in front of the dock */
  stagingLane: { origin: [55.5, 0, 19] as Vec3, cols: 6, pitch: 1.9 },
  /** Road centre-lines: [x1, z1, x2, z2, width] */
  roads: [
    [-54, -37, 50, -37, 6],
    [-54, 27, 50, 27, 6],
    [-54, -37, -54, 27, 6],
    [50, -37, 50, 27, 6],
    [-54, -5, 50, -5, 6],
    [-17, -37, -17, 27, 5],
    [17, -37, 17, 27, 5],
    [0, 27, 0, 60, 7],
  ] as [number, number, number, number, number][],
  gate: [0, 0, 44] as Vec3,
  /** Route trucks drive between the gate and the dock apron */
  truckRoute: [
    [1.8, 0, 62],
    [1.8, 0, 29],
    [48, 0, 29],
    [52, 0, 24],
  ] as Vec3[],
  /** Truck parking (trucks without a dock slot) */
  truckParking: { origin: [62, 0, 30] as Vec3, pitch: 4.2 },
  carParking: { origin: [-47, 0, 36] as Vec3, cols: 7, rows: 2 },
  /** Forklift shuttle loops: packaging → staging lane → dock */
  forkliftLoops: [
    { id: 'FL-01', task: 'Packaging → outbound staging', points: [[45.5, 0, 14], [53, 0, 17.5], [56, 0, 15.5], [53, 0, 12], [47, 0, 10]] },
    { id: 'FL-02', task: 'Outbound staging → dock bays', points: [[57, 0, 16], [61.5, 0, 6], [62, 0, -10], [57, 0, -4], [55.5, 0, 9]] },
    { id: 'FL-03', task: 'Raw material → Machining', points: [[-44, 0, -12], [-36, 0, -9], [-24, 0, -9], [-30, 0, -12.2]] },
  ] as { id: string; task: string; points: Vec3[] }[],
  home: { position: [-56, 98, 114] as Vec3, target: [16, 0, -2] as Vec3 },
};

/** Switcher entries (first = plant overview) */
export const SITES = [
  { id: 'SITE', label: 'Plant overview', sub: 'All cells · docks · yard' },
  ...CELL_CONFIGS.map((c) => ({ id: c.id, label: c.label, sub: `${c.stations.length} machines` })),
];
