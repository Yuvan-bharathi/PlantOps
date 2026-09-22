import React, { useState } from 'react';
import { 
  BrainCircuit, Bot, Zap, FileText, Search, Sparkles, CheckCircle2, 
  ShieldCheck, ArrowRight, BookOpen, Layers, HardHat, UserCheck, 
  Activity, Lock, Clock, Wrench, AlertTriangle, ChevronRight
} from 'lucide-react';

export const AIDiagnosisView: React.FC = () => {
  const [selectedMachine, setSelectedMachine] = useState('CNC-01');
  const [selectedAlert, setSelectedAlert] = useState('HIGH_VIBRATION');
  const [orchestrating, setOrchestrating] = useState(false);

  // Default simulated dispatch decision
  const [orchestrationResult, setOrchestrationResult] = useState<any>({
    assignedTechnician: 'Arun Kumar',
    role: 'Lead Vibration & Spindle Specialist',
    matchConfidence: 0.96,
    requiredSkills: ['CNC_MILLING', 'MECHANICAL_VIBRATION', 'SPINDLE_SYSTEMS', 'OSHA_LOTO'],
    candidates: [
      { name: 'Arun Kumar', role: 'Lead Vibration Specialist', score: 96, status: 'AVAILABLE', activeJobs: 0, reason: '100% competency match on Spindle & Vibration protocols. Immediate shift availability.' },
      { name: 'John Miller', role: 'CNC Operator & Machinist', score: 82, status: 'AVAILABLE', activeJobs: 1, reason: 'Certified in CNC Milling. 1 active work order in queue.' },
      { name: 'Wei Zhang', role: 'Senior Machinist', score: 75, status: 'AVAILABLE', activeJobs: 0, reason: 'General CNC Machinist. Lacks ISO vibration certification.' },
      { name: 'Sarah Jenkins', role: 'Robotics & Automation Lead', score: 35, status: 'AVAILABLE', activeJobs: 0, reason: 'Specialized in 6-Axis Robotics kinematics.' },
    ],
    recommendedInspection: [
      'Perform electrical isolation & OSHA 1910.147 LOTO on Cell Alpha 480V breaker',
      'Inspect spindle shaft radial runout with dial test indicator (<0.003mm)',
      'Listen for harmonic chatter and inspect bearing raceway for micro-fluting',
      'Verify zero-energy state before physical decoupling'
    ],
    principleExplanation: 'IoT Edge Sensors detected threshold breach. AI Orchestrator matched machine competencies against technician certifications to dispatch Arun Kumar. Technician will physically diagnose root cause and identify required part.'
  });

  const handleRunOrchestrator = () => {
    setOrchestrating(true);
    setTimeout(() => {
      setOrchestrating(false);
      if (selectedMachine === 'ROBOT-01') {
        setOrchestrationResult({
          assignedTechnician: 'Sarah Jenkins',
          role: 'Robotics & Automation Lead',
          matchConfidence: 0.95,
          requiredSkills: ['ROBOTICS_KINEMATICS', 'SERVO_DRIVES', 'ELECTRICAL_MOTION', 'OSHA_LOTO'],
          candidates: [
            { name: 'Sarah Jenkins', role: 'Robotics Lead', score: 95, status: 'AVAILABLE', activeJobs: 0, reason: 'Top certified expert in Fanuc 6-Axis servo drives and cycloidal reducers.' },
            { name: 'Arun Kumar', role: 'Lead Vibration Tech', score: 60, status: 'AVAILABLE', activeJobs: 0, reason: 'Mechanical specialist. Lacks Fanuc servo encoder calibration certification.' },
            { name: 'John Miller', role: 'CNC Operator', score: 30, status: 'AVAILABLE', activeJobs: 1, reason: 'CNC turning focus.' },
          ],
          recommendedInspection: [
            'Lock out robot controller and engage mechanical safety joint brakes',
            'Inspect Axis 3 harmonic drive gear teeth for backlash & wave-generator wear',
            'Verify optical encoder feedback signal cables for thermal degradation'
          ],
          principleExplanation: 'IoT Edge Sensors detected current spike & joint thermal surge. AI Orchestrator dispatched Sarah Jenkins based on Fanuc robotics certification.'
        });
      } else if (selectedMachine === 'PUMP-01') {
        setOrchestrationResult({
          assignedTechnician: 'Carlos Gomez',
          role: 'Fluids & Hydraulics Specialist',
          matchConfidence: 0.94,
          requiredSkills: ['HYDRAULIC_CIRCUITS', 'SEAL_REPLACEMENT', 'FLUID_POWER', 'OSHA_LOTO'],
          candidates: [
            { name: 'Carlos Gomez', role: 'Fluids Specialist', score: 94, status: 'AVAILABLE', activeJobs: 0, reason: 'Certified hydraulic circuit engineer with seal pack replacement qualification.' },
            { name: 'Arun Kumar', role: 'Lead Vibration Tech', score: 65, status: 'AVAILABLE', activeJobs: 0, reason: 'General mechanical background.' },
          ],
          recommendedInspection: [
            'Depressurize hydraulic accumulator circuit to 0.0 bar and tag out pump breaker',
            'Inspect mechanical seal elastomer pack for cavitation erosion and bypass leaks',
            'Verify delivery pressure relief valve calibration at 6.0 bar'
          ],
          principleExplanation: 'IoT Edge Sensors detected hydraulic pressure loss. AI Orchestrator dispatched Carlos Gomez for certified fluid isolation.'
        });
      } else {
        setOrchestrationResult({
          assignedTechnician: 'Arun Kumar',
          role: 'Lead Vibration & Spindle Specialist',
          matchConfidence: 0.96,
          requiredSkills: ['CNC_MILLING', 'MECHANICAL_VIBRATION', 'SPINDLE_SYSTEMS', 'OSHA_LOTO'],
          candidates: [
            { name: 'Arun Kumar', role: 'Lead Vibration Specialist', score: 96, status: 'AVAILABLE', activeJobs: 0, reason: '100% competency match on Spindle & Vibration protocols. Immediate shift availability.' },
            { name: 'John Miller', role: 'CNC Operator & Machinist', score: 82, status: 'AVAILABLE', activeJobs: 1, reason: 'Certified in CNC Milling. 1 active work order in queue.' },
            { name: 'Wei Zhang', role: 'Senior Machinist', score: 75, status: 'AVAILABLE', activeJobs: 0, reason: 'General CNC Machinist. Lacks ISO vibration certification.' },
          ],
          recommendedInspection: [
            'Perform electrical isolation & OSHA 1910.147 LOTO on Cell Alpha 480V breaker',
            'Inspect spindle shaft radial runout with dial test indicator (<0.003mm)',
            'Listen for harmonic chatter and inspect bearing raceway for micro-fluting'
          ],
          principleExplanation: 'IoT Edge Sensors detected threshold breach. AI Orchestrator matched machine competencies against technician certifications to dispatch Arun Kumar.'
        });
      }
    }, 500);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Principle Banner */}
      <div className="bg-[#FAF9F6] p-5 rounded-2xl border border-[#DDD9D0] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#2563EB] animate-pulse" />
            <span className="text-[10px] font-bold font-mono text-[#2563EB] uppercase tracking-wider">PlantOps Core Principle</span>
          </div>
          <h2 className="text-lg font-bold text-[#1E293B] mt-1">
            AI Maintenance Orchestrator
          </h2>
          <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
            <strong>IoT detects anomalies</strong> • <strong>AI orchestrates the optimal technician dispatch</strong> • <strong>Human technician inspects & diagnoses physical fault</strong> • <strong>Deterministic ATP & Procurement engine handles supply chain</strong> • <strong>IoT verifies recovery</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-[#DDD9D0] shadow-sm text-xs text-[#1E293B] font-bold">
          <Bot size={16} className="text-[#2563EB]" />
          <span>Transparent Dispatch Decision Engine</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: Interactive Orchestration Query Engine */}
        <div className="bg-[#FAF9F6] p-5 rounded-2xl border border-[#DDD9D0] shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-[#1E293B] flex items-center gap-2">
            <Sparkles size={16} className="text-[#2563EB]" />
            Orchestration Dispatch Console
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-xs font-bold text-[#1E293B] block mb-1">Target Asset</label>
              <select
                value={selectedMachine}
                onChange={(e) => setSelectedMachine(e.target.value)}
                className="w-full text-xs font-semibold bg-white border border-[#DDD9D0] rounded-xl p-2.5 text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
              >
                <option value="CNC-01">CNC-01 — 5-Axis Milling Center</option>
                <option value="CNC-02">CNC-02 — Heavy Turning Cell</option>
                <option value="CNC-03">CNC-03 — High Speed Machining</option>
                <option value="ROBOT-01">ROBOT-01 — 6-Axis Articulated Robot</option>
                <option value="PUMP-01">PUMP-01 — Hydraulic Coolant Pump</option>
                <option value="MIXER-01">MIXER-01 — Lubricant Mixer</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-[#1E293B] block mb-1">IoT Condition Monitoring Alert</label>
              <select
                value={selectedAlert}
                onChange={(e) => setSelectedAlert(e.target.value)}
                className="w-full text-xs font-semibold bg-white border border-[#DDD9D0] rounded-xl p-2.5 text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
              >
                <option value="HIGH_VIBRATION">High Vibration Harmonic Peak (&gt; 7.5 mm/s)</option>
                <option value="THERMAL_OVERHEAT">Critical Thermal Surge (&gt; 80.0 °C)</option>
                <option value="CURRENT_SPIKE">Servo Armature Current Imbalance (&gt; 14.0 A)</option>
                <option value="PRESSURE_LOSS">Hydraulic Delivery Pressure Drop (&lt; 2.5 bar)</option>
              </select>
            </div>

            <button
              onClick={handleRunOrchestrator}
              disabled={orchestrating}
              className="w-full py-2.5 px-4 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
            >
              <Zap size={14} className={orchestrating ? 'animate-bounce' : ''} />
              <span>{orchestrating ? 'Orchestrating Roster Matching...' : 'Simulate AI Technician Match'}</span>
            </button>
          </div>

          <div className="p-3 bg-white border border-[#DDD9D0] rounded-xl space-y-2 text-xs">
            <div className="text-[10px] font-bold text-[#64748B] uppercase">Required Competencies for {selectedMachine}</div>
            <div className="flex flex-wrap gap-1">
              {orchestrationResult.requiredSkills.map((sk: string) => (
                <span key={sk} className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#FAF9F6] text-[#1E293B] border border-[#DDD9D0] font-mono">
                  {sk.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right Columns: Transparent AI Dispatch & Candidate Rankings */}
        <div className="lg:col-span-2 space-y-5">
          {/* Top Card: Selected Best Match */}
          <div className="bg-[#FAF9F6] p-5 rounded-2xl border border-[#DDD9D0] shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#DDD9D0]">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#0F766E] flex items-center justify-center text-white font-bold shadow-sm">
                  <UserCheck size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-[#1E293B]">{orchestrationResult.assignedTechnician}</span>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#E8F6EF] text-[#22A06B] border border-[#B4E3CF]">
                      {(orchestrationResult.matchConfidence * 100).toFixed(0)}% Suitability
                    </span>
                  </div>
                  <div className="text-xs text-[#0F766E] font-semibold">{orchestrationResult.role}</div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-[#0F766E] font-bold bg-white px-3 py-1.5 rounded-xl border border-[#DDD9D0]">
                <ShieldCheck size={14} />
                <span>OSHA LOTO Mandated</span>
              </div>
            </div>

            <p className="text-xs text-[#334155] leading-relaxed">
              {orchestrationResult.principleExplanation}
            </p>

            {/* Recommended Physical Inspection Points */}
            <div className="bg-white p-4 rounded-xl border border-[#DDD9D0] space-y-2.5">
              <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5">
                <Wrench size={13} className="text-[#2563EB]" />
                Recommended Physical Inspection Checklist for Technician
              </div>
              <div className="space-y-1.5">
                {orchestrationResult.recommendedInspection.map((step: string, idx: number) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-[#1E293B]">
                    <span className="font-mono font-bold text-[#2563EB] text-[11px] mt-0.5">0{idx + 1}.</span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Card: Candidate Roster Comparison Matrix */}
          <div className="bg-[#FAF9F6] p-5 rounded-2xl border border-[#DDD9D0] shadow-sm space-y-3">
            <h4 className="text-xs font-bold text-[#1E293B] uppercase tracking-wider flex items-center gap-2">
              <Layers size={14} className="text-[#64748B]" />
              Candidate Evaluation & Workload Balancing Matrix
            </h4>

            <div className="space-y-2">
              {orchestrationResult.candidates.map((cand: any, idx: number) => {
                const isWinner = idx === 0;

                return (
                  <div
                    key={cand.name}
                    className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                      isWinner
                        ? 'bg-white border-[#2563EB] shadow-sm'
                        : 'bg-white/60 border-[#DDD9D0]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                        isWinner ? 'bg-[#2563EB] text-white' : 'bg-[#EAE7E0] text-[#64748B]'
                      }`}>
                        {cand.name.split(' ').map((n: string) => n[0]).join('')}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-[#1E293B]">{cand.name}</span>
                          <span className="text-[10px] text-[#64748B] truncate">{cand.role}</span>
                        </div>
                        <p className="text-[11px] text-[#64748B] truncate">{cand.reason}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <span className={`text-xs font-mono font-extrabold ${isWinner ? 'text-[#2563EB]' : 'text-[#64748B]'}`}>
                          {cand.score}%
                        </span>
                        <div className="text-[9px] text-[#64748B]">{cand.activeJobs} Active Jobs</div>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${
                        cand.status === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
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
    </div>
  );
};
