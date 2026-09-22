import pg from 'pg';
import { config } from '../config/index.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getTimescalePool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      host: config.timescale.host,
      port: config.timescale.port,
      user: config.timescale.user,
      password: config.timescale.password,
      database: config.timescale.database,
      ssl: config.timescale.ssl,
      max: config.timescale.max,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });
  }
  return pool;
}

export async function testTimescaleConnection(): Promise<boolean> {
  try {
    const p = getTimescalePool();
    await p.query('SELECT 1');
    console.log('[TimescaleDB] Connected to plantops_telemetry successfully.');
    return true;
  } catch (err: any) {
    console.warn(`[TimescaleDB] Connection warning: ${err.message}. Retrying queries as needed.`);
    return false;
  }
}
