import { query } from './mysql.js';
import { getTimescalePool } from './timescale.js';

async function verify() {
  console.log('--- TiDB Cloud Status ---');
  try {
    const machines = await query('SELECT count(*) as cnt FROM machines');
    console.log(`Machines in TiDB: ${machines[0].cnt}`);
    const techs = await query('SELECT count(*) as cnt FROM technicians');
    console.log(`Technicians in TiDB: ${techs[0].cnt}`);
    const parts = await query('SELECT count(*) as cnt FROM spare_parts');
    console.log(`Spare Parts in TiDB: ${parts[0].cnt}`);
    const wos = await query('SELECT count(*) as cnt FROM work_orders');
    console.log(`Work Orders in TiDB: ${wos[0].cnt}`);
  } catch (err: any) {
    console.error('TiDB Query Error:', err.message);
  }

  console.log('\n--- Timescale Cloud Status ---');
  try {
    const ts = getTimescalePool();
    const tsRes = await ts.query('SELECT count(*) as cnt FROM telemetry_logs');
    console.log(`Telemetry logs in Timescale: ${tsRes.rows[0].cnt}`);
  } catch (err: any) {
    console.error('Timescale Query Error:', err.message);
  }
  process.exit(0);
}

verify();
