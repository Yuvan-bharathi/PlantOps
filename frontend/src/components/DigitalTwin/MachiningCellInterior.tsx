import React from 'react';
import * as THREE from 'three';
import { Machine, TelemetryData } from '../../types';

interface MachiningCellInteriorProps {
  cx: number;
  cz: number;
  visible: boolean;
  machines?: Machine[];
  liveTelemetry?: Record<string, TelemetryData>;
  onSelectMachine?: (m: Machine) => void;
}

/**
 * Machining Cell Interior with Dedicated Forklift Logistics Bay & Spacious Floor Layout
 */
export const MachiningCellInteriorDetail: React.FC<MachiningCellInteriorProps> = ({
  cx,
  cz,
  visible,
}) => {
  if (!visible) return null;

  return (
    <group position={[cx, 0, cz]}>
      <group name="operationalGroup">
        {/* ── 1. RAW BILLET PALLET STAGING (West Aisle, x = -10.5) ── */}
        <group position={[-10.5, 0, 0]}>
          {[-3.5, 0.0, 3.5].map((pz, pi) => (
            <group key={pi} position={[0, 0, pz]}>
              <mesh position={[0, 0.08, 0]} castShadow>
                <boxGeometry args={[1.4, 0.16, 1.4]} />
                <meshStandardMaterial color="#92400E" roughness={0.9} />
              </mesh>
              {[-0.38, 0.38].map((bx, bi) => (
                <mesh key={bi} position={[bx, 0.38, 0]} castShadow>
                  <cylinderGeometry args={[0.22, 0.22, 0.5, 14]} />
                  <meshStandardMaterial color="#94A3B8" metalness={0.95} roughness={0.2} />
                </mesh>
              ))}
            </group>
          ))}
        </group>

        {/* ── 2. DEDICATED FORKLIFT LOGISTICS BAY (East Aisle, x = +9.5) ── */}
        {/* Generous open staging area where Forklift picks up Machined Parts without colliding with CNC machines */}
        <group position={[9.5, 0, 1.5]}>
          {/* Yellow/Black Diagonal Hazard Striped Staging Pad */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
            <planeGeometry args={[5.2, 5.8]} />
            <meshBasicMaterial color="#FEF08A" />
          </mesh>
          {/* Internal Staging Pad Area */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
            <planeGeometry args={[4.8, 5.4]} />
            <meshBasicMaterial color="#0F172A" />
          </mesh>

          {/* Staging Pallet 1: Finished Precision CNC Blocks */}
          <group position={[-1.2, 0, -1.2]}>
            <mesh position={[0, 0.08, 0]} castShadow>
              <boxGeometry args={[1.3, 0.16, 1.3]} />
              <meshStandardMaterial color="#92400E" roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.45, 0]} castShadow>
              <boxGeometry args={[1.0, 0.6, 1.0]} />
              <meshStandardMaterial color="#CBD5E1" metalness={0.92} roughness={0.15} />
            </mesh>
          </group>

          {/* Staging Pallet 2: Machined Turned Steel Cylinders */}
          <group position={[1.2, 0, -1.2]}>
            <mesh position={[0, 0.08, 0]} castShadow>
              <boxGeometry args={[1.3, 0.16, 1.3]} />
              <meshStandardMaterial color="#92400E" roughness={0.9} />
            </mesh>
            {[-0.32, 0.32].map((cx, ci) => (
              <mesh key={ci} position={[cx, 0.45, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
                <cylinderGeometry args={[0.16, 0.16, 0.8, 16]} />
                <meshStandardMaterial color="#E2E8F0" metalness={0.98} roughness={0.1} />
              </mesh>
            ))}
          </group>

          {/* Heavy Steel Protective Bollards around Forklift Bay */}
          {[
            [-2.4, -2.7], [2.4, -2.7],
            [-2.4, 2.7],  [2.4, 2.7],
          ].map(([bx, bz], bi) => (
            <group key={bi} position={[bx, 0, bz]}>
              <mesh position={[0, 0.45, 0]} castShadow>
                <cylinderGeometry args={[0.1, 0.1, 0.9, 12]} />
                <meshStandardMaterial color="#EAB308" metalness={0.6} roughness={0.3} />
              </mesh>
              <mesh position={[0, 0.9, 0]}>
                <sphereGeometry args={[0.11, 8, 8]} />
                <meshStandardMaterial color="#1E293B" />
              </mesh>
            </group>
          ))}
        </group>

        {/* ── 3. TOOLING STORAGE & OPERATOR CONSOLE (North-East Wall) ── */}
        <group position={[9.5, 0, -5.5]}>
          <mesh position={[0, 1.1, 0]} castShadow>
            <boxGeometry args={[1.2, 2.2, 2.0]} />
            <meshStandardMaterial color="#1E3A8A" metalness={0.7} />
          </mesh>
        </group>
      </group>

      {/* ── 4. EXPANDED CLEAN EPOXY SAFETY FLOOR ── */}
      <group>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
          <planeGeometry args={[25.0, 16.5]} />
          <meshBasicMaterial color="#E2E8F0" />
        </mesh>
        {/* Yellow Safety Perimeter Lines */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, -8.0]}>
          <planeGeometry args={[24.5, 0.12]} />
          <meshBasicMaterial color="#EAB308" />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 8.0]}>
          <planeGeometry args={[24.5, 0.12]} />
          <meshBasicMaterial color="#EAB308" />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-12.2, 0.004, 0]}>
          <planeGeometry args={[0.12, 16.0]} />
          <meshBasicMaterial color="#EAB308" />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[12.2, 0.004, 0]}>
          <planeGeometry args={[0.12, 16.0]} />
          <meshBasicMaterial color="#EAB308" />
        </mesh>
      </group>
    </group>
  );
};
