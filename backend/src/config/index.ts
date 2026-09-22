import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database configs (TiDB / MySQL)
  mysql: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3307', 10),
    user: process.env.MYSQL_USER || 'plantops',
    password: process.env.MYSQL_PASSWORD || 'plantopspassword',
    database: process.env.MYSQL_DATABASE || 'plantops_db',
    ssl: process.env.MYSQL_SSL === 'true' ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined,
    connectionLimit: 15
  },

  // TimescaleDB / Postgres for high-frequency telemetry
  timescale: {
    host: process.env.TIMESCALE_HOST || 'localhost',
    port: parseInt(process.env.TIMESCALE_PORT || '5432', 10),
    user: process.env.TIMESCALE_USER || 'plantops',
    password: process.env.TIMESCALE_PASSWORD || 'plantopspassword',
    database: process.env.TIMESCALE_DATABASE || 'plantops_telemetry',
    ssl: process.env.TIMESCALE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    max: 15
  },

  // Redis for caching and locks
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10)
  },

  // MQTT Broker
  mqtt: {
    brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
    clientId: process.env.MQTT_CLIENT_ID || 'plantops-backend',
    telemetryTopic: process.env.MQTT_TELEMETRY_TOPIC || 'plantops/machines/+/telemetry'
  }
};
