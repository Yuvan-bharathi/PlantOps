import React, { useState } from 'react';
import { AlertOctagon, AlertTriangle, Bell, Check, CheckCheck, Info, Navigation, X } from 'lucide-react';
import { SITE_DEFS } from '../yard/layout';
import { AlertSeverity, OpsAlert } from '../yard/insights';
import { SourceTag } from './KpiStrip';

const SEV: Record<AlertSeverity, { icon: React.ReactNode; cls: string; label: string }> = {
  critical: { icon: <AlertOctagon size={14} />, cls: 'text-red-600 bg-red-50', label: 'Critical' },
  warning: { icon: <AlertTriangle size={14} />, cls: 'text-amber-600 bg-amber-50', label: 'Warning' },
  info: { icon: <Info size={14} />, cls: 'text-blue-600 bg-blue-50', label: 'Info' },
};

export const AlertsPanel: React.FC<{
  alerts: OpsAlert[];
  acked: Set<string>;
  onAck: (ids: string[]) => void;
  onGo: (a: OpsAlert) => void;
  onClose: () => void;
}> = ({ alerts, acked, onAck, onGo, onClose }) => {
  const [filter, setFilter] = useState<'all' | AlertSeverity>('all');
  const [showAcked, setShowAcked] = useState(false);
  const open = alerts.filter((a) => !acked.has(a.id));
  const list = (showAcked ? alerts : open).filter((a) => filter === 'all' || a.severity === filter);
  const count = (s: AlertSeverity) => open.filter((a) => a.severity === s).length;

  return (
    <div className="flex max-h-full w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.18)] backdrop-blur">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600">
            <Bell size={16} />
          </span>
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-red-600">Alerts</div>
            <div className="text-sm font-black text-slate-900">{open.length} open · {alerts.length - open.length} acknowledged</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {open.length > 0 && (
            <button onClick={() => onAck(open.map((a) => a.id))} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-100" title="Acknowledge all">
              <CheckCheck size={13} /> All
            </button>
          )}
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Close alerts">
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-1 border-b border-slate-100 px-3 py-2">
        {(['all', 'critical', 'warning', 'info'] as const).map((k) => (
          <button key={k} onClick={() => setFilter(k)} className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${filter === k ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
            {k === 'all' ? `All ${open.length}` : `${SEV[k].label} ${count(k)}`}
          </button>
        ))}
        <label className="ml-auto flex cursor-pointer items-center gap-1 text-[10px] font-semibold text-slate-400">
          <input type="checkbox" checked={showAcked} onChange={(e) => setShowAcked(e.target.checked)} className="accent-blue-600" /> show acknowledged
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {list.length === 0 && <div className="px-3 py-10 text-center text-xs text-slate-400">Nothing needs attention right now.</div>}
        {list.map((a) => {
          const sev = SEV[a.severity];
          const isAcked = acked.has(a.id);
          const site = SITE_DEFS.find((s) => s.id === a.siteId);
          return (
            <div key={a.id} className={`group flex items-start gap-2.5 rounded-xl px-2.5 py-2 hover:bg-slate-50 ${isAcked ? 'opacity-55' : ''}`}>
              <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${sev.cls}`}>{sev.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-xs font-black text-slate-800">{a.title}</span>
                  <SourceTag source={a.source} />
                </div>
                <div className="truncate text-[11px] text-slate-500">
                  {site?.code} · {a.detail}
                </div>
              </div>
              <div className="flex shrink-0 gap-0.5">
                <button onClick={() => onGo(a)} className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600" title="Fly to it">
                  <Navigation size={13} />
                </button>
                {!isAcked && (
                  <button onClick={() => onAck([a.id])} className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600" title="Acknowledge">
                    <Check size={13} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
