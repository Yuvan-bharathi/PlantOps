import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { Machine, TelemetryData } from '../../types';
import { Asset } from './GLBAsset';

const FACTORY_KIT = '/models/kenney-factory-kit';

interface PackagingCellInteriorProps {
  cx: number;
  cz: number;
  visible: boolean;
  machines?: Machine[];
  liveTelemetry?: Record<string, TelemetryData>;
  onSelectMachine?: (m: Machine) => void;
}

// Reusable single animated carton box
interface AnimatedBoxProps {
  progress: number;
  pathType: 'top' | 'mid' | 'bottom';
  boxId: string;
}

const AnimatedCartonBox: React.FC<AnimatedBoxProps> = ({ progress, pathType }) => {
  const groupRef = useRef<THREE.Group>(null);

  let x = 0;
  let z = 0;
  let rotY = 0;
  let isPacked = false;
  let opacity = 1.0;

  if (pathType === 'top') {
    const totalDist = 27.0;
    const currentDist = progress * totalDist;

    if (currentDist <= 17.0) {
      x = -7.5 + currentDist;
      z = -5.5;
      rotY = 0;
      isPacked = x >= 1.0;
    } else if (currentDist <= 22.5) {
      const dZ = currentDist - 17.0;
      x = 9.5;
      z = -5.5 + dZ;
      rotY = -Math.PI / 2;
      isPacked = true;
    } else {
      const dX = currentDist - 22.5;
      x = 9.5 + dX;
      z = 0.0;
      rotY = 0;
      isPacked = true;
      if (dX > 3.5) {
        opacity = Math.max(0, 1.0 - (dX - 3.5) / 1.0);
      }
    }
  } else if (pathType === 'mid') {
    const totalDist = 21.5;
    const currentDist = progress * totalDist;
    x = -7.5 + currentDist;
    z = 0.0;
    rotY = 0;
    isPacked = x >= 1.0;
    if (x > 13.0) {
      opacity = Math.max(0, 1.0 - (x - 13.0) / 1.0);
    }
  } else if (pathType === 'bottom') {
    const totalDist = 27.0;
    const currentDist = progress * totalDist;

    if (currentDist <= 17.0) {
      x = -7.5 + currentDist;
      z = 5.5;
      rotY = 0;
      isPacked = x >= 1.0;
    } else if (currentDist <= 22.5) {
      const dZ = currentDist - 17.0;
      x = 9.5;
      z = 5.5 - dZ;
      rotY = Math.PI / 2;
      isPacked = true;
    } else {
      const dX = currentDist - 22.5;
      x = 9.5 + dX;
      z = 0.0;
      rotY = 0;
      isPacked = true;
      if (dX > 3.5) {
        opacity = Math.max(0, 1.0 - (dX - 3.5) / 1.0);
      }
    }
  }

  const bobbing = Math.sin(progress * Math.PI * 18) * 0.006;

  return (
    <group
      ref={groupRef}
      position={[x, 1.16 + bobbing, z]}
      rotation={[0, rotY, 0]}
      visible={opacity > 0.05}
    >
      <mesh castShadow>
        <boxGeometry args={[0.92, 0.54, 0.76]} />
        <meshStandardMaterial
          color={isPacked ? '#D97706' : '#C2782A'}
          roughness={0.78}
          metalness={0.05}
          transparent={opacity < 0.99}
          opacity={opacity}
        />
      </mesh>

      {isPacked && (
        <mesh position={[0, 0.276, 0]}>
          <boxGeometry args={[0.93, 0.012, 0.1]} />
          <meshStandardMaterial
            color="#EAB308"
            roughness={0.4}
            metalness={0.2}
            transparent={opacity < 0.99}
            opacity={opacity}
          />
        </mesh>
      )}

      {isPacked && (
        <group position={[0.18, 0.278, 0.16]}>
          <mesh>
            <boxGeometry args={[0.34, 0.014, 0.24]} />
            <meshStandardMaterial color="#FFFFFF" roughness={0.9} transparent={opacity < 0.99} opacity={opacity} />
          </mesh>
          <mesh position={[0, 0.009, 0]}>
            <boxGeometry args={[0.26, 0.005, 0.12]} />
            <meshBasicMaterial color="#0F172A" transparent={opacity < 0.99} opacity={opacity} />
          </mesh>
        </group>
      )}
    </group>
  );
};

// Animated flowing conveyor belt surface
interface FlowingConveyorProps {
  length: number;
  width: number;
  direction: 'X+' | 'Z+' | 'Z-';
  position: [number, number, number];
}

const FlowingConveyorTrack: React.FC<FlowingConveyorProps> = ({
  length,
  width,
  direction,
  position,
}) => {
  const slatsGroupRef = useRef<THREE.Group>(null);
  const chevronsGroupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime * 2.2;
    const slatSpacing = 0.5;
    const offset = t % slatSpacing;

    if (slatsGroupRef.current) {
      if (direction === 'X+') {
        slatsGroupRef.current.position.x = offset;
      } else if (direction === 'Z+') {
        slatsGroupRef.current.position.z = offset;
      } else if (direction === 'Z-') {
        slatsGroupRef.current.position.z = -offset;
      }
    }

    if (chevronsGroupRef.current) {
      const chevronSpacing = 2.0;
      const cOffset = (t * 1.2) % chevronSpacing;
      if (direction === 'X+') {
        chevronsGroupRef.current.position.x = cOffset;
      } else if (direction === 'Z+') {
        chevronsGroupRef.current.position.z = cOffset;
      } else if (direction === 'Z-') {
        chevronsGroupRef.current.position.z = -cOffset;
      }
    }
  });

  const slatCount = Math.floor(length / 0.5) + 2;
  const chevronCount = Math.floor(length / 2.0) + 2;

  return (
    <group position={position}>
      <mesh position={[0, 0.82, 0]} castShadow receiveShadow>
        {direction === 'X+' ? (
          <boxGeometry args={[length, 0.14, width + 0.25]} />
        ) : (
          <boxGeometry args={[width + 0.25, 0.14, length]} />
        )}
        <meshStandardMaterial color="#1E293B" metalness={0.7} roughness={0.35} />
      </mesh>

      <mesh position={[0, 0.90, 0]}>
        {direction === 'X+' ? (
          <boxGeometry args={[length, 0.02, width]} />
        ) : (
          <boxGeometry args={[width, 0.02, length]} />
        )}
        <meshStandardMaterial color="#0B1120" roughness={0.92} />
      </mesh>

      <group ref={slatsGroupRef}>
        {Array.from({ length: slatCount }).map((_, i) => {
          const offsetPos = -length / 2 + i * 0.5;
          return (
            <mesh
              key={`slat-${i}`}
              position={direction === 'X+' ? [offsetPos, 0.915, 0] : [0, 0.915, offsetPos]}
            >
              {direction === 'X+' ? (
                <boxGeometry args={[0.08, 0.012, width * 0.95]} />
              ) : (
                <boxGeometry args={[width * 0.95, 0.012, 0.08]} />
              )}
              <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.4} />
            </mesh>
          );
        })}
      </group>

      <group ref={chevronsGroupRef}>
        {Array.from({ length: chevronCount }).map((_, ci) => {
          const cPos = -length / 2 + ci * 2.0;
          return (
            <group
              key={`chev-${ci}`}
              position={direction === 'X+' ? [cPos, 0.922, 0] : [0, 0.922, cPos]}
              rotation={[0, direction === 'X+' ? 0 : direction === 'Z+' ? -Math.PI / 2 : Math.PI / 2, 0]}
            >
              <mesh position={[-0.1, 0, -0.15]} rotation={[0, 0.6, 0]}>
                <boxGeometry args={[0.25, 0.005, 0.04]} />
                <meshBasicMaterial color="#38BDF8" transparent opacity={0.65} />
              </mesh>
              <mesh position={[-0.1, 0, 0.15]} rotation={[0, -0.6, 0]}>
                <boxGeometry args={[0.25, 0.005, 0.04]} />
                <meshBasicMaterial color="#38BDF8" transparent opacity={0.65} />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* Yellow Safety Rails */}
      {direction === 'X+' ? (
        <>
          <mesh position={[0, 0.96, -width / 2 - 0.06]}>
            <boxGeometry args={[length, 0.06, 0.04]} />
            <meshStandardMaterial color="#EAB308" metalness={0.5} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.96, width / 2 + 0.06]}>
            <boxGeometry args={[length, 0.06, 0.04]} />
            <meshStandardMaterial color="#EAB308" metalness={0.5} roughness={0.4} />
          </mesh>
        </>
      ) : (
        <>
          <mesh position={[-width / 2 - 0.06, 0.96, 0]}>
            <boxGeometry args={[0.04, 0.06, length]} />
            <meshStandardMaterial color="#EAB308" metalness={0.5} roughness={0.4} />
          </mesh>
          <mesh position={[width / 2 + 0.06, 0.96, 0]}>
            <boxGeometry args={[0.04, 0.06, length]} />
            <meshStandardMaterial color="#EAB308" metalness={0.5} roughness={0.4} />
          </mesh>
        </>
      )}

      {/* Support Legs */}
      {Array.from({ length: Math.max(2, Math.floor(length / 3.5)) }).map((_, li) => {
        const lx = -length / 2 + 1.2 + li * 3.4;
        return (
          <group key={`leg-${li}`} position={direction === 'X+' ? [lx, 0, 0] : [0, 0, lx]}>
            {[-width / 2 - 0.04, width / 2 + 0.04].map((sw, swi) => (
              <mesh key={swi} position={direction === 'X+' ? [0, 0.41, sw] : [sw, 0.41, 0]}>
                <cylinderGeometry args={[0.04, 0.04, 0.82, 8]} />
                <meshStandardMaterial color="#0F172A" metalness={0.8} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
};

/**
 * Packaging Cell Interior with Dedicated Forklift Infeed Bay & Expanded Working Floor
 */
export const PackagingCellInteriorDetail: React.FC<PackagingCellInteriorProps> = ({
  cx,
  cz,
  visible,
}) => {
  const speed = 0.082;
  const [clockTime, setClockTime] = React.useState(0);

  useFrame((state) => {
    setClockTime(state.clock.elapsedTime);
  });

  const line1Boxes = useMemo(() => [0.0, 0.25, 0.50, 0.75], []);
  const line2Boxes = useMemo(() => [0.08, 0.38, 0.68], []);
  const line3Boxes = useMemo(() => [0.12, 0.37, 0.62, 0.87], []);

  if (!visible) return null;

  const lineZOffsets = [-5.5, 0.0, 5.5];

  return (
    <group position={[cx, 0, cz]}>
      <group name="operationalGroup">
        {/* ── 1. THREE MAIN CONVEYOR LINES (Shifted eastward to x = +1.0 to give plenty of room for Forklift) ── */}
        {lineZOffsets.map((lz, idx) => (
          <FlowingConveyorTrack
            key={`main-line-${idx}`}
            length={16.0}
            width={0.95}
            direction="X+"
            position={[1.0, 0, lz]}
          />
        ))}

        {lineZOffsets.map((lz, idx) => (
          <React.Fragment key={`accents-${idx}`}>
            <Asset
              url={`${FACTORY_KIT}/conveyor-long.glb`}
              position={[-4.8, 0, lz]}
              scale={1.05}
              tint="#334155"
              tintStrength={0.5}
            />
            <Asset
              url={`${FACTORY_KIT}/conveyor-long.glb`}
              position={[6.8, 0, lz]}
              scale={1.05}
              tint="#334155"
              tintStrength={0.5}
            />
          </React.Fragment>
        ))}

        {/* ── 2. TRANSVERSE COLLECTOR CONVEYOR (At x = 9.5) ── */}
        <FlowingConveyorTrack
          length={6.0}
          width={0.95}
          direction="Z+"
          position={[9.5, 0, -2.75]}
        />
        <FlowingConveyorTrack
          length={6.0}
          width={0.95}
          direction="Z-"
          position={[9.5, 0, 2.75]}
        />

        <mesh position={[9.5, 0.905, 0]}>
          <boxGeometry args={[1.05, 0.025, 1.05]} />
          <meshStandardMaterial color="#1E293B" metalness={0.7} roughness={0.3} />
        </mesh>

        {/* ── 3. OUTBOUND MERGED CONVEYOR (Flowing +X into Goods Logistics Area) ── */}
        <FlowingConveyorTrack
          length={4.5}
          width={0.95}
          direction="X+"
          position={[12.25, 0, 0]}
        />

        {/* ── 4. DEDICATED FORKLIFT PACKAGING INFEED BAY (West Zone, x = -9.5) ── */}
        {/* Generous dedicated apron where Forklift drops off welded goods into packaging */}
        <group position={[-9.5, 0, 0]}>
          {/* Yellow Hazard Striped Demarcation Pad */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
            <planeGeometry args={[5.2, 14.0]} />
            <meshBasicMaterial color="#FEF08A" />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
            <planeGeometry args={[4.8, 13.6]} />
            <meshBasicMaterial color="#0F172A" />
          </mesh>

          {/* Staging Roller Infeed Table */}
          {[-5.5, 0, 5.5].map((pz, pi) => (
            <group key={pi} position={[1.5, 0, pz]}>
              <mesh position={[0, 0.85, 0]} castShadow>
                <boxGeometry args={[1.4, 0.15, 1.2]} />
                <meshStandardMaterial color="#1E293B" metalness={0.8} />
              </mesh>
            </group>
          ))}

          {/* Protective Steel Safety Bollards */}
          {[
            [-2.2, -6.5], [2.2, -6.5],
            [-2.2, 6.5],  [2.2, 6.5],
            [-2.2, 0.0],
          ].map(([bx, bz], bi) => (
            <group key={bi} position={[bx, 0, bz]}>
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

        {/* ── 5. LIVE ANIMATED CARTON BOXES ── */}
        {line1Boxes.map((offset, i) => {
          const progress = (clockTime * speed + offset) % 1.0;
          return <AnimatedCartonBox key={`box-l1-${i}`} progress={progress} pathType="top" boxId={`L1-B${i}`} />;
        })}
        {line2Boxes.map((offset, i) => {
          const progress = (clockTime * speed + offset) % 1.0;
          return <AnimatedCartonBox key={`box-l2-${i}`} progress={progress} pathType="mid" boxId={`L2-B${i}`} />;
        })}
        {line3Boxes.map((offset, i) => {
          const progress = (clockTime * speed + offset) % 1.0;
          return <AnimatedCartonBox key={`box-l3-${i}`} progress={progress} pathType="bottom" boxId={`L3-B${i}`} />;
        })}

        {/* ── 6. MASTER PACKAGING SCADA WORKSTATION (North Wall) ── */}
        <group position={[1.0, 0, -8.5]}>
          <Asset url={`${FACTORY_KIT}/screen-panel-wide.glb`} position={[0, 0, 0]} scale={1.2} tint="#1E293B" tintStrength={0.8} />
          <Html transform scale={0.065} position={[0, 1.85, 0.05]} className="pointer-events-none select-none">
            <div className="w-[190px] p-2.5 bg-slate-950/95 text-white font-mono text-[8px] rounded-lg border border-amber-500 shadow-2xl space-y-1">
              <div className="font-extrabold text-amber-400 border-b border-amber-800 pb-1 flex justify-between items-center">
                <span>PACKAGING CELL</span>
                <span className="text-[7px] px-1.5 py-0.2 bg-emerald-950 text-emerald-300 border border-emerald-500/50 rounded">FORKLIFT DOCK READY</span>
              </div>
              <div className="space-y-0.8 text-[7.5px] pt-0.5">
                <div className="flex justify-between"><span>WEST RECEPTION:</span><strong className="text-cyan-300">AUTOMATED DOCK OPEN</strong></div>
                <div className="flex justify-between"><span>ACTIVE LINES:</span><strong className="text-emerald-400">3 / 3 RUNNING</strong></div>
                <div className="flex justify-between"><span>OUTFEED TO:</span><strong className="text-amber-300">SHIPPING & LOGISTICS</strong></div>
              </div>
            </div>
          </Html>
        </group>
      </group>

      {/* ── 7. EXPANDED CLEAN EPOXY SAFETY FLOOR ── */}
      <group>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
          <planeGeometry args={[26.0, 19.0]} />
          <meshBasicMaterial color="#E2E8F0" />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, -9.2]}>
          <planeGeometry args={[25.5, 0.1]} />
          <meshBasicMaterial color="#EAB308" />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 9.2]}>
          <planeGeometry args={[25.5, 0.1]} />
          <meshBasicMaterial color="#EAB308" />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-12.8, 0.004, 0]}>
          <planeGeometry args={[0.1, 18.5]} />
          <meshBasicMaterial color="#EAB308" />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[12.8, 0.004, 0]}>
          <planeGeometry args={[0.1, 18.5]} />
          <meshBasicMaterial color="#EAB308" />
        </mesh>
      </group>
    </group>
  );
};
