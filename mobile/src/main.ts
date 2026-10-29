import '@fontsource/figtree/latin-400.css';
import '@fontsource/figtree/latin-600.css';
import '@fontsource/courier-prime/latin-400.css';
import '@fontsource/courier-prime/latin-700.css';
import '@fontsource/big-shoulders-stencil/latin-800.css';
import '@fontsource/lilita-one/latin-400.css';
import '@fontsource/nunito/latin-800.css';
import '@fontsource/nunito/latin-900.css';
import './engine/gemini.css';
import './shell/ui.css';
import bandAvignon from './art/bands/fr_avignon.webp';
import { bootstrapPreferences, persistPreference } from './platform/nativeStorage';
import { initializeMobilePlatform } from './platform/mobile';
import { initializeAds } from './platform/ads';
import { startGeminiEngine } from './engine/gemini-engine.js';
import { mountV3Shell } from './shell/v3shell';

const STORAGE_KEYS = ['dbd-farm-v3', 'dbd-farm-v3-backup', 'dbd-oneday-best', 'dbd-oneday-crown', 'dbd-oneday-setup'];

async function start(): Promise<void> {
  try { await bootstrapPreferences(STORAGE_KEYS); } catch { /* the browser cache still works */ }
  const w = window as unknown as Record<string, unknown>;
  // Every engine save is mirrored to native storage (localStorage can be cleared by the OS).
  w.__dbdPersist = (key: string, value: string) => { void persistPreference(key, value).catch(() => undefined); };
  // Claude's skyline bands, keyed the way the engine looks them up (env_<country>_fg).
  w.__DBD_BANDS = { env_FR_fg: { url: bandAvignon } };
  await mountV3Shell();
  startGeminiEngine();
  await initializeMobilePlatform({
    onPause: () => { const b = document.getElementById('btnPause'); if (b && !b.hidden && b.getAttribute('aria-pressed') !== 'true') b.click(); },
    onError: () => { /* an unsupported device capability must not block the game */ },
  });
  setTimeout(() => { void initializeAds(); }, 1200);
}

start().catch(error => {
  console.error(error);
  const message = document.createElement('p');
  message.setAttribute('role', 'alert');
  message.style.cssText = 'position:fixed;inset:20%;z-index:500;padding:24px;background:#fff3cd;color:#402b0a';
  message.textContent = 'The farm could not start. Please reopen the game. Your saved progress has not been reset.';
  document.body.append(message);
});
