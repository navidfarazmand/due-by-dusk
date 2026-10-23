import { App } from '@capacitor/app';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { ScreenOrientation } from '@capacitor/screen-orientation';

export interface MobilePlatformOptions {
  onPause?: () => void;
  onResume?: () => void;
  /** Return true if a drawer/dialog was closed; otherwise Android minimizes safely. */
  onBackButton?: () => boolean;
  onError?: (message: string, error: unknown) => void;
}

let hapticsEnabled = false;
let lastHaptic = 0;

export function setHapticsEnabled(enabled: boolean): void {
  hapticsEnabled = enabled;
}

/** Opt-in feedback, throttled so harvesting a cluster cannot flood the bridge. */
export async function hapticImpact(strength: 'light' | 'medium' = 'light'): Promise<void> {
  if (!hapticsEnabled || !Capacitor.isNativePlatform()) return;
  const now = performance.now();
  if (now - lastHaptic < 80) return;
  lastHaptic = now;
  try {
    await Haptics.impact({ style: strength === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light });
  } catch {
    // Devices without a vibration motor still play normally.
  }
}

/** Landscape-first shell. Call once at startup; invoke returned cleanup on disposal. */
export async function initializeMobilePlatform(options: MobilePlatformOptions = {}): Promise<() => void> {
  const listeners: PluginListenerHandle[] = [];
  let inactive = false;
  const setActive = (active: boolean) => {
    if (inactive === !active) return;
    inactive = !active;
    if (active) options.onResume?.();
    else options.onPause?.();
  };
  const visibility = () => setActive(!document.hidden);
  document.addEventListener('visibilitychange', visibility);

  if (Capacitor.isNativePlatform()) {
    document.documentElement.dataset.native = Capacitor.getPlatform();
    try {
      await ScreenOrientation.lock({ orientation: 'landscape' });
    } catch (error) {
      options.onError?.('This device could not lock landscape orientation.', error);
    }
    try {
      listeners.push(await App.addListener('appStateChange', ({ isActive }) => setActive(isActive)));
      if (options.onBackButton) {
        listeners.push(await App.addListener('backButton', () => {
          if (!options.onBackButton?.()) {
            options.onPause?.();
            void App.minimizeApp().catch(error => options.onError?.('Could not minimize the game.', error));
          }
        }));
      }
      const state = await App.getState();
      setActive(state.isActive);
    } catch (error) {
      // Browser visibility and pagehide saving remain available when a native
      // lifecycle capability is unavailable. A plugin error must not brick startup.
      options.onError?.('Native app lifecycle is unavailable.', error);
    }
  }

  return () => {
    document.removeEventListener('visibilitychange', visibility);
    for (const listener of listeners) void listener.remove();
  };
}
