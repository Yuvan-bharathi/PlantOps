import React, { useState } from 'react';
import { 
  Wrench, ShieldCheck, AlertOctagon, CheckCircle2, 
  User, Clock, FileText, Play, Package, CheckSquare, 
  ExternalLink, Send, Boxes, AlertTriangle
} from 'lucide-react';
import { WorkOrder } from '../../types';
import { api } from '../../services/api';

interface WorkOrdersViewProps {
  workOrders: WorkOrder[];
  onRefresh: () => void;
  onSelectMachine: (code: string) => void;
}

export const WorkOrdersView: React.FC<WorkOrdersViewProps> = ({ workOrders, onRefresh, onSelectMachine }) => {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [activeChecklist, setActiveChecklist] = useState<Record<string, boolean[]>>({});

  const toggleCheck = (woId: string, idx: number) => {
    setActiveChecklist(prev => {
      const current = prev[woId] || [false, false, false, false];
      const updated = [...current];
      updated[idx] = !updated[idx];
      return { ...prev, [woId]: updated };
    });
  };

  const handleApplyLOTO = async (woId: string) => {
    setLoadingId(woId);
    try {
      await api.applyLOTO(woId, 'Arun Kumar (Lead Tech)');
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingId(null);
    }
  };

  const handleComplete = async (wo: WorkOrder) => {
    setLoadingId(wo.id);
    try {
      // 1. Tell simulator to normalize machine sensors
      await api.healMachine(wo.machine_code || wo.machine_id);
      // 2. Mark repair completed in backend
      await api.completeRepair(wo.id, 'Arun Kumar (Lead Tech)');
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="bg-[#FAF9F6] p-5 rounded-2xl border border-[#DDD9D0] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#1E293B] flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#2563EB]/10 border border-[#2563EB]/20 flex items-center justify-center text-[#2563EB]">
              <Wrench className="w-4 h-4" />
            </div>
            Maintenance Work Orders & Field Dispatch Queue
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            Active technician dispatches, LOTO workflow aligned with OSHA 1910.147 requirements, procedure checklists, and repair verification.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {workOrders.map((wo) => {
          const isDone = wo.status === 'COMPLETED';
          const isVerifying = wo.status === 'VERIFYING';
          const checks = activeChecklist[wo.id] || [wo.loto_applied ? true : false, false, false, false];

          const repairSteps = [
            'Isolate main circuit breaker & verify zero-energy state',
            'Disassemble component housing & extract worn assembly',
            'Install verified OEM replacement part & torque to spec',
            'Release LOTO lock & perform automated verification cycle'
          ];

          return (
            <div
              key={wo.id}
              className="bg-[#FAF9F6] p-5 rounded-2xl border border-[#DDD9D0] shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#DDD9D0]">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-[#2563EB] bg-white px-2 py-0.5 rounded border border-[#DDD9D0]">{wo.id}</span>
                    <button
                      onClick={() => onSelectMachine(wo.machine_code || wo.machine_id)}
                      className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white text-[#1E293B] hover:text-[#2563EB] border border-[#DDD9D0] transition-colors"
                    >
                      {wo.machine_code || wo.machine_id}
                    </button>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                    isDone
                      ? 'bg-[#E8F6EF] text-[#22A06B] border-[#B4E3CF]'
                      : (isVerifying ? 'bg-[#F2EEFA] text-[#7C5CC4] border-[#D4C7F2] animate-pulse' : 'bg-[#EBF2FA] text-[#3978C8] border-[#BAD5F3]')
                  }`}>
                    {wo.status}
                  </span>
                </div>

                <div className="my-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#64748B] flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-[#64748B]" /> Assigned Technician:
                    </span>
                    <span className="font-bold text-[#1E293B]">{wo.technician_name || 'Arun Kumar'}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#64748B] flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#64748B]" /> OSHA LOTO State:
                    </span>
                    <span className={`font-mono text-xs font-bold flex items-center gap-1 ${
                      wo.loto_applied ? 'text-[#22A06B]' : 'text-[#D64545]'
                    }`}>
                      {wo.loto_applied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertOctagon className="w-3.5 h-3.5" />}
                      {wo.loto_applied ? 'LOTO APPLIED & VERIFIED' : 'LOTO PENDING'}
                    </span>
                  </div>

                  {wo.notes && (
                    <p className="text-[11px] text-[#334155] bg-white p-2.5 rounded-xl border border-[#DDD9D0] leading-relaxed">
                      {wo.notes}
                    </p>
                  )}

                  {/* Interactive Repair Checklist */}
                  <div className="mt-3 pt-3 border-t border-[#DDD9D0] space-y-1.5">
                    <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1">
                      Field Execution SOP
                    </div>
                    {repairSteps.map((step, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => toggleCheck(wo.id, idx)}
                        disabled={isDone}
                        className={`w-full flex items-center gap-2 p-2 rounded-lg text-left text-xs transition-colors ${
                          checks[idx] ? 'bg-[#E8F6EF] text-[#1D8358] line-through' : 'bg-white text-[#334155] hover:bg-[#EAE7E0]'
                        } border border-[#DDD9D0]`}
                      >
                        <CheckSquare className={`w-3.5 h-3.5 flex-shrink-0 ${checks[idx] ? 'text-[#22A06B]' : 'text-[#64748B]'}`} />
                        <span className="truncate">{step}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {!isDone && (
                <div className="pt-2 border-t border-[#DDD9D0] flex items-center gap-2">
                  {!wo.loto_applied ? (
                    <button
                      onClick={() => handleApplyLOTO(wo.id)}
                      disabled={loadingId === wo.id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-xl bg-[#D99A06] hover:bg-amber-600 text-white shadow-md transition-all active:scale-95 disabled:opacity-50"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{loadingId === wo.id ? 'Applying...' : 'Apply LOTO Isolation Lock'}</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleComplete(wo)}
                      disabled={loadingId === wo.id || isVerifying}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-xl bg-[#22A06B] hover:bg-emerald-700 text-white shadow-md transition-all active:scale-95 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{loadingId === wo.id ? 'Processing...' : (isVerifying ? 'Verification In Progress...' : 'Complete Repair & Verify Baseline')}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
