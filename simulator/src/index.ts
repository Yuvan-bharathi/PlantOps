/**
 * PLANTOPS IoT Simulator — v2.0
 *
 * 30 realistic failure scenarios across 6 factory zones.
 * Faults are GRADUAL telemetry degradation, not instant status flips.
 * Each scenario profile defines per-second drift rates for each sensor.
 * scenarioId is included in MQTT payload so the backend can log it.
 */

import mqtt from 'mqtt';
import express from 'express';
import cors from 'cors';

const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const HTTP_PORT = process.env.SIMULATOR_PORT ? parseInt(process.env.SIMULATOR_PORT) : 4001;

// ─── Failure Scenario Library ─────────────────────────────────────────────────
interface ScenarioProfile {
  scenarioId: string;
  label: string;
  tier: 'OCCASIONAL' | 'UNCOMMON' | 'RARE' | 'CRITICAL_RARE';
  section: string;
  /** Per-second drift applied while degrading */
  drift: {
    temp?:     number;  // °C / s
    vib?:      number;  // mm/s / s
    current?:  number;  // A / s
    pressure?: number;  // bar / s (negative = drop)
    rpm?:      number;  // RPM / s
  };
  requiresPart: boolean;
}

const SCENARIO_PROFILES: Record<string, ScenarioProfile> = {
  // ── MACHINING (6) ────────────────────────────────────────────────────────────
  'MCH-01': { scenarioId: 'MCH-01', label: 'Tool Wear / Dull Insert',       tier: 'OCCASIONAL',    section: 'MACHINING',    drift: { current: 0.12, vib: 0.08 },                  requiresPart: true  },
  'MCH-02': { scenarioId: 'MCH-02', label: 'Coolant Flow Reduction',        tier: 'OCCASIONAL',    section: 'MACHINING',    drift: { temp: 0.80, pressure: -0.15 },                requiresPart: false },
  'MCH-03': { scenarioId: 'MCH-03', label: 'Chip Accumulation',             tier: 'OCCASIONAL',    section: 'MACHINING',    drift: { current: 0.10, vib: 0.05 },                  requiresPart: false },
  'MCH-04': { scenarioId: 'MCH-04', label: 'Workholding / Clamping Issue',  tier: 'OCCASIONAL',    section: 'MACHINING',    drift: { vib: 0.20 },                                  requiresPart: false },
  'MCH-05': { scenarioId: 'MCH-05', label: 'Spindle Fan / Cooling Issue',   tier: 'UNCOMMON',      section: 'MACHINING',    drift: { temp: 1.20 },                                 requiresPart: false },
  'MCH-06': { scenarioId: 'MCH-06', label: 'Spindle Bearing Degradation',   tier: 'RARE',          section: 'MACHINING',    drift: { vib: 0.25, temp: 0.60 },                     requiresPart: true  },
  // ── ROBOT (5) ────────────────────────────────────────────────────────────────
  'ROB-01': { scenarioId: 'ROB-01', label: 'Gripper / Tooling Failure',     tier: 'OCCASIONAL',    section: 'ROBOT',        drift: { pressure: -0.10 },                            requiresPart: false },
  'ROB-02': { scenarioId: 'ROB-02', label: 'Position / Calibration Drift',  tier: 'OCCASIONAL',    section: 'ROBOT',        drift: { vib: 0.10 },                                  requiresPart: false },
  'ROB-03': { scenarioId: 'ROB-03', label: 'Pneumatic Pressure Drop',       tier: 'OCCASIONAL',    section: 'ROBOT',        drift: { pressure: -0.18 },                            requiresPart: false },
  'ROB-04': { scenarioId: 'ROB-04', label: 'Joint Overload (Lubrication)',  tier: 'UNCOMMON',      section: 'ROBOT',        drift: { current: 0.15, temp: 0.60 },                 requiresPart: false },
  'ROB-05': { scenarioId: 'ROB-05', label: 'Gearbox Wear',                  tier: 'RARE',          section: 'ROBOT',        drift: { vib: 0.30, temp: 0.50, current: 0.12 },      requiresPart: true  },
  // ── PROCESSING (7) ───────────────────────────────────────────────────────────
  'PRS-01': { scenarioId: 'PRS-01', label: 'Pump Pressure Drop',            tier: 'OCCASIONAL',    section: 'PROCESSING',   drift: { pressure: -0.20, temp: 0.40 },               requiresPart: false },
  'PRS-02': { scenarioId: 'PRS-02', label: 'Pump Flow Restriction (Filter)',tier: 'OCCASIONAL',    section: 'PROCESSING',   drift: { pressure: -0.15, current: 0.08 },            requiresPart: true  },
  'PRS-03': { scenarioId: 'PRS-03', label: 'Pump Seal Leakage',             tier: 'OCCASIONAL',    section: 'PROCESSING',   drift: { pressure: -0.25, temp: 0.50 },               requiresPart: true  },
  'PRS-04': { scenarioId: 'PRS-04', label: 'Pump Cavitation',               tier: 'UNCOMMON',      section: 'PROCESSING',   drift: { vib: 0.18, pressure: -0.12, temp: 0.45 },   requiresPart: false },
  'PRS-05': { scenarioId: 'PRS-05', label: 'Mixer Overheating',             tier: 'UNCOMMON',      section: 'PROCESSING',   drift: { temp: 1.10, current: 0.18 },                 requiresPart: false },
  'PRS-06': { scenarioId: 'PRS-06', label: 'Mixer Abnormal Vibration',      tier: 'UNCOMMON',      section: 'PROCESSING',   drift: { vib: 0.20, temp: 0.30 },                     requiresPart: false },
  'PRS-07': { scenarioId: 'PRS-07', label: 'Hydraulic Press Pressure Loss', tier: 'RARE',          section: 'PROCESSING',   drift: { pressure: -0.30, vib: 0.15 },                requiresPart: true  },
  // ── ASSEMBLY (5) ─────────────────────────────────────────────────────────────
  'ASM-01': { scenarioId: 'ASM-01', label: 'Part Misalignment',             tier: 'OCCASIONAL',    section: 'ASSEMBLY',     drift: { vib: 0.08 },                                  requiresPart: false },
  'ASM-02': { scenarioId: 'ASM-02', label: 'Sensor Misread / Drift',        tier: 'OCCASIONAL',    section: 'ASSEMBLY',     drift: { current: 0.06 },                              requiresPart: false },
  'ASM-03': { scenarioId: 'ASM-03', label: 'Conveyor Position Error',       tier: 'OCCASIONAL',    section: 'ASSEMBLY',     drift: { vib: 0.12, rpm: -20 },                       requiresPart: false },
  'ASM-04': { scenarioId: 'ASM-04', label: 'Gripper Pick Failure',          tier: 'OCCASIONAL',    section: 'ASSEMBLY',     drift: { pressure: -0.10 },                            requiresPart: false },
  'ASM-05': { scenarioId: 'ASM-05', label: 'Pneumatic Actuator Issue',      tier: 'UNCOMMON',      section: 'ASSEMBLY',     drift: { pressure: -0.22, current: 0.10 },            requiresPart: true  },
  // ── PACKAGING (5) ────────────────────────────────────────────────────────────
  'PKG-01': { scenarioId: 'PKG-01', label: 'Product Misalignment',          tier: 'OCCASIONAL',    section: 'PACKAGING',    drift: { vib: 0.10 },                                  requiresPart: false },
  'PKG-02': { scenarioId: 'PKG-02', label: 'Film Tracking Drift',           tier: 'OCCASIONAL',    section: 'PACKAGING',    drift: { vib: 0.08, current: 0.05 },                  requiresPart: false },
  'PKG-03': { scenarioId: 'PKG-03', label: 'Conveyor Jam',                  tier: 'OCCASIONAL',    section: 'PACKAGING',    drift: { current: 0.18, rpm: -30 },                   requiresPart: false },
  'PKG-04': { scenarioId: 'PKG-04', label: 'Seal Temperature Deviation',    tier: 'OCCASIONAL',    section: 'PACKAGING',    drift: { temp: 0.90 },                                 requiresPart: false },
  'PKG-05': { scenarioId: 'PKG-05', label: 'Cutter Servo Overload',         tier: 'UNCOMMON',      section: 'PACKAGING',    drift: { current: 0.20, vib: 0.15, temp: 0.50 },      requiresPart: true  },
  // ── MAINTENANCE (2) ──────────────────────────────────────────────────────────
  'MNT-01': { scenarioId: 'MNT-01', label: 'Test Station Sensor Fault',     tier: 'UNCOMMON',      section: 'MAINTENANCE',  drift: { current: 0.10 },                              requiresPart: false },
  'MNT-02': { scenarioId: 'MNT-02', label: 'Diagnostic Equipment Connection', tier: 'UNCOMMON',   section: 'MAINTENANCE',  drift: { vib: 0.07 },                                  requiresPart: false },
};

// ─── Machine Base State ────────────────────────────────────────────────────────
interface MachineState {
  id: string;
  baseTemp: number;
  baseVib: number;
  baseCurrent: number;
  baseRpm: number;
  basePressure: number;
  // Runtime
  status: 'NORMAL' | 'DEGRADING' | 'REPAIRING';
  activeScenarioId?: string;
  degradeElapsed: number;  // seconds
  repairedAt?: number;
}

const machines: Record<string, MachineState> = {
  'CNC-01':   { id: 'CNC-01',   baseTemp: 62.0, baseVib: 2.2, baseCurrent: 12.0, baseRpm: 2800, basePressure: 6.0, status: 'NORMAL', degradeElapsed: 0 },
  'CNC-02':   { id: 'CNC-02',   baseTemp: 64.0, baseVib: 2.5, baseCurrent: 14.5, baseRpm: 1800, basePressure: 5.5, status: 'NORMAL', degradeElapsed: 0 },
  'CNC-03':   { id: 'CNC-03',   baseTemp: 61.5, baseVib: 1.8, baseCurrent: 11.2, baseRpm: 2900, basePressure: 6.0, status: 'NORMAL', degradeElapsed: 0 },
  'ROBOT-01': { id: 'ROBOT-01', baseTemp: 55.0, baseVib: 1.4, baseCurrent:  8.2, baseRpm:    0, basePressure: 5.0, status: 'NORMAL', degradeElapsed: 0 },
  'PUMP-01':  { id: 'PUMP-01',  baseTemp: 58.0, baseVib: 2.0, baseCurrent:  9.8, baseRpm: 1450, basePressure: 6.2, status: 'NORMAL', degradeElapsed: 0 },
  'MIXER-01': { id: 'MIXER-01', baseTemp: 70.0, baseVib: 4.8, baseCurrent: 15.0, baseRpm:  850, basePressure: 3.5, status: 'NORMAL', degradeElapsed: 0 },
};

// ─── Gaussian Noise ────────────────────────────────────────────────────────────
function gaussianNoise(mean = 0, stdev = 1) {
  const u = 1 - Math.random();
  const v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * stdev;
}

// ─── Telemetry Generation ─────────────────────────────────────────────────────
function generateTelemetry(machine: MachineState) {
  let temp     = machine.baseTemp     + gaussianNoise(0, 0.4);
  let vib      = machine.baseVib      + gaussianNoise(0, 0.15);
  let current  = machine.baseCurrent  + gaussianNoise(0, 0.2);
  let rpm      = machine.baseRpm > 0  ? machine.baseRpm + gaussianNoise(0, 15) : 0;
  let pressure = machine.basePressure > 0 ? machine.basePressure + gaussianNoise(0, 0.1) : 0;

  if (machine.status === 'DEGRADING' && machine.activeScenarioId) {
    const profile = SCENARIO_PROFILES[machine.activeScenarioId];
    const t = machine.degradeElapsed;

    if (profile?.drift) {
      temp     += (profile.drift.temp     ?? 0) * t;
      vib      += (profile.drift.vib      ?? 0) * t;
      current  += (profile.drift.current  ?? 0) * t;
      pressure += (profile.drift.pressure ?? 0) * t;  // negative = drop
      rpm      += (profile.drift.rpm      ?? 0) * t;
    }
    machine.degradeElapsed += 1; // per-second increment
  } else if (machine.status === 'REPAIRING') {
    const elapsed = Date.now() - (machine.repairedAt || Date.now());
    if (elapsed > 6000) {
      machine.status = 'NORMAL';
      machine.activeScenarioId = undefined;
      machine.degradeElapsed = 0;
    } else {
      const factor = Math.max(0, 1.0 - elapsed / 6000);
      vib  += factor * 2.0;
      temp += factor * 8.0;
    }
  }

  return {
    machineId:   machine.id,
    timestamp:   new Date().toISOString(),
    scenarioId:  machine.activeScenarioId || null,
    temperature: parseFloat(temp.toFixed(2)),
    vibration:   parseFloat(Math.max(0.1, vib).toFixed(2)),
    current:     parseFloat(current.toFixed(2)),
    rpm:         Math.round(Math.max(0, rpm)),
    pressure:    parseFloat(Math.max(0, pressure).toFixed(2)),
  };
}

// ─── MQTT Client ───────────────────────────────────────────────────────────────
console.log(`[Simulator] Connecting to MQTT broker at ${MQTT_BROKER_URL}...`);
const client = mqtt.connect(MQTT_BROKER_URL, { reconnectPeriod: 2000, connectTimeout: 5000 });

client.on('connect', () => console.log('[Simulator] Connected to MQTT Broker successfully.'));
client.on('error', (err) => console.warn(`[Simulator] MQTT error: ${err.message}. Retrying...`));

// Telemetry publication loop — 1 Hz
setInterval(() => {
  if (!client.connected) return;
  Object.values(machines).forEach((machine) => {
    const telemetry = generateTelemetry(machine);
    const payload = JSON.stringify(telemetry);
    client.publish(`plantops/machines/${machine.id}/telemetry`, payload, { qos: 0 });
    client.publish(`plant/${machine.id}/telemetry`, payload, { qos: 0 });
  });
}, 1000);

// ─── Express HTTP Control API ─────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

/** GET /api/simulator/machines — list all machine states */
app.get('/api/simulator/machines', (req, res) => {
  res.json({ success: true, machines: Object.values(machines) });
});

/** GET /api/simulator/scenarios — full 30-scenario catalog */
app.get('/api/simulator/scenarios', (req, res) => {
  res.json({ success: true, scenarios: Object.values(SCENARIO_PROFILES) });
});

/**
 * POST /api/simulator/inject-fault
 * Body: { machineId, scenarioId?, faultType?, intensity? }
 *
 * scenarioId (preferred): one of MCH-01..MNT-02
 * Legacy: faultType = 'BEARING_WEAR' | 'MOTOR_OVERHEAT' | 'PRESSURE_DROP'
 */
app.post('/api/simulator/inject-fault', (req, res) => {
  const { machineId = 'CNC-01', scenarioId, faultType, intensity = 1.0 } = req.body;

  // Ensure machine exists (add on-demand for extended machines)
  if (!machines[machineId]) {
    machines[machineId] = {
      id: machineId,
      baseTemp: 62.0, baseVib: 2.0, baseCurrent: 12.0, baseRpm: 0, basePressure: 5.0,
      status: 'NORMAL', degradeElapsed: 0,
    };
  }

  const machine = machines[machineId];

  // Resolve scenario: prefer explicit scenarioId, fall back to legacy faultType mapping
  let resolvedScenarioId: string | undefined = scenarioId;
  if (!resolvedScenarioId && faultType) {
    const legacyMap: Record<string, string> = {
      'BEARING_WEAR': 'MCH-06', 'MOTOR_OVERHEAT': 'MCH-05', 'PRESSURE_DROP': 'PRS-01',
      'SEAL_LEAK': 'PRS-03', 'LUBRICATION_FAILURE': 'ROB-04', 'SERVO_OVERLOAD': 'ROB-05',
      'PNEUMATIC_DROP': 'ROB-03', 'HYDRAULIC_LOSS': 'PRS-07',
    };
    resolvedScenarioId = legacyMap[faultType] || 'MCH-06';
  }

  machine.status = 'DEGRADING';
  machine.activeScenarioId = resolvedScenarioId;
  machine.degradeElapsed = 0;

  const profile = resolvedScenarioId ? SCENARIO_PROFILES[resolvedScenarioId] : null;
  console.log(`[Simulator] Injecting scenario ${resolvedScenarioId || 'LEGACY'} (${profile?.label || faultType}) on ${machineId}`);

  return res.json({
    success: true,
    message: `Scenario "${profile?.label || resolvedScenarioId}" injected on ${machineId} — gradual degradation started`,
    scenarioId: resolvedScenarioId,
    machine,
  });
});

/** POST /api/simulator/heal-machine — begin post-repair normalization */
app.post('/api/simulator/heal-machine', (req, res) => {
  const { machineId = 'CNC-01' } = req.body;
  if (!machines[machineId]) {
    return res.status(404).json({ success: false, error: `Machine ${machineId} not found` });
  }

  const machine = machines[machineId];
  machine.status = 'REPAIRING';
  machine.repairedAt = Date.now();
  console.log(`[Simulator] Machine ${machineId} entering REPAIRING/healing state.`);

  return res.json({
    success: true,
    message: `Machine ${machineId} telemetry normalizing...`,
    machine,
  });
});

app.listen(HTTP_PORT, () => {
  console.log(`[Simulator] HTTP Control API running on http://localhost:${HTTP_PORT}`);
});
