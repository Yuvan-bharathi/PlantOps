import React, { useState } from 'react';
import { 
  Play, RotateCcw, X, AlertTriangle, Flame, 
  Activity, Gauge, Zap, Sliders, Cpu, CheckCircle2
} from 'lucide-react';
import { api } from '../../services/api';

interface ScenarioSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (msg: string) => void;
}

const SCENARIOS = [
  {
    id: 'CNC01_BEARING',
    machineId: 'CNC-01',
    machineName: 'High-Precision 5-Axis Milling Center',
    title: 'Spindle Front Bearing Fluting & Thermal Surge',
    faultType: 'BEARING_WEAR',
    defaultIntensity: 1.0,
    expectedVib: '9.4 mm/s',
    expectedTemp: '82.4 °C',
    part: 'SKF-6205 Bearing',
    icon: <Activity className="text-rose-600" size={18} />
  },
  {
    id: 'CNC02_DRIVE',
    machineId: 'CNC-02',
    machineName: 'Heavy Duty Lathe & Turning Cell',
    title: 'Primary Drive Motor Misalignment & Belt Slip',
    faultType: 'BEARING_WEAR',
    defaultIntensity: 0.85,
    expectedVib: '7.8 mm/s',
    expectedTemp: '76.0 °C',
    part: 'FAG-7210 Bearing',
    icon: <AlertTriangle className="text-amber-600" size={18} />
  },
  {
    id: 'CNC03_CERAMIC',
    machineId: 'CNC-03',
    machineName: 'High-Speed Machining Center',
    title: 'Ceramic Spindle Dynamic Imbalance & Tool Runout',
    faultType: 'BEARING_WEAR',
    defaultIntensity: 0.90,
    expectedVib: '8.6 mm/s',
    expectedTemp: '84.1 °C',
    part: 'SKF-6205 Bearing',
    icon: <Cpu className="text-indigo-600" size={18} />
  },
  {
    id: 'MIXER01_GEARBOX',
    machineId: 'MIXER-01',
    machineName: 'High-Shear Industrial Agitator Mixer',
    title: 'Agitator Gearbox Severe Lubrication Starvation',
    faultType: 'BEARING_WEAR',
    defaultIntensity: 0.85,
    expectedVib: '6.8 mm/s',
    expectedTemp: '88.5 °C',
    part: 'TIMKEN-32008X Bearing',
    icon: <Flame className="text-orange-600" size={18} />
  },
  {
    id: 'PUMP01_CAVITATION',
    machineId: 'PUMP-01',
    machineName: 'High-Pressure Hydraulic Coolant Pump',
    title: 'Hydraulic Seal Breach & Impeller Cavitation',
    faultType: 'PRESSURE_DROP',
    defaultIntensity: 0.9,
    expectedVib: '5.6 mm/s',
    expectedTemp: '81.0 °C',
    part: 'PARKER-V884 Seal Kit',
    icon: <Gauge className="text-cyan-600" size={18} />
  },
  {
    id: 'ROBOT01_SERVO',
    machineId: 'ROBOT-01',
    machineName: 'Articulated 6-Axis Pick & Place Robot',
    title: 'Axis 3 Harmonic Servo Thermal Surge & Current Spike',
    faultType: 'MOTOR_OVERHEAT',
    defaultIntensity: 0.95,
    expectedVib: '4.8 mm/s',
    expectedTemp: '79.2 °C',
    part: 'FANUC-A06B Servo Motor',
    icon: <Zap className="text-purple-600" size={18} />
  }
];

export const ScenarioSimulatorModal: React.FC<ScenarioSimulatorModalProps> = ({
  isOpen,
  onClose,
  onShowToast
}) => {
  const [selectedScenario, setSelectedScenario] = useState(SCENARIOS[0]);
  const [intensity, setIntensity] = useState(1.0);
  const [injecting, setInjecting] = useState(false);
  const [healing, setHealing] = useState(false);

  if (!isOpen) return null;

  const handleInject = async () => {
    setInjecting(true);
    try {
      await api.injectFault(selectedScenario.machineId, selectedScenario.faultType, intensity);
      onShowToast(`⚠️ Injected fault scenario on ${selectedScenario.machineId}! Single AI diagnosis triggered.`);
      onClose();
    } catch (err: any) {
      onShowToast(`Error: ${err.message}`);
    } finally {
      setInjecting(false);
    }
  };

  const handleHealSelected = async () => {
    setHealing(true);
    try {
      await api.healMachine(selectedScenario.machineId);
      onShowToast(`✅ Baseline telemetry restored on ${selectedScenario.machineId}. Post-repair verification cycle active.`);
      onClose();
    } catch (err: any) {
      onShowToast(`Error: ${err.message}`);
    } finally {
      setHealing(false);
    }
  };

  const handleHealAll = async () => {
    setHealing(true);
    try {
      for (const sc of SCENARIOS) {
        await api.healMachine(sc.machineId);
      }
      onShowToast(`✅ Normalized baseline telemetry across all 6 plant assets.`);
      onClose();
    } catch (err: any) {
      onShowToast(`Error: ${err.message}`);
    } finally {
      setHealing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-[#FAF9F6] rounded-3xl border border-[#DDD9D0] shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-[#DDD9D0] flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#2563EB] flex items-center justify-center text-white shadow-sm">
              <Zap size={18} />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-[#1E293B]">Single-Machine Fault Simulator</h2>
              <p className="text-xs text-[#64748B]">Choose exactly one asset to trigger a realistic sensor anomaly and observe the closed-loop recovery.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#1E293B] hover:bg-[#EAE7E0] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs bg-[#F3F1EC]/40">
          {/* Target Machine Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-[#1E293B] uppercase tracking-wider text-[11px]">
                Target Machine (Select One)
              </label>
              <span className="text-[11px] font-semibold text-[#0F766E] bg-[#E8F6EF] px-2 py-0.5 rounded-md border border-[#B4E3CF]">
                1 Active Anomaly Mode
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {SCENARIOS.map((sc) => {
                const isSelected = selectedScenario.id === sc.id;
                return (
                  <button
                    key={sc.id}
                    onClick={() => {
                      setSelectedScenario(sc);
                      setIntensity(sc.defaultIntensity);
                    }}
                    className={`p-3 rounded-2xl border text-left flex items-center justify-between transition-all ${
                      isSelected
                        ? 'border-[#2563EB] bg-white shadow-sm ring-2 ring-[#2563EB]/25'
                        : 'border-[#DDD9D0] hover:border-slate-400 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-[#FAF9F6] border border-[#DDD9D0] flex items-center justify-center flex-shrink-0">
                        {sc.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-extrabold text-sm text-[#1E293B]">{sc.machineId}</span>
                          <span className="text-[#64748B]">•</span>
                          <span className="font-bold text-xs text-[#1E293B]">{sc.title}</span>
                        </div>
                        <div className="text-[#64748B] text-[11px] mt-0.5">{sc.machineName} · Requires {sc.part}</div>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0 pl-3">
                      <div className="font-mono font-bold text-[#D64545] text-[11px]">{sc.expectedVib}</div>
                      <div className="font-mono text-[#64748B] text-[10px]">{sc.expectedTemp}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fault Intensity Slider */}
          <div className="p-4 rounded-2xl bg-white border border-[#DDD9D0] space-y-2">
            <div className="flex items-center justify-between font-bold text-[#1E293B]">
              <span className="flex items-center gap-1.5">
                <Sliders size={13} className="text-[#2563EB]" /> Fault Intensity Multiplier
              </span>
              <span className="font-mono font-extrabold text-[#2563EB]">{(intensity * 100).toFixed(0)}% Intensity</span>
            </div>
            <input
              type="range"
              min="0.4"
              max="1.0"
              step="0.05"
              value={intensity}
              onChange={(e) => setIntensity(parseFloat(e.target.value))}
              className="w-full accent-[#2563EB]"
            />
            <div className="flex justify-between text-[10px] text-[#64748B] font-mono">
              <span>Warning Breach (40%)</span>
              <span>Nominal Fault (75%)</span>
              <span>Critical Breakdown (100%)</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t border-[#DDD9D0] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleHealSelected}
              disabled={healing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#E8F6EF] border border-[#B4E3CF] text-[#22A06B] hover:bg-emerald-100 text-xs font-bold transition-all disabled:opacity-50"
              title={`Restore baseline only on ${selectedScenario.machineId}`}
            >
              <RotateCcw size={12} />
              Reset {selectedScenario.machineId}
            </button>
            <button
              onClick={handleHealAll}
              disabled={healing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FAF9F6] border border-[#DDD9D0] text-[#64748B] hover:text-[#1E293B] hover:bg-[#EAE7E0] text-xs font-bold transition-all disabled:opacity-50"
            >
              Reset All
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#FAF9F6] border border-[#DDD9D0] text-[#64748B] hover:text-[#1E293B] hover:bg-[#EAE7E0] text-xs font-semibold transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleInject}
              disabled={injecting}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#D64545] hover:bg-red-700 text-white text-xs font-extrabold shadow-md transition-all active:scale-95 disabled:opacity-50"
            >
              <Play size={13} />
              <span>{injecting ? 'Injecting Fault...' : `Inject Fault on ${selectedScenario.machineId}`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
