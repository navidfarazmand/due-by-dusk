import { describe, expect, it } from 'vitest';
import { ECONOMY } from '../src/game/progress';
import { BILL_NAME, BILL_RATE, BORDER_STEP, niceAtLeast, niceMoney, paceMul, updatePace, BOSSES, DAY_SECONDS, FIRST_TOWN_CROP_HP, MIN_CROP_HP, billDays, billDueDay, billPressure, billSchedule, borders, goldCredit, LADDER_HP, LADDER_VAL, allPlans, cropName, planFor, dayRef, expectedPower, toughnessFor, winCredit } from '../src/game/plan';
import {
  CROP_LEVEL_MAX, CROP_LEVEL_PAY, FIELD_KINDS, RUNAWAY, TYPICAL_CUTS, countryKnown, cropLevel, cropLevelProgress, cropPay, cropPayTable, cutsForLevel, debutFarm, typicalCuts,
} from '../src/game/road';
import { BLASTER_RANGE_GAIN, bestPower, fieldPower } from '../src/game/power';
import { COUNTRIES, ROUTE, isBossCity } from '../src/game/world';
import {
  bankAfterWin, cityLock, coinsForDays, countryLock, newGame, nextCity, paidAfterRun, parseGame, spendableFarmCash, starGate, starsFor, toolLock,
  walletAfterForeclosure, type GameSave, type RunInfo,
} from '../src/game/progress';
import { MAX_LEVEL, SHED_FX, UPGRADES, emptyLevels, oldWorkshopRefund, settleJob, startUpgrade, upgradeCost, upgradeCostFlat, upgradeDuration, upgradeTier } from '../src/game/workshop';
import { TOOLS, anyPower, hasPower, modCost, newTools, parseTools, toolDef, toolStats, toolSummary } from '../src/game/tools';
import {
  KEY_BUILD_MS, TREE, TREE_WORKSHOP, buildingNode, buyNode, canBuyNode, nodeCost, nodeDuration, nodeLive, nodePrice, nodeText, resetTree, setTreeMoney, setTreePower, settleTree, treeDiscount,
  treeHasAny, treeLevel, treeListValue, treeNode, treeReady, treeRefund, type TreeHolder,
} from '../src/game/tree';

function winAll(g: GameSave, ids: string[], stars = 3): void {
  for (const id of ids) g.cities[id] = { won: true, stars, bestDay: 100, crown: stars === 3, bestDays: 2, plays: 1, paid: 0 };
}

describe('city plans', () => {
  const plans = allPlans();

  it('covers all 28 towns in route order', () => {
    expect(ROUTE).toHaveLength(28);
    // Navid (15 Nov): Canada 5, Japan 3, the others 4
    expect(COUNTRIES.map(c => c.cities.length)).toEqual([5, 4, 4, 4, 4, 4, 3]);
    expect(plans.map(p => p.index)).toEqual(ROUTE.map((_, i) => i));
  });

  it('gives each town 2 to 7 bills of 2 to 7 days, short at the start and long at the end, the last one the big bill', () => {
    // Navid (15 Nov): "something between 2-7 bills, each between 2-7 days"; the first town still teaches (2, 3, 4)
    expect(billSchedule(0)).toEqual([2, 3, 4]);
    expect(plans[0].totalDays).toBe(9);
    for (const p of plans) {
      const s = billSchedule(p.index);
      expect(s.length).toBeGreaterThanOrEqual(2);
      expect(s.length).toBeLessThanOrEqual(7);
      expect(p.bills.length).toBe(s.length);
      // a country's first town is short (one kind of crop), its capital long
      const list = COUNTRIES.find(c => c.code === p.country)!.cities;
      const pos = list.findIndex(x => x.id === p.cityId);
      if (p.index > 0 && pos === 0) expect(s.length).toBeLessThanOrEqual(3);
      if (pos === list.length - 1) expect(s.length).toBeGreaterThanOrEqual(5);
      p.bills.forEach((b, i) => {
        expect(b.days).toBe(s[i]);
        expect(b.days).toBe(billDays(i, p.index));
        expect(b.days).toBeGreaterThanOrEqual(2);
        expect(b.days).toBeLessThanOrEqual(7);
      });
      expect(s[0]).toBeLessThanOrEqual(3);
      if (p.index > 0 && s.length >= 3) expect(s[s.length - 1]).toBeGreaterThanOrEqual(5);
      expect(s[s.length - 1]).toBe(Math.max(...s));
      expect(billDueDay(s.length - 1, p.index)).toBe(p.totalDays);
      expect(p.totalDays).toBe(p.bills.reduce((a, b) => a + b.days, 0));
      // rent or the bank's loan, then the big bill
      p.bills.forEach((b, i) => {
        expect(b.kind).toBe(i === p.bills.length - 1 ? 'big' : b.kind);
        if (i < p.bills.length - 1) expect(['rent', 'bank']).toContain(b.kind);
        expect(b.name).toBe(BILL_NAME[b.kind][0]);
      });
      // the second star: keep about half the big bill after paying it
      const big = p.bills[p.bills.length - 1].amt;
      expect(p.spare).toBeGreaterThan(big * 0.45);
      expect(p.spare).toBeLessThan(big * 0.55);
    }
    // the same town always has the same bills
    expect(billSchedule(7)).toEqual(billSchedule(7));
  });

  /** Navid (15 Nov): "make sure the bills are clean numbers like 5000$ or 8000$. Don't make something like 4987$". */
  const NICE = [1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.8, 2, 2.2, 2.5, 2.8, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 9];
  const clean = (v: number) => {
    if (v < 10) return v % 5 === 0;
    const e = Math.pow(10, Math.floor(Math.log10(v) + 1e-12));
    return NICE.some(n => Math.abs(n * e - v) < 1e-6 * e);
  };

  it('never asks less per day than the bill before, all along the road (but for rounding), in clean amounts', () => {
    // the bank's own rate never goes down; the amounts are rounded to clean money, at most about 6% either way
    let prev = 0;
    for (const p of plans) {
      for (const b of p.bills) {
        expect(b.amt).toBeGreaterThan(0);
        expect(b.amt / b.days, `${p.cityId} ${b.amt}`).toBeGreaterThanOrEqual(prev * 0.88);
        prev = Math.max(prev, b.amt / b.days);
        expect(clean(b.amt), `${p.cityId} ${b.amt}`).toBe(true);
      }
      for (const v of [p.tax, p.repair, p.spare, p.bossFight?.bounty ?? 0]) if (v) expect(clean(v), `${p.cityId} ${v}`).toBe(true);
    }
    expect([4987, 5000, 8000, 1234, 1100, 2800, 75000, 1300000].map(niceMoney)).toEqual([5000, 5000, 8000, 1200, 1100, 2800, 75000, 1300000]);
    expect(niceAtLeast(1210)).toBe(1300);
    expect(niceAtLeast(1300)).toBe(1300);
    expect(niceAtLeast(9500)).toBe(10000);
  });

  it("follows the player's pace (0.15): bills all the way down for weaker players and all the way up for stronger ones, in clean amounts", () => {
    // no days yet: the town's own bills
    expect(paceMul(undefined)).toBe(1);
    // an average player
    expect(paceMul(1)).toBe(1);
    // a weaker one: all the way, so they need no more ads than an average player
    expect(paceMul(0.6)).toBe(0.6);
    // a strong one: all the way too (Navid, 15 Nov: "ads should be for everyone"), up to eight times an average day
    expect(paceMul(1.6)).toBe(1.6);
    expect(paceMul(5)).toBe(5);
    expect(paceMul(20)).toBe(8);
    // a moving average of the days: one great day moves it a quarter of the way
    expect(updatePace(undefined, 1.4)).toBe(1.4);
    expect(updatePace(1, 2)).toBeCloseTo(1.25, 6);
    expect(updatePace(1, 0)).toBeCloseTo(0.75 + 0.25 * 0.25, 3);
    // the plan for a pace: every money amount follows it, still clean and never cheaper per day bill by bill
    const base = planFor('ca_toronto'), strong = planFor('ca_toronto', paceMul(1.6)), weak = planFor('ca_toronto', 0.6);
    expect(base.scale).toBe(1);
    expect(strong.scale).toBe(paceMul(1.6));
    for (let i = 0; i < base.bills.length; i++) {
      expect(strong.bills[i].amt / base.bills[i].amt).toBeGreaterThan(paceMul(1.6) * 0.85);
      expect(strong.bills[i].amt / base.bills[i].amt).toBeLessThan(paceMul(1.6) * 1.15);
      expect(weak.bills[i].amt / base.bills[i].amt).toBeGreaterThan(0.6 * 0.85);
      expect(weak.bills[i].amt / base.bills[i].amt).toBeLessThan(0.6 * 1.15);
      expect(clean(strong.bills[i].amt) && clean(weak.bills[i].amt)).toBe(true);
      if (i) expect(strong.bills[i].amt / strong.bills[i].days).toBeGreaterThanOrEqual((strong.bills[i - 1].amt / strong.bills[i - 1].days) * 0.88);
    }
    expect(strong.tax).toBeGreaterThan(base.tax);
    expect(weak.repair).toBeLessThan(base.repair);
  });

  it('asks a little less than a day of every town, a little more each town up to the fourth (0.16)', () => {
    // A bill asks this share of an average day; under one leaves money for skills, the surprises add about 8%.
    // 0.16 (Navid, 19 Nov: "maybe make it a bit easier for everyone for the bill?"): 0.6, 0.8, 0.85, then 0.9
    expect(billPressure(0)).toBe(0.6);
    expect(billPressure(2)).toBeGreaterThan(billPressure(1));
    expect(billPressure(3)).toBeGreaterThan(billPressure(2));
    expect(billPressure(3)).toBe(BILL_RATE);
    expect(billPressure(27)).toBe(BILL_RATE);
    expect(BILL_RATE).toBe(0.9);
    expect([billPressure(1), billPressure(2)]).toEqual([0.8, 0.85]);
  });

  it('sizes the surprises: none in the first town, a tax of about half a day and a repair a little under one', () => {
    expect(plans[0].tax).toBe(0);
    expect(plans[0].repair).toBe(0);
    for (const p of plans.slice(1)) {
      expect(p.tax).toBeGreaterThan(0);
      expect(p.repair).toBeGreaterThan(p.tax);
    }
  });

  it('gets harder city by city', () => {
    for (let i = 1; i < plans.length; i++) {
      expect(plans[i].hp).toBeGreaterThan(plans[i - 1].hp);
      expect(plans[i].val).toBeGreaterThan(plans[i - 1].val);
      expect(dayRef(i)).toBeGreaterThan(dayRef(i - 1));
    }
    const first = plans[0], last = plans[plans.length - 1];
    expect(last.totalDays).toBeGreaterThan(first.totalDays);
  });

  it('puts one boss on the last farm of each country', () => {
    for (const c of COUNTRIES) {
      const ids = c.cities.map(x => x.id);
      const bosses = ids.filter(id => planFor(id).bossFight);
      expect(bosses).toEqual([ids[ids.length - 1]]);
      const bf = planFor(bosses[0]).bossFight!;
      expect(bf.hpMul).toBeGreaterThan(10);
      expect(bf.bounty).toBeGreaterThan(0);
      expect(isBossCity(bosses[0])).toBe(true);
    }
  });

  it('brings one runaway per town, kept in its own country, spotted after the first bill', () => {
    const seen = new Set<string>();
    plans.forEach((p, k) => {
      const own = RUNAWAY[p.cityId];
      expect(own).toBeTruthy();
      expect(seen.has(own)).toBe(false);
      seen.add(own);
      expect(debutFarm(own)).toBe(k);
      expect(p.runaway).toBe(own);
      // the field: the country's runaways caught so far (the newest four), then the town's own, the biggest crop
      const known = countryKnown(k);
      const types = p.stages.map(s => s.type);
      expect(types[types.length - 1]).toBe(own);
      expect(types.slice(0, -1)).toEqual(known.slice(-(FIELD_KINDS - 1)));
      expect(types.length).toBeLessThanOrEqual(FIELD_KINDS);
      // never a vegetable of another country (Navid: no pineapple in Egypt)
      for (const t of types) expect(ROUTE[debutFarm(t)].country).toBe(p.country);
      // spotted (rare) after the first bill, everywhere from the middle of the town; alone in a country's first town
      const rw = p.crops.filter(c => c[0] === own);
      if (!known.length) expect(rw).toEqual([[own, rw[0][1], 0]]);
      else {
        expect(rw.map(c => c[2])).toEqual([1, Math.max(1, Math.ceil(p.bills.length / 2))].filter((v, i, a) => a.indexOf(v) === i || i === 0).slice(0, rw.length));
        expect(rw[0][1]).toBeLessThan(rw.length > 1 ? rw[1][1] : Infinity);
      }
      // bigger crops pay more and take more cuts
      for (let i = 1; i < p.stages.length; i++) {
        expect(p.stages[i].val).toBeGreaterThan(p.stages[i - 1].val);
        expect(p.stages[i].hp).toBeGreaterThan(p.stages[i - 1].hp);
      }
    });
    expect(seen.size).toBe(28);
    // the first town is carrots alone; 0.16 (Navid, 18 Nov: a carrot that falls to one cut "is wrong", then "try 2"):
    // 2 cuts of a sickle without upgrades on the first day
    expect(plans[0].stages).toEqual([{ type: 'carrot', stage: 0, debut: true, val: LADDER_VAL[0], hp: FIRST_TOWN_CROP_HP / plans[0].hp }]);
    expect(Math.ceil(plans[0].stages[0].hp * plans[0].hp - 1e-9)).toBe(2);
    // and no crop anywhere falls to one cut of a sickle without upgrades (on its town's first day)
    for (const p of plans) for (const s of p.stages) expect(s.hp * p.hp).toBeGreaterThanOrEqual(MIN_CROP_HP - 1e-9);
    void LADDER_HP;
    // every country's three signature vegetables are runaways of that country
    for (const c of COUNTRIES) for (const t of c.trio) expect(ROUTE[debutFarm(t)].country).toBe(c.code);
    // the King is a vegetable of its own country, met by the capital
    for (const c of COUNTRIES) {
      const cap = c.cities[c.cities.length - 1].id;
      expect(debutFarm(BOSSES[c.code].type)).toBeLessThanOrEqual(ROUTE.findIndex(x => x.id === cap));
      expect(ROUTE[debutFarm(BOSSES[c.code].type)].country).toBe(c.code);
    }
    expect(cropName('radish')).toBe('Runaway Radish');
    expect(cropName('pei_russet')).toBe('Hoser Russet');
  });

  it('steps money up at every border: crops, bills and upgrades', () => {
    expect(BORDER_STEP).toBeGreaterThanOrEqual(3);
    expect(plans.map(p => borders(p.index)).filter((b, i, a) => i === 0 || b !== a[i - 1])).toEqual([0, 1, 2, 3, 4, 5, 6]);
    COUNTRIES.slice(1).forEach(c => {
      const k = ROUTE.findIndex(x => x.id === c.cities[0].id);
      const here = plans[k], before = plans[k - 1];
      // a new country's bills ask several times more per day than the town before (about the border step: the measured
      // average days differ a little town by town), and its crops pay several times more
      const rate = (p: typeof here) => p.bills[0].amt / p.bills[0].days;
      expect(rate(here) / (before.bills[before.bills.length - 1].amt / before.bills[before.bills.length - 1].days)).toBeGreaterThan(0.8 * BORDER_STEP);
      expect(here.val / before.val).toBeGreaterThan(BORDER_STEP);
    });
    // the big bill is the biggest of its town
    for (const p of plans) expect(p.bills[p.bills.length - 1].amt).toBe(Math.max(...p.bills.map(b => b.amt)));
    // upgrades: Canada's levels cost what they did; the first level of the USA's reach costs BORDER_STEP times the
    // old curve, and one country's money can't buy the next one's
    expect(upgradeTier('scythe', 25)).toBe(0);
    expect(upgradeTier('scythe', 26)).toBe(1);
    expect(upgradeCost('scythe', 10)).toBe(upgradeCostFlat('scythe', 10));
    expect(upgradeCost('scythe', 26)! / upgradeCostFlat('scythe', 26)!).toBeCloseTo(BORDER_STEP, 1);
    for (const u of UPGRADES) for (let l = 1; l < u.max; l++) {
      expect(upgradeCost(u.id, l)!).toBeGreaterThan(upgradeCost(u.id, l - 1)!);
      expect(upgradeTier(u.id, l)).toBeGreaterThanOrEqual(upgradeTier(u.id, l - 1));
    }
    // tools are priced in the money of the country they are bought in
    // (0.16: the sickle's Power booster, which unlocks its power bar, is $150, then 2.5 times as much a level)
    expect(toolDef('sickle').mods[0].base).toBe(150);
    expect(toolDef('scythe').price).toBe(9000 * BORDER_STEP);
    expect(toolDef('flame').price).toBe(30000 * BORDER_STEP ** 2);
    expect(toolDef('blaster').price).toBe(90000 * BORDER_STEP ** 3);
    // a first win's tree credit follows the farm
    expect(winCredit(plans[0])).toBeLessThan(winCredit(plans[6]));
    expect(winCredit(plans[5])).toBeGreaterThan(winCredit(plans[4]));
    expect(goldCredit(8)).toBeGreaterThan(goldCredit(0));
  });

  it('raises a vegetable\'s level with the player\'s own cuts', () => {
    expect(cropLevel(0)).toBe(1);
    expect(cropLevel(24)).toBe(1);
    expect(cropLevel(25)).toBe(2);
    expect(cutsForLevel(1)).toBe(0);
    for (let l = 2; l <= CROP_LEVEL_MAX; l++) {
      expect(cutsForLevel(l)).toBeGreaterThan(cutsForLevel(l - 1));
      expect(cropLevel(cutsForLevel(l))).toBe(l);
      expect(cropLevel(cutsForLevel(l) - 1)).toBe(l - 1);
    }
    expect(cropLevel(1e9)).toBe(CROP_LEVEL_MAX);
    expect(cropPay(1)).toBe(1);
    expect(cropPay(CROP_LEVEL_MAX)).toBeCloseTo(1 + CROP_LEVEL_PAY * (CROP_LEVEL_MAX - 1), 6);
    expect(cropLevelProgress(0)).toBe(0);
    expect(cropLevelProgress(1e9)).toBe(1);
    expect(cropPayTable({ carrot: 0, radish: 25, onion: 1e9 })).toEqual({ radish: cropPay(2), onion: cropPay(CROP_LEVEL_MAX) });
    expect(cropPayTable(undefined)).toEqual({});
    // the bots' typical player: about a hundred cuts of each vegetable of a field per town
    const cuts = typicalCuts(2, i => plans[i].bills.length);
    expect(cuts.carrot).toBe(TYPICAL_CUTS * 2);
    expect(cuts.radish).toBe(TYPICAL_CUTS);
  });

  it('gives days of 15 seconds before upgrades', () => {
    expect(DAY_SECONDS).toBe(15);
    for (const p of plans) expect(p.dayBase).toBe(15);
  });
});

describe('crop toughness follows the build', () => {
  it('scales by the square root of how far the build is from the route, within limits', () => {
    const e = expectedPower(5);
    expect(toughnessFor(5, e)).toBeCloseTo(1, 6);
    expect(toughnessFor(5, e * 4)).toBeCloseTo(2, 6);
    expect(toughnessFor(5, e / 4)).toBeCloseTo(0.5, 6);
    expect(toughnessFor(5, e * 1000)).toBe(4);
    expect(toughnessFor(5, e / 1000)).toBe(0.5);
    expect(toughnessFor(5, 0)).toBe(1);
    expect(toughnessFor(5, Number.NaN)).toBe(1);
    for (let k = 1; k < 30; k++) expect(expectedPower(k)).toBeGreaterThan(expectedPower(k - 1));
  });

  it('rates a new player at the first farm as on track, and upgrades, skills and tools as stronger', () => {
    const lv = emptyLevels();
    const tools = newTools();
    const sickle = toolStats(tools, 'sickle');
    const start = fieldPower(lv, sickle, []);
    expect(start / expectedPower(0)).toBeGreaterThan(0.95);
    expect(start / expectedPower(0)).toBeLessThan(1.05);
    expect(toughnessFor(0, start)).toBeCloseTo(1, 1);
    lv.scythe = 10;
    expect(fieldPower(lv, sickle, [])).toBeCloseTo(start * Math.pow(SHED_FX.dmg, 10), 6);
    expect(fieldPower(lv, sickle, ['reap_root'])).toBeCloseTo(fieldPower(lv, sickle, []) * 1.25, 6);
    tools.owned.push('scythe', 'flame', 'blaster');
    tools.mods['blaster.barrel'] = 2;
    const all = tools.owned.map(id => toolStats(tools, id));
    const blaster = toolStats(tools, 'blaster');
    expect(fieldPower(lv, blaster, [])).toBeCloseTo(fieldPower(lv, toolStats(newTools(), 'sickle'), []) * 5 * 0.8 * 6 * BLASTER_RANGE_GAIN, 6);
    // every new tool beats the one before it with all its attachments, at the same workshop levels
    const maxed = newTools();
    for (const t of TOOLS) for (const m of t.mods) maxed.mods[`${t.id}.${m.id}`] = m.max;
    for (let i = 1; i < TOOLS.length; i++) {
      const prev = fieldPower(lv, toolStats(maxed, TOOLS[i - 1].id), []);
      expect(fieldPower(lv, toolStats(newTools(), TOOLS[i].id), [])).toBeGreaterThan(prev);
    }
    expect(bestPower(lv, all, [])).toBe(Math.max(...all.map(t => fieldPower(lv, t, []))));
    // a player far ahead of the route meets tougher crops on an early farm, but only by the square root
    expect(toughnessFor(0, bestPower(lv, all, []))).toBeGreaterThan(2);
  });

  it("keeps a run's toughness in the save", () => {
    const g = newGame();
    g.run = { cityId: 'ca_gatineau', startCash: 0, startedAt: 1, bestDay: 0, mark: 0, spent: 0, tough: 1.7 };
    expect(parseGame(JSON.stringify(g)).run?.tough).toBe(1.7);
    g.run.tough = 99;
    expect(parseGame(JSON.stringify(g)).run?.tough).toBe(4);
    delete g.run.tough;
    expect(parseGame(JSON.stringify(g)).run?.tough).toBeUndefined();
  });

  it("keeps that a run's star goals were shown (0.16: once a run, on its first morning)", () => {
    const g = newGame();
    g.run = { cityId: 'ca_gatineau', startCash: 0, startedAt: 1, bestDay: 0, mark: 0, spent: 0 };
    expect(parseGame(JSON.stringify(g)).run?.goals).toBeUndefined();
    g.run.goals = true;
    expect(parseGame(JSON.stringify(g)).run?.goals).toBe(true);
  });
});

describe('free coins follow the player\'s own days', () => {
  it('pays about one ordinary day (the median of the last five), not the farm\'s estimate', () => {
    expect(coinsForDays([80, 76, 84], 200)).toBe(80);
    expect(coinsForDays([10, 500, 90, 100, 95, 85], 200)).toBe(100);
    expect(coinsForDays([60, 100], 999)).toBe(80);
  });
  it('uses the estimate before any day, and never less than 20', () => {
    expect(coinsForDays(undefined, 204)).toBe(200);
    expect(coinsForDays([], 204)).toBe(200);
    expect(coinsForDays([3], 200)).toBe(20);
  });
  it('a save keeps only the last five days', () => {
    const g = parseGame(JSON.stringify({ ...newGame(), recentEarn: [1, 2, 3, 4, 5, 6, 7] }))!;
    expect(g.recentEarn).toEqual([3, 4, 5, 6, 7]);
  });
});

describe('progress', () => {
  it('starts a new game when the save is missing or broken', () => {
    expect(parseGame(null).run).toBeNull();
    expect(parseGame('{not json').wallet).toBe(0);
    expect(parseGame(JSON.stringify({ v: 2, wallet: 99 })).wallet).toBe(0);
  });

  it('keeps valid fields and drops bad ones', () => {
    const g = newGame();
    g.wallet = 123;
    g.cities.ca_charlottetown = { won: true, stars: 2, bestDay: 150, crown: false, bestDays: 2, plays: 3, paid: 420 };
    g.workshop.levels.scythe = 5;
    g.tools.owned.push('scythe');
    g.tools.equipped = 'scythe';
    g.tools.mods['scythe.wide'] = 2;
    const raw = JSON.parse(JSON.stringify(g));
    raw.cities.nowhere = { won: true };
    raw.cities.ca_gatineau = { won: 'yes', stars: 9 };
    raw.tools.mods['scythe.wide'] = 99;
    raw.tools.owned.push('laser');
    const back = parseGame(JSON.stringify(raw));
    expect(back.wallet).toBe(123);
    expect(back.cities.ca_charlottetown.stars).toBe(2);
    expect(back.cities.ca_charlottetown.paid).toBe(420);
    expect(back.cities.nowhere).toBeUndefined();
    expect(back.cities.ca_gatineau.stars).toBe(3);
    expect(back.workshop.levels.scythe).toBe(5);
    expect(back.tools.owned).toEqual(['sickle', 'scythe']);
    expect(back.tools.equipped).toBe('scythe');
    expect(back.tools.mods['scythe.wide']).toBe(3);
  });

  it('opens farms in order and countries after the boss and enough stars', () => {
    const g = newGame();
    const ca = COUNTRIES[0].cities.map(c => c.id);
    expect(cityLock(g, ca[0]).open).toBe(true);
    expect(cityLock(g, ca[1]).open).toBe(false);
    expect(countryLock(g, 'US').open).toBe(false);
    const king = ca.length - 1;
    winAll(g, ca.slice(0, king), 3);
    expect(cityLock(g, ca[king]).open).toBe(true);
    expect(countryLock(g, 'US').reason).toMatch(/Win/);
    winAll(g, [ca[king]], 1);
    expect(countryLock(g, 'US').open).toBe(true);
    expect(nextCity(g)).toBe('us_austin');
  });

  it('opens the next country when its King is beaten, however many stars (a town is never played again)', () => {
    const g = newGame();
    winAll(g, COUNTRIES[0].cities.slice(0, -1).map(c => c.id), 1);
    expect(countryLock(g, 'US').open).toBe(false);
    winAll(g, [COUNTRIES[0].cities[COUNTRIES[0].cities.length - 1].id], 1);
    expect(countryLock(g, 'US').open).toBe(true);
  });

  it('scores stars for catching the runaway, a big day (0.16) and a first try (0.15)', () => {
    expect(starsFor({ won: false, bestDay: 900, bigDay: 100, firstTry: true }).stars).toBe(0);
    expect(starsFor({ won: true, bestDay: 99, bigDay: 100, firstTry: false }).stars).toBe(1);
    expect(starsFor({ won: true, bestDay: 100, bigDay: 100, firstTry: false }).stars).toBe(2);
    expect(starsFor({ won: true, bestDay: 100, bigDay: 100, firstTry: true }).stars).toBe(3);
    expect(starsFor({ won: true, bestDay: 0, bigDay: 100, firstTry: true }).stars).toBe(2);
    expect(starsFor({ won: true, bestDay: 0, bigDay: 100, firstTry: true }).big).toBe(false);
    // the big day is half again an average player's day there, the same for every player, a clean amount
    for (const p of allPlans()) expect(p.bigDay).toBeGreaterThan(0);
    expect(planFor('ca_charlottetown').bigDay).toBe(planFor('ca_charlottetown', 3).bigDay);
  });

  it('pays out a farm only once: a run banks and spends only what beats what the farm already paid', () => {
    const run: RunInfo = { cityId: 'ca_charlottetown', startCash: 0, startedAt: 0, bestDay: 0, mark: 0, spent: 0 };
    // first run: all of the farm's cash can buy upgrades, and what is left after the deed is saved
    expect(spendableFarmCash(run, 250)).toBe(250);
    run.spent = 200;
    expect(bankAfterWin(run, 100)).toBe(100);
    expect(paidAfterRun(run, 100)).toBe(300);
    // a replay: only cash above 300 buys upgrades, and only cash above 300 is banked (Navid: 100 then 120 pays 20)
    const again: RunInfo = { ...run, mark: 300, spent: 0 };
    expect(spendableFarmCash(again, 250)).toBe(0);
    expect(spendableFarmCash(again, 340)).toBe(40);
    expect(bankAfterWin(again, 280)).toBe(0);
    expect(bankAfterWin(again, 360)).toBe(60);
    expect(paidAfterRun(again, 60)).toBe(360);
    // quitting or losing still counts what the farm's cash bought
    expect(paidAfterRun({ ...again, spent: 40 }, 0)).toBe(340);
    expect(spendableFarmCash(null, 500)).toBe(0);
  });

  it('refunds the old workshop once when a v0.9 save loads', () => {
    const old = newGame() as any;
    delete old.econ;
    old.wallet = 50;
    old.workshop.levels.scythe = 3;
    old.workshop.levels.market = 1;
    const back = parseGame(JSON.stringify(old));
    // v0.9 prices: blade 60, 84, 120 (×1.4, rounded to tens from 100); market 130
    expect(oldWorkshopRefund({ scythe: 3, market: 1 })).toBe(60 + 84 + 120 + 130);
    expect(back.wallet).toBe(50 + 394);
    expect(back.workshop.levels.scythe).toBe(0);
    expect(back.migratedRefund).toBe(394);
    expect(back.econ).toBe(ECONOMY);
    // a save of this version is left alone
    const again = parseGame(JSON.stringify({ ...back, migratedRefund: undefined }));
    expect(again.wallet).toBe(back.wallet);
    expect(again.migratedRefund).toBeUndefined();
  });

  it('lets the bank keep the farm earnings after a foreclosure', () => {
    expect(walletAfterForeclosure(500, 120)).toBe(120);
    expect(walletAfterForeclosure(40, 120)).toBe(40);
  });

  it('puts tools on sale after the right boss', () => {
    const g = newGame();
    expect(toolLock(g, 'sickle').open).toBe(true);
    expect(toolLock(g, 'scythe').open).toBe(false);
    winAll(g, COUNTRIES[0].cities.map(c => c.id), 2);
    expect(toolLock(g, 'scythe').open).toBe(true);
    expect(toolLock(g, 'flame').open).toBe(false);
  });
});

describe('workshop', () => {
  it('prices rise gently with level and stop at the max', () => {
    for (const u of UPGRADES) {
      expect(upgradeCost(u.id, 1)!).toBeGreaterThanOrEqual(upgradeCost(u.id, 0)!);
      expect(upgradeCost(u.id, 10)!).toBeGreaterThan(upgradeCost(u.id, 0)!);
      expect(upgradeCost(u.id, 0)!).toBeLessThanOrEqual(80);
      expect(upgradeCost(u.id, u.max)).toBeNull();
      expect(u.max).toBeLessThanOrEqual(MAX_LEVEL);
    }
  });

  it('makes each level a small step (Navid: five Blade levels bring damage to about ×1.2)', () => {
    expect(Math.pow(SHED_FX.dmg, 5)).toBeGreaterThan(1.18);
    expect(Math.pow(SHED_FX.dmg, 5)).toBeLessThan(1.25);
    expect(UPGRADES.find(u => u.id === 'scythe')!.effect(5)).toBe('×1.22 damage');
    expect(SHED_FX.price).toBeLessThanOrEqual(0.03);
    expect(SHED_FX.day).toBeLessThanOrEqual(0.5);
  });

  it('builds small upgrades at once and bigger ones over time, one at a time', () => {
    const ws = { levels: emptyLevels(), job: null };
    let cash = 1e9;
    const pay = (c: number) => (cash >= c ? ((cash -= c), true) : false);
    expect(startUpgrade(ws, 'scythe', 0, pay)).toEqual({ ok: true, instant: true });
    // every fifth level is a timed job
    for (let l = 0; l < 30; l++) expect(upgradeDuration('scythe', l) > 0).toBe((l + 1) % 5 === 0);
    ws.levels.scythe = 4;
    expect(upgradeDuration('scythe', 4)).toBe(120_000);
    expect(startUpgrade(ws, 'scythe', 1000, pay)).toEqual({ ok: true, instant: false });
    expect(startUpgrade(ws, 'swing', 1000, pay)).toEqual({ ok: true, instant: true });
    // the blade can't take another level while its own job runs, and a second job must wait
    expect(startUpgrade(ws, 'scythe', 1000, pay)).toEqual({ ok: false, reason: 'busy' });
    ws.levels.hands = 9;
    expect(startUpgrade(ws, 'hands', 1000, pay)).toEqual({ ok: false, reason: 'busy' });
    expect(settleJob(ws, 1001)).toBeNull();
    expect(settleJob(ws, 1001, true)!.id).toBe('scythe');
    expect(ws.levels.scythe).toBe(5);
    expect(upgradeDuration('scythe', 99)).toBeLessThanOrEqual(30 * 60_000);
  });

  it('refuses when the wallet is short', () => {
    const ws = { levels: emptyLevels(), job: null };
    expect(startUpgrade(ws, 'clover', 0, () => false)).toEqual({ ok: false, reason: 'cash' });
    expect(ws.levels.clover).toBe(0);
  });
});

describe('tools', () => {
  it('starts with the sickle in hand', () => {
    const t = newTools();
    expect(t.owned).toEqual(['sickle']);
    expect(toolStats(t).style).toBe('sickle');
    expect(toolStats(t).dmg).toBe(1);
  });

  it('applies attachments to the tool they belong to', () => {
    const t = parseTools({ owned: ['sickle', 'blaster'], equipped: 'blaster', mods: { 'blaster.barrel': 2, 'blaster.scope': 1, 'sickle.whetstone': 3 } });
    const b = toolStats(t);
    expect(b.style).toBe('blaster');
    expect(b.targets).toBe(6);
    expect(b.range).toBeCloseTo(150 * 1.15, 5);
    expect(toolStats(t, 'sickle').dmg).toBeCloseTo(1.36, 5);
  });

  it('gives every tool three attachments of two or three levels, plus a Power booster (v0.12: on every tool)', () => {
    for (const t of TOOLS) {
      expect(t.mods).toHaveLength(4);
      expect(t.mods.some(m => m.id === 'charge')).toBe(true);
      for (const m of t.mods) {
        expect(m.max).toBeGreaterThanOrEqual(2);
        expect(modCost(t.id, m.id, 0)!).toBeGreaterThan(0);
        expect(modCost(t.id, m.id, m.max)).toBeNull();
      }
    }
  });

  it('ignores tools that are not owned when equipping from a save', () => {
    const t = parseTools({ owned: ['sickle'], equipped: 'flame' });
    expect(t.equipped).toBe('sickle');
  });
});

describe('the Power booster (the Charge handle until 0.11)', () => {
  it('boosts the power meter, one level at a time, up to five (v0.12.1)', () => {
    expect(toolStats(newTools()).charge).toBe(0);
    expect(toolStats({ owned: ['sickle'], equipped: 'sickle', mods: { 'sickle.charge': 2 } }).charge).toBe(2);
    // v0.12: the Charge handle is the Power booster, on every tool; each tool names its power
    for (const td of TOOLS) expect(td.mods.some(m => m.id === 'charge' && m.name === 'Power booster')).toBe(true);
    // 0.16 (Navid, 18 Nov: "who said power bar is free? it should be one of the tools upgrades!"): a tool has a power
    // bar from its first Power booster
    expect(toolSummary(toolStats({ owned: ['sickle', 'scythe'], equipped: 'scythe', mods: {} }, 'scythe'))[0]).toBe('No power bar yet');
    expect(toolSummary(toolStats({ owned: ['sickle', 'scythe'], equipped: 'scythe', mods: { 'scythe.charge': 1 } }, 'scythe'))[0]).toBe('Power: Whirlwind');
    expect(hasPower(newTools())).toBe(false);
    expect(hasPower({ owned: ['sickle'], equipped: 'sickle', mods: { 'sickle.charge': 1 } })).toBe(true);
    expect(anyPower({ owned: ['sickle', 'scythe'], equipped: 'scythe', mods: { 'sickle.charge': 1 } })).toBe(true);
    expect(modCost('sickle', 'charge', 0)).toBe(150);
    expect(modCost('sickle', 'charge', 1)).toBe(380);
    expect(parseTools({ owned: ['sickle'], equipped: 'sickle', mods: { 'sickle.charge': 9 } }).mods['sickle.charge']).toBe(5);
  });
});

describe('the upgrade tree (0.13: the one upgrade system)', () => {
  it("prices nodes in the player's own days (0.15; Navid: \"scarecrow is only 2000 and i can make it in 1 day\")", () => {
    try {
      // an own day of $5,000 (an average day there times a pace of 2)
      setTreeMoney(5000, 2);
      const sc = TREE.find(n => n.name === 'Scarecrow')!;
      // 0.16 (Navid, 18 Nov: "why on earth upgrades are soooo cheap"; "make each skill that is a layer after the other,
      // much more expensive"): rings of 2, 4, 7, 12, 20, 30 days, a keystone 50, a bridge 16, each further level of a
      // trick 1.7 times the one before, and never under the ring's floor ($50 to $150,000) times the pace
      expect(nodeCost(sc, 0)).toBe(20_000);
      expect(nodeCost(sc, 1)).toBe(niceMoney(4 * 1.7 * 5000));
      expect(nodeCost(TREE.find(n => n.kind === 'key')!, 0)).toBe(300_000);
      expect(nodeCost(TREE.find(n => n.kind === 'bridge')!, 0)).toBe(80_000);
      // a Workshop track: the Workshop's price times the pace, never under 0.8 of the player's day (3% more a level)
      const b1 = treeNode('b1')!;
      expect(nodeCost(b1, 0)).toBe(4000);
      expect(nodeCost(b1, 80)).toBe(Math.max(niceMoney(upgradeCost('scythe', 80)! * 2), niceMoney(0.8 * Math.pow(1.03, 80) * 5000)));
      const NICE = [1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.8, 2, 2.2, 2.5, 2.8, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 9, 10];
      const clean = (v: number) => { const e = Math.pow(10, Math.floor(Math.log10(v) + 1e-12)); return NICE.some(x => Math.abs(x * e - v) < 1e-6 * e); };
      for (const n of TREE) if (n.kind !== 'trunk') for (let l = 0; l < Math.min(3, n.levels); l++) expect(clean(nodeCost(n, l))).toBe(true);
      // a discount keeps a round price
      const g = newGame();
      (g.tree ||= {}).m9 = 1;
      expect(nodePrice(g, sc)).toBe(19_000);
    } finally {
      setTreeMoney(0, 1);
    }
  });

  const NODE_FLOOR_IDS = ['a1'];
  it('makes each ring much dearer than the one before, from the first town on (0.16; Navid: "perennial bloom ... should be something in the order of 10k")', () => {
    try {
      // the first town: an average day of $15, a pace of 1
      setTreeMoney(15, 1);
      const ringOf = (d: number) => TREE.find(n => n.kind === 'trick' && Math.round(n.d) === d && !NODE_FLOOR_IDS.includes(n.id))!;
      // Perennial bloom is the Field branch's fifth ring
      expect(nodeCost(treeNode('p1')!, 0)).toBe(50);
      expect(nodeCost(ringOf(5), 0)).toBe(10_000);
      expect(treeNode('f8')!.name).toBe('Perennial bloom');
      expect(nodeCost(treeNode('f8')!, 0)).toBe(10_000);
      for (let d = 2; d <= 6; d++) expect(nodeCost(ringOf(d), 0)).toBeGreaterThanOrEqual(3.3 * nodeCost(ringOf(d - 1), 0));
      expect(nodeCost(TREE.find(n => n.kind === 'key')!, 0)).toBe(150_000);
      expect(nodeCost(treeNode('a1')!, 0)).toBe(10_000);
      // a strong player (a pace of 3) pays three times as much
      setTreeMoney(45, 3);
      expect(nodeCost(ringOf(5), 0)).toBe(30_000);
      // later on the days rule: Austin's day of about $1,200
      setTreeMoney(1200, 1);
      expect(nodeCost(ringOf(5), 0)).toBe(niceMoney(20 * 1200));
    } finally {
      setTreeMoney(0, 1);
    }
  });

  it('says only what the level being bought does (Navid, 15 Nov: not "3 more ripe crops (then 5, 8)")', () => {
    for (const n of TREE) {
      expect(n.effect).not.toMatch(/\(then|\bthen\b/);
      if (n.byLevel) expect(n.byLevel.length).toBe(n.levels);
      for (let l = 1; l <= n.levels; l++) {
        const x = nodeText(n, l);
        expect(x.text.includes('{v}')).toBe(x.v != null);
      }
    }
    expect(nodeText(treeNode('f4')!, 2)).toEqual({ text: 'Every day starts with {v} more ripe crops.', v: 3 });
    expect(nodeText(treeNode('a2')!, 2).text).toBe('Thief crows take nothing: they only come to look.');
  });

  const holder = (): TreeHolder => ({ workshop: { levels: emptyLevels(), job: null }, tree: {}, treeCredit: 0, treeSpent: 0 });
  const rich = () => true;

  it('has at least 100 nodes, each opening from one that exists', () => {
    expect(TREE.length).toBeGreaterThanOrEqual(100);
    const ids = new Set(TREE.map(n => n.id));
    for (const n of TREE) for (const p of n.parents) expect(ids.has(p)).toBe(true);
  });

  it('puts the goat\'s Pasture accord and Mulch, the growth skill, in the middle of their branches (0.15.1; Navid, 18 Nov)', () => {
    const a1 = treeNode('a1')!, a6 = treeNode('a6')!, f14 = treeNode('f14')!;
    expect([a1.d, a1.s, a1.kind]).toEqual([4, 0, 'trick']);
    expect(a1.parents.sort()).toEqual(['a3', 'a4']);
    // Barn owl opens the Rancher branch now, and Scarecrow follows it
    expect(a6.parents).toEqual(['trunk']);
    expect(treeNode('a2')!.parents).toEqual(['a6']);
    // Mulch: a track of 20 in the middle of the Field branch, priced from its ring (0.16: 12 days, 20% more a level)
    expect([f14.d, f14.s, f14.kind, f14.levels]).toEqual([4, 0, 'track', 20]);
    expect(f14.parents.sort()).toEqual(['f3', 'f4']);
    expect(f14.effect).toBe('Crops ripen 10% faster a level.');
    try {
      setTreeMoney(1000, 1);
      expect(nodeCost(f14, 0)).toBe(niceMoney(12 * 1000));
      expect(nodeCost(f14, 10)).toBe(niceMoney(12 * 1.2 ** 10 * 1000));
      // (Navid, 18 Nov: "280$ for goat is still nothing!"): more than two keystones (100 of the player's days, 0.16)
      expect(nodeCost(a1, 0)).toBe(100_000);
    } finally {
      setTreeMoney(0, 1);
    }
    // ids stay with their rows, and no two nodes share a place
    const spots = new Set(TREE.filter(n => n.kind !== 'trunk' && n.kind !== 'bridge').map(n => `${n.branch}:${n.d}:${n.s}`));
    expect(spots.size).toBe(TREE.filter(n => n.kind !== 'trunk' && n.kind !== 'bridge').length);
  });

  it('lets the way pass a node that is not built yet, so every built node can be bought (0.15.1)', () => {
    const g = holder();
    const W = TREE_WORKSHOP as Record<string, keyof typeof g.workshop.levels>;
    const own = (id: string) => (W[id] ? g.workshop.levels[W[id]] > 0 : (g.tree![id] || 0) > 0);
    // buy one level of everything that can be bought, again and again, with no money limit
    for (let grew = true; grew; ) {
      grew = false;
      for (const n of TREE) {
        if (n.kind === 'trunk' || own(n.id) || !canBuyNode(g, n).ok) continue;
        if (W[n.id]) g.workshop.levels[W[n.id]] = 1;
        else g.tree![n.id] = 1;
        grew = true;
      }
    }
    // everything built is bought but the partner of each keystone pair taken first
    const left = TREE.filter(n => n.kind !== 'trunk' && nodeLive(n.id) && !own(n.id));
    for (const n of left) expect([n.id, canBuyNode(g, n)]).toEqual([n.id, { ok: false, why: 'pair' }]);
    // Duck pond sits behind Goat treats, which is not built yet, and so opens with Pasture accord
    const h = holder();
    h.tree = { a6: 1, a2: 1, a3: 1 };
    expect(canBuyNode(h, treeNode('a13')!)).toEqual({ ok: false, why: 'locked' });
    h.tree.a1 = 1;
    expect(nodeLive('a9')).toBe(false);
    expect(canBuyNode(h, treeNode('a13')!).ok).toBe(true);
  });

  it("sells the Workshop's level tracks at the Workshop's own prices, caps and build times", () => {
    expect(Object.values(TREE_WORKSHOP).sort()).toEqual(UPGRADES.map(u => u.id).sort());
    for (const [id, w] of Object.entries(TREE_WORKSHOP)) {
      const n = treeNode(id)!, u = UPGRADES.find(x => x.id === w)!;
      expect(n.kind).toBe('track');
      expect(n.levels).toBe(u.max);
      for (const l of [0, 1, 4, 9, 17, u.max - 1]) {
        expect(nodeCost(n, l)).toBe(upgradeCost(w, l));
        expect(nodeDuration(n, l)).toBe(upgradeDuration(w, l));
      }
      expect(nodeLive(id)).toBe(true);
    }
    // the first track levels cost what they did in the farmhouse
    expect(nodeCost(treeNode('b1')!, 0)).toBe(70);
    expect(nodeCost(treeNode('f2')!, 0)).toBe(75);
  });

  it('a track level bought in the tree is the Workshop level: one state, no double counting', () => {
    const g = holder();
    g.workshop.levels.scythe = 3;
    expect(treeLevel(g, 'b1')).toBe(3);
    let paid = 0;
    expect(buyNode(g, treeNode('b1')!, 0, c => ((paid += c), true))).toEqual({ ok: true, instant: true, cost: upgradeCost('scythe', 3) });
    expect(g.workshop.levels.scythe).toBe(4);
    expect(g.tree).toEqual({});
    expect(paid).toBe(upgradeCost('scythe', 3));
    expect(g.treeSpent).toBe(paid);
  });

  it('sells a node next to one you have, one level at a time', () => {
    const g = holder();
    expect(canBuyNode(g, treeNode('p1')!).ok).toBe(true);
    expect(canBuyNode(g, treeNode('p2')!)).toEqual({ ok: false, why: 'locked' });
    expect(buyNode(g, treeNode('p1')!, 0, rich).ok).toBe(true);
    expect(g.tree!.p1).toBe(1);
    expect(canBuyNode(g, treeNode('p2')!).ok).toBe(true);
    expect(nodeCost(treeNode('p1')!, 1)).toBe(Math.round(treeNode('p1')!.price[0] * 1.2));
    // 0.16: the Power branch opens with the first tool that has its power bar
    try {
      setTreePower(false);
      expect(canBuyNode(g, treeNode('p2')!)).toMatchObject({ ok: false, why: 'power' });
      expect(canBuyNode(g, treeNode('b1')!).ok).toBe(true);
    } finally {
      setTreePower(true);
    }
    g.tree!.p2 = 3;
    expect(canBuyNode(g, treeNode('p2')!)).toEqual({ ok: false, why: 'max' });
    // no money, no node
    expect(buyNode(g, treeNode('p3')!, 0, () => false)).toEqual({ ok: false, why: 'cash' });
    expect(g.tree!.p3).toBeUndefined();
    // a node that is not built yet is not for sale
    const soon = TREE.find(n => n.kind !== 'trunk' && !nodeLive(n.id));
    if (soon) expect(canBuyNode(g, soon)).toEqual({ ok: false, why: 'soon' });
  });

  it('builds every fifth level of a track and every keystone over time, one build at a time', () => {
    const g = holder();
    g.workshop.levels.scythe = 4;
    g.workshop.levels.hands = 9;
    // Quicker hands opens from Wider swing, the track before it on the branch; an older save's levels stay open
    expect(canBuyNode(g, treeNode('f2')!)).toEqual({ ok: false, why: 'locked' });
    expect(canBuyNode(g, treeNode('r2')!)).toMatchObject({ ok: true });
    const b1 = treeNode('b1')!;
    expect(canBuyNode(g, b1)).toMatchObject({ ok: true, dur: 120_000 });
    expect(buyNode(g, b1, 1000, rich)).toMatchObject({ ok: true, instant: false });
    expect(g.workshop.job).toEqual({ id: 'scythe', level: 5, startedAt: 1000, endsAt: 121_000 });
    expect(treeLevel(g, 'b1')).toBe(4);
    expect(buildingNode(g)).toBe('b1');
    // the blade waits for its own build; another timed build waits too; an instant level elsewhere does not
    expect(canBuyNode(g, b1)).toEqual({ ok: false, why: 'building' });
    expect(canBuyNode(g, treeNode('r2')!)).toMatchObject({ ok: false, why: 'busy' });
    expect(buyNode(g, treeNode('r1')!, 1000, rich)).toMatchObject({ ok: true, instant: true });
    expect(settleTree(g, 120_999)).toBeNull();
    expect(settleTree(g, 121_000)).toMatchObject({ level: 5 });
    expect(g.workshop.levels.scythe).toBe(5);
    expect(g.workshop.job).toBeNull();
    // Power cell is the tree's own track: its fifth level is a build kept in the same job
    g.tree = { p1: 4 };
    expect(buyNode(g, treeNode('p1')!, 5000, rich)).toMatchObject({ ok: true, instant: false });
    expect(g.workshop.job!.id).toBe('p1');
    expect(g.tree.p1).toBe(4);
    // a rewarded ad finishes it now
    expect(settleTree(g, 5001, true)).toMatchObject({ level: 5 });
    expect(g.tree.p1).toBe(5);
    // a keystone takes the Workshop's longest build
    for (const n of TREE.filter(x => x.kind === 'key')) expect(nodeDuration(n, 0)).toBe(KEY_BUILD_MS);
    expect(KEY_BUILD_MS).toBe(upgradeDuration('scythe', 99));
    for (const n of TREE.filter(x => x.kind === 'trick' || x.kind === 'bridge')) expect(nodeDuration(n, 0)).toBe(0);
  });

  it('a keystone is not sold while its partner is owned or being built', () => {
    const key = TREE.find(n => n.kind === 'key' && nodeLive(n.id) && nodeLive(n.pair!));
    if (!key) return;
    const g = holder();
    for (const p of key.parents) g.tree![p] = 1;
    for (const p of treeNode(key.pair!)!.parents) g.tree![p] = 1;
    expect(buyNode(g, key, 0, rich)).toMatchObject({ ok: true, instant: false });
    expect(canBuyNode(g, treeNode(key.pair!)!)).toEqual({ ok: false, why: 'pair' });
    settleTree(g, 0, true);
    expect(g.tree![key.id]).toBe(1);
    expect(canBuyNode(g, treeNode(key.pair!)!)).toEqual({ ok: false, why: 'pair' });
  });

  it('a reset is free and gives back everything paid, tracks and a build in progress included', () => {
    const g = holder();
    let paid = 0;
    const pay = (c: number) => ((paid += c), true);
    for (let i = 0; i < 5; i++) expect(buyNode(g, treeNode('b1')!, 0, pay).ok).toBe(true); // four levels and a build
    expect(buyNode(g, treeNode('p1')!, 0, pay).ok).toBe(true);
    expect(buyNode(g, treeNode('p2')!, 0, pay).ok).toBe(true);
    expect(g.workshop.job).not.toBeNull();
    expect(treeHasAny(g)).toBe(true);
    expect(treeRefund(g)).toBe(paid);
    expect(paid).toBe(treeListValue(g));
    g.treeCredit = 40;
    expect(resetTree(g)).toBe(paid);
    expect(g.treeCredit).toBe(40 + paid);
    expect(g.workshop.levels).toEqual(emptyLevels());
    expect(g.workshop.job).toBeNull();
    expect(g.tree).toEqual({});
    expect(treeRefund(g)).toBe(0);
    expect(treeHasAny(g)).toBe(false);
  });

  it('Coupon book makes everything in the tree 5% cheaper a level, and a reset gives back what was paid, not the list price', () => {
    const g = holder();
    const b1 = treeNode('b1')!;
    expect(nodePrice(g, b1)).toBe(70);
    g.tree!.m9 = 1;
    expect(treeDiscount(g)).toBeCloseTo(0.95, 9);
    expect(nodePrice(g, b1)).toBe(Math.round(70 * 0.95));
    g.tree!.m9 = 3;
    expect(nodePrice(g, b1)).toBe(Math.round(70 * 0.85));
    expect(canBuyNode(g, b1)).toMatchObject({ ok: true, cost: 60 });
    let paid = 0;
    expect(buyNode(g, b1, 0, c => ((paid += c), true))).toMatchObject({ ok: true, cost: 60 });
    expect(paid).toBe(60);
    expect(g.treeSpent).toBe(60);
    // the reset pays back the 60 that were paid (the node m9 was put there by the test for nothing)
    expect(resetTree(g)).toBe(60);
    expect(nodePrice(g, b1)).toBe(70);
  });

  it('counts the nodes that can be bought now with the money at hand (the badge on the Upgrades tile)', () => {
    const g = holder();
    // nothing owned: the first node of each branch that is built is open
    const open = TREE.filter(n => canBuyNode(g, n).ok);
    expect(open.every(n => n.d === 1)).toBe(true);
    expect(treeReady(g, 0)).toHaveLength(0);
    expect(treeReady(g, 20).map(n => n.id).sort()).toEqual(open.filter(n => nodeCost(n, 0) <= 20).map(n => n.id).sort());
    expect(treeReady(g, 1e9)).toHaveLength(open.length);
  });

  it('a save keeps the tree, its build, the credit and the ledger; bad values are dropped', () => {
    const g = newGame();
    g.tree = { p1: 3, m2: 2 };
    g.treeCredit = 500;
    g.treeSpent = 1234;
    g.workshop.job = { id: 'p1', level: 5, startedAt: 10, endsAt: 20 };
    const raw = JSON.parse(JSON.stringify(g));
    raw.tree.zz9 = 4;
    raw.tree.trunk = 1;
    raw.tree.m2 = 99;
    const back = parseGame(JSON.stringify(raw));
    expect(back.tree).toEqual({ p1: 3, m2: 3 });
    expect(back.treeCredit).toBe(500);
    expect(back.treeSpent).toBe(1234);
    expect(back.workshop.job).toEqual({ id: 'p1', level: 5, startedAt: 10, endsAt: 20 });
    raw.workshop.job.id = 'nonsense';
    expect(parseGame(JSON.stringify(raw)).workshop.job).toBeNull();
    // a track level above its top is cut back
    raw.workshop.levels.swing = 77;
    expect(parseGame(JSON.stringify(raw)).workshop.levels.swing).toBe(30);
  });
});
