export interface SOPDocument {
  id: string;
  machineType: string;
  subsystem: string;
  title: string;
  code: string;
  revision: string;
  sections: {
    heading: string;
    content: string;
    specs?: Record<string, string>;
  }[];
}

export const PLANT_SOPS: SOPDocument[] = [
  {
    id: 'SOP-MCH-001',
    machineType: 'CNC',
    subsystem: 'Spindle & Bearings',
    title: 'CNC 5-Axis High-Speed Spindle Bearing Replacement & Runout Calibration',
    code: 'SOP-CNC-SPINDLE-REV4',
    revision: '4.2 (ISO 1940 Compliance)',
    sections: [
      {
        heading: '1. Safety & Lockout / Tagout (LOTO)',
        content: 'Verify 480V 3-phase master disconnect is isolated with certified padlock. Discharge residual capacitor banks in spindle drive controller. Ensure pneumatic pressure drop to 0.0 bar.',
        specs: { 'LOTO Standard': 'OSHA 1910.147', 'Voltage Zero-Energy': '< 3.0 VAC' }
      },
      {
        heading: '2. Cartridge Extraction & Inspection',
        content: 'Unbolt front labyrinth seal cap using 6mm hex key. Carefully draw spindle shaft using hydraulic puller. Inspect inner raceway for micro-spalling or electrical discharge fluting.',
        specs: { 'Bearing Part': 'SKF-6205-2RSH', 'Radial Runout Limit': '< 0.003 mm' }
      },
      {
        heading: '3. Bearing Installation & Torque Specs',
        content: 'Heat new SKF-6205-2RSH angular contact bearing with induction heater to 110°C (do not exceed 120°C). Slide bearing firmly against shaft shoulder. Fasten retaining locknut using calibrated torque wrench to 65 Nm.',
        specs: { 'Induction Temp': '110°C', 'Locknut Torque': '65 Nm ± 2 Nm', 'Grease Type': 'Klüber Isoflex NBU 15' }
      },
      {
        heading: '4. Post-Repair Verification Spin Test',
        content: 'Energize spindle. Run stepped warm-up sequence: 1000 RPM (5 min), 3000 RPM (5 min), 6000 RPM (5 min). Monitor bearing temperature (< 60°C) and vibration baseline (< 2.2 mm/s RMS).',
        specs: { 'Target Vibration': '< 2.5 mm/s', 'Max Temp': '65°C' }
      }
    ]
  },
  {
    id: 'SOP-PMP-002',
    machineType: 'PUMP',
    subsystem: 'Mechanical Seals & Impeller',
    title: 'High-Pressure Centrifugal Slurry Pump Seal Overhaul & Cavitation Remediation',
    code: 'SOP-PUMP-SEAL-REV3',
    revision: '3.1 (API 682 Compliance)',
    sections: [
      {
        heading: '1. Isolation & Fluid Depressurization',
        content: 'Close suction and discharge isolation valves. Lockout main pump starter switch (LOTO). Open casing drain valve to purge pressurized chemical media into containment trough.',
        specs: { 'Depressurization Target': '0.0 bar', 'Fluid Wash': 'Demineralized Water Flush' }
      },
      {
        heading: '2. Cartridge Mechanical Seal Replacement',
        content: 'Loosen seal gland bolts in cross-star pattern. Remove failed silicon carbide face seal. Inspect shaft sleeve for fretting corrosion. Install replacement Cartridge Seal Kit (SEAL-PUMP-SLURRY-01) with fresh Viton O-rings.',
        specs: { 'Part Number': 'SEAL-PUMP-01', 'Gland Bolt Torque': '35 Nm', 'O-Ring Material': 'FKM / Viton-A' }
      },
      {
        heading: '3. Impeller Clearance & Alignment',
        content: 'Adjust impeller-to-front-casing clearance using micrometer shims to 0.50 mm. Verify laser alignment with drive motor within 0.05 mm angular tolerance.',
        specs: { 'Impeller Clearance': '0.50 mm ± 0.05 mm', 'Shaft Runout': '< 0.04 mm' }
      }
    ]
  },
  {
    id: 'SOP-ROB-003',
    machineType: 'ROBOT',
    subsystem: '6-Axis Articulated Joints',
    title: 'Industrial 6-Axis Robot Joint Overload, Lubrication & Pneumatic Gripper Calibration',
    code: 'SOP-ROB-ARTIC-REV5',
    revision: '5.0 (ISO 10218 Safety)',
    sections: [
      {
        heading: '1. Mechanical Axis LOTO & Brake Check',
        content: 'Place robot in J1-J6 zero calibration home pose. Engage mechanical axis transport lock pins. Apply LOTO padlock on main robot controller cabinet.',
        specs: { 'Safety Standard': 'ISO 10218-1', 'Lockout Point': 'Cabinet Main Isolator' }
      },
      {
        heading: '2. Harmonic Drive Grease Replacement',
        content: 'Drain degraded grease from Axis 3/4 reduction gearboxes. Inject Kyodo Yushi Harmonic Grease SK-1A using pneumatic dispenser until purge port shows clean lubricant without metallic debris.',
        specs: { 'Grease Spec': 'Kyodo Yushi SK-1A', 'Charge Volume': '450 ml / Joint' }
      },
      {
        heading: '3. End-Effector Pneumatics & Pressure Calibration',
        content: 'Inspect vacuum suction cups and pneumatic clamping pistons. Replace worn seals with ACT-PNEUMATIC-ROB kit. Set operating line pressure regulator to 6.2 bar.',
        specs: { 'Line Pressure': '6.0 - 6.5 bar', 'Leak Rate': '< 0.02 bar / min' }
      }
    ]
  },
  {
    id: 'SOP-PRS-004',
    machineType: 'PRESS',
    subsystem: 'Hydraulic High-Pressure Cell',
    title: 'Heavy Hydraulic Stamping Press Proportional Valve Service & Pressure Relief Overhaul',
    code: 'SOP-HYD-PRESS-REV2',
    revision: '2.4 (DIN 24340 Compliance)',
    sections: [
      {
        heading: '1. High Pressure Accumulator Discharge',
        content: 'Isolate main 45 kW hydraulic power unit. Open manual bleed-down valve to release stored accumulator pressure (250 bar to 0 bar). Mechanically chock main press ram.',
        specs: { 'Accumulator Residual Pressure': '0.0 bar', 'Safety Chock': 'Certified Hardened Steel Block' }
      },
      {
        heading: '2. Proportional Solenoid Valve Replacement',
        content: 'Disconnect DIN 43650 valve connector. Unbolt valve manifold. Clean subplate mounting face. Mount replacement High-Response Proportional Valve (VALVE-HYD-PROP-01) with clean NBR seals.',
        specs: { 'Part Number': 'VALVE-HYD-PROP-01', 'Bolt Torque': '28 Nm', 'Filtration Spec': '3-micron Beta-200' }
      }
    ]
  }
];
