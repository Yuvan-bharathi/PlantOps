import { query, testMySqlConnection } from '../db/mysql.js';

async function main() {
  console.log('Testing TiDB Cloud connection...');
  const connected = await testMySqlConnection();
  console.log('Connection test result:', connected);

  if (connected) {
    const version = await query('SELECT VERSION() as tidb_version, DATABASE() as current_db, NOW() as db_time');
    console.log('TiDB Cloud Info:', version);

    const tables = await query('SHOW TABLES');
    console.log(`Found ${tables.length} tables in TiDB Cloud:`, tables.map((t: any) => Object.values(t)[0]));

    const machines = await query('SELECT code, name, status, health_score FROM machines LIMIT 5');
    console.log('Sample Machines from TiDB Cloud:', machines);
  }
}

main().catch(console.error);
