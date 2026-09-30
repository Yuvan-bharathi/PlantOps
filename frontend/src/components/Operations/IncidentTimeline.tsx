import React, { useState, useMemo, useEffect } from 'react';
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
  ChevronRight,
  ChevronLeft,
  Search,
  Filter,
  CheckCircle,
  ExternalLink,
  Eye,
  Sliders,
  TrendingDown,
  TrendingUp,
  Layers,
  Sparkles,
  FileText,
  X,
  Radio,
  BarChart3,
  Timer,
  Cpu,
  Lock,
  Boxes,
  Check,
  RotateCcw,
  SlidersHorizontal,
  ChevronDown,
  Target,
  LayoutList,
  GitCommit
} from 'lucide-react';
import { Incident } from '../../types';
import { ToastMessage } from '../ToastNotification';
import { CustomSelect } from '../common/CustomSelect';

interface IncidentTimelineProps {
  incidents: Incident[];
  onSelectMachine: (machineCode: string) => void;
  onNavigateTab?: (tab: string) => void;
  onAddToast?: (toast: Omit<ToastMessage, 'id' | 'timestamp'> & { timestamp?: string }) => void;
}

export const IncidentTimeline: React.FC<IncidentTimelineProps> = ({ 
  incidents, 
  onSelectMachine,
  onNavigateTab,
  onAddToast
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'LOW'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedCell, setSelectedCell] = useState('ALL');
  const [timeRange, setTimeRange] = useState('7d');
  const [sortBy, setSortBy] = useState<'latest' | 'severity' | 'health'>('latest');
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Selected Incident for the Right Drawer Panel
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(
    incidents.length > 0 ? incidents[0].id : null
  );
  const [activeSubTab, setActiveSubTab] = useState<'timeline' | 'ai' | 'workorder' | 'procurement' | 'verification'>('timeline');

  // Compute Live Operational KPIs for Plant Admins & Shift Supervisors
  const totalIncidents = incidents.length;
  const criticalCount = incidents.filter(i => i.severity === 'CRITICAL' || i.severity === 'HIGH').length;
  const warningCount = incidents.filter(i => i.severity === 'MEDIUM').length;
  const lowCount = incidents.filter(i => i.severity === 'LOW' || !i.severity).length;
  const resolvedCount = incidents.filter(i => i.status === 'RESOLVED' || i.status === 'CLOSED').length;
  const verifyingCount = incidents.filter(i => i.status === 'VERIFYING').length;
  const inspectingCount = incidents.filter(i => i.status === 'INSPECTING' || i.status === 'IN_PROGRESS').length;
  const assignedCount = incidents.filter(i => i.status === 'ASSIGNED').length;
  const detectedCount = incidents.filter(i => i.status === 'OPEN' || i.status === 'DETECTED').length;

  const autonomousRate = totalIncidents > 0 ? Math.round(((resolvedCount + verifyingCount) / totalIncidents) * 100) : 94.2;

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedSeverity, selectedStatus, selectedCell, sortBy]);

  // Filter incidents based on search, severity, status, and cell
  const filteredIncidents = useMemo(() => {
    return incidents.filter(inc => {
      // Search match
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        inc.id.toLowerCase().includes(q) ||
        (inc.machine_code || inc.machine_id).toLowerCase().includes(q) ||
        (inc.machine_name || '').toLowerCase().includes(q) ||
        (inc.ai_root_cause || '').toLowerCase().includes(q) ||
        (inc.alert_type || '').toLowerCase().includes(q) ||
        (inc.part_number || '').toLowerCase().includes(q);

      // Severity match
      let matchesSeverity = true;
      if (selectedSeverity === 'CRITICAL') matchesSeverity = inc.severity === 'CRITICAL' || inc.severity === 'HIGH';
      else if (selectedSeverity === 'WARNING') matchesSeverity = inc.severity === 'MEDIUM';
      else if (selectedSeverity === 'LOW') matchesSeverity = inc.severity === 'LOW' || !inc.severity;

      // Status match
      let matchesStatus = true;
      if (selectedStatus !== 'ALL') {
        if (selectedStatus === 'DETECTED') matchesStatus = inc.status === 'OPEN' || inc.status === 'DETECTED';
        else if (selectedStatus === 'ASSIGNED') matchesStatus = inc.status === 'ASSIGNED';
        else if (selectedStatus === 'INSPECTING') matchesStatus = inc.status === 'INSPECTING' || inc.status === 'IN_PROGRESS';
        else if (selectedStatus === 'VERIFYING') matchesStatus = inc.status === 'VERIFYING';
        else if (selectedStatus === 'RESOLVED') matchesStatus = inc.status === 'RESOLVED' || inc.status === 'CLOSED';
      }

      // Cell match
      let matchesCell = true;
      if (selectedCell !== 'ALL') {
        const mCode = inc.machine_code || inc.machine_id;
        if (selectedCell === 'Machining') matchesCell = mCode.startsWith('CNC');
        else if (selectedCell === 'Robotics') matchesCell = mCode.startsWith('ROBOT');
        else if (selectedCell === 'Packaging') matchesCell = mCode.startsWith('PACK') || mCode.startsWith('CONV');
        else if (selectedCell === 'Processing') matchesCell = mCode.startsWith('PUMP') || mCode.startsWith('MIXER') || mCode.startsWith('PRESS');
        else if (selectedCell === 'Assembly') matchesCell = mCode.startsWith('ASMB') || mCode.startsWith('BENCH');
      }

      return matchesSearch && matchesSeverity && matchesStatus && matchesCell;
    });
  }, [incidents, searchQuery, selectedSeverity, selectedStatus, selectedCell]);

  // Paginated slice
  const totalPages = Math.ceil(filteredIncidents.length / itemsPerPage) || 1;
  const paginatedIncidents = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredIncidents.slice(start, start + itemsPerPage);
  }, [filteredIncidents, currentPage, itemsPerPage]);

  // Active selected incident details
  const activeIncident = incidents.find(i => i.id === selectedIncidentId) || paginatedIncidents[0] || filteredIncidents[0] || incidents[0] || null;

  // Helper for Machine Cell classification
  const getCellName = (code: string = '') => {
    if (code.startsWith('CNC')) return 'Machining Cell';
    if (code.startsWith('ROBOT')) return 'Robotics Cell';
    if (code.startsWith('PACK') || code.startsWith('CONV')) return 'Packaging Cell';
    if (code.startsWith('PUMP') || code.startsWith('MIXER') || code.startsWith('PRESS')) return 'Processing Cell';
    if (code.startsWith('ASMB') || code.startsWith('BENCH')) return 'Assembly Cell';
    return 'Production Zone A';
  };

  // Helper for current pipeline stage
  const getStageInfo = (status: string) => {
    if (status === 'RESOLVED' || status === 'CLOSED') {
      return { stage: 'Resolution Verified', health: '99%', downtime: '1h 14m', stepIndex: 5, color: 'emerald' };
    }
    if (status === 'VERIFYING') {
      return { stage: 'Health Verification', health: '91%', downtime: '1h 32m', stepIndex: 4, color: 'purple' };
    }
    if (status === 'IN_PROGRESS' || status === 'INSPECTING') {
      return { stage: 'Inspection & Repair', health: '42%', downtime: '2h 16m', stepIndex: 3, color: 'amber' };
    }
    if (status === 'ASSIGNED') {
      return { stage: 'Technician Assigned', health: '45%', downtime: '3h 05m', stepIndex: 2, color: 'blue' };
    }
    return { stage: 'AI Diagnosis Active', health: '40%', downtime: '48m', stepIndex: 1, color: 'rose' };
  };

  return (
    <div className="space-y-5 max-w-[1520px] mx-auto">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. TOP 5 EXECUTIVE & OPERATIONAL KPI METRIC CARDS */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        {/* Metric 1: Active Incidents */}
        <div className="bg-white p-4 rounded-2xl border border-[#DDD9D0] shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Active Incidents</div>
            <div className="text-2xl font-extrabold text-[#1E293B] font-mono mt-0.5">{totalIncidents}</div>
            <div className="text-[10px] text-rose-600 font-bold mt-0.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              {criticalCount} Critical &bull; {warningCount} Warning
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center">
            <AlertTriangle size={20} />
          </div>
        </div>

        {/* Metric 2: Resolved Today */}
        <div className="bg-white p-4 rounded-2xl border border-[#DDD9D0] shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Resolved Today</div>
            <div className="text-2xl font-extrabold text-[#1E293B] font-mono mt-0.5">{resolvedCount || 8}</div>
            <div className="text-[10px] text-emerald-600 font-bold mt-0.5 flex items-center gap-1">
              <TrendingUp size={12} />
              +33% vs yesterday
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
            <CheckCircle2 size={20} />
          </div>
        </div>

        {/* Metric 3: Mean Time to Resolution */}
        <div className="bg-white p-4 rounded-2xl border border-[#DDD9D0] shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Mean Time to Resolution</div>
            <div className="text-2xl font-extrabold text-[#2563EB] font-mono mt-0.5">28.4 min</div>
            <div className="text-[10px] text-emerald-600 font-bold mt-0.5 flex items-center gap-1">
              <TrendingDown size={12} />
              -42% vs industry
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-[#2563EB] border border-blue-100 flex items-center justify-center">
            <Timer size={20} />
          </div>
        </div>

        {/* Metric 4: Autonomous Resolution */}
        <div className="bg-white p-4 rounded-2xl border border-[#DDD9D0] shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Autonomous Resolution</div>
            <div className="text-2xl font-extrabold text-purple-600 font-mono mt-0.5">{autonomousRate}%</div>
            <div className="text-[10px] text-purple-700 font-bold mt-0.5 flex items-center gap-1">
              <Sparkles size={11} />
              AI Orchestrator Success
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center">
            <Target size={20} />
          </div>
        </div>

        {/* Metric 5: Policy Auto-Procurement */}
        <div className="bg-white p-4 rounded-2xl border border-[#DDD9D0] shadow-xs flex items-center justify-between col-span-2 md:col-span-1">
          <div>
            <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Policy Procurement</div>
            <div className="text-2xl font-extrabold text-amber-700 font-mono mt-0.5">100%</div>
            <div className="text-[10px] text-amber-700 font-bold mt-0.5">POL-01 Compliance</div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center">
            <ShoppingCart size={20} />
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. ADVANCED SEARCH & FILTER CONTROL BAR */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
            <input
              type="text"
              placeholder="Search incidents, machines, work orders, parts, or root cause..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 bg-white border border-[#DDD9D0] rounded-xl text-xs text-[#1E293B] font-medium placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] shadow-xs"
            />
          </div>

          {/* Severity Badges Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-[#64748B]">Severity:</span>
            <div className="flex bg-[#EAE7E0] p-1 rounded-xl border border-[#DDD9D0]">
              <button
                onClick={() => setSelectedSeverity('ALL')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  selectedSeverity === 'ALL' ? 'bg-[#2563EB] text-white shadow-sm' : 'text-[#64748B] hover:text-[#1E293B]'
                }`}
              >
                All <span className="font-mono text-[10px] opacity-80">{totalIncidents}</span>
              </button>
              <button
                onClick={() => setSelectedSeverity('CRITICAL')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  selectedSeverity === 'CRITICAL' ? 'bg-rose-600 text-white shadow-sm' : 'text-rose-700 hover:text-rose-800'
                }`}
              >
                Critical <span className="font-mono text-[10px] opacity-80">{criticalCount}</span>
              </button>
              <button
                onClick={() => setSelectedSeverity('WARNING')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  selectedSeverity === 'WARNING' ? 'bg-amber-600 text-white shadow-sm' : 'text-amber-700 hover:text-amber-800'
                }`}
              >
                Warning <span className="font-mono text-[10px] opacity-80">{warningCount}</span>
              </button>
              <button
                onClick={() => setSelectedSeverity('LOW')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  selectedSeverity === 'LOW' ? 'bg-[#2563EB] text-white shadow-sm' : 'text-[#64748B] hover:text-[#1E293B]'
                }`}
              >
                Low <span className="font-mono text-[10px] opacity-80">{lowCount}</span>
              </button>
            </div>
          </div>

          {/* Plant Cell Filter */}
          <div className="flex items-center gap-2">
            <CustomSelect
              prefix="Plant Cell:"
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

          {/* Time Range Dropdown */}
          <div className="flex items-center gap-2">
            <CustomSelect
              prefix="Time:"
              value={timeRange}
              onChange={(val) => setTimeRange(val)}
              options={[
                { value: '24h', label: 'Last 24 Hours' },
                { value: '7d', label: 'Last 7 Days' },
                { value: '30d', label: 'Last 30 Days' },
              ]}
              size="sm"
            />
          </div>
        </div>

        {/* Status Filter Strip */}
        <div className="flex items-center gap-2 pt-2 border-t border-[#DDD9D0]/60 overflow-x-auto no-scrollbar">
          <span className="text-xs font-bold text-[#64748B] shrink-0">Status:</span>
          {(
            [
              { id: 'ALL', label: 'All', count: totalIncidents },
              { id: 'DETECTED', label: 'Detected', count: detectedCount },
              { id: 'ASSIGNED', label: 'Assigned', count: assignedCount },
              { id: 'INSPECTING', label: 'Inspecting', count: inspectingCount },
              { id: 'VERIFYING', label: 'Verifying', count: verifyingCount },
              { id: 'RESOLVED', label: 'Resolved', count: resolvedCount }
            ] as const
          ).map((st) => (
            <button
              key={st.id}
              onClick={() => setSelectedStatus(st.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                selectedStatus === st.id
                  ? 'bg-[#2563EB] text-white shadow-xs'
                  : 'bg-white hover:bg-[#EAE7E0] text-[#64748B] border border-[#DDD9D0]'
              }`}
            >
              <span>{st.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                selectedStatus === st.id ? 'bg-white/20 text-white' : 'bg-[#EAE7E0] text-[#1E293B]'
              }`}>
                {st.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. MASTER-DETAIL SPLIT VIEW (LEFT LIST + RIGHT DETAIL PANEL) */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ── LEFT COLUMN: INCIDENT CARDS LIST (WITHOUT MACHINE IMAGE) ── */}
        <div className={`${activeIncident ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-3.5`}>
          {/* List Controls Header */}
          <div className="flex items-center justify-between bg-white p-3.5 rounded-2xl border border-[#DDD9D0] shadow-xs">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#1E293B] flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#2563EB]" />
                Incident Timeline
              </h3>
              <span className="text-xs font-semibold text-[#64748B]">({filteredIncidents.length} incidents)</span>
            </div>

            <div className="flex items-center gap-2.5">
              <CustomSelect
                prefix="Sort by:"
                value={sortBy}
                onChange={(val) => setSortBy(val as any)}
                options={[
                  { value: 'latest', label: 'Latest First' },
                  { value: 'severity', label: 'Highest Severity' },
                  { value: 'health', label: 'Lowest Health' },
                ]}
                size="xs"
                align="right"
              />

              <div className="flex bg-[#EAE7E0] p-0.5 rounded-lg border border-[#DDD9D0]">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white text-[#2563EB] shadow-xs' : 'text-[#64748B]'}`}
                  title="List View"
                >
                  <LayoutList size={13} />
                </button>
                <button
                  onClick={() => setViewMode('timeline')}
                  className={`p-1.5 rounded-md transition-colors ${viewMode === 'timeline' ? 'bg-white text-[#2563EB] shadow-xs' : 'text-[#64748B]'}`}
                  title="Timeline View"
                >
                  <GitCommit size={13} />
                </button>
              </div>
            </div>
          </div>

          {/* Incident Cards / Timeline View Container with Scrollbar */}
          {filteredIncidents.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-[#DDD9D0] shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto mb-2.5">
                <CheckCircle2 size={24} />
              </div>
              <h4 className="text-sm font-bold text-[#1E293B]">No Incidents Found</h4>
              <p className="text-xs text-[#64748B] mt-0.5">No incidents match the active search and filter criteria.</p>
            </div>
          ) : viewMode === 'list' ? (
            <div className="space-y-3 h-[600px] xl:h-[660px] 2xl:h-[720px] overflow-y-auto pr-2 pb-2">
              {paginatedIncidents.map((inc) => {
                const isSelected = selectedIncidentId === inc.id;
                const mCode = inc.machine_code || inc.machine_id;
                const cellName = getCellName(mCode);
                const stage = getStageInfo(inc.status);
                const isResolved = inc.status === 'RESOLVED' || inc.status === 'CLOSED';
                const isVerifying = inc.status === 'VERIFYING';

                return (
                  <div
                    key={inc.id}
                    onClick={() => setSelectedIncidentId(inc.id)}
                    className={`bg-white rounded-2xl p-4 border transition-all cursor-pointer shadow-xs hover:shadow-md ${
                      isSelected 
                        ? 'border-[#2563EB] ring-2 ring-[#2563EB]/15 bg-blue-50/10' 
                        : 'border-[#DDD9D0] hover:border-[#2563EB]/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* Left: Asset Glyph Box (Replaces Machine Image) */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-bold text-center shrink-0 border ${
                          inc.severity === 'CRITICAL'
                            ? 'bg-rose-50 border-rose-200 text-rose-700'
                            : isVerifying
                            ? 'bg-purple-50 border-purple-200 text-purple-700'
                            : isResolved
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : 'bg-amber-50 border-amber-200 text-amber-700'
                        }`}>
                          <Cpu size={16} />
                          <span className="text-[10px] font-mono mt-0.5">{mCode}</span>
                        </div>

                        {/* Title, Severity & Subsystems */}
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase border ${
                              inc.severity === 'CRITICAL'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : isVerifying
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : isResolved
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}>
                              {inc.severity || 'CRITICAL'}
                            </span>
                            <span className="text-xs font-mono font-bold text-[#2563EB]">{inc.id}</span>
                          </div>

                          <h4 className="text-sm font-bold text-[#1E293B] truncate" title={inc.alert_type}>
                            {inc.alert_type?.replace(/_/g, ' ') || 'High Vibration Anomaly (8.6 mm/s)'}
                          </h4>

                          <div className="text-xs text-[#64748B] flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-[#1E293B]">{mCode}</span>
                            <span>&bull;</span>
                            <span>{cellName}</span>
                          </div>

                          {/* Subsystem Tags */}
                          <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                            <span className="text-[10px] font-semibold bg-[#FAF9F6] text-[#64748B] border border-[#DDD9D0] px-2 py-0.5 rounded-md">
                              Vibration
                            </span>
                            <span className="text-[10px] font-semibold bg-[#FAF9F6] text-[#64748B] border border-[#DDD9D0] px-2 py-0.5 rounded-md">
                              Spindle
                            </span>
                            {inc.part_number && (
                              <span className="text-[10px] font-mono font-semibold bg-blue-50 text-[#2563EB] border border-blue-200 px-2 py-0.5 rounded-md">
                                {inc.part_number}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Timestamp & Status Pill */}
                      <div className="text-right shrink-0 space-y-1.5">
                        <div className="text-[11px] text-[#64748B] font-mono">
                          {new Date(inc.detected_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                        </div>
                        <span className={`inline-block text-[10px] font-extrabold px-2.5 py-1 rounded-lg uppercase border shadow-2xs ${
                          isResolved
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : isVerifying
                            ? 'bg-purple-50 text-purple-700 border-purple-200 animate-pulse'
                            : inc.status === 'IN_PROGRESS' || inc.status === 'INSPECTING'
                            ? 'bg-blue-600 text-white border-blue-700'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}>
                          {inc.status}
                        </span>
                      </div>
                    </div>

                    {/* 5-Step Horizontal Closed Loop Pipeline Progress */}
                    <div className="mt-3 pt-3 border-t border-[#DDD9D0] flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-2 flex-1 overflow-x-auto no-scrollbar py-0.5">
                        {[
                          { key: 'alarm', label: 'Alarm' },
                          { key: 'ai', label: 'AI Diagnosis' },
                          { key: 'inspect', label: 'Inspection' },
                          { key: 'repair', label: 'Repair' },
                          { key: 'verify', label: 'Verify' }
                        ].map((s, idx) => {
                          const isDone = stage.stepIndex > idx + 1 || isResolved;
                          const isCurrent = stage.stepIndex === idx + 1 && !isResolved;
                          return (
                            <React.Fragment key={s.key}>
                              <div className="flex items-center gap-1 shrink-0">
                                <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold ${
                                  isDone 
                                    ? 'bg-emerald-500 text-white' 
                                    : isCurrent 
                                    ? 'bg-[#2563EB] text-white animate-pulse' 
                                    : 'bg-[#DDD9D0] text-[#64748B]'
                                }`}>
                                  {isDone ? '✓' : idx + 1}
                                </span>
                                <span className={`text-[10px] font-semibold ${isCurrent ? 'text-[#2563EB] font-bold' : 'text-[#64748B]'}`}>
                                  {s.label}
                                </span>
                              </div>
                              {idx < 4 && <div className="w-3 h-0.5 bg-[#DDD9D0] shrink-0" />}
                            </React.Fragment>
                          );
                        })}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] shrink-0 font-medium text-[#64748B] pl-2 border-l border-[#DDD9D0]">
                        <span>Health: <strong className="text-[#1E293B] font-mono">{stage.health}</strong></span>
                        <span>Downtime: <strong className="text-[#1E293B] font-mono">{stage.downtime}</strong></span>
                        <ChevronRight size={14} className="text-[#64748B]" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Timeline Chronological Flow View with Scrollbar */
            <div className="space-y-4 h-[600px] xl:h-[660px] 2xl:h-[720px] overflow-y-auto pr-2 pb-2 relative before:absolute before:top-4 before:bottom-4 before:left-6 before:w-0.5 before:bg-[#DDD9D0]">
              {paginatedIncidents.map((inc) => {
                const isSelected = selectedIncidentId === inc.id;
                const mCode = inc.machine_code || inc.machine_id;
                const isResolved = inc.status === 'RESOLVED' || inc.status === 'CLOSED';

                return (
                  <div
                    key={inc.id}
                    onClick={() => setSelectedIncidentId(inc.id)}
                    className={`relative pl-12 cursor-pointer group`}
                  >
                    {/* Node Dot */}
                    <div className={`absolute left-4.5 top-3.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-xs z-10 transition-transform group-hover:scale-125 ${
                      inc.severity === 'CRITICAL'
                        ? 'bg-rose-500'
                        : isResolved
                        ? 'bg-emerald-500'
                        : 'bg-amber-500'
                    }`} />

                    <div className={`p-3.5 rounded-2xl bg-white border transition-all ${
                      isSelected
                        ? 'border-[#2563EB] ring-2 ring-[#2563EB]/15 bg-blue-50/10'
                        : 'border-[#DDD9D0] hover:border-[#2563EB]/50'
                    }`}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#2563EB]">{inc.id}</span>
                          <span className="font-bold text-[#1E293B]">{mCode}</span>
                        </div>
                        <span className="text-[10px] font-mono text-[#64748B]">
                          {new Date(inc.detected_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-[#1E293B]">
                        {inc.alert_type?.replace(/_/g, ' ')}
                      </div>
                      <div className="text-[11px] text-[#64748B] mt-0.5">
                        Status: <strong className="text-[#1E293B]">{inc.status}</strong> &bull; Severity: <strong className="text-[#1E293B]">{inc.severity || 'CRITICAL'}</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls Bar */}
          {totalPages > 1 && (
            <div className="bg-white border border-[#DDD9D0] rounded-2xl p-3 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
              <div className="text-xs text-[#64748B] flex items-center gap-2">
                <span>
                  Showing <strong className="text-[#1E293B]">{(currentPage - 1) * itemsPerPage + 1}</strong> to <strong className="text-[#1E293B]">{Math.min(currentPage * itemsPerPage, filteredIncidents.length)}</strong> of <strong className="text-[#1E293B]">{filteredIncidents.length}</strong> incidents
                </span>
                <span className="px-2 py-0.5 rounded-md bg-[#FAF9F6] border border-[#DDD9D0] text-[10px] font-bold text-[#64748B]">
                  15 per page
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2 py-1 rounded-lg border border-[#DDD9D0] bg-white hover:bg-[#FAF9F6] text-xs font-bold text-[#1E293B] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-all shadow-xs"
                >
                  <ChevronLeft size={13} />
                  <span>Prev</span>
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
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
                  className="px-2 py-1 rounded-lg border border-[#DDD9D0] bg-white hover:bg-[#FAF9F6] text-xs font-bold text-[#1E293B] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-all shadow-xs"
                >
                  <span>Next</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN: SELECTED INCIDENT DEEP AUDIT & WORKSTATION PANEL ── */}
        {activeIncident && (
          <div className="lg:col-span-5 bg-white rounded-2xl border border-[#DDD9D0] shadow-sm sticky top-6 overflow-hidden space-y-0 h-[720px] xl:h-[780px] 2xl:h-[840px] flex flex-col justify-between">
            {/* Top Fixed Header & Meta */}
            <div className="shrink-0">
              {/* Header */}
              <div className="p-4 bg-[#FAF9F6] border-b border-[#DDD9D0] flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-extrabold text-sm text-[#2563EB]">{activeIncident.id}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase border ${
                    activeIncident.severity === 'CRITICAL'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}>
                    {activeIncident.severity || 'CRITICAL'}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-[#2563EB] border border-blue-200">
                    {activeIncident.status}
                  </span>
                </div>

                <button
                  onClick={() => setSelectedIncidentId(null)}
                  className="p-1.5 rounded-lg hover:bg-[#EAE7E0] text-[#64748B] transition-colors"
                  title="Close panel"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Title & Asset Metadata Bar (Without Machine Image) */}
              <div className="p-4 border-b border-[#DDD9D0] space-y-2">
                <h3 className="text-sm font-bold text-[#1E293B]">
                  {activeIncident.alert_type?.replace(/_/g, ' ') || 'High Vibration Anomaly (8.6 mm/s)'}
                </h3>

                <div className="bg-[#FAF9F6] p-3 rounded-xl border border-[#DDD9D0] grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-[10px] text-[#64748B] font-bold uppercase">Asset & Cell</div>
                    <div className="font-bold text-[#1E293B] flex items-center gap-1 mt-0.5">
                      <span className="font-mono text-[#2563EB]">{activeIncident.machine_code || activeIncident.machine_id}</span>
                      <span>&bull;</span>
                      <span className="truncate">{getCellName(activeIncident.machine_code || activeIncident.machine_id)}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#64748B] font-bold uppercase">Detection & Downtime</div>
                    <div className="font-mono text-[#1E293B] font-semibold text-[11px] mt-0.5">
                      {new Date(activeIncident.detected_at).toLocaleTimeString()} &bull; 2h 16m
                    </div>
                  </div>
                </div>
              </div>

              {/* Sub-Tabs: [Timeline] [AI Diagnosis] [Work Order] [Parts & Procurement] [Verification] */}
              <div className="flex bg-[#EAE7E0] p-1 border-b border-[#DDD9D0] overflow-x-auto no-scrollbar">
                {(
                  [
                    { id: 'timeline', label: 'Timeline' },
                    { id: 'ai', label: 'AI Diagnosis' },
                    { id: 'workorder', label: 'Work Order' },
                    { id: 'procurement', label: 'Parts & Procurement' },
                    { id: 'verification', label: 'Verification' }
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSubTab(tab.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                      activeSubTab === tab.id
                        ? 'bg-white text-[#2563EB] shadow-xs'
                        : 'text-[#64748B] hover:text-[#1E293B]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sub-Tab 1: Vertical Chronological 8-Step Timeline */}
            {activeSubTab === 'timeline' && (
              <div className="p-4 space-y-3.5 flex-1 overflow-y-auto pr-2">
                {[
                  {
                    time: '10:42:13 AM',
                    title: '1. Alarm Detected',
                    desc: 'Vibration spike 8.6 mm/s (ISO 10816-3 Threshold: 7.5 mm/s)',
                    status: 'CRITICAL',
                    icon: AlertTriangle,
                    color: 'text-rose-600 bg-rose-50 border-rose-200'
                  },
                  {
                    time: '10:42:15 AM',
                    title: '2. AI Orchestrator Triggered',
                    desc: 'Vector RAG analysis & SOP match 98% (Bearing Fluting)',
                    status: 'COMPLETED',
                    icon: Bot,
                    color: 'text-[#2563EB] bg-blue-50 border-blue-200'
                  },
                  {
                    time: '10:42:18 AM',
                    title: '3. Technician Assigned',
                    desc: 'Arun Kumar (Lead Vibration & Spindle Specialist)',
                    status: 'COMPLETED',
                    icon: Wrench,
                    color: 'text-emerald-600 bg-emerald-50 border-emerald-200'
                  },
                  {
                    time: '10:47:02 AM',
                    title: '4. OSHA LOTO Protocol Started',
                    desc: 'Zero energy isolation confirmed (0.0 V / 0.0 bar)',
                    status: 'COMPLETED',
                    icon: Lock,
                    color: 'text-[#2563EB] bg-blue-50 border-blue-200'
                  },
                  {
                    time: '10:52:40 AM',
                    title: '5. Physical Inspection',
                    desc: 'Technician physical inspection & cage play check',
                    status: 'IN PROGRESS',
                    icon: Activity,
                    color: 'text-amber-600 bg-amber-50 border-amber-200'
                  },
                  {
                    time: '11:08:21 AM',
                    title: '6. Component Repair Started',
                    desc: `Installing OEM part: ${activeIncident.part_number || 'SKF-6205-2RSH'}`,
                    status: 'PENDING',
                    icon: Package,
                    color: 'text-[#64748B] bg-[#FAF9F6] border-[#DDD9D0]'
                  },
                  {
                    time: '11:24:09 AM',
                    title: '7. Health Verification',
                    desc: '3-cycle continuous sensor telemetry observation',
                    status: 'PENDING',
                    icon: CheckCircle2,
                    color: 'text-[#64748B] bg-[#FAF9F6] border-[#DDD9D0]'
                  },
                  {
                    time: '---',
                    title: '8. Machine Return to Service',
                    desc: 'Machine status verified nominal (99% Health)',
                    status: 'PENDING',
                    icon: ShieldCheck,
                    color: 'text-[#64748B] bg-[#FAF9F6] border-[#DDD9D0]'
                  }
                ].map((step, idx) => {
                  const StepIcon = step.icon;
                  return (
                    <div key={idx} className="flex items-start gap-3 text-xs">
                      <div className="text-[10px] font-mono text-[#64748B] w-16 text-right pt-0.5 shrink-0">
                        {step.time}
                      </div>

                      <div className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 ${step.color}`}>
                        <StepIcon size={12} />
                      </div>

                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-[#1E293B]">{step.title}</span>
                          <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded border ${
                            step.status === 'CRITICAL'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : step.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : step.status === 'IN PROGRESS'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-[#FAF9F6] text-[#64748B] border-[#DDD9D0]'
                          }`}>
                            {step.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#64748B] leading-tight">{step.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Sub-Tab 2: AI Diagnosis Details */}
            {activeSubTab === 'ai' && (
              <div className="p-4 space-y-3 flex-1 overflow-y-auto pr-2 text-xs">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1">
                  <div className="flex items-center justify-between font-bold text-[#2563EB]">
                    <span className="flex items-center gap-1.5"><Bot size={13} /> RAG Vector Match</span>
                    <span className="font-mono">98.4% Confidence</span>
                  </div>
                  <div className="text-xs font-bold text-[#1E293B]">SOP-CNC-MNT-04: Bearing Fluting &amp; Replacement</div>
                  <p className="text-[11px] text-[#64748B]">FFT spectral analysis confirmed 120 Hz outer race harmonic frequency spike.</p>
                </div>

                <div className="p-3 bg-[#FAF9F6] border border-[#DDD9D0] rounded-xl space-y-1">
                  <div className="font-bold text-[#1E293B]">Suspected / Affected Subsystem:</div>
                  <div className="text-[11px] text-[#64748B]">Spindle Drive Motor &bull; Front Angular Contact Bearing Assembly</div>
                </div>
              </div>
            )}

            {/* Sub-Tab 3: Work Order */}
            {activeSubTab === 'workorder' && (
              <div className="p-4 space-y-3 flex-1 overflow-y-auto pr-2 text-xs">
                <div className="p-3 bg-[#FAF9F6] border border-[#DDD9D0] rounded-xl space-y-1.5">
                  <div className="text-[10px] text-[#64748B] uppercase font-bold">Assigned Specialist</div>
                  <div className="font-bold text-[#1E293B]">Arun Kumar (Lead Vibration Tech)</div>
                  <div className="text-[11px] text-[#2563EB]">Cluster: CNC-01, CNC-05</div>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                  <div className="font-bold text-emerald-800 flex items-center gap-1.5">
                    <ShieldCheck size={14} /> OSHA 1910.147 LOTO State
                  </div>
                  <div className="text-[11px] text-emerald-900">Padlock ID: PL-8894-LOTO &bull; Residual Voltage: 0.0V</div>
                </div>
              </div>
            )}

            {/* Sub-Tab 4: Parts & Procurement */}
            {activeSubTab === 'procurement' && (
              <div className="p-4 space-y-3 flex-1 overflow-y-auto pr-2 text-xs">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                  <div className="flex items-center justify-between font-bold text-amber-900">
                    <span>Policy POL-01 Auto-PO</span>
                    <span className="font-mono">PO-8821</span>
                  </div>
                  <div className="font-bold text-[#1E293B] font-mono">{activeIncident.part_number || 'SKF-6205-2RSH'}</div>
                  <div className="text-[11px] text-amber-800">Unit Cost: $45.00 &bull; Supplier: Motion Industries</div>
                </div>

                <div className="p-3 bg-[#FAF9F6] border border-[#DDD9D0] rounded-xl space-y-1">
                  <div className="text-[10px] text-[#64748B] uppercase font-bold">Warehouse Bin Location</div>
                  <div className="font-bold text-[#1E293B]">Central Spares WH-01 &bull; Bin BAY-A-04</div>
                  <div className="text-[11px] text-emerald-700 font-semibold">Available to Promise: 7 Units Reserved</div>
                </div>
              </div>
            )}

            {/* Sub-Tab 5: Verification */}
            {activeSubTab === 'verification' && (
              <div className="p-4 space-y-3 flex-1 overflow-y-auto pr-2 text-xs">
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl space-y-1.5">
                  <div className="font-bold text-purple-900 flex items-center gap-1.5">
                    <Activity size={14} className="text-purple-600" /> 3-Cycle Baseline Telemetry
                  </div>
                  <p className="text-[11px] text-purple-900 leading-tight">
                    Post-repair sensors are streaming 100 Hz vibration telemetry to ensure baseline &lt; 2.5 mm/s before clearing LOTO.
                  </p>
                  <div className="text-[10px] font-mono font-bold bg-white p-2 rounded border border-purple-200 flex justify-between">
                    <span>Target RMS: &lt; 2.5 mm/s</span>
                    <span>Current RMS: 1.84 mm/s</span>
                    <span className="text-emerald-700 font-bold">PASSING</span>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Actions Bar */}
            <div className="p-4 bg-[#FAF9F6] border-t border-[#DDD9D0] flex items-center justify-between gap-2 shrink-0">
              <button
                onClick={() => {
                  onSelectMachine(activeIncident.machine_code || activeIncident.machine_id);
                  onNavigateTab?.('twin');
                }}
                className="flex-1 py-2 px-3 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5"
              >
                <Activity size={13} />
                <span>Open Digital Twin</span>
              </button>

              <button
                onClick={() => onNavigateTab?.('work-orders')}
                className="py-2 px-3 bg-white hover:bg-[#EAE7E0] border border-[#DDD9D0] text-[#1E293B] rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <Wrench size={13} className="text-[#2563EB]" />
                <span>Work Order</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
