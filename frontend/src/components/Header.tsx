import React from 'react';
import { Search, Bell, Wifi, ChevronDown, ShieldCheck, User } from 'lucide-react';
import { UserProfile } from './Operations/LoginPage';

interface HeaderProps {
  activeTab: string;
  pendingReviewsCount: number;
  activeFaultsCount: number;
  collapsed?: boolean;
  currentUser?: UserProfile;
  onOpenLogin?: () => void;
}

const pageTitles: Record<string, string> = {
  login: 'RBAC Authentication & Persona Selector',
  dashboard: 'Operations Command Center',
  twin: '3D Industrial Digital Twin',
  machines: 'Asset Monitoring & Health Register',
  iot: 'Virtual IoT Edge Gateways & Nodes',
  telemetry: 'Multi-Sensor Telemetry & Degradation Curves',
  incidents: 'Closed-Loop Incident Lifecycle Timeline',
  maintenance: 'Preventative & Corrective Maintenance Planning',
  'work-orders': 'Maintenance Work Orders & OSHA LOTO Queue',
  technicians: 'Technicians Roster & Certified Skills Matrix',
  inventory: 'MRO Spare Parts & Available-To-Promise (ATP)',
  procurement: 'Autonomous Procurement & Purchase Orders',
  suppliers: 'Supplier Directory & SLA Performance Ratings',
  review: 'Human-in-the-Loop Decision & Approval Center',
  ai: 'AI Predictive Diagnosis & Transparent Agent Ledger',
  domo: 'Domo Business Analytics & Compliance Export',
  settings: 'System Administration & Governance Settings',
};

const now = new Date();
const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

export const Header: React.FC<HeaderProps> = ({ 
  activeTab, 
  pendingReviewsCount, 
  activeFaultsCount, 
  collapsed = false,
  currentUser,
  onOpenLogin
}) => {
  const totalAlerts = activeFaultsCount + pendingReviewsCount;
  const leftClass = collapsed ? 'left-16' : 'left-60';

  return (
    <header className={`fixed ${leftClass} right-0 top-0 z-20 h-16 bg-[#FAF9F6] border-b border-[#DDD9D0] flex items-center px-6 gap-4 shadow-sm transition-all duration-200`}>
      {/* Title / Search */}
      <div className="flex-1 flex items-center gap-4 max-w-xl">
        <div className="hidden sm:block min-w-0 flex-shrink-0">
          <div className="text-xs font-bold text-[#1E293B] truncate">
            {pageTitles[activeTab] || 'PlantOps Operations'}
          </div>
          <div className="text-[10px] text-[#64748B] flex items-center gap-1.5 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22A06B]" />
            Enterprise Industrial Facility &bull; Zone A
          </div>
        </div>

        <div className="flex-1 min-w-[200px] relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
          <input
            type="text"
            placeholder="Search assets, telemetry, work orders, parts..."
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-white border border-[#DDD9D0] rounded-xl text-[#1E293B] placeholder:text-[#64748B] focus:outline-none focus:border-[#2563EB] transition-all"
          />
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3.5 ml-auto">
        {/* MQTT Live */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F6EF] border border-[#B4E3CF]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#22A06B] animate-pulse" />
          <Wifi size={12} className="text-[#22A06B]" />
          <span className="text-[11px] font-bold text-[#1D8358]">MQTT Live</span>
        </div>

        {/* Date/Time */}
        <div className="hidden lg:flex items-center gap-1 text-xs text-[#64748B]">
          <span className="font-semibold text-[#1E293B]">{dateStr}</span>
          <span className="text-[#DDD9D0] mx-1">|</span>
          <span className="font-mono font-bold text-[#2563EB]">{timeStr}</span>
        </div>

        {/* Notifications */}
        <button className="relative p-2 rounded-xl bg-white border border-[#DDD9D0] hover:bg-[#EAE7E0] transition-colors">
          <Bell size={16} className="text-[#1E293B]" />
          {totalAlerts > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center bg-[#D64545] text-white text-[9px] font-bold rounded-full shadow-sm">
              {totalAlerts > 9 ? '9+' : totalAlerts}
            </span>
          )}
        </button>

        {/* User Role Switcher Trigger */}
        <button 
          onClick={onOpenLogin}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white hover:bg-[#EAE7E0] border border-[#DDD9D0] transition-all text-left"
          title="Switch User Persona & Role"
        >
          <div className="w-7 h-7 rounded-lg bg-[#2563EB] flex items-center justify-center text-white text-[10px] font-bold shadow-sm">
            {currentUser?.name ? currentUser.name.split(' ').map(n => n[0]).join('') : 'PP'}
          </div>
          <div className="hidden md:block">
            <div className="text-xs font-bold text-[#1E293B] leading-tight">
              {currentUser?.name || 'Priya Patel'}
            </div>
            <div className="text-[10px] text-[#0F766E] font-medium leading-tight">
              {currentUser?.role || 'Plant Manager'}
            </div>
          </div>
          <ChevronDown size={13} className="text-[#64748B]" />
        </button>
      </div>
    </header>
  );
};

