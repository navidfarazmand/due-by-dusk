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
import './shell/shell.css';
import { bootstrapPreferences, persistPreference } from './platform/nativeStorage';
import { initializeMobilePlatform, setHapticsEnabled } from './platform/mobile';
import { initializeAds, initPrivacyLinks } from './platform/ads';
import { startGeminiEngine } from './engine/gemini-engine.js';
import { installEventBridge, whenEngineReady, engine } from './shell/engine';
import { GameApp, bandRegistry } from './shell/app';
import * as progress from './game/progress';
import * as workshop from './game/workshop';
import * as tools from './game/tools';
import { ROUTE } from './game/world';

const { GAME_SAVE_KEY } = progress;

const STORAGE_KEYS = ['dbd-farm-v3', 'dbd-farm-v3-backup', GAME_SAVE_KEY];

async function start(): Promise<void> {
  try {
    await bootstrapPreferences(STORAGE_KEYS);
  } catch {
    /* the browser cache still works */
  }
  const w = window as unknown as Record<string, unknown>;
  const persist = (key: string, value: string) => {
    void persistPreference(key, value).catch(() => undefined);
  };
  // Every engine save is mirrored to native storage (the OS may clear the web cache).
  w.__dbdPersist = persist;
  // Gemini's own between-day card is replaced by the farmhouse screen.
  w.__odCard = () => '';
  // Claude's skyline bands, keyed the way the engine looks them up (band_<cityId>, band_<CC>).
  w.__DBD_BANDS = bandRegistry();
  installEventBridge();
  if (import.meta.env.DEV || import.meta.env.MODE === 'e2e') w.__DBD_DEV_HOOKS = true;
  const app = new GameApp(persist);
  startGeminiEngine();
  await whenEngineReady();
  app.start();
  setHapticsEnabled(app.hapticsOn());
  window.addEventListener('dbd:privacy-links', () => initPrivacyLinks());
  window.addEventListener('dbd:haptics', e => setHapticsEnabled(!!(e as CustomEvent).detail));
  await initializeMobilePlatform({
    onPause: () => {
      try {
        if (engine().state().mode === 'day') engine().setPaused(true);
      } catch {
        /* engine not ready */
      }
    },
    onError: () => {
      /* an unsupported device capability must not block the game */
    },
  });
  setTimeout(() => void initializeAds(), 1200);
  if (import.meta.env.DEV || import.meta.env.MODE === 'e2e') {
    // hooks for the browser tests and the balance simulation
    w.__DBD_APP = app;
    w.__DBD_PROGRESS = progress;
    w.__DBD_WORKSHOP = workshop;
    w.__DBD_TOOLS = tools;
    w.__DBD_ROUTE_IDS = ROUTE.map(c => c.id);
  }
}

start().catch(error => {
  console.error(error);
  const message = document.createElement('p');
  message.setAttribute('role', 'alert');
  message.style.cssText = 'position:fixed;inset:20%;z-index:500;padding:24px;background:#fff3cd;color:#402b0a';
  message.textContent = 'The farm could not start. Please reopen the game. Your saved progress has not been reset.';
  document.body.append(message);
});
