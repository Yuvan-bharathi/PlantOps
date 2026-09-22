import React from 'react';
import { PackageCheck, Layers, AlertCircle, CheckCircle2, DollarSign, MapPin, Package } from 'lucide-react';
import { SparePartInventory } from '../../types';

interface InventoryViewProps {
  inventory: SparePartInventory[];
}

export const InventoryView: React.FC<InventoryViewProps> = ({ inventory }) => {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <PackageCheck className="w-4 h-4" />
            </div>
            MRO Spares Inventory & ATP Allocation
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Real-time Available-to-Promise (<strong className="text-slate-800 font-semibold">ATP = On Hand - Reserved</strong>) with automated reorder tracking.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
            Total SKUs: <strong className="text-slate-900 font-mono">{inventory.length}</strong>
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4 font-bold text-slate-700">Part Number</th>
                <th className="py-3.5 px-4 font-bold text-slate-700">Description</th>
                <th className="py-3.5 px-4 font-bold text-slate-700">Warehouse & Bin</th>
                <th className="py-3.5 px-4 text-center font-bold text-slate-700">On Hand</th>
                <th className="py-3.5 px-4 text-center font-bold text-slate-700">Reserved</th>
                <th className="py-3.5 px-4 text-center font-bold text-slate-700">ATP</th>
                <th className="py-3.5 px-4 text-right font-bold text-slate-700">Unit Cost</th>
                <th className="py-3.5 px-4 text-center font-bold text-slate-700">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {inventory.map((item) => {
                const atp = item.available_to_promise;
                const isStockout = atp <= 0;
                return (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Part Number */}
                    <td className="py-4 px-4 font-mono font-bold text-sm text-blue-600">
                      <span className="bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 inline-block">
                        {item.part_number}
                      </span>
                    </td>

                    {/* Name / Description */}
                    <td className="py-4 px-4">
                      <div className="font-bold text-slate-900 text-xs">{item.name}</div>
                      <div className="text-[11px] text-slate-500">{item.category || 'Maintenance Spare Part'}</div>
                    </td>

                    {/* Warehouse & Bin */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5 font-medium text-slate-700 text-xs">
                        <MapPin size={13} className="text-slate-400" />
                        <span>{item.warehouse_name}</span>
                        <span className="text-slate-300">•</span>
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">{item.bin_location}</span>
                      </div>
                    </td>

                    {/* On Hand */}
                    <td className="py-4 px-4 text-center font-mono font-bold text-slate-800 text-sm">
                      {item.quantity_on_hand}
                    </td>

                    {/* Reserved */}
                    <td className="py-4 px-4 text-center font-mono font-bold text-amber-600 text-sm">
                      {item.reserved_quantity}
                    </td>

                    {/* ATP */}
                    <td className="py-4 px-4 text-center">
                      <span className={`inline-block font-mono font-extrabold text-sm px-3 py-0.5 rounded-lg border ${
                        isStockout
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {atp}
                      </span>
                    </td>

                    {/* Unit Cost */}
                    <td className="py-4 px-4 text-right font-mono font-extrabold text-slate-900 text-sm">
                      ${parseFloat(item.unit_cost || '0').toFixed(2)}
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4 text-center">
                      {isStockout ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> STOCKOUT
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> READY
                        </span>
                      )}
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
