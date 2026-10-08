import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutGrid, PanelRightClose, PanelRightOpen, Warehouse, Activity, AlertTriangle, ArrowLeft, BatteryCharging, Bot, ChevronDown, ChevronsDown, ChevronsUp, ClipboardList, Cog, Forklift as ForkliftIcon, Gauge,
  Home, Layers, MapPin, Minus, Package, Plus, RotateCcw, RotateCw, Shuffle, Thermometer, Timer, Truck, User, Waves, Wrench, Zap,
} from 'lucide-react';
import { Incident, Machine, TelemetryData, WorkOrder } from '../../types';
import { api } from '../../services/api';
import { assistantApi } from '../../services/assistantApi';
import { TwinScene, SceneMachine, SceneTechnician } from './TwinScene';
import { CameraApi, EntityRef, startLabelDeclutter } from './sceneKit';
import { cellById, Vec3 } from './spatialConfig';
import { OPEN_INCIDENT, OPEN_WO, statusOf, TECH_PHASE_LABEL, techPlacement } from './status';
import { FleetState } from './fleet';
import { ago, Card, Empty, fmtDur, fmtTime, Metric, Pill, QueueCard, QueueRow, Row, SectionLabel, Stepper } from './ui';
import { YardScene, CellStatus, DEFAULT_LAYERS, YardLayers } from './yard/YardScene';
import { SITE_DEFS, SiteDef, siteById, TRUCK_CENTER_Z } from './yard/layout';
import {
  batterySeries, bayVisits, chargerAt, forkliftAt, forkliftForBay, forkliftTaskLog, forkliftUtilisation, onYard, siteSnapshot, SiteSnapshot, truckAt, truckEvents, TruckSnap,
} from './yard/sim';
import { clockNow, LIVE_CLOCK, REPLAY_WINDOW, replayAt, retime, ViewClock } from './yard/clock';
import { AlertSeverity, deriveAlerts, loadAcks, OpsAlert, saveAcks, yardMetrics, yardSeries } from './yard/insights';
import {
  Bar, SiteBadge, BuildingCard, ChargerCard, CellLine, DockCard, DockRow, ForkliftCard, ForkliftRow, NetworkCard, PalletCard, SiteCard, Tag, TruckCard, TruckRow,
} from './yard/YardPanels';
import { ClockPill, ReplayBar, Toolbar } from './panels/Toolbar';
import { deltaOf, KpiItem, KpiStat, Source, SourceTag } from './panels/KpiStrip';
import { AnalyticsDrawer, DayRow } from './panels/AnalyticsDrawer';
import { SearchItem, SearchPalette } from './panels/SearchPalette';
import { AlertsPanel } from './panels/AlertsPanel';
import { LayersMenu, Theme, TimeOfDay } from './panels/LayersMenu';
import { ShortcutsHelp } from './panels/ShortcutsHelp';
import { MiniMap, MiniMapDots } from './panels/MiniMap';
import { ActionBar, BatteryChart, DetailTabs, EventTimeline, Manifest, Related, RequestDialog, RequestLog, TaskLog, UtilBar, VisitList } from './panels/DetailParts';
import { Gantt } from './panels/charts';
import './opsTwin.css';
import { WarehouseScene } from './yard/WarehouseScene';
import { locPos, parseLoc, reachAt, ROLE, siteEquipment, warehouseFor, whMovesPerHour, whStats } from './yard/warehouse';
import { equipAt, EquipSnap, KIND } from './yard/equipment';
import { AisleCard, EquipmentCard, LocationCard, ReachCard, WarehouseOverview, ZoneCard } from './panels/WarehousePanels';

interface Props {
  machines: Machine[];
  workOrders: WorkOrder[];
  incidents: Incident[];
  telemetryMap: Record<string, TelemetryData>;
  currentUser?: { name: string; role: string };
}

interface RequestEntry {
  at: number;
  entity: string; // `${kind}:${id}`
  text: string;
  status: string;
}

const TELEMETRY_STALE_MS = 60_000;
const SEVERITY: Record<string, number> = { FAULT: 6, WARNING: 5, WAITING_PARTS: 4, MAINTENANCE: 3, VERIFYING: 3, OFFLINE: 2, OFF: 2, RUNNING: 1 };
const worst = (statuses: string[]) => statuses.reduce((w, s) => ((SEVERITY[s] || 0) > (SEVERITY[w] || 0) ? s : w), 'RUNNING');
const STATE_COLOR: Record<string, string> = { RUNNING: '#22C55E', WARNING: '#F59E0B', FAULT: '#EF4444', ESTOP: '#B91C1C', MAINTENANCE: '#3B82F6', VERIFYING: '#8B5CF6', IDLE: '#CBD5E1', OFF: '#E2E8F0' };

const load = <T,>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(key);
    return v ? { ...(fallback as any), ...JSON.parse(v) } : fallback;
  } catch {
    return fallback;
  }
};
const loadRaw = <T,>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};
const save = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
};

/** Which site an entity belongs to. */
function siteOfRef(ref: EntityRef): SiteDef | undefined {
  if (ref.kind === 'site') return siteById(ref.id);
  if (ref.kind === 'building') return SITE_DEFS.find((s) => s.buildings.some((b) => b.id === ref.id));
  if (ref.kind === 'equipment') return SITE_DEFS.find((s) => siteEquipment(s).some((e) => e.id === ref.id));
  if (ref.kind === 'forklift') return SITE_DEFS.find((s) => s.forklifts.some((f) => f.id === ref.id) || ref.id.startsWith(`${s.code}-SP`));
  return SITE_DEFS.find((s) => ref.id.startsWith(`${s.id}:`));
}
const siteOfMachine = (code: string) => SITE_DEFS.find((s) => cellById(s.id)?.stations.some((x) => x.code === code))?.id;

/** Night factor 0..1 from the IST hour. */
function nightFactor(sec: number, mode: TimeOfDay): number {
  if (mode === 'day') return 0;
  if (mode === 'night') return 1;
  const h = (((sec + 19800) % 86400) + 86400) % 86400 / 3600;
  if (h >= 19.5 || h < 5) return 1;
  if (h >= 17.5) return (h - 17.5) / 2;
  if (h < 6.5) return 1 - (h - 5) / 1.5;
  return 0;
}

export const OpsTwinView: React.FC<Props> = ({ machines, workOrders, incidents, telemetryMap, currentUser }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<CameraApi>(null);
  const [mode, setMode] = useState<'yard' | 'interior'>('yard');
  const [interiorId, setInteriorId] = useState('MACHINING');
  const [interiorBuilding, setInteriorBuilding] = useState<string | null>(null);
  const [whTab, setWhTab] = useState<'aisles' | 'trucks' | 'equipment'>('aisles');
  const [focus, setFocus] = useState<string | null>(null); // site id; null = network overview
  const [selected, setSelected] = useState<EntityRef | null>(null);
  const [yardTab, setYardTab] = useState<'docks' | 'forklifts' | 'trucks'>('docks');
  const [cellTab, setCellTab] = useState<'machines' | 'work-orders' | 'alerts'>('machines');
  const [switcher, setSwitcher] = useState(false);
  const [trackFor, setTrackFor] = useState<EntityRef | null>(null);
  const [day, setDay] = useState<Record<string, DayRow>>({});
  const [fleet, setFleet] = useState<FleetState | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [clock, setClock] = useState<ViewClock>(LIVE_CLOCK);
  const [, setTick] = useState(0);

  // page chrome
  const [layers, setLayersState] = useState<YardLayers>(() => ({ ...load('opsTwin.layers', DEFAULT_LAYERS), halos: false }));
  const [timeOfDay, setTimeOfDayState] = useState<TimeOfDay>(() => loadRaw('opsTwin.timeOfDay', 'day' as TimeOfDay));
  const [theme, setThemeState] = useState<Theme>(() => loadRaw('opsTwin.theme', 'light' as Theme));
  const [minimap, setMinimapState] = useState<boolean>(false);
  const [inspectorOpen, setInspectorOpen] = useState<boolean>(() => loadRaw('opsTwin.inspector', true));
  // the details panel fills the space above the list card (whatever height that list has)
  const queueRef = useRef<HTMLDivElement>(null);
  const [queueH, setQueueH] = useState(220);
  useEffect(() => {
    const el = queueRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setQueueH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const toggleInspector = (v: boolean) => (setInspectorOpen(v), save('opsTwin.inspector', v));
  const [panel, setPanel] = useState<null | 'alerts' | 'analytics'>(null);
  const [layersOpen, setLayersOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [following, setFollowing] = useState<EntityRef | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [acked, setAcked] = useState<Set<string>>(() => loadAcks());
  const [requests, setRequests] = useState<RequestEntry[]>(() => loadRaw('opsTwin.requests', [] as RequestEntry[]));
  const [dialog, setDialog] = useState<null | { kind: 'wo'; code: string } | { kind: 'sim'; ref: EntityRef; title: string; description: string; note: string; confirm: string }>(null);
  const [toast, setToast] = useState<string | null>(null);
  const pendingSelect = useRef<EntityRef | null>(null);
  // the link this page was opened with (read before the URL starts following the view)
  const initialHash = useRef(window.location.hash);
  const linkApplied = useRef(!window.location.hash.startsWith('#ops-twin?'));

  const setLayers = (l: YardLayers) => (setLayersState(l), save('opsTwin.layers', l));
  const setTimeOfDay = (t: TimeOfDay) => (setTimeOfDayState(t), save('opsTwin.timeOfDay', t));
  const setTheme = (t: Theme) => (setThemeState(t), save('opsTwin.theme', t));
  const setMinimap = (v: boolean) => (setMinimapState(v), save('opsTwin.minimap', v));
  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((m) => (m === msg ? null : m)), 4200);
  };
  const logRequest = (entity: string, text: string, status: string) => {
    setRequests((prev) => {
      const next = [{ at: Date.now() / 1000, entity, text, status }, ...prev].slice(0, 60);
      save('opsTwin.requests', next);
      return next;
    });
  };

  // ── Data feeds ──
  useEffect(() => {
    let alive = true;
    const loadDay = () =>
      api
        .getDailyProduction()
        .then((res: any) => {
          if (alive && res?.success && Array.isArray(res.data?.machines)) setDay(Object.fromEntries(res.data.machines.map((m: DayRow) => [m.machine_code, m])));
        })
        .catch(() => {});
    loadDay();
    const id = setInterval(loadDay, 30_000);
    const t = setInterval(() => setTick((x) => x + 1), 1_000);
    return () => {
      alive = false;
      clearInterval(id);
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const loadFleet = async () => {
      const t0 = Date.now();
      try {
        const res = await api.getFleetState();
        if (!alive || !res?.success || !res.data) return;
        setClockOffset(Date.parse(res.data.serverTime) - (t0 + (Date.now() - t0) / 2));
        setFleet(res.data as FleetState);
      } catch {
        /* fleet service unavailable: the shipping yard shows no PlantOps trucks */
      }
    };
    loadFleet();
    const id = setInterval(loadFleet, 5_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // ── View clock (live or replay) ──
  const clockRef = useRef(clock);
  clockRef.current = clock;
  const offsetRef = useRef(clockOffset);
  offsetRef.current = clockOffset;
  const nowFn = useCallback(() => clockNow(clockRef.current, offsetRef.current), []);
  const nowSec = clockNow(clock, clockOffset);
  const liveSec = clockNow(LIVE_CLOCK, clockOffset);
  useEffect(() => {
    // replay caught up with the present → back to live
    if (clock.mode === 'replay' && !clock.paused && nowSec >= liveSec - 1) setClock(LIVE_CLOCK);
  });
  const night = nightFactor(nowSec, timeOfDay);

  // ── Machines / work orders ──
  const byCode = useMemo(() => new Map(machines.map((m) => [m.code, m])), [machines]);
  const codeById = useMemo(() => new Map(machines.map((m) => [m.id, m.code])), [machines]);
  const woCode = (w: WorkOrder) => w.machine_code || codeById.get(w.machine_id) || '';
  const incCode = (i: Incident) => i.machine_code || codeById.get(i.machine_id) || '';
  const openWOs = useMemo(() => workOrders.filter((w) => OPEN_WO(w.status)), [workOrders]);
  const openIncidents = useMemo(() => incidents.filter((i) => OPEN_INCIDENT(i.status)).sort((a, b) => +new Date(b.detected_at) - +new Date(a.detected_at)), [incidents]);
  const incidentById = useMemo(() => new Map(incidents.map((i) => [i.id, i])), [incidents]);
  const isFresh = (code: string) => {
    const t = telemetryMap[code];
    return !!t && Date.now() - new Date(t.timestamp).getTime() < TELEMETRY_STALE_MS;
  };

  // Warehouse & depot equipment (no production machines on this page)
  const eqBucket = Math.floor(nowSec / 60);
  const cells: Record<string, CellLine & { equip: EquipSnap[]; maint: number; perHour: number }> = useMemo(() => {
    const out: any = {};
    const mid = Math.floor((nowSec + 19800) / 86400) * 86400 - 19800;
    const hours = Math.max(0, (nowSec - mid) / 3600);
    const summarise = (items: EquipSnap[]) => {
      const p = items.filter((e) => e.powered);
      return {
        running: p.filter((e) => e.status === 'RUNNING' || e.status === 'IDLE').length,
        total: p.length,
        worst: p.length ? worst(p.map((e) => (e.status === 'IDLE' ? 'RUNNING' : e.status))) : 'RUNNING',
        alerts: p.filter((e) => e.status === 'FAULT' || e.status === 'WARNING').length,
        maint: p.filter((e) => e.status === 'MAINTENANCE').length,
      };
    };
    for (const s of SITE_DEFS) {
      const equip = siteEquipment(s).map((e) => equipAt(e, nowSec));
      const whRate = s.buildings.reduce((a, b) => a + whMovesPerHour(warehouseFor(s, b)), 0);
      const yardMoves = siteSnapshot(s, nowSec, fleet).putawaysToday;
      out[s.id] = { ...summarise(equip), equip, output: Math.round(yardMoves + whRate * hours), target: 0, perHour: whRate };
      for (const b of s.buildings) out[b.id] = { ...summarise(equip.filter((e) => e.item.buildingId === b.id)), equip: equip.filter((e) => e.item.buildingId === b.id), output: 0, target: 0, perHour: whMovesPerHour(warehouseFor(s, b)) };
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eqBucket, !!fleet]);
  const cellStatus: Record<string, CellStatus> = useMemo(
    () => Object.fromEntries(Object.entries(cells).map(([k, c]) => [k, { worst: c.worst, running: c.running, total: c.total, alerts: c.alerts }])),
    [cells]
  );

  // ── Yard snapshots at the view time ──
  const snaps: Record<string, SiteSnapshot> = Object.fromEntries(SITE_DEFS.map((s) => [s.id, siteSnapshot(s, nowSec, fleet)]));
  const focusSite = focus ? siteById(focus) : undefined;
  const scope = focusSite ? [focusSite] : SITE_DEFS;
  const showSite = !focusSite;

  const truckByKey = (key: string): TruckSnap | null => {
    const s = SITE_DEFS.find((x) => key.startsWith(`${x.id}:`));
    return s ? snaps[s.id].trucks[Number(key.split(':')[1])] : null;
  };
  const forkliftById = (id: string) => {
    for (const s of SITE_DEFS) {
      const f = snaps[s.id].forklifts.find((x) => x.def.id === id) || snaps[s.id].spares.find((x) => x.def.id === id);
      if (f) return { f, s };
    }
    return null;
  };

  // ── Alerts ──
  const alerts = useMemo(
    () =>
      deriveAlerts({
        snaps,
        fleet,
        machines: [],
        openIncidents: [],
        siteOfMachine,
        codeOfMachineId: (id) => codeById.get(id),
        nowSec,
      }),
    // recompute at most every 2 s of view time
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [Math.floor(nowSec / 2), fleet]
  ).concat(
    SITE_DEFS.flatMap((st) =>
      (cells[st.id]?.equip || [])
        .filter((e) => e.powered && (e.status === 'FAULT' || e.status === 'WARNING'))
        .map((e) => ({
          id: `eq:${e.item.id}:${Math.floor(nowSec / 1800)}`,
          severity: (e.status === 'FAULT' ? 'critical' : 'warning') as AlertSeverity,
          title: `${e.item.label} ${e.status === 'FAULT' ? 'fault' : 'warning'}`,
          detail: `${st.buildings.find((b) => b.id === e.item.buildingId)?.label} · ${e.issue || e.reading}`,
          siteId: st.id,
          ref: { kind: 'equipment' as const, id: e.item.id },
          source: 'sim' as const,
        }))
    )
  );
  const openAlerts = alerts.filter((a) => !acked.has(a.id));
  const ack = (ids: string[]) =>
    setAcked((prev) => {
      const next = new Set(prev);
      ids.forEach((i) => next.add(i));
      saveAcks(next);
      return next;
    });
  const alertKeyStr = openAlerts
    .map((a) => {
      const s = siteById(a.siteId);
      if (a.ref.kind === 'equipment') return `building:${siteEquipment(s!).find((e) => e.id === a.ref.id)?.buildingId}=${a.severity}`;
      if (a.ref.kind === 'site') return `${a.id.startsWith('stage:') ? 'staging' : 'site'}:${a.siteId}=${a.severity}`;
      return `${a.ref.kind}:${a.ref.id}=${a.severity}`;
    })
    .sort()
    .join('|');
  const alertKeys = useMemo(() => {
    const m = new Map<string, AlertSeverity>();
    const rank: Record<AlertSeverity, number> = { critical: 3, warning: 2, info: 1 };
    for (const part of alertKeyStr.split('|').filter(Boolean)) {
      const [k, sev] = part.split('=') as [string, AlertSeverity];
      if (!m.has(k) || rank[sev] > rank[m.get(k)!]) m.set(k, sev);
    }
    return m;
  }, [alertKeyStr]);

  // ── Selection → camera ──
  const worldOf = (ref: EntityRef): { p: Vec3; d: number } | null => {
    const s = siteOfRef(ref);
    if (!s) return null;
    const w = (x: number, z: number, d: number) => ({ p: [s.origin[0] + x, 0, s.origin[2] + z] as Vec3, d });
    switch (ref.kind) {
      case 'site':
        return w(4, 4, 150);
      case 'building': {
        const b = s.buildings.find((x) => x.id === ref.id)!;
        return w(b.x, -b.depth / 2, 80);
      }
      case 'truck': {
        const t = truckByKey(ref.id);
        return t && onYard(t) ? w(t.x, t.z, 50) : w(s.bays[Number(ref.id.split(':')[1])].x, TRUCK_CENTER_Z, 60);
      }
      case 'dock': {
        const bay = s.bays[Number(ref.id.split(':')[1])];
        return w(bay.x, TRUCK_CENTER_Z, 46);
      }
      case 'forklift': {
        const hit = forkliftById(ref.id);
        return hit ? w(hit.f.x, hit.f.z, 30) : null;
      }
      case 'charger': {
        const c = s.chargers.find((x) => `${s.id}:${x.id}` === ref.id);
        return c ? w(c.x + 3, c.z, 28) : null;
      }
      case 'pallet': {
        const sl = s.slots.find((x) => `${s.id}:${x.id}` === ref.id);
        return sl ? w(sl.x, sl.z, 30) : null;
      }
      default:
        return null;
    }
  };

  /** Live world position of a moving entity (for follow mode + mini-map). */
  const livePos = useCallback(
    (ref: EntityRef | null): Vec3 | null => {
      if (!ref) return null;
      const s = siteOfRef(ref);
      if (!s) return null;
      const t = clockNow(clockRef.current, offsetRef.current);
      if (ref.kind === 'truck') {
        const tr = truckAt(s, s.bays[Number(ref.id.split(':')[1])], t, fleetRef.current);
        return tr && onYard(tr) ? [s.origin[0] + tr.x, 0, s.origin[2] + tr.z] : null;
      }
      if (ref.kind === 'forklift') {
        const f = s.forklifts.find((x) => x.id === ref.id);
        if (!f) return null;
        const p = forkliftAt(s, f, t);
        return [s.origin[0] + p.x, 0, s.origin[2] + p.z];
      }
      return null;
    },
    []
  );
  const fleetRef = useRef(fleet);
  fleetRef.current = fleet;

  const startFollow = (ref: EntityRef) => {
    setFollowing(ref);
    cameraRef.current?.follow(() => livePos(ref));
  };
  const stopFollow = () => {
    setFollowing(null);
    cameraRef.current?.follow(null);
  };

  const selectYard = useCallback(
    (ref: EntityRef | null) => {
      setSelected(ref);
      if (ref && ref.kind !== 'site') toggleInspector(true);
      if (following && (!ref || ref.kind !== following.kind || ref.id !== following.id)) stopFollow();
      if (!ref) return;
      const s = siteOfRef(ref);
      if (s) setFocus(s.id);
      const target = worldOf(ref);
      if (target) cameraRef.current?.flyTo(target.p, target.d);
      if (ref.kind === 'truck') setTrackFor(ref);
      else if (ref.kind === 'dock') setTrackFor({ kind: 'truck', id: ref.id });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snaps, following]
  );

  const goNetwork = () => {
    setSwitcher(false);
    setSelected(null);
    setTrackFor(null);
    setFocus(null);
    stopFollow();
    if (mode !== 'yard') setMode('yard');
    else cameraRef.current?.home();
  };
  const goSite = (id: string) => {
    setSwitcher(false);
    setTrackFor(null);
    if (mode !== 'yard') {
      setMode('yard');
      setFocus(id);
      setSelected(null);
      setTimeout(() => selectYard({ kind: 'site', id }), 350);
      return;
    }
    selectYard({ kind: 'site', id });
  };
  const enterCell = (id: string, then?: EntityRef, buildingId?: string) => {
    setInteriorBuilding(buildingId || siteById(id)?.buildings.find((b) => b.production)?.id || siteById(id)?.buildings[0]?.id || null);
    setSwitcher(false);
    setSelected(null);
    setTrackFor(null);
    stopFollow();
    setInteriorId(id);
    setFocus(id);
    pendingSelect.current = then || null;
    setMode('interior');
  };
  const goEquipment = (id: string) => {
    for (const st of SITE_DEFS) {
      const e = siteEquipment(st).find((x) => x.id === id);
      if (e) return enterCell(st.id, { kind: 'equipment', id }, e.buildingId);
    }
  };
  const goMachine = (_siteId: string, id: string) => goEquipment(id);

  // ── Interior (warehouse view) ──
  const interiorSite = mode === 'interior' ? siteById(interiorId) : undefined;
  const interiorB = interiorSite ? interiorSite.buildings.find((b) => b.id === interiorBuilding) || interiorSite.buildings.find((b) => b.production) || interiorSite.buildings[0] : undefined;
  const wh = interiorSite && interiorB ? warehouseFor(interiorSite, interiorB) : undefined;
  const whS = wh ? whStats(wh, nowSec) : undefined;
  const cell = mode === 'interior' ? cellById(interiorId) : undefined;
  const cellSum = cell ? cells[cell.id] : undefined;
  // production work orders / incidents are not part of the warehouse twin
  const cellWOs: WorkOrder[] = [];
  const cellIncidents: Incident[] = [];
  const sceneMachines: SceneMachine[] = (cell?.stations || []).map((s) => {
    const m = byCode.get(s.code);
    const t = telemetryMap[s.code];
    const st = statusOf(m?.status);
    return { code: s.code, status: m?.status || 'OFFLINE', label: t && isFresh(s.code) ? `${st.label} · ${Math.round(t.temperature)}°C` : st.label };
  });
  const technicians: SceneTechnician[] = cellWOs
    .map((w) => {
      const placement = techPlacement(String(w.technician_phase || ''));
      return placement && w.technician_name ? { workOrderId: w.id, machineCode: woCode(w), name: w.technician_name, placement } : null;
    })
    .filter(Boolean) as SceneTechnician[];

  const selectInterior = (ref: EntityRef | null) => {
    setSelected(ref);
    if (ref && ref.kind !== 'site') toggleInspector(true);
    if (!ref || !wh) return;
    let target: { p: Vec3; d: number } | null = null;
    if (ref.kind === 'equipment') {
      const e = wh.equipment.find((x) => x.id === ref.id);
      if (e) target = { p: [e.x, 0, e.z], d: e.kind === 'vehicleLift' ? 26 : 20 };
    } else if (ref.kind === 'location') {
      const l = parseLoc(wh, ref.id);
      if (l) target = { p: locPos(wh, l), d: 26 };
    } else if (ref.kind === 'aisle') {
      const a = wh.aisles.find((x) => x.id === ref.id);
      if (a) target = { p: [a.x, 0, (a.z0 + a.z1) / 2], d: 42 };
    } else if (ref.kind === 'zone') {
      const z = wh.zones.find((x) => x.id === ref.id);
      if (z) target = { p: [(z.x0 + z.x1) / 2, 0, (z.z0 + z.z1) / 2], d: 30 };
    } else if (ref.kind === 'reach') {
      const f = wh.forklifts.find((x) => x.id === ref.id);
      if (f) {
        const r = reachAt(wh, f, nowSec);
        target = { p: [r.x, 0, r.z], d: 18 };
      }
    }
    if (target) cameraRef.current?.flyTo(target.p, target.d);
    setTrackFor(null);
  };
  useEffect(() => {
    if (mode === 'interior' && wh && pendingSelect.current) {
      const ref = pendingSelect.current;
      pendingSelect.current = null;
      window.setTimeout(() => selectInterior(ref), 450);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, wh?.key]);

  // ── Shareable links (#ops-twin?site=…&sel=kind:id&mode=…) ──
  const linkFor = useCallback((): string => {
    const q = new URLSearchParams();
    if (mode === 'interior') {
      q.set('mode', 'interior');
      q.set('site', interiorId);
      if (interiorBuilding) q.set('bld', interiorBuilding);
    } else if (focus) q.set('site', focus);
    if (selected) q.set('sel', `${selected.kind}:${selected.id}`);
    if (clock.mode === 'replay') q.set('t', String(Math.round(nowSec)));
    const qs = q.toString();
    return `${window.location.origin}${window.location.pathname}${window.location.search}#ops-twin${qs ? `?${qs}` : ''}`;
  }, [mode, interiorId, interiorBuilding, focus, selected, clock.mode, nowSec]);
  useEffect(() => {
    if (!linkApplied.current) return;
    const url = linkFor();
    const hash = url.slice(url.indexOf('#'));
    if (window.location.hash !== hash) window.history.replaceState(null, '', hash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, interiorId, interiorBuilding, focus, selected?.kind, selected?.id, clock.mode]);
  useEffect(() => {
    // open the view described by the link this page was loaded with
    const h = initialHash.current;
    if (!h.startsWith('#ops-twin?')) return;
    const q = new URLSearchParams(h.slice('#ops-twin?'.length));
    const site = q.get('site');
    const sel = q.get('sel');
    const t = Number(q.get('t'));
    if (t && liveSec - t < REPLAY_WINDOW) setClock(replayAt({ ...LIVE_CLOCK, paused: true }, t));
    const ref = sel ? ({ kind: sel.split(':')[0], id: sel.slice(sel.indexOf(':') + 1) } as EntityRef) : null;
    window.setTimeout(() => {
      if (q.get('mode') === 'interior' && site) enterCell(site, ref || undefined, q.get('bld') || undefined);
      else if (ref) selectYard(ref);
      else if (site) goSite(site);
      linkApplied.current = true;
    }, 700);
    return () => {
      // leave a clean URL behind when the page closes
      if (window.location.hash.startsWith('#ops-twin')) window.history.replaceState(null, '', window.location.pathname + window.location.search);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const copyLink = () => {
    const url = linkFor();
    navigator.clipboard?.writeText(url).catch(() => {});
    flash('Link copied — it opens this exact view');
  };

  // ── Full screen + label declutter ──
  useEffect(() => {
    const h = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else rootRef.current?.requestFullscreen().catch(() => {});
  };
  useEffect(() => (rootRef.current ? startLabelDeclutter(rootRef.current, () => true) : undefined), []);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const cam = cameraRef.current;
      switch (e.key) {
        case 'Escape':
          if (searchOpen || helpOpen || dialog) return;
          if (layersOpen) setLayersOpen(false);
          else if (panel) setPanel(null);
          else if (selected) (mode === 'yard' ? selectYard : selectInterior)(null);
          else if (mode === 'interior') goSite(interiorId);
          else if (focus) goNetwork();
          return;
        case '/':
          e.preventDefault();
          setSearchOpen(true);
          return;
        case '?':
          setHelpOpen((v) => !v);
          return;
        case 'a':
        case 'A':
          setPanel((p) => (p === 'alerts' ? null : 'alerts'));
          return;
        case 'd':
        case 'D':
          setPanel((p) => (p === 'analytics' ? null : 'analytics'));
          return;
        case 'l':
        case 'L':
          setLayersOpen((v) => !v);
          return;
        case 'x':
        case 'X':
          toggleFullscreen();
          return;
        case 't':
        case 'T':
          if (following) stopFollow();
          else if (selected && (selected.kind === 'truck' || selected.kind === 'forklift')) startFollow(selected);
          return;
        case 'r':
        case 'R':
          setClock(clock.mode === 'replay' ? LIVE_CLOCK : replayAt({ ...LIVE_CLOCK, speed: 5 }, liveSec - 1800));
          return;
        case ' ':
          if (clock.mode === 'replay') {
            e.preventDefault();
            setClock(retime(clock, clockOffset, { paused: !clock.paused }));
          }
          return;
        case 'h':
        case 'H':
          if (mode === 'yard' && focusSite) selectYard({ kind: 'site', id: focusSite.id });
          else cam?.home();
          return;
        case '+':
        case '=':
          cam?.zoom(0.7);
          return;
        case '-':
          cam?.zoom(1.4);
          return;
        case '[':
          cam?.rotate(-45);
          return;
        case ']':
          cam?.rotate(45);
          return;
        case 'PageUp':
          cam?.tilt(15);
          return;
        case 'PageDown':
          cam?.tilt(-15);
          return;
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  // ── KPIs ──
  const scopeKey = scope.map((s) => s.id).join(',');
  const series = useMemo(
    () => yardSeries(scope, nowSec, fleet),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scopeKey, Math.floor(nowSec / 30), !!fleet]
  );
  const yardSrc = (simOnly: boolean): Source => (simOnly ? 'sim' : scope.every((s) => s.liveFleet) ? 'live' : scope.some((s) => s.liveFleet) ? 'mixed' : 'sim');
  const kpis: KpiItem[] = (() => {
    if (mode === 'interior' && wh && whS) {
      const occ = whS.locations ? whS.occupied / whS.locations : 0;
      const bSum = cells[wh.building.id];
      const items: KpiItem[] = [
        { key: 'occ', icon: <Layers size={11} />, label: 'Storage used', value: `${Math.round(occ * 100)}%`, sub: `${whS.occupied} of ${whS.locations} locations`, progress: occ, source: 'sim' },
        { key: 'pal', icon: <Package size={11} />, label: 'Pallets stored', value: whS.occupied.toLocaleString(), sub: `${wh.aisles.length} aisles · ${wh.aisles[0]?.levels ?? 0} levels`, progress: occ, source: 'sim' },
        { key: 'rcv', icon: <ArrowLeft size={11} />, label: 'Receiving', value: String(whS.receivingQueue), sub: 'pallets awaiting put-away', progress: Math.min(1, whS.receivingQueue / 8), source: 'sim' },
        { key: 'shp', icon: <Truck size={11} />, label: 'Shipping', value: String(whS.shippingQueue), sub: 'pallets ready to load', progress: Math.min(1, whS.shippingQueue / 8), source: 'sim' },
        { key: 'mv', icon: <ForkliftIcon size={11} />, label: 'Moves / hour', value: String(whMovesPerHour(wh)), sub: `${wh.forklifts.length} reach trucks`, progress: 0.7, source: 'sim' },
      ];
      if (!wh.aisles.length) items.splice(0, 2);
      if (!wh.forklifts.length) items.splice(items.findIndex((k) => k.key === 'mv'), 1);
      if (bSum?.total) items.push({ key: 'eq', icon: <Cog size={11} />, label: 'Equipment up', value: `${bSum.running}/${bSum.total}`, sub: `${bSum.alerts} alert${bSum.alerts === 1 ? '' : 's'} · ${bSum.maint} in maintenance`, progress: bSum.running / bSum.total, source: 'sim' });
      return items;
    }
    const m = yardMetrics(scope, snaps, nowSec, fleet);
    const output = scope.reduce((a, s) => a + cells[s.id].output, 0);
    const target = scope.reduce((a, s) => a + cells[s.id].target, 0);
    const running = scope.reduce((a, s) => a + cells[s.id].running, 0);
    const total = scope.reduce((a, s) => a + cells[s.id].total, 0);
    const alertN = scope.reduce((a, s) => a + cells[s.id].alerts, 0);
    return [
      { key: 'out', icon: <Package size={11} />, label: 'Pallets moved', value: output.toLocaleString(), sub: `today · ${scope.reduce((a, s) => a + cells[s.id].perHour, 0) + m.movesPerHour}/h now`, progress: Math.min(1, output / 20000), source: 'sim' },
      { key: 'trucks', icon: <Truck size={11} />, label: 'Trucks', value: String(m.trucksOnSite), sub: `${m.inbound} arriving now`, spark: series.trucks, sparkMin: 0, delta: deltaOf(series.trucks, (d) => String(d), null), source: yardSrc(false) },
      { key: 'dock', icon: <MapPin size={11} />, label: 'Docks used', value: `${Math.round(m.dockUtil * 100)}%`, sub: 'bays with a truck docked', spark: series.dockUtil.map((x) => x * 100), sparkMin: 0, sparkMax: 100, delta: deltaOf(series.dockUtil.map((x) => x * 100), (d) => `${Math.round(d)} pts`, true), source: yardSrc(false) },
      { key: 'fl', icon: <ForkliftIcon size={11} />, label: 'Forklifts', value: `${Math.round(m.forkliftUtil * 100)}%`, sub: `${m.movesPerHour} pallet moves / h`, spark: series.forkliftUtil.map((x) => x * 100), sparkMin: 0, sparkMax: 100, delta: deltaOf(series.forkliftUtil.map((x) => x * 100), (d) => `${Math.round(d)} pts`, true), source: 'sim' },
      { key: 'turn', icon: <Timer size={11} />, label: 'Turnaround', value: m.turnaroundMin == null ? '—' : `${m.turnaroundMin.toFixed(1)}m`, sub: 'gate in → gate out · 2 h avg', progress: m.turnaroundMin ? Math.min(1, m.turnaroundMin / 30) : 0, source: yardSrc(false) },
      { key: 'run', icon: <Cog size={11} />, label: 'Equipment up', value: `${running}/${total}`, sub: `${alertN} alert${alertN === 1 ? '' : 's'} · ${scope.reduce((a, s) => a + cells[s.id].maint, 0)} in maintenance`, progress: total ? running / total : 0, source: 'sim' },
    ];
  })();

  // ── Mini-map dots ──
  const miniDots = useCallback((): MiniMapDots => {
    const t = clockNow(clockRef.current, offsetRef.current);
    const trucks: [number, number][] = [];
    const forklifts: [number, number][] = [];
    for (const s of SITE_DEFS) {
      for (const b of s.bays) {
        const tr = truckAt(s, b, t, fleetRef.current);
        if (tr && onYard(tr)) trucks.push([s.origin[0] + tr.x, s.origin[2] + tr.z]);
      }
      for (const f of s.forklifts) {
        const p = forkliftAt(s, f, t);
        forklifts.push([s.origin[0] + p.x, s.origin[2] + p.z]);
      }
    }
    const alertPts: [number, number][] = [];
    for (const a of openAlertsRef.current) {
      const s = siteById(a.siteId);
      if (!s) continue;
      const p = livePosRef.current(a.ref);
      alertPts.push(p ? [p[0], p[2]] : [s.origin[0], s.origin[2] - 10]);
    }
    const sel = selectedRef.current;
    const sp = sel ? livePosRef.current(sel) : null;
    return { trucks, forklifts, alerts: alertPts.slice(0, 20), selected: sp ? [sp[0], sp[2]] : null };
  }, []);
  const openAlertsRef = useRef(openAlerts);
  openAlertsRef.current = openAlerts;
  const livePosRef = useRef(livePos);
  livePosRef.current = livePos;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  // ── Search index ──
  const searchItems: SearchItem[] = useMemo(() => {
    if (!searchOpen) return [];
    const items: SearchItem[] = [];
    for (const s of SITE_DEFS) {
      items.push({ key: `site:${s.id}`, type: 'Site', title: `${s.code} · ${s.name}`, sub: `${s.kind} · ${s.buildings.length} buildings · ${s.bays.length} bays`, keywords: s.id, onPick: () => goSite(s.id) });
      for (const b of s.buildings) items.push({ key: `b:${b.id}`, type: 'Building', title: b.label, sub: `${s.code} · ${b.doors.length} doors`, keywords: b.doors.map((d) => d.id).join(' '), onPick: () => selectYard({ kind: 'building', id: b.id }) });
      for (const e of cells[s.id].equip.filter((x) => x.powered)) {
        const b = s.buildings.find((x) => x.id === e.item.buildingId);
        items.push({ key: `e:${e.item.id}`, type: 'Equipment', title: e.item.label, sub: `${e.item.id} · ${s.code} ${b?.label} · ${e.statusLabel}`, keywords: `${KIND[e.item.kind].label} ${e.status}`, onPick: () => goEquipment(e.item.id) });
      }
      const sn = snaps[s.id];
      sn.trucks.forEach((t, i) => {
        if (!t || t.phase === 'none') return;
        const key = `${s.id}:${i}`;
        items.push({ key: `t:${key}`, type: 'Truck', title: t.id, sub: `${t.carrier.name} · ${s.code} ${t.bay.id} · ${t.label}`, keywords: `${t.plate} ${t.driver} ${t.shipmentId}`, onPick: () => selectYard({ kind: 'truck', id: key }) });
        items.push({ key: `sh:${key}`, type: 'Shipment', title: `#${t.shipmentId}`, sub: `${t.id} · ${t.from} → ${t.to}`, keywords: t.id, onPick: () => selectYard({ kind: 'truck', id: key }) });
      });
      for (const f of [...sn.forklifts, ...sn.spares]) items.push({ key: `f:${f.def.id}`, type: 'Forklift', title: f.def.id, sub: `${s.code} · ${f.def.operator} · ${f.statusLabel} · ${f.battery}%`, keywords: f.def.model, onPick: () => selectYard({ kind: 'forklift', id: f.def.id }) });
      for (const c of s.chargers) items.push({ key: `c:${s.id}:${c.id}`, type: 'Charger', title: `${s.code} ${c.id}`, sub: 'Forklift charger', keywords: 'charger', onPick: () => selectYard({ kind: 'charger', id: `${s.id}:${c.id}` }) });
      for (const b of s.bays) items.push({ key: `d:${s.id}:${b.index}`, type: 'Dock bay', title: `${s.code} ${b.id}`, sub: `${b.kind === 'in' ? 'Inbound' : 'Outbound'} dock`, keywords: 'dock bay', onPick: () => selectYard({ kind: 'dock', id: `${s.id}:${b.index}` }) });
      for (const sl of s.slots.slice(0, sn.staged)) items.push({ key: `p:${s.id}:${sl.id}`, type: 'Pallet', title: `${s.code} ${sl.id}`, sub: `${s.stagedLabel} · staging lane`, keywords: 'pallet staged', onPick: () => selectYard({ kind: 'pallet', id: `${s.id}:${sl.id}` }) });
    }
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchOpen]);

  // ── Alert actions ──
  const goAlert = (a: OpsAlert) => {
    if (a.ref.kind === 'machine') goMachine(a.siteId, a.ref.id);
    else selectYard(a.ref);
  };

  // ── Details (tabs) ──
  const reqFor = (key: string) => requests.filter((r) => r.entity === key).slice(0, 5);
  const simRequest = (ref: EntityRef, title: string, description: string, note: string, confirm: string) => setDialog({ kind: 'sim', ref, title, description, note, confirm });

  const renderYardInspector = () => {
    const sel = selected;
    if (!sel || sel.kind === 'site') {
      const s = sel ? siteById(sel.id) : focusSite;
      if (!s) return <NetworkCard snaps={snaps} cells={cells} onPick={goSite} />;
      const siteAlerts = openAlerts.filter((a) => a.siteId === s.id);
      return (
        <DetailTabs
          resetKey={`site:${s.id}`}
          tabs={[
            { key: 'o', label: 'Overview', content: <SiteCard s={s} snap={snaps[s.id]} cell={cells[s.id]} onEnter={() => enterCell(s.id)} /> },
            {
              key: 'a',
              label: `Alerts ${siteAlerts.length || ''}`.trim(),
              content: siteAlerts.length ? (
                <div className="space-y-1">
                  {siteAlerts.map((a) => (
                    <button key={a.id} onClick={() => goAlert(a)} className="flex w-full items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-2 text-left text-[11px] hover:bg-blue-50">
                      <span className="min-w-0">
                        <span className="block truncate font-black text-slate-800">{a.title}</span>
                        <span className="block truncate text-slate-500">{a.detail}</span>
                      </span>
                      <Tag tone={a.severity === 'critical' ? 'amber' : a.severity === 'warning' ? 'amber' : 'blue'}>{a.severity}</Tag>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">No open alerts for this site.</p>
              ),
            },
            {
              key: 'm',
              label: 'Equipment',
              content: (
                <div className="space-y-3">
                  {s.buildings.filter((b) => cells[b.id].equip.some((e) => e.powered)).map((b) => (
                    <div key={b.id}>
                      <div className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">{b.label}</div>
                      {cells[b.id].equip.filter((e) => e.powered).map((e) => (
                        <button key={e.item.id} onClick={() => goEquipment(e.item.id)} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs hover:bg-slate-50">
                          <span className="min-w-0 truncate">
                            <span className="font-black text-slate-800">{e.item.label}</span> <span className="text-slate-400">· {e.issue || e.reading}</span>
                          </span>
                          <Pill status={e.status === 'IDLE' ? 'OFFLINE' : e.status}>{e.statusLabel}</Pill>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              ),
            },
          ]}
        />
      );
    }
    const s = siteOfRef(sel);
    if (!s) return null;
    const entityKey = `${sel.kind}:${sel.id}`;

    if (sel.kind === 'building') {
      return (
        <>
          <BuildingCard site={s} buildingId={sel.id} cell={cells[sel.id]} machines={cells[sel.id].equip.filter((e) => e.powered).map((e) => ({ code: e.item.label, status: e.status === 'IDLE' ? 'OFFLINE' : e.status }))} onEnter={() => enterCell(s.id, undefined, sel.id)} />
          <ActionBar onCopyLink={copyLink} />
        </>
      );
    }

    if (sel.kind === 'truck') {
      const t = truckByKey(sel.id);
      if (!t) return null;
      const bayIdx = Number(sel.id.split(':')[1]);
      const fl = forkliftForBay(s, bayIdx);
      const events = truckEvents(s, t.bay, nowSec, fleet);
      const per = t.pallets.total ? t.cargoTonnes / t.pallets.total : 0.9;
      const manifest = Array.from({ length: t.pallets.total }, (_, i) => ({
        id: `PLT-${t.shipmentId.replace(/\D/g, '').slice(-4)}-${String(i + 1).padStart(2, '0')}`,
        contents: t.kind === 'in' ? `From ${t.from}` : s.stagedLabel,
        weight: `${per.toFixed(1)} t`,
        done: i < t.pallets.done,
      }));
      const history = bayVisits(s, t.bay, nowSec - 7200, nowSec, fleet).filter((v) => v.undock <= nowSec).reverse();
      return (
        <>
          <ActionBar
            following={following?.kind === 'truck' && following.id === sel.id}
            onFollow={onYard(t) ? () => (following ? stopFollow() : startFollow(sel)) : undefined}
            onCopyLink={copyLink}
            actions={[
              {
                label: t.live ? 'Request dispatch' : 'Reassign bay',
                icon: <Shuffle size={12} />,
                onClick: () =>
                  simRequest(
                    sel,
                    t.live ? `Request dispatch · ${t.id}` : `Reassign ${t.id}`,
                    t.live ? 'Logs a dispatch request for this truck on this page. Automatic dispatch still runs when the truck is full.' : 'Logs a bay change request on this page. The simulated yard keeps its schedule.',
                    t.live ? `Dispatch ${t.id} with ${t.pallets.done} pallets` : `Move ${t.id} from ${t.bay.id} to another free bay`,
                    'Log request'
                  ),
              },
            ]}
          />
          <div className="mt-3" />
          <DetailTabs
            resetKey={entityKey}
            tabs={[
              {
                key: 'o',
                label: 'Overview',
                content: (
                  <>
                    <TruckCard t={t} />
                    <Related
                      items={[
                        { label: `${s.code} ${t.bay.id}`, sub: `${t.kind === 'in' ? 'inbound' : 'outbound'} dock`, onClick: () => selectYard({ kind: 'dock', id: sel.id }) },
                        ...(fl ? [{ label: fl.id, sub: `forklift serving this bay · ${fl.operator}`, onClick: () => selectYard({ kind: 'forklift', id: fl.id }) }] : []),
                      ]}
                    />
                  </>
                ),
              },
              {
                key: 'a',
                label: 'Activity',
                content: (
                  <>
                    <div className="mb-2 flex items-center gap-2 text-[11px] font-black text-slate-700">
                      This visit <SourceTag source={t.live ? 'live' : 'sim'} />
                    </div>
                    <EventTimeline events={events} now={nowSec} />
                    <div className="mb-1.5 mt-4 text-[11px] font-black text-slate-700">Manifest · {t.pallets.total} pallets</div>
                    <Manifest rows={manifest} doneLabel={t.kind === 'in' ? 'Unloaded' : 'Loaded'} />
                  </>
                ),
              },
              {
                key: 'h',
                label: 'History',
                content: (
                  <>
                    <div className="mb-1.5 text-[11px] font-black text-slate-700">Earlier visits at {t.bay.id} · last 2 h</div>
                    <VisitList visits={history} now={nowSec} />
                    <RequestLog items={reqFor(entityKey)} now={Date.now() / 1000} />
                  </>
                ),
              },
            ]}
          />
        </>
      );
    }

    if (sel.kind === 'dock') {
      const i = Number(sel.id.split(':')[1]);
      const bay = s.bays[i];
      const t = snaps[s.id].trucks[i];
      const fl = forkliftForBay(s, i);
      const mid = Math.floor((nowSec + 19800) / 86400) * 86400 - 19800;
      const today = bayVisits(s, bay, mid, nowSec, fleet);
      const docked = today.reduce((a, v) => a + Math.max(0, Math.min(v.undock, nowSec) - v.docked), 0);
      return (
        <>
          <ActionBar onCopyLink={copyLink} />
          <div className="mt-3" />
          <DetailTabs
            resetKey={entityKey}
            tabs={[
              {
                key: 'o',
                label: 'Overview',
                content: (
                  <>
                    <DockCard bay={bay} site={s} t={t} />
                    <Related
                      items={[
                        ...(t && t.phase !== 'none' ? [{ label: t.id, sub: `${t.carrier.name} · ${t.label}`, onClick: () => selectYard({ kind: 'truck', id: sel.id }) }] : []),
                        ...(fl ? [{ label: fl.id, sub: `forklift serving this bay`, onClick: () => selectYard({ kind: 'forklift', id: fl.id }) }] : []),
                      ]}
                    />
                  </>
                ),
              },
              { key: 'a', label: 'Activity', content: <EventTimeline events={truckEvents(s, bay, nowSec, fleet)} now={nowSec} /> },
              {
                key: 'h',
                label: 'History',
                content: (
                  <>
                    <div className="mb-2 grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-slate-50 p-2.5">
                        <div className="text-[10px] font-bold text-slate-400">Trucks today</div>
                        <div className="text-base font-black text-slate-900">{today.length}</div>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-2.5">
                        <div className="text-[10px] font-bold text-slate-400">Occupied today</div>
                        <div className="text-base font-black text-slate-900">{Math.round((docked / Math.max(1, nowSec - mid)) * 100)}%</div>
                      </div>
                    </div>
                    <VisitList visits={today.slice(-10).reverse()} now={nowSec} empty="No trucks yet today." />
                  </>
                ),
              },
            ]}
          />
        </>
      );
    }

    if (sel.kind === 'forklift') {
      const hit = forkliftById(sel.id);
      if (!hit) return null;
      const def = hit.s.forklifts.find((f) => f.id === sel.id);
      const util = def ? forkliftUtilisation(hit.s, def) : null;
      const bay = def?.bay !== undefined ? hit.s.bays[def.bay] : undefined;
      return (
        <>
          <ActionBar
            following={following?.kind === 'forklift' && following.id === sel.id}
            onFollow={def ? () => (following ? stopFollow() : startFollow(sel)) : undefined}
            onCopyLink={copyLink}
            actions={
              def
                ? [
                    {
                      label: 'Send to charge',
                      icon: <BatteryCharging size={12} />,
                      onClick: () => simRequest(sel, `Send ${def.id} to charge`, 'Logs a charge request on this page. The simulated forklift keeps its planned schedule (it charges at the end of each cycle).', `Send ${def.id} to ${hit.f.charger} now (battery ${hit.f.battery}%)`, 'Log request'),
                    },
                  ]
                : []
            }
          />
          <div className="mt-3" />
          <DetailTabs
            resetKey={entityKey}
            tabs={[
              {
                key: 'o',
                label: 'Overview',
                content: (
                  <>
                    <ForkliftCard f={hit.f} site={hit.s} />
                    <Related
                      items={[
                        ...(bay ? [{ label: `${hit.s.code} ${bay.id}`, sub: 'bay it serves', onClick: () => selectYard({ kind: 'dock', id: `${hit.s.id}:${bay.index}` }) }] : []),
                        ...(def ? [{ label: `${hit.s.code} ${hit.f.charger}`, sub: 'its charger', onClick: () => selectYard({ kind: 'charger', id: `${hit.s.id}:${hit.f.charger}` }) }] : []),
                      ]}
                    />
                  </>
                ),
              },
              { key: 'a', label: 'Activity', content: def ? <TaskLog tasks={forkliftTaskLog(hit.s, def, nowSec, 12)} now={nowSec} /> : <p className="text-xs text-slate-400">Spare forklift — no tasks today.</p> },
              {
                key: 'h',
                label: 'History',
                content: def ? (
                  <div className="space-y-4">
                    <BatteryChart values={batterySeries(hit.s, def, nowSec)} />
                    {util && <UtilBar u={util} />}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-slate-50 p-2.5">
                        <div className="text-[10px] font-bold text-slate-400">Moves per hour</div>
                        <div className="text-base font-black text-slate-900">{util?.movesPerHour}</div>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-2.5">
                        <div className="text-[10px] font-bold text-slate-400">Moves today</div>
                        <div className="text-base font-black text-slate-900">{hit.f.movesToday}</div>
                      </div>
                    </div>
                    <RequestLog items={reqFor(entityKey)} now={Date.now() / 1000} />
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Fully charged and parked.</p>
                ),
              },
            ]}
          />
        </>
      );
    }

    if (sel.kind === 'charger') {
      const idx = s.chargers.findIndex((c) => `${s.id}:${c.id}` === sel.id);
      if (idx < 0) return null;
      const c = chargerAt(s, idx, nowSec);
      const users = s.forklifts.filter((f) => f.charger === idx);
      return (
        <>
          <ActionBar onCopyLink={copyLink} />
          <div className="mt-3" />
          <DetailTabs
            resetKey={entityKey}
            tabs={[
              { key: 'o', label: 'Overview', content: <ChargerCard c={c} site={s} /> },
              {
                key: 'h',
                label: 'Forklifts',
                content: (
                  <div className="space-y-4">
                    {users.map((f) => (
                      <div key={f.id}>
                        <button onClick={() => selectYard({ kind: 'forklift', id: f.id })} className="mb-1 text-[11px] font-black text-blue-600 hover:underline">
                          {f.id} · {f.operator}
                        </button>
                        <BatteryChart values={batterySeries(s, f, nowSec)} />
                      </div>
                    ))}
                  </div>
                ),
              },
            ]}
          />
        </>
      );
    }

    if (sel.kind === 'pallet') {
      return (
        <>
          <PalletCard id={sel.id.split(':')[1]} site={s} />
          <ActionBar onCopyLink={copyLink} />
        </>
      );
    }
    return null;
  };

  const renderCellInspector = () => {
    if (!wh || !whS) return null;
    const bEquip = cells[wh.building.id]?.equip || [];
    if (!selected) {
      return (
        <WarehouseOverview
          wh={wh}
          stats={whS}
          nowSec={nowSec}
          equipment={bEquip}
          onEquipment={(id) => selectInterior({ kind: 'equipment', id })}
          others={wh.site.buildings.filter((b) => b.id !== wh.building.id).map((b) => ({ id: b.id, label: b.label }))}
          onAisle={(id) => selectInterior({ kind: 'aisle', id })}
          onReach={(id) => selectInterior({ kind: 'reach', id })}
          onBuilding={(id) => enterCell(wh.site.id, undefined, id)}
        />
      );
    }
    if (selected.kind === 'location') return <LocationCard wh={wh} id={selected.id} nowSec={nowSec} />;
    if (selected.kind === 'aisle') {
      const a = wh.aisles.find((x) => x.id === selected.id);
      return a ? <AisleCard wh={wh} aisle={a} nowSec={nowSec} onLoc={(id) => selectInterior({ kind: 'location', id })} /> : null;
    }
    if (selected.kind === 'zone') {
      const z = wh.zones.find((x) => x.id === selected.id);
      return z ? <ZoneCard wh={wh} zone={z} stats={whS} /> : null;
    }
    if (selected.kind === 'reach') {
      const f = wh.forklifts.find((x) => x.id === selected.id);
      return f ? <ReachCard wh={wh} s={reachAt(wh, f, nowSec)} /> : null;
    }
    if (selected.kind === 'equipment') {
      const e = bEquip.find((x) => x.item.id === selected.id);
      return e ? (
        <EquipmentCard
          s={equipAt(e.item, nowSec)}
          buildingLabel={wh.building.label}
          nowSec={nowSec}
          onRequest={() => simRequest(selected, `Request maintenance · ${e.item.label}`, 'Logs a maintenance request for this equipment on this page (the simulated equipment keeps its schedule).', e.issue ? `${e.item.label}: ${e.issue}` : `Service check for ${e.item.label}`, 'Log request')}
        />
      ) : null;
    }
    if (!cell || !cellSum) return null;
    if (selected.kind === 'machine' || selected.kind === 'technician') {
      const code = selected.kind === 'machine' ? selected.id : woCode(openWOs.find((w) => w.id === selected.id)!);
      const m = byCode.get(code);
      const station = cell.stations.find((x) => x.code === code);
      const t = telemetryMap[code];
      const fresh = isFresh(code);
      const d = day[code];
      const wo = cellWOs.find((w) => woCode(w) === code);
      const inc = cellIncidents.find((i) => incCode(i) === code);
      const mid = Math.floor((nowSec + 19800) / 86400) * 86400 - 19800;
      const machineWOs = workOrders.filter((w) => woCode(w) === code).slice(0, 6);
      const machineIncs = incidents.filter((i) => incCode(i) === code).slice(0, 6);
      const overview = (
        <>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <SectionLabel>
                {selected.kind === 'technician' ? 'Technician job' : 'Machine'} · {station?.bay}
              </SectionLabel>
              <div className="mt-0.5 flex items-center gap-2 text-lg font-black text-slate-900">
                {code} <SourceTag source="live" />
              </div>
              <div className="text-xs text-slate-500">{m?.name || 'Not registered'}</div>
            </div>
            <Pill status={m?.status} />
          </div>
          <div className="mt-3 rounded-xl bg-slate-50 p-3">
            <div className="mb-2 flex items-center justify-between text-[11px] font-bold text-slate-500">
              <span>Live telemetry</span>
              <span className={fresh ? 'text-emerald-600' : 'text-slate-400'}>{fresh ? '● streaming' : `last ${ago(t?.timestamp)}`}</span>
            </div>
            {t ? (
              <div className={`grid grid-cols-2 gap-2 text-xs ${fresh ? '' : 'opacity-60'}`}>
                <Metric icon={<Thermometer size={13} />} label="Temp" value={`${t.temperature?.toFixed(1)} °C`} warn={t.temperature >= 70} />
                <Metric icon={<Waves size={13} />} label="Vibration" value={`${t.vibration?.toFixed(2)} mm/s`} warn={t.vibration >= 5} />
                <Metric icon={<Zap size={13} />} label="Current" value={`${t.current?.toFixed(1)} A`} warn={t.current >= 15} />
                <Metric icon={<Gauge size={13} />} label="Speed" value={`${Math.round(t.rpm || 0)} rpm`} />
              </div>
            ) : (
              <div className="text-xs text-slate-400">No telemetry received for this machine yet.</div>
            )}
          </div>
          <div className="mt-3 space-y-2 text-xs text-slate-600">
            <Row icon={<Package size={14} />} label="Output today" value={d ? `${d.actual_pieces} / ${d.target_pieces} pcs` : '—'} />
            <Row icon={<Activity size={14} />} label="Runtime / downtime" value={d ? `${fmtDur(d.runtime_seconds)} / ${fmtDur(d.downtime_seconds)}` : '—'} />
            <Row icon={<Cog size={14} />} label="Health score" value={m ? `${Math.round(m.health_score)}%` : '—'} />
          </div>
          {inc && (
            <div className="mt-3 rounded-xl border border-red-100 bg-red-50 p-3 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-red-700">
                <AlertTriangle size={13} /> {inc.alert_type.replace(/_/g, ' ')} · {inc.severity}
              </div>
              <div className="mt-1 text-red-600/80">
                Detected {fmtTime(inc.detected_at)} IST · {inc.status.replace(/_/g, ' ')}
              </div>
              {inc.ai_root_cause && <div className="mt-1 text-slate-600">{inc.ai_root_cause}</div>}
            </div>
          )}
          {wo ? (
            <button onClick={() => setTrackFor({ kind: 'technician', id: wo.id })} className="mt-3 w-full rounded-xl border border-blue-100 bg-blue-50 p-3 text-left text-xs hover:bg-blue-100">
              <div className="flex items-center justify-between font-bold text-blue-800">
                <span className="flex items-center gap-1.5">
                  <ClipboardList size={13} /> Work order {wo.priority}
                </span>
                <span>{TECH_PHASE_LABEL[String(wo.technician_phase || '').toUpperCase()] || wo.status}</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-blue-700/80">
                <User size={12} /> {wo.technician_name || 'Awaiting assignment'} · show progress
              </div>
            </button>
          ) : (
            <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-400">No open work order.</div>
          )}
        </>
      );
      return (
        <>
          <ActionBar
            onCopyLink={copyLink}
            actions={[{ label: 'Create work order', icon: <Wrench size={12} />, tone: 'primary', onClick: () => setDialog({ kind: 'wo', code }) }]}
          />
          <div className="mt-3" />
          <DetailTabs
            resetKey={`machine:${code}`}
            tabs={[
              { key: 'o', label: 'Overview', content: overview },
              {
                key: 'a',
                label: 'Activity',
                content: (
                  <div className="space-y-3">
                    <div>
                      <div className="mb-1 text-[11px] font-black text-slate-700">Incidents</div>
                      {machineIncs.length ? (
                        machineIncs.map((i) => (
                          <div key={i.id} className="mb-1 flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1.5 text-[11px]">
                            <span className="truncate font-bold text-slate-700">{i.alert_type.replace(/_/g, ' ')}</span>
                            <span className="shrink-0 text-slate-400">
                              {i.severity} · {ago(i.detected_at)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400">No incidents recorded.</p>
                      )}
                    </div>
                    <div>
                      <div className="mb-1 text-[11px] font-black text-slate-700">Work orders</div>
                      {machineWOs.length ? (
                        machineWOs.map((w) => (
                          <div key={w.id} className="mb-1 flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1.5 text-[11px]">
                            <span className="truncate font-bold text-slate-700">
                              {w.id.slice(0, 14)} · {w.priority}
                            </span>
                            <span className="shrink-0 text-slate-400">{w.status.replace(/_/g, ' ').toLowerCase()}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400">No work orders.</p>
                      )}
                    </div>
                    <RequestLog items={reqFor(`machine:${code}`)} now={Date.now() / 1000} />
                  </div>
                ),
              },
              {
                key: 'h',
                label: 'Today',
                content: d?.timeline_segments?.length ? (
                  <Gantt
                    rows={[{ id: code, label: code, sub: 'state', spans: d.timeline_segments.map((g) => ({ from: mid + g.startHour * 3600, to: mid + g.endHour * 3600, color: STATE_COLOR[g.status] || '#CBD5E1', label: g.status.toLowerCase() })) }]}
                    from={mid}
                    to={nowSec}
                    now={nowSec}
                    tickEvery={6 * 3600}
                  />
                ) : (
                  <p className="text-xs text-slate-400">No machine timeline recorded today.</p>
                ),
              },
            ]}
          />
        </>
      );
    }
    if (selected.kind === 'agv') {
      return (
        <>
          <SectionLabel>Material handling</SectionLabel>
          <div className="mt-0.5 flex items-center gap-2 text-lg font-black text-slate-900">
            <Bot size={18} /> AGV-01 <SourceTag source="sim" />
          </div>
          <div className="mt-3 space-y-2 text-xs text-slate-600">
            <Row icon={<MapPin size={14} />} label="Route" value="Inbound → aisle → outbound" />
            <Row icon={<Package size={14} />} label="Load" value={cell.staging[0].label} />
          </div>
        </>
      );
    }
    const st = cell.staging.find((x) => x.id === selected.id);
    return (
      <>
        <SectionLabel>Staging slot</SectionLabel>
        <div className="mt-0.5 text-lg font-black text-slate-900">{st?.id}</div>
        <div className="mt-3 space-y-2 text-xs text-slate-600">
          <Row icon={<Package size={14} />} label="Contents" value={st?.label || '—'} />
          <Row icon={<Layers size={14} />} label="Type" value={st?.kind === 'raw' ? 'Inbound' : 'Outbound'} />
        </div>
      </>
    );
  };

  // ── Bottom-left tracker ──
  const renderTracker = () => {
    if (!trackFor) return null;
    if (trackFor.kind === 'technician') {
      const wo = workOrders.find((w) => w.id === trackFor.id);
      if (!wo) return null;
      const inc = incidentById.get(wo.incident_id);
      const defs: [string, string | undefined][] = [
        ['Detected', inc?.detected_at],
        ['Assigned', inc?.assigned_at],
        ['En route', inc?.technician_dispatched_at],
        ['On site', inc?.technician_arrived_at],
        ['LOTO', inc?.loto_completed_at || inc?.loto_started_at],
        ['Repair', inc?.repair_completed_at || inc?.repair_started_at],
        ['Verify', inc?.verification_completed_at || inc?.verification_started_at],
        ['Running', inc?.machine_running_at],
      ];
      const steps = defs.map(([label, at]) => ({ label, at, done: !!at }));
      return (
        <Stepper
          eyebrow="Work order"
          title={`${wo.id.slice(0, 14)} · ${woCode(wo)}`}
          subtitle={`${inc?.alert_type?.replace(/_/g, ' ') || 'Maintenance'} · ${wo.technician_name || 'Unassigned'} · ${TECH_PHASE_LABEL[String(wo.technician_phase || '').toUpperCase()] || wo.status}`}
          steps={steps}
          current={steps.map((x) => x.done).lastIndexOf(true) + 1}
          onClose={() => setTrackFor(null)}
        />
      );
    }
    const t = truckByKey(trackFor.id);
    if (!t) return null;
    const s = siteOfRef(trackFor)!;
    const mins = t.eta ? Math.max(0, Math.round((Date.parse(t.eta) / 1000 - nowSec) / 60)) : null;
    return (
      <Stepper
        eyebrow="Shipment tracking"
        title={`${t.id} · ${t.carrier.name}`}
        subtitle={`${t.from} → ${t.to}`}
        steps={t.steps}
        current={t.current}
        onClose={() => setTrackFor(null)}
        aside={
          <button onClick={() => selectYard({ kind: 'truck', id: t.key })} className="flex h-full w-full items-center gap-3 rounded-xl bg-slate-50 p-3 text-left hover:bg-blue-50">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
              <Truck size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-black text-slate-900">#{t.shipmentId}</span>
              <span className="block truncate text-[11px] text-slate-500">To: {t.to}</span>
              <span className="mt-1 block">
                <Tag tone={t.tone}>{t.label.replace(/ \d+\/\d+$/, '')}</Tag>
              </span>
              <span className="mt-1 block truncate text-[11px] text-slate-400">
                {s.code} · {t.bay.id}
                {mins !== null && t.phase !== 'away' ? ` · ${mins} min left` : ''}
              </span>
            </span>
          </button>
        }
      />
    );
  };

  // ── Queues ──
  const yardTrucks = scope.flatMap((s) => snaps[s.id].trucks.filter((t): t is TruckSnap => !!t && t.phase !== 'none'));
  const yardForklifts = scope.flatMap((s) => [...snaps[s.id].forklifts, ...snaps[s.id].spares].map((f) => ({ f, s })));
  const busyDocks = scope.reduce((a, s) => a + snaps[s.id].trucks.filter((t) => t?.phase === 'docked').length, 0);
  const totalDocks = scope.reduce((a, s) => a + s.bays.length, 0);
  const working = yardForklifts.filter(({ f }) => !['charging', 'idle', 'parked'].includes(f.status)).length;

  const yardQueue = (
    <QueueCard
      tabs={[['docks', `Docks ${busyDocks}/${totalDocks}`, -1], ['forklifts', `Forklifts ${working}/${yardForklifts.length}`, -1], ['trucks', 'Trucks', yardTrucks.filter(onYard).length]] as const}
      active={yardTab}
      onTab={setYardTab}
      title={focusSite ? focusSite.name : 'All sites'}
    >
      {yardTab === 'docks' &&
        scope.flatMap((s) =>
          s.bays.map((b) => (
            <DockRow
              key={`${s.id}:${b.index}`}
              site={s}
              bay={b}
              t={snaps[s.id].trucks[b.index]}
              showSite={showSite}
              active={selected?.kind === 'dock' && selected.id === `${s.id}:${b.index}`}
              onClick={() => selectYard({ kind: 'dock', id: `${s.id}:${b.index}` })}
            />
          ))
        )}
      {yardTab === 'forklifts' &&
        yardForklifts.map(({ f, s }) => (
          <ForkliftRow key={f.def.id} f={f} site={s} showSite={showSite} active={selected?.kind === 'forklift' && selected.id === f.def.id} onClick={() => selectYard({ kind: 'forklift', id: f.def.id })} />
        ))}
      {yardTab === 'trucks' &&
        (yardTrucks.length ? (
          yardTrucks.map((t) => <TruckRow key={t.key} t={t} active={selected?.kind === 'truck' && selected.id === t.key} onClick={() => selectYard({ kind: 'truck', id: t.key })} />)
        ) : (
          <Empty text="No trucks for this site right now." />
        ))}
    </QueueCard>
  );

  const equipKey = sceneMachines.map((m) => `${m.code}:${m.status}:${m.label}`).join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const equipMap = useMemo(() => new Map(sceneMachines.map((m) => [m.code, { status: m.status, label: m.label }])), [equipKey]);
  const cellQueue = wh && whS && (
    <QueueCard
      tabs={[...(wh.aisles.length ? [['aisles', 'Aisles', wh.aisles.length]] : []), ...(wh.forklifts.length ? [['trucks', 'Reach trucks', wh.forklifts.length]] : []), ...(wh.equipment.length ? [['equipment', wh.role === 'service' ? 'Workshop' : 'Equipment', wh.equipment.length]] : [])] as any}
      active={wh.aisles.length ? whTab : 'equipment'}
      onTab={setWhTab}
      title={wh.building.label}
    >
      {whTab === 'aisles' &&
        whS.byAisle.map((a) => (
          <QueueRow key={a.id} active={selected?.kind === 'aisle' && selected.id === a.id} onClick={() => selectInterior({ kind: 'aisle', id: a.id })}>
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="w-14 shrink-0 text-xs font-black text-slate-800">Aisle {a.id}</div>
              <div className="flex flex-1 items-center gap-2">
                <Bar value={a.total ? a.occupied / a.total : 0} tone={a.occupied / Math.max(1, a.total) > 0.9 ? 'amber' : 'blue'} className="flex-1" />
                <span className="w-16 text-right text-[11px] tabular-nums text-slate-500">{a.occupied}/{a.total} full</span>
              </div>
            </div>
          </QueueRow>
        ))}
      {whTab === 'trucks' &&
        wh.forklifts.map((f) => {
          const r = reachAt(wh, f, nowSec);
          return (
            <QueueRow key={f.id} active={selected?.kind === 'reach' && selected.id === f.id} onClick={() => selectInterior({ kind: 'reach', id: f.id })}>
              <div className="min-w-0">
                <div className="text-xs font-black text-slate-800">
                  {f.id} <span className="font-medium text-slate-400">· {f.operator}</span>
                </div>
                <div className="truncate text-[11px] text-slate-500">{r.detail}</div>
              </div>
              <Tag tone={r.status === 'waiting' ? 'slate' : r.status === 'lifting' ? 'amber' : 'green'}>{r.status}</Tag>
            </QueueRow>
          );
        })}
      {(whTab === 'equipment' || !wh.aisles.length) &&
        (cells[wh.building.id]?.equip || []).map((e) => (
          <QueueRow key={e.item.id} active={selected?.kind === 'equipment' && selected.id === e.item.id} onClick={() => selectInterior({ kind: 'equipment', id: e.item.id })}>
            <div className="min-w-0">
              <div className="text-xs font-black text-slate-800">{e.item.label}</div>
              <div className="truncate text-[11px] text-slate-500">{e.issue || e.reading}</div>
            </div>
            <Tag tone={!e.powered ? 'slate' : e.status === 'RUNNING' ? 'green' : e.status === 'MAINTENANCE' ? 'blue' : e.status === 'IDLE' ? 'slate' : 'amber'}>{e.statusLabel}</Tag>
          </QueueRow>
        ))}
    </QueueCard>
  );

  // ── Switcher ──
  const switcherLabel = mode === 'interior' && wh ? `${wh.site.code} · ${wh.building.label}` : focusSite ? `${focusSite.code} · ${focusSite.name}` : 'Campus Logistics Hub';
  const switcherSub = (() => {
    const s = mode === 'interior' && cell ? siteById(cell.id) : focusSite;
    if (!s) return `${SITE_DEFS.length} warehouse hubs · all facilities`;
    const sn = snaps[s.id];
    return `${Math.round((sn.staged / Math.max(1, s.slots.length)) * 100)}% full · ${sn.docked}/${s.bays.length} docked`;
  })();
  const critical = openAlerts.filter((a) => a.severity === 'critical').length;

  return (
    <div ref={rootRef} className={`ops-twin relative flex h-screen w-full flex-col overflow-hidden bg-[#E6ECF5] ${theme === 'dark' ? 'ops-dark' : ''}`}>
      {/* ── Header bar: site selector · metrics · clock + tools (kept off the 3D view) ── */}
      <header className="relative z-30 flex h-[72px] shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 shadow-[0_1px_0_rgba(15,23,42,0.03)]">
        {mode === 'interior' && (
          <button onClick={() => goSite(interiorId)} title="Back to campus yard" aria-label="Back to campus yard" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-blue-600">
            <ArrowLeft size={18} />
          </button>
        )}
        <div className="relative shrink-0">
          <button onClick={() => setSwitcher((v) => !v)} className={`flex h-12 max-w-[330px] items-center gap-2.5 rounded-xl px-2 text-left transition ${switcher ? 'bg-slate-100' : 'hover:bg-slate-50'}`}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              {focusSite || cell ? <Warehouse size={17} /> : <LayoutGrid size={17} />}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-black text-slate-900">{switcherLabel}</span>
              <span className="block truncate text-[11px] text-slate-400">{switcherSub}</span>
            </span>
            <ChevronDown size={16} className={`shrink-0 text-slate-400 transition ${switcher ? 'rotate-180' : ''}`} />
          </button>
          {switcher && (
            <div className="absolute left-0 top-full z-40 mt-2 w-[340px] rounded-2xl border border-slate-100 bg-white p-1.5 shadow-2xl">
              <button onClick={goNetwork} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${!focusSite && mode === 'yard' ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                <LayoutGrid size={16} className="shrink-0 text-slate-500" />
                <span>
                  <span className="block text-sm font-black text-slate-800">Campus Overview</span>
                  <span className="block text-[11px] text-slate-400">All {SITE_DEFS.length} warehouse hubs</span>
                </span>
              </button>
              <div className="my-1 h-px bg-slate-100" />
              {SITE_DEFS.map((s) => {
                const sn = snaps[s.id];
                const fill = sn.staged / Math.max(1, s.slots.length);
                const active = focus === s.id;
                const st = statusOf(cells[s.id].worst);
                return (
                  <button key={s.id} onClick={() => goSite(s.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left ${active ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: st.color }} title={`Machines: ${st.label}`} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className={`truncate text-sm ${active ? 'font-black text-blue-700' : 'font-bold text-slate-800'}`}>
                          {s.code} · {s.name}
                        </span>
                        <span className="shrink-0 text-[11px] font-bold text-slate-500">{Math.round(fill * 100)}%</span>
                      </span>
                      <Bar value={fill} className="my-1" />
                      <span className="block text-[11px] text-slate-400">
                        {sn.docked}/{s.bays.length} docked · {sn.arriving} inbound · {cells[s.id].running}/{cells[s.id].total} equipment up
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <span className="mx-1 h-10 w-px shrink-0 bg-slate-200" />
        <div className="flex h-full min-w-0 flex-1 items-center overflow-hidden py-2">
          {kpis.map((k) => (
            <KpiStat key={k.key} k={k} />
          ))}
        </div>
        <span className="mx-1 h-10 w-px shrink-0 bg-slate-200" />

        <ClockPill clock={clock} setClock={setClock} offsetMs={clockOffset} />
        <div className="relative shrink-0">
          <Toolbar
            onSearch={() => setSearchOpen(true)}
            alertsOpen={panel === 'alerts'}
            onAlerts={() => setPanel((p) => (p === 'alerts' ? null : 'alerts'))}
            alertCount={openAlerts.length}
            critical={critical}
            analyticsOpen={panel === 'analytics'}
            onAnalytics={() => setPanel((p) => (p === 'analytics' ? null : 'analytics'))}
            layersOpen={layersOpen}
            onLayers={() => setLayersOpen((v) => !v)}
            fullscreen={fullscreen}
            onFullscreen={toggleFullscreen}
            onHelp={() => setHelpOpen(true)}
          />
          {layersOpen && (
            <div className="absolute right-0 top-full z-40 mt-2">
              <LayersMenu
                layers={layers}
                setLayers={setLayers}
                timeOfDay={timeOfDay}
                setTimeOfDay={setTimeOfDay}
                theme={theme}
                setTheme={setTheme}
                minimap={false}
                setMinimap={() => {}}
                onClose={() => setLayersOpen(false)}
              />
            </div>
          )}
        </div>
      </header>

      {/* ── 3D view + docked panels ── */}
      <div className="relative min-h-0 flex-1 cursor-grab active:cursor-grabbing">
        <div className="absolute inset-0 z-0">
          {mode === 'interior' && wh ? (
            <WarehouseScene key={wh.key} wh={wh} now={nowFn} selected={selected} onSelect={selectInterior} cameraRef={cameraRef} night={night} labels={layers.labels} />
          ) : (
            <YardScene
              fleet={fleet}
              now={nowFn}
              cellStatus={cellStatus}
              selected={selected}
              onSelect={selectYard}
              onEnter={enterCell}
              cameraRef={cameraRef}
              layers={layers}
              alertKeys={alertKeys}
              night={night}
              onUserInteract={() => setFollowing(null)}
            />
          )}
        </div>

        {/* replay controls + follow badge, top centre */}
        <div className="pointer-events-none absolute left-1/2 top-3 z-20 flex -translate-x-1/2 cursor-default flex-col items-center gap-2">
          {clock.mode === 'replay' && (
            <div className="pointer-events-auto">
              <ReplayBar clock={clock} setClock={setClock} offsetMs={clockOffset} />
            </div>
          )}
          {following && (
            <button onClick={stopFollow} className="pointer-events-auto rounded-full bg-blue-600 px-3 py-1 text-[11px] font-black text-white shadow-lg">
              Following {following.kind === 'truck' ? truckByKey(following.id)?.id : following.id} · click or drag to stop
            </button>
          )}
        </div>

        {/* alerts / analytics drawer, top left */}
        {panel && (
          <div className="pointer-events-none absolute bottom-4 left-4 top-4 z-20 flex cursor-default">
            <div className="pointer-events-auto flex max-h-full min-h-0">
              {panel === 'alerts' ? (
                <AlertsPanel alerts={alerts} acked={acked} onAck={ack} onGo={goAlert} onClose={() => setPanel(null)} />
              ) : (
                <AnalyticsDrawer
                  scope={mode === 'interior' && cell ? [siteById(cell.id)!] : scope}
                  title={mode === 'interior' && cell ? cell.label : focusSite ? focusSite.name : 'All sites'}
                  nowSec={nowSec}
                  fleet={fleet}
                  onSelect={(ref) => (mode === 'interior' ? goSite(siteOfRef(ref)?.id || interiorId) : selectYard(ref))}
                  onEquipment={goEquipment}
                  onClose={() => setPanel(null)}
                />
              )}
            </div>
          </div>
        )}

        {/* shipment / work-order tracking, bottom left */}
        {!panel && (
          <div className="absolute bottom-4 left-4 z-10 cursor-default" style={{ width: 'min(880px, calc(100% - 590px))' }}>
            {renderTracker()}
          </div>
        )}

        {/* map controls */}
        <div className={`absolute top-4 z-10 hidden cursor-default flex-col gap-1.5 md:flex ${inspectorOpen ? 'right-[372px]' : 'right-4'}`}>
          {!inspectorOpen && (
            <button onClick={() => toggleInspector(true)} title="Show details panel" aria-label="Show details panel" className="mb-1 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-[0_6px_18px_rgba(37,99,235,0.35)] hover:bg-blue-700">
              <PanelRightOpen size={16} />
            </button>
          )}
          {[
            { icon: <Plus size={16} />, label: 'Zoom in (+)', fn: () => cameraRef.current?.zoom(0.7) },
            { icon: <Minus size={16} />, label: 'Zoom out (−)', fn: () => cameraRef.current?.zoom(1.4) },
            { icon: <RotateCcw size={16} />, label: 'Rotate left ([)', fn: () => cameraRef.current?.rotate(-45) },
            { icon: <RotateCw size={16} />, label: 'Rotate right (])', fn: () => cameraRef.current?.rotate(45) },
            { icon: <ChevronsUp size={16} />, label: 'Tilt up (PgUp)', fn: () => cameraRef.current?.tilt(15) },
            { icon: <ChevronsDown size={16} />, label: 'Tilt down (PgDn)', fn: () => cameraRef.current?.tilt(-15) },
            { icon: <Home size={16} />, label: 'Reset view (H)', fn: () => (mode === 'yard' && focusSite ? selectYard({ kind: 'site', id: focusSite.id }) : cameraRef.current?.home()) },
          ].map((b) => (
            <button key={b.label} title={b.label} aria-label={b.label} onClick={b.fn} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/95 text-slate-600 shadow-[0_6px_18px_rgba(15,23,42,0.12)] hover:text-blue-600">
              {b.icon}
            </button>
          ))}
        </div>

        {/* details panel (collapsible) */}
        {inspectorOpen && (
          <Card style={{ maxHeight: `calc(100% - ${queueH + 44}px)` }} className="absolute right-4 top-4 z-10 hidden w-[340px] cursor-default flex-col overflow-hidden md:flex">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Details</span>
              <button onClick={() => toggleInspector(false)} title="Collapse panel" aria-label="Collapse details panel" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <PanelRightClose size={16} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">{mode === 'interior' ? renderCellInspector() : renderYardInspector()}</div>
            {(selected || focusSite || mode === 'interior') && (
              <div className="border-t border-slate-100 p-3">
                <button
                  onClick={() => {
                    if (selected && selected.kind !== 'site') (mode === 'yard' ? selectYard : selectInterior)(null);
                    else if (mode === 'interior') goSite(interiorId);
                    else goNetwork();
                  }}
                  className="w-full rounded-xl bg-slate-100 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200"
                >
                  {selected && selected.kind !== 'site' ? (mode === 'interior' ? 'Back to warehouse overview' : `Back to ${focusSite?.name || 'overview'}`) : mode === 'interior' ? 'Back to the site yard' : 'Campus overview'}
                </button>
              </div>
            )}
          </Card>
        )}

        {/* list, bottom right */}
        <div ref={queueRef} className="absolute bottom-4 right-4 z-10 cursor-default">{mode === 'interior' ? cellQueue : yardQueue}</div>
      </div>

      {/* Overlays */}
      {searchOpen && <SearchPalette items={searchItems} onClose={() => setSearchOpen(false)} />}
      {helpOpen && <ShortcutsHelp onClose={() => setHelpOpen(false)} />}
      {dialog?.kind === 'wo' && (
        <RequestDialog
          title={`Create work order · ${dialog.code}`}
          description="Sends a work-order proposal to the approval queue (same flow as the AI Assistant). It is created and a technician dispatched once a supervisor approves it."
          confirmLabel="Send for approval"
          withPriority
          notePlaceholder="What is wrong? e.g. spindle vibration 6.2 mm/s, rising for 30 min"
          defaultNote={(() => {
            const t = telemetryMap[dialog.code];
            const m = byCode.get(dialog.code);
            return m && m.status !== 'RUNNING' ? `${m.code} reported ${m.status.toLowerCase()}${t ? ` (temp ${t.temperature?.toFixed(1)} °C, vibration ${t.vibration?.toFixed(2)} mm/s)` : ''}` : '';
          })()}
          onSubmit={async ({ priority, note }) => {
            const a = await assistantApi.proposeWorkOrder({ machineCode: dialog.code, symptom: note, priority, requestedBy: { name: currentUser?.name || 'Operator', role: currentUser?.role || 'user' }, source: 'ops-twin' });
            logRequest(`machine:${dialog.code}`, `${priority} work order: ${note}`, `Pending approval · ${a.id}`);
            flash(`Work order sent for approval (${a.id}) — approve it in AI Assistant → Approvals`);
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'sim' && (
        <RequestDialog
          title={dialog.title}
          description={dialog.description}
          confirmLabel={dialog.confirm}
          notePlaceholder="Details"
          defaultNote={dialog.note}
          onSubmit={({ note }) => {
            logRequest(`${dialog.ref.kind}:${dialog.ref.id}`, note, 'Logged');
            flash('Request logged on this page');
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {toast && (
        <div className="absolute bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-2xl">{toast}</div>
      )}
    </div>
  );
};

export default OpsTwinView;
