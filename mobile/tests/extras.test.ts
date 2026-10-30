import { describe, expect, it } from 'vitest';
import { ROUTE, isBossCity } from '../src/game/world';
import { newGame, parseGame, type GameSave } from '../src/game/progress';
import { SKILLS, canLearn, diamondsEarned, diamondsLeft, learn, resetSkills, revealed, skillDef } from '../src/game/skills';
import { FLAIR, FLAIR_KINDS, buyFlair, equipFlair, lookFor, newFlair, parseFlair, ribbonsForWin } from '../src/game/flair';
import { DAILY_AD_TRIES, MEDAL_RIBBONS, dailyFor, duelFor, hash32, medalOf, newDaily, sidePlan, triesLeft } from '../src/game/daily';

function won(g: GameSave, n: number): void {
  for (const c of ROUTE.slice(0, n)) g.cities[c.id] = { won: true, stars: 1, bestDay: 10, crown: false, bestDays: 3, plays: 1 };
}

describe('skill map', () => {
  it('pays one diamond per farm won and two per boss farm, plus bonus diamonds', () => {
    const g = newGame();
    expect(diamondsEarned(g)).toBe(0);
    won(g, 6); // Canada, the sixth farm is a boss farm
    expect(isBossCity(ROUTE[5].id)).toBe(true);
    expect(diamondsEarned(g)).toBe(7);
    g.bonusDiamonds = 2;
    expect(diamondsEarned(g)).toBe(9);
  });

  it('needs daily gold medals as well as the route to learn the whole map', () => {
    const g = newGame();
    won(g, ROUTE.length);
    const total = SKILLS.reduce((a, s) => a + s.cost, 0);
    expect(diamondsEarned(g)).toBe(37);
    expect(total).toBe(55);
    // the core and the three branch roots are within reach by the end of Canada (7 diamonds)
    const base = SKILLS.filter(s => !s.reqs.length || (s.reqs.length === 1 && s.reqs[0] === 'core_awakening'));
    expect(base.reduce((a, s) => a + s.cost, 0)).toBe(7);
  });

  it('only teaches a skill next to one already learned, and only with enough diamonds', () => {
    const g = newGame();
    expect(canLearn(g, 'core_awakening').ok).toBe(false); // no diamonds yet
    won(g, 3);
    expect(canLearn(g, 'reap_root').ok).toBe(false); // needs the core first
    expect(learn(g, 'core_awakening')).toBe(true);
    expect(learn(g, 'reap_root')).toBe(true);
    expect(diamondsLeft(g)).toBe(0);
    expect(learn(g, 'soil_root')).toBe(false);
    expect(canLearn(g, 'reap_swift').reason).toMatch(/Needs 3/);
  });

  it('lets a capstone open from either neighbour', () => {
    const g = newGame();
    won(g, 12);
    for (const id of ['core_awakening', 'reap_root', 'reap_swift', 'reap_dash']) expect(learn(g, id)).toBe(true);
    expect(canLearn(g, 'reap_exec').ok).toBe(true);
  });

  it('hides skills in the clouds until a neighbour is learned', () => {
    const g = newGame();
    expect(revealed(g, skillDef('core_awakening')!)).toBe(true);
    expect(revealed(g, skillDef('reap_root')!)).toBe(false);
    won(g, 1);
    learn(g, 'core_awakening');
    expect(revealed(g, skillDef('reap_root')!)).toBe(true);
    expect(revealed(g, skillDef('reap_swift')!)).toBe(false);
  });

  it('resets for free', () => {
    const g = newGame();
    won(g, 3);
    learn(g, 'core_awakening');
    learn(g, 'gold_root');
    resetSkills(g);
    expect(g.skills).toEqual([]);
    expect(diamondsLeft(g)).toBe(3);
  });

  it('places every node on the 844 by 390 map with known prerequisites', () => {
    const ids = new Set(SKILLS.map(s => s.id));
    for (const s of SKILLS) {
      expect(s.x).toBeGreaterThan(20);
      expect(s.x).toBeLessThan(540);
      expect(s.y).toBeGreaterThan(60);
      expect(s.y).toBeLessThan(380);
      for (const r of s.reqs) expect(ids.has(r)).toBe(true);
    }
  });
});

describe('Bling Barn', () => {
  it('starts with the free look of every kind owned and in use', () => {
    const f = newFlair();
    for (const k of FLAIR_KINDS) {
      const item = FLAIR.find(x => x.id === f.equipped[k.kind])!;
      expect(item.price).toBe(0);
      expect(f.owned).toContain(item.id);
    }
  });

  it('buys with ribbons, puts the item on and refuses a second purchase', () => {
    const f = newFlair();
    expect(buyFlair(f, 3, 'finish_gold').ok).toBe(false);
    const r = buyFlair(f, 10, 'finish_gold');
    expect(r).toEqual({ ok: true, cost: 6 });
    expect(f.equipped.finish).toBe('finish_gold');
    expect(buyFlair(f, 10, 'finish_gold').ok).toBe(false);
    expect(equipFlair(f, 'finish_classic')).toBe(true);
    expect(equipFlair(f, 'trail_fire')).toBe(false); // not owned
  });

  it('only changes looks, never stats', () => {
    for (const it of FLAIR) for (const k of Object.keys(it.look)) expect(['metal', 'wood', 'trim', 'accent', 'toy', 'rainbow', 'trail', 'bird', 'coin']).toContain(k);
    const f = newFlair();
    buyFlair(f, 99, 'bird_jay');
    expect(lookFor(f).bird).toEqual(['#3b82f6', '#1f2937']);
  });

  it('drops unknown or unowned items from a save', () => {
    const f = parseFlair({ owned: ['finish_gold', 'nope'], equipped: { finish: 'finish_gold', trail: 'trail_fire', bird: 'nope', coin: 'coin_gold' } });
    expect(f.owned).toContain('finish_gold');
    expect(f.owned).not.toContain('nope');
    expect(f.equipped.finish).toBe('finish_gold');
    expect(f.equipped.trail).toBe('trail_classic');
    expect(f.equipped.bird).toBe('bird_crow');
  });

  it('gives ribbons for new stars, a first crown and a first boss win', () => {
    expect(ribbonsForWin(1, 3, false, false)).toBe(2);
    expect(ribbonsForWin(2, 1, false, false)).toBe(0);
    expect(ribbonsForWin(0, 0, true, false)).toBe(2);
    expect(ribbonsForWin(0, 2, false, true)).toBe(5);
  });

  it('gives older saves ribbons for what they already won', () => {
    const raw = JSON.stringify({ v: 3, cities: { ca_charlottetown: { won: true, stars: 3, crown: true }, ca_kelowna: { won: true, stars: 1 } } });
    const g = parseGame(raw);
    expect(g.ribbons).toBe(3 + 2 + 1 + 3);
    const again = parseGame(JSON.stringify({ ...JSON.parse(raw), ribbons: 4 }));
    expect(again.ribbons).toBe(4);
  });
});

describe('savings', () => {
  it('keeps savings out of a running farm, and moves old saves over without counting them twice', () => {
    expect(newGame().splitWallet).toBe(true);
    // v0.8: a running farm's cash already held the savings it started with; v0.10 closes that farm and the app moves
    // its cash (start money included) to savings once, so nothing counts twice
    const old = parseGame(JSON.stringify({ v: 3, wallet: 500, run: { cityId: 'ca_toronto', startCash: 500, startedAt: 1, bestDay: 0 } }));
    expect(old.wallet).toBe(0);
    expect(old.run).toBeNull();
    expect(old.migratedFarm).toBe(true);
    expect(old.splitWallet).toBe(true);
    // v0.8 between farms: the wallet was the savings
    expect(parseGame(JSON.stringify({ v: 3, wallet: 500 })).wallet).toBe(500);
    // v0.9 with a farm running: savings stay as saved, the farm is closed for v0.10's longer farms
    const now = parseGame(JSON.stringify({ v: 3, wallet: 500, splitWallet: true, run: { cityId: 'ca_toronto', startCash: 0, startedAt: 1, bestDay: 0 } }));
    expect(now.wallet).toBe(500);
    expect(now.run).toBeNull();
    // v0.10 with a farm running: kept
    const cur = parseGame(JSON.stringify({ v: 3, econ: 10, wallet: 70, splitWallet: true, run: { cityId: 'ca_toronto', startCash: 0, startedAt: 1, bestDay: 0, mark: 30, spent: 5 } }));
    expect(cur.run!.mark).toBe(30);
    expect(cur.run!.spent).toBe(5);
    expect(cur.migratedFarm).toBeUndefined();
  });
});

describe('daily farm and duels', () => {
  it('gives everyone the same farm, tool and field on a date', () => {
    const a = dailyFor('2026-10-29'), b = dailyFor('2026-10-29'), c = dailyFor('2026-10-30');
    expect(a).toEqual(b);
    expect(a.seed).not.toBe(c.seed);
    expect(ROUTE.map(x => x.id)).toContain(a.cityId);
    expect(hash32('x')).toBe(hash32('x'));
  });

  it('spreads the daily over the whole route and every tool', () => {
    const cities = new Set<string>(), tools = new Set<string>();
    for (let d = 1; d <= 200; d++) {
      const day = dailyFor(`2027-${String(Math.ceil(d / 28)).padStart(2, '0')}-${String(((d - 1) % 28) + 1).padStart(2, '0')}`);
      cities.add(day.cityId);
      tools.add(day.tool);
    }
    expect(cities.size).toBeGreaterThan(20);
    expect(tools.size).toBe(4);
  });

  it('awards medals in order and ribbons that only add up', () => {
    const t: [number, number, number] = [100, 200, 300];
    expect([medalOf(t, 99), medalOf(t, 100), medalOf(t, 250), medalOf(t, 300)]).toEqual([0, 1, 2, 3]);
    for (let i = 1; i < MEDAL_RIBBONS.length; i++) expect(MEDAL_RIBBONS[i]).toBeGreaterThan(MEDAL_RIBBONS[i - 1]);
  });

  it('allows one free try a day and more with ads', () => {
    const d = newDaily('2026-10-29');
    expect(triesLeft(d)).toBe(1);
    d.plays = 1;
    expect(triesLeft(d)).toBe(0);
    d.adPlays = DAILY_AD_TRIES;
    expect(triesLeft(d)).toBe(DAILY_AD_TRIES);
  });

  it('runs side farms with no boss and a bill nobody can reach', () => {
    for (const c of ROUTE) {
      const p = sidePlan(c.id);
      expect(p.boss).toBe(false);
      expect(p.bossFight).toBeUndefined();
      expect(p.bills).toHaveLength(1);
      expect(p.bills[0].days).toBeGreaterThan(10);
    }
    const d = duelFor('ca_toronto', 'scythe', 42);
    expect(d.targets[0]).toBeLessThan(d.targets[1]);
    expect(d.targets[1]).toBeLessThan(d.targets[2]);
  });

  it('keeps today in the save and starts over on a new date', () => {
    const g = parseGame(JSON.stringify({ v: 3, daily: { date: '2026-10-28', plays: 1, adPlays: 2, best: 900, medal: 2, goldDiamond: false } }));
    expect(g.daily.date).toBe('2026-10-28');
    expect(g.daily.best).toBe(900);
    expect(newGame().daily.plays).toBe(0);
  });
});
