// Fleet data as served by GET /api/fleet/state, and where each truck appears on the plant site.

export interface FleetTruck {
  id: string;
  name: string;
  driverName: string;
  capacityPallets: number;
  capacityTonnes: number;
  status: string; // AVAILABLE | DISPATCHED | …
  loadedPallets: number;
  isReady: boolean;
  canDispatch: boolean;
  currentDispatchId?: string;
  lastReturnedAt?: string;
}

export interface FleetDispatch {
  id: string;
  truckId: string;
  driverName: string;
  destinationName: string;
  cargoName: string;
  palletCount: number;
  tonnage: number;
  palletIds: string[];
  distanceKm: number;
  status: string;
  outboundSeconds: number;
  unloadSeconds: number;
  returnSeconds: number;
  dispatchedAt: string;
  arrivedAt?: string;
  returnStartedAt?: string;
  returnedAt?: string;
}

export interface FleetState {
  serverTime: string;
  config: { freightThresholdPallets: number; palletTonnes: number };
  dock: {
    stagedPallets: { id: string; palletNumber: string; pieces: number; bay?: string; stagedAt?: string }[];
    count: number;
    tonnage: number;
    inTransitToDock: number;
  };
  nextDispatch?: { truckId: string | null; palletsNeeded: number; estimatedSeconds: number | null; basis: string };
  trucks: FleetTruck[];
  activeDispatches: FleetDispatch[];
  recentDispatches?: FleetDispatch[];
  today: { deliveries: number; tonnes: number };
}

/** Fraction of the outbound leg spent driving out of the plant / of the return leg driving in. */
const YARD_SHARE = 0.08;

export type TruckSitePhase = 'docked' | 'departing' | 'arriving' | 'away';

export interface TruckSiteState {
  phase: TruckSitePhase;
  progress: number; // 0..1 along the yard path for departing / arriving
  label: string; // short status for chips and lists
  tone: 'green' | 'blue' | 'amber' | 'purple' | 'slate';
}

/** Where a truck is on site right now, derived from the server-authoritative timeline. */
export function truckSiteState(truck: FleetTruck, dispatch: FleetDispatch | undefined, now: number): TruckSiteState {
  if (!dispatch) {
    if (truck.loadedPallets > 0) return { phase: 'docked', progress: 0, label: `Loading ${truck.loadedPallets}/${truck.capacityPallets}`, tone: 'green' };
    return { phase: 'docked', progress: 0, label: 'Waiting for load', tone: 'slate' };
  }
  const t = (now - Date.parse(dispatch.dispatchedAt)) / 1000;
  const out = dispatch.outboundSeconds;
  const unload = dispatch.unloadSeconds;
  const ret = dispatch.returnSeconds;
  if (t < out * YARD_SHARE) return { phase: 'departing', progress: Math.max(0, t / (out * YARD_SHARE)), label: 'Departing', tone: 'blue' };
  if (t < out) return { phase: 'away', progress: 0, label: `To ${dispatch.destinationName}`, tone: 'blue' };
  if (t < out + unload) return { phase: 'away', progress: 0, label: `Unloading at ${dispatch.destinationName}`, tone: 'amber' };
  const r = (t - out - unload) / ret;
  if (r < 1 - YARD_SHARE) return { phase: 'away', progress: 0, label: 'Returning', tone: 'purple' };
  if (r < 1) return { phase: 'arriving', progress: (r - (1 - YARD_SHARE)) / YARD_SHARE, label: 'Arriving at plant', tone: 'purple' };
  return { phase: 'docked', progress: 0, label: 'Back at dock', tone: 'slate' };
}

export const TONE: Record<TruckSiteState['tone'], { bg: string; text: string; dot: string }> = {
  green: { bg: '#DCFCE7', text: '#15803D', dot: '#16A34A' },
  blue: { bg: '#DBEAFE', text: '#1D4ED8', dot: '#2563EB' },
  amber: { bg: '#FEF3C7', text: '#B45309', dot: '#F59E0B' },
  purple: { bg: '#EDE9FE', text: '#6D28D9', dot: '#7C3AED' },
  slate: { bg: '#F1F5F9', text: '#475569', dot: '#94A3B8' },
};

/** Shipment-tracking steps for a truck (loading at the dock → back at the plant). */
export function shipmentSteps(truck: FleetTruck, dispatch: FleetDispatch | undefined, now: number) {
  const at = (sec: number) => (dispatch ? new Date(Date.parse(dispatch.dispatchedAt) + sec * 1000).toISOString() : undefined);
  if (!dispatch) {
    return {
      steps: [
        { label: `Loading ${truck.loadedPallets}/${truck.capacityPallets}`, at: undefined as string | undefined, done: truck.isReady },
        { label: 'Dispatched', at: undefined, done: false },
        { label: 'In transit', at: undefined, done: false },
        { label: 'Delivered', at: undefined, done: false },
        { label: 'Back at plant', at: undefined, done: false },
      ],
      current: truck.isReady ? 1 : 0,
    };
  }
  const t = (now - Date.parse(dispatch.dispatchedAt)) / 1000;
  const out = dispatch.outboundSeconds;
  const unload = dispatch.unloadSeconds;
  const ret = dispatch.returnSeconds;
  const steps = [
    { label: `Loaded ${dispatch.palletCount} pallets`, at: dispatch.dispatchedAt, done: true },
    { label: 'Dispatched', at: dispatch.dispatchedAt, done: true },
    { label: 'In transit', at: at(out * YARD_SHARE), done: t >= out },
    { label: 'Delivered', at: dispatch.arrivedAt || at(out), done: t >= out + unload },
    { label: 'Back at plant', at: dispatch.returnedAt || at(out + unload + ret), done: t >= out + unload + ret },
  ];
  return { steps, current: steps.findIndex((s) => !s.done) };
}
