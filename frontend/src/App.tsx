import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardPage } from './pages/DashboardPage';
import { DigitalTwinPage } from './pages/DigitalTwinPage';
import { OpsTwinView } from './components/OpsTwin/OpsTwinView';
import { MachinesView } from './components/Operations/MachinesView';
import { IoTDevicesView } from './components/Operations/IoTDevicesView';
import { TelemetryView } from './components/Operations/TelemetryView';
import { IncidentTimeline } from './components/Operations/IncidentTimeline';
import { MaintenanceView } from './components/Operations/MaintenanceView';
import { WorkOrdersView } from './components/Operations/WorkOrdersView';
import { TechniciansView } from './components/Operations/TechniciansView';
import { InventoryView } from './components/Operations/InventoryView';
import { ProcurementView } from './components/Operations/ProcurementView';
import { SuppliersView } from './components/Operations/SuppliersView';
import { HumanReviewView } from './components/Operations/HumanReviewView';
import { AIDiagnosisView } from './components/Operations/AIDiagnosisView';
import { DomoAnalyticsView } from './components/Operations/DomoAnalyticsView';
import { ReportsView } from './components/Operations/ReportsView';
import { SettingsView } from './components/Operations/SettingsView';
import { ProductionLogisticsView } from './components/Operations/ProductionLogisticsView';
import { PowerSupplyCellView } from './components/Operations/PowerSupplyCellView';
import { MachineDailyHistoryView } from './components/Operations/MachineDailyHistoryView';
import { LiveFleetTrackingView } from './components/Operations/LiveFleetTrackingView';
import { AssistantView } from './components/Assistant/AssistantView';
import { LoginPage, USER_ROLES, UserProfile } from './components/Operations/LoginPage';
import { PlantIntercomDrawer } from './components/Intercom/PlantIntercomDrawer';
import {
  ToastNotificationContainer,
  ToastMessage,
  ToastType
} from './components/ToastNotification';
import { api, socket } from './services/api';
import {
  Machine, TelemetryData, Incident, WorkOrder,
  SparePartInventory, PurchaseOrder, HumanReviewItem
} from './types';
import { Activity, X } from 'lucide-react';

// Screens that render live machine state and need the 3s fallback poll
const MACHINE_POLL_TABS = new Set(['dashboard', 'twin', 'ops-twin', 'machines', 'iot', 'telemetry', 'ai']);

export const App: React.FC = () => {
  // a shared Ops Twin link (#ops-twin?...) opens that page directly
  const [activeTab, setActiveTab] = useState<string>(() => (window.location.hash.startsWith('#ops-twin') ? 'ops-twin' : 'dashboard'));
  const activeTabRef = useRef(activeTab);
  // Truck to focus when opening Live Fleet Tracking from the dashboard ('TRK-001#<nonce>')
  const [fleetFocus, setFleetFocus] = useState<string | null>(null);
  activeTabRef.current = activeTab;
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [isHeaderHidden, setIsHeaderHidden] = useState<boolean>(false);
  const [showScenarioModal, setShowScenarioModal] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<UserProfile>(USER_ROLES[0]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [telemetryMap, setTelemetryMap] = useState<Record<string, TelemetryData>>({});
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [inventory, setInventory] = useState<SparePartInventory[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [reviewItems, setReviewItems] = useState<HumanReviewItem[]>([]);
  const [injecting, setInjecting] = useState(false);
  const [healing, setHealing] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (
    toast: Omit<ToastMessage, 'id' | 'timestamp'> & { timestamp?: string }
  ) => {
    setToasts((prev) => {
      // Deduplicate: If an identical toast with same title & subtitle/message is already in view, skip duplicate
      const isDuplicate = prev.some(
        (t) => t.title === toast.title && (t.subtitle === toast.subtitle || t.message === toast.message)
      );
      if (isDuplicate) return prev;

      const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const newToast: ToastMessage = {
        ...toast,
        id,
        timestamp:
          toast.timestamp ||
          new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };
      return [newToast, ...prev.slice(0, 2)]; // Keep max 3 cleanly stacked toasts
    });
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const showToast = (msg: string, type: ToastType = 'INFO') => {
    addToast({
      type,
      title: 'System Notification',
      message: msg
    });
  };

  const handleInjectFault = async () => {
    setInjecting(true);
    try {
      await api.injectFault('CNC-01', 'BEARING_WEAR', 1.0);
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'INFO');
    } finally {
      setInjecting(false);
    }
  };

  const handleHealMachine = async () => {
    setHealing(true);
    try {
      await api.healMachine('CNC-01');
      addToast({
        type: 'INFO',
        title: 'Telemetry Baseline Restored',
        subtitle: 'Asset: CNC-01',
        message: 'Normalized sensor feed. Automated verification engine observing 3-cycle baseline.'
      });
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'INFO');
    } finally {
      setHealing(false);
    }
  };

  const refreshAll = () => {
    api.getMachines().then(r => {
      if (r.success) {
        setMachines(r.data);
      }
    });
    api.getIncidents().then(r => r.success && setIncidents(r.data));
    api.getWorkOrders().then(r => r.success && setWorkOrders(r.data));
    api.getInventory().then(r => r.success && setInventory(r.data));
    api.getPurchaseOrders().then(r => r.success && setPurchaseOrders(r.data));
    api.getHumanReviewItems().then(r => r.success && setReviewItems(r.data));
  };

  useEffect(() => {
    refreshAll();
    socket.on('telemetry:stream', (data: TelemetryData) => {
      setTelemetryMap(prev => ({ ...prev, [data.machineId]: data }));
    });
    socket.on('machine:status_changed', (data: any) => {
      setMachines(prev => prev.map(m =>
        (m.code === data.machineId || m.id === data.machineId || m.code === data.machineCode || m.id === data.machineCode)
          ? { ...m, status: data.status, health_score: data.healthScore || data.health_score || m.health_score }
          : m
      ));
      if (selectedMachine && (selectedMachine.code === data.machineId || selectedMachine.id === data.machineId || selectedMachine.code === data.machineCode || selectedMachine.id === data.machineCode)) {
        setSelectedMachine(prev => prev ? { ...prev, status: data.status, health_score: data.healthScore || data.health_score || prev.health_score } : null);
      }
    });

    // 1. Machine Fault Detected & AI Agent Triggered
    socket.on('incident:created', (data: any) => {
      api.getIncidents().then(r => r.success && setIncidents(r.data));
      
      const machineName = data.machineName || data.machineId || 'CNC-01';
      const vib = data.telemetry?.vibration?.toFixed(2) || '7.82';
      const temp = data.telemetry?.temperature?.toFixed(1) || '81.4';

      // Toast 1: IoT Edge Fault Alarm
      addToast({
        type: 'IOT_ALERT',
        title: `🚨 IoT Edge Threshold Alarm`,
        subtitle: `Asset: ${machineName}`,
        message: data.summary || `${data.alertType || 'Vibration / Thermal Anomaly'} breached safety envelope. Machine entered FAULT state.`,
        metaBadge: data.incidentId || 'INCIDENT',
        metaDetails: [
          { label: 'Vibration', value: `${vib} mm/s` },
          { label: 'Temp', value: `${temp} °C` },
          { label: 'Clock', value: 'DOWNTIME STARTED' }
        ]
      });

      // Toast 2: AI Orchestrator Agent Triggered
      setTimeout(() => {
        addToast({
          type: 'AI_AGENT',
          title: '🤖 AI Maintenance Agent Triggered',
          subtitle: `Auto-evaluating technicians for ${machineName}`,
          message: 'Evaluating technician skills, experience, active workload & cell proximity for optimal closed-loop dispatch.',
          metaBadge: 'AUTONOMOUS MATCH'
        });
      }, 700);
    });

    // 2. Technician Assigned & Dispatched
    socket.on('workorder:created', (data: any) => {
      api.getWorkOrders().then(r => r.success && setWorkOrders(r.data));
      
      const techName = data.technicianName || 'Specialist';
      const matchScore = ((data.matchConfidence || 0.95) * 100).toFixed(0);
      const machineCode = data.machineCode || data.machineId || 'CNC-01';
      const skills = (data.requiredSkills || ['CNC_MILLING', 'BEARING_REPLACEMENT']).slice(0, 2).join(', ');

      addToast({
        type: 'DISPATCH',
        title: '👷 Technician Assigned & Dispatched',
        subtitle: `${techName} (${matchScore}% Match)`,
        message: `Assigned Work Order ${data.workOrderId} for ${machineCode}. En route to workcell with PPE and safety checklist.`,
        metaBadge: data.workOrderId || 'WORK ORDER',
        metaDetails: [
          { label: 'Technician', value: techName },
          { label: 'Match', value: `${matchScore}%` },
          { label: 'Skills', value: skills }
        ]
      });
    });

    // Intermediate Lifecycle Steps
    const refreshWorkflow = () => {
      api.getIncidents().then(r => r.success && setIncidents(r.data));
      api.getWorkOrders().then(r => r.success && setWorkOrders(r.data));
    };

    socket.on('workorder:arrived', (data: any) => {
      refreshWorkflow();
      addToast({
        type: 'INFO',
        title: '📍 Technician Arrived On-Site',
        subtitle: data?.technicianName || 'Certified Technician',
        message: 'Technician reached the machine perimeter and initiated pre-work safety inspection.'
      });
    });

    socket.on('workorder:loto', (data: any) => {
      refreshWorkflow();
      addToast({
        type: 'LOTO',
        title: '🔒 OSHA 1910.147 LOTO Verified',
        subtitle: `Padlock #${data?.padlockId || 'PL-8894-LOTO'} Applied`,
        message: `Zero Energy State verified by ${data?.verifiedBy || 'Technician'}. 0.0V / 0.0 bar manifold pressure confirmed.`
      });
    });

    socket.on('workorder:inspected', (data: any) => {
      refreshWorkflow();
      addToast({
        type: 'INSPECTION',
        title: '🔍 Root Cause Confirmed & Spares Allocated',
        subtitle: `Part: ${data?.requiredPartId || 'SKF-6205'} (Bin: ${data?.binLocation || 'BAY-A-04'})`,
        message: `Diagnosis: ${data?.technicianRootCause || 'Bearing cage fatigue'}. Spare parts allocated from Central Spares ATP.`
      });
    });

    socket.on('workorder:completed', (data: any) => {
      refreshWorkflow();
      addToast({
        type: 'REPAIR_COMPLETE',
        title: '🔧 Component Repair Completed',
        subtitle: `Work Order: ${data?.workOrderId || 'WO-COMPLETED'}`,
        message: 'Replacement installed and torqued to OEM specs. Machine entered 3-cycle automated IoT verification.'
      });
    });

    socket.on('technician:updated', refreshWorkflow);

    socket.on('po:updated', () => {
      api.getPurchaseOrders().then(r => r.success && setPurchaseOrders(r.data));
      api.getHumanReviewItems().then(r => r.success && setReviewItems(r.data));
      api.getInventory().then(r => r.success && setInventory(r.data));
    });

    socket.on('po:received', () => {
      api.getPurchaseOrders().then(r => r.success && setPurchaseOrders(r.data));
      api.getInventory().then(r => r.success && setInventory(r.data));
    });

    // 3. Full Machine Repair Passed & Downtime Calculated
    socket.on('incident:resolved', (data: any) => {
      refreshAll();
      const mId = data?.machineId || 'Machine';
      const downtimeSec = typeof data?.downtimeSeconds === 'number'
        ? `${data.downtimeSeconds.toFixed(1)}s`
        : 'Logged in DB';

      addToast({
        type: 'DOWNTIME_RESOLVED',
        title: '⏱️ Machine Restored & Downtime Calculated',
        subtitle: `${mId} Restored to RUNNING (98% Health)`,
        message: `Automated 3-cycle baseline verification passed! Total Downtime: ${downtimeSec} calculated from initial IoT alarm to full recovery.`,
        metaBadge: 'OEE RESTORED',
        metaDetails: [
          { label: 'Downtime', value: downtimeSec },
          { label: 'Health Score', value: '98%' },
          { label: 'Status', value: 'RUNNING' }
        ],
        durationMs: 9000
      });
    });

    // 4. Power Control Lifecycle Events
    socket.on('power:started', (data: any) => {
      refreshAll();
      addToast({
        type: 'INFO',
        title: '🟢 PLANT POWER ONLINE',
        subtitle: `${data?.voltage || 480}V • ${data?.current_amps || 182}A Live`,
        message: data?.message || 'Main power energized. 25 machines available for production.'
      });
    });

    socket.on('power:stopped', (data: any) => {
      refreshAll();
      addToast({
        type: 'INFO',
        title: '⚪ PLANT POWER DE-ENERGIZED',
        subtitle: 'Controlled Substation Shutdown',
        message: data?.message || 'All production cells offline in safe zero-energy state.'
      });
    });

    socket.on('power:estop', (data: any) => {
      refreshAll();
      addToast({
        type: 'IOT_ALERT',
        title: '🚨 EMERGENCY SHUTDOWN ACTIVATED',
        subtitle: 'Main MCC Substation Tripped',
        message: data?.message || 'Emergency trip engaged. All electrical feeds isolated.'
      });
    });

    socket.on('power:status_changed', refreshAll);
    socket.on('breaker:toggled', refreshAll);

    const pollInterval = setInterval(() => {
      // Socket events already refresh on changes; skip the fallback poll when nobody is looking
      // at machine data (browser tab hidden, or on screens that don't use it)
      if (document.hidden || !MACHINE_POLL_TABS.has(activeTabRef.current)) return;
      api.getMachines().then(r => {
        if (r.success && Array.isArray(r.data)) {
          setMachines(r.data);
          if (selectedMachine) {
            const updated = r.data.find((m: any) => m.code === selectedMachine.code || m.id === selectedMachine.id);
            if (updated) setSelectedMachine(updated);
          }
        }
      });
    }, 3000);

    return () => {
      clearInterval(pollInterval);
      socket.off('telemetry:stream');
      socket.off('machine:status_changed');
      socket.off('incident:created');
      socket.off('workorder:created');
      socket.off('workorder:arrived');
      socket.off('workorder:loto');
      socket.off('workorder:inspected');
      socket.off('workorder:completed');
      socket.off('technician:updated');
      socket.off('po:updated');
      socket.off('po:received');
      socket.off('incident:resolved');
      socket.off('power:started');
      socket.off('power:stopped');
      socket.off('power:estop');
      socket.off('power:status_changed');
      socket.off('breaker:toggled');
    };
  }, [selectedMachine]);

  const handleSelectMachineByCode = (code: string) => {
    const found = machines.find(m => m.code === code || m.id === code);
    if (found) {
      setSelectedMachine(found);
      setActiveTab('twin');
    }
  };

  const pendingReviewsCount = reviewItems.filter(i => i.status === 'PENDING').length;
  const activeFaultsCount = machines.filter(m => m.status === 'FAULT').length;
  const contentMargin = sidebarCollapsed ? 'ml-16' : 'ml-60';

  return (
    <div className="min-h-screen bg-[#F3F1EC] text-[#1E293B] flex">
      {/* Top-Right Stacked Toast Notification Center */}
      <ToastNotificationContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Sidebar with toggle & role-tailored RBAC navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingReviewsCount={pendingReviewsCount}
        activeFaultsCount={activeFaultsCount}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
        currentUser={currentUser}
      />

      {/* Main Container */}
      <div className={`flex-1 flex flex-col ${contentMargin} transition-all duration-200 min-w-0 bg-[#F3F1EC]`}>
        {/* Header with Global Search */}
        {/* Ops Twin has its own header bar, so the global top navbar is hidden on that page */}
        {activeTab !== 'ops-twin' && (
        <div className={`transition-all duration-300 ${activeTab === 'fleet' && isHeaderHidden ? '-mt-14 opacity-0 pointer-events-none' : 'mt-0 opacity-100'}`}>
          <Header
            activeTab={activeTab}
            pendingReviewsCount={pendingReviewsCount}
            activeFaultsCount={activeFaultsCount}
            collapsed={sidebarCollapsed}
            currentUser={currentUser}
            onOpenLogin={() => setActiveTab('login')}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onSelectMachine={(mCode) => handleSelectMachineByCode(mCode)}
            machines={machines}
            incidents={incidents}
            workOrders={workOrders}
            inventory={inventory}
          />
        </div>
        )}

        {/* Dynamic Page Views: 17 Complete Operational Pages */}
        <main className={`flex-1 overflow-y-auto w-full transition-all duration-300 ${(activeTab === 'fleet' && isHeaderHidden) || activeTab === 'ops-twin' ? 'pt-0' : 'pt-14'}`}>
          {/* Page 1: Login / Role-Based Access Control */}
          {activeTab === 'login' && (
            <LoginPage
              currentUser={currentUser}
              onLogin={(user) => {
                setCurrentUser(user);
                setActiveTab('dashboard');
                showToast(`Authenticated session as ${user.name} (${user.role})`);
              }}
            />
          )}

          {/* Page 2: Dashboard (Operations Command Center with 5 Role-Based Dashboards) */}
          {activeTab === 'dashboard' && (
            <div className="p-3.5 sm:p-4 md:p-5 w-full">
              <DashboardPage
                machines={machines}
                incidents={incidents}
                workOrders={workOrders}
                inventory={inventory}
                purchaseOrders={purchaseOrders}
                reviewItems={reviewItems}
                currentUser={currentUser}
                onSelectTab={setActiveTab}
                onRefresh={refreshAll}
                onSwitchUserRole={setCurrentUser}
                onTrackTruck={(id) => {
                  setFleetFocus(`${id}#${Date.now()}`);
                  setActiveTab('fleet');
                }}
              />
            </div>
          )}

          {/* Page 2B: Power Supply & Electrical Control Cell */}
          {activeTab === 'power' && (
            <div className="p-3.5 sm:p-4 md:p-5 w-full">
              <PowerSupplyCellView
                onAddToast={addToast}
                onNavigateTab={setActiveTab}
                onSelectMachine={(mCode) => {
                  const m = machines.find(mac => mac.code === mCode);
                  if (m) setSelectedMachine(m);
                }}
              />
            </div>
          )}

          {/* Page 2C: Machine Daily Operations History & Production Calendar */}
          {activeTab === 'history' && (
            <div className="p-3.5 sm:p-4 md:p-5 w-full">
              <MachineDailyHistoryView
                onAddToast={addToast}
                onNavigateTab={setActiveTab}
                onSelectMachine={(mCode) => {
                  const m = machines.find(mac => mac.code === mCode);
                  if (m) setSelectedMachine(m);
                }}
              />
            </div>
          )}

          {/* Page 2D: End-to-End CNC Production, Packaging & AGV Logistics */}
          {activeTab === 'production' && (
            <div className="p-3.5 sm:p-4 md:p-5 w-full">
              <ProductionLogisticsView onAddToast={addToast} />
            </div>
          )}

          {/* Page 2E: Live Mapbox Fleet Tracking */}
          {activeTab === 'fleet' && (
            <LiveFleetTrackingView
              onAddToast={addToast}
              isHeaderHidden={isHeaderHidden}
              onToggleHeader={() => setIsHeaderHidden((h) => !h)}
              focusTruckId={fleetFocus}
            />
          )}

          {/* Page 3: 3D Digital Twin */}
          {activeTab === 'twin' && (
            <DigitalTwinPage
              machines={machines}
              selectedMachine={selectedMachine}
              onSelectMachine={setSelectedMachine}
              telemetryMap={telemetryMap}
              incidents={incidents}
              workOrders={workOrders}
              onRefresh={refreshAll}
              activeFaultsCount={activeFaultsCount}
            />
          )}

          {/* Page 3b: Ops Twin (cell-level operational twin, beta) */}
          {activeTab === 'ops-twin' && (
            <OpsTwinView machines={machines} workOrders={workOrders} incidents={incidents} telemetryMap={telemetryMap} currentUser={currentUser} />
          )}

          {/* Page 4: Machines Register */}
          {activeTab === 'machines' && (
            <div className="p-3.5 sm:p-4 md:p-5 w-full">
              <MachinesView
                machines={machines}
                telemetryMap={telemetryMap}
                incidents={incidents}
                workOrders={workOrders}
                inventory={inventory}
                currentUser={currentUser}
                onSelectMachine={(m) => setSelectedMachine(m)}
                onNavigateTwin={() => setActiveTab('twin')}
                onNavigateTab={(tab: string) => setActiveTab(tab)}
                onRefresh={refreshAll}
              />
            </div>
          )}

          {/* Page 5: IoT Devices & Edge Network */}
          {activeTab === 'iot' && (
            <div className="p-3.5 sm:p-4 md:p-5 w-full">
              <IoTDevicesView
                currentUser={currentUser}
                machines={machines}
                onSelectMachine={(m) => setSelectedMachine(m)}
                onNavigateTwin={() => setActiveTab('twin')}
              />
            </div>
          )}

          {/* Page 6: Telemetry Diagnostics */}
          {activeTab === 'telemetry' && (
            <div className="p-3.5 sm:p-4 md:p-5 w-full">
              <TelemetryView
                machines={machines}
                telemetryMap={telemetryMap}
                currentUser={currentUser}
                incidents={incidents}
                workOrders={workOrders}
                onSelectMachine={(m) => setSelectedMachine(m)}
                onNavigateTwin={() => setActiveTab('twin')}
              />
            </div>
          )}

          {/* Page 7: Incidents Timeline */}
          {(activeTab === 'incidents' || activeTab === 'timeline') && (
            <div className="p-3.5 sm:p-4 md:p-5 w-full">
              <IncidentTimeline 
                incidents={incidents} 
                onSelectMachine={handleSelectMachineByCode}
                onNavigateTab={(tab) => setActiveTab(tab as any)}
                onAddToast={addToast}
              />
            </div>
          )}

          {/* Page 8: Maintenance Planning & PM Schedules */}
          {activeTab === 'maintenance' && (
            <div className="p-3.5 sm:p-4 md:p-5 w-full">
              <MaintenanceView
                workOrders={workOrders}
                currentUser={currentUser}
                onRefresh={refreshAll}
                onSelectMachine={handleSelectMachineByCode}
                onAddToast={addToast}
              />
            </div>
          )}

          {/* Page 9: Work Orders Dispatch & OSHA LOTO */}
          {activeTab === 'work-orders' && (
            <div className="p-3.5 sm:p-4 md:p-5 w-full">
              <WorkOrdersView
                workOrders={workOrders}
                onRefresh={refreshAll}
                onSelectMachine={handleSelectMachineByCode}
                onNavigateTab={(tab) => setActiveTab(tab as any)}
                onAddToast={addToast}
              />
            </div>
          )}

          {/* Page 10: Technicians & Skills Matrix */}
          {activeTab === 'technicians' && (
            <div className="p-3.5 sm:p-4 md:p-5 w-full">
              <TechniciansView />
            </div>
          )}

          {/* Page 11: Inventory & Available to Promise (ATP) */}
          {activeTab === 'inventory' && (
            <div className="p-3.5 sm:p-4 md:p-5 w-full">
              <InventoryView 
                inventory={inventory} 
                workOrders={workOrders}
                purchaseOrders={purchaseOrders}
                userRole={currentUser.role}
                onRefresh={refreshAll}
                onAddToast={addToast}
                onNavigateTab={(tab) => setActiveTab(tab as any)}
              />
            </div>
          )}

          {/* Page 12: Autonomous Procurement & POs */}
          {activeTab === 'procurement' && (
            <div className="p-3.5 sm:p-4 md:p-5 w-full">
              <ProcurementView
                purchaseOrders={purchaseOrders}
                onRefresh={refreshAll}
                onAddToast={addToast}
                onNavigateTab={(tab) => setActiveTab(tab as any)}
              />
            </div>
          )}

          {/* Page 13: Suppliers & Vendor Directory */}
          {activeTab === 'suppliers' && (
            <div className="p-3.5 sm:p-4 md:p-5 w-full">
              <SuppliersView
                onAddToast={addToast}
                onNavigateTab={(tab) => setActiveTab(tab as any)}
              />
            </div>
          )}

          {/* Page 14: Human Review Center */}
          {activeTab === 'review' && (
            <div className="p-3.5 sm:p-4 md:p-5 w-full">
              <HumanReviewView reviewItems={reviewItems} onRefresh={refreshAll} />
            </div>
          )}

          {/* AI Assistant: agentic RAG copilot for plant members */}
          {activeTab === 'assistant' && (
            <div className="p-3.5 sm:p-4 md:p-5 w-full">
              <AssistantView currentUser={currentUser} onAddToast={addToast} />
            </div>
          )}

          {/* Page 15: AI Maintenance Orchestrator & Transparent Agent Ledger */}
          {activeTab === 'ai' && (
            <div className="p-3.5 sm:p-4 md:p-5 w-full">
              <AIDiagnosisView
                machines={machines}
                workOrders={workOrders}
                userRole={currentUser.role}
                onRefresh={refreshAll}
                onAddToast={addToast}
                onNavigateTab={(tab) => setActiveTab(tab as any)}
              />
            </div>
          )}

          {/* Page 16: Domo Analytics & Reports Center (Commented) */}
          {/* {activeTab === 'domo' && (
            <div className="p-6 space-y-8">
              <DomoAnalyticsView />
              <div className="pt-4 border-t border-[#DDD9D0]">
                <ReportsView />
              </div>
            </div>
          )} */}

          {/* Direct Reports View */}
          {/* {activeTab === 'reports' && (
            <div className="p-6">
              <ReportsView />
            </div>
          )} */}

          {/* Page 17: Audit Trail & Settings (Commented) */}
          {/* {activeTab === 'settings' && (
            <div className="p-6">
              <SettingsView />
            </div>
          )} */}
        </main>
      </div>

      {/* Global Real-time Toast Notifications (Top-Right) */}
      <ToastNotificationContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Cross-Role Intercom & AI Copilot Floating Drawer (Temporarily Commented) */}
      {/* <PlantIntercomDrawer currentUser={currentUser} onAddToast={addToast} /> */}
    </div>
  );
};

export default App;

