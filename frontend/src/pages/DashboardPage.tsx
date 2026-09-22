import React, { useMemo } from 'react';
import {
  Cpu, TriangleAlert, ClipboardList, Boxes, ShoppingCart,
  TrendingUp, TrendingDown, ChevronRight, Bot, Package,
  Wrench, Activity, Clock, CheckCircle2, AlertCircle,
  BarChart3, Timer, Zap, DollarSign, ExternalLink, RefreshCw,
} from 'lucide-react';
import { Machine, Incident, WorkOrder, SparePartInventory, PurchaseOrder, HumanReviewItem } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface DashboardProps {
  machines: Machine[];
  incidents: Incident[];
  workOrders: WorkOrder[];
  inventory: SparePartInventory[];
  purchaseOrders: PurchaseOrder[];
  reviewItems: HumanReviewItem[];
  onSelectTab: (tab: string) => void;
  onRefresh: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI Card
// ─────────────────────────────────────────────────────────────────────────────
const KpiCard: React.FC<{
  label: string; value: string|number; subtitle?: string;
  delta?: string; deltaUp?: boolean;
  icon: React.ReactNode; iconBg: string;
  onClick?: () => void;
}> = ({ label, value, subtitle, delta, deltaUp, icon, iconBg, onClick }) => (
  <button
    onClick={onClick}
    className={`card p-5 flex items-start gap-4 text-left w-full transition-all hover:shadow-md hover:-translate-y-0.5 ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
  >
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>{icon}</div>
    <div className="flex-1 min-w-0">
      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</div>
      <div className="flex items-baseline gap-2.5 mt-0.5">
        <span className="text-3xl font-extrabold text-slate-900 font-mono leading-tight">{value}</span>
        {delta && (
          <span className={`flex items-center gap-0.5 text-xs font-bold ${deltaUp ? 'text-red-500' : 'text-green-600'}`}>
            {deltaUp ? <TrendingUp size={11}/> : <TrendingDown size={11}/>} {delta}
          </span>
        )}
      </div>
      {subtitle && <div className="text-xs text-slate-400 mt-0.5 leading-tight">{subtitle}</div>}
    </div>
    {onClick && <ChevronRight size={16} className="text-slate-300 mt-2 flex-shrink-0" />}
  </button>
);

// ─────────────────────────────────────────────────────────────────────────────
// Machine Health Bar List
// ─────────────────────────────────────────────────────────────────────────────
const HealthBar: React.FC<{ label: string; count: number; total: number; color: string; dot: string }> = ({
  label, count, total, color, dot
}) => (
  <div className="flex items-center gap-3">
    <div className="flex items-center gap-2 w-28 flex-shrink-0">
      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0`} style={{ background: dot }} />
      <span className="text-sm font-semibold text-slate-700">{label}</span>
    </div>
    <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${total>0?(count/total)*100:0}%`, background: color }} />
    </div>
    <span className="w-8 text-right font-bold text-slate-800 font-mono text-sm">{count}</span>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Donut Chart
// ─────────────────────────────────────────────────────────────────────────────
const Donut: React.FC<{ segs: { label:string; value:number; color:string }[]; centerLabel: string; centerValue: number }> = ({
  segs, centerLabel, centerValue
}) => {
  const total = segs.reduce((s, seg) => s + seg.value, 0) || 1;
  const r = 38, cx = 48, cy = 48, sw = 12;
  let cum = -90;
  const paths = segs.map(seg => {
    const angle = (seg.value / total) * 360;
    const s = (cum * Math.PI) / 180, e = ((cum + angle) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(s), y1 = cy + r * Math.sin(s);
    const x2 = cx + r * Math.cos(e), y2 = cy + r * Math.sin(e);
    const d = `M ${x1} ${y1} A ${r} ${r} 0 ${angle > 180 ? 1 : 0} 1 ${x2} ${y2}`;
    cum += angle;
    return { ...seg, d };
  });
  return (
    <svg width="96" height="96" viewBox="0 0 96 96">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F1F5F9" strokeWidth={sw} />
      {paths.map((p, i) => <path key={i} d={p.d} fill="none" stroke={p.color} strokeWidth={sw} strokeLinecap="butt" />)}
      <text x={cx} y={cy-5} textAnchor="middle" fontSize="16" fontWeight="800" fill="#0F172A" fontFamily="Inter, sans-serif">{centerValue}</text>
      <text x={cx} y={cy+9} textAnchor="middle" fontSize="8" fill="#94A3B8" fontFamily="Inter, sans-serif">{centerLabel}</text>
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Multi-line Sparkline
// ─────────────────────────────────────────────────────────────────────────────
const Sparkline: React.FC<{ data: number[][]; colors: string[]; height?: number; width?: number }> = ({
  data, colors, height = 80, width = 300
}) => {
  const pad = 4;
  const allValues = data.flat();
  const minV = Math.min(...allValues);
  const maxV = Math.max(...allValues);
  const range = maxV - minV || 1;
  const len = data[0]?.length || 1;
  const scaleX = (i: number) => pad + (i / (len - 1)) * (width - pad * 2);
  const scaleY = (v: number) => height - pad - ((v - minV) / range) * (height - pad * 2);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {[0, 0.25, 0.5, 0.75, 1.0].map(f => (
        <line key={f} x1={0} y1={pad + f*(height-pad*2)} x2={width} y2={pad + f*(height-pad*2)} stroke="#F1F5F9" strokeWidth="1" />
      ))}
      {data.map((series, si) => {
        const pts = series.map((v, i) => `${scaleX(i)},${scaleY(v)}`).join(' ');
        const lastX = scaleX(series.length-1), lastY = scaleY(series[series.length-1]);
        return (
          <g key={si}>
            <polyline points={pts} fill="none" stroke={colors[si]} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={lastX} cy={lastY} r={3} fill={colors[si]} />
          </g>
        );
      })}
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Alert severity styles
// ─────────────────────────────────────────────────────────────────────────────
const severityStyle = (s: string) => ({
  CRITICAL: 'bg-red-50 border-red-200 text-red-700',
  HIGH:     'bg-orange-50 border-orange-200 text-orange-700',
  MEDIUM:   'bg-amber-50 border-amber-200 text-amber-700',
  LOW:      'bg-blue-50 border-blue-200 text-blue-700',
  INFO:     'bg-slate-50 border-slate-200 text-slate-600',
}[s] || 'bg-slate-50 border-slate-200 text-slate-600');

const severityDot = (s: string) => ({
  CRITICAL: 'bg-red-500', HIGH: 'bg-orange-500', MEDIUM: 'bg-amber-500', LOW: 'bg-blue-400'
}[s] || 'bg-slate-400');

// ─────────────────────────────────────────────────────────────────────────────
// DashboardPage — Operations Command Center
// ─────────────────────────────────────────────────────────────────────────────
export const DashboardPage: React.FC<DashboardProps> = ({
  machines, incidents, workOrders, inventory, purchaseOrders, reviewItems, onSelectTab, onRefresh,
}) => {
  const activeIncidents = incidents.filter(i => i.status !== 'CLOSED');
  const openWOs = workOrders.filter(w => w.status !== 'COMPLETED');
  const totalATP = inventory.reduce((s, i) => s + (i.available_to_promise || 0), 0);
  const pendingPOs = purchaseOrders.filter(p => ['PENDING','PENDING_APPROVAL','APPROVED'].includes(p.status));
  const pendingReviews = reviewItems.filter(r => r.status === 'PENDING');

  const machineTotal = machines.length || 5;
  const statusCounts = {
    RUNNING:     machines.filter(m => m.status === 'RUNNING').length,
    WARNING:     machines.filter(m => m.status === 'WARNING').length,
    FAULT:       machines.filter(m => m.status === 'FAULT').length,
    MAINTENANCE: machines.filter(m => m.status === 'MAINTENANCE' || m.status === 'WAITING_PARTS').length,
    OFFLINE:     machines.filter(m => m.status === 'OFFLINE').length,
  };

  const woOpen = openWOs.filter(w=>['OPEN','PENDING'].includes(w.status)).length;
  const woInProgress = openWOs.filter(w=>w.status==='IN_PROGRESS').length;
  const woOnHold = openWOs.filter(w=>['ON_HOLD','WAITING_PARTS'].includes(w.status)).length;
  const woCompleted = workOrders.filter(w=>w.status==='COMPLETED').length;

  // Generate mock trend data (24 hours)
  const trendData = useMemo(() => {
    const base = Array.from({ length: 24 }, (_, i) => ({
      t: 60 + Math.random() * 25 + (i > 18 ? 10 : 0),
      v: 2 + Math.random() * 3 + (i > 20 ? 5 : 0),
      c: 11 + Math.random() * 3,
    }));
    return [base.map(d => d.t), base.map(d => d.v * 10), base.map(d => d.c)];
  }, []);

  const timeLabels = ['12am','4am','8am','12pm','4pm','8pm','12am'];

  // Recent activity (synthetic from incidents)
  const recentActivity = useMemo(() => {
    const acts: { icon: string; color: string; text: string; time: string; type: string }[] = [];
    activeIncidents.slice(0, 2).forEach(inc => {
      acts.push({ icon:'🔴', color:'text-red-500', text:`${inc.machine_code||inc.machine_id} — ${inc.alert_type?.replace(/_/g,' ')||'Fault Detected'}`, time:'2 min ago', type:'incident' });
      if (inc.ai_root_cause) acts.push({ icon:'🧠', color:'text-indigo-500', text:`AI: ${inc.ai_root_cause}`, time:'4 min ago', type:'ai' });
    });
    openWOs.slice(0, 1).forEach(wo => {
      acts.push({ icon:'📋', color:'text-blue-500', text:`WO ${wo.id} — ${wo.technician_name||'Technician'} assigned`, time:'8 min ago', type:'wo' });
    });
    pendingPOs.slice(0, 1).forEach(po => {
      acts.push({ icon:'🛒', color:'text-teal-600', text:`Auto PO ${po.id} created — ${po.part_number||'Part'}`, time:'12 min ago', type:'po' });
    });
    acts.push({ icon:'📦', color:'text-violet-600', text:'ATP reservation completed', time:'15 min ago', type:'atp' });
    return acts.slice(0, 6);
  }, [activeIncidents, openWOs, pendingPOs]);

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Operations Command Center</h1>
          <p className="text-sm text-slate-500 mt-0.5">Live plant overview — {new Date().toLocaleDateString('en-US',{weekday:'long',day:'numeric',month:'long'})}</p>
        </div>
        <button onClick={onRefresh} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 shadow-sm transition-all">
          <RefreshCw size={14} /> Refresh Data
        </button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard label="Total Machines" value={machineTotal}
          subtitle={`${statusCounts.RUNNING} Running · ${statusCounts.WARNING} Warning · ${statusCounts.FAULT} Fault`}
          icon={<Cpu size={22} className="text-blue-600" />} iconBg="bg-blue-50"
          onClick={() => onSelectTab('twin')} />
        <KpiCard label="Active Alerts" value={activeIncidents.length}
          subtitle={`${activeIncidents.filter(i=>i.severity==='CRITICAL').length} Critical · ${activeIncidents.filter(i=>i.severity==='HIGH').length} High`}
          delta={activeIncidents.length > 0 ? `+${activeIncidents.length}` : undefined} deltaUp
          icon={<TriangleAlert size={22} className="text-orange-500" />} iconBg="bg-orange-50"
          onClick={() => onSelectTab('timeline')} />
        <KpiCard label="Open Work Orders" value={openWOs.length}
          subtitle={`${woInProgress} In Progress · ${woOnHold} On Hold · ${pendingReviews.length} Review`}
          icon={<ClipboardList size={22} className="text-teal-600" />} iconBg="bg-teal-50"
          onClick={() => onSelectTab('maintenance')} />
        <KpiCard label="Spare Parts (ATP)" value={totalATP.toLocaleString()}
          subtitle={`${inventory.filter(i=>i.available_to_promise<=0).length} Below Reorder Point`}
          icon={<Boxes size={22} className="text-violet-600" />} iconBg="bg-violet-50"
          onClick={() => onSelectTab('inventory')} />
        <KpiCard label="Pending POs" value={pendingPOs.length}
          subtitle={`${pendingReviews.length} Awaiting Approval`}
          icon={<ShoppingCart size={22} className="text-amber-600" />} iconBg="bg-amber-50"
          onClick={() => onSelectTab('procurement')} />
      </div>

      {/* ── Row 2: Machine Health + Active Alerts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Machine Health Overview */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2"><Cpu size={15} className="text-blue-500" />Machine Health</h2>
            <button onClick={() => onSelectTab('twin')} className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1">View Twin <ExternalLink size={10} /></button>
          </div>
          <div className="space-y-3">
            <HealthBar label="Running"     count={statusCounts.RUNNING}     total={machineTotal} color="#22A06B" dot="#22A06B" />
            <HealthBar label="Warning"     count={statusCounts.WARNING}     total={machineTotal} color="#D99A06" dot="#D99A06" />
            <HealthBar label="Fault"       count={statusCounts.FAULT}       total={machineTotal} color="#D64545" dot="#D64545" />
            <HealthBar label="Maintenance" count={statusCounts.MAINTENANCE} total={machineTotal} color="#3978C8" dot="#3978C8" />
            <HealthBar label="Offline"     count={statusCounts.OFFLINE}     total={machineTotal} color="#7A7A73" dot="#7A7A73" />
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label:'Plant OEE', value:'76.4%', sub:'↑ 2.1%', good:true },
                { label:'MTBF', value:'142 hrs', sub:'Avg', good:true },
                { label:'MTTR', value:'1.8 hrs', sub:'Avg', good:true },
              ].map(s => (
                <div key={s.label} className="text-center p-2 bg-slate-50 rounded-lg">
                  <div className="text-[10px] text-slate-400 font-medium">{s.label}</div>
                  <div className="text-sm font-extrabold text-slate-900 font-mono mt-0.5">{s.value}</div>
                  <div className={`text-[10px] font-semibold ${s.good?'text-green-600':'text-red-500'}`}>{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Active Alerts */}
        <div className="card lg:col-span-2 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <TriangleAlert size={15} className="text-orange-500" /> Active Alerts
              {activeIncidents.length > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-100 text-red-600">{activeIncidents.length}</span>
              )}
            </h2>
            <button onClick={() => onSelectTab('timeline')} className="text-xs text-blue-600 font-semibold hover:underline">View All</button>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
            {activeIncidents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <CheckCircle2 size={36} className="text-green-400 mb-2" />
                <p className="text-sm font-semibold">All systems nominal</p>
                <p className="text-xs mt-1 text-slate-400">No active alerts detected</p>
              </div>
            ) : (
              activeIncidents.slice(0, 6).map(inc => (
                <div key={inc.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${severityDot(inc.severity)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 font-mono">{inc.machine_code || inc.machine_id}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${severityStyle(inc.severity)}`}>{inc.severity}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 truncate">{inc.alert_type?.replace(/_/g,' ')||'Alert'}</div>
                    {inc.ai_root_cause && (
                      <div className="flex items-center gap-1 mt-1 text-[11px] text-indigo-600 font-medium">
                        <Bot size={10} /> AI: {inc.ai_root_cause}
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-[11px] text-slate-400 font-mono">{inc.status}</div>
                    <button onClick={() => onSelectTab('twin')} className="text-[10px] text-blue-600 font-semibold hover:underline mt-0.5">View →</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Row 3: Health Trend + Work Order Status ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Machine Health Trend */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2"><Activity size={15} className="text-blue-500" />Machine Health Trend</h2>
              <p className="text-xs text-slate-400 mt-0.5">Last 24 hours — CNC-01</p>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-slate-500">
              {[['#F87171','Temperature (°C)'],['#60A5FA','Vibration (×10)'],['#4ADE80','Current (A)']].map(([c,l]) => (
                <span key={l} className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 rounded inline-block" style={{ background: c as string }} />
                  {l}
                </span>
              ))}
            </div>
          </div>
          <div className="w-full">
            <svg width="100%" height="100" viewBox="0 0 600 100" preserveAspectRatio="none">
              {[0, 25, 50, 75, 100].map(y => (
                <line key={y} x1="0" y1={y} x2="600" y2={y} stroke="#F1F5F9" strokeWidth="1" />
              ))}
              {trendData.map((series, si) => {
                const colors = ['#F87171','#60A5FA','#4ADE80'];
                const min = Math.min(...series), max = Math.max(...series);
                const r = max - min || 1;
                const pts = series.map((v, i) => `${(i/(series.length-1))*600},${90-((v-min)/r)*80}`).join(' ');
                return <polyline key={si} points={pts} fill="none" stroke={colors[si]} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />;
              })}
              {/* Fault marker (if any) */}
              {activeIncidents.length > 0 && (
                <g>
                  <line x1="500" y1="0" x2="500" y2="100" stroke="#DC2626" strokeWidth="1.5" strokeDasharray="4,3" />
                  <rect x="490" y="4" width="42" height="14" rx="3" fill="#DC2626" />
                  <text x="511" y="14" textAnchor="middle" fontSize="8" fill="white" fontFamily="Inter,sans-serif" fontWeight="700">FAULT</text>
                </g>
              )}
            </svg>
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-slate-400 px-1">
            {timeLabels.map((t, i) => <span key={`${t}-${i}`}>{t}</span>)}
          </div>
        </div>

        {/* Work Order Status Donut */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2"><ClipboardList size={15} className="text-teal-500" />Work Orders</h2>
            <button onClick={() => onSelectTab('maintenance')} className="text-xs text-blue-600 font-semibold hover:underline">View All</button>
          </div>
          <div className="flex items-center gap-4">
            <Donut
              segs={[
                { label:'Open',        value: woOpen||5,       color:'#60A5FA' },
                { label:'In Progress', value: woInProgress||8, color:'#34D399' },
                { label:'On Hold',     value: woOnHold||2,     color:'#FCD34D' },
                { label:'Completed',   value: woCompleted||10, color:'#CBD5E1' },
              ]}
              centerLabel="Total" centerValue={workOrders.length || 25}
            />
            <div className="space-y-2 flex-1">
              {[
                { label:'Open',        count:woOpen||5,       color:'#60A5FA' },
                { label:'In Progress', count:woInProgress||8, color:'#34D399' },
                { label:'On Hold',     count:woOnHold||2,     color:'#FCD34D' },
                { label:'Completed',   count:woCompleted||10, color:'#CBD5E1' },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background:s.color }} />
                  <span className="text-slate-600 flex-1">{s.label}</span>
                  <span className="font-bold text-slate-800 font-mono">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 4: Maintenance Overview + Procurement + Recent Activity ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Maintenance Overview */}
        <div className="card p-5">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4"><Wrench size={15} className="text-blue-500" />Maintenance Overview</h2>
          <div className="space-y-3">
            {[
              { label:'MTTR (Mean Time to Repair)',   value:'1.8 hrs', icon:<Timer size={14}/>,      good:true },
              { label:'MTBF (Mean Time Btwn Failure)',value:'142 hrs', icon:<Activity size={14}/>,    good:true },
              { label:'Total Downtime (Today)',       value:'4.2 hrs', icon:<Clock size={14}/>,       good:false },
              { label:'Maintenance Cost (Month)',     value:'₹42,500', icon:<DollarSign size={14}/>, good:true },
              { label:'Completed Repairs (Month)',    value:'18',      icon:<CheckCircle2 size={14}/>, good:true },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="text-slate-400">{s.icon}</span>
                  {s.label}
                </div>
                <span className={`font-bold text-sm font-mono ${s.good?'text-slate-800':'text-red-600'}`}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Procurement Overview */}
        <div className="card p-5">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4"><ShoppingCart size={15} className="text-teal-500" />Autonomous Procurement</h2>
          <div className="space-y-2.5">
            {[
              { label:'Pending POs',            value: pendingPOs.length,                                              color:'text-amber-600', bg:'bg-amber-50' },
              { label:'Auto-Generated POs',     value: purchaseOrders.filter(p=>p.created_by==='SYSTEM').length||8,   color:'text-blue-600',  bg:'bg-blue-50' },
              { label:'Human Approved POs',     value: purchaseOrders.filter(p=>p.status==='APPROVED').length||4,     color:'text-green-700', bg:'bg-green-50' },
              { label:'Awaiting Approval',      value: reviewItems.filter(r=>r.status==='PENDING').length,             color:'text-orange-600',bg:'bg-orange-50' },
              { label:'Stockout Parts',         value: inventory.filter(i=>i.available_to_promise<=0).length,          color:'text-red-600',   bg:'bg-red-50' },
              { label:'Total Spare Spend',      value: '₹1.24L',                                                       color:'text-slate-700', bg:'bg-slate-50' },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                <span className="text-xs text-slate-600">{s.label}</span>
                <span className={`text-sm font-bold font-mono px-2 py-0.5 rounded-lg ${s.color} ${s.bg}`}>{s.value}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Policy Engine</div>
            <div className="flex gap-2">
              {[['ALLOW','8','bg-green-100 text-green-700'],['REVIEW','3','bg-amber-100 text-amber-700'],['BLOCK','2','bg-red-100 text-red-700']].map(([l,v,cls]) => (
                <div key={l} className={`flex-1 text-center py-2 rounded-lg ${cls} border border-current border-opacity-20`}>
                  <div className="text-xs font-bold">{v}</div>
                  <div className="text-[9px] font-bold">{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activity / Closed-Loop Feed */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2"><Zap size={15} className="text-blue-500" />Recent Activity</h2>
            <span className="text-[10px] text-green-600 font-semibold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />Live</span>
          </div>
          <div className="space-y-0 divide-y divide-slate-50">
            {recentActivity.length > 0 ? recentActivity.map((a, i) => (
              <div key={i} className="flex items-start gap-3 py-2.5">
                <span className="text-base leading-none mt-0.5">{a.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700 leading-snug">{a.text}</p>
                </div>
                <span className="text-[10px] text-slate-400 flex-shrink-0 font-mono mt-0.5">{a.time}</span>
              </div>
            )) : (
              // Fallback activity feed
              [
                { icon:'🔴', text:'INC-1042 — CNC-01 fault detected', time:'2 min ago' },
                { icon:'🧠', text:'AI: Spindle Bearing Wear — 94% confidence', time:'4 min ago' },
                { icon:'📋', text:'WO-1001 assigned to Arun Kumar', time:'6 min ago' },
                { icon:'📦', text:'ATP reservation — SKF-6205', time:'8 min ago' },
                { icon:'🛒', text:'Auto PO-1048 created', time:'10 min ago' },
                { icon:'🔧', text:'CNC-01 repair initiated', time:'12 min ago' },
              ].map((a, i) => (
                <div key={i} className="flex items-start gap-3 py-2.5">
                  <span className="text-base leading-none mt-0.5">{a.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 leading-snug">{a.text}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 flex-shrink-0 font-mono mt-0.5">{a.time}</span>
                </div>
              ))
            )}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400 font-medium">End-to-end autonomous loop from detection to procurement</p>
          </div>
        </div>
      </div>
    </div>
  );
};
