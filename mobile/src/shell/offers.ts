// Optional rewarded ads. Never forced: every offer is a button the player can ignore.
// Only offered while an ad is actually loaded; the reward is granted only when AdMob reports it.
// Browser builds can simulate ads with ?testads=1 (a labelled 1.5 s pause stands in for the ad).

import { rewardedAdReady, showRewardedAd, ADS_CHANGED_EVENT } from '../platform/ads';
import { todayKey, type GameSave } from '../game/progress';

export type OfferKind = 'double' | 'coins' | 'finish' | 'extraDay';

/** Daily caps, so ads stay a bonus and never become the game. */
export const CAPS: Record<OfferKind, number> = { double: 12, coins: 6, finish: 8, extraDay: 99 };
/** Minutes between two free-coin ads. */
export const COINS_COOLDOWN_MIN = 20;

const testAds = (() => {
  try {
    return new URLSearchParams(location.search).has('testads') || (import.meta.env.DEV && localStorage.getItem('dbd-testads') === '1');
  } catch {
    return false;
  }
})();

export function adsAvailable(): boolean {
  return testAds || rewardedAdReady();
}

export function onAdsChanged(fn: () => void): void {
  window.addEventListener(ADS_CHANGED_EVENT, fn);
}

function counters(g: GameSave): GameSave['ads'] {
  const d = todayKey();
  if (g.ads.date !== d) g.ads = { date: d, coins: 0, doubles: 0, finishes: 0, lastCoinsAt: g.ads.lastCoinsAt || 0 };
  return g.ads;
}

export function canOffer(g: GameSave, kind: OfferKind, now = Date.now()): boolean {
  if (!adsAvailable()) return false;
  const c = counters(g);
  if (kind === 'double') return c.doubles < CAPS.double;
  if (kind === 'finish') return c.finishes < CAPS.finish;
  if (kind === 'coins') return c.coins < CAPS.coins && now - c.lastCoinsAt >= COINS_COOLDOWN_MIN * 60_000;
  return true;
}

/** Minutes until the next free-coin ad (0 when available). */
export function coinsWait(g: GameSave, now = Date.now()): number {
  const c = counters(g);
  if (c.coins >= CAPS.coins) return Infinity;
  return Math.max(0, Math.ceil((c.lastCoinsAt + COINS_COOLDOWN_MIN * 60_000 - now) / 60_000));
}

function fakeAd(): Promise<boolean> {
  return new Promise(resolve => {
    const veil = document.createElement('div');
    veil.className = 'test-ad';
    veil.innerHTML = '<div><b>Test ad</b><span>A real phone shows a short video here.</span></div>';
    document.body.append(veil);
    setTimeout(() => {
      veil.remove();
      resolve(true);
    }, 1500);
  });
}

/** Shows the ad; resolves true only when the reward was earned. Counts it against today's cap. */
export async function watch(g: GameSave, kind: OfferKind): Promise<boolean> {
  if (!canOffer(g, kind)) return false;
  const ok = testAds ? await fakeAd() : await showRewardedAd();
  if (!ok) return false;
  const c = counters(g);
  if (kind === 'double') c.doubles++;
  else if (kind === 'finish') c.finishes++;
  else if (kind === 'coins') {
    c.coins++;
    c.lastCoinsAt = Date.now();
  }
  return true;
}
