import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { Asset } from './GLBAsset';

const CAR_KIT = '/models/kenney-car-kit';
const FACTORY_KIT = '/models/kenney-factory-kit';

interface GoodsAreaLogisticsProps {
  position?: [number, number, number];
  visible?: boolean;
}

export type TruckTheme = 'blue' | 'green' | 'yellow';

// ─────────────────────────────────────────────────────────────────────────────
// 1. CARGO 1: ISO Shipping Container (Blue Truck)
// ─────────────────────────────────────────────────────────────────────────────
const BlueIsoContainer: React.FC<{ position?: [number, number, number]; opacity?: number }> = ({
  position = [0, 0, 0],
  opacity = 1.0,
}) => {
  if (opacity <= 0.01) return null;

  return (
    <group position={position}>
      {/* Container Main Box */}
      <mesh position={[0, 1.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.5, 2.4, 6.0]} />
        <meshStandardMaterial
          color="#1E40AF"
          metalness={0.65}
          roughness={0.35}
          transparent={opacity < 1}
          opacity={opacity}
        />
      </mesh>

      {/* Corrugated Ribs */}
      {[-2.5, -2.0, -1.5, -1.0, -0.5, 0, 0.5, 1.0, 1.5, 2.0, 2.5].map((rz, ri) => (
        <React.Fragment key={ri}>
          <mesh position={[-1.28, 1.4, rz]} castShadow>
            <boxGeometry args={[0.08, 2.3, 0.22]} />
            <meshStandardMaterial color="#1E40AF" metalness={0.75} roughness={0.3} transparent={opacity < 1} opacity={opacity} />
          </mesh>
          <mesh position={[1.28, 1.4, rz]} castShadow>
            <boxGeometry args={[0.08, 2.3, 0.22]} />
            <meshStandardMaterial color="#1E40AF" metalness={0.75} roughness={0.3} transparent={opacity < 1} opacity={opacity} />
          </mesh>
        </React.Fragment>
      ))}

      {/* Corner Castings */}
      {[
        [-1.26, 0.24, -3.01], [1.26, 0.24, -3.01],
        [-1.26, 0.24, 3.01],  [1.26, 0.24, 3.01],
        [-1.26, 2.56, -3.01], [1.26, 2.56, -3.01],
        [-1.26, 2.56, 3.01],  [1.26, 2.56, 3.01],
      ].map(([cx, cy, cz], ci) => (
        <mesh key={ci} position={[cx, cy, cz]}>
          <boxGeometry args={[0.18, 0.2, 0.18]} />
          <meshStandardMaterial color="#0F172A" metalness={0.9} roughness={0.2} />
        </mesh>
      ))}

      {/* Rear Locking Bars */}
      <group position={[0, 1.4, -3.02]}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.04, 2.3, 0.04]} />
          <meshStandardMaterial color="#0F172A" />
        </mesh>
        {[-0.55, -0.2, 0.2, 0.55].map((bx, bi) => (
          <group key={bi} position={[bx, 0, 0.03]}>
            <mesh>
              <cylinderGeometry args={[0.025, 0.025, 2.2, 8]} />
              <meshStandardMaterial color="#E2E8F0" metalness={0.95} roughness={0.1} />
            </mesh>
            <mesh position={[0, -0.2, 0.05]} rotation={[0, 0, Math.PI / 2]}>
              <boxGeometry args={[0.03, 0.22, 0.03]} />
              <meshStandardMaterial color="#EAB308" />
            </mesh>
          </group>
        ))}
      </group>

      {/* Tie-Down Straps */}
      {[-1.8, 1.8].map((sz, si) => (
        <group key={si} position={[0, 1.42, sz]}>
          <mesh position={[0, 1.22, 0]}>
            <boxGeometry args={[2.56, 0.04, 0.12]} />
            <meshStandardMaterial color="#FACC15" roughness={0.6} />
          </mesh>
          {[-1.27, 1.27].map((sx, sxi) => (
            <mesh key={sxi} position={[sx, 0, 0]}>
              <boxGeometry args={[0.04, 2.44, 0.12]} />
              <meshStandardMaterial color="#FACC15" roughness={0.6} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. CARGO 2: Refrigerated Reefer Container Body (Green Truck)
// ─────────────────────────────────────────────────────────────────────────────
const GreenReeferCargo: React.FC<{ position?: [number, number, number]; opacity?: number }> = ({
  position = [0, 0, 0],
  opacity = 1.0,
}) => {
  if (opacity <= 0.01) return null;

  return (
    <group position={position}>
      <mesh position={[0, 1.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.55, 2.35, 6.2]} />
        <meshStandardMaterial
          color="#F8FAFC"
          metalness={0.3}
          roughness={0.2}
          transparent={opacity < 1}
          opacity={opacity}
        />
      </mesh>

      {[-1.29, 1.29].map((sx, si) => (
        <mesh key={si} position={[sx, 0.25, 0]}>
          <boxGeometry args={[0.04, 0.45, 5.8]} />
          <meshStandardMaterial color="#047857" metalness={0.7} />
        </mesh>
      ))}

      {/* Front Refrigeration Compressor Unit */}
      <group position={[0, 1.6, 3.2]}>
        <mesh castShadow>
          <boxGeometry args={[1.5, 1.1, 0.4]} />
          <meshStandardMaterial color="#1E293B" metalness={0.8} />
        </mesh>
        <mesh position={[0, 0, 0.21]}>
          <planeGeometry args={[1.2, 0.7]} />
          <meshBasicMaterial color="#0F172A" />
        </mesh>
        <mesh position={[0.55, 0.35, 0.22]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshBasicMaterial color="#10B981" />
        </mesh>
      </group>

      {/* Rear Stainless Steel Swing Doors */}
      <group position={[0, 1.4, -3.12]}>
        <mesh>
          <boxGeometry args={[2.5, 2.3, 0.04]} />
          <meshStandardMaterial color="#CBD5E1" metalness={0.85} roughness={0.2} />
        </mesh>
        {[-0.6, 0.6].map((bx, bi) => (
          <mesh key={bi} position={[bx, 0, 0.04]}>
            <cylinderGeometry args={[0.02, 0.02, 2.1, 8]} />
            <meshStandardMaterial color="#0F172A" metalness={0.9} />
          </mesh>
        ))}
      </group>
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. CARGO 3: Heavy Industrial Machinery Crates (Yellow Truck)
// ─────────────────────────────────────────────────────────────────────────────
const YellowMachineryCargo: React.FC<{ position?: [number, number, number]; opacity?: number }> = ({
  position = [0, 0, 0],
  opacity = 1.0,
}) => {
  if (opacity <= 0.01) return null;

  return (
    <group position={position}>
      {/* Crate 1 */}
      <group position={[0, 0.95, 1.4]}>
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[2.2, 1.9, 2.2]} />
          <meshStandardMaterial
            color="#B45309"
            roughness={0.85}
            transparent={opacity < 1}
            opacity={opacity}
          />
        </mesh>
        {[-1.11, 1.11].map((bx, bi) => (
          <mesh key={bi} position={[bx, 0, 0]}>
            <boxGeometry args={[0.04, 1.92, 2.22]} />
            <meshStandardMaterial color="#334155" metalness={0.9} />
          </mesh>
        ))}
        <mesh position={[0, 0, 1.12]}>
          <planeGeometry args={[0.4, 0.4]} />
          <meshBasicMaterial color="#FACC15" />
        </mesh>
      </group>

      {/* Crate 2 */}
      <group position={[0, 0.8, -1.4]}>
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[2.2, 1.6, 2.4]} />
          <meshStandardMaterial
            color="#92400E"
            roughness={0.8}
            transparent={opacity < 1}
            opacity={opacity}
          />
        </mesh>
        {[-0.8, 0.8].map((bz, bi) => (
          <mesh key={bi} position={[0, 0, bz]}>
            <boxGeometry args={[2.24, 1.64, 0.08]} />
            <meshStandardMaterial color="#0F172A" metalness={0.9} />
          </mesh>
        ))}
      </group>

      {/* Ratchet Straps */}
      {[-1.4, 0.0, 1.4].map((sz, si) => (
        <group key={si} position={[0, 0, sz]}>
          <mesh position={[0, 1.8, 0]}>
            <boxGeometry args={[2.3, 0.04, 0.1]} />
            <meshStandardMaterial color="#FACC15" roughness={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Universal Articulated Truck Component (Cab + Trailer + Assigned Cargo)
// ─────────────────────────────────────────────────────────────────────────────
interface CompleteTruckProps {
  cabPosition: [number, number, number];
  cabRotationY: number;
  hitchPosition: [number, number, number];
  trailerRotationY: number;
  theme: TruckTheme;
  hasCargo: boolean;
  wheelRotation?: number;
  opacity?: number;
}

const CompleteTruck: React.FC<CompleteTruckProps> = ({
  cabPosition,
  cabRotationY,
  hitchPosition,
  trailerRotationY,
  theme,
  hasCargo,
  wheelRotation = 0,
  opacity = 1.0,
}) => {
  if (opacity <= 0.01) return null;

  const cabColor = theme === 'blue' ? '#1D4ED8' : theme === 'green' ? '#047857' : '#D97706';
  const cabAsset = theme === 'yellow' ? `${CAR_KIT}/truck-flat.glb` : `${CAR_KIT}/truck.glb`;

  return (
    <group>
      {/* ── 1. TRACTOR CAB (The Head) ── */}
      <group position={cabPosition} rotation={[0, cabRotationY, 0]}>
        <Asset
          url={cabAsset}
          position={[0, 0, 0.6]}
          rotation={[0, 0, 0]}
          scale={2.3}
          tint={cabColor}
          tintStrength={0.88}
        />

        {/* Headlights */}
        <group position={[0, 0.8, 2.4]}>
          {[-0.85, 0.85].map((hx, hi) => (
            <group key={hi} position={[hx, 0, 0]}>
              <mesh>
                <sphereGeometry args={[0.12, 8, 8]} />
                <meshBasicMaterial color="#FEF08A" />
              </mesh>
              <pointLight color="#FEF08A" intensity={1.8} distance={14} decay={2} />
            </group>
          ))}
        </group>

        {/* Green Truck Roof Air Deflector */}
        {theme === 'green' && (
          <group position={[0, 2.65, 0.2]}>
            <mesh castShadow>
              <boxGeometry args={[2.1, 0.45, 1.4]} />
              <meshStandardMaterial color="#F8FAFC" metalness={0.4} roughness={0.3} />
            </mesh>
            {[-0.8, -0.3, 0.3, 0.8].map((lx, li) => (
              <mesh key={li} position={[lx, 0.24, 0.65]}>
                <boxGeometry args={[0.08, 0.04, 0.04]} />
                <meshBasicMaterial color="#F59E0B" />
              </mesh>
            ))}
          </group>
        )}

        {/* Yellow Truck Bull-Bar & Roof Beacon */}
        {theme === 'yellow' && (
          <>
            <group position={[0, 0.75, 2.5]}>
              <mesh castShadow>
                <boxGeometry args={[2.4, 0.45, 0.15]} />
                <meshStandardMaterial color="#1E293B" metalness={0.9} roughness={0.2} />
              </mesh>
            </group>
            <group position={[0, 2.45, 0.2]}>
              <mesh>
                <cylinderGeometry args={[0.16, 0.16, 0.2, 12]} />
                <meshStandardMaterial color="#F59E0B" emissive="#D97706" emissiveIntensity={0.8} />
              </mesh>
              <pointLight color="#F59E0B" intensity={1.2} distance={8} decay={2} />
            </group>
          </>
        )}

        {/* Fifth-Wheel Hitch Plate on Cab Rear */}
        <group position={[0, 0.72, -1.6]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.55, 0.55, 0.12, 16]} />
            <meshStandardMaterial color="#0F172A" metalness={0.9} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.12, 0.12, 0.18, 12]} />
            <meshStandardMaterial color="#94A3B8" metalness={0.95} />
          </mesh>
        </group>

        {/* Front Steerable Wheels */}
        <group position={[0, 0.45, 1.4]}>
          {[-1.15, 1.15].map((wx, wi) => (
            <mesh key={wi} position={[wx, 0, 0]} rotation={[wheelRotation, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.45, 0.45, 0.28, 16]} />
              <meshStandardMaterial color="#0F172A" roughness={0.9} />
            </mesh>
          ))}
        </group>
      </group>

      {/* ── 2. ARTICULATED SEMI-TRAILER & CARGO ── */}
      <group position={hitchPosition} rotation={[0, trailerRotationY, 0]}>
        {/* Gooseneck Coupler */}
        <mesh position={[0, 0.72, -0.4]} castShadow>
          <boxGeometry args={[1.4, 0.22, 1.2]} />
          <meshStandardMaterial color="#1E293B" metalness={0.8} roughness={0.3} />
        </mesh>

        {/* Trailer Bed Chassis */}
        <mesh position={[0, 0.65, -3.6]} castShadow receiveShadow>
          <boxGeometry args={[2.7, 0.32, 7.2]} />
          <meshStandardMaterial color="#0F172A" metalness={0.85} roughness={0.25} />
        </mesh>

        {/* Conspicuity Hazard Tape */}
        {[-1.36, 1.36].map((sx, si) => (
          <mesh key={si} position={[sx, 0.65, -3.6]}>
            <boxGeometry args={[0.02, 0.18, 7.1]} />
            <meshBasicMaterial color="#EAB308" />
          </mesh>
        ))}

        {/* Dual Tandem Wheels */}
        {[-6.2, -5.0].map((wz, wi) => (
          <group key={wi} position={[0, 0.45, wz]}>
            {[-1.38, -1.15, 1.15, 1.38].map((wx, wxi) => (
              <mesh
                key={wxi}
                position={[wx, 0, 0]}
                rotation={[wheelRotation, 0, Math.PI / 2]}
              >
                <cylinderGeometry args={[0.45, 0.45, 0.22, 16]} />
                <meshStandardMaterial color="#020617" roughness={0.9} />
              </mesh>
            ))}
          </group>
        ))}

        {/* Rear Bumper & Brake Lights */}
        <group position={[0, 0.55, -7.22]}>
          <mesh castShadow>
            <boxGeometry args={[2.6, 0.22, 0.12]} />
            <meshStandardMaterial color="#334155" metalness={0.8} />
          </mesh>
          {[-1.1, -0.8, 0.8, 1.1].map((rx, ri) => (
            <mesh key={ri} position={[rx, 0, -0.07]}>
              <boxGeometry args={[0.2, 0.12, 0.04]} />
              <meshBasicMaterial color="#EF4444" />
            </mesh>
          ))}
          {[-1.15, 1.15].map((fx, fi) => (
            <mesh key={fi} position={[fx, -0.22, 0.02]}>
              <boxGeometry args={[0.48, 0.42, 0.04]} />
              <meshStandardMaterial color="#020617" roughness={0.95} />
            </mesh>
          ))}
        </group>

        {/* DEDICATED ASSIGNED CARGO ON TRAILER BED */}
        {hasCargo && (
          <>
            {theme === 'blue' && (
              <BlueIsoContainer position={[0, 0.66, -3.6]} opacity={opacity} />
            )}
            {theme === 'green' && (
              <GreenReeferCargo position={[0, 0.66, -3.6]} opacity={opacity} />
            )}
            {theme === 'yellow' && (
              <YellowMachineryCargo position={[0, 0.66, -3.6]} opacity={opacity} />
            )}
          </>
        )}
      </group>
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Road Kinematics Path Evaluator (Bay -> South East -> South Perimeter -> Main Gate -> Exit)
// ─────────────────────────────────────────────────────────────────────────────
const L1_LEN = 14.5;
const C1_RADIUS = 3.0;
const C1_LEN = (Math.PI / 2) * C1_RADIUS; // 4.7124
const L2_LEN = 44.0;
const C2_RADIUS = 3.0;
const C2_LEN = (Math.PI / 2) * C2_RADIUS; // 4.7124
const L3_LEN = 37.5;
const TOTAL_PATH_LEN = L1_LEN + C1_LEN + L2_LEN + C2_LEN + L3_LEN; // 105.4248

function getPathPoint(s: number): { x: number; z: number; heading: number } {
  const clampedS = Math.max(0, Math.min(TOTAL_PATH_LEN, s));

  // Segment 1: South down East Highway (Heading 0 = +Z)
  if (clampedS <= L1_LEN) {
    return {
      x: 2.0,
      z: clampedS,
      heading: 0,
    };
  }

  // Corner 1: Right turn from South (0) to West (-PI/2)
  const sAfterL1 = clampedS - L1_LEN;
  if (sAfterL1 <= C1_LEN) {
    const theta = (sAfterL1 / C1_LEN) * (Math.PI / 2);
    const cx = -1.0;
    const cz = 14.5;
    const x = cx + C1_RADIUS * Math.cos(theta);
    const z = cz + C1_RADIUS * Math.sin(theta);
    const heading = -theta;
    return { x, z, heading };
  }

  // Segment 2: West along South Perimeter Road (Heading -PI/2 = -X)
  const sAfterC1 = sAfterL1 - C1_LEN;
  if (sAfterC1 <= L2_LEN) {
    return {
      x: -1.0 - sAfterC1,
      z: 17.5,
      heading: -Math.PI / 2,
    };
  }

  // Corner 2: Left turn from West (-PI/2) to South (0)
  const sAfterL2 = sAfterC1 - L2_LEN;
  if (sAfterL2 <= C2_LEN) {
    const phi = (sAfterL2 / C2_LEN) * (Math.PI / 2);
    const cx = -45.0;
    const cz = 20.5;
    const x = cx - C2_RADIUS * Math.sin(phi);
    const z = cz - C2_RADIUS * Math.cos(phi);
    const heading = -Math.PI / 2 + phi;
    return { x, z, heading };
  }

  // Segment 3: South through Main Gate (Heading 0 = +Z)
  const sAfterC2 = sAfterL2 - C2_LEN;
  return {
    x: -48.0,
    z: 20.5 + sAfterC2,
    heading: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// State definition for each of the 3 real trucks in the fleet
// ─────────────────────────────────────────────────────────────────────────────
interface TruckDynamicState {
  theme: TruckTheme;
  cabPos: [number, number, number];
  cabRotY: number;
  hitchPos: [number, number, number];
  trailerRotY: number;
  hasCargo: boolean;
  wheelRot: number;
  opacity: number;
  visible: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Goods Logistics & 3-Truck FIFO Lifecycle Simulation
// Order: 1. Blue Truck -> 2. Green Truck -> 3. Yellow Truck
// ─────────────────────────────────────────────────────────────────────────────
export const GoodsAreaLogistics: React.FC<GoodsAreaLogisticsProps> = ({
  position = [48, 0, 15.5],
  visible = true,
}) => {
  const craneHoistRef = useRef<THREE.Group>(null);
  const [cycleTime, setCycleTime] = useState(0);
  const [activeCycleIdx, setActiveCycleIdx] = useState(0);

  const CYCLE_DURATION = 120.0;
  const DRIVE_DURATION = 34.0;

  // The 3 Real Physical Trucks in the Plant Fleet:
  // [0] = Blue Truck
  // [1] = Green Truck
  // [2] = Yellow Truck
  const [fleetStates, setFleetStates] = useState<TruckDynamicState[]>([
    {
      theme: 'blue',
      cabPos: [2.0, 0, 1.6],
      cabRotY: 0,
      hitchPos: [2.0, 0, 0],
      trailerRotY: 0,
      hasCargo: true,
      wheelRot: 0,
      opacity: 1.0,
      visible: true,
    },
    {
      theme: 'green',
      cabPos: [0.0, 0, -18.4],
      cabRotY: 0,
      hitchPos: [0.0, 0, -20.0],
      trailerRotY: 0,
      hasCargo: false,
      wheelRot: 0,
      opacity: 1.0,
      visible: true,
    },
    {
      theme: 'yellow',
      cabPos: [0.0, 0, -33.4],
      cabRotY: 0,
      hitchPos: [0.0, 0, -35.0],
      trailerRotY: 0,
      hasCargo: false,
      wheelRot: 0,
      opacity: 1.0,
      visible: true,
    },
  ]);

  useFrame((state) => {
    const elapsed = state.clock.elapsedTime;
    const currentCycle = Math.floor(elapsed / CYCLE_DURATION);
    const t = elapsed % CYCLE_DURATION;
    setCycleTime(t);
    setActiveCycleIdx(currentCycle);

    const newStates: TruckDynamicState[] = [];
    const themes: TruckTheme[] = ['blue', 'green', 'yellow'];

    for (let i = 0; i < 3; i++) {
      const theme = themes[i];
      // Role of this truck in the current cycle:
      // role 0 = Active Dispatching Truck (currently at or departing the bay)
      // role 1 = Primary Queued Truck (at Queue Spot 1 z = -20.0, rolls into Bay when it opens)
      // role 2 = Secondary Queued Truck (at Queue Spot 2 z = -35.0, rolls into Spot 1 when it opens)
      const role = ((i - (currentCycle % 3)) + 3) % 3;

      let cabPos: [number, number, number] = [0, 0, 0];
      let cabRotY = 0;
      let hitchPos: [number, number, number] = [0, 0, 0];
      let trailerRotY = 0;
      let hasCargo = false;
      let wheelRot = 0;
      let opacity = 1.0;
      let isVisible = true;

      if (role === 0) {
        // ── ROLE 0: ACTIVE DISPATCHING TRUCK ──
        if (t < DRIVE_DURATION) {
          // Driving out through the plant roads & Main Gate
          const driveProgress = t / DRIVE_DURATION;
          const currentCabS = driveProgress * TOTAL_PATH_LEN;
          const speed = TOTAL_PATH_LEN / DRIVE_DURATION;
          wheelRot = elapsed * speed * 2.4;

          const cabPoint = getPathPoint(currentCabS);
          const hitchS = Math.max(0, currentCabS - 1.6);
          const hitchPoint = getPathPoint(hitchS);
          const trailerRearS = Math.max(0, hitchS - 5.6);
          const trailerRearPoint = getPathPoint(trailerRearS);

          const dx = hitchPoint.x - trailerRearPoint.x;
          const dz = hitchPoint.z - trailerRearPoint.z;
          trailerRotY = Math.hypot(dx, dz) > 0.05 ? Math.atan2(dx, dz) : hitchPoint.heading;

          cabPos = [cabPoint.x, 0, cabPoint.z];
          cabRotY = cabPoint.heading;
          hitchPos = [hitchPoint.x, 0, hitchPoint.z];
          hasCargo = true;

          // Fade out as it leaves campus perimeter
          if (driveProgress > 0.88) {
            opacity = Math.max(0, 1.0 - (driveProgress - 0.88) / 0.12);
          }
        } else if (t < 45.0) {
          // After exiting, new empty truck arrives from depot and takes Queue Spot 2
          const enterProgress = (t - 30.0) / 15.0; // 0 to 1
          const hitchZ = -50.0 + enterProgress * 15.0; // -50.0 to -35.0
          cabPos = [0.0, 0, hitchZ + 1.6];
          cabRotY = 0;
          hitchPos = [0.0, 0, hitchZ];
          trailerRotY = 0;
          hasCargo = false;
          wheelRot = elapsed * 4.0;
          opacity = 1.0;
        } else {
          // Parked at Queue Spot 2 waiting
          cabPos = [0.0, 0, -33.4];
          cabRotY = 0;
          hitchPos = [0.0, 0, -35.0];
          trailerRotY = 0;
          hasCargo = false;
          wheelRot = 0;
          opacity = 1.0;
        }
      } else if (role === 1) {
        // ── ROLE 1: PRIMARY QUEUED TRUCK (Front of Queue -> Bay) ──
        if (t < 30.0) {
          // Waiting patiently at Queue Spot 1 (z = -20.0 next to Utility Substation, safely past crossroad)
          cabPos = [0.0, 0, -18.4];
          cabRotY = 0;
          hitchPos = [0.0, 0, -20.0];
          trailerRotY = 0;
          hasCargo = false;
          wheelRot = 0;
        } else if (t < 45.0) {
          // Bay is open! Smoothly drive forward past crossroad into Loading Bay (z: -20 -> 0, x: 0 -> 2)
          const advT = (t - 30.0) / 15.0;
          const curZ = -20.0 + advT * 20.0;
          const curX = 0.0 + advT * 2.0;
          cabPos = [curX, 0, curZ + 1.6];
          cabRotY = 0;
          hitchPos = [curX, 0, curZ];
          trailerRotY = 0;
          hasCargo = false;
          wheelRot = elapsed * 3.5;
        } else {
          // Docked at Loading Bay under the gantry crane
          cabPos = [2.0, 0, 1.6];
          cabRotY = 0;
          hitchPos = [2.0, 0, 0.0];
          trailerRotY = 0;
          // Cargo is loaded by crane between 45s and 75s
          hasCargo = t >= 75.0;
          wheelRot = 0;
        }
      } else {
        // ── ROLE 2: SECONDARY QUEUED TRUCK (Rear of Queue -> Front of Queue) ──
        if (t < 30.0) {
          // Parked at Queue Spot 2 (z = -35.0 along utility road)
          cabPos = [0.0, 0, -33.4];
          cabRotY = 0;
          hitchPos = [0.0, 0, -35.0];
          trailerRotY = 0;
          hasCargo = false;
          wheelRot = 0;
        } else if (t < 45.0) {
          // Advance forward into Queue Spot 1 (z: -35.0 -> -20.0)
          const advT = (t - 30.0) / 15.0;
          const curZ = -35.0 + advT * 15.0;
          cabPos = [0.0, 0, curZ + 1.6];
          cabRotY = 0;
          hitchPos = [0.0, 0, curZ];
          trailerRotY = 0;
          hasCargo = false;
          wheelRot = elapsed * 3.0;
        } else {
          // Now parked at Queue Spot 1 (z = -20.0)
          cabPos = [0.0, 0, -18.4];
          cabRotY = 0;
          hitchPos = [0.0, 0, -20.0];
          trailerRotY = 0;
          hasCargo = false;
          wheelRot = 0;
        }
      }

      newStates.push({
        theme,
        cabPos,
        cabRotY,
        hitchPos,
        trailerRotY,
        hasCargo,
        wheelRot,
        opacity,
        visible: isVisible,
      });
    }

    setFleetStates(newStates);

    // ── GANTRY CRANE HOIST ANIMATION (Active during 45s - 85s when truck is docked in bay) ──
    if (craneHoistRef.current) {
      if (t >= 45.0 && t <= 85.0) {
        const craneT = (t - 45.0) / 40.0;
        craneHoistRef.current.position.x = -0.5 + Math.sin(craneT * Math.PI * 3) * 2.4;
      } else {
        craneHoistRef.current.position.x = 0;
      }
    }
  });

  if (!visible) return null;

  const currentActiveIndex = activeCycleIdx % 3;
  const activeTruckName = currentActiveIndex === 0 ? '1. Blue Hauler' : currentActiveIndex === 1 ? '2. Green Reefer' : '3. Yellow Heavy';
  const nextTruckIndex = (activeCycleIdx + 1) % 3;
  const nextTruckName = nextTruckIndex === 0 ? '1. Blue Hauler' : nextTruckIndex === 1 ? '2. Green Reefer' : '3. Yellow Heavy';

  const secondsRemaining = Math.max(0, Math.floor(CYCLE_DURATION - cycleTime));
  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const timerStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const isDispatching = cycleTime < DRIVE_DURATION;

  return (
    <group position={position}>
      {/* ── 1. OUTBOUND LOGISTICS TRANSFER CONVEYOR (Connecting from Packaging) ── */}
      <group position={[-6.5, 0, 0]}>
        <mesh position={[0, 0.85, 0]} castShadow receiveShadow>
          <boxGeometry args={[4.5, 0.14, 1.2]} />
          <meshStandardMaterial color="#334155" metalness={0.7} />
        </mesh>
        <mesh position={[0, 0.93, 0]}>
          <boxGeometry args={[4.45, 0.02, 0.95]} />
          <meshStandardMaterial color="#0F172A" roughness={0.9} />
        </mesh>
        {[-1.8, 1.8].map((lx, li) => (
          <mesh key={li} position={[lx, 0.42, 0]}>
            <boxGeometry args={[0.08, 0.84, 0.8]} />
            <meshStandardMaterial color="#1E293B" metalness={0.8} />
          </mesh>
        ))}
      </group>

      {/* ── 2. FINISHED GOODS PALLET ACCUMULATION & CONTAINER STAGING PAD ── */}
      <group position={[-2.0, 0, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <planeGeometry args={[5.5, 9.0]} />
          <meshBasicMaterial color="#CBD5E1" />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, -4.4]}>
          <planeGeometry args={[5.5, 0.1]} />
          <meshBasicMaterial color="#F59E0B" />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 4.4]}>
          <planeGeometry args={[5.5, 0.1]} />
          <meshBasicMaterial color="#F59E0B" />
        </mesh>

        {[
          [-1.5, -2.5], [-1.5, 0.0], [-1.5, 2.5],
          [1.5, -2.5],  [1.5, 0.0],  [1.5, 2.5],
        ].map(([px, pz], pi) => (
          <group key={pi} position={[px, 0, pz]}>
            <mesh position={[0, 0.08, 0]} castShadow>
              <boxGeometry args={[1.4, 0.16, 1.4]} />
              <meshStandardMaterial color="#92400E" roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.7, 0]} castShadow>
              <boxGeometry args={[1.25, 1.1, 1.25]} />
              <meshStandardMaterial color="#D97706" roughness={0.7} />
            </mesh>
            <mesh position={[0, 0.7, 0]}>
              <boxGeometry args={[1.28, 1.12, 1.28]} />
              <meshStandardMaterial color="#F8FAFC" transparent opacity={0.3} roughness={0.1} />
            </mesh>
          </group>
        ))}
      </group>

      {/* ── 3. OVERHEAD GANTRY CRANE SYSTEM ── */}
      <group position={[0.5, 0, 0]}>
        {/* West A-Frame Support */}
        <group position={[-4.8, 0, 0]}>
          {[-2.2, 2.2].map((lz, li) => (
            <mesh key={li} position={[0, 3.2, lz]} rotation={[li === 0 ? 0.06 : -0.06, 0, 0]} castShadow>
              <boxGeometry args={[0.35, 6.4, 0.35]} />
              <meshStandardMaterial color="#EAB308" metalness={0.7} roughness={0.3} />
            </mesh>
          ))}
          <mesh position={[0, 0.16, 0]}>
            <boxGeometry args={[0.65, 0.32, 5.2]} />
            <meshStandardMaterial color="#0F172A" metalness={0.9} />
          </mesh>
        </group>

        {/* East A-Frame Support */}
        <group position={[5.2, 0, 0]}>
          {[-2.2, 2.2].map((lz, li) => (
            <mesh key={li} position={[0, 3.2, lz]} rotation={[li === 0 ? 0.06 : -0.06, 0, 0]} castShadow>
              <boxGeometry args={[0.35, 6.4, 0.35]} />
              <meshStandardMaterial color="#EAB308" metalness={0.7} roughness={0.3} />
            </mesh>
          ))}
          <mesh position={[0, 0.16, 0]}>
            <boxGeometry args={[0.65, 0.32, 5.2]} />
            <meshStandardMaterial color="#0F172A" metalness={0.9} />
          </mesh>
        </group>

        {/* Overhead Bridge Girder */}
        <mesh position={[0.2, 6.4, 0]} castShadow>
          <boxGeometry args={[10.4, 0.55, 0.55]} />
          <meshStandardMaterial color="#CA8A04" metalness={0.7} roughness={0.3} />
        </mesh>

        {/* Hoist Trolley */}
        <group ref={craneHoistRef} position={[0, 6.15, 0]}>
          <mesh position={[0, 0.22, 0]}>
            <boxGeometry args={[0.7, 0.2, 0.7]} />
            <meshStandardMaterial color="#0F172A" metalness={0.9} roughness={0.2} />
          </mesh>
          <Asset
            url={`${FACTORY_KIT}/crane-lift.glb`}
            position={[0, 0, 0]}
            rotation={[0, Math.PI / 2, 0]}
            scale={1.2}
          />
        </group>
      </group>

      {/* ── 4. THE 3 PHYSICAL FLEET TRUCKS (Blue, Green, Yellow) ── */}
      {fleetStates.map((truck) => (
        <CompleteTruck
          key={truck.theme}
          cabPosition={truck.cabPos}
          cabRotationY={truck.cabRotY}
          hitchPosition={truck.hitchPos}
          trailerRotationY={truck.trailerRotY}
          theme={truck.theme}
          hasCargo={truck.hasCargo}
          wheelRotation={truck.wheelRot}
          opacity={truck.opacity}
        />
      ))}

      {/* ── 5. REAL-TIME LOGISTICS & TRUCK DISPATCH HUD BADGE ── */}
      <group position={[-1.5, 4.8, -4.2]}>
        <Html transform scale={0.065} position={[0, 0, 0]} className="pointer-events-none select-none">
          <div className="px-3.5 py-2 bg-slate-950/95 text-white font-mono text-[9px] rounded-lg border border-amber-500 shadow-2xl space-y-1">
            <div className="font-extrabold text-amber-400 border-b border-amber-800 pb-1 flex justify-between items-center space-x-2">
              <span>SHIPPING & LOGISTICS</span>
              <span className={`text-[7px] px-1.5 py-0.5 rounded font-bold ${
                isDispatching
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-500 animate-pulse'
                  : 'bg-amber-950 text-amber-300 border border-amber-500'
              }`}>
                {isDispatching ? 'ACTIVE DISPATCH EN ROUTE' : 'CARGO LOADING IN BAY'}
              </span>
            </div>
            <div className="space-y-0.5 text-[8px] pt-0.5">
              <div className="flex justify-between">
                <span className="text-slate-400">DISPATCHING:</span>
                <strong className="text-emerald-300 font-bold">{isDispatching ? activeTruckName : nextTruckName}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">NEXT IN QUEUE:</span>
                <strong className="text-cyan-300">{nextTruckName}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">CYCLE TIMER:</span>
                <strong className="text-amber-300">{timerStr} (2 MIN CYCLE)</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">FLEET QUEUE:</span>
                <span className="text-slate-200">1. Blue ➔ 2. Green ➔ 3. Yellow</span>
              </div>
            </div>
          </div>
        </Html>
      </group>
    </group>
  );
};
