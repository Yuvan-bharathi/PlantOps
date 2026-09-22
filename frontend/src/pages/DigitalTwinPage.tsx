import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  Search, Layers, RefreshCw, RotateCcw,
  Box, LayoutGrid, Map, X, Activity, Bot, Wrench, Package,
  CheckCircle2, ClipboardList, ShieldCheck, Eye, Compass, Lock, Clock,
  HardHat, MapPin, UserCheck, AlertOctagon, Check, Plus, Zap, Gauge, QrCode, Send, PlayCircle,
  Shield, AlertTriangle, ArrowRight, CheckSquare, Sparkles, SlidersHorizontal, ArrowLeft
} from 'lucide-react';
import { FactoryCanvas, LayerConfig, CameraPresetType, ZONE_DEFS, ViewLevel } from '../components/DigitalTwin/FactoryCanvas';
import { Breadcrumb } from '../components/DigitalTwin/Breadcrumb';
import { CompassOverlay } from '../components/DigitalTwin/CompassOverlay';
import { ZoneId, zoneIdForMachineCode } from '../components/DigitalTwin/zoneData';
import { Machine, TelemetryData, Incident, WorkOrder } from '../types';
import { api } from '../services/api';

// ─────────────────────────────────────────────────────────────────────────────
// Status Colors & Badge Helpers
// ─────────────────────────────────────────────────────────────────────────────
const S_COLORS: Record<string, string> = {
  RUNNING: '#22A06B',
  WARNING: '#D99A06',
  FAULT: '#D64545',
  WAITING_PARTS: '#7C5CC4',
  MAINTENANCE: '#3978C8',
  VERIFYING: '#7C5CC4',
  OFFLINE: '#7A7A73',
};

const S_BADGE: Record<string, string> = {
  RUNNING: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  WARNING: 'bg-amber-100 text-amber-800 border-amber-200',
  FAULT: 'bg-red-100 text-red-800 border-red-200',
  WAITING_PARTS: 'bg-purple-100 text-purple-800 border-purple-200',
  MAINTENANCE: 'bg-blue-100 text-blue-800 border-blue-200',
  VERIFYING: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  OFFLINE: 'bg-slate-100 text-slate-800 border-slate-200',
};

// ─────────────────────────────────────────────────────────────────────────────
// Machine-Specific OSHA 1910.147 LOTO Protocols
// ─────────────────────────────────────────────────────────────────────────────
const LOTO_PROTOCOLS: Record<string, {
  oshaStandard: string;
  lockoutBoxLocation: string;
  machineType: string;
  requiredPpe: string[];
  isolationSteps: { id: string; title: string; category: string; procedure: string; targetZeroState: string }[];
}> = {
  CNC: {
    oshaStandard: 'OSHA 29 CFR 1910.147 (Control of Hazardous Energy)',
    lockoutBoxLocation: 'Lockout Station L-01 (Machining Cell)',
    machineType: '5-Axis CNC Milling Center',
    requiredPpe: ['Arc Flash Level 2 Face Shield', 'Safety Glasses (ANSI Z87.1)', 'Steel-toe ESD Boots', 'Cut-Resistant Nitrile Gloves'],
    isolationSteps: [
      { id: 'cnc-1', title: '480V AC Main Machine Disconnect', category: 'ELECTRICAL', procedure: 'Rotate yellow/red isolator handle to OFF (0). Affix red master lockout hasp and padlock.', targetZeroState: '0.0 VAC measured on multi-meter across all 3 phases (L1-L2-L3)' },
      { id: 'cnc-2', title: 'Main Pneumatic Supply & Chuck Clamping Air', category: 'PNEUMATIC', procedure: 'Slide lockout exhaust valve to closed exhaust position. Vent residual 6.0 bar line pressure.', targetZeroState: '0.0 bar (0 psi) on digital manifold pressure gauge' },
      { id: 'cnc-3', title: 'High-Pressure Through-Spindle Coolant Pump', category: 'HYDRAULIC', procedure: 'Trip auxiliary motor circuit breaker and lock with circuit breaker padlock clamp.', targetZeroState: 'Zero fluid pressure & pump disabled' },
      { id: 'cnc-4', title: 'Spindle Kinetic Coast-Down & Zero Energy Verification', category: 'MECHANICAL', procedure: 'Verify 0 RPM and zero kinetic flywheel energy before opening tool magazine interlock.', targetZeroState: '0 RPM confirmed & spindle mechanical pin locked' },
    ]
  },
  ROBOT: {
    oshaStandard: 'OSHA 29 CFR 1910.147 & ANSI/RIA R15.06',
    lockoutBoxLocation: 'Lockout Station R-02 (Robotics Cell)',
    machineType: '6-Axis Industrial Articulated Robot',
    requiredPpe: ['Safety Glasses (ANSI Z87.1)', 'Steel-toe Boots', 'Nitrile Gloves', 'Teach Pendant E-Stop Collar'],
    isolationSteps: [
      { id: 'rob-1', title: '400V 3-Phase Robot Controller Main Disconnect', category: 'ELECTRICAL', procedure: 'Switch controller main breaker to OFF. Place lockout hasp on switch arm.', targetZeroState: '0.0 VAC across phases' },
      { id: 'rob-2', title: 'Robot End-Effector Pneumatic Supply Dump', category: 'PNEUMATIC', procedure: 'Turn isolation ball valve to dump position. Lock valve in exhaust detent.', targetZeroState: '0.0 bar on robot gripper pressure sensor' },
      { id: 'rob-3', title: 'Axis Mechanical Gravity Pin / Brake Interlock', category: 'MECHANICAL', procedure: 'Engage mechanical axis safety catch pin on J2/J3 cantilever arm.', targetZeroState: 'Mechanical interlock locked in place' },
    ]
  },
  PROCESSING: {
    oshaStandard: 'OSHA 29 CFR 1910.147 & ASME B31.3',
    lockoutBoxLocation: 'Lockout Station P-03 (Fluid Processing)',
    machineType: 'Fluid Processing & Pumping System',
    requiredPpe: ['Chemical Splash Goggles', 'Acid/Oil Resistant Nitrile Gloves', 'Steel-toe Boots', 'Face Shield'],
    isolationSteps: [
      { id: 'proc-1', title: '480V Pump Motor Starter Disconnect', category: 'ELECTRICAL', procedure: 'Trip disconnect switch at Motor Control Center (MCC-3) and lock with padlock.', targetZeroState: '0.0 VAC at motor terminals' },
      { id: 'proc-2', title: 'Suction & Discharge Isolation Valves', category: 'HYDRAULIC', procedure: 'Close upstream and downstream isolation ball valves. Lock handles with cable lockout.', targetZeroState: '0.0 bar on pressure transmitter' },
      { id: 'proc-3', title: 'Drain Cavity Bleed & Vent Valve', category: 'FLUIDIC', procedure: 'Open vent valve into containment tray to depressurize casing and verify zero fluid flow.', targetZeroState: 'Atmospheric pressure & zero liquid discharge' },
    ]
  },
  ASSEMBLY: {
    oshaStandard: 'OSHA 29 CFR 1910.147',
    lockoutBoxLocation: 'Lockout Station A-04 (Assembly Bay)',
    machineType: 'Automated Rotary Assembly Cell',
    requiredPpe: ['Safety Glasses (ANSI Z87.1)', 'ESD Safety Shoes', 'Cut-Resistant Gloves'],
    isolationSteps: [
      { id: 'asmb-1', title: '230V Servo Drive Main Power Disconnect', category: 'ELECTRICAL', procedure: 'Switch servo panel isolator to OFF and apply padlock.', targetZeroState: '0.0 VAC measured' },
      { id: 'asmb-2', title: 'Pneumatic Actuator Exhaust Dump', category: 'PNEUMATIC', procedure: 'Exhaust pneumatic manifold to 0.0 bar.', targetZeroState: '0.0 bar on manifold' },
    ]
  },
  PACKAGING: {
    oshaStandard: 'OSHA 29 CFR 1910.147',
    lockoutBoxLocation: 'Lockout Station PK-05 (Packaging Area)',
    machineType: 'High-Speed Flow Packaging Unit',
    requiredPpe: ['Safety Glasses (ANSI Z87.1)', 'Steel-toe Shoes', 'Heat-Resistant Gloves'],
    isolationSteps: [
      { id: 'pkg-1', title: '480V Infeed Conveyor & Drive Disconnect', category: 'ELECTRICAL', procedure: 'Turn main isolator to OFF and padlock.', targetZeroState: '0.0 VAC measured' },
      { id: 'pkg-2', title: 'Sealing Bar Heater Circuit Breaker', category: 'THERMAL', procedure: 'Lock out heating element circuit breaker and wait for temp < 40°C.', targetZeroState: '0.0 VAC & temp < 40°C' },
    ]
  },
  MAINTENANCE: {
    oshaStandard: 'OSHA 29 CFR 1910.147',
    lockoutBoxLocation: 'Lockout Station M-06 (Maintenance Bay)',
    machineType: 'Overhaul & Test Station',
    requiredPpe: ['Safety Glasses (ANSI Z87.1)', 'Steel-toe Shoes', 'Nitrile Gloves'],
    isolationSteps: [
      { id: 'mnt-1', title: '230V Diagnostic Station Power Disconnect', category: 'ELECTRICAL', procedure: 'Isolate bench power supply and apply lockout hasp.', targetZeroState: '0.0 VAC measured' },
      { id: 'mnt-2', title: 'Auxiliary Sensor Power Supply', category: 'ELECTRICAL', procedure: 'Disconnect 24V DC auxiliary test rack power.', targetZeroState: '0.0 VDC measured' },
    ]
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PLANTOPS Failure Library — 30 Realistic Scenarios Across 6 Zones
// Tiers: OCCASIONAL (🟢) · UNCOMMON (🟡) · RARE (🟠) · CRITICAL_RARE (🔴)
// 18/30 require no spare part — sensor drift, calibration, lubrication, jams
// ─────────────────────────────────────────────────────────────────────────────
type FailureTier = 'OCCASIONAL' | 'UNCOMMON' | 'RARE' | 'CRITICAL_RARE';

interface FailureScenario {
  scenarioId: string;
  name: string;
  tier: FailureTier;
  section: string;
  anomalyType: string;
  description: string;
  iotSignature: string;      // What the IoT sensors show
  technicianFinding: string; // What the technician finds on-site
  requiresPart: boolean;
  partRequired?: string;
}

const TIER_BADGE: Record<FailureTier, { label: string; color: string; bg: string }> = {
  OCCASIONAL:    { label: '🟢 Occasional',    color: '#166534', bg: '#DCFCE7' },
  UNCOMMON:      { label: '🟡 Uncommon',      color: '#854D0E', bg: '#FEF9C3' },
  RARE:          { label: '🟠 Rare',          color: '#9A3412', bg: '#FFEDD5' },
  CRITICAL_RARE: { label: '🔴 Critical Rare', color: '#7F1D1D', bg: '#FEE2E2' },
};

const PLANTOPS_FAILURE_LIBRARY: FailureScenario[] = [
  // ── MACHINING (6) ─────────────────────────────────────────────────────────
  { scenarioId:'MCH-01', name:'Tool Wear / Dull Cutting Insert',   tier:'OCCASIONAL', section:'MACHINING',   anomalyType:'TOOL_WEAR',       description:'Gradual cutting insert wear causing elevated spindle load and surface quality degradation.',     iotSignature:'⚡ Current ↑ (14.2 A) | 〰️ Vib ↑ (4.1 mm/s)',        technicianFinding:'Worn/chipped cutting insert. Insert replaced.',                        requiresPart:true,  partRequired:'SANDVIK-CoroMill 490 Insert' },
  { scenarioId:'MCH-02', name:'Coolant Flow Reduction',            tier:'OCCASIONAL', section:'MACHINING',   anomalyType:'COOLANT_ISSUE',   description:'Blocked coolant filter causing reduced flow rate, gradual spindle temperature rise.',             iotSignature:'🌡️ Temp ↑ (72°C) | ◉ Pressure ↓ (1.9 bar)',         technicianFinding:'Blocked coolant line filter. Filter cleaned/replaced.',              requiresPart:false },
  { scenarioId:'MCH-03', name:'Chip Accumulation / Obstruction',  tier:'OCCASIONAL', section:'MACHINING',   anomalyType:'CHIP_JAM',        description:'Chip buildup in workpiece fixture area causing load increase and cycle time deviation.',         iotSignature:'⚡ Current ↑ (13.8 A) | Cycle time ↑',              technicianFinding:'Chip accumulation cleared from cutting zone. No part needed.',       requiresPart:false },
  { scenarioId:'MCH-04', name:'Workholding / Clamping Issue',     tier:'OCCASIONAL', section:'MACHINING',   anomalyType:'CLAMPING',        description:'Debris or wear in workholding causing vibration and part positioning deviation.',               iotSignature:'〰️ Vib ↑ (5.2 mm/s) | Position deviation detected', technicianFinding:'Fixture debris cleaned. Clamping force re-verified.',                requiresPart:false },
  { scenarioId:'MCH-05', name:'Spindle Fan / Cooling Failure',    tier:'UNCOMMON',   section:'MACHINING',   anomalyType:'FAN_FAILURE',     description:'Spindle fan degradation or blockage causing thermal rise without load increase.',               iotSignature:'🌡️ Temp ↑ (78°C) — no vibration spike',             technicianFinding:'Spindle cooling fan obstruction cleared. Fan inspected.',            requiresPart:false },
  { scenarioId:'MCH-06', name:'Spindle Bearing Degradation',      tier:'RARE',       section:'MACHINING',   anomalyType:'BEARING_WEAR',    description:'Progressive bearing race wear causing combined vibration and thermal signature.',               iotSignature:'〰️ Vib: 8.4 mm/s | 🌡️ Temp: 82°C',               technicianFinding:'Spindle bearing fluting confirmed. Bearing replacement required.',   requiresPart:true,  partRequired:'SKF-6205 Deep Groove Ball Bearing' },
  // ── ROBOT (5) ─────────────────────────────────────────────────────────────
  { scenarioId:'ROB-01', name:'Gripper / Tooling Failure',        tier:'OCCASIONAL', section:'ROBOT',       anomalyType:'GRIPPER',         description:'Gripper jaw wear or pneumatic supply issue causing cycle failure. No major sensor spike.',      iotSignature:'◉ Grip pressure ↓ | Cycle failure signal',          technicianFinding:'Gripper jaw wear / supply air pressure low. Adjusted/replaced.',    requiresPart:false },
  { scenarioId:'ROB-02', name:'Position / Calibration Drift',     tier:'OCCASIONAL', section:'ROBOT',       anomalyType:'CALIBRATION',     description:'Gradual axis calibration drift causing positional error accumulation.',                        iotSignature:'〰️ Position error ↑ (>0.3 mm)',                     technicianFinding:'Axis calibration executed. Zero-point restored.',                   requiresPart:false },
  { scenarioId:'ROB-03', name:'Pneumatic Pressure Drop',          tier:'OCCASIONAL', section:'ROBOT',       anomalyType:'PNEUMATIC_DROP',  description:'Air supply pressure reducing below robot minimum spec of 5.5 bar.',                           iotSignature:'◉ Pressure ↓ (4.8 bar)',                            technicianFinding:'Air supply regulator pressure drift. Regulator adjusted.',          requiresPart:false },
  { scenarioId:'ROB-04', name:'Joint Overload / Poor Lubrication',tier:'UNCOMMON',   section:'ROBOT',       anomalyType:'LUBRICATION',     description:'Grease oxidation in robot joint causing increased friction and current draw.',                 iotSignature:'⚡ Current ↑ (13.5 A) | 🌡️ Temp ↑ (68°C)',         technicianFinding:'Joint lubrication degraded. Grease service performed.',             requiresPart:false },
  { scenarioId:'ROB-05', name:'Gearbox Wear',                     tier:'RARE',       section:'ROBOT',       anomalyType:'GEARBOX_WEAR',    description:'Cycloidal gear wear causing elevated torque noise, vibration, and backlash.',                  iotSignature:'〰️ Vib ↑ (6.8 mm/s) | ⚡ Current ↑ | Torque noise',technicianFinding:'Gearbox internal wear confirmed. Reducer replacement required.',    requiresPart:true,  partRequired:'NABTESCO-RV-40E Cycloidal Reducer' },
  // ── PROCESSING (7) ────────────────────────────────────────────────────────
  { scenarioId:'PRS-01', name:'Pump Pressure Drop',               tier:'OCCASIONAL', section:'PROCESSING',  anomalyType:'PRESSURE_DROP',   description:'Gradual pump outlet pressure decrease indicating system restriction or wear.',                 iotSignature:'◉ Pressure ↓ (3.2 → 2.4 bar) | 🌡️ Temp ↑',         technicianFinding:'Pump impeller restriction. System flushed. Pressure restored.',    requiresPart:false },
  { scenarioId:'PRS-02', name:'Pump Flow Restriction (Filter)',   tier:'OCCASIONAL', section:'PROCESSING',  anomalyType:'FILTER_CLOG',     description:'Inlet strainer or filter restriction causing reduced flow and pressure instability.',          iotSignature:'◉ Pressure ↓ (2.8 bar) | ⚡ Current ↑',            technicianFinding:'Inlet strainer clogged. Filter element replaced.',                  requiresPart:true,  partRequired:'GRUNDFOS-96420022 Strainer Element' },
  { scenarioId:'PRS-03', name:'Pump Mechanical Seal Leakage',     tier:'OCCASIONAL', section:'PROCESSING',  anomalyType:'SEAL_LEAK',       description:'Mechanical seal face wear causing product leakage around shaft housing.',                     iotSignature:'◉ Pressure ↓ | 🌡️ Temp ↑ — visible leakage',       technicianFinding:'Mechanical seal face wear confirmed. Seal kit replacement.',        requiresPart:true,  partRequired:'PARKER-V884 High-Temp Seal Kit' },
  { scenarioId:'PRS-04', name:'Pump Cavitation',                  tier:'UNCOMMON',   section:'PROCESSING',  anomalyType:'CAVITATION',      description:'Air entrainment in suction line causing pump cavitation vibration signature.',                iotSignature:'〰️ Vib ↑ (5.6 mm/s) | ◉ Pressure fluctuating',     technicianFinding:'Suction line air leak / NPSH issue. Line bled and sealed.',        requiresPart:false },
  { scenarioId:'PRS-05', name:'Mixer Motor Overheating',          tier:'UNCOMMON',   section:'PROCESSING',  anomalyType:'MOTOR_OVERHEAT',  description:'Mixer motor thermal rise due to cooling restriction or excessive load.',                      iotSignature:'🌡️ Temp ↑ (82°C) | ⚡ Current ↑ (17.5 A)',          technicianFinding:'Motor cooling fan obstruction / product viscosity high. Resolved.',  requiresPart:false },
  { scenarioId:'PRS-06', name:'Mixer Abnormal Vibration',         tier:'UNCOMMON',   section:'PROCESSING',  anomalyType:'MIXER_VIB',       description:'Material imbalance or impeller wear causing elevated mixer shaft vibration.',                 iotSignature:'〰️ Vib ↑ (6.1 mm/s) | 🌡️ Temp ↑',                 technicianFinding:'Impeller material adhesion. Cleaned and re-balanced.',              requiresPart:false },
  { scenarioId:'PRS-07', name:'Hydraulic Press Pressure Loss',    tier:'RARE',       section:'PROCESSING',  anomalyType:'HYDRAULIC_LOSS',  description:'Ram proportional valve spool leakage causing ram tonnage pressure drops.',                    iotSignature:'◉ Pressure ↓ (1.8 bar) | ⚡ Current ↑',            technicianFinding:'Hydraulic directional valve spool wear. Valve replacement.',        requiresPart:true,  partRequired:'REXROTH-4WE6 Directional Valve' },
  // ── ASSEMBLY (5) ──────────────────────────────────────────────────────────
  { scenarioId:'ASM-01', name:'Part Misalignment / Positioning',  tier:'OCCASIONAL', section:'ASSEMBLY',    anomalyType:'MISALIGNMENT',    description:'Pallet or fixture positioning error causing downstream station timeout.',                     iotSignature:'〰️ Vib ↑ (4.2 mm/s) | Station timeout signal',      technicianFinding:'Fixture locating pin wear. Pin cleaned/replaced. No major part.',  requiresPart:false },
  { scenarioId:'ASM-02', name:'Sensor Misread / Drift',           tier:'OCCASIONAL', section:'ASSEMBLY',    anomalyType:'SENSOR_DRIFT',    description:'Proximity sensor drift causing false presence/absence detection errors.',                     iotSignature:'⚡ Current ↑ (sensor load) | False detection events', technicianFinding:'Sensor face contaminated. Cleaned and re-taught distance.',        requiresPart:false },
  { scenarioId:'ASM-03', name:'Conveyor Index Position Error',    tier:'OCCASIONAL', section:'ASSEMBLY',    anomalyType:'INDEX_ERROR',     description:'Servo encoder drift on index conveyor causing pallet stopping position deviation.',            iotSignature:'〰️ Vib ↑ | RPM deviation',                          technicianFinding:'Encoder calibration drift. Zero re-established. No part required.', requiresPart:false },
  { scenarioId:'ASM-04', name:'Gripper Pick Failure',             tier:'OCCASIONAL', section:'ASSEMBLY',    anomalyType:'GRIPPER_FAIL',    description:'Assembly robot gripper not consistently picking parts due to vacuum or jaw issue.',            iotSignature:'◉ Vacuum pressure ↓ | Cycle failures ↑',            technicianFinding:'Vacuum cup wear. Cups replaced. Grip force re-verified.',           requiresPart:false },
  { scenarioId:'ASM-05', name:'Pneumatic Actuator Issue',         tier:'UNCOMMON',   section:'ASSEMBLY',    anomalyType:'ACTUATOR',        description:'Pneumatic cylinder seal wear causing slow/incomplete stroke and station interlock.',          iotSignature:'◉ Pressure ↓ (3.8 bar) | ⚡ Current ↑',            technicianFinding:'Pneumatic cylinder end-seal worn. Seal kit replaced.',              requiresPart:true,  partRequired:'SMC-CQ2B40-50D Cylinder Seal Kit' },
  // ── PACKAGING (5) ─────────────────────────────────────────────────────────
  { scenarioId:'PKG-01', name:'Product Misalignment on Line',     tier:'OCCASIONAL', section:'PACKAGING',   anomalyType:'MISALIGNMENT',    description:'Product entering packaging station off-center causing reject sensor triggers.',               iotSignature:'〰️ Vib ↑ | Reject count ↑',                        technicianFinding:'Infeed guide misaligned. Guide adjusted. No part required.',       requiresPart:false },
  { scenarioId:'PKG-02', name:'Film Tracking / Guide Drift',      tier:'OCCASIONAL', section:'PACKAGING',   anomalyType:'FILM_DRIFT',      description:'Wrapping film meandering off-center causing seal quality issues.',                           iotSignature:'〰️ Vib ↑ (3.8 mm/s) | ⚡ Current ↑',               technicianFinding:'Film guide rail drift. Guide repositioned. No part needed.',       requiresPart:false },
  { scenarioId:'PKG-03', name:'Conveyor Jam / Product Stoppage',  tier:'OCCASIONAL', section:'PACKAGING',   anomalyType:'JAM',             description:'Product jam on packaging infeed conveyor causing motor current spike and RPM drop.',          iotSignature:'⚡ Current ↑ (16.8 A) | RPM ↓',                     technicianFinding:'Product jam cleared. Conveyor restarted. No part required.',      requiresPart:false },
  { scenarioId:'PKG-04', name:'Seal Bar Temperature Deviation',   tier:'OCCASIONAL', section:'PACKAGING',   anomalyType:'HEAT_DEVIATION',  description:'Seal bar heater PID instability causing temperature to exceed spec by 8°C.',                 iotSignature:'🌡️ Temp ↑ (88°C) — seal quality rejected',           technicianFinding:'Heater element degradation or PID tuning drift. Element checked.',  requiresPart:false },
  { scenarioId:'PKG-05', name:'Cutter Servo Overload',            tier:'UNCOMMON',   section:'PACKAGING',   anomalyType:'SERVO_OVERLOAD',  description:'Cutter servo motor overload due to film tension increase causing excess current draw.',       iotSignature:'⚡ Current ↑ (18.5 A) | 🌡️ Temp ↑ | 〰️ Vib ↑',    technicianFinding:'Film reel tension incorrect. Tension adjusted. Servo cooled down.', requiresPart:false },
  // ── MAINTENANCE (2) ───────────────────────────────────────────────────────
  { scenarioId:'MNT-01', name:'Test Station Sensor Fault',        tier:'UNCOMMON',   section:'MAINTENANCE', anomalyType:'SENSOR_FAULT',    description:'Diagnostic test station sensor returning intermittent/incorrect measurement values.',         iotSignature:'⚡ Current ↑ | Measurement variance ↑',             technicianFinding:'Sensor connector corrosion. Cleaned and re-seated.',               requiresPart:false },
  { scenarioId:'MNT-02', name:'Diagnostic Equipment Connection',  tier:'UNCOMMON',   section:'MAINTENANCE', anomalyType:'COMMS_FAULT',     description:'Diagnostic instrument losing communication with test bench controller intermittently.',        iotSignature:'〰️ Vib ↑ (vibration causing cable intermittency)',   technicianFinding:'USB/RS232 cable connector loose. Re-seated and secured.',          requiresPart:false },
];

/** Map each machine code to the recommended primary scenario ID */
const MACHINE_SCENARIO_MAP: Record<string, string> = {
  'CNC-01': 'MCH-02', // Coolant Flow Reduction (Occasional)
  'CNC-02': 'MCH-01', // Tool Wear
  'CNC-03': 'MCH-04', // Workholding Issue
  'CNC-04': 'MCH-03', // Chip Accumulation
  'CNC-05': 'MCH-05', // Spindle Fan Issue
  'CNC-06': 'MCH-06', // Spindle Bearing Degradation (Rare)
  'ROBOT-01': 'ROB-04', // Joint Overload / Poor Lubrication
  'ROBOT-02': 'ROB-01', // Gripper Failure
  'ROBOT-03': 'ROB-02', // Calibration Drift
  'ROBOT-04': 'ROB-05', // Gearbox Wear (Rare)
  'MIXER-01':   'PRS-05', // Mixer Overheating
  'PUMP-01':    'PRS-01', // Pump Pressure Drop
  'PRESS-01':   'PRS-07', // Hydraulic Press Pressure Loss (Rare)
  'PROCESS-01': 'PRS-04', // Cavitation
  'PROCESS-02': 'PRS-03', // Seal Leakage
  'ASMB-01': 'ASM-01', // Part Misalignment
  'ASMB-02': 'ASM-02', // Sensor Misread
  'ASMB-03': 'ASM-03', // Index Error
  'ASMB-04': 'ASM-04', // Gripper Pick Failure
  'PACK-01':    'PKG-04', // Seal Temperature
  'PACK-02':    'PKG-02', // Film Tracking
  'PACK-03':    'PKG-03', // Conveyor Jam
  'BENCH-01':   'MNT-01', // Test Station Sensor
  'BENCH-02':   'MNT-02', // Diagnostic Equipment
  'TEST-01':    'MNT-01', // Test Station Sensor
  // Legacy machines
  'CONVEYOR-01':  'ASM-03',
  'CONVEYOR-02':  'ASM-03',
  'PACKAGING-01': 'PKG-01',
};

function getScenario(machineCode: string): FailureScenario {
  const sid = MACHINE_SCENARIO_MAP[machineCode] || 'MCH-02';
  return PLANTOPS_FAILURE_LIBRARY.find(s => s.scenarioId === sid) || PLANTOPS_FAILURE_LIBRARY[0];
}

// ─────────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────────
// Machine Details Floating Overlay Inspector Panel
// ─────────────────────────────────────────────────────────────────────────────
interface DetailsProps {
  machine: Machine;
  telemetry?: TelemetryData;
  incident?: Incident;
  workOrder?: WorkOrder;
  onClose: () => void;
  onRefresh: () => void;
  onFitFactory?: () => void;
  onDispatchTechnician?: (code: string | null) => void;
  onOpenWorkstation?: () => void;
}

const MachineDetailsPanel: React.FC<DetailsProps> = ({
  machine, telemetry, incident, workOrder, onClose, onRefresh, onFitFactory, onDispatchTechnician, onOpenWorkstation
}) => {
  const [tab, setTab] = useState<'live' | 'simulate' | 'ai' | 'wo' | 'timeline'>('live');
  const [applyingLoto, setApplyingLoto] = useState(false);
  const [submittingInspection, setSubmittingInspection] = useState(false);
  // Reconstruct from the backend-authoritative work order instead of always
  // starting false — otherwise reopening this panel on an INSPECTING-or-later
  // work order would hide the already-submitted inspection and show the
  // inspection form again.
  const [inspectionSubmitted, setInspectionSubmitted] = useState(
    Boolean(workOrder && ['WAITING_PARTS', 'REPAIRING', 'VERIFYING', 'RETURNING', 'COMPLETED'].includes(workOrder.technician_phase || ''))
  );
  const [completing, setCompleting] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [healing, setHealing] = useState(false);
  const [simMsg, setSimMsg] = useState<string | null>(null);
  // Timeline data
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Inspection form inside Digital Twin Drawer
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>(['Spindle raceway fluting / abnormal chatter']);
  const [techRootCause, setTechRootCause] = useState('Spindle raceway EDM fluting due to bearing current leakage');
  const [selectedPartId, setSelectedPartId] = useState('PART-SKF-6205');
  const [atpInfo, setAtpInfo] = useState<any>(null);

  // Load timeline events when tab switches to 'timeline'
  useEffect(() => {
    if (tab === 'timeline' && incident?.id) {
      setTimelineLoading(true);
      fetch(`/api/incidents/${incident.id}/events`)
        .then(r => r.json())
        .then(d => { if (d.success) setTimelineEvents(d.data || []); })
        .catch(() => {})
        .finally(() => setTimelineLoading(false));
    }
  }, [tab, incident?.id]);

  const checkPartATP = async (partId: string) => {
    setSelectedPartId(partId);
    try {
      const res = await api.checkATP(partId);
      if (res.success) setAtpInfo(res.data);
    } catch {}
  };

  const toggleSymptom = (sym: string) => {
    setSelectedSymptoms(prev =>
      prev.includes(sym) ? prev.filter(s => s !== sym) : [...prev, sym]
    );
  };

  const handleInjectFault = async () => {
    setSimulating(true);
    setSimMsg(null);
    onDispatchTechnician?.(machine.code);
    try {
      await api.injectFault(machine.code, scenario.anomalyType, 1.0, scenario.scenarioId);
      setSimMsg(`⚠️ Scenario "${scenario.name}" triggered on ${machine.code}. Dispatched technician en route...`);
      onRefresh();
      setTab('ai');
    } catch (err: any) {
      setSimMsg(`Error: ${err.message}`);
    } finally {
      setSimulating(false);
    }
  };

  const handleNormalize = async () => {
    setHealing(true);
    setSimMsg(null);
    onDispatchTechnician?.(null);
    try {
      await api.healMachine(machine.code);
      setSimMsg(`✅ Baseline telemetry restored for ${machine.code}.`);
      onRefresh();
    } catch (err: any) {
      setSimMsg(`Error: ${err.message}`);
    } finally {
      setHealing(false);
    }
  };

  const [arriving, setArriving] = useState(false);

  const handleTechnicianArrive = async () => {
    if (!workOrder) return;
    setArriving(true);
    try {
      await api.markTechnicianArrived(workOrder.id, 'Arun Kumar (Lead Tech)');
      setSimMsg(`📍 Technician arrived on site for ${machine.code}.`);
      onRefresh();
    } catch (err: any) {
      setSimMsg(`Error: ${err.message}`);
    } finally {
      setArriving(false);
    }
  };

  const handleApplyLOTO = async () => {
    if (!workOrder) return;
    setApplyingLoto(true);
    try {
      await api.applyLOTO(workOrder.id, 'Arun Kumar (Lead Tech)');
      setSimMsg('🔒 OSHA 1910.147 LOTO Lockout verified.');
      onRefresh();
      checkPartATP('PART-SKF-6205');
    } catch (err: any) {
      setSimMsg(`Error: ${err.message}`);
    } finally {
      setApplyingLoto(false);
    }
  };

  const handleSubmitPhysicalInspection = async () => {
    if (!workOrder) return;
    setSubmittingInspection(true);
    try {
      const res = await api.submitInspection(workOrder.id, {
        technicianName: 'Arun Kumar (Lead Tech)',
        symptomsObserved: selectedSymptoms,
        technicianRootCause: techRootCause,
        requiredPartId: selectedPartId,
        quantity: 1
      });
      if (res.success) {
        setInspectionSubmitted(true);
        setSimMsg('✅ Physical inspection recorded & spare part allocated via ATP.');
        onRefresh();
      }
    } catch (err: any) {
      setSimMsg(`Error: ${err.message}`);
    } finally {
      setSubmittingInspection(false);
    }
  };

  const handleComplete = async () => {
    if (!workOrder) return;
    setCompleting(true);
    try {
      await api.healMachine(machine.code);
      await api.completeRepair(workOrder.id, 'Arun Kumar (Lead Tech)');
      setSimMsg('✅ Repair completed. Autonomous 10s sensor verification running...');
      onRefresh();
    } catch (err: any) {
      setSimMsg(`Error: ${err.message}`);
    } finally {
      setCompleting(false);
    }
  };

  const color = S_COLORS[machine.status] || '#22A06B';
  const badge = S_BADGE[machine.status] || S_BADGE.RUNNING;
  const isFault = machine.status === 'FAULT';

  // Use the new PLANTOPS Failure Library
  const scenario = getScenario(machine.code);
  const tierInfo = TIER_BADGE[scenario.tier];

  const temp = telemetry?.temperature ?? (isFault ? 82.4 : 62.0);
  const vib  = telemetry?.vibration   ?? (isFault ? 9.40 : 2.20);
  const curr = telemetry?.current     ?? 12.5;
  const rpm  = telemetry?.rpm         ?? 2800;
  const pres = telemetry?.pressure    ?? 5.2;

  const sensors = [
    { label: 'Temperature', value: temp.toFixed(1), unit: '°C', warn: temp > 70, fault: temp > 80 },
    { label: 'Vibration',   value: vib.toFixed(2),  unit: 'mm/s', warn: vib > 5, fault: vib > 7.5 },
    { label: 'Current',     value: curr.toFixed(1), unit: 'A', warn: false, fault: false },
    { label: 'RPM',         value: rpm.toString(),  unit: 'RPM', warn: false, fault: false },
    { label: 'Pressure',    value: pres.toFixed(1), unit: 'bar', warn: pres < 4.0, fault: pres < 3.0 },
  ];

  return (
    <div className="absolute right-4 top-4 bottom-4 w-[390px] min-w-[390px] max-w-[390px] bg-[#FAF9F6]/98 backdrop-blur-xl border border-[#DDD9D0] rounded-2xl flex flex-col shadow-2xl overflow-hidden z-50 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#DDD9D0] bg-white/90 flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center border shadow-sm flex-shrink-0" style={{ background: `${color}15`, borderColor: `${color}40` }}>
            <Box size={16} style={{ color }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-extrabold text-xs text-[#1E293B]">{machine.code}</span>
              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border ${badge}`}>
                {machine.status}
              </span>
            </div>
            <div className="text-[10px] text-[#64748B] truncate max-w-[170px] font-medium">{machine.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {onOpenWorkstation && (
            <button
              onClick={onOpenWorkstation}
              className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 shadow-xs"
              title="Open Field Technician Workstation on the right side"
            >
              <HardHat size={12} className="text-amber-600" />
              <span>Workstation</span>
            </button>
          )}
          {onFitFactory && (
            <button
              onClick={onFitFactory}
              className="p-1.5 rounded-lg hover:bg-[#EAE7E0] text-[#2563EB] transition-colors"
              title="Fit entire factory in frame"
            >
              <Compass size={15} />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#EAE7E0] text-[#64748B] transition-colors"
            title="Close Inspector"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Health + Info */}
      <div className="px-4 py-2.5 bg-[#FAF9F6] border-b border-[#DDD9D0] space-y-2 flex-shrink-0">
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
          <div><span className="text-[9px] text-[#64748B] uppercase font-bold">Type</span><p className="font-semibold text-xs text-[#1E293B] truncate">{machine.type}</p></div>
          <div><span className="text-[9px] text-[#64748B] uppercase font-bold">Cell</span><p className="font-semibold text-xs text-[#1E293B] truncate">{machine.area}</p></div>
          <div><span className="text-[9px] text-[#64748B] uppercase font-bold">Criticality</span><p className="font-bold text-xs" style={{ color }}>● {machine.criticality || 'HIGH'}</p></div>
          <div><span className="text-[9px] text-[#64748B] uppercase font-bold">LOTO Protocol</span><p className="font-semibold text-xs text-[#0F766E] truncate">OSHA 1910.147</p></div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-[10px] text-[#64748B] font-medium">Machine Health</span>
            <span className="font-mono font-extrabold text-xs text-[#1E293B]">{machine.health_score || 98}%</span>
          </div>
          <div className="h-1.5 bg-[#DDD9D0] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${machine.health_score || 98}%`, background: color }} />
          </div>
        </div>
      </div>

      {/* Navigation Tabs — 5-Column Equal Width Grid */}
      <div className="grid grid-cols-5 border-b border-[#DDD9D0] bg-white/90 flex-shrink-0">
        {[
          { id: 'live',     label: 'Live'     },
          { id: 'simulate', label: 'Simulate' },
          { id: 'ai',       label: 'AI'       },
          { id: 'wo',       label: 'W.O.'     },
          { id: 'timeline', label: 'Timeline' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`py-2 px-1 text-[10px] font-bold text-center -mb-px border-b-2 transition-all truncate ${
              tab === t.id
                ? 'border-[#2563EB] text-[#2563EB] bg-blue-50/50'
                : 'border-transparent text-[#64748B] hover:text-[#1E293B] hover:bg-slate-50/50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content (Fixed Scrollable Viewport with zero horizontal shift) */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 text-xs w-full no-scrollbar">
        {/* Toast inside drawer */}
        {simMsg && (
          <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-[#1E293B] text-[11px] font-semibold leading-relaxed animate-in fade-in">
            {simMsg}
          </div>
        )}

        {/* TAB 1: Live Telemetry */}
        {tab === 'live' && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Live IoT Edge Feed</span>
              <span className="flex items-center gap-1 text-[10px] text-[#22A06B] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22A06B] animate-pulse" /> 10 Hz Stream
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {sensors.map((s) => (
                <div
                  key={s.label}
                  className={`p-2 rounded-xl border ${
                    s.fault ? 'bg-red-50 border-red-200' : s.warn ? 'bg-amber-50 border-amber-200' : 'bg-white border-[#DDD9D0]'
                  }`}
                >
                  <div className="text-[10px] text-[#64748B] font-medium">{s.label}</div>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className={`text-base font-mono font-extrabold ${s.fault ? 'text-red-700' : s.warn ? 'text-amber-700' : 'text-[#1E293B]'}`}>
                      {s.value}
                    </span>
                    <span className="text-[10px] text-[#64748B]">{s.unit}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick in-tab simulation prompt */}
            <div className="p-3 bg-white border border-[#DDD9D0] rounded-xl space-y-2">
              <div className="text-[10px] font-bold text-[#64748B] uppercase">Dedicated Asset Anomaly</div>
              <div className="font-bold text-xs text-[#1E293B]">{scenario.name}</div>
              <div className="flex gap-2">
                <button
                  onClick={handleInjectFault}
                  disabled={simulating || isFault}
                  className="flex-1 py-1.5 px-2 rounded-lg bg-[#D64545] hover:bg-red-700 text-white text-[11px] font-bold transition-all disabled:opacity-40 shadow-sm"
                >
                  {simulating ? 'Injecting...' : isFault ? 'Fault Active' : '⚡ Trigger Anomaly'}
                </button>
                <button
                  onClick={handleNormalize}
                  disabled={healing}
                  className="py-1.5 px-2.5 rounded-lg bg-[#E8F6EF] hover:bg-emerald-100 text-[#22A06B] border border-[#B4E3CF] text-[11px] font-bold transition-all disabled:opacity-40"
                  title="Normalize Telemetry"
                >
                  <RotateCcw size={12} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Dedicated Machine Anomaly Simulator */}
        {tab === 'simulate' && (
          <div className="space-y-3">
            <div className="p-3 bg-white border border-[#DDD9D0] rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#2563EB] uppercase tracking-wider">PLANTOPS Failure Library</span>
                <span className="text-[10px] font-mono font-extrabold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                  {scenario.scenarioId}
                </span>
              </div>

              {/* Tier Badge */}
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border"
                  style={{ color: tierInfo.color, background: tierInfo.bg, borderColor: `${tierInfo.color}40` }}
                >
                  {tierInfo.label}
                </span>
                <span className="text-[10px] text-[#64748B] font-medium">{scenario.section}</span>
              </div>

              <div className="font-extrabold text-xs text-[#1E293B]">{scenario.name}</div>
              <p className="text-[11px] text-[#64748B] leading-relaxed">{scenario.description}</p>

              {/* IoT Signature */}
              <div className="p-2 rounded-lg bg-[#FFF7ED] border border-orange-200 space-y-0.5">
                <div className="text-[9px] text-orange-700 uppercase font-bold">🌡️ IoT Sensor Signature (Detected)</div>
                <div className="font-mono font-bold text-xs text-orange-900">{scenario.iotSignature}</div>
              </div>

              {/* Technician Finding */}
              <div className="p-2 rounded-lg bg-[#F0FDF4] border border-emerald-200 space-y-0.5">
                <div className="text-[9px] text-emerald-700 uppercase font-bold">🔧 Technician On-Site Finding</div>
                <div className="text-[11px] text-emerald-900 leading-relaxed">{scenario.technicianFinding}</div>
              </div>

              {/* Part Required */}
              <div className={`p-2 rounded-lg border space-y-0.5 ${
                scenario.requiresPart ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className={`text-[9px] uppercase font-bold ${
                  scenario.requiresPart ? 'text-blue-700' : 'text-slate-500'
                }`}>📦 Spare Part Required</div>
                <div className={`text-[11px] font-semibold ${
                  scenario.requiresPart ? 'text-blue-900' : 'text-slate-500'
                }`}>
                  {scenario.requiresPart ? (scenario.partRequired || 'Yes — part ID in work order') : '✅ No — technician corrects on-site'}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-2 pt-1">
              <button
                onClick={handleInjectFault}
                disabled={simulating || isFault}
                className="w-full py-2.5 text-xs font-bold rounded-xl bg-[#D64545] hover:bg-red-700 text-white shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Activity size={14} />
                {simulating ? 'Starting Degradation...' : isFault ? '⚠️ Anomaly Currently Active' : `▶ Run Scenario on ${machine.code}`}
              </button>

              <button
                onClick={handleNormalize}
                disabled={healing}
                className="w-full py-2 text-xs font-bold rounded-xl bg-[#E8F6EF] hover:bg-emerald-100 text-[#22A06B] border border-[#B4E3CF] transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <RotateCcw size={13} />
                {healing ? 'Normalizing Sensors...' : `Normalize Baseline (${machine.code})`}
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: AI Maintenance Orchestrator */}
        {tab === 'ai' && (
          <div className="space-y-3">
            {incident ? (
              <>
                <div className="p-3 bg-red-50/80 border border-red-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-red-900 text-xs">{incident.id}</span>
                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-red-600 text-white uppercase">IoT Alert</span>
                  </div>
                  <div className="text-xs font-bold text-red-800">{incident.alert_type}</div>
                  <p className="text-[11px] text-red-700 leading-tight">
                    {incident.ai_diagnosis_summary || 'IoT threshold exceeded. Flagged for technician physical inspection.'}
                  </p>
                </div>

                <div className="p-3 bg-white border border-[#DDD9D0] rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#1E293B] flex items-center gap-1.5">
                      <Bot size={14} className="text-[#2563EB]" /> AI Orchestration Dispatch
                    </span>
                    <span className="font-mono font-extrabold text-[#2563EB] text-xs">
                      96% Match
                    </span>
                  </div>
                  <div className="p-2 bg-[#FAF9F6] rounded-lg border border-[#DDD9D0] text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">Assigned Technician:</span>
                      <strong className="text-[#1E293B]">{workOrder?.technician_name || 'Arun Kumar'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">Specialty:</span>
                      <span className="text-[#0F766E] font-semibold">Lead Vibration & Spindle Tech</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">Shift:</span>
                      <span className="text-[#1E293B]">Morning (Available)</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-[#64748B] leading-relaxed">
                    AI matched machine requirements against active technician roster. Technician will perform OSHA LOTO and inspect the machine physically to diagnose the exact root cause.
                  </p>
                </div>

                <div className="p-3 bg-[#FAF9F6] border border-[#DDD9D0] rounded-xl space-y-1.5">
                  <div className="text-[10px] font-bold text-[#64748B] uppercase">Safety Protocol Required</div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#0F766E]">
                    <ShieldCheck size={14} />
                    <span>OSHA 1910.147 LOTO Verification Mandatory</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-[#64748B]">
                <Activity size={28} className="mx-auto mb-2 text-[#22A06B]" />
                <p className="text-xs font-semibold text-[#1E293B]">All Sensor Baselines Nominal</p>
                <p className="text-[10px] text-[#64748B] mt-0.5">Use the Simulate tab to inject an anomaly.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: Work Order & Physical Inspection */}
        {tab === 'wo' && (
          <div className="space-y-3">
            {workOrder ? (
              <>
                <div className="p-3 bg-white border border-[#DDD9D0] rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-[#1E293B]">{workOrder.id}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                      {workOrder.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-[10px] text-[#64748B]">Assigned Tech</span><p className="font-semibold text-[#1E293B]">{workOrder.technician_name || 'Arun Kumar'}</p></div>
                    <div><span className="text-[10px] text-[#64748B]">LOTO Status</span>
                      <p className={`font-bold ${workOrder.loto_applied ? 'text-[#22A06B]' : 'text-[#D64545]'}`}>
                        {workOrder.loto_applied ? '✓ LOTO Verified' : '⚠ Lockout Required'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Step 1: OSHA LOTO */}
                {!workOrder.loto_applied && (
                  <div className="p-3 bg-white border border-[#DDD9D0] rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-bold text-[#0F766E] uppercase tracking-wider flex items-center gap-1">
                        <Lock size={12} /> Step 1: OSHA 1910.147 Isolation
                      </div>
                      <button
                        onClick={handleTechnicianArrive}
                        disabled={arriving}
                        className="text-[10px] font-bold text-[#2563EB] hover:underline"
                      >
                        {arriving ? 'Recording...' : 'Mark Arrived'}
                      </button>
                    </div>
                    <p className="text-[11px] text-[#64748B]">
                      Main electrical breaker and auxiliary pneumatic bleed must be locked out before physical inspection.
                    </p>
                    <button
                      onClick={handleApplyLOTO}
                      disabled={applyingLoto}
                      className="w-full py-2.5 text-xs font-bold rounded-xl bg-[#0F766E] hover:bg-teal-700 text-white shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <ShieldCheck size={14} />
                      {applyingLoto ? 'Applying Padlock Lockout...' : '1. Apply OSHA 1910.147 LOTO'}
                    </button>
                  </div>
                )}

                {/* Step 2: Physical Inspection Form */}
                {workOrder.loto_applied && !inspectionSubmitted && (
                  <div className="p-3 bg-white border border-[#DDD9D0] rounded-xl space-y-2.5 animate-in fade-in">
                    <div className="text-[10px] font-bold text-[#2563EB] uppercase tracking-wider flex items-center gap-1">
                      <Eye size={12} /> Step 2: On-Site Physical Inspection
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-[#64748B] uppercase mb-1">
                        Observed Symptoms
                      </label>
                      <div className="space-y-1">
                        {[
                          'Spindle raceway fluting / abnormal chatter',
                          'Radial / axial runout > 0.05 mm',
                          'Thermal grease oxidation / drying',
                          'Excessive harmonic gear backlash'
                        ].map((sym, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => toggleSymptom(sym)}
                            className={`w-full p-1.5 rounded-lg border text-left text-[11px] flex items-center justify-between transition-all ${
                              selectedSymptoms.includes(sym)
                                ? 'bg-blue-50 border-blue-400 font-bold text-[#1E293B]'
                                : 'bg-[#FAF9F6] border-[#DDD9D0] text-[#64748B]'
                            }`}
                          >
                            <span className="truncate">{sym}</span>
                            {selectedSymptoms.includes(sym) ? <CheckCircle2 size={12} className="text-[#2563EB]" /> : <span className="text-slate-300 text-xs">+</span>}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-[#64748B] uppercase mb-1">
                        Diagnosed Root Cause
                      </label>
                      <input
                        type="text"
                        value={techRootCause}
                        onChange={(e) => setTechRootCause(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-[#FAF9F6] border border-[#DDD9D0] rounded-lg text-xs text-[#1E293B] font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-[#64748B] uppercase mb-1">
                        Spare Part & ATP Check
                      </label>
                      <select
                        value={selectedPartId}
                        onChange={(e) => checkPartATP(e.target.value)}
                        className="w-full px-2 py-1.5 bg-[#FAF9F6] border border-[#DDD9D0] rounded-lg text-xs font-mono"
                      >
                        <option value="PART-SKF-6205">SKF-6205-2RSH Spindle Bearing</option>
                        <option value="PART-FAG-7210">FAG-7210-B Support Bearing</option>
                        <option value="PART-TIMKEN-TAP-01">TIMKEN-32008X Roller Bearing</option>
                        <option value="PART-HYD-SEAL-01">PARKER-V884 Seal Kit</option>
                      </select>
                    </div>

                    <button
                      onClick={handleSubmitPhysicalInspection}
                      disabled={submittingInspection || selectedSymptoms.length === 0}
                      className="w-full py-2 text-xs font-bold rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      <Package size={13} />
                      {submittingInspection ? 'Allocating Part...' : '2. Submit Diagnosis & Allocate Part'}
                    </button>
                  </div>
                )}

                {/* Step 3: Repair & Verification Trigger */}
                {workOrder.loto_applied && inspectionSubmitted && (
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2 animate-in fade-in">
                    <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                      <CheckCircle2 size={12} /> Step 3: Repair Execution & IoT Verification
                    </div>
                    <p className="text-[11px] text-[#64748B]">
                      Component replaced. Trigger autonomous 10s sensor check to verify baseline recovery.
                    </p>
                    <button
                      onClick={handleComplete}
                      disabled={completing}
                      className="w-full py-2.5 text-xs font-bold rounded-xl bg-[#22A06B] hover:bg-emerald-700 text-white shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 size={14} />
                      {completing ? 'Verifying 10s Baseline...' : '3. Complete Repair & Verify Baseline'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-[#64748B]">
                <ClipboardList size={28} className="mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-semibold text-[#1E293B]">No Active Work Order</p>
                <p className="text-[10px] text-[#64748B] mt-0.5">Work order is auto-dispatched upon anomaly detection.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: Incident Timeline */}
        {tab === 'timeline' && (
          <div className="space-y-3">
            {incident ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1">
                    <Clock size={12} className="text-[#2563EB]" /> Event Timeline
                  </span>
                  <span className="font-mono text-[10px] text-[#2563EB] font-bold">{incident.id}</span>
                </div>

                {timelineLoading ? (
                  <div className="text-center py-6 text-[#64748B] text-[11px]">Loading events...</div>
                ) : timelineEvents.length === 0 ? (
                  <div className="text-center py-6 text-[#64748B]">
                    <Clock size={24} className="mx-auto mb-2 text-slate-300" />
                    <p className="text-xs font-semibold">No events recorded yet</p>
                    <p className="text-[10px] mt-0.5">Events appear as the incident progresses</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {timelineEvents.map((evt: any, i: number) => {
                      const icons: Record<string, string> = {
                        FAULT_DETECTED: '🔴', INCIDENT_CREATED: '📋', ASSIGNMENT_STARTED: '🤖',
                        TECHNICIAN_ASSIGNED: '👤', TECHNICIAN_DISPATCHED: '🏃', TECHNICIAN_ARRIVED: '📍',
                        LOTO_STARTED: '🔒', LOTO_COMPLETED: '✅', MAINTENANCE_STARTED: '🔧',
                        INSPECTION_STARTED: '🔍', ROOT_CAUSE_CONFIRMED: '🎯', PART_REQUESTED: '📦',
                        PART_ALLOCATED: '✅', REPAIR_STARTED: '🔩', REPAIR_COMPLETED: '✔️',
                        VERIFICATION_STARTED: '📡', VERIFICATION_PASSED: '✅', MACHINE_RUNNING: '🟢',
                        INCIDENT_RESOLVED: '🎉',
                      };
                      const icon = icons[evt.event_type] || '⚬';
                      const ts = new Date(evt.event_ts_utc);
                      const timeStr = ts.toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
                      const isLast = i === timelineEvents.length - 1;
                      return (
                        <div key={evt.id} className="flex gap-2">
                          <div className="flex flex-col items-center">
                            <div className="w-6 h-6 rounded-full bg-[#F3F1EC] border border-[#DDD9D0] flex items-center justify-center text-[10px] flex-shrink-0">
                              {icon}
                            </div>
                            {!isLast && <div className="w-px flex-1 bg-[#DDD9D0] mt-0.5" />}
                          </div>
                          <div className="pb-2 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-extrabold text-[#1E293B] break-all">
                                {evt.event_type.replace(/_/g, ' ')}
                              </span>
                            </div>
                            <div className="text-[10px] text-[#64748B]">{timeStr}</div>
                            {evt.actor_id && (
                              <div className="text-[10px] text-[#2563EB] font-medium truncate">{evt.actor_id}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Downtime Summary */}
                {incident.downtime_seconds != null && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                    <div className="text-[9px] font-bold text-amber-700 uppercase">⏱️ Total Downtime</div>
                    <div className="font-mono font-extrabold text-base text-amber-900">
                      {Math.floor((incident.downtime_seconds || 0) / 60).toString().padStart(2,'0')}:{((incident.downtime_seconds || 0) % 60).toFixed(1).padStart(4,'0')}
                    </div>
                    <div className="text-[10px] text-amber-700">Fault detected → Machine running</div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-[#64748B]">
                <Clock size={28} className="mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-semibold text-[#1E293B]">No Active Incident</p>
                <p className="text-[10px] mt-0.5">Timeline appears once a fault is detected on this machine.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Field Technician Workstation Right-Side Drawer Component
// ─────────────────────────────────────────────────────────────────────────────
interface WorkstationDrawerProps {
  machine: Machine;
  telemetry?: TelemetryData;
  incident?: Incident;
  workOrder?: WorkOrder;
  onClose: () => void;
  onSwitchToMachineSpecs: () => void;
  onRefresh: () => void;
  onDispatchTechnician?: (code: string | null) => void;
}

const FieldTechnicianWorkstationDrawer: React.FC<WorkstationDrawerProps> = ({
  machine,
  telemetry,
  incident,
  workOrder,
  onClose,
  onSwitchToMachineSpecs,
  onRefresh,
  onDispatchTechnician,
}) => {
  const scenario = getScenario(machine.code);
  const lotoProtocol = LOTO_PROTOCOLS[machine.type] || LOTO_PROTOCOLS.CNC;
  const woId = workOrder?.id || `WO-1082`;
  const techSignName = workOrder?.technician_name || 'Frank Moore (Maintenance Specialist)';

  // The backend work order (technician_phase, loto_applied) is authoritative —
  // reconstruct the wizard's step from it instead of always starting at Phase
  // 1. Without this, closing and reopening the workstation (or navigating away
  // and back) silently reset an in-progress INSPECTING/REPAIRING work order
  // back to "Phase 1 — LOTO" in the UI even though the backend, the 3D label,
  // and the Dashboard all correctly still show the real in-progress state.
  const ARRIVED_OR_LATER = new Set(['ARRIVED', 'LOTO', 'INSPECTING', 'WAITING_PARTS', 'REPAIRING', 'VERIFYING', 'RETURNING', 'COMPLETED']);
  const LOTO_DONE_OR_LATER = new Set(['INSPECTING', 'WAITING_PARTS', 'REPAIRING', 'VERIFYING', 'RETURNING', 'COMPLETED']);
  const INSPECTION_DONE_OR_LATER = new Set(['WAITING_PARTS', 'REPAIRING', 'VERIFYING', 'RETURNING', 'COMPLETED']);
  const phase = workOrder?.technician_phase || '';
  const initialHasArrived = Boolean(workOrder?.loto_applied) || ARRIVED_OR_LATER.has(phase);
  const initialLotoApplied = Boolean(workOrder?.loto_applied) || LOTO_DONE_OR_LATER.has(phase);
  const initialInspectionSubmitted = INSPECTION_DONE_OR_LATER.has(phase);
  const initialActivePhase: 1 | 2 | 3 | 4 = initialInspectionSubmitted ? 3 : initialLotoApplied ? 2 : 1;

  // Stepper State
  const [activePhase, setActivePhase] = useState<1 | 2 | 3 | 4>(initialActivePhase);
  const [arrivingOnSite, setArrivingOnSite] = useState(false);
  const [hasArrived, setHasArrived] = useState(initialHasArrived);

  // Phase 4: AI SOP Assistant & RAG Knowledge Base
  const [sopQuestion, setSopQuestion] = useState('');
  const [sopAnswer, setSopAnswer] = useState<any>(null);
  const [loadingSop, setLoadingSop] = useState(false);
  const [sopsList, setSopsList] = useState<any[]>([]);

  useEffect(() => {
    api.getSOPs(machine.type)
      .then((res) => { if (res.success && res.sops) setSopsList(res.sops); })
      .catch(() => {});
  }, [machine.type]);

  const handleAskSop = async (q?: string) => {
    const query = (q !== undefined ? q : sopQuestion).trim();
    if (!query) return;
    setLoadingSop(true);
    try {
      const res = await api.askSOP(query, machine.type);
      if (res.success && res.data) {
        setSopAnswer(res.data);
      }
    } catch {
      // fallback
    } finally {
      setLoadingSop(false);
    }
  };

  // Phase 1: LOTO
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({
    [lotoProtocol.isolationSteps[0]?.id || 'cnc-1']: true,
  });
  const [padlockId, setPadlockId] = useState('PL-8894-LOTO');
  const [voltageReading, setVoltageReading] = useState('0.0');
  const [pressureReading, setPressureReading] = useState('0.0');
  const [executingLoto, setExecutingLoto] = useState(false);
  const [lotoApplied, setLotoApplied] = useState(initialLotoApplied);

  // Phase 2: Inspection & ATP
  const availableSymptoms = [
    'Abnormal spindle vibration & acoustic chatter',
    'Excessive radial shaft play & runout (>25µm)',
    'Elevated motor stator temperature rise',
    'Pneumatic manifold pressure fluctuation',
    'High harmonic frequency spikes on FFT'
  ];
  const [symptoms, setSymptoms] = useState<string[]>([availableSymptoms[0], availableSymptoms[1]]);
  const [techRootCause, setTechRootCause] = useState(scenario.technicianFinding || 'Spindle raceway EDM fluting due to bearing current leakage');
  const [selectedPartId, setSelectedPartId] = useState('PART-SKF-6205');
  const [selectedQty, setSelectedQty] = useState(1);
  const [atpStatus, setAtpStatus] = useState<any>({ atp: 7, binLocation: 'BAY-A-04' });
  const [scanningPart, setScanningPart] = useState(false);
  const [partScanned, setPartScanned] = useState(false);
  const [submittingInspection, setSubmittingInspection] = useState(false);
  const [inspectionSubmitted, setInspectionSubmitted] = useState(initialInspectionSubmitted);

  // Phase 3: Repair & Verification
  const [completingRepair, setCompletingRepair] = useState(false);
  const [verificationCountdown, setVerificationCountdown] = useState<number | null>(null);
  const [repairSuccess, setRepairSuccess] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    api.checkATP(selectedPartId)
      .then((res) => { if (res.success && res.data) setAtpStatus(res.data); })
      .catch(() => {});
  }, [selectedPartId]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const toggleStep = (id: string) => {
    setCheckedSteps((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSymptom = (sym: string) => {
    setSymptoms((prev) =>
      prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym]
    );
  };

  const allStepsChecked = lotoProtocol.isolationSteps.every((s) => checkedSteps[s.id]);

  const handleTechnicianArrive = async () => {
    setArrivingOnSite(true);
    try {
      if (workOrder?.id) {
        await api.markTechnicianArrived(workOrder.id, techSignName);
      }
      setHasArrived(true);
      showToast(`📍 Technician ${techSignName} registered on-site at ${machine.code}.`);
      onRefresh();
    } catch {
      setHasArrived(true);
      showToast(`📍 Technician arrived on site.`);
    } finally {
      setArrivingOnSite(false);
    }
  };

  const handleApplyLOTO = async () => {
    setExecutingLoto(true);
    try {
      const confirmed = Object.keys(checkedSteps).filter((k) => checkedSteps[k]);
      if (workOrder?.id) {
        await api.applyLOTO(workOrder.id, techSignName, {
          padlockId,
          voltageReading: parseFloat(voltageReading) || 0.0,
          pressureReading: parseFloat(pressureReading) || 0.0,
          isolationPointsConfirmed: confirmed,
        });
      }
      setLotoApplied(true);
      setActivePhase(2);
      showToast(`🔒 OSHA 1910.147 LOTO verified (Padlock #${padlockId}). Zero Energy State established.`);
      onRefresh();
    } catch {
      setLotoApplied(true);
      setActivePhase(2);
      showToast(`🔒 OSHA 1910.147 LOTO applied.`);
    } finally {
      setExecutingLoto(false);
    }
  };

  const handleSimulateScanPart = () => {
    setScanningPart(true);
    setTimeout(() => {
      setScanningPart(false);
      setPartScanned(true);
      showToast(`🔍 Barcode scan verified: ${selectedPartId} matches Work Order requisition from Bin ${atpStatus?.binLocation || 'BAY-A-04'}.`);
    }, 700);
  };

  const handleSubmitPhysicalInspection = async () => {
    setSubmittingInspection(true);
    try {
      if (workOrder?.id) {
        await api.submitInspection(workOrder.id, {
          technicianName: techSignName,
          symptomsObserved: symptoms,
          technicianRootCause: techRootCause,
          requiredPartId: selectedPartId,
          quantity: selectedQty,
        });
      }
      setInspectionSubmitted(true);
      setActivePhase(3);
      showToast(`✅ Physical inspection recorded & spare part reserved via ATP.`);
      onRefresh();
    } catch {
      setInspectionSubmitted(true);
      setActivePhase(3);
      showToast(`✅ Physical inspection recorded.`);
    } finally {
      setSubmittingInspection(false);
    }
  };

  const handleCompleteRepair = async () => {
    setCompletingRepair(true);
    try {
      await api.healMachine(machine.code);
      if (workOrder?.id) {
        await api.completeRepair(workOrder.id, techSignName);
      }
      // Autonomous 10-second verification countdown
      setVerificationCountdown(10);
      const interval = setInterval(() => {
        setVerificationCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(interval);
            setRepairSuccess(true);
            setCompletingRepair(false);
            onDispatchTechnician?.(null);
            onRefresh();
            showToast(`🎉 Verification Complete! ${machine.code} restored to RUNNING (100% nominal baselines).`);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch {
      setCompletingRepair(false);
      onDispatchTechnician?.(null);
      showToast(`Repair verified & machine running.`);
      onRefresh();
    }
  };

  return (
    <div className="absolute right-4 top-4 bottom-4 w-[420px] min-w-[390px] max-w-[440px] bg-[#FAF9F6]/98 backdrop-blur-xl border border-[#DDD9D0] rounded-2xl flex flex-col shadow-2xl overflow-hidden z-50 animate-fade-in">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="absolute top-14 left-4 right-4 z-50 bg-[#0F766E] text-white px-3 py-2 rounded-xl shadow-xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={14} className="flex-shrink-0" />
          <span className="truncate">{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#DDD9D0] bg-white/95 flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#0F766E]/10 border border-[#0F766E]/20 flex items-center justify-center text-[#0F766E] flex-shrink-0">
            <HardHat size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-xs text-[#1E293B]">Field Workstation</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-[#2563EB] font-mono">
                {woId}
              </span>
            </div>
            <div className="text-[10px] text-[#64748B] truncate font-medium">
              Asset: <strong className="text-[#1E293B]">{machine.code}</strong> • Tech: <strong className="text-[#1E293B]">{techSignName.split(' ')[0]}</strong>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={onSwitchToMachineSpecs}
            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-[#1E293B] border border-[#DDD9D0] rounded-lg text-[10px] font-bold transition-all flex items-center gap-1"
            title="Switch back to Machine Details"
          >
            <Activity size={12} className="text-[#2563EB]" />
            <span>Telemetry</span>
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#EAE7E0] text-[#64748B] transition-colors"
            title="Close Workstation"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Arrival & On-Site Banner */}
      <div className="bg-slate-50 px-4 py-2 border-b border-[#DDD9D0] flex items-center justify-between text-xs flex-shrink-0">
        <div className="flex items-center gap-1.5 text-[#334155] text-[11px]">
          <MapPin size={12} className="text-[#2563EB] flex-shrink-0" />
          <span className="truncate">Station: <strong>{lotoProtocol.lockoutBoxLocation}</strong></span>
        </div>
        <button
          type="button"
          onClick={handleTechnicianArrive}
          disabled={arrivingOnSite || hasArrived}
          className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1 ${
            hasArrived
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : 'bg-white hover:bg-slate-100 text-[#1E293B] border-[#DDD9D0]'
          }`}
        >
          <UserCheck size={11} className={hasArrived ? 'text-[#22A06B]' : 'text-slate-500'} />
          <span>{hasArrived ? 'On Site' : arrivingOnSite ? 'Arriving...' : 'Mark Arrived'}</span>
        </button>
      </div>

      {/* Stepper Navigation */}
      <div className="grid grid-cols-4 gap-1 p-2.5 bg-white/60 border-b border-[#DDD9D0] flex-shrink-0">
        <button
          onClick={() => setActivePhase(1)}
          className={`p-1 rounded-xl border text-center transition-all ${
            lotoApplied
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : activePhase === 1
              ? 'bg-blue-50 border-blue-400 text-blue-800 font-bold'
              : 'bg-slate-50 border-slate-200 text-slate-500'
          }`}
        >
          <div className="text-[8px] uppercase font-bold">Phase 1</div>
          <div className="text-[9px] font-extrabold flex items-center justify-center gap-0.5">
            {lotoApplied ? <CheckCircle2 size={10} className="text-emerald-600" /> : <Lock size={10} />}
            <span>LOTO</span>
          </div>
        </button>

        <button
          onClick={() => lotoApplied && setActivePhase(2)}
          disabled={!lotoApplied}
          className={`p-1 rounded-xl border text-center transition-all ${
            !lotoApplied
              ? 'bg-slate-50 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
              : inspectionSubmitted
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : activePhase === 2
              ? 'bg-amber-50 border-amber-400 text-amber-900 font-bold'
              : 'bg-slate-50 border-slate-200 text-slate-600'
          }`}
        >
          <div className="text-[8px] uppercase font-bold">Phase 2</div>
          <div className="text-[9px] font-extrabold flex items-center justify-center gap-0.5">
            {inspectionSubmitted ? <CheckCircle2 size={10} className="text-emerald-600" /> : <Eye size={10} />}
            <span>Inspect</span>
          </div>
        </button>

        <button
          onClick={() => inspectionSubmitted && setActivePhase(3)}
          disabled={!inspectionSubmitted}
          className={`p-1 rounded-xl border text-center transition-all ${
            !inspectionSubmitted
              ? 'bg-slate-50 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
              : repairSuccess
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : activePhase === 3
              ? 'bg-indigo-50 border-indigo-400 text-indigo-900 font-bold'
              : 'bg-slate-50 border-slate-200 text-slate-600'
          }`}
        >
          <div className="text-[8px] uppercase font-bold">Phase 3</div>
          <div className="text-[9px] font-extrabold flex items-center justify-center gap-0.5">
            {repairSuccess ? <CheckCircle2 size={10} className="text-emerald-600" /> : <ShieldCheck size={10} />}
            <span>Repair</span>
          </div>
        </button>

        <button
          onClick={() => setActivePhase(4)}
          className={`p-1 rounded-xl border text-center transition-all ${
            activePhase === 4
              ? 'bg-purple-50 border-purple-400 text-purple-900 font-bold'
              : 'bg-slate-50 border-slate-200 text-slate-600'
          }`}
        >
          <div className="text-[8px] uppercase font-bold">RAG SOP</div>
          <div className="text-[9px] font-extrabold flex items-center justify-center gap-0.5">
            <Bot size={10} className="text-purple-600" />
            <span>AI Manual</span>
          </div>
        </button>
      </div>

      {/* Scrollable Workstation Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* ── PHASE 1: OSHA 1910.147 LOTO ── */}
        {activePhase === 1 && (
          <div className="space-y-3.5 animate-in fade-in">
            <div className="flex items-center justify-between pb-1.5 border-b border-[#DDD9D0]">
              <span className="text-xs font-bold text-[#1E293B] flex items-center gap-1.5">
                <Lock size={13} className="text-[#0F766E]" />
                1. Machine Energy Isolation Checklist
              </span>
              {lotoApplied && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                  <Check size={10} /> Locked Out
                </span>
              )}
            </div>

            {/* Mandatory PPE */}
            <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1.5">
              <div className="font-bold text-[10px] text-amber-900 uppercase tracking-wider flex items-center gap-1">
                <AlertOctagon size={12} className="text-amber-700" /> Mandatory PPE Requirements
              </div>
              <div className="flex flex-wrap gap-1">
                {lotoProtocol.requiredPpe.map((ppe, i) => (
                  <span key={i} className="px-2 py-0.5 bg-white border border-amber-200 rounded text-[10px] text-amber-900 font-medium">
                    {ppe}
                  </span>
                ))}
              </div>
            </div>

            {/* Isolation Steps */}
            <div className="space-y-2">
              {lotoProtocol.isolationSteps.map((step) => {
                const isChecked = !!checkedSteps[step.id];
                return (
                  <div
                    key={step.id}
                    onClick={() => !lotoApplied && toggleStep(step.id)}
                    className={`p-2.5 rounded-xl border transition-all flex items-start gap-2.5 ${
                      lotoApplied
                        ? 'bg-emerald-50/50 border-emerald-200 cursor-default'
                        : isChecked
                        ? 'bg-emerald-50/70 border-emerald-400 cursor-pointer'
                        : 'bg-white border-[#DDD9D0] hover:border-slate-400 cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked || lotoApplied}
                      disabled={lotoApplied}
                      onChange={() => {}}
                      className="mt-0.5 rounded text-[#0F766E] pointer-events-none"
                    />
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <strong className="text-[11px] text-[#1E293B] truncate">{step.title}</strong>
                        <span className="text-[8px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-200 text-[#1E293B] flex-shrink-0">
                          {step.category}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#64748B] leading-tight">{step.procedure}</p>
                      <div className="text-[9px] font-semibold text-[#0F766E] pt-0.5">
                        Target: {step.targetZeroState}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Verification Inputs */}
            {!lotoApplied ? (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-[#64748B] uppercase mb-1 flex items-center gap-1">
                      <Lock size={10} /> Padlock Serial
                    </label>
                    <input
                      type="text"
                      value={padlockId}
                      onChange={(e) => setPadlockId(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#DDD9D0] rounded-xl text-xs font-mono font-bold text-[#1E293B]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#64748B] uppercase mb-1 flex items-center gap-1">
                      <Zap size={10} className="text-amber-500" /> Voltage (VAC)
                    </label>
                    <input
                      type="text"
                      value={voltageReading}
                      onChange={(e) => setVoltageReading(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#DDD9D0] rounded-xl text-xs font-mono font-bold text-[#1E293B]"
                      placeholder="0.0"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <span className="text-[10px] text-[#64748B]">
                    Lead Tech: <strong>{techSignName.split(' ')[0]}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={handleApplyLOTO}
                    disabled={!allStepsChecked || executingLoto}
                    className="px-4 py-2 bg-[#0F766E] hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Lock size={12} />
                    <span>{executingLoto ? 'Locking Out...' : 'Apply & Verify OSHA LOTO'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[#64748B]">Padlock Serial:</span>
                  <strong className="font-mono text-[#1E293B]">{padlockId}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#64748B]">Zero-Energy Measurements:</span>
                  <span className="text-emerald-700 font-bold font-mono">0.0 VAC / 0.0 bar (Confirmed)</span>
                </div>
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setActivePhase(2)}
                    className="px-3 py-1.5 bg-[#2563EB] text-white rounded-xl text-xs font-bold flex items-center gap-1"
                  >
                    <span>Proceed to Phase 2 (Inspection)</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PHASE 2: PHYSICAL INSPECTION & ATP SPARE PARTS ── */}
        {activePhase === 2 && (
          <div className="space-y-3.5 animate-in fade-in">
            <div className="flex items-center justify-between pb-1.5 border-b border-[#DDD9D0]">
              <span className="text-xs font-bold text-[#1E293B] flex items-center gap-1.5">
                <Eye size={13} className="text-[#2563EB]" />
                2. On-Site Inspection & Spare Parts Requisition
              </span>
              {inspectionSubmitted && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  ✓ Requisitioned
                </span>
              )}
            </div>

            {!inspectionSubmitted ? (
              <div className="space-y-3">
                {/* Symptoms Observed */}
                <div>
                  <label className="block text-[10px] font-bold text-[#64748B] uppercase mb-1.5">
                    Observed Physical Symptoms
                  </label>
                  <div className="space-y-1.5">
                    {availableSymptoms.map((sym, idx) => {
                      const isSelected = symptoms.includes(sym);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => toggleSymptom(sym)}
                          className={`w-full p-2 rounded-xl border text-left text-[11px] transition-all flex items-center justify-between ${
                            isSelected
                              ? 'bg-blue-50 border-blue-400 text-[#1E293B] font-bold'
                              : 'bg-white border-[#DDD9D0] text-[#64748B] hover:border-slate-400'
                          }`}
                        >
                          <span className="truncate pr-1">{sym}</span>
                          {isSelected ? <CheckCircle2 size={12} className="text-[#2563EB] flex-shrink-0" /> : <Plus size={12} className="text-slate-400 flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Root Cause input */}
                <div>
                  <label className="block text-[10px] font-bold text-[#64748B] uppercase mb-1">
                    Confirmed Physical Root Cause
                  </label>
                  <input
                    type="text"
                    value={techRootCause}
                    onChange={(e) => setTechRootCause(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#DDD9D0] rounded-xl text-xs text-[#1E293B] font-semibold"
                    placeholder="e.g. Spindle raceway EDM fluting due to bearing current leakage"
                  />
                </div>

                {/* Replacement Part & Qty */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-[#64748B] uppercase mb-1">
                      Replacement Part
                    </label>
                    <select
                      value={selectedPartId}
                      onChange={(e) => setSelectedPartId(e.target.value)}
                      className="w-full px-2.5 py-2 bg-white border border-[#DDD9D0] rounded-xl text-xs text-[#1E293B] font-mono font-semibold"
                    >
                      <option value="PART-SKF-6205">SKF-6205-2RSH — Deep Groove Bearing</option>
                      <option value="PART-FAG-7210">FAG-7210-B-TVP — Angular Contact Bearing</option>
                      <option value="PART-TIMKEN-TAP-01">TIMKEN-32008X — Tapered Roller</option>
                      <option value="PART-HYD-SEAL-01">PARKER-V884 — Fluorocarbon Seal Kit</option>
                      <option value="PART-FANUC-SV-03">FANUC-A06B — AC Servo Motor</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#64748B] uppercase mb-1">
                      Qty
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={selectedQty}
                      onChange={(e) => setSelectedQty(parseInt(e.target.value) || 1)}
                      className="w-full px-2.5 py-2 bg-white border border-[#DDD9D0] rounded-xl text-xs text-[#1E293B] font-bold text-center"
                    />
                  </div>
                </div>

                {/* ATP Stock & Barcode Scanner */}
                <div className="bg-white p-3 rounded-xl border border-[#DDD9D0] flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] text-[#64748B]">
                      Warehouse Stock: <strong className="text-[#22A06B] font-mono">{atpStatus?.atp ?? 6} Available</strong>
                    </div>
                    <div className="text-[10px] text-[#64748B]">
                      Bin Location: <strong className="text-[#1E293B] font-mono">{atpStatus?.binLocation || 'BAY-A-04'}</strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSimulateScanPart}
                    disabled={scanningPart || partScanned}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 ${
                      partScanned
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-slate-50 hover:bg-slate-100 text-[#1E293B] border-[#DDD9D0]'
                    }`}
                  >
                    {partScanned ? <CheckCircle2 size={12} className="text-emerald-600" /> : <QrCode size={12} />}
                    <span>{scanningPart ? 'Scanning...' : partScanned ? 'Barcode Verified' : 'Scan Bin Barcode'}</span>
                  </button>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSubmitPhysicalInspection}
                    disabled={submittingInspection || symptoms.length === 0}
                    className="px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Send size={12} />
                    <span>{submittingInspection ? 'Submitting...' : 'Submit Inspection & Reserve Part'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[#64748B]">Diagnosed Root Cause:</span>
                  <strong className="text-[#1E293B] text-right truncate max-w-[200px]">{techRootCause}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#64748B]">Allocated Part:</span>
                  <span className="font-mono text-emerald-800 font-bold">{selectedQty}x {selectedPartId} (Reserved)</span>
                </div>
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setActivePhase(3)}
                    className="px-3 py-1.5 bg-[#0F766E] text-white rounded-xl text-xs font-bold flex items-center gap-1"
                  >
                    <span>Proceed to Phase 3 (Repair & Run)</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PHASE 3: COMPONENT REPLACEMENT & RUN-IN VERIFICATION ── */}
        {activePhase === 3 && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between pb-1.5 border-b border-[#DDD9D0]">
              <span className="text-xs font-bold text-[#1E293B] flex items-center gap-1.5">
                <ShieldCheck size={13} className="text-[#22A06B]" />
                3. Component Replacement & Run-In Verification
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                Final Step
              </span>
            </div>

            <div className="p-3 bg-white rounded-xl border border-[#DDD9D0] space-y-2">
              <p className="text-[11px] text-[#64748B] leading-relaxed">
                Component replacement has been executed by certified technician <strong>{techSignName}</strong>. 
                Triggering autonomous verification will:
              </p>
              <ul className="text-[11px] text-[#334155] space-y-1 list-disc list-inside">
                <li>Remove the OSHA 1910.147 LOTO padlock</li>
                <li>Clear telemetry anomaly and normalize baseline sensors</li>
                <li>Execute a 10-second autonomous edge verification cycle</li>
                <li>Return machine status to <strong>RUNNING</strong> with green beacon</li>
              </ul>
            </div>

            {verificationCountdown !== null && verificationCountdown > 0 && (
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-center space-y-2">
                <div className="text-xs font-extrabold text-indigo-900 flex items-center justify-center gap-2">
                  <Activity size={16} className="animate-spin text-indigo-600" />
                  <span>Autonomous Sensor Baseline Verification In Progress...</span>
                </div>
                <div className="text-2xl font-black font-mono text-indigo-700">
                  {verificationCountdown}s
                </div>
                <div className="w-full bg-indigo-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full transition-all duration-1000"
                    style={{ width: `${((10 - verificationCountdown) / 10) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {repairSuccess && (
              <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-xl text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-600 mx-auto">
                  <Check size={20} />
                </div>
                <div className="text-sm font-extrabold text-emerald-900">
                  {machine.code} Restored to RUNNING Status!
                </div>
                <p className="text-[11px] text-emerald-700">
                  All telemetry sensors are nominal (Health: 100%). Dispatched technician returned to dispatch base.
                </p>
              </div>
            )}

            {!repairSuccess && verificationCountdown === null && (
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleCompleteRepair}
                  disabled={completingRepair}
                  className="w-full py-3 bg-[#22A06B] hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <PlayCircle size={15} />
                  <span>{completingRepair ? 'Initializing Baseline Verification...' : 'Complete Physical Repair & Trigger Verification'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── PHASE 4: AI SOP ASSISTANT & OEM MANUALS (PGVECTOR / RAG) ── */}
        {activePhase === 4 && (
          <div className="space-y-3.5 animate-in fade-in">
            <div className="flex items-center justify-between pb-1.5 border-b border-[#DDD9D0]">
              <span className="text-xs font-bold text-[#1E293B] flex items-center gap-1.5">
                <Bot size={13} className="text-purple-600" />
                AI SOP & OEM Engineering Assistant
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                RAG Active
              </span>
            </div>

            {/* Natural Language Query Input */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-[#64748B] uppercase">
                Search SOP / Ask Engineering Spec
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={sopQuestion}
                  onChange={(e) => setSopQuestion(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAskSop(); }}
                  placeholder="e.g. Torque spec for spindle bearing locknut..."
                  className="flex-1 px-3 py-1.5 bg-white border border-[#DDD9D0] rounded-xl text-xs text-[#1E293B] focus:outline-none focus:border-purple-500"
                />
                <button
                  type="button"
                  onClick={() => handleAskSop()}
                  disabled={loadingSop || !sopQuestion.trim()}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1 flex-shrink-0"
                >
                  <Sparkles size={12} />
                  <span>{loadingSop ? 'Querying...' : 'Ask'}</span>
                </button>
              </div>
            </div>

            {/* Quick Question Chips */}
            <div className="space-y-1">
              <span className="text-[10px] text-[#64748B] font-medium">Quick Spec Lookups:</span>
              <div className="flex flex-wrap gap-1">
                {[
                  'What is the spindle locknut torque spec?',
                  'What are the OSHA 1910.147 zero energy targets?',
                  'What grease is used for robot harmonic joints?',
                  'What is the pump impeller clearance?'
                ].map((q, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setSopQuestion(q);
                      handleAskSop(q);
                    }}
                    className="px-2 py-1 bg-white hover:bg-purple-50 border border-[#DDD9D0] hover:border-purple-300 rounded-lg text-[10px] text-[#334155] text-left transition-all"
                  >
                    💡 {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Answer Card */}
            {sopAnswer && (
              <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2.5 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-200 text-purple-900 font-mono">
                      {sopAnswer.matchedSop?.code || 'SOP-DOC'}
                    </span>
                    <strong className="text-[11px] text-[#1E293B]">{sopAnswer.matchedSop?.section}</strong>
                  </div>
                  <span className="text-[9px] font-bold text-emerald-700">
                    {(sopAnswer.confidence * 100).toFixed(0)}% Match
                  </span>
                </div>

                <div className="text-[11px] text-[#334155] whitespace-pre-line leading-relaxed">
                  {sopAnswer.answer}
                </div>

                {sopAnswer.relevantSpecs && Object.keys(sopAnswer.relevantSpecs).length > 0 && (
                  <div className="pt-1 grid grid-cols-2 gap-1.5">
                    {Object.entries(sopAnswer.relevantSpecs).map(([k, v]: [string, any], idx) => (
                      <div key={idx} className="p-1.5 bg-white border border-purple-200 rounded-lg">
                        <div className="text-[9px] text-[#64748B] font-bold uppercase">{k}</div>
                        <div className="text-[10px] text-purple-900 font-mono font-extrabold">{v}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Available Machine SOPs */}
            <div className="space-y-1.5 pt-1">
              <div className="text-[10px] font-bold text-[#64748B] uppercase">
                Active Procedures for {machine.type}
              </div>
              {sopsList.map((sop: any) => (
                <div key={sop.id} className="p-2.5 bg-white border border-[#DDD9D0] rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <strong className="text-[11px] text-[#1E293B]">{sop.title}</strong>
                    <span className="text-[9px] font-mono font-bold text-slate-500">{sop.revision}</span>
                  </div>
                  <div className="text-[10px] text-[#64748B]">Subsystem: {sop.subsystem}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 bg-white border-t border-[#DDD9D0] flex items-center justify-between text-[11px] text-[#64748B] flex-shrink-0">
        <span>OSHA 1910.147 & ATP Deterministic Control</span>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-[#1E293B] rounded-lg text-[11px] font-bold transition-all border border-[#DDD9D0]"
        >
          Close
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Interactive 2D Minimap Widget (Requirement 13)
// ─────────────────────────────────────────────────────────────────────────────
const FactoryMinimap: React.FC<{
  machines: Machine[];
  selectedMachine: Machine | null;
  onSelect: (m: Machine) => void;
  selectedZoneId?: ZoneId | null;
  onSelectZone?: (zoneId: ZoneId) => void;
  dispatchedTarget?: string | null;
  viewLevel?: ViewLevel;
}> = ({ machines, selectedMachine, onSelect, selectedZoneId = null, onSelectZone, dispatchedTarget = null, viewLevel = 'PLANT' }) => {
  const [collapsed, setCollapsed] = useState(false);

  const allDots = [
    // Machining (top-left zone ~8–30% x, 15–45% y)
    { code: 'CNC-01',   x: 8,  y: 20 }, { code: 'CNC-02', x: 14, y: 20 }, { code: 'CNC-03', x: 20, y: 20 },
    { code: 'CNC-04',   x: 8,  y: 35 }, { code: 'CNC-05', x: 14, y: 35 }, { code: 'CNC-06', x: 20, y: 35 },
    // Robot (center-top zone ~37–60% x)
    { code: 'ROBOT-01', x: 37, y: 20 }, { code: 'ROBOT-02', x: 46, y: 20 },
    { code: 'ROBOT-03', x: 37, y: 35 }, { code: 'ROBOT-04', x: 46, y: 35 },
    // Processing (top-right zone ~65–92% x)
    { code: 'MIXER-01',   x: 64, y: 20 }, { code: 'PUMP-01', x: 74, y: 20 }, { code: 'PRESS-01', x: 84, y: 20 },
    { code: 'PROCESS-01', x: 64, y: 35 }, { code: 'PROCESS-02', x: 74, y: 35 },
    // Assembly (bottom-left ~8–30%, spread to fill the zone like Machining)
    { code: 'ASMB-01', x: 8,  y: 62 }, { code: 'ASMB-02', x: 22, y: 62 },
    { code: 'ASMB-03', x: 8,  y: 78 }, { code: 'ASMB-04', x: 22, y: 78 },
    // Packaging (center-bottom ~37–60%)
    { code: 'PACK-01', x: 37, y: 62 }, { code: 'PACK-02', x: 46, y: 62 }, { code: 'PACK-03', x: 42, y: 78 },
    // Maintenance (bottom-right ~65–92%)
    { code: 'BENCH-01', x: 64, y: 62 }, { code: 'BENCH-02', x: 76, y: 62 }, { code: 'TEST-01', x: 70, y: 78 },
  ];

  // Inside a building, the minimap shows only that building's machines —
  // it should not read as if the other interiors were part of it.
  const dots = viewLevel === 'INTERIOR' && selectedZoneId
    ? allDots.filter((d) => zoneIdForMachineCode(d.code) === selectedZoneId)
    : allDots;

  const machineByCode = useMemo(() => {
    const map: Record<string, Machine> = {};
    machines.forEach((m) => { map[m.code] = m; });
    return map;
  }, [machines]);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-md border border-[#DDD9D0] rounded-xl px-3 py-1.5 text-xs font-bold text-[#1E293B] shadow-md flex items-center gap-1.5 hover:bg-[#EAE7E0] transition-all"
      >
        <Map size={13} className="text-[#2563EB]" /> Minimap
      </button>
    );
  }

  return (
    <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-md border border-[#DDD9D0] rounded-2xl p-3 shadow-xl w-52 select-none">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1">
          <Compass size={12} className="text-[#2563EB]" /> Factory Floor Map
        </span>
        <button onClick={() => setCollapsed(true)} className="text-[#64748B] hover:text-[#1E293B]">
          <X size={12} />
        </button>
      </div>

      {/* 2×3 Zone Grid with machine dots */}
      <div className="relative w-full h-36 bg-[#F3F1EC] rounded-xl border border-[#DDD9D0] overflow-hidden">
        {/* Zone borders (2 rows × 3 cols) */}
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-2">
          {[
            { id: 'MACHINING' as ZoneId, label: 'MACH', color: '#D97706' },
            { id: 'ROBOT' as ZoneId, label: 'ROBOT', color: '#2563EB' },
            { id: 'PROCESSING' as ZoneId, label: 'PROC', color: '#059669' },
            { id: 'ASSEMBLY' as ZoneId, label: 'ASMB', color: '#EA580C' },
            { id: 'PACKAGING' as ZoneId, label: 'PACK', color: '#CA8A04' },
            { id: 'MAINTENANCE' as ZoneId, label: 'MAINT', color: '#7C3AED' },
          ].map((z, i) => {
            const isActiveZone = selectedZoneId === z.id;
            return (
              <button
                key={i}
                onClick={() => onSelectZone?.(z.id)}
                className={`border flex items-start justify-start p-0.5 transition-all ${
                  isActiveZone ? 'border-[#2563EB]' : 'border-[#DDD9D0]/60'
                }`}
                style={{ background: isActiveZone ? `${z.color}22` : `${z.color}08` }}
              >
                <span className="text-[7px] font-extrabold" style={{ color: z.color }}>{z.label}</span>
              </button>
            );
          })}
        </div>
        {/* Machine dots */}
        {dots.map((d) => {
          const m = machineByCode[d.code];
          const status = m?.status || 'RUNNING';
          const color = S_COLORS[status] || S_COLORS.RUNNING;
          const isSelected = selectedMachine?.code === d.code;
          const isDispatchTarget = dispatchedTarget === d.code;
          return (
            <button
              key={d.code}
              onClick={() => onSelect(m || ({ id: d.code, code: d.code, name: d.code, status } as any))}
              title={`${d.code} (${status})${isDispatchTarget ? ' — Technician en route' : ''}`}
              className={`absolute w-2.5 h-2.5 rounded-full -translate-x-1/2 -translate-y-1/2 transition-all ${
                isSelected ? 'ring-2 ring-blue-600 scale-125 z-10' : 'hover:scale-110'
              }`}
              style={{ left: `${d.x}%`, top: `${d.y}%`, backgroundColor: color, boxShadow: `0 0 4px ${color}80` }}
            >
              {isDispatchTarget && (
                <span className="absolute inset-[-3px] rounded-full border-2 border-[#2563EB] animate-ping" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Layers Configuration Panel (Requirement 3)
// ─────────────────────────────────────────────────────────────────────────────
const LayersPanel: React.FC<{
  layers: LayerConfig;
  onChange: (k: keyof LayerConfig, v: boolean) => void;
  onClose: () => void;
}> = ({ layers, onChange, onClose }) => (
  <div className="absolute top-14 right-2 z-50 w-56 bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
    <div className="flex items-center justify-between px-4 py-3 border-b border-[#DDD9D0] bg-white">
      <span className="text-xs font-bold text-[#1E293B]">View Layers</span>
      <button onClick={onClose} className="text-[#64748B] hover:text-[#1E293B]"><X size={14} /></button>
    </div>
    <div className="p-3 space-y-1 text-xs">
      {[
        { k: 'machines',     label: 'Machine Models' },
        { k: 'machineLabels', label: 'Machine Badges' },
        { k: 'supervisors',  label: 'Zone Supervisors' },
        { k: 'workers',      label: 'Personnel & Workers' },
        { k: 'workerLabels', label: 'Worker Details (Hover)' },
        { k: 'safetyZones',  label: 'Safety Zones & Floors' },
        { k: 'walkways',     label: 'Pedestrian Walkways' },
        { k: 'liveSensors',  label: 'Selected Sensor HUD' },
        { k: 'buildings',    label: 'Section Buildings' },
        { k: 'roads',        label: 'Campus Roads' },
        { k: 'trees',        label: 'Trees & Landscaping' },
        { k: 'vehicles',     label: 'Vehicles & Parking' },
      ].map((item) => (
        <label key={item.k} className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-[#EAE7E0] cursor-pointer">
          <input
            type="checkbox"
            checked={layers[item.k as keyof LayerConfig]}
            onChange={(e) => onChange(item.k as keyof LayerConfig, e.target.checked)}
            className="rounded text-[#2563EB] focus:ring-[#2563EB]"
          />
          <span className="text-xs font-semibold text-[#1E293B]">{item.label}</span>
        </label>
      ))}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Digital Twin Page Component
// ─────────────────────────────────────────────────────────────────────────────
interface DigitalTwinPageProps {
  machines: Machine[];
  selectedMachine: Machine | null;
  onSelectMachine: (m: Machine | null) => void;
  onRefresh: () => void;
  liveTelemetry?: Record<string, TelemetryData>;
  telemetryMap?: Record<string, TelemetryData>;
  incidents?: Incident[];
  workOrders?: WorkOrder[];
  activeFaultsCount?: number;
}

export const DigitalTwinPage: React.FC<DigitalTwinPageProps> = ({
  machines,
  selectedMachine,
  onSelectMachine,
  onRefresh,
  liveTelemetry,
  telemetryMap = {},
  incidents = [],
  workOrders = [],
}) => {
  const mergedTelemetry = liveTelemetry || telemetryMap;
  const [layers, setLayers] = useState<LayerConfig>({
    machines: true,
    machineLabels: true,
    workers: true,
    workerLabels: false, // hidden by default to eliminate clutter
    supervisors: true,
    safetyZones: true,
    walkways: true,
    liveSensors: true,
    buildings: true,
    roads: true,
    trees: true,
    vehicles: true,
  });

  const [showLayers, setShowLayers] = useState(false);
  const [cameraPreset, setCameraPreset] = useState<CameraPresetType>('OVERVIEW');
  const [viewLevel, setViewLevel] = useState<ViewLevel>('PLANT');
  const [resetTrigger, setResetTrigger] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [dispatchedTarget, setDispatchedTarget] = useState<string | null>(null);

  const [activePanel, setActivePanel] = useState<'MACHINE' | 'WORKSTATION'>('MACHINE');

  // ── Shared navigation "source of truth" — tabs, 3D buildings, supervisor
  // labels, minimap and search all drive the camera/viewLevel through these.
  // Two levels only: Plant Overview, or directly inside a building. ──
  const exitBuilding = () => {
    setCameraPreset('OVERVIEW');
    setViewLevel('PLANT');
    setResetTrigger((v) => v + 1);
    onSelectMachine(null);
  };

  const enterBuilding = (zoneId: CameraPresetType) => {
    setCameraPreset(zoneId);
    setViewLevel('INTERIOR');
    onSelectMachine(null);
  };

  // Jumps the camera to a machine's zone (if not already there) and commits
  // to Interior level — used whenever a machine is selected by any path
  // (3D click, minimap, search) so the drill-down flow stays consistent.
  const activateMachine = (m: Machine) => {
    const zoneId = zoneIdForMachineCode(m.code);
    if (zoneId && cameraPreset !== zoneId) setCameraPreset(zoneId);
    setViewLevel('INTERIOR');
  };

  const handleSelectTechnician = (code: string) => {
    const target = machines.find((m) => m.code === code) || (selectedMachine?.code === code ? selectedMachine : machines[0]);
    if (target) {
      activateMachine(target);
      onSelectMachine(target);
      setActivePanel('WORKSTATION');
    }
  };

  const handleSelectMachine = (m: Machine | null) => {
    if (m) activateMachine(m);
    onSelectMachine(m);
    setActivePanel('MACHINE');
  };

  const updateLayer = (key: keyof LayerConfig, val: boolean) => {
    setLayers((prev) => ({ ...prev, [key]: val }));
  };

  // Real IoT connected machines count
  const realIotMachines = machines.filter((m) =>
    ['CNC-01', 'CNC-02', 'CNC-03', 'MIXER-01', 'PUMP-01', 'ROBOT-01'].includes(m.code)
  );

  const statusCounts = {
    RUNNING: realIotMachines.filter((m) => m.status === 'RUNNING').length,
    WARNING: realIotMachines.filter((m) => m.status === 'WARNING').length,
    FAULT: realIotMachines.filter((m) => m.status === 'FAULT').length,
    MAINTENANCE: realIotMachines.filter((m) => ['MAINTENANCE', 'WAITING_PARTS'].includes(m.status)).length,
    VERIFYING: realIotMachines.filter((m) => m.status === 'VERIFYING').length,
  };

  const currentTelemetry = selectedMachine ? mergedTelemetry[selectedMachine.code] : undefined;
  const currentIncident = selectedMachine ? incidents.find((i) => i.machine_id === selectedMachine.id || (i as any).machine_code === selectedMachine.code) : undefined;
  const currentWO = selectedMachine ? workOrders.find((w) => w.machine_id === selectedMachine.id || (w as any).machine_code === selectedMachine.code) : undefined;

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) return;
    const found = machines.find((m) => m.code.toLowerCase().includes(q.toLowerCase()) || m.name.toLowerCase().includes(q.toLowerCase()));
    if (found) handleSelectMachine(found);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-[#F3F1EC] overflow-hidden">
      {/* ── Top Controls & Camera Presets Bar ── */}
      <div className="h-14 bg-[#FAF9F6] border-b border-[#DDD9D0] flex items-center px-5 gap-3 shadow-sm z-10 flex-shrink-0">
        {/* Floor Label */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#DDD9D0] text-xs font-bold text-[#1E293B]">
          <LayoutGrid size={13} className="text-[#2563EB]" /> Main Plant
        </div>

        {/* Camera Presets */}
        <div className="hidden lg:flex items-center gap-1 p-1 bg-white border border-[#DDD9D0] rounded-xl">
          {[
            { id: 'OVERVIEW',     label: 'Overview' },
            { id: 'MACHINING',    label: 'Machining' },
            { id: 'ROBOT',        label: 'Robot' },
            { id: 'PROCESSING',   label: 'Processing' },
            { id: 'ASSEMBLY',     label: 'Assembly' },
            { id: 'PACKAGING',    label: 'Packaging' },
            { id: 'MAINTENANCE',  label: 'Maintenance' },
          ].map((preset) => (
            <button
              key={preset.id}
              onClick={() => {
                if (preset.id === 'OVERVIEW') exitBuilding();
                else enterBuilding(preset.id as CameraPresetType);
              }}
              className={`px-2 py-1 text-[11px] font-bold rounded-lg transition-all ${
                cameraPreset === preset.id && !selectedMachine
                  ? 'bg-[#2563EB] text-white shadow-sm'
                  : 'text-[#64748B] hover:text-[#1E293B] hover:bg-[#EAE7E0]'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Live IoT Machine Status Summary (Requirement 12) */}
        <div className="hidden md:flex items-center gap-2.5 px-3 py-1.5 bg-white border border-[#DDD9D0] rounded-xl text-xs">
          <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Live IoT:</span>
          <span className="flex items-center gap-1 font-bold text-[#22A06B]">
            <span className="w-2 h-2 rounded-full bg-[#22A06B]" /> {statusCounts.RUNNING} Running
          </span>
          {statusCounts.WARNING > 0 && (
            <span className="flex items-center gap-1 font-bold text-[#D99A06]">
              <span className="w-2 h-2 rounded-full bg-[#D99A06]" /> {statusCounts.WARNING} Warning
            </span>
          )}
          {statusCounts.FAULT > 0 && (
            <span className="flex items-center gap-1 font-bold text-[#D64545] animate-pulse">
              <span className="w-2 h-2 rounded-full bg-[#D64545]" /> {statusCounts.FAULT} Fault
            </span>
          )}
          {statusCounts.VERIFYING > 0 && (
            <span className="flex items-center gap-1 font-bold text-[#7C5CC4]">
              <span className="w-2 h-2 rounded-full bg-[#7C5CC4]" /> {statusCounts.VERIFYING} Verifying
            </span>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
          <input
            type="text"
            placeholder="Focus machine..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-36 md:w-44 pl-7 pr-3 py-1.5 text-xs bg-white border border-[#DDD9D0] rounded-xl text-[#1E293B] placeholder:text-[#64748B] focus:outline-none focus:border-[#2563EB]"
          />
        </div>

        {/* Layers Toggle */}
        <div className="relative">
          <button
            onClick={() => setShowLayers((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
              showLayers ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-[#DDD9D0] text-[#1E293B] hover:bg-[#EAE7E0]'
            }`}
          >
            <Layers size={13} /> Layers
          </button>
          {showLayers && (
            <LayersPanel layers={layers} onChange={updateLayer} onClose={() => setShowLayers(false)} />
          )}
        </div>

        {/* Refresh */}
        <button
          onClick={onRefresh}
          className="p-2 rounded-xl bg-white border border-[#DDD9D0] text-[#64748B] hover:text-[#1E293B] hover:bg-[#EAE7E0] transition-all"
          title="Refresh Telemetry"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* ── Main 3D Canvas & Floating Overlays ── */}
      <div className="flex-1 relative overflow-hidden">
        <FactoryCanvas
          machines={machines}
          selectedMachine={selectedMachine}
          onSelectMachine={handleSelectMachine}
          onSelectTechnician={handleSelectTechnician}
          layers={layers}
          resetTrigger={resetTrigger}
          cameraPreset={cameraPreset}
          onPresetChange={enterBuilding}
          liveTelemetry={mergedTelemetry}
          dispatchedTarget={dispatchedTarget}
          viewLevel={viewLevel}
        />

        {/* Top-Left Breadcrumb (Plant Overview > Building) + Exit Building */}
        <Breadcrumb
          viewLevel={viewLevel}
          zoneLabel={cameraPreset !== 'OVERVIEW' ? ZONE_DEFS.find((z) => z.id === cameraPreset)?.label ?? null : null}
          onExitBuilding={exitBuilding}
        />

        <CompassOverlay />

        {/* Top-Right Asset Counts */}
        <div className={`absolute top-3 ${selectedMachine ? 'right-96' : 'right-3'} transition-all duration-200 flex items-center gap-2.5 bg-white/95 backdrop-blur-md border border-[#DDD9D0] rounded-xl px-3 py-1.5 shadow-sm text-xs`}>
          <span className="text-[#64748B]">IoT Assets:</span>
          <span className="font-mono font-extrabold text-[#2563EB]">{realIotMachines.length}</span>
          <span className="w-px h-3 bg-[#DDD9D0]" />
          <span className="text-[#64748B]">Total Units:</span>
          <span className="font-mono font-extrabold text-[#1E293B]">25</span>
          <span className="w-px h-3 bg-[#DDD9D0]" />
          <span className="text-[#64748B]">Personnel:</span>
          <span className="font-mono font-extrabold text-[#0F766E]">24</span>
        </div>

        {/* Bottom-Left Minimap */}
        <FactoryMinimap
          machines={machines}
          selectedMachine={selectedMachine}
          onSelect={(m) => handleSelectMachine(m)}
          selectedZoneId={cameraPreset !== 'OVERVIEW' ? (cameraPreset as ZoneId) : null}
          onSelectZone={(zoneId) => enterBuilding(zoneId)}
          dispatchedTarget={dispatchedTarget}
          viewLevel={viewLevel}
        />

        {/* Bottom-Right Legend */}
        <div className={`absolute bottom-3 ${selectedMachine ? 'right-96' : 'right-3'} transition-all duration-200 flex items-center gap-3 bg-white/95 backdrop-blur-md border border-[#DDD9D0] rounded-xl px-3 py-2 shadow-sm`}>
          {[
            { label: 'Running', color: '#22A06B' },
            { label: 'Warning', color: '#D99A06' },
            { label: 'Fault', color: '#D64545' },
            { label: 'Maintenance', color: '#3978C8' },
            { label: 'Verifying', color: '#7C5CC4' },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-1.5 text-xs text-[#64748B] font-medium">
              <span style={{ background: s.color }} className="w-2 h-2 rounded-full flex-shrink-0" />
              <span>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Right Drawer: Field Technician Workstation OR Machine Details */}
        {selectedMachine && activePanel === 'WORKSTATION' && (
          <FieldTechnicianWorkstationDrawer
            machine={selectedMachine}
            telemetry={currentTelemetry}
            incident={currentIncident}
            workOrder={currentWO}
            onClose={() => handleSelectMachine(null)}
            onSwitchToMachineSpecs={() => setActivePanel('MACHINE')}
            onRefresh={onRefresh}
            onDispatchTechnician={setDispatchedTarget}
          />
        )}

        {selectedMachine && activePanel === 'MACHINE' && (
          <MachineDetailsPanel
            machine={selectedMachine}
            telemetry={currentTelemetry}
            incident={currentIncident}
            workOrder={currentWO}
            onClose={() => handleSelectMachine(null)}
            onRefresh={onRefresh}
            onFitFactory={exitBuilding}
            onDispatchTechnician={setDispatchedTarget}
            onOpenWorkstation={() => setActivePanel('WORKSTATION')}
          />
        )}
      </div>
    </div>
  );
};
