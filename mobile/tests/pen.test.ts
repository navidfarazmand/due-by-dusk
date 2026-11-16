import { describe, expect, it } from 'vitest';
import {
  PEN_BASE, PEN_CAP_HOURS, PEN_MAX_LEVEL, PEN_STEP, addWorker, collectPen, newPen, parsePen, penFill, penRate, penStored, workerCount, workerLevel, workerRate, workerShare,
} from '../src/game/pen';
import { cutsForLevel } from '../src/game/road';
import { newGame, parseGame } from '../src/game/progress';
import { RUNAWAY } from '../src/game/road';

const H = 3_600_000;

describe('the Pen (0.14): caught runaways work off-screen', () => {
  it('fills from its first worker, at a share of an average day an hour, and stops after three hours', () => {
    const t0 = 1_000_000;
    const pen = newPen(t0);
    expect(penStored(pen, t0 + H, 100)).toBe(0);
    expect(addWorker(pen, 'carrot', t0)).toBe(true);
    expect(addWorker(pen, 'carrot', t0)).toBe(false);
    expect(workerCount(pen)).toBe(1);
    expect(penRate(pen, 1000)).toBeCloseTo(PEN_BASE * 1000, 6);
    expect(penStored(pen, t0 + H, 1000)).toBe(Math.floor(PEN_BASE * 1000));
    expect(penStored(pen, t0 + 10 * H, 1000)).toBe(Math.floor(PEN_CAP_HOURS * PEN_BASE * 1000));
    expect(penFill(pen, t0 + 1.5 * H)).toBeCloseTo(0.5, 6);
    expect(penFill(pen, t0 + 9 * H)).toBe(1);
    // collecting empties it and the clock starts again
    const got = collectPen(pen, t0 + 2 * H, 1000);
    expect(got).toBe(Math.floor(2 * PEN_BASE * 1000));
    expect(penStored(pen, t0 + 2 * H, 1000)).toBe(0);
  });

  it("pays more per level; a level is the vegetable's own, from the player's cuts, not bought (0.15)", () => {
    expect(workerShare(1)).toBe(PEN_BASE);
    expect(workerShare(2)).toBeCloseTo(PEN_BASE * (1 + PEN_STEP), 9);
    expect(workerRate(5, 500)).toBeCloseTo(workerShare(5) * 500, 9);
    expect(workerShare(99)).toBe(workerShare(PEN_MAX_LEVEL));
    // Navid, 15 Nov: "662 an hour? with all vegetables at level 1???": six level-1 workers fill a full Pen with a
    // small part of a day
    const t0 = 1_000_000, pen = newPen(t0);
    for (const ty of ['a_one', 'a_two', 'a_three', 'a_four', 'a_five', 'a_six']) addWorker(pen, ty, t0);
    expect(penStored(pen, t0 + 10 * H, 1000) / 1000).toBeLessThan(0.15);
    // cutting a vegetable raises its worker's level and pay
    expect(workerLevel('a_one', {})).toBe(1);
    const cuts = { a_one: cutsForLevel(4) };
    expect(workerLevel('a_one', cuts)).toBe(4);
    expect(penRate(pen, 1000, cuts)).toBeCloseTo(1000 * (5 * workerShare(1) + workerShare(4)), 6);
  });

  it('is saved and read back, cleaning bad data', () => {
    const t0 = 5_000_000;
    const pen = parsePen({ workers: { carrot: { level: 4, at: 1 }, 'BAD KEY': { level: 2 }, radish: { level: 99 } }, since: t0 }, t0 + H);
    expect(Object.keys(pen.workers).sort()).toEqual(['carrot', 'radish']);
    expect(pen.workers.carrot.level).toBe(4);
    expect(pen.workers.radish.level).toBe(20);
    expect(pen.since).toBe(t0);
    // a clock in the future is pulled back to now
    expect(parsePen({ workers: {}, since: t0 + 9 * H }, t0).since).toBe(t0);
  });

  it('puts the runaways of towns won before 0.14 to work when an older save loads', () => {
    const g = newGame();
    g.cities.ca_charlottetown = { won: true, stars: 2, bestDay: 0, crown: false, bestDays: 9, plays: 1, paid: 0 };
    g.cities.ca_gatineau = { won: true, stars: 1, bestDay: 0, crown: false, bestDays: 9, plays: 1, paid: 0 };
    const raw = JSON.parse(JSON.stringify(g));
    delete raw.pen;
    const back = parseGame(JSON.stringify(raw));
    expect(Object.keys(back.pen!.workers).sort()).toEqual([RUNAWAY.ca_charlottetown, RUNAWAY.ca_gatineau].sort());
    // and a save that has its Pen keeps it as it is
    back.pen!.workers.carrot.level = 7;
    expect(parseGame(JSON.stringify(back)).pen!.workers.carrot.level).toBe(7);
  });
});
