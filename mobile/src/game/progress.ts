// Progress across the whole game: which farms are won, stars, crowns, the workshop and ad counters.
// The farm being played (day, bills, cash in hand) lives in the engine's own save; this one is the game's.

import { COUNTRIES, ROUTE, type CountryCode, countryOf, cityById } from './world';
import { emptyLevels, type WorkshopState } from './workshop';
import { newTools, parseTools, toolDef, type ToolId, type ToolsState } from './tools';

export const GAME_SAVE_KEY = 'dbd-game-v3';

export interface CityProgress {
  won: boolean;
  /** Best stars earned (0–3). */
  stars: number;
  /** Best single day in this city. */
  bestDay: number;
  /** Beat the rival's record day at least once. */
  crown: boolean;
  /** Fewest days to pay off the farm. */
  bestDays: number;
  plays: number;
}

export interface RunInfo {
  cityId: string;
  /** Wallet when the farm started: a foreclosure gives back at most this much. */
  startCash: number;
  startedAt: number;
  bestDay: number;
}

export interface AdCounters {
  /** Local date (YYYY-MM-DD) the counters belong to. */
  date: string;
  coins: number;
  doubles: number;
  finishes: number;
  lastCoinsAt: number;
}

export interface Settings {
  music: boolean;
  haptics: boolean;
}

export interface GameSave {
  v: 3;
  createdAt: number;
  cities: Record<string, CityProgress>;
  run: RunInfo | null;
  /** Wallet between farms (while a farm runs, the engine's cash is the wallet). */
  wallet: number;
  workshop: WorkshopState;
  tools: ToolsState;
  ads: AdCounters;
  settings: Settings;
  seen: Record<string, boolean>;
  totals: { days: number; crops: number; earned: number };
}

export function newGame(now = Date.now()): GameSave {
  return {
    v: 3,
    createdAt: now,
    cities: {},
    run: null,
    wallet: 0,
    workshop: { levels: emptyLevels(), job: null },
    tools: newTools(),
    ads: { date: '', coins: 0, doubles: 0, finishes: 0, lastCoinsAt: 0 },
    settings: { music: true, haptics: true },
    seen: {},
    totals: { days: 0, crops: 0, earned: 0 },
  };
}

function num(v: unknown, d = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : d;
}

/** Validates untrusted saved JSON; anything unreadable starts a new game. */
export function parseGame(raw: string | null): GameSave {
  const g = newGame();
  if (!raw) return g;
  let o: any;
  try {
    o = JSON.parse(raw);
  } catch {
    return g;
  }
  if (!o || typeof o !== 'object' || o.v !== 3) return g;
  g.createdAt = num(o.createdAt, g.createdAt);
  if (o.cities && typeof o.cities === 'object') {
    for (const c of ROUTE) {
      const p = o.cities[c.id];
      if (!p || typeof p !== 'object') continue;
      g.cities[c.id] = {
        won: !!p.won,
        stars: Math.max(0, Math.min(3, Math.floor(num(p.stars)))),
        bestDay: Math.max(0, num(p.bestDay)),
        crown: !!p.crown,
        bestDays: Math.max(0, Math.floor(num(p.bestDays))),
        plays: Math.max(0, Math.floor(num(p.plays))),
      };
    }
  }
  if (o.run && typeof o.run === 'object' && typeof o.run.cityId === 'string' && cityById(o.run.cityId)) {
    g.run = {
      cityId: o.run.cityId,
      startCash: Math.max(0, num(o.run.startCash)),
      startedAt: num(o.run.startedAt),
      bestDay: Math.max(0, num(o.run.bestDay)),
    };
  }
  g.wallet = Math.max(0, num(o.wallet));
  if (o.workshop && typeof o.workshop === 'object') {
    const lv = o.workshop.levels || {};
    for (const k of Object.keys(g.workshop.levels) as Array<keyof typeof g.workshop.levels>) {
      g.workshop.levels[k] = Math.max(0, Math.min(60, Math.floor(num(lv[k]))));
    }
    const j = o.workshop.job;
    if (j && typeof j === 'object' && j.id in g.workshop.levels) {
      g.workshop.job = { id: j.id, level: Math.floor(num(j.level)), startedAt: num(j.startedAt), endsAt: num(j.endsAt) };
    }
  }
  g.tools = parseTools(o.tools);
  if (o.ads && typeof o.ads === 'object') {
    g.ads = {
      date: typeof o.ads.date === 'string' ? o.ads.date : '',
      coins: Math.floor(num(o.ads.coins)),
      doubles: Math.floor(num(o.ads.doubles)),
      finishes: Math.floor(num(o.ads.finishes)),
      lastCoinsAt: num(o.ads.lastCoinsAt),
    };
  }
  if (o.settings && typeof o.settings === 'object') {
    g.settings = { music: o.settings.music !== false, haptics: o.settings.haptics !== false };
  }
  if (o.seen && typeof o.seen === 'object') for (const k of Object.keys(o.seen)) g.seen[k] = !!o.seen[k];
  if (o.totals && typeof o.totals === 'object') {
    g.totals = { days: num(o.totals.days), crops: num(o.totals.crops), earned: num(o.totals.earned) };
  }
  return g;
}

export function cityProgress(g: GameSave, cityId: string): CityProgress {
  return g.cities[cityId] || { won: false, stars: 0, bestDay: 0, crown: false, bestDays: 0, plays: 0 };
}

export function countryStars(g: GameSave, code: CountryCode): number {
  return countryOf(code).cities.reduce((a, c) => a + cityProgress(g, c.id).stars, 0);
}

export function totalStars(g: GameSave): number {
  return ROUTE.reduce((a, c) => a + cityProgress(g, c.id).stars, 0);
}

export function crownCount(g: GameSave): number {
  return ROUTE.filter(c => cityProgress(g, c.id).crown).length;
}

/** Stars the previous country must hold (out of 3 per farm) to open the next one. */
export function starGate(code: CountryCode): number {
  return Math.ceil(countryOf(code).cities.length * 3 * 0.6);
}

export interface CountryLock {
  open: boolean;
  /** Why it is closed, in a few words. */
  reason: string;
  needStars: number;
  haveStars: number;
}

export function countryLock(g: GameSave, code: CountryCode): CountryLock {
  const i = COUNTRIES.findIndex(c => c.code === code);
  if (i <= 0) return { open: true, reason: '', needStars: 0, haveStars: 0 };
  const prev = COUNTRIES[i - 1];
  const boss = prev.cities[prev.cities.length - 1];
  const need = starGate(prev.code), have = countryStars(g, prev.code);
  const bossWon = cityProgress(g, boss.id).won;
  if (bossWon && have >= need) return { open: true, reason: '', needStars: need, haveStars: have };
  const reason = !bossWon ? `Win ${boss.short} in ${prev.name}` : `${need - have} more ★ in ${prev.name}`;
  return { open: false, reason, needStars: need, haveStars: have };
}

export interface CityLock {
  open: boolean;
  reason: string;
}

export function cityLock(g: GameSave, cityId: string): CityLock {
  const c = cityById(cityId);
  if (!c) return { open: false, reason: '' };
  const cl = countryLock(g, c.country);
  if (!cl.open) return { open: false, reason: cl.reason };
  const list = countryOf(c.country).cities;
  const i = list.findIndex(x => x.id === cityId);
  if (i <= 0) return { open: true, reason: '' };
  const prev = list[i - 1];
  return cityProgress(g, prev.id).won ? { open: true, reason: '' } : { open: false, reason: `Win ${prev.short} to open` };
}

/** True once the boss farm (the last city) of a country has been won. */
export function bossBeaten(g: GameSave, code: CountryCode): boolean {
  const list = countryOf(code).cities;
  return cityProgress(g, list[list.length - 1].id).won;
}

export interface ToolLock {
  open: boolean;
  reason: string;
}

/** A tool goes on sale when the boss of its country is beaten. */
export function toolLock(g: GameSave, id: ToolId): ToolLock {
  const def = toolDef(id);
  if (!def.after || bossBeaten(g, def.after)) return { open: true, reason: '' };
  const c = countryOf(def.after);
  return { open: false, reason: `Beat ${c.name}'s boss` };
}

/** The farm the player should look at next: the current run, else the first open city not yet won. */
export function nextCity(g: GameSave): string {
  if (g.run) return g.run.cityId;
  for (const c of ROUTE) if (cityLock(g, c.id).open && !cityProgress(g, c.id).won) return c.id;
  for (let i = ROUTE.length - 1; i >= 0; i--) if (cityLock(g, ROUTE[i].id).open) return ROUTE[i].id;
  return ROUTE[0].id;
}

export interface StarResult {
  stars: number;
  win: boolean;
  par: boolean;
  crown: boolean;
}

export function starsFor(opts: { won: boolean; days: number; par: number; crown: boolean }): StarResult {
  if (!opts.won) return { stars: 0, win: false, par: false, crown: opts.crown };
  const par = opts.days <= opts.par;
  return { stars: 1 + (par ? 1 : 0) + (opts.crown ? 1 : 0), win: true, par, crown: opts.crown };
}

/** After a foreclosure the bank keeps this farm's earnings: you leave with at most what you came with. */
export function walletAfterForeclosure(cashNow: number, startCash: number): number {
  return Math.max(0, Math.min(cashNow, startCash));
}

export function todayKey(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
