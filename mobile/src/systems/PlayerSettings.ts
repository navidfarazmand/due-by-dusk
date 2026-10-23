export interface PlayerSettings { touchOffset: number; reducedEffects: boolean; haptics: boolean; tutorialComplete: boolean }
export const SETTINGS_KEY = 'due-by-dusk-settings-v1';
const defaults: PlayerSettings = { touchOffset: 48, reducedEffects: false, haptics: false, tutorialComplete: false };
export function loadSettings(): PlayerSettings {
  try {
    const value = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return {
      touchOffset: typeof value.touchOffset === 'number' && Number.isFinite(value.touchOffset) ? Math.max(0, Math.min(100, value.touchOffset)) : 48,
      reducedEffects: value.reducedEffects === true,
      haptics: value.haptics === true,
      tutorialComplete: value.tutorialComplete === true,
    };
  } catch { return { ...defaults }; }
}
export function storeSettings(value: PlayerSettings): boolean {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(value)); return true; } catch { return false; }
}
