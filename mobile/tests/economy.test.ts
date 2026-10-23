import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { calculateGrit, calculateStats, cropHealthMultiplier, upgradeCost } from '../src/domain/economy';

const emptyShed = () => ({ scythe: 0, swing: 0, hands: 0, days: 0, soil: 0, market: 0, clover: 0 });
const emptyHeir = () => ({ boots: 0, calloused: 0, hat: 0, almanac: 0, horseshoe: 0, rooster: 0, cousin: 0 });

describe('harvest balance preserved through renderer extraction', () => {
  it('starts with the intended first-harvest pace and earning potential', () => {
    expect(calculateStats(emptyShed(), emptyHeir(), [], [], 0)).toEqual({
      dmg: 1, tick: 3.2, R: 42, day: 14, max: 7, spawn: .82,
      vm: 1, cc: .04, cm: 2.8, gold: .015, comboCap: 2,
      chainGrace: .9, radishSlow: 1, radishBonus: 1,
      treaty: false, storm: false, cleaver: false,
    });
  });

  it('keeps repeat perk rewards stackable while one-off abilities stay boolean', () => {
    const value = calculateStats(emptyShed(), emptyHeir(),
      ['spite', 'spite', 'coffee', 'coffee', 'saving', 'saving', 'hungry', 'hungry', 'fever', 'fever', 'heavy', 'heavy'], [], 0);
    expect(value.dmg).toBe(5);
    expect(value.tick).toBeCloseTo(4.9);
    expect(value.day).toBe(18);
    expect(value.max).toBe(13);
    expect(value.spawn).toBeCloseTo(.82 / 1.16);
    expect(value.vm).toBeCloseTo(1.44);
    expect(value.cm).toBe(4.5);
  });

  it('combines permanent skill and heirloom bonuses with purchased equipment', () => {
    const shed = { ...emptyShed(), scythe: 2, hands: 2, days: 2, market: 1, soil: 1 };
    const heir = { ...emptyHeir(), calloused: 1, rooster: 2, boots: 1 };
    const result = calculateStats(shed, heir, [],
      ['core_awakening', 'reap_root', 'reap_swift', 'soil_sun', 'soil_root', 'gold_root'], 3);
    expect(result.dmg).toBe(6.6);
    expect(result.tick).toBeCloseTo(6.136);
    expect(result.day).toBe(21);
    expect(result.max).toBe(11);
    expect(result.spawn).toBeCloseTo(.82 / 1.24 / 1.12);
    expect(result.vm).toBeCloseTo(1.49408);
  });

  it('adds city tributes linearly rather than compounding each acquired deed', () => {
    const result = calculateStats(emptyShed(), emptyHeir(), [], [], 5);
    expect(result.vm).toBeCloseTo(1.2);
  });

  it('caps critical chance at 65% even with stacked rewards', () => {
    const result = calculateStats({ ...emptyShed(), clover: 6 }, { ...emptyHeir(), horseshoe: 5 }, Array(12).fill('clover'), [], 0);
    expect(result.cc).toBe(.65);
  });

  it('retains alternate skill routes to special harvesting abilities', () => {
    const result = calculateStats(emptyShed(), emptyHeir(), ['combo', 'whisper'], ['gold_herd', 'reap_exec', 'reap_cleave'], 0);
    expect(result).toMatchObject({ treaty: true, storm: true, cleaver: true, chainGrace: 1.45, radishSlow: .5, radishBonus: 1.5 });
  });

  it('increases crop resistance across days and paid bills without affecting day-one health', () => {
    expect(cropHealthMultiplier(1, 0)).toBe(1);
    expect(cropHealthMultiplier(2, 0)).toBeCloseTo(1.13);
    expect(cropHealthMultiplier(4, 2)).toBeCloseTo(2.137264);
  });
});

describe('upgrade prices and foreclosure rewards', () => {
  it('keeps displayed prices aligned with shared shop definitions and caps', async () => {
    vi.stubGlobal('window', {});
    const { SHED, HEIRS } = await import('../src/data/crops');
    const scythe = SHED.find(item => item.id === 'scythe')!;
    const almanac = HEIRS.find(item => item.id === 'almanac')!;
    expect(upgradeCost(scythe, 0)).toBe(8);
    expect(upgradeCost(scythe, 1)).toBe(15);
    expect(upgradeCost(scythe, 2, .25)).toBe(21);
    expect(upgradeCost(scythe, scythe.max)).toBeNull();
    expect(upgradeCost(almanac, 1)).toBe(7);
    expect(upgradeCost(almanac, almanac.max)).toBeNull();
    vi.unstubAllGlobals();
  });

  it('bounds discounts so an accidental discount cannot make upgrades free or cost more', () => {
    const item = { base: 100, g: 2, max: 5 };
    expect(upgradeCost(item, 0, -1)).toBe(100);
    expect(upgradeCost(item, 0, 1)).toBe(5);
  });

  it('awards no Grit for a completely unplayed fresh farm', () => {
    expect(calculateGrit({ paidTotal: 0, billsPaid: 0, played: false, day: 1, cash: 0 })).toEqual({ a: 0, b: 0, c: 0, d: 0, total: 0 });
  });

  it('awards all four independent progression components on foreclosure', () => {
    expect(calculateGrit({ paidTotal: 100, billsPaid: 2, played: true, day: 4, cash: 200 })).toEqual({ a: 4, b: 6, c: 3, d: 2, total: 15 });
  });

  it('does not award fractional square-root thresholds early and never penalizes negative balances', () => {
    expect(calculateGrit({ paidTotal: 24, billsPaid: 0, played: true, day: 1, cash: 49 })).toEqual({ a: 1, b: 0, c: 1, d: 0, total: 2 });
    expect(calculateGrit({ paidTotal: -1, billsPaid: -1, played: false, day: 1, cash: -1 }).total).toBe(0);
  });
});

describe('save validation and economy agree about earned perk stacks', () => {
  beforeAll(() => vi.stubGlobal('window', {}));
  afterAll(() => vi.unstubAllGlobals());
  it('preserves stacked bill rewards after loading and rejects unknown perks', async () => {
    const { SaveSystem, createDefaultMeta, createNewFarm } = await import('../src/systems/SaveSystem');
    const meta = createDefaultMeta();
    const farm = { ...createNewFarm(meta), perks: ['spite', 'spite', 'fever', 'fever', 'made-up-perk'] };
    const loaded = SaveSystem.migrateToV2({ meta, farm })!;
    expect(loaded.farm.perks).toEqual(['spite', 'spite', 'fever', 'fever']);
    const stats = calculateStats(loaded.farm.shed, loaded.meta.heir, loaded.farm.perks, loaded.meta.learnedSkills, 0);
    expect(stats.dmg).toBe(5);
    expect(stats.vm).toBeCloseTo(1.44);
  });
});
