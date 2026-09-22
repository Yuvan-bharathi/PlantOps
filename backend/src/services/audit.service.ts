import { v4 as uuidv4 } from 'uuid';
import { execute } from '../db/mysql.js';

export interface AuditLogEntry {
  actor: string;
  action: string;
  resourceType: string;
  resourceId: string;
  previousState?: any;
  newState?: any;
  reason?: string;
  correlationId?: string;
}

export async function recordAuditLog(entry: AuditLogEntry): Promise<string> {
  const id = `AUD-${uuidv4().substring(0, 8)}`;
  const correlationId = entry.correlationId || `CORR-${uuidv4().substring(0, 8)}`;

  try {
    await execute(
      `INSERT INTO audit_logs (id, actor, action, resource_type, resource_id, previous_state, new_state, reason, correlation_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        entry.actor,
        entry.action,
        entry.resourceType,
        entry.resourceId,
        entry.previousState ? JSON.stringify(entry.previousState) : null,
        entry.newState ? JSON.stringify(entry.newState) : null,
        entry.reason || null,
        correlationId
      ]
    );
  } catch (err: any) {
    console.warn(`[AuditService] Could not persist audit log to MySQL: ${err.message}`);
  }

  return id;
}
