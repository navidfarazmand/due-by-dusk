// The Pen (0.14; Navid, 15 Nov 2026: "instead of an album that do nothing, we can use these vegetables that goes out
// and put them into work. but all of this happen outside of the live game play, maybe we can call it prison lol").
//
// Every runaway caught (a town's big bill paid) works off its escape in the Pen. Workers earn money all the time,
// also while the game is closed; the Pen holds at most three hours of it, which the player collects (a rewarded ad
// doubles a collection). Money is counted in the money of the farthest town reached, so old workers stay useful
// after a border.
// 0.15 (Navid, 15 Nov: "the pen is making so much money that player can not work and pay all the bills ... 662 an
// hour? with all vegetables at level 1"; "make their upgrades by the level that happens in the game like when you
// hit more carrot the carrot levels up"): a worker earns a sixth of what it did, and its level is its vegetable's
// level from the player's own cuts (road.ts, cropLevel), not bought.
// Pure data and maths, no DOM.

import { CROP_LEVEL_MAX, cropLevel } from './road';

export interface PenWorker {
  /** Until 0.15 a bought level; now the vegetable's own level (cropLevel of its cuts) counts. */
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
export const PEN_MAX_LEVEL = CROP_LEVEL_MAX;
/** A level 1 worker earns this share of an average day (at the farthest town) per hour; each level adds a quarter of
 *  that. Six workers at level 1 fill the Pen with about a sixth of a day in three hours. */
export const PEN_BASE = 0.006;
export const PEN_STEP = 0.25;

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
      const level = Math.max(1, Math.min(20, Math.floor(Number(w.level) || 1)));
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

/** A worker's level: its vegetable's level from the player's cuts. */
export function workerLevel(type: string, cuts: Record<string, number> | undefined): number {
  return cropLevel((cuts && cuts[type]) || 0);
}

/** A worker's pay per hour, as a share of an average day. */
export function workerShare(level: number): number {
  return PEN_BASE * (1 + PEN_STEP * (Math.max(1, Math.min(PEN_MAX_LEVEL, level)) - 1));
}

/** Money per hour from one worker, given an average day's earnings at the farthest town. */
export function workerRate(level: number, avgDay: number): number {
  return workerShare(level) * Math.max(0, avgDay);
}

/** Money per hour from the whole Pen (`cuts`: the player's cuts by vegetable, which set each worker's level). */
export function penRate(pen: PenState | undefined, avgDay: number, cuts?: Record<string, number>): number {
  if (!pen) return 0;
  let sum = 0;
  for (const type of Object.keys(pen.workers)) sum += workerShare(workerLevel(type, cuts));
  return sum * Math.max(0, avgDay);
}

/** What the Pen holds now: earnings since the last collection, up to PEN_CAP_HOURS. */
export function penStored(pen: PenState | undefined, now: number, avgDay: number, cuts?: Record<string, number>): number {
  if (!pen || !workerCount(pen)) return 0;
  const hours = Math.max(0, Math.min(PEN_CAP_HOURS, (now - pen.since) / 3_600_000));
  return Math.floor(hours * penRate(pen, avgDay, cuts));
}

/** How full the Pen is, 0..1. */
export function penFill(pen: PenState | undefined, now: number): number {
  if (!pen || !workerCount(pen)) return 0;
  return Math.max(0, Math.min(1, (now - pen.since) / (PEN_CAP_HOURS * 3_600_000)));
}

/** A caught runaway joins the Pen (once). The Pen starts filling when its first worker arrives. */
export function addWorker(pen: PenState, type: string, now = Date.now()): boolean {
  if (!type || pen.workers[type]) return false;
  if (!workerCount(pen)) pen.since = now;
  pen.workers[type] = { level: 1, at: now };
  return true;
}

/** Collects what the Pen holds; returns the amount. */
export function collectPen(pen: PenState, now: number, avgDay: number, cuts?: Record<string, number>): number {
  const amt = penStored(pen, now, avgDay, cuts);
  pen.since = now;
  return amt;
}
