import React from 'react';
import { 
  AlertTriangle, 
  Bot, 
  ShoppingCart, 
  CheckCircle2, 
  Clock, 
  ArrowRight,
  ShieldCheck,
  Activity,
  Package,
  Wrench,
  Zap,
  ChevronRight
} from 'lucide-react';
import { Incident } from '../../types';

interface IncidentTimelineProps {
  incidents: Incident[];
  onSelectMachine: (machineCode: string) => void;
}

export const IncidentTimeline: React.FC<IncidentTimelineProps> = ({ incidents, onSelectMachine }) => {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
            Closed-Loop Incident & Autonomous Operations Timeline
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Audit-grade sequence of automated anomaly detection, AI RAG diagnosis, policy-driven autonomous procurement, and health recovery verification.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
            Total Incidents: <strong className="text-slate-900 font-mono">{incidents.length}</strong>
          </span>
        </div>
      </div>

      {incidents.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-green-50 border border-green-200 flex items-center justify-center text-green-600 mx-auto mb-3">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900">All Industrial Assets Operating Nominally</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            No active faults detected. Use the <strong className="text-blue-600 font-semibold">"Simulate CNC-01 Fault"</strong> button in the sidebar to trigger an automated closed-loop anomaly incident.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {incidents.map((inc) => {
            const isResolved = inc.status === 'RESOLVED' || inc.status === 'CLOSED';
            const isVerifying = inc.status === 'VERIFYING';
            const isAssigned = inc.status === 'ASSIGNED' || inc.status === 'OPEN';

            // Status Badge Styling
            let statusBadgeClass = 'bg-red-50 text-red-700 border-red-200';
            if (isResolved) {
              statusBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
            } else if (isVerifying) {
              statusBadgeClass = 'bg-purple-50 text-purple-700 border-purple-200 animate-pulse';
            } else if (isAssigned) {
              statusBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
            }

            return (
              <div
                key={inc.id}
                className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200"
              >
                {/* Incident Card Top Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono font-bold text-sm text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-200">
                      {inc.id}
                    </span>
                    <span className="text-slate-300 font-bold">•</span>
                    <button
                      onClick={() => onSelectMachine(inc.machine_code || inc.machine_id)}
                      className="font-mono font-bold text-xs text-slate-800 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5"
                      title="Inspect Machine in 3D Digital Twin"
                    >
                      <Activity size={13} className="text-blue-500" />
                      {inc.machine_code || inc.machine_id}
                    </button>
                    <span className="text-xs font-medium text-slate-600">
                      {inc.machine_name ? `(${inc.machine_name})` : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full border ${statusBadgeClass}`}>
                      {inc.status}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 font-mono flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {new Date(inc.detected_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                    </span>
                  </div>
                </div>

                {/* 4-Step Closed Loop Pipeline Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
                  {/* Step 1: Telemetry Anomaly */}
                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 space-y-1.5 hover:bg-rose-50/40 hover:border-rose-200 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-rose-700">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> 1. Alarm Detected
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200">
                        {inc.severity || 'CRITICAL'}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-800 leading-snug">
                      {inc.alert_type?.replace(/_/g, ' ') || 'High Vibration & Thermal Spike'}
                    </div>
                    <div className="text-[11px] text-slate-500 leading-tight">
                      Threshold breach: Vibration spike &gt; 7.5 mm/s
                    </div>
                  </div>

                  {/* Step 2: AI Diagnosis & RAG */}
                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 space-y-1.5 hover:bg-indigo-50/40 hover:border-indigo-200 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-700">
                        <Bot className="w-3.5 h-3.5 text-indigo-500" /> 2. AI Root Cause
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 border border-indigo-200 font-mono">
                        {inc.ai_confidence ? `${(inc.ai_confidence * 100).toFixed(0)}% Conf` : '94% Conf'}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-800 leading-snug truncate" title={inc.ai_root_cause || 'Spindle Bearing Fluting'}>
                      {inc.ai_root_cause || 'Spindle Bearing Fluting & Cage Wear'}
                    </div>
                    <div className="text-[11px] text-indigo-600 font-semibold flex items-center gap-1">
                      <Zap size={11} className="text-indigo-500" />
                      RAG SOP Match: Bearing Replacement
                    </div>
                  </div>

                  {/* Step 3: ATP & Auto-PO */}
                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 space-y-1.5 hover:bg-amber-50/40 hover:border-amber-200 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                        <ShoppingCart className="w-3.5 h-3.5 text-amber-600" /> 3. Policy Procurement
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                        POL-01
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-800 leading-snug font-mono">
                      {inc.part_number || 'SKF-6205-2RSH'}
                    </div>
                    <div className="text-[11px] text-slate-500 leading-tight">
                      Auto-PO Dispatched &bull; ATP Reserved
                    </div>
                  </div>

                  {/* Step 4: Closed Loop Recovery */}
                  <div className={`p-3.5 rounded-xl border space-y-1.5 transition-colors ${
                    isResolved
                      ? 'bg-emerald-50/60 border-emerald-200 hover:bg-emerald-50'
                      : isVerifying
                      ? 'bg-purple-50/60 border-purple-200 hover:bg-purple-50'
                      : 'bg-slate-50/80 border-slate-200/80 hover:bg-slate-100'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className={`flex items-center gap-1.5 text-xs font-bold ${
                        isResolved ? 'text-emerald-700' : isVerifying ? 'text-purple-700' : 'text-slate-700'
                      }`}>
                        <CheckCircle2 className={`w-3.5 h-3.5 ${isResolved ? 'text-emerald-600' : isVerifying ? 'text-purple-600' : 'text-slate-400'}`} />
                        4. Health Verification
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                        isResolved
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          : isVerifying
                          ? 'bg-purple-100 text-purple-800 border-purple-200'
                          : 'bg-slate-200 text-slate-700 border-slate-300'
                      }`}>
                        {isResolved ? 'PASSED' : isVerifying ? 'OBSERVING' : 'PENDING'}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-800 leading-snug">
                      {isResolved
                        ? 'Verified Clean (Vib < 2.5 mm/s)'
                        : isVerifying
                        ? '3-Cycle Telemetry Observation'
                        : 'Repair / Verification Pending'}
                    </div>
                    <div className="text-[11px] text-slate-500 leading-tight">
                      {isResolved
                        ? 'Machine recovered to 98% Health'
                        : isVerifying
                        ? 'Monitoring live sensor telemetry'
                        : 'Awaiting physical LOTO & repair'}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
