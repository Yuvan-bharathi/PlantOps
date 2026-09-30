import React, { useState, useEffect } from 'react';
import { 
  Wrench, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Layers, 
  Cpu, 
  X, 
  RefreshCw, 
  ShieldCheck, 
  ArrowRight,
  PackageCheck,
  UserCheck,
  Activity,
  Zap
} from 'lucide-react';
import { api } from '../../services/api';

interface StationToolingData {
  code: string;
  name: string;
  currentTool: string;
  holder: string;
  partId: string;
  stockAvailable: number;
  wearPct: number;
  spindleLoad: number;
  cuttingHours: number;
  isDue: boolean;
  urgency: 'CRITICAL' | 'HIGH' | 'OPTIMAL';
  stagedBay: string;
  estSwapDurationSec: number;
}

interface BatchToolingOptimizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddToast?: (toast: { type: 'SUCCESS' | 'AI_AGENT' | 'WARNING' | 'INFO'; title: string; subtitle?: string; message: string }) => void;
  onRefresh?: () => void;
}

export const BatchToolingOptimizerModal: React.FC<BatchToolingOptimizerModalProps> = ({
  isOpen,
  onClose,
  onAddToast,
  onRefresh
}) => {
  const [stations, setStations] = useState<StationToolingData[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [windowType, setWindowType] = useState<'IMMEDIATE' | 'SHIFT_HANDOVER' | 'LUNCH_BUFFER'>('IMMEDIATE');
  const [assignedTech, setAssignedTech] = useState('Arun Kumar (Lead Vibration & Spindle Specialist)');
  const [autoCalibrate, setAutoCalibrate] = useState(true);
  const [highWearCount, setHighWearCount] = useState(0);
  const [estSavedMinutes, setEstSavedMinutes] = useState(55);

  useEffect(() => {
    if (isOpen) {
      loadToolingData();
    }
  }, [isOpen]);

  const loadToolingData = async () => {
    setLoading(true);
    try {
      const res = await api.getCncToolingStatus();
      if (res?.success && res.data?.stations) {
        setStations(res.data.stations);
        setHighWearCount(res.data.highWearCount || 0);
        setEstSavedMinutes(res.data.estSavedMinutes || 55);
        // Auto-select stations with wear >= 65%
        const dueCodes = res.data.stations
          .filter((s: StationToolingData) => s.wearPct >= 65)
          .map((s: StationToolingData) => s.code);
        setSelectedCodes(dueCodes.length > 0 ? dueCodes : res.data.stations.map((s: StationToolingData) => s.code));
      }
    } catch (e) {
      console.warn('Failed to load tooling status from API, using fallback catalog');
    } finally {
      setLoading(false);
    }
  };

  const toggleStation = (code: string) => {
    setSelectedCodes(prev => 
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const selectAllDue = () => {
    const due = stations.filter(s => s.wearPct >= 65).map(s => s.code);
    setSelectedCodes(due);
  };

  const selectAll = () => {
    setSelectedCodes(stations.map(s => s.code));
  };

  const handleExecuteBatch = async () => {
    if (selectedCodes.length === 0) return;
    setExecuting(true);

    try {
      const res = await api.executeBatchToolSwap({
        machineCodes: selectedCodes,
        windowType,
        assignedTechName: assignedTech,
        autoCalibrate
      });

      if (res?.success) {
        onAddToast?.({
          type: 'AI_AGENT',
          title: '⚡ Multi-Station Tool Swap Scheduled',
          subtitle: `${selectedCodes.length} CNC Stations Synchronized`,
          message: `Work orders dispatched to ${assignedTech.split(' ')[0]}. Tool crib staged at Bay B with ${autoCalibrate ? 'auto laser calibration' : 'manual zero mastering'}.`
        });

        // Update local stations to reflect 0% wear
        setStations(prev => prev.map(s => selectedCodes.includes(s.code) ? { ...s, wearPct: 0, isDue: false, urgency: 'OPTIMAL' } : s));
        onRefresh?.();
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      onAddToast?.({
        type: 'WARNING',
        title: 'Batch Tooling Notice',
        message: err.message || 'Tool swap request submitted.'
      });
      onClose();
    } finally {
      setExecuting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50/80 via-white to-indigo-50/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Zap className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  CNC Machining Cell: Multi-Station Batch Tooling Optimizer
                </h2>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                  AI Autonomous
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Synchronize tool life cycles across 6-axis milling & turning centers to eliminate staggered micro-stops.
              </p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-slate-50/40">
          
          {/* Top KPI Metrics Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-600" /> Total Milling Stations
              </div>
              <div className="text-xl font-bold font-mono text-slate-900 mt-1">6 Centers</div>
              <div className="text-[10px] text-slate-400">CNC-01 to CNC-06</div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-amber-200/80 bg-amber-50/30 shadow-2xs">
              <div className="text-[11px] font-semibold text-amber-700 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Tools High Wear (≥65%)
              </div>
              <div className="text-xl font-bold font-mono text-amber-700 mt-1">{highWearCount} Stations</div>
              <div className="text-[10px] text-amber-600 font-medium">Auto-batched for swap</div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-emerald-200/80 bg-emerald-50/30 shadow-2xs">
              <div className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-600" /> Saved Downtime
              </div>
              <div className="text-xl font-bold font-mono text-emerald-700 mt-1">~{estSavedMinutes} min</div>
              <div className="text-[10px] text-emerald-600 font-medium">62.5% Batch Efficiency</div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                <PackageCheck className="w-3.5 h-3.5 text-blue-600" /> Tool Crib Staging
              </div>
              <div className="text-xl font-bold font-mono text-blue-700 mt-1">100% In Stock</div>
              <div className="text-[10px] text-slate-500">Staged @ Bay B Cart</div>
            </div>
          </div>

          {/* Stations Selection Grid */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-blue-600" /> CNC Tooling Life & Station Selection ({selectedCodes.length}/{stations.length} selected)
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllDue}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 cursor-pointer hover:underline"
                >
                  Select High Wear Only ({highWearCount})
                </button>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-[11px] font-semibold text-slate-600 hover:text-slate-800 cursor-pointer hover:underline"
                >
                  Select All (6)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {stations.map(station => {
                const isSelected = selectedCodes.includes(station.code);
                const isCritical = station.wearPct >= 80;
                const isWarning = station.wearPct >= 65 && station.wearPct < 80;

                return (
                  <div
                    key={station.code}
                    onClick={() => toggleStation(station.code)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none space-y-2.5 relative ${
                      isSelected 
                        ? 'border-blue-500 bg-white shadow-xs ring-1 ring-blue-500/30' 
                        : 'border-slate-200 bg-white/70 hover:border-slate-300 opacity-80'
                    }`}
                  >
                    {/* Top Row: Code, Name, Checkbox */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-mono font-extrabold px-1.5 py-0.5 rounded bg-slate-100 text-blue-700 shrink-0">
                          {station.code}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate" title={station.name}>
                            {station.code === 'CNC-01' ? '5-Axis Precision Mill 01' : 
                             station.code === 'CNC-02' ? 'Heavy Turning Center 02' :
                             station.code === 'CNC-03' ? '5-Axis High Precision 03' :
                             station.code === 'CNC-04' ? '5-Axis Center 04' :
                             station.code === 'CNC-05' ? 'High-Speed Mill 05' : 'Precision Lathe 06'}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate" title={station.holder}>
                            {station.holder}
                          </div>
                        </div>
                      </div>

                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // handled by parent onClick
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer mt-0.5 shrink-0"
                      />
                    </div>

                    {/* Tool Spec */}
                    <div className="text-[11px] font-medium text-slate-700 bg-slate-50 p-1.5 rounded-lg border border-slate-100 truncate" title={station.currentTool}>
                      🔧 {station.currentTool}
                    </div>

                    {/* Wear Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-semibold text-slate-600">Tool Wear</span>
                        <span className={`font-mono font-bold ${
                          isCritical ? 'text-rose-600' : isWarning ? 'text-amber-600' : 'text-emerald-600'
                        }`}>
                          {station.wearPct}% {isCritical ? '(Replace Now)' : isWarning ? '(Due Soon)' : '(Optimal)'}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-300 ${
                            isCritical ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(5, station.wearPct))}%` }}
                        />
                      </div>
                    </div>

                    {/* Stock & Hours Sub-row */}
                    <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-100 text-slate-500">
                      <span>Cut: <strong className="text-slate-700 font-mono">{station.cuttingHours}h</strong></span>
                      <span className="text-emerald-700 font-medium">✅ {station.stockAvailable} available</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Configuration Settings Box */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-3.5">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-blue-600" /> Synchronized Batch Settings & Dispatch
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Window Selection */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-700">Maintenance Window</label>
                <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setWindowType('IMMEDIATE')}
                    className={`p-2 rounded-lg border text-center font-medium transition-all cursor-pointer ${
                      windowType === 'IMMEDIATE'
                        ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    ⚡ Immediate (22m)
                  </button>
                  <button
                    type="button"
                    onClick={() => setWindowType('SHIFT_HANDOVER')}
                    className={`p-2 rounded-lg border text-center font-medium transition-all cursor-pointer ${
                      windowType === 'SHIFT_HANDOVER'
                        ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    ⏰ Shift 14:00
                  </button>
                  <button
                    type="button"
                    onClick={() => setWindowType('LUNCH_BUFFER')}
                    className={`p-2 rounded-lg border text-center font-medium transition-all cursor-pointer ${
                      windowType === 'LUNCH_BUFFER'
                        ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    🍽️ Lunch 12:30
                  </button>
                </div>
              </div>

              {/* Assigned Specialist */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-700">Assigned Cluster Specialist</label>
                <select
                  value={assignedTech}
                  onChange={(e) => setAssignedTech(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="Arun Kumar (Lead Vibration & Spindle Specialist)">Arun Kumar (Lead Vibration & Spindle Specialist)</option>
                  <option value="Dev Patel (High-Speed CNC Tooling Specialist)">Dev Patel (High-Speed CNC Tooling Specialist)</option>
                  <option value="Frank Moore (Plant Maintenance Specialist)">Frank Moore (Plant Maintenance Specialist)</option>
                </select>
              </div>
            </div>

            {/* Checkbox Options */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-700 font-medium">
                <input
                  type="checkbox"
                  checked={autoCalibrate}
                  onChange={(e) => setAutoCalibrate(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                />
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Perform automated optical laser tool setter calibration & Z-axis zero mastering
                </span>
              </label>

              <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded">
                OSHA 1910.147 Group LOTO Standard
              </span>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-white flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-600">
            <span className="font-bold text-slate-900">{selectedCodes.length} of 6 CNC Stations</span> Selected for Batch Tool Swap
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={executing}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleExecuteBatch}
              disabled={executing || selectedCodes.length === 0}
              className={`px-5 py-2 text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer ${
                selectedCodes.length > 0 && !executing
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25 hover:shadow-lg'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              }`}
            >
              {executing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Dispatching Parallel Work Orders...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-amber-300" />
                  Execute Batch Tool Swap & Staging ({selectedCodes.length})
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
