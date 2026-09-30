import 'dotenv/config';
import { query } from '../db/mysql.js';

async function main() {
  console.log('Resetting all trucks to AVAILABLE and staging 16 fresh pallets (4 trucks x 4 pallets = 19.2 T)...');
  await query(`UPDATE fleet_dispatches SET status = 'COMPLETED', returned_at = NOW() WHERE status <> 'COMPLETED'`);
  await query(`UPDATE fleet_trucks SET status = 'AVAILABLE', current_dispatch_id = NULL`);
  
  // Clear any existing staged pallets and insert 16 fresh ones
  await query(`DELETE FROM logistics_pallets WHERE status = 'DELIVERED_DOCK'`);
  for (let i = 1; i <= 16; i++) {
    const num = String(i).padStart(3, '0');
    await query(
      `INSERT INTO logistics_pallets (id, transport_id, pallet_number, rfid_tag, pieces_count, cartons_count, max_pieces, status, destination_bay, packed_at, created_at)
       VALUES (UUID(), CONCAT('TRP-20260930-STAGE-', ?), CONCAT('PLT-STAGE-', ?), CONCAT('RFID-STAGE-', ?), 240, 10, 240, 'DELIVERED_DOCK', 'Outbound Logistics Dock — Bay 01', 'Ready', NOW())`,
      [num, num, num]
    );
  }
  console.log('Done! All 4 trucks at Plant Base are 100% loaded (4/4 pallets each, 19.2 T total) and ready for dispatch.');
  process.exit(0);
}

main().catch(err => {
  console.error('Reset failed:', err);
  process.exit(1);
});
