import { query } from '../db/mysql.js';

export interface PolicyEvaluationInput {
  incidentId: string;
  machineId: string;
  machineCriticality: string;
  partId: string;
  unitPrice: number;
  quantity: number;
  totalAmount: number;
  aiConfidence: number;
  supplierId: string;
  supplierStatus: string;
}

export interface PolicyDecision {
  action: 'ALLOW' | 'REQUIRE_HUMAN_REVIEW' | 'BLOCK';
  policyCode: string;
  reason: string;
  passedRules: string[];
  violatedRules: string[];
}

export async function evaluateProcurementPolicy(input: PolicyEvaluationInput): Promise<PolicyDecision> {
  const passedRules: string[] = [];
  const violatedRules: string[] = [];

  // Rule 1: Anti-Loop Duplicate Order Guard
  try {
    const duplicateRows = await query<any>(
      `SELECT id, created_at FROM purchase_orders 
       WHERE (incident_id = ? OR part_id = ?) 
         AND status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT')
         AND created_at >= NOW() - INTERVAL 60 MINUTE LIMIT 1`,
      [input.incidentId, input.partId]
    );

    if (duplicateRows.length > 0) {
      violatedRules.push('Anti-Loop Guard: Duplicate active PO exists in last 60 minutes');
      return {
        action: 'BLOCK',
        policyCode: 'POL-03',
        reason: `Duplicate active PO (${duplicateRows[0].id}) already created for this incident/part within the last 60 minutes.`,
        passedRules,
        violatedRules
      };
    }
    passedRules.push('Anti-Loop Duplicate Check Passed');
  } catch (err) {
    console.warn('[PolicyEngine] Error running duplicate check:', err);
  }

  // Rule 2: Supplier Status Check
  if (input.supplierStatus === 'BLOCKED' || input.supplierStatus === 'RESTRICTED') {
    violatedRules.push(`Supplier is ${input.supplierStatus}`);
    return {
      action: 'BLOCK',
      policyCode: 'POL-SUP-GUARD',
      reason: `Supplier ${input.supplierId} is in ${input.supplierStatus} state. Autonomous procurement forbidden.`,
      passedRules,
      violatedRules
    };
  }
  passedRules.push('Supplier Status Vetted & Active');

  // Rule 3: AI Confidence Threshold
  if (input.aiConfidence < 0.85) {
    violatedRules.push(`AI Diagnosis Confidence (${(input.aiConfidence * 100).toFixed(1)}%) < required 85.0% threshold`);
    return {
      action: 'REQUIRE_HUMAN_REVIEW',
      policyCode: 'POL-02',
      reason: `AI confidence is ${(input.aiConfidence * 100).toFixed(1)}%, below autonomous 85.0% threshold. Escalating to Plant Maintenance Manager.`,
      passedRules,
      violatedRules
    };
  }
  passedRules.push(`AI Confidence ${(input.aiConfidence * 100).toFixed(1)}% satisfies >= 85% requirement`);

  // Rule 4: Spend Limit Guard ($1,000 max autonomous spend)
  const MAX_AUTONOMOUS_SPEND = 1000.00;
  if (input.totalAmount > MAX_AUTONOMOUS_SPEND) {
    violatedRules.push(`Total amount ($${input.totalAmount.toFixed(2)}) exceeds autonomous cap ($${MAX_AUTONOMOUS_SPEND})`);
    return {
      action: 'REQUIRE_HUMAN_REVIEW',
      policyCode: 'POL-02',
      reason: `Purchase order total ($${input.totalAmount.toFixed(2)}) exceeds maximum autonomous limit ($${MAX_AUTONOMOUS_SPEND}). Requires Plant Manager financial approval.`,
      passedRules,
      violatedRules
    };
  }
  passedRules.push(`Total spend ($${input.totalAmount.toFixed(2)}) is within autonomous limit ($${MAX_AUTONOMOUS_SPEND})`);

  // All deterministic criteria satisfied -> ALLOW
  return {
    action: 'ALLOW',
    policyCode: 'POL-01',
    reason: `All policy rules satisfied: Machine criticality ${input.machineCriticality}, vetted supplier, AI confidence ${(input.aiConfidence * 100).toFixed(1)}%, spend $${input.totalAmount.toFixed(2)} <= $${MAX_AUTONOMOUS_SPEND}.`,
    passedRules,
    violatedRules
  };
}
