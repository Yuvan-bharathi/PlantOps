import React from 'react';
import { ArrowRight, BatteryCharging, Boxes, ChevronRight, Cog, DoorOpen, Forklift as ForkliftIcon, Gauge, MapPin, Package, PlugZap, Truck, Warehouse, Zap } from 'lucide-react';
import { Pill, Row, SectionLabel, fmtTime } from '../ui';
import { statusOf } from '../status';
import { Bay, DoorKind, SiteDef, SITE_DEFS } from './layout';
import { ChargerSnap, ForkliftSnap, SiteSnapshot, Tone, TruckSnap } from './sim';

// ─── Small atoms ──────────────────────────────────────────────────────────────

const TONES: Record<Tone, { bg: string; text: string; dot: string }> = {
  green: { bg: '#DCFCE7', text: '#15803D', dot: '#16A34A' },
  blue: { bg: '#DBEAFE', text: '#1D4ED8', dot: '#2563EB' },
  amber: { bg: '#FEF3C7', text: '#B45309', dot: '#F59E0B' },
  purple: { bg: '#EDE9FE', text: '#6D28D9', dot: '#7C3AED' },
  slate: { bg: '#F1F5F9', text: '#475569', dot: '#94A3B8' },
};

export const Tag: React.FC<{ tone: Tone; children: React.ReactNode }> = ({ tone, children }) => (
  <span className="inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[11px] font-bold" style={{ background: TONES[tone].bg, color: TONES[tone].text }}>
    {children}
  </span>
);

export const Bar: React.FC<{ value: number; tone?: Tone; className?: string }> = ({ value, tone = 'blue', className = '' }) => (
  <div className={`h-1.5 overflow-hidden rounded-full bg-slate-100 ${className}`}>
    <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: TONES[tone].dot }} />
  </div>
);

const Tile: React.FC<{ label: string; value: React.ReactNode; sub?: string; bar?: number; tone?: Tone }> = ({ label, value, sub, bar, tone }) => (
  <div className="rounded-xl bg-slate-50 p-2.5">
    <div className="text-[10px] font-bold text-slate-400">{label}</div>
    <div className="text-base font-black text-slate-900">
      {value} {sub && <span className="text-[11px] font-semibold text-slate-400">{sub}</span>}
    </div>
    {bar !== undefined && <Bar value={bar} tone={tone} className="mt-1.5" />}
  </div>
);

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

export const SimNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="mt-3 rounded-xl bg-amber-50 p-2.5 text-[11px] leading-relaxed text-amber-700">{children}</p>
);

const bayOf = (t: TruckSnap) => `${SITE_DEFS.find((s) => t.key.startsWith(`${s.id}:`))?.code ?? ''} · ${t.bay.id}`;
const kindLabel = (k: DoorKind) => (k === 'in' ? 'Inbound' : 'Outbound');

/** Site code chip that fits codes of any length (MC, WH-02, DEPOT, OUT-01). */
export const SiteBadge: React.FC<{ code: string; dark?: boolean; size?: 'sm' | 'md' }> = ({ code, dark, size = 'md' }) => (
  <span
    className={`inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg px-1.5 font-black leading-none tracking-tight text-white ${
      size === 'md' ? 'h-9 min-w-[2.75rem] text-[10px]' : 'h-7 min-w-[2.25rem] text-[9px]'
    } ${dark ? 'bg-slate-800' : 'bg-gradient-to-br from-blue-500 to-blue-700 shadow-[0_2px_6px_rgba(37,99,235,0.35)]'}`}
  >
    {code}
  </span>
);

const fillTone = (f: number): Tone => (f >= 0.9 ? 'amber' : f >= 0.7 ? 'blue' : 'green');

// ─── Site / network cards ─────────────────────────────────────────────────────

export interface CellLine {
  running: number;
  total: number;
  worst: string;
  alerts: number;
  output: number;
  target: number;
}

export const SiteCard: React.FC<{ s: SiteDef; snap: SiteSnapshot; cell?: CellLine; onEnter: () => void }> = ({ s, snap, cell, onEnter }) => {
  const busy = snap.trucks.filter((t) => t?.phase === 'docked').length;
  const working = snap.forklifts.filter((f) => f.status !== 'charging' && f.status !== 'idle').length;
  const top = [...snap.forklifts].sort((a, b) => Number(b.status === 'loading' || b.status === 'unloading') - Number(a.status === 'loading' || a.status === 'unloading'))[0];
  const st = statusOf(cell?.worst);
  return (
    <>
      <Head icon={<Warehouse size={20} />} eyebrow={`${s.kind} · ${s.code}`} title={s.name} sub={`${s.buildings.map((b) => b.label).join(' · ')}`} />
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <Tag tone={cell?.worst === 'FAULT' ? 'amber' : 'green'}>{cell?.worst === 'FAULT' ? 'Attention' : 'Operational'}</Tag>
        <span>
          {snap.docked} docked · {snap.arriving} arriving · {snap.staged} staged
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Tile label="Pallets moved today" value={cell ? cell.output.toLocaleString() : '—'} sub="yard + halls" />
        <Tile label="Truck bays" value={`${busy} / ${s.bays.length}`} sub="busy" bar={busy / s.bays.length} tone="green" />
        <Tile label={s.liveFleet ? 'Deliveries today' : 'Outbound today'} value={snap.outboundToday} sub="trucks" />
        <Tile label="Staged pallets" value={snap.staged} sub={`/ ${s.slots.length} slots`} bar={snap.staged / Math.max(1, s.slots.length)} />
      </div>
      {cell && (
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between">
            <SectionLabel>Warehouse equipment</SectionLabel>
            <span className="text-[11px] font-bold" style={{ color: st.text }}>
              {cell.running}/{cell.total} up{cell.alerts ? ` · ${cell.alerts} alert${cell.alerts > 1 ? 's' : ''}` : ''}
            </span>
          </div>
          <Bar value={cell.total ? cell.running / cell.total : 0} tone={cell.worst === 'FAULT' ? 'amber' : 'green'} />
        </div>
      )}
      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between">
          <SectionLabel>Forklift fleet</SectionLabel>
          <span className="text-[11px] text-slate-400">
            {working}/{snap.forklifts.length + snap.spares.length} working
          </span>
        </div>
        {top && (
          <div className="flex items-center gap-2 text-xs">
            <span className="font-black text-slate-800">{top.def.id}</span>
            <span className="min-w-0 flex-1 truncate text-slate-500">{top.detail}</span>
            <Bar value={top.battery / 100} tone="green" className="w-14" />
            <span className="w-8 text-right text-[11px] text-slate-400">{top.battery}%</span>
          </div>
        )}
      </div>
      <button onClick={onEnter} className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700">
        <Cog size={14} /> Open facility interior <ArrowRight size={14} />
      </button>
      {!s.liveFleet && <SimNote>Trucks, forklifts and chargers in this yard are simulated (no RTLS or equipment feed yet).</SimNote>}
    </>
  );
};

export const NetworkCard: React.FC<{ snaps: Record<string, SiteSnapshot>; cells: Record<string, CellLine>; onPick: (id: string) => void }> = ({ snaps, cells, onPick }) => (
  <>
    <Head icon={<Warehouse size={20} />} eyebrow="Campus Hub · Chennai" title="Warehouse & Logistics Network" sub={`${SITE_DEFS.length} warehouse hubs · drag to rotate, scroll to zoom`} />
    <div className="mt-3 space-y-1.5">
      {SITE_DEFS.map((s) => {
        const sn = snaps[s.id];
        const c = cells[s.id];
        const fill = s.slots.length ? sn.staged / s.slots.length : 0;
        return (
          <button
            key={s.id}
            onClick={() => onPick(s.id)}
            className="group w-full rounded-xl border border-slate-100 bg-white px-3 py-2.5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-blue-200 hover:bg-blue-50/50"
          >
            <div className="flex items-center gap-2.5">
              <SiteBadge code={s.code} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-black leading-tight text-slate-800" title={s.name}>
                    {s.name}
                  </span>
                  <ChevronRight size={14} className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-500" />
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <Bar value={fill} tone={fillTone(fill)} className="flex-1" />
                  <span className="shrink-0 text-[10px] font-bold tabular-nums text-slate-500">{Math.round(fill * 100)}% staged</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2 whitespace-nowrap text-[10.5px] text-slate-500">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="inline-flex items-center gap-1" title="Truck bays occupied">
                      <Truck size={11} className="text-slate-400" />
                      {sn.docked}/{s.bays.length}
                    </span>
                    <span className="inline-flex items-center gap-1" title="Trucks arriving">
                      <ArrowRight size={11} className="text-slate-400" />
                      {sn.arriving} in
                    </span>
                    <span className="inline-flex items-center gap-1" title="Pallets staged / slots">
                      <Boxes size={11} className="text-slate-400" />
                      {sn.staged}/{s.slots.length}
                    </span>
                  </span>
                  {c && <Pill status={c.worst}>{`${c.running}/${c.total}`}</Pill>}
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  </>
);

// ─── Entity cards ─────────────────────────────────────────────────────────────

export const TruckCard: React.FC<{ t: TruckSnap }> = ({ t }) => {
  const prog = t.phase === 'docking' && t.metersLeft !== undefined ? 1 - Math.min(1, t.metersLeft / 140) : t.pallets.total ? t.pallets.done / t.pallets.total : 0;
  const minsLeft = t.eta ? Math.max(0, Math.round((Date.parse(t.eta) - Date.now()) / 60000)) : null;
  return (
    <>
      <Head icon={<Truck size={20} />} eyebrow={t.carrier.name} title={t.id} sub={`${t.driver} · ${t.plate}`} />
      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
        <Tag tone={t.tone}>{t.label.replace(/ \d+\/\d+$/, '')}</Tag>
        <span className="truncate">{t.detail}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Bar value={prog} tone={t.tone} className="flex-1" />
        <span className="text-[11px] font-bold text-slate-500">{t.phase === 'docking' && t.metersLeft !== undefined ? `${t.metersLeft} m left` : `${t.pallets.done}/${t.pallets.total}`}</span>
      </div>
      <div className="mt-3 space-y-2 text-xs text-slate-600">
        <Row icon={<Package size={14} />} label="Shipment" value={<span className="text-blue-600">#{t.shipmentId}</span>} />
        <Row icon={<MapPin size={14} />} label={t.kind === 'in' ? 'From' : 'Customer'} value={t.kind === 'in' ? t.from : t.to} />
        <Row icon={<Warehouse size={14} />} label="Destination" value={t.kind === 'in' ? t.to : t.to} />
        <Row icon={<Gauge size={14} />} label="ETA" value={t.eta ? `${fmtTime(t.eta)}${minsLeft !== null ? ` (${minsLeft} min)` : ''}` : '—'} />
        <Row icon={<Zap size={14} />} label="Speed" value={`${t.speedKmh} km/h`} />
        <Row icon={<DoorOpen size={14} />} label="Bay" value={<span className="text-blue-600">{bayOf(t)}</span>} />
        <Row icon={<Boxes size={14} />} label="Cargo" value={`${t.pallets.done}/${t.pallets.total} pallets · ${t.cargoTonnes} t`} />
      </div>
      {t.live ? (
        <p className="mt-3 rounded-xl bg-blue-50 p-2.5 text-[11px] leading-relaxed text-blue-700">Live PlantOps fleet truck — load and trip timeline come from the dispatch engine.</p>
      ) : (
        <SimNote>Simulated carrier movement for this cell&apos;s yard.</SimNote>
      )}
    </>
  );
};

export const ForkliftCard: React.FC<{ f: ForkliftSnap; site: SiteDef }> = ({ f, site }) => (
  <>
    <Head icon={<ForkliftIcon size={20} />} eyebrow={`Forklift · ${site.code}`} title={f.def.id} sub={`${f.def.operator} · ${f.def.model}`} />
    <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
      <Tag tone={f.tone}>{f.statusLabel}</Tag>
      <span className="truncate">{f.detail}</span>
    </div>
    <div className="mt-2 flex items-center gap-2">
      <Bar value={f.battery / 100} tone={f.battery < 35 ? 'amber' : 'green'} className="flex-1" />
      <span className="text-[11px] font-bold text-slate-500">Battery {f.battery}%</span>
    </div>
    <div className="mt-3 space-y-2 text-xs text-slate-600">
      <Row icon={<Package size={14} />} label="Carrying" value={f.carrying ? '1 pallet' : 'Empty'} />
      <Row icon={<Boxes size={14} />} label="Moves today" value={f.movesToday} />
      <Row icon={<Zap size={14} />} label="Speed" value={`${f.speedKmh.toFixed(1)} km/h`} />
      <Row icon={<PlugZap size={14} />} label="Charger" value={f.charger} />
      <Row icon={<Warehouse size={14} />} label="Site" value={site.name} />
    </div>
    <SimNote>Forklift positions are simulated along the yard route map (no RTLS tags yet).</SimNote>
  </>
);

export const ChargerCard: React.FC<{ c: ChargerSnap; site: SiteDef }> = ({ c, site }) => (
  <>
    <Head icon={<BatteryCharging size={20} />} eyebrow={`Charger · ${site.code}`} title={c.id} sub="48 V lithium-ion forklift charger" />
    <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
      <Tag tone={c.busy ? 'amber' : 'green'}>{c.busy ? 'Charging' : 'Free'}</Tag>
      <span>{c.busy ? `${c.forklift} at ${c.battery}%` : 'Ready for the next forklift'}</span>
    </div>
    <div className="mt-3 space-y-2 text-xs text-slate-600">
      <Row icon={<ForkliftIcon size={14} />} label="Forklift" value={c.forklift ? `${c.forklift} · battery ${c.battery}%` : '—'} />
      <Row icon={<Boxes size={14} />} label="Sessions today" value={c.sessionsToday} />
      <Row icon={<Zap size={14} />} label="Energy today" value={`${c.energyKwh} kWh`} />
      <Row icon={<Gauge size={14} />} label="Charge rate" value={`${c.ratePerMin}% a minute`} />
      <Row icon={<Warehouse size={14} />} label="Site" value={site.name} />
    </div>
  </>
);

export const DockCard: React.FC<{ bay: Bay; site: SiteDef; t: TruckSnap | null }> = ({ bay, site, t }) => {
  const docked = t && t.phase === 'docked';
  return (
    <>
      <Head icon={<DoorOpen size={20} />} eyebrow={`${kindLabel(bay.kind)} dock · ${site.code}`} title={bay.id} sub={`Forklift door ${bay.doorId}`} />
      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
        <Tag tone={docked ? 'green' : t && t.phase === 'docking' ? 'blue' : 'slate'}>{docked ? (bay.kind === 'in' ? 'Unloading' : 'Loading') : t && t.phase === 'docking' ? 'Docking' : 'Available'}</Tag>
        <span>{t && (docked || t.phase === 'docking') ? `${t.id} · ${t.carrier.name}` : 'No truck assigned'}</span>
      </div>
      {t && docked && (
        <div className="mt-2 flex items-center gap-2">
          <Bar value={t.pallets.total ? t.pallets.done / t.pallets.total : 0} tone="green" className="flex-1" />
          <span className="text-[11px] font-bold text-slate-500">
            {t.pallets.done}/{t.pallets.total}
          </span>
        </div>
      )}
      {t && !docked && t.phase !== 'docking' && <p className="mt-3 text-xs text-slate-500">Next: {t.id} ({t.carrier.name}) · {t.detail}</p>}
    </>
  );
};

export const PalletCard: React.FC<{ id: string; site: SiteDef }> = ({ id, site }) => (
  <>
    <Head icon={<Package size={20} />} eyebrow={`Staging lane · ${site.code}`} title={id} sub={site.stagedLabel} />
    <div className="mt-3 space-y-2 text-xs text-slate-600">
      <Row icon={<MapPin size={14} />} label="Location" value={`${site.name} · staging`} />
      <Row icon={<Boxes size={14} />} label="Contents" value={site.stagedLabel} />
    </div>
    {site.liveFleet ? (
      <p className="mt-3 rounded-xl bg-blue-50 p-2.5 text-[11px] leading-relaxed text-blue-700">Staged pallet count comes from the outbound dock (DELIVERED_DOCK pallets waiting for a truck).</p>
    ) : (
      <SimNote>Staging buffer is simulated for this cell.</SimNote>
    )}
  </>
);

export const BuildingCard: React.FC<{ site: SiteDef; buildingId: string; cell?: CellLine; machines: { code: string; status?: string }[]; onEnter: () => void }> = ({ site, buildingId, cell, machines, onEnter }) => {
  const b = site.buildings.find((x) => x.id === buildingId)!;
  return (
    <>
      <Head icon={<Warehouse size={20} />} eyebrow={`${site.code} · ${b.production ? 'Main hall' : 'Annex'}`} title={b.label} sub={`${b.width} × ${b.depth} m · ${b.doors.length} doors`} right={cell && cell.total ? <Pill status={cell.worst} /> : undefined} />
      <div className="mt-3 flex flex-wrap gap-1.5">
        {b.doors.map((d) => (
          <Tag key={d.id} tone={d.kind === 'in' ? 'blue' : 'green'}>
            {d.id}
          </Tag>
        ))}
      </div>
      {(
        <>
          <div className="mt-3 space-y-1">
            {machines.map((m) => (
              <div key={m.code} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs hover:bg-slate-50">
                <span className="font-bold text-slate-700">{m.code}</span>
                <Pill status={m.status} />
              </div>
            ))}
          </div>
          <button onClick={onEnter} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700">
            Enter building <ArrowRight size={14} />
          </button>
        </>
      )}
    </>
  );
};

// ─── Queue rows ───────────────────────────────────────────────────────────────

export const DockRow: React.FC<{ site: SiteDef; bay: Bay; t: TruckSnap | null; active: boolean; onClick: () => void; showSite: boolean }> = ({ site, bay, t, active, onClick, showSite }) => {
  const docked = t?.phase === 'docked';
  const docking = t?.phase === 'docking';
  return (
    <button onClick={onClick} className={`grid w-full grid-cols-[64px_1fr_86px_56px_14px] items-center gap-2 rounded-xl px-2.5 py-2 text-left ${active ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-slate-50'}`}>
      <div>
        <div className="text-xs font-black text-slate-800">{bay.id}</div>
        <div className="text-[10px] text-slate-400">{showSite ? site.code : kindLabel(bay.kind)}</div>
      </div>
      <div className="truncate text-xs text-slate-600">
        {t && (docked || docking) ? (
          <>
            <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full" style={{ background: TONES[t.tone].dot }} />
            {t.id} · {t.carrier.name.split(' ')[0]}
          </>
        ) : (
          <span className="text-slate-400">No truck assigned</span>
        )}
      </div>
      <Tag tone={docked ? 'green' : docking ? 'blue' : 'slate'}>{docked ? (bay.kind === 'in' ? 'Unloading' : 'Loading') : docking ? 'Docking' : 'Available'}</Tag>
      <div>
        {docked && t ? (
          <>
            <Bar value={t.pallets.total ? t.pallets.done / t.pallets.total : 0} tone="green" />
            <div className="mt-0.5 text-[10px] text-slate-400">
              {t.pallets.done}/{t.pallets.total}
            </div>
          </>
        ) : null}
      </div>
      <ChevronRight size={14} className="text-slate-300" />
    </button>
  );
};

export const TruckRow: React.FC<{ t: TruckSnap; active: boolean; onClick: () => void }> = ({ t, active, onClick }) => {
  const yard = t.phase === 'docked' || t.phase === 'docking' || t.phase === 'road' || t.phase === 'departing';
  return (
    <button onClick={onClick} className={`grid w-full grid-cols-[72px_1fr_86px_56px_14px] items-center gap-2 rounded-xl px-2.5 py-2 text-left ${active ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-slate-50'}`}>
      <div className="min-w-0">
        <div className="text-xs font-black text-slate-800">{t.id}</div>
        <div className="truncate text-[10px] text-slate-400">{t.carrier.name}</div>
      </div>
      <div className="truncate text-xs text-slate-600">
        <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full" style={{ background: TONES[t.tone].dot }} />
        {yard ? bayOf(t) : t.phase === 'away' ? `To ${t.to}` : `To ${bayOf(t).split(' · ')[0]}`}
      </div>
      <Tag tone={t.tone}>{t.label.replace(/ \d+\/\d+$/, '')}</Tag>
      <div className="text-[10px] text-slate-400">
        {t.phase === 'docked' ? (
          <>
            <Bar value={t.pallets.total ? t.pallets.done / t.pallets.total : 0} tone="green" />
            <div className="mt-0.5">
              {t.pallets.done}/{t.pallets.total}
            </div>
          </>
        ) : t.phase === 'docking' ? (
          'docking'
        ) : t.phase === 'enroute' ? (
          t.detail.replace('ETA ', '')
        ) : (
          ''
        )}
      </div>
      <ChevronRight size={14} className="text-slate-300" />
    </button>
  );
};

export const ForkliftRow: React.FC<{ f: ForkliftSnap; active: boolean; onClick: () => void; site: SiteDef; showSite: boolean }> = ({ f, active, onClick, site, showSite }) => (
  <button onClick={onClick} className={`grid w-full grid-cols-[64px_1fr_86px_56px_14px] items-center gap-2 rounded-xl px-2.5 py-2 text-left ${active ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-slate-50'}`}>
    <div>
      <div className="text-xs font-black text-slate-800">{f.def.id}</div>
      <div className="truncate text-[10px] text-slate-400">{showSite ? site.code : f.def.operator}</div>
    </div>
    <div className="truncate text-xs text-slate-600">{f.detail}</div>
    <Tag tone={f.tone}>{f.statusLabel}</Tag>
    <div>
      <Bar value={f.battery / 100} tone={f.battery < 35 ? 'amber' : 'green'} />
      <div className="mt-0.5 text-[10px] text-slate-400">{f.battery}%</div>
    </div>
    <ChevronRight size={14} className="text-slate-300" />
  </button>
);
