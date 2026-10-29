// Mounts the v3 shell: screens on top of the farm, plus the HUD template the shell clones into the stage.
import { A, S, HUD_HTML, SCREENS_HTML } from './v3markup';

export async function mountV3Shell(): Promise<void> {
  const w = window as unknown as Record<string, unknown>;
  w.__DBD_SPR = S;
  w.__DBD_PREVIEW = A.PREVIEW;
  const tpl = document.createElement('template');
  tpl.id = 'dbdHudTpl';
  tpl.innerHTML = HUD_HTML;
  document.body.append(tpl);
  document.body.insertAdjacentHTML('beforeend', SCREENS_HTML);
  await import('./v3ui.js');
}
