/**
 * PLANTOPS — Power Control, Runtime & Daily Production Lifecycle Service
 *
 * Core loop:
 * Power Cell → Machine Runtime → Production Counter → Fault → AI Assignment → LOTO → Repair → Verification → Runtime Resumed
 *
 * 100% Server-Authoritative:
 * - Runtime and downtime are computed by the server/database.
 * - Production piece accumulation freezes immediately when machine enters FAULT / LOTO.
 * - Missed production = production_rate_per_hour * (downtime_seconds / 3600).
 * - Daily records are persisted per date (never overwriting previous days).
 */

import { execute, query } from '../db/mysql.js';
import { getLocalDb, saveLocalDb } from '../db/localDb.js';
import { broadcast } from './socket.service.js';
import { recordEvent, stampIncident, computeAndSaveDowntime } from './eventRecorder.service.js';
import { setPlantPowerGridState } from '../db/redis.js';

export interface PlantPowerState {
  status: 'ON' | 'OFF' | 'STARTING' | 'ESTOP';
  voltage: number;
  current_amps: number;
  frequency_hz: number;
  active_alarm: boolean;
  alarm_acknowledged: boolean;
  main_mcc_status: 'HEALTHY' | 'WARNING' | 'TRIPPED';
  total_load_kw: number;
  last_energized_at: string | null;
  last_deenergized_at: string | null;
}

export interface MachinePowerBreaker {
  machine_id: string;
  machine_code: string;
  machine_name: string;
  cell_name: string;
  breaker_status: 'CLOSED' | 'OPEN' | 'TRIPPED' | 'LOTO_LOCKED';
  voltage: number;
  current_amps: number;
  frequency_hz: number;
  target_rate_per_hour: number;
  cycle_time_seconds: number;
  power_status: 'ON' | 'OFF';
  runtime_status: 'RUNNING' | 'FAULT' | 'MAINTENANCE' | 'VERIFYING' | 'IDLE' | 'OFF';
  actual_pieces: number;
  target_pieces: number;
  missed_pieces: number;
}

export interface MachineDailySummary {
  id: string;
  machine_id: string;
  machine_code: string;
  machine_name: string;
  cell_name: string;
  date: string;
  power_on_seconds: number;
  runtime_seconds: number;
  idle_seconds: number;
  downtime_seconds: number;
  target_pieces: number;
  actual_pieces: number;
  good_pieces: number;
  scrap_pieces: number;
  missed_pieces: number;
  fault_count: number;
  warning_count: number;
  availability_pct: number;
  status: string;
  assigned_technician?: string;
  first_power_on_at?: string;
  last_power_off_at?: string;
  rate_per_hour?: number;
  timeline_segments?: MachineTimelineSegment[];
}

export interface MachineDayEvent {
  time: string;
  timestamp: string;
  type: string;
  category: 'POWER' | 'PRODUCTION' | 'IOT' | 'AI' | 'TECHNICIAN' | 'INVENTORY' | 'RECOVERY';
  title: string;
  description: string;
  status: 'OPTIMAL' | 'WARN' | 'CRITICAL' | 'COMPLETED' | 'IN_PROGRESS' | 'INFO';
  actor?: string;
  metadata?: Record<string, any>;
}

export interface MachineTimelineSegment {
  startTime: string;
  endTime: string;
  startHour: number; // 0.0 - 24.0
  endHour: number;   // 0.0 - 24.0
  status: 'RUNNING' | 'WARNING' | 'FAULT' | 'ESTOP' | 'MAINTENANCE' | 'VERIFYING' | 'IDLE' | 'OFF' | 'NO_DATA';
  label: string;
}

// In-Memory Power State & Breaker Registry (Initialized to ON for active demo)
let plantPowerState: PlantPowerState = {
  status: 'ON',
  voltage: 480.0,
  current_amps: 182.4,
  frequency_hz: 50.0,
  active_alarm: false,
  alarm_acknowledged: true,
  main_mcc_status: 'HEALTHY',
  total_load_kw: 151.6,
  last_energized_at: new Date(Date.now() - 28800000).toISOString(),
  last_deenergized_at: null
};

// Default target rates per machine type
const DEFAULT_MACHINE_RATES: Record<string, { rate: number; cycle: number; cell: string }> = {
  'CNC-01': { rate: 45, cycle: 80, cell: 'Machining Cell' },
  'CNC-02': { rate: 45, cycle: 80, cell: 'Machining Cell' },
  'CNC-03': { rate: 40, cycle: 90, cell: 'Machining Cell' },
  'CNC-04': { rate: 45, cycle: 80, cell: 'Machining Cell' },
  'CNC-05': { rate: 45, cycle: 80, cell: 'Machining Cell' },
  'CNC-06': { rate: 45, cycle: 80, cell: 'Machining Cell' },
  'ROBOT-01': { rate: 60, cycle: 60, cell: 'Robot Cell' },
  'ROBOT-02': { rate: 55, cycle: 65, cell: 'Robot Cell' },
  'ROBOT-03': { rate: 50, cycle: 72, cell: 'Robot Cell' },
  'ROBOT-04': { rate: 60, cycle: 60, cell: 'Robot Cell' },
  'MIXER-01': { rate: 30, cycle: 120, cell: 'Processing Cell' },
  'PUMP-01': { rate: 120, cycle: 30, cell: 'Processing Cell' },
  'PRESS-01': { rate: 90, cycle: 40, cell: 'Processing Cell' },
  'PROCESS-01': { rate: 40, cycle: 90, cell: 'Processing Cell' },
  'PROCESS-02': { rate: 40, cycle: 90, cell: 'Processing Cell' },
  'ASMB-01': { rate: 50, cycle: 72, cell: 'Assembly Cell' },
  'ASMB-02': { rate: 50, cycle: 72, cell: 'Assembly Cell' },
  'ASMB-03': { rate: 50, cycle: 72, cell: 'Assembly Cell' },
  'ASMB-04': { rate: 45, cycle: 80, cell: 'Assembly Cell' },
  'PACK-01': { rate: 120, cycle: 30, cell: 'Packaging Cell' },
  'PACK-02': { rate: 110, cycle: 33, cell: 'Packaging Cell' },
  'PACK-03': { rate: 100, cycle: 36, cell: 'Packaging Cell' },
  'BENCH-01': { rate: 20, cycle: 180, cell: 'Maintenance Bay' },
  'BENCH-02': { rate: 20, cycle: 180, cell: 'Maintenance Bay' },
  'TEST-01': { rate: 30, cycle: 120, cell: 'Maintenance Bay' },
};

// Breaker memory registry for all 25 machines
const breakerRegistry: Record<string, MachinePowerBreaker> = {};


function initBreakerRegistry() {
  Object.keys(DEFAULT_MACHINE_RATES).forEach((code) => {
    const info = DEFAULT_MACHINE_RATES[code];
    breakerRegistry[code] = {
      machine_id: `MCH-${code}`,
      machine_code: code,
      machine_name: `${code} Industrial Station`,
      cell_name: info.cell,
      breaker_status: 'CLOSED',
      voltage: 480.0,
      current_amps: Math.round((Math.random() * 8 + 32) * 10) / 10,
      frequency_hz: 50.0,
      target_rate_per_hour: info.rate,
      cycle_time_seconds: info.cycle,
      power_status: 'ON',
      runtime_status: 'RUNNING',
      actual_pieces: Math.round(info.rate * 7.5),
      target_pieces: Math.round(info.rate * 8.0),
      missed_pieces: 0
    };
  });
}
initBreakerRegistry();

// ─── Business-day clock ──────────────────────────────────────────────────────
// The plant runs on IST. All "today" / hour-of-day logic goes through these helpers
// so dates never drift with the server's own timezone or with UTC midnight.
const IST_OFFSET_MS = 330 * 60 * 1000;
const HOUR_MS = 3_600_000;
export const SHIFT_START_HOUR = 8;
export const SHIFT_END_HOUR = 16;

export function istBusinessDate(d: Date = new Date()): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

function istDayStartMs(date: string): number {
  return Date.parse(`${date}T00:00:00.000Z`) - IST_OFFSET_MS;
}

function istIsoAt(date: string, hour: number): string {
  return new Date(istDayStartMs(date) + hour * HOUR_MS).toISOString();
}

function fmtHour(h: number): string {
  const total = Math.round(h * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// ─── Plant power ledger ──────────────────────────────────────────────────────
// Every plant power transition is appended here (persisted in the local JSON DB), so
// daily timelines are rebuilt from what actually happened instead of scripted values.
type PowerLedgerStatus = 'ON' | 'OFF' | 'ESTOP';

interface PowerLedgerEntry {
  at: string; // ISO timestamp
  status: PowerLedgerStatus;
  reason: string;
}

function getPowerLedger(): PowerLedgerEntry[] {
  const db = getLocalDb();
  if (!Array.isArray(db.power_events)) db.power_events = [];
  return db.power_events as PowerLedgerEntry[];
}

function recordPowerTransition(status: PowerLedgerStatus, reason: string): void {
  try {
    const ledger = getPowerLedger();
    if (ledger[ledger.length - 1]?.status === status) return;
    ledger.push({ at: new Date().toISOString(), status, reason });
    if (ledger.length > 5000) ledger.splice(0, ledger.length - 5000);
    saveLocalDb();
  } catch (err: any) {
    console.warn(`[PowerService] Could not persist power transition: ${err.message}`);
  }
}

// Restore the last recorded plant power state on boot (instead of always assuming ON),
// then make sure the ledger reflects the state the server is actually running with.
function restorePowerStateFromLedger(): void {
  try {
    const last = getPowerLedger().slice(-1)[0];
    if (last && last.status !== 'ON') {
      plantPowerState.status = last.status === 'ESTOP' ? 'ESTOP' : 'OFF';
      plantPowerState.voltage = 0;
      plantPowerState.current_amps = 0;
      plantPowerState.total_load_kw = 0;
      plantPowerState.last_energized_at = null;
      plantPowerState.last_deenergized_at = last.at;
      if (last.status === 'ESTOP') {
        plantPowerState.active_alarm = true;
        plantPowerState.alarm_acknowledged = false;
        plantPowerState.main_mcc_status = 'TRIPPED';
      }
      Object.values(breakerRegistry).forEach((b) => {
        b.power_status = 'OFF';
        b.breaker_status = last.status === 'ESTOP' ? 'TRIPPED' : 'OPEN';
        b.voltage = 0;
        b.current_amps = 0;
        b.runtime_status = 'OFF';
      });
    }
    recordPowerTransition(plantPowerState.status as PowerLedgerStatus, 'server_boot');
  } catch (err: any) {
    console.warn(`[PowerService] Power ledger restore failed: ${err.message}`);
  }
}

restorePowerStateFromLedger();

/**
 * 1. Get current Plant Power & Electrical State
 */
export function getPlantPowerState(): { plant: PlantPowerState; breakers: MachinePowerBreaker[] } {
  return {
    plant: { ...plantPowerState },
    breakers: Object.values(breakerRegistry)
  };
}

/**
 * 2. Controlled Startup: START PLANT POWER
 */
export async function startPlantPower(): Promise<{ success: boolean; message: string; state: PlantPowerState }> {
  plantPowerState.status = 'STARTING';
  broadcast('power:status_changed', {
    status: 'STARTING',
    message: 'Electrical control checks initiated. Checking 480V substation bus...'
  });

  // Simulate electrical startup step (controlled sequence)
  await new Promise((r) => setTimeout(r, 600));

  plantPowerState.status = 'ON';
  plantPowerState.voltage = 480.0;
  plantPowerState.current_amps = 182.4;
  plantPowerState.frequency_hz = 50.0;
  plantPowerState.active_alarm = false;
  plantPowerState.alarm_acknowledged = true;
  plantPowerState.main_mcc_status = 'HEALTHY';
  plantPowerState.total_load_kw = 151.6;
  plantPowerState.last_energized_at = new Date().toISOString();
  recordPowerTransition('ON', 'start_plant_power');

  // Energize all machine breakers and restart runtime clocks
  Object.keys(breakerRegistry).forEach((code) => {
    breakerRegistry[code].power_status = 'ON';
    breakerRegistry[code].breaker_status = 'CLOSED';
    breakerRegistry[code].voltage = 480.0;
    if (breakerRegistry[code].runtime_status !== 'FAULT' && breakerRegistry[code].runtime_status !== 'MAINTENANCE') {
      breakerRegistry[code].runtime_status = 'RUNNING';
    }
  });

  try {
    await execute(`
      UPDATE machines 
      SET status = 'RUNNING', last_running_started_at = CURRENT_TIMESTAMP(3)
      WHERE status NOT IN ('FAULT', 'MAINTENANCE', 'VERIFYING')
    `);
    const db = getLocalDb();
    db.machines.forEach((m: any) => {
      if (m.status !== 'FAULT' && m.status !== 'MAINTENANCE' && m.status !== 'VERIFYING') {
        m.status = 'RUNNING';
      }
    });
    saveLocalDb();
  } catch (err: any) {
    console.warn(`[PowerService] DB update for machine start failed: ${err.message}`);
  }

  broadcast('power:started', {
    status: 'ON',
    voltage: 480.0,
    current_amps: 182.4,
    frequency_hz: 50.0,
    message: 'PLANT POWER ONLINE: Main power energized. 25 machines available for production.'
  });
  broadcast('power:status_changed', { status: 'ON', message: 'Main substation energized.' });
  broadcast('machine:status_changed', { status: 'RUNNING', message: 'All machine cells restored to RUNNING' });
  setPlantPowerGridState(plantPowerState).catch(() => {});

  return {
    success: true,
    message: 'PLANT POWER ONLINE: Main power energized. 25 machines available for production.',
    state: plantPowerState
  };
}

/**
 * 3. Controlled Shutdown: STOP PLANT POWER
 */
export async function stopPlantPower(): Promise<{ success: boolean; message: string; state: PlantPowerState }> {
  plantPowerState.status = 'OFF';
  plantPowerState.voltage = 0.0;
  plantPowerState.current_amps = 0.0;
  plantPowerState.total_load_kw = 0.0;
  plantPowerState.last_deenergized_at = new Date().toISOString();
  recordPowerTransition('OFF', 'stop_plant_power');

  // De-energize all machine breakers
  Object.keys(breakerRegistry).forEach((code) => {
    breakerRegistry[code].power_status = 'OFF';
    breakerRegistry[code].breaker_status = 'OPEN';
    breakerRegistry[code].voltage = 0.0;
    breakerRegistry[code].current_amps = 0.0;
    if (breakerRegistry[code].runtime_status === 'RUNNING') {
      breakerRegistry[code].runtime_status = 'OFF';
    }
  });

  try {
    await execute(`
      UPDATE machines 
      SET status = 'OFFLINE'
      WHERE status NOT IN ('FAULT', 'MAINTENANCE', 'VERIFYING')
    `);
    const db = getLocalDb();
    db.machines.forEach((m: any) => {
      if (m.status !== 'FAULT' && m.status !== 'MAINTENANCE' && m.status !== 'VERIFYING') {
        m.status = 'OFF';
      }
    });
    saveLocalDb();
  } catch (err: any) {
    console.warn(`[PowerService] DB update for machine stop failed: ${err.message}`);
  }

  broadcast('power:stopped', {
    status: 'OFF',
    message: 'PLANT POWER DE-ENERGIZED: All production cells offline. 0.0V bus verified.'
  });
  broadcast('power:status_changed', { status: 'OFF', message: 'Plant power de-energized.' });
  broadcast('machine:status_changed', { status: 'OFF', message: 'All machine cells set to OFF' });
  setPlantPowerGridState(plantPowerState).catch(() => {});

  return {
    success: true,
    message: 'PLANT POWER DE-ENERGIZED: All production cells offline.',
    state: plantPowerState
  };
}

/**
 * 4. Emergency Stop: E-STOP
 */
export async function emergencyStopPlant(): Promise<{ success: boolean; message: string; state: PlantPowerState }> {
  plantPowerState.status = 'ESTOP';
  plantPowerState.voltage = 0.0;
  plantPowerState.current_amps = 0.0;
  plantPowerState.total_load_kw = 0.0;
  plantPowerState.active_alarm = true;
  plantPowerState.alarm_acknowledged = false;
  plantPowerState.main_mcc_status = 'TRIPPED';
  plantPowerState.last_deenergized_at = new Date().toISOString();
  recordPowerTransition('ESTOP', 'emergency_stop');

  Object.keys(breakerRegistry).forEach((code) => {
    breakerRegistry[code].power_status = 'OFF';
    breakerRegistry[code].breaker_status = 'TRIPPED';
    breakerRegistry[code].voltage = 0.0;
    breakerRegistry[code].current_amps = 0.0;
    breakerRegistry[code].runtime_status = 'OFF';
  });

  try {
    await execute(`
      UPDATE machines 
      SET status = 'OFFLINE'
      WHERE status NOT IN ('FAULT', 'MAINTENANCE', 'VERIFYING')
    `);
    const db = getLocalDb();
    db.machines.forEach((m: any) => {
      if (m.status !== 'FAULT' && m.status !== 'MAINTENANCE' && m.status !== 'VERIFYING') {
        m.status = 'OFF';
      }
    });
    saveLocalDb();
  } catch (err: any) {
    console.warn(`[PowerService] DB update for machine estop failed: ${err.message}`);
  }

  broadcast('power:estop', {
    status: 'ESTOP',
    message: '🚨 EMERGENCY SHUTDOWN ACTIVATED: Substation trip engaged. All electrical feeds isolated.'
  });
  broadcast('power:status_changed', { status: 'ESTOP', message: 'Emergency E-Stop Tripped.' });
  broadcast('machine:status_changed', { status: 'OFF', message: 'All machine cells tripped to OFF' });
  setPlantPowerGridState(plantPowerState).catch(() => {});

  return {
    success: true,
    message: '🚨 EMERGENCY SHUTDOWN ACTIVATED: Substation trip engaged.',
    state: plantPowerState
  };
}

/**
 * 5. Reset Alarm & E-STOP
 */
export async function resetPlantPowerAlarm(): Promise<{ success: boolean; state: PlantPowerState }> {
  plantPowerState.active_alarm = false;
  plantPowerState.alarm_acknowledged = true;
  if (plantPowerState.status === 'ESTOP') {
    plantPowerState.status = 'OFF';
    plantPowerState.main_mcc_status = 'HEALTHY';
    recordPowerTransition('OFF', 'estop_reset');
  }
  broadcast('power:status_changed', { status: plantPowerState.status, message: 'Plant power alarms reset.' });
  setPlantPowerGridState(plantPowerState).catch(() => {});
  return { success: true, state: plantPowerState };
}

/**
 * 6. Acknowledge Alarm
 */
export async function acknowledgePlantAlarm(): Promise<{ success: boolean; state: PlantPowerState }> {
  plantPowerState.alarm_acknowledged = true;
  broadcast('power:status_changed', { status: plantPowerState.status, message: 'Alarms acknowledged by operator.' });
  return { success: true, state: plantPowerState };
}

/**
 * 7. Toggle Individual Machine Breaker
 */
export async function toggleMachineBreaker(machineCode: string, targetState?: 'CLOSED' | 'OPEN' | 'LOTO_LOCKED'): Promise<MachinePowerBreaker> {
  const breaker = breakerRegistry[machineCode];
  if (!breaker) {
    throw new Error(`Machine breaker ${machineCode} not found in electrical registry`);
  }

  if (targetState) {
    breaker.breaker_status = targetState;
  } else {
    breaker.breaker_status = breaker.breaker_status === 'CLOSED' ? 'OPEN' : 'CLOSED';
  }

  if (breaker.breaker_status === 'CLOSED' && plantPowerState.status === 'ON') {
    breaker.power_status = 'ON';
    breaker.voltage = 480.0;
    breaker.current_amps = Math.round((Math.random() * 8 + 32) * 10) / 10;
    if (breaker.runtime_status !== 'FAULT' && breaker.runtime_status !== 'MAINTENANCE') {
      breaker.runtime_status = 'RUNNING';
    }
  } else {
    breaker.power_status = 'OFF';
    breaker.voltage = 0.0;
    breaker.current_amps = 0.0;
    if (breaker.runtime_status === 'RUNNING') {
      breaker.runtime_status = 'OFF';
    }
  }

  broadcast('breaker:toggled', {
    machineCode,
    breakerStatus: breaker.breaker_status,
    powerStatus: breaker.power_status,
    voltage: breaker.voltage,
    currentAmps: breaker.current_amps
  });

  return breaker;
}

// ─── Daily history building blocks ───────────────────────────────────────────

export type DailyDataSource = 'LIVE' | 'RECORDED' | 'DB_SUMMARY' | 'SIMULATED';

type SegmentStatus = MachineTimelineSegment['status'];

const DOWNTIME_STATUSES: SegmentStatus[] = ['FAULT', 'ESTOP', 'MAINTENANCE', 'VERIFYING'];

const SEGMENT_LABELS: Record<SegmentStatus, string> = {
  RUNNING: 'Production running',
  WARNING: 'Running with warning',
  FAULT: 'Machine fault',
  ESTOP: 'Emergency E-Stop trip',
  MAINTENANCE: 'LOTO & corrective repair',
  VERIFYING: 'Post-repair verification',
  IDLE: 'Plant de-energized (idle)',
  OFF: 'Outside shift / standby',
  NO_DATA: 'No telemetry recorded',
};

interface IncidentWindow {
  id: string;
  machineCode: string;
  alertType: string;
  detectedMs: number;
  phases: { status: 'FAULT' | 'MAINTENANCE' | 'VERIFYING'; startMs: number; endMs: number }[];
}

const toMs = (v: any): number | null => (v ? new Date(v).getTime() : null);

// Real machine incidents overlapping [dayStart, endMs), split into fault → LOTO/repair → verification
async function loadIncidentWindows(date: string, endMs: number): Promise<IncidentWindow[]> {
  const dayStartMs = istDayStartMs(date);
  let rows: any[] = [];
  try {
    rows = await query<any>(
      `SELECT id, machine_id, alert_type, status, detected_at, loto_started_at, repair_completed_at,
              verification_started_at, verification_completed_at, machine_running_at, resolved_at
       FROM incidents
       WHERE detected_at < ?
         AND (COALESCE(machine_running_at, resolved_at) IS NULL OR COALESCE(machine_running_at, resolved_at) >= ?)`,
      [new Date(endMs), new Date(dayStartMs)]
    );
  } catch (err) {
    return [];
  }

  return rows
    .map((r) => {
      const detected = toMs(r.detected_at);
      if (!detected) return null;
      const closed = r.status === 'RESOLVED' || r.status === 'CLOSED';
      const end = toMs(r.machine_running_at) ?? toMs(r.resolved_at) ?? (closed ? detected : endMs);
      const loto = toMs(r.loto_started_at);
      const verify = toMs(r.verification_started_at);
      const faultEnd = loto ?? verify ?? end;
      const repairEnd = verify ?? toMs(r.repair_completed_at) ?? end;

      const phases: IncidentWindow['phases'] = [{ status: 'FAULT', startMs: detected, endMs: faultEnd }];
      if (loto) phases.push({ status: 'MAINTENANCE', startMs: loto, endMs: repairEnd });
      if (verify) phases.push({ status: 'VERIFYING', startMs: verify, endMs: end });

      return {
        id: r.id,
        machineCode: String(r.machine_id).replace(/^MCH-/, ''),
        alertType: r.alert_type || 'Fault',
        detectedMs: detected,
        phases: phases.filter((p) => p.endMs > p.startMs),
      } as IncidentWindow;
    })
    .filter((x): x is IncidentWindow => !!x);
}

// Plant power status intervals over [0, endHour) of an IST business day
function powerIntervalsForDay(date: string, endHour: number): { start: number; end: number; status: PowerLedgerStatus | 'NO_DATA' }[] {
  const dayStartMs = istDayStartMs(date);
  const out: { start: number; end: number; status: PowerLedgerStatus | 'NO_DATA' }[] = [];
  let cur: PowerLedgerStatus | 'NO_DATA' = 'NO_DATA';
  let curStart = 0;
  for (const e of getPowerLedger()) {
    const h = (Date.parse(e.at) - dayStartMs) / HOUR_MS;
    if (h <= 0) {
      cur = e.status;
      continue;
    }
    if (h >= endHour) break;
    if (e.status !== cur) {
      if (h > curStart) out.push({ start: curStart, end: h, status: cur });
      cur = e.status;
      curStart = h;
    }
  }
  if (endHour > curStart) out.push({ start: curStart, end: endHour, status: cur });
  return out;
}

// True when the power ledger has any record at or before the end of this day
function isLedgerCovered(date: string): boolean {
  const first = getPowerLedger()[0];
  return !!first && Date.parse(first.at) < istDayStartMs(date) + 24 * HOUR_MS;
}

function buildRecordedSegments(
  date: string,
  endHour: number,
  power: ReturnType<typeof powerIntervalsForDay>,
  incidents: IncidentWindow[]
): MachineTimelineSegment[] {
  const dayStartMs = istDayStartMs(date);
  const toH = (ms: number) => Math.max(0, Math.min(endHour, (ms - dayStartMs) / HOUR_MS));
  const phases = incidents.flatMap((inc) =>
    inc.phases.map((p) => ({ ...p, start: toH(p.startMs), end: toH(p.endMs), alertType: inc.alertType }))
  ).filter((p) => p.end > p.start);

  const cuts = new Set<number>([0, endHour]);
  [SHIFT_START_HOUR, SHIFT_END_HOUR].forEach((h) => h < endHour && cuts.add(h));
  power.forEach((p) => { cuts.add(p.start); cuts.add(p.end); });
  phases.forEach((p) => { cuts.add(p.start); cuts.add(p.end); });
  const points = [...cuts].sort((a, b) => a - b);

  const priority: Record<string, number> = { FAULT: 3, MAINTENANCE: 2, VERIFYING: 1 };
  const segments: MachineTimelineSegment[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (b - a < 1e-6) continue;
    const mid = (a + b) / 2;
    const pw = power.find((p) => mid >= p.start && mid < p.end)?.status ?? 'NO_DATA';
    const phase = phases
      .filter((p) => mid >= p.start && mid < p.end)
      .sort((x, y) => priority[y.status] - priority[x.status])[0];
    const inShift = mid >= SHIFT_START_HOUR && mid < SHIFT_END_HOUR;

    let status: SegmentStatus;
    let label: string;
    if (pw === 'NO_DATA') {
      status = 'NO_DATA';
      label = SEGMENT_LABELS.NO_DATA;
    } else if (pw === 'ESTOP') {
      status = 'ESTOP';
      label = SEGMENT_LABELS.ESTOP;
    } else if (phase) {
      status = phase.status;
      label = phase.status === 'FAULT' ? `Fault: ${phase.alertType}` : SEGMENT_LABELS[phase.status];
    } else if (pw === 'OFF') {
      status = inShift ? 'IDLE' : 'OFF';
      label = SEGMENT_LABELS[status];
    } else {
      status = inShift ? 'RUNNING' : 'OFF';
      label = inShift ? SEGMENT_LABELS.RUNNING : 'Outside shift (power on, no production scheduled)';
    }

    const prev = segments[segments.length - 1];
    if (prev && prev.status === status && prev.label === label && Math.abs(prev.endHour - a) < 1e-6) {
      prev.endHour = b;
      prev.endTime = fmtHour(b);
    } else {
      segments.push({ startTime: fmtHour(a), endTime: fmtHour(b), startHour: a, endHour: b, status, label });
    }
  }
  return segments;
}

// Summary metrics derived purely from a machine's timeline segments
function summariseSegments(segments: MachineTimelineSegment[]) {
  let running = 0;
  let downtime = 0;
  let idle = 0;
  let planned = 0;
  for (const s of segments) {
    const inShift = s.startHour >= SHIFT_START_HOUR && s.endHour <= SHIFT_END_HOUR;
    if (!inShift) continue;
    const secs = (s.endHour - s.startHour) * 3600;
    if (s.status !== 'NO_DATA') planned += secs;
    if (s.status === 'RUNNING' || s.status === 'WARNING') running += secs;
    else if (DOWNTIME_STATUSES.includes(s.status)) downtime += secs;
    else if (s.status === 'IDLE') idle += secs;
  }
  return {
    runningSeconds: Math.round(running),
    downtimeSeconds: Math.round(downtime),
    idleSeconds: Math.round(idle),
    plannedSeconds: Math.round(planned),
  };
}

const STATUS_FROM_SEGMENT: Record<SegmentStatus, string> = {
  RUNNING: 'RUNNING',
  WARNING: 'WARNING',
  FAULT: 'FAULT',
  ESTOP: 'ESTOP',
  MAINTENANCE: 'MAINTENANCE',
  VERIFYING: 'VERIFYING',
  IDLE: 'OFF',
  OFF: 'OFF',
  NO_DATA: 'UNKNOWN',
};

function segHHMM(h: number) {
  return fmtHour(Math.min(24, h));
}

// ── Simulated history (days before the power ledger existed) ──
// The 2026-09-29 demo power cut is kept as a fixed historical record: production 08:00–10:15,
// E-Stop trip 10:15–10:39, then the plant stayed de-energized for the rest of the shift.
const SEEDED_ESTOP_DAY = {
  date: '2026-09-29',
  tripStartHour: 10.25,
  tripEndHour: 10.65,
  downtimeSeconds: 1440,
};

function simulatedSegments(summary: MachineDailySummary): MachineTimelineSegment[] {
  const seg = (a: number, b: number, status: SegmentStatus, label: string): MachineTimelineSegment => ({
    startTime: segHHMM(a),
    endTime: segHHMM(b),
    startHour: a,
    endHour: b,
    status,
    label,
  });
  const segments: MachineTimelineSegment[] = [seg(0, SHIFT_START_HOUR, 'OFF', SEGMENT_LABELS.OFF)];

  if (summary.date === SEEDED_ESTOP_DAY.date) {
    segments.push(
      seg(SHIFT_START_HOUR, SEEDED_ESTOP_DAY.tripStartHour, 'RUNNING', SEGMENT_LABELS.RUNNING),
      seg(SEEDED_ESTOP_DAY.tripStartHour, SEEDED_ESTOP_DAY.tripEndHour, 'ESTOP', SEGMENT_LABELS.ESTOP),
      seg(SEEDED_ESTOP_DAY.tripEndHour, SHIFT_END_HOUR, 'IDLE', SEGMENT_LABELS.IDLE)
    );
  } else if (summary.downtime_seconds > 0 || summary.fault_count > 0) {
    const runtimeHours = summary.runtime_seconds / 3600;
    const downtimeHours = summary.downtime_seconds / 3600;
    const faultStart = SHIFT_START_HOUR + Math.max(1.0, runtimeHours * 0.4);
    const faultEnd = Math.min(SHIFT_END_HOUR, faultStart + Math.max(0.1, downtimeHours * 0.15));
    const repairEnd = Math.min(SHIFT_END_HOUR, faultEnd + Math.max(0.2, downtimeHours * 0.75));
    const verifyEnd = Math.min(SHIFT_END_HOUR, repairEnd + Math.max(0.05, downtimeHours * 0.1));
    segments.push(
      seg(SHIFT_START_HOUR, faultStart, 'RUNNING', SEGMENT_LABELS.RUNNING),
      seg(faultStart, faultEnd, 'FAULT', `Fault alarm (${summary.fault_count} incident)`),
      seg(faultEnd, repairEnd, 'MAINTENANCE', SEGMENT_LABELS.MAINTENANCE),
      seg(repairEnd, verifyEnd, 'VERIFYING', SEGMENT_LABELS.VERIFYING)
    );
    if (verifyEnd < SHIFT_END_HOUR) segments.push(seg(verifyEnd, SHIFT_END_HOUR, 'RUNNING', 'Production resumed'));
  } else {
    segments.push(seg(SHIFT_START_HOUR, SHIFT_END_HOUR, 'RUNNING', SEGMENT_LABELS.RUNNING));
  }

  segments.push(seg(SHIFT_END_HOUR, 24, 'OFF', 'Shift handover / standby'));
  return segments;
}

let machineListCache: { at: number; rows: any[] } | null = null;

async function listMachines(): Promise<{ id: string; code: string; name: string; area: string; status: string }[]> {
  if (machineListCache && Date.now() - machineListCache.at < 15_000) return machineListCache.rows;
  let dbMachines: any[] = [];
  try {
    dbMachines = await query<any>(`SELECT id, code, name, area, status FROM machines ORDER BY code ASC`);
  } catch (err) {
    dbMachines = [];
  }
  const rows = dbMachines.length > 0
    ? dbMachines
    : Object.keys(DEFAULT_MACHINE_RATES).map((code) => ({
        id: `MCH-${code}`,
        code,
        name: `${code} Production Station`,
        area: DEFAULT_MACHINE_RATES[code].cell,
        status: 'RUNNING',
      }));
  machineListCache = { at: Date.now(), rows };
  return rows;
}

function rateFor(code: string, area?: string) {
  return DEFAULT_MACHINE_RATES[code] || { rate: 45, cycle: 80, cell: area || 'Production Cell' };
}

// Deterministic ~1% scrap so figures don't jitter between polls
const scrapFor = (actual: number) => Math.floor(actual * 0.01);

type DailyOperationsResult = {
  date: string;
  source: DailyDataSource;
  asOf: string;
  nowHour: number | null; // current IST hour when the date is today
  plantSummary: {
    totalRuntimeSeconds: number;
    totalDowntimeSeconds: number;
    totalProductionPieces: number;
    totalTargetPieces: number;
    totalMissedPieces: number;
    plantAvailabilityPct: number;
    activeFaultsCount: number;
    totalMachines: number;
  };
  machines: MachineDailySummary[];
};

function summarisePlant(machines: MachineDailySummary[]): DailyOperationsResult['plantSummary'] {
  const sum = (f: (m: MachineDailySummary) => number) => machines.reduce((acc, m) => acc + f(m), 0);
  const runtime = sum((m) => m.runtime_seconds);
  const downtime = sum((m) => m.downtime_seconds);
  const idle = sum((m) => m.idle_seconds);
  return {
    totalRuntimeSeconds: runtime,
    totalDowntimeSeconds: downtime,
    totalProductionPieces: sum((m) => m.actual_pieces),
    totalTargetPieces: sum((m) => m.target_pieces),
    totalMissedPieces: sum((m) => m.missed_pieces),
    plantAvailabilityPct: runtime + downtime + idle > 0 ? Math.round((runtime / (runtime + downtime + idle)) * 1000) / 10 : 0,
    activeFaultsCount: machines.filter((m) => m.fault_count > 0).length,
    totalMachines: machines.length,
  };
}

/**
 * 8. Daily Operations History & Machine Summary for any IST business date (YYYY-MM-DD)
 * - Days covered by the power ledger (today and every day since it started): rebuilt from
 *   recorded plant power transitions + real incident timestamps. Today is cut at "now".
 * - Older days: persisted machine_daily_summary rows, else simulated demo history
 *   (flagged with source = 'SIMULATED').
 */
export async function getDailyOperationsSummary(targetDate: string = istBusinessDate()): Promise<DailyOperationsResult> {
  const today = istBusinessDate();
  const nowMs = Date.now();
  const isToday = targetDate === today;
  const asOf = new Date(nowMs).toISOString();

  // Future dates have nothing to show yet
  if (targetDate > today) {
    const machines = (await listMachines()).map((m) => emptyDay(m, targetDate));
    return { date: targetDate, source: 'RECORDED', asOf, nowHour: null, plantSummary: summarisePlant(machines), machines };
  }

  // 1. Recorded days: power ledger + incidents
  if (isLedgerCovered(targetDate)) {
    const endHour = isToday ? Math.min(24, (nowMs - istDayStartMs(targetDate)) / HOUR_MS) : 24;
    const endMs = istDayStartMs(targetDate) + endHour * HOUR_MS;
    const power = powerIntervalsForDay(targetDate, endHour);
    const incidents = await loadIncidentWindows(targetDate, endMs);
    const dayStartMs = istDayStartMs(targetDate);
    const estopTrips = power.filter((p) => p.status === 'ESTOP' && p.start > 0).length;

    const machines = (await listMachines()).map((m) => {
      const rateInfo = rateFor(m.code, m.area);
      const own = incidents.filter((i) => i.machineCode === m.code);
      const segments = buildRecordedSegments(targetDate, endHour, power, own);
      const t = summariseSegments(segments);
      const actual = Math.round(rateInfo.rate * (t.runningSeconds / 3600));
      const scrap = scrapFor(actual);
      const firstRun = segments.find((s) => s.status === 'RUNNING');
      const lastRun = [...segments].reverse().find((s) => s.status === 'RUNNING');
      const last = segments[segments.length - 1];
      const faults = own.filter((i) => i.detectedMs >= dayStartMs).length + estopTrips;

      const summary: MachineDailySummary = {
        id: `${m.id}_${targetDate}`,
        machine_id: m.id,
        machine_code: m.code,
        machine_name: m.name,
        cell_name: rateInfo.cell,
        date: targetDate,
        power_on_seconds: t.runningSeconds + t.downtimeSeconds,
        runtime_seconds: t.runningSeconds,
        idle_seconds: t.idleSeconds,
        downtime_seconds: t.downtimeSeconds,
        target_pieces: Math.round(rateInfo.rate * (t.plannedSeconds / 3600)),
        actual_pieces: actual,
        good_pieces: actual - scrap,
        scrap_pieces: scrap,
        missed_pieces: Math.round(rateInfo.rate * (t.downtimeSeconds / 3600)),
        fault_count: faults,
        warning_count: 0,
        availability_pct:
          t.runningSeconds + t.downtimeSeconds + t.idleSeconds > 0
            ? Math.round((t.runningSeconds / (t.runningSeconds + t.downtimeSeconds + t.idleSeconds)) * 1000) / 10
            : 0,
        status: isToday ? STATUS_FROM_SEGMENT[last?.status ?? 'NO_DATA'] : faults > 0 ? 'INCIDENTS_LOGGED' : 'SHIFT_COMPLETE',
        assigned_technician: own.length ? 'See incident log' : '—',
        first_power_on_at: firstRun ? istIsoAt(targetDate, firstRun.startHour) : undefined,
        last_power_off_at: lastRun && !(isToday && last?.status === 'RUNNING') ? istIsoAt(targetDate, lastRun.endHour) : undefined,
        rate_per_hour: rateInfo.rate,
        timeline_segments: segments,
      };
      return summary;
    });

    return {
      date: targetDate,
      source: isToday ? 'LIVE' : 'RECORDED',
      asOf,
      nowHour: isToday ? endHour : null,
      plantSummary: summarisePlant(machines),
      machines,
    };
  }

  // 2. Persisted daily summary rows
  try {
    const existing = await query<any>(
      `SELECT * FROM machine_daily_summary WHERE business_date = ? ORDER BY machine_code ASC`,
      [targetDate]
    );
    if (existing && existing.length > 0) {
      const machines: MachineDailySummary[] = existing.map((row: any) => {
        const summary: MachineDailySummary = {
          id: row.id,
          machine_id: row.machine_id,
          machine_code: row.machine_code,
          machine_name: row.machine_name,
          cell_name: row.cell_name,
          date: targetDate,
          power_on_seconds: row.power_on_seconds,
          runtime_seconds: row.running_seconds,
          idle_seconds: row.idle_seconds,
          downtime_seconds: row.downtime_seconds,
          target_pieces: row.planned_production,
          actual_pieces: row.actual_production,
          good_pieces: row.good_pieces,
          scrap_pieces: row.scrap_pieces,
          missed_pieces: row.missed_pieces,
          fault_count: row.fault_count,
          warning_count: row.warning_count,
          availability_pct: row.availability_pct,
          status: row.status,
          assigned_technician: row.assigned_technician || '—',
          first_power_on_at: row.first_power_on_at ? new Date(row.first_power_on_at).toISOString() : undefined,
          last_power_off_at: row.last_power_off_at ? new Date(row.last_power_off_at).toISOString() : undefined,
          rate_per_hour: row.target_rate_per_hour,
        };
        summary.timeline_segments = simulatedSegments(summary);
        return summary;
      });
      return { date: targetDate, source: 'DB_SUMMARY', asOf, nowHour: null, plantSummary: summarisePlant(machines), machines };
    }
  } catch (err: any) {}

  // 3. Simulated demo history for days before recording started
  const dayNum = parseInt(targetDate.split('-')[2] || '1', 10);
  const technicians = ['Arun Kumar', 'Ben Foster', 'Priya Sharma', 'Rajesh Nair'];
  const machines = (await listMachines()).map((m) => {
    const rateInfo = rateFor(m.code, m.area);
    let runtimeSeconds: number;
    let downtimeSeconds: number;
    let idleSeconds: number;
    let faultCount: number;
    let technician: string;

    if (targetDate === SEEDED_ESTOP_DAY.date) {
      runtimeSeconds = Math.round((SEEDED_ESTOP_DAY.tripStartHour - SHIFT_START_HOUR) * 3600);
      downtimeSeconds = SEEDED_ESTOP_DAY.downtimeSeconds;
      idleSeconds = Math.round((SHIFT_END_HOUR - SEEDED_ESTOP_DAY.tripEndHour) * 3600);
      faultCount = 1;
      technician = 'Substation Safety Interlock';
    } else if (targetDate === '2026-09-28' && ['CNC-05', 'CNC-03', 'PUMP-01'].includes(m.code)) {
      const profile = {
        'CNC-05': { run: 6.8, down: 0.75, idle: 0.45, faults: 1, tech: 'Arun Kumar (Lead Tech)' },
        'CNC-03': { run: 6.5, down: 1.48, idle: 0.66, faults: 2, tech: 'Priya Sharma' },
        'PUMP-01': { run: 7.2, down: 0.4, idle: 0.4, faults: 1, tech: 'Carlos Gomez' },
      }[m.code]!;
      runtimeSeconds = Math.round(profile.run * 3600);
      downtimeSeconds = Math.round(profile.down * 3600);
      idleSeconds = Math.round(profile.idle * 3600);
      faultCount = profile.faults;
      technician = profile.tech;
    } else if (targetDate === '2026-09-27') {
      runtimeSeconds = Math.round(7.85 * 3600);
      downtimeSeconds = 0;
      idleSeconds = Math.round(0.15 * 3600);
      faultCount = 0;
      technician = 'Ben Foster';
    } else {
      const hasFault = (dayNum + m.code.charCodeAt(m.code.length - 1)) % 7 === 0;
      runtimeSeconds = hasFault ? Math.round(6.2 * 3600) : Math.round((7.4 + (dayNum % 5) * 0.1) * 3600);
      downtimeSeconds = hasFault ? Math.round(1.2 * 3600) : Math.round(0.1 * 3600);
      idleSeconds = Math.round(0.4 * 3600);
      faultCount = hasFault ? 1 : 0;
      technician = technicians[(dayNum + m.code.length) % 4];
    }

    const actual = Math.round(rateInfo.rate * (runtimeSeconds / 3600));
    const scrap = scrapFor(actual);
    const summary: MachineDailySummary = {
      id: `${m.id}_${targetDate}`,
      machine_id: m.id,
      machine_code: m.code,
      machine_name: m.name,
      cell_name: rateInfo.cell,
      date: targetDate,
      power_on_seconds: runtimeSeconds + downtimeSeconds + idleSeconds,
      runtime_seconds: runtimeSeconds,
      idle_seconds: idleSeconds,
      downtime_seconds: downtimeSeconds,
      target_pieces: Math.round(rateInfo.rate * (SHIFT_END_HOUR - SHIFT_START_HOUR)),
      actual_pieces: actual,
      good_pieces: actual - scrap,
      scrap_pieces: scrap,
      missed_pieces: Math.round(rateInfo.rate * (downtimeSeconds / 3600)),
      fault_count: faultCount,
      warning_count: faultCount > 0 ? 2 : 0,
      availability_pct: Math.round((runtimeSeconds / (runtimeSeconds + downtimeSeconds + idleSeconds)) * 1000) / 10,
      status: faultCount > 0 ? 'INCIDENTS_LOGGED' : 'SHIFT_COMPLETE',
      assigned_technician: technician,
      first_power_on_at: istIsoAt(targetDate, SHIFT_START_HOUR),
      last_power_off_at: istIsoAt(targetDate, targetDate === SEEDED_ESTOP_DAY.date ? SEEDED_ESTOP_DAY.tripStartHour : SHIFT_END_HOUR),
      rate_per_hour: rateInfo.rate,
    };
    summary.timeline_segments = simulatedSegments(summary);
    return summary;
  });

  return { date: targetDate, source: 'SIMULATED', asOf, nowHour: null, plantSummary: summarisePlant(machines), machines };
}

function emptyDay(m: { id: string; code: string; name: string; area: string }, date: string): MachineDailySummary {
  const rateInfo = rateFor(m.code, m.area);
  return {
    id: `${m.id}_${date}`,
    machine_id: m.id,
    machine_code: m.code,
    machine_name: m.name,
    cell_name: rateInfo.cell,
    date,
    power_on_seconds: 0,
    runtime_seconds: 0,
    idle_seconds: 0,
    downtime_seconds: 0,
    target_pieces: 0,
    actual_pieces: 0,
    good_pieces: 0,
    scrap_pieces: 0,
    missed_pieces: 0,
    fault_count: 0,
    warning_count: 0,
    availability_pct: 0,
    status: 'SCHEDULED',
    assigned_technician: '—',
    rate_per_hour: rateInfo.rate,
    timeline_segments: [],
  };
}

/**
 * 9. 24-Hour Gantt Timeline & Chronological Event Log for a Specific Machine
 */
export async function getMachineDayDetail(machineCode: string = 'CNC-05', targetDate: string = istBusinessDate()): Promise<{
  machineCode: string;
  date: string;
  source: DailyDataSource;
  summary: MachineDailySummary;
  timelineSegments: MachineTimelineSegment[];
  events: MachineDayEvent[];
}> {
  const dailyOps = await getDailyOperationsSummary(targetDate);
  const summary = dailyOps.machines.find((m) => m.machine_code === machineCode) || dailyOps.machines[0];
  const timelineSegments = summary.timeline_segments || [];
  const dayStartMs = istDayStartMs(targetDate);
  const dayEndMs = dayStartMs + 24 * HOUR_MS;
  const istTime = (ms: number) => new Date(ms + IST_OFFSET_MS).toISOString().slice(11, 19);
  const events: MachineDayEvent[] = [];

  if (dailyOps.source === 'LIVE' || dailyOps.source === 'RECORDED') {
    // Plant power transitions recorded during the day
    for (const e of getPowerLedger()) {
      const ms = Date.parse(e.at);
      if (ms < dayStartMs || ms >= dayEndMs) continue;
      events.push({
        time: istTime(ms),
        timestamp: e.at,
        type: e.status === 'ON' ? 'POWER_ON' : e.status === 'ESTOP' ? 'ESTOP_TRIP' : 'POWER_OFF',
        category: 'POWER',
        title:
          e.status === 'ON' ? 'Plant power energized'
          : e.status === 'ESTOP' ? '🚨 Emergency E-Stop trip'
          : 'Plant power de-energized',
        description:
          e.reason === 'server_boot'
            ? `Control server started with plant power ${e.status}.`
            : `Plant power changed to ${e.status} (${e.reason.replace(/_/g, ' ')}).`,
        status: e.status === 'ON' ? 'COMPLETED' : e.status === 'ESTOP' ? 'CRITICAL' : 'INFO',
        actor: 'Substation MCC Panel',
      });
    }

    // Incident milestones for this machine
    const incidents = await loadIncidentWindows(targetDate, Math.min(Date.now(), dayEndMs));
    for (const inc of incidents.filter((i) => i.machineCode === summary.machine_code)) {
      for (const p of inc.phases) {
        if (p.startMs < dayStartMs || p.startMs >= dayEndMs) continue;
        events.push({
          time: istTime(p.startMs),
          timestamp: new Date(p.startMs).toISOString(),
          type: p.status === 'FAULT' ? 'FAULT_DETECTED' : p.status === 'MAINTENANCE' ? 'LOTO_STARTED' : 'VERIFICATION_STARTED',
          category: p.status === 'FAULT' ? 'IOT' : p.status === 'MAINTENANCE' ? 'TECHNICIAN' : 'RECOVERY',
          title: p.status === 'FAULT' ? `🔴 ${inc.alertType}` : SEGMENT_LABELS[p.status],
          description: `Incident ${inc.id} on ${summary.machine_code}.`,
          status: p.status === 'FAULT' ? 'CRITICAL' : 'IN_PROGRESS',
          actor: 'PLANTOPS Engine',
        });
      }
    }
  } else {
    // Simulated history: narrative events consistent with the simulated segments
    const firstRun = timelineSegments.find((s) => s.status === 'RUNNING');
    if (firstRun) {
      events.push({
        time: `${firstRun.startTime}:00`,
        timestamp: istIsoAt(targetDate, firstRun.startHour),
        type: 'POWER_ON',
        category: 'POWER',
        title: 'Main substation feeder energized',
        description: `480V bus energized. Breaker ${summary.machine_code} closed.`,
        status: 'COMPLETED',
        actor: 'Substation MCC Panel',
      });
    }
    for (const s of timelineSegments) {
      if (s.status === 'RUNNING' || s.status === 'OFF') continue;
      events.push({
        time: `${s.startTime}:00`,
        timestamp: istIsoAt(targetDate, s.startHour),
        type: s.status === 'ESTOP' ? 'ESTOP_TRIP' : s.status === 'FAULT' ? 'FAULT_DETECTED' : s.status === 'MAINTENANCE' ? 'LOTO_STARTED' : s.status === 'VERIFYING' ? 'VERIFICATION_STARTED' : 'POWER_OFF',
        category: s.status === 'ESTOP' || s.status === 'IDLE' ? 'POWER' : s.status === 'FAULT' ? 'IOT' : s.status === 'MAINTENANCE' ? 'TECHNICIAN' : 'RECOVERY',
        title: s.label,
        description: `${s.startTime} – ${s.endTime} IST on ${summary.machine_code}.`,
        status: s.status === 'ESTOP' || s.status === 'FAULT' ? 'CRITICAL' : 'INFO',
        actor: 'Historical record (simulated)',
      });
    }
  }

  // Merge authoritative machine_operational_events recorded in the database (IST day window)
  try {
    const realDbEvents = await query<any>(
      `SELECT event_type, actor_id, technician_id, metadata_json, event_time
       FROM machine_operational_events
       WHERE machine_code = ? AND event_time >= ? AND event_time < ?
       ORDER BY event_time ASC`,
      [summary.machine_code, new Date(dayStartMs), new Date(dayEndMs)]
    );
    for (const r of realDbEvents || []) {
      const t = String(r.event_type);
      let category: MachineDayEvent['category'] = 'IOT';
      if (t.includes('POWER')) category = 'POWER';
      else if (t.includes('PIECE') || t.includes('PRODUCTION')) category = 'PRODUCTION';
      else if (t.includes('AI') || t.includes('MATCH')) category = 'AI';
      else if (t.includes('TECHNICIAN') || t.includes('LOTO') || t.includes('REPAIR') || t.includes('INSPECTION')) category = 'TECHNICIAN';
      else if (t.includes('PART') || t.includes('INVENTORY')) category = 'INVENTORY';
      else if (t.includes('VERIFICATION') || t.includes('RUNNING') || t.includes('RESOLVED')) category = 'RECOVERY';

      let status: MachineDayEvent['status'] = 'COMPLETED';
      if (t.includes('FAULT')) status = 'CRITICAL';
      else if (t.includes('WARN')) status = 'WARN';
      else if (t.includes('STARTED') || t.includes('IN_PROGRESS')) status = 'IN_PROGRESS';

      let meta = null;
      if (r.metadata_json) {
        try { meta = typeof r.metadata_json === 'string' ? JSON.parse(r.metadata_json) : r.metadata_json; } catch {}
      }
      const ms = new Date(r.event_time).getTime();
      events.push({
        time: istTime(ms),
        timestamp: new Date(ms).toISOString(),
        type: t,
        category,
        title: t.replace(/_/g, ' '),
        description: `Authoritative audit event on ${summary.machine_code}.${r.technician_id ? ` Specialist: ${r.technician_id}` : ''}`,
        status,
        actor: r.technician_id || r.actor_id || 'PLANTOPS Engine',
        metadata: meta,
      });
    }
  } catch (err: any) {
    // Non-fatal: DB may be unavailable
  }

  events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return { machineCode, date: targetDate, source: dailyOps.source, summary, timelineSegments, events };
}

/**
 * 10. Monthly Production Calendar (one summary per day)
 */
export async function getMonthlyCalendar(year: number = Number(istBusinessDate().slice(0, 4)), month: number = Number(istBusinessDate().slice(5, 7))): Promise<{
  year: number;
  month: number;
  today: string;
  days: {
    day: number;
    date: string;
    machinesRunning: number;
    faultsCount: number;
    repairsCount: number;
    productionPieces: number;
    missedPieces: number;
    availabilityPct: number;
    source: DailyDataSource | 'FUTURE';
  }[];
}> {
  const today = istBusinessDate();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const days = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (date > today) {
      days.push({ day: d, date, machinesRunning: 0, faultsCount: 0, repairsCount: 0, productionPieces: 0, missedPieces: 0, availabilityPct: 0, source: 'FUTURE' as const });
      continue;
    }
    const ops = await getDailyOperationsSummary(date);
    const faults = ops.machines.reduce((acc, m) => acc + m.fault_count, 0);
    days.push({
      day: d,
      date,
      machinesRunning: ops.machines.filter((m) => m.runtime_seconds > 0).length,
      faultsCount: faults,
      repairsCount: ops.machines.filter((m) => m.downtime_seconds > 0 && m.fault_count > 0).length,
      productionPieces: ops.plantSummary.totalProductionPieces,
      missedPieces: ops.plantSummary.totalMissedPieces,
      availabilityPct: ops.plantSummary.plantAvailabilityPct,
      source: ops.source,
    });
  }

  return { year, month, today, days };
}

/**
 * 11. Daily Reconciliation Background Engine
 * Recomputes today's IST business-day aggregates every 5 minutes.
 */
let reconciliationInterval: NodeJS.Timeout | null = null;

export function startDailyReconciliationEngine(): void {
  if (reconciliationInterval) return;

  console.log('[DailyReconciliation] Initializing 5-minute background reconciliation worker...');

  setTimeout(async () => {
    try {
      const today = istBusinessDate();
      await getDailyOperationsSummary(today);
      console.log(`[DailyReconciliation] Initial aggregate sync completed for ${today}`);
    } catch (err: any) {
      console.warn(`[DailyReconciliation] Initial sync warning: ${err.message}`);
    }
  }, 5000);

  reconciliationInterval = setInterval(async () => {
    try {
      await getDailyOperationsSummary(istBusinessDate());
      console.log(`[DailyReconciliation] Periodic aggregate reconciliation check passed.`);
    } catch (err: any) {
      console.warn(`[DailyReconciliation] Periodic reconciliation error: ${err.message}`);
    }
  }, 5 * 60 * 1000);
}
