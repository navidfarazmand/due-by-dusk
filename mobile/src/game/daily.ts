// The daily farm and duels: one-day farms on a seeded field, with a set loadout so scores are comparable.
// The daily changes every date (the same farm, tool and crops for everyone); a duel is two players on one
// phone playing the same seeded day in turn.

import { ROUTE, cityById, routeIndex } from './world';
import { dayRef, expectedPower, planFor, type CityPlan, type CropWeight } from './plan';
import type { Levels } from './workshop';
import { newTools, toolStats, type ToolId } from './tools';
import { fieldPower } from './power';

export interface SideDef {
  seed: number;
  cityId: string;
  tool: ToolId;
  levels: Levels;
  /** Bronze, silver and gold scores. */
  targets: [number, number, number];
}

export interface DailyDef extends SideDef {
  date: string;
}

const TOOL_ORDER: ToolId[] = ['sickle', 'scythe', 'flame', 'blaster'];

/** FNV-1a, 32 bit. */
export function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0 || 1;
}

/** Upgrades a player who keeps up would have by route index k (from bot playthroughs that watch the ads),
 * so a daily farm or duel anywhere on the route is fair to play and nobody brings their own build. */
export function sideLoadout(k: number): Levels {
  const r = (a: number, b: number, max: number) => Math.min(max, Math.round(a + b * k));
  return {
    scythe: r(2, 2.2, 100),
    swing: r(1, 1.6, 30),
    hands: r(1, 1.6, 30),
    days: r(0.5, 1.2, 20),
    soil: r(0.5, 1.2, 24),
    market: r(1, 1.9, 60),
    clover: r(1, 1.6, 30),
  };
}

/** A good player's score on a side farm with the set loadout, as a share of the city's day reference, per tool:
 * from bot runs at Navid's finger speed (29 Oct, night; ten cities along the route, within about a quarter).
 * Side-farm crops are as tough for the loadout as the route's are for an on-track build, so the share holds
 * from Charlottetown to Japan. Market days pay about a quarter more. */
const SIDE_FIT: Record<ToolId, number> = { sickle: 0.59, scythe: 0.39, flame: 0.43, blaster: 0.32 };

/** Bronze, silver and gold: half a good run, most of one, and a little better than one. */
export function sideTargets(k: number, tool: ToolId, event = ''): [number, number, number] {
  const base = SIDE_FIT[tool] * dayRef(Math.max(0, k)) * (event === 'market' ? 1.22 : 0.95);
  const r = (v: number) => (v < 1000 ? Math.round(v / 10) * 10 : Math.round(v / 50) * 50);
  return [r(base * 0.5), r(base * 0.85), r(base * 1.1)];
}

export function dailyFor(date: string): DailyDef {
  const seed = hash32('dbd-daily:' + date);
  const city = ROUTE[seed % ROUTE.length];
  const tool = TOOL_ORDER[(seed >>> 7) % TOOL_ORDER.length];
  const k = routeIndex(city.id);
  return { date, seed, cityId: city.id, tool, levels: sideLoadout(k), targets: sideTargets(k, tool, planFor(city.id).signatureEvent) };
}

export function duelFor(cityId: string, tool: ToolId, seed: number): SideDef {
  const k = Math.max(0, routeIndex(cityId));
  return { seed: seed >>> 0 || 1, cityId, tool, levels: sideLoadout(k), targets: sideTargets(k, tool, planFor(cityId).signatureEvent) };
}

/** A one-day farm: the city's crops and difficulty with no bills and no boss. With the day's tool and upgrades, the
 * crops are as tough for that loadout as they are for an on-track player on the real route, so any tool on any
 * farm cuts about as many times. */
export function sidePlan(cityId: string, tool?: ToolId, levels?: Levels): CityPlan {
  const base = planFor(cityId);
  let p = base;
  if (tool && levels) {
    const st = toolStats({ ...newTools(), owned: [tool], equipped: tool }, tool);
    const r = fieldPower(levels, st, []) / expectedPower(base.index);
    if (r > 0 && Number.isFinite(r)) p = { ...base, hp: base.hp * Math.min(10, Math.max(0.1, r)) };
  }
  const name = cityById(cityId)?.short || 'the farm';
  // a one-day farm has the first five crops of its ladder out from the start
  const crops: CropWeight[] = p.crops.slice(0, 5).map(([t, w]) => [t, w, 0]);
  return {
    ...p,
    boss: false,
    bossFight: undefined,
    bills: [{ name: 'Best day', amt: 999_999_999, days: 99, note: `One day on the ${name} farm.` }],
    totalDays: 1,
    spare: 0,
    crops,
    stages: p.stages.slice(0, 5),
    goldAt: 0,
  };
}

/** 0 none, 1 bronze, 2 silver, 3 gold. */
export function medalOf(targets: [number, number, number], score: number): number {
  return score >= targets[2] ? 3 : score >= targets[1] ? 2 : score >= targets[0] ? 1 : 0;
}

export const MEDAL_NAME = ['No medal', 'Bronze', 'Silver', 'Gold'];
/** Ribbons for reaching each medal (the total, so a better medal later pays the difference). */
export const MEDAL_RIBBONS = [0, 1, 2, 4];

export interface DailyState {
  date: string;
  /** Scored tries used today (one free, more with a rewarded ad). */
  plays: number;
  adPlays: number;
  best: number;
  medal: number;
  goldDiamond: boolean;
}

export function newDaily(date = ''): DailyState {
  return { date, plays: 0, adPlays: 0, best: 0, medal: 0, goldDiamond: false };
}

export const DAILY_FREE_TRIES = 1;
export const DAILY_AD_TRIES = 2;

export function triesLeft(d: DailyState): number {
  return Math.max(0, DAILY_FREE_TRIES + d.adPlays - d.plays);
}
