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

