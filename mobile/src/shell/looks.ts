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
