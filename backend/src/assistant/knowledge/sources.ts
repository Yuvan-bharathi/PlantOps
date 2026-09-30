/**
 * Knowledge sources for RAG — all database-backed or part of the plant's own workflows:
 *  - SOPs                 TiDB sop_documents
 *  - Incident history     TiDB incidents + work_orders (+ technicians, machines)
 *  - LOTO protocols       OSHA 1910.147 isolation steps used by the maintenance workflow
 *  - Inspection points    the orchestrator's per-machine-type inspection checklists
 * Live values (status, telemetry, stock, production) are never indexed — tools read them fresh.
 */
import { query } from '../../db/mysql.js';
import { PLANT_SOPS } from '../../db/knowledgeBase.js';
import { getLotoProtocolForMachine } from '../../services/maintenance.service.js';
import { RECOMMENDED_INSPECTION_POINTS, REQUIRED_SKILLS_MAP } from '../../services/aiOrchestrator.service.js';

export type SourceType = 'SOP' | 'LOTO' | 'INSPECTION' | 'INCIDENT' | 'WORK_ORDER';

export interface KnowledgeDoc {
  id: string;
  sourceType: SourceType;
  title: string;
  ref: string; // human reference shown in citations (SOP code, incident id, file name)
  machineType?: string;
  machineCode?: string;
  text: string; // markdown; "## " headings become chunk sections
}

const MACHINE_TYPES = Object.keys(REQUIRED_SKILLS_MAP);

// ── Static procedures ────────────────────────────────────────────────────────

// SOPs live in TiDB (`sop_documents`). The table is seeded once from the built-in SOP library so
// existing deployments keep working; after that, the database is the source of truth.
async function ensureSopTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS sop_documents (
      id           VARCHAR(40)  NOT NULL PRIMARY KEY,
      code         VARCHAR(60)  NOT NULL,
      title        VARCHAR(255) NOT NULL,
      machine_type VARCHAR(30)  NOT NULL,
      subsystem    VARCHAR(120) NULL,
      revision     VARCHAR(80)  NULL,
      sections     JSON         NOT NULL,
      updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);
  const [{ n }] = await query<{ n: number }>(`SELECT COUNT(*) AS n FROM sop_documents`);
  if (Number(n) > 0) return;
  for (const sop of PLANT_SOPS) {
    await query(
      `INSERT INTO sop_documents (id, code, title, machine_type, subsystem, revision, sections) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [sop.id, sop.code, sop.title, sop.machineType.toUpperCase(), sop.subsystem, sop.revision, JSON.stringify(sop.sections)]
    );
  }
  console.log(`[Assistant] Seeded ${PLANT_SOPS.length} SOPs into TiDB sop_documents`);
}

async function sopDocs(): Promise<KnowledgeDoc[]> {
  await ensureSopTable();
  const rows = await query<any>(`SELECT * FROM sop_documents ORDER BY code`);
  return rows.map((r) => {
    const sections: { heading: string; content: string; specs?: Record<string, string> }[] =
      typeof r.sections === 'string' ? JSON.parse(r.sections) : r.sections || [];
    return {
      id: `sop:${r.id}`,
      sourceType: 'SOP' as const,
      title: r.title,
      ref: r.code,
      machineType: String(r.machine_type).toUpperCase(),
      text: [
        `# ${r.title}`,
        `SOP code: ${r.code} · Revision ${r.revision || 'n/a'} · Machine type: ${r.machine_type} · Subsystem: ${r.subsystem || 'n/a'}`,
        ...sections.map((s) =>
          [`## ${s.heading}`, s.content, s.specs ? Object.entries(s.specs).map(([k, v]) => `- ${k}: ${v}`).join('\n') : ''].join('\n')
        ),
      ].join('\n\n'),
    };
  });
}

function lotoDocs(): KnowledgeDoc[] {
  return MACHINE_TYPES.map((type) => {
    const p = getLotoProtocolForMachine(type, `${type} units`);
    return {
      id: `loto:${type}`,
      sourceType: 'LOTO' as const,
      title: `LOTO energy isolation protocol — ${type} machines`,
      ref: `LOTO-${type}`,
      machineType: type,
      text: [
        `# Lockout / Tagout protocol for ${type} machines`,
        `Standard: ${p.oshaStandard}. Lockout box location: ${p.lockoutBoxLocation}.`,
        `## Required PPE`,
        p.requiredPpe.map((x) => `- ${x}`).join('\n'),
        `## Isolation steps`,
        p.isolationSteps
          .map(
            (s, i) =>
              `${i + 1}. **${s.title}** (${s.category}) — at ${s.location}. ${s.procedure} Target zero-energy state: ${s.targetZeroState}.`
          )
          .join('\n'),
      ].join('\n\n'),
    };
  });
}

function inspectionDocs(): KnowledgeDoc[] {
  return MACHINE_TYPES.map((type) => ({
    id: `inspect:${type}`,
    sourceType: 'INSPECTION' as const,
    title: `Recommended inspection points and required skills — ${type} machines`,
    ref: `INSPECT-${type}`,
    machineType: type,
    text: [
      `# Inspection checklist for ${type} machines`,
      `## Recommended inspection points`,
      (RECOMMENDED_INSPECTION_POINTS[type] || []).map((x) => `- ${x}`).join('\n'),
      `## Technician skills required for ${type} repairs`,
      (REQUIRED_SKILLS_MAP[type] || []).map((x) => `- ${x.replace(/_/g, ' ').toLowerCase()}`).join('\n'),
    ].join('\n\n'),
  }));
}

// ── Operational history (incidents + work orders) ────────────────────────────

const fmtTs = (v: any) => (v ? new Date(new Date(v).getTime() + 330 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 16) + ' IST' : null);

async function historyDocs(): Promise<KnowledgeDoc[]> {
  const [incidents, workOrders] = await Promise.all([
    query<any>(`
      SELECT i.*, m.code AS machine_code, m.name AS machine_name, m.type AS machine_type, m.area
      FROM incidents i LEFT JOIN machines m ON m.id = i.machine_id
      ORDER BY i.detected_at DESC LIMIT 500`),
    query<any>(`
      SELECT w.*, m.code AS machine_code, m.type AS machine_type, t.name AS technician_name
      FROM work_orders w
      LEFT JOIN machines m ON m.id = w.machine_id
      LEFT JOIN technicians t ON t.id = w.technician_id
      ORDER BY w.created_at DESC LIMIT 500`),
  ]);

  const woByIncident = new Map<string, any[]>();
  for (const w of workOrders) {
    if (!w.incident_id) continue;
    if (!woByIncident.has(w.incident_id)) woByIncident.set(w.incident_id, []);
    woByIncident.get(w.incident_id)!.push(w);
  }

  const docs: KnowledgeDoc[] = incidents.map((i) => {
    const wos = woByIncident.get(i.id) || [];
    const code = i.machine_code || String(i.machine_id || '').replace(/^MCH-/, '');
    let actions = '';
    if (i.ai_recommended_actions) {
      try {
        const parsed = typeof i.ai_recommended_actions === 'string' ? JSON.parse(i.ai_recommended_actions) : i.ai_recommended_actions;
        actions = Array.isArray(parsed) ? parsed.map((a: any) => `- ${typeof a === 'string' ? a : JSON.stringify(a)}`).join('\n') : String(parsed);
      } catch {
        actions = String(i.ai_recommended_actions);
      }
    }
    return {
      id: `incident:${i.id}`,
      sourceType: 'INCIDENT' as const,
      title: `Incident ${i.id} on ${code}: ${i.alert_type}`,
      ref: i.id,
      machineType: i.machine_type || undefined,
      machineCode: code,
      text: [
        `# Incident ${i.id} — ${i.alert_type}`,
        `Machine: ${code} (${i.machine_name || 'unknown'}, type ${i.machine_type || '?'}, ${i.area || 'area unknown'}). Severity: ${i.severity}. Status: ${i.status}.`,
        `Detected: ${fmtTs(i.detected_at) || 'unknown'}. Machine back running: ${fmtTs(i.machine_running_at) || 'not recorded'}.` +
          (i.downtime_seconds ? ` Downtime: ${Math.round(i.downtime_seconds / 60)} minutes.` : ''),
        i.ai_root_cause || i.ai_diagnosis_summary
          ? `## Diagnosis\nRoot cause: ${i.ai_root_cause || 'n/a'}.\n${i.ai_diagnosis_summary || ''}`
          : '',
        actions ? `## Recommended actions\n${actions}` : '',
        i.required_part_id ? `Required part: ${i.required_part_id}.` : '',
        wos.length
          ? `## Work orders\n` +
            wos
              .map(
                (w) =>
                  `- ${w.id} (${w.priority}, ${w.status}) technician ${w.technician_name || w.technician_id || 'unassigned'}` +
                  `${w.loto_applied ? ', LOTO applied' : ''}${w.completed_at ? `, completed ${fmtTs(w.completed_at)}` : ''}. ${w.notes || ''}`
              )
              .join('\n')
          : '',
      ]
        .filter(Boolean)
        .join('\n\n'),
    };
  });

  // Work orders that are not attached to an incident
  for (const w of workOrders) {
    if (w.incident_id && incidents.some((i) => i.id === w.incident_id)) continue;
    docs.push({
      id: `wo:${w.id}`,
      sourceType: 'WORK_ORDER',
      title: `Work order ${w.id} on ${w.machine_code || w.machine_id}`,
      ref: w.id,
      machineType: w.machine_type || undefined,
      machineCode: w.machine_code || undefined,
      text: `# Work order ${w.id}\nMachine ${w.machine_code || w.machine_id}. Priority ${w.priority}, status ${w.status}. Technician: ${
        w.technician_name || w.technician_id || 'unassigned'
      }. Created ${fmtTs(w.created_at)}.\n\n${w.notes || ''}`,
    });
  }
  return docs;
}

export async function collectKnowledgeDocs(): Promise<{ docs: KnowledgeDoc[]; warnings: string[] }> {
  const warnings: string[] = [];
  const docs: KnowledgeDoc[] = [...lotoDocs(), ...inspectionDocs()];
  try {
    docs.push(...(await sopDocs()));
  } catch (err: any) {
    warnings.push(`SOPs unavailable from TiDB: ${err.message}`);
  }
  try {
    docs.push(...(await historyDocs()));
  } catch (err: any) {
    warnings.push(`Incident/work-order history unavailable from TiDB: ${err.message}`);
  }
  return { docs, warnings };
}
