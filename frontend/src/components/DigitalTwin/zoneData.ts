import { Machine } from '../../types';

// ─────────────────────────────────────────────────────────────────────────────
// Shared zone <-> machine mapping (single source of truth for both the 3D
// scene and the page-level navigation/UI, so nothing duplicates this grouping)
// ─────────────────────────────────────────────────────────────────────────────
export type ZoneId =
  | 'MACHINING'
  | 'ROBOT'
  | 'PROCESSING'
  | 'ASSEMBLY'
  | 'PACKAGING'
  | 'MAINTENANCE';

export const ZONE_MACHINE_CODES: Record<ZoneId, string[]> = {
  MACHINING: ['CNC-01', 'CNC-02', 'CNC-03', 'CNC-04', 'CNC-05', 'CNC-06'],
  ROBOT: ['ROBOT-01', 'ROBOT-02', 'ROBOT-03', 'ROBOT-04'],
  PROCESSING: ['MIXER-01', 'PUMP-01', 'PRESS-01', 'PROCESS-01', 'PROCESS-02'],
  ASSEMBLY: ['ASMB-01', 'ASMB-02', 'ASMB-03', 'ASMB-04'],
  PACKAGING: ['PACK-01', 'PACK-02', 'PACK-03'],
  MAINTENANCE: ['BENCH-01', 'BENCH-02', 'TEST-01'],
};

const CODE_TO_ZONE: Record<string, ZoneId> = Object.entries(ZONE_MACHINE_CODES).reduce(
  (acc, [zoneId, codes]) => {
    codes.forEach((code) => { acc[code] = zoneId as ZoneId; });
    return acc;
  },
  {} as Record<string, ZoneId>
);

export function zoneIdForMachineCode(code: string): ZoneId | null {
  return CODE_TO_ZONE[code] || null;
}

export interface ZoneStatusCounts {
  running: number;
  warning: number;
  fault: number;
  maintenance: number;
  verifying: number;
  offline: number;
}

export function getZoneStatusCounts(zoneId: ZoneId, machines: Machine[]): ZoneStatusCounts {
  const codes = ZONE_MACHINE_CODES[zoneId] || [];
  const counts: ZoneStatusCounts = { running: 0, warning: 0, fault: 0, maintenance: 0, verifying: 0, offline: 0 };
  codes.forEach((code) => {
    const m = machines.find((mm) => mm.code === code);
    const status = m?.status || 'RUNNING';
    if (status === 'RUNNING') counts.running++;
    else if (status === 'WARNING') counts.warning++;
    else if (status === 'FAULT') counts.fault++;
    else if (status === 'MAINTENANCE' || status === 'WAITING_PARTS') counts.maintenance++;
    else if (status === 'VERIFYING') counts.verifying++;
    else counts.offline++;
  });
  return counts;
}
