import { describe, expect, it } from 'vitest';
import { allPlans, planFor, dayRef } from '../src/game/plan';
import { COUNTRIES, ROUTE, isBossCity } from '../src/game/world';
import {
  cityLock, countryLock, newGame, nextCity, parseGame, starGate, starsFor, toolLock, walletAfterForeclosure, type GameSave,
} from '../src/game/progress';
import { UPGRADES, emptyLevels, settleJob, startUpgrade, upgradeCost, upgradeDuration } from '../src/game/workshop';
import { TOOLS, modCost, newTools, parseTools, toolStats } from '../src/game/tools';

function winAll(g: GameSave, ids: string[], stars = 3): void {
  for (const id of ids) g.cities[id] = { won: true, stars, bestDay: 100, crown: stars === 3, bestDays: 2, plays: 1 };
}

describe('city plans', () => {
  const plans = allPlans();

  it('covers all 30 farms in route order', () => {
    expect(ROUTE).toHaveLength(30);
    expect(plans.map(p => p.index)).toEqual(ROUTE.map((_, i) => i));
  });

  it('gives every farm at least two days and two bills, ending with the deed', () => {
    for (const p of plans) {
      expect(p.bills.length).toBeGreaterThanOrEqual(2);
      expect(p.totalDays).toBeGreaterThanOrEqual(3);
      expect(p.totalDays).toBe(p.bills.reduce((a, b) => a + b.days, 0));
      expect(p.bills[p.bills.length - 1].name).toBe('The deed');
      expect(p.par).toBeGreaterThanOrEqual(2);
      expect(p.par).toBeLessThan(p.totalDays);
      for (const b of p.bills) expect(b.amt).toBeGreaterThan(0);
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

  it('starts each farm with crops from its country trio', () => {
    for (const p of plans) {
      const trio = COUNTRIES.find(c => c.code === p.country)!.trio;
      expect(trio).toContain(p.crops[0][0]);
      expect(p.crops.slice(0, 3).every(c => c[2] === 0)).toBe(true);
    }
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
    g.cities.ca_charlottetown = { won: true, stars: 2, bestDay: 150, crown: false, bestDays: 2, plays: 3 };
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

  it('scores stars for winning, par and the crown', () => {
    expect(starsFor({ won: false, days: 3, par: 3, crown: true }).stars).toBe(0);
    expect(starsFor({ won: true, days: 4, par: 3, crown: false }).stars).toBe(1);
    expect(starsFor({ won: true, days: 3, par: 3, crown: false }).stars).toBe(2);
    expect(starsFor({ won: true, days: 3, par: 3, crown: true }).stars).toBe(3);
  });

  it('keeps the par star for bills earned on the farm', () => {
    expect(starsFor({ won: true, days: 0, par: 3, crown: false }).par).toBe(false);
    expect(starsFor({ won: true, days: 1, par: 3, crown: false, selfFunded: false }).stars).toBe(1);
    expect(starsFor({ won: true, days: 1, par: 3, crown: false, selfFunded: true }).stars).toBe(2);
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
  it('prices rise with level and stop at the max', () => {
    for (const u of UPGRADES) {
      expect(upgradeCost(u.id, 1)!).toBeGreaterThan(upgradeCost(u.id, 0)!);
      expect(upgradeCost(u.id, u.max)).toBeNull();
    }
  });

  it('builds small upgrades at once and bigger ones over time, one at a time', () => {
    const ws = { levels: emptyLevels(), job: null };
    let cash = 1e9;
    const pay = (c: number) => (cash >= c ? ((cash -= c), true) : false);
    expect(startUpgrade(ws, 'scythe', 0, pay)).toEqual({ ok: true, instant: true });
    ws.levels.scythe = 4;
    expect(upgradeDuration('scythe', 4)).toBeGreaterThan(0);
    expect(startUpgrade(ws, 'scythe', 1000, pay)).toEqual({ ok: true, instant: false });
    expect(startUpgrade(ws, 'swing', 1000, pay)).toEqual({ ok: true, instant: true });
    ws.levels.hands = 9;
    expect(startUpgrade(ws, 'hands', 1000, pay)).toEqual({ ok: false, reason: 'busy' });
    expect(settleJob(ws, 1001)).toBeNull();
    expect(settleJob(ws, 1001, true)!.id).toBe('scythe');
    expect(ws.levels.scythe).toBe(5);
    expect(upgradeDuration('scythe', 39)).toBeLessThanOrEqual(3_600_000);
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
    expect(b.targets).toBe(3);
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
