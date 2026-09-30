import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Asset } from './GLBAsset';

const ROAD_KIT = '/models/kenney-city-kit-roads';

export const TILE_SIZE = 6.0;

// ─────────────────────────────────────────────────────────────────────────────
// Reusable Kenney Road Tile Components
// Native Kenney tile size is 1.0 x 1.0, scaled by TILE_SIZE (6.0)
// ─────────────────────────────────────────────────────────────────────────────

interface TileProps {
  position: [number, number, number];
  rotationY?: number;
}

export const RoadStraight: React.FC<TileProps> = ({ position, rotationY = 0 }) => (
  <Asset
    url={`${ROAD_KIT}/road-straight.glb`}
    position={[position[0], position[1] + 0.005, position[2]]}
    rotation={[0, rotationY, 0]}
    scale={TILE_SIZE}
  />
);

export const RoadBend: React.FC<TileProps> = ({ position, rotationY = 0 }) => (
  <Asset
    url={`${ROAD_KIT}/road-bend.glb`}
    position={[position[0], position[1] + 0.005, position[2]]}
    rotation={[0, rotationY, 0]}
    scale={TILE_SIZE}
  />
);

export const RoadCrossroad: React.FC<TileProps> = ({ position, rotationY = 0 }) => (
  <Asset
    url={`${ROAD_KIT}/road-crossroad.glb`}
    position={[position[0], position[1] + 0.005, position[2]]}
    rotation={[0, rotationY, 0]}
    scale={TILE_SIZE}
  />
);

export const RoadIntersection: React.FC<TileProps> = ({ position, rotationY = 0 }) => (
  <Asset
    url={`${ROAD_KIT}/road-intersection.glb`}
    position={[position[0], position[1] + 0.005, position[2]]}
    rotation={[0, rotationY, 0]}
    scale={TILE_SIZE}
  />
);

export const RoadCrossing: React.FC<TileProps> = ({ position, rotationY = 0 }) => (
  <Asset
    url={`${ROAD_KIT}/road-crossing.glb`}
    position={[position[0], position[1] + 0.005, position[2]]}
    rotation={[0, rotationY, 0]}
    scale={TILE_SIZE}
  />
);

export const RoadSide: React.FC<TileProps> = ({ position, rotationY = 0 }) => (
  <Asset
    url={`${ROAD_KIT}/road-side.glb`}
    position={[position[0], position[1] + 0.005, position[2]]}
    rotation={[0, rotationY, 0]}
    scale={TILE_SIZE}
  />
);

export const RoadEnd: React.FC<TileProps> = ({ position, rotationY = 0 }) => (
  <Asset
    url={`${ROAD_KIT}/road-end.glb`}
    position={[position[0], position[1] + 0.005, position[2]]}
    rotation={[0, rotationY, 0]}
    scale={TILE_SIZE}
  />
);

export const RoadLightPole: React.FC<{ position: [number, number, number]; rotationY?: number }> = ({ position, rotationY = 0 }) => (
  <Asset url={`${ROAD_KIT}/light-square.glb`} position={position} rotation={[0, rotationY, 0]} scale={7} />
);

export const StopSign: React.FC<{ position: [number, number, number]; rotationY?: number }> = ({ position, rotationY = 0 }) => (
  <Asset url={`${ROAD_KIT}/road-sign-stop.glb`} position={position} rotation={[0, rotationY, 0]} scale={4.5} />
);

export const TrafficLightPole: React.FC<{ position: [number, number, number]; rotationY?: number }> = ({ position, rotationY = 0 }) => (
  <Asset url={`${ROAD_KIT}/traffic-light.glb`} position={position} rotation={[0, rotationY, 0]} scale={7} />
);

export const SafetyCone: React.FC<{ position: [number, number, number] }> = ({ position }) => (
  <Asset url={`${ROAD_KIT}/construction-cone.glb`} position={position} scale={6} />
);

export const SafetyBarrier: React.FC<{ position: [number, number, number]; rotationY?: number }> = ({ position, rotationY = 0 }) => (
  <Asset url={`${ROAD_KIT}/construction-barrier.glb`} position={position} rotation={[0, rotationY, 0]} scale={6} />
);

export const SafetyFence: React.FC<{ position: [number, number, number]; rotationY?: number }> = ({ position, rotationY = 0 }) => (
  <Asset url={`${ROAD_KIT}/construction-fence.glb`} position={position} rotation={[0, rotationY, 0]} scale={6.5} />
);

export const DumpsterProp: React.FC<{ position: [number, number, number]; rotationY?: number }> = ({ position, rotationY = 0 }) => (
  <Asset url={`${ROAD_KIT}/dumpster.glb`} position={position} rotation={[0, rotationY, 0]} scale={6.5} />
);

export const ElectricityPole: React.FC<{ position: [number, number, number]; rotationY?: number }> = ({ position, rotationY = 0 }) => (
  <Asset url={`${ROAD_KIT}/electricity-pole.glb`} position={position} rotation={[0, rotationY, 0]} scale={9.5} />
);

const CAR_KIT = '/models/kenney-car-kit';

// ─────────────────────────────────────────────────────────────────────────────
// Parked Vehicle Model (Authentic Kenney Car Kit with Custom Paint Colors)
// ─────────────────────────────────────────────────────────────────────────────
export const ParkedCar: React.FC<{
  position: [number, number, number];
  model?: 'suv' | 'truck' | 'taxi' | 'ambulance' | 'firetruck' | 'race';
  rotationY?: number;
  scale?: number;
  tint?: string;
  tintStrength?: number;
}> = ({
  position,
  model = 'suv',
  rotationY = 0,
  scale = 1.45,
  tint,
  tintStrength = 0.8,
}) => (
  <Asset
    url={`${CAR_KIT}/${model}.glb`}
    position={position}
    rotation={[0, rotationY, 0]}
    scale={scale}
    tint={tint}
    tintStrength={tintStrength}
  />
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Gate Security Complex
// ─────────────────────────────────────────────────────────────────────────────
export const MainGateComplex: React.FC<{ position: [number, number, number] }> = ({ position }) => {
  return (
    <group position={position}>
      {/* Security Checkpoint Booth */}
      <group position={[6.0, 0, 0]}>
        {/* Booth Building */}
        <mesh position={[0, 1.4, 0]} castShadow>
          <boxGeometry args={[2.4, 2.8, 2.8]} />
          <meshStandardMaterial color="#E2E8F0" roughness={0.4} metalness={0.2} />
        </mesh>
        {/* Dark Overhang Roof */}
        <mesh position={[0, 2.85, 0]} castShadow>
          <boxGeometry args={[2.8, 0.2, 3.2]} />
          <meshStandardMaterial color="#1E293B" roughness={0.3} metalness={0.7} />
        </mesh>
        {/* Tinted Observation Windows */}
        <mesh position={[0, 1.6, 1.41]}>
          <boxGeometry args={[1.8, 1.1, 0.05]} />
          <meshStandardMaterial color="#60A5FA" transparent opacity={0.65} emissive="#60A5FA" emissiveIntensity={0.2} />
        </mesh>
        <mesh position={[-1.21, 1.6, 0]}>
          <boxGeometry args={[0.05, 1.1, 1.8]} />
          <meshStandardMaterial color="#60A5FA" transparent opacity={0.65} emissive="#60A5FA" emissiveIntensity={0.2} />
        </mesh>
      </group>

      {/* Heavy Overhead Industrial Gate Arch */}
      <group position={[0, 0, 0]}>
        {/* Left Support Column */}
        <mesh position={[-4.5, 2.6, 0]} castShadow>
          <boxGeometry args={[0.6, 5.2, 0.6]} />
          <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Right Support Column */}
        <mesh position={[4.5, 2.6, 0]} castShadow>
          <boxGeometry args={[0.6, 5.2, 0.6]} />
          <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Overhead Crossbeam */}
        <mesh position={[0, 5.0, 0]} castShadow>
          <boxGeometry args={[10.2, 0.7, 0.7]} />
          <meshStandardMaterial color="#1E293B" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Illuminated Campus Name Plaque */}
        <mesh position={[0, 5.0, 0.38]}>
          <boxGeometry args={[7.2, 0.55, 0.06]} />
          <meshStandardMaterial color="#2563EB" emissive="#1D4ED8" emissiveIntensity={0.4} />
        </mesh>
      </group>

      {/* Automated Barrier Boom Arms (Red/White Safety Stripes) */}
      <group position={[-4.0, 0.85, 0.8]}>
        {/* Barrier Housing Motor */}
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[0.45, 0.9, 0.45]} />
          <meshStandardMaterial color="#EA580C" roughness={0.4} />
        </mesh>
        {/* Boom Arm */}
        <mesh position={[1.8, 0.1, 0]} rotation={[0, 0, 0]}>
          <boxGeometry args={[3.6, 0.08, 0.08]} />
          <meshStandardMaterial color="#F8FAFC" />
        </mesh>
        {/* Red Warning Band on Boom */}
        {[-0.6, 0.6, 1.8].map((bx, bi) => (
          <mesh key={bi} position={[1.8 + bx * 0.8, 0.1, 0.01]}>
            <boxGeometry args={[0.3, 0.09, 0.09]} />
            <meshStandardMaterial color="#DC2626" />
          </mesh>
        ))}
      </group>

      <group position={[4.0, 0.85, -0.8]} rotation={[0, Math.PI, 0]}>
        {/* Inbound Barrier Housing */}
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[0.45, 0.9, 0.45]} />
          <meshStandardMaterial color="#EA580C" roughness={0.4} />
        </mesh>
        <mesh position={[1.8, 0.1, 0]}>
          <boxGeometry args={[3.6, 0.08, 0.08]} />
          <meshStandardMaterial color="#F8FAFC" />
        </mesh>
        {[-0.6, 0.6, 1.8].map((bx, bi) => (
          <mesh key={bi} position={[1.8 + bx * 0.8, 0.1, 0.01]}>
            <boxGeometry args={[0.3, 0.09, 0.09]} />
            <meshStandardMaterial color="#DC2626" />
          </mesh>
        ))}
      </group>

      {/* Stop Signs & Traffic Light */}
      <StopSign position={[-4.6, 0, 2.4]} rotationY={0} />
      <StopSign position={[4.6, 0, -2.4]} rotationY={Math.PI} />
      <TrafficLightPole position={[4.6, 0, 2.4]} rotationY={0} />
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Campus Road Network Component
// Hierarchical, grid-snapped network of authentic Kenney Road GLB tiles:
// - Central Cross Avenue (z = -3.0): horizontal primary spine
// - North-South Central Spine (x = 0): Main Gate -> Central Crossroads -> Processing Cell
// - West Secondary Road (x = -18): connects Assembly, Machining, Parking
// - East Logistics Road (x = 18 & x = 48): connects Robot, Packaging, Goods Staging & Truck
// - South Perimeter Artery (z = 33): links Parking, Gate, Logistics exit
// - North Service Artery (z = -33): links Machining, Processing, Utility Area
// ─────────────────────────────────────────────────────────────────────────────

interface CampusRoadNetworkProps {
  showRoads?: boolean;
  showVehicles?: boolean;
}

export const CampusRoadNetwork: React.FC<CampusRoadNetworkProps> = ({
  showRoads = true,
  showVehicles = true,
}) => {
  if (!showRoads) return null;

  return (
    <group>
      {/* ─────────────────────────────────────────────────────────────────────
          1. CENTRAL HORIZONTAL AVENUE (z = -3.0) — East-West Primary Artery
          Spans x = -54 to x = 54
      ───────────────────────────────────────────────────────────────────── */}
      {/* West section: x = -54 to x = -24 */}
      <RoadBend position={[-54, 0, -3]} rotationY={Math.PI / 2} />
      <RoadStraight position={[-48, 0, -3]} rotationY={0} />
      <RoadStraight position={[-42, 0, -3]} rotationY={0} />
      <RoadStraight position={[-36, 0, -3]} rotationY={0} />
      <RoadStraight position={[-30, 0, -3]} rotationY={0} />
      <RoadStraight position={[-24, 0, -3]} rotationY={0} />

      {/* West 4-Way Crossroad (x = -18, z = -3) */}
      <RoadCrossroad position={[-18, 0, -3]} rotationY={0} />

      {/* Mid-West section: x = -12 to x = -6 */}
      <RoadStraight position={[-12, 0, -3]} rotationY={0} />
      <RoadStraight position={[-6, 0, -3]} rotationY={0} />

      {/* Central 4-Way Crossroad (x = 0, z = -3) — Heart of the Campus */}
      <RoadCrossroad position={[0, 0, -3]} rotationY={0} />

      {/* Mid-East section: x = 6 to x = 12 */}
      <RoadStraight position={[6, 0, -3]} rotationY={0} />
      <RoadStraight position={[12, 0, -3]} rotationY={0} />

      {/* East 4-Way Crossroad (x = 18, z = -3) */}
      <RoadCrossroad position={[18, 0, -3]} rotationY={0} />

      {/* East section leading to Shipping: x = 24 to x = 54 */}
      <RoadStraight position={[24, 0, -3]} rotationY={0} />
      <RoadStraight position={[30, 0, -3]} rotationY={0} />
      <RoadStraight position={[36, 0, -3]} rotationY={0} />
      <RoadStraight position={[42, 0, -3]} rotationY={0} />
      <RoadCrossroad position={[48, 0, -3]} rotationY={0} />
      <RoadBend position={[54, 0, -3]} rotationY={Math.PI} />

      {/* ─────────────────────────────────────────────────────────────────────
          2. CENTRAL NORTH-SOUTH AVENUE (x = 0)
          Main Gate [0, 0, 45] -> Central Crossroad [0, 0, -3] -> Processing [0, 0, -33]
      ───────────────────────────────────────────────────────────────────── */}
      {/* South Approach from Main Gate */}
      <RoadStraight position={[0, 0, 45]} rotationY={Math.PI / 2} />
      <RoadCrossing position={[0, 0, 39]} rotationY={Math.PI / 2} />
      <RoadCrossroad position={[0, 0, 33]} rotationY={0} />
      <RoadStraight position={[0, 0, 27]} rotationY={Math.PI / 2} />
      <RoadStraight position={[0, 0, 21]} rotationY={Math.PI / 2} />
      <RoadStraight position={[0, 0, 15]} rotationY={Math.PI / 2} />
      <RoadStraight position={[0, 0, 9]} rotationY={Math.PI / 2} />
      <RoadCrossing position={[0, 0, 3]} rotationY={Math.PI / 2} />

      {/* North Spur toward Processing Cell & Utility */}
      <RoadCrossing position={[0, 0, -9]} rotationY={Math.PI / 2} />
      <RoadStraight position={[0, 0, -15]} rotationY={Math.PI / 2} />
      <RoadStraight position={[0, 0, -21]} rotationY={Math.PI / 2} />
      <RoadStraight position={[0, 0, -27]} rotationY={Math.PI / 2} />
      <RoadCrossroad position={[0, 0, -33]} rotationY={0} />

      {/* ─────────────────────────────────────────────────────────────────────
          3. WEST NORTH-SOUTH CORRIDOR (x = -18)
          Links Assembly Cell [-35, 15] & Machining Cell [-35, -20.5]
      ───────────────────────────────────────────────────────────────────── */}
      {/* South section */}
      <RoadCrossroad position={[-18, 0, 33]} rotationY={0} />
      <RoadStraight position={[-18, 0, 27]} rotationY={Math.PI / 2} />
      <RoadStraight position={[-18, 0, 21]} rotationY={Math.PI / 2} />
      <RoadStraight position={[-18, 0, 15]} rotationY={Math.PI / 2} />
      <RoadStraight position={[-18, 0, 9]} rotationY={Math.PI / 2} />
      <RoadCrossing position={[-18, 0, 3]} rotationY={Math.PI / 2} />

      {/* North section */}
      <RoadCrossing position={[-18, 0, -9]} rotationY={Math.PI / 2} />
      <RoadStraight position={[-18, 0, -15]} rotationY={Math.PI / 2} />
      <RoadStraight position={[-18, 0, -21]} rotationY={Math.PI / 2} />
      <RoadStraight position={[-18, 0, -27]} rotationY={Math.PI / 2} />
      <RoadCrossroad position={[-18, 0, -33]} rotationY={0} />

      {/* ─────────────────────────────────────────────────────────────────────
          4. EAST NORTH-SOUTH CORRIDOR (x = 18)
          Links Packaging Cell [31, 16] & Robot Cell [33, -20.5]
      ───────────────────────────────────────────────────────────────────── */}
      {/* South section */}
      <RoadCrossroad position={[18, 0, 33]} rotationY={0} />
      <RoadStraight position={[18, 0, 27]} rotationY={Math.PI / 2} />
      <RoadStraight position={[18, 0, 21]} rotationY={Math.PI / 2} />
      <RoadStraight position={[18, 0, 15]} rotationY={Math.PI / 2} />
      <RoadStraight position={[18, 0, 9]} rotationY={Math.PI / 2} />
      <RoadCrossing position={[18, 0, 3]} rotationY={Math.PI / 2} />

      {/* North section */}
      <RoadCrossing position={[18, 0, -9]} rotationY={Math.PI / 2} />
      <RoadStraight position={[18, 0, -15]} rotationY={Math.PI / 2} />
      <RoadStraight position={[18, 0, -21]} rotationY={Math.PI / 2} />
      <RoadStraight position={[18, 0, -27]} rotationY={Math.PI / 2} />
      <RoadCrossroad position={[18, 0, -33]} rotationY={0} />

      {/* ─────────────────────────────────────────────────────────────────────
          5. EAST LOGISTICS & SHIPPING HIGHWAY (x = 48)
          Connects Goods Logistics Pad [48, 0, 15.5] to South & North Arteries
      ───────────────────────────────────────────────────────────────────── */}
      {/* South logistics branch */}
      <RoadCrossroad position={[48, 0, 33]} rotationY={0} />
      <RoadStraight position={[48, 0, 27]} rotationY={Math.PI / 2} />
      <RoadStraight position={[48, 0, 21]} rotationY={Math.PI / 2} />
      <RoadCrossing position={[48, 0, 15]} rotationY={Math.PI / 2} />
      <RoadStraight position={[48, 0, 9]} rotationY={Math.PI / 2} />
      <RoadCrossing position={[48, 0, 3]} rotationY={Math.PI / 2} />

      {/* North logistics branch leading into Utility Area */}
      <RoadCrossing position={[48, 0, -9]} rotationY={Math.PI / 2} />
      <RoadStraight position={[48, 0, -15]} rotationY={Math.PI / 2} />
      <RoadStraight position={[48, 0, -21]} rotationY={Math.PI / 2} />
      <RoadStraight position={[48, 0, -27]} rotationY={Math.PI / 2} />
      <RoadCrossroad position={[48, 0, -33]} rotationY={0} />

      {/* ─────────────────────────────────────────────────────────────────────
          6. SOUTH PERIMETER ARTERY (z = 33)
          Connects Parking [-58, 31], West Corridor, Main Gate [0, 33], East & Logistics
      ───────────────────────────────────────────────────────────────────── */}
      <RoadBend position={[-54, 0, 33]} rotationY={0} />
      <RoadStraight position={[-48, 0, 33]} rotationY={0} />
      <RoadStraight position={[-42, 0, 33]} rotationY={0} />
      <RoadStraight position={[-36, 0, 33]} rotationY={0} />
      <RoadStraight position={[-30, 0, 33]} rotationY={0} />
      <RoadStraight position={[-24, 0, 33]} rotationY={0} />
      {/* [-18, 0, 33] is RoadCrossroad above */}
      <RoadStraight position={[-12, 0, 33]} rotationY={0} />
      <RoadStraight position={[-6, 0, 33]} rotationY={0} />
      {/* [0, 0, 33] is RoadCrossroad above */}
      <RoadStraight position={[6, 0, 33]} rotationY={0} />
      <RoadStraight position={[12, 0, 33]} rotationY={0} />
      {/* [18, 0, 33] is RoadCrossroad above */}
      <RoadStraight position={[24, 0, 33]} rotationY={0} />
      <RoadStraight position={[30, 0, 33]} rotationY={0} />
      <RoadStraight position={[36, 0, 33]} rotationY={0} />
      <RoadStraight position={[42, 0, 33]} rotationY={0} />
      {/* [48, 0, 33] is RoadCrossroad above */}
      <RoadBend position={[54, 0, 33]} rotationY={-Math.PI / 2} />

      {/* ─────────────────────────────────────────────────────────────────────
          7. NORTH SERVICE & UTILITY ARTERY (z = -33)
          Connects Machining rear, Processing rear, Robot rear, and Utility Area
      ───────────────────────────────────────────────────────────────────── */}
      <RoadBend position={[-54, 0, -33]} rotationY={Math.PI} />
      <RoadStraight position={[-48, 0, -33]} rotationY={0} />
      <RoadStraight position={[-42, 0, -33]} rotationY={0} />
      <RoadStraight position={[-36, 0, -33]} rotationY={0} />
      <RoadStraight position={[-30, 0, -33]} rotationY={0} />
      <RoadStraight position={[-24, 0, -33]} rotationY={0} />
      {/* [-18, 0, -33] is RoadCrossroad above */}
      <RoadStraight position={[-12, 0, -33]} rotationY={0} />
      <RoadStraight position={[-6, 0, -33]} rotationY={0} />
      {/* [0, 0, -33] is RoadCrossroad above */}
      <RoadStraight position={[6, 0, -33]} rotationY={0} />
      <RoadStraight position={[12, 0, -33]} rotationY={0} />
      {/* [18, 0, -33] is RoadCrossroad above */}
      <RoadStraight position={[24, 0, -33]} rotationY={0} />
      <RoadStraight position={[30, 0, -33]} rotationY={0} />
      <RoadStraight position={[36, 0, -33]} rotationY={0} />
      <RoadStraight position={[42, 0, -33]} rotationY={0} />
      {/* [48, 0, -33] is RoadCrossroad above */}
      <RoadStraight position={[54, 0, -33]} rotationY={0} />
      <RoadBend position={[60, 0, -33]} rotationY={-Math.PI / 2} />

      {/* East utility spur connecting down to Utility Equipment pad */}
      <RoadStraight position={[60, 0, -27]} rotationY={Math.PI / 2} />
      <RoadEnd position={[60, 0, -21]} rotationY={Math.PI / 2} />

      {/* West outer perimeter link connecting z = -3 to z = 33 */}
      <RoadStraight position={[-54, 0, 3]} rotationY={Math.PI / 2} />
      <RoadStraight position={[-54, 0, 9]} rotationY={Math.PI / 2} />
      <RoadStraight position={[-54, 0, 15]} rotationY={Math.PI / 2} />
      <RoadStraight position={[-54, 0, 21]} rotationY={Math.PI / 2} />
      <RoadStraight position={[-54, 0, 27]} rotationY={Math.PI / 2} />

      {/* East outer perimeter link connecting z = -3 to z = 33 */}
      <RoadStraight position={[54, 0, 3]} rotationY={Math.PI / 2} />
      <RoadStraight position={[54, 0, 9]} rotationY={Math.PI / 2} />
      <RoadStraight position={[54, 0, 15]} rotationY={Math.PI / 2} />
      <RoadStraight position={[54, 0, 21]} rotationY={Math.PI / 2} />
      <RoadStraight position={[54, 0, 27]} rotationY={Math.PI / 2} />

      {/* ─────────────────────────────────────────────────────────────────────
          8. MAIN GATE ENTRANCE COMPLEX ([0, 0, 45])
      ───────────────────────────────────────────────────────────────────── */}
      <MainGateComplex position={[0, 0, 45]} />

      {/* ─────────────────────────────────────────────────────────────────────
          9. PARKING LOT FACILITY ([-58, 0, 31])
      ───────────────────────────────────────────────────────────────────── */}
      {showVehicles && (
        <group position={[-58, 0, 31]}>
          {/* White Painted Parking Stall Lines */}
          {[-6.0, -3.6, -1.2, 1.2, 3.6, 6.0].map((px, pi) => (
            <mesh key={pi} rotation={[-Math.PI / 2, 0, 0]} position={[px, 0.005, 0]}>
              <planeGeometry args={[0.15, 8.8]} />
              <meshBasicMaterial color="#FFFFFF" />
            </mesh>
          ))}
          {/* North Parking Row (Facing South) */}
          {[
            { model: 'suv' as const, tint: '#2563EB', x: -4.8 },        // Cobalt Blue SUV
            { model: 'truck' as const, tint: '#DC2626', x: -2.4 },      // Crimson Red Pickup
            { model: 'taxi' as const, tint: '#F59E0B', x: 0.0 },        // NYC Amber Taxi
            { model: 'suv' as const, tint: '#059669', x: 2.4 },         // Emerald Green SUV
            { model: 'race' as const, tint: '#EA580C', x: 4.8 },        // Blaze Orange Sports
          ].map((car, ci) => (
            <ParkedCar
              key={`car-n-${ci}`}
              position={[car.x, 0, -2.2]}
              model={car.model}
              tint={car.tint}
              tintStrength={0.78}
              rotationY={0}
              scale={1.35}
            />
          ))}
          {/* South Parking Row (Facing North) */}
          {[
            { model: 'suv' as const, tint: '#1E293B', x: -4.8 },        // Obsidian Black SUV
            { model: 'ambulance' as const, tint: '#F8FAFC', x: -2.4 },  // Medical White Ambulance
            { model: 'firetruck' as const, tint: '#B91C1C', x: 0.0 },  // Fire Station Red
            { model: 'truck' as const, tint: '#0284C7', x: 2.4 },       // Electric Cyan Truck
            { model: 'suv' as const, tint: '#7C5CC4', x: 4.8 },         // Royal Purple SUV
          ].map((car, ci) => (
            <ParkedCar
              key={`car-s-${ci}`}
              position={[car.x, 0, 2.2]}
              model={car.model}
              tint={car.tint}
              tintStrength={0.78}
              rotationY={Math.PI}
              scale={1.35}
            />
          ))}
        </group>
      )}

      {/* ─────────────────────────────────────────────────────────────────────
          10. STREETLIGHT SYSTEM (Properly Aligned on Sidewalks & Curb Edges)
          Strictly kept OUT of all road tiles, driving lanes, and intersections!
      ───────────────────────────────────────────────────────────────────── */}
      {[
        // Central Avenue North Sidewalk (z = -7.5) - on sidewalk between road and North buildings
        [-35, 0, -7.5], [-8, 0, -7.5], [8, 0, -7.5], [33, 0, -7.5],
        // Central Avenue South Sidewalk (z = 1.5) - on sidewalk between road and South buildings
        [-35, 0, 1.5], [-8, 0, 1.5], [8, 0, 1.5], [31, 0, 1.5],
        // South Perimeter Grass Verge (z = 39.5) - outside south road, near fence
        [-42, 0, 39.5], [-26, 0, 39.5], [26, 0, 39.5], [42, 0, 39.5],
        // North Perimeter Grass Verge (z = -39.5) - outside north road, near fence
        [-42, 0, -39.5], [-26, 0, -39.5], [26, 0, -39.5], [42, 0, -39.5],
        // Main Security Gate Entrance Flanks (sidewalk outside the approach road)
        [-7.5, 0, 48.0], [7.5, 0, 48.0],
        // Logistics Pad Sidewalk
        [41.5, 0, 15.5], [54.5, 0, 15.5],
      ].map((lp, lpi) => (
        <RoadLightPole key={`lp-${lpi}`} position={lp as [number, number, number]} />
      ))}
    </group>
  );
};
