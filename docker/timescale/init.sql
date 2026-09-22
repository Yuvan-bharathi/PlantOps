-- PlantOps TimescaleDB / PostgreSQL Telemetry Schema

CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

CREATE TABLE IF NOT EXISTS telemetry_logs (
    time TIMESTAMPTZ NOT NULL,
    machine_id VARCHAR(50) NOT NULL,
    temperature DOUBLE PRECISION,
    vibration DOUBLE PRECISION,
    current DOUBLE PRECISION,
    rpm DOUBLE PRECISION,
    pressure DOUBLE PRECISION
);

-- Convert to hypertable partitioned by time (TimescaleDB)
SELECT create_hypertable('telemetry_logs', 'time', if_not_exists => TRUE);

-- Create index for fast machine query
CREATE INDEX IF NOT EXISTS idx_telemetry_machine_time ON telemetry_logs (machine_id, time DESC);
