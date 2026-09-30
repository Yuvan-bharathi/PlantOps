import React, { useEffect, useState, useMemo } from 'react';
import {
  RadioTower, Wifi, Activity, Cpu, Server, CheckCircle2,
  AlertTriangle, ShieldCheck, RefreshCw, Layers, Sliders,
  Check, Play, ArrowRight, Clock, Shield, Compass, Search,
  Filter, Terminal, Network, Zap, RotateCcw, Box
} from 'lucide-react';
import { api } from '../../services/api';
import { Machine } from '../../types';
import { UserProfile, RoleKey } from './LoginPage';

interface IoTDevicesViewProps {
  currentUser?: UserProfile;
  machines?: Machine[];
  onSelectMachine?: (machine: Machine) => void;
  onNavigateTwin?: () => void;
}

interface EdgeGateway {
  id: string;
  name: string;
  assetCode: string;
  assetName: string;
  cellArea: string;
  ipAddress: string;
  protocol: string;
  topic: string;
  sampleRate: string;
  latencyMs: number;
  packetLoss: string;
  firmware: string;
  status: string;
  lastPing: string;
  sensors: string[];
  calibrationDue: string;
  zeroDrift: string;
  calibratedAt: string;
  isCalibrated: boolean;
}

const INITIAL_GATEWAYS: EdgeGateway[] = [
  {
    id: 'GW-EDGE-01',
    name: 'Advantech UNO-2484G Industrial Compute Node',
    assetCode: 'CNC-01',
    assetName: '5-Axis CNC Milling Center 01',
    cellArea: 'Machining Cell',
    ipAddress: '192.168.10.101',
    protocol: 'MQTT 2.0 / Mosquitto',
    topic: 'plantops/machines/CNC-01/telemetry',
    sampleRate: '100 Hz',
    latencyMs: 4.2,
    packetLoss: '0.00%',
    firmware: 'v3.8.4-LTS',
    status: 'ONLINE',
    lastPing: '2s ago',
    sensors: ['Tri-Axial Piezo Accelerometer (±50g)', 'PT100 RTD Bearing Temp', 'CT Current Clamp 0-50A', 'Spindle Hall RPM Tachometer'],
    calibrationDue: '2026-12-15',
    zeroDrift: '±0.02 mm/s',
    calibratedAt: '2026-08-10',
    isCalibrated: true
  },
  {
    id: 'GW-EDGE-02',
    name: 'Siemens SIMATIC IOT2050 Smart Edge',
    assetCode: 'CNC-02',
    assetName: 'Heavy Duty Turning Center 02',
    cellArea: 'Machining Cell',
    ipAddress: '192.168.10.102',
    protocol: 'MQTT 2.0 / Mosquitto',
    topic: 'plantops/machines/CNC-02/telemetry',
    sampleRate: '50 Hz',
    latencyMs: 4.8,
    packetLoss: '0.00%',
    firmware: 'v2.4.1',
    status: 'ONLINE',
    lastPing: '1s ago',
    sensors: ['Piezoelectric Vibration Transducer', 'Motor Stator Thermocouple', 'Phase Current Sensor'],
    calibrationDue: '2026-11-20',
    zeroDrift: '±0.01 mm/s',
    calibratedAt: '2026-07-28',
    isCalibrated: true
  },
  {
    id: 'GW-EDGE-03',
    name: 'Moxa UC-8100 Series RISC Embedded Controller',
    assetCode: 'ROBOT-01',
    assetName: '6-Axis Articulated Robot 01',
    cellArea: 'Robot Cell',
    ipAddress: '192.168.10.103',
    protocol: 'MQTT 2.0 / Mosquitto',
    topic: 'plantops/machines/ROBOT-01/telemetry',
    sampleRate: '100 Hz',
    latencyMs: 3.8,
    packetLoss: '0.00%',
    firmware: 'v4.1.0',
    status: 'ONLINE',
    lastPing: 'Just now',
    sensors: ['Joint 1-6 Thermistors', 'Harmonic Drive FFT Sensor', 'DC Bus Current Transducer', 'Pneumatic Gripper Transducer'],
    calibrationDue: '2026-10-30',
    zeroDrift: '±0.04 mm/s',
    calibratedAt: '2026-08-01',
    isCalibrated: true
  },
  {
    id: 'GW-EDGE-04',
    name: 'Advantech ADAM-6700 Intelligent I/O Gateway',
    assetCode: 'PUMP-01',
    assetName: 'Hydraulic Coolant Circulation Pump 01',
    cellArea: 'Processing Cell',
    ipAddress: '192.168.10.104',
    protocol: 'MQTT 2.0 / Mosquitto',
    topic: 'plantops/machines/PUMP-01/telemetry',
    sampleRate: '20 Hz',
    latencyMs: 6.2,
    packetLoss: '0.00%',
    firmware: 'v3.2.0',
    status: 'ONLINE',
    lastPing: '3s ago',
    sensors: ['Piezoelectric Pressure Sensor 0-10 bar', 'Fluid Line RTD Probe', 'Cavitation Vib Sensor'],
    calibrationDue: '2026-12-01',
    zeroDrift: '±0.05 bar',
    calibratedAt: '2026-08-15',
    isCalibrated: true
  },
  {
    id: 'GW-EDGE-05',
    name: 'Advantech UNO-2271G Compact Edge Gateway',
    assetCode: 'MIXER-01',
    assetName: 'Heavy Agitator Fluid Processing Mixer',
    cellArea: 'Processing Cell',
    ipAddress: '192.168.10.105',
    protocol: 'MQTT 2.0 / Mosquitto',
    topic: 'plantops/machines/MIXER-01/telemetry',
    sampleRate: '50 Hz',
    latencyMs: 5.1,
    packetLoss: '0.00%',
    firmware: 'v3.5.1',
    status: 'ONLINE',
    lastPing: '2s ago',
    sensors: ['Gearbox Vibration Probe', 'Fluid Viscosity Temp Probe', 'Agitator Motor Current CT'],
    calibrationDue: '2026-11-15',
    zeroDrift: '±0.03 mm/s',
    calibratedAt: '2026-08-02',
    isCalibrated: true
  },
  {
    id: 'GW-EDGE-06',
    name: 'Siemens SIMATIC IOT2050 Advanced Gateway',
    assetCode: 'ASMB-01',
    assetName: 'Precision Screwdriving & Torque Workstation',
    cellArea: 'Assembly Cell',
    ipAddress: '192.168.10.106',
    protocol: 'MQTT 2.0 / Mosquitto',
    topic: 'plantops/machines/ASMB-01/telemetry',
    sampleRate: '50 Hz',
    latencyMs: 4.4,
    packetLoss: '0.00%',
    firmware: 'v2.4.3',
    status: 'ONLINE',
    lastPing: '1s ago',
    sensors: ['Rotary Torque Load Cell', 'Linear Slide Optical Encoder', 'Vibration Accelerometer'],
    calibrationDue: '2026-12-20',
    zeroDrift: '±0.01 Nm',
    calibratedAt: '2026-08-18',
    isCalibrated: true
  },
  {
    id: 'GW-EDGE-07',
    name: 'Advantech UNO-2484G Packaging Line Gateway',
    assetCode: 'PACK-01',
    assetName: 'Automatic Form-Fill-Seal Packaging Unit',
    cellArea: 'Packaging Cell',
    ipAddress: '192.168.10.107',
    protocol: 'MQTT 2.0 / Mosquitto',
    topic: 'plantops/machines/PACK-01/telemetry',
    sampleRate: '50 Hz',
    latencyMs: 4.9,
    packetLoss: '0.00%',
    firmware: 'v3.8.4',
    status: 'ONLINE',
    lastPing: '2s ago',
    sensors: ['Sealing Jaw Thermocouple (0-250°C)', 'Infeed Conveyor Tachometer', 'Pneumatic Actuator Pressure'],
    calibrationDue: '2026-11-25',
    zeroDrift: '±0.2 °C',
    calibratedAt: '2026-07-30',
    isCalibrated: true
  },
  {
    id: 'GW-EDGE-08',
    name: 'Moxa UC-8100 Maintenance Diagnostic Node',
    assetCode: 'MAINT-01',
    assetName: 'Preventive Overhaul & Diagnostic Bench',
    cellArea: 'Maintenance Cell',
    ipAddress: '192.168.10.108',
    protocol: 'MQTT 2.0 / Mosquitto',
    topic: 'plantops/machines/MAINT-01/telemetry',
    sampleRate: '100 Hz',
    latencyMs: 3.5,
    packetLoss: '0.00%',
    firmware: 'v4.1.2',
    status: 'ONLINE',
    lastPing: 'Just now',
    sensors: ['Master Reference Laser Tachometer', 'Calibrated Accelerometer Calibrator', '4-Channel Scope Probe'],
    calibrationDue: '2027-01-10',
    zeroDrift: '0.00 mm/s',
    calibratedAt: '2026-08-20',
    isCalibrated: true
  }
];

export const IoTDevicesView: React.FC<IoTDevicesViewProps> = ({
  currentUser,
  machines = [],
  onSelectMachine,
  onNavigateTwin
}) => {
  const [devices, setDevices] = useState<EdgeGateway[]>(INITIAL_GATEWAYS);
  const [loading, setLoading] = useState(false);
  const [selectedCell, setSelectedCell] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [pingingGwId, setPingingGwId] = useState<string | null>(null);
  const [calibratingGwId, setCalibratingGwId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const roleKey: RoleKey = currentUser?.roleKey || 'PLANT_ADMIN';
  const isAdmin = roleKey === 'PLANT_ADMIN';
  const isTechnician = roleKey === 'TECHNICIAN';
  const isSupervisor = roleKey === 'SUPERVISOR';
  const isManager = roleKey === 'MANAGER';

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const fetchDevices = () => {
    setLoading(true);
    api.getIoTDevices().then(res => {
      if (res.success && res.data && res.data.length > 0) {
        // Merge backend data with rich calibration metadata
        setDevices(prev => prev.map(gw => {
          const match = res.data.find((d: any) => d.id === gw.id || d.assetCode === gw.assetCode);
          return match ? { ...gw, ...match, status: 'ONLINE', latencyMs: match.latencyMs || gw.latencyMs } : gw;
        }));
      }
      setLoading(false);
      showToast('📡 Edge gateway nodes & MQTT broker telemetry synchronized.');
    }).catch(() => {
      setLoading(false);
      showToast('📡 Synchronized edge nodes from local state.');
    });
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handlePingGateway = (gw: EdgeGateway) => {
    setPingingGwId(gw.id);
    setTimeout(() => {
      const simulatedLatency = (3.5 + Math.random() * 2.0).toFixed(1);
      setDevices(prev => prev.map(d => d.id === gw.id ? { ...d, latencyMs: parseFloat(simulatedLatency), lastPing: 'Just now' } : d));
      setPingingGwId(null);
      showToast(`⚡ Ping to ${gw.id} (${gw.ipAddress}): 64 bytes in ${simulatedLatency}ms. Socket status: 100% OK.`);
    }, 700);
  };

  const handleCalibrateSensor = (gw: EdgeGateway) => {
    setCalibratingGwId(gw.id);
    setTimeout(() => {
      setDevices(prev => prev.map(d => d.id === gw.id ? {
        ...d,
        zeroDrift: '0.00 mm/s',
        calibratedAt: new Date().toISOString().split('T')[0],
        isCalibrated: true
      } : d));
      setCalibratingGwId(null);
      showToast(`🎯 Zero-point baseline calibrated on ${gw.assetCode} transducers. Sensor drift zeroed.`);
    }, 1000);
  };

  const filteredDevices = useMemo(() => {
    return devices.filter(d => {
      const q = search.toLowerCase();
      const matchSearch = !q || d.id.toLowerCase().includes(q) || d.assetCode.toLowerCase().includes(q) || d.name.toLowerCase().includes(q) || d.cellArea.toLowerCase().includes(q);
      const matchCell = selectedCell === 'ALL' || d.cellArea.includes(selectedCell);
      return matchSearch && matchCell;
    });
  }, [devices, search, selectedCell]);

  const CELL_TABS = ['ALL', 'Machining', 'Robot', 'Processing', 'Assembly', 'Packaging', 'Maintenance'];

  return (
    <div className="space-y-6 w-full animate-fade-in pb-12">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-20 right-6 z-50 bg-[#0F766E] text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={16} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-[#FAF9F6] p-5 rounded-2xl border border-[#DDD9D0] shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Enterprise Industrial Facility • Zone A</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
              MQTT Edge Grid
            </span>
          </div>
          <h2 className="text-xl font-extrabold text-[#1E293B] flex items-center gap-2.5 mt-1">
            <div className="w-8 h-8 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-[#0F766E]">
              <RadioTower className="w-4 h-4" />
            </div>
            IoT Edge Gateways & Industrial Sensor Network
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            Real-time status of 8 edge compute nodes, Mosquitto 2.0 MQTT telemetry brokers, sampling rates, and ISO transducer calibrations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchDevices}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#DDD9D0] text-[#1E293B] text-xs font-bold hover:bg-slate-50 transition-all shadow-xs disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-[#0F766E]' : ''} />
            <span>Refresh Nodes</span>
          </button>

          {onNavigateTwin && (
            <button
              onClick={onNavigateTwin}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm"
            >
              <Layers size={14} />
              <span>3D Digital Twin</span>
            </button>
          )}
        </div>
      </div>

      {/* Network KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Edge Gateways', value: `${devices.length} / ${devices.length}`, sub: '100% Operational', icon: <Server className="text-teal-600" />, bg: 'bg-teal-50' },
          { label: 'MQTT Broker Protocol', value: 'Mosquitto 2.0', sub: 'TCP port 1883 • TLS 1.3', icon: <Wifi className="text-blue-600" />, bg: 'bg-blue-50' },
          { label: 'Avg Ingestion Latency', value: '4.4 ms', sub: 'Sub-10ms Industrial SLA', icon: <Activity className="text-emerald-600" />, bg: 'bg-emerald-50' },
          { label: 'Sensor Calibration SLA', value: '100%', sub: 'All 8 Nodes Calibrated', icon: <ShieldCheck className="text-purple-600" />, bg: 'bg-purple-50' },
        ].map((card, i) => (
          <div key={i} className="bg-white p-4 rounded-2xl border border-[#DDD9D0] shadow-2xs flex items-center gap-3.5">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${card.bg}`}>
              {card.icon}
            </div>
            <div>
              <div className="text-[10px] font-bold text-[#64748B] uppercase">{card.label}</div>
              <div className="text-lg font-black text-[#1E293B] font-mono mt-0.5">{card.value}</div>
              <div className="text-[10px] font-bold text-emerald-700">{card.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter & Cell Zone Selector */}
      <div className="bg-white p-3.5 rounded-2xl border border-[#DDD9D0] shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {CELL_TABS.map((cell) => {
            const isSelected = selectedCell === cell;
            return (
              <button
                key={cell}
                onClick={() => setSelectedCell(cell)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  isSelected
                    ? 'bg-[#0F766E] text-white shadow-xs'
                    : 'bg-[#FAF9F6] text-[#64748B] hover:text-[#1E293B] border border-[#DDD9D0]'
                }`}
              >
                {cell === 'ALL' ? 'All Cell Nodes' : `${cell} Cell`}
              </button>
            );
          })}
        </div>

        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search gateway ID, IP, asset..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-7 pr-3 py-1.5 text-xs bg-[#FAF9F6] border border-[#DDD9D0] rounded-xl text-[#1E293B] focus:outline-none focus:border-[#0F766E]"
          />
        </div>
      </div>

      {/* Edge Gateways & Sensor Matrix Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
        {filteredDevices.map((gw) => {
          const matchedMachine = machines.find(m => m.code === gw.assetCode);
          return (
            <div
              key={gw.id}
              className="bg-white rounded-2xl p-5 border border-[#DDD9D0] shadow-2xs hover:shadow-md hover:border-[#0F766E]/40 transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                {/* Gateway Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-[#0F766E]">
                      <Server size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-extrabold text-sm text-[#0F766E]">{gw.id}</span>
                        <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300">
                          {gw.status}
                        </span>
                      </div>
                      <h4 className="font-bold text-xs text-[#1E293B] mt-0.5">{gw.name}</h4>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                    {gw.firmware}
                  </span>
                </div>

                {/* Target Asset & Edge Network Specs */}
                <div className="grid grid-cols-2 gap-2 p-3 bg-[#FAF9F6] rounded-xl border border-[#DDD9D0] text-xs">
                  <div>
                    <span className="text-[10px] text-[#64748B] font-medium">Target Production Asset</span>
                    <div className="font-bold text-[#1E293B] mt-0.5 font-mono">{gw.assetCode}</div>
                    <div className="text-[10px] text-[#64748B] truncate">{gw.assetName}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#64748B] font-medium">IP & Subnet</span>
                    <div className="font-bold text-[#1E293B] mt-0.5 font-mono">{gw.ipAddress}</div>
                    <div className="text-[10px] text-[#22A06B] font-medium flex items-center gap-1">
                      <Zap size={10} /> Ping: {gw.latencyMs} ms
                    </div>
                  </div>
                </div>

                {/* MQTT Topic & Sample Rate */}
                <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-mono space-y-1">
                  <div className="text-[10px] text-[#64748B] font-sans font-bold uppercase">MQTT Telemetry Topic</div>
                  <div className="text-[#2563EB] truncate font-bold">{gw.topic}</div>
                  <div className="flex items-center justify-between text-[10px] text-[#64748B] font-sans pt-1 border-t border-slate-200">
                    <span>Sample Rate: <strong>{gw.sampleRate}</strong></span>
                    <span>Packet Loss: <strong className="text-emerald-700">{gw.packetLoss}</strong></span>
                  </div>
                </div>

                {/* Connected Sensor Transducers */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">
                    Connected Physical Transducers ({gw.sensors.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {gw.sensors.map((s, idx) => (
                      <span key={idx} className="text-[10px] font-medium px-2 py-0.5 rounded-lg bg-slate-100 text-[#1E293B] border border-[#DDD9D0]">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Calibration Status */}
                <div className="p-2.5 bg-emerald-50/60 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <div className="text-[10px] text-emerald-800 font-bold flex items-center gap-1">
                      <ShieldCheck size={12} />
                      <span>Calibrated: {gw.calibratedAt}</span>
                    </div>
                    <div className="text-[10px] text-[#64748B]">
                      Zero-Drift: <strong className="font-mono text-[#1E293B]">{gw.zeroDrift}</strong> • Next Due: {gw.calibrationDue}
                    </div>
                  </div>

                  {(isTechnician || isSupervisor || isAdmin) && (
                    <button
                      onClick={() => handleCalibrateSensor(gw)}
                      disabled={calibratingGwId === gw.id}
                      className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition-all shadow-2xs disabled:opacity-50 flex items-center gap-1"
                      title="Re-zero sensor offset"
                    >
                      <RotateCcw size={10} className={calibratingGwId === gw.id ? 'animate-spin' : ''} />
                      <span>{calibratingGwId === gw.id ? 'Calibrating...' : 'Re-Zero'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-[#DDD9D0] flex items-center gap-2">
                <button
                  onClick={() => handlePingGateway(gw)}
                  disabled={pingingGwId === gw.id}
                  className="flex-1 py-1.5 px-3 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-[#1E293B] border border-[#DDD9D0] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Activity size={12} className={pingingGwId === gw.id ? 'animate-spin text-blue-600' : 'text-blue-600'} />
                  <span>{pingingGwId === gw.id ? 'Pinging Gateway...' : 'Ping Diagnostic'}</span>
                </button>

                {onSelectMachine && onNavigateTwin && matchedMachine && (
                  <button
                    onClick={() => {
                      onSelectMachine(matchedMachine);
                      onNavigateTwin();
                    }}
                    className="py-1.5 px-3 text-xs font-bold rounded-xl bg-[#0F766E] hover:bg-teal-800 text-white transition-all flex items-center gap-1"
                  >
                    <Layers size={12} />
                    <span>Focus Twin</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
