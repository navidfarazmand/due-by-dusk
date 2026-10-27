import { App } from '@capacitor/app';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { AdMob, AdmobConsentStatus, RewardAdPluginEvents } from '@capacitor-community/admob';

/**
 * Optional rewarded ads through Google AdMob (Android only for now).
 *
 * - Google's consent message (EEA, UK, Switzerland) is requested at every launch, before any ad request.
 * - Builds show Google's demo ads unless they are the Play app (com.khoreh.duebydusk) AND were built
 *   with VITE_ADMOB_PRODUCTION=true. Debug, test and closed-test builds therefore never request real ads.
 * - The game only offers a reward while an ad is already loaded, and grants it only after AdMob reports
 *   the reward. Closing the ad early never grants anything.
 */
export const PRIVACY_POLICY_URL = 'https://khoreh.com/due-by-dusk/privacy.html';
export const ADS_CHANGED_EVENT = 'dbd:ads-changed';

const PLAY_APP_ID = 'com.khoreh.duebydusk';
const REWARDED_PRODUCTION = 'ca-app-pub-2635409921068961/7140370750';
/** Google's Android demo rewarded unit: always returns a labelled test ad. */
const REWARDED_DEMO = 'ca-app-pub-3940256099942544/5224354917';
const RETRY_DELAYS_MS = [30_000, 60_000, 120_000, 300_000];

let started = false;
let adsReady = false;
let demoAds = true;
let rewardedLoaded = false;
let rewardedLoading = false;
let showing = false;
let privacyOptionsRequired = false;
let retryIndex = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;

function announce(): void {
  window.dispatchEvent(new Event(ADS_CHANGED_EVENT));
}

function supported(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

/** Call once after the game is on screen. Safe to call in the browser, where it does nothing. */
export async function initializeAds(): Promise<void> {
  if (started || !supported()) return;
  started = true;
  try {
    const info = await App.getInfo();
    demoAds = !(info.id === PLAY_APP_ID && import.meta.env.VITE_ADMOB_PRODUCTION === 'true');

    let consent = await AdMob.requestConsentInfo();
    if (consent.isConsentFormAvailable && consent.status === AdmobConsentStatus.REQUIRED) {
      consent = await AdMob.showConsentForm();
    }
    // The plugin does not export this enum; its value is the string 'REQUIRED'.
    privacyOptionsRequired = String(consent.privacyOptionsRequirementStatus) === 'REQUIRED';
    announce();
    if (!consent.canRequestAds) return;

    await AdMob.initialize({ initializeForTesting: demoAds });
    adsReady = true;
    void loadRewarded();
  } catch (error) {
    // Ads are optional. A missing network, form or SDK must never block the farm.
    console.warn('[ads] AdMob could not start', error);
  }
}

async function loadRewarded(): Promise<void> {
  if (!adsReady || rewardedLoaded || rewardedLoading || showing) return;
  rewardedLoading = true;
  try {
    await AdMob.prepareRewardVideoAd({
      adId: demoAds ? REWARDED_DEMO : REWARDED_PRODUCTION,
      isTesting: demoAds,
      immersiveMode: true,
    });
    rewardedLoaded = true;
    retryIndex = 0;
  } catch (error) {
    console.warn('[ads] No rewarded ad available yet', error);
    const delay = RETRY_DELAYS_MS[Math.min(retryIndex, RETRY_DELAYS_MS.length - 1)];
    retryIndex += 1;
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => void loadRewarded(), delay);
  } finally {
    rewardedLoading = false;
    announce();
  }
}

/** True when a rewarded ad is loaded and can be shown right now. */
export function rewardedAdReady(): boolean {
  return adsReady && rewardedLoaded && !showing;
}

/**
 * Shows the loaded rewarded ad. Resolves true only if AdMob reported the reward,
 * false if the player closed it early or it could not be shown.
 */
export function showRewardedAd(): Promise<boolean> {
  if (!rewardedAdReady()) return Promise.resolve(false);
  showing = true;
  rewardedLoaded = false;
  announce();
  return new Promise<boolean>(resolve => {
    let earned = false;
    let finished = false;
    let handles: PluginListenerHandle[] = [];
    const finish = (rewarded: boolean) => {
      if (finished) return;
      finished = true;
      for (const handle of handles) void handle.remove();
      showing = false;
      resolve(rewarded);
      void loadRewarded();
    };
    Promise.all([
      // The reward arrives before the ad closes; the short wait covers a late callback.
      AdMob.addListener(RewardAdPluginEvents.Dismissed, () => setTimeout(() => finish(earned), 400)),
      AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => finish(false)),
    ]).then(listeners => {
      handles = listeners;
      if (finished) { for (const handle of listeners) void handle.remove(); return; }
      // This promise settles only when the reward is earned; closing early leaves it pending.
      AdMob.showRewardVideoAd().then(() => { earned = true; }, () => finish(false));
    }, () => finish(false));
  });
}

/** True when the player's region needs a way to change their consent choice (EEA, UK, Switzerland). */
export function privacyChoicesAvailable(): boolean {
  return supported() && privacyOptionsRequired;
}

export async function openPrivacyChoices(): Promise<void> {
  if (!privacyChoicesAvailable()) return;
  try {
    await AdMob.showPrivacyOptionsForm();
  } catch (error) {
    console.warn('[ads] Privacy choices could not open', error);
  }
}

/** Privacy policy link in Management, plus the consent-choices button where Google requires one. */
export function initPrivacyLinks(): void {
  const policy = document.querySelector<HTMLAnchorElement>('#linkPrivacyPolicy');
  // Capacitor opens external links in the system browser; in a web browser keep the game tab open.
  if (policy && !Capacitor.isNativePlatform()) { policy.target = '_blank'; policy.rel = 'noopener'; }
  const choices = document.querySelector<HTMLButtonElement>('#btnPrivacyChoices');
  if (!choices) return;
  const sync = () => { choices.hidden = !privacyChoicesAvailable(); };
  choices.addEventListener('click', () => void openPrivacyChoices());
  window.addEventListener(ADS_CHANGED_EVENT, sync);
  sync();
}
