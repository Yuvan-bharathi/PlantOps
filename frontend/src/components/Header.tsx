import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Search, Bell, Wifi, ChevronDown, ShieldCheck, User, X,
  Box, Cpu, TriangleAlert, ClipboardList, Boxes, HardHat,
  Zap, Calendar, Truck, RadioTower, Activity, Wrench, ShoppingCart,
  Building2, BrainCircuit, ArrowRight, CornerDownLeft, Sparkles
} from 'lucide-react';
import { UserProfile } from './Operations/LoginPage';
import { Machine, Incident, WorkOrder, SparePartInventory } from '../types';

interface HeaderProps {
  activeTab: string;
  pendingReviewsCount: number;
  activeFaultsCount: number;
  collapsed?: boolean;
  currentUser?: UserProfile;
  onOpenLogin?: () => void;
  onNavigateTab?: (tab: string) => void;
  onSelectMachine?: (machineCode: string) => void;
  machines?: Machine[];
  incidents?: Incident[];
  workOrders?: WorkOrder[];
  inventory?: SparePartInventory[];
}

const pageTitles: Record<string, string> = {
  login: 'RBAC Authentication & Persona Selector',
  dashboard: 'Operations Command Center',
  power: 'Power Supply Cell & Substation Feeder',
  history: 'Machine Daily Operations History & 24h Timeline',
  production: 'End-to-End CNC Production, Packaging & AGV Logistics',
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

const ALL_PAGES = [
  { id: 'dashboard', label: 'Operations Dashboard', icon: Box, category: 'Pages', desc: 'Real-time KPI ribbons and system status' },
  { id: 'power', label: 'Power Supply Cell', icon: Zap, category: 'Pages', desc: 'Substation breakers & energy telemetry' },
  { id: 'history', label: 'Machine Daily History', icon: Calendar, category: 'Pages', desc: '24-hour Gantt scrubber and daily logs' },
  { id: 'production', label: 'Production & AGV Logistics', icon: Truck, category: 'Pages', desc: 'Shopfloor throughput & pallet AGVs' },
  { id: 'twin', label: '3D Digital Twin', icon: Box, category: 'Pages', desc: 'Three.js factory floor spatial twin' },
  { id: 'machines', label: 'Machines Register', icon: Cpu, category: 'Pages', desc: 'Asset health, telemetry and specs' },
  { id: 'iot', label: 'IoT Devices & Edge', icon: RadioTower, category: 'Pages', desc: 'Gateway mesh & MQTT stream status' },
  { id: 'telemetry', label: 'Multi-Sensor Telemetry', icon: Activity, category: 'Pages', desc: 'High-frequency vibration & temp curves' },
  { id: 'incidents', label: 'Incident Timeline', icon: TriangleAlert, category: 'Pages', desc: 'Anomaly timeline & diagnostics' },
  { id: 'maintenance', label: 'Maintenance & PM Plans', icon: Wrench, category: 'Pages', desc: 'Routine PM calendar & SOP execution' },
  { id: 'work-orders', label: 'Work Orders & LOTO', icon: ClipboardList, category: 'Pages', desc: 'OSHA 1910.147 isolation & work orders' },
  { id: 'technicians', label: 'Technicians Roster', icon: HardHat, category: 'Pages', desc: 'Skills matrix & active duty roster' },
  { id: 'inventory', label: 'Inventory & ATP Check', icon: Boxes, category: 'Pages', desc: 'Spare parts stock & bin locations' },
  { id: 'procurement', label: 'Procurement & POs', icon: ShoppingCart, category: 'Pages', desc: 'Requisition orders & supplier lead times' },
  { id: 'suppliers', label: 'Supplier Directory', icon: Building2, category: 'Pages', desc: 'Vendor SLAs & certified suppliers' },
  { id: 'ai', label: 'AI Diagnosis & Ledger', icon: BrainCircuit, category: 'Pages', desc: 'Autonomous reasoning & copilot console' },
];

export const Header: React.FC<HeaderProps> = ({ 
  activeTab, 
  pendingReviewsCount, 
  activeFaultsCount, 
  collapsed = false,
  currentUser,
  onOpenLogin,
  onNavigateTab,
  onSelectMachine,
  machines = [],
  incidents = [],
  workOrders = [],
  inventory = []
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Global Keyboard Shortcut: Ctrl+K / Cmd+K or "/" to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchOpen(true);
      } else if (e.key === 'Escape') {
        setIsSearchOpen(false);
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close search popover on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const dateStr = currentTime.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata'
  });

  const timeStr = currentTime.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata'
  });

  // Search Results filtering across all entities
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return { pages: [], machines: [], incidents: [], workOrders: [], parts: [] };

    const matchedPages = ALL_PAGES.filter(
      p => p.label.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
    ).slice(0, 3);

    const matchedMachines = machines.filter(
      m => m.code.toLowerCase().includes(q) || m.name.toLowerCase().includes(q) || (m.area || '').toLowerCase().includes(q)
    ).slice(0, 4);

    const matchedIncidents = incidents.filter(
      i => (i.id || '').toLowerCase().includes(q) || 
           (i.alert_type || '').toLowerCase().includes(q) || 
           (i.machine_code || i.machine_name || i.machine_id || '').toLowerCase().includes(q) ||
           (i.ai_root_cause || i.ai_diagnosis_summary || '').toLowerCase().includes(q) ||
           (i.part_name || i.part_number || '').toLowerCase().includes(q)
    ).slice(0, 3);

    const matchedWorkOrders = workOrders.filter(
      w => (w.id || '').toLowerCase().includes(q) || 
           (w.machine_code || w.machine_name || w.machine_id || '').toLowerCase().includes(q) ||
           (w.technician_name || '').toLowerCase().includes(q) ||
           (w.notes || '').toLowerCase().includes(q) ||
           (w.priority || '').toLowerCase().includes(q)
    ).slice(0, 3);

    const matchedParts = inventory.filter(
      p => (p.part_number || '').toLowerCase().includes(q) ||
           (p.name || '').toLowerCase().includes(q) ||
           (p.bin_location || '').toLowerCase().includes(q) ||
           (p.category || '').toLowerCase().includes(q)
    ).slice(0, 3);

    return {
      pages: matchedPages,
      machines: matchedMachines,
      incidents: matchedIncidents,
      workOrders: matchedWorkOrders,
      parts: matchedParts
    };
  }, [searchQuery, machines, incidents, workOrders, inventory]);

  const totalResultsCount = 
    searchResults.pages.length + 
    searchResults.machines.length + 
    searchResults.incidents.length + 
    searchResults.workOrders.length + 
    searchResults.parts.length;

  const handleSelectResult = (action: () => void) => {
    action();
    setIsSearchOpen(false);
    setSearchQuery('');
  };

  const totalAlerts = activeFaultsCount + pendingReviewsCount;
  const leftClass = collapsed ? 'left-16' : 'left-60';

  return (
    <header className={`fixed ${leftClass} right-0 top-0 z-30 h-14 bg-[#FAF9F6] border-b border-[#DDD9D0] flex items-center px-4 sm:px-5 gap-3 shadow-xs transition-all duration-200`}>
      {/* Title / Interactive Search Container */}
      <div className="flex-1 flex items-center gap-4 max-w-2xl" ref={searchContainerRef}>
        <div className="hidden sm:block min-w-0 flex-shrink-0">
          <div className="text-xs font-bold text-[#1E293B] truncate">
            {pageTitles[activeTab] || 'PlantOps Operations'}
          </div>
          <div className="text-[10px] text-[#64748B] flex items-center gap-1.5 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22A06B]" />
            Enterprise Industrial Facility &bull; Zone A
          </div>
        </div>

        {/* Global Live Search Bar */}
        <div className="flex-1 min-w-[220px] relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B] pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search assets, telemetry, work orders, parts... (Ctrl+K)"
            value={searchQuery}
            onFocus={() => setIsSearchOpen(true)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsSearchOpen(true);
            }}
            className="w-full pl-9 pr-14 py-1.5 text-xs bg-white border border-[#DDD9D0] rounded-xl text-[#1E293B] placeholder:text-[#64748B] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 transition-all font-medium shadow-2xs"
          />

          {searchQuery ? (
            <button
              onClick={() => {
                setSearchQuery('');
                setIsSearchOpen(false);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#64748B] hover:text-[#1E293B] hover:bg-slate-100 rounded-lg"
              title="Clear search"
            >
              <X size={13} />
            </button>
          ) : (
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-0.5 px-1.5 py-0.5 bg-[#FAF9F6] border border-[#DDD9D0] rounded text-[10px] font-mono text-[#64748B] pointer-events-none">
              <span>Ctrl</span>
              <span>K</span>
            </div>
          )}

          {/* Search Results Floating Spotlight Popover */}
          {isSearchOpen && searchQuery.trim() && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-[#DDD9D0] rounded-2xl shadow-2xl overflow-hidden max-h-[75vh] overflow-y-auto z-50 animate-in fade-in zoom-in-95 duration-150">
              {totalResultsCount === 0 ? (
                <div className="p-6 text-center text-xs text-[#64748B] space-y-1.5">
                  <Search size={20} className="mx-auto text-slate-300" />
                  <p className="font-bold text-[#1E293B]">No results found for "{searchQuery}"</p>
                  <p className="text-[11px]">Try searching by Machine Code (CNC-01), Incident (INC), Part #, or Tab name.</p>
                </div>
              ) : (
                <div className="p-2 divide-y divide-slate-100 text-xs">
                  {/* Category 1: Navigation Pages */}
                  {searchResults.pages.length > 0 && (
                    <div className="py-1.5">
                      <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase text-[#64748B] tracking-wider flex items-center justify-between">
                        <span>Pages &amp; Consoles</span>
                        <span>{searchResults.pages.length}</span>
                      </div>
                      {searchResults.pages.map((p) => {
                        const Icon = p.icon;
                        return (
                          <button
                            key={p.id}
                            onClick={() => handleSelectResult(() => onNavigateTab?.(p.id))}
                            className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-[#FAF9F6] text-left transition-colors group cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center shrink-0">
                                <Icon size={14} />
                              </div>
                              <div className="truncate">
                                <div className="font-bold text-[#1E293B] group-hover:text-[#2563EB] truncate">{p.label}</div>
                                <div className="text-[10px] text-[#64748B] truncate">{p.desc}</div>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold text-[#2563EB] flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              Jump <ArrowRight size={11} />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Category 2: Machines */}
                  {searchResults.machines.length > 0 && (
                    <div className="py-1.5">
                      <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase text-[#64748B] tracking-wider flex items-center justify-between">
                        <span>Machinery &amp; Assets</span>
                        <span>{searchResults.machines.length}</span>
                      </div>
                      {searchResults.machines.map((m) => (
                        <button
                          key={m.id || m.code}
                          onClick={() => handleSelectResult(() => {
                            onSelectMachine?.(m.code);
                            onNavigateTab?.('twin');
                          })}
                          className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-[#FAF9F6] text-left transition-colors group cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white font-mono text-[10px] font-extrabold ${
                              m.status === 'RUNNING' ? 'bg-emerald-600' : m.status === 'FAULT' ? 'bg-rose-600' : 'bg-amber-500'
                            }`}>
                              {m.code.slice(0, 3)}
                            </div>
                            <div className="truncate">
                              <div className="font-bold text-[#1E293B] group-hover:text-[#2563EB] flex items-center gap-1.5">
                                <span className="font-mono text-[#2563EB]">{m.code}</span>
                                <span className="text-slate-400">&bull;</span>
                                <span className="truncate">{m.name}</span>
                              </div>
                              <div className="text-[10px] text-[#64748B] truncate">
                                Health: <strong className="text-slate-800">{m.health_score || 95}%</strong> &bull; {m.area || 'Shopfloor'}
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-[#2563EB] flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            View Twin <ArrowRight size={11} />
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Category 3: Incidents */}
                  {searchResults.incidents.length > 0 && (
                    <div className="py-1.5">
                      <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase text-[#64748B] tracking-wider flex items-center justify-between">
                        <span>Incident Timeline</span>
                        <span>{searchResults.incidents.length}</span>
                      </div>
                      {searchResults.incidents.map((inc) => (
                        <button
                          key={inc.id}
                          onClick={() => handleSelectResult(() => onNavigateTab?.('incidents'))}
                          className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-[#FAF9F6] text-left transition-colors group cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              inc.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              <TriangleAlert size={14} />
                            </div>
                            <div className="truncate">
                              <div className="font-bold text-[#1E293B] group-hover:text-[#2563EB] flex items-center gap-1.5">
                                <span className="font-mono text-rose-600">{inc.id}</span>
                                <span className="text-slate-400">&bull;</span>
                                <span className="truncate">{inc.alert_type || inc.ai_diagnosis_summary || 'Incident Alert'}</span>
                              </div>
                              <div className="text-[10px] text-[#64748B] truncate">
                                Machine: <strong>{inc.machine_code || inc.machine_id}</strong> &bull; Status: {inc.status}
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-[#2563EB] flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            Open <ArrowRight size={11} />
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Category 4: Work Orders */}
                  {searchResults.workOrders.length > 0 && (
                    <div className="py-1.5">
                      <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase text-[#64748B] tracking-wider flex items-center justify-between">
                        <span>Work Orders &amp; LOTO</span>
                        <span>{searchResults.workOrders.length}</span>
                      </div>
                      {searchResults.workOrders.map((wo) => (
                        <button
                          key={wo.id}
                          onClick={() => handleSelectResult(() => onNavigateTab?.('work-orders'))}
                          className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-[#FAF9F6] text-left transition-colors group cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
                              <ClipboardList size={14} />
                            </div>
                            <div className="truncate">
                              <div className="font-bold text-[#1E293B] group-hover:text-[#2563EB] flex items-center gap-1.5">
                                <span className="font-mono text-indigo-700">{wo.id}</span>
                                <span className="text-slate-400">&bull;</span>
                                <span className="truncate">{wo.notes || `Priority: ${wo.priority}`}</span>
                              </div>
                              <div className="text-[10px] text-[#64748B] truncate">
                                Assigned: <strong>{wo.technician_name || 'Lead Technician'}</strong> &bull; Status: {wo.status}
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-[#2563EB] flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            View <ArrowRight size={11} />
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Category 5: Spare Parts & Inventory */}
                  {searchResults.parts.length > 0 && (
                    <div className="py-1.5">
                      <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase text-[#64748B] tracking-wider flex items-center justify-between">
                        <span>MRO Spare Parts (ATP)</span>
                        <span>{searchResults.parts.length}</span>
                      </div>
                      {searchResults.parts.map((p) => (
                        <button
                          key={p.id || p.part_number}
                          onClick={() => handleSelectResult(() => onNavigateTab?.('inventory'))}
                          className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl hover:bg-[#FAF9F6] text-left transition-colors group cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                              <Boxes size={14} />
                            </div>
                            <div className="truncate">
                              <div className="font-bold text-[#1E293B] group-hover:text-[#2563EB] flex items-center gap-1.5">
                                <span className="font-mono text-amber-800">{p.part_number}</span>
                                <span className="text-slate-400">&bull;</span>
                                <span className="truncate">{p.name}</span>
                              </div>
                              <div className="text-[10px] text-[#64748B] truncate">
                                Available ATP: <strong className="text-blue-700">{p.available_to_promise ?? (p.quantity_on_hand - p.reserved_quantity)} units</strong> &bull; Bin: {p.bin_location}
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-[#2563EB] flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            Inspect <ArrowRight size={11} />
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
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
        <button 
          onClick={() => onNavigateTab?.('incidents')}
          className="relative p-2 rounded-xl bg-white border border-[#DDD9D0] hover:bg-[#EAE7E0] transition-colors cursor-pointer"
          title="Active Plant Alerts"
        >
          <Bell size={16} className="text-[#1E293B]" />
          {totalAlerts > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center bg-[#D64545] text-white text-[9px] font-bold rounded-full shadow-sm animate-pulse">
              {totalAlerts > 9 ? '9+' : totalAlerts}
            </span>
          )}
        </button>

        {/* User Role Switcher Trigger */}
        <button 
          onClick={onOpenLogin}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white hover:bg-[#EAE7E0] border border-[#DDD9D0] transition-all text-left cursor-pointer"
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


