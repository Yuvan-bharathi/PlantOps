import React from 'react';
import {
  LayoutDashboard, Box, Cog, RadioTower, TriangleAlert, Wrench,
  ClipboardList, HardHat, Boxes, ShoppingCart, Building2,
  ClipboardCheck, BrainCircuit, BarChart3, Settings, FileSpreadsheet,
  Play, RotateCcw, Leaf, PanelLeftClose, PanelLeftOpen, Sparkles,
  Activity, Shield, Lock
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
  badgeColor?: string;
  dividerBefore?: boolean;
  disabled?: boolean;
}

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pendingReviewsCount: number;
  activeFaultsCount: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  currentRoleName?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab, setActiveTab, pendingReviewsCount, activeFaultsCount,
  collapsed, onToggleCollapse, currentRoleName = 'Priya Patel (Manager)'
}) => {
  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'twin', label: '3D Digital Twin', icon: Box },
    { id: 'machines', label: 'Machines', icon: Cog },
    { id: 'iot', label: 'IoT Devices', icon: RadioTower },
    { id: 'telemetry', label: 'Telemetry', icon: Activity },
    { id: 'incidents', label: 'Incidents', icon: TriangleAlert, badge: activeFaultsCount, badgeColor: 'bg-[#D64545]', dividerBefore: true },
    { id: 'maintenance', label: 'Maintenance', icon: Wrench },
    { id: 'work-orders', label: 'Work Orders', icon: ClipboardList },
    { id: 'technicians', label: 'Technicians', icon: HardHat },
    { id: 'inventory', label: 'Inventory & ATP', icon: Boxes, dividerBefore: true },
    { id: 'procurement', label: 'Procurement & POs', icon: ShoppingCart },
    { id: 'suppliers', label: 'Suppliers', icon: Building2 },
    { id: 'review', label: 'Human Review', icon: ClipboardCheck, badge: pendingReviewsCount, badgeColor: 'bg-[#D99A06]', dividerBefore: true },
    { id: 'ai', label: 'AI Orchestrator', icon: BrainCircuit },
    { id: 'domo', label: 'Domo Analytics', icon: BarChart3, dividerBefore: true },
    { id: 'settings', label: 'Audit & Settings', icon: Settings },
    { id: 'login', label: 'RBAC / Login', icon: Lock, dividerBefore: true },
  ];

  const w = collapsed ? 'w-16' : 'w-60';

  return (
    <aside className={`fixed inset-y-0 left-0 z-30 ${w} bg-[#FAF9F6] border-r border-[#DDD9D0] flex flex-col shadow-sm transition-all duration-200 overflow-hidden`}>
      {/* Logo + Toggle */}
      <div className="h-16 flex items-center justify-between px-3 border-b border-[#DDD9D0] flex-shrink-0 bg-[#FAF9F6]">
        {!collapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center shadow-sm flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="7" height="7" rx="1" /><rect x="15" y="3" width="7" height="7" rx="1" />
                <rect x="2" y="14" width="7" height="7" rx="1" /><rect x="15" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="font-extrabold text-sm text-[#1E293B] tracking-tight leading-none">
                PLANT<span className="text-[#2563EB]">OPS</span>
              </div>
              <div className="text-[10px] text-[#64748B] mt-0.5 leading-none font-medium truncate">Predictive Maintenance</div>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center shadow-sm mx-auto">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="7" height="7" rx="1" /><rect x="15" y="3" width="7" height="7" rx="1" />
              <rect x="2" y="14" width="7" height="7" rx="1" /><rect x="15" y="14" width="7" height="7" rx="1" />
            </svg>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className={`p-1.5 rounded-lg text-[#64748B] hover:text-[#1E293B] hover:bg-[#EAE7E0] transition-colors flex-shrink-0 ${collapsed ? 'mx-auto mt-0' : ''}`}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 no-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <React.Fragment key={item.id}>
              {item.dividerBefore && (
                <div className="my-2 border-t border-[#DDD9D0]/70 mx-1" />
              )}
              <button
                onClick={() => setActiveTab(item.id)}
                disabled={item.disabled}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all mb-0.5 group relative ${
                  isActive
                    ? 'bg-[#2563EB] text-white shadow-sm'
                    : 'text-[#64748B] hover:text-[#1E293B] hover:bg-[#EAE7E0]'
                } ${item.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <Icon
                  size={16}
                  className={`flex-shrink-0 ${
                    isActive ? 'text-white' : 'text-[#64748B] group-hover:text-[#1E293B]'
                  }`}
                />
                {!collapsed && (
                  <span className="flex-1 text-left truncate">{item.label}</span>
                )}
                {!collapsed && item.badge !== undefined && item.badge > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white ${item.badgeColor || 'bg-[#D64545]'}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            </React.Fragment>
          );
        })}
      </nav>

      {/* Brand Tagline */}
      {!collapsed && (
        <div className="px-3 py-3 border-t border-[#DDD9D0] flex-shrink-0 bg-[#FAF9F6]">
          <div className="flex items-center gap-2 p-2 rounded-xl bg-[#EAE7E0] border border-[#DDD9D0]">
            <div className="w-5 h-5 rounded-md bg-[#0F766E] flex items-center justify-center flex-shrink-0">
              <Leaf size={11} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-[#1E293B] truncate">Smarter Industrial Plants</p>
              <p className="text-[9px] text-[#64748B] leading-tight truncate">Autonomous Reliability</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

