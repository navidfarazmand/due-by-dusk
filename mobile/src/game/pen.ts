// The Pen (0.14; Navid, 15 Nov 2026: "instead of an album that do nothing, we can use these vegetables that goes out
// and put them into work. but all of this happen outside of the live game play, maybe we can call it prison lol").
//
// Every runaway caught (a town's big bill paid) works off its escape in the Pen. Workers earn money all the time,
// also while the game is closed; the Pen holds at most three hours of it, which the player collects (a rewarded ad
// doubles a collection). Money is counted in the money of the farthest town reached, so old workers stay useful
// after a border. Each worker can be levelled up with money: more pay per hour.
// Pure data and maths, no DOM.

export interface PenWorker {
  level: number;
  /** When it was caught (ms). */
  at: number;
}

export interface PenState {
  workers: Record<string, PenWorker>;
  /** The last collection (ms): the Pen fills from here. */
  since: number;
}

/** Hours of earnings the Pen holds before it is full. */
export const PEN_CAP_HOURS = 3;
export const PEN_MAX_LEVEL = 20;
/** A level 1 worker earns this share of an average day (at the farthest town) per hour; each level adds 40% of that. */
export const PEN_BASE = 0.04;
export const PEN_STEP = 0.4;

export function newPen(now = Date.now()): PenState {
  return { workers: {}, since: now };
}

export function parsePen(o: unknown, now = Date.now()): PenState {
  const pen = newPen(now);
  if (!o || typeof o !== 'object') return pen;
  const r = o as { workers?: Record<string, { level?: unknown; at?: unknown }>; since?: unknown };
  if (r.workers && typeof r.workers === 'object') {
    for (const [type, w] of Object.entries(r.workers)) {
      if (!/^[a-z_]{3,30}$/.test(type) || !w || typeof w !== 'object') continue;
      const level = Math.max(1, Math.min(PEN_MAX_LEVEL, Math.floor(Number(w.level) || 1)));
      pen.workers[type] = { level, at: Number.isFinite(Number(w.at)) ? Number(w.at) : now };
    }
  }
  const since = Number(r.since);
  pen.since = Number.isFinite(since) && since > 0 ? Math.min(since, now) : now;
  return pen;
}

export function workerCount(pen: PenState | undefined): number {
  return pen ? Object.keys(pen.workers).length : 0;
}

/** A worker's pay per hour, as a share of an average day. */
export function workerShare(level: number): number {
  return PEN_BASE * (1 + PEN_STEP * (Math.max(1, Math.min(PEN_MAX_LEVEL, level)) - 1));
}

/** Money per hour from one worker, given an average day's earnings at the farthest town. */
export function workerRate(level: number, avgDay: number): number {
  return workerShare(level) * Math.max(0, avgDay);
}

/** Money per hour from the whole Pen. */
export function penRate(pen: PenState | undefined, avgDay: number): number {
  if (!pen) return 0;
  let sum = 0;
  for (const w of Object.values(pen.workers)) sum += workerShare(w.level);
  return sum * Math.max(0, avgDay);
}

/** What the Pen holds now: earnings since the last collection, up to PEN_CAP_HOURS. */
export function penStored(pen: PenState | undefined, now: number, avgDay: number): number {
  if (!pen || !workerCount(pen)) return 0;
  const hours = Math.max(0, Math.min(PEN_CAP_HOURS, (now - pen.since) / 3_600_000));
  return Math.floor(hours * penRate(pen, avgDay));
}

/** How full the Pen is, 0..1. */
export function penFill(pen: PenState | undefined, now: number): number {
  if (!pen || !workerCount(pen)) return 0;
  return Math.max(0, Math.min(1, (now - pen.since) / (PEN_CAP_HOURS * 3_600_000)));
}

/** The price of a worker's next level (null at the top), in the money of the farthest town. */
export function workerCost(level: number, avgDay: number): number | null {
  if (level >= PEN_MAX_LEVEL) return null;
  const raw = Math.max(1, avgDay) * 0.5 * Math.pow(1.55, Math.max(0, level - 1));
  const step = raw < 100 ? 5 : raw < 1000 ? 10 : Math.pow(10, Math.max(1, Math.floor(Math.log10(raw)) - 2));
  return Math.max(step, Math.round(raw / step) * step);
}

/** A caught runaway joins the Pen (once). The Pen starts filling when its first worker arrives. */
export function addWorker(pen: PenState, type: string, now = Date.now()): boolean {
  if (!type || pen.workers[type]) return false;
  if (!workerCount(pen)) pen.since = now;
  pen.workers[type] = { level: 1, at: now };
  return true;
}

/** Collects what the Pen holds; returns the amount. */
export function collectPen(pen: PenState, now: number, avgDay: number): number {
  const amt = penStored(pen, now, avgDay);
  pen.since = now;
  return amt;
}
