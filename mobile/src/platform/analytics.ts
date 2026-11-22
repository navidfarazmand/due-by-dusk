import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { ConsentStatus, ConsentType, FirebaseAnalytics } from '@capacitor-firebase/analytics';

/**
 * Google Analytics for Firebase (0.17; Navid, 21 Nov: "please proceed with the firebase analytics. and add as much as
 * analytics as possible. my most things i want to know is how much a user watch an ad, when and after how many it exits
 * the game").
 *
 * - On the phone every event goes to Firebase (the project's google-services.json is written by the build); in a browser
 *   nothing leaves the page, and the events are kept in window.__DBD_EVENTS for the tests.
 * - Each event carries where the player is: the screen, the town and its day (context()).
 * - Ads: ad_tap (an offer pressed), ad_watched (watched to the end; Analytics keeps the name ad_reward for itself),
 *   ad_closed (shown, closed early), ad_none (pressed with no ad loaded); each with the placement and the count this
 *   session, today and in all.
 * - Leaving: app_pause when the game goes to the background (seconds played this session, ads watched this session, the
 *   screen and the town), app_resume with the time away. A session ends after 30 minutes away, as Analytics' own does.
 * - Analytics never blocks or slows the game: every call is fire-and-forget.
 */

export type Params = Record<string, string | number | boolean | null | undefined>;
export interface AnalyticsContext {
  screen?: string;
  town?: string;
  day?: number;
}

const native = Capacitor.isNativePlatform();
const SESSION_GAP_MS = 30 * 60_000;
const LOG_MAX = 400;

let ctx: () => AnalyticsContext = () => ({});
let started = false;
let sessionAt = Date.now();
let fgAt = Date.now();
let playedMs = 0;
let pausedAt = 0;
let adsSession = 0;
let adsDay = { key: '', n: 0 };
let adsAll = 0;
let lastScreen = '';

function events(): Array<{ name: string; params: Record<string, string | number> }> {
  const w = window as unknown as { __DBD_EVENTS?: Array<{ name: string; params: Record<string, string | number> }> };
  return (w.__DBD_EVENTS ||= []);
}

function clean(params: Params): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const key = k.slice(0, 40);
    if (typeof v === 'boolean') out[key] = v ? 1 : 0;
    else if (typeof v === 'number') {
      if (Number.isFinite(v)) out[key] = Math.round(v * 100) / 100;
    } else out[key] = String(v).slice(0, 100);
  }
  return out;
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Seconds played in this session (time in the foreground). */
function sessionSec(now = Date.now()): number {
  return Math.round((playedMs + (pausedAt ? 0 : now - fgAt)) / 1000);
}

/** Where the player is, for every event. Set once by the shell. */
export function setContext(fn: () => AnalyticsContext): void {
  ctx = fn;
}

/** Logs one event (names: lowercase, digits and _, at most 40 characters; Analytics keeps up to 25 parameters). */
export function track(name: string, params: Params = {}): void {
  let c: AnalyticsContext = {};
  try {
    c = ctx() || {};
  } catch {
    /* the shell is not ready */
  }
  const p = clean({ screen: c.screen, town: c.town, day: c.day, ...params });
  const log = events();
  log.push({ name, params: p });
  if (log.length > LOG_MAX) log.splice(0, log.length - LOG_MAX);
  if (!native) return;
  void FirebaseAnalytics.logEvent({ name, params: p }).catch(() => undefined);
}

/** The screen the player is on (Analytics' screen_view; also the "last screen" of app_pause). */
export function screen(name: string): void {
  if (!name || name === lastScreen) return;
  lastScreen = name;
  const log = events();
  log.push({ name: 'screen', params: { screen: name } });
  if (log.length > LOG_MAX) log.splice(0, log.length - LOG_MAX);
  if (!native) return;
  void FirebaseAnalytics.setCurrentScreen({ screenName: name, screenClassOverride: 'DueByDusk' }).catch(() => undefined);
}

/** A user property (at most 24 characters in the name and 36 in the value). */
export function userProp(key: string, value: string | number): void {
  const v = String(value).slice(0, 36);
  const w = window as unknown as { __DBD_USERPROPS?: Record<string, string> };
  (w.__DBD_USERPROPS ||= {})[key] = v;
  if (!native) return;
  void FirebaseAnalytics.setUserProperty({ key: key.slice(0, 24), value: v }).catch(() => undefined);
}

function adsBand(n: number): string {
  return n === 0 ? '0' : n < 5 ? '1-4' : n < 20 ? '5-19' : n < 50 ? '20-49' : n < 200 ? '50-199' : '200+';
}

/** The ads this player has watched in all (from the save), so the counts carry on across launches. */
export function setAdsWatched(total: number): void {
  adsAll = Math.max(adsAll, Math.floor(total) || 0);
  userProp('ads_band', adsBand(adsAll));
}

/** One rewarded-ad offer: pressed, watched to the end, closed early, or pressed with no ad ready. */
export function adEvent(kind: 'tap' | 'reward' | 'closed' | 'none', placement: string, extra: Params = {}): void {
  if (kind === 'reward') {
    const key = today();
    if (adsDay.key !== key) adsDay = { key, n: 0 };
    adsDay.n++;
    adsSession++;
    adsAll++;
    userProp('ads_band', adsBand(adsAll));
  }
  const name = kind === 'tap' ? 'ad_tap' : kind === 'reward' ? 'ad_watched' : kind === 'closed' ? 'ad_closed' : 'ad_none';
  track(name, {
    placement,
    ads_session: adsSession,
    ads_today: adsDay.key === today() ? adsDay.n : 0,
    ads_total: adsAll,
    session_min: Math.round(sessionSec() / 6) / 10,
    ...extra,
  });
}

/** Turns collection on and sets the consent signals: Analytics everywhere; ad storage, ad user data and ad
 *  personalization only where Google's consent message is not required (outside the EEA, the UK and Switzerland). */
export function startAnalytics(o: { consentRequired: boolean }): void {
  if (!native) return;
  const ads = o.consentRequired ? ConsentStatus.Denied : ConsentStatus.Granted;
  void (async () => {
    try {
      await FirebaseAnalytics.setConsent({ type: ConsentType.AnalyticsStorage, status: ConsentStatus.Granted });
      await FirebaseAnalytics.setConsent({ type: ConsentType.AdStorage, status: ads });
      await FirebaseAnalytics.setConsent({ type: ConsentType.AdUserData, status: ads });
      await FirebaseAnalytics.setConsent({ type: ConsentType.AdPersonalization, status: ads });
      await FirebaseAnalytics.setEnabled({ enabled: true });
    } catch {
      /* Analytics is optional */
    }
  })();
}

/** Follows the game going to the background and coming back (app_pause, app_resume). Call once. */
export function watchSessions(info: () => Params): void {
  if (started) return;
  started = true;
  sessionAt = fgAt = Date.now();
  const pause = () => {
    if (pausedAt) return;
    const now = Date.now();
    playedMs += now - fgAt;
    pausedAt = now;
    let extra: Params = {};
    try {
      extra = info();
    } catch {
      /* the shell is not ready */
    }
    track('app_pause', { session_sec: Math.round(playedMs / 1000), ads_session: adsSession, ads_total: adsAll, last_screen: lastScreen, ...extra });
  };
  const resume = () => {
    if (!pausedAt) return;
    const now = Date.now();
    const away = now - pausedAt;
    pausedAt = 0;
    fgAt = now;
    if (away >= SESSION_GAP_MS) {
      // a new session, as Analytics counts them
      sessionAt = now;
      playedMs = 0;
      adsSession = 0;
    }
    track('app_resume', { away_min: Math.round(away / 6000) / 10, new_session: away >= SESSION_GAP_MS });
  };
  if (native) {
    void App.addListener('appStateChange', s => (s.isActive ? resume() : pause())).catch(() => undefined);
  } else {
    document.addEventListener('visibilitychange', () => (document.hidden ? pause() : resume()));
  }
}

/** For the tests: this session's numbers. */
export function sessionInfo(): { sessionSec: number; adsSession: number; adsAll: number; startedAt: number } {
  return { sessionSec: sessionSec(), adsSession, adsAll, startedAt: sessionAt };
}
