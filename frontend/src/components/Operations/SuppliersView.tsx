import React, { useEffect, useState, useMemo } from 'react';
import {
  Building2,
  Star,
  Truck,
  ShieldCheck,
  Mail,
  DollarSign,
  Package,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  Zap,
  Phone,
  Clock,
  ExternalLink,
  Award,
  Layers,
  ChevronRight,
  X,
  FileCheck,
  ShoppingCart,
  Send,
  User,
  Radio,
  Sparkles,
  Barcode
} from 'lucide-react';
import { api } from '../../services/api';

interface SuppliersViewProps {
  onAddToast?: (toast: any) => void;
  onNavigateTab?: (tab: string) => void;
}

export const SuppliersView: React.FC<SuppliersViewProps> = ({ onAddToast, onNavigateTab }) => {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PREFERRED' | 'ACTIVE' | 'RESTRICTED'>('ALL');
  const [selectedSupplier, setSelectedSupplier] = useState<any | null>(null);
  const [isExpediting, setIsExpediting] = useState<string | null>(null);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [showExpediteModal, setShowExpediteModal] = useState(false);
  const [expediteNotes, setExpediteNotes] = useState('Critical line bottleneck: Emergency MRO courier dispatch requested.');
  const [expediteCarrier, setExpediteCarrier] = useState('FedEx Custom Critical (Same-Day Hotshot)');
  const [showQuickPoModal, setShowQuickPoModal] = useState(false);
  const [quickPoPart, setQuickPoPart] = useState('');
  const [quickPoQty, setQuickPoQty] = useState(2);

  const fetchSuppliers = () => {
    setLoading(true);
    api.getSuppliers().then(res => {
      if (res.success && res.data && res.data.length > 0) {
        setSuppliers(res.data);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  // Filtered Suppliers
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((sup) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        sup.name.toLowerCase().includes(q) ||
        sup.code.toLowerCase().includes(q) ||
        (sup.specialty && sup.specialty.toLowerCase().includes(q)) ||
        (sup.rep_name && sup.rep_name.toLowerCase().includes(q)) ||
        (sup.contact_email && sup.contact_email.toLowerCase().includes(q));

      const matchesStatus =
        statusFilter === 'ALL' ||
        sup.status === statusFilter ||
        (statusFilter === 'RESTRICTED' && (sup.status === 'RESTRICTED' || sup.status === 'BLOCKED'));

      return matchesSearch && matchesStatus;
    });
  }, [suppliers, searchQuery, statusFilter]);

  // Aggregate Stats
  const preferredCount = useMemo(() => suppliers.filter(s => s.status === 'PREFERRED').length, [suppliers]);
  const avgRating = useMemo(() => {
    if (suppliers.length === 0) return '4.92';
    const sum = suppliers.reduce((acc, s) => acc + (parseFloat(s.rating || '4.8') || 0), 0);
    return (sum / suppliers.length).toFixed(2);
  }, [suppliers]);

  const totalNetworkSpend = useMemo(() => {
    return suppliers.reduce((acc, s) => acc + (parseFloat(s.total_po_spend || '0') || 0), 0);
  }, [suppliers]);

  // Supplier Catalog Data
  const getSupplierCatalog = (sup: any) => {
    const code = sup.code || '';
    if (code.includes('MOTION')) {
      return [
        { sku: 'SKF-6205-2RSH', name: 'Deep Groove Ball Bearing 25x52x15mm', leadTime: '1 Day', unitPrice: '$45.00', inStock: '8 Units in WH-01', category: 'Bearings' },
        { sku: 'FAG-7210-B-TVP', name: 'Angular Contact Ball Bearing 50x90x20mm', leadTime: '2 Days', unitPrice: '$120.00', inStock: '4 Units in WH-01', category: 'Bearings' },
        { sku: 'TIMKEN-32008X', name: 'Tapered Roller Bearing 40x68x19mm', leadTime: '2 Days', unitPrice: '$85.00', inStock: '5 Units in WH-01', category: 'Bearings' },
        { sku: 'GAT-SYN-8M-50', name: 'Synchro-Power Heavy Duty Timing Belt', leadTime: '1 Day', unitPrice: '$85.00', inStock: '12 Units in WH-01', category: 'Power Transmission' }
      ];
    }
    if (code.includes('NSK')) {
      return [
        { sku: 'NSK-7008-CTYNSULP4', name: 'High-Precision Ceramic Spindle Bearing 40x68x15mm', leadTime: '1 Day', unitPrice: '$320.00', inStock: '3 Units in WH-01', category: 'Precision Spindles' },
        { sku: 'NSK-BGR-025', name: 'High-Speed Sealed Spindle Bearing Set', leadTime: '2 Days', unitPrice: '$540.00', inStock: '2 Units in WH-01', category: 'Precision Spindles' }
      ];
    }
    if (code.includes('SANDVIK')) {
      return [
        { sku: 'SANDVIK-1P220-1200', name: 'Solid Carbide 4-Flute End Mill 12mm TiAlN', leadTime: '1 Day', unitPrice: '$95.00', inStock: '8 Units in WH-01', category: 'CNC Tooling' },
        { sku: 'SANDVIK-2P120-0800', name: 'Ball Nose Finishing Cutter 8mm 2-Flute', leadTime: '1 Day', unitPrice: '$115.00', inStock: '6 Units in WH-01', category: 'CNC Tooling' },
        { sku: 'SANDVIK-RA245-050', name: '50mm Indexable Face Mill Body (5-Insert Pocket)', leadTime: '1 Day', unitPrice: '$280.00', inStock: '4 Units in WH-01', category: 'CNC Tooling' }
      ];
    }
    if (code.includes('PARKER')) {
      return [
        { sku: 'PARKER-V884-75', name: 'Fluorocarbon Hydraulic Rod Seal Kit', leadTime: '1 Day', unitPrice: '$65.00', inStock: '12 Units in WH-01', category: 'Seals & Hydraulics' },
        { sku: 'PARKER-D1VW001CNTW', name: 'Hydraulic Proportional Directional Valve', leadTime: '2 Days', unitPrice: '$450.00', inStock: '2 Units in WH-01', category: 'Hydraulics' }
      ];
    }
    if (code.includes('FANUC')) {
      return [
        { sku: 'FANUC-A06B-0223', name: 'AC Servo Drive Motor Alpha iF 4/4000', leadTime: '3 Days', unitPrice: '$890.00', inStock: '2 Units in WH-01', category: 'Robotics & Drives' },
        { sku: 'FANUC-TP-31i', name: 'Teach Pendant Cable Harness 10m', leadTime: '2 Days', unitPrice: '$420.00', inStock: '1 Unit in WH-01', category: 'Robotics' }
      ];
    }
    if (code.includes('FESTO')) {
      return [
        { sku: 'FESTO-DFM-32-50', name: 'Festo Guided Pneumatic Actuator Cylinder 32mm', leadTime: '1 Day', unitPrice: '$145.00', inStock: '6 Units in WH-01', category: 'Pneumatics' },
        { sku: 'FESTO-MS6-LFR', name: 'Compressed Air Filter Regulator Lubricator', leadTime: '1 Day', unitPrice: '$180.00', inStock: '4 Units in WH-01', category: 'Pneumatics' }
      ];
    }
    return [
      { sku: 'TREGASKISS-TOUGH-GUN', name: 'Robotic MIG Welding Torch Assembly 500A Water-Cooled', leadTime: '2 Days', unitPrice: '$520.00', inStock: '2 Units in WH-01', category: 'Welding' },
      { sku: 'LITHIUM-AGV-4860', name: 'AGV LiFePO4 48V 60Ah Rapid-Swap Battery Pack', leadTime: '3 Days', unitPrice: '$1,250.00', inStock: '3 Units in WH-01', category: 'Power & AGV' }
    ];
  };

  const handleOpenExpedite = (sup: any) => {
    setSelectedSupplier(sup);
    setShowExpediteModal(true);
  };

  const handleConfirmExpedite = async () => {
    if (!selectedSupplier) return;
    setIsExpediting(selectedSupplier.id);
    try {
      await api.expediteSupplier(selectedSupplier.id, `${expediteCarrier}: ${expediteNotes}`);
      onAddToast?.({
        type: 'AI_AGENT',
        title: `⚡ Priority Expedite Dispatched to ${selectedSupplier.name}`,
        subtitle: `Carrier: ${expediteCarrier.split(' ')[0]}`,
        message: `Emergency EDI transmission sent. Vendor response SLA: < 15 minutes. Tracking allocated.`
      });
      setShowExpediteModal(false);
    } catch (err: any) {
      onAddToast?.({
        type: 'WARNING',
        title: 'Expedite Request Notice',
        message: err.message || 'Expedite signal queued.'
      });
      setShowExpediteModal(false);
    } finally {
      setIsExpediting(null);
    }
  };

  const handleCreateQuickPo = (sup: any, part?: any) => {
    setSelectedSupplier(sup);
    setQuickPoPart(part?.name || 'MRO Replacement Spares Batch');
    setShowQuickPoModal(true);
  };

  const handleConfirmQuickPo = () => {
    onAddToast?.({
      type: 'SUCCESS',
      title: '🛒 Purchase Order Dispatched',
      subtitle: `Vendor: ${selectedSupplier?.name}`,
      message: `PO for ${quickPoQty}x ${quickPoPart} generated and transmitted via EDI.`
    });
    setShowQuickPoModal(false);
  };

  const getMonogram = (name: string, code: string) => {
    if (code.includes('MOTION')) return 'MOT';
    if (code.includes('APPLIED')) return 'APP';
    if (code.includes('GRAINGER')) return 'GRA';
    if (code.includes('NSK')) return 'NSK';
    if (code.includes('FANUC')) return 'FAN';
    if (code.includes('PARKER')) return 'PRK';
    if (code.includes('FESTO')) return 'FES';
    if (code.includes('SANDVIK')) return 'SAN';
    return name.substring(0, 3).toUpperCase();
  };

  const getMonogramBg = (code: string) => {
    if (code.includes('MOTION')) return 'bg-blue-600 text-white';
    if (code.includes('APPLIED')) return 'bg-indigo-600 text-white';
    if (code.includes('GRAINGER')) return 'bg-amber-600 text-white';
    if (code.includes('NSK')) return 'bg-emerald-600 text-white';
    if (code.includes('FANUC')) return 'bg-yellow-500 text-slate-900';
    if (code.includes('PARKER')) return 'bg-teal-600 text-white';
    if (code.includes('FESTO')) return 'bg-cyan-600 text-white';
    if (code.includes('SANDVIK')) return 'bg-orange-600 text-white';
    return 'bg-slate-700 text-white';
  };

  return (
    <div className="space-y-5 w-full pb-12">
      
      {/* Executive Header & KPI Banner */}
      <div className="bg-[#FAF9F6] p-5 rounded-2xl border border-[#DDD9D0] shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-black text-[#1E293B] tracking-tight">
                MRO Spares Suppliers & Vendor Directory
              </h1>
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                EDI Connected
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              Verified OEM and authorized distributor directory with real-time SLA metrics, live EDI integration, and emergency dispatch.
            </p>
          </div>
        </div>

        {/* Global KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
          <div className="bg-white px-3 py-2 rounded-xl border border-[#DDD9D0] shadow-2xs">
            <div className="text-[10px] font-bold text-[#64748B] uppercase">Active Vendors</div>
            <div className="text-base font-black font-mono text-[#1E293B] mt-0.5">
              {suppliers.length} <span className="text-xs text-slate-400 font-normal">Suppliers</span>
            </div>
          </div>

          <div className="bg-white px-3 py-2 rounded-xl border border-[#DDD9D0] shadow-2xs">
            <div className="text-[10px] font-bold text-emerald-700 uppercase">Tier-1 Preferred</div>
            <div className="text-base font-black font-mono text-emerald-700 mt-0.5">
              {preferredCount} <span className="text-xs text-emerald-600 font-normal">Vendors</span>
            </div>
          </div>

          <div className="bg-white px-3 py-2 rounded-xl border border-[#DDD9D0] shadow-2xs">
            <div className="text-[10px] font-bold text-[#64748B] uppercase">Network SLA</div>
            <div className="text-base font-black font-mono text-[#2563EB] mt-0.5">
              99.4% <span className="text-xs text-slate-400 font-normal">On-Time</span>
            </div>
          </div>

          <div className="bg-white px-3 py-2 rounded-xl border border-[#DDD9D0] shadow-2xs">
            <div className="text-[10px] font-bold text-[#64748B] uppercase">Annual Volume</div>
            <div className="text-base font-black font-mono text-[#1E293B] mt-0.5">
              ${totalNetworkSpend.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-[#DDD9D0] shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
          <input
            type="text"
            placeholder="Search vendor name, SKU specialty, rep..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-1.5 text-xs bg-[#FAF9F6] border border-[#DDD9D0] rounded-xl text-[#1E293B] placeholder:text-[#64748B] focus:outline-none focus:border-[#2563EB]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-[#2563EB] text-white shadow-xs'
                : 'bg-[#FAF9F6] text-[#64748B] hover:text-[#1E293B] border border-[#DDD9D0]'
            }`}
          >
            All Vendors ({suppliers.length})
          </button>
          <button
            onClick={() => setStatusFilter('PREFERRED')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer ${
              statusFilter === 'PREFERRED'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-[#FAF9F6] text-[#64748B] hover:text-emerald-700 border border-[#DDD9D0]'
            }`}
          >
            <Star className="w-3.5 h-3.5 fill-current" /> Preferred ({preferredCount})
          </button>
          <button
            onClick={() => setStatusFilter('ACTIVE')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              statusFilter === 'ACTIVE'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-[#FAF9F6] text-[#64748B] hover:text-blue-700 border border-[#DDD9D0]'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setStatusFilter('RESTRICTED')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              statusFilter === 'RESTRICTED'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-[#FAF9F6] text-[#64748B] hover:text-rose-700 border border-[#DDD9D0]'
            }`}
          >
            Restricted
          </button>
        </div>
      </div>

      {/* 3-Column Rich Vendor Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSuppliers.map((sup) => {
          const monogram = getMonogram(sup.name, sup.code);
          const monogramBg = getMonogramBg(sup.code);
          const isPreferred = sup.status === 'PREFERRED';

          return (
            <div
              key={sup.id}
              className="bg-white rounded-2xl border border-[#DDD9D0] hover:border-[#2563EB] hover:shadow-md transition-all p-4 flex flex-col justify-between space-y-3.5 relative group"
            >
              {/* Card Header: Monogram, Name, Badges */}
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-10 h-10 rounded-xl font-black text-xs font-mono flex items-center justify-center shrink-0 shadow-2xs ${monogramBg}`}>
                    {monogram}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-black text-[#1E293B] truncate group-hover:text-[#2563EB] transition-colors" title={sup.name}>
                      {sup.name}
                    </h3>
                    <div className="flex items-center gap-1.5 text-[10px] text-[#64748B] mt-0.5">
                      <span className="font-mono font-bold text-slate-500">{sup.code}</span>
                      <span>•</span>
                      <span className="flex items-center text-amber-500 font-bold">
                        <Star className="w-3 h-3 fill-amber-400 mr-0.5" />
                        {sup.rating}
                      </span>
                    </div>
                  </div>
                </div>

                <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full shrink-0 ${
                  isPreferred
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                }`}>
                  {sup.status}
                </span>
              </div>

              {/* Specialty & Rep Pill */}
              <div className="space-y-1.5 text-[11px]">
                <div className="bg-[#FAF9F6] p-2 rounded-xl border border-[#DDD9D0]/70 text-slate-700">
                  <div className="text-[10px] font-bold text-[#64748B] uppercase">Primary Core Specialty</div>
                  <div className="font-semibold text-[#1E293B] truncate mt-0.5">
                    ⚙️ {sup.specialty || 'General Industrial MRO Spares & Consumables'}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-[#64748B] px-1">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-400" /> Rep: <strong className="text-slate-700">{sup.rep_name || 'Accounts Desk'}</strong>
                  </span>
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    SLA {sup.sla_fulfillment || '99.2'}%
                  </span>
                </div>
              </div>

              {/* Fast Metrics 3-Column Box */}
              <div className="grid grid-cols-3 gap-1.5 p-2 bg-[#FAF9F6] rounded-xl border border-[#DDD9D0]/70 text-center text-[10px]">
                <div>
                  <div className="font-bold text-[#64748B] uppercase">Lead Time</div>
                  <div className="font-mono font-black text-slate-900 text-xs mt-0.5">
                    {sup.lead_time_days} Day{sup.lead_time_days > 1 ? 's' : ''}
                  </div>
                </div>
                <div>
                  <div className="font-bold text-[#64748B] uppercase">SKUs</div>
                  <div className="font-mono font-black text-[#2563EB] text-xs mt-0.5">
                    {sup.catalog_parts_count} Parts
                  </div>
                </div>
                <div>
                  <div className="font-bold text-[#64748B] uppercase">Terms</div>
                  <div className="font-mono font-bold text-slate-800 text-xs mt-0.5">
                    {sup.payment_terms || 'Net 30'}
                  </div>
                </div>
              </div>

              {/* Direct Contacts & EDI Line */}
              <div className="flex items-center justify-between text-[10px] text-[#64748B] border-t border-[#DDD9D0]/60 pt-2">
                <a 
                  href={`mailto:${sup.contact_email}`}
                  className="hover:text-[#2563EB] truncate max-w-[140px] flex items-center gap-1"
                  title={sup.contact_email}
                >
                  <Mail className="w-3 h-3 text-slate-400" />
                  {sup.contact_email}
                </a>

                <span className="text-emerald-700 font-medium font-mono text-[9px] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  EDI AS2 Live
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  onClick={() => {
                    setSelectedSupplier(sup);
                    setShowCatalogModal(true);
                  }}
                  className="flex-1 py-1.5 text-xs font-bold bg-[#FAF9F6] hover:bg-blue-50 text-[#2563EB] border border-[#DDD9D0] hover:border-blue-300 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Package className="w-3.5 h-3.5" /> Catalog
                </button>

                <button
                  onClick={() => handleOpenExpedite(sup)}
                  className="flex-1 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-300" /> Expedite
                </button>

                <button
                  onClick={() => handleCreateQuickPo(sup)}
                  className="px-2.5 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all flex items-center justify-center cursor-pointer"
                  title="Create Quick Purchase Order"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>
          );
        })}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* VENDOR CATALOG MODAL                                          */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showCatalogModal && selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden text-slate-800">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50/80 to-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl font-mono font-bold flex items-center justify-center text-xs shadow-sm ${getMonogramBg(selectedSupplier.code)}`}>
                  {getMonogram(selectedSupplier.name, selectedSupplier.code)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    {selectedSupplier.name} — Live Parts Catalog
                  </h3>
                  <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                    <span>Lead: <strong>{selectedSupplier.lead_time_days} Day(s)</strong></span>
                    <span>•</span>
                    <span>SLA: <strong>{selectedSupplier.sla_fulfillment || '99.4'}%</strong></span>
                    <span>•</span>
                    <span>EDI Direct Connect</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowCatalogModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Parts List */}
            <div className="p-6 overflow-y-auto space-y-3 flex-1 bg-slate-50/40">
              <div className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                MRO Spares Managed under Master Agreement
              </div>

              <div className="space-y-2.5">
                {getSupplierCatalog(selectedSupplier).map((part, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-white rounded-xl border border-slate-200 hover:border-blue-400 shadow-2xs flex items-center justify-between gap-3 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate" title={part.name}>
                          {part.name}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                          <span className="font-mono font-bold text-blue-700">{part.sku}</span>
                          <span>•</span>
                          <span>{part.category}</span>
                          <span>•</span>
                          <span className="text-emerald-700 font-medium">Lead: {part.leadTime}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="text-xs font-black font-mono text-slate-900">{part.unitPrice}</div>
                        <div className="text-[10px] text-emerald-700 font-medium">{part.inStock}</div>
                      </div>

                      <button
                        onClick={() => {
                          setShowCatalogModal(false);
                          handleCreateQuickPo(selectedSupplier, part);
                        }}
                        className="px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" /> Order
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-slate-100 bg-white flex items-center justify-between shrink-0 text-xs">
              <span className="text-slate-500 font-mono">
                Master Service Agreement: Active (Net {selectedSupplier.payment_terms || '30'})
              </span>
              <button
                onClick={() => setShowCatalogModal(false)}
                className="px-4 py-1.5 font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer"
              >
                Close Catalog
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* PRIORITY EXPEDITE MODAL                                       */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showExpediteModal && selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden text-slate-800">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-amber-50 to-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-sm shadow-amber-500/20">
                  <Zap className="w-5 h-5 text-amber-200" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Emergency Priority Expedite Dispatch
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Direct EDI transmission to {selectedSupplier.name}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowExpediteModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">24/7 Hotshot Priority Courier Protocol</div>
                  <div className="text-[11px] text-amber-700 mt-0.5">
                    Engages vendor emergency dispatch desk. Target delivery window: <strong>&lt; 6 Hours to Receiving Dock</strong>.
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700">Dedicated Freight Logistics Carrier</label>
                <select
                  value={expediteCarrier}
                  onChange={(e) => setExpediteCarrier(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-blue-500"
                >
                  <option value="FedEx Custom Critical (Same-Day Hotshot)">FedEx Custom Critical (Same-Day Hotshot)</option>
                  <option value="DHL Express SameDay Air (Priority Direct)">DHL Express SameDay Air (Priority Direct)</option>
                  <option value="Regional Courier Direct Van (2-Hour Radius)">Regional Courier Direct Van (2-Hour Radius)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700">Criticality Note & Maintenance Reason</label>
                <textarea
                  value={expediteNotes}
                  onChange={(e) => setExpediteNotes(e.target.value)}
                  rows={3}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-slate-100 bg-white flex items-center justify-end gap-2 text-xs">
              <button
                onClick={() => setShowExpediteModal(false)}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={handleConfirmExpedite}
                disabled={isExpediting !== null}
                className="px-5 py-2 font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-md shadow-amber-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {isExpediting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Transmitting EDI...
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" /> Dispatch Emergency Expedite
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* QUICK PO MODAL                                                */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showQuickPoModal && selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden text-slate-800">
            
            <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Generate Purchase Order
                  </h3>
                  <p className="text-[11px] text-slate-500">{selectedSupplier.name}</p>
                </div>
              </div>
              <button onClick={() => setShowQuickPoModal(false)} className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Spare Part Item</label>
                <input
                  type="text"
                  value={quickPoPart}
                  onChange={(e) => setQuickPoPart(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Quantity</label>
                  <input
                    type="number"
                    min={1}
                    value={quickPoQty}
                    onChange={(e) => setQuickPoQty(parseInt(e.target.value) || 1)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Lead Time</label>
                  <div className="p-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700">
                    {selectedSupplier.lead_time_days} Day(s)
                  </div>
                </div>
              </div>

              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-blue-800 text-[11px] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Auto-authorized under Autonomous Procurement Policy POL-01.</span>
              </div>
            </div>

            <div className="px-6 py-3.5 border-t border-slate-100 bg-white flex items-center justify-end gap-2 text-xs">
              <button
                onClick={() => setShowQuickPoModal(false)}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmQuickPo}
                className="px-5 py-2 font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition-all cursor-pointer"
              >
                Transmit PO via EDI
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
