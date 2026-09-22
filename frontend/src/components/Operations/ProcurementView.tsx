import React from 'react';
import { ShoppingCart, ShieldCheck, CheckCircle2, Clock, Truck, Bot, UserCheck, Package, Building2, DollarSign } from 'lucide-react';
import { PurchaseOrder } from '../../types';

interface ProcurementViewProps {
  purchaseOrders: PurchaseOrder[];
}

export const ProcurementView: React.FC<ProcurementViewProps> = ({ purchaseOrders }) => {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <ShoppingCart className="w-4 h-4" />
            </div>
            Autonomous Procurement & Purchase Orders
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Policy-governed PO execution (<strong className="text-slate-800 font-semibold">POL-01</strong> spend limits & anti-loop guards) with simulated Goods Receipt (GRN).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
            Total POs: <strong className="text-slate-900 font-mono">{purchaseOrders.length}</strong>
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4 font-bold text-slate-700">PO Number</th>
                <th className="py-3.5 px-4 font-bold text-slate-700">Item & Part #</th>
                <th className="py-3.5 px-4 font-bold text-slate-700">Supplier</th>
                <th className="py-3.5 px-4 text-center font-bold text-slate-700">Qty</th>
                <th className="py-3.5 px-4 text-right font-bold text-slate-700">Total USD</th>
                <th className="py-3.5 px-4 text-center font-bold text-slate-700">Decision Origin</th>
                <th className="py-3.5 px-4 text-center font-bold text-slate-700">Status</th>
                <th className="py-3.5 px-4 text-right font-bold text-slate-700">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {purchaseOrders.map((po) => {
                const isReceived = po.status === 'RECEIVED';
                const isAuto = po.approval_type === 'AUTONOMOUS_POLICY';
                return (
                  <tr key={po.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* PO Number */}
                    <td className="py-4 px-4 font-mono font-bold text-sm text-blue-600">
                      <span className="bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 inline-block">
                        {po.id}
                      </span>
                    </td>

                    {/* Item & Part Number */}
                    <td className="py-4 px-4">
                      <div className="font-bold text-slate-900 text-xs">
                        {po.part_name || 'Spindle Angular Contact Deep Groove Ball Bearing'}
                      </div>
                      <div className="font-mono text-[11px] font-semibold text-slate-500 mt-0.5 flex items-center gap-1">
                        <Package size={12} className="text-slate-400" />
                        {po.part_number || 'SKF-6205-2RSH'}
                      </div>
                    </td>

                    {/* Supplier */}
                    <td className="py-4 px-4">
                      <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <Building2 size={13} className="text-slate-400" />
                        {po.supplier_name || 'SKF Precision Industrial Logistics'}
                      </span>
                    </td>

                    {/* Quantity */}
                    <td className="py-4 px-4 text-center font-mono font-bold text-slate-800 text-sm">
                      {po.quantity}
                    </td>

                    {/* Total USD */}
                    <td className="py-4 px-4 text-right font-mono font-extrabold text-slate-900 text-sm">
                      ${parseFloat(po.total_amount || '0').toFixed(2)}
                    </td>

                    {/* Decision Origin */}
                    <td className="py-4 px-4 text-center">
                      {isAuto ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          <Bot className="w-3.5 h-3.5 text-blue-600" /> POL-01 Auto-PO
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                          <UserCheck className="w-3.5 h-3.5 text-amber-600" /> Human Approved
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full border ${
                        isReceived
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-purple-50 text-purple-700 border-purple-200 animate-pulse'
                      }`}>
                        {isReceived ? <Truck className="w-3.5 h-3.5 text-emerald-600" /> : <Clock className="w-3.5 h-3.5 text-purple-600" />}
                        {po.status}
                      </span>
                    </td>

                    {/* Timestamp */}
                    <td className="py-4 px-4 text-right font-mono font-semibold text-slate-500 text-xs">
                      {new Date(po.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
