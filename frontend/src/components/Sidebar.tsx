import React from 'react';
import {
  LayoutDashboard, Box, Cog, RadioTower, TriangleAlert, Wrench,
  ClipboardList, HardHat, Boxes, ShoppingCart, Building2,
  ClipboardCheck, BrainCircuit, BarChart3, Settings, FileSpreadsheet,
  Play, RotateCcw, Leaf, PanelLeftClose, PanelLeftOpen, Sparkles,
  Activity, Shield, Lock, Truck, Zap, Calendar, Navigation
} from 'lucide-react';

import { UserProfile, RoleKey } from './Operations/LoginPage';
import { PlantOpsLogo } from './common/PlantOpsLogo';

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
  currentUser?: UserProfile;
}

const ROLE_PERMITTED_TABS: Record<RoleKey, string[]> = {
  PLANT_ADMIN: [
    'dashboard', 'assistant', 'power', 'history', 'production', 'fleet', 'twin', 'machines', 'iot', 'telemetry',
    'incidents', 'maintenance', 'work-orders', 'technicians', 'inventory',
    'procurement', 'suppliers', 'review', 'ai', /* 'domo', 'settings', */ 'login'
  ],
  MANAGER: [
    'dashboard', 'assistant', 'history', 'power', 'twin', 'production', 'fleet', 'procurement', 'suppliers', 'review', /* 'domo', */ 'login'
  ],
  SUPERVISOR: [
    'dashboard', 'assistant', 'power', 'history', 'twin', 'production', 'fleet', 'machines', 'incidents', 'maintenance', 'work-orders', 'technicians', 'login'
  ],
  TECHNICIAN: [
    'dashboard', 'assistant', 'power', 'history', 'twin', 'work-orders', 'maintenance', 'telemetry', 'ai', 'login'
  ],
  INVENTORY_MGMT: [
    'dashboard', 'assistant', 'history', 'inventory', 'procurement', 'suppliers', 'production', 'fleet', 'login'
  ]
};

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab, setActiveTab, pendingReviewsCount, activeFaultsCount,
  collapsed, onToggleCollapse, currentUser
}) => {
  const allNavItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'assistant', label: 'AI Assistant', icon: Sparkles },
    { id: 'power', label: 'Power Supply Cell', icon: Zap },
    { id: 'history', label: 'Daily History', icon: Calendar },
    { id: 'production', label: 'Production & AGV', icon: Truck },
    { id: 'fleet', label: 'Live Fleet Tracking', icon: Navigation },
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
    // { id: 'domo', label: 'Domo Analytics', icon: BarChart3, dividerBefore: true },
    // { id: 'settings', label: 'Audit & Settings', icon: Settings },
    { id: 'login', label: 'RBAC / Login', icon: Lock, dividerBefore: true },
  ];

  const roleKey = currentUser?.roleKey || 'MANAGER';
  const permittedList = ROLE_PERMITTED_TABS[roleKey] || ROLE_PERMITTED_TABS.MANAGER;
  const navItems = allNavItems.filter(item => permittedList.includes(item.id));

  const w = collapsed ? 'w-16' : 'w-60';

  return (
    <aside className={`fixed inset-y-0 left-0 z-30 ${w} bg-[#FAF9F6] border-r border-[#DDD9D0] flex flex-col shadow-sm transition-all duration-200`}>
      {/* Logo + Toggle Header */}
      <div className="h-16 flex items-center justify-between px-3 border-b border-[#DDD9D0] flex-shrink-0 bg-[#FAF9F6]">
        {!collapsed ? (
          <>
            <div className="flex items-center gap-2.5 min-w-0">
              <PlantOpsLogo size={34} className="shrink-0" />
              <div className="min-w-0">
                <div className="font-extrabold text-sm text-[#1E293B] tracking-tight leading-none">
                  PLANT<span className="text-[#2563EB]">OPS</span>
                </div>
                <div className="text-[10px] text-[#64748B] mt-0.5 leading-none font-medium truncate">Predictive Maintenance</div>
              </div>
            </div>

            <button
              onClick={onToggleCollapse}
              className="p-1.5 rounded-lg text-[#64748B] hover:text-[#1E293B] hover:bg-[#EAE7E0] transition-colors flex-shrink-0 relative group"
              title="Close sidebar"
            >
              <PanelLeftClose size={18} />
              <div className="absolute right-0 top-full mt-1.5 px-2 py-1 bg-[#1E293B] text-white text-[10px] font-semibold rounded-md shadow-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50">
                Close sidebar
              </div>
            </button>
          </>
        ) : (
          /* Collapsed State: Logo morphs to Open Sidebar button on hover with sleek tooltip */
          <div className="w-full flex items-center justify-center">
            <button
              onClick={onToggleCollapse}
              className="w-10 h-10 rounded-xl relative group flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-[#EAE7E0]"
              aria-label="Open sidebar"
            >
              {/* Default: Logo Image */}
              <div className="flex items-center justify-center transition-all duration-200 group-hover:opacity-0 group-hover:scale-75">
                <PlantOpsLogo size={30} />
              </div>

              {/* Hover: Sidebar Open Icon */}
              <div className="absolute flex items-center justify-center opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200">
                <PanelLeftOpen size={20} className="text-[#1E293B]" />
              </div>

              {/* Floating Tooltip to the Right */}
              <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#1E293B] text-white text-xs font-semibold rounded-lg shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-150 z-50 flex items-center gap-1.5">
                <span>Open sidebar</span>
              </div>
            </button>
          </div>
        )}
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

      {/* Active Persona Tagline */}
      {!collapsed && (
        <div className="px-3 py-3 border-t border-[#DDD9D0] flex-shrink-0 bg-[#FAF9F6]">
          <div className="flex items-center gap-2 p-2 rounded-xl bg-[#EAE7E0] border border-[#DDD9D0]">
            <div className="w-6 h-6 rounded-md bg-[#2563EB] flex items-center justify-center flex-shrink-0 text-white font-bold text-[10px]">
              {currentUser?.name ? currentUser.name.split(' ').map(n => n[0]).join('') : 'PP'}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-[#1E293B] truncate">{currentUser?.name || 'Priya Patel'}</p>
              <p className="text-[9px] text-[#0F766E] font-medium leading-tight truncate">{currentUser?.role || 'Operations Manager'}</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

