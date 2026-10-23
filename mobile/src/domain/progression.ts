/** One permanent skill point is earned by paying off an entire farm. */
export const STARTING_SKILL_POINTS = 0;
export const FARM_COMPLETION_SKILL_POINTS = 1;

export type ProgressionEvent = 'farm-completed' | 'bill-paid' | 'city-record' | 'farm-lost';

export function skillPointReward(event: ProgressionEvent): number {
  return event === 'farm-completed' ? FARM_COMPLETION_SKILL_POINTS : 0;
}

/** Only used when an older save never stored a point balance. Existing balances
 * and purchased skills are preserved; this does not recalculate spent points. */
export function legacySkillPointEntitlement(completedFarms: unknown): number {
  if (typeof completedFarms !== 'number' || !Number.isFinite(completedFarms)) return 0;
  return Math.max(0, Math.floor(completedFarms)) * FARM_COMPLETION_SKILL_POINTS;
}
