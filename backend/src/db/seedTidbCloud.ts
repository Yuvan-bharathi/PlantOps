import { query, execute } from './mysql.js';

export async function seedTidbCloud() {
  console.log('--- Seeding TiDB Cloud with Comprehensive Real MRO Data ---');

  // 1. Ensure columns in suppliers
  try {
    await execute(`
      ALTER TABLE suppliers 
      MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
      ADD COLUMN IF NOT EXISTS phone VARCHAR(50) NULL,
      ADD COLUMN IF NOT EXISTS specialty VARCHAR(255) NULL,
      ADD COLUMN IF NOT EXISTS edi_connected BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS rep_name VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS sla_fulfillment DECIMAL(4, 2) DEFAULT 99.20
    `);
  } catch (e: any) {
    console.log('[Schema] suppliers table alter check:', e.message);
  }

  // 2. Ensure columns in spare_parts
  try {
    await execute(`
      ALTER TABLE spare_parts 
      ADD COLUMN IF NOT EXISTS safety_stock INT DEFAULT 2,
      ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(150) NULL
    `);
  } catch (e: any) {
    console.log('[Schema] spare_parts table alter check:', e.message);
  }

  // 3. Ensure columns in purchase_orders
  try {
    await execute(`
      ALTER TABLE purchase_orders 
      MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'APPROVED',
      ADD COLUMN IF NOT EXISTS part_number VARCHAR(100) NULL,
      ADD COLUMN IF NOT EXISTS part_name VARCHAR(150) NULL,
      ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(150) NULL,
      ADD COLUMN IF NOT EXISTS supplier_rating DECIMAL(3, 2) DEFAULT 4.95,
      ADD COLUMN IF NOT EXISTS approval_type VARCHAR(50) DEFAULT 'AUTONOMOUS_POLICY',
      ADD COLUMN IF NOT EXISTS policy_id_applied VARCHAR(100) DEFAULT 'POL-01 (Spend <= $1,000)'
    `);
  } catch (e: any) {
    console.log('[Schema] purchase_orders table alter check:', e.message);
  }

  // 4. Seed Suppliers (8 Premier OEM Vendors)
  const suppliersData = [
    { id: 'SUPP-01', name: 'Motion Industries Supply Corp', code: 'MOTION-IND', contact_email: 'orders@motionind.com', phone: '+1-800-526-9328', rating: 4.95, status: 'PREFERRED', lead_time_days: 1, payment_terms: 'Net 30', specialty: 'Bearings, Power Transmission & Seals', rep_name: 'David Vance', sla_fulfillment: 99.4 },
    { id: 'SUPP-02', name: 'Applied Industrial Technologies', code: 'APPLIED-IND', contact_email: 'enterprise@applied.com', phone: '+1-800-472-8886', rating: 4.80, status: 'ACTIVE', lead_time_days: 2, payment_terms: 'Net 30', specialty: 'Hydraulics, Fluid Power & AGV Spares', rep_name: 'Sarah Jenkins', sla_fulfillment: 99.2 },
    { id: 'SUPP-03', name: 'Grainger Industrial Supply', code: 'GRAINGER', contact_email: 'fast_quote@grainger.com', phone: '+1-800-472-4643', rating: 4.70, status: 'ACTIVE', lead_time_days: 2, payment_terms: 'Net 45', specialty: 'General Industrial MRO, Welding & Safety', rep_name: 'Robert Hayes', sla_fulfillment: 99.1 },
    { id: 'SUPP-04', name: 'NSK Precision Bearing Co.', code: 'NSK-PRECISION', contact_email: 'oem_support@nsk-corp.com', phone: '+1-888-446-4675', rating: 4.98, status: 'PREFERRED', lead_time_days: 1, payment_terms: 'Net 30', specialty: 'High-Speed Spindle Ceramic Bearings', rep_name: 'Kenji Takahashi', sla_fulfillment: 99.8 },
    { id: 'SUPP-05', name: 'Fanuc Robotics America', code: 'FANUC-ROBOT', contact_email: 'parts@fanucamerica.com', phone: '+1-888-326-8287', rating: 4.89, status: 'ACTIVE', lead_time_days: 3, payment_terms: 'Net 30', specialty: 'CNC Controllers, Servos & Teach Pendants', rep_name: 'Michael Chen', sla_fulfillment: 98.9 },
    { id: 'SUPP-06', name: 'Parker Hannifin Corp', code: 'PARKER-HANNIFIN', contact_email: 'industrial_sales@parker.com', phone: '+1-800-272-7537', rating: 4.93, status: 'PREFERRED', lead_time_days: 2, payment_terms: 'Net 30', specialty: 'Hydraulic Cylinders, Valves, Seals & Manifolds', rep_name: 'Elena Rostova', sla_fulfillment: 99.3 },
    { id: 'SUPP-07', name: 'Festo Pneumatics & Automation', code: 'FESTO-AUTO', contact_email: 'support@festo.com', phone: '+1-800-993-3786', rating: 4.95, status: 'PREFERRED', lead_time_days: 1, payment_terms: 'Net 30', specialty: 'Pneumatic Actuators, Grippers & Air Regulators', rep_name: 'Hans Becker', sla_fulfillment: 99.5 },
    { id: 'SUPP-08', name: 'Sandvik Coromant Tooling', code: 'SANDVIK-TOOL', contact_email: 'orderdesk@sandvik.coromant.com', phone: '+1-800-726-3845', rating: 4.96, status: 'PREFERRED', lead_time_days: 1, payment_terms: 'Net 30', specialty: 'Solid Carbide CNC End Mills, Drills & Inserts', rep_name: 'Lars Lindqvist', sla_fulfillment: 99.6 }
  ];

  for (const s of suppliersData) {
    await execute(`
      INSERT INTO suppliers (id, name, code, contact_email, phone, rating, status, lead_time_days, payment_terms, specialty, rep_name, sla_fulfillment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        name=VALUES(name), contact_email=VALUES(contact_email), phone=VALUES(phone), rating=VALUES(rating),
        status=VALUES(status), lead_time_days=VALUES(lead_time_days), payment_terms=VALUES(payment_terms),
        specialty=VALUES(specialty), rep_name=VALUES(rep_name), sla_fulfillment=VALUES(sla_fulfillment);
    `, [s.id, s.name, s.code, s.contact_email, s.phone, s.rating, s.status, s.lead_time_days, s.payment_terms, s.specialty, s.rep_name, s.sla_fulfillment]);
  }
  console.log(`[TiDB Cloud] Seeded ${suppliersData.length} suppliers.`);

  // 5. Seed Spare Parts & Inventory (14 MRO Items)
  const partsData = [
    { id: 'PART-SKF-6205', part_number: 'SKF-6205-2RSH', name: 'Deep Groove Ball Bearing 25x52x15mm', category: 'Bearings', unit_cost: 45.0, min_reorder_point: 3, lead_time_days: 1, safety_stock: 2, supplier_name: 'Motion Industries Supply Corp', bin: 'BAY-A-04', on_hand: 8, reserved: 1 },
    { id: 'PART-FAG-7210', part_number: 'FAG-7210-B-TVP', name: 'Angular Contact Ball Bearing 50x90x20mm', category: 'Bearings', unit_cost: 120.0, min_reorder_point: 2, lead_time_days: 2, safety_stock: 2, supplier_name: 'Motion Industries Supply Corp', bin: 'BAY-A-05', on_hand: 4, reserved: 0 },
    { id: 'PART-TIMKEN-TAP-01', part_number: 'TIMKEN-32008X', name: 'Tapered Roller Bearing 40x68x19mm', category: 'Bearings', unit_cost: 85.0, min_reorder_point: 2, lead_time_days: 2, safety_stock: 2, supplier_name: 'Motion Industries Supply Corp', bin: 'BAY-A-06', on_hand: 5, reserved: 0 },
    { id: 'PART-NSK-7008', part_number: 'NSK-7008-CTYNSULP4', name: 'High-Precision Ceramic Spindle Bearing 40x68x15mm', category: 'Bearings', unit_cost: 320.0, min_reorder_point: 2, lead_time_days: 1, safety_stock: 2, supplier_name: 'NSK Precision Bearing Co.', bin: 'BAY-A-07', on_hand: 3, reserved: 1 },
    { id: 'PART-HYD-SEAL-01', part_number: 'PARKER-V884-75', name: 'Fluorocarbon Hydraulic Rod Seal Kit', category: 'Seals & Gaskets', unit_cost: 65.0, min_reorder_point: 4, lead_time_days: 1, safety_stock: 3, supplier_name: 'Parker Hannifin Corp', bin: 'BAY-B-12', on_hand: 12, reserved: 0 },
    { id: 'PART-PARKER-PRV', part_number: 'PARKER-D1VW001CNTW', name: 'Hydraulic Proportional Directional Control Valve', category: 'Hydraulics', unit_cost: 450.0, min_reorder_point: 1, lead_time_days: 2, safety_stock: 1, supplier_name: 'Parker Hannifin Corp', bin: 'BAY-B-14', on_hand: 2, reserved: 0 },
    { id: 'PART-FANUC-SV-03', part_number: 'FANUC-A06B-0223', name: 'AC Servo Drive Motor Alpha iF 4/4000', category: 'Motors & Servos', unit_cost: 890.0, min_reorder_point: 1, lead_time_days: 3, safety_stock: 1, supplier_name: 'Fanuc Robotics America', bin: 'BAY-C-01', on_hand: 2, reserved: 0 },
    { id: 'PART-SIEMENS-S7', part_number: 'SIEMENS-6ES7515', name: 'Siemens S7-1500 PLC Communication Processor', category: 'Electronics', unit_cost: 620.0, min_reorder_point: 1, lead_time_days: 2, safety_stock: 1, supplier_name: 'Applied Industrial Technologies', bin: 'BAY-C-04', on_hand: 3, reserved: 0 },
    { id: 'PART-FESTO-CYL', part_number: 'FESTO-DFM-32-50', name: 'Festo Guided Pneumatic Actuator Cylinder 32mm', category: 'Pneumatics', unit_cost: 145.0, min_reorder_point: 2, lead_time_days: 1, safety_stock: 2, supplier_name: 'Festo Pneumatics & Automation', bin: 'BAY-C-08', on_hand: 6, reserved: 0 },
    { id: 'PART-TOOL-EM12', part_number: 'SANDVIK-1P220-1200', name: 'Solid Carbide 4-Flute End Mill 12mm TiAlN', category: 'CNC Tooling', unit_cost: 95.0, min_reorder_point: 4, lead_time_days: 1, safety_stock: 3, supplier_name: 'Sandvik Coromant Tooling', bin: 'BAY-D-01', on_hand: 8, reserved: 0 },
    { id: 'PART-TOOL-BN08', part_number: 'SANDVIK-2P120-0800', name: 'Ball Nose Finishing Cutter 8mm 2-Flute', category: 'CNC Tooling', unit_cost: 115.0, min_reorder_point: 2, lead_time_days: 1, safety_stock: 2, supplier_name: 'Sandvik Coromant Tooling', bin: 'BAY-D-02', on_hand: 6, reserved: 0 },
    { id: 'PART-TOOL-FM50', part_number: 'SANDVIK-RA245-050', name: '50mm Indexable Face Mill Body (5-Insert Pocket)', category: 'CNC Tooling', unit_cost: 280.0, min_reorder_point: 1, lead_time_days: 1, safety_stock: 1, supplier_name: 'Sandvik Coromant Tooling', bin: 'BAY-D-03', on_hand: 4, reserved: 0 },
    { id: 'PART-ROB-TORCH', part_number: 'TREGASKISS-TOUGH-GUN', name: 'Robotic MIG Welding Torch Assembly 500A Water-Cooled', category: 'Welding', unit_cost: 520.0, min_reorder_point: 1, lead_time_days: 2, safety_stock: 1, supplier_name: 'Grainger Industrial Supply', bin: 'BAY-D-06', on_hand: 2, reserved: 0 },
    { id: 'PART-AGV-BATTERY', part_number: 'LITHIUM-AGV-4860', name: 'AGV LiFePO4 48V 60Ah Rapid-Swap Battery Pack', category: 'Power & AGV', unit_cost: 1250.0, min_reorder_point: 1, lead_time_days: 3, safety_stock: 1, supplier_name: 'Applied Industrial Technologies', bin: 'BAY-D-08', on_hand: 3, reserved: 0 }
  ];

  for (const p of partsData) {
    await execute(`
      INSERT INTO spare_parts (id, part_number, name, category, unit_cost, min_reorder_point, lead_time_days, safety_stock, supplier_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        part_number=VALUES(part_number), name=VALUES(name), category=VALUES(category),
        unit_cost=VALUES(unit_cost), min_reorder_point=VALUES(min_reorder_point),
        lead_time_days=VALUES(lead_time_days), safety_stock=VALUES(safety_stock),
        supplier_name=VALUES(supplier_name);
    `, [p.id, p.part_number, p.name, p.category, p.unit_cost, p.min_reorder_point, p.lead_time_days, p.safety_stock, p.supplier_name]);

    const atp = p.on_hand - p.reserved;
    const invId = `INV-${p.id}`;
    await execute(`
      INSERT INTO inventory (id, part_id, warehouse_name, bin_location, quantity_on_hand, reserved_quantity, available_to_promise)
      VALUES (?, ?, 'Central Spares WH-01', ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        bin_location=VALUES(bin_location), quantity_on_hand=VALUES(quantity_on_hand),
        reserved_quantity=VALUES(reserved_quantity), available_to_promise=VALUES(available_to_promise);
    `, [invId, p.id, p.bin, p.on_hand, p.reserved, atp]);
  }
  console.log(`[TiDB Cloud] Seeded ${partsData.length} spare parts and inventory ledgers.`);

  // 6. Seed Purchase Orders
  const posData = [
    { id: 'PO-8821', incident_id: 'INC-INIT-01', work_order_id: 'WO-1082', part_id: 'PART-SKF-6205', part_number: 'SKF-6205-2RSH', part_name: 'Deep Groove Ball Bearing 25x52x15mm', supplier_id: 'SUPP-01', supplier_name: 'Motion Industries Supply Corp', supplier_rating: 4.95, quantity: 4, unit_price: 45.0, total_amount: 180.0, status: 'APPROVED', approval_type: 'AUTONOMOUS_POLICY', policy_id_applied: 'POL-01 (Spend <= $1,000)' },
    { id: 'PO-8822', incident_id: 'INC-INIT-01', work_order_id: 'WO-1094', part_id: 'PART-NSK-7008', part_number: 'NSK-7008-CTYNSULP4', part_name: 'High-Precision Ceramic Spindle Bearing', supplier_id: 'SUPP-04', supplier_name: 'NSK Precision Bearing Co.', supplier_rating: 4.98, quantity: 2, unit_price: 320.0, total_amount: 640.0, status: 'IN_TRANSIT', approval_type: 'AUTONOMOUS_POLICY', policy_id_applied: 'POL-01 (Preferred Tier-1 Supplier)' },
    { id: 'PO-8823', incident_id: 'INC-INIT-01', work_order_id: 'WO-1102', part_id: 'PART-TOOL-EM12', part_number: 'SANDVIK-1P220-1200', part_name: 'Solid Carbide 4-Flute End Mill 12mm', supplier_id: 'SUPP-08', supplier_name: 'Sandvik Coromant Tooling', supplier_rating: 4.96, quantity: 10, unit_price: 95.0, total_amount: 950.0, status: 'APPROVED', approval_type: 'AUTONOMOUS_POLICY', policy_id_applied: 'POL-01 (CNC Tooling Auto-Replenish)' },
    { id: 'PO-8824', incident_id: 'INC-INIT-01', work_order_id: 'WO-1055', part_id: 'PART-HYD-SEAL-01', part_number: 'PARKER-V884-75', part_name: 'Fluorocarbon Hydraulic Rod Seal Kit', supplier_id: 'SUPP-06', supplier_name: 'Parker Hannifin Corp', supplier_rating: 4.93, quantity: 8, unit_price: 65.0, total_amount: 520.0, status: 'RECEIVED', approval_type: 'AUTONOMOUS_POLICY', policy_id_applied: 'POL-01 (Auto-Approved)' },
    { id: 'PO-8825', incident_id: 'INC-INIT-01', work_order_id: 'WO-1042', part_id: 'PART-FANUC-SV-03', part_number: 'FANUC-A06B-0223', part_name: 'AC Servo Drive Motor Alpha iF 4/4000', supplier_id: 'SUPP-05', supplier_name: 'Fanuc Robotics America', supplier_rating: 4.89, quantity: 1, unit_price: 890.0, total_amount: 890.0, status: 'APPROVED', approval_type: 'HUMAN_REVIEW', policy_id_applied: 'POL-02 (Critical High-Value Spare)' },
    { id: 'PO-8826', incident_id: 'INC-INIT-01', work_order_id: 'WO-1077', part_id: 'PART-FESTO-CYL', part_number: 'FESTO-DFM-32-50', part_name: 'Festo Guided Pneumatic Actuator Cylinder 32mm', supplier_id: 'SUPP-07', supplier_name: 'Festo Pneumatics & Automation', supplier_rating: 4.95, quantity: 4, unit_price: 145.0, total_amount: 580.0, status: 'IN_TRANSIT', approval_type: 'AUTONOMOUS_POLICY', policy_id_applied: 'POL-01 (Auto-Approved)' }
  ];

  for (const po of posData) {
    await execute(`
      INSERT INTO purchase_orders (id, incident_id, work_order_id, part_id, part_number, part_name, supplier_id, supplier_name, supplier_rating, quantity, unit_price, total_amount, status, approval_type, policy_id_applied)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        part_number=VALUES(part_number), part_name=VALUES(part_name),
        supplier_name=VALUES(supplier_name), supplier_rating=VALUES(supplier_rating),
        quantity=VALUES(quantity), unit_price=VALUES(unit_price), total_amount=VALUES(total_amount),
        status=VALUES(status), approval_type=VALUES(approval_type), policy_id_applied=VALUES(policy_id_applied);
    `, [po.id, po.incident_id, po.work_order_id, po.part_id, po.part_number, po.part_name, po.supplier_id, po.supplier_name, po.supplier_rating, po.quantity, po.unit_price, po.total_amount, po.status, po.approval_type, po.policy_id_applied]);
  }
  console.log(`[TiDB Cloud] Seeded ${posData.length} purchase orders.`);
  console.log('--- TiDB Cloud Seeding Complete ---');
}
