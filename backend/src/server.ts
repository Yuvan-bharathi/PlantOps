import express from 'express';
import http from 'http';
import cors from 'cors';
import { config } from './config/index.js';
import { testMySqlConnection } from './db/mysql.js';
import { testTimescaleConnection } from './db/timescale.js';
import { initSocketIO } from './services/socket.service.js';
import { initTelemetryService } from './services/telemetry.service.js';
import apiRouter from './routes/api.routes.js';

const app = express();
const server = http.createServer(app);

// Middlewares
app.use(cors({ origin: '*' }));
app.use(express.json());

// Socket.IO
initSocketIO(server);

// Routes
app.use('/api', apiRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'PlantOps Modular Monolith Backend',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

// Start Server
async function start() {
  console.log('========================================================');
  console.log('  PLANTOPS: AI Predictive Maintenance & Autonomous Ops  ');
  console.log('========================================================');

  // Test DB connections
  await testMySqlConnection();
  await testTimescaleConnection();

  // Start MQTT Telemetry Ingestion
  initTelemetryService();

  server.listen(config.port, () => {
    console.log(`[Server] PlantOps backend listening on port ${config.port} (http://localhost:${config.port})`);
    console.log(`[Server] REST API endpoints available at http://localhost:${config.port}/api`);
    console.log(`[Server] Socket.IO realtime server initialized.`);
  });
}

start().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
});
