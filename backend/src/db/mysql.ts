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

    // 1b. Create authoritative machine_operational_events table with Idempotency Key
    await execute(`
      CREATE TABLE IF NOT EXISTS machine_operational_events (
        id                VARCHAR(50)  NOT NULL PRIMARY KEY,
        event_id          VARCHAR(128) NOT NULL UNIQUE,
        machine_id        VARCHAR(50)  NOT NULL,
        machine_code      VARCHAR(32)  NOT NULL,
        event_type        VARCHAR(60)  NOT NULL,
        actor_type        VARCHAR(40)  NOT NULL DEFAULT 'SYSTEM',
        actor_id          VARCHAR(80)  NULL,
        incident_id       VARCHAR(50)  NULL,
        work_order_id     VARCHAR(50)  NULL,
        technician_id     VARCHAR(80)  NULL,
        part_id           VARCHAR(50)  NULL,
        status_before     VARCHAR(40)  NULL,
        status_after      VARCHAR(40)  NULL,
        quantity          INT          NOT NULL DEFAULT 0,
        duration_seconds  DOUBLE       NULL,
        metadata_json     JSON         NULL,
        event_time        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        created_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_moe_code_time   (machine_code, event_time),
        INDEX idx_moe_incident    (incident_id),
        INDEX idx_moe_wo          (work_order_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 1c. Create machine_daily_summary table for O(1) Calendar and History Lookups
    await execute(`
      CREATE TABLE IF NOT EXISTS machine_daily_summary (
        id                    VARCHAR(64)  NOT NULL PRIMARY KEY,
        machine_id            VARCHAR(50)  NOT NULL,
        machine_code          VARCHAR(32)  NOT NULL,
        machine_name          VARCHAR(150) NOT NULL,
        cell_name             VARCHAR(100) NOT NULL,
        business_date         DATE         NOT NULL,
        power_on_seconds      INT          NOT NULL DEFAULT 0,
        running_seconds       INT          NOT NULL DEFAULT 0,
        idle_seconds          INT          NOT NULL DEFAULT 0,
        downtime_seconds      INT          NOT NULL DEFAULT 0,
        maintenance_seconds   INT          NOT NULL DEFAULT 0,
        target_rate_per_hour  INT          NOT NULL DEFAULT 45,
        planned_production    INT          NOT NULL DEFAULT 0,
        actual_production     INT          NOT NULL DEFAULT 0,
        good_pieces           INT          NOT NULL DEFAULT 0,
        scrap_pieces          INT          NOT NULL DEFAULT 0,
        missed_pieces         INT          NOT NULL DEFAULT 0,
        fault_count           INT          NOT NULL DEFAULT 0,
        warning_count         INT          NOT NULL DEFAULT 0,
        incident_count        INT          NOT NULL DEFAULT 0,
        work_order_count      INT          NOT NULL DEFAULT 0,
        availability_pct      DOUBLE       NOT NULL DEFAULT 100.0,
        status                VARCHAR(30)  NOT NULL DEFAULT 'RUNNING',
        assigned_technician   VARCHAR(100) NULL,
        first_power_on_at     DATETIME(3)  NULL,
        last_power_off_at     DATETIME(3)  NULL,
        first_production_at   DATETIME(3)  NULL,
        last_production_at    DATETIME(3)  NULL,
        updated_at            TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_machine_bdate (machine_code, business_date),
        INDEX idx_mds_date_machine (business_date, machine_code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 1d. Create plant_power_events table
    await execute(`
      CREATE TABLE IF NOT EXISTS plant_power_events (
        id              VARCHAR(50) NOT NULL PRIMARY KEY,
        event_type      VARCHAR(50) NOT NULL,
        event_time      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        triggered_by    VARCHAR(80) NOT NULL DEFAULT 'OPERATOR',
        metadata        JSON NULL,
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ppe_time (event_time)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 1e. Create authoritative logistics_pallets table with high-performance indexes
    await execute(`
      CREATE TABLE IF NOT EXISTS logistics_pallets (
        id                VARCHAR(64)   NOT NULL PRIMARY KEY,
        transport_id      VARCHAR(64)   NOT NULL,
        pallet_number     VARCHAR(64)   NOT NULL,
        rfid_tag          VARCHAR(64)   NOT NULL,
        pieces_count      INT           NOT NULL DEFAULT 240,
        cartons_count     INT           NOT NULL DEFAULT 10,
        max_pieces        INT           NOT NULL DEFAULT 240,
        status            VARCHAR(32)   NOT NULL DEFAULT 'ACCUMULATING',
        assigned_agv      VARCHAR(32)   NULL,
        destination_bay   VARCHAR(128)  NOT NULL DEFAULT 'Outbound Logistics Dock — Bay 02',
        packed_at         VARCHAR(64)   NOT NULL,
        dispatched_at     DATETIME(3)   NULL,
        delivered_at      DATETIME(3)   NULL,
        created_at        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_pallets_status_created (status, created_at DESC),
        INDEX idx_pallets_transport_id   (transport_id),
        INDEX idx_pallets_number         (pallet_number),
        INDEX idx_pallets_rfid           (rfid_tag)
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

    // 3. Machine runtime/downtime tracking columns
    const machineColumnsToAdd = [
      { name: 'last_running_started_at', type: 'DATETIME(3) NULL' },
      { name: 'total_runtime_seconds', type: 'DOUBLE NOT NULL DEFAULT 0' },
      { name: 'downtime_started_at', type: 'DATETIME(3) NULL' },
    ];
    for (const col of machineColumnsToAdd) {
      const existing = await query<{ cnt: number }>(`
        SELECT COUNT(*) as cnt FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'machines' AND COLUMN_NAME = ?
      `, [col.name]);
      if (existing[0]?.cnt === 0) {
        await execute(`ALTER TABLE machines ADD COLUMN \`${col.name}\` ${col.type}`);
        console.log(`[MySQL Migration] Added column \`${col.name}\` to machines`);
      }
    }
    // Backfill: machines already RUNNING with no runtime clock started yet begin accruing now.
    await execute(
      `UPDATE machines SET last_running_started_at = CURRENT_TIMESTAMP(3) WHERE status = 'RUNNING' AND last_running_started_at IS NULL`
    );

    // 3b. `machine_components` / `sensor_thresholds` are queried by
    // GET /machines and GET /machines/:codeOrId but were never created by any
    // schema script. Every call to those routes has therefore always thrown
    // and silently fallen back to the hardcoded MOCK_MACHINES array (static,
    // always RUNNING) — this is why status changes made by the maintenance
    // lifecycle kept appearing to "revert to RUNNING" after any refreshAll().
    await execute(`
      CREATE TABLE IF NOT EXISTS machine_components (
        id              VARCHAR(50) NOT NULL PRIMARY KEY,
        machine_id      VARCHAR(50) NOT NULL,
        name            VARCHAR(150) NOT NULL,
        component_type  VARCHAR(50) NOT NULL DEFAULT 'GENERIC',
        criticality     ENUM('CRITICAL','HIGH','MEDIUM','LOW') NOT NULL DEFAULT 'MEDIUM',
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_mc_machine (machine_id),
        FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await execute(`
      CREATE TABLE IF NOT EXISTS sensor_thresholds (
        id                VARCHAR(50) NOT NULL PRIMARY KEY,
        machine_id        VARCHAR(50) NOT NULL,
        sensor_type       VARCHAR(50) NOT NULL,
        warning_threshold FLOAT NULL,
        fault_threshold   FLOAT NULL,
        unit              VARCHAR(20) NULL,
        INDEX idx_st_machine (machine_id),
        FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    // inventory.service.ts's reservePart() has always depended on this table;
    // without it every inspection-phase part reservation silently failed
    // (caught by the route's broad try/catch), so ATP inventory counts never
    // actually reflected reserved parts.
    await execute(`
      CREATE TABLE IF NOT EXISTS part_reservations (
        id             VARCHAR(50) NOT NULL PRIMARY KEY,
        work_order_id  VARCHAR(50) NOT NULL,
        part_id        VARCHAR(50) NOT NULL,
        quantity       INT NOT NULL DEFAULT 1,
        status         ENUM('RESERVED','CONSUMED','RELEASED') NOT NULL DEFAULT 'RESERVED',
        created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_pr_wo (work_order_id),
        INDEX idx_pr_part (part_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 4. Technician lifecycle phase column on work_orders (independent of the coarse
    // technicians.status enum — tracks exactly where the assigned technician is in
    // the maintenance workflow for this specific work order).
    const woExisting = await query<{ cnt: number }>(`
      SELECT COUNT(*) as cnt FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'work_orders' AND COLUMN_NAME = 'technician_phase'
    `);
    if (woExisting[0]?.cnt === 0) {
      await execute(`ALTER TABLE work_orders ADD COLUMN \`technician_phase\` VARCHAR(20) NOT NULL DEFAULT 'ASSIGNED'`);
      console.log('[MySQL Migration] Added column `technician_phase` to work_orders');
    }

    // 5. Ensure all 12 certified technicians are seeded and updated in TiDB Cloud
    const techniciansRoster = [
      ['TECH-01', 'Arun Kumar', 'arun.kumar@plantops.internal', '+1-555-0101', 'Lead Vibration & Spindle Specialist', JSON.stringify(['CNC_MILLING', 'MECHANICAL_VIBRATION', 'SPINDLE_SYSTEMS', 'PRECISION_ALIGNMENT', 'VIBRATION_ANALYSIS', 'BEARING_REPLACEMENT', 'OSHA_LOTO']), 'Machining Cell', 'AVAILABLE', 'Morning (06:00-14:00)', 0],
      ['TECH-02', 'Priya Sharma', 'priya.sharma@plantops.internal', '+1-555-0102', 'Senior Automation & Robotics Engineer', JSON.stringify(['ROBOTICS_KINEMATICS', 'SERVO_DRIVES', 'ELECTRICAL_MOTION', 'ROBOTICS_FANUC', 'PLC_SIEMENS', 'SAFETY_CIRCUITS', 'OSHA_LOTO']), 'Robot Cell', 'AVAILABLE', 'Morning (06:00-14:00)', 0],
      ['TECH-03', 'Rajesh Nair', 'rajesh.nair@plantops.internal', '+1-555-0103', 'Hydraulic Systems & Fluid Specialist', JSON.stringify(['HYDRAULIC_CIRCUITS', 'SEAL_REPLACEMENT', 'FLUID_POWER', 'PRESSURE_TESTING', 'VALVE_CALIBRATION', 'OSHA_LOTO']), 'Processing Cell', 'AVAILABLE', 'Morning (06:00-14:00)', 0],
      ['TECH-04', 'Frank Moore', 'frank.moore@plantops.internal', '+1-555-0104', 'Plant Maintenance Specialist', JSON.stringify(['HYDRAULIC_PRESSES', 'VALVE_MANIFOLDS', 'PRESSURE_SYSTEMS', 'ROOT_CAUSE_ANALYSIS', 'DIAGNOSTICS', 'OSHA_1910_COMPLIANCE', 'OSHA_LOTO']), 'Maintenance Bay', 'AVAILABLE', 'General (08:00-17:00)', 0],
      ['TECH-05', 'Dev Patel', 'dev.patel@plantops.internal', '+1-555-0105', 'High-Speed CNC Tooling Specialist', JSON.stringify(['CNC_MILLING', 'SPINDLE_SYSTEMS', 'PRECISION_ALIGNMENT', 'OSHA_LOTO']), 'Machining Cell', 'AVAILABLE', 'Morning (06:00-14:00)', 0],
      ['TECH-06', 'Carlos Gomez', 'carlos.gomez@plantops.internal', '+1-555-0106', 'Chemical Process & Planetary Tech', JSON.stringify(['GEARBOX_MAINTENANCE', 'LUBRICATION_SYSTEMS', 'MECHANICAL_SEALS', 'FLUID_POWER', 'OSHA_LOTO']), 'Processing Cell', 'AVAILABLE', 'Morning (06:00-14:00)', 0],
      ['TECH-07', 'Nina Cole', 'nina.cole@plantops.internal', '+1-555-0107', 'Precision Assembly Line Specialist', JSON.stringify(['MATERIAL_HANDLING', 'ROLLER_BEARINGS', 'MOTOR_DRIVES', 'TORQUE_SYSTEMS', 'PRECISION_ALIGNMENT', 'OSHA_LOTO']), 'Assembly Cell', 'AVAILABLE', 'Morning (06:00-14:00)', 0],
      ['TECH-08', 'Ben Harris', 'ben.harris@plantops.internal', '+1-555-0108', 'Assembly Automation & Drives Tech', JSON.stringify(['MATERIAL_HANDLING', 'ROLLER_BEARINGS', 'MOTOR_DRIVES', 'BELT_TRACKING', 'OSHA_LOTO']), 'Assembly Cell', 'AVAILABLE', 'Morning (06:00-14:00)', 0],
      ['TECH-09', 'Tom Wilson', 'tom.wilson@plantops.internal', '+1-555-0109', 'Packaging Automation Specialist', JSON.stringify(['PNEUMATICS', 'PACKAGING_AUTOMATION', 'SEALERS', 'VACUUM_SYSTEMS', 'OSHA_LOTO']), 'Packaging Cell', 'AVAILABLE', 'Morning (06:00-14:00)', 0],
      ['TECH-10', 'Amy Chen', 'amy.chen@plantops.internal', '+1-555-0110', 'Cartoner & Vision Systems Tech', JSON.stringify(['PNEUMATICS', 'PACKAGING_AUTOMATION', 'SEALERS', 'OPTICAL_INSPECTION', 'OSHA_LOTO']), 'Packaging Cell', 'AVAILABLE', 'Morning (06:00-14:00)', 0],
      ['TECH-11', 'Lisa Wong', 'lisa.wong@plantops.internal', '+1-555-0111', 'Mechatronics & Robotics Specialist', JSON.stringify(['ROBOTICS_KINEMATICS', 'SERVO_DRIVES', 'SAFETY_CIRCUITS', 'OSHA_LOTO']), 'Robot Cell', 'AVAILABLE', 'Morning (06:00-14:00)', 0],
      ['TECH-12', 'Tina Ross', 'tina.ross@plantops.internal', '+1-555-0112', 'Industrial Electrical & Controls Engineer', JSON.stringify(['ELECTRICAL_MOTION', 'PLC_SIEMENS', 'SAFETY_CIRCUITS', 'DIAGNOSTICS', 'HYDRAULIC_PRESSES', 'OSHA_LOTO']), 'Maintenance Bay', 'AVAILABLE', 'General (08:00-17:00)', 0]
    ];

    for (const tech of techniciansRoster) {
      await execute(
        `INSERT INTO technicians (id, name, email, phone, role, skills, assigned_area, status, shift, active_work_orders)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name), email=VALUES(email), role=VALUES(role), skills=VALUES(skills), assigned_area=VALUES(assigned_area);`,
        tech
      );
    }

    // Automatically recalculate technician availability & status in TiDB Cloud
    await execute(`
      UPDATE technicians t
      SET t.active_work_orders = (
        SELECT COUNT(*) FROM work_orders wo WHERE wo.technician_id = t.id AND wo.status != 'COMPLETED'
      )
    `);
    await execute(`
      UPDATE technicians
      SET status = CASE WHEN active_work_orders > 0 THEN 'BUSY' ELSE 'AVAILABLE' END
    `);

    // 6. Create pm_schedules table in TiDB Cloud
    await execute(`
      CREATE TABLE IF NOT EXISTS pm_schedules (
        id VARCHAR(50) PRIMARY KEY,
        machine_id VARCHAR(50) NOT NULL,
        machine_code VARCHAR(50) NOT NULL,
        machine_name VARCHAR(150) NOT NULL,
        area VARCHAR(100) NOT NULL,
        task_title VARCHAR(255) NOT NULL,
        sop_code VARCHAR(50) NOT NULL,
        interval_days INT NOT NULL DEFAULT 90,
        frequency_label VARCHAR(100) NOT NULL DEFAULT 'Every 90 Days (Quarterly)',
        priority ENUM('HIGH', 'MEDIUM', 'LOW') NOT NULL DEFAULT 'HIGH',
        status ENUM('SCHEDULED', 'DISPATCHED', 'INSPECTING', 'COMPLETED', 'OVERDUE') NOT NULL DEFAULT 'SCHEDULED',
        assigned_technician_id VARCHAR(50) NULL,
        assigned_technician_name VARCHAR(100) NULL,
        work_order_id VARCHAR(50) NULL,
        last_performed_at VARCHAR(50) NULL,
        next_due_date VARCHAR(50) NOT NULL,
        checklist_schema JSON NOT NULL,
        created_by VARCHAR(100) DEFAULT 'SUPERVISOR',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_pm_machine (machine_code),
        INDEX idx_pm_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 7. Create technician_machine_clusters table in TiDB Cloud
    await execute(`
      CREATE TABLE IF NOT EXISTS technician_machine_clusters (
        id VARCHAR(50) PRIMARY KEY,
        technician_id VARCHAR(50) NOT NULL,
        technician_name VARCHAR(100) NOT NULL,
        machine_code VARCHAR(50) NOT NULL,
        machine_name VARCHAR(150) NOT NULL,
        assigned_area VARCHAR(100) NOT NULL,
        assigned_by VARCHAR(100) DEFAULT 'SUPERVISOR',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_tech_cluster (technician_id, machine_code),
        INDEX idx_cluster_tech (technician_id),
        INDEX idx_cluster_machine (machine_code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 8. Seed Technician Clusters if empty
    const clusterCount = await query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM technician_machine_clusters');
    if ((clusterCount[0]?.cnt || 0) === 0) {
      const initialClusters = [
        ['CLUS-01', 'TECH-01', 'Arun Kumar', 'CNC-01', '5-Axis CNC Milling Center 01', 'Machining Cell'],
        ['CLUS-02', 'TECH-01', 'Arun Kumar', 'CNC-02', 'Heavy Duty Turning Center 02', 'Machining Cell'],
        ['CLUS-03', 'TECH-01', 'Arun Kumar', 'CNC-03', 'High-Precision Milling Center 03', 'Machining Cell'],
        ['CLUS-04', 'TECH-05', 'Dev Patel', 'CNC-04', '5-Axis Machining Center 04', 'Machining Cell'],
        ['CLUS-05', 'TECH-05', 'Dev Patel', 'CNC-05', 'High-Speed Mill 05', 'Machining Cell'],
        ['CLUS-06', 'TECH-05', 'Dev Patel', 'CNC-06', 'Ultra Precision Lathe 06', 'Machining Cell'],
        ['CLUS-07', 'TECH-02', 'Priya Sharma', 'ROBOT-01', '6-Axis Articulated Robot 01', 'Robot Cell'],
        ['CLUS-08', 'TECH-02', 'Priya Sharma', 'ROBOT-02', 'Heavy Payload Welding Robot 02', 'Robot Cell'],
        ['CLUS-09', 'TECH-11', 'Lisa Wong', 'ROBOT-03', 'Precision Seam Welding Robot 03', 'Robot Cell'],
        ['CLUS-10', 'TECH-11', 'Lisa Wong', 'ROBOT-04', 'Welding & Fastening Robot 04', 'Robot Cell'],
        ['CLUS-11', 'TECH-03', 'Rajesh Nair', 'PUMP-01', 'High-Pressure Hydraulic Coolant Pump', 'Processing Cell'],
        ['CLUS-12', 'TECH-03', 'Rajesh Nair', 'PRESS-01', 'Hydraulic Stamping & Forming Press', 'Processing Cell'],
        ['CLUS-13', 'TECH-03', 'Rajesh Nair', 'PROCESS-01', 'Continuous Fluid Treatment Vessel 01', 'Processing Cell'],
        ['CLUS-14', 'TECH-06', 'Carlos Gomez', 'MIXER-01', 'High-Shear Chemical & Lubricant Mixer', 'Processing Cell'],
        ['CLUS-15', 'TECH-06', 'Carlos Gomez', 'PROCESS-02', 'Degassing & Settling Reactor 02', 'Processing Cell'],
        ['CLUS-16', 'TECH-07', 'Nina Cole', 'ASMB-01', 'Precision Screwdriving Workstation 01', 'Assembly Cell'],
        ['CLUS-17', 'TECH-07', 'Nina Cole', 'ASMB-02', 'Optical Inspection & Vision Cell', 'Assembly Cell'],
        ['CLUS-18', 'TECH-08', 'Ben Harris', 'ASMB-03', 'Indexing Rotary Table Sub-assembly', 'Assembly Cell'],
        ['CLUS-19', 'TECH-08', 'Ben Harris', 'ASMB-04', 'Final Component Fitting Bench', 'Assembly Cell'],
        ['CLUS-20', 'TECH-09', 'Tom Wilson', 'PACK-01', 'Automatic Form-Fill-Seal Packaging Unit', 'Packaging Cell'],
        ['CLUS-21', 'TECH-09', 'Tom Wilson', 'PACK-02', 'Flow-Wrap & Shrink Packaging Machine', 'Packaging Cell'],
        ['CLUS-22', 'TECH-10', 'Amy Chen', 'PACK-03', 'Palletizing & Case Packing Cell', 'Packaging Cell'],
        ['CLUS-23', 'TECH-04', 'Frank Moore', 'BENCH-01', 'Diagnostic & Mechanical Overhaul Station', 'Maintenance Bay'],
        ['CLUS-24', 'TECH-04', 'Frank Moore', 'BENCH-02', 'Spindle Test & Balance Bench', 'Maintenance Bay'],
        ['CLUS-25', 'TECH-12', 'Tina Ross', 'TEST-01', 'Electronics & PLC Calibration Stand', 'Maintenance Bay']
      ];

      for (const cl of initialClusters) {
        await execute(
          `INSERT INTO technician_machine_clusters (id, technician_id, technician_name, machine_code, machine_name, assigned_area)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE technician_name=VALUES(technician_name), machine_name=VALUES(machine_name), assigned_area=VALUES(assigned_area)`,
          cl
        );
      }
      console.log('[MySQL Migration] Seeded 25 technician-machine cluster pairings in TiDB Cloud.');
    }

    // 9. Seed PM Schedules if empty
    const pmCount = await query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM pm_schedules');
    if ((pmCount[0]?.cnt || 0) === 0) {
      const initialSchedules = [
        [
          'PM-2026-091', 'MCH-CNC-01', 'CNC-01', '5-Axis CNC Milling Center 01', 'Machining Cell',
          'Spindle Taper Runout & ISO Dynamic Balancing Check', 'SOP-CNC-M-04', 90, 'Every 90 Days (Quarterly)',
          'HIGH', 'SCHEDULED', 'TECH-01', 'Arun Kumar', null, '28 Jun 2026', '26 Sep 2026',
          JSON.stringify([
            { id: 'c1', label: 'Inspect spindle taper for galling & debris', checked: false },
            { id: 'c2', label: 'Measure radial & axial spindle runout (< 2.5 µm)', checked: false },
            { id: 'c3', label: 'Run FFT vibration spectrum at 12,000 RPM nominal', checked: false },
            { id: 'c4', label: 'Replenish automatic micro-mist spindle lubricant', checked: false },
            { id: 'c5', label: 'Verify safety door interlocks & emergency stop response', checked: false }
          ])
        ],
        [
          'PM-2026-092', 'MCH-ROB-01', 'ROBOT-01', '6-Axis Articulated Welding Robot 01', 'Robot Cell',
          'Harmonic Drive Backlash Check & Joint 1-6 Torque Calibration', 'SOP-ROB-K-02', 120, 'Every 120 Days (Tri-Annual)',
          'HIGH', 'SCHEDULED', 'TECH-02', 'Priya Sharma', null, '30 May 2026', '28 Sep 2026',
          JSON.stringify([
            { id: 'r1', label: 'Inspect robotic arm cabling harness & dress pack', checked: false },
            { id: 'r2', label: 'Check J1-J6 harmonic drive reducer backlash tolerances', checked: false },
            { id: 'r3', label: 'Perform zero-point mastering & TCP accuracy calibration', checked: false },
            { id: 'r4', label: 'Inspect MIG welding torch tip, nozzle & gas diffuser', checked: false },
            { id: 'r5', label: 'Verify light curtain & cell safety boundary interlocks', checked: false }
          ])
        ],
        [
          'PM-2026-093', 'MCH-PMP-01', 'PUMP-01', 'High-Pressure Hydraulic Coolant Pump', 'Processing Cell',
          'Filter Cartridge Replacement & Hydraulic Seal Cavitation Test', 'SOP-PMP-H-02', 30, 'Every 30 Days (Monthly)',
          'HIGH', 'SCHEDULED', 'TECH-03', 'Rajesh Nair', null, '25 Aug 2026', '25 Sep 2026',
          JSON.stringify([
            { id: 'p1', label: 'Verify 0.0 bar manifold pressure before filter opening', checked: false },
            { id: 'p2', label: 'Replace 10-micron hydraulic return filter cartridge', checked: false },
            { id: 'p3', label: 'Inspect casing seal for weepage & cavitation noise', checked: false },
            { id: 'p4', label: 'Calibrate pressure relief valve manifold to 6.0 bar', checked: false },
            { id: 'p5', label: 'Log oil particulate count & ISO cleanliness index', checked: false }
          ])
        ],
        [
          'PM-2026-094', 'MCH-MIX-01', 'MIXER-01', 'High-Shear Chemical & Lubricant Mixer', 'Processing Cell',
          'Agitator Planetary Gearbox Oil Flush & Dual Mechanical Seal Test', 'SOP-MIX-G-01', 60, 'Every 60 Days (Bi-Monthly)',
          'MEDIUM', 'SCHEDULED', 'TECH-06', 'Carlos Gomez', null, '31 Jul 2026', '30 Sep 2026',
          JSON.stringify([
            { id: 'm1', label: 'Drain and flush ISO VG 220 synthetic planetary gear oil', checked: false },
            { id: 'm2', label: 'Inspect dual mechanical seal barrier fluid reservoir', checked: false },
            { id: 'm3', label: 'Measure helical agitator shaft radial deflection', checked: false },
            { id: 'm4', label: 'Torque impeller mounting bolts to 145 Nm', checked: false }
          ])
        ],
        [
          'PM-2026-095', 'MCH-ASM-01', 'ASMB-01', 'Precision Screwdriving Workstation 01', 'Assembly Cell',
          'Digital Torque Spindle Transducer Calibration & ISO 5393 Audit', 'SOP-ASM-T-03', 90, 'Every 90 Days (Quarterly)',
          'MEDIUM', 'SCHEDULED', 'TECH-07', 'Nina Cole', null, '04 Jul 2026', '02 Oct 2026',
          JSON.stringify([
            { id: 'a1', label: 'Calibrate digital torque transducer with master beam tester', checked: false },
            { id: 'a2', label: 'Inspect automated fastener screw feeder vacuum pickup', checked: false },
            { id: 'a3', label: 'Verify Cm/Cmk capability index (> 1.67 standard)', checked: false }
          ])
        ],
        [
          'PM-2026-096', 'MCH-PKG-01', 'PACK-01', 'Automatic Form-Fill-Seal Packaging Unit', 'Packaging Cell',
          'Rotary Thermal Sealer Teflon Coating & Pneumatic Vacuum Check', 'SOP-PKG-S-01', 30, 'Every 30 Days (Monthly)',
          'LOW', 'SCHEDULED', 'TECH-09', 'Tom Wilson', null, '05 Sep 2026', '05 Oct 2026',
          JSON.stringify([
            { id: 'pk1', label: 'Inspect heat sealing jaws and replace Teflon tape strip', checked: false },
            { id: 'pk2', label: 'Test vacuum suction cups and replace worn silicone bellows', checked: false },
            { id: 'pk3', label: 'Verify thermal PID controller temperature accuracy (±1.5°C)', checked: false }
          ])
        ],
        [
          'PM-2026-097', 'MCH-BNCH-01', 'BENCH-01', 'Diagnostic & Mechanical Overhaul Station', 'Maintenance Bay',
          'Dynamometer Load Cell Calibration & Spindle Run-in Stand Audit', 'SOP-MNT-D-01', 120, 'Every 120 Days (Tri-Annual)',
          'MEDIUM', 'SCHEDULED', 'TECH-04', 'Frank Moore', null, '12 Jun 2026', '10 Oct 2026',
          JSON.stringify([
            { id: 'b1', label: 'Perform dead-weight calibration on dyno torque load cell', checked: false },
            { id: 'b2', label: 'Inspect balance test vibration accelerometer calibration', checked: false },
            { id: 'b3', label: 'Service test motor coolant closed-loop chiller', checked: false }
          ])
        ]
      ];

      for (const s of initialSchedules) {
        await execute(
          `INSERT INTO pm_schedules (
            id, machine_id, machine_code, machine_name, area, task_title, sop_code, interval_days,
            frequency_label, priority, status, assigned_technician_id, assigned_technician_name,
            work_order_id, last_performed_at, next_due_date, checklist_schema
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE task_title=VALUES(task_title), next_due_date=VALUES(next_due_date);`,
          s
        );
      }
      console.log('[MySQL Migration] Seeded initial PM recurring schedules in TiDB Cloud.');
    }

    // 10. Create plant_intercom_messages table in TiDB Cloud
    await execute(`
      CREATE TABLE IF NOT EXISTS plant_intercom_messages (
        id VARCHAR(50) PRIMARY KEY,
        sender_role VARCHAR(50) NOT NULL,
        sender_name VARCHAR(100) NOT NULL,
        recipient_role VARCHAR(50) NOT NULL DEFAULT 'ALL',
        channel ENUM('BROADCAST', 'ESCALATION', 'SPARE_REQUEST', 'SAFETY_LOTO', 'PO_APPROVAL', 'AI_ASSISTANT') NOT NULL DEFAULT 'BROADCAST',
        priority ENUM('NORMAL', 'HIGH', 'CRITICAL', 'EMERGENCY') NOT NULL DEFAULT 'NORMAL',
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        metadata JSON NULL,
        status ENUM('OPEN', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'RESOLVED', 'ACKNOWLEDGED') NOT NULL DEFAULT 'OPEN',
        resolution_note TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_msg_sender (sender_role),
        INDEX idx_msg_recipient (recipient_role),
        INDEX idx_msg_channel (channel),
        INDEX idx_msg_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 11. Seed sample inter-role messages if empty
    const msgCount = await query<{ cnt: number }>('SELECT COUNT(*) as cnt FROM plant_intercom_messages');
    if ((msgCount[0]?.cnt || 0) === 0) {
      const initialMessages = [
        [
          'MSG-001', 'TECHNICIAN', 'Arun Kumar', 'INVENTORY_MGMT', 'SPARE_REQUEST', 'HIGH',
          'Urgent Spindle Bearing Request for CNC-01',
          'We have detected harmonic vibration on CNC-01 spindle. Need 1x Angular Contact Spindle Bearing (7008-H) staged at BAY-B-04 for emergency PM overhaul.',
          JSON.stringify({ machineCode: 'CNC-01', partId: 'PRT-BRG-7008', workOrderId: 'WO-2026-0881', qty: 1 }),
          'ACKNOWLEDGED', 'Part reserved and staged in Bay B shelf 4.'
        ],
        [
          'MSG-002', 'INVENTORY_MGMT', 'Sarah Jenkins', 'MANAGER', 'PO_APPROVAL', 'HIGH',
          'PO #2026-441 Approval: 4x Spindle Cartridges ($3,850.00)',
          'Stock reached reorder buffer (ATP <= 2 units). Supplier NSK Bearings Ltd quoted $3,850.00 with 2-day expedited freight. Requires Manager authorization.',
          JSON.stringify({ poId: 'PO-2026-441', amount: 3850.00, vendor: 'NSK Precision Bearing Co.', itemsCount: 4 }),
          'PENDING_APPROVAL', null
        ],
        [
          'MSG-003', 'SUPERVISOR', 'Marcus Vance', 'ALL', 'BROADCAST', 'NORMAL',
          'Shift Handover & PM Schedule Update',
          'Morning shift OEE at 86.4%. CNC-01 and ROBOT-01 scheduled for 90d/120d PM during shift handover at 14:00. Arun Kumar and Priya Sharma lead.',
          JSON.stringify({ shift: 'Morning -> Afternoon', targetOEE: '88.0%' }),
          'OPEN', null
        ],
        [
          'MSG-004', 'AI_COPILOT', 'Antigravity Industrial AI', 'SUPERVISOR', 'ESCALATION', 'CRITICAL',
          'Auto-Anomaly Triage: CNC-01 Spindle Bearing Spalling Risk',
          'Telemetry spike detected (78.4°C, 4.82 mm/s). AI diagnosis: Outer race spalling. Recommended OSHA 1910.147 LOTO and technician dispatch to Arun Kumar.',
          JSON.stringify({ machineCode: 'CNC-01', anomalyScore: 0.94, recommendedTech: 'TECH-01' }),
          'RESOLVED', 'Dispatched cluster technician Arun Kumar automatically.'
        ]
      ];

      for (const m of initialMessages) {
        await execute(
          `INSERT INTO plant_intercom_messages (
            id, sender_role, sender_name, recipient_role, channel, priority, title, message, metadata, status, resolution_note
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE title=VALUES(title);`,
          m
        );
      }
      console.log('[MySQL Migration] Seeded initial plant intercom messages and escalations.');
    }

    console.log('[MySQL Migration] Schema migrations, PM routines, and technician clusters up to date in TiDB Cloud.');
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

