import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  buildRobotCellInterior,
  buildMachiningCellInterior,
  buildProcessingCellInterior,
  buildAssemblyCellInterior,
  buildPackagingCellInterior,
  buildMaintenanceBayInterior,
  buildGenericFacilityInterior,
} from './interiors.js';

// ─────────────────────────────────────────────────────────────────────────────
// 1. VIEWPORT, RENDERER & CAMERA
// ─────────────────────────────────────────────────────────────────────────────
const container = document.getElementById('canvas-container');
const svgOverlay = document.getElementById('leader-lines-svg');

const scene = new THREE.Scene();

// Rich twilight indigo-blue background & atmospheric fog
scene.background = new THREE.Color(0x0e1530);
scene.fog = new THREE.FogExp2(0x0e1530, 0.0042);

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
const groundGeom = new THREE.PlaneGeometry(280, 280);
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
createRoad(0, 0, 220, 10);
createRoad(0, 22, 220, 8);
createRoad(-18, 0, 10, 180);
createRoad(28, 0, 10, 180);

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

// Materials for Solid Buildings
const wallMatLight = new THREE.MeshStandardMaterial({ color: 0x142143, roughness: 0.45, metalness: 0.55 });
const wallMatDark = new THREE.MeshStandardMaterial({ color: 0x0b1328, roughness: 0.5, metalness: 0.65 });
const trimEdgeMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6 });
const warmWindowMat = new THREE.MeshBasicMaterial({ color: 0xffea79 });
const windowFrameMat = new THREE.MeshStandardMaterial({ color: 0x080f20, roughness: 0.4 });
const roofMatBlue = new THREE.MeshStandardMaterial({ color: 0x1d3663, roughness: 0.35, metalness: 0.6 });

function createSolidBuilding({ w, h, d, x, z, floors = 2, roofDetails = true }) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const bodyGeom = new THREE.BoxGeometry(w, h, d);
  const body = new THREE.Mesh(bodyGeom, wallMatLight);
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(bodyGeom), trimEdgeMat);
  edges.position.y = h / 2;
  group.add(edges);

  const parapetGeom = new THREE.BoxGeometry(w + 0.3, 0.45, d + 0.3);
  const parapet = new THREE.Mesh(parapetGeom, wallMatDark);
  parapet.position.y = h + 0.225;
  parapet.castShadow = true;
  group.add(parapet);

  const floorHeight = h / (floors + 0.4);
  for (let f = 0; f < floors; f++) {
    const yPos = 1.1 + f * floorHeight;

    const winFront = new THREE.Mesh(new THREE.BoxGeometry(w * 0.86, 0.6, 0.1), warmWindowMat);
    winFront.position.set(0, yPos, d / 2 + 0.05);
    group.add(winFront);

    const frameFront = new THREE.Mesh(new THREE.BoxGeometry(w * 0.88, 0.78, 0.08), windowFrameMat);
    frameFront.position.set(0, yPos, d / 2 + 0.03);
    group.add(frameFront);

    const winLeft = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, d * 0.75), warmWindowMat);
    winLeft.position.set(-w / 2 - 0.05, yPos, 0);
    group.add(winLeft);

    const winRight = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, d * 0.75), warmWindowMat);
    winRight.position.set(w / 2 + 0.05, yPos, 0);
    group.add(winRight);
  }

  if (roofDetails) {
    const hvacGeom = new THREE.BoxGeometry(w * 0.36, 1.2, d * 0.32);
    const hvac = new THREE.Mesh(hvacGeom, wallMatDark);
    hvac.position.set(-w * 0.15, h + 0.8, -d * 0.1);
    hvac.castShadow = true;
    group.add(hvac);

    const hvacEdge = new THREE.LineSegments(new THREE.EdgesGeometry(hvacGeom), trimEdgeMat);
    hvacEdge.position.copy(hvac.position);
    group.add(hvacEdge);

    const pipeGeom = new THREE.CylinderGeometry(0.25, 0.25, d * 0.45, 8);
    const pipe = new THREE.Mesh(pipeGeom, wallMatLight);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(w * 0.22, h + 0.45, 0);
    group.add(pipe);
  }

  campusGroup.add(group);
  return group;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. CAMPUS BUILDINGS (ALL 10 SECTIONS / FACILITIES)
// ─────────────────────────────────────────────────────────────────────────────
// 1. Machining Cell (North-West)
createSolidBuilding({ w: 22, h: 8.5, d: 13, x: -22, z: -26, floors: 3, roofDetails: true });

// 2. Robot Cell (North-Central)
createSolidBuilding({ w: 18, h: 7.2, d: 10, x: -3, z: -38, floors: 2, roofDetails: true });
createSolidBuilding({ w: 16, h: 6.8, d: 10, x: -26, z: -38, floors: 2, roofDetails: true });

// 3. Processing Cell (North-East)
createSolidBuilding({ w: 22, h: 9.2, d: 14, x: 12, z: -26, floors: 3, roofDetails: true });

// 4. Quality Lab (Mid-Left)
createSolidBuilding({ w: 21, h: 7.2, d: 13, x: -24, z: -4, floors: 2 });

for (let i = 0; i < 3; i++) {
  const boxGeom = new THREE.BoxGeometry(2.0, 2.2, 2.6);
  const box = new THREE.Mesh(boxGeom, new THREE.MeshStandardMaterial({ color: 0x1e3a8a, metalness: 0.8, roughness: 0.2 }));
  box.position.set(-37, 1.1, -8 + i * 3.5);
  box.castShadow = true;
  campusGroup.add(box);
}

// 5. Hero Assembly Hall (Translucent Hologram Center)
const assemblyGroup = new THREE.Group();
assemblyGroup.position.set(2, 0, 4);

function createGroundEnergyRings() {
  const glowColors = [0x10ff88, 0x00f5ff, 0x10ff88, 0x00f5ff];
  const ringOffsets = [
    { w: 37, d: 27, y: 0.04, opacity: 0.95 },
    { w: 39, d: 29, y: 0.035, opacity: 0.7 },
    { w: 41, d: 31, y: 0.03, opacity: 0.45 },
    { w: 43, d: 33, y: 0.025, opacity: 0.25 },
  ];

  ringOffsets.forEach((r, idx) => {
    const geom = new THREE.PlaneGeometry(r.w, r.d);
    const line = new THREE.LineSegments(
      new THREE.EdgesGeometry(geom),
      new THREE.LineBasicMaterial({
        color: glowColors[idx % glowColors.length],
        transparent: true,
        opacity: r.opacity,
        linewidth: 2,
      })
    );
    line.rotation.x = -Math.PI / 2;
    line.position.y = r.y;
    assemblyGroup.add(line);
  });
}
createGroundEnergyRings();

const holoBodyMat = new THREE.MeshStandardMaterial({
  color: 0x063d36,
  roughness: 0.1,
  metalness: 0.85,
  transparent: true,
  opacity: 0.82,
});
const holoEdgeGreen = new THREE.LineBasicMaterial({ color: 0x10ff88, linewidth: 2 });
const holoEdgeCyan = new THREE.LineBasicMaterial({ color: 0x00f5ff, linewidth: 2 });

function addHoloBlock(w, h, d, ox, oy, oz, edgeColor = 'green') {
  const geom = new THREE.BoxGeometry(w, h, d);
  const body = new THREE.Mesh(geom, holoBodyMat);
  body.position.set(ox, oy + h / 2, oz);
  assemblyGroup.add(body);

  const edgeMat = edgeColor === 'green' ? holoEdgeGreen : holoEdgeCyan;
  const wire = new THREE.LineSegments(new THREE.EdgesGeometry(geom), edgeMat);
  wire.position.copy(body.position);
  assemblyGroup.add(wire);
}
addHoloBlock(28, 9.6, 13, 0, 0, -3.5, 'green');
addHoloBlock(24, 5.8, 8, -1.2, 0, 7.0, 'cyan');
addHoloBlock(7, 6.8, 11, -13.5, 0, 1.5, 'green');
addHoloBlock(8.5, 1.6, 5.5, 2, 9.6, -4.5, 'cyan');
addHoloBlock(5.5, 1.4, 4.5, -6.5, 9.6, -2.5, 'cyan');

const entrance = new THREE.Mesh(
  new THREE.BoxGeometry(6, 3.2, 2.5),
  new THREE.MeshBasicMaterial({ color: 0x00f5ff, transparent: true, opacity: 0.9 })
);
entrance.position.set(-1.2, 1.6, 11.2);
assemblyGroup.add(entrance);
campusGroup.add(assemblyGroup);

// 6. Material Hub (Silos + Stacked Containers)
const materialHubGroup = new THREE.Group();
materialHubGroup.position.set(26, 0, -12);

const siloMat = new THREE.MeshStandardMaterial({ color: 0x3d5684, roughness: 0.25, metalness: 0.8 });
const siloCapMat = new THREE.MeshStandardMaterial({ color: 0x4f6c9e, roughness: 0.3, metalness: 0.75 });
const siloNeonRing = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 });

for (let i = 0; i < 2; i++) {
  const siloGroup = new THREE.Group();
  siloGroup.position.set(i * 7.0, 0, 0);

  const silo = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 10.5, 24), siloMat);
  silo.position.y = 5.25;
  silo.castShadow = true;
  silo.receiveShadow = true;
  siloGroup.add(silo);

  const dome = new THREE.Mesh(new THREE.SphereGeometry(2.8, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), siloCapMat);
  dome.position.y = 10.5;
  siloGroup.add(dome);

  [3, 6, 9].forEach((yRing) => {
    const ring = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.CylinderGeometry(2.85, 2.85, 0.15, 24)),
      siloNeonRing
    );
    ring.position.y = yRing;
    siloGroup.add(ring);
  });

  materialHubGroup.add(siloGroup);
}
campusGroup.add(materialHubGroup);

const containerColors = [0x2563eb, 0xf97316, 0xdc2626, 0x059669, 0x475569];
for (let row = 0; row < 2; row++) {
  for (let col = 0; col < 5; col++) {
    const colorIdx = (row * 3 + col) % containerColors.length;
    const cMesh = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 2.2, 5.4),
      new THREE.MeshStandardMaterial({ color: containerColors[colorIdx], roughness: 0.4, metalness: 0.5 })
    );
    cMesh.position.set(20 + col * 2.6, 1.1 + row * 2.25, 4 + row * 0.2);
    cMesh.castShadow = true;
    cMesh.receiveShadow = true;
    campusGroup.add(cMesh);

    const cEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(2.2, 2.2, 5.4)),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 })
    );
    cEdges.position.copy(cMesh.position);
    campusGroup.add(cEdges);
  }
}

// 7. Utility Plant & Cooling Facility
createSolidBuilding({ w: 16, h: 7.2, d: 11, x: -28, z: 14, floors: 2, roofDetails: true });

createSolidBuilding({ w: 18, h: 5.6, d: 11, x: -28, z: 29, floors: 1, roofDetails: false });

const roofVent = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.4, 20), metalDarkMat);
roofVent.position.set(-28 + 3, 5.8, 29);
campusGroup.add(roofVent);

const ventRim = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.CylinderGeometry(1.62, 1.62, 0.1, 20)),
  new THREE.LineBasicMaterial({ color: 0xc084fc, linewidth: 2 })
);
ventRim.position.copy(roofVent.position);
campusGroup.add(ventRim);

function createCoolingTower(x, z, radiusBottom = 3.4, radiusTop = 2.4, height = 7.8) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const towerGeom = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 24);
  const tower = new THREE.Mesh(towerGeom, wallMatLight);
  tower.position.y = height / 2;
  tower.castShadow = true;
  tower.receiveShadow = true;
  group.add(tower);

  const towerEdges = new THREE.LineSegments(new THREE.EdgesGeometry(towerGeom), trimEdgeMat);
  towerEdges.position.y = height / 2;
  group.add(towerEdges);

  const topRim = new THREE.Mesh(
    new THREE.TorusGeometry(radiusTop, 0.18, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xc084fc })
  );
  topRim.rotation.x = Math.PI / 2;
  topRim.position.y = height;
  group.add(topRim);

  campusGroup.add(group);
}
createCoolingTower(-38, 26, 3.4, 2.4, 7.8);
createCoolingTower(-38, 35, 3.4, 2.4, 7.8);

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
  quality: buildGenericFacilityInterior('quality', 'Quality Metrology Lab'),
  utility: buildGenericFacilityInterior('utility', 'Main Power & Pneumatic Utility'),
  cooling: buildGenericFacilityInterior('cooling', 'Cooling Loop & Chiller Plant'),
  material: buildGenericFacilityInterior('material', 'Material Silos & Dispensing Hub'),
};

Object.keys(interiorScenes).forEach((key) => {
  const sc = interiorScenes[key];
  sc.root.visible = false;
  interiorHolder.add(sc.root);
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. 3D PINNED BADGES & CELL METADATA
// ─────────────────────────────────────────────────────────────────────────────
const CELL_METADATA = {
  robotics: {
    title: 'ROBOT CELL',
    desc: 'Automated Material Handling • Pick • Identify • Route',
    kpiUnits: '4 Units',
    kpiUnitsLbl: 'RUNNING',
    kpiRate: '125 /hr',
    kpiLines: '3 Lines',
    kpiEff: '98%',
    purpose: 'Pick finished goods, identify SKU, route lines',
    input: 'From Assembly Cell',
    output: 'To Packaging Cell (Lines A, B, C)',
    equipment: '4 x 6-Axis Robot Arms, Vision System, Conveyors, Safety Fencing',
    status: '● Running',
    camPos: new THREE.Vector3(45, 52, 45),
    camTarget: new THREE.Vector3(0, 2, 0),
    zoom: 2.35,
  },
  machining: {
    title: 'MACHINING CELL',
    desc: 'CNC Machining & Precision Metal Fabrication',
    kpiUnits: '6 Units',
    kpiUnitsLbl: 'RUNNING',
    kpiRate: '86 pcs/hr',
    kpiLines: '6 CNC Spindles',
    kpiEff: '96%',
    purpose: '5-Axis milling, precision turning, and surface facing',
    input: 'Raw Billet & Bar Stock from Material Hub',
    output: 'Machined Parts to Assembly Cell',
    equipment: '6x 5-Axis CNC Mills, Overhead Crane Gantry, Tool Cabinets, Chip Conveyors',
    status: '● Running',
    camPos: new THREE.Vector3(45, 52, 45),
    camTarget: new THREE.Vector3(0, 2, 0),
    zoom: 2.35,
  },
  processing: {
    title: 'PROCESSING CELL',
    desc: 'High-Shear Chemical Mixing, Coolant Pumping & Stamping Press',
    kpiUnits: '5 Units',
    kpiUnitsLbl: 'ACTIVE',
    kpiRate: '420 L/min',
    kpiLines: '2 Header Racks',
    kpiEff: '95%',
    purpose: 'Fluid mixing, hydraulic pressure stamping, and coolant filtration',
    input: 'Chemical Concentrates & Raw Coolants',
    output: 'Pressurized Coolant & Formed Stampings',
    equipment: 'Mixing Vessels, Coolant Pumps, Stamping Press, Catwalk Platform',
    status: '● Running',
    camPos: new THREE.Vector3(45, 52, 45),
    camTarget: new THREE.Vector3(0, 2, 0),
    zoom: 2.35,
  },
  assembly: {
    title: 'ASSEMBLY CELL',
    desc: 'Multi-Station Indexing Transfer Line & Sub-Assembly Workbenches',
    kpiUnits: '4 Stations',
    kpiUnitsLbl: 'SYNCHRONIZED',
    kpiRate: '140 pcs/hr',
    kpiLines: '1 Linear Trunk',
    kpiEff: '98%',
    purpose: 'Sub-assembly, precision screwdriving, and optical inspection',
    input: 'Components from Machining & Quality Lab',
    output: 'Assembled Units to Robot Cell',
    equipment: 'Dual-Lane Conveyor, Torque Stations, Parts Bins, Delta Robots',
    status: '● Running',
    camPos: new THREE.Vector3(45, 52, 45),
    camTarget: new THREE.Vector3(0, 2, 0),
    zoom: 2.35,
  },
  quality: {
    title: 'QUALITY LAB',
    desc: 'Precision Metrology, CMM Diagnostics & Optical Profilometry',
    kpiUnits: '1 Lab',
    kpiUnitsLbl: 'ACTIVE',
    kpiRate: '0.002mm Tol.',
    kpiLines: '2 Inspection',
    kpiEff: '99.4%',
    purpose: 'Sample verification, CMM coordinate measuring, and surface defect analysis',
    input: 'Batch samples from Machining & Assembly',
    output: 'QA Certifications',
    equipment: 'CMM Granite Table, Optical Surface Profiler, Cleanroom Bench',
    status: '● Running',
    camPos: new THREE.Vector3(45, 52, 45),
    camTarget: new THREE.Vector3(0, 2, 0),
    zoom: 2.35,
  },
  utility: {
    title: 'UTILITY PLANT',
    desc: '480V/230V Power Transformers & High-Pressure Pneumatic Air Compressors',
    kpiUnits: '2 Banks',
    kpiUnitsLbl: 'ONLINE',
    kpiRate: '6.2 Bar Air',
    kpiLines: '480V 3-Phase',
    kpiEff: '99.8%',
    purpose: 'Continuous plant power regulation and compressed pneumatic air supply',
    input: 'Grid High Voltage & Ambient Air',
    output: 'Factory 480V bus & 6.0 bar pneumatic header',
    equipment: 'Transformers, Switchgear, Air Compressors, Storage Vessels',
    status: '● Online',
    camPos: new THREE.Vector3(45, 52, 45),
    camTarget: new THREE.Vector3(0, 2, 0),
    zoom: 2.35,
  },
  cooling: {
    title: 'COOLING TOWER',
    desc: 'Closed-Loop Chilled Water Circulation & Rooftop Heat Dissipation',
    kpiUnits: '1 Plant',
    kpiUnitsLbl: 'RUNNING',
    kpiRate: '14.2°C Supply',
    kpiLines: '2 Loops',
    kpiEff: '97.5%',
    purpose: 'CNC spindle and hydraulic fluid temperature thermal regulation',
    input: 'Warm return coolant lines',
    output: 'Chilled fluid circulation lines',
    equipment: 'Cooling Fans, Chiller Units, Circulation Pumps',
    status: '● Running',
    camPos: new THREE.Vector3(45, 52, 45),
    camTarget: new THREE.Vector3(0, 2, 0),
    zoom: 2.35,
  },
  material: {
    title: 'MATERIAL HUB',
    desc: 'Bulk Chemical Silo Storage & Raw Material Staging Depot',
    kpiUnits: '2 Silos',
    kpiUnitsLbl: 'ACTIVE',
    kpiRate: '84% Fill',
    kpiLines: 'Bulk Discharge',
    kpiEff: '98%',
    purpose: 'Raw material intake, bulk fluid silo storage, and containerized distribution',
    input: 'Bulk tanker deliveries',
    output: 'Metered feed to Processing Cell',
    equipment: 'Silos, Transfer Manifolds, Staging Containers, Forklifts',
    status: '● Active',
    camPos: new THREE.Vector3(45, 52, 45),
    camTarget: new THREE.Vector3(0, 2, 0),
    zoom: 2.35,
  },
};

const pins = [
  {
    id: 'badge-machining',
    cellKey: 'machining',
    el: document.getElementById('badge-machining'),
    anchor3D: new THREE.Vector3(-22, 8.5, -26),
    badge3D: new THREE.Vector3(-22, 14.5, -26),
    color: '#f59e0b',
  },
  {
    id: 'badge-robotics',
    cellKey: 'robotics',
    el: document.getElementById('badge-robotics'),
    anchor3D: new THREE.Vector3(-3, 7.2, -38),
    badge3D: new THREE.Vector3(-3, 13.5, -38),
    color: '#00f5ff',
  },
  {
    id: 'badge-processing',
    cellKey: 'processing',
    el: document.getElementById('badge-processing'),
    anchor3D: new THREE.Vector3(12, 9.2, -26),
    badge3D: new THREE.Vector3(12, 15.5, -26),
    color: '#10b981',
  },
  {
    id: 'badge-assembly',
    cellKey: 'assembly',
    el: document.getElementById('badge-assembly'),
    anchor3D: new THREE.Vector3(2, 6.0, 4),
    badge3D: new THREE.Vector3(2, 12.0, 4),
    color: '#10ff88',
  },
  {
    id: 'badge-material',
    cellKey: 'material',
    el: document.getElementById('badge-material'),
    anchor3D: new THREE.Vector3(27, 8.5, -12),
    badge3D: new THREE.Vector3(33, 14.5, -12),
    color: '#38bdf8',
  },
  {
    id: 'badge-quality',
    cellKey: 'quality',
    el: document.getElementById('badge-quality'),
    anchor3D: new THREE.Vector3(-24, 7.5, -4),
    badge3D: new THREE.Vector3(-31, 13.5, -4),
    color: '#c084fc',
  },
  {
    id: 'badge-utility',
    cellKey: 'utility',
    el: document.getElementById('badge-utility'),
    anchor3D: new THREE.Vector3(-28, 7.2, 14),
    badge3D: new THREE.Vector3(-35, 13.5, 14),
    color: '#c084fc',
  },
  {
    id: 'badge-cooling',
    cellKey: 'cooling',
    el: document.getElementById('badge-cooling'),
    anchor3D: new THREE.Vector3(-28, 5.6, 29),
    badge3D: new THREE.Vector3(-35, 12.0, 29),
    color: '#c084fc',
  },
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