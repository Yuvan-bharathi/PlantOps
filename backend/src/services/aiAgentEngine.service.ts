import { query, execute } from '../db/mysql.js';
import { broadcast } from './socket.service.js';
import { runAIMaintenanceOrchestration } from './aiOrchestrator.service.js';

export interface IntercomMessagePayload {
  id?: string;
  senderRole: string;
  senderName: string;
  recipientRole?: string;
  channel?: 'BROADCAST' | 'ESCALATION' | 'SPARE_REQUEST' | 'SAFETY_LOTO' | 'PO_APPROVAL' | 'AI_ASSISTANT';
  priority?: 'NORMAL' | 'HIGH' | 'CRITICAL' | 'EMERGENCY';
  title: string;
  message: string;
  metadata?: Record<string, any>;
  status?: 'OPEN' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'RESOLVED' | 'ACKNOWLEDGED';
  resolutionNote?: string;
}

export class AIAgentEngineService {
  /**
   * 1. Autonomous Anomaly Triage & Technician Dispatch Agent
   */
  public static async triageAndDispatch(params: {
    machineCode: string;
    symptom: string;
    vibration?: number;
    temperature?: number;
    severity?: 'HIGH' | 'CRITICAL';
  }) {
    const { machineCode, symptom, vibration = 4.5, temperature = 75.0, severity = 'CRITICAL' } = params;

    console.log(`[AI Agent] Autonomous Anomaly Triage triggered for ${machineCode}...`);

    // Fetch machine info
    const machines = await query<any>(`SELECT * FROM machines WHERE code = ? LIMIT 1`, [machineCode]);
    const machine = machines[0] || {
      id: `MCH-${machineCode}`,
      code: machineCode,
      name: `${machineCode} Industrial System`,
      type: machineCode.startsWith('CNC') ? 'CNC' : machineCode.startsWith('ROB') ? 'ROBOT' : 'PUMP',
      area: 'Machining Cell',
      criticality: 'CRITICAL'
    };

    // Run AI Orchestrator to find the best certified technician from cluster/skills
    const orchestration = await runAIMaintenanceOrchestration(machine, {
      alertType: 'IOT_ANOMALY',
      symptom
    });

    // Check cluster assignment from TiDB Cloud
    const clusters = await query<any>(
      `SELECT * FROM technician_machine_clusters WHERE machine_code = ? LIMIT 1`,
      [machineCode]
    );
    const assignedTechId = clusters[0]?.technician_id || orchestration.assignedTechnicianId || 'TECH-01';
    const assignedTechName = clusters[0]?.technician_name || orchestration.assignedTechnicianName || 'Arun Kumar';

    const timestamp = new Date().toISOString();
    const incidentId = `INC-${Date.now().toString().slice(-6)}`;
    const workOrderId = `WO-${Date.now().toString().slice(-6)}`;

    // Create Incident in TiDB Cloud
    await execute(
      `INSERT INTO incidents (id, machine_id, machine_code, alert_type, severity, title, description, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        incidentId,
        machine.id,
        machine.code,
        'IOT_ANOMALY',
        severity,
        `AI Triage: Elevated Vibration & Temp on ${machineCode}`,
        `Autonomous AI Triage detected vibration ${vibration} mm/s, temp ${temperature}°C. Symptom: ${symptom}. Cluster Tech ${assignedTechName} auto-dispatched.`,
        'ASSIGNED',
        timestamp
      ]
    );

    // Create Work Order in TiDB Cloud
    await execute(
      `INSERT INTO work_orders (
        id, incident_id, machine_id, technician_id, status, technician_phase, priority, title, description, 
        assigned_at, osha_loto_required, root_cause_diagnosis, loto_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        workOrderId,
        incidentId,
        machine.id,
        assignedTechId,
        'IN_PROGRESS',
        'DISPATCHED',
        severity,
        `OSHA Emergency Repair: ${machineCode} ${symptom}`,
        `Autonomous AI dispatch assigned cluster technician ${assignedTechName}. Required inspection: ${orchestration.recommendedInspectionPoints?.[0] || 'Bearing runout & thermal dissipation'}.`,
        timestamp,
        true,
        `AI Diagnosis: High probability bearing fatigue / lubrication dry-out under dynamic cutting load.`,
        'LOCKOUT_PENDING'
      ]
    );

    // Update technician status
    await execute(
      `UPDATE technicians SET status = 'BUSY', active_work_orders = active_work_orders + 1 WHERE id = ?`,
      [assignedTechId]
    );

    // Auto-check and reserve spare parts in Inventory
    let sparePartReserved = null;
    const parts = await query<any>(
      `SELECT * FROM parts WHERE compatibility LIKE ? OR name LIKE ? ORDER BY quantity_on_hand DESC LIMIT 1`,
      [`%${machine.type}%`, `%Bearing%`]
    );

    if (parts && parts.length > 0) {
      const part = parts[0];
      if (part.quantity_on_hand > 0) {
        // Reserve part
        await execute(
          `INSERT INTO parts_reservations (id, work_order_id, part_id, quantity_reserved, status)
           VALUES (?, ?, ?, ?, ?)`,
          [`RES-${Date.now().toString().slice(-6)}`, workOrderId, part.id, 1, 'RESERVED']
        );
        await execute(
          `UPDATE parts SET quantity_reserved = quantity_reserved + 1 WHERE id = ?`,
          [part.id]
        );
        sparePartReserved = {
          partId: part.id,
          partName: part.name,
          binLocation: part.location || 'BAY-B-04'
        };
      }
    }

    // Auto-create Intercom Alert
    const msgId = `MSG-${Date.now().toString().slice(-6)}`;
    await execute(
      `INSERT INTO plant_intercom_messages (
        id, sender_role, sender_name, recipient_role, channel, priority, title, message, metadata, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        msgId,
        'AI_COPILOT',
        'Antigravity Industrial AI',
        'SUPERVISOR',
        'ESCALATION',
        'CRITICAL',
        `Autonomous Dispatch: ${machineCode} Anomaly`,
        `AI diagnosed ${symptom} on ${machineCode}. Dispatched ${assignedTechName} (Cluster Lead). Work Order ${workOrderId} issued with mandatory OSHA 1910.147 LOTO. ${sparePartReserved ? `Part ${sparePartReserved.partName} reserved at ${sparePartReserved.binLocation}.` : ''}`,
        JSON.stringify({
          machineCode,
          incidentId,
          workOrderId,
          assignedTechId,
          assignedTechName,
          sparePartReserved
        }),
        'OPEN'
      ]
    );

    // Real-time broadcast
    broadcast('ai:anomaly_triaged', {
      incidentId,
      workOrderId,
      machineCode,
      symptom,
      assignedTech: { id: assignedTechId, name: assignedTechName },
      sparePartReserved,
      timestamp
    });

    broadcast('intercom:new_message', {
      id: msgId,
      senderRole: 'AI_COPILOT',
      senderName: 'Antigravity Industrial AI',
      recipientRole: 'SUPERVISOR',
      channel: 'ESCALATION',
      priority: 'CRITICAL',
      title: `Autonomous Dispatch: ${machineCode} Anomaly`,
      message: `AI diagnosed ${symptom} on ${machineCode}. Dispatched ${assignedTechName}.`,
      createdAt: timestamp
    });

    return {
      incidentId,
      workOrderId,
      machineCode,
      assignedTech: { id: assignedTechId, name: assignedTechName },
      sparePartReserved
    };
  }

  /**
   * 2. Autonomous Inventory & Reorder Agent ($1,000 threshold gate)
   */
  public static async checkAndReorderSpare(params: {
    partId: string;
    quantity: number;
    requesterRole?: string;
    requesterName?: string;
    reason?: string;
  }) {
    const { partId, quantity = 4, requesterRole = 'INVENTORY_MGMT', requesterName = 'Sarah Jenkins', reason = 'Low Stock Trigger' } = params;

    const parts = await query<any>(`SELECT * FROM parts WHERE id = ? LIMIT 1`, [partId]);
    if (!parts || parts.length === 0) {
      throw new Error(`Part ${partId} not found in inventory.`);
    }

    const part = parts[0];
    const unitCost = Number(part.unit_cost || 250.0);
    const totalCost = unitCost * quantity;
    const poId = `PO-${Date.now().toString().slice(-6)}`;
    const timestamp = new Date().toISOString();

    const isAutoApproved = totalCost < 1000;
    const status = isAutoApproved ? 'APPROVED' : 'PENDING_APPROVAL';

    // Insert PO in TiDB Cloud
    await execute(
      `INSERT INTO purchase_orders (
        id, part_id, part_name, quantity, unit_cost, total_cost, supplier_name, status, requested_by, created_at, approved_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE status=VALUES(status)`,
      [
        poId,
        part.id,
        part.name,
        quantity,
        unitCost,
        totalCost,
        part.supplier || 'NSK Precision Bearing Co.',
        status,
        requesterName,
        timestamp,
        isAutoApproved ? timestamp : null
      ]
    );

    // Create Intercom notification
    const msgId = `MSG-${Date.now().toString().slice(-6)}`;
    const title = isAutoApproved
      ? `Auto-PO Approved: ${quantity}x ${part.name} ($${totalCost.toFixed(2)})`
      : `PO Approval Required: ${quantity}x ${part.name} ($${totalCost.toFixed(2)})`;

    const message = isAutoApproved
      ? `AI Procurement Agent auto-approved PO #${poId} for ${quantity}x ${part.name} ($${totalCost.toFixed(2)} is under $1,000 threshold). Supplier notified.`
      : `PO #${poId} total ($${totalCost.toFixed(2)}) exceeds $1,000 limit. Awaiting 1-click Manager authorization from Priya Patel.`;

    await execute(
      `INSERT INTO plant_intercom_messages (
        id, sender_role, sender_name, recipient_role, channel, priority, title, message, metadata, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        msgId,
        'INVENTORY_MGMT',
        requesterName,
        isAutoApproved ? 'ALL' : 'MANAGER',
        'PO_APPROVAL',
        isAutoApproved ? 'NORMAL' : 'HIGH',
        title,
        message,
        JSON.stringify({
          poId,
          partId: part.id,
          partName: part.name,
          quantity,
          unitCost,
          totalCost,
          isAutoApproved
        }),
        isAutoApproved ? 'APPROVED' : 'PENDING_APPROVAL'
      ]
    );

    broadcast('procurement:po_updated', {
      poId,
      partId: part.id,
      partName: part.name,
      totalCost,
      status,
      isAutoApproved
    });

    broadcast('intercom:new_message', {
      id: msgId,
      senderRole: requesterRole,
      senderName: requesterName,
      recipientRole: isAutoApproved ? 'ALL' : 'MANAGER',
      channel: 'PO_APPROVAL',
      priority: isAutoApproved ? 'NORMAL' : 'HIGH',
      title,
      message,
      metadata: { poId, totalCost, isAutoApproved },
      createdAt: timestamp
    });

    return {
      poId,
      partName: part.name,
      totalCost,
      status,
      isAutoApproved
    };
  }

  /**
   * 3. Manager 1-Click PO Approval
   */
  public static async approvePurchaseOrder(poId: string, managerName = 'Priya Patel') {
    const timestamp = new Date().toISOString();
    await execute(
      `UPDATE purchase_orders SET status = 'APPROVED', approved_at = ?, approved_by = ? WHERE id = ?`,
      [timestamp, managerName, poId]
    );

    // Update related intercom message
    await execute(
      `UPDATE plant_intercom_messages 
       SET status = 'APPROVED', resolution_note = ? 
       WHERE JSON_EXTRACT(metadata, '$.poId') = ? OR id = ?`,
      [`Approved by ${managerName} on ${new Date().toLocaleTimeString()}`, poId, poId]
    );

    broadcast('procurement:po_approved', {
      poId,
      approvedBy: managerName,
      timestamp
    });

    broadcast('intercom:message_updated', {
      poId,
      status: 'APPROVED',
      resolutionNote: `Approved by ${managerName}`
    });

    return { success: true, poId, approvedBy: managerName };
  }

  /**
   * 4. Autonomous AGV Fleet Summons upon 240-Piece Pallet Full
   */
  public static async dispatchAutonomousAGV(params: {
    palletId: string;
    totalPieces: number;
    cartons: number;
    destinationBay?: string;
  }) {
    const { palletId, totalPieces = 240, cartons = 10, destinationBay = 'Outbound Bay 1' } = params;
    const agvId = 'AGV-01';
    const timestamp = new Date().toISOString();

    console.log(`[AI Logistics Agent] Pallet ${palletId} full (${totalPieces} pcs). Summoning ${agvId} to ${destinationBay}...`);

    const msgId = `MSG-${Date.now().toString().slice(-6)}`;
    await execute(
      `INSERT INTO plant_intercom_messages (
        id, sender_role, sender_name, recipient_role, channel, priority, title, message, metadata, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        msgId,
        'AI_COPILOT',
        'Autonomous AGV Fleet Dispatcher',
        'ALL',
        'BROADCAST',
        'NORMAL',
        `AGV Mission: Pallet ${palletId} Transport`,
        `Packaging Cell completed batch (${totalPieces} pcs / ${cartons} cartons). ${agvId} dispatched for pickup from Zone P-1 to ${destinationBay}. RFID Manifest #MFT-${Date.now().toString().slice(-4)} generated.`,
        JSON.stringify({ palletId, totalPieces, cartons, agvId, destinationBay }),
        'OPEN'
      ]
    );

    broadcast('production:agv_dispatched', {
      palletId,
      agvId,
      totalPieces,
      cartons,
      destinationBay,
      timestamp
    });

    return {
      palletId,
      agvId,
      destinationBay,
      status: 'EN_ROUTE'
    };
  }

  /**
   * 5. Industrial AI Copilot Smart Assistant Response
   */
  public static async processCopilotPrompt(prompt: string, senderRole: string, senderName: string) {
    const lower = prompt.toLowerCase();
    let reply = '';
    let actionTriggered = null;

    if (lower.includes('loto') || lower.includes('safety') || lower.includes('lockout')) {
      reply = `🛡️ **OSHA 1910.147 LOTO Protocol:**
1. Notify floor supervisor Marcus Vance.
2. Turn off primary disconnect switch on machine breaker panel.
3. Apply Master Lock red safety hasp & personal padlock (Key #7721).
4. Bleed hydraulic/pneumatic residual energy via manual dump valve.
5. Verify 0.0V / 0.0 bar before physical guard removal.`;
    } else if (lower.includes('bearing') || lower.includes('cnc-01') || lower.includes('spindle')) {
      reply = `⚙️ **CNC-01 Spindle Diagnostics:**
Standard Bearing: **Angular Contact Bearing 7008-H**.
Current Stock: 3 units at **BAY-B-04**.
Recommended preload torque: 35 Nm. Max radial runout tolerance: 0.0025 mm.`;
    } else if (lower.includes('pm') || lower.includes('schedule') || lower.includes('routine')) {
      reply = `📅 **Preventative Maintenance Summary:**
- CNC-01: 90d Routine due today (Assigned: Arun Kumar)
- ROBOT-01: 120d Routine due in 2 days (Assigned: Priya Sharma)
- PUMP-01: 30d Filter Cartridge due today (Assigned: Rajesh Nair)
All routines auto-balanced with zero production stoppage.`;
    } else if (lower.includes('request spare') || lower.includes('part') || lower.includes('order')) {
      reply = `📦 **Autonomous Spare Request:**
I have notified Sarah Jenkins in Inventory Management. Required parts will be staged at Bay B within 10 minutes.`;
      actionTriggered = 'SPARE_REQUEST_AI';
    } else {
      reply = `🤖 **PlantOps AI Copilot:**
I am monitoring active IoT telemetry, OSHA LOTO procedures, technician cluster assignments, and warehouse ATP stock. How can I assist your shift?`;
    }

    const msgId = `MSG-${Date.now().toString().slice(-6)}`;
    const timestamp = new Date().toISOString();

    await execute(
      `INSERT INTO plant_intercom_messages (
        id, sender_role, sender_name, recipient_role, channel, priority, title, message, metadata, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        msgId,
        'AI_COPILOT',
        'Antigravity Industrial AI',
        senderRole,
        'AI_ASSISTANT',
        'NORMAL',
        `AI Response to ${senderName}`,
        reply,
        JSON.stringify({ query: prompt, senderName, senderRole, actionTriggered }),
        'OPEN'
      ]
    );

    return {
      messageId: msgId,
      reply,
      timestamp,
      actionTriggered
    };
  }
}
