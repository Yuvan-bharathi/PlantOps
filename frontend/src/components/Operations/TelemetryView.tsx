import React, { useState, useMemo } from 'react';
import {
  Activity, Gauge, Flame, Zap, Clock, RefreshCw,
  TrendingUp, AlertTriangle, CheckCircle2, Sliders, Calendar,
  Download, Filter, ChevronRight, Cpu, RadioTower, Layers,
  Compass, ShieldCheck, BarChart3, LineChart, Sparkles, FileSpreadsheet
} from 'lucide-react';
import { Machine, TelemetryData, Incident, WorkOrder } from '../../types';
import { UserProfile, RoleKey } from './LoginPage';

interface TelemetryViewProps {
  machines: Machine[];
  telemetryMap: Record<string, TelemetryData>;
  currentUser?: UserProfile;
  incidents?: Incident[];
  workOrders?: WorkOrder[];
  onSelectMachine?: (machine: Machine) => void;
  onNavigateTwin?: () => void;
}

export const TelemetryView: React.FC<TelemetryViewProps> = ({
  machines,
  telemetryMap,
  currentUser,
  incidents = [],
  workOrders = [],
  onSelectMachine,
  onNavigateTwin
}) => {
  const [selectedMachineCode, setSelectedMachineCode] = useState<string>('CNC-01');
  const [timeRange, setTimeRange] = useState<'1H' | '6H' | '24H' | '7D'>('1H');
  const [selectedMetric, setSelectedMetric] = useState<'ALL_OVERLAY' | 'VIBRATION' | 'TEMPERATURE' | 'CURRENT' | 'PRESSURE'>('ALL_OVERLAY');
  const [viewMode, setViewMode] = useState<'TIME_SERIES' | 'FFT_SPECTRUM'>('TIME_SERIES');
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const roleKey: RoleKey = currentUser?.roleKey || 'PLANT_ADMIN';
  const isTechnician = roleKey === 'TECHNICIAN';
  const isSupervisor = roleKey === 'SUPERVISOR';
  const isManager = roleKey === 'MANAGER';
  const isAdmin = roleKey === 'PLANT_ADMIN';

  const selectedMachine = machines.find(m => m.code === selectedMachineCode) || machines[0];
  const liveTelemetry = telemetryMap[selectedMachineCode] || {
    machineId: selectedMachineCode,
    vibration: selectedMachine?.status === 'FAULT' ? 8.6 : 2.15,
    temperature: selectedMachine?.status === 'FAULT' ? 82.4 : 61.2,
    current: 12.8,
    rpm: 2800,
    pressure: 5.2,
    timestamp: Date.now()
  };

  const isFault = selectedMachine?.status === 'FAULT';
  const isWarn = selectedMachine?.status === 'WARNING';

  // Generate realistic time-series degradation points
  const historyData = useMemo(() => {
    const count = timeRange === '1H' ? 12 : timeRange === '6H' ? 18 : timeRange === '24H' ? 24 : 14;
    
    return Array.from({ length: count }, (_, i) => {
      const progress = i / (count - 1);
      const spikeFactor = (isFault && progress > 0.55) ? (progress - 0.55) * 3.8 : 0;
      
      const baseVib = isFault ? 2.2 + spikeFactor * 2.1 : isWarn ? 4.4 : 2.05;
      const baseTemp = isFault ? 59 + spikeFactor * 7.5 : isWarn ? 69 : 60.5;
      const baseCurr = isFault ? 12.0 + spikeFactor * 1.6 : 12.5;
      const basePres = isFault ? 5.2 - spikeFactor * 0.8 : 5.2;

      const timeLabel = timeRange === '1H' ? `${(count - 1 - i) * 5}m ago` :
        timeRange === '6H' ? `${(count - 1 - i) * 20}m ago` :
        timeRange === '24H' ? `${i}:00` : `Day ${i + 1}`;

      return {
        time: timeLabel,
        vibration: parseFloat((baseVib + (Math.sin(i * 1.5) * 0.2)).toFixed(2)),
        temperature: parseFloat((baseTemp + (Math.cos(i * 1.2) * 0.6)).toFixed(1)),
        current: parseFloat((baseCurr + (Math.sin(i * 2) * 0.2)).toFixed(1)),
        pressure: parseFloat((basePres + (Math.cos(i * 1.1) * 0.1)).toFixed(1)),
        isAnomaly: isFault && progress > 0.55
      };
    });
  }, [timeRange, isFault, isWarn]);

  // FFT Harmonic Spectrum Data (Frequency Domain)
  const fftSpectrumData = useMemo(() => {
    const frequencies = [
      { hz: 20, label: '0.4X Sub-harmonic', amp: 0.45, type: 'OIL_WHIRL' },
      { hz: 46.6, label: '1X Running Speed (2800 RPM)', amp: isFault ? 3.4 : 1.2, type: '1X_RUNNING' },
      { hz: 93.3, label: '2X Shaft Alignment Harmonic', amp: isFault ? 2.1 : 0.6, type: '2X_MISALIGN' },
      { hz: 120.0, label: 'BPFO Bearing Outer Race Defect', amp: isFault ? 8.6 : 0.3, type: 'BPFO_BEARING' },
      { hz: 140.0, label: '3X Taper Runout Peak', amp: isFault ? 1.8 : 0.4, type: '3X_HARMONIC' },
      { hz: 180.0, label: 'BPFI Bearing Inner Race Defect', amp: isFault ? 4.2 : 0.2, type: 'BPFI_BEARING' },
      { hz: 240.0, label: '2X BPFO Ball Pass Harmonic', amp: isFault ? 3.1 : 0.1, type: '2X_BPFO' },
      { hz: 320.0, label: 'Gear Mesh / Spindle Blade Pass', amp: 0.8, type: 'GEAR_MESH' },
    ];
    return frequencies;
  }, [isFault]);

  // 1-Click CSV / JSON Export Bundle
  const handleExportTelemetry = (format: 'CSV' | 'JSON') => {
    const filename = `plantops_telemetry_${selectedMachineCode}_${new Date().toISOString().split('T')[0]}.${format.toLowerCase()}`;
    if (format === 'JSON') {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
        asset: selectedMachineCode,
        machineName: selectedMachine?.name,
        facility: 'Enterprise Industrial Facility - Zone A',
        exportedAt: new Date().toISOString(),
        liveTelemetry,
        timeSeriesLogs: historyData,
        fftSpectrum: fftSpectrumData
      }, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", filename);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } else {
      let csvContent = "data:text/csv;charset=utf-8,Timestamp,Machine,Vibration_mm_s,Temperature_C,Current_A,Pressure_bar,Anomaly_Flag\n";
      historyData.forEach(row => {
        csvContent += `${row.time},${selectedMachineCode},${row.vibration},${row.temperature},${row.current},${row.pressure},${row.isAnomaly ? 'YES' : 'NO'}\n`;
      });
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    }

    setExportNotice(`📥 Telemetry data bundle (${format}) downloaded for ${selectedMachineCode}.`);
    setTimeout(() => setExportNotice(null), 3500);
  };

  return (
    <div className="space-y-6 w-full animate-fade-in pb-12">
      {/* Export Toast Notification */}
      {exportNotice && (
        <div className="fixed top-20 right-6 z-50 bg-[#2563EB] text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-top-2">
          <Download size={16} />
          <span>{exportNotice}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="bg-[#FAF9F6] p-5 rounded-2xl border border-[#DDD9D0] shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Enterprise Industrial Facility • Zone A</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
              ISO 10816-3 Severity Baseline
            </span>
          </div>
          <h2 className="text-xl font-extrabold text-[#1E293B] flex items-center gap-2.5 mt-1">
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#2563EB]">
              <Activity className="w-4 h-4" />
            </div>
            Multi-Sensor Telemetry & Time-Series Degradation Curves
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            Real-time IoT edge streams (10 Hz), dual-axis correlation curves, and FFT frequency harmonic spectrum analysis.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handleExportTelemetry('CSV')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#DDD9D0] text-[#1E293B] text-xs font-bold hover:bg-slate-50 transition-all shadow-xs"
            title="Export CSV time-series log"
          >
            <FileSpreadsheet size={13} className="text-emerald-700" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => handleExportTelemetry('JSON')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#DDD9D0] text-[#1E293B] text-xs font-bold hover:bg-slate-50 transition-all shadow-xs"
            title="Export JSON telemetry bundle"
          >
            <Download size={13} className="text-[#2563EB]" />
            <span>Export JSON</span>
          </button>

          {onNavigateTwin && selectedMachine && (
            <button
              onClick={() => {
                if (onSelectMachine) onSelectMachine(selectedMachine);
                onNavigateTwin();
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm"
            >
              <Layers size={14} />
              <span>View in 3D Twin</span>
            </button>
          )}
        </div>
      </div>

      {/* Machine Selector Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
        {machines.slice(0, 12).map((m) => {
          const isSelected = m.code === selectedMachineCode;
          const isMachineFault = m.status === 'FAULT';
          return (
            <button
              key={m.code}
              onClick={() => setSelectedMachineCode(m.code)}
              className={`p-3 rounded-2xl text-left border transition-all ${
                isSelected
                  ? 'bg-white border-[#2563EB] ring-2 ring-[#2563EB]/20 shadow-xs'
                  : 'bg-[#FAF9F6] border-[#DDD9D0] hover:bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-extrabold text-xs text-[#1E293B]">{m.code}</span>
                <span className={`w-2 h-2 rounded-full ${isMachineFault ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
              </div>
              <div className="text-[10px] text-[#64748B] truncate mt-1">{m.name}</div>
              <div className="mt-2 flex items-center justify-between text-[9px] text-[#64748B] pt-1.5 border-t border-[#DDD9D0]">
                <span>Health:</span>
                <strong className={`font-mono ${m.health_score < 70 ? 'text-red-600' : 'text-emerald-700'}`}>{m.health_score}%</strong>
              </div>
            </button>
          );
        })}
      </div>

      {/* Live Transducer Gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Radial Vibration Gauge */}
        <div className={`bg-white border rounded-2xl p-4 shadow-2xs ${liveTelemetry.vibration > 7.0 ? 'border-red-400 bg-red-50/20' : 'border-[#DDD9D0]'}`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-[#64748B] flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-[#2563EB]" /> Radial Vibration
            </span>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">
              ISO 10816-3
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-black font-mono ${liveTelemetry.vibration > 7.0 ? 'text-[#D64545]' : 'text-[#1E293B]'}`}>
              {liveTelemetry.vibration.toFixed(2)}
            </span>
            <span className="text-xs text-[#64748B]">mm/s RMS</span>
          </div>
          <div className="mt-2.5">
            <div className="flex justify-between text-[10px] text-[#64748B] mb-1">
              <span>Class II Limit: 4.5 mm/s</span>
              <span className={`font-bold ${liveTelemetry.vibration > 7.0 ? 'text-[#D64545]' : liveTelemetry.vibration > 4.5 ? 'text-amber-600' : 'text-emerald-700'}`}>
                {liveTelemetry.vibration > 7.0 ? 'ZONE D (CRITICAL)' : liveTelemetry.vibration > 4.5 ? 'ZONE C (WARNING)' : 'ZONE A (GOOD)'}
              </span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  liveTelemetry.vibration > 7.0 ? 'bg-[#D64545]' : liveTelemetry.vibration > 4.5 ? 'bg-amber-500' : 'bg-[#22A06B]'
                }`}
                style={{ width: `${Math.min((liveTelemetry.vibration / 12) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Bearing Temperature Gauge */}
        <div className={`bg-white border rounded-2xl p-4 shadow-2xs ${liveTelemetry.temperature > 75 ? 'border-red-400 bg-red-50/20' : 'border-[#DDD9D0]'}`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-[#64748B] flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-500" /> Bearing Temp
            </span>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">
              PT100 RTD
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-black font-mono ${liveTelemetry.temperature > 75 ? 'text-[#D64545]' : 'text-[#1E293B]'}`}>
              {liveTelemetry.temperature.toFixed(1)}
            </span>
            <span className="text-xs text-[#64748B]">°C</span>
          </div>
          <div className="mt-2.5">
            <div className="flex justify-between text-[10px] text-[#64748B] mb-1">
              <span>Threshold: 75.0 °C</span>
              <span className={`font-bold ${liveTelemetry.temperature > 75 ? 'text-[#D64545]' : 'text-emerald-700'}`}>
                {liveTelemetry.temperature > 80 ? 'THERMAL SURGE' : liveTelemetry.temperature > 70 ? 'ELEVATED' : 'NOMINAL'}
              </span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  liveTelemetry.temperature > 75 ? 'bg-[#D64545]' : 'bg-[#22A06B]'
                }`}
                style={{ width: `${Math.min((liveTelemetry.temperature / 100) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Phase Current Gauge */}
        <div className="bg-white border border-[#DDD9D0] rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-[#64748B] flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#2563EB]" /> Spindle Motor Current
            </span>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">
              CT-Sensor
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-[#1E293B]">{liveTelemetry.current || 12.8}</span>
            <span className="text-xs text-[#64748B]">Amperes (A)</span>
          </div>
          <div className="mt-2.5">
            <div className="flex justify-between text-[10px] text-[#64748B] mb-1">
              <span>Nominal Load: 15.0 A</span>
              <span className="text-emerald-700 font-bold">BALANCED</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#2563EB] rounded-full transition-all duration-500"
                style={{ width: `${Math.min(((liveTelemetry.current || 12.8) / 20) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Hydraulic Pressure / Velocity Gauge */}
        <div className="bg-white border border-[#DDD9D0] rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-[#64748B] flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-[#0F766E]" /> Hydraulic Manifold
            </span>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">
              Piezo 0-10 bar
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-[#1E293B]">{liveTelemetry.pressure || 5.2}</span>
            <span className="text-xs text-[#64748B]">bar</span>
          </div>
          <div className="mt-2.5">
            <div className="flex justify-between text-[10px] text-[#64748B] mb-1">
              <span>Operating Window: 4.5 - 6.5</span>
              <span className="text-emerald-700 font-bold">NOMINAL</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#0F766E] rounded-full transition-all duration-500"
                style={{ width: '82%' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Multi-Sensor Degradation Curve & Spectrum Analyzer Container */}
      <div className="bg-white border border-[#DDD9D0] rounded-2xl p-6 shadow-2xs space-y-5">
        {/* Chart View Header & Mode Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DDD9D0]">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-xs text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {selectedMachineCode}
              </span>
              <h3 className="text-sm font-extrabold text-[#1E293B]">
                {viewMode === 'TIME_SERIES' ? 'Time-Series Sensor Degradation Curves' : 'FFT Spectral Frequency & Harmonic Spectrum Analyzer'}
              </h3>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              {viewMode === 'TIME_SERIES'
                ? 'Dual-axis sensor correlation showing vibration acceleration vs. bearing thermal dissipation'
                : 'Spectral decomposition isolating 1X shaft running speeds and high-frequency BPFO bearing defect peaks'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Switcher */}
            <div className="flex bg-[#FAF9F6] p-1 rounded-xl border border-[#DDD9D0]">
              <button
                onClick={() => setViewMode('TIME_SERIES')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'TIME_SERIES' ? 'bg-[#2563EB] text-white shadow-xs' : 'text-[#64748B] hover:text-[#1E293B]'
                }`}
              >
                <TrendingUp size={13} />
                <span>Time-Series</span>
              </button>
              <button
                onClick={() => setViewMode('FFT_SPECTRUM')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'FFT_SPECTRUM' ? 'bg-[#0F766E] text-white shadow-xs' : 'text-[#64748B] hover:text-[#1E293B]'
                }`}
              >
                <BarChart3 size={13} />
                <span>FFT Spectrum</span>
              </button>
            </div>

            {/* Time Window (for Time-Series mode) */}
            {viewMode === 'TIME_SERIES' && (
              <div className="flex bg-[#FAF9F6] p-1 rounded-xl border border-[#DDD9D0]">
                {(['1H', '6H', '24H', '7D'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setTimeRange(r)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                      timeRange === r ? 'bg-white text-[#2563EB] border border-[#DDD9D0] shadow-2xs' : 'text-[#64748B] hover:text-[#1E293B]'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* View 1: Time Series Multi-Sensor Overlay Chart */}
        {viewMode === 'TIME_SERIES' && (
          <div className="space-y-4">
            {/* ISO Severity Indicator Legend */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-bold p-2.5 bg-[#FAF9F6] rounded-xl border border-[#DDD9D0]">
              <div className="flex items-center gap-1.5 text-emerald-800">
                <span className="w-2.5 h-2.5 rounded bg-emerald-500" />
                <span>Zone A: Good (&lt; 2.8 mm/s)</span>
              </div>
              <div className="flex items-center gap-1.5 text-teal-800">
                <span className="w-2.5 h-2.5 rounded bg-teal-500" />
                <span>Zone B: Acceptable (2.8 - 4.5)</span>
              </div>
              <div className="flex items-center gap-1.5 text-amber-800">
                <span className="w-2.5 h-2.5 rounded bg-amber-500" />
                <span>Zone C: Warning (4.5 - 7.1)</span>
              </div>
              <div className="flex items-center gap-1.5 text-red-800">
                <span className="w-2.5 h-2.5 rounded bg-red-500" />
                <span>Zone D: Critical (&gt; 7.1 mm/s)</span>
              </div>
            </div>

            {/* Time Series Multi-Bar Chart */}
            <div className="p-4 bg-[#FAF9F6] rounded-2xl border border-[#DDD9D0] overflow-x-auto">
              <div className="h-64 flex items-end justify-between gap-3 pt-6 min-w-[580px]">
                {historyData.map((d, i) => {
                  const vibHeight = Math.min((d.vibration / 10.0) * 100, 100);
                  const tempHeight = Math.min((d.temperature / 100.0) * 100, 100);

                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group relative">
                      {/* Tooltip Hover */}
                      <div className="absolute -top-14 opacity-0 group-hover:opacity-100 bg-[#1E293B] text-white text-[10px] p-2 rounded-lg shadow-xl pointer-events-none transition-opacity whitespace-nowrap z-30 space-y-0.5 font-mono">
                        <div className="font-bold text-slate-300 font-sans">{d.time}</div>
                        <div className="text-blue-300">〰️ Vibration: {d.vibration} mm/s</div>
                        <div className="text-amber-300">🌡️ Temp: {d.temperature} °C</div>
                        <div className="text-teal-300">⚡ Current: {d.current} A</div>
                      </div>

                      {/* Anomaly Indicator */}
                      {d.isAnomaly && (
                        <span className="text-[9px] font-black text-red-600 animate-bounce mb-1">
                          🚨 ALERT
                        </span>
                      )}

                      {/* Dual Bars Container */}
                      <div className="flex items-end gap-1 w-full justify-center h-full">
                        {/* Vibration Bar */}
                        <div
                          className={`w-1/2 rounded-t-md transition-all duration-300 ${
                            d.vibration > 7.1 ? 'bg-red-500 shadow-sm' : d.vibration > 4.5 ? 'bg-amber-500' : 'bg-[#2563EB]'
                          }`}
                          style={{ height: `${vibHeight}%` }}
                        />
                        {/* Temp Bar */}
                        <div
                          className={`w-1/2 rounded-t-md transition-all duration-300 ${
                            d.temperature > 75 ? 'bg-red-400' : 'bg-amber-400'
                          }`}
                          style={{ height: `${tempHeight}%` }}
                        />
                      </div>

                      <span className="text-[9px] text-[#64748B] truncate w-full text-center mt-1 font-mono">
                        {d.time}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Chart Footnote */}
              <div className="mt-4 pt-3 border-t border-[#DDD9D0] flex flex-wrap items-center justify-between text-xs text-[#64748B]">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#2563EB]" /> Radial Vibration (mm/s)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" /> Bearing Temp (°C)
                  </span>
                </div>
                <div className="font-mono text-[11px] text-[#0F766E] font-bold">
                  ● 10 Hz Ingestion Active &bull; Sub-10ms Ingestion Latency
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View 2: FFT Frequency Domain Harmonic Spectrum Analyzer */}
        {viewMode === 'FFT_SPECTRUM' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-xs text-teal-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-teal-700" />
                <span>
                  <strong>FFT Frequency Analysis:</strong> Spectral peaks isolated at <strong>120 Hz</strong> (BPFO Ball Pass Frequency Outer Race defect) and <strong>46.6 Hz</strong> (1X Running Speed).
                </span>
              </div>
              <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-teal-200 text-teal-900">
                1024-Point Hanning Window
              </span>
            </div>

            {/* Frequency Bar Spectrum */}
            <div className="p-5 bg-[#0F172A] rounded-2xl border border-slate-800 text-white space-y-4">
              <div className="h-56 flex items-end justify-between gap-4 pt-4">
                {fftSpectrumData.map((item, idx) => {
                  const heightPct = Math.min((item.amp / 10.0) * 100, 100);
                  const isPeak = item.amp > 5.0;

                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                      {/* Tooltip */}
                      <div className="absolute -top-10 opacity-0 group-hover:opacity-100 bg-slate-900 text-white text-[10px] p-2 rounded border border-slate-700 shadow-xl pointer-events-none transition-opacity whitespace-nowrap z-20 font-mono">
                        {item.label}: {item.amp.toFixed(2)} mm/s RMS @ {item.hz} Hz
                      </div>

                      {isPeak && (
                        <div className="text-[10px] font-bold text-red-400 font-mono mb-1 animate-pulse">
                          {item.amp.toFixed(1)} mm/s
                        </div>
                      )}

                      {/* Spectrum Bar */}
                      <div
                        className={`w-full max-w-[42px] rounded-t-lg transition-all duration-500 ${
                          isPeak
                            ? 'bg-gradient-to-t from-red-600 to-rose-400 shadow-lg shadow-red-500/30'
                            : 'bg-gradient-to-t from-cyan-600 to-blue-400'
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />

                      <div className="text-center mt-2">
                        <div className="font-mono text-[11px] font-bold text-slate-200">{item.hz} Hz</div>
                        <div className="text-[9px] text-slate-400 truncate max-w-[80px]">{item.label.split(' ')[0]}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-cyan-400" /> Baseline Machine Harmonics
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-red-500" /> Bearing Defect Harmonic Peak (BPFO)
                  </span>
                </div>
                <div className="font-mono text-[11px] text-cyan-400">
                  Sampling Bandwidth: 0 - 500 Hz
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
