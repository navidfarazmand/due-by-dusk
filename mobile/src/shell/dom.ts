// Small DOM helpers and the shared sticker icons.

export function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error('missing #' + id);
  return el;
}

export function maybe(id: string): HTMLElement | null {
  return document.getElementById(id);
}

export function esc(t: unknown): string {
  return String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

export function money(v: number): string {
  const n = Math.round(Math.max(0, v));
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2).replace(/\.0+$/, '') + 'M';
  return '$' + n.toLocaleString('en-US');
}

export function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

export function cap(t: string): string {
  const s = String(t).toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const INK = '#2B1708';

export const ICON = {
  lock: (fill = '#5A3E2B', size = 16) =>
    `<svg width="${size}" height="${size + 1}" viewBox="0 0 12 13" aria-hidden="true"><rect x="1.5" y="5.5" width="9" height="6.5" rx="1.5" fill="${fill}"></rect><path d="M3.5 5.5V4a2.5 2.5 0 0 1 5 0v1.5" fill="none" stroke="${fill}" stroke-width="1.8"></path></svg>`,
  crown: (fill = '#FFC23D', w = 22) =>
    `<svg width="${w}" height="${Math.round((w * 18) / 22)}" viewBox="0 0 24 20" aria-hidden="true"><path d="M2 6 L7 11 L12 3 L17 11 L22 6 L20 17 L4 17 Z" fill="${fill}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"></path></svg>`,
  star: (on: boolean, size = 14) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 1.5l1.7 3.5 3.8.5-2.8 2.6.7 3.8L7 10.1 3.6 11.9l.7-3.8L1.5 5.5l3.8-.5z" fill="${on ? '#FFC23D' : '#FFFFFF'}" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"></path></svg>`,
  back: () =>
    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>`,
  next: () =>
    `<svg width="16" height="18" viewBox="0 0 16 18" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3l6 6-6 6"/></svg>`,
  coin: (size = 22) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="#FFC23D" stroke="${INK}" stroke-width="2.4"/><circle cx="12" cy="12" r="5.6" fill="none" stroke="#E3961C" stroke-width="2.2"/></svg>`,
  play: () =>
    `<svg width="14" height="16" viewBox="0 0 14 16" aria-hidden="true"><path d="M2 2 L12 8 L2 14 Z" fill="${INK}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/></svg>`,
  clock: (size = 14) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="6.5"/><path d="M8 4.5V8l2.5 1.6"/></svg>`,
  diamond: (size = 16) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 6 L6 2.5 H10 L13 6 L8 14 Z" fill="#7FD1F5" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/><path d="M3 6 H13 M6 2.5 L8 6 L10 2.5 M8 6 V14" stroke="${INK}" stroke-width="1.1" fill="none"/></svg>`,
  gear: () =>
    `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v2.6M12 18.9v2.6M4.6 4.6l1.9 1.9M17.5 17.5l1.9 1.9M2.5 12h2.6M18.9 12h2.6M4.6 19.4l1.9-1.9M17.5 6.5l1.9-1.9"/></svg>`,
  sound: () =>
    `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="${INK}"/><path class="w" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/><path class="x" d="M15.5 9.5l5 5M20.5 9.5l-5 5" style="display:none"/></svg>`,
};

export function stars(n: number, size = 14): string {
  return [0, 1, 2].map(i => ICON.star(i < n, size)).join('');
}
