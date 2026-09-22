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
const REQUIRED_SKILLS_MAP: Record<string, string[]> = {
  CNC:       ['CNC_MILLING', 'MECHANICAL_VIBRATION', 'SPINDLE_SYSTEMS', 'PRECISION_ALIGNMENT'],
  ROBOT:     ['ROBOTICS_KINEMATICS', 'SERVO_DRIVES', 'ELECTRICAL_MOTION', 'OSHA_LOTO'],
  PUMP:      ['HYDRAULIC_CIRCUITS', 'SEAL_REPLACEMENT', 'FLUID_POWER'],
  MIXER:     ['GEARBOX_MAINTENANCE', 'LUBRICATION_SYSTEMS', 'MECHANICAL_SEALS'],
  PRESS:     ['HYDRAULIC_PRESSES', 'VALVE_MANIFOLDS', 'PRESSURE_SYSTEMS'],
  CONVEYOR:  ['MATERIAL_HANDLING', 'ROLLER_BEARINGS', 'MOTOR_DRIVES'],
  PACKAGING: ['PNEUMATICS', 'PACKAGING_AUTOMATION', 'SEALERS'],
};

const RECOMMENDED_INSPECTION_POINTS: Record<string, string[]> = {
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
  PRESS: [
    'Inspect main ram hydraulic cylinder packing and spool valve seating',
    'Verify hydraulic proportional relief valve response and pressure buildup',
    'Check mechanical die guide gib clearances'
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
  ]
};

/**
 * AI Maintenance Orchestrator:
 * Core Principle: "IoT detects. AI orchestrates. Human inspects & repairs."
 * Evaluates machine context & required competencies against the active technicians roster,
 * balancing certified skills, shift availability, and workload.
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

  // Fallback technician pool if DB is empty
  if (!technicians || technicians.length === 0) {
    technicians = [
      { id: 'TECH-001', name: 'Arun Kumar', role: 'Lead Vibration & Spindle Specialist', status: 'AVAILABLE', skills: '["CNC_MILLING","MECHANICAL_VIBRATION","SPINDLE_SYSTEMS","OSHA_LOTO"]', active_work_orders: 0 },
      { id: 'TECH-002', name: 'John Miller', role: 'CNC Operator & Mechanical Tech', status: 'AVAILABLE', skills: '["CNC_MILLING","PRECISION_ALIGNMENT","MATERIAL_HANDLING"]', active_work_orders: 1 },
      { id: 'TECH-003', name: 'Wei Zhang', role: 'Senior Machinist', status: 'AVAILABLE', skills: '["CNC_MILLING","CNC_TURNING"]', active_work_orders: 0 },
      { id: 'TECH-004', name: 'Sarah Jenkins', role: 'Robotics & Automation Lead', status: 'AVAILABLE', skills: '["ROBOTICS_KINEMATICS","SERVO_DRIVES","ELECTRICAL_MOTION","OSHA_LOTO"]', active_work_orders: 0 },
      { id: 'TECH-005', name: 'Carlos Gomez', role: 'Fluids & Hydraulics Specialist', status: 'AVAILABLE', skills: '["HYDRAULIC_CIRCUITS","SEAL_REPLACEMENT","FLUID_POWER","OSHA_LOTO"]', active_work_orders: 0 },
    ];
  }

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

    // Base Skill Match (0 - 60 points)
    const skillScore = requiredSkills.length > 0 ? (matchedSkills.length / requiredSkills.length) * 60 : 40;

    // Availability Score (0 - 25 points)
    let availScore = 0;
    const st = (tech.status || 'AVAILABLE').toUpperCase();
    if (st === 'AVAILABLE') availScore = 25;
    else if (st === 'ON_DUTY') availScore = 20;
    else availScore = 5;

    // Workload Balance Score (0 - 15 points)
    const activeJobs = tech.active_work_orders || 0;
    const workloadScore = Math.max(0, 15 - activeJobs * 5);

    const totalScore = Math.min(99, Math.round(skillScore + availScore + workloadScore));
    const matchScore = totalScore / 100;

    let rationale = '';
    if (matchedSkills.length === requiredSkills.length && activeJobs === 0) {
      rationale = `Optimal match: 100% certified competency match for ${machineType} with zero active queue dispatches.`;
    } else if (matchedSkills.length > 0) {
      rationale = `Qualified candidate: Matches ${matchedSkills.join(', ')}. Current queue: ${activeJobs} active job(s).`;
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
