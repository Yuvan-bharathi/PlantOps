import React from 'react';
import * as THREE from 'three';
import { Machine, TelemetryData } from '../../types';

interface AssemblyCellInteriorProps {
  cx: number;
  cz: number;
  visible: boolean;
  machines?: Machine[];
  liveTelemetry?: Record<string, TelemetryData>;
  onSelectMachine?: (m: Machine) => void;
}

/**
 * Assembly Cell Interior — Pure Connecting Line Infrastructure
 * (Primary 4 workstations ASMB-01 to ASMB-04 are rendered authoritatively by FactoryCanvas)
 */
export const AssemblyCellInteriorDetail: React.FC<AssemblyCellInteriorProps> = ({
  cx,
  cz,
  visible,
}) => {
  if (!visible) return null;

  return (
    <group position={[cx, 0, cz]}>
      <group name="operationalGroup">
        {/* ── 1. CENTRAL TRANSFER ASSEMBLY CONVEYOR ── */}
        <group position={[0, 0, 0]}>
          <mesh position={[0, 0.85, 0]} castShadow receiveShadow>
            <boxGeometry args={[15.0, 0.12, 0.9]} />
            <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.92, 0]}>
            <boxGeometry args={[14.95, 0.02, 0.75]} />
            <meshStandardMaterial color="#0F172A" roughness={0.9} />
          </mesh>
          {[-6.0, -2.0, 2.0, 6.0].map((lx, li) => (
            <group key={li} position={[lx, 0, 0]}>
              {[-0.35, 0.35].map((lz, lzi) => (
                <mesh key={lzi} position={[0, 0.42, lz]}>
                  <boxGeometry args={[0.06, 0.84, 0.06]} />
                  <meshStandardMaterial color="#1E293B" metalness={0.8} />
                </mesh>
              ))}
            </group>
          ))}
          {/* Work-in-Progress Assembly Parts on Conveyor */}
          {[-4.5, -1.5, 1.5, 4.5].map((ax, ai) => (
            <mesh key={ai} position={[ax, 1.02, 0]} castShadow>
              <cylinderGeometry args={[0.15, 0.15, 0.18, 10]} />
              <meshStandardMaterial color="#F59E0B" metalness={0.8} />
            </mesh>
          ))}
        </group>
      </group>

      {/* Safety Floor Perimeter */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <planeGeometry args={[18.0, 10.0]} />
        <meshBasicMaterial color="#E2E8F0" />
      </mesh>
    </group>
  );
};
