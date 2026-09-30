import mapboxgl from 'mapbox-gl';
import * as THREE from 'three';
import { applyTruckLighting, buildTruck, TruckLightPreset, TruckModel, TRUCK_HEIGHT_M, TRUCK_LENGTH_M } from './truckModel';

export const TRUCK_LAYER_ID = 'plantops-trucks-3d';

// Trucks are drawn at a roughly constant on-screen length so they stay readable at every zoom
const TARGET_SCREEN_PX = 150;
const MAX_EXAGGERATION = 80;
// Zoom from which trucks are depth-tested against the map (3D buildings appear around here)
const DEPTH_OCCLUSION_MIN_ZOOM = 15.5;

export interface TruckRenderState {
  id: string;
  lng: number;
  lat: number;
  heading: number; // degrees clockwise from north
  sideOffset: number; // model-space metres towards east (used to line up parked trucks)
  moving: boolean;
  selected: boolean;
  accent: string;
  ringColor: string;
}

export interface TruckScreenPos {
  labelX: number;
  labelY: number;
  x: number;
  y: number;
  visible: boolean;
  // Screen-space ends of the truck (front bumper / rear doors) for hit-testing
  fx: number;
  fy: number;
  rx: number;
  ry: number;
}

interface Options {
  models: Record<string, TruckModel>;
  getTrucks: () => TruckRenderState[];
  getLightPreset: () => TruckLightPreset;
  onProject: (id: string, pos: TruckScreenPos) => void;
}

// Mapbox custom 3D layer that renders the three.js trucks inside the map's own WebGL context,
// so they share the depth buffer with 3D buildings and move in lock-step with the camera.
export function createTruckLayer({ models, getTrucks, getLightPreset, onProject }: Options): mapboxgl.CustomLayerInterface {
  let map: mapboxgl.Map | null = null;
  let renderer: THREE.WebGLRenderer | null = null;
  const camera = new THREE.Camera();
  const mapMatrix = new THREE.Matrix4();
  const modelMatrix = new THREE.Matrix4();
  const scaleVec = new THREE.Vector3();
  const p = new THREE.Vector4();

  const project = (m: THREE.Matrix4, x: number, z: number, w: number, h: number, y = 0) => {
    p.set(x, y, z, 1).applyMatrix4(m);
    if (p.w <= 0) return null;
    return { x: ((p.x / p.w + 1) / 2) * w, y: ((1 - p.y / p.w) / 2) * h };
  };

  return {
    id: TRUCK_LAYER_ID,
    type: 'custom',
    renderingMode: '3d',
    onAdd(m: mapboxgl.Map, gl: WebGLRenderingContext) {
      map = m;
      renderer = new THREE.WebGLRenderer({ canvas: m.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
    },
    onRemove() {
      renderer?.dispose();
      renderer = null;
      map = null;
    },
    render(_gl: WebGLRenderingContext, matrix: number[]) {
      if (!map || !renderer) return;
      const canvas = map.getCanvas();
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const zoom = map.getZoom();
      const preset = getLightPreset();
      mapMatrix.fromArray(matrix);

      // Below street level the basemap leaves ground depth in the shared depth buffer, which made trucks
      // fail the depth test and vanish at mid zooms (~11–14). Start the trucks on a clean depth buffer
      // there; they still occlude themselves and each other correctly. Close up, keep the map's depth so
      // 3D buildings can realistically hide a truck behind them.
      if (zoom < DEPTH_OCCLUSION_MIN_ZOOM) {
        renderer.resetState();
        renderer.clearDepth();
      }

      for (const t of getTrucks()) {
        const model = (models[t.id] ||= buildTruck(t.id, t.accent));
        applyTruckLighting(model, preset);

        const merc = mapboxgl.MercatorCoordinate.fromLngLat([t.lng, t.lat], 0);
        // Correct spherical Mercator resolution formula for 512px Mapbox tiles
        const metresPerPx = (40075016.686 * Math.cos((t.lat * Math.PI) / 180)) / (512 * Math.pow(2, zoom));
        
        // Exact constant on-screen footprint (~78px): truck retains identical visible size at all zoom levels
        const TARGET_CONSTANT_PX = 78;
        const desiredScale = (TARGET_CONSTANT_PX * metresPerPx) / TRUCK_LENGTH_M;
        const exaggeration = Math.max(1, desiredScale);
        const u = merc.meterInMercatorCoordinateUnits() * exaggeration;

        // Lift above road plane to avoid clipping/z-fighting
        const elev = 0.35 * u;
        modelMatrix.makeTranslation(merc.x, merc.y, (merc.z ?? 0) + elev).scale(scaleVec.set(u, -u, u));
        camera.projectionMatrix.multiplyMatrices(mapMatrix, modelMatrix);
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

        // Keep truck locked on road center line
        const effectiveSideOffset = t.moving ? 0 : t.sideOffset / Math.max(1, exaggeration * 0.15);
        model.root.position.set(effectiveSideOffset, 0, 0);
        model.root.rotation.z = (-t.heading * Math.PI) / 180;
        model.beams.visible = preset === 'night' && t.moving;

        renderer.resetState();
        renderer.state.setCullFace(THREE.CullFaceNone);
        renderer.render(model.scene, camera);

        const label = project(camera.projectionMatrix, effectiveSideOffset, TRUCK_HEIGHT_M + 1.2, w, h);
        const centre = project(camera.projectionMatrix, effectiveSideOffset, 1.5, w, h);
        const sin = Math.sin((t.heading * Math.PI) / 180);
        const cos = Math.cos((t.heading * Math.PI) / 180);
        const front = project(camera.projectionMatrix, effectiveSideOffset + 8.4 * sin, 1.5, w, h, 8.4 * cos);
        const rear = project(camera.projectionMatrix, effectiveSideOffset - 8.1 * sin, 1.5, w, h, -8.1 * cos);
        onProject(t.id, {
          labelX: label?.x ?? 0,
          labelY: label?.y ?? 0,
          x: centre?.x ?? 0,
          y: centre?.y ?? 0,
          fx: front?.x ?? centre?.x ?? 0,
          fy: front?.y ?? centre?.y ?? 0,
          rx: rear?.x ?? centre?.x ?? 0,
          ry: rear?.y ?? centre?.y ?? 0,
          visible: !!label && !!centre,
        });
      }
    },
  } as mapboxgl.CustomLayerInterface;
}
