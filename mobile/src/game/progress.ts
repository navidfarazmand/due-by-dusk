// Progress across the whole game: which farms are won, stars, crowns, the workshop and ad counters.
// The farm being played (day, bills, cash in hand) lives in the engine's own save; this one is the game's.

import { COUNTRIES, ROUTE, type CountryCode, countryOf, cityById } from './world';
import { MAX_LEVEL, emptyLevels, oldWorkshopRefund, type WorkshopState } from './workshop';
import { newTools, parseTools, toolDef, type ToolId, type ToolsState } from './tools';
import { newFlair, parseFlair, type FlairState } from './flair';
import { newDaily, type DailyState } from './daily';

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
  /** Everything this farm has paid you so far: upgrades bought with its cash plus what you banked after the deed.
   * A farm only pays more when a run beats this (Navid, 29 Oct: replays pay only what beats your best). */
  paid: number;
}

export interface RunInfo {
  cityId: string;
  /** Cash the farm started with (always 0 since v0.9: savings never pay a farm's bills). */
  startCash: number;
  startedAt: number;
  bestDay: number;
  /** The farm's `paid` when this run started: only farm cash above it buys upgrades, and only what is left above it
   * after the deed goes to savings. */
  mark: number;
  /** Farm cash spent on upgrades and tools during this run. */
  spent: number;
  /** How much tougher this farm's crops are for the player's build when it started (plan.ts, toughnessFor). */
  tough?: number;
}

export interface AdCounters {
  /** Local date (YYYY-MM-DD) the counters belong to. */
  date: string;
  coins: number;
  doubles: number;
  finishes: number;
  /** Free-ribbon ads in the Bling Barn. */
  ribbons: number;
  /** Chest upgrades. */
  chests?: number;
  lastCoinsAt: number;
}

export interface Settings {
  music: boolean;
  haptics: boolean;
  /** Track ids for the field and for the menus (see shell/music.ts). */
  fieldTrack: string;
  menuTrack: string;
}

/** Economy version. 10: v0.10's longer farms and small-step workshop (older workshop levels are refunded). */
export const ECONOMY = 10;

export interface GameSave {
  v: 3;
  econ: number;
  createdAt: number;
  cities: Record<string, CityProgress>;
  run: RunInfo | null;
  /** Savings. Since v0.9 a farm starts with $0 and its bills are paid from what is harvested there; savings
   * (what is left after each deed, free-coin ads between farms) buy upgrades and tools. */
  wallet: number;
  /** Set once the save uses separate savings (v0.9). Older saves kept savings inside a running farm's cash. */
  splitWallet: boolean;
  workshop: WorkshopState;
  tools: ToolsState;
  /** Skills learned on the skill map (diamonds come from wins; see skills.ts). */
  skills: string[];
  /** Diamonds from outside the route (daily gold medals). */
  bonusDiamonds: number;
  /** County-fair ribbons for the Bling Barn, and what's bought there. */
  ribbons: number;
  flair: FlairState;
  daily: DailyState;
  /** Duel wins today, capped for ribbons. */
  duelDay: { date: string; rewarded: number };
  ads: AdCounters;
  settings: Settings;
  seen: Record<string, boolean>;
  totals: { days: number; crops: number; earned: number };
  /** Set by the v0.10 migration for one message; not saved again once shown. */
  migratedRefund?: number;
  migratedFarm?: boolean;
}

export function newGame(now = Date.now()): GameSave {
  return {
    v: 3,
    econ: ECONOMY,
    createdAt: now,
    cities: {},
    run: null,
    wallet: 0,
    splitWallet: true,
    workshop: { levels: emptyLevels(), job: null },
    tools: newTools(),
    skills: [],
    bonusDiamonds: 0,
    ribbons: 0,
    flair: newFlair(),
    daily: newDaily(),
    duelDay: { date: '', rewarded: 0 },
    ads: { date: '', coins: 0, doubles: 0, finishes: 0, ribbons: 0, chests: 0, lastCoinsAt: 0 },
    settings: { music: true, haptics: true, fieldTrack: 'meatball', menuTrack: 'gone_fishin' },
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
        paid: Math.max(0, num(p.paid)),
      };
    }
  }
  if (o.run && typeof o.run === 'object' && typeof o.run.cityId === 'string' && cityById(o.run.cityId)) {
    g.run = {
      cityId: o.run.cityId,
      startCash: Math.max(0, num(o.run.startCash)),
      startedAt: num(o.run.startedAt),
      bestDay: Math.max(0, num(o.run.bestDay)),
      mark: Math.max(0, num(o.run.mark)),
      spent: Math.max(0, num(o.run.spent)),
      ...(num(o.run.tough) > 0 ? { tough: Math.min(4, Math.max(0.5, num(o.run.tough))) } : {}),
    };
  }
  g.wallet = Math.max(0, num(o.wallet));
  // before v0.9 a running farm's cash already held the savings it started with: don't count them twice
  if (o.splitWallet !== true && g.run) g.wallet = 0;
  g.splitWallet = true;
  if (o.workshop && typeof o.workshop === 'object') {
    const lv = o.workshop.levels || {};
    for (const k of Object.keys(g.workshop.levels) as Array<keyof typeof g.workshop.levels>) {
      g.workshop.levels[k] = Math.max(0, Math.min(MAX_LEVEL, Math.floor(num(lv[k]))));
    }
    const j = o.workshop.job;
    if (j && typeof j === 'object' && j.id in g.workshop.levels) {
      g.workshop.job = { id: j.id, level: Math.floor(num(j.level)), startedAt: num(j.startedAt), endsAt: num(j.endsAt) };
    }
  }
  // v0.10 rebuilt the workshop (small steps, new prices) and the farms (longer, with a crop ladder): older
  // upgrades are refunded into savings at what they cost, and a farm in progress is closed with its cash saved
  if (num(o.econ) < ECONOMY) {
    const refund = oldWorkshopRefund(o.workshop && o.workshop.levels ? o.workshop.levels : {}, o.workshop ? o.workshop.job : null);
    g.workshop = { levels: emptyLevels(), job: null };
    g.wallet += refund;
    // the app adds the old farm's cash to savings once the engine is up (it lives in the engine's save, and before
    // v0.9 it already held the savings the farm started with)
    g.migratedFarm = !!g.run;
    g.run = null;
    g.migratedRefund = refund;
  }
  g.econ = ECONOMY;
  g.tools = parseTools(o.tools);
  if (Array.isArray(o.skills)) g.skills = o.skills.filter((s: unknown) => typeof s === 'string' && /^[a-z_]{3,30}$/.test(s as string)).slice(0, 40);
  g.bonusDiamonds = Math.max(0, Math.floor(num(o.bonusDiamonds)));
  g.flair = parseFlair(o.flair);
  if (o.daily && typeof o.daily === 'object' && typeof o.daily.date === 'string') {
    g.daily = {
      date: o.daily.date,
      plays: Math.max(0, Math.floor(num(o.daily.plays))),
      adPlays: Math.max(0, Math.floor(num(o.daily.adPlays))),
      best: Math.max(0, num(o.daily.best)),
      medal: Math.max(0, Math.min(3, Math.floor(num(o.daily.medal)))),
      goldDiamond: !!o.daily.goldDiamond,
    };
  }
  if (o.duelDay && typeof o.duelDay === 'object') g.duelDay = { date: String(o.duelDay.date || ''), rewarded: Math.max(0, Math.floor(num(o.duelDay.rewarded))) };
  if (o.ads && typeof o.ads === 'object') {
    g.ads = {
      date: typeof o.ads.date === 'string' ? o.ads.date : '',
      coins: Math.floor(num(o.ads.coins)),
      doubles: Math.floor(num(o.ads.doubles)),
      finishes: Math.floor(num(o.ads.finishes)),
      ribbons: Math.floor(num(o.ads.ribbons)),
      chests: Math.floor(num(o.ads.chests)),
      lastCoinsAt: num(o.ads.lastCoinsAt),
    };
  }
  if (o.settings && typeof o.settings === 'object') {
    const str = (v: unknown, d: string) => (typeof v === 'string' && /^[a-z_]{2,24}$/.test(v) ? v : d);
    g.settings = {
      music: o.settings.music !== false,
      haptics: o.settings.haptics !== false,
      fieldTrack: str(o.settings.fieldTrack, g.settings.fieldTrack),
      menuTrack: str(o.settings.menuTrack, g.settings.menuTrack),
    };
  }
  if (o.seen && typeof o.seen === 'object') for (const k of Object.keys(o.seen)) g.seen[k] = !!o.seen[k];
  if (o.totals && typeof o.totals === 'object') {
    g.totals = { days: num(o.totals.days), crops: num(o.totals.crops), earned: num(o.totals.earned) };
  }
  // ribbons arrived in v0.8.1: older saves get them for the stars, crowns and bosses they already have
  if (typeof o.ribbons === 'number' && Number.isFinite(o.ribbons)) g.ribbons = Math.max(0, Math.floor(o.ribbons));
  else {
    let r = 0;
    for (const c of ROUTE) {
      const p = g.cities[c.id];
      if (!p) continue;
      r += p.stars + (p.crown ? 2 : 0) + (p.won && countryOf(c.country).cities[countryOf(c.country).cities.length - 1].id === c.id ? 3 : 0);
    }
    g.ribbons = r;
  }
  return g;
}

export function cityProgress(g: GameSave, cityId: string): CityProgress {
  return g.cities[cityId] || { won: false, stars: 0, bestDay: 0, crown: false, bestDays: 0, plays: 0, paid: 0 };
}

/** Farm cash that can buy upgrades and tools during a run: what is above the farm's mark. */
export function spendableFarmCash(run: RunInfo | null, farmCash: number): number {
  if (!run) return 0;
  return Math.max(0, Math.floor(farmCash - run.mark));
}

/** What a won run banks into savings: the cash left after the deed, above the farm's mark. */
export function bankAfterWin(run: RunInfo, cashLeft: number): number {
  return Math.max(0, Math.round(cashLeft - run.mark));
}

/** The farm's new `paid` after a run ends (won: with what it banked). */
export function paidAfterRun(run: RunInfo, banked: number): number {
  return Math.round(run.mark + run.spent + Math.max(0, banked));
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
  /** Kept the farm's spare-cash goal after paying the deed. */
  spare: boolean;
  crown: boolean;
}

/**
 * Stars for a farm: one for winning, one for keeping money to spare after the deed (`spare` or more; bills are paid
 * on their due day, so a farm always runs its full length), one for the crown.
 */
export function starsFor(opts: { won: boolean; cashLeft: number; spare: number; crown: boolean }): StarResult {
  if (!opts.won) return { stars: 0, win: false, spare: false, crown: opts.crown };
  const spare = opts.cashLeft >= opts.spare;
  return { stars: 1 + (spare ? 1 : 0) + (opts.crown ? 1 : 0), win: true, spare, crown: opts.crown };
}

/** After a foreclosure the bank keeps this farm's earnings: you leave with at most what you came with. */
export function walletAfterForeclosure(cashNow: number, startCash: number): number {
  return Math.max(0, Math.min(cashNow, startCash));
}

export function todayKey(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
