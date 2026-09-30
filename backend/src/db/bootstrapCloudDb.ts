import mysql from 'mysql2/promise';
import pg from 'pg';
import { config } from '../config/index.js';

export async function bootstrapCloudDatabases() {
  console.log('\n========================================================');
  console.log('  PLANTOPS: Initializing TiDB Cloud & Timescale Cloud   ');
  console.log('========================================================\n');

  // ───────────────────────────────────────────────────────────────────────────
  // 1. TiDB Cloud MySQL Initialization
  // ───────────────────────────────────────────────────────────────────────────
  try {
    console.log(`[TiDB Cloud] Connecting to ${config.mysql.host}:${config.mysql.port}...`);
    
    // Connect without default database first or to 'sys' to ensure plantops_db exists
    const adminConn = await mysql.createConnection({
      host: config.mysql.host,
      port: config.mysql.port,
      user: config.mysql.user,
      password: config.mysql.password,
      ssl: config.mysql.ssl,
      connectTimeout: 10000
    });

    console.log('[TiDB Cloud] Connected successfully! Initializing plantops_db...');
    await adminConn.query(`CREATE DATABASE IF NOT EXISTS plantops_db;`);
    await adminConn.query(`USE plantops_db;`);

    // Create Tables
    await adminConn.query(`
      CREATE TABLE IF NOT EXISTS machines (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        type ENUM('CNC', 'ROBOT', 'PUMP', 'MIXER', 'CONVEYOR', 'PROCESSING', 'ASSEMBLY', 'PACKAGING', 'MAINTENANCE', 'PRESS') NOT NULL DEFAULT 'CNC',
        area VARCHAR(100) DEFAULT 'Main Production Cell',
        status ENUM('RUNNING', 'WARNING', 'FAULT', 'WAITING_PARTS', 'MAINTENANCE', 'VERIFYING', 'OFFLINE') NOT NULL DEFAULT 'RUNNING',
        health_score INT NOT NULL DEFAULT 100,
        criticality ENUM('CRITICAL', 'HIGH', 'MEDIUM', 'LOW') NOT NULL DEFAULT 'HIGH',
        pos_x FLOAT NOT NULL DEFAULT 0.0,
        pos_y FLOAT NOT NULL DEFAULT 0.0,
        pos_z FLOAT NOT NULL DEFAULT 0.0,
        model_asset_path VARCHAR(255) DEFAULT 'models/machine.glb',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `);

    await adminConn.query(`
      CREATE TABLE IF NOT EXISTS technicians (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        phone VARCHAR(20),
        role VARCHAR(50) DEFAULT 'Lead Reliability Specialist',
        skills JSON NOT NULL,
        assigned_area VARCHAR(100) DEFAULT 'Main Production Cell',
        status ENUM('AVAILABLE', 'ON_DUTY', 'BUSY', 'OFF_DUTY') DEFAULT 'AVAILABLE',
        shift VARCHAR(50) DEFAULT 'Morning (06:00-14:00)',
        active_work_orders INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await adminConn.query(`
      CREATE TABLE IF NOT EXISTS spare_parts (
        id VARCHAR(50) PRIMARY KEY,
        part_number VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(150) NOT NULL,
        category VARCHAR(100) NOT NULL,
        unit_cost DECIMAL(10, 2) NOT NULL,
        min_reorder_point INT NOT NULL DEFAULT 2,
        lead_time_days INT NOT NULL DEFAULT 2,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await adminConn.query(`
      CREATE TABLE IF NOT EXISTS inventory (
        id VARCHAR(50) PRIMARY KEY,
        part_id VARCHAR(50) NOT NULL,
        warehouse_name VARCHAR(100) DEFAULT 'Central Spares WH-01',
        bin_location VARCHAR(50) NOT NULL,
        quantity_on_hand INT NOT NULL DEFAULT 0,
        reserved_quantity INT NOT NULL DEFAULT 0,
        available_to_promise INT NOT NULL DEFAULT 0,
        FOREIGN KEY (part_id) REFERENCES spare_parts(id) ON DELETE CASCADE
      );
    `);

    await adminConn.query(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        contact_email VARCHAR(100) NOT NULL,
        rating DECIMAL(3, 2) DEFAULT 4.80,
        status ENUM('ACTIVE', 'PREFERRED', 'BLOCKED', 'RESTRICTED') DEFAULT 'ACTIVE',
        lead_time_days INT NOT NULL DEFAULT 2,
        payment_terms VARCHAR(50) DEFAULT 'Net 30',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await adminConn.query(`
      CREATE TABLE IF NOT EXISTS incidents (
        id VARCHAR(50) PRIMARY KEY,
        machine_id VARCHAR(50) NOT NULL,
        scenario_id VARCHAR(50) NULL,
        alert_type VARCHAR(100) NOT NULL,
        severity ENUM('CRITICAL', 'HIGH', 'MEDIUM', 'LOW') NOT NULL DEFAULT 'HIGH',
        status ENUM('DETECTED', 'DIAGNOSING', 'ASSIGNED', 'DISPATCHED', 'INSPECTING', 'PART_CHECK', 'PROCUREMENT', 'READY_FOR_REPAIR', 'REPAIRING', 'VERIFYING', 'RESOLVED', 'CLOSED') NOT NULL DEFAULT 'DETECTED',
        detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP NULL,
        assignment_started_at TIMESTAMP NULL,
        assigned_at TIMESTAMP NULL,
        technician_dispatched_at TIMESTAMP NULL,
        technician_arrived_at TIMESTAMP NULL,
        loto_started_at TIMESTAMP NULL,
        loto_completed_at TIMESTAMP NULL,
        inspection_started_at TIMESTAMP NULL,
        inspection_completed_at TIMESTAMP NULL,
        repair_started_at TIMESTAMP NULL,
        repair_completed_at TIMESTAMP NULL,
        verification_started_at TIMESTAMP NULL,
        verification_completed_at TIMESTAMP NULL,
        machine_running_at TIMESTAMP NULL,
        downtime_seconds FLOAT NULL,
        ai_diagnosis_summary TEXT,
        ai_root_cause VARCHAR(255),
        ai_confidence DECIMAL(4, 3),
        ai_recommended_actions JSON,
        required_part_id VARCHAR(50),
        FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE
      );
    `);

    await adminConn.query(`
      CREATE TABLE IF NOT EXISTS work_orders (
        id VARCHAR(50) PRIMARY KEY,
        incident_id VARCHAR(50) NOT NULL,
        machine_id VARCHAR(50) NOT NULL,
        technician_id VARCHAR(50),
        priority ENUM('CRITICAL', 'HIGH', 'MEDIUM', 'LOW') NOT NULL DEFAULT 'HIGH',
        status ENUM('DRAFT', 'ASSIGNED', 'DISPATCHED', 'IN_PROGRESS', 'PARTS_ALLOCATED', 'PENDING_PARTS', 'VERIFYING', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
        loto_required BOOLEAN DEFAULT TRUE,
        loto_applied BOOLEAN DEFAULT FALSE,
        loto_verified_by VARCHAR(100),
        padlock_id VARCHAR(100),
        voltage_reading FLOAT DEFAULT 0.0,
        pressure_reading FLOAT DEFAULT 0.0,
        notes TEXT,
        assigned_at TIMESTAMP NULL,
        started_at TIMESTAMP NULL,
        completed_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE,
        FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE
      );
    `);

    await adminConn.query(`
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
      );
    `);

    await adminConn.query(`
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
      );
    `);

    await adminConn.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(50) PRIMARY KEY,
        actor VARCHAR(100) NOT NULL,
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(50) NOT NULL,
        resource_id VARCHAR(50) NOT NULL,
        previous_state JSON,
        new_state JSON,
        reason TEXT,
        correlation_id VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed 25 Factory Machines (Matching 6-Zone 3D Digital Twin World Coordinates)
    const machinesSeed = [
      // ── MACHINING CELL (center x≈-35, z≈-20.5) ──
      ['MCH-CNC-01', 'CNC-01', 'High-Precision 5-Axis Milling Center 01', 'CNC', 'Machining Cell', 'RUNNING', 98, 'CRITICAL', -42, 0, -25],
      ['MCH-CNC-02', 'CNC-02', 'Heavy Duty Turning Center 02', 'CNC', 'Machining Cell', 'RUNNING', 95, 'HIGH', -35, 0, -25],
      ['MCH-CNC-03', 'CNC-03', 'High-Precision 5-Axis Milling Center 03', 'CNC', 'Machining Cell', 'RUNNING', 98, 'HIGH', -28, 0, -25],
      ['MCH-CNC-04', 'CNC-04', '5-Axis Machining Center 04', 'CNC', 'Machining Cell', 'RUNNING', 97, 'HIGH', -42, 0, -16],
      ['MCH-CNC-05', 'CNC-05', 'High-Speed Mill 05', 'CNC', 'Machining Cell', 'RUNNING', 96, 'HIGH', -35, 0, -16],
      ['MCH-CNC-06', 'CNC-06', 'Ultra Precision Lathe 06', 'CNC', 'Machining Cell', 'RUNNING', 98, 'CRITICAL', -28, 0, -16],

      // ── ROBOT CELL (center x≈+33, z≈-20.5) ──
      ['MCH-ROB-01', 'ROBOT-01', 'Articulated 6-Axis Welding Robot 01', 'ROBOT', 'Robot Cell', 'RUNNING', 99, 'HIGH', 24, 0, -25.5],
      ['MCH-ROB-02', 'ROBOT-02', 'Heavy Payload Welding Robot 02', 'ROBOT', 'Robot Cell', 'RUNNING', 97, 'HIGH', 34, 0, -25.5],
      ['MCH-ROB-03', 'ROBOT-03', 'Precision Seam Welding Robot 03', 'ROBOT', 'Robot Cell', 'RUNNING', 96, 'HIGH', 24, 0, -15.5],
      ['MCH-ROB-04', 'ROBOT-04', 'Welding & Fastening Robot 04', 'ROBOT', 'Robot Cell', 'RUNNING', 98, 'HIGH', 34, 0, -15.5],

      // ── PROCESSING CELL (center x≈0, z≈-21) ──
      ['MCH-MIX-01', 'MIXER-01', 'High-Shear Chemical & Lubricant Mixer', 'MIXER', 'Processing Cell', 'RUNNING', 94, 'HIGH', -8, 0, -25.5],
      ['MCH-PMP-01', 'PUMP-01', 'High-Pressure Hydraulic Coolant Pump', 'PUMP', 'Processing Cell', 'RUNNING', 92, 'MEDIUM', 0, 0, -25.5],
      ['MCH-PRS-01', 'PRESS-01', 'Hydraulic Stamping & Forming Press', 'PRESS', 'Processing Cell', 'RUNNING', 96, 'HIGH', 8, 0, -25.5],
      ['MCH-PRC-01', 'PROCESS-01', 'Continuous Fluid Treatment Vessel 01', 'PROCESSING', 'Processing Cell', 'RUNNING', 97, 'MEDIUM', -8, 0, -15.5],
      ['MCH-PRC-02', 'PROCESS-02', 'Degassing & Settling Reactor 02', 'PROCESSING', 'Processing Cell', 'RUNNING', 95, 'MEDIUM', 0, 0, -15.5],

      // ── ASSEMBLY CELL (center x≈-35, z≈15) ──
      ['MCH-ASM-01', 'ASMB-01', 'Precision Screwdriving & Torque Workstation', 'ASSEMBLY', 'Assembly Cell', 'RUNNING', 97, 'HIGH', -40, 0, 10],
      ['MCH-ASM-02', 'ASMB-02', 'Optical Inspection & Vision Alignment Cell', 'ASSEMBLY', 'Assembly Cell', 'RUNNING', 98, 'HIGH', -30, 0, 10],
      ['MCH-ASM-03', 'ASMB-03', 'Indexing Rotary Table Sub-assembly Station', 'ASSEMBLY', 'Assembly Cell', 'RUNNING', 98, 'HIGH', -40, 0, 20],
      ['MCH-ASM-04', 'ASMB-04', 'Final Component Fitting & Harness Bench', 'ASSEMBLY', 'Assembly Cell', 'RUNNING', 96, 'MEDIUM', -30, 0, 20],

      // ── PACKAGING CELL (center x≈+31, z≈+16) ──
      ['MCH-PKG-01', 'PACK-01', 'Automatic Form-Fill-Seal Packaging Unit', 'PACKAGING', 'Packaging Cell', 'RUNNING', 95, 'MEDIUM', 32.0, 0, 10.5],
      ['MCH-PKG-02', 'PACK-02', 'Flow-Wrap & Shrink Packaging Machine', 'PACKAGING', 'Packaging Cell', 'RUNNING', 96, 'MEDIUM', 32.0, 0, 16.0],
      ['MCH-PKG-03', 'PACK-03', 'Palletizing & Case Packing Cell', 'PACKAGING', 'Packaging Cell', 'RUNNING', 98, 'HIGH', 32.0, 0, 21.5],

      // ── MAINTENANCE BAY (center x≈0, z≈+15.5) ──
      ['MCH-BNCH-01', 'BENCH-01', 'Diagnostic & Mechanical Overhaul Station', 'MAINTENANCE', 'Maintenance Bay', 'RUNNING', 98, 'HIGH', -6, 0, 11.5],
      ['MCH-BNCH-02', 'BENCH-02', 'High-Precision Spindle Test & Balance Bench', 'MAINTENANCE', 'Maintenance Bay', 'RUNNING', 97, 'HIGH', 6, 0, 11.5],
      ['MCH-TEST-01', 'TEST-01', 'Electronics & PLC Calibration Stand', 'MAINTENANCE', 'Maintenance Bay', 'RUNNING', 99, 'HIGH', 0, 0, 21.5],
    ];

    for (const m of machinesSeed) {
      await adminConn.query(
        `INSERT INTO machines (id, code, name, type, area, status, health_score, criticality, pos_x, pos_y, pos_z)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
           name=VALUES(name), 
           type=VALUES(type), 
           area=VALUES(area), 
           status=VALUES(status), 
           health_score=VALUES(health_score), 
           criticality=VALUES(criticality), 
           pos_x=VALUES(pos_x), 
           pos_y=VALUES(pos_y), 
           pos_z=VALUES(pos_z);`,
        m
      );
    }

    // Seed Technicians
    const techsSeed = [
      ['TECH-01', 'Arun Kumar', 'arun.kumar@plantops.internal', '+65 9123 4567', 'Lead Vibration & Spindle Specialist', JSON.stringify(['VIBRATION_ANALYSIS', 'BEARING_REPLACEMENT', 'PRECISION_ALIGNMENT', 'LOTO_SUPERVISOR']), 'Machining Cell', 'AVAILABLE', 'Morning (06:00-14:00)'],
      ['TECH-02', 'Priya Sharma', 'priya.sharma@plantops.internal', '+65 9234 5678', 'Senior Automation & Robotics Engineer', JSON.stringify(['ROBOTICS_FANUC', 'PLC_SIEMENS', 'SAFETY_CIRCUITS', 'SERVO_CALIBRATION']), 'Robot Cell', 'AVAILABLE', 'Morning (06:00-14:00)'],
      ['TECH-03', 'Rajesh Nair', 'rajesh.nair@plantops.internal', '+65 9345 6789', 'Hydraulic Systems & Mechanical Specialist', JSON.stringify(['HYDRAULIC_CIRCUITS', 'PRESSURE_TESTING', 'VALVE_CALIBRATION', 'LOTO_EXECUTION']), 'Processing Cell', 'AVAILABLE', 'Morning (06:00-14:00)'],
      ['TECH-04', 'Frank Moore', 'frank.moore@plantops.internal', '+65 9456 7890', 'Plant Maintenance Specialist', JSON.stringify(['OEE_OPTIMIZATION', 'OSHA_1910_COMPLIANCE', 'ROOT_CAUSE_ANALYSIS', 'DIAGNOSTICS']), 'Maintenance Bay', 'AVAILABLE', 'General (08:00-17:00)']
    ];

    for (const t of techsSeed) {
      await adminConn.query(
        `INSERT INTO technicians (id, name, email, phone, role, skills, assigned_area, status, shift)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name), role=VALUES(role), status=VALUES(status);`,
        t
      );
    }

    // Seed Spare Parts & Inventory
    const partsSeed = [
      ['PART-SKF-6205', 'SKF-6205-2RSH', 'Deep Groove Ball Bearing 25x52x15mm', 'Bearings', 45.0, 2, 2],
      ['PART-FAG-7210', 'FAG-7210-B-TVP', 'Angular Contact Ball Bearing 50x90x20mm', 'Bearings', 120.0, 2, 3],
      ['PART-TIMKEN-TAP-01', 'TIMKEN-32008X', 'Tapered Roller Bearing 40x68x19mm', 'Bearings', 85.0, 2, 2],
      ['PART-HYD-SEAL-01', 'PARKER-V884-75', 'Fluorocarbon Hydraulic Rod Seal Kit', 'Seals & Gaskets', 65.0, 3, 1],
      ['PART-FANUC-SV-03', 'FANUC-A06B-0223', 'AC Servo Drive Motor Alpha iF 4/4000', 'Motors & Servos', 890.0, 1, 5]
    ];

    for (const p of partsSeed) {
      await adminConn.query(
        `INSERT INTO spare_parts (id, part_number, name, category, unit_cost, min_reorder_point, lead_time_days)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name), unit_cost=VALUES(unit_cost);`,
        p
      );
    }

    const inventorySeed = [
      ['INV-01', 'PART-SKF-6205', 'Central Spares WH-01', 'BAY-A-04', 8, 1, 7],
      ['INV-02', 'PART-FAG-7210', 'Central Spares WH-01', 'BAY-A-05', 4, 0, 4],
      ['INV-03', 'PART-TIMKEN-TAP-01', 'Central Spares WH-01', 'BAY-A-06', 5, 0, 5],
      ['INV-04', 'PART-HYD-SEAL-01', 'Central Spares WH-01', 'BAY-B-12', 12, 0, 12],
      ['INV-05', 'PART-FANUC-SV-03', 'Central Spares WH-01', 'BAY-C-01', 2, 0, 2]
    ];

    for (const inv of inventorySeed) {
      await adminConn.query(
        `INSERT INTO inventory (id, part_id, warehouse_name, bin_location, quantity_on_hand, reserved_quantity, available_to_promise)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE quantity_on_hand=VALUES(quantity_on_hand), available_to_promise=VALUES(available_to_promise);`,
        inv
      );
    }

    const techniciansSeed = [
      ['TECH-01', 'Arun Kumar', 'arun.kumar@plantops.internal', '+1-555-0101', 'Lead Vibration & Spindle Specialist', JSON.stringify(['CNC_MILLING', 'MECHANICAL_VIBRATION', 'SPINDLE_SYSTEMS', 'PRECISION_ALIGNMENT', 'VIBRATION_ANALYSIS', 'BEARING_REPLACEMENT', 'OSHA_LOTO']), 'Machining Cell', 'AVAILABLE', 'Morning (06:00-14:00)', 0],
      ['TECH-02', 'Dev Patel', 'dev.patel@plantops.internal', '+1-555-0102', 'High-Speed CNC Tooling Specialist', JSON.stringify(['CNC_MILLING', 'SPINDLE_SYSTEMS', 'PRECISION_ALIGNMENT', 'OSHA_LOTO']), 'Machining Cell', 'AVAILABLE', 'Morning (06:00-14:00)', 0],
      ['TECH-03', 'Priya Sharma', 'priya.sharma@plantops.internal', '+1-555-0103', 'Senior Automation & Robotics Engineer', JSON.stringify(['ROBOTICS_KINEMATICS', 'SERVO_DRIVES', 'ELECTRICAL_MOTION', 'ROBOTICS_FANUC', 'PLC_SIEMENS', 'SAFETY_CIRCUITS', 'OSHA_LOTO']), 'Robot Cell', 'AVAILABLE', 'Morning (06:00-14:00)', 0],
      ['TECH-04', 'Lisa Wong', 'lisa.wong@plantops.internal', '+1-555-0104', 'Mechatronics & Robotics Specialist', JSON.stringify(['ROBOTICS_KINEMATICS', 'SERVO_DRIVES', 'SAFETY_CIRCUITS', 'OSHA_LOTO']), 'Robot Cell', 'AVAILABLE', 'Morning (06:00-14:00)', 0],
      ['TECH-05', 'Rajesh Nair', 'rajesh.nair@plantops.internal', '+1-555-0105', 'Hydraulic Systems & Fluid Specialist', JSON.stringify(['HYDRAULIC_CIRCUITS', 'SEAL_REPLACEMENT', 'FLUID_POWER', 'PRESSURE_TESTING', 'VALVE_CALIBRATION', 'OSHA_LOTO']), 'Processing Cell', 'AVAILABLE', 'Morning (06:00-14:00)', 0],
      ['TECH-06', 'Carlos Gomez', 'carlos.gomez@plantops.internal', '+1-555-0106', 'Chemical Process & Planetary Tech', JSON.stringify(['GEARBOX_MAINTENANCE', 'LUBRICATION_SYSTEMS', 'MECHANICAL_SEALS', 'FLUID_POWER', 'OSHA_LOTO']), 'Processing Cell', 'AVAILABLE', 'Morning (06:00-14:00)', 0],
      ['TECH-07', 'Nina Cole', 'nina.cole@plantops.internal', '+1-555-0107', 'Precision Assembly Line Specialist', JSON.stringify(['MATERIAL_HANDLING', 'ROLLER_BEARINGS', 'MOTOR_DRIVES', 'TORQUE_SYSTEMS', 'PRECISION_ALIGNMENT', 'OSHA_LOTO']), 'Assembly Cell', 'AVAILABLE', 'Morning (06:00-14:00)', 0],
      ['TECH-08', 'Ben Harris', 'ben.harris@plantops.internal', '+1-555-0108', 'Assembly Automation & Drives Tech', JSON.stringify(['MATERIAL_HANDLING', 'ROLLER_BEARINGS', 'MOTOR_DRIVES', 'BELT_TRACKING', 'OSHA_LOTO']), 'Assembly Cell', 'AVAILABLE', 'Morning (06:00-14:00)', 0],
      ['TECH-09', 'Tom Wilson', 'tom.wilson@plantops.internal', '+1-555-0109', 'Packaging Automation Specialist', JSON.stringify(['PNEUMATICS', 'PACKAGING_AUTOMATION', 'SEALERS', 'VACUUM_SYSTEMS', 'OSHA_LOTO']), 'Packaging Cell', 'AVAILABLE', 'Morning (06:00-14:00)', 0],
      ['TECH-10', 'Amy Chen', 'amy.chen@plantops.internal', '+1-555-0110', 'Cartoner & Vision Systems Tech', JSON.stringify(['PNEUMATICS', 'PACKAGING_AUTOMATION', 'SEALERS', 'OPTICAL_INSPECTION', 'OSHA_LOTO']), 'Packaging Cell', 'AVAILABLE', 'Morning (06:00-14:00)', 0],
      ['TECH-11', 'Frank Moore', 'frank.moore@plantops.internal', '+1-555-0111', 'Plant Maintenance Specialist', JSON.stringify(['HYDRAULIC_PRESSES', 'VALVE_MANIFOLDS', 'PRESSURE_SYSTEMS', 'ROOT_CAUSE_ANALYSIS', 'DIAGNOSTICS', 'OSHA_1910_COMPLIANCE', 'OSHA_LOTO']), 'Maintenance Bay', 'AVAILABLE', 'General (08:00-17:00)', 0],
      ['TECH-12', 'Tina Ross', 'tina.ross@plantops.internal', '+1-555-0112', 'Industrial Electrical & Controls Engineer', JSON.stringify(['ELECTRICAL_MOTION', 'PLC_SIEMENS', 'SAFETY_CIRCUITS', 'DIAGNOSTICS', 'HYDRAULIC_PRESSES', 'OSHA_LOTO']), 'Maintenance Bay', 'AVAILABLE', 'General (08:00-17:00)', 0]
    ];

    for (const tech of techniciansSeed) {
      await adminConn.query(
        `INSERT INTO technicians (id, name, email, phone, role, skills, assigned_area, status, shift, active_work_orders)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name), role=VALUES(role), skills=VALUES(skills), assigned_area=VALUES(assigned_area);`,
        tech
      );
    }

    await adminConn.end();
    console.log('✅ [TiDB Cloud] Schema creation & 25 machines + parts inventory + 12 technicians seeded successfully!\n');
  } catch (err: any) {
    console.error('❌ [TiDB Cloud] Error during initialization:', err.message);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Timescale Cloud Telemetry Initialization
  // ───────────────────────────────────────────────────────────────────────────
  try {
    console.log(`[Timescale Cloud] Connecting to ${config.timescale.host}:${config.timescale.port}/${config.timescale.database}...`);
    const tsPool = new pg.Pool({
      host: config.timescale.host,
      port: config.timescale.port,
      user: config.timescale.user,
      password: config.timescale.password,
      database: config.timescale.database,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000
    });

    await tsPool.query(`
      CREATE TABLE IF NOT EXISTS telemetry_logs (
        time TIMESTAMPTZ NOT NULL,
        machine_id VARCHAR(50) NOT NULL,
        temperature DOUBLE PRECISION,
        vibration DOUBLE PRECISION,
        current DOUBLE PRECISION,
        rpm DOUBLE PRECISION,
        pressure DOUBLE PRECISION
      );
    `);

    try {
      await tsPool.query(`SELECT create_hypertable('telemetry_logs', 'time', if_not_exists => TRUE);`);
    } catch (htErr: any) {
      // If already a hypertable or standard table
    }

    await tsPool.query(`CREATE INDEX IF NOT EXISTS idx_telemetry_machine_time ON telemetry_logs (machine_id, time DESC);`);
    await tsPool.end();
    console.log('✅ [Timescale Cloud] Telemetry hypertable & index initialized successfully!\n');
  } catch (err: any) {
    console.error('❌ [Timescale Cloud] Error during initialization:', err.message);
  }
}

if (process.argv[1] && process.argv[1].endsWith('bootstrapCloudDb.ts')) {
  bootstrapCloudDatabases().then(() => process.exit(0)).catch(() => process.exit(1));
}
