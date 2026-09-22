import { execute, query } from '../db/mysql.js';
import { recordAuditLog } from './audit.service.js';
import { broadcast } from './socket.service.js';
import { clearActiveIncident } from './telemetry.service.js';
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

  if (isClean) {
    tracker.consecutiveCleanCycles += 1;
    console.log(`[VerificationService] Machine ${machineId} clean reading ${tracker.consecutiveCleanCycles}/${tracker.requiredCycles}`);

    if (tracker.consecutiveCleanCycles >= tracker.requiredCycles) {
      delete activeVerifications[machineId];
      await recoverMachineToRunning(machineId, telemetry);
    }
  } else {
    // Reset if an unexpected spike occurs
    tracker.consecutiveCleanCycles = 0;
  }
}

async function recoverMachineToRunning(machineId: string, telemetry: { temperature: number; vibration: number }) {
  try {
    // 1. Update Machine to RUNNING with 98% Health
    await execute(
      `UPDATE machines SET status = 'RUNNING', health_score = 98 WHERE id = ? OR code = ?`,
      [machineId, machineId]
    );

    // 2. Resolve active incidents for this machine — and stamp machine_running_at server-side
    await execute(
      `UPDATE incidents
         SET status = 'RESOLVED',
             resolved_at = CURRENT_TIMESTAMP(3),
             machine_running_at = CURRENT_TIMESTAMP(3)
       WHERE (machine_id = ? OR machine_id = ?)
         AND status NOT IN ('RESOLVED', 'CLOSED')`,
      [machineId, machineId]
    );

    // 3. Compute downtime for all just-resolved incidents
    const resolvedRows = await query<{ id: string }>(
      `SELECT id FROM incidents
       WHERE (machine_id = ? OR machine_id = ?)
         AND status = 'RESOLVED'
         AND machine_running_at IS NOT NULL
         AND downtime_seconds IS NULL
       LIMIT 5`,
      [machineId, machineId]
    );
    for (const row of resolvedRows) {
      const downtime = await computeAndSaveDowntime(row.id);
      if (downtime !== null) {
        console.log(`[VerificationService] Downtime for ${row.id}: ${downtime.toFixed(3)}s`);
      }
      // Record VERIFICATION_PASSED + MACHINE_RUNNING + INCIDENT_RESOLVED events
      await recordEvent({
        incidentId: row.id,
        machineId,
        eventType: 'VERIFICATION_PASSED',
        actorType: 'VERIFICATION_ENGINE',
        actorId: 'PLANTOPS-VERIFICATION',
        metadata: { vibration: telemetry.vibration, temperature: telemetry.temperature }
      });
      await stampIncident(row.id, 'verification_completed_at');

      await recordEvent({
        incidentId: row.id,
        machineId,
        eventType: 'MACHINE_RUNNING',
        actorType: 'VERIFICATION_ENGINE',
        actorId: 'PLANTOPS-VERIFICATION',
        metadata: { downtime_seconds: downtime }
      });

      await recordEvent({
        incidentId: row.id,
        machineId,
        eventType: 'INCIDENT_RESOLVED',
        actorType: 'SYSTEM',
        actorId: 'PLANTOPS-VERIFICATION',
        metadata: { downtime_seconds: downtime }
      });
    }

    // 4. Mark active Work Orders as COMPLETED
    await execute(
      `UPDATE work_orders SET status = 'COMPLETED', completed_at = NOW() WHERE (machine_id = ? OR machine_id = ?) AND status NOT IN ('COMPLETED', 'CANCELLED')`,
      [machineId, machineId]
    );

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
