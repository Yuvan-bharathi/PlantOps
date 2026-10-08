import React from 'react';
import { BarChart3, Bell, Expand, FastForward, HelpCircle, History, Layers, Minimize, Pause, Play, Radio, Search } from 'lucide-react';
import { clockNow, LIVE_CLOCK, REPLAY_WINDOW, replayAt, retime, ViewClock } from '../yard/clock';

const fmt = (sec: number) => new Date(sec * 1000).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

const IconButton: React.FC<{ icon: React.ReactNode; label: string; active?: boolean; badge?: number; badgeTone?: 'red' | 'amber'; onClick: () => void; kbd?: string }> = ({
  icon,
  label,
  active,
  badge,
  badgeTone = 'red',
  onClick,
  kbd,
}) => (
  <button
    onClick={onClick}
    title={kbd ? `${label} (${kbd})` : label}
    aria-label={label}
    className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition ${
      active ? 'bg-blue-600 text-white shadow-[0_4px_12px_rgba(37,99,235,0.35)]' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
    }`}
  >
    {icon}
    {!!badge && (
      <span className={`absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full px-1 text-center text-[10px] font-black leading-[18px] text-white ring-2 ring-white ${badgeTone === 'red' ? 'bg-red-500' : 'bg-amber-500'}`}>
        {badge > 99 ? '99+' : badge}
      </span>
    )}
  </button>
);

/** Live / Replay clock pill (toggles replay). */
export const ClockPill: React.FC<{ clock: ViewClock; setClock: (c: ViewClock) => void; offsetMs: number }> = ({ clock, setClock, offsetMs }) => {
  const live = clockNow(LIVE_CLOCK, offsetMs);
  const now = clockNow(clock, offsetMs);
  const replay = clock.mode === 'replay';
  return (
    <button
      onClick={() => setClock(replay ? LIVE_CLOCK : replayAt({ ...LIVE_CLOCK, speed: 5 }, live - 1800))}
      title={replay ? 'Back to live (R)' : 'Replay the last 2 hours (R)'}
      className={`flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-bold ${replay ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' : 'bg-emerald-50 text-emerald-700'}`}
    >
      {replay ? <History size={14} /> : <Radio size={14} className="animate-pulse" />}
      <span>{replay ? 'Replay' : 'Live'}</span>
      <span className="font-mono tabular-nums">{fmt(now)}</span>
    </button>
  );
};

/** Replay controls, shown as a floating bar while replaying. */
export const ReplayBar: React.FC<{ clock: ViewClock; setClock: (c: ViewClock) => void; offsetMs: number }> = ({ clock, setClock, offsetMs }) => {
  const live = clockNow(LIVE_CLOCK, offsetMs);
  const now = clockNow(clock, offsetMs);
  const back = Math.max(0, Math.min(REPLAY_WINDOW, live - now));
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-white px-3 py-1.5 shadow-[0_10px_30px_rgba(15,23,42,0.14)]">
      <span className="rounded-md bg-amber-500 px-1.5 py-0.5 text-[10px] font-black text-white">REPLAY</span>
      <button onClick={() => setClock(retime(clock, offsetMs, { paused: !clock.paused }))} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100" title={clock.paused ? 'Play (Space)' : 'Pause (Space)'}>
        {clock.paused ? <Play size={14} /> : <Pause size={14} />}
      </button>
      <input
        type="range"
        min={0}
        max={REPLAY_WINDOW}
        step={10}
        value={REPLAY_WINDOW - back}
        onChange={(e) => setClock(replayAt(clock, live - REPLAY_WINDOW + Number(e.target.value)))}
        className="h-1 w-56 cursor-pointer accent-blue-600"
        aria-label="Replay position"
      />
      <span className="w-12 text-right font-mono text-[11px] text-slate-500">-{Math.floor(back / 60)}m</span>
      {[1, 5, 20].map((sp) => (
        <button
          key={sp}
          onClick={() => setClock(retime(clock, offsetMs, { speed: sp, paused: false }))}
          className={`h-7 rounded-lg px-2 text-[11px] font-black ${clock.speed === sp && !clock.paused ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          ×{sp}
        </button>
      ))}
      <button onClick={() => setClock(LIVE_CLOCK)} className="ml-1 flex h-7 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-[11px] font-black text-white" title="Jump to live">
        <FastForward size={11} /> Live
      </button>
      <span className="hidden pl-1 text-[10px] text-slate-400 xl:inline">Yard movements replayed · machine status shows now</span>
    </div>
  );
};

export const Toolbar: React.FC<{
  onSearch: () => void;
  alertsOpen: boolean;
  onAlerts: () => void;
  alertCount: number;
  critical: number;
  analyticsOpen: boolean;
  onAnalytics: () => void;
  layersOpen: boolean;
  onLayers: () => void;
  fullscreen: boolean;
  onFullscreen: () => void;
  onHelp: () => void;
}> = (p) => (
  <div className="flex items-center gap-0.5">
    <IconButton icon={<Search size={17} />} label="Search" onClick={p.onSearch} kbd="Ctrl+K" />
    <IconButton icon={<Bell size={17} />} label="Alerts" active={p.alertsOpen} onClick={p.onAlerts} badge={p.alertCount} badgeTone={p.critical ? 'red' : 'amber'} kbd="A" />
    <IconButton icon={<BarChart3 size={17} />} label="Analytics" active={p.analyticsOpen} onClick={p.onAnalytics} kbd="D" />
    <IconButton icon={<Layers size={17} />} label="Map layers" active={p.layersOpen} onClick={p.onLayers} kbd="L" />
    <IconButton icon={p.fullscreen ? <Minimize size={17} /> : <Expand size={17} />} label={p.fullscreen ? 'Exit full screen' : 'Full screen'} onClick={p.onFullscreen} kbd="X" />
    <IconButton icon={<HelpCircle size={17} />} label="Keyboard shortcuts" onClick={p.onHelp} kbd="?" />
  </div>
);
