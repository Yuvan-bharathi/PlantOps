/**
 * Outbound freight & road fleet (server-authoritative)
 *
 * Packaging seals 240-pc pallets → AGVs deliver them to the Outbound Logistics Dock
 * (logistics_pallets.status = 'DELIVERED_DOCK'). When FREIGHT_THRESHOLD_PALLETS are staged, the
 * next available truck is dispatched automatically to the least-recently served warehouse.
 *
 * A dispatch stores its planned timeline (outbound / unload / return durations). A ticker derives
 * the live status from that timeline and persists each milestone, so missions keep progressing —
 * and survive restarts — whether or not anyone has the Live Fleet map open. The map only animates it.
 */
import { query } from '../db/mysql.js';
import { broadcast } from './socket.service.js';
import { recordAuditLog } from './audit.service.js';

export const PALLET_TONNES = 1.2; // 240 pcs per pallet
export const FREIGHT_THRESHOLD_PALLETS = Math.max(1, Number(process.env.FREIGHT_THRESHOLD_PALLETS) || 4);
// Simulated seconds per real second for road trips (matches the map animation)
export const FLEET_TIME_SCALE = Math.max(1, Number(process.env.FLEET_TIME_SCALE) || 6);
const CRUISE_MPS = 14; // ~50 km/h average road speed
const UNLOAD_SECONDS = 25; // real seconds spent unloading at the warehouse

export const PLANT_BASE = { name: 'Plant Base HQ (Ambattur Industrial Estate)', coords: [80.1548, 13.1142] as [number, number] };

export const DESTINATIONS = [
  { id: 'WH-001', name: 'Bengaluru Tech Hub & Logistics Park', address: 'Electronic City Phase 1, Hosur Rd, Bengaluru, Karnataka', coords: [77.6762, 12.8452] as [number, number], distanceKm: 335.0 },
  { id: 'WH-002', name: 'Coimbatore Industrial Corridor Hub', address: 'Peelamedu Industrial Estate, Avinashi Rd, Coimbatore, Tamil Nadu', coords: [77.0185, 11.0264] as [number, number], distanceKm: 495.0 },
  { id: 'WH-003', name: 'Tirupati Logistics Depot', address: 'Renigunta Industrial Area, Tirupati, Andhra Pradesh', coords: [79.5167, 13.6288] as [number, number], distanceKm: 135.0 },
  { id: 'WH-004', name: 'Puducherry Freight Terminal', address: 'Mettupalayam Industrial Estate, Puducherry', coords: [79.7915, 11.9610] as [number, number], distanceKm: 150.0 },
];

const SEED_TRUCKS = [
  { id: 'TRK-001', name: 'Alpha Carrier', driver: 'K. Ramesh' },
  { id: 'TRK-002', name: 'Bravo Hauler', driver: 'S. Vignesh' },
  { id: 'TRK-003', name: 'Charlie Express', driver: 'M. Anbu' },
  { id: 'TRK-004', name: 'Delta Prime', driver: 'D. Prakash' },
];

export type DispatchStatus = 'DEPARTING' | 'IN_TRANSIT' | 'ARRIVING' | 'DELIVERED' | 'RETURNING' | 'COMPLETED';

export interface FleetDispatch {
  id: string;
  truckId: string;
  driverName: string;
  destinationId: string;
  destinationName: string;
  cargoName: string;
  batchId: string;
  palletCount: number;
  tonnage: number;
  palletIds: string[];
  distanceKm: number;
  status: DispatchStatus;
  triggerType: string;
  outboundSeconds: number;
  unloadSeconds: number;
  returnSeconds: number;
  dispatchedAt: string;
  arrivedAt?: string;
  returnStartedAt?: string;
  returnedAt?: string;
}

let ready: Promise<boolean> | null = null;
let dispatching = false;
let ticker: NodeJS.Timeout | null = null;

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await query<any>(
    `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [table, column]
  );
  return rows.length > 0;
}

export function ensureFleetTables(): Promise<boolean> {
  return (ready ||= (async () => {
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS fleet_trucks (
          id                  VARCHAR(32)  NOT NULL PRIMARY KEY,
          name                VARCHAR(64)  NOT NULL,
          driver_name         VARCHAR(64)  NOT NULL,
          capacity_pallets    INT          NOT NULL DEFAULT 4,
          status              VARCHAR(20)  NOT NULL DEFAULT 'AVAILABLE',
          current_dispatch_id VARCHAR(64)  NULL,
          last_returned_at    DATETIME(3)  NULL,
          updated_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`);
      await query(`
        CREATE TABLE IF NOT EXISTS fleet_dispatches (
          id                VARCHAR(64)   NOT NULL PRIMARY KEY,
          truck_id          VARCHAR(32)   NOT NULL,
          driver_name       VARCHAR(64)   NOT NULL,
          destination_id    VARCHAR(32)   NOT NULL,
          destination_name  VARCHAR(128)  NOT NULL,
          cargo_name        VARCHAR(128)  NOT NULL,
          batch_id          VARCHAR(64)   NOT NULL,
          pallet_count      INT           NOT NULL,
          tonnage           DECIMAL(6,2)  NOT NULL,
          pallet_ids        JSON          NOT NULL,
          distance_km       DECIMAL(6,1)  NOT NULL,
          status            VARCHAR(32)   NOT NULL,
          trigger_type      VARCHAR(32)   NOT NULL DEFAULT 'AUTO_THRESHOLD',
          outbound_seconds  INT           NOT NULL,
          unload_seconds    INT           NOT NULL,
          return_seconds    INT           NOT NULL,
          dispatched_at     DATETIME(3)   NOT NULL,
          arrived_at        DATETIME(3)   NULL,
          delivered_at      DATETIME(3)   NULL,
          return_started_at DATETIME(3)   NULL,
          returned_at       DATETIME(3)   NULL,
          created_at        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          INDEX idx_fd_status (status),
          INDEX idx_fd_truck (truck_id, dispatched_at),
          INDEX idx_fd_dest (destination_id, dispatched_at)
        )`);
      // Monotonic sequence for pallet / transport identities (one row per allocated pallet)
      await query(`
        CREATE TABLE IF NOT EXISTS logistics_pallet_seq (
          seq          BIGINT      NOT NULL AUTO_INCREMENT PRIMARY KEY,
          allocated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        )`);
      if (!(await columnExists('logistics_pallets', 'dispatch_id'))) {
        await query(`ALTER TABLE logistics_pallets ADD COLUMN dispatch_id VARCHAR(64) NULL`);
      }
      for (const t of SEED_TRUCKS) {
        await query(`INSERT IGNORE INTO fleet_trucks (id, name, driver_name) VALUES (?, ?, ?)`, [t.id, t.name, t.driver]);
      }
      return true;
    } catch (err: any) {
      console.warn(`[Fleet] Fleet tables unavailable: ${err.message}`);
      ready = null;
      return false;
    }
  })());
}

const iso = (v: any) => (v ? new Date(v).toISOString() : undefined);

export interface PalletIdentity {
  id: string;
  palletNumber: string;
  transportId: string;
  rfidTag: string;
}

/**
 * Allocates a unique identity for a new pallet from the TiDB sequence, so every pallet and its
 * transport mission get their own number (never reused across sessions, browsers or restarts).
 */
export async function allocatePalletIdentity(): Promise<PalletIdentity> {
  const ymd = new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10).replace(/-/g, '');
  if (await ensureFleetTables()) {
    try {
      const res: any = await query(`INSERT INTO logistics_pallet_seq () VALUES ()`);
      const seq = Number(res.insertId);
      if (seq > 0) {
        const n = String(seq).padStart(6, '0');
        return { id: `PL-${ymd}-${n}`, palletNumber: `PLT-${ymd}-${n}`, transportId: `TRP-${ymd}-${n}`, rfidTag: `RFID-${n}-IN` };
      }
    } catch (err: any) {
      console.warn(`[Logistics] Pallet sequence unavailable: ${err.message}`);
    }
  }
  // DB unreachable: time-based identity is still unique per allocation
  const u = `${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36).padStart(2, '0')}`.toUpperCase();
  return { id: `PL-${ymd}-${u}`, palletNumber: `PLT-${ymd}-${u}`, transportId: `TRP-${ymd}-${u}`, rfidTag: `RFID-${u}-IN` };
}

function rowToDispatch(r: any): FleetDispatch {
  return {
    id: r.id,
    truckId: r.truck_id,
    driverName: r.driver_name,
    destinationId: r.destination_id,
    destinationName: r.destination_name,
    cargoName: r.cargo_name,
    batchId: r.batch_id,
    palletCount: r.pallet_count,
    tonnage: Number(r.tonnage),
    palletIds: typeof r.pallet_ids === 'string' ? JSON.parse(r.pallet_ids) : r.pallet_ids || [],
    distanceKm: Number(r.distance_km),
    status: r.status,
    triggerType: r.trigger_type,
    outboundSeconds: r.outbound_seconds,
    unloadSeconds: r.unload_seconds,
    returnSeconds: r.return_seconds,
    dispatchedAt: iso(r.dispatched_at)!,
    arrivedAt: iso(r.arrived_at),
    returnStartedAt: iso(r.return_started_at),
    returnedAt: iso(r.returned_at),
  };
}

/** Status implied by a dispatch's timeline at time `now`. */
export function statusAt(d: Pick<FleetDispatch, 'dispatchedAt' | 'outboundSeconds' | 'unloadSeconds' | 'returnSeconds'>, now = Date.now()): DispatchStatus {
  const t = (now - new Date(d.dispatchedAt).getTime()) / 1000;
  const out = d.outboundSeconds;
  if (t < out) {
    const f = t / out;
    return f < 0.08 ? 'DEPARTING' : f < 0.92 ? 'IN_TRANSIT' : 'ARRIVING';
  }
  if (t < out + d.unloadSeconds) return 'DELIVERED';
  if (t < out + d.unloadSeconds + d.returnSeconds) return 'RETURNING';
  return 'COMPLETED';
}

async function stagedPallets(): Promise<any[]> {
  return query<any>(
    `SELECT id, pallet_number, pieces_count, destination_bay, created_at, updated_at FROM logistics_pallets
     WHERE status = 'DELIVERED_DOCK' AND dispatch_id IS NULL ORDER BY updated_at ASC, created_at ASC`
  );
}

async function nextDispatchId(): Promise<string> {
  const [{ n }] = await query<any>(`SELECT COUNT(*) AS n FROM fleet_dispatches`);
  return `DSP-${new Date().getFullYear()}-${String(Number(n) + 1).padStart(4, '0')}`;
}

/**
 * Manually trigger dispatch of a specific truck or all ready/loaded trucks.
 * Trucks stay parked at Plant Base accumulating pallets until this function is called by the operator.
 */
export async function triggerManualDispatch(opts: { truckId?: string; all?: boolean } = {}): Promise<FleetDispatch[]> {
  if (dispatching || !(await ensureFleetTables())) return [];
  dispatching = true;
  const created: FleetDispatch[] = [];
  try {
    const staged = await stagedPallets();
    if (staged.length === 0) return [];

    const availableTrucks: any[] = await query<any>(
      `SELECT * FROM fleet_trucks WHERE status = 'AVAILABLE' ORDER BY last_returned_at IS NOT NULL, last_returned_at ASC, id ASC`
    );
    if (availableTrucks.length === 0) return [];

    let trucksToDispatch: any[] = [];
    if (opts.all) {
      trucksToDispatch = availableTrucks;
    } else if (opts.truckId) {
      const found = availableTrucks.find((t) => t.id === opts.truckId);
      if (found) trucksToDispatch = [found];
      else return [];
    } else {
      trucksToDispatch = [availableTrucks[0]];
    }

    let palletOffset = 0;
    let staggerDelay = 0;

    for (let i = 0; i < trucksToDispatch.length; i++) {
      const truck = trucksToDispatch[i];
      const capacity = truck.capacity_pallets || FREIGHT_THRESHOLD_PALLETS;
      const remainingStaged = staged.slice(palletOffset);
      if (remainingStaged.length === 0) break;

      const load = remainingStaged.slice(0, Math.min(capacity, remainingStaged.length));
      palletOffset += load.length;

      // Assign unique destination city per truck (1:1 mapping so all 4 trucks travel to different cities)
      const truckCityIndex: Record<string, number> = {
        'TRK-001': 0, // Bengaluru
        'TRK-002': 1, // Coimbatore
        'TRK-003': 2, // Tirupati
        'TRK-004': 3, // Puducherry
      };
      const destIndex = truckCityIndex[truck.id] !== undefined ? truckCityIndex[truck.id] : i % DESTINATIONS.length;
      const dest = DESTINATIONS[destIndex] || DESTINATIONS[0];

      const id = await nextDispatchId();
      const claim: any = await query(
        `UPDATE logistics_pallets SET status = 'LOADED_TRUCK', dispatch_id = ?
         WHERE status = 'DELIVERED_DOCK' AND dispatch_id IS NULL AND id IN (${load.map(() => '?').join(',')})`,
        [id, ...load.map((p) => p.id)]
      );
      const claimed = claim?.affectedRows ?? load.length;
      if (!claimed) continue;

      const legSeconds = Math.max(20, Math.round((dest.distanceKm * 1000) / (CRUISE_MPS * FLEET_TIME_SCALE)));
      const now = new Date(Date.now() + staggerDelay * 1000);
      staggerDelay += 2.5; // Stagger multi-truck departures by 2.5 seconds

      const pieces = load.reduce((s, p) => s + (p.pieces_count || 240), 0);
      const dispatch: FleetDispatch = {
        id,
        truckId: truck.id,
        driverName: truck.driver_name,
        destinationId: dest.id,
        destinationName: dest.name,
        cargoName: `Finished machined & welded assemblies (${pieces} pcs)`,
        batchId: `B-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${id.slice(-4)}`,
        palletCount: claimed,
        tonnage: Math.round(claimed * PALLET_TONNES * 100) / 100,
        palletIds: load.map((p) => p.pallet_number || p.id),
        distanceKm: dest.distanceKm,
        status: 'DEPARTING',
        triggerType: 'MANUAL',
        outboundSeconds: legSeconds,
        unloadSeconds: UNLOAD_SECONDS,
        returnSeconds: legSeconds,
        dispatchedAt: now.toISOString(),
      };

      await query(
        `INSERT INTO fleet_dispatches (id, truck_id, driver_name, destination_id, destination_name, cargo_name, batch_id, pallet_count, tonnage,
           pallet_ids, distance_km, status, trigger_type, outbound_seconds, unload_seconds, return_seconds, dispatched_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          dispatch.id, dispatch.truckId, dispatch.driverName, dispatch.destinationId, dispatch.destinationName, dispatch.cargoName,
          dispatch.batchId, dispatch.palletCount, dispatch.tonnage, JSON.stringify(dispatch.palletIds), dispatch.distanceKm,
          dispatch.status, dispatch.triggerType, dispatch.outboundSeconds, dispatch.unloadSeconds, dispatch.returnSeconds, now,
        ]
      );
      await query(`UPDATE fleet_trucks SET status = 'ON_MISSION', current_dispatch_id = ? WHERE id = ?`, [dispatch.id, truck.id]);
      recordAuditLog({
        actor: 'OPERATOR',
        action: 'TRUCK_DISPATCHED_MANUAL',
        resourceType: 'FLEET_DISPATCH',
        resourceId: dispatch.id,
        newState: dispatch,
        reason: `Operator manually triggered road dispatch for ${truck.id} with ${claimed} pallets (${dispatch.tonnage} t)`,
      }).catch(() => {});
      created.push(dispatch);
      console.log(`[Fleet] Manual dispatch ${dispatch.id}: ${truck.id} dispatched to ${dest.name} with ${claimed} pallets (${dispatch.tonnage} t)`);
      broadcast('fleet:dispatched', dispatch);
    }
  } catch (err: any) {
    console.warn(`[Fleet] Manual dispatch failed: ${err.message}`);
  } finally {
    dispatching = false;
  }
  if (created.length) broadcast('fleet:updated', { reason: 'manual_dispatch' });
  return created;
}

// Alias for backwards compatibility
export const checkDockAndDispatch = triggerManualDispatch;

/** Persist milestone transitions implied by each active dispatch's timeline. */
export async function advanceDispatches(): Promise<void> {
  if (!(await ensureFleetTables())) return;
  let changed = false;
  let truckFreed = false;
  try {
    const active = (await query<any>(`SELECT * FROM fleet_dispatches WHERE status <> 'COMPLETED'`)).map(rowToDispatch);
    for (const d of active) {
      const next = statusAt(d);
      if (next === d.status) continue;
      const t0 = new Date(d.dispatchedAt).getTime();
      const arrivedAt = new Date(t0 + d.outboundSeconds * 1000);
      const returnStart = new Date(t0 + (d.outboundSeconds + d.unloadSeconds) * 1000);
      const returnedAt = new Date(t0 + (d.outboundSeconds + d.unloadSeconds + d.returnSeconds) * 1000);
      const reached = (s: DispatchStatus) => ['DELIVERED', 'RETURNING', 'COMPLETED'].indexOf(next) >= ['DELIVERED', 'RETURNING', 'COMPLETED'].indexOf(s);
      await query(
        `UPDATE fleet_dispatches SET status = ?,
           arrived_at = COALESCE(arrived_at, ?), delivered_at = COALESCE(delivered_at, ?),
           return_started_at = COALESCE(return_started_at, ?), returned_at = COALESCE(returned_at, ?)
         WHERE id = ?`,
        [
          next,
          reached('DELIVERED') ? arrivedAt : null,
          reached('DELIVERED') ? arrivedAt : null,
          reached('RETURNING') ? returnStart : null,
          next === 'COMPLETED' ? returnedAt : null,
          d.id,
        ]
      );
      if (reached('DELIVERED') && !['DELIVERED', 'RETURNING'].includes(d.status)) {
        await query(`UPDATE logistics_pallets SET status = 'DELIVERED_CUSTOMER', delivered_at = COALESCE(delivered_at, ?) WHERE dispatch_id = ?`, [arrivedAt, d.id]);
        broadcast('fleet:delivered', { ...d, status: next });
      }
      if (next === 'COMPLETED') {
        await query(`UPDATE fleet_trucks SET status = 'AVAILABLE', current_dispatch_id = NULL, last_returned_at = ? WHERE id = ?`, [returnedAt, d.truckId]);
        broadcast('fleet:returned', { ...d, status: next });
        truckFreed = true;
      }
      changed = true;
    }
  } catch (err: any) {
    console.warn(`[Fleet] Mission update failed: ${err.message}`);
  }
  if (changed) broadcast('fleet:updated', { reason: 'milestone' });
  // A truck back at base may be able to take a load that was waiting
  if (truckFreed) await checkDockAndDispatch();
}

// An AGV takes ~1.5 min from the packaging cell to the dock. If a pallet has been "in transit"
// much longer, the browser that was animating the AGV went away — complete the hand-off server-side
// so the pallet still reaches the dock and counts toward the next truckload.
const AGV_TRANSIT_TIMEOUT_S = 150;

export async function sweepStalledAgvTransfers(): Promise<number> {
  if (!(await ensureFleetTables())) return 0;
  try {
    const res: any = await query(
      `UPDATE logistics_pallets SET status = 'DELIVERED_DOCK', delivered_at = COALESCE(delivered_at, NOW())
       WHERE status = 'IN_TRANSIT' AND dispatch_id IS NULL AND dispatched_at IS NOT NULL
         AND dispatched_at < NOW() - INTERVAL ${AGV_TRANSIT_TIMEOUT_S} SECOND`
    );
    const n = Number(res?.affectedRows || 0);
    if (n) {
      console.log(`[Fleet] Completed ${n} stalled AGV pallet transfer(s) to the outbound dock`);
      broadcast('fleet:updated', { reason: 'agv_sweep' });
      await checkDockAndDispatch();
    }
    return n;
  } catch (err: any) {
    console.warn(`[Fleet] AGV sweep failed: ${err.message}`);
    return 0;
  }
}

/**
 * When will the next truck leave? Pallets still needed ÷ the recent packaging rate (median gap
 * between the last pallets handed to AGVs), plus the AGV trip to the dock.
 */
async function estimateNextDispatch(stagedCount: number, inTransit: number, trucks: any[]) {
  const needed = Math.max(0, FREIGHT_THRESHOLD_PALLETS - stagedCount - inTransit);
  const nextTruck = trucks
    .filter((t) => t.status === 'AVAILABLE')
    .sort((a, b) => (a.last_returned_at ? new Date(a.last_returned_at).getTime() : 0) - (b.last_returned_at ? new Date(b.last_returned_at).getTime() : 0) || a.id.localeCompare(b.id))[0];
  const recent = await query<any>(
    `SELECT dispatched_at FROM logistics_pallets WHERE dispatched_at IS NOT NULL AND dispatched_at > NOW() - INTERVAL 3 HOUR
     ORDER BY dispatched_at DESC LIMIT 7`
  );
  const times = recent.map((r) => new Date(r.dispatched_at).getTime()).sort((a, b) => a - b);
  const gaps = times.slice(1).map((t, i) => (t - times[i]) / 1000).filter((g) => g > 5).sort((a, b) => a - b);
  const palletIntervalSeconds = gaps.length ? gaps[Math.floor(gaps.length / 2)] : null;
  const pending = stagedCount + inTransit;
  let estimatedSeconds: number | null = null;
  if (pending >= FREIGHT_THRESHOLD_PALLETS) estimatedSeconds = inTransit ? AGV_TRANSIT_TIMEOUT_S / 2 : 0;
  else if (palletIntervalSeconds) estimatedSeconds = Math.round(needed * palletIntervalSeconds + 90);
  return {
    truckId: nextTruck?.id ?? null,
    palletsNeeded: needed,
    palletsInTransitToDock: inTransit,
    palletIntervalSeconds: palletIntervalSeconds ? Math.round(palletIntervalSeconds) : null,
    estimatedSeconds: nextTruck ? estimatedSeconds : null,
    basis: !nextTruck
      ? 'All trucks are on the road — the load leaves when the next truck returns'
      : palletIntervalSeconds
      ? `Packaging completes a pallet about every ${Math.round(palletIntervalSeconds / 60)} min`
      : 'Waiting for packaging rate data (needs 2+ recent pallets)',
  };
}

export async function getFleetState() {
  await ensureFleetTables();
  const [trucks, active, recent, staged, [{ n: inTransit }]] = await Promise.all([
    query<any>(`SELECT * FROM fleet_trucks ORDER BY id`),
    query<any>(`SELECT * FROM fleet_dispatches WHERE status <> 'COMPLETED' ORDER BY dispatched_at ASC`),
    query<any>(`SELECT * FROM fleet_dispatches WHERE status = 'COMPLETED' ORDER BY returned_at DESC LIMIT 10`),
    stagedPallets(),
    query<any>(`SELECT COUNT(*) AS n FROM logistics_pallets WHERE status = 'IN_TRANSIT' AND dispatch_id IS NULL`),
  ]);
  const nextDispatch = await estimateNextDispatch(staged.length, Number(inTransit), trucks);
  const activeDispatches = active.map(rowToDispatch).map((d) => ({ ...d, status: statusAt(d) }));
  const [{ delivered_today, tonnes_today }] = await query<any>(
    `SELECT COUNT(*) AS delivered_today, COALESCE(SUM(tonnage), 0) AS tonnes_today FROM fleet_dispatches
     WHERE delivered_at >= ? `,
    [new Date(Date.now() - (((Date.now() + 330 * 60000) % 86400000)))]
  );

  // Allocate staged pallets to available trucks in FIFO idle order
  let stagedRemaining = staged.length;
  const availableSorted = [...trucks]
    .filter((t: any) => t.status === 'AVAILABLE')
    .sort((a: any, b: any) => (a.last_returned_at ? Date.parse(a.last_returned_at) : 0) - (b.last_returned_at ? Date.parse(b.last_returned_at) : 0) || a.id.localeCompare(b.id));

  const truckAllocations: Record<string, { loadedPallets: number; isReady: boolean; canDispatch: boolean }> = {};
  for (const t of availableSorted) {
    const cap = t.capacity_pallets || FREIGHT_THRESHOLD_PALLETS;
    const loaded = Math.min(cap, Math.max(0, stagedRemaining));
    stagedRemaining = Math.max(0, stagedRemaining - loaded);
    truckAllocations[t.id] = {
      loadedPallets: loaded,
      isReady: loaded >= cap,
      canDispatch: loaded > 0,
    };
  }

  const readyTrucksCount = Object.values(truckAllocations).filter((a) => a.isReady).length;
  const loadedTrucksCount = Object.values(truckAllocations).filter((a) => a.canDispatch).length;

  return {
    serverTime: new Date().toISOString(),
    config: {
      plantBase: PLANT_BASE,
      destinations: DESTINATIONS,
      freightThresholdPallets: FREIGHT_THRESHOLD_PALLETS,
      palletTonnes: PALLET_TONNES,
      timeScale: FLEET_TIME_SCALE,
      cruiseKmh: Math.round(CRUISE_MPS * 3.6),
    },
    dock: {
      stagedPallets: staged.map((p) => ({ id: p.id, palletNumber: p.pallet_number, pieces: p.pieces_count, bay: p.destination_bay, stagedAt: iso(p.updated_at || p.created_at) })),
      count: staged.length,
      tonnage: Math.round(staged.length * PALLET_TONNES * 100) / 100,
      readyTrucksCount,
      loadedTrucksCount,
      allTrucksReady: readyTrucksCount === 4,
      readyForDispatch: loadedTrucksCount > 0,
      waitingForTruck: staged.length >= FREIGHT_THRESHOLD_PALLETS && !trucks.some((t: any) => t.status === 'AVAILABLE'),
      inTransitToDock: Number(inTransit),
    },
    nextDispatch,
    trucks: trucks.map((t: any) => {
      const alloc = truckAllocations[t.id] || { loadedPallets: 0, isReady: false, canDispatch: false };
      return {
        id: t.id,
        name: t.name,
        driverName: t.driver_name,
        capacityPallets: t.capacity_pallets,
        capacityTonnes: Math.round(t.capacity_pallets * PALLET_TONNES * 100) / 100,
        capacityPieces: t.capacity_pallets * 240,
        status: t.status,
        loadedPallets: alloc.loadedPallets,
        isReady: alloc.isReady,
        canDispatch: alloc.canDispatch,
        currentDispatchId: t.current_dispatch_id || undefined,
        lastReturnedAt: iso(t.last_returned_at),
      };
    }),
    activeDispatches,
    recentDispatches: recent.map(rowToDispatch),
    today: { deliveries: Number(delivered_today), tonnes: Number(tonnes_today) },
  };
}

export async function listDispatches(filter: { status?: string; truckId?: string; limit?: number } = {}): Promise<FleetDispatch[]> {
  await ensureFleetTables();
  const where: string[] = [];
  const params: any[] = [];
  if (filter.status) { where.push('status = ?'); params.push(filter.status.toUpperCase()); }
  if (filter.truckId) { where.push('truck_id = ?'); params.push(filter.truckId.toUpperCase()); }
  const limit = Math.min(100, Math.max(1, filter.limit || 25));
  const rows = await query<any>(`SELECT * FROM fleet_dispatches ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY dispatched_at DESC LIMIT ${limit}`, params);
  return rows.map(rowToDispatch).map((d) => (d.status === 'COMPLETED' ? d : { ...d, status: statusAt(d) }));
}

export function startFleetEngine(): void {
  if (ticker) return;
  ensureFleetTables().then((ok) => {
    if (!ok) return;
    console.log(`[Fleet] Freight dispatch engine running (manual dispatch mode with pallet staging)`);
    sweepStalledAgvTransfers();
  });
  ticker = setInterval(() => {
    advanceDispatches().catch(() => {});
  }, 3000);
  // Safety net for AGV sweep
  setInterval(() => {
    sweepStalledAgvTransfers().catch(() => {});
  }, 30000);
}
