import React, { useState, useEffect } from 'react';
import { 
  Activity, Gauge, Flame, Zap, Clock, RefreshCw, 
  TrendingUp, AlertTriangle, CheckCircle2, Sliders, Calendar,
  Download, Filter, ChevronRight, Cpu, RadioTower
} from 'lucide-react';
import { Machine, TelemetryData } from '../../types';

interface TelemetryViewProps {
  machines: Machine[];
  telemetryMap: Record<string, TelemetryData>;
}

export const TelemetryView: React.FC<TelemetryViewProps> = ({ machines, telemetryMap }) => {
  const [selectedMachineCode, setSelectedMachineCode] = useState<string>('CNC-01');
  const [timeRange, setTimeRange] = useState<'1H' | '6H' | '24H' | '7D' | 'CUSTOM'>('1H');
  const [selectedMetric, setSelectedMetric] = useState<'VIBRATION' | 'TEMPERATURE' | 'CURRENT' | 'RPM' | 'PRESSURE'>('VIBRATION');

  const selectedMachine = machines.find(m => m.code === selectedMachineCode) || machines[0];
  const liveTelemetry = telemetryMap[selectedMachineCode] || {
    machineId: selectedMachineCode,
    vibration: selectedMachine?.code === 'CNC-01' ? 9.4 : 2.1,
    temperature: selectedMachine?.code === 'CNC-01' ? 82.4 : 58.2,
    current: 14.2,
    timestamp: Date.now()
  };

  // Generate realistic historical points based on selected time range
  const generateHistory = () => {
    const pointsCount = timeRange === '1H' ? 12 : timeRange === '6H' ? 18 : timeRange === '24H' ? 24 : 14;
    const isFaulty = selectedMachine?.status === 'FAULT';
    const isWarn = selectedMachine?.status === 'WARNING';
    
    return Array.from({ length: pointsCount }, (_, i) => {
      const progress = i / (pointsCount - 1);
      const spikeFactor = (isFaulty && progress > 0.6) ? (progress - 0.6) * 4 : 0;
      
      const baseVib = isFaulty ? 2.5 + spikeFactor * 2.2 : isWarn ? 4.2 : 2.0;
      const baseTemp = isFaulty ? 58 + spikeFactor * 8.0 : isWarn ? 68 : 55;
      const baseCurr = isFaulty ? 11.5 + spikeFactor * 1.5 : 12.0;
      const baseRpm = 2800 - (spikeFactor * 120);

      const timeLabel = timeRange === '1H' ? `${(i * 5)}m ago` :
        timeRange === '6H' ? `${(i * 20)}m ago` :
        timeRange === '24H' ? `${i}:00` : `Day ${i + 1}`;

      return {
        time: timeLabel,
        vibration: parseFloat((baseVib + (Math.sin(i) * 0.3)).toFixed(2)),
        temperature: parseFloat((baseTemp + (Math.cos(i) * 0.8)).toFixed(1)),
        current: parseFloat((baseCurr + (Math.sin(i * 2) * 0.2)).toFixed(1)),
        rpm: Math.round(baseRpm + Math.sin(i) * 20),
        pressure: parseFloat((6.2 - (isFaulty && progress > 0.6 ? 1.8 : 0) + Math.cos(i) * 0.1).toFixed(2)),
        isAnomaly: isFaulty && progress > 0.6
      };
    });
  };

  const historyData = generateHistory();

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="bg-[#FAF9F6] p-5 rounded-2xl border border-[#DDD9D0] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#1E293B] flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#2563EB]/10 border border-[#2563EB]/20 flex items-center justify-center text-[#2563EB]">
              <Activity className="w-4 h-4" />
            </div>
            Sensor Telemetry & Time-Series Diagnostics
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            Real-time IoT edge streams, spectral vibration profiles, thermal curves, and predictive degradation analysis.
          </p>
        </div>

        {/* Controls Bar */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex bg-[#EAE7E0] p-1 rounded-xl border border-[#DDD9D0]">
            {(['1H', '6H', '24H', '7D'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  timeRange === range
                    ? 'bg-[#2563EB] text-white shadow-sm'
                    : 'text-[#64748B] hover:text-[#1E293B]'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Machine Selector Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {machines.map((machine) => {
          const isSelected = machine.code === selectedMachineCode;
          const statusBg = machine.status === 'FAULT' ? 'bg-[#FCECEB] text-[#D64545] border-[#F6BEBC]' :
            machine.status === 'WARNING' ? 'bg-[#FEF7E6] text-[#D99A06] border-[#F8DF9E]' :
            'bg-[#E8F6EF] text-[#22A06B] border-[#B4E3CF]';

          return (
            <button
              key={machine.code}
              onClick={() => setSelectedMachineCode(machine.code)}
              className={`p-3.5 rounded-2xl text-left border transition-all ${
                isSelected 
                  ? 'bg-[#FAF9F6] border-[#2563EB] ring-2 ring-[#2563EB]/20 shadow-sm' 
                  : 'bg-[#FAF9F6] border-[#DDD9D0] hover:bg-[#EAE7E0]'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-extrabold text-xs text-[#1E293B]">{machine.code}</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${statusBg}`}>
                  {machine.status}
                </span>
              </div>
              <div className="text-[11px] text-[#64748B] truncate">{machine.name}</div>
              <div className="mt-2.5 flex items-center justify-between text-[10px] text-[#64748B] pt-2 border-t border-[#DDD9D0]">
                <span>Health Score</span>
                <span className="font-mono font-bold text-[#1E293B]">{machine.health_score}%</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Live Sensor Gauges for Selected Machine */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gauge 1: Vibration */}
        <div className={`bg-[#FAF9F6] border rounded-2xl p-4 shadow-sm ${liveTelemetry.vibration > 7.0 ? 'border-[#D64545] bg-[#FCECEB]/30' : 'border-[#DDD9D0]'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#64748B] flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-[#2563EB]" /> Radial Vibration
            </span>
            <span className="text-[10px] bg-[#EAE7E0] text-[#334155] px-1.5 py-0.5 rounded font-mono font-bold">
              ISO 10816
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#1E293B] font-mono">{liveTelemetry.vibration}</span>
            <span className="text-xs text-[#64748B]">mm/s RMS</span>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-[10px] text-[#64748B] mb-1">
              <span>Threshold (4.5 mm/s)</span>
              <span className={liveTelemetry.vibration > 4.5 ? 'text-[#D64545] font-bold' : 'text-[#22A06B]'}>
                {liveTelemetry.vibration > 7.0 ? 'CRITICAL' : liveTelemetry.vibration > 4.5 ? 'WARNING' : 'NOMINAL'}
              </span>
            </div>
            <div className="w-full h-2 bg-[#EAE7E0] rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  liveTelemetry.vibration > 7.0 ? 'bg-[#D64545]' : liveTelemetry.vibration > 4.5 ? 'bg-[#D99A06]' : 'bg-[#22A06B]'
                }`}
                style={{ width: `${Math.min((liveTelemetry.vibration / 12) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Gauge 2: Temperature */}
        <div className={`bg-[#FAF9F6] border rounded-2xl p-4 shadow-sm ${liveTelemetry.temperature > 80 ? 'border-[#D64545] bg-[#FCECEB]/30' : 'border-[#DDD9D0]'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#64748B] flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-500" /> Bearing Temp
            </span>
            <span className="text-[10px] bg-[#EAE7E0] text-[#334155] px-1.5 py-0.5 rounded font-mono font-bold">
              PT100 RTD
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#1E293B] font-mono">{liveTelemetry.temperature}</span>
            <span className="text-xs text-[#64748B]">°C</span>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-[10px] text-[#64748B] mb-1">
              <span>Threshold (75.0 °C)</span>
              <span className={liveTelemetry.temperature > 75 ? 'text-[#D64545] font-bold' : 'text-[#22A06B]'}>
                {liveTelemetry.temperature > 80 ? 'CRITICAL' : liveTelemetry.temperature > 75 ? 'ELEVATED' : 'NOMINAL'}
              </span>
            </div>
            <div className="w-full h-2 bg-[#EAE7E0] rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  liveTelemetry.temperature > 80 ? 'bg-[#D64545]' : liveTelemetry.temperature > 75 ? 'bg-[#D99A06]' : 'bg-[#22A06B]'
                }`}
                style={{ width: `${Math.min((liveTelemetry.temperature / 100) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Gauge 3: Motor Current */}
        <div className="bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#64748B] flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#2563EB]" /> Phase Current
            </span>
            <span className="text-[10px] bg-[#EAE7E0] text-[#334155] px-1.5 py-0.5 rounded font-mono font-bold">
              CT-Sensor
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#1E293B] font-mono">{liveTelemetry.current || 14.2}</span>
            <span className="text-xs text-[#64748B]">Amperes (A)</span>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-[10px] text-[#64748B] mb-1">
              <span>Rated Current (16.0 A)</span>
              <span className="text-[#22A06B] font-bold">STABLE</span>
            </div>
            <div className="w-full h-2 bg-[#EAE7E0] rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#2563EB] rounded-full transition-all duration-500"
                style={{ width: `${Math.min(((liveTelemetry.current || 14.2) / 20) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Gauge 4: Spindle Speed / Pressure */}
        <div className="bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#64748B] flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-[#0F766E]" /> Spindle Velocity
            </span>
            <span className="text-[10px] bg-[#EAE7E0] text-[#334155] px-1.5 py-0.5 rounded font-mono font-bold">
              Encoder
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#1E293B] font-mono">2,800</span>
            <span className="text-xs text-[#64748B]">RPM</span>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-[10px] text-[#64748B] mb-1">
              <span>Target: 3,000 RPM</span>
              <span className="text-[#22A06B] font-bold">SYNCHRONIZED</span>
            </div>
            <div className="w-full h-2 bg-[#EAE7E0] rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#0F766E] rounded-full transition-all duration-500"
                style={{ width: '93%' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Historical Trend Chart & Degradation Analysis */}
      <div className="bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-[#1E293B] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#2563EB]" />
              Time-Series Degradation Curve: {selectedMachine?.name} ({selectedMachineCode})
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5">
              Comparative multi-sensor traces plotted across sampling windows with auto anomaly detection
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-[#EAE7E0] p-1 rounded-xl border border-[#DDD9D0]">
            {(['VIBRATION', 'TEMPERATURE', 'CURRENT', 'RPM'] as const).map((metric) => (
              <button
                key={metric}
                onClick={() => setSelectedMetric(metric)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  selectedMetric === metric
                    ? 'bg-[#2563EB] text-white shadow-sm'
                    : 'text-[#64748B] hover:text-[#1E293B]'
                }`}
              >
                {metric}
              </button>
            ))}
          </div>
        </div>

        {/* Visual Bar / Line Chart representation */}
        <div className="bg-white p-5 rounded-xl border border-[#DDD9D0]">
          <div className="h-64 flex items-end justify-between gap-2 pt-6">
            {historyData.map((d, i) => {
              const val = selectedMetric === 'VIBRATION' ? d.vibration :
                selectedMetric === 'TEMPERATURE' ? d.temperature :
                selectedMetric === 'CURRENT' ? d.current : d.rpm;

              const maxVal = selectedMetric === 'VIBRATION' ? 12 :
                selectedMetric === 'TEMPERATURE' ? 100 :
                selectedMetric === 'CURRENT' ? 20 : 3200;

              const heightPct = Math.min((val / maxVal) * 100, 100);

              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group relative">
                  {/* Tooltip on Hover */}
                  <div className="absolute -top-10 opacity-0 group-hover:opacity-100 bg-[#1E293B] text-white text-[10px] px-2 py-1 rounded-md shadow-lg pointer-events-none transition-opacity whitespace-nowrap z-20">
                    {d.time}: {val} {selectedMetric === 'VIBRATION' ? 'mm/s' : selectedMetric === 'TEMPERATURE' ? '°C' : selectedMetric === 'CURRENT' ? 'A' : 'RPM'}
                  </div>

                  {/* Anomaly Flag */}
                  {d.isAnomaly && (
                    <div className="w-2 h-2 rounded-full bg-[#D64545] animate-ping mb-1" />
                  )}

                  {/* Bar */}
                  <div 
                    className={`w-full rounded-t-lg transition-all duration-300 ${
                      d.isAnomaly 
                        ? 'bg-[#D64545]' 
                        : selectedMetric === 'VIBRATION' ? 'bg-[#2563EB]' :
                          selectedMetric === 'TEMPERATURE' ? 'bg-amber-500' : 'bg-[#0F766E]'
                    }`}
                    style={{ height: `${heightPct}%` }}
                  />

                  {/* X Axis Label */}
                  <span className="text-[9px] text-[#64748B] truncate w-full text-center mt-1">
                    {d.time}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-[#DDD9D0] flex flex-wrap items-center justify-between text-xs text-[#64748B]">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" /> Normal Telemetry
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#D64545]" /> Anomaly Trigger Zone
              </span>
            </div>
            <div className="font-mono text-[11px]">
              MQTT Rate: 10 Hz &bull; Protocol: TCP/1883 &bull; Packet Loss: 0.00%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
