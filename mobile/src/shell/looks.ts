// Drawings for the Bling Barn (each item drawn in its own colours, so the card shows what you get) and the
// skill map glyphs. All inline SVG in the game's sticker style: ink outlines, flat fills.

import type { FlairItem } from '../game/flair';
import { INK } from './dom';

function hex(c: string): [number, number, number] {
  const m = c.replace('#', '');
  const v = m.length === 3 ? m.split('').map(x => x + x).join('') : m;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

/** Mixes two colours: t = 0 gives a, 1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const x = hex(a), y = hex(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

let gradN = 0;
function rainbowGrad(id: string, x2 = '1', y2 = '0'): string {
  return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="#FF6B6B"/><stop offset=".33" stop-color="#FFD93D"/><stop offset=".66" stop-color="#6BCB77"/><stop offset="1" stop-color="#4D96FF"/></linearGradient></defs>`;
}

/** The county-fair ribbon (the Bling Barn's money). */
export function ribbonIcon(size = 20): string {
  const petals = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2;
    return `<circle cx="${(12 + Math.cos(a) * 6.4).toFixed(2)}" cy="${(9.5 + Math.sin(a) * 6.4).toFixed(2)}" r="2.6" fill="#4D96FF" stroke="${INK}" stroke-width="1.4"/>`;
  }).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8.5 13 L6 22.5 L9.4 21 L11.2 23.4 L12.4 15 Z" fill="#E5484D" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M15.5 13 L18 22.5 L14.6 21 L12.8 23.4 L11.6 15 Z" fill="#E5484D" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>
    ${petals}<circle cx="12" cy="9.5" r="5.2" fill="#4D96FF" stroke="${INK}" stroke-width="1.6"/><circle cx="12" cy="9.5" r="2.9" fill="#FFC23D" stroke="${INK}" stroke-width="1.4"/></svg>`;
}

function finishIcon(it: FlairItem, w: number, h: number): string {
  const L = it.look;
  const g = `fg${++gradN}`;
  const metal = L.rainbow ? `url(#${g})` : L.metal ? L.metal[1] : '#E4ECF2';
  const shine = L.metal ? L.metal[0] : '#FFFFFF';
  const wood = L.wood ? L.wood[1] : '#B9824B';
  const trim = L.trim || '#8C8796';
  return `<svg width="${w}" height="${h}" viewBox="0 0 120 120" aria-hidden="true">${L.rainbow ? rainbowGrad(g, '1', '1') : ''}
    <path d="M30 112 L82 26" stroke="${INK}" stroke-width="14" stroke-linecap="round"/><path d="M30 112 L82 26" stroke="${wood}" stroke-width="7.5" stroke-linecap="round"/>
    <path d="M80 28 Q66 6 38 6 Q16 6 4 22 Q24 16 44 19 Q64 23 74 40 Z" fill="${metal}" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/>
    <path d="M12 19 Q28 13 46 15" fill="none" stroke="${shine}" stroke-width="3" stroke-linecap="round"/>
    <circle cx="80" cy="30" r="6.5" fill="${trim}" stroke="${INK}" stroke-width="4"/></svg>`;
}

function trailIcon(it: FlairItem, w: number, h: number): string {
  const g = `tg${++gradN}`;
  const rainbow = it.look.trail === 'rainbow';
  const outer = rainbow ? `url(#${g})` : it.swatch[0], inner = rainbow ? '#FFFFFF' : it.swatch[1];
  return `<svg width="${w}" height="${h}" viewBox="0 0 140 90" aria-hidden="true">${rainbow ? rainbowGrad(g) : ''}
    <path d="M10 76 Q62 10 132 32" fill="none" stroke="${INK}" stroke-width="19" stroke-linecap="round" opacity=".18"/>
    <path d="M10 72 Q62 6 132 28" fill="none" stroke="${outer}" stroke-width="14" stroke-linecap="round"/>
    <path d="M14 66 Q62 2 128 22" fill="none" stroke="${inner}" stroke-width="6" stroke-linecap="round" opacity=".95"/></svg>`;
}

/** The field's crow, in any colours. */
export function birdIcon(body: string, beak: string, w = 76, h = 64): string {
  const belly = mix(body, '#FFFFFF', 0.18), wing = mix(body, '#000000', 0.22);
  return `<svg width="${w}" height="${h}" viewBox="0 0 120 100" aria-hidden="true">
    <path d="M86 54 L114 42 L112 64 Z" fill="${body}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <ellipse cx="64" cy="58" rx="32" ry="21" fill="${body}" stroke="${INK}" stroke-width="4"/><ellipse cx="58" cy="66" rx="19" ry="11" fill="${belly}"/>
    <path d="M64 48 Q78 10 104 12 Q94 30 88 52 Z" fill="${wing}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <circle cx="37" cy="45" r="17" fill="${body}" stroke="${INK}" stroke-width="4"/>
    <path d="M22 42 L6 47.5 L22 52 Z" fill="${beak}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <circle cx="32" cy="42" r="5.2" fill="#FFFFFF" stroke="${INK}" stroke-width="2.4"/><circle cx="31" cy="42" r="2.4" fill="${INK}"/>
    <path d="M58 78 L56 90 M68 78 L68 90" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/></svg>`;
}

const GOLD_COIN = ['#a56d24', '#f6cf6d', '#fff0ab', '#b08429', '#fff7c9'];

export function coinIcon(cn: string[] = GOLD_COIN, size = 30): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 30 30" aria-hidden="true">
    <circle cx="15" cy="16.6" r="12" fill="${cn[0]}" stroke="${INK}" stroke-width="2.4"/><circle cx="15" cy="14.6" r="12" fill="${cn[1]}" stroke="${INK}" stroke-width="2.4"/>
    <circle cx="15" cy="14.6" r="7.6" fill="none" stroke="${cn[2]}" stroke-width="1.8"/><rect x="13.9" y="9.8" width="2.2" height="9.6" rx="1" fill="${cn[3]}"/>
    <circle cx="11.2" cy="10.8" r="2.2" fill="${cn[4]}"/></svg>`;
}

function coinsIcon(it: FlairItem, w: number, h: number): string {
  const cn = it.look.coin || GOLD_COIN;
  return `<svg width="${w}" height="${h}" viewBox="0 0 76 64" aria-hidden="true">
    <g transform="translate(6 24)">${coinIcon(cn, 34).replace(/<svg[^>]*>|<\/svg>/g, '')}</g>
    <g transform="translate(36 26)">${coinIcon(cn, 34).replace(/<svg[^>]*>|<\/svg>/g, '')}</g>
    <g transform="translate(21 4)">${coinIcon(cn, 34).replace(/<svg[^>]*>|<\/svg>/g, '')}</g></svg>`;
}

/** The shop card picture for an item, in its own colours. */
export function flairIcon(it: FlairItem, w = 76, h = 64): string {
  if (it.kind === 'finish') return finishIcon(it, w, h);
  if (it.kind === 'trail') return trailIcon(it, w, h);
  if (it.kind === 'bird') return birdIcon(it.look.bird ? it.look.bird[0] : '#1e293b', it.look.bird ? it.look.bird[1] : '#f59e0b', w, h);
  return coinsIcon(it, w, h);
}

/** The preview scene in the Bling Barn: a patch of field with the chosen tool, trail, bird and coins. */
export function barnPreview(finish: FlairItem, trail: FlairItem, bird: FlairItem, coin: FlairItem): string {
  const b = bird.look.bird || ['#1e293b', '#f59e0b'];
  const strip = (svg: string) => svg.replace(/<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const cn = coin.look.coin || GOLD_COIN;
  return `<svg class="bb-scene" viewBox="0 0 236 134" width="236" height="134" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="236" height="134" fill="#BFE7F8"/><circle cx="196" cy="30" r="15" fill="#FFE27A"/>
    <path d="M0 84 Q60 70 120 80 T236 76 V134 H0 Z" fill="#8BCB5A"/><path d="M0 98 Q70 88 140 96 T236 94 V134 H0 Z" fill="#6DBE45"/>
    <g opacity=".55" fill="none" stroke="#4F8F2F" stroke-width="2" stroke-linecap="round"><path d="M18 118 q4-8 8 0"/><path d="M70 124 q4-8 8 0"/><path d="M196 120 q4-8 8 0"/></g>
    <g transform="translate(4 18) scale(1.05)">${strip(trailIcon(trail, 140, 90))}</g>
    <g transform="translate(84 6) scale(.62)">${strip(finishIcon(finish, 120, 120))}</g>
    <g transform="translate(158 46) scale(.5)">${strip(birdIcon(b[0], b[1], 120, 100))}</g>
    <g transform="translate(26 100)">${strip(coinIcon(cn, 24))}</g><g transform="translate(44 106)">${strip(coinIcon(cn, 20))}</g>
  </svg>`;
}

// ------------------------------------------------------------------ skill map glyphs (24 × 24)

const S = `fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"`;
const GLYPH: Record<string, string> = {
  core_awakening: `<path d="M8.5 20.5 L15 12" stroke="${INK}" stroke-width="4.2" stroke-linecap="round"/><path d="M8.5 20.5 L15 12" stroke="#C27838" stroke-width="2" stroke-linecap="round"/><path d="M14.4 12.6 C21 12.6 23 5 18 2.4 C19.4 7 16.6 9.6 12.4 9.2 Z" fill="#E2E8F0" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>`,
  reap_root: `<path d="M4 18 C9 18 16 12 19 4 C13 7 7 12 4 18 Z" fill="#E2E8F0" stroke="${INK}" stroke-width="1.9" stroke-linejoin="round"/><path d="M17.5 13.5 l1 2.2 2.2 1-2.2 1-1 2.2-1-2.2-2.2-1 2.2-1z" fill="#FFC23D" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>`,
  reap_swift: `<path d="M3 8 H10 M2 12 H8 M3 16 H10" ${S}/><path d="M12 5 L19 12 L12 19" ${S} stroke-width="2.8"/>`,
  reap_dash: `<path d="M4 12 H20" ${S}/><path d="M8 7.5 L3.5 12 L8 16.5 M16 7.5 L20.5 12 L16 16.5" ${S}/>`,
  reap_cleave: `<path d="M3 17 Q12 2 21 9" ${S} stroke-width="3"/><path d="M6 20 Q13 9 21 14" ${S} stroke="#C27838" stroke-width="2.4"/>`,
  reap_vortex: `<path d="M12 12 m0-1.5 a1.5 1.5 0 1 1 -1.5 1.5 a3.5 3.5 0 0 1 3.5-3.5 a5.5 5.5 0 0 1 5.5 5.5 a7.5 7.5 0 0 1 -7.5 7.5 a8.5 8.5 0 0 1 -8.5-8.5" ${S}/>`,
  reap_exec: `<path d="M13.5 2.5 L5.5 13.5 H11 L9.5 21.5 L18.5 9.5 H12.8 Z" fill="#FFC23D" stroke="${INK}" stroke-width="1.9" stroke-linejoin="round"/>`,
  soil_root: `<path d="M12 21 V11" ${S}/><path d="M12 12 C12 7 8 5 4 6 C4 10 7 12.5 12 12 Z" fill="#6DBE45" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 14 C12 9 16 7.5 20 8.5 C20 12.5 17 14.5 12 14 Z" fill="#8FD86A" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/><path d="M6 21 H18" ${S}/>`,
  soil_twin: `<path d="M7.5 21 V14 M16.5 21 V14" ${S}/><path d="M7.5 14.5 C7.5 10.5 5 9 2.5 9.5 C2.5 12.5 4.5 14.5 7.5 14.5 Z M16.5 14.5 C16.5 10.5 19 9 21.5 9.5 C21.5 12.5 19.5 14.5 16.5 14.5 Z" fill="#6DBE45" stroke="${INK}" stroke-width="1.7" stroke-linejoin="round"/><path d="M12 4 l.9 2 2 .9-2 .9-.9 2-.9-2-2-.9 2-.9z" fill="#FFC23D" stroke="${INK}" stroke-width="1.1"/>`,
  soil_dew: `<path d="M4 17 A8 8 0 0 1 20 17 Z" fill="#FFD45C" stroke="${INK}" stroke-width="1.9" stroke-linejoin="round"/><path d="M2 20.5 H22" ${S}/><path d="M12 3 v2.4 M5 6.5 l1.6 1.6 M19 6.5 l-1.6 1.6" ${S}/>`,
  soil_sun: `<circle cx="12" cy="12" r="4.6" fill="#FFD45C" stroke="${INK}" stroke-width="1.9"/><path d="M12 2.5 v2.6 M12 18.9 v2.6 M2.5 12 h2.6 M18.9 12 h2.6 M5.3 5.3 l1.8 1.8 M16.9 16.9 l1.8 1.8 M5.3 18.7 l1.8-1.8 M16.9 7.1 l1.8-1.8" ${S}/>`,
  soil_bounty: `<path d="M7 8 C5 11 4.5 16 6 19.5 C9 21.5 15 21.5 18 19.5 C19.5 16 19 11 17 8 Z" fill="#D9A066" stroke="${INK}" stroke-width="1.9" stroke-linejoin="round"/><path d="M8 8 C9 6 10 4.5 12 4.5 C14 4.5 15 6 16 8" ${S}/><path d="M9 14 l2 2 4-4.5" fill="none" stroke="#2F7A3A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
  soil_eden: `${[0, 72, 144, 216, 288].map(a => `<ellipse cx="12" cy="6.6" rx="3" ry="4" fill="#FF9CCF" stroke="${INK}" stroke-width="1.5" transform="rotate(${a} 12 11)"/>`).join('')}<circle cx="12" cy="11" r="2.6" fill="#FFC23D" stroke="${INK}" stroke-width="1.5"/><path d="M12 15.5 V22" ${S}/>`,
  gold_root: `<circle cx="12" cy="12" r="8.6" fill="#FFC23D" stroke="${INK}" stroke-width="2"/><path d="M14.6 8.8 C13.6 7.8 10 7.6 9.6 9.6 C9.2 12 14.8 11.6 14.4 14.2 C14 16.4 10.4 16.2 9.2 15 M12 6.4 V17.6" fill="none" stroke="${INK}" stroke-width="1.7" stroke-linecap="round"/>`,
  gold_lawyer: `<path d="M6 3 H15 L19 7 V21 H6 Z" fill="#FFFDF4" stroke="${INK}" stroke-width="1.9" stroke-linejoin="round"/><path d="M9 10 H16 M9 13.5 H16 M9 17 H13" ${S} stroke-width="1.7"/><circle cx="16.5" cy="18" r="3" fill="#E5484D" stroke="${INK}" stroke-width="1.6"/>`,
  gold_interest: `<path d="M5 9 H19 L18 20 Q12 22.5 6 20 Z" fill="#DDF2FA" stroke="${INK}" stroke-width="1.9" stroke-linejoin="round"/><rect x="7" y="5" width="10" height="4" rx="1.4" fill="#B9824B" stroke="${INK}" stroke-width="1.7"/><path d="M6.6 14 H17.4 L17 19 Q12 21 7 19 Z" fill="#FFC23D"/><path d="M12 17 V12 M9.8 14 L12 11.8 L14.2 14" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  gold_treaty: `<path d="M7 8 C3.5 6 3 2.5 5 2 C6.5 3.5 7.5 5 9 6.5 M17 8 C20.5 6 21 2.5 19 2 C17.5 3.5 16.5 5 15 6.5" ${S}/><path d="M7.5 7 Q12 4.5 16.5 7 L16 15 Q12 20.5 8 15 Z" fill="#F1F5F9" stroke="${INK}" stroke-width="1.9" stroke-linejoin="round"/><circle cx="10" cy="10.5" r="1.2" fill="${INK}"/><circle cx="14" cy="10.5" r="1.2" fill="${INK}"/><path d="M10.8 15.5 H13.2" ${S} stroke-width="1.6"/><path d="M12 18 V22" ${S} stroke-width="1.6"/>`,
  gold_herd: `<path d="M6 8.5 C3 7 2.6 4 4.4 3.5 C5.6 4.7 6.4 6 7.6 7.2 M14 8.5 C17 7 17.4 4 15.6 3.5 C14.4 4.7 13.6 6 12.4 7.2" ${S} stroke-width="1.9"/><path d="M6.4 7.8 Q10 5.8 13.6 7.8 L13.2 14 Q10 18.5 6.8 14 Z" fill="#F1F5F9" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/><circle cx="8.6" cy="10.6" r="1" fill="${INK}"/><circle cx="11.4" cy="10.6" r="1" fill="${INK}"/><path d="M18.5 22 V15" ${S} stroke-width="1.8"/><path d="M18.5 16 C18.5 12.5 16 11.5 14.5 12 C14.5 14.5 16.2 16 18.5 16 Z" fill="#6DBE45" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`,
  gold_midas: `<path d="M2.5 8 L7.5 12.5 L12 4 L16.5 12.5 L21.5 8 L19.5 19 H4.5 Z" fill="#FFC23D" stroke="${INK}" stroke-width="1.9" stroke-linejoin="round"/><circle cx="12" cy="15.5" r="1.8" fill="#E5484D" stroke="${INK}" stroke-width="1.2"/>`,
};

export function skillGlyph(id: string, size = 22): string {
  const g = GLYPH[id];
  return g ? `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${g}</svg>` : '';
}
