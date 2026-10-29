// The skill map: permanent skills bought with diamonds (one per farm won, two per boss farm, one per daily
// gold medal). Gemini's engine already implements each skill's effect (hasSkill); the game save owns which
// ones are learned and the shell passes them to the engine. Resetting is free.
//
// Costs: the core 1, branch roots 2, middle skills 3, capstones 4 (55 in all). The route alone earns 37, so
// the whole map takes daily gold medals too, and the big early boosts arrive near the end of Canada rather
// than after the fourth farm.

import { ROUTE, isBossCity } from './world';
import { cityProgress, type GameSave } from './progress';

export type Branch = 'core' | 'reap' | 'soil' | 'gold';

export interface SkillDef {
  id: string;
  branch: Branch;
  name: string;
  /** What it does, in one line. */
  effect: string;
  cost: number;
  reqs: string[];
  /** 'any': one of the reqs is enough (the capstones). */
  reqMode?: 'any';
  /** Position on the 844×390 skill map. */
  x: number;
  y: number;
}

export const SKILLS: SkillDef[] = [
  { id: 'core_awakening', branch: 'core', name: "Harvester's Awakening", effect: '+10% damage and +1 s of daylight on every farm.', cost: 1, reqs: [], x: 295, y: 228 },

  { id: 'reap_root', branch: 'reap', name: 'Honed Temper', effect: '+25% damage.', cost: 2, reqs: ['core_awakening'], x: 218, y: 228 },
  { id: 'reap_swift', branch: 'reap', name: 'Mercurial Wrist', effect: '+18% swing speed.', cost: 3, reqs: ['reap_root'], x: 165, y: 168 },
  { id: 'reap_dash', branch: 'reap', name: 'Gale Dash', effect: '+12% reach.', cost: 3, reqs: ['reap_swift'], x: 105, y: 132 },
  { id: 'reap_cleave', branch: 'reap', name: 'Sundering Cleave', effect: 'Charge Cleave charges 50% faster and hits a wider circle.', cost: 3, reqs: ['reap_root'], x: 165, y: 290 },
  { id: 'reap_vortex', branch: 'reap', name: 'Whirlwind Echo', effect: 'A Charge Cleave leaves a spinning vortex that keeps chopping for 1.8 s.', cost: 3, reqs: ['reap_cleave'], x: 105, y: 322 },
  { id: 'reap_exec', branch: 'reap', name: "Reaper's Verdict", effect: 'Crops under 25% health are cut at once (not bosses), and crits throw lightning.', cost: 4, reqs: ['reap_dash', 'reap_vortex'], reqMode: 'any', x: 62, y: 228 },

  { id: 'soil_root', branch: 'soil', name: 'Living Humus', effect: '+2 crops on the field and 12% faster sprouting.', cost: 2, reqs: ['core_awakening'], x: 340, y: 162 },
  { id: 'soil_twin', branch: 'soil', name: 'Twin Germination', effect: 'One new crop in five sprouts with a twin.', cost: 3, reqs: ['soil_root'], x: 291, y: 116 },
  { id: 'soil_dew', branch: 'soil', name: 'Dawn Abundance', effect: 'Every day starts with 3 more ripe crops.', cost: 3, reqs: ['soil_twin'], x: 348, y: 88 },
  { id: 'soil_sun', branch: 'soil', name: 'Longer Solstice', effect: '+2 s of daylight.', cost: 3, reqs: ['soil_root'], x: 402, y: 148 },
  { id: 'soil_bounty', branch: 'soil', name: 'Artisan Compost', effect: 'Fertilizer bags and clover treats show up twice as often.', cost: 3, reqs: ['soil_sun'], x: 470, y: 112 },
  { id: 'soil_eden', branch: 'soil', name: 'Perennial Bloom', effect: 'A harvested crop sometimes (1 in 4) sprouts again right away.', cost: 4, reqs: ['soil_dew', 'soil_bounty'], reqMode: 'any', x: 410, y: 80 },

  { id: 'gold_root', branch: 'gold', name: "Merchant's Scale", effect: 'Crops sell for 15% more.', cost: 2, reqs: ['core_awakening'], x: 361, y: 282 },
  { id: 'gold_lawyer', branch: 'gold', name: 'Retained Counsel', effect: 'Every bill costs 12% less.', cost: 3, reqs: ['gold_root'], x: 333, y: 342 },
  { id: 'gold_interest', branch: 'gold', name: 'Compound Reserve', effect: 'Every night, 12% interest on the cash you hold (up to 40% of a good day here).', cost: 3, reqs: ['gold_lawyer'], x: 404, y: 362 },
  { id: 'gold_treaty', branch: 'gold', name: 'Pasture Accord', effect: 'The goat never headbutts; it tips you instead.', cost: 3, reqs: ['gold_root'], x: 436, y: 272 },
  { id: 'gold_herd', branch: 'gold', name: 'Loyal Goat Herd', effect: 'The goat harvests the crops it walks past.', cost: 3, reqs: ['gold_treaty'], x: 508, y: 300 },
  { id: 'gold_midas', branch: 'gold', name: 'Sovereign Mint', effect: 'Lucky crops and the country trio pay 50% more.', cost: 4, reqs: ['gold_interest', 'gold_herd'], reqMode: 'any', x: 476, y: 356 },
];

export const BRANCH_NAME: Record<Branch, string> = { core: 'Core', reap: 'Reap', soil: 'Soil', gold: 'Fortune' };

export function skillDef(id: string): SkillDef | undefined {
  return SKILLS.find(s => s.id === id);
}

/** Diamonds from first wins (two for a boss farm) plus any bonus diamonds (daily gold medals). */
export function diamondsEarned(g: GameSave): number {
  let n = g.bonusDiamonds || 0;
  for (const c of ROUTE) if (cityProgress(g, c.id).won) n += isBossCity(c.id) ? 2 : 1;
  return n;
}

export function diamondsSpent(g: GameSave): number {
  return g.skills.reduce((a, id) => a + (skillDef(id)?.cost || 0), 0);
}

export function diamondsLeft(g: GameSave): number {
  return Math.max(0, diamondsEarned(g) - diamondsSpent(g));
}

export function reqsMet(g: GameSave, d: SkillDef): boolean {
  if (!d.reqs.length) return true;
  return d.reqMode === 'any' ? d.reqs.some(r => g.skills.includes(r)) : d.reqs.every(r => g.skills.includes(r));
}

/** A node is in the clouds until one of its prerequisites is learned (the core is always visible). */
export function revealed(g: GameSave, d: SkillDef): boolean {
  return g.skills.includes(d.id) || !d.reqs.length || d.reqs.some(r => g.skills.includes(r));
}

export interface LearnCheck {
  ok: boolean;
  reason: string;
}

export function canLearn(g: GameSave, id: string): LearnCheck {
  const d = skillDef(id);
  if (!d) return { ok: false, reason: '' };
  if (g.skills.includes(id)) return { ok: false, reason: 'Learned' };
  if (!reqsMet(g, d)) return { ok: false, reason: d.reqMode === 'any' ? 'Learn one of the skills next to it first' : 'Learn the skill before it first' };
  if (diamondsLeft(g) < d.cost) return { ok: false, reason: `Needs ${d.cost} ◆. Win farms, or take gold on the daily farm.` };
  return { ok: true, reason: '' };
}

export function learn(g: GameSave, id: string): boolean {
  if (!canLearn(g, id).ok) return false;
  g.skills.push(id);
  return true;
}

/** Free reset: every diamond comes back. */
export function resetSkills(g: GameSave): void {
  g.skills = [];
}
