import { io } from 'socket.io-client';

const API_BASE = ((import.meta as any).env?.VITE_API_URL as string) || '/api';

const SOCKET_URL = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? window.location.origin
  : 'http://localhost:4000';

export const socket = io(SOCKET_URL, {
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000
});

export const api = {
  // Machines
  getMachines: () => fetch(`${API_BASE}/machines`).then(r => r.json()),
  getMachine: (codeOrId: string) => fetch(`${API_BASE}/machines/${codeOrId}`).then(r => r.json()),

  // Incidents
  getIncidents: (page?: number, limit?: number) => {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (limit) params.append('limit', limit.toString());
    const qs = params.toString();
    return fetch(`${API_BASE}/incidents${qs ? `?${qs}` : ''}`).then(r => r.json());
  },
  getIncidentEvents: (id: string) => fetch(`${API_BASE}/incidents/${id}/events`).then(r => r.json()),
  getIncidentDowntime: (id: string) => fetch(`${API_BASE}/incidents/${id}/downtime`).then(r => r.json()),

  // Work Orders
  getWorkOrders: (page?: number, limit?: number) => {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (limit) params.append('limit', limit.toString());
    const qs = params.toString();
    return fetch(`${API_BASE}/work-orders${qs ? `?${qs}` : ''}`).then(r => r.json());
  },
  getLotoProtocol: (id: string) => fetch(`${API_BASE}/work-orders/${id}/loto-protocol`).then(r => r.json()),
  markTechnicianArrived: (id: string, technicianName = 'Assigned Technician') =>
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
  reservePart: (data: { workOrderId: string; partId: string; quantity?: number }) =>
    fetch(`${API_BASE}/inventory/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json()),
  getReservations: () => fetch(`${API_BASE}/inventory/reservations`).then(r => r.json()),

  // Procurement
  getPurchaseOrders: () => fetch(`${API_BASE}/purchase-orders`).then(r => r.json()),
  receivePO: (id: string, receivedBy = 'Inventory Receiving Supervisor') =>
    fetch(`${API_BASE}/purchase-orders/${id}/receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receivedBy })
    }).then(r => r.json()),

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
  expediteSupplier: (id: string, notes?: string) =>
    fetch(`${API_BASE}/suppliers/${id}/expedite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes })
    }).then(r => r.json()),

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

  // Preventative Maintenance (TiDB Cloud)
  getPMSchedules: () => fetch(`${API_BASE}/pm-schedules`).then(r => r.json()),
  createPMSchedule: (data: any) =>
    fetch(`${API_BASE}/pm-schedules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json()),
  dispatchPMSchedule: (id: string) =>
    fetch(`${API_BASE}/pm-schedules/${id}/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }).then(r => r.json()),
  completePMSchedule: (id: string, checklist?: any[], notes?: string) =>
    fetch(`${API_BASE}/pm-schedules/${id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checklist, notes })
    }).then(r => r.json()),
  getTechnicianClusters: () => fetch(`${API_BASE}/technicians/clusters`).then(r => r.json()),
  updateTechnicianClusters: (techId: string, machineCodes: string[], supervisorName?: string) =>
    fetch(`${API_BASE}/technicians/${techId}/clusters`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ machineCodes, supervisorName })
    }).then(r => r.json()),

  // Intercom & Live Escalation Engine
  getIntercomMessages: (role?: string, channel?: string) => {
    const params = new URLSearchParams();
    if (role) params.append('role', role);
    if (channel) params.append('channel', channel);
    return fetch(`${API_BASE}/intercom/messages?${params.toString()}`).then(r => r.json());
  },
  sendIntercomMessage: (data: { senderRole: string; senderName: string; recipientRole?: string; channel?: string; priority?: string; title?: string; message: string; metadata?: any }) =>
    fetch(`${API_BASE}/intercom/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json()),
  escalateIssue: (data: { senderRole: string; senderName: string; targetRole?: string; type: string; title: string; details: string; metadata?: any }) =>
    fetch(`${API_BASE}/intercom/escalate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json()),
  resolveIntercomMessage: (id: string, resolvedBy: string, resolutionNote?: string) =>
    fetch(`${API_BASE}/intercom/resolve/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolvedBy, resolutionNote })
    }).then(r => r.json()),

  // Autonomous AI Agents
  triggerAITriage: (data: { machineCode?: string; symptom?: string; vibration?: number; temperature?: number; severity?: string }) =>
    fetch(`${API_BASE}/ai-agent/triage-dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json()),
  triggerReorderSpare: (data: { partId: string; quantity: number; requesterRole?: string; requesterName?: string; reason?: string }) =>
    fetch(`${API_BASE}/ai-agent/reorder-spare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json()),
  approvePOByManager: (poId: string, managerName = 'Priya Patel') =>
    fetch(`${API_BASE}/ai-agent/approve-po`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ poId, managerName })
    }).then(r => r.json()),
  dispatchAGVFleet: (data: { palletId?: string; totalPieces?: number; cartons?: number; destinationBay?: string }) =>
    fetch(`${API_BASE}/ai-agent/dispatch-agv`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json()),
  queryAICopilot: (prompt: string, senderRole?: string, senderName?: string) =>
    fetch(`${API_BASE}/ai-agent/copilot-query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, senderRole, senderName })
    }).then(r => r.json()),

  // Power Supply Cell & Electrical Controls
  getPowerStatus: () => fetch(`${API_BASE}/power/status`).then(r => r.json()),
  startPlantPower: () => fetch(`${API_BASE}/power/start`, { method: 'POST' }).then(r => r.json()),
  stopPlantPower: () => fetch(`${API_BASE}/power/stop`, { method: 'POST' }).then(r => r.json()),
  emergencyStopPlant: () => fetch(`${API_BASE}/power/estop`, { method: 'POST' }).then(r => r.json()),
  resetPowerAlarm: () => fetch(`${API_BASE}/power/reset`, { method: 'POST' }).then(r => r.json()),
  acknowledgePowerAlarm: () => fetch(`${API_BASE}/power/ack`, { method: 'POST' }).then(r => r.json()),
  toggleMachineBreaker: (machineCode: string, state?: string) =>
    fetch(`${API_BASE}/power/breaker/${machineCode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state })
    }).then(r => r.json()),

  // Machine Daily History & Operations Calendar
  // Dates are IST business days (YYYY-MM-DD); omitting them lets the server use its own "today"
  getDailyProduction: (date?: string) =>
    fetch(`${API_BASE}/production/daily${date ? `?date=${date}` : ''}`).then(r => r.json()),
  getMachineDayDetail: (machineCode: string, date?: string) =>
    fetch(`${API_BASE}/production/machine/${machineCode}/day${date ? `?date=${date}` : ''}`).then(r => r.json()),
  getMonthlyCalendar: (year?: number, month?: number) =>
    fetch(`${API_BASE}/production/calendar${year && month ? `?year=${year}&month=${month}` : ''}`).then(r => r.json()),
  toggleProductionStream: (isRunning?: boolean) =>
    fetch(`${API_BASE}/production/stream/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isRunning })
    }).then(r => r.json()),
  getProductionStreamStatus: () =>
    fetch(`${API_BASE}/production/stream/status`).then(r => r.json()),
  // Outbound freight & road fleet (TiDB fleet_trucks / fleet_dispatches)
  getFleetState: () => fetch(`${API_BASE}/fleet/state`).then(r => r.json()),
  getFleetDispatches: (params: { status?: string; truck?: string; limit?: number } = {}) =>
    fetch(`${API_BASE}/fleet/dispatches?${new URLSearchParams(Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])).toString()}`).then(r => r.json()),
  dispatchFleet: (data: { truckId?: string; all?: boolean } = {}) =>
    fetch(`${API_BASE}/fleet/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json()),
  allocatePallet: () => fetch(`${API_BASE}/logistics/pallets/allocate`, { method: 'POST' }).then(r => r.json()),
  getLogisticsPallets: (params?: { limit?: number; offset?: number; status?: string; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    if (params?.status) q.set('status', params.status);
    if (params?.search) q.set('search', params.search);
    return fetch(`${API_BASE}/logistics/pallets?${q.toString()}`).then(r => r.json());
  },
  dispatchPalletMission: (data: any) =>
    fetch(`${API_BASE}/logistics/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json()),
  updatePalletStatus: (id: string, status: string) =>
    fetch(`${API_BASE}/logistics/pallets/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    }).then(r => r.json()),

  // Simulator Control API
  injectFault: (machineId = 'CNC-01', faultType = 'BEARING_WEAR', intensity = 1.0, scenarioId?: string) =>
    fetch(`${API_BASE}/simulator/inject-fault`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ machineId, faultType, intensity, scenarioId })
    }).then(r => r.json()),

  healMachine: (machineId = 'CNC-01') =>
    fetch(`${API_BASE}/simulator/heal-machine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ machineId })
    }).then(r => r.json()),

  // CNC Batch Tooling Optimizer
  getCncToolingStatus: () => fetch(`${API_BASE}/operations/cnc/tooling-status`).then(r => r.json()),
  executeBatchToolSwap: (data: { machineCodes: string[]; windowType?: string; assignedTechName?: string; autoCalibrate?: boolean; notes?: string }) =>
    fetch(`${API_BASE}/operations/cnc/batch-tool-swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json())
};
