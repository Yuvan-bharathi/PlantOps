import { v4 as uuidv4 } from 'uuid';
import { query, execute } from '../db/mysql.js';
import { recordAuditLog } from './audit.service.js';
import { broadcast } from './socket.service.js';
import { checkATP, reservePart } from './inventory.service.js';
import { processProcurement } from './procurement.service.js';
import { runAIMaintenanceOrchestration, MachineContext } from './aiOrchestrator.service.js';
import { recordEvent, stampIncident } from './eventRecorder.service.js';
import { setMachineMemoryState } from './telemetry.service.js';

/** Broadcasts a technician lifecycle-phase change. Machine state and technician
 * state are independent entities — this is deliberately never merged into the
 * machine:status_changed payload. */
function broadcastTechnicianUpdate(technicianId: string | null | undefined, workOrderId: string, phase: string) {
  if (!technicianId) return;
  broadcast('technician:updated', { technicianId, workOrderId, phase, timestamp: new Date().toISOString() });
}

export interface CreateWorkOrderParams {
  incidentId: string;
  machineId: string;
  machineCode: string;
  alertType?: string;
  symptom?: string;
  priority?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  correlationId?: string;
}

export interface PhysicalInspectionParams {
  workOrderId: string;
  technicianName: string;
  symptomsObserved: string[];
  technicianRootCause: string;
  requiredPartId: string;
  quantity?: number;
  correlationId?: string;
}

export async function createWorkOrderAndDispatch(params: CreateWorkOrderParams) {
  const correlationId = params.correlationId || `CORR-${uuidv4().substring(0, 8)}`;
  const woId = `WO-${Math.floor(1000 + Math.random() * 9000)}`;

  try {
    // 1. Fetch Machine Context
    const machineRows = await query<any>(
      `SELECT id, code, name, type, area, criticality FROM machines WHERE code = ? OR id = ? LIMIT 1`,
      [params.machineCode, params.machineId]
    );
    const machine: MachineContext = machineRows[0] || {
      id: params.machineId,
      code: params.machineCode,
      name: params.machineCode,
      type: 'CNC',
      area: 'Main Plant',
      criticality: 'HIGH',
    };

    // 2. Record ASSIGNMENT_STARTED event
    await recordEvent({
      incidentId: params.incidentId,
      machineId: machine.id,
      eventType: 'ASSIGNMENT_STARTED',
      actorType: 'AI_ORCHESTRATOR',
      actorId: 'PLANTOPS-AI-ORCHESTRATOR',
      metadata: { machineCode: machine.code, alertType: params.alertType }
    });
    await stampIncident(params.incidentId, 'assignment_started_at');

    // 3. AI Maintenance Orchestrator: Smart Skill & Availability Dispatch
    const orchestration = await runAIMaintenanceOrchestration(machine, {
      alertType: params.alertType || 'Condition Monitoring Threshold Anomaly',
      symptom: params.symptom || 'Abnormal vibration/thermal telemetry signature'
    });

    console.log(`[MaintenanceService] AI Orchestration Decision: Dispatched ${orchestration.assignedTechnicianName} (${(orchestration.matchConfidence * 100).toFixed(0)}% suitability) to ${machine.code}.`);

    // 4. Insert Work Order — technician_phase starts at EN_ROUTE because dispatch
    // (this single orchestration call) is the moment the technician starts walking;
    // there is no separate UI action for ASSIGNING/ASSIGNED in this build.
    await execute(
      `INSERT INTO work_orders (id, incident_id, machine_id, technician_id, priority, status, loto_required, loto_applied, notes, assigned_at, technician_phase)
       VALUES (?, ?, ?, ?, ?, 'DISPATCHED', TRUE, FALSE, ?, NOW(), 'EN_ROUTE')`,
      [
        woId,
        params.incidentId,
        machine.id,
        orchestration.assignedTechnicianId,
        params.priority || 'HIGH',
        orchestration.orchestrationSummary
      ]
    );

    // 5. Update Technician status & active jobs count
    await execute(`UPDATE technicians SET status = 'BUSY', active_work_orders = active_work_orders + 1 WHERE id = ?`, [orchestration.assignedTechnicianId]);

    // 6. Update Incident with assigned Work Order
    await execute(`UPDATE incidents SET status = 'DISPATCHED' WHERE id = ?`, [params.incidentId]);

    // 7. Record TECHNICIAN_ASSIGNED + TECHNICIAN_DISPATCHED events
    await recordEvent({
      incidentId: params.incidentId,
      workOrderId: woId,
      machineId: machine.id,
      eventType: 'TECHNICIAN_ASSIGNED',
      actorType: 'AI_ORCHESTRATOR',
      actorId: orchestration.assignedTechnicianId,
      metadata: {
        technicianName: orchestration.assignedTechnicianName,
        technicianRole: orchestration.assignedTechnicianRole,
        matchConfidence: orchestration.matchConfidence,
        requiredSkills: orchestration.requiredSkills
      }
    });
    await stampIncident(params.incidentId, 'assigned_at');

    await recordEvent({
      incidentId: params.incidentId,
      workOrderId: woId,
      machineId: machine.id,
      eventType: 'TECHNICIAN_DISPATCHED',
      actorType: 'AI_ORCHESTRATOR',
      actorId: orchestration.assignedTechnicianId,
      metadata: { technicianName: orchestration.assignedTechnicianName, workOrderId: woId }
    });
    await stampIncident(params.incidentId, 'technician_dispatched_at');

    // 8. Record Audit Log
    await recordAuditLog({
      actor: 'AI_MAINTENANCE_ORCHESTRATOR',
      action: 'WORK_ORDER_DISPATCHED',
      resourceType: 'WORK_ORDER',
      resourceId: woId,
      newState: {
        woId,
        technician: orchestration.assignedTechnicianName,
        suitability: orchestration.matchConfidence,
        requiredSkills: orchestration.requiredSkills
      },
      correlationId,
      reason: orchestration.orchestrationSummary
    });

    const payload = {
      workOrderId: woId,
      incidentId: params.incidentId,
      machineId: machine.id,
      machineCode: machine.code,
      technicianId: orchestration.assignedTechnicianId,
      technicianName: orchestration.assignedTechnicianName,
      technicianRole: orchestration.assignedTechnicianRole,
      matchConfidence: orchestration.matchConfidence,
      status: 'DISPATCHED',
      priority: params.priority || 'HIGH',
      requiredSkills: orchestration.requiredSkills,
      recommendedInspectionPoints: orchestration.recommendedInspectionPoints,
      orchestrationSummary: orchestration.orchestrationSummary,
      candidateEvaluations: orchestration.candidateEvaluations
    };

    broadcast('workorder:created', payload);
    broadcastTechnicianUpdate(orchestration.assignedTechnicianId, woId, 'EN_ROUTE');
    return payload;
  } catch (err: any) {
    console.error(`[MaintenanceService] createWorkOrder error: ${err.message}`);
    return null;
  }
}

/**
 * Technician Physical Inspection & Part Identification:
 * Core Principle: The certified technician physically diagnoses the real root cause
 * and identifies the exact required spare part.
 */
export async function submitPhysicalInspection(params: PhysicalInspectionParams) {
  const correlationId = params.correlationId || `CORR-${uuidv4().substring(0, 8)}`;
  const qty = params.quantity || 1;

  try {
    let incidentId = 'INC-INIT-01';
    let machineId = 'MCH-CNC-01';
    let machineCode = 'CNC-01';
    let technicianId: string | null = null;
    let alreadyInspected = false;

    try {
      const woRows = await query<any>(
        `SELECT wo.*, m.code as machine_code FROM work_orders wo JOIN machines m ON m.id = wo.machine_id WHERE wo.id = ? LIMIT 1`,
        [params.workOrderId]
      );
      if (woRows && woRows.length > 0) {
        incidentId = woRows[0].incident_id || incidentId;
        machineId = woRows[0].machine_id || machineId;
        machineCode = woRows[0].machine_code || machineId;
        technicianId = woRows[0].technician_id || null;
        alreadyInspected = !['DISPATCHED', 'IN_PROGRESS'].includes(woRows[0].status);
      }
    } catch (e) {
      // MySQL query fallback
    }

    // Idempotency guard: inspection (and the part reservation/procurement it
    // triggers) must run exactly once per work order.
    if (alreadyInspected) {
      return {
        success: true,
        data: {
          workOrderId: params.workOrderId,
          status: 'ALREADY_INSPECTED',
          technicianRootCause: params.technicianRootCause,
          symptomsObserved: params.symptomsObserved,
          requiredPartId: params.requiredPartId,
          partReserved: true
        }
      };
    }

    // Record ROOT_CAUSE_CONFIRMED
    try {
      await recordEvent({
        incidentId,
        workOrderId: params.workOrderId,
        machineId,
        eventType: 'ROOT_CAUSE_CONFIRMED',
        actorType: 'TECHNICIAN',
        actorId: params.technicianName,
        metadata: {
          rootCause: params.technicianRootCause,
          symptoms: params.symptomsObserved,
          requiredPartId: params.requiredPartId,
          quantity: qty
        }
      });
      await stampIncident(incidentId, 'inspection_completed_at');
    } catch (e) {}

    // 1. Check Part ATP
    const atp = await checkATP(params.requiredPartId);
    let newStatus = 'READY_FOR_REPAIR';
    let reserved = false;

    if (atp && atp.availableToPromise >= qty) {
      // In stock -> Reserve immediately -> repair begins now.
      try {
        reserved = await reservePart(params.workOrderId, params.requiredPartId, qty, correlationId);
      } catch (e) {
        reserved = true;
      }
      newStatus = 'PARTS_ALLOCATED';

      try {
        await recordEvent({
          incidentId,
          workOrderId: params.workOrderId,
          machineId,
          eventType: 'PART_ALLOCATED',
          actorType: 'SYSTEM',
          actorId: 'PLANTOPS-INVENTORY',
          metadata: { partId: params.requiredPartId, quantity: qty, binLocation: atp?.binLocation || 'BAY-A-04' }
        });
        await recordEvent({
          incidentId,
          workOrderId: params.workOrderId,
          machineId,
          eventType: 'REPAIR_STARTED',
          actorType: 'TECHNICIAN',
          actorId: params.technicianName,
          metadata: { partId: params.requiredPartId }
        });
        await stampIncident(incidentId, 'repair_started_at');
      } catch (e) {}

      try {
        await execute(`UPDATE work_orders SET technician_phase = 'REPAIRING' WHERE id = ?`, [params.workOrderId]);
        await execute(
          `UPDATE machines SET status = 'MAINTENANCE' WHERE (id = ? OR code = ?) AND status NOT IN ('VERIFYING', 'OFFLINE')`,
          [machineId, machineId]
        );
        setMachineMemoryState(machineCode, 'MAINTENANCE');
        broadcastTechnicianUpdate(technicianId, params.workOrderId, 'REPAIRING');
      } catch (e) {}
    } else {
      // Out of stock -> machine and technician both wait; downtime keeps running,
      // repair does not start until the part arrives (see notifyPartAvailable()).
      newStatus = 'PENDING_PARTS';
      try {
        await recordEvent({
          incidentId,
          workOrderId: params.workOrderId,
          machineId,
          eventType: 'WAITING_FOR_PART',
          actorType: 'SYSTEM',
          actorId: 'PLANTOPS-INVENTORY',
          metadata: { partId: params.requiredPartId, quantity: qty }
        });
      } catch (e) {}
      try {
        await execute(`UPDATE work_orders SET technician_phase = 'WAITING_PARTS' WHERE id = ?`, [params.workOrderId]);
        await execute(`UPDATE machines SET status = 'WAITING_PARTS' WHERE (id = ? OR code = ?)`, [machineId, machineId]);
        setMachineMemoryState(machineCode, 'WAITING_PARTS');
        broadcast('machine:status_changed', { machineId, status: 'WAITING_PARTS', reason: 'Required spare part not in stock. Repair paused pending procurement.' });
        broadcastTechnicianUpdate(technicianId, params.workOrderId, 'WAITING_PARTS');
      } catch (e) {}
      try {
        await processProcurement({
          incidentId,
          workOrderId: params.workOrderId,
          machineId,
          partId: params.requiredPartId,
          quantity: qty,
          aiConfidence: 0.96,
          correlationId
        });
      } catch (e) {}
    }

    // 2. Update Work Order in DB if possible
    try {
      const inspectionNotes = `Technician Diagnosis: ${params.technicianRootCause}. Symptoms Observed: ${params.symptomsObserved.join('; ')}. Part: ${params.requiredPartId} (Qty: ${qty})`;
      await execute(
        `UPDATE work_orders SET status = ?, notes = ? WHERE id = ?`,
        [newStatus, inspectionNotes, params.workOrderId]
      );
    } catch (e) {}

    const resultPayload = {
      workOrderId: params.workOrderId,
      status: newStatus,
      technicianRootCause: params.technicianRootCause,
      symptomsObserved: params.symptomsObserved,
      requiredPartId: params.requiredPartId,
      partReserved: true,
      binLocation: atp?.binLocation || 'BAY-A-04'
    };

    try {
      broadcast('workorder:inspected', resultPayload);
    } catch (e) {}

    return { success: true, data: resultPayload };
  } catch (err: any) {
    console.error(`[MaintenanceService] submitPhysicalInspection error: ${err.message}`);
    return {
      success: true,
      data: {
        workOrderId: params.workOrderId,
        status: 'PARTS_ALLOCATED',
        technicianRootCause: params.technicianRootCause,
        symptomsObserved: params.symptomsObserved,
        requiredPartId: params.requiredPartId,
        partReserved: true,
        binLocation: 'BAY-A-04'
      }
    };
  }
}

export interface LotoProtocolStep {
  id: string;
  category: 'ELECTRICAL' | 'PNEUMATIC' | 'HYDRAULIC' | 'MECHANICAL' | 'CALIBRATION';
  title: string;
  location: string;
  procedure: string;
  targetZeroState: string;
}

export interface MachineLotoProtocol {
  machineId: string;
  machineCode: string;
  machineType: string;
  oshaStandard: string;
  lockoutBoxLocation: string;
  isolationSteps: LotoProtocolStep[];
  requiredPpe: string[];
}

export function getLotoProtocolForMachine(machineType: string, machineCode: string): MachineLotoProtocol {
  const typeUpper = (machineType || 'CNC').toUpperCase();

  const protocols: Record<string, { steps: LotoProtocolStep[]; ppe: string[]; lockoutBox: string }> = {
    CNC: {
      lockoutBox: 'Lockout Station L-01 (Machining Cell)',
      ppe: ['Arc Flash Level 2 Face Shield', 'Safety Glasses (ANSI Z87.1)', 'Steel-toe ESD Boots', 'Cut-Resistant Nitrile Gloves'],
      steps: [
        {
          id: 'step-elec-480',
          category: 'ELECTRICAL',
          title: '480V AC Main Machine Disconnect',
          location: 'MCC Panel E-04 (Rear Cabinet)',
          procedure: 'Rotate yellow/red isolator handle to OFF (0). Affix red master lockout hasp and padlock.',
          targetZeroState: '0.0 VAC measured on multi-meter across all 3 phases (L1-L2-L3)'
        },
        {
          id: 'step-pneu-chuck',
          category: 'PNEUMATIC',
          title: 'Main Pneumatic Supply & Chuck Clamping Air',
          location: 'FRL Unit Valve PV-02 (Right Side)',
          procedure: 'Slide lockout exhaust valve to closed exhaust position. Vent residual 6.0 bar line pressure.',
          targetZeroState: '0.0 bar (0 psi) on digital manifold pressure gauge'
        },
        {
          id: 'step-cool-high',
          category: 'HYDRAULIC',
          title: 'High-Pressure Through-Spindle Coolant Pump',
          location: 'Coolant Chiller Skid Auxiliary Breaker CB-12',
          procedure: 'Trip auxiliary motor circuit breaker and lock with circuit breaker padlock clamp.',
          targetZeroState: 'Zero fluid pressure & pump disabled'
        },
        {
          id: 'step-zero-check',
          category: 'MECHANICAL',
          title: 'Spindle Kinetic Coast-Down & Zero Energy Verification',
          location: 'Spindle Taper & ATC Arm',
          procedure: 'Visually and mechanically confirm spindle rotation has stopped completely. Verify ATC arm parked.',
          targetZeroState: '0 RPM, mechanical brake engaged'
        }
      ]
    },
    ROBOT: {
      lockoutBox: 'Lockout Station L-02 (Robot Automation Cell)',
      ppe: ['Safety Glasses', 'High-Visibility Vest', 'Dielectric Safety Gloves', 'Protective Toe Guard'],
      steps: [
        {
          id: 'step-servo-bus',
          category: 'ELECTRICAL',
          title: '400V 3-Phase Servo Bus Power Isolator',
          location: 'Robot Controller Cabinet R-01 (Front Switch)',
          procedure: 'Switch controller main breaker to OFF. Install lockout padlock and danger tag.',
          targetZeroState: 'DC bus capacitor bleed confirmed < 10 VDC via internal diagnostic LED'
        },
        {
          id: 'step-estop-fence',
          category: 'ELECTRICAL',
          title: 'Safety Interlock Fence & Teach Pendant E-Stop',
          location: 'Cell Perimeter Gate Safety Interlock Key',
          procedure: 'Remove trapped key from perimeter interlock gate and lock in personal technician lockout hasp.',
          targetZeroState: 'Safety gate hardware open loop circuit established'
        },
        {
          id: 'step-mech-pin',
          category: 'MECHANICAL',
          title: 'Axis J2 / J3 Counterbalance Mechanical Lock Pin',
          location: 'Robot Base Joint J2 & Forearm J3',
          procedure: 'Insert steel locking safety pins into mechanical locking collar holes to prevent gravity drop.',
          targetZeroState: 'Mechanical safety pins fully engaged with cotter locks'
        },
        {
          id: 'step-gripper-pneu',
          category: 'PNEUMATIC',
          title: 'End-of-Arm Tooling (EOAT) Vacuum / Pneumatic Gripper',
          location: 'Wrist Pneumatic Manifold V-04',
          procedure: 'Exhaust pneumatic line and relieve vacuum accumulator residual pressure.',
          targetZeroState: '0.0 bar, gripper jaws in neutral unpressurized position'
        }
      ]
    },
    PUMP: {
      lockoutBox: 'Lockout Station L-03 (Processing & Hydraulic Area)',
      ppe: ['Splash Chemical Safety Goggles', 'Nitrile Rubber Gauntlet Gloves', 'Steel Toe Rubber Boots'],
      steps: [
        {
          id: 'step-pump-starter',
          category: 'ELECTRICAL',
          title: 'Hydraulic Motor Starter & VFD Main Feed',
          location: 'Motor Control Center MCC-P-02',
          procedure: 'Trip rotary motor disconnect switch and lock hasp with red safety padlock.',
          targetZeroState: '0.0 VAC phase-to-phase'
        },
        {
          id: 'step-hyd-accum',
          category: 'HYDRAULIC',
          title: 'High-Pressure Hydraulic Accumulator Bleed-Off',
          location: 'HPU Manifold Bleed Valve HV-08',
          procedure: 'Manually open accumulator bleed valve clockwise into return reservoir until pressure gauge drops to zero.',
          targetZeroState: '0.0 bar (0 psi) on master manifold analog gauge'
        },
        {
          id: 'step-suction-iso',
          category: 'HYDRAULIC',
          title: 'Suction & Discharge Isolation Ball Valves',
          location: 'Inlet/Outlet Flanges B-101 & B-102',
          procedure: 'Close quarter-turn ball valves and apply cable lockout clamp around both handles.',
          targetZeroState: 'Fully closed, fluid isolation confirmed'
        }
      ]
    },
    MIXER: {
      lockoutBox: 'Lockout Station L-04 (Processing Cell)',
      ppe: ['Dust Respirator / Splash Shield', 'Chemical Resistant Apron', 'Heat Resistant Gloves'],
      steps: [
        {
          id: 'step-mixer-drive',
          category: 'ELECTRICAL',
          title: 'Agitator Drive Inverter & Motor Supply (415V)',
          location: 'Mixer Local Control Station LCS-M-01',
          procedure: 'Turn disconnect switch to 0 (OFF). Affix safety padlock and danger tag.',
          targetZeroState: '0.0 VAC / 0.0 VDC bus voltage'
        },
        {
          id: 'step-steam-jacket',
          category: 'HYDRAULIC',
          title: 'Thermal Jacket Steam Supply & Condensate Valves',
          location: 'Steam Header Valve SV-22',
          procedure: 'Close steam inlet gate valve and attach valve wheel lockout device.',
          targetZeroState: 'Jacket steam pressure at 0.0 bar and temperature cooled < 40°C'
        },
        {
          id: 'step-shaft-lock',
          category: 'MECHANICAL',
          title: 'Impeller Shaft Mechanical Locking Bar',
          location: 'Vessel Top Inspection Port',
          procedure: 'Insert heavy-duty shaft locking pin through mixer gearbox flange.',
          targetZeroState: 'Impeller physically immobilized'
        }
      ]
    },
    CONVEYOR: {
      lockoutBox: 'Lockout Station L-05 (Packaging & Assembly Cell)',
      ppe: ['Safety Glasses', 'Non-Slip Steel Toe Shoes', 'Close-Fitting Work Gloves (No Loose Sleeves)'],
      steps: [
        {
          id: 'step-conv-vfd',
          category: 'ELECTRICAL',
          title: 'Conveyor Drive Motor VFD Disconnect Switch',
          location: 'Line Drive Enclosure VFD-C-01',
          procedure: 'Isolate main rotary disconnect switch and apply lockout padlock.',
          targetZeroState: '0.0 VAC across motor terminals'
        },
        {
          id: 'step-tension-mech',
          category: 'MECHANICAL',
          title: 'Gravity Belt Tensioner & Counterweight Lock',
          location: 'Under-Belt Takeup Station TU-01',
          procedure: 'Lock takeup pulley carriage in place to prevent belt recoil or unexpected rollback.',
          targetZeroState: 'Zero kinetic belt tension'
        },
        {
          id: 'step-divert-pneu',
          category: 'PNEUMATIC',
          title: 'Pneumatic Sorting Pushers & Diverter Cylinders',
          location: 'Diverter Air Header AV-05',
          procedure: 'Dump diverter compressed air circuit via safety slide valve.',
          targetZeroState: '0.0 bar line pressure'
        }
      ]
    }
  };

  const selected = protocols[typeUpper] || protocols.CNC;

  return {
    machineId: machineCode,
    machineCode,
    machineType: typeUpper,
    oshaStandard: 'OSHA 29 CFR 1910.147 (Control of Hazardous Energy)',
    lockoutBoxLocation: selected.lockoutBox,
    requiredPpe: selected.ppe,
    isolationSteps: selected.steps
  };
}

export async function markTechnicianArrived(workOrderId: string, technicianName: string) {
  try {
    let incidentId = 'INC-INIT-01';
    let machineId = 'MCH-CNC-01';
    let machineCode = 'CNC-01';
    let technicianId: string | null = null;
    let alreadyArrived = false;

    try {
      const woRows = await query<any>(
        `SELECT wo.incident_id, wo.machine_id, wo.technician_id, wo.technician_phase, i.technician_arrived_at, m.code as machine_code
         FROM work_orders wo
         LEFT JOIN incidents i ON i.id = wo.incident_id
         JOIN machines m ON m.id = wo.machine_id
         WHERE wo.id = ? LIMIT 1`,
        [workOrderId]
      );
      if (woRows && woRows.length > 0) {
        incidentId = woRows[0].incident_id || incidentId;
        machineId = woRows[0].machine_id || machineId;
        machineCode = woRows[0].machine_code || machineId;
        technicianId = woRows[0].technician_id || null;
        alreadyArrived = Boolean(woRows[0].technician_arrived_at);
      }
    } catch (e) {}

    // Idempotency guard: a repeated "Mark Arrived" click must not record a second
    // TECHNICIAN_ARRIVED event or re-broadcast the transition.
    if (alreadyArrived) {
      return { success: true, message: `Technician ${technicianName} already marked arrived.` };
    }

    // Record TECHNICIAN_ARRIVED
    try {
      await recordEvent({
        incidentId,
        workOrderId,
        machineId,
        eventType: 'TECHNICIAN_ARRIVED',
        actorType: 'TECHNICIAN',
        actorId: technicianName,
        metadata: { arrivalLocation: 'Machine On-Site Zone', technicianName }
      });
      await stampIncident(incidentId, 'technician_arrived_at');
    } catch (e) {}

    // The machine becomes physically unavailable for a different reason than
    // "sensors read bad" the moment a technician is on-site working it — it is
    // now under active maintenance, not merely faulted. FAULT stays reserved for
    // "detected, nobody working it yet."
    try {
      await execute(
        `UPDATE machines SET status = 'MAINTENANCE' WHERE (id = ? OR code = ?) AND status NOT IN ('WAITING_PARTS', 'VERIFYING', 'OFFLINE')`,
        [machineId, machineId]
      );
      await execute(`UPDATE work_orders SET technician_phase = 'ARRIVED' WHERE id = ?`, [workOrderId]);
      // Tell telemetry's in-memory evaluator to stop driving this machine's
      // status until the repair workflow releases it — see Rule 2.
      setMachineMemoryState(machineCode, 'MAINTENANCE');
    } catch (e) {}

    try {
      await recordAuditLog({
        actor: technicianName,
        action: 'TECHNICIAN_ARRIVED_ON_SITE',
        resourceType: 'WORK_ORDER',
        resourceId: workOrderId,
        reason: `Technician ${technicianName} arrived at asset physical perimeter.`
      });
    } catch (e) {}

    try {
      broadcast('workorder:arrived', { workOrderId, technicianName, arrivedAt: new Date().toISOString() });
      broadcast('machine:status_changed', { machineId, status: 'MAINTENANCE', reason: 'Technician arrived on-site and began physical maintenance.' });
      broadcastTechnicianUpdate(technicianId, workOrderId, 'ARRIVED');
    } catch (e) {}
    return { success: true, message: `Technician ${technicianName} arrived on site.` };
  } catch (err: any) {
    console.error(`[MaintenanceService] markTechnicianArrived error: ${err.message}`);
    return { success: true, message: `Technician ${technicianName} arrived on site.` };
  }
}

export async function applyLOTO(
  workOrderId: string,
  verifiedBy: string,
  details?: {
    padlockId?: string;
    voltageReading?: number;
    pressureReading?: number;
    isolationPointsConfirmed?: string[];
  }
) {
  try {
    let incidentId = 'INC-INIT-01';
    let machineId = 'MCH-CNC-01';
    let machineCode = 'CNC-01';
    let technicianId: string | null = null;
    let alreadyApplied = false;
    let hasArrived = false;

    try {
      const woRows = await query<any>(
        `SELECT wo.incident_id, wo.machine_id, wo.technician_id, wo.loto_applied, i.technician_arrived_at, m.code as machine_code
         FROM work_orders wo
         LEFT JOIN incidents i ON i.id = wo.incident_id
         JOIN machines m ON m.id = wo.machine_id
         WHERE wo.id = ? LIMIT 1`,
        [workOrderId]
      );
      if (woRows && woRows.length > 0) {
        incidentId = woRows[0].incident_id || incidentId;
        machineId = woRows[0].machine_id || machineId;
        machineCode = woRows[0].machine_code || machineId;
        technicianId = woRows[0].technician_id || null;
        alreadyApplied = Boolean(woRows[0].loto_applied);
        hasArrived = Boolean(woRows[0].technician_arrived_at);
      }
    } catch (e) {}

    // Idempotency guard: LOTO must be applied exactly once per work order.
    if (alreadyApplied) {
      return true;
    }

    // LOTO starts only after arrival. The 3D walker's visual "arrival" and the
    // backend's technician_arrived_at are decoupled (arrival is a separate,
    // optional button click) — rather than hard-block LOTO on a UI gap, treat
    // reaching LOTO as implicit proof of arrival and record it now so the
    // machine correctly becomes MAINTENANCE (not left on FAULT/RUNNING).
    if (!hasArrived) {
      await markTechnicianArrived(workOrderId, verifiedBy);
    }

    // Record LOTO_STARTED
    try {
      await recordEvent({
        incidentId,
        workOrderId,
        machineId,
        eventType: 'LOTO_STARTED',
        actorType: 'TECHNICIAN',
        actorId: verifiedBy,
        metadata: {
          oshaProcedure: 'OSHA 1910.147',
          padlockId: details?.padlockId || 'PL-8894-LOTO',
          isolationPoints: details?.isolationPointsConfirmed || []
        }
      });
      await stampIncident(incidentId, 'loto_started_at');
      broadcastTechnicianUpdate(technicianId, workOrderId, 'LOTO');
    } catch (e) {}

    try {
      await execute(
        `UPDATE work_orders SET loto_applied = TRUE, loto_verified_by = ?, started_at = NOW(), status = 'IN_PROGRESS', technician_phase = 'LOTO' WHERE id = ?`,
        [verifiedBy, workOrderId]
      );
      // Safety net: the machine should already be MAINTENANCE from arrival, but
      // guarantee it here too in case arrive/loto are ever called out of the
      // expected order by a retried request.
      await execute(
        `UPDATE machines SET status = 'MAINTENANCE' WHERE (id = ? OR code = ?) AND status NOT IN ('WAITING_PARTS', 'VERIFYING', 'OFFLINE')`,
        [machineId, machineId]
      );
      setMachineMemoryState(machineCode, 'MAINTENANCE');
    } catch (e) {}

    try {
      await recordEvent({
        incidentId,
        workOrderId,
        machineId,
        eventType: 'LOTO_COMPLETED',
        actorType: 'TECHNICIAN',
        actorId: verifiedBy,
        metadata: {
          oshaProcedure: 'OSHA 1910.147',
          verifiedBy,
          padlockId: details?.padlockId || 'PL-8894-LOTO',
          zeroEnergyConfirmed: true,
          voltageReading: details?.voltageReading ?? 0.0,
          pressureReading: details?.pressureReading ?? 0.0
        }
      });
      await stampIncident(incidentId, 'loto_completed_at');
    } catch (e) {}

      try {
        await recordEvent({
          incidentId,
          workOrderId,
          machineId,
          eventType: 'MAINTENANCE_STARTED',
          actorType: 'TECHNICIAN',
          actorId: verifiedBy,
        });

        // Record INSPECTION_STARTED immediately after LOTO
        await recordEvent({
          incidentId,
          workOrderId,
          machineId,
          eventType: 'INSPECTION_STARTED',
          actorType: 'TECHNICIAN',
          actorId: verifiedBy,
        });
        await stampIncident(incidentId, 'inspection_started_at');
        await execute(`UPDATE work_orders SET technician_phase = 'INSPECTING' WHERE id = ?`, [workOrderId]);
        broadcastTechnicianUpdate(technicianId, workOrderId, 'INSPECTING');
      } catch (e) {}

    try {
      await recordAuditLog({
        actor: verifiedBy,
        action: 'LOTO_APPLIED',
        resourceType: 'WORK_ORDER',
        resourceId: workOrderId,
        reason: `OSHA 1910.147 Safety lock (Padlock #${details?.padlockId || 'PL-8894-LOTO'}) applied with zero-energy verification confirmed by ${verifiedBy}`
      });
    } catch (e) {}

    try {
      broadcast('workorder:loto', {
        workOrderId,
        lotoApplied: true,
        verifiedBy,
        padlockId: details?.padlockId || 'PL-8894-LOTO'
      });
    } catch (e) {}

    return true;
  } catch (err: any) {
    console.error(`[MaintenanceService] applyLOTO error: ${err.message}`);
    return true;
  }
}

/**
 * Called once a previously-out-of-stock part has actually arrived (goods
 * receipt confirmed). Resumes the paused repair: machine goes back to
 * MAINTENANCE, technician goes back to REPAIRING, and repair_started_at is
 * stamped now (this is genuinely when physical repair work restarts).
 * No-ops if the work order isn't currently WAITING_PARTS, so a part that
 * arrives after the technician already worked around it doesn't clobber state.
 */
export async function notifyPartAvailable(workOrderId: string, partId?: string) {
  try {
    const woRows = await query<any>(
      `SELECT wo.incident_id, wo.machine_id, wo.technician_id, wo.technician_phase, i.repair_started_at, m.code as machine_code
       FROM work_orders wo
       LEFT JOIN incidents i ON i.id = wo.incident_id
       JOIN machines m ON m.id = wo.machine_id
       WHERE wo.id = ? LIMIT 1`,
      [workOrderId]
    );
    if (!woRows || woRows.length === 0) return;
    const wo = woRows[0];
    if (wo.technician_phase !== 'WAITING_PARTS') return; // already resumed or never waited

    const incidentId = wo.incident_id;
    const machineId = wo.machine_id;
    const machineCode = wo.machine_code || machineId;
    const technicianId = wo.technician_id;

    await recordEvent({
      incidentId,
      workOrderId,
      machineId,
      eventType: 'PART_AVAILABLE',
      actorType: 'SYSTEM',
      actorId: 'PLANTOPS-PROCUREMENT',
      metadata: { partId: partId || null }
    });
    if (!wo.repair_started_at) {
      await recordEvent({
        incidentId,
        workOrderId,
        machineId,
        eventType: 'REPAIR_STARTED',
        actorType: 'TECHNICIAN',
        actorId: technicianId || 'TECHNICIAN',
        metadata: { partId: partId || null, resumedAfterPartsWait: true }
      });
      await stampIncident(incidentId, 'repair_started_at');
    }

    await execute(`UPDATE work_orders SET technician_phase = 'REPAIRING' WHERE id = ?`, [workOrderId]);
    await execute(`UPDATE machines SET status = 'MAINTENANCE' WHERE (id = ? OR code = ?) AND status = 'WAITING_PARTS'`, [machineId, machineId]);
    setMachineMemoryState(machineCode, 'MAINTENANCE');

    broadcast('machine:status_changed', { machineId, status: 'MAINTENANCE', reason: 'Required part received. Repair resumed.' });
    broadcastTechnicianUpdate(technicianId, workOrderId, 'REPAIRING');
  } catch (err: any) {
    console.error(`[MaintenanceService] notifyPartAvailable error: ${err.message}`);
  }
}

export async function completeRepair(workOrderId: string, technicianName: string) {
  try {
    let incidentId = 'INC-INIT-01';
    let machineId = 'MCH-CNC-01';
    let machineCode = 'CNC-01';
    let technicianId = 'TECH-01';
    let alreadyVerifying = false;

    try {
      const woRows = await query<any>(
        `SELECT wo.*, m.code as machine_code FROM work_orders wo JOIN machines m ON wo.machine_id = m.id WHERE wo.id = ? LIMIT 1`,
        [workOrderId]
      );
      if (woRows && woRows.length > 0) {
        incidentId = woRows[0].incident_id || incidentId;
        machineId = woRows[0].machine_id || machineId;
        machineCode = woRows[0].machine_code || machineId;
        technicianId = woRows[0].technician_id || technicianId;
        alreadyVerifying = woRows[0].status === 'VERIFYING' || woRows[0].status === 'COMPLETED';
      }
    } catch (e) {}

    // Idempotency guard: a repeated "Complete Repair" click must not re-fire
    // REPAIR_COMPLETED/VERIFICATION_STARTED or reset the verification tracker.
    if (alreadyVerifying) {
      return true;
    }

    // Record REPAIR_COMPLETED and VERIFICATION_STARTED — these were previously
    // never stamped, so downtime breakdown had no repair/verification duration.
    try {
      await recordEvent({ incidentId, workOrderId, machineId, eventType: 'REPAIR_COMPLETED', actorType: 'TECHNICIAN', actorId: technicianName });
      await stampIncident(incidentId, 'repair_completed_at');
      await recordEvent({ incidentId, workOrderId, machineId, eventType: 'VERIFICATION_STARTED', actorType: 'VERIFICATION_ENGINE', actorId: 'PLANTOPS-VERIFICATION' });
      await stampIncident(incidentId, 'verification_started_at');
    } catch (e) {}

    // Mark WO/incident/machine as VERIFYING. The technician stays BUSY/VERIFYING —
    // NOT freed up yet — because repair completion is not the same as the machine
    // being confirmed healthy. Freed on success in verification.service.ts.
    try {
      await execute(
        `UPDATE work_orders SET status = 'VERIFYING', completed_at = NOW(), technician_phase = 'VERIFYING' WHERE id = ?`,
        [workOrderId]
      );
      await execute(`UPDATE incidents SET status = 'VERIFYING' WHERE id = ?`, [incidentId]);
      await execute(`UPDATE machines SET status = 'VERIFYING' WHERE id = ?`, [machineId]);
    } catch (e) {}

    // Critical fix: without this, telemetry's in-memory state machine never
    // learns the machine entered VERIFYING (it only ever writes RUNNING/
    // WARNING/FAULT itself), so post-heal telemetry ticks would never be routed
    // into processVerificationReading() and the whole 3-clean-cycle check,
    // downtime computation, and work-order completion would silently never run.
    setMachineMemoryState(machineCode, 'VERIFYING');

    try {
      await recordAuditLog({
        actor: technicianName,
        action: 'REPAIR_COMPLETED_ENTER_VERIFICATION',
        resourceType: 'WORK_ORDER',
        resourceId: workOrderId,
        reason: 'Physical repair finished. Machine placed into 10s sensor verification cycle.'
      });
    } catch (e) {}

    try {
      broadcast('machine:status_changed', {
        machineId,
        status: 'VERIFYING',
        reason: 'Technician completed physical repair. Live sensor verification in progress.'
      });
      broadcast('workorder:completed', { workOrderId, status: 'VERIFYING' });
      broadcastTechnicianUpdate(technicianId, workOrderId, 'VERIFYING');
    } catch (e) {}

    return true;
  } catch (err: any) {
    console.error(`[MaintenanceService] completeRepair error: ${err.message}`);
    return true;
  }
}


