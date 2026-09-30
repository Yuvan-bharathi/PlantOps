import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Truck, Package, Navigation, CheckCircle2, Clock, Warehouse } from 'lucide-react';
import { api, socket } from '../../services/api';

interface Mission {
  id: string;
  truckId: string;
  driverName: string;
  destinationName: string;
  palletCount: number;
  tonnage: number;
  batchId: string;
  status: string;
  outboundSeconds: number;
  unloadSeconds: number;
  returnSeconds: number;
  dispatchedAt: string;
}

interface FleetState {
  serverTime: string;
  config: { freightThresholdPallets: number; palletTonnes: number; timeScale: number };
  dock: { count: number; tonnage: number; waitingForTruck: boolean; inTransitToDock?: number };
  nextDispatch?: { truckId: string | null; palletsNeeded: number; estimatedSeconds: number | null; basis: string };
  trucks: { id: string; status: string }[];
  activeDispatches: Mission[];
  today: { deliveries: number; tonnes: number };
}

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  DEPARTING: { label: 'Departing', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  IN_TRANSIT: { label: 'In transit', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  ARRIVING: { label: 'Arriving', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  DELIVERED: { label: 'Unloading', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  RETURNING: { label: 'Returning', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
};

// Leg progress + real-world ETA from the dispatch timeline (the road trip runs at the fleet time scale)
function legInfo(m: Mission, nowMs: number, timeScale: number) {
  const t = Math.max(0, (nowMs - Date.parse(m.dispatchedAt)) / 1000);
  const o = m.outboundSeconds;
  const u = m.unloadSeconds;
  const r = m.returnSeconds;
  if (t < o) return { status: t / o < 0.08 ? 'DEPARTING' : t / o < 0.92 ? 'IN_TRANSIT' : 'ARRIVING', pct: (t / o) * 100, etaMin: Math.round(((o - t) * timeScale) / 60), leg: 'to warehouse' };
  if (t < o + u) return { status: 'DELIVERED', pct: 100, etaMin: 0, leg: 'unloading' };
  const f = Math.min(1, (t - o - u) / r);
  return { status: 'RETURNING', pct: f * 100, etaMin: Math.round(((1 - f) * r * timeScale) / 60), leg: 'back to plant' };
}

export const OutboundFreightCard: React.FC<{ onTrackTruck: (truckId: string) => void; onOpenFleet: () => void }> = ({ onTrackTruck, onOpenFleet }) => {
  const [state, setState] = useState<FleetState | null>(null);
  const [error, setError] = useState(false);
  const [, setTick] = useState(0);
  const offsetRef = useRef(0);

  const load = useCallback(async () => {
    try {
      const t0 = Date.now();
      const res = await api.getFleetState();
      if (!res?.success) throw new Error(res?.error);
      offsetRef.current = Date.parse(res.data.serverTime) - (t0 + Date.now()) / 2;
      setState(res.data);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    load();
    const poll = setInterval(load, 15000);
    const tick = setInterval(() => setTick((n) => n + 1), 1000);
    socket.on('fleet:updated', load);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
      socket.off('fleet:updated', load);
    };
  }, [load]);

  const threshold = state?.config.freightThresholdPallets ?? 4;
  const staged = state?.dock.count ?? 0;
  const now = Date.now() + offsetRef.current;
  const available = state?.trucks.filter((t) => t.status === 'AVAILABLE').length ?? 0;

  return (
    <div className="bg-[#FAF9F6] border border-[#DDD9D0] rounded-xl p-3.5 shadow-xs">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
            <Truck size={16} />
          </div>
          <div>
            <div className="text-sm font-extrabold text-[#1E293B] leading-tight">Outbound Freight & Logistics</div>
            <div className="text-[11px] text-[#64748B]">Dock staging · road shipments from TiDB · auto-dispatch at {threshold} pallets</div>
          </div>
        </div>
        <button onClick={onOpenFleet} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#DDD9D0] bg-white hover:bg-slate-50 text-xs font-bold text-[#334155]">
          <Navigation size={13} /> Live Fleet Map
        </button>
      </div>

      {error && !state ? (
        <div className="text-xs text-[#94A3B8] py-3">Freight data unavailable — backend fleet engine not reachable.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* Dock staging */}
          <div className="lg:col-span-3 rounded-lg bg-white border border-[#E7E3DA] p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#64748B] uppercase tracking-wide">
              <Warehouse size={12} /> Outbound dock
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-[#1E293B]">{staged}</span>
              <span className="text-xs text-[#64748B]">/ {threshold} pallets · {state?.dock.tonnage ?? 0} t</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-[#EAE7E0] overflow-hidden">
              <div className="h-full bg-emerald-600 transition-all duration-500" style={{ width: `${Math.min(100, (staged / threshold) * 100)}%` }} />
            </div>
            <div className={`mt-1.5 text-[10.5px] ${state?.dock.waitingForTruck ? 'text-amber-700 font-semibold' : 'text-[#64748B]'}`}>
              {state?.dock.waitingForTruck
                ? 'Full load waiting for a truck'
                : state?.nextDispatch?.truckId
                ? `Next: ${state.nextDispatch.truckId} ${state.nextDispatch.estimatedSeconds == null ? 'when loaded' : state.nextDispatch.estimatedSeconds < 60 ? 'within a minute' : `in ~${Math.round(state.nextDispatch.estimatedSeconds / 60)} min`} · ${state.nextDispatch.palletsNeeded} more pallet${state.nextDispatch.palletsNeeded === 1 ? '' : 's'}`
                : `${Math.max(0, threshold - staged)} more to dispatch · ${available} truck${available === 1 ? '' : 's'} at base`}
            </div>
          </div>

          {/* Today */}
          <div className="lg:col-span-2 rounded-lg bg-white border border-[#E7E3DA] p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#64748B] uppercase tracking-wide">
              <CheckCircle2 size={12} /> Delivered today
            </div>
            <div className="mt-1 text-2xl font-black text-[#1E293B]">{state?.today.deliveries ?? 0}</div>
            <div className="text-xs text-[#64748B]">{state?.today.tonnes ?? 0} t shipped</div>
          </div>

          {/* Active shipments */}
          <div className="lg:col-span-7 rounded-lg bg-white border border-[#E7E3DA] p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#64748B] uppercase tracking-wide mb-2">
              <Package size={12} /> Active road shipments ({state?.activeDispatches.length ?? 0})
            </div>
            {!state?.activeDispatches.length ? (
              <div className="text-xs text-[#94A3B8] py-2">No trucks on the road. The next truck leaves automatically when {threshold} pallets are staged.</div>
            ) : (
              <div className="space-y-2">
                {state.activeDispatches.map((m) => {
                  const info = legInfo(m, now, state.config.timeScale);
                  const style = STATUS_STYLE[info.status] || STATUS_STYLE.IN_TRANSIT;
                  return (
                    <div key={m.id} className="flex items-center gap-3">
                      <div className="w-24 shrink-0">
                        <div className="text-xs font-bold text-[#1E293B] font-mono">{m.truckId}</div>
                        <div className="text-[10px] text-[#94A3B8] font-mono">{m.id}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="font-semibold text-[#334155] truncate">
                            {m.destinationName} · {m.palletCount} plt · {m.tonnage} t
                          </span>
                          <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${style.cls}`}>{style.label}</span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-[#EAE7E0] overflow-hidden">
                          <div className="h-full bg-blue-600 transition-all duration-1000" style={{ width: `${info.pct}%` }} />
                        </div>
                        <div className="mt-0.5 text-[10px] text-[#94A3B8] flex items-center gap-1">
                          <Clock size={10} /> {info.status === 'DELIVERED' ? 'Unloading at warehouse' : `ETA ${info.etaMin} min ${info.leg}`} · driver {m.driverName}
                        </div>
                      </div>
                      <button
                        onClick={() => onTrackTruck(m.truckId)}
                        className="shrink-0 inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold"
                      >
                        <Navigation size={11} /> Track in 3D
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OutboundFreightCard;
