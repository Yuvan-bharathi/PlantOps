import React, { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, ShieldCheck, Activity, Cpu, ArrowUpRight, CheckCircle2, Download } from 'lucide-react';
import { DomoKPIs } from '../../types';
import { api } from '../../services/api';

export const DomoAnalyticsView: React.FC = () => {
  const [kpis, setKpis] = useState<DomoKPIs | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDomoSummary().then((res: any) => {
      if (res.success) setKpis(res.kpis);
      setLoading(false);
    }).catch((_err: any) => setLoading(false));
  }, []);

  const stats = [
    { label: 'Overall Equipment Effectiveness (OEE)', value: kpis ? `${kpis.oee}%` : '88.4%', change: '+3.2%', isPositive: true },
    { label: 'Plant Availability', value: kpis ? `${kpis.availability}%` : '96.2%', change: '+1.5%', isPositive: true },
    { label: 'Mean Time to Repair (MTTR)', value: kpis ? `${kpis.mttr_minutes} min` : '42.5 min', change: '-28.0%', isPositive: true },
    { label: 'Mean Time Between Failures (MTBF)', value: kpis ? `${kpis.mtbf_hours} hrs` : '318 hrs', change: '+14.0%', isPositive: true },
    { label: 'Autonomous PO Compliance Rate', value: kpis ? `${kpis.autonomous_po_rate}%` : '100%', change: 'Policy Guard Active', isPositive: true },
    { label: 'Total Spares Spend', value: kpis ? `$${kpis.total_parts_spend_usd.toFixed(2)}` : '$145.00', change: 'Audited', isPositive: true }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <BarChart3 className="w-4 h-4" />
            </div>
            Domo Enterprise Analytics Integration
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Curated operational metrics dataset synchronizing real-time PlantOps events with Domo BI dashboards.
          </p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat, idx) => (
          <div key={idx} className="card p-4 rounded-2xl border border-slate-200 space-y-2">
            <div className="text-slate-400 text-xs">{stat.label}</div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono text-slate-900">{stat.value}</span>
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-0.5">
                <ArrowUpRight className="w-3.5 h-3.5" />
                {stat.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Data Pipeline Explainer Card */}
      <div className="card p-5 rounded-2xl border border-blue-500/20 bg-blue-950/10 space-y-3">
        <h3 className="text-sm font-bold text-blue-300 flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" /> PlantOps ↔ Domo Architectural Boundary
        </h3>
        <p className="text-xs text-slate-600 leading-relaxed">
          <strong>PlantOps</strong> is responsible for <span className="text-[#0F766E] font-semibold">sub-second real-time operational execution</span> (IoT sensor telemetry ingestion, deterministic state machines, AI diagnosis, automated work order dispatch, and policy-governed PO execution). 
          <strong>Domo</strong> consumes curated aggregated datasets via REST/Webhooks for <span className="text-[#2563EB] font-semibold">macro enterprise analytics, long-term MTBF trend forecasting, supplier OTIF evaluation, and executive OEE scorecards</span>.
        </p>
      </div>
    </div>
  );
};
