import { describe, expect, it } from 'vitest';
import { LOGIN_DAYS, claimLogin, dayBefore, loginStatus, parseLogin } from '../src/game/login';
import { newGame, parseGame } from '../src/game/progress';

describe('the daily sign-in bonus (0.17)', () => {
  it('counts the days before, across months and years', () => {
    expect(dayBefore('2026-11-21')).toBe('2026-11-20');
    expect(dayBefore('2026-12-01')).toBe('2026-11-30');
    expect(dayBefore('2027-01-01')).toBe('2026-12-31');
    expect(dayBefore('2028-03-01')).toBe('2028-02-29');
  });

  it('pays day 1 first, one claim a day, a week that grows and then starts again', () => {
    let s = undefined as ReturnType<typeof claimLogin> | undefined;
    expect(loginStatus(s, '2026-11-21')).toEqual({ ready: true, day: 1 });
    s = claimLogin(s, '2026-11-21');
    expect(s).toEqual({ last: '2026-11-21', streak: 1, total: 1 });
    // once a day
    expect(loginStatus(s, '2026-11-21')).toEqual({ ready: false, day: 1 });
    expect(claimLogin(s, '2026-11-21')).toBe(s);
    // the next days, up to 7, then day 1 again
    const days = ['2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28'];
    const got: number[] = [];
    for (const d of days) {
      got.push(loginStatus(s, d).day);
      s = claimLogin(s, d);
    }
    expect(got).toEqual([2, 3, 4, 5, 6, 7, 1]);
    expect(s.total).toBe(8);
  });

  it('starts the week again after a missed day, and waits when the clock goes back', () => {
    const s = { last: '2026-11-21', streak: 4, total: 9 };
    expect(loginStatus(s, '2026-11-22')).toEqual({ ready: true, day: 5 });
    expect(loginStatus(s, '2026-11-23')).toEqual({ ready: true, day: 1 });
    expect(loginStatus(s, '2026-11-20')).toEqual({ ready: false, day: 4 });
  });

  it('grows day by day and pays the most on day 7', () => {
    expect(LOGIN_DAYS).toHaveLength(7);
    for (let i = 1; i < 7; i++) expect(LOGIN_DAYS[i]).toBeGreaterThan(LOGIN_DAYS[i - 1]);
    expect(LOGIN_DAYS[6]).toBe(Math.max(...LOGIN_DAYS));
  });

  it('keeps a valid state in the save and drops a broken one', () => {
    expect(parseLogin({ last: '2026-11-21', streak: 9, total: -3 })).toEqual({ last: '2026-11-21', streak: 7, total: 0 });
    expect(parseLogin({ last: 'yesterday', streak: 2 })).toBeUndefined();
    expect(parseLogin(null)).toBeUndefined();
    const g = newGame();
    g.login = { last: '2026-11-21', streak: 3, total: 3 };
    g.notif = { asked: true, on: true };
    g.totals.ads = 12;
    const back = parseGame(JSON.stringify(g));
    expect(back.login).toEqual({ last: '2026-11-21', streak: 3, total: 3 });
    expect(back.notif).toEqual({ asked: true, on: true });
    expect(back.totals.ads).toBe(12);
  });
});
