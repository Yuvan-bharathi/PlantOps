import { io } from 'socket.io-client';

const API_BASE = 'http://localhost:4000/api';
const SIMULATOR_BASE = 'http://localhost:4001/api/simulator';

export const socket = io('http://localhost:4000', {
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000
});

export const api = {
  // Machines
  getMachines: () => fetch(`${API_BASE}/machines`).then(r => r.json()),
  getMachine: (codeOrId: string) => fetch(`${API_BASE}/machines/${codeOrId}`).then(r => r.json()),

  // Incidents
  getIncidents: () => fetch(`${API_BASE}/incidents`).then(r => r.json()),

  // Work Orders
  getWorkOrders: () => fetch(`${API_BASE}/work-orders`).then(r => r.json()),
  getLotoProtocol: (id: string) => fetch(`${API_BASE}/work-orders/${id}/loto-protocol`).then(r => r.json()),
  markTechnicianArrived: (id: string, technicianName = 'Arun Kumar (Lead Tech)') =>
    fetch(`${API_BASE}/work-orders/${id}/arrive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ technicianName })
    }).then(r => r.json()),
  applyLOTO: (
    id: string,
    verifiedBy: string,
    details?: {
      padlockId?: string;
      voltageReading?: number;
      pressureReading?: number;
      isolationPointsConfirmed?: string[];
    }
  ) =>
    fetch(`${API_BASE}/work-orders/${id}/loto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verifiedBy, ...details })
    }).then(r => r.json()),
  submitInspection: (id: string, data: { technicianName: string; symptomsObserved: string[]; technicianRootCause: string; requiredPartId: string; quantity?: number }) =>
    fetch(`${API_BASE}/work-orders/${id}/inspection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json()),
  completeRepair: (id: string, technicianName: string) =>
    fetch(`${API_BASE}/work-orders/${id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ technicianName })
    }).then(r => r.json()),

  // Inventory & ATP
  getInventory: () => fetch(`${API_BASE}/inventory`).then(r => r.json()),
  checkATP: (partIdOrNumber: string) => fetch(`${API_BASE}/inventory/atp/${partIdOrNumber}`).then(r => r.json()),

  // Procurement
  getPurchaseOrders: () => fetch(`${API_BASE}/purchase-orders`).then(r => r.json()),

  // Human Review
  getHumanReviewItems: () => fetch(`${API_BASE}/human-review`).then(r => r.json()),
  approveReviewItem: (id: string, reviewer: string, notes?: string) =>
    fetch(`${API_BASE}/human-review/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewer, notes })
    }).then(r => r.json()),

  // Policies, Reports & Audit
  getPolicies: () => fetch(`${API_BASE}/policies`).then(r => r.json()),
  getAuditLogs: () => fetch(`${API_BASE}/audit-logs`).then(r => r.json()),
  getReportsSummary: () => fetch(`${API_BASE}/reports/summary`).then(r => r.json()),

  // Domo Analytics
  getDomoSummary: () => fetch(`${API_BASE}/analytics/domo-summary`).then(r => r.json()),

  // Technicians & Roster
  getTechnicians: () => fetch(`${API_BASE}/technicians`).then(r => r.json()),

  // Suppliers & Directory
  getSuppliers: () => fetch(`${API_BASE}/suppliers`).then(r => r.json()),

  // IoT Devices & Gateways
  getIoTDevices: () => fetch(`${API_BASE}/iot-devices`).then(r => r.json()),

  // AI Diagnosis, SOPs & RAG Knowledge Base
  diagnoseSymptom: (machineCode: string, symptom: string) =>
    fetch(`${API_BASE}/ai/diagnose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ machineCode, symptom })
    }).then(r => r.json()),

  getSOPs: (machineType?: string) =>
    fetch(`${API_BASE}/knowledge/sops${machineType ? `?machineType=${machineType}` : ''}`).then(r => r.json()),

  searchSOPs: (query: string, machineType?: string) =>
    fetch(`${API_BASE}/knowledge/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, machineType })
    }).then(r => r.json()),

  askSOP: (question: string, machineType?: string) =>
    fetch(`${API_BASE}/knowledge/ask-sop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, machineType })
    }).then(r => r.json()),

  // Simulator Control API
  injectFault: (machineId = 'CNC-01', faultType = 'BEARING_WEAR', intensity = 1.0, scenarioId?: string) =>
    fetch(`${SIMULATOR_BASE}/inject-fault`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ machineId, faultType, intensity, scenarioId })
    }).then(r => r.json()),

  healMachine: (machineId = 'CNC-01') =>
    fetch(`${SIMULATOR_BASE}/heal-machine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ machineId })
    }).then(r => r.json())
};
