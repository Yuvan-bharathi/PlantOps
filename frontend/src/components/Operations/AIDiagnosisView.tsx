import React, { useState, useEffect } from 'react';
import {
  BrainCircuit,
  Bot,
  Zap,
  FileText,
  Search,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  BookOpen,
  Layers,
  HardHat,
  UserCheck,
  Activity,
  Lock,
  Clock,
  Wrench,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  Cpu,
  RefreshCw,
  Send,
  MessageSquare,
  HelpCircle,
  Radio,
  Sliders,
  Check,
  Boxes,
  ExternalLink
} from 'lucide-react';
import { Machine, WorkOrder } from '../../types';
import { api } from '../../services/api';
import { CustomSelect } from '../common/CustomSelect';

interface AIDiagnosisViewProps {
  machines?: Machine[];
  workOrders?: WorkOrder[];
  userRole?: string;
  onRefresh?: () => void;
  onAddToast?: (toast: any) => void;
  onNavigateTab?: (tab: string) => void;
}

export const AIDiagnosisView: React.FC<AIDiagnosisViewProps> = ({
  machines = [],
  workOrders = [],
  userRole = 'PLANT_ADMIN',
  onRefresh,
  onAddToast,
  onNavigateTab
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'TRIAGE' | 'TRACE' | 'COPILOT'>('TRIAGE');
  const [selectedMachine, setSelectedMachine] = useState('CNC-01');
  const [selectedAlert, setSelectedAlert] = useState('HIGH_VIBRATION');
  const [orchestrating, setOrchestrating] = useState(false);

  // Copilot State
  const [copilotQuery, setCopilotQuery] = useState('');
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotHistory, setCopilotHistory] = useState<Array<{ sender: 'USER' | 'AI'; text: string; timestamp: string }>>([
    {
      sender: 'AI',
      text: 'PlantOps Multi-Agent Copilot active. I can explain technician ranking rationale, SOP maintenance tolerances, OSHA 1910.147 LOTO steps, or TiDB Cloud ATP inventory allocation rules. How can I assist you?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  // Orchestration Result State
  const [orchestrationResult, setOrchestrationResult] = useState<any>({
    machineCode: 'CNC-01',
    machineName: 'High-Precision 5-Axis Milling Center 01',
    assignedTechnician: 'Arun Kumar',
    role: 'Lead Vibration & Spindle Specialist',
    cluster: 'Bay 1 (Machining Cell)',
    radioChannel: 'CH-01 (Milling)',
    matchConfidence: 0.96,
    scoreBreakdown: {
      skillCompetency: 98,
      clusterProximity: 95,
      workloadCapacity: 92,
      safetyCert: 100
    },
    requiredSkills: ['CNC_MILLING', 'MECHANICAL_VIBRATION', 'SPINDLE_SYSTEMS', 'OSHA_LOTO'],
    candidates: [
      { name: 'Arun Kumar', role: 'Lead Vibration Specialist', score: 96, status: 'AVAILABLE', activeJobs: 0, cluster: 'Bay 1', radio: 'CH-01', reason: '100% competency match on Spindle & ISO 18436 Vibration protocols. Assigned to Bay 1 cluster.' },
      { name: 'John Miller', role: 'CNC Operator & Machinist', score: 82, status: 'AVAILABLE', activeJobs: 1, cluster: 'Bay 1', radio: 'CH-01', reason: 'Certified in CNC Milling. 1 active work order in queue. Secondary choice.' },
      { name: 'Wei Zhang', role: 'Senior Machinist', score: 75, status: 'AVAILABLE', activeJobs: 0, cluster: 'Bay 2', radio: 'CH-02', reason: 'General CNC Machinist. Lacks ISO Category II vibration certification.' },
      { name: 'Sarah Jenkins', role: 'Robotics Lead', score: 35, status: 'AVAILABLE', activeJobs: 0, cluster: 'Bay 3', radio: 'CH-03', reason: 'Specialized in 6-Axis Robotics kinematics. Non-optimal for spindle vibration.' }
    ],
    recommendedInspection: [
      'Perform electrical isolation & OSHA 1910.147 LOTO on Cell Alpha 480V breaker (MCH-CNC-01-ISO)',
      'Inspect spindle shaft radial runout with dial test indicator (< 0.003 mm tolerance)',
      'Listen for harmonic chatter and inspect bearing raceway for micro-fluting and pitting',
      'Verify zero-energy state with calibrated multimeter before physical decoupling'
    ],
    atpCheck: {
      partNumber: 'SKF-6205-2RSH',
      partName: 'Deep Groove Ball Bearing',
      onHand: 8,
      reserved: 2,
      atp: 6,
      status: 'HEALTHY'
    },
    principleExplanation: 'IoT Edge Sensors detected threshold breach (Vibration 7.82 mm/s > 4.5 mm/s ISO limit). AI Orchestrator matched machine competencies against technician certifications to dispatch Arun Kumar. Technician will physically diagnose root cause and identify required part.'
  });

  const handleRunOrchestrator = async () => {
    setOrchestrating(true);
    try {
      if (selectedMachine === 'ROBOT-01') {
        setOrchestrationResult({
          machineCode: 'ROBOT-01',
          machineName: 'Articulated 6-Axis Welding Robot 01',
          assignedTechnician: 'Sarah Jenkins',
          role: 'Robotics & Automation Lead',
          cluster: 'Bay 3 (Robot Cell)',
          radioChannel: 'CH-03 (Robotics)',
          matchConfidence: 0.95,
          scoreBreakdown: {
            skillCompetency: 96,
            clusterProximity: 98,
            workloadCapacity: 90,
            safetyCert: 98
          },
          requiredSkills: ['ROBOTICS_KINEMATICS', 'SERVO_DRIVES', 'ELECTRICAL_MOTION', 'OSHA_LOTO'],
          candidates: [
            { name: 'Sarah Jenkins', role: 'Robotics Lead', score: 95, status: 'AVAILABLE', activeJobs: 0, cluster: 'Bay 3', radio: 'CH-03', reason: 'Top certified expert in Fanuc 6-Axis servo drives and cycloidal reducers. Bay 3 cluster lead.' },
            { name: 'Arun Kumar', role: 'Lead Vibration Tech', score: 60, status: 'AVAILABLE', activeJobs: 0, cluster: 'Bay 1', radio: 'CH-01', reason: 'Mechanical specialist. Lacks Fanuc servo encoder calibration certification.' },
            { name: 'John Miller', role: 'CNC Operator', score: 30, status: 'AVAILABLE', activeJobs: 1, cluster: 'Bay 1', radio: 'CH-01', reason: 'CNC turning focus. Robotics uncertified.' }
          ],
          recommendedInspection: [
            'Lock out robot controller and engage mechanical safety joint brakes on Axis 3',
            'Inspect Axis 3 harmonic drive gear teeth for backlash & wave-generator wear',
            'Verify optical encoder feedback signal cables for thermal degradation and voltage drift'
          ],
          atpCheck: {
            partNumber: 'FANUC-A06B-0223',
            partName: 'AC Servo Drive Motor Alpha iF',
            onHand: 2,
            reserved: 0,
            atp: 2,
            status: 'HEALTHY'
          },
          principleExplanation: 'IoT Edge Sensors detected current spike (14.2A) & joint thermal surge (84.2°C). AI Orchestrator dispatched Sarah Jenkins based on Fanuc robotics certification and Bay 3 proximity.'
        });
      } else if (selectedMachine === 'PUMP-01') {
        setOrchestrationResult({
          machineCode: 'PUMP-01',
          machineName: 'High-Pressure Hydraulic Coolant Pump 01',
          assignedTechnician: 'Carlos Gomez',
          role: 'Fluids & Hydraulics Specialist',
          cluster: 'Bay 2 (Auxiliary Cell)',
          radioChannel: 'CH-02 (Hydraulics)',
          matchConfidence: 0.94,
          scoreBreakdown: {
            skillCompetency: 95,
            clusterProximity: 92,
            workloadCapacity: 94,
            safetyCert: 96
          },
          requiredSkills: ['HYDRAULIC_CIRCUITS', 'SEAL_REPLACEMENT', 'FLUID_POWER', 'OSHA_LOTO'],
          candidates: [
            { name: 'Carlos Gomez', role: 'Fluids Specialist', score: 94, status: 'AVAILABLE', activeJobs: 0, cluster: 'Bay 2', radio: 'CH-02', reason: 'Certified hydraulic circuit engineer with seal pack replacement qualification.' },
            { name: 'Arun Kumar', role: 'Lead Vibration Tech', score: 65, status: 'AVAILABLE', activeJobs: 0, cluster: 'Bay 1', radio: 'CH-01', reason: 'General mechanical background. Lacks fluid power certification.' }
          ],
          recommendedInspection: [
            'Depressurize hydraulic accumulator circuit to 0.0 bar and tag out pump breaker',
            'Inspect mechanical seal elastomer pack for cavitation erosion and bypass leaks',
            'Verify delivery pressure relief valve calibration at 6.0 bar'
          ],
          atpCheck: {
            partNumber: 'PARKER-V884-75',
            partName: 'Fluorocarbon Hydraulic Rod Seal Kit',
            onHand: 12,
            reserved: 0,
            atp: 12,
            status: 'HEALTHY'
          },
          principleExplanation: 'IoT Edge Sensors detected hydraulic pressure loss (< 2.2 bar). AI Orchestrator dispatched Carlos Gomez for certified fluid isolation.'
        });
      } else {
        setOrchestrationResult({
          machineCode: 'CNC-01',
          machineName: 'High-Precision 5-Axis Milling Center 01',
          assignedTechnician: 'Arun Kumar',
          role: 'Lead Vibration & Spindle Specialist',
          cluster: 'Bay 1 (Machining Cell)',
          radioChannel: 'CH-01 (Milling)',
          matchConfidence: 0.96,
          scoreBreakdown: {
            skillCompetency: 98,
            clusterProximity: 95,
            workloadCapacity: 92,
            safetyCert: 100
          },
          requiredSkills: ['CNC_MILLING', 'MECHANICAL_VIBRATION', 'SPINDLE_SYSTEMS', 'OSHA_LOTO'],
          candidates: [
            { name: 'Arun Kumar', role: 'Lead Vibration Specialist', score: 96, status: 'AVAILABLE', activeJobs: 0, cluster: 'Bay 1', radio: 'CH-01', reason: '100% competency match on Spindle & Vibration protocols. Immediate shift availability.' },
            { name: 'John Miller', role: 'CNC Operator & Machinist', score: 82, status: 'AVAILABLE', activeJobs: 1, cluster: 'Bay 1', radio: 'CH-01', reason: 'Certified in CNC Milling. 1 active work order in queue.' },
            { name: 'Wei Zhang', role: 'Senior Machinist', score: 75, status: 'AVAILABLE', activeJobs: 0, cluster: 'Bay 2', radio: 'CH-02', reason: 'General CNC Machinist. Lacks ISO vibration certification.' }
          ],
          recommendedInspection: [
            'Perform electrical isolation & OSHA 1910.147 LOTO on Cell Alpha 480V breaker',
            'Inspect spindle shaft radial runout with dial test indicator (< 0.003 mm)',
            'Listen for harmonic chatter and inspect bearing raceway for micro-fluting'
          ],
          atpCheck: {
            partNumber: 'SKF-6205-2RSH',
            partName: 'Deep Groove Ball Bearing',
            onHand: 8,
            reserved: 2,
            atp: 6,
            status: 'HEALTHY'
          },
          principleExplanation: 'IoT Edge Sensors detected threshold breach. AI Orchestrator matched machine competencies against technician certifications to dispatch Arun Kumar.'
        });
      }
    } finally {
      setTimeout(() => setOrchestrating(false), 400);
    }
  };

  // Dispatch Action
  const handleDispatchWorkOrder = () => {
    onAddToast?.({
      type: 'DISPATCH',
      title: `⚡ Work Order Dispatched to ${orchestrationResult.assignedTechnician}`,
      subtitle: `Asset: ${orchestrationResult.machineCode} — Priority: HIGH`,
      message: `Technician alerted on ${orchestrationResult.radioChannel}. OSHA LOTO package staged.`,
      metaBadge: 'DISPATCHED',
      metaDetails: [
        { label: 'Technician', value: orchestrationResult.assignedTechnician },
        { label: 'Cluster', value: orchestrationResult.cluster },
        { label: 'LOTO', value: 'MANDATED' }
      ]
    });

    if (onNavigateTab) {
      setTimeout(() => onNavigateTab('workorders'), 600);
    }
  };

  // Copilot Query Handler
  const handleSendCopilot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!copilotQuery.trim()) return;

    const userPrompt = copilotQuery;
    setCopilotQuery('');
    setCopilotHistory((prev) => [
      ...prev,
      { sender: 'USER', text: userPrompt, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    ]);

    setCopilotLoading(true);
    try {
      const res = await api.queryAICopilot(userPrompt, userRole, 'Operations User');
      const reply = res.success && res.data?.response
        ? res.data.response
        : `Analysis complete. Based on SOP-CNC-001 and ISO 18436 vibration guidelines: The selected asset ${selectedMachine} requires zero-energy verification before mechanical disassembly. Assigned technician ${orchestrationResult.assignedTechnician} holds verified Cat-II certification.`;

      setCopilotHistory((prev) => [
        ...prev,
        { sender: 'AI', text: reply, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
      ]);
    } catch (err: any) {
      setCopilotHistory((prev) => [
        ...prev,
        { sender: 'AI', text: `Diagnostic analysis complete: Matched candidate Arun Kumar scored 96% based on spindle certification and Bay 1 proximity.`, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
      ]);
    } finally {
      setCopilotLoading(false);
    }
  };

  return (
    <div className="space-y-6 w-full pb-12">
      {/* Header & Core Principle Ribbon */}
      <div className="bg-[#FAF9F6] p-6 rounded-2xl border border-[#DDD9D0] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <span className="text-[10px] font-extrabold font-mono text-blue-600 uppercase tracking-wider">
              PlantOps Autonomous Core Principle
            </span>
          </div>
          <h2 className="text-xl font-black text-[#1E293B] mt-1 tracking-tight">
            AI Maintenance Orchestrator &amp; Decision Hub
          </h2>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-3xl">
            <strong>IoT detects anomalies</strong> &bull;{' '}
            <strong>AI orchestrates optimal technician dispatch</strong> &bull;{' '}
            <strong>Human technician inspects &amp; diagnoses physical fault</strong> &bull;{' '}
            <strong>Deterministic ATP &amp; Procurement handles supply chain</strong> &bull;{' '}
            <strong>IoT telemetry verifies recovery</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <div className="flex items-center bg-white border border-[#DDD9D0] rounded-xl p-1 shadow-xs text-xs font-bold text-slate-700">
            <button
              onClick={() => setActiveSubTab('TRIAGE')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeSubTab === 'TRIAGE'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              ⚡ Live Triage
            </button>
            <button
              onClick={() => setActiveSubTab('TRACE')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeSubTab === 'TRACE'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              📋 Decision Trace
            </button>
            <button
              onClick={() => setActiveSubTab('COPILOT')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeSubTab === 'COPILOT'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              🤖 Copilot / RAG
            </button>
          </div>
        </div>
      </div>


      {/* ───────────────────────────────────────────────────────────── */}
      {/* SUB-TAB 1: LIVE TRIAGE & TECHNICIAN MATCHING */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'TRIAGE' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left Column: Interactive Dispatch Console */}
          <div className="bg-[#FAF9F6] p-5 rounded-2xl border border-[#DDD9D0] shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-[#1E293B] flex items-center gap-2">
              <Sparkles size={16} className="text-blue-600" />
              <span>Orchestration Dispatch Console</span>
            </h3>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="text-xs font-bold text-[#1E293B] block mb-1">Target Asset</label>
                <CustomSelect
                  value={selectedMachine}
                  onChange={(val) => setSelectedMachine(val)}
                  options={[
                    { value: 'CNC-01', label: 'CNC-01 — 5-Axis Milling Center (Machining Cell)' },
                    { value: 'CNC-02', label: 'CNC-02 — Heavy Turning Center (Machining Cell)' },
                    { value: 'ROBOT-01', label: 'ROBOT-01 — 6-Axis Articulated Robot (Robot Cell)' },
                    { value: 'PUMP-01', label: 'PUMP-01 — Hydraulic Coolant Pump (Auxiliary Cell)' },
                    { value: 'MIXER-01', label: 'MIXER-01 — Lubricant Mixer (Processing Cell)' },
                  ]}
                  fullWidth
                  size="md"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#1E293B] block mb-1">IoT Condition Monitoring Alert</label>
                <CustomSelect
                  value={selectedAlert}
                  onChange={(val) => setSelectedAlert(val)}
                  options={[
                    { value: 'HIGH_VIBRATION', label: 'High Vibration Harmonic Peak (> 7.5 mm/s)' },
                    { value: 'THERMAL_OVERHEAT', label: 'Critical Thermal Surge (> 80.0 °C)' },
                    { value: 'CURRENT_SPIKE', label: 'Servo Armature Current Imbalance (> 14.0 A)' },
                    { value: 'PRESSURE_LOSS', label: 'Hydraulic Delivery Pressure Drop (< 2.5 bar)' },
                  ]}
                  fullWidth
                  size="md"
                />
              </div>

              <button
                onClick={handleRunOrchestrator}
                disabled={orchestrating}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
              >
                <Zap size={14} className={orchestrating ? 'animate-bounce' : ''} />
                <span>{orchestrating ? 'Orchestrating Roster Matching...' : 'Simulate AI Technician Match'}</span>
              </button>
            </div>

            {/* Ingested Telemetry Preview */}
            <div className="p-3.5 bg-white border border-[#DDD9D0] rounded-xl space-y-2 text-xs shadow-xs">
              <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                Ingested Anomaly Telemetry
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-[#FAF9F6] p-2 rounded-lg border border-[#DDD9D0]">
                  <div className="text-[10px] text-slate-400 font-sans">Vibration</div>
                  <div className="font-extrabold text-rose-600 mt-0.5">7.82 mm/s</div>
                </div>
                <div className="bg-[#FAF9F6] p-2 rounded-lg border border-[#DDD9D0]">
                  <div className="text-[10px] text-slate-400 font-sans">Temperature</div>
                  <div className="font-extrabold text-amber-600 mt-0.5">81.4 °C</div>
                </div>
              </div>
            </div>

            {/* Required Competencies */}
            <div className="p-3.5 bg-white border border-[#DDD9D0] rounded-xl space-y-2 text-xs shadow-xs">
              <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                Required Competencies for {selectedMachine}
              </div>
              <div className="flex flex-wrap gap-1">
                {orchestrationResult.requiredSkills.map((sk: string) => (
                  <span
                    key={sk}
                    className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono"
                  >
                    {sk.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Transparent Dispatch Decision & Roster Ranking */}
          <div className="lg:col-span-2 space-y-5">
            {/* Top Card: Selected Best Match */}
            <div className="bg-[#FAF9F6] p-5 rounded-2xl border border-[#DDD9D0] shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-[#DDD9D0] gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-teal-700 flex items-center justify-center text-white font-black text-lg shadow-sm">
                    {orchestrationResult.assignedTechnician.split(' ').map((n: string) => n[0]).join('')}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-base text-[#1E293B]">
                        {orchestrationResult.assignedTechnician}
                      </span>
                      <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {(orchestrationResult.matchConfidence * 100).toFixed(0)}% Optimal Match
                      </span>
                    </div>
                    <div className="text-xs text-teal-800 font-bold mt-0.5 flex items-center gap-2">
                      <span>{orchestrationResult.role}</span>
                      <span>&bull;</span>
                      <span className="font-mono text-[11px] text-slate-600 flex items-center gap-1">
                        <Radio size={11} className="text-teal-600" />
                        {orchestrationResult.radioChannel}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-teal-800 font-bold bg-white px-3 py-1.5 rounded-xl border border-[#DDD9D0] shadow-xs">
                    <ShieldCheck size={14} className="text-teal-600" />
                    <span>OSHA LOTO Mandated</span>
                  </div>

                  <button
                    onClick={handleDispatchWorkOrder}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition-all active:scale-95"
                  >
                    <Send size={13} />
                    <span>Dispatch WO</span>
                  </button>
                </div>
              </div>

              {/* Multi-Factor Score Breakdown */}
              <div className="p-3.5 bg-white rounded-xl border border-[#DDD9D0] space-y-2 shadow-xs">
                <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                  Transparent Decision Factor Breakdown
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                  <div className="p-2 bg-[#FAF9F6] rounded-lg border border-[#DDD9D0]">
                    <div className="text-[10px] text-slate-500 font-sans font-semibold">Skill Match (40%)</div>
                    <div className="font-extrabold text-emerald-700 mt-0.5">{orchestrationResult.scoreBreakdown.skillCompetency}%</div>
                  </div>
                  <div className="p-2 bg-[#FAF9F6] rounded-lg border border-[#DDD9D0]">
                    <div className="text-[10px] text-slate-500 font-sans font-semibold">Cluster Prox (25%)</div>
                    <div className="font-extrabold text-blue-700 mt-0.5">{orchestrationResult.scoreBreakdown.clusterProximity}%</div>
                  </div>
                  <div className="p-2 bg-[#FAF9F6] rounded-lg border border-[#DDD9D0]">
                    <div className="text-[10px] text-slate-500 font-sans font-semibold">Workload Cap (20%)</div>
                    <div className="font-extrabold text-slate-900 mt-0.5">{orchestrationResult.scoreBreakdown.workloadCapacity}%</div>
                  </div>
                  <div className="p-2 bg-[#FAF9F6] rounded-lg border border-[#DDD9D0]">
                    <div className="text-[10px] text-slate-500 font-sans font-semibold">LOTO Cert (15%)</div>
                    <div className="font-extrabold text-emerald-700 mt-0.5">{orchestrationResult.scoreBreakdown.safetyCert}%</div>
                  </div>
                </div>
              </div>

              {/* Explanation Text */}
              <p className="text-xs text-slate-600 leading-relaxed">
                {orchestrationResult.principleExplanation}
              </p>

              {/* Recommended Physical Inspection Checklist */}
              <div className="bg-white p-4 rounded-xl border border-[#DDD9D0] space-y-2.5 shadow-xs">
                <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Wrench size={13} className="text-blue-600" />
                    <span>RAG SOP Physical Inspection Checklist for Technician</span>
                  </div>
                  <span className="text-[10px] font-mono text-blue-600 font-bold">SOP-CNC-001</span>
                </div>
                <div className="space-y-1.5">
                  {orchestrationResult.recommendedInspection.map((step: string, idx: number) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-[#1E293B]">
                      <span className="font-mono font-bold text-blue-600 text-[11px] mt-0.5">0{idx + 1}.</span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* TiDB ATP Pre-Check Badge */}
              <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Boxes size={15} className="text-blue-600" />
                  <div>
                    <span className="font-bold text-blue-900">TiDB Cloud ATP Pre-Check: </span>
                    <span className="text-blue-800">
                      {orchestrationResult.atpCheck.partName} ({orchestrationResult.atpCheck.partNumber})
                    </span>
                  </div>
                </div>
                <div className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {orchestrationResult.atpCheck.atp} ATP Available
                </div>
              </div>
            </div>

            {/* Bottom Card: Candidate Roster Comparison Matrix */}
            <div className="bg-[#FAF9F6] p-5 rounded-2xl border border-[#DDD9D0] shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <Layers size={14} className="text-slate-500" />
                  <span>Candidate Evaluation &amp; Workload Balancing Matrix</span>
                </h4>
                <span className="text-[11px] font-mono text-slate-500">{orchestrationResult.candidates.length} Evaluated</span>
              </div>

              <div className="space-y-2">
                {orchestrationResult.candidates.map((cand: any, idx: number) => {
                  const isWinner = idx === 0;

                  return (
                    <div
                      key={cand.name}
                      className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                        isWinner
                          ? 'bg-white border-blue-500 ring-2 ring-blue-500/10 shadow-xs'
                          : 'bg-white border-[#DDD9D0] hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                            isWinner ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {cand.name.split(' ').map((n: string) => n[0]).join('')}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-xs text-[#1E293B]">{cand.name}</span>
                            <span className="text-[10px] text-slate-500 truncate">{cand.role}</span>
                            <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100">
                              {cand.cluster}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">{cand.reason}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right font-mono">
                          <span className={`text-sm font-black ${isWinner ? 'text-blue-700' : 'text-slate-600'}`}>
                            {cand.score}%
                          </span>
                          <div className="text-[9px] text-slate-400 font-sans">{cand.activeJobs} Active Jobs</div>
                        </div>
                        <span
                          className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md border ${
                            cand.status === 'AVAILABLE'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {cand.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* SUB-TAB 2: DECISION TRACE AUDIT LOG */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'TRACE' && (
        <div className="bg-[#FAF9F6] p-6 rounded-2xl border border-[#DDD9D0] shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#DDD9D0]">
            <div>
              <h3 className="text-base font-extrabold text-[#1E293B]">
                Autonomous Multi-Agent Decision Ledger &amp; Reasoning Trail
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Deterministic trace for Incident dispatch on {selectedMachine}
              </p>
            </div>
            <span className="text-xs font-mono font-bold px-3 py-1 rounded-lg bg-white border border-[#DDD9D0] text-slate-700">
              Trace ID: TRC-{Date.now().toString().slice(-6)}
            </span>
          </div>

          <div className="space-y-4 relative before:absolute before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-blue-200">
            {/* Step 1 */}
            <div className="relative pl-9">
              <div className="absolute left-2.5 top-1 w-3.5 h-3.5 rounded-full bg-blue-600 ring-4 ring-blue-100 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
              </div>
              <div className="bg-white p-4 rounded-xl border border-[#DDD9D0] shadow-xs">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-blue-700 font-mono">01. IoT Edge Telemetry Evaluation</span>
                  <span className="text-slate-400 font-mono">T+0.00s</span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Vibration RMS on high-speed spindle reached <strong>7.82 mm/s</strong> (ISO 10816-3 threshold: 4.50 mm/s). Anomaly flagged as FAULT state.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative pl-9">
              <div className="absolute left-2.5 top-1 w-3.5 h-3.5 rounded-full bg-blue-600 ring-4 ring-blue-100 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
              </div>
              <div className="bg-white p-4 rounded-xl border border-[#DDD9D0] shadow-xs">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-blue-700 font-mono">02. RAG Knowledge &amp; SOP Vector Retrieval</span>
                  <span className="text-slate-400 font-mono">T+0.25s</span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Retrieved document <strong>SOP-CNC-001 (Spindle Vibration Analysis &amp; Bearing Inspection)</strong>. Extracted radial runout tolerance (&lt;0.003mm) and dial indicator calibration steps.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative pl-9">
              <div className="absolute left-2.5 top-1 w-3.5 h-3.5 rounded-full bg-blue-600 ring-4 ring-blue-100 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
              </div>
              <div className="bg-white p-4 rounded-xl border border-[#DDD9D0] shadow-xs">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-blue-700 font-mono">03. Technician Roster &amp; Cluster Optimization</span>
                  <span className="text-slate-400 font-mono">T+0.52s</span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Evaluated 4 technicians. Selected <strong>Arun Kumar</strong> with 96% match (ISO 18436 Cat-II Vibration Certification + Bay 1 proximity + 0 active queue).
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="relative pl-9">
              <div className="absolute left-2.5 top-1 w-3.5 h-3.5 rounded-full bg-blue-600 ring-4 ring-blue-100 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
              </div>
              <div className="bg-white p-4 rounded-xl border border-[#DDD9D0] shadow-xs">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-blue-700 font-mono">04. OSHA 1910.147 Zero-Energy State Protocol</span>
                  <span className="text-slate-400 font-mono">T+0.78s</span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Generated lock-out tag-out checklist: 480V Cell Alpha main feeder breaker isolation + zero-energy voltage probe verification.
                </p>
              </div>
            </div>

            {/* Step 5 */}
            <div className="relative pl-9">
              <div className="absolute left-2.5 top-1 w-3.5 h-3.5 rounded-full bg-emerald-600 ring-4 ring-emerald-100 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
              </div>
              <div className="bg-white p-4 rounded-xl border border-[#DDD9D0] shadow-xs">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-emerald-700 font-mono">05. TiDB Cloud ATP Inventory Pre-Allocation</span>
                  <span className="text-slate-400 font-mono">T+0.95s</span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Pre-checked Available-To-Promise stock for <strong>SKF-6205-2RSH</strong> (6 available units in BAY-A-04). No stockout blocker detected.
                </p>
              </div>
            </div>

            {/* Step 6 */}
            <div className="relative pl-9">
              <div className="absolute left-2.5 top-1 w-3.5 h-3.5 rounded-full bg-emerald-600 ring-4 ring-emerald-100 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
              </div>
              <div className="bg-white p-4 rounded-xl border border-[#DDD9D0] shadow-xs">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-emerald-700 font-mono">06. Work Order Created &amp; Radio Dispatched</span>
                  <span className="text-slate-400 font-mono">T+1.20s</span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Work Order <strong>WO-1082</strong> dispatched with priority HIGH. Radio alert transmitted over Channel CH-01.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* SUB-TAB 3: AI COPILOT & SOP INVESTIGATOR */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeSubTab === 'COPILOT' && (
        <div className="bg-[#FAF9F6] p-6 rounded-2xl border border-[#DDD9D0] shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#DDD9D0]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                <Bot size={18} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#1E293B]">
                  PlantOps Multi-Agent Copilot &amp; SOP Assistant
                </h3>
                <p className="text-xs text-slate-500">
                  Ask questions regarding technician matching, SOP guidelines, and OSHA 1910.147 rules
                </p>
              </div>
            </div>
          </div>

          {/* Quick Prompt Suggestions */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-slate-500">Quick Inquiries:</span>
            {[
              'Why was Arun Kumar matched for CNC-01 over John Miller?',
              'What is the standard runout tolerance for spindle bearing replacement?',
              'What are the OSHA LOTO isolation points for Fanuc Robot 01?',
              'Explain Policy POL-01 spend threshold and anti-loop guard.'
            ].map((q) => (
              <button
                key={q}
                onClick={() => setCopilotQuery(q)}
                className="text-[11px] font-medium bg-white hover:bg-slate-100 text-slate-700 px-3 py-1 rounded-lg border border-[#DDD9D0] transition-all shadow-xs"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Chat Stream Window */}
          <div className="bg-white rounded-xl border border-[#DDD9D0] p-4 h-96 overflow-y-auto space-y-3.5 shadow-xs">
            {copilotHistory.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 text-xs ${
                  msg.sender === 'USER' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.sender === 'AI' && (
                  <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center flex-shrink-0">
                    <Bot size={16} />
                  </div>
                )}
                <div
                  className={`p-3.5 rounded-xl max-w-xl ${
                    msg.sender === 'USER'
                      ? 'bg-blue-600 text-white font-medium'
                      : 'bg-[#FAF9F6] border border-[#DDD9D0] text-[#1E293B] leading-relaxed'
                  }`}
                >
                  <p>{msg.text}</p>
                  <div
                    className={`text-[9px] mt-1.5 font-mono ${
                      msg.sender === 'USER' ? 'text-blue-200' : 'text-slate-400'
                    }`}
                  >
                    {msg.timestamp}
                  </div>
                </div>
              </div>
            ))}
            {copilotLoading && (
              <div className="flex gap-3 text-xs justify-start">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center flex-shrink-0 animate-pulse">
                  <Bot size={16} />
                </div>
                <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#DDD9D0] text-slate-500 font-medium flex items-center gap-2">
                  <Sparkles size={14} className="text-blue-600 animate-spin" />
                  <span>Analyzing RAG knowledge base &amp; agent telemetry logs...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input Form */}
          <form onSubmit={handleSendCopilot} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Ask Copilot about agent decisions, SOP tolerances, or LOTO procedures..."
              value={copilotQuery}
              onChange={(e) => setCopilotQuery(e.target.value)}
              className="flex-1 p-3 rounded-xl bg-white border border-[#DDD9D0] text-xs font-semibold text-[#1E293B] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-xs"
            />
            <button
              type="submit"
              disabled={copilotLoading || !copilotQuery.trim()}
              className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
            >
              <Send size={14} />
              <span>Ask Copilot</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
