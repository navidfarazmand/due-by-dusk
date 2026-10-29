// The workshop: permanent upgrades bought with the same wallet that pays the bank.
// Levels feed the engine's stats (planStats): damage ×1.2 per Blade level, +6% reach, +5% swing speed,
// +1 s of daylight, +1 crop on the field, +10% crop prices, +2% crit chance.
// Small upgrades are instant; bigger ones take time (an optional ad finishes one right away).

export type UpgradeId = 'scythe' | 'swing' | 'hands' | 'days' | 'soil' | 'market' | 'clover';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  /** One short line: what the next level does. */
  line: string;
  max: number;
  base: number;
  growth: number;
  /** Levels below this are instant. */
  freeUpTo: number;
  effect: (level: number) => string;
}

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'scythe', name: 'Sharper blade', line: '+20% damage', max: 40, base: 30, growth: 1.3, freeUpTo: 4,
    effect: l => `×${Math.pow(1.2, l).toFixed(l < 12 ? 2 : 0)} damage`,
  },
  {
    id: 'swing', name: 'Longer handle', line: '+6% reach', max: 15, base: 40, growth: 1.38, freeUpTo: 3,
    effect: l => `${Math.round(100 + 6 * l)}% reach`,
  },
  {
    id: 'hands', name: 'Quicker hands', line: '+5% swing speed', max: 15, base: 45, growth: 1.38, freeUpTo: 3,
    effect: l => `${(3.2 * (1 + 0.05 * l)).toFixed(1)} swings a second`,
  },
  {
    id: 'days', name: 'Longer days', line: '+1 s of daylight', max: 10, base: 60, growth: 1.45, freeUpTo: 2,
    effect: l => `+${l} s of daylight`,
  },
  {
    id: 'soil', name: 'Richer soil', line: '+1 crop on the field', max: 15, base: 50, growth: 1.4, freeUpTo: 3,
    effect: l => `${7 + l} crops at once`,
  },
  {
    id: 'market', name: "Farmers' market", line: '+10% crop prices', max: 20, base: 70, growth: 1.36, freeUpTo: 3,
    effect: l => `prices ×${(1 + 0.1 * l).toFixed(1)}`,
  },
  {
    id: 'clover', name: 'Lucky clover', line: '+2% crit chance', max: 10, base: 90, growth: 1.5, freeUpTo: 2,
    effect: l => `${4 + 2 * l}% crit chance`,
  },
];

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

/** How long the next level takes to build, in ms (0 = instant). Capped at an hour. */
export function upgradeDuration(id: UpgradeId, level: number): number {
  const d = upgradeDef(id);
  if (level < d.freeUpTo) return 0;
  const minutes = Math.min(60, 1 * Math.pow(1.45, level - d.freeUpTo));
  return Math.round(minutes * 60) * 1000;
}

export type BuyResult = { ok: true; instant: boolean } | { ok: false; reason: 'maxed' | 'busy' | 'cash' };

/**
 * Start (or finish instantly) the next level of an upgrade. Spends `pay(cost)` first; returns what happened.
 * Only one timed job runs at a time.
 */
export function startUpgrade(ws: WorkshopState, id: UpgradeId, now: number, pay: (cost: number) => boolean): BuyResult {
  const level = ws.levels[id];
  const cost = upgradeCost(id, level);
  if (cost == null) return { ok: false, reason: 'maxed' };
  const dur = upgradeDuration(id, level);
  if (dur > 0 && ws.job) return { ok: false, reason: 'busy' };
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

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), r = s % 60;
  if (m < 60) return r ? `${m}m ${r}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
