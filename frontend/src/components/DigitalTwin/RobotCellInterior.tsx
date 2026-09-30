import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { Machine, TelemetryData } from '../../types';

interface RobotCellInteriorProps {
  cx: number;
  cz: number;
  visible: boolean;
  machines?: Machine[];
  liveTelemetry?: Record<string, TelemetryData>;
  onSelectMachine?: (m: Machine) => void;
}

// Precision Silver Industrial Workpiece Assembly (Chassis Subframe Weldment)
interface WorkpieceProps {
  x: number;
  z: number;
  isWelded: boolean;
  isBeingWelded: boolean;
}

const SilverWeldingEquipment: React.FC<WorkpieceProps> = ({ x, z, isWelded, isBeingWelded }) => {
  return (
    <group position={[x, 1.08, z]}>
      {/* Heavy Precision Machined Silver Base Plate */}
      <mesh castShadow>
        <boxGeometry args={[1.15, 0.16, 0.68]} />
        <meshStandardMaterial color="#CBD5E1" metalness={0.92} roughness={0.18} />
      </mesh>

      {/* Silver Upright Structural Brackets */}
      {[-0.42, 0.42].map((bx, bi) => (
        <mesh key={bi} position={[bx, 0.22, 0]} castShadow>
          <boxGeometry args={[0.15, 0.32, 0.46]} />
          <meshStandardMaterial color="#E2E8F0" metalness={0.95} roughness={0.15} />
        </mesh>
      ))}

      {/* Longitudinal Silver Tubular Cross Bar */}
      <mesh position={[0, 0.32, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.065, 0.065, 0.95, 16]} />
        <meshStandardMaterial color="#F1F5F9" metalness={0.98} roughness={0.1} />
      </mesh>

      {/* Center Machined Silver Collar Hub */}
      <mesh position={[0, 0.32, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, 0.5, 16]} />
        <meshStandardMaterial color="#94A3B8" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Glowing Hot Welded Seam Bead */}
      {(isBeingWelded || isWelded) && (
        <mesh position={[0, 0.12, isBeingWelded ? 0.3 : 0.3]}>
          <boxGeometry args={[0.85, 0.04, 0.06]} />
          <meshBasicMaterial color={isBeingWelded ? '#FDE047' : '#EA580C'} />
        </mesh>
      )}
    </group>
  );
};

// Continuous Indexing Conveyor Line with Seamless Silver Equipment Flow
interface IndexingConveyorProps {
  lineX?: number;
  lineZ: number;
  isNorthLine: boolean;
}

const IndexingConveyorLine: React.FC<IndexingConveyorProps> = ({ lineX = -4.0, lineZ, isNorthLine }) => {
  const slatsRef = useRef<THREE.Group>(null);
  const chevronsRef = useRef<THREE.Group>(null);
  const [cycleProgress, setCycleProgress] = React.useState(0);

  useFrame((state) => {
    const cycleDuration = 10.0;
    const timeOffset = isNorthLine ? 0 : 4.5;
    const t = (state.clock.elapsedTime + timeOffset) % cycleDuration;
    setCycleProgress(t);

    const isMoving = t < 2.5 || t > 7.8;
    const moveSpeed = isMoving ? 2.6 : 0.0;

    const slatOffset = (state.clock.elapsedTime * moveSpeed) % 0.5;
    if (slatsRef.current) slatsRef.current.position.x = slatOffset;

    const cOffset = (state.clock.elapsedTime * moveSpeed * 0.8) % 2.0;
    if (chevronsRef.current) chevronsRef.current.position.x = cOffset;
  });

  const isWeldingActive = cycleProgress >= 2.5 && cycleProgress <= 7.8;
  const isMoving = cycleProgress < 2.5 || cycleProgress > 7.8;

  let advanceDelta = 0;
  if (isMoving) {
    const moveT = cycleProgress < 2.5 ? cycleProgress / 2.5 : (cycleProgress - 7.8) / 2.2;
    advanceDelta = moveT * 5.0;
  }

  const part1X = -10.0 + advanceDelta;
  const part2X = -5.0 + advanceDelta;
  const part3X = 0.0 + advanceDelta;
  const part4X = 5.0 + advanceDelta;
  const part5X = 10.0 + advanceDelta;

  const length = 17.0;
  const width = 1.05;
  const slatCount = Math.floor(length / 0.5) + 2;
  const chevronCount = Math.floor(length / 2.0) + 2;

  return (
    <group position={[lineX, 0, lineZ]}>
      {/* Heavy Steel Conveyor Frame */}
      <mesh position={[0, 0.82, 0]} castShadow receiveShadow>
        <boxGeometry args={[length, 0.14, width + 0.22]} />
        <meshStandardMaterial color="#1E293B" metalness={0.7} roughness={0.35} />
      </mesh>
      {/* Low-Friction Center Conveyor Bed */}
      <mesh position={[0, 0.90, 0]}>
        <boxGeometry args={[length, 0.02, width]} />
        <meshStandardMaterial color="#0B1120" roughness={0.92} />
      </mesh>

      {/* Moving Roller Slats */}
      <group ref={slatsRef}>
        {Array.from({ length: slatCount }).map((_, i) => (
          <mesh key={`slat-${i}`} position={[-length / 2 + i * 0.5, 0.915, 0]}>
            <boxGeometry args={[0.08, 0.012, width * 0.95]} />
            <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.4} />
          </mesh>
        ))}
      </group>

      {/* Luminous Flow Chevrons */}
      <group ref={chevronsRef}>
        {Array.from({ length: chevronCount }).map((_, ci) => (
          <group key={`chev-${ci}`} position={[-length / 2 + ci * 2.0, 0.922, 0]}>
            <mesh position={[-0.08, 0, -0.12]} rotation={[0, 0.6, 0]}>
              <boxGeometry args={[0.2, 0.005, 0.035]} />
              <meshBasicMaterial color="#38BDF8" transparent opacity={isMoving ? 0.75 : 0.25} />
            </mesh>
            <mesh position={[-0.08, 0, 0.12]} rotation={[0, -0.6, 0]}>
              <boxGeometry args={[0.2, 0.005, 0.035]} />
              <meshBasicMaterial color="#38BDF8" transparent opacity={isMoving ? 0.75 : 0.25} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Yellow Safety Guide Rails Along Conveyor Edges */}
      <mesh position={[0, 0.96, -width / 2 - 0.05]}>
        <boxGeometry args={[length, 0.06, 0.04]} />
        <meshStandardMaterial color="#EAB308" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.96, width / 2 + 0.05]}>
        <boxGeometry args={[length, 0.06, 0.04]} />
        <meshStandardMaterial color="#EAB308" metalness={0.5} roughness={0.4} />
      </mesh>

      {/* Support Legs */}
      {[-7.0, -3.5, 0.0, 3.5, 7.0].map((lx, li) => (
        <group key={li} position={[lx, 0, 0]}>
          {[-width / 2 - 0.04, width / 2 + 0.04].map((sw, swi) => (
            <mesh key={swi} position={[0, 0.41, sw]}>
              <cylinderGeometry args={[0.045, 0.045, 0.82, 8]} />
              <meshStandardMaterial color="#0F172A" metalness={0.8} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Pneumatic Clamp Fixtures at Robot Welding Stations */}
      {[-5.0, 5.0].map((fx, fi) => (
        <group key={`fixture-${fi}`} position={[fx, 0.92, 0]}>
          <mesh position={[0, 0.02, 0]}>
            <boxGeometry args={[1.6, 0.04, width + 0.15]} />
            <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.045, 0]}>
            <boxGeometry args={[1.2, 0.015, width * 0.7]} />
            <meshStandardMaterial color="#D97706" metalness={0.9} roughness={0.2} />
          </mesh>
          {[-width / 2 - 0.12, width / 2 + 0.12].map((cz, czi) => (
            <group key={czi} position={[0, 0.15, cz]}>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.05, 0.05, 0.18, 12]} />
                <meshStandardMaterial color="#0F172A" metalness={0.8} />
              </mesh>
              <mesh position={[0, 0.08, czi === 0 ? 0.08 : -0.08]}>
                <boxGeometry args={[0.06, 0.18, 0.06]} />
                <meshStandardMaterial color="#EAB308" metalness={0.6} />
              </mesh>
            </group>
          ))}
        </group>
      ))}

      {/* 5 Continuous Silver Workpieces */}
      {part1X > -8.5 && part1X < 8.5 && (
        <SilverWeldingEquipment x={part1X} z={0} isWelded={false} isBeingWelded={false} />
      )}
      {part2X > -8.5 && part2X < 8.5 && (
        <SilverWeldingEquipment x={part2X} z={0} isWelded={part2X > -4.8} isBeingWelded={isWeldingActive && Math.abs(part2X - -5.0) < 0.2} />
      )}
      {part3X > -8.5 && part3X < 8.5 && (
        <SilverWeldingEquipment x={part3X} z={0} isWelded={true} isBeingWelded={false} />
      )}
      {part4X > -8.5 && part4X < 8.5 && (
        <SilverWeldingEquipment x={part4X} z={0} isWelded={true} isBeingWelded={isWeldingActive && Math.abs(part4X - 5.0) < 0.2} />
      )}
      {part5X > -8.5 && part5X < 8.5 && (
        <SilverWeldingEquipment x={part5X} z={0} isWelded={true} isBeingWelded={false} />
      )}
    </group>
  );
};

/**
 * Robot Cell Interior Detail
 * - Redesigned & Shifted Layout:
 *   1. 4 Robots & Conveyor lines shifted left (lineX = -4.0) to create a generous open safety buffer between robots and forklift space.
 *   2. North Conveyor Line at lineZ = -3.5 (served by ROBOT-01 at x=24 & ROBOT-02 at x=34).
 *   3. South Conveyor Line at lineZ = +3.5 (served by ROBOT-03 at x=24 & ROBOT-04 at x=34).
 *   4. Dedicated Forklift Logistics Terminal placed strictly on the EAST side (x = +10.5).
 */
export const RobotCellInteriorDetail: React.FC<RobotCellInteriorProps> = ({
  cx,
  cz,
  visible,
}) => {
  if (!visible) return null;

  return (
    <group position={[cx, 0, cz]}>
      <group name="operationalGroup">
        {/* ── 1. NORTH WELDING CONVEYOR LINE (shifted left to lineX = -4.0, lineZ = -3.5) ── */}
        <IndexingConveyorLine lineX={-4.0} lineZ={-3.5} isNorthLine={true} />

        {/* ── 2. SOUTH WELDING CONVEYOR LINE (shifted left to lineX = -4.0, lineZ = +3.5) ── */}
        <IndexingConveyorLine lineX={-4.0} lineZ={3.5} isNorthLine={false} />

        {/* ── 3. DEDICATED FORKLIFT LOGISTICS TERMINAL (EAST SIDE, x = +10.5, spacious buffer) ── */}
        <group position={[10.5, 0, 0]}>
          {/* Main Dark Charcoal Staging Deck with Yellow Hazard Border */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
            <planeGeometry args={[5.2, 17.5]} />
            <meshBasicMaterial color="#FEF08A" />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
            <planeGeometry args={[4.8, 17.0]} />
            <meshBasicMaterial color="#0F172A" />
          </mesh>

          {/* North Infeed Station: Raw Machined Parts Drop-off Pad (z = -3.5) */}
          <group position={[0, 0, -3.5]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
              <planeGeometry args={[4.2, 5.5]} />
              <meshBasicMaterial color="#0284C7" />
            </mesh>
            {/* Raw Machined Parts Pallet Stacks */}
            <mesh position={[0, 0.08, 0]} castShadow>
              <boxGeometry args={[1.4, 0.16, 1.4]} />
              <meshStandardMaterial color="#92400E" roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.45, 0]} castShadow>
              <boxGeometry args={[1.1, 0.65, 1.1]} />
              <meshStandardMaterial color="#CBD5E1" metalness={0.92} roughness={0.18} />
            </mesh>
            {/* Staging Roller Infeed Table */}
            <mesh position={[-1.4, 0.82, 0]} castShadow>
              <boxGeometry args={[0.8, 0.14, 1.8]} />
              <meshStandardMaterial color="#1E293B" metalness={0.8} />
            </mesh>
          </group>

          {/* South Outfeed Station: Welded Assemblies Pickup Pad (z = +3.5) */}
          <group position={[0, 0, 3.5]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
              <planeGeometry args={[4.2, 5.5]} />
              <meshBasicMaterial color="#16A34A" />
            </mesh>
            {/* Welded Assemblies Pallet Stacks */}
            <mesh position={[0, 0.08, 0]} castShadow>
              <boxGeometry args={[1.4, 0.16, 1.4]} />
              <meshStandardMaterial color="#92400E" roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.5, 0]} castShadow>
              <boxGeometry args={[1.1, 0.75, 1.1]} />
              <meshStandardMaterial color="#94A3B8" metalness={0.85} roughness={0.25} />
            </mesh>
            {/* Staging Roller Outfeed Table */}
            <mesh position={[-1.4, 0.82, 0]} castShadow>
              <boxGeometry args={[0.8, 0.14, 1.8]} />
              <meshStandardMaterial color="#1E293B" metalness={0.8} />
            </mesh>
          </group>

          {/* Heavy Steel Protective Safety Bollards along Forklift Demarcation Line */}
          {[-8.0, -3.0, 0.0, 3.0, 8.0].map((bz, bi) => (
            <group key={bi} position={[-2.3, 0, bz]}>
              <mesh position={[0, 0.45, 0]} castShadow>
                <cylinderGeometry args={[0.09, 0.09, 0.9, 12]} />
                <meshStandardMaterial color="#EAB308" metalness={0.6} />
              </mesh>
              <mesh position={[0, 0.9, 0]}>
                <sphereGeometry args={[0.1, 8, 8]} />
                <meshStandardMaterial color="#0F172A" />
              </mesh>
            </group>
          ))}
        </group>

        {/* ── 4. MASTER SCADA TELEMETRY WORKSTATION (North Wall, shifted left to x = -4.0) ── */}
        <group position={[-4.0, 0, -8.2]}>
          <mesh position={[0, 1.1, 0]} castShadow>
            <boxGeometry args={[2.2, 2.2, 0.6]} />
            <meshStandardMaterial color="#1E293B" metalness={0.7} roughness={0.35} />
          </mesh>
          <group position={[0, 1.85, 0.32]} rotation={[-0.15, 0, 0]}>
            <mesh castShadow>
              <boxGeometry args={[1.8, 0.75, 0.08]} />
              <meshStandardMaterial color="#0F172A" />
            </mesh>
            <Html transform scale={0.06} position={[0, 0, 0.06]} className="pointer-events-none select-none">
              <div className="w-[195px] p-2 bg-slate-950/95 text-white font-mono text-[7.5px] rounded-lg border border-cyan-500 shadow-2xl space-y-1">
                <div className="font-extrabold text-cyan-400 border-b border-cyan-800 pb-0.5 flex justify-between items-center">
                  <span>ROBOTIC WELDING CELL</span>
                  <span className="text-[6.5px] px-1 py-0.2 bg-emerald-950 text-emerald-300 border border-emerald-500 rounded">
                    EAST LOGISTICS BAY
                  </span>
                </div>
                <div className="space-y-0.5 text-[7px]">
                  <div className="flex justify-between">
                    <span>FORKLIFT INTERFACE:</span>
                    <strong className="text-cyan-300">EAST TERMINAL ACTIVE</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>WELD ROBOTS:</span>
                    <strong className="text-emerald-400">4 / 4 SYNCHRONIZED</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>OUTFEED TO:</span>
                    <strong className="text-emerald-400">PACKAGING CELL</strong>
                  </div>
                </div>
              </div>
            </Html>
          </group>
        </group>
      </group>

      {/* ── 5. EXPANDED CELL SAFETY FLOOR (Spanning from West Walkway to East Logistics) ── */}
      <group position={[1.0, 0, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
          <planeGeometry args={[26.0, 20.0]} />
          <meshBasicMaterial color="#E2E8F0" />
        </mesh>
        {/* Yellow Safety Perimeter Warning Lines */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, -9.8]}>
          <planeGeometry args={[25.6, 0.12]} />
          <meshBasicMaterial color="#EAB308" />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 9.8]}>
          <planeGeometry args={[25.6, 0.12]} />
          <meshBasicMaterial color="#EAB308" />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-12.8, 0.004, 0]}>
          <planeGeometry args={[0.12, 19.5]} />
          <meshBasicMaterial color="#EAB308" />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[12.8, 0.004, 0]}>
          <planeGeometry args={[0.12, 19.5]} />
          <meshBasicMaterial color="#EAB308" />
        </mesh>
      </group>
    </group>
  );
};
