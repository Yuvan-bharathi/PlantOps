import * as THREE from 'three';

// Semi-truck built from primitives (red tractor + silver box trailer).
// Model space: metres, +Y = forward, +Z = up, origin at the truck's centre on the ground.
export const TRUCK_LENGTH_M = 16.6;
export const TRUCK_HEIGHT_M = 4.1;

export type TruckLightPreset = 'day' | 'dusk' | 'dawn' | 'night';

export interface TruckModel {
  scene: THREE.Scene;
  root: THREE.Group;
  hemi: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  beams: THREE.Mesh;
  ring: THREE.Mesh;
  ringMat: THREE.MeshBasicMaterial;
  preset: TruckLightPreset | null;
  dispose(): void;
}

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function sideTexture(id: string, accent: string) {
  return canvasTexture(1024, 216, (g) => {
    g.fillStyle = '#dfe2e6';
    g.fillRect(0, 0, 1024, 216);
    g.fillStyle = 'rgba(15,23,42,0.07)';
    for (let x = 0; x < 1024; x += 64) g.fillRect(x, 0, 3, 216);
    g.fillStyle = accent;
    g.fillRect(0, 150, 1024, 22);
    g.fillStyle = '#c1121f';
    g.fillRect(0, 176, 1024, 8);
    g.textBaseline = 'middle';
    g.fillStyle = '#1e293b';
    g.font = '900 86px Inter, Arial, sans-serif';
    g.fillText('PLANTOPS', 56, 80);
    g.textAlign = 'right';
    g.fillStyle = '#475569';
    g.font = '700 38px Inter, Arial, sans-serif';
    g.fillText(`LOGISTICS · ${id}`, 978, 92);
  });
}

function shadowTexture() {
  return canvasTexture(64, 256, (g) => {
    g.filter = 'blur(10px)';
    g.fillStyle = 'rgba(0,0,0,1)';
    g.fillRect(14, 14, 36, 228);
  });
}

function beamTexture() {
  return canvasTexture(64, 256, (g) => {
    const grad = g.createLinearGradient(0, 256, 0, 0);
    grad.addColorStop(0, 'rgba(255,240,170,0.85)');
    grad.addColorStop(1, 'rgba(255,240,170,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(24, 256);
    g.lineTo(40, 256);
    g.lineTo(64, 0);
    g.lineTo(0, 0);
    g.closePath();
    g.fill();
  });
}

export function buildTruck(id: string, accent: string): TruckModel {
  const scene = new THREE.Scene();
  const ambient = new THREE.AmbientLight(0xffffff, 2.0);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8f99, 1.4);
  hemi.position.set(0, 0, 1);
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-40, -60, 120);
  scene.add(ambient, hemi, sun);

  const root = new THREE.Group();
  scene.add(root);

  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(x: T) => {
    disposables.push(x);
    return x;
  };
  const mat = (p: THREE.MeshStandardMaterialParameters) =>
    track(new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.35, metalness: 0.1, ...p }));
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.frustumCulled = false;
    root.add(mesh);
    return mesh;
  };
  // box(width along X, length along Y, height along Z, centre x/y/z)
  const box = (w: number, l: number, h: number, x: number, y: number, z: number, m: THREE.Material) =>
    add(track(new THREE.BoxGeometry(w, l, h)), m, x, y, z);

  const cabRed = mat({ color: 0xd62828, roughness: 0.3, metalness: 0.15 });
  const dark = mat({ color: 0x1f2937, roughness: 0.5 });
  const chassis = mat({ color: 0x2b2f36, roughness: 0.6 });
  const glass = mat({ color: 0x38bdf8, roughness: 0.1, metalness: 0.4 });
  const chrome = mat({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.6 });
  const trailer = mat({ color: 0xf1f5f9, roughness: 0.4, metalness: 0.05 });
  const door = mat({ color: 0xdfe2e6, roughness: 0.5 });
  const tire = mat({ color: 0x111111, roughness: 0.9 });
  const accentMat = mat({ color: new THREE.Color(accent), roughness: 0.3 });
  const headlight = mat({ color: 0xfffbe6, emissive: 0xfff3b0, emissiveIntensity: 1.5 });
  const tail = mat({ color: 0xff3030, emissive: 0xff0000, emissiveIntensity: 1.3 });
  const amber = mat({ color: 0xffb020, emissive: 0xff9500, emissiveIntensity: 1.1 });

  // ── Chassis & trailer ──
  box(1.1, 15.6, 0.35, 0, 0.1, 0.85, chassis);
  box(2.55, 12.4, 2.8, 0, -1.9, 2.65, trailer);
  box(2.6, 12.45, 0.08, 0, -1.9, 4.07, chrome);
  box(2.6, 12.4, 0.16, 0, -1.9, 1.3, chassis);

  const sideTex = track(sideTexture(id, accent));
  const decalMat = mat({ map: sideTex, roughness: 0.4 });
  const right = track(new THREE.PlaneGeometry(12.2, 2.6));
  right.rotateX(Math.PI / 2);
  right.rotateZ(Math.PI / 2);
  add(right, decalMat, 1.285, -1.9, 2.65);
  const left = track(new THREE.PlaneGeometry(12.2, 2.6));
  left.rotateX(Math.PI / 2);
  left.rotateZ(-Math.PI / 2);
  add(left, decalMat, -1.285, -1.9, 2.65);

  // Rear doors, lights, underride bar
  box(2.4, 0.04, 2.6, 0, -8.12, 2.65, door);
  box(0.05, 0.06, 2.6, 0, -8.15, 2.65, chassis);
  box(0.06, 0.08, 2.4, -0.55, -8.16, 2.65, chrome);
  box(0.06, 0.08, 2.4, 0.55, -8.16, 2.65, chrome);
  box(2.3, 0.12, 0.15, 0, -8.0, 0.75, chassis);
  box(0.36, 0.06, 0.18, -0.95, -8.14, 1.12, tail);
  box(0.36, 0.06, 0.18, 0.95, -8.14, 1.12, tail);
  box(0.12, 0.12, 0.9, -0.9, 2.8, 0.75, chassis);
  box(0.12, 0.12, 0.9, 0.9, 2.8, 0.75, chassis);

  // ── Tractor cab ──
  box(2.45, 2.4, 1.5, 0, 6.5, 1.65, cabRed);
  box(2.4, 2.1, 1.1, 0, 6.35, 2.95, cabRed);
  box(2.35, 1.6, 0.55, 0, 5.9, 3.78, cabRed);
  box(2.3, 0.75, 1.2, 0, 8.05, 1.5, cabRed);
  box(1.3, 0.04, 0.9, 0, 8.43, 1.55, chrome);
  box(1.1, 0.05, 0.7, 0, 8.45, 1.55, dark);
  box(2.45, 0.25, 0.35, 0, 8.45, 0.85, dark);
  box(0.4, 0.06, 0.22, -0.85, 8.45, 1.3, headlight);
  box(0.4, 0.06, 0.22, 0.85, 8.45, 1.3, headlight);
  box(2.2, 0.06, 0.85, 0, 7.42, 2.95, glass);
  box(0.04, 1.0, 0.7, -1.215, 6.7, 2.95, glass);
  box(0.04, 1.0, 0.7, 1.215, 6.7, 2.95, glass);
  box(0.02, 2.3, 0.14, -1.236, 6.5, 1.35, accentMat);
  box(0.02, 2.3, 0.14, 1.236, 6.5, 1.35, accentMat);
  for (const s of [-1, 1]) {
    box(0.25, 0.05, 0.05, s * 1.32, 7.3, 2.95, dark);
    box(0.08, 0.14, 0.5, s * 1.46, 7.3, 2.75, dark);
  }
  for (const x of [-0.8, -0.4, 0, 0.4, 0.8]) box(0.12, 0.06, 0.06, x, 7.38, 3.53, amber);

  // Fuel tanks (cylinder axis is Y by default = along the truck)
  const tankGeo = track(new THREE.CylinderGeometry(0.32, 0.32, 1.2, 16));
  add(tankGeo, chrome, -1.02, 4.9, 0.8);
  add(tankGeo, chrome, 1.02, 4.9, 0.8);
  // Exhaust stacks (vertical)
  const stackGeo = track(new THREE.CylinderGeometry(0.08, 0.08, 1.7, 10));
  stackGeo.rotateX(Math.PI / 2);
  add(stackGeo, chrome, -1.1, 5.15, 3.3);
  add(stackGeo, chrome, 1.1, 5.15, 3.3);

  // ── Wheels ──
  const wheelGeo = track(new THREE.CylinderGeometry(0.52, 0.52, 0.5, 20));
  wheelGeo.rotateZ(Math.PI / 2);
  const hubGeo = track(new THREE.CylinderGeometry(0.26, 0.26, 0.52, 12));
  hubGeo.rotateZ(Math.PI / 2);
  for (const y of [7.3, 4.4, 3.1, -5.8, -7.0]) {
    for (const s of [-1, 1]) {
      add(wheelGeo, tire, s * 1.0, y, 0.52);
      add(hubGeo, chrome, s * 1.0, y, 0.52);
    }
  }
  box(0.5, 0.04, 0.5, -1.0, 2.45, 0.55, dark);
  box(0.5, 0.04, 0.5, 1.0, 2.45, 0.55, dark);

  // ── Ground contact shadow ──
  const shadowMat = track(
    new THREE.MeshBasicMaterial({ map: track(shadowTexture()), color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false })
  );
  add(track(new THREE.PlaneGeometry(3.6, 18)), shadowMat, 0, 0.1, 0.03);

  // ── Night headlight beams ──
  const beamMat = track(
    new THREE.MeshBasicMaterial({ map: track(beamTexture()), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
  );
  const beams = add(track(new THREE.PlaneGeometry(5, 16)), beamMat, 0, 16.5, 0.06);
  beams.visible = false;

  // Invisible placeholder for selection ring to keep interface intact
  const ringMat = track(new THREE.MeshBasicMaterial({ visible: false }));
  const ring = add(track(new THREE.BufferGeometry()), ringMat, 0, 0, 0);
  ring.visible = false;

  return {
    scene,
    root,
    hemi,
    sun,
    beams,
    ring,
    ringMat,
    preset: null,
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}

const LIGHTING: Record<TruckLightPreset, { sky: number; ground: number; hemi: number; sun: number; sunColor: number }> = {
  day: { sky: 0xffffff, ground: 0x8a8f99, hemi: 1.3, sun: 1.9, sunColor: 0xffffff },
  dawn: { sky: 0xffe2c4, ground: 0x6b6f80, hemi: 0.95, sun: 1.4, sunColor: 0xffb27a },
  dusk: { sky: 0xffc9a8, ground: 0x5b5f7a, hemi: 0.85, sun: 1.2, sunColor: 0xff8c5a },
  night: { sky: 0x7c8db5, ground: 0x1e2230, hemi: 0.4, sun: 0.25, sunColor: 0x9fb4ff },
};

export function applyTruckLighting(model: TruckModel, preset: TruckLightPreset) {
  if (model.preset === preset) return;
  const l = LIGHTING[preset];
  model.hemi.color.setHex(l.sky);
  model.hemi.groundColor.setHex(l.ground);
  model.hemi.intensity = l.hemi;
  model.sun.color.setHex(l.sunColor);
  model.sun.intensity = l.sun;
  model.preset = preset;
}
