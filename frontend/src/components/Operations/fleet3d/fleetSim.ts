// Distance-based road-following simulation. Runs outside React (driven by requestAnimationFrame).

export type VehicleStatus = 'AT_PLANT' | 'DEPARTING' | 'IN_TRANSIT' | 'ARRIVING' | 'DELIVERED' | 'RETURNING';

export const SIM_TIME_SCALE = 6; // simulated seconds per real second
export const PARK_HEADING = 0;
const DELIVERY_DWELL_S = 4.5;

export interface RoadRoute {
  coords: [number, number][];
  cum: number[]; // cumulative metres at each vertex
  total: number;
}

export interface SimVehicle {
  id: string;
  status: VehicleStatus;
  dist: number; // metres along current route
  speed: number; // real-world m/s
  cruise: number;
  heading: number;
  lng: number;
  lat: number;
  fuel: number;
  dwell: number;
  sideOffset: number;
  parkSlot: number;
}

export type SimEvent = 'delivered' | 'returned' | 'status';

const toRad = Math.PI / 180;

function segMetres(a: [number, number], b: [number, number]) {
  const dx = (b[0] - a[0]) * Math.cos(((a[1] + b[1]) / 2) * toRad) * 111320;
  const dy = (b[1] - a[1]) * 110540;
  return Math.hypot(dx, dy);
}

export function bearing(a: [number, number], b: [number, number]) {
  const dx = (b[0] - a[0]) * Math.cos(((a[1] + b[1]) / 2) * toRad);
  const dy = b[1] - a[1];
  return ((Math.atan2(dx, dy) / toRad) + 360) % 360;
}

export function angleDiff(a: number, b: number) {
  return ((b - a + 540) % 360) - 180;
}

export function lerpAngle(a: number, b: number, t: number) {
  return (a + angleDiff(a, b) * t + 360) % 360;
}

export function buildRoute(raw: [number, number][]): RoadRoute {
  const coords: [number, number][] = [];
  for (const c of raw) {
    const prev = coords[coords.length - 1];
    if (!prev || segMetres(prev, c) > 0.3) coords.push(c);
  }
  if (coords.length === 1) coords.push(coords[0]);
  const cum = [0];
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + segMetres(coords[i - 1], coords[i]));
  return { coords, cum, total: cum[cum.length - 1] || 1 };
}

// Gentle curve used until the Directions API responds (or if it's unreachable)
export function fallbackRoute(from: [number, number], to: [number, number], seed = 0): [number, number][] {
  const steps = 150;
  const midLng = (from[0] + to[0]) / 2 + (seed % 2 === 0 ? 0.02 : -0.02);
  const midLat = (from[1] + to[1]) / 2 + (seed % 3 === 0 ? 0.015 : -0.015);
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push([
      (1 - t) ** 2 * from[0] + 2 * (1 - t) * t * midLng + t ** 2 * to[0],
      (1 - t) ** 2 * from[1] + 2 * (1 - t) * t * midLat + t ** 2 * to[1],
    ]);
  }
  return pts;
}

export function indexAt(route: RoadRoute, d: number) {
  const { cum } = route;
  let lo = 0;
  let hi = cum.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= d) lo = mid;
    else hi = mid;
  }
  return lo;
}

export function pointAt(route: RoadRoute, d: number): [number, number] {
  const dist = Math.max(0, Math.min(route.total, d));
  const i = indexAt(route, dist);
  const a = route.coords[i];
  const b = route.coords[Math.min(i + 1, route.coords.length - 1)];
  const len = route.cum[i + 1] - route.cum[i] || 1;
  const f = Math.min(1, (dist - route.cum[i]) / len);
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}

export function headingAt(route: RoadRoute, d: number) {
  const a = pointAt(route, Math.min(d, route.total - 12));
  const b = pointAt(route, Math.min(d + 12, route.total));
  return bearing(a, b);
}

export function isMoving(s: VehicleStatus) {
  return s === 'DEPARTING' || s === 'IN_TRANSIT' || s === 'ARRIVING' || s === 'RETURNING';
}

/** Server-side dispatch timeline (fleet_dispatches) that drives a truck on the map. */
export interface MissionTimeline {
  dispatchedAtMs: number;
  outboundSeconds: number;
  unloadSeconds: number;
  returnSeconds: number;
}

/**
 * Positions a truck from its mission timeline (server clock). With no mission it parks in its
 * plant bay. Returns the simulated seconds left on the current leg (for ETA).
 */
export function followMission(
  v: SimVehicle,
  mission: MissionTimeline | null,
  out: RoadRoute | null,
  back: RoadRoute | null,
  parkPoint: [number, number],
  nowMs: number,
  dt: number
): number {
  const smooth = (rate: number) => 1 - Math.exp(-dt * rate);
  const park = () => {
    [v.lng, v.lat] = parkPoint;
    v.status = 'AT_PLANT';
    v.dist = 0;
    v.speed = 0;
    v.sideOffset += (parkedOffset(v.parkSlot) - v.sideOffset) * smooth(3);
    v.heading = lerpAngle(v.heading, PARK_HEADING, smooth(3));
    return 0;
  };
  if (!mission || !out || !back) return park();

  const t = Math.max(0, (nowMs - mission.dispatchedAtMs) / 1000);
  const o = mission.outboundSeconds;
  const u = mission.unloadSeconds;
  const r = mission.returnSeconds;
  if (t >= o + u + r) return park();

  v.sideOffset += (0 - v.sideOffset) * smooth(3);
  let route = out;
  let remaining = 0;
  if (t < o) {
    const f = t / o;
    v.status = f < 0.08 ? 'DEPARTING' : f < 0.92 ? 'IN_TRANSIT' : 'ARRIVING';
    v.dist = f * out.total;
    remaining = o - t;
  } else if (t < o + u) {
    v.status = 'DELIVERED';
    v.dist = out.total;
  } else {
    route = back;
    v.status = 'RETURNING';
    v.dist = ((t - o - u) / r) * back.total;
    remaining = o + u + r - t;
  }
  [v.lng, v.lat] = pointAt(route, v.dist);
  if (v.status !== 'DELIVERED') v.heading = lerpAngle(v.heading, headingAt(route, v.dist), smooth(9));
  // Displayed road speed: cruise with gentle variation, slower when pulling out / arriving
  const slow = v.status === 'DEPARTING' || v.status === 'ARRIVING' ? 0.55 : 1;
  v.speed = v.status === 'DELIVERED' ? 0 : v.cruise * slow * (0.92 + 0.08 * Math.sin(t / 7));
  v.fuel = Math.max(20, v.fuel - v.speed * dt * 0.00002);
  return remaining;
}

export function parkedOffset(slot: number) {
  return (slot - 1.5) * 9;
}

export function stepVehicle(v: SimVehicle, out: RoadRoute, back: RoadRoute, dt: number): SimEvent | null {
  const smooth = (rate: number) => 1 - Math.exp(-dt * rate);

  if (v.status === 'AT_PLANT') {
    const [lng, lat] = out.coords[0];
    v.lng = lng;
    v.lat = lat;
    v.speed = 0;
    v.sideOffset += (parkedOffset(v.parkSlot) - v.sideOffset) * smooth(3);
    v.heading = lerpAngle(v.heading, PARK_HEADING, smooth(3));
    return null;
  }

  // Staggered dispatch: wait in the bay until this truck's slot comes up
  if (v.status === 'DEPARTING' && v.dwell > 0) {
    v.dwell -= dt;
    return null;
  }

  v.sideOffset += (0 - v.sideOffset) * smooth(3);

  if (v.status === 'DELIVERED') {
    v.dwell -= dt;
    if (v.dwell > 0) return null;
    v.status = 'RETURNING';
    v.dist = 0;
    v.speed = 0;
    return 'status';
  }

  const route = v.status === 'RETURNING' ? back : out;
  const simDt = dt * SIM_TIME_SCALE;
  const remaining = route.total - v.dist;

  // Slow down for upcoming bends and for the final approach
  const turn = Math.abs(angleDiff(headingAt(route, v.dist), headingAt(route, v.dist + 40)));
  let target = v.cruise * (1 - Math.min(turn / 90, 1) * 0.6);
  if (remaining < 150) target = Math.min(target, Math.max(1.5, (v.cruise * remaining) / 150));
  const accel = target > v.speed ? 1.6 : 3.5;
  v.speed += Math.max(-accel * simDt, Math.min(accel * simDt, target - v.speed));

  const step = v.speed * simDt;
  v.dist = Math.min(route.total, v.dist + step);
  v.fuel = Math.max(8, v.fuel - (step / 1000) * 0.25);
  [v.lng, v.lat] = pointAt(route, v.dist);
  v.heading = lerpAngle(v.heading, headingAt(route, v.dist), smooth(9));

  const prev = v.status;
  if (v.status === 'RETURNING') {
    if (v.dist >= route.total) {
      v.status = 'AT_PLANT';
      v.dist = 0;
      v.speed = 0;
      return 'returned';
    }
    return null;
  }

  const progress = v.dist / route.total;
  if (progress >= 1) {
    v.status = 'DELIVERED';
    v.speed = 0;
    v.dwell = DELIVERY_DWELL_S;
    return 'delivered';
  }
  v.status = progress < 0.08 ? 'DEPARTING' : progress < 0.92 ? 'IN_TRANSIT' : 'ARRIVING';
  return v.status !== prev ? 'status' : null;
}
