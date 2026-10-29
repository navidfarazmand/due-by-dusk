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
}

export function watchLayout(root: HTMLElement): void {
  const run = () => layout(root);
  window.addEventListener('resize', run);
  window.addEventListener('orientationchange', () => setTimeout(run, 200));
  run();
}
