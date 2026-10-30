// The workshop: permanent upgrades. Each level is a small step (Navid, 29 Oct: "make the upgrades much less
// effective each round"): +4% damage a Blade level, +2% reach, +2% swing speed, +0.5 s of daylight, half a crop
// more on the field, +3% crop prices, +0.8% crit chance. Each level costs about a sixth more than the last, so
// the first levels come quickly and later ones take saving up (and a player far ahead can't run away). Every fifth level of an upgrade is a bigger job that takes a while to build (an optional ad finishes it).

export type UpgradeId = 'scythe' | 'swing' | 'hands' | 'days' | 'soil' | 'market' | 'clover';

/** What one level of each upgrade does. The engine reads these (window.__DBD_SHED_FX) in its stats. */
export const SHED_FX = {
  /** Damage × this per Blade level. */
  dmg: 1.04,
  /** Reach + this per Handle level. */
  reach: 0.02,
  /** Swing speed + this per Hands level. */
  speed: 0.02,
  /** Seconds of daylight per Days level. */
  day: 0.5,
  /** Crops on the field per Soil level, and how much faster they sprout. */
  crops: 0.5,
  spawn: 0.04,
  /** Crop prices + this per Market level. */
  price: 0.03,
  /** Crit chance and golden-corn chance per Clover level. */
  crit: 0.008,
  gold: 0.0008,
} as const;

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  /** One short line: what the next level does. */
  line: string;
  max: number;
  base: number;
  growth: number;
  /** The upgrade's number at a level ("×1.22"), and what it is ("damage"). */
  value: (level: number) => string;
  unit: string;
  /** Both together, e.g. "×1.22 damage". */
  effect: (level: number) => string;
}

const trim = (v: number) => v.toFixed(1).replace(/\.0$/, '');

const DEFS: Array<Omit<UpgradeDef, 'effect'>> = [
  { id: 'scythe', name: 'Sharper blade', line: '+4% damage', max: 100, base: 70, growth: 1.17, unit: 'damage', value: l => `×${Math.pow(SHED_FX.dmg, l).toFixed(2)}` },
  { id: 'swing', name: 'Longer handle', line: '+2% reach', max: 30, base: 60, growth: 1.17, unit: 'reach', value: l => `${Math.round(100 + 100 * SHED_FX.reach * l)}%` },
  { id: 'hands', name: 'Quicker hands', line: '+2% swing speed', max: 30, base: 60, growth: 1.17, unit: 'swings/s', value: l => (3.2 * (1 + SHED_FX.speed * l)).toFixed(2) },
  { id: 'days', name: 'Longer days', line: '+0.5 s of daylight', max: 20, base: 75, growth: 1.18, unit: 'daylight', value: l => `+${trim(SHED_FX.day * l)} s` },
  { id: 'soil', name: 'Richer soil', line: '+½ crop on the field', max: 24, base: 75, growth: 1.18, unit: 'crops', value: l => `+${trim(SHED_FX.crops * l)}` },
  { id: 'market', name: 'Market stall', line: '+3% crop prices', max: 60, base: 80, growth: 1.17, unit: 'prices', value: l => `×${(1 + SHED_FX.price * l).toFixed(2)}` },
  { id: 'clover', name: 'Lucky clover', line: '+0.8% crit chance', max: 30, base: 60, growth: 1.17, unit: 'crit', value: l => `${trim(4 + 100 * SHED_FX.crit * l)}%` },
];

export const UPGRADES: UpgradeDef[] = DEFS.map(d => ({ ...d, effect: (l: number) => `${d.value(l)} ${d.unit}` }));

/** Highest level any upgrade can reach (saves are clamped to this). */
export const MAX_LEVEL = Math.max(...UPGRADES.map(u => u.max));

/** Every this-many levels, the next level is a timed job. */
export const TIMED_EVERY = 5;

export type Levels = Record<UpgradeId, number>;

export interface WorkshopJob {
  id: UpgradeId;
  /** The level being built. */
  level: number;
  startedAt: number;
  endsAt: number;
}

export interface WorkshopState {
  levels: Levels;
  job: WorkshopJob | null;
}

export function emptyLevels(): Levels {
  return { scythe: 0, swing: 0, hands: 0, days: 0, soil: 0, market: 0, clover: 0 };
}

export function upgradeDef(id: UpgradeId): UpgradeDef {
  const d = UPGRADES.find(u => u.id === id);
  if (!d) throw new Error('unknown upgrade ' + id);
  return d;
}

/** Price of buying the next level (level → level + 1); null when maxed. */
export function upgradeCost(id: UpgradeId, level: number): number | null {
  const d = upgradeDef(id);
  if (level >= d.max) return null;
  const raw = d.base * Math.pow(d.growth, level);
  if (raw < 100) return Math.round(raw);
  if (raw < 10000) return Math.round(raw / 10) * 10;
  return Math.round(raw / 100) * 100;
}

/** How long the next level takes to build, in ms (0 = instant). Levels 5, 10, 15… take 2 minutes, then a
 * quarter longer each time, up to half an hour. */
export function upgradeDuration(id: UpgradeId, level: number): number {
  upgradeDef(id);
  const next = level + 1;
  if (next % TIMED_EVERY !== 0) return 0;
  const minutes = Math.min(30, 2 * Math.pow(1.25, next / TIMED_EVERY - 1));
  return Math.round(minutes * 60) * 1000;
}

export type BuyResult = { ok: true; instant: boolean } | { ok: false; reason: 'maxed' | 'busy' | 'cash' };

/**
 * Start (or finish instantly) the next level of an upgrade. Spends `pay(cost)` first; returns what happened.
 * Only one timed job runs at a time, and an upgrade can't take another level while its own job runs.
 */
export function startUpgrade(ws: WorkshopState, id: UpgradeId, now: number, pay: (cost: number) => boolean): BuyResult {
  const level = ws.levels[id];
  const cost = upgradeCost(id, level);
  if (cost == null) return { ok: false, reason: 'maxed' };
  const dur = upgradeDuration(id, level);
  if (ws.job && (dur > 0 || ws.job.id === id)) return { ok: false, reason: 'busy' };
  if (!pay(cost)) return { ok: false, reason: 'cash' };
  if (dur === 0) {
    ws.levels[id] = level + 1;
    return { ok: true, instant: true };
  }
  ws.job = { id, level: level + 1, startedAt: now, endsAt: now + dur };
  return { ok: true, instant: false };
}

/** Completes the running job if its time is up (or `force`, e.g. after a rewarded ad). Returns the finished job. */
export function settleJob(ws: WorkshopState, now: number, force = false): WorkshopJob | null {
  const job = ws.job;
  if (!job) return null;
  if (!force && now < job.endsAt) return null;
  ws.levels[job.id] = Math.max(ws.levels[job.id], job.level);
  ws.job = null;
  return job;
}

/** What the v0.9 workshop charged (its levels are refunded when an older save loads; see progress.ts). */
const OLD_PRICES: Record<UpgradeId, [number, number]> = {
  scythe: [60, 1.4], swing: [90, 1.5], hands: [100, 1.5], days: [150, 1.6], soil: [110, 1.5], market: [130, 1.45], clover: [160, 1.6],
};
export function oldWorkshopRefund(levels: Partial<Record<UpgradeId, number>>, job?: { id: UpgradeId; level: number } | null): number {
  let sum = 0;
  const price = (id: UpgradeId, l: number) => {
    const [b, g] = OLD_PRICES[id];
    const raw = b * Math.pow(g, l);
    return raw < 100 ? Math.round(raw) : raw < 10000 ? Math.round(raw / 10) * 10 : Math.round(raw / 100) * 100;
  };
  for (const id of Object.keys(OLD_PRICES) as UpgradeId[]) {
    const n = Math.max(0, Math.min(60, Math.floor(levels[id] || 0)));
    for (let l = 0; l < n; l++) sum += price(id, l);
  }
  if (job && job.id in OLD_PRICES && job.level > 0) sum += price(job.id, job.level - 1);
  return sum;
}

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), r = s % 60;
  if (m < 60) return r ? `${m}m ${r}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
