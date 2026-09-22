import React, { useState } from 'react';
import { ShieldAlert, CheckCircle2, XCircle, AlertCircle, Clock, DollarSign, UserCheck, ShieldCheck } from 'lucide-react';
import { HumanReviewItem } from '../../types';
import { api } from '../../services/api';

interface HumanReviewViewProps {
  reviewItems: HumanReviewItem[];
  onRefresh: () => void;
}

export const HumanReviewView: React.FC<HumanReviewViewProps> = ({ reviewItems, onRefresh }) => {
  const [actingId, setActingId] = useState<string | null>(null);

  const handleApprove = async (id: string) => {
    setActingId(id);
    try {
      await api.approveReviewItem(id, 'David Miller (Plant Maintenance Manager)');
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setActingId(null);
    }
  };

  const pendingItems = reviewItems.filter(i => i.status === 'PENDING');
  const pastItems = reviewItems.filter(i => i.status !== 'PENDING');

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <ShieldAlert className="w-4 h-4" />
            </div>
            Human-in-the-Loop Review Center
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Manager escalation inbox for policy exceptions, spend limit breaches (&gt;$1,000), or low AI confidence diagnoses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
            Pending Reviews: <strong className="text-amber-700 font-mono">{pendingItems.length}</strong>
          </span>
        </div>
      </div>

      {pendingItems.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mx-auto mb-3">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No Pending Approvals</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            All autonomous policies and AI decisions are currently operating within pre-approved thresholds.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-2">
            <ShieldAlert size={14} className="text-amber-600" />
            Pending Actions ({pendingItems.length})
          </h3>
          {pendingItems.map((item) => (
            <div
              key={item.id}
              className="bg-white p-5 rounded-2xl border border-amber-200 shadow-sm hover:shadow-md transition-all duration-200 space-y-3.5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-bold text-xs text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">{item.id}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-xs font-bold text-slate-700">{item.item_type}</span>
                </div>
                <span className="text-xs font-mono font-semibold text-slate-500 flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {new Date(item.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                </span>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                <p className="text-xs font-medium text-slate-700 mt-1.5 bg-amber-50/50 p-3 rounded-xl border border-amber-100 leading-relaxed">
                  {item.reason}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2">
                <span className="text-xs text-slate-500">
                  Required Role: <strong className="text-slate-800 font-semibold">{item.required_role}</strong>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleApprove(item.id)}
                    disabled={actingId === item.id}
                    className="flex items-center gap-1.5 py-2 px-4 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all active:scale-95 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{actingId === item.id ? 'Approving...' : 'Approve & Release Purchase Order'}</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {pastItems.length > 0 && (
        <div className="space-y-3 pt-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Resolved Reviews History ({pastItems.length})
          </h3>
          <div className="space-y-2">
            {pastItems.map((item) => (
              <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-xs flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-800">{item.title}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Reviewed by: <strong className="text-slate-700 font-semibold">{item.reviewed_by}</strong></div>
                </div>
                <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
