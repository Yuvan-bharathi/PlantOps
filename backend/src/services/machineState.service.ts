/**
 * Single source of truth for "what state is each machine in right now".
 *
 * Data architecture:
 *   MQTT (Mosquitto)  → telemetry ingest (telemetry.service.ts)
 *   Redis             → latest reading + live state per machine (in-memory fallback when Redis is down)
 *   TimescaleDB       → full telemetry history (telemetry_logs hypertable)
 *   TiDB Cloud        → system of record (machines, incidents, work orders, thresholds, …)
 *   Power service     → plant power + per-machine breaker state
 *
 * Effective status = machines.status (TiDB) adjusted by live power/breaker state — the same rule
 * the dashboards use via GET /api/machines, so every screen and the AI assistant agree.
 */
import { query } from '../db/mysql.js';
import { getTimescalePool } from '../db/timescale.js';
import { getLatestTelemetry } from '../db/redis.js';
import { getPlantPowerState } from './powerProduction.service.js';

export const TELEMETRY_METRICS = ['temperature', 'vibration', 'current', 'rpm', 'pressure'] as const;
export type TelemetryMetric = (typeof TELEMETRY_METRICS)[number];

/**
 * Plant-wide condition-monitoring limits used by the telemetry pipeline to raise WARNING / FAULT.
 * Pressure is a low-side limit (alarm when BELOW), the others are high-side.
 */
export const CONDITION_LIMITS = {
  vibration: { warning: 5.0, fault: 7.5, unit: 'mm/s', direction: 'above' },
  temperature: { warning: 70, fault: 80, unit: '°C', direction: 'above' },
  current: { warning: 15, fault: 18, unit: 'A', direction: 'above' },
  pressure: { warning: 4.5, fault: 3.0, unit: 'bar', direction: 'below' },
} as const;

/** Classifies a reading against the limits (per-machine sensor_thresholds override the defaults). */
export function evaluateReading(
  reading: TelemetryReading | null,
  overrides: { sensor_type: string; warning_threshold: number; fault_threshold: number }[] = []
): { status: 'NORMAL' | 'WARNING' | 'FAULT' | 'UNKNOWN'; breaches: string[] } {
  if (!reading) return { status: 'UNKNOWN', breaches: [] };
  const breaches: string[] = [];
  let status: 'NORMAL' | 'WARNING' | 'FAULT' = 'NORMAL';
  for (const [metric, def] of Object.entries(CONDITION_LIMITS)) {
    const v = (reading as any)[metric];
    if (v == null || (metric === 'pressure' && v <= 0)) continue;
    const o = overrides.find((x) => x.sensor_type.toLowerCase() === metric);
    const warn = o ? Number(o.warning_threshold) : def.warning;
    const fault = o ? Number(o.fault_threshold) : def.fault;
    const past = (limit: number) => (def.direction === 'below' ? v < limit : v > limit);
    if (past(fault)) {
      status = 'FAULT';
      breaches.push(`${metric} ${v} ${def.unit} beyond FAULT limit ${def.direction === 'below' ? '<' : '>'} ${fault}`);
    } else if (past(warn)) {
      if (status === 'NORMAL') status = 'WARNING';
      breaches.push(`${metric} ${v} ${def.unit} beyond WARNING limit ${def.direction === 'below' ? '<' : '>'} ${warn}`);
    }
  }
  return { status, breaches };
}

// A reading older than this is reported as stale rather than "live"
const LIVE_TELEMETRY_MAX_AGE_S = 120;

type PowerSnapshot = ReturnType<typeof getPlantPowerState>;

/** DB status adjusted for plant power and the machine's breaker. */
export function effectiveMachineStatus(machineCode: string, dbStatus: string, power: PowerSnapshot = getPlantPowerState()): string {
  const isPowerHalted = power.plant.status === 'ESTOP' || power.plant.status === 'OFF';
  const breaker = power.breakers.find((b) => b.machine_code === machineCode);
  const protectedStates = ['FAULT', 'MAINTENANCE', 'VERIFYING'];
  if (breaker && (breaker.breaker_status === 'OPEN' || breaker.breaker_status === 'TRIPPED' || isPowerHalted)) {
    return protectedStates.includes(dbStatus) ? dbStatus : 'OFF';
  }
  if (!isPowerHalted && (dbStatus === 'OFF' || dbStatus === 'OFFLINE')) return 'RUNNING';
  return dbStatus;
}

export interface TelemetryReading {
  time: string;
  temperature?: number;
  vibration?: number;
  current?: number;
  rpm?: number;
  pressure?: number;
}

export interface TelemetryFreshness {
  latest: TelemetryReading | null;
  source: 'redis-live' | 'timescaledb' | 'none';
  ageSeconds: number | null;
  status: 'LIVE' | 'STALE' | 'NO_DATA';
}

function freshness(latest: TelemetryReading | null, source: TelemetryFreshness['source']): TelemetryFreshness {
  if (!latest) return { latest: null, source: 'none', ageSeconds: null, status: 'NO_DATA' };
  const age = Math.max(0, Math.round((Date.now() - new Date(latest.time).getTime()) / 1000));
  return { latest, source, ageSeconds: age, status: age <= LIVE_TELEMETRY_MAX_AGE_S ? 'LIVE' : 'STALE' };
}

const round = (v: any, d = 2) => (v == null || Number.isNaN(Number(v)) ? undefined : Math.round(Number(v) * 10 ** d) / 10 ** d);

function fromRedis(t: Record<string, any>): TelemetryReading {
  return {
    time: new Date(t.timestamp || t.time || Date.now()).toISOString(),
    temperature: round(t.temperature),
    vibration: round(t.vibration),
    current: round(t.current),
    rpm: round(t.rpm, 0),
    pressure: round(t.pressure),
  };
}

function fromRow(r: any): TelemetryReading {
  return {
    time: new Date(r.time).toISOString(),
    temperature: round(r.temperature),
    vibration: round(r.vibration),
    current: round(r.current),
    rpm: round(r.rpm, 0),
    pressure: round(r.pressure),
  };
}

/** Latest reading per machine: Redis/in-memory live cache first, TimescaleDB history second. */
export async function getLatestReadings(machineCodes: string[]): Promise<Record<string, TelemetryFreshness>> {
  const out: Record<string, TelemetryFreshness> = {};
  const live = await Promise.all(machineCodes.map((c) => getLatestTelemetry(c).catch(() => null)));
  const missing: string[] = [];
  machineCodes.forEach((code, i) => {
    if (live[i]) out[code] = freshness(fromRedis(live[i]!), 'redis-live');
    else missing.push(code);
  });
  if (missing.length) {
    try {
      const { rows } = await getTimescalePool().query(
        `SELECT DISTINCT ON (machine_id) machine_id, time, temperature, vibration, current, rpm, pressure
         FROM telemetry_logs WHERE machine_id = ANY($1) ORDER BY machine_id, time DESC`,
        [missing]
      );
      for (const r of rows) out[r.machine_id] = freshness(fromRow(r), 'timescaledb');
    } catch {
      // TimescaleDB unreachable — reported as NO_DATA below
    }
  }
  for (const code of machineCodes) out[code] ||= freshness(null, 'none');
  return out;
}

export interface TelemetryWindowStats {
  machineCode: string;
  windowMinutes: number;
  from: string;
  to: string;
  samples: number;
  metrics: Record<string, { avg?: number; min?: number; max?: number; stddev?: number }>;
}

/** Aggregates over a recent window from TimescaleDB. */
export async function getTelemetryWindow(machineCode: string, windowMinutes: number): Promise<TelemetryWindowStats | null> {
  const sel = TELEMETRY_METRICS.map(
    (m) => `AVG(${m}) AS ${m}_avg, MIN(${m}) AS ${m}_min, MAX(${m}) AS ${m}_max, STDDEV(${m}) AS ${m}_sd`
  ).join(', ');
  const { rows } = await getTimescalePool().query(
    `SELECT COUNT(*)::int AS samples, MIN(time) AS first, MAX(time) AS last, ${sel}
     FROM telemetry_logs WHERE machine_id = $1 AND time > NOW() - make_interval(mins => $2)`,
    [machineCode, windowMinutes]
  );
  const r = rows[0];
  if (!r || !r.samples) return null;
  const metrics: TelemetryWindowStats['metrics'] = {};
  for (const m of TELEMETRY_METRICS) {
    metrics[m] = { avg: round(r[`${m}_avg`]), min: round(r[`${m}_min`]), max: round(r[`${m}_max`]), stddev: round(r[`${m}_sd`], 3) };
  }
  return {
    machineCode,
    windowMinutes,
    from: new Date(r.first).toISOString(),
    to: new Date(r.last).toISOString(),
    samples: r.samples,
    metrics,
  };
}

/** Time-bucketed trend of one metric (TimescaleDB time_bucket). */
export async function getTelemetryTrend(machineCode: string, metric: TelemetryMetric, hours: number, bucketMinutes: number) {
  const { rows } = await getTimescalePool().query(
    `SELECT time_bucket(make_interval(mins => $3), time) AS bucket,
            AVG(${metric}) AS avg, MIN(${metric}) AS min, MAX(${metric}) AS max, COUNT(*)::int AS n
     FROM telemetry_logs
     WHERE machine_id = $1 AND time > NOW() - make_interval(hours => $2)
     GROUP BY bucket ORDER BY bucket`,
    [machineCode, hours, bucketMinutes]
  );
  return rows.map((r) => ({ bucket: new Date(r.bucket).toISOString(), avg: round(r.avg), min: round(r.min), max: round(r.max), samples: r.n }));
}

export interface EffectiveMachine {
  id: string;
  code: string;
  name: string;
  type: string;
  area: string;
  criticality: string;
  health_score: number;
  db_status: string;
  status: string;
  breaker?: { breaker_status: string; power_status: string; voltage: number };
  telemetry: TelemetryFreshness;
}

/** Machines with effective status, breaker state and telemetry freshness in one pass. */
export async function getEffectiveMachines(filter: { area?: string; status?: string; type?: string; codes?: string[] } = {}): Promise<EffectiveMachine[]> {
  const where: string[] = [];
  const params: any[] = [];
  if (filter.area) { where.push('UPPER(area) LIKE ?'); params.push(`%${filter.area.toUpperCase()}%`); }
  if (filter.type) { where.push('UPPER(type) = ?'); params.push(filter.type.toUpperCase()); }
  if (filter.codes?.length) { where.push(`code IN (${filter.codes.map(() => '?').join(',')})`); params.push(...filter.codes); }
  const rows = await query<any>(
    `SELECT id, code, name, type, area, status, health_score, criticality FROM machines ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY code ASC`,
    params
  );
  const power = getPlantPowerState();
  const readings = await getLatestReadings(rows.map((r) => r.code));
  const machines = rows.map((r) => {
    const b = power.breakers.find((x) => x.machine_code === r.code);
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      type: r.type,
      area: r.area,
      criticality: r.criticality,
      health_score: r.health_score,
      db_status: r.status,
      status: effectiveMachineStatus(r.code, r.status, power),
      breaker: b ? { breaker_status: b.breaker_status, power_status: b.power_status, voltage: b.voltage } : undefined,
      telemetry: readings[r.code],
    };
  });
  return filter.status ? machines.filter((m) => m.status === filter.status!.toUpperCase()) : machines;
}
