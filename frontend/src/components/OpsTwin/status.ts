// One status language for the 3D scene, chips, inspector and queue (mirrors the reference:
// green = productive, amber = attention, red = fault, blue = moving / service, grey = idle).

export interface StatusStyle {
  label: string;
  color: string; // solid (beacons, dots)
  bg: string; // pill background
  text: string; // pill text
}

export const MACHINE_STATUS: Record<string, StatusStyle> = {
  RUNNING: { label: 'Running', color: '#16A34A', bg: '#DCFCE7', text: '#15803D' },
  WARNING: { label: 'Warning', color: '#F59E0B', bg: '#FEF3C7', text: '#B45309' },
  FAULT: { label: 'Fault', color: '#DC2626', bg: '#FEE2E2', text: '#B91C1C' },
  MAINTENANCE: { label: 'Maintenance', color: '#2563EB', bg: '#DBEAFE', text: '#1D4ED8' },
  WAITING_PARTS: { label: 'Waiting parts', color: '#F59E0B', bg: '#FEF3C7', text: '#B45309' },
  VERIFYING: { label: 'Verifying', color: '#7C3AED', bg: '#EDE9FE', text: '#6D28D9' },
  IDLE: { label: 'Idle', color: '#94A3B8', bg: '#F1F5F9', text: '#475569' },
  OFF: { label: 'Off', color: '#94A3B8', bg: '#F1F5F9', text: '#475569' },
  OFFLINE: { label: 'Offline', color: '#94A3B8', bg: '#F1F5F9', text: '#475569' },
};

export const statusOf = (s?: string): StatusStyle => MACHINE_STATUS[String(s || '').toUpperCase()] || MACHINE_STATUS.OFFLINE;

export const TECH_PHASE_LABEL: Record<string, string> = {
  ASSIGNING: 'Assigning',
  ASSIGNED: 'Assigned',
  EN_ROUTE: 'En route',
  ARRIVED: 'On site',
  LOTO: 'Applying LOTO',
  INSPECTING: 'Inspecting',
  WAITING_PARTS: 'Waiting parts',
  REPAIRING: 'Repairing',
  VERIFYING: 'Verifying',
  COMPLETED: 'Completed',
  RETURNING: 'Returning',
  AVAILABLE: 'Available',
};

/** Where the technician is drawn for a work-order phase. */
export function techPlacement(phase?: string): 'walking-in' | 'at-machine' | 'walking-out' | null {
  const p = String(phase || '').toUpperCase();
  if (p === 'ASSIGNED' || p === 'EN_ROUTE') return 'walking-in';
  if (['ARRIVED', 'LOTO', 'INSPECTING', 'WAITING_PARTS', 'REPAIRING', 'VERIFYING'].includes(p)) return 'at-machine';
  if (p === 'RETURNING') return 'walking-out';
  return null;
}

export const OPEN_WO = (status?: string) => !['COMPLETED', 'CLOSED', 'CANCELLED'].includes(String(status || '').toUpperCase());
export const OPEN_INCIDENT = (status?: string) => !['RESOLVED', 'CLOSED'].includes(String(status || '').toUpperCase());
