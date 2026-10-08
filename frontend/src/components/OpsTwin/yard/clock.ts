/**
 * View clock for the Ops Twin. "live" follows server time; "replay" plays the yard back from a
 * chosen moment at ×1 / ×5 / ×20 (or paused). The yard model is a pure function of time, so
 * replaying is just evaluating it at an earlier time.
 */
export interface ViewClock {
  mode: 'live' | 'replay';
  anchorView: number; // view time (sec) at anchorReal
  anchorReal: number; // Date.now() when anchored
  speed: number;
  paused: boolean;
}

export const LIVE_CLOCK: ViewClock = { mode: 'live', anchorView: 0, anchorReal: 0, speed: 1, paused: false };
export const REPLAY_WINDOW = 2 * 3600; // how far back the scrubber goes

export function clockNow(c: ViewClock, serverOffsetMs: number): number {
  const live = (Date.now() + serverOffsetMs) / 1000;
  if (c.mode === 'live') return live;
  const t = c.paused ? c.anchorView : c.anchorView + ((Date.now() - c.anchorReal) / 1000) * c.speed;
  return Math.min(t, live);
}

/** Start replay (or move the replay head) at view time \`t\`. */
export const replayAt = (c: ViewClock, t: number): ViewClock => ({ ...c, mode: 'replay', anchorView: t, anchorReal: Date.now() });

/** Change speed / pause without jumping. */
export function retime(c: ViewClock, serverOffsetMs: number, patch: Partial<Pick<ViewClock, 'speed' | 'paused'>>): ViewClock {
  return { ...c, ...patch, anchorView: clockNow(c, serverOffsetMs), anchorReal: Date.now() };
}
