import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

// Keep writes ordered: an older asynchronous write must never replace a new one.
let pending: Promise<void> = Promise.resolve();
export interface NativeSaveStatus { state: 'saved' | 'warning'; message: string }
let nativeSaveStatus: NativeSaveStatus | null = null;

export function getNativeSaveStatus(): NativeSaveStatus | null {
  return nativeSaveStatus;
}

function reportPrimarySave(state: NativeSaveStatus['state']): void {
  nativeSaveStatus = {
    state,
    message: state === 'warning'
      ? 'Device backup failed. Export a save copy from Management until storage is available.'
      : '',
  };
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('dbd:native-save-status', { detail: nativeSaveStatus }));
  }
}

/** Restore cache entries cleared by the OS before a scene loads them. */
export async function bootstrapPreferences(keys: readonly string[]): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  for (const key of keys) {
    const { value } = await Preferences.get({ key });
    // Cache writes precede native mirroring, so an existing cache may be newer
    // after a bridge failure. Leave validation/recovery of existing data to SaveSystem.
    if (value !== null && localStorage.getItem(key) === null) {
      localStorage.setItem(key, value);
    }
  }
}

/** Mirror an already verified SaveSystem write to durable native preferences. */
export function persistPreference(key: string, value: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve();
  const operation = pending.then(async () => {
    try {
      await Preferences.set({ key, value });
      const stored = await Preferences.get({ key });
      if (stored.value !== value) throw new Error('Native save verification failed');
      if (key === 'due-by-dusk-v2') reportPrimarySave('saved');
    } catch (error) {
      if (key === 'due-by-dusk-v2') reportPrimarySave('warning');
      throw error;
    }
  });
  // Continue accepting later saves after a failed operation; callers still receive its rejection.
  pending = operation.catch(() => undefined);
  return operation;
}

/** Wait for saves already queued, for example when showing save status to the player. */
export function flushPreferences(): Promise<void> {
  return pending;
}
