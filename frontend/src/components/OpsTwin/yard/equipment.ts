/**
 * Warehouse / depot equipment for the Ops Twin: conveyors, sorters, wrappers, scales, vehicle
 * lifts, charger banks, drum racks … (no production-cell machines). Equipment state is a
 * deterministic function of wall-clock time, like the rest of the yard model.
 */
export type EquipKind =
  | 'conveyor'
  | 'sorter'
  | 'pickStation'
  | 'packBench'
  | 'wrapper'
  | 'scale'
  | 'labeler'
  | 'qcTable'
  | 'stagingLane'
  | 'blockStack'
  | 'drumRack'
  | 'ibc'
  | 'dispenser'
  | 'cartonFlow'
  | 'kitBench'
  | 'tugger'
  | 'vehicleLift'
  | 'chargerBank'
  | 'tyreChanger'
  | 'compressor'
  | 'toolCabinet'
  | 'workbench'
  | 'shelving'
  | 'counter';

export interface KindSpec {
  code: string;
  label: string;
  w: number; // footprint along x
  d: number; // footprint along z
  powered: boolean; // powered equipment (has a status) vs a fixture
  staffed?: boolean; // an operator stands at it
}

export const KIND: Record<EquipKind, KindSpec> = {
  conveyor: { code: 'CNV', label: 'Roller conveyor', w: 11, d: 1.6, powered: true },
  sorter: { code: 'SRT', label: 'Tilt-tray sorter', w: 9, d: 3.4, powered: true },
  pickStation: { code: 'PCK', label: 'Pick-to-light station', w: 3.2, d: 2.6, powered: true, staffed: true },
  packBench: { code: 'PKB', label: 'Packing bench', w: 3.2, d: 2.6, powered: true, staffed: true },
  wrapper: { code: 'WRP', label: 'Stretch wrapper', w: 3.4, d: 3.4, powered: true },
  scale: { code: 'SCL', label: 'Pallet scale', w: 2.4, d: 2.4, powered: true },
  labeler: { code: 'LBL', label: 'Print & apply labeler', w: 2, d: 2, powered: true },
  qcTable: { code: 'QCT', label: 'QC inspection table', w: 3.2, d: 2.6, powered: true, staffed: true },
  stagingLane: { code: 'LN', label: 'Cross-dock lane', w: 2.4, d: 9, powered: false },
  blockStack: { code: 'BLK', label: 'Block-stack lane', w: 2.6, d: 10, powered: false },
  drumRack: { code: 'DRM', label: 'Drum rack', w: 4.4, d: 1.8, powered: false },
  ibc: { code: 'IBC', label: 'IBC tote store', w: 3.8, d: 1.9, powered: false },
  dispenser: { code: 'DSP', label: 'Drum dispensing station', w: 3, d: 2.4, powered: true, staffed: true },
  cartonFlow: { code: 'CFR', label: 'Carton-flow rack', w: 4.4, d: 1.8, powered: false },
  kitBench: { code: 'KTB', label: 'Kitting bench', w: 3.4, d: 2.6, powered: true, staffed: true },
  tugger: { code: 'TUG', label: 'Tugger train', w: 7, d: 1.8, powered: true },
  vehicleLift: { code: 'LFT', label: 'Vehicle lift', w: 5.2, d: 9.5, powered: true },
  chargerBank: { code: 'CHG', label: 'Battery charger bank', w: 6, d: 1.6, powered: true },
  tyreChanger: { code: 'TYR', label: 'Tyre changer', w: 2, d: 2, powered: true },
  compressor: { code: 'CMP', label: 'Air compressor', w: 2.4, d: 1.8, powered: true },
  toolCabinet: { code: 'TCB', label: 'Tool cabinet', w: 2.6, d: 1.2, powered: false },
  workbench: { code: 'WKB', label: 'Workbench', w: 3.2, d: 1.6, powered: false, staffed: true },
  shelving: { code: 'SHF', label: 'Parts shelving', w: 5.2, d: 1.2, powered: false },
  counter: { code: 'CTR', label: 'Issue counter', w: 4.4, d: 1.6, powered: false, staffed: true },
};

export interface EquipItem {
  id: string; // WH-01-QCT-01
  kind: EquipKind;
  label: string;
  siteId: string;
  buildingId: string;
  x: number; // interior frame
  z: number;
  rot: number;
}

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export type EquipStatus = 'RUNNING' | 'IDLE' | 'WARNING' | 'FAULT' | 'MAINTENANCE';

export interface EquipSnap {
  item: EquipItem;
  status: EquipStatus;
  powered: boolean;
  statusLabel: string;
  reading: string; // kind-specific live reading
  utilisation: number; // 0..1 (last hour)
  uptimeToday: number; // 0..1
  health: number; // 0..100
  cyclesToday: number;
  fill: number; // 0..1 how full a fixture is (lanes, racks, shelving)
  lastServiceDays: number;
  nextServiceDays: number;
  issue?: string;
}

const WINDOW = 1800; // equipment state can change every 30 min
const ISSUES: Partial<Record<EquipKind, string[]>> = {
  conveyor: ['Belt tracking drift', 'Motor over-temperature', 'Photo-eye blocked'],
  sorter: ['Tray tilt actuator error', 'Induction jam'],
  wrapper: ['Film break', 'Turntable drive fault'],
  scale: ['Load cell out of calibration'],
  labeler: ['Label ribbon low', 'Applicator misfeed'],
  vehicleLift: ['Hydraulic pressure low', 'Safety lock sensor'],
  chargerBank: ['Charger module fault', 'Battery over-temperature'],
  compressor: ['Pressure drop', 'Oil level low'],
  tugger: ['Battery low', 'Hitch sensor'],
  dispenser: ['Pump flow low'],
  tyreChanger: ['Bead breaker pressure low'],
  pickStation: ['Pick light module offline'],
  packBench: ['Label printer offline'],
  kitBench: ['Torque tool calibration due'],
  qcTable: ['Gauge calibration due'],
};

/** Raw state of an item at a window (no smoothing). */
function stateAt(item: EquipItem, sec: number): EquipStatus {
  if (!KIND[item.kind].powered) return 'RUNNING';
  const h = hash(`${item.id}:${Math.floor(sec / WINDOW)}`) % 1000;
  if (h < 14) return 'FAULT';
  if (h < 45) return 'WARNING';
  if (h < 65) return 'MAINTENANCE';
  if (h < 190) return 'IDLE';
  return 'RUNNING';
}

const STATUS_LABEL: Record<EquipStatus, string> = { RUNNING: 'Running', IDLE: 'Idle', WARNING: 'Warning', FAULT: 'Fault', MAINTENANCE: 'Maintenance' };
const istMidnight = (sec: number) => Math.floor((sec + 19800) / 86400) * 86400 - 19800;

export function equipAt(item: EquipItem, sec: number): EquipSnap {
  const spec = KIND[item.kind];
  const status = stateAt(item, sec);
  const h = hash(`${item.id}:${Math.floor(sec / 300)}`);
  const hs = hash(item.id);
  // uptime / utilisation from the windows so far today (cheap: ≤ 48 windows)
  const mid = istMidnight(sec);
  let up = 0;
  let n = 0;
  for (let t = mid; t < sec; t += WINDOW) {
    const s = stateAt(item, t);
    n++;
    if (s === 'RUNNING' || s === 'IDLE') up++;
  }
  let busy = 0;
  for (let k = 0; k < 6; k++) if (stateAt(item, sec - k * 600) === 'RUNNING') busy++;
  const elapsedH = (sec - mid) / 3600;
  const rate = 20 + (hs % 60);
  const cyclesToday = spec.powered ? Math.round(elapsedH * rate * (n ? up / n : 1)) : 0;
  const health = Math.max(35, 96 - (hs % 18) - (status === 'FAULT' ? 30 : status === 'WARNING' ? 14 : 0));
  const fill = 0.25 + (hash(`${item.id}:f:${Math.floor(sec / 600)}`) % 70) / 100;
  const pick = <T,>(xs: T[]) => xs[h % xs.length];
  const reading = (() => {
    if (status === 'FAULT' || status === 'MAINTENANCE') return status === 'FAULT' ? 'Stopped' : 'Under planned maintenance';
    switch (item.kind) {
      case 'conveyor':
        return `${(0.5 + (h % 40) / 100).toFixed(2)} m/s · ${260 + (h % 240)} totes/h`;
      case 'sorter':
        return `${1500 + (h % 900)} items/h · ${8 + (hs % 8)} chutes`;
      case 'pickStation':
        return `${70 + (h % 60)} lines/h`;
      case 'packBench':
        return `${18 + (h % 22)} orders/h`;
      case 'wrapper':
        return `${cyclesToday} pallets wrapped today`;
      case 'scale':
        return `Last weighed ${380 + (h % 640)} kg`;
      case 'labeler':
        return `${cyclesToday * 4} labels today`;
      case 'qcTable':
        return `${cyclesToday} inspections · ${94 + (h % 6)}% pass`;
      case 'dispenser':
        return `${cyclesToday * 12} L dispensed today`;
      case 'kitBench':
        return `${cyclesToday} kits today`;
      case 'tugger':
        return `${Math.round(cyclesToday / 6)} route runs today`;
      case 'vehicleLift':
        return `Servicing ${pick(['TRK-01 (PM-A)', 'FL-07 mast check', 'TRK-03 brakes', 'FL-11 tyres', 'TRK-02 oil change'])}`;
      case 'chargerBank':
        return `${2 + (h % 5)}/6 batteries charging`;
      case 'tyreChanger':
        return `${Math.round(cyclesToday / 10)} tyres today`;
      case 'compressor':
        return `${(7.2 + (h % 12) / 10).toFixed(1)} bar · ${55 + (h % 20)} °C`;
      case 'stagingLane':
      case 'blockStack':
        return `${Math.round(fill * (item.kind === 'blockStack' ? 12 : 5))}/${item.kind === 'blockStack' ? 12 : 5} pallets`;
      case 'drumRack':
        return `${Math.round(fill * 12)}/12 drums`;
      case 'ibc':
        return `${Math.max(1, Math.round(fill * 3))}/3 totes · ${50 + (h % 50)}% avg fill`;
      case 'cartonFlow':
        return `${Math.round(fill * 18)}/18 bins stocked`;
      case 'shelving':
        return `${Math.round(fill * 100)}% bins stocked`;
      default:
        return spec.powered ? STATUS_LABEL[status] : 'In use';
    }
  })();
  const issues = ISSUES[item.kind] || ['Sensor fault'];
  return {
    item,
    status,
    powered: spec.powered,
    statusLabel: spec.powered ? STATUS_LABEL[status] : 'Fixture',
    reading,
    utilisation: spec.powered ? busy / 6 : 0,
    uptimeToday: n ? up / n : 1,
    health,
    cyclesToday,
    fill,
    lastServiceDays: 3 + (hs % 40),
    nextServiceDays: 1 + ((hs >>> 5) % 30),
    issue: status === 'FAULT' || status === 'WARNING' ? issues[hash(`${item.id}:${Math.floor(sec / WINDOW)}`) % issues.length] : undefined,
  };
}

/** Equipment state over the day so far, in 30-min windows (for timelines). */
export function equipTimeline(item: EquipItem, sec: number): { from: number; to: number; status: EquipStatus }[] {
  const out: { from: number; to: number; status: EquipStatus }[] = [];
  const mid = istMidnight(sec);
  for (let t = Math.floor(mid / WINDOW) * WINDOW; t < sec; t += WINDOW) {
    const s = stateAt(item, t);
    const from = Math.max(mid, t);
    const to = Math.min(sec, t + WINDOW);
    const last = out[out.length - 1];
    if (last && last.status === s && last.to === from) last.to = to;
    else out.push({ from, to, status: s });
  }
  return out;
}
