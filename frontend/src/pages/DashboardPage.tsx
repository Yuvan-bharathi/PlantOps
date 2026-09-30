import React, { useState } from 'react';
import { Icon3D } from '../components/common/Icon3D';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bot,
  Boxes,
  Building2,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Cpu,
  Database,
  DollarSign,
  Eye,
  FileCheck,
  HardHat,
  Layers,
  Lock,
  Package,
  Radio,
  RefreshCw,
  Server,
  Shield,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Timer,
  TrendingDown,
  TrendingUp,
  Truck,
  User,
  Wrench,
  Zap,
  X,
  Phone,
  Check,
  ExternalLink,
  MapPin,
  Flame,
  FileText,
  Sliders,
  CheckSquare,
  Cloud,
  Play,
  Pause,
  Network,
  Send,
  Wifi,
  Terminal,
  Share2
} from 'lucide-react';
import { Machine, Incident, WorkOrder, SparePartInventory, PurchaseOrder, HumanReviewItem } from '../types';
import { RoleKey, UserProfile } from '../components/Operations/LoginPage';
import { api } from '../services/api';
import { OutboundFreightCard } from '../components/Dashboard/OutboundFreightCard';

interface DashboardProps {
  machines: Machine[];
  incidents: Incident[];
  workOrders: WorkOrder[];
  inventory: SparePartInventory[];
  purchaseOrders: PurchaseOrder[];
  reviewItems: HumanReviewItem[];
  currentUser?: UserProfile;
  onSelectTab: (tab: string) => void;
  onRefresh: () => void;
  onSwitchUserRole?: (user: UserProfile) => void;
  /** Opens Live Fleet Tracking with the chase camera on this truck */
  onTrackTruck?: (truckId: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Compact Enterprise KPI Card (Low Height ~65px, High-Density)
// ─────────────────────────────────────────────────────────────────────────────
const KpiCard: React.FC<{
  label: string;
  value: string | number;
  subtitle?: string;
  delta?: string;
  deltaUp?: boolean;
  icon: React.ReactNode;
  iconBg: string;
  onClick?: () => void;
}> = ({ label, value, subtitle, delta, deltaUp, icon, iconBg, onClick }) => (
  <button
    onClick={onClick}
    className={`bg-[#FAF9F6] border border-[#DDD9D0] rounded-xl p-3 flex items-center justify-between gap-3 text-left w-full transition-all hover:shadow-xs hover:border-blue-400 hover:bg-white active:scale-[0.99] ${
      onClick ? 'cursor-pointer' : 'cursor-default'
    }`}
  >
    <div className="flex items-center gap-3 min-w-0 flex-1">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-2xs ${iconBg}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-extrabold text-[#64748B] uppercase tracking-wider truncate">
          {label}
        </div>
        <div className="flex items-baseline gap-2 mt-0.5">
          <span className="text-lg font-black text-[#1E293B] font-mono leading-tight tracking-tight">
            {value}
          </span>
          {delta && (
            <span className={`flex items-center text-[10px] font-extrabold font-mono ${deltaUp ? 'text-rose-600' : 'text-emerald-700'}`}>
              {deltaUp ? <TrendingUp size={10} className="mr-0.5" /> : <TrendingDown size={10} className="mr-0.5" />}
              {delta}
            </span>
          )}
        </div>
        {subtitle && (
          <div className="text-[10px] text-[#64748B] truncate mt-0.5 font-medium">
            {subtitle}
          </div>
        )}
      </div>
    </div>
    {onClick && <ChevronRight size={13} className="text-[#DDD9D0] flex-shrink-0" />}
  </button>
);

export const DashboardPage: React.FC<DashboardProps> = ({
  machines,
  incidents,
  workOrders,
  inventory,
  purchaseOrders,
  reviewItems,
  currentUser,
  onTrackTruck,
  onSelectTab,
  onRefresh
}) => {
  const roleKey: RoleKey = currentUser?.roleKey || 'PLANT_ADMIN';

  // State for Admin System Diagnostics Ping Modal
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [pinging, setPinging] = useState(false);
  const [diagnosticsResults, setDiagnosticsResults] = useState([
    { name: 'TiDB Cloud Serverless MySQL (plantops_db)', ping: '12 ms', status: 'OPTIMAL', details: '8/15 Active Pool Connections • TLSv1.2 Encrypted', color: 'text-blue-600' },
    { name: 'TimescaleDB Postgres Hypertable (telemetry_stream)', ping: '10 ms', status: 'OPTIMAL', details: '2,400 pts/sec • 14 Chunks Active • 0 Dropped Packets', color: 'text-purple-600' },
    { name: 'Mosquitto Edge MQTT Broker (Port 1883)', ping: '4 ms', status: 'STREAMING', details: '100 Hz Ingestion Rate • Advantech UNO-2271G Gateway', color: 'text-emerald-600' },
    { name: 'Node.js Express Backend Daemon', ping: '1 ms', status: 'HEALTHY', details: 'Port 4000 • Socket.io Bi-Directional Broadcast Active', color: 'text-blue-600' }
  ]);

  const handleRunDiagnostics = () => {
    setPinging(true);
    setTimeout(() => {
      setDiagnosticsResults([
        { name: 'TiDB Cloud Serverless MySQL (plantops_db)', ping: `${Math.floor(Math.random() * 6 + 10)} ms`, status: 'OPTIMAL', details: 'Pool: 9/15 • TLSv1.2 Encrypted • 0 Errors', color: 'text-blue-600' },
        { name: 'TimescaleDB Postgres Hypertable (telemetry_stream)', ping: `${Math.floor(Math.random() * 5 + 8)} ms`, status: 'OPTIMAL', details: '2,400 pts/sec • 100% Ingestion Fidelity', color: 'text-purple-600' },
        { name: 'Mosquitto Edge MQTT Broker (Port 1883)', ping: `${Math.floor(Math.random() * 3 + 2)} ms`, status: 'STREAMING', details: '100 Hz Real-Time Stream • 0 Dropped Packets', color: 'text-emerald-600' },
        { name: 'Node.js Express Backend Daemon', ping: '1 ms', status: 'HEALTHY', details: 'Port 4000 • Socket.io Broadcast Nominal', color: 'text-blue-600' }
      ]);
      setPinging(false);
    }, 600);
  };

  const [eventFilter, setEventFilter] = useState<string>('ALL');
  const [isStreamPaused, setIsStreamPaused] = useState(false);
  const [opToast, setOpToast] = useState<string | null>(null);

  const triggerOpAction = (msg: string) => {
    setOpToast(msg);
    setTimeout(() => setOpToast(null), 3000);
  };

  // Operational metrics calculations with safe fallbacks
  const totalMachinesCount = machines.length > 0 ? machines.length : 25;
  const runningCount = machines.length > 0 ? machines.filter(m => m.status === 'RUNNING').length : 24;
  const faultCount = machines.length > 0 ? machines.filter(m => m.status === 'FAULT').length : 1;
  const activeWorkOrders = workOrders.length > 0 
    ? workOrders.filter(w => w.status !== 'COMPLETED')
    : [
        {
          id: 'WO-2026-088',
          machine_id: 'CNC-01',
          machine_code: 'CNC-01',
          technician_name: 'Arun Kumar',
          status: 'DISPATCHED',
          priority: 'HIGH',
          task_description: 'Spindle Bearing Replacement & Dynamic Balancing',
          created_at: new Date().toISOString()
        } as unknown as WorkOrder
      ];
  
  const displayInventory = inventory.length > 0 ? inventory : [
    {
      id: 'SKF-6205',
      part_number: 'SKF-6205-2RSH',
      name: 'Deep Groove Ball Bearing 25x52x15mm',
      category: 'Bearings',
      bin_location: 'BAY-A-04',
      quantity_on_hand: 3,
      reserved_quantity: 2,
      available_to_promise: 1,
      safety_stock: 4,
      unit_price: 45.00
    },
    {
      id: 'SMC-SY5120',
      part_number: 'SMC-SY5120-5LZ',
      name: '5/2 Solenoid Valve 24VDC',
      category: 'Pneumatics',
      bin_location: 'BAY-B-12',
      quantity_on_hand: 8,
      reserved_quantity: 1,
      available_to_promise: 7,
      safety_stock: 3,
      unit_price: 85.00
    },
    {
      id: 'OMRON-E2E',
      part_number: 'OMRON-E2E-X5ME1',
      name: 'Inductive Proximity Sensor M12 NPN',
      category: 'Sensors',
      bin_location: 'BAY-C-02',
      quantity_on_hand: 12,
      reserved_quantity: 0,
      available_to_promise: 12,
      safety_stock: 5,
      unit_price: 32.50
    },
    {
      id: 'FESTO-DSBC',
      part_number: 'FESTO-DSBC-32-100',
      name: 'Standard Pneumatic Cylinder 32mm Bore',
      category: 'Actuators',
      bin_location: 'BAY-B-08',
      quantity_on_hand: 4,
      reserved_quantity: 0,
      available_to_promise: 4,
      safety_stock: 2,
      unit_price: 140.00
    },
    {
      id: 'GATES-GT3',
      part_number: 'GATES-5MR-450-15',
      name: 'PowerGrip GT3 Synchronous Timing Belt',
      category: 'Power Transmission',
      bin_location: 'BAY-A-11',
      quantity_on_hand: 6,
      reserved_quantity: 1,
      available_to_promise: 5,
      safety_stock: 3,
      unit_price: 28.00
    }
  ] as unknown as SparePartInventory[];

  const lowStockCount = displayInventory.filter(i => (i.available_to_promise ?? (i.quantity_on_hand - i.reserved_quantity)) <= 2).length;
  
  const displayPOs = purchaseOrders.length > 0 ? purchaseOrders : [
    {
      id: 'PO-2026-088',
      part_number: 'SKF-6205-2RSH',
      part_name: 'Deep Groove Ball Bearing 25x52x15mm',
      supplier_name: 'Motion Industries MRO',
      quantity: 4,
      unit_price: 45.00,
      total_amount: 180.00,
      status: 'APPROVED',
      created_at: '2026-09-26T08:30:00Z'
    } as unknown as PurchaseOrder
  ];

  const totalSpend = displayPOs.reduce((sum, po) => sum + (Number(po.total_amount) || 0), 14850);

  const displayReviews = reviewItems.length > 0 ? reviewItems : [
    {
      id: 'REV-088',
      title: 'PO-2026-088: SKF Spindle Bearing Batch',
      reason: 'Urgent MRO replenishment triggered by CNC-01 vibration spike',
      total_amount: '180.00',
      risk_level: 'LOW',
      policy_id: 'POL-01',
      status: 'PENDING'
    } as unknown as HumanReviewItem
  ];

  return (
    <div className="space-y-3.5 w-full pb-10">
      {/* Toast Notification for Admin Operations */}
      {opToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1E293B] text-white px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{opToast}</span>
        </div>
      )}

      {/* Outbound freight: dock staging + live road shipments (all roles) */}
      <OutboundFreightCard onTrackTruck={(id) => (onTrackTruck ? onTrackTruck(id) : onSelectTab('fleet'))} onOpenFleet={() => onSelectTab('fleet')} />

      {/* ───────────────────────────────────────────────────────────── */}
      {/* PLANT ADMIN DASHBOARD VIEW (IT/OT Governance)                 */}
      {/* ───────────────────────────────────────────────────────────── */}
      {roleKey === 'PLANT_ADMIN' && (
        <div className="space-y-3.5 animate-in fade-in duration-200 w-full">
          {/* 1. HEADER BANNER WITH 3D POSTURE BADGE */}
          <div className="bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-4 shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative overflow-hidden">
            <div className="flex items-center gap-3.5">
              <Icon3D type="server" size={42} className="flex-shrink-0" />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-sm font-black text-[#1E293B] tracking-tight uppercase">
                    PLANT ADMIN — IT / OT SYSTEM GOVERNANCE
                  </h1>
                  <span className="text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    MQTT ● 100 Hz LIVE
                  </span>
                  <span className="text-[9px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full hidden md:inline-flex items-center gap-1 shadow-2xs">
                    Reliability Index: 99.8% (Nominal)
                  </span>
                </div>
                <p className="text-[11px] text-[#64748B] font-medium mt-0.5">
                  Infrastructure health · Edge connectivity · Security posture · Shift audit · SLA compliance
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <div className="text-right hidden xl:block mr-1">
                <div className="text-[9px] font-mono text-slate-400 uppercase font-semibold">Last sync</div>
                <div className="text-[11px] font-mono font-bold text-slate-700">11:42 AM</div>
              </div>

              <button
                onClick={() => {
                  setShowDiagnostics(true);
                  handleRunDiagnostics();
                }}
                className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-[0_2px_8px_rgba(37,99,235,0.25)] transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Run Diagnostics</span>
              </button>

              <button
                onClick={() => onSelectTab('login')}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 border border-[#DDD9D0] shadow-xs transition-all cursor-pointer"
                title="Switch User Role"
              >
                <Lock size={12} className="text-slate-500" />
                <span>Switch Role</span>
              </button>

              <button
                onClick={onRefresh}
                className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-600 border border-[#DDD9D0] shadow-xs transition-colors cursor-pointer"
                title="Refresh All Telemetry"
              >
                <RefreshCw size={13} />
              </button>
            </div>
          </div>

          {/* 2. SEVEN PRIMARY KPI CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {/* KPI 1: System Health */}
            <div onClick={() => setShowDiagnostics(true)} className="bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-3.5 hover:border-emerald-400 hover:bg-white hover:shadow-[0_4px_16px_rgba(16,185,129,0.12)] transition-all cursor-pointer shadow-xs group flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="text-[9px] font-extrabold text-[#64748B] uppercase tracking-wider">SYSTEM HEALTH</div>
                <Icon3D type="health" size={24} className="group-hover:scale-110 transition-transform" />
              </div>
              <div>
                <div className="flex items-baseline gap-1"><span className="text-lg font-black font-mono text-[#1E293B]">100%</span><span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 rounded border border-emerald-200">● OK</span></div>
                <div className="text-[9px] text-[#64748B] font-medium mt-0.5">All daemons online</div>
              </div>
            </div>

            {/* KPI 2: Edge Devices */}
            <div onClick={() => onSelectTab('iot')} className="bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-3.5 hover:border-blue-400 hover:bg-white hover:shadow-[0_4px_16px_rgba(59,130,246,0.12)] transition-all cursor-pointer shadow-xs group flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="text-[9px] font-extrabold text-[#64748B] uppercase tracking-wider">EDGE DEVICES</div>
                <Icon3D type="edge" size={24} className="group-hover:scale-110 transition-transform" />
              </div>
              <div>
                <div className="flex items-baseline gap-1"><span className="text-lg font-black font-mono text-[#1E293B]">24/25</span><span className="text-[9px] font-bold text-blue-700 bg-blue-50 px-1 rounded border border-blue-200">Online</span></div>
                <div className="text-[9px] text-[#64748B] font-medium mt-0.5">1 Warning · 0 Offline</div>
              </div>
            </div>

            {/* KPI 3: DB Latency */}
            <div onClick={() => setShowDiagnostics(true)} className="bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-3.5 hover:border-cyan-400 hover:bg-white hover:shadow-[0_4px_16px_rgba(6,182,212,0.12)] transition-all cursor-pointer shadow-xs group flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="text-[9px] font-extrabold text-[#64748B] uppercase tracking-wider">DB LATENCY</div>
                <Icon3D type="database" size={24} className="group-hover:scale-110 transition-transform" />
              </div>
              <div>
                <div className="flex items-baseline gap-1"><span className="text-lg font-black font-mono text-[#1E293B]">14 ms</span><span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 rounded border border-emerald-200">● Fast</span></div>
                <div className="text-[9px] text-[#64748B] font-medium mt-0.5">TiDB Cloud MySQL</div>
              </div>
            </div>

            {/* KPI 4: Telemetry */}
            <div onClick={() => onSelectTab('telemetry')} className="bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-3.5 hover:border-purple-400 hover:bg-white hover:shadow-[0_4px_16px_rgba(168,85,247,0.12)] transition-all cursor-pointer shadow-xs group flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="text-[9px] font-extrabold text-[#64748B] uppercase tracking-wider">TELEMETRY</div>
                <Icon3D type="telemetry" size={24} className="group-hover:scale-110 transition-transform" />
              </div>
              <div>
                <div className="flex items-baseline gap-1"><span className="text-lg font-black font-mono text-[#1E293B]">2,400</span><span className="text-[9px] font-bold text-purple-700 bg-purple-50 px-1 rounded border border-purple-200">pts/s</span></div>
                <div className="text-[9px] text-[#64748B] font-medium mt-0.5">100 Hz Live Stream</div>
              </div>
            </div>

            {/* KPI 5: Security */}
            <div onClick={() => onSelectTab('login')} className="bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-3.5 hover:border-indigo-400 hover:bg-white hover:shadow-[0_4px_16px_rgba(99,102,241,0.12)] transition-all cursor-pointer shadow-xs group flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="text-[9px] font-extrabold text-[#64748B] uppercase tracking-wider">SECURITY</div>
                <Icon3D type="security" size={24} className="group-hover:scale-110 transition-transform" />
              </div>
              <div>
                <div className="flex items-baseline gap-1"><span className="text-lg font-black font-mono text-[#1E293B]">100%</span><span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1 rounded border border-indigo-200">● Secure</span></div>
                <div className="text-[9px] text-[#64748B] font-medium mt-0.5">0 Policy Violations</div>
              </div>
            </div>

            {/* KPI 6: SLA Uptime */}
            <div onClick={() => setShowDiagnostics(true)} className="bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-3.5 hover:border-amber-400 hover:bg-white hover:shadow-[0_4px_16px_rgba(245,158,11,0.12)] transition-all cursor-pointer shadow-xs group flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="text-[9px] font-extrabold text-[#64748B] uppercase tracking-wider">SLA UPTIME</div>
                <div className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform"><Timer size={14} /></div>
              </div>
              <div>
                <div className="flex items-baseline gap-1"><span className="text-lg font-black font-mono text-[#1E293B]">99.8%</span><span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1 rounded border border-amber-200">30d</span></div>
                <div className="text-[9px] text-[#64748B] font-medium mt-0.5">Target: 99.5% SLA</div>
              </div>
            </div>

            {/* KPI 7: Active Sessions */}
            <div onClick={() => onSelectTab('login')} className="bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-3.5 hover:border-rose-400 hover:bg-white hover:shadow-[0_4px_16px_rgba(244,63,94,0.12)] transition-all cursor-pointer shadow-xs group flex flex-col gap-2 col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between">
                <div className="text-[9px] font-extrabold text-[#64748B] uppercase tracking-wider">SESSIONS</div>
                <div className="w-6 h-6 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600 group-hover:scale-110 transition-transform"><User size={14} /></div>
              </div>
              <div>
                <div className="flex items-baseline gap-1"><span className="text-lg font-black font-mono text-[#1E293B]">5</span><span className="text-[9px] font-bold text-rose-700 bg-rose-50 px-1 rounded border border-rose-200">Active</span></div>
                <div className="text-[9px] text-[#64748B] font-medium mt-0.5">3 roles logged in</div>
              </div>
            </div>
          </div>

          {/* 3. ROW 2: NEEDS ATTENTION (7 cols) + AUTONOMOUS PLATFORM ENGINES (5 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
            {/* Left: Needs Attention Center (7 cols) */}
            <div className="lg:col-span-7 bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-4 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#DDD9D0]">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </div>
                    <h2 className="text-xs font-black text-[#1E293B] uppercase tracking-wider">
                      NEEDS ATTENTION (ACTION CENTER)
                    </h2>
                  </div>
                  <span className="text-[10px] font-extrabold font-mono bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full shadow-2xs">
                    3 Actions Required
                  </span>
                </div>

                <div className="mt-3 space-y-2.5">
                  {/* Issue 1 */}
                  <div className="p-3 bg-white rounded-xl border border-rose-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 mt-1 flex-shrink-0 animate-pulse" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#1E293B] flex items-center gap-1.5">
                          <span>Gateway GW-06 offline</span>
                          <span className="text-[9px] font-mono text-rose-600 bg-rose-50 px-1 rounded">Heartbeat Timeout</span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                          Last ping: 4 min ago • Advantech UNO-2271G • Subnet 192.168.1.106
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => triggerOpAction('Pinging Gateway GW-06... Echo timeout after 3 tries.')}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 transition-all cursor-pointer"
                      >
                        Ping Node
                      </button>
                      <button
                        onClick={() => onSelectTab('iot')}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg border border-rose-200 transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <span>Investigate</span>
                        <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Issue 2 */}
                  <div className="p-3 bg-white rounded-xl border border-amber-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 mt-1 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#1E293B] flex items-center gap-1.5">
                          <span>Telemetry jitter on CNC-05</span>
                          <span className="text-[9px] font-mono text-amber-700 bg-amber-50 px-1 rounded">420 ms Buffer</span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                          Sensor broker queue buffer threshold is 200 ms • Channel: Spindle Accel
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => triggerOpAction('Flushed 10Hz MQTT buffer for CNC-05. Latency normalized to 12 ms.')}
                        className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold rounded-lg border border-amber-200 transition-all cursor-pointer"
                      >
                        Flush Queue
                      </button>
                      <button
                        onClick={() => onSelectTab('telemetry')}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <span>Inspect</span>
                        <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Issue 3 */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-1 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#1E293B] flex items-center gap-1.5">
                          <span>TLS Certificate expires in 12 days</span>
                          <span className="text-[9px] font-mono text-blue-700 bg-blue-50 px-1 rounded">GW-02</span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                          Edge Gateway GW-02 • x509 cert auto-renewal cron scheduled
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => triggerOpAction('TLS certificate auto-renewed for GW-02 (Valid until Sep 2027).')}
                        className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200 transition-all cursor-pointer"
                      >
                        Auto-Renew
                      </button>
                      <button
                        onClick={() => onSelectTab('login')}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <span>Review</span>
                        <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-[#DDD9D0] flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-500">
                  Telemetry health stream synchronized with Mosquitto daemon
                </span>
                <button
                  onClick={() => onSelectTab('iot')}
                  className="font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                >
                  <span>View IoT Hub</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>

            {/* Right: System Services Health (5 cols) */}
            <div className="lg:col-span-5 bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-4 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#DDD9D0]">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                      <Server className="w-3.5 h-3.5" />
                    </div>
                    <h2 className="text-xs font-black text-[#1E293B] uppercase tracking-wider">
                      SYSTEM SERVICES HEALTH
                    </h2>
                  </div>
                  <span className="text-[10px] font-extrabold font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full shadow-2xs">
                    6 / 6 Healthy
                  </span>
                </div>

                <div className="mt-3 space-y-1.5">
                  {[
                    { name: 'MQTT Broker (Mosquitto)', detail: 'Port 1883 · 100 Hz · 0 Drop', uptime: '99.9%', latency: '4 ms', dot: 'bg-emerald-500', badge: 'STREAMING' },
                    { name: 'TimescaleDB (Hypertable)', detail: '2,400 pts/sec · 14 chunks', uptime: '99.8%', latency: '10 ms', dot: 'bg-purple-500', badge: 'OPTIMAL' },
                    { name: 'TiDB Cloud MySQL', detail: '9/15 pool · TLSv1.2', uptime: '99.9%', latency: '14 ms', dot: 'bg-cyan-500', badge: 'OPTIMAL' },
                    { name: 'Node.js Express API', detail: 'Port 4000 · Socket.io live', uptime: '100%', latency: '1 ms', dot: 'bg-blue-500', badge: 'HEALTHY' },
                    { name: 'AI Inference Engine', detail: 'RUL model · 14 ms inference', uptime: '98.4%', latency: '14 ms', dot: 'bg-rose-400', badge: 'RUNNING' },
                    { name: 'Auto-Procurement POL-01', detail: '3 POs approved today', uptime: '100%', latency: '—', dot: 'bg-amber-500', badge: 'ACTIVE' },
                  ].map((svc, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-white rounded-xl border border-[#DDD9D0] text-xs hover:border-blue-200 transition-colors">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${svc.dot}`} />
                        <div className="min-w-0">
                          <div className="font-bold text-[#1E293B] truncate text-[11px]">{svc.name}</div>
                          <div className="text-[9px] text-slate-500 truncate">{svc.detail}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <div className="text-right hidden sm:block">
                          <div className="text-[9px] font-mono font-bold text-slate-600">{svc.uptime}</div>
                          <div className="text-[8px] text-slate-400">{svc.latency}</div>
                        </div>
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">{svc.badge}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-[#DDD9D0] flex items-center justify-between text-xs">
                <span className="text-[11px] font-mono text-slate-500">Avg Latency: 8.3 ms · v2.4.1</span>
                <button
                  onClick={() => { setShowDiagnostics(true); handleRunDiagnostics(); }}
                  className="font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                >
                  <span>Full Diagnostics</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>
          </div>

          {/* 4. ROW 3: SHIFT HANDOVER SUMMARY (6 cols) + USER ACCESS AUDIT LOG (6 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
            {/* Left: Shift Handover Summary */}
            <div className="lg:col-span-6 bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-[#DDD9D0]">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
                    <ClipboardList className="w-3.5 h-3.5" />
                  </div>
                  <h2 className="text-xs font-black text-[#1E293B] uppercase tracking-wider">SHIFT HANDOVER SUMMARY</h2>
                </div>
                <span className="text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">Day Shift · 06:00–14:00</span>
              </div>
              <div className="grid grid-cols-4 gap-2 mt-3">
                {[
                  { label: 'Incidents', value: '4', sub: '3 resolved', color: 'text-rose-600', bg: 'bg-rose-50 border-rose-200' },
                  { label: 'Work Orders', value: '7', sub: '5 completed', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'LOTO Events', value: '2', sub: '2 cleared', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Alarms Fired', value: '11', sub: '10 resolved', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
                ].map((s, i) => (
                  <div key={i} className={`p-2 rounded-xl border text-center ${s.bg}`}>
                    <div className={`text-base font-black font-mono ${s.color}`}>{s.value}</div>
                    <div className="text-[9px] font-extrabold text-slate-600 uppercase">{s.label}</div>
                    <div className="text-[8px] text-slate-500 mt-0.5">{s.sub}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">OPEN INCIDENTS HANDED OVER</div>
                {[
                  { id: 'INC-088', machine: 'GW-06', issue: 'Gateway offline — heartbeat timeout', sev: 'CRITICAL', sc: 'bg-rose-100 text-rose-700 border-rose-300' },
                  { id: 'INC-087', machine: 'CNC-05', issue: 'MQTT telemetry jitter (420ms)', sev: 'WARNING', sc: 'bg-amber-100 text-amber-700 border-amber-300' },
                  { id: 'INC-086', machine: 'GW-02', issue: 'TLS cert renewal pending (12d)', sev: 'INFO', sc: 'bg-blue-100 text-blue-700 border-blue-300' },
                ].map((inc, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 px-2 bg-white rounded-lg border border-[#E2E8F0] text-[10px]">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-bold text-slate-500">{inc.id}</span>
                      <span className="text-[9px] font-bold text-slate-400">[{inc.machine}]</span>
                      <span className="text-slate-700 font-medium truncate">{inc.issue}</span>
                    </div>
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ml-2 flex-shrink-0 ${inc.sc}`}>{inc.sev}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-2.5 border-t border-[#DDD9D0] flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-500">Next: Night Shift 22:00–06:00</span>
                <button onClick={() => onSelectTab('maintenance')} className="font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer">
                  <span>Full Shift Log</span><ArrowRight size={12} />
                </button>
              </div>
            </div>

            {/* Right: User Access Audit Log */}
            <div className="lg:col-span-6 bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-[#DDD9D0]">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                  <h2 className="text-xs font-black text-[#1E293B] uppercase tracking-wider">USER ACCESS AUDIT LOG</h2>
                </div>
                <span className="text-[10px] font-mono bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">5 Active Sessions</span>
              </div>
              <div className="mt-3 p-2.5 bg-white rounded-xl border border-[#DDD9D0]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">30-DAY SLA UPTIME</span>
                  <span className="text-[10px] font-black font-mono text-emerald-700">99.8% / Target 99.5%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-2 rounded-full" style={{ width: '99.8%' }} />
                </div>
                <div className="flex justify-between text-[8px] text-slate-400 mt-1 font-mono"><span>Sep 1</span><span>Sep 15</span><span>Sep 28</span></div>
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">RECENT ACCESS EVENTS</div>
                {[
                  { time: '11:42', user: 'Admin (You)', role: 'PLANT_ADMIN', action: 'Dashboard viewed', status: 'OK', sc: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
                  { time: '11:15', user: 'Arun Kumar', role: 'TECHNICIAN', action: 'WO-088 updated', status: 'OK', sc: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
                  { time: '10:58', user: 'Rajesh Singh', role: 'SUPERVISOR', action: 'Shift log submitted', status: 'OK', sc: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
                  { time: '10:32', user: 'Meera Nair', role: 'MANAGER', action: 'PO-2026-088 approved', status: 'OK', sc: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
                  { time: '09:18', user: 'Unknown', role: '—', action: 'Login failed (3 attempts)', status: 'DENIED', sc: 'text-rose-700 bg-rose-50 border-rose-200' },
                ].map((log, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5 px-2 bg-white rounded-lg border border-[#E2E8F0] text-[10px]">
                    <span className="font-mono font-bold text-slate-400 flex-shrink-0 w-9">{log.time}</span>
                    <span className="font-bold text-[#1E293B] flex-shrink-0 w-20 truncate">{log.user}</span>
                    <span className="text-[8px] font-bold text-slate-500 bg-slate-100 px-1 rounded flex-shrink-0">{log.role}</span>
                    <span className="text-slate-600 flex-1 truncate">{log.action}</span>
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${log.sc}`}>{log.status}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-2.5 border-t border-[#DDD9D0] flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-500">0 Policy Violations · TLS Auth: Active</span>
                <button onClick={() => onSelectTab('login')} className="font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer">
                  <span>Security Center</span><ArrowRight size={12} />
                </button>
              </div>
            </div>
          </div>

          {/* 5. ROW 4: RECENT SYSTEM EVENTS (FILTERED, HIGH-SIGNAL) */}
          <div className="bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#DDD9D0] gap-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <h2 className="text-xs font-black text-[#1E293B] uppercase tracking-wider">
                  RECENT SYSTEM EVENTS
                </h2>
                <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200">
                  Filtered: Critical &amp; System
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsStreamPaused(!isStreamPaused)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 border transition-colors cursor-pointer ${
                    isStreamPaused
                      ? 'bg-amber-50 text-amber-700 border-amber-300'
                      : 'bg-white text-slate-600 border-[#DDD9D0] hover:bg-slate-50'
                  }`}
                >
                  {isStreamPaused ? <Play size={10} /> : <Pause size={10} />}
                  <span>{isStreamPaused ? 'Resume' : 'Pause'}</span>
                </button>
              </div>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-[#DDD9D0] text-[10px] uppercase text-slate-500 font-extrabold bg-slate-50/50">
                    <th className="py-2 px-3">Time</th>
                    <th className="py-2 px-3">Severity</th>
                    <th className="py-2 px-3">Event</th>
                    <th className="py-2 px-3">Details</th>
                    <th className="py-2 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] text-[11px] bg-white">
                  {[
                    {
                      time: '11:38',
                      sev: 'CRITICAL',
                      icon: '🔴',
                      event: 'Gateway GW-06 disconnected',
                      details: 'Edge gateway heartbeat timed out after 3 ping attempts',
                      actionTab: 'iot',
                      actionText: 'Investigate'
                    },
                    {
                      time: '11:31',
                      sev: 'WARNING',
                      icon: '🟠',
                      event: 'Telemetry delay detected',
                      details: 'CNC-05 broker queue buffer reached 420 ms latency',
                      actionTab: 'telemetry',
                      actionText: 'Inspect'
                    },
                    {
                      time: '11:22',
                      sev: 'INFO',
                      icon: '🟢',
                      event: 'Service restart completed',
                      details: 'AI Orchestrator container gracefully recycled and warmed',
                      actionTab: '',
                      actionText: ''
                    },
                    {
                      time: '11:15',
                      sev: 'INFO',
                      icon: '🟢',
                      event: 'New user session — Arun Kumar',
                      details: 'Authenticated via biometric PIN • Role: Maintenance Tech',
                      actionTab: 'login',
                      actionText: 'Review'
                    },
                    {
                      time: '10:58',
                      sev: 'INFO',
                      icon: '🟢',
                      event: 'Security audit completed',
                      details: '0 vulnerabilities detected across 24 edge nodes & TLS certs',
                      actionTab: 'login',
                      actionText: 'Audit Log'
                    }
                  ].map((ev, idx) => (
                    <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-2 px-3 text-slate-500 font-bold whitespace-nowrap">{ev.time}</td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded border inline-flex items-center gap-1 ${
                            ev.sev === 'CRITICAL'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : ev.sev === 'WARNING'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          <span>{ev.icon}</span>
                          <span>{ev.sev}</span>
                        </span>
                      </td>
                      <td className="py-2 px-3 font-bold text-[#1E293B] font-sans whitespace-nowrap">{ev.event}</td>
                      <td className="py-2 px-3 text-slate-600 font-sans text-[11px]">{ev.details}</td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        {ev.actionText ? (
                          <button
                            onClick={() => onSelectTab(ev.actionTab)}
                            className="px-2 py-0.5 text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 cursor-pointer"
                          >
                            {ev.actionText}
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-mono">OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 6. ROW 5: PLANT CONNECTIVITY PIPELINE (6 cols) + QUICK RUNBOOK & OPERATIONS (6 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
            {/* Left: Plant Connectivity Pipeline (6 cols) */}
            <div className="lg:col-span-6 bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-4 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#DDD9D0]">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                      <Radio className="w-3.5 h-3.5" />
                    </div>
                    <h2 className="text-xs font-black text-[#1E293B] uppercase tracking-wider">
                      PLANT CONNECTIVITY &amp; DATA PIPELINE
                    </h2>
                  </div>
                  <span className="text-[10px] font-extrabold font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full shadow-2xs">
                    100 Hz Data Flow
                  </span>
                </div>

                {/* 3D Flow Architecture */}
                <div className="mt-3 p-3.5 bg-white rounded-xl border border-[#DDD9D0]">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-center">
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex-1 w-full shadow-2xs flex flex-col items-center">
                      <Icon3D type="edge" size={28} />
                      <div className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider mt-1">EDGE NODES</div>
                      <div className="text-xs font-mono font-bold text-[#1E293B]">24 Online</div>
                    </div>

                    <span className="text-slate-400 font-bold hidden sm:inline text-base">→</span>
                    <span className="text-slate-400 font-bold sm:hidden">↓</span>

                    <div className="p-2.5 bg-blue-50/60 rounded-xl border border-blue-200 flex-1 w-full shadow-2xs flex flex-col items-center">
                      <Icon3D type="telemetry" size={28} />
                      <div className="text-[9px] font-extrabold text-blue-700 uppercase tracking-wider mt-1">MQTT BROKER</div>
                      <div className="text-xs font-mono font-bold text-blue-900">● 100 Hz Live</div>
                    </div>

                    <span className="text-slate-400 font-bold hidden sm:inline text-base">→</span>
                    <span className="text-slate-400 font-bold sm:hidden">↓</span>

                    <div className="flex-1 w-full grid grid-cols-2 gap-1.5">
                      <div className="p-2 bg-purple-50/60 rounded-xl border border-purple-200 text-center flex flex-col items-center shadow-2xs">
                        <Icon3D type="server" size={22} />
                        <div className="text-[9px] font-extrabold text-purple-700 uppercase mt-0.5">Timescale</div>
                        <div className="text-[10px] font-mono font-bold text-purple-900">2.4k pts/s</div>
                      </div>
                      <div className="p-2 bg-cyan-50/60 rounded-xl border border-cyan-200 text-center flex flex-col items-center shadow-2xs">
                        <Icon3D type="database" size={22} />
                        <div className="text-[9px] font-extrabold text-cyan-700 uppercase mt-0.5">TiDB Cloud</div>
                        <div className="text-[10px] font-mono font-bold text-cyan-900">14 ms avg</div>
                      </div>
                    </div>
                  </div>

                  {/* 3 Summary Badges */}
                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100 text-center">
                    <div className="p-2 bg-slate-50 rounded-lg">
                      <div className="text-xs font-black font-mono text-[#1E293B]">25</div>
                      <div className="text-[9px] text-slate-500 font-semibold">Assets Connected</div>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-lg">
                      <div className="text-xs font-black font-mono text-emerald-700">24 / 25</div>
                      <div className="text-[9px] text-slate-500 font-semibold">Gateways Online</div>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-lg">
                      <div className="text-xs font-black font-mono text-purple-700">100 Hz</div>
                      <div className="text-[9px] text-slate-500 font-semibold">Telemetry Polling</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-[#DDD9D0] flex items-center justify-between text-xs">
                <button
                  onClick={() => onSelectTab('iot')}
                  className="font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                >
                  <span>Open Infrastructure</span>
                  <ArrowRight size={12} />
                </button>
                <button
                  onClick={() => onSelectTab('digital-twin')}
                  className="font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                >
                  <span>Open 3D Digital Twin</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>

            {/* Right: Quick Runbook & Operations (6 cols) */}
            <div className="lg:col-span-6 bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-4 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#DDD9D0]">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                      <Sliders className="w-3.5 h-3.5" />
                    </div>
                    <h2 className="text-xs font-black text-[#1E293B] uppercase tracking-wider">
                      QUICK RUNBOOK &amp; OPERATIONS
                    </h2>
                  </div>
                  <span className="text-[10px] font-extrabold font-mono bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full shadow-2xs">
                    Admin Tools
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                  {/* Tool 1: Infrastructure Ping */}
                  <div className="p-2.5 bg-white rounded-xl border border-[#DDD9D0] shadow-2xs flex flex-col justify-between">
                    <div>
                      <span className="font-bold text-[#1E293B]">Infrastructure Ping</span>
                      <div className="text-[10px] text-slate-500">Latency &amp; packet loss test</div>
                    </div>
                    <button
                      onClick={() => {
                        setShowDiagnostics(true);
                        handleRunDiagnostics();
                      }}
                      className="mt-2 w-full py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-bold border border-blue-200 transition-all text-center cursor-pointer"
                    >
                      Run Ping
                    </button>
                  </div>

                  {/* Tool 2: TiDB Schema Sync */}
                  <div className="p-2.5 bg-white rounded-xl border border-[#DDD9D0] shadow-2xs flex flex-col justify-between">
                    <div>
                      <span className="font-bold text-[#1E293B]">TiDB Cloud Sync</span>
                      <div className="text-[10px] text-slate-500">Reconcile assets &amp; schemas</div>
                    </div>
                    <button
                      onClick={() => {
                        triggerOpAction('TiDB Cloud Schema & Migration Reconciled (0 errors)');
                      }}
                      className="mt-2 w-full py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg font-bold border border-emerald-200 transition-all text-center cursor-pointer"
                    >
                      Sync Now
                    </button>
                  </div>

                  {/* Tool 3: Flush Edge Buffer */}
                  <div className="p-2.5 bg-white rounded-xl border border-[#DDD9D0] shadow-2xs flex flex-col justify-between">
                    <div>
                      <span className="font-bold text-[#1E293B]">Flush Edge Cache</span>
                      <div className="text-[10px] text-slate-500">Purge stale 10Hz buffer</div>
                    </div>
                    <button
                      onClick={() => {
                        triggerOpAction('Edge gateway buffers flushed successfully');
                      }}
                      className="mt-2 w-full py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg font-bold border border-amber-200 transition-all text-center cursor-pointer"
                    >
                      Flush Cache
                    </button>
                  </div>

                  {/* Tool 4: RBAC Scan */}
                  <div className="p-2.5 bg-white rounded-xl border border-[#DDD9D0] shadow-2xs flex flex-col justify-between">
                    <div>
                      <span className="font-bold text-[#1E293B]">RBAC Security Scan</span>
                      <div className="text-[10px] text-slate-500">Audit tokens &amp; TLS certs</div>
                    </div>
                    <button
                      onClick={() => {
                        triggerOpAction('RBAC Token & TLS Audit Complete: 0 CVEs');
                      }}
                      className="mt-2 w-full py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg font-bold border border-purple-200 transition-all text-center cursor-pointer"
                    >
                      Audit Scan
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-[#DDD9D0] flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-500">5 Active Sessions • 0 Policy Violations</span>
                <button
                  onClick={() => onSelectTab('login')}
                  className="font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                >
                  <span>Security Center</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. MANAGER DASHBOARD VIEW (All Production, Financials & Governance) */}
      {/* ───────────────────────────────────────────────────────────── */}
      {roleKey === 'MANAGER' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Header Banner */}
          <div className="bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1E293B] text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                <BarChart3 className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-sm font-black text-[#1E293B] tracking-tight uppercase">
                    PLANT OPERATIONS MANAGER — PRODUCTION, FINANCIALS &amp; GOVERNANCE
                  </h1>
                  <span className="text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                    Day Shift 96.4% on Target
                  </span>
                </div>
                <p className="text-[11px] text-[#64748B] font-medium mt-0.5">
                  Comprehensive piece output, carton packaging fulfillment, OEE health, MRO budget, and executive reviews.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onSelectTab('production')}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>Production Console</span>
                <ArrowRight size={12} />
              </button>
            </div>
          </div>

          {/* 4 Top Production & Financial KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              label="Daily Production Volume"
              value="4,820 pcs"
              subtitle="Target: 5,000 pcs (96.4% Goal)"
              delta="+3.2%"
              icon={<Boxes size={16} className="text-blue-700" />}
              iconBg="bg-blue-50 text-blue-700 border border-blue-200"
              onClick={() => onSelectTab('production')}
            />
            <KpiCard
              label="Cartons Packed & Sealed"
              value="1,205 ctn"
              subtitle="48 Pallets Ready for Dispatch"
              delta="+1.8%"
              icon={<Package size={16} className="text-emerald-700" />}
              iconBg="bg-emerald-50 text-emerald-700 border border-emerald-200"
              onClick={() => onSelectTab('production')}
            />
            <KpiCard
              label="Overall Equipment Effectiveness"
              value="88.4%"
              subtitle="Plant-wide across 6 cells"
              delta="+2.1%"
              icon={<Zap size={16} className="text-amber-700" />}
              iconBg="bg-amber-50 text-amber-700 border border-amber-200"
              onClick={() => onSelectTab('review')}
            />
            <KpiCard
              label="Total Parts Spend"
              value={`$${totalSpend.toLocaleString()}`}
              subtitle="Budget: $25,000 (59.4% used)"
              icon={<DollarSign size={16} className="text-emerald-700" />}
              iconBg="bg-emerald-50 text-emerald-700 border border-emerald-200"
              onClick={() => onSelectTab('procurement')}
            />
          </div>

          {/* Row 1: Manufacturing Line Production & Executive Human Reviews */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
            {/* Cell Output vs Target */}
            <div className="lg:col-span-8 bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-[#DDD9D0] pb-2">
                <h3 className="text-xs font-extrabold text-[#1E293B] uppercase tracking-wider flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-blue-600" />
                  <span>Manufacturing Line Piece Production &amp; Carton Fill Rates</span>
                </h3>
                <span className="text-[10px] font-mono font-bold text-emerald-700">6 Cells Synchronized</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
                {[
                  { cell: 'CNC-01 Spindle Mill', output: '1,240 / 1,500 pcs', rate: '112 pcs/hr', oee: '92.4%', status: 'ON TARGET' },
                  { cell: 'CNC-02 Precision Mill', output: '1,180 / 1,500 pcs', rate: '108 pcs/hr', oee: '88.7%', status: 'ON TARGET' },
                  { cell: 'ROBOT-01 Welding Cell', output: '2,420 welds', rate: '220 welds/hr', oee: '96.8%', status: 'OPTIMAL' },
                  { cell: 'PUMP-01 Coolant Loop', output: '4,800 L pumped', rate: '42 L/min', oee: '97.2%', status: 'OPTIMAL' },
                  { cell: 'ASMB-01 Assembly Line', output: '2,420 sub-units', rate: '220 units/hr', oee: '97.5%', status: 'OPTIMAL' },
                  { cell: 'PACK-01 Carton Station', output: '605 Cartons (12/min)', rate: '273 pcs/hr', oee: '95.8%', status: 'PALLETIZING' }
                ].map((c, i) => (
                  <div key={i} className="bg-white p-3 rounded-xl border border-[#DDD9D0] flex flex-col justify-between shadow-2xs">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-[#1E293B] text-xs">{c.cell}</span>
                        <span className="text-[9px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                          {c.status}
                        </span>
                      </div>
                      <div className="text-sm font-black font-mono text-blue-700 mt-1">{c.output}</div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                      <span>Rate: <strong>{c.rate}</strong></span>
                      <span>OEE: <strong className="text-emerald-700">{c.oee}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Executive Human Reviews */}
            <div className="lg:col-span-4 bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-4 shadow-xs space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[#DDD9D0] pb-2">
                  <h3 className="text-xs font-extrabold text-[#1E293B] uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                    <span>Executive Human Reviews</span>
                  </h3>
                  <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                    {displayReviews.length} Pending Sign-Off
                  </span>
                </div>

                <div className="space-y-2 mt-2.5 text-xs">
                  {displayReviews.slice(0, 2).map((item) => (
                    <div key={item.id} className="p-2.5 bg-white rounded-xl border border-[#DDD9D0] shadow-2xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#1E293B] text-[11px]">{item.title}</span>
                        <span className="font-mono text-[10px] font-bold text-blue-600">${parseFloat(item.total_amount || '180').toFixed(2)}</span>
                      </div>
                      <p className="text-[10px] text-slate-500">{item.reason}</p>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => onSelectTab('review')}
                className="w-full mt-2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer"
              >
                <span>Open Human Review Center</span>
                <ChevronRight size={12} />
              </button>
            </div>
          </div>

          {/* Row 2: Financial MRO Budget Breakdown & Outbound Logistics */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
            {/* Financial MRO Budget Breakdown */}
            <div className="lg:col-span-6 bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-[#DDD9D0] pb-2">
                <h3 className="text-xs font-extrabold text-[#1E293B] uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  <span>MRO Maintenance Budget &amp; Category Cap</span>
                </h3>
                <span className="text-[10px] font-mono font-bold text-emerald-700">$14,850 / $25,000 (59.4%)</span>
              </div>

              <div className="space-y-2.5 text-xs">
                {/* Progress Bar */}
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-600 h-full rounded-full transition-all duration-500" style={{ width: '59.4%' }} />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {[
                    { cat: 'Bearings & Bushings', spend: '$5,640', pct: '38%' },
                    { cat: 'Pneumatics & Valves', spend: '$3,560', pct: '24%' },
                    { cat: 'Sensors & Encoders', spend: '$2,680', pct: '18%' },
                    { cat: 'Drives & Belts', spend: '$2,970', pct: '20%' }
                  ].map((cat, idx) => (
                    <div key={idx} className="bg-white p-2.5 rounded-xl border border-[#DDD9D0] shadow-2xs">
                      <div className="text-[10px] text-slate-500 truncate">{cat.cat}</div>
                      <div className="text-xs font-bold text-[#1E293B] font-mono mt-0.5">{cat.spend}</div>
                      <div className="text-[9px] font-bold text-slate-400 font-mono">{cat.pct} share</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tier-1 Supplier SLA & Outbound Logistics */}
            <div className="lg:col-span-6 bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-[#DDD9D0] pb-2">
                <h3 className="text-xs font-extrabold text-[#1E293B] uppercase tracking-wider flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-blue-600" />
                  <span>Tier-1 Supplier SLA &amp; Warehouse Dispatch</span>
                </h3>
                <button onClick={() => onSelectTab('suppliers')} className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer">
                  Supplier Directory &rarr;
                </button>
              </div>

              <div className="space-y-2 text-xs">
                {[
                  { name: 'Motion Industries MRO', sla: '99.2%', lead: '24h Lead', status: 'PREFERRED' },
                  { name: 'SKF Industrial Distribution', sla: '98.5%', lead: '48h Lead', status: 'ACTIVE' },
                  { name: 'Festo Pneumatics North America', sla: '97.1%', lead: '36h Lead', status: 'ACTIVE' }
                ].map((s, idx) => (
                  <div key={idx} className="bg-white p-2.5 rounded-xl border border-[#DDD9D0] flex items-center justify-between shadow-2xs">
                    <div>
                      <div className="font-bold text-[#1E293B] text-[11px]">{s.name}</div>
                      <div className="text-[10px] text-[#64748B]">{s.lead} &bull; ISO 9001 Certified</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {s.sla} SLA
                      </span>
                      <span className="text-[9px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-mono">
                        {s.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. SUPERVISOR DASHBOARD VIEW (Shopfloor Execution & Maintenance) */}
      {/* ───────────────────────────────────────────────────────────── */}
      {roleKey === 'SUPERVISOR' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Header Banner */}
          <div className="bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1E293B] text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                <Timer className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-sm font-black text-[#1E293B] tracking-tight uppercase">
                    SHIFT SUPERVISOR — SHOPFLOOR EXECUTION, MAINTENANCE &amp; LOGISTICS
                  </h1>
                  <span className="text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                    Shift A: Active (06:00 - 14:00)
                  </span>
                </div>
                <p className="text-[11px] text-[#64748B] font-medium mt-0.5">
                  Live CNC machining cycles, carton packaging throughput, autonomous AGV fleet, PM schedules, and technician coverage.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onSelectTab('production')}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>Live Machine Console</span>
                <ArrowRight size={12} />
              </button>
            </div>
          </div>

          {/* 4 Execution KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              label="Active Shopfloor Assets"
              value={`${runningCount} / ${totalMachinesCount}`}
              subtitle="25 Total Machines Monitored"
              icon={<Cpu size={16} className="text-blue-700" />}
              iconBg="bg-blue-50 text-blue-700 border border-blue-200"
              onClick={() => onSelectTab('twin')}
            />
            <KpiCard
              label="Live CNC Pieces Machined"
              value="2,420 pcs"
              subtitle="CNC-01: 1,240 • CNC-02: 1,180"
              delta="+1.4%"
              icon={<Boxes size={16} className="text-blue-700" />}
              iconBg="bg-blue-50 text-blue-700 border border-blue-200"
              onClick={() => onSelectTab('production')}
            />
            <KpiCard
              label="Cartons Filled at PACK-01"
              value="605 ctn"
              subtitle="24 pcs/ctn • 12 boxes/min"
              delta="+2.1%"
              icon={<Package size={16} className="text-emerald-700" />}
              iconBg="bg-emerald-50 text-emerald-700 border border-emerald-200"
              onClick={() => onSelectTab('production')}
            />
            <KpiCard
              label="Technicians On Duty"
              value="12 / 12"
              subtitle="4 Clusters Fully Staffed"
              icon={<HardHat size={16} className="text-amber-700" />}
              iconBg="bg-amber-50 text-amber-700 border border-amber-200"
              onClick={() => onSelectTab('technicians')}
            />
          </div>

          {/* Row 1: Real-time Piece Counters & AGV Logistics Fleet */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
            {/* CNC Machine Piece Counters */}
            <div className="lg:col-span-7 bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-[#DDD9D0] pb-2">
                <h3 className="text-xs font-extrabold text-[#1E293B] uppercase tracking-wider flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-blue-600" />
                  <span>Real-Time Machine Piece Counters &amp; Cycle Times</span>
                </h3>
                <span className="text-[10px] font-mono font-bold text-emerald-700">Target: 270 pcs/hr</span>
              </div>

              <div className="space-y-2 text-xs">
                {[
                  {
                    id: 'CNC-01',
                    name: 'Machining Cell 1 (Roughing & Boring)',
                    produced: '1,240 / 1,500 pcs',
                    cycle: '42.4s',
                    toolWear: '14%',
                    status: 'RUNNING',
                    progress: '82.6%'
                  },
                  {
                    id: 'CNC-02',
                    name: 'Machining Cell 2 (Finishing & Chamfer)',
                    produced: '1,180 / 1,500 pcs',
                    cycle: '44.1s',
                    toolWear: '22%',
                    status: 'RUNNING',
                    progress: '78.6%'
                  },
                  {
                    id: 'ASMB-01',
                    name: 'Assembly Station 1 (Bushing Insertion)',
                    produced: '2,420 sub-units',
                    cycle: '18.2s',
                    toolWear: 'Nominal',
                    status: 'OPTIMAL',
                    progress: '96.8%'
                  },
                  {
                    id: 'PACK-01',
                    name: 'Carton Packaging & Palletizer Station',
                    produced: '605 Cartons (14,520 pcs)',
                    cycle: '5.0s / box',
                    toolWear: 'Nominal',
                    status: 'PALLETIZING',
                    progress: '100.8%'
                  }
                ].map((m, idx) => (
                  <div key={idx} className="p-3 bg-white rounded-xl border border-[#DDD9D0] shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-blue-700 text-xs">{m.id}</span>
                        <span className="font-bold text-[#1E293B]">{m.name}</span>
                      </div>
                      <span className="text-[9px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {m.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-slate-600 bg-slate-50 p-2 rounded-lg">
                      <div>Count: <strong className="text-blue-900">{m.produced}</strong></div>
                      <div>Cycle Time: <strong className="text-slate-900">{m.cycle}</strong></div>
                      <div>Tool Health: <strong className="text-emerald-700">{m.toolWear}</strong></div>
                    </div>

                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-blue-600 h-full rounded-full transition-all duration-500" style={{ width: m.progress }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Live AGV Material Handling Fleet */}
            <div className="lg:col-span-5 bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-4 shadow-xs space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[#DDD9D0] pb-2">
                  <h3 className="text-xs font-extrabold text-[#1E293B] uppercase tracking-wider flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-purple-600" />
                    <span>Autonomous AGV Material Handling Fleet</span>
                  </h3>
                  <span className="text-[10px] font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                    3 Active AGVs
                  </span>
                </div>

                <div className="space-y-2 mt-2.5 text-xs font-mono">
                  {[
                    {
                      id: 'AGV-01',
                      payload: 'Raw Billet Batch #4 (Aluminium)',
                      route: 'Warehouse Bay B → CNC-01',
                      battery: '94%',
                      state: 'IN TRANSIT',
                      speed: '1.4 m/s'
                    },
                    {
                      id: 'AGV-02',
                      payload: 'Machined Housings Batch #882',
                      route: 'CNC-02 → ASMB-01 Station',
                      battery: '88%',
                      state: 'DELIVERING',
                      speed: '1.2 m/s'
                    },
                    {
                      id: 'AGV-03',
                      payload: 'Sealed Cartons Pallet #12',
                      route: 'PACK-01 → Shipping Dock 4',
                      battery: '99%',
                      state: 'DISPATCHED',
                      speed: '1.5 m/s'
                    }
                  ].map((agv, idx) => (
                    <div key={idx} className="p-3 bg-white rounded-xl border border-[#DDD9D0] shadow-2xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <strong className="text-purple-700 text-xs">{agv.id}</strong>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                          {agv.state} • {agv.battery}
                        </span>
                      </div>
                      <div className="font-sans text-[11px] font-bold text-[#1E293B]">{agv.payload}</div>
                      <div className="text-[10px] text-slate-500 font-sans flex items-center justify-between">
                        <span>Route: {agv.route}</span>
                        <span className="font-mono text-slate-700">{agv.speed}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => onSelectTab('digital-twin')}
                className="w-full mt-2 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer"
              >
                <span>Track Fleet in 3D Digital Twin</span>
                <ChevronRight size={12} />
              </button>
            </div>
          </div>

          {/* Row 2: Preventative Maintenance Schedules & Technician Roster */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
            {/* PM Schedules */}
            <div className="lg:col-span-7 bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-4 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between border-b border-[#DDD9D0] pb-2">
                <h3 className="text-xs font-extrabold text-[#1E293B] uppercase tracking-wider flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-blue-600" />
                  <span>Upcoming Preventative Maintenance Schedules</span>
                </h3>
                <button
                  onClick={() => onSelectTab('maintenance')}
                  className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  Manage PM Console &rarr;
                </button>
              </div>

              <div className="space-y-2 text-xs">
                {[
                  { code: 'CNC-01', task: 'Spindle Taper Runout & ISO Balancing', interval: '90d', tech: 'Arun Kumar', due: '26 Sep 2026' },
                  { code: 'ROBOT-01', task: 'Harmonic Drive Backlash Check', interval: '120d', tech: 'Priya Sharma', due: '28 Sep 2026' },
                  { code: 'PUMP-01', task: 'Filter Cartridge & Pressure Seal Test', interval: '30d', tech: 'Rajesh Nair', due: '25 Sep 2026' },
                  { code: 'MIXER-01', task: 'Agitator Gearbox Oil Flush', interval: '60d', tech: 'Carlos Gomez', due: '30 Sep 2026' }
                ].map((pm, idx) => (
                  <div key={idx} className="bg-white p-2.5 rounded-xl border border-[#DDD9D0] shadow-2xs flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-blue-700 text-xs">{pm.code}</span>
                        <span className="font-bold text-[#1E293B] text-[11px]">{pm.task}</span>
                      </div>
                      <div className="text-[10px] text-[#64748B] mt-0.5">Assigned: {pm.tech} &bull; Due: {pm.due}</div>
                    </div>
                    <button
                      onClick={() => onSelectTab('maintenance')}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold shadow-2xs cursor-pointer"
                    >
                      Dispatch
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Technician Coverage */}
            <div className="lg:col-span-5 bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-4 shadow-xs space-y-2.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[#DDD9D0] pb-2">
                  <h3 className="text-xs font-extrabold text-[#1E293B] uppercase tracking-wider flex items-center gap-1.5">
                    <HardHat className="w-3.5 h-3.5 text-blue-600" />
                    <span>Cluster Technician Coverage</span>
                  </h3>
                  <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Shift A
                  </span>
                </div>

                <div className="space-y-1.5 mt-2 text-xs">
                  {[
                    { name: 'Arun Kumar', role: 'Vibration & Spindles', cluster: 'Bay 1 (Machining)', radio: 'CH-01', active: 1 },
                    { name: 'Priya Sharma', role: 'Robotics & Drives', cluster: 'Bay 2 (Robot Cell)', radio: 'CH-02', active: 0 },
                    { name: 'Carlos Gomez', role: 'Hydraulics & Fluids', cluster: 'Bay 3 (Processing)', radio: 'CH-03', active: 0 },
                    { name: 'Rajesh Nair', role: 'Pneumatics & Torque', cluster: 'Bay 4 (Assembly)', radio: 'CH-04', active: 0 }
                  ].map((t, idx) => (
                    <div key={idx} className="bg-white p-2.5 rounded-xl border border-[#DDD9D0] shadow-2xs flex items-center justify-between text-[11px]">
                      <div>
                        <strong className="text-[#1E293B]">{t.name}</strong>
                        <div className="text-[10px] text-[#64748B]">{t.cluster} &bull; {t.radio}</div>
                      </div>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {t.active > 0 ? '1 Active Job' : 'Available'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => onSelectTab('technicians')}
                className="w-full mt-2 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-[#DDD9D0] rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>View Full Technicians Roster</span>
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 5. TECHNICIAN DASHBOARD VIEW (Field Specialist Workstation)   */}
      {/* ───────────────────────────────────────────────────────────── */}
      {roleKey === 'TECHNICIAN' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              label="Assigned Cluster"
              value="CNC-01..03"
              subtitle="Machining Cell • 3 Assets"
              icon={<Cpu size={16} className="text-teal-700" />}
              iconBg="bg-teal-50 text-teal-700 border border-teal-200"
              onClick={() => onSelectTab('twin')}
            />
            <KpiCard
              label="Active Work Orders"
              value={activeWorkOrders.length}
              subtitle="Ready for inspection"
              icon={<ClipboardList size={16} className="text-blue-700" />}
              iconBg="bg-blue-50 text-blue-700 border border-blue-200"
              onClick={() => onSelectTab('work-orders')}
            />
            <KpiCard
              label="OSHA 1910.147 LOTO"
              value="100%"
              subtitle="Zero-energy verified"
              icon={<ShieldCheck size={16} className="text-emerald-700" />}
              iconBg="bg-emerald-50 text-emerald-700 border border-emerald-200"
              onClick={() => onSelectTab('work-orders')}
            />
            <KpiCard
              label="Shift Radio Channel"
              value="CH-01"
              subtitle="Machining Frequency"
              icon={<Radio size={16} className="text-amber-700" />}
              iconBg="bg-amber-50 text-amber-700 border border-amber-200"
              onClick={() => onSelectTab('maintenance')}
            />
          </div>

          {/* Technician Action Queue & Safety Lockout Protocol */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
            {/* Work Order Action Queue */}
            <div className="lg:col-span-7 bg-[#FAF9F6] border border-[#DDD9D0] rounded-xl p-4 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between border-b border-[#DDD9D0] pb-2">
                <h3 className="text-xs font-extrabold text-[#1E293B] uppercase tracking-wider flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-blue-600" />
                  <span>My Active Work Orders &amp; Action Queue</span>
                </h3>
                <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.2 rounded border border-blue-200">
                  Priority Action
                </span>
              </div>

              <div className="space-y-2 text-xs">
                {activeWorkOrders.map((wo) => (
                  <div key={wo.id} className="bg-white p-3 rounded-lg border border-[#DDD9D0] space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-blue-700 text-xs">{wo.id}</span>
                        <span className="font-bold text-[#1E293B] text-xs">{wo.machine_code || 'CNC-01'}</span>
                        <span className="text-[10px] font-bold px-2 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200">
                          {wo.status}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-400 font-bold">HIGH PRIORITY</span>
                    </div>

                    <div className="text-[11px] text-slate-600">
                      Task: <strong className="text-[#1E293B]">{wo.notes || 'Spindle Bearing Replacement & Dynamic Balancing'}</strong>
                      <div className="mt-0.5">Required Spare: <strong className="text-blue-700">SKF-6205-2RSH (Staged in BAY-A-04)</strong></div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <div className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                        <ShieldCheck size={12} /> OSHA LOTO Verified (0.0V / 0.0 bar)
                      </div>
                      <button
                        onClick={() => onSelectTab('work-orders')}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold transition-all shadow-2xs cursor-pointer"
                      >
                        Open Work Order &rarr;
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Zero-Energy Envelope & Cluster Vitals */}
            <div className="lg:col-span-5 bg-[#FAF9F6] border border-[#DDD9D0] rounded-xl p-4 shadow-xs space-y-2.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[#DDD9D0] pb-2">
                  <h3 className="text-xs font-extrabold text-[#1E293B] uppercase tracking-wider flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Cluster Asset Vitals (CNC-01..03)</span>
                  </h3>
                  <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.2 rounded border border-emerald-200">
                    Live Telemetry
                  </span>
                </div>

                <div className="space-y-1.5 mt-2 text-xs font-mono">
                  <div className="p-2 bg-white rounded-lg border border-[#DDD9D0] flex items-center justify-between">
                    <div>
                      <strong className="text-blue-700">CNC-01 (Milling)</strong>
                      <div className="text-[10px] text-slate-400 font-sans">Spindle Axis 1</div>
                    </div>
                    <div className="text-right">
                      <div className="text-rose-600 font-black text-xs">7.82 mm/s</div>
                      <div className="text-[9px] text-slate-400 font-sans">Vibration High</div>
                    </div>
                  </div>

                  <div className="p-2 bg-white rounded-lg border border-[#DDD9D0] flex items-center justify-between">
                    <div>
                      <strong className="text-[#1E293B]">CNC-02 (Turning)</strong>
                      <div className="text-[10px] text-slate-400 font-sans">Main Spindle</div>
                    </div>
                    <div className="text-right">
                      <div className="text-emerald-700 font-bold text-xs">2.14 mm/s</div>
                      <div className="text-[9px] text-emerald-700 font-sans">Nominal</div>
                    </div>
                  </div>

                  <div className="p-2 bg-white rounded-lg border border-[#DDD9D0] flex items-center justify-between">
                    <div>
                      <strong className="text-[#1E293B]">CNC-03 (5-Axis)</strong>
                      <div className="text-[10px] text-slate-400 font-sans">High-Speed Mill</div>
                    </div>
                    <div className="text-right">
                      <div className="text-emerald-700 font-bold text-xs">1.88 mm/s</div>
                      <div className="text-[9px] text-emerald-700 font-sans">Nominal</div>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => onSelectTab('telemetry')}
                className="w-full mt-2 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-[#DDD9D0] rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>Open Live Telemetry Oscilloscope</span>
                <ChevronRight size={12} />
              </button>
            </div>
          </div>

          {/* Row 2: OSHA 1910.147 LOTO Verification Matrix & RAG AI Copilot */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
            {/* OSHA LOTO Lockout Checklist */}
            <div className="lg:col-span-6 bg-[#FAF9F6] border border-[#DDD9D0] rounded-xl p-4 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between border-b border-[#DDD9D0] pb-2">
                <h3 className="text-xs font-extrabold text-[#1E293B] uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>OSHA 1910.147 Zero-Energy Lockout Protocol</span>
                </h3>
                <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.2 rounded border border-emerald-200">
                  LOTO Enforced
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                {[
                  { step: '1. Primary Electrical 480V 3-Phase Disconnect', verified: '0.0 Volts AC (Zero energy confirmed)', padlock: 'Padlock #PL-8894A' },
                  { step: '2. Pneumatic Air Supply Valve Exhaust', verified: '0.0 bar manifold pressure (Bleed complete)', padlock: 'Hasps Locked' },
                  { step: '3. Mechanical Spindle Locking Pin', verified: 'Physical travel restraint engaged', padlock: 'Pin Retained' }
                ].map((l, i) => (
                  <div key={i} className="p-2 bg-white rounded-lg border border-[#DDD9D0] flex items-center justify-between">
                    <div>
                      <div className="font-bold text-[#1E293B] text-[11px]">{l.step}</div>
                      <div className="text-[10px] text-emerald-700">{l.verified}</div>
                    </div>
                    <span className="text-[9px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      {l.padlock}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Field Copilot / SOP Quick Lookup */}
            <div className="lg:col-span-6 bg-[#FAF9F6] border border-[#DDD9D0] rounded-xl p-4 shadow-xs space-y-2.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[#DDD9D0] pb-2">
                  <h3 className="text-xs font-extrabold text-[#1E293B] uppercase tracking-wider flex items-center gap-1.5">
                    <Bot className="w-3.5 h-3.5 text-purple-600" />
                    <span>AI Maintenance Copilot &amp; SOP Specs</span>
                  </h3>
                  <span className="text-[10px] font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.2 rounded border border-purple-200">
                    RAG Knowledge Base
                  </span>
                </div>

                <div className="space-y-1.5 mt-2 text-xs">
                  <div className="p-2 bg-white rounded-lg border border-[#DDD9D0]">
                    <div className="font-bold text-[#1E293B] text-[11px]">SKF-6205 Spindle Bearing Torque Spec</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Tighten locking collar to <strong>35 Nm</strong> cross-pattern. Grease volume: <strong>15g Mobil Polyrex EM</strong>.</div>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-[#DDD9D0]">
                    <div className="font-bold text-[#1E293B] text-[11px]">Dynamic Runout Acceptance Limit</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">ISO 1940-1 Grade G2.5: Total radial runout must measure <strong>&lt; 0.005 mm</strong>.</div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => onSelectTab('ai-orch')}
                className="w-full mt-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer"
              >
                <span>Launch Multi-Agent AI Orchestrator</span>
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 6. INVENTORY MGMT DASHBOARD VIEW (Materials & ATP Control)    */}
      {/* ───────────────────────────────────────────────────────────── */}
      {roleKey === 'INVENTORY_MGMT' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              label="Total Managed SKUs"
              value={displayInventory.length}
              subtitle="TiDB Cloud Catalog"
              icon={<Boxes size={16} className="text-blue-700" />}
              iconBg="bg-blue-50 text-blue-700 border border-blue-200"
              onClick={() => onSelectTab('inventory')}
            />
            <KpiCard
              label="Stockout Risks"
              value={lowStockCount}
              subtitle="Below 2x safety stock buffer"
              deltaUp={true}
              icon={<AlertTriangle size={16} className="text-rose-700" />}
              iconBg="bg-rose-50 text-rose-700 border border-rose-200"
              onClick={() => onSelectTab('inventory')}
            />
            <KpiCard
              label="Active POs In Transit"
              value={displayPOs.filter(p => p.status !== 'RECEIVED').length}
              subtitle="Expected within 1-2 business days"
              icon={<Truck size={16} className="text-purple-700" />}
              iconBg="bg-purple-50 text-purple-700 border border-purple-200"
              onClick={() => onSelectTab('procurement')}
            />
            <KpiCard
              label="POL-01 Autonomous Reorders"
              value="100%"
              subtitle="Spend < $1,000 threshold"
              icon={<Bot size={16} className="text-emerald-700" />}
              iconBg="bg-emerald-50 text-emerald-700 border border-emerald-200"
              onClick={() => onSelectTab('procurement')}
            />
          </div>

          {/* Low Buffer Spares Console & Incoming GRN Deliveries */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
            {/* Critical Spares ATP Table */}
            <div className="lg:col-span-7 bg-[#FAF9F6] border border-[#DDD9D0] rounded-xl p-4 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between border-b border-[#DDD9D0] pb-2">
                <h3 className="text-xs font-extrabold text-[#1E293B] uppercase tracking-wider flex items-center gap-1.5">
                  <Boxes className="w-3.5 h-3.5 text-blue-600" />
                  <span>Critical Spare Parts &amp; Buffer Levels</span>
                </h3>
                <button
                  onClick={() => onSelectTab('inventory')}
                  className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  Manage All Inventory &rarr;
                </button>
              </div>

              <div className="space-y-1.5 text-xs">
                {displayInventory.slice(0, 4).map((item) => {
                  const atp = item.available_to_promise ?? (item.quantity_on_hand - item.reserved_quantity);
                  const isLow = atp <= 2;
                  return (
                    <div key={item.id} className="bg-white p-2.5 rounded-lg border border-[#DDD9D0] flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-blue-700 text-xs">{item.part_number}</span>
                          <span className="font-bold text-[#1E293B] text-[11px] truncate max-w-[160px]">{item.name}</span>
                        </div>
                        <div className="text-[10px] text-[#64748B] mt-0.5">
                          Bin: <strong className="text-[#1E293B] font-mono">{item.bin_location}</strong> &bull; On Hand: {item.quantity_on_hand} &bull; Reserved: {item.reserved_quantity}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`font-mono text-xs font-extrabold px-2 py-0.5 rounded border ${
                          isLow ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {atp} ATP
                        </span>
                        <button
                          onClick={() => onSelectTab('inventory')}
                          className="px-2 py-1 bg-white hover:bg-slate-100 border border-[#DDD9D0] rounded text-[11px] font-bold text-slate-700 cursor-pointer"
                        >
                          Inspect
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Inbound Shipments & Dock GRN */}
            <div className="lg:col-span-5 bg-[#FAF9F6] border border-[#DDD9D0] rounded-xl p-4 shadow-xs space-y-2.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[#DDD9D0] pb-2">
                  <h3 className="text-xs font-extrabold text-[#1E293B] uppercase tracking-wider flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-purple-600" />
                    <span>Inbound PO Deliveries (GRN Dock)</span>
                  </h3>
                  <span className="text-[10px] font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.2 rounded border border-purple-200">
                    Priority EDI
                  </span>
                </div>

                <div className="space-y-2 mt-2 text-xs">
                  {displayPOs.filter(p => p.status !== 'RECEIVED').slice(0, 2).map((po) => (
                    <div key={po.id} className="bg-white p-2.5 rounded-lg border border-[#DDD9D0] space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-purple-700 text-xs">{po.id}</span>
                        <span className="text-[10px] font-bold px-2 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200">
                          {po.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#1E293B] font-semibold">{po.part_name || po.part_number}</div>
                      <div className="text-[10px] text-[#64748B] flex items-center justify-between pt-1">
                        <span>Supplier: <strong>{po.supplier_name || 'Motion Industries'}</strong></span>
                        <span className="font-mono font-bold text-[#1E293B]">${parseFloat(po.total_amount?.toString() || '180').toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => onSelectTab('procurement')}
                className="w-full mt-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer"
              >
                <span>Open Autonomous Procurement</span>
                <ChevronRight size={12} />
              </button>
            </div>
          </div>

          {/* Row 2: Warehouse Bin Layout & Autonomous Reorder Policy Stream */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
            {/* Warehouse Bin Storage Locations */}
            <div className="lg:col-span-6 bg-[#FAF9F6] border border-[#DDD9D0] rounded-xl p-4 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between border-b border-[#DDD9D0] pb-2">
                <h3 className="text-xs font-extrabold text-[#1E293B] uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-blue-600" />
                  <span>Warehouse Storage Aisles (MRO Central)</span>
                </h3>
                <span className="text-[10px] font-mono font-bold text-blue-700">3 Active Bays</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                {[
                  { bay: 'BAY-A', title: 'Bearings & Belts', items: '12 SKUs', fill: '78%' },
                  { bay: 'BAY-B', title: 'Valves & Cylinders', items: '18 SKUs', fill: '64%' },
                  { bay: 'BAY-C', title: 'Sensors & Relays', items: '24 SKUs', fill: '89%' }
                ].map((b, idx) => (
                  <div key={idx} className="bg-white p-2.5 rounded-lg border border-[#DDD9D0]">
                    <div className="font-mono font-bold text-blue-700 text-xs">{b.bay}</div>
                    <div className="text-[11px] font-bold text-[#1E293B] mt-0.5">{b.title}</div>
                    <div className="text-[10px] text-slate-500 mt-1">{b.items} &bull; {b.fill} Cap</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Reorder Policy Engine POL-01 Status */}
            <div className="lg:col-span-6 bg-[#FAF9F6] border border-[#DDD9D0] rounded-xl p-4 shadow-xs space-y-2.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[#DDD9D0] pb-2">
                  <h3 className="text-xs font-extrabold text-[#1E293B] uppercase tracking-wider flex items-center gap-1.5">
                    <Bot className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Autonomous Policy POL-01 Engine</span>
                  </h3>
                  <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.2 rounded border border-emerald-200">
                    Auto-Replenish Active
                  </span>
                </div>

                <div className="space-y-1.5 mt-2 text-xs">
                  <div className="p-2 bg-white rounded-lg border border-[#DDD9D0] flex items-center justify-between">
                    <div>
                      <span className="font-bold text-[#1E293B]">Threshold Policy POL-01</span>
                      <div className="text-[10px] text-slate-500">Autonomous approval for POs under $1,000 when ATP &le; Safety Stock</div>
                    </div>
                    <span className="text-[9px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      ENABLED
                    </span>
                  </div>

                  <div className="p-2 bg-white rounded-lg border border-[#DDD9D0] flex items-center justify-between">
                    <div>
                      <span className="font-bold text-[#1E293B]">Anti-Duplicate PO Protection</span>
                      <div className="text-[10px] text-slate-500">Blocks duplicate reorders if active PO is already in transit from vendor</div>
                    </div>
                    <span className="text-[9px] font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                      ACTIVE
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => onSelectTab('procurement')}
                className="w-full mt-2 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-[#DDD9D0] rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>View Autonomous Procurement Rules</span>
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* DIAGNOSTICS PING MODAL (Admin)                                */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showDiagnostics && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#FAF9F6] w-full max-w-lg rounded-2xl border border-[#DDD9D0] shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-3.5 bg-white border-b border-[#DDD9D0] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Activity size={14} />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold text-[#1E293B]">Live Industrial Infrastructure Diagnostics</h3>
                  <p className="text-[10px] text-slate-500">Real-time roundtrip ping &amp; connection telemetry</p>
                </div>
              </div>
              <button
                onClick={() => setShowDiagnostics(false)}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-3.5 space-y-2 text-xs">
              {diagnosticsResults.map((item, idx) => (
                <div key={idx} className="p-2.5 bg-white rounded-xl border border-[#DDD9D0] shadow-2xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#1E293B] text-xs">{item.name}</span>
                    <span className="font-mono text-[11px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {item.ping}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500">{item.details}</div>
                </div>
              ))}
            </div>

            <div className="p-3 bg-white border-t border-[#DDD9D0] flex items-center justify-between">
              <button
                onClick={handleRunDiagnostics}
                disabled={pinging}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <RefreshCw size={12} className={pinging ? 'animate-spin' : ''} />
                <span>{pinging ? 'Pinging...' : 'Re-Run Ping'}</span>
              </button>
              <button
                onClick={() => setShowDiagnostics(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
