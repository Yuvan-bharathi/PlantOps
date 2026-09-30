import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Map, { Marker, NavigationControl, ScaleControl } from 'react-map-gl';
import type { MapRef, MapLayerMouseEvent } from 'react-map-gl';
import type mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  Truck, Package, CheckCircle2, Clock, MapPin, Navigation,
  RefreshCw, Zap, Building2, Play, Pause, Activity,
  Layers, Compass, Eye, ShieldCheck, Fuel, Box, Sun, Moon,
  Sunset, Sunrise, Factory, Map as MapIcon, Crosshair, X, User, Gauge, Route,
  ChevronLeft, ChevronRight, Maximize2, Minimize2, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import { createTruckLayer, TRUCK_LAYER_ID, TruckRenderState, TruckScreenPos } from './fleet3d/truckLayer';
import type { TruckModel } from './fleet3d/truckModel';
import {
  SimVehicle, RoadRoute, VehicleStatus, buildRoute, fallbackRoute, followMission,
  isMoving, indexAt, parkedOffset, lerpAngle, PARK_HEADING,
} from './fleet3d/fleetSim';
import { api, socket } from '../../services/api';

// ─── TOKEN ─────────────────────────────────────────────────────────────────────
// Mapbox access token comes from frontend/.env (VITE_MAPBOX_TOKEN) — never commit tokens to source
const MAPBOX_TOKEN: string = (import.meta as any).env?.VITE_MAPBOX_TOKEN || '';
if (!MAPBOX_TOKEN) console.warn('[LiveFleetTracking] VITE_MAPBOX_TOKEN is not set in frontend/.env — the map will not load.');

// ─── PLANT BASE & REAL WAREHOUSE HUBS ──────────────────────────────────────────
const PLANT_LOCATION: [number, number] = [80.1548, 13.1142]; // Ambattur Industrial Estate, Chennai

const DESTINATIONS = [
  {
    id: 'WH-001',
    name: 'Bengaluru Tech Hub & Logistics Park',
    address: 'Electronic City Phase 1, Hosur Rd, Bengaluru, Karnataka',
    coords: [77.6762, 12.8452] as [number, number],
    color: '#0284c7',
    bgLight: '#e0f2fe',
    distanceKm: 335.0,
  },
  {
    id: 'WH-002',
    name: 'Coimbatore Industrial Corridor Hub',
    address: 'Peelamedu Industrial Estate, Avinashi Rd, Coimbatore, Tamil Nadu',
    coords: [77.0185, 11.0264] as [number, number],
    color: '#d97706',
    bgLight: '#fef3c7',
    distanceKm: 495.0,
  },
  {
    id: 'WH-003',
    name: 'Tirupati Logistics Depot',
    address: 'Renigunta Industrial Area, Tirupati, Andhra Pradesh',
    coords: [79.5167, 13.6288] as [number, number],
    color: '#7c3aed',
    bgLight: '#ede9fe',
    distanceKm: 135.0,
  },
  {
    id: 'WH-004',
    name: 'Puducherry Freight Terminal',
    address: 'Mettupalayam Industrial Estate, Puducherry',
    coords: [79.7915, 11.9610] as [number, number],
    color: '#059669',
    bgLight: '#d1fae5',
    distanceKm: 150.0,
  },
];

// ─── TYPES ────────────────────────────────────────────────────────────────────
type LightPreset = 'day' | 'dusk' | 'dawn' | 'night';

// UI snapshot of a vehicle. The live position lives in the simulation ref and is
// published to React state only a few times per second.
interface FleetVehicle {
  id: string;
  name: string;
  driver: string;
  currentCoords: [number, number];
  destinationId: string | null; // set while on a DB dispatch
  dispatchId?: string;
  tonnage?: number;
  status: VehicleStatus;
  progress: number;
  heading: number;
  cargo: string;
  eta: number;
  speed: number;
  palletCount: number;
  batchId: string;
  fuelLevel: number;
  distanceKm: number;
}

interface VehicleRoutes {
  out: RoadRoute;
  back: RoadRoute;
}

// A fleet_dispatches row as served by GET /api/fleet/state
interface FleetMission {
  id: string;
  truckId: string;
  driverName: string;
  destinationId: string;
  destinationName: string;
  cargoName: string;
  batchId: string;
  palletCount: number;
  tonnage: number;
  palletIds: string[];
  distanceKm: number;
  status: string;
  outboundSeconds: number;
  unloadSeconds: number;
  returnSeconds: number;
  dispatchedAt: string;
}

interface FleetServerState {
  config: { freightThresholdPallets: number; palletTonnes: number; timeScale: number };
  dock: {
    count: number;
    tonnage: number;
    readyForDispatch: boolean;
    waitingForTruck: boolean;
    readyTrucksCount?: number;
    loadedTrucksCount?: number;
    allTrucksReady?: boolean;
    inTransitToDock?: number;
    stagedPallets: { palletNumber: string }[];
  };
  trucks: {
    id: string;
    name: string;
    driverName: string;
    status: string;
    capacityPallets: number;
    capacityTonnes?: number;
    capacityPieces?: number;
    loadedPallets?: number;
    isReady?: boolean;
    canDispatch?: boolean;
    lastReturnedAt?: string;
  }[];
  nextDispatch?: { truckId: string | null; palletsNeeded: number; palletsInTransitToDock: number; palletIntervalSeconds: number | null; estimatedSeconds: number | null; basis: string };
  activeDispatches: FleetMission[];
  recentDispatches: FleetMission[];
  today: { deliveries: number; tonnes: number };
}

interface FollowState {
  id: string;
  t: number; // 0..1 fly-in transition
  from: { lng: number; lat: number; zoom: number; pitch: number; bearing: number; padTop: number } | null;
  bearing: number;
  last: [number, number, number] | null;
}

const STATUS_CONFIG: Record<VehicleStatus, { label: string; color: string; bgLight: string; pulse: boolean }> = {
  AT_PLANT:   { label: 'At Plant Base', color: '#64748b', bgLight: '#f1f5f9', pulse: false },
  DEPARTING:  { label: 'Departing Dock', color: '#d97706', bgLight: '#fef3c7', pulse: true },
  IN_TRANSIT: { label: 'On Road Route', color: '#0284c7', bgLight: '#e0f2fe', pulse: true },
  ARRIVING:   { label: 'Approaching Hub', color: '#7c3aed', bgLight: '#ede9fe', pulse: true },
  DELIVERED:  { label: 'Delivered ✓',   color: '#059669', bgLight: '#d1fae5', pulse: false },
  RETURNING:  { label: 'Returning to Base', color: '#ea580c', bgLight: '#ffedd5', pulse: true },
};

const MAP_STYLES = [
  { id: 'standard',  name: 'Mapbox Standard 3D (Full Architecture)', url: 'mapbox://styles/mapbox/standard' },
  { id: 'streets',   name: '3D Streets & Buildings',                 url: 'mapbox://styles/mapbox/streets-v12' },
  { id: 'satellite', name: 'Satellite 3D Photoreal',                url: 'mapbox://styles/mapbox/standard-satellite' },
  { id: 'dark',      name: 'Dark Logistics 3D',                     url: 'mapbox://styles/mapbox/dark-v11' },
];

const VEHICLES = ['TRK-001', 'TRK-002', 'TRK-003', 'TRK-004'].map((id, i) => ({
  id,
  name: ['Alpha Carrier', 'Bravo Hauler', 'Charlie Express', 'Delta Prime'][i],
  driver: ['K. Ramesh', 'S. Vignesh', 'M. Anbu', 'D. Prakash'][i],
  cruise: [15.5, 16.5, 15, 13.5][i], // m/s (~50–60 km/h)
  fuel: 95 - i * 3,
}));

const INITIAL_VIEW = {
  longitude: PLANT_LOCATION[0],
  latitude: PLANT_LOCATION[1],
  zoom: 16.2,
  pitch: 60,
  bearing: -24,
};

const FOLLOW_ZOOM = 17.3;
const FOLLOW_PITCH = 60;
const FOLLOW_PAD_RATIO = 0.3; // push the truck into the lower part of the screen
const FOLLOW_TRANSITION_S = 1.6;
const NO_PADDING = { top: 0, bottom: 0, left: 0, right: 0 };
const EMPTY_FC = { type: 'FeatureCollection' as const, features: [] as any[] };

const PLANT_DEST = {
  id: 'PLANT',
  name: 'Plant Base HQ',
  address: 'Ambattur Industrial Estate — awaiting next load',
  coords: PLANT_LOCATION,
  color: '#64748b',
  bgLight: '#f1f5f9',
  distanceKm: 0,
};
// Destination of a truck's current mission (plant base when parked)
const getDest = (id: string | null | undefined) => DESTINATIONS.find((d) => d.id === id) || PLANT_DEST;
const fmtEta = (sec: number | null | undefined) =>
  sec == null ? 'time depends on packaging rate' : sec < 60 ? 'within a minute' : `in ~${Math.round(sec / 60)} min`;
// Order in which parked trucks take the next loads (longest idle first — same rule as the server)
const loadingQueue = (s: FleetServerState | null) =>
  (s?.trucks || [])
    .filter((t) => t.status === 'AVAILABLE')
    .sort((a, b) => (a.lastReturnedAt ? Date.parse(a.lastReturnedAt) : 0) - (b.lastReturnedAt ? Date.parse(b.lastReturnedAt) : 0) || a.id.localeCompare(b.id))
    .map((t) => t.id);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Standard / Satellite styles ship their own fog tuned per light preset, so only the
// classic styles get a custom one. It starts well away from the camera so nearby streets stay crisp.
const usesBasemapConfig = (style: string) => style === 'standard' || style === 'satellite';
const fogFor = (p: LightPreset) => ({
  range: [2, 12] as [number, number],
  color: p === 'night' ? '#1e293b' : '#dbe4ee',
  'high-color': p === 'night' ? '#020617' : '#7fb2e5',
  'horizon-blend': 0.08,
  'space-color': p === 'night' ? '#020617' : '#a9cdf0',
  'star-intensity': p === 'night' ? 0.6 : 0,
});

function makeFallbackRoutes(): Record<string, VehicleRoutes> {
  const routes: Record<string, VehicleRoutes> = {};
  DESTINATIONS.forEach((dest, i) => {
    routes[dest.id] = {
      out: buildRoute(fallbackRoute(PLANT_LOCATION, dest.coords, i)),
      back: buildRoute(fallbackRoute(dest.coords, PLANT_LOCATION, i + 10)),
    };
  });
  return routes;
}

// Parking point: where the outbound road leaves the plant
const parkPointOf = (routes: Record<string, VehicleRoutes>) => routes[DESTINATIONS[0].id].out.coords[0];

function makeSim(routes: Record<string, VehicleRoutes>): Record<string, SimVehicle> {
  const sim: Record<string, SimVehicle> = {};
  const [lng, lat] = parkPointOf(routes);
  VEHICLES.forEach((v, i) => {
    sim[v.id] = {
      id: v.id,
      status: 'AT_PLANT',
      dist: 0,
      speed: 0,
      cruise: v.cruise,
      heading: PARK_HEADING,
      lng,
      lat,
      fuel: v.fuel,
      dwell: 0,
      sideOffset: parkedOffset(i),
      parkSlot: i,
    };
  });
  return sim;
}

function makeInitialFleet(): FleetVehicle[] {
  return VEHICLES.map((v) => ({
    id: v.id,
    name: v.name,
    driver: v.driver,
    currentCoords: [...PLANT_LOCATION] as [number, number],
    destinationId: null,
    status: 'AT_PLANT' as VehicleStatus,
    progress: 0,
    heading: PARK_HEADING,
    cargo: 'Awaiting next load at the outbound dock',
    eta: 0,
    speed: 0,
    palletCount: 0,
    batchId: '—',
    fuelLevel: v.fuel,
    distanceKm: 0,
  }));
}

// ─── HEADER CONTROLS ──────────────────────────────────────────────────────────
const headerBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  height: 34,
  padding: '0 14px',
  borderRadius: 9,
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const ToolbarGroup: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</span>
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: 3, borderRadius: 9, backgroundColor: '#ffffff', border: '1px solid #e2e8f0' }}>
      {children}
    </div>
  </div>
);

const SegButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ElementType; label: string }> = ({ active, onClick, icon: Icon, label }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      height: 26,
      padding: '0 10px',
      border: 'none',
      borderRadius: 6,
      fontSize: 12,
      fontWeight: 600,
      whiteSpace: 'nowrap',
      cursor: 'pointer',
      backgroundColor: active ? '#0284c7' : 'transparent',
      color: active ? '#ffffff' : '#475569',
      transition: 'background-color 0.15s, color 0.15s',
    }}
  >
    <Icon size={13} /> {label}
  </button>
);

function useLazyRef<T>(init: () => T) {
  const ref = useRef<T | null>(null);
  if (ref.current === null) ref.current = init();
  return ref as React.MutableRefObject<T>;
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
interface Props {
  onAddToast?: (t: any) => void;
  isHeaderHidden?: boolean;
  onToggleHeader?: () => void;
  focusTruckId?: string | null;
}

export const LiveFleetTrackingView: React.FC<Props> = ({
  onAddToast,
  isHeaderHidden = false,
  onToggleHeader,
  focusTruckId,
}) => {
  const [fleet, setFleet] = useState<FleetVehicle[]>(() => makeInitialFleet());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null); // truck whose details card is open
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false);
  const [activeMapStyle, setActiveMapStyle] = useState('standard');
  const [lightPreset, setLightPreset] = useState<LightPreset>('day');
  const [followVehicleId, setFollowVehicleId] = useState<string | null>(null);
  const [fleetState, setFleetState] = useState<FleetServerState | null>(null);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(true);
  const [hoveredTruckId, setHoveredTruckId] = useState<string | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(INITIAL_VIEW.zoom);

  const mapRef = useRef<MapRef>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapReadyRef = useRef(false);
  const routesRef = useLazyRef(makeFallbackRoutes);
  const simRef = useLazyRef(() => makeSim(routesRef.current));
  const followRef = useRef<FollowState | null>(null);
  const modelsRef = useRef<Record<string, TruckModel>>({});
  const screenRef = useRef<Record<string, TruckScreenPos>>({});
  const labelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const detailsElRef = useRef<HTMLDivElement | null>(null);
  const routesDirtyRef = useRef(true);
  const trailDirtyRef = useRef(true);
  const remainingRef = useRef<Record<string, number>>({});
  const missionsRef = useRef<Record<string, FleetMission>>({}); // truckId → active DB dispatch
  const clockOffsetRef = useRef(0); // server clock − browser clock (ms)
  const timeScaleRef = useRef(6);

  // Latest values for the animation loop / map callbacks (which are created once)
  const lightRef = useRef(lightPreset);
  const styleRef = useRef(activeMapStyle);
  const selectedRef = useRef(selectedId);
  const detailsRef = useRef(detailsId);
  const toastRef = useRef(onAddToast);
  lightRef.current = lightPreset;
  styleRef.current = activeMapStyle;
  selectedRef.current = selectedId;
  detailsRef.current = detailsId;
  toastRef.current = onAddToast;

  const selectedVehicle = fleet.find((v) => v.id === selectedId) ?? null;
  const detailsVehicle = fleet.find((v) => v.id === detailsId) ?? null;

  // ── Map data builders ──
  const routeFC = () => ({
    type: 'FeatureCollection' as const,
    features: VEHICLES.filter((m) => missionsRef.current[m.id]).map((m) => {
      const s = simRef.current[m.id];
      const mission = missionsRef.current[m.id];
      const r = routesRef.current[mission.destinationId];
      return {
        type: 'Feature' as const,
        properties: { id: m.id, color: getDest(mission.destinationId).color },
        geometry: { type: 'LineString' as const, coordinates: (s.status === 'RETURNING' ? r.back : r.out).coords },
      };
    }),
  });

  const trailFC = () => ({
    type: 'FeatureCollection' as const,
    features: VEHICLES.filter((m) => simRef.current[m.id].status !== 'AT_PLANT' && missionsRef.current[m.id]).map((m) => {
      const s = simRef.current[m.id];
      const mission = missionsRef.current[m.id];
      const r = routesRef.current[mission.destinationId];
      let coords: [number, number][];
      if (s.status === 'DELIVERED') {
        coords = r.out.coords;
      } else {
        const route = s.status === 'RETURNING' ? r.back : r.out;
        coords = route.coords.slice(0, indexAt(route, s.dist) + 1);
        coords.push([s.lng, s.lat]);
      }
      return {
        type: 'Feature' as const,
        properties: { color: s.status === 'RETURNING' ? '#ea580c' : getDest(mission.destinationId).color },
        geometry: { type: 'LineString' as const, coordinates: coords },
      };
    }),
  });

  const getTrucks = (): TruckRenderState[] =>
    VEHICLES.map((m) => {
      const s = simRef.current[m.id];
      return {
        id: m.id,
        lng: s.lng,
        lat: s.lat,
        heading: s.heading,
        sideOffset: s.sideOffset,
        moving: isMoving(s.status),
        selected: selectedRef.current === m.id || followRef.current?.id === m.id,
        accent: getDest(missionsRef.current[m.id]?.destinationId).color,
        ringColor: STATUS_CONFIG[s.status].color,
      };
    });

  const onProject = (id: string, pos: TruckScreenPos) => {
    screenRef.current[id] = pos;
    const el = labelRefs.current[id];
    if (!el) return;
    el.style.transform = `translate3d(${pos.labelX.toFixed(1)}px, ${pos.labelY.toFixed(1)}px, 0) translate(-50%, -100%)`;
    el.style.visibility = pos.visible ? 'visible' : 'hidden';
  };

  // ── Style setup: lighting, fog, route layers and the three.js truck layer ──
  // Re-run after every style swap because setStyle drops user-added layers.
  const setupStyle = useCallback((map: mapboxgl.Map) => {
    const m = map as any;
    const style = styleRef.current;
    try {
      if (usesBasemapConfig(style)) {
        m.setConfigProperty('basemap', 'lightPreset', lightRef.current);
        m.setConfigProperty('basemap', 'show3dObjects', true);
        m.setConfigProperty('basemap', 'showPointOfInterestLabels', true);
        m.setConfigProperty('basemap', 'showTransitLabels', true);
      }
    } catch (e) {}
    try {
      if (!usesBasemapConfig(style)) map.setFog(fogFor(lightRef.current));
    } catch (e) {}

    try {
      if (style !== 'standard' && style !== 'satellite' && map.getSource('composite') && !map.getLayer('3d-buildings-extrusion')) {
        map.addLayer({
          id: '3d-buildings-extrusion',
          source: 'composite',
          'source-layer': 'building',
          filter: ['==', 'extrude', 'true'],
          type: 'fill-extrusion',
          minzoom: 13,
          paint: {
            'fill-extrusion-color': style === 'dark' ? '#334155' : '#e2e8f0',
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'min_height'],
            'fill-extrusion-opacity': 0.75,
          },
        });
      }

      if (!map.getSource('routes')) map.addSource('routes', { type: 'geojson', data: routeFC() as any });
      if (!map.getLayer('route-ghost')) {
        map.addLayer({
          id: 'route-ghost',
          type: 'line',
          source: 'routes',
          layout: { 'line-join': 'round' },
          paint: {
            'line-color': style === 'dark' ? '#38bdf8' : '#0284c7',
            'line-width': 4.5,
            'line-dasharray': [2, 2],
            'line-opacity': 0.5,
          },
        });
      }
      if (!map.getSource('traveled')) map.addSource('traveled', { type: 'geojson', data: trailFC() as any });
      if (!map.getLayer('traveled-glow')) {
        map.addLayer({
          id: 'traveled-glow',
          type: 'line',
          source: 'traveled',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': ['get', 'color'], 'line-width': 10, 'line-opacity': 0.45, 'line-blur': 3 },
        });
      }
      if (!map.getLayer('traveled-solid')) {
        map.addLayer({
          id: 'traveled-solid',
          type: 'line',
          source: 'traveled',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': ['get', 'color'], 'line-width': 5, 'line-opacity': 0.95 },
        });
      }
      if (!map.getLayer(TRUCK_LAYER_ID)) {
        map.addLayer(
          createTruckLayer({
            models: modelsRef.current,
            getTrucks,
            getLightPreset: () => lightRef.current,
            onProject,
          })
        );
      }
    } catch (e) {
      console.warn('[FleetTracking] style setup failed', e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Chase camera ──
  const stopFollow = useCallback((resetPadding: boolean) => {
    followRef.current = null;
    setFollowVehicleId(null);
    if (resetPadding) mapRef.current?.getMap().easeTo({ padding: NO_PADDING, duration: 600 });
  }, []);

  const startFollow = useCallback((id: string) => {
    followRef.current = { id, t: 0, from: null, bearing: 0, last: null };
    setFollowVehicleId(id);
    setSelectedId(id);
  }, []);

  const toggleFollow = (id: string) => {
    if (followRef.current?.id === id) stopFollow(true);
    else startFollow(id);
  };

  const updateFollow = (map: mapboxgl.Map, dt: number) => {
    const f = followRef.current;
    if (!f) return;
    const s = simRef.current[f.id];
    if (!s) return;
    const padTop = map.getCanvas().clientHeight * FOLLOW_PAD_RATIO;

    if (!f.from) {
      const c = map.getCenter();
      f.from = { lng: c.lng, lat: c.lat, zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing(), padTop: map.getPadding().top ?? 0 };
      f.bearing = f.from.bearing;
    }
    const from = f.from;

    if (f.t < 1) {
      f.t = Math.min(1, f.t + dt / FOLLOW_TRANSITION_S);
      const e = easeInOutCubic(f.t);
      f.bearing = lerpAngle(from.bearing, s.heading, e);
      map.jumpTo({
        center: [lerp(from.lng, s.lng, e), lerp(from.lat, s.lat, e)],
        zoom: lerp(from.zoom, FOLLOW_ZOOM, e),
        pitch: lerp(from.pitch, FOLLOW_PITCH, e),
        bearing: f.bearing,
        padding: { top: lerp(from.padTop, padTop, e), bottom: 0, left: 0, right: 0 },
      });
      return;
    }

    // Critically-damped bearing so the camera swings smoothly through turns
    f.bearing = lerpAngle(f.bearing, s.heading, 1 - Math.exp(-dt * 2.5));
    const l = f.last;
    if (l && Math.abs(l[0] - s.lng) < 1e-9 && Math.abs(l[1] - s.lat) < 1e-9 && Math.abs(l[2] - f.bearing) < 0.01) return;
    f.last = [s.lng, s.lat, f.bearing];
    map.jumpTo({ center: [s.lng, s.lat], bearing: f.bearing });
  };

  // ── Step 1: Fetch Real Road Directions from Mapbox Directions API ──
  useEffect(() => {
    const ctrl = new AbortController();
    const fetchRoute = async (from: [number, number], to: [number, number]) => {
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${from[0]},${from[1]};${to[0]},${to[1]}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
      const res = await fetch(url, { signal: ctrl.signal }).then((r) => r.json());
      const coords: [number, number][] | undefined = res.routes?.[0]?.geometry?.coordinates;
      return coords && coords.length > 1 ? buildRoute(coords) : null;
    };

    (async () => {
      setIsLoadingRoutes(true);
      await Promise.all(
        DESTINATIONS.map(async (dest) => {
          try {
            const [out, back] = await Promise.all([fetchRoute(PLANT_LOCATION, dest.coords), fetchRoute(dest.coords, PLANT_LOCATION)]);
            const prev = routesRef.current[dest.id];
            routesRef.current[dest.id] = { out: out ?? prev.out, back: back ?? prev.back };
          } catch (err) {}
        })
      );
      if (ctrl.signal.aborted) return;
      routesDirtyRef.current = true;
      trailDirtyRef.current = true;
      setIsLoadingRoutes(false);
      toastRef.current?.({
        type: 'INFO',
        title: 'Real Road Routes Snapped',
        subtitle: 'Mapbox Directions API Active',
        message: 'Routes to all 4 warehouses snapped to Chennai arterial road networks.',
      });
    })();

    return () => ctrl.abort();
  }, []);

  // ── Step 2: Map load — configure style and camera interaction ──
  const onMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    setupStyle(map);
    map.on('style.load', () => {
      setupStyle(map);
      routesDirtyRef.current = true;
      trailDirtyRef.current = true;
    });
    // Track zoom level for adaptive markers & labels
    map.on('zoom', () => {
      setCurrentZoom(map.getZoom());
    });
    // Manual panning takes over from the chase cam
    map.on('dragstart', (e: any) => {
      if (e.originalEvent && followRef.current) stopFollow(false);
    });
    mapReadyRef.current = true;
  }, [setupStyle, stopFollow]);

  // Update lighting preset
  useEffect(() => {
    const map = mapRef.current?.getMap() as any;
    if (!map || !mapReadyRef.current) return;
    try {
      if (usesBasemapConfig(styleRef.current)) {
        map.setConfigProperty('basemap', 'lightPreset', lightPreset);
      }
      if (!usesBasemapConfig(styleRef.current)) map.setFog(fogFor(lightPreset));
    } catch (e) {}
    map.triggerRepaint();
  }, [lightPreset]);

  // Re-project overlays when selection changes even if nothing is moving
  useEffect(() => {
    mapRef.current?.getMap().triggerRepaint();
  }, [selectedId, detailsId]);

  // Auto-resize Mapbox WebGL canvas whenever layout changes (left panel collapse or header toggle)
  useEffect(() => {
    const trigger = () => {
      try {
        mapRef.current?.getMap()?.resize();
      } catch (e) {}
    };
    trigger();
    // Fire resize at intervals during CSS transition (0ms - 500ms)
    const timers = [40, 80, 150, 250, 350, 450, 600].map((ms) => setTimeout(trigger, ms));
    return () => timers.forEach(clearTimeout);
  }, [isLeftPanelCollapsed, isHeaderHidden]);

  // Observe DOM container dimensions via ResizeObserver for immediate canvas recalculation
  useEffect(() => {
    const el = mapContainerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      try {
        mapRef.current?.getMap()?.resize();
      } catch (e) {}
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Step 3: Animation loop (outside React) ──
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastUi = 0;
    let lastTrail = 0;

    const publishUi = () => {
      const sims = simRef.current;
      const routes = routesRef.current;
      setFleet((prev) => {
        let changed = false;
        const next = prev.map((v) => {
          const s = sims[v.id];
          const mission = missionsRef.current[v.id];
          const r = mission ? routes[mission.destinationId] : null;
          const route = r ? (s.status === 'RETURNING' ? r.back : r.out) : null;
          const progress = !route || s.status === 'AT_PLANT' ? 0 : s.status === 'DELIVERED' ? 1 : s.dist / route.total;
          const speed = Math.round(s.speed * 3.6);
          // Real-world minutes left on this leg (the map runs at the fleet time scale)
          const eta = isMoving(s.status) ? Math.max(0, Math.round((remainingRef.current[v.id] || 0) * timeScaleRef.current / 60)) : 0;
          const missionId = mission?.id;
          if (v.status === s.status && v.dispatchId === missionId && Math.abs(v.progress - progress) < 0.0005 && v.speed === speed && v.eta === eta) return v;
          changed = true;
          return {
            ...v,
            status: s.status,
            progress,
            speed,
            eta,
            fuelLevel: s.fuel,
            currentCoords: [s.lng, s.lat] as [number, number],
            heading: s.heading,
            destinationId: mission?.destinationId ?? null,
            dispatchId: missionId,
            tonnage: mission?.tonnage,
            driver: mission?.driverName || v.driver,
            cargo: mission ? mission.cargoName : 'Awaiting next load at the outbound dock',
            palletCount: mission?.palletCount ?? 0,
            batchId: mission?.batchId ?? '—',
            distanceKm: mission ? (route ? +(route.total / 1000).toFixed(1) : mission.distanceKm) : 0,
          };
        });
        return changed ? next : prev;
      });
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      let animating = false;
      const serverNow = Date.now() + clockOffsetRef.current;
      const parkPoint = parkPointOf(routesRef.current);
      for (const m of VEHICLES) {
        const s = simRef.current[m.id];
        const before = s.lng + s.lat + s.heading + s.sideOffset;
        const prevStatus = s.status;
        const mission = missionsRef.current[m.id] || null;
        const r = mission ? routesRef.current[mission.destinationId] : null;
        remainingRef.current[m.id] = followMission(
          s,
          mission ? { dispatchedAtMs: Date.parse(mission.dispatchedAt), outboundSeconds: mission.outboundSeconds, unloadSeconds: mission.unloadSeconds, returnSeconds: mission.returnSeconds } : null,
          r?.out ?? null,
          r?.back ?? null,
          parkPoint,
          serverNow,
          dt
        );
        if (Math.abs(s.lng + s.lat + s.heading + s.sideOffset - before) > 1e-7) animating = true;
        if (s.status !== prevStatus) {
          routesDirtyRef.current = true;
          trailDirtyRef.current = true;
        }
      }

      const map = mapRef.current?.getMap();
      if (map && mapReadyRef.current) {
        updateFollow(map, dt);
        try {
          if (routesDirtyRef.current) {
            (map.getSource('routes') as mapboxgl.GeoJSONSource | undefined)?.setData(routeFC() as any);
            routesDirtyRef.current = false;
          }
          if ((animating || trailDirtyRef.current) && now - lastTrail > 100) {
            (map.getSource('traveled') as mapboxgl.GeoJSONSource | undefined)?.setData(trailFC() as any);
            trailDirtyRef.current = false;
            lastTrail = now;
          }
        } catch (e) {}
        if (animating) map.triggerRepaint();
      }

      if (now - lastUi > 250) {
        lastUi = now;
        publishUi();
      }
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Step 4: Sync missions from TiDB (fleet_dispatches) ──
  const loadFleetState = useCallback(async () => {
    try {
      const t0 = Date.now();
      const res = await api.getFleetState();
      if (!res?.success || !res.data) return;
      const data = res.data as FleetServerState & { serverTime: string };
      clockOffsetRef.current = Date.parse(data.serverTime) - (t0 + (Date.now() - t0) / 2);
      timeScaleRef.current = data.config?.timeScale || 6;
      const next: Record<string, FleetMission> = {};
      for (const d of data.activeDispatches) next[d.truckId] = d;
      missionsRef.current = next;
      routesDirtyRef.current = true;
      trailDirtyRef.current = true;
      setFleetState(data);
      mapRef.current?.getMap()?.triggerRepaint();
    } catch (err) {
      console.warn('Fleet state unavailable', err);
    }
  }, []);

  useEffect(() => {
    loadFleetState();
    const poll = setInterval(loadFleetState, 15000);
    const onUpdated = () => loadFleetState();
    const onDispatched = (d: FleetMission) => {
      toastRef.current?.({
        type: 'DISPATCH',
        title: `🚚 ${d.truckId} dispatched — ${d.palletCount} pallets (${d.tonnage} t)`,
        subtitle: `${d.id} → ${d.destinationName}`,
        message: `Dock reached the freight threshold. ${d.driverName} is departing Plant Base with batch ${d.batchId}.`,
      });
      startFollow(d.truckId);
    };
    const onDelivered = (d: FleetMission) =>
      toastRef.current?.({
        type: 'REPAIR_COMPLETE',
        title: `${d.truckId} – Delivery Verified ✓`,
        subtitle: d.destinationName,
        message: `${d.palletCount} pallets (${d.tonnage} t, batch ${d.batchId}) offloaded. Returning to Plant Base.`,
      });
    const onReturned = (d: FleetMission) =>
      toastRef.current?.({
        type: 'INFO',
        title: `${d.truckId} – Back at Plant Base`,
        subtitle: d.id,
        message: `Mission complete. Truck available for the next load.`,
      });
    socket.on('fleet:updated', onUpdated);
    socket.on('fleet:dispatched', onDispatched);
    socket.on('fleet:delivered', onDelivered);
    socket.on('fleet:returned', onReturned);
    return () => {
      clearInterval(poll);
      socket.off('fleet:updated', onUpdated);
      socket.off('fleet:dispatched', onDispatched);
      socket.off('fleet:delivered', onDelivered);
      socket.off('fleet:returned', onReturned);
    };
  }, [loadFleetState, startFollow]);

  // Dashboard "Track in 3D" deep link
  useEffect(() => {
    if (focusTruckId) startFollow(focusTruckId.split('#')[0]);
  }, [focusTruckId, startFollow]);

  // Free GPU resources on unmount
  useEffect(() => {
    const models = modelsRef.current;
    return () => {
      for (const k of Object.keys(models)) {
        models[k].dispose();
        delete models[k];
      }
    };
  }, []);

  // ── 3D Camera Presets ──
  const setCameraPreset = (preset: 'follow' | 'street' | 'plant' | 'regional') => {
    if (preset === 'follow') {
      const active = VEHICLES.find((v) => missionsRef.current[v.id]) || VEHICLES[0];
      startFollow(active.id);
      return;
    }
    stopFollow(false);
    const views = {
      street: { center: [80.17, 13.1] as [number, number], zoom: 16.5, pitch: 65, bearing: -35 },
      plant: { center: PLANT_LOCATION, zoom: 16.8, pitch: 60, bearing: 30 },
      regional: { center: [78.8, 12.5] as [number, number], zoom: 7.2, pitch: 45, bearing: -10 },
    };
    mapRef.current?.getMap().flyTo({ ...views[preset], padding: NO_PADDING, duration: 2200, essential: true });
  };

  // ── Manual Dispatch Actions ──
  const [isDispatching, setIsDispatching] = useState(false);

  const handleManualDispatch = async (truckId?: string, isAll = false) => {
    setIsDispatching(true);
    try {
      const res = await api.dispatchFleet({ truckId, all: isAll });
      if (res?.success && res.count > 0) {
        toastRef.current?.({
          type: 'DISPATCH',
          title: isAll ? `🚚 Fleet Dispatched (${res.count} Trucks)` : `🚚 ${truckId} Dispatched on Road`,
          subtitle: isAll ? `All ready vehicles departing Plant Base` : `Heading to destination warehouse`,
          message: `Mission started. Road transport in progress.`,
        });
        await loadFleetState();
        if (res.data?.[0]?.truckId) {
          startFollow(res.data[0].truckId);
        }
      } else {
        toastRef.current?.({
          type: 'INFO',
          title: 'No Pallets Ready to Dispatch',
          subtitle: 'Plant Loading Dock',
          message: 'Wait until pallets are staged in vehicle before dispatching.',
        });
      }
    } catch (e: any) {
      console.warn('Dispatch failed', e);
    } finally {
      setIsDispatching(false);
    }
  };

  // ── Actions ──
  const openDetails = (id: string) => {
    setSelectedId(id);
    setDetailsId(id);
  };

  // From the side panel: open details and bring the truck into view
  const selectVehicle = (id: string) => {
    openDetails(id);
    if (followRef.current) return;
    const s = simRef.current[id];
    mapRef.current?.getMap().easeTo({ center: [s.lng, s.lat], duration: 900 });
  };

  // Hit-test a screen point against each truck's projected front-to-rear axis
  const pickTruck = (pt: { x: number; y: number }) => {
    let best: string | null = null;
    let bestD = 38; // generous click/hover hit radius for effortless truck selection
    for (const [id, p] of Object.entries(screenRef.current)) {
      if (!p.visible) continue;
      const vx = p.fx - p.rx;
      const vy = p.fy - p.ry;
      const len2 = vx * vx + vy * vy || 1;
      const t = Math.max(0, Math.min(1, ((pt.x - p.rx) * vx + (pt.y - p.ry) * vy) / len2));
      const d = Math.hypot(pt.x - (p.rx + vx * t), pt.y - (p.ry + vy * t));
      if (d < bestD) {
        best = id;
        bestD = d;
      }
    }
    return best;
  };

  const onMapClick = (e: MapLayerMouseEvent) => {
    const hit = pickTruck(e.point);
    if (hit) {
      openDetails(hit);
    } else {
      setDetailsId(null);
    }
  };

  const onMapMouseMove = (e: MapLayerMouseEvent) => {
    const hit = pickTruck(e.point);
    setHoveredTruckId(hit);
    const canvas = mapRef.current?.getMap().getCanvas();
    if (canvas) canvas.style.cursor = hit ? 'pointer' : '';
  };

  // ── Truck details card (anchored beside the truck; positioned in onProject) ──
  const renderDetailsCard = (v: FleetVehicle) => {
    const cfg = STATUS_CONFIG[v.status];
    const dest = getDest(v.destinationId);
    const following = followVehicleId === v.id;
    const legLabel =
      v.status === 'AT_PLANT' ? 'Waiting in plant bay'
      : v.status === 'DELIVERED' ? `Unloading at ${dest.name}`
      : v.status === 'RETURNING' ? 'Returning to Plant Base'
      : `En route to ${dest.name}`;
    const stats = [
      { icon: Gauge, label: 'Speed', value: `${v.speed}`, unit: 'km/h', color: '#d97706' },
      { icon: Clock, label: 'ETA', value: isMoving(v.status) ? `${v.eta}` : '—', unit: isMoving(v.status) ? 'min' : '', color: '#0284c7' },
      { icon: Fuel, label: 'Fuel', value: `${Math.round(v.fuelLevel)}`, unit: '%', color: '#059669' },
    ];
    const rows = [
      { icon: User, label: 'Driver', value: v.driver },
      { icon: MapPin, label: 'Destination', value: dest.name, color: dest.color },
      { icon: Route, label: 'Route length', value: `${v.distanceKm} km` },
      { icon: Box, label: 'Load', value: v.dispatchId ? `${v.palletCount} pallets · ${v.tonnage} t · ${v.batchId}` : 'Empty — waiting at plant' },
      ...(v.dispatchId ? [{ icon: Route, label: 'Dispatch', value: v.dispatchId }] : []),
    ];

    return (
      <div
        key={v.id}
        style={{
          position: 'absolute',
          right: 20,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 330,
          zIndex: 22,
          backgroundColor: '#ffffff',
          borderRadius: 16,
          border: '1px solid #e2e8f0',
          borderTop: `4px solid ${cfg.color}`,
          boxShadow: '0 20px 48px rgba(15, 23, 42, 0.22)',
          transition: 'all 0.25s ease',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px 10px' }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: cfg.bgLight,
              color: cfg.color,
            }}
          >
            <Truck size={17} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {v.id} <span style={{ fontWeight: 500, color: '#64748b', fontSize: 12 }}>· {v.name}</span>
            </div>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                marginTop: 3,
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 999,
                backgroundColor: cfg.bgLight,
                color: cfg.color,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: cfg.color }} />
              {cfg.label}
            </span>
          </div>
          <button
            onClick={() => setDetailsId(null)}
            title="Close"
            style={{
              width: 28,
              height: 28,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              borderRadius: 8,
              backgroundColor: '#f1f5f9',
              color: '#64748b',
              cursor: 'pointer',
            }}
          >
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: '0 14px 14px' }}>
          {/* Cargo */}
          <div style={{ display: 'flex', gap: 6, fontSize: 11, color: '#475569', lineHeight: 1.4, marginBottom: 10 }}>
            <Package size={12} style={{ color: '#0284c7', flexShrink: 0, marginTop: 2 }} />
            {v.cargo}
          </div>

          {/* Leg progress */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 5 }}>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{legLabel}</span>
              <span style={{ color: cfg.color, fontWeight: 800 }}>{Math.round(v.progress * 100)}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${v.progress * 100}%`, backgroundColor: cfg.color, borderRadius: 3, transition: 'width 0.25s linear' }} />
            </div>
          </div>

          {/* Key stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
            {stats.map((st) => (
              <div key={st.label} style={{ padding: '7px 8px', borderRadius: 9, backgroundColor: '#f8fafc', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#64748b', fontWeight: 600 }}>
                  <st.icon size={11} style={{ color: st.color }} /> {st.label}
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                  {st.value}
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', marginLeft: 2 }}>{st.unit}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Detail rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {rows.map((r) => (
              <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                <r.icon size={12} style={{ color: r.color ?? '#94a3b8', flexShrink: 0 }} />
                <span style={{ color: '#64748b', width: 78, flexShrink: 0 }}>{r.label}</span>
                <span style={{ color: '#0f172a', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.value}</span>
              </div>
            ))}
          </div>

          {/* Action */}
          {v.status === 'AT_PLANT' ? (
            (() => {
              const truckState = fleetState?.trucks.find((t) => t.id === v.id);
              const loaded = truckState?.loadedPallets ?? 0;
              const cap = truckState?.capacityPallets ?? 4;
              const canDisp = loaded > 0;
              return canDisp ? (
                <button
                  disabled={isDispatching}
                  onClick={() => handleManualDispatch(v.id)}
                  style={{
                    ...headerBtn,
                    width: '100%',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #059669, #10b981)',
                    color: '#ffffff',
                    border: 'none',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                    cursor: isDispatching ? 'wait' : 'pointer',
                  }}
                >
                  <Play size={13} strokeWidth={2.6} /> Dispatch {v.id} on Road ({loaded}/{cap} Pallets)
                </button>
              ) : (
                <div style={{ fontSize: 11, color: '#64748b', textAlign: 'center', padding: '8px 0', borderRadius: 9, backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1' }}>
                  Empty — Waiting for AGV Pallets (0/{cap} Loaded)
                </div>
              );
            })()
          ) : (
            <button
              onClick={() => toggleFollow(v.id)}
              style={{
                ...headerBtn,
                width: '100%',
                justifyContent: 'center',
                backgroundColor: following ? '#1d4ed8' : '#eff6ff',
                color: following ? '#ffffff' : '#1d4ed8',
                border: `1px solid ${following ? '#1d4ed8' : '#bfdbfe'}`,
              }}
            >
              <Eye size={13} /> {following ? 'Exit Chase Cam' : 'Follow in Chase Cam'}
            </button>
          )}
        </div>
      </div>
    );
  };

  const mapStyleUrl = useMemo(
    () => MAP_STYLES.find((s) => s.id === activeMapStyle)?.url || 'mapbox://styles/mapbox/standard',
    [activeMapStyle]
  );

  const activeCount = fleet.filter((v) => v.status !== 'AT_PLANT').length;
  const inTransitCount = fleet.filter((v) => ['DEPARTING', 'IN_TRANSIT', 'ARRIVING'].includes(v.status)).length;
  const returningCount = fleet.filter((v) => v.status === 'RETURNING').length;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: isHeaderHidden ? '100vh' : 'calc(100vh - 56px)',
        backgroundColor: '#f8fafc',
        color: '#0f172a',
        fontFamily: 'Inter, system-ui, sans-serif',
        transition: 'height 0.3s ease',
      }}
    >
      
      {/* ─── HEADER ─── */}
      <div style={{ flexShrink: 0, backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0', zIndex: 20 }}>
        {/* Row 1: title · live counters · fleet actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', flexWrap: 'nowrap', overflowX: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flexShrink: 0 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                color: '#ffffff',
                boxShadow: '0 3px 10px rgba(2, 132, 199, 0.28)',
              }}
            >
              <Compass size={18} strokeWidth={2.4} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', letterSpacing: -0.2 }}>Live Fleet Tracking</span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 9,
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: 999,
                    backgroundColor: fleetState ? '#dcfce7' : '#f1f5f9',
                    color: fleetState ? '#15803d' : '#64748b',
                  }}
                >
                  {/* <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: fleetState ? '#22c55e' : '#94a3b8' }} /> */}
                  {/* {fleetState ? 'LIVE · TiDB' : 'CONNECTING'} */}
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>
                Ambattur Plant, Chennai
              </div>
            </div>
          </div>

          {/* Live Counters - compact */}
          <div style={{ display: 'flex', alignItems: 'stretch', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', flexShrink: 0, backgroundColor: '#ffffff' }}>
            {[
              { label: 'Fleet', value: fleet.length, icon: Truck, color: '#0284c7' },
              { label: 'Active', value: activeCount, icon: Activity, color: '#d97706' },
              { label: 'In Transit', value: inTransitCount, icon: Navigation, color: '#7c3aed' },
              { label: 'Returning', value: returningCount, icon: Clock, color: '#ea580c' },
              { label: 'Delivered', value: fleetState?.today.deliveries ?? 0, icon: CheckCircle2, color: '#059669' },
            ].map((s, i) => (
              <div
                key={s.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 8px',
                  borderLeft: i ? '1px solid #e2e8f0' : 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: `${s.color}14`,
                    flexShrink: 0,
                  }}
                >
                  <s.icon size={12} style={{ color: s.color }} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 9, color: '#64748b', fontWeight: 600, marginTop: 1 }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Fleet actions */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {(() => {
              const staged = fleetState?.dock.count ?? 0;
              const readyCount = fleetState?.dock.readyTrucksCount ?? 0;
              const loadedCount = fleetState?.dock.loadedTrucksCount ?? 0;
              const allReady = readyCount === 4;
              const hasLoaded = loadedCount > 0;
              return (
                <>
                  <div
                    title="Staged pallets and truck loading status at Plant Base (4 Pallets per Truck · 16 Pallets Total Capacity)"
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px', borderRadius: 9, border: '1px solid #e2e8f0', backgroundColor: '#ffffff', flexShrink: 0 }}
                  >
                    <Package size={14} style={{ color: '#0284c7', flexShrink: 0 }} />
                    <div style={{ minWidth: 155 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 10, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        <span>Dock & Staged</span>
                        <span>{staged}/16 Pallets · {fleetState?.dock.tonnage ?? 0} t</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, backgroundColor: '#e2e8f0', marginTop: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, (staged / 16) * 100)}%`, backgroundColor: allReady ? '#059669' : '#0284c7', transition: 'width 0.4s' }} />
                      </div>
                      <div style={{ fontSize: 9, color: allReady ? '#059669' : '#64748b', marginTop: 2, fontWeight: allReady ? 700 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {allReady
                          ? '✓ 4 Trucks Filled (19.2 T) — Ready'
                          : `${readyCount}/4 Trucks Filled`}
                      </div>
                    </div>
                  </div>

                  <button
                    disabled={!hasLoaded || isDispatching}
                    onClick={() => handleManualDispatch(undefined, true)}
                    style={{
                      ...headerBtn,
                      padding: '7px 14px',
                      background: hasLoaded ? 'linear-gradient(135deg, #059669, #10b981)' : '#f1f5f9',
                      color: hasLoaded ? '#ffffff' : '#94a3b8',
                      border: 'none',
                      boxShadow: hasLoaded ? (allReady ? '0 3px 12px rgba(16, 185, 129, 0.4)' : '0 3px 10px rgba(16, 185, 129, 0.25)') : 'none',
                      cursor: hasLoaded ? (isDispatching ? 'wait' : 'pointer') : 'not-allowed',
                      fontSize: 11,
                      fontWeight: 700,
                      gap: 5,
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    <Play size={13} strokeWidth={2.8} />
                    {allReady
                      ? 'Dispatch All (4 Ready · 19.2 T)'
                      : hasLoaded
                      ? `Dispatch All (${loadedCount} Ready)`
                      : 'Dispatch All'}
                  </button>
                </>
              );
            })()}
          </div>
        </div>

        {/* Row 2: view toolbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            padding: '8px 20px',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #f1f5f9',
            flexWrap: 'wrap',
          }}
        >
          <ToolbarGroup label="Camera">
            {[
              { id: 'follow', label: 'Chase Cam', icon: Navigation, active: !!followVehicleId },
              { id: 'street', label: 'Street Level', icon: Building2, active: false },
              { id: 'plant', label: 'Plant HQ', icon: Factory, active: false },
              { id: 'regional', label: 'Overview', icon: MapIcon, active: false },
            ].map((cam) => (
              <SegButton key={cam.id} active={cam.active} onClick={() => setCameraPreset(cam.id as any)} icon={cam.icon} label={cam.label} />
            ))}
          </ToolbarGroup>

          <ToolbarGroup label="Lighting">
            {[
              { id: 'day', label: 'Day', icon: Sun },
              { id: 'dawn', label: 'Dawn', icon: Sunrise },
              { id: 'dusk', label: 'Dusk', icon: Sunset },
              { id: 'night', label: 'Night', icon: Moon },
            ].map((l) => (
              <SegButton key={l.id} active={lightPreset === l.id} onClick={() => setLightPreset(l.id as LightPreset)} icon={l.icon} label={l.label} />
            ))}
          </ToolbarGroup>

          <ToolbarGroup label="Map">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px' }}>
              <Layers size={13} style={{ color: '#64748b' }} />
              <select
                value={activeMapStyle}
                onChange={(e) => setActiveMapStyle(e.target.value)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#334155',
                  cursor: 'pointer',
                  outline: 'none',
                  padding: '5px 2px',
                }}
              >
                {MAP_STYLES.map((st) => (
                  <option key={st.id} value={st.id}>{st.name}</option>
                ))}
              </select>
            </div>
          </ToolbarGroup>

          <div style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
            <Crosshair size={12} /> Click a truck on the map for details
          </div>
        </div>
      </div>

      {/* ─── BODY CONTAINER ─── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        
        {/* ─── LEFT FLEET CONTROL PANEL (COLLAPSIBLE) ─── */}
        <div
          style={{
            width: isLeftPanelCollapsed ? 0 : 320,
            flexShrink: 0,
            backgroundColor: '#ffffff',
            borderRight: isLeftPanelCollapsed ? 'none' : '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 15,
            boxShadow: '2px 0 10px rgba(0,0,0,0.03)',
            transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 14px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f8fafc',
              minWidth: 320,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Real Road Fleet Navigation
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12, whiteSpace: 'nowrap', backgroundColor: fleetState ? '#dcfce7' : '#fee2e2', color: fleetState ? '#166534' : '#991b1b' }}>
                {isLoadingRoutes ? 'SNAPPING...' : fleetState ? '● DB SYNCED' : '○ OFFLINE'}
              </span> */}
              <button
                onClick={() => setIsLeftPanelCollapsed(true)}
                title="Shrink / Collapse Fleet Sidebar"
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s',
                }}
              >
                <ChevronLeft size={15} />
              </button>
            </div>
          </div>

          {/* Vehicle Cards List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {fleet.map((v) => {
              const cfg = STATUS_CONFIG[v.status];
              const dest = getDest(v.destinationId);
              const isSelected = selectedId === v.id;
              const isFollowing = followVehicleId === v.id;

              return (
                <div
                  key={v.id}
                  onClick={() => selectVehicle(v.id)}
                  style={{
                    borderRadius: 12,
                    padding: 12,
                    cursor: 'pointer',
                    backgroundColor: isSelected || isFollowing ? '#f0f9ff' : '#ffffff',
                    border: `1.5px solid ${isSelected || isFollowing ? '#0284c7' : '#e2e8f0'}`,
                    boxShadow: isSelected || isFollowing ? '0 4px 12px rgba(2,132,199,0.15)' : '0 1px 3px rgba(0,0,0,0.04)',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                >
                  {/* Top: ID + Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: cfg.bgLight,
                          border: `1px solid ${cfg.color}44`,
                        }}
                      >
                        <Truck size={16} style={{ color: cfg.color }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{v.id}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{v.name}</div>
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 20,
                        backgroundColor: cfg.bgLight,
                        color: cfg.color,
                        border: `1px solid ${cfg.color}33`,
                      }}
                    >
                      {cfg.label}
                    </span>
                  </div>

                  {/* Destination & Real Distance */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5, marginBottom: 8 }}>
                    <MapPin size={12} style={{ color: dest.color, flexShrink: 0, marginTop: 2 }} />
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#1e293b' }}>{dest.name}</div>
                      <div style={{ fontSize: 10, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {dest.address} ({v.distanceKm} km)
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar & Telemetry when Active */}
                  {v.status !== 'AT_PLANT' ? (
                    <div style={{ backgroundColor: '#f8fafc', borderRadius: 8, padding: '8px 10px', marginBottom: 8, border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>
                        <span>{v.status === 'RETURNING' ? '↺ Return to Plant' : '➔ Outbound via Highway'}</span>
                        <span style={{ color: cfg.color }}>{Math.round(v.progress * 100)}%</span>
                      </div>
                      
                      <div style={{ height: 6, borderRadius: 3, backgroundColor: '#e2e8f0', overflow: 'hidden', marginBottom: 6 }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${v.progress * 100}%`,
                            background: `linear-gradient(90deg, ${cfg.color}, ${dest.color})`,
                            borderRadius: 3,
                            transition: 'width 0.1s linear',
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, color: '#475569' }}>
                        <span><Clock size={10} style={{ display: 'inline', marginRight: 3, color: '#64748b' }} />ETA: <strong>{v.eta}m</strong></span>
                        <span><Zap size={10} style={{ display: 'inline', marginRight: 3, color: '#d97706' }} />{Math.round(v.speed)} km/h</span>
                        <span><Fuel size={10} style={{ display: 'inline', marginRight: 3, color: '#059669' }} />{Math.round(v.fuelLevel)}%</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ backgroundColor: '#f8fafc', borderRadius: 8, padding: '8px 10px', marginBottom: 8, fontSize: 11, border: '1px solid #e2e8f0' }}>
                      {(() => {
                        const truck = fleetState?.trucks.find((t) => t.id === v.id);
                        const cap = truck?.capacityPallets ?? 4;
                        const loaded = truck?.loadedPallets ?? 0;
                        const isReady = truck?.isReady ?? (loaded >= cap);
                        const pct = Math.min(100, (loaded / cap) * 100);
                        const tonnes = (loaded * (fleetState?.config.palletTonnes ?? 1.2)).toFixed(1);
                        return (
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                              <span style={{ fontWeight: 700, color: '#0f172a' }}>
                                <Package size={11} style={{ display: 'inline', marginRight: 4, color: '#0284c7' }} />
                                Pallet Fill: <strong>{loaded}/{cap}</strong> ({tonnes} t)
                              </span>
                              <span style={{ fontSize: 10, fontWeight: 700, color: isReady ? '#059669' : loaded > 0 ? '#0284c7' : '#64748b' }}>
                                {isReady ? '● READY' : loaded > 0 ? `● STAGING (${Math.round(pct)}%)` : '○ QUEUED'}
                              </span>
                            </div>

                            <div style={{ height: 5, borderRadius: 3, backgroundColor: '#e2e8f0', overflow: 'hidden', marginBottom: 4 }}>
                              <div
                                style={{
                                  height: '100%',
                                  width: `${pct}%`,
                                  backgroundColor: isReady ? '#059669' : '#0284c7',
                                  borderRadius: 3,
                                  transition: 'width 0.3s ease',
                                }}
                              />
                            </div>

                            <div style={{ fontSize: 10, color: '#64748b' }}>
                              {isReady
                                ? '✓ Full load ready — awaiting manual dispatch trigger'
                                : loaded > 0
                                ? `Receiving pallets (${loaded * 240} pcs loaded)`
                                : `Parked in Bay — next in queue for incoming pallets`}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Action Buttons: Dispatch or 3D Chase Cam */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    {v.status === 'AT_PLANT' ? (
                      (() => {
                        const truckState = fleetState?.trucks.find((t) => t.id === v.id);
                        const loaded = truckState?.loadedPallets ?? 0;
                        const cap = truckState?.capacityPallets ?? 4;
                        const canDisp = loaded > 0;
                        return canDisp ? (
                          <button
                            disabled={isDispatching}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleManualDispatch(v.id);
                            }}
                            style={{
                              flex: 1,
                              padding: '7px 0',
                              borderRadius: 6,
                              background: 'linear-gradient(135deg, #059669, #10b981)',
                              color: '#ffffff',
                              fontWeight: 700,
                              fontSize: 11,
                              border: 'none',
                              cursor: isDispatching ? 'wait' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 5,
                              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
                            }}
                          >
                            <Play size={12} strokeWidth={2.6} /> Dispatch on Road ({loaded}/{cap} Pallets)
                          </button>
                        ) : (
                          <div style={{ flex: 1, padding: '6px 0', borderRadius: 6, fontSize: 11, fontWeight: 600, color: '#64748b', textAlign: 'center', border: '1px dashed #cbd5e1', backgroundColor: '#f8fafc' }}>
                            Empty (0/{cap} Pallets Loaded)
                          </div>
                        );
                      })()
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFollow(v.id);
                        }}
                        style={{
                          flex: 1,
                          padding: '6px 0',
                          borderRadius: 6,
                          backgroundColor: isFollowing ? '#1d4ed8' : '#eff6ff',
                          color: isFollowing ? '#ffffff' : '#1d4ed8',
                          fontWeight: 700,
                          fontSize: 11,
                          border: `1px solid ${isFollowing ? '#1d4ed8' : '#bfdbfe'}`,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                        }}
                      >
                        <Eye size={12} /> {isFollowing ? 'Tracking Behind in 3D' : '3D Chase Cam (Follow)'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Plant Base & Warehouse Legend */}
          <div style={{ padding: '12px 14px', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
              Marked Logistics Destinations
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#0284c7' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>Plant Base HQ (Ambattur Industrial)</span>
            </div>

            {DESTINATIONS.map((d) => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: d.color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {d.name} ({d.distanceKm} km)
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ─── MAPBOX 3D VIEWPORT CONTAINER (FULL 3D ARCHITECTURE) ─── */}
        <div ref={mapContainerRef} style={{ flex: '1 1 0%', position: 'relative', width: '100%', height: '100%', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
          <style>{`
            .mapboxgl-map, .mapboxgl-canvas-container, .mapboxgl-canvas {
              width: 100% !important;
              height: 100% !important;
            }
            .mapboxgl-ctrl-logo,
            a.mapboxgl-ctrl-logo,
            .mapboxgl-ctrl-attrib,
            .mapboxgl-compact {
              display: none !important;
              visibility: hidden !important;
              opacity: 0 !important;
              pointer-events: none !important;
            }
          `}</style>

          {/* Floating Show Fleet Panel Button when collapsed */}
          {isLeftPanelCollapsed && (
            <button
              onClick={() => setIsLeftPanelCollapsed(false)}
              style={{
                position: 'absolute',
                top: 14,
                left: 14,
                zIndex: 25,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 14px',
                borderRadius: 10,
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                boxShadow: '0 4px 18px rgba(15, 23, 42, 0.15)',
                color: '#0f172a',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Expand Real Road Fleet Navigation Sidebar"
            >
              <ChevronRight size={16} style={{ color: '#0284c7' }} />
              <span>Show Fleet Panel</span>
              <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 12, backgroundColor: '#eff6ff', color: '#0284c7' }}>
                {fleet.length} Trucks
              </span>
            </button>
          )}

          {/* Floating Shrink / Show Header Button on Map (Top-Right overlay matching Show Fleet Panel) */}
          {onToggleHeader && (
            <button
              onClick={onToggleHeader}
              style={{
                position: 'absolute',
                top: 14,
                right: 54,
                zIndex: 25,
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '8px 14px',
                borderRadius: 10,
                backgroundColor: isHeaderHidden ? '#eff6ff' : '#ffffff',
                border: `1.5px solid ${isHeaderHidden ? '#3b82f6' : '#cbd5e1'}`,
                boxShadow: '0 4px 18px rgba(15, 23, 42, 0.15)',
                color: isHeaderHidden ? '#1d4ed8' : '#0f172a',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'none')}
              title={isHeaderHidden ? 'Restore Global Header' : 'Shrink / Hide Global Header (Expand Full Height Map)'}
            >
              {isHeaderHidden ? (
                <>
                  <Minimize2 size={15} style={{ color: '#1d4ed8' }} />
                  <span>Show Header</span>
                </>
              ) : (
                <>
                  <Maximize2 size={15} style={{ color: '#0284c7' }} />
                  <span>Shrink Header</span>
                </>
              )}
            </button>
          )}

          <Map
            ref={mapRef}
            initialViewState={INITIAL_VIEW}
            onLoad={onMapLoad}
            onClick={onMapClick}
            onMouseMove={onMapMouseMove}
            mapboxAccessToken={MAPBOX_TOKEN}
            style={{ width: '100%', height: '100%' }}
            mapStyle={mapStyleUrl}
            styleDiffing={false}
            projection={{ name: 'mercator' } as any}
            antialias
            attributionControl={false}
            maxPitch={75}
          >
            <NavigationControl position="top-right" visualizePitch />
            <ScaleControl position="bottom-right" />

            {/* ── Plant Base 3D Origin Marker ── */}
            <Marker longitude={PLANT_LOCATION[0]} latitude={PLANT_LOCATION[1]} anchor="center">
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <div
                  style={{
                    width: currentZoom < 11 ? 32 : 48,
                    height: currentZoom < 11 ? 32 : 48,
                    borderRadius: currentZoom < 11 ? 10 : 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                    border: '2.5px solid #ffffff',
                    boxShadow: '0 8px 24px rgba(2, 132, 199, 0.55)',
                    position: 'relative',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Building2 size={currentZoom < 11 ? 18 : 26} color="#ffffff" />
                  <span
                    style={{
                      position: 'absolute',
                      top: -2,
                      right: -2,
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      backgroundColor: '#22c55e',
                      border: '2px solid #ffffff',
                      animation: 'pulse 2s infinite',
                    }}
                  />
                </div>
                {currentZoom >= 11 && (
                  <div
                    style={{
                      marginTop: 4,
                      padding: '2px 8px',
                      borderRadius: 6,
                      fontSize: 10,
                      fontWeight: 800,
                      backgroundColor: '#ffffff',
                      color: '#0284c7',
                      border: '1.5px solid #0284c7',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.18)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    🏭 PLANT BASE HQ
                  </div>
                )}
              </div>
            </Marker>

            {/* ── Marked Destination Warehouses on Actual Roads ── */}
            {DESTINATIONS.map((d) => (
              <Marker key={d.id} longitude={d.coords[0]} latitude={d.coords[1]} anchor="center">
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <div
                    style={{
                      width: currentZoom < 11 ? 28 : 42,
                      height: currentZoom < 11 ? 28 : 42,
                      borderRadius: currentZoom < 11 ? 9 : 14,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#ffffff',
                      border: `2.5px solid ${d.color}`,
                      boxShadow: `0 8px 20px ${d.color}55`,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <Package size={currentZoom < 11 ? 15 : 20} style={{ color: d.color }} />
                  </div>
                  {currentZoom >= 11 && (
                    <div
                      style={{
                        marginTop: 3,
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontSize: 10,
                        fontWeight: 800,
                        backgroundColor: '#ffffff',
                        color: d.color,
                        border: `1.5px solid ${d.color}`,
                        boxShadow: '0 4px 10px rgba(0,0,0,0.12)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      📍 {d.name.split(' ').slice(0, 2).join(' ')}
                    </div>
                  )}
                </div>
              </Marker>
            ))}
          </Map>

          {/* ── Truck HUD labels (positioned above the 3D trucks) ── */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}>
            {fleet.map((v) => {
              const cfg = STATUS_CONFIG[v.status];
              const isSelected = selectedId === v.id;
              const isFollowed = followVehicleId === v.id;
              const isDetails = detailsId === v.id;
              const isHovered = hoveredTruckId === v.id;
              const isProminent = isSelected || isFollowed || isDetails || isHovered;
              // Badge is strictly visible ONLY when clicked / selected
              const showCard = isSelected || isDetails;

              return (
                <div
                  key={v.id}
                  ref={(el) => {
                    labelRefs.current[v.id] = el;
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    openDetails(v.id);
                  }}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    visibility: 'hidden',
                    pointerEvents: showCard ? 'auto' : 'none',
                    cursor: 'pointer',
                    willChange: 'transform',
                    zIndex: isProminent ? 12 : 3,
                  }}
                >
                  {showCard ? (
                    <div
                      style={{
                        marginBottom: 6,
                        padding: isProminent ? '4px 10px' : '2px 8px',
                        borderRadius: 8,
                        backgroundColor: isProminent ? '#ffffff' : 'rgba(255, 255, 255, 0.95)',
                        color: '#0f172a',
                        fontSize: isProminent ? 11 : 10,
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
                        boxShadow: isProminent ? '0 8px 24px rgba(2, 132, 199, 0.35)' : '0 4px 12px rgba(0,0,0,0.18)',
                        border: `2px solid ${isProminent ? cfg.color : '#cbd5e1'}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        userSelect: 'none',
                        transform: isProminent ? 'scale(1.04)' : 'scale(0.95)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          backgroundColor: cfg.color,
                          boxShadow: `0 0 6px ${cfg.color}`,
                        }}
                      />
                      <span>{v.id}</span>
                      {isMoving(v.status) && (
                        <span style={{ color: '#0284c7', fontWeight: 800, fontSize: 10 }}>{v.speed} km/h</span>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* ─── Mission Timeline Overlay Card (Right Bottom End) ─── */}
          {detailsVehicle && renderDetailsCard(detailsVehicle)}

          {selectedVehicle && !detailsVehicle && (
            <div
              style={{
                position: 'absolute',
                bottom: 20,
                right: 20,
                width: 'auto',
                maxWidth: 540,
                minWidth: 420,
                borderRadius: 16,
                backgroundColor: 'rgba(255, 255, 255, 0.98)',
                backdropFilter: 'blur(10px)',
                border: '1.5px solid #0284c7',
                padding: '15px 18px',
                zIndex: 15,
                boxShadow: '0 16px 40px rgba(15, 23, 42, 0.2)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      backgroundColor: '#eff6ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#0284c7',
                    }}
                  >
                    <Truck size={16} />
                  </div>
                  <div>
                    <span style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>
                      {selectedVehicle.id} – Road Navigation Mission
                    </span>
                    <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>
                      Driver: {selectedVehicle.driver}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => toggleFollow(selectedVehicle.id)}
                    style={{
                      background: followVehicleId === selectedVehicle.id ? '#1d4ed8' : '#eff6ff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '4px 8px',
                      cursor: 'pointer',
                      color: followVehicleId === selectedVehicle.id ? '#ffffff' : '#1d4ed8',
                      fontSize: 11,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Eye size={12} /> {followVehicleId === selectedVehicle.id ? 'Exit Chase Cam' : 'Chase Cam'}
                  </button>
                  <button
                    onClick={() => setSelectedId(null)}
                    style={{
                      background: '#f1f5f9',
                      border: 'none',
                      borderRadius: 6,
                      padding: '4px 8px',
                      cursor: 'pointer',
                      color: '#475569',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Progress Milestones */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                {(['AT_PLANT', 'DEPARTING', 'IN_TRANSIT', 'ARRIVING', 'DELIVERED', 'RETURNING'] as VehicleStatus[]).map(
                  (s, i, arr) => {
                    const cfg = STATUS_CONFIG[s];
                    const statusOrder: VehicleStatus[] = ['AT_PLANT', 'DEPARTING', 'IN_TRANSIT', 'ARRIVING', 'DELIVERED', 'RETURNING'];
                    const isActive = selectedVehicle.status === s;
                    const isPast = statusOrder.indexOf(selectedVehicle.status) > statusOrder.indexOf(s);

                    return (
                      <React.Fragment key={s}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <div
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              backgroundColor: isActive ? cfg.color : isPast ? '#059669' : '#cbd5e1',
                              boxShadow: isActive ? `0 0 10px ${cfg.color}` : 'none',
                              border: '2px solid #ffffff',
                            }}
                          />
                          <span
                            style={{
                              fontSize: 9,
                              color: isActive ? cfg.color : isPast ? '#059669' : '#94a3b8',
                              fontWeight: isActive ? 800 : 600,
                              textAlign: 'center',
                            }}
                          >
                            {cfg.label.replace(' ✓', '').replace(' Base', '')}
                          </span>
                        </div>
                        {i < arr.length - 1 && (
                          <div
                            style={{
                              flex: 1,
                              height: 3,
                              backgroundColor: isPast ? '#059669' : '#e2e8f0',
                              margin: '0 4px',
                              marginBottom: 16,
                              borderRadius: 2,
                            }}
                          />
                        )}
                      </React.Fragment>
                    );
                  }
                )}
              </div>

              {/* Live telemetry */}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 10, fontSize: 11, color: '#475569', fontWeight: 600 }}>
                <span><Zap size={11} style={{ display: 'inline', marginRight: 3, color: '#d97706' }} />{selectedVehicle.speed} km/h</span>
                <span><Clock size={11} style={{ display: 'inline', marginRight: 3, color: '#64748b' }} />ETA {selectedVehicle.eta} min</span>
                <span><Fuel size={11} style={{ display: 'inline', marginRight: 3, color: '#059669' }} />{Math.round(selectedVehicle.fuelLevel)}%</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <MapPin size={11} style={{ display: 'inline', marginRight: 3, color: getDest(selectedVehicle.destinationId).color }} />
                  {getDest(selectedVehicle.destinationId).name} · {selectedVehicle.distanceKm} km
                </span>
              </div>

              {/* Cargo Badge Bar */}
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: 10,
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Box size={14} style={{ color: '#0284c7' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#1e293b' }}>
                    {selectedVehicle.palletCount} Pallets · {selectedVehicle.batchId}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b' }}>
                  <ShieldCheck size={14} style={{ color: '#059669' }} /> Road Manifest Verified
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.15);
          }
        }
      `}</style>
    </div>
  );
};

export default LiveFleetTrackingView;
