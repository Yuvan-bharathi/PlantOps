import mqtt from 'mqtt';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { query, execute } from '../db/mysql.js';
import { getTimescalePool } from '../db/timescale.js';
import { broadcast } from './socket.service.js';
import { recordAuditLog } from './audit.service.js';
import { runAIDiagnosis } from './aiDiagnosis.service.js';
import { createWorkOrderAndDispatch } from './maintenance.service.js';
import { processVerificationReading } from './verification.service.js';
import { recordEvent, stampIncident } from './eventRecorder.service.js';

export interface TelemetryPayload {
  machineId: string;
  timestamp: string;
  temperature: number;
  vibration: number;
  current: number;
  rpm: number;
  pressure: number;
  /** Optional: scenario ID passed from the IoT simulator for realistic fault scenarios */
  scenarioId?: string;
}

// In-memory cache for machine statuses, active incidents, cooldowns, and in-flight diagnosis locks
const machineStateMemory: Record<string, string> = {};
const activeIncidentMap: Record<string, string> = {};
const isDiagnosingMap: Record<string, boolean> = {};
const lastDiagnosisTimestamp: Record<string, number> = {};

let mqttClient: mqtt.MqttClient | null = null;

export function clearActiveIncident(machineCode: string) {
  delete activeIncidentMap[machineCode];
  delete isDiagnosingMap[machineCode];
  machineStateMemory[machineCode] = 'RUNNING';
  console.log(`[TelemetryService] Reset active incident state for ${machineCode}. Ready for next single-machine fault injection.`);
}

/**
 * Lets the maintenance/verification services synchronize the in-memory
 * telemetry-evaluation state machine with a backend-driven status change
 * (MAINTENANCE/WAITING_PARTS/VERIFYING/FAULT) that didn't originate from a
 * threshold breach. Without this, machineStateMemory never leaves
 * 'RUNNING'/'WARNING'/'FAULT' (the only values processTelemetry() itself
 * writes), so a 'VERIFYING' DB status set by completeRepair() would never
 * actually route subsequent telemetry ticks into processVerificationReading().
 */
export type MachineMemoryStatus = 'RUNNING' | 'WARNING' | 'FAULT' | 'MAINTENANCE' | 'WAITING_PARTS' | 'VERIFYING';

export function setMachineMemoryState(machineCode: string, status: MachineMemoryStatus) {
  machineStateMemory[machineCode] = status;
}

export function initTelemetryService() {
  console.log(`[TelemetryService] Connecting to MQTT broker at ${config.mqtt.brokerUrl}...`);

  mqttClient = mqtt.connect(config.mqtt.brokerUrl, {
    reconnectPeriod: 2500,
    connectTimeout: 5000
  });

  mqttClient.on('connect', () => {
    const topics = [config.mqtt.telemetryTopic, 'plantops/machines/+/telemetry', 'plant/+/telemetry'];
    const uniqueTopics = [...new Set(topics)];
    mqttClient?.subscribe(uniqueTopics, (err) => {
      if (err) {
        console.error('[TelemetryService] MQTT Subscription error:', err);
      } else {
        console.log(`[TelemetryService] Subscribed to topics: ${uniqueTopics.join(', ')}`);
      }
    });
  });

  mqttClient.on('message', async (topic, message) => {
    try {
      const payload: TelemetryPayload = JSON.parse(message.toString());
      await processTelemetry(payload);
    } catch (err: any) {
      console.warn(`[TelemetryService] Failed to process message from ${topic}: ${err.message}`);
    }
  });

  let mqttErrorLogged = false;
  mqttClient.on('error', (err) => {
    if (!mqttErrorLogged) {
      console.warn(`[TelemetryService] MQTT broker unavailable (${err.message}). Using local stream & simulated telemetry fallback.`);
      mqttErrorLogged = true;
    }
  });
}

export async function processTelemetry(data: TelemetryPayload) {
  const machineCode = data.machineId;

  // 1. Broadcast live sensor data over WebSocket
  broadcast('telemetry:stream', data);

  // 2. Persist to TimescaleDB (async non-blocking)
  try {
    const tsPool = getTimescalePool();
    tsPool.query(
      `INSERT INTO telemetry_logs (time, machine_id, temperature, vibration, current, rpm, pressure)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [data.timestamp, machineCode, data.temperature, data.vibration, data.current, data.rpm, data.pressure]
    ).catch(() => {
      // Non-fatal if timescaledb container is still starting
    });
  } catch (err) {
    // Ignore transient pool errors
  }

  // 3. Check if machine is currently in VERIFYING state
  const currentStatus = machineStateMemory[machineCode] || 'RUNNING';
  if (currentStatus === 'VERIFYING') {
    await processVerificationReading(machineCode, {
      temperature: data.temperature,
      vibration: data.vibration
    });
    return;
  }

  // 3b. A technician is actively working this machine (MAINTENANCE / WAITING_PARTS).
  // Ordinary telemetry threshold evaluation MUST NOT resurrect the machine to
  // RUNNING, nor re-fault it, while a repair workflow is in progress — only
  // maintenance.service.ts / verification.service.ts may change status during
  // this window. Sensor values still stream live (step 1) so the UI keeps
  // showing real readings; they just stop driving machines.status.
  if (currentStatus === 'MAINTENANCE' || currentStatus === 'WAITING_PARTS') {
    return;
  }

  // 4. Deterministic Threshold Evaluation
  // Thresholds:
  // Normal: Vib < 5.0, Temp < 70, Pressure 4-8 bar, Current < 15A
  // Warning: Vib 5.0 - 7.5 OR Temp 70 - 80 OR Pressure 3-4.5 bar OR Current 15-18A
  // Fault: Vib > 7.5 OR Temp > 80 OR Pressure < 3.0 bar OR Current > 18A
  let evaluatedStatus = 'RUNNING';
  let healthScore = 98;
  let isFault = false;
  let isWarning = false;

  if (data.vibration > 7.5 || data.temperature > 80.0 || (data.pressure > 0 && data.pressure < 3.0) || data.current > 18.0) {
    evaluatedStatus = 'FAULT';
    healthScore = Math.max(25, Math.round(100 - (data.vibration * 7.5)));
    isFault = true;
  } else if (data.vibration > 5.0 || data.temperature > 70.0 || (data.pressure > 0 && data.pressure < 4.5) || data.current > 15.0) {
    evaluatedStatus = 'WARNING';
    healthScore = Math.max(65, Math.round(100 - (data.vibration * 5.0)));
    isWarning = true;
  }

  // Check state transition
  if (currentStatus !== evaluatedStatus) {
    machineStateMemory[machineCode] = evaluatedStatus;

    // Update MySQL
    try {
      if (isFault) {
        // Entering FAULT stops the runtime clock and starts the downtime clock —
        // both derived from the DB server clock, never Date.now(). Any runtime
        // accrued since last_running_started_at is folded into the cumulative total.
        await execute(
          `UPDATE machines
             SET status = ?, health_score = ?,
                 total_runtime_seconds = total_runtime_seconds +
                   CASE WHEN last_running_started_at IS NOT NULL
                        THEN TIMESTAMPDIFF(MICROSECOND, last_running_started_at, CURRENT_TIMESTAMP(3)) / 1000000.0
                        ELSE 0 END,
                 last_running_started_at = NULL,
                 downtime_started_at = CURRENT_TIMESTAMP(3)
           WHERE code = ? OR id = ?`,
          [evaluatedStatus, healthScore, machineCode, machineCode]
        );
      } else {
        await execute(
          `UPDATE machines SET status = ?, health_score = ? WHERE code = ? OR id = ?`,
          [evaluatedStatus, healthScore, machineCode, machineCode]
        );
      }
    } catch (err) {
      console.warn(`[TelemetryService] Could not update machine table: ${err}`);
    }

    // Broadcast instant 3D twin status change
    broadcast('machine:status_changed', {
      machineId: machineCode,
      status: evaluatedStatus,
      healthScore,
      temperature: data.temperature,
      vibration: data.vibration,
      current: data.current,
      rpm: data.rpm
    });

    console.log(`[TelemetryService] Machine ${machineCode} status changed: ${currentStatus} -> ${evaluatedStatus} (Vib: ${data.vibration} mm/s, Temp: ${data.temperature}°C)`);
  }

  // 5. AI Diagnosis Debounce & Anomaly Cooldown:
  // Rule: One active incident = one AI diagnosis.
  // Never trigger duplicate AI diagnosis calls at 10 Hz telemetry streaming.
  if (isFault) {
    const hasActiveIncident = Boolean(activeIncidentMap[machineCode]);
    const isCurrentlyDiagnosing = Boolean(isDiagnosingMap[machineCode]);

    if (!hasActiveIncident && !isCurrentlyDiagnosing) {
      const now = Date.now();
      const lastTrigger = lastDiagnosisTimestamp[machineCode] || 0;
      // 10-second minimum cooldown between diagnoses
      if (now - lastTrigger > 10000) {
        lastDiagnosisTimestamp[machineCode] = now;
        isDiagnosingMap[machineCode] = true;
        await triggerFaultIncidentFlow(machineCode, data);
      }
    }
  }
}

async function triggerFaultIncidentFlow(machineCode: string, data: TelemetryPayload) {
  const correlationId = `CORR-${uuidv4().substring(0, 8)}`;
  const incidentId = `INC-${Math.floor(1000 + Math.random() * 9000)}`;
  activeIncidentMap[machineCode] = incidentId;

  console.log(`[TelemetryService] IoT Condition Monitoring Alert: Threshold breach on ${machineCode} (${incidentId}) [Debounce Locked]...`);

  try {
    // 1. Fetch machine DB row
    const machineRows = await query<any>(`SELECT id, name, code, type, area, criticality FROM machines WHERE code = ? OR id = ? LIMIT 1`, [machineCode, machineCode]);
    const machine = machineRows[0] || { id: machineCode, name: machineCode, code: machineCode, type: 'CNC', area: 'Main Production Cell', criticality: 'HIGH' };

    const alertType = data.vibration > 7.5
      ? `High Vibration Anomaly (${data.vibration.toFixed(2)} mm/s)`
      : data.temperature > 80.0
      ? `Critical Thermal Surge (${data.temperature.toFixed(1)} °C)`
      : data.current > 18.0
      ? `Motor Current Spike (${data.current.toFixed(1)} A)`
      : `Operating Pressure Loss (${data.pressure.toFixed(1)} bar)`;

    const conditionSummary = `IoT Edge Sensors detected abnormal ${alertType} exceeding safety operating threshold. Machine automatically flagged for certified technician physical inspection.`;

    // 2. Record FAULT_DETECTED event (server timestamp)
    await recordEvent({
      incidentId,
      machineId: machine.id || machineCode,
      eventType: 'FAULT_DETECTED',
      actorType: 'IOT_SENSOR',
      actorId: `IOT-EDGE-${machineCode}`,
      metadata: { alertType, vibration: data.vibration, temperature: data.temperature, current: data.current, pressure: data.pressure, scenarioId: data.scenarioId }
    });

    // 3. Create Incident in MySQL (IoT Detection record)
    await execute(
      `INSERT INTO incidents (id, machine_id, alert_type, severity, status, ai_diagnosis_summary, ai_root_cause, ai_confidence, scenario_id, detected_at)
       VALUES (?, ?, ?, 'CRITICAL', 'DETECTED', ?, 'Awaiting Technician Physical Inspection & Part Verification', 0.96, ?, CURRENT_TIMESTAMP(3))`,
      [
        incidentId,
        machine.id,
        alertType,
        conditionSummary,
        data.scenarioId || null
      ]
    );

    // 4. Record INCIDENT_CREATED event
    await recordEvent({
      incidentId,
      machineId: machine.id || machineCode,
      eventType: 'INCIDENT_CREATED',
      actorType: 'CONDITION_MONITOR',
      actorId: 'PLANTOPS-CONDITION-MONITOR',
      metadata: { alertType, conditionSummary, scenarioId: data.scenarioId }
    });

    // 5. Audit Log
    await recordAuditLog({
      actor: 'IOT_CONDITION_MONITOR',
      action: 'THRESHOLD_BREACH_INCIDENT_CREATED',
      resourceType: 'INCIDENT',
      resourceId: incidentId,
      newState: { incidentId, machineCode, telemetry: data, alertType },
      correlationId,
      reason: `Condition Monitoring: ${alertType} exceeded baseline threshold.`
    });

    // 6. Broadcast Incident Creation
    broadcast('incident:created', {
      incidentId,
      machineId: machineCode,
      machineName: machine.name,
      alertType,
      severity: 'CRITICAL',
      summary: conditionSummary,
      scenarioId: data.scenarioId,
      telemetry: data
    });

    // 7. Trigger AI Maintenance Orchestrator for Intelligent Technician Dispatch
    setTimeout(async () => {
      await createWorkOrderAndDispatch({
        incidentId,
        machineId: machine.id,
        machineCode: machine.code,
        alertType,
        symptom: conditionSummary,
        priority: 'CRITICAL',
        correlationId
      });
    }, 600);

  } catch (err: any) {
    console.error(`[TelemetryService] Error in incident flow: ${err.message}`);
  }
}
