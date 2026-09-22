import React, { useState } from 'react';
import { 
  X, 
  Activity, 
  Cpu, 
  Flame, 
  Gauge, 
  Zap, 
  ShieldCheck, 
  Wrench, 
  Package, 
  Bot, 
  CheckCircle2, 
  AlertOctagon,
  ArrowRight,
  ShieldAlert,
  RotateCw
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

  const [applyingLoto, setApplyingLoto] = useState(false);
  const [completingRepair, setCompletingRepair] = useState(false);
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
      // 1. Tell simulator to normalize machine sensors for post-repair verification
      await api.healMachine(machine.code);
      // 2. Mark repair complete in backend
      await api.completeRepair(activeWorkOrder.id, 'Arun Kumar (Lead Tech)');
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setCompletingRepair(false);
    }
  };

  const currentTemp = telemetry?.temperature ?? (machine.status === 'FAULT' ? 82.4 : 62.0);
  const currentVib = telemetry?.vibration ?? (machine.status === 'FAULT' ? 9.4 : 2.2);
  const currentCurr = telemetry?.current ?? 12.5;
  const currentRpm = telemetry?.rpm ?? 2800;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[#0D1322]/95 backdrop-blur-xl border-l border-slate-800/90 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
      
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
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
            <p className="text-xs text-slate-400">{machine.name}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        
        {/* Machine Health & Criticality Banner */}
        <div className="glass-panel p-3 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400">Health Index</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-bold font-mono text-white">{machine.health_score}%</span>
              <span className="text-xs text-emerald-400 font-semibold">{machine.health_score > 80 ? 'Optimal' : 'Degraded'}</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[11px] text-slate-400">Criticality</span>
            <div className="mt-0.5">
              <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                {machine.criticality}
              </span>
            </div>
          </div>
        </div>

        {/* Realtime Telemetry Grid */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" /> Live Sensor Telemetry
            </span>
            <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> 1000ms Poll
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Vibration */}
            <div className={`p-3 rounded-xl border ${currentVib > 7.5 ? 'bg-rose-950/40 border-rose-500/40' : 'bg-slate-900/80 border-slate-800'}`}>
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Vibration</span>
                <Gauge className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className={`text-xl font-bold font-mono ${currentVib > 7.5 ? 'text-rose-400' : (currentVib > 5.0 ? 'text-amber-400' : 'text-slate-100')}`}>
                  {currentVib.toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-400">mm/s</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Limit: &lt; 5.0 mm/s</div>
            </div>

            {/* Temperature */}
            <div className={`p-3 rounded-xl border ${currentTemp > 80 ? 'bg-rose-950/40 border-rose-500/40' : 'bg-slate-900/80 border-slate-800'}`}>
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Temperature</span>
                <Flame className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className={`text-xl font-bold font-mono ${currentTemp > 80 ? 'text-rose-400' : (currentTemp > 70 ? 'text-amber-400' : 'text-slate-100')}`}>
                  {currentTemp.toFixed(1)}
                </span>
                <span className="text-[10px] text-slate-400">°C</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Limit: &lt; 70.0 °C</div>
            </div>

            {/* Current */}
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Motor Current</span>
                <Zap className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xl font-bold font-mono text-slate-100">{currentCurr.toFixed(1)}</span>
                <span className="text-[10px] text-slate-400">A</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Nominal: 12.0 A</div>
            </div>

            {/* RPM */}
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Spindle RPM</span>
                <RotateCw className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xl font-bold font-mono text-slate-100">{currentRpm}</span>
                <span className="text-[10px] text-slate-400">RPM</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Target: 2800 RPM</div>
            </div>
          </div>
        </div>

        {/* AI Diagnosis Card */}
        {activeIncident && (
          <div className="p-3.5 rounded-xl bg-gradient-to-br from-indigo-950/50 to-slate-900 border border-indigo-500/40 shadow-lg space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300">
                <Bot className="w-4 h-4 text-cyan-400" /> AI Root Cause Diagnosis
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                {activeIncident.ai_confidence ? `${(activeIncident.ai_confidence * 100).toFixed(1)}% Conf` : '94.2% Conf'}
              </span>
            </div>

            <div className="text-xs font-semibold text-slate-100">
              {activeIncident.ai_root_cause || 'Spindle Front Angular Contact Bearing Degradation'}
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
              {activeIncident.ai_diagnosis_summary || 'Vibration signature and thermal dissipation indicate cage fatigue on spindle bearing SKF-6205.'}
            </p>

            {/* Spare Part BOM & ATP Info */}
            <div className="pt-2 border-t border-indigo-500/20">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1">
                  <Package className="w-3.5 h-3.5 text-amber-400" /> Required Part:
                </span>
                <span className="font-mono font-bold text-slate-200">
                  {activeIncident.part_number || 'SKF-6205-2RSH'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] mt-1">
                <span className="text-slate-400">ATP Inventory:</span>
                <span className="font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                  Auto-PO Dispatched (Expedited)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Active Work Order & Safety LOTO */}
        {activeWorkOrder && (
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                <Wrench className="w-3.5 h-3.5 text-blue-400" /> Maintenance Work Order
              </div>
              <span className="font-mono text-xs font-bold text-blue-400">{activeWorkOrder.id}</span>
            </div>

            <div className="flex items-center justify-between text-xs bg-slate-950/60 p-2 rounded-lg border border-slate-800">
              <div>
                <span className="text-[10px] text-slate-400">Assigned Tech:</span>
                <div className="font-semibold text-slate-200">{activeWorkOrder.technician_name || 'Arun Kumar'}</div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400">LOTO Status:</span>
                <div className="font-bold text-xs flex items-center gap-1">
                  {activeWorkOrder.loto_applied ? (
                    <span className="text-emerald-400 flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" /> VERIFIED</span>
                  ) : (
                    <span className="text-rose-400 flex items-center gap-0.5"><AlertOctagon className="w-3 h-3" /> REQUIRED</span>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              {!activeWorkOrder.loto_applied ? (
                <button
                  onClick={handleApplyLOTO}
                  disabled={applyingLoto}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-500 text-white shadow-lg transition-all duration-200 active:scale-95 disabled:opacity-50"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{applyingLoto ? 'Applying Safety Lock...' : '1. Apply & Verify LOTO Lock'}</span>
                </button>
              ) : (
                <button
                  onClick={handleCompleteRepair}
                  disabled={completingRepair || machine.status === 'VERIFYING'}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg transition-all duration-200 active:scale-95 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{completingRepair ? 'Triggering Verification...' : '2. Complete Repair & Verify Health'}</span>
                </button>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
