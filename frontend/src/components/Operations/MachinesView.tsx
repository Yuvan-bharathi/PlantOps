import React, { useState } from 'react';
import { 
  Cpu, Activity, Search, Filter, AlertTriangle, CheckCircle2, 
  Clock, ArrowRight, Gauge, Wrench, ChevronRight, Layers, Sparkles
} from 'lucide-react';
import { Machine, TelemetryData } from '../../types';

interface MachinesViewProps {
  machines: Machine[];
  telemetryMap: Record<string, TelemetryData>;
  onSelectMachine: (machine: Machine) => void;
  onNavigateTwin: () => void;
}

export const MachinesView: React.FC<MachinesViewProps> = ({
  machines,
  telemetryMap,
  onSelectMachine,
  onNavigateTwin
}) => {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const filteredMachines = machines.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase()) || 
                          m.code.toLowerCase().includes(search.toLowerCase()) ||
                          (m.area && m.area.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = filterStatus === 'ALL' || m.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RUNNING':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'WARNING':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'FAULT':
        return 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse';
      case 'MAINTENANCE':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'WAITING_PARTS':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'VERIFYING':
        return 'bg-purple-50 text-purple-700 border-purple-200 animate-pulse';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <Cpu className="w-4 h-4" />
            </div>
            Plant Machinery & Asset Registry
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Master catalog of all 24 production assets, telemetry sensor bindings, health ratings, and maintenance history.
          </p>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search code, name, cell..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-52"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs">
            {['ALL', 'RUNNING', 'WARNING', 'FAULT'].map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                  filterStatus === st
                    ? 'bg-white text-blue-600 shadow-sm border border-slate-200/80 font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid of Machine Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMachines.map((m) => {
          const telem = telemetryMap[m.code];
          const isFault = m.status === 'FAULT';
          const isWarning = m.status === 'WARNING';
          const temp = telem?.temperature ?? (isFault ? 82.4 : 62.0);
          const vib = telem?.vibration ?? (isFault ? 9.4 : 2.2);

          return (
            <div
              key={m.id || m.code}
              className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-4"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-extrabold text-sm text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-200">
                        {m.code}
                      </span>
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${getStatusBadge(m.status)}`}>
                        {m.status}
                      </span>
                    </div>
                    <h3 className="font-bold text-sm text-slate-900 mt-2 leading-tight">
                      {m.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">{m.area || 'Production Line 1'}</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                    {m.criticality || 'HIGH'}
                  </span>
                </div>

                {/* Health Score Gauge */}
                <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-500 font-medium">Asset Health Score</span>
                    <span className={`font-mono font-bold ${
                      m.health_score < 50 ? 'text-rose-600' : m.health_score < 80 ? 'text-amber-600' : 'text-emerald-600'
                    }`}>
                      {m.health_score}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        m.health_score < 50 ? 'bg-rose-500' : m.health_score < 80 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${m.health_score}%` }}
                    />
                  </div>
                </div>

                {/* Live Telemetry Mini-Pills */}
                <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="text-[10px] text-slate-400">Temperature</div>
                    <div className={`font-mono font-bold mt-0.5 ${temp > 75 ? 'text-rose-600' : 'text-slate-800'}`}>
                      {temp.toFixed(1)} °C
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="text-[10px] text-slate-400">Vibration</div>
                    <div className={`font-mono font-bold mt-0.5 ${vib > 6.0 ? 'text-rose-600' : 'text-slate-800'}`}>
                      {vib.toFixed(2)} mm/s
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => {
                    onSelectMachine(m);
                    onNavigateTwin();
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors"
                >
                  <Layers size={14} />
                  <span>Inspect in 3D Digital Twin</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
