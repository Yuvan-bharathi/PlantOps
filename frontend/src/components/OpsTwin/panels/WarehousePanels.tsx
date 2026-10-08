import React from 'react';
import { ArrowRight, Boxes, Calendar, Forklift as ForkliftIcon, Gauge, Layers, MapPin, Package, Scale, Tag as TagIcon, Warehouse as WarehouseIcon } from 'lucide-react';
import { Row, SectionLabel } from '../ui';
import { Bar, Tag } from '../yard/YardPanels';
import { SourceTag } from './KpiStrip';
import { equipTimeline, EquipSnap, EquipStatus, KIND } from '../yard/equipment';
import { ROLE } from '../yard/warehouse';
import { Aisle, allLocs, locId, locInfo, LocInfo, parseLoc, reachAt, ReachSnap, Warehouse, whMovesPerHour, WhStats, Zone } from '../yard/warehouse';

const t = (sec: number) => new Date(sec * 1000).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
const ageDays = (sec: number, now: number) => Math.max(0, Math.floor((now - sec) / 86400));

const Head: React.FC<{ icon: React.ReactNode; eyebrow: string; title: string; sub?: string; right?: React.ReactNode }> = ({ icon, eyebrow, title, sub, right }) => (
  <div className="flex items-start justify-between gap-2">
    <div className="flex min-w-0 items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">{icon}</span>
      <div className="min-w-0">
        <div className="text-[10px] font-black uppercase tracking-wider text-blue-600">{eyebrow}</div>
        <div className="truncate text-lg font-black leading-tight text-slate-900">{title}</div>
        {sub && <div className="truncate text-xs text-slate-500">{sub}</div>}
      </div>
    </div>
    {right}
  </div>
);

const Tile: React.FC<{ label: string; value: React.ReactNode; sub?: string; bar?: number }> = ({ label, value, sub, bar }) => (
  <div className="rounded-xl bg-slate-50 p-2.5">
    <div className="text-[10px] font-bold text-slate-400">{label}</div>
    <div className="text-base font-black tabular-nums text-slate-900">
      {value} {sub && <span className="text-[11px] font-semibold text-slate-400">{sub}</span>}
    </div>
    {bar !== undefined && <Bar value={bar} className="mt-1.5" tone={bar > 0.9 ? 'amber' : 'blue'} />}
  </div>
);

export const WarehouseOverview: React.FC<{
  wh: Warehouse;
  stats: WhStats;
  nowSec: number;
  equipment: EquipSnap[];
  onEquipment: (id: string) => void;
  others: { id: string; label: string }[];
  onAisle: (id: string) => void;
  onReach: (id: string) => void;
  onBuilding: (id: string) => void;
}> = ({ wh, stats, nowSec, equipment, onEquipment, others, onAisle, onReach, onBuilding }) => {
  const occ = stats.locations ? stats.occupied / stats.locations : 0;
  return (
    <>
      <Head icon={<WarehouseIcon size={20} />} eyebrow={`${wh.site.code} · ${ROLE[wh.role].label}`} title={wh.building.label} sub={`${wh.width} × ${wh.depth} m · ${wh.aisles.length ? `${wh.aisles.length} aisles · ${stats.locations} pallet locations` : `${equipment.length} equipment items`}`} right={<SourceTag source="sim" />} />
      {wh.aisles.length > 0 ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Tile label="Storage used" value={`${Math.round(occ * 100)}%`} sub={`${stats.occupied}/${stats.locations}`} bar={occ} />
          <Tile label="Pallet moves" value={whMovesPerHour(wh)} sub="/ hour" />
          <Tile label="Receiving queue" value={stats.receivingQueue} sub="pallets" />
          <Tile label="Shipping queue" value={stats.shippingQueue} sub="pallets" />
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Tile label="Equipment up" value={`${equipment.filter((e) => e.powered && (e.status === 'RUNNING' || e.status === 'IDLE')).length}/${equipment.filter((e) => e.powered).length}`} />
          <Tile label="Alerts" value={equipment.filter((e) => e.status === 'FAULT' || e.status === 'WARNING').length} />
        </div>
      )}
      {wh.aisles.length > 0 && (
      <>
      <div className="mt-4">
        <SectionLabel>Aisle occupancy</SectionLabel>
        <div className="mt-1.5 space-y-1">
          {stats.byAisle.map((a) => (
            <button key={a.id} onClick={() => onAisle(a.id)} className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-slate-50">
              <span className="w-14 shrink-0 text-[11px] font-black text-slate-700">Aisle {a.id}</span>
              <Bar value={a.total ? a.occupied / a.total : 0} tone={a.occupied / Math.max(1, a.total) > 0.9 ? 'amber' : 'blue'} className="flex-1" />
              <span className="w-12 shrink-0 text-right text-[11px] font-bold tabular-nums text-slate-500">
                {a.occupied}/{a.total}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4">
        <SectionLabel>Reach trucks</SectionLabel>
        <div className="mt-1.5 space-y-1">
          {wh.forklifts.map((f) => {
            const s = reachAt(wh, f, nowSec);
            return (
              <button key={f.id} onClick={() => onReach(f.id)} className="flex w-full items-center justify-between gap-2 rounded-lg px-1.5 py-1 text-left text-[11px] hover:bg-slate-50">
                <span className="min-w-0">
                  <span className="font-black text-slate-800">{f.id}</span> <span className="text-slate-400">· {f.operator}</span>
                  <span className="block truncate text-slate-500">{s.detail}</span>
                </span>
                <Tag tone={s.status === 'waiting' ? 'slate' : s.status === 'lifting' ? 'amber' : 'green'}>{s.status}</Tag>
              </button>
            );
          })}
        </div>
      </div>
      </>
      )}
      {equipment.length > 0 && (
        <div className="mt-4">
          <SectionLabel>{ROLE[wh.role].area}</SectionLabel>
          <div className="mt-1.5 space-y-1">
            {equipment.map((e) => (
              <button key={e.item.id} onClick={() => onEquipment(e.item.id)} className="flex w-full items-center justify-between gap-2 rounded-lg px-1.5 py-1 text-left text-[11px] hover:bg-slate-50">
                <span className="min-w-0">
                  <span className="font-black text-slate-800">{e.item.label}</span>
                  <span className="block truncate text-slate-500">{e.issue || e.reading}</span>
                </span>
                <Tag tone={e.powered ? EQ_TONE[e.status] : 'slate'}>{e.statusLabel}</Tag>
              </button>
            ))}
          </div>
        </div>
      )}
      {others.length > 0 && (
        <div className="mt-4">
          <SectionLabel>Other buildings on this site</SectionLabel>
          <div className="mt-1.5 space-y-1">
            {others.map((o) => (
              <button key={o.id} onClick={() => onBuilding(o.id)} className="flex w-full items-center justify-between rounded-lg bg-slate-50 px-2.5 py-2 text-left text-xs font-bold text-slate-700 hover:bg-blue-50">
                {o.label} <ArrowRight size={13} className="text-slate-400" />
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="mt-4 text-[11px] leading-relaxed text-slate-400">Click equipment, a stored pallet, an aisle letter, a zone or a reach truck. Drag to move · right-drag to rotate · Esc returns to the yard.</p>
    </>
  );
};

export const LocationCard: React.FC<{ wh: Warehouse; id: string; nowSec: number }> = ({ wh, id, nowSec }) => {
  const l = parseLoc(wh, id);
  if (!l) return null;
  const info: LocInfo = locInfo(wh, l, nowSec);
  return (
    <>
      <Head icon={<Package size={20} />} eyebrow={`Storage location · ${wh.building.label}`} title={id} sub={`Aisle ${wh.aisles[l.aisle].id} · ${l.side === 'L' ? 'left' : 'right'} rack · bay ${l.bay} · level ${l.level}`} right={<SourceTag source="sim" />} />
      <div className="mt-3 flex items-center gap-2 text-xs">
        <Tag tone={info.occupied ? 'green' : 'slate'}>{info.occupied ? 'Occupied' : 'Empty'}</Tag>
        {info.occupied && <span className="text-slate-500">{info.description}</span>}
      </div>
      {info.occupied ? (
        <div className="mt-3 space-y-2 text-xs text-slate-600">
          <Row icon={<TagIcon size={14} />} label="SKU" value={info.sku} />
          <Row icon={<Boxes size={14} />} label="Quantity" value={`${info.qty} units`} />
          <Row icon={<Scale size={14} />} label="Weight" value={`${info.weightKg} kg`} />
          <Row icon={<Layers size={14} />} label="Lot" value={info.lot} />
          <Row icon={<Calendar size={14} />} label="Received" value={`${t(info.receivedSec)} · ${ageDays(info.receivedSec, nowSec)} d old`} />
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500">Free for put-away. Ground-level slots are preferred for heavy pallets.</p>
      )}
    </>
  );
};

export const AisleCard: React.FC<{ wh: Warehouse; aisle: Aisle; nowSec: number; onLoc: (id: string) => void }> = ({ wh, aisle, nowSec, onLoc }) => {
  const locs = allLocs(wh).filter((l) => l.aisle === aisle.index);
  const infos = locs.map((l) => ({ l, i: locInfo(wh, l, nowSec) }));
  const occ = infos.filter((x) => x.i.occupied).length;
  const truck = wh.forklifts.find((f) => f.aisles.includes(aisle.index));
  return (
    <>
      <Head icon={<MapPin size={20} />} eyebrow={`Aisle · ${wh.building.label}`} title={`Aisle ${aisle.id}`} sub={`${aisle.bays} bays × ${aisle.levels} levels × 2 sides`} right={<SourceTag source="sim" />} />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Tile label="Occupied" value={`${occ}/${locs.length}`} bar={occ / Math.max(1, locs.length)} />
        <Tile label="Served by" value={truck?.id.split('-').pop() || '—'} sub={truck?.operator} />
      </div>
      {(['L', 'R'] as const).map((side) => (
        <div key={side} className="mt-3">
          <SectionLabel>{side === 'L' ? 'Left' : 'Right'} rack · level 1 at the bottom</SectionLabel>
          <div className="mt-1.5 grid gap-1" style={{ gridTemplateColumns: `repeat(${aisle.bays}, minmax(0,1fr))` }}>
            {Array.from({ length: aisle.levels }, (_, r) => aisle.levels - r).flatMap((level) =>
              Array.from({ length: aisle.bays }, (_, b) => {
                const hit = infos.find((x) => x.l.side === side && x.l.level === level && x.l.bay === b + 1)!;
                const id = locId(wh, hit.l);
                return (
                  <button
                    key={id}
                    onClick={() => onLoc(id)}
                    title={`${id} · ${hit.i.occupied ? `${hit.i.sku} · ${hit.i.qty} units` : 'empty'}`}
                    className={`h-6 rounded text-[9px] font-black ${hit.i.occupied ? 'bg-amber-200 text-amber-900 hover:bg-amber-300' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                  >
                    {b + 1}·{level}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ))}
    </>
  );
};

export const ZoneCard: React.FC<{ wh: Warehouse; zone: Zone; stats: WhStats }> = ({ wh, zone, stats }) => {
  const doors = wh.doors.filter((d) => (zone.kind === 'receiving' ? d.kind === 'in' : zone.kind === 'shipping' ? d.kind === 'out' : false));
  return (
    <>
      <Head icon={<Layers size={20} />} eyebrow={`Zone · ${wh.building.label}`} title={zone.label} sub={`${Math.round(zone.x1 - zone.x0)} × ${Math.round(zone.z0 - zone.z1)} m`} right={<SourceTag source={zone.kind === 'equipment' ? 'live' : 'sim'} />} />
      <div className="mt-3 space-y-2 text-xs text-slate-600">
        {zone.kind === 'receiving' && <Row icon={<Package size={14} />} label="Pallets waiting put-away" value={stats.receivingQueue} />}
        {zone.kind === 'shipping' && <Row icon={<Package size={14} />} label="Pallets ready to load" value={stats.shippingQueue} />}
        {zone.kind === 'storage' && <Row icon={<Boxes size={14} />} label="Locations used" value={`${stats.occupied}/${stats.locations}`} />}
        {zone.kind === 'equipment' && <Row icon={<Gauge size={14} />} label="Machines" value={wh.equipment.length} />}
        {doors.length > 0 && <Row icon={<ArrowRight size={14} />} label="Doors" value={doors.map((d) => d.id).join(' · ')} />}
      </div>
    </>
  );
};

export const ReachCard: React.FC<{ wh: Warehouse; s: ReachSnap }> = ({ wh, s }) => (
  <>
    <Head icon={<ForkliftIcon size={20} />} eyebrow={`Reach truck · ${wh.building.label}`} title={s.f.id} sub={`${s.f.operator} · aisles ${s.f.aisles.map((i) => wh.aisles[i].id).join(', ')}`} right={<SourceTag source="sim" />} />
    <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
      <Tag tone={s.status === 'waiting' ? 'slate' : s.status === 'lifting' ? 'amber' : 'green'}>{s.status}</Tag>
      <span className="truncate">{s.detail}</span>
    </div>
    <div className="mt-2 flex items-center gap-2">
      <Bar value={s.battery / 100} tone={s.battery < 35 ? 'amber' : 'green'} className="flex-1" />
      <span className="text-[11px] font-bold text-slate-500">Battery {s.battery}%</span>
    </div>
    <div className="mt-3 space-y-2 text-xs text-slate-600">
      <Row icon={<Package size={14} />} label="Carrying" value={s.carrying ? '1 pallet' : 'Empty'} />
      <Row icon={<Boxes size={14} />} label="Moves today" value={s.movesToday} />
      <Row icon={<ArrowRight size={14} />} label="Receives at" value={s.f.inDoor.id} />
      <Row icon={<ArrowRight size={14} />} label="Ships via" value={s.f.outDoor.id} />
      <Row icon={<Gauge size={14} />} label="Cycle" value={`${s.f.period}s · put-away + pick`} />
    </div>
  </>
);

const EQ_TONE: Record<EquipStatus, 'green' | 'slate' | 'amber' | 'blue'> = { RUNNING: 'green', IDLE: 'slate', WARNING: 'amber', FAULT: 'amber', MAINTENANCE: 'blue' };
const EQ_COLOR: Record<EquipStatus, string> = { RUNNING: '#22C55E', IDLE: '#CBD5E1', WARNING: '#F59E0B', FAULT: '#EF4444', MAINTENANCE: '#3B82F6' };

export const EquipmentCard: React.FC<{ s: EquipSnap; buildingLabel: string; nowSec: number; onRequest?: () => void }> = ({ s, buildingLabel, nowSec, onRequest }) => {
  const spec = KIND[s.item.kind];
  const tl = spec.powered ? equipTimeline(s.item, nowSec) : [];
  const mid = Math.floor((nowSec + 19800) / 86400) * 86400 - 19800;
  return (
    <>
      <Head icon={<Gauge size={20} />} eyebrow={`${spec.powered ? 'Equipment' : 'Fixture'} · ${buildingLabel}`} title={s.item.label} sub={s.item.id} right={<SourceTag source="sim" />} />
      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
        <Tag tone={spec.powered ? EQ_TONE[s.status] : 'slate'}>{s.statusLabel}</Tag>
        <span className="truncate">{s.reading}</span>
      </div>
      {s.issue && <div className="mt-3 rounded-xl border border-red-100 bg-red-50 p-2.5 text-xs font-bold text-red-700">{s.issue}</div>}
      {spec.powered ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Tile label="Uptime today" value={`${Math.round(s.uptimeToday * 100)}%`} bar={s.uptimeToday} />
            <Tile label="Utilisation · 1 h" value={`${Math.round(s.utilisation * 100)}%`} bar={s.utilisation} />
            <Tile label="Health" value={`${s.health}%`} bar={s.health / 100} />
            <Tile label="Cycles today" value={s.cyclesToday.toLocaleString()} />
          </div>
          <div className="mt-3 space-y-2 text-xs text-slate-600">
            <Row icon={<Calendar size={14} />} label="Last service" value={`${s.lastServiceDays} days ago`} />
            <Row icon={<Calendar size={14} />} label="Next service due" value={`in ${s.nextServiceDays} days`} />
          </div>
          <div className="mt-3">
            <SectionLabel>State today</SectionLabel>
            <div className="mt-1.5 flex h-4 w-full overflow-hidden rounded bg-slate-100">
              {tl.map((p, i) => (
                <span key={i} title={`${p.status.toLowerCase()} · ${new Date(p.from * 1000).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false })}`} style={{ width: `${((p.to - p.from) / Math.max(1, nowSec - mid)) * 100}%`, background: EQ_COLOR[p.status] }} />
              ))}
            </div>
          </div>
          {onRequest && (
            <button onClick={onRequest} className="mt-4 w-full rounded-xl bg-blue-600 py-2 text-xs font-bold text-white hover:bg-blue-700">
              Request maintenance
            </button>
          )}
        </>
      ) : (
        <p className="mt-3 text-xs text-slate-500">Storage fixture — fill level is shown above.</p>
      )}
    </>
  );
};
