/**
 * PLANTOPS — Event Recorder Service
 *
 * Records every incident lifecycle state transition with an authoritative
 * server-side timestamp (CURRENT_TIMESTAMP(3) = millisecond precision UTC).
 *
 * CRITICAL RULE: Timestamps MUST come from the DB server, never from
 * Date.now() or new Date() in the application layer.
 */

import { v4 as uuidv4 } from 'uuid';
import { execute, query } from '../db/mysql.js';
import { broadcast } from './socket.service.js';

export type IncidentEventType =
  | 'FAULT_DETECTED'
  | 'INCIDENT_CREATED'
  | 'ASSIGNMENT_STARTED'
  | 'TECHNICIAN_ASSIGNED'
  | 'TECHNICIAN_DISPATCHED'
  | 'TECHNICIAN_ARRIVED'
  | 'LOTO_STARTED'
  | 'LOTO_COMPLETED'
  | 'MAINTENANCE_STARTED'
  | 'INSPECTION_STARTED'
  | 'ROOT_CAUSE_CONFIRMED'
  | 'PART_REQUESTED'
  | 'PART_ALLOCATED'
  | 'REPAIR_STARTED'
  | 'REPAIR_COMPLETED'
  | 'WAITING_FOR_PART'
  | 'PART_AVAILABLE'
  | 'VERIFICATION_STARTED'
  | 'VERIFICATION_PASSED'
  | 'VERIFICATION_FAILED'
  | 'MACHINE_RUNNING'
  | 'INCIDENT_RESOLVED';

export type ActorType = 'IOT_SENSOR' | 'CONDITION_MONITOR' | 'AI_ORCHESTRATOR' | 'TECHNICIAN' | 'VERIFICATION_ENGINE' | 'SYSTEM';

export interface RecordEventParams {
  incidentId: string;
  workOrderId?: string;
  machineId: string;
  eventType: IncidentEventType;
  actorType?: ActorType;
  actorId?: string;
  metadata?: Record<string, any>;
}

/**
 * Records a single incident lifecycle event.
 * The event_ts is set by the DB server (CURRENT_TIMESTAMP(3)).
 * Returns the ISO-8601 UTC timestamp string assigned by the server.
 */
export async function recordEvent(params: RecordEventParams): Promise<string | null> {
  const id = `EVT-${uuidv4().substring(0, 12).toUpperCase()}`;
  const metaJson = params.metadata ? JSON.stringify(params.metadata) : null;

  try {
    await execute(
      `INSERT INTO incident_events
         (id, incident_id, work_order_id, machine_id, event_type, actor_type, actor_id, metadata, event_ts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(3))`,
      [
        id,
        params.incidentId,
        params.workOrderId || null,
        params.machineId,
        params.eventType,
        params.actorType || 'SYSTEM',
        params.actorId || null,
        metaJson,
      ]
    );

    // Retrieve the exact server-assigned timestamp
    const rows = await query<{ ts: string }>(`SELECT event_ts AS ts FROM incident_events WHERE id = ? LIMIT 1`, [id]);
    const serverTs = rows[0]?.ts
      ? new Date(rows[0].ts).toISOString()
      : new Date().toISOString();

    // Broadcast event to frontend in real time
    broadcast('incident:event', {
      id,
      incidentId: params.incidentId,
      workOrderId: params.workOrderId || null,
      machineId: params.machineId,
      eventType: params.eventType,
      actorType: params.actorType || 'SYSTEM',
      actorId: params.actorId || null,
      metadata: params.metadata || null,
      eventTs: serverTs,
    });

    return serverTs;
  } catch (err: any) {
    // Non-fatal — event recording should never break the main flow
    console.warn(`[EventRecorder] Failed to record ${params.eventType} for ${params.incidentId}: ${err.message}`);
    return null;
  }
}

/**
 * Writes a phase timestamp column on the incidents table using the DB server clock.
 * e.g. stampIncident('INC-1234', 'loto_completed_at')
 */
export async function stampIncident(incidentId: string, column: string): Promise<void> {
  const allowed = new Set([
    'assignment_started_at', 'assigned_at', 'technician_dispatched_at', 'technician_arrived_at',
    'loto_started_at', 'loto_completed_at', 'inspection_started_at', 'inspection_completed_at',
    'repair_started_at', 'repair_completed_at', 'verification_started_at',
    'verification_completed_at', 'machine_running_at',
  ]);
  if (!allowed.has(column)) {
    console.warn(`[EventRecorder] stampIncident: unknown column '${column}' rejected`);
    return;
  }
  try {
    await execute(
      `UPDATE incidents SET \`${column}\` = CURRENT_TIMESTAMP(3) WHERE id = ?`,
      [incidentId]
    );
  } catch (err: any) {
    console.warn(`[EventRecorder] stampIncident(${column}) failed: ${err.message}`);
  }
}

/**
 * Computes and persists downtime_seconds to the incidents table.
 * Uses pure SQL arithmetic: TIMESTAMPDIFF(microsecond, detected_at, machine_running_at) / 1e6
 * This guarantees the calculation is done by the database, not by application code.
 */
export async function computeAndSaveDowntime(incidentId: string): Promise<number | null> {
  try {
    await execute(
      `UPDATE incidents
         SET downtime_seconds =
           TIMESTAMPDIFF(MICROSECOND, detected_at, machine_running_at) / 1000000.0
       WHERE id = ?
         AND detected_at IS NOT NULL
         AND machine_running_at IS NOT NULL`,
      [incidentId]
    );

    const rows = await query<{ ds: number }>(`SELECT downtime_seconds AS ds FROM incidents WHERE id = ? LIMIT 1`, [incidentId]);
    return rows[0]?.ds ?? null;
  } catch (err: any) {
    console.warn(`[EventRecorder] computeAndSaveDowntime failed: ${err.message}`);
    return null;
  }
}

export interface DowntimeBreakdown {
  response_time_seconds: number | null;
  travel_time_seconds: number | null;
  loto_time_seconds: number | null;
  inspection_time_seconds: number | null;
  parts_wait_time_seconds: number | null;
  repair_time_seconds: number | null;
  verification_time_seconds: number | null;
  total_downtime_seconds: number | null;
}

/**
 * Computes a per-phase downtime breakdown from the incidents table's own
 * server-stamped timestamp columns. Every duration here is derived from
 * authoritative DB timestamps, never from Date.now().
 */
export async function getDowntimeBreakdown(incidentId: string): Promise<DowntimeBreakdown | null> {
  const rows = await query<any>(
    `SELECT detected_at, assigned_at, technician_dispatched_at, technician_arrived_at,
            loto_started_at, loto_completed_at, inspection_started_at, inspection_completed_at,
            repair_started_at, repair_completed_at, verification_started_at, verification_completed_at,
            machine_running_at, downtime_seconds
     FROM incidents WHERE id = ? LIMIT 1`,
    [incidentId]
  );
  const inc = rows[0];
  if (!inc) return null;

  const diffSeconds = (a: string | null, b: string | null): number | null => {
    if (!a || !b) return null;
    const ms = new Date(b).getTime() - new Date(a).getTime();
    return Number.isFinite(ms) ? Math.max(0, ms / 1000) : null;
  };

  return {
    response_time_seconds: diffSeconds(inc.detected_at, inc.assigned_at),
    travel_time_seconds: diffSeconds(inc.technician_dispatched_at, inc.technician_arrived_at),
    loto_time_seconds: diffSeconds(inc.loto_started_at, inc.loto_completed_at),
    inspection_time_seconds: diffSeconds(inc.inspection_started_at, inc.inspection_completed_at),
    parts_wait_time_seconds: diffSeconds(inc.inspection_completed_at, inc.repair_started_at),
    repair_time_seconds: diffSeconds(inc.repair_started_at, inc.repair_completed_at),
    verification_time_seconds: diffSeconds(inc.verification_started_at, inc.verification_completed_at || inc.machine_running_at),
    total_downtime_seconds: inc.downtime_seconds ?? diffSeconds(inc.detected_at, inc.machine_running_at),
  };
}
