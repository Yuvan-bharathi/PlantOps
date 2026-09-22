import mysql, { Pool, PoolConnection } from 'mysql2/promise';
import { config } from '../config/index.js';

let pool: Pool | null = null;

export function getMySqlPool(): Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: config.mysql.host,
      port: config.mysql.port,
      user: config.mysql.user,
      password: config.mysql.password,
      database: config.mysql.database,
      ssl: config.mysql.ssl,
      waitForConnections: true,
      connectionLimit: config.mysql.connectionLimit,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000
    });
  }
  return pool;
}

export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const p = getMySqlPool();
  const [rows] = await p.query(sql, params);
  return rows as T[];
}

export async function execute(sql: string, params?: any[]): Promise<any> {
  const p = getMySqlPool();
  const [result] = await p.execute(sql, params);
  return result;
}

export async function runDatabaseMigrations(): Promise<void> {
  try {
    // 1. Create incident_events table if not exists
    await execute(`
      CREATE TABLE IF NOT EXISTS incident_events (
        id              VARCHAR(40)  NOT NULL PRIMARY KEY,
        incident_id     VARCHAR(40)  NOT NULL,
        work_order_id   VARCHAR(40)  NULL,
        machine_id      VARCHAR(40)  NOT NULL,
        event_type      VARCHAR(60)  NOT NULL,
        actor_type      VARCHAR(30)  NOT NULL DEFAULT 'SYSTEM',
        actor_id        VARCHAR(80)  NULL,
        metadata        JSON         NULL,
        event_ts        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        INDEX idx_iev_incident  (incident_id, event_ts),
        INDEX idx_iev_machine   (machine_id, event_ts)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 2. Add phase timestamp columns to incidents if they don't exist
    const columnsToAdd = [
      { name: 'scenario_id', type: 'VARCHAR(30) NULL' },
      { name: 'assignment_started_at', type: 'DATETIME(3) NULL' },
      { name: 'assigned_at', type: 'DATETIME(3) NULL' },
      { name: 'technician_dispatched_at', type: 'DATETIME(3) NULL' },
      { name: 'technician_arrived_at', type: 'DATETIME(3) NULL' },
      { name: 'loto_started_at', type: 'DATETIME(3) NULL' },
      { name: 'loto_completed_at', type: 'DATETIME(3) NULL' },
      { name: 'inspection_started_at', type: 'DATETIME(3) NULL' },
      { name: 'inspection_completed_at', type: 'DATETIME(3) NULL' },
      { name: 'repair_started_at', type: 'DATETIME(3) NULL' },
      { name: 'repair_completed_at', type: 'DATETIME(3) NULL' },
      { name: 'verification_started_at', type: 'DATETIME(3) NULL' },
      { name: 'verification_completed_at', type: 'DATETIME(3) NULL' },
      { name: 'machine_running_at', type: 'DATETIME(3) NULL' },
      { name: 'downtime_seconds', type: 'FLOAT NULL' }
    ];

    for (const col of columnsToAdd) {
      const existing = await query<{ cnt: number }>(`
        SELECT COUNT(*) as cnt FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'incidents' AND COLUMN_NAME = ?
      `, [col.name]);

      if (existing[0]?.cnt === 0) {
        await execute(`ALTER TABLE incidents ADD COLUMN \`${col.name}\` ${col.type}`);
        console.log(`[MySQL Migration] Added column \`${col.name}\` to incidents`);
      }
    }

    // 3. Machine runtime/downtime tracking columns
    const machineColumnsToAdd = [
      { name: 'last_running_started_at', type: 'DATETIME(3) NULL' },
      { name: 'total_runtime_seconds', type: 'DOUBLE NOT NULL DEFAULT 0' },
      { name: 'downtime_started_at', type: 'DATETIME(3) NULL' },
    ];
    for (const col of machineColumnsToAdd) {
      const existing = await query<{ cnt: number }>(`
        SELECT COUNT(*) as cnt FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'machines' AND COLUMN_NAME = ?
      `, [col.name]);
      if (existing[0]?.cnt === 0) {
        await execute(`ALTER TABLE machines ADD COLUMN \`${col.name}\` ${col.type}`);
        console.log(`[MySQL Migration] Added column \`${col.name}\` to machines`);
      }
    }
    // Backfill: machines already RUNNING with no runtime clock started yet begin accruing now.
    await execute(
      `UPDATE machines SET last_running_started_at = CURRENT_TIMESTAMP(3) WHERE status = 'RUNNING' AND last_running_started_at IS NULL`
    );

    // 3b. `machine_components` / `sensor_thresholds` are queried by
    // GET /machines and GET /machines/:codeOrId but were never created by any
    // schema script. Every call to those routes has therefore always thrown
    // and silently fallen back to the hardcoded MOCK_MACHINES array (static,
    // always RUNNING) — this is why status changes made by the maintenance
    // lifecycle kept appearing to "revert to RUNNING" after any refreshAll().
    await execute(`
      CREATE TABLE IF NOT EXISTS machine_components (
        id              VARCHAR(50) NOT NULL PRIMARY KEY,
        machine_id      VARCHAR(50) NOT NULL,
        name            VARCHAR(150) NOT NULL,
        component_type  VARCHAR(50) NOT NULL DEFAULT 'GENERIC',
        criticality     ENUM('CRITICAL','HIGH','MEDIUM','LOW') NOT NULL DEFAULT 'MEDIUM',
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_mc_machine (machine_id),
        FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await execute(`
      CREATE TABLE IF NOT EXISTS sensor_thresholds (
        id                VARCHAR(50) NOT NULL PRIMARY KEY,
        machine_id        VARCHAR(50) NOT NULL,
        sensor_type       VARCHAR(50) NOT NULL,
        warning_threshold FLOAT NULL,
        fault_threshold   FLOAT NULL,
        unit              VARCHAR(20) NULL,
        INDEX idx_st_machine (machine_id),
        FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    // inventory.service.ts's reservePart() has always depended on this table;
    // without it every inspection-phase part reservation silently failed
    // (caught by the route's broad try/catch), so ATP inventory counts never
    // actually reflected reserved parts.
    await execute(`
      CREATE TABLE IF NOT EXISTS part_reservations (
        id             VARCHAR(50) NOT NULL PRIMARY KEY,
        work_order_id  VARCHAR(50) NOT NULL,
        part_id        VARCHAR(50) NOT NULL,
        quantity       INT NOT NULL DEFAULT 1,
        status         ENUM('RESERVED','CONSUMED','RELEASED') NOT NULL DEFAULT 'RESERVED',
        created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_pr_wo (work_order_id),
        INDEX idx_pr_part (part_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 4. Technician lifecycle phase column on work_orders (independent of the coarse
    // technicians.status enum — tracks exactly where the assigned technician is in
    // the maintenance workflow for this specific work order).
    const woExisting = await query<{ cnt: number }>(`
      SELECT COUNT(*) as cnt FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'work_orders' AND COLUMN_NAME = 'technician_phase'
    `);
    if (woExisting[0]?.cnt === 0) {
      await execute(`ALTER TABLE work_orders ADD COLUMN \`technician_phase\` VARCHAR(20) NOT NULL DEFAULT 'ASSIGNED'`);
      console.log('[MySQL Migration] Added column `technician_phase` to work_orders');
    }

    console.log('[MySQL Migration] Schema migrations up to date.');
  } catch (err: any) {
    console.warn(`[MySQL Migration] Migration check failed: ${err.message}`);
  }
}

export async function testMySqlConnection(): Promise<boolean> {
  try {
    const rows = await query('SELECT 1 as connected');
    console.log('[MySQL] Connected to plantops_db successfully.');
    await runDatabaseMigrations();
    return true;
  } catch (err: any) {
    console.warn(`[MySQL] Connection warning: ${err.message}. Retrying queries as needed.`);
    return false;
  }
}

