import React, { useEffect, useState } from 'react';
import { RadioTower, Wifi, Activity, Cpu, Server, CheckCircle2, AlertTriangle, ShieldCheck, RefreshCw, Layers } from 'lucide-react';
import { api } from '../../services/api';

export const IoTDevicesView: React.FC = () => {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDevices = () => {
    setLoading(true);
    api.getIoTDevices().then(res => {
      if (res.success) setDevices(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600">
              <RadioTower className="w-4 h-4" />
            </div>
            IoT Edge Gateways & Sensor Network
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Real-time status of industrial edge compute nodes, MQTT telemetry brokers, sampling rates, and sensor calibrations.
          </p>
        </div>
        <button
          onClick={fetchDevices}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh Nodes
        </button>
      </div>

      {/* Network KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Edge Gateways', value: `${devices.length} / ${devices.length}`, sub: '100% Operational', icon: <Server className="text-teal-600" />, bg: 'bg-teal-50' },
          { label: 'Broker Protocol', value: 'Mosquitto 2.0', sub: 'MQTT over TCP port 1883', icon: <Wifi className="text-blue-600" />, bg: 'bg-blue-50' },
          { label: 'Avg Ingestion Latency', value: '4.6 ms', sub: 'Sub-10ms SLA Compliant', icon: <Activity className="text-emerald-600" />, bg: 'bg-emerald-50' },
          { label: 'Network Packet Loss', value: '0.00%', sub: 'Zero Drop Reliability', icon: <ShieldCheck className="text-purple-600" />, bg: 'bg-purple-50' },
        ].map((card, i) => (
          <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3.5">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${card.bg}`}>
              {card.icon}
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase">{card.label}</div>
              <div className="text-lg font-extrabold text-slate-900 font-mono mt-0.5">{card.value}</div>
              <div className="text-[10px] font-semibold text-emerald-600">{card.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Edge Devices Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Gateway ID</th>
                <th className="py-3.5 px-4">Hardware Node</th>
                <th className="py-3.5 px-4">Target Asset</th>
                <th className="py-3.5 px-4">MQTT Telemetry Topic</th>
                <th className="py-3.5 px-4 text-center">Sample Rate</th>
                <th className="py-3.5 px-4 text-center">Latency</th>
                <th className="py-3.5 px-4">Sensors Connected</th>
                <th className="py-3.5 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {devices.map((gw) => (
                <tr key={gw.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-4 px-4 font-mono font-bold text-sm text-blue-600">
                    <span className="bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 inline-block">
                      {gw.id}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="font-bold text-slate-900 text-xs">{gw.name}</div>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">IP: {gw.ipAddress} • {gw.firmware}</div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="font-bold text-slate-800 text-xs">{gw.assetCode}</div>
                    <div className="text-[11px] text-slate-500">{gw.assetName}</div>
                  </td>
                  <td className="py-4 px-4 font-mono text-xs text-slate-600">
                    <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {gw.topic}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-center font-mono font-bold text-slate-800">
                    {gw.sampleRate}
                  </td>
                  <td className="py-4 px-4 text-center font-mono font-bold text-emerald-600">
                    {gw.latencyMs} ms
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {gw.sensors?.map((s: string, idx: number) => (
                        <span key={idx} className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                          {s}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      {gw.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
