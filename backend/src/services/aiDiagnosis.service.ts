export interface TelemetrySnapshot {
  machineId: string;
  temperature: number;
  vibration: number;
  current: number;
  rpm: number;
  pressure: number;
}

export interface AIDiagnosisResult {
  rootCause: string;
  confidence: number;
  summary: string;
  recommendedPartId: string;
  recommendedPartNumber: string;
  recommendedPartName: string;
  estimatedLaborHours: number;
  procedureSteps: string[];
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

import { generateLLMDiagnosis } from './llm.service.js';

export async function runAIDiagnosis(machineCode: string, telemetry: TelemetrySnapshot, context?: { alertType?: string; scenarioId?: string; machineName?: string; area?: string }): Promise<AIDiagnosisResult> {
  const code = (machineCode || '').toUpperCase();

  // 0. Attempt Dynamic LLM Diagnosis (Gemini / OpenAI) if configured
  const llmResult = await generateLLMDiagnosis({
    machineCode: code,
    machineName: context?.machineName,
    area: context?.area,
    telemetry,
    alertType: context?.alertType,
    scenarioId: context?.scenarioId
  });

  if (llmResult) {
    return llmResult;
  }

  // 1. CNC-01 (5-Axis Milling Center)
  if (code.includes('CNC-01') || code.includes('CNC01')) {
    return {
      rootCause: 'Spindle Front Angular Contact Bearing Fluting & Cage Micro-Spalling',
      confidence: 0.948,
      summary: `Spectral vibration peak at ${telemetry.vibration} mm/s RMS accompanied by elevated thermal dissipation (${telemetry.temperature}°C) indicates catastrophic cage fatigue on spindle front bearing.`,
      recommendedPartId: 'PART-SKF-6205',
      recommendedPartNumber: 'SKF-6205-2RSH',
      recommendedPartName: 'Spindle Angular Contact Deep Groove Ball Bearing',
      estimatedLaborHours: 1.5,
      procedureSteps: [
        'Execute Lockout/Tagout (LOTO) on Cell Alpha Master 480V Disconnect.',
        'Decouple main spindle cartridge and extract damaged SKF bearing.',
        'Inspect spindle shaft taper for radial runout (< 0.003mm).',
        'Press-fit replacement SKF-6205-2RSH with calibrated induction heater.',
        'Torque bearing retaining nut to 65 Nm and verify smooth manual rotation.',
        'Release LOTO and initiate automated post-repair verification spin test.'
      ],
      severity: 'CRITICAL'
    };
  }

  // 2. CNC-02 (Heavy Duty Lathe)
  if (code.includes('CNC-02') || code.includes('CNC02')) {
    return {
      rootCause: 'Primary Drive Motor Mechanical Clearance Misalignment & Pulley Wear',
      confidence: 0.915,
      summary: `Harmonic drive vibration (${telemetry.vibration} mm/s) and current imbalance (${telemetry.current} A) indicate radial clearance degradation in turning spindle drive motor.`,
      recommendedPartId: 'PART-FAG-7210',
      recommendedPartNumber: 'FAG-7210-B-TVP',
      recommendedPartName: 'High Precision Spindle Support Bearing',
      estimatedLaborHours: 2.0,
      procedureSteps: [
        'Apply LOTO on CNC-02 main power distribution bus.',
        'Remove belt guard and check multi-ribbed drive belt tension.',
        'Replace FAG-7210 bearing assembly on main drive shaft.',
        'Perform dual-axis laser alignment on spindle motor coupling.',
        'Verify zero backlash and clear LOTO for verification run.'
      ],
      severity: 'HIGH'
    };
  }

  // 2b. CNC-03 (High-Speed Machining Center)
  if (code.includes('CNC-03') || code.includes('CNC03')) {
    return {
      rootCause: 'High-Speed Ceramic Spindle Dynamic Unbalance & Tool Holder Runout',
      confidence: 0.941,
      summary: `High-frequency harmonic vibration (${telemetry.vibration} mm/s) at ${telemetry.rpm} RPM with temperature rise (${telemetry.temperature}°C) indicates tool holder taper runout and spindle bearing unbalance.`,
      recommendedPartId: 'PART-SKF-6205',
      recommendedPartNumber: 'SKF-6205-2RSH',
      recommendedPartName: 'Spindle Angular Contact Deep Groove Ball Bearing',
      estimatedLaborHours: 1.5,
      procedureSteps: [
        'Apply LOTO on CNC-03 480V isolated feeder circuit.',
        'Inspect HSK-63 tool taper with dial test indicator for axial runout (< 2 µm).',
        'Replace high-speed spindle ceramic hybrid bearing assembly.',
        'Dynamic balance spindle cartridge to ISO 1940-1 G0.4 grade.',
        'Clear LOTO and execute automatic 3-cycle baseline verification.'
      ],
      severity: 'CRITICAL'
    };
  }

  // 3. MIXER-01 (Industrial Agitator Mixer)
  if (code.includes('MIXER-01') || code.includes('MIXER01')) {
    return {
      rootCause: 'Agitator Gearbox Severe Lubrication Starvation & Thermal Runaway',
      confidence: 0.932,
      summary: `Thermal spike at ${telemetry.temperature}°C with vibration harmonics at ${telemetry.vibration} mm/s indicates lubrication breakdown and pinion tooth scoring in heavy agitator drive.`,
      recommendedPartId: 'PART-GBX-OIL-01',
      recommendedPartNumber: 'MOBIL-SHC-630',
      recommendedPartName: 'Synthetic Heavy Industrial Gear Lubricant (20L)',
      estimatedLaborHours: 2.5,
      procedureSteps: [
        'Lockout agitator 3-phase motor breaker and isolate chemical feed valves.',
        'Drain degraded synthetic gearbox lubricant and inspect magnetic drain plug.',
        'Flush gearbox casing and refill with Mobil SHC 630 synthetic industrial gear oil.',
        'Check mechanical seal and inspect pinion drive teeth.',
        'Conduct 15-minute low-speed thermal run-in test.'
      ],
      severity: 'CRITICAL'
    };
  }

  // 4. PUMP-01 (Hydraulic Coolant Pump)
  if (code.includes('PUMP-01') || code.includes('PUMP01')) {
    return {
      rootCause: 'Hydraulic Seal Degradation & High-Pressure Impeller Cavitation',
      confidence: 0.894,
      summary: `Hydraulic pressure loss (${telemetry.pressure} bar) and casing vibration (${telemetry.vibration} mm/s) indicate seal breach and fluid turbulence in coolant delivery line.`,
      recommendedPartId: 'PART-HYD-SEAL-01',
      recommendedPartNumber: 'PARKER-V884-75',
      recommendedPartName: 'Fluorocarbon High-Temp Hydraulic Seal Kit',
      estimatedLaborHours: 1.0,
      procedureSteps: [
        'Depressurize hydraulic accumulator circuit to 0.0 bar and tag out pump breaker.',
        'Drain coolant reservoir fluid and decouple pump intake manifold.',
        'Replace Parker V884 fluorocarbon seal ring pack and O-rings.',
        'Re-torque housing bolts to 45 Nm in cross-pattern.',
        'Re-pressurize and verify delivery pressure stabilizes at 6.0 bar.'
      ],
      severity: 'HIGH'
    };
  }

  // 5. ROBOT-01 (6-Axis Articulated Robot)
  if (code.includes('ROBOT-01') || code.includes('ROBOT01')) {
    return {
      rootCause: 'Axis 3 Harmonic Drive Servo Thermal Surge & Current Overload',
      confidence: 0.925,
      summary: `Current surge at ${telemetry.current} A with elevated joint temperature (${telemetry.temperature}°C) indicates harmonic wave-generator bearing degradation on Axis 3.`,
      recommendedPartId: 'PART-SRV-MTR-01',
      recommendedPartNumber: 'FANUC-A06B-0223',
      recommendedPartName: 'AC Servo Motor Alpha iF 4/4000',
      estimatedLaborHours: 3.0,
      procedureSteps: [
        'Engage robot mechanical safety brakes and apply LOTO on controller cabinet.',
        'Support robot forearm with overhead safety sling.',
        'Decouple Axis 3 servo motor and inspect harmonic wave generator teeth.',
        'Install replacement Fanuc A06B-0223 servo motor with new optical encoder.',
        'Perform zero-position calibration master sequence in manual teach mode.'
      ],
      severity: 'CRITICAL'
    };
  }

  // Default fallback diagnosis
  return {
    rootCause: 'Mechanical Vibration Harmonic Anomaly',
    confidence: 0.865,
    summary: `Abnormal sensor harmonics detected on ${machineCode}. Temperature ${telemetry.temperature}°C, vibration ${telemetry.vibration} mm/s.`,
    recommendedPartId: 'PART-SKF-6205',
    recommendedPartNumber: 'SKF-6205-2RSH',
    recommendedPartName: 'Spindle Angular Contact Deep Groove Ball Bearing',
    estimatedLaborHours: 1.5,
    procedureSteps: [
      'Perform electrical and mechanical safety isolation (LOTO).',
      'Inspect mechanical drive train and replace worn components.',
      'Calibrate sensor baselines and run validation cycle.'
    ],
    severity: 'MEDIUM'
  };
}

