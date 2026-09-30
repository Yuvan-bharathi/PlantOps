import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Zap,
  Power,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Shield,
  ShieldCheck,
  Cpu,
  Activity,
  Radio,
  Sliders,
  Bell,
  Lock,
  Flame,
  ArrowRight,
  RefreshCw,
  Clock,
  HardHat,
  Check,
  SlidersHorizontal,
  ExternalLink,
  ChevronRight,
  Search,
  X
} from 'lucide-react';
import { PlantPowerState, MachinePowerBreaker } from '../../types';
import { api } from '../../services/api';
import { ToastMessage } from '../ToastNotification';

interface PowerSupplyCellViewProps {
  onAddToast?: (toast: Omit<ToastMessage, 'id' | 'timestamp'> & { timestamp?: string }) => void;
  onNavigateTab?: (tab: string) => void;
  onSelectMachine?: (code: string) => void;
}

export const PowerSupplyCellView: React.FC<PowerSupplyCellViewProps> = ({
  onAddToast,
  onNavigateTab,
  onSelectMachine
}) => {
  const [powerState, setPowerState] = useState<PlantPowerState>({
    status: 'ON',
    voltage: 480.0,
    current_amps: 182.4,
    frequency_hz: 50.0,
    active_alarm: false,
    alarm_acknowledged: true,
    main_mcc_status: 'HEALTHY',
    total_load_kw: 151.6,
    last_energized_at: new Date(Date.now() - 28800000).toISOString(),
    last_deenergized_at: null
  });

  const [breakers, setBreakers] = useState<MachinePowerBreaker[]>([]);
  const [loading, setLoading] = useState(false);
  const [startingSequence, setStartingSequence] = useState(false);
  const [selectedCellFilter, setSelectedCellFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBreaker, setSelectedBreaker] = useState<MachinePowerBreaker | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'STOP' | 'ESTOP';
    title: string;
    subtitle: string;
    description: string;
    warningNote: string;
    confirmText: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const fetchPowerStatus = async () => {
    try {
      const res = await api.getPowerStatus();
      if (res && res.success && res.data) {
        setPowerState(res.data.plant);
        setBreakers(res.data.breakers);
        if (!selectedBreaker && res.data.breakers.length > 0) {
          const cnc05 = res.data.breakers.find((b: MachinePowerBreaker) => b.machine_code === 'CNC-05') || res.data.breakers[0];
          setSelectedBreaker(cnc05);
        }
      }
    } catch (err) {
      console.warn('Using fallback power status');
    }
  };

  useEffect(() => {
    fetchPowerStatus();
    const timer = setInterval(fetchPowerStatus, 3000);
    return () => clearInterval(timer);
  }, []);

  const handleStartPower = async () => {
    setStartingSequence(true);
    try {
      const res = await api.startPlantPower();
      if (res && res.success) {
        setPowerState(res.data.state);
        await fetchPowerStatus();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setStartingSequence(false);
    }
  };

  const handleStopPower = () => {
    setConfirmModal({
      isOpen: true,
      type: 'STOP',
      title: 'Controlled Plant Power Shutdown',
      subtitle: 'De-energize 480V 3-Phase Main Bus',
      description: 'You are initiating a controlled shutdown sequence for the main plant power distribution bus. All 25 machine production cycles will pause safely into zero-energy state.',
      warningNote: 'Ensure in-flight CNC machining and packaging cycles are safely held before confirming.',
      confirmText: 'Confirm Power Shutdown',
      onConfirm: async () => {
        setLoading(true);
        try {
          const res = await api.stopPlantPower();
          if (res && res.success) {
            setPowerState(res.data.state);
            await fetchPowerStatus();
          }
        } finally {
          setLoading(false);
          setConfirmModal(null);
        }
      }
    });
  };

  const handleEmergencyStop = () => {
    setConfirmModal({
      isOpen: true,
      type: 'ESTOP',
      title: 'EMERGENCY E-STOP SHUTDOWN TRIP',
      subtitle: 'Critical MCC Substation Isolation',
      description: 'You are activating an immediate Emergency E-Stop Trip. This will instantly trip the main MCC circuit breaker, trip all 25 cell feeder isolators, and sound facility safety alarms.',
      warningNote: 'OSHA Standard 1910: Immediate shutdown intended for critical life safety or severe equipment hazard.',
      confirmText: '🚨 ACTIVATE EMERGENCY E-STOP TRIP',
      onConfirm: async () => {
        try {
          const res = await api.emergencyStopPlant();
          if (res && res.success) {
            setPowerState(res.data.state);
            await fetchPowerStatus();
          }
        } catch (err) {
          console.error(err);
        } finally {
          setConfirmModal(null);
        }
      }
    });
  };

  const handleResetAlarm = async () => {
    try {
      await api.resetPowerAlarm();
      await fetchPowerStatus();
      onAddToast?.({
        type: 'INFO',
        title: 'Electrical Alarms Reset',
        subtitle: 'MCC Status: Healthy',
        message: 'Substation trip alarms cleared. Ready for controlled plant startup.'
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleBreaker = async (code: string) => {
    try {
      const res = await api.toggleMachineBreaker(code);
      if (res && res.success) {
        onAddToast?.({
          type: 'INFO',
          title: `Breaker ${code} ${res.data.breaker_status === 'CLOSED' ? 'Closed (ON)' : 'Opened (OFF)'}`,
          subtitle: `${res.data.voltage}V • ${res.data.current_amps}A`,
          message: `Feeder circuit state updated for ${code}.`
        });
        await fetchPowerStatus();
        if (selectedBreaker?.machine_code === code) {
          setSelectedBreaker(res.data);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredBreakers = breakers.filter((b) => {
    const matchesCell = selectedCellFilter === 'ALL' || b.cell_name.toLowerCase().includes(selectedCellFilter.toLowerCase());
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery = !q || b.machine_code.toLowerCase().includes(q) || b.cell_name.toLowerCase().includes(q) || b.breaker_status.toLowerCase().includes(q);
    return matchesCell && matchesQuery;
  });

  const isPowerOn = powerState.status === 'ON';
  const isEstop = powerState.status === 'ESTOP';

  return (
    <div className="space-y-4 w-full pb-12">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. TOP SUBSTATION BANNER & SYSTEM POWER CONTROLS              */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="bg-[#FAF9F6] p-4 rounded-2xl border border-[#DDD9D0] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3.5">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-xs shrink-0 ${
            isEstop ? 'bg-rose-600 animate-pulse' : isPowerOn ? 'bg-emerald-600' : 'bg-slate-700'
          }`}>
            <Zap size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm font-black text-[#1E293B]">
                Power Supply &amp; Electrical Control Cell
              </h1>
              <span className={`text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-md border ${
                isEstop
                  ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                  : isPowerOn
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-700 border-slate-300'
              }`}>
                {powerState.status === 'STARTING' ? 'STARTING...' : isEstop ? 'E-STOP TRIPPED' : isPowerOn ? 'PLANT ONLINE' : 'DE-ENERGIZED'}
              </span>
              <span className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md">
                ZONE 0 &bull; MAIN MCC
              </span>
            </div>
            <p className="text-[11px] text-[#64748B] font-medium mt-0.5">
              480V 3-Phase Substation Feeder &bull; 25 Machine Branch Breakers &bull; OSHA 1910.147 LOTO Station
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {isPowerOn ? (
            <button
              onClick={handleStopPower}
              disabled={loading}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs border border-[#DDD9D0] shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Power size={13} className="text-slate-500" />
              <span>Stop Power</span>
            </button>
          ) : (
            <button
              onClick={handleStartPower}
              disabled={startingSequence || isEstop}
              title={isEstop ? 'Reset E-Stop Interlock before starting plant power' : 'Energize 480V Substation Feeder'}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Power size={13} className={startingSequence ? 'animate-spin' : ''} />
              <span>{startingSequence ? 'Energizing...' : isEstop ? 'START POWER (TRIPPED)' : 'START PLANT POWER'}</span>
            </button>
          )}

          {/* E-STOP Button */}
          {isEstop ? (
            <div
              className="px-3 py-1.5 rounded-xl bg-rose-100 text-rose-800 border border-rose-300 font-black text-xs flex items-center gap-1.5 shadow-xs"
              title="E-Stop Interlock is active. Click Reset to clear safety trip."
            >
              <AlertTriangle size={13} className="text-rose-600 animate-pulse" />
              <span>E-STOP TRIPPED</span>
            </div>
          ) : (
            <button
              onClick={handleEmergencyStop}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="Emergency Substation Shunt Trip"
            >
              <AlertTriangle size={13} />
              <span>E-STOP</span>
            </button>
          )}

          {/* Reset Trip */}
          {(isEstop || powerState.active_alarm) && (
            <button
              onClick={handleResetAlarm}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer ring-2 ring-amber-400/50 animate-pulse"
              title="Reset E-Stop Safety Interlock"
            >
              <RotateCcw size={13} />
              <span>RESET E-STOP</span>
            </button>
          )}

          <button
            onClick={fetchPowerStatus}
            className="p-1.5 rounded-xl bg-white hover:bg-slate-100 border border-[#DDD9D0] text-slate-600 shadow-xs cursor-pointer"
            title="Refresh Telemetry"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. LIVE SUBSTATION ELECTRICAL GAUGES (Low Height, Crisp)      */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Metric 1: Bus Voltage */}
        <div className="bg-[#FAF9F6] p-3 rounded-xl border border-[#DDD9D0] shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[10px] font-extrabold uppercase text-[#64748B] tracking-wider">Bus Voltage (3-Phase)</div>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-lg font-black font-mono text-[#1E293B]">{powerState.voltage.toFixed(1)}</span>
              <span className="text-[10px] font-bold text-slate-500">V AC</span>
            </div>
            <div className="text-[9px] text-emerald-700 font-bold mt-0.5">
              &plusmn;1.5% Nominal Regulated
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center font-bold shrink-0">
            <Zap size={15} />
          </div>
        </div>

        {/* Metric 2: Current Draw */}
        <div className="bg-[#FAF9F6] p-3 rounded-xl border border-[#DDD9D0] shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[10px] font-extrabold uppercase text-[#64748B] tracking-wider">Total Current Draw</div>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-lg font-black font-mono text-[#1E293B]">{powerState.current_amps.toFixed(1)}</span>
              <span className="text-[10px] font-bold text-slate-500">Amperes</span>
            </div>
            <div className="text-[9px] text-slate-500 font-semibold mt-0.5">
              400A Main Capacity
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center font-bold shrink-0">
            <Activity size={15} />
          </div>
        </div>

        {/* Metric 3: Grid Frequency */}
        <div className="bg-[#FAF9F6] p-3 rounded-xl border border-[#DDD9D0] shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[10px] font-extrabold uppercase text-[#64748B] tracking-wider">Grid Frequency</div>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-lg font-black font-mono text-[#1E293B]">{powerState.frequency_hz.toFixed(1)}</span>
              <span className="text-[10px] font-bold text-slate-500">Hz</span>
            </div>
            <div className="text-[9px] text-slate-500 font-semibold mt-0.5">
              PF: 0.94 Leading &bull; 50 Hz Lock
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 border border-teal-200 flex items-center justify-center font-bold shrink-0">
            <Radio size={15} />
          </div>
        </div>

        {/* Metric 4: Active Power Load */}
        <div className="bg-[#FAF9F6] p-3 rounded-xl border border-[#DDD9D0] shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[10px] font-extrabold uppercase text-[#64748B] tracking-wider">Active Power Load</div>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-lg font-black font-mono text-[#1E293B]">{powerState.total_load_kw.toFixed(1)}</span>
              <span className="text-[10px] font-bold text-slate-500">kW</span>
            </div>
            <div className="text-[9px] text-emerald-700 font-bold mt-0.5">
              {isPowerOn ? `${breakers.filter(b => b.breaker_status === 'CLOSED').length} Machines Energized` : 'All Breakers Open (0 kW)'}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center font-bold shrink-0">
            <Sliders size={15} />
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. MACHINE BREAKER RACK & LIVE CIRCUIT CONSOLE                */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Left: 25 Breakers Grid */}
        <div className="lg:col-span-8 bg-[#FAF9F6] p-3.5 rounded-xl border border-[#DDD9D0] shadow-xs space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-[#DDD9D0] pb-2">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <h3 className="text-xs font-black uppercase text-[#1E293B] tracking-wider">
                Distribution MCC Breakers ({filteredBreakers.length}/25 Circuits)
              </h3>
            </div>

            {/* Controls: Search & Cell Tabs */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
                <input
                  type="text"
                  placeholder="Search breaker code, cell..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-7 pr-6 py-1 text-[11px] bg-white border border-[#DDD9D0] rounded-lg text-[#1E293B] placeholder:text-[#64748B] focus:outline-none focus:border-blue-600 w-44"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  >
                    <X size={10} />
                  </button>
                )}
              </div>

              {/* Cell Tabs */}
              <div className="flex items-center gap-1 flex-wrap text-xs">
                {['ALL', 'Machining', 'Robot', 'Processing', 'Assembly', 'Packaging', 'Maintenance'].map((cell) => (
                  <button
                    key={cell}
                    onClick={() => setSelectedCellFilter(cell)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                      selectedCellFilter === cell
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-white hover:bg-slate-100 text-[#64748B] border border-[#DDD9D0]'
                    }`}
                  >
                    {cell}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Empty Search Fallback */}
          {filteredBreakers.length === 0 && (
            <div className="text-center py-8 bg-white rounded-xl border border-dashed border-[#DDD9D0] text-slate-500">
              <Search className="w-6 h-6 mx-auto text-slate-400 mb-1.5 opacity-60" />
              <p className="text-xs font-bold text-slate-700">No matching machine breakers found</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Try searching for machine codes like "CNC-05", "ROB-01", or clear the filter.</p>
              <button
                onClick={() => { setSearchQuery(''); setSelectedCellFilter('ALL'); }}
                className="mt-2.5 px-2.5 py-1 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          )}

          {/* Breakers Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {filteredBreakers.map((b) => {
              const isSelected = selectedBreaker?.machine_code === b.machine_code;
              const isClosed = b.breaker_status === 'CLOSED';
              const isLoto = b.breaker_status === 'LOTO_LOCKED';
              const isFault = b.runtime_status === 'FAULT';

              return (
                <div
                  key={b.machine_code}
                  onClick={() => setSelectedBreaker(b)}
                  className={`p-2 rounded-lg border transition-all cursor-pointer flex flex-col justify-between group ${
                    isSelected
                      ? 'border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/20 shadow-xs'
                      : 'bg-white border-[#DDD9D0] hover:border-blue-400'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-black text-xs text-[#1E293B]">{b.machine_code}</span>
                      <span className={`w-2 h-2 rounded-full ${
                        isLoto ? 'bg-amber-500 ring-2 ring-amber-300' : isFault ? 'bg-rose-500 animate-pulse' : isClosed ? 'bg-emerald-500' : 'bg-slate-400'
                      }`} />
                    </div>
                    <div className="text-[9px] text-[#64748B] truncate mt-0.5">{b.cell_name.split(' ')[0]}</div>
                  </div>

                  <div className="pt-1.5 mt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono">
                    <span className="text-slate-500">{b.voltage}V</span>
                    <span className={`font-bold px-1.5 py-0.2 rounded text-[9px] ${
                      isLoto
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : isFault
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : isClosed
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {isLoto ? 'LOTO' : isClosed ? 'ON' : 'OFF'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Feeder & LOTO Station Drawer */}
        <div className="lg:col-span-4 bg-[#FAF9F6] p-3.5 rounded-xl border border-[#DDD9D0] shadow-xs space-y-3 flex flex-col justify-between">
          {selectedBreaker ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-[#DDD9D0] pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-mono font-bold text-xs shrink-0">
                    {selectedBreaker.machine_code.split('-')[0]}
                  </div>
                  <div>
                    <h3 className="font-black text-xs text-[#1E293B]">{selectedBreaker.machine_code} Feeder</h3>
                    <p className="text-[10px] text-[#64748B]">{selectedBreaker.cell_name}</p>
                  </div>
                </div>
                <span className={`text-[9px] font-mono font-extrabold px-2 py-0.5 rounded border ${
                  selectedBreaker.breaker_status === 'CLOSED'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-100 text-slate-700 border-slate-300'
                }`}>
                  {selectedBreaker.breaker_status}
                </span>
              </div>

              {/* Circuit Vitals */}
              <div className="bg-white p-2.5 rounded-lg border border-[#DDD9D0] space-y-1.5 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Bus Voltage:</span>
                  <strong className="text-[#1E293B]">{selectedBreaker.voltage.toFixed(1)} V AC</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Current Draw:</span>
                  <strong className="text-[#1E293B]">{selectedBreaker.current_amps.toFixed(1)} A</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Target Rate:</span>
                  <strong className="text-blue-700">{selectedBreaker.target_rate_per_hour} pcs/hr</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Cycle Time:</span>
                  <strong className="text-[#1E293B]">{selectedBreaker.cycle_time_seconds} sec</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Runtime Status:</span>
                  <span className="text-emerald-700 font-bold">{selectedBreaker.runtime_status}</span>
                </div>
              </div>

              {/* LOTO Station */}
              <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200 space-y-1 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-amber-900 text-[11px]">
                  <Lock size={12} />
                  <span>OSHA 1910.147 LOTO Station</span>
                </div>
                <p className="text-[10px] text-amber-800 leading-tight">
                  Padlock #PL-8894 registered for {selectedBreaker.machine_code}. Confirmed zero-energy state (0.0V / 0.0 bar).
                </p>
              </div>

              {/* Actions */}
              <div className="space-y-1.5 pt-1">
                <button
                  onClick={() => handleToggleBreaker(selectedBreaker.machine_code)}
                  className={`w-full py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer ${
                    selectedBreaker.breaker_status === 'CLOSED'
                      ? 'bg-white hover:bg-slate-100 text-slate-800 border border-[#DDD9D0]'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  <Power size={12} />
                  <span>
                    {selectedBreaker.breaker_status === 'CLOSED' ? 'Open Breaker (Isolate Feeder)' : 'Close Breaker (Energize Feeder)'}
                  </span>
                </button>

                <button
                  onClick={() => {
                    onSelectMachine?.(selectedBreaker.machine_code);
                    onNavigateTab?.('twin');
                  }}
                  className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Activity size={12} />
                  <span>Inspect in 3D Digital Twin &rarr;</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-slate-400 text-xs">
              Select a circuit breaker to inspect electrical parameters.
            </div>
          )}
        </div>
      </div>

      {/* ── Custom Industrial Confirmation Modal Card (Portaled to document.body to cover Header/Sidebar) ── */}
      {confirmModal && confirmModal.isOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#18202F] text-white border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 ring-1 ring-white/10">
            {/* Header with Danger / Alert Icon */}
            <div className="flex items-start gap-3.5">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  confirmModal.type === 'ESTOP'
                    ? 'bg-rose-500/20 border border-rose-500/40 text-rose-400 animate-pulse'
                    : 'bg-amber-500/20 border border-amber-500/40 text-amber-400'
                }`}
              >
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold">
                  OSHA Interlock &amp; Safety Control
                </div>
                <h3 className="text-base font-extrabold text-white tracking-tight mt-0.5">
                  {confirmModal.title}
                </h3>
                <div className="text-xs text-slate-300 font-medium mt-0.5">
                  {confirmModal.subtitle}
                </div>
              </div>
            </div>

            {/* Description Box */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 space-y-2.5 leading-relaxed">
              <p>{confirmModal.description}</p>
              <div
                className={`p-2.5 rounded-lg text-[11px] font-mono flex items-center gap-2 ${
                  confirmModal.type === 'ESTOP'
                    ? 'bg-rose-950/60 border border-rose-800/60 text-rose-300'
                    : 'bg-amber-950/60 border border-amber-800/60 text-amber-300'
                }`}
              >
                <Shield className="w-4 h-4 shrink-0" />
                <span>{confirmModal.warningNote}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-all cursor-pointer"
              >
                Cancel &amp; Abort
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-lg transition-all cursor-pointer active:scale-95 ${
                  confirmModal.type === 'ESTOP'
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-900/40'
                    : 'bg-amber-600 hover:bg-amber-700 shadow-amber-900/40'
                }`}
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
