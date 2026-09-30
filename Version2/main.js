import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  buildRobotCellInterior,
  buildMachiningCellInterior,
  buildProcessingCellInterior,
  buildAssemblyCellInterior,
  buildPackagingCellInterior,
  buildMaintenanceBayInterior,
  buildQualityLabInterior,
  buildUtilityPlantInterior,
} from './interiors.js';

// ─────────────────────────────────────────────────────────────────────────────
// 1. VIEWPORT, RENDERER & CAMERA
// ─────────────────────────────────────────────────────────────────────────────
const container = document.getElementById('canvas-container');
const svgOverlay = document.getElementById('leader-lines-svg');

const scene = new THREE.Scene();

// Deep twilight industrial sky — evocative, photorealistic dusk atmosphere
scene.background = new THREE.Color(0x0d1117);
scene.fog = new THREE.FogExp2(0x101828, 0.0028);

const aspect = window.innerWidth / window.innerHeight;
const frustumSize = 104;

const camera = new THREE.OrthographicCamera(
  (frustumSize * aspect) / -2,
  (frustumSize * aspect) / 2,
  frustumSize / 2,
  frustumSize / -2,
  -500,
  1000
);

// High isometric angle
const CAMPUS_CAM_POS = new THREE.Vector3(100, 110, 100);
const CAMPUS_CAM_TARGET = new THREE.Vector3(0, 0, 0);
camera.position.copy(CAMPUS_CAM_POS);
camera.lookAt(CAMPUS_CAM_TARGET);
camera.zoom = 1.0;
camera.updateProjectionMatrix();

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI / 2 - 0.05;
controls.minZoom = 0.5;
controls.maxZoom = 5.0;
controls.target.copy(CAMPUS_CAM_TARGET);

// ─────────────────────────────────────────────────────────────────────────────
// 2. SCENE GROUPS & PHOTOREALISTIC TWILIGHT LIGHTING SYSTEM
// ─────────────────────────────────────────────────────────────────────────────
const campusGroup = new THREE.Group();
campusGroup.name = 'campus-exterior';
scene.add(campusGroup);

const interiorHolder = new THREE.Group();
interiorHolder.name = 'interior-holder';
interiorHolder.visible = false;
scene.add(interiorHolder);

// Hemisphere: warm sky glow from above, cool deep earth from below
const campusHemi = new THREE.HemisphereLight(0xb8c8e8, 0x0a1428, 1.1);
campusGroup.add(campusHemi);

// Soft ambient fill — prevents pitch black shadows
const ambientLight = new THREE.AmbientLight(0x1a2a45, 2.2);
campusGroup.add(ambientLight);

// Primary golden-hour sun from upper-left (NW) — warm directional key light
const dirLight = new THREE.DirectionalLight(0xfff0d0, 1.5);
dirLight.position.set(-80, 130, -60);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 4096;
dirLight.shadow.mapSize.height = 4096;
dirLight.shadow.camera.near = 10;
dirLight.shadow.camera.far = 400;
dirLight.shadow.camera.left = -100;
dirLight.shadow.camera.right = 100;
dirLight.shadow.camera.top = 100;
dirLight.shadow.camera.bottom = -100;
dirLight.shadow.bias = -0.0002;
campusGroup.add(dirLight);

// Cool blue-purple fill from opposite (SE) — sky bounce & atmosphere depth
const fillLight = new THREE.DirectionalLight(0x1a3a7a, 1.2);
fillLight.position.set(80, 50, 70);
campusGroup.add(fillLight);

// Warm ground-reflected light (warm amber to simulate lit concrete / asphalt glow)
const groundBounce = new THREE.DirectionalLight(0xff9944, 0.25);
groundBounce.position.set(0, -10, 0);
campusGroup.add(groundBounce);

// Dedicated Uniform Interior Lighting Rig (Identical light temperature & illumination across all orbit angles)
const interiorLightGroup = new THREE.Group();

// Neutral balanced ambient & hemisphere base (prevents directional color casting)
const intHemiLight = new THREE.HemisphereLight(0xf1f5f9, 0x1e293b, 1.15);
interiorLightGroup.add(intHemiLight);

const intAmbient = new THREE.AmbientLight(0x334155, 0.95);
interiorLightGroup.add(intAmbient);

// Overhead Top Soft Key Light (Pure neutral daylight downward illumination)
const intTopLight = new THREE.DirectionalLight(0xf8fafc, 0.85);
intTopLight.position.set(0, 80, 0);
interiorLightGroup.add(intTopLight);

// 4-Quadrant Symmetrical Soft Fill Lights with IDENTICAL Color Temperature (0xf1f5f9)
// This guarantees that regardless of camera orbit angle (front, back, top, isometric),
// every facet receives exactly balanced lighting with zero temperature shifts or specular flare.
const cornerDist = 45;
const cornerHeight = 55;
const cornerIntensity = 0.4;
const cornerColor = 0xf1f5f9;

const lightNE = new THREE.DirectionalLight(cornerColor, cornerIntensity);
lightNE.position.set(cornerDist, cornerHeight, cornerDist);
interiorLightGroup.add(lightNE);

const lightNW = new THREE.DirectionalLight(cornerColor, cornerIntensity);
lightNW.position.set(-cornerDist, cornerHeight, cornerDist);
interiorLightGroup.add(lightNW);

const lightSE = new THREE.DirectionalLight(cornerColor, cornerIntensity);
lightSE.position.set(cornerDist, cornerHeight, -cornerDist);
interiorLightGroup.add(lightSE);

const lightSW = new THREE.DirectionalLight(cornerColor, cornerIntensity);
lightSW.position.set(-cornerDist, cornerHeight, -cornerDist);
interiorLightGroup.add(lightSW);

interiorHolder.add(interiorLightGroup);

// ─────────────────────────────────────────────────────────────────────────────
// 3. CAMPUS GROUND, ROADS, PARKING & INFRASTRUCTURE
// ─────────────────────────────────────────────────────────────────────────────

// Base ground — dark warm asphalt/concrete industrial hardstand
const groundGeom = new THREE.PlaneGeometry(300, 300);
const groundMat = new THREE.MeshStandardMaterial({
  color: 0x151c28,
  roughness: 0.92,
  metalness: 0.08,
});
const ground = new THREE.Mesh(groundGeom, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
campusGroup.add(ground);

// Subtle grid — very faint so it does not dominate at night
const gridHelper = new THREE.GridHelper(260, 52, 0x1e2a40, 0x131d30);
gridHelper.position.y = 0.02;
campusGroup.add(gridHelper);

// Concrete apron around buildings — lighter warm concrete pad
const apronMat = new THREE.MeshStandardMaterial({ color: 0x232d3e, roughness: 0.82, metalness: 0.1 });
const apron = new THREE.Mesh(new THREE.PlaneGeometry(180, 160), apronMat);
apron.rotation.x = -Math.PI / 2;
apron.position.set(0, 0.01, 0);
apron.receiveShadow = true;
campusGroup.add(apron);

// Roads — deep asphalt, slightly raised above ground
const roadMat = new THREE.MeshStandardMaterial({ color: 0x111520, roughness: 0.96, metalness: 0.05 });
function createRoad(x, z, w, d) {
  const road = new THREE.Mesh(new THREE.PlaneGeometry(w, d), roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.set(x, 0.035, z);
  road.receiveShadow = true;
  campusGroup.add(road);
}
createRoad(0, 0, 220, 11);
createRoad(0, 22, 220, 9);
createRoad(-18, 0, 11, 190);
createRoad(28, 0, 11, 190);
createRoad(0, -60, 180, 14); // Main entrance road

// Parking Lot — southwest corner
const parkingMat = new THREE.MeshStandardMaterial({ color: 0x1a2133, roughness: 0.9, metalness: 0.06 });
const parkingLot = new THREE.Mesh(new THREE.PlaneGeometry(32, 20), parkingMat);
parkingLot.rotation.x = -Math.PI / 2;
parkingLot.position.set(-58, 0.04, -18);
parkingLot.receiveShadow = true;
campusGroup.add(parkingLot);

// Parking space markings
const parkingLineMat = new THREE.LineBasicMaterial({ color: 0x2a3a56, transparent: true, opacity: 0.8 });
for (let i = 0; i < 7; i++) {
  const g = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-72 + i * 4.8, 0.06, -27),
    new THREE.Vector3(-72 + i * 4.8, 0.06, -9),
  ]);
  campusGroup.add(new THREE.Line(g, parkingLineMat));
}

// Road Lane Markings — warm white center dashes
function createRoadMarkings() {
  const dashMat = new THREE.LineDashedMaterial({
    color: 0xd4c87a,  // Warm yellow lane markings
    dashSize: 2.0,
    gapSize: 1.8,
    linewidth: 1,
    transparent: true,
    opacity: 0.75,
  });

  // Horizontal main road center line
  const hGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-105, 0.055, 0),
    new THREE.Vector3(105, 0.055, 0),
  ]);
  const hLine = new THREE.Line(hGeom, dashMat);
  hLine.computeLineDistances();
  campusGroup.add(hLine);

  // Vertical road center line
  const vGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-18, 0.055, -90),
    new THREE.Vector3(-18, 0.055, 90),
  ]);
  const vLine = new THREE.Line(vGeom, dashMat);
  vLine.computeLineDistances();
  campusGroup.add(vLine);

  // Crosswalk
  const crossMat = new THREE.MeshStandardMaterial({ color: 0xd4c87a, roughness: 0.85 });
  for (let i = 0; i < 5; i++) {
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 7.5), crossMat);
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(-14 + i * 1.4, 0.06, 13);
    campusGroup.add(stripe);
  }
}
createRoadMarkings();

// Photorealistic layered tree clusters — multi-sphere volumetric foliage
const treeFoliageMat1 = new THREE.MeshStandardMaterial({ color: 0x0d3019, roughness: 0.95, flatShading: true });
const treeFoliageMat2 = new THREE.MeshStandardMaterial({ color: 0x13451f, roughness: 0.92, flatShading: true });
const treeFoliageMat3 = new THREE.MeshStandardMaterial({ color: 0x183d1c, roughness: 0.9, flatShading: true });
const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x2d1b0e, roughness: 0.95 });

function createPhotorealisticTree(cx, cz, baseScale = 1.0) {
  const treeGroup = new THREE.Group();
  const height = (2.2 + Math.random() * 1.6) * baseScale;
  const trunkH = height * 0.55;

  // Trunk
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12 * baseScale, 0.18 * baseScale, trunkH, 7),
    treeTrunkMat
  );
  trunk.position.y = trunkH / 2;
  trunk.castShadow = true;
  treeGroup.add(trunk);

  // 3-layer foliage cloud for volume and depth
  const mats = [treeFoliageMat1, treeFoliageMat2, treeFoliageMat3];
  const layers = [
    { scale: 1.5 * baseScale, y: trunkH * 0.9 },
    { scale: 1.3 * baseScale, y: trunkH + height * 0.28 },
    { scale: 0.9 * baseScale, y: trunkH + height * 0.52 },
  ];
  layers.forEach((l, idx) => {
    const foliage = new THREE.Mesh(
      new THREE.IcosahedronGeometry(l.scale, 1),
      mats[idx]
    );
    foliage.position.set(
      (Math.random() - 0.5) * 0.4 * baseScale,
      l.y,
      (Math.random() - 0.5) * 0.4 * baseScale
    );
    foliage.castShadow = true;
    treeGroup.add(foliage);
  });
  treeGroup.position.set(cx, 0, cz);
  campusGroup.add(treeGroup);
}

function createTreeCluster(cx, cz, count = 10, spread = 6) {
  for (let i = 0; i < count; i++) {
    const r = Math.random() * spread;
    const theta = Math.random() * Math.PI * 2;
    const x = cx + r * Math.cos(theta);
    const z = cz + r * Math.sin(theta);
    createPhotorealisticTree(x, z, 0.8 + Math.random() * 0.6);
  }
}

// Northern treeline (behind machining & robot cell)
createTreeCluster(-40, -52, 12, 10);
createTreeCluster(-18, -55, 10, 8);
createTreeCluster(10, -52, 12, 10);
createTreeCluster(36, -48, 10, 8);

// Western landscape strip
createTreeCluster(-62, -10, 14, 9);
createTreeCluster(-68, 15, 12, 8);
createTreeCluster(-62, 38, 10, 7);

// Eastern side trees
createTreeCluster(60, -25, 10, 7);
createTreeCluster(58, 5, 8, 6);

// Southern landscape (entrance)
createTreeCluster(-50, -38, 10, 8);
createTreeCluster(48, -42, 8, 7);

// Parking lot trees
createPhotorealisticTree(-75, -22, 1.2);
createPhotorealisticTree(-68, -22, 1.1);
createPhotorealisticTree(-75, -14, 1.0);
createPhotorealisticTree(-68, -14, 1.15);

// Streetlights — high-pressure sodium (warm orange-amber glow)
const metalDarkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.25 });
const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xffcc44 });
function createStreetLight(x, z) {
  const poleGroup = new THREE.Group();
  poleGroup.position.set(x, 0, z);
  // Pole
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 6.5, 8), metalDarkMat);
  pole.position.y = 3.25;
  poleGroup.add(pole);
  // Arm
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.6), metalDarkMat);
  arm.position.set(0, 6.35, 0.8);
  poleGroup.add(arm);
  // Fixture housing
  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.28, 0.95), metalDarkMat);
  housing.position.set(0, 6.18, 1.6);
  poleGroup.add(housing);
  // Warm lamp glow
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.08, 0.75), lampGlowMat);
  lamp.position.set(0, 6.08, 1.6);
  poleGroup.add(lamp);
  // PointLight for ground spill
  const ptLight = new THREE.PointLight(0xff9933, 1.4, 14, 2.0);
  ptLight.position.set(x, 6.0, z);
  campusGroup.add(ptLight);
  campusGroup.add(poleGroup);
}

// Main road streetlights
createStreetLight(-8.0, -12.0);
createStreetLight(-8.0, 12.0);
createStreetLight(18.5, -12.0);
createStreetLight(18.5, 12.0);
createStreetLight(-8.0, -36.0);
createStreetLight(18.5, -36.0);
createStreetLight(-8.0, 36.0);
createStreetLight(18.5, 36.0);
// East road lights
createStreetLight(40, -12.0);
createStreetLight(40, 12.0);
// Parking lot lights
createStreetLight(-64, -20);
createStreetLight(-52, -20);
// Campus entrance
createStreetLight(-28, -55);
createStreetLight(8, -55);

// ─────────────────────────────────────────────────────────────────────────────
// 4. PLANTOPS CAMPUS — 8 DISTINCT INDUSTRIAL BUILDINGS
// ─────────────────────────────────────────────────────────────────────────────
const buildingMaterials = {
  machining: {
    // Dark charcoal-blue factory steel cladding
    wall: new THREE.MeshStandardMaterial({ color: 0x2c3e52, roughness: 0.62, metalness: 0.48 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x1a2535, roughness: 0.48, metalness: 0.58 }),
    accent: new THREE.MeshBasicMaterial({ color: 0x38bdf8 }),
    door: new THREE.MeshStandardMaterial({ color: 0x4a5a6e, roughness: 0.52, metalness: 0.55 }),
    windowGlow: new THREE.MeshBasicMaterial({ color: 0xffcc88 }),  // Warm amber window glow
  },
  robotics: {
    wall: new THREE.MeshStandardMaterial({ color: 0x2e4048, roughness: 0.58, metalness: 0.42 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x1a2830, roughness: 0.44, metalness: 0.58 }),
    accent: new THREE.MeshBasicMaterial({ color: 0x22d3ee }),
    door: new THREE.MeshStandardMaterial({ color: 0x4a5a6e, roughness: 0.45, metalness: 0.55 }),
    windowGlow: new THREE.MeshBasicMaterial({ color: 0xffd4a0 }),
  },
  processing: {
    wall: new THREE.MeshStandardMaterial({ color: 0x3d3e38, roughness: 0.65, metalness: 0.38 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x222420, roughness: 0.48, metalness: 0.52 }),
    accent: new THREE.MeshBasicMaterial({ color: 0xf59e0b }),
    door: new THREE.MeshStandardMaterial({ color: 0x5a5a50, roughness: 0.55, metalness: 0.5 }),
    windowGlow: new THREE.MeshBasicMaterial({ color: 0xffe4b0 }),
  },
  assembly: {
    // Hero building — slightly lighter to stand out
    wall: new THREE.MeshStandardMaterial({ color: 0x344a55, roughness: 0.58, metalness: 0.42 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x1c3040, roughness: 0.44, metalness: 0.55 }),
    accent: new THREE.MeshBasicMaterial({ color: 0x10b981 }),
    door: new THREE.MeshStandardMaterial({ color: 0x4a5a6e, roughness: 0.48, metalness: 0.52 }),
    windowGlow: new THREE.MeshBasicMaterial({ color: 0xffc87a }),
  },
  packaging: {
    wall: new THREE.MeshStandardMaterial({ color: 0x3a3830, roughness: 0.62, metalness: 0.36 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x201f1a, roughness: 0.48, metalness: 0.52 }),
    accent: new THREE.MeshBasicMaterial({ color: 0xfbbf24 }),
    door: new THREE.MeshStandardMaterial({ color: 0x5a5a50, roughness: 0.52, metalness: 0.5 }),
    windowGlow: new THREE.MeshBasicMaterial({ color: 0xffdc90 }),
  },
  maintenance: {
    wall: new THREE.MeshStandardMaterial({ color: 0x383640, roughness: 0.62, metalness: 0.38 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x1e1c24, roughness: 0.48, metalness: 0.55 }),
    accent: new THREE.MeshBasicMaterial({ color: 0xa78bfa }),
    door: new THREE.MeshStandardMaterial({ color: 0x525060, roughness: 0.52, metalness: 0.52 }),
    windowGlow: new THREE.MeshBasicMaterial({ color: 0xeeddff }),
  },
  utility: {
    wall: new THREE.MeshStandardMaterial({ color: 0x324048, roughness: 0.66, metalness: 0.42 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x1c2530, roughness: 0.45, metalness: 0.58 }),
    accent: new THREE.MeshBasicMaterial({ color: 0xc084fc }),
    door: new THREE.MeshStandardMaterial({ color: 0x525060, roughness: 0.55, metalness: 0.52 }),
    windowGlow: new THREE.MeshBasicMaterial({ color: 0xd8ccff }),
  },
  quality: {
    wall: new THREE.MeshStandardMaterial({ color: 0x384454, roughness: 0.54, metalness: 0.36 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x1c2430, roughness: 0.42, metalness: 0.5 }),
    accent: new THREE.MeshBasicMaterial({ color: 0xc084fc }),
    door: new THREE.MeshStandardMaterial({ color: 0x6a7a8a, roughness: 0.46, metalness: 0.45 }),
    windowGlow: new THREE.MeshBasicMaterial({ color: 0xccffee }),
  },
};

// Warm amber glow window material — MeshBasicMaterial for self-illumination
// (No lighting needed — emits its own warm golden light like interior lights seen from outside)
const windowGlowMat = new THREE.MeshBasicMaterial({ color: 0xffcc88 });
const windowFrameMat = new THREE.MeshStandardMaterial({ color: 0x1a2332, roughness: 0.55, metalness: 0.72 });
const windowMat = new THREE.MeshStandardMaterial({
  color: 0xffd580,
  emissive: new THREE.Color(0xffaa44),
  emissiveIntensity: 0.6,
  roughness: 0.12,
  metalness: 0.08,
  transparent: true,
  opacity: 0.90,
});
const frameMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5, metalness: 0.65 });
const concreteMat = new THREE.MeshStandardMaterial({ color: 0x2c3540, roughness: 0.88, metalness: 0.06 });
const safetyYellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.55, metalness: 0.18 });
const pipeMat = new THREE.MeshStandardMaterial({ color: 0x8a9cb0, roughness: 0.45, metalness: 0.75 });
const utilityPipeMat = new THREE.MeshStandardMaterial({ color: 0x5e7080, roughness: 0.48, metalness: 0.72 });

// Glowing signage panel — matches PLANTOPS brand (electric blue)
const signPanelMat = new THREE.MeshBasicMaterial({ color: 0x0ea5e9 });
const signTextMat = new THREE.MeshBasicMaterial({ color: 0xf0f9ff });


function addRoofEquipment(group, w, d, h, accent, { vents = 2, skylights = 0, pipe = false } = {}) {
  for (let i = 0; i < vents; i++) {
    const vent = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 1.6), frameMat);
    vent.position.set(-w * 0.28 + i * (w * 0.28), h + 0.48, -d * 0.08);
    vent.castShadow = true;
    group.add(vent);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 1.2), accent);
    cap.position.copy(vent.position).add(new THREE.Vector3(0, 0.42, 0));
    group.add(cap);
  }
  for (let i = 0; i < skylights; i++) {
    const skylight = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.14, 1.4), windowMat);
    skylight.position.set(-w * 0.3 + i * w * 0.3, h + 0.18, d * 0.12);
    group.add(skylight);
  }
  if (pipe) {
    const roofPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 4.2, 12), pipeMat);
    roofPipe.position.set(w * 0.28, h + 1.1, -d * 0.08);
    group.add(roofPipe);
    const pipeCap = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.08, 8, 20), accent);
    pipeCap.rotation.x = Math.PI / 2;
    pipeCap.position.set(roofPipe.position.x, h + 3.2, roofPipe.position.z);
    group.add(pipeCap);
  }
}

function addLoadingDoor(group, x, z, w = 5, h = 4, material = frameMat, accent = safetyYellowMat) {
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, h + 0.5, 0.28), material);
  frame.position.set(x, h / 2, z);
  group.add(frame);

  const door = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.18), new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.62,
    metalness: 0.38,
  }));
  door.position.set(x, h / 2, z + (z > 0 ? 0.16 : -0.16));
  group.add(door);

  const lintel = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18, 0.34), accent);
  lintel.position.set(x, h + 0.16, z);
  group.add(lintel);
}

function addBuildingWindows(group, w, d, h, floors = 1, glowMat = windowMat) {
  const rows = Math.max(1, floors);
  for (let r = 0; r < rows; r++) {
    const y = 2.5 + r * Math.max(2.8, (h - 3.2) / rows);
    const count = Math.max(2, Math.floor(w / 5.5));
    for (let i = 0; i < count; i++) {
      const x = -w / 2 + 2.8 + i * ((w - 5.5) / Math.max(1, count - 1));
      const winY = Math.min(y, h - 1.5);

      // Outer dark frame recess
      const frameRecess = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.55, 0.12), frameMat);
      frameRecess.position.set(x, winY, d / 2 + 0.04);
      group.add(frameRecess);

      // Inner warm glowing pane — MeshBasicMaterial for self-illumination
      const win = new THREE.Mesh(new THREE.BoxGeometry(3.1, 1.2, 0.06), glowMat);
      win.position.set(x, winY, d / 2 + 0.08);
      group.add(win);
    }

    // Side windows on left wall (perpendicular)
    const sideCount = Math.max(1, Math.floor(d / 8));
    for (let i = 0; i < sideCount; i++) {
      const zPos = -d / 2 + 4 + i * ((d - 8) / Math.max(1, sideCount - 1));
      const winY = Math.min(y, h - 1.5);

      const frameR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.55, 3.6), frameMat);
      frameR.position.set(w / 2 + 0.04, winY, zPos);
      group.add(frameR);

      const winR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.2, 3.1), glowMat);
      winR.position.set(w / 2 + 0.08, winY, zPos);
      group.add(winR);
    }
  }
}

function addServiceCanopy(group, x, z, w, d, h, accent) {
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w, 0.28, d), frameMat);
  roof.position.set(x, h, z);
  group.add(roof);
  const beam1 = new THREE.Mesh(new THREE.BoxGeometry(0.18, h, 0.18), frameMat);
  beam1.position.set(x - w / 2 + 0.2, h / 2, z - d / 2 + 0.2);
  const beam2 = beam1.clone();
  beam2.position.x = x + w / 2 - 0.2;
  const beam3 = beam1.clone();
  beam3.position.z = z + d / 2 - 0.2;
  const beam4 = beam2.clone();
  beam4.position.z = beam3.position.z;
  [beam1, beam2, beam3, beam4].forEach((b) => group.add(b));
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, 0.3, d)), accent);
  edge.position.set(x, h, z);
  group.add(edge);
}

function createIndustrialBuilding({
  key,
  title,
  w,
  h,
  d,
  x,
  z,
  floors = 1,
  doors = 1,
  windows = true,
  roof = {},
  service = false,
  processEquipment = false,
}) {
  const mats = buildingMaterials[key];
  const group = new THREE.Group();
  group.name = `building-${key}`;
  group.position.set(x, 0, z);
  group.userData = { cellKey: key, title, type: 'building' };

  // Concrete plinth / foundation
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 1.6, 0.65, d + 1.6), concreteMat);
  plinth.position.y = 0.32;
  plinth.receiveShadow = true;
  group.add(plinth);

  // Main building body — solid factory wall cladding
  const bodyGeom = new THREE.BoxGeometry(w, h, d);
  const body = new THREE.Mesh(bodyGeom, mats.wall);
  body.position.y = h / 2 + 0.65;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Roof overhang slab — dark parapet gives factory-hall silhouette
  const roofSlab = new THREE.Mesh(new THREE.BoxGeometry(w + 1.2, 0.52, d + 1.2), mats.roof);
  roofSlab.position.y = h + 0.91;
  roofSlab.castShadow = true;
  group.add(roofSlab);

  // Parapet wall lip (3D detail on top)
  const parapetFront = new THREE.Mesh(new THREE.BoxGeometry(w + 1.2, 0.8, 0.45), mats.roof);
  parapetFront.position.set(0, h + 1.55, d / 2 + 0.38);
  group.add(parapetFront);
  const parapetBack = parapetFront.clone();
  parapetBack.position.z = -d / 2 - 0.38;
  group.add(parapetBack);

  // Vertical corner pilasters — architectural detail that breaks up plain box
  const pilasterMat = new THREE.MeshStandardMaterial({ color: 0x1a2535, roughness: 0.62, metalness: 0.5 });
  for (const cx of [-w / 2 - 0.05, w / 2 + 0.05]) {
    const pilaster = new THREE.Mesh(new THREE.BoxGeometry(0.8, h + 0.65, 0.8), pilasterMat);
    pilaster.position.set(cx, h / 2 + 0.65, 0);
    pilaster.castShadow = true;
    group.add(pilaster);
  }
  // Mid-span pilasters for wider buildings
  if (w > 28) {
    const midPilaster = new THREE.Mesh(new THREE.BoxGeometry(0.55, h + 0.65, 0.55), pilasterMat);
    midPilaster.position.set(0, h / 2 + 0.65, d / 2 + 0.05);
    group.add(midPilaster);
    const midPilasterB = midPilaster.clone();
    midPilasterB.position.z = -d / 2 - 0.05;
    group.add(midPilasterB);
  }

  // Subtle accent edge stripe
  const accentRail = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w + 1.0, h + 0.22, d + 1.0)), mats.accent);
  accentRail.position.y = 0.7;
  accentRail.material.transparent = true;
  accentRail.material.opacity = 0.35;
  group.add(accentRail);

  // Horizontal accent band at top of wall (industrial cladding belt)
  const accentBand = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.35, d + 0.1), new THREE.MeshStandardMaterial({
    color: 0x1e3060,
    roughness: 0.5,
    metalness: 0.7,
  }));
  accentBand.position.y = h + 0.65 - 0.38;
  group.add(accentBand);

  // Glowing windows with warm amber pane — use per-building window glow color
  if (windows) addBuildingWindows(group, w, d, h, floors, mats.windowGlow || windowMat);

  // Loading doors on front facade
  const doorZ = d / 2 + 0.25;
  const doorPositions = doors === 1 ? [0] : Array.from({ length: doors }, (_, i) => -w * 0.28 + i * (w * 0.56 / Math.max(1, doors - 1)));
  doorPositions.forEach((dx) => addLoadingDoor(group, dx, doorZ, Math.min(5.4, w / doors - 1.2), Math.min(4.4, h * 0.52), frameMat, mats.accent));

  // Personnel door on back
  const personnelDoor = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.8, 0.18), mats.door);
  personnelDoor.position.set(-w / 2 + 1.6, 2.05, -doorZ);
  group.add(personnelDoor);

  // Glowing building name signage panel on front
  const signWidth = Math.min(w * 0.55, 12);
  const signPanel = new THREE.Mesh(new THREE.BoxGeometry(signWidth, 1.05, 0.14), signPanelMat);
  signPanel.position.set(0, h + 0.05, d / 2 + 0.4);
  group.add(signPanel);
  // Sign text face (lighter)
  const signFace = new THREE.Mesh(new THREE.BoxGeometry(signWidth - 0.6, 0.62, 0.08), signTextMat);
  signFace.position.set(0, h + 0.06, d / 2 + 0.48);
  group.add(signFace);

  // Rooftop equipment
  addRoofEquipment(group, w, d, h + 0.65, mats.accent, roof);

  // Service canopy (shipping/receiving area)
  if (service) {
    addServiceCanopy(group, w * 0.22, -d / 2 - 3.0, Math.min(10, w * 0.5), 6, 4.5, mats.accent);
    // Electrical cabinet by side wall
    const cabinet = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.6, 0.6), frameMat);
    cabinet.position.set(-w / 2 - 0.6, 1.6, 0);
    group.add(cabinet);
    // Yellow safety stripe on cabinet
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.2, 0.62), safetyYellowMat);
    stripe.position.set(-w / 2 - 0.6, 2.2, 0);
    group.add(stripe);
  }

  // External pipe rack for process buildings
  if (processEquipment) {
    const pipeRack = new THREE.Group();
    pipeRack.position.set(w / 2 + 2.2, 0, 0);
    const pipeColors = [0x8a9cb0, 0xef4444, 0xf59e0b];
    for (let i = 0; i < 3; i++) {
      const pipeMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18 + i * 0.04, 0.18 + i * 0.04, d * 0.85, 12),
        new THREE.MeshStandardMaterial({ color: pipeColors[i], roughness: 0.45, metalness: 0.75 })
      );
      pipeMesh.rotation.x = Math.PI / 2;
      pipeMesh.position.y = 2.5 + i * 0.85;
      pipeRack.add(pipeMesh);
    }
    for (const zz of [-d * 0.36, d * 0.36]) {
      const support = new THREE.Mesh(new THREE.BoxGeometry(0.28, 5.2, 0.28), frameMat);
      support.position.set(0, 2.6, zz);
      pipeRack.add(support);
    }
    // Horizontal pipe rack beam
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, d * 0.85), frameMat);
    beam.position.set(0, 5.5, 0);
    pipeRack.add(beam);
    group.add(pipeRack);
  }

  // Per-building warm ambient PointLight — spills warm amber onto surrounding ground
  // (Simulates light leaking out from interior through windows and doors)
  const buildingLight = new THREE.PointLight(0xff9933, 1.8, w * 2.5, 1.8);
  buildingLight.position.set(0, h * 0.5, d * 0.6);
  group.add(buildingLight);

  campusGroup.add(group);
  return group;
}

// 01 — Machining: high-bay CNC production hall.
createIndustrialBuilding({ key: 'machining', title: 'Machining Cell', w: 26, h: 9.5, d: 16, x: -29, z: -28, floors: 1, doors: 2, roof: { vents: 3, skylights: 2 } });

// 02 — Robot Cell: automation / routing hall with visible safety architecture.
createIndustrialBuilding({ key: 'robotics', title: 'Robot Cell', w: 22, h: 10, d: 14, x: 0, z: -30, floors: 1, doors: 2, roof: { vents: 2, skylights: 2 }, service: true });

// 03 — Processing: high-bay process hall with pipe rack and external process equipment.
createIndustrialBuilding({ key: 'processing', title: 'Processing Cell', w: 27, h: 10.5, d: 17, x: 31, z: -27, floors: 1, doors: 2, roof: { vents: 2, skylights: 1, pipe: true }, processEquipment: true });

// 04 — Assembly: largest production hall / hero building.
createIndustrialBuilding({ key: 'assembly', title: 'Assembly Hall', w: 38, h: 10, d: 21, x: 2, z: 2, floors: 1, doors: 3, roof: { vents: 3, skylights: 4 }, service: true });

// 05 — Packaging: long end-of-line packaging hall.
createIndustrialBuilding({ key: 'packaging', title: 'Packaging Hall', w: 31, h: 8.5, d: 15, x: 31, z: 8, floors: 1, doors: 3, roof: { vents: 3, skylights: 3 }, service: true });

// 06 — Maintenance: workshop rather than a production box.
createIndustrialBuilding({ key: 'maintenance', title: 'Maintenance & Repair Center', w: 20, h: 7.5, d: 14, x: -31, z: 9, floors: 1, doors: 2, roof: { vents: 2 }, service: true });

// 07 — Utility: control building plus outdoor tanks/cooling infrastructure.
createIndustrialBuilding({ key: 'utility', title: 'Utility Plant', w: 18, h: 7.5, d: 13, x: -29, z: 30, floors: 1, doors: 1, roof: { vents: 2, pipe: true }, processEquipment: true });

// 08 — Quality: smaller, cleaner laboratory building.
createIndustrialBuilding({ key: 'quality', title: 'Quality Lab & Test Center', w: 18, h: 6.8, d: 12, x: 0, z: 31, floors: 1, doors: 1, roof: { vents: 1, skylights: 2 } });

// Utility Plant external equipment: tanks, cooling towers and transformer.
function createUtilityTank(x, z, radius = 2.6, height = 7.5) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 20), pipeMat);
  tank.position.y = height / 2;
  tank.castShadow = true;
  group.add(tank);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), pipeMat);
  dome.position.y = height;
  group.add(dome);
  for (const y of [2.0, 4.5, 7.0]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius + 0.05, 0.07, 8, 20), safetyYellowMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    group.add(ring);
  }
  campusGroup.add(group);
}
createUtilityTank(-41, 25, 2.8, 8.5);
createUtilityTank(-34, 25, 2.4, 7.0);

function createCoolingTower(x, z, radiusBottom = 3.4, radiusTop = 2.4, height = 7.8) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const towerGeom = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 24);
  const tower = new THREE.Mesh(towerGeom, concreteMat);
  tower.position.y = height / 2;
  tower.castShadow = true;
  group.add(tower);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(radiusTop, 0.18, 8, 24), buildingMaterials.utility.accent);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = height;
  group.add(rim);
  campusGroup.add(group);
}
createCoolingTower(-41, 37, 3.5, 2.5, 8.5);
createCoolingTower(-33, 37, 3.1, 2.2, 7.5);

// Outdoor Material / Goods staging area — logistics zone, NOT a ninth building.
const goodsZone = new THREE.Group();
goodsZone.name = 'goods-shipping-zone';
goodsZone.position.set(31, 0, 28);
const goodsPad = new THREE.Mesh(new THREE.BoxGeometry(28, 0.22, 18), concreteMat);
goodsPad.position.y = 0.11;
goodsZone.add(goodsPad);
for (let row = 0; row < 2; row++) {
  for (let col = 0; col < 4; col++) {
    const pallet = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.18, 2.5), new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 }));
    pallet.position.set(-9 + col * 6, 0.2, -4 + row * 7);
    goodsZone.add(pallet);
    for (let i = 0; i < 2; i++) {
      const carton = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.0, 1.05), new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.82 }));
      carton.position.set(pallet.position.x - 0.55 + i * 1.15, 0.8, pallet.position.z);
      goodsZone.add(carton);
    }
  }
}
campusGroup.add(goodsZone);

// Finished-goods overhead crane: pallet/bulk lifting from staging to truck.
function createGoodsCrane() {
  const crane = new THREE.Group();
  crane.name = 'goods-loading-crane';
  crane.position.set(31, 0, 37);

  const rail1 = new THREE.Mesh(new THREE.BoxGeometry(26, 0.35, 0.35), frameMat);
  rail1.position.set(0, 7.5, -6);
  const rail2 = rail1.clone();
  rail2.position.z = 6;
  crane.add(rail1, rail2);

  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 12.5), frameMat);
  bridge.position.set(-6, 7.5, 0);
  crane.add(bridge);

  const hoist = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.7, 1.0), buildingMaterials.packaging.accent);
  hoist.position.set(-6, 7.0, 0);
  crane.add(hoist);

  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 4.0, 10), frameMat);
  cable.position.set(-6, 5.0, 0);
  crane.add(cable);

  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.08, 8, 16, Math.PI * 1.4), safetyYellowMat);
  hook.rotation.z = Math.PI;
  hook.position.set(-6, 3.0, 0);
  crane.add(hook);

  const spreader = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.18, 1.8), safetyYellowMat);
  spreader.position.set(-6, 2.8, 0);
  crane.add(spreader);
  campusGroup.add(crane);
}
createGoodsCrane();

// 8. White Trailer Cargo Trucks
function createWhiteTrailerTruck(x, z, rotY = 0) {
  const truck = new THREE.Group();
  truck.position.set(x, 0, z);
  truck.rotation.y = rotY;

  const trailer = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 2.4, 7.2),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3, metalness: 0.6 })
  );
  trailer.position.set(0, 1.6, 0);
  trailer.castShadow = true;
  truck.add(trailer);

  const trailerEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(2.2, 2.4, 7.2)),
    new THREE.LineBasicMaterial({ color: 0x94a3b8 })
  );
  trailerEdges.position.copy(trailer.position);
  truck.add(trailerEdges);

  const cab = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 1.9, 2.0),
    new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.2, metalness: 0.7 })
  );
  cab.position.set(0, 1.35, 4.6);
  cab.castShadow = true;
  truck.add(cab);

  campusGroup.add(truck);
}

createWhiteTrailerTruck(0, 16, Math.PI);
createWhiteTrailerTruck(-20, 14, Math.PI);
createWhiteTrailerTruck(-20, 24, Math.PI);
createWhiteTrailerTruck(46, 16, 0);   // Truck at packaging loading dock

// Parked cars in parking lot
function createParkedCar(x, z, rotY = 0, bodyColor = 0x1e3a5f) {
  const car = new THREE.Group();
  car.position.set(x, 0, z);
  car.rotation.y = rotY;

  // Car body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.85, 3.8),
    new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.3, metalness: 0.65 })
  );
  body.position.y = 0.6;
  car.add(body);

  // Car cabin top
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.65, 2.2),
    new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.28, metalness: 0.6 })
  );
  cabin.position.set(0, 1.3, -0.2);
  car.add(cabin);

  // Windshield (dark tinted)
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(1.42, 0.55, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x1a2a40, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.7 })
  );
  glass.position.set(0, 1.38, 0.88);
  car.add(glass);

  // Wheels
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  for (const [wx, wz] of [[-1.0, 1.3], [1.0, 1.3], [-1.0, -1.3], [1.0, -1.3]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.28, 14), wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.38, wz);
    car.add(wheel);
  }

  campusGroup.add(car);
}

// Cars in parking lot (southwest quadrant)
const carColors = [0x1e3a5f, 0x8b0000, 0x1a3a1a, 0x4a4028, 0x2d1854, 0x5a3018, 0x1a3550];
for (let i = 0; i < 6; i++) {
  createParkedCar(-72 + i * 4.8 + 2.4, -20, 0, carColors[i % carColors.length]);
}
// Second row
for (let i = 0; i < 5; i++) {
  createParkedCar(-70 + i * 4.8 + 2.4, -14, Math.PI, carColors[(i + 2) % carColors.length]);
}

// Yellow industrial forklift in goods staging area
function createForklift(x, z, rotY = 0) {
  const f = new THREE.Group();
  f.position.set(x, 0, z);
  f.rotation.y = rotY;

  const forkYellow = new THREE.MeshStandardMaterial({ color: 0xf5c518, roughness: 0.4, metalness: 0.3 });
  const forkDark = new THREE.MeshStandardMaterial({ color: 0x1e1e1e, roughness: 0.7 });

  // Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 2.6), forkYellow);
  body.position.y = 0.9;
  f.add(body);

  // Operator cage
  const cage = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 0.14), forkDark);
  cage.position.set(0, 2.1, -0.8);
  f.add(cage);

  // Mast
  const mast = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4.2, 0.2), forkDark);
  mast.position.set(0, 2.5, 1.25);
  f.add(mast);

  // Forks
  for (const fx of [-0.35, 0.35]) {
    const fork = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 1.8), forkDark);
    fork.position.set(fx, 0.35, 2.1);
    f.add(fork);
  }

  // Wheels
  const wMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  for (const [wx, wz] of [[-0.85, 0.9], [0.85, 0.9], [-0.85, -0.9], [0.85, -0.9]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.28, 12), wMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.32, wz);
    f.add(w);
  }

  campusGroup.add(f);
}

// Forklifts in goods area and near packaging
createForklift(24, 22, 0);
createForklift(38, 26, Math.PI / 2);

// ─────────────────────────────────────────────────────────────────────────────
// 5. BUILD INTERIOR WORKSTATION SCENES
// ─────────────────────────────────────────────────────────────────────────────
const interiorScenes = {
  robotics: buildRobotCellInterior(),
  machining: buildMachiningCellInterior(),
  processing: buildProcessingCellInterior(),
  assembly: buildAssemblyCellInterior(),
  packaging: buildPackagingCellInterior(),
  maintenance: buildMaintenanceBayInterior(),
  quality: buildQualityLabInterior(),
  utility: buildUtilityPlantInterior(),
};

Object.keys(interiorScenes).forEach((key) => {
  const sc = interiorScenes[key];
  sc.root.visible = false;
  interiorHolder.add(sc.root);
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. 3D PINNED BADGES & CELL METADATA — 8 BUILDINGS
// ─────────────────────────────────────────────────────────────────────────────
const CELL_METADATA = {
  machining: {
    title: 'MACHINING CELL',
    desc: 'CNC machining and precision metal fabrication',
    kpiUnits: '6 CNC Units', kpiUnitsLbl: 'RUNNING', kpiRate: '86 pcs/hr', kpiLines: '6 Spindles', kpiEff: '96%',
    purpose: 'Machine raw billets into precision components', input: 'Raw material / bar stock', output: 'Machined components → Assembly',
    equipment: '5-Axis CNC Mills, Tooling, Chip Conveyors, Coolant Systems, Overhead Crane', status: '● Running',
    camPos: new THREE.Vector3(44, 42, 44), camTarget: new THREE.Vector3(0, 2, 0), zoom: 2.25,
  },
  robotics: {
    title: 'ROBOT CELL',
    desc: 'Automated material handling • Pick • Identify • Route • Place',
    kpiUnits: '4 Robots', kpiUnitsLbl: 'RUNNING', kpiRate: '125 /hr', kpiLines: '3 Routing Lines', kpiEff: '98%',
    purpose: 'Identify finished products and route them to the correct packaging conveyor', input: 'Assembled products from Assembly', output: 'Packaging Lines A / B / C',
    equipment: '6-Axis Robots, Vision Scanner, EOAT, Infeed/Outfeed Conveyors, Safety Fence', status: '● Running',
    camPos: new THREE.Vector3(44, 42, 44), camTarget: new THREE.Vector3(0, 2, 0), zoom: 2.25,
  },
  processing: {
    title: 'PROCESSING CELL',
    desc: 'Fluid processing, pumping, mixing and hydraulic operations',
    kpiUnits: '5 Process Units', kpiUnitsLbl: 'ACTIVE', kpiRate: '420 L/min', kpiLines: '2 Header Racks', kpiEff: '95%',
    purpose: 'Mix, pump, pressurize and process production fluids', input: 'Raw process material', output: 'Processed material → downstream cells',
    equipment: 'Mixers, Pumps, Pressure Vessels, Hydraulic Press, Valves, Gauges, Pipe Rack', status: '● Running',
    camPos: new THREE.Vector3(44, 42, 44), camTarget: new THREE.Vector3(0, 2, 0), zoom: 2.25,
  },
  assembly: {
    title: 'ASSEMBLY HALL',
    desc: 'Synchronized multi-station assembly and inspection line',
    kpiUnits: '4 Stations', kpiUnitsLbl: 'SYNCHRONIZED', kpiRate: '140 pcs/hr', kpiLines: '1 Linear Trunk', kpiEff: '98%',
    purpose: 'Assemble components and perform in-line inspection', input: 'Machined / processed components', output: 'Completed products → Robot Cell',
    equipment: 'Transfer Conveyor, Assembly Stations, Cobots, Vision Inspection, Parts Bins', status: '● Running',
    camPos: new THREE.Vector3(48, 46, 48), camTarget: new THREE.Vector3(0, 2, 0), zoom: 2.05,
  },
  packaging: {
    title: 'PACKAGING HALL',
    desc: 'Automated packing, sealing, labeling and finished-carton release',
    kpiUnits: '4 Machines', kpiUnitsLbl: 'ACTIVE', kpiRate: '120 cartons/hr', kpiLines: '3 Lines', kpiEff: '97%',
    purpose: 'Pack, seal, label and scan routed products', input: 'Routed products from Robot Cell', output: 'Finished cartons → Goods Area',
    equipment: 'Packing Machines, Carton Sealer, Labeler, Scanner, Accumulation Conveyors', status: '● Running',
    camPos: new THREE.Vector3(44, 42, 44), camTarget: new THREE.Vector3(0, 2, 0), zoom: 2.25,
  },
  maintenance: {
    title: 'MAINTENANCE & REPAIR CENTER',
    desc: 'Power isolation, diagnostics, spare parts and equipment repair',
    kpiUnits: '3 Zones', kpiUnitsLbl: 'READY', kpiRate: '24/7 Support', kpiLines: 'LOTO / Repair', kpiEff: '99%',
    purpose: 'LOTO → inspect → allocate parts → repair → test → return to service', input: 'Maintenance work orders', output: 'Verified equipment → production',
    equipment: 'MCC, LOTO Station, Spare Racks, Workbenches, Test Bench, Diagnostic Screens', status: '● Ready',
    camPos: new THREE.Vector3(44, 42, 44), camTarget: new THREE.Vector3(0, 2, 0), zoom: 2.3,
  },
  quality: {
    title: 'QUALITY LAB & TEST CENTER',
    desc: 'Metrology, optical inspection and final quality verification',
    kpiUnits: '4 Test Zones', kpiUnitsLbl: 'ACTIVE', kpiRate: '0.002 mm', kpiLines: '2 Inspection', kpiEff: '99.4%',
    purpose: 'Verify dimensional, visual and functional quality', input: 'Samples from production', output: 'QA release / rejection decision',
    equipment: 'CMM Table, Optical Inspection, Measurement Benches, Test Fixtures, Sample Racks', status: '● Running',
    camPos: new THREE.Vector3(42, 40, 42), camTarget: new THREE.Vector3(0, 2, 0), zoom: 2.35,
  },
  utility: {
    title: 'UTILITY PLANT',
    desc: 'Plant power, compressed air, cooling and utility distribution',
    kpiUnits: '4 Utility Zones', kpiUnitsLbl: 'ONLINE', kpiRate: '6.2 bar', kpiLines: '480V / Air / Water', kpiEff: '99.8%',
    purpose: 'Provide reliable power, air and cooling infrastructure to production', input: 'Grid power / ambient air / return water', output: 'Plant utility headers',
    equipment: 'Switchgear, Transformers, Compressors, Storage Tanks, Pumps, Cooling Towers', status: '● Online',
    camPos: new THREE.Vector3(42, 40, 42), camTarget: new THREE.Vector3(0, 2, 0), zoom: 2.35,
  },
};

const pins = [
  { id: 'badge-machining', cellKey: 'machining', el: document.getElementById('badge-machining'), anchor3D: new THREE.Vector3(-29, 10, -28), badge3D: new THREE.Vector3(-29, 16, -28), color: '#f59e0b' },
  { id: 'badge-robotics', cellKey: 'robotics', el: document.getElementById('badge-robotics'), anchor3D: new THREE.Vector3(0, 10.5, -30), badge3D: new THREE.Vector3(0, 17, -30), color: '#00f5ff' },
  { id: 'badge-processing', cellKey: 'processing', el: document.getElementById('badge-processing'), anchor3D: new THREE.Vector3(31, 11, -27), badge3D: new THREE.Vector3(31, 17.5, -27), color: '#10b981' },
  { id: 'badge-assembly', cellKey: 'assembly', el: document.getElementById('badge-assembly'), anchor3D: new THREE.Vector3(2, 10.5, 2), badge3D: new THREE.Vector3(2, 17, 2), color: '#10ff88' },
  { id: 'badge-packaging', cellKey: 'packaging', el: document.getElementById('badge-packaging'), anchor3D: new THREE.Vector3(31, 9, 8), badge3D: new THREE.Vector3(31, 15, 8), color: '#fbbf24' },
  { id: 'badge-maintenance', cellKey: 'maintenance', el: document.getElementById('badge-maintenance'), anchor3D: new THREE.Vector3(-31, 8, 9), badge3D: new THREE.Vector3(-31, 14, 9), color: '#a78bfa' },
  { id: 'badge-quality', cellKey: 'quality', el: document.getElementById('badge-quality'), anchor3D: new THREE.Vector3(0, 7.5, 31), badge3D: new THREE.Vector3(0, 13.5, 31), color: '#c084fc' },
  { id: 'badge-utility', cellKey: 'utility', el: document.getElementById('badge-utility'), anchor3D: new THREE.Vector3(-29, 8.5, 30), badge3D: new THREE.Vector3(-29, 14.5, 30), color: '#c084fc' },
];

// ─────────────────────────────────────────────────────────────────────────────
// 7. SMOOTH CAMERA TWEEN & NAVIGATION ENGINE (WITH DYNAMIC ZOOM)
// ─────────────────────────────────────────────────────────────────────────────
let currentCell = 'overview';
let isTransitioning = false;
const cameraStartPos = new THREE.Vector3();
const cameraEndPos = new THREE.Vector3();
const targetStart = new THREE.Vector3();
const targetEnd = new THREE.Vector3();
let cameraStartZoom = 1.0;
let cameraEndZoom = 1.0;
let transitionProgress = 1.0;

const btnExit = document.getElementById('btn-exit-building');
const cellHeaderHud = document.getElementById('cell-header-hud');
const cellInfoCard = document.getElementById('cell-info-card');
const bottomNav = document.getElementById('bottom-machine-nav');
const telemetryDrawer = document.getElementById('telemetry-drawer');
const drawerCloseBtn = document.getElementById('drawer-close-btn');

function enterBuilding(cellKey) {
  if (cellKey === 'overview' || !CELL_METADATA[cellKey]) {
    exitBuilding();
    return;
  }

  currentCell = cellKey;
  const meta = CELL_METADATA[cellKey];

  document.querySelectorAll('.nav-tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.cell === cellKey);
  });

  btnExit.classList.add('visible');

  // Fill Header HUD
  document.getElementById('hud-cell-name').innerText = meta.title;
  document.getElementById('hud-cell-desc').innerText = meta.desc;
  document.getElementById('kpi-units-val').innerText = meta.kpiUnits;
  document.getElementById('kpi-units-lbl').innerText = meta.kpiUnitsLbl;
  document.getElementById('kpi-rate-val').innerText = meta.kpiRate;
  document.getElementById('kpi-lines-val').innerText = meta.kpiLines;
  document.getElementById('kpi-eff-val').innerText = meta.kpiEff;
  cellHeaderHud.classList.add('visible');

  // Fill Cell Information Card
  document.getElementById('info-purpose').innerText = meta.purpose;
  document.getElementById('info-input').innerText = meta.input;
  document.getElementById('info-output').innerText = meta.output;
  document.getElementById('info-equip').innerText = meta.equipment;
  document.getElementById('info-status').innerText = meta.status;
  cellInfoCard.classList.add('visible');

  // Build Bottom Machine Switcher Buttons
  bottomNav.innerHTML = '';
  const overviewBtn = document.createElement('button');
  overviewBtn.className = 'm-tab-btn active';
  overviewBtn.innerText = 'Overview';
  overviewBtn.onclick = () => {
    document.querySelectorAll('.m-tab-btn').forEach((b) => b.classList.remove('active'));
    overviewBtn.classList.add('active');
    startCameraTransition(meta.camPos, meta.camTarget, meta.zoom || 2.35);
  };
  bottomNav.appendChild(overviewBtn);

  const activeInterior = interiorScenes[cellKey];
  if (activeInterior && activeInterior.interactiveObjects) {
    activeInterior.interactiveObjects.forEach((obj, idx) => {
      const btn = document.createElement('button');
      btn.className = 'm-tab-btn';
      btn.innerText = obj.userData?.id || `Unit 0${idx + 1}`;
      btn.onclick = () => {
        document.querySelectorAll('.m-tab-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        focusMachine(obj);
      };
      bottomNav.appendChild(btn);
    });
  }
  bottomNav.classList.add('visible');

  // Switch Scene Visibility
  campusGroup.visible = false;
  svgOverlay.style.opacity = '0';
  interiorHolder.visible = true;
  Object.keys(interiorScenes).forEach((k) => {
    interiorScenes[k].root.visible = k === cellKey;
  });

  // Start Camera Flight with Zoom to fill the screen
  startCameraTransition(meta.camPos, meta.camTarget, meta.zoom || 2.35);
}

function exitBuilding() {
  currentCell = 'overview';

  document.querySelectorAll('.nav-tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.cell === 'overview');
  });

  btnExit.classList.remove('visible');
  cellHeaderHud.classList.remove('visible');
  cellInfoCard.classList.remove('visible');
  bottomNav.classList.remove('visible');
  telemetryDrawer.classList.remove('visible');

  campusGroup.visible = true;
  svgOverlay.style.opacity = '1';
  interiorHolder.visible = false;
  Object.keys(interiorScenes).forEach((k) => {
    interiorScenes[k].root.visible = false;
  });

  startCameraTransition(CAMPUS_CAM_POS, CAMPUS_CAM_TARGET, 1.0);
}

function focusMachine(obj) {
  if (!obj) return;
  const worldPos = new THREE.Vector3();
  obj.getWorldPosition(worldPos);

  const focusCamPos = worldPos.clone().add(new THREE.Vector3(16, 20, 16));
  startCameraTransition(focusCamPos, worldPos, 3.2);

  document.getElementById('drawer-m-name').innerText = obj.userData?.id || 'EQUIPMENT UNIT';
  document.getElementById('drawer-m-type').innerText = obj.userData?.name || 'Automated Industrial Machinery';

  const gVib = document.getElementById('g-vib');
  const gTemp = document.getElementById('g-temp');
  const gCurr = document.getElementById('g-curr');
  const gHealth = document.getElementById('g-health');

  if (obj.userData?.flow) {
    if (gVib) gVib.innerText = obj.userData.flow;
    if (gTemp) gTemp.innerText = obj.userData.press || '180 Bar';
    if (gCurr) gCurr.innerText = obj.userData.power || '45 kW';
    if (gHealth) gHealth.innerText = `${obj.userData.health || 97}%`;
  } else if (obj.userData?.force) {
    if (gVib) gVib.innerText = obj.userData.force;
    if (gTemp) gTemp.innerText = obj.userData.cycle || '32 SPM';
    if (gCurr) gCurr.innerText = obj.userData.stroke || '450 mm';
    if (gHealth) gHealth.innerText = `${obj.userData.health || 96}%`;
  } else if (obj.userData?.rpm) {
    if (gVib) gVib.innerText = obj.userData.rpm;
    if (gTemp) gTemp.innerText = obj.userData.feed || obj.userData.temp || '24 m/min';
    if (gCurr) gCurr.innerText = obj.userData.toolLife || obj.userData.press || '94%';
    if (gHealth) gHealth.innerText = `${obj.userData.health || 98}%`;
  } else {
    if (gVib) gVib.innerText = '1.2 mm/s';
    if (gTemp) gTemp.innerText = '48.2 °C';
    if (gCurr) gCurr.innerText = '8.4 A';
    if (gHealth) gHealth.innerText = `${obj.userData?.health || 98}%`;
  }

  telemetryDrawer.classList.add('visible');
}

function startCameraTransition(endPos, endTarget, endZoom = 1.0) {
  cameraStartPos.copy(camera.position);
  cameraEndPos.copy(endPos);
  targetStart.copy(controls.target);
  targetEnd.copy(endTarget);
  cameraStartZoom = camera.zoom;
  cameraEndZoom = endZoom;
  transitionProgress = 0;
  isTransitioning = true;
}

document.querySelectorAll('.nav-tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.cell;
    if (key === 'overview') exitBuilding();
    else enterBuilding(key);
  });
});

btnExit.addEventListener('click', exitBuilding);
drawerCloseBtn.addEventListener('click', () => telemetryDrawer.classList.remove('visible'));

pins.forEach((pin) => {
  if (pin.el) {
    pin.el.addEventListener('click', () => {
      enterBuilding(pin.cellKey);
    });
  }
});

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('click', (event) => {
  if (currentCell === 'overview' || isTransitioning) return;
  if (event.target.closest('#top-nav') || event.target.closest('#cell-header-hud') ||
      event.target.closest('#bottom-machine-nav') || event.target.closest('#telemetry-drawer') ||
      event.target.closest('#cell-info-card')) {
    return;
  }

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const activeInterior = interiorScenes[currentCell];
  if (activeInterior && activeInterior.interactiveObjects) {
    const intersects = raycaster.intersectObjects(activeInterior.interactiveObjects, true);
    if (intersects.length > 0) {
      let topGrp = intersects[0].object;
      while (topGrp.parent && !activeInterior.interactiveObjects.includes(topGrp)) {
        topGrp = topGrp.parent;
      }
      focusMachine(topGrp);
    }
  }
});

function toScreenXY(pos3D) {
  const v = pos3D.clone().project(camera);
  return {
    x: (v.x * 0.5 + 0.5) * window.innerWidth,
    y: (-(v.y * 0.5) + 0.5) * window.innerHeight,
  };
}

function updatePinsAndLeaderLines() {
  if (currentCell !== 'overview') {
    pins.forEach((pin) => {
      if (pin.el) pin.el.style.display = 'none';
    });
    svgOverlay.innerHTML = '';
    return;
  }

  let svgPaths = '';

  pins.forEach((pin) => {
    if (!pin.el) return;
    pin.el.style.display = 'flex';
    const anchor2D = toScreenXY(pin.anchor3D);
    const badge2D = toScreenXY(pin.badge3D);

    pin.el.style.left = `${badge2D.x}px`;
    pin.el.style.top = `${badge2D.y}px`;

    if (pin.id !== 'badge-assembly') {
      const midX = anchor2D.x;
      const midY = badge2D.y + 12;

      svgPaths += `
        <circle cx="${anchor2D.x}" cy="${anchor2D.y}" r="3.5" fill="${pin.color}" />
        <polyline points="${anchor2D.x},${anchor2D.y} ${midX},${midY} ${badge2D.x},${badge2D.y + 12}" 
                  fill="none" stroke="${pin.color}" stroke-width="1.5" stroke-opacity="0.85" />
      `;
    }
  });

  svgOverlay.innerHTML = svgPaths;
}

window.addEventListener('resize', () => {
  const newAspect = window.innerWidth / window.innerHeight;
  camera.left = (-frustumSize * newAspect) / 2;
  camera.right = (frustumSize * newAspect) / 2;
  camera.top = frustumSize / 2;
  camera.bottom = -frustumSize / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function updateClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const clockEl = document.getElementById('live-clock');
  if (clockEl) clockEl.innerText = timeStr;
}
setInterval(updateClock, 1000);
updateClock();

// ─────────────────────────────────────────────────────────────────────────────
// 8. ANIMATION LOOP
// ─────────────────────────────────────────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  const time = clock.getElapsedTime();

  // Smooth Camera & Zoom Transition Handling
  if (isTransitioning) {
    transitionProgress += delta * 1.8;
    if (transitionProgress >= 1.0) {
      transitionProgress = 1.0;
      isTransitioning = false;
    }
    const t = 0.5 - 0.5 * Math.cos(transitionProgress * Math.PI); // Smooth easeInOut
    camera.position.lerpVectors(cameraStartPos, cameraEndPos, t);
    controls.target.lerpVectors(targetStart, targetEnd, t);
    camera.zoom = THREE.MathUtils.lerp(cameraStartZoom, cameraEndZoom, t);
    camera.updateProjectionMatrix();
  }

  // Animate Robot Arms in Robotics Interior
  if (interiorScenes.robotics && interiorScenes.robotics.animatedRobots) {
    interiorScenes.robotics.animatedRobots.forEach((r) => {
      const angle = Math.sin(time * 1.5 + r.basePhase) * 0.45;
      r.j1.rotation.y = angle;
      r.arm1.rotation.x = 0.3 + Math.sin(time * 2.0 + r.basePhase) * 0.2;
      r.arm2.rotation.x = -0.7 - Math.cos(time * 2.0 + r.basePhase) * 0.2;
    });
  }

  // Animate Conveyor Boxes in Robotics Interior
  if (interiorScenes.robotics && interiorScenes.robotics.animatedConveyors) {
    interiorScenes.robotics.animatedConveyors.forEach((c) => {
      c.boxes.forEach((b) => {
        b.box.position.z += c.speed;
        if (b.box.position.z > b.maxZ) {
          b.box.position.z = b.minZ;
        }
      });
    });
  }

  // Animate Assembly Cell Cobot Arm (Pick and place motions)
  if (interiorScenes.assembly && interiorScenes.assembly.animatedCobots) {
    interiorScenes.assembly.animatedCobots.forEach((cobot) => {
      const cycle = time * 1.8;
      const angle = Math.sin(cycle) * 0.6;
      cobot.cJ1.rotation.y = angle;
      cobot.cArm1.rotation.x = 0.4 + Math.sin(cycle * 2.0) * 0.15;
      cobot.cArm2.rotation.x = -0.85 - Math.cos(cycle * 2.0) * 0.18;
      if (cobot.heldPart) {
        cobot.heldPart.position.y = 1.8 + Math.sin(cycle * 2.0) * 0.1;
      }
    });
  }

  // Animate Assembly Cell Conveyor Moving Pallets
  if (interiorScenes.assembly && interiorScenes.assembly.animatedPallets) {
    interiorScenes.assembly.animatedPallets.forEach((p) => {
      p.pallet.position.z += 0.045;
      if (p.pallet.position.z > p.maxZ) {
        p.pallet.position.z = p.minZ;
      }
    });
  }

  // Animate CNC Spindles in Machining Interior
  if (interiorScenes.machining && interiorScenes.machining.cncSpindles) {
    interiorScenes.machining.cncSpindles.forEach((s) => {
      s.rotation.y += 0.15;
    });
  }

  // Animate Reaction Vessel Agitators in Processing Interior
  if (interiorScenes.processing && interiorScenes.processing.animatedMixers) {
    interiorScenes.processing.animatedMixers.forEach((m) => {
      m.rotation.y += 0.08;
    });
  }

  // Animate Hydraulic Stamping Press in Processing Interior
  if (interiorScenes.processing && interiorScenes.processing.animatedPress) {
    interiorScenes.processing.animatedPress.forEach((bolster) => {
      bolster.position.y = 4.8 + Math.sin(time * 2.2) * 0.7;
    });
  }

  // Animate Assembly Cell Rotary Indexing Tables
  if (interiorScenes.assembly && interiorScenes.assembly.animatedRotaries) {
    interiorScenes.assembly.animatedRotaries.forEach((r) => {
      r.rotation.y += 0.02;
    });
  }

  // Animate Assembly Cell Delta Robot
  if (interiorScenes.assembly && interiorScenes.assembly.animatedDeltas) {
    interiorScenes.assembly.animatedDeltas.forEach((d) => {
      d.position.y = 2.4 + Math.sin(time * 3.5) * 0.4;
      d.position.x = Math.cos(time * 3.5) * 0.3;
    });
  }

  controls.update();
  updatePinsAndLeaderLines();
  renderer.render(scene, camera);
}

animate();