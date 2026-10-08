import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, ThreeEvent, useFrame } from '@react-three/fiber';
import { CameraApi, CameraRig, Chip, EntityRef, pickable, sameRef, SceneLights, SelectionBrackets } from '../sceneKit';
import { equipAt, EquipItem, KIND } from './equipment';
import { EquipmentModel, STATUS_LIGHT } from './equipModels';
import { DOOR_H, DOOR_W, ForkliftModel, mat, mergedBoxes, PalletModel, plateTex, rollerMat, std, basic, boxGeo, BRAND } from './models';
import { AISLE_W, allLocs, BAY_LEN, LEVEL_H, locId, locInfo, locPos, parseLoc, RACK_DEPTH, reachAt, Warehouse, whStats } from './warehouse';

interface Props {
  wh: Warehouse;
  now: () => number;
  selected: EntityRef | null;
  onSelect: (e: EntityRef | null) => void;
  cameraRef: React.Ref<CameraApi>;
  night: number;
  labels: boolean;
}

type Box = { p: [number, number, number]; s: [number, number, number] };

const ZONE_COLOR: Record<string, string> = { receiving: '#DBEAFE', shipping: '#DCFCE7', storage: '#F8FAFC', equipment: '#EDE9FE', charging: '#FEF3C7' };
const ZONE_EDGE: Record<string, string> = { receiving: '#3B82F6', shipping: '#16A34A', storage: '#F5B700', equipment: '#7C3AED', charging: '#F59E0B' };

// ─── Shell: floor, low cut-away walls, doors ──────────────────────────────────

const Shell: React.FC<{ wh: Warehouse; onMiss: () => void }> = ({ wh, onMiss }) => {
  const { width: w, depth: d } = wh;
  const wallH = 2.4;
  const walls = useMemo(() => {
    const boxes: Box[] = [];
    boxes.push({ p: [0, wallH / 2, -d], s: [w, wallH, 0.3] });
    boxes.push({ p: [-w / 2, wallH / 2, -d / 2], s: [0.3, wallH, d] });
    boxes.push({ p: [w / 2, wallH / 2, -d / 2], s: [0.3, wallH, d] });
    // front wall between door openings
    const ds = [...wh.doors].sort((a, b) => a.x - b.x);
    let x0 = -w / 2;
    for (const dr of ds) {
      const a = dr.x - DOOR_W / 2;
      if (a - x0 > 0.1) boxes.push({ p: [(x0 + a) / 2, wallH / 2, 0], s: [a - x0, wallH, 0.3] });
      x0 = dr.x + DOOR_W / 2;
    }
    if (w / 2 - x0 > 0.1) boxes.push({ p: [(x0 + w / 2) / 2, wallH / 2, 0], s: [w / 2 - x0, wallH, 0.3] });
    return mergedBoxes(`wh-walls-${wh.key}`, boxes);
  }, [wh, w, d]);
  // corner columns standing to roof height (suggest the building without hiding the floor)
  const columns = useMemo(() => {
    const boxes: Box[] = [];
    for (let x = -w / 2; x <= w / 2 + 0.01; x += w / Math.max(1, Math.round(w / 12))) {
      boxes.push({ p: [x, wh.height / 2, -d], s: [0.4, wh.height, 0.4] });
    }
    for (const x of [-w / 2, w / 2]) for (let z = 0; z >= -d; z -= d / 2) boxes.push({ p: [x, wh.height / 2, z], s: [0.4, wh.height, 0.4] });
    return mergedBoxes(`wh-cols-${wh.key}`, boxes);
  }, [wh, w, d]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, -d / 2]} receiveShadow onClick={(e) => { e.stopPropagation(); onMiss(); }}>
        <planeGeometry args={[w + 60, d + 60]} />
        <meshStandardMaterial color="#DDE4EE" roughness={1} />
      </mesh>
      <mesh position={[0, 0.01, -d / 2]} receiveShadow onClick={(e) => { e.stopPropagation(); onMiss(); }}>
        <boxGeometry args={[w, 0.02, d]} />
        <meshStandardMaterial color="#EEF1F5" roughness={0.9} />
      </mesh>
      <mesh geometry={walls} material={mat('wh-wall', () => new THREE.MeshStandardMaterial({ color: '#E2E8F0', roughness: 0.9 }))} castShadow receiveShadow />
      <mesh geometry={columns} material={std('#94A3B8', 0.6)} castShadow />
      {/* outside apron + doors */}
      {wh.doors.map((dr) => (
        <group key={dr.id} position={[dr.x, 0, 0]}>
          <mesh geometry={boxGeo(0.3, 2.9, 0.4)} material={std(BRAND, 0.5)} position={[-DOOR_W / 2 - 0.15, 1.45, 0]} />
          <mesh geometry={boxGeo(0.3, 2.9, 0.4)} material={std(BRAND, 0.5)} position={[DOOR_W / 2 + 0.15, 1.45, 0]} />
          <mesh position={[0, 3.6, 0.05]}>
            <planeGeometry args={[1.6, 0.6]} />
            <meshBasicMaterial map={plateTex(dr.id, dr.kind === 'in' ? '#2563EB' : '#16A34A')} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, DOOR_H + 0.4, 0.4]} rotation={[Math.PI / 2, 0, 0]} material={rollerMat()} scale={[1, 0.2, 1]}>
            <planeGeometry args={[DOOR_W, 1]} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

// ─── Zones + floor markings ───────────────────────────────────────────────────

const Zones: React.FC<{ wh: Warehouse; labels: boolean }> = ({ wh, labels }) => {
  const { selected, onSelect } = useWh();
  const markings = useMemo(() => {
    const yellow: Box[] = [];
    const dash: Box[] = [];
    for (const z of wh.zones) {
      if (z.kind === 'storage') continue;
      const w = z.x1 - z.x0;
      const d = z.z0 - z.z1;
      const cx = (z.x0 + z.x1) / 2;
      const cz = (z.z0 + z.z1) / 2;
      const t = 0.12;
      yellow.push({ p: [cx, 0.035, z.z0], s: [w, 0.01, t] }, { p: [cx, 0.035, z.z1], s: [w, 0.01, t] }, { p: [z.x0, 0.035, cz], s: [t, 0.01, d] }, { p: [z.x1, 0.035, cz], s: [t, 0.01, d] });
    }
    // aisle edge lines
    for (const a of wh.aisles) for (const sx of [-1, 1]) yellow.push({ p: [a.x + (sx * AISLE_W) / 2, 0.035, (a.z0 + a.z1) / 2], s: [0.1, 0.01, a.z0 - a.z1] });
    // forklift cross lanes
    for (const f of wh.forklifts) for (let x = -wh.width / 2 + 2; x < wh.width / 2 - 2; x += 2.2) dash.push({ p: [x, 0.035, f.laneZ], s: [1.1, 0.01, 0.1] });
    return { yellow: mergedBoxes(`wh-yel-${wh.key}`, yellow), dash: mergedBoxes(`wh-dash-${wh.key}`, dash) };
  }, [wh]);
  return (
    <group>
      {wh.zones.map((z) => {
        const sel = sameRef(selected, { kind: 'zone', id: z.id });
        return (
          <group key={z.id}>
            <mesh
              position={[(z.x0 + z.x1) / 2, 0.025, (z.z0 + z.z1) / 2]}
              rotation={[-Math.PI / 2, 0, 0]}
              onClick={(e) => {
                e.stopPropagation();
                onSelect({ kind: 'zone', id: z.id });
              }}
            >
              <planeGeometry args={[z.x1 - z.x0, z.z0 - z.z1]} />
              <meshStandardMaterial color={ZONE_COLOR[z.kind]} roughness={1} transparent opacity={sel ? 1 : 0.85} />
            </mesh>
            {(labels || sel) && (
              <Chip position={[(z.x0 + z.x1) / 2, z.kind === 'storage' ? wh.height - 1 : 3.2, z.kind === 'storage' ? z.z1 + 1 : (z.z0 + z.z1) / 2]} title={z.label} dot={ZONE_EDGE[z.kind]} selected={sel} small priority={25} />
            )}
          </group>
        );
      })}
      <mesh geometry={markings.yellow} material={basic('#F5B700')} />
      <mesh geometry={markings.dash} material={basic('#F59E0B')} />
      {/* aisle letters on the floor at each aisle mouth */}
      {wh.aisles.map((a) => (
        <mesh
          key={a.id}
          position={[a.x, 0.04, a.z0 - 0.9]}
          rotation={[-Math.PI / 2, 0, 0]}
          onClick={(e) => {
            e.stopPropagation();
            onSelect({ kind: 'aisle', id: a.id });
          }}
        >
          <planeGeometry args={[1.6, 1.1]} />
          <meshBasicMaterial map={plateTex(a.id, sameRef(selected, { kind: 'aisle', id: a.id }) ? BRAND : '#0F172A', '#ffffff', 128, 96)} />
        </mesh>
      ))}
    </group>
  );
};

// ─── Racking (static, merged) + stored pallets (instanced, live) ──────────────

const Racks: React.FC<{ wh: Warehouse }> = ({ wh }) => {
  const { uprights, beams } = useMemo(() => {
    const up: Box[] = [];
    const bm: Box[] = [];
    for (const a of wh.aisles) {
      const levels = a.levels;
      const topH = levels * LEVEL_H + 0.3;
      for (const sx of [-1, 1]) {
        const xc = a.x + sx * (AISLE_W / 2 + RACK_DEPTH / 2);
        for (let b = 0; b <= a.bays; b++) {
          const z = a.z0 - b * BAY_LEN;
          for (const dx of [-RACK_DEPTH / 2, RACK_DEPTH / 2]) up.push({ p: [xc + dx, topH / 2, z], s: [0.09, topH, 0.09] });
        }
        for (let lv = 1; lv <= levels; lv++) {
          const y = (lv - 1) * LEVEL_H + 0.12;
          if (lv === 1) continue; // ground level sits on the floor
          for (const dx of [-RACK_DEPTH / 2, RACK_DEPTH / 2]) bm.push({ p: [xc + dx, y, (a.z0 + a.z1) / 2], s: [0.07, 0.12, a.z0 - a.z1] });
        }
        for (const dx of [-RACK_DEPTH / 2, RACK_DEPTH / 2]) bm.push({ p: [xc + dx, topH, (a.z0 + a.z1) / 2], s: [0.07, 0.12, a.z0 - a.z1] });
      }
    }
    return { uprights: mergedBoxes(`wh-up-${wh.key}`, up), beams: mergedBoxes(`wh-bm-${wh.key}`, bm) };
  }, [wh]);
  return (
    <group>
      <mesh geometry={uprights} material={std('#1D4ED8', 0.5, 0.2)} castShadow />
      <mesh geometry={beams} material={std('#F97316', 0.5, 0.1)} castShadow />
    </group>
  );
};

const cartonMat = () =>
  mat('wh-carton', () => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(28, 0, 8, 64);
    g.strokeStyle = 'rgba(0,0,0,0.18)';
    g.lineWidth = 3;
    g.strokeRect(2, 2, 60, 60);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 });
  });

const StoredPallets: React.FC<{ wh: Warehouse }> = ({ wh }) => {
  const { now, selected, onSelect } = useWh();
  const locs = useMemo(() => allLocs(wh), [wh]);
  const boxes = useRef<THREE.InstancedMesh>(null);
  const skids = useRef<THREE.InstancedMesh>(null);
  const shown = useRef<number[]>([]);
  const [hover, setHover] = useState<number | null>(null);
  const acc = useRef(10);
  const tint = useMemo(() => ['#E2B47E', '#D9A066', '#C8955E', '#93C5FD', '#E9C79A'].map((c) => new THREE.Color(c)), []);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 2) return; // occupancy changes slowly; refresh every 2 s
    acc.current = 0;
    const t = now();
    const o = new THREE.Object3D();
    const ids: number[] = [];
    locs.forEach((l, i) => {
      const info = locInfo(wh, l, t);
      if (!info.occupied) return;
      const [x, y, z] = locPos(wh, l);
      const k = ids.length;
      o.position.set(x, y + 0.7, z);
      o.scale.set(1, 0.75 + ((info.qty % 5) / 5) * 0.25, 1);
      o.updateMatrix();
      boxes.current?.setMatrixAt(k, o.matrix);
      boxes.current?.setColorAt(k, tint[info.qty % tint.length]);
      o.position.set(x, y + 0.08, z);
      o.scale.set(1, 1, 1);
      o.updateMatrix();
      skids.current?.setMatrixAt(k, o.matrix);
      ids.push(i);
    });
    shown.current = ids;
    for (const m of [boxes.current, skids.current]) {
      if (!m) continue;
      m.count = ids.length;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
    }
  });
  const pick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const i = e.instanceId !== undefined ? shown.current[e.instanceId] : undefined;
    if (i !== undefined) onSelect({ kind: 'location', id: locId(wh, locs[i]) });
  };
  const hoverLoc = hover !== null ? locs[hover] : null;
  const selLoc = selected?.kind === 'location' ? parseLoc(wh, selected.id) : null;
  return (
    <group>
      <instancedMesh
        ref={boxes}
        args={[boxGeo(1.05, 1.1, 1.05), cartonMat(), locs.length]}
        castShadow
        onClick={pick}
        onPointerMove={(e) => {
          e.stopPropagation();
          const i = e.instanceId !== undefined ? shown.current[e.instanceId] : null;
          if (i !== hover) setHover(i ?? null);
          (e.nativeEvent.target as HTMLElement).style.cursor = 'pointer';
        }}
        onPointerOut={(e) => {
          setHover(null);
          (e.nativeEvent.target as HTMLElement).style.cursor = '';
        }}
      />
      <instancedMesh ref={skids} args={[boxGeo(1.15, 0.14, 1.15), std('#A86E3A', 0.9), locs.length]} />
      {hoverLoc && !sameRef(selected, { kind: 'location', id: locId(wh, hoverLoc) }) && (
        <Chip position={[locPos(wh, hoverLoc)[0], locPos(wh, hoverLoc)[1] + 1.9, locPos(wh, hoverLoc)[2]]} title={locId(wh, hoverLoc)} subtitle={locInfo(wh, hoverLoc, now()).sku} dot="#F59E0B" small priority={90} />
      )}
      {selLoc && (
        <group position={locPos(wh, selLoc)}>
          <group position={[0, 0, 0]}>
            <SelectionBrackets size={[1.4, 1.5, 1.4]} glow={false} />
          </group>
          <Chip position={[0, 2.1, 0]} title={selected!.id} subtitle={locInfo(wh, selLoc, now()).occupied ? locInfo(wh, selLoc, now()).sku : 'Empty'} dot={BRAND} selected small />
        </group>
      )}
    </group>
  );
};

/** Pallets waiting in the receiving / shipping zones. */
const DockPallets: React.FC<{ wh: Warehouse }> = ({ wh }) => {
  const { now } = useWh();
  const [q, setQ] = useState({ r: 0, s: 0 });
  const acc = useRef(10);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 3) return;
    acc.current = 0;
    const st = whStats(wh, now());
    if (st.receivingQueue !== q.r || st.shippingQueue !== q.s) setQ({ r: st.receivingQueue, s: st.shippingQueue });
  });
  const place = (kind: 'receiving' | 'shipping', n: number) => {
    const z = wh.zones.find((x) => x.kind === kind);
    if (!z) return null;
    const cols = Math.max(1, Math.floor((z.x1 - z.x0 - 2) / 1.7));
    return Array.from({ length: n }, (_, i) => (
      <PalletModel key={`${kind}${i}`} position={[z.x0 + 1.4 + (i % cols) * 1.7, 0.03, z.z1 + 1.2 + Math.floor(i / cols) * 1.6]} variant={kind === 'shipping' ? 'blue' : 'box'} />
    ));
  };
  return (
    <group>
      {place('receiving', q.r)}
      {place('shipping', q.s)}
    </group>
  );
};

// ─── Reach trucks ─────────────────────────────────────────────────────────────

const ReachTruck: React.FC<{ wh: Warehouse; index: number }> = ({ wh, index }) => {
  const { now, selected, onSelect } = useWh();
  const f = wh.forklifts[index];
  const ref = useRef<THREE.Group>(null);
  const forks = useRef<THREE.Group>(null);
  const [carrying, setCarrying] = useState(false);
  const [label, setLabel] = useState('');
  const [hover, setHover] = useState(false);
  const isSel = sameRef(selected, { kind: 'reach', id: f.id });
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const s = reachAt(wh, f, now());
    g.position.set(s.x, 0, s.z);
    g.rotation.y = s.heading;
    if (forks.current) forks.current.position.y = s.lift * ((s.liftLevel - 1) * LEVEL_H + 0.2);
    if (s.carrying !== carrying) setCarrying(s.carrying);
    if ((hover || isSel) && s.detail !== label) setLabel(s.detail);
  });
  return (
    <group ref={ref} {...pickable(() => onSelect({ kind: 'reach', id: f.id }), setHover)}>
      <ForkliftModel carrying={carrying} variant={index % 2 ? 'blue' : 'box'} forksRef={forks} />
      {isSel && <SelectionBrackets size={[2.1, 2.9, 3.6]} />}
      {(hover || isSel) && <Chip position={[0, 3.6, 0]} title={f.id} subtitle={label} dot="#FACC15" selected={isSel} small priority={95} />}
    </group>
  );
};

// ─── Warehouse equipment (role-specific) ──────────────────────────────────────

const EquipmentNode: React.FC<{ item: EquipItem; index: number }> = ({ item, index }) => {
  const { now, selected, onSelect, labels } = useWh();
  const [snap, setSnap] = useState(() => equipAt(item, now()));
  const [hover, setHover] = useState(false);
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 2) return;
    acc.current = 0;
    const s2 = equipAt(item, now());
    if (s2.status !== snap.status || s2.reading !== snap.reading || Math.abs(s2.fill - snap.fill) > 0.05) setSnap(s2);
  });
  const spec = KIND[item.kind];
  const sel = sameRef(selected, { kind: 'equipment', id: item.id });
  const dot = spec.powered ? STATUS_LIGHT[snap.status] : '#94A3B8';
  const showChip = sel || hover || (labels && spec.powered && (snap.status === 'FAULT' || snap.status === 'WARNING'));
  return (
    <group position={[item.x, 0, item.z]} rotation={[0, item.rot, 0]}>
      <group {...pickable(() => onSelect({ kind: 'equipment', id: item.id }), setHover)}>
        <EquipmentModel kind={item.kind} status={snap.status} fill={snap.fill} index={index} />
      </group>
      {sel && <SelectionBrackets size={[spec.w + 0.6, item.kind === 'vehicleLift' ? 4 : 2.6, spec.d + 0.6]} />}
      {showChip && <Chip position={[0, item.kind === 'vehicleLift' ? 4.8 : 3.2, 0]} title={item.label} subtitle={hover || sel ? (spec.powered ? `${snap.statusLabel} · ${snap.reading}` : snap.reading) : snap.statusLabel} dot={dot} selected={sel} small priority={sel || hover ? 95 : 45} />}
    </group>
  );
};

const Equipment: React.FC<{ wh: Warehouse }> = ({ wh }) => (
  <group>
    {wh.equipment.map((e, i) => (
      <EquipmentNode key={e.id} item={e} index={i} />
    ))}
  </group>
);

// ─── Scene root ───────────────────────────────────────────────────────────────

interface Ctx {
  now: () => number;
  selected: EntityRef | null;
  onSelect: (e: EntityRef | null) => void;
  labels: boolean;
}
const WhCtx: React.Context<Ctx> = ((globalThis as any).__plantopsWhCtx ??= React.createContext<Ctx>(null as any));
const useWh = () => React.useContext(WhCtx);

const Atmosphere: React.FC<{ night: number }> = ({ night }) => {
  const bg = useMemo(() => new THREE.Color('#E6ECF5').lerp(new THREE.Color('#0E1729'), night), [night]);
  return <color attach="background" args={[bg]} />;
};

export const WarehouseScene: React.FC<Props> = ({ wh, now, selected, onSelect, cameraRef, night, labels }) => {
  const nowRef = useRef(now);
  nowRef.current = now;
  const ctx = useMemo<Ctx>(() => ({ now: () => nowRef.current(), selected, onSelect, labels }), [selected, onSelect, labels]);
  const dist = Math.max(48, wh.width * 1.05);
  const home = useMemo(() => ({ position: [wh.width * 0.18, dist * 0.78, dist * 0.62] as [number, number, number], target: [0, 0, -wh.depth / 2] as [number, number, number] }), [wh, dist]);
  useEffect(() => () => void (document.body.style.cursor = ''), []);
  return (
    <Canvas shadows dpr={[1, 1.5]} camera={{ position: home.position, fov: 32, near: 0.5, far: 800 }} onPointerMissed={() => onSelect(null)}>
      <Atmosphere night={night} />
      <SceneLights extent={Math.max(40, wh.width * 0.7)} night={night} />
      <CameraRig ref={cameraRef} home={home} minDistance={8} maxDistance={dist * 2.2} bounds={{ minX: -wh.width / 2 - 10, maxX: wh.width / 2 + 10, minZ: -wh.depth - 10, maxZ: 12 }} />
      <WhCtx.Provider value={ctx}>
        <Shell wh={wh} onMiss={() => onSelect(null)} />
        <Zones wh={wh} labels={labels} />
        <Racks wh={wh} />
        <StoredPallets wh={wh} />
        {wh.role !== 'service' && <DockPallets wh={wh} />}
        {wh.forklifts.map((_, i) => (
          <ReachTruck key={i} wh={wh} index={i} />
        ))}
        <Equipment wh={wh} />
      </WhCtx.Provider>
    </Canvas>
  );
};

export default WarehouseScene;
