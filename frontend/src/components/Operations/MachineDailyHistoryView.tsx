import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  ShieldCheck,
  Bot,
  Package,
  Activity,
  Cpu,
  Layers,
  ArrowRight,
  RefreshCw,
  Search,
  Filter,
  X,
  ExternalLink,
  Flame,
  Check,
  Zap,
  TrendingDown,
  TrendingUp,
  Sliders,
  BarChart3,
  ChevronDown,
  Info,
  SlidersHorizontal,
  Sparkles
} from 'lucide-react';
import {
  MachineDailySummary,
  MachineTimelineSegment,
  MachineDayEvent,
  MonthlyCalendarDay,
  DailyDataSource
} from '../../types';
import { api, socket } from '../../services/api';
import { ToastMessage } from '../ToastNotification';

interface MachineDailyHistoryViewProps {
  onAddToast?: (toast: Omit<ToastMessage, 'id' | 'timestamp'> & { timestamp?: string }) => void;
  onNavigateTab?: (tab: string) => void;
  onSelectMachine?: (code: string) => void;
}

interface HoveredTooltipInfo {
  machineCode: string;
  label: string;
  timeRange: string;
  status: string;
  color: string;
  details: string;
  outputInfo?: string;
  x: number;
  y: number;
}

// ─── IST business-day helpers ─────────────────────────────────────────────────
const IST_OFFSET_MS = 330 * 60 * 1000;
const istToday = () => new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
const shiftDate = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const formatHour = (h: number) => {
  const total = Math.round(h * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};
const formatShortDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

const SEGMENT_STYLE: Record<string, { bar: string; dot: string; name: string }> = {
  RUNNING: { bar: 'bg-emerald-500 hover:bg-emerald-600', dot: 'bg-emerald-500', name: 'Running' },
  WARNING: { bar: 'bg-amber-400 hover:bg-amber-500', dot: 'bg-amber-400', name: 'Warning' },
  FAULT: { bar: 'bg-red-500 hover:bg-red-600', dot: 'bg-red-500', name: 'Fault downtime' },
  ESTOP: { bar: 'bg-orange-600 hover:bg-orange-700', dot: 'bg-orange-600', name: 'E-Stop downtime' },
  MAINTENANCE: { bar: 'bg-blue-500 hover:bg-blue-600', dot: 'bg-blue-500', name: 'LOTO / repair' },
  VERIFYING: { bar: 'bg-purple-500 hover:bg-purple-600', dot: 'bg-purple-500', name: 'Verification' },
  IDLE: { bar: 'bg-slate-400 hover:bg-slate-500', dot: 'bg-slate-400', name: 'Idle (plant de-energized)' },
  OFF: { bar: 'bg-slate-200 hover:bg-slate-300', dot: 'bg-slate-300', name: 'Outside shift' },
  NO_DATA: {
    bar: 'bg-[repeating-linear-gradient(45deg,#e2e8f0_0,#e2e8f0_4px,#f8fafc_4px,#f8fafc_8px)]',
    dot: 'bg-slate-200',
    name: 'No telemetry recorded'
  },
};

const EMPTY_PLANT_SUMMARY = {
  totalRuntimeSeconds: 0,
  totalDowntimeSeconds: 0,
  totalProductionPieces: 0,
  totalTargetPieces: 0,
  totalMissedPieces: 0,
  plantAvailabilityPct: 0,
  activeFaultsCount: 0,
  totalMachines: 0
};

const SOURCE_BADGE: Record<DailyDataSource, { label: string; className: string; title: string }> = {
  LIVE: {
    label: 'LIVE',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    title: 'Built from the plant power ledger and incident records, up to the current time.'
  },
  RECORDED: {
    label: 'RECORDED',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
    title: 'Built from the recorded plant power ledger and incident records.'
  },
  DB_SUMMARY: {
    label: 'DB SUMMARY',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
    title: 'Read from persisted machine_daily_summary rows.'
  },
  SIMULATED: {
    label: 'SIMULATED HISTORY',
    className: 'bg-amber-50 text-amber-800 border-amber-200',
    title: 'Demo history for a day before power-ledger recording started. Not real telemetry.'
  },
};

export const MachineDailyHistoryView: React.FC<MachineDailyHistoryViewProps> = ({
  onAddToast,
  onNavigateTab,
  onSelectMachine
}) => {
  const [selectedDate, setSelectedDate] = useState(istToday);
  const [today, setToday] = useState(istToday);
  const currentYear = Number(selectedDate.slice(0, 4));
  const currentMonth = Number(selectedDate.slice(5, 7));
  const isViewingToday = selectedDate === today;

  const [monthlyDays, setMonthlyDays] = useState<MonthlyCalendarDay[]>([]);
  const [dailyMachines, setDailyMachines] = useState<MachineDailySummary[]>([]);
  const [dataSource, setDataSource] = useState<DailyDataSource | null>(null);
  const [plantSummary, setPlantSummary] = useState(EMPTY_PLANT_SUMMARY);

  const [selectedMachineCode, setSelectedMachineCode] = useState<string>('CNC-05');
  const [selectedTimelineCell, setSelectedTimelineCell] = useState<string>('Machining');
  const [selectedMachineDetail, setSelectedMachineDetail] = useState<{
    summary: MachineDailySummary | null;
    timelineSegments: MachineTimelineSegment[];
    events: MachineDayEvent[];
  }>({
    summary: null,
    timelineSegments: [],
    events: []
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const [replayStep, setReplayStep] = useState(0);

  // Interactive Hover Tooltip State
  const [hoveredTooltip, setHoveredTooltip] = useState<HoveredTooltipInfo | null>(null);

  // Current IST hour (0–24) — server-provided when viewing today, used for the "now" cursor
  const [nowHour, setNowHour] = useState<number | null>(null);

  const [isEStopActive, setIsEStopActive] = useState(false);

  // Ignore responses for a date the user has already navigated away from
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;

  // 1. Fetch Daily Operations Summary
  const fetchDailyData = async (dateStr: string) => {
    try {
      const res = await api.getDailyProduction(dateStr);
      if (dateStr !== selectedDateRef.current) return;
      if (res && res.success && res.data) {
        setDailyMachines(res.data.machines);
        // Merge over zero defaults so a missing field (e.g. an older backend) can't crash the render
        const incoming = res.data.plantSummary || {};
        setPlantSummary(
          Object.fromEntries(
            Object.entries(EMPTY_PLANT_SUMMARY).map(([k, v]) => [k, Number.isFinite(incoming[k]) ? incoming[k] : v])
          ) as typeof EMPTY_PLANT_SUMMARY
        );
        setDataSource(res.data.source ?? null);
        setNowHour(typeof res.data.nowHour === 'number' ? res.data.nowHour : null);
      }
    } catch (err) {
      console.warn('Daily production data unavailable', err);
    }
  };

  // 2. Fetch Machine Detail & Timeline
  const fetchMachineDetail = async (code: string, dateStr: string) => {
    try {
      const res = await api.getMachineDayDetail(code, dateStr);
      if (dateStr !== selectedDateRef.current) return;
      if (res && res.success && res.data) {
        setSelectedMachineDetail({
          summary: res.data.summary,
          timelineSegments: res.data.timelineSegments,
          events: res.data.events
        });
      }
    } catch (err) {
      console.warn('Machine day detail unavailable', err);
    }
  };

  // 3. Fetch Monthly Calendar Overview
  const fetchMonthlyCalendar = async (year: number, month: number) => {
    try {
      const res = await api.getMonthlyCalendar(year, month);
      if (res && res.success && res.data) {
        setMonthlyDays(res.data.days);
      }
    } catch (err) {
      console.warn('Monthly calendar unavailable', err);
    }
  };

  // Roll "today" over at IST midnight
  useEffect(() => {
    const t = setInterval(() => setToday(istToday()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetchMonthlyCalendar(currentYear, currentMonth);
  }, [currentYear, currentMonth, today]);

  useEffect(() => {
    // Clear the previous day's rows immediately so stale bars never show under a new date
    setDailyMachines([]);
    setDataSource(null);
    setNowHour(null);
    fetchDailyData(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    fetchMachineDetail(selectedMachineCode, selectedDate);
  }, [selectedDate, selectedMachineCode]);

  useEffect(() => {
    api.getPowerStatus().then(r => {
      const st = r?.data?.plant?.status || r?.data?.status;
      setIsEStopActive(st === 'ESTOP');
    }).catch(() => {});

    // Only today changes over time — past days are fixed records
    if (!isViewingToday) return;

    const interval = setInterval(() => {
      fetchDailyData(selectedDate);
    }, 15000);

    const handleRealtimeUpdate = () => {
      fetchDailyData(selectedDate);
      fetchMachineDetail(selectedMachineCode, selectedDate);
    };
    const onStarted = () => { setIsEStopActive(false); handleRealtimeUpdate(); };
    const onStopped = () => { setIsEStopActive(false); handleRealtimeUpdate(); };
    const onEStop = () => { setIsEStopActive(true); handleRealtimeUpdate(); };
    const onStatusChanged = (d: any) => { setIsEStopActive(d?.status === 'ESTOP'); handleRealtimeUpdate(); };

    socket.on('power:started', onStarted);
    socket.on('power:stopped', onStopped);
    socket.on('power:estop', onEStop);
    socket.on('power:status_changed', onStatusChanged);
    socket.on('machine:status_changed', handleRealtimeUpdate);

    return () => {
      clearInterval(interval);
      socket.off('power:started', onStarted);
      socket.off('power:stopped', onStopped);
      socket.off('power:estop', onEStop);
      socket.off('power:status_changed', onStatusChanged);
      socket.off('machine:status_changed', handleRealtimeUpdate);
    };
  }, [selectedDate, selectedMachineCode, isViewingToday]);

  const handleSelectDay = (dayStr: string) => {
    setSelectedDate(dayStr);
    setShowCalendarModal(false);
  };

  const handleReplayDay = () => {
    if (replaying) return;
    setReplaying(true);
    setReplayStep(0);

    const totalEvents = selectedMachineDetail.events.length;
    let step = 0;

    const interval = setInterval(() => {
      step += 1;
      setReplayStep(step);
      if (step >= totalEvents) {
        clearInterval(interval);
        setReplaying(false);
        onAddToast?.({
          type: 'INFO',
          title: 'Day Replay Completed',
          subtitle: `${selectedMachineCode} • ${selectedDate}`,
          message: `Replayed ${totalEvents} logged events in chronological order.`
        });
      }
    }, 1100);
  };

  const formatSeconds = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h}h ${m < 10 ? '0' : ''}${m}m`;
  };

  const timelineMachines = dailyMachines.filter((m) => {
    if (selectedTimelineCell === 'ALL') return true;
    return m.cell_name.toLowerCase().includes(selectedTimelineCell.toLowerCase());
  });

  const filteredMachinesTable = dailyMachines.filter((m) => {
    const matchesSearch = !searchQuery || 
      m.machine_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.machine_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.cell_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Helper to handle segment hover tooltip
  const handleSegmentHover = (
    e: React.MouseEvent,
    machineCode: string,
    label: string,
    timeRange: string,
    status: string,
    color: string,
    details: string,
    outputInfo?: string
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredTooltip({
      machineCode,
      label,
      timeRange,
      status,
      color,
      details,
      outputInfo,
      x: rect.left + rect.width / 2,
      y: rect.top - 8
    });
  };

  return (
    <div className="space-y-4 w-full pb-12 relative">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. TOP HEADER & DATE PICKER STRIP                             */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="bg-[#FAF9F6] p-3.5 rounded-xl border border-[#DDD9D0] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3.5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
            <CalendarIcon size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm font-black text-[#1E293B]">
                Machine Daily Operations History
              </h1>
              <span className="text-[10px] font-mono font-extrabold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md">
                {selectedDate}
              </span>
              {dataSource && (
                <span
                  title={SOURCE_BADGE[dataSource].title}
                  className={`text-[10px] font-bold border px-2 py-0.5 rounded-md ${SOURCE_BADGE[dataSource].className}`}
                >
                  {SOURCE_BADGE[dataSource].label}
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#64748B] font-medium mt-0.5">
              Select any date to inspect 24-hour machine timelines, production counts, fault events, and technician audit trails.
            </p>
          </div>
        </div>

        {/* Date Selector & Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}
            className="p-1.5 rounded-lg bg-white hover:bg-slate-100 border border-[#DDD9D0] text-slate-700 shadow-xs cursor-pointer"
            title="Previous Day"
          >
            <ChevronLeft size={13} />
          </button>

          <button
            onClick={() => setShowCalendarModal(!showCalendarModal)}
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-[#DDD9D0] text-xs font-bold text-[#1E293B] shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <CalendarIcon size={13} className="text-blue-600" />
            <span>{selectedDate}</span>
          </button>

          <button
            onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}
            disabled={selectedDate >= today}
            className="p-1.5 rounded-lg bg-white hover:bg-slate-100 border border-[#DDD9D0] text-slate-700 shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Next Day"
          >
            <ChevronRight size={13} />
          </button>

          <button
            onClick={() => setSelectedDate(today)}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer"
          >
            Today ({formatShortDate(today)})
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. PLANT-WIDE DAILY OPERATIONS KPI SUMMARY (Compact)          */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#FAF9F6] p-3 rounded-xl border border-[#DDD9D0] shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[10px] font-extrabold uppercase text-[#64748B] tracking-wider">Plant Runtime</div>
            <div className="text-lg font-black font-mono text-[#1E293B] mt-0.5">
              {formatSeconds(plantSummary.totalRuntimeSeconds)}
            </div>
            <div className="text-[9px] text-emerald-700 font-bold mt-0.5">
              {plantSummary.plantAvailabilityPct}% Plant Availability
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold shrink-0">
            <Clock size={15} />
          </div>
        </div>

        <div className="bg-[#FAF9F6] p-3 rounded-xl border border-[#DDD9D0] shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[10px] font-extrabold uppercase text-[#64748B] tracking-wider">Daily Production</div>
            <div className="text-lg font-black font-mono text-[#1E293B] mt-0.5">
              {plantSummary.totalProductionPieces.toLocaleString()} pcs
            </div>
            <div className="text-[9px] text-blue-700 font-bold mt-0.5">
              Target: {plantSummary.totalTargetPieces.toLocaleString()} pcs
              {plantSummary.totalTargetPieces > 0 &&
                ` (${Math.round((plantSummary.totalProductionPieces / plantSummary.totalTargetPieces) * 1000) / 10}%)`}
              {isViewingToday && ' so far'}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center font-bold shrink-0">
            <BarChart3 size={15} />
          </div>
        </div>

        <div className="bg-[#FAF9F6] p-3 rounded-xl border border-[#DDD9D0] shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[10px] font-extrabold uppercase text-[#64748B] tracking-wider">Fault Downtime</div>
            <div className="text-lg font-black font-mono text-rose-600 mt-0.5">
              {formatSeconds(plantSummary.totalDowntimeSeconds)}
            </div>
            <div className="text-[9px] text-slate-500 font-semibold mt-0.5">
              {plantSummary.activeFaultsCount} Machine Fault Incidents
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center font-bold shrink-0">
            <AlertTriangle size={15} />
          </div>
        </div>

        <div className="bg-[#FAF9F6] p-3 rounded-xl border border-[#DDD9D0] shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[10px] font-extrabold uppercase text-[#64748B] tracking-wider">Missed Production</div>
            <div className="text-lg font-black font-mono text-amber-800 mt-0.5">
              {plantSummary.totalMissedPieces} pcs
            </div>
            <div className="text-[9px] text-amber-800 font-bold mt-0.5">
              Calculated from SQL downtime
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center font-bold shrink-0">
            <TrendingDown size={15} />
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. INTERACTIVE 24-HOUR GANTT TIMELINE WITH EXACT BOUNDS       */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="bg-[#FAF9F6] p-3.5 rounded-xl border border-[#DDD9D0] shadow-xs space-y-3 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#DDD9D0] pb-2">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            <h3 className="text-xs font-black uppercase text-[#1E293B] tracking-wider">
              24-Hour Machine Operations Timeline (00:00 - 24:00 IST)
            </h3>
          </div>

          {/* Cell Selector Tabs */}
          <div className="flex items-center gap-1 flex-wrap text-xs">
            {[
              { id: 'Machining', label: 'Machining (6 CNCs)' },
              { id: 'Robot', label: 'Robots (4 Units)' },
              { id: 'Processing', label: 'Processing (5)' },
              { id: 'Assembly', label: 'Assembly (4)' },
              { id: 'Packaging', label: 'Packaging (3)' },
              { id: 'Maintenance', label: 'Maintenance (3)' },
              { id: 'ALL', label: 'All 25 Machines' }
            ].map((cell) => (
              <button
                key={cell.id}
                onClick={() => setSelectedTimelineCell(cell.id)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                  selectedTimelineCell === cell.id
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-white hover:bg-slate-100 text-[#64748B] border border-[#DDD9D0]'
                }`}
              >
                {cell.label}
              </button>
            ))}
          </div>
        </div>

        {/* Legend & Shift Information */}
        <div className="flex items-center justify-between text-[10px] font-bold border-b border-slate-100 pb-1.5 flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-500" /> Running</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-amber-400" /> Warning</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-500" /> Fault / Downtime</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-orange-600" /> E-Stop Trip</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-blue-500" /> LOTO / Repair</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-purple-500" /> Verification</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-slate-400" /> Idle (No Power)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-slate-200" /> Outside Shift</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded border border-slate-300 bg-[repeating-linear-gradient(45deg,#e2e8f0_0,#e2e8f0_2px,#f8fafc_2px,#f8fafc_4px)]" /> No Data</span>
          </div>
          <span className="text-slate-400 font-mono text-[9px] flex items-center gap-1">
            {isViewingToday && nowHour !== null ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                Now: {formatHour(nowHour)} IST &bull; Hover segments for details
              </>
            ) : (
              'Hover segments for details'
            )}
          </span>
        </div>

        {/* ── ALIGNED TIMELINE HEADER AXIS (Aligned EXACTLY over the bars) ── */}
        <div className="flex items-center gap-2.5">
          {/* Machine Column Spacer */}
          <div className="w-20 shrink-0 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Machine
          </div>

          {/* Timeline Time Marker Header */}
          <div className="flex-1 relative h-4 border-b border-slate-200">
            {[
              { label: '00:00', pos: 0 },
              { label: '03:00', pos: 12.5 },
              { label: '06:00', pos: 25.0 },
              { label: '09:00', pos: 37.5 },
              { label: '12:00', pos: 50.0 },
              { label: '15:00', pos: 62.5 },
              { label: '18:00', pos: 75.0 },
              { label: '21:00', pos: 87.5 },
              { label: '24:00', pos: 100 }
            ].map((t, idx) => (
              <span
                key={idx}
                style={{
                  left: `${t.pos}%`,
                  transform: t.pos === 0 ? 'translateX(0)' : t.pos === 100 ? 'translateX(-100%)' : 'translateX(-50%)'
                }}
                className="absolute top-0 text-[9px] font-mono font-bold text-slate-400"
              >
                {t.label}
              </span>
            ))}
          </div>

          {/* Output Stat Spacer */}
          <div className="w-20 shrink-0 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Output
          </div>
        </div>

        {/* Gantt Interactive Rows */}
        <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
          {timelineMachines.length === 0 && (
            <div className="py-6 text-center text-[11px] text-slate-400">Loading {selectedDate} timeline…</div>
          )}
          {timelineMachines.map((m) => {
            const isSelected = selectedMachineCode === m.machine_code;
            const isFault = m.status === 'FAULT';

            const segments = m.timeline_segments || [];

            return (
              <div
                key={m.machine_code}
                onClick={() => setSelectedMachineCode(m.machine_code)}
                className={`p-1.5 px-2 rounded-lg border transition-all cursor-pointer flex items-center gap-2.5 ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/25 ring-2 ring-blue-500/20 shadow-xs'
                    : 'bg-white border-[#DDD9D0] hover:border-blue-400 hover:bg-slate-50/50'
                }`}
              >
                {/* Machine Code & Cell */}
                <div className="w-20 shrink-0 font-mono">
                  <div className="font-black text-[11px] text-[#1E293B] flex items-center gap-1">
                    <span>{m.machine_code}</span>
                    {isFault && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
                  </div>
                  <div className="text-[9px] text-[#64748B] truncate">{m.cell_name.split(' ')[0]}</div>
                </div>

                {/* 24-hour bar: segments come straight from the server (power ledger + incidents).
                    Anything after "now" is left empty because it hasn't happened yet. */}
                <div className="flex-1 h-5 bg-slate-100 rounded-md overflow-hidden relative">
                  {segments.map((s, idx) => {
                    const style = SEGMENT_STYLE[s.status] || SEGMENT_STYLE.OFF;
                    const hours = s.endHour - s.startHour;
                    const pieces = s.status === 'RUNNING' && m.rate_per_hour ? Math.round(m.rate_per_hour * hours) : null;
                    const pulse = s.status === 'ESTOP' && isEStopActive && isViewingToday && idx === segments.length - 1;
                    return (
                      <div
                        key={idx}
                        style={{ left: `${(s.startHour / 24) * 100}%`, width: `${(hours / 24) * 100}%` }}
                        className={`absolute top-0 bottom-0 transition-colors ${style.bar} ${pulse ? 'animate-pulse' : ''}`}
                        onMouseEnter={(e) =>
                          handleSegmentHover(
                            e,
                            m.machine_code,
                            s.label,
                            `${s.startTime} - ${s.endTime} IST`,
                            s.status,
                            style.dot,
                            `${style.name} for ${formatSeconds(hours * 3600)}.`,
                            pieces !== null ? `≈ ${pieces} pcs produced` : undefined
                          )
                        }
                        onMouseLeave={() => setHoveredTooltip(null)}
                      />
                    );
                  })}

                  {/* Live "now" cursor (today only) */}
                  {isViewingToday && nowHour !== null && (
                    <div
                      style={{ left: `${(nowHour / 24) * 100}%` }}
                      className="absolute top-0 bottom-0 w-0.5 bg-blue-600 z-10 pointer-events-none"
                      title={`Now: ${formatHour(nowHour)} IST`}
                    />
                  )}
                </div>

                {/* Output Stats Pill */}
                <div className="w-20 text-right shrink-0 font-mono text-[10px]">
                  <strong className="text-[#1E293B]">{m.actual_pieces} pcs</strong>
                  <div className="text-[9px] text-slate-400">{formatSeconds(m.runtime_seconds)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. MASTER-DETAIL SPLIT: MACHINE TABLE + DEEP AUDIT DRAWER     */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Left: Machine Performance Table */}
        <div className="lg:col-span-7 bg-[#FAF9F6] p-3.5 rounded-xl border border-[#DDD9D0] shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#DDD9D0] pb-2">
            <h3 className="text-xs font-black uppercase text-[#1E293B] tracking-wider flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-blue-600" />
              <span>Daily Production &amp; Machine Performance Log</span>
            </h3>

            {/* Filter Search */}
            <div className="relative">
              <Search size={11} className="absolute left-2.5 top-2 text-slate-400" />
              <input
                type="text"
                placeholder="Search machine..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-6 pr-2.5 py-1 text-xs bg-white border border-[#DDD9D0] rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#DDD9D0] text-[10px] uppercase font-bold text-slate-500 sticky top-0 bg-[#FAF9F6]">
                  <th className="pb-1.5">Machine</th>
                  <th className="pb-1.5">Runtime</th>
                  <th className="pb-1.5">Downtime</th>
                  <th className="pb-1.5">Pieces</th>
                  <th className="pb-1.5">Missed</th>
                  <th className="pb-1.5">Faults</th>
                  <th className="pb-1.5">Technician</th>
                  <th className="pb-1.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMachinesTable.map((m) => {
                  const isSelected = selectedMachineCode === m.machine_code;
                  return (
                    <tr
                      key={m.machine_code}
                      onClick={() => setSelectedMachineCode(m.machine_code)}
                      className={`hover:bg-blue-50/20 cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50/30 font-bold' : ''
                      }`}
                    >
                      <td className="py-2 font-mono text-blue-700 font-bold">{m.machine_code}</td>
                      <td className="py-2 font-mono text-slate-700">{formatSeconds(m.runtime_seconds)}</td>
                      <td className="py-2 font-mono text-rose-600">{m.downtime_seconds > 0 ? formatSeconds(m.downtime_seconds) : '0m'}</td>
                      <td className="py-2 font-mono font-bold text-[#1E293B]">{m.actual_pieces}</td>
                      <td className="py-2 font-mono text-amber-800">{m.missed_pieces > 0 ? m.missed_pieces : '0'}</td>
                      <td className="py-2">
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${
                          m.fault_count > 0 ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'text-slate-400'
                        }`}>
                          {m.fault_count}
                        </span>
                      </td>
                      <td className="py-2 text-[10px] text-slate-600 truncate max-w-[100px]">{m.assigned_technician?.split(' ')[0]}</td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => setSelectedMachineCode(m.machine_code)}
                          className="px-2 py-0.5 bg-white hover:bg-slate-100 border border-[#DDD9D0] text-slate-700 rounded text-[10px] font-bold cursor-pointer"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Selected Machine Deep Audit Trail & Day Replay */}
        <div className="lg:col-span-5 bg-[#FAF9F6] p-3.5 rounded-xl border border-[#DDD9D0] shadow-xs space-y-3">
          {selectedMachineDetail.summary ? (
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#DDD9D0] pb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-black text-[#1E293B] font-mono">
                      {selectedMachineDetail.summary.machine_code}
                    </h3>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                      {selectedMachineDetail.summary.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#64748B] mt-0.5">{selectedMachineDetail.summary.cell_name}</p>
                </div>

                {/* Day Replay Action */}
                <button
                  onClick={handleReplayDay}
                  disabled={replaying}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <Play size={11} className={replaying ? 'animate-spin' : ''} />
                  <span>{replaying ? `Replaying (${replayStep}/${selectedMachineDetail.events.length})...` : ' Replay Day'}</span>
                </button>
              </div>

              {/* Machine Metrics Grid */}
              <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                <div className="p-2 bg-white rounded-lg border border-[#DDD9D0]">
                  <div className="text-[9px] text-slate-400 font-sans">Production</div>
                  <strong className="text-[#1E293B] text-xs">{selectedMachineDetail.summary.actual_pieces} pcs</strong>
                </div>
                <div className="p-2 bg-white rounded-lg border border-[#DDD9D0]">
                  <div className="text-[9px] text-slate-400 font-sans">Downtime</div>
                  <strong className="text-rose-600 text-xs">{formatSeconds(selectedMachineDetail.summary.downtime_seconds)}</strong>
                </div>
                <div className="p-2 bg-white rounded-lg border border-[#DDD9D0]">
                  <div className="text-[9px] text-slate-400 font-sans">Missed Pcs</div>
                  <strong className="text-amber-800 text-xs">{selectedMachineDetail.summary.missed_pieces} pcs</strong>
                </div>
              </div>

              {/* 10-Step Chronological Event Log */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                  <span>Full Chronological Lifecycle Stream</span>
                  <span className="font-mono text-[9px]">{selectedMachineDetail.events.length} Events Logged</span>
                </div>

                <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1 text-xs">
                  {selectedMachineDetail.events.map((evt, idx) => {
                    const isCurrentReplay = replaying && idx === replayStep - 1;
                    return (
                      <div
                        key={idx}
                        className={`p-2 rounded-lg border transition-all space-y-0.5 ${
                          isCurrentReplay
                            ? 'bg-blue-100 border-blue-500 shadow-md ring-2 ring-blue-400/40'
                            : 'bg-white border-[#DDD9D0]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[9px] font-bold text-slate-400">{evt.time}</span>
                          <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded font-mono ${
                            evt.status === 'CRITICAL'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : evt.status === 'OPTIMAL' || evt.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                            {evt.category}
                          </span>
                        </div>
                        <div className="font-bold text-[#1E293B] text-[10px]">{evt.title}</div>
                        <p className="text-[9px] text-[#64748B] leading-tight">{evt.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-slate-400 text-xs">
              Select a machine from the table to view its full 24-hour audit log.
            </div>
          )}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 5. FLOATING INTERACTIVE SEGMENT TOOLTIP                        */}
      {/* ───────────────────────────────────────────────────────────── */}
      {hoveredTooltip && (
        <div
          style={{
            position: 'fixed',
            left: `${hoveredTooltip.x}px`,
            top: `${hoveredTooltip.y}px`,
            transform: 'translate(-50%, -100%)',
            pointerEvents: 'none',
            zIndex: 9999
          }}
          className="bg-slate-900/95 text-white p-2.5 rounded-xl border border-slate-700 shadow-2xl backdrop-blur-md text-xs space-y-1 min-w-[200px] max-w-[280px] animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-700 pb-1">
            <span className="font-mono font-bold text-blue-400 text-[11px]">{hoveredTooltip.machineCode}</span>
            <span className="font-mono text-[9px] text-slate-300">{hoveredTooltip.timeRange}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`w-2 h-2 rounded-full ${hoveredTooltip.color}`} />
            <span className="font-bold text-[11px] text-slate-100">{hoveredTooltip.label}</span>
          </div>
          <p className="text-[10px] text-slate-300 leading-tight">{hoveredTooltip.details}</p>
          {hoveredTooltip.outputInfo && (
            <div className="font-mono text-[9px] text-emerald-400 font-bold pt-0.5 border-t border-slate-800">
              {hoveredTooltip.outputInfo}
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 6. MONTHLY CALENDAR OVERVIEW MODAL (Portaled to document.body) */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showCalendarModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#FAF9F6] w-full max-w-2xl rounded-2xl border border-[#DDD9D0] shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-3.5 bg-white border-b border-[#DDD9D0] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-blue-600" />
                <h3 className="font-black text-xs text-[#1E293B]">
                  Production Calendar &bull;{' '}
                  {new Date(Date.UTC(currentYear, currentMonth - 1, 1)).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
                </h3>
              </div>
              <button
                onClick={() => setShowCalendarModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* Days Grid */}
            <div className="p-3.5">
              <div className="grid grid-cols-7 gap-1.5 text-center text-[9px] font-bold uppercase text-slate-400 mb-1.5">
                <div>Mon</div>
                <div>Tue</div>
                <div>Wed</div>
                <div>Thu</div>
                <div>Fri</div>
                <div>Sat</div>
                <div>Sun</div>
              </div>

              <div className="grid grid-cols-7 gap-1.5 text-xs">
                {/* Leading blanks so day 1 lands under its weekday (Mon-first grid) */}
                {Array.from({ length: (new Date(Date.UTC(currentYear, currentMonth - 1, 1)).getUTCDay() + 6) % 7 }).map((_, i) => (
                  <div key={`pad-${i}`} />
                ))}
                {monthlyDays.map((d) => {
                  const isSelected = selectedDate === d.date;
                  const isToday = d.date === today;
                  const isFuture = d.date > today;
                  return (
                    <div
                      key={d.day}
                      onClick={() => !isFuture && handleSelectDay(d.date)}
                      title={d.source === 'SIMULATED' ? 'Simulated history (before recording started)' : undefined}
                      className={`p-1.5 rounded-lg border transition-all text-left flex flex-col justify-between h-14 ${
                        isFuture ? 'bg-slate-50 border-slate-100 opacity-50 cursor-not-allowed' : 'cursor-pointer'
                      } ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/40 ring-2 ring-blue-500/20 shadow-xs'
                          : isFuture ? '' : 'bg-white border-[#DDD9D0] hover:border-blue-400'
                      } ${isToday && !isSelected ? 'border-blue-300' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`font-mono font-bold text-xs ${isToday ? 'text-blue-700' : 'text-[#1E293B]'}`}>
                          {d.day}
                        </span>
                        {d.faultsCount > 0 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" title={`${d.faultsCount} faults`} />
                        )}
                      </div>

                      {d.productionPieces > 0 && (
                        <div className="text-[8px] font-mono font-bold text-slate-500">
                          {d.productionPieces.toLocaleString()} pcs
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-2.5 bg-white border-t border-[#DDD9D0] flex justify-end">
              <button
                onClick={() => setShowCalendarModal(false)}
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
