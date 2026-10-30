// One scale for the sticker UI (--s) plus scaling of the 844×390 art layers (menu, maps).

import { clamp } from './dom';

export function layout(root: HTMLElement): void {
  const w = window.innerWidth,
    h = window.innerHeight;
  // follow the height, but never so big that the HUD's left, centre and right groups meet
  const s = clamp(Math.min(h / 390, (w / 2 - 10) / 375), 0.6, 1.7);
  document.documentElement.style.setProperty('--s', String(s));
  // fill the height on phones; on squarer screens crop at most ~4% a side and fill above/below with colour
  const k = Math.max(w / 844, Math.min(h / 390, w / (844 * 0.92)));
  root.querySelectorAll<HTMLElement>('.bg').forEach(bg => {
    bg.style.transform = `translate(-50%, -50%) scale(${k})`;
  });
  root.classList.toggle('lb', k * 390 < h - 2);
  // A centred card taller than its design box (a long line, large system fonts) grows its box so it stays centred,
  // and shrinks a little if it would not fit the screen. Navid saw the sundown card cut off at the bottom.
  root.querySelectorAll<HTMLElement>('.grp.mc').forEach(g => {
    const card = g.firstElementChild as HTMLElement | null;
    if (!card || !card.offsetHeight) return;
    if (!g.dataset.h) g.dataset.h = String(parseFloat(g.style.height) || 0);
    const need = Math.max(parseFloat(g.dataset.h) || 0, card.offsetHeight);
    if (Math.abs(need - (parseFloat(g.style.height) || 0)) > 0.5) g.style.height = need + 'px';
    const fit = Math.min(1, (h - 12) / Math.max(1, need * s));
    g.style.transform = fit < 0.999 ? `translate(-50%, -50%) scale(${(s * fit).toFixed(4)})` : '';
  });
}

export function watchLayout(root: HTMLElement): void {
  const run = () => layout(root);
  window.addEventListener('resize', run);
  window.addEventListener('orientationchange', () => setTimeout(run, 200));
  // cards are measured again once the display font has loaded
  try {
    void document.fonts.ready.then(run);
  } catch {
    /* no font loading API */
  }
  run();
}
