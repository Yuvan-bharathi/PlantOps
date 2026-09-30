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

// Rich twilight indigo-blue background & atmospheric fog
scene.background = new THREE.Color(0x071126);
scene.fog = new THREE.FogExp2(0x071126, 0.0028);

const aspect = window.innerWidth / window.innerHeight;
const frustumSize = 132;

const camera = new THREE.OrthographicCamera(
  (frustumSize * aspect) / -2,
  (frustumSize * aspect) / 2,
  frustumSize / 2,
  frustumSize / -2,
  -500,
  1000
);

// High isometric angle
const CAMPUS_CAM_POS = new THREE.Vector3(112, 126, 118);
const CAMPUS_CAM_TARGET = new THREE.Vector3(8, 0, 5);
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
renderer.toneMappingExposure = 1.0;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI / 2 - 0.05;
controls.minZoom = 0.5;
controls.maxZoom = 5.0;
controls.target.copy(CAMPUS_CAM_TARGET);

// ─────────────────────────────────────────────────────────────────────────────
// 2. SCENE GROUPS & BALANCED UNIFORM LIGHTING RIGS
// ─────────────────────────────────────────────────────────────────────────────
const campusGroup = new THREE.Group();
campusGroup.name = 'campus-exterior';
scene.add(campusGroup);

const interiorHolder = new THREE.Group();
interiorHolder.name = 'interior-holder';
interiorHolder.visible = false;
scene.add(interiorHolder);

// Global Campus Lighting (Consistent color temperature & ambient bounce)
const campusHemi = new THREE.HemisphereLight(0xdce7ff, 0x182236, 1.4);
campusGroup.add(campusHemi);

const ambientLight = new THREE.AmbientLight(0x2d3a60, 1.6);
campusGroup.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.6);
dirLight.position.set(70, 120, 50);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 10;
dirLight.shadow.camera.far = 350;
dirLight.shadow.camera.left = -75;
dirLight.shadow.camera.right = 75;
dirLight.shadow.camera.top = 75;
dirLight.shadow.camera.bottom = -75;
dirLight.shadow.bias = -0.0003;
campusGroup.add(dirLight);

const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.9);
fillLight.position.set(-70, 60, -70);
campusGroup.add(fillLight);

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
// 3. CAMPUS GROUND, ROADS, INFRASTRUCTURE & TREES (EXACT ORIGINAL LAYOUT)
// ─────────────────────────────────────────────────────────────────────────────
const groundGeom = new THREE.PlaneGeometry(340, 340);
const groundMat = new THREE.MeshStandardMaterial({
  color: 0x0a1024,
  roughness: 0.88,
  metalness: 0.15,
});
const ground = new THREE.Mesh(groundGeom, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
campusGroup.add(ground);

const gridHelper = new THREE.GridHelper(260, 52, 0x1d284b, 0x131c38);
gridHelper.position.y = 0.02;
campusGroup.add(gridHelper);

// Roads
const roadMat = new THREE.MeshStandardMaterial({ color: 0x0f172e, roughness: 0.95 });
function createRoad(x, z, w, d) {
  const road = new THREE.Mesh(new THREE.PlaneGeometry(w, d), roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.set(x, 0.03, z);
  road.receiveShadow = true;
  campusGroup.add(road);
}
createRoad(0, 0, 250, 11);
createRoad(0, 25, 250, 9);
createRoad(-48, 0, 10, 170);
createRoad(48, 0, 10, 170);
createRoad(0, -47, 210, 8);
createRoad(-5, 55, 150, 8);
createRoad(-28, -18, 54, 7);
createRoad(2, -18, 46, 7);
createRoad(31, -15, 46, 7);
createRoad(-30, 18, 48, 7);
createRoad(28, 18, 54, 7);

// Road Markings
function createRoadMarkings() {
  const dashMat = new THREE.LineDashedMaterial({
    color: 0x38bdf8,
    dashSize: 1.8,
    gapSize: 1.4,
    linewidth: 1.5,
    transparent: true,
    opacity: 0.7,
  });

  const hGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-100, 0.04, 0),
    new THREE.Vector3(100, 0.04, 0),
  ]);
  const hLine = new THREE.Line(hGeom, dashMat);
  hLine.computeLineDistances();
  campusGroup.add(hLine);

  const vGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-18, 0.04, -80),
    new THREE.Vector3(-18, 0.04, 80),
  ]);
  const vLine = new THREE.Line(vGeom, dashMat);
  vLine.computeLineDistances();
  campusGroup.add(vLine);
}
createRoadMarkings();

// Tree Clusters
const treeMat = new THREE.MeshStandardMaterial({
  color: 0x142b36,
  roughness: 0.9,
  metalness: 0.1,
  flatShading: true,
});

function createTreeCluster(cx, cz, count = 10, spread = 6) {
  const group = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const r = Math.random() * spread;
    const theta = Math.random() * Math.PI * 2;
    const x = cx + r * Math.cos(theta);
    const z = cz + r * Math.sin(theta);
    const scale = 1.4 + Math.random() * 1.6;

    const foliage = new THREE.Mesh(new THREE.DodecahedronGeometry(scale, 1), treeMat);
    foliage.position.set(x, scale * 0.9, z);
    foliage.castShadow = true;
    group.add(foliage);
  }
  campusGroup.add(group);
}

createTreeCluster(-34, -36, 14, 8);
createTreeCluster(-10, -48, 16, 9);
createTreeCluster(24, -38, 14, 8);
createTreeCluster(-42, 28, 14, 8);
createTreeCluster(42, -18, 16, 8);
createTreeCluster(38, 8, 16, 9);

// Streetlights
const metalDarkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.25 });
function createStreetLight(x, z) {
  const poleGroup = new THREE.Group();
  poleGroup.position.set(x, 0, z);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 4.5, 8), metalDarkMat);
  pole.position.y = 2.25;
  poleGroup.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.8), metalDarkMat);
  arm.position.set(0, 4.4, 0.4);
  poleGroup.add(arm);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffea88 }));
  lamp.position.set(0, 4.35, 0.8);
  poleGroup.add(lamp);
  campusGroup.add(poleGroup);
}
createStreetLight(-8.0, -11.0);
createStreetLight(-8.0, 11.0);
createStreetLight(18.5, -11.0);
createStreetLight(18.5, 11.0);

// ─────────────────────────────────────────────────────────────────────────────
// 4. PLANTOPS CAMPUS — 8 DISTINCT INDUSTRIAL BUILDINGS
// ─────────────────────────────────────────────────────────────────────────────
const buildingMaterials = {
  machining: {
    wall: new THREE.MeshStandardMaterial({ color: 0x536779, roughness: 0.58, metalness: 0.42 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x1d3042, roughness: 0.42, metalness: 0.58 }),
    accent: new THREE.MeshBasicMaterial({ color: 0x38bdf8 }),
    door: new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.45, metalness: 0.55 }),
  },
  robotics: {
    wall: new THREE.MeshStandardMaterial({ color: 0x4f6970, roughness: 0.55, metalness: 0.4 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x1c343b, roughness: 0.4, metalness: 0.55 }),
    accent: new THREE.MeshBasicMaterial({ color: 0x22d3ee }),
    door: new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.4, metalness: 0.55 }),
  },
  processing: {
    wall: new THREE.MeshStandardMaterial({ color: 0x665f52, roughness: 0.62, metalness: 0.38 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x2e302c, roughness: 0.44, metalness: 0.55 }),
    accent: new THREE.MeshBasicMaterial({ color: 0xf59e0b }),
    door: new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.5, metalness: 0.5 }),
  },
  assembly: {
    wall: new THREE.MeshStandardMaterial({ color: 0x536b72, roughness: 0.56, metalness: 0.4 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x203640, roughness: 0.42, metalness: 0.58 }),
    accent: new THREE.MeshBasicMaterial({ color: 0x10b981 }),
    door: new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.44, metalness: 0.52 }),
  },
  packaging: {
    wall: new THREE.MeshStandardMaterial({ color: 0x655e53, roughness: 0.6, metalness: 0.35 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x302d28, roughness: 0.45, metalness: 0.52 }),
    accent: new THREE.MeshBasicMaterial({ color: 0xfbbf24 }),
    door: new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.48, metalness: 0.5 }),
  },
  maintenance: {
    wall: new THREE.MeshStandardMaterial({ color: 0x5a5964, roughness: 0.6, metalness: 0.38 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x2d2c35, roughness: 0.44, metalness: 0.55 }),
    accent: new THREE.MeshBasicMaterial({ color: 0xa78bfa }),
    door: new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.48, metalness: 0.52 }),
  },
  utility: {
    wall: new THREE.MeshStandardMaterial({ color: 0x53606d, roughness: 0.64, metalness: 0.4 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x29323d, roughness: 0.42, metalness: 0.58 }),
    accent: new THREE.MeshBasicMaterial({ color: 0xc084fc }),
    door: new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.5, metalness: 0.52 }),
  },
  quality: {
    wall: new THREE.MeshStandardMaterial({ color: 0x5b6872, roughness: 0.52, metalness: 0.34 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x2a3540, roughness: 0.4, metalness: 0.5 }),
    accent: new THREE.MeshBasicMaterial({ color: 0xc084fc }),
    door: new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.42, metalness: 0.45 }),
  },
};

const windowMat = new THREE.MeshStandardMaterial({
  color: 0x9bd8ff,
  roughness: 0.16,
  metalness: 0.18,
  transparent: true,
  opacity: 0.62,
});
const frameMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5, metalness: 0.65 });
const concreteMat = new THREE.MeshStandardMaterial({ color: 0x39424b, roughness: 0.9, metalness: 0.05 });
const safetyYellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.55, metalness: 0.18 });
const pipeMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.42, metalness: 0.72 });
const utilityPipeMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.45, metalness: 0.72 });
const conveyorGreenBeltMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.85, metalness: 0.05 });
const conveyorRollerMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.35, metalness: 0.8 });

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

function addBuildingWindows(group, w, d, h, floors = 1, material = windowMat) {
  const warmWindowMat = new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.9 });

  const addFront = (back = false) => {
    const z = back ? -d / 2 - 0.055 : d / 2 + 0.055;
    const rows = Math.max(1, floors);
    for (let r = 0; r < rows; r++) {
      const y = 2.25 + r * Math.max(2.8, (h - 3.5) / rows);
      const count = Math.max(3, Math.floor(w / 4.5));
      for (let i = 0; i < count; i++) {
        const x = -w / 2 + 2.2 + i * ((w - 4.4) / Math.max(1, count - 1));
        const win = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.45, 0.12), warmWindowMat);
        win.position.set(x, Math.min(y, h - 1.2), z);
        group.add(win);
        const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(2.95, 1.55, 0.14)), frameMat);
        frame.position.copy(win.position);
        group.add(frame);
      }
    }
  };

  const addSide = (right = false) => {
    const x = right ? w / 2 + 0.055 : -w / 2 - 0.055;
    const rows = Math.max(1, floors);
    for (let r = 0; r < rows; r++) {
      const y = 2.3 + r * Math.max(2.8, (h - 3.5) / rows);
      const count = Math.max(2, Math.floor(d / 5));
      for (let i = 0; i < count; i++) {
        const z = -d / 2 + 2.5 + i * ((d - 5) / Math.max(1, count - 1));
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.4, 2.6), warmWindowMat);
        win.position.set(x, Math.min(y, h - 1.2), z);
        group.add(win);
      }
    }
  };

  addFront(false); addFront(true); addSide(false); addSide(true);
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

function addFacadePilasters(group, w, d, h, accent) {
  const pilasterMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.55, roughness: 0.45 });
  const count = Math.max(3, Math.floor(w / 7));
  for (let i = 0; i < count; i++) {
    const x = -w / 2 + i * (w / Math.max(1, count - 1));
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.22, h + 0.2, 0.22), pilasterMat);
    p.position.set(x, h / 2 + 0.6, d / 2 + 0.12);
    group.add(p);
  }
  const fascia = new THREE.Mesh(new THREE.BoxGeometry(w, 0.24, 0.24), accent);
  fascia.position.set(0, h - 0.2, d / 2 + 0.16);
  group.add(fascia);
}

function addExteriorACUnits(group, w, d, h, count = 2) {
  for (let i = 0; i < count; i++) {
    const ac = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 1.4), frameMat);
    ac.position.set(-w * 0.32 + i * w * 0.32, h + 1.0, d * 0.15);
    group.add(ac);
  }
}

function addGlassHeroFacade(group, w, d, h, accentColor = 0x10ff88) {
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x0f2a34, transparent: true, opacity: 0.48,
    roughness: 0.18, metalness: 0.18, transmission: 0.18
  });
  const front = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, h * 0.78, 0.12), glass);
  front.position.set(0, h * 0.48 + 0.55, d / 2 + 0.11);
  group.add(front);
  const glow = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(w * 0.94, h * 0.8, 0.18)),
    new THREE.LineBasicMaterial({ color: accentColor, transparent: true, opacity: 0.9 })
  );
  glow.position.copy(front.position);
  group.add(glow);
  for (let y = 2.2; y < h - 1; y += 2.3) {
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.86, 0.06, 0.06),
      new THREE.MeshBasicMaterial({ color: accentColor, transparent: true, opacity: 0.7 })
    );
    band.position.set(0, y, d / 2 + 0.2);
    group.add(band);
  }
}

function addParkingLot(x, z, w, d, rows = 2) {
  const lot = new THREE.Group();
  const pad = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d),
    new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.92 }));
  pad.position.set(x, 0.04, z);
  lot.add(pad);
  const stripeMat = new THREE.LineBasicMaterial({ color: 0xcbd5e1, transparent: true, opacity: 0.75 });
  for (let r = 0; r < rows; r++) {
    const zz = z - d / 2 + 2.5 + r * (d - 5) / Math.max(1, rows - 1);
    for (let c = 0; c <= 8; c++) {
      const xx = x - w / 2 + c * w / 8;
      const geom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(xx, 0.09, zz - 2), new THREE.Vector3(xx, 0.09, zz + 2)
      ]);
      lot.add(new THREE.Line(geom, stripeMat));
    }
  }
  const carColors = [0x2563eb, 0x0f766e, 0x64748b, 0xd97706];
  for (let i = 0; i < 8; i++) {
    const car = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.65, 3.1),
      new THREE.MeshStandardMaterial({ color: carColors[i % carColors.length], metalness: 0.35, roughness: 0.45 }));
    const row = i < 4 ? 0 : 1, col = i % 4;
    car.position.set(x - w * 0.36 + col * (w * 0.24), 0.42, z - 2 + row * 4);
    lot.add(car);
  }
  campusGroup.add(lot);
}

function addMainGate() {
  const gate = new THREE.Group();
  gate.name = 'main-gate';
  gate.position.set(-72, 0, 55);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.35 });
  [-7, 7].forEach((x) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.7, 5.5, 0.7), postMat);
    post.position.set(x, 2.75, 0);
    gate.add(post);
  });
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(15, 0.7, 1.2), frameMat);
  canopy.position.y = 5.2;
  gate.add(canopy);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(10, 1.6, 0.18), new THREE.MeshBasicMaterial({ color: 0x0b1b31 }));
  sign.position.set(0, 4.15, -0.5);
  gate.add(sign);
  const signGlow = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(10.1, 1.7, 0.2)), new THREE.LineBasicMaterial({ color: 0x38bdf8 }));
  signGlow.position.copy(sign.position);
  gate.add(signGlow);
  const booth = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.4, 2.6), new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.55, metalness: 0.25 }));
  booth.position.set(10, 1.2, 0);
  gate.add(booth);
  campusGroup.add(gate);
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

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 1.2, 0.55, d + 1.2), concreteMat);
  plinth.position.y = 0.28;
  plinth.receiveShadow = true;
  group.add(plinth);

  const bodyGeom = new THREE.BoxGeometry(w, h, d);
  const body = new THREE.Mesh(bodyGeom, mats.wall);
  body.position.y = h / 2 + 0.55;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Roof overhang + parapet create a factory-hall silhouette instead of a plain box.
  const roofSlab = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.42, d + 0.8), mats.roof);
  roofSlab.position.y = h + 0.76;
  roofSlab.castShadow = true;
  group.add(roofSlab);

  const accentRail = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w + 0.86, h + 0.12, d + 0.86)), mats.accent);
  accentRail.position.y = 0.6;
  accentRail.material.transparent = true;
  accentRail.material.opacity = 0.42;
  group.add(accentRail);

  if (windows) addBuildingWindows(group, w, d, h, floors);

  const doorZ = d / 2 + 0.18;
  const doorPositions = doors === 1 ? [0] : Array.from({ length: doors }, (_, i) => -w * 0.28 + i * (w * 0.56));
  doorPositions.forEach((dx) => addLoadingDoor(group, dx, doorZ, Math.min(5.4, w / doors - 1), Math.min(4.2, h * 0.55), frameMat, mats.accent));

  const personnelDoor = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.6, 0.16), mats.door);
  personnelDoor.position.set(-w / 2 + 1.4, 1.85, -doorZ);
  group.add(personnelDoor);

  addRoofEquipment(group, w, d, h + 0.55, mats.accent, roof);

  if (service) {
    addServiceCanopy(group, w * 0.2, -d / 2 - 2.8, Math.min(9, w * 0.5), 5, 4.2, mats.accent);
    const cabinet = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, 0.55), frameMat);
    cabinet.position.set(-w / 2 - 0.5, 1.4, 0);
    group.add(cabinet);
  }

  if (processEquipment) {
    const pipeRack = new THREE.Group();
    pipeRack.position.set(w / 2 + 2.0, 0, 0);
    for (let i = 0; i < 3; i++) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.16 + i * 0.04, 0.16 + i * 0.04, d * 0.9, 12), utilityPipeMat);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.y = 2.2 + i * 0.7;
      pipeRack.add(pipe);
    }
    for (const zz of [-d * 0.38, d * 0.38]) {
      const support = new THREE.Mesh(new THREE.BoxGeometry(0.25, 4.8, 0.25), frameMat);
      support.position.set(0, 2.4, zz);
      pipeRack.add(support);
    }
    group.add(pipeRack);
  }

  addFacadePilasters(group, w, d, h, mats.accent);
  addExteriorACUnits(group, w, d, h, Math.max(1, Math.floor(w / 16)));

  campusGroup.add(group);
  return group;
}

// 01 — Machining: high-bay CNC production hall.
createIndustrialBuilding({ key: 'machining', title: 'Machining Cell', w: 38, h: 11, d: 24, x: -42, z: -25, floors: 2, doors: 3, roof: { vents: 4, skylights: 3 }, service: true });

// 02 — Robot: automation/routing hall with visible safety architecture.
createIndustrialBuilding({ key: 'robotics', title: 'Robot Cell', w: 34, h: 12, d: 23, x: 0, z: -28, floors: 2, doors: 3, roof: { vents: 3, skylights: 3 }, service: true });

// 03 — Processing: process hall with visible pipe rack and utility equipment.
createIndustrialBuilding({ key: 'processing', title: 'Processing Cell', w: 38, h: 12, d: 25, x: 42, z: -25, floors: 2, doors: 3, roof: { vents: 3, skylights: 2, pipe: true }, processEquipment: true });

// 04 — Assembly: central hero building with transparent/neon production facade.
const assemblyBuilding = createIndustrialBuilding({ key: 'assembly', title: 'Assembly Hall', w: 48, h: 13, d: 28, x: 0, z: 4, floors: 2, doors: 4, roof: { vents: 4, skylights: 5 }, service: true });
addGlassHeroFacade(assemblyBuilding, 48, 28, 13, 0x10ff88);

// 05 — Packaging: end-of-line packaging hall.
createIndustrialBuilding({ key: 'packaging', title: 'Packaging Hall', w: 38, h: 10, d: 23, x: 42, z: 15, floors: 2, doors: 3, roof: { vents: 3, skylights: 3 }, service: true });

// 06 — Maintenance: workshop with service yard.
createIndustrialBuilding({ key: 'maintenance', title: 'Maintenance & Repair Center', w: 29, h: 9, d: 21, x: -42, z: 17, floors: 1, doors: 3, roof: { vents: 2 }, service: true });

// 07 — Utility: control building + outdoor process infrastructure.
createIndustrialBuilding({ key: 'utility', title: 'Utility Plant', w: 27, h: 9, d: 19, x: 10, z: 35, floors: 1, doors: 2, roof: { vents: 2, pipe: true }, processEquipment: true });

// 08 — Quality: clean laboratory / test center.
createIndustrialBuilding({ key: 'quality', title: 'Quality Lab & Test Center', w: 30, h: 8, d: 19, x: -22, z: 36, floors: 2, doors: 2, roof: { vents: 1, skylights: 3 } });

addParkingLot(-66, 26, 26, 18, 2);
addParkingLot(-8, 52, 28, 16, 2);
addMainGate();

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
createUtilityTank(28, 35, 3.4, 10.5);
createUtilityTank(38, 35, 2.8, 8.5);

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
createCoolingTower(28, 48, 4.2, 3.0, 10.0);
createCoolingTower(39, 48, 3.6, 2.5, 9.0);

// Outdoor finished-goods logistics: packaging -> outbound conveyor -> staging -> crane -> trailers.
const goodsZone = new THREE.Group();
goodsZone.name = 'goods-shipping-zone';
goodsZone.position.set(67, 0, 15);

const goodsPad = new THREE.Mesh(
  new THREE.BoxGeometry(40, 0.22, 32),
  new THREE.MeshStandardMaterial({ color: 0x172033, roughness: 0.9, metalness: 0.08 })
);
goodsPad.position.y = 0.11;
goodsZone.add(goodsPad);

const laneMat = new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.8 });
for (let i = -15; i <= 15; i += 10) {
  const geom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(i, 0.14, -14), new THREE.Vector3(i, 0.14, 14)
  ]);
  goodsZone.add(new THREE.Line(geom, laneMat));
}
for (let row = 0; row < 3; row++) {
  for (let col = 0; col < 4; col++) {
    const pallet = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.22, 3.4),
      new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.82 }));
    pallet.position.set(-14 + col * 9, 0.25, -9 + row * 8);
    goodsZone.add(pallet);
    for (let i = 0; i < 3; i++) {
      const carton = new THREE.Mesh(new THREE.BoxGeometry(1.55, 1.15, 1.3),
        new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.8 }));
      carton.position.set(pallet.position.x - 1.6 + i * 1.6, 0.92, pallet.position.z);
      goodsZone.add(carton);
    }
  }
}
campusGroup.add(goodsZone);

// Conveyor leaving Packaging toward finished-goods yard.
const outbound = new THREE.Group();
outbound.name = 'packaging-outbound-conveyor';
outbound.position.set(55, 0, 15);
const outboundBelt = new THREE.Mesh(new THREE.BoxGeometry(18, 0.25, 2.8), conveyorGreenBeltMat);
outboundBelt.position.set(0, 1.25, 0);
outbound.add(outboundBelt);
for (let x = -8; x <= 8; x += 2) {
  const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.6, 12), conveyorRollerMat);
  roller.rotation.z = Math.PI / 2;
  roller.position.set(x, 1.43, 0);
  outbound.add(roller);
}
campusGroup.add(outbound);

function createGoodsCrane() {
  const crane = new THREE.Group();
  crane.name = 'goods-loading-crane';
  crane.position.set(67, 0, 15);
  const craneMat = new THREE.MeshStandardMaterial({ color: 0xd99a06, metalness: 0.55, roughness: 0.4 });

  [-15, 15].forEach((x) => [-12, 12].forEach((z) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 8, 0.5), craneMat);
    leg.position.set(x, 4, z);
    crane.add(leg);
  }));
  const topA = new THREE.Mesh(new THREE.BoxGeometry(31, 0.55, 0.55), craneMat);
  topA.position.set(0, 8, -12);
  const topB = topA.clone(); topB.position.z = 12;
  crane.add(topA, topB);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 25), craneMat);
  bridge.position.set(0, 8, 0);
  crane.add(bridge);

  const hoist = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 1.4), buildingMaterials.packaging.accent);
  hoist.position.set(0, 7.35, 0);
  crane.add(hoist);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 4.2, 10), frameMat);
  cable.position.set(0, 5.15, 0);
  crane.add(cable);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.08, 8, 16, Math.PI * 1.4), safetyYellowMat);
  hook.rotation.z = Math.PI; hook.position.set(0, 3.0, 0); crane.add(hook);
  const spreader = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.18, 2.1), safetyYellowMat);
  spreader.position.set(0, 2.8, 0); crane.add(spreader);
  campusGroup.add(crane);
}
createGoodsCrane();

function createWhiteTrailerTruck(x, z, rotY = 0, color = 0x2563eb) {
  const truck = new THREE.Group();
  truck.position.set(x, 0, z);
  truck.rotation.y = rotY;
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0b1220, roughness: 0.8 });
  const trailer = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.2, 11),
    new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.34, metalness: 0.45 }));
  trailer.position.set(0, 2.0, 0); truck.add(trailer);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(3.3, 2.7, 3.0),
    new THREE.MeshStandardMaterial({ color, roughness: 0.28, metalness: 0.55 }));
  cab.position.set(0, 1.6, 7.0); truck.add(cab);
  [-1.15, 1.15].forEach((xw) => [-3.5, 0, 3.5, 7.0].forEach((zw) => {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.45, 16), wheelMat);
    wheel.rotation.z = Math.PI / 2; wheel.position.set(xw, 0.65, zw); truck.add(wheel);
  }));
  campusGroup.add(truck);
}
createWhiteTrailerTruck(91, 4, Math.PI / 2, 0x2563eb);
createWhiteTrailerTruck(91, 16, Math.PI / 2, 0x0f766e);
createWhiteTrailerTruck(91, 28, Math.PI / 2, 0xd97706);

function addCampusGlowLights() {
  [
    [-42, 7, -37, 0xffc76a], [0, 8, -40, 0x38bdf8], [42, 8, -38, 0x10b981],
    [-42, 6, 30, 0xc084fc], [0, 9, 18, 0x10ff88], [42, 6, 28, 0xfbbf24]
  ].forEach(([x,y,z,color]) => {
    const light = new THREE.PointLight(color, 2.4, 28, 2);
    light.position.set(x,y,z);
    campusGroup.add(light);
  });
}
addCampusGlowLights();

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

function fitCellCamera(cellKey) {
  const active = interiorScenes[cellKey];
  const meta = CELL_METADATA[cellKey];
  if (!active || !active.root || !meta) return;

  const box = new THREE.Box3().setFromObject(active.root);
  if (box.isEmpty()) {
    startCameraTransition(meta.camPos, meta.camTarget, meta.zoom || 2.3);
    return;
  }

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  // Preserve each cell's industrial isometric direction while fitting the
  // actual room/equipment bounds. This prevents the "small room with empty
  // space around it" problem across all 8 interiors.
  const direction = meta.camPos.clone().normalize();
  const distance = Math.max(70, maxDim * 1.55);
  const endPos = center.clone().add(direction.multiplyScalar(distance));

  // Orthographic camera: zoom is based on the content height with a tight
  // 12% margin, keeping roughly 80–90% of the viewport occupied.
  const fitZoom = THREE.MathUtils.clamp(132 / (maxDim * 1.12), 1.15, 3.25);
  startCameraTransition(endPos, center, fitZoom);
}

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
    fitCellCamera(cellKey);
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
  fitCellCamera(cellKey);
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