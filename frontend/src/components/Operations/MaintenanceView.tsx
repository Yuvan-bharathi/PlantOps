import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Wrench, Calendar, Clock, AlertTriangle, CheckCircle2, 
  Plus, Filter, ShieldCheck, User, ArrowRight, RefreshCw, 
  BarChart2, FileText, ChevronRight, Play, Bot, UserCheck,
  Check, X, Sparkles, Sliders, Layers, Eye, ShieldAlert,
  Search, CheckSquare, Square, RotateCcw, AlertCircle, Edit3,
  HardHat, Radio, Smartphone, Activity, CheckCheck
} from 'lucide-react';
import { WorkOrder } from '../../types';
import { ToastMessage } from '../ToastNotification';
import { api, socket } from '../../services/api';
import { UserProfile } from './LoginPage';
import { CustomSelect } from '../common/CustomSelect';

export interface TechnicianCluster {
  id: string;
  name: string;
  role: string;
  assignedArea: string;
  skills: string[];
  assignedMachines: { code: string; name: string }[];
}

export interface PMScheduleItem {
  id: string;
  machine_id?: string;
  machineCode: string;
  machineName: string;
  area: string;
  intervalDays: number;
  frequency: string;
  task: string;
  sopCode: string;
  nextDue: string;
  lastPerformed?: string;
  assignedTechnicianId?: string;
  assignedTechnicianName?: string;
  status: 'SCHEDULED' | 'DISPATCHED' | 'INSPECTING' | 'COMPLETED' | 'OVERDUE';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  checklist: Array<{ id: string; label: string; checked: boolean }>;
  workOrderId?: string;
}

interface MaintenanceViewProps {
  workOrders: WorkOrder[];
  currentUser?: UserProfile;
  onRefresh: () => void;
  onSelectMachine: (code: string) => void;
  onAddToast?: (toast: Omit<ToastMessage, 'id' | 'timestamp'> & { timestamp?: string }) => void;
}

export const MaintenanceView: React.FC<MaintenanceViewProps> = ({
  workOrders,
  currentUser,
  onRefresh,
  onSelectMachine,
  onAddToast
}) => {
  const isTechnician = currentUser?.roleKey === 'TECHNICIAN';
  const [selectedTechId, setSelectedTechId] = useState<string>('TECH-01');

  // Filter & Data States
  const [filterType, setFilterType] = useState<'ALL' | 'PREVENTATIVE' | 'INSPECTING' | 'SCHEDULED' | 'COMPLETED' | 'CLUSTERS'>('ALL');
  const [schedules, setSchedules] = useState<PMScheduleItem[]>([]);
  const [clusters, setClusters] = useState<TechnicianCluster[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals & Active Actions
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [inspectingItem, setInspectingItem] = useState<PMScheduleItem | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingClusterTech, setEditingClusterTech] = useState<TechnicianCluster | null>(null);
  const [selectedClusterMachines, setSelectedClusterMachines] = useState<string[]>([]);

  // New Routine Form State
  const [newMachineCode, setNewMachineCode] = useState('CNC-05');
  const [newIntervalDays, setNewIntervalDays] = useState(90);
  const [newTaskName, setNewTaskName] = useState('Spindle Bearings & Coolant Pressure PM Routine');
  const [newPriority, setNewPriority] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('HIGH');

  // Load TiDB Cloud Data
  const fetchCloudData = async () => {
    try {
      setLoading(true);
      const [pmRes, clusRes] = await Promise.all([
        api.getPMSchedules(),
        api.getTechnicianClusters()
      ]);

      if (pmRes?.success && pmRes.data) {
        setSchedules(pmRes.data);
      }
      if (clusRes?.success && clusRes.data) {
        setClusters(clusRes.data);
      }
    } catch (e) {
      console.warn('Error fetching TiDB PM data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCloudData();

    // Socket listeners for real-time live sync across Supervisor & Technician portals
    socket.on('pm:created', fetchCloudData);
    socket.on('pm:dispatched', fetchCloudData);
    socket.on('pm:completed', fetchCloudData);
    socket.on('clusters:updated', fetchCloudData);

    return () => {
      socket.off('pm:created', fetchCloudData);
      socket.off('pm:dispatched', fetchCloudData);
      socket.off('pm:completed', fetchCloudData);
      socket.off('clusters:updated', fetchCloudData);
    };
  }, []);

  // Helper: Format due date with exact scheduled inspection time
  const formatDueDateTime = (dueDateStr: string, seedId: string = '') => {
    if (!dueDateStr) return '02 Oct 2026, 08:30 AM';
    if (dueDateStr.includes(':') && (dueDateStr.includes('AM') || dueDateStr.includes('PM'))) {
      return dueDateStr;
    }
    const timeSlots: Record<string, string> = {
      'PM-2026-095': '08:30 AM',
      'PM-2026-096': '09:15 AM',
      'PM-2026-097': '10:00 AM',
      'PM-2026-093': '07:45 AM',
      'PM-2026-092': '11:30 AM',
      'PM-2026-094': '02:15 PM'
    };
    const slot = timeSlots[seedId] || '08:30 AM';
    return `${dueDateStr}, ${slot}`;
  };

  // Helper: Find assigned technician for machine from live TiDB clusters
  const findClusterTechnicianForMachine = (machineCode: string): TechnicianCluster => {
    const found = clusters.find(t => 
      t.assignedMachines?.some(m => m.code === machineCode)
    );
    return found || clusters[0] || {
      id: 'TECH-01',
      name: 'Arun Kumar',
      role: 'Lead Vibration Specialist',
      assignedArea: 'Machining Cell',
      skills: ['CNC_MILLING'],
      assignedMachines: [{ code: 'CNC-01', name: 'Milling Center' }]
    };
  };

  // ── Dispatch Handler: Autonomous AI Agent Match & Save to TiDB ──
  const handleDispatchPM = async (pm: PMScheduleItem) => {
    setDispatchingId(pm.id);

    const assignedTech = findClusterTechnicianForMachine(pm.machineCode);

    // 1. Toast: AI Orchestrator Agent Triggered
    onAddToast?.({
      type: 'AI_AGENT',
      title: '🤖 AI Maintenance Agent Triggered',
      subtitle: `Evaluating PM Routine for ${pm.machineCode}`,
      message: `Analyzing certified skills for ${pm.frequency} routine. Paired with certified cluster specialist ${assignedTech.name}.`,
      metaBadge: 'PM AUTO-MATCH',
      metaDetails: [
        { label: 'Routine', value: `${pm.intervalDays} Days` },
        { label: 'SOP', value: pm.sopCode },
        { label: 'Target Cell', value: pm.area }
      ]
    });

    try {
      // 2. Call TiDB Cloud Dispatch Endpoint
      const res = await api.dispatchPMSchedule(pm.id);
      if (res?.success) {
        // Update local state immediately
        setSchedules(prev => prev.map(item => 
          item.id === pm.id 
            ? { ...item, status: 'INSPECTING', assignedTechnicianId: assignedTech.id, assignedTechnicianName: assignedTech.name, workOrderId: res.data?.workOrderId } 
            : item
        ));

        // Toast: Technician Dispatched
        onAddToast?.({
          type: 'DISPATCH',
          title: '👷 PM Specialist Assigned & Dispatched',
          subtitle: `${assignedTech.name} (${assignedTech.role})`,
          message: `Work Order ${res.data?.workOrderId || 'WO-PM'} created in TiDB Cloud. Specialist assigned to inspect ${pm.machineCode}.`,
          metaBadge: res.data?.workOrderId || 'WORK ORDER',
          metaDetails: [
            { label: 'Technician', value: assignedTech.name },
            { label: 'Assigned Cluster', value: assignedTech.assignedMachines.map(m => m.code).join(', ') },
            { label: 'Status', value: 'INSPECTION ACTIVE' }
          ]
        });
      }
    } catch (e: any) {
      onAddToast?.({ type: 'INFO', title: 'Dispatch Notice', message: e.message });
    } finally {
      setDispatchingId(null);
    }
  };

  // ── Toggle Checklist Item in Inspection ──
  const handleToggleChecklist = (checkId: string) => {
    if (!inspectingItem) return;
    const updatedChecklist = inspectingItem.checklist.map(c => 
      c.id === checkId ? { ...c, checked: !c.checked } : c
    );
    setInspectingItem({ ...inspectingItem, checklist: updatedChecklist });
  };

  // ── Complete PM Inspection and Save in TiDB Cloud ──
  const handleCompleteInspection = async (pm: PMScheduleItem) => {
    try {
      const res = await api.completePMSchedule(pm.id, pm.checklist);
      if (res?.success) {
        setSchedules(prev => prev.map(item => 
          item.id === pm.id 
            ? { ...item, status: 'COMPLETED', lastPerformed: res.data?.lastPerformed, nextDue: res.data?.nextDue } 
            : item
        ));

        setInspectingItem(null);

        onAddToast?.({
          type: 'DOWNTIME_RESOLVED',
          title: '✅ PM Routine Verified in TiDB Cloud',
          subtitle: `${pm.machineCode} — ${pm.task}`,
          message: `Inspection certified by ${pm.assignedTechnicianName || 'Specialist'}. Next recurring interval saved to TiDB for ${res.data?.nextDue} (+${pm.intervalDays} days).`,
          metaBadge: 'TiDB SYNCED',
          metaDetails: [
            { label: 'Status', value: 'VERIFIED' },
            { label: 'Next Due', value: res.data?.nextDue || 'Updated' },
            { label: 'Interval', value: `${pm.intervalDays} Days` }
          ]
        });
      }
    } catch (e: any) {
      onAddToast?.({ type: 'INFO', title: 'Error Completing PM', message: e.message });
    }
  };

  // ── Supervisor: Schedule Custom Routine in TiDB Cloud ──
  const handleCreateNewRoutine = async (e: React.FormEvent) => {
    e.preventDefault();
    const assignedTech = findClusterTechnicianForMachine(newMachineCode);

    try {
      const payload = {
        machineCode: newMachineCode,
        machineName: `${newMachineCode} Production Unit`,
        area: assignedTech.assignedArea,
        intervalDays: newIntervalDays,
        task: newTaskName,
        sopCode: `SOP-${newMachineCode.slice(0, 3)}-PM-01`,
        priority: newPriority,
        checklist: [
          { id: '1', label: `Inspect ${newMachineCode} mechanical clearances & bearings`, checked: false },
          { id: '2', label: 'Verify sensor calibration baselines and FFT telemetry feed', checked: false },
          { id: '3', label: 'Inspect electrical grounding & terminal wiring', checked: false },
          { id: '4', label: 'Verify emergency stops & OSHA safety interlocks', checked: false }
        ]
      };

      const res = await api.createPMSchedule(payload);
      if (res?.success) {
        setShowScheduleModal(false);
        fetchCloudData();

        onAddToast?.({
          type: 'INFO',
          title: '📅 New Recurring PM Routine Registered',
          subtitle: `${newMachineCode} (${newIntervalDays}-Day Cycle)`,
          message: `Saved directly to TiDB Cloud. Paired with certified specialist: ${assignedTech.name}.`
        });
      }
    } catch (e: any) {
      console.warn('Error creating routine:', e);
    }
  };

  // ── Supervisor: Reassign Cluster in TiDB Cloud ──
  const handleSaveClusterReassignment = async () => {
    if (!editingClusterTech) return;
    try {
      const res = await api.updateTechnicianClusters(editingClusterTech.id, selectedClusterMachines);
      if (res?.success) {
        setEditingClusterTech(null);
        fetchCloudData();

        onAddToast?.({
          type: 'INFO',
          title: '⚙️ Machine Cluster Mappings Updated in TiDB',
          subtitle: `Specialist: ${editingClusterTech.name}`,
          message: `Supervisor assigned ${selectedClusterMachines.length} machines (${selectedClusterMachines.join(', ')}) to ${editingClusterTech.name}.`
        });
      }
    } catch (e: any) {
      console.warn('Error updating cluster:', e);
    }
  };

  // Active technician object for Technician Portal
  const activeTech = clusters.find(c => c.id === selectedTechId) || clusters[0];
  const activeTechMachineCodes = activeTech?.assignedMachines?.map(m => m.code) || [];
  const technicianSchedules = schedules.filter(s => 
    activeTechMachineCodes.includes(s.machineCode) || s.assignedTechnicianId === activeTech?.id
  );

  // Filter items for Supervisor view
  const filteredSchedules = schedules.filter(item => {
    if (filterType === 'ALL') return true;
    if (filterType === 'PREVENTATIVE') return item.intervalDays >= 30;
    if (filterType === 'INSPECTING') return item.status === 'INSPECTING' || item.status === 'DISPATCHED';
    if (filterType === 'SCHEDULED') return item.status === 'SCHEDULED';
    if (filterType === 'COMPLETED') return item.status === 'COMPLETED';
    return true;
  });

  return (
    <div className="space-y-6 w-full">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. TECHNICIAN PORTAL VIEW ("My Assigned Machines & PM Tasks") */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isTechnician && activeTech && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Technician Profile & Active Cluster Header */}
          <div className="bg-[#FAF9F6] p-5 rounded-2xl border border-[#DDD9D0] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#2563EB] text-white flex items-center justify-center font-bold text-base shadow-sm">
                {activeTech.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-[#1E293B]">{activeTech.name}</h3>
                  <span className="text-[10px] font-mono bg-blue-100 text-[#2563EB] font-bold px-2 py-0.5 rounded">
                    {activeTech.id}
                  </span>
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                    ON-DUTY
                  </span>
                </div>
                <p className="text-xs text-[#64748B] mt-0.5">{activeTech.role} &bull; <strong className="text-[#1E293B]">{activeTech.assignedArea}</strong></p>
              </div>
            </div>

            {/* Change Technician Dropdown (For pairing inspection) */}
            <div className="flex items-center gap-2">
              <CustomSelect
                prefix="Switch Active Technician:"
                value={selectedTechId}
                onChange={(val) => setSelectedTechId(val)}
                options={clusters.map(t => ({
                  value: t.id,
                  label: `${t.name} (${t.assignedArea})`
                }))}
                size="sm"
              />
            </div>
          </div>

          {/* Dedicated Machine Cluster Cards */}
          <div className="bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-[#1E293B] uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#2563EB]" />
                My Assigned Machine Cluster ({activeTech.assignedMachines?.length || 0} Assets):
              </h4>
              <span className="text-[11px] text-[#64748B]">Supervisor Mapped in TiDB Cloud</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {activeTech.assignedMachines?.map(m => (
                <div 
                  key={m.code}
                  className="bg-white p-3.5 rounded-xl border border-[#DDD9D0] hover:border-[#2563EB] transition-all flex items-center justify-between gap-2 shadow-xs"
                >
                  <div>
                    <div className="text-xs font-bold text-[#1E293B] flex items-center gap-1.5">
                      <span className="text-[#2563EB] font-mono">{m.code}</span>
                      <span>&bull;</span>
                      <span className="truncate max-w-[130px]">{m.name}</span>
                    </div>
                    <div className="text-[10px] text-[#22A06B] font-semibold mt-0.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Assigned to My Shift
                    </div>
                  </div>
                  <button
                    onClick={() => onSelectMachine(m.code)}
                    className="p-1.5 bg-[#FAF9F6] hover:bg-blue-50 text-[#2563EB] rounded-lg border border-[#DDD9D0] text-xs font-bold transition-colors"
                    title="View in 3D Factory"
                  >
                    3D View
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Technician's Due PM Routines & Inspection Queue */}
          <div className="bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-[#1E293B] flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-[#2563EB]" />
                My Assigned PM Inspection Tasks ({technicianSchedules.length} Routines)
              </h4>
              <span className="text-xs text-[#64748B]">Perform digital on-site checks & certify maintenance</span>
            </div>

            {technicianSchedules.length === 0 ? (
              <div className="bg-white p-6 rounded-xl border border-dashed border-[#DDD9D0] text-center text-xs text-[#64748B]">
                No pending PM routines currently due for this technician's machine cluster.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {technicianSchedules.map(pm => (
                  <div
                    key={pm.id}
                    className={`bg-white p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 shadow-xs ${
                      pm.status === 'INSPECTING'
                        ? 'border-[#2563EB] ring-2 ring-[#2563EB]/10 bg-blue-50/10'
                        : pm.status === 'COMPLETED'
                          ? 'border-emerald-200 bg-emerald-50/10'
                          : 'border-[#DDD9D0]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-[#1E293B]">{pm.id}</span>
                          <span className="text-[10px] font-bold bg-[#EAE7E0] text-[#2563EB] px-2 py-0.5 rounded">
                            {pm.machineCode}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-[#2563EB]">
                            {pm.intervalDays}d Routine
                          </span>
                        </div>

                        {pm.status === 'INSPECTING' ? (
                          <span className="text-[10px] font-bold bg-blue-100 text-[#2563EB] px-2 py-0.5 rounded-full animate-pulse">
                            ACTIVE INSPECTION
                          </span>
                        ) : pm.status === 'COMPLETED' ? (
                          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded flex items-center gap-1">
                            <CheckCircle2 size={11} /> VERIFIED
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded">
                            DUE SOON
                          </span>
                        )}
                      </div>

                      <div className="text-xs font-bold text-[#1E293B] mt-1">{pm.task}</div>
                      <div className="text-[11px] text-[#64748B] mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span>SOP: <span className="font-mono text-[#2563EB]">{pm.sopCode}</span></span>
                        <span>&bull;</span>
                        <span className="flex items-center gap-1">
                          <Clock size={11} className="text-[#64748B]" />
                          Due: <strong className="text-[#1E293B] font-mono">{formatDueDateTime(pm.nextDue, pm.id)}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#DDD9D0] flex items-center justify-between text-xs">
                      <span className="text-[11px] text-[#64748B]">
                        Last Performed: {pm.lastPerformed || 'Initial Cycle'}
                      </span>

                      <button
                        onClick={() => setInspectingItem(pm)}
                        className="text-[11px] font-bold px-3 py-1.5 bg-[#2563EB] hover:bg-blue-700 text-white rounded-lg transition-all shadow-xs flex items-center gap-1.5"
                      >
                        <CheckSquare size={13} />
                        <span>{pm.status === 'COMPLETED' ? 'View Checklist' : 'Perform Inspection'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. SUPERVISOR MASTER VIEW (Master Planning & Cluster Mapping) */}
      {/* ───────────────────────────────────────────────────────────── */}
      {!isTechnician && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header */}
          <div className="bg-[#FAF9F6] p-5 rounded-2xl border border-[#DDD9D0] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/20">
                  Supervisor Master Console
                </span>
                <span className="text-xs text-[#64748B] font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  TiDB Cloud Persistent Data
                </span>
              </div>
              <h2 className="text-lg font-bold text-[#1E293B] flex items-center gap-2.5 mt-1.5">
                <div className="w-8 h-8 rounded-lg bg-[#2563EB]/10 border border-[#2563EB]/20 flex items-center justify-center text-[#2563EB]">
                  <Wrench className="w-4 h-4" />
                </div>
                Plant Maintenance & Recurring Routine Planning
              </h2>
              <p className="text-xs text-[#64748B] mt-1">
                Configure 30d / 60d / 90d / 120d recurring intervals, reassign technician machine clusters, and trigger autonomous AI match dispatches.
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                onClick={fetchCloudData}
                className="p-2 rounded-xl bg-white hover:bg-[#EAE7E0] text-[#64748B] border border-[#DDD9D0] transition-colors"
                title="Sync from TiDB Cloud"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
              <button 
                onClick={() => setShowScheduleModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-all active:scale-95"
              >
                <Plus size={13} /> Schedule PM Routine
              </button>
            </div>
          </div>

          {/* Master PM Cards & Clusters Section */}
          <div className="bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-5 shadow-sm space-y-4">
            {/* Filter Navigation Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DDD9D0] pb-3">
              <h3 className="text-sm font-bold text-[#1E293B] flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#2563EB]" />
                Preventative Maintenance (PM) Master Register (TiDB Cloud)
              </h3>

              <div className="flex bg-[#EAE7E0] p-1 rounded-xl border border-[#DDD9D0] overflow-x-auto no-scrollbar">
                {(
                  [
                    { id: 'ALL', label: 'ALL' },
                    { id: 'PREVENTATIVE', label: '30d / 90d / 120d' },
                    { id: 'INSPECTING', label: 'INSPECTING' },
                    { id: 'SCHEDULED', label: 'SCHEDULED' },
                    { id: 'COMPLETED', label: 'COMPLETED' },
                    { id: 'CLUSTERS', label: 'SUPERVISOR CLUSTER MATRIX' }
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setFilterType(tab.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                      filterType === tab.id
                        ? 'bg-[#2563EB] text-white shadow-sm'
                        : 'text-[#64748B] hover:text-[#1E293B]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* TAB 1: Supervisor Machine Cluster Reassignment Matrix */}
            {filterType === 'CLUSTERS' ? (
              <div className="space-y-4 animate-in fade-in">
                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-[#1E293B] flex items-start gap-2">
                  <Bot className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Supervisor Cluster Mapping:</span> Each technician in TiDB Cloud is paired with a couple of dedicated machines based on their skills & cell zoning. Click <strong className="text-[#2563EB]">"Reassign Cluster"</strong> on any specialist card to modify their machine pairings in TiDB Cloud.
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {clusters.map(tech => (
                    <div 
                      key={tech.id}
                      className="bg-white p-4 rounded-xl border border-[#DDD9D0] hover:border-[#2563EB] shadow-xs transition-all space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-bold text-xs">
                              {tech.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-[#1E293B]">{tech.name}</div>
                              <div className="text-[10px] text-[#64748B]">{tech.role}</div>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono font-bold bg-[#EAE7E0] text-[#1E293B] px-2 py-0.5 rounded">
                            {tech.assignedArea}
                          </span>
                        </div>

                        <div className="space-y-1.5 pt-2 border-t border-[#DDD9D0]/60">
                          <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                            Assigned Machine Cluster ({tech.assignedMachines?.length || 0} Assets):
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {tech.assignedMachines?.map(m => (
                              <button
                                key={m.code}
                                onClick={() => onSelectMachine(m.code)}
                                className="flex items-center gap-1 px-2 py-1 bg-[#FAF9F6] hover:bg-[#EAE7E0] text-[#2563EB] border border-[#DDD9D0] rounded-lg text-[11px] font-bold transition-all"
                              >
                                <span>{m.code}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setEditingClusterTech(tech);
                          setSelectedClusterMachines(tech.assignedMachines?.map(m => m.code) || []);
                        }}
                        className="w-full mt-2 py-1.5 bg-[#FAF9F6] hover:bg-blue-50 text-[#2563EB] border border-blue-200 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Edit3 size={13} />
                        <span>Reassign Machine Cluster</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* TAB 2: Scheduled PM Routines from TiDB Cloud */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredSchedules.map((pm) => {
                  const assignedTech = findClusterTechnicianForMachine(pm.machineCode);
                  const isDispatching = dispatchingId === pm.id;
                  const isInspecting = pm.status === 'INSPECTING';
                  const isCompleted = pm.status === 'COMPLETED';

                  return (
                    <div
                      key={pm.id}
                      className={`bg-white p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 shadow-xs ${
                        isInspecting 
                          ? 'border-[#2563EB] ring-2 ring-[#2563EB]/10 bg-blue-50/10' 
                          : isCompleted 
                            ? 'border-emerald-200 bg-emerald-50/10' 
                            : 'border-[#DDD9D0] hover:border-[#2563EB]'
                      }`}
                    >
                      <div>
                        {/* Card Top Row */}
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-extrabold text-[#1E293B]">{pm.id}</span>
                            <button
                              onClick={() => onSelectMachine(pm.machineCode)}
                              className="text-[10px] font-bold bg-[#EAE7E0] text-[#2563EB] hover:bg-blue-100 hover:underline px-2 py-0.5 rounded-md transition-colors"
                            >
                              {pm.machineCode}
                            </button>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-[#2563EB] border border-blue-100">
                              {pm.intervalDays}d Routine
                            </span>
                          </div>

                          {isInspecting ? (
                            <span className="text-[10px] font-extrabold bg-blue-50 text-[#2563EB] border border-blue-200 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
                              INSPECTION ACTIVE
                            </span>
                          ) : isCompleted ? (
                            <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <CheckCircle2 size={11} />
                              VERIFIED
                            </span>
                          ) : (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                              pm.priority === 'HIGH'
                                ? 'bg-[#FEF7E6] text-[#D99A06] border-[#F8DF9E]'
                                : 'bg-[#FAF9F6] text-[#64748B] border-[#DDD9D0]'
                            }`}>
                              {pm.priority} PRIORITY
                            </span>
                          )}
                        </div>

                        {/* Task Title & Details */}
                        <div className="text-xs font-bold text-[#1E293B] mt-1">{pm.task}</div>
                        <div className="text-[11px] text-[#64748B] mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>{pm.machineName}</span>
                          <span>&bull;</span>
                          <span className="text-[#2563EB] font-medium">{pm.frequency}</span>
                          <span>&bull;</span>
                          <span className="font-mono text-[10px] bg-[#EAE7E0] px-1.5 py-0.2 rounded">{pm.sopCode}</span>
                        </div>

                        {/* AI Auto-Match Recommendation */}
                        <div className="mt-2 text-[10px] bg-purple-50 text-purple-700 border border-purple-100 px-2 py-1 rounded-lg flex items-center gap-1.5">
                          <Bot size={11} className="text-purple-600 shrink-0" />
                          <span className="truncate">
                            AI Matched: <strong className="font-semibold text-purple-900">{assignedTech.name}</strong> ({assignedTech.skills[0]?.replace('_', ' ') || 'Specialist'} &bull; {assignedTech.assignedArea})
                          </span>
                        </div>
                      </div>

                      {/* Card Bottom Row */}
                      <div className="flex items-center justify-between pt-3 border-t border-[#DDD9D0] text-xs gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-bold text-[10px]">
                            {(pm.assignedTechnicianName || assignedTech.name).split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <div className="font-bold text-[#1E293B] text-[11px]">
                              {pm.assignedTechnicianName || assignedTech.name}
                            </div>
                            <div className="text-[10px] text-[#64748B]">
                              Cluster: {assignedTech.assignedMachines?.map(m => m.code).join(', ')}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="text-[11px] text-[#64748B] font-medium flex items-center gap-1 whitespace-nowrap">
                            <Clock size={11} className="text-[#64748B] shrink-0" />
                            Due: <strong className="text-[#1E293B] font-mono">{formatDueDateTime(pm.nextDue, pm.id)}</strong>
                          </span>

                          {isInspecting ? (
                            <button
                              onClick={() => setInspectingItem(pm)}
                              className="text-[11px] font-bold px-3 py-1.5 bg-[#2563EB] hover:bg-blue-700 text-white rounded-lg transition-all shadow-xs flex items-center gap-1.5 whitespace-nowrap"
                            >
                              <CheckSquare size={13} />
                              <span>Inspection Checklist</span>
                            </button>
                          ) : isCompleted ? (
                            <button
                              onClick={() => handleDispatchPM(pm)}
                              className="text-[11px] font-bold px-2.5 py-1 bg-white hover:bg-[#EAE7E0] border border-[#DDD9D0] text-[#1E293B] rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap"
                            >
                              <RotateCcw size={11} />
                              <span>Re-trigger</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleDispatchPM(pm)}
                              disabled={isDispatching}
                              className="text-[11px] font-bold px-3 py-1.5 bg-[#2563EB] hover:bg-blue-700 text-white rounded-lg transition-all shadow-xs flex items-center gap-1.5 active:scale-95 disabled:opacity-50 whitespace-nowrap"
                            >
                              {isDispatching ? (
                                <>
                                  <RefreshCw size={12} className="animate-spin" />
                                  <span>Dispatching...</span>
                                </>
                              ) : (
                                <>
                                  <Bot size={13} />
                                  <span>Dispatch</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL 1: PM Inspection & Verification Checklist Drawer ── */}
      {inspectingItem && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-[#DDD9D0] shadow-2xl max-w-xl w-full overflow-hidden animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-4 bg-[#FAF9F6] border-b border-[#DDD9D0] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center">
                  <CheckSquare size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1E293B] flex items-center gap-2">
                    <span>Digital PM Inspection Checklist (TiDB Cloud)</span>
                    <span className="text-[10px] font-mono bg-[#2563EB] text-white px-2 py-0.2 rounded font-medium">
                      {inspectingItem.workOrderId || inspectingItem.id}
                    </span>
                  </h3>
                  <p className="text-[11px] text-[#64748B]">
                    Asset: <strong>{inspectingItem.machineCode}</strong> &bull; {inspectingItem.frequency}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInspectingItem(null)}
                className="p-1 text-[#64748B] hover:text-[#1E293B] hover:bg-[#EAE7E0] rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-[#2563EB] text-white flex items-center justify-center text-xs font-bold">
                    {(inspectingItem.assignedTechnicianName || 'Tech').split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#1E293B]">{inspectingItem.assignedTechnicianName || 'Certified Specialist'}</div>
                    <div className="text-[10px] text-[#64748B]">Assigned Cluster &bull; {inspectingItem.area}</div>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                  OSHA Compliant
                </span>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-bold text-[#1E293B]">{inspectingItem.task}</div>
                <div className="text-[11px] text-[#64748B]">Standard Operating Procedure Reference: <span className="font-mono font-bold text-[#2563EB]">{inspectingItem.sopCode}</span></div>
              </div>

              <div className="space-y-2">
                <div className="text-[11px] font-bold text-[#1E293B] uppercase tracking-wider">
                  Mandatory Multi-Point Inspection Checklist:
                </div>
                {inspectingItem.checklist?.map((item) => (
                  <label
                    key={item.id}
                    onClick={() => handleToggleChecklist(item.id)}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      item.checked
                        ? 'bg-emerald-50/60 border-emerald-200 text-[#1E293B]'
                        : 'bg-white border-[#DDD9D0] hover:bg-[#FAF9F6] text-[#64748B]'
                    }`}
                  >
                    <div className="mt-0.5">
                      {item.checked ? (
                        <div className="w-4 h-4 rounded bg-emerald-600 text-white flex items-center justify-center">
                          <Check size={12} />
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded border border-[#DDD9D0] bg-white" />
                      )}
                    </div>
                    <span className="text-xs font-medium leading-tight select-none">
                      {item.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#FAF9F6] border-t border-[#DDD9D0] flex items-center justify-between gap-3">
              <button
                onClick={() => setInspectingItem(null)}
                className="px-4 py-2 rounded-xl bg-white border border-[#DDD9D0] text-[#1E293B] text-xs font-bold hover:bg-[#EAE7E0] transition-colors"
              >
                Close
              </button>

              <button
                onClick={() => handleCompleteInspection(inspectingItem)}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 active:scale-95"
              >
                <CheckCircle2 size={14} />
                <span>Sign-off & Advance Schedule (+{inspectingItem.intervalDays}d)</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── MODAL 2: Supervisor Cluster Reassignment Modal ── */}
      {editingClusterTech && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-[#DDD9D0] shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95">
            <div className="p-4 bg-[#FAF9F6] border-b border-[#DDD9D0] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center">
                  <Edit3 size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1E293B]">Reassign Machine Cluster</h3>
                  <p className="text-[11px] text-[#64748B]">Specialist: <strong>{editingClusterTech.name}</strong> ({editingClusterTech.assignedArea})</p>
                </div>
              </div>
              <button
                onClick={() => setEditingClusterTech(null)}
                className="p-1 text-[#64748B] hover:text-[#1E293B] rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
              <div className="text-xs font-bold text-[#1E293B]">Select Machines to Assign to this Specialist:</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  'CNC-01', 'CNC-02', 'CNC-03', 'CNC-04', 'CNC-05', 'CNC-06',
                  'ROBOT-01', 'ROBOT-02', 'ROBOT-03', 'ROBOT-04',
                  'PUMP-01', 'MIXER-01', 'PRESS-01', 'PROCESS-01', 'PROCESS-02',
                  'ASMB-01', 'ASMB-02', 'ASMB-03', 'ASMB-04',
                  'PACK-01', 'PACK-02', 'PACK-03',
                  'BENCH-01', 'BENCH-02', 'TEST-01'
                ].map(code => {
                  const isChecked = selectedClusterMachines.includes(code);
                  return (
                    <label
                      key={code}
                      onClick={() => {
                        setSelectedClusterMachines(prev => 
                          prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
                        );
                      }}
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs font-bold transition-all ${
                        isChecked
                          ? 'bg-blue-50 border-[#2563EB] text-[#2563EB]'
                          : 'bg-white border-[#DDD9D0] text-[#64748B]'
                      }`}
                    >
                      <input type="checkbox" checked={isChecked} readOnly className="sr-only" />
                      <div className={`w-3.5 h-3.5 rounded flex items-center justify-center text-white text-[9px] ${isChecked ? 'bg-[#2563EB]' : 'border border-slate-300'}`}>
                        {isChecked && <Check size={10} />}
                      </div>
                      <span>{code}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="p-4 bg-[#FAF9F6] border-t border-[#DDD9D0] flex items-center justify-end gap-2.5">
              <button
                onClick={() => setEditingClusterTech(null)}
                className="px-4 py-2 rounded-xl bg-white border border-[#DDD9D0] text-[#1E293B] text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveClusterReassignment}
                className="px-5 py-2 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold shadow-md"
              >
                Save to TiDB Cloud
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── MODAL 3: Schedule New PM Routine in TiDB Cloud ── */}
      {showScheduleModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-[#DDD9D0] shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95">
            <div className="p-4 bg-[#FAF9F6] border-b border-[#DDD9D0] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center">
                  <Plus size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1E293B]">Schedule Recurring PM Routine (TiDB Cloud)</h3>
                  <p className="text-[11px] text-[#64748B]">Register recurring preventative maintenance routine</p>
                </div>
              </div>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="p-1 text-[#64748B] hover:text-[#1E293B]"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateNewRoutine} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1E293B] mb-1">
                  Target Machine Asset:
                </label>
                <CustomSelect
                  value={newMachineCode}
                  onChange={(val) => setNewMachineCode(val)}
                  options={[
                    { value: 'CNC-01', label: 'CNC-01 — 5-Axis Milling Center 01' },
                    { value: 'CNC-02', label: 'CNC-02 — Heavy Duty Turning Center 02' },
                    { value: 'CNC-03', label: 'CNC-03 — High-Precision Milling Center 03' },
                    { value: 'CNC-04', label: 'CNC-04 — 5-Axis Machining Center 04' },
                    { value: 'CNC-05', label: 'CNC-05 — High-Speed Mill 05' },
                    { value: 'CNC-06', label: 'CNC-06 — Ultra Precision Lathe 06' },
                    { value: 'ROBOT-01', label: 'ROBOT-01 — 6-Axis Welding Robot 01' },
                    { value: 'ROBOT-02', label: 'ROBOT-02 — Heavy Payload Robot 02' },
                    { value: 'ROBOT-03', label: 'ROBOT-03 — Precision Seam Robot 03' },
                    { value: 'ROBOT-04', label: 'ROBOT-04 — Fastening Robot 04' },
                    { value: 'PUMP-01', label: 'PUMP-01 — Hydraulic Coolant Pump' },
                    { value: 'MIXER-01', label: 'MIXER-01 — High-Shear Lubricant Mixer' },
                    { value: 'PRESS-01', label: 'PRESS-01 — Hydraulic Stamping Press' },
                    { value: 'ASMB-01', label: 'ASMB-01 — Torque Workstation' },
                    { value: 'PACK-01', label: 'PACK-01 — Form-Fill-Seal Packaging' },
                    { value: 'BENCH-01', label: 'BENCH-01 — Diagnostic Overhaul Bench' },
                  ]}
                  fullWidth
                  size="md"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1E293B] mb-1">
                    Recurring Interval:
                  </label>
                  <CustomSelect
                    value={newIntervalDays}
                    onChange={(val) => setNewIntervalDays(Number(val))}
                    options={[
                      { value: 30, label: 'Every 30 Days (Monthly)' },
                      { value: 60, label: 'Every 60 Days (Bi-Monthly)' },
                      { value: 90, label: 'Every 90 Days (Quarterly)' },
                      { value: 120, label: 'Every 120 Days (Tri-Annual)' },
                      { value: 180, label: 'Every 180 Days (Semi-Annual)' },
                      { value: 365, label: 'Every 365 Days (Annual Overhaul)' },
                    ]}
                    fullWidth
                    size="md"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1E293B] mb-1">
                    Priority:
                  </label>
                  <CustomSelect
                    value={newPriority}
                    onChange={(val) => setNewPriority(val as any)}
                    options={[
                      { value: 'HIGH', label: 'High Priority' },
                      { value: 'MEDIUM', label: 'Medium Priority' },
                      { value: 'LOW', label: 'Low Priority' },
                    ]}
                    fullWidth
                    size="md"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1E293B] mb-1">
                  Routine Maintenance Task Description:
                </label>
                <input
                  type="text"
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#DDD9D0] bg-white text-xs text-[#1E293B] font-medium"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 rounded-xl bg-white border border-[#DDD9D0] text-[#1E293B] text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-bold shadow-md"
                >
                  Save to TiDB Cloud
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
