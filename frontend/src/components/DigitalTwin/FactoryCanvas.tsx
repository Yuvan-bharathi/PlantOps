import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { Machine, TelemetryData } from '../../types';
import { SectionBuildingShell } from './SectionBuildingShell';
import { ZoneId, getZoneStatusCounts, zoneIdForMachineCode } from './zoneData';

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
  // ── ROBOT CELL (center x≈0, z≈-21) ──
  'ROBOT-01': [-5,  0, -26],
  'ROBOT-02': [ 5,  0, -26],
  'ROBOT-03': [-5,  0, -16],
  'ROBOT-04': [ 5,  0, -16],
  // ── PROCESSING CELL (center x≈+33, z≈-20.5) — 3-col x 2-row grid ──
  'MIXER-01':   [25, 0, -25],
  'PUMP-01':    [33, 0, -25],
  'PRESS-01':   [41, 0, -25],
  'PROCESS-01': [25, 0, -15],
  'PROCESS-02': [33, 0, -15],
  // ── ASSEMBLY CELL (center x≈-35, z≈15) — 2x2 grid, spread to fill zone ──
  'ASMB-01': [-40, 0, 10],
  'ASMB-02': [-30, 0, 10],
  'ASMB-03': [-40, 0, 20],
  'ASMB-04': [-30, 0, 20],
  // ── PACKAGING CELL (center x≈0, z≈+15.5) — 2 up, 1 centered below ──
  'PACK-01': [-5, 0, 11],
  'PACK-02': [ 5, 0, 11],
  'PACK-03': [ 0, 0, 21],
  // ── MAINTENANCE BAY (center x≈+31, z≈+16) — 2 up, 1 centered below ──
  'BENCH-01': [25, 0, 12],
  'BENCH-02': [37, 0, 12],
  'TEST-01':  [31, 0, 22],
};

// Zone definitions for boundaries and supervisor labels
export const ZONE_DEFS = [
  {
    id: 'MACHINING',
    label: 'MACHINING CELL',
    supervisor: 'Arun Kumar',
    machines: 6,
    cx: -35, cz: -20.5, hw: 13, hd: 10.5,
    floorColor: '#FAF5EE',
    badgeColor: '#D97706',
  },
  {
    id: 'ROBOT',
    label: 'ROBOT CELL',
    supervisor: 'Priya Nair',
    machines: 4,
    cx: 0, cz: -21, hw: 10, hd: 10.5,
    floorColor: '#EFF6FF',
    badgeColor: '#2563EB',
  },
  {
    id: 'PROCESSING',
    label: 'PROCESSING CELL',
    supervisor: 'Wei Zhang',
    machines: 5,
    cx: 33, cz: -20.5, hw: 12, hd: 10.5,
    floorColor: '#F0FDF4',
    badgeColor: '#059669',
  },
  {
    id: 'ASSEMBLY',
    label: 'ASSEMBLY CELL',
    supervisor: 'Carlos Gomez',
    machines: 4,
    cx: -35, cz: 15, hw: 12, hd: 10,
    floorColor: '#FFF7ED',
    badgeColor: '#EA580C',
  },
  {
    id: 'PACKAGING',
    label: 'PACKAGING CELL',
    supervisor: 'Tom Wilson',
    machines: 3,
    cx: 0, cz: 15.5, hw: 9.5, hd: 10,
    floorColor: '#FEFCE8',
    badgeColor: '#CA8A04',
  },
  {
    id: 'MAINTENANCE',
    label: 'MAINTENANCE BAY',
    supervisor: 'Sarah Jenkins',
    machines: 3,
    cx: 31, cz: 16, hw: 11.5, hd: 10,
    floorColor: '#FAF5FF',
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
// CNC Milling Machine Geometry
// ─────────────────────────────────────────────────────────────────────────────
const CNCMachineMesh: React.FC<{ color: string; isSelected: boolean; isFault: boolean }> = ({
  color, isSelected, isFault
}) => {
  const bodyColor = isSelected ? '#526071' : '#B0ADA5';
  const doorColor = isSelected ? '#93C5FD' : '#D1D5DB';
  return (
    <group>
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.2, 0.4, 2.6]} />
        <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.6, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.7, 2.4, 2.2]} />
        <meshStandardMaterial color={bodyColor} metalness={0.35} roughness={0.45} />
      </mesh>
      <mesh position={[0, 1.6, 1.12]}>
        <boxGeometry args={[2.0, 1.8, 0.06]} />
        <meshStandardMaterial color={doorColor} metalness={0.2} roughness={0.7} transparent opacity={0.65} />
      </mesh>
      <mesh position={[0.7, 1.6, 1.17]}>
        <boxGeometry args={[0.08, 0.8, 0.04]} />
        <meshStandardMaterial color="#0F172A" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[-1.5, 2.1, 0.7]} rotation={[0, 0.35, 0]}>
        <boxGeometry args={[0.1, 0.8, 1.0]} />
        <meshStandardMaterial color="#1E293B" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[-1.44, 2.15, 0.7]} rotation={[0, 0.35, 0]}>
        <boxGeometry args={[0.02, 0.55, 0.75]} />
        <meshStandardMaterial color={isFault ? '#D64545' : '#2563EB'} emissive={isFault ? '#D64545' : '#2563EB'} emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0, 2.9, -0.4]} castShadow>
        <boxGeometry args={[0.8, 0.6, 0.8]} />
        <meshStandardMaterial color="#475569" metalness={0.85} roughness={0.2} />
      </mesh>
      <mesh position={[0, 2.5, -0.4]}>
        <cylinderGeometry args={[0.1, 0.08, 0.45, 12]} />
        <meshStandardMaterial color="#E2E8F0" metalness={0.95} roughness={0.1} />
      </mesh>
      <mesh position={[0, 3.1, 0.4]}>
        <cylinderGeometry args={[0.45, 0.45, 0.5, 16]} />
        <meshStandardMaterial color="#475569" metalness={0.5} roughness={0.5} />
      </mesh>
      <StatusBeacon color={color} isFault={isFault} position={[1.15, 3.2, -0.9]} />
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Industrial Robotic Arm (4 pose variants)
// ─────────────────────────────────────────────────────────────────────────────
const RobotArmMesh: React.FC<{ color: string; isSelected: boolean; pose?: number }> = ({
  color, isSelected, pose = 0
}) => {
  const armRef = useRef<THREE.Group>(null);
  const wristRef = useRef<THREE.Group>(null);

  // Pose parameters: [shoulderY, shoulderZ, elbowX, wristX, animSpeed]
  const poses = [
    { sy: 0.45, sz: 0.12, speed: 0.8 },   // ROBOT-01: active arm-holding
    { sy: 0.3,  sz: 0.08, speed: 0.5 },   // ROBOT-02: above workstation
    { sy: 0.6,  sz: 0.18, speed: 1.1 },   // ROBOT-03: assembly work
    { sy: 0.15, sz: 0.04, speed: 0.2 },   // ROBOT-04: standby
  ];
  const p = poses[pose] || poses[0];

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (armRef.current) {
      armRef.current.rotation.y = Math.sin(t * p.speed) * p.sy;
      armRef.current.rotation.z = Math.cos(t * p.speed) * p.sz;
    }
    if (wristRef.current) {
      wristRef.current.rotation.x = Math.sin(t * p.speed * 2) * 0.25;
    }
  });

  return (
    <group>
      {/* Safety fence panels */}
      {[[-2.8, 0], [2.8, 0], [0, -2.8], [0, 2.8]].map(([fx, fz], i) => (
        <mesh key={`fence-${i}`} position={[fx as number, 0.8, fz as number]}
          rotation={[0, (i < 2 ? Math.PI / 2 : 0), 0]}>
          <boxGeometry args={[5.0, 1.6, 0.06]} />
          <meshStandardMaterial color="#F59E0B" metalness={0.3} roughness={0.6} transparent opacity={0.35} />
        </mesh>
      ))}
      {/* Fence posts */}
      {[[-2.8,-2.8],[2.8,-2.8],[-2.8,2.8],[2.8,2.8]].map(([fx,fz],i) => (
        <mesh key={`post-${i}`} position={[fx,0.9,fz]}>
          <cylinderGeometry args={[0.07, 0.07, 1.8, 8]} />
          <meshStandardMaterial color="#1E293B" metalness={0.6}/>
        </mesh>
      ))}
      {/* Warning stripes on floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[2.6, 2.85, 32]} />
        <meshBasicMaterial color="#F59E0B" transparent opacity={0.5} />
      </mesh>
      {/* Heavy Base Flange */}
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[1.3, 1.5, 0.4, 16]} />
        <meshStandardMaterial color="#1E293B" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Rotating Turret */}
      <mesh position={[0, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.85, 1.0, 0.6, 16]} />
        <meshStandardMaterial color={isSelected ? '#2563EB' : '#D97706'} metalness={0.4} roughness={0.4} />
      </mesh>
      {/* Articulated arm */}
      <group ref={armRef} position={[0, 1.0, 0]}>
        <mesh position={[0, 0.4, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.45, 0.45, 0.7, 14]} />
          <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0, 1.6, 0.4]} rotation={[-0.45, 0, 0]} castShadow>
          <boxGeometry args={[0.45, 2.2, 0.5]} />
          <meshStandardMaterial color={isSelected ? '#3B82F6' : '#F59E0B'} metalness={0.4} roughness={0.4} />
        </mesh>
        <mesh position={[0, 2.6, 0.9]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.38, 0.38, 0.6, 12]} />
          <meshStandardMaterial color="#1E293B" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0, 3.4, 0.4]} rotation={[0.6, 0, 0]} castShadow>
          <boxGeometry args={[0.35, 1.8, 0.4]} />
          <meshStandardMaterial color={isSelected ? '#3B82F6' : '#F59E0B'} metalness={0.4} roughness={0.4} />
        </mesh>
        <group ref={wristRef} position={[0, 4.2, -0.2]}>
          <mesh>
            <cylinderGeometry args={[0.2, 0.2, 0.35, 10]} />
            <meshStandardMaterial color="#0F172A" metalness={0.8} roughness={0.2} />
          </mesh>
          {[-0.14, 0.14].map((x, i) => (
            <mesh key={i} position={[x, 0.3, 0]}>
              <boxGeometry args={[0.06, 0.35, 0.12]} />
              <meshStandardMaterial color="#94A3B8" metalness={0.9} roughness={0.1} />
            </mesh>
          ))}
        </group>
      </group>
      <mesh position={[-2.0, 0.9, -1.5]} castShadow>
        <boxGeometry args={[0.8, 1.8, 0.6]} />
        <meshStandardMaterial color="#E2E8F0" metalness={0.4} roughness={0.5} />
      </mesh>
      <StatusBeacon color={color} isFault={false} position={[-2.0, 2.0, -1.5]} />
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Hydraulic Pump
// ─────────────────────────────────────────────────────────────────────────────
const PumpMesh: React.FC<{ color: string; isSelected: boolean }> = ({ color, isSelected }) => (
  <group>
    <mesh position={[0, 0.15, 0]} castShadow>
      <boxGeometry args={[2.6, 0.3, 1.8]} />
      <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.4} />
    </mesh>
    {[-0.9, -0.7, -0.5, -0.3].map((x, i) => (
      <mesh key={i} position={[x, 0.8, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.6, 0.6, 0.04, 16]} />
        <meshStandardMaterial color="#1E293B" metalness={0.6} />
      </mesh>
    ))}
    <mesh position={[-0.6, 0.8, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
      <cylinderGeometry args={[0.55, 0.55, 1.2, 16]} />
      <meshStandardMaterial color={isSelected ? '#0F766E' : '#475569'} metalness={0.5} roughness={0.4} />
    </mesh>
    <mesh position={[0.5, 0.8, 0]} castShadow>
      <cylinderGeometry args={[0.65, 0.65, 0.7, 16]} />
      <meshStandardMaterial color="#0284C7" metalness={0.6} roughness={0.3} />
    </mesh>
    <mesh position={[0.5, 1.5, 0]}>
      <cylinderGeometry args={[0.18, 0.18, 0.8, 12]} />
      <meshStandardMaterial color="#64748B" metalness={0.8} roughness={0.2} />
    </mesh>
    <mesh position={[0.5, 1.9, 0]}>
      <cylinderGeometry args={[0.3, 0.3, 0.08, 12]} />
      <meshStandardMaterial color="#334155" metalness={0.9} />
    </mesh>
    <StatusBeacon color={color} isFault={false} position={[0.5, 2.2, -0.6]} />
  </group>
);

// ─────────────────────────────────────────────────────────────────────────────
// Agitator Mixer
// ─────────────────────────────────────────────────────────────────────────────
const MixerMesh: React.FC<{ color: string; isSelected: boolean }> = ({ color, isSelected }) => {
  const agitatorRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (agitatorRef.current) agitatorRef.current.rotation.y = state.clock.elapsedTime * 2.5;
  });
  return (
    <group>
      {[0, 120, 240].map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <mesh key={i} position={[Math.sin(rad)*1.1, 1.0, Math.cos(rad)*1.1]}
            rotation={[Math.cos(rad)*0.3, 0, -Math.sin(rad)*0.3]} castShadow>
            <boxGeometry args={[0.18, 2.0, 0.18]} />
            <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.3} />
          </mesh>
        );
      })}
      <mesh position={[0, 2.8, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.05, 1.15, 3.4, 24]} />
        <meshStandardMaterial color={isSelected ? '#94A3B8' : '#CBD5E1'} metalness={0.75} roughness={0.25} />
      </mesh>
      <mesh position={[0, 1.0, 0]}>
        <coneGeometry args={[1.05, 0.85, 24]} />
        <meshStandardMaterial color="#94A3B8" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0, 4.7, 0]} castShadow>
        <cylinderGeometry args={[0.55, 0.6, 0.8, 16]} />
        <meshStandardMaterial color="#1E293B" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh ref={agitatorRef} position={[0, 3.5, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 2.4, 8]} />
        <meshStandardMaterial color="#64748B" metalness={0.9} />
      </mesh>
      <StatusBeacon color={color} isFault={false} position={[0.8, 5.1, 0]} />
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Hydraulic Press
// ─────────────────────────────────────────────────────────────────────────────
const PressMesh: React.FC<{ color: string }> = ({ color }) => (
  <group>
    <mesh position={[0, 0.25, 0]} castShadow>
      <boxGeometry args={[2.5, 0.5, 2.0]} />
      <meshStandardMaterial color="#1E293B" metalness={0.8} roughness={0.3} />
    </mesh>
    <mesh position={[0, 0.8, 0]}>
      <boxGeometry args={[1.8, 0.2, 1.4]} />
      <meshStandardMaterial color="#64748B" metalness={0.7} roughness={0.3} />
    </mesh>
    {[-0.9, 0.9].map((x, i) => (
      <mesh key={i} position={[x, 2.8, 0]} castShadow>
        <boxGeometry args={[0.35, 4.0, 0.35]} />
        <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.3} />
      </mesh>
    ))}
    <mesh position={[0, 4.9, 0]} castShadow>
      <boxGeometry args={[2.4, 0.7, 1.2]} />
      <meshStandardMaterial color="#0F172A" metalness={0.8} roughness={0.2} />
    </mesh>
    <mesh position={[0, 2.7, 0]}>
      <boxGeometry args={[1.2, 1.0, 0.9]} />
      <meshStandardMaterial color="#94A3B8" metalness={0.7} roughness={0.3} />
    </mesh>
    <StatusBeacon color={color} isFault={false} position={[0, 5.4, 0]} />
  </group>
);

// ─────────────────────────────────────────────────────────────────────────────
// Generic Processing Unit (PROCESS-01, PROCESS-02)
// ─────────────────────────────────────────────────────────────────────────────
const ProcessingUnitMesh: React.FC<{ color: string; isSelected: boolean }> = ({ color, isSelected }) => (
  <group>
    {/* Tank body */}
    <mesh position={[0, 1.6, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.9, 1.0, 3.2, 20]} />
      <meshStandardMaterial color={isSelected ? '#7DD3FC' : '#BAE6FD'} metalness={0.6} roughness={0.3} />
    </mesh>
    {/* Bottom dome */}
    <mesh position={[0, 0.15, 0]}>
      <sphereGeometry args={[0.98, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshStandardMaterial color="#94A3B8" metalness={0.6} roughness={0.3} />
    </mesh>
    {/* Control panel */}
    <mesh position={[1.2, 1.4, 0]} castShadow>
      <boxGeometry args={[0.12, 1.4, 0.9]} />
      <meshStandardMaterial color="#E2E8F0" metalness={0.3} roughness={0.6} />
    </mesh>
    <mesh position={[1.27, 1.5, 0]}>
      <boxGeometry args={[0.02, 0.8, 0.6]} />
      <meshStandardMaterial color="#2563EB" emissive="#2563EB" emissiveIntensity={0.4} />
    </mesh>
    {/* Pipe connections */}
    <mesh position={[0, 3.2, 0.5]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.12, 0.12, 0.9, 10]} />
      <meshStandardMaterial color="#0284C7" metalness={0.6} />
    </mesh>
    <StatusBeacon color={color} isFault={false} position={[0, 3.5, 0]} />
  </group>
);

// ─────────────────────────────────────────────────────────────────────────────
// Assembly Workstation
// ─────────────────────────────────────────────────────────────────────────────
const AssemblyWorkstationMesh: React.FC<{ color: string; isSelected: boolean }> = ({ color, isSelected }) => (
  <group>
    {/* Work table top */}
    <mesh position={[0, 1.1, 0]} castShadow receiveShadow>
      <boxGeometry args={[3.0, 0.1, 1.8]} />
      <meshStandardMaterial color={isSelected ? '#93C5FD' : '#CBD5E1'} metalness={0.2} roughness={0.6} />
    </mesh>
    {/* Table legs */}
    {[[-1.3, -0.8], [-1.3, 0.8], [1.3, -0.8], [1.3, 0.8]].map(([x, z], i) => (
      <mesh key={i} position={[x, 0.55, z]}>
        <boxGeometry args={[0.1, 1.1, 0.1]} />
        <meshStandardMaterial color="#475569" metalness={0.6} />
      </mesh>
    ))}
    {/* Component bins on table */}
    {[-0.8, 0, 0.8].map((x, i) => (
      <mesh key={i} position={[x, 1.25, -0.6]} castShadow>
        <boxGeometry args={[0.5, 0.28, 0.35]} />
        <meshStandardMaterial color={['#2563EB', '#D97706', '#059669'][i]} roughness={0.8} />
      </mesh>
    ))}
    {/* Tool cart */}
    <mesh position={[-1.8, 0.7, 0]} castShadow>
      <boxGeometry args={[0.7, 1.4, 0.9]} />
      <meshStandardMaterial color="#64748B" metalness={0.5} roughness={0.5} />
    </mesh>
    {/* Small conveyor section */}
    <mesh position={[2.2, 0.78, 0]}>
      <boxGeometry args={[1.2, 0.1, 0.9]} />
      <meshStandardMaterial color="#1E293B" roughness={0.9} />
    </mesh>
    <mesh position={[2.2, 0.72, 0]}>
      <boxGeometry args={[1.2, 0.06, 0.95]} />
      <meshStandardMaterial color="#475569" metalness={0.7} />
    </mesh>
    <StatusBeacon color={color} isFault={false} position={[1.2, 1.4, -0.8]} />
  </group>
);

// ─────────────────────────────────────────────────────────────────────────────
// Packaging Machine
// ─────────────────────────────────────────────────────────────────────────────
const PackagingMachineMesh: React.FC<{ color: string; isSelected: boolean }> = ({ color, isSelected }) => (
  <group>
    {/* Main wrapping machine */}
    <mesh position={[0, 1.2, 0]} castShadow receiveShadow>
      <boxGeometry args={[2.8, 2.4, 2.2]} />
      <meshStandardMaterial color={isSelected ? '#526071' : '#475569'} metalness={0.5} roughness={0.5} />
    </mesh>
    <mesh position={[0, 1.8, 1.12]}>
      <boxGeometry args={[1.0, 0.7, 0.04]} />
      <meshStandardMaterial color="#0F172A" />
    </mesh>
    {/* Infeed conveyor */}
    <mesh position={[-2.4, 0.7, 0]}>
      <boxGeometry args={[1.6, 0.1, 1.0]} />
      <meshStandardMaterial color="#1E293B" roughness={0.9} />
    </mesh>
    {/* Output roller chute */}
    <mesh position={[2.0, 0.7, 0]} rotation={[0, 0, 0.25]}>
      <boxGeometry args={[1.2, 0.1, 1.0]} />
      <meshStandardMaterial color="#64748B" metalness={0.7} />
    </mesh>
    {/* Pallet */}
    <mesh position={[3.2, 0.1, 0]}>
      <boxGeometry args={[1.4, 0.18, 1.2]} />
      <meshStandardMaterial color="#92400E" roughness={0.9} />
    </mesh>
    {/* Stacked boxes on pallet */}
    {[0, 0.42, 0.84].map((y, i) => (
      <mesh key={i} position={[3.2, 0.29 + y, 0]} castShadow>
        <boxGeometry args={[1.1, 0.38, 0.9]} />
        <meshStandardMaterial color={['#D97706', '#2563EB', '#10B981'][i]} roughness={0.7} />
      </mesh>
    ))}
    <StatusBeacon color={color} isFault={false} position={[0, 2.6, -1.0]} />
  </group>
);

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
    {variant === 'bench' ? (
      <>
        {/* Spare parts on bench */}
        {[-0.6, 0, 0.6].map((x, i) => (
          <mesh key={i} position={[x, 1.18, 0.4]} castShadow>
            <cylinderGeometry args={[0.18, 0.18, 0.25, 10]} />
            <meshStandardMaterial color={['#94A3B8', '#CBD5E1', '#64748B'][i]} metalness={0.7} />
          </mesh>
        ))}
        {/* Spare parts shelf */}
        <mesh position={[0, 2.1, -0.7]} castShadow>
          <boxGeometry args={[2.8, 0.08, 0.5]} />
          <meshStandardMaterial color="#1E293B" metalness={0.5} />
        </mesh>
        {[-0.8, 0, 0.8].map((x, i) => (
          <mesh key={i} position={[x, 2.28, -0.7]}>
            <boxGeometry args={[0.55, 0.3, 0.4]} />
            <meshStandardMaterial color={['#2563EB', '#059669', '#D97706'][i]} roughness={0.7} />
          </mesh>
        ))}
      </>
    ) : (
      <>
        {/* Diagnostic test monitor */}
        <mesh position={[0.8, 1.7, 0]} castShadow>
          <boxGeometry args={[0.08, 0.9, 1.1]} />
          <meshStandardMaterial color="#1E293B" metalness={0.6} />
        </mesh>
        <mesh position={[0.85, 1.75, 0]}>
          <boxGeometry args={[0.02, 0.7, 0.85]} />
          <meshStandardMaterial color="#22D3EE" emissive="#22D3EE" emissiveIntensity={0.5} />
        </mesh>
        {/* Oscilloscope/test equipment */}
        <mesh position={[-0.4, 1.14, 0.1]}>
          <boxGeometry args={[0.6, 0.25, 0.5]} />
          <meshStandardMaterial color="#1E293B" metalness={0.5} />
        </mesh>
        <mesh position={[-0.38, 1.28, 0.1]}>
          <boxGeometry args={[0.02, 0.12, 0.35]} />
          <meshStandardMaterial color="#4ADE80" emissive="#4ADE80" emissiveIntensity={0.4} />
        </mesh>
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
    {/* Tinted floor */}
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[hw * 2, hd * 2]} />
      <meshBasicMaterial color={floorColor} transparent opacity={0.55} />
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

const StreetLight: React.FC<{ position: [number, number, number] }> = ({ position }) => (
  <group position={position}>
    <mesh position={[0, 2.2, 0]}>
      <cylinderGeometry args={[0.07, 0.09, 4.4, 8]} />
      <meshStandardMaterial color="#4B5563" metalness={0.6} roughness={0.4} />
    </mesh>
    <mesh position={[0.35, 4.3, 0]} rotation={[0, 0, -0.3]}>
      <cylinderGeometry args={[0.05, 0.05, 0.9, 6]} />
      <meshStandardMaterial color="#4B5563" metalness={0.6} roughness={0.4} />
    </mesh>
    <mesh position={[0.65, 4.05, 0]}>
      <sphereGeometry args={[0.16, 8, 8]} />
      <meshStandardMaterial color="#FDE68A" emissive="#FDE68A" emissiveIntensity={0.7} />
    </mesh>
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

const GateStructure: React.FC<{ position: [number, number, number] }> = ({ position }) => (
  <group position={position}>
    {[-4.2, 4.2].map((x, i) => (
      <mesh key={i} position={[x, 2.4, 0]} castShadow>
        <boxGeometry args={[0.5, 4.8, 0.5]} />
        <meshStandardMaterial color="#64748B" metalness={0.5} roughness={0.4} />
      </mesh>
    ))}
    <mesh position={[0, 4.7, 0]} castShadow>
      <boxGeometry args={[9, 0.6, 0.5]} />
      <meshStandardMaterial color="#1E293B" metalness={0.5} roughness={0.4} />
    </mesh>
    <mesh position={[0, 4.7, 0.3]}>
      <boxGeometry args={[6, 0.5, 0.05]} />
      <meshStandardMaterial color="#2563EB" emissive="#2563EB" emissiveIntensity={0.15} />
    </mesh>
    {/* Security booth */}
    <mesh position={[5.8, 1.1, 0]} castShadow>
      <boxGeometry args={[1.6, 2.2, 1.6]} />
      <meshStandardMaterial color="#E2E8F0" metalness={0.2} roughness={0.6} />
    </mesh>
    <mesh position={[5.8, 1.5, 0.81]}>
      <boxGeometry args={[1.0, 0.8, 0.05]} />
      <meshStandardMaterial color="#A9CBEA" transparent opacity={0.6} emissive="#A9CBEA" emissiveIntensity={0.2} />
    </mesh>
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

const UtilityTank: React.FC<{ position: [number, number, number]; radius?: number; height?: number }> = ({ position, radius = 1.6, height = 4.5 }) => (
  <group position={position}>
    <mesh position={[0, height / 2, 0]} castShadow>
      <cylinderGeometry args={[radius, radius, height, 18]} />
      <meshStandardMaterial color="#B8C4CC" metalness={0.6} roughness={0.35} />
    </mesh>
    <mesh position={[0, height + 0.15, 0]}>
      <cylinderGeometry args={[radius * 1.03, radius * 1.03, 0.3, 18]} />
      <meshStandardMaterial color="#8B98A3" metalness={0.6} roughness={0.3} />
    </mesh>
  </group>
);

const RoadStrip: React.FC<{ position: [number, number, number]; args: [number, number]; dashed?: boolean }> = ({ position, args, dashed }) => (
  <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={position}>
      <planeGeometry args={args} />
      <meshStandardMaterial color="#5B5C57" roughness={0.95} />
    </mesh>
    {dashed && (
      args[0] > args[1]
        ? Array.from({ length: Math.floor(args[0] / 6) }).map((_, i) => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[position[0] - args[0] / 2 + 3 + i * 6, position[1] + 0.002, position[2]]}>
            <planeGeometry args={[1.6, 0.2]} />
            <meshBasicMaterial color="#EAB308" />
          </mesh>
        ))
        : Array.from({ length: Math.floor(args[1] / 6) }).map((_, i) => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[position[0], position[1] + 0.002, position[2] - args[1] / 2 + 3 + i * 6]}>
            <planeGeometry args={[0.2, 1.6]} />
            <meshBasicMaterial color="#EAB308" />
          </mesh>
        ))
    )}
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
  const FW = 110, FD = 72;

  const treePositions: [number, number, number][] = [
    [-50, 0, -44], [-30, 0, -44], [-10, 0, -44], [10, 0, -44], [30, 0, -44], [50, 0, -44],
    [-45, 0, 50], [-25, 0, 52], [0, 0, 51], [25, 0, 52], [45, 0, 50],
    [-63, 0, -22], [-63, 0, 0], [-63, 0, 20],
    [-58, 0, -36], [-38, 0, -37], [38, 0, -37], [58, 0, -36],
    [-38, 0, 44], [12, 0, 45], [63, 0, -8], [63, 0, 26],
  ];
  const treeRoundPositions: [number, number, number][] = [
    [-40, 0, -44], [-20, 0, -44], [0, 0, -44], [20, 0, -44], [40, 0, -44],
    [-35, 0, 51], [-10, 0, 52], [15, 0, 52], [35, 0, 51],
    [-63, 0, -11], [-63, 0, 11],
  ];

  const streetLightPositions: [number, number, number][] = [
    [-40, 0, -9.5], [-8, 0, -9.5], [8, 0, -9.5], [40, 0, -9.5],
    [-16.5, 0, -30], [-16.5, 0, 28], [16, 0, -30], [16, 0, 28],
    [-58, 0, 30], [-40, 0, 46], [10, 0, 46], [FW / 2 + 6, 0, -18], [FW / 2 + 6, 0, 20],
  ];

  return (
    <group>
      {/* Base Floor (production apron under the buildings) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[FW, FD]} />
        <meshStandardMaterial color="#E5E2DA" roughness={0.88} metalness={0.02} />
      </mesh>

      {/* Campus apron + perimeter, gate/shipping/utility labels, low fence posts — Plant Overview only */}
      <group visible={plantLevel}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
          <planeGeometry args={[FW + 30, FD + 30]} />
          <meshStandardMaterial color="#C7C4BC" roughness={0.95} />
        </mesh>

        {/* Perimeter fence posts */}
        {Array.from({ length: 10 }).map((_, i) => {
          const t = i / 9;
          const x = -FW / 2 - 14 + t * (FW + 28);
          return (
            <React.Fragment key={`fp-${i}`}>
              <mesh position={[x, 0.6, -FD / 2 - 14]}><cylinderGeometry args={[0.08, 0.08, 1.2, 6]} /><meshStandardMaterial color="#94A3B8" /></mesh>
              <mesh position={[x, 0.6, FD / 2 + 14]}><cylinderGeometry args={[0.08, 0.08, 1.2, 6]} /><meshStandardMaterial color="#94A3B8" /></mesh>
            </React.Fragment>
          );
        })}

        <Html position={[-FW / 2 - 6, 0.5, FD / 2 + 6]} center distanceFactor={44} zIndexRange={[3, 0]}>
          <div className="select-none pointer-events-none px-2 py-1 rounded-lg text-[9px] font-extrabold uppercase tracking-wide text-white" style={{ background: 'rgba(30,41,59,0.75)' }}>
            ← Main Gate
          </div>
        </Html>
        <Html position={[FW / 2 - 8, 0.5, FD / 2 + 6]} center distanceFactor={44} zIndexRange={[3, 0]}>
          <div className="select-none pointer-events-none px-2 py-1 rounded-lg text-[9px] font-extrabold uppercase tracking-wide text-white" style={{ background: 'rgba(30,41,59,0.75)' }}>
            Shipping &amp; Receiving →
          </div>
        </Html>
        <Html position={[FW / 2 + 10, 0.5, -FD / 2 + 10]} center distanceFactor={44} zIndexRange={[3, 0]}>
          <div className="select-none pointer-events-none px-2 py-1 rounded-lg text-[9px] font-extrabold uppercase tracking-wide text-white" style={{ background: 'rgba(30,41,59,0.75)' }}>
            Utility Area
          </div>
        </Html>

        {/* ── Roads: a horizontal main street between the two building rows,
            two north-south streets through the column gaps, plus a perimeter
            ring — all sit in the gaps carved out by the zone layout. ── */}
        {showRoads && (
          <>
            <RoadStrip position={[0, -0.02, -2.5]} args={[FW + 6, 15]} dashed />
            <RoadStrip position={[-16.5, -0.02, 0]} args={[3.6, FD + 6]} dashed />
            <RoadStrip position={[16, -0.02, 0]} args={[3.6, FD + 6]} dashed />
            <RoadStrip position={[0, -0.025, FD / 2 + 6]} args={[FW + 14, 6]} />
            <RoadStrip position={[FW / 2 + 6, -0.025, 0]} args={[6, FD + 14]} />
          </>
        )}

        {/* Parking lot, west of Assembly / north of the Main Gate road — clear
            of both the Assembly building and the gate structure's footprint */}
        {showVehicles && (
          <group position={[-58, 0, 31]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.015, 0]}>
              <planeGeometry args={[15, 9]} />
              <meshStandardMaterial color="#8B8983" roughness={0.9} />
            </mesh>
            {[-6.6, -3.8, -1, 1.8, 4.6].map((x, i) => (
              <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, -0.01, 0]}>
                <planeGeometry args={[0.15, 8]} />
                <meshBasicMaterial color="#FAF9F6" />
              </mesh>
            ))}
            {[-5.2, -2.4, 0.4, 3.2, 6.0].map((x, i) => (
              <ParkedCar
                key={`a-${i}`}
                position={[x, 0, -2.2]}
                color={['#D64545', '#3978C8', '#F1F5F9', '#059669', '#94A3B8'][i]}
              />
            ))}
            {[-5.2, -2.4, 0.4, 3.2].map((x, i) => (
              <ParkedCar
                key={`b-${i}`}
                position={[x, 0, 2.2]}
                color={['#1E293B', '#D97706', '#7C5CC4', '#94A3B8'][i]}
                rotationY={Math.PI}
              />
            ))}
            <Tree position={[-8.5, 0, -4.5]} />
            <Tree position={[8, 0, 4.5]} />
          </group>
        )}

        {/* Trucks + forklift near Shipping & Receiving */}
        {showVehicles && (
          <>
            <ParkedTruck position={[FW / 2 - 12, 0, FD / 2 + 5]} rotationY={Math.PI / 2} />
            <ParkedTruck position={[FW / 2 - 20, 0, FD / 2 + 5]} rotationY={Math.PI / 2} />
            <ForkliftVehicle position={[FW / 2 - 27, 0, FD / 2 + 6]} rotationY={Math.PI / 2} />
            {/* Service van near Maintenance */}
            <ParkedCar position={[31, 0, FD / 2 + 4]} color="#94A3B8" rotationY={0} />
          </>
        )}

        {/* Utility tanks */}
        <group visible={showVehicles}>
          <UtilityTank position={[FW / 2 + 10, 0, -FD / 2 + 6]} radius={1.8} height={5} />
          <UtilityTank position={[FW / 2 + 15, 0, -FD / 2 + 6]} radius={1.4} height={4} />
          <UtilityTank position={[FW / 2 + 10, 0, -FD / 2 + 13]} radius={1.4} height={4.5} />
        </group>

        {/* Containers + a truck beside Processing (east side) — goods staged for move-out */}
        {showVehicles && (
          <>
            <ShippingContainer position={[48, 1.25, -25]} color="#3978C8" />
            <ShippingContainer position={[48, 1.25, -18]} color="#D97706" />
            <ShippingContainer position={[48, 3.85, -25]} color="#94A3B8" />
            <ParkedTruck position={[54, 0, -21]} />
          </>
        )}

        {/* Main Gate structure, spanning the south perimeter road */}
        {showRoads && (
          <group position={[-53, 0, FD / 2 + 6]} rotation={[0, Math.PI / 2, 0]}>
            <GateStructure position={[0, 0, 0]} />
          </group>
        )}

        {/* Street lights along the main street and perimeter roads */}
        {showRoads && streetLightPositions.map((p, i) => <StreetLight key={i} position={p} />)}

        {/* Trees (two low-poly variants for visual variety) */}
        {showTrees && treePositions.map((p, i) => <Tree key={`t-${i}`} position={p} />)}
        {showTrees && treeRoundPositions.map((p, i) => <TreeRound key={`tr-${i}`} position={p} />)}
      </group>

      {/* 6 Section Zone Boundaries (floor tint + safety stripes, sit under each building) */}
      {ZONE_DEFS.map((z) => (
        <SectionBoundary
          key={z.id}
          cx={z.cx} cz={z.cz} hw={z.hw} hd={z.hd}
          floorColor={z.floorColor}
          showSafety={showSafety}
        />
      ))}

      {/* Pedestrian walkway paint inside each building's own footprint (kept subtle, interior-only detail) */}
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
// Dispatched Technician Walker (Moves across factory walkways to faulty machine)
// ─────────────────────────────────────────────────────────────────────────────
interface DispatchedTechnicianProps {
  faultyMachineCode: string | null;
  workerName?: string;
  onSelectTechnician?: (machineCode: string) => void;
}

const DispatchedTechnicianWalker: React.FC<DispatchedTechnicianProps> = ({
  faultyMachineCode,
  workerName = 'Frank Moore',
  onSelectTechnician,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);
  const scanBeamRef = useRef<THREE.Mesh>(null);

  // Home location: Left West Logistics & Technician Dispatch Gate [-52, 0, -1.5]
  const homePos: [number, number, number] = useMemo(() => [-52, 0, -1.5], []);

  // Approach offset in front of target machine
  const targetPos = useMemo<[number, number, number] | null>(() => {
    if (!faultyMachineCode || !MACHINE_COORDS[faultyMachineCode]) return null;
    const [tx, , tz] = MACHINE_COORDS[faultyMachineCode];
    const offsetZ = tz > -1.5 ? -2.4 : 2.4;
    return [tx, 0, tz + offsetZ];
  }, [faultyMachineCode]);

  // Waypoints: West Gate -> Main Street -> through the target building's door -> machine
  const waypoints = useMemo<[number, number, number][]>(() => {
    if (!targetPos || !faultyMachineCode) return [homePos];
    const [tx, , tz] = targetPos;
    const zoneId = zoneIdForMachineCode(faultyMachineCode);
    const zone = zoneId ? ZONE_DEFS.find((z) => z.id === zoneId) : null;
    const doorX = zone ? zone.cx : tx;
    return [
      homePos,            // 1. West gate
      [doorX, 0, -1.5],   // 2. Walk the main street to this building's entrance
      [doorX, 0, tz],     // 3. Walk straight through the door gap into the building
      [tx, 0, tz],        // 4. Side-step to the exact machine
    ];
  }, [homePos, targetPos, faultyMachineCode]);

  const { pathSegments, totalDistance } = useMemo(() => {
    const segments: { start: [number, number, number]; end: [number, number, number]; length: number }[] = [];
    let total = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      const p1 = waypoints[i];
      const p2 = waypoints[i + 1];
      const len = Math.hypot(p2[0] - p1[0], p2[2] - p1[2]);
      if (len > 0.001) {
        segments.push({ start: p1, end: p2, length: len });
        total += len;
      }
    }
    return { pathSegments: segments, totalDistance: Math.max(total, 0.001) };
  }, [waypoints]);

  const travelRef = useRef({
    currentDist: 0,
    isArrived: false,
    prevCode: null as string | null,
  });

  const [arrivedDisplay, setArrivedDisplay] = useState(false);

  useEffect(() => {
    if (faultyMachineCode !== travelRef.current.prevCode) {
      travelRef.current.prevCode = faultyMachineCode;
      travelRef.current.currentDist = 0;
      travelRef.current.isArrived = false;
      setArrivedDisplay(false);
    }
  }, [faultyMachineCode]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;

    if (!targetPos || totalDistance <= 0.001) {
      groupRef.current.position.set(homePos[0], homePos[1], homePos[2]);
      groupRef.current.rotation.y = -0.3;
      if (leftLegRef.current) leftLegRef.current.rotation.x = 0;
      if (rightLegRef.current) rightLegRef.current.rotation.x = 0;
      if (scanBeamRef.current) scanBeamRef.current.visible = false;
      return;
    }

    const walkSpeed = 5.6; // Units/s (~6s across floor)
    if (travelRef.current.currentDist < totalDistance) {
      travelRef.current.currentDist = Math.min(
        totalDistance,
        travelRef.current.currentDist + delta * walkSpeed
      );
    }

    const isArrived = travelRef.current.currentDist >= totalDistance;
    if (isArrived !== travelRef.current.isArrived) {
      travelRef.current.isArrived = isArrived;
      setArrivedDisplay(isArrived);
    }

    // Interpolate current position along waypoints
    let distCounter = 0;
    let currPos: [number, number, number] = waypoints[0];
    let heading = 0;

    for (const seg of pathSegments) {
      if (travelRef.current.currentDist <= distCounter + seg.length) {
        const segProgress = (travelRef.current.currentDist - distCounter) / seg.length;
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

    if (!isArrived) {
      groupRef.current.rotation.y = heading;
      const swing = Math.sin(t * 12) * 0.55;
      if (leftLegRef.current) leftLegRef.current.rotation.x = swing;
      if (rightLegRef.current) rightLegRef.current.rotation.x = -swing;
      if (leftArmRef.current) leftArmRef.current.rotation.x = -swing * 0.7;
      if (rightArmRef.current) rightArmRef.current.rotation.x = swing * 0.7;
      if (scanBeamRef.current) scanBeamRef.current.visible = false;
    } else {
      const [tx, , tz] = MACHINE_COORDS[faultyMachineCode!];
      const faceAngle = Math.atan2(tx - currPos[0], tz - currPos[2]);
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, faceAngle, 0.1);

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
        if (faultyMachineCode) {
          e.stopPropagation();
          onSelectTechnician?.(faultyMachineCode);
        }
      }}
      onPointerOver={(e) => {
        if (faultyMachineCode) {
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

      {/* Red Hardhat */}
      <mesh position={[0, 1.82, 0]}>
        <cylinderGeometry args={[0.22, 0.2, 0.16, 12]} />
        <meshStandardMaterial color="#DC2626" metalness={0.2} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.76, 0.08]}>
        <boxGeometry args={[0.3, 0.04, 0.32]} />
        <meshStandardMaterial color="#DC2626" />
      </mesh>

      {/* Floating Interactive HUD Badge */}
      {faultyMachineCode && (
        <Html position={[0, 2.4, 0]} center distanceFactor={18} zIndexRange={[12, 0]}>
          <div
            onClick={(e) => {
              e.stopPropagation();
              onSelectTechnician?.(faultyMachineCode);
            }}
            className="bg-[#FAF9F6]/95 hover:bg-white backdrop-blur-md border-2 border-red-400 hover:border-red-600 rounded-xl px-3 py-1.5 shadow-2xl cursor-pointer pointer-events-auto text-center min-w-[160px] animate-fade-in flex flex-col items-center gap-1 transition-all transform hover:scale-105 active:scale-95 group select-none"
            title="Click to open Field Technician Workstation on the right side"
          >
            <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-red-700 uppercase tracking-tight">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
              <span>{workerName}</span>
            </div>
            <div className="text-[10px] font-extrabold text-[#1E293B]">
              {arrivedDisplay
                ? `🔧 On-Site at ${faultyMachineCode}`
                : `🚶 Dispatched → ${faultyMachineCode}`}
            </div>
            <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100/80 group-hover:bg-red-500 group-hover:text-white rounded-md text-[9px] font-bold text-red-800 transition-colors">
              <span>🛠️ Open Workstation</span>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Camera Controller (Preserves user view angle on machine selection)
// ─────────────────────────────────────────────────────────────────────────────
const CameraController: React.FC<{
  preset?: CameraPresetType;
  resetTrigger: number;
}> = ({ preset = 'OVERVIEW', resetTrigger }) => {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();

  const targetPositions: Record<CameraPresetType, { pos: [number, number, number]; target: [number, number, number] }> = {
    OVERVIEW:    { pos: [0, 56, 104],   target: [0, 2, 0] },
    MACHINING:   { pos: [-34, 26, 5],   target: [-35, 1, -21] },
    ROBOT:       { pos: [0, 26, 5],     target: [0, 1, -21] },
    PROCESSING:  { pos: [33, 26, 5],    target: [32, 1, -21] },
    ASSEMBLY:    { pos: [-34, 26, 37],  target: [-35, 1, 15] },
    PACKAGING:   { pos: [0, 26, 37],    target: [0, 1, 15] },
    MAINTENANCE: { pos: [32, 26, 37],   target: [31, 1, 16] },
  };

  const desiredPos = useRef(new THREE.Vector3(...targetPositions.OVERVIEW.pos));
  const desiredTarget = useRef(new THREE.Vector3(...targetPositions.OVERVIEW.target));
  // Only the CameraController drives the camera while a preset transition is
  // in flight; once it converges, control is handed back fully to OrbitControls
  // so it doesn't fight the user's manual orbit/pan/zoom afterward.
  const transitioning = useRef(false);

  useEffect(() => {
    if (preset && targetPositions[preset]) {
      const { pos, target } = targetPositions[preset];
      desiredPos.current.set(...pos);
      desiredTarget.current.set(...target);
      transitioning.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, resetTrigger]);

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
    // Robot Cell (blue helmets)
    { pos: [-2, 0, -22]  as [number,number,number], rot: -0.3, name: 'Priya Nair',   role: 'Robot Cell Supervisor', activity: 'Axis 3 Calibration', helmet: '#3B82F6' },
    { pos: [7, 0, -22]   as [number,number,number], rot: 0.2,  name: 'Kenji Ito',    role: 'Robotics Operator',     activity: 'ROBOT-02 Program Load', helmet: '#3B82F6' },
    { pos: [2, 0, -13]   as [number,number,number], rot: -0.1, name: 'Lisa Wong',    role: 'Automation Tech',       activity: 'ROBOT-03 End-effector swap', helmet: '#3B82F6' },
    // Processing (green helmets)
    { pos: [24, 0, -22]  as [number,number,number], rot: 0.5,  name: 'Wei Zhang',    role: 'Process Supervisor',    activity: 'MIXER-01 RPM Check', helmet: '#22C55E' },
    { pos: [31, 0, -22]  as [number,number,number], rot: -0.2, name: 'Carlos Gomez', role: 'Fluids Specialist',     activity: 'PUMP-01 Seal Inspection', helmet: '#22C55E' },
    { pos: [38, 0, -20]  as [number,number,number], rot: 0.1,  name: 'Ana Torres',   role: 'Process Operator',      activity: 'PRESS-01 Safety Check', helmet: '#FFFFFF' },
    { pos: [30, 0, -13]  as [number,number,number], rot: 0.3,  name: 'Sam Park',     role: 'Process Technician',    activity: 'PROCESS-02 Monitoring', helmet: '#22C55E' },
    // Assembly (orange helmets)
    { pos: [-39, 0, 15]  as [number,number,number], rot: -0.2, name: 'Carlos G.',    role: 'Assembly Supervisor',   activity: 'ASMB-01 Line Check', helmet: '#F97316' },
    { pos: [-33, 0, 15]  as [number,number,number], rot: 0.1,  name: 'Raj Mehta',    role: 'Assembly Worker',       activity: 'Component Assembly', helmet: '#F97316' },
    { pos: [-38, 0, 22]  as [number,number,number], rot: 0.4,  name: 'Nina Cole',    role: 'Assembly Technician',   activity: 'ASMB-03 Torque Verify', helmet: '#F97316' },
    { pos: [-32, 0, 22]  as [number,number,number], rot: -0.3, name: 'Ben Harris',   role: 'Assembly Operator',     activity: 'Final Sub-assembly', helmet: '#FFFFFF' },
    // Packaging (white helmets)
    { pos: [-3, 0, 15]   as [number,number,number], rot: 0.2,  name: 'Tom Wilson',   role: 'Packaging Supervisor',  activity: 'PACK-01 Line Status', helmet: '#FFFFFF' },
    { pos: [5, 0, 15]    as [number,number,number], rot: -0.1, name: 'Amy Chen',     role: 'Packaging Operator',    activity: 'PACK-02 Box Sealing', helmet: '#FFFFFF' },
    { pos: [1, 0, 22]    as [number,number,number], rot: 0.3,  name: 'Leo Davis',    role: 'Logistics Operator',    activity: 'Pallet Staging', helmet: '#F59E0B' },
    // Maintenance (red helmets)
    { pos: [23, 0, 15]   as [number,number,number], rot: -0.2, name: 'Sarah Jenkins',role: 'Maintenance Supervisor', activity: 'Work Order Review', helmet: '#EF4444' },
    { pos: [30, 0, 15]   as [number,number,number], rot: 0.3,  name: 'Frank Moore',  role: 'Maintenance Tech',      activity: 'BENCH-02 Bearing Swap', helmet: '#EF4444' },
    { pos: [36, 0, 15]   as [number,number,number], rot: -0.4, name: 'Tina Ross',    role: 'Electrical Tech',       activity: 'TEST-01 Diagnostics', helmet: '#EF4444' },
    { pos: [28, 0, 22]   as [number,number,number], rot: 0.1,  name: 'Ed Nguyen',    role: 'Inventory Clerk',       activity: 'Spare Parts Count', helmet: '#94A3B8' },
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

  // Filter out static Frank Moore if he is dynamically dispatched, and hide
  // workers outside the currently-entered building (if any).
  const activeWorkers = useMemo(() => {
    let list = activeFaultyMachine ? workersList.filter((w) => w.name !== 'Frank Moore') : workersList;
    if (activeZoneDef) list = list.filter((w) => isInActiveZone(w.pos));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workersList, activeFaultyMachine, activeZoneId]);

  // Only render the dispatched technician if their target is inside the
  // building the user is currently in (or the user is at Plant Overview).
  const showTechnician = !activeZoneId || (!!activeFaultyMachine && zoneIdForMachineCode(activeFaultyMachine) === activeZoneId);

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

        {/* Section Building Shells — real buildings, visible only at Plant Overview */}
        {layers.buildings && ZONE_DEFS.map((z) => (
          <SectionBuildingShell
            key={z.id}
            cx={z.cx}
            cz={z.cz}
            hw={z.hw}
            hd={z.hd}
            badgeColor={z.badgeColor}
            kind={z.id as ZoneId}
            plantLevel={viewLevel === 'PLANT'}
            doorSide={z.cz < 0 ? 'south' : 'north'}
            onClick={() => onPresetChange?.(z.id as CameraPresetType)}
          />
        ))}

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

        {/* Machines — only the entered building's machines render once inside */}
        {layers.machines && allRenderedMachines.filter((m) => !activeZoneId || zoneIdForMachineCode(m.code) === activeZoneId).map((m) => {
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

              {m.type === 'CNC'         && <CNCMachineMesh color={color} isSelected={isSelected} isFault={isFault} />}
              {m.type === 'ROBOT'       && <RobotArmMesh color={color} isSelected={isSelected} pose={(m as any).pose ?? 0} />}
              {m.type === 'PUMP'        && <PumpMesh color={color} isSelected={isSelected} />}
              {m.type === 'MIXER'       && <MixerMesh color={color} isSelected={isSelected} />}
              {m.type === 'PRESS'       && <PressMesh color={color} />}
              {m.type === 'PROCESSING'  && <ProcessingUnitMesh color={color} isSelected={isSelected} />}
              {m.type === 'ASSEMBLY'    && <AssemblyWorkstationMesh color={color} isSelected={isSelected} />}
              {m.type === 'PACKAGING'   && <PackagingMachineMesh color={color} isSelected={isSelected} />}
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
            workerName="Frank Moore"
            onSelectTechnician={onSelectTechnician}
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
