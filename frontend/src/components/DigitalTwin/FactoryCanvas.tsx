import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { Machine, TelemetryData, WorkOrder } from '../../types';
import { IndustrialBuildingExterior } from './IndustrialBuildingAssets';
import { CampusGroundPlanes } from './CampusGroundPlanes';
import { CampusRoadNetwork } from './CampusRoadNetwork';
import { MachiningCellInteriorDetail } from './MachiningCellInterior';
import { ProcessingCellInteriorDetail } from './ProcessingCellInterior';
import { AssemblyCellInteriorDetail } from './AssemblyCellInterior';
import { RobotCellInteriorDetail } from './RobotCellInterior';
import { PackagingCellInteriorDetail } from './PackagingCellInterior';
import { MaintenanceBayInteriorDetail } from './MaintenanceBayInterior';
import { GoodsAreaLogistics } from './GoodsAreaLogistics';
import { PlantForkliftLogistics } from './PlantForkliftLogistics';
import { Asset } from './GLBAsset';
import { ZoneId, getZoneStatusCounts, zoneIdForMachineCode } from './zoneData';

const ROAD_KIT = '/models/kenney-city-kit-roads';
const FACTORY_KIT = '/models/kenney-factory-kit';
const CITY_KIT_INDUSTRIAL = '/models/kenney-city-kit-industrial';

// ─────────────────────────────────────────────────────────────────────────────
// Types & Interfaces
// ─────────────────────────────────────────────────────────────────────────────
export type LayerConfig = {
  machines: boolean;
  machineLabels: boolean;
  workers: boolean;
  workerLabels: boolean;
  supervisors: boolean;
  safetyZones: boolean;
  walkways: boolean;
  liveSensors: boolean;
  buildings: boolean;
  roads: boolean;
  trees: boolean;
  vehicles: boolean;
};

export type CameraPresetType =
  | 'OVERVIEW'
  | 'MACHINING'
  | 'ROBOT'
  | 'PROCESSING'
  | 'ASSEMBLY'
  | 'PACKAGING'
  | 'MAINTENANCE';

export type ViewLevel = 'PLANT' | 'INTERIOR';

interface FactoryCanvasProps {
  machines: Machine[];
  selectedMachine: Machine | null;
  onSelectMachine: (m: Machine | null) => void;
  onSelectTechnician?: (machineCode: string) => void;
  layers: LayerConfig;
  resetTrigger?: number;
  cameraPreset?: CameraPresetType;
  onPresetChange?: (p: CameraPresetType) => void;
  liveTelemetry?: Record<string, TelemetryData>;
  dispatchedTarget?: string | null;
  viewLevel?: ViewLevel;
  workOrders?: WorkOrder[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Status Colors (Warm Industrial Palette)
// ─────────────────────────────────────────────────────────────────────────────
const S_COLOR: Record<string, string> = {
  RUNNING:       '#22A06B',
  WARNING:       '#D99A06',
  FAULT:         '#D64545',
  WAITING_PARTS: '#7C5CC4',
  MAINTENANCE:   '#3978C8',
  VERIFYING:     '#7C5CC4',
  OFFLINE:       '#7A7A73',
};

// ─────────────────────────────────────────────────────────────────────────────
// 6-Zone Machine Coordinates  (FW=110, FD=72) — buildings physically separated
// by road-width gaps; Row 0 (z ≈ -20): Machining | Robot | Processing
// Row 1 (z ≈ +15): Assembly  | Packaging | Maintenance
// ─────────────────────────────────────────────────────────────────────────────
const MACHINE_COORDS: Record<string, [number, number, number]> = {
  // ── MACHINING CELL (center x≈-35, z≈-20.5) ──
  'CNC-01': [-42, 0, -25],
  'CNC-02': [-35, 0, -25],
  'CNC-03': [-28, 0, -25],
  'CNC-04': [-42, 0, -16],
  'CNC-05': [-35, 0, -16],
  'CNC-06': [-28, 0, -16],
  // ── ROBOT CELL — shifted left to leave spacious buffer for East forklift bay ──
  'ROBOT-01': [24,  0, -25.5],
  'ROBOT-02': [34,  0, -25.5],
  'ROBOT-03': [24,  0, -15.5],
  'ROBOT-04': [34,  0, -15.5],
  // ── PROCESSING CELL — swapped with Robot, now center x≈0, z≈-21 — 3-col x 2-row grid ──
  'MIXER-01':   [-8, 0, -25.5],
  'PUMP-01':    [ 0, 0, -25.5],
  'PRESS-01':   [ 8, 0, -25.5],
  'PROCESS-01': [-8, 0, -15.5],
  'PROCESS-02': [ 0, 0, -15.5],
  // ── ASSEMBLY CELL (center x≈-35, z≈15) — 2x2 grid, spread to fill zone ──
  'ASMB-01': [-40, 0, 10],
  'ASMB-02': [-30, 0, 10],
  'ASMB-03': [-40, 0, 20],
  'ASMB-04': [-30, 0, 20],
  // ── PACKAGING CELL (center x≈+31, z≈+16) — 3 vertical lines (North to South) ──
  'PACK-01': [32.0, 0, 10.5],
  'PACK-02': [32.0, 0, 16.0],
  'PACK-03': [32.0, 0, 21.5],
  // ── MAINTENANCE BAY — swapped with Packaging, now center x≈0, z≈+15.5 — 2 up, 1 centered below ──
  'BENCH-01': [-6, 0, 11.5],
  'BENCH-02': [6, 0, 11.5],
  'TEST-01':  [0, 0, 21.5],
};

// Zone definitions for boundaries and supervisor labels
export const ZONE_DEFS = [
  {
    id: 'MACHINING',
    label: 'MACHINING CELL',
    supervisor: 'Arun Kumar',
    machines: 6,
    cx: -35, cz: -20.5, hw: 14.5, hd: 11.5,
    floorColor: '#DCE4EC',
    badgeColor: '#D97706',
  },
  {
    // Swapped with Processing — now sits in the east slot of the north row.
    id: 'ROBOT',
    label: 'ROBOT CELL',
    supervisor: 'Priya Nair',
    machines: 4,
    cx: 33, cz: -20.5, hw: 14.5, hd: 11.5,
    floorColor: '#D9E7E5',
    badgeColor: '#2563EB',
  },
  {
    // Swapped with Robot — now sits in the center slot of the north row.
    id: 'PROCESSING',
    label: 'PROCESSING CELL',
    supervisor: 'Wei Zhang',
    machines: 5,
    cx: 0, cz: -21, hw: 12, hd: 10.5,
    floorColor: '#EDE2CC',
    badgeColor: '#059669',
  },
  {
    id: 'ASSEMBLY',
    label: 'ASSEMBLY CELL',
    supervisor: 'Carlos Gomez',
    machines: 4,
    cx: -35, cz: 15, hw: 12, hd: 10,
    floorColor: '#DEE3EA',
    badgeColor: '#EA580C',
  },
  {
    // Swapped with Maintenance — now sits in the east slot of the south row.
    id: 'PACKAGING',
    label: 'PACKAGING CELL',
    supervisor: 'Tom Wilson',
    machines: 3,
    cx: 31, cz: 16, hw: 13.5, hd: 11.5,
    floorColor: '#EBDFD0',
    badgeColor: '#CA8A04',
  },
  {
    // Swapped with Packaging — now sits in the center slot of the south row.
    id: 'MAINTENANCE',
    label: 'MAINTENANCE BAY',
    supervisor: 'Sarah Jenkins',
    machines: 3,
    cx: 0, cz: 15.5, hw: 11.5, hd: 10,
    floorColor: '#E3D9E8',
    badgeColor: '#7C3AED',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Status Beacon Tower (Signal Lamp)
// ─────────────────────────────────────────────────────────────────────────────
const StatusBeacon: React.FC<{ color: string; isFault: boolean; position?: [number, number, number] }> = ({
  color, isFault, position = [0, 0, 0]
}) => {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    if (isFault && ref.current.material && 'emissiveIntensity' in ref.current.material) {
      (ref.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.0 + Math.sin(t * 7) * 1.0;
    }
  });
  return (
    <group position={position}>
      <mesh position={[0, -0.25, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.5, 8]} />
        <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh ref={ref} position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.18, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={isFault ? 1.8 : 1.1} roughness={0.2} />
      </mesh>
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Machine Operating Zone & Status Ring
// ─────────────────────────────────────────────────────────────────────────────
const MachineZoneRing: React.FC<{ color: string; isSelected: boolean; isFault: boolean; radius?: number }> = ({
  color, isSelected, isFault, radius = 2.2
}) => {
  const ringRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (ringRef.current) ringRef.current.rotation.z += 0.005;
    if (glowRef.current && isFault) {
      const t = state.clock.elapsedTime;
      const mat = glowRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.15 + Math.sin(t * 5) * 0.12;
    }
  });

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
        <circleGeometry args={[radius, 36]} />
        <meshBasicMaterial color={color} transparent opacity={isSelected ? 0.22 : 0.08} />
      </mesh>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <ringGeometry args={[radius - 0.1, radius + 0.08, 36]} />
        <meshBasicMaterial color={color} transparent opacity={isSelected ? 0.9 : 0.65} side={THREE.DoubleSide} />
      </mesh>
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.014, 0]}>
          <ringGeometry args={[radius + 0.2, radius + 0.45, 48]} />
          <meshBasicMaterial color="#2563EB" transparent opacity={0.65} side={THREE.DoubleSide} />
        </mesh>
      )}
      {isFault && (
        <mesh ref={glowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <circleGeometry args={[radius + 0.6, 32]} />
          <meshBasicMaterial color="#D64545" transparent opacity={0.2} />
        </mesh>
      )}
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared neutral-industrial tints for every GLB-composed machine (CNC,
// Mixer, Pump, Press, Processing Units) — bodies stay gray/dark-gray
// regardless of machine state; RUNNING/WARNING/FAULT/MAINTENANCE/VERIFYING
// is communicated only by MachineZoneRing (floor ring, rendered by the
// caller) and each machine's small StatusBeacon light, never by recoloring
// the machine body itself.
// ─────────────────────────────────────────────────────────────────────────────
const MACHINE_BODY_TINT = '#9CA3AE';
const MACHINE_DARK_TINT = '#525863';
const MACHINE_TINT_STRENGTH = 0.82;

// Shared E-stop button — no real mushroom-button asset exists in either kit
// (reporting rather than substituting an unrelated prop); this simple
// procedural dome+base is exactly the kind of "simple repeated detail" the
// asset-pipeline rule allows staying procedural. Reused by every machine
// type below. Stays a fixed hazard red regardless of machine status.
const EmergencyStopButton: React.FC<{ position: [number, number, number] }> = ({ position }) => (
  <group position={position}>
    <mesh><cylinderGeometry args={[0.05, 0.05, 0.03, 10]} /><meshStandardMaterial color="#F3F1EC" /></mesh>
    <mesh position={[0, 0.035, 0]}><sphereGeometry args={[0.055, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#D64545" roughness={0.5} /></mesh>
  </group>
);

// ─────────────────────────────────────────────────────────────────────────────
// CNC Milling Machine Geometry
// ─────────────────────────────────────────────────────────────────────────────

// Same base+chamber module every CNC-01..06 instance shares (per spec:
// "machines can share the same base GLB/model, vary position/orientation/
// small details") — built from Kenney Factory Kit modular pieces:
// machine-bed (base cabinet) + machine-window (upper windowed chamber) +
// door+lever (side access) + screen+lever+box-small (control-panel ledge on
// the base's exposed step) + piston-round (roof turret) + a procedural
// coolant hose + cable conduit (simple pipes/cables stay procedural per the
// asset-pipeline rule; the enclosure itself is the "complex equipment" GLB).
const CNCMachineMesh: React.FC<{ color: string; isSelected: boolean; isFault: boolean; code?: string }> = ({
  color, isSelected, isFault, code
}) => {
  // Small per-instance variation ("small visual details") — every other CNC
  // mirrors its access door/ledge to the opposite side, so six identical
  // machines don't read as one model pasted six times.
  const mirror = ((code ? parseInt(code.replace(/\D/g, ''), 10) : 0) % 2) === 1 ? -1 : 1;
  const bodyTint = isSelected ? '#6B7C93' : MACHINE_BODY_TINT;

  const hoseCurve = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(mirror * 0.6, 1.35, -0.7),
    new THREE.Vector3(mirror * 0.75, 1.75, -0.55),
    new THREE.Vector3(mirror * 0.55, 2.05, -0.2),
    new THREE.Vector3(mirror * 0.3, 2.05, 0.1),
  ]), [mirror]);

  return (
    <group scale={1.6}>
      {/* Base cabinet + upper windowed machining chamber, stacked so the
          chamber sits on the LEFT/CENTER of the base, exposing a "step"
          ledge on the right for the control panel / chip tray. */}
      <Asset url={`${FACTORY_KIT}/machine-bed.glb`} rotation={[0, mirror < 0 ? Math.PI : 0, 0]} tint={bodyTint} tintStrength={MACHINE_TINT_STRENGTH} />
      <Asset url={`${FACTORY_KIT}/machine-window.glb`} position={[0, 1.3, 0]} tint={bodyTint} tintStrength={MACHINE_TINT_STRENGTH} />

      {/* Control-panel ledge: display, handle, chip tray */}
      <Asset url={`${FACTORY_KIT}/screen-small.glb`} position={[mirror * 1.2, 1.3, -0.3]} rotation={[0, mirror > 0 ? 0 : Math.PI, 0]} tint="#1E293B" tintStrength={0.9} />
      <Asset url={`${FACTORY_KIT}/lever-single.glb`} position={[mirror * 1.2, 1.3, 0.4]} tint={MACHINE_DARK_TINT} tintStrength={0.75} />
      <Asset url={`${FACTORY_KIT}/box-small.glb`} position={[mirror * 1.2, 1.3, 1.1]} scale={0.85} tint={MACHINE_DARK_TINT} tintStrength={0.55} />

      {/* Side access door + handle, on the base cabinet's outer face */}
      <Asset url={`${FACTORY_KIT}/door.glb`} position={[-mirror * 0.62, 0.75, 0.3]} rotation={[0, -mirror * Math.PI / 2, 0]} tint={MACHINE_DARK_TINT} tintStrength={0.75} />
      <Asset url={`${FACTORY_KIT}/lever-single.glb`} position={[-mirror * 0.85, 0.75, 0.55]} rotation={[0, -mirror * Math.PI / 2, 0]} scale={0.7} tint={MACHINE_DARK_TINT} tintStrength={0.75} />

      {/* Roof-mounted tool-changer turret accent */}
      <Asset url={`${FACTORY_KIT}/piston-round.glb`} position={[0, 2.6, 0]} scale={0.5} tint={MACHINE_DARK_TINT} tintStrength={0.8} />

      {/* Front output/load tray */}
      <Asset url={`${FACTORY_KIT}/top.glb`} position={[0, 1.3, 0.85]} scale={0.65} tint={bodyTint} tintStrength={0.7} />

      <EmergencyStopButton position={[0.55, 1.35, 0.76]} />

      {/* Procedural coolant hose (curved tube) + cable conduit (straight
          run) — simple/repeated connections stay procedural per the
          asset-pipeline rule, not more GLB parts. */}
      <mesh>
        <tubeGeometry args={[hoseCurve, 16, 0.035, 6, false]} />
        <meshStandardMaterial color="#1E293B" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.15, -1.0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, 1.9, 8]} />
        <meshStandardMaterial color="#334155" roughness={0.7} />
      </mesh>

      {/* Centered directly above the roof turret (turret top ≈ y=3.1) —
          was offset to [1.15, 3.2, -0.9], which put it outside the
          machine's own footprint and read as a separate light pole
          standing beside/behind the machine instead of mounted on it. */}
      <StatusBeacon color={color} isFault={isFault} position={[0, 3.3, 0]} />
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Industrial Robotic Arm (4 pose variants) — Stage 4. The articulated arm
// stays procedural (it needs the custom joint hierarchy the pose animation
// rotates every frame; swapping it for a rigid GLB would break that rig for
// no visual gain), but the stationary base/turret/controller cabinet now use
// real Factory Kit pieces instead of bare cylinders/boxes, plus a real E-stop.
// ─────────────────────────────────────────────────────────────────────────────
const RobotArmMesh: React.FC<{ color: string; isSelected: boolean; isFault: boolean; pose?: number }> = ({
  color, isSelected, isFault, pose = 0
}) => {
  const baseWaistRef = useRef<THREE.Group>(null);
  const shoulderRef = useRef<THREE.Group>(null);
  const elbowRef = useRef<THREE.Group>(null);
  const wristRef = useRef<THREE.Group>(null);
  const arcFlashRef = useRef<THREE.Mesh>(null);
  const sparksRef = useRef<THREE.Group>(null);
  const weldLightRef = useRef<THREE.PointLight>(null);
  const [isWelding, setIsWelding] = React.useState(false);

  // Pose configuration:
  // pose 0: ROBOT-01 (NW, base at z=-25.5, reaches +Z towards conveyor at z=-23.2)
  // pose 1: ROBOT-02 (NE, base at z=-25.5, reaches +Z towards conveyor at z=-23.2)
  // pose 2: ROBOT-03 (SW, base at z=-15.5, reaches -Z towards conveyor at z=-17.8)
  // pose 3: ROBOT-04 (SE, base at z=-15.5, reaches -Z towards conveyor at z=-17.8)
  const isNorth = pose < 2;
  // baseDirection: 0 for North robots (points +Z towards conveyor), Math.PI for South robots (points -Z towards conveyor)
  const baseDirection = isNorth ? 0 : Math.PI;

  // 10-second synchronized step-and-weld cycle:
  // 0s - 2.5s: Conveyor moving, robot in ready hover
  // 2.5s - 7.8s: Conveyor stopped, robot performs active seam welding
  // 7.8s - 10.0s: Robot retracts, conveyor advances
  useFrame((state) => {
    if (isFault) {
      if (isWelding) setIsWelding(false);
      return;
    }

    const cycleDuration = 10.0;
    const cycleTime = (state.clock.elapsedTime + (pose % 2) * 4.5) % cycleDuration;
    const weldingActive = cycleTime >= 2.5 && cycleTime <= 7.8;

    if (weldingActive !== isWelding) {
      setIsWelding(weldingActive);
    }

    // 1. Waist rotation: tracks smoothly along the seam during welding
    if (baseWaistRef.current) {
      if (weldingActive) {
        const weldProgress = (cycleTime - 2.5) / 5.3;
        const seamSweep = (weldProgress - 0.5) * 0.18;
        baseWaistRef.current.rotation.y = baseDirection + seamSweep;
      } else {
        baseWaistRef.current.rotation.y = baseDirection;
      }
    }

    // 2. Shoulder & Elbow Kinematics (reaching forward in local +Z towards the conveyor fixture at dz = 1.50m):
    if (shoulderRef.current && elbowRef.current && wristRef.current) {
      if (weldingActive) {
        // Precise welding pose reaching exactly 1.50m down to y = 1.12m on the workpiece seam
        shoulderRef.current.rotation.x = 0.20;
        elbowRef.current.rotation.x = 0.32;
        wristRef.current.rotation.x = -0.46;
      } else {
        // Retracted / Standby Hover clearance pose
        shoulderRef.current.rotation.x = 0.06;
        elbowRef.current.rotation.x = 0.12;
        wristRef.current.rotation.x = -0.15;
      }
    }

    // 3. Dynamic Electric Arc Flash & Flying Sparks
    if (weldingActive) {
      const flicker = 0.65 + Math.sin(state.clock.elapsedTime * 45) * 0.35;
      if (arcFlashRef.current) {
        arcFlashRef.current.visible = true;
        (arcFlashRef.current.material as THREE.MeshBasicMaterial).opacity = flicker;
        arcFlashRef.current.scale.setScalar(0.8 + flicker * 0.6);
      }
      if (weldLightRef.current) {
        weldLightRef.current.intensity = flicker * 3.2;
      }
      if (sparksRef.current) {
        sparksRef.current.visible = true;
        sparksRef.current.rotation.z = state.clock.elapsedTime * 15;
      }
    } else {
      if (arcFlashRef.current) arcFlashRef.current.visible = false;
      if (weldLightRef.current) weldLightRef.current.intensity = 0;
      if (sparksRef.current) sparksRef.current.visible = false;
    }
  });

  const robotColor = isSelected ? '#38BDF8' : isFault ? '#EF4444' : '#F59E0B'; // KUKA / Fanuc Industrial Amber
  const darkMetal = '#0F172A';
  const jointMetal = '#1E293B';
  const chromeMetal = '#CBD5E1';
  const copperTorch = '#D97706';

  return (
    <group>
      {/* ── 1. RIGID CAST STEEL FLOOR PEDESTAL & SAFETY RADIUS ── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <ringGeometry args={[1.8, 1.95, 32]} />
        <meshBasicMaterial color={isSelected ? '#38BDF8' : '#F59E0B'} transparent opacity={0.35} />
      </mesh>

      {/* Heavy Base Flange bolted to floor */}
      <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.85, 0.95, 0.3, 16]} />
        <meshStandardMaterial color={darkMetal} roughness={0.5} metalness={0.8} />
      </mesh>
      {/* 4 Steel Anchor Bolt Collars */}
      {[-0.6, 0.6].map((bx, bxi) =>
        [-0.6, 0.6].map((bz, bzi) => (
          <mesh key={`${bxi}-${bzi}`} position={[bx, 0.32, bz]}>
            <cylinderGeometry args={[0.06, 0.06, 0.08, 8]} />
            <meshStandardMaterial color={jointMetal} metalness={0.9} />
          </mesh>
        ))
      )}

      {/* ── 2. ROTATING TURNTABLE WAIST (Axis 1) ── */}
      <group ref={baseWaistRef} position={[0, 0.3, 0]}>
        {/* Turntable Bearing Ring */}
        <mesh position={[0, 0.1, 0]} castShadow>
          <cylinderGeometry args={[0.68, 0.72, 0.2, 24]} />
          <meshStandardMaterial color={jointMetal} roughness={0.3} metalness={0.9} />
        </mesh>

        {/* Heavy Cast Turret Base Housing */}
        <mesh position={[0, 0.42, 0]} castShadow>
          <boxGeometry args={[0.85, 0.55, 0.75]} />
          <meshStandardMaterial color={robotColor} roughness={0.35} metalness={0.5} />
        </mesh>
        {/* Servo Motor Housing on Side */}
        <mesh position={[0.48, 0.42, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.18, 0.18, 0.25, 16]} />
          <meshStandardMaterial color={darkMetal} roughness={0.5} metalness={0.7} />
        </mesh>

        {/* ── 3. SHOULDER JOINT & LOWER BOOM ARM (Axis 2) ── */}
        <group ref={shoulderRef} position={[0, 0.7, 0]}>
          {/* Shoulder Rotary Joint Hub */}
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.28, 0.28, 0.75, 20]} />
            <meshStandardMaterial color={jointMetal} roughness={0.3} metalness={0.8} />
          </mesh>

          {/* Solid Rigid Lower Arm Boom (Single Solid Casting reaching local +Z) */}
          <mesh position={[0, 0.85, 0.3]} rotation={[0.35, 0, 0]} castShadow>
            <boxGeometry args={[0.34, 1.65, 0.38]} />
            <meshStandardMaterial color={robotColor} roughness={0.35} metalness={0.5} />
          </mesh>
          {/* Counterbalance Gas Strut */}
          <mesh position={[0.2, 0.7, -0.1]} rotation={[-0.15, 0, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 1.0, 12]} />
            <meshStandardMaterial color={chromeMetal} roughness={0.15} metalness={0.95} />
          </mesh>

          {/* ── 4. FOREARM ELBOW (Axis 3) ── */}
          <group ref={elbowRef} position={[0, 1.6, 0.6]}>
            {/* Elbow Pivot Knuckle */}
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.24, 0.24, 0.65, 18]} />
              <meshStandardMaterial color={jointMetal} roughness={0.3} metalness={0.8} />
            </mesh>

            {/* Forearm Casting reaching forward in local +Z */}
            <mesh position={[0, 0.65, 0.45]} rotation={[0.65, 0, 0]} castShadow>
              <boxGeometry args={[0.28, 1.4, 0.3]} />
              <meshStandardMaterial color={robotColor} roughness={0.35} metalness={0.5} />
            </mesh>
            {/* Weld Cable / Gas Hose Guide on top of arm */}
            <mesh position={[0, 0.7, 0.55]} rotation={[0.65, 0, 0]}>
              <cylinderGeometry args={[0.035, 0.035, 1.35, 8]} />
              <meshStandardMaterial color={darkMetal} roughness={0.8} />
            </mesh>

            {/* ── 5. ARTICULATED 2-AXIS WRIST (Axes 4, 5, 6) ── */}
            <group ref={wristRef} position={[0, 1.25, 1.0]}>
              {/* Wrist Pivot Head */}
              <mesh castShadow>
                <sphereGeometry args={[0.18, 16, 16]} />
                <meshStandardMaterial color={darkMetal} roughness={0.4} metalness={0.8} />
              </mesh>
              {/* ISO Tool Mounting Flange */}
              <mesh position={[0, -0.15, 0.1]}>
                <cylinderGeometry args={[0.14, 0.14, 0.08, 16]} />
                <meshStandardMaterial color={jointMetal} metalness={0.9} />
              </mesh>

              {/* ── 6. INDUSTRIAL MIG/MAG WELDING TORCH (GOOSENECK) ── */}
              <group position={[0, -0.3, 0.2]} rotation={[-0.5, 0, 0]}>
                {/* Torch Body / Barrel */}
                <mesh castShadow>
                  <cylinderGeometry args={[0.06, 0.07, 0.35, 12]} />
                  <meshStandardMaterial color={darkMetal} roughness={0.4} metalness={0.8} />
                </mesh>
                {/* Curved Gooseneck Tube */}
                <mesh position={[0, -0.22, 0.08]} rotation={[0.5, 0, 0]}>
                  <cylinderGeometry args={[0.04, 0.04, 0.25, 12]} />
                  <meshStandardMaterial color={copperTorch} roughness={0.3} metalness={0.9} />
                </mesh>
                {/* Ceramic Gas Nozzle & Contact Tip */}
                <mesh position={[0, -0.38, 0.18]} rotation={[0.5, 0, 0]}>
                  <cylinderGeometry args={[0.045, 0.03, 0.12, 12]} />
                  <meshStandardMaterial color="#F59E0B" roughness={0.2} metalness={0.8} />
                </mesh>

                {/* ── 7. ACTIVE WELDING ARC FLASH & FLYING SPARKS FX ── */}
                <group position={[0, -0.46, 0.24]}>
                  {/* Brilliant Electric Arc Flash Flare */}
                  <mesh ref={arcFlashRef} visible={false}>
                    <sphereGeometry args={[0.15, 12, 12]} />
                    <meshBasicMaterial color="#E0F2FE" transparent opacity={0.95} />
                  </mesh>
                  {/* Dynamic Arc Light Illumination */}
                  <pointLight ref={weldLightRef} color="#60A5FA" intensity={0} distance={5.5} />

                  {/* Flying Welding Sparks (Angular Particle Rays) */}
                  <group ref={sparksRef} visible={false}>
                    {[-0.15, 0.0, 0.15].map((sx, si) =>
                      [-0.15, 0.0, 0.15].map((sz, szi) => (
                        <mesh key={`spark-${si}-${szi}`} position={[sx, -0.1 - Math.random() * 0.15, sz]}>
                          <boxGeometry args={[0.02, 0.12, 0.02]} />
                          <meshBasicMaterial color="#FDE047" />
                        </mesh>
                      ))
                    )}
                  </group>
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>

      {/* ── 8. WIRE FEEDER & SHIELDING GAS TANK RACK (Placed on outer side) ── */}
      <group position={[isNorth ? -1.1 : 1.1, 0, isNorth ? -1.0 : 1.0]}>
        {/* Wire Feeder Drum Console */}
        <mesh position={[0, 0.65, 0]} castShadow>
          <boxGeometry args={[0.6, 1.3, 0.55]} />
          <meshStandardMaterial color="#1E293B" roughness={0.4} metalness={0.6} />
        </mesh>
        {/* Argon Shielding Gas Cylinder Bottle */}
        <mesh position={[0.38, 0.8, 0]} castShadow>
          <cylinderGeometry args={[0.14, 0.14, 1.5, 16]} />
          <meshStandardMaterial color="#0284C7" roughness={0.3} metalness={0.7} />
        </mesh>
        {/* Gas Pressure Regulator Gauge */}
        <mesh position={[0.38, 1.6, 0]}>
          <sphereGeometry args={[0.07, 8, 8]} />
          <meshStandardMaterial color={chromeMetal} metalness={0.95} />
        </mesh>

        <EmergencyStopButton position={[0.22, 1.05, 0.28]} />
        <StatusBeacon color={color} isFault={isFault} position={[0, 1.55, 0]} />
      </group>
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Hydraulic Pump — machine.glb body/motor + real pipe-kit inlet/outlet/valve,
// procedural mounting base/gauge/cable (simple, repeated details).
// ─────────────────────────────────────────────────────────────────────────────
const PumpMesh: React.FC<{ color: string; isSelected: boolean; isFault: boolean }> = ({ color, isSelected, isFault }) => {
  const bodyTint = isSelected ? '#6B7C93' : MACHINE_BODY_TINT;
  return (
    <group scale={1.4}>
      {/* Mounting base */}
      <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.6, 0.2, 1.8]} />
        <meshStandardMaterial color={MACHINE_DARK_TINT} metalness={0.5} roughness={0.5} />
      </mesh>

      {/* Pump body / motor housing */}
      <Asset url={`${FACTORY_KIT}/machine.glb`} position={[-0.3, 0.2, 0]} scale={0.85} tint={bodyTint} tintStrength={MACHINE_TINT_STRENGTH} />

      {/* Motor coupling stub */}
      <mesh position={[0.55, 0.75, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.16, 0.16, 0.3, 12]} />
        <meshStandardMaterial color={MACHINE_DARK_TINT} metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Inlet / outlet pipes + valve — pulled in closer to the body (was
          -1.0/0.55 x-offsets with a 0.85-scaled, -0.3-offset body, leaving
          the pipe ends short of actually reaching it) so each pipe's end
          overlaps the housing instead of floating just short of it. */}
      <Asset url={`${FACTORY_KIT}/pipe-large-bend.glb`} position={[-0.75, 0.2, -0.4]} rotation={[0, Math.PI, 0]} scale={0.75} tint={bodyTint} tintStrength={0.7} />
      <Asset url={`${FACTORY_KIT}/pipe-large-bend.glb`} position={[0.35, 0.2, 0.55]} rotation={[0, Math.PI / 2, 0]} scale={0.75} tint={bodyTint} tintStrength={0.7} />
      <Asset url={`${FACTORY_KIT}/pipe-large-valve.glb`} position={[0.35, 0.2, 1.15]} scale={0.7} tint={MACHINE_DARK_TINT} tintStrength={0.7} />

      {/* Pressure gauge (simple procedural disc + needle) */}
      <group position={[0.1, 1.0, 0.4]} rotation={[0, -0.4, 0]}>
        <mesh><cylinderGeometry args={[0.16, 0.16, 0.04, 16]} /><meshStandardMaterial color="#F3F1EC" /></mesh>
        <mesh position={[0, 0.021, 0.05]} rotation={[Math.PI / 2, 0, 0.6]}><boxGeometry args={[0.01, 0.12, 0.01]} /><meshStandardMaterial color="#1E293B" /></mesh>
      </group>

      {/* Electrical connection stub */}
      <mesh position={[-1.1, 0.45, -0.3]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 0.5, 8]} />
        <meshStandardMaterial color="#1E293B" roughness={0.7} />
      </mesh>

      {/* Centered directly above the pump/motor housing */}
      <StatusBeacon color={color} isFault={isFault} position={[-0.3, 1.65, 0]} />
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Agitator Mixer — hopper-high-round vessel + machine.glb motor/gearbox top
// assembly + a real inspection-hatch door, keeping the existing animated
// procedural shaft/legs (simple, repeated — stays procedural by design).
// ─────────────────────────────────────────────────────────────────────────────
const MixerMesh: React.FC<{ color: string; isSelected: boolean; isFault: boolean }> = ({ color, isSelected, isFault }) => {
  const agitatorRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (agitatorRef.current) agitatorRef.current.rotation.y = state.clock.elapsedTime * 2.5;
  });
  const bodyTint = isSelected ? '#6B7C93' : MACHINE_BODY_TINT;
  return (
    <group scale={1.15}>
      {/* Support pedestal — hopper-high-round tapers to a narrow spout at its
          own base, so legs splayed out at a wide radius (the previous
          design) never actually touch it, reading as a floating vessel with
          a visible gap to the tripod below. A single centered pedestal wide
          enough to intersect the spout regardless of its exact taper fixes
          that, with a small strut pair for visual interest. */}
      <mesh position={[0, 0.95, 0]} castShadow>
        <cylinderGeometry args={[0.42, 0.5, 1.9, 12]} />
        <meshStandardMaterial color={MACHINE_DARK_TINT} metalness={0.6} roughness={0.4} />
      </mesh>
      {[0.9, -0.9].map((x, i) => (
        <mesh key={i} position={[x, 0.5, 0]} rotation={[0, 0, Math.PI / 2.6]} castShadow>
          <boxGeometry args={[0.14, 1.3, 0.14]} />
          <meshStandardMaterial color={MACHINE_DARK_TINT} metalness={0.7} roughness={0.3} />
        </mesh>
      ))}

      {/* Mixing vessel — lowered slightly so its base overlaps the pedestal top */}
      <Asset url={`${FACTORY_KIT}/hopper-high-round.glb`} position={[0, 1.75, 0]} scale={2.1} tint={bodyTint} tintStrength={0.7} />

      {/* Inspection hatch on the vessel side */}
      <Asset url={`${FACTORY_KIT}/door.glb`} position={[1.15, 1.45, 0]} rotation={[0, Math.PI / 2, 0]} scale={0.55} tint={MACHINE_DARK_TINT} tintStrength={0.7} />

      {/* Motor + gearbox top assembly */}
      <Asset url={`${FACTORY_KIT}/machine.glb`} position={[0, 4.35, 0]} scale={0.7} tint={MACHINE_DARK_TINT} tintStrength={0.8} />
      <Asset url={`${FACTORY_KIT}/cog-a.glb`} position={[0.5, 4.8, 0]} scale={0.45} tint={MACHINE_DARK_TINT} tintStrength={0.75} />

      {/* Control box */}
      <Asset url={`${FACTORY_KIT}/screen-small.glb`} position={[1.2, 0.3, 0.6]} rotation={[0, -0.5, 0]} scale={0.7} tint="#1E293B" tintStrength={0.9} />

      {/* Inlet/outlet valve at the base */}
      <Asset url={`${FACTORY_KIT}/pipe-large-valve.glb`} position={[-1.1, 0.2, 0.5]} scale={0.6} tint={MACHINE_DARK_TINT} tintStrength={0.7} />

      {/* Motor coupling + rotating agitator shaft (animated, procedural) —
          shaft deliberately overlaps down into the pedestal/vessel join so
          there's no visible seam where it enters the vessel. */}
      <mesh position={[0, 3.95, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.3, 12]} />
        <meshStandardMaterial color={MACHINE_DARK_TINT} metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh ref={agitatorRef} position={[0, 2.75, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 2.3, 8]} />
        <meshStandardMaterial color="#64748B" metalness={0.9} />
      </mesh>

      {/* Centered directly above the motor/gearbox top */}
      <StatusBeacon color={color} isFault={isFault} position={[0, 5.15, 0]} />
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Hydraulic Press — structure-high frame + a real piston as the hydraulic
// cylinder/ram, machine-window-bar as the barred safety guard.
// ─────────────────────────────────────────────────────────────────────────────
const PressMesh: React.FC<{ color: string; isFault: boolean }> = ({ color, isFault }) => (
  <group scale={1.3}>
    {/* Base + press bed */}
    <mesh position={[0, 0.25, 0]} castShadow>
      <boxGeometry args={[2.5, 0.5, 2.0]} />
      <meshStandardMaterial color={MACHINE_DARK_TINT} metalness={0.6} roughness={0.4} />
    </mesh>
    <Asset url={`${FACTORY_KIT}/top-large.glb`} position={[0, 0.82, 0]} scale={0.85} tint={MACHINE_BODY_TINT} tintStrength={0.7} />

    {/* Structural frame uprights — native structure-high is 1.5 tall; the
        previous uniform scale=1.9 only reached y≈3.35, leaving a visible gap
        below the crown at y=4.55. Non-uniform scale stretches height to
        reach the crown exactly while keeping the post/beam cross-section
        reasonable (uniform 1.9 would also have made them implausibly thick). */}
    <Asset url={`${FACTORY_KIT}/structure-high.glb`} position={[-0.9, 0.5, 0]} scale={[1.3, 2.7, 1.3]} tint={MACHINE_BODY_TINT} tintStrength={MACHINE_TINT_STRENGTH} />
    <Asset url={`${FACTORY_KIT}/structure-high.glb`} position={[0.9, 0.5, 0]} scale={[1.3, 2.7, 1.3]} tint={MACHINE_BODY_TINT} tintStrength={MACHINE_TINT_STRENGTH} />

    {/* Crown / header */}
    <mesh position={[0, 4.9, 0]} castShadow>
      <boxGeometry args={[2.4, 0.7, 1.2]} />
      <meshStandardMaterial color={MACHINE_DARK_TINT} metalness={0.6} roughness={0.4} />
    </mesh>

    {/* Hydraulic cylinder + ram — mounted flush under the crown (its natural
        anchor point) and extending down most of the way toward the bed,
        leaving working clearance above the bed rather than floating
        disconnected from both ends as it did before. */}
    <Asset url={`${FACTORY_KIT}/piston-square.glb`} position={[0, 2.05, 0]} scale={[0.9, 2.5, 0.9]} tint={MACHINE_DARK_TINT} tintStrength={0.8} />

    {/* Hydraulic hoses (procedural, simple curved tubes) */}
    {[-0.7, 0.7].map((x, i) => (
      <mesh key={i}>
        <tubeGeometry args={[new THREE.CatmullRomCurve3([
          new THREE.Vector3(x, 4.7, 0.5),
          new THREE.Vector3(x * 1.15, 4.0, 0.65),
          new THREE.Vector3(x * 1.05, 3.2, 0.5),
          new THREE.Vector3(x * 0.6, 2.8, 0.45),
        ]), 16, 0.04, 6, false]} />
        <meshStandardMaterial color="#1E293B" roughness={0.6} metalness={0.3} />
      </mesh>
    ))}

    {/* Control panel + safety guard */}
    <Asset url={`${FACTORY_KIT}/screen-small.glb`} position={[-1.35, 0.85, 0.5]} rotation={[0, 0.5, 0]} scale={0.75} tint="#1E293B" tintStrength={0.9} />
    <Asset url={`${FACTORY_KIT}/machine-window-bar.glb`} position={[0, 1.55, 0.85]} scale={0.65} tint={MACHINE_BODY_TINT} tintStrength={0.6} />
    <EmergencyStopButton position={[1.3, 0.9, 0.5]} />

    <StatusBeacon color={color} isFault={isFault} position={[0, 5.5, 0]} />
  </group>
);

// ─────────────────────────────────────────────────────────────────────────────
// Generic Processing Unit (PROCESS-01, PROCESS-02) — full integrated skid:
// a proper standing pressure vessel + a secondary accumulator + a base pump
// + platform/railing + piping between all of them + a control panel. This
// replaces the earlier bare-tank version, which read as a single
// disconnected part rather than a complete piece of process equipment.
//
// The vessel is detail-tank.glb turned on end (rotated 90° about Z) rather
// than left lying down — that model's long axis becomes the vertical axis,
// and a non-uniform scale stretches it into a proper slender standing tank
// instead of the squat horizontal barrel it is by default.
// ─────────────────────────────────────────────────────────────────────────────
const ProcessingUnitMesh: React.FC<{ color: string; isSelected: boolean; isFault: boolean; code?: string }> = ({ color, isSelected, isFault, code }) => {
  const mirror = ((code ? parseInt(code.replace(/\D/g, ''), 10) : 0) % 2) === 1 ? -1 : 1;
  const bodyTint = isSelected ? '#6B7C93' : MACHINE_BODY_TINT;
  return (
    <group scale={1.5}>
      {/* Base support ring for the main vessel */}
      <mesh position={[0, 0.15, 0]} castShadow>
        <cylinderGeometry args={[0.55, 0.62, 0.3, 14]} />
        <meshStandardMaterial color={MACHINE_DARK_TINT} metalness={0.5} roughness={0.5} />
      </mesh>

      {/* Main standing pressure vessel */}
      <Asset url={`${CITY_KIT_INDUSTRIAL}/detail-tank.glb`} position={[0, 1.35, 0]} rotation={[0, mirror > 0 ? 0 : Math.PI, Math.PI / 2]} scale={[3.2, 1.4, 1.4]} tint={bodyTint} tintStrength={0.7} />
      {/* Dome cap */}
      <mesh position={[0, 2.7, 0]}>
        <sphereGeometry args={[0.42, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={bodyTint} metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Top nozzle + valve, mounted flush on the dome */}
      <mesh position={[0, 2.85, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.3, 10]} />
        <meshStandardMaterial color={MACHINE_DARK_TINT} metalness={0.6} roughness={0.4} />
      </mesh>
      <Asset url={`${FACTORY_KIT}/pipe-large-valve.glb`} position={[0, 3.0, 0]} scale={0.5} tint={MACHINE_DARK_TINT} tintStrength={0.7} />

      {/* Secondary accumulator vessel beside the main tank */}
      <Asset url={`${FACTORY_KIT}/piston-round.glb`} position={[mirror * 1.15, 0, 0.25]} scale={[0.55, 2.0, 0.55]} tint={bodyTint} tintStrength={0.7} />
      <mesh position={[mirror * 1.15, 2.0, 0.25]}>
        <sphereGeometry args={[0.28, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={bodyTint} metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Connecting pipe between the two vessels */}
      <Asset url={`${FACTORY_KIT}/pipe-large.glb`} position={[mirror * 0.6, 1.6, 0.15]} rotation={[0, mirror > 0 ? 0.5 : -0.5, 0]} scale={0.55} tint={bodyTint} tintStrength={0.7} />

      {/* Base pump unit, connected to the main vessel by a floor pipe */}
      <Asset url={`${FACTORY_KIT}/machine.glb`} position={[-mirror * 1.05, 0, 0.9]} scale={0.45} tint={bodyTint} tintStrength={MACHINE_TINT_STRENGTH} />
      <Asset url={`${FACTORY_KIT}/pipe-large-bend.glb`} position={[-mirror * 0.35, 0.13, 0.55]} rotation={[0, mirror > 0 ? Math.PI : 0, 0]} scale={0.5} tint={bodyTint} tintStrength={0.7} />

      {/* Control panel */}
      <Asset url={`${FACTORY_KIT}/machine-window.glb`} position={[mirror * 1.1, 0, -0.9]} scale={0.45} tint={bodyTint} tintStrength={MACHINE_TINT_STRENGTH} />
      <Asset url={`${FACTORY_KIT}/screen-small.glb`} position={[mirror * 1.1, 0.55, -0.65]} rotation={[0, mirror > 0 ? Math.PI : 0, 0]} scale={0.5} tint="#1E293B" tintStrength={0.9} />

      {/* Gauge on the vessel body */}
      <group position={[0.36, 1.5, 0]} rotation={[0, 0, 0]}>
        <mesh><cylinderGeometry args={[0.14, 0.14, 0.04, 14]} /><meshStandardMaterial color="#F3F1EC" /></mesh>
        <mesh position={[0, 0, 0.023]}><cylinderGeometry args={[0.1, 0.1, 0.01, 14]} /><meshStandardMaterial color="#1E293B" /></mesh>
      </group>

      {/* Access platform with a simple safety railing (procedural posts +
          rail, in PlantOps's existing safety-yellow) */}
      <Asset url={`${FACTORY_KIT}/catwalk-straight.glb`} position={[0, 0.05, -1.15]} scale={1.1} tint={MACHINE_DARK_TINT} tintStrength={0.6} />
      {[-0.75, -0.25, 0.25, 0.75].map((x, i) => (
        <mesh key={i} position={[x, 0.35, -1.5]}>
          <cylinderGeometry args={[0.025, 0.025, 0.5, 6]} />
          <meshStandardMaterial color="#D9A441" metalness={0.4} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, 0.58, -1.5]}>
        <boxGeometry args={[1.65, 0.03, 0.03]} />
        <meshStandardMaterial color="#D9A441" metalness={0.4} roughness={0.5} />
      </mesh>

      {/* Centered directly above the main vessel's dome */}
      <StatusBeacon color={color} isFault={isFault} position={[0, 3.3, 0]} />
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Assembly Workstation (ASMB-01..04) — Stage 5. Fixture table (procedural —
// a flat surface + legs is exactly the "simple" case the asset-pipeline rule
// allows staying procedural) paired with a real conveyor segment, pneumatic
// actuator, sensor and control cabinet, so it reads as a production-line
// station rather than a bare table. Even/odd instances mirror their
// conveyor/cabinet side, matching the CNC/Processing variation pattern.
// ─────────────────────────────────────────────────────────────────────────────
const AssemblyWorkstationMesh: React.FC<{ color: string; isSelected: boolean; isFault: boolean; code?: string }> = ({ color, isSelected, isFault, code }) => {
  const mirror = ((code ? parseInt(code.replace(/\D/g, ''), 10) : 0) % 2) === 1 ? -1 : 1;
  const bodyTint = isSelected ? '#6B7C93' : MACHINE_BODY_TINT;
  return (
    <group scale={1.3}>
      {/* Work table top + legs */}
      <mesh position={[0, 1.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.0, 0.1, 1.8]} />
        <meshStandardMaterial color={MACHINE_BODY_TINT} metalness={0.2} roughness={0.6} />
      </mesh>
      {[[-1.3, -0.8], [-1.3, 0.8], [1.3, -0.8], [1.3, 0.8]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.55, z]}>
          <boxGeometry args={[0.1, 1.1, 0.1]} />
          <meshStandardMaterial color={MACHINE_DARK_TINT} metalness={0.6} />
        </mesh>
      ))}

      {/* Component bins on table — parts trays, not machine body, so keep
          their functional color coding (matches the reference layout) */}
      {[-0.8, 0, 0.8].map((x, i) => (
        <mesh key={i} position={[x, 1.25, -0.6]} castShadow>
          <boxGeometry args={[0.5, 0.28, 0.35]} />
          <meshStandardMaterial color={['#2563EB', '#D97706', '#059669'][i]} roughness={0.8} />
        </mesh>
      ))}

      {/* Pneumatic actuator, mounted above the table pointing down */}
      <Asset url={`${FACTORY_KIT}/piston-thin-square.glb`} position={[mirror * 0.3, 1.15, 0.5]} rotation={[Math.PI, 0, 0]} scale={0.7} tint={MACHINE_DARK_TINT} tintStrength={0.8} />
      {/* Fixture clamp */}
      <Asset url={`${FACTORY_KIT}/lever-double.glb`} position={[mirror * -0.3, 1.15, 0.5]} scale={0.6} tint={MACHINE_DARK_TINT} tintStrength={0.75} />

      {/* Sensor / vision scanner at the table edge */}
      <Asset url={`${FACTORY_KIT}/scanner-low.glb`} position={[mirror * 1.6, 0, 0.9]} rotation={[0, -mirror * 0.6, 0]} scale={0.6} tint={bodyTint} tintStrength={0.7} />

      {/* Control cabinet */}
      <Asset url={`${FACTORY_KIT}/machine-window.glb`} position={[-mirror * 1.9, 0, -0.7]} scale={0.55} tint={bodyTint} tintStrength={MACHINE_TINT_STRENGTH} />

      {/* Tool cart */}
      <mesh position={[-1.8, 0.7, 0.9]} castShadow>
        <boxGeometry args={[0.7, 1.4, 0.5]} />
        <meshStandardMaterial color={MACHINE_DARK_TINT} metalness={0.5} roughness={0.5} />
      </mesh>

      {/* Real conveyor segment feeding into the station */}
      <Asset url={`${FACTORY_KIT}/conveyor-long.glb`} position={[2.9, 0.65, 0]} scale={0.85} tint={MACHINE_DARK_TINT} tintStrength={0.65} />

      {/* Centered above the table/actuator assembly */}
      <StatusBeacon color={color} isFault={isFault} position={[0, 1.75, 0]} />
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Packaging Machine (Kenney Factory Kit Straight Flow Asset Assemblies)
// ─────────────────────────────────────────────────────────────────────────────
const PackagingMachineMesh: React.FC<{ color: string; isSelected: boolean; isFault?: boolean; code?: string }> = ({
  color,
  isSelected,
  isFault = false,
  code = 'PACK-01',
}) => {
  const bodyTint = isSelected ? '#5B7088' : '#334155';

  return (
    <group scale={1.25}>
      {/* Heavy Straight Modular Conveyor Base Segment */}
      <Asset
        url={`${FACTORY_KIT}/conveyor-long-stripe-sides.glb`}
        position={[0, 0.45, 0]}
        scale={[1.5, 1.35, 1.4]}
        tint={bodyTint}
        tintStrength={0.75}
      />

      {/* ── 1. CASE PACKING MACHINE (PACK-01) ── */}
      {code === 'PACK-01' && (
        <group>
          {/* Straight Pass-Through Machining Chamber */}
          <Asset
            url={`${FACTORY_KIT}/machine-window.glb`}
            position={[0, 0.65, 0]}
            scale={[1.4, 1.3, 1.4]}
            tint="#CBD5E1"
            tintStrength={0.6}
          />
          {/* Top Pneumatic Feeder Cylinder */}
          <Asset
            url={`${FACTORY_KIT}/piston-square.glb`}
            position={[0, 1.95, 0]}
            scale={0.75}
            tint="#D97706"
            tintStrength={0.8}
          />
          {/* Digital HMI Touch Console */}
          <Asset
            url={`${FACTORY_KIT}/screen-small.glb`}
            position={[-0.85, 0.9, 0.55]}
            rotation={[0, 0.4, 0]}
            scale={0.65}
            tint="#0F172A"
            tintStrength={0.9}
          />
        </group>
      )}

      {/* ── 2. FLAP SEALING & STRAPPING MACHINE (PACK-02) ── */}
      {code === 'PACK-02' && (
        <group>
          {/* Guarded Straight Sealing Chamber */}
          <Asset
            url={`${FACTORY_KIT}/machine-window-bar.glb`}
            position={[0, 0.65, 0]}
            scale={[1.4, 1.3, 1.4]}
            tint="#94A3B8"
            tintStrength={0.7}
          />
          {/* Top Compression Ram */}
          <Asset
            url={`${FACTORY_KIT}/piston-thin-square.glb`}
            position={[0, 1.9, 0]}
            scale={0.85}
            tint="#EAB308"
            tintStrength={0.8}
          />
          {/* Operator Lever */}
          <Asset
            url={`${FACTORY_KIT}/lever-single.glb`}
            position={[-0.85, 0.85, 0.55]}
            scale={0.7}
            tint="#EF4444"
            tintStrength={0.9}
          />
          {/* Digital Screen */}
          <Asset
            url={`${FACTORY_KIT}/screen-small.glb`}
            position={[-0.85, 0.9, -0.55]}
            rotation={[0, -0.4, 0]}
            scale={0.65}
            tint="#0F172A"
            tintStrength={0.9}
          />
        </group>
      )}

      {/* ── 3. AUTOMATED BARCODE & RFID LABELING / SCANNER (PACK-03) ── */}
      {code === 'PACK-03' && (
        <group>
          {/* High-Resolution Vision Scanner Bridge Arch */}
          <Asset
            url={`${FACTORY_KIT}/scanner-low.glb`}
            position={[0, 0.65, 0]}
            scale={[1.4, 1.4, 1.4]}
            tint="#38BDF8"
            tintStrength={0.8}
          />
          {/* Upper Vision Camera Array */}
          <Asset
            url={`${FACTORY_KIT}/scanner-high.glb`}
            position={[0, 0.65, 0]}
            scale={[1.15, 1.2, 1.15]}
          />
          {/* Label Applicator Mechanism */}
          <Asset
            url={`${FACTORY_KIT}/machine.glb`}
            position={[0.7, 0.65, 0]}
            scale={0.55}
            tint="#2563EB"
            tintStrength={0.7}
          />
          {/* Warning Safety Sign */}
          <Asset
            url={`${FACTORY_KIT}/warning-orange.glb`}
            position={[-0.8, 0.75, 0.55]}
            scale={0.6}
          />
          {/* Digital Terminal */}
          <Asset
            url={`${FACTORY_KIT}/screen-small.glb`}
            position={[-0.85, 0.9, -0.55]}
            rotation={[0, -0.4, 0]}
            scale={0.65}
            tint="#0F172A"
            tintStrength={0.9}
          />
        </group>
      )}

      {/* Status Signal Beacon on Top */}
      <StatusBeacon color={color} isFault={isFault} position={[0, 2.35, 0]} />
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Maintenance Bench / Test Station
// ─────────────────────────────────────────────────────────────────────────────
const MaintenanceBenchMesh: React.FC<{ color: string; isSelected: boolean; variant?: 'bench' | 'test' }> = ({
  color, isSelected, variant = 'bench'
}) => (
  <group>
    {/* Workbench surface */}
    <mesh position={[0, 1.0, 0]} castShadow receiveShadow>
      <boxGeometry args={[3.0, 0.12, 1.6]} />
      <meshStandardMaterial color={isSelected ? '#FBBF24' : '#D97706'} metalness={0.1} roughness={0.8} />
    </mesh>
    {/* Bench legs */}
    {[[-1.3, -0.6], [-1.3, 0.6], [1.3, -0.6], [1.3, 0.6]].map(([x, z], i) => (
      <mesh key={i} position={[x, 0.5, z]}>
        <boxGeometry args={[0.1, 1.0, 0.1]} />
        <meshStandardMaterial color="#475569" metalness={0.6} />
      </mesh>
    ))}
    {/* Tool cabinet */}
    <mesh position={[-2.0, 0.85, 0]} castShadow>
      <boxGeometry args={[0.8, 1.7, 1.2]} />
      <meshStandardMaterial color="#475569" metalness={0.4} roughness={0.6} />
    </mesh>
    {/* Drawer handles */}
    {[0.3, 0.7, 1.1].map((y, i) => (
      <mesh key={i} position={[-1.58, y, 0]}>
        <boxGeometry args={[0.04, 0.06, 0.35]} />
        <meshStandardMaterial color="#CBD5E1" metalness={0.9} />
      </mesh>
    ))}
    {variant === 'bench' && (
      <>
        {/* Spare parts on bench */}
        {[-0.6, 0, 0.6].map((x, i) => (
          <mesh key={i} position={[x, 1.18, 0.4]} castShadow>
            <cylinderGeometry args={[0.18, 0.18, 0.25, 10]} />
            <meshStandardMaterial color={['#94A3B8', '#CBD5E1', '#64748B'][i]} metalness={0.7} />
          </mesh>
        ))}
      </>
    )}
    <StatusBeacon color={color} isFault={false} position={[1.2, 1.3, -0.7]} />
  </group>
);

// ─────────────────────────────────────────────────────────────────────────────
// Floating Live Sensor Callouts (Selected Machine)
// ─────────────────────────────────────────────────────────────────────────────
const SelectedMachineSensors: React.FC<{ telemetry?: TelemetryData; isFault: boolean }> = ({ telemetry, isFault }) => {
  const temp = telemetry?.temperature ?? (isFault ? 82.4 : 62.0);
  const vib  = telemetry?.vibration   ?? (isFault ? 9.40 : 2.20);
  const curr = telemetry?.current     ?? 12.5;
  const pres = telemetry?.pressure    ?? 5.2;

  return (
    <Html center distanceFactor={14} zIndexRange={[10, 0]}>
      <div className="flex items-center gap-1.5 pointer-events-none select-none animate-fade-in -mt-20">
        <div className="px-2 py-1 bg-white/95 backdrop-blur-md rounded-lg border border-red-200 shadow-md flex items-center gap-1 text-[10px] font-bold text-slate-800">
          <span className="text-red-500">🌡️</span>
          <span>{temp.toFixed(1)}°C</span>
        </div>
        <div className="px-2 py-1 bg-white/95 backdrop-blur-md rounded-lg border border-blue-200 shadow-md flex items-center gap-1 text-[10px] font-bold text-slate-800">
          <span className="text-blue-500">〰️</span>
          <span>{vib.toFixed(2)} mm/s</span>
        </div>
        <div className="px-2 py-1 bg-white/95 backdrop-blur-md rounded-lg border border-amber-200 shadow-md flex items-center gap-1 text-[10px] font-bold text-slate-800">
          <span className="text-amber-500">⚡</span>
          <span>{curr.toFixed(1)}A</span>
        </div>
        {pres > 0 && (
          <div className="px-2 py-1 bg-white/95 backdrop-blur-md rounded-lg border border-teal-200 shadow-md flex items-center gap-1 text-[10px] font-bold text-slate-800">
            <span className="text-teal-500">◉</span>
            <span>{pres.toFixed(1)} bar</span>
          </div>
        )}
      </div>
    </Html>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Machine Label Overlay
// ─────────────────────────────────────────────────────────────────────────────
const MachineLabel: React.FC<{
  code: string;
  status: string;
  health: number;
  color: string;
  isSelected: boolean;
  isFault: boolean;
  visible: boolean;
  onClick: () => void;
}> = ({ code, status, health, color, isSelected, isFault, visible, onClick }) => {
  if (!visible) return null;
  return (
    <Html center distanceFactor={14} zIndexRange={[10, 0]}>
      <div
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className={`cursor-pointer select-none px-2.5 py-1.5 rounded-xl transition-all ${
          isSelected
            ? 'bg-[#FAF9F6] border-2 shadow-lg ring-2 ring-blue-500/20 scale-105'
            : 'bg-[#FAF9F6]/95 border shadow-sm hover:scale-102 hover:shadow-md'
        }`}
        style={{ borderColor: isSelected ? color : '#DDD9D0', minWidth: '94px', fontFamily: 'Inter, system-ui, sans-serif' }}
      >
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
            <span className="font-extrabold text-[11px] text-[#1E293B] tracking-tight">{code}</span>
          </div>
          {isFault && <span className="text-[10px] animate-bounce">⚠️</span>}
        </div>
        <div className="flex items-center justify-between text-[9px] font-bold mt-1" style={{ color }}>
          <span className="uppercase tracking-wider">{status}</span>
          <span className="font-mono text-[#1E293B]">{health}%</span>
        </div>
        <div className="h-1 bg-[#DDD9D0] rounded-full overflow-hidden mt-1">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${health}%`, background: color }} />
        </div>
      </div>
    </Html>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Worker Figure (Hover Tooltip)
// ─────────────────────────────────────────────────────────────────────────────
const WorkerFigure: React.FC<{
  position: [number, number, number];
  rotation?: number;
  name: string;
  role: string;
  activity: string;
  showAlways: boolean;
  helmetColor?: string;
}> = ({ position, rotation = 0, name, role, activity, showAlways, helmetColor = '#FFFFFF' }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <group position={position} rotation={[0, rotation, 0]}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}>
      {[-0.1, 0.1].map((x, i) => (
        <mesh key={i} position={[x, 0.1, 0]}>
          <boxGeometry args={[0.18, 0.2, 0.26]} />
          <meshStandardMaterial color="#1A1A1A" roughness={0.9} />
        </mesh>
      ))}
      {[-0.1, 0.1].map((x, i) => (
        <mesh key={i} position={[x, 0.55, 0]}>
          <boxGeometry args={[0.18, 0.7, 0.2]} />
          <meshStandardMaterial color="#334155" roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[0, 1.1, 0]}>
        <boxGeometry args={[0.44, 0.6, 0.28]} />
        <meshStandardMaterial color="#FACC15" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.0, 0.15]}>
        <boxGeometry args={[0.42, 0.06, 0.02]} />
        <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={0.4} />
      </mesh>
      {[-0.26, 0.26].map((x, i) => (
        <mesh key={i} position={[x, 1.05, 0.08]} rotation={[0.4, 0, i === 0 ? 0.2 : -0.2]}>
          <boxGeometry args={[0.14, 0.5, 0.16]} />
          <meshStandardMaterial color="#FACC15" roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[0, 1.05, 0.28]} rotation={[0.4, 0, 0]}>
        <boxGeometry args={[0.26, 0.18, 0.02]} />
        <meshStandardMaterial color="#0F172A" />
      </mesh>
      <mesh position={[0, 1.05, 0.29]} rotation={[0.4, 0, 0]}>
        <boxGeometry args={[0.22, 0.14, 0.01]} />
        <meshStandardMaterial color="#38BDF8" emissive="#38BDF8" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0, 1.62, 0]}>
        <boxGeometry args={[0.24, 0.26, 0.24]} />
        <meshStandardMaterial color="#FED7AA" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.82, 0]}>
        <cylinderGeometry args={[0.22, 0.2, 0.16, 12]} />
        <meshStandardMaterial color={helmetColor} metalness={0.2} roughness={0.4} />
      </mesh>
      {(hovered || showAlways) && (
        <Html position={[0, 2.3, 0]} center distanceFactor={16} zIndexRange={[10, 0]}>
          <div className="bg-[#FAF9F6] border border-[#DDD9D0] rounded-xl px-3 py-1.5 shadow-lg select-none pointer-events-none text-center min-w-[120px] animate-fade-in">
            <div className="font-extrabold text-[11px] text-[#1E293B]">{name}</div>
            <div className="text-[9px] font-semibold text-[#0F766E]">{role}</div>
            <div className="text-[8px] text-[#64748B] mt-0.5">{activity}</div>
          </div>
        </Html>
      )}
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Section Boundary (floor tint + safety stripe border)
// ─────────────────────────────────────────────────────────────────────────────
const SectionBoundary: React.FC<{
  cx: number; cz: number; hw: number; hd: number;
  floorColor: string; showSafety: boolean;
}> = ({ cx, cz, hw, hd, floorColor, showSafety }) => (
  <group position={[cx, 0.002, cz]}>
    {/* Tinted floor — the building itself now covers most of this (up to
        ~88% of zone width), so what used to read as "one big zone tint" is
        mostly a border now; a higher opacity keeps that border legible
        against the equally light-gray campus ground. */}
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[hw * 2, hd * 2]} />
      <meshBasicMaterial color={floorColor} transparent opacity={0.8} />
    </mesh>
    {/* Safety stripe border */}
    {showSafety && (
      <>
        {/* N/S border strips */}
        {[-hd, hd].map((dz, i) => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, dz]}>
            <planeGeometry args={[hw * 2, 0.35]} />
            <meshBasicMaterial color="#EAB308" transparent opacity={0.75} />
          </mesh>
        ))}
        {/* E/W border strips */}
        {[-hw, hw].map((dx, i) => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[dx, 0.001, 0]}>
            <planeGeometry args={[0.35, hd * 2]} />
            <meshBasicMaterial color="#EAB308" transparent opacity={0.75} />
          </mesh>
        ))}
        {/* Corner bollards */}
        {[[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]].map(([bx, bz], i) => (
          <mesh key={i} position={[bx, 0.5, bz]}>
            <cylinderGeometry args={[0.14, 0.16, 1.0, 8]} />
            <meshStandardMaterial color="#EAB308" emissive="#EAB308" emissiveIntensity={0.15} />
          </mesh>
        ))}
      </>
    )}
  </group>
);

// ─────────────────────────────────────────────────────────────────────────────
// Supervisor Zone Label (HTML overlay, clean floating card)
// ─────────────────────────────────────────────────────────────────────────────
const SectionSupervisorLabel: React.FC<{
  label: string;
  supervisor: string;
  machineCount: number;
  badgeColor: string;
  position: [number, number, number];
  visible: boolean;
  zoneNumber: number;
  counts?: { running: number; warning: number; fault: number; maintenance: number };
  onSelectZone?: () => void;
}> = ({ label, supervisor, machineCount, badgeColor, position, visible, zoneNumber, counts, onSelectZone }) => {
  if (!visible) return null;
  return (
    <Html position={position} center distanceFactor={28} zIndexRange={[5, 0]}>
      <div
        className="select-none px-3 py-2 rounded-xl shadow-lg border cursor-pointer hover:shadow-xl transition-shadow"
        style={{
          background: 'rgba(250,249,246,0.96)',
          borderColor: badgeColor,
          borderWidth: 1.5,
          minWidth: 155,
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
        onClick={(e) => { e.stopPropagation(); onSelectZone?.(); }}
      >
        <div className="flex items-center gap-1.5 mb-1">
          <span
            className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[8px] font-extrabold text-white"
            style={{ background: badgeColor }}
          >
            {zoneNumber}
          </span>
          <span className="font-extrabold text-[11px] text-[#1E293B] tracking-tight uppercase">{label}</span>
        </div>
        <div className="text-[9px] text-[#475569] font-semibold">
          {machineCount} {machineCount === 1 ? 'Asset' : 'Machines'}
        </div>
        <div className="text-[9px] text-[#0F766E] font-bold mt-0.5">
          Supervisor: {supervisor}
        </div>
        {counts && (
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {counts.running > 0 && <StatusDot color="#22A06B" n={counts.running} />}
            {counts.warning > 0 && <StatusDot color="#D99A06" n={counts.warning} />}
            {counts.fault > 0 && <StatusDot color="#D64545" n={counts.fault} />}
            {counts.maintenance > 0 && <StatusDot color="#3978C8" n={counts.maintenance} />}
          </div>
        )}
      </div>
    </Html>
  );
};

const StatusDot: React.FC<{ color: string; n: number }> = ({ color, n }) => (
  <span className="flex items-center gap-0.5 text-[8px] font-bold" style={{ color }}>
    <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} /> {n}
  </span>
);

// ─────────────────────────────────────────────────────────────────────────────
// Factory Floor, Walls, Walkways & Zone Environments
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Low-poly campus scenery: trees, parked vehicles, utility tanks
// ─────────────────────────────────────────────────────────────────────────────
const Tree: React.FC<{ position: [number, number, number] }> = ({ position }) => (
  <group position={position}>
    <mesh position={[0, 0.6, 0]}>
      <cylinderGeometry args={[0.14, 0.18, 1.2, 6]} />
      <meshStandardMaterial color="#8B5E34" roughness={0.9} />
    </mesh>
    <mesh position={[0, 1.7, 0]} castShadow>
      <coneGeometry args={[1.1, 2.0, 7]} />
      <meshStandardMaterial color="#4D7C4A" roughness={0.85} />
    </mesh>
    <mesh position={[0, 2.6, 0]} castShadow>
      <coneGeometry args={[0.8, 1.4, 7]} />
      <meshStandardMaterial color="#5B8C55" roughness={0.85} />
    </mesh>
  </group>
);

const ParkedCar: React.FC<{ position: [number, number, number]; color: string; rotationY?: number }> = ({ position, color, rotationY = 0 }) => (
  <group position={position} rotation={[0, rotationY, 0]}>
    <mesh position={[0, 0.45, 0]} castShadow>
      <boxGeometry args={[1.8, 0.5, 3.6]} />
      <meshStandardMaterial color={color} metalness={0.4} roughness={0.4} />
    </mesh>
    <mesh position={[0, 0.85, -0.2]} castShadow>
      <boxGeometry args={[1.5, 0.4, 1.8]} />
      <meshStandardMaterial color={color} metalness={0.3} roughness={0.4} />
    </mesh>
    {[[-0.85, -1.1], [0.85, -1.1], [-0.85, 1.1], [0.85, 1.1]].map(([x, z], i) => (
      <mesh key={i} position={[x, 0.22, z]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.22, 0.22, 0.2, 10]} />
        <meshStandardMaterial color="#1E293B" />
      </mesh>
    ))}
  </group>
);

const ParkedTruck: React.FC<{ position: [number, number, number]; rotationY?: number }> = ({ position, rotationY = 0 }) => (
  <group position={position} rotation={[0, rotationY, 0]}>
    <mesh position={[0, 0.9, -2.2]} castShadow>
      <boxGeometry args={[2.2, 1.8, 2.0]} />
      <meshStandardMaterial color="#3978C8" metalness={0.3} roughness={0.5} />
    </mesh>
    <mesh position={[0, 1.1, 1.0]} castShadow>
      <boxGeometry args={[2.3, 2.2, 4.4]} />
      <meshStandardMaterial color="#E2E8F0" metalness={0.2} roughness={0.6} />
    </mesh>
    {[-3.2, -1.0, 1.0, 2.6].map((z, i) => (
      [-1.05, 1.05].map((x, j) => (
        <mesh key={`${i}-${j}`} position={[x, 0.35, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.32, 0.32, 0.25, 10]} />
          <meshStandardMaterial color="#1E293B" />
        </mesh>
      ))
    ))}
  </group>
);

const TreeRound: React.FC<{ position: [number, number, number] }> = ({ position }) => (
  <group position={position}>
    <mesh position={[0, 0.5, 0]}>
      <cylinderGeometry args={[0.13, 0.17, 1.0, 6]} />
      <meshStandardMaterial color="#7C5333" roughness={0.9} />
    </mesh>
    <mesh position={[0, 1.55, 0]} castShadow>
      <sphereGeometry args={[1.0, 8, 7]} />
      <meshStandardMaterial color="#5B9457" roughness={0.85} />
    </mesh>
  </group>
);

// ── Real modeled road-kit furniture (Kenney "City Kit Roads", CC0 — see
// public/models/ASSET_MANIFEST.md) replacing/supplementing a few of the
// hand-coded primitives above at the campus's most visible focal points:
// the two internal-street junctions, the pedestrian crossing at the gate,
// and safety/utility accents. Sizes are estimated from each model's real
// ── Environmental Props (Vegetation, Logistics, Utility & Vehicles) ──
const Bush: React.FC<{ position: [number, number, number]; scale?: number }> = ({ position, scale = 1 }) => (
  <group position={position} scale={scale}>
    <mesh position={[-0.25, 0.35, 0]} castShadow><sphereGeometry args={[0.42, 7, 6]} /><meshStandardMaterial color="#6B9E5C" roughness={0.9} /></mesh>
    <mesh position={[0.22, 0.3, 0.1]} castShadow><sphereGeometry args={[0.36, 7, 6]} /><meshStandardMaterial color="#5B9457" roughness={0.9} /></mesh>
    <mesh position={[0, 0.5, -0.15]} castShadow><sphereGeometry args={[0.34, 7, 6]} /><meshStandardMaterial color="#77A968" roughness={0.9} /></mesh>
  </group>
);

const ForkliftVehicle: React.FC<{ position: [number, number, number]; rotationY?: number }> = ({ position, rotationY = 0 }) => (
  <group position={position} rotation={[0, rotationY, 0]}>
    <mesh position={[0, 0.5, 0]} castShadow>
      <boxGeometry args={[1.0, 0.9, 1.6]} />
      <meshStandardMaterial color="#D97706" metalness={0.3} roughness={0.5} />
    </mesh>
    <mesh position={[0, 1.15, -0.1]}>
      <boxGeometry args={[0.15, 1.2, 0.15]} />
      <meshStandardMaterial color="#1E293B" metalness={0.5} roughness={0.5} />
    </mesh>
    <mesh position={[0.5, 0.5, -1.0]}>
      <boxGeometry args={[0.1, 0.9, 0.9]} />
      <meshStandardMaterial color="#94A3B8" metalness={0.6} roughness={0.4} />
    </mesh>
    {[[-0.4, -0.5], [0.4, -0.5], [-0.4, 0.5], [0.4, 0.5]].map(([x, z], i) => (
      <mesh key={i} position={[x, 0.2, z]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.2, 0.2, 0.18, 10]} />
        <meshStandardMaterial color="#1E293B" />
      </mesh>
    ))}
  </group>
);

const ShippingContainer: React.FC<{ position: [number, number, number]; color: string; rotationY?: number; stackY?: number }> = ({ position, color, rotationY = 0, stackY = 0 }) => (
  <group position={[position[0], position[1] + stackY * 2.6, position[2]]} rotation={[0, rotationY, 0]}>
    <mesh castShadow>
      <boxGeometry args={[2.4, 2.5, 6]} />
      <meshStandardMaterial color={color} metalness={0.3} roughness={0.6} />
    </mesh>
    <mesh position={[0, 0, 3.01]}>
      <boxGeometry args={[2.2, 2.3, 0.05]} />
      <meshStandardMaterial color="#1E293B" metalness={0.4} roughness={0.5} />
    </mesh>
  </group>
);


const FactoryZonesEnvironment: React.FC<{
  showSafety: boolean;
  showWalkways: boolean;
  plantLevel: boolean;
  showRoads: boolean;
  showTrees: boolean;
  showVehicles: boolean;
}> = ({ showSafety, showWalkways, plantLevel, showRoads, showTrees, showVehicles }) => {
  // Balanced industrial landscaping along green buffers & perimeter boundaries
  const treePositions: [number, number, number][] = [
    [-52, 0, -44], [-38, 0, -44], [-24, 0, -44], [-10, 0, -44], [10, 0, -44], [24, 0, -44], [38, 0, -44], [52, 0, -44],
    [-46, 0, 52], [-30, 0, 52], [-16, 0, 52], [16, 0, 52], [30, 0, 52], [46, 0, 52],
    [-63, 0, -22], [-63, 0, -2], [-63, 0, 18], [-63, 0, 38],
    [66, 0, -12], [66, 0, 6], [66, 0, 24], [66, 0, 42],
    [-58, 0, 39], [-58, 0, 23],
  ];
  const treeRoundPositions: [number, number, number][] = [
    [-45, 0, -44], [-31, 0, -44], [-17, 0, -44], [3, 0, -44], [17, 0, -44], [31, 0, -44], [45, 0, -44],
    [-38, 0, 52], [-23, 0, 52], [23, 0, 52], [38, 0, 52],
    [-63, 0, -12], [-63, 0, 8], [66, 0, -32], [66, 0, 15],
  ];

  const bushPositions: [number, number, number][] = [
    [-58, 0, 24], [-51, 0, 24], [-65, 0, 35], [-51, 0, 38],
    [-38, 0, 48], [-15, 0, 50], [15, 0, 50], [38, 0, 48],
    [65, 0, -15], [65, 0, 15], [65, 0, -38],
  ];

  return (
    <group>
      {/* 1. Zoned Ground Foundations, Production Aprons, Logistics Pad & Perimeter Enclosure */}
      <CampusGroundPlanes plantLevel={plantLevel} />

      {/* 2. Hierarchical Grid-Snapped Kenney Road Network & Main Gate Complex */}
      {plantLevel && <CampusRoadNetwork showRoads={showRoads} showVehicles={showVehicles} />}

      {/* 3. Utility Area Infrastructure on dedicated Pad ([60, 0, -24]) */}
      <group visible={showVehicles && plantLevel}>
        {/* Large Vertical Chemical Fluid Storage Tank (Electric Blue) */}
        <Asset
          url={`${CITY_KIT_INDUSTRIAL}/detail-tank-large.glb`}
          position={[56.5, 0, -26]}
          rotation={[0, -0.4, 0]}
          scale={4.2}
          tint="#0284C7"
          tintStrength={0.75}
        />
        {/* Secondary Vertical Process Tank (Industrial Emerald Green) */}
        <Asset
          url={`${CITY_KIT_INDUSTRIAL}/detail-tank-large.glb`}
          position={[63.5, 0, -26]}
          rotation={[0, 0.8, 0]}
          scale={3.6}
          tint="#059669"
          tintStrength={0.75}
        />
        {/* Horizontal Pressurized Cryogenic / Gas Bullet Tank (Silver-Steel) */}
        <Asset
          url={`${CITY_KIT_INDUSTRIAL}/detail-tank.glb`}
          position={[56.5, 0, -18.5]}
          rotation={[0, Math.PI / 2, 0]}
          scale={4.5}
          tint="#94A3B8"
          tintStrength={0.8}
        />
        {/* Elevated Utility Water Tower (Municipal Cyan Blue) */}
        <Asset
          url={`${CITY_KIT_INDUSTRIAL}/water-tower.glb`}
          position={[64.0, 0, -18.0]}
          scale={3.8}
          tint="#0284C7"
          tintStrength={0.75}
        />

        {/* Industrial Interconnecting Pipe Manifold */}
        <Asset
          url={`${FACTORY_KIT}/pipe-large-long.glb`}
          position={[56.5, 1.8, -22.2]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={2.2}
          tint="#334155"
          tintStrength={0.8}
        />
        <Asset
          url={`${FACTORY_KIT}/pipe-large-valve.glb`}
          position={[60.0, 1.8, -26]}
          rotation={[0, 0, Math.PI / 2]}
          scale={2.0}
          tint="#DC2626"
          tintStrength={0.9}
        />
        <Asset
          url={`${FACTORY_KIT}/pipe-large-bend.glb`}
          position={[63.5, 1.8, -22.2]}
          rotation={[0, Math.PI, 0]}
          scale={2.0}
          tint="#EAB308"
          tintStrength={0.85}
        />

        {/* High Voltage Electrical Transformer Unit */}
        <group position={[52.5, 0, -21.5]}>
          <mesh position={[0, 0.75, 0]} castShadow>
            <boxGeometry args={[1.6, 1.5, 1.4]} />
            <meshStandardMaterial color="#1E293B" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[0, 1.52, 0]}>
            <boxGeometry args={[1.7, 0.08, 1.5]} />
            <meshStandardMaterial color="#334155" metalness={0.9} />
          </mesh>
        </group>

        {/* Grid Transmission Poles & Security Demarcation */}
        <Asset url={`${ROAD_KIT}/electricity-pole.glb`} position={[68, 0, -28]} rotation={[0, Math.PI / 2, 0]} scale={9.5} />
        <Asset url={`${ROAD_KIT}/electricity-pole.glb`} position={[68, 0, -16]} rotation={[0, Math.PI / 2, 0]} scale={9.5} />
        <Asset url={`${ROAD_KIT}/construction-barrier.glb`} position={[50.5, 0, -29]} rotation={[0, Math.PI / 2, 0]} scale={6} />
        <Asset url={`${ROAD_KIT}/construction-barrier.glb`} position={[50.5, 0, -15]} rotation={[0, Math.PI / 2, 0]} scale={6} />
        <Asset url={`${ROAD_KIT}/construction-fence.glb`} position={[50.5, 0, -22]} rotation={[0, Math.PI / 2, 0]} scale={6.5} />
      </group>

      {/* 4. Plant Overview HUD Labels */}
      {plantLevel && (
        <>
          <Html position={[0, 5.5, 45]} center distanceFactor={44} zIndexRange={[3, 0]}>
            <div className="select-none pointer-events-none px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase tracking-wide text-white shadow-lg" style={{ background: 'rgba(30,41,59,0.85)', border: '1px solid rgba(255,255,255,0.2)' }}>
              🏛️ Main Security Gate
            </div>
          </Html>
          <Html position={[52, 2.5, 26]} center distanceFactor={44} zIndexRange={[3, 0]}>
            <div className="select-none pointer-events-none px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase tracking-wide text-white shadow-lg" style={{ background: 'rgba(30,41,59,0.85)', border: '1px solid rgba(255,255,255,0.2)' }}>
              📦 Shipping &amp; Logistics Bay
            </div>
          </Html>
          <Html position={[60, 2.5, -14]} center distanceFactor={44} zIndexRange={[3, 0]}>
            <div className="select-none pointer-events-none px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase tracking-wide text-white shadow-lg" style={{ background: 'rgba(30,41,59,0.85)', border: '1px solid rgba(255,255,255,0.2)' }}>
              ⚡ Utility Substation
            </div>
          </Html>
        </>
      )}

      {/* 5. Natural Vegetation & Buffer Zones */}
      {showTrees && plantLevel && (
        <>
          {treePositions.map((p, i) => <Tree key={`t-${i}`} position={p} />)}
          {treeRoundPositions.map((p, i) => <TreeRound key={`tr-${i}`} position={p} />)}
          {bushPositions.map((p, i) => <Bush key={`b-${i}`} position={p} scale={0.9 + (i % 3) * 0.15} />)}
        </>
      )}

      {/* 6. Section Zone Boundaries under each building */}
      {ZONE_DEFS.map((z) => (
        <SectionBoundary
          key={z.id}
          cx={z.cx} cz={z.cz} hw={z.hw} hd={z.hd}
          floorColor={z.floorColor}
          showSafety={showSafety}
        />
      ))}

      {/* 7. Interior Building Walkways */}
      {showWalkways && plantLevel && (
        <>
          {[-27, 0, 33].map((x, i) => (
            <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.004, -20.5]}>
              <planeGeometry args={[1.2, 18]} />
              <meshBasicMaterial color="#DDE9E3" transparent opacity={0.6} />
            </mesh>
          ))}
        </>
      )}
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Dispatched Technician Walker (Moves across factory walkways to faulty machine,
// works on-site, and walks out of the cell back to dispatch base on job completion)
// ─────────────────────────────────────────────────────────────────────────────
interface DispatchedTechnicianProps {
  faultyMachineCode: string | null;
  workerName?: string;
  workerRole?: string;
  helmetColor?: string;
  onSelectTechnician?: (machineCode: string) => void;
  onWalkingStateChange?: (isBusy: boolean, zoneId: ZoneId | null) => void;
}

const DispatchedTechnicianWalker: React.FC<DispatchedTechnicianProps> = ({
  faultyMachineCode,
  workerName = 'Frank Moore',
  workerRole = 'Plant Maintenance Specialist',
  helmetColor = '#DC2626',
  onSelectTechnician,
  onWalkingStateChange,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);
  const scanBeamRef = useRef<THREE.Mesh>(null);

  // Home location: Left West Logistics & Technician Dispatch Gate [-52, 0, -1.5]
  const homePos: [number, number, number] = useMemo(() => [-52, 0, -1.5], []);

  const [phase, setPhase] = useState<'IDLE' | 'OUTBOUND' | 'WORKING' | 'RETURNING'>('IDLE');
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [techInfo, setTechInfo] = useState({ name: workerName, role: workerRole, helmet: helmetColor });

  const pathRef = useRef<{
    phase: 'IDLE' | 'OUTBOUND' | 'WORKING' | 'RETURNING';
    currentDist: number;
    totalDistance: number;
    pathSegments: { start: [number, number, number]; end: [number, number, number]; length: number }[];
    targetCode: string | null;
    targetPos: [number, number, number] | null;
  }>({
    phase: 'IDLE',
    currentDist: 0,
    totalDistance: 0,
    pathSegments: [],
    targetCode: null,
    targetPos: null,
  });

  const setupPath = (wps: [number, number, number][], newPhase: 'OUTBOUND' | 'RETURNING', code: string | null) => {
    const segments: { start: [number, number, number]; end: [number, number, number]; length: number }[] = [];
    let total = 0;
    for (let i = 0; i < wps.length - 1; i++) {
      const p1 = wps[i];
      const p2 = wps[i + 1];
      const len = Math.hypot(p2[0] - p1[0], p2[2] - p1[2]);
      if (len > 0.001) {
        segments.push({ start: p1, end: p2, length: len });
        total += len;
      }
    }
    pathRef.current.phase = newPhase;
    pathRef.current.currentDist = 0;
    pathRef.current.totalDistance = Math.max(total, 0.001);
    pathRef.current.pathSegments = segments;
    pathRef.current.targetCode = code;

    setPhase(newPhase);
    setActiveCode(code);
  };

  useEffect(() => {
    if (faultyMachineCode) {
      setTechInfo({ name: workerName, role: workerRole, helmet: helmetColor });
      const zoneId = zoneIdForMachineCode(faultyMachineCode);
      onWalkingStateChange?.(true, zoneId);

      const [tx, , tz] = MACHINE_COORDS[faultyMachineCode] || [0, 0, 0];
      const offsetZ = tz > -1.5 ? -2.4 : 2.4;
      const targetPos: [number, number, number] = [tx, 0, tz + offsetZ];
      pathRef.current.targetPos = targetPos;

      const zone = zoneId ? ZONE_DEFS.find((z) => z.id === zoneId) : null;
      const doorX = zone ? zone.cx : tx;

      const currPos: [number, number, number] = groupRef.current
        ? [groupRef.current.position.x, groupRef.current.position.y, groupRef.current.position.z]
        : homePos;

      const outboundWps: [number, number, number][] = [
        currPos,
        [doorX, 0, -1.5],
        [doorX, 0, targetPos[2]],
        targetPos,
      ];
      setupPath(outboundWps, 'OUTBOUND', faultyMachineCode);
    } else if (pathRef.current.targetCode && (pathRef.current.phase === 'WORKING' || pathRef.current.phase === 'OUTBOUND')) {
      // Machine repaired / restored to nominal baseline! Technician walks out of cell
      const code = pathRef.current.targetCode;
      const zoneId = zoneIdForMachineCode(code);
      onWalkingStateChange?.(true, zoneId);

      const [tx, , tz] = MACHINE_COORDS[code] || [0, 0, 0];
      const offsetZ = tz > -1.5 ? -2.4 : 2.4;
      const targetPos: [number, number, number] = [tx, 0, tz + offsetZ];
      const zone = zoneId ? ZONE_DEFS.find((z) => z.id === zoneId) : null;
      const doorX = zone ? zone.cx : tx;

      const currPos: [number, number, number] = groupRef.current
        ? [groupRef.current.position.x, groupRef.current.position.y, groupRef.current.position.z]
        : targetPos;

      const returnWps: [number, number, number][] = [
        currPos,
        [doorX, 0, currPos[2]],
        [doorX, 0, -1.5],
        homePos,
      ];
      setupPath(returnWps, 'RETURNING', code);
    }
  }, [faultyMachineCode, workerName, workerRole, helmetColor]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    const p = pathRef.current;

    if (p.phase === 'IDLE') {
      groupRef.current.position.set(homePos[0], homePos[1], homePos[2]);
      groupRef.current.rotation.y = -0.3;
      if (leftLegRef.current) leftLegRef.current.rotation.x = 0;
      if (rightLegRef.current) rightLegRef.current.rotation.x = 0;
      if (leftArmRef.current) leftArmRef.current.rotation.x = 0;
      if (rightArmRef.current) rightArmRef.current.rotation.x = 0;
      if (scanBeamRef.current) scanBeamRef.current.visible = false;
      return;
    }

    const walkSpeed = 5.2; // Units/s (~5s across factory)

    if (p.phase === 'OUTBOUND' || p.phase === 'RETURNING') {
      p.currentDist = Math.min(p.totalDistance, p.currentDist + delta * walkSpeed);

      if (p.currentDist >= p.totalDistance) {
        if (p.phase === 'OUTBOUND') {
          p.phase = 'WORKING';
          setPhase('WORKING');
        } else {
          p.phase = 'IDLE';
          setPhase('IDLE');
          setActiveCode(null);
          onWalkingStateChange?.(false, null);
          groupRef.current.position.set(homePos[0], homePos[1], homePos[2]);
          return;
        }
      } else {
        // Interpolate along waypoints
        let distCounter = 0;
        let currPos = p.pathSegments[0]?.start || homePos;
        let heading = 0;

        for (const seg of p.pathSegments) {
          if (p.currentDist <= distCounter + seg.length) {
            const segProgress = (p.currentDist - distCounter) / seg.length;
            const x = seg.start[0] + (seg.end[0] - seg.start[0]) * segProgress;
            const z = seg.start[2] + (seg.end[2] - seg.start[2]) * segProgress;
            currPos = [x, 0, z];
            heading = Math.atan2(seg.end[0] - seg.start[0], seg.end[2] - seg.start[2]);
            break;
          }
          distCounter += seg.length;
          currPos = seg.end;
        }

        groupRef.current.position.set(currPos[0], currPos[1], currPos[2]);
        groupRef.current.rotation.y = heading;

        // Walking animation
        const swing = Math.sin(t * 12) * 0.55;
        if (leftLegRef.current) leftLegRef.current.rotation.x = swing;
        if (rightLegRef.current) rightLegRef.current.rotation.x = -swing;
        if (leftArmRef.current) leftArmRef.current.rotation.x = -swing * 0.7;
        if (rightArmRef.current) rightArmRef.current.rotation.x = swing * 0.7;
        if (scanBeamRef.current) scanBeamRef.current.visible = false;
        return;
      }
    }

    if (p.phase === 'WORKING') {
      if (p.targetPos) {
        groupRef.current.position.set(p.targetPos[0], p.targetPos[1], p.targetPos[2]);
      }
      if (p.targetCode && MACHINE_COORDS[p.targetCode]) {
        const [tx, , tz] = MACHINE_COORDS[p.targetCode];
        const faceAngle = Math.atan2(tx - groupRef.current.position.x, tz - groupRef.current.position.z);
        groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, faceAngle, 0.1);
      }

      if (leftLegRef.current) leftLegRef.current.rotation.x = 0;
      if (rightLegRef.current) rightLegRef.current.rotation.x = 0;
      if (rightArmRef.current) rightArmRef.current.rotation.x = 0.8 + Math.sin(t * 3) * 0.15;
      if (leftArmRef.current) leftArmRef.current.rotation.x = 0.4 + Math.cos(t * 2) * 0.1;
      if (scanBeamRef.current) {
        scanBeamRef.current.visible = true;
        (scanBeamRef.current.material as THREE.MeshBasicMaterial).opacity = 0.4 + Math.sin(t * 6) * 0.25;
      }
    }
  });

  return (
    <group
      ref={groupRef}
      position={homePos}
      onClick={(e) => {
        if (phase === 'WORKING' && activeCode) {
          e.stopPropagation();
          onSelectTechnician?.(activeCode);
        }
      }}
      onPointerOver={(e) => {
        if (phase === 'WORKING' && activeCode) {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto';
      }}
    >
      {/* Boots */}
      {[-0.1, 0.1].map((x, i) => (
        <mesh key={i} position={[x, 0.1, 0]}>
          <boxGeometry args={[0.18, 0.2, 0.26]} />
          <meshStandardMaterial color="#0F172A" roughness={0.9} />
        </mesh>
      ))}

      {/* Legs */}
      <mesh ref={leftLegRef} position={[-0.1, 0.55, 0]}>
        <boxGeometry args={[0.18, 0.7, 0.2]} />
        <meshStandardMaterial color="#1E293B" roughness={0.8} />
      </mesh>
      <mesh ref={rightLegRef} position={[0.1, 0.55, 0]}>
        <boxGeometry args={[0.18, 0.7, 0.2]} />
        <meshStandardMaterial color="#1E293B" roughness={0.8} />
      </mesh>

      {/* High-Vis Vest */}
      <mesh position={[0, 1.1, 0]}>
        <boxGeometry args={[0.44, 0.6, 0.28]} />
        <meshStandardMaterial color="#EF4444" roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.0, 0.15]}>
        <boxGeometry args={[0.42, 0.08, 0.02]} />
        <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0, 1.2, 0.15]}>
        <boxGeometry args={[0.42, 0.08, 0.02]} />
        <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={0.6} />
      </mesh>

      {/* Left Arm carrying Red Diagnostic Tool Case */}
      <group position={[-0.26, 1.05, 0]}>
        <mesh ref={leftArmRef} position={[0, -0.2, 0]}>
          <boxGeometry args={[0.14, 0.5, 0.16]} />
          <meshStandardMaterial color="#EF4444" roughness={0.7} />
        </mesh>
        <mesh position={[-0.05, -0.45, 0.08]} castShadow>
          <boxGeometry args={[0.2, 0.28, 0.38]} />
          <meshStandardMaterial color="#991B1B" metalness={0.4} roughness={0.4} />
        </mesh>
      </group>

      {/* Right Arm holding Handheld Diagnostic Tablet */}
      <group position={[0.26, 1.05, 0]}>
        <mesh ref={rightArmRef} position={[0, -0.2, 0]}>
          <boxGeometry args={[0.14, 0.5, 0.16]} />
          <meshStandardMaterial color="#EF4444" roughness={0.7} />
        </mesh>
        <mesh position={[0.02, -0.4, 0.2]} rotation={[0.4, 0, 0]}>
          <boxGeometry args={[0.22, 0.16, 0.03]} />
          <meshStandardMaterial color="#1E293B" />
        </mesh>
        <mesh position={[0.02, -0.4, 0.22]} rotation={[0.4, 0, 0]}>
          <boxGeometry args={[0.18, 0.12, 0.01]} />
          <meshStandardMaterial color="#38BDF8" emissive="#38BDF8" emissiveIntensity={0.8} />
        </mesh>
      </group>

      {/* Laser beam */}
      <mesh ref={scanBeamRef} position={[0, 1.0, 1.2]} rotation={[Math.PI / 2, 0, 0]} visible={false}>
        <coneGeometry args={[0.4, 2.2, 16, 1, true]} />
        <meshBasicMaterial color="#38BDF8" transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 1.62, 0]}>
        <boxGeometry args={[0.24, 0.26, 0.24]} />
        <meshStandardMaterial color="#FED7AA" roughness={0.7} />
      </mesh>

      {/* Dynamic Hardhat */}
      <mesh position={[0, 1.82, 0]}>
        <cylinderGeometry args={[0.22, 0.2, 0.16, 12]} />
        <meshStandardMaterial color={techInfo.helmet || helmetColor} metalness={0.2} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.76, 0.08]}>
        <boxGeometry args={[0.3, 0.04, 0.32]} />
        <meshStandardMaterial color={techInfo.helmet || helmetColor} />
      </mesh>

      {/* Floating Interactive HUD Badge */}
      {phase !== 'IDLE' && activeCode && (
        <Html position={[0, 2.4, 0]} center distanceFactor={18} zIndexRange={[12, 0]}>
          <div
            onClick={(e) => {
              if (phase === 'WORKING' && activeCode) {
                e.stopPropagation();
                onSelectTechnician?.(activeCode);
              }
            }}
            className={`backdrop-blur-md border-2 rounded-xl px-3 py-1.5 shadow-2xl text-center min-w-[170px] animate-fade-in flex flex-col items-center gap-1 transition-all select-none ${
              phase === 'RETURNING'
                ? 'bg-[#F0FDF4]/95 border-emerald-400 text-emerald-900 shadow-emerald-500/20'
                : phase === 'WORKING'
                ? 'bg-[#FAF9F6]/95 hover:bg-white border-red-400 hover:border-red-600 cursor-pointer transform hover:scale-105 active:scale-95 group'
                : 'bg-[#FAF9F6]/95 border-amber-400 text-amber-900'
            }`}
            title={phase === 'WORKING' ? 'Click to open Field Technician Workstation on the right side' : undefined}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-tight">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  phase === 'RETURNING'
                    ? 'bg-emerald-500 animate-pulse'
                    : phase === 'WORKING'
                    ? 'bg-red-600 animate-ping'
                    : 'bg-amber-500 animate-ping'
                }`}
              />
              <span className={phase === 'RETURNING' ? 'text-emerald-700' : phase === 'WORKING' ? 'text-red-700' : 'text-amber-700'}>
                {techInfo.name}
              </span>
            </div>
            <div className="text-[9px] font-semibold text-slate-500 max-w-[160px] truncate">
              {techInfo.role}
            </div>
            <div className="text-[10px] font-extrabold text-[#1E293B]">
              {phase === 'RETURNING'
                ? '🚶 Leaving Cell → Dispatch Base'
                : phase === 'WORKING'
                ? `🔧 On-Site at ${activeCode}`
                : `🚶 Dispatched → ${activeCode}`}
            </div>
            {phase === 'WORKING' && (
              <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100/80 group-hover:bg-red-500 group-hover:text-white rounded-md text-[9px] font-bold text-red-800 transition-colors">
                <span>🛠️ Open Workstation</span>
              </div>
            )}
            {phase === 'RETURNING' && (
              <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 rounded-md text-[9px] font-bold text-emerald-800">
                <span>✓ Job Completed at {activeCode}</span>
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Camera Controller (Dynamic Aspect-Ratio Aware Bounding-Box Fitting)
// ─────────────────────────────────────────────────────────────────────────────
const CameraController: React.FC<{
  preset?: CameraPresetType;
  resetTrigger: number;
}> = ({ preset = 'OVERVIEW', resetTrigger }) => {
  const controlsRef = useRef<any>(null);
  const { camera, size } = useThree();

  // Dynamic aspect ratio calculation to prevent horizontal/vertical clipping
  const aspect = size.width / size.height;
  const isWide = aspect > 1.4;

  const targetPositions = useMemo((): Record<CameraPresetType, { pos: [number, number, number]; target: [number, number, number] }> => {
    // Height and distance tuned so operational equipment fills 80-90% of viewport
    const cellDistY = isWide ? 13.0 : 16.0;
    const cellDistZ = isWide ? 14.5 : 18.0;

    return {
      OVERVIEW:    { pos: [0, 56, 104],   target: [0, 2, 0] },
      MACHINING:   { pos: [-35, cellDistY, -20.5 + cellDistZ], target: [-35, 1.2, -20.5] },
      ROBOT:       { pos: [33, isWide ? 17.5 : 21.0, -20.5 + (isWide ? 19.5 : 23.5)],  target: [33, 1.0, -20.5] },
      PROCESSING:  { pos: [0, cellDistY, -21.0 + cellDistZ],   target: [0, 1.2, -21.0] },
      ASSEMBLY:    { pos: [-35, cellDistY, 15.5 + cellDistZ],  target: [-35, 1.2, 15.5] },
      PACKAGING:   { pos: [31, cellDistY, 15.5 + cellDistZ],   target: [31, 1.2, 15.5] },
      MAINTENANCE: { pos: [0, cellDistY, 15.5 + cellDistZ],    target: [0, 1.2, 15.5] },
    };
  }, [isWide]);

  const desiredPos = useRef(new THREE.Vector3(...targetPositions.OVERVIEW.pos));
  const desiredTarget = useRef(new THREE.Vector3(...targetPositions.OVERVIEW.target));
  const transitioning = useRef(false);

  useEffect(() => {
    if (preset && targetPositions[preset]) {
      const { pos, target } = targetPositions[preset];
      desiredPos.current.set(...pos);
      desiredTarget.current.set(...target);
      transitioning.current = true;
    }
  }, [preset, resetTrigger, targetPositions]);

  useFrame(() => {
    if (!transitioning.current) return;
    camera.position.lerp(desiredPos.current, 0.08);
    if (controlsRef.current) {
      controlsRef.current.target.lerp(desiredTarget.current, 0.08);
      controlsRef.current.update();
    }
    const posDone = camera.position.distanceTo(desiredPos.current) < 0.05;
    const targetDone = !controlsRef.current || controlsRef.current.target.distanceTo(desiredTarget.current) < 0.05;
    if (posDone && targetDone) {
      camera.position.copy(desiredPos.current);
      if (controlsRef.current) {
        controlsRef.current.target.copy(desiredTarget.current);
        controlsRef.current.update();
      }
      transitioning.current = false;
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={true}
      screenSpacePanning={true}
      panSpeed={1.5}
      rotateSpeed={0.8}
      zoomSpeed={1.0}
      enableDamping
      dampingFactor={0.06}
      maxPolarAngle={Math.PI / 2.05}
      minDistance={5}
      maxDistance={140}
      target={[0, 1, 0]}
    />
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Factory Canvas
// ─────────────────────────────────────────────────────────────────────────────
export const FactoryCanvas: React.FC<FactoryCanvasProps> = ({
  machines,
  selectedMachine,
  onSelectMachine,
  onSelectTechnician,
  layers,
  resetTrigger = 0,
  cameraPreset = 'OVERVIEW',
  onPresetChange,
  liveTelemetry = {},
  dispatchedTarget = null,
  viewLevel = 'PLANT',
  workOrders = [],
}) => {
  const machineByCode = useMemo(() => {
    const map: Record<string, Machine> = {};
    machines.forEach((m) => { map[m.code] = m; });
    return map;
  }, [machines]);

  // Determine active faulty machine for technician dispatch
  const activeFaultyMachine = useMemo(() => {
    if (dispatchedTarget) return dispatchedTarget;
    if (selectedMachine && ['FAULT', 'WARNING', 'MAINTENANCE', 'VERIFYING'].includes(selectedMachine.status)) {
      return selectedMachine.code;
    }
    const faulty = machines.find((m) => m.status === 'FAULT');
    if (faulty) return faulty.code;
    const warning = machines.find((m) => m.status === 'WARNING' || m.status === 'MAINTENANCE');
    if (warning) return warning.code;
    return null;
  }, [dispatchedTarget, selectedMachine, machines]);

  // All 20 machines with their types
  const allRenderedMachines = useMemo(() => [
    // Machining Cell
    { code: 'CNC-01', type: 'CNC' as const, labelH: 3.8 },
    { code: 'CNC-02', type: 'CNC' as const, labelH: 3.8 },
    { code: 'CNC-03', type: 'CNC' as const, labelH: 3.8 },
    { code: 'CNC-04', type: 'CNC' as const, labelH: 3.8 },
    { code: 'CNC-05', type: 'CNC' as const, labelH: 3.8 },
    { code: 'CNC-06', type: 'CNC' as const, labelH: 3.8 },
    // Robot Cell
    { code: 'ROBOT-01', type: 'ROBOT' as const, pose: 0, labelH: 5.0 },
    { code: 'ROBOT-02', type: 'ROBOT' as const, pose: 1, labelH: 5.0 },
    { code: 'ROBOT-03', type: 'ROBOT' as const, pose: 2, labelH: 5.0 },
    { code: 'ROBOT-04', type: 'ROBOT' as const, pose: 3, labelH: 5.0 },
    // Processing Cell
    { code: 'MIXER-01',   type: 'MIXER'      as const, labelH: 5.8 },
    { code: 'PUMP-01',    type: 'PUMP'       as const, labelH: 2.8 },
    { code: 'PRESS-01',   type: 'PRESS'      as const, labelH: 5.6 },
    { code: 'PROCESS-01', type: 'PROCESSING' as const, labelH: 4.0 },
    { code: 'PROCESS-02', type: 'PROCESSING' as const, labelH: 4.0 },
    // Assembly Cell
    { code: 'ASMB-01', type: 'ASSEMBLY' as const, labelH: 2.2 },
    { code: 'ASMB-02', type: 'ASSEMBLY' as const, labelH: 2.2 },
    { code: 'ASMB-03', type: 'ASSEMBLY' as const, labelH: 2.2 },
    { code: 'ASMB-04', type: 'ASSEMBLY' as const, labelH: 2.2 },
    // Packaging Cell
    { code: 'PACK-01', type: 'PACKAGING' as const, labelH: 2.8 },
    { code: 'PACK-02', type: 'PACKAGING' as const, labelH: 2.8 },
    { code: 'PACK-03', type: 'PACKAGING' as const, labelH: 2.8 },
    // Maintenance Bay
    { code: 'BENCH-01', type: 'MAINTENANCE' as const, variant: 'bench', labelH: 2.2 },
    { code: 'BENCH-02', type: 'MAINTENANCE' as const, variant: 'bench', labelH: 2.2 },
    { code: 'TEST-01',  type: 'MAINTENANCE' as const, variant: 'test',  labelH: 2.2 },
  ], []);

  // 24 workers distributed across all zones
  const workersList = useMemo(() => [
    // Machining (yellow helmets)
    { pos: [-39, 0, -20] as [number,number,number], rot: 0.2,  name: 'Arun Kumar',   role: 'Machining Supervisor',  activity: 'CNC-01 Spindle Inspection', helmet: '#FACC15' },
    { pos: [-33, 0, -20] as [number,number,number], rot: -0.1, name: 'John Miller',  role: 'CNC Operator',          activity: 'Operating CNC-02', helmet: '#FACC15' },
    { pos: [-26, 0, -20] as [number,number,number], rot: 0.3,  name: 'Dev Patel',    role: 'CNC Technician',        activity: 'CNC-06 Tool Change', helmet: '#FACC15' },
    { pos: [-38, 0, -12] as [number,number,number], rot: 0.0,  name: 'Marcus Lee',   role: 'Mechanical Tech',       activity: 'CNC-04 Setup', helmet: '#FFFFFF' },
    // Robot Cell (blue helmets) — positioned directly next to the shifted robot machines
    { pos: [22.5, 0, -25.5] as [number,number,number], rot: Math.PI / 2, name: 'Priya Nair',   role: 'Robot Cell Supervisor', activity: 'ROBOT-01 Weld Supervision', helmet: '#3B82F6' },
    { pos: [32.5, 0, -25.5] as [number,number,number], rot: Math.PI / 2, name: 'Kenji Ito',    role: 'Robotics Operator',     activity: 'ROBOT-02 Seam Program', helmet: '#3B82F6' },
    { pos: [35.5, 0, -15.5] as [number,number,number], rot: -Math.PI / 2, name: 'Lisa Wong',  role: 'Automation Tech',       activity: 'ROBOT-04 Quality Verify', helmet: '#3B82F6' },
    // Processing (green helmets) — swapped with Robot, now center x≈0
    { pos: [-9, 0, -22.5] as [number,number,number], rot: 0.5,  name: 'Wei Zhang',    role: 'Process Supervisor',    activity: 'MIXER-01 RPM Check', helmet: '#22C55E' },
    { pos: [-2, 0, -22.5] as [number,number,number], rot: -0.2, name: 'Carlos Gomez', role: 'Fluids Specialist',     activity: 'PUMP-01 Seal Inspection', helmet: '#22C55E' },
    { pos: [5, 0, -20.5]  as [number,number,number], rot: 0.1,  name: 'Ana Torres',   role: 'Process Operator',      activity: 'PRESS-01 Safety Check', helmet: '#FFFFFF' },
    { pos: [-3, 0, -13.5] as [number,number,number], rot: 0.3,  name: 'Sam Park',     role: 'Process Technician',    activity: 'PROCESS-02 Monitoring', helmet: '#22C55E' },
    // Assembly (orange helmets)
    { pos: [-39, 0, 15]  as [number,number,number], rot: -0.2, name: 'Carlos G.',    role: 'Assembly Supervisor',   activity: 'ASMB-01 Line Check', helmet: '#F97316' },
    { pos: [-33, 0, 15]  as [number,number,number], rot: 0.1,  name: 'Raj Mehta',    role: 'Assembly Worker',       activity: 'Component Assembly', helmet: '#F97316' },
    { pos: [-38, 0, 22]  as [number,number,number], rot: 0.4,  name: 'Nina Cole',    role: 'Assembly Technician',   activity: 'ASMB-03 Torque Verify', helmet: '#F97316' },
    { pos: [-32, 0, 22]  as [number,number,number], rot: -0.3, name: 'Ben Harris',   role: 'Assembly Operator',     activity: 'Final Sub-assembly', helmet: '#FFFFFF' },
    // Packaging (white helmets) — positioned next to machines PACK-01, PACK-02, PACK-03
    { pos: [29.5, 0, 11.7] as [number,number,number], rot: -0.4, name: 'Tom Wilson', role: 'Packaging Supervisor', activity: 'PACK-01 Line Status', helmet: '#FFFFFF' },
    { pos: [29.5, 0, 17.2] as [number,number,number], rot: -0.4, name: 'Amy Chen',   role: 'Packaging Operator',   activity: 'PACK-02 Box Sealing', helmet: '#FFFFFF' },
    { pos: [29.5, 0, 22.7] as [number,number,number], rot: -0.4, name: 'Leo Davis',  role: 'Logistics Operator',   activity: 'PACK-03 RFID / QC Check', helmet: '#F59E0B' },
    // Maintenance (red helmets) — swapped with Packaging, now center x≈0
    { pos: [-8, 0, 14.5] as [number,number,number], rot: -0.2, name: 'Sarah Jenkins',role: 'Maintenance Supervisor', activity: 'Work Order Review', helmet: '#EF4444' },
    { pos: [-1, 0, 14.5] as [number,number,number], rot: 0.3,  name: 'Frank Moore',  role: 'Maintenance Tech',      activity: 'BENCH-02 Bearing Swap', helmet: '#EF4444' },
    { pos: [5, 0, 14.5]  as [number,number,number], rot: -0.4, name: 'Tina Ross',    role: 'Electrical Tech',       activity: 'TEST-01 Diagnostics', helmet: '#EF4444' },
    { pos: [-3, 0, 21.5] as [number,number,number], rot: 0.1,  name: 'Ed Nguyen',    role: 'Inventory Clerk',       activity: 'Spare Parts Count', helmet: '#94A3B8' },
    // Corridor workers
    { pos: [-13, 0, -1]  as [number,number,number], rot: 0.0,  name: 'Pat Kim',      role: 'Material Handler',      activity: 'Parts Transfer to Assembly', helmet: '#F59E0B' },
    { pos: [10, 0, -1]   as [number,number,number], rot: 0.5,  name: 'Jess Ali',     role: 'Forklift Operator',     activity: 'Finished Goods Movement', helmet: '#F59E0B' },
  ], []);

  // When the user has entered a building, everything belonging to the other
  // five zones is hidden entirely — full isolation, not dimming.
  const activeZoneId: ZoneId | null = viewLevel === 'INTERIOR' ? (cameraPreset as ZoneId) : null;
  const activeZoneDef = activeZoneId ? ZONE_DEFS.find((z) => z.id === activeZoneId) : null;
  const isInActiveZone = (pos: [number, number, number]): boolean => {
    if (!activeZoneDef) return true;
    return (
      pos[0] >= activeZoneDef.cx - activeZoneDef.hw && pos[0] <= activeZoneDef.cx + activeZoneDef.hw &&
      pos[2] >= activeZoneDef.cz - activeZoneDef.hd && pos[2] <= activeZoneDef.cz + activeZoneDef.hd
    );
  };

  // Helper to dynamically resolve assigned technician from live TiDB Cloud work orders or active incident
  const assignedTech = useMemo(() => {
    if (!activeFaultyMachine) return { name: 'Frank Moore', role: 'Plant Maintenance Specialist', helmet: '#DC2626' };
    
    // 1. Look for live active work order from TiDB Cloud database for this machine
    const matchingWo = workOrders.find((wo) => 
      (wo.machine_code === activeFaultyMachine || (wo as any).machine_id === activeFaultyMachine) &&
      wo.status !== 'COMPLETED'
    );
    if (matchingWo && matchingWo.technician_name) {
      const role = matchingWo.technician_role || 'Certified Specialist';
      const zone = zoneIdForMachineCode(activeFaultyMachine);
      const helmetColors: Record<string, string> = {
        MACHINING: '#FACC15',
        ROBOT: '#3B82F6',
        PROCESSING: '#22C55E',
        ASSEMBLY: '#F97316',
        PACKAGING: '#FFFFFF',
        MAINTENANCE: '#DC2626'
      };
      return {
        name: matchingWo.technician_name,
        role: role,
        helmet: helmetColors[zone || 'MAINTENANCE'] || '#DC2626'
      };
    }

    // 2. Fallback to cell specialist mapping
    const zone = zoneIdForMachineCode(activeFaultyMachine);
    switch (zone) {
      case 'MACHINING':
        return { name: 'Arun Kumar', role: 'Lead Vibration & Spindle Specialist', helmet: '#FACC15' };
      case 'ROBOT':
        return { name: 'Priya Sharma', role: 'Senior Automation & Robotics Engineer', helmet: '#3B82F6' };
      case 'PROCESSING':
        return { name: 'Rajesh Nair', role: 'Hydraulic Systems & Fluid Specialist', helmet: '#22C55E' };
      case 'ASSEMBLY':
        return { name: 'Nina Cole', role: 'Precision Assembly Line Specialist', helmet: '#F97316' };
      case 'PACKAGING':
        return { name: 'Tom Wilson', role: 'Packaging Automation Specialist', helmet: '#FFFFFF' };
      case 'MAINTENANCE':
      default:
        return { name: 'Frank Moore', role: 'Plant Maintenance Specialist', helmet: '#DC2626' };
    }
  }, [activeFaultyMachine, workOrders]);

  const [techWalkerState, setTechWalkerState] = useState<{ isBusy: boolean; zoneId: ZoneId | null }>({
    isBusy: false,
    zoneId: null,
  });

  const handleWalkerStateChange = (isBusy: boolean, zoneId: ZoneId | null) => {
    setTechWalkerState({ isBusy, zoneId });
  };

  // Filter out static technician if they are dynamically dispatched or walking out, and hide
  // workers outside the currently-entered building (if any).
  const activeWorkers = useMemo(() => {
    let list = (activeFaultyMachine || techWalkerState.isBusy)
      ? workersList.filter((w) => w.name !== assignedTech.name)
      : workersList;
    if (activeZoneDef) list = list.filter((w) => isInActiveZone(w.pos));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workersList, activeFaultyMachine, techWalkerState.isBusy, assignedTech, activeZoneId]);

  // Only render the dispatched technician if their target is inside the
  // building the user is currently in, or if they are exiting this cell, or at Plant Overview.
  const showTechnician =
    !activeZoneId ||
    (!!activeFaultyMachine && zoneIdForMachineCode(activeFaultyMachine) === activeZoneId) ||
    (techWalkerState.isBusy && techWalkerState.zoneId === activeZoneId);

  return (
    <div className="w-full h-full relative" style={{ background: 'linear-gradient(180deg, #EBE8E1 0%, #F3F1EC 100%)' }}>
      <Canvas
        camera={{ position: [0, 56, 104], fov: 48, near: 0.1, far: 400 }}
        shadows
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => { gl.setClearColor('#F3F1EC', 1); }}
        onClick={(e) => { if (e.target === e.currentTarget) onSelectMachine(null); }}
      >
        {/* Lighting */}
        <ambientLight intensity={1.05} color="#F3F1EC" />
        <directionalLight
          position={[35, 48, 38]}
          intensity={1.55}
          color="#FFF4E0"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-far={170}
          shadow-camera-left={-75}
          shadow-camera-right={75}
          shadow-camera-top={75}
          shadow-camera-bottom={-75}
        />
        <directionalLight position={[-30, 26, -25]} intensity={0.45} color="#DCEBFA" />

        {/* Factory floor, walls, zone boundaries, walkways, campus scenery */}
        <FactoryZonesEnvironment
          showSafety={layers.safetyZones}
          showWalkways={layers.walkways}
          plantLevel={viewLevel === 'PLANT'}
          showRoads={layers.roads}
          showTrees={layers.trees}
          showVehicles={layers.vehicles}
        />

        {/* Section Building Shells — real modeled GLB buildings for all six
            zones (see IndustrialBuildingAssets.tsx), visible only at Plant
            Overview. Replaces the old primitive-box SectionBuildingShell. */}
        {layers.buildings && ZONE_DEFS.map((z) => (
          <IndustrialBuildingExterior
            key={z.id}
            zoneId={z.id as ZoneId}
            cx={z.cx}
            cz={z.cz}
            plantLevel={viewLevel === 'PLANT'}
            onClick={() => onPresetChange?.(z.id as CameraPresetType)}
          />
        ))}

        {/* 1. Machining Cell Interior (CNC Production Line) */}
        <MachiningCellInteriorDetail
          cx={activeZoneDef?.cx ?? -35}
          cz={activeZoneDef?.cz ?? -20.5}
          visible={layers.buildings && activeZoneId === 'MACHINING'}
          machines={machines}
          liveTelemetry={liveTelemetry}
          onSelectMachine={onSelectMachine}
        />

        {/* 2. Processing Cell Interior (Fluids & Mixing Plant) */}
        <ProcessingCellInteriorDetail
          cx={activeZoneDef?.cx ?? 0}
          cz={activeZoneDef?.cz ?? -21.0}
          visible={layers.buildings && activeZoneId === 'PROCESSING'}
          machines={machines}
          liveTelemetry={liveTelemetry}
          onSelectMachine={onSelectMachine}
        />

        {/* 3. Assembly Cell Interior (Continuous Assembly Line) */}
        <AssemblyCellInteriorDetail
          cx={activeZoneDef?.cx ?? -35}
          cz={activeZoneDef?.cz ?? 15.5}
          visible={layers.buildings && activeZoneId === 'ASSEMBLY'}
          machines={machines}
          liveTelemetry={liveTelemetry}
          onSelectMachine={onSelectMachine}
        />

        {/* 4. Robot Cell Interior (Pick, Identify & Route flow) */}
        <RobotCellInteriorDetail
          cx={activeZoneDef?.cx ?? 33}
          cz={activeZoneDef?.cz ?? -20.5}
          visible={layers.buildings && activeZoneId === 'ROBOT'}
          machines={machines}
          liveTelemetry={liveTelemetry}
          onSelectMachine={onSelectMachine}
        />

        {/* 5. Packaging Cell Interior (Pack, Seal, Label) */}
        <PackagingCellInteriorDetail
          cx={activeZoneDef?.cx ?? 31}
          cz={activeZoneDef?.cz ?? 15.5}
          visible={layers.buildings && activeZoneId === 'PACKAGING'}
          machines={machines}
          liveTelemetry={liveTelemetry}
          onSelectMachine={onSelectMachine}
        />

        {/* 6. Maintenance Bay Interior (10-Zone Dense Workshop) */}
        <MaintenanceBayInteriorDetail
          cx={activeZoneDef?.cx ?? 0}
          cz={activeZoneDef?.cz ?? 15.5}
          visible={layers.buildings && activeZoneId === 'MAINTENANCE'}
          machines={machines}
          liveTelemetry={liveTelemetry}
        />

        {/* 7. Goods & Logistics Shipping Area (Outbound Conveyor, Gantry Crane, Semi-Truck) */}
        <GoodsAreaLogistics
          position={[48, 0, 15.5]}
          visible={layers.vehicles || viewLevel === 'PLANT' || activeZoneId === 'PACKAGING'}
        />

        {/* 8. Inter-Cell Automated Forklift Logistics (Flow 1: Machining -> Robot, Flow 2: Robot -> Packaging) */}
        <PlantForkliftLogistics
          visible={layers.vehicles || viewLevel === 'PLANT' || activeZoneId === 'MACHINING' || activeZoneId === 'ROBOT' || activeZoneId === 'PACKAGING'}
        />

        {/* Section Supervisor Labels — Plant Overview only; existing machine labels take over inside */}
        {layers.supervisors && viewLevel === 'PLANT' && ZONE_DEFS.map((z, idx) => (
          <SectionSupervisorLabel
            key={z.id}
            label={z.label}
            supervisor={z.supervisor}
            machineCount={z.machines}
            badgeColor={z.badgeColor}
            position={[z.cx, 6.5, z.cz - z.hd + 2.0]}
            visible={layers.supervisors}
            zoneNumber={idx + 1}
            counts={getZoneStatusCounts(z.id as ZoneId, machines)}
            onSelectZone={() => onPresetChange?.(z.id as CameraPresetType)}
          />
        ))}

        {/* Machines — only render once actually inside a building. The old
            primitive box shells fully enclosed every machine mesh, so they
            were invisible-but-present at Plant Overview; the real GLB
            buildings don't seal the same way (different footprint/gaps), so
            those meshes were visibly poking out from under/behind them. Gate
            the whole machine group on INTERIOR, not just its Html label. */}
        {layers.machines && viewLevel === 'INTERIOR' && allRenderedMachines.filter((m) => !activeZoneId || zoneIdForMachineCode(m.code) === activeZoneId).map((m) => {
          const liveM = machineByCode[m.code];
          const status = liveM?.status || 'RUNNING';
          const health = liveM?.health_score ?? 98;
          const pos = MACHINE_COORDS[m.code] || [0, 0, 0];
          const isSelected = selectedMachine?.code === m.code;
          const isFault = status === 'FAULT';
          const color = S_COLOR[status] || S_COLOR.RUNNING;
          const ringRadius = m.type === 'ROBOT' ? 2.8 : m.type === 'MIXER' ? 2.4 : 2.1;

          return (
            <group
              key={m.code}
              position={pos}
              onClick={(e) => {
                e.stopPropagation();
                onSelectMachine(liveM || ({
                  id: m.code, code: m.code, name: m.code,
                  type: (m as any).type, status, health_score: health
                } as any));
              }}
              onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
              onPointerOut={() => { document.body.style.cursor = 'default'; }}
            >
              <MachineZoneRing color={color} isSelected={isSelected} isFault={isFault} radius={ringRadius} />

              {m.type === 'CNC'         && <CNCMachineMesh color={color} isSelected={isSelected} isFault={isFault} code={m.code} />}
              {m.type === 'ROBOT'       && <RobotArmMesh color={color} isSelected={isSelected} isFault={isFault} pose={(m as any).pose ?? 0} />}
              {m.type === 'PUMP'        && <PumpMesh color={color} isSelected={isSelected} isFault={isFault} />}
              {m.type === 'MIXER'       && <MixerMesh color={color} isSelected={isSelected} isFault={isFault} />}
              {m.type === 'PRESS'       && <PressMesh color={color} isFault={isFault} />}
              {m.type === 'PROCESSING'  && <ProcessingUnitMesh color={color} isSelected={isSelected} isFault={isFault} code={m.code} />}
              {m.type === 'ASSEMBLY'    && <AssemblyWorkstationMesh color={color} isSelected={isSelected} isFault={isFault} code={m.code} />}
              {m.type === 'PACKAGING'   && <PackagingMachineMesh color={color} isSelected={isSelected} isFault={isFault} code={m.code} />}
              {m.type === 'MAINTENANCE' && <MaintenanceBenchMesh color={color} isSelected={isSelected} variant={(m as any).variant ?? 'bench'} />}

              {/* Machine badges/HUDs are Html overlays and aren't occluded by
                  the (opaque) building roof, so they only render once the
                  user is actually inside the building — the building's own
                  supervisor/signage card is the only thing shown from outside. */}
              {viewLevel === 'INTERIOR' && (
                <group position={[0, (m as any).labelH ?? 3.8, 0]}>
                  <MachineLabel
                    code={m.code}
                    status={status}
                    health={health}
                    color={color}
                    isSelected={isSelected}
                    isFault={isFault}
                    visible={layers.machineLabels}
                    onClick={() => onSelectMachine(liveM || ({
                      id: m.code, code: m.code, name: m.code,
                      type: (m as any).type, status, health_score: health
                    } as any))}
                  />
                  {isSelected && layers.liveSensors && (
                    <SelectedMachineSensors
                      telemetry={liveTelemetry[m.code]}
                      isFault={isFault}
                    />
                  )}
                </group>
              )}
            </group>
          );
        })}

        {/* Static Workers */}
        {layers.workers && activeWorkers.map((w, idx) => (
          <WorkerFigure
            key={idx}
            position={w.pos}
            rotation={w.rot}
            name={w.name}
            role={w.role}
            activity={w.activity}
            showAlways={layers.workerLabels}
            helmetColor={w.helmet}
          />
        ))}

        {/* Dynamic Dispatched Technician Walker */}
        {layers.workers && showTechnician && (
          <DispatchedTechnicianWalker
            faultyMachineCode={activeFaultyMachine}
            workerName={assignedTech.name}
            workerRole={assignedTech.role}
            helmetColor={assignedTech.helmet}
            onSelectTechnician={onSelectTechnician}
            onWalkingStateChange={handleWalkerStateChange}
          />
        )}

        {/* Camera */}
        <CameraController
          preset={cameraPreset}
          resetTrigger={resetTrigger}
        />

        <ContactShadows position={[0, 0, 0]} opacity={0.28} scale={85} blur={2.5} far={10} />
      </Canvas>
    </div>
  );
};
