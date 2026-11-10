import { describe, expect, it } from 'vitest';
import { BILL_COUNT, DAY_SECONDS, billDays, LADDER_HP, LADDER_VAL, allPlans, cropName, planFor, dayRef, expectedPower, toughnessFor } from '../src/game/plan';
import { BLASTER_RANGE_GAIN, bestPower, fieldPower } from '../src/game/power';
import { COUNTRIES, ROUTE, isBossCity } from '../src/game/world';
import {
  bankAfterWin, cityLock, coinsForDays, countryLock, newGame, nextCity, paidAfterRun, parseGame, spendableFarmCash, starGate, starsFor, toolLock,
  walletAfterForeclosure, type GameSave, type RunInfo,
} from '../src/game/progress';
import { MAX_LEVEL, SHED_FX, UPGRADES, emptyLevels, oldWorkshopRefund, settleJob, startUpgrade, upgradeCost, upgradeDuration } from '../src/game/workshop';
import { TOOLS, modCost, newTools, parseTools, toolStats, toolSummary } from '../src/game/tools';
import {
  KEY_BUILD_MS, TREE, TREE_WORKSHOP, buildingNode, buyNode, canBuyNode, nodeCost, nodeDuration, nodeLive, resetTree, settleTree, treeHasAny, treeLevel,
  treeListValue, treeNode, treeReady, treeRefund, type TreeHolder,
} from '../src/game/tree';

function winAll(g: GameSave, ids: string[], stars = 3): void {
  for (const id of ids) g.cities[id] = { won: true, stars, bestDay: 100, crown: stars === 3, bestDays: 2, plays: 1, paid: 0 };
}

describe('city plans', () => {
  const plans = allPlans();

  it('covers all 30 farms in route order', () => {
    expect(ROUTE).toHaveLength(30);
    expect(plans.map(p => p.index)).toEqual(ROUTE.map((_, i) => i));
  });

  it('gives every farm bills of 2, 3, 4, then 5 days, starting with the seed loan and ending with the deed', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(billDays)).toEqual([2, 3, 4, 5, 5, 5, 5]);
    for (const p of plans) {
      expect(p.bills.length).toBe(BILL_COUNT[p.country] + (p.boss ? 1 : 0));
      expect(p.bills.length).toBeGreaterThanOrEqual(5);
      p.bills.forEach((b, i) => expect(b.days).toBe(billDays(i)));
      expect(p.totalDays).toBe(p.bills.reduce((a, b) => a + b.days, 0));
      expect(p.bills[0].name).toBe('Seed loan');
      expect(p.bills[p.bills.length - 1].name).toBe('The deed');
      expect(new Set(p.bills.map(b => b.name)).size).toBe(p.bills.length);
      // the second star: keep about half the deed after paying it
      const deed = p.bills[p.bills.length - 1].amt;
      expect(p.spare).toBeGreaterThan(deed * 0.45);
      expect(p.spare).toBeLessThan(deed * 0.55);
      for (let i = 0; i < p.bills.length; i++) {
        expect(p.bills[i].amt).toBeGreaterThan(0);
        if (i) expect(p.bills[i].amt).toBeGreaterThan(p.bills[i - 1].amt);
      }
    }
    // Navid (5 Nov): bills of 2, 3, 4 and 5 days, so a five-bill farm runs 19 days
    expect(plans[0].totalDays).toBe(19);
  });

  it('gets harder city by city', () => {
    for (let i = 1; i < plans.length; i++) {
      expect(plans[i].hp).toBeGreaterThan(plans[i - 1].hp);
      expect(plans[i].val).toBeGreaterThan(plans[i - 1].val);
      expect(dayRef(i)).toBeGreaterThan(dayRef(i - 1));
    }
    const first = plans[0], last = plans[plans.length - 1];
    expect(last.totalDays).toBeGreaterThan(first.totalDays);
    expect(last.bills.length).toBeGreaterThan(first.bills.length);
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

  it('starts each farm with carrots only and adds one crop per bill paid, each worth more and tougher', () => {
    for (const p of plans) {
      const trio = COUNTRIES.find(c => c.code === p.country)!.trio;
      expect(p.stages.map(s => s.type).slice(0, 2)).toEqual(['carrot', 'radish']);
      expect(p.stages).toHaveLength(p.bills.length);
      expect(p.stages.slice(2, 5).map(s => s.type).sort()).toEqual([...trio].sort());
      // unlocks: stage n needs n bills paid (the engine adds the city's content level to both sides)
      p.crops.forEach(([type, , at], i) => {
        expect(type).toBe(p.stages[i].type);
        expect(at - p.unlock).toBe(i);
        expect(p.cropVal[type]).toBe(LADDER_VAL[i]);
        expect(p.cropHp[type]).toBe(LADDER_HP[i]);
      });
      expect(p.crops.filter(c => c[2] - p.unlock <= 0).map(c => c[0])).toEqual(['carrot']);
      expect(new Set(p.stages.map(s => s.type)).size).toBe(p.stages.length);
      expect(p.goldAt).toBe(p.unlock + 2);
    }
    for (let i = 1; i < LADDER_VAL.length; i++) {
      expect(LADDER_VAL[i]).toBeGreaterThan(LADDER_VAL[i - 1]);
      expect(LADDER_HP[i]).toBeGreaterThan(LADDER_HP[i - 1]);
    }
    expect(cropName('radish')).toBe('Runaway Radish');
    expect(cropName('pei_russet')).toBe('Hoser Russet');
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
    winAll(g, ca.slice(0, 5), 3);
    expect(cityLock(g, ca[5]).open).toBe(true);
    expect(countryLock(g, 'US').reason).toMatch(/Win/);
    winAll(g, [ca[5]], 1);
    // 5 × 3 + 1 = 16 stars, the gate is 11
    expect(starGate('CA')).toBe(11);
    expect(countryLock(g, 'US').open).toBe(true);
    expect(nextCity(g)).toBe('us_austin');
  });

  it('holds the next country until the star gate is met', () => {
    const g = newGame();
    winAll(g, COUNTRIES[0].cities.map(c => c.id), 1);
    const lock = countryLock(g, 'US');
    expect(lock.open).toBe(false);
    expect(lock.reason).toMatch(/more ★/);
  });

  it('scores stars for winning, money to spare after the deed and the crown', () => {
    expect(starsFor({ won: false, cashLeft: 900, spare: 100, crown: true }).stars).toBe(0);
    expect(starsFor({ won: true, cashLeft: 99, spare: 100, crown: false }).stars).toBe(1);
    expect(starsFor({ won: true, cashLeft: 100, spare: 100, crown: false }).stars).toBe(2);
    expect(starsFor({ won: true, cashLeft: 100, spare: 100, crown: true }).stars).toBe(3);
    expect(starsFor({ won: true, cashLeft: 0, spare: 100, crown: true }).spare).toBe(false);
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
    expect(back.econ).toBe(10);
    // a v0.10 save is left alone
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
    expect(toolSummary(toolStats({ owned: ['sickle', 'scythe'], equipped: 'scythe', mods: {} }, 'scythe'))[0]).toBe('Power: Whirlwind');
    expect(modCost('sickle', 'charge', 0)).toBe(300);
    expect(parseTools({ owned: ['sickle'], equipped: 'sickle', mods: { 'sickle.charge': 9 } }).mods['sickle.charge']).toBe(5);
  });
});

describe('the upgrade tree (0.13: the one upgrade system)', () => {
  const holder = (): TreeHolder => ({ workshop: { levels: emptyLevels(), job: null }, tree: {}, treeCredit: 0, treeSpent: 0 });
  const rich = () => true;

  it('has at least 100 nodes, each opening from one that exists', () => {
    expect(TREE.length).toBeGreaterThanOrEqual(100);
    const ids = new Set(TREE.map(n => n.id));
    for (const n of TREE) for (const p of n.parents) expect(ids.has(p)).toBe(true);
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
    expect(nodeCost(treeNode('p1')!, 1)).toBe(Math.round(treeNode('p1')!.price[0] * 1.12));
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
