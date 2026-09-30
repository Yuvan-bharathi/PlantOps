import React from 'react';
import { ZoneId } from './zoneData';
import { Asset } from './GLBAsset';

// ─────────────────────────────────────────────────────────────────────────────
// Real modeled GLB buildings for all six Plant Overview sections — the
// asset-pipeline rollout that followed the Processing Cell pilot. Each zone
// gets its own Kenney "City Kit Industrial" building (CC0 — see
// public/models/ASSET_MANIFEST.md), sized from that model's real measured
// bounding box (not guessed) to fill roughly 78% of the zone's width and 72%
// of its depth, so every building is a real modeled shell that fits inside
// the existing road-separated campus grid without touching a neighbor.
//
// Only the exterior visual layer changes. Interiors, machine meshes,
// telemetry, LOTO/work-order/technician logic and camera presets are
// completely untouched — this file only replaces what SectionBuildingShell
// used to draw with primitives.
// ─────────────────────────────────────────────────────────────────────────────

const CITY_KIT = '/models/kenney-city-kit-industrial';

interface PropPlacement {
  url: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale: number;
}

interface BuildingConfig {
  /** File in CITY_KIT. */
  model: string;
  /** [x, y, z] scale. */
  scale: [number, number, number];
  /** The model's native local-space center (average of bbox min/max, XZ only, BEFORE scale). */
  centerOffset: [number, number];
  /** Optional rotation in radians [x, y, z]. Defaults to [0, Math.PI, 0] to face front gate. */
  rotation?: [number, number, number];
  /** Optional accessory models (tanks, chimneys, ...). */
  props?: PropPlacement[];
  /** Subtle per-zone material tint. */
  tint: string;
}

// Bounding boxes below were measured directly from each GLB's glTF accessor
// min/max (not eyeballed) before choosing these scale/offset values.
export const BUILDING_CONFIGS: Record<ZoneId, BuildingConfig> = {
  MACHINING: {
    // building-a native 2.084×1.47×1.242, centered. Zone hw=13,hd=10.5.
    model: 'building-a.glb',
    scale: [12.20, 16.50, 12.20],
    centerOffset: [0, 0],
    rotation: [0, Math.PI, 0],
    tint: '#B8C4D0', // cool blue-gray
    props: [
      { url: `${CITY_KIT}/detail-tank.glb`, position: [0, 0, -8.6], scale: 1.5 },
    ],
  },
  ROBOT: {
    // building-e native 1.684×1.65×1.29, center offset z=+0.245. Zone hw=10,hd=10.5.
    model: 'building-e.glb',
    scale: [11.60, 15.80, 11.60],
    centerOffset: [0, 0.245],
    rotation: [0, Math.PI, 0],
    tint: '#A9C4C2', // blue/teal-gray
  },
  PROCESSING: {
    // building-t native 1.722×1.015×1.39, centered. Zone hw=12,hd=10.5.
    model: 'building-t.glb',
    scale: [13.60, 18.20, 13.60],
    centerOffset: [0, 0],
    rotation: [0, Math.PI, 0],
    tint: '#D6CBBA', // warm beige-gray
    props: [
      { url: `${CITY_KIT}/detail-tank-large.glb`, position: [11.2, 0, -4.5], scale: 1.4 },
      { url: `${CITY_KIT}/detail-tank-large.glb`, position: [11.2, 0, 3.5], scale: 1.4 },
      { url: `${CITY_KIT}/detail-tank.glb`, position: [11.2, 0, -0.5], rotation: [0, Math.PI / 2, 0], scale: 1.6 },
      { url: `${CITY_KIT}/chimney-large.glb`, position: [-11.2, 0, -3.5], scale: 1.1 },
      { url: `${CITY_KIT}/chimney-medium.glb`, position: [-11.2, 0, 2.5], scale: 1.0 },
    ],
  },
  ASSEMBLY: {
    // building-r native 2.484×1.393×1.272, centered. Zone hw=12,hd=10.
    model: 'building-r.glb',
    scale: [9.50, 13.80, 9.50],
    centerOffset: [0, 0],
    rotation: [0, Math.PI, 0],
    tint: '#BFC6CE', // neutral blue-gray
    props: [
      { url: `${CITY_KIT}/detail-tank.glb`, position: [0, 0, -7.2], scale: 1.5 },
    ],
  },
  PACKAGING: {
    // building-q native 2.14×0.88×1.77, center offset x=-0.23, z=+0.015. Zone hw=9.5,hd=10.
    model: 'building-q.glb',
    scale: [8.80, 13.50, 8.80],
    centerOffset: [-0.23, 0.015],
    rotation: [0, Math.PI, 0],
    tint: '#D2CAC0', // warm gray
    props: [
      { url: `${CITY_KIT}/chimney-medium.glb`, position: [0, 0, -8.4], scale: 1.2 },
    ],
  },
  MAINTENANCE: {
    // building-c native 1.876×1.250×2.108, center offset x=0.096, z=0.143. Zone hw=11.5,hd=10.
    // Heavy Industrial Maintenance Workshop with dual bay roll-up doors facing front gate
    model: 'building-c.glb',
    scale: [11.60, 16.20, 9.60],
    centerOffset: [0.096, 0.143],
    rotation: [0, Math.PI, 0],
    tint: '#C4BCCB', // slightly purple-gray
    props: [
      { url: `${CITY_KIT}/detail-tank.glb`, position: [8.8, 0, 0], scale: 1.6 },
    ],
  },
};

interface IndustrialBuildingExteriorProps {
  zoneId: ZoneId;
  cx: number;
  cz: number;
  plantLevel: boolean;
  onClick: () => void;
}

/** Drop-in replacement for <SectionBuildingShell ...> — same visibility rule
 * (unmounts entirely once the user enters any building) and the same
 * group-level onClick-to-enter contract, for all six zones. */
export const IndustrialBuildingExterior: React.FC<IndustrialBuildingExteriorProps> = ({
  zoneId, cx, cz, plantLevel, onClick,
}) => {
  if (!plantLevel) return null;
  const cfg = BUILDING_CONFIGS[zoneId];
  if (!cfg) return null;

  const [offX, offZ] = cfg.centerOffset;
  const [sx, , sz] = cfg.scale;
  const rotY = cfg.rotation ? cfg.rotation[1] : Math.PI;

  // When rotated by Math.PI around Y, the native offset vector (-offX, -offZ) rotates by 180 deg to (offX, offZ)
  const posX = rotY === Math.PI ? offX * sx : -offX * sx;
  const posZ = rotY === Math.PI ? offZ * sz : -offZ * sz;

  return (
    <group position={[cx, 0, cz]} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      <Asset
        url={`${CITY_KIT}/${cfg.model}`}
        position={[posX, 0, posZ]}
        rotation={cfg.rotation || [0, Math.PI, 0]}
        scale={cfg.scale}
        tint={cfg.tint}
      />
      {cfg.props?.map((p, i) => (
        <Asset key={i} url={p.url} position={p.position} rotation={p.rotation} scale={p.scale} />
      ))}
    </group>
  );
};

interface ProcessingCellInteriorDetailProps {
  cx: number;
  cz: number;
  visible: boolean;
}

const FACTORY_KIT = '/models/kenney-factory-kit';

/** Purely decorative interior set-dressing (pipes/catwalk/hopper) for
 * Processing only — placed along the back wall, clear of the machine
 * cluster and the entrance. Renders only once truly inside Processing. The
 * other five interiors are untouched for now (existing machine meshes only). */
export const ProcessingCellInteriorDetail: React.FC<ProcessingCellInteriorDetailProps> = ({ cx, cz, visible }) => {
  if (!visible) return null;

  return (
    <group position={[cx, 0, cz]}>
      <Asset url={`${FACTORY_KIT}/pipe-large-long.glb`} position={[-4, 0, -9]} scale={2.2} />
      <Asset url={`${FACTORY_KIT}/pipe-large-bend.glb`} position={[-8, 0, -9]} scale={2.2} />
      <Asset url={`${FACTORY_KIT}/pipe-large-valve.glb`} position={[0, 0, -9]} scale={2.2} />
      <Asset url={`${FACTORY_KIT}/hopper-high-round.glb`} position={[6, 0, -9]} scale={2.5} />
      <Asset url={`${FACTORY_KIT}/catwalk-straight.glb`} position={[-4, 2.6, -9]} scale={2.2} />
      <Asset url={`${FACTORY_KIT}/catwalk-stairs.glb`} position={[-8, 0, -7.5]} rotation={[0, Math.PI, 0]} scale={2.2} />
    </group>
  );
};

