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
}

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
