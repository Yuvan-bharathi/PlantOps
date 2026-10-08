import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { boxGeo, ForkliftModel, geo, PalletModel, std, TruckModel } from './models';
import { EquipKind, EquipStatus, KIND } from './equipment';
import { TechnicianFigure } from '../TwinScene';
import { PLANTOPS } from './sim';

const STATUS_LIGHT: Record<EquipStatus, string> = { RUNNING: '#22C55E', IDLE: '#94A3B8', WARNING: '#F59E0B', FAULT: '#EF4444', MAINTENANCE: '#3B82F6' };
const cyl = (r: number, h: number, seg = 16) => geo(`cyl-${r}-${h}-${seg}`, () => new THREE.CylinderGeometry(r, r, h, seg));

const Leg: React.FC<{ x: number; z: number; h: number }> = ({ x, z, h }) => <mesh geometry={boxGeo(0.08, h, 0.08)} material={std('#475569', 0.6, 0.3)} position={[x, h / 2, z]} />;

/** Status beacon on a short pole. */
const Beacon: React.FC<{ status: EquipStatus; position: [number, number, number] }> = ({ status, position }) => {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const m = ref.current.material as THREE.MeshStandardMaterial;
    m.emissiveIntensity = status === 'FAULT' ? 0.6 + Math.abs(Math.sin(clock.elapsedTime * 5)) * 1.2 : 0.7;
  });
  const color = STATUS_LIGHT[status];
  return (
    <group position={position}>
      <mesh geometry={cyl(0.04, 0.6)} material={std('#334155')} position={[0, 0.3, 0]} />
      <mesh ref={ref} geometry={cyl(0.13, 0.28)} position={[0, 0.72, 0]}>
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} />
      </mesh>
    </group>
  );
};

const Carton: React.FC<{ p: [number, number, number]; c?: string; s?: number }> = ({ p, c = '#D9A066', s = 0.45 }) => <mesh geometry={boxGeo(s, s * 0.8, s)} material={std(c, 0.85)} position={p} castShadow />;

const Conveyor: React.FC<{ w: number; running: boolean }> = ({ w, running }) => {
  const items = useRef<(THREE.Mesh | null)[]>([]);
  const n = Math.max(3, Math.floor(w / 1.8));
  useFrame(({ clock }) => {
    items.current.forEach((m, i) => {
      if (!m) return;
      const t = running ? clock.elapsedTime * 0.6 : 0;
      m.position.x = ((((i / n + t / w) % 1) + 1) % 1) * (w - 0.6) - (w - 0.6) / 2;
    });
  });
  return (
    <group>
      {[-w / 2 + 0.3, 0, w / 2 - 0.3].flatMap((x) => [-0.45, 0.45].map((z) => <Leg key={`${x}${z}`} x={x} z={z} h={0.8} />))}
      <mesh geometry={boxGeo(w, 0.14, 1.1)} material={std('#64748B', 0.5, 0.4)} position={[0, 0.85, 0]} castShadow />
      <mesh geometry={boxGeo(w, 0.02, 0.9)} material={std('#1F2937', 0.8)} position={[0, 0.93, 0]} />
      {[-0.58, 0.58].map((z) => (
        <mesh key={z} geometry={boxGeo(w, 0.12, 0.06)} material={std('#F59E0B', 0.5)} position={[0, 1.0, z]} />
      ))}
      {Array.from({ length: n }, (_, i) => (
        <mesh key={i} ref={(m) => (items.current[i] = m)} geometry={boxGeo(0.6, 0.45, 0.6)} material={std(i % 3 ? '#D9A066' : '#93C5FD', 0.85)} position={[0, 1.18, 0]} castShadow />
      ))}
    </group>
  );
};

const Sorter: React.FC<{ running: boolean }> = ({ running }) => {
  const trays = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (trays.current && running) trays.current.position.x = ((trays.current.position.x + dt * 1.2 + 4) % 8) - 4;
  });
  return (
    <group>
      <mesh geometry={boxGeo(9, 1, 1.6)} material={std('#334155', 0.5, 0.3)} position={[0, 0.5, 0]} castShadow />
      <group ref={trays}>
        {[-3, -1, 1, 3].map((x) => (
          <mesh key={x} geometry={boxGeo(0.9, 0.08, 1.2)} material={std('#F97316', 0.5)} position={[x, 1.05, 0]} />
        ))}
      </group>
      {Array.from({ length: 6 }, (_, i) => (
        <group key={i} position={[-3.75 + i * 1.5, 0, 1.45]}>
          <mesh geometry={boxGeo(1.2, 0.9, 1.2)} material={std('#CBD5E1', 0.6)} position={[0, 0.45, 0]} rotation={[0.25, 0, 0]} />
          <mesh geometry={boxGeo(1.1, 0.08, 0.4)} material={std(['#2563EB', '#16A34A', '#F59E0B'][i % 3])} position={[0, 0.95, -0.5]} />
        </group>
      ))}
    </group>
  );
};

const Bench: React.FC<{ w: number; top?: string; staffed?: boolean; screen?: boolean }> = ({ w, top = '#E2E8F0', staffed, screen }) => (
  <group>
    {[-w / 2 + 0.2, w / 2 - 0.2].flatMap((x) => [-0.45, 0.45].map((z) => <Leg key={`${x}${z}`} x={x} z={z} h={0.9} />))}
    <mesh geometry={boxGeo(w, 0.08, 1.1)} material={std(top, 0.6)} position={[0, 0.94, 0]} castShadow />
    <mesh geometry={boxGeo(w, 0.06, 0.5)} material={std('#475569')} position={[0, 1.6, -0.45]} />
    {screen && <mesh geometry={boxGeo(0.7, 0.45, 0.06)} material={std('#0F172A', 0.3)} position={[w / 2 - 0.6, 1.35, -0.4]} />}
    {staffed && (
      <group position={[0, 0, 1.05]} rotation={[0, Math.PI, 0]}>
        <TechnicianFigure color="#2563EB" />
      </group>
    )}
  </group>
);

const Wrapper: React.FC<{ running: boolean }> = ({ running }) => {
  const table = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (table.current && running) table.current.rotation.y += dt * 1.6;
  });
  return (
    <group>
      <mesh geometry={cyl(1.5, 0.18, 32)} material={std('#475569', 0.5, 0.3)} position={[0, 0.09, 0]} />
      <group ref={table}>
        <PalletModel position={[0, 0.18, 0]} />
        <mesh geometry={cyl(0.92, 1.1, 24)} position={[0, 0.85, 0]}>
          <meshStandardMaterial color="#E0F2FE" transparent opacity={0.45} roughness={0.2} />
        </mesh>
      </group>
      <mesh geometry={boxGeo(0.35, 2.6, 0.35)} material={std('#2563EB', 0.5)} position={[1.55, 1.3, 0]} castShadow />
      <mesh geometry={boxGeo(0.5, 0.4, 0.5)} material={std('#1E293B')} position={[1.55, 1.2, 0]} />
    </group>
  );
};

const Scale: React.FC = () => (
  <group>
    <mesh geometry={boxGeo(2.2, 0.12, 2.2)} material={std('#94A3B8', 0.4, 0.5)} position={[0, 0.06, 0]} />
    <mesh geometry={boxGeo(1.9, 0.02, 1.9)} material={std('#F5B700')} position={[0, 0.13, 0]} />
    <PalletModel position={[0, 0.14, 0]} />
    <mesh geometry={boxGeo(0.1, 1.3, 0.1)} material={std('#334155')} position={[1.25, 0.65, -0.9]} />
    <mesh geometry={boxGeo(0.6, 0.4, 0.12)} material={std('#0F172A', 0.3)} position={[1.25, 1.4, -0.9]} />
  </group>
);

const Labeler: React.FC = () => (
  <group>
    <mesh geometry={boxGeo(0.7, 1.3, 0.7)} material={std('#E2E8F0', 0.5)} position={[0, 0.65, 0]} castShadow />
    <mesh geometry={boxGeo(0.6, 0.5, 0.6)} material={std('#2563EB', 0.4)} position={[0, 1.55, 0]} />
    <mesh geometry={boxGeo(0.9, 0.1, 0.12)} material={std('#475569')} position={[0.6, 1.4, 0]} />
  </group>
);

const StagingLane: React.FC<{ filled: number; blue?: boolean }> = ({ filled, blue }) => (
  <group>
    <mesh geometry={boxGeo(2.2, 0.02, 8.8)} material={std(blue ? '#DBEAFE' : '#FEF3C7', 1)} position={[0, 0.03, 0]} />
    {Array.from({ length: filled }, (_, i) => (
      <PalletModel key={i} position={[0, 0.04, 3.6 - i * 1.6]} variant={blue ? 'blue' : 'box'} />
    ))}
  </group>
);

const BlockStack: React.FC<{ filled: number }> = ({ filled }) => (
  <group>
    <mesh geometry={boxGeo(2.5, 0.02, 9.8)} material={std('#FEF3C7', 1)} position={[0, 0.03, 0]} />
    {Array.from({ length: filled }, (_, i) => {
      const slot = Math.floor(i / 2);
      const tier = i % 2;
      return <PalletModel key={i} position={[0, 0.04 + tier * 1.3, 4 - slot * 1.6]} variant={slot % 2 ? 'blue' : 'box'} />;
    })}
  </group>
);

const DrumRack: React.FC<{ filled: number }> = ({ filled }) => (
  <group>
    {[-2.1, 0, 2.1].flatMap((x) => [-0.8, 0.8].map((z) => <Leg key={`${x}${z}`} x={x} z={z} h={2.5} />))}
    {[0.05, 1.25].map((y) => (
      <mesh key={y} geometry={boxGeo(4.3, 0.08, 1.7)} material={std('#F97316', 0.5)} position={[0, y + 0.04, 0]} />
    ))}
    {Array.from({ length: Math.min(12, filled) }, (_, i) => (
      <mesh key={i} geometry={cyl(0.3, 0.9)} material={std(i % 3 === 0 ? '#DC2626' : '#1D4ED8', 0.4, 0.4)} position={[-1.8 + (i % 6) * 0.72, (Math.floor(i / 6) ? 1.29 : 0.09) + 0.45, 0]} castShadow />
    ))}
  </group>
);

const IbcStore: React.FC<{ filled: number }> = ({ filled }) => (
  <group>
    {Array.from({ length: Math.min(3, filled) }, (_, i) => (
      <group key={i} position={[-1.25 + i * 1.25, 0, 0]}>
        <mesh geometry={boxGeo(1.05, 0.15, 1.05)} material={std('#475569')} position={[0, 0.08, 0]} />
        <mesh geometry={boxGeo(1, 1, 1)} material={std('#F8FAFC', 0.3)} position={[0, 0.66, 0]} castShadow />
        <mesh geometry={boxGeo(1.06, 1.06, 1.06)} position={[0, 0.66, 0]}>
          <meshStandardMaterial color="#64748B" wireframe />
        </mesh>
      </group>
    ))}
  </group>
);

const Dispenser: React.FC = () => (
  <group>
    <mesh geometry={boxGeo(2.6, 0.12, 2)} material={std('#F5B700', 0.6)} position={[0, 0.06, 0]} />
    <mesh geometry={cyl(0.3, 0.9)} material={std('#1D4ED8', 0.4, 0.4)} position={[-0.6, 0.57, 0]} rotation={[0, 0, Math.PI / 2]} />
    <mesh geometry={boxGeo(0.5, 1.4, 0.5)} material={std('#E2E8F0', 0.5)} position={[0.7, 0.7, -0.4]} />
    <mesh geometry={cyl(0.18, 0.4)} material={std('#94A3B8')} position={[0.7, 0.3, 0.4]} />
  </group>
);

const CartonFlow: React.FC<{ filled: number }> = ({ filled }) => (
  <group>
    {[-2.1, 2.1].flatMap((x) => [-0.8, 0.8].map((z) => <Leg key={`${x}${z}`} x={x} z={z} h={2.2} />))}
    {[0.5, 1.2, 1.9].map((y, r) => (
      <group key={y} position={[0, y, 0]} rotation={[0.18, 0, 0]}>
        <mesh geometry={boxGeo(4.2, 0.05, 1.6)} material={std('#94A3B8', 0.5, 0.3)} />
        {Array.from({ length: 6 }, (_, i) => (i + r * 6 < filled ? <mesh key={i} geometry={boxGeo(0.6, 0.35, 0.5)} material={std(['#2563EB', '#16A34A', '#F59E0B', '#DC2626'][(i + r) % 4], 0.6)} position={[-1.75 + i * 0.7, 0.2, 0.2]} /> : null))}
      </group>
    ))}
  </group>
);

const Tugger: React.FC<{ running: boolean }> = ({ running }) => {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.x = running ? Math.sin(clock.elapsedTime * 0.25) * 0.6 : 0;
  });
  return (
    <group ref={ref}>
      <mesh geometry={boxGeo(1.4, 1.1, 1.2)} material={std('#F59E0B', 0.5)} position={[2.7, 0.75, 0]} castShadow />
      <mesh geometry={boxGeo(0.9, 0.8, 1.1)} material={std('#1E293B', 0.4)} position={[2.6, 1.6, 0]} />
      {[-2.3, -0.4, 1.4].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh geometry={boxGeo(1.6, 0.12, 1.1)} material={std('#475569')} position={[0, 0.4, 0]} />
          <Carton p={[-0.35, 0.68, 0]} />
          <Carton p={[0.35, 0.68, 0]} c="#93C5FD" />
        </group>
      ))}
    </group>
  );
};

const VehicleLift: React.FC<{ idx: number; status: EquipStatus }> = ({ idx, status }) => {
  const raised = status === 'RUNNING' ? 1.6 : status === 'MAINTENANCE' || status === 'FAULT' ? 0.2 : 0.9;
  return (
    <group>
      <mesh geometry={boxGeo(5, 0.02, 9.3)} material={std('#E0E7FF', 1)} position={[0, 0.03, 0]} />
      {[-2.1, 2.1].map((x) => (
        <group key={x}>
          <mesh geometry={boxGeo(0.4, 3.6, 0.5)} material={std('#2563EB', 0.4)} position={[x, 1.8, 0]} castShadow />
          <mesh geometry={boxGeo(0.4, 0.1, 6.6)} material={std('#F59E0B', 0.5)} position={[x * 0.7, raised, 0]} />
        </group>
      ))}
      <group position={[0, raised + 0.05, 0]}>{idx % 2 ? <ForkliftModel carrying={false} /> : <group scale={0.8}><TruckModel carrier={PLANTOPS} /></group>}</group>
    </group>
  );
};

const ChargerBank: React.FC<{ status: EquipStatus }> = ({ status }) => (
  <group>
    <mesh geometry={boxGeo(6, 0.1, 1.5)} material={std('#334155')} position={[0, 0.05, 0]} />
    {Array.from({ length: 6 }, (_, i) => (
      <group key={i} position={[-2.5 + i, 0, 0]}>
        <mesh geometry={boxGeo(0.7, 1.4, 0.6)} material={std('#F8FAFC', 0.4)} position={[0, 0.8, -0.35]} castShadow />
        <mesh geometry={boxGeo(0.7, 0.6, 0.5)} material={std('#1E293B', 0.6)} position={[0, 0.4, 0.35]} />
        <mesh geometry={boxGeo(0.15, 0.15, 0.04)} material={std(status === 'FAULT' && i === 2 ? '#EF4444' : i % 3 ? '#22C55E' : '#F59E0B')} position={[0, 1.2, -0.04]} />
      </group>
    ))}
  </group>
);

const TyreChanger: React.FC = () => (
  <group>
    <mesh geometry={boxGeo(1.2, 0.9, 1.2)} material={std('#DC2626', 0.5)} position={[0, 0.45, 0]} castShadow />
    <mesh geometry={cyl(0.55, 0.3, 24)} material={std('#111827', 0.8)} position={[0, 1.05, 0]} />
    <mesh geometry={boxGeo(0.15, 1.2, 0.15)} material={std('#334155')} position={[0.5, 1.4, -0.5]} />
  </group>
);

const Compressor: React.FC = () => (
  <group>
    <mesh geometry={cyl(0.55, 2, 24)} material={std('#2563EB', 0.4, 0.3)} position={[0, 0.7, 0]} rotation={[0, 0, Math.PI / 2]} castShadow />
    <mesh geometry={boxGeo(0.9, 0.7, 0.8)} material={std('#334155')} position={[0.2, 1.5, 0]} />
  </group>
);

const ToolCabinet: React.FC = () => (
  <group>
    <mesh geometry={boxGeo(2.4, 1.8, 1)} material={std('#DC2626', 0.4, 0.2)} position={[0, 0.9, 0]} castShadow />
    {[0.5, 0.9, 1.3].map((y) => (
      <mesh key={y} geometry={boxGeo(2.2, 0.04, 0.02)} material={std('#7F1D1D')} position={[0, y, 0.51]} />
    ))}
  </group>
);

const Shelving: React.FC<{ filled: number }> = ({ filled }) => (
  <group>
    {[-2.5, 0, 2.5].flatMap((x) => [-0.55, 0.55].map((z) => <Leg key={`${x}${z}`} x={x} z={z} h={2.6} />))}
    {[0.3, 0.9, 1.5, 2.1].map((y, r) => (
      <group key={y} position={[0, y, 0]}>
        <mesh geometry={boxGeo(5.1, 0.04, 1.15)} material={std('#94A3B8', 0.5, 0.3)} />
        {Array.from({ length: 8 }, (_, i) => ((i * 7 + r * 3) % 100 < filled ? <mesh key={i} geometry={boxGeo(0.5, 0.35, 0.8)} material={std(['#2563EB', '#F59E0B', '#16A34A'][(i + r) % 3], 0.6)} position={[-2.2 + i * 0.63, 0.2, 0]} /> : null))}
      </group>
    ))}
  </group>
);

const Counter: React.FC = () => (
  <group>
    <mesh geometry={boxGeo(4.4, 1.1, 1.2)} material={std('#E2E8F0', 0.5)} position={[0, 0.55, 0]} castShadow />
    <mesh geometry={boxGeo(4.5, 0.06, 1.3)} material={std('#2563EB', 0.4)} position={[0, 1.13, 0]} />
    <mesh geometry={boxGeo(0.6, 0.4, 0.06)} material={std('#0F172A', 0.3)} position={[1.2, 1.4, -0.3]} />
    <group position={[-1, 0, -1.2]}>
      <TechnicianFigure color="#16A34A" />
    </group>
  </group>
);

/** One piece of warehouse equipment, by kind. */
export const EquipmentModel: React.FC<{ kind: EquipKind; status: EquipStatus; fill: number; index: number }> = ({ kind, status, fill, index }) => {
  const running = status === 'RUNNING';
  const spec = KIND[kind];
  const body = useMemo(() => {
    switch (kind) {
      case 'conveyor':
        return <Conveyor w={spec.w} running={running} />;
      case 'sorter':
        return <Sorter running={running} />;
      case 'pickStation':
        return (
          <group>
            <Bench w={2.8} top="#DBEAFE" staffed={running || status === 'IDLE'} screen />
            <Carton p={[-0.7, 1.2, 0]} />
            <Carton p={[0.1, 1.2, 0]} c="#93C5FD" />
            <mesh geometry={boxGeo(0.08, 2, 0.08)} material={std('#334155')} position={[-1.3, 1, -0.5]} />
          </group>
        );
      case 'packBench':
        return (
          <group>
            <Bench w={2.8} top="#FEF3C7" staffed={running || status === 'IDLE'} screen />
            <Carton p={[-0.6, 1.2, 0]} s={0.6} />
            <mesh geometry={cyl(0.12, 0.6)} material={std('#E2E8F0')} position={[0.5, 1.28, 0]} rotation={[0, 0, Math.PI / 2]} />
          </group>
        );
      case 'qcTable':
        return (
          <group>
            <Bench w={2.8} top="#DCFCE7" staffed={running || status === 'IDLE'} screen />
            <Carton p={[-0.5, 1.2, 0.1]} s={0.6} />
          </group>
        );
      case 'kitBench':
        return (
          <group>
            <Bench w={3} top="#E0E7FF" staffed={running || status === 'IDLE'} />
            {[-1, -0.35, 0.3, 0.95].map((x, i) => (
              <mesh key={x} geometry={boxGeo(0.5, 0.3, 0.4)} material={std(['#2563EB', '#16A34A', '#F59E0B', '#DC2626'][i])} position={[x, 1.78, -0.45]} />
            ))}
          </group>
        );
      case 'workbench':
        return <Bench w={3} top="#A16207" staffed />;
      case 'wrapper':
        return <Wrapper running={running} />;
      case 'scale':
        return <Scale />;
      case 'labeler':
        return <Labeler />;
      case 'stagingLane':
        return <StagingLane filled={Math.round(fill * 5)} blue={index % 2 === 1} />;
      case 'blockStack':
        return <BlockStack filled={Math.round(fill * 12)} />;
      case 'drumRack':
        return <DrumRack filled={Math.round(fill * 12)} />;
      case 'ibc':
        return <IbcStore filled={Math.max(1, Math.round(fill * 3))} />;
      case 'dispenser':
        return <Dispenser />;
      case 'cartonFlow':
        return <CartonFlow filled={Math.round(fill * 18)} />;
      case 'tugger':
        return <Tugger running={running} />;
      case 'vehicleLift':
        return <VehicleLift idx={index} status={status} />;
      case 'chargerBank':
        return <ChargerBank status={status} />;
      case 'tyreChanger':
        return <TyreChanger />;
      case 'compressor':
        return <Compressor />;
      case 'toolCabinet':
        return <ToolCabinet />;
      case 'shelving':
        return <Shelving filled={Math.round(fill * 100)} />;
      case 'counter':
        return <Counter />;
      default:
        return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, running, status, Math.round(fill * 10), index]);
  return (
    <group>
      {body}
      {spec.powered && <Beacon status={status} position={[spec.w / 2 - 0.2, kind === 'vehicleLift' ? 3.6 : 1.5, -spec.d / 2 + 0.2]} />}
    </group>
  );
};

export { STATUS_LIGHT };
