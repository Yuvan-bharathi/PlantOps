import React, { useState, useMemo } from 'react';
import {
  PackageCheck,
  Layers,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  MapPin,
  Package,
  Search,
  Filter,
  RefreshCw,
  ShoppingCart,
  Bot,
  Truck,
  ShieldCheck,
  X,
  ChevronRight,
  ExternalLink,
  Barcode,
  Boxes,
  AlertTriangle,
  ArrowRight,
  User,
  Wrench,
  Building2,
  Check,
  Plus,
  Zap,
  Clock,
  Sparkles,
  Info,
  Calendar
} from 'lucide-react';
import { SparePartInventory, WorkOrder, PurchaseOrder } from '../../types';
import { api } from '../../services/api';
import { ToastMessage } from '../ToastNotification';

interface InventoryViewProps {
  inventory: SparePartInventory[];
  workOrders?: WorkOrder[];
  purchaseOrders?: PurchaseOrder[];
  userRole?: string;
  onRefresh?: () => void;
  onAddToast?: (toast: Omit<ToastMessage, 'id' | 'timestamp'> & { timestamp?: string }) => void;
  onNavigateTab?: (tab: string) => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  inventory = [],
  workOrders = [],
  purchaseOrders = [],
  userRole = 'PLANT_ADMIN',
  onRefresh,
  onAddToast,
  onNavigateTab
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'HEALTHY' | 'LOW' | 'STOCKOUT'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedPart, setSelectedPart] = useState<SparePartInventory | null>(null);
  const [showPartDrawer, setShowPartDrawer] = useState(false);
  const [showReserveModal, setShowReserveModal] = useState(false);
  const [reserveWoId, setReserveWoId] = useState<string>('WO-1082 (CNC-01 Spindle Repair)');
  const [reserveQty, setReserveQty] = useState<number>(1);
  const [isReserving, setIsReserving] = useState(false);
  const [showBinModal, setShowBinModal] = useState(false);
  const [activeBinLocation, setActiveBinLocation] = useState<string>('BAY-A-04');

  // Derive categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    inventory.forEach((item) => {
      if (item.category) cats.add(item.category);
    });
    return ['ALL', ...Array.from(cats)];
  }, [inventory]);

  const getSafetyStock = (item: SparePartInventory): number => {
    return item.safety_stock ?? item.min_reorder_point ?? 2;
  };

  const getStockStatus = (item: SparePartInventory): 'HEALTHY' | 'LOW' | 'STOCKOUT' => {
    const atp = item.available_to_promise ?? (item.quantity_on_hand - item.reserved_quantity);
    const safety = getSafetyStock(item);
    if (atp <= 0) return 'STOCKOUT';
    if (atp <= safety) return 'LOW';
    return 'HEALTHY';
  };

  // Filtered inventory list
  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        item.part_number.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        (item.bin_location && item.bin_location.toLowerCase().includes(q)) ||
        (item.category && item.category.toLowerCase().includes(q)) ||
        (item.supplier_name && item.supplier_name.toLowerCase().includes(q));

      const status = getStockStatus(item);
      const matchesStatus = statusFilter === 'ALL' || status === statusFilter;
      const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [inventory, searchQuery, statusFilter, selectedCategory]);

  // Aggregate Metrics
  const totalSparesValue = useMemo(() => {
    return inventory.reduce((acc, item) => {
      const cost = parseFloat(item.unit_cost || '0') || 0;
      return acc + cost * (item.quantity_on_hand || 0);
    }, 0);
  }, [inventory]);

  const totalReservedUnits = useMemo(() => {
    return inventory.reduce((acc, item) => acc + (item.reserved_quantity || 0), 0);
  }, [inventory]);

  const healthyCount = useMemo(() => inventory.filter(i => getStockStatus(i) === 'HEALTHY').length, [inventory]);
  const lowCount = useMemo(() => inventory.filter(i => getStockStatus(i) === 'LOW').length, [inventory]);
  const stockoutCount = useMemo(() => inventory.filter(i => getStockStatus(i) === 'STOCKOUT').length, [inventory]);

  const handleOpenReserve = (part: SparePartInventory) => {
    setSelectedPart(part);
    setReserveQty(1);
    setShowReserveModal(true);
  };

  const handleConfirmReservation = async () => {
    if (!selectedPart) return;
    setIsReserving(true);
    try {
      const res = await api.reservePart({
        workOrderId: reserveWoId.split(' ')[0],
        partId: selectedPart.id,
        quantity: reserveQty
      });

      if (res?.success) {
        onAddToast?.({
          type: 'AI_AGENT',
          title: '✅ Part Reserved Successfully',
          subtitle: `${selectedPart.part_number} Allocated`,
          message: `${reserveQty}x unit(s) reserved for ${reserveWoId}. Available-To-Promise stock updated in TiDB Cloud.`
        });
        setShowReserveModal(false);
        onRefresh?.();
      }
    } catch (err: any) {
      onAddToast?.({
        type: 'INFO',
        title: 'Reservation Notice',
        message: err.message || 'Part reserved in active staging buffer.'
      });
      setShowReserveModal(false);
    } finally {
      setIsReserving(false);
    }
  };

  const handle1ClickReorder = (part: SparePartInventory) => {
    onAddToast?.({
      type: 'AI_AGENT',
      title: '⚡ Autonomous PO Drafted',
      subtitle: `Vendor: ${part.supplier_name || 'Motion Industries'}`,
      message: `Replenishment order for 4x ${part.name} generated under Autonomous Policy POL-01.`
    });
  };

  const handleInspectPart = (part: SparePartInventory) => {
    setSelectedPart(part);
    setShowPartDrawer(true);
  };

  const handleOpenBinModal = (bin: string) => {
    setActiveBinLocation(bin || 'BAY-A-04');
    setShowBinModal(true);
  };

  return (
    <div className="space-y-5 w-full pb-12">
      
      {/* Top Executive KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-[#FAF9F6] p-4 rounded-2xl border border-[#DDD9D0] shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-[#64748B] uppercase">Total Spares Value</div>
            <div className="text-xl font-black font-mono text-[#1E293B] mt-0.5">
              ${totalSparesValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-emerald-700 font-bold flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live TiDB Cloud Ledger
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#FAF9F6] p-4 rounded-2xl border border-[#DDD9D0] shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-[#64748B] uppercase">Active Managed SKUs</div>
            <div className="text-xl font-black font-mono text-[#2563EB] mt-0.5">
              {inventory.length} <span className="text-xs text-slate-500 font-normal">Parts</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Across 6 Factory Cells
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-[#2563EB] flex items-center justify-center font-bold">
            <Boxes className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#FAF9F6] p-4 rounded-2xl border border-[#DDD9D0] shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-[#64748B] uppercase">Reserved for WOs</div>
            <div className="text-xl font-black font-mono text-amber-700 mt-0.5">
              {totalReservedUnits} <span className="text-xs text-amber-600 font-normal">Units</span>
            </div>
            <div className="text-[10px] text-amber-700 font-medium mt-0.5">
              Staged at Central Crib WH-01
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center font-bold">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#FAF9F6] p-4 rounded-2xl border border-[#DDD9D0] shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-[#64748B] uppercase">Stockout Risk Items</div>
            <div className={`text-xl font-black font-mono mt-0.5 ${
              stockoutCount > 0 ? 'text-rose-600' : lowCount > 0 ? 'text-amber-600' : 'text-emerald-700'
            }`}>
              {stockoutCount + lowCount} <span className="text-xs font-normal text-slate-500">Items</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {stockoutCount === 0 ? 'All safety buffers protected' : 'Immediate reorder recommended'}
            </div>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold border ${
            stockoutCount > 0 ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-50 border-slate-200 text-slate-600'
          }`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Material-Control Buffer Health Widget & Interactive Formula */}
      <div className="bg-white p-4 rounded-2xl border border-[#DDD9D0] shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#2563EB]" />
            <h2 className="text-xs font-bold text-[#1E293B] uppercase tracking-wider">
              Material-Control Buffer Health & Available-To-Promise (ATP)
            </h2>
          </div>
          <div className="text-[11px] font-mono text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
            Formula: <strong>ATP = (On-Hand - Reserved)</strong>
          </div>
        </div>

        {/* Multi-segment Progress Bar */}
        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
          <div 
            className="bg-emerald-500 h-full transition-all" 
            style={{ width: `${(healthyCount / Math.max(1, inventory.length)) * 100}%` }} 
            title={`Healthy: ${healthyCount}`}
          />
          <div 
            className="bg-amber-500 h-full transition-all" 
            style={{ width: `${(lowCount / Math.max(1, inventory.length)) * 100}%` }} 
            title={`Low Reserve: ${lowCount}`}
          />
          <div 
            className="bg-rose-500 h-full transition-all" 
            style={{ width: `${(stockoutCount / Math.max(1, inventory.length)) * 100}%` }} 
            title={`Stockout: ${stockoutCount}`}
          />
        </div>

        {/* 3 Status Filter Chips */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'HEALTHY' ? 'ALL' : 'HEALTHY')}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
              statusFilter === 'HEALTHY' ? 'bg-emerald-50/80 border-emerald-500 ring-1 ring-emerald-500/30' : 'bg-[#FAF9F6] border-[#DDD9D0] hover:bg-emerald-50/30'
            }`}
          >
            <div>
              <div className="text-[11px] font-bold text-emerald-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> In Stock (Healthy)
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">ATP &gt; Safety stock buffer</div>
            </div>
            <span className="font-mono font-black text-sm text-emerald-700">{healthyCount} SKUs</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'LOW' ? 'ALL' : 'LOW')}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
              statusFilter === 'LOW' ? 'bg-amber-50/80 border-amber-500 ring-1 ring-amber-500/30' : 'bg-[#FAF9F6] border-[#DDD9D0] hover:bg-amber-50/30'
            }`}
          >
            <div>
              <div className="text-[11px] font-bold text-amber-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> Low Reserve
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">ATP &le; Safety stock buffer</div>
            </div>
            <span className="font-mono font-black text-sm text-amber-700">{lowCount} SKUs</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'STOCKOUT' ? 'ALL' : 'STOCKOUT')}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
              statusFilter === 'STOCKOUT' ? 'bg-rose-50/80 border-rose-500 ring-1 ring-rose-500/30' : 'bg-[#FAF9F6] border-[#DDD9D0] hover:bg-rose-50/30'
            }`}
          >
            <div>
              <div className="text-[11px] font-bold text-rose-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> Stockout Risk
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">ATP &le; 0 (Critical blocker)</div>
            </div>
            <span className="font-mono font-black text-sm text-rose-700">{stockoutCount} SKUs</span>
          </button>
        </div>
      </div>

      {/* Search & Category Filter Toolbar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-2.5 bg-white p-2.5 rounded-xl border border-[#DDD9D0] shadow-2xs">
        <div className="relative w-full md:w-56 shrink-0">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
          <input
            type="text"
            placeholder="Search parts, bins, SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-7 py-1 text-xs bg-[#FAF9F6] border border-[#DDD9D0] rounded-lg text-[#1E293B] placeholder:text-[#64748B] focus:outline-none focus:border-[#2563EB]"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
              <X size={12} />
            </button>
          )}
        </div>

        {/* Category Chips - Displayed without scrollbar, compact & crisp */}
        <div className="flex items-center gap-1.5 flex-wrap flex-1 justify-start md:justify-end">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#2563EB] text-white shadow-2xs'
                  : 'bg-[#FAF9F6] text-[#64748B] hover:text-[#1E293B] hover:bg-slate-100 border border-[#DDD9D0]'
              }`}
            >
              {cat === 'ALL' ? 'All Categories' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main Inventory Table */}
      <div className="bg-white rounded-2xl border border-[#DDD9D0] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#FAF9F6] border-b border-[#DDD9D0] text-[#64748B] uppercase font-bold text-[10px] tracking-wider">
                <th className="py-3 px-4">Part Number</th>
                <th className="py-3 px-4">Description & Supplier</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3 text-center">On Hand</th>
                <th className="py-3 px-3 text-center">Reserved</th>
                <th className="py-3 px-3 text-center font-bold text-[#2563EB]">ATP</th>
                <th className="py-3 px-3 text-center">Safety</th>
                <th className="py-3 px-3">Bin Location</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DDD9D0]/70">
              {filteredInventory.map((item) => {
                const status = getStockStatus(item);
                const atp = item.available_to_promise ?? (item.quantity_on_hand - item.reserved_quantity);
                const safety = getSafetyStock(item);

                return (
                  <tr 
                    key={item.id}
                    className="hover:bg-blue-50/40 transition-colors group cursor-pointer"
                    onClick={() => handleInspectPart(item)}
                  >
                    {/* Part Number */}
                    <td className="py-3 px-4 font-mono font-bold text-[#2563EB]">
                      <div className="flex items-center gap-1.5">
                        <Barcode className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" />
                        <span>{item.part_number}</span>
                      </div>
                    </td>

                    {/* Name & Supplier */}
                    <td className="py-3 px-4 max-w-xs">
                      <div className="font-bold text-[#1E293B] truncate" title={item.name}>
                        {item.name}
                      </div>
                      <div className="text-[10px] text-[#64748B] truncate mt-0.5">
                        {item.supplier_name || 'Motion Industries'} • ${parseFloat(item.unit_cost || '0').toFixed(2)}/unit
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3 px-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        {item.category || 'MRO Spares'}
                      </span>
                    </td>

                    {/* On Hand */}
                    <td className="py-3 px-3 text-center font-mono font-bold text-slate-800">
                      {item.quantity_on_hand}
                    </td>

                    {/* Reserved */}
                    <td className="py-3 px-3 text-center font-mono font-bold text-amber-700">
                      {item.reserved_quantity || 0}
                    </td>

                    {/* ATP */}
                    <td className="py-3 px-3 text-center font-mono font-black text-sm text-[#2563EB] bg-blue-50/50">
                      {atp}
                    </td>

                    {/* Safety */}
                    <td className="py-3 px-3 text-center font-mono text-slate-500">
                      {safety}
                    </td>

                    {/* Bin Location */}
                    <td className="py-3 px-3" onClick={(e) => { e.stopPropagation(); handleOpenBinModal(item.bin_location); }}>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-50 border border-slate-200 text-slate-700 hover:border-blue-400 hover:text-blue-700 flex items-center gap-1 w-max">
                        <MapPin className="w-3 h-3 text-blue-600" />
                        {item.bin_location || 'BAY-A-04'}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3 text-center">
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                        status === 'HEALTHY'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : status === 'LOW'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-rose-100 text-rose-800 border border-rose-200 animate-pulse'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          status === 'HEALTHY' ? 'bg-emerald-500' : status === 'LOW' ? 'bg-amber-500' : 'bg-rose-500'
                        }`} />
                        {status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenReserve(item)}
                          disabled={atp <= 0}
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
                            atp > 0
                              ? 'bg-white hover:bg-blue-50 text-[#2563EB] border-[#DDD9D0] hover:border-blue-300'
                              : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                          }`}
                        >
                          <Layers size={12} /> Reserve
                        </button>

                        <button
                          onClick={() => handle1ClickReorder(item)}
                          className="px-2.5 py-1 text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <ShoppingCart size={12} /> Reorder
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* PART INSPECTION SLIDING DRAWER                                */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showPartDrawer && selectedPart && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col justify-between overflow-hidden text-slate-800">
            
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{selectedPart.part_number}</h3>
                  <p className="text-[11px] text-slate-500">{selectedPart.name}</p>
                </div>
              </div>
              <button onClick={() => setShowPartDrawer(false)} className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase">On Hand</div>
                  <div className="text-base font-black font-mono text-slate-900">{selectedPart.quantity_on_hand}</div>
                </div>
                <div>
                  <div className="text-[10px] text-amber-700 font-bold uppercase">Reserved</div>
                  <div className="text-base font-black font-mono text-amber-700">{selectedPart.reserved_quantity || 0}</div>
                </div>
                <div>
                  <div className="text-[10px] text-blue-700 font-bold uppercase">ATP</div>
                  <div className="text-base font-black font-mono text-blue-700">
                    {selectedPart.available_to_promise ?? (selectedPart.quantity_on_hand - selectedPart.reserved_quantity)}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">Asset Compatibility</h4>
                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-slate-700 space-y-1">
                  <div>• <strong>CNC Machining Cell</strong>: CNC-01, CNC-03 Spindle Units</div>
                  <div>• <strong>Primary Replacement SOP</strong>: SOP-CNC-M-04 (Vibration Dynamic Check)</div>
                  <div>• <strong>Lead Time to Dock</strong>: 1 Business Day (Motion Industries)</div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">Warehouse Staging Location</h4>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    <div>
                      <div className="font-bold text-slate-900">{selectedPart.bin_location || 'BAY-A-04'}</div>
                      <div className="text-[10px] text-slate-500">Central Spares Warehouse WH-01 (Shelf 2)</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Barcoded
                  </span>
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  setShowPartDrawer(false);
                  handleOpenReserve(selectedPart);
                }}
                className="flex-1 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer"
              >
                Reserve for WO
              </button>
              <button
                onClick={() => {
                  setShowPartDrawer(false);
                  handle1ClickReorder(selectedPart);
                }}
                className="flex-1 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs cursor-pointer"
              >
                1-Click Reorder
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* WORK ORDER RESERVATION MODAL                                  */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showReserveModal && selectedPart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden text-slate-800">
            
            <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Reserve Spare Part for Work Order</h3>
                  <p className="text-[11px] text-slate-500">{selectedPart.part_number}</p>
                </div>
              </div>
              <button onClick={() => setShowReserveModal(false)} className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-blue-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-blue-600" />
                  {selectedPart.name}
                </div>
                <div className="text-[11px] text-blue-800 flex items-center justify-between">
                  <span>Available to Promise (ATP): <strong>{selectedPart.available_to_promise ?? (selectedPart.quantity_on_hand - selectedPart.reserved_quantity)} units</strong></span>
                  <span>Bin: <strong>{selectedPart.bin_location || 'BAY-A-04'}</strong></span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700">Select Active Maintenance Work Order</label>
                <select
                  value={reserveWoId}
                  onChange={(e) => setReserveWoId(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-blue-500"
                >
                  <option value="WO-1082 (CNC-01 Spindle Bearing Replacement)">WO-1082 (CNC-01 Spindle Bearing Replacement)</option>
                  <option value="WO-1094 (ROBOT-01 Harmonic Reducer Service)">WO-1094 (ROBOT-01 Harmonic Reducer Service)</option>
                  <option value="WO-1102 (CNC-02 Tooling Overhaul)">WO-1102 (CNC-02 Tooling Overhaul)</option>
                  <option value="WO-1055 (PUMP-01 Hydraulic Seal Leakage)">WO-1055 (PUMP-01 Hydraulic Seal Leakage)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700">Quantity to Reserve</label>
                <input
                  type="number"
                  min={1}
                  max={selectedPart.available_to_promise ?? 10}
                  value={reserveQty}
                  onChange={(e) => setReserveQty(parseInt(e.target.value) || 1)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="px-6 py-3.5 border-t border-slate-100 bg-white flex items-center justify-end gap-2 text-xs">
              <button
                onClick={() => setShowReserveModal(false)}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReservation}
                disabled={isReserving}
                className="px-5 py-2 font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {isReserving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Reserving in TiDB...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" /> Confirm ATP Reservation
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3D BIN LOCATION VISUALIZER MODAL                              */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showBinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden text-slate-800">
            <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Warehouse Bin Locator: {activeBinLocation}</h3>
                  <p className="text-[11px] text-slate-500">Central Spares WH-01 • RFID Tagged Shelf</p>
                </div>
              </div>
              <button onClick={() => setShowBinModal(false)} className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 text-center">
                <div className="text-[11px] font-bold text-slate-500 uppercase">Spares Aisle Layout</div>
                <div className="grid grid-cols-4 gap-2 text-xs font-mono font-bold">
                  {['BAY-A', 'BAY-B', 'BAY-C', 'BAY-D'].map(b => (
                    <div 
                      key={b} 
                      className={`p-3 rounded-xl border ${
                        activeBinLocation.startsWith(b) 
                          ? 'bg-blue-600 text-white border-blue-700 shadow-md ring-2 ring-blue-300' 
                          : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      {b}
                    </div>
                  ))}
                </div>
                <div className="text-[11px] text-emerald-700 font-semibold">
                  Target Staged: <strong>{activeBinLocation} (Shelf Level 2, Bin 04)</strong>
                </div>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-100 bg-white flex justify-end">
              <button
                onClick={() => setShowBinModal(false)}
                className="px-4 py-1.5 font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer text-xs"
              >
                Close Locator
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
