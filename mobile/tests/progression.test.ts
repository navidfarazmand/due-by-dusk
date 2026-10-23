import { describe, expect, it } from 'vitest';
import { FARM_COMPLETION_SKILL_POINTS, STARTING_SKILL_POINTS, legacySkillPointEntitlement, skillPointReward } from '../src/domain/progression';

describe('one permanent point per successful farm', () => {
  it('starts with no free points and rewards a completed farm with exactly one', () => {
    expect(STARTING_SKILL_POINTS).toBe(0);
    expect(FARM_COMPLETION_SKILL_POINTS).toBe(1);
    expect(skillPointReward('farm-completed')).toBe(1);
  });

  it('awards no permanent points for bill milestones, regional records, or failed farms', () => {
    expect(skillPointReward('bill-paid')).toBe(0);
    expect(skillPointReward('city-record')).toBe(0);
    expect(skillPointReward('farm-lost')).toBe(0);
  });

  it('grants missing legacy balances from completed farms only', () => {
    expect(legacySkillPointEntitlement(0)).toBe(0);
    expect(legacySkillPointEntitlement(1)).toBe(1);
    expect(legacySkillPointEntitlement(7)).toBe(7);
  });

  it('rejects invalid farm counts and rounds to completed whole farms', () => {
    for (const value of [undefined, null, '4', NaN, Infinity, -3]) {
      expect(legacySkillPointEntitlement(value)).toBe(0);
    }
    expect(legacySkillPointEntitlement(3.9)).toBe(3);
  });
});
