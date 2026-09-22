-- PlantOps Enterprise MySQL Initial Schema & Seed Data

CREATE DATABASE IF NOT EXISTS plantops_db;
USE plantops_db;

-- 1. ASSET HIERARCHY & 3D TOPOLOGY
CREATE TABLE IF NOT EXISTS machines (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    type ENUM('CNC', 'ROBOT', 'PUMP', 'MIXER', 'CONVEYOR') NOT NULL,
    area VARCHAR(100) DEFAULT 'Main Production Cell A',
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

CREATE TABLE IF NOT EXISTS machine_components (
    id VARCHAR(50) PRIMARY KEY,
    machine_id VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    component_type VARCHAR(50) NOT NULL,
    criticality ENUM('CRITICAL', 'HIGH', 'MEDIUM', 'LOW') DEFAULT 'HIGH',
    FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sensor_thresholds (
    id VARCHAR(50) PRIMARY KEY,
    machine_id VARCHAR(50) NOT NULL,
    sensor_type ENUM('temperature', 'vibration', 'current', 'pressure', 'rpm') NOT NULL,
    unit VARCHAR(20) NOT NULL,
    warning_min FLOAT DEFAULT NULL,
    warning_max FLOAT DEFAULT NULL,
    fault_min FLOAT DEFAULT NULL,
    fault_max FLOAT DEFAULT NULL,
    FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE,
    UNIQUE KEY uq_machine_sensor (machine_id, sensor_type)
);

-- 2. TECHNICIANS & SKILLS
CREATE TABLE IF NOT EXISTS technicians (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(50) DEFAULT 'Lead Reliability Specialist',
    skills JSON NOT NULL, -- e.g. ["VIBRATION_ANALYSIS", "BEARING_REPLACEMENT", "ELECTRICAL_DIAGNOSTICS"]
    assigned_area VARCHAR(100) DEFAULT 'Main Production Cell A',
    status ENUM('AVAILABLE', 'ON_DUTY', 'BUSY', 'OFF_DUTY') DEFAULT 'AVAILABLE',
    shift VARCHAR(50) DEFAULT 'Morning (06:00-14:00)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. SPARE PARTS & INVENTORY
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

CREATE TABLE IF NOT EXISTS inventory (
    id VARCHAR(50) PRIMARY KEY,
    part_id VARCHAR(50) NOT NULL,
    warehouse_name VARCHAR(100) DEFAULT 'Central Spares WH-01',
    bin_location VARCHAR(50) NOT NULL,
    quantity_on_hand INT NOT NULL DEFAULT 0,
    reserved_quantity INT NOT NULL DEFAULT 0,
    available_to_promise INT GENERATED ALWAYS AS (quantity_on_hand - reserved_quantity) STORED,
    FOREIGN KEY (part_id) REFERENCES spare_parts(id) ON DELETE CASCADE
);

-- 4. SUPPLIERS & PROCUREMENT
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

CREATE TABLE IF NOT EXISTS part_suppliers (
    id VARCHAR(50) PRIMARY KEY,
    part_id VARCHAR(50) NOT NULL,
    supplier_id VARCHAR(50) NOT NULL,
    supplier_part_number VARCHAR(100),
    unit_price DECIMAL(10, 2) NOT NULL,
    lead_time_days INT NOT NULL DEFAULT 2,
    is_preferred BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (part_id) REFERENCES spare_parts(id) ON DELETE CASCADE,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
);

-- 5. INCIDENTS & WORK ORDERS
CREATE TABLE IF NOT EXISTS incidents (
    id VARCHAR(50) PRIMARY KEY, -- INC-xxxx
    machine_id VARCHAR(50) NOT NULL,
    alert_type VARCHAR(100) NOT NULL,
    severity ENUM('CRITICAL', 'HIGH', 'MEDIUM', 'LOW') NOT NULL,
    status ENUM('DETECTED', 'DIAGNOSING', 'ASSIGNED', 'INSPECTING', 'PART_CHECK', 'PROCUREMENT', 'READY_FOR_REPAIR', 'REPAIRING', 'VERIFYING', 'RESOLVED', 'CLOSED') NOT NULL DEFAULT 'DETECTED',
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    ai_diagnosis_summary TEXT,
    ai_root_cause VARCHAR(255),
    ai_confidence DECIMAL(4, 3), -- e.g. 0.942
    ai_recommended_actions JSON,
    required_part_id VARCHAR(50),
    FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE,
    FOREIGN KEY (required_part_id) REFERENCES spare_parts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS work_orders (
    id VARCHAR(50) PRIMARY KEY, -- WO-xxxx
    incident_id VARCHAR(50) NOT NULL,
    machine_id VARCHAR(50) NOT NULL,
    technician_id VARCHAR(50),
    priority ENUM('CRITICAL', 'HIGH', 'MEDIUM', 'LOW') NOT NULL DEFAULT 'HIGH',
    status ENUM('DRAFT', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_PARTS', 'VERIFYING', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    loto_required BOOLEAN DEFAULT TRUE,
    loto_applied BOOLEAN DEFAULT FALSE,
    loto_verified_by VARCHAR(100),
    notes TEXT,
    assigned_at TIMESTAMP NULL,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE,
    FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE CASCADE,
    FOREIGN KEY (technician_id) REFERENCES technicians(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS part_reservations (
    id VARCHAR(50) PRIMARY KEY,
    work_order_id VARCHAR(50) NOT NULL,
    part_id VARCHAR(50) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    status ENUM('RESERVED', 'CONSUMED', 'RELEASED') DEFAULT 'RESERVED',
    reserved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (part_id) REFERENCES spare_parts(id) ON DELETE CASCADE
);

-- 6. POLICIES & AUTONOMOUS PROCUREMENT
CREATE TABLE IF NOT EXISTS policies (
    id VARCHAR(50) PRIMARY KEY, -- POL-xx
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    rule_type ENUM('PROCUREMENT_AUTO_PO', 'AI_CONFIDENCE_THRESHOLD', 'DUPLICATE_ORDER_GUARD', 'SPEND_LIMIT_GUARD') NOT NULL,
    rule_condition JSON NOT NULL,
    action ENUM('ALLOW', 'BLOCK', 'REQUIRE_HUMAN_REVIEW') NOT NULL,
    max_spend_limit DECIMAL(10, 2) DEFAULT 1000.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_orders (
    id VARCHAR(50) PRIMARY KEY, -- PO-xxxx
    incident_id VARCHAR(50),
    work_order_id VARCHAR(50),
    part_id VARCHAR(50) NOT NULL,
    supplier_id VARCHAR(50) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    status ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    approval_type ENUM('AUTONOMOUS_POLICY', 'HUMAN_APPROVED', 'SYSTEM_HOLD') NOT NULL DEFAULT 'AUTONOMOUS_POLICY',
    policy_id_applied VARCHAR(50),
    created_by VARCHAR(50) DEFAULT 'AI_PROCUREMENT_AGENT',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP NULL,
    received_at TIMESTAMP NULL,
    FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE SET NULL,
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE SET NULL,
    FOREIGN KEY (part_id) REFERENCES spare_parts(id) ON DELETE CASCADE,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
    FOREIGN KEY (policy_id_applied) REFERENCES policies(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS human_review_items (
    id VARCHAR(50) PRIMARY KEY, -- REV-xxxx
    item_type ENUM('PURCHASE_ORDER_APPROVAL', 'LOW_CONFIDENCE_DIAGNOSIS', 'UNEXPECTED_VERIFICATION_FAILURE', 'POLICY_EXCEPTION') NOT NULL,
    reference_id VARCHAR(50) NOT NULL,
    title VARCHAR(150) NOT NULL,
    reason TEXT NOT NULL,
    required_role VARCHAR(50) DEFAULT 'Plant Maintenance Manager',
    status ENUM('PENDING', 'APPROVED', 'REJECTED', 'MODIFIED') DEFAULT 'PENDING',
    reviewer_notes TEXT,
    reviewed_by VARCHAR(100),
    reviewed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. AUDIT & OUTBOX EVENTS
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(50) PRIMARY KEY,
    actor VARCHAR(100) NOT NULL, -- 'SYSTEM', 'AI_DIAGNOSIS_AGENT', 'AI_PROCUREMENT_AGENT', 'TECH_ARUN', 'MANAGER_DAVID'
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(50) NOT NULL,
    previous_state JSON,
    new_state JSON,
    reason TEXT,
    correlation_id VARCHAR(100) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS outbox_events (
    id VARCHAR(50) PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    aggregate_id VARCHAR(50) NOT NULL,
    payload JSON NOT NULL,
    status ENUM('PENDING', 'PROCESSED', 'FAILED') DEFAULT 'PENDING',
    retry_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- SEED INITIAL MASTER DATA
-- ==========================================

-- Machines
INSERT INTO machines (id, name, code, type, area, status, health_score, criticality, pos_x, pos_y, pos_z) VALUES
('MCH-CNC-01', 'High-Precision 5-Axis Milling Center', 'CNC-01', 'CNC', 'Machining Cell Alpha', 'RUNNING', 98, 'CRITICAL', -6.0, 0.0, -3.0),
('MCH-CNC-02', 'Heavy Duty Lathe & Turning Cell', 'CNC-02', 'CNC', 'Machining Cell Alpha', 'RUNNING', 95, 'HIGH', 0.0, 0.0, -3.0),
('MCH-ROBOT-01', 'Articulated 6-Axis Pick & Place Robot', 'ROBOT-01', 'ROBOT', 'Assembly Cell Beta', 'RUNNING', 99, 'HIGH', 6.0, 0.0, -3.0),
('MCH-PUMP-01', 'High-Pressure Hydraulic Coolant Pump', 'PUMP-01', 'PUMP', 'Utilities Cell Gamma', 'RUNNING', 92, 'MEDIUM', -4.0, 0.0, 4.0),
('MCH-MIXER-01', 'High-Shear Lubricant & Chemical Mixer', 'MIXER-01', 'MIXER', 'Fluid Prep Cell Delta', 'WARNING', 78, 'HIGH', 4.0, 0.0, 4.0)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Components
INSERT INTO machine_components (id, machine_id, name, component_type, criticality) VALUES
('CMP-CNC01-SPINDLE', 'MCH-CNC-01', 'Main High-Speed Spindle', 'SPINDLE', 'CRITICAL'),
('CMP-CNC01-BEARING', 'MCH-CNC-01', 'Spindle Front Angular Contact Bearing', 'BEARING', 'CRITICAL'),
('CMP-CNC02-MOTOR', 'MCH-CNC-02', 'Primary Drive Motor', 'MOTOR', 'HIGH'),
('CMP-ROB01-SERVO', 'MCH-ROBOT-01', 'Axis 3 Harmonic Drive Servo', 'SERVO', 'HIGH'),
('CMP-PMP01-IMPELLER', 'MCH-PUMP-01', 'Hydraulic Impeller & Seal', 'IMPELLER', 'MEDIUM'),
('CMP-MIX01-GEARBOX', 'MCH-MIXER-01', 'Planetary Agitator Gearbox', 'GEARBOX', 'HIGH')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Sensor Thresholds
INSERT INTO sensor_thresholds (id, machine_id, sensor_type, unit, warning_min, warning_max, fault_min, fault_max) VALUES
('THR-CNC01-TEMP', 'MCH-CNC-01', 'temperature', '°C', NULL, 70.0, NULL, 80.0),
('THR-CNC01-VIB', 'MCH-CNC-01', 'vibration', 'mm/s', NULL, 5.0, NULL, 7.5),
('THR-CNC01-CURR', 'MCH-CNC-01', 'current', 'A', NULL, 16.0, NULL, 20.0),
('THR-CNC01-RPM', 'MCH-CNC-01', 'rpm', 'RPM', 2200.0, 3200.0, 1800.0, 3500.0),

('THR-CNC02-TEMP', 'MCH-CNC-02', 'temperature', '°C', NULL, 72.0, NULL, 85.0),
('THR-CNC02-VIB', 'MCH-CNC-02', 'vibration', 'mm/s', NULL, 5.5, NULL, 8.0),
('THR-CNC02-CURR', 'MCH-CNC-02', 'current', 'A', NULL, 18.0, NULL, 22.0),

('THR-ROB01-TEMP', 'MCH-ROBOT-01', 'temperature', '°C', NULL, 65.0, NULL, 78.0),
('THR-ROB01-VIB', 'MCH-ROBOT-01', 'vibration', 'mm/s', NULL, 4.0, NULL, 6.0),

('THR-PMP01-TEMP', 'MCH-PUMP-01', 'temperature', '°C', NULL, 68.0, NULL, 82.0),
('THR-PMP01-PRES', 'MCH-PUMP-01', 'pressure', 'bar', 4.0, 8.0, 2.5, 10.0),

('THR-MIX01-TEMP', 'MCH-MIXER-01', 'temperature', '°C', NULL, 75.0, NULL, 88.0),
('THR-MIX01-VIB', 'MCH-MIXER-01', 'vibration', 'mm/s', NULL, 5.0, NULL, 7.0)
ON DUPLICATE KEY UPDATE warning_max=VALUES(warning_max);

-- Technicians
INSERT INTO technicians (id, name, email, phone, role, skills, assigned_area, status) VALUES
('TECH-001', 'Arun Kumar', 'arun.kumar@plantops.internal', '+1-555-0192', 'Senior Vibration & Mechanical Specialist', '["VIBRATION_ANALYSIS", "BEARING_REPLACEMENT", "SPINDLE_CALIBRATION", "LOTO_LEAD"]', 'Machining Cell Alpha', 'AVAILABLE'),
('TECH-002', 'Sarah Jenkins', 'sarah.jenkins@plantops.internal', '+1-555-0193', 'Automation & Robotics Lead', '["ROBOTICS_KINEMATICS", "SERVO_TUNING", "PLC_PROGRAMMING"]', 'Assembly Cell Beta', 'AVAILABLE'),
('TECH-003', 'Carlos Gomez', 'carlos.gomez@plantops.internal', '+1-555-0194', 'Fluids & Hydraulics Specialist', '["HYDRAULICS", "PUMP_OVERHAUL", "SEAL_REPLACEMENT"]', 'Utilities Cell Gamma', 'AVAILABLE')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Spare Parts
INSERT INTO spare_parts (id, part_number, name, category, unit_cost, min_reorder_point, lead_time_days) VALUES
('PART-SKF-6205', 'SKF-6205-2RSH', 'Spindle Angular Contact Deep Groove Ball Bearing', 'Mechanical / Bearings', 145.00, 2, 1),
('PART-FAG-7210', 'FAG-7210-B-TVP', 'High Precision Spindle Support Bearing', 'Mechanical / Bearings', 320.00, 1, 2),
('PART-SRV-MTR-01', 'FANUC-A06B-0223', 'AC Servo Motor Alpha iF 4/4000', 'Electrical / Motors', 890.00, 1, 3),
('PART-HYD-SEAL-01', 'PARKER-V884-75', 'Fluorocarbon High-Temp Hydraulic Seal Kit', 'Hydraulics / Seals', 65.00, 4, 1),
('PART-GBX-OIL-01', 'MOBIL-SHC-630', 'Synthetic Heavy Industrial Gear Lubricant (20L)', 'Fluids & Lubes', 185.00, 3, 1)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Inventory (SKF-6205 starts with 0 or 1 to demonstrate ATP stockout and Auto-PO)
INSERT INTO inventory (id, part_id, warehouse_name, bin_location, quantity_on_hand, reserved_quantity) VALUES
('INV-001', 'PART-SKF-6205', 'Central Spares WH-01', 'BIN-A-12-04', 0, 0), -- Stockout to demonstrate auto-PO flow!
('INV-002', 'PART-FAG-7210', 'Central Spares WH-01', 'BIN-A-12-05', 2, 0),
('INV-003', 'PART-SRV-MTR-01', 'Central Spares WH-01', 'BIN-E-03-01', 1, 0),
('INV-004', 'PART-HYD-SEAL-01', 'Central Spares WH-01', 'BIN-B-08-02', 6, 0),
('INV-005', 'PART-GBX-OIL-01', 'Central Spares WH-01', 'BIN-D-01-09', 4, 0)
ON DUPLICATE KEY UPDATE bin_location=VALUES(bin_location);

-- Suppliers
INSERT INTO suppliers (id, name, code, contact_email, rating, status, lead_time_days, payment_terms) VALUES
('SUP-SKF-DIRECT', 'SKF Precision Industrial Logistics', 'SKF-DIR', 'orders@skf-industrial.com', 4.95, 'PREFERRED', 1, 'Net 30'),
('SUP-MOTION-IND', 'Motion Industries Fast Supply', 'MOTION-IND', 'fastship@motionind.com', 4.80, 'ACTIVE', 2, 'Net 45'),
('SUP-FASTENAL', 'Fastenal Industrial Spares MRO', 'FASTENAL', 'plantops@fastenal.com', 4.70, 'ACTIVE', 1, 'Net 30'),
('SUP-GLOBAL-BEARINGS', 'Global Bearings Overseas (Unvetted)', 'GLB-UNVET', 'sales@unvetted-parts.com', 3.10, 'RESTRICTED', 7, 'Prepay')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Part Supplier Pricing Map
INSERT INTO part_suppliers (id, part_id, supplier_id, supplier_part_number, unit_price, lead_time_days, is_preferred) VALUES
('PS-001', 'PART-SKF-6205', 'SUP-SKF-DIRECT', 'SKF-6205-OEM-EXP', 145.00, 1, TRUE),
('PS-002', 'PART-SKF-6205', 'SUP-FASTENAL', 'FST-BRG-6205', 158.00, 1, FALSE),
('PS-003', 'PART-FAG-7210', 'SUP-MOTION-IND', 'MOT-FAG-7210B', 320.00, 2, TRUE),
('PS-004', 'PART-SRV-MTR-01', 'SUP-MOTION-IND', 'MOT-FANUC-A06B', 890.00, 3, TRUE),
('PS-005', 'PART-HYD-SEAL-01', 'SUP-FASTENAL', 'FST-SEAL-V884', 65.00, 1, TRUE)
ON DUPLICATE KEY UPDATE unit_price=VALUES(unit_price);

-- Policy Rules Engine Definitions
INSERT INTO policies (id, code, name, description, rule_type, rule_condition, action, max_spend_limit, is_active) VALUES
('POL-01', 'POL-AUTO-PO-EXPEDITE', 'Autonomous Emergency PO for Critical Machine Spares', 'Allows automated creation and release of POs when machine is in FAULT/CRITICAL state, AI confidence >= 85%, supplier is PREFERRED/ACTIVE, and total amount <= $1,000.', 'PROCUREMENT_AUTO_PO', '{"max_spend": 1000, "min_ai_confidence": 0.85, "require_preferred_supplier": true, "criticality_required": ["CRITICAL", "HIGH"]}', 'ALLOW', 1000.00, TRUE),
('POL-02', 'POL-SPEND-CAP-GUARD', 'High Value Purchase Escalation to Plant Manager', 'Forces Human Review for any PO where total amount exceeds autonomous threshold $1,000.00 or supplier is not preferred.', 'SPEND_LIMIT_GUARD', '{"spend_threshold": 1000.00}', 'REQUIRE_HUMAN_REVIEW', 1000.00, TRUE),
('POL-03', 'POL-DUP-PO-GUARD', 'Anti-Loop Duplicate PO Suppressor', 'Prevents automatic re-ordering if a pending/sent PO for the same incident or part was generated in the last 60 minutes.', 'DUPLICATE_ORDER_GUARD', '{"cooldown_minutes": 60}', 'BLOCK', 0.00, TRUE)
ON DUPLICATE KEY UPDATE name=VALUES(name);
