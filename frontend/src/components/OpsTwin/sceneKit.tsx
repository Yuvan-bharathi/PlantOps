import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import { Vec3 } from './spatialConfig';

// ─── Shared types ─────────────────────────────────────────────────────────────

export type EntityKind = 'equipment' | 'location' | 'aisle' | 'zone' | 'reach' | 'machine' | 'agv' | 'staging' | 'technician' | 'building' | 'truck' | 'forklift' | 'pallet' | 'dock' | 'charger' | 'site';
export interface EntityRef {
  kind: EntityKind;
  id: string; // machine code, work-order id, cell id, truck id, pallet id …
}

export interface CameraApi {
  flyTo(target: Vec3, distance?: number): void;
  home(): void;
  zoom(factor: number): void;
  rotate(degrees: number): void;
  /** Tilt the view up (towards top-down) or down (towards the horizon). */
  tilt(degrees: number): void;
  /** Keep the camera centred on a moving point (null stops following). */
  follow(get: (() => Vec3 | null) | null): void;
  /** Glide to look at a point, keeping the current distance and angle. */
  panTo(target: Vec3): void;
  /** Where the camera looks: target + the ground footprint of the view (x, z corners). */
  getView(): { target: [number, number]; corners: [number, number][]; distance: number } | null;
}

export const BRAND = '#2563EB';
export const sameRef = (a: EntityRef | null, b: EntityRef | null) => !!a && !!b && a.kind === b.kind && a.id === b.id;
const MAX_POLAR = Math.PI / 2.35;
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// ─── Camera controller (programmatic glide on top of OrbitControls) ───────────

export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export const CameraRig = forwardRef<
  CameraApi,
  { home: { position: Vec3; target: Vec3 }; minDistance?: number; maxDistance?: number; bounds?: Bounds; onUserInteract?: () => void }
>(
  ({ home, minDistance = 8, maxDistance = 70, bounds, onUserInteract }, ref) => {
    const { camera, size } = useThree();
    const controls = useRef<any>(null);
    const followGet = useRef<(() => Vec3 | null) | null>(null);
    const ray = useRef(new THREE.Raycaster());
    const anim = useRef<null | { fromPos: THREE.Vector3; toPos: THREE.Vector3; fromT: THREE.Vector3; toT: THREE.Vector3; t: number; dur: number }>(null);

    // The inspector covers the right ~340px and the queue / stepper the bottom, so shift the
    // projection centre up-left: whatever we frame lands in the middle of the visible area.
    useEffect(() => {
      const cam = camera as THREE.PerspectiveCamera;
      if (size.width >= 768) cam.setViewOffset(size.width, size.height, 170, Math.round(size.height * 0.06), size.width, size.height);
      else cam.clearViewOffset();
      cam.updateProjectionMatrix();
    }, [camera, size.width, size.height]);

    const animateTo = (toPos: THREE.Vector3, toT: THREE.Vector3, dur = 1.1) => {
      if (!controls.current) return;
      anim.current = { fromPos: camera.position.clone(), toPos, fromT: controls.current.target.clone(), toT, t: 0, dur };
    };

    useImperativeHandle(ref, () => ({
      // Keep the current viewing angle and ease towards the target
      flyTo(target, distance = 30) {
        if (!controls.current) return;
        const dir = camera.position.clone().sub(controls.current.target).normalize();
        const t = new THREE.Vector3(...target);
        animateTo(t.clone().add(dir.multiplyScalar(distance)), t);
      },
      home() {
        animateTo(new THREE.Vector3(...home.position), new THREE.Vector3(...home.target), 1.3);
      },
      zoom(factor) {
        if (!controls.current) return;
        const tgt = controls.current.target.clone();
        const off = camera.position.clone().sub(tgt);
        const len = THREE.MathUtils.clamp(off.length() * factor, minDistance, maxDistance);
        animateTo(tgt.clone().add(off.setLength(len)), tgt, 0.45);
      },
      rotate(degrees) {
        if (!controls.current) return;
        const tgt = controls.current.target.clone();
        const off = camera.position.clone().sub(tgt).applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(degrees));
        animateTo(tgt.clone().add(off), tgt, 0.6);
      },
      tilt(degrees) {
        if (!controls.current) return;
        const tgt = controls.current.target.clone();
        const sph = new THREE.Spherical().setFromVector3(camera.position.clone().sub(tgt));
        sph.phi = THREE.MathUtils.clamp(sph.phi - THREE.MathUtils.degToRad(degrees), 0.08, MAX_POLAR);
        animateTo(tgt.clone().add(new THREE.Vector3().setFromSpherical(sph)), tgt, 0.6);
      },
      follow(get) {
        followGet.current = get;
      },
      panTo(target) {
        if (!controls.current) return;
        const t = new THREE.Vector3(...target);
        const off = camera.position.clone().sub(controls.current.target);
        animateTo(t.clone().add(off), t, 0.7);
      },
      getView() {
        if (!controls.current) return null;
        const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const hit = new THREE.Vector3();
        const corners: [number, number][] = [];
        for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
          ray.current.setFromCamera(new THREE.Vector2(x, y), camera);
          const r = ray.current.ray;
          if (r.intersectPlane(ground, hit) && hit.distanceTo(camera.position) < 1500) corners.push([hit.x, hit.z]);
          else {
            const far = r.origin.clone().add(r.direction.clone().setY(0).normalize().multiplyScalar(900));
            corners.push([far.x, far.z]);
          }
        }
        const t = controls.current.target as THREE.Vector3;
        return { target: [t.x, t.z], corners, distance: camera.position.distanceTo(t) };
      },
    }));

    useFrame((_, dt) => {
      const c = controls.current;
      // keep panning inside the plant
      if (c && bounds) {
        const t = c.target as THREE.Vector3;
        const cx = THREE.MathUtils.clamp(t.x, bounds.minX, bounds.maxX);
        const cz = THREE.MathUtils.clamp(t.z, bounds.minZ, bounds.maxZ);
        if (cx !== t.x || cz !== t.z) {
          camera.position.x += cx - t.x;
          camera.position.z += cz - t.z;
          t.set(cx, t.y, cz);
        }
      }
      const a = anim.current;
      // follow a moving entity (after any fly-to animation has finished)
      if (!a && c && followGet.current) {
        const p = followGet.current();
        if (p) {
          const t = c.target as THREE.Vector3;
          const k = Math.min(1, dt * 5);
          const dx = (p[0] - t.x) * k;
          const dz = (p[2] - t.z) * k;
          t.x += dx;
          t.z += dz;
          camera.position.x += dx;
          camera.position.z += dz;
          c.update();
        }
      }
      if (!a || !controls.current) return;
      a.t = Math.min(1, a.t + dt / a.dur);
      const e = easeInOutCubic(a.t);
      camera.position.lerpVectors(a.fromPos, a.toPos, e);
      controls.current.target.lerpVectors(a.fromT, a.toT, e);
      controls.current.update();
      if (a.t >= 1) anim.current = null;
    });

    return (
      <OrbitControls
        ref={controls}
        target={home.target}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={minDistance}
        maxDistance={maxDistance}
        maxPolarAngle={MAX_POLAR}
        // map-style: hold + drag pans across the plant, right-drag rotates, wheel zooms
        mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
        touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE }}
        screenSpacePanning={false}
        zoomToCursor
        onStart={() => {
          // user input always wins over an animation or follow mode
          anim.current = null;
          if (followGet.current) {
            followGet.current = null;
            onUserInteract?.();
          }
        }}
      />
    );
  }
);
CameraRig.displayName = 'CameraRig';

// ─── Lights shared by both scenes ─────────────────────────────────────────────

/** Sun + sky. With `follow`, the shadow frustum tracks the camera target so a large plant keeps crisp shadows. */
/** `night`: 0 = full day … 1 = night (moonlight). */
export const SceneLights: React.FC<{ extent: number; follow?: boolean; night?: number }> = ({ extent, follow, night = 0 }) => {
  const sunColor = new THREE.Color('#ffffff').lerp(new THREE.Color('#9DB8FF'), night);
  const skyColor = new THREE.Color('#ffffff').lerp(new THREE.Color('#7A86A8'), night);
  const sun = useRef<THREE.DirectionalLight>(null);
  const controls = useThree((s) => s.controls) as any;
  useFrame(() => {
    const l = sun.current;
    if (!follow || !l || !controls?.target) return;
    const t = controls.target as THREE.Vector3;
    l.position.set(t.x + extent * 0.6, extent, t.z + extent * 0.45);
    l.target.position.copy(t);
    l.target.updateMatrixWorld();
  });
  return (
  <>
    <hemisphereLight args={[skyColor, new THREE.Color('#C7D2FE').lerp(new THREE.Color('#1E2A44'), night), 1.15 - 0.75 * night]} />
    <directionalLight
      ref={sun}
      position={[extent * 0.6, extent, extent * 0.45]}
      color={sunColor}
      intensity={1.5 - 1.15 * night}
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-extent}
      shadow-camera-right={extent}
      shadow-camera-top={extent}
      shadow-camera-bottom={-extent}
      shadow-camera-far={extent * 4}
      shadow-bias={-0.0004}
    />
    <ambientLight intensity={0.25 + 0.1 * night} color={night > 0.5 ? '#8FA3D9' : '#ffffff'} />
  </>
  );
};

// ─── Selection + labels ───────────────────────────────────────────────────────

let glowTex: THREE.CanvasTexture | null = null;
const glowTexture = () => {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(37,99,235,0.55)');
  grad.addColorStop(1, 'rgba(37,99,235,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
};

/** Blue corner brackets (top + bottom) around a selected object, gently breathing. */
export const SelectionBrackets: React.FC<{ size: [number, number, number]; color?: string; glow?: boolean }> = ({ size, color = BRAND, glow = true }) => {
  const ref = useRef<THREE.Group>(null);
  const [w, h, d] = size;
  const arm = Math.min(w, d) * 0.22;
  const t = Math.max(0.07, Math.min(w, d) * 0.012);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 3) * 0.012);
  });
  const corners: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  return (
    <group ref={ref}>
      {glow && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
          <planeGeometry args={[w * 1.9, d * 1.9]} />
          <meshBasicMaterial map={glowTexture()} transparent depthWrite={false} />
        </mesh>
      )}
      {[0.06, h].map((y) =>
        corners.map(([sx, sz], i) => (
          <group key={`${y}-${i}`} position={[(sx * w) / 2, y, (sz * d) / 2]}>
            <mesh position={[(-sx * arm) / 2, 0, 0]}>
              <boxGeometry args={[arm, t, t]} />
              <meshBasicMaterial color={color} />
            </mesh>
            <mesh position={[0, 0, (-sz * arm) / 2]}>
              <boxGeometry args={[t, t, arm]} />
              <meshBasicMaterial color={color} />
            </mesh>
            <mesh position={[0, y > 1 ? -arm / 2 : arm / 2, 0]}>
              <boxGeometry args={[t, arm, t]} />
              <meshBasicMaterial color={color} />
            </mesh>
          </group>
        ))
      )}
    </group>
  );
};

/** Floating name chip, like the reference's "TRK-2205 · Unloading" tags. */
export const Chip: React.FC<{ position: Vec3; title: string; subtitle?: string; dot?: string; selected?: boolean; small?: boolean; priority?: number }> = ({
  position,
  title,
  subtitle,
  dot,
  selected,
  small,
  priority = 50,
}) => (
  <Html position={position} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
    <div
      data-chip=""
      data-priority={selected ? 100 : priority}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        whiteSpace: 'nowrap',
        padding: small ? '3px 8px' : '4px 10px',
        borderRadius: 999,
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: small ? 11 : 12,
        fontWeight: 700,
        color: selected ? '#ffffff' : '#0F172A',
        background: selected ? BRAND : 'rgba(255,255,255,0.96)',
        boxShadow: '0 6px 18px rgba(15,23,42,0.18)',
        transform: 'translateY(-6px)',
      }}
    >
      {dot && <span style={{ width: 7, height: 7, borderRadius: 99, background: dot, boxShadow: `0 0 0 2px ${selected ? 'rgba(255,255,255,0.6)' : 'transparent'}` }} />}
      {title}
      {subtitle && <span style={{ fontWeight: 500, opacity: selected ? 0.85 : 0.6 }}>{subtitle}</span>}
    </div>
  </Html>
);

/** Location pin (sphere head + cone tip), bobbing slightly. */
export const Pin: React.FC<{ position: Vec3; color?: string; height?: number; scale?: number }> = ({ position, color = BRAND, height = 2.6, scale = 1 }) => {
  const ref = useRef<THREE.Group>(null);
  const phase = useRef(Math.random() * Math.PI * 2);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = height + Math.sin(clock.elapsedTime * 2.2 + phase.current) * 0.12 * scale;
  });
  return (
    <group position={[position[0], 0, position[2]]} scale={scale}>
      <group ref={ref} position={[0, height, 0]}>
        <mesh position={[0, 0.35, 0]}>
          <sphereGeometry args={[0.38, 20, 16]} />
          <meshStandardMaterial color={color} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.35, 0.31]}>
          <circleGeometry args={[0.15, 16]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0, -0.12, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.24, 0.6, 16]} />
          <meshStandardMaterial color={color} roughness={0.35} />
        </mesh>
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]}>
        <ringGeometry args={[0.3, 0.5, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} depthWrite={false} />
      </mesh>
    </group>
  );
};

/** Painted rectangle outline on the floor. */
export const BayOutline: React.FC<{ w: number; d: number; color?: string; t?: number }> = ({ w, d, color = '#F5B700', t = 0.09 }) => (
  <group position={[0, 0.025, 0]}>
    <mesh position={[0, 0, -d / 2]}><boxGeometry args={[w, 0.02, t]} /><meshBasicMaterial color={color} /></mesh>
    <mesh position={[0, 0, d / 2]}><boxGeometry args={[w, 0.02, t]} /><meshBasicMaterial color={color} /></mesh>
    <mesh position={[-w / 2, 0, 0]}><boxGeometry args={[t, 0.02, d]} /><meshBasicMaterial color={color} /></mesh>
    <mesh position={[w / 2, 0, 0]}><boxGeometry args={[t, 0.02, d]} /><meshBasicMaterial color={color} /></mesh>
  </group>
);

/** Click + hover props for a selectable group. */
export const pickable = (onSelect: () => void, onHover: (v: boolean) => void) => ({
  onClick: (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect();
  },
  onPointerOver: (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onHover(true);
    (e.nativeEvent.target as HTMLElement).style.cursor = 'pointer';
  },
  onPointerOut: (e: ThreeEvent<PointerEvent>) => {
    onHover(false);
    (e.nativeEvent.target as HTMLElement).style.cursor = '';
  },
});

// ─── Small reusable props ─────────────────────────────────────────────────────

export const Pallet: React.FC<{ position?: Vec3; boxes?: number; color?: string; rotationY?: number }> = ({ position = [0, 0, 0], boxes = 4, color = '#D9A066', rotationY = 0 }) => {
  const layers = Math.ceil(boxes / 4);
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.08, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.3, 0.16, 1.3]} />
        <meshStandardMaterial color="#B7793F" roughness={0.9} />
      </mesh>
      {Array.from({ length: boxes }, (_, i) => {
        const layer = Math.floor(i / 4);
        const k = i % 4;
        return (
          <mesh key={i} position={[k % 2 ? 0.31 : -0.31, 0.43 + layer * 0.56, k < 2 ? -0.31 : 0.31]} castShadow>
            <boxGeometry args={[0.58, 0.54, 0.58]} />
            <meshStandardMaterial color={color} roughness={0.85} />
          </mesh>
        );
      })}
      {/* tape strips on the top layer */}
      <mesh position={[0, 0.16 + layers * 0.56 + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.2, 0.08]} />
        <meshBasicMaterial color="#C08A52" />
      </mesh>
    </group>
  );
};

export const Tree: React.FC<{ position: Vec3; scale?: number }> = ({ position, scale = 1 }) => (
  <group position={position} scale={scale}>
    <mesh position={[0, 0.9, 0]} castShadow>
      <cylinderGeometry args={[0.14, 0.2, 1.8, 8]} />
      <meshStandardMaterial color="#A16207" roughness={0.9} />
    </mesh>
    <mesh position={[0, 2.6, 0]} scale={[1, 1.35, 1]} castShadow>
      <sphereGeometry args={[1.1, 16, 12]} />
      <meshStandardMaterial color="#4ADE80" roughness={0.75} />
    </mesh>
  </group>
);

// ─── Label declutter ──────────────────────────────────────────────────────────

/**
 * Hides lower-priority chips that overlap higher-priority ones (selected > hovered > entities >
 * buildings > sites). Runs a few times a second over the chips rendered inside `root`.
 */
export function startLabelDeclutter(root: HTMLElement, enabled: () => boolean): () => void {
  const id = window.setInterval(() => {
    const chips = Array.from(root.querySelectorAll<HTMLElement>('[data-chip]'));
    if (!enabled()) {
      chips.forEach((c) => (c.style.visibility = ''));
      return;
    }
    const items = chips
      .map((el) => ({ el, p: Number(el.dataset.priority || 0), r: el.getBoundingClientRect() }))
      .filter((x) => x.r.width > 0)
      .sort((a, b) => b.p - a.p);
    const kept: DOMRect[] = [];
    for (const it of items) {
      const pad = 3;
      const clash = kept.some((k) => it.r.left < k.right + pad && it.r.right > k.left - pad && it.r.top < k.bottom + pad && it.r.bottom > k.top - pad);
      if (clash && it.p < 100) it.el.style.visibility = 'hidden';
      else {
        it.el.style.visibility = '';
        kept.push(it.r);
      }
    }
  }, 250);
  return () => window.clearInterval(id);
}
