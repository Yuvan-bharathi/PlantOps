import React, { useState } from 'react';
import { 
  Activity, 
  Layers, 
  AlertTriangle, 
  Wrench, 
  PackageCheck, 
  ShoppingCart, 
  ShieldAlert, 
  BarChart3, 
  Play, 
  RotateCcw,
  Cpu,
  CheckCircle2
} from 'lucide-react';
import { api } from '../services/api';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pendingReviewsCount: number;
  activeFaultsCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  pendingReviewsCount,
  activeFaultsCount
}) => {
  const [injecting, setInjecting] = useState(false);
  const [healing, setHealing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleInjectFault = async (machineId = 'CNC-01') => {
    setInjecting(true);
    try {
      await api.injectFault(machineId, 'BEARING_WEAR', 1.0);
      showToast(`⚠️ Injected Spindle Bearing Wear Anomaly on ${machineId}! Closed loop initiated.`);
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setInjecting(false);
    }
  };

  const handleHealMachine = async (machineId = 'CNC-01') => {
    setHealing(true);
    try {
      await api.healMachine(machineId);
      showToast(`✅ Normalized telemetry on ${machineId}. Verification engine observing...`);
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setHealing(false);
    }
  };

  const navItems = [
    { id: 'twin', label: '3D Digital Twin', icon: Layers },
    { id: 'timeline', label: 'Incident Timeline', icon: AlertTriangle, badge: activeFaultsCount },
    { id: 'maintenance', label: 'Work Orders & LOTO', icon: Wrench },
    { id: 'inventory', label: 'Inventory & ATP', icon: PackageCheck },
    { id: 'procurement', label: 'Procurement & POs', icon: ShoppingCart },
    { id: 'review', label: 'Human Review', icon: ShieldAlert, badge: pendingReviewsCount, badgeColor: 'bg-amber-500' },
    { id: 'domo', label: 'Domo Analytics', icon: BarChart3 }
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#0B0F19]/90 backdrop-blur-md">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-medium py-1.5 px-4 text-center flex items-center justify-center gap-2 shadow-lg animate-pulse">
          <Activity className="w-3.5 h-3.5" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500 p-0.5 shadow-lg shadow-blue-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Cpu className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-wider text-white">
                  PLANT<span className="text-cyan-400">OPS</span>
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 tracking-widest uppercase">
                  v2.0 MVP
                </span>
              </div>
              <p className="text-[11px] text-slate-400 tracking-tight hidden sm:block">
                Predictive Maintenance & Autonomous Procurement
              </p>
            </div>
          </div>

          {/* Quick Demo Simulator Trigger Controls */}
          <div className="hidden md:flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-xl p-1 shadow-inner">
            <span className="text-[11px] font-semibold text-slate-400 px-2 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              Simulator:
            </span>
            <button
              onClick={() => handleInjectFault('CNC-01')}
              disabled={injecting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-all duration-200 active:scale-95 disabled:opacity-50"
            >
              <Play className="w-3 h-3 text-rose-400 fill-rose-400" />
              <span>Simulate CNC-01 Fault</span>
            </button>
            <button
              onClick={() => handleHealMachine('CNC-01')}
              disabled={healing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition-all duration-200 active:scale-95 disabled:opacity-50"
            >
              <RotateCcw className="w-3 h-3 text-emerald-400" />
              <span>Restore Baseline</span>
            </button>
          </div>

          {/* System Pulse Indicator */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono">MQTT Live</span>
            </div>
          </div>

        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-2 border-t border-slate-800/60">
          {navItems.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-150 ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-sm shadow-blue-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    tab.badgeColor ? `${tab.badgeColor} text-slate-950` : 'bg-rose-500 text-white animate-pulse'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
