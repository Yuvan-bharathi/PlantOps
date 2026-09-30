import { query } from '../db/mysql.js';

async function testSchemaAndData() {
  console.log('--- Inspecting TiDB Cloud Schema & Data ---');

  const descSpareParts = await query('DESCRIBE spare_parts');
  console.log('Columns in spare_parts:', descSpareParts.map((c: any) => `${c.Field} (${c.Type})`));

  const parts = await query('SELECT * FROM spare_parts LIMIT 3');
  console.log('Sample spare_parts data:', parts);

  const [woCount] = await query<{ count: number }>('SELECT COUNT(*) as count FROM work_orders');
  console.log(`TiDB Work Orders Count: ${woCount.count}`);

  const [incCount] = await query<{ count: number }>('SELECT COUNT(*) as count FROM incidents');
  console.log(`TiDB Incidents Count: ${incCount.count}`);

  const [techCount] = await query<{ count: number }>('SELECT COUNT(*) as count FROM technicians');
  console.log(`TiDB Certified Technicians: ${techCount.count}`);

  console.log('--- TiDB Cloud Live Verification COMPLETE ---');
}

testSchemaAndData().catch(console.error);
