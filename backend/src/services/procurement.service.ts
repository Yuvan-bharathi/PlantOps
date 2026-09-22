import { v4 as uuidv4 } from 'uuid';
import { query, execute } from '../db/mysql.js';
import { evaluateProcurementPolicy } from './policyEngine.service.js';
import { recordAuditLog } from './audit.service.js';
import { broadcast } from './socket.service.js';
import { receiveGoodsReceipt } from './inventory.service.js';
import { notifyPartAvailable } from './maintenance.service.js';

export interface CreatePORequest {
  incidentId?: string;
  workOrderId?: string;
  machineId: string;
  partId: string;
  quantity?: number;
  aiConfidence?: number;
  actor?: string;
  correlationId?: string;
}

export async function processProcurement(req: CreatePORequest) {
  const quantity = req.quantity || 1;
  const correlationId = req.correlationId || `CORR-${uuidv4().substring(0, 8)}`;
  const actor = req.actor || 'AI_PROCUREMENT_AGENT';

  try {
    // 1. Fetch Machine info
    const machineRows = await query<any>(`SELECT id, name, criticality FROM machines WHERE id = ? OR code = ? LIMIT 1`, [req.machineId, req.machineId]);
    const machine = machineRows[0] || { id: req.machineId, name: req.machineId, criticality: 'HIGH' };

    // 2. Fetch Part and Preferred Supplier
    const partSupplierRows = await query<any>(
      `SELECT p.id as partId, p.part_number as partNumber, p.name as partName,
              s.id as supplierId, s.name as supplierName, s.status as supplierStatus,
              COALESCE(ps.unit_price, p.unit_cost) as unitPrice,
              COALESCE(ps.lead_time_days, 1) as leadTimeDays
       FROM spare_parts p
       LEFT JOIN part_suppliers ps ON p.id = ps.part_id AND ps.is_preferred = TRUE
       LEFT JOIN suppliers s ON ps.supplier_id = s.id
       WHERE p.id = ? OR p.part_number = ? LIMIT 1`,
      [req.partId, req.partId]
    );

    if (partSupplierRows.length === 0) {
      console.warn(`[ProcurementService] Part ${req.partId} not found`);
      return null;
    }

    const item = partSupplierRows[0];
    const unitPrice = parseFloat(item.unitPrice || '145.00');
    const totalAmount = unitPrice * quantity;
    const aiConfidence = req.aiConfidence || 0.942;
    const supplierId = item.supplierId || 'SUP-SKF-DIRECT';
    const supplierStatus = item.supplierStatus || 'ACTIVE';

    // 3. Evaluate Policy Engine
    const decision = await evaluateProcurementPolicy({
      incidentId: req.incidentId || 'INC-TEMP',
      machineId: machine.id,
      machineCriticality: machine.criticality,
      partId: item.partId,
      unitPrice,
      quantity,
      totalAmount,
      aiConfidence,
      supplierId,
      supplierStatus
    });

    const poId = `PO-${Math.floor(1000 + Math.random() * 9000)}`;
    const isAutoAllowed = decision.action === 'ALLOW';
    const status = isAutoAllowed ? 'SENT' : (decision.action === 'BLOCK' ? 'CANCELLED' : 'PENDING_APPROVAL');
    const approvalType = isAutoAllowed ? 'AUTONOMOUS_POLICY' : 'HUMAN_APPROVED';

    // 4. Insert Purchase Order
    await execute(
      `INSERT INTO purchase_orders (id, incident_id, work_order_id, part_id, supplier_id, quantity, unit_price, total_amount, status, approval_type, policy_id_applied, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        poId,
        req.incidentId || null,
        req.workOrderId || null,
        item.partId,
        supplierId,
        quantity,
        unitPrice,
        totalAmount,
        status,
        approvalType,
        decision.policyCode,
        actor
      ]
    );

    // 5. If requires human review, create Review Item
    let reviewId: string | null = null;
    if (decision.action === 'REQUIRE_HUMAN_REVIEW') {
      reviewId = `REV-${uuidv4().substring(0, 8)}`;
      await execute(
        `INSERT INTO human_review_items (id, item_type, reference_id, title, reason, required_role, status)
         VALUES (?, 'PURCHASE_ORDER_APPROVAL', ?, ?, ?, 'Plant Maintenance Manager', 'PENDING')`,
        [
          reviewId,
          poId,
          `Purchase Order Approval Required: ${item.partName} ($${totalAmount.toFixed(2)})`,
          decision.reason
        ]
      );
    }

    // 6. Record Audit Log
    await recordAuditLog({
      actor,
      action: isAutoAllowed ? 'AUTONOMOUS_PO_RELEASED' : (decision.action === 'BLOCK' ? 'PO_POLICY_BLOCKED' : 'PO_ESCALATED_HUMAN_REVIEW'),
      resourceType: 'PURCHASE_ORDER',
      resourceId: poId,
      newState: { poId, totalAmount, status, policyCode: decision.policyCode, decision },
      reason: decision.reason,
      correlationId
    });

    // 7. Realtime Broadcast
    const poPayload = {
      poId,
      incidentId: req.incidentId,
      workOrderId: req.workOrderId,
      machineId: req.machineId,
      partNumber: item.partNumber,
      partName: item.partName,
      supplierName: item.supplierName || 'SKF Direct',
      quantity,
      unitPrice,
      totalAmount,
      status,
      approvalType,
      decision,
      reviewId
    };

    broadcast('po:updated', poPayload);

    // 8. If Autonomous PO was released, simulate automated expedited fulfillment (GRN receipt in 4 seconds for capstone demo!)
    if (isAutoAllowed) {
      setTimeout(async () => {
        try {
          await execute(`UPDATE purchase_orders SET status = 'RECEIVED', received_at = NOW() WHERE id = ?`, [poId]);
          await receiveGoodsReceipt(poId, item.partId, quantity, 'AI_PROCUREMENT_AGENT', correlationId);
          broadcast('po:received', { poId, partId: item.partId, quantity });
          if (req.workOrderId) {
            await notifyPartAvailable(req.workOrderId, item.partId);
          }
          console.log(`[ProcurementService] Simulated delivery & Goods Receipt (GRN) received for PO ${poId}`);
        } catch (err: any) {
          console.error(`[ProcurementService] Error processing mock goods receipt: ${err.message}`);
        }
      }, 4000);
    }

    return poPayload;
  } catch (err: any) {
    console.error(`[ProcurementService] processProcurement error: ${err.message}`);
    return null;
  }
}

export async function approveHumanReviewItem(reviewId: string, reviewer: string, notes?: string) {
  try {
    const reviewRows = await query<any>(`SELECT * FROM human_review_items WHERE id = ? LIMIT 1`, [reviewId]);
    if (reviewRows.length === 0) return false;
    const review = reviewRows[0];

    await execute(
      `UPDATE human_review_items SET status = 'APPROVED', reviewed_by = ?, reviewer_notes = ?, reviewed_at = NOW() WHERE id = ?`,
      [reviewer, notes || 'Approved by Manager via PlantOps Review Center', reviewId]
    );

    if (review.item_type === 'PURCHASE_ORDER_APPROVAL') {
      const poId = review.reference_id;
      await execute(`UPDATE purchase_orders SET status = 'SENT', approved_at = NOW() WHERE id = ?`, [poId]);
      
      const poRows = await query<any>(`SELECT * FROM purchase_orders WHERE id = ? LIMIT 1`, [poId]);
      if (poRows.length > 0) {
        const po = poRows[0];
        // Simulate goods receipt in 4s
        setTimeout(async () => {
          await execute(`UPDATE purchase_orders SET status = 'RECEIVED', received_at = NOW() WHERE id = ?`, [poId]);
          await receiveGoodsReceipt(poId, po.part_id, po.quantity, reviewer);
          broadcast('po:received', { poId, partId: po.part_id, quantity: po.quantity });
          if (po.work_order_id) {
            await notifyPartAvailable(po.work_order_id, po.part_id);
          }
        }, 4000);
      }
    }

    await recordAuditLog({
      actor: reviewer,
      action: 'HUMAN_REVIEW_APPROVED',
      resourceType: 'HUMAN_REVIEW',
      resourceId: reviewId,
      reason: notes || 'Manager Approval Granted'
    });

    broadcast('review:approved', { reviewId, reviewer });
    return true;
  } catch (err: any) {
    console.error(`[ProcurementService] approveHumanReviewItem error: ${err.message}`);
    return false;
  }
}
