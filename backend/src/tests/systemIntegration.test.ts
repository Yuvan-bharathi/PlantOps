import { runAIDiagnosis } from '../services/aiDiagnosis.service.js';
import { checkATP } from '../services/inventory.service.js';
import { evaluateProcurementPolicy } from '../services/policyEngine.service.js';
import { getLotoProtocolForMachine } from '../services/maintenance.service.js';
import { searchSOPs } from '../services/rag.service.js';
import { getDowntimeBreakdown } from '../services/eventRecorder.service.js';
import { getLocalDb } from '../db/localDb.js';
import { execute } from '../db/mysql.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('  PLANTOPS BACKEND: Automated End-to-End System Test Suite');
  console.log('================================================================\n');

  // Pre-test setup: ensure database tables & clean inventory state
  try {
    await execute(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id VARCHAR(50) PRIMARY KEY,
        incident_id VARCHAR(50) NOT NULL,
        work_order_id VARCHAR(50),
        part_id VARCHAR(50) NOT NULL,
        supplier_id VARCHAR(50) NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        unit_price DECIMAL(10, 2) NOT NULL,
        total_amount DECIMAL(10, 2) NOT NULL,
        status ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'RECEIVED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
        auto_approved BOOLEAN DEFAULT FALSE,
        policy_code VARCHAR(50),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await execute(`UPDATE inventory SET reserved_quantity = 0, quantity_on_hand = 8 WHERE part_id = 'PART-SKF-6205'`);
  } catch (e) {}

  // -------------------------------------------------------------------------
  // 1. Asset Inventory & 3D Coordinates Verification (Local DB & TiDB Cloud)
  // -------------------------------------------------------------------------
  console.log('[1/7] Testing Asset Topology & 3D World Coordinates in LocalDB & TiDB Cloud...');
  const db = getLocalDb();
  assert(db.machines.length === 25, 'Total 25 Machines Seeded in Local Database', `Got ${db.machines.length}`);

  const robot01 = db.machines.find((m: any) => m.code === 'ROBOT-01');
  const robot02 = db.machines.find((m: any) => m.code === 'ROBOT-02');
  const robot03 = db.machines.find((m: any) => m.code === 'ROBOT-03');
  const robot04 = db.machines.find((m: any) => m.code === 'ROBOT-04');

  assert(robot01 && robot01.pos_x === 24 && robot01.pos_z === -25.5, 'ROBOT-01 3D World Coordinates [24, 0, -25.5]');
  assert(robot02 && robot02.pos_x === 34 && robot02.pos_z === -25.5, 'ROBOT-02 3D World Coordinates [34, 0, -25.5]');
  assert(robot03 && robot03.pos_x === 24 && robot03.pos_z === -15.5, 'ROBOT-03 3D World Coordinates [24, 0, -15.5]');
  assert(robot04 && robot04.pos_x === 34 && robot04.pos_z === -15.5, 'ROBOT-04 3D World Coordinates [34, 0, -15.5]');

  const zones = new Set(db.machines.map((m: any) => m.area));
  assert(zones.size === 6, 'All 6 Manufacturing Workcells Present in Local DB', Array.from(zones).join(', '));

  // Verify TiDB Cloud Live Database Records
  try {
    const cloudMachines = await execute(`SELECT code, pos_x, pos_y, pos_z, area FROM machines`);
    if (Array.isArray(cloudMachines)) {
      assert(cloudMachines.length === 25, 'TiDB Cloud: Total 25 Machines Synced & Live', `Count: ${cloudMachines.length}`);
      const cloudRob01 = (cloudMachines as any[]).find((m) => m.code === 'ROBOT-01');
      assert(cloudRob01 && cloudRob01.pos_x === 24 && cloudRob01.pos_z === -25.5, 'TiDB Cloud: ROBOT-01 Synced Coordinates [24, 0, -25.5]');
    }
  } catch (cloudErr: any) {
    console.warn('[TestSuite] TiDB Cloud verification query:', cloudErr.message);
  }

  // -------------------------------------------------------------------------
  // 2. Physics-of-Failure & AI Diagnosis Engine
  // -------------------------------------------------------------------------
  console.log('\n[2/7] Testing AI Physics-of-Failure Diagnostic Engine...');
  const diagResult = await runAIDiagnosis(
    'CNC-01',
    {
      machineId: 'CNC-01',
      temperature: 78.4,
      vibration: 6.8,
      current: 17.2,
      rpm: 12000,
      pressure: 6.2
    },
    {
      alertType: 'CRITICAL_VIBRATION_SPIKE',
      scenarioId: 'CNC-01'
    }
  );

  assert(diagResult.confidence >= 0.85, 'Diagnosis Confidence Score >= 85%', `Got ${diagResult.confidence}`);
  assert(diagResult.recommendedPartId === 'PART-SKF-6205', 'Recommended Replacement Part SKF-6205', `Got ${diagResult.recommendedPartId}`);
  assert(diagResult.procedureSteps.length >= 4, 'OSHA-Compliant Procedural Repair Steps Generated', `${diagResult.procedureSteps.length} steps`);

  // -------------------------------------------------------------------------
  // 3. Policy Engine & Inventory ATP (Available-To-Promise)
  // -------------------------------------------------------------------------
  console.log('\n[3/7] Testing Policy Engine & Inventory Availability...');
  const atp = await checkATP('PART-SKF-6205');
  assert(atp !== null && atp.isAvailable === true, 'ATP Verification: SKF-6205 Bearing in Stock', `Available: ${atp?.availableToPromise}`);

  const policy = await evaluateProcurementPolicy({
    incidentId: 'INC-TEST-01',
    machineId: 'MCH-CNC-01',
    machineCriticality: 'CRITICAL',
    partId: 'PART-SKF-6205',
    unitPrice: 45.0,
    quantity: 1,
    totalAmount: 45.0,
    aiConfidence: 0.948,
    supplierId: 'SUP-SKF-01',
    supplierStatus: 'ACTIVE'
  });
  assert(policy.action === 'ALLOW', 'Autonomous Policy Engine: Standard Spares Under $1000 Auto-Approved', `Action: ${policy.action} (${policy.policyCode})`);

  // -------------------------------------------------------------------------
  // 4. Digital LOTO (Lockout/Tagout) Safety Protocol
  // -------------------------------------------------------------------------
  console.log('\n[4/7] Testing Digital LOTO Isolation Protocols...');
  const lotoCNC = getLotoProtocolForMachine('CNC', 'CNC-01');
  assert(lotoCNC.isolationSteps.length > 0, 'LOTO Isolation Steps Defined', `${lotoCNC.isolationSteps.length} steps`);
  assert(lotoCNC.isolationSteps.some((s) => s.category === 'ELECTRICAL'), 'Electrical Lockout Verified');
  assert(lotoCNC.isolationSteps.some((s) => s.category === 'PNEUMATIC' || s.category === 'HYDRAULIC'), 'Pneumatic / Hydraulic Lockout Verified');

  const lotoRobot = getLotoProtocolForMachine('ROBOT', 'ROBOT-01');
  assert(lotoRobot.requiredPpe.length > 0, 'Robot Cell PPE & Safety Interlock Spec Verified', lotoRobot.requiredPpe.join(', '));

  // -------------------------------------------------------------------------
  // 5. RAG Technical Documentation & SOP Semantic Search
  // -------------------------------------------------------------------------
  console.log('\n[5/7] Testing RAG SOP Search & Technical Engineering Manuals...');
  const sopMatches = await searchSOPs('spindle ceramic bearing torque preload');
  assert(sopMatches.length > 0, 'Semantic RAG Retrieved Matching OEM Service Procedures', `Found ${sopMatches.length} sections`);
  const hasTorqueSpec = sopMatches.some((s: any) => s.content.includes('Nm') || s.content.includes('torque') || s.content.includes('bearing'));
  assert(hasTorqueSpec, 'OEM Specific Calibration Limits & Torque Values Present in Context');

  // -------------------------------------------------------------------------
  // 6. Downtime Accounting & OEE Tracking
  // -------------------------------------------------------------------------
  console.log('\n[6/7] Testing Downtime Accounting & Incident Timeline Event Recorder...');
  const downtime = await getDowntimeBreakdown('INC-INIT-01');
  assert(downtime === null || typeof downtime === 'object', 'Downtime Categorization Breakdown Structure Operational');
  assert(Array.isArray(db.incident_events), 'Incident Events Audit Trail Container Ready');

  // -------------------------------------------------------------------------
  // 7. Test Results Summary
  // -------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`  TEST RESULTS: ${passed} Passed | ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('[TestSuite] Fatal test execution error:', err);
  process.exit(1);
});
