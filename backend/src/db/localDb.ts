import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'plantops_db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {}
}

export interface LocalDbSchema {
  machines: any[];
  work_orders: any[];
  incidents: any[];
  incident_events: any[];
  inventory: any[];
  spare_parts: any[];
  technicians: any[];
  purchase_orders: any[];
  human_review_items: any[];
  policies: any[];
  audit_logs: any[];
}

const DEFAULT_DB: LocalDbSchema = {
  machines: [
    { id: 'MCH-CNC-01', code: 'CNC-01', name: 'High-Precision 5-Axis Milling Center 01', type: 'CNC', area: 'Machining Cell', status: 'RUNNING', health_score: 98, criticality: 'CRITICAL', pos_x: -34, pos_y: 0, pos_z: -20 },
    { id: 'MCH-CNC-02', code: 'CNC-02', name: 'Heavy Duty Turning Center 02', type: 'CNC', area: 'Machining Cell', status: 'RUNNING', health_score: 95, criticality: 'HIGH', pos_x: -27, pos_y: 0, pos_z: -20 },
    { id: 'MCH-CNC-03', code: 'CNC-03', name: 'High-Precision 5-Axis Milling Center 03', type: 'CNC', area: 'Machining Cell', status: 'RUNNING', health_score: 98, criticality: 'HIGH', pos_x: -20, pos_y: 0, pos_z: -20 },
    { id: 'MCH-CNC-04', code: 'CNC-04', name: '5-Axis Machining Center 04', type: 'CNC', area: 'Machining Cell', status: 'RUNNING', health_score: 97, criticality: 'HIGH', pos_x: -34, pos_y: 0, pos_z: -11 },
    { id: 'MCH-CNC-05', code: 'CNC-05', name: 'High-Speed Mill 05', type: 'CNC', area: 'Machining Cell', status: 'RUNNING', health_score: 96, criticality: 'HIGH', pos_x: -27, pos_y: 0, pos_z: -11 },
    { id: 'MCH-CNC-06', code: 'CNC-06', name: 'Ultra Precision Lathe 06', type: 'CNC', area: 'Machining Cell', status: 'RUNNING', health_score: 98, criticality: 'CRITICAL', pos_x: -20, pos_y: 0, pos_z: -11 },
    { id: 'MCH-ROB-01', code: 'ROBOT-01', name: 'Articulated 6-Axis Pick & Place Robot', type: 'ROBOT', area: 'Robot Cell', status: 'RUNNING', health_score: 99, criticality: 'HIGH', pos_x: -5, pos_y: 0, pos_z: -21 },
    { id: 'MCH-ROB-02', code: 'ROBOT-02', name: 'Heavy Payload Palletizing Robot', type: 'ROBOT', area: 'Robot Cell', status: 'RUNNING', health_score: 97, criticality: 'HIGH', pos_x: 5, pos_y: 0, pos_z: -21 },
    { id: 'MCH-ROB-03', code: 'ROBOT-03', name: 'Precision Assembly Delta Robot', type: 'ROBOT', area: 'Robot Cell', status: 'RUNNING', health_score: 96, criticality: 'HIGH', pos_x: -5, pos_y: 0, pos_z: -11 },
    { id: 'MCH-ROB-04', code: 'ROBOT-04', name: 'Welding & Fastening Robot Arm', type: 'ROBOT', area: 'Robot Cell', status: 'RUNNING', health_score: 98, criticality: 'HIGH', pos_x: 5, pos_y: 0, pos_z: -11 },
    { id: 'MCH-MIX-01', code: 'MIXER-01', name: 'High-Shear Chemical & Lubricant Mixer', type: 'MIXER', area: 'Processing Cell', status: 'RUNNING', health_score: 94, criticality: 'HIGH', pos_x: 18, pos_y: 0, pos_z: -21 },
    { id: 'MCH-PMP-01', code: 'PUMP-01', name: 'High-Pressure Hydraulic Coolant Pump', type: 'PUMP', area: 'Processing Cell', status: 'RUNNING', health_score: 92, criticality: 'MEDIUM', pos_x: 26, pos_y: 0, pos_z: -19 },
    { id: 'MCH-PRS-01', code: 'PRESS-01', name: 'Hydraulic Stamping & Forming Press', type: 'PRESS', area: 'Processing Cell', status: 'RUNNING', health_score: 96, criticality: 'HIGH', pos_x: 32, pos_y: 0, pos_z: -18 },
    { id: 'MCH-PRC-01', code: 'PROCESS-01', name: 'Continuous Fluid Treatment Vessel 01', type: 'PROCESSING', area: 'Processing Cell', status: 'RUNNING', health_score: 97, criticality: 'MEDIUM', pos_x: 18, pos_y: 0, pos_z: -11 },
    { id: 'MCH-PRC-02', code: 'PROCESS-02', name: 'Degassing & Settling Reactor 02', type: 'PROCESSING', area: 'Processing Cell', status: 'RUNNING', health_score: 95, criticality: 'MEDIUM', pos_x: 26, pos_y: 0, pos_z: -11 },
    { id: 'MCH-ASM-01', code: 'ASMB-01', name: 'Precision Screwdriving & Torque Workstation', type: 'ASSEMBLY', area: 'Assembly Cell', status: 'RUNNING', health_score: 97, criticality: 'HIGH', pos_x: -34, pos_y: 0, pos_z: 6 },
    { id: 'MCH-ASM-02', code: 'ASMB-02', name: 'Optical Inspection & Vision Alignment Cell', type: 'ASSEMBLY', area: 'Assembly Cell', status: 'RUNNING', health_score: 98, criticality: 'HIGH', pos_x: -27, pos_y: 0, pos_z: 6 },
    { id: 'MCH-ASM-03', code: 'ASMB-03', name: 'Indexing Rotary Table Sub-assembly Station', type: 'ASSEMBLY', area: 'Assembly Cell', status: 'RUNNING', health_score: 98, criticality: 'HIGH', pos_x: -34, pos_y: 0, pos_z: 14 },
    { id: 'MCH-ASM-04', code: 'ASMB-04', name: 'Final Component Fitting & Harness Bench', type: 'ASSEMBLY', area: 'Assembly Cell', status: 'RUNNING', health_score: 96, criticality: 'MEDIUM', pos_x: -27, pos_y: 0, pos_z: 14 },
    { id: 'MCH-PKG-01', code: 'PACK-01', name: 'Automatic Form-Fill-Seal Packaging Unit', type: 'PACKAGING', area: 'Packaging Cell', status: 'RUNNING', health_score: 95, criticality: 'MEDIUM', pos_x: -5, pos_y: 0, pos_z: 6 },
    { id: 'MCH-PKG-02', code: 'PACK-02', name: 'Flow-Wrap & Shrink Packaging Machine', type: 'PACKAGING', area: 'Packaging Cell', status: 'RUNNING', health_score: 96, criticality: 'MEDIUM', pos_x: 4, pos_y: 0, pos_z: 6 },
    { id: 'MCH-PKG-03', code: 'PACK-03', name: 'Palletizing & Case Packing Cell', type: 'PACKAGING', area: 'Packaging Cell', status: 'RUNNING', health_score: 98, criticality: 'HIGH', pos_x: -1, pos_y: 0, pos_z: 15 },
    { id: 'MCH-BNCH-01', code: 'BENCH-01', name: 'Diagnostic & Mechanical Overhaul Station', type: 'MAINTENANCE', area: 'Maintenance Bay', status: 'RUNNING', health_score: 98, criticality: 'HIGH', pos_x: 18, pos_y: 0, pos_z: 7 },
    { id: 'MCH-BNCH-02', code: 'BENCH-02', name: 'High-Precision Spindle Test & Balance Bench', type: 'MAINTENANCE', area: 'Maintenance Bay', status: 'RUNNING', health_score: 97, criticality: 'HIGH', pos_x: 26, pos_y: 0, pos_z: 7 },
    { id: 'MCH-TEST-01', code: 'TEST-01', name: 'Electronics & PLC Calibration Stand', type: 'MAINTENANCE', area: 'Maintenance Bay', status: 'RUNNING', health_score: 99, criticality: 'HIGH', pos_x: 22, pos_y: 0, pos_z: 15 },
  ],
  work_orders: [
    {
      id: 'WO-1082',
      incident_id: 'INC-INIT-01',
      machine_id: 'MCH-CNC-01',
      machine_name: 'High-Precision 5-Axis Milling Center 01',
      machine_code: 'CNC-01',
      technician_id: 'TECH-01',
      technician_name: 'Arun Kumar',
      technician_role: 'Lead Vibration & Spindle Reliability Specialist',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      loto_required: true,
      loto_applied: false,
      notes: 'Autonomous AI Dispatch: Verified vibration signature match for ceramic bearing replacement.',
      created_at: new Date().toISOString()
    }
  ],
  incidents: [],
  incident_events: [],
  inventory: [
    { id: 'INV-01', part_id: 'PART-SKF-6205', warehouse_name: 'Central Spares WH-01', bin_location: 'BAY-A-04', quantity_on_hand: 8, reserved_quantity: 1 },
    { id: 'INV-02', part_id: 'PART-FAG-7210', warehouse_name: 'Central Spares WH-01', bin_location: 'BAY-A-05', quantity_on_hand: 4, reserved_quantity: 0 },
    { id: 'INV-03', part_id: 'PART-TIMKEN-TAP-01', warehouse_name: 'Central Spares WH-01', bin_location: 'BAY-A-06', quantity_on_hand: 5, reserved_quantity: 0 },
    { id: 'INV-04', part_id: 'PART-HYD-SEAL-01', warehouse_name: 'Central Spares WH-01', bin_location: 'BAY-B-12', quantity_on_hand: 12, reserved_quantity: 0 },
    { id: 'INV-05', part_id: 'PART-FANUC-SV-03', warehouse_name: 'Central Spares WH-01', bin_location: 'BAY-C-01', quantity_on_hand: 2, reserved_quantity: 0 },
  ],
  spare_parts: [
    { id: 'PART-SKF-6205', part_number: 'SKF-6205-2RSH', name: 'Deep Groove Ball Bearing 25x52x15mm', category: 'Bearings', unit_cost: 45.0 },
    { id: 'PART-FAG-7210', part_number: 'FAG-7210-B-TVP', name: 'Angular Contact Ball Bearing 50x90x20mm', category: 'Bearings', unit_cost: 120.0 },
    { id: 'PART-TIMKEN-TAP-01', part_number: 'TIMKEN-32008X', name: 'Tapered Roller Bearing 40x68x19mm', category: 'Bearings', unit_cost: 85.0 },
    { id: 'PART-HYD-SEAL-01', part_number: 'PARKER-V884-75', name: 'Fluorocarbon Hydraulic Rod Seal Kit', category: 'Seals & Gaskets', unit_cost: 65.0 },
    { id: 'PART-FANUC-SV-03', part_number: 'FANUC-A06B-0223', name: 'AC Servo Drive Motor Alpha iF 4/4000', category: 'Motors & Servos', unit_cost: 890.0 }
  ],
  technicians: [
    { id: 'TECH-01', name: 'Arun Kumar', email: 'arun.kumar@plantops.internal', role: 'Lead Vibration & Spindle Reliability Specialist', assigned_area: 'Machining Cell', status: 'ON_DUTY', shift: 'Morning (06:00-14:00)', skills: JSON.stringify(['VIBRATION_ANALYSIS', 'BEARING_REPLACEMENT', 'PRECISION_ALIGNMENT', 'LOTO_SUPERVISOR']), active_work_orders: 1 },
    { id: 'TECH-02', name: 'Priya Sharma', email: 'priya.sharma@plantops.internal', role: 'Senior Automation & Robotics Engineer', assigned_area: 'Robot Cell', status: 'AVAILABLE', shift: 'Morning (06:00-14:00)', skills: JSON.stringify(['ROBOTICS_FANUC', 'PLC_SIEMENS', 'SAFETY_CIRCUITS', 'SERVO_CALIBRATION']), active_work_orders: 0 },
    { id: 'TECH-03', name: 'Rajesh Nair', email: 'rajesh.nair@plantops.internal', role: 'Hydraulic Systems & Mechanical Specialist', assigned_area: 'Processing Cell', status: 'AVAILABLE', shift: 'Morning (06:00-14:00)', skills: JSON.stringify(['HYDRAULIC_CIRCUITS', 'PRESSURE_TESTING', 'VALVE_CALIBRATION', 'LOTO_EXECUTION']), active_work_orders: 0 },
    { id: 'TECH-04', name: 'Frank Moore', email: 'frank.moore@plantops.internal', role: 'Plant Maintenance Specialist', assigned_area: 'Maintenance Bay', status: 'ON_DUTY', shift: 'General (08:00-17:00)', skills: JSON.stringify(['OEE_OPTIMIZATION', 'OSHA_1910_COMPLIANCE', 'ROOT_CAUSE_ANALYSIS', 'DIAGNOSTICS']), active_work_orders: 0 }
  ],
  purchase_orders: [
    {
      id: 'PO-8821',
      incident_id: 'INC-INIT-01',
      work_order_id: 'WO-1082',
      part_id: 'PART-SKF-6205',
      part_number: 'SKF-6205-2RSH',
      part_name: 'Deep Groove Ball Bearing 25x52x15mm',
      supplier_id: 'SUPP-01',
      supplier_name: 'Motion Industries Supply Corp',
      supplier_rating: 4.9,
      quantity: 4,
      unit_price: 45.0,
      total_amount: 180.0,
      status: 'APPROVED',
      approval_type: 'AUTONOMOUS_POLICY',
      policy_id_applied: 'POL-01',
      created_by: 'AI_PROCUREMENT_AGENT',
      created_at: new Date().toISOString()
    }
  ],
  human_review_items: [],
  policies: [
    { id: 'POL-01', code: 'POL-AUTO-PO-1000', name: 'Autonomous Reorder Under $1,000', description: 'Auto-generates and transmits PO to preferred supplier when ATP < 2 and total spend <= $1,000.', rule_type: 'PROCUREMENT_AUTO_PO', max_spend_limit: 1000.0, is_active: true },
    { id: 'POL-02', code: 'POL-AI-CONF-90', name: 'AI Diagnosis Minimum Confidence (90%)', description: 'Requires physical technician verification if AI model confidence is below 0.90.', rule_type: 'AI_CONFIDENCE_THRESHOLD', max_spend_limit: 5000.0, is_active: true },
    { id: 'POL-03', code: 'POL-LOTO-MANDATORY', name: 'Mandatory OSHA 1910.147 Lockout Tagout', description: 'Blocks work order completion unless zero-energy state is confirmed with digital padlock.', rule_type: 'POLICY_EXCEPTION', max_spend_limit: 0.0, is_active: true }
  ],
  audit_logs: []
};

let cachedDb: LocalDbSchema | null = null;

export function getLocalDb(): LocalDbSchema {
  if (cachedDb) return cachedDb;
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      cachedDb = JSON.parse(data);
      return cachedDb!;
    }
  } catch (err) {
    console.warn(`[LocalDB] Error reading ${DB_FILE}, initializing default state`);
  }
  cachedDb = JSON.parse(JSON.stringify(DEFAULT_DB));
  saveLocalDb();
  return cachedDb!;
}

export function saveLocalDb(): void {
  if (!cachedDb) return;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(cachedDb, null, 2), 'utf-8');
  } catch (err: any) {
    console.error(`[LocalDB] Error writing ${DB_FILE}:`, err.message);
  }
}
