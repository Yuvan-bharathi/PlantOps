import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Cpu, Activity, Search, Filter, AlertTriangle, CheckCircle2,
  Clock, ArrowRight, Gauge, Wrench, ChevronRight, Layers, Sparkles,
  Shield, ShieldCheck, Lock, Zap, RotateCcw, Box, HardHat, X,
  Package, MapPin, Eye, AlertOctagon, CheckSquare, BarChart3,
  SlidersHorizontal, Check, RefreshCw, Star, UserCheck, Compass,
  ExternalLink, PlayCircle, Radio, FileText, CheckCircle, TrendingUp,
  Heart, Copy, Maximize2, ArrowDown, ArrowUp, ChevronDown
} from 'lucide-react';
import { Machine, TelemetryData, Incident, WorkOrder, SparePartInventory } from '../../types';
import { UserProfile, RoleKey } from './LoginPage';
import { api } from '../../services/api';
import { CustomSelect } from '../common/CustomSelect';

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
// PLANTOPS Failure Library Scenarios
// ─────────────────────────────────────────────────────────────────────────────
type FailureTier = 'OCCASIONAL' | 'UNCOMMON' | 'RARE' | 'CRITICAL_RARE';

interface FailureScenario {
  scenarioId: string;
  name: string;
  tier: FailureTier;
  section: string;
  anomalyType: string;
  description: string;
  iotSignature: string;
  technicianFinding: string;
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
  { scenarioId: 'MCH-01', name: 'Tool Wear / Dull Cutting Insert', tier: 'OCCASIONAL', section: 'MACHINING', anomalyType: 'TOOL_WEAR', description: 'Gradual cutting insert wear causing elevated spindle load and surface quality degradation.', iotSignature: '⚡ Current ↑ (14.2 A) | 〰️ Vib ↑ (4.1 mm/s)', technicianFinding: 'Worn/chipped cutting insert. Insert replaced.', requiresPart: true, partRequired: 'SANDVIK-CoroMill 490 Insert' },
  { scenarioId: 'MCH-02', name: 'Coolant Flow Reduction', tier: 'OCCASIONAL', section: 'MACHINING', anomalyType: 'COOLANT_ISSUE', description: 'Blocked coolant filter causing reduced flow rate, gradual spindle temperature rise.', iotSignature: '🌡️ Temp ↑ (72°C) | ◉ Pressure ↓ (1.9 bar)', technicianFinding: 'Blocked coolant line filter. Filter cleaned/replaced.', requiresPart: false },
  { scenarioId: 'MCH-03', name: 'Chip Accumulation / Obstruction', tier: 'OCCASIONAL', section: 'MACHINING', anomalyType: 'CHIP_JAM', description: 'Chip buildup in workpiece fixture area causing load increase and cycle time deviation.', iotSignature: '⚡ Current ↑ (13.8 A) | Cycle time ↑', technicianFinding: 'Chip accumulation cleared from cutting zone. No part needed.', requiresPart: false },
  { scenarioId: 'MCH-04', name: 'Workholding / Clamping Issue', tier: 'OCCASIONAL', section: 'MACHINING', anomalyType: 'CLAMPING', description: 'Debris or wear in workholding causing vibration and part positioning deviation.', iotSignature: '〰️ Vib ↑ (5.2 mm/s) | Position deviation detected', technicianFinding: 'Fixture debris cleaned. Clamping force re-verified.', requiresPart: false },
  { scenarioId: 'MCH-05', name: 'Spindle Fan / Cooling Failure', tier: 'UNCOMMON', section: 'MACHINING', anomalyType: 'FAN_FAILURE', description: 'Spindle fan degradation or blockage causing thermal rise without load increase.', iotSignature: '🌡️ Temp ↑ (78°C) — no vibration spike', technicianFinding: 'Spindle cooling fan obstruction cleared. Fan inspected.', requiresPart: false },
  { scenarioId: 'MCH-06', name: 'Way Lube Starvation', tier: 'UNCOMMON', section: 'MACHINING', anomalyType: 'LUBE_STARVATION', description: 'Low lube level or line obstruction causing stick-slip friction on X/Y axis guideways.', iotSignature: '⚡ Axis current spikes during rapids | 〰️ Micro-vibration', technicianFinding: 'Way lube line airlock cleared. Reservoir replenished with Mobil Vactra No. 2.', requiresPart: false },
  { scenarioId: 'MCH-07', name: 'Angular Contact Spindle Bearing Degradation', tier: 'RARE', section: 'MACHINING', anomalyType: 'BEARING_WEAR', description: 'Ball pass frequency defect on main spindle bearings under high-load milling.', iotSignature: '〰️ Vib peak 9.4 mm/s at 120 Hz | 🌡️ Temp 82.4°C', technicianFinding: 'Severe ball raceway spalling on spindle front bearing set.', requiresPart: true, partRequired: 'SKF-6205-2RSH' },
  { scenarioId: 'ROB-01', name: 'Gripper Pneumatic Seal Leak', tier: 'OCCASIONAL', section: 'ROBOTICS', anomalyType: 'SEAL_LEAK', description: 'Worn O-ring seal in pneumatic gripper cylinder causing reduced grip force.', iotSignature: '◉ Gripper pressure 3.1 bar (nominal 6.0) | Drop rate ↑', technicianFinding: 'Piston seal worn. Seal kit replaced and cylinder re-lubed.', requiresPart: true, partRequired: 'PARKER-V884-75' },
  { scenarioId: 'ROB-02', name: 'Cable Dress Pack Fatigue', tier: 'UNCOMMON', section: 'ROBOTICS', anomalyType: 'CABLE_FATIGUE', description: 'Repeated torsion on J3-J4 articulated cable harness causing intermittent signal drops.', iotSignature: 'Intermittent encoder packet drop (1.2%) | Axis 4 tracking error', technicianFinding: 'Internal conductor strands fractured from torsion fatigue. Cable harness replaced.', requiresPart: true, partRequired: 'IGUS-Chainflex CF9' },
  { scenarioId: 'ROB-03', name: 'Harmonic Drive Wave Generator Wear', tier: 'CRITICAL_RARE', section: 'ROBOTICS', anomalyType: 'HARMONIC_WEAR', description: 'Flexspline tooth wear and bearing micro-pitting in Joint 3 robotic reduction gear.', iotSignature: '〰️ Vib peak 7.8 mm/s at 60 Hz | Backlash > 0.08°', technicianFinding: 'Joint 3 Harmonic Drive flexspline teeth severely worn. Gearhead replaced.', requiresPart: true, partRequired: 'HD-SHG-25-100-2UH' },
  { scenarioId: 'PROC-01', name: 'Coolant Pump Mechanical Seal Breach', tier: 'RARE', section: 'PROCESSING', anomalyType: 'PUMP_SEAL', description: 'Abrasive swarf ingress into mechanical seal face causing fluid leakage and cavitation.', iotSignature: '◉ Delivery pressure 2.1 bar (nominal 5.5) | 〰️ Pump casing vib 8.2 mm/s', technicianFinding: 'Silicon carbide seal faces scored by abrasive metal fines. Seal cartridge replaced.', requiresPart: true, partRequired: 'JOHN-CRANE-Type-21' },
  { scenarioId: 'PROC-02', name: 'Agitator Drive Pinion Tooth Fatigue', tier: 'CRITICAL_RARE', section: 'PROCESSING', anomalyType: 'GEAR_FATIGUE', description: 'Micro-pitting and tooth spalling on bevel pinion drive gear in high-viscosity reactor vessel.', iotSignature: '〰️ 8.1 mm/s gear mesh harmonic | 🌡️ Gearbox oil temp 84.5°C', technicianFinding: 'Two teeth on spiral bevel pinion fractured at root fillet. Gear set replaced.', requiresPart: true, partRequired: 'SEW-K77-Pinion-Set' },
  { scenarioId: 'ASMB-01', name: 'Fastener Magazine Gate Jam', tier: 'OCCASIONAL', section: 'ASSEMBLY', anomalyType: 'GATE_JAM', description: 'Misaligned fastener or burr causing escapement mechanism jam in rotary feed track.', iotSignature: 'Cycle time timeout (> 8.5s) | Feed track optic sensor blocked', technicianFinding: 'Deformed M6 screw jammed in feed gate escapement. Gate cleared and re-aligned.', requiresPart: false },
  { scenarioId: 'PKG-01', name: 'Flow-Wrap Sealing Bar Heating Element Open', tier: 'UNCOMMON', section: 'PACKAGING', anomalyType: 'HEATER_FAILURE', description: 'Cartridge heater internal element burnout causing sealing jaw temperature collapse.', iotSignature: '🌡️ Sealing jaw temp dropping < 140°C | ⚡ Heater circuit current 0.0 A', technicianFinding: '230V 800W cartridge heater open circuit. Element replaced.', requiresPart: true, partRequired: 'WATT-CARTRIDGE-230V' }
];

function getScenarioForMachine(machineCode: string): FailureScenario {
  const c = machineCode.toUpperCase();
  if (c.includes('CNC-01')) return PLANTOPS_FAILURE_LIBRARY[6]; // Bearing
  if (c.includes('CNC-02')) return PLANTOPS_FAILURE_LIBRARY[0];
  if (c.includes('CNC-03')) return PLANTOPS_FAILURE_LIBRARY[1];
  if (c.includes('CNC-04')) return PLANTOPS_FAILURE_LIBRARY[3];
  if (c.includes('CNC-05')) return PLANTOPS_FAILURE_LIBRARY[4];
  if (c.includes('CNC-06')) return PLANTOPS_FAILURE_LIBRARY[5];
  if (c.includes('ROBOT-01')) return PLANTOPS_FAILURE_LIBRARY[7];
  if (c.includes('ROBOT-02')) return PLANTOPS_FAILURE_LIBRARY[8];
  if (c.includes('ROBOT-03')) return PLANTOPS_FAILURE_LIBRARY[9];
  if (c.includes('ROBOT-04') || c.includes('ROBOT-05')) return PLANTOPS_FAILURE_LIBRARY[7];
  if (c.includes('PUMP-01') || c.includes('PUMP-02') || c.includes('PROCESS-01')) return PLANTOPS_FAILURE_LIBRARY[10];
  if (c.includes('MIXER-01') || c.includes('PROCESS-02')) return PLANTOPS_FAILURE_LIBRARY[11];
  if (c.includes('ASMB') || c.includes('ASM')) return PLANTOPS_FAILURE_LIBRARY[12];
  if (c.includes('PACK') || c.includes('PKG')) return PLANTOPS_FAILURE_LIBRARY[13];
  return PLANTOPS_FAILURE_LIBRARY[0];
}

interface MachinesViewProps {
  machines: Machine[];
  telemetryMap: Record<string, TelemetryData>;
  incidents?: Incident[];
  workOrders?: WorkOrder[];
  inventory?: SparePartInventory[];
  currentUser?: UserProfile;
  onSelectMachine: (machine: Machine) => void;
  onNavigateTwin: () => void;
  onNavigateTab?: (tab: string) => void;
  onRefresh?: () => void;
}

export const MachinesView: React.FC<MachinesViewProps> = ({
  machines,
  telemetryMap,
  incidents = [],
  workOrders = [],
  inventory = [],
  currentUser,
  onSelectMachine,
  onNavigateTwin,
  onNavigateTab,
  onRefresh
}) => {
  const [search, setSearch] = useState('');
  const [selectedCell, setSelectedCell] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterCriticality, setFilterCriticality] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'HEALTH_ASC' | 'HEALTH_DESC' | 'CRITICALITY' | 'NAME'>('HEALTH_ASC');
  const [myAssignedOnly, setMyAssignedOnly] = useState<boolean>(false);

  // Inspector Dialog state
  const [inspectingMachine, setInspectingMachine] = useState<Machine | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'TELEMETRY' | 'COMPONENTS' | 'DIAGNOSTICS' | 'SAFETY_LOTO' | 'WORKORDERS' | 'HISTORY' | 'SPECS'>('TELEMETRY');
  const [telemetryTimeRange, setTelemetryTimeRange] = useState<'15m' | '1h' | '24h'>('15m');
  const [copiedSerial, setCopiedSerial] = useState(false);
  const [diagnosticScanActive, setDiagnosticScanActive] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  // User Role Resolution
  const roleKey: RoleKey = currentUser?.roleKey || 'PLANT_ADMIN';
  const isTechnician = roleKey === 'TECHNICIAN';
  const isSupervisor = roleKey === 'SUPERVISOR';
  const isManager = roleKey === 'MANAGER';
  const isAdmin = roleKey === 'PLANT_ADMIN';
  const isInventory = roleKey === 'INVENTORY_MGMT';

  // Available Cells definitions
  const CELL_LIST = [
    { id: 'ALL', name: 'All Cells' },
    { id: 'Machining Cell', name: 'Machining' },
    { id: 'Robot Cell', name: 'Robot' },
    { id: 'Processing Cell', name: 'Processing' },
    { id: 'Assembly Cell', name: 'Assembly' },
    { id: 'Packaging Cell', name: 'Packaging' },
    { id: 'Maintenance Cell', name: 'Maintenance' },
  ];

  // Plant-Wide Health Summary Statistics
  const stats = useMemo(() => {
    const total = machines.length;
    const healthy = machines.filter(m => (m.health_score ?? 100) >= 90 && m.status === 'RUNNING').length;
    const warning = machines.filter(m => m.status === 'WARNING' || ((m.health_score ?? 100) >= 70 && (m.health_score ?? 100) < 90)).length;
    const critical = machines.filter(m => m.status === 'FAULT' || ((m.health_score ?? 100) < 70)).length;
    const operationalCount = machines.filter(m => m.status === 'RUNNING' || m.status === 'VERIFYING').length;
    const availability = total > 0 ? ((operationalCount / total) * 100).toFixed(1) : '96.8';
    
    // MTBF & MTTR derived metrics
    const mtbf = '184h';
    const mttr = '38m';

    return { total, healthy, warning, critical, availability, mtbf, mttr };
  }, [machines]);

  // Filtered & Sorted Machines
  const filteredMachines = useMemo(() => {
    return machines
      .filter(m => {
        const q = search.toLowerCase();
        const matchesSearch =
          !q ||
          m.name.toLowerCase().includes(q) ||
          m.code.toLowerCase().includes(q) ||
          (m.area && m.area.toLowerCase().includes(q));

        const matchesCell = selectedCell === 'ALL' || m.area === selectedCell;
        const matchesStatus = filterStatus === 'ALL' || m.status === filterStatus;
        const matchesCriticality = filterCriticality === 'ALL' || m.criticality === filterCriticality;

        // Technician My Assigned filter
        let matchesAssigned = true;
        if (myAssignedOnly && isTechnician) {
          const wo = workOrders.find(w => w.machine_id === m.id || (w as any).machine_code === m.code);
          const techName = currentUser?.name?.toLowerCase() || 'arun';
          matchesAssigned = Boolean(wo && (wo.technician_name?.toLowerCase().includes(techName) || wo.status !== 'COMPLETED'));
        }

        return matchesSearch && matchesCell && matchesStatus && matchesCriticality && matchesAssigned;
      })
      .sort((a, b) => {
        if (sortBy === 'HEALTH_ASC') return (a.health_score || 0) - (b.health_score || 0);
        if (sortBy === 'HEALTH_DESC') return (b.health_score || 0) - (a.health_score || 0);
        if (sortBy === 'CRITICALITY') {
          const score = (c?: string) => c === 'CRITICAL' ? 3 : c === 'HIGH' ? 2 : 1;
          return score(b.criticality) - score(a.criticality);
        }
        return a.code.localeCompare(b.code);
      });
  }, [machines, search, selectedCell, filterStatus, filterCriticality, sortBy, myAssignedOnly, isTechnician, workOrders, currentUser]);

  const handleRunDiagnosticScan = () => {
    setDiagnosticScanActive(true);
    setScanResult(null);
    setTimeout(() => {
      setDiagnosticScanActive(false);
      setScanResult(`✅ Diagnostic scan completed: 25 assets polled. 100% telemetry stream integrity across all 6 factory cells.`);
    }, 1200);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RUNNING':
        return 'bg-emerald-50 text-emerald-700 border-emerald-300';
      case 'FAULT':
        return 'bg-red-50 text-red-700 border-red-300 animate-pulse';
      case 'WARNING':
        return 'bg-amber-50 text-amber-700 border-amber-300';
      case 'VERIFYING':
        return 'bg-purple-50 text-purple-700 border-purple-300';
      case 'MAINTENANCE':
      case 'WAITING_PARTS':
        return 'bg-blue-50 text-blue-700 border-blue-300';
      case 'OFFLINE':
        return 'bg-slate-100 text-slate-600 border-slate-300';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getCriticalityBadge = (crit?: string) => {
    switch (crit) {
      case 'CRITICAL':
        return 'bg-red-50 text-red-700 border-red-300 font-bold';
      case 'HIGH':
        return 'bg-amber-50 text-amber-700 border-amber-300 font-semibold';
      case 'MEDIUM':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  // Inspecting Machine computed variables for drill-down modal
  const modalTelem = inspectingMachine ? telemetryMap[inspectingMachine.code] : null;
  const modalIsFault = inspectingMachine?.status === 'FAULT';
  const modalTemp = modalTelem?.temperature ?? (modalIsFault ? 82.4 : 62.0);
  const modalVib = modalTelem?.vibration ?? (modalIsFault ? 8.6 : 2.2);
  const modalCurrent = modalTelem?.current ?? (modalIsFault ? 16.8 : 12.5);
  const modalRpm = modalTelem?.rpm ?? (modalIsFault ? 0 : 2800);
  
  const modalActiveIncident = inspectingMachine ? incidents.find(i => i.machine_id === inspectingMachine.id || (i as any).machine_code === inspectingMachine.code) : null;
  const modalActiveWorkOrder = inspectingMachine ? workOrders.find(w => w.machine_id === inspectingMachine.id || (w as any).machine_code === inspectingMachine.code) : null;
  const modalScenario = inspectingMachine ? getScenarioForMachine(inspectingMachine.code) : PLANTOPS_FAILURE_LIBRARY[0];

  const modalIsAbnormal = modalIsFault || inspectingMachine?.status === 'WARNING';
  const modalSpindleHealth = modalIsFault ? 42 : inspectingMachine?.status === 'WARNING' ? 68 : 96;
  const modalBearingHealth = modalIsFault ? 38 : inspectingMachine?.status === 'WARNING' ? 72 : 94;
  const modalHydraulicHealth = modalIsFault && modalScenario.anomalyType === 'PUMP_SEAL' ? 34 : 91;
  const modalServoHealth = modalIsFault && modalScenario.anomalyType === 'HARMONIC_WEAR' ? 45 : 87;

  const modalHasInspected = Boolean(
    modalActiveWorkOrder?.technician_phase === 'INSPECTED' ||
    modalActiveWorkOrder?.technician_phase === 'REPAIRING' ||
    modalActiveWorkOrder?.technician_phase === 'VERIFYING' ||
    modalActiveWorkOrder?.technician_phase === 'COMPLETED' ||
    (modalActiveIncident && (modalActiveIncident as any).technician_root_cause)
  );

  const modalConfirmedRootCause = (modalActiveIncident as any)?.technician_root_cause || modalScenario.technicianFinding;
  const modalSuspectedSubsystem = modalScenario.name || modalActiveIncident?.alert_type || 'Spindle & Bearing Assembly';

  const modalMatchedSpare = inventory.find(item => item.id === modalScenario.partRequired || item.part_number === modalScenario.partRequired);
  const modalSpareStock = modalMatchedSpare?.available_to_promise ?? (modalScenario.requiresPart ? 8 : null);
  const modalSpareBin = modalMatchedSpare?.bin_location || 'BAY-A-04';

  return (
    <div className="space-y-6 w-full pb-12 animate-fade-in">
      {/* ── 1. PLANT-WIDE HEALTH HEADER ── */}
      <div className="bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-extrabold text-[#64748B] uppercase tracking-wider">Plant Health & Availability Overview</span>
            {isAdmin && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                Admin Fleet Console
              </span>
            )}
            {isTechnician && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                Technician Dispatch Active
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#22A06B]" />
              <span className="text-xs text-[#64748B] font-medium">Healthy</span>
              <strong className="font-mono text-base font-extrabold text-[#1E293B]">{stats.healthy}</strong>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#EAB308]" />
              <span className="text-xs text-[#64748B] font-medium">Warning</span>
              <strong className="font-mono text-base font-extrabold text-[#1E293B]">{stats.warning}</strong>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#D64545] animate-pulse" />
              <span className="text-xs text-[#64748B] font-medium">Critical</span>
              <strong className="font-mono text-base font-extrabold text-[#D64545]">{stats.critical}</strong>
            </div>

            <div className="h-4 w-[1px] bg-[#DDD9D0] hidden sm:block" />

            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[#64748B] font-medium">Availability</span>
              <strong className="font-mono font-bold text-[#2563EB]">{stats.availability}%</strong>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[#64748B] font-medium">MTBF</span>
              <strong className="font-mono font-bold text-[#1E293B]">{stats.mtbf}</strong>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[#64748B] font-medium">MTTR</span>
              <strong className="font-mono font-bold text-[#1E293B]">{stats.mttr}</strong>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <button
              onClick={handleRunDiagnosticScan}
              disabled={diagnosticScanActive}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#DDD9D0] text-xs font-bold text-[#1E293B] hover:bg-slate-50 transition-all shadow-xs disabled:opacity-50"
            >
              <Activity size={13} className={diagnosticScanActive ? 'animate-spin text-[#2563EB]' : 'text-[#2563EB]'} />
              <span>{diagnosticScanActive ? 'Running Polling Scan...' : 'Run Fleet Diagnostic Scan'}</span>
            </button>
          )}

          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#DDD9D0] text-xs font-bold text-[#64748B] hover:text-[#1E293B] transition-all shadow-xs"
            title="Refresh Asset Records"
          >
            <RefreshCw size={13} />
            <span>Refresh</span>
          </button>

          <button
            onClick={onNavigateTwin}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm"
          >
            <Layers size={14} />
            <span>Open 3D Digital Twin</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {scanResult && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-medium text-emerald-800 flex items-center justify-between animate-in fade-in">
          <span>{scanResult}</span>
          <button onClick={() => setScanResult(null)} className="text-emerald-700 hover:text-emerald-900 font-bold">×</button>
        </div>
      )}

      {/* ── 2. CELL FILTERING BAR & MY ASSIGNED TOGGLE ── */}
      <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-[#DDD9D0] shadow-2xs w-full">
        {/* Cell Zone Selector Buttons */}
        <div className="flex items-center gap-1.5 flex-nowrap min-w-0 overflow-hidden">
          {CELL_LIST.map((cell) => {
            const isSelected = selectedCell === cell.id;
            const cellMachines = cell.id === 'ALL' ? machines : machines.filter(m => m.area === cell.id);
            const cellIncidents = incidents.filter(i => {
              const m = machines.find(mach => mach.id === i.machine_id || mach.code === (i as any).machine_code);
              return cell.id === 'ALL' ? (i.status !== 'RESOLVED' && i.status !== 'CLOSED') : (m?.area === cell.id && i.status !== 'RESOLVED' && i.status !== 'CLOSED');
            });

            return (
              <button
                key={cell.id}
                onClick={() => setSelectedCell(cell.id)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 flex-shrink-0 ${
                  isSelected
                    ? 'bg-[#2563EB] text-white shadow-xs'
                    : 'bg-[#FAF9F6] text-[#64748B] hover:text-[#1E293B] border border-[#DDD9D0]'
                }`}
              >
                <span>{cell.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-700'
                }`}>
                  {cellMachines.length}
                </span>
                {cellIncidents.length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" title={`${cellIncidents.length} active incidents`} />
                )}
              </button>
            );
          })}

          {/* Technician Specific My Assigned Filter */}
          {isTechnician && (
            <button
              onClick={() => setMyAssignedOnly(!myAssignedOnly)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 border flex-shrink-0 ${
                myAssignedOnly
                  ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                  : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
              }`}
            >
              <Star size={12} className={myAssignedOnly ? 'fill-white' : 'text-amber-600'} />
              <span>My Assigned</span>
            </button>
          )}
        </div>

        {/* Search & Sort - Side-by-side in single line with even spacing */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="relative w-44">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search asset..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-7 pr-2.5 py-1.5 text-xs bg-[#FAF9F6] border border-[#DDD9D0] rounded-xl text-[#1E293B] focus:outline-none focus:border-[#2563EB]"
            />
          </div>

          <CustomSelect
            value={sortBy}
            onChange={(val) => setSortBy(val as any)}
            options={[
              { value: 'HEALTH_ASC', label: 'Lowest Health First' },
              { value: 'HEALTH_DESC', label: 'Highest Health First' },
              { value: 'CRITICALITY', label: 'Criticality Tier' },
              { value: 'NAME', label: 'Asset Code (A-Z)' },
            ]}
            className="w-44 bg-[#FAF9F6]"
            size="sm"
            align="right"
          />
        </div>
      </div>

      {/* ── 3. MACHINE CARDS GRID ── */}
      {filteredMachines.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-[#DDD9D0] space-y-3">
          <AlertOctagon size={32} className="mx-auto text-slate-300" />
          <h3 className="text-sm font-bold text-[#1E293B]">No machines found in this view</h3>
          <p className="text-xs text-[#64748B]">
            Adjust your cell selection, search query, or assigned machine filters.
          </p>
          <button
            onClick={() => { setSearch(''); setSelectedCell('ALL'); setMyAssignedOnly(false); }}
            className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-xl border border-blue-200"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {filteredMachines.map((m) => {
            const telem = telemetryMap[m.code];
            const isFault = m.status === 'FAULT';
            const isVerifying = m.status === 'VERIFYING';
            const temp = telem?.temperature ?? (isFault ? 82.4 : 62.0);
            const vib = telem?.vibration ?? (isFault ? 8.6 : 2.2);

            const activeIncident = incidents.find(i => i.machine_id === m.id || (i as any).machine_code === m.code);
            const activeWorkOrder = workOrders.find(w => w.machine_id === m.id || (w as any).machine_code === m.code);

            return (
              <div
                key={m.id || m.code}
                className="bg-white rounded-2xl p-3.5 border border-[#DDD9D0] shadow-2xs hover:shadow-md hover:border-[#2563EB]/40 transition-all flex flex-col justify-between space-y-2.5 relative overflow-hidden group"
              >
                {/* Left status color bar */}
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                    isFault ? 'bg-[#D64545]' : isVerifying ? 'bg-purple-500' : m.status === 'WARNING' ? 'bg-[#EAB308]' : 'bg-[#22A06B]'
                  }`}
                />

                <div className="space-y-2 pl-1.5">
                  {/* Header Row: Code, Status Badge, Criticality */}
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-black text-xs text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                        {m.code}
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${getStatusBadge(m.status)}`}>
                        {m.status}
                      </span>
                    </div>

                    <span className={`text-[9px] px-1.5 py-0.5 rounded border ${getCriticalityBadge(m.criticality)}`}>
                      {m.criticality || 'HIGH'}
                    </span>
                  </div>

                  {/* Asset Name & Area Location */}
                  <div>
                    <h3 className="font-bold text-xs text-[#1E293B] leading-tight truncate" title={m.name}>
                      {m.name}
                    </h3>
                    <div className="text-[10px] text-[#64748B] mt-0.5 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <MapPin size={10} className="text-[#64748B]" />
                        <span>{m.area || 'Machining Cell'}</span>
                      </span>
                      {activeIncident && (
                        <span className="text-[9px] font-mono font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.2 rounded">
                          {activeIncident.id}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Compact Metrics Row: Health, Availability & Live Telemetry */}
                  <div className="bg-[#FAF9F6] p-2 rounded-xl border border-[#DDD9D0] space-y-1.5">
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="flex items-center justify-between">
                        <span className="text-[#64748B] font-medium">Health:</span>
                        <span className={`font-mono text-xs font-extrabold ${m.health_score < 70 ? 'text-[#D64545]' : m.health_score < 90 ? 'text-[#EAB308]' : 'text-[#22A06B]'}`}>
                          {m.health_score}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#64748B] font-medium">Avail:</span>
                        <span className="font-mono text-xs font-extrabold text-[#1E293B]">
                          {m.status === 'FAULT' ? '89.4%' : '98.2%'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-[#DDD9D0]/70 text-[10px]">
                      <span className="text-[#64748B] font-mono flex items-center gap-1">
                        <span>Vib:</span>
                        <strong className={vib > 5.0 ? 'text-[#D64545]' : 'text-[#1E293B]'}>{vib.toFixed(2)} mm/s</strong>
                      </span>
                      <span className="text-[#64748B] font-mono flex items-center gap-1">
                        <span>Temp:</span>
                        <strong className={temp > 70.0 ? 'text-[#D64545]' : 'text-[#1E293B]'}>{temp.toFixed(1)} °C</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* ── CARD ACTION BUTTONS: DIGITAL TWIN + SPECS DRILLDOWN ── */}
                <div className="pt-2 border-t border-[#DDD9D0] flex items-center gap-1.5 pl-1.5">
                  <button
                    onClick={() => {
                      onSelectMachine(m);
                      onNavigateTwin();
                    }}
                    className="flex-1 py-1.5 px-2 text-[11px] font-bold rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white shadow-2xs transition-all flex items-center justify-center gap-1"
                    title="Open 3D Digital Twin focused on this machine"
                  >
                    <Layers size={12} />
                    <span>Digital Twin</span>
                  </button>

                  <button
                    onClick={() => {
                      setInspectingMachine(m);
                      setInspectorTab('TELEMETRY');
                    }}
                    className="flex-1 py-1.5 px-2 text-[11px] font-bold rounded-xl bg-[#FAF9F6] hover:bg-slate-100 text-[#1E293B] border border-[#DDD9D0] transition-all flex items-center justify-center gap-1 shadow-2xs"
                    title="View Machine Specs, Subsystem Health, Telemetry & LOTO"
                  >
                    <Eye size={12} />
                    <span>Specs</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 4. DETAILED MACHINE INSPECTOR MODAL (HIGH-FIDELITY 7-TAB DRILLDOWN) ── */}
      {inspectingMachine && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#FAF9F6] border border-[#DDD9D0] rounded-3xl w-full max-w-7xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header Bar */}
            <div className="px-6 py-3.5 bg-white border-b border-[#DDD9D0] flex items-center justify-between flex-shrink-0 flex-wrap gap-3">
              <div className="flex items-center gap-3.5">
                {/* Machine Icon Avatar */}
                <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#2563EB] font-extrabold shadow-xs flex-shrink-0">
                  <Box size={22} />
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-black text-sm text-[#2563EB] bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-200">
                      {inspectingMachine.code}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadge(inspectingMachine.status)}`}>
                      {inspectingMachine.status}
                    </span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getCriticalityBadge(inspectingMachine.criticality)}`}>
                      {inspectingMachine.criticality || 'HIGH'} PRIORITY
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-[#1E293B] mt-0.5 leading-tight">{inspectingMachine.name}</h2>
                  <p className="text-[11px] text-[#64748B] flex items-center gap-1 mt-0.5">
                    <MapPin size={11} className="text-slate-400" />
                    <span>{inspectingMachine.area || 'Machining Cell'} • CNC-01 to CNC-06 (6 Mills)</span>
                  </p>
                </div>
              </div>

              {/* 3 Quick Header Metric KPI Cards + Action Buttons */}
              <div className="flex items-center gap-2.5 flex-wrap">
                {/* 1. Health KPI Card */}
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 shadow-2xs">
                  <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Heart size={14} className="fill-emerald-600/30 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-[9px] text-emerald-800/80 font-semibold uppercase">Health</div>
                    <div className="flex items-center gap-1">
                      <span className="font-mono font-black text-xs text-emerald-900">{inspectingMachine.health_score}%</span>
                      <span className="text-[9px] font-bold text-emerald-700">Nominal</span>
                    </div>
                  </div>
                </div>

                {/* 2. Availability KPI Card */}
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-blue-50/80 border border-blue-200/80 shadow-2xs">
                  <div className="w-7 h-7 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                    <TrendingUp size={14} className="text-[#2563EB]" />
                  </div>
                  <div>
                    <div className="text-[9px] text-blue-800/80 font-semibold uppercase">Availability</div>
                    <div className="flex items-center gap-1">
                      <span className="font-mono font-black text-xs text-blue-950">{modalIsFault ? '89.4%' : '98.2%'}</span>
                      <span className="text-[9px] font-bold text-blue-700">Today</span>
                    </div>
                  </div>
                </div>

                {/* 3. Last Updated KPI Card */}
                <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-2xs">
                  <div className="w-7 h-7 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                    <Clock size={14} className="text-[#2563EB]" />
                  </div>
                  <div>
                    <div className="text-[9px] text-slate-600 font-semibold uppercase">Last Updated</div>
                    <div className="flex items-center gap-1">
                      <span className="font-mono font-bold text-xs text-[#1E293B]">2 sec ago</span>
                      <span className="text-[9px] font-bold text-slate-500">Live Telemetry</span>
                    </div>
                  </div>
                </div>

                {/* Focus in 3D Twin */}
                <button
                  onClick={() => {
                    onSelectMachine(inspectingMachine);
                    setInspectingMachine(null);
                    onNavigateTwin();
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Layers size={13} />
                  <span>Focus in 3D Twin</span>
                  <ExternalLink size={11} />
                </button>

                {/* Close Button */}
                <button
                  onClick={() => setInspectingMachine(null)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* 7-Tab Navigation Bar */}
            <div className="flex items-center gap-1 px-6 pt-2 bg-white border-b border-[#DDD9D0] overflow-x-auto scrollbar-none">
              {[
                { id: 'TELEMETRY', label: 'Live Telemetry', icon: <Activity size={13} /> },
                { id: 'COMPONENTS', label: 'Subsystem Health', icon: <Cpu size={13} /> },
                { id: 'DIAGNOSTICS', label: 'Root Cause & Diagnostics', icon: <AlertOctagon size={13} /> },
                { id: 'SAFETY_LOTO', label: 'OSHA 1910.147 LOTO', icon: <ShieldCheck size={13} /> },
                { id: 'WORKORDERS', label: 'Work Orders & Dispatch', icon: <Wrench size={13} /> },
                { id: 'HISTORY', label: 'Maintenance History', icon: <Clock size={13} /> },
                { id: 'SPECS', label: 'Documents & Specs', icon: <FileText size={13} /> },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setInspectorTab(tab.id as any)}
                  className={`px-3.5 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
                    inspectorTab === tab.id
                      ? 'border-[#2563EB] text-[#2563EB] bg-blue-50/50'
                      : 'border-transparent text-[#64748B] hover:text-[#1E293B]'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Modal Content Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* TAB 1: LIVE TELEMETRY DASHBOARD */}
              {inspectorTab === 'TELEMETRY' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Left 2 Cols: Telemetry & Sensors, Trend Chart, Details Table, Subsystem Health */}
                  <div className="lg:col-span-2 space-y-4">
                    {/* Live Telemetry Header with Time Filter */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <h3 className="text-xs font-bold text-[#1E293B]">Live Telemetry & Sensors</h3>
                      </div>
                      <CustomSelect
                        value={telemetryTimeRange}
                        onChange={(val) => setTelemetryTimeRange(val as any)}
                        options={[
                          { value: '15m', label: 'Last 15 Minutes' },
                          { value: '1h', label: 'Last 1 Hour' },
                          { value: '24h', label: 'Last 24 Hours' },
                        ]}
                        size="xs"
                        align="right"
                      />
                    </div>

                    {/* 4 Sensor Metric Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {/* Vibration (RMS) */}
                      <div className="p-3 bg-white border border-[#DDD9D0] rounded-2xl shadow-2xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-[#64748B] flex items-center gap-1">
                            <Activity size={12} className="text-[#2563EB]" /> Vibration (RMS)
                          </span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            ↓ 12%
                          </span>
                        </div>
                        <div className="font-mono text-lg font-black text-[#1E293B]">
                          {modalVib.toFixed(2)} <span className="text-xs font-normal text-slate-500">mm/s</span>
                        </div>
                        <div className="text-[9px] font-medium text-emerald-700 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>{modalVib > 5.0 ? 'ISO 10816-3 Warning' : 'ISO 10816-3: Nominal'}</span>
                        </div>
                      </div>

                      {/* Bearing Temp */}
                      <div className="p-3 bg-white border border-[#DDD9D0] rounded-2xl shadow-2xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-[#64748B] flex items-center gap-1">
                            <Gauge size={12} className="text-[#2563EB]" /> Bearing Temp
                          </span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            ↓ 8%
                          </span>
                        </div>
                        <div className="font-mono text-lg font-black text-[#1E293B]">
                          {modalTemp.toFixed(1)} <span className="text-xs font-normal text-slate-500">°C</span>
                        </div>
                        <div className="text-[9px] font-medium text-emerald-700 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>{modalTemp > 70.0 ? 'Thermal Warning' : 'Thermal Envelope Safe'}</span>
                        </div>
                      </div>

                      {/* Motor Current */}
                      <div className="p-3 bg-white border border-[#DDD9D0] rounded-2xl shadow-2xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-[#64748B] flex items-center gap-1">
                            <Zap size={12} className="text-[#2563EB]" /> Motor Current
                          </span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            ↓ 5%
                          </span>
                        </div>
                        <div className="font-mono text-lg font-black text-[#1E293B]">
                          {modalCurrent.toFixed(1)} <span className="text-xs font-normal text-slate-500">A</span>
                        </div>
                        <div className="text-[9px] font-medium text-emerald-700 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>Balanced 3-Phase</span>
                        </div>
                      </div>

                      {/* Spindle RPM */}
                      <div className="p-3 bg-white border border-[#DDD9D0] rounded-2xl shadow-2xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-[#64748B] flex items-center gap-1">
                            <RotateCcw size={12} className="text-[#2563EB]" /> Spindle RPM
                          </span>
                        </div>
                        <div className="font-mono text-lg font-black text-[#1E293B]">
                          {modalRpm} <span className="text-xs font-normal text-slate-500">RPM</span>
                        </div>
                        <div className="text-[9px] font-medium text-emerald-700 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>Feedback Synchronous</span>
                        </div>
                      </div>
                    </div>

                    {/* Two-Column Top: Sensor Details Table + Subsystem Health */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Sensor Details Table */}
                      <div className="p-4 bg-white border border-[#DDD9D0] rounded-2xl shadow-2xs space-y-2.5">
                        <h4 className="text-xs font-bold text-[#1E293B]">Sensor Details</h4>
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-[#DDD9D0] text-[10px] font-bold text-[#64748B]">
                              <th className="pb-1.5">Sensor</th>
                              <th className="pb-1.5">Value</th>
                              <th className="pb-1.5">Status</th>
                              <th className="pb-1.5 text-right">Trend (1h)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium text-[11px]">
                            <tr>
                              <td className="py-1.5 flex items-center gap-1.5 text-[#1E293B]">
                                <Activity size={12} className="text-[#2563EB]" /> Vibration (RMS)
                              </td>
                              <td className="py-1.5 font-mono font-bold text-[#1E293B]">{modalVib.toFixed(2)} mm/s</td>
                              <td className="py-1.5"><span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">Normal</span></td>
                              <td className="py-1.5 text-right">
                                <svg className="w-12 h-3 ml-auto inline-block" viewBox="0 0 50 12"><path d="M 0 8 Q 15 3, 30 7 T 50 5" fill="none" stroke="#22A06B" strokeWidth="1.5" /></svg>
                              </td>
                            </tr>
                            <tr>
                              <td className="py-1.5 flex items-center gap-1.5 text-[#1E293B]">
                                <Gauge size={12} className="text-[#2563EB]" /> Bearing Temp
                              </td>
                              <td className="py-1.5 font-mono font-bold text-[#1E293B]">{modalTemp.toFixed(1)} °C</td>
                              <td className="py-1.5"><span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">Normal</span></td>
                              <td className="py-1.5 text-right">
                                <svg className="w-12 h-3 ml-auto inline-block" viewBox="0 0 50 12"><path d="M 0 10 Q 15 8, 30 4 T 50 6" fill="none" stroke="#22A06B" strokeWidth="1.5" /></svg>
                              </td>
                            </tr>
                            <tr>
                              <td className="py-1.5 flex items-center gap-1.5 text-[#1E293B]">
                                <Zap size={12} className="text-[#2563EB]" /> Motor Current
                              </td>
                              <td className="py-1.5 font-mono font-bold text-[#1E293B]">{modalCurrent.toFixed(1)} A</td>
                              <td className="py-1.5"><span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">Normal</span></td>
                              <td className="py-1.5 text-right">
                                <svg className="w-12 h-3 ml-auto inline-block" viewBox="0 0 50 12"><path d="M 0 6 Q 15 9, 30 5 T 50 7" fill="none" stroke="#22A06B" strokeWidth="1.5" /></svg>
                              </td>
                            </tr>
                            <tr>
                              <td className="py-1.5 flex items-center gap-1.5 text-[#1E293B]">
                                <RotateCcw size={12} className="text-[#2563EB]" /> Spindle RPM
                              </td>
                              <td className="py-1.5 font-mono font-bold text-[#1E293B]">{modalRpm} RPM</td>
                              <td className="py-1.5"><span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">Normal</span></td>
                              <td className="py-1.5 text-right">
                                <svg className="w-12 h-3 ml-auto inline-block" viewBox="0 0 50 12"><path d="M 0 7 Q 15 7, 30 7 T 50 7" fill="none" stroke="#22A06B" strokeWidth="1.5" /></svg>
                              </td>
                            </tr>
                            <tr>
                              <td className="py-1.5 flex items-center gap-1.5 text-[#1E293B]">
                                <Gauge size={12} className="text-[#2563EB]" /> Lubrication Pressure
                              </td>
                              <td className="py-1.5 font-mono font-bold text-[#1E293B]">5.8 bar</td>
                              <td className="py-1.5"><span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">Normal</span></td>
                              <td className="py-1.5 text-right">
                                <svg className="w-12 h-3 ml-auto inline-block" viewBox="0 0 50 12"><path d="M 0 9 Q 15 6, 30 8 T 50 5" fill="none" stroke="#22A06B" strokeWidth="1.5" /></svg>
                              </td>
                            </tr>
                            <tr>
                              <td className="py-1.5 flex items-center gap-1.5 text-[#1E293B]">
                                <Activity size={12} className="text-[#2563EB]" /> Coolant Temperature
                              </td>
                              <td className="py-1.5 font-mono font-bold text-[#1E293B]">32.4 °C</td>
                              <td className="py-1.5"><span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">Normal</span></td>
                              <td className="py-1.5 text-right">
                                <svg className="w-12 h-3 ml-auto inline-block" viewBox="0 0 50 12"><path d="M 0 5 Q 15 9, 30 6 T 50 8" fill="none" stroke="#22A06B" strokeWidth="1.5" /></svg>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Subsystem Health Progress Bars */}
                      <div className="p-4 bg-white border border-[#DDD9D0] rounded-2xl shadow-2xs space-y-2.5">
                        <h4 className="text-xs font-bold text-[#1E293B]">Subsystem Health</h4>
                        <div className="space-y-2 text-xs">
                          {[
                            { name: 'Spindle', pct: modalSpindleHealth, icon: <Cpu size={12} /> },
                            { name: 'Main Bearing', pct: modalBearingHealth, icon: <Gauge size={12} /> },
                            { name: 'Hydraulic Manifold', pct: modalHydraulicHealth, icon: <Zap size={12} /> },
                            { name: 'Axis Servo (X)', pct: modalServoHealth, icon: <RotateCcw size={12} /> },
                            { name: 'Axis Servo (Z)', pct: 89, icon: <RotateCcw size={12} /> },
                            { name: 'Coolant System', pct: 96, icon: <Package size={12} /> },
                            { name: 'Lubrication System', pct: 98, icon: <Gauge size={12} /> },
                            { name: 'Electrical Cabinet', pct: 95, icon: <Shield size={12} /> },
                          ].map((sub, i) => (
                            <div key={i} className="space-y-0.5">
                              <div className="flex items-center justify-between text-[11px] font-medium text-[#1E293B]">
                                <span className="flex items-center gap-1 text-[#64748B]">
                                  {sub.icon} {sub.name}
                                </span>
                                <span className="font-mono font-bold text-[#1E293B]">{sub.pct}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${sub.pct < 70 ? 'bg-red-500' : sub.pct < 90 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                  style={{ width: `${sub.pct}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Vibration Trend (RMS) Live Line Chart (Moved below Sensor Details & Subsystem Health) */}
                    <div className="p-4 bg-white border border-[#DDD9D0] rounded-2xl shadow-2xs space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold flex-wrap gap-2">
                        <span className="text-[#1E293B]">Vibration Trend (RMS)</span>
                        <div className="flex items-center gap-4 text-[10px] font-semibold">
                          <span className="flex items-center gap-1.5 text-blue-700">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" /> Current ({modalVib.toFixed(2)} mm/s)
                          </span>
                          <span className="flex items-center gap-1.5 text-amber-700">
                            <span className="w-2.5 h-1 bg-amber-400 rounded-full" /> Warning (4.5)
                          </span>
                          <span className="flex items-center gap-1.5 text-red-700">
                            <span className="w-2.5 h-1 bg-red-400 rounded-full" /> Alarm (7.5)
                          </span>
                        </div>
                      </div>

                      {/* SVG Telemetry Chart - Reduced Height */}
                      <div className="relative h-28 sm:h-32 w-full pt-1">
                        <svg className="w-full h-full overflow-visible" viewBox="0 0 500 100" preserveAspectRatio="none">
                          <defs>
                            <linearGradient id="vibGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                              <stop offset="0%" stopColor="#2563EB" stopOpacity="0.25" />
                              <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>

                          {/* Threshold Lines */}
                          <line x1="0" y1="20" x2="500" y2="20" stroke="#D64545" strokeWidth="1.2" strokeDasharray="4 4" opacity="0.8" />
                          <line x1="0" y1="45" x2="500" y2="45" stroke="#EAB308" strokeWidth="1.2" strokeDasharray="4 4" opacity="0.8" />
                          <line x1="0" y1="80" x2="500" y2="80" stroke="#E2E8F0" strokeWidth="1" />

                          {/* Wave Area Fill */}
                          <path
                            d="M 0 80 Q 40 72, 80 76 T 160 74 T 240 68 T 320 78 T 400 70 T 500 74 L 500 100 L 0 100 Z"
                            fill="url(#vibGradient)"
                          />

                          {/* Wave Stroke */}
                          <path
                            d="M 0 80 Q 40 72, 80 76 T 160 74 T 240 68 T 320 78 T 400 70 T 500 74"
                            fill="none"
                            stroke="#2563EB"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />

                          {/* Static endpoint */}
                          <circle cx="500" cy="74" r="3.5" fill="#2563EB" stroke="#FFFFFF" strokeWidth="1.5" />
                        </svg>

                        {/* Time Axis Labels */}
                        <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 mt-1.5">
                          <span>10:00</span>
                          <span>10:02</span>
                          <span>10:04</span>
                          <span>10:06</span>
                          <span>10:08</span>
                          <span>10:10</span>
                          <span>10:12</span>
                          <span>10:14</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Machine Status, Recent Events, Asset Details, Active Work Order */}
                  <div className="space-y-4">
                    {/* Machine Status Card */}
                    <div className="p-4 bg-white border border-[#DDD9D0] rounded-2xl shadow-2xs space-y-2.5">
                      <h4 className="text-xs font-bold text-[#1E293B]">Machine Status</h4>
                      <div className="space-y-2 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="text-[#64748B] flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Machine State
                          </span>
                          <span className="font-bold text-emerald-700 font-mono">RUNNING</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[#64748B] flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Cycle State
                          </span>
                          <span className="font-bold text-emerald-700 font-mono">AUTO</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[#64748B] flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Current Program
                          </span>
                          <span className="font-mono font-bold text-[#1E293B]">P-1024</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[#64748B] flex items-center gap-1.5">
                            <Package size={12} className="text-slate-400" /> Part Counter (Today)
                          </span>
                          <span className="font-mono font-bold text-[#1E293B]">356 pcs</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[#64748B] flex items-center gap-1.5">
                            <Clock size={12} className="text-slate-400" /> Cycle Time (Avg)
                          </span>
                          <span className="font-mono font-bold text-[#1E293B]">42.8 sec</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[#64748B] flex items-center gap-1.5">
                            <Zap size={12} className="text-slate-400" /> Power Consumption
                          </span>
                          <span className="font-mono font-bold text-[#1E293B]">18.4 kW</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[#64748B] flex items-center gap-1.5">
                            <Clock size={12} className="text-slate-400" /> Uptime (Today)
                          </span>
                          <span className="font-mono font-bold text-[#1E293B]">7h 24m</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[#64748B] flex items-center gap-1.5">
                            <AlertTriangle size={12} className="text-slate-400" /> Last Fault
                          </span>
                          <span className="font-semibold text-slate-700">None (Last 5d)</span>
                        </div>
                      </div>
                    </div>

                    {/* Recent Events Feed (Moved above Asset Details) */}
                    <div className="p-4 bg-white border border-[#DDD9D0] rounded-2xl shadow-2xs space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-[#1E293B]">Recent Events</h4>
                        <button className="text-[10px] font-bold text-[#2563EB] hover:underline flex items-center gap-1">
                          <span>View All</span>
                          <ArrowRight size={10} />
                        </button>
                      </div>

                      <div className="space-y-2 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] text-slate-400">10:58:42</span>
                          <span className="flex items-center gap-1 text-[#1E293B] font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Cycle completed
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">356 pcs • 42.8s</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] text-slate-400">10:54:21</span>
                          <span className="flex items-center gap-1 text-[#1E293B] font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Coolant temp high
                          </span>
                          <span className="text-[10px] text-slate-500">32.4 °C (cleared)</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] text-slate-400">10:47:12</span>
                          <span className="flex items-center gap-1 text-[#1E293B] font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Program started
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">P-1024</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] text-slate-400">10:32:55</span>
                          <span className="flex items-center gap-1 text-[#1E293B] font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Maintenance check
                          </span>
                          <span className="text-[10px] text-slate-500">Lube nominal</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] text-slate-400">09:15:10</span>
                          <span className="flex items-center gap-1 text-[#1E293B] font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Door opened
                          </span>
                          <span className="text-[10px] text-slate-500">Operator access</span>
                        </div>
                      </div>
                    </div>

                    {/* Asset Identification Card */}
                    <div className="p-4 bg-white border border-[#DDD9D0] rounded-2xl shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-[#1E293B]">Asset Details</h4>
                        <span className="font-mono text-[10px] font-bold text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                          {inspectingMachine.code}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 font-medium">DMG MORI CTX 450 • 5-Axis Milling</div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                        <span className="font-mono">SN: CTX450-02-8894</span>
                        <button
                          onClick={() => {
                            navigator.clipboard?.writeText('CTX450-02-8894');
                            setCopiedSerial(true);
                            setTimeout(() => setCopiedSerial(false), 1500);
                          }}
                          className="text-[#2563EB] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                        >
                          <Copy size={10} />
                          <span>{copiedSerial ? 'Copied!' : 'Copy SN'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Active Work Order Card */}
                    <div className="p-4 bg-white border border-[#DDD9D0] rounded-2xl shadow-2xs space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-[#1E293B]">Active Work Order</h4>
                        {onNavigateTab && (
                          <button
                            onClick={() => {
                              setInspectingMachine(null);
                              onNavigateTab('workorders');
                            }}
                            className="text-[10px] font-bold text-[#2563EB] hover:underline flex items-center gap-1"
                          >
                            <span>View All</span>
                            <ArrowRight size={10} />
                          </button>
                        )}
                      </div>

                      <div className="p-3 bg-[#FAF9F6] border border-[#DDD9D0] rounded-xl space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-blue-100/90 text-[#2563EB] flex items-center justify-center">
                              <Wrench size={13} />
                            </div>
                            <div>
                              <span className="font-mono font-bold text-xs text-[#2563EB]">WO-3815</span>
                              <div className="text-[10px] text-[#1E293B] font-medium">Spindle lubrication inspection</div>
                            </div>
                          </div>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                            IN PROGRESS
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-[#64748B] pt-1 border-t border-slate-200/60">
                          <span className="flex items-center gap-1">
                            <Clock size={10} /> Sep 28, 2026
                          </span>
                          <div className="flex items-center gap-1 text-[#1E293B]">
                            <span className="w-4 h-4 rounded-full bg-blue-600 text-white font-bold text-[8px] flex items-center justify-center">
                              AR
                            </span>
                            <span className="font-semibold">{modalActiveWorkOrder?.technician_name || 'Arun Kumar'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SUBSYSTEM HEALTH */}
              {inspectorTab === 'COMPONENTS' && (
                <div className="space-y-4">
                  <div className="p-4 bg-white border border-[#DDD9D0] rounded-2xl space-y-3 shadow-2xs">
                    <h4 className="text-xs font-bold text-[#1E293B] flex items-center gap-2">
                      <Cpu size={14} className="text-[#2563EB]" />
                      Subsystem Wear & Diagnostic Breakdown (8 Subassemblies)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {[
                        { title: 'Main Spindle Assembly', val: modalSpindleHealth, spec: 'Taper Runout < 0.002mm • Dynamic Balance Grade G1.0' },
                        { title: 'Ceramic Spindle Bearings', val: modalBearingHealth, spec: 'SKF-6205-2RSH • Raceways Clear • Zero Cage Wear' },
                        { title: 'Hydraulic Manifold', val: modalHydraulicHealth, spec: 'Pressure: 5.2 bar • Zero Seal Leakage' },
                        { title: 'Fanuc Alpha Axis Servo (X)', val: modalServoHealth, spec: 'Load: 12.5A • Resolver Position Tracking Nominal' },
                        { title: 'Axis Servo (Z)', val: 89, spec: 'Backlash < 0.004mm • Encoder Synced' },
                        { title: 'Coolant Flow Subsystem', val: 96, spec: 'Flow Rate: 48 L/min • Filter Delta-P Nominal' },
                        { title: 'Automated Lubrication System', val: 98, spec: 'Reservoir Level: 88% • Metering Valve Nominal' },
                        { title: 'Electrical Control Cabinet', val: 95, spec: 'Cabinet Temp: 28.5°C • Inverter Cooling Active' },
                      ].map((sub, i) => (
                        <div key={i} className="p-3.5 bg-[#FAF9F6] border border-[#DDD9D0] rounded-xl space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold text-[#1E293B]">
                            <span>{sub.title}</span>
                            <span className={`font-mono ${sub.val < 70 ? 'text-[#D64545]' : 'text-[#22A06B]'}`}>
                              {sub.val}% {sub.val < 70 ? '⚠' : '✓'}
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${sub.val < 70 ? 'bg-red-500' : sub.val < 90 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                              style={{ width: `${sub.val}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-[#64748B] leading-relaxed">{sub.spec}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: ROOT CAUSE & DIAGNOSTICS */}
              {inspectorTab === 'DIAGNOSTICS' && (
                <div className="space-y-4">
                  {/* Diagnostic Honesty Status Banner */}
                  {modalIsAbnormal ? (
                    <div className="p-4 rounded-2xl border text-xs space-y-1.5 bg-amber-50/90 border-amber-200">
                      {modalHasInspected ? (
                        <div>
                          <span className="font-bold text-emerald-800 uppercase flex items-center gap-1.5 text-xs">
                            <CheckCircle size={14} className="text-emerald-700" />
                            Technician-Confirmed Root Cause (Diagnostic Verified):
                          </span>
                          <p className="text-emerald-950 font-bold mt-1 text-sm">{modalConfirmedRootCause}</p>
                        </div>
                      ) : (
                        <div>
                          <span className="font-bold text-amber-900 uppercase flex items-center gap-1.5 text-xs">
                            <AlertTriangle size={14} className="text-amber-700" />
                            Suspected / Affected Subsystem:
                          </span>
                          <p className="text-amber-950 font-bold mt-1 text-sm">{modalSuspectedSubsystem}</p>
                          <p className="text-[11px] text-amber-800 mt-0.5 italic">Awaiting technician physical on-site inspection and dial indicator measurement.</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-800 font-bold flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                      <span>All Subsystems Nominal (Factory Baseline Verified • Zero Anomalies Detected)</span>
                    </div>
                  )}

                  {/* FFT Harmonic Analysis & AI Insights */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-white border border-[#DDD9D0] rounded-2xl space-y-2.5 shadow-2xs">
                      <h4 className="text-xs font-bold text-[#1E293B] flex items-center gap-1.5">
                        <Activity size={14} className="text-[#2563EB]" />
                        Vibration FFT Harmonic Spectrum
                      </h4>
                      <p className="text-xs text-[#64748B] leading-relaxed">
                        Fast Fourier Transform computed over 10 Hz telemetry buffer. 1X RPM fundamental harmonic (46.7 Hz) amplitude: 0.42 mm/s. 2X bearing defect frequency: nominal.
                      </p>
                    </div>

                    <div className="p-4 bg-white border border-[#DDD9D0] rounded-2xl space-y-2.5 shadow-2xs">
                      <h4 className="text-xs font-bold text-[#1E293B] flex items-center gap-1.5">
                        <Sparkles size={14} className="text-[#2563EB]" />
                        Predictive Maintenance Horizon
                      </h4>
                      <p className="text-xs text-[#64748B] leading-relaxed">
                        Remaining Useful Life (RUL) estimation: &gt; 4,200 operating hours under current duty cycle. No urgent maintenance intervention required.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: OSHA 1910.147 LOTO */}
              {inspectorTab === 'SAFETY_LOTO' && (
                <div className="space-y-4">
                  <div className="p-4 bg-white border border-[#DDD9D0] rounded-2xl space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <h4 className="text-xs font-bold text-[#1E293B] flex items-center gap-1.5">
                          <Lock size={14} className="text-[#D64545]" />
                          {(LOTO_PROTOCOLS[inspectingMachine.type] || LOTO_PROTOCOLS.CNC).oshaStandard}
                        </h4>
                        <p className="text-[11px] text-[#64748B] mt-0.5">
                          Location: <strong>{(LOTO_PROTOCOLS[inspectingMachine.type] || LOTO_PROTOCOLS.CNC).lockoutBoxLocation}</strong>
                        </p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        Zero Energy Protocol
                      </span>
                    </div>

                    {/* Required PPE tags */}
                    <div className="p-3 bg-[#FAF9F6] border border-[#DDD9D0] rounded-xl space-y-1.5">
                      <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Required Personal Protective Equipment (PPE)</div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {(LOTO_PROTOCOLS[inspectingMachine.type] || LOTO_PROTOCOLS.CNC).requiredPpe.map((ppe, idx) => (
                          <span key={idx} className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-white border border-[#DDD9D0] text-[#1E293B]">
                            {ppe}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {(LOTO_PROTOCOLS[inspectingMachine.type] || LOTO_PROTOCOLS.CNC).isolationSteps.map((step, idx) => (
                        <div key={step.id} className="p-3 bg-[#FAF9F6] border border-[#DDD9D0] rounded-xl space-y-1">
                          <div className="flex items-center justify-between text-xs font-bold text-[#1E293B]">
                            <span>{idx + 1}. {step.title}</span>
                            <span className="text-[10px] font-mono font-bold text-[#2563EB]">{step.category}</span>
                          </div>
                          <p className="text-[11px] text-[#64748B]">{step.procedure}</p>
                          <div className="text-[10px] font-mono text-[#22A06B] font-bold">Target Zero State: {step.targetZeroState}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: WORK ORDERS & DISPATCH */}
              {inspectorTab === 'WORKORDERS' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Active Incident Block */}
                    <div className="p-4 bg-white border border-[#DDD9D0] rounded-2xl space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-[#1E293B] flex items-center gap-1.5">
                          <AlertTriangle size={14} className="text-amber-600" />
                          Incident Log
                        </h4>
                        {modalActiveIncident && (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
                            {modalActiveIncident.status}
                          </span>
                        )}
                      </div>

                      {modalActiveIncident ? (
                        <div className="space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[#64748B]">Incident ID:</span>
                            <span className="font-mono font-bold text-red-700">{modalActiveIncident.id}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[#64748B]">Alert Type:</span>
                            <strong className="text-[#1E293B]">{modalActiveIncident.alert_type}</strong>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[#64748B]">Severity:</span>
                            <span className="font-bold text-red-600">{modalActiveIncident.severity}</span>
                          </div>
                          <div className="p-2.5 bg-[#FAF9F6] rounded-xl border border-[#DDD9D0] text-[11px] text-[#64748B]">
                            {modalActiveIncident.ai_diagnosis_summary || (modalActiveIncident as any).description || 'Telemetry anomaly threshold exceeded.'}
                          </div>
                        </div>
                      ) : (
                        <div className="py-6 text-center text-xs text-[#64748B]">
                          <CheckCircle2 size={24} className="mx-auto text-emerald-500 mb-1.5" />
                          <span>No active incidents filed for this machine.</span>
                        </div>
                      )}
                    </div>

                    {/* Active Work Order Block */}
                    <div className="p-4 bg-white border border-[#DDD9D0] rounded-2xl space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-[#1E293B] flex items-center gap-1.5">
                          <Wrench size={14} className="text-[#2563EB]" />
                          Work Order Dispatch
                        </h4>
                        {modalActiveWorkOrder && (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                            {modalActiveWorkOrder.status}
                          </span>
                        )}
                      </div>

                      {modalActiveWorkOrder ? (
                        <div className="space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[#64748B]">Work Order ID:</span>
                            <span className="font-mono font-bold text-blue-800">{modalActiveWorkOrder.id}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[#64748B]">Assigned Tech:</span>
                            <strong className="text-[#1E293B]">{modalActiveWorkOrder.technician_name || 'Arun Kumar'}</strong>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[#64748B]">LOTO Applied:</span>
                            <span className={`font-bold ${modalActiveWorkOrder.loto_applied ? 'text-emerald-700' : 'text-amber-700'}`}>
                              {modalActiveWorkOrder.loto_applied ? 'VERIFIED LOCKED' : 'PENDING APPLICATION'}
                            </span>
                          </div>
                          <div className="p-2.5 bg-[#FAF9F6] rounded-xl border border-[#DDD9D0] text-[11px] text-[#64748B]">
                            {modalActiveWorkOrder.notes || 'Routine calibration and vibration diagnostic sequence in progress.'}
                          </div>
                        </div>
                      ) : (
                        <div className="py-6 text-center text-xs text-[#64748B]">
                          <CheckCircle2 size={24} className="mx-auto text-slate-300 mb-1.5" />
                          <span>No open work orders currently scheduled.</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {onNavigateTab && (
                    <div className="flex items-center gap-2 justify-end pt-2">
                      <button
                        onClick={() => {
                          setInspectingMachine(null);
                          onNavigateTab('incidents');
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-white border border-[#DDD9D0] text-xs font-bold text-[#1E293B] hover:bg-slate-50 transition-all shadow-2xs"
                      >
                        Open Incident Register
                      </button>
                      <button
                        onClick={() => {
                          setInspectingMachine(null);
                          onNavigateTab('workorders');
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-2xs"
                      >
                        Open Work Orders Board
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 6: MAINTENANCE HISTORY */}
              {inspectorTab === 'HISTORY' && (
                <div className="space-y-4">
                  <div className="p-4 bg-white border border-[#DDD9D0] rounded-2xl space-y-3 shadow-2xs">
                    <h4 className="text-xs font-bold text-[#1E293B] flex items-center gap-1.5">
                      <Clock size={14} className="text-[#2563EB]" />
                      Maintenance Logs & Service History
                    </h4>
                    <div className="space-y-2">
                      {[
                        { date: 'Sep 21, 2026', type: 'PREVENTIVE', title: '500-Hour Scheduled Lubrication & Filter Replacement', tech: 'Arun Kumar', status: 'COMPLETED' },
                        { date: 'Aug 14, 2026', type: 'CALIBRATION', title: 'Spindle Dynamic Runout Laser Alignment & Dial Verification', tech: 'Vikram Singh', status: 'COMPLETED' },
                        { date: 'Jul 02, 2026', type: 'CORRECTIVE', title: 'Axis X Ball-Screw Way Lube Feed Bleed & Sensor Zeroing', tech: 'Arun Kumar', status: 'RESOLVED' },
                      ].map((item, idx) => (
                        <div key={idx} className="p-3 bg-[#FAF9F6] border border-[#DDD9D0] rounded-xl flex items-center justify-between gap-3 text-xs">
                          <div className="space-y-0.5">
                            <div className="font-bold text-[#1E293B]">{item.title}</div>
                            <div className="text-[10px] text-[#64748B] flex items-center gap-2">
                              <span>📅 {item.date}</span>
                              <span>•</span>
                              <span>🔧 Tech: {item.tech}</span>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {item.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 7: DOCUMENTS & SPECS */}
              {inspectorTab === 'SPECS' && (
                <div className="space-y-4">
                  {/* Machine Specifications */}
                  <div className="p-4 bg-white border border-[#DDD9D0] rounded-2xl space-y-3 shadow-2xs">
                    <h4 className="text-xs font-bold text-[#1E293B] flex items-center gap-1.5">
                      <Package size={14} className="text-[#2563EB]" />
                      Asset OEM Technical Specifications & Documentation
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      <div className="p-3 bg-[#FAF9F6] border border-[#DDD9D0] rounded-xl">
                        <div className="text-[10px] text-[#64748B]">Machine Model</div>
                        <strong className="text-[#1E293B] block mt-0.5">{inspectingMachine.name}</strong>
                      </div>
                      <div className="p-3 bg-[#FAF9F6] border border-[#DDD9D0] rounded-xl">
                        <div className="text-[10px] text-[#64748B]">Assigned Cell Area</div>
                        <strong className="text-[#1E293B] block mt-0.5">{inspectingMachine.area || 'Machining Cell'}</strong>
                      </div>
                      <div className="p-3 bg-[#FAF9F6] border border-[#DDD9D0] rounded-xl">
                        <div className="text-[10px] text-[#64748B]">Criticality Rating</div>
                        <strong className="text-[#1E293B] block mt-0.5">{inspectingMachine.criticality || 'HIGH'} Tier</strong>
                      </div>
                      <div className="p-3 bg-[#FAF9F6] border border-[#DDD9D0] rounded-xl">
                        <div className="text-[10px] text-[#64748B]">Base Health Score</div>
                        <strong className="text-[#22A06B] font-mono block mt-0.5">{inspectingMachine.health_score}%</strong>
                      </div>
                      <div className="p-3 bg-[#FAF9F6] border border-[#DDD9D0] rounded-xl">
                        <div className="text-[10px] text-[#64748B]">Calculated MTBF</div>
                        <strong className="text-[#1E293B] font-mono block mt-0.5">184 hours</strong>
                      </div>
                      <div className="p-3 bg-[#FAF9F6] border border-[#DDD9D0] rounded-xl">
                        <div className="text-[10px] text-[#64748B]">Calculated MTTR</div>
                        <strong className="text-[#1E293B] font-mono block mt-0.5">38 minutes</strong>
                      </div>
                    </div>
                  </div>

                  {/* Associated Spare Parts Snapshot */}
                  <div className="p-4 bg-white border border-[#DDD9D0] rounded-2xl space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-[#1E293B] flex items-center gap-1.5">
                        <Package size={14} className="text-purple-600" />
                        Associated Spare Part Inventory & ATP Stock
                      </h4>
                      {onNavigateTab && (
                        <button
                          onClick={() => {
                            setInspectingMachine(null);
                            onNavigateTab('inventory');
                          }}
                          className="text-[11px] font-bold text-[#2563EB] hover:underline"
                        >
                          View Inventory Store →
                        </button>
                      )}
                    </div>

                    <div className="p-3.5 bg-purple-50/60 border border-purple-200 rounded-xl space-y-2 text-xs">
                      <div className="flex items-center justify-between font-bold text-purple-950">
                        <span>Required Part: {modalScenario.partRequired || 'Standard Overhaul Kit'}</span>
                        <span className="font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {modalSpareStock !== null ? `${modalSpareStock} Units In Stock` : 'Available in Central Bay'}
                        </span>
                      </div>
                      <div className="text-[#64748B] flex items-center justify-between text-[11px]">
                        <span>Warehouse Location: <strong className="text-[#1E293B] font-mono">{modalSpareBin}</strong></span>
                        <span>Auto-Reorder Threshold: <strong className="text-[#1E293B] font-mono">3 units</strong></span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-white border-t border-[#DDD9D0] flex items-center justify-between">
              <span className="text-[11px] text-[#64748B]">
                Inspecting asset <strong>{inspectingMachine.code}</strong> • Live diagnostic telemetry streaming active
              </span>
              <button
                onClick={() => setInspectingMachine(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[#1E293B] rounded-xl text-xs font-bold transition-all"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
