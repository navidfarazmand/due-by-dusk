// Field power: how strong a player's build is when a farm starts, which sets how tough that farm's crops are
// (plan.ts, toughnessFor). It mirrors the engine's stats (planStats in gemini-engine.js) without the farm's perks:
// damage per second on one crop, crits averaged in, times the swing's area (or the seeds per shot).

import { SHED_FX, type Levels } from './workshop';
import type { ToolStats } from './tools';

/** Crit damage at the start of a farm (Heavy swing, a perk, raises it during the farm). */
const CRIT_MULT = 2.8;
/** What the seed blaster's range is worth on a field, as a multiplier on its seeds. */
export const BLASTER_RANGE_GAIN = 2;

export function fieldPower(levels: Levels, tool: ToolStats, skills: readonly string[]): number {
  const has = (id: string) => skills.includes(id);
  const dmg =
    Math.pow(SHED_FX.dmg, levels.scythe) *
    (has('reap_root') ? 1.25 : 1) *
    (has('core_awakening') ? 1.1 : 1) *
    (tool.dmg || 1);
  const tick = 3.2 * (1 + SHED_FX.speed * levels.hands) * (has('reap_swift') ? 1.18 : 1) * (tool.speed || 1);
  const crit = Math.min(0.65, 0.04 + SHED_FX.crit * levels.clover + (tool.crit || 0));
  // the flame keeps a crop burning after it moves on (the engine counts it as 1.5 more hits a second on a boss)
  const rate = tool.style === 'flame' ? tick + 1.5 : tick;
  const one = dmg * rate * (1 + crit * (CRIT_MULT - 1));
  // the seed blaster hits a few crops a shot, whatever its reach, and loses no time walking to them: its seeds
  // reach anything in range (bot runs, 29 Oct: it out-earned a flame weeder about twice as much as its seeds suggest)
  if (tool.style === 'blaster') return one * Math.max(1, Math.floor(tool.targets || 1)) * BLASTER_RANGE_GAIN;
  // a blade or a flame hits every crop in its circle, which grows with the square of the reach
  const reach = (tool.reach || 1) * (1 + SHED_FX.reach * levels.swing) * (has('reap_dash') ? 1.12 : 1);
  return one * reach * reach;
}

/** The strongest of the player's tools. */
export function bestPower(levels: Levels, tools: readonly ToolStats[], skills: readonly string[]): number {
  let best = 0;
  for (const t of tools) best = Math.max(best, fieldPower(levels, t, skills));
  return best;
}
