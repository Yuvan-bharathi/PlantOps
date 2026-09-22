-- ============================================================
-- PLANTOPS: Failure Library + Event Sourcing Migration
-- Run once against the MySQL plantops DB
-- Safe to re-run: uses IF NOT EXISTS / IF EXISTS guards
-- ============================================================

-- ── 1. incident_events table ─────────────────────────────────
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

-- ── 2. Phase timestamps on incidents ─────────────────────────
-- Idempotent: each ADD COLUMN is guarded by IF NOT EXISTS via procedure
DROP PROCEDURE IF EXISTS plantops_add_column;
DELIMITER $$
CREATE PROCEDURE plantops_add_column(
  IN tbl   VARCHAR(64),
  IN col   VARCHAR(64),
  IN defn  VARCHAR(256)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = tbl
      AND COLUMN_NAME  = col
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN `', col, '` ', defn);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$
DELIMITER ;

CALL plantops_add_column('incidents', 'scenario_id',               'VARCHAR(30) NULL');
CALL plantops_add_column('incidents', 'assignment_started_at',     'DATETIME(3) NULL');
CALL plantops_add_column('incidents', 'assigned_at',               'DATETIME(3) NULL');
CALL plantops_add_column('incidents', 'technician_dispatched_at',  'DATETIME(3) NULL');
CALL plantops_add_column('incidents', 'technician_arrived_at',     'DATETIME(3) NULL');
CALL plantops_add_column('incidents', 'loto_started_at',           'DATETIME(3) NULL');
CALL plantops_add_column('incidents', 'loto_completed_at',         'DATETIME(3) NULL');
CALL plantops_add_column('incidents', 'inspection_started_at',     'DATETIME(3) NULL');
CALL plantops_add_column('incidents', 'inspection_completed_at',   'DATETIME(3) NULL');
CALL plantops_add_column('incidents', 'repair_started_at',         'DATETIME(3) NULL');
CALL plantops_add_column('incidents', 'repair_completed_at',       'DATETIME(3) NULL');
CALL plantops_add_column('incidents', 'verification_started_at',   'DATETIME(3) NULL');
CALL plantops_add_column('incidents', 'verification_completed_at', 'DATETIME(3) NULL');
CALL plantops_add_column('incidents', 'machine_running_at',        'DATETIME(3) NULL');
CALL plantops_add_column('incidents', 'downtime_seconds',          'FLOAT NULL');

DROP PROCEDURE IF EXISTS plantops_add_column;
