import Phaser from 'phaser';
import '@fontsource/figtree/latin-400.css';
import '@fontsource/figtree/latin-600.css';
import '@fontsource/courier-prime/latin-400.css';
import '@fontsource/courier-prime/latin-700.css';
import '@fontsource/big-shoulders-stencil/latin-800.css';
import { SaveSystem, SAVE_STORAGE_KEYS } from './systems/SaveSystem';
import { SETTINGS_KEY, loadSettings } from './systems/PlayerSettings';
import { bootstrapPreferences, persistPreference } from './platform/nativeStorage';
import { initializeMobilePlatform } from './platform/mobile';
import { initManagementUI } from './ui/management';
import { initializeSaveStatus } from './ui/saveStatus';

async function start() {
  let nativeWarning = '';
  try { await bootstrapPreferences([...SAVE_STORAGE_KEYS, SETTINGS_KEY]); }
  catch { nativeWarning = 'Device backup could not be loaded. Keep a save export until storage is available.'; }
  SaveSystem.subscribePersisted(({key,value}) => {
    void persistPreference(key,value).catch(() => {
      window.dispatchEvent(new CustomEvent('dbd:storage-warning', {detail:'Device backup failed. Your browser save is still available; export a copy from Management.'}));
    });
  });
  const management = initManagementUI();
  window.addEventListener('dbd:close-management', () => management.close());
  await initializeMobilePlatform({
    onPause: () => window.dispatchEvent(new Event('dbd:pause')),
    onBackButton: () => {
      if (!document.querySelector<HTMLElement>('#modal')!.hidden) {
        window.dispatchEvent(new Event('dbd:back', {cancelable:true})); return true;
      }
      if (management.isOpen()) { management.close(); return true; }
      const event = new Event('dbd:back', {cancelable:true});
      window.dispatchEvent(event); return event.defaultPrevented;
    },
    onError: () => { /* An unsupported device capability must not block the game. */ },
  });
  const settings=loadSettings();
  const offset=document.querySelector<HTMLInputElement>('#settingTouchOffset')!;
  const effects=document.querySelector<HTMLSelectElement>('#settingEffects')!;
  const haptics=document.querySelector<HTMLInputElement>('#settingHaptics')!;
  offset.value=String(settings.touchOffset); effects.value=settings.reducedEffects?'reduced':'full'; haptics.checked=settings.haptics;
  const wireSettings=() => {
    const value={touchOffset:Number(offset.value),reducedEffects:effects.value==='reduced',haptics:haptics.checked};
    window.dispatchEvent(new CustomEvent('dbd:settings', {detail:value}));
    try { const raw=localStorage.getItem(SETTINGS_KEY); if(raw) void persistPreference(SETTINGS_KEY,raw).catch(()=>undefined); } catch { /* The settings handler already shows a storage warning. */ }
  };
  offset.addEventListener('input',wireSettings); effects.addEventListener('change',wireSettings); haptics.addEventListener('change',wireSettings);
  const [{BootScene},{PreloadScene},{FarmScene}] = await Promise.all([import('./scenes/BootScene'),import('./scenes/PreloadScene'),import('./scenes/FarmScene')]);
  // Phaser owns timing and atlas animation. The procedural renderer owns #field.
  // A separate hidden engine canvas prevents Phaser from clearing the visible artwork.
  const engine=document.createElement('div'); engine.hidden=true; document.body.append(engine);
  const game = new Phaser.Game({type:Phaser.CANVAS,parent:engine,width:1,height:1,transparent:true,audio:{noAudio:true},scene:[BootScene,PreloadScene,FarmScene],fps:{target:60}});
  initializeSaveStatus();
  if(nativeWarning) window.dispatchEvent(new CustomEvent('dbd:storage-warning',{detail:nativeWarning}));
  if(import.meta.env.DEV || import.meta.env.MODE==='e2e') (window as any).__PHASER_GAME=game;
}
start().catch(error => {
  console.error(error);
  const message=document.createElement('p');
  message.setAttribute('role','alert');
  message.style.cssText='position:fixed;inset:20%;z-index:500;padding:24px;background:#fff3cd;color:#402b0a';
  message.textContent='The farm could not start. Please reopen the game. Your saved progress has not been reset.';
  document.body.append(message);
});
