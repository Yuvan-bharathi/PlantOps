import React, { useState, useEffect, useRef } from 'react';
import { 
  Boxes, Truck, Cpu, Activity, Play, Pause, RotateCcw, 
  CheckCircle2, ArrowRight, Gauge, Timer, Layers, QrCode, 
  Barcode, Radio, BatteryCharging, AlertTriangle, ChevronRight,
  TrendingUp, Zap, Sparkles, RefreshCw, Warehouse, ShieldCheck, Wrench,
  Search, X, Bot, Flame, Workflow, ArrowDown
} from 'lucide-react';
import { api, socket } from '../../services/api';
import { BatchToolingOptimizerModal } from './BatchToolingOptimizerModal';

export interface CNCProductionUnit {
  code: string;
  name: string;
  cycleTimeSec: number;
  currentCycleSec: number;
  piecesPerHour: number;
  targetPerHour: number;
  totalPiecesProduced: number;
  goodPieces: number;
  scrapPieces: number;
  spindleLoadPct: number;
  toolWearPct: number;
  status: 'RUNNING' | 'VERIFYING' | 'TOOL_CHANGE' | 'FAULT' | 'MAINTENANCE' | 'IDLE';
}

export interface RobotWeldingUnit {
  code: string;
  name: string;
  cycleTimeSec: number;
  currentCycleSec: number;
  weldsPerHour: number;
  totalWelded: number;
  shieldGasFlowLpm: number;
  arcTempCelsius: number;
  weldQualityPct: number;
  status: 'WELDING' | 'INDEXING' | 'FAULT' | 'MAINTENANCE' | 'IDLE';
}

export interface WipBufferState {
  machinedRawBuffer: number;
  robotInfeedBuffer: number;
  weldedOutfeedBuffer: number;
  packagingInfeedBuffer: number;
}

export interface PalletBatch {
  id: string;
  transportId?: string;
  palletNumber: string;
  rfidTag: string;
  piecesCount: number;
  cartonsCount: number;
  maxCartons: number;
  maxPieces: number;
  status: 'ACCUMULATING' | 'SEALED_READY' | 'LOADING' | 'IN_TRANSIT' | 'DELIVERED_DOCK' | 'LOADED_TRUCK' | 'DELIVERED_CUSTOMER';
  packedAt: string;
  destination: string;
  assignedAGV?: string;
}

export interface AGVVehicle {
  id: string;
  name: string;
  batteryPct: number;
  speedMps: number;
  currentPayload: string | null;
  currentLocation: string;
  destination: string;
  status: 'IDLE' | 'EN_ROUTE_PICKUP' | 'TRANSPORTING' | 'UNLOADING_DOCK';
  routeProgressPct: number;
}

interface ProductionLogisticsViewProps {
  onAddToast?: (toast: any) => void;
}

// Placeholder until the server allocates the real, unique pallet identity
function tempPalletIdentity() {
  const u = `${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`.toUpperCase();
  return { id: `TMP-${u}`, transportId: 'Allocating…', palletNumber: 'Allocating…', rfidTag: 'Allocating…' };
}

export const ProductionLogisticsView: React.FC<ProductionLogisticsViewProps> = ({ onAddToast }) => {
  const [isRunning, setIsRunning] = useState(true);
  const [freight, setFreight] = useState<{
    threshold: number;
    palletTonnes: number;
    dock: { count: number; tonnage: number; waitingForTruck: boolean };
    active: { id: string; truckId: string; destinationName: string; palletCount: number; tonnage: number; status: string }[];
    availableTrucks: number;
    inTransitToDock: number;
    next?: { truckId: string | null; palletsNeeded: number; estimatedSeconds: number | null; basis: string };
  } | null>(null);
  const agvAutoDispatchRef = useRef<string | null>(null);
  const [powerState, setPowerState] = useState<{ status: string; voltage: number; total_load_kw: number } | null>(null);
  const [cncSearchQuery, setCncSearchQuery] = useState('');
  const [robotSearchQuery, setRobotSearchQuery] = useState('');
  const [isBatchToolingModalOpen, setIsBatchToolingModalOpen] = useState(false);

  // Shopfloor WIP Inter-Cell Buffer Trackers
  const [wipBuffer, setWipBuffer] = useState<WipBufferState>({
    machinedRawBuffer: 48,
    robotInfeedBuffer: 24,
    weldedOutfeedBuffer: 36,
    packagingInfeedBuffer: 18
  });

  const handleToggleStream = async () => {
    const nextState = !isRunning;
    setIsRunning(nextState);
    try {
      const res = await api.toggleProductionStream(nextState);
      if (res && res.success) {
        onAddToast?.({
          type: 'INFO',
          title: nextState ? '▶️ Production Stream Resumed' : '⏸️ Production Stream Paused',
          subtitle: nextState ? 'Live 1-sec piece accumulator active' : 'Live stream paused at current piece counts',
          message: res.data?.message || `CNC piece rate & AGV simulator is now ${nextState ? 'active' : 'paused'}.`
        });
      }
    } catch (err: any) {
      console.error('Failed to toggle production stream:', err);
    }
  };

  // CNC Machine Piece Production Units (Machining Cell)
  const [cncUnits, setCncUnits] = useState<CNCProductionUnit[]>([
    {
      code: 'CNC-01',
      name: '5-Axis Spindle Mill 01',
      cycleTimeSec: 80,
      currentCycleSec: 52,
      piecesPerHour: 45.2,
      targetPerHour: 45.0,
      totalPiecesProduced: 362,
      goodPieces: 358,
      scrapPieces: 4,
      spindleLoadPct: 68,
      toolWearPct: 24,
      status: 'RUNNING'
    },
    {
      code: 'CNC-02',
      name: 'Heavy Duty Lathe 02',
      cycleTimeSec: 75,
      currentCycleSec: 18,
      piecesPerHour: 48.0,
      targetPerHour: 45.0,
      totalPiecesProduced: 384,
      goodPieces: 382,
      scrapPieces: 2,
      spindleLoadPct: 74,
      toolWearPct: 31,
      status: 'RUNNING'
    },
    {
      code: 'CNC-03',
      name: 'Precision Milling Center 03',
      cycleTimeSec: 82,
      currentCycleSec: 64,
      piecesPerHour: 43.9,
      targetPerHour: 45.0,
      totalPiecesProduced: 351,
      goodPieces: 349,
      scrapPieces: 2,
      spindleLoadPct: 62,
      toolWearPct: 18,
      status: 'RUNNING'
    },
    {
      code: 'CNC-04',
      name: '5-Axis Machining Center 04',
      cycleTimeSec: 78,
      currentCycleSec: 41,
      piecesPerHour: 46.1,
      targetPerHour: 45.0,
      totalPiecesProduced: 369,
      goodPieces: 366,
      scrapPieces: 3,
      spindleLoadPct: 71,
      toolWearPct: 42,
      status: 'RUNNING'
    },
    {
      code: 'CNC-05',
      name: 'High-Speed Mill 05',
      cycleTimeSec: 72,
      currentCycleSec: 35,
      piecesPerHour: 50.0,
      targetPerHour: 45.0,
      totalPiecesProduced: 400,
      goodPieces: 397,
      scrapPieces: 3,
      spindleLoadPct: 79,
      toolWearPct: 15,
      status: 'RUNNING'
    },
    {
      code: 'CNC-06',
      name: 'Ultra Lathe 06',
      cycleTimeSec: 85,
      currentCycleSec: 12,
      piecesPerHour: 42.3,
      targetPerHour: 45.0,
      totalPiecesProduced: 338,
      goodPieces: 335,
      scrapPieces: 3,
      spindleLoadPct: 65,
      toolWearPct: 29,
      status: 'RUNNING'
    }
  ]);

  // Robotic Welding & Assembly Units (Welding Cell)
  const [robotUnits, setRobotUnits] = useState<RobotWeldingUnit[]>([
    {
      code: 'ROBOT-01',
      name: '6-Axis Seam Welder 01',
      cycleTimeSec: 42,
      currentCycleSec: 28,
      weldsPerHour: 82.4,
      totalWelded: 658,
      shieldGasFlowLpm: 15.2,
      arcTempCelsius: 1420,
      weldQualityPct: 99.6,
      status: 'WELDING'
    },
    {
      code: 'ROBOT-02',
      name: '6-Axis Seam Welder 02',
      cycleTimeSec: 40,
      currentCycleSec: 14,
      weldsPerHour: 86.1,
      totalWelded: 689,
      shieldGasFlowLpm: 15.0,
      arcTempCelsius: 1435,
      weldQualityPct: 99.4,
      status: 'WELDING'
    },
    {
      code: 'ROBOT-03',
      name: 'Heavy Joint Robotic Cell 03',
      cycleTimeSec: 45,
      currentCycleSec: 39,
      weldsPerHour: 78.0,
      totalWelded: 624,
      shieldGasFlowLpm: 15.4,
      arcTempCelsius: 1410,
      weldQualityPct: 99.2,
      status: 'WELDING'
    },
    {
      code: 'ROBOT-04',
      name: 'Precision Laser-Arc Welder 04',
      cycleTimeSec: 38,
      currentCycleSec: 9,
      weldsPerHour: 91.5,
      totalWelded: 732,
      shieldGasFlowLpm: 14.8,
      arcTempCelsius: 1440,
      weldQualityPct: 99.8,
      status: 'WELDING'
    }
  ]);

  // Active Pallet Accumulator (Packaging Cell: 24 pcs / carton, 10 cartons = 240 pcs / pallet)
  const [currentPallet, setCurrentPallet] = useState<PalletBatch>(() => ({
    ...tempPalletIdentity(),
    piecesCount: 0,
    cartonsCount: 0,
    maxCartons: 10,
    maxPieces: 240,
    status: 'ACCUMULATING',
    packedAt: 'In progress',
    destination: 'Outbound Logistics Dock — Bay 02'
  }));

  // Completed Pallets Queue
  const [completedPallets, setCompletedPallets] = useState<PalletBatch[]>([]);

  // AGV / Forklift Fleet Status (Autonomous Inter-cell & Outbound transport)
  const [agvFleet, setAgvFleet] = useState<AGVVehicle[]>([
    {
      id: 'FORKLIFT-01',
      name: 'Autonomous Inter-Cell Forklift',
      batteryPct: 82,
      speedMps: 0.9,
      currentPayload: 'Raw Machined Batch (12 pcs)',
      currentLocation: 'CNC Output Buffer ↔ Robot Infeed',
      destination: 'Robot Welding Station Infeed B-02',
      status: 'TRANSPORTING',
      routeProgressPct: 45
    },
    {
      id: 'AGV-01',
      name: 'Automated Guided Vehicle 01',
      batteryPct: 88,
      speedMps: 0,
      currentPayload: null,
      currentLocation: 'Packaging Cell Staging Track',
      destination: 'Ready for Next Dispatched Pallet',
      status: 'IDLE',
      routeProgressPct: 0
    },
    {
      id: 'AGV-02',
      name: 'Automated Guided Vehicle 02',
      batteryPct: 94,
      speedMps: 1.4,
      currentPayload: null,
      currentLocation: 'Packaging Dispatch Bay',
      destination: 'Ready for Next Dispatched Pallet',
      status: 'IDLE',
      routeProgressPct: 100
    }
  ]);

  const fleetCleanupRef = useRef<(() => void) | null>(null);

  // Replace a temporary identity with one from the server sequence (keeps the pieces already packed)
  const allocateIdentityFor = (tempId: string) =>
    api.allocatePallet().then((res) => {
      if (!res?.success || !res.data) return;
      const idn = res.data;
      setCurrentPallet((prev) =>
        prev.id === tempId ? { ...prev, id: idn.id, palletNumber: idn.palletNumber, transportId: idn.transportId, rfidTag: idn.rfidTag } : prev
      );
    }).catch(() => {});

  useEffect(() => {
    allocateIdentityFor(currentPallet.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDbPallets = () =>
    api.getLogisticsPallets({ limit: 10 }).then((res) => {
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        setCompletedPallets(
          res.data.map((p: any) => ({
            id: p.id,
            transportId: p.transport_id || `TRP-2026-${p.id.slice(-4)}`,
            palletNumber: p.pallet_number,
            rfidTag: p.rfid_tag,
            piecesCount: p.pieces_count || 240,
            cartonsCount: p.cartons_count || 10,
            maxCartons: p.max_pieces ? Math.floor(p.max_pieces / 24) : 10,
            maxPieces: p.max_pieces || 240,
            status: p.status || 'DELIVERED_DOCK',
            packedAt: p.packed_at || 'Today',
            destination: p.destination_bay || 'Outbound Logistics Dock',
            assignedAGV: p.assigned_agv || 'AGV-01',
          }))
        );
      }
    }).catch(() => {});

  const loadFreight = () =>
    api.getFleetState().then((res) => {
      if (!res?.success || !res.data) return;
      const d = res.data;
      setFreight({
        threshold: d.config.freightThresholdPallets,
        palletTonnes: d.config.palletTonnes,
        dock: { count: d.dock.count, tonnage: d.dock.tonnage, waitingForTruck: d.dock.waitingForTruck },
        active: d.activeDispatches,
        availableTrucks: d.trucks.filter((t: any) => t.status === 'AVAILABLE').length,
        inTransitToDock: d.dock.inTransitToDock ?? 0,
        next: d.nextDispatch,
      });
    }).catch(() => {});

  // Load live machines and database pallets from Backend + Live Polling Sync
  useEffect(() => {
    const fetchLiveMachines = async () => {
      try {
        const [machRes, powRes] = await Promise.all([
          api.getMachines(),
          api.getPowerStatus()
        ]);
        const currentPower = powRes?.data?.plant || powRes?.data || null;
        setPowerState(currentPower);

        const isPowerHalted = currentPower?.status === 'ESTOP' || currentPower?.status === 'OFF';

        if (machRes && machRes.success && machRes.data && machRes.data.length > 0) {
          const machines: any[] = machRes.data;

          // Sync CNC Milling Centers
          const cncMachines = machines.filter((m: any) => m.code.startsWith('CNC') || m.area?.toLowerCase().includes('machining'));
          if (cncMachines.length > 0) {
            setCncUnits(prev => cncMachines.map((m: any, idx: number) => {
              const existing = prev.find(p => p.code === m.code);
              const isFault = m.status === 'FAULT' || m.status === 'OFFLINE' || m.status === 'CRITICAL';
              const isMaint = m.status === 'MAINTENANCE' || m.status === 'LOTO' || m.status === 'INSPECTING';
              const isVerifying = m.status === 'VERIFYING';
              const isUnitOff = m.status === 'OFF' || isPowerHalted;
              const unitStatus = isFault ? 'FAULT' : isMaint ? 'MAINTENANCE' : isVerifying ? 'VERIFYING' : isUnitOff ? 'IDLE' : 'RUNNING';

              return {
                code: m.code,
                name: m.name || `${m.code} Production Center`,
                cycleTimeSec: existing?.cycleTimeSec || (75 + (idx % 4) * 3),
                currentCycleSec: unitStatus === 'RUNNING' ? (existing?.currentCycleSec ?? Math.floor(Math.random() * 30)) : 0,
                piecesPerHour: unitStatus === 'RUNNING' ? (existing?.piecesPerHour || (m.health_score > 90 ? 46.5 : 42.0)) : 0,
                targetPerHour: 45.0,
                totalPiecesProduced: existing?.totalPiecesProduced ?? Math.round(340 + (m.health_score || 95) * 0.5),
                goodPieces: existing?.goodPieces ?? Math.round((340 + (m.health_score || 95) * 0.5) * 0.99),
                scrapPieces: existing?.scrapPieces ?? Math.round((340 + (m.health_score || 95) * 0.5) * 0.01),
                spindleLoadPct: unitStatus === 'RUNNING' ? Math.round(60 + (idx * 5) % 25) : 0,
                toolWearPct: existing?.toolWearPct || Math.round(15 + (idx * 8) % 35),
                status: unitStatus
              };
            }));
          }

          // Sync Robotic Welding Cells
          const robotMachines = machines.filter((m: any) => m.code.startsWith('ROBOT') || m.type === 'ROBOT' || m.area?.toLowerCase().includes('robot'));
          if (robotMachines.length > 0) {
            setRobotUnits(prev => robotMachines.slice(0, 4).map((m: any, idx: number) => {
              const existing = prev.find(p => p.code === m.code);
              const isFault = m.status === 'FAULT' || m.status === 'OFFLINE' || m.status === 'CRITICAL';
              const isMaint = m.status === 'MAINTENANCE' || m.status === 'LOTO' || m.status === 'INSPECTING';
              const isRobotOff = m.status === 'OFF' || isPowerHalted;
              const unitStatus = isFault ? 'FAULT' : isMaint ? 'MAINTENANCE' : isRobotOff ? 'IDLE' : 'WELDING';

              return {
                code: m.code,
                name: m.name || `6-Axis Seam Welder 0${idx + 1}`,
                cycleTimeSec: existing?.cycleTimeSec || (40 + idx * 2),
                currentCycleSec: unitStatus === 'WELDING' ? (existing?.currentCycleSec ?? 15) : 0,
                weldsPerHour: unitStatus === 'WELDING' ? (existing?.weldsPerHour || 84.0) : 0,
                totalWelded: existing?.totalWelded ?? (600 + idx * 40),
                shieldGasFlowLpm: unitStatus === 'WELDING' ? 15.2 : 0,
                arcTempCelsius: unitStatus === 'WELDING' ? 1420 : 25,
                weldQualityPct: existing?.weldQualityPct || 99.5,
                status: unitStatus
              };
            }));
          }
        }
      } catch (err) {
        console.warn('Could not load live machines/power for logistics:', err);
      }
    };

    fetchLiveMachines();
    const pollInterval = setInterval(fetchLiveMachines, 3000);

    // Load persisted pallet & transport missions from database
    loadDbPallets();
    loadFreight();
    const freightPoll = setInterval(loadFreight, 10000);
    const onFleet = () => {
      loadFreight();
      loadDbPallets();
    };
    const onDispatched = (d: any) =>
      onAddToast?.({
        type: 'DISPATCH',
        title: `🚛 Freight dispatched: ${d.truckId} → ${d.destinationName}`,
        subtitle: `${d.id} • ${d.palletCount} pallets • ${d.tonnage} t`,
        message: `Dock reached the ${d.palletCount}-pallet threshold. Track it live in Live Fleet Tracking.`,
      });
    socket.on('fleet:updated', onFleet);
    socket.on('fleet:dispatched', onDispatched);
    fleetCleanupRef.current = () => {
      clearInterval(freightPoll);
      socket.off('fleet:updated', onFleet);
      socket.off('fleet:dispatched', onDispatched);
    };

    api.getLogisticsPallets({ limit: 10 }).then((res) => {
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        const dbPallets: PalletBatch[] = res.data.map((p: any) => ({
          id: p.id,
          transportId: p.transport_id || `TRP-2026-${p.id.slice(-4)}`,
          palletNumber: p.pallet_number,
          rfidTag: p.rfid_tag,
          piecesCount: p.pieces_count || 240,
          cartonsCount: p.cartons_count || 10,
          maxCartons: p.max_pieces ? Math.floor(p.max_pieces / 24) : 10,
          maxPieces: p.max_pieces || 240,
          status: p.status || 'DELIVERED_DOCK',
          packedAt: p.packed_at || 'Today',
          destination: p.destination_bay || 'Outbound Logistics Dock',
          assignedAGV: p.assigned_agv || 'AGV-01'
        }));
        setCompletedPallets(dbPallets);
      }
    }).catch(err => console.warn('Could not load DB pallets:', err));

    api.getProductionStreamStatus().then((res) => {
      if (res && res.success && res.data) {
        setIsRunning(res.data.isRunning);
      }
    }).catch(() => {});

    socket.on('power:started', fetchLiveMachines);
    socket.on('power:stopped', fetchLiveMachines);
    socket.on('power:estop', fetchLiveMachines);
    socket.on('power:status_changed', fetchLiveMachines);
    socket.on('machine:status_changed', fetchLiveMachines);

    return () => {
      clearInterval(pollInterval);
      fleetCleanupRef.current?.();
      socket.off('power:started', fetchLiveMachines);
      socket.off('power:stopped', fetchLiveMachines);
      socket.off('power:estop', fetchLiveMachines);
      socket.off('power:status_changed', fetchLiveMachines);
      socket.off('machine:status_changed', fetchLiveMachines);
    };
  }, []);

  // Real-time 4-Stage Simulation Engine (Production halts when machine is faulted / in maintenance / power off)
  useEffect(() => {
    const isPowerHalted = powerState?.status === 'ESTOP' || powerState?.status === 'OFF';
    if (!isRunning || isPowerHalted) return;

    const interval = setInterval(() => {
      let newMachinedParts = 0;

      // ── STAGE 1: CNC Machining Cell (Milling & Lathes) ──
      setCncUnits(prevUnits => 
        prevUnits.map(unit => {
          // If machine is FAULT, MAINTENANCE, or IDLE, halt piece production!
          if (unit.status !== 'RUNNING') {
            return { ...unit, piecesPerHour: 0 };
          }

          const nextCycle = unit.currentCycleSec + 1;
          if (nextCycle >= unit.cycleTimeSec) {
            newMachinedParts += 1;
            return {
              ...unit,
              currentCycleSec: 0,
              totalPiecesProduced: unit.totalPiecesProduced + 1,
              goodPieces: unit.goodPieces + 1,
              piecesPerHour: parseFloat(((unit.piecesPerHour * 0.95) + 47.5 * 0.05).toFixed(1))
            };
          }
          return { ...unit, currentCycleSec: nextCycle };
        })
      );

      // ── STAGE 3: Robotic Welding & Assembly Cell ──
      let newWeldedParts = 0;
      setRobotUnits(prevRobots =>
        prevRobots.map(robot => {
          // If robot is FAULT, MAINTENANCE, or IDLE, halt weld production!
          if (robot.status !== 'WELDING') {
            return { ...robot, weldsPerHour: 0 };
          }

          const nextCycle = robot.currentCycleSec + 1;
          if (nextCycle >= robot.cycleTimeSec) {
            newWeldedParts += 1;
            return {
              ...robot,
              currentCycleSec: 0,
              totalWelded: robot.totalWelded + 1,
              weldsPerHour: parseFloat(((robot.weldsPerHour * 0.96) + 84.0 * 0.04).toFixed(1))
            };
          }
          return { ...robot, currentCycleSec: nextCycle };
        })
      );

      // ── STAGE 2 & 4: Inter-Cell WIP Buffer Flow & Packaging Staging ──
      setWipBuffer(prev => {
        const updatedRaw = prev.machinedRawBuffer + newMachinedParts;
        const updatedRobotInfeed = Math.max(0, prev.robotInfeedBuffer - (newWeldedParts > 0 ? newWeldedParts : 0));
        const updatedWelded = prev.weldedOutfeedBuffer + newWeldedParts;
        return {
          ...prev,
          machinedRawBuffer: updatedRaw,
          robotInfeedBuffer: updatedRobotInfeed,
          weldedOutfeedBuffer: updatedWelded
        };
      });

      // ── STAGE 4: Case Packaging Accumulator (24 pcs / carton -> 240 pcs / pallet) ──
      setCurrentPallet(prev => {
        if (prev.status === 'ACCUMULATING' && prev.piecesCount < prev.maxPieces) {
          const newPieces = prev.piecesCount + 1;
          const newCartons = Math.min(10, Math.floor(newPieces / 24));
          if (newPieces >= prev.maxPieces) {
            // Pallet completed! Auto-seal ready for dispatch
            return {
              ...prev,
              piecesCount: prev.maxPieces,
              cartonsCount: prev.maxCartons,
              status: 'SEALED_READY'
            };
          }
          return { ...prev, piecesCount: newPieces, cartonsCount: newCartons };
        }
        return prev;
      });

      // ── Autonomous Vehicles: Forklift (WIP Inter-Cell) & AGVs (Dock Transport) ──
      setAgvFleet(prevFleet => {
        return prevFleet.map(veh => {
          // 1. FORKLIFT-01: Inter-Cell WIP Transporter
          if (veh.id === 'FORKLIFT-01') {
            const nextProg = veh.routeProgressPct >= 100 ? 0 : veh.routeProgressPct + 4;
            const liveSpeed = parseFloat((0.8 + Math.random() * 0.2).toFixed(1));

            if (nextProg >= 100) {
              // Batch delivered to Robot cell infeed!
              setWipBuffer(w => ({
                ...w,
                machinedRawBuffer: Math.max(0, w.machinedRawBuffer - 6),
                robotInfeedBuffer: w.robotInfeedBuffer + 6
              }));
              return {
                ...veh,
                routeProgressPct: 0,
                speedMps: liveSpeed,
                status: 'TRANSPORTING',
                currentPayload: 'Raw Machined Batch (12 pcs)',
                currentLocation: 'CNC Buffer → Robot Infeed Track',
                destination: 'Robot Welding Station Infeed B-02'
              };
            }
            return { ...veh, routeProgressPct: nextProg, speedMps: liveSpeed };
          }

          // 2. AGV Fleet (AGV-01 & AGV-02): Finished Pallet Dock Carriers
          if (veh.status === 'TRANSPORTING') {
            const nextProg = veh.routeProgressPct + 2;
            const liveSpeed = parseFloat((1.1 + Math.random() * 0.3).toFixed(1));
            const liveBattery = Math.max(20, veh.batteryPct - (Math.random() > 0.7 ? 1 : 0));

            if (nextProg >= 100) {
              return {
                ...veh,
                routeProgressPct: 100,
                speedMps: 0.6,
                status: 'UNLOADING_DOCK',
                currentLocation: veh.destination,
                batteryPct: liveBattery
              };
            }
            return { ...veh, routeProgressPct: nextProg, speedMps: liveSpeed, batteryPct: liveBattery };
          }

          if (veh.status === 'UNLOADING_DOCK') {
            const nextProg = veh.routeProgressPct >= 100 ? 100 : veh.routeProgressPct + 3;

            if (nextProg >= 100) {
              const payloadPalletNum = veh.currentPayload ? veh.currentPayload.split(' ')[0] : '';
              if (payloadPalletNum) {
                setCompletedPallets(prevPals =>
                  prevPals.map(p =>
                    p.palletNumber === payloadPalletNum ? { ...p, status: 'DELIVERED_DOCK' } : p
                  )
                );
                api.updatePalletStatus(payloadPalletNum, 'DELIVERED_DOCK').catch(() => {});
              }

              return {
                ...veh,
                routeProgressPct: 0,
                speedMps: 1.4,
                status: 'EN_ROUTE_PICKUP',
                currentPayload: null,
                currentLocation: 'Outbound Logistics Dock',
                destination: 'Packaging Cell Return Track'
              };
            }
            return { ...veh, routeProgressPct: nextProg };
          }

          if (veh.status === 'EN_ROUTE_PICKUP') {
            const nextProg = veh.routeProgressPct + 3;
            const liveSpeed = parseFloat((1.3 + Math.random() * 0.2).toFixed(1));
            if (nextProg >= 100) {
              return {
                ...veh,
                routeProgressPct: 100,
                speedMps: 0,
                status: 'IDLE',
                currentLocation: 'Packaging Cell Staging Track',
                destination: 'Ready for Next Dispatched Pallet'
              };
            }
            return { ...veh, routeProgressPct: nextProg, speedMps: liveSpeed };
          }

          return { ...veh, speedMps: 0 };
        });
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, powerState]);

  useEffect(() => {
    if (currentPallet.status !== 'SEALED_READY' || currentPallet.id.startsWith('TMP-')) return;
    if (!agvFleet.some((a) => a.status === 'IDLE')) return;
    if (agvAutoDispatchRef.current === currentPallet.palletNumber) return;
    agvAutoDispatchRef.current = currentPallet.palletNumber;
    handleDispatchPallet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPallet.status, currentPallet.id, agvFleet]);

  // Manual Trigger or Auto-Seal: Dispatch Pallet to AGV Fleet (Persisted in DB)
  const handleDispatchPallet = async () => {
    const newPallet: PalletBatch = {
      ...tempPalletIdentity(),
      piecesCount: 0,
      cartonsCount: 0,
      maxCartons: 10,
      maxPieces: 240,
      status: 'ACCUMULATING',
      packedAt: 'Just Now',
      destination: `Outbound Logistics Dock — Bay 0${(completedPallets.length % 3) + 1}`
    };

    // Find available or least busy AGV
    const targetAgvId = agvFleet.find(a => a.status === 'IDLE')?.id || 'AGV-02';

    const dispatchedPallet: PalletBatch = {
      ...currentPallet,
      status: 'IN_TRANSIT',
      assignedAGV: targetAgvId
    };

    setCompletedPallets(prev => [dispatchedPallet, ...prev.slice(0, 6)]);
    setCurrentPallet(newPallet);
    allocateIdentityFor(newPallet.id);

    // Assign AGV to transport
    setAgvFleet(prev => prev.map(agv => 
      agv.id === targetAgvId 
        ? { 
            ...agv, 
            status: 'TRANSPORTING', 
            currentPayload: `${currentPallet.palletNumber} (${currentPallet.piecesCount} pcs)`, 
            routeProgressPct: 5,
            currentLocation: 'Packaging Dispatch Station',
            destination: currentPallet.destination || 'Outbound Logistics Dock — Bay 02'
          } 
        : agv
    ));

    // Save to DB & broadcast AI Intercom event
    try {
      const saved = await api.dispatchPalletMission({
        id: currentPallet.id,
        transport_id: currentPallet.transportId,
        pallet_number: currentPallet.palletNumber,
        rfid_tag: currentPallet.rfidTag,
        pieces_count: currentPallet.piecesCount,
        cartons_count: currentPallet.cartonsCount,
        max_pieces: currentPallet.maxPieces,
        assigned_agv: targetAgvId,
        destination_bay: currentPallet.destination || 'Outbound Bay 02',
        packed_at: currentPallet.packedAt
      });
      const finalNum: string | undefined = saved?.data?.pallet_number;
      if (finalNum && finalNum !== currentPallet.palletNumber) {
        setCompletedPallets(prev => prev.map(p => p.id === currentPallet.id ? { ...p, id: saved.data.id, palletNumber: finalNum, transportId: saved.data.transport_id, rfidTag: saved.data.rfid_tag } : p));
        setAgvFleet(prev => prev.map(a => a.currentPayload?.startsWith(currentPallet.palletNumber) ? { ...a, currentPayload: `${finalNum} (${currentPallet.piecesCount} pcs)` } : a));
      }
      onAddToast?.({
        type: 'AI_AGENT',
        title: `🚚 ${finalNum || currentPallet.palletNumber} Dispatched`,
        subtitle: `Mission: ${currentPallet.transportId || 'TRP-2026-AUTO'} • Carrier: ${targetAgvId}`,
        message: `Pallet manifest stored in DB. ${targetAgvId} en route to ${currentPallet.destination}.`
      });
    } catch (e) {
      console.warn('Pallet dispatch DB warning:', e);
    }
  };

  // Plant Summary Totals
  const totalProduced = cncUnits.reduce((acc, u) => acc + u.totalPiecesProduced, 0);
  const totalGood = cncUnits.reduce((acc, u) => acc + u.goodPieces, 0);
  const totalScrap = cncUnits.reduce((acc, u) => acc + u.scrapPieces, 0);
  const avgHourlyRate = (cncUnits.reduce((acc, u) => acc + u.piecesPerHour, 0) / cncUnits.length).toFixed(1);
  const yieldPct = ((totalGood / (totalProduced || 1)) * 100).toFixed(1);

  const filteredCncUnits = cncUnits.filter(u => {
    const q = cncSearchQuery.trim().toLowerCase();
    if (!q) return true;
    return u.code.toLowerCase().includes(q) || u.name.toLowerCase().includes(q) || u.status.toLowerCase().includes(q);
  });

  const filteredRobotUnits = robotUnits.filter(u => {
    const q = robotSearchQuery.trim().toLowerCase();
    if (!q) return true;
    return u.code.toLowerCase().includes(q) || u.name.toLowerCase().includes(q) || u.status.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 w-full">
      {/* ── Top Header ── */}
      <div className="bg-[#FAF9F6] p-5 rounded-2xl border border-[#DDD9D0] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/20">
              4-Stage Discrete Manufacturing & Logistics
            </span>
            <span className="text-xs text-[#64748B] font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              CNC &bull; Forklift WIP &bull; Robot Welding &bull; Packaging &bull; AGV Fleet
            </span>
          </div>
          <h2 className="text-lg font-bold text-[#1E293B] flex items-center gap-2.5 mt-1.5">
            <div className="w-8 h-8 rounded-lg bg-[#2563EB]/10 border border-[#2563EB]/20 flex items-center justify-center text-[#2563EB]">
              <Workflow className="w-4 h-4" />
            </div>
            CNC Piece Production, Packaging Count & AGV Transportation
          </h2>
          <p className="text-xs text-[#64748B] mt-1">
            Real-time shopfloor flow: CNC milling &rarr; Forklift WIP transmission &rarr; 6-Axis Robotic seam welding &rarr; Case packaging (240 pcs/pallet) &rarr; AGV dispatch to logistics docks.
          </p>
        </div>

        {/* Play/Pause Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleToggleStream}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer ${
              isRunning 
                ? 'bg-amber-500 hover:bg-amber-600 text-white' 
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {isRunning ? <><Pause size={14} /> Pause Stream</> : <><Play size={14} /> Resume Stream</>}
          </button>
        </div>
      </div>

      {/* ── Real-Time Power State Safety Interlock Banner ── */}
      {powerState?.status === 'ESTOP' && (
        <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold shrink-0">
              <AlertTriangle size={18} />
            </div>
            <div>
              <div className="text-xs font-black text-rose-900 flex items-center gap-2">
                <span>EMERGENCY E-STOP ACTIVATED &bull; MAIN SUBSTATION SHUTDOWN (0.0V AC)</span>
                <span className="bg-rose-600 text-white text-[9px] font-mono px-2 py-0.5 rounded font-extrabold">
                  ZERO-ENERGY HOLD
                </span>
              </div>
              <p className="text-[11px] text-rose-700 mt-0.5">
                All 6 CNC Spindles, 4 Robotic Welders, Packaging Accumulators, and AGV Fleet are in safety interlock holding mode. Reset E-Stop at Substation Cell to resume.
              </p>
            </div>
          </div>
          <span className="font-mono text-xs font-black text-rose-700 bg-white border border-rose-200 px-3 py-1.5 rounded-lg shrink-0">
            0 kW LOAD &bull; TRIP ENGAGED
          </span>
        </div>
      )}

      {powerState?.status === 'OFF' && (
        <div className="bg-slate-100 border border-slate-300 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-700 text-white flex items-center justify-center font-bold shrink-0">
              <Zap size={18} />
            </div>
            <div>
              <div className="text-xs font-black text-slate-900 flex items-center gap-2">
                <span>PLANT POWER DE-ENERGIZED (0.0V AC)</span>
                <span className="bg-slate-600 text-white text-[9px] font-mono px-2 py-0.5 rounded font-extrabold">
                  STANDBY
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Distribution MCC breakers open. Production cycle clocks and AGV missions held on standby.
              </p>
            </div>
          </div>
          <span className="font-mono text-xs font-black text-slate-700 bg-white border border-slate-300 px-3 py-1.5 rounded-lg shrink-0">
            0 kW LOAD &bull; POWER OFF
          </span>
        </div>
      )}

      {/* ── 4-Stage Visual Shopfloor Pipeline Tracker ── */}
      <div className="bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-[#1E293B] flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-[#2563EB]" /> Live Shopfloor Inter-Cell Transmission Pipeline
          </span>
          <span className="text-[10px] font-mono text-[#64748B]">Autonomous Material Transport Sync</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 relative">
          {/* Stage 1: CNC Machining */}
          <div className="bg-white p-3 rounded-xl border border-blue-200 shadow-xs relative overflow-hidden">
            <div className="absolute top-0 left-0 h-1 bg-blue-600 w-full" />
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="font-extrabold text-blue-700 uppercase tracking-wider text-[9px]">Stage 1: Machining</span>
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
            </div>
            <div className="text-xs font-bold text-[#1E293B]">CNC Precision Milling</div>
            <div className="text-[11px] text-[#64748B] mt-0.5">CNC-01 to CNC-06 Output</div>
            <div className="mt-2 text-[10px] font-mono font-bold bg-blue-50 text-blue-800 p-1.5 rounded flex items-center justify-between">
              <span>Machined Buffer:</span>
              <span className="text-xs font-black">{wipBuffer.machinedRawBuffer} pcs</span>
            </div>
          </div>

          {/* Stage 2: Forklift Transfer */}
          <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-xs relative overflow-hidden">
            <div className="absolute top-0 left-0 h-1 bg-amber-500 w-full" />
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="font-extrabold text-amber-700 uppercase tracking-wider text-[9px]">Stage 2: WIP Shuttle</span>
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            </div>
            <div className="text-xs font-bold text-[#1E293B]">Forklift WIP Transmit</div>
            <div className="text-[11px] text-[#64748B] mt-0.5">FORKLIFT-01 (Inter-Cell)</div>
            <div className="mt-2 text-[10px] font-mono font-bold bg-amber-50 text-amber-800 p-1.5 rounded flex items-center justify-between">
              <span>Robot Infeed:</span>
              <span className="text-xs font-black">{wipBuffer.robotInfeedBuffer} pcs</span>
            </div>
          </div>

          {/* Stage 3: Robotic Welding */}
          <div className="bg-white p-3 rounded-xl border border-purple-200 shadow-xs relative overflow-hidden">
            <div className="absolute top-0 left-0 h-1 bg-purple-600 w-full" />
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="font-extrabold text-purple-700 uppercase tracking-wider text-[9px]">Stage 3: Assembly</span>
              <span className="w-2 h-2 rounded-full bg-purple-600 animate-ping" />
            </div>
            <div className="text-xs font-bold text-[#1E293B]">6-Axis Arc Welding</div>
            <div className="text-[11px] text-[#64748B] mt-0.5">ROBOT-01 to ROBOT-04</div>
            <div className="mt-2 text-[10px] font-mono font-bold bg-purple-50 text-purple-800 p-1.5 rounded flex items-center justify-between">
              <span>Welded Outfeed:</span>
              <span className="text-xs font-black">{wipBuffer.weldedOutfeedBuffer} pcs</span>
            </div>
          </div>

          {/* Stage 4: Packaging & AGV Logistics */}
          <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-xs relative overflow-hidden">
            <div className="absolute top-0 left-0 h-1 bg-emerald-600 w-full" />
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="font-extrabold text-emerald-700 uppercase tracking-wider text-[9px]">Stage 4: Dispatch</span>
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            </div>
            <div className="text-xs font-bold text-[#1E293B]">Case Packing & AGVs</div>
            <div className="text-[11px] text-[#64748B] mt-0.5">AGV-01 & AGV-02 Dock Fleet</div>
            <div className="mt-2 text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 p-1.5 rounded flex items-center justify-between">
              <span>Pallet Progress:</span>
              <span className="text-xs font-black">{currentPallet.piecesCount}/240 pcs</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Stream Overview ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-bold text-[#64748B] mb-1">Average CNC Output Rate</div>
          <div className="text-2xl font-black text-[#1E293B] font-mono">{avgHourlyRate} pcs/hr</div>
          <div className="text-[11px] text-[#22A06B] font-medium mt-1">↑ Target: 45.0 pcs/hr per mill (+3.4%)</div>
        </div>

        <div className="bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-bold text-[#64748B] mb-1">Total Shift Production</div>
          <div className="text-2xl font-black text-[#1E293B] font-mono">{totalProduced.toLocaleString()} pcs</div>
          <div className="text-[11px] text-[#2563EB] font-medium mt-1">First-pass quality yield: {yieldPct}%</div>
        </div>

        <div className="bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-bold text-[#64748B] mb-1">Packaging Batch Accumulator</div>
          <div className="text-2xl font-black text-[#1E293B] font-mono">
            {currentPallet.piecesCount} / {currentPallet.maxPieces} pcs
          </div>
          <div className="text-[11px] text-[#D99A06] font-medium mt-1">
            {currentPallet.cartonsCount} of {currentPallet.maxCartons} cartons stacked
          </div>
        </div>

        <div className="bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-bold text-[#64748B] mb-1">AGV Fleet Status</div>
          <div className="text-2xl font-black text-emerald-700 font-mono">
            {agvFleet.filter(a => a.status !== 'IDLE').length} Active / {agvFleet.length} Total
          </div>
          <div className="text-[11px] text-[#0F766E] font-medium mt-1">
            Autonomous fleet online &bull; Logistics Dock Bays 1-3
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* SECTION 1: CNC MACHINING CELL (Hourly Piece Rate & Spindle Load) */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DDD9D0] pb-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#2563EB]" />
            <h3 className="text-sm font-bold text-[#1E293B]">
              CNC Machining Cell: Production Rate & Part Counters ({filteredCncUnits.length}/6 Milling Centers)
            </h3>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Active Search Bar */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
              <input
                type="text"
                placeholder="Search mill code, name..."
                value={cncSearchQuery}
                onChange={(e) => setCncSearchQuery(e.target.value)}
                className="pl-8 pr-7 py-1 text-xs bg-white border border-[#DDD9D0] rounded-xl text-[#1E293B] placeholder:text-[#64748B] focus:outline-none focus:border-[#2563EB] w-44 shadow-2xs"
              />
              {cncSearchQuery && (
                <button
                  onClick={() => setCncSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Batch Tooling Optimizer Button */}
            <button
              onClick={() => setIsBatchToolingModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer group"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300 group-hover:scale-110 transition-transform" />
              <span>Batch Tooling Optimizer</span>
              <span className="px-1.5 py-0.2 rounded-full bg-blue-900/60 text-[10px] font-mono text-amber-200">
                3 Due
              </span>
            </button>

            <span className="text-xs font-mono font-bold text-[#2563EB] bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
              Target Cycle: 75-85 sec/part
            </span>
          </div>
        </div>

        {/* Empty Search Fallback */}
        {filteredCncUnits.length === 0 && (
          <div className="text-center py-8 bg-white rounded-xl border border-dashed border-[#DDD9D0] text-slate-500">
            <Search className="w-6 h-6 mx-auto text-slate-400 mb-1.5 opacity-60" />
            <p className="text-xs font-bold text-slate-700">No matching CNC milling units found</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Try searching for "CNC-01", "Spindle", or clear search.</p>
            <button
              onClick={() => setCncSearchQuery('')}
              className="mt-2.5 px-2.5 py-1 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md cursor-pointer"
            >
              Clear Search
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredCncUnits.map(unit => {
            const cycleProgress = (unit.currentCycleSec / unit.cycleTimeSec) * 100;
            return (
              <div 
                key={unit.code}
                className="bg-white p-4 rounded-xl border border-[#DDD9D0] hover:border-[#2563EB] transition-all shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between gap-1.5 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
                    <span className={`text-xs font-mono font-extrabold px-1.5 py-0.5 rounded shrink-0 ${
                      unit.status === 'FAULT'
                        ? 'bg-rose-100 text-rose-700'
                        : unit.status === 'MAINTENANCE'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-[#EAE7E0] text-[#2563EB]'
                    }`}>
                      {unit.code}
                    </span>
                    <span className="text-xs font-bold text-[#1E293B] truncate min-w-0" title={unit.name}>
                      {unit.name}
                    </span>
                  </div>
                  
                  {unit.status === 'RUNNING' && (
                    <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      RUNNING
                    </span>
                  )}
                  {unit.status === 'VERIFYING' && (
                    <span className="text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0 animate-pulse">
                      <Activity className="w-3 h-3 text-purple-700" />
                      VERIFYING
                    </span>
                  )}
                  {unit.status === 'FAULT' && (
                    <span className="text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-300 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0 animate-pulse">
                      <AlertTriangle className="w-3 h-3 text-rose-600" />
                      FAULT
                    </span>
                  )}
                  {unit.status === 'MAINTENANCE' && (
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0">
                      <Wrench className="w-3 h-3 text-amber-700" />
                      MAINT
                    </span>
                  )}
                  {unit.status === 'IDLE' && (
                    <span className="text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300 px-1.5 py-0.5 rounded shrink-0">
                      IDLE
                    </span>
                  )}
                </div>

                {/* Piece Rate Metrics */}
                <div className={`grid grid-cols-2 gap-2 p-2.5 rounded-xl border ${
                  unit.status === 'FAULT'
                    ? 'bg-rose-50/70 border-rose-200'
                    : unit.status === 'MAINTENANCE'
                    ? 'bg-amber-50/70 border-amber-200'
                    : 'bg-[#FAF9F6] border-[#DDD9D0]'
                }`}>
                  <div>
                    <div className="text-[10px] font-bold text-[#64748B] uppercase">Production Rate</div>
                    <div className={`text-base font-black font-mono ${
                      unit.status !== 'RUNNING' ? 'text-rose-600' : 'text-[#1E293B]'
                    }`}>
                      {unit.status === 'RUNNING' ? unit.piecesPerHour : '0.0'}{' '}
                      <span className="text-xs font-normal text-[#64748B]">pcs/hr</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-[#64748B] uppercase">Shift Output</div>
                    <div className="text-base font-black text-[#2563EB] font-mono">
                      {unit.totalPiecesProduced} <span className="text-xs font-normal text-[#64748B]">parts</span>
                    </div>
                  </div>
                </div>

                {/* Active Cutting Cycle Progress */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#64748B] font-medium flex items-center gap-1">
                      <Timer size={12} className={unit.status === 'FAULT' ? 'text-rose-600' : 'text-[#2563EB]'} />{' '}
                      {unit.status === 'RUNNING' ? 'Cutting Cycle Time' : 'Cutting Cycle Halted'}
                    </span>
                    <span className="font-mono font-bold text-[#1E293B]">
                      {unit.status === 'RUNNING' ? `${unit.currentCycleSec}s / ${unit.cycleTimeSec}s` : 'PAUSED (0s)'}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#EAE7E0] rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        unit.status === 'FAULT' ? 'bg-rose-500' : unit.status === 'MAINTENANCE' ? 'bg-amber-500' : 'bg-[#2563EB]'
                      }`}
                      style={{ width: `${unit.status === 'RUNNING' ? cycleProgress : 0}%` }}
                    />
                  </div>
                </div>

                {/* Secondary Indicators: Spindle Load & Tool Wear with 1-Click Action */}
                <div className="space-y-1.5 pt-1">
                  <div className="grid grid-cols-2 gap-2 text-[10px] text-[#64748B]">
                    <div className="flex items-center justify-between bg-slate-50 px-2 py-1 rounded border border-slate-100">
                      <span>Spindle Load:</span>
                      <strong className="text-[#1E293B] font-mono">{unit.spindleLoadPct}%</strong>
                    </div>
                    <div className={`flex items-center justify-between px-2 py-1 rounded border ${
                      unit.toolWearPct > 70 
                        ? 'bg-amber-50 text-amber-800 border-amber-200' 
                        : 'bg-slate-50 text-[#64748B] border-slate-100'
                    }`}>
                      <span>Tool Wear:</span>
                      <strong className="font-mono">{unit.toolWearPct}%</strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      onClick={() => setIsBatchToolingModalOpen(true)}
                      className="w-full py-1 text-[10px] font-bold bg-[#FAF9F6] hover:bg-blue-50 text-[#2563EB] hover:text-blue-700 border border-[#DDD9D0] hover:border-blue-300 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Wrench className="w-3 h-3 text-[#2563EB]" />
                      <span>Schedule Tooling Swap</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* SECTION 2: ROBOTIC WELDING & ASSEMBLY CELL (Stage 3)         */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DDD9D0] pb-3">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-[#2563EB]" />
            <h3 className="text-sm font-bold text-[#1E293B]">
              Robotic Welding & Assembly Cell: 6-Axis Seam Joining ({filteredRobotUnits.length}/4 Robotic Stations)
            </h3>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Robot Search Bar */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
              <input
                type="text"
                placeholder="Search robot code, name..."
                value={robotSearchQuery}
                onChange={(e) => setRobotSearchQuery(e.target.value)}
                className="pl-8 pr-7 py-1 text-xs bg-white border border-[#DDD9D0] rounded-xl text-[#1E293B] placeholder:text-[#64748B] focus:outline-none focus:border-[#2563EB] w-48 shadow-2xs"
              />
              {robotSearchQuery && (
                <button
                  onClick={() => setRobotSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <span className="text-xs font-mono font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
              Weld Seam Integrity: 99.5%
            </span>
          </div>
        </div>

        {/* Empty Search Fallback */}
        {filteredRobotUnits.length === 0 && (
          <div className="text-center py-8 bg-white rounded-xl border border-dashed border-[#DDD9D0] text-slate-500">
            <Search className="w-6 h-6 mx-auto text-slate-400 mb-1.5 opacity-60" />
            <p className="text-xs font-bold text-slate-700">No matching robotic welding stations found</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Try searching for "ROBOT-01", "Laser", or clear search.</p>
            <button
              onClick={() => setRobotSearchQuery('')}
              className="mt-2.5 px-2.5 py-1 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md cursor-pointer"
            >
              Clear Search
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {filteredRobotUnits.map(robot => {
            const cycleProgress = (robot.currentCycleSec / robot.cycleTimeSec) * 100;
            return (
              <div 
                key={robot.code}
                className="bg-white p-4 rounded-xl border border-[#DDD9D0] hover:border-[#2563EB] transition-all shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between gap-1.5 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
                    <span className={`text-xs font-mono font-extrabold px-1.5 py-0.5 rounded shrink-0 ${
                      robot.status === 'FAULT'
                        ? 'bg-rose-100 text-rose-700'
                        : robot.status === 'MAINTENANCE'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-[#EAE7E0] text-purple-700'
                    }`}>
                      {robot.code}
                    </span>
                    <span className="text-xs font-bold text-[#1E293B] truncate min-w-0" title={robot.name}>
                      {robot.name}
                    </span>
                  </div>
                  
                  {robot.status === 'WELDING' && (
                    <span className="text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0">
                      <Flame className="w-3 h-3 text-purple-600 animate-pulse" />
                      WELDING
                    </span>
                  )}
                  {robot.status === 'FAULT' && (
                    <span className="text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-300 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0 animate-pulse">
                      <AlertTriangle className="w-3 h-3 text-rose-600" />
                      FAULT
                    </span>
                  )}
                  {robot.status === 'MAINTENANCE' && (
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0">
                      <Wrench className="w-3 h-3 text-amber-700" />
                      MAINT
                    </span>
                  )}
                  {robot.status === 'IDLE' && (
                    <span className="text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300 px-1.5 py-0.5 rounded shrink-0">
                      IDLE
                    </span>
                  )}
                </div>

                {/* Welding Output Metrics */}
                <div className={`grid grid-cols-2 gap-2 p-2.5 rounded-xl border ${
                  robot.status === 'FAULT'
                    ? 'bg-rose-50/70 border-rose-200'
                    : robot.status === 'MAINTENANCE'
                    ? 'bg-amber-50/70 border-amber-200'
                    : 'bg-[#FAF9F6] border-[#DDD9D0]'
                }`}>
                  <div>
                    <div className="text-[10px] font-bold text-[#64748B] uppercase">Weld Rate</div>
                    <div className={`text-base font-black font-mono ${
                      robot.status !== 'WELDING' ? 'text-rose-600' : 'text-[#1E293B]'
                    }`}>
                      {robot.status === 'WELDING' ? robot.weldsPerHour : '0.0'}{' '}
                      <span className="text-xs font-normal text-[#64748B]">wld/hr</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-[#64748B] uppercase">Total Welded</div>
                    <div className="text-base font-black text-purple-700 font-mono">
                      {robot.totalWelded} <span className="text-xs font-normal text-[#64748B]">joints</span>
                    </div>
                  </div>
                </div>

                {/* Active Welding Arc Cycle Progress */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#64748B] font-medium flex items-center gap-1">
                      <Timer size={12} className={robot.status === 'FAULT' ? 'text-rose-600' : 'text-purple-600'} />{' '}
                      {robot.status === 'WELDING' ? 'Arc Seam Cycle' : 'Arc Cycle Halted'}
                    </span>
                    <span className="font-mono font-bold text-[#1E293B]">
                      {robot.status === 'WELDING' ? `${robot.currentCycleSec}s / ${robot.cycleTimeSec}s` : 'PAUSED (0s)'}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#EAE7E0] rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        robot.status === 'FAULT' ? 'bg-rose-500' : robot.status === 'MAINTENANCE' ? 'bg-amber-500' : 'bg-purple-600'
                      }`}
                      style={{ width: `${robot.status === 'WELDING' ? cycleProgress : 0}%` }}
                    />
                  </div>
                </div>

                {/* Parameters: Gas flow, Arc Temp, Quality */}
                <div className="space-y-1.5 pt-1">
                  <div className="grid grid-cols-3 gap-1.5 text-[9px] text-[#64748B]">
                    <div className="bg-slate-50 p-1 rounded border border-slate-100 text-center">
                      <div>Gas Flow</div>
                      <strong className="text-[#1E293B] font-mono">{robot.shieldGasFlowLpm} L/m</strong>
                    </div>
                    <div className="bg-slate-50 p-1 rounded border border-slate-100 text-center">
                      <div>Arc Temp</div>
                      <strong className="text-orange-700 font-mono">{robot.arcTempCelsius}°C</strong>
                    </div>
                    <div className="bg-slate-50 p-1 rounded border border-slate-100 text-center">
                      <div>Quality</div>
                      <strong className="text-emerald-700 font-mono">{robot.weldQualityPct}%</strong>
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      try {
                        await api.escalateIssue({
                          senderRole: 'SUPERVISOR',
                          senderName: 'Marcus Vance',
                          targetRole: 'TECHNICIAN',
                          type: 'SPARE_REQUEST',
                          title: `Torch Nozzle Inspection on ${robot.code}`,
                          details: `Arc temperature ${robot.arcTempCelsius}°C, shield gas flow ${robot.shieldGasFlowLpm} L/min. Technician requested for contact tip & shroud cleaning.`,
                          metadata: { robotCode: robot.code, arcTemp: robot.arcTempCelsius }
                        });
                        onAddToast?.({
                          type: 'AI_AGENT',
                          title: '⚡ Torch Service Ticket Created',
                          subtitle: `Asset: ${robot.code}`,
                          message: `Nozzle & shroud maintenance ticket for ${robot.code} dispatched to Technician.`
                        });
                      } catch (e: any) {
                        onAddToast?.({
                          type: 'INFO',
                          title: 'Action Failed',
                          message: e.message || 'Could not dispatch torch maintenance ticket.'
                        });
                      }
                    }}
                    className="w-full py-1 text-[10px] font-bold bg-[#FAF9F6] hover:bg-[#EAE7E0] text-purple-800 border border-purple-200 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Wrench className="w-3 h-3 text-purple-700" />
                    <span>Service Torch & Nozzle</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* SECTION 3 & 4: PACKAGING ACCUMULATION & AGV TRANSPORTATION  */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Automated Packaging & Palletizing Cell (7 Cols) */}
        <div className="lg:col-span-7 bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[#DDD9D0] pb-3">
            <div className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-[#2563EB]" />
              <h3 className="text-sm font-bold text-[#1E293B]">
                Packaging Cell: Automated Case Packing & RFID Palletizing
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              24 pcs/carton &bull; 10 cartons/pallet
            </span>
          </div>

          {/* Active Pallet Staging Box */}
          <div className="bg-white p-4 rounded-xl border-2 border-dashed border-[#2563EB]/40 space-y-3.5 bg-blue-50/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center font-bold text-xs">
                  <QrCode size={16} />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#1E293B] flex items-center gap-1.5 flex-wrap">
                    <span>{currentPallet.palletNumber}</span>
                    <span className="text-[10px] font-mono text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded font-semibold">
                      {currentPallet.transportId || 'TRP-2026-9041'}
                    </span>
                    <span className="text-[10px] font-mono text-[#64748B]">({currentPallet.rfidTag})</span>
                  </div>
                  <div className="text-[10px] text-[#64748B] mt-0.5">{currentPallet.destination}</div>
                </div>
              </div>

              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-blue-100 text-[#2563EB] animate-pulse">
                {currentPallet.status}
              </span>
            </div>

            {/* Visual Carton Grid (10 Cartons = 240 units) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-[#1E293B]">
                <span>Pallet Fill Progress ({currentPallet.piecesCount} / {currentPallet.maxPieces} Pieces)</span>
                <span className="font-mono text-[#2563EB]">{currentPallet.cartonsCount} of {currentPallet.maxCartons} Cartons Stacked</span>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: 10 }).map((_, idx) => {
                  const fullCartonThreshold = (idx + 1) * 24;
                  const prevCartonThreshold = idx * 24;
                  const isFull = currentPallet.piecesCount >= fullCartonThreshold;
                  const isCurrentPacking = currentPallet.piecesCount > prevCartonThreshold && currentPallet.piecesCount < fullCartonThreshold;
                  const currentPiecesInCarton = isFull 
                    ? 24 
                    : isCurrentPacking 
                    ? currentPallet.piecesCount - prevCartonThreshold 
                    : 0;

                  return (
                    <div 
                      key={idx}
                      className={`p-2 rounded-lg border text-center transition-all ${
                        isFull 
                          ? 'bg-blue-600 text-white border-blue-700 shadow-xs' 
                          : isCurrentPacking
                          ? 'bg-blue-50 text-blue-900 border-blue-400 ring-2 ring-blue-400/30'
                          : 'bg-[#FAF9F6] text-[#64748B] border-[#DDD9D0]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold uppercase">Carton {idx + 1}</span>
                        {isCurrentPacking && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping" />
                        )}
                      </div>
                      <div className="text-[10px] font-mono font-bold mt-0.5">
                        {isFull ? '24 / 24 pcs' : isCurrentPacking ? `${currentPiecesInCarton} / 24 pcs` : 'Empty (0/24)'}
                      </div>
                      {isCurrentPacking && (
                        <div className="w-full bg-blue-200 h-1 rounded-full mt-1.5 overflow-hidden">
                          <div 
                            className="bg-blue-600 h-full transition-all duration-300"
                            style={{ width: `${(currentPiecesInCarton / 24) * 100}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pallet Seal & Dispatch Action */}
            <div className="flex items-center justify-between pt-2 border-t border-[#DDD9D0]">
              <div className="text-[11px] text-[#64748B] flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-600" />
                <span>Thermal shrink wrap & RFID DB verified</span>
              </div>

              <button
                onClick={handleDispatchPallet}
                className="px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
              >
                <Truck size={14} />
                <span>Dispatch to AGV Fleet</span>
              </button>
            </div>
          </div>

          {/* Recent Dispatched Pallets Log (Authoritative DB Records) */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-[#1E293B] flex items-center justify-between">
              <span>Recent Dispatched Pallet Batches (DB Tracking):</span>
              <span className="text-[10px] text-slate-500 font-mono">Indexed by Transport ID &bull; RFID</span>
            </div>
            <div className="space-y-2">
              {completedPallets.map(pal => (
                <div 
                  key={pal.id}
                  className="bg-white p-3 rounded-xl border border-[#DDD9D0] flex items-center justify-between text-xs hover:border-[#2563EB] transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <Barcode className="w-5 h-5 text-[#2563EB] shrink-0" />
                    <div>
                      <div className="font-bold text-[#1E293B] flex items-center gap-1.5 flex-wrap">
                        <span>{pal.palletNumber}</span>
                        <span className="text-[10px] font-mono text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded">
                          {pal.transportId || 'TRP-2026-AUTO'}
                        </span>
                        <span className="text-[10px] text-[#64748B]">({pal.piecesCount} pcs)</span>
                      </div>
                      <div className="text-[10px] text-[#64748B] mt-0.5">
                        {pal.destination} &bull; Carrier: <strong>{pal.assignedAGV || 'AGV Fleet'}</strong> &bull; RFID: <span className="font-mono">{pal.rfidTag}</span>
                      </div>
                    </div>
                  </div>

                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
                    pal.status === 'DELIVERED_DOCK'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : pal.status === 'LOADED_TRUCK'
                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                      : pal.status === 'DELIVERED_CUSTOMER'
                      ? 'bg-slate-100 text-slate-600 border border-slate-200'
                      : 'bg-blue-50 text-[#2563EB] border border-blue-200'
                  }`}>
                    {pal.status === 'DELIVERED_DOCK' ? 'STAGED AT DOCK' : pal.status === 'LOADED_TRUCK' ? 'ON TRUCK' : pal.status === 'DELIVERED_CUSTOMER' ? 'DELIVERED' : pal.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: AGV & Autonomous Forklift Fleet (5 Cols) */}
        <div className="lg:col-span-5 bg-[#FAF9F6] border border-[#DDD9D0] rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#DDD9D0] pb-3">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#2563EB]" />
                <h3 className="text-sm font-bold text-[#1E293B]">
                  AGV Transportation & Loading Dock Fleet
                </h3>
              </div>
              <span className="text-xs font-mono font-bold text-[#2563EB]">
                {agvFleet.length} Vehicles
              </span>
            </div>

            <div className="space-y-3">
              {agvFleet.map(agv => (
                <div 
                  key={agv.id}
                  className="bg-white p-3.5 rounded-xl border border-[#DDD9D0] shadow-xs space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-[#1E293B] flex items-center gap-1.5">
                        <span>{agv.name}</span>
                        <span className="text-[10px] font-mono bg-[#EAE7E0] px-1.5 py-0.2 rounded font-medium">{agv.id}</span>
                      </div>
                      <div className="text-[10px] text-[#64748B] mt-0.5">Location: {agv.currentLocation}</div>
                    </div>

                    <div className="text-right">
                      <div className="text-[11px] font-bold font-mono text-[#22A06B] flex items-center gap-1">
                        <BatteryCharging size={13} /> {agv.batteryPct}%
                      </div>
                      <div className="text-[9px] text-[#64748B]">{agv.speedMps} m/s</div>
                    </div>
                  </div>

                  {/* Route Transit Progress */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-[#64748B] truncate max-w-[160px]">
                        Payload: <strong className="text-[#1E293B]">{agv.currentPayload || 'Unloaded'}</strong>
                      </span>
                      <span className="font-mono font-bold text-[#2563EB]">{agv.routeProgressPct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#EAE7E0] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[#2563EB] transition-all duration-300"
                        style={{ width: `${agv.routeProgressPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] pt-1 border-t border-[#DDD9D0]/60">
                    <span className="text-[#64748B]">Destination: {agv.destination}</span>
                    <span className="font-bold text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded">
                      {agv.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Outbound Loading Dock Staging → automatic semi-trailer freight dispatch (backend freight engine) */}
          {(() => {
            const threshold = freight?.threshold ?? 4;
            const staged = freight?.dock.count ?? 0;
            const pct = Math.min(100, (staged / threshold) * 100);
            const onRoad = freight?.active ?? [];
            return (
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Warehouse className="w-4 h-4 text-emerald-700 shrink-0" />
                    <div>
                      <div className="font-bold text-[#1E293B]">Outbound Logistics Dock (Bays 1-3)</div>
                      <div className="text-[10px] text-[#64748B]">
                        Auto-dispatches a semi-trailer at {threshold} pallets ({(threshold * (freight?.palletTonnes ?? 1.2)).toFixed(1)} t)
                      </div>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded text-white ${freight?.dock.waitingForTruck ? 'bg-amber-600' : 'bg-emerald-600'}`}>
                    {freight?.dock.waitingForTruck ? 'WAITING FOR TRUCK' : `${staged}/${threshold} STAGED`}
                  </span>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-[#64748B] mb-1">
                    <span>
                      {staged} pallet{staged === 1 ? '' : 's'} · {freight?.dock.tonnage ?? 0} t staged
                      {freight?.inTransitToDock ? ` · ${freight.inTransitToDock} on AGV` : ''}
                    </span>
                    <span>{freight ? `${freight.availableTrucks} truck${freight.availableTrucks === 1 ? '' : 's'} at base` : 'connecting…'}</span>
                  </div>
                  <div className="w-full h-1.5 bg-white rounded-full overflow-hidden border border-emerald-100">
                    <div className="h-full bg-emerald-600 transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                {freight?.next?.truckId && !freight.dock.waitingForTruck && (
                  <div className="text-[10.5px] text-[#1E293B]">
                    <strong>Next truck: {freight.next.truckId}</strong> — loads {threshold} pallets ({(threshold * (freight.palletTonnes ?? 1.2)).toFixed(1)} t) and departs{' '}
                    {freight.next.estimatedSeconds == null ? 'when the load is complete' : freight.next.estimatedSeconds < 60 ? 'within a minute' : `in ~${Math.round(freight.next.estimatedSeconds / 60)} min`}
                    {' '}· needs {freight.next.palletsNeeded} more pallet{freight.next.palletsNeeded === 1 ? '' : 's'}
                    <div className="text-[#64748B]">{freight.next.basis}</div>
                  </div>
                )}
                {onRoad.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-emerald-200/70">
                    {onRoad.map((d) => (
                      <div key={d.id} className="flex items-center justify-between text-[10.5px]">
                        <span className="text-[#1E293B] font-semibold truncate">
                          <Truck size={11} className="inline mr-1 text-[#2563EB]" />
                          {d.truckId} → {d.destinationName}
                        </span>
                        <span className="font-mono text-[#64748B] shrink-0 ml-2">{d.palletCount} plt · {d.tonnage} t · {d.status.replace('_', ' ')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* CNC Multi-Station Batch Tooling Optimizer Modal */}
      <BatchToolingOptimizerModal
        isOpen={isBatchToolingModalOpen}
        onClose={() => setIsBatchToolingModalOpen(false)}
        onAddToast={onAddToast}
      />
    </div>
  );
};
