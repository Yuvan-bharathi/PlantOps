export type MachineStatus = 'RUNNING' | 'WARNING' | 'FAULT' | 'WAITING_PARTS' | 'MAINTENANCE' | 'VERIFYING' | 'OFFLINE';

export interface Machine {
  id: string;
  name: string;
  code: string;
  type: 'CNC' | 'ROBOT' | 'PUMP' | 'MIXER' | 'CONVEYOR' | 'PRESS' | 'PROCESSING' | 'ASSEMBLY' | 'PACKAGING' | 'MAINTENANCE';
  area: string;
  status: MachineStatus;
  health_score: number;
  criticality: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  pos_x: number;
  pos_y: number;
  pos_z: number;
  components?: Array<{ id: string; name: string; type: string; criticality: string }>;
  telemetry?: TelemetryData;
  /** Server-authoritative runtime/downtime tracking — set only by the backend
   * lifecycle state machine, never computed client-side. */
  last_running_started_at?: string | null;
  total_runtime_seconds?: number;
  downtime_started_at?: string | null;
}

export type TechnicianPhase =
  | 'ASSIGNING' | 'ASSIGNED' | 'EN_ROUTE' | 'ARRIVED' | 'LOTO' | 'INSPECTING'
  | 'WAITING_PARTS' | 'REPAIRING' | 'VERIFYING' | 'COMPLETED' | 'RETURNING' | 'AVAILABLE';

export interface TelemetryData {
  machineId: string;
  timestamp: string;
  temperature: number;
  vibration: number;
  current: number;
  rpm: number;
  pressure: number;
}

export interface AIDiagnosis {
  rootCause: string;
  confidence: number;
  summary: string;
  recommendedPartId: string;
  recommendedPartNumber: string;
  recommendedPartName: string;
  estimatedLaborHours: number;
  procedureSteps: string[];
  severity: string;
}

export interface Incident {
  id: string;
  machine_id: string;
  machine_name?: string;
  machine_code?: string;
  alert_type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: string;
  detected_at: string;
  resolved_at?: string;
  ai_diagnosis_summary?: string;
  ai_root_cause?: string;
  ai_confidence?: number;
  ai_recommended_actions?: string[];
  required_part_id?: string;
  part_number?: string;
  part_name?: string;
  // Event sourcing / downtime fields (added by incident-events migration)
  scenario_id?: string;
  downtime_seconds?: number | null;
  assignment_started_at?: string;
  assigned_at?: string;
  technician_dispatched_at?: string;
  technician_arrived_at?: string;
  loto_started_at?: string;
  loto_completed_at?: string;
  inspection_started_at?: string;
  inspection_completed_at?: string;
  repair_started_at?: string;
  repair_completed_at?: string;
  verification_started_at?: string;
  verification_completed_at?: string;
  machine_running_at?: string;
}

export interface WorkOrder {
  id: string;
  incident_id: string;
  machine_id: string;
  machine_name?: string;
  machine_code?: string;
  technician_id?: string;
  technician_name?: string;
  technician_role?: string;
  /** Backend-authoritative technician lifecycle phase for this work order —
   * independent of machine.status (see TechnicianPhase). */
  technician_phase?: TechnicianPhase | string;
  priority: string;
  status: string;
  loto_required: boolean;
  loto_applied: boolean;
  loto_verified_by?: string;
  notes?: string;
  created_at: string;
}

export interface SparePartInventory {
  id: string;
  part_number: string;
  name: string;
  category: string;
  unit_cost: string;
  warehouse_name: string;
  bin_location: string;
  quantity_on_hand: number;
  reserved_quantity: number;
  available_to_promise: number;
  safety_stock?: number;
  min_reorder_point?: number;
  lead_time_days?: number;
  supplier_name?: string;
}

export interface PurchaseOrder {
  id: string;
  incident_id?: string;
  work_order_id?: string;
  part_id: string;
  part_number?: string;
  part_name?: string;
  supplier_id: string;
  supplier_name?: string;
  supplier_rating?: number;
  quantity: number;
  unit_price: string;
  total_amount: string;
  status: string;
  approval_type: string;
  policy_id_applied?: string;
  created_by: string;
  created_at: string;
  approved_at?: string;
  received_at?: string;
}

export interface HumanReviewItem {
  id: string;
  item_type: string;
  reference_id: string;
  title: string;
  reason: string;
  required_role: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'MODIFIED';
  reviewer_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  total_amount?: string;
  quantity?: number;
  part_number?: string;
  part_name?: string;
  supplier_name?: string;
  created_at: string;
}

export interface Policy {
  id: string;
  code: string;
  name: string;
  description: string;
  rule_type: string;
  rule_condition: any;
  action: string;
  max_spend_limit: string;
  is_active: boolean;
}

export interface DomoKPIs {
  oee: number;
  availability: number;
  mttr_minutes: number;
  mtbf_hours: number;
  autonomous_po_rate: number;
  total_parts_spend_usd: number;
  active_faults: number;
  closed_loop_resolutions: number;
}

export interface PlantPowerState {
  status: 'ON' | 'OFF' | 'STARTING' | 'ESTOP';
  voltage: number;
  current_amps: number;
  frequency_hz: number;
  active_alarm: boolean;
  alarm_acknowledged: boolean;
  main_mcc_status: 'HEALTHY' | 'WARNING' | 'TRIPPED';
  total_load_kw: number;
  last_energized_at: string | null;
  last_deenergized_at: string | null;
}

export interface MachinePowerBreaker {
  machine_id: string;
  machine_code: string;
  machine_name: string;
  cell_name: string;
  breaker_status: 'CLOSED' | 'OPEN' | 'TRIPPED' | 'LOTO_LOCKED';
  voltage: number;
  current_amps: number;
  frequency_hz: number;
  target_rate_per_hour: number;
  cycle_time_seconds: number;
  power_status: 'ON' | 'OFF';
  runtime_status: 'RUNNING' | 'FAULT' | 'MAINTENANCE' | 'VERIFYING' | 'IDLE' | 'OFF';
  actual_pieces: number;
  target_pieces: number;
  missed_pieces: number;
}

export interface MachineDailySummary {
  id: string;
  machine_id: string;
  machine_code: string;
  machine_name: string;
  cell_name: string;
  date: string;
  power_on_seconds: number;
  runtime_seconds: number;
  idle_seconds: number;
  downtime_seconds: number;
  target_pieces: number;
  actual_pieces: number;
  good_pieces: number;
  scrap_pieces: number;
  missed_pieces: number;
  fault_count: number;
  warning_count: number;
  availability_pct: number;
  status: string;
  assigned_technician?: string;
  first_power_on_at?: string;
  last_power_off_at?: string;
  rate_per_hour?: number;
  timeline_segments?: MachineTimelineSegment[];
}

// Where a day's history comes from: live power ledger (today), recorded ledger (past),
// persisted daily summary rows, or simulated demo history for days before recording began.
export type DailyDataSource = 'LIVE' | 'RECORDED' | 'DB_SUMMARY' | 'SIMULATED';

export interface MachineDayEvent {
  time: string;
  timestamp: string;
  type: string;
  category: 'POWER' | 'PRODUCTION' | 'IOT' | 'AI' | 'TECHNICIAN' | 'INVENTORY' | 'RECOVERY';
  title: string;
  description: string;
  status: 'OPTIMAL' | 'WARN' | 'CRITICAL' | 'COMPLETED' | 'IN_PROGRESS' | 'INFO';
  actor?: string;
  metadata?: Record<string, any>;
}

export interface MachineTimelineSegment {
  startTime: string;
  endTime: string;
  startHour: number;
  endHour: number;
  status: 'RUNNING' | 'WARNING' | 'FAULT' | 'ESTOP' | 'MAINTENANCE' | 'VERIFYING' | 'IDLE' | 'OFF' | 'NO_DATA';
  label: string;
}

export interface MonthlyCalendarDay {
  day: number;
  date: string;
  machinesRunning: number;
  faultsCount: number;
  repairsCount: number;
  productionPieces: number;
  missedPieces: number;
  availabilityPct: number;
  source?: DailyDataSource | 'FUTURE';
}

