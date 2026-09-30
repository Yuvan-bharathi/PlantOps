import React from 'react';
import * as THREE from 'three';
import { Machine, TelemetryData } from '../../types';

interface ProcessingCellInteriorProps {
  cx: number;
  cz: number;
  visible: boolean;
  machines?: Machine[];
  liveTelemetry?: Record<string, TelemetryData>;
  onSelectMachine?: (m: Machine) => void;
}

/**
 * Processing Cell Interior
 * (Primary 5 assets MIXER-01, PUMP-01, PRESS-01, PROCESS-01, PROCESS-02 are rendered authoritatively by FactoryCanvas)
 */
export const ProcessingCellInteriorDetail: React.FC<ProcessingCellInteriorProps> = ({
  cx,
  cz,
  visible,
}) => {
  if (!visible) return null;

  return (
    <group position={[cx, 0, cz]}>
      {/* Clean Safety Floor Boundary */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <planeGeometry args={[18.0, 12.0]} />
        <meshBasicMaterial color="#E2E8F0" />
      </mesh>
    </group>
  );
};
