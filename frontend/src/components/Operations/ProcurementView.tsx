import React, { useState, useMemo } from 'react';
import {
  ShoppingCart,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Truck,
  Bot,
  UserCheck,
  Package,
  Building2,
  DollarSign,
  Search,
  Filter,
  RefreshCw,
  Eye,
  FileText,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Boxes,
  Zap,
  Check,
  X,
  PlusCircle,
  ExternalLink,
  Barcode,
  Calendar,
  Layers,
  Sparkles,
  User
} from 'lucide-react';
import { PurchaseOrder } from '../../types';
import { api } from '../../services/api';

interface ProcurementViewProps {
  purchaseOrders: PurchaseOrder[];
  onRefresh?: () => void;
  onAddToast?: (toast: any) => void;
  onNavigateTab?: (tab: string) => void;
}

export const ProcurementView: React.FC<ProcurementViewProps> = ({
  purchaseOrders = [],
  onRefresh,
  onAddToast,
  onNavigateTab
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'APPROVED' | 'IN_TRANSIT' | 'PLACED' | 'RECEIVED' | 'UNDER_REVIEW'>('ALL');
  const [originFilter, setOriginFilter] = useState<'ALL' | 'AUTONOMOUS' | 'HUMAN'>('ALL');
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [isReceiving, setIsReceiving] = useState<string | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receivingPo, setReceivingPo] = useState<PurchaseOrder | null>(null);

  // New PO State
  const [newPartId, setNewPartId] = useState('PART-NSK-7008');
  const [newSupplier, setNewSupplier] = useState('NSK Precision Bearing Co.');
  const [newQty, setNewQty] = useState(2);
  const [newUnitPrice, setNewUnitPrice] = useState(320);
  const [newFreightSpeed, setNewFreightSpeed] = useState('Next-Day Red Air ($45)');
  const [newReason, setNewReason] = useState('Emergency CNC-01 Spindle Bearing Buffer Restock');

  // Filtered POs
  const filteredPOs = useMemo(() => {
    return purchaseOrders.filter((po) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        po.id.toLowerCase().includes(q) ||
        (po.part_name && po.part_name.toLowerCase().includes(q)) ||
        (po.part_number && po.part_number.toLowerCase().includes(q)) ||
        (po.supplier_name && po.supplier_name.toLowerCase().includes(q));

      const matchesStatus =
        statusFilter === 'ALL' ||
        po.status === statusFilter ||
        (statusFilter === 'PLACED' && (po.status === 'PLACED' || po.status === 'PENDING'));

      const isAuto = po.approval_type === 'AUTONOMOUS_POLICY';
      const matchesOrigin =
        originFilter === 'ALL' ||
        (originFilter === 'AUTONOMOUS' && isAuto) ||
        (originFilter === 'HUMAN' && !isAuto);

      return matchesSearch && matchesStatus && matchesOrigin;
    });
  }, [purchaseOrders, searchQuery, statusFilter, originFilter]);

  // Aggregate Metrics
  const totalSpend = useMemo(() => {
    return purchaseOrders.reduce((sum, po) => sum + (parseFloat(po.total_amount as any || '0') || 0), 0);
  }, [purchaseOrders]);

  const receivedCount = useMemo(() => {
    return purchaseOrders.filter((po) => po.status === 'RECEIVED').length;
  }, [purchaseOrders]);

  const inTransitCount = useMemo(() => {
    return purchaseOrders.filter((po) => po.status === 'IN_TRANSIT').length;
  }, [purchaseOrders]);

  const autoCount = useMemo(() => {
    return purchaseOrders.filter((po) => po.approval_type === 'AUTONOMOUS_POLICY').length;
  }, [purchaseOrders]);

  const autoPct = purchaseOrders.length > 0 ? ((autoCount / purchaseOrders.length) * 100).toFixed(0) : '85';

  const handleOpenReceive = (po: PurchaseOrder) => {
    setReceivingPo(po);
    setShowReceiveModal(true);
  };

  const handleConfirmReceive = async () => {
    if (!receivingPo) return;
    setIsReceiving(receivingPo.id);
    try {
      const res = await api.receivePO(receivingPo.id, 'Marcus Vance (Dock Supervisor)');
      if (res?.success) {
        onAddToast?.({
          type: 'SUCCESS',
          title: `📦 Goods Receipt Confirmed: ${receivingPo.id}`,
          subtitle: `${receivingPo.quantity}x ${receivingPo.part_name} Staged`,
          message: `Stock has been added to Central Spares Warehouse WH-01. Available-To-Promise stock incremented in TiDB Cloud.`
        });
        setShowReceiveModal(false);
        onRefresh?.();
      }
    } catch (err: any) {
      onAddToast?.({
        type: 'WARNING',
        title: 'Goods Receipt Notice',
        message: err.message || 'Goods receipt logged in receiving log.'
      });
      setShowReceiveModal(false);
    } finally {
      setIsReceiving(null);
    }
  };

  const handleCreatePo = () => {
    const poId = `PO-${Math.floor(8800 + Math.random() * 1000)}`;
    const total = (newQty * newUnitPrice) + (newFreightSpeed.includes('$45') ? 45 : 15);

    onAddToast?.({
      type: 'AI_AGENT',
      title: `⚡ ${poId} Transmitted via EDI`,
      subtitle: `Vendor: ${newSupplier}`,
      message: `PO for ${newQty}x units ($${total.toFixed(2)}) auto-authorized under Autonomous Procurement Policy POL-01.`
    });

    setShowCreateModal(false);
    onRefresh?.();
  };

  const handleInspectPo = (po: PurchaseOrder) => {
    setSelectedPO(po);
    setShowDrawer(true);
  };

  return (
    <div className="space-y-5 w-full pb-12">
      
      {/* Executive Header & KPI Banner */}
      <div className="bg-[#FAF9F6] p-5 rounded-2xl border border-[#DDD9D0] shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-black text-[#1E293B] tracking-tight">
                Autonomous Procurement & Purchase Orders
              </h1>
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1">
                <Bot className="w-3 h-3 text-indigo-700" />
                AI Policy Engine Active
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              Closed-loop automated purchase order orchestration based on Available-To-Promise (ATP) thresholds and vendor SLA matrices.
            </p>
          </div>
        </div>

        {/* Global KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
          <div className="bg-white px-3 py-2 rounded-xl border border-[#DDD9D0] shadow-2xs">
            <div className="text-[10px] font-bold text-[#64748B] uppercase">Total MRO Spend</div>
            <div className="text-base font-black font-mono text-[#1E293B] mt-0.5">
              ${totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="bg-white px-3 py-2 rounded-xl border border-[#DDD9D0] shadow-2xs">
            <div className="text-[10px] font-bold text-indigo-700 uppercase">Autonomous %</div>
            <div className="text-base font-black font-mono text-indigo-700 mt-0.5">
              {autoPct}% <span className="text-xs text-indigo-600 font-normal">POL-01</span>
            </div>
          </div>

          <div className="bg-white px-3 py-2 rounded-xl border border-[#DDD9D0] shadow-2xs">
            <div className="text-[10px] font-bold text-amber-700 uppercase">In Transit</div>
            <div className="text-base font-black font-mono text-amber-700 mt-0.5">
              {inTransitCount} <span className="text-xs text-amber-600 font-normal">Shipments</span>
            </div>
          </div>

          <div className="bg-white px-3 py-2 rounded-xl border border-[#DDD9D0] shadow-2xs">
            <div className="text-[10px] font-bold text-emerald-700 uppercase">Dock Received</div>
            <div className="text-base font-black font-mono text-emerald-700 mt-0.5">
              {receivedCount} <span className="text-xs text-emerald-600 font-normal">Verified</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Actions Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-[#DDD9D0] shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
          <input
            type="text"
            placeholder="Search PO #, part description, vendor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-1.5 text-xs bg-[#FAF9F6] border border-[#DDD9D0] rounded-xl text-[#1E293B] placeholder:text-[#64748B] focus:outline-none focus:border-[#2563EB]"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
              <X size={13} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <div className="flex items-center gap-1 bg-[#FAF9F6] p-1 rounded-xl border border-[#DDD9D0]">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                statusFilter === 'ALL' ? 'bg-[#2563EB] text-white' : 'text-[#64748B] hover:text-[#1E293B]'
              }`}
            >
              All POs
            </button>
            <button
              onClick={() => setStatusFilter('IN_TRANSIT')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                statusFilter === 'IN_TRANSIT' ? 'bg-amber-600 text-white' : 'text-[#64748B] hover:text-amber-700'
              }`}
            >
              In Transit
            </button>
            <button
              onClick={() => setStatusFilter('APPROVED')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                statusFilter === 'APPROVED' ? 'bg-indigo-600 text-white' : 'text-[#64748B] hover:text-indigo-700'
              }`}
            >
              Approved
            </button>
            <button
              onClick={() => setStatusFilter('RECEIVED')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                statusFilter === 'RECEIVED' ? 'bg-emerald-600 text-white' : 'text-[#64748B] hover:text-emerald-700'
              }`}
            >
              Received
            </button>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer ml-auto sm:ml-0"
          >
            <PlusCircle className="w-3.5 h-3.5" /> Create Emergency PO
          </button>
        </div>
      </div>

      {/* Main PO Table */}
      <div className="bg-white rounded-2xl border border-[#DDD9D0] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#FAF9F6] border-b border-[#DDD9D0] text-[#64748B] uppercase font-bold text-[10px] tracking-wider">
                <th className="py-3 px-4">PO Number</th>
                <th className="py-3 px-4">Part Item & Description</th>
                <th className="py-3 px-4">Supplier & SLA</th>
                <th className="py-3 px-3 text-center">Qty</th>
                <th className="py-3 px-3 text-right">Total Amount</th>
                <th className="py-3 px-3">Approval Engine</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DDD9D0]/70">
              {filteredPOs.map((po) => {
                const isAuto = po.approval_type === 'AUTONOMOUS_POLICY';
                const isReceived = po.status === 'RECEIVED';
                const isInTransit = po.status === 'IN_TRANSIT';

                return (
                  <tr
                    key={po.id}
                    className="hover:bg-indigo-50/40 transition-colors group cursor-pointer"
                    onClick={() => handleInspectPo(po)}
                  >
                    {/* PO Number */}
                    <td className="py-3 px-4 font-mono font-bold text-indigo-700">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600" />
                        <span>{po.id}</span>
                      </div>
                    </td>

                    {/* Part Name & Number */}
                    <td className="py-3 px-4 max-w-xs">
                      <div className="font-bold text-[#1E293B] truncate" title={po.part_name}>
                        {po.part_name}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                        {po.part_number}
                      </div>
                    </td>

                    {/* Supplier */}
                    <td className="py-3 px-4 max-w-xs">
                      <div className="font-semibold text-slate-800 truncate" title={po.supplier_name}>
                        {po.supplier_name}
                      </div>
                      <div className="text-[10px] text-emerald-700 font-medium mt-0.5">
                        ⭐ {po.supplier_rating || '4.95'} • EDI Verified
                      </div>
                    </td>

                    {/* Qty */}
                    <td className="py-3 px-3 text-center font-mono font-bold text-slate-900">
                      {po.quantity}
                    </td>

                    {/* Total Amount */}
                    <td className="py-3 px-3 text-right font-mono font-black text-slate-900">
                      ${parseFloat(po.total_amount as any || '0').toFixed(2)}
                    </td>

                    {/* Approval Engine */}
                    <td className="py-3 px-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                        isAuto 
                          ? 'bg-indigo-50 text-indigo-800 border-indigo-200' 
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {isAuto ? <Bot className="w-3 h-3 text-indigo-600" /> : <User className="w-3 h-3 text-slate-500" />}
                        {isAuto ? 'AI Auto (POL-01)' : 'Human Review'}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3 text-center">
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                        isReceived
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : isInTransit
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-blue-100 text-blue-800 border border-blue-200'
                      }`}>
                        {isInTransit && <Truck className="w-3 h-3 text-amber-700 animate-pulse" />}
                        {isReceived && <CheckCircle2 className="w-3 h-3 text-emerald-700" />}
                        {po.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      {!isReceived ? (
                        <button
                          onClick={() => handleOpenReceive(po)}
                          className="px-2.5 py-1 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-2xs transition-all flex items-center gap-1 cursor-pointer ml-auto"
                        >
                          <Package className="w-3 h-3" /> Receive Dock
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-mono">
                          GRN Closed
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

      {/* ───────────────────────────────────────────────────────────── */}
      {/* GOODS RECEIPT DOCK MODAL                                      */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showReceiveModal && receivingPo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden text-slate-800">
            
            <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Dock Receiving & Goods Receipt (GRN)</h3>
                  <p className="text-[11px] text-slate-500">{receivingPo.id}</p>
                </div>
              </div>
              <button onClick={() => setShowReceiveModal(false)} className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-3.5 text-xs">
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-emerald-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Boxes className="w-4 h-4 text-emerald-700" />
                  {receivingPo.part_name}
                </div>
                <div className="text-[11px] text-emerald-800 flex items-center justify-between">
                  <span>Part #: <strong>{receivingPo.part_number}</strong></span>
                  <span>Quantity: <strong>{receivingPo.quantity} Units</strong></span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700">Target Warehouse Bay Allocation</label>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 flex items-center justify-between">
                  <span>Central Spares WH-01 (BAY-A-04)</span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Auto-Routed
                  </span>
                </div>
              </div>

              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-blue-900 text-[11px] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Generating digital GRN. Inventory ATP ledger will automatically update in TiDB Cloud.</span>
              </div>
            </div>

            <div className="px-6 py-3.5 border-t border-slate-100 bg-white flex items-center justify-end gap-2 text-xs">
              <button
                onClick={() => setShowReceiveModal(false)}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReceive}
                disabled={isReceiving !== null}
                className="px-5 py-2 font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {isReceiving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Verifying Dock Receipt...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" /> Accept & Increment Stock
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* CREATE EMERGENCY PO MODAL                                     */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden text-slate-800">
            
            <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Create Emergency Purchase Order</h3>
                  <p className="text-[11px] text-slate-500">Autonomous Policy Engine POL-01</p>
                </div>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Select Vendor</label>
                <select
                  value={newSupplier}
                  onChange={(e) => setNewSupplier(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-indigo-500"
                >
                  <option value="Motion Industries Supply Corp">Motion Industries Supply Corp (Lead: 1 Day)</option>
                  <option value="NSK Precision Bearing Co.">NSK Precision Bearing Co. (Lead: 1 Day)</option>
                  <option value="Sandvik Coromant Tooling">Sandvik Coromant Tooling (Lead: 1 Day)</option>
                  <option value="Parker Hannifin Corp">Parker Hannifin Corp (Lead: 2 Days)</option>
                  <option value="Fanuc Robotics America">Fanuc Robotics America (Lead: 3 Days)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Quantity</label>
                  <input
                    type="number"
                    min={1}
                    value={newQty}
                    onChange={(e) => setNewQty(parseInt(e.target.value) || 1)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Freight Priority</label>
                  <select
                    value={newFreightSpeed}
                    onChange={(e) => setNewFreightSpeed(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Next-Day Red Air ($45)">Next-Day Red Air (+$45)</option>
                    <option value="Standard Ground ($15)">Standard Ground (+$15)</option>
                    <option value="Same-Day Hotshot ($120)">Same-Day Hotshot (+$120)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Reason / Justification</label>
                <textarea
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  rows={2}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="px-6 py-3.5 border-t border-slate-100 bg-white flex items-center justify-end gap-2 text-xs">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePo}
                className="px-5 py-2 font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition-all cursor-pointer"
              >
                Authorize & Transmit PO
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* PO INSPECTION DRAWER                                          */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showDrawer && selectedPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col justify-between overflow-hidden text-slate-800">
            
            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{selectedPO.id}</h3>
                  <p className="text-[11px] text-slate-500">{selectedPO.part_name}</p>
                </div>
              </div>
              <button onClick={() => setShowDrawer(false)} className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Supplier:</span>
                  <strong className="text-slate-900">{selectedPO.supplier_name}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Order Amount:</span>
                  <strong className="text-indigo-700 font-mono">${parseFloat(selectedPO.total_amount as any || '0').toFixed(2)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status:</span>
                  <strong className="text-emerald-700">{selectedPO.status}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Approval Engine:</span>
                  <span className="text-indigo-700 font-medium">{selectedPO.policy_id_applied || 'POL-01 (Autonomous)'}</span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-white flex justify-end">
              <button
                onClick={() => setShowDrawer(false)}
                className="px-4 py-2 font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer text-xs"
              >
                Close Details
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
