// The daily farm and duels: one-day farms on a seeded field, with a set loadout so scores are comparable.
// The daily changes every date (the same farm, tool and crops for everyone); a duel is two players on one
// phone playing the same seeded day in turn.

import { ROUTE, cityById, routeIndex } from './world';
import { planFor, type CityPlan } from './plan';
import type { Levels } from './workshop';
import type { ToolId } from './tools';

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
    scythe: r(3, 0.38, 40),
    swing: r(1, 0.32, 15),
    hands: r(1, 0.32, 15),
    days: r(0.5, 0.26, 10),
    soil: r(1, 0.32, 15),
    market: r(1, 0.32, 20),
    clover: r(0.3, 0.26, 10),
  };
}

/** A good player's score on a side farm with the set loadout: a × g^k per tool, fitted from bot runs at
 * Navid's finger speed (29 Oct). Market days pay about a quarter more. */
const SIDE_FIT: Record<ToolId, [number, number]> = { sickle: [207, 1.1376], scythe: [241, 1.1364], flame: [330, 1.1306], blaster: [279, 1.1204] };

/** Bronze, silver and gold: half a good run, most of one, and a little better than one. */
export function sideTargets(k: number, tool: ToolId, event = ''): [number, number, number] {
  const [a, g] = SIDE_FIT[tool];
  const base = a * Math.pow(g, k) * (event === 'market' ? 1.22 : 0.95);
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

/** A one-day farm: the city's crops and difficulty with no bills and no boss. */
export function sidePlan(cityId: string): CityPlan {
  const p = planFor(cityId);
  const name = cityById(cityId)?.short || 'the farm';
  return {
    ...p,
    boss: false,
    bossFight: undefined,
    bills: [{ name: 'Best day', amt: 999_999_999, days: 99, note: `One day on the ${name} farm.` }],
    totalDays: 1,
    par: 1,
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
