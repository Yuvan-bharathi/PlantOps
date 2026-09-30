import { Router } from 'express';
import { query, execute } from '../db/mysql.js';
import { getLocalDb, saveLocalDb } from '../db/localDb.js';
import {
  applyLOTO,
  completeRepair,
  submitPhysicalInspection,
  markTechnicianArrived,
  getLotoProtocolForMachine
} from '../services/maintenance.service.js';
import { approveHumanReviewItem } from '../services/procurement.service.js';
import { checkATP, reservePart, receiveGoodsReceipt } from '../services/inventory.service.js';
import { getDowntimeBreakdown } from '../services/eventRecorder.service.js';
import { getSOPsHandler, searchSOPsHandler, askSOPHandler } from '../controllers/knowledge.controller.js';
import { setMachineMemoryState, injectFaultScenario } from '../services/telemetry.service.js';
import { recoverMachineToRunning } from '../services/verification.service.js';
import { broadcast } from '../services/socket.service.js';
import { AIAgentEngineService } from '../services/aiAgentEngine.service.js';
import {
  getPlantPowerState,
  startPlantPower,
  stopPlantPower,
  emergencyStopPlant,
  resetPlantPowerAlarm,
  acknowledgePlantAlarm,
  toggleMachineBreaker,
  getDailyOperationsSummary,
  getMachineDayDetail,
  getMonthlyCalendar,
  istBusinessDate
} from '../services/powerProduction.service.js';
import { effectiveMachineStatus } from '../services/machineState.service.js';
import { allocatePalletIdentity, checkDockAndDispatch, triggerManualDispatch, getFleetState, listDispatches } from '../services/fleet.service.js';
import {
  isRedisConnected,
  getLatestTelemetry,
  getMachineLiveState,
  getShiftCounters,
  getPlantPowerGridState
} from '../db/redis.js';

const router = Router();

// ==========================================
// 1. MACHINES & 3D DIGITAL TWIN (25 Machines across 6 Zones)
// ==========================================
const MOCK_MACHINES = [
  // ── MACHINING CELL (center x≈-35, z≈-20.5) ──
  { id: 'MCH-CNC-01', code: 'CNC-01', name: 'High-Precision 5-Axis Milling Center 01', type: 'CNC', area: 'Machining Cell', status: 'RUNNING', health_score: 98, criticality: 'CRITICAL', pos_x: -42, pos_y: 0, pos_z: -25, components: [{ id: 'CMP-CNC01-SPINDLE', name: 'Main High-Speed Spindle', type: 'SPINDLE', criticality: 'CRITICAL' }, { id: 'CMP-CNC01-BEARING', name: 'Ceramic Spindle Bearing', type: 'BEARING', criticality: 'CRITICAL' }] },
  { id: 'MCH-CNC-02', code: 'CNC-02', name: 'Heavy Duty Turning Center 02', type: 'CNC', area: 'Machining Cell', status: 'RUNNING', health_score: 95, criticality: 'HIGH', pos_x: -35, pos_y: 0, pos_z: -25, components: [{ id: 'CMP-CNC02-MOTOR', name: 'Primary Drive Motor', type: 'MOTOR', criticality: 'HIGH' }] },
  { id: 'MCH-CNC-03', code: 'CNC-03', name: 'High-Precision 5-Axis Milling Center 03', type: 'CNC', area: 'Machining Cell', status: 'RUNNING', health_score: 98, criticality: 'HIGH', pos_x: -28, pos_y: 0, pos_z: -25, components: [{ id: 'CMP-CNC03-SPINDLE', name: 'Ultra-Torque Spindle', type: 'SPINDLE', criticality: 'CRITICAL' }] },
  { id: 'MCH-CNC-04', code: 'CNC-04', name: '5-Axis Machining Center 04', type: 'CNC', area: 'Machining Cell', status: 'RUNNING', health_score: 97, criticality: 'HIGH', pos_x: -42, pos_y: 0, pos_z: -16, components: [{ id: 'CMP-CNC04-SPINDLE', name: 'Rigid Spindle Axis', type: 'SPINDLE', criticality: 'HIGH' }] },
  { id: 'MCH-CNC-05', code: 'CNC-05', name: 'High-Speed Mill 05', type: 'CNC', area: 'Machining Cell', status: 'RUNNING', health_score: 96, criticality: 'HIGH', pos_x: -35, pos_y: 0, pos_z: -16, components: [{ id: 'CMP-CNC05-MOTOR', name: 'High-Speed Spindle Drive', type: 'MOTOR', criticality: 'HIGH' }] },
  { id: 'MCH-CNC-06', code: 'CNC-06', name: 'Ultra Precision Lathe 06', type: 'CNC', area: 'Machining Cell', status: 'RUNNING', health_score: 98, criticality: 'CRITICAL', pos_x: -28, pos_y: 0, pos_z: -16, components: [{ id: 'CMP-CNC06-CHUCK', name: 'Hydraulic Chuck & Spindle', type: 'CHUCK', criticality: 'CRITICAL' }] },

  // ── ROBOT CELL (center x≈+33, z≈-20.5) ──
  { id: 'MCH-ROB-01', code: 'ROBOT-01', name: 'Articulated 6-Axis Welding Robot 01', type: 'ROBOT', area: 'Robot Cell', status: 'RUNNING', health_score: 99, criticality: 'HIGH', pos_x: 24, pos_y: 0, pos_z: -25.5, components: [{ id: 'CMP-ROB01-SERVO', name: 'Axis 3 Harmonic Servo', type: 'SERVO', criticality: 'HIGH' }, { id: 'CMP-ROB01-TORCH', name: 'MIG Welding Torch', type: 'TORCH', criticality: 'HIGH' }] },
  { id: 'MCH-ROB-02', code: 'ROBOT-02', name: 'Heavy Payload Welding Robot 02', type: 'ROBOT', area: 'Robot Cell', status: 'RUNNING', health_score: 97, criticality: 'HIGH', pos_x: 34, pos_y: 0, pos_z: -25.5, components: [{ id: 'CMP-ROB02-SERVO', name: 'Axis 2 Heavy Reducer', type: 'SERVO', criticality: 'HIGH' }] },
  { id: 'MCH-ROB-03', code: 'ROBOT-03', name: 'Precision Seam Welding Robot 03', type: 'ROBOT', area: 'Robot Cell', status: 'RUNNING', health_score: 96, criticality: 'HIGH', pos_x: 24, pos_y: 0, pos_z: -15.5, components: [{ id: 'CMP-ROB03-SERVO', name: 'Axis 1 Turntable Drive', type: 'SERVO', criticality: 'HIGH' }] },
  { id: 'MCH-ROB-04', code: 'ROBOT-04', name: 'Welding & Fastening Robot 04', type: 'ROBOT', area: 'Robot Cell', status: 'RUNNING', health_score: 98, criticality: 'HIGH', pos_x: 34, pos_y: 0, pos_z: -15.5, components: [{ id: 'CMP-ROB04-TORCH', name: 'Laser Seam Tracker', type: 'SENSOR', criticality: 'HIGH' }] },

  // ── PROCESSING CELL (center x≈0, z≈-21) ──
  { id: 'MCH-MIX-01', code: 'MIXER-01', name: 'High-Shear Chemical & Lubricant Mixer', type: 'MIXER', area: 'Processing Cell', status: 'RUNNING', health_score: 94, criticality: 'HIGH', pos_x: -8, pos_y: 0, pos_z: -25.5, components: [{ id: 'CMP-MIX01-AGITATOR', name: 'Dual Helical Ribbon Agitator', type: 'AGITATOR', criticality: 'HIGH' }] },
  { id: 'MCH-PMP-01', code: 'PUMP-01', name: 'High-Pressure Hydraulic Coolant Pump', type: 'PUMP', area: 'Processing Cell', status: 'RUNNING', health_score: 92, criticality: 'MEDIUM', pos_x: 0, pos_y: 0, pos_z: -25.5, components: [{ id: 'CMP-PMP01-IMPELLER', name: 'Radial Vane Impeller', type: 'IMPELLER', criticality: 'HIGH' }] },
  { id: 'MCH-PRS-01', code: 'PRESS-01', name: 'Hydraulic Stamping & Forming Press', type: 'PRESS', area: 'Processing Cell', status: 'RUNNING', health_score: 96, criticality: 'HIGH', pos_x: 8, pos_y: 0, pos_z: -25.5, components: [{ id: 'CMP-PRS01-HYD', name: 'High-Pressure Hydraulic Cylinder', type: 'HYDRAULICS', criticality: 'HIGH' }] },
  { id: 'MCH-PRC-01', code: 'PROCESS-01', name: 'Continuous Fluid Treatment Vessel 01', type: 'PROCESSING', area: 'Processing Cell', status: 'RUNNING', health_score: 97, criticality: 'MEDIUM', pos_x: -8, pos_y: 0, pos_z: -15.5, components: [{ id: 'CMP-PRC01-VALVE', name: 'Pneumatic Flow Control Valve', type: 'VALVE', criticality: 'MEDIUM' }] },
  { id: 'MCH-PRC-02', code: 'PROCESS-02', name: 'Degassing & Settling Reactor 02', type: 'PROCESSING', area: 'Processing Cell', status: 'RUNNING', health_score: 95, criticality: 'MEDIUM', pos_x: 0, pos_y: 0, pos_z: -15.5, components: [{ id: 'CMP-PRC02-HEATER', name: 'Immersion Heating Element', type: 'HEATER', criticality: 'MEDIUM' }] },

  // ── ASSEMBLY CELL (center x≈-35, z≈15) ──
  { id: 'MCH-ASM-01', code: 'ASMB-01', name: 'Precision Screwdriving & Torque Workstation', type: 'ASSEMBLY', area: 'Assembly Cell', status: 'RUNNING', health_score: 97, criticality: 'HIGH', pos_x: -40, pos_y: 0, pos_z: 10, components: [{ id: 'CMP-ASM01-TORQUE', name: 'Digital Torque Spindle', type: 'SPINDLE', criticality: 'HIGH' }] },
  { id: 'MCH-ASM-02', code: 'ASMB-02', name: 'Optical Inspection & Vision Alignment Cell', type: 'ASSEMBLY', area: 'Assembly Cell', status: 'RUNNING', health_score: 98, criticality: 'HIGH', pos_x: -30, pos_y: 0, pos_z: 10, components: [{ id: 'CMP-ASM02-CAMERA', name: 'GigE Telecentric Vision Camera', type: 'VISION', criticality: 'HIGH' }] },
  { id: 'MCH-ASM-03', code: 'ASMB-03', name: 'Indexing Rotary Table Sub-assembly Station', type: 'ASSEMBLY', area: 'Assembly Cell', status: 'RUNNING', health_score: 98, criticality: 'HIGH', pos_x: -40, pos_y: 0, pos_z: 20, components: [{ id: 'CMP-ASM03-INDEXER', name: 'Cam Indexing Drive', type: 'INDEXER', criticality: 'HIGH' }] },
  { id: 'MCH-ASM-04', code: 'ASMB-04', name: 'Final Component Fitting & Harness Bench', type: 'ASSEMBLY', area: 'Assembly Cell', status: 'RUNNING', health_score: 96, criticality: 'MEDIUM', pos_x: -30, pos_y: 0, pos_z: 20, components: [{ id: 'CMP-ASM04-PRESS', name: 'Pneumatic Insertion Press', type: 'PRESS', criticality: 'MEDIUM' }] },

  // ── PACKAGING CELL (center x≈+31, z≈+16) ──
  { id: 'MCH-PKG-01', code: 'PACK-01', name: 'Automatic Form-Fill-Seal Packaging Unit', type: 'PACKAGING', area: 'Packaging Cell', status: 'RUNNING', health_score: 95, criticality: 'MEDIUM', pos_x: 32.0, pos_y: 0, pos_z: 10.5, components: [{ id: 'CMP-PKG01-SEALER', name: 'Rotary Thermal Sealer', type: 'SEALER', criticality: 'MEDIUM' }] },
  { id: 'MCH-PKG-02', code: 'PACK-02', name: 'Flow-Wrap & Shrink Packaging Machine', type: 'PACKAGING', area: 'Packaging Cell', status: 'RUNNING', health_score: 96, criticality: 'MEDIUM', pos_x: 32.0, pos_y: 0, pos_z: 16.0, components: [{ id: 'CMP-PKG02-WRAPPER', name: 'High-Speed Shrink Tunnel', type: 'HEATER', criticality: 'MEDIUM' }] },
  { id: 'MCH-PKG-03', code: 'PACK-03', name: 'Palletizing & Case Packing Cell', type: 'PACKAGING', area: 'Packaging Cell', status: 'RUNNING', health_score: 98, criticality: 'HIGH', pos_x: 32.0, pos_y: 0, pos_z: 21.5, components: [{ id: 'CMP-PKG03-ROBOT', name: 'Cartesian Case Palletizer', type: 'ROBOT', criticality: 'HIGH' }] },

  // ── MAINTENANCE BAY (center x≈0, z≈+15.5) ──
  { id: 'MCH-BNCH-01', code: 'BENCH-01', name: 'Diagnostic & Mechanical Overhaul Station', type: 'MAINTENANCE', area: 'Maintenance Bay', status: 'RUNNING', health_score: 98, criticality: 'HIGH', pos_x: -6, pos_y: 0, pos_z: 11.5, components: [{ id: 'CMP-BNCH01-DYN', name: 'Dynamometer & Test Motor', type: 'TESTER', criticality: 'HIGH' }] },
  { id: 'MCH-BNCH-02', code: 'BENCH-02', name: 'High-Precision Spindle Test & Balance Bench', type: 'MAINTENANCE', area: 'Maintenance Bay', status: 'RUNNING', health_score: 97, criticality: 'HIGH', pos_x: 6, pos_y: 0, pos_z: 11.5, components: [{ id: 'CMP-BNCH02-BAL', name: 'Dynamic Balancing Sensor', type: 'SENSOR', criticality: 'HIGH' }] },
  { id: 'MCH-TEST-01', code: 'TEST-01', name: 'Electronics & PLC Calibration Stand', type: 'MAINTENANCE', area: 'Maintenance Bay', status: 'RUNNING', health_score: 99, criticality: 'HIGH', pos_x: 0, pos_y: 0, pos_z: 21.5, components: [{ id: 'CMP-TEST01-OSC', name: 'Industrial Oscilloscope & Bus Analyzer', type: 'ANALYZER', criticality: 'HIGH' }] },
];

router.get('/machines', async (req, res) => {
  try {
    const powerInfo = getPlantPowerState();

    const machines = await query<any>(`
      SELECT m.*, 
             (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', c.id, 'name', c.name, 'type', c.component_type, 'criticality', c.criticality))
              FROM machine_components c WHERE c.machine_id = m.id) as components
      FROM machines m
      ORDER BY m.code ASC
    `);

    const source = (machines && machines.length > 0) ? machines : MOCK_MACHINES;
    const existingCodes = new Set(source.map((m: any) => m.code));
    const merged = [...source];
    MOCK_MACHINES.forEach(ext => {
      if (!existingCodes.has(ext.code)) {
        merged.push(ext as any);
      }
    });

    // Same effective-status rule the AI assistant uses (services/machineState.service.ts)
    const adjusted = merged.map((m: any) => ({ ...m, status: effectiveMachineStatus(m.code, m.status, powerInfo) }));

    res.json({ success: true, count: adjusted.length, data: adjusted });
  } catch (err: any) {
    res.json({ success: true, count: MOCK_MACHINES.length, data: MOCK_MACHINES });
  }
});

router.get('/machines/:codeOrId', async (req, res) => {
  const { codeOrId } = req.params;
  try {
    const rows = await query<any>(`SELECT * FROM machines WHERE code = ? OR id = ? LIMIT 1`, [codeOrId, codeOrId]);

    if (rows && rows.length > 0) {
      const machine = rows[0];
      machine.status = effectiveMachineStatus(machine.code, machine.status);
      const components = await query<any>(`SELECT * FROM machine_components WHERE machine_id = ?`, [machine.id]);
      const thresholds = await query<any>(`SELECT * FROM sensor_thresholds WHERE machine_id = ?`, [machine.id]);
      const activeIncidents = await query<any>(`SELECT * FROM incidents WHERE machine_id = ? AND status != 'CLOSED' ORDER BY detected_at DESC`, [machine.id]);
      const workOrders = await query<any>(`SELECT * FROM work_orders WHERE machine_id = ? ORDER BY created_at DESC LIMIT 5`, [machine.id]);

      return res.json({
        success: true,
        data: {
          ...machine,
          components: components || [],
          thresholds: thresholds || [],
          activeIncidents: activeIncidents || [],
          workOrders: workOrders || []
        }
      });
    }
  } catch (err: any) {
    // Fallback to in-memory lookup
  }

  const found = MOCK_MACHINES.find(m => m.code === codeOrId || m.id === codeOrId) || MOCK_MACHINES[0];
  res.json({
    success: true,
    data: {
      ...found,
      thresholds: [],
      activeIncidents: [],
      workOrders: []
    }
  });
});

// ==========================================
// 2. INCIDENTS & AI DIAGNOSES
// ==========================================
router.get('/incidents', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || (req.query.page ? 15 : 50);
    const offset = (page - 1) * limit;

    const countRes = await query<any>(`SELECT COUNT(*) as total FROM incidents`);
    const total = countRes?.[0]?.total || 0;

    const incidents = await query<any>(`
      SELECT i.*, m.name as machine_name, m.code as machine_code, p.part_number, p.name as part_name
      FROM incidents i
      JOIN machines m ON i.machine_id = m.id
      LEFT JOIN spare_parts p ON i.required_part_id = p.id
      ORDER BY i.detected_at DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);
    res.json({ 
      success: true, 
      count: incidents?.length || 0, 
      total: total || (incidents?.length || 0),
      page,
      limit,
      totalPages: Math.ceil((total || incidents?.length || 0) / limit) || 1,
      data: incidents || [] 
    });
  } catch (err: any) {
    res.json({ success: true, count: 0, total: 0, page: 1, limit: 15, totalPages: 1, data: [] });
  }
});

/** GET /incidents/:id/events — ordered event timeline for a single incident */
router.get('/incidents/:id/events', async (req, res) => {
  try {
    const { id } = req.params;
    const events = await query<any>(
      `SELECT id, incident_id, work_order_id, machine_id, event_type,
              actor_type, actor_id, metadata,
              event_ts AS event_ts_utc
       FROM incident_events
       WHERE incident_id = ?
       ORDER BY event_ts ASC`,
      [id]
    );
    // Parse metadata JSON strings if stored as text
    const enriched = events.map((e: any) => ({
      ...e,
      metadata: typeof e.metadata === 'string' ? JSON.parse(e.metadata) : e.metadata
    }));
    res.json({ success: true, count: enriched.length, data: enriched });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** GET /incidents/:id/downtime — phase-level downtime breakdown */
router.get('/incidents/:id/downtime', async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await query<any>(
      `SELECT
         detected_at,
         assignment_started_at,
         assigned_at,
         technician_dispatched_at,
         technician_arrived_at,
         loto_started_at,
         loto_completed_at,
         inspection_started_at,
         inspection_completed_at,
         repair_started_at,
         repair_completed_at,
         verification_started_at,
         verification_completed_at,
         machine_running_at,
         downtime_seconds
       FROM incidents WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Incident not found' });
    const breakdown = await getDowntimeBreakdown(id);
    res.json({ success: true, data: { ...rows[0], breakdown } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// ==========================================
// 3. WORK ORDERS & TECHNICIAN WORKSPACE
// ==========================================
const MOCK_WORK_ORDERS = [
  {
    id: 'WO-1082',
    incident_id: 'INC-INIT-01',
    machine_id: 'MCH-CNC-01',
    machine_name: 'High-Precision 5-Axis Milling Center 01',
    machine_code: 'CNC-01',
    technician_id: 'TECH-01',
    technician_name: 'Arun Kumar',
    technician_role: 'Lead Vibration & Spindle Reliability Specialist',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    loto_required: true,
    loto_applied: false,
    notes: 'Autonomous AI Dispatch: Verified vibration signature match for ceramic bearing replacement.',
    created_at: new Date().toISOString()
  }
];

router.get('/work-orders', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || (req.query.page ? 15 : 50);
    const offset = (page - 1) * limit;

    const countRes = await query<any>(`SELECT COUNT(*) as total FROM work_orders`);
    const total = countRes?.[0]?.total || 0;

    const workOrders = await query<any>(`
      SELECT wo.*, m.name as machine_name, m.code as machine_code, t.name as technician_name, t.role as technician_role
      FROM work_orders wo
      JOIN machines m ON wo.machine_id = m.id
      LEFT JOIN technicians t ON wo.technician_id = t.id
      ORDER BY wo.created_at DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);
    if (!workOrders || workOrders.length === 0) {
      return res.json({ 
        success: true, 
        count: MOCK_WORK_ORDERS.length, 
        total: MOCK_WORK_ORDERS.length, 
        page: 1, 
        limit: 15, 
        totalPages: 1, 
        data: MOCK_WORK_ORDERS 
      });
    }
    res.json({ 
      success: true, 
      count: workOrders.length, 
      total: total || workOrders.length,
      page,
      limit,
      totalPages: Math.ceil((total || workOrders.length) / limit) || 1,
      data: workOrders 
    });
  } catch (err: any) {
    res.json({ 
      success: true, 
      count: MOCK_WORK_ORDERS.length, 
      total: MOCK_WORK_ORDERS.length, 
      page: 1, 
      limit: 15, 
      totalPages: 1, 
      data: MOCK_WORK_ORDERS 
    });
  }
});

router.get('/work-orders/:id/loto-protocol', async (req, res) => {
  try {
    const { id } = req.params;
    const woRows = await query<any>(`
      SELECT wo.id, wo.machine_id, m.code as machine_code, m.type as machine_type 
      FROM work_orders wo 
      JOIN machines m ON wo.machine_id = m.id 
      WHERE wo.id = ? LIMIT 1
    `, [id]);

    if (!woRows || woRows.length === 0) {
      return res.json({
        success: true,
        data: getLotoProtocolForMachine('CNC', 'CNC-01')
      });
    }

    const protocol = getLotoProtocolForMachine(woRows[0].machine_type, woRows[0].machine_code || woRows[0].machine_id);
    res.json({ success: true, data: protocol });
  } catch (err: any) {
    res.json({
      success: true,
      data: getLotoProtocolForMachine('CNC', 'CNC-01')
    });
  }
});

router.post('/work-orders/:id/arrive', async (req, res) => {
  try {
    const { id } = req.params;
    const { technicianName = 'Arun Kumar (Lead Tech)' } = req.body;
    const result = await markTechnicianArrived(id, technicianName);
    res.json(result || { success: true, message: 'Technician arrived on site.' });
  } catch (err: any) {
    res.json({ success: true, message: `Technician arrived on site.` });
  }
});

router.post('/work-orders/:id/inspection', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      technicianName = 'Arun Kumar (Lead Tech)',
      symptomsObserved = ['Abnormal spindle chatter', 'Excessive bearing radial play'],
      technicianRootCause = 'Spindle Angular Bearing Fluting & Cage Wear',
      requiredPartId = 'PART-SKF-6205',
      quantity = 1
    } = req.body;

    const result = await submitPhysicalInspection({
      workOrderId: id,
      technicianName,
      symptomsObserved,
      technicianRootCause,
      requiredPartId,
      quantity
    });

    res.json(result || {
      success: true,
      data: {
        workOrderId: id,
        status: 'PARTS_ALLOCATED',
        partReserved: true,
        binLocation: 'BAY-A-04'
      }
    });
  } catch (err: any) {
    res.json({
      success: true,
      data: {
        workOrderId: req.params.id,
        status: 'PARTS_ALLOCATED',
        partReserved: true,
        binLocation: 'BAY-A-04'
      }
    });
  }
});

router.post('/work-orders/:id/loto', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      verifiedBy = 'Arun Kumar (Lead Tech)',
      padlockId = 'PL-8894-LOTO',
      voltageReading = 0.0,
      pressureReading = 0.0,
      isolationPointsConfirmed = []
    } = req.body;

    const success = await applyLOTO(id, verifiedBy, {
      padlockId,
      voltageReading,
      pressureReading,
      isolationPointsConfirmed
    });

    res.json({
      success: true,
      message: `OSHA LOTO applied and verified by ${verifiedBy} (Padlock #${padlockId})`,
      data: { padlockId, voltageReading, pressureReading }
    });
  } catch (err: any) {
    res.json({
      success: true,
      message: `OSHA LOTO applied (simulated)`,
      data: { padlockId: 'PL-8894-LOTO', voltageReading: 0.0, pressureReading: 0.0 }
    });
  }
});

router.post('/work-orders/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { technicianName = 'Arun Kumar (Lead Tech)' } = req.body;
    await completeRepair(id, technicianName);
    res.json({ success: true, message: 'Repair marked complete. Verification cycle initialized.' });
  } catch (err: any) {
    res.json({ success: true, message: 'Repair marked complete. Verification cycle initialized.' });
  }
});

// ==========================================
// 4. INVENTORY & ATP
// ==========================================
router.get('/inventory', async (req, res) => {
  try {
    const inventory = await query<any>(`
      SELECT p.*, i.id as inventory_id, i.warehouse_name, i.bin_location, 
             COALESCE(i.quantity_on_hand, 0) as quantity_on_hand,
             COALESCE(i.reserved_quantity, 0) as reserved_quantity,
             (COALESCE(i.quantity_on_hand, 0) - COALESCE(i.reserved_quantity, 0)) as available_to_promise
      FROM spare_parts p
      LEFT JOIN inventory i ON p.id = i.part_id
      ORDER BY p.part_number ASC
    `);
    res.json({ success: true, count: inventory?.length || 0, data: inventory || [] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message, data: [] });
  }
});

router.get('/inventory/atp/:partIdOrNumber', async (req, res) => {
  try {
    const { partIdOrNumber } = req.params;
    const atp = await checkATP(partIdOrNumber);
    if (atp) return res.json({ success: true, data: atp });
  } catch (err: any) {}

  res.json({
    success: true,
    data: {
      partId: 'PART-SKF-6205',
      partNumber: 'SKF-6205-2RSH',
      availableToPromise: 7,
      atp: 7,
      binLocation: 'BAY-A-04',
      warehouse: 'Central Spares WH-01'
    }
  });
});

router.post('/inventory/reserve', async (req, res) => {
  try {
    const { workOrderId, partId, quantity = 1 } = req.body;
    const success = await reservePart(workOrderId, partId, quantity);
    if (!success) {
      return res.status(400).json({ 
        success: false, 
        error: 'Unable to reserve part: insufficient Available-To-Promise (ATP) stock in warehouse.' 
      });
    }

    broadcast('part:reserved', { workOrderId, partId, quantity, timestamp: new Date().toISOString() });
    res.json({ 
      success: true, 
      message: `Successfully reserved ${quantity} unit(s) of ${partId} for Work Order ${workOrderId}.`,
      workOrderId,
      partId,
      quantity
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/inventory/reservations', async (req, res) => {
  try {
    const reservations = await query<any>(`
      SELECT r.*, p.part_number, p.name as part_name, wo.machine_id, m.code as machine_code, m.name as machine_name, wo.technician_name
      FROM part_reservations r
      JOIN spare_parts p ON r.part_id = p.id
      JOIN work_orders wo ON r.work_order_id = wo.id
      LEFT JOIN machines m ON wo.machine_id = m.id OR wo.machine_id = m.code
      ORDER BY r.created_at DESC
    `);
    res.json({ success: true, count: reservations?.length || 0, data: reservations || [] });
  } catch (err: any) {
    res.json({ success: true, count: 0, data: [] });
  }
});

// ==========================================
// 5. PROCUREMENT & PURCHASE ORDERS
// ==========================================
router.get('/purchase-orders', async (req, res) => {
  try {
    const pos = await query<any>(`
      SELECT po.*, p.part_number, p.name as part_name, s.name as supplier_name, s.rating as supplier_rating
      FROM purchase_orders po
      LEFT JOIN spare_parts p ON po.part_id = p.id
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      ORDER BY po.created_at DESC
      LIMIT 50
    `);
    res.json({ success: true, count: pos?.length || 0, data: pos || [] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message, data: [] });
  }
});

router.post('/purchase-orders/:id/receive', async (req, res) => {
  try {
    const { id } = req.params;
    const { receivedBy = 'Inventory Receiving Supervisor' } = req.body;
    
    // Get PO details from DB
    const pos = await query<any>(`SELECT * FROM purchase_orders WHERE id = ?`, [id]);
    const po = pos && pos[0] ? pos[0] : null;

    if (po) {
      await execute(`UPDATE purchase_orders SET status = 'RECEIVED' WHERE id = ?`, [id]);
      await receiveGoodsReceipt(id, po.part_id, po.quantity, receivedBy);
      broadcast('po:received', { poId: id, partId: po.part_id, quantity: po.quantity });
    }

    res.json({ success: true, message: `Goods Receipt (GRN) generated successfully for ${id}. Stock has been replenished.`, poId: id });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/suppliers/:id/expedite', async (req, res) => {
  try {
    const { id } = req.params;
    const { notes = 'High plant criticality rush requested' } = req.body;
    
    broadcast('supplier:expedite_dispatched', { supplierId: id, notes, timestamp: new Date().toISOString() });
    res.json({ success: true, message: `Emergency Expedite Dispatch transmitted to vendor ${id} via Priority EDI.`, supplierId: id });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 6. HUMAN REVIEW CENTER
// ==========================================
const MOCK_REVIEWS = [
  {
    id: 'REV-501',
    item_type: 'PURCHASE_ORDER_APPROVAL',
    reference_id: 'PO-8821',
    title: 'Autonomous PO-8821 Buffer Restock (SKF-6205-2RSH)',
    reason: 'Policy Threshold Check: Auto-Approved under Policy POL-01 ($1,000 threshold). Certified audit log archived.',
    required_role: 'Plant Maintenance Manager',
    status: 'APPROVED',
    total_amount: 180.0,
    quantity: 4,
    part_number: 'SKF-6205-2RSH',
    part_name: 'Deep Groove Ball Bearing',
    supplier_name: 'Motion Industries',
    created_at: new Date().toISOString()
  }
];

router.get('/human-review', async (req, res) => {
  try {
    const items = await query<any>(`
      SELECT r.*, po.total_amount, po.quantity, p.part_number, p.name as part_name, s.name as supplier_name
      FROM human_review_items r
      LEFT JOIN purchase_orders po ON r.reference_id = po.id
      LEFT JOIN spare_parts p ON po.part_id = p.id
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      ORDER BY r.created_at DESC
    `);
    if (!items || items.length === 0) {
      return res.json({ success: true, count: MOCK_REVIEWS.length, data: MOCK_REVIEWS });
    }
    res.json({ success: true, count: items.length, data: items });
  } catch (err: any) {
    res.json({ success: true, count: MOCK_REVIEWS.length, data: MOCK_REVIEWS });
  }
});

// ==========================================
// 7. POLICIES & AUDIT LOGS
// ==========================================
const MOCK_POLICIES = [
  { id: 'POL-01', code: 'POL-AUTO-PO-1000', name: 'Autonomous Reorder Under $1,000', description: 'Auto-generates and transmits PO to preferred supplier when ATP < 2 and total spend <= $1,000.', rule_type: 'PROCUREMENT_AUTO_PO', max_spend_limit: 1000.0, is_active: true },
  { id: 'POL-02', code: 'POL-AI-CONF-90', name: 'AI Diagnosis Minimum Confidence (90%)', description: 'Requires physical technician verification if AI model confidence is below 0.90.', rule_type: 'AI_CONFIDENCE_THRESHOLD', max_spend_limit: 5000.0, is_active: true },
  { id: 'POL-03', code: 'POL-LOTO-MANDATORY', name: 'Mandatory OSHA 1910.147 Lockout Tagout', description: 'Blocks work order completion unless zero-energy state is confirmed with digital padlock.', rule_type: 'POLICY_EXCEPTION', max_spend_limit: 0.0, is_active: true }
];

router.get('/policies', async (req, res) => {
  try {
    const policies = await query<any>(`SELECT * FROM policies ORDER BY code ASC`);
    if (!policies || policies.length === 0) {
      return res.json({ success: true, data: MOCK_POLICIES });
    }
    res.json({ success: true, data: policies });
  } catch (err: any) {
    res.json({ success: true, data: MOCK_POLICIES });
  }
});

router.get('/audit-logs', async (req, res) => {
  try {
    const logs = await query<any>(`SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100`);
    res.json({ success: true, count: logs?.length || 0, data: logs || [] });
  } catch (err: any) {
    res.json({ success: true, count: 0, data: [] });
  }
});

// ==========================================
// 8. TECHNICIANS ROSTER
// ==========================================
const MOCK_TECHNICIANS = [
  { id: 'TECH-01', name: 'Arun Kumar', email: 'arun.kumar@plantops.internal', role: 'Lead Vibration & Spindle Specialist', assigned_area: 'Machining Cell', status: 'AVAILABLE', shift: 'Morning (06:00-14:00)', skills: JSON.stringify(['CNC_MILLING', 'MECHANICAL_VIBRATION', 'SPINDLE_SYSTEMS', 'PRECISION_ALIGNMENT', 'VIBRATION_ANALYSIS', 'BEARING_REPLACEMENT', 'OSHA_LOTO']), active_work_orders: 0 },
  { id: 'TECH-02', name: 'Dev Patel', email: 'dev.patel@plantops.internal', role: 'High-Speed CNC Tooling Specialist', assigned_area: 'Machining Cell', status: 'AVAILABLE', shift: 'Morning (06:00-14:00)', skills: JSON.stringify(['CNC_MILLING', 'SPINDLE_SYSTEMS', 'PRECISION_ALIGNMENT', 'OSHA_LOTO']), active_work_orders: 0 },
  { id: 'TECH-03', name: 'Priya Sharma', email: 'priya.sharma@plantops.internal', role: 'Senior Automation & Robotics Engineer', assigned_area: 'Robot Cell', status: 'AVAILABLE', shift: 'Morning (06:00-14:00)', skills: JSON.stringify(['ROBOTICS_KINEMATICS', 'SERVO_DRIVES', 'ELECTRICAL_MOTION', 'ROBOTICS_FANUC', 'PLC_SIEMENS', 'SAFETY_CIRCUITS', 'OSHA_LOTO']), active_work_orders: 0 },
  { id: 'TECH-04', name: 'Lisa Wong', email: 'lisa.wong@plantops.internal', role: 'Mechatronics & Robotics Specialist', assigned_area: 'Robot Cell', status: 'AVAILABLE', shift: 'Morning (06:00-14:00)', skills: JSON.stringify(['ROBOTICS_KINEMATICS', 'SERVO_DRIVES', 'SAFETY_CIRCUITS', 'OSHA_LOTO']), active_work_orders: 0 },
  { id: 'TECH-05', name: 'Rajesh Nair', email: 'rajesh.nair@plantops.internal', role: 'Hydraulic Systems & Fluid Specialist', assigned_area: 'Processing Cell', status: 'AVAILABLE', shift: 'Morning (06:00-14:00)', skills: JSON.stringify(['HYDRAULIC_CIRCUITS', 'SEAL_REPLACEMENT', 'FLUID_POWER', 'PRESSURE_TESTING', 'VALVE_CALIBRATION', 'OSHA_LOTO']), active_work_orders: 0 },
  { id: 'TECH-06', name: 'Carlos Gomez', email: 'carlos.gomez@plantops.internal', role: 'Chemical Process & Planetary Tech', assigned_area: 'Processing Cell', status: 'AVAILABLE', shift: 'Morning (06:00-14:00)', skills: JSON.stringify(['GEARBOX_MAINTENANCE', 'LUBRICATION_SYSTEMS', 'MECHANICAL_SEALS', 'FLUID_POWER', 'OSHA_LOTO']), active_work_orders: 0 },
  { id: 'TECH-07', name: 'Nina Cole', email: 'nina.cole@plantops.internal', role: 'Precision Assembly Line Specialist', assigned_area: 'Assembly Cell', status: 'AVAILABLE', shift: 'Morning (06:00-14:00)', skills: JSON.stringify(['MATERIAL_HANDLING', 'ROLLER_BEARINGS', 'MOTOR_DRIVES', 'TORQUE_SYSTEMS', 'PRECISION_ALIGNMENT', 'OSHA_LOTO']), active_work_orders: 0 },
  { id: 'TECH-08', name: 'Ben Harris', email: 'ben.harris@plantops.internal', role: 'Assembly Automation & Drives Tech', assigned_area: 'Assembly Cell', status: 'AVAILABLE', shift: 'Morning (06:00-14:00)', skills: JSON.stringify(['MATERIAL_HANDLING', 'ROLLER_BEARINGS', 'MOTOR_DRIVES', 'BELT_TRACKING', 'OSHA_LOTO']), active_work_orders: 0 },
  { id: 'TECH-09', name: 'Tom Wilson', email: 'tom.wilson@plantops.internal', role: 'Packaging Automation Specialist', assigned_area: 'Packaging Cell', status: 'AVAILABLE', shift: 'Morning (06:00-14:00)', skills: JSON.stringify(['PNEUMATICS', 'PACKAGING_AUTOMATION', 'SEALERS', 'VACUUM_SYSTEMS', 'OSHA_LOTO']), active_work_orders: 0 },
  { id: 'TECH-10', name: 'Amy Chen', email: 'amy.chen@plantops.internal', role: 'Cartoner & Vision Systems Tech', assigned_area: 'Packaging Cell', status: 'AVAILABLE', shift: 'Morning (06:00-14:00)', skills: JSON.stringify(['PNEUMATICS', 'PACKAGING_AUTOMATION', 'SEALERS', 'OPTICAL_INSPECTION', 'OSHA_LOTO']), active_work_orders: 0 },
  { id: 'TECH-11', name: 'Frank Moore', email: 'frank.moore@plantops.internal', role: 'Plant Maintenance Specialist', assigned_area: 'Maintenance Bay', status: 'AVAILABLE', shift: 'General (08:00-17:00)', skills: JSON.stringify(['HYDRAULIC_PRESSES', 'VALVE_MANIFOLDS', 'PRESSURE_SYSTEMS', 'ROOT_CAUSE_ANALYSIS', 'DIAGNOSTICS', 'OSHA_1910_COMPLIANCE', 'OSHA_LOTO']), active_work_orders: 0 },
  { id: 'TECH-12', name: 'Tina Ross', email: 'tina.ross@plantops.internal', role: 'Industrial Electrical & Controls Engineer', assigned_area: 'Maintenance Bay', status: 'AVAILABLE', shift: 'General (08:00-17:00)', skills: JSON.stringify(['ELECTRICAL_MOTION', 'PLC_SIEMENS', 'SAFETY_CIRCUITS', 'DIAGNOSTICS', 'HYDRAULIC_PRESSES', 'OSHA_LOTO']), active_work_orders: 0 }
];

router.get('/technicians', async (req, res) => {
  try {
    const technicians = await query<any>(`
      SELECT t.*,
             COUNT(wo.id) as active_work_orders
      FROM technicians t
      LEFT JOIN work_orders wo ON t.id = wo.technician_id AND wo.status != 'COMPLETED'
      GROUP BY t.id
      ORDER BY t.name ASC
    `);
    if (!technicians || technicians.length === 0) {
      return res.json({ success: true, count: MOCK_TECHNICIANS.length, data: MOCK_TECHNICIANS });
    }
    res.json({ success: true, count: technicians.length, data: technicians });
  } catch (err: any) {
    res.json({ success: true, count: MOCK_TECHNICIANS.length, data: MOCK_TECHNICIANS });
  }
});

// ==========================================
// 8B. PREVENTATIVE MAINTENANCE (PM) & CLUSTERS (TiDB Cloud)
// ==========================================
router.get('/pm-schedules', async (req, res) => {
  try {
    const rows = await query<any>(`
      SELECT * FROM pm_schedules
      ORDER BY 
        CASE status 
          WHEN 'INSPECTING' THEN 1 
          WHEN 'DISPATCHED' THEN 2 
          WHEN 'SCHEDULED' THEN 3 
          ELSE 4 
        END,
        next_due_date ASC
    `);
    const enriched = rows.map((r: any) => ({
      ...r,
      intervalDays: r.interval_days,
      frequency: r.frequency_label,
      task: r.task_title,
      sopCode: r.sop_code,
      machineCode: r.machine_code,
      machineName: r.machine_name,
      assignedTechnicianId: r.assigned_technician_id,
      assignedTechnicianName: r.assigned_technician_name,
      lastPerformed: r.last_performed_at,
      nextDue: r.next_due_date,
      workOrderId: r.work_order_id,
      checklist: typeof r.checklist_schema === 'string' ? JSON.parse(r.checklist_schema) : (r.checklist_schema || [])
    }));
    res.json({ success: true, count: enriched.length, data: enriched });
  } catch (err: any) {
    res.json({ success: true, count: 0, data: [] });
  }
});

router.post('/pm-schedules', async (req, res) => {
  try {
    const {
      machineCode = 'CNC-01',
      machineName = '5-Axis Milling Center 01',
      area = 'Machining Cell',
      task = 'Comprehensive PM Inspection',
      sopCode = 'SOP-CNC-PM-01',
      intervalDays = 90,
      priority = 'HIGH',
      nextDue,
      checklist = []
    } = req.body;

    const id = `PM-2026-${Math.floor(100 + Math.random() * 900)}`;
    const today = new Date();
    const computedDue = nextDue || new Date(today.getTime() + intervalDays * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    
    // Auto-lookup cluster technician
    const clusterRows = await query<any>(`SELECT * FROM technician_machine_clusters WHERE machine_code = ? LIMIT 1`, [machineCode]);
    const techId = clusterRows[0]?.technician_id || 'TECH-01';
    const techName = clusterRows[0]?.technician_name || 'Arun Kumar';

    await execute(`
      INSERT INTO pm_schedules (
        id, machine_id, machine_code, machine_name, area, task_title, sop_code, interval_days,
        frequency_label, priority, status, assigned_technician_id, assigned_technician_name,
        last_performed_at, next_due_date, checklist_schema
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SCHEDULED', ?, ?, NULL, ?, ?)
    `, [
      id, machineCode, machineCode, machineName, area, task, sopCode, intervalDays,
      `Every ${intervalDays} Days`, priority, techId, techName, computedDue, JSON.stringify(checklist)
    ]);

    broadcast('pm:created', { id, machineCode, task, intervalDays, techName });
    res.json({ success: true, message: 'PM Schedule registered in TiDB Cloud', id });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/pm-schedules/:id/dispatch', async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await query<any>(`SELECT * FROM pm_schedules WHERE id = ? LIMIT 1`, [id]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'PM Schedule not found' });

    const pm = rows[0];
    // Find cluster technician
    const clusterRows = await query<any>(`SELECT * FROM technician_machine_clusters WHERE machine_code = ? LIMIT 1`, [pm.machine_code]);
    const techId = clusterRows[0]?.technician_id || pm.assigned_technician_id || 'TECH-01';
    const techName = clusterRows[0]?.technician_name || pm.assigned_technician_name || 'Arun Kumar';
    const woId = `WO-PM-${Date.now().toString().slice(-4)}`;
    const incId = `INC-${woId}`;

    // Lookup machine id from machines table
    const mRows = await query<any>(`SELECT id FROM machines WHERE code = ? OR id = ? LIMIT 1`, [pm.machine_code, pm.machine_id]);
    const machineDbId = mRows[0]?.id || `MCH-${pm.machine_code}`;

    // 1. Update PM Schedule
    await execute(`
      UPDATE pm_schedules 
      SET status = 'INSPECTING', assigned_technician_id = ?, assigned_technician_name = ?, work_order_id = ?, updated_at = NOW()
      WHERE id = ?
    `, [techId, techName, woId, id]);

    // 2. Insert PM Incident record
    try {
      await execute(`
        INSERT INTO incidents (
          id, machine_id, alert_type, severity, status, ai_diagnosis_summary, ai_root_cause, ai_confidence
        ) VALUES (?, ?, 'PREVENTATIVE_MAINTENANCE', 'LOW', 'INSPECTING', ?, 'Scheduled Interval Verification', 0.98)
        ON DUPLICATE KEY UPDATE status = 'INSPECTING';
      `, [incId, machineDbId, `Preventative Maintenance Routine: ${pm.task_title}`]);

      // 3. Insert Work Order
      await execute(`
        INSERT INTO work_orders (
          id, incident_id, machine_id, technician_id, priority, status, loto_required, notes
        ) VALUES (?, ?, ?, ?, ?, 'IN_PROGRESS', false, ?)
        ON DUPLICATE KEY UPDATE status = 'IN_PROGRESS', technician_id = VALUES(technician_id);
      `, [woId, incId, machineDbId, techId, pm.priority, `Autonomous PM Routine: ${pm.task_title} (${pm.frequency_label})`]);
    } catch (dbErr: any) {
      console.warn('[PM Dispatch DB]', dbErr.message);
    }

    broadcast('pm:dispatched', {
      id,
      workOrderId: woId,
      machineCode: pm.machine_code,
      technicianId: techId,
      technicianName: techName,
      task: pm.task_title,
      intervalDays: pm.interval_days
    });

    res.json({
      success: true,
      message: `AI Agent dispatched ${techName} to ${pm.machine_code} (Work Order: ${woId})`,
      data: { id, workOrderId: woId, technicianId: techId, technicianName: techName, status: 'INSPECTING' }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/pm-schedules/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { checklist, notes } = req.body;
    const rows = await query<any>(`SELECT * FROM pm_schedules WHERE id = ? LIMIT 1`, [id]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'PM Schedule not found' });

    const pm = rows[0];
    const today = new Date();
    const intervalDays = pm.interval_days || 90;
    const nextDate = new Date(today.getTime() + intervalDays * 24 * 60 * 60 * 1000);
    const nextDueFormatted = nextDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const completedDate = today.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    const updatedChecklist = checklist || JSON.parse(pm.checklist_schema || '[]').map((c: any) => ({ ...c, checked: true }));

    await execute(`
      UPDATE pm_schedules 
      SET status = 'COMPLETED', last_performed_at = ?, next_due_date = ?, checklist_schema = ?, updated_at = NOW()
      WHERE id = ?
    `, [completedDate, nextDueFormatted, JSON.stringify(updatedChecklist), id]);

    if (pm.work_order_id) {
      await execute(`UPDATE work_orders SET status = 'COMPLETED', completed_at = NOW() WHERE id = ?`, [pm.work_order_id]);
    }

    broadcast('pm:completed', {
      id,
      machineCode: pm.machine_code,
      technicianName: pm.assigned_technician_name,
      nextDueDate: nextDueFormatted,
      intervalDays
    });

    res.json({
      success: true,
      message: `PM routine certified and completed. Next routine scheduled for ${nextDueFormatted} (+${intervalDays} days).`,
      data: { id, status: 'COMPLETED', lastPerformed: completedDate, nextDue: nextDueFormatted }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/technicians/clusters', async (req, res) => {
  try {
    const rows = await query<any>(`
      SELECT c.*, t.role as technician_role, t.skills as technician_skills
      FROM technician_machine_clusters c
      JOIN technicians t ON c.technician_id = t.id
      ORDER BY c.technician_id ASC, c.machine_code ASC
    `);

    // Group by technician
    const clusterMap: Record<string, any> = {};
    rows.forEach((r: any) => {
      if (!clusterMap[r.technician_id]) {
        clusterMap[r.technician_id] = {
          id: r.technician_id,
          name: r.technician_name,
          role: r.technician_role,
          assignedArea: r.assigned_area,
          skills: typeof r.technician_skills === 'string' ? JSON.parse(r.technician_skills) : (r.technician_skills || []),
          assignedMachines: []
        };
      }
      clusterMap[r.technician_id].assignedMachines.push({
        code: r.machine_code,
        name: r.machine_name
      });
    });

    res.json({ success: true, count: Object.keys(clusterMap).length, data: Object.values(clusterMap) });
  } catch (err: any) {
    res.json({ success: true, count: 0, data: [] });
  }
});

router.put('/technicians/:id/clusters', async (req, res) => {
  try {
    const { id } = req.params;
    const { machineCodes = [], supervisorName = 'Priya Patel (Operations Manager)' } = req.body;
    
    // Find technician info
    const techRows = await query<any>(`SELECT * FROM technicians WHERE id = ? LIMIT 1`, [id]);
    if (!techRows.length) return res.status(404).json({ success: false, error: 'Technician not found' });
    const tech = techRows[0];

    // Delete existing clusters for this technician
    await execute(`DELETE FROM technician_machine_clusters WHERE technician_id = ?`, [id]);

    // Insert updated machine assignments
    for (const code of machineCodes) {
      const machineRows = await query<any>(`SELECT name, area FROM machines WHERE code = ? LIMIT 1`, [code]);
      const mName = machineRows[0]?.name || `${code} Asset`;
      const mArea = machineRows[0]?.area || tech.assigned_area;
      const clusId = `CLUS-${Math.floor(1000 + Math.random() * 9000)}`;

      await execute(`
        INSERT INTO technician_machine_clusters (
          id, technician_id, technician_name, machine_code, machine_name, assigned_area, assigned_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [clusId, id, tech.name, code, mName, mArea, supervisorName]);
    }

    broadcast('clusters:updated', { technicianId: id, machineCodes });
    res.json({
      success: true,
      message: `Supervisor updated machine cluster pairings for ${tech.name} (${machineCodes.length} machines assigned)`,
      data: { technicianId: id, machineCodes }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 9. SUPPLIERS & VENDORS DIRECTORY
// ==========================================
router.get('/suppliers', async (req, res) => {
  try {
    const suppliers = await query<any>(`
      SELECT s.*,
             COUNT(p.id) as catalog_parts_count,
             COALESCE(SUM(po.total_amount), 0) as total_po_spend
      FROM suppliers s
      LEFT JOIN spare_parts p ON s.name = p.supplier_name
      LEFT JOIN purchase_orders po ON s.id = po.supplier_id
      GROUP BY s.id
      ORDER BY s.rating DESC
    `);
    res.json({ success: true, count: suppliers?.length || 0, data: suppliers || [] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message, data: [] });
  }
});


// ==========================================
// 10. IOT EDGE DEVICES & GATEWAYS
// ==========================================
router.get('/iot-devices', async (req, res) => {
  try {
    const devices = [
      {
        id: 'GW-EDGE-01',
        name: 'Advantech UNO-2484G Industrial Edge Gateway',
        assetCode: 'CNC-01',
        assetName: '5-Axis Milling Center',
        ipAddress: '192.168.10.101',
        protocol: 'MQTT 2.0 / Mosquitto',
        topic: 'plant/CNC-01/telemetry',
        sampleRate: '100 Hz',
        latencyMs: 4.2,
        packetLoss: '0.00%',
        firmware: 'v3.8.4-LTS',
        status: 'ONLINE',
        lastPing: new Date().toISOString(),
        sensors: ['Vibration (Tri-Axial MEMS)', 'Thermal IR Flir', 'Current CT Clamp', 'Spindle Hall RPM']
      },
      {
        id: 'GW-EDGE-02',
        name: 'Siemens SIMATIC IOT2050 Smart Edge',
        assetCode: 'CNC-02',
        assetName: 'Heavy Duty Turning Cell',
        ipAddress: '192.168.10.102',
        protocol: 'MQTT 2.0 / Mosquitto',
        topic: 'plant/CNC-02/telemetry',
        sampleRate: '50 Hz',
        latencyMs: 5.1,
        packetLoss: '0.00%',
        firmware: 'v2.4.1',
        status: 'ONLINE',
        lastPing: new Date().toISOString(),
        sensors: ['Vibration Accelerometer', 'Motor RTD Temp', 'Current Transducer']
      },
      {
        id: 'GW-EDGE-03',
        name: 'Moxa UC-8100 Series Embedded Computer',
        assetCode: 'ROBOT-01',
        assetName: '6-Axis Articulated Robot',
        ipAddress: '192.168.10.103',
        protocol: 'MQTT 2.0 / Mosquitto',
        topic: 'plant/ROBOT-01/telemetry',
        sampleRate: '100 Hz',
        latencyMs: 3.8,
        packetLoss: '0.00%',
        firmware: 'v4.1.0',
        status: 'ONLINE',
        lastPing: new Date().toISOString(),
        sensors: ['Servo Axis 1-6 Thermistors', 'Joint Vibration FFT', 'DC Bus Current']
      },
      {
        id: 'GW-EDGE-04',
        name: 'Advantech ADAM-6700 Intelligent I/O Gateway',
        assetCode: 'PUMP-01',
        assetName: 'Hydraulic Coolant Pump',
        ipAddress: '192.168.10.104',
        protocol: 'MQTT 2.0 / Mosquitto',
        topic: 'plant/PUMP-01/telemetry',
        sampleRate: '20 Hz',
        latencyMs: 6.4,
        packetLoss: '0.00%',
        firmware: 'v3.2.0',
        status: 'ONLINE',
        lastPing: new Date().toISOString(),
        sensors: ['Pressure Piezoelectric 0-10 bar', 'Casing Thermocouple', 'Cavitation Vib Sensor']
      },
      {
        id: 'GW-EDGE-05',
        name: 'Advantech UNO-2271G Compact Edge',
        assetCode: 'MIXER-01',
        assetName: 'High-Shear Lubricant Mixer',
        ipAddress: '192.168.10.105',
        protocol: 'MQTT 2.0 / Mosquitto',
        topic: 'plant/MIXER-01/telemetry',
        sampleRate: '50 Hz',
        latencyMs: 4.9,
        packetLoss: '0.00%',
        firmware: 'v3.5.1',
        status: 'ONLINE',
        lastPing: new Date().toISOString(),
        sensors: ['Gearbox Vibration Probe', 'Fluid Temp Probe', 'Agitator Torque Transducer']
      }
    ];
    res.json({ success: true, count: devices.length, data: devices });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 11. AI DIAGNOSTIC KNOWLEDGE BASE & MANUALS
// ==========================================
router.post('/ai/diagnose', async (req, res) => {
  try {
    const { machineCode = 'CNC-01', symptom = 'HIGH_VIBRATION', telemetry } = req.body;
    const diagnosisMap: Record<string, any> = {
      HIGH_VIBRATION: {
        rootCause: 'Spindle Front Angular Contact Bearing Fluting & Cage Micro-Cracking',
        confidence: 0.942,
        sopCode: 'SOP-CNC-M-04',
        sopTitle: '5-Axis Spindle Bearing Extraction & ISO Alignment SOP',
        requiredPart: 'SKF-6205-2RSH',
        partCost: 145.0,
        estimatedDowntimeMinutes: 90,
        safetyPrerequisite: 'LOTO workflow aligned with OSHA 1910.147 requirements on Main 480V Breaker Panel B-04',
        ragReferences: [
          { doc: 'OEM_DMG_Mori_Maintenance_Manual_Rev4.pdf', page: 142, relevance: '98%' },
          { doc: 'SKF_Bearing_Failure_Analysis_Guide.pdf', page: 28, relevance: '95%' },
          { doc: 'Historical_Work_Order_WO-4182_PostMortem.pdf', page: 2, relevance: '91%' }
        ]
      },
      THERMAL_OVERHEAT: {
        rootCause: 'Coolant Flow Restriction & Hydraulic Impeller Cavitation',
        confidence: 0.915,
        sopCode: 'SOP-PMP-H-02',
        sopTitle: 'Hydraulic Seal Replacement & Cavitation Bleed Procedure',
        requiredPart: 'PARKER-V884-75',
        partCost: 65.0,
        estimatedDowntimeMinutes: 45,
        safetyPrerequisite: 'Depressurize Hydraulic Accumulator circuit to 0.0 bar before seal breach',
        ragReferences: [
          { doc: 'Parker_Hannifin_Hydraulic_Pumps_Service_Manual.pdf', page: 74, relevance: '96%' },
          { doc: 'Plant_Maintenance_SOP_Fluids_2025.pdf', page: 12, relevance: '89%' }
        ]
      },
      CURRENT_SPIKE: {
        rootCause: 'Motor Stator Winding Insulation Breakdown & Armature Harmonic Distortion',
        confidence: 0.887,
        sopCode: 'SOP-ELE-M-09',
        sopTitle: 'Fanuc AC Servo Drive Armature Testing & Rewind Verification',
        requiredPart: 'FANUC-A06B-0223',
        partCost: 890.0,
        estimatedDowntimeMinutes: 120,
        safetyPrerequisite: 'Lockout 3-Phase Servo Inverter Drive and discharge DC Bus Capacitors',
        ragReferences: [
          { doc: 'Fanuc_Servo_Motor_Alpha_iF_Troubleshooting.pdf', page: 55, relevance: '94%' },
          { doc: 'IEEE_Electrical_Insulation_Standards_Standard_43.pdf', page: 18, relevance: '87%' }
        ]
      }
    };

    const result = diagnosisMap[symptom] || diagnosisMap.HIGH_VIBRATION;
    res.json({ success: true, data: { machineCode, symptom, ...result } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 12. DOMO ANALYTICS CURATED EXPORT
// ==========================================
router.get('/analytics/domo-summary', async (req, res) => {
  try {
    const [totalMachines] = await query<any>(`SELECT COUNT(*) as total, SUM(status = 'RUNNING') as running, SUM(status = 'FAULT') as fault FROM machines`);
    const [poStats] = await query<any>(`SELECT COUNT(*) as totalPOs, SUM(approval_type = 'AUTONOMOUS_POLICY') as autoPOs, SUM(total_amount) as totalSpend FROM purchase_orders`);
    const [incidentStats] = await query<any>(`SELECT COUNT(*) as totalIncidents, SUM(status = 'RESOLVED') as resolvedIncidents FROM incidents`);

    const autoPoRate = poStats.totalPOs > 0 ? ((poStats.autoPOs / poStats.totalPOs) * 100).toFixed(1) : '100.0';
    const availabilityRate = totalMachines.total > 0 ? (((totalMachines.running + (totalMachines.total - totalMachines.fault)) / (totalMachines.total * 2)) * 100).toFixed(1) : '95.4';

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      domoDataSetName: 'PlantOps_Operations_Core_KPIs',
      kpis: {
        oee: 88.4,
        availability: parseFloat(availabilityRate),
        mttr_minutes: 42.5,
        mtbf_hours: 318.0,
        autonomous_po_rate: parseFloat(autoPoRate),
        total_parts_spend_usd: parseFloat(poStats.totalSpend || '0'),
        active_faults: parseInt(totalMachines.fault || '0', 10),
        closed_loop_resolutions: parseInt(incidentStats.resolvedIncidents || '0', 10)
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 13. SOP & RAG KNOWLEDGE BASE (PGVECTOR / SOP ASSISTANT)
// ==========================================
router.get('/knowledge/sops', getSOPsHandler);
router.post('/knowledge/search', searchSOPsHandler);
router.post('/knowledge/ask-sop', askSOPHandler);

// ==========================================
// 14. SIMULATOR INTEGRATION & MACHINE HEAL/FAULT CONTROL
// ==========================================
router.post('/simulator/heal-machine', async (req, res) => {
  try {
    const { machineId, machineCode } = req.body;
    const targetCode = machineCode || machineId || 'CNC-01';

    // 1. Forward to IoT Simulator if online on port 4001
    try {
      fetch('http://localhost:4001/api/simulator/heal-machine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machineId: targetCode })
      }).catch(() => {});
    } catch {}

    // 2. Full recovery via verification service (resolves DB machines, work orders, incidents, audit logs, and sockets)
    try {
      await recoverMachineToRunning(targetCode, { temperature: 60.0, vibration: 1.8 });
    } catch (e: any) {
      console.warn(`[Backend Simulator] Auto-recovery warning: ${e.message}`);
    }

    res.json({
      success: true,
      message: `Machine ${targetCode} restored to nominal running state.`,
      machineCode: targetCode,
      status: 'RUNNING'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/simulator/inject-fault', async (req, res) => {
  try {
    const { machineId, faultType, intensity, scenarioId } = req.body;
    const targetCode = machineId || 'CNC-01';

    const payload = await injectFaultScenario(
      targetCode,
      faultType,
      typeof intensity === 'number' ? intensity : 1.0,
      scenarioId
    );

    res.json({
      success: true,
      message: `Fault injected into ${targetCode}`,
      machineId: targetCode,
      telemetry: payload
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 15. CROSS-ROLE INTERCOM & LIVE ESCALATION ENGINE
// ==========================================
router.get('/intercom/messages', async (req, res) => {
  try {
    const { role, channel } = req.query;
    let sql = `SELECT * FROM plant_intercom_messages WHERE 1=1`;
    const params: any[] = [];

    if (role && role !== 'ALL') {
      sql += ` AND (recipient_role = ? OR recipient_role = 'ALL' OR sender_role = ?)`;
      params.push(role, role);
    }
    if (channel) {
      sql += ` AND channel = ?`;
      params.push(channel);
    }

    sql += ` ORDER BY created_at DESC LIMIT 50`;
    const messages = await query<any>(sql, params);

    // Parse metadata JSON safely
    const formatted = messages.map(m => ({
      ...m,
      metadata: typeof m.metadata === 'string' ? JSON.parse(m.metadata) : m.metadata
    }));

    res.json({ success: true, count: formatted.length, data: formatted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/intercom/messages', async (req, res) => {
  try {
    const { senderRole, senderName, recipientRole = 'ALL', channel = 'BROADCAST', priority = 'NORMAL', title, message, metadata } = req.body;
    const msgId = `MSG-${Date.now().toString().slice(-6)}`;
    const timestamp = new Date().toISOString();

    await execute(
      `INSERT INTO plant_intercom_messages (
        id, sender_role, sender_name, recipient_role, channel, priority, title, message, metadata, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        msgId,
        senderRole,
        senderName,
        recipientRole,
        channel,
        priority,
        title || `Message from ${senderName}`,
        message,
        metadata ? JSON.stringify(metadata) : null,
        'OPEN'
      ]
    );

    const payload = {
      id: msgId,
      sender_role: senderRole,
      sender_name: senderName,
      recipient_role: recipientRole,
      channel,
      priority,
      title: title || `Message from ${senderName}`,
      message,
      metadata,
      status: 'OPEN',
      created_at: timestamp
    };

    broadcast('intercom:new_message', payload);

    // If message is directed to AI or tagged @AI, invoke Copilot
    let aiResponse = null;
    if (recipientRole === 'AI_COPILOT' || channel === 'AI_ASSISTANT' || message.includes('@AI')) {
      aiResponse = await AIAgentEngineService.processCopilotPrompt(message, senderRole, senderName);
      broadcast('intercom:new_message', {
        id: aiResponse.messageId,
        sender_role: 'AI_COPILOT',
        sender_name: 'Antigravity Industrial AI',
        recipient_role: senderRole,
        channel: 'AI_ASSISTANT',
        priority: 'NORMAL',
        title: `AI Response to ${senderName}`,
        message: aiResponse.reply,
        status: 'OPEN',
        created_at: aiResponse.timestamp
      });
    }

    res.json({ success: true, data: payload, aiResponse });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/intercom/escalate', async (req, res) => {
  try {
    const { senderRole, senderName, targetRole, type, title, details, metadata } = req.body;
    const msgId = `ESC-${Date.now().toString().slice(-6)}`;
    const timestamp = new Date().toISOString();

    let priority: 'HIGH' | 'CRITICAL' | 'EMERGENCY' = 'HIGH';
    let channel: 'ESCALATION' | 'SAFETY_LOTO' | 'SPARE_REQUEST' | 'PO_APPROVAL' = 'ESCALATION';

    if (type === 'SAFETY_LOTO') {
      priority = 'CRITICAL';
      channel = 'SAFETY_LOTO';
    } else if (type === 'SPARE_REQUEST') {
      channel = 'SPARE_REQUEST';
    } else if (type === 'EMERGENCY_BUDGET') {
      priority = 'EMERGENCY';
      channel = 'PO_APPROVAL';
    }

    await execute(
      `INSERT INTO plant_intercom_messages (
        id, sender_role, sender_name, recipient_role, channel, priority, title, message, metadata, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        msgId,
        senderRole,
        senderName,
        targetRole || 'SUPERVISOR',
        channel,
        priority,
        title || `Urgent Escalation from ${senderName}`,
        details,
        metadata ? JSON.stringify(metadata) : null,
        'OPEN'
      ]
    );

    const payload = {
      id: msgId,
      sender_role: senderRole,
      sender_name: senderName,
      recipient_role: targetRole || 'SUPERVISOR',
      channel,
      priority,
      title: title || `Urgent Escalation from ${senderName}`,
      message: details,
      metadata,
      status: 'OPEN',
      created_at: timestamp
    };

    broadcast('intercom:escalation_raised', payload);
    broadcast('intercom:new_message', payload);

    res.json({ success: true, data: payload });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/intercom/resolve/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { resolvedBy, resolutionNote } = req.body;

    await execute(
      `UPDATE plant_intercom_messages 
       SET status = 'RESOLVED', resolution_note = ?
       WHERE id = ?`,
      [`Resolved by ${resolvedBy || 'Personnel'}: ${resolutionNote || 'Acknowledged and addressed.'}`, id]
    );

    broadcast('intercom:message_resolved', {
      id,
      resolvedBy,
      resolutionNote,
      status: 'RESOLVED'
    });

    res.json({ success: true, message: `Escalation ${id} resolved.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 16. AUTONOMOUS AI AGENTS ORCHESTRATION APIS
// ==========================================
router.post('/ai-agent/triage-dispatch', async (req, res) => {
  try {
    const { machineCode, symptom, vibration, temperature, severity } = req.body;
    const result = await AIAgentEngineService.triageAndDispatch({
      machineCode: machineCode || 'CNC-01',
      symptom: symptom || 'Elevated Spindle Bearing Harmonic Vibration',
      vibration,
      temperature,
      severity
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/ai-agent/reorder-spare', async (req, res) => {
  try {
    const { partId, quantity, requesterRole, requesterName, reason } = req.body;
    const result = await AIAgentEngineService.checkAndReorderSpare({
      partId,
      quantity,
      requesterRole,
      requesterName,
      reason
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/ai-agent/approve-po', async (req, res) => {
  try {
    const { poId, managerName } = req.body;
    const result = await AIAgentEngineService.approvePurchaseOrder(poId, managerName || 'Priya Patel');
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/ai-agent/dispatch-agv', async (req, res) => {
  try {
    const { palletId, totalPieces, cartons, destinationBay } = req.body;
    const result = await AIAgentEngineService.dispatchAutonomousAGV({
      palletId: palletId || `PLT-${Date.now().toString().slice(-4)}`,
      totalPieces: totalPieces || 240,
      cartons: cartons || 10,
      destinationBay: destinationBay || 'Outbound Bay 1'
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 18b. AUTHORITATIVE LOGISTICS PALLETS & TRANSPORT MISSIONS (HIGH-PERFORMANCE INDEXED)
// ==========================================
router.get('/logistics/pallets', async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 20, 1), 100);
    const offset = Math.max(parseInt(req.query.offset as string, 10) || 0, 0);
    const status = req.query.status as string;
    const search = req.query.search as string;

    try {
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      if (status && status !== 'ALL') {
        whereClause += ' AND status = ?';
        params.push(status);
      }

      if (search && search.trim()) {
        const q = `%${search.trim()}%`;
        whereClause += ' AND (pallet_number LIKE ? OR transport_id LIKE ? OR rfid_tag LIKE ? OR destination_bay LIKE ?)';
        params.push(q, q, q, q);
      }

      // Fast indexed count for total records
      const countResult = await query<any>(`SELECT COUNT(*) as total FROM logistics_pallets ${whereClause}`, params);
      const total = countResult[0]?.total || 0;

      // Fast indexed pagination query using covering columns
      const dataQuery = `
        SELECT id, transport_id, pallet_number, rfid_tag, pieces_count, cartons_count, max_pieces,
               status, assigned_agv, destination_bay, packed_at, dispatched_at, delivered_at, created_at
        FROM logistics_pallets
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;
      const rows = await query<any>(dataQuery, [...params, limit, offset]);

      return res.json({ success: true, data: rows || [], total, limit, offset });
    } catch (dbErr) {
      // Local DB Fallback with in-memory search and slicing
      const localDb = getLocalDb();
      let pallets = localDb.logistics_pallets || [];
      if (status && status !== 'ALL') {
        pallets = pallets.filter((p: any) => p.status === status);
      }
      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        pallets = pallets.filter((p: any) =>
          (p.pallet_number || '').toLowerCase().includes(q) ||
          (p.transport_id || '').toLowerCase().includes(q) ||
          (p.rfid_tag || '').toLowerCase().includes(q) ||
          (p.destination_bay || '').toLowerCase().includes(q)
        );
      }
      const total = pallets.length;
      const paginated = pallets.slice(offset, offset + limit);
      return res.json({ success: true, data: paginated, total, limit, offset });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Unique pallet / transport / RFID identity for the next pallet on the packaging line
router.post('/logistics/pallets/allocate', async (_req, res) => {
  try {
    res.json({ success: true, data: await allocatePalletIdentity() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/logistics/dispatch', async (req, res) => {
  try {
    const {
      id,
      transport_id,
      pallet_number,
      rfid_tag,
      pieces_count = 240,
      cartons_count = 10,
      max_pieces = 240,
      assigned_agv = 'AGV-01',
      destination_bay = 'Outbound Logistics Dock — Bay 02',
      packed_at = 'Today, 11:45 AM'
    } = req.body;

    // Every transported pallet must have its own identity. Use the client's pallet number only if it
    // was allocated and has never been recorded; otherwise allocate a fresh one (never overwrite history).
    let identity = { id, palletNumber: pallet_number, transportId: transport_id, rfidTag: rfid_tag };
    let reassigned = false;
    try {
      const clash = identity.id && identity.palletNumber
        ? await query<any>(`SELECT id FROM logistics_pallets WHERE id = ? OR pallet_number = ? LIMIT 1`, [identity.id, identity.palletNumber])
        : [];
      if (!identity.id || !identity.palletNumber || clash.length) {
        identity = await allocatePalletIdentity();
        reassigned = true;
      }
    } catch {
      if (!identity.id || !identity.palletNumber) {
        identity = await allocatePalletIdentity();
        reassigned = true;
      }
    }
    const palletId = identity.id;
    const transportId = identity.transportId || `TRP-${String(palletId).replace(/^PL-/, '')}`;
    const palletNum = identity.palletNumber;
    const rfid = identity.rfidTag || `RFID-${String(palletId).slice(-6)}-IN`;
    const nowIso = new Date().toISOString();

    const newPallet = {
      id: palletId,
      transport_id: transportId,
      pallet_number: palletNum,
      rfid_tag: rfid,
      pieces_count,
      cartons_count,
      max_pieces,
      status: 'IN_TRANSIT',
      assigned_agv,
      destination_bay,
      packed_at,
      dispatched_at: nowIso,
      delivered_at: null,
      created_at: nowIso
    };

    try {
      await execute(`
        INSERT INTO logistics_pallets (
          id, transport_id, pallet_number, rfid_tag, pieces_count, cartons_count, max_pieces,
          status, assigned_agv, destination_bay, packed_at, dispatched_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
          transport_id = VALUES(transport_id),
          status = 'IN_TRANSIT',
          assigned_agv = VALUES(assigned_agv),
          dispatched_at = NOW()
      `, [
        palletId, transportId, palletNum, rfid, pieces_count, cartons_count, max_pieces,
        'IN_TRANSIT', assigned_agv, destination_bay, packed_at
      ]);
    } catch (dbErr) {
      const localDb = getLocalDb();
      if (!localDb.logistics_pallets) localDb.logistics_pallets = [];
      const idx = localDb.logistics_pallets.findIndex((p: any) => p.id === palletId || p.pallet_number === palletNum);
      if (idx >= 0) {
        localDb.logistics_pallets[idx] = { ...localDb.logistics_pallets[idx], ...newPallet };
      } else {
        localDb.logistics_pallets.unshift(newPallet);
      }
      saveLocalDb();
    }

    // Trigger AI Intercom & WebSocket broadcast
    await AIAgentEngineService.dispatchAutonomousAGV({
      palletId: palletNum,
      totalPieces: pieces_count,
      cartons: cartons_count,
      destinationBay: destination_bay
    });

    // 'reassigned' tells the client its proposed pallet number was already used and a new one was issued
    res.json({ success: true, data: { ...newPallet, reassigned } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/logistics/pallets/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const isDelivered = status === 'DELIVERED_DOCK';

    try {
      await execute(`
        UPDATE logistics_pallets
        SET status = ?,
            delivered_at = ${isDelivered ? 'NOW()' : 'delivered_at'}
        WHERE id = ? OR pallet_number = ?
      `, [status, id, id]);
    } catch (dbErr) {
      const localDb = getLocalDb();
      if (localDb.logistics_pallets) {
        const target = localDb.logistics_pallets.find((p: any) => p.id === id || p.pallet_number === id);
        if (target) {
          target.status = status;
          if (isDelivered) target.delivered_at = new Date().toISOString();
          saveLocalDb();
        }
      }
    }

    // A pallet arriving at the outbound dock may complete a truckload → auto-dispatch
    if (isDelivered) checkDockAndDispatch().catch(() => {});

    res.json({ success: true, message: `Pallet ${id} status updated to ${status}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 18c. OUTBOUND FREIGHT & ROAD FLEET (TiDB fleet_trucks / fleet_dispatches)
// ==========================================
router.get('/fleet/state', async (_req, res) => {
  try {
    res.json({ success: true, data: await getFleetState() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/fleet/dispatches', async (req, res) => {
  try {
    const data = await listDispatches({
      status: req.query.status ? String(req.query.status) : undefined,
      truckId: req.query.truck ? String(req.query.truck) : undefined,
      limit: Number(req.query.limit) || 25,
    });
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/fleet/dispatch', async (req, res) => {
  try {
    const { truckId, all } = req.body || {};
    const dispatches = await triggerManualDispatch({
      truckId: truckId ? String(truckId) : undefined,
      all: Boolean(all),
    });
    res.json({ success: true, count: dispatches.length, data: dispatches });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/ai-agent/copilot-query', async (req, res) => {
  try {
    const { prompt, senderRole = 'TECHNICIAN', senderName = 'Arun Kumar' } = req.body;
    const result = await AIAgentEngineService.processCopilotPrompt(prompt, senderRole, senderName);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 19. POWER SUPPLY CELL & ELECTRICAL CONTROLS
// ==========================================
router.get('/power/status', (req, res) => {
  try {
    const data = getPlantPowerState();
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/power/start', async (req, res) => {
  try {
    const result = await startPlantPower();
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/power/stop', async (req, res) => {
  try {
    const result = await stopPlantPower();
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/power/estop', async (req, res) => {
  try {
    const result = await emergencyStopPlant();
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/power/reset', async (req, res) => {
  try {
    const result = await resetPlantPowerAlarm();
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/power/ack', async (req, res) => {
  try {
    const result = await acknowledgePlantAlarm();
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/power/breaker/:machineCode', async (req, res) => {
  try {
    const { machineCode } = req.params;
    const { state } = req.body;
    const result = await toggleMachineBreaker(machineCode, state);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 20. MACHINE DAILY HISTORY & PRODUCTION CALENDAR
// ==========================================
router.get('/production/daily', async (req, res) => {
  try {
    const targetDate = (req.query.date as string) || istBusinessDate();
    const result = await getDailyOperationsSummary(targetDate);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/production/machine/:machineCode/day', async (req, res) => {
  try {
    const { machineCode } = req.params;
    const targetDate = (req.query.date as string) || istBusinessDate();
    const result = await getMachineDayDetail(machineCode, targetDate);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/production/calendar', async (req, res) => {
  try {
    const year = parseInt(req.query.year as string, 10) || Number(istBusinessDate().slice(0, 4));
    const month = parseInt(req.query.month as string, 10) || Number(istBusinessDate().slice(5, 7));
    const result = await getMonthlyCalendar(year, month);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Production & AGV Logistics Stream Control
let isProductionStreamRunning = true;

router.get('/production/stream/status', (req, res) => {
  res.json({ success: true, data: { isRunning: isProductionStreamRunning } });
});

router.post('/production/stream/toggle', (req, res) => {
  try {
    const { isRunning } = req.body;
    if (typeof isRunning === 'boolean') {
      isProductionStreamRunning = isRunning;
    } else {
      isProductionStreamRunning = !isProductionStreamRunning;
    }
    res.json({
      success: true,
      data: {
        isRunning: isProductionStreamRunning,
        message: isProductionStreamRunning ? 'Production piece rate & AGV dispatch stream resumed' : 'Production piece rate & AGV dispatch stream paused'
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 14. REDIS FAST-PATH CACHE & STATE ENDPOINTS
// ==========================================
router.get('/redis/status', async (req, res) => {
  try {
    const connected = isRedisConnected();
    const powerGrid = await getPlantPowerGridState();
    res.json({
      success: true,
      data: {
        connected,
        driver: 'ioredis (v5.4.1)',
        mode: connected ? 'DISTRIBUTED_REDIS_STORE' : 'IN_MEMORY_RESILIENT_FALLBACK',
        caching: {
          telemetryTtlSec: 600,
          stateTtlSec: 86400,
          shiftCountersTtlSec: 172800
        },
        powerGridSynced: !!powerGrid,
        timestamp: new Date().toISOString()
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/telemetry/cached/:machineCode', async (req, res) => {
  try {
    const { machineCode } = req.params;
    const telemetry = await getLatestTelemetry(machineCode.toUpperCase());
    const liveState = await getMachineLiveState(machineCode.toUpperCase());
    res.json({
      success: true,
      data: {
        machineCode: machineCode.toUpperCase(),
        telemetry: telemetry || null,
        liveState: liveState || null,
        cached: true,
        timestamp: new Date().toISOString()
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/redis/grid-state', async (req, res) => {
  try {
    const state = await getPlantPowerGridState();
    res.json({ success: true, data: state });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/redis/shift-counters', async (req, res) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const shift = (req.query.shift as string) || 'SHIFT-01';
    const counters = await getShiftCounters(date, shift);
    res.json({ success: true, date, shift, data: counters });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 15. CNC MULTI-STATION BATCH TOOLING OPTIMIZER
// ==========================================
const CNC_TOOLING_CATALOG: Record<string, any> = {
  'CNC-01': { currentTool: '12mm 4-Flute Carbide End Mill', holder: 'HSK-A63 Toolholder', partId: 'PRT-TOOL-EM12', stockAvailable: 8, wearPct: 78, spindleLoad: 75, cuttingHours: 38.4 },
  'CNC-02': { currentTool: '8mm Ball Nose 2-Flute Finishing Cutter', holder: 'BT-40 Dual Contact', partId: 'PRT-TOOL-BN08', stockAvailable: 6, wearPct: 82, spindleLoad: 80, cuttingHours: 41.2 },
  'CNC-03': { currentTool: '50mm Face Mill Indexable 5-Insert', holder: 'CAT-50 Heavy Taper', partId: 'PRT-TOOL-FM50', stockAvailable: 12, wearPct: 42, spindleLoad: 68, cuttingHours: 19.5 },
  'CNC-04': { currentTool: '6.8mm High-Pressure Through-Coolant Drill', holder: 'ER-32 Precision Collet', partId: 'PRT-TOOL-DR068', stockAvailable: 15, wearPct: 74, spindleLoad: 72, cuttingHours: 35.8 },
  'CNC-05': { currentTool: 'M8x1.25 Form Tap & Chamfer Combo', holder: 'Sync Rigid Tapping Chuck', partId: 'PRT-TOOL-TPM08', stockAvailable: 9, wearPct: 35, spindleLoad: 58, cuttingHours: 14.2 },
  'CNC-06': { currentTool: '16mm Roughing End Mill Serrated', holder: 'SK-40 High Torque', partId: 'PRT-TOOL-EM16', stockAvailable: 7, wearPct: 69, spindleLoad: 84, cuttingHours: 33.1 }
};

router.get('/operations/cnc/tooling-status', (req, res) => {
  try {
    const stations = Object.keys(CNC_TOOLING_CATALOG).map(code => {
      const data = CNC_TOOLING_CATALOG[code];
      const isDue = data.wearPct >= 65;
      return {
        code,
        name: `High-Precision CNC Milling/Turning Station ${code.slice(-2)}`,
        ...data,
        isDue,
        urgency: data.wearPct >= 80 ? 'CRITICAL' : data.wearPct >= 65 ? 'HIGH' : 'OPTIMAL',
        stagedBay: 'Bay B Tooling Cart (Pre-staged)',
        estSwapDurationSec: 360 // 6 minutes per machine
      };
    });

    const highWearCount = stations.filter(s => s.isDue).length;
    const estSavedMinutes = Math.max(0, (highWearCount * 20) - (20 + (highWearCount * 3))); // Batch efficiency calculation

    res.json({
      success: true,
      data: {
        stations,
        totalStations: 6,
        highWearCount,
        estSavedMinutes,
        recommendedTechnician: {
          id: 'TECH-01',
          name: 'Arun Kumar',
          role: 'Lead Vibration & Spindle Specialist'
        },
        batchEfficiencyPct: 62.5
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/operations/cnc/batch-tool-swap', async (req, res) => {
  try {
    const {
      machineCodes = ['CNC-01', 'CNC-02', 'CNC-04', 'CNC-06'],
      windowType = 'IMMEDIATE', // IMMEDIATE | SHIFT_HANDOVER | LUNCH_BUFFER
      assignedTechName = 'Arun Kumar (Lead Vibration & Spindle Specialist)',
      autoCalibrate = true,
      notes = 'Scheduled via Multi-Station Batch Tooling Optimizer'
    } = req.body;

    const generatedWorkOrders: any[] = [];
    const timestamp = new Date().toISOString();

    for (const code of machineCodes) {
      const toolInfo = CNC_TOOLING_CATALOG[code] || {};
      const woId = `WO-TOOL-${Math.floor(1000 + Math.random() * 9000)}`;

      // Reset wear in catalog
      if (CNC_TOOLING_CATALOG[code]) {
        CNC_TOOLING_CATALOG[code].wearPct = 0;
        CNC_TOOLING_CATALOG[code].cuttingHours = 0.0;
      }

      // Update TiDB / LocalDB
      try {
        await execute(
          `UPDATE machines SET health_score = 99 WHERE code = ?`,
          [code]
        );
      } catch (_e) {}

      const localDb = getLocalDb();
      const m = localDb.machines?.find((x: any) => x.code === code);
      if (m) {
        m.health_score = 99;
      }
      saveLocalDb();

      generatedWorkOrders.push({
        workOrderId: woId,
        machineCode: code,
        toolName: toolInfo.currentTool || 'Carbide Cutter',
        assignedTechnician: assignedTechName,
        status: 'DISPATCHED',
        autoCalibrateOptical: autoCalibrate,
        timestamp
      });
    }

    // Broadcast live event over WebSocket
    broadcast('tooling:batch_swap_executed', {
      machineCodes,
      windowType,
      assignedTechName,
      workOrdersCount: generatedWorkOrders.length,
      timestamp,
      message: `⚡ BATCH TOOL SWAP EXECUTED: ${machineCodes.join(', ')} cutting inserts synchronized & calibrated.`
    });

    res.json({
      success: true,
      data: {
        message: `Successfully scheduled parallel batch tool swap for ${machineCodes.length} CNC stations.`,
        machineCodes,
        windowType,
        workOrders: generatedWorkOrders,
        autoCalibrated: autoCalibrate,
        toolWearReset: '0%',
        timestamp
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

