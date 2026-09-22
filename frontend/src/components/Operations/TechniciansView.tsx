import React, { useEffect, useState } from 'react';
import { 
  HardHat, Wrench, ShieldCheck, Mail, Phone, MapPin, 
  Clock, Award, CheckCircle2, RefreshCw, Package, Plus, 
  Send, AlertTriangle, Boxes, X, ShoppingCart, Lock, Key,
  FileCheck2, ShieldAlert, Cpu, Activity, PlayCircle, Eye,
  QrCode, Scan, Zap, Gauge, Check, UserCheck, AlertOctagon
} from 'lucide-react';
import { api, socket } from '../../services/api';
import { WorkOrder } from '../../types';

interface LotoProtocolStep {
  id: string;
  category: 'ELECTRICAL' | 'PNEUMATIC' | 'HYDRAULIC' | 'MECHANICAL' | 'CALIBRATION';
  title: string;
  location: string;
  procedure: string;
  targetZeroState: string;
}

interface MachineLotoProtocol {
  machineId: string;
  machineCode: string;
  machineType: string;
  oshaStandard: string;
  lockoutBoxLocation: string;
  isolationSteps: LotoProtocolStep[];
  requiredPpe: string[];
}

export const TechniciansView: React.FC = () => {
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Parts Requisition Modal state
  const [showPartsModal, setShowPartsModal] = useState(false);
  const [selectedTech, setSelectedTech] = useState<any>(null);
  const [requestPartId, setRequestPartId] = useState('PART-SKF-6205');
  const [targetMachine, setTargetMachine] = useState('CNC-01');
  const [qty, setQty] = useState(1);
  const [atpStatus, setAtpStatus] = useState<any>(null);
  const [submittingPart, setSubmittingPart] = useState(false);

  // OSHA LOTO Execution Modal state
  const [showLotoModal, setShowLotoModal] = useState(false);
  const [activeWO, setActiveWO] = useState<WorkOrder | null>(null);
  const [lotoProtocol, setLotoProtocol] = useState<MachineLotoProtocol | null>(null);
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({});
  const [padlockId, setPadlockId] = useState('PL-8894-LOTO');
  const [voltageReading, setVoltageReading] = useState('0.0');
  const [pressureReading, setPressureReading] = useState('0.0');
  const [techSignName, setTechSignName] = useState('Arun Kumar (Lead Tech)');
  const [arrivingOnSite, setArrivingOnSite] = useState(false);
  const [executingLoto, setExecutingLoto] = useState(false);
  const [completingRepair, setCompletingRepair] = useState(false);
  const [partScanned, setPartScanned] = useState(false);
  const [scanningPart, setScanningPart] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4500);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [techRes, woRes] = await Promise.all([
        api.getTechnicians(),
        api.getWorkOrders(),
      ]);
      if (techRes.success) setTechnicians(techRes.data);
      if (woRes.success) setWorkOrders(woRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Live Socket.IO listeners
    socket.on('workorder:created', () => fetchData());
    socket.on('workorder:arrived', () => fetchData());
    socket.on('workorder:loto', () => fetchData());
    socket.on('workorder:inspected', () => fetchData());
    socket.on('workorder:completed', () => fetchData());
    socket.on('machine:status_changed', () => fetchData());

    return () => {
      socket.off('workorder:created');
      socket.off('workorder:arrived');
      socket.off('workorder:loto');
      socket.off('workorder:inspected');
      socket.off('workorder:completed');
      socket.off('machine:status_changed');
    };
  }, []);

  const handleOpenPartsModal = (tech: any) => {
    setSelectedTech(tech);
    setShowPartsModal(true);
    checkPartATP('PART-SKF-6205');
  };

  const checkPartATP = async (partId: string) => {
    setRequestPartId(partId);
    try {
      const res = await api.checkATP(partId);
      if (res.success) {
        setAtpStatus(res.data);
      }
    } catch (err) {
      setAtpStatus(null);
    }
  };

  const handleSubmitPartRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingPart(true);
    setTimeout(() => {
      setSubmittingPart(false);
      setShowPartsModal(false);
      showToast(`✅ Parts requisition approved: ${qty}x ${requestPartId} reserved for ${targetMachine} (Bin: BAY-A-04).`);
    }, 600);
  };

  // Physical Inspection state
  const [symptoms, setSymptoms] = useState<string[]>(['Spindle raceway fluting / abnormal chatter']);
  const [techRootCause, setTechRootCause] = useState('Severe electrical fluting & micro-pitting on spindle inner raceway');
  const [inspectionPartId, setInspectionPartId] = useState('PART-SKF-6205');
  const [inspectionQty, setInspectionQty] = useState(1);
  const [submittingInspection, setSubmittingInspection] = useState(false);
  const [inspectionSubmitted, setInspectionSubmitted] = useState(false);

  const availableSymptoms = [
    'Spindle raceway fluting / abnormal chatter',
    'Radial / axial runout > 0.05 mm (dial indicator)',
    'Thermal grease discoloration & oxidation',
    'Micro-pitting on roller element tracks',
    'Excessive harmonic drive tooth backlash',
    'Hydraulic seal extrusion & fluid aeration',
    'Planetary gearbox teeth dry wear',
    'Infeed roller bearing seizure'
  ];

  const toggleSymptom = (sym: string) => {
    setSymptoms(prev => 
      prev.includes(sym) ? prev.filter(s => s !== sym) : [...prev, sym]
    );
  };

  const handleOpenLoto = async (wo: WorkOrder) => {
    setActiveWO(wo);
    setTechSignName(wo.technician_name || 'Arun Kumar (Lead Tech)');
    setInspectionSubmitted(wo.status === 'READY_FOR_REPAIR' || wo.status === 'PARTS_ALLOCATED' || wo.status === 'PENDING_PARTS' || wo.status === 'VERIFYING');
    setPartScanned(wo.status === 'PARTS_ALLOCATED' || wo.status === 'READY_FOR_REPAIR');
    setShowLotoModal(true);

    try {
      const protoRes = await api.getLotoProtocol(wo.id);
      if (protoRes.success && protoRes.data) {
        setLotoProtocol(protoRes.data);
        const initSteps: Record<string, boolean> = {};
        protoRes.data.isolationSteps.forEach((s: LotoProtocolStep) => {
          initSteps[s.id] = wo.loto_applied;
        });
        setCheckedSteps(initSteps);
      }
    } catch (err) {
      console.error(err);
    }
    checkPartATP('PART-SKF-6205');
  };

  const handleTechnicianArrive = async () => {
    if (!activeWO) return;
    setArrivingOnSite(true);
    try {
      const res = await api.markTechnicianArrived(activeWO.id, techSignName);
      if (res.success) {
        showToast(`📍 Technician ${techSignName} marked arrived on site for ${activeWO.machine_code || activeWO.machine_id}.`);
        await fetchData();
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setArrivingOnSite(false);
    }
  };

  const toggleProtocolStep = (stepId: string) => {
    setCheckedSteps(prev => ({
      ...prev,
      [stepId]: !prev[stepId]
    }));
  };

  const handleApplyLOTO = async () => {
    if (!activeWO) return;
    setExecutingLoto(true);
    try {
      const confirmedPoints = Object.keys(checkedSteps).filter(k => checkedSteps[k]);
      await api.applyLOTO(activeWO.id, techSignName, {
        padlockId,
        voltageReading: parseFloat(voltageReading) || 0.0,
        pressureReading: parseFloat(pressureReading) || 0.0,
        isolationPointsConfirmed: confirmedPoints
      });
      showToast(`🔒 OSHA 1910.147 LOTO verified (Padlock #${padlockId}). Zero Energy State established.`);
      await fetchData();
      setActiveWO(prev => prev ? { ...prev, loto_applied: true, status: 'IN_PROGRESS' } : null);
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setExecutingLoto(false);
    }
  };

  const handleSimulateScanPart = () => {
    setScanningPart(true);
    setTimeout(() => {
      setScanningPart(false);
      setPartScanned(true);
      showToast(`🔍 Barcode Verified: ${inspectionPartId} matches Work Order requisition from Bin BAY-A-04.`);
    }, 800);
  };

  const handleSubmitPhysicalInspection = async () => {
    if (!activeWO) return;
    setSubmittingInspection(true);
    try {
      const res = await api.submitInspection(activeWO.id, {
        technicianName: techSignName,
        symptomsObserved: symptoms,
        technicianRootCause: techRootCause,
        requiredPartId: inspectionPartId,
        quantity: inspectionQty
      });
      if (res.success) {
        showToast(`✅ Physical inspection recorded: Part reserved (ATP confirmed). Machine ready for replacement.`);
        setInspectionSubmitted(true);
        await fetchData();
        if (res.data) {
          setActiveWO(prev => prev ? { ...prev, status: res.data.status, notes: res.data.notes } : null);
        }
      } else {
        showToast(`Error: ${res.error || 'Failed to submit inspection'}`);
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setSubmittingInspection(false);
    }
  };

  const handleCompleteRepair = async () => {
    if (!activeWO) return;
    setCompletingRepair(true);
    try {
      if (activeWO.machine_id) {
        await api.healMachine(activeWO.machine_id);
      }
      await api.completeRepair(activeWO.id, techSignName);
      showToast(`✅ Repair completed on ${activeWO.id}. Machine entered autonomous IoT verification.`);
      await fetchData();
      setShowLotoModal(false);
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setCompletingRepair(false);
    }
  };

  const allStepsChecked = lotoProtocol
    ? lotoProtocol.isolationSteps.every(s => checkedSteps[s.id])
    : false;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-20 right-6 z-50 bg-[#2563EB] text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-blue-400/30 text-xs font-bold animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={16} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-[#FAF9F6] p-5 rounded-2xl border border-[#DDD9D0] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#1E293B] flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#2563EB]/10 border border-[#2563EB]/20 flex items-center justify-center text-[#2563EB]">
              <HardHat className="w-4 h-4" />
            </div>
            Field Technician Hub & OSHA 1910.147 Execution Center
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            Machine-specific Lockout/Tagout isolation protocols, digital padlock verification, ATP part scanner, and live twin synchronization.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-[#EAE7E0] text-[#1E293B] border border-[#DDD9D0] text-xs font-semibold transition-all"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh Queue
          </button>
          <button
            onClick={() => handleOpenPartsModal(technicians[0] || { name: 'Arun Kumar' })}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-all active:scale-95"
          >
            <Package size={13} /> Requisition Parts
          </button>
        </div>
      </div>

      {/* Active Work Orders Execution Banner */}
      <div className="bg-white rounded-2xl border border-[#DDD9D0] p-5 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-[#0F766E]" />
            <h3 className="font-bold text-sm text-[#1E293B]">Live Maintenance Dispatch Queue (OSHA 1910.147 Protocol)</h3>
          </div>
          <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-[#2563EB] border border-blue-200">
            {workOrders.filter(w => w.status !== 'COMPLETED').length} Active Dispatches
          </span>
        </div>

        {workOrders.length === 0 ? (
          <div className="text-center py-6 text-xs text-[#64748B]">
            No active work orders. All factory assets operating at nominal baseline.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {workOrders.slice(0, 6).map((wo) => {
              const isDone = wo.status === 'COMPLETED';
              const isLoto = wo.loto_applied;
              const isVerifying = wo.status === 'VERIFYING';

              return (
                <div
                  key={wo.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isDone
                      ? 'bg-slate-50/70 border-slate-200 opacity-70'
                      : isVerifying
                      ? 'bg-purple-50/60 border-purple-300 shadow-sm'
                      : isLoto
                      ? 'bg-emerald-50/50 border-emerald-300'
                      : 'bg-amber-50/50 border-amber-300'
                  }`}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-[#DDD9D0]/60">
                    <span className="font-mono font-bold text-xs text-[#1E293B]">{wo.id}</span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                      isDone
                        ? 'bg-slate-200 text-slate-700 border-slate-300'
                        : isVerifying
                        ? 'bg-purple-100 text-purple-800 border-purple-300 animate-pulse'
                        : isLoto
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        : 'bg-amber-100 text-amber-800 border-amber-200'
                    }`}>
                      {wo.status}
                    </span>
                  </div>

                  <div className="py-2 space-y-1.5 text-xs">
                    <div className="font-bold text-[#1E293B] truncate">{wo.notes || wo.machine_name || 'Corrective Maintenance Order'}</div>
                    <div className="text-[11px] text-[#64748B] flex items-center justify-between">
                      <span>Asset: <strong className="text-[#1E293B]">{wo.machine_code || wo.machine_id}</strong></span>
                      <span>Tech: <strong className="text-[#1E293B]">{wo.technician_name || 'Arun Kumar'}</strong></span>
                    </div>
                    <div className="text-[10px] font-semibold text-[#0F766E] flex items-center gap-1">
                      <Lock size={11} />
                      <span>{isLoto ? 'OSHA LOTO Locked & Verified' : '⚠️ LOTO Isolation Pending'}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#DDD9D0]/60 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-[#64748B]">Priority: <strong>{wo.priority || 'HIGH'}</strong></span>
                    {!isDone && (
                      <button
                        onClick={() => handleOpenLoto(wo)}
                        className="px-3 py-1 text-xs font-bold rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white shadow-sm transition-all flex items-center gap-1"
                      >
                        <ShieldAlert size={12} />
                        <span>{isLoto ? 'Workstation' : 'Execute LOTO'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Grid of Certified Technicians */}
      <div>
        <h3 className="text-sm font-bold text-[#1E293B] mb-3 flex items-center gap-2">
          <HardHat size={15} className="text-[#2563EB]" />
          Certified Reliability Engineers & Technicians
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {technicians.map((tech) => {
            const skillsList = typeof tech.skills === 'string' ? JSON.parse(tech.skills || '[]') : (tech.skills || []);
            const isAvailable = tech.status === 'AVAILABLE' || tech.status === 'ON_DUTY';

            return (
              <div
                key={tech.id}
                className="bg-[#FAF9F6] rounded-2xl p-5 border border-[#DDD9D0] shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-4"
              >
                <div>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#DDD9D0]">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-[#2563EB] flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0">
                        {tech.name.split(' ').map((n: string) => n[0]).join('')}
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-[#1E293B]">{tech.name}</h3>
                        <p className="text-xs text-[#0F766E] font-medium">{tech.role}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                      isAvailable ? 'bg-[#E8F6EF] text-[#22A06B] border-[#B4E3CF]' : 'bg-[#FEF7E6] text-[#D99A06] border-[#F8DF9E]'
                    }`}>
                      {tech.status}
                    </span>
                  </div>

                  {/* Info List */}
                  <div className="space-y-2 mt-3 text-xs">
                    <div className="flex items-center gap-2 text-[#334155]">
                      <MapPin size={13} className="text-[#64748B] flex-shrink-0" />
                      <span>{tech.assigned_area || 'Main Production Cell'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[#334155]">
                      <Clock size={13} className="text-[#64748B] flex-shrink-0" />
                      <span>{tech.shift || 'Morning Shift (06:00 - 14:00)'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[#334155]">
                      <Mail size={13} className="text-[#64748B] flex-shrink-0" />
                      <span className="font-mono text-[#64748B]">{tech.email}</span>
                    </div>
                  </div>

                  {/* Certifications & Skills */}
                  <div className="mt-4 pt-3 border-t border-[#DDD9D0]">
                    <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Award size={13} className="text-[#D99A06]" />
                      OSHA Qualifications & Certified Protocols
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {skillsList.map((sk: string, i: number) => (
                        <span
                          key={i}
                          className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-white text-[#1E293B] border border-[#DDD9D0] font-mono"
                        >
                          {sk.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Active Assignments Footer & Request Action */}
                <div className="pt-3 border-t border-[#DDD9D0] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#64748B]">Workload:</span>
                    <span className="font-mono font-bold text-[#1E293B] bg-white px-2 py-0.5 rounded border border-[#DDD9D0]">
                      {tech.active_work_orders || 0} Active
                    </span>
                  </div>
                  <button
                    onClick={() => handleOpenPartsModal(tech)}
                    className="text-[11px] font-bold text-[#2563EB] hover:underline flex items-center gap-1"
                  >
                    <Package size={12} /> Request Part
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive OSHA 1910.147 Field Technician Workstation Modal */}
      {showLotoModal && activeWO && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-4 px-6 bg-white border-b border-[#DDD9D0] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0F766E]/10 border border-[#0F766E]/20 flex items-center justify-center text-[#0F766E]">
                  <HardHat className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1E293B] flex items-center gap-2">
                    Field Technician Workstation
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-[#2563EB] font-mono">
                      {activeWO.id}
                    </span>
                  </h3>
                  <p className="text-[11px] text-[#64748B]">
                    Asset: <strong className="text-[#1E293B]">{activeWO.machine_code || activeWO.machine_id}</strong> ({lotoProtocol?.machineType || 'CNC'}) • Assigned: <strong className="text-[#1E293B]">{techSignName}</strong>
                  </p>
                </div>
              </div>
              <button onClick={() => setShowLotoModal(false)} className="p-1.5 rounded-lg text-[#64748B] hover:bg-[#EAE7E0] transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Arrival & On-Site Banner */}
            <div className="bg-slate-100 px-6 py-2.5 border-b border-[#DDD9D0] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-[#334155]">
                <MapPin size={13} className="text-[#2563EB]" />
                <span>Station: <strong>{lotoProtocol?.lockoutBoxLocation || 'Machining Cell Lockout Station'}</strong></span>
              </div>
              <button
                type="button"
                onClick={handleTechnicianArrive}
                disabled={arrivingOnSite}
                className="px-3 py-1 bg-white hover:bg-slate-50 text-[#1E293B] border border-[#DDD9D0] rounded-lg text-[11px] font-bold shadow-xs flex items-center gap-1.5 transition-all"
              >
                <UserCheck size={12} className="text-[#22A06B]" />
                <span>{arrivingOnSite ? 'Recording Arrival...' : 'Mark Arrived on Site'}</span>
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              
              {/* Stepper Header */}
              <div className="grid grid-cols-3 gap-2">
                <div className={`p-2.5 rounded-xl border text-center transition-all ${
                  activeWO.loto_applied ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-blue-50 border-blue-300 text-blue-800'
                }`}>
                  <div className="text-[10px] uppercase font-bold">Phase 1</div>
                  <div className="text-xs font-extrabold flex items-center justify-center gap-1">
                    {activeWO.loto_applied ? <CheckCircle2 size={12} className="text-emerald-600" /> : <Lock size={12} />}
                    OSHA LOTO
                  </div>
                </div>

                <div className={`p-2.5 rounded-xl border text-center transition-all ${
                  !activeWO.loto_applied 
                    ? 'bg-slate-50 border-slate-200 text-slate-400 opacity-60' 
                    : inspectionSubmitted 
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800' 
                    : 'bg-amber-50 border-amber-300 text-amber-800'
                }`}>
                  <div className="text-[10px] uppercase font-bold">Phase 2</div>
                  <div className="text-xs font-extrabold flex items-center justify-center gap-1">
                    {inspectionSubmitted ? <CheckCircle2 size={12} className="text-emerald-600" /> : <Eye size={12} />}
                    Physical Inspection & ATP
                  </div>
                </div>

                <div className={`p-2.5 rounded-xl border text-center transition-all ${
                  !inspectionSubmitted 
                    ? 'bg-slate-50 border-slate-200 text-slate-400 opacity-60' 
                    : 'bg-indigo-50 border-indigo-300 text-indigo-800'
                }`}>
                  <div className="text-[10px] uppercase font-bold">Phase 3</div>
                  <div className="text-xs font-extrabold flex items-center justify-center gap-1">
                    <ShieldCheck size={12} />
                    Repair & Run-In
                  </div>
                </div>
              </div>

              {/* STAGE 1: DYNAMIC MACHINE OSHA 1910.147 LOTO */}
              <div className="bg-white p-4 rounded-xl border border-[#DDD9D0] space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-[#DDD9D0]">
                  <span className="text-xs font-bold text-[#1E293B] flex items-center gap-1.5">
                    <Lock size={14} className="text-[#0F766E]" />
                    1. Machine-Specific Energy Isolation Checklist ({lotoProtocol?.oshaStandard || 'OSHA 1910.147'})
                  </span>
                  {activeWO.loto_applied && (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                      <Check size={11} /> Lockout Active
                    </span>
                  )}
                </div>

                {/* PPE Banner */}
                {lotoProtocol?.requiredPpe && (
                  <div className="p-2.5 bg-amber-50/60 border border-amber-200 rounded-lg text-[11px] text-amber-900 flex items-center gap-2 flex-wrap">
                    <span className="font-bold flex items-center gap-1 text-amber-800">
                      <AlertOctagon size={12} /> Mandatory PPE:
                    </span>
                    {lotoProtocol.requiredPpe.map((ppe, i) => (
                      <span key={i} className="px-2 py-0.5 bg-white rounded border border-amber-200 font-medium">
                        {ppe}
                      </span>
                    ))}
                  </div>
                )}

                {!activeWO.loto_applied ? (
                  <div className="space-y-3">
                    {/* Dynamic Isolation Steps */}
                    <div className="space-y-2">
                      {lotoProtocol?.isolationSteps.map((step) => {
                        const isChecked = !!checkedSteps[step.id];
                        return (
                          <div
                            key={step.id}
                            onClick={() => toggleProtocolStep(step.id)}
                            className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                              isChecked
                                ? 'bg-emerald-50/70 border-emerald-400'
                                : 'bg-[#FAF9F6] border-[#DDD9D0] hover:border-slate-400'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}} // Handled by parent div onClick
                              className="mt-1 rounded text-[#0F766E] pointer-events-none"
                            />
                            <div className="flex-1 space-y-0.5 text-xs">
                              <div className="flex items-center justify-between">
                                <strong className="text-[#1E293B]">{step.title}</strong>
                                <span className="text-[9px] font-mono font-bold px-2 py-0.2 rounded bg-slate-200 text-[#1E293B]">
                                  {step.category}
                                </span>
                              </div>
                              <p className="text-[11px] text-[#64748B]">{step.procedure}</p>
                              <div className="text-[10px] font-semibold text-[#0F766E] pt-0.5">
                                Target: {step.targetZeroState}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Zero Energy Measurements & Padlock Serial */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                      <div>
                        <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Lock size={11} /> Padlock Serial Number
                        </label>
                        <input
                          type="text"
                          value={padlockId}
                          onChange={(e) => setPadlockId(e.target.value)}
                          className="w-full px-3 py-1.5 bg-[#FAF9F6] border border-[#DDD9D0] rounded-xl text-xs font-mono font-bold text-[#1E293B]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Zap size={11} className="text-amber-500" /> Multi-meter Voltage (VAC)
                        </label>
                        <input
                          type="text"
                          value={voltageReading}
                          onChange={(e) => setVoltageReading(e.target.value)}
                          className="w-full px-3 py-1.5 bg-[#FAF9F6] border border-[#DDD9D0] rounded-xl text-xs font-mono font-bold text-[#1E293B]"
                          placeholder="0.0"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Gauge size={11} className="text-blue-500" /> Manifold Pressure (bar)
                        </label>
                        <input
                          type="text"
                          value={pressureReading}
                          onChange={(e) => setPressureReading(e.target.value)}
                          className="w-full px-3 py-1.5 bg-[#FAF9F6] border border-[#DDD9D0] rounded-xl text-xs font-mono font-bold text-[#1E293B]"
                          placeholder="0.0"
                        />
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between">
                      <span className="text-[11px] text-[#64748B]">
                        Signoff Technician: <strong>{techSignName}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={handleApplyLOTO}
                        disabled={!allStepsChecked || executingLoto}
                        className="px-5 py-2 bg-[#0F766E] hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Lock size={13} />
                        <span>{executingLoto ? 'Locking Out...' : 'Apply & Verify OSHA LOTO'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[#64748B]">Padlock & Tag ID:</span>
                      <strong className="font-mono text-[#1E293B]">{padlockId}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#64748B]">Authorized Lead Inspector:</span>
                      <strong className="text-[#1E293B]">{techSignName}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#64748B]">Zero-Energy Measurements:</span>
                      <span className="text-emerald-700 font-bold font-mono">0.0 VAC / 0.0 bar (Confirmed)</span>
                    </div>
                  </div>
                )}
              </div>

              {/* STAGE 2: PHYSICAL ON-SITE INSPECTION & PART SCANNER */}
              {activeWO.loto_applied && (
                <div className="bg-white p-4 rounded-xl border border-[#DDD9D0] space-y-3.5 animate-in fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-[#DDD9D0]">
                    <span className="text-xs font-bold text-[#1E293B] flex items-center gap-1.5">
                      <Eye size={14} className="text-[#2563EB]" />
                      2. Technician Physical Inspection & Part Verification
                    </span>
                    {inspectionSubmitted && (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                        ✓ Diagnosed & Requisitioned
                      </span>
                    )}
                  </div>

                  {!inspectionSubmitted ? (
                    <div className="space-y-3">
                      {/* Symptoms checklist */}
                      <div>
                        <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">
                          Physical Symptoms Observed on Machine
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                          {availableSymptoms.map((sym, idx) => {
                            const isSelected = symptoms.includes(sym);
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => toggleSymptom(sym)}
                                className={`p-2 rounded-lg border text-left text-xs transition-all flex items-center justify-between ${
                                  isSelected 
                                    ? 'bg-blue-50 border-blue-400 text-[#1E293B] font-bold' 
                                    : 'bg-[#FAF9F6] border-[#DDD9D0] text-[#64748B] hover:border-slate-400'
                                }`}
                              >
                                <span className="truncate pr-1">{sym}</span>
                                {isSelected ? <CheckCircle2 size={13} className="text-[#2563EB] flex-shrink-0" /> : <Plus size={13} className="text-slate-400 flex-shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Confirmed Root Cause text */}
                      <div>
                        <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1">
                          Confirmed Physical Root Cause (Technician Finding)
                        </label>
                        <input
                          type="text"
                          value={techRootCause}
                          onChange={(e) => setTechRootCause(e.target.value)}
                          className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#DDD9D0] rounded-xl text-xs text-[#1E293B] font-semibold"
                          placeholder="e.g. Spindle raceway EDM fluting due to bearing current leakage"
                        />
                      </div>

                      {/* Spare Part Selection & Live ATP */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-2">
                          <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1">
                            Required Replacement Part
                          </label>
                          <select
                            value={inspectionPartId}
                            onChange={(e) => {
                              setInspectionPartId(e.target.value);
                              checkPartATP(e.target.value);
                            }}
                            className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#DDD9D0] rounded-xl text-xs text-[#1E293B] font-mono font-semibold"
                          >
                            <option value="PART-SKF-6205">SKF-6205-2RSH — Deep Groove Ball Bearing</option>
                            <option value="PART-FAG-7210">FAG-7210-B-TVP — Angular Contact Bearing</option>
                            <option value="PART-TIMKEN-TAP-01">TIMKEN-32008X — Tapered Roller Bearing</option>
                            <option value="PART-HYD-SEAL-01">PARKER-V884-75 — Fluorocarbon Seal Kit</option>
                            <option value="PART-FANUC-SV-03">FANUC-A06B-0223 — AC Servo Drive Motor</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-[#64748B] uppercase tracking-wider mb-1">
                            Quantity
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={inspectionQty}
                            onChange={(e) => setInspectionQty(parseInt(e.target.value) || 1)}
                            className="w-full px-3 py-2 bg-[#FAF9F6] border border-[#DDD9D0] rounded-xl text-xs text-[#1E293B] font-bold"
                          />
                        </div>
                      </div>

                      {/* Live ATP Status & Barcode Scan Simulator */}
                      <div className="bg-[#FAF9F6] p-3 rounded-xl border border-[#DDD9D0] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div>
                          <div>
                            <span className="text-[#64748B]">Warehouse Stock (ATP): </span>
                            <strong className="text-[#22A06B] font-mono">{atpStatus?.atp ?? 6} Available</strong>
                          </div>
                          <div className="text-[11px] text-[#64748B]">
                            Bin Location: <strong className="text-[#1E293B] font-mono">{atpStatus?.binLocation || 'BAY-A-04'}</strong>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleSimulateScanPart}
                          disabled={scanningPart || partScanned}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 ${
                            partScanned
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : 'bg-white hover:bg-slate-50 text-[#1E293B] border-[#DDD9D0]'
                          }`}
                        >
                          {partScanned ? <CheckCircle2 size={13} className="text-emerald-600" /> : <QrCode size={13} />}
                          <span>{scanningPart ? 'Scanning Barcode...' : partScanned ? 'Part Scanned & Verified' : 'Scan Bin Barcode'}</span>
                        </button>
                      </div>

                      <div className="pt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={handleSubmitPhysicalInspection}
                          disabled={submittingInspection || symptoms.length === 0}
                          className="px-5 py-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <Send size={13} />
                          <span>{submittingInspection ? 'Submitting Inspection...' : 'Submit Physical Inspection & Reserve Part'}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[#64748B]">Observed Symptoms:</span>
                        <span className="text-[#1E293B] font-semibold">{symptoms.join(', ')}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#64748B]">Diagnosed Root Cause:</span>
                        <span className="text-[#1E293B] font-bold">{techRootCause}</span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-emerald-200">
                        <span className="text-[#64748B]">Allocated Part:</span>
                        <strong className="font-mono text-emerald-800">{inspectionQty}x {inspectionPartId} (Reserved via ATP)</strong>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STAGE 3: REPAIR COMPLETION & IOT VERIFICATION */}
              {activeWO.loto_applied && inspectionSubmitted && (
                <div className="bg-white p-4 rounded-xl border border-indigo-200 bg-indigo-50/30 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-indigo-100">
                    <span className="text-xs font-bold text-[#1E293B] flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-[#22A06B]" />
                      3. Component Replacement & Autonomous IoT Edge Verification
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                      Final Step
                    </span>
                  </div>

                  <p className="text-[11px] text-[#64748B] leading-relaxed">
                    Physical component replacement has been carried out by certified technician <strong>{techSignName}</strong>. 
                    Triggering verification will remove the LOTO tag, clear the simulated anomaly, and run a 10-second IoT telemetry baseline check before returning the asset to <strong>RUNNING</strong>.
                  </p>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleCompleteRepair}
                      disabled={completingRepair}
                      className="px-6 py-2.5 bg-[#22A06B] hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      <PlayCircle size={14} />
                      <span>{completingRepair ? 'Verifying Baseline Sensors...' : 'Complete Physical Repair & Trigger Verification'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-white border-t border-[#DDD9D0] flex items-center justify-between">
              <span className="text-[11px] text-[#64748B]">
                Protocol: OSHA 1910.147 Zero Energy & ATP Deterministic Control
              </span>
              <button
                type="button"
                onClick={() => setShowLotoModal(false)}
                className="px-4 py-2 bg-[#FAF9F6] hover:bg-[#EAE7E0] border border-[#DDD9D0] text-[#1E293B] rounded-xl text-xs font-bold transition-all"
              >
                Close Workstation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Field Parts Requisition Modal */}
      {showPartsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[#DDD9D0]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#2563EB]/10 flex items-center justify-center text-[#2563EB]">
                  <Boxes className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1E293B]">Technician Spare Part Requisition</h3>
                  <p className="text-[11px] text-[#64748B]">Requesting technician: {selectedTech?.name || 'Arun Kumar'}</p>
                </div>
              </div>
              <button onClick={() => setShowPartsModal(false)} className="p-1 rounded-lg text-[#64748B] hover:bg-[#EAE7E0]">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitPartRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1E293B] mb-1">Target Asset</label>
                <select
                  value={targetMachine}
                  onChange={(e) => setTargetMachine(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#DDD9D0] rounded-xl text-xs text-[#1E293B] font-medium"
                >
                  <option value="CNC-01">CNC-01 (5-Axis Milling Center)</option>
                  <option value="CNC-02">CNC-02 (Heavy Duty Lathe)</option>
                  <option value="CNC-03">CNC-03 (High-Speed Machining)</option>
                  <option value="MIXER-01">MIXER-01 (Agitator Lubricant Mixer)</option>
                  <option value="PUMP-01">PUMP-01 (Hydraulic Coolant Pump)</option>
                  <option value="ROBOT-01">ROBOT-01 (6-Axis Articulated Robot)</option>
                  <option value="PRESS-01">PRESS-01 (Stamping & Forming Press)</option>
                  <option value="PACKAGING-01">PACKAGING-01 (Palletizer)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1E293B] mb-1">Required Spare Part</label>
                <select
                  value={requestPartId}
                  onChange={(e) => checkPartATP(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#DDD9D0] rounded-xl text-xs text-[#1E293B] font-medium font-mono"
                >
                  <option value="PART-SKF-6205">SKF-6205-2RSH — Spindle Angular Bearing</option>
                  <option value="PART-FAG-7210">FAG-7210-B-TVP — Support Bearing</option>
                  <option value="PART-TIMKEN-TAP-01">TIMKEN-32008X — Gearbox Thrust Bearing</option>
                  <option value="PART-HYD-SEAL-01">PARKER-V884-75 — Fluorocarbon Seal Kit</option>
                  <option value="PART-FANUC-SV-03">FANUC-A06B-0223 — AC Servo Drive Motor</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1E293B] mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={qty}
                    onChange={(e) => setQty(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-white border border-[#DDD9D0] rounded-xl text-xs text-[#1E293B] font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1E293B] mb-1">Priority</label>
                  <select className="w-full px-3 py-2 bg-white border border-[#DDD9D0] rounded-xl text-xs text-[#1E293B] font-medium">
                    <option>HIGH — Machine Down</option>
                    <option>MEDIUM — Scheduled PM</option>
                    <option>LOW — Buffer Restock</option>
                  </select>
                </div>
              </div>

              {/* ATP Live Check Card */}
              <div className="bg-white p-3.5 rounded-xl border border-[#DDD9D0] space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#64748B]">Available-To-Promise (ATP):</span>
                  <span className="font-mono font-bold text-[#22A06B]">
                    {atpStatus?.atp ?? 6} Units In Stock
                  </span>
                </div>
                <div className="text-[11px] text-[#64748B] flex items-center justify-between pt-1 border-t border-[#DDD9D0]">
                  <span>Bin Location: <strong>BAY-A-04</strong></span>
                  <span>Lead Time: <strong>Immediate (Floor Stock)</strong></span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPartsModal(false)}
                  className="px-4 py-2 bg-white hover:bg-[#EAE7E0] border border-[#DDD9D0] text-[#1E293B] rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPart}
                  className="px-5 py-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send size={12} />
                  <span>{submittingPart ? 'Submitting...' : 'Confirm Requisition'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
