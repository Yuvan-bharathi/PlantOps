import React, { useState } from 'react';
import { Settings, Shield, Sliders, Bell, Save, CheckCircle2, Lock, Cpu, DollarSign, Activity } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const [saved, setSaved] = useState(false);
  const [vibWarning, setVibWarning] = useState(5.0);
  const [vibFault, setVibFault] = useState(7.5);
  const [tempWarning, setTempWarning] = useState(70.0);
  const [tempFault, setTempFault] = useState(80.0);
  const [autoPoCap, setAutoPoCap] = useState(1000);
  const [minAiConfidence, setMinAiConfidence] = useState(85);
  const [slackWebhook, setSlackWebhook] = useState('https://hooks.slack.com/services/T00/B00/XXXX');
  const [emailAlerts, setEmailAlerts] = useState(true);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3500);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
              <Settings className="w-4 h-4" />
            </div>
            PlantOps Enterprise Configuration & Policies
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Deterministic state engine thresholds, autonomous procurement spend caps, and alert dispatch channels.
          </p>
        </div>

        {saved && (
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 animate-slide-in">
            <CheckCircle2 size={14} className="text-emerald-600" />
            Configuration Applied
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Section 1: Anomaly Detection Thresholds */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-100">
            <Sliders size={16} className="text-blue-600" />
            Deterministic State Machine Sensor Thresholds
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Vibration */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
              <div className="flex items-center justify-between font-bold text-slate-800">
                <span className="flex items-center gap-1.5">
                  <Activity size={14} className="text-blue-500" /> Radial Vibration Limits
                </span>
                <span className="font-mono text-slate-400">mm/s</span>
              </div>
              <div>
                <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                  <span>Warning Threshold:</span>
                  <span className="font-mono font-bold text-amber-600">{vibWarning} mm/s</span>
                </div>
                <input
                  type="range" min="2.0" max="8.0" step="0.5"
                  value={vibWarning}
                  onChange={(e) => setVibWarning(parseFloat(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                  <span>Fault / Incident Trigger:</span>
                  <span className="font-mono font-bold text-rose-600">{vibFault} mm/s</span>
                </div>
                <input
                  type="range" min="5.0" max="15.0" step="0.5"
                  value={vibFault}
                  onChange={(e) => setVibFault(parseFloat(e.target.value))}
                  className="w-full accent-rose-600"
                />
              </div>
            </div>

            {/* Temperature */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
              <div className="flex items-center justify-between font-bold text-slate-800">
                <span className="flex items-center gap-1.5">
                  <Cpu size={14} className="text-rose-500" /> Thermal Overheat Limits
                </span>
                <span className="font-mono text-slate-400">°C</span>
              </div>
              <div>
                <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                  <span>Warning Threshold:</span>
                  <span className="font-mono font-bold text-amber-600">{tempWarning} °C</span>
                </div>
                <input
                  type="range" min="50" max="85" step="1"
                  value={tempWarning}
                  onChange={(e) => setTempWarning(parseFloat(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                  <span>Fault / Incident Trigger:</span>
                  <span className="font-mono font-bold text-rose-600">{tempFault} °C</span>
                </div>
                <input
                  type="range" min="70" max="100" step="1"
                  value={tempFault}
                  onChange={(e) => setTempFault(parseFloat(e.target.value))}
                  className="w-full accent-rose-600"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Policy Engine & Procurement Spend Limits */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-100">
            <Shield size={16} className="text-indigo-600" />
            Autonomous Procurement Policy Guardrails (POL-01 / POL-02)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
              <div className="flex items-center justify-between font-bold text-slate-800">
                <span>Autonomous Auto-PO Spend Cap</span>
                <span className="font-mono font-extrabold text-blue-600">${autoPoCap.toLocaleString()} USD</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Purchases exceeding this threshold automatically escalate to the Plant Manager via Human-in-the-Loop Review.
              </p>
              <input
                type="range" min="200" max="5000" step="100"
                value={autoPoCap}
                onChange={(e) => setAutoPoCap(parseInt(e.target.value, 10))}
                className="w-full accent-blue-600"
              />
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
              <div className="flex items-center justify-between font-bold text-slate-800">
                <span>Min. AI Diagnosis Confidence</span>
                <span className="font-mono font-extrabold text-emerald-600">{minAiConfidence}%</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Autonomous orders are only allowed when the AI RAG diagnosis confidence score meets or exceeds this limit.
              </p>
              <input
                type="range" min="70" max="98" step="1"
                value={minAiConfidence}
                onChange={(e) => setMinAiConfidence(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-600"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Notification Channels */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-100">
            <Bell size={16} className="text-amber-500" />
            Alert Notification Integrations
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Slack / Microsoft Teams Webhook URL</label>
              <input
                type="text"
                value={slackWebhook}
                onChange={(e) => setSlackWebhook(e.target.value)}
                className="w-full font-mono text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="emailAlerts"
                checked={emailAlerts}
                onChange={(e) => setEmailAlerts(e.target.checked)}
                className="w-4 h-4 accent-blue-600 rounded"
              />
              <label htmlFor="emailAlerts" className="text-xs font-semibold text-slate-700 cursor-pointer">
                Send emergency email notifications to Lead Technicians on CRITICAL status breach
              </label>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all active:scale-95"
          >
            <Save size={14} />
            Save Configuration Changes
          </button>
        </div>
      </form>
    </div>
  );
};
