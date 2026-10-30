import { describe, expect, it } from 'vitest';
import { BILL_COUNT, DAYS_PER_BILL, LADDER_HP, LADDER_VAL, allPlans, cropName, planFor, dayRef, expectedPower, toughnessFor } from '../src/game/plan';
import { BLASTER_RANGE_GAIN, bestPower, fieldPower } from '../src/game/power';
import { COUNTRIES, ROUTE, isBossCity } from '../src/game/world';
import {
  bankAfterWin, cityLock, countryLock, newGame, nextCity, paidAfterRun, parseGame, spendableFarmCash, starGate, starsFor, toolLock,
  walletAfterForeclosure, type GameSave, type RunInfo,
} from '../src/game/progress';
import { MAX_LEVEL, SHED_FX, UPGRADES, emptyLevels, oldWorkshopRefund, settleJob, startUpgrade, upgradeCost, upgradeDuration } from '../src/game/workshop';
import { TOOLS, modCost, newTools, parseTools, toolStats } from '../src/game/tools';

function winAll(g: GameSave, ids: string[], stars = 3): void {
  for (const id of ids) g.cities[id] = { won: true, stars, bestDay: 100, crown: stars === 3, bestDays: 2, plays: 1, paid: 0 };
}

describe('city plans', () => {
  const plans = allPlans();

  it('covers all 30 farms in route order', () => {
    expect(ROUTE).toHaveLength(30);
    expect(plans.map(p => p.index)).toEqual(ROUTE.map((_, i) => i));
  });

  it('gives every farm two days per bill, starting with the seed loan and ending with the deed', () => {
    for (const p of plans) {
      expect(p.bills.length).toBe(BILL_COUNT[p.country] + (p.boss ? 1 : 0));
      expect(p.bills.length).toBeGreaterThanOrEqual(5);
      for (const b of p.bills) expect(b.days).toBe(DAYS_PER_BILL);
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
    // Navid (29 Oct): the first farm runs about ten days
    expect(plans[0].totalDays).toBe(10);
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

  it('gives days of 25 seconds before upgrades', () => {
    for (const p of plans) expect(p.dayBase).toBe(25);
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

  it('gives every tool three attachments of two or three levels', () => {
    for (const t of TOOLS) {
      expect(t.mods).toHaveLength(3);
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
