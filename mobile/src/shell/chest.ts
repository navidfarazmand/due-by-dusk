// The chest that comes after each bill (Navid, 29 Oct: perks should come "as a chest", not a text box).
// Its tier is rolled (mostly wooden at first, mostly silver later, gold before the deed), and a rewarded ad can
// upgrade it once, up to diamond: four gold perks, pick two (Navid, 30 Oct). Tap it: the lid flies open, coins
// spill out and the perk cards rise from it. The cards are buttons the player picks from.

import { esc } from './dom';
import { spriteImg } from './art';
import type { PerkInfo } from './engine';

const INK = '#2B1708';

/** Body, bands and trim colours per tier. */
const TIERS: Record<number, { body: string; dark: string; band: string; trim: string; name: string }> = {
  1: { body: '#B9773E', dark: '#8A5326', band: '#6B4A2E', trim: '#D9DEE6', name: 'A wooden chest' },
  2: { body: '#AFC1D3', dark: '#7F93A8', band: '#55667A', trim: '#FFFFFF', name: 'A silver chest' },
  3: { body: '#FFC23D', dark: '#E3961C', band: '#B8660E', trim: '#FFF4B0', name: 'A gold chest' },
  4: { body: '#8FDCF7', dark: '#4FB0DE', band: '#2D7FB0', trim: '#FFFFFF', name: 'A diamond chest' },
};

/** The upgrade button's icon: an arrow going up. */
export const CHEST_UP_ICON = `<svg width="18" height="20" viewBox="0 0 18 20" aria-hidden="true"><path d="M9 2 L16 10 H11.5 V18 H6.5 V10 H2 Z" fill="#FFC23D" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/></svg>`;

export function chestName(tier: number): string {
  return (TIERS[tier] || TIERS[1]).name;
}

/** The chest itself: a body and a lid that hinges open (the CSS moves `.ch-lid`). */
export function chestSvg(tier: number): string {
  const t = TIERS[tier] || TIERS[1];
  const gem = (x: number, y: number, s: number) =>
    `<path d="M${x} ${y - s} L${x + s * 0.8} ${y} L${x} ${y + s} L${x - s * 0.8} ${y} Z" fill="#FFFFFF" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>`;
  const gems =
    tier === 3
      ? `<circle cx="34" cy="74" r="4.2" fill="#E5484D" stroke="${INK}" stroke-width="2"/><circle cx="86" cy="74" r="4.2" fill="#4FA3E0" stroke="${INK}" stroke-width="2"/>`
      : tier >= 4
        ? gem(34, 74, 6) + gem(86, 74, 6) + gem(60, 31, 5)
        : '';
  const studs = [22, 40, 80, 98].map(x => `<circle cx="${x}" cy="86" r="2.2" fill="${t.trim}" stroke="${INK}" stroke-width="1.4"/>`).join('');
  return `<svg class="ch-svg" viewBox="0 0 120 104" aria-hidden="true">
    <ellipse cx="60" cy="99" rx="50" ry="5" fill="rgba(43,23,8,.25)"/>
    <g class="ch-body">
      <rect x="10" y="50" width="100" height="46" rx="7" fill="${t.body}" stroke="${INK}" stroke-width="4"/>
      <rect x="10" y="50" width="100" height="12" fill="${t.dark}" stroke="${INK}" stroke-width="3"/>
      <rect x="24" y="50" width="10" height="46" fill="${t.band}" stroke="${INK}" stroke-width="3"/>
      <rect x="86" y="50" width="10" height="46" fill="${t.band}" stroke="${INK}" stroke-width="3"/>
      ${studs}${gems}
    </g>
    <g class="ch-lid">
      <path d="M10 52 L10 36 Q10 14 60 14 Q110 14 110 36 L110 52 Z" fill="${t.body}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
      <path d="M24 52 L24 19 M96 52 L96 19" stroke="${INK}" stroke-width="13" stroke-linecap="butt"/>
      <path d="M24 52 L24 20 M96 52 L96 20" stroke="${t.band}" stroke-width="7"/>
      <path d="M18 30 Q60 18 102 30" stroke="${t.trim}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>
    </g>
    <g class="ch-lock">
      <rect x="51" y="44" width="18" height="20" rx="4" fill="${tier === 3 ? '#FFF4B0' : tier >= 4 ? '#E8FBFF' : '#FFC23D'}" stroke="${INK}" stroke-width="3"/>
      <circle cx="60" cy="52" r="2.6" fill="${INK}"/><rect x="58.8" y="52" width="2.4" height="6" fill="${INK}"/>
    </g>
  </svg>`;
}

/** Coins and sparkles that burst out when the lid opens (positions are fixed so the burst looks the same). */
export function chestBurst(tier: number): string {
  const n = 6 + tier * 2;
  let out = '';
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i / (n - 1) - 0.5) * 2.4;
    const d = 70 + ((i * 37) % 40);
    out += `<i class="ch-coin" style="--dx: ${(Math.cos(a) * d).toFixed(0)}px; --dy: ${(Math.sin(a) * d - 20).toFixed(0)}px; --dl: ${(i * 0.035).toFixed(2)}s"></i>`;
  }
  return `<span class="ch-glow"></span>${out}`;
}

const ICONS: Record<string, string> = {
  blade: `<path d="M5 19 L12 12" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M5 19 L12 12" stroke="#C27838" stroke-width="2.4" stroke-linecap="round"/><path d="M11 13 C20 13 22 4 16 1 C18 7 15 10 9 10 Z" fill="#E2E8F0" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>`,
  speed: `<path d="M6 7 H17 V13 Q17 18 11.5 18 Q6 18 6 13 Z" fill="#fff" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><path d="M17 9 Q21 9 21 12 Q21 15 17 15" fill="none" stroke="${INK}" stroke-width="2"/><path d="M8 4 Q9 2.5 8 1 M11.5 4 Q12.5 2.5 11.5 1 M15 4 Q16 2.5 15 1" stroke="${INK}" stroke-width="1.5" fill="none" stroke-linecap="round"/><rect x="7.5" y="9" width="8" height="3" fill="#8A5326"/>`,
  reach: `<path d="M3 12 H21" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/><path d="M7 7 L2.5 12 L7 17 M17 7 L21.5 12 L17 17" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 12 H20" stroke="#6EC6F0" stroke-width="1.4" stroke-linecap="round"/>`,
  sun: `<circle cx="12" cy="12" r="5.2" fill="#FFC23D" stroke="${INK}" stroke-width="2"/><g stroke="${INK}" stroke-width="2" stroke-linecap="round"><path d="M12 1.5 V4"/><path d="M12 20 V22.5"/><path d="M1.5 12 H4"/><path d="M20 12 H22.5"/><path d="M4.6 4.6 L6.3 6.3"/><path d="M17.7 17.7 L19.4 19.4"/><path d="M4.6 19.4 L6.3 17.7"/><path d="M17.7 6.3 L19.4 4.6"/></g>`,
  coin: `<circle cx="12" cy="12" r="9" fill="#FFC23D" stroke="${INK}" stroke-width="2.2"/><circle cx="12" cy="12" r="5.6" fill="none" stroke="#E3961C" stroke-width="1.8"/><path d="M12 8.5 V15.5" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>`,
  clover: `<g fill="#6DBE45" stroke="${INK}" stroke-width="1.8"><circle cx="8.5" cy="8.5" r="4"/><circle cx="15.5" cy="8.5" r="4"/><circle cx="8.5" cy="15.5" r="4"/><circle cx="15.5" cy="15.5" r="4"/></g><path d="M12 12 Q14 18 18 22" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  sprout: `<path d="M12 22 V11" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/><path d="M12 13 C6 13 3 9 3 4 C8 4 12 7 12 13 Z" fill="#6DBE45" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 11 C17 11 21 8 21 3 C16 3 12 6 12 11 Z" fill="#8FD86B" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/><path d="M5 22 H19" stroke="#8A5326" stroke-width="3" stroke-linecap="round"/>`,
  corn: `<path d="M12 2.5 C16.5 5 17 15 12 21 C7 15 7.5 5 12 2.5 Z" fill="#FFC23D" stroke="${INK}" stroke-width="2"/><path d="M9.5 8 H14.5 M9 11.5 H15 M9.5 15 H14.5" stroke="#E3961C" stroke-width="1.5"/><path d="M12 21 C8 20 5 16 5 12 C8 15 10 17 12 21 Z M12 21 C16 20 19 16 19 12 C16 15 14 17 12 21 Z" fill="#6DBE45" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`,
  chain: `<rect x="2.5" y="8" width="11" height="8" rx="4" fill="none" stroke="${INK}" stroke-width="2.6"/><rect x="10.5" y="8" width="11" height="8" rx="4" fill="none" stroke="${INK}" stroke-width="2.6"/><rect x="2.5" y="8" width="11" height="8" rx="4" fill="none" stroke="#FFC23D" stroke-width="1"/><rect x="10.5" y="8" width="11" height="8" rx="4" fill="none" stroke="#FFC23D" stroke-width="1"/>`,
  radish: `<path d="M12 21 Q11.5 23 12 23.5" stroke="${INK}" stroke-width="1.6" fill="none"/><circle cx="12" cy="14" r="7" fill="#E5484D" stroke="${INK}" stroke-width="2"/><path d="M12 7 C10 3 6 3 5 4 C7 6 9 7 12 7 Z M12 7 C14 3 18 3 19 4 C17 6 15 7 12 7 Z" fill="#6DBE45" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><circle cx="9.5" cy="12" r="1.6" fill="#fff" opacity=".8"/>`,
  goat: `<path d="M6 6 Q3 2 2 5 Q4 6 6 8 M18 6 Q21 2 22 5 Q20 6 18 8" fill="#E4DACA" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><path d="M6 8 Q12 4 18 8 L17 16 Q12 22 7 16 Z" fill="#fff" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><circle cx="9.5" cy="11" r="1.3" fill="${INK}"/><circle cx="14.5" cy="11" r="1.3" fill="${INK}"/><path d="M10 18 Q12 23 14 18" fill="#E4DACA" stroke="${INK}" stroke-width="1.5"/>`,
  star: `<path d="M12 2 L14.9 8.6 L22 9.3 L16.6 14 L18.2 21 L12 17.3 L5.8 21 L7.4 14 L2 9.3 L9.1 8.6 Z" fill="#FFC23D" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`,
  bolt: `<path d="M14 1.5 L4.5 13.5 H11 L9.5 22.5 L19.5 9.5 H13 Z" fill="#FFE27A" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`,
  cleave: `<circle cx="12" cy="12" r="9" fill="none" stroke="${INK}" stroke-width="3"/><circle cx="12" cy="12" r="9" fill="none" stroke="#38BDF8" stroke-width="1.4"/><circle cx="12" cy="12" r="4.5" fill="#FDE047" stroke="${INK}" stroke-width="2"/>`,
};

export function perkIcon(key: string, size = 26): string {
  const body = ICONS[key] || ICONS.star;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
}

export const TIER_LABEL = ['', 'Common', 'Rare', 'Epic'];

/** Two fingertips and a charging ring: the Charge Cleave gesture (on cards for perks that improve it). */
const TWO_FINGERS = `<svg class="pk-gest" width="34" height="22" viewBox="0 0 34 22" aria-hidden="true"><circle cx="9" cy="11" r="8" fill="none" stroke="#38BDF8" stroke-width="2.4"/><circle cx="9" cy="11" r="3.6" fill="#fff" stroke="${INK}" stroke-width="2"/><circle cx="26" cy="11" r="3.6" fill="#fff" stroke="${INK}" stroke-width="2"/><path d="M26 3.5 V1 M30.5 5 L32 3 M21.5 5 L20 3" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/></svg>`;

/** One perk card (a button the player picks). Perks that change a gesture show it. */
export function perkCard(p: PerkInfo, i: number, line: string, touch = false): string {
  const gesture = p.id === 'cleaver' ? TWO_FINGERS : '';
  const text = p.id === 'cleaver' && touch ? 'Charge Cleave (hold a 2nd finger) charges 50% faster and hits wider.' : line;
  return `<button type="button" class="perk-card pk-t${p.tier}" data-act="perk" data-arg="${esc(p.id)}" style="--i: ${i}">
    <span class="pk-top"><span class="pk-ic">${perkIcon(p.icon)}</span>${gesture}<span class="pk-tier">${TIER_LABEL[p.tier] || ''}</span></span>
    <b>${esc(p.name)}</b><span class="pk-line">${esc(text)}</span></button>`;
}

/** The crop that joins the field after this bill: sprite, name, what it pays and how many cuts it takes. */
export function newCropHtml(type: string, name: string, pay: number, cuts: number, money: (v: number) => string): string {
  const cutTxt = cuts <= 1 ? 'one cut' : `about ${cuts} cuts`;
  return `<div class="chest-new"><span class="cn-spr">${spriteImg(type, 34, name)}</span>
    <span class="cn-txt"><b>New on the field: ${esc(name)}</b><span>${money(pay)} each · ${cutTxt}</span></span></div>`;
}
