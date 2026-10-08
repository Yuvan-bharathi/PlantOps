import React, { useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Building } from './layout';
import { Carrier } from './sim';

export const BRAND = '#2563EB';
const RIB = 0.85; // cladding rib spacing (m)

// ─── Texture + material caches ────────────────────────────────────────────────

const texCache = new Map<string, THREE.Texture>();
function canvasTex(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = false) {
  const hit = texCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  texCache.set(key, t);
  return t;
}

const ribTex = (base: string, line: string, vertical = true) =>
  canvasTex(`rib-${base}-${line}-${vertical}`, 32, 32, (g) => {
    g.fillStyle = base;
    g.fillRect(0, 0, 32, 32);
    g.fillStyle = line;
    if (vertical) g.fillRect(0, 0, 4, 32);
    else g.fillRect(0, 0, 32, 4);
    g.fillStyle = 'rgba(255,255,255,0.28)';
    if (vertical) g.fillRect(5, 0, 2, 32);
    else g.fillRect(0, 5, 32, 2);
  }, true);

const matCache = new Map<string, THREE.Material>();
export function mat(key: string, make: () => THREE.Material) {
  let m = matCache.get(key);
  if (!m) {
    m = make();
    matCache.set(key, m);
  }
  return m;
}
export const std = (color: string, roughness = 0.7, metalness = 0) => mat(`std-${color}-${roughness}-${metalness}`, () => new THREE.MeshStandardMaterial({ color, roughness, metalness }));
export const basic = (color: string) => mat(`basic-${color}`, () => new THREE.MeshBasicMaterial({ color }));

const WALL = { light: { base: '#EEF2F8', line: '#D5DEEA' }, blue: { base: '#3B82F6', line: '#2D6FE0' } };
const wallMat = (kind: 'light' | 'blue') => mat(`wall-${kind}`, () => new THREE.MeshStandardMaterial({ map: ribTex(WALL[kind].base, WALL[kind].line), roughness: 0.8 }));
const roofSideMat = (vertical: boolean, tint?: string) => {
  const key = `roof-${vertical}-${tint || 'none'}`;
  return mat(key, () => {
    const t = ribTex('#2F6FED', '#2459CC', vertical).clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(vertical ? 1 / RIB : 0.05, vertical ? 0.05 : 1 / RIB);
    t.needsUpdate = true;
    if (!tint) return new THREE.MeshStandardMaterial({ map: t, roughness: 0.55 });
    // health tint: blend the blue roof towards the status colour and let it glow softly
    const c = new THREE.Color(tint);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, color: new THREE.Color('#ffffff').lerp(c, 0.65), emissive: c, emissiveIntensity: 0.22 });
  });
};

// ─── Geometry caches ──────────────────────────────────────────────────────────

const geoCache = new Map<string, THREE.BufferGeometry>();
export function geo<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = geoCache.get(key) as T | undefined;
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g;
}
export const boxGeo = (w: number, h: number, d: number) => geo(`box-${w}-${h}-${d}`, () => new THREE.BoxGeometry(w, h, d));

/** Box whose UVs are in metres so the rib texture keeps its spacing on any size. */
function ribBox(w: number, h: number, d: number) {
  return geo(`ribbox-${w.toFixed(2)}-${h.toFixed(2)}-${d.toFixed(2)}`, () => {
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) {
      const face = Math.floor(i / 4); // px nx py ny pz nz
      const span = face < 2 ? d : w;
      uv.setX(i, (uv.getX(i) * span) / RIB);
    }
    uv.needsUpdate = true;
    return g;
  });
}

/** Merge many boxes (position, size, rotationY) into one geometry → a single draw call. */
export function mergedBoxes(key: string, boxes: { p: [number, number, number]; s: [number, number, number]; r?: number }[]) {
  return geo(key, () => {
    if (!boxes.length) return new THREE.BufferGeometry();
    const parts = boxes.map(({ p, s, r }) => {
      const g = new THREE.BoxGeometry(s[0], s[1], s[2]);
      if (r) g.rotateY(r);
      g.translate(p[0], p[1], p[2]);
      return g;
    });
    const merged = mergeGeometries(parts, false)!;
    parts.forEach((g) => g.dispose());
    return merged;
  });
}

// ─── Text plates ──────────────────────────────────────────────────────────────

export const plateTex = (text: string, bg = BRAND, fg = '#ffffff', w = 256, h = 96) =>
  canvasTex(`plate-${text}-${bg}-${fg}-${w}`, w, h, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = fg;
    g.font = `bold ${Math.round(h * 0.55)}px Inter, Arial, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 3);
  });

const badgeTex = (text: string) =>
  canvasTex(`badge-${text}`, 256, 256, (g) => {
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(128, 128, 126, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = BRAND;
    g.beginPath();
    g.arc(128, 128, 100, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffffff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let size = 92;
    do {
      g.font = `bold ${size}px Inter, Arial, sans-serif`;
      size -= 4;
    } while (g.measureText(text).width > 160 && size > 28);
    g.fillText(text, 128, 134);
  });

// ─── Buildings ────────────────────────────────────────────────────────────────

/** Roller-shutter material (horizontal slats). */
export const rollerMat = () =>
  mat('roller-shutter', () => {
    const t = canvasTex('roller-slats', 64, 128, (g) => {
      g.fillStyle = '#E2E8F0';
      g.fillRect(0, 0, 64, 128);
      g.fillStyle = '#B8C4D4';
      for (let y = 5; y < 128; y += 9) g.fillRect(0, y, 64, 2);
    });
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, side: THREE.DoubleSide });
  });

export const DOOR_W = 3.8;
export const DOOR_H = 4.4;

/** Warehouse with real door openings (forklifts drive through them), interior, trims and roof. */
export const BuildingModel: React.FC<{ b: Building; code: string; roofTint?: string; night?: boolean }> = ({ b, code, roofTint, night }) => {
  const { width: w, depth: d, height: h } = b;
  const wm = wallMat(b.walls);
  const doorsLocal = useMemo(() => b.doors.map((dr) => ({ ...dr, lx: dr.x - b.x })).sort((a, c) => a.lx - c.lx), [b]);

  // Front wall split around the openings
  const front = useMemo(() => {
    const segs: { x: number; w: number }[] = [];
    let x0 = -w / 2;
    for (const dr of doorsLocal) {
      const a = dr.lx - DOOR_W / 2;
      if (a - x0 > 0.05) segs.push({ x: (x0 + a) / 2, w: a - x0 });
      x0 = dr.lx + DOOR_W / 2;
    }
    if (w / 2 - x0 > 0.05) segs.push({ x: (x0 + w / 2) / 2, w: w / 2 - x0 });
    return segs;
  }, [doorsLocal, w]);

  const roof = useMemo(() => {
    if (b.roof === 'gable') {
      const rise = Math.min(3.4, d * 0.2);
      const s = new THREE.Shape();
      s.moveTo(-(d / 2 + 0.7), 0);
      s.lineTo(d / 2 + 0.7, 0);
      s.lineTo(0, rise);
      s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: w + 1, bevelEnabled: false });
      g.translate(0, 0, -(w + 1) / 2);
      return { g, rise, rot: Math.PI / 2, pos: [0, h, -d / 2] as [number, number, number], vertical: false };
    }
    const teeth = Math.max(3, Math.round(w / 9));
    const tw = w / teeth;
    const rise = 2.6;
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    for (let i = 1; i <= teeth; i++) {
      const x = -w / 2 + i * tw;
      s.lineTo(x, rise);
      s.lineTo(x, i === teeth ? 0 : 0.35);
    }
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: d + 0.6, bevelEnabled: false });
    g.translate(0, 0, -(d + 0.6));
    return { g, rise, rot: 0, pos: [0, h, 0.3] as [number, number, number], vertical: true };
  }, [b.roof, w, d, h]);

  const slope = b.roof === 'gable' ? Math.atan2(roof.rise, d / 2 + 0.7) : 0;
  const trim = std(b.walls === 'blue' ? '#1D4ED8' : BRAND, 0.5);

  return (
    <group position={[b.x, 0, 0]}>
      {/* interior shell (seen through the open doors) */}
      <mesh position={[0, h / 2, -d / 2]}>
        <boxGeometry args={[w - 0.5, h - 0.1, d - 0.5]} />
        <meshStandardMaterial color={night ? '#F5D9A8' : '#8C9AB0'} emissive={night ? '#F2B661' : '#000000'} emissiveIntensity={night ? 0.55 : 0} side={THREE.BackSide} roughness={1} />
      </mesh>
      <mesh position={[0, 0.03, -d / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w - 0.6, d - 0.6]} />
        <meshStandardMaterial color="#AEB9C9" roughness={1} />
      </mesh>
      {/* walls */}
      <mesh geometry={ribBox(w, h, 0.3)} material={wm} position={[0, h / 2, -d + 0.15]} castShadow receiveShadow />
      <mesh geometry={ribBox(0.3, h, d)} material={wm} position={[-w / 2 + 0.15, h / 2, -d / 2]} castShadow receiveShadow />
      <mesh geometry={ribBox(0.3, h, d)} material={wm} position={[w / 2 - 0.15, h / 2, -d / 2]} castShadow receiveShadow />
      {front.map((s, i) => (
        <mesh key={i} geometry={ribBox(s.w, h, 0.3)} material={wm} position={[s.x, h / 2, -0.15]} castShadow receiveShadow />
      ))}
      {doorsLocal.map((dr) => (
        <mesh key={`l-${dr.id}`} geometry={ribBox(DOOR_W, h - DOOR_H, 0.3)} material={wm} position={[dr.lx, DOOR_H + (h - DOOR_H) / 2, -0.15]} castShadow />
      ))}
      {/* trims: corner posts, plinth, fascia */}
      {[-w / 2, w / 2].map((x) => (
        <mesh key={x} geometry={boxGeo(0.45, h + 0.05, 0.45)} material={trim} position={[x, h / 2, 0]} castShadow />
      ))}
      <mesh geometry={boxGeo(w + 0.2, 0.35, 0.4)} material={trim} position={[0, h - 0.15, 0.02]} />
      {/* doors: blue frames, rolled-up shutters, number plates, pallets just inside */}
      {doorsLocal.map((dr) => (
        <group key={dr.id} position={[dr.lx, 0, 0]}>
          <mesh geometry={boxGeo(0.32, DOOR_H + 0.3, 0.42)} material={trim} position={[-DOOR_W / 2 - 0.12, (DOOR_H + 0.3) / 2, 0.04]} />
          <mesh geometry={boxGeo(0.32, DOOR_H + 0.3, 0.42)} material={trim} position={[DOOR_W / 2 + 0.12, (DOOR_H + 0.3) / 2, 0.04]} />
          <mesh geometry={boxGeo(DOOR_W + 0.56, 0.32, 0.42)} material={trim} position={[0, DOOR_H + 0.15, 0.04]} />
          <mesh geometry={boxGeo(DOOR_W, 0.5, 0.5)} material={std('#CBD5E1', 0.6)} position={[0, DOOR_H - 0.2, -0.35]} />
          <mesh position={[0, DOOR_H + 0.75, 0.26]}>
            <planeGeometry args={[1.3, 0.5]} />
            <meshBasicMaterial map={plateTex(dr.id)} />
          </mesh>
          <PalletModel position={[-0.9, 0, -2.2]} />
          <PalletModel position={[0.9, 0, -5.6]} variant={dr.kind === 'in' ? 'blue' : 'box'} />
          {/* door threshold */}
          <mesh geometry={boxGeo(DOOR_W, 0.04, 1.2)} material={std('#94A3B8', 0.9)} position={[0, 0.02, 0.4]} />
        </group>
      ))}
      {/* building name plate */}
      <mesh position={[w / 2 - Math.min(9, w * 0.22), h - 1.3, 0.04]}>
        <planeGeometry args={[Math.min(12, w * 0.32), 1.1]} />
        <meshBasicMaterial map={plateTex(b.label.toUpperCase(), '#0F172A', '#ffffff', 512, 64)} />
      </mesh>
      {/* roof */}
      <mesh geometry={roof.g} position={roof.pos} rotation={[0, roof.rot, 0]} castShadow receiveShadow material={[wm, roofSideMat(roof.vertical, roofTint)]} />
      {b.roof === 'gable' && (
        <mesh position={[-w * 0.18, h + roof.rise / 2 + 0.12, -d / 2 + (d / 2 + 0.7) / 2]} rotation={[-(Math.PI / 2 - slope), 0, 0]}>
          <circleGeometry args={[Math.min(2.8, d * 0.14), 40]} />
          <meshBasicMaterial map={badgeTex(code)} transparent />
        </mesh>
      )}
      {/* rooftop units */}
      {[-w / 3, w / 4].map((x) => (
        <mesh key={x} geometry={boxGeo(1.6, 0.9, 1.3)} material={std('#E2E8F0', 0.6)} position={[x, h + (b.roof === 'gable' ? roof.rise * 0.45 : roof.rise + 0.4), -d * 0.62]} castShadow />
      ))}
    </group>
  );
};

// ─── Pallets ──────────────────────────────────────────────────────────────────

const cartonTex = () =>
  canvasTex('carton', 128, 128, (g) => {
    g.fillStyle = '#E2B47E';
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = '#B98552';
    g.lineWidth = 3;
    g.strokeRect(2, 2, 60, 60);
    g.strokeRect(66, 2, 60, 60);
    g.strokeRect(2, 66, 60, 60);
    g.strokeRect(66, 66, 60, 60);
    g.fillStyle = '#C99A64';
    g.fillRect(28, 0, 8, 128);
    g.fillRect(92, 0, 8, 128);
  });
const wrapTex = () =>
  canvasTex('wrap', 128, 128, (g) => {
    g.fillStyle = '#3B82F6';
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = '#93C5FD';
    g.lineWidth = 3;
    for (let i = 0; i < 4; i++) g.strokeRect(4 + (i % 2) * 62, 4 + Math.floor(i / 2) * 62, 58, 58);
  });

export const PalletModel: React.FC<{ position?: [number, number, number]; variant?: 'box' | 'blue'; rotationY?: number }> = ({ position = [0, 0, 0], variant = 'box', rotationY = 0 }) => (
  <group position={position} rotation={[0, rotationY, 0]}>
    <mesh geometry={boxGeo(1.25, 0.16, 1.25)} material={std('#A86E3A', 0.9)} position={[0, 0.08, 0]} castShadow />
    <mesh
      geometry={boxGeo(1.15, 1.05, 1.15)}
      material={mat(`pallet-${variant}`, () => new THREE.MeshStandardMaterial({ map: variant === 'blue' ? wrapTex() : cartonTex(), roughness: 0.85 }))}
      position={[0, 0.69, 0]}
      castShadow
    />
  </group>
);

// ─── Trucks ───────────────────────────────────────────────────────────────────

const liveryTex = (c: Carrier) =>
  canvasTex(`livery-${c.name}`, 512, 192, (g) => {
    g.fillStyle = '#F8FAFC';
    g.fillRect(0, 0, 512, 192);
    g.fillStyle = c.stripe;
    g.beginPath();
    g.moveTo(0, 192);
    g.lineTo(512, 128);
    g.lineTo(512, 192);
    g.closePath();
    g.fill();
    g.fillStyle = c.stripe;
    g.fillRect(70, 52, 52, 52);
    g.fillStyle = '#ffffff';
    g.font = 'bold 34px Inter, Arial, sans-serif';
    g.fillText(c.name[0], 84, 90);
    g.fillStyle = '#1E293B';
    g.font = 'bold 52px Inter, Arial, sans-serif';
    g.fillText(c.name.split(' ')[0], 140, 96);
    g.fillStyle = '#64748B';
    g.font = '600 24px Inter, Arial, sans-serif';
    g.fillText('Logistics · on time, every time', 142, 130);
  });

/** Box truck, forward = +z (cab at the front), rear doors at z ≈ -4.6. */
const hiddenFace = () => mat('hidden-face', () => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));

export const TruckModel: React.FC<{ carrier: Carrier; open?: boolean; cargo?: number }> = ({ carrier, open = false, cargo = 0 }) => {
  const side = mat(`side-${carrier.name}`, () => new THREE.MeshStandardMaterial({ map: liveryTex(carrier), roughness: 0.55 }));
  const white = std('#F8FAFC', 0.55);
  const pallets = Math.max(0, Math.min(10, cargo));
  const tyre = std('#111827', 0.85);
  return (
    <group>
      <mesh geometry={boxGeo(2.1, 0.35, 9.2)} material={std('#1F2937', 0.7)} position={[0, 0.78, 0]} castShadow />
      <mesh geometry={boxGeo(2.5, 2.45, 2.1)} material={std(carrier.cab, 0.35, 0.1)} position={[0, 2.05, 3.55]} castShadow />
      <mesh geometry={boxGeo(2.52, 0.35, 2.12)} material={std(carrier.stripe, 0.4)} position={[0, 1.05, 3.55]} />
      <mesh position={[0, 2.5, 4.61]}>
        <planeGeometry args={[2.2, 1.05]} />
        <meshStandardMaterial color="#1E293B" roughness={0.15} metalness={0.4} />
      </mesh>
      <mesh position={[0, 1.2, 4.61]}>
        <planeGeometry args={[1.9, 0.35]} />
        <meshStandardMaterial color="#94A3B8" />
      </mesh>
      {/* trailer box: livery on both long sides */}
      <mesh position={[0, 2.55, -1.05]} castShadow receiveShadow geometry={boxGeo(2.6, 3.25, 7)} material={[side, side, white, white, white, open ? hiddenFace() : std('#E2E8F0', 0.6)]} />
      {open && (
        <group>
          {/* trailer interior, visible through the open rear */}
          <mesh position={[0, 2.55, -1.05]} geometry={boxGeo(2.45, 3.1, 6.9)} material={mat('trailer-inside', () => new THREE.MeshStandardMaterial({ color: '#CBD5E1', side: THREE.BackSide, roughness: 1 }))} />
          {/* rear doors swung open against the sides */}
          {[-1, 1].map((sd) => (
            <group key={sd} position={[sd * 1.3, 2.55, -4.56]} rotation={[0, sd * (Math.PI / 2 + 0.25), 0]}>
              <mesh position={[-sd * 0.65, 0, 0]} geometry={boxGeo(1.3, 3.15, 0.06)} material={std('#E2E8F0', 0.6)} castShadow />
            </group>
          ))}
          {Array.from({ length: pallets }, (_, k) => (
            <PalletModel key={k} position={[k % 2 ? 0.6 : -0.6, 0.93, 1.75 - Math.floor(k / 2) * 1.3]} variant={k % 3 === 2 ? 'blue' : 'box'} />
          ))}
        </group>
      )}
      {[3.4, -2.3, -3.7].flatMap((z) =>
        [-1.1, 1.1].map((x) => <mesh key={`${z}-${x}`} geometry={geo('wheel', () => new THREE.CylinderGeometry(0.5, 0.5, 0.42, 16).rotateZ(Math.PI / 2))} material={tyre} position={[x, 0.5, z]} castShadow />)
      )}
    </group>
  );
};

// ─── Forklift ─────────────────────────────────────────────────────────────────

/** Counterbalance forklift with operator, forward = +z (forks at the front). */
export const ForkliftModel: React.FC<{ carrying: boolean; variant?: 'box' | 'blue'; forksRef?: React.Ref<THREE.Group> }> = ({ carrying, variant = 'box', forksRef }) => {
  const black = std('#111827', 0.7);
  return (
    <group>
      <mesh geometry={boxGeo(1.3, 0.8, 1.9)} material={std('#FACC15', 0.45)} position={[0, 0.66, -0.15]} castShadow />
      <mesh geometry={boxGeo(1.24, 0.95, 0.5)} material={std('#334155', 0.7)} position={[0, 0.88, -0.95]} castShadow />
      <mesh geometry={boxGeo(1.32, 0.18, 0.5)} material={std(BRAND, 0.5)} position={[0, 0.34, -0.15]} />
      {[-0.56, 0.56].flatMap((x) => [-0.62, 0.5].map((z) => <mesh key={`${x}-${z}`} geometry={boxGeo(0.08, 1.45, 0.08)} material={black} position={[x, 1.78, z]} />))}
      <mesh geometry={boxGeo(1.22, 0.08, 1.28)} material={black} position={[0, 2.5, -0.06]} />
      {/* operator */}
      <mesh geometry={geo('op-body', () => new THREE.CapsuleGeometry(0.22, 0.4, 4, 10))} material={std('#F97316', 0.6)} position={[0, 1.42, -0.25]} />
      <mesh geometry={geo('op-head', () => new THREE.SphereGeometry(0.18, 12, 10))} material={std('#F1C9A5', 0.7)} position={[0, 1.93, -0.25]} />
      <mesh geometry={geo('op-hat', () => new THREE.SphereGeometry(0.21, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2))} material={std('#FACC15', 0.4)} position={[0, 2.03, -0.25]} />
      {/* mast + forks */}
      <mesh geometry={boxGeo(0.95, 2.7, 0.12)} material={std('#1F2937', 0.6)} position={[0, 1.45, 0.96]} />
      <group ref={forksRef}>
        {[-0.3, 0.3].map((x) => (
          <mesh key={x} geometry={boxGeo(0.12, 0.06, 1.25)} material={std('#6B7280', 0.4, 0.6)} position={[x, 0.32 + (carrying ? 0.25 : 0), 1.62]} />
        ))}
        {carrying && <PalletModel position={[0, 0.34, 1.65]} variant={variant} />}
      </group>
      {[-0.66, 0.66].flatMap((x) =>
        [-0.75, 0.55].map((z) => <mesh key={`w${x}-${z}`} geometry={geo('fl-wheel', () => new THREE.CylinderGeometry(0.3, 0.3, 0.25, 14).rotateZ(Math.PI / 2))} material={black} position={[x, 0.3, z]} />)
      )}
    </group>
  );
};

// ─── Charger, tank, tree ──────────────────────────────────────────────────────

export const ChargerModel: React.FC<{ busy: boolean }> = ({ busy }) => (
  <group>
    <mesh geometry={boxGeo(1.1, 0.12, 0.9)} material={std(BRAND, 0.5)} position={[0, 0.06, 0]} />
    <mesh geometry={boxGeo(0.8, 1.5, 0.55)} material={std('#F8FAFC', 0.4)} position={[0, 0.87, 0]} castShadow />
    <mesh position={[0.28, 1.1, 0]} rotation={[0, Math.PI / 2, 0]}>
      <planeGeometry args={[0.42, 0.32]} />
      <meshBasicMaterial color="#0F172A" />
    </mesh>
    <mesh position={[0.28, 1.45, 0]} geometry={geo('led', () => new THREE.SphereGeometry(0.07, 8, 6))} material={basic(busy ? '#F59E0B' : '#22C55E')} />
  </group>
);

export const TankModel: React.FC = () => (
  <group>
    {[-0.9, 0.9].flatMap((x) => [-0.9, 0.9].map((z) => <mesh key={`${x}${z}`} geometry={boxGeo(0.2, 2, 0.2)} material={std('#64748B')} position={[x, 1, z]} />))}
    <mesh geometry={geo('tank', () => new THREE.CylinderGeometry(2.1, 2.1, 6, 24))} material={std('#F1F5F9', 0.35, 0.2)} position={[0, 5, 0]} castShadow />
    <mesh geometry={geo('tank-cap', () => new THREE.SphereGeometry(2.1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2))} material={std('#F1F5F9', 0.35, 0.2)} position={[0, 8, 0]} castShadow />
    {[3.4, 6.4].map((y) => (
      <mesh key={y} geometry={geo('tank-band', () => new THREE.CylinderGeometry(2.14, 2.14, 0.3, 24))} material={std(BRAND, 0.5)} position={[0, y, 0]} />
    ))}
  </group>
);

/** All trees of a site in two merged meshes (trunks + crowns). */
export const TreeCluster: React.FC<{ id: string; points: [number, number][] }> = ({ id, points }) => {
  const trunks = useMemo(
    () =>
      geo(`trunks-${id}`, () => {
        const parts = points.map(([x, z]) => new THREE.CylinderGeometry(0.16, 0.22, 2, 6).translate(x, 1, z));
        return parts.length ? mergeGeometries(parts)! : new THREE.BufferGeometry();
      }),
    [id, points]
  );
  const crowns = useMemo(
    () =>
      geo(`crowns-${id}`, () => {
        const parts = points.map(([x, z], i) => new THREE.SphereGeometry(1.2 + (i % 3) * 0.15, 12, 10).scale(1, 1.3, 1).translate(x, 3.1, z));
        return parts.length ? mergeGeometries(parts)! : new THREE.BufferGeometry();
      }),
    [id, points]
  );
  return (
    <group>
      <mesh geometry={trunks} material={std('#A16207', 0.9)} castShadow />
      <mesh geometry={crowns} material={std('#5EDB8B', 0.75)} castShadow />
    </group>
  );
};
