import React, { useState } from 'react';
import { 
  Wrench, Calendar, Clock, AlertTriangle, CheckCircle2, 
  Plus, Filter, ShieldCheck, User, ArrowRight, RefreshCw, 
  BarChart2, FileText, ChevronRight, Play
} from 'lucide-react';
import { WorkOrder } from '../../types';

interface MaintenanceViewProps {
  workOrders: WorkOrder[];
  onRefresh: () => void;
  onSelectMachine: (code: string) => void;
}

export const MaintenanceView: React.FC<MaintenanceViewProps> = ({
  workOrders,
  onRefresh,
  onSelectMachine
}) => {
  const [filterType, setFilterType] = useState<'ALL' | 'PREVENTATIVE' | 'CORRECTIVE' | 'SCHEDULED'>('ALL');

  // Preventative maintenance schedules
  const pmSchedules = [
    {
      id: 'PM-2026-041',
      machineCode: 'CNC-01',
      machineName: '5-Axis CNC Milling Center',
      frequency: 'Every 250 Operating Hours',
      task: 'Spindle Taper Inspection & Dynamic Balancing',
      nextDue: '24 Sep 2026',
      assignedTo: 'Arun Kumar',
      status: 'SCHEDULED',
      priority: 'HIGH'
    },
    {
      id: 'PM-2026-042',
      machineCode: 'MIXER-01',
      machineName: 'High-Shear Lubricant Mixer',
      frequency: 'Monthly Routine',
      task: 'Agitator Gearbox Oil Flushing & Seal Inspection',
      nextDue: '26 Sep 2026',
      assignedTo: 'John Miller',
      status: 'PENDING_PARTS',
      priority: 'MEDIUM'
    },
    {
      id: 'PM-2026-043',
      machineCode: 'PUMP-01',
      machineName: 'Hydraulic Coolant Pump',
      frequency: 'Bi-Weekly PM',
      task: 'Filter Cartridge Replacement & Flow Rate Calibration',
      nextDue: '28 Sep 2026',
      assignedTo: 'Carlos Gomez',
      status: 'SCHEDULED',
      priority: 'LOW'
    },
    {
      id: 'PM-2026-044',
      machineCode: 'ROBOT-01',
      machineName: '6-Axis Articulated Robot',
      frequency: 'Quarterly Service',
      task: 'Harmonic Drive Backlash Check & Joint 3 Calibration',
      nextDue: '30 Sep 2026',
      assignedTo: 'Sarah Jenkins',
      status: 'SCHEDULED',
      priority: 'HIGH'
    }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-[#FAF9F6] p-5 rounded-2xl border border-[#DDD9D0] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#1E293B] flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#2563EB]/10 border border-[#2563EB]/20 flex items-center justify-center text-[#2563EB]">
              <Wrench className="w-4 h-4" />
            </div>
            Plant Maintenance & Reliability Planning
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            Preventative maintenance (PM) schedules, corrective repair queues, machine downtime registers, and OSHA compliance logs.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={onRefresh}
            className="p-2 rounded-xl bg-white hover:bg-[#EAE7E0] text-[#64748B] border border-[#DDD9D0] transition-colors"
            title="Refresh Schedules"
          >
            <RefreshCw size={14} />
          </button>
          <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-all active:scale-95">
            <Plus size={13} /> Schedule PM Routine
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-bold text-[#64748B] mb-1">Mean Time to Repair (MTTR)</div>
          <div className="text-2xl font-black text-[#1E293B] font-mono">42 min</div>
          <div className="text-[11px] text-[#22A06B] font-medium mt-1">↓ 18% improvement vs baseline</div>
        </div>

        <div className="bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-bold text-[#64748B] mb-1">Mean Time Between Failures</div>
          <div className="text-2xl font-black text-[#1E293B] font-mono">186 hrs</div>
          <div className="text-[11px] text-[#22A06B] font-medium mt-1">↑ Reliability target exceeded</div>
        </div>

        <div className="bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-bold text-[#64748B] mb-1">Preventative vs Corrective</div>
          <div className="text-2xl font-black text-[#1E293B] font-mono">82% / 18%</div>
          <div className="text-[11px] text-[#0F766E] font-medium mt-1">Industry benchmark: 80/20</div>
        </div>

        <div className="bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-bold text-[#64748B] mb-1">Active PM Compliance</div>
          <div className="text-2xl font-black text-[#1E293B] font-mono">96.4%</div>
          <div className="text-[11px] text-[#22A06B] font-medium mt-1">Zero overdue safety work orders</div>
        </div>
      </div>

      {/* Scheduled PM Master Register */}
      <div className="bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-[#1E293B] flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#2563EB]" />
            Preventative Maintenance (PM) Calendar & Recurring Routines
          </h3>

          <div className="flex bg-[#EAE7E0] p-1 rounded-xl border border-[#DDD9D0]">
            {(['ALL', 'PREVENTATIVE', 'CORRECTIVE', 'SCHEDULED'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  filterType === type
                    ? 'bg-[#2563EB] text-white shadow-sm'
                    : 'text-[#64748B] hover:text-[#1E293B]'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {pmSchedules.map((pm) => (
            <div
              key={pm.id}
              className="bg-white p-4 rounded-xl border border-[#DDD9D0] hover:border-[#2563EB] transition-all flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-[#1E293B]">{pm.id}</span>
                    <button
                      onClick={() => onSelectMachine(pm.machineCode)}
                      className="text-[10px] font-bold bg-[#EAE7E0] text-[#2563EB] hover:underline px-2 py-0.5 rounded-md"
                    >
                      {pm.machineCode}
                    </button>
                  </div>
                  <span className="text-[10px] font-bold bg-[#FEF7E6] text-[#D99A06] border border-[#F8DF9E] px-2 py-0.5 rounded-md">
                    {pm.priority} PRIORITY
                  </span>
                </div>

                <div className="text-xs font-bold text-[#1E293B] mt-1">{pm.task}</div>
                <div className="text-[11px] text-[#64748B] mt-0.5">{pm.machineName} &bull; {pm.frequency}</div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#DDD9D0] text-xs">
                <div className="flex items-center gap-1.5 text-[#64748B]">
                  <User className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>{pm.assignedTo}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#64748B] font-medium">Due: {pm.nextDue}</span>
                  <button className="text-[10px] font-bold px-2.5 py-1 bg-[#2563EB] text-white rounded-lg hover:bg-blue-700 transition-colors">
                    Dispatch
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Work Orders Link */}
      <div className="bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-5 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#2563EB]/10 flex items-center justify-center text-[#2563EB]">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-[#1E293B]">Connected Work Orders Queue ({workOrders.length} active)</div>
            <div className="text-xs text-[#64748B]">LOTO workflow aligned with OSHA 1910.147 requirements & repair dispatches synced</div>
          </div>
        </div>
        <button
          onClick={() => onSelectMachine('CNC-01')}
          className="flex items-center gap-1 px-3.5 py-2 bg-white hover:bg-[#EAE7E0] border border-[#DDD9D0] text-[#1E293B] rounded-xl text-xs font-bold transition-all"
        >
          <span>View 3D Asset Floor</span>
          <ChevronRight className="w-4 h-4 text-[#64748B]" />
        </button>
      </div>
    </div>
  );
};
