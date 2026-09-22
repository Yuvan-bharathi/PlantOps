import React from 'react';
import { ZoneId } from './zoneData';

// ─────────────────────────────────────────────────────────────────────────────
// Section Building Shell — a real low-poly industrial building (opaque walls,
// pitched-look roof, roller door + glass entrance, windows, roof HVAC/vents,
// and a few kind-specific details) representing each zone at Plant Overview.
// Unmounts outright once the user enters ANY building so the campus fully
// steps aside for the isolated interior — no dimming, no raycasting risk.
// ─────────────────────────────────────────────────────────────────────────────
interface SectionBuildingShellProps {
  cx: number;
  cz: number;
  hw: number;
  hd: number;
  badgeColor: string;
  kind: ZoneId;
  plantLevel: boolean; // viewLevel === 'PLANT'
  /** Which wall faces the central street and gets the entrance. */
  doorSide: 'north' | 'south';
  onClick: () => void;
}

const WALL_H = 9;
const WALL_COLOR = '#D9D6CE';
const WALL_COLOR_B = '#C7C4BB';
const ROOF_COLOR = '#9CA6AD';
const WINDOW_COLOR = '#A9CBEA';
const OPACITY = 0.98;

const HVACUnit: React.FC<{ position: [number, number, number]; scale?: number }> = ({ position, scale = 1 }) => (
  <group position={position} scale={scale}>
    <mesh castShadow>
      <boxGeometry args={[1.1, 0.6, 0.9]} />
      <meshStandardMaterial color="#94A3B8" metalness={0.5} roughness={0.5} />
    </mesh>
    <mesh position={[0, 0.42, 0]}>
      <cylinderGeometry args={[0.32, 0.32, 0.12, 12]} />
      <meshStandardMaterial color="#64748B" metalness={0.6} roughness={0.4} />
    </mesh>
  </group>
);

const RoofVent: React.FC<{ position: [number, number, number] }> = ({ position }) => (
  <group position={position}>
    <mesh><cylinderGeometry args={[0.22, 0.22, 0.9, 10]} /><meshStandardMaterial color="#78716C" metalness={0.5} roughness={0.5} /></mesh>
    <mesh position={[0, 0.55, 0]}><coneGeometry args={[0.3, 0.3, 10]} /><meshStandardMaterial color="#57534E" metalness={0.4} roughness={0.6} /></mesh>
  </group>
);

export const SectionBuildingShell: React.FC<SectionBuildingShellProps> = ({
  cx, cz, hw, hd, badgeColor, kind, plantLevel, doorSide, onClick,
}) => {
  if (!plantLevel) return null;

  const w = hw * 2;
  const d = hd * 2;
  // Wide roller door for large production halls, narrower for the smaller bay.
  const doorGap = kind === 'MACHINING' || kind === 'ASSEMBLY' ? 5.2 : kind === 'MAINTENANCE' ? 3.0 : 4.2;
  const halfDoor = doorGap / 2;
  // +1 => entrance wall sits at local +z (south); -1 => at local -z (north).
  const dz = doorSide === 'south' ? 1 : -1;
  const entranceZ = dz * (hd + 0.05);

  return (
    <group position={[cx, 0, cz]} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      {/* Entrance wall (faces the central street) — split around the roller door */}
      <mesh position={[-(hw + halfDoor) / 2, WALL_H / 2, dz * hd]}>
        <boxGeometry args={[hw - halfDoor, WALL_H, 0.3]} />
        <meshStandardMaterial color={WALL_COLOR} opacity={OPACITY} transparent roughness={0.85} />
      </mesh>
      <mesh position={[(hw + halfDoor) / 2, WALL_H / 2, dz * hd]}>
        <boxGeometry args={[hw - halfDoor, WALL_H, 0.3]} />
        <meshStandardMaterial color={WALL_COLOR} opacity={OPACITY} transparent roughness={0.85} />
      </mesh>
      {/* Roller door filling the gap, with horizontal ridge lines */}
      <mesh position={[0, 2.4, dz * (hd - 0.02)]}>
        <boxGeometry args={[doorGap - 0.6, 4.6, 0.12]} />
        <meshStandardMaterial color="#7C8591" metalness={0.4} roughness={0.5} />
      </mesh>
      {[0.9, 1.7, 2.5, 3.3, 4.1].map((y, i) => (
        <mesh key={i} position={[0, y, dz * (hd - 0.08)]}>
          <boxGeometry args={[doorGap - 0.7, 0.05, 0.06]} />
          <meshStandardMaterial color="#5B6472" metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
      {/* Small glass personnel entrance beside the roller door */}
      <mesh position={[halfDoor + 1.1, 1.4, dz * (hd - 0.02)]}>
        <boxGeometry args={[1.3, 2.6, 0.1]} />
        <meshStandardMaterial color={WINDOW_COLOR} transparent opacity={0.6} emissive={WINDOW_COLOR} emissiveIntensity={0.15} />
      </mesh>
      {/* Canopy over the entrance for production/dispatch buildings */}
      {(kind === 'PACKAGING' || kind === 'ASSEMBLY') && (
        <mesh position={[0, WALL_H - 0.6, dz * (hd + 1.1)]}>
          <boxGeometry args={[doorGap + 2, 0.15, 2.2]} />
          <meshStandardMaterial color={ROOF_COLOR} metalness={0.3} roughness={0.6} />
        </mesh>
      )}
      {/* Loading dock platform for Packaging */}
      {kind === 'PACKAGING' && (
        <mesh position={[0, 0.4, dz * (hd + 1.6)]}>
          <boxGeometry args={[doorGap + 1, 0.8, 1.6]} />
          <meshStandardMaterial color="#8B8983" roughness={0.9} />
        </mesh>
      )}

      {/* Rear wall (solid) */}
      <mesh position={[0, WALL_H / 2, -dz * hd]}>
        <boxGeometry args={[w, WALL_H, 0.3]} />
        <meshStandardMaterial color={WALL_COLOR_B} opacity={OPACITY} transparent roughness={0.85} />
      </mesh>
      {/* East / West walls */}
      <mesh position={[-hw, WALL_H / 2, 0]}>
        <boxGeometry args={[0.3, WALL_H, d]} />
        <meshStandardMaterial color={WALL_COLOR_B} opacity={OPACITY} transparent roughness={0.85} />
      </mesh>
      <mesh position={[hw, WALL_H / 2, 0]}>
        <boxGeometry args={[0.3, WALL_H, d]} />
        <meshStandardMaterial color={WALL_COLOR_B} opacity={OPACITY} transparent roughness={0.85} />
      </mesh>

      {/* Base course / plinth */}
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[w + 0.2, 0.7, d + 0.2]} />
        <meshStandardMaterial color="#8B8983" roughness={0.9} />
      </mesh>

      {/* Corner columns / pilasters for structural read */}
      {[[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]].map(([cxo, czo], i) => (
        <mesh key={`col-${i}`} position={[cxo, WALL_H / 2, czo]}>
          <boxGeometry args={[0.55, WALL_H, 0.55]} />
          <meshStandardMaterial color="#B0ADA5" roughness={0.7} />
        </mesh>
      ))}

      {/* Roof parapet trim (raised lip tracing the roof edge) */}
      <mesh position={[0, WALL_H + 0.55, -hd]}><boxGeometry args={[w + 0.7, 0.7, 0.15]} /><meshStandardMaterial color={ROOF_COLOR} roughness={0.6} /></mesh>
      <mesh position={[0, WALL_H + 0.55, hd]}><boxGeometry args={[w + 0.7, 0.7, 0.15]} /><meshStandardMaterial color={ROOF_COLOR} roughness={0.6} /></mesh>
      <mesh position={[-hw, WALL_H + 0.55, 0]}><boxGeometry args={[0.15, 0.7, d + 0.7]} /><meshStandardMaterial color={ROOF_COLOR} roughness={0.6} /></mesh>
      <mesh position={[hw, WALL_H + 0.55, 0]}><boxGeometry args={[0.15, 0.7, d + 0.7]} /><meshStandardMaterial color={ROOF_COLOR} roughness={0.6} /></mesh>

      {/* Roof (slightly overhanging parapet) */}
      <mesh position={[0, WALL_H, 0]}>
        <boxGeometry args={[w + 0.7, 0.4, d + 0.7]} />
        <meshStandardMaterial color={ROOF_COLOR} opacity={OPACITY} transparent roughness={0.7} metalness={0.15} />
      </mesh>
      <HVACUnit position={[-hw * 0.35, WALL_H + 0.5, -hd * 0.25]} scale={kind === 'MACHINING' ? 1.3 : 1} />
      <HVACUnit position={[hw * 0.3, WALL_H + 0.4, hd * 0.2]} scale={0.85} />
      <RoofVent position={[hw * 0.05, WALL_H + 0.55, -hd * 0.4]} />
      {kind === 'MACHINING' && <RoofVent position={[-hw * 0.5, WALL_H + 0.55, hd * 0.3]} />}

      {/* Windows along the long east/west walls */}
      {[-hd * 0.55, -hd * 0.18, hd * 0.18, hd * 0.55].map((wz, i) => (
        <React.Fragment key={`win-${i}`}>
          <mesh position={[-hw - 0.02, WALL_H * 0.6, wz]}>
            <boxGeometry args={[0.06, 1.5, 1.4]} />
            <meshStandardMaterial color={WINDOW_COLOR} transparent opacity={0.65} emissive={WINDOW_COLOR} emissiveIntensity={0.25} />
          </mesh>
          <mesh position={[hw + 0.02, WALL_H * 0.6, wz]}>
            <boxGeometry args={[0.06, 1.5, 1.4]} />
            <meshStandardMaterial color={WINDOW_COLOR} transparent opacity={0.65} emissive={WINDOW_COLOR} emissiveIntensity={0.25} />
          </mesh>
        </React.Fragment>
      ))}
      {/* Extra glazing band for the Robot Cell's more "modern automation facility" look */}
      {kind === 'ROBOT' && [-hd * 0.35, 0, hd * 0.35].map((wz, i) => (
        <React.Fragment key={`win-lo-${i}`}>
          <mesh position={[-hw - 0.02, WALL_H * 0.3, wz]}>
            <boxGeometry args={[0.06, 1.0, 1.2]} />
            <meshStandardMaterial color={WINDOW_COLOR} transparent opacity={0.6} emissive={WINDOW_COLOR} emissiveIntensity={0.2} />
          </mesh>
          <mesh position={[hw + 0.02, WALL_H * 0.3, wz]}>
            <boxGeometry args={[0.06, 1.0, 1.2]} />
            <meshStandardMaterial color={WINDOW_COLOR} transparent opacity={0.6} emissive={WINDOW_COLOR} emissiveIntensity={0.2} />
          </mesh>
        </React.Fragment>
      ))}

      {/* Small external process tanks + pipe on the rear wall for Processing */}
      {kind === 'PROCESSING' && (
        <group position={[hw * 0.55, 0, -dz * (hd + 0.9)]}>
          <mesh position={[0, 1.6, 0]} castShadow>
            <cylinderGeometry args={[0.55, 0.55, 3.2, 14]} />
            <meshStandardMaterial color="#B8C4CC" metalness={0.6} roughness={0.35} />
          </mesh>
          <mesh position={[1.3, 1.1, 0]} castShadow>
            <cylinderGeometry args={[0.4, 0.4, 2.2, 12]} />
            <meshStandardMaterial color="#B8C4CC" metalness={0.6} roughness={0.35} />
          </mesh>
          <mesh position={[0.65, 2.8, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.08, 0.08, 1.4, 8]} />
            <meshStandardMaterial color="#64748B" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      )}

      {/* Small lean-to tool shed for Maintenance */}
      {kind === 'MAINTENANCE' && (
        <mesh position={[-hw - 1.1, 1.2, 0]} castShadow>
          <boxGeometry args={[1.8, 2.4, 3.2]} />
          <meshStandardMaterial color="#C7C4BB" roughness={0.9} />
        </mesh>
      )}

      {/* Signage band above the entrance, in the zone accent color */}
      <mesh position={[0, WALL_H - 1, entranceZ]}>
        <boxGeometry args={[Math.min(w * 0.65, hw + 2), 1.1, 0.12]} />
        <meshStandardMaterial color={badgeColor} emissive={badgeColor} emissiveIntensity={0.2} />
      </mesh>

      {/* Entrance lamps flanking the roller door */}
      <mesh position={[-halfDoor - 0.5, 1.6, entranceZ]}>
        <sphereGeometry args={[0.18, 10, 10]} />
        <meshStandardMaterial color={badgeColor} emissive={badgeColor} emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[halfDoor + 1.9, 1.6, entranceZ]}>
        <sphereGeometry args={[0.18, 10, 10]} />
        <meshStandardMaterial color={badgeColor} emissive={badgeColor} emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
};
