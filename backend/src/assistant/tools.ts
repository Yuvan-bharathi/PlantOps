/**
 * Agent tool registry. READ tools run automatically; PROPOSE tools only create an approval
 * request (see actions.ts) — nothing is written until a person approves it.
 * Plant power / E-stop / breaker controls are deliberately not exposed.
 */
import { query } from '../db/mysql.js';
import { getDailyOperationsSummary, getPlantPowerState, istBusinessDate } from '../services/powerProduction.service.js';
import { getLotoProtocolForMachine } from '../services/maintenance.service.js';
import { getFleetState } from '../services/fleet.service.js';
import { runAIMaintenanceOrchestration } from '../services/aiOrchestrator.service.js';
import { getDowntimeBreakdown } from '../services/eventRecorder.service.js';
import {
  CONDITION_LIMITS, EffectiveMachine, TelemetryFreshness, TELEMETRY_METRICS, evaluateReading, getEffectiveMachines,
  getLatestReadings, getTelemetryTrend, getTelemetryWindow,
} from '../services/machineState.service.js';
import type { ToolSpec } from './groq.js';
import { searchKnowledge, SearchHit } from './knowledge/store.js';
import type { SourceType } from './knowledge/sources.js';
import { proposeAction, ProposedAction } from './actions.js';

export interface ToolContext {
  sessionId: string;
  user: { name: string; role: string };
  /** Registers retrieved passages and returns their citation labels (S1, S2, …). */
  addSources(hits: SearchHit[]): string[];
  addAction(a: ProposedAction): void;
}

interface ToolDef {
  kind: 'read' | 'propose';
  spec: ToolSpec;
  run(args: any, ctx: ToolContext): Promise<any>;
}

const MAX_RESULT_CHARS = 7000;
const OPEN_INCIDENT = `i.status NOT IN ('RESOLVED','CLOSED')`;
const OPEN_WO = `w.status NOT IN ('COMPLETED','CLOSED','CANCELLED')`;

// Optional parameters also accept null: models often send `"machine_code": null` for "not set",
// and Groq validates arguments against the schema server-side (a mismatch aborts the whole turn).
const nullable = (schema: Record<string, any>) => ({
  ...schema,
  type: [schema.type, 'null'],
  ...(schema.enum ? { enum: [...schema.enum, null] } : {}),
});

const fn = (name: string, description: string, properties: Record<string, any> = {}, required: string[] = []): ToolSpec => ({
  type: 'function',
  function: {
    name,
    description,
    parameters: {
      type: 'object',
      properties: Object.fromEntries(Object.entries(properties).map(([k, v]) => [k, required.includes(k) ? v : nullable(v)])),
      required,
      additionalProperties: false,
    },
  },
});

// All times handed to the model are plant-local (IST) and labelled, so answers never mix up time zones
const IST_MS = 330 * 60 * 1000;
const ts = (v: any) => (v ? new Date(new Date(v).getTime() + IST_MS).toISOString().replace('T', ' ').slice(0, 16) + ' IST' : null);
const mins = (s: any) => (s == null ? null : Math.round(Number(s) / 60));

// Accepts "CNC-05", "cnc 5", "cnc5", "MCH-CNC-05"
async function resolveMachine(input: string): Promise<{ machine?: any; suggestions?: string[] }> {
  const raw = String(input || '').trim().toUpperCase().replace(/^MCH-/, '');
  const m = raw.match(/^([A-Z]+)[\s_-]*(\d+)$/);
  const normalized = m ? `${m[1]}-${m[2].padStart(2, '0')}` : raw;
  const rows = await query<any>(
    `SELECT id, code, name, type, area, status, health_score, criticality, last_running_started_at, downtime_started_at
     FROM machines WHERE UPPER(code) IN (?, ?) OR UPPER(id) IN (?, ?) LIMIT 1`,
    [raw, normalized, `MCH-${raw}`, `MCH-${normalized}`]
  );
  if (rows[0]) return { machine: rows[0] };
  const like = await query<any>(`SELECT code FROM machines WHERE UPPER(code) LIKE ? OR UPPER(name) LIKE ? LIMIT 8`, [
    `%${m ? m[1] : raw}%`,
    `%${raw}%`,
  ]);
  return { suggestions: like.map((r) => r.code) };
}

async function resolvePart(input: string): Promise<any | null> {
  const q = String(input || '').trim();
  const rows = await query<any>(
    `SELECT sp.*, COALESCE(SUM(inv.quantity_on_hand),0) AS on_hand, COALESCE(SUM(inv.reserved_quantity),0) AS reserved,
            COALESCE(SUM(inv.available_to_promise),0) AS atp,
            GROUP_CONCAT(CONCAT(inv.warehouse_name,' ',inv.bin_location) SEPARATOR '; ') AS locations
     FROM spare_parts sp LEFT JOIN inventory inv ON inv.part_id = sp.id
     WHERE UPPER(sp.id) = UPPER(?) OR UPPER(sp.part_number) = UPPER(?)
     GROUP BY sp.id LIMIT 1`,
    [q, q]
  );
  return rows[0] || null;
}

function partView(p: any) {
  return {
    part_id: p.id,
    part_number: p.part_number,
    name: p.name,
    category: p.category,
    on_hand: Number(p.on_hand),
    reserved: Number(p.reserved),
    available_to_promise: Number(p.atp),
    min_reorder_point: p.min_reorder_point,
    safety_stock: p.safety_stock,
    below_reorder_point: Number(p.atp) <= Number(p.min_reorder_point ?? 0),
    unit_cost_usd: Number(p.unit_cost),
    lead_time_days: p.lead_time_days,
    supplier: p.supplier_name,
    locations: p.locations || null,
  };
}

// Latest reading with an explicit freshness verdict so the agent never presents stale data as live
function telemetryView(t: TelemetryFreshness) {
  if (t.status === 'NO_DATA') return { status: 'NO_DATA', note: 'No sensor readings found in Redis or TimescaleDB' };
  const age = t.ageSeconds ?? 0;
  const ageText = age < 120 ? `${age}s` : age < 7200 ? `${Math.round(age / 60)} min` : `${Math.round(age / 3600)} h`;
  return {
    status: t.status,
    source: t.source,
    reading_time: ts(t.latest?.time),
    age: ageText,
    values: t.latest ? { ...t.latest, time: undefined } : undefined,
    note: t.status === 'STALE' ? `Last reading is ${ageText} old — the MQTT telemetry stream is not delivering live data for this machine.` : undefined,
  };
}

const machineNotFound = (input: string, suggestions?: string[]) => ({
  error: `Machine "${input}" not found.`,
  did_you_mean: suggestions?.length ? suggestions : undefined,
});

const TOOLS: Record<string, ToolDef> = {
  search_knowledge_base: {
    kind: 'read',
    spec: fn(
      'search_knowledge_base',
      'Semantic + keyword search over the plant knowledge held in TiDB: SOPs (repair procedures, torque/temperature specs), OSHA 1910.147 LOTO ' +
        'energy-isolation protocols, inspection checklists, and past incident reports & work-order notes (what failed and what fixed it). ' +
        'Use for any "how to", specification, safety, root-cause or "has this happened before" question. Returns passages labelled [S#] to cite.',
      {
        query: { type: 'string', description: 'Specific search query, e.g. "spindle bearing locknut torque" or "pump seal leak root cause"' },
        machine_type: { type: 'string', description: 'Optional machine type filter: CNC, ROBOT, PUMP, MIXER, PROCESSING, PRESS, ASSEMBLY, CONVEYOR, PACKAGING, MAINTENANCE' },
        source_types: {
          type: 'array',
          items: { type: 'string', enum: ['SOP', 'LOTO', 'INSPECTION', 'INCIDENT', 'WORK_ORDER'] },
          description: 'Optional: restrict to these source types (e.g. ["INCIDENT","WORK_ORDER"] for history)',
        },
        top_k: { type: 'integer', description: 'Passages to return (default 6, max 10)' },
      },
      ['query']
    ),
    async run(args, ctx) {
      const { hits, queries, mode } = await searchKnowledge(args.query, {
        topK: args.top_k,
        machineType: args.machine_type,
        sourceTypes: args.source_types as SourceType[] | undefined,
      });
      if (!hits.length) return { results: [], note: 'No relevant passages found in the knowledge base. Say so rather than guessing.', search_mode: mode };
      const labels = ctx.addSources(hits);
      return {
        search_mode: mode,
        queries_used: queries,
        results: hits.map((h, i) => ({
          cite: labels[i],
          title: h.title,
          section: h.section || undefined,
          source_type: h.sourceType,
          ref: h.ref,
          machine: h.machineCode || h.machineType || undefined,
          relevance: h.score,
          text: h.content,
        })),
      };
    },
  },

  list_machines: {
    kind: 'read',
    spec: fn(
      'list_machines',
      'Machines with their EFFECTIVE status (TiDB record + live plant power/breaker state — the same status the dashboards show), ' +
        'health, criticality and telemetry freshness (latest reading from Redis/MQTT or TimescaleDB, with its age). ' +
        'Set include_live=true for a cell/plant overview: adds latest sensor values vs alarm limits, open incidents, open work orders and today\'s output. ' +
        'Prefer this over calling get_machine_details for every machine.',
      {
        area: { type: 'string', description: 'e.g. "Machining", "Robot", "Packaging"' },
        status: { type: 'string', description: 'Effective status filter, e.g. RUNNING, FAULT, MAINTENANCE, OFF' },
        type: { type: 'string', description: 'Machine type, e.g. CNC, ROBOT, PUMP' },
        include_live: { type: 'boolean', description: 'Include sensor values, open incidents/work orders and today\'s output per machine' },
      }
    ),
    async run(args) {
      const machines = await getEffectiveMachines({ area: args.area, status: args.status, type: args.type });
      const telemetrySummary = {
        live: machines.filter((m) => m.telemetry.status === 'LIVE').length,
        stale: machines.filter((m) => m.telemetry.status === 'STALE').length,
        no_data: machines.filter((m) => m.telemetry.status === 'NO_DATA').length,
      };
      const base = (m: EffectiveMachine) => ({
        code: m.code,
        name: m.name,
        type: m.type,
        area: m.area,
        status: m.status,
        recorded_status_in_db: m.db_status !== m.status ? m.db_status : undefined,
        health_score: m.health_score,
        criticality: m.criticality,
        telemetry: telemetryView(m.telemetry),
      });
      if (!args.include_live || !machines.length) {
        return { count: machines.length, as_of: ts(Date.now()), telemetry_summary: telemetrySummary, machines: machines.map(base) };
      }
      const ids = machines.map((m) => m.id);
      const inList = ids.map(() => '?').join(',');
      const [incidents, workOrders, daily] = await Promise.all([
        query<any>(`SELECT i.machine_id, i.id, i.alert_type, i.severity, i.status FROM incidents i WHERE i.machine_id IN (${inList}) AND ${OPEN_INCIDENT}`, ids).catch(() => []),
        query<any>(`SELECT w.machine_id, w.id, w.status, w.priority FROM work_orders w WHERE w.machine_id IN (${inList}) AND ${OPEN_WO}`, ids).catch(() => []),
        getDailyOperationsSummary(istBusinessDate()).catch(() => null),
      ]);
      return {
        count: machines.length,
        as_of: ts(Date.now()),
        telemetry_summary: telemetrySummary,
        machines: machines.map((m) => {
          const today = daily?.machines.find((d) => d.machine_code === m.code);
          return {
            ...base(m),
            condition: evaluateReading(m.telemetry.latest),
            breaker: m.breaker?.breaker_status,
            open_incidents: incidents.filter((x: any) => x.machine_id === m.id).map(({ machine_id, ...x }: any) => x),
            open_work_orders: workOrders.filter((x: any) => x.machine_id === m.id).map(({ machine_id, ...x }: any) => x),
            today: today
              ? { runtime_min: mins(today.runtime_seconds), downtime_min: mins(today.downtime_seconds), pieces: today.actual_pieces, target_so_far: today.target_pieces, faults: today.fault_count }
              : undefined,
          };
        }),
        note:
          telemetrySummary.live === 0
            ? 'No live sensor data is arriving (MQTT telemetry stream idle). Statuses reflect the machine record and plant power only — say so explicitly.'
            : undefined,
      };
    },
  },

  get_machine_details: {
    kind: 'read',
    spec: fn(
      'get_machine_details',
      'Full live picture of ONE machine: effective status, health, breaker state, latest sensor reading and its age (Redis/MQTT live cache or ' +
        'TimescaleDB), last-hour sensor statistics from TimescaleDB vs alarm limits, open incidents, open work orders, next preventive maintenance ' +
        'and today\'s runtime/production. Use for "what is wrong with X / status of X".',
      { machine_code: { type: 'string', description: 'e.g. CNC-05' } },
      ['machine_code']
    ),
    async run(args) {
      const { machine, suggestions } = await resolveMachine(args.machine_code);
      if (!machine) return machineNotFound(args.machine_code, suggestions);
      const [[eff], thresholds, incidents, workOrders, pm, daily, window] = await Promise.all([
        getEffectiveMachines({ codes: [machine.code] }),
        query<any>(`SELECT sensor_type, warning_threshold, fault_threshold, unit FROM sensor_thresholds WHERE machine_id = ?`, [machine.id]).catch(() => []),
        query<any>(
          `SELECT i.id, i.alert_type, i.severity, i.status, i.detected_at, i.ai_root_cause FROM incidents i WHERE i.machine_id = ? AND ${OPEN_INCIDENT} ORDER BY i.detected_at DESC LIMIT 5`,
          [machine.id]
        ).catch(() => []),
        query<any>(
          `SELECT w.id, w.priority, w.status, w.technician_phase, t.name AS technician, w.created_at FROM work_orders w LEFT JOIN technicians t ON t.id = w.technician_id
           WHERE w.machine_id = ? AND ${OPEN_WO} ORDER BY w.created_at DESC LIMIT 5`,
          [machine.id]
        ).catch(() => []),
        query<any>(`SELECT task_title, sop_code, next_due_date, status FROM pm_schedules WHERE machine_code = ? ORDER BY next_due_date ASC LIMIT 3`, [machine.code]).catch(() => []),
        getDailyOperationsSummary(istBusinessDate()).catch(() => null),
        getTelemetryWindow(machine.code, 60).catch(() => null),
      ]);
      const today = daily?.machines.find((m) => m.machine_code === machine.code);
      return {
        machine: {
          code: machine.code,
          name: machine.name,
          type: machine.type,
          area: machine.area,
          status: eff?.status ?? machine.status,
          recorded_status_in_db: eff && eff.db_status !== eff.status ? eff.db_status : undefined,
          health_score: machine.health_score,
          criticality: machine.criticality,
          last_running_started_at: ts(machine.last_running_started_at),
          downtime_started_at: ts(machine.downtime_started_at),
        },
        breaker: eff?.breaker,
        telemetry: eff ? telemetryView(eff.telemetry) : undefined,
        condition: eff ? evaluateReading(eff.telemetry.latest, thresholds) : undefined,
        last_hour_timescaledb: window ? { ...window, from: ts(window.from), to: ts(window.to) } : 'No telemetry recorded in TimescaleDB in the last 60 minutes',
        alarm_limits: thresholds.length ? thresholds : CONDITION_LIMITS,
        open_incidents: incidents.map((i: any) => ({ ...i, detected_at: ts(i.detected_at) })),
        open_work_orders: workOrders.map((w: any) => ({ ...w, created_at: ts(w.created_at) })),
        preventive_maintenance: pm.map((p: any) => ({ ...p, next_due_date: ts(p.next_due_date)?.slice(0, 10) })),
        today: today
          ? {
              date: daily!.date,
              status: today.status,
              runtime_minutes: mins(today.runtime_seconds),
              downtime_minutes: mins(today.downtime_seconds),
              pieces: today.actual_pieces,
              target_pieces_so_far: today.target_pieces,
              faults: today.fault_count,
            }
          : undefined,
      };
    },
  },

  get_telemetry_history: {
    kind: 'read',
    spec: fn(
      'get_telemetry_history',
      'Sensor history for one machine from TimescaleDB (telemetry_logs hypertable): summary statistics over the period and a time-bucketed trend ' +
        'for one metric. Use for trends, "was vibration rising", comparisons over hours/days, or when live data is stale.',
      {
        machine_code: { type: 'string' },
        metric: { type: 'string', enum: [...TELEMETRY_METRICS], description: 'Metric to trend (default vibration)' },
        hours: { type: 'number', description: 'Look-back period in hours (default 24, max 720)' },
        bucket_minutes: { type: 'integer', description: 'Trend resolution (default: chosen automatically)' },
      },
      ['machine_code']
    ),
    async run(args) {
      const { machine, suggestions } = await resolveMachine(args.machine_code);
      if (!machine) return machineNotFound(args.machine_code, suggestions);
      const hours = Math.min(720, Math.max(0.25, Number(args.hours) || 24));
      const metric = (TELEMETRY_METRICS as readonly string[]).includes(args.metric) ? args.metric : 'vibration';
      const bucket = Math.max(1, Number(args.bucket_minutes) || Math.ceil((hours * 60) / 24));
      const [stats, trend, latest] = await Promise.all([
        getTelemetryWindow(machine.code, Math.round(hours * 60)),
        getTelemetryTrend(machine.code, metric, hours, bucket),
        getLatestReadings([machine.code]),
      ]);
      const last = latest[machine.code];
      return {
        machine: machine.code,
        source: 'TimescaleDB telemetry_logs',
        period_hours: hours,
        summary: stats ? { ...stats, from: ts(stats.from), to: ts(stats.to) } : `No telemetry recorded for ${machine.code} in the last ${hours} h`,
        metric,
        bucket_minutes: bucket,
        trend: trend.slice(-48).map((b) => ({ ...b, bucket: ts(b.bucket) })),
        most_recent_reading: telemetryView(last),
        alarm_limits: CONDITION_LIMITS[metric as keyof typeof CONDITION_LIMITS],
      };
    },
  },

  search_incidents: {
    kind: 'read',
    spec: fn('search_incidents', 'Query the incident log (faults/alarms) with filters. Returns newest first with downtime and root cause.', {
      machine_code: { type: 'string' },
      status: { type: 'string', description: '"open" for unresolved, or an exact status like RESOLVED' },
      severity: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] },
      since_days: { type: 'integer', description: 'Only incidents detected in the last N days' },
      text: { type: 'string', description: 'Keyword to match in alert type / diagnosis' },
      limit: { type: 'integer', description: 'Default 15, max 40' },
    }),
    async run(args) {
      const where: string[] = [];
      const params: any[] = [];
      if (args.machine_code) {
        const { machine, suggestions } = await resolveMachine(args.machine_code);
        if (!machine) return machineNotFound(args.machine_code, suggestions);
        where.push('i.machine_id = ?');
        params.push(machine.id);
      }
      if (args.status) {
        if (String(args.status).toLowerCase() === 'open') where.push(OPEN_INCIDENT);
        else { where.push('i.status = ?'); params.push(String(args.status).toUpperCase()); }
      }
      if (args.severity) { where.push('i.severity = ?'); params.push(args.severity); }
      if (args.since_days) { where.push('i.detected_at >= NOW() - INTERVAL ? DAY'); params.push(Number(args.since_days)); }
      if (args.text) {
        where.push('(i.alert_type LIKE ? OR i.ai_root_cause LIKE ? OR i.ai_diagnosis_summary LIKE ?)');
        params.push(`%${args.text}%`, `%${args.text}%`, `%${args.text}%`);
      }
      const limit = Math.min(40, Math.max(1, Number(args.limit) || 15));
      const rows = await query<any>(
        `SELECT i.id, m.code AS machine, i.alert_type, i.severity, i.status, i.detected_at, i.machine_running_at, i.downtime_seconds, i.ai_root_cause, i.required_part_id
         FROM incidents i LEFT JOIN machines m ON m.id = i.machine_id ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
         ORDER BY i.detected_at DESC LIMIT ${limit}`,
        params
      );
      return {
        count: rows.length,
        incidents: rows.map((r) => ({
          ...r,
          detected_at: ts(r.detected_at),
          machine_running_at: ts(r.machine_running_at),
          downtime_minutes: mins(r.downtime_seconds),
          downtime_seconds: undefined,
        })),
      };
    },
  },

  get_incident_details: {
    kind: 'read',
    spec: fn(
      'get_incident_details',
      'Everything about one incident: diagnosis, root cause, recommended actions, work orders (technician, notes), downtime breakdown by phase and event timeline.',
      { incident_id: { type: 'string' } },
      ['incident_id']
    ),
    async run(args) {
      const [inc] = await query<any>(
        `SELECT i.*, m.code AS machine_code, m.name AS machine_name FROM incidents i LEFT JOIN machines m ON m.id = i.machine_id WHERE i.id = ? LIMIT 1`,
        [args.incident_id]
      );
      if (!inc) return { error: `Incident ${args.incident_id} not found` };
      const [wos, events, breakdown] = await Promise.all([
        query<any>(
          `SELECT w.id, w.priority, w.status, w.notes, w.loto_applied, w.loto_verified_by, t.name AS technician, w.created_at, w.completed_at
           FROM work_orders w LEFT JOIN technicians t ON t.id = w.technician_id WHERE w.incident_id = ?`,
          [inc.id]
        ),
        query<any>(`SELECT event_type, actor_type, actor_id, event_ts FROM incident_events WHERE incident_id = ? ORDER BY event_ts ASC LIMIT 40`, [inc.id]).catch(() => []),
        getDowntimeBreakdown(inc.id).catch(() => null),
      ]);
      const out: any = {};
      for (const [k, v] of Object.entries(inc)) if (v !== null) out[k] = v instanceof Date ? ts(v) : v;
      return {
        incident: out,
        work_orders: wos.map((w: any) => ({ ...w, created_at: ts(w.created_at), completed_at: ts(w.completed_at) })),
        downtime_breakdown: breakdown || undefined,
        timeline: events.map((e: any) => ({ ...e, event_ts: ts(e.event_ts) })),
      };
    },
  },

  list_work_orders: {
    kind: 'read',
    spec: fn('list_work_orders', 'List maintenance work orders with filters (status "open" for active ones, machine, technician name).', {
      status: { type: 'string', description: '"open" or an exact status such as COMPLETED' },
      machine_code: { type: 'string' },
      technician: { type: 'string', description: 'Technician name (partial match)' },
      limit: { type: 'integer', description: 'Default 20, max 50' },
    }),
    async run(args) {
      const where: string[] = [];
      const params: any[] = [];
      if (args.status) {
        if (String(args.status).toLowerCase() === 'open') where.push(OPEN_WO);
        else { where.push('w.status = ?'); params.push(String(args.status).toUpperCase()); }
      }
      if (args.machine_code) {
        const { machine, suggestions } = await resolveMachine(args.machine_code);
        if (!machine) return machineNotFound(args.machine_code, suggestions);
        where.push('w.machine_id = ?');
        params.push(machine.id);
      }
      if (args.technician) { where.push('t.name LIKE ?'); params.push(`%${args.technician}%`); }
      const limit = Math.min(50, Math.max(1, Number(args.limit) || 20));
      const rows = await query<any>(
        `SELECT w.id, m.code AS machine, w.incident_id, w.priority, w.status, w.technician_phase, t.name AS technician, w.loto_applied, w.created_at, w.completed_at,
                LEFT(w.notes, 300) AS notes
         FROM work_orders w LEFT JOIN machines m ON m.id = w.machine_id LEFT JOIN technicians t ON t.id = w.technician_id
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY w.created_at DESC LIMIT ${limit}`,
        params
      );
      return { count: rows.length, work_orders: rows.map((r) => ({ ...r, created_at: ts(r.created_at), completed_at: ts(r.completed_at) })) };
    },
  },

  find_technicians: {
    kind: 'read',
    spec: fn('find_technicians', 'Look up technicians by skill, assigned area or availability status, with their current workload.', {
      skill: { type: 'string', description: 'e.g. "vibration", "hydraulic", "servo"' },
      area: { type: 'string' },
      status: { type: 'string', description: 'e.g. AVAILABLE, BUSY, OFF_SHIFT' },
    }),
    async run(args) {
      const where: string[] = [];
      const params: any[] = [];
      if (args.skill) { where.push('UPPER(CAST(skills AS CHAR)) LIKE ?'); params.push(`%${String(args.skill).toUpperCase().replace(/\s+/g, '%')}%`); }
      if (args.area) { where.push('UPPER(assigned_area) LIKE ?'); params.push(`%${String(args.area).toUpperCase()}%`); }
      if (args.status) { where.push('UPPER(status) = ?'); params.push(String(args.status).toUpperCase()); }
      const rows = await query<any>(
        `SELECT id, name, role, assigned_area, status, shift, active_work_orders, skills FROM technicians ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY active_work_orders ASC`,
        params
      );
      return { count: rows.length, technicians: rows.map((r) => ({ ...r, skills: typeof r.skills === 'string' ? JSON.parse(r.skills || '[]') : r.skills })) };
    },
  },

  recommend_technician: {
    kind: 'read',
    spec: fn(
      'recommend_technician',
      'Rank the best technicians for a repair on a machine using the plant skill-matching engine (skills, area, availability, workload).',
      { machine_code: { type: 'string' }, symptom: { type: 'string', description: 'Fault / symptom description' } },
      ['machine_code', 'symptom']
    ),
    async run(args) {
      const { machine, suggestions } = await resolveMachine(args.machine_code);
      if (!machine) return machineNotFound(args.machine_code, suggestions);
      const r = await runAIMaintenanceOrchestration(machine, { alertType: args.symptom, symptom: args.symptom });
      return {
        recommended: { name: r.assignedTechnicianName, role: r.assignedTechnicianRole, confidence: r.matchConfidence },
        required_skills: r.requiredSkills,
        top_candidates: r.candidateEvaluations.slice(0, 4).map((c) => ({
          name: c.technicianName, role: c.role, score: c.matchScore, availability: c.availability,
          active_work_orders: c.activeWorkOrders, matched_skills: c.matchedSkills, missing_skills: c.missingSkills, rationale: c.rationale,
        })),
        recommended_inspection_points: r.recommendedInspectionPoints,
        loto_required: r.oshaProtocolRequired,
      };
    },
  },

  check_spare_part: {
    kind: 'read',
    spec: fn(
      'check_spare_part',
      'Find spare parts by part number, id or name and return stock on hand, reserved, available-to-promise, reorder point, lead time, supplier, cost and open POs.',
      { query: { type: 'string', description: 'Part number (SKF-6205-2RSH), part id (PART-SKF-6205) or name keyword (bearing, seal)' } },
      ['query']
    ),
    async run(args) {
      const q = `%${args.query}%`;
      const rows = await query<any>(
        `SELECT sp.*, COALESCE(SUM(inv.quantity_on_hand),0) AS on_hand, COALESCE(SUM(inv.reserved_quantity),0) AS reserved,
                COALESCE(SUM(inv.available_to_promise),0) AS atp,
                GROUP_CONCAT(CONCAT(inv.warehouse_name,' ',inv.bin_location) SEPARATOR '; ') AS locations
         FROM spare_parts sp LEFT JOIN inventory inv ON inv.part_id = sp.id
         WHERE sp.id LIKE ? OR sp.part_number LIKE ? OR sp.name LIKE ? OR sp.category LIKE ?
         GROUP BY sp.id LIMIT 10`,
        [q, q, q, q]
      );
      if (!rows.length) return { results: [], note: `No spare part matches "${args.query}".` };
      const ids = rows.map((r) => r.id);
      const pos = await query<any>(
        `SELECT id, part_id, quantity, status, total_amount, supplier_name, created_at FROM purchase_orders
         WHERE part_id IN (${ids.map(() => '?').join(',')}) AND status NOT IN ('RECEIVED','CANCELLED','CLOSED') ORDER BY created_at DESC LIMIT 10`,
        ids
      ).catch(() => []);
      return {
        results: rows.map((r) => ({
          ...partView(r),
          open_purchase_orders: pos.filter((p: any) => p.part_id === r.id).map((p: any) => ({ ...p, created_at: ts(p.created_at) })),
        })),
      };
    },
  },

  list_purchase_orders: {
    kind: 'read',
    spec: fn('list_purchase_orders', 'List purchase orders (procurement) with status, part, supplier and amount.', {
      status: { type: 'string', description: 'e.g. PENDING_APPROVAL, APPROVED, ORDERED, RECEIVED' },
      part: { type: 'string', description: 'Part id / number / name keyword' },
      limit: { type: 'integer', description: 'Default 15, max 40' },
    }),
    async run(args) {
      const where: string[] = [];
      const params: any[] = [];
      if (args.status) { where.push('status = ?'); params.push(String(args.status).toUpperCase()); }
      if (args.part) { where.push('(part_id LIKE ? OR part_number LIKE ? OR part_name LIKE ?)'); params.push(`%${args.part}%`, `%${args.part}%`, `%${args.part}%`); }
      const limit = Math.min(40, Math.max(1, Number(args.limit) || 15));
      const rows = await query<any>(
        `SELECT id, part_id, part_number, part_name, quantity, unit_price, total_amount, status, auto_approved, approval_type, supplier_name, work_order_id, created_at
         FROM purchase_orders ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT ${limit}`,
        params
      );
      return { count: rows.length, purchase_orders: rows.map((r) => ({ ...r, created_at: ts(r.created_at) })) };
    },
  },

  get_production_summary: {
    kind: 'read',
    spec: fn(
      'get_production_summary',
      'Plant production for an IST business day: runtime, downtime, pieces vs target, missed pieces, availability, per-machine breakdown. Defaults to today (live).',
      { date: { type: 'string', description: 'YYYY-MM-DD (IST). Omit for today.' } }
    ),
    async run(args) {
      const r = await getDailyOperationsSummary(args.date || istBusinessDate());
      const machines = [...r.machines]
        .sort((a, b) => b.downtime_seconds - a.downtime_seconds || a.machine_code.localeCompare(b.machine_code))
        .map((m) => ({
          machine: m.machine_code,
          status: m.status,
          runtime_min: mins(m.runtime_seconds),
          downtime_min: mins(m.downtime_seconds),
          idle_min: mins(m.idle_seconds),
          pieces: m.actual_pieces,
          target: m.target_pieces,
          missed: m.missed_pieces,
          faults: m.fault_count,
        }));
      return {
        date: r.date,
        data_source: r.source,
        data_source_note:
          r.source === 'SIMULATED' ? 'Simulated demo history (recorded before power-ledger logging started) — tell the user this is not real telemetry.' : undefined,
        as_of: r.asOf,
        plant: {
          runtime_hours: Math.round((r.plantSummary.totalRuntimeSeconds / 3600) * 10) / 10,
          downtime_hours: Math.round((r.plantSummary.totalDowntimeSeconds / 3600) * 10) / 10,
          pieces: r.plantSummary.totalProductionPieces,
          target_pieces: r.plantSummary.totalTargetPieces,
          missed_pieces: r.plantSummary.totalMissedPieces,
          availability_pct: r.plantSummary.plantAvailabilityPct,
          machines_with_faults: r.plantSummary.activeFaultsCount,
        },
        machines,
      };
    },
  },

  get_plant_power_state: {
    kind: 'read',
    spec: fn('get_plant_power_state', 'Current plant electrical state (main power ON/OFF/ESTOP, voltage, load, alarms) and machine breaker summary. Read-only.'),
    async run() {
      const { plant, breakers } = getPlantPowerState();
      const counts: Record<string, number> = {};
      breakers.forEach((b) => (counts[b.breaker_status] = (counts[b.breaker_status] || 0) + 1));
      return {
        plant,
        breaker_counts: counts,
        breakers_not_closed: breakers.filter((b) => b.breaker_status !== 'CLOSED').map((b) => ({ machine: b.machine_code, breaker: b.breaker_status })),
        note: 'Power, E-stop and breaker controls are only available in the Power Supply Cell screen, not through the assistant.',
      };
    },
  },

  get_fleet_status: {
    kind: 'read',
    spec: fn(
      'get_fleet_status',
      'Outbound freight & road fleet from TiDB: pallets staged at the outbound dock vs the auto-dispatch threshold, each truck\'s status, ' +
        'active road shipments (destination, pallets, tonnage, batch, leg progress, ETA) and recent completed deliveries.',
      { include_history: { type: 'boolean', description: 'Also list the last 10 completed dispatches' } }
    ),
    async run(args) {
      const s = await getFleetState();
      const now = Date.now();
      return {
        as_of: ts(now),
        auto_dispatch_threshold: `${s.config.freightThresholdPallets} pallets (${s.config.freightThresholdPallets * s.config.palletTonnes} t)`,
        dock: {
          staged_pallets: s.dock.count,
          staged_tonnes: s.dock.tonnage,
          pallets: s.dock.stagedPallets.map((p) => p.palletNumber),
          status: s.dock.waitingForTruck ? 'FULL LOAD WAITING — no truck available' : s.dock.readyForDispatch ? 'READY' : 'ACCUMULATING',
        },
        trucks: s.trucks.map((t) => ({ truck: t.id, name: t.name, driver: t.driverName, status: t.status, dispatch: t.currentDispatchId })),
        active_shipments: s.activeDispatches.map((d) => {
          const t = (now - Date.parse(d.dispatchedAt)) / 1000;
          const leg = t < d.outboundSeconds ? 'outbound' : t < d.outboundSeconds + d.unloadSeconds ? 'unloading' : 'return';
          const legLeft = leg === 'outbound' ? d.outboundSeconds - t : leg === 'return' ? d.outboundSeconds + d.unloadSeconds + d.returnSeconds - t : 0;
          return {
            dispatch: d.id,
            truck: d.truckId,
            driver: d.driverName,
            status: d.status,
            destination: d.destinationName,
            pallets: d.palletCount,
            tonnes: d.tonnage,
            batch: d.batchId,
            distance_km: d.distanceKm,
            dispatched_at: ts(d.dispatchedAt),
            eta_minutes_real_world: Math.max(0, Math.round((legLeft * s.config.timeScale) / 60)),
            current_leg: leg,
          };
        }),
        delivered_today: s.today,
        recent_completed: args.include_history
          ? s.recentDispatches.map((d) => ({ dispatch: d.id, truck: d.truckId, destination: d.destinationName, pallets: d.palletCount, tonnes: d.tonnage, returned_at: ts(d.returnedAt) }))
          : undefined,
      };
    },
  },

  get_pm_schedule: {
    kind: 'read',
    spec: fn('get_pm_schedule', 'Preventive maintenance schedule: overdue and upcoming PM tasks, optionally for one machine.', {
      machine_code: { type: 'string' },
      due_within_days: { type: 'integer', description: 'Default 14' },
    }),
    async run(args) {
      const days = Number(args.due_within_days) || 14;
      const params: any[] = [days];
      let extra = '';
      if (args.machine_code) {
        const { machine, suggestions } = await resolveMachine(args.machine_code);
        if (!machine) return machineNotFound(args.machine_code, suggestions);
        extra = ' AND machine_code = ?';
        params.push(machine.code);
      }
      const rows = await query<any>(
        `SELECT machine_code, task_title, sop_code, frequency_label, priority, status, assigned_technician_name, last_performed_at, next_due_date
         FROM pm_schedules WHERE next_due_date <= NOW() + INTERVAL ? DAY${extra} ORDER BY next_due_date ASC LIMIT 40`,
        params
      );
      const now = Date.now();
      return {
        count: rows.length,
        tasks: rows.map((r) => ({
          ...r,
          last_performed_at: ts(r.last_performed_at)?.slice(0, 10),
          next_due_date: ts(r.next_due_date)?.slice(0, 10),
          overdue: r.next_due_date ? new Date(r.next_due_date).getTime() < now : false,
        })),
      };
    },
  },

  get_loto_procedure: {
    kind: 'read',
    spec: fn(
      'get_loto_procedure',
      'Official lockout/tagout (energy isolation) steps, lockout box location and required PPE for a specific machine. Always use before advising hands-on work.',
      { machine_code: { type: 'string' } },
      ['machine_code']
    ),
    async run(args) {
      const { machine, suggestions } = await resolveMachine(args.machine_code);
      if (!machine) return machineNotFound(args.machine_code, suggestions);
      return getLotoProtocolForMachine(machine.type, machine.code);
    },
  },

  // ── Proposals (human approval required) ──

  propose_work_order: {
    kind: 'propose',
    spec: fn(
      'propose_work_order',
      'Propose a corrective maintenance work order (creates an incident + dispatches the best technician once a human approves). ' +
        'Only when the user asks for it or clearly agrees. Check get_machine_details first to avoid duplicating an open work order.',
      {
        machine_code: { type: 'string' },
        symptom: { type: 'string', description: 'Observed problem, with measured values if known' },
        priority: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] },
        alert_type: { type: 'string', description: 'Short fault title, e.g. "High spindle vibration"' },
        rationale: { type: 'string', description: 'Why this work order is needed (evidence)' },
      },
      ['machine_code', 'symptom', 'priority', 'rationale']
    ),
    async run(args, ctx) {
      const { machine, suggestions } = await resolveMachine(args.machine_code);
      if (!machine) return machineNotFound(args.machine_code, suggestions);
      const open = await query<any>(`SELECT id, status FROM work_orders w WHERE w.machine_id = ? AND ${OPEN_WO} LIMIT 3`, [machine.id]);
      const alertType = args.alert_type || String(args.symptom).slice(0, 80);
      const action = await proposeAction({
        sessionId: ctx.sessionId,
        type: 'CREATE_WORK_ORDER',
        params: { machineId: machine.id, machineCode: machine.code, symptom: args.symptom, priority: args.priority, alertType },
        summary: `Create ${args.priority} work order for ${machine.code}: ${alertType}`,
        rationale: args.rationale,
        requestedBy: `${ctx.user.name} (${ctx.user.role}) via AI Assistant`,
      });
      ctx.addAction(action);
      return {
        status: 'PENDING_APPROVAL',
        action_id: action.id,
        summary: action.summary,
        proposal: { machine: machine.code, machine_name: machine.name, priority: args.priority, alert_type: alertType, symptom: args.symptom, rationale: args.rationale },
        warning: open.length ? `Machine already has open work order(s): ${open.map((o: any) => `${o.id} (${o.status})`).join(', ')}` : undefined,
        instructions: 'Shown to the user as an approval card. It has NOT been created yet — tell the user it awaits their approval.',
      };
    },
  },

  propose_part_reservation: {
    kind: 'propose',
    spec: fn(
      'propose_part_reservation',
      'Propose reserving spare-part stock against a work order (executes after human approval). Verify stock with check_spare_part first.',
      {
        work_order_id: { type: 'string' },
        part: { type: 'string', description: 'Part id or part number' },
        quantity: { type: 'integer' },
        rationale: { type: 'string' },
      },
      ['work_order_id', 'part', 'quantity', 'rationale']
    ),
    async run(args, ctx) {
      const [wo] = await query<any>(`SELECT id, status FROM work_orders WHERE id = ? LIMIT 1`, [args.work_order_id]);
      if (!wo) return { error: `Work order ${args.work_order_id} not found` };
      const part = await resolvePart(args.part);
      if (!part) return { error: `Part "${args.part}" not found. Use check_spare_part to find the exact part id.` };
      const qty = Math.max(1, Number(args.quantity) || 1);
      const view = partView(part);
      const action = await proposeAction({
        sessionId: ctx.sessionId,
        type: 'RESERVE_PART',
        params: { workOrderId: wo.id, partId: part.id, partNumber: part.part_number, quantity: qty },
        summary: `Reserve ${qty} × ${part.part_number} (${part.name}) for ${wo.id}`,
        rationale: args.rationale,
        requestedBy: `${ctx.user.name} (${ctx.user.role}) via AI Assistant`,
      });
      ctx.addAction(action);
      return {
        status: 'PENDING_APPROVAL',
        action_id: action.id,
        summary: action.summary,
        stock: { available_to_promise: view.available_to_promise, on_hand: view.on_hand },
        warning: view.available_to_promise < qty ? `Only ${view.available_to_promise} available — reservation will fail unless stock arrives. Consider a purchase order.` : undefined,
        instructions: 'Awaiting user approval; not reserved yet.',
      };
    },
  },

  propose_purchase_order: {
    kind: 'propose',
    spec: fn(
      'propose_purchase_order',
      'Propose a purchase order for a spare part (goes through the procurement policy engine after human approval). Check stock and open POs first.',
      {
        part: { type: 'string', description: 'Part id or part number' },
        quantity: { type: 'integer' },
        machine_code: { type: 'string', description: 'Machine the part is for' },
        work_order_id: { type: 'string' },
        rationale: { type: 'string' },
      },
      ['part', 'quantity', 'machine_code', 'rationale']
    ),
    async run(args, ctx) {
      const part = await resolvePart(args.part);
      if (!part) return { error: `Part "${args.part}" not found. Use check_spare_part to find the exact part id.` };
      const { machine, suggestions } = await resolveMachine(args.machine_code);
      if (!machine) return machineNotFound(args.machine_code, suggestions);
      const qty = Math.max(1, Number(args.quantity) || 1);
      const estimate = Math.round(Number(part.unit_cost || 0) * qty * 100) / 100;
      const action = await proposeAction({
        sessionId: ctx.sessionId,
        type: 'CREATE_PURCHASE_ORDER',
        params: { partId: part.id, partNumber: part.part_number, quantity: qty, machineId: machine.id, machineCode: machine.code, workOrderId: args.work_order_id, estimatedCost: estimate },
        summary: `Purchase ${qty} × ${part.part_number} (${part.name}) for ${machine.code} — est. $${estimate.toLocaleString()}`,
        rationale: args.rationale,
        requestedBy: `${ctx.user.name} (${ctx.user.role}) via AI Assistant`,
      });
      ctx.addAction(action);
      return {
        status: 'PENDING_APPROVAL',
        action_id: action.id,
        summary: action.summary,
        estimated_cost_usd: estimate,
        supplier: part.supplier_name,
        lead_time_days: part.lead_time_days,
        instructions: 'Awaiting user approval; after approval the procurement policy engine may still route it for additional sign-off.',
      };
    },
  },
};

export const TOOL_SPECS: ToolSpec[] = Object.values(TOOLS).map((t) => t.spec);

export function toolKind(name: string): 'read' | 'propose' | undefined {
  return TOOLS[name]?.kind;
}

export async function runTool(name: string, rawArgs: string, ctx: ToolContext): Promise<{ ok: boolean; result: any; text: string }> {
  const tool = TOOLS[name];
  if (!tool) return fail(`Unknown tool "${name}". Available: ${Object.keys(TOOLS).join(', ')}`);
  let args: any = {};
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    return fail(`Arguments for ${name} were not valid JSON`);
  }
  for (const req of tool.spec.function.parameters.required || []) {
    if (args[req] === undefined || args[req] === '') return fail(`Missing required argument "${req}" for ${name}`);
  }
  try {
    const result = await tool.run(args, ctx);
    const ok = !(result && typeof result === 'object' && 'error' in result);
    let text = JSON.stringify(result);
    if (text.length > MAX_RESULT_CHARS) text = text.slice(0, MAX_RESULT_CHARS) + '… [truncated — narrow the query for more]';
    return { ok, result, text };
  } catch (err: any) {
    return fail(`${name} failed: ${err.message}`);
  }
}

function fail(message: string) {
  return { ok: false, result: { error: message }, text: JSON.stringify({ error: message }) };
}
