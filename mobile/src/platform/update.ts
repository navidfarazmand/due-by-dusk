// "A new version is ready" (v0.11.2, Navid 3 Nov): Google Play's in-app updates tell the game when Play has a newer
// version than the one installed, and can update it from inside the game. Only on Android, and only for the Play
// app (a test APK from GitHub never hears of Play updates). Browser tests fake an offer with window.__DBD_FAKE_UPDATE.

import { Capacitor } from '@capacitor/core';
import { AppUpdate, AppUpdateAvailability } from '@capawesome/capacitor-app-update';

export interface UpdateOffer {
  /** Play's versionCode of the new version (an empty string when Play doesn't say). */
  version: string;
  /** Play can update the game right here (a full-screen Google Play update). */
  immediate: boolean;
}

export async function checkForUpdate(): Promise<UpdateOffer | null> {
  const fake = (window as unknown as { __DBD_FAKE_UPDATE?: UpdateOffer }).__DBD_FAKE_UPDATE;
  if (fake) return fake;
  if (Capacitor.getPlatform() !== 'android') return null;
  try {
    const info = await AppUpdate.getAppUpdateInfo();
    if (info.updateAvailability !== AppUpdateAvailability.UPDATE_AVAILABLE) return null;
    return { version: info.availableVersionCode || '', immediate: !!info.immediateUpdateAllowed };
  } catch {
    return null; // no Play Store (or not installed from it): no offer
  }
}

/** Updates now: Google Play's own update screen when it allows one, otherwise the game's page on Play. */
export async function startUpdate(offer: UpdateOffer): Promise<void> {
  if ((window as unknown as { __DBD_FAKE_UPDATE?: UpdateOffer }).__DBD_FAKE_UPDATE) return;
  if (offer.immediate) {
    try {
      await AppUpdate.performImmediateUpdate();
      return;
    } catch {
      /* fall back to the store page */
    }
  }
  try {
    await AppUpdate.openAppStore();
  } catch {
    /* nothing more to do */
  }
}
