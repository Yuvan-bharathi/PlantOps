import { query } from '../db/mysql.js';

export interface MachineContext {
  id: string;
  code: string;
  name: string;
  type: string;
  area: string;
  criticality: string;
}

export interface CandidateEvaluation {
  technicianId: string;
  technicianName: string;
  role: string;
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  availability: string;
  activeWorkOrders: number;
  rationale: string;
}

export interface OrchestrationResult {
  assignedTechnicianId: string;
  assignedTechnicianName: string;
  assignedTechnicianRole: string;
  matchConfidence: number;
  requiredSkills: string[];
  orchestrationSummary: string;
  candidateEvaluations: CandidateEvaluation[];
  recommendedInspectionPoints: string[];
  oshaProtocolRequired: boolean;
}

// Machine Competencies Matrix
export const REQUIRED_SKILLS_MAP: Record<string, string[]> = {
  CNC:        ['CNC_MILLING', 'MECHANICAL_VIBRATION', 'SPINDLE_SYSTEMS', 'PRECISION_ALIGNMENT', 'VIBRATION_ANALYSIS', 'BEARING_REPLACEMENT'],
  ROBOT:      ['ROBOTICS_KINEMATICS', 'SERVO_DRIVES', 'ELECTRICAL_MOTION', 'ROBOTICS_FANUC', 'PLC_SIEMENS', 'SAFETY_CIRCUITS'],
  PUMP:       ['HYDRAULIC_CIRCUITS', 'SEAL_REPLACEMENT', 'FLUID_POWER', 'PRESSURE_TESTING', 'VALVE_CALIBRATION'],
  MIXER:      ['GEARBOX_MAINTENANCE', 'LUBRICATION_SYSTEMS', 'MECHANICAL_SEALS', 'FLUID_POWER'],
  PROCESSING: ['GEARBOX_MAINTENANCE', 'LUBRICATION_SYSTEMS', 'MECHANICAL_SEALS', 'HYDRAULIC_CIRCUITS', 'PRESSURE_TESTING'],
  PRESS:      ['HYDRAULIC_PRESSES', 'VALVE_MANIFOLDS', 'PRESSURE_SYSTEMS', 'DIAGNOSTICS'],
  ASSEMBLY:   ['MATERIAL_HANDLING', 'ROLLER_BEARINGS', 'MOTOR_DRIVES', 'TORQUE_SYSTEMS', 'PRECISION_ALIGNMENT'],
  CONVEYOR:   ['MATERIAL_HANDLING', 'ROLLER_BEARINGS', 'MOTOR_DRIVES', 'BELT_TRACKING'],
  PACKAGING:  ['PNEUMATICS', 'PACKAGING_AUTOMATION', 'SEALERS', 'OPTICAL_INSPECTION', 'VACUUM_SYSTEMS'],
  MAINTENANCE:['ROOT_CAUSE_ANALYSIS', 'DIAGNOSTICS', 'HYDRAULIC_PRESSES', 'OSHA_1910_COMPLIANCE'],
};

export const RECOMMENDED_INSPECTION_POINTS: Record<string, string[]> = {
  CNC: [
    'Check spindle shaft radial and axial runout with dial test indicator (<0.003mm)',
    'Inspect spindle front/rear bearing raceways for fluting, scoring, and cage fatigue',
    'Verify drawbar clamping force and HSK/CAT taper contact pattern',
    'Listen for abnormal harmonic chatter during low-RPM free-spin test'
  ],
  ROBOT: [
    'Inspect Axis 3 harmonic drive gear teeth for backlash and wave-generator wear',
    'Check servo motor thermal coupling and optical encoder feedback cables',
    'Verify mechanical brake holding torque in e-stop isolation'
  ],
  PUMP: [
    'Inspect mechanical seal elastomer pack for cavitation erosion and bypass leaks',
    'Measure impeller clearance and suction strainer debris buildup',
    'Verify delivery pressure relief valve calibration at 6.0 bar'
  ],
  MIXER: [
    'Inspect planetary gearbox oil level, color, and magnetic drain plug for metal shavings',
    'Measure gear backlash and inspect drive pinion teeth for scoring',
    'Check shaft lip seals for synthetic lubricant weeping'
  ],
  PROCESSING: [
    'Inspect fluid circuit proportioning valves and high-torque mixer gearbox',
    'Check mechanical seal face runout and thermal dissipation jackets',
    'Verify emergency shutoff pressure relief valve calibration'
  ],
  PRESS: [
    'Inspect main ram hydraulic cylinder packing and spool valve seating',
    'Verify hydraulic proportional relief valve response and pressure buildup',
    'Check mechanical die guide gib clearances'
  ],
  ASSEMBLY: [
    'Inspect multi-spindle automatic screwdriving torque sensors and calibration',
    'Check linear transfer conveyor roller bearings and belt tension',
    'Verify safety light curtains and pneumatic pick-and-place actuators'
  ],
  CONVEYOR: [
    'Inspect drive roller pillow block bearings for thermal friction and grease dry-out',
    'Check belt tracking alignment and multi-ribbed belt tension',
    'Verify geared motor current draw under loaded run'
  ],
  PACKAGING: [
    'Check pneumatic manifold pressure regulator and solenoid air leaks',
    'Inspect palletizer gripper vacuum cups and seal integrity',
    'Verify heating element temperature on rotary film sealer'
  ],
  MAINTENANCE: [
    'Inspect diagnostic calibration equipment and secondary isolation locks',
    'Check hydraulic test stand flowmeter calibration and zero-energy safety valves'
  ]
};

/**
 * AI Maintenance Orchestrator:
 * Core Principle: "IoT detects. AI orchestrates. Human inspects & repairs."
 * Evaluates machine context & required competencies against the active technicians roster,
 * balancing certified skills, cell proximity, shift availability, and workload.
 */
export async function runAIMaintenanceOrchestration(
  machine: MachineContext,
  telemetryAlert: { alertType: string; symptom: string }
): Promise<OrchestrationResult> {
  const machineType = (machine.type || 'CNC').toUpperCase();
  const requiredSkills = REQUIRED_SKILLS_MAP[machineType] || REQUIRED_SKILLS_MAP.CNC;
  const inspectionPoints = RECOMMENDED_INSPECTION_POINTS[machineType] || RECOMMENDED_INSPECTION_POINTS.CNC;

  // 1. Fetch all technicians from database
  let technicians: any[] = [];
  try {
    technicians = await query<any>(`SELECT * FROM technicians ORDER BY id ASC`);
  } catch (err) {
    console.warn(`[AIOrchestrator] Failed to fetch technicians from DB:`, err);
  }

  // Fallback technician pool across all 6 cells
  if (!technicians || technicians.length === 0) {
    technicians = [
      { id: 'TECH-01', name: 'Arun Kumar', email: 'arun.kumar@plantops.internal', role: 'Lead Vibration & Spindle Specialist', assigned_area: 'Machining Cell', status: 'AVAILABLE', shift: 'Morning (06:00-14:00)', skills: JSON.stringify(['CNC_MILLING', 'MECHANICAL_VIBRATION', 'SPINDLE_SYSTEMS', 'PRECISION_ALIGNMENT', 'VIBRATION_ANALYSIS', 'BEARING_REPLACEMENT', 'OSHA_LOTO']), active_work_orders: 0 },
      { id: 'TECH-02', name: 'Dev Patel', email: 'dev.patel@plantops.internal', role: 'High-Speed CNC Tooling Specialist', assigned_area: 'Machining Cell', status: 'AVAILABLE', shift: 'Morning (06:00-14:00)', skills: JSON.stringify(['CNC_MILLING', 'SPINDLE_SYSTEMS', 'PRECISION_ALIGNMENT', 'OSHA_LOTO']), active_work_orders: 0 },
      { id: 'TECH-03', name: 'Priya Sharma', email: 'priya.sharma@plantops.internal', role: 'Senior Automation & Robotics Engineer', assigned_area: 'Robot Cell', status: 'AVAILABLE', shift: 'Morning (06:00-14:00)', skills: JSON.stringify(['ROBOTICS_KINEMATICS', 'SERVO_DRIVES', 'ELECTRICAL_MOTION', 'ROBOTICS_FANUC', 'PLC_SIEMENS', 'SAFETY_CIRCUITS', 'OSHA_LOTO']), active_work_orders: 0 },
      { id: 'TECH-04', name: 'Lisa Wong', email: 'lisa.wong@plantops.internal', role: 'Mechatronics & Robotics Specialist', assigned_area: 'Robot Cell', status: 'AVAILABLE', shift: 'Morning (06:00-14:00)', skills: JSON.stringify(['ROBOTICS_KINEMATICS', 'SERVO_DRIVES', 'SAFETY_CIRCUITS', 'OSHA_LOTO']), active_work_orders: 0 },
      { id: 'TECH-05', name: 'Rajesh Nair', email: 'rajesh.nair@plantops.internal', role: 'Hydraulic Systems & Fluid Specialist', assigned_area: 'Processing Cell', status: 'AVAILABLE', shift: 'Morning (06:00-14:00)', skills: JSON.stringify(['HYDRAULIC_CIRCUITS', 'SEAL_REPLACEMENT', 'FLUID_POWER', 'PRESSURE_TESTING', 'VALVE_CALIBRATION', 'OSHA_LOTO']), active_work_orders: 0 },
      { id: 'TECH-06', name: 'Carlos Gomez', email: 'carlos.gomez@plantops.internal', role: 'Chemical Process & Planetary Tech', assigned_area: 'Processing Cell', status: 'AVAILABLE', shift: 'Morning (06:00-14:00)', skills: JSON.stringify(['GEARBOX_MAINTENANCE', 'LUBRICATION_SYSTEMS', 'MECHANICAL_SEALS', 'FLUID_POWER', 'OSHA_LOTO']), active_work_orders: 0 },
      { id: 'TECH-07', name: 'Nina Cole', email: 'nina.cole@plantops.internal', role: 'Precision Assembly Line Specialist', assigned_area: 'Assembly Cell', status: 'AVAILABLE', shift: 'Morning (06:00-14:00)', skills: JSON.stringify(['MATERIAL_HANDLING', 'ROLLER_BEARINGS', 'MOTOR_DRIVES', 'TORQUE_SYSTEMS', 'PRECISION_ALIGNMENT', 'OSHA_LOTO']), active_work_orders: 0 },
      { id: 'TECH-08', name: 'Ben Harris', email: 'ben.harris@plantops.internal', role: 'Assembly Automation & Drives Tech', assigned_area: 'Assembly Cell', status: 'AVAILABLE', shift: 'Morning (06:00-14:00)', skills: JSON.stringify(['MATERIAL_HANDLING', 'ROLLER_BEARINGS', 'MOTOR_DRIVES', 'BELT_TRACKING', 'OSHA_LOTO']), active_work_orders: 0 },
      { id: 'TECH-09', name: 'Tom Wilson', email: 'tom.wilson@plantops.internal', role: 'Packaging Automation Specialist', assigned_area: 'Packaging Cell', status: 'AVAILABLE', shift: 'Morning (06:00-14:00)', skills: JSON.stringify(['PNEUMATICS', 'PACKAGING_AUTOMATION', 'SEALERS', 'VACUUM_SYSTEMS', 'OSHA_LOTO']), active_work_orders: 0 },
      { id: 'TECH-10', name: 'Amy Chen', email: 'amy.chen@plantops.internal', role: 'Cartoner & Vision Systems Tech', assigned_area: 'Packaging Cell', status: 'AVAILABLE', shift: 'Morning (06:00-14:00)', skills: JSON.stringify(['PNEUMATICS', 'PACKAGING_AUTOMATION', 'SEALERS', 'OPTICAL_INSPECTION', 'OSHA_LOTO']), active_work_orders: 0 },
      { id: 'TECH-11', name: 'Frank Moore', email: 'frank.moore@plantops.internal', role: 'Plant Maintenance Specialist', assigned_area: 'Maintenance Bay', status: 'AVAILABLE', shift: 'General (08:00-17:00)', skills: JSON.stringify(['HYDRAULIC_PRESSES', 'VALVE_MANIFOLDS', 'PRESSURE_SYSTEMS', 'ROOT_CAUSE_ANALYSIS', 'DIAGNOSTICS', 'OSHA_1910_COMPLIANCE', 'OSHA_LOTO']), active_work_orders: 0 },
      { id: 'TECH-12', name: 'Tina Ross', email: 'tina.ross@plantops.internal', role: 'Industrial Electrical & Controls Engineer', assigned_area: 'Maintenance Bay', status: 'AVAILABLE', shift: 'General (08:00-17:00)', skills: JSON.stringify(['ELECTRICAL_MOTION', 'PLC_SIEMENS', 'SAFETY_CIRCUITS', 'DIAGNOSTICS', 'HYDRAULIC_PRESSES', 'OSHA_LOTO']), active_work_orders: 0 }
    ];
  }

  // Normalize machine area for cell proximity matching
  const machineAreaNormalized = (machine.area || '').toLowerCase();

  // 2. Score each candidate
  const candidates: CandidateEvaluation[] = technicians.map((tech) => {
    let techSkills: string[] = [];
    try {
      techSkills = typeof tech.skills === 'string' ? JSON.parse(tech.skills) : (tech.skills || []);
    } catch {
      techSkills = [];
    }

    const matchedSkills = requiredSkills.filter((s) => techSkills.includes(s));
    const missingSkills = requiredSkills.filter((s) => !techSkills.includes(s));

    // Base Skill Match (0 - 45 points)
    const skillScore = requiredSkills.length > 0 ? (matchedSkills.length / requiredSkills.length) * 45 : 20;

    // Area / Cell Proximity Match (0 or 20 points)
    const techArea = (tech.assigned_area || '').toLowerCase();
    const areaMatch = (
      (techArea.includes('machin') && (machineAreaNormalized.includes('machin') || machineType === 'CNC')) ||
      (techArea.includes('robot') && (machineAreaNormalized.includes('robot') || machineType === 'ROBOT')) ||
      (techArea.includes('process') && (machineAreaNormalized.includes('process') || machineType === 'PUMP' || machineType === 'MIXER' || machineType === 'PROCESSING')) ||
      (techArea.includes('assembly') && (machineAreaNormalized.includes('assembly') || machineType === 'ASSEMBLY' || machineType === 'CONVEYOR')) ||
      (techArea.includes('packag') && (machineAreaNormalized.includes('packag') || machineType === 'PACKAGING')) ||
      (techArea.includes('maint') && (machineAreaNormalized.includes('maint') || machineType === 'PRESS' || machineType === 'MAINTENANCE'))
    );
    const areaScore = areaMatch ? 20 : 0;

    // Availability Score (0 - 25 points, BUSY has heavy penalty of -40)
    let availScore = 0;
    const st = (tech.status || 'AVAILABLE').toUpperCase();
    if (st === 'AVAILABLE') availScore = 25;
    else if (st === 'ON_DUTY') availScore = 20;
    else if (st === 'BUSY') availScore = -40; // Heavy penalty: do NOT double-assign busy tech when others are free
    else availScore = 0;

    // Workload Balance Score (0 - 10 points)
    const activeJobs = tech.active_work_orders || 0;
    const workloadScore = Math.max(-20, 10 - activeJobs * 15);

    const totalRaw = skillScore + areaScore + availScore + workloadScore;
    const clampedScore = Math.max(5, Math.min(99, Math.round(totalRaw)));
    const matchScore = clampedScore / 100;

    let rationale = '';
    if (st === 'BUSY' || activeJobs > 0) {
      rationale = `Technician currently BUSY (${activeJobs} active ticket). Deprioritized to prevent bottleneck.`;
    } else if (areaMatch && matchedSkills.length > 0) {
      rationale = `Optimal match: Primary technician for ${tech.assigned_area} with ${matchedSkills.length} certified skills (${matchedSkills.slice(0, 2).join(', ')}). Available on site.`;
    } else if (matchedSkills.length > 0) {
      rationale = `Qualified candidate: Cross-trained with ${matchedSkills.length} matching skills (${matchedSkills.join(', ')}). Currently available.`;
    } else {
      rationale = `General technician: Lacks specialized ${machineType} certifications (${missingSkills.slice(0, 2).join(', ')}).`;
    }

    return {
      technicianId: tech.id,
      technicianName: tech.name,
      role: tech.role || 'Maintenance Technician',
      matchScore,
      matchedSkills,
      missingSkills,
      availability: st,
      activeWorkOrders: activeJobs,
      rationale
    };
  });

  // 3. Sort candidates by score descending
  candidates.sort((a, b) => b.matchScore - a.matchScore);
  const bestCandidate = candidates[0];

  const summary = `AI Maintenance Orchestrator analyzed ${candidates.length} active technicians. Dispatched ${bestCandidate.technicianName} (${bestCandidate.role}) with ${(bestCandidate.matchScore * 100).toFixed(0)}% suitability for ${machine.code} (${machine.name}). Mandatory OSHA 1910.147 LOTO issued.`;

  return {
    assignedTechnicianId: bestCandidate.technicianId,
    assignedTechnicianName: bestCandidate.technicianName,
    assignedTechnicianRole: bestCandidate.role,
    matchConfidence: bestCandidate.matchScore,
    requiredSkills,
    orchestrationSummary: summary,
    candidateEvaluations: candidates,
    recommendedInspectionPoints: inspectionPoints,
    oshaProtocolRequired: true,
  };
}
