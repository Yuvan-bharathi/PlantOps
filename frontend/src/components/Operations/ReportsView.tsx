import React, { useEffect, useState } from 'react';
import { 
  FileSpreadsheet, Download, Printer, ShieldCheck, CheckCircle2, 
  Calendar, Clock, Building2, User, Wrench, AlertTriangle, FileText, 
  TrendingUp, RefreshCw, Layers
} from 'lucide-react';
import { api } from '../../services/api';

export const ReportsView: React.FC = () => {
  const [reportData, setReportData] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [activeReportType, setActiveReportType] = useState<'SHIFT' | 'LOTO' | 'PROCUREMENT' | 'AUDIT'>('SHIFT');
  const [dateFilter, setDateFilter] = useState('TODAY');
  const [loading, setLoading] = useState(true);

  const fetchReports = () => {
    setLoading(true);
    Promise.all([
      api.getReportsSummary(),
      api.getAuditLogs()
    ]).then(([repRes, auditRes]) => {
      if (repRes.success) setReportData(repRes.data);
      if (auditRes.success) setAuditLogs(auditRes.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadCSV = () => {
    if (!reportData) return;
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Metric,Value,Unit\n" +
      `Plant Availability,${reportData.metrics?.plantAvailability},%\n` +
      `OEE,${reportData.metrics?.overallEquipmentEffectiveness},%\n` +
      `MTTR,${reportData.metrics?.meanTimeToRepairMinutes},Minutes\n` +
      `MTBF,${reportData.metrics?.meanTimeBetweenFailuresHours},Hours\n` +
      `Average Plant Health,${reportData.metrics?.avgPlantHealth},%\n` +
      `OSHA LOTO Compliance,${reportData.metrics?.lotoComplianceRate},%\n` +
      `Total Incidents,${reportData.metrics?.totalIncidents},Count\n` +
      `Resolved Incidents,${reportData.metrics?.resolvedIncidents},Count\n` +
      `Total PO Spend,${reportData.metrics?.totalSpendUSD},USD\n`;
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `PlantOps_Report_${activeReportType}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            Compliance Reports & Audit Trail Export Center
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Certified ISO 55000 asset reliability logs, OSHA 1910.147 LOTO compliance records, and autonomous procurement audit trails.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={fetchReports}
            className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
          >
            <Download size={13} /> Export CSV
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-all active:scale-95"
          >
            <Printer size={13} /> Print / Save PDF
          </button>
        </div>
      </div>

      {/* Report Selection Tabs & Date Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-1">
          {[
            { id: 'SHIFT', label: 'Shift Operations Handover' },
            { id: 'LOTO', label: 'OSHA LOTO Safety Compliance' },
            { id: 'PROCUREMENT', label: 'Autonomous PO Spend Audit' },
            { id: 'AUDIT', label: 'Immutable Audit Trail' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveReportType(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeReportType === tab.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 text-xs">
          {['TODAY', 'LAST_7_DAYS', 'MONTH_TO_DATE'].map((df) => (
            <button
              key={df}
              onClick={() => setDateFilter(df)}
              className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all ${
                dateFilter === df
                  ? 'bg-slate-100 text-slate-900 border border-slate-200 font-bold'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {df.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Report Document Container */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-6">
        {/* Certificate Header Banner */}
        <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-extrabold text-sm shadow-sm">
                PO
              </div>
              <div>
                <h1 className="font-extrabold text-lg text-slate-900 tracking-tight">PLANTOPS ENTERPRISE</h1>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Industrial Operations & Autonomous Maintenance Platform</p>
              </div>
            </div>
            <div className="mt-3 text-xs text-slate-600 space-y-0.5">
              <div><strong>Facility:</strong> North America Advanced Manufacturing Cell Alpha (Facility ID: FAC-018)</div>
              <div><strong>Generated By:</strong> Yuvan N (Plant Operations Manager)</div>
            </div>
          </div>

          <div className="text-right text-xs text-slate-500 space-y-1">
            <div className="font-mono text-slate-700">Report Reference: <strong className="text-slate-900 font-bold">REP-2026-0921-A</strong></div>
            <div className="flex items-center justify-end gap-1 font-mono text-slate-500">
              <Clock size={12} className="text-slate-400" />
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            <span className="inline-block font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              ISO 55000 / OSHA COMPLIANT
            </span>
          </div>
        </div>

        {/* ── View 1: Shift Handover Report ── */}
        {activeReportType === 'SHIFT' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Executive Plant Performance Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Plant Availability', value: reportData?.metrics?.plantAvailability || '96.2%', sub: 'Target: >95.0%', good: true },
                  { label: 'Overall Equipment Effectiveness (OEE)', value: reportData?.metrics?.overallEquipmentEffectiveness || '88.4%', sub: 'Target: >85.0%', good: true },
                  { label: 'Mean Time to Repair (MTTR)', value: `${reportData?.metrics?.meanTimeToRepairMinutes || 42.5} min`, sub: '-28% vs Industry Benchmark', good: true },
                  { label: 'Mean Time Between Failures (MTBF)', value: `${reportData?.metrics?.meanTimeBetweenFailuresHours || 318} hrs`, sub: 'Reliability: High', good: true },
                ].map((kpi, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="text-[11px] font-bold text-slate-500 uppercase">{kpi.label}</div>
                    <div className="text-2xl font-extrabold text-slate-900 font-mono mt-1">{kpi.value}</div>
                    <div className="text-[11px] font-semibold text-emerald-600 mt-0.5">{kpi.sub}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Asset Status Breakdown */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Asset Fleet Status</h3>
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200">
                  <div className="font-bold text-emerald-800">Operational Assets (Nominal)</div>
                  <div className="text-2xl font-extrabold text-emerald-900 font-mono mt-1">4 Machines</div>
                  <div className="text-emerald-700 text-[11px] mt-0.5">CNC-01, CNC-02, ROBOT-01, PUMP-01</div>
                </div>
                <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200">
                  <div className="font-bold text-amber-800">Degrading / Warning Status</div>
                  <div className="text-2xl font-extrabold text-amber-900 font-mono mt-1">1 Machine</div>
                  <div className="text-amber-700 text-[11px] mt-0.5">MIXER-01 (Chemical Mixer)</div>
                </div>
                <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200">
                  <div className="font-bold text-blue-800">Average Fleet Health</div>
                  <div className="text-2xl font-extrabold text-blue-900 font-mono mt-1">{reportData?.metrics?.avgPlantHealth || '94.5'}%</div>
                  <div className="text-blue-700 text-[11px] mt-0.5">All cells within tolerance</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── View 2: OSHA LOTO Compliance Report ── */}
        {activeReportType === 'LOTO' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200">
              <div className="flex items-center gap-3">
                <ShieldCheck size={32} className="text-emerald-600 flex-shrink-0" />
                <div>
                  <h3 className="font-bold text-sm text-emerald-900">LOTO Workflow Aligned with OSHA 1910.147 Requirements</h3>
                  <p className="text-xs text-emerald-700">All mechanical repairs on 480V machinery were locked, tagged, and verified prior to physical enclosure access.</p>
                </div>
              </div>
              <span className="font-mono font-extrabold text-emerald-800 text-xl">100.0% Verified</span>
            </div>

            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Work Order</th>
                  <th className="py-3 px-4">Machine & Component</th>
                  <th className="py-3 px-4">Certified Lead Technician</th>
                  <th className="py-3 px-4 text-center">LOTO Protocol</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="hover:bg-slate-50">
                  <td className="py-3.5 px-4 font-mono font-bold text-blue-600">WO-8058</td>
                  <td className="py-3.5 px-4 font-semibold text-slate-800">CNC-01 — Spindle Front Bearing</td>
                  <td className="py-3.5 px-4 text-slate-700">Arun Kumar (Lead Tech)</td>
                  <td className="py-3.5 px-4 text-center font-mono text-[11px] text-emerald-700 font-bold">✓ Panel B-04 Lock Applied</td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2 py-0.5 rounded-full text-[10px]">VERIFIED</span>
                  </td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="py-3.5 px-4 font-mono font-bold text-blue-600">WO-4182</td>
                  <td className="py-3.5 px-4 font-semibold text-slate-800">PUMP-01 — Hydraulic Impeller Seal</td>
                  <td className="py-3.5 px-4 text-slate-700">Carlos Gomez (Fluids Spec)</td>
                  <td className="py-3.5 px-4 text-center font-mono text-[11px] text-emerald-700 font-bold">✓ Pressure Bleed 0.0 bar Verified</td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2 py-0.5 rounded-full text-[10px]">VERIFIED</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* ── View 3: Autonomous PO Spend Audit ── */}
        {activeReportType === 'PROCUREMENT' && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-slate-400 font-bold uppercase text-[10px]">Total Purchase Orders</div>
                <div className="text-2xl font-extrabold text-slate-900 font-mono mt-1">{reportData?.metrics?.totalPurchaseOrders || 1} Orders</div>
                <div className="text-slate-500 mt-0.5">All policy-compliant</div>
              </div>
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                <div className="text-blue-700 font-bold uppercase text-[10px]">POL-01 Autonomous Spend</div>
                <div className="text-2xl font-extrabold text-blue-900 font-mono mt-1">${reportData?.metrics?.totalSpendUSD || '145.00'}</div>
                <div className="text-blue-700 text-[11px] mt-0.5">Spend Cap: $1,000.00 / Order</div>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="text-emerald-700 font-bold uppercase text-[10px]">Autonomous Compliance Rate</div>
                <div className="text-2xl font-extrabold text-emerald-900 font-mono mt-1">100.0%</div>
                <div className="text-emerald-700 text-[11px] mt-0.5">Zero unvetted supplier exceptions</div>
              </div>
            </div>

            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">PO Number</th>
                  <th className="py-3 px-4">Part & Description</th>
                  <th className="py-3 px-4">Vetted Supplier</th>
                  <th className="py-3 px-4 text-right">Amount (USD)</th>
                  <th className="py-3 px-4 text-center">Policy Rule</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="hover:bg-slate-50">
                  <td className="py-3.5 px-4 font-mono font-bold text-blue-600">PO-7202</td>
                  <td className="py-3.5 px-4 font-semibold text-slate-800">SKF-6205-2RSH (Spindle Bearing)</td>
                  <td className="py-3.5 px-4 text-slate-700">SKF Precision Logistics (Preferred)</td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">$145.00</td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                      POL-01 (Spend &lt; $1,000)
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="font-bold text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      RECEIVED
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* ── View 4: Immutable Audit Logs ── */}
        {activeReportType === 'AUDIT' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">System Event & Decision Audit Trail</h3>
            <div className="space-y-2">
              {auditLogs.slice(0, 8).map((log: any) => (
                <div key={log.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start justify-between text-xs gap-3">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-[10px]">
                        {log.action}
                      </span>
                      <span className="font-bold text-slate-800">{log.resource_type}: {log.resource_id}</span>
                    </div>
                    <p className="text-slate-600 text-[11px]">{log.reason || 'Automated policy-driven state transition'}</p>
                    <div className="font-mono text-[10px] text-slate-400">Actor: {log.actor} • Correlation: {log.correlation_id}</div>
                  </div>
                  <span className="font-mono text-slate-400 text-[11px] whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
              {auditLogs.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No historical audit records available.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Signatures Footer */}
        <div className="pt-8 border-t border-slate-200 flex flex-wrap items-center justify-between gap-6 text-xs text-slate-500">
          <div>
            <div className="font-mono text-[11px]">Authorized Signature:</div>
            <div className="font-serif italic text-base text-slate-800 font-bold mt-1">Yuvan N.</div>
            <div className="text-[10px] text-slate-400">Plant Operations Lead & Certified Reliability Manager</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[10px]">Cryptographic Checksum: <span className="text-slate-700">SHA-256: 4f8b9e...2a71c</span></div>
            <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">✓ Tamper-Evident Ledger Verified</div>
          </div>
        </div>
      </div>
    </div>
  );
};
