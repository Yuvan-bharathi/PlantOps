import React, { useState, useMemo, useEffect } from 'react';
import { 
  Wrench, 
  ShieldCheck, 
  AlertOctagon, 
  CheckCircle2, 
  User, 
  Clock, 
  FileText, 
  Play, 
  Package, 
  CheckSquare, 
  ExternalLink, 
  Send, 
  Boxes, 
  AlertTriangle,
  Search,
  Filter,
  Lock,
  Zap,
  Activity,
  Check,
  RotateCcw,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  Cpu,
  Layers,
  Timer
} from 'lucide-react';
import { WorkOrder } from '../../types';
import { api } from '../../services/api';
import { ToastMessage } from '../ToastNotification';
import { CustomSelect } from '../common/CustomSelect';

interface WorkOrdersViewProps {
  workOrders: WorkOrder[];
  onRefresh: () => void;
  onSelectMachine: (code: string) => void;
  onNavigateTab?: (tab: string) => void;
  onAddToast?: (toast: Omit<ToastMessage, 'id' | 'timestamp'> & { timestamp?: string }) => void;
}

export const WorkOrdersView: React.FC<WorkOrdersViewProps> = ({ 
  workOrders, 
  onRefresh, 
  onSelectMachine,
  onNavigateTab,
  onAddToast
}) => {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [activeChecklist, setActiveChecklist] = useState<Record<string, boolean[]>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedCell, setSelectedCell] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Compute live operational KPIs
  const totalWorkOrders = workOrders.length;
  const lotoActiveCount = workOrders.filter(w => w.loto_applied).length;
  const inProgressCount = workOrders.filter(w => w.status === 'IN_PROGRESS' || w.status === 'INSPECTING').length;
  const verifyingCount = workOrders.filter(w => w.status === 'VERIFYING').length;
  const completedCount = workOrders.filter(w => w.status === 'COMPLETED').length;

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedStatus, selectedCell]);

  // Filter work orders
  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter(wo => {
      const q = searchQuery.toLowerCase().trim();
      const mCode = wo.machine_code || wo.machine_id || '';
      const matchesSearch = !q || 
        wo.id.toLowerCase().includes(q) ||
        mCode.toLowerCase().includes(q) ||
        (wo.technician_name || '').toLowerCase().includes(q) ||
        (wo.notes || '').toLowerCase().includes(q);

      let matchesStatus = true;
      if (selectedStatus === 'LOTO') matchesStatus = wo.loto_applied && wo.status !== 'COMPLETED';
      else if (selectedStatus === 'IN_PROGRESS') matchesStatus = wo.status === 'IN_PROGRESS' || wo.status === 'INSPECTING';
      else if (selectedStatus === 'VERIFYING') matchesStatus = wo.status === 'VERIFYING';
      else if (selectedStatus === 'COMPLETED') matchesStatus = wo.status === 'COMPLETED';

      let matchesCell = true;
      if (selectedCell !== 'ALL') {
        if (selectedCell === 'Machining') matchesCell = mCode.startsWith('CNC');
        else if (selectedCell === 'Robotics') matchesCell = mCode.startsWith('ROBOT');
        else if (selectedCell === 'Packaging') matchesCell = mCode.startsWith('PACK') || mCode.startsWith('CONV');
        else if (selectedCell === 'Processing') matchesCell = mCode.startsWith('PUMP') || mCode.startsWith('MIXER') || mCode.startsWith('PRESS');
        else if (selectedCell === 'Assembly') matchesCell = mCode.startsWith('ASMB') || mCode.startsWith('BENCH');
      }

      return matchesSearch && matchesStatus && matchesCell;
    });
  }, [workOrders, searchQuery, selectedStatus, selectedCell]);

  // Paginated slice
  const totalPages = Math.ceil(filteredWorkOrders.length / itemsPerPage) || 1;
  const paginatedWorkOrders = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredWorkOrders.slice(start, start + itemsPerPage);
  }, [filteredWorkOrders, currentPage, itemsPerPage]);

  const toggleCheck = (woId: string, idx: number) => {
    setActiveChecklist(prev => {
      const current = prev[woId] || [false, false, false, false];
      const updated = [...current];
      updated[idx] = !updated[idx];
      return { ...prev, [woId]: updated };
    });
  };

  const handleApplyLOTO = async (woId: string, machineCode: string) => {
    setLoadingId(woId);
    try {
      await api.applyLOTO(woId, 'Arun Kumar (Lead Tech)');
      onAddToast?.({
        type: 'LOTO',
        title: '🔒 OSHA 1910.147 LOTO Padlock Verified',
        subtitle: `Zero-Energy Isolation Active on ${machineCode}`,
        message: `Padlock PL-8894-LOTO attached. Residual voltage: 0.0V • Residual pressure: 0.0 bar. Authorized for physical disassembly.`,
        metaBadge: 'OSHA COMPLIANT'
      });
      onRefresh();
    } catch (err: any) {
      console.error(err);
      onAddToast?.({ type: 'INFO', title: 'LOTO Notice', message: err.message });
    } finally {
      setLoadingId(null);
    }
  };

  const handleComplete = async (wo: WorkOrder) => {
    setLoadingId(wo.id);
    const mCode = wo.machine_code || wo.machine_id;
    try {
      // 1. Tell simulator to normalize machine sensors
      await api.healMachine(mCode);
      // 2. Mark repair completed in backend
      await api.completeRepair(wo.id, wo.technician_name || 'Arun Kumar (Lead Tech)');

      onAddToast?.({
        type: 'AI_AGENT',
        title: '⚙️ Physical Repair Completed & Verified',
        subtitle: `${mCode} Entering 3-Cycle Baseline Observation`,
        message: `Technician certified replacement assembly. LOTO interlock released. Continuous sensor telemetry active to verify recovery.`,
        metaBadge: 'VERIFYING'
      });
      onRefresh();
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingId(null);
    }
  };

  const getCellName = (code: string = '') => {
    if (code.startsWith('CNC')) return 'Machining Cell';
    if (code.startsWith('ROBOT')) return 'Robotics Cell';
    if (code.startsWith('PACK') || code.startsWith('CONV')) return 'Packaging Cell';
    if (code.startsWith('PUMP') || code.startsWith('MIXER') || code.startsWith('PRESS')) return 'Processing Cell';
    if (code.startsWith('ASMB') || code.startsWith('BENCH')) return 'Assembly Cell';
    return 'Production Zone A';
  };

  return (
    <div className="space-y-5 w-full">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. TOP HEADER & WORKLOAD KPI RIBBON */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="bg-[#FAF9F6] p-5 rounded-2xl border border-[#DDD9D0] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/20">
              Field Execution &amp; Safety Hub
            </span>
            <span className="text-xs text-[#64748B] font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              OSHA 1910.147 Aligned
            </span>
          </div>
          <h2 className="text-lg font-bold text-[#1E293B] flex items-center gap-2.5 mt-1.5">
            <div className="w-8 h-8 rounded-lg bg-[#2563EB]/10 border border-[#2563EB]/20 flex items-center justify-center text-[#2563EB]">
              <Wrench className="w-4 h-4" />
            </div>
            Maintenance Work Orders &amp; OSHA LOTO Field Queue
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            Active technician dispatches, Lockout/Tagout isolation verification, procedure SOP checklists, and baseline verification cycles.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigateTab?.('technicians')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-[#EAE7E0] border border-[#DDD9D0] text-[#1E293B] rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            <User size={13} className="text-[#2563EB]" />
            <span>Technicians Matrix</span>
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. SEARCH & STATUS FILTER TOOLBAR */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
          <input
            type="text"
            placeholder="Search by Work Order ID, machine code, tech, or part..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 bg-white border border-[#DDD9D0] rounded-xl text-xs text-[#1E293B] font-medium placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] shadow-xs"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex bg-[#EAE7E0] p-1 rounded-xl border border-[#DDD9D0] overflow-x-auto no-scrollbar">
          {(
            [
              { id: 'ALL', label: 'All Orders', count: totalWorkOrders },
              { id: 'LOTO', label: 'LOTO Active', count: lotoActiveCount },
              { id: 'IN_PROGRESS', label: 'In Repair', count: inProgressCount },
              { id: 'VERIFYING', label: 'Verifying', count: verifyingCount },
              { id: 'COMPLETED', label: 'Completed', count: completedCount }
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedStatus(tab.id)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                selectedStatus === tab.id
                  ? 'bg-[#2563EB] text-white shadow-sm'
                  : 'text-[#64748B] hover:text-[#1E293B]'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                selectedStatus === tab.id ? 'bg-white/20 text-white' : 'bg-[#DDD9D0] text-[#1E293B]'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Cell Filter Dropdown */}
        <div className="flex items-center gap-2">
          <CustomSelect
            prefix="Cell:"
            value={selectedCell}
            onChange={(val) => setSelectedCell(val)}
            options={[
              { value: 'ALL', label: 'All Cells' },
              { value: 'Machining', label: 'Machining Cell (CNC-01 - 06)' },
              { value: 'Robotics', label: 'Robotics Cell (ROBOT-01 - 02)' },
              { value: 'Packaging', label: 'Packaging Cell (PACK-01, CONV-01)' },
              { value: 'Processing', label: 'Processing Cell (PUMP, MIXER, PRESS)' },
              { value: 'Assembly', label: 'Assembly Cell (ASMB-01, BENCH-01)' },
            ]}
            size="sm"
          />
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. HIGH-DENSITY WORK ORDER EXECUTION CARDS */}
      {/* ───────────────────────────────────────────────────────────── */}
      {filteredWorkOrders.length === 0 ? (
        <div className="bg-[#FAF9F6] p-12 text-center rounded-2xl border border-dashed border-[#DDD9D0] shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto mb-2.5">
            <CheckCircle2 size={24} />
          </div>
          <h4 className="text-sm font-bold text-[#1E293B]">No Work Orders Found</h4>
          <p className="text-xs text-[#64748B] mt-0.5">No work orders match the current filter criteria.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paginatedWorkOrders.map((wo) => {
            const isDone = wo.status === 'COMPLETED';
            const isVerifying = wo.status === 'VERIFYING';
            const mCode = wo.machine_code || wo.machine_id;
            const cellName = getCellName(mCode);
            const checks = activeChecklist[wo.id] || [wo.loto_applied ? true : false, false, false, false];
            const checkedCount = checks.filter(Boolean).length;

            const repairSteps = [
              'Isolate main circuit breaker & verify zero-energy state (0.0V / 0.0 bar)',
              'Disassemble component housing & extract worn mechanical assembly',
              'Install verified OEM replacement part & torque fasteners to spec',
              'Release LOTO lock & perform automated 3-cycle verification'
            ];

            return (
              <div
                key={wo.id}
                className={`bg-white p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between space-y-4 shadow-xs hover:shadow-md ${
                  isVerifying 
                    ? 'border-purple-300 ring-2 ring-purple-100 bg-purple-50/5' 
                    : isDone 
                    ? 'border-emerald-200 bg-emerald-50/5' 
                    : 'border-[#DDD9D0]'
                }`}
              >
                <div>
                  {/* Top Header Row */}
                  <div className="flex items-center justify-between pb-3 border-b border-[#DDD9D0] gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Asset Glyph */}
                      <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#2563EB] border border-blue-200 flex items-center justify-center font-mono font-bold text-xs">
                        <Cpu size={14} />
                      </div>
                      <span className="font-mono font-extrabold text-xs text-[#2563EB] bg-[#FAF9F6] px-2 py-0.5 rounded border border-[#DDD9D0]">
                        {wo.id}
                      </span>
                      <button
                        onClick={() => onSelectMachine(mCode)}
                        className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#FAF9F6] text-[#1E293B] hover:text-[#2563EB] hover:bg-blue-50 border border-[#DDD9D0] transition-colors"
                        title="View in 3D Factory Twin"
                      >
                        {mCode}
                      </button>
                      <span className="text-[11px] font-semibold text-[#64748B]">
                        &bull; {cellName}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase border ${
                        wo.priority === 'CRITICAL' || wo.priority === 'HIGH'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
                        {wo.priority || 'HIGH'}
                      </span>
                      <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                        isDone
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : isVerifying
                          ? 'bg-purple-50 text-purple-700 border-purple-200 animate-pulse'
                          : 'bg-blue-50 text-[#2563EB] border-blue-200'
                      }`}>
                        {wo.status}
                      </span>
                    </div>
                  </div>

                  {/* Technician & OSHA LOTO Zero-Energy Box */}
                  <div className="my-3 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#64748B] flex items-center gap-1.5 font-medium">
                        <User className="w-3.5 h-3.5 text-[#64748B]" /> Assigned Specialist:
                      </span>
                      <span className="font-bold text-[#1E293B] flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        {wo.technician_name || 'Arun Kumar (Lead Tech)'}
                      </span>
                    </div>

                    {/* OSHA 1910.147 Protocol Status Box */}
                    <div className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                      wo.loto_applied 
                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' 
                        : 'bg-rose-50/70 border-rose-200 text-rose-900'
                    }`}>
                      <div className="flex items-center gap-2">
                        {wo.loto_applied ? (
                          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
                        )}
                        <div>
                          <div className="font-bold text-xs">
                            {wo.loto_applied ? 'OSHA LOTO APPLIED & VERIFIED' : 'OSHA LOTO ISOLATION PENDING'}
                          </div>
                          <div className="text-[10px] opacity-80 font-mono">
                            {wo.loto_applied ? 'Padlock: PL-8894-LOTO • 0.0V Residual • 0.0 bar' : 'Energy isolation required before disassembly'}
                          </div>
                        </div>
                      </div>

                      <span className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded border ${
                        wo.loto_applied ? 'bg-white text-emerald-700 border-emerald-300' : 'bg-white text-rose-700 border-rose-300'
                      }`}>
                        {wo.loto_applied ? 'LOCKED' : 'UNSAFE'}
                      </span>
                    </div>

                    {/* Diagnosis & Staged Parts */}
                    {wo.notes && (
                      <div className="bg-[#FAF9F6] p-3 rounded-xl border border-[#DDD9D0] text-xs space-y-1">
                        <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider flex items-center justify-between">
                          <span>Diagnosis &amp; Staged Parts</span>
                          <span className="text-purple-700 font-mono">Central Spares BAY-A-04</span>
                        </div>
                        <p className="text-[11px] text-[#1E293B] leading-relaxed font-medium">
                          {wo.notes}
                        </p>
                      </div>
                    )}

                    {/* Interactive 4-Step Field SOP Checklist */}
                    <div className="mt-3 pt-3 border-t border-[#DDD9D0] space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                        <span>Field Execution SOP ({checkedCount}/4 Done)</span>
                        <div className="w-20 bg-[#EAE7E0] h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-[#2563EB] h-full transition-all duration-300"
                            style={{ width: `${(checkedCount / 4) * 100}%` }}
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        {repairSteps.map((step, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => toggleCheck(wo.id, idx)}
                            disabled={isDone}
                            className={`w-full flex items-center gap-2 p-2 rounded-xl text-left text-xs transition-all ${
                              checks[idx] 
                                ? 'bg-emerald-50 text-emerald-800 line-through border-emerald-200' 
                                : 'bg-[#FAF9F6] text-[#1E293B] hover:bg-[#EAE7E0] border-[#DDD9D0]'
                            } border shadow-2xs`}
                          >
                            <span className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 border ${
                              checks[idx] ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-[#CBD5E1] bg-white'
                            }`}>
                              {checks[idx] && <Check size={11} />}
                            </span>
                            <span className="truncate">{step}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Controls */}
                {!isDone ? (
                  <div className="space-y-2 pt-3 border-t border-[#DDD9D0]">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={async () => {
                          try {
                            await api.escalateIssue({
                              senderRole: 'TECHNICIAN',
                              senderName: 'Arun Kumar',
                              targetRole: 'INVENTORY_MGMT',
                              type: 'SPARE_REQUEST',
                              title: `Spares Request for ${mCode}`,
                              details: `Technician Arun Kumar requested OEM replacement bearing & seals staged at BAY-B for ${wo.id}.`,
                              metadata: { workOrderId: wo.id, machineCode: mCode }
                            });
                            onAddToast?.({
                              type: 'DISPATCH',
                              title: '📦 Spares Requisition Dispatched',
                              subtitle: `Target: Central Warehouse (${mCode})`,
                              message: `Requisition staged for ${wo.id}. Warehouse supervisor notified.`,
                              metaBadge: 'ATP RESERVED'
                            });
                          } catch (e: any) {
                            console.error(e);
                          }
                        }}
                        className="flex items-center justify-center gap-1.5 py-2 px-2.5 text-xs font-bold rounded-xl bg-white hover:bg-[#EAE7E0] text-[#1E293B] border border-[#DDD9D0] transition-all shadow-xs"
                      >
                        <Package className="w-3.5 h-3.5 text-[#2563EB]" />
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
                              title: `LOTO Isolation Hold on ${mCode}`,
                              details: `Safety hold logged for ${wo.id}. Breaker isolated. Zero energy verification awaiting supervisor signoff.`,
                              metadata: { workOrderId: wo.id, machineCode: mCode }
                            });
                            onAddToast?.({
                              type: 'INFO',
                              title: '⚠️ Supervisor Safety Escalation Sent',
                              subtitle: `LOTO Protocol Sign-Off for ${mCode}`,
                              message: `Alert dispatched to Shift Supervisor console.`,
                              metaBadge: 'ESCALATION'
                            });
                          } catch (e: any) {
                            console.error(e);
                          }
                        }}
                        className="flex items-center justify-center gap-1.5 py-2 px-2.5 text-xs font-bold rounded-xl bg-white hover:bg-rose-50 text-rose-600 border border-[#DDD9D0] transition-all shadow-xs"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                        <span>Alert Supervisor</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {!wo.loto_applied ? (
                        <button
                          onClick={() => handleApplyLOTO(wo.id, mCode)}
                          disabled={loadingId === wo.id}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-md transition-all active:scale-95 disabled:opacity-50"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>{loadingId === wo.id ? 'Applying Isolation Lock...' : 'Apply OSHA LOTO Isolation Lock'}</span>
                        </button>
                      ) : isVerifying ? (
                        <div className="flex-1 p-2.5 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-between text-xs gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-purple-600 animate-ping shrink-0" />
                            <div className="truncate">
                              <div className="font-bold text-purple-900 text-xs">3-Cycle Telemetry Verification</div>
                              <div className="text-[10px] text-purple-700">Observing live sensor baseline (&lt; 2.5 mm/s)</div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleComplete(wo)}
                            disabled={loadingId === wo.id}
                            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-xs shrink-0 shadow-xs transition-all active:scale-95"
                          >
                            {loadingId === wo.id ? 'Certifying...' : 'Certify & Complete'}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleComplete(wo)}
                          disabled={loadingId === wo.id}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all active:scale-95 disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{loadingId === wo.id ? 'Processing...' : 'Complete Physical Repair & Trigger Verification'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="pt-3 border-t border-[#DDD9D0] flex items-center justify-between text-xs text-[#64748B]">
                    <span className="flex items-center gap-1 font-semibold text-emerald-700">
                      <CheckCircle2 size={13} className="text-emerald-600" />
                      Repair Completed &amp; Verified in TiDB Cloud
                    </span>
                    <button
                      onClick={() => onSelectMachine(mCode)}
                      className="font-bold text-[#2563EB] hover:underline"
                    >
                      View Live 3D &rarr;
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Pagination Controls Bar */}
        {totalPages > 1 && (
          <div className="bg-white border border-[#DDD9D0] rounded-2xl p-3.5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-[#64748B] flex items-center gap-2">
              <span>
                Showing <strong className="text-[#1E293B]">{(currentPage - 1) * itemsPerPage + 1}</strong> to <strong className="text-[#1E293B]">{Math.min(currentPage * itemsPerPage, filteredWorkOrders.length)}</strong> of <strong className="text-[#1E293B]">{filteredWorkOrders.length}</strong> work orders
              </span>
              <span className="px-2 py-0.5 rounded-md bg-[#FAF9F6] border border-[#DDD9D0] text-[10px] font-bold text-[#64748B]">
                15 per page
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1.5 rounded-lg border border-[#DDD9D0] bg-white hover:bg-[#FAF9F6] text-xs font-bold text-[#1E293B] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-all shadow-xs"
              >
                <ChevronLeft size={13} />
                <span>Prev</span>
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                      currentPage === pageNum
                        ? 'bg-[#2563EB] text-white shadow-xs'
                        : 'bg-white hover:bg-[#FAF9F6] text-[#64748B] border border-[#DDD9D0]'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1.5 rounded-lg border border-[#DDD9D0] bg-white hover:bg-[#FAF9F6] text-xs font-bold text-[#1E293B] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-all shadow-xs"
              >
                <span>Next</span>
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
    )}
    </div>
  );
};
