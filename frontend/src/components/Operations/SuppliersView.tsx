import React, { useEffect, useState } from 'react';
import { Building2, Star, Truck, ShieldCheck, Mail, DollarSign, Package, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';

export const SuppliersView: React.FC = () => {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSuppliers = () => {
    setLoading(true);
    api.getSuppliers().then(res => {
      if (res.success) setSuppliers(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <Building2 className="w-4 h-4" />
            </div>
            MRO Spares Suppliers & Vendor Directory
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Vetted industrial supply chain partners, SLA compliance ratings, contractual payment terms, and automated order routing.
          </p>
        </div>
        <button
          onClick={fetchSuppliers}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh Vendors
        </button>
      </div>

      {/* Supplier Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {suppliers.map((sup) => {
          const isPreferred = sup.status === 'PREFERRED';
          const isRestricted = sup.status === 'RESTRICTED' || sup.status === 'BLOCKED';

          return (
            <div
              key={sup.id}
              className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-4"
            >
              <div>
                {/* Card Header */}
                <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-base flex-shrink-0">
                      <Building2 size={22} className="text-slate-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-base text-slate-900">{sup.name}</h3>
                        <span className="font-mono text-xs font-bold text-slate-400">({sup.code})</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-amber-600 font-bold">
                        <Star size={13} className="fill-amber-400 text-amber-400" />
                        <span>{parseFloat(sup.rating || '4.5').toFixed(2)} / 5.00 Rating</span>
                      </div>
                    </div>
                  </div>

                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                    isPreferred
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : isRestricted
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}>
                    {sup.status}
                  </span>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-3 gap-2 mt-3.5 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                    <div className="text-[10px] text-slate-400 font-semibold">Lead Time</div>
                    <div className="font-mono font-extrabold text-slate-900 mt-0.5 text-sm">{sup.lead_time_days} Day(s)</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                    <div className="text-[10px] text-slate-400 font-semibold">Catalog SKUs</div>
                    <div className="font-mono font-extrabold text-blue-600 mt-0.5 text-sm">{sup.catalog_parts_count || 1} Parts</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                    <div className="text-[10px] text-slate-400 font-semibold">Terms</div>
                    <div className="font-mono font-bold text-slate-700 mt-0.5 text-xs">{sup.payment_terms || 'Net 30'}</div>
                  </div>
                </div>

                {/* Contact Email */}
                <div className="mt-3 text-xs text-slate-500 flex items-center gap-2">
                  <Mail size={13} className="text-slate-400" />
                  <span className="font-mono">{sup.contact_email}</span>
                </div>
              </div>

              {/* Total Spend Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Total Lifetime Spend:</span>
                <span className="font-mono font-extrabold text-slate-900 text-sm">
                  ${parseFloat(sup.total_po_spend || '0').toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
