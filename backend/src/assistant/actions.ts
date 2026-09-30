/**
 * Human-in-the-loop actions. The agent can only PROPOSE writes; a person approves or rejects
 * each one, and only then does it execute through the existing maintenance/inventory services.
 * Every decision is written to the audit log.
 */
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/mysql.js';
import { broadcast } from '../services/socket.service.js';
import { recordAuditLog } from '../services/audit.service.js';
import { createWorkOrderAndDispatch } from '../services/maintenance.service.js';
import { reservePart } from '../services/inventory.service.js';
import { processProcurement } from '../services/procurement.service.js';

export type ActionType = 'CREATE_WORK_ORDER' | 'RESERVE_PART' | 'CREATE_PURCHASE_ORDER';
export type ActionStatus = 'PENDING' | 'EXECUTED' | 'REJECTED' | 'FAILED';

export interface ProposedAction {
  id: string;
  sessionId: string;
  type: ActionType;
  params: Record<string, any>;
  summary: string;
  rationale: string;
  status: ActionStatus;
  result?: any;
  requestedBy: string;
  decidedBy?: string;
  decisionNote?: string;
  createdAt: string;
  decidedAt?: string;
}

const memory = new Map<string, ProposedAction>();
let tableReady: Promise<boolean> | null = null;

function ensureTable(): Promise<boolean> {
  return (tableReady ||= query(`
    CREATE TABLE IF NOT EXISTS assistant_actions (
      id            VARCHAR(40)  NOT NULL PRIMARY KEY,
      session_id    VARCHAR(40)  NOT NULL,
      type          VARCHAR(40)  NOT NULL,
      params        JSON         NOT NULL,
      summary       TEXT         NOT NULL,
      rationale     TEXT         NULL,
      status        VARCHAR(20)  NOT NULL,
      result        JSON         NULL,
      requested_by  VARCHAR(120) NOT NULL,
      decided_by    VARCHAR(120) NULL,
      decision_note TEXT         NULL,
      created_at    DATETIME(3)  NOT NULL,
      decided_at    DATETIME(3)  NULL,
      INDEX idx_aa_status (status),
      INDEX idx_aa_session (session_id)
    )`).then(() => true).catch((err) => {
    console.warn(`[Assistant] assistant_actions table unavailable, using memory: ${err.message}`);
    return false;
  }));
}

const parseJson = (v: any) => (v == null ? undefined : typeof v === 'string' ? JSON.parse(v) : v);

function rowToAction(r: any): ProposedAction {
  return {
    id: r.id,
    sessionId: r.session_id,
    type: r.type,
    params: parseJson(r.params) || {},
    summary: r.summary,
    rationale: r.rationale || '',
    status: r.status,
    result: parseJson(r.result),
    requestedBy: r.requested_by,
    decidedBy: r.decided_by || undefined,
    decisionNote: r.decision_note || undefined,
    createdAt: new Date(r.created_at).toISOString(),
    decidedAt: r.decided_at ? new Date(r.decided_at).toISOString() : undefined,
  };
}

async function save(a: ProposedAction): Promise<void> {
  memory.set(a.id, a);
  if (!(await ensureTable())) return;
  await query(
    `INSERT INTO assistant_actions (id, session_id, type, params, summary, rationale, status, result, requested_by, decided_by, decision_note, created_at, decided_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE status = VALUES(status), result = VALUES(result), decided_by = VALUES(decided_by),
       decision_note = VALUES(decision_note), decided_at = VALUES(decided_at)`,
    [
      a.id, a.sessionId, a.type, JSON.stringify(a.params), a.summary, a.rationale, a.status,
      a.result === undefined ? null : JSON.stringify(a.result), a.requestedBy, a.decidedBy || null,
      a.decisionNote || null, new Date(a.createdAt), a.decidedAt ? new Date(a.decidedAt) : null,
    ]
  ).catch((err) => console.warn(`[Assistant] Could not persist action ${a.id}: ${err.message}`));
}

export async function proposeAction(input: {
  sessionId: string;
  type: ActionType;
  params: Record<string, any>;
  summary: string;
  rationale: string;
  requestedBy: string;
}): Promise<ProposedAction> {
  const action: ProposedAction = {
    id: `ACT-${uuidv4().slice(0, 8).toUpperCase()}`,
    ...input,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  };
  await save(action);
  broadcast('assistant:action_proposed', action);
  return action;
}

export async function getAction(id: string): Promise<ProposedAction | null> {
  if (await ensureTable()) {
    try {
      const rows = await query<any>(`SELECT * FROM assistant_actions WHERE id = ? LIMIT 1`, [id]);
      if (rows[0]) return rowToAction(rows[0]);
    } catch {}
  }
  return memory.get(id) || null;
}

export async function listActions(filter: { status?: ActionStatus; sessionId?: string } = {}): Promise<ProposedAction[]> {
  if (await ensureTable()) {
    try {
      const where: string[] = [];
      const params: any[] = [];
      if (filter.status) { where.push('status = ?'); params.push(filter.status); }
      if (filter.sessionId) { where.push('session_id = ?'); params.push(filter.sessionId); }
      const rows = await query<any>(
        `SELECT * FROM assistant_actions ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT 100`,
        params
      );
      return rows.map(rowToAction);
    } catch {}
  }
  return [...memory.values()]
    .filter((a) => (!filter.status || a.status === filter.status) && (!filter.sessionId || a.sessionId === filter.sessionId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function execute(a: ProposedAction): Promise<any> {
  const p = a.params;
  switch (a.type) {
    case 'CREATE_WORK_ORDER': {
      const incidentId = `INC-AI-${Math.floor(10000 + Math.random() * 90000)}`;
      await query(
        `INSERT INTO incidents (id, machine_id, alert_type, severity, status, ai_diagnosis_summary, ai_root_cause, detected_at)
         VALUES (?, ?, ?, ?, 'DETECTED', ?, 'Raised via AI Assistant (human approved)', CURRENT_TIMESTAMP(3))`,
        [incidentId, p.machineId, p.alertType, p.priority, p.symptom]
      );
      const wo = await createWorkOrderAndDispatch({
        incidentId,
        machineId: p.machineId,
        machineCode: p.machineCode,
        alertType: p.alertType,
        symptom: p.symptom,
        priority: p.priority,
        correlationId: a.id,
      });
      return { incidentId, workOrder: wo };
    }
    case 'RESERVE_PART': {
      const ok = await reservePart(p.workOrderId, p.partId, p.quantity, a.id);
      if (!ok) throw new Error(`Could not reserve ${p.quantity} × ${p.partId} (insufficient available-to-promise stock)`);
      return { reserved: true, workOrderId: p.workOrderId, partId: p.partId, quantity: p.quantity };
    }
    case 'CREATE_PURCHASE_ORDER':
      return processProcurement({
        machineId: p.machineId,
        partId: p.partId,
        quantity: p.quantity,
        workOrderId: p.workOrderId,
        actor: `AI_ASSISTANT (approved by ${a.decidedBy})`,
        correlationId: a.id,
      });
  }
}

// Which roles may approve each kind of proposal (mirrors the frontend RBAC role keys)
export const APPROVER_ROLES: Record<ActionType, string[]> = {
  CREATE_WORK_ORDER: ['PLANT_ADMIN', 'MANAGER', 'SUPERVISOR'],
  RESERVE_PART: ['PLANT_ADMIN', 'SUPERVISOR', 'INVENTORY_MGMT'],
  CREATE_PURCHASE_ORDER: ['PLANT_ADMIN', 'MANAGER', 'INVENTORY_MGMT'],
};

export class ForbiddenError extends Error {}

export async function decideAction(
  id: string,
  decision: 'approve' | 'reject',
  decider: { name: string; role?: string; roleKey?: string },
  note?: string
): Promise<ProposedAction> {
  const action = await getAction(id);
  if (!action) throw new Error(`Action ${id} not found`);
  if (action.status !== 'PENDING') throw new Error(`Action ${id} is already ${action.status}`);
  if (decision === 'approve' && !APPROVER_ROLES[action.type].includes(String(decider.roleKey || ''))) {
    throw new ForbiddenError(`Your role cannot approve ${action.type.replace(/_/g, ' ').toLowerCase()} requests`);
  }

  action.decidedBy = decider.role ? `${decider.name} (${decider.role})` : decider.name;
  action.decisionNote = note;
  action.decidedAt = new Date().toISOString();

  if (decision === 'reject') {
    action.status = 'REJECTED';
  } else {
    try {
      action.result = await execute(action);
      action.status = 'EXECUTED';
    } catch (err: any) {
      action.status = 'FAILED';
      action.result = { error: err.message };
    }
  }

  await save(action);
  await recordAuditLog({
    actor: action.decidedBy,
    action: `ASSISTANT_ACTION_${decision === 'approve' ? action.status : 'REJECTED'}`,
    resourceType: action.type,
    resourceId: action.id,
    newState: { params: action.params, result: action.result },
    reason: note || action.rationale,
    correlationId: action.id,
  }).catch(() => {});
  broadcast('assistant:action_updated', action);
  return action;
}
