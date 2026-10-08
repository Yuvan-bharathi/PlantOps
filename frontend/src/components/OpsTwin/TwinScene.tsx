import React, { Suspense, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  CNCMachineMesh, RobotArmMesh, PumpMesh, MixerMesh, PressMesh, ProcessingUnitMesh,
  AssemblyWorkstationMesh, PackagingMachineMesh, MaintenanceBenchMesh,
} from '../DigitalTwin/FactoryCanvas';
import { CellConfig, StationConfig, Vec3 } from './spatialConfig';
import { statusOf } from './status';
import { BayOutline, BRAND, CameraApi, CameraRig, Chip, EntityRef, Pallet, pickable, Pin, sameRef, SceneLights, SelectionBrackets } from './sceneKit';

export type { EntityRef, CameraApi } from './sceneKit';

export interface SceneMachine {
  code: string;
  status: string;
  label: string; // chip text after the code, e.g. "Running · 72°C"
}

export interface SceneTechnician {
  workOrderId: string;
  machineCode: string;
  name: string;
  placement: 'walking-in' | 'at-machine' | 'walking-out';
}

interface Props {
  cell: CellConfig;
  machines: SceneMachine[];
  technicians: SceneTechnician[];
  selected: EntityRef | null;
  onSelect: (e: EntityRef | null) => void;
  cameraRef: React.Ref<CameraApi>;
}

/** The existing Digital Twin's machine models, picked by machine type. */
export const MachineModel: React.FC<{ kind: StationConfig['kind']; color: string; selected: boolean; fault: boolean; code: string }> = ({ kind, color, selected, fault, code }) => {
  switch (kind) {
    case 'CNC': return <CNCMachineMesh color={color} isSelected={selected} isFault={fault} code={code} />;
    case 'ROBOT': return <RobotArmMesh color={color} isSelected={selected} isFault={fault} pose={0} />;
    case 'PUMP': return <PumpMesh color={color} isSelected={selected} isFault={fault} />;
    case 'MIXER': return <MixerMesh color={color} isSelected={selected} isFault={fault} />;
    case 'PRESS': return <PressMesh color={color} isFault={fault} />;
    case 'PROCESSING': return <ProcessingUnitMesh color={color} isSelected={selected} isFault={fault} code={code} />;
    case 'ASSEMBLY': return <AssemblyWorkstationMesh color={color} isSelected={selected} isFault={fault} code={code} />;
    case 'PACKAGING': return <PackagingMachineMesh color={color} isSelected={selected} isFault={fault} code={code} />;
    case 'MAINTENANCE': return <MaintenanceBenchMesh color={color} isSelected={selected} variant={code.startsWith('TEST') ? 'test' : 'bench'} />;
    default: return null;
  }
};

const MachineStation: React.FC<{ station: StationConfig; machine?: SceneMachine; selected: boolean; onSelect: () => void }> = ({ station, machine, selected, onSelect }) => {
  const [hover, setHover] = useState(false);
  const st = statusOf(machine?.status);
  const front = station.rotationY === 0 ? 1 : -1;
  return (
    <group position={station.position}>
      <BayOutline w={6.2} d={6.2} />
      {/* status strip at the bay's front edge */}
      <mesh position={[0, 0.03, front * 3.25]}>
        <boxGeometry args={[3.2, 0.03, 0.22]} />
        <meshBasicMaterial color={st.color} />
      </mesh>
      <group rotation={[0, station.rotationY, 0]} {...pickable(onSelect, setHover)}>
        <Suspense fallback={<mesh position={[0, 1.5, 0]}><boxGeometry args={[3, 3, 3]} /><meshStandardMaterial color="#CBD5E1" /></mesh>}>
          <MachineModel kind={station.kind} color={st.color} selected={selected} fault={machine?.status === 'FAULT'} code={station.code} />
        </Suspense>
      </group>
      {selected && <SelectionBrackets size={[5.2, 5.9, 5.2]} />}
      {/* every machine keeps a compact tag; hover / selection expands it with live status */}
      <Chip position={[0, 6.6, 0]} title={station.code} subtitle={hover || selected ? machine?.label || st.label : undefined} dot={st.color} selected={selected} />
    </group>
  );
};

/** Route ribbon + dotted trail on the floor, ending at a pin. */
const RouteRibbon: React.FC<{ points: Vec3[]; color?: string }> = ({ points, color = BRAND }) => {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], 0.06, p[2])), false, 'catmullrom', 0.05), [points]);
  const dots = useMemo(() => {
    const n = Math.max(6, Math.round(curve.getLength() / 1.1));
    return Array.from({ length: n }, (_, i) => curve.getPointAt(i / (n - 1)));
  }, [curve]);
  const dotRefs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    const head = (clock.elapsedTime * 0.6) % 1;
    dotRefs.current.forEach((m, i) => {
      if (!m) return;
      const f = i / dots.length;
      const d = Math.min(Math.abs(f - head), 1 - Math.abs(f - head));
      m.scale.setScalar(1 + Math.max(0, 0.6 - d * 6));
    });
  });
  return (
    <group>
      <mesh>
        <tubeGeometry args={[curve, 64, 0.11, 6, false]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} />
      </mesh>
      {dots.map((p, i) => (
        <mesh key={i} ref={(m) => (dotRefs.current[i] = m)} position={[p.x, 0.09, p.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.16, 14]} />
          <meshBasicMaterial color={color} />
        </mesh>
      ))}
      <Pin position={points[points.length - 1]} color={color} />
    </group>
  );
};

/** Technician avatar: walks the route in, stands at the machine, or walks out. */
export const TechnicianFigure: React.FC<{ color?: string }> = ({ color = '#F97316' }) => (
  <>
    <mesh position={[0, 0.55, 0]} castShadow>
      <capsuleGeometry args={[0.28, 0.6, 6, 12]} />
      <meshStandardMaterial color={color} roughness={0.6} />
    </mesh>
    <mesh position={[0, 1.25, 0]} castShadow>
      <sphereGeometry args={[0.22, 16, 12]} />
      <meshStandardMaterial color="#F1C9A5" roughness={0.7} />
    </mesh>
    <mesh position={[0, 1.4, 0]} castShadow>
      <sphereGeometry args={[0.26, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshStandardMaterial color="#FACC15" roughness={0.4} />
    </mesh>
  </>
);

const Technician: React.FC<{ route: Vec3[]; tech: SceneTechnician; selected: boolean; onSelect: () => void }> = ({ route, tech, selected, onSelect }) => {
  const ref = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  const curve = useMemo(() => new THREE.CatmullRomCurve3(route.map((p) => new THREE.Vector3(p[0], 0, p[2])), false, 'catmullrom', 0.05), [route]);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    let u: number;
    if (tech.placement === 'at-machine') u = 1;
    else {
      u = Math.min(1, (clock.elapsedTime % 14) / 12); // walk ~12 s, pause 2 s
      if (tech.placement === 'walking-out') u = 1 - u;
    }
    const p = curve.getPointAt(u);
    const ahead = curve.getPointAt(Math.min(1, u + 0.01));
    ref.current.position.set(p.x, 0, p.z);
    if (tech.placement !== 'at-machine' && ahead.distanceTo(p) > 1e-4) {
      const dir = tech.placement === 'walking-out' ? p.clone().sub(ahead) : ahead.clone().sub(p);
      ref.current.rotation.y = Math.atan2(dir.x, dir.z);
    }
    ref.current.position.y = tech.placement === 'at-machine' ? 0 : Math.abs(Math.sin(clock.elapsedTime * 8)) * 0.06;
  });
  return (
    <group ref={ref} {...pickable(onSelect, setHover)}>
      <TechnicianFigure />
      {selected && <SelectionBrackets size={[1.4, 1.9, 1.4]} />}
      {(hover || selected) && (
        <Chip position={[0, 2.4, 0]} title={tech.name} subtitle={tech.placement === 'at-machine' ? 'On site' : tech.placement === 'walking-out' ? 'Returning' : 'En route'} dot="#F97316" selected={selected} />
      )}
    </group>
  );
};

/** AGV patrolling the supply aisle with a pallet. */
const Agv: React.FC<{ loop: Vec3[]; selected: boolean; onSelect: () => void }> = ({ loop, selected, onSelect }) => {
  const ref = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  const curve = useMemo(() => new THREE.CatmullRomCurve3(loop.map((p) => new THREE.Vector3(...p)), true, 'catmullrom', 0.2), [loop]);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const u = ((clock.elapsedTime * 1.6) / curve.getLength()) % 1;
    const p = curve.getPointAt(u);
    const a = curve.getPointAt((u + 0.003) % 1);
    ref.current.position.copy(p);
    ref.current.rotation.y = Math.atan2(a.x - p.x, a.z - p.z);
  });
  return (
    <group ref={ref} {...pickable(onSelect, setHover)}>
      <mesh position={[0, 0.22, 0]} castShadow>
        <boxGeometry args={[1.3, 0.34, 1.9]} />
        <meshStandardMaterial color="#F5B700" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.42, 0]} castShadow>
        <boxGeometry args={[1.25, 0.06, 1.85]} />
        <meshStandardMaterial color={BRAND} roughness={0.4} />
      </mesh>
      <Pallet position={[0, 0.45, 0]} boxes={4} />
      {selected && <SelectionBrackets size={[1.9, 1.6, 2.4]} />}
      {(hover || selected) && <Chip position={[0, 2.4, 0]} title="AGV-01" subtitle="Material supply" dot="#F5B700" selected={selected} />}
    </group>
  );
};

const StagingPallet: React.FC<{ s: CellConfig['staging'][number]; selected: boolean; onSelect: () => void }> = ({ s, selected, onSelect }) => {
  const [hover, setHover] = useState(false);
  const raw = s.kind === 'raw';
  return (
    <group position={s.position} {...pickable(onSelect, setHover)}>
      <BayOutline w={2.2} d={2.2} />
      {raw ? (
        <group>
          <mesh position={[0, 0.1, 0]} castShadow>
            <boxGeometry args={[1.5, 0.18, 1.5]} />
            <meshStandardMaterial color="#B7793F" roughness={0.9} />
          </mesh>
          {[-0.4, 0, 0.4].flatMap((x) =>
            [0.3, 0.62].map((y) => (
              <mesh key={`${x}-${y}`} position={[x, y, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[0.16, 0.16, 1.3, 14]} />
                <meshStandardMaterial color="#9CA3AF" metalness={0.85} roughness={0.25} />
              </mesh>
            ))
          )}
        </group>
      ) : (
        <Pallet boxes={8} />
      )}
      <Pin position={[0, 0, 0]} color={raw ? BRAND : '#16A34A'} height={2.0} />
      {selected && <SelectionBrackets size={[2.4, 1.6, 2.4]} />}
      {(hover || selected) && <Chip position={[0, 3.4, 0]} title={s.id} subtitle={s.label} dot={raw ? BRAND : '#16A34A'} selected={selected} />}
    </group>
  );
};

const CellFloor: React.FC<{ cell: CellConfig; onMiss: () => void }> = ({ cell, onMiss }) => {
  const { width, depth } = cell.floor;
  const dashes = useMemo(() => {
    const out: number[] = [];
    for (let x = -width / 2 + 2; x < width / 2 - 2; x += 1.6) out.push(x);
    return out;
  }, [width]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow onClick={onMiss}>
        <planeGeometry args={[260, 260]} />
        <meshStandardMaterial color="#DFE6F1" roughness={1} />
      </mesh>
      <mesh receiveShadow onClick={onMiss}>
        <boxGeometry args={[width, 0.04, depth]} />
        <meshStandardMaterial color="#F7F9FC" roughness={0.95} />
      </mesh>
      {[
        { p: [0, 0.35, -depth / 2] as Vec3, s: [width, 0.7, 0.25] as Vec3 },
        { p: [0, 0.35, depth / 2] as Vec3, s: [width, 0.7, 0.25] as Vec3 },
        { p: [width / 2, 0.35, 0] as Vec3, s: [0.25, 0.7, depth] as Vec3 },
      ].map((w, i) => (
        <mesh key={i} position={w.p} castShadow receiveShadow>
          <boxGeometry args={w.s} />
          <meshStandardMaterial color="#E2E8F0" roughness={0.9} />
        </mesh>
      ))}
      {[-1.7, 1.7].map((z) => (
        <mesh key={z} position={[0, 0.03, z]}>
          <boxGeometry args={[width - 3, 0.02, 0.1]} />
          <meshBasicMaterial color="#93C5FD" />
        </mesh>
      ))}
      {dashes.map((x) => (
        <mesh key={x} position={[x, 0.03, 0]}>
          <boxGeometry args={[0.8, 0.02, 0.09]} />
          <meshBasicMaterial color="#F5B700" />
        </mesh>
      ))}
    </group>
  );
};

export const TwinScene: React.FC<Props> = ({ cell, machines, technicians, selected, onSelect, cameraRef }) => {
  const byCode = useMemo(() => new Map(machines.map((m) => [m.code, m])), [machines]);

  // Technician route: cell entry → aisle → machine's bay front
  const routeFor = (code: string): Vec3[] | null => {
    const st = cell.stations.find((s) => s.code === code);
    if (!st) return null;
    const frontZ = st.position[2] + (st.rotationY === 0 ? 3.4 : -3.4);
    return [cell.techEntry, [cell.techEntry[0] + 3, 0, 0], [st.position[0], 0, 0], [st.position[0], 0, frontZ * 0.6], [st.position[0], 0, frontZ]];
  };
  const routeTech = selected?.kind === 'machine' ? technicians.find((x) => x.machineCode === selected.id) : selected?.kind === 'technician' ? technicians.find((x) => x.workOrderId === selected.id) : undefined;
  const selectedRoute = routeTech ? routeFor(routeTech.machineCode) : null;

  return (
    <Canvas shadows dpr={[1, 1.75]} camera={{ position: cell.home.position, fov: 32, near: 0.5, far: 600 }} onPointerMissed={() => onSelect(null)}>
      <color attach="background" args={['#E8EEF7']} />
      <SceneLights extent={Math.max(30, cell.floor.width)} />
      <CameraRig ref={cameraRef} home={cell.home} minDistance={8} maxDistance={110} />
      <CellFloor cell={cell} onMiss={() => onSelect(null)} />

      {cell.stations.map((st) => (
        <MachineStation key={st.code} station={st} machine={byCode.get(st.code)} selected={sameRef(selected, { kind: 'machine', id: st.code })} onSelect={() => onSelect({ kind: 'machine', id: st.code })} />
      ))}
      {cell.staging.map((s) => (
        <StagingPallet key={s.id} s={s} selected={sameRef(selected, { kind: 'staging', id: s.id })} onSelect={() => onSelect({ kind: 'staging', id: s.id })} />
      ))}
      <Agv loop={cell.agvLoop} selected={sameRef(selected, { kind: 'agv', id: 'AGV-01' })} onSelect={() => onSelect({ kind: 'agv', id: 'AGV-01' })} />
      {technicians.map((t) => {
        const route = routeFor(t.machineCode);
        return route ? (
          <Technician key={t.workOrderId} route={route} tech={t} selected={sameRef(selected, { kind: 'technician', id: t.workOrderId })} onSelect={() => onSelect({ kind: 'technician', id: t.workOrderId })} />
        ) : null;
      })}
      {selectedRoute && <RouteRibbon points={selectedRoute} />}
    </Canvas>
  );
};

export default TwinScene;
