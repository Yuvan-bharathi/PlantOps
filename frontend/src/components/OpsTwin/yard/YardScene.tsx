import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { FleetState } from '../fleet';
import { statusOf } from '../status';
import { BayOutline, CameraApi, CameraRig, Chip, EntityRef, pickable, Pin, sameRef, SceneLights, SelectionBrackets } from '../sceneKit';
import {
  AISLE_Z, allDoors, BACK_Z, CHARGER_LANE, BAY_REAR_Z, FENCE_Z, FRONT_Z, HALF_W, LANE_Z, NETWORK_HOME, ROAD_Z, SITE_DEFS, SiteDef, TRUCK_CENTER_Z, V2, WORLD_BOUNDS,
} from './layout';
import { BuildingModel, ChargerModel, DOOR_H, DOOR_W, ForkliftModel, mergedBoxes, PalletModel, rollerMat, std, TankModel, TreeCluster, TruckModel, BRAND, basic, plateTex } from './models';
import { chargerAt, forkliftAt, forkliftTraffic, onYard, siteSnapshot, spareForklifts, truckAt } from './sim';
import type { AlertSeverity } from './insights';

export interface CellStatus {
  worst: string;
  running: number;
  total: number;
  alerts: number;
}

export interface YardLayers {
  routes: boolean;
  labels: boolean;
  heatmap: boolean;
  dockStatus: boolean;
  stagingFill: boolean;
  health: boolean;
  halos: boolean;
}

export const DEFAULT_LAYERS: YardLayers = { routes: true, labels: true, heatmap: false, dockStatus: true, stagingFill: false, health: false, halos: false };

interface Props {
  fleet: FleetState | null;
  /** View clock in seconds (live or replay). */
  now: () => number;
  cellStatus: Record<string, CellStatus>;
  selected: EntityRef | null;
  onSelect: (e: EntityRef | null) => void;
  onEnter: (siteId: string, then?: EntityRef, buildingId?: string) => void;
  cameraRef: React.Ref<CameraApi>;
  layers: YardLayers;
  /** `${kind}:${id}` → severity of an active, unacknowledged alert */
  alertKeys: Map<string, AlertSeverity>;
  /** 0 = day … 1 = night */
  night: number;
  onUserInteract?: () => void;
}

interface Ctx {
  now: () => number;
  fleet: React.MutableRefObject<FleetState | null>;
  selected: EntityRef | null;
  onSelect: (e: EntityRef | null) => void;
  layers: YardLayers;
  alertKeys: Map<string, AlertSeverity>;
  night: number;
}
// Kept on globalThis so a Vite hot reload of this module reuses the same context object
// (otherwise the Canvas subtree can read a fresh, provider-less context and crash in dev).
const YardCtx: React.Context<Ctx> = ((globalThis as any).__plantopsYardCtx ??= createContext<Ctx>(null as any));
const useYard = () => useContext(YardCtx);

const DETAIL_DIST = 330; // beyond this the site shows buildings only
const NEAR_DIST = 175; // closer than this: building chips instead of the site chip
const SEV_COLOR: Record<AlertSeverity, string> = { critical: '#EF4444', warning: '#F59E0B', info: '#3B82F6' };

/** Throttled per-frame check of the camera distance to a world point. */
function useCameraDistance(world: [number, number, number], cb: (d: number) => void) {
  const { camera } = useThree();
  const acc = useRef(0);
  const v = useMemo(() => new THREE.Vector3(...world), [world]);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.2) return;
    acc.current = 0;
    cb(camera.position.distanceTo(v));
  });
}

/** Pulsing ground ring that marks an entity with an active alert. */
const Halo: React.FC<{ severity: AlertSeverity; radius: number; y?: number }> = ({ severity, radius, y = 0.09 }) => {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const k = (clock.elapsedTime * 0.9) % 1;
    m.scale.setScalar(0.75 + k * 0.6);
    (m.material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - k);
  });
  return (
    <mesh ref={ref} position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius * 0.82, radius, 48]} />
      <meshBasicMaterial color={SEV_COLOR[severity]} transparent opacity={0.6} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
};

// ─── Static yard dressing (merged into a handful of draw calls per site) ──────

type Box = { p: [number, number, number]; s: [number, number, number] };

const SiteGround: React.FC<{ s: SiteDef }> = ({ s }) => {
  const { onSelect, layers } = useYard();
  const { routes, markings } = useMemo(() => {
    const r: Box[] = [];
    const m: Box[] = [];
    const dashX = (x0: number, x1: number, z: number) => {
      for (let x = x0; x < x1 - 0.6; x += 2.4) r.push({ p: [x + 0.7, 0.06, z], s: [1.4, 0.02, 0.16] });
    };
    const dashZ = (x: number, z0: number, z1: number) => {
      for (let z = z0; z < z1 - 0.6; z += 2.4) r.push({ p: [x, 0.06, z + 0.7], s: [0.16, 0.02, 1.4] });
    };
    const rect = (cx: number, cz: number, w: number, d: number, t = 0.15) => {
      m.push({ p: [cx, 0.06, cz - d / 2], s: [w, 0.02, t] }, { p: [cx, 0.06, cz + d / 2], s: [w, 0.02, t] });
      m.push({ p: [cx - w / 2, 0.06, cz], s: [t, 0.02, d] }, { p: [cx + w / 2, 0.06, cz], s: [t, 0.02, d] });
    };
    // forklift route map: main aisle + spurs to every door, bay and charger
    dashX(-HALF_W + 7, HALF_W - 3, AISLE_Z);
    allDoors(s).forEach((d) => dashZ(d.x, FRONT_Z + 0.8, AISLE_Z));
    s.bays.forEach((b) => dashZ(b.x, AISLE_Z, BAY_REAR_Z - 0.4));
    s.chargers.forEach((c) => dashX(c.park[0] + 1.2, c.park[0] + CHARGER_LANE, c.park[1]));
    dashZ(s.chargers[0].park[0] + CHARGER_LANE, AISLE_Z, s.chargers[s.chargers.length - 1].park[1]);
    // truck bays, staging slots, charger zone, visitor parking
    s.bays.forEach((b) => rect(b.x, TRUCK_CENTER_Z + 0.4, 4.3, 11.2));
    s.slots.forEach((sl) => rect(sl.x, sl.z, 1.85, 1.85, 0.08));
    rect(-HALF_W + 6.5, 16.6, 10.6, 16, 0.12);
    (s.truckParking || []).forEach(([x, z]) => rect(x, z + 0.4, 4.3, 11.2));
    return { routes: mergedBoxes(`routes-${s.id}`, r), markings: mergedBoxes(`markings-${s.id}`, m) };
  }, [s]);
  const white = useMemo(() => {
    const boxes: Box[] = [];
    for (let x = -HALF_W + 2; x < HALF_W - 2; x += 5) boxes.push({ p: [x + 1.2, 0.06, LANE_Z], s: [2.4, 0.02, 0.2] });
    return mergedBoxes(`white-${s.id}`, boxes);
  }, [s]);
  const fence = useMemo(() => {
    const posts: Box[] = [];
    const panels: Box[] = [];
    const run = (x0: number, z0: number, x1: number, z1: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.max(1, Math.round(len / 4));
      for (let i = 0; i <= n; i++) posts.push({ p: [x0 + ((x1 - x0) * i) / n, 1, z0 + ((z1 - z0) * i) / n], s: [0.14, 2, 0.14] });
      panels.push({ p: [(x0 + x1) / 2, 1.05, (z0 + z1) / 2], s: [Math.abs(x1 - x0) || 0.05, 1.7, Math.abs(z1 - z0) || 0.05] });
    };
    run(-HALF_W, BACK_Z, HALF_W, BACK_Z);
    run(-HALF_W, BACK_Z, -HALF_W, FENCE_Z);
    run(HALF_W, BACK_Z, HALF_W, FENCE_Z);
    run(-HALF_W, FENCE_Z, s.gateX - 6, FENCE_Z);
    run(s.gateX + 6, FENCE_Z, HALF_W, FENCE_Z);
    return { posts: mergedBoxes(`posts-${s.id}`, posts), panels: mergedBoxes(`panels-${s.id}`, panels) };
  }, [s]);
  const trees = useMemo(() => {
    const pts: [number, number][] = [];
    for (let x = -HALF_W + 4; x < HALF_W; x += 8.5) {
      if (Math.abs(x - s.gateX) > 9) pts.push([x, FENCE_Z + 2.4]);
      pts.push([x + 2, BACK_Z - 2.5]);
    }
    for (let z = BACK_Z + 4; z < FENCE_Z; z += 9) {
      pts.push([-HALF_W - 2.4, z]);
      pts.push([HALF_W + 2.4, z]);
    }
    return pts;
  }, [s]);
  const panelMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#CBD5E1', transparent: true, opacity: 0.38 }), []);

  return (
    <group>
      {/* compound slab, paved yard + lane, charger zone */}
      <mesh position={[0, 0.01, (BACK_Z + FENCE_Z) / 2]} receiveShadow onClick={(e) => { e.stopPropagation(); onSelect(null); }}>
        <boxGeometry args={[HALF_W * 2, 0.02, FENCE_Z - BACK_Z]} />
        <meshStandardMaterial color="#EEF2F7" roughness={1} />
      </mesh>
      <mesh position={[0, 0.03, LANE_Z]} receiveShadow>
        <boxGeometry args={[HALF_W * 2 - 0.4, 0.02, 9]} />
        <meshStandardMaterial color="#D9E0EA" roughness={1} />
      </mesh>
      <mesh position={[s.gateX, 0.03, (FENCE_Z + ROAD_Z) / 2]} receiveShadow>
        <boxGeometry args={[11, 0.02, ROAD_Z - FENCE_Z]} />
        <meshStandardMaterial color="#D9E0EA" roughness={1} />
      </mesh>
      <mesh position={[-HALF_W + 6.5, 0.035, 16.6]} receiveShadow>
        <boxGeometry args={[10.6, 0.02, 16]} />
        <meshStandardMaterial color="#D4F1DD" roughness={1} />
      </mesh>
      <mesh geometry={routes} material={basic('#F5B700')} visible={layers.routes} />
      <mesh geometry={markings} material={basic('#F5B700')} />
      <mesh geometry={white} material={basic('#ffffff')} />
      <mesh geometry={fence.posts} material={std('#94A3B8', 0.6)} />
      <mesh geometry={fence.panels} material={panelMat} />
      <TreeCluster id={s.id} points={trees} />
      <Gate s={s} />
      {(s.tanks || []).map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <TankModel />
        </group>
      ))}
    </group>
  );
};

const GATE_RADIUS = 17; // metres: a truck this close to the gate opens the barrier
const Gate: React.FC<{ s: SiteDef }> = ({ s }) => {
  const { now, fleet } = useYard();
  const arm = useRef<THREE.Group>(null);
  const angle = useRef(0);
  const open = useRef(false);
  const acc = useRef(1);
  useFrame((_, dt) => {
    // the boom lifts only while a truck is approaching / passing the gate, then lowers again
    acc.current += dt;
    if (acc.current > 0.15) {
      acc.current = 0;
      const t = now();
      open.current = s.bays.some((b) => {
        const tr = truckAt(s, b, t, fleet.current);
        if (!tr || (tr.phase !== 'road' && tr.phase !== 'docking' && tr.phase !== 'departing')) return false;
        return Math.hypot(tr.x - s.gateX, tr.z - FENCE_Z) < GATE_RADIUS;
      });
    }
    const target = open.current ? 1.35 : 0;
    angle.current += (target - angle.current) * Math.min(1, dt * 2.5);
    if (arm.current) arm.current.rotation.z = -angle.current; // negative = boom swings up
  });
  return (
    <group position={[s.gateX, 0, FENCE_Z]}>
      <group position={[7.6, 0, 1.6]}>
        <mesh position={[0, 1.4, 0]} castShadow>
          <boxGeometry args={[2.6, 2.8, 2.6]} />
          <meshStandardMaterial color="#F8FAFC" />
        </mesh>
        <mesh position={[0, 2.95, 0]}>
          <boxGeometry args={[3, 0.3, 3]} />
          <meshStandardMaterial color={BRAND} />
        </mesh>
      </group>
      <mesh position={[5.6, 0.7, 0]}>
        <boxGeometry args={[0.4, 1.4, 0.4]} />
        <meshStandardMaterial color="#1E293B" />
      </mesh>
      <group ref={arm} position={[5.6, 1.25, 0]}>
        <mesh position={[-5, 0, 0]}>
          <boxGeometry args={[10, 0.18, 0.18]} />
          <meshStandardMaterial color="#EF4444" />
        </mesh>
      </group>
    </group>
  );
};

/** Roller shutters that open while a forklift is near the doorway and close again after. */
const DoorShutters: React.FC<{ s: SiteDef }> = ({ s }) => {
  const { now } = useYard();
  const doors = useMemo(() => allDoors(s), [s]);
  const refs = useRef<(THREE.Group | null)[]>([]);
  const want = useRef<boolean[]>(doors.map(() => false));
  const amt = useRef<number[]>(doors.map(() => 0));
  const acc = useRef(1);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current > 0.1) {
      acc.current = 0;
      const t = now();
      const fl = s.forklifts.map((f) => forkliftAt(s, f, t));
      doors.forEach((d, i) => {
        want.current[i] = fl.some((f) => Math.abs(f.x - d.x) < 2.6 && f.z > -6 && f.z < 6.5);
      });
    }
    doors.forEach((_, i) => {
      const target = want.current[i] ? 1 : 0;
      amt.current[i] += (target - amt.current[i]) * Math.min(1, dt * 3);
      const g = refs.current[i];
      if (g) g.scale.y = Math.max(0.04, 1 - amt.current[i]); // rolled up into the drum when open
    });
  });
  return (
    <group>
      {doors.map((d, i) => (
        <group key={d.id} ref={(g) => (refs.current[i] = g)} position={[d.x, DOOR_H + 0.2, 0.05]}>
          <mesh position={[0, -DOOR_H / 2, 0]} material={rollerMat()}>
            <planeGeometry args={[DOOR_W, DOOR_H]} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

/** Forklift traffic heatmap: where forklifts drive most during a cycle. */
const Heatmap: React.FC<{ s: SiteDef }> = ({ s }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const cells = useMemo(() => {
    const size = 2;
    const grid = new Map<string, number>();
    for (const [x, z] of forkliftTraffic(s)) {
      const k = `${Math.floor(x / size)}:${Math.floor(z / size)}`;
      grid.set(k, (grid.get(k) || 0) + 1);
    }
    const max = Math.max(1, ...grid.values());
    return [...grid.entries()].map(([k, n]) => {
      const [cx, cz] = k.split(':').map(Number);
      return { x: cx * size + size / 2, z: cz * size + size / 2, v: Math.sqrt(n / max) };
    });
  }, [s]);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const low = new THREE.Color('#60A5FA');
    const mid = new THREE.Color('#FACC15');
    const high = new THREE.Color('#EF4444');
    cells.forEach((c, i) => {
      o.position.set(c.x, 0.075, c.z);
      o.rotation.set(-Math.PI / 2, 0, 0);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      const col = c.v < 0.5 ? low.clone().lerp(mid, c.v * 2) : mid.clone().lerp(high, (c.v - 0.5) * 2);
      m.setColorAt(i, col);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [cells]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, cells.length]}>
      <planeGeometry args={[2, 2]} />
      <meshBasicMaterial transparent opacity={0.55} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  );
};

/** Staging lane tinted by how full it is (green → amber → red). */
const StagingTint: React.FC<{ s: SiteDef }> = ({ s }) => {
  const { now, fleet } = useYard();
  const [fill, setFill] = useState(0);
  const acc = useRef(1);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 1) return;
    acc.current = 0;
    const f = siteSnapshot(s, now(), fleet.current).staged / Math.max(1, s.slots.length);
    if (Math.abs(f - fill) > 0.001) setFill(f);
  });
  const xs = s.slots.map((sl) => sl.x);
  const zs = s.slots.map((sl) => sl.z);
  const x0 = Math.min(...xs) - 1.3;
  const x1 = Math.max(...xs) + 1.3;
  const z0 = Math.min(...zs) - 1.3;
  const z1 = Math.max(...zs) + 1.3;
  const color = fill >= 0.9 ? '#EF4444' : fill >= 0.7 ? '#F59E0B' : '#22C55E';
  return (
    <mesh position={[(x0 + x1) / 2, 0.045, (z0 + z1) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[x1 - x0, z1 - z0]} />
      <meshBasicMaterial color={color} transparent opacity={0.22} depthWrite={false} />
    </mesh>
  );
};

// ─── Live entities ────────────────────────────────────────────────────────────

/**
 * Zoom-aware size: vehicles keep true scale up close and grow gradually as the camera pulls
 * back, so the 3D trucks and forklifts themselves stay readable on the network view.
 */
const ZOOM_NEAR = 110;
const zoomScale = (camDist: number, max: number) => THREE.MathUtils.clamp(camDist / ZOOM_NEAR, 1, max);
const tmpV = new THREE.Vector3();

const Forklift: React.FC<{ s: SiteDef; index: number }> = ({ s, index }) => {
  const { now, selected, onSelect, layers, alertKeys } = useYard();
  const f = s.forklifts[index];
  const { camera } = useThree();
  const ref = useRef<THREE.Group>(null);
  const forks = useRef<THREE.Group>(null);
  const [carrying, setCarrying] = useState(false);
  const [label, setLabel] = useState('');
  const [hover, setHover] = useState(false);
  const isSel = sameRef(selected, { kind: 'forklift', id: f.id });
  const alert = layers.halos ? alertKeys.get(`forklift:${f.id}`) : undefined;
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const snap = forkliftAt(s, f, now());
    g.position.set(snap.x, 0, snap.z);
    g.rotation.y = snap.heading;
    g.scale.setScalar(zoomScale(camera.position.distanceTo(g.getWorldPosition(tmpV)), 2.5));
    if (forks.current) forks.current.position.y = snap.lift * 0.85; // forks rise to pick / drop
    if (snap.carrying !== carrying) setCarrying(snap.carrying);
    if ((hover || isSel) && snap.statusLabel !== label) setLabel(snap.statusLabel);
  });
  return (
    <group ref={ref} {...pickable(() => onSelect({ kind: 'forklift', id: f.id }), setHover)}>
      <ForkliftModel carrying={carrying} variant={index % 2 ? 'blue' : 'box'} forksRef={forks} />
      {alert && <Halo severity={alert} radius={2.6} />}
      {isSel && <SelectionBrackets size={[2.1, 2.9, 3.6]} />}
      {(hover || isSel) && <Chip position={[0, 3.6, 0]} title={f.id} subtitle={label} dot="#FACC15" selected={isSel} small priority={90} />}
    </group>
  );
};

const SpareForklift: React.FC<{ s: SiteDef; index: number }> = ({ s, index }) => {
  const { selected, onSelect } = useYard();
  const sp = spareForklifts(s)[index];
  const { camera } = useThree();
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = ref.current;
    if (g) g.scale.setScalar(zoomScale(camera.position.distanceTo(g.getWorldPosition(tmpV)), 2.5));
  });
  const [hover, setHover] = useState(false);
  const isSel = sameRef(selected, { kind: 'forklift', id: sp.def.id });
  return (
    <group ref={ref} position={[sp.x, 0, sp.z]} rotation={[0, sp.heading, 0]} {...pickable(() => onSelect({ kind: 'forklift', id: sp.def.id }), setHover)}>
      <ForkliftModel carrying={false} />
      {isSel && <SelectionBrackets size={[2.1, 2.9, 3.6]} />}
      {(hover || isSel) && <Chip position={[0, 3.6, 0]} title={sp.def.id} subtitle="Parked" dot="#94A3B8" selected={isSel} small priority={90} />}
    </group>
  );
};

/** Flat blue docking route with travelling dots, ending at a pin on the bay (reference's docking path). */
const DockingRibbon: React.FC<{ pts: V2[] }> = ({ pts }) => {
  const geom = useMemo(() => {
    const pos: number[] = [];
    const w = 0.7;
    for (let i = 1; i < pts.length; i++) {
      const [x0, z0] = pts[i - 1];
      const [x1, z1] = pts[i];
      const len = Math.hypot(x1 - x0, z1 - z0) || 1;
      const nx = (-(z1 - z0) / len) * w;
      const nz = ((x1 - x0) / len) * w;
      pos.push(x0 + nx, 0.09, z0 + nz, x0 - nx, 0.09, z0 - nz, x1 + nx, 0.09, z1 + nz, x0 - nx, 0.09, z0 - nz, x1 - nx, 0.09, z1 - nz, x1 + nx, 0.09, z1 + nz);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
  }, [pts]);
  useEffect(() => () => geom.dispose(), [geom]);
  const dots = useMemo(() => {
    const out: V2[] = [];
    for (let i = 1; i < pts.length; i++) {
      const [x0, z0] = pts[i - 1];
      const [x1, z1] = pts[i];
      const n = Math.max(1, Math.floor(Math.hypot(x1 - x0, z1 - z0) / 2.2));
      for (let k = 0; k < n; k++) out.push([x0 + ((x1 - x0) * k) / n, z0 + ((z1 - z0) * k) / n]);
    }
    return out;
  }, [pts]);
  const last = pts[pts.length - 1];
  return (
    <group>
      <mesh geometry={geom}>
        <meshBasicMaterial color={BRAND} transparent opacity={0.85} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {dots.map(([x, z], i) => (
        <mesh key={i} position={[x, 0.11, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.24, 12]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
      <Pin position={[last[0], 0, last[1]]} height={3} scale={1.4} />
    </group>
  );
};

const Truck: React.FC<{ s: SiteDef; bayIndex: number }> = ({ s, bayIndex }) => {
  const { now, fleet, selected, onSelect, layers, alertKeys } = useYard();
  const bay = s.bays[bayIndex];
  const { camera } = useThree();
  const key = `${s.id}:${bayIndex}`;
  const ref = useRef<THREE.Group>(null);
  const [carrier, setCarrier] = useState(() => truckAt(s, bay, now(), fleet.current)?.carrier);
  const [chip, setChip] = useState({ id: '', label: '' });
  const [ribbon, setRibbon] = useState<V2[] | null>(null);
  const [visible, setVisible] = useState(false);
  const [cargo, setCargo] = useState({ open: false, n: 0 });
  const [hover, setHover] = useState(false);
  const isSel = sameRef(selected, { kind: 'truck', id: key });
  const alert = layers.halos ? alertKeys.get(`truck:${key}`) : undefined;
  const acc = useRef(0);
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const t = truckAt(s, bay, now(), fleet.current);
    const show = onYard(t);
    if (show !== visible) setVisible(show);
    g.visible = show;
    if (!t || !show) return;
    g.position.set(t.x, 0, t.z);
    g.rotation.y = t.heading;
    g.scale.setScalar(zoomScale(camera.position.distanceTo(g.getWorldPosition(tmpV)), 2.4));
    if (t.carrier !== carrier) setCarrier(t.carrier);
    acc.current += dt;
    if (acc.current > 0.3) {
      acc.current = 0;
      if (t.id !== chip.id || t.label !== chip.label) setChip({ id: t.id, label: t.label });
      // rear doors open while docked; pallets stack as they are loaded (or empty out on unloading)
      const open = t.phase === 'docked';
      const n = open ? (t.kind === 'in' ? Math.max(0, t.pallets.total - t.pallets.done) : t.pallets.done) : 0;
      if (open !== cargo.open || n !== cargo.n) setCargo({ open, n });
      const want = isSel && t.ribbon ? t.ribbon : null;
      if ((want === null) !== (ribbon === null) || (want && ribbon && want.length !== ribbon.length) || (want && isSel)) setRibbon(want);
    }
  });
  return (
    <>
      <group ref={ref} visible={false} {...pickable(() => onSelect({ kind: 'truck', id: key }), setHover)}>
        {carrier && <TruckModel carrier={carrier} open={cargo.open} cargo={cargo.n} />}
        {alert && <Halo severity={alert} radius={6} />}
        {isSel && <SelectionBrackets size={[3.8, 4.8, 10.6]} />}
        {visible && (hover || isSel) && <Chip position={[0, 5.8, 0]} title={chip.id} subtitle={chip.label} dot={BRAND} selected={isSel} priority={90} />}
      </group>
      {isSel && ribbon && ribbon.length > 1 && <DockingRibbon pts={ribbon} />}
    </>
  );
};

const DOCK_TONE: Record<string, string> = { docked: '#22C55E', docking: '#3B82F6', free: '#94A3B8' };

const DockBay: React.FC<{ s: SiteDef; bayIndex: number }> = ({ s, bayIndex }) => {
  const { now, fleet, selected, onSelect, layers } = useYard();
  const bay = s.bays[bayIndex];
  const isSel = sameRef(selected, { kind: 'dock', id: `${s.id}:${bayIndex}` });
  const [state, setState] = useState<'docked' | 'docking' | 'free'>('free');
  const acc = useRef(1);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.5) return;
    acc.current = 0;
    const t = truckAt(s, bay, now(), fleet.current);
    const st = t?.phase === 'docked' ? 'docked' : t?.phase === 'docking' ? 'docking' : 'free';
    if (st !== state) setState(st);
  });
  const tint = layers.dockStatus ? DOCK_TONE[state] : null;
  return (
    <group position={[bay.x, 0, TRUCK_CENTER_Z + 0.4]}>
      <mesh
        position={[0, 0.07, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect({ kind: 'dock', id: `${s.id}:${bayIndex}` });
        }}
      >
        <planeGeometry args={[4.2, 11]} />
        <meshBasicMaterial color={isSel ? BRAND : tint || BRAND} transparent opacity={isSel ? 0.2 : tint ? 0.16 : 0} depthWrite={false} />
      </mesh>
      {(isSel || tint) && <BayOutline w={4.3} d={11.2} color={isSel ? BRAND : tint!} t={isSel ? 0.2 : 0.16} />}
      <mesh position={[0, 0.08, 6.6]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.4, 0.9]} />
        <meshBasicMaterial map={plateTex(bay.id.replace('Bay ', 'B'), '#F5B700', '#0F172A', 128, 48)} transparent />
      </mesh>
    </group>
  );
};

const ChargerNode: React.FC<{ s: SiteDef; index: number }> = ({ s, index }) => {
  const { now, selected, onSelect } = useYard();
  const c = s.chargers[index];
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState(false);
  const acc = useRef(1);
  const id = `${s.id}:${c.id}`;
  const isSel = sameRef(selected, { kind: 'charger', id });
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 1) return;
    acc.current = 0;
    const b = chargerAt(s, index, now()).busy;
    if (b !== busy) setBusy(b);
  });
  return (
    <group position={[c.x, 0, c.z]} rotation={[0, Math.PI / 2, 0]} {...pickable(() => onSelect({ kind: 'charger', id }), setHover)}>
      <ChargerModel busy={busy} />
      {isSel && <SelectionBrackets size={[1.6, 2, 1.4]} glow={false} />}
      {(hover || isSel) && <Chip position={[0, 2.6, 0]} title={c.id} subtitle={busy ? 'Charging' : 'Free'} dot={busy ? '#F59E0B' : '#22C55E'} selected={isSel} small priority={90} />}
    </group>
  );
};

const StagedPallets: React.FC<{ s: SiteDef }> = ({ s }) => {
  const { now, fleet, selected, onSelect, layers, alertKeys } = useYard();
  const [count, setCount] = useState(0);
  const acc = useRef(1);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 1) return;
    acc.current = 0;
    const n = siteSnapshot(s, now(), fleet.current).staged;
    if (n !== count) setCount(n);
  });
  const alert = layers.halos ? alertKeys.get(`staging:${s.id}`) : undefined;
  const cx = s.slots.reduce((a, sl) => a + sl.x, 0) / Math.max(1, s.slots.length);
  const cz = s.slots.reduce((a, sl) => a + sl.z, 0) / Math.max(1, s.slots.length);
  return (
    <group>
      {alert && (
        <group position={[cx, 0, cz]}>
          <Halo severity={alert} radius={10} />
        </group>
      )}
      {s.slots.slice(0, count).map((sl, i) => {
        const id = `${s.id}:${sl.id}`;
        const isSel = sameRef(selected, { kind: 'pallet', id });
        return (
          <group
            key={sl.id}
            position={[sl.x, 0, sl.z]}
            onClick={(e) => {
              e.stopPropagation();
              onSelect({ kind: 'pallet', id });
            }}
          >
            <PalletModel variant={(i * 7) % 3 === 0 ? 'blue' : 'box'} />
            {(i === 1 || i === count - 2 || isSel) && <Pin position={[0, 0, 0]} height={2.1} scale={0.9} />}
            {isSel && <SelectionBrackets size={[1.6, 1.4, 1.6]} glow={false} />}
            {isSel && <Chip position={[0, 3.4, 0]} title={sl.id} subtitle={s.stagedLabel} dot={BRAND} selected small />}
          </group>
        );
      })}
    </group>
  );
};

/** Parked third-party trailers (visitor parking, decorative). */
const ParkedTrailers: React.FC<{ s: SiteDef }> = ({ s }) => (
  <group>
    {(s.truckParking || []).slice(0, 1).map(([x, z], i) => (
      <group key={i} position={[x, 0, z]}>
        <mesh position={[0, 2.45, -0.6]} castShadow>
          <boxGeometry args={[2.6, 3.2, 7.6]} />
          <meshStandardMaterial color="#F8FAFC" roughness={0.6} />
        </mesh>
        <mesh position={[0, 1.15, -0.6]}>
          <boxGeometry args={[2.62, 0.5, 7.62]} />
          <meshStandardMaterial color="#0D9488" />
        </mesh>
        {[-2.6, -1.5].flatMap((zz) =>
          [-1.1, 1.1].map((xx) => (
            <mesh key={`${zz}${xx}`} position={[xx, 0.5, zz]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.5, 0.5, 0.42, 14]} />
              <meshStandardMaterial color="#111827" />
            </mesh>
          ))
        )}
      </group>
    ))}
  </group>
);

// ─── Site compound ────────────────────────────────────────────────────────────

const SiteCompound: React.FC<{ s: SiteDef; status?: CellStatus; bStatus: Record<string, CellStatus>; onEnter: (siteId: string, then?: EntityRef, buildingId?: string) => void }> = ({ s, status, bStatus, onEnter }) => {
  const { selected, onSelect, layers, alertKeys, night } = useYard();
  const detail = useRef<THREE.Group>(null);
  const [near, setNear] = useState(false);
  const [hoverB, setHoverB] = useState<string | null>(null);
  const center = useMemo(() => [s.origin[0], 0, s.origin[2]] as [number, number, number], [s]);
  useCameraDistance(center, (d) => {
    if (detail.current) detail.current.visible = d < DETAIL_DIST;
    const n = d < NEAR_DIST;
    if (n !== near) setNear(n);
  });
  const st = statusOf(status?.worst);
  const siteSel = sameRef(selected, { kind: 'site', id: s.id });
  const siteAlert = layers.halos ? alertKeys.get(`site:${s.id}`) : undefined;

  return (
    <group position={s.origin}>
      <SiteGround s={s} />
      {s.buildings.map((b) => {
        const isSel = sameRef(selected, { kind: 'building', id: b.id });
        const bs = bStatus[b.id]?.total ? bStatus[b.id] : undefined;
        const bAlert = layers.halos ? alertKeys.get(`building:${b.id}`) : undefined;
        return (
          <group key={b.id}>
            <group
              {...pickable(() => onSelect({ kind: 'building', id: b.id }), (v) => setHoverB(v ? b.id : null))}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onEnter(s.id, undefined, b.id);
              }}
            >
              <BuildingModel b={b} code={s.code} roofTint={layers.health && bs ? statusOf(bs.worst).color : undefined} night={night > 0.5} />
            </group>
            {bAlert && (
              <group position={[b.x, 0, -b.depth / 2]}>
                <Halo severity={bAlert} radius={Math.max(b.width, b.depth) * 0.62} />
              </group>
            )}
            {isSel && (
              <group position={[b.x, 0, -b.depth / 2]}>
                <SelectionBrackets size={[b.width + 2, b.height + 4.5, b.depth + 2]} />
              </group>
            )}
            {near && (layers.labels || isSel || hoverB === b.id) && (
              <Chip
                position={[b.x, b.height + 5.5, -b.depth / 2]}
                title={b.label}
                subtitle={bs ? `${bs.running}/${bs.total} equipment up${hoverB === b.id || isSel ? (bs.alerts ? ` · ${bs.alerts} alert${bs.alerts > 1 ? 's' : ''}` : ' · enter ↵') : ''}` : b.doors.map((d) => d.id).join(' · ')}
                dot={bs ? statusOf(bs.worst).color : BRAND}
                selected={isSel}
                priority={hoverB === b.id ? 90 : 30}
              />
            )}
          </group>
        );
      })}
      {!near && (layers.labels || siteSel) && (
        <group
          onClick={(e) => {
            e.stopPropagation();
            onSelect({ kind: 'site', id: s.id });
          }}
        >
          <Chip position={[0, 22, -12]} title={`${s.code} · ${s.name}`} subtitle={status ? `${status.running}/${status.total} equipment up` : undefined} dot={st.color} selected={siteSel} priority={20} />
        </group>
      )}
      {siteAlert && (
        <group position={[s.gateX, 0, FENCE_Z]}>
          <Halo severity={siteAlert} radius={9} />
        </group>
      )}
      <DoorShutters s={s} />
      {/* vehicles stay visible at every zoom level */}
      {s.bays.map((_, i) => (
        <Truck key={i} s={s} bayIndex={i} />
      ))}
      {s.forklifts.map((_, i) => (
        <Forklift key={i} s={s} index={i} />
      ))}
      {s.spareParks.map((_, i) => (
        <SpareForklift key={i} s={s} index={i} />
      ))}
      {layers.heatmap && <Heatmap s={s} />}
      <group ref={detail}>
        {layers.stagingFill && <StagingTint s={s} />}
        <ParkedTrailers s={s} />
        {s.bays.map((_, i) => (
          <DockBay key={i} s={s} bayIndex={i} />
        ))}
        {s.chargers.map((_, i) => (
          <ChargerNode key={i} s={s} index={i} />
        ))}
        <StagedPallets s={s} />
      </group>
    </group>
  );
};

// ─── World (ground, public roads) ─────────────────────────────────────────────

const World: React.FC = () => {
  const { onSelect } = useYard();
  const rows = [0, 1].map((r) => r * 104 - 52 + ROAD_Z);
  const dashes = useMemo(() => {
    const boxes: Box[] = [];
    rows.forEach((z) => {
      for (let x = WORLD_BOUNDS.minX - 40; x < WORLD_BOUNDS.maxX + 40; x += 6) boxes.push({ p: [x, 0.07, z], s: [3, 0.02, 0.25] });
    });
    return mergedBoxes('road-dashes', boxes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow onClick={(e) => { e.stopPropagation(); onSelect(null); }}>
        <planeGeometry args={[1400, 1000]} />
        <meshStandardMaterial color="#E1E8F2" roughness={1} />
      </mesh>
      {rows.map((z) => (
        <group key={z}>
          <mesh position={[0, 0.03, z]} receiveShadow>
            <boxGeometry args={[WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX + 160, 0.04, 12]} />
            <meshStandardMaterial color="#C3CEDD" roughness={0.95} />
          </mesh>
          {[-6.6, 6.6].map((dz) => (
            <mesh key={dz} position={[0, 0.05, z + dz]}>
              <boxGeometry args={[WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX + 160, 0.06, 1.2]} />
              <meshStandardMaterial color="#F1F5F9" roughness={1} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh geometry={dashes} material={basic('#ffffff')} />
    </group>
  );
};

/** Background + fog follow the time of day. */
const Atmosphere: React.FC<{ night: number }> = ({ night }) => {
  const bg = useMemo(() => new THREE.Color('#E6ECF5').lerp(new THREE.Color('#0E1729'), night), [night]);
  return (
    <>
      <color attach="background" args={[bg]} />
      <fog attach="fog" args={[bg, 520, 1100]} />
    </>
  );
};

export const YardScene: React.FC<Props> = ({ fleet, now, cellStatus, selected, onSelect, onEnter, cameraRef, layers, alertKeys, night, onUserInteract }) => {
  // refs so per-frame code reads fresh data without re-rendering the scene
  const fleetRef = useRef<FleetState | null>(fleet);
  fleetRef.current = fleet;
  const nowRef = useRef(now);
  nowRef.current = now;
  const ctx = useMemo<Ctx>(
    () => ({ now: () => nowRef.current(), fleet: fleetRef, selected, onSelect, layers, alertKeys, night }),
    [selected, onSelect, layers, alertKeys, night]
  );

  return (
    <Canvas shadows dpr={[1, 1.5]} camera={{ position: NETWORK_HOME.position, fov: 30, near: 1, far: 2400 }} onPointerMissed={() => onSelect(null)}>
      <Atmosphere night={night} />
      <SceneLights extent={90} follow night={night} />
      <CameraRig ref={cameraRef} home={NETWORK_HOME} minDistance={16} maxDistance={560} bounds={WORLD_BOUNDS} onUserInteract={onUserInteract} />
      <YardCtx.Provider value={ctx}>
        <World />
        {SITE_DEFS.map((s) => (
          <SiteCompound key={s.id} s={s} status={cellStatus[s.id]} bStatus={cellStatus} onEnter={onEnter} />
        ))}
      </YardCtx.Provider>
    </Canvas>
  );
};

export default YardScene;
