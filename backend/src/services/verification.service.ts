import { execute, query } from '../db/mysql.js';
import { recordAuditLog } from './audit.service.js';
import { broadcast } from './socket.service.js';
import { clearActiveIncident, setMachineMemoryState } from './telemetry.service.js';
import { recordEvent, stampIncident, computeAndSaveDowntime } from './eventRecorder.service.js';

interface VerificationTracker {
  consecutiveCleanCycles: number;
  requiredCycles: number;
  startedAt: number;
}

const activeVerifications: Record<string, VerificationTracker> = {};

export async function processVerificationReading(machineId: string, telemetry: { temperature: number; vibration: number }) {
  if (!activeVerifications[machineId]) {
    activeVerifications[machineId] = {
      consecutiveCleanCycles: 0,
      requiredCycles: 3,
      startedAt: Date.now()
    };
  }

  const tracker = activeVerifications[machineId];

  // Condition for normal post-repair reading
  const isClean = telemetry.vibration < 4.0 && telemetry.temperature < 70.0;

  // A genuine fault-level spike during verification means the repair didn't
  // actually hold — fail verification back to FAULT rather than silently
  // resetting the clean-cycle counter forever.
  const isFaultSpike = telemetry.vibration > 7.5 || telemetry.temperature > 80.0;

  if (isClean) {
    tracker.consecutiveCleanCycles += 1;
    console.log(`[VerificationService] Machine ${machineId} clean reading ${tracker.consecutiveCleanCycles}/${tracker.requiredCycles}`);

    if (tracker.consecutiveCleanCycles >= tracker.requiredCycles) {
      delete activeVerifications[machineId];
      await recoverMachineToRunning(machineId, telemetry);
    }
  } else if (isFaultSpike) {
    delete activeVerifications[machineId];
    await failVerification(machineId, telemetry);
  } else {
    // Borderline (not clean, not a fault spike) — reset the clean-cycle count
    // and keep waiting.
    tracker.consecutiveCleanCycles = 0;
  }
}

/**
 * incidents.machine_id / work_orders.machine_id store the machines table's
 * PRIMARY KEY (e.g. 'MCH-ROB-01'), never the human-readable code (e.g.
 * 'ROBOT-01') that telemetry/verification code passes around as `machineId`.
 * Every query below that filtered `machine_id = ?` using that code directly
 * was matching zero rows — verification could flip machines.status to
 * RUNNING/FAULT (that table's UPDATE has an `OR code = ?` fallback) while
 * silently never resolving the incident, completing the work order, or
 * freeing the technician. Resolve the real PK once, up front, and use it for
 * every incidents/work_orders query instead.
 */
async function resolveMachinePk(machineIdOrCode: string): Promise<string> {
  const rows = await query<{ id: string }>(`SELECT id FROM machines WHERE id = ? OR code = ? LIMIT 1`, [machineIdOrCode, machineIdOrCode]);
  return rows[0]?.id || machineIdOrCode;
}

async function failVerification(machineId: string, telemetry: { temperature: number; vibration: number }) {
  try {
    setMachineMemoryState(machineId, 'FAULT');

    await execute(`UPDATE machines SET status = 'FAULT' WHERE id = ? OR code = ?`, [machineId, machineId]);

    const machinePk = await resolveMachinePk(machineId);
    const activeRows = await query<{ id: string }>(
      `SELECT id FROM incidents WHERE machine_id = ? AND status = 'VERIFYING' LIMIT 5`,
      [machinePk]
    );
    for (const row of activeRows) {
      await recordEvent({
        incidentId: row.id,
        machineId: machinePk,
        eventType: 'VERIFICATION_FAILED',
        actorType: 'VERIFICATION_ENGINE',
        actorId: 'PLANTOPS-VERIFICATION',
        metadata: { vibration: telemetry.vibration, temperature: telemetry.temperature }
      });
      await execute(`UPDATE incidents SET status = 'DISPATCHED' WHERE id = ?`, [row.id]);
    }

    await execute(
      `UPDATE work_orders SET status = 'IN_PROGRESS', technician_phase = 'REPAIRING'
       WHERE machine_id = ? AND status = 'VERIFYING'`,
      [machinePk]
    );

    await recordAuditLog({
      actor: 'AUTOMATED_VERIFICATION_ENGINE',
      action: 'VERIFICATION_FAILED_MACHINE_REFAULTED',
      resourceType: 'MACHINE',
      resourceId: machineId,
      newState: { status: 'FAULT', verifiedVib: telemetry.vibration, verifiedTemp: telemetry.temperature },
      reason: `Post-repair verification failed — fault-level reading recurred (vib=${telemetry.vibration} mm/s, temp=${telemetry.temperature}°C). Machine returned to technician.`
    });

    broadcast('machine:status_changed', {
      machineId,
      status: 'FAULT',
      message: 'Post-repair verification failed. Machine returned to FAULT — repair required again.'
    });
  } catch (err: any) {
    console.error(`[VerificationService] failVerification error: ${err.message}`);
  }
}

async function recoverMachineToRunning(machineId: string, telemetry: { temperature: number; vibration: number }) {
  try {
    // 1. Update Machine to RUNNING with 98% Health. Runtime clock restarts now
    // (last_running_started_at), and the downtime clock is cleared.
    await execute(
      `UPDATE machines
         SET status = 'RUNNING', health_score = 98,
             last_running_started_at = CURRENT_TIMESTAMP(3), downtime_started_at = NULL
       WHERE id = ? OR code = ?`,
      [machineId, machineId]
    );

    const machinePk = await resolveMachinePk(machineId);

    // 2. Resolve active incidents for this machine — and stamp machine_running_at server-side
    await execute(
      `UPDATE incidents
         SET status = 'RESOLVED',
             resolved_at = CURRENT_TIMESTAMP(3),
             machine_running_at = CURRENT_TIMESTAMP(3)
       WHERE machine_id = ?
         AND status NOT IN ('RESOLVED', 'CLOSED')`,
      [machinePk]
    );

    // 3. Compute downtime for all just-resolved incidents. No LIMIT here —
    // a `LIMIT 5` previously meant that on a machine with more than 5
    // simultaneously-resolved incidents (a real state in this dev DB, from
    // hours of unattended stress-test fault injection), MySQL's unordered
    // row selection could silently exclude the very incident this
    // verification pass was for, leaving its downtime_seconds/verification
    // events permanently unset even though the machine correctly recovered.
    const resolvedRows = await query<{ id: string }>(
      `SELECT id FROM incidents
       WHERE machine_id = ?
         AND status = 'RESOLVED'
         AND machine_running_at IS NOT NULL
         AND downtime_seconds IS NULL`,
      [machinePk]
    );
    for (const row of resolvedRows) {
      const downtime = await computeAndSaveDowntime(row.id);
      if (downtime !== null) {
        console.log(`[VerificationService] Downtime for ${row.id}: ${downtime.toFixed(3)}s`);
      }
      // Record VERIFICATION_PASSED + MACHINE_RUNNING + INCIDENT_RESOLVED events
      await recordEvent({
        incidentId: row.id,
        machineId: machinePk,
        eventType: 'VERIFICATION_PASSED',
        actorType: 'VERIFICATION_ENGINE',
        actorId: 'PLANTOPS-VERIFICATION',
        metadata: { vibration: telemetry.vibration, temperature: telemetry.temperature }
      });
      await stampIncident(row.id, 'verification_completed_at');

      await recordEvent({
        incidentId: row.id,
        machineId: machinePk,
        eventType: 'MACHINE_RUNNING',
        actorType: 'VERIFICATION_ENGINE',
        actorId: 'PLANTOPS-VERIFICATION',
        metadata: { downtime_seconds: downtime }
      });

      await recordEvent({
        incidentId: row.id,
        machineId: machinePk,
        eventType: 'INCIDENT_RESOLVED',
        actorType: 'SYSTEM',
        actorId: 'PLANTOPS-VERIFICATION',
        metadata: { downtime_seconds: downtime }
      });
    }

    // 4. Mark active Work Orders as COMPLETED and free their technician —
    // this is the moment the technician actually becomes available again
    // (not at repair-complete, and not at LOTO/inspection time).
    const activeWorkOrders = await query<{ id: string; technician_id: string | null }>(
      `SELECT id, technician_id FROM work_orders WHERE machine_id = ? AND status NOT IN ('COMPLETED', 'CANCELLED')`,
      [machinePk]
    );
    await execute(
      `UPDATE work_orders SET status = 'COMPLETED', completed_at = NOW(), technician_phase = 'RETURNING' WHERE machine_id = ? AND status NOT IN ('COMPLETED', 'CANCELLED')`,
      [machinePk]
    );
    for (const wo of activeWorkOrders) {
      if (!wo.technician_id) continue;
      await execute(
        `UPDATE technicians SET status = 'AVAILABLE', active_work_orders = GREATEST(0, active_work_orders - 1) WHERE id = ?`,
        [wo.technician_id]
      );
      broadcast('technician:updated', { technicianId: wo.technician_id, workOrderId: wo.id, phase: 'AVAILABLE', timestamp: new Date().toISOString() });
    }

    // 5. Reset in-memory anomaly debounce lock
    clearActiveIncident(machineId);

    // 6. Audit Log
    await recordAuditLog({
      actor: 'AUTOMATED_VERIFICATION_ENGINE',
      action: 'HEALTH_VERIFIED_MACHINE_RECOVERED',
      resourceType: 'MACHINE',
      resourceId: machineId,
      newState: { status: 'RUNNING', healthScore: 98, verifiedVib: telemetry.vibration, verifiedTemp: telemetry.temperature },
      reason: `Automated 3-cycle baseline verification passed. Post-repair vibration=${telemetry.vibration} mm/s, temp=${telemetry.temperature}°C.`
    });

    console.log(`[VerificationService] Machine ${machineId} successfully RECOVERED to RUNNING!`);

    broadcast('machine:status_changed', {
      machineId,
      status: 'RUNNING',
      healthScore: 98,
      message: 'Post-repair verification passed! Machine back online in RUNNING state.'
    });

    broadcast('incident:resolved', { machineId });
  } catch (err: any) {
    console.error(`[VerificationService] recoverMachineToRunning error: ${err.message}`);
  }
}
