import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardPage } from './pages/DashboardPage';
import { DigitalTwinPage } from './pages/DigitalTwinPage';
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
import { LoginPage, USER_ROLES, UserProfile } from './components/Operations/LoginPage';
import { api, socket } from './services/api';
import {
  Machine, TelemetryData, Incident, WorkOrder,
  SparePartInventory, PurchaseOrder, HumanReviewItem
} from './types';
import { Activity, X } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
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
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4500);
  };

  const handleInjectFault = async () => {
    setInjecting(true);
    try {
      await api.injectFault('CNC-01', 'BEARING_WEAR', 1.0);
      showToast('⚠️ Injected Spindle Bearing Wear Anomaly on CNC-01! Closed loop initiated.');
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setInjecting(false);
    }
  };

  const handleHealMachine = async () => {
    setHealing(true);
    try {
      await api.healMachine('CNC-01');
      showToast('✅ Normalized telemetry on CNC-01. Verification engine observing...');
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setHealing(false);
    }
  };

  const refreshAll = () => {
    api.getMachines().then(r => {
      if (r.success) {
        setMachines(r.data);
        if (!selectedMachine && r.data.length > 0) {
          setSelectedMachine(r.data.find((m: Machine) => m.code === 'CNC-01') || r.data[0]);
        }
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
        (m.code === data.machineId || m.id === data.machineId)
          ? { ...m, status: data.status, health_score: data.healthScore || m.health_score }
          : m
      ));
      if (selectedMachine && (selectedMachine.code === data.machineId || selectedMachine.id === data.machineId)) {
        setSelectedMachine(prev => prev ? { ...prev, status: data.status, health_score: data.healthScore || prev.health_score } : null);
      }
    });
    socket.on('incident:created', () => api.getIncidents().then(r => r.success && setIncidents(r.data)));
    socket.on('workorder:created', () => api.getWorkOrders().then(r => r.success && setWorkOrders(r.data)));
    socket.on('po:updated', () => {
      api.getPurchaseOrders().then(r => r.success && setPurchaseOrders(r.data));
      api.getHumanReviewItems().then(r => r.success && setReviewItems(r.data));
      api.getInventory().then(r => r.success && setInventory(r.data));
    });
    socket.on('po:received', () => {
      api.getPurchaseOrders().then(r => r.success && setPurchaseOrders(r.data));
      api.getInventory().then(r => r.success && setInventory(r.data));
    });
    socket.on('incident:resolved', refreshAll);

    return () => {
      socket.off('telemetry:stream');
      socket.off('machine:status_changed');
      socket.off('incident:created');
      socket.off('workorder:created');
      socket.off('po:updated');
      socket.off('po:received');
      socket.off('incident:resolved');
    };
  }, []);

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
      {/* Sidebar with toggle & full navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingReviewsCount={pendingReviewsCount}
        activeFaultsCount={activeFaultsCount}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
        currentRoleName={`${currentUser.name} (${currentUser.role})`}
      />

      {/* Main Container */}
      <div className={`flex-1 flex flex-col ${contentMargin} transition-all duration-200 min-w-0 bg-[#F3F1EC]`}>
        {/* Header */}
        <Header
          activeTab={activeTab}
          pendingReviewsCount={pendingReviewsCount}
          activeFaultsCount={activeFaultsCount}
          collapsed={sidebarCollapsed}
          currentUser={currentUser}
          onOpenLogin={() => setActiveTab('login')}
        />

        {/* Global Toast */}
        {toastMsg && (
          <div className={`fixed top-18 ${sidebarCollapsed ? 'left-16' : 'left-60'} right-0 z-50 flex justify-center pt-2 pointer-events-none transition-all duration-200`}>
            <div className="bg-[#2563EB] text-white text-xs font-bold px-5 py-2.5 rounded-2xl shadow-xl flex items-center gap-3 pointer-events-auto border border-blue-400/30">
              <Activity size={15} />
              <span>{toastMsg}</span>
              <button onClick={() => setToastMsg(null)} className="ml-2 text-blue-200 hover:text-white transition-colors">
                <X size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Dynamic Page Views: 17 Complete Operational Pages */}
        <main className="flex-1 pt-16 overflow-y-auto">
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

          {/* Page 2: Dashboard (Operations Command Center) */}
          {activeTab === 'dashboard' && (
            <DashboardPage
              machines={machines}
              incidents={incidents}
              workOrders={workOrders}
              inventory={inventory}
              purchaseOrders={purchaseOrders}
              reviewItems={reviewItems}
              onSelectTab={setActiveTab}
              onRefresh={refreshAll}
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

          {/* Page 4: Machines Register */}
          {activeTab === 'machines' && (
            <div className="p-6">
              <MachinesView
                machines={machines}
                telemetryMap={telemetryMap}
                onSelectMachine={(m) => setSelectedMachine(m)}
                onNavigateTwin={() => setActiveTab('twin')}
              />
            </div>
          )}

          {/* Page 5: IoT Devices & Edge Network */}
          {activeTab === 'iot' && (
            <div className="p-6">
              <IoTDevicesView />
            </div>
          )}

          {/* Page 6: Telemetry Diagnostics */}
          {activeTab === 'telemetry' && (
            <div className="p-6">
              <TelemetryView
                machines={machines}
                telemetryMap={telemetryMap}
              />
            </div>
          )}

          {/* Page 7: Incidents Timeline */}
          {(activeTab === 'incidents' || activeTab === 'timeline') && (
            <div className="p-6">
              <IncidentTimeline incidents={incidents} onSelectMachine={handleSelectMachineByCode} />
            </div>
          )}

          {/* Page 8: Maintenance Planning & PM Schedules */}
          {activeTab === 'maintenance' && (
            <div className="p-6">
              <MaintenanceView
                workOrders={workOrders}
                onRefresh={refreshAll}
                onSelectMachine={handleSelectMachineByCode}
              />
            </div>
          )}

          {/* Page 9: Work Orders Dispatch & OSHA LOTO */}
          {activeTab === 'work-orders' && (
            <div className="p-6">
              <WorkOrdersView
                workOrders={workOrders}
                onRefresh={refreshAll}
                onSelectMachine={handleSelectMachineByCode}
              />
            </div>
          )}

          {/* Page 10: Technicians & Skills Matrix */}
          {activeTab === 'technicians' && (
            <div className="p-6">
              <TechniciansView />
            </div>
          )}

          {/* Page 11: Inventory & Available to Promise (ATP) */}
          {activeTab === 'inventory' && (
            <div className="p-6">
              <InventoryView inventory={inventory} />
            </div>
          )}

          {/* Page 12: Autonomous Procurement & POs */}
          {activeTab === 'procurement' && (
            <div className="p-6">
              <ProcurementView purchaseOrders={purchaseOrders} />
            </div>
          )}

          {/* Page 13: Suppliers & Vendor Directory */}
          {activeTab === 'suppliers' && (
            <div className="p-6">
              <SuppliersView />
            </div>
          )}

          {/* Page 14: Human Review Center */}
          {activeTab === 'review' && (
            <div className="p-6">
              <HumanReviewView reviewItems={reviewItems} onRefresh={refreshAll} />
            </div>
          )}

          {/* Page 15: AI Activity & Transparent Agent Ledger */}
          {activeTab === 'ai' && (
            <div className="p-6">
              <AIDiagnosisView />
            </div>
          )}

          {/* Page 16: Domo Analytics & Reports Center */}
          {activeTab === 'domo' && (
            <div className="p-6 space-y-8">
              <DomoAnalyticsView />
              <div className="pt-4 border-t border-[#DDD9D0]">
                <ReportsView />
              </div>
            </div>
          )}

          {/* Direct Reports View */}
          {activeTab === 'reports' && (
            <div className="p-6">
              <ReportsView />
            </div>
          )}

          {/* Page 17: Audit Trail & Settings */}
          {activeTab === 'settings' && (
            <div className="p-6">
              <SettingsView />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;

