import { describe, expect, it } from 'vitest';
import { ROUTE, isBossCity } from '../src/game/world';
import { newGame, parseGame, type GameSave } from '../src/game/progress';
import { DIAMOND_CREDIT, OLD_SKILLS, TREE_SKILL, resetTree, treeListValue, treeNode } from '../src/game/tree';
import { FLAIR, FLAIR_KINDS, buyFlair, equipFlair, lookFor, newFlair, parseFlair, ribbonsForWin } from '../src/game/flair';
import { DAILY_AD_TRIES, MEDAL_RIBBONS, dailyFor, duelFor, hash32, medalOf, newDaily, sidePlan, triesLeft } from '../src/game/daily';

describe('diamonds are retired: an older save moves into the upgrade tree (0.13)', () => {
  /** A save as 0.12.4 wrote it. */
  function oldSave(extra: Record<string, unknown> = {}): string {
    const cities: Record<string, unknown> = {};
    for (const c of ROUTE.slice(0, 6)) cities[c.id] = { won: true, stars: 2, bestDay: 200, crown: false, bestDays: 19, plays: 1, paid: 0 };
    return JSON.stringify({
      v: 3, econ: 10, createdAt: 1, cities, run: null, wallet: 1338, splitWallet: true,
      workshop: { levels: { scythe: 6, swing: 2, hands: 2, days: 2, soil: 2, market: 2, clover: 1 }, job: null },
      tools: { owned: ['sickle'], equipped: 'sickle', mods: {} },
      skills: ['core_awakening', 'gold_root', 'gold_lawyer', 'reap_root', 'reap_cleave'],
      bonusDiamonds: 5, ribbons: 4,
      ...extra,
    });
  }

  it('derives the rate from the 12 skill nodes: the middle of first-level price over diamonds is $1,000', () => {
    const ratios = Object.entries(TREE_SKILL).map(([node, skill]) => treeNode(node)!.price[0] / OLD_SKILLS[skill].cost).sort((a, b) => a - b);
    expect(ratios).toHaveLength(12);
    expect((ratios[5] + ratios[6]) / 2).toBe(DIAMOND_CREDIT);
    // every skill of the old map is accounted for: 19 skills, 55 diamonds
    expect(Object.keys(OLD_SKILLS)).toHaveLength(19);
    expect(Object.values(OLD_SKILLS).reduce((a, s) => a + s.cost, 0)).toBe(55);
    for (const [node, skill] of Object.entries(TREE_SKILL)) expect(OLD_SKILLS[skill].nodes!.some(([id]) => id === node)).toBe(true);
  });

  it('turns learned skills into owned nodes and every other diamond into tree credit, once', () => {
    // Canada won: 5 farms and a boss farm = 7 diamonds, plus 5 from daily golds = 12 earned; 11 spent on five skills
    expect(isBossCity(ROUTE[5].id)).toBe(true);
    const g = parseGame(oldSave());
    // the skills that are tree nodes: Retained counsel at the level that gives its old 12%, Sundering cleave
    expect(g.tree).toEqual({ m2: 3, p5: 1 });
    // 6 diamonds stay in those two nodes; the other 6 (1 unspent, 5 in plain stat skills) come back as credit
    expect(g.treeCredit).toBe(6 * DIAMOND_CREDIT);
    expect(g.migratedTree).toEqual({ credit: 6000, nodes: 2 });
    // nothing else moves: track levels, savings, ribbons
    expect(g.workshop.levels.scythe).toBe(6);
    expect(g.wallet).toBe(1338);
    expect(g.ribbons).toBe(4);
    expect('skills' in g).toBe(false);
    expect('bonusDiamonds' in g).toBe(false);
    // the ledger: track levels at the Workshop's prices, the skills' nodes at what their diamonds are worth
    const tracks = treeListValue({ workshop: g.workshop, tree: {} });
    expect(g.treeSpent).toBe(tracks + 6 * DIAMOND_CREDIT);
    // a reset pays every diamond back at the same rate, spent or not
    const copy = parseGame(JSON.stringify(g));
    expect(resetTree(copy)).toBe(tracks + 6000);
    expect(copy.treeCredit).toBe(12 * DIAMOND_CREDIT + tracks);
    // loading the migrated save again changes nothing (no second credit)
    delete g.migratedTree;
    const again = parseGame(JSON.stringify(g));
    expect(again.treeCredit).toBe(6000);
    expect(again.tree).toEqual({ m2: 3, p5: 1 });
    expect(again.treeSpent).toBe(g.treeSpent);
    expect(again.migratedTree).toBeUndefined();
  });

  it("gives Reaper's verdict its lightning too (Storm rod), and keeps nodes bought in the 0.12.3 tree", () => {
    const g = parseGame(oldSave({ skills: ['reap_exec', 'soil_dew', 'gold_interest'], bonusDiamonds: 3, tree: { p1: 2, f4: 2 }, treeCredit: 250 }));
    expect(g.tree).toEqual({ p1: 2, f4: 2, b11: 1, b5: 1, m7: 3 });
    // 10 earned; Dawn abundance was already bought with cash at a higher level, so its 3 diamonds come back:
    // 4 + 3 stay in nodes, 3 are credit, on top of the credit the save had
    expect(g.treeCredit).toBe(250 + 3 * DIAMOND_CREDIT);
    const cash = treeListValue({ workshop: g.workshop, tree: { p1: 2, f4: 2 } });
    expect(g.treeSpent).toBe(cash + 7 * DIAMOND_CREDIT);
  });

  it('a save with nothing learned gets its diamonds as credit; a new game gets none', () => {
    const g = parseGame(oldSave({ skills: [], bonusDiamonds: 0 }));
    expect(g.treeCredit).toBe(7 * DIAMOND_CREDIT);
    expect(g.tree).toEqual({});
    const n = parseGame(JSON.stringify(newGame()));
    expect(n.treeCredit).toBe(0);
    expect(n.migratedTree).toBeUndefined();
    expect(parseGame(null).treeCredit).toBe(0);
  });

  it('keeps a daily gold already paid today, under its old name', () => {
    const g = parseGame(oldSave({ daily: { date: '2026-11-09', plays: 1, adPlays: 0, best: 900, medal: 3, goldDiamond: true } }));
    expect(g.daily.goldPaid).toBe(true);
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
