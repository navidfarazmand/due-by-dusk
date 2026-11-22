// The daily sign-in bonus (0.17; Navid, 21 Nov: "also can you add a daily sign in bonus?"). One claim a calendar day;
// seven days in a row pay more each day and the seventh pays the most; a missed day starts the week again. The reward
// is a share of an average day in the player's town (app.ts, loginReward), so it keeps its worth along the road.

/** A calendar day as YYYY-MM-DD (the same key as progress.ts's todayKey; kept here so the two modules don't import each
 *  other). */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface LoginState {
  /** The day of the last claim (todayKey: YYYY-MM-DD, the phone's own calendar). */
  last: string;
  /** Which day of the week was claimed then (1 to 7). */
  streak: number;
  /** Claims in all. */
  total: number;
}

/** Each day's reward, in average days of the player's town. */
export const LOGIN_DAYS = [0.3, 0.4, 0.5, 0.6, 0.8, 1, 2];

/** The calendar day before `key`. */
export function dayBefore(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() - 1);
  return dayKey(dt);
}

/** Whether today's bonus can be claimed, and which day of the week it is (the one claimed today, once it is). */
export function loginStatus(s: LoginState | undefined, today: string): { ready: boolean; day: number } {
  if (!s || !s.last) return { ready: true, day: 1 };
  if (s.last === today) return { ready: false, day: Math.max(1, Math.min(7, s.streak)) };
  // (a clock set back to before the last claim waits for that day to come round again)
  if (s.last > today) return { ready: false, day: Math.max(1, Math.min(7, s.streak)) };
  if (s.last === dayBefore(today)) return { ready: true, day: (Math.max(1, Math.min(7, s.streak)) % 7) + 1 };
  return { ready: true, day: 1 };
}

/** The state after today's claim (unchanged when there is nothing to claim). */
export function claimLogin(s: LoginState | undefined, today: string): LoginState {
  const st = loginStatus(s, today);
  if (!st.ready && s) return s;
  return { last: today, streak: st.day, total: (s?.total || 0) + 1 };
}

/** Untrusted saved data: a valid state or nothing. */
export function parseLogin(o: unknown): LoginState | undefined {
  if (!o || typeof o !== 'object') return undefined;
  const v = o as Record<string, unknown>;
  if (typeof v.last !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.last)) return undefined;
  const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? Math.floor(x) : 0);
  return { last: v.last, streak: Math.max(1, Math.min(7, n(v.streak) || 1)), total: Math.max(0, n(v.total)) };
}
