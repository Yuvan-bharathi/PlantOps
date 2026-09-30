import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
// SHARED MATERIALS & HELPERS FOR HIGH-FIDELITY LUMINOUS INTERIORS
// ─────────────────────────────────────────────────────────────────────────────
const concreteFloorMat = new THREE.MeshStandardMaterial({
  color: 0x182438,
  roughness: 0.88,
  metalness: 0.04,
});

const wallMatLight = new THREE.MeshStandardMaterial({
  color: 0x1f2e48,
  roughness: 0.65,
  metalness: 0.25,
});

const wallMatDark = new THREE.MeshStandardMaterial({
  color: 0x131d30,
  roughness: 0.7,
  metalness: 0.3,
});

// Bosch-Rexroth Style Anodized Satin Aluminum & Hardware Materials
const tslotMat = new THREE.MeshStandardMaterial({
  color: 0x94a3b8,
  metalness: 0.5,
  roughness: 0.55,
});

const tslotBracketMat = new THREE.MeshStandardMaterial({
  color: 0x334155,
  metalness: 0.4,
  roughness: 0.6,
});

const tableTopMat = new THREE.MeshStandardMaterial({
  color: 0xcfd8dc,
  roughness: 0.6,
  metalness: 0.1,
});

// Clean Industrial White Cobot Arm Materials
const cobotWhiteMat = new THREE.MeshStandardMaterial({
  color: 0xf1f5f9,
  roughness: 0.45,
  metalness: 0.15,
});

const cobotJointMat = new THREE.MeshStandardMaterial({
  color: 0x1e293b,
  roughness: 0.5,
  metalness: 0.6,
});

const cobotBluePartMat = new THREE.MeshStandardMaterial({
  color: 0x0284c7,
  roughness: 0.4,
  metalness: 0.5,
});

// Conveyor Materials
const conveyorGreenBeltMat = new THREE.MeshStandardMaterial({
  color: 0x059669,
  roughness: 0.75,
  metalness: 0.1,
});

const conveyorRollerMat = new THREE.MeshStandardMaterial({
  color: 0x10b981,
  metalness: 0.6,
  roughness: 0.4,
});

const palletTrayMat = new THREE.MeshStandardMaterial({
  color: 0x1e293b,
  metalness: 0.5,
  roughness: 0.5,
});

// Storage & Bin Materials
const binBlueMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.5 });
const binYellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 });
const binGreyMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5 });
const boxCardboardMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.85 });

// General Machinery & Robot Colors
const metalDarkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.65, roughness: 0.5 });
const metalSteelMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.65, roughness: 0.5 });
const robotYellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.4, roughness: 0.4 });
const robotOrangeMat = new THREE.MeshStandardMaterial({ color: 0xf97316, metalness: 0.4, roughness: 0.45 });
const fenceMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.4, roughness: 0.4 });
const fenceMeshMat = new THREE.MeshBasicMaterial({ color: 0x475569, wireframe: true });
const hazardStripeMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });

// Architectural Ceiling Steel Truss Material
const steelTrussMat = new THREE.MeshStandardMaterial({
  color: 0x1e293b,
  roughness: 0.7,
  metalness: 0.35,
});

// Lighting & Screen Materials
const screenGlowMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
const taskLightMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.85 });
const laserMat = new THREE.MeshBasicMaterial({ color: 0x10ff88, transparent: true, opacity: 0.75 });
const stainlessMat = new THREE.MeshStandardMaterial({ color: 0xcfd8dc, metalness: 0.6, roughness: 0.4 });

// ─────────────────────────────────────────────────────────────────────────────
// PROCEDURAL ARCHITECTURAL ROOM SHELL
// ─────────────────────────────────────────────────────────────────────────────
function createRoomShell(w = 64, d = 48, h = 18) {
  const room = new THREE.Group();

  // 1. High-Gloss Industrial Epoxy Floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), concreteFloorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  room.add(floor);

  // Floor Grid Lines
  const grid = new THREE.GridHelper(Math.max(w, d), 32, 0x2d3f5e, 0x1a283e);
  grid.position.y = 0.02;
  room.add(grid);

  // Safety Yellow Border Walkway Boundary Lines
  const borderGeom = new THREE.EdgesGeometry(new THREE.PlaneGeometry(w - 2, d - 2));
  const border = new THREE.LineSegments(borderGeom, new THREE.LineBasicMaterial({ color: 0xfacc15, linewidth: 2 }));
  border.rotation.x = -Math.PI / 2;
  border.position.y = 0.03;
  room.add(border);

  // Internal Safety Walkway Corridor (Yellow Dashed Rectangles)
  const walkwayGeom = new THREE.EdgesGeometry(new THREE.PlaneGeometry(w - 14, 5.5));
  const walkway = new THREE.LineSegments(walkwayGeom, new THREE.LineBasicMaterial({ color: 0xfacc15, linewidth: 2 }));
  walkway.rotation.x = -Math.PI / 2;
  walkway.position.set(0, 0.03, 17);
  room.add(walkway);

  // 2. Architectural Walls with Daylight Ribbon Windows
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.8), wallMatLight);
  backWall.position.set(0, h / 2, -d / 2);
  room.add(backWall);

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.8, h, d), wallMatDark);
  leftWall.position.set(-w / 2, h / 2, 0);
  room.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.8, h, d), wallMatDark);
  rightWall.position.set(w / 2, h / 2, 0);
  room.add(rightWall);

  // Ribbon Windows on Back Wall
  for (let col = -w * 0.35; col <= w * 0.35; col += w * 0.35) {
    const win = new THREE.Mesh(
      new THREE.BoxGeometry(16, 3.2, 0.2),
      new THREE.MeshBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.85 })
    );
    win.position.set(col, h - 4.0, -d / 2 + 0.45);
    room.add(win);
  }

  // 3. Overhead Lighting Fixtures (Sleek modern LED diffuse strips)
  for (let lx = -w * 0.32; lx <= w * 0.32; lx += w * 0.32) {
    for (let lz = -d * 0.28; lz <= d * 0.28; lz += d * 0.28) {
      const fixture = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.25, 0.9), steelTrussMat);
      fixture.position.set(lx, h - 0.25, lz);
      room.add(fixture);

      const lightGlow = new THREE.Mesh(
        new THREE.BoxGeometry(6.0, 0.08, 0.7),
        taskLightMat
      );
      lightGlow.position.set(lx, h - 0.38, lz);
      room.add(lightGlow);
    }
  }

  // Structural Steel I-Beams on Ceiling (Sleek dark architectural girders)
  for (let z = -d * 0.35; z <= d * 0.35; z += 11) {
    const truss = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, 0.35), steelTrussMat);
    truss.position.set(0, h - 0.2, z);
    room.add(truss);
  }

  return room;
}

// ─────────────────────────────────────────────────────────────────────────────
// T-SLOT EXTRUSION HELPER (Bosch Rexroth Style)
// ─────────────────────────────────────────────────────────────────────────────
function createTSlotBeam(w, h, d, x = 0, y = 0, z = 0) {
  const beam = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), tslotMat);
  beam.position.set(x, y, z);
  beam.castShadow = true;
  beam.receiveShadow = true;
  return beam;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. HIGH-FIDELITY ASSEMBLY CELL (Full-Floor Industrial Transfer & Sub-Assembly)
// ─────────────────────────────────────────────────────────────────────────────
export function buildAssemblyCellInterior() {
  const root = new THREE.Group();
  root.name = 'interior-assembly';
  const room = createRoomShell(64, 48, 18);
  root.add(room);

  const interactiveObjects = [];
  const animatedPallets = [];
  const animatedCobots = [];
  const animatedRotaries = [];
  const animatedDeltas = [];

  // Dedicated Materials
  const vibratoryBowlMat = new THREE.MeshStandardMaterial({ color: 0xcfd8dc, metalness: 0.9, roughness: 0.2 });
  const amrOrangeMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.35, metalness: 0.4 });
  const lidarCyanMat = new THREE.MeshBasicMaterial({ color: 0x00f5ff, transparent: true, opacity: 0.65 });

  // ─────────────────────────────────────────────────────────────────────────
  // A. MAIN DUAL-LANE SYNCHRONIZED TRANSFER CONVEYOR (Center-Line)
  // ─────────────────────────────────────────────────────────────────────────
  const mainLineGroup = new THREE.Group();
  mainLineGroup.position.set(0, 0, 0);

  const convLen = 42;
  const convW = 2.4;
  const convH = 1.8;

  // Extruded Aluminum Side Rails
  const railL = createTSlotBeam(0.12, 0.35, convLen, -convW / 2, convH, 0);
  const railR = createTSlotBeam(0.12, 0.35, convLen, convW / 2, convH, 0);
  mainLineGroup.add(railL);
  mainLineGroup.add(railR);

  // Green Conveyor Belt Bed
  const beltBed = new THREE.Mesh(
    new THREE.BoxGeometry(convW - 0.3, 0.1, convLen),
    conveyorGreenBeltMat
  );
  beltBed.position.set(0, convH - 0.05, 0);
  mainLineGroup.add(beltBed);

  // Rollers across Conveyor
  for (let rz = -convLen / 2 + 1; rz <= convLen / 2 - 1; rz += 0.8) {
    const roller = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, convW - 0.3, 12),
      conveyorRollerMat
    );
    roller.rotation.z = Math.PI / 2;
    roller.position.set(0, convH + 0.02, rz);
    mainLineGroup.add(roller);
  }

  // Conveyor Aluminum Structural Support Legs & Adjustable Feet
  for (let lz = -convLen / 2 + 2; lz <= convLen / 2 - 2; lz += 4.5) {
    const legL = createTSlotBeam(0.14, convH, 0.14, -convW / 2, convH / 2, lz);
    const legR = createTSlotBeam(0.14, convH, 0.14, convW / 2, convH / 2, lz);
    const crossBar = createTSlotBeam(convW, 0.12, 0.12, 0, 0.4, lz);
    mainLineGroup.add(legL);
    mainLineGroup.add(legR);
    mainLineGroup.add(crossBar);

    const footL = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.1, 12), tslotBracketMat);
    footL.position.set(-convW / 2, 0.05, lz);
    const footR = footL.clone();
    footR.position.x = convW / 2;
    mainLineGroup.add(footL);
    mainLineGroup.add(footR);
  }

  // Under-bed Electric Conveyor Drive Motor & Gearbox
  const driveMotor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.4, 1.2, 16),
    new THREE.MeshStandardMaterial({ color: 0x1e3a8a, metalness: 0.8 })
  );
  driveMotor.rotation.x = Math.PI / 2;
  driveMotor.position.set(convW / 2 + 0.4, 1.1, -12);
  mainLineGroup.add(driveMotor);

  // Moving Workpiece Carrier Pallets
  for (let i = 0; i < 7; i++) {
    const pallet = new THREE.Group();
    const tray = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.16, 2.0), palletTrayMat);
    tray.position.y = convH + 0.15;
    pallet.add(tray);

    const compBase = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.7, 1.2), cobotBluePartMat);
    compBase.position.set(0, convH + 0.55, 0);
    pallet.add(compBase);

    const compCap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.4, 16), stainlessMat);
    compCap.position.set(0, convH + 0.95, 0);
    pallet.add(compCap);

    pallet.position.set(0, 0, -convLen / 2 + 3 + i * 5.4);
    mainLineGroup.add(pallet);
    animatedPallets.push({ pallet, initialZ: pallet.position.z, maxZ: convLen / 2 - 2, minZ: -convLen / 2 + 2 });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 1. STATION 1: INFEED OPTICAL VISION INSPECTION ARCH (Rear on Conveyor)
  // ─────────────────────────────────────────────────────────────────────────
  const visionArch = new THREE.Group();
  visionArch.position.set(0, 0, -12);
  visionArch.userData = { id: 'STATION-01', name: 'Optical Vision & Dimension Inspection Arch', status: 'RUNNING', health: 99 };

  const archPillarL = createTSlotBeam(0.18, 3.6, 0.18, -convW / 2 - 0.2, 1.8, 0);
  const archPillarR = createTSlotBeam(0.18, 3.6, 0.18, convW / 2 + 0.2, 1.8, 0);
  const archTop = createTSlotBeam(convW + 0.8, 0.18, 0.35, 0, 3.6, 0);
  visionArch.add(archPillarL);
  visionArch.add(archPillarR);
  visionArch.add(archTop);

  // Telecentric Camera Head & Ring Light
  const camHousing = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.5), metalDarkMat);
  camHousing.position.set(0, 3.2, 0);
  visionArch.add(camHousing);

  const ringLight = new THREE.Mesh(
    new THREE.TorusGeometry(0.35, 0.08, 12, 24),
    new THREE.MeshBasicMaterial({ color: 0x00f5ff })
  );
  ringLight.rotation.x = Math.PI / 2;
  ringLight.position.set(0, 2.8, 0);
  visionArch.add(ringLight);

  const scanBeam = new THREE.Mesh(
    new THREE.ConeGeometry(1.2, 1.0, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x10ff88, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
  );
  scanBeam.position.set(0, 2.3, 0);
  visionArch.add(scanBeam);

  mainLineGroup.add(visionArch);
  interactiveObjects.push(visionArch);

  // ─────────────────────────────────────────────────────────────────────────
  // 2. STATION 2: WHITE 6-AXIS COLLABORATIVE ROBOT (Center on Conveyor)
  // ─────────────────────────────────────────────────────────────────────────
  const cobotGroup = new THREE.Group();
  cobotGroup.position.set(-0.2, convH, 0);
  cobotGroup.userData = { id: 'COBOT-01', name: '6-Axis Collaborative Assembly Robot', status: 'RUNNING', health: 99 };

  const cPlinth = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.4, 1.8), tslotMat);
  cPlinth.position.y = 0.2;
  cobotGroup.add(cPlinth);

  const cBase = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.6, 24), cobotJointMat);
  cBase.position.y = 0.6;
  cobotGroup.add(cBase);

  const cJ1 = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.7, 24), cobotWhiteMat);
  cJ1.position.y = 1.15;
  cobotGroup.add(cJ1);

  const cArm1 = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 2.6, 20), cobotWhiteMat);
  cArm1.position.set(0, 2.3, 0.3);
  cArm1.rotation.x = 0.4;
  cobotGroup.add(cArm1);

  const cElbow = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 16), cobotJointMat);
  cElbow.position.set(0, 3.4, 0.8);
  cobotGroup.add(cElbow);

  const cArm2 = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 2.2, 20), cobotWhiteMat);
  cArm2.position.set(0, 3.2, 1.8);
  cArm2.rotation.x = -0.85;
  cobotGroup.add(cArm2);

  const cWrist = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.5, 16), cobotJointMat);
  cWrist.position.set(0, 2.3, 2.6);
  cobotGroup.add(cWrist);

  const cGripL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.15), tslotBracketMat);
  cGripL.position.set(-0.2, 1.9, 2.6);
  const cGripR = cGripL.clone();
  cGripR.position.x = 0.2;
  cobotGroup.add(cGripL);
  cobotGroup.add(cGripR);

  const heldPart = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.7), cobotBluePartMat);
  heldPart.position.set(0, 1.8, 2.6);
  cobotGroup.add(heldPart);

  const cobotHalo = new THREE.Mesh(
    new THREE.RingGeometry(1.6, 1.85, 32),
    new THREE.MeshBasicMaterial({ color: 0x10ff88, side: THREE.DoubleSide })
  );
  cobotHalo.rotation.x = -Math.PI / 2;
  cobotHalo.position.y = 0.41;
  cobotGroup.add(cobotHalo);

  mainLineGroup.add(cobotGroup);
  interactiveObjects.push(cobotGroup);
  animatedCobots.push({ cJ1, cArm1, cArm2, heldPart });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. STATION 3: AUTOMATIC MULTI-SPINDLE SCREWDRIVING STATION (Forward on Conveyor)
  // ─────────────────────────────────────────────────────────────────────────
  const screwStation = new THREE.Group();
  screwStation.position.set(0, 0, 10);
  screwStation.userData = { id: 'STATION-02', name: 'Multi-Spindle Auto-Screwdriving & Torque Cell', status: 'RUNNING', health: 98 };

  const sFrameL = createTSlotBeam(0.18, 4.2, 0.18, -convW / 2 - 0.2, 2.1, 0);
  const sFrameR = createTSlotBeam(0.18, 4.2, 0.18, convW / 2 + 0.2, 2.1, 0);
  const sBridge = createTSlotBeam(convW + 0.8, 0.35, 0.5, 0, 4.0, 0);
  screwStation.add(sFrameL);
  screwStation.add(sFrameR);
  screwStation.add(sBridge);

  // Vibratory Screw Feeder Bowl on Side
  const bowlStand = createTSlotBeam(0.14, 2.4, 0.14, convW / 2 + 1.2, 1.2, 0);
  screwStation.add(bowlStand);

  const vibratoryBowl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 0.4, 0.6, 20),
    vibratoryBowlMat
  );
  vibratoryBowl.position.set(convW / 2 + 1.2, 2.7, 0);
  screwStation.add(vibratoryBowl);

  // Multi-Spindle Screwdriver Head on Servo Slide
  const screwHead = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.8), metalDarkMat);
  screwHead.position.set(0, 3.2, 0);
  screwStation.add(screwHead);

  for (let sx of [-0.2, 0.2]) {
    for (let sz of [-0.2, 0.2]) {
      const bit = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8), stainlessMat);
      bit.position.set(sx, 2.3, sz);
      screwStation.add(bit);
    }
  }

  mainLineGroup.add(screwStation);
  interactiveObjects.push(screwStation);

  root.add(mainLineGroup);

  // ─────────────────────────────────────────────────────────────────────────
  // B. LEFT FLANK: DUAL ROTARY INDEXING STATIONS & HIGH-SPEED DELTA ROBOT
  // ─────────────────────────────────────────────────────────────────────────
  // 1. Rotary Indexing Assembly Cell 01 (Rear Left)
  function createRotaryAssemblyCell(x, z, cellId, cellName) {
    const rotaryGroup = new THREE.Group();
    rotaryGroup.position.set(x, 0, z);
    rotaryGroup.userData = { id: cellId, name: cellName, status: 'RUNNING', health: 98 };

    const rBase = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 1.4, 24), tslotMat);
    rBase.position.y = 0.7;
    rotaryGroup.add(rBase);

    const rPlatter = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.25, 24), stainlessMat);
    rPlatter.position.y = 1.5;
    rotaryGroup.add(rPlatter);
    animatedRotaries.push(rPlatter);

    // 4 Clamping Fixture Jigs
    for (let j = 0; j < 4; j++) {
      const angle = (j * Math.PI) / 2;
      const jig = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.7), cobotBluePartMat);
      jig.position.set(Math.cos(angle) * 1.3, 1.85, Math.sin(angle) * 1.3);
      rotaryGroup.add(jig);
    }

    // Overhead Press & Tool Gantry
    const pArch = createTSlotBeam(0.18, 3.8, 0.18, -1.6, 1.9, 0);
    const pArch2 = createTSlotBeam(0.18, 3.8, 0.18, 1.6, 1.9, 0);
    const pCross = createTSlotBeam(3.4, 0.25, 0.35, 0, 3.8, 0);
    rotaryGroup.add(pArch);
    rotaryGroup.add(pArch2);
    rotaryGroup.add(pCross);

    const pressCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.2, 16), metalSteelMat);
    pressCyl.position.set(0, 3.1, 0);
    rotaryGroup.add(pressCyl);

    const statusRing = new THREE.Mesh(
      new THREE.RingGeometry(3.0, 3.25, 32),
      new THREE.MeshBasicMaterial({ color: 0x10ff88, side: THREE.DoubleSide })
    );
    statusRing.rotation.x = -Math.PI / 2;
    statusRing.position.y = 0.04;
    rotaryGroup.add(statusRing);

    return rotaryGroup;
  }

  const rotaryCell1 = createRotaryAssemblyCell(-18, -10, 'ASMB-04', 'Rotary 4-Station Indexing Sub-Assembly Cell 01');
  const rotaryCell2 = createRotaryAssemblyCell(-18, 8, 'ASMB-05', 'Rotary Precision Toggle Press Workstation 02');
  root.add(rotaryCell1);
  root.add(rotaryCell2);
  interactiveObjects.push(rotaryCell1, rotaryCell2);

  // 2. High-Speed Delta Robot Cell (Spider Robot) (Mid Left)
  const deltaGroup = new THREE.Group();
  deltaGroup.position.set(-18, 0, -1);
  deltaGroup.userData = { id: 'DELTA-01', name: 'High-Speed Spider Delta Pick-and-Place Robot', status: 'RUNNING', health: 99 };

  // 4-Leg Extruded Aluminum Cell Enclosure
  for (let dx of [-1.8, 1.8]) {
    for (let dz of [-1.8, 1.8]) {
      const leg = createTSlotBeam(0.14, 4.4, 0.14, dx, 2.2, dz);
      deltaGroup.add(leg);
    }
  }

  const topGantry = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.25, 3.8), tslotMat);
  topGantry.position.y = 4.4;
  deltaGroup.add(topGantry);

  // Delta Base Plate & Motor Housings
  const deltaBase = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.35, 16), metalDarkMat);
  deltaBase.position.y = 4.1;
  deltaGroup.add(deltaBase);

  // 3 Carbon Fiber Bicep Arms
  for (let a = 0; a < 3; a++) {
    const theta = (a * Math.PI * 2) / 3;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 12), metalSteelMat);
    arm.position.set(Math.cos(theta) * 0.7, 3.3, Math.sin(theta) * 0.7);
    arm.rotation.z = Math.cos(theta) * 0.5;
    arm.rotation.x = Math.sin(theta) * 0.5;
    deltaGroup.add(arm);
  }

  // Vacuum Suction Gripper Cup
  const gripperCup = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.3, 12), cobotBluePartMat);
  gripperCup.position.y = 2.4;
  deltaGroup.add(gripperCup);
  animatedDeltas.push(gripperCup);

  const deltaHalo = new THREE.Mesh(
    new THREE.RingGeometry(2.4, 2.65, 32),
    new THREE.MeshBasicMaterial({ color: 0x10ff88, side: THREE.DoubleSide })
  );
  deltaHalo.rotation.x = -Math.PI / 2;
  deltaHalo.position.y = 0.04;
  deltaGroup.add(deltaHalo);

  root.add(deltaGroup);
  interactiveObjects.push(deltaGroup);

  // ─────────────────────────────────────────────────────────────────────────
  // C. RIGHT FLANK: 3 ERGONOMIC OPERATOR WORKBENCHES & 2 PARTS SUPERMARKETS
  // ─────────────────────────────────────────────────────────────────────────
  function createOperatorAssemblyBench(x, z, label, benchId) {
    const bench = new THREE.Group();
    bench.position.set(x, 0, z);
    bench.userData = { id: benchId, name: label, status: 'RUNNING', health: 98 };

    const bW = 5.4;
    const bD = 2.4;
    const bH = 1.6;

    const tableTop = new THREE.Mesh(new THREE.BoxGeometry(bW, 0.14, bD), tableTopMat);
    tableTop.position.y = bH;
    bench.add(tableTop);

    for (let lx of [-bW / 2 + 0.15, bW / 2 - 0.15]) {
      for (let lz of [-bD / 2 + 0.15, bD / 2 - 0.15]) {
        const leg = createTSlotBeam(0.12, bH, 0.12, lx, bH / 2, lz);
        bench.add(leg);
      }
    }

    const gantryH = 4.4;
    const postL = createTSlotBeam(0.12, gantryH, 0.12, -bW / 2 + 0.15, gantryH / 2, -bD / 2 + 0.15);
    const postR = createTSlotBeam(0.12, gantryH, 0.12, bW / 2 - 0.15, gantryH / 2, -bD / 2 + 0.15);
    const topBar = createTSlotBeam(bW, 0.12, 0.12, 0, gantryH, -bD / 2 + 0.15);
    const lightBar = createTSlotBeam(bW, 0.12, 0.12, 0, gantryH, 0.8);
    bench.add(postL);
    bench.add(postR);
    bench.add(topBar);
    bench.add(lightBar);

    const taskLight = new THREE.Mesh(new THREE.BoxGeometry(bW - 0.8, 0.15, 0.4), taskLightMat);
    taskLight.position.set(0, gantryH - 0.15, 0.8);
    bench.add(taskLight);

    for (let tx of [-1.2, 1.2]) {
      const balancer = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.4, 12), tslotBracketMat);
      balancer.position.set(tx, gantryH - 0.4, 0.8);
      bench.add(balancer);

      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 8), tslotBracketMat);
      cord.position.set(tx, gantryH - 1.2, 0.8);
      bench.add(cord);

      const driver = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.8, 12), new THREE.MeshStandardMaterial({ color: 0x0284c7 }));
      driver.position.set(tx, gantryH - 2.2, 0.8);
      bench.add(driver);
    }

    const monitor = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.08), tslotBracketMat);
    monitor.position.set(-1.6, bH + 0.9, -0.6);
    monitor.rotation.y = 0.2;
    bench.add(monitor);

    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.7), screenGlowMat);
    screen.position.set(-1.6, bH + 0.9, -0.55);
    screen.rotation.y = 0.2;
    bench.add(screen);

    for (let bi = 0; bi < 3; bi++) {
      const bin = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.9), bi % 2 === 0 ? binBlueMat : binYellowMat);
      bin.position.set(0.4 + bi * 0.85, bH + 0.2, -0.4);
      bench.add(bin);
    }

    const lowerShelf = new THREE.Mesh(new THREE.BoxGeometry(bW - 0.4, 0.1, bD - 0.4), tableTopMat);
    lowerShelf.position.y = 0.4;
    bench.add(lowerShelf);

    return bench;
  }

  const bench1 = createOperatorAssemblyBench(16, -11, 'ASMB-01: Screwdriving & Torque Station', 'ASMB-01');
  const bench2 = createOperatorAssemblyBench(16, -2, 'ASMB-02: Cobot Insertion Station', 'ASMB-02');
  const bench3 = createOperatorAssemblyBench(16, 7, 'ASMB-03: Final Fitting & Harness Station', 'ASMB-03');
  root.add(bench1);
  root.add(bench2);
  root.add(bench3);
  interactiveObjects.push(bench1, bench2, bench3);

  // 5-Tier Parts Storage Supermarket Racks
  function createPartsSupermarketRack(x, z, rackId, rackName) {
    const rackGroup = new THREE.Group();
    rackGroup.position.set(x, 0, z);
    rackGroup.userData = { id: rackId, name: rackName, status: 'RUNNING', health: 99 };

    const rW = 4.2;
    const rD = 1.4;
    const rH = 5.4;

    for (let rx of [-rW / 2, rW / 2]) {
      for (let rz of [-rD / 2, rD / 2]) {
        const post = createTSlotBeam(0.1, rH, 0.1, rx, rH / 2, rz);
        rackGroup.add(post);
      }
    }

    for (let tier = 0; tier < 5; tier++) {
      const yTier = 0.8 + tier * 0.9;
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(rW, 0.08, rD), tslotMat);
      shelf.position.y = yTier;
      rackGroup.add(shelf);

      for (let b = 0; b < 4; b++) {
        const binColor = b % 2 === 0 ? binBlueMat : binYellowMat;
        const bin = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.45, 1.0), binColor);
        bin.position.set(-1.4 + b * 0.95, yTier + 0.26, 0);
        rackGroup.add(bin);
      }
    }

    return rackGroup;
  }

  const rack1 = createPartsSupermarketRack(24, -8, 'RACK-01', '5-Tier Modular Component Supermarket Rack A');
  const rack2 = createPartsSupermarketRack(24, 4, 'RACK-02', '5-Tier Modular Component Supermarket Rack B');
  root.add(rack1);
  root.add(rack2);
  interactiveObjects.push(rack1, rack2);

  // ─────────────────────────────────────────────────────────────────────────
  // D. MASTER PLC / HMI CONTROL TOWER CABINET (Right of Conveyor)
  // ─────────────────────────────────────────────────────────────────────────
  const controlTower = new THREE.Group();
  controlTower.position.set(24, 0, 14);
  controlTower.userData = { id: 'HMI-TOWER-01', name: 'Master Assembly Cell PLC & Safety Cabinet', status: 'RUNNING', health: 99 };

  const cabBody = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 4.4, 2.0),
    new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.3, metalness: 0.2 })
  );
  cabBody.position.y = 2.2;
  controlTower.add(cabBody);

  const cabBase = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.4, 2.2), new THREE.MeshStandardMaterial({ color: 0x0284c7 }));
  cabBase.position.y = 0.2;
  controlTower.add(cabBase);

  const hmiScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.9), screenGlowMat);
  hmiScreen.position.set(0, 3.0, 1.02);
  controlTower.add(hmiScreen);

  const estopBase = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 16), binYellowMat);
  estopBase.rotation.x = Math.PI / 2;
  estopBase.position.set(-0.6, 2.1, 1.02);
  controlTower.add(estopBase);

  const estopBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.12, 16), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
  estopBtn.rotation.x = Math.PI / 2;
  estopBtn.position.set(-0.6, 2.1, 1.1);
  controlTower.add(estopBtn);

  const stackPole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2), tslotMat);
  stackPole.position.set(0, 5.0, 0);
  controlTower.add(stackPole);

  const lightGreen = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.25, 16), new THREE.MeshBasicMaterial({ color: 0x10ff88 }));
  lightGreen.position.set(0, 5.7, 0);
  const lightAmber = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.25, 16), new THREE.MeshBasicMaterial({ color: 0xf59e0b }));
  lightAmber.position.set(0, 6.0, 0);
  const lightRed = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.25, 16), new THREE.MeshBasicMaterial({ color: 0x334155 }));
  lightRed.position.set(0, 6.3, 0);
  controlTower.add(lightGreen);
  controlTower.add(lightAmber);
  controlTower.add(lightRed);

  root.add(controlTower);
  interactiveObjects.push(controlTower);

  // ─────────────────────────────────────────────────────────────────────────
  // E. FRONT FLANK: AUTONOMOUS MOBILE ROBOTS (AMRs) & PALLET DEPOT
  // ─────────────────────────────────────────────────────────────────────────
  function createAMRRobot(x, z, amrId, amrName) {
    const amr = new THREE.Group();
    amr.position.set(x, 0, z);
    amr.userData = { id: amrId, name: amrName, status: 'RUNNING', health: 98 };

    // Low-Profile Sleek Chassis
    const chassis = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.5, 3.2),
      amrOrangeMat
    );
    chassis.position.y = 0.35;
    amr.add(chassis);

    const chassisTop = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.1, 3.0),
      metalDarkMat
    );
    chassisTop.position.y = 0.65;
    amr.add(chassisTop);

    // LiDAR Safety Scanner Puck
    const lidarPuck = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.2, 16), metalDarkMat);
    lidarPuck.position.set(0, 0.75, 1.4);
    amr.add(lidarPuck);

    const lidarRing = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1.4, 24),
      lidarCyanMat
    );
    lidarRing.rotation.x = -Math.PI / 2;
    lidarRing.position.set(0, 0.8, 1.4);
    amr.add(lidarRing);

    // Tote Cargo on AMR
    const amrTote = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 2.2), binBlueMat);
    amrTote.position.set(0, 1.0, 0);
    amr.add(amrTote);

    return amr;
  }

  const amr1 = createAMRRobot(-8, 16.5, 'AMR-01', 'Autonomous Mobile Part Transport Robot 01');
  const amr2 = createAMRRobot(6, 16.5, 'AMR-02', 'Autonomous Mobile Transport Robot 02');
  root.add(amr1);
  root.add(amr2);
  interactiveObjects.push(amr1, amr2);

  // Pallet Stacks with Carton Boxes (Front Right)
  for (let p = 0; p < 2; p++) {
    const pal = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.25, 2.4), boxCardboardMat);
    pal.position.set(15 + p * 3.4, 0.125, 16.5);
    root.add(pal);

    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        const carton = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.9), boxCardboardMat);
        carton.position.set(15 + p * 3.4 - 0.55 + r * 1.1, 0.6 + c * 0.75, 16.5 - 0.45 + c * 0.9);
        root.add(carton);
      }
    }
  }

  return { root, interactiveObjects, animatedPallets, animatedCobots, animatedRotaries, animatedDeltas };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ROBOT CELL INTERIOR
// ─────────────────────────────────────────────────────────────────────────────
export function buildRobotCellInterior() {
  const root = new THREE.Group();
  root.name = 'interior-robotics';
  const room = createRoomShell(64, 48, 18);
  root.add(room);

  const interactiveObjects = [];
  const animatedConveyors = [];
  const animatedRobots = [];

  const robotConfigs = [
    { id: 'ROBOT-01', name: 'Robot Arm 01 (Infeed Sorting)', x: -14, z: -10, status: 'RUNNING', health: 98 },
    { id: 'ROBOT-02', name: 'Robot Arm 02 (Routing)', x: 14, z: -10, status: 'RUNNING', health: 96 },
    { id: 'ROBOT-03', name: 'Robot Arm 03 (Inspection/Pick)', x: -14, z: 6, status: 'RUNNING', health: 97 },
    { id: 'ROBOT-04', name: 'Robot Arm 04 (Line Dispatch)', x: 14, z: 6, status: 'RUNNING', health: 95 },
  ];

  robotConfigs.forEach((cfg) => {
    const group = new THREE.Group();
    group.position.set(cfg.x, 0, cfg.z);
    group.userData = cfg;

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.6, 7.2), metalDarkMat);
    plinth.position.y = 0.3;
    group.add(plinth);

    const plinthBorder = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(7.4, 7.4)),
      new THREE.LineBasicMaterial({ color: 0xfacc15, linewidth: 2 })
    );
    plinthBorder.rotation.x = -Math.PI / 2;
    plinthBorder.position.y = 0.61;
    group.add(plinthBorder);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 1.3, 16), metalSteelMat);
    base.position.y = 1.25;
    group.add(base);

    const j1 = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.9, 16), robotYellowMat);
    j1.position.y = 2.2;
    group.add(j1);

    const arm1 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 3.4, 0.8), robotOrangeMat);
    arm1.position.set(0, 4.0, 0.4);
    arm1.rotation.x = 0.3;
    group.add(arm1);

    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 12), metalDarkMat);
    elbow.position.set(0, 5.5, 0.9);
    group.add(elbow);

    const arm2 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 3.0, 0.55), robotYellowMat);
    arm2.position.set(0, 5.2, 2.3);
    arm2.rotation.x = -0.7;
    group.add(arm2);

    const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.7, 12), metalSteelMat);
    wrist.position.set(0, 4.0, 3.4);
    group.add(wrist);

    const gripperL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.22), metalDarkMat);
    gripperL.position.set(-0.28, 3.5, 3.4);
    const gripperR = gripperL.clone();
    gripperR.position.x = 0.28;
    group.add(gripperL);
    group.add(gripperR);

    const halo = new THREE.Mesh(
      new THREE.RingGeometry(2.5, 2.85, 32),
      new THREE.MeshBasicMaterial({ color: 0x10ff88, side: THREE.DoubleSide })
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.62;
    group.add(halo);

    const fenceOffset = 4.3;
    root.add(createSafetyFenceSection(cfg.x - fenceOffset, cfg.z - fenceOffset, cfg.x + fenceOffset, cfg.z - fenceOffset));
    root.add(createSafetyFenceSection(cfg.x + fenceOffset, cfg.z - fenceOffset, cfg.x + fenceOffset, cfg.z + fenceOffset));
    root.add(createSafetyFenceSection(cfg.x + fenceOffset, cfg.z + fenceOffset, cfg.x - fenceOffset, cfg.z + fenceOffset));
    root.add(createSafetyFenceSection(cfg.x - fenceOffset, cfg.z + fenceOffset, cfg.x - fenceOffset, cfg.z - fenceOffset));

    root.add(group);
    interactiveObjects.push(group);
    animatedRobots.push({ group, j1, arm1, arm2, basePhase: Math.random() * Math.PI });
  });

  function createConveyorLine(x1, z1, x2, z2, label = '') {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.sqrt(dx * dx + dz * dz);
    const angle = Math.atan2(dx, dz);

    const conv = new THREE.Group();
    conv.position.set((x1 + x2) / 2, 0, (z1 + z2) / 2);
    conv.rotation.y = angle;

    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.28, len), metalDarkMat);
    bed.position.y = 1.6;
    conv.add(bed);

    const railL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.35, len), metalSteelMat);
    railL.position.set(-0.95, 1.85, 0);
    const railR = railL.clone();
    railR.position.x = 0.95;
    conv.add(railL);
    conv.add(railR);

    for (let lz = -len / 2 + 1; lz <= len / 2 - 1; lz += 4.5) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.5, 0.18), metalSteelMat);
      leg.position.set(0, 0.75, lz);
      conv.add(leg);
    }

    const boxes = [];
    for (let b = 0; b < 4; b++) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.7, 1.0), boxCardboardMat);
      box.position.set(0, 2.1, -len / 2 + (b * len) / 4);
      conv.add(box);
      boxes.push({ box, initialZ: box.position.z, maxZ: len / 2, minZ: -len / 2 });
    }

    root.add(conv);
    animatedConveyors.push({ conv, boxes, speed: 0.05 });
  }

  createConveyorLine(-24, -2, -2, -2, 'Infeed from Assembly');
  createConveyorLine(-2, -2, 24, -14, 'Line A (To Packaging)');
  createConveyorLine(-2, -2, 24, -2, 'Line B (To Packaging)');
  createConveyorLine(-2, -2, 24, 10, 'Line C (To Packaging)');

  const scannerArch = new THREE.Group();
  scannerArch.position.set(-10, 0, -2);
  const archL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.8, 0.24), metalDarkMat);
  archL.position.set(-1.2, 1.9, 0);
  const archR = archL.clone();
  archR.position.x = 1.2;
  const archTop = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.35, 0.45), metalDarkMat);
  archTop.position.set(0, 3.8, 0);
  scannerArch.add(archL);
  scannerArch.add(archR);
  scannerArch.add(archTop);

  const camHead = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.45), metalSteelMat);
  camHead.position.set(0, 3.5, 0);
  scannerArch.add(camHead);

  const laserPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.0), laserMat);
  laserPlane.position.set(0, 2.4, 0);
  laserPlane.rotation.x = Math.PI / 2;
  scannerArch.add(laserPlane);
  root.add(scannerArch);

  const scadaDesk = createOperatorControlDesk(18, 16, Math.PI);
  root.add(scadaDesk);

  return { root, interactiveObjects, animatedConveyors, animatedRobots };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. MACHINING CELL INTERIOR
// ─────────────────────────────────────────────────────────────────────────────
// 3. HIGH-FIDELITY MACHINING CELL INTERIOR (DMG MORI / Haas Style 5-Axis CNCs)
// ─────────────────────────────────────────────────────────────────────────────
export function buildMachiningCellInterior() {
  const root = new THREE.Group();
  root.name = 'interior-machining';
  const room = createRoomShell(64, 48, 18);
  root.add(room);

  const interactiveObjects = [];
  const cncSpindles = [];

  const cncConfigs = [
    { id: 'CNC-01', name: '5-Axis High-Speed Machining Center 01', x: -18, z: -10, status: 'RUNNING', health: 98, rpm: '18,500 RPM', feed: '24 m/min', toolLife: '94%' },
    { id: 'CNC-02', name: 'Heavy Duty Multi-Tasking Turning Center 02', x: 0, z: -10, status: 'RUNNING', health: 96, rpm: '4,800 RPM', feed: '18 m/min', toolLife: '89%' },
    { id: 'CNC-03', name: '5-Axis Simultaneous Machining Center 03', x: 18, z: -10, status: 'RUNNING', health: 99, rpm: '24,000 RPM', feed: '30 m/min', toolLife: '97%' },
    { id: 'CNC-04', name: 'Precision 5-Axis Vertical Milling Center 04', x: -18, z: 6, status: 'RUNNING', health: 97, rpm: '15,000 RPM', feed: '20 m/min', toolLife: '91%' },
    { id: 'CNC-05', name: 'High-Speed Micro-Milling Center 05', x: 0, z: 6, status: 'RUNNING', health: 95, rpm: '28,000 RPM', feed: '32 m/min', toolLife: '88%' },
    { id: 'CNC-06', name: 'Ultra-Precision Dual-Spindle Lathe 06', x: 18, z: 6, status: 'RUNNING', health: 98, rpm: '6,200 RPM', feed: '16 m/min', toolLife: '95%' },
  ];

  // Wood & Tool Cart Materials
  const woodPalletMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.85 });
  const rawBilletMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.85, roughness: 0.25 });
  const toolCartRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4, metalness: 0.3 });
  const toolCartBlueMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4, metalness: 0.3 });
  const graniteMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.1 });
  const rubberMatMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.95 });

  // ─────────────────────────────────────────────────────────────────────────
  // A. BUILD EACH HIGH-FIDELITY CNC MACHINING CENTER
  // ─────────────────────────────────────────────────────────────────────────
  cncConfigs.forEach((cfg) => {
    const cnc = new THREE.Group();
    cnc.position.set(cfg.x, 0, cfg.z);
    cnc.userData = cfg;

    const cW = 7.0;
    const cD = 5.2;
    const cH = 4.8;

    // 1. Heavy Cast-Iron Base Plinth (Dark Slate)
    const basePlinth = new THREE.Mesh(
      new THREE.BoxGeometry(cW + 0.3, 0.8, cD + 0.3),
      new THREE.MeshStandardMaterial({ color: 0x111d2e, roughness: 0.7, metalness: 0.5 })
    );
    basePlinth.position.y = 0.4;
    basePlinth.castShadow = true;
    basePlinth.receiveShadow = true;
    cnc.add(basePlinth);

    // Leveling Anchor Pads
    for (let lx of [-cW / 2 + 0.3, cW / 2 - 0.3]) {
      for (let lz of [-cD / 2 + 0.3, cD / 2 - 0.3]) {
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.15, 12), metalDarkMat);
        pad.position.set(lx, 0.08, lz);
        cnc.add(pad);
      }
    }

    // 2. Main Sculpted Machine Enclosure (Modern White Polyurethane)
    const mainBody = new THREE.Mesh(
      new THREE.BoxGeometry(cW, cH - 0.8, cD),
      new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.35, metalness: 0.15 })
    );
    mainBody.position.y = 0.8 + (cH - 0.8) / 2;
    mainBody.castShadow = true;
    mainBody.receiveShadow = true;
    cnc.add(mainBody);

    // Signature Cobalt Blue Top Trim Band
    const blueTrim = new THREE.Mesh(
      new THREE.BoxGeometry(cW + 0.05, 0.45, cD + 0.05),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3, metalness: 0.4 })
    );
    blueTrim.position.y = cH - 0.22;
    cnc.add(blueTrim);

    // Machine Logo / Model Plate
    const logoBadge = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 0.3),
      new THREE.MeshBasicMaterial({ color: 0x00f5ff })
    );
    logoBadge.position.set(-2.0, cH - 0.22, cD / 2 + 0.04);
    cnc.add(logoBadge);

    // 3. Large Front Safety Glass Sliding Door with Extruded Bezel
    const doorFrameW = 4.2;
    const doorFrameH = 3.2;

    const doorRecess = new THREE.Mesh(
      new THREE.BoxGeometry(doorFrameW, doorFrameH, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 })
    );
    doorRecess.position.set(0, 2.5, cD / 2 + 0.02);
    cnc.add(doorRecess);

    const glassWindow = new THREE.Mesh(
      new THREE.PlaneGeometry(doorFrameW - 0.4, doorFrameH - 0.4),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.45,
        roughness: 0.1,
        metalness: 0.2,
      })
    );
    glassWindow.position.set(0, 2.5, cD / 2 + 0.18);
    cnc.add(glassWindow);

    // Anodized Aluminum Vertical Door Handle Bar
    const doorHandle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 2.2, 12),
      tslotMat
    );
    doorHandle.position.set(1.7, 2.5, cD / 2 + 0.28);
    cnc.add(doorHandle);

    // 4. Internal Machining Chamber (Visible through glass)
    const chamberGroup = new THREE.Group();
    chamberGroup.position.set(0, 0, 0.2);

    // Stainless Steel Interior Wall Cladding
    const chamberBack = new THREE.Mesh(
      new THREE.BoxGeometry(doorFrameW, doorFrameH - 0.2, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6, roughness: 0.4 })
    );
    chamberBack.position.set(0, 2.5, -0.6);
    chamberGroup.add(chamberBack);

    // 5-Axis Vertical Z-Axis Spindle Head
    const zRam = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 1.4, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.3 })
    );
    zRam.position.set(0, 3.4, 0.2);
    chamberGroup.add(zRam);

    // Spindle Cartridge & High-Speed Milling Tool
    const spindleHousing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.42, 1.2, 16),
      stainlessMat
    );
    spindleHousing.position.set(0, 2.5, 0.2);
    chamberGroup.add(spindleHousing);

    const toolBit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.5, 12),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.95, roughness: 0.15 })
    );
    toolBit.position.set(0, 1.7, 0.2);
    chamberGroup.add(toolBit);
    cncSpindles.push(toolBit);

    // 5-Axis Rotary Trunnion Table (B-C Axis Tilting Cradle)
    const trunnionCradle = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.4, 1.8),
      metalDarkMat
    );
    trunnionCradle.position.set(0, 1.1, 0.2);
    chamberGroup.add(trunnionCradle);

    const rotaryPlatter = new THREE.Mesh(
      new THREE.CylinderGeometry(1.0, 1.0, 0.25, 24),
      stainlessMat
    );
    rotaryPlatter.position.set(0, 1.35, 0.2);
    chamberGroup.add(rotaryPlatter);

    // Clamped Aerospace Aluminum Billet Workpiece Block
    const billetWorkpiece = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.65, 0.9),
      rawBilletMat
    );
    billetWorkpiece.position.set(0, 1.8, 0.2);
    chamberGroup.add(billetWorkpiece);

    // Dual Flexible Coolant Nozzles (Loc-Line blue/orange articulated hoses)
    for (let side of [-1, 1]) {
      const nozzle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.06, 0.6, 8),
        new THREE.MeshStandardMaterial({ color: 0x0284c7 })
      );
      nozzle.position.set(side * 0.4, 2.3, 0.35);
      nozzle.rotation.z = -side * 0.4;
      nozzle.rotation.x = 0.3;
      chamberGroup.add(nozzle);
    }

    // Chamber Interior LED Task Spotlight
    const chamberLight = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 0.1, 0.4),
      taskLightMat
    );
    chamberLight.position.set(0, 4.0, 0.4);
    chamberGroup.add(chamberLight);

    cnc.add(chamberGroup);

    // 5. Ergonomic Swiveling Pendant CNC HMI Control Console (Right Side)
    const armJ1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 12), tslotMat);
    armJ1.rotation.z = Math.PI / 2;
    armJ1.position.set(cW / 2 + 0.6, 3.2, cD / 2 - 0.4);
    cnc.add(armJ1);

    const armJ2 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.0, 12), tslotMat);
    armJ2.position.set(cW / 2 + 1.2, 2.7, cD / 2 - 0.4);
    cnc.add(armJ2);

    const hmiPod = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 1.0, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.6 })
    );
    hmiPod.position.set(cW / 2 + 1.2, 2.7, cD / 2 + 0.2);
    hmiPod.rotation.y = -0.35;
    cnc.add(hmiPod);

    const hmiDisplay = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.7), screenGlowMat);
    hmiDisplay.position.set(cW / 2 + 1.2, 2.75, cD / 2 + 0.32);
    hmiDisplay.rotation.y = -0.35;
    cnc.add(hmiDisplay);

    const estopMushroom = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.08, 12),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    estopMushroom.position.set(cW / 2 + 0.9, 2.35, cD / 2 + 0.35);
    estopMushroom.rotation.x = Math.PI / 2;
    cnc.add(estopMushroom);

    // 6. Automatic Tool Changer (ATC) 32-Pocket Tool Magazine (Left Side)
    const atcColumn = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 3.4, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.5 })
    );
    atcColumn.position.set(-cW / 2 - 0.6, 2.5, -0.2);
    cnc.add(atcColumn);

    const atcTrim = new THREE.Mesh(
      new THREE.BoxGeometry(1.25, 0.25, 2.25),
      new THREE.MeshStandardMaterial({ color: 0x0284c7 })
    );
    atcTrim.position.set(-cW / 2 - 0.6, 4.1, -0.2);
    cnc.add(atcTrim);

    // 7. Sloped High-Capacity Chip Conveyor & Mobile Scrap Hopper (Left Rear)
    const chipChute = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 0.6, 2.8),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.6 })
    );
    chipChute.rotation.x = -0.35;
    chipChute.position.set(-cW / 2 - 0.5, 1.4, -2.4);
    cnc.add(chipChute);

    const chipBinCart = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 1.2, 1.6),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.5, metalness: 0.4 })
    );
    chipBinCart.position.set(-cW / 2 - 0.5, 0.6, -3.8);
    cnc.add(chipBinCart);

    // Swivel Castor Wheels on Dumpster
    for (let wx of [-0.6, 0.6]) {
      for (let wz of [-0.6, 0.6]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12), metalDarkMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(-cW / 2 - 0.5 + wx, 0.12, -3.8 + wz);
        cnc.add(wheel);
      }
    }

    // 8. Rear Coolant Reservoir & High-Pressure Pump Skid
    const coolantTank = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 1.2, 1.6),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6, metalness: 0.4 })
    );
    coolantTank.position.set(1.4, 0.6, -cD / 2 - 0.8);
    cnc.add(coolantTank);

    const pumpMotor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 0.8, 16),
      metalSteelMat
    );
    pumpMotor.position.set(2.2, 1.6, -cD / 2 - 0.8);
    cnc.add(pumpMotor);

    // 9. Roof Mist Extraction Unit & 3-Tier LED Stack Light Tower
    const mistExtractor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.85, 0.9, 16),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.5 })
    );
    mistExtractor.position.set(-1.2, cH + 0.45, -0.4);
    cnc.add(mistExtractor);

    const stackMast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 12), tslotMat);
    stackMast.position.set(2.2, cH + 0.6, cD / 2 - 0.6);
    cnc.add(stackMast);

    const beaconG = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.22, 16), new THREE.MeshBasicMaterial({ color: 0x10ff88 }));
    beaconG.position.set(2.2, cH + 1.25, cD / 2 - 0.6);
    cnc.add(beaconG);

    const beaconA = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.22, 16), new THREE.MeshBasicMaterial({ color: 0xf59e0b }));
    beaconA.position.set(2.2, cH + 1.5, cD / 2 - 0.6);
    cnc.add(beaconA);

    const beaconR = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.22, 16), new THREE.MeshBasicMaterial({ color: 0x334155 }));
    beaconR.position.set(2.2, cH + 1.75, cD / 2 - 0.6);
    cnc.add(beaconR);

    // 10. Front Operator Anti-Fatigue Rubber Mat
    const fatigueMat = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 0.04, 1.8),
      rubberMatMat
    );
    fatigueMat.position.set(0, 0.02, cD / 2 + 1.4);
    fatigueMat.receiveShadow = true;
    cnc.add(fatigueMat);

    // High-Tech Safety Status Floor Ring
    const statusRing = new THREE.Mesh(
      new THREE.RingGeometry(4.4, 4.65, 36),
      new THREE.MeshBasicMaterial({ color: 0x10ff88, side: THREE.DoubleSide })
    );
    statusRing.rotation.x = -Math.PI / 2;
    statusRing.position.y = 0.04;
    cnc.add(statusRing);

    root.add(cnc);
    interactiveObjects.push(cnc);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // B. CENTRAL WORKSTATION STAGING DEPOT & BILLET PALLET HUBS (Front Area)
  // ─────────────────────────────────────────────────────────────────────────
  const stagingGroup = new THREE.Group();
  stagingGroup.position.set(0, 0, 16.5);

  // 1. Raw Aluminum & Steel Billet Euro Pallets
  for (let px of [-10, 0, 10]) {
    const pallet = new THREE.Group();
    pallet.position.set(px, 0, 0);

    const woodBase = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.25, 2.4), woodPalletMat);
    woodBase.position.y = 0.125;
    pallet.add(woodBase);

    // Stacked Raw Cylindrical Bar Stock Billets
    for (let bx = -0.8; bx <= 0.8; bx += 0.8) {
      for (let bz = -0.7; bz <= 0.7; bz += 0.7) {
        const billet = new THREE.Mesh(
          new THREE.CylinderGeometry(0.3, 0.3, 0.8, 16),
          rawBilletMat
        );
        billet.position.set(bx, 0.65, bz);
        billet.castShadow = true;
        pallet.add(billet);
      }
    }
    stagingGroup.add(pallet);
  }

  // 2. Mobile CNC Tooling Carts (Red & Blue with BT40 / HSK Toolholder Cones)
  function createToolCart(x, z, colorMat) {
    const cart = new THREE.Group();
    cart.position.set(x, 0, z);

    const cartFrame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.0, 1.1), colorMat);
    cartFrame.position.y = 1.1;
    cart.add(cartFrame);

    for (let shelf = 0; shelf < 3; shelf++) {
      const ySh = 0.7 + shelf * 0.6;
      for (let tx = -0.5; tx <= 0.5; tx += 0.5) {
        const toolCone = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.16, 0.35, 12),
          stainlessMat
        );
        toolCone.position.set(tx, ySh + 0.18, 0);
        cart.add(toolCone);
      }
    }

    const pushHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 12), tslotMat);
    pushHandle.rotation.z = Math.PI / 2;
    pushHandle.position.set(0, 2.1, 0.55);
    cart.add(pushHandle);

    return cart;
  }

  const toolCart1 = createToolCart(-20, 16.5, toolCartRedMat);
  const toolCart2 = createToolCart(20, 16.5, toolCartBlueMat);
  stagingGroup.add(toolCart1);
  stagingGroup.add(toolCart2);

  // 3. Precision Metrology & Granite Tool Presetter Workbench (Front Right)
  const metrologyBench = new THREE.Group();
  metrologyBench.position.set(24, 0, 10);
  metrologyBench.userData = { id: 'PRESET-01', name: 'Digital Optical Tool Presetter & CMM Station', status: 'RUNNING', health: 99 };

  const benchLegs = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.4, 2.0), metalDarkMat);
  benchLegs.position.y = 0.7;
  metrologyBench.add(benchLegs);

  const graniteSlab = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.4, 2.2), graniteMat);
  graniteSlab.position.y = 1.6;
  metrologyBench.add(graniteSlab);

  const presetterColumn = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.4, 0.5), stainlessMat);
  presetterColumn.position.set(0.8, 2.8, 0);
  metrologyBench.add(presetterColumn);

  const presetterScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.5), screenGlowMat);
  presetterScreen.position.set(0.8, 3.8, 0.26);
  metrologyBench.add(presetterScreen);

  stagingGroup.add(metrologyBench);
  interactiveObjects.push(metrologyBench);

  root.add(stagingGroup);

  // ─────────────────────────────────────────────────────────────────────────
  // C. OVERHEAD HEAVY-DUTY TRAVELING GANTRY CRANE (Spanning Workshop)
  // ─────────────────────────────────────────────────────────────────────────
  const craneGroup = new THREE.Group();
  craneGroup.userData = { id: 'CRANE-01', name: 'Overhead 10-Ton Traveling Gantry Crane', status: 'RUNNING', health: 99 };

  // Dual Structural Runway Rails along Side Walls
  const railLeft = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 44), steelTrussMat);
  railLeft.position.set(-30, 14.5, 0);
  craneGroup.add(railLeft);

  const railRight = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 44), steelTrussMat);
  railRight.position.set(30, 14.5, 0);
  craneGroup.add(railRight);

  // High-Visibility Safety Yellow Main Bridge Girder
  const craneGirder = new THREE.Mesh(
    new THREE.BoxGeometry(60, 1.2, 1.6),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4, metalness: 0.3 })
  );
  craneGirder.position.set(0, 14.8, -2.0);
  craneGroup.add(craneGirder);

  // Motorized Electric Wire-Rope Hoist Trolley
  const hoistTrolley = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 1.4, 2.4),
    metalDarkMat
  );
  hoistTrolley.position.set(4.0, 13.8, -2.0);
  craneGroup.add(hoistTrolley);

  // Steel Wire Rope Cables
  const cables = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 5.5, 8), metalSteelMat);
  cables.position.set(4.0, 10.5, -2.0);
  craneGroup.add(cables);

  // Yellow Swivel Lifting Hook Block
  const hookBlock = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.9, 0.6),
    new THREE.MeshStandardMaterial({ color: 0xfacc15 })
  );
  hookBlock.position.set(4.0, 7.5, -2.0);
  craneGroup.add(hookBlock);

  root.add(craneGroup);
  interactiveObjects.push(craneGroup);

  return { root, interactiveObjects, cncSpindles };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. HIGH-FIDELITY PROCESSING CELL INTERIOR (Chemical Mixing, Pumping & Press)
// ─────────────────────────────────────────────────────────────────────────────
export function buildProcessingCellInterior() {
  const root = new THREE.Group();
  root.name = 'interior-processing';
  const room = createRoomShell(64, 48, 18);
  root.add(room);

  const interactiveObjects = [];
  const animatedMixers = [];
  const animatedPress = [];

  // Dedicated Materials for Processing Cell
  const spillPalletMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4, metalness: 0.2 });
  const drumBlueMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.45, metalness: 0.4 });
  const drumGreenMat = new THREE.MeshStandardMaterial({ color: 0x047857, roughness: 0.45, metalness: 0.4 });
  const drumDarkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.5 });
  const pipeCoolantMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.35, metalness: 0.5 });
  const pipeHydraulicMat = new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.35, metalness: 0.5 });
  const pipeAirMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35, metalness: 0.5 });
  const ibcTankMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.4, transparent: true, opacity: 0.88 });

  // ─────────────────────────────────────────────────────────────────────────
  // A. DUAL HIGH-SHEAR STAINLESS REACTION VESSELS / MIXERS (Rear Left)
  // ─────────────────────────────────────────────────────────────────────────
  const mixerConfigs = [
    { id: 'MIXER-01', name: 'High-Shear Chemical Reaction Reactor 01', x: -16, z: -10, status: 'RUNNING', health: 96, rpm: '350 RPM', temp: '65.4 °C', press: '4.2 Bar', cap: '8,500 L' },
    { id: 'MIXER-02', name: 'Batch Reaction & Lubricant Agitator 02', x: -3, z: -10, status: 'RUNNING', health: 98, rpm: '280 RPM', temp: '58.2 °C', press: '3.8 Bar', cap: '8,500 L' },
  ];

  mixerConfigs.forEach((cfg) => {
    const mixer = new THREE.Group();
    mixer.position.set(cfg.x, 0, cfg.z);
    mixer.userData = cfg;

    const tankRadius = 2.7;
    const tankH = 6.2;

    // 1. Stainless Cylindrical Reactor Tank Body (316L Polished Finish)
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(tankRadius, tankRadius, tankH, 28),
      stainlessMat
    );
    tank.position.y = 4.2;
    tank.castShadow = true;
    tank.receiveShadow = true;
    mixer.add(tank);

    // Top Elliptical Dome Head
    const topDome = new THREE.Mesh(
      new THREE.SphereGeometry(tankRadius, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2),
      stainlessMat
    );
    topDome.position.y = 4.2 + tankH / 2;
    mixer.add(topDome);

    // Bottom Dished Head
    const botDome = new THREE.Mesh(
      new THREE.SphereGeometry(tankRadius, 28, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      stainlessMat
    );
    botDome.position.y = 4.2 - tankH / 2;
    mixer.add(botDome);

    // 4 Tubular Stainless Support Legs with Floor Mounting Pads
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2 + Math.PI / 4;
      const legX = Math.cos(angle) * (tankRadius * 0.92);
      const legZ = Math.sin(angle) * (tankRadius * 0.92);

      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 2.8, 16), stainlessMat);
      leg.position.set(legX, 1.4, legZ);
      mixer.add(leg);

      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.1, 0.55), metalDarkMat);
      pad.position.set(legX, 0.05, legZ);
      mixer.add(pad);
    }

    // Top Agitator Electric Motor & Gearbox Unit
    const motorMount = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.6, 16), metalDarkMat);
    motorMount.position.y = 7.6;
    mixer.add(motorMount);

    const agitatorMotor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.65, 1.8, 16),
      new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.35, metalness: 0.5 })
    );
    agitatorMotor.position.y = 8.8;
    mixer.add(agitatorMotor);

    // Agitator Rotating Shaft Indicator
    const agitatorCap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 12), stainlessMat);
    agitatorCap.position.y = 9.85;
    mixer.add(agitatorCap);
    animatedMixers.push(agitatorCap);

    // Manway Inspection Port & Sight Glass Tube
    const manway = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.3, 16), metalDarkMat);
    manway.position.set(1.2, 7.3, 1.2);
    mixer.add(manway);

    const sightGlass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 3.8, 12),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.8 })
    );
    sightGlass.position.set(0, 4.2, tankRadius + 0.1);
    mixer.add(sightGlass);

    // Sanitary Actuator Valves & Pipe Connections
    const valveActuator = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 0.45, 12),
      new THREE.MeshStandardMaterial({ color: 0x0284c7 })
    );
    valveActuator.position.set(-tankRadius - 0.3, 3.2, 0);
    valveActuator.rotation.z = Math.PI / 2;
    mixer.add(valveActuator);

    // Glowing Floor Status Perimeter Ring
    const statusRing = new THREE.Mesh(
      new THREE.RingGeometry(3.6, 3.9, 32),
      new THREE.MeshBasicMaterial({ color: 0x10ff88, side: THREE.DoubleSide })
    );
    statusRing.rotation.x = -Math.PI / 2;
    statusRing.position.y = 0.04;
    mixer.add(statusRing);

    root.add(mixer);
    interactiveObjects.push(mixer);
  });

  // Interconnecting Stainless Process Pipes between Mixers
  const bridgePipe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 13, 12), pipeCoolantMat);
  bridgePipe.rotation.z = Math.PI / 2;
  bridgePipe.position.set(-9.5, 6.5, -10);
  root.add(bridgePipe);

  // ─────────────────────────────────────────────────────────────────────────
  // B. DUAL HIGH-PRESSURE HYDRAULIC COOLANT PUMP SKIDS (Rear Right)
  // ─────────────────────────────────────────────────────────────────────────
  const pumpConfigs = [
    { id: 'PUMP-01', name: 'High-Pressure Hydraulic Coolant Pump Skid 01', x: 12, z: -10, status: 'RUNNING', health: 95, flow: '210 L/min', press: '180 Bar', power: '45 kW' },
    { id: 'PUMP-02', name: 'Multi-Stage Booster Circulation Pump Skid 02', x: 23, z: -10, status: 'RUNNING', health: 97, flow: '210 L/min', press: '160 Bar', power: '45 kW' },
  ];

  pumpConfigs.forEach((cfg) => {
    const pump = new THREE.Group();
    pump.position.set(cfg.x, 0, cfg.z);
    pump.userData = cfg;

    const sW = 6.4;
    const sD = 3.8;

    // Structural Drip-Containment Skid Frame (Forest Green / Dark Slate)
    const skidBase = new THREE.Mesh(
      new THREE.BoxGeometry(sW, 0.5, sD),
      new THREE.MeshStandardMaterial({ color: 0x13211b, roughness: 0.6, metalness: 0.4 })
    );
    skidBase.position.y = 0.25;
    pump.add(skidBase);

    const skidRim = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(sW, 0.5, sD)),
      new THREE.LineBasicMaterial({ color: 0x059669, linewidth: 2 })
    );
    skidRim.position.y = 0.25;
    pump.add(skidRim);

    // Primary High-Pressure Electric Motor (Emerald Green)
    const motor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 0.85, 2.4, 20),
      new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.35, metalness: 0.5 })
    );
    motor.rotation.z = Math.PI / 2;
    motor.position.set(-1.2, 1.4, 0);
    pump.add(motor);

    // Motor Cooling Fan Shroud
    const fanShroud = new THREE.Mesh(
      new THREE.CylinderGeometry(0.88, 0.88, 0.5, 20),
      metalDarkMat
    );
    fanShroud.rotation.z = Math.PI / 2;
    fanShroud.position.set(-2.55, 1.4, 0);
    pump.add(fanShroud);

    // High-Pressure Centrifugal Pump Volute Casing & Shaft Coupling
    const pumpVolute = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 0.95, 1.4, 20),
      stainlessMat
    );
    pumpVolute.rotation.z = Math.PI / 2;
    pumpVolute.position.set(0.6, 1.4, 0);
    pump.add(pumpVolute);

    // Suction Duplex Basket Strainer
    const strainer = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 1.6, 16),
      stainlessMat
    );
    strainer.position.set(1.8, 1.5, 0.9);
    pump.add(strainer);

    // Vertical Discharge Piping & Check Valve Flanges
    const dischPipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 2.8, 12),
      pipeHydraulicMat
    );
    dischPipe.position.set(0.6, 3.0, 0);
    pump.add(dischPipe);

    const checkValve = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.6), metalDarkMat);
    checkValve.position.set(0.6, 2.8, 0);
    pump.add(checkValve);

    // Analog Pressure Gauges
    const pGauge = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 0.08, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    pGauge.rotation.x = Math.PI / 2;
    pGauge.position.set(0.6, 3.8, 0.22);
    pump.add(pGauge);

    // Electrical Terminal VFD Inverter Cabinet on Skid
    const vfdBox = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 2.2, 0.8),
      new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.3, metalness: 0.2 })
    );
    vfdBox.position.set(2.4, 1.4, -0.9);
    pump.add(vfdBox);

    const vfdScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.45), screenGlowMat);
    vfdScreen.position.set(2.4, 1.7, -0.48);
    pump.add(vfdScreen);

    // Glowing Floor Status Ring
    const statusRing = new THREE.Mesh(
      new THREE.RingGeometry(3.6, 3.9, 32),
      new THREE.MeshBasicMaterial({ color: 0x10ff88, side: THREE.DoubleSide })
    );
    statusRing.rotation.x = -Math.PI / 2;
    statusRing.position.y = 0.04;
    pump.add(statusRing);

    root.add(pump);
    interactiveObjects.push(pump);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // C. 1000-TON HEAVY-DUTY HYDRAULIC STAMPING PRESS (Front Left)
  // ─────────────────────────────────────────────────────────────────────────
  const pressGroup = new THREE.Group();
  pressGroup.position.set(-14, 0, 7.5);
  pressGroup.userData = { id: 'PRESS-01', name: '1000-Ton Hydraulic Forming & Stamping Press', status: 'RUNNING', health: 96, force: '950 Tons', cycle: '32 SPM', stroke: '450 mm' };

  const prW = 8.4;
  const prD = 6.2;
  const prH = 9.2;

  // 1. Monolithic Cast Steel Crown, Bed & Side Columns
  const pressCrown = new THREE.Mesh(
    new THREE.BoxGeometry(prW, 2.2, prD),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.6 })
  );
  pressCrown.position.y = prH - 1.1;
  pressGroup.add(pressCrown);

  const pressBed = new THREE.Mesh(
    new THREE.BoxGeometry(prW, 1.4, prD),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.6 })
  );
  pressBed.position.y = 0.7;
  pressGroup.add(pressBed);

  // 4 Massive Cylindrical Tie-Rod Guide Columns (Hard Chrome Plated)
  for (let cx of [-prW / 2 + 0.8, prW / 2 - 0.8]) {
    for (let cz of [-prD / 2 + 0.8, prD / 2 - 0.8]) {
      const column = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.35, prH - 2.8, 20),
        stainlessMat
      );
      column.position.set(cx, prH / 2, cz);
      pressGroup.add(column);
    }
  }

  // Signature Racing Blue Accent Stripe on Crown
  const pressTrim = new THREE.Mesh(
    new THREE.BoxGeometry(prW + 0.1, 0.4, prD + 0.1),
    new THREE.MeshStandardMaterial({ color: 0x0284c7 })
  );
  pressTrim.position.y = prH - 0.5;
  pressGroup.add(pressTrim);

  // 2. Master Overhead Hydraulic Cylinder & Chrome Ram Piston
  const hydCylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.4, 2.4, 24),
    metalDarkMat
  );
  hydCylinder.position.y = prH + 1.2;
  pressGroup.add(hydCylinder);

  const hydPiston = new THREE.Mesh(
    new THREE.CylinderGeometry(0.65, 0.65, 2.6, 20),
    stainlessMat
  );
  hydPiston.position.y = prH - 0.4;
  pressGroup.add(hydPiston);

  // 3. Moving Upper Slide Bolster & Precision Tooling Dies
  const slideBolster = new THREE.Mesh(
    new THREE.BoxGeometry(prW - 2.0, 1.2, prD - 2.0),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.6 })
  );
  slideBolster.position.y = 4.8;
  pressGroup.add(slideBolster);
  animatedPress.push(slideBolster);

  const upperDie = new THREE.Mesh(
    new THREE.BoxGeometry(prW - 3.2, 0.7, prD - 3.2),
    stainlessMat
  );
  upperDie.position.set(0, 4.0, 0);
  pressGroup.add(upperDie);

  const lowerDie = new THREE.Mesh(
    new THREE.BoxGeometry(prW - 3.0, 0.9, prD - 3.0),
    stainlessMat
  );
  lowerDie.position.set(0, 1.85, 0);
  pressGroup.add(lowerDie);

  // Stamped Sheet Metal Part on Lower Die
  const stampedPart = new THREE.Mesh(
    new THREE.BoxGeometry(prW - 4.2, 0.15, prD - 4.2),
    new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.9, roughness: 0.2 })
  );
  stampedPart.position.set(0, 2.35, 0);
  pressGroup.add(stampedPart);

  // 4. Optical Safety Light Curtain Beams (Infrared Safety Sensor Pillars)
  for (let side of [-1, 1]) {
    const lightPost = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 3.4, 0.2),
      new THREE.MeshStandardMaterial({ color: 0xfacc15 })
    );
    lightPost.position.set(side * (prW / 2 - 0.4), 3.2, prD / 2 - 0.2);
    pressGroup.add(lightPost);
  }

  const safetyBeamPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(prW - 1.2, 3.0),
    new THREE.MeshBasicMaterial({ color: 0x10ff88, transparent: true, opacity: 0.25, side: THREE.DoubleSide })
  );
  safetyBeamPlane.position.set(0, 3.2, prD / 2 - 0.2);
  pressGroup.add(safetyBeamPlane);

  // 5. Side Hydraulic Power Unit (HPU) Reservoir Skid & Heat Exchanger
  const hpuTank = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 2.4, 3.6),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.4 })
  );
  hpuTank.position.set(-prW / 2 - 1.6, 1.2, 0);
  pressGroup.add(hpuTank);

  const oilCooler = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 1.4, 1.4),
    metalDarkMat
  );
  oilCooler.position.set(-prW / 2 - 1.6, 3.1, 0);
  pressGroup.add(oilCooler);

  // 6. Two-Hand Anti-Tie-Down Operator Stand
  const opStand = new THREE.Group();
  opStand.position.set(0, 0, prD / 2 + 2.0);

  const standPedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 1.6, 12), metalDarkMat);
  standPedestal.position.y = 0.8;
  opStand.add(standPedestal);

  const standBar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 0.4), tslotMat);
  standBar.position.y = 1.6;
  opStand.add(standBar);

  for (let bx of [-0.6, 0.6]) {
    const palmBtn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.1, 16),
      new THREE.MeshBasicMaterial({ color: 0x10ff88 })
    );
    palmBtn.position.set(bx, 1.75, 0);
    opStand.add(palmBtn);
  }

  const hmiTouch = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.55), screenGlowMat);
  hmiTouch.position.set(0, 1.9, 0);
  opStand.add(hmiTouch);

  pressGroup.add(opStand);

  // Status Ring
  const pStatusRing = new THREE.Mesh(
    new THREE.RingGeometry(5.4, 5.7, 36),
    new THREE.MeshBasicMaterial({ color: 0x10ff88, side: THREE.DoubleSide })
  );
  pStatusRing.rotation.x = -Math.PI / 2;
  pStatusRing.position.y = 0.04;
  pressGroup.add(pStatusRing);

  root.add(pressGroup);
  interactiveObjects.push(pressGroup);

  // ─────────────────────────────────────────────────────────────────────────
  // D. ELEVATED MEZZANINE CATWALK, STAIRCASE & HEADER RACKS (Front Right)
  // ─────────────────────────────────────────────────────────────────────────
  const catwalkGroup = new THREE.Group();
  catwalkGroup.position.set(16, 0, 7.5);
  catwalkGroup.userData = { id: 'CATWALK-01', name: 'Elevated Process Mezzanine & Fluid Header Deck', status: 'RUNNING', health: 99 };

  const mLen = 18;
  const mW = 9.5;
  const mH = 4.4;

  // Galvanized Steel Structural Deck Grating
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(mLen, 0.35, mW),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6, metalness: 0.5 })
  );
  deck.position.y = mH;
  catwalkGroup.add(deck);

  // Heavy Structural H-Beam Support Columns
  for (let x of [-mLen / 2 + 0.8, 0, mLen / 2 - 0.8]) {
    for (let z of [-mW / 2 + 0.8, mW / 2 - 0.8]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.35, mH, 0.35), steelTrussMat);
      col.position.set(x, mH / 2, z);
      catwalkGroup.add(col);
    }
  }

  // Safety Yellow Industrial Handrails & Kickplates (OSHA Compliant)
  const railGeom = new THREE.EdgesGeometry(new THREE.BoxGeometry(mLen, 1.2, mW));
  const handrail = new THREE.LineSegments(railGeom, new THREE.LineBasicMaterial({ color: 0xfacc15, linewidth: 2 }));
  handrail.position.y = mH + 0.6;
  catwalkGroup.add(handrail);

  // Staircase from Floor to Mezzanine
  const stairGroup = new THREE.Group();
  stairGroup.position.set(-mLen / 2 - 1.8, 0, mW / 2 - 1.2);
  const numSteps = 12;
  for (let s = 0; s < numSteps; s++) {
    const stepH = (mH / numSteps) * (s + 1);
    const stepX = -s * 0.45;
    const stepMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.12, 1.8),
      tslotMat
    );
    stepMesh.position.set(stepX, stepH, 0);
    stairGroup.add(stepMesh);
  }
  catwalkGroup.add(stairGroup);

  // Overhead Color-Coded Suspended Header Pipe Racks
  const pipeZ = [-2.5, -0.8, 0.8, 2.5];
  const pipeMats = [pipeCoolantMat, pipeHydraulicMat, pipeAirMat, stainlessMat];
  pipeZ.forEach((pz, idx) => {
    const headerPipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, mLen + 4, 16),
      pipeMats[idx % pipeMats.length]
    );
    headerPipe.rotation.z = Math.PI / 2;
    headerPipe.position.set(0, mH + 3.2, pz);
    catwalkGroup.add(headerPipe);
  });

  root.add(catwalkGroup);
  interactiveObjects.push(catwalkGroup);

  // ─────────────────────────────────────────────────────────────────────────
  // E. DUPLEX MICRON FILTRATION & QUALITY SAMPLING SKID (Center-Front)
  // ─────────────────────────────────────────────────────────────────────────
  const filterSkid = new THREE.Group();
  filterSkid.position.set(3, 0, 16.5);
  filterSkid.userData = { id: 'FILTRATION-01', name: 'Duplex Micron Coolant Filtration & Testing Skid', status: 'RUNNING', health: 98, micron: '15 µm', deltaP: '0.4 Bar' };

  const fBase = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.4, 2.8), metalDarkMat);
  fBase.position.y = 0.2;
  filterSkid.add(fBase);

  // Dual Stainless Filter Vessel Canisters
  for (let fx of [-1.2, 1.2]) {
    const fCanister = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 2.4, 20),
      stainlessMat
    );
    fCanister.position.set(fx, 1.6, 0);
    filterSkid.add(fCanister);

    const fDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      stainlessMat
    );
    fDome.position.set(fx, 2.8, 0);
    filterSkid.add(fDome);
  }

  // Differential Pressure Digital Display
  const dpScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.55), screenGlowMat);
  dpScreen.position.set(0, 2.2, 1.41);
  filterSkid.add(dpScreen);

  root.add(filterSkid);
  interactiveObjects.push(filterSkid);

  // ─────────────────────────────────────────────────────────────────────────
  // F. CHEMICAL IBC TOTES, SPILL PALLETS & DRUM STAGING DEPOT (Front Left)
  // ─────────────────────────────────────────────────────────────────────────
  const drumDepot = new THREE.Group();
  drumDepot.position.set(-18, 0, 16.5);

  // 1. Heavy Yellow Polyethylene Spill Containment Sump Pallet
  const spillPallet = new THREE.Mesh(
    new THREE.BoxGeometry(6.4, 0.45, 3.4),
    spillPalletMat
  );
  spillPallet.position.y = 0.225;
  drumDepot.add(spillPallet);

  // 4 Standard 55-Gallon Steel Chemical & Lubricant Drums
  const drumColors = [drumBlueMat, drumGreenMat, drumDarkMat, drumBlueMat];
  let dIdx = 0;
  for (let dx of [-2.0, -0.7, 0.7, 2.0]) {
    const drum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.48, 1.7, 20),
      drumColors[dIdx % drumColors.length]
    );
    drum.position.set(dx, 1.3, 0);
    drum.castShadow = true;
    drumDepot.add(drum);

    // Chime Rolling Rings on Drums
    for (let yr of [0.8, 1.3, 1.8]) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 20), tslotMat);
      ring.position.set(dx, yr, 0);
      drumDepot.add(ring);
    }
    dIdx++;
  }

  // 2. Intermediate Bulk Container (IBC) 1000L Chemical Tote
  const ibcGroup = new THREE.Group();
  ibcGroup.position.set(6.2, 0, 0);

  const ibcTank = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 2.2, 2.2),
    ibcTankMat
  );
  ibcTank.position.y = 1.25;
  ibcGroup.add(ibcTank);

  const ibcCage = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(2.25, 2.25, 2.25)),
    new THREE.LineBasicMaterial({ color: 0x94a3b8, linewidth: 2 })
  );
  ibcCage.position.y = 1.25;
  ibcGroup.add(ibcCage);

  drumDepot.add(ibcGroup);

  // 3. Emergency Eyewash & Safety Shower Station (Right Corner)
  const showerGroup = new THREE.Group();
  showerGroup.position.set(-28, 0, 16.5);

  const showerPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.4, 12), pipeHydraulicMat);
  showerPipe.position.y = 2.2;
  showerGroup.add(showerPipe);

  const showerHead = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.3, 16), spillPalletMat);
  showerHead.position.set(0.4, 4.4, 0);
  showerGroup.add(showerHead);

  const eyewashBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.25, 0.25, 16), spillPalletMat);
  eyewashBowl.position.set(0.4, 2.2, 0);
  showerGroup.add(eyewashBowl);

  root.add(showerGroup);
  root.add(drumDepot);

  return { root, interactiveObjects, animatedMixers, animatedPress };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5, 6, 7, 8: QUALITY, UTILITY, COOLING, MATERIAL
// ─────────────────────────────────────────────────────────────────────────────
export function buildPackagingCellInterior() {
  return buildGenericFacilityInterior('packaging', 'Product Packaging & Palletizing');
}

export function buildMaintenanceBayInterior() {
  return buildGenericFacilityInterior('maintenance', 'Overhaul Maintenance & Diagnostics Bay');
}

export function buildGenericFacilityInterior(typeKey, nameTitle) {
  const root = new THREE.Group();
  root.name = `interior-${typeKey}`;
  const room = createRoomShell(64, 48, 18);
  root.add(room);

  const interactiveObjects = [];

  const mainAsset = new THREE.Mesh(
    new THREE.BoxGeometry(12, 5.0, 8),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.3, metalness: 0.7 })
  );
  mainAsset.position.set(0, 2.5, -4);
  mainAsset.userData = { id: `${typeKey.toUpperCase()}-01`, name: `${nameTitle} Unit`, status: 'RUNNING', health: 99 };
  root.add(mainAsset);
  interactiveObjects.push(mainAsset);

  const desk = createOperatorControlDesk(16, 14, Math.PI);
  root.add(desk);

  return { root, interactiveObjects };
}

function createSafetyFenceSection(x1, z1, x2, z2, h = 2.6) {
  const group = new THREE.Group();
  const dx = x2 - x1;
  const dz = z2 - z1;
  const len = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dx, dz);

  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.08, h, len), fenceMeshMat);
  panel.position.set((x1 + x2) / 2, h / 2, (z1 + z2) / 2);
  panel.rotation.y = angle;
  group.add(panel);

  const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, len), fenceMat);
  topRail.position.set((x1 + x2) / 2, h, (z1 + z2) / 2);
  topRail.rotation.y = angle;
  group.add(topRail);

  const post1 = new THREE.Mesh(new THREE.BoxGeometry(0.22, h + 0.2, 0.22), fenceMat);
  post1.position.set(x1, (h + 0.2) / 2, z1);
  group.add(post1);

  const post2 = new THREE.Mesh(new THREE.BoxGeometry(0.22, h + 0.2, 0.22), fenceMat);
  post2.position.set(x2, (h + 0.2) / 2, z2);
  group.add(post2);

  return group;
}

function createOperatorControlDesk(x, z, rotY = 0) {
  const desk = new THREE.Group();
  desk.position.set(x, 0, z);
  desk.rotation.y = rotY;

  const top = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.14, 2.0), tslotMat);
  top.position.set(0, 1.4, 0);
  desk.add(top);

  for (let m = -0.8; m <= 0.8; m += 1.6) {
    const monitor = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.8, 0.08), tslotBracketMat);
    monitor.position.set(m, 2.05, -0.4);
    monitor.rotation.y = m < 0 ? 0.16 : -0.16;
    desk.add(monitor);

    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7), screenGlowMat);
    screen.position.set(m, 2.05, -0.35);
    screen.rotation.y = monitor.rotation.y;
    desk.add(screen);
  }

  return desk;
}
