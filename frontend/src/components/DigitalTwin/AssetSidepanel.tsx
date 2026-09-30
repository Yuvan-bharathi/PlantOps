import React, { useState } from 'react';
import { 
  X, Activity, Cpu, Flame, Gauge, Zap, ShieldCheck, 
  Wrench, Package, Bot, CheckCircle2, AlertOctagon,
  ArrowRight, ShieldAlert, RotateCw, Radio, Server,
  Sliders, Play, RefreshCw, Send, AlertTriangle, Layers,
  Timer, Clock, Check
} from 'lucide-react';
import { Machine, TelemetryData, Incident, WorkOrder } from '../../types';
import { api } from '../../services/api';

interface AssetSidepanelProps {
  machine: Machine | null;
  telemetry?: TelemetryData;
  activeIncident?: Incident;
  activeWorkOrder?: WorkOrder;
  onClose: () => void;
  onRefresh: () => void;
}

const statusBadgeStyles: Record<string, { bg: string; text: string; border: string }> = {
  RUNNING: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  WARNING: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  FAULT: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
  WAITING_PARTS: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  MAINTENANCE: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  VERIFYING: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  OFFLINE: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30' }
};

export const AssetSidepanel: React.FC<AssetSidepanelProps> = ({
  machine,
  telemetry,
  activeIncident,
  activeWorkOrder,
  onClose,
  onRefresh
}) => {
  if (!machine) return null;

  const [activeTab, setActiveTab] = useState<'live' | 'simulate' | 'ai' | 'wo' | 'timeline'>('live');
  const [applyingLoto, setApplyingLoto] = useState(false);
  const [completingRepair, setCompletingRepair] = useState(false);
  const [injectingFault, setInjectingFault] = useState(false);
  const [healingMachine, setHealingMachine] = useState(false);
  const [faultIntensity, setFaultIntensity] = useState(1.0);

  const badgeStyle = statusBadgeStyles[machine.status] || statusBadgeStyles.RUNNING;

  const handleApplyLOTO = async () => {
    if (!activeWorkOrder) return;
    setApplyingLoto(true);
    try {
      await api.applyLOTO(activeWorkOrder.id, 'Arun Kumar (Lead Tech)');
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setApplyingLoto(false);
    }
  };

  const handleCompleteRepair = async () => {
    if (!activeWorkOrder) return;
    setCompletingRepair(true);
    try {
      await api.healMachine(machine.code);
      await api.completeRepair(activeWorkOrder.id, 'Arun Kumar (Lead Tech)');
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setCompletingRepair(false);
    }
  };

  const handleInjectFault = async (faultType = 'BEARING_WEAR') => {
    setInjectingFault(true);
    try {
      await api.injectFault(machine.code, faultType, faultIntensity);
      onRefresh();
    } catch (e: any) {
      alert(`Simulation failed: ${e.message}`);
    } finally {
      setInjectingFault(false);
    }
  };

  const handleHeal = async () => {
    setHealingMachine(true);
    try {
      await api.healMachine(machine.code);
      onRefresh();
    } catch (e: any) {
      alert(`Healing failed: ${e.message}`);
    } finally {
      setHealingMachine(false);
    }
  };

  const currentTemp = telemetry?.temperature ?? (machine.status === 'FAULT' ? 82.4 : 62.0);
  const currentVib = telemetry?.vibration ?? (machine.status === 'FAULT' ? 9.4 : 2.2);
  const currentCurr = telemetry?.current ?? 12.5;
  const currentRpm = telemetry?.rpm ?? 2800;
  const currentPressure = (telemetry as any)?.pressure ?? 5.2;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[#0D1322] border-l border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
      
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
            <Cpu className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-mono font-bold text-base text-white">{machine.code}</h2>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}>
                {machine.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate max-w-[220px]">{machine.name}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Machine Context Meta Bar */}
      <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
        <div>
          <span>Cell: </span>
          <strong className="text-slate-200">{machine.area || 'Machining Cell'}</strong>
        </div>
        <div>
          <span>Criticality: </span>
          <strong className="text-rose-400">{machine.criticality || 'CRITICAL'}</strong>
        </div>
        <div>
          <span>Protocol: </span>
          <strong className="text-emerald-400">OSHA 1910.147</strong>
        </div>
      </div>

      {/* 5-Tab Sub-Navigation */}
      <div className="grid grid-cols-5 bg-slate-900 border-b border-slate-800 p-1 text-[11px] font-bold text-slate-400">
        <button
          onClick={() => setActiveTab('live')}
          className={`py-1.5 rounded-md flex items-center justify-center gap-1 transition-all ${
            activeTab === 'live' ? 'bg-slate-800 text-cyan-400 shadow-sm border border-slate-700' : 'hover:text-slate-200'
          }`}
        >
          <Activity className="w-3 h-3" />
          <span>Live</span>
        </button>
        <button
          onClick={() => setActiveTab('simulate')}
          className={`py-1.5 rounded-md flex items-center justify-center gap-1 transition-all ${
            activeTab === 'simulate' ? 'bg-slate-800 text-rose-400 shadow-sm border border-slate-700' : 'hover:text-slate-200'
          }`}
        >
          <Sliders className="w-3 h-3" />
          <span>Simulate</span>
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`py-1.5 rounded-md flex items-center justify-center gap-1 transition-all ${
            activeTab === 'ai' ? 'bg-slate-800 text-purple-400 shadow-sm border border-slate-700' : 'hover:text-slate-200'
          }`}
        >
          <Bot className="w-3 h-3" />
          <span>AI</span>
        </button>
        <button
          onClick={() => setActiveTab('wo')}
          className={`py-1.5 rounded-md flex items-center justify-center gap-1 transition-all ${
            activeTab === 'wo' ? 'bg-slate-800 text-blue-400 shadow-sm border border-slate-700' : 'hover:text-slate-200'
          }`}
        >
          <Wrench className="w-3 h-3" />
          <span>W.O.</span>
        </button>
        <button
          onClick={() => setActiveTab('timeline')}
          className={`py-1.5 rounded-md flex items-center justify-center gap-1 transition-all ${
            activeTab === 'timeline' ? 'bg-slate-800 text-amber-400 shadow-sm border border-slate-700' : 'hover:text-slate-200'
          }`}
        >
          <Clock className="w-3 h-3" />
          <span>Timeline</span>
        </button>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        
        {/* TAB 1: LIVE TELEMETRY & EDGE NODE MAPPING */}
        {activeTab === 'live' && (
          <div className="space-y-4">
            {/* Live Sensor Telemetry 2x2 Grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className={`p-3 rounded-xl border ${currentVib > 7.5 ? 'bg-rose-950/40 border-rose-500/40' : 'bg-slate-900/80 border-slate-800'}`}>
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>Radial Vibration</span>
                  <Gauge className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className={`text-xl font-bold font-mono ${currentVib > 7.5 ? 'text-rose-400' : (currentVib > 5.0 ? 'text-amber-400' : 'text-slate-100')}`}>
                    {currentVib.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-400">mm/s</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 font-mono">Limit: &lt; 5.00 mm/s</div>
              </div>

              <div className={`p-3 rounded-xl border ${currentTemp > 80 ? 'bg-rose-950/40 border-rose-500/40' : 'bg-slate-900/80 border-slate-800'}`}>
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>Spindle Temperature</span>
                  <Flame className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className={`text-xl font-bold font-mono ${currentTemp > 80 ? 'text-rose-400' : (currentTemp > 70 ? 'text-amber-400' : 'text-slate-100')}`}>
                    {currentTemp.toFixed(1)}
                  </span>
                  <span className="text-[10px] text-slate-400">°C</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 font-mono">Limit: &lt; 70.0 °C</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>Motor Current</span>
                  <Zap className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-xl font-bold font-mono text-slate-100">{currentCurr.toFixed(1)}</span>
                  <span className="text-[10px] text-slate-400">A</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 font-mono">Nominal: 12.5 A</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>Manifold Pressure</span>
                  <Activity className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-xl font-bold font-mono text-slate-100">{currentPressure.toFixed(1)}</span>
                  <span className="text-[10px] text-slate-400">bar</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 font-mono">Target: 5.2 bar</div>
              </div>
            </div>

            {/* Industrial Edge & Protocol Mapping Card */}
            <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span className="flex items-center gap-1.5 text-cyan-400">
                  <Server className="w-3.5 h-3.5" /> Edge Gateway & Bus Configuration
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">CONNECTED</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 font-mono">
                <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
                  <span>Hardware Node: </span>
                  <strong className="text-slate-200">Advantech UNO-2271G</strong>
                </div>
                <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
                  <span>IP Address: </span>
                  <strong className="text-slate-200">192.168.1.104</strong>
                </div>
                <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
                  <span>Protocol: </span>
                  <strong className="text-slate-200">OPC-UA (Port 4840)</strong>
                </div>
                <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
                  <span>Topic: </span>
                  <strong className="text-slate-200">plant/telemetry/{machine.code}</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: FAULT SIMULATION & BASELINE HEALING */}
        {activeTab === 'simulate' && (
          <div className="space-y-4">
            <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-rose-300 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> Fault Injection Testing Studio
              </div>
              <p className="text-[11px] text-rose-200/80">
                Inject deterministic industrial anomaly scenarios to evaluate auto-triage, OSHA LOTO locks, and cluster technician dispatch.
              </p>
            </div>

            {/* Intensity Slider */}
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
              <div className="flex justify-between text-[11px] text-slate-300 font-bold">
                <span>Anomaly Intensity Multiplier:</span>
                <span className="font-mono text-cyan-400">{faultIntensity.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.5"
                step="0.1"
                value={faultIntensity}
                onChange={e => setFaultIntensity(parseFloat(e.target.value))}
                className="w-full accent-cyan-500"
              />
            </div>

            {/* Scenario Buttons */}
            <div className="space-y-2">
              <button
                onClick={() => handleInjectFault('BEARING_WEAR')}
                disabled={injectingFault}
                className="w-full p-2.5 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 font-bold rounded-xl text-left flex items-center justify-between transition-all"
              >
                <div>
                  <div className="font-bold text-xs">1. Spindle Bearing Outer Race Spalling</div>
                  <div className="text-[10px] text-slate-400">Vibration spike to &gt; 8.5 mm/s &bull; High harmonic frequency</div>
                </div>
                <Play className="w-4 h-4 text-rose-400" />
              </button>

              <button
                onClick={() => handleInjectFault('MOTOR_OVERHEAT')}
                disabled={injectingFault}
                className="w-full p-2.5 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 font-bold rounded-xl text-left flex items-center justify-between transition-all"
              >
                <div>
                  <div className="font-bold text-xs">2. Drive Motor Thermal Overheat</div>
                  <div className="text-[10px] text-slate-400">Temperature rise to &gt; 84.0°C &bull; Current load increase</div>
                </div>
                <Play className="w-4 h-4 text-amber-400" />
              </button>

              <button
                onClick={() => handleInjectFault('OBSTRUCTION')}
                disabled={injectingFault}
                className="w-full p-2.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 font-bold rounded-xl text-left flex items-center justify-between transition-all"
              >
                <div>
                  <div className="font-bold text-xs">3. Chip Accumulation & Hydraulic Pressure Drop</div>
                  <div className="text-[10px] text-slate-400">Manifold pressure drops to 3.2 bar &bull; Chuck interlock</div>
                </div>
                <Play className="w-4 h-4 text-purple-400" />
              </button>
            </div>

            {/* Baseline Restore */}
            <button
              onClick={handleHeal}
              disabled={healingMachine}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-md transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${healingMachine ? 'animate-spin' : ''}`} />
              <span>{healingMachine ? 'Restoring Baseline...' : 'Restore 100% Nominal Baseline State'}</span>
            </button>
          </div>
        )}

        {/* TAB 3: AI DIAGNOSIS & RAG SPARES */}
        {activeTab === 'ai' && (
          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-gradient-to-br from-indigo-950/60 to-slate-900 border border-indigo-500/40 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300">
                  <Bot className="w-4 h-4 text-cyan-400" /> AI Root Cause Diagnostics
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {activeIncident?.ai_confidence ? `${(activeIncident.ai_confidence * 100).toFixed(1)}% Match` : '94.2% Conf'}
                </span>
              </div>

              <div className="text-xs font-bold text-slate-100">
                {activeIncident?.ai_root_cause || 'Spindle Angular Contact Bearing Wear (SKF-6205)'}
              </div>

              <p className="text-[11px] text-slate-300 leading-relaxed bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                {activeIncident?.ai_diagnosis_summary || 'Vibration FFT harmonic analysis detects 120 Hz bearing ball pass frequency. Certified technician Arun Kumar assigned. Mandatory OSHA 1910.147 LOTO issued.'}
              </p>

              {/* Warehouse Staging */}
              <div className="pt-2 border-t border-indigo-500/20 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Package className="w-3.5 h-3.5 text-amber-400" /> Required Spare Part:
                  </span>
                  <strong className="text-slate-200 font-mono">SKF-6205-2RSH</strong>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Warehouse Bin Allocation:</span>
                  <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Staged at BAY-B-04
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: WORK ORDER & OSHA LOTO EXECUTION */}
        {activeTab === 'wo' && (
          <div className="space-y-3">
            {activeWorkOrder ? (
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                    <Wrench className="w-3.5 h-3.5 text-blue-400" /> Work Order Active
                  </div>
                  <span className="font-mono text-xs font-bold text-blue-400">{activeWorkOrder.id}</span>
                </div>

                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Assigned Tech:</span>
                    <strong className="text-slate-200">{activeWorkOrder.technician_name || 'Arun Kumar'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">LOTO Lock Status:</span>
                    <strong className={activeWorkOrder.loto_applied ? 'text-emerald-400' : 'text-rose-400'}>
                      {activeWorkOrder.loto_applied ? 'LOCKED & ZERO ENERGY' : 'ISOLATION REQUIRED'}
                    </strong>
                  </div>
                </div>

                {/* 1-Click LOTO & Repair Action Buttons */}
                <div className="space-y-2 pt-1">
                  {!activeWorkOrder.loto_applied ? (
                    <button
                      onClick={handleApplyLOTO}
                      disabled={applyingLoto}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-500 text-white shadow-lg transition-all"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>{applyingLoto ? 'Applying LOTO Lock...' : 'Apply OSHA LOTO Isolation Lock'}</span>
                    </button>
                  ) : machine.status === 'VERIFYING' || activeWorkOrder.status === 'VERIFYING' || completingRepair ? (
                    <div className="p-2.5 bg-indigo-950/80 border border-indigo-500/40 rounded-xl text-center space-y-1">
                      <div className="text-xs font-bold text-indigo-300 flex items-center justify-center gap-1.5">
                        <Activity className="w-4 h-4 animate-spin text-indigo-400" />
                        <span>Autonomous Sensor Baseline Verification In Progress...</span>
                      </div>
                      <p className="text-[10px] text-indigo-400">Verifying 3-cycle baseline telemetry &lt; 2.5 mm/s RMS</p>
                    </div>
                  ) : machine.status === 'RUNNING' || activeWorkOrder.status === 'COMPLETED' ? (
                    <div className="p-2.5 bg-emerald-950/80 border border-emerald-500/40 rounded-xl text-center space-y-1">
                      <div className="text-xs font-bold text-emerald-300 flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Repair Verified & Baseline Nominal</span>
                      </div>
                      <p className="text-[10px] text-emerald-400">Machine restored to online production (99% health)</p>
                    </div>
                  ) : (
                    <button
                      onClick={handleCompleteRepair}
                      disabled={completingRepair}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg transition-all"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{completingRepair ? 'Triggering Verification...' : 'Complete Repair & Verify Baseline'}</span>
                    </button>
                  )}

                  {/* Intercom Action Links */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={async () => {
                        try {
                          await api.escalateIssue({
                            senderRole: 'TECHNICIAN',
                            senderName: 'Arun Kumar',
                            targetRole: 'INVENTORY_MGMT',
                            type: 'SPARE_REQUEST',
                            title: `Spares Request: ${machine.code}`,
                            details: `Need 1x Ceramic Spindle Bearing SKF-6205 for ${activeWorkOrder.id}.`,
                            metadata: { machineCode: machine.code, workOrderId: activeWorkOrder.id }
                          });
                          alert(`Request dispatched to Inventory Management.`);
                        } catch (e: any) {
                          alert(`Error: ${e.message}`);
                        }
                      }}
                      className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-lg text-[10px] font-bold border border-slate-700 flex items-center justify-center gap-1"
                    >
                      <Package className="w-3 h-3" />
                      <span>Request Spares</span>
                    </button>

                    <button
                      onClick={async () => {
                        try {
                          await api.escalateIssue({
                            senderRole: 'TECHNICIAN',
                            senderName: 'Arun Kumar',
                            targetRole: 'SUPERVISOR',
                            type: 'SAFETY_LOTO',
                            title: `LOTO Hold: ${machine.code}`,
                            details: `Safety hold active on ${machine.code}. Zero energy verification awaiting supervisor signoff.`,
                            metadata: { machineCode: machine.code, workOrderId: activeWorkOrder.id }
                          });
                          alert(`Safety alert sent to Supervisor Marcus Vance.`);
                        } catch (e: any) {
                          alert(`Error: ${e.message}`);
                        }
                      }}
                      className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-rose-400 rounded-lg text-[10px] font-bold border border-slate-700 flex items-center justify-center gap-1"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      <span>Alert Supervisor</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500 text-xs">
                No active work order on this asset. Machine running nominal.
              </div>
            )}
          </div>
        )}

        {/* TAB 5: LIFECYCLE TIMELINE */}
        {activeTab === 'timeline' && (
          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" /> Asset Closed-Loop Event Timeline
            </div>

            <div className="space-y-2 border-l-2 border-slate-800 ml-2 pl-3">
              {[
                { title: 'IoT Anomaly Detected', time: '10:14:02 AM', desc: 'Vibration reached 7.82 mm/s threshold envelope.', color: 'text-rose-400' },
                { title: 'AI Autonomous Triage', time: '10:14:03 AM', desc: 'Diagnosed bearing fatigue. Dispatched Arun Kumar.', color: 'text-cyan-400' },
                { title: 'OSHA LOTO Locked', time: '10:18:24 AM', desc: 'Main breaker isolated. Padlock #PL-8894 verified.', color: 'text-amber-400' },
                { title: 'Replacement Installed', time: '10:32:15 AM', desc: 'Torqued replacement SKF-6205 to OEM specification.', color: 'text-blue-400' },
                { title: 'Baseline Verified', time: '10:35:00 AM', desc: '3-cycle sensor verification passed. Machine RUNNING.', color: 'text-emerald-400' }
              ].map((ev, i) => (
                <div key={i} className="relative space-y-0.5 pb-2">
                  <div className={`text-[11px] font-bold ${ev.color}`}>{ev.title}</div>
                  <div className="text-[10px] font-mono text-slate-500">{ev.time}</div>
                  <p className="text-[11px] text-slate-400 leading-tight">{ev.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
