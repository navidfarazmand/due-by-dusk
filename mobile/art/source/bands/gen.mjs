#!/usr/bin/env node
/*
 * Due by Dusk: skyline bands, one per city (3600×300, transparent sky), in the flat look of src/art/bands/ca.webp:
 * flat fills, dark-brown ink outlines, snow white and snow-blue, lavender mountains.
 *
 * Each city is one row of CITIES below: its season (snow on or off, grass and tree colours), the scene behind the
 * fence (coast, river, plain, prairie or lake, with a few numbers), its landmark and an optional second element, a few
 * extra decorations and its tree mix. The functions after the table turn a row into an SVG; Chromium (Playwright)
 * renders it and Pillow writes the WebP. A new city is a new row (and, if it needs one, a new landmark function).
 *
 *   (from this folder; needs Playwright's Chromium and Python with Pillow. Copy the .webp files it writes into
 *   mobile/src/art/bands/, where the game picks up a band named after a city id, or after a country code.)
 *   node gen.mjs                  every city: <city id>.webp next to this file, build/<city id>.svg|.png, preview.png
 *   node gen.mjs ca_toronto ...   just these cities (preview.png still shows every city that has a band here)
 *
 * Only a narrow slice of a band shows in the game. The band is drawn centred, 960 CSS px wide; on every phone the gap
 * between the bank chip and the sun dial is about f = 0.385..0.425 of the band's width. So the landmark is centred at
 * x = 1458 (f 0.405) and kept within x 1386..1530; the second element sits at x = 2030 (f 0.564, between the dial and
 * the power meter). Everything else is decoration, mostly under the HUD. The fence, its rails and the ground line keep
 * the positions of ca.webp, so the field below lines up.
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUILD = path.join(HERE, 'build');
const W = 3600, H = 300;
const LM = 1458; // landmark centre: f 0.405
const SL = 2030; // second element centre: f 0.564

// ================================================================== palette (sampled from ca.webp)
const INK = '#2B1707';
const K = {
  snow: '#FFFFFF', snowBlue: '#D2DFEF', snowPale: '#E9F1FA', snowShade: '#DDE9F5',
  lav: '#AFB9DD', lavShade: '#9DA8D3',
  pine: '#307D58', pine2: '#389064',
  water: '#6DB1DC', water2: '#8CC0E4',
  orange: '#F59E43', orange2: '#F4B064', redOrange: '#F0783C', red: '#D84430', maple: '#E0543C', gold: '#F2C14E',
  tan: '#B09C78', tanLight: '#D4C0A0', post: '#A99A80',
  trunk: '#784824', yellow: '#FCD45C', cream: '#F8F4EC', stone: '#E8D8B2', stoneShade: '#D2BF96',
  copper: '#5FA88A', copperShade: '#4C937A', copperLight: '#86C4A8', glass: '#CFE6F5', glassDark: '#3F5A78',
  concrete: '#E5E2DB', concreteShade: '#C6C1B8',
};

// ================================================================== seasons
// snow: 2 snow on everything, 1 light snow (caps only), 0 none. far/near: the ground behind the fence (far plain, near
// bank). ground: the strip in front of the fence (snow, leaves or grass; it meets the game's field at y 270).
const SEASONS = {
  winter: {
    snow: 2, far: K.snowBlue, near: K.snowPale, distant: '#A9BCD6', ground: 'snow',
    crowns: [[K.maple, K.orange, K.redOrange], [K.orange, K.redOrange, K.gold]], // maples in their first snow
    pines: [K.pine, K.pine2],
  },
  autumn: {
    snow: 0, far: '#CBC58A', near: '#B3BC63', distant: '#AF9F7C', ground: 'leaves',
    crowns: [[K.maple, K.orange, K.redOrange], [K.orange, K.gold, K.redOrange], ['#D9452B', K.maple, K.orange], [K.gold, K.orange, K.orange2]],
    pines: [K.pine, K.pine2],
  },
  summer: {
    snow: 0, far: '#C4DE92', near: '#A6CE6A', distant: '#86AF72', ground: 'grass',
    crowns: [['#5FA34E', '#4E9046', '#78B85C'], ['#6BAE52', '#5A9C4A', '#86C062']],
    pines: [K.pine, K.pine2],
  },
};

// ================================================================== the cities: one row each
// season: a key of SEASONS; snow (optional) overrides the season's snow level (Toronto: light snow).
// scene: the land and water behind the fence, by kind:
//   coast    { sea, horizon }               snowy hills on the left, the sea from x = sea to the right
//   river    { from, to, horizon, bank, waterTop }   far hills and bank, a river between from..to
//   plain    { horizon, lake? }             flat fields to the horizon; lake: [x0, x1] of open water at the horizon
//   prairie  { horizon, ice? }              flatter and emptier; ice: [x0, x1] of a frozen river in front
//   lake     { from, to, top }              mountains, a lake from y = top, golden vineyard hills either side of from..to
// Where the water comes up to the fence, the near bank dips so it shows between the rails.
// landmark / second: functions in L / S, drawn centred at LM / SL. decor: functions in D (the rest of the strip).
// trees: the mix of near trees; keep: extra x ranges kept clear of them; leaves: fallen leaves on the ground strip.
export const CITIES = {
  ca_charlottetown: {
    name: 'Charlottetown', season: 'winter',
    scene: { kind: 'coast', sea: 1240, horizon: 150 },
    landmark: 'peiLighthouse', second: 'farmhouse',
    decor: ['lobsterBoat'], trees: { pine: 0.8, maple: 0.2 }, keep: [[2300, 2640]], seed: 11,
  },
  ca_gatineau: {
    name: 'Gatineau', season: 'autumn',
    scene: { kind: 'river', from: 700, to: 2760, horizon: 120, bank: 162, waterTop: 176 },
    landmark: 'peaceTower', second: 'sugarShack',
    decor: [], trees: { maple: 0.82, pine: 0.18 }, leaves: 70, seed: 12,
  },
  ca_toronto: {
    name: 'Toronto', season: 'winter', snow: 1,
    scene: { kind: 'plain', horizon: 160 },
    landmark: 'cnTower', second: 'cityHall',
    decor: ['skyline'], trees: { pine: 0.6, maple: 0.4 }, leaves: 7, seed: 13,
  },
  ca_leamington: {
    name: 'Leamington', season: 'summer',
    scene: { kind: 'plain', horizon: 156, lake: [2380, 3700] },
    landmark: 'bigTomato', second: 'greenhouseGable',
    decor: ['greenhouses'], trees: { maple: 0.75, pine: 0.25 }, keep: [[880, 1340], [1600, 1930]], seed: 14,
  },
  ca_saskatoon: {
    name: 'Saskatoon', season: 'winter',
    scene: { kind: 'prairie', horizon: 166, ice: [1840, 2760] },
    landmark: 'grainElevator', second: 'bessborough',
    decor: ['broadwayBridge', 'farElevators'], trees: { pine: 0.55, maple: 0.45 }, keep: [[2180, 2700]], seed: 15,
  },
  ca_kelowna: {
    name: 'Kelowna', season: 'summer',
    scene: { kind: 'lake', from: 1290, to: 2300, top: 150 },
    landmark: 'ogopogo', second: 'sailboat',
    decor: ['winery'], trees: { pine: 0.45, maple: 0.55 }, keep: [[1180, 1390], [1530, 1650]], seed: 16,
  },
};

// ================================================================== small SVG helpers
const r1 = (v) => Math.round(v * 10) / 10;
const pt = (p) => `${r1(p[0])},${r1(p[1])}`;
const poly = (pts) => 'M' + pts.map(pt).join('L') + 'Z';
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** A smooth (Catmull-Rom) open path through the points. */
function curve(pts) {
  let d = 'M' + pt(pts[0]);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += 'C' + pt([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]) + ' ' +
      pt([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]) + ' ' + pt(p2);
  }
  return d;
}
// classes: o main outline (5 px), m medium (3.5), t thin (2.5), n none; l/lt/lo: unfilled lines
const Path = (d, fill, cls = 'o', style = '') => `<path class="${cls}" fill="${fill}" d="${d}"${style ? ` style="${style}"` : ''}/>`;
const Circ = (cx, cy, r, fill, cls = 'o') => `<circle class="${cls}" fill="${fill}" cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}"/>`;
const Ell = (cx, cy, rx, ry, fill, cls = 'o', rot = 0) =>
  `<ellipse class="${cls}" fill="${fill}" cx="${r1(cx)}" cy="${r1(cy)}" rx="${r1(rx)}" ry="${r1(ry)}"${rot ? ` transform="rotate(${rot} ${r1(cx)} ${r1(cy)})"` : ''}/>`;
const Rect = (x, y, w, h, fill, cls = 'o', rx = 0) =>
  `<rect class="${cls}" fill="${fill}" x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}"${rx ? ` rx="${rx}"` : ''}/>`;
/** An unfilled line; colour and width optional (inline style beats the class). */
const Line = (d, cls = 'l', color, width) =>
  `<path class="${cls}" d="${d}"${color || width ? ` style="${color ? `stroke:${color};` : ''}${width ? `stroke-width:${width}` : ''}"` : ''}/>`;
const seg = (x1, y1, x2, y2) => `M${r1(x1)},${r1(y1)}L${r1(x2)},${r1(y2)}`;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function mix(hex, to, t) {
  const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16);
  const c = [16, 8, 0].map((s) => Math.round(lerp((a >> s) & 255, (b >> s) & 255, t)));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}
const light = (hex, t = 0.35) => mix(hex, '#FFFFFF', t);
const dark = (hex, t = 0.18) => mix(hex, '#2B1707', t);

// ================================================================== trees
function tierPath(x, a, b, hw) {
  const dy = b - a;
  return `M${r1(x)},${r1(a)}Q${r1(x + hw * 0.3)},${r1(a + dy * 0.62)} ${r1(x + hw)},${r1(b)}` +
    `Q${r1(x)},${r1(b + dy * 0.2)} ${r1(x - hw)},${r1(b)}Q${r1(x - hw * 0.3)},${r1(a + dy * 0.62)} ${r1(x)},${r1(a)}Z`;
}
/** A snow cap over the tip of a pine tier: follows the tier's sides down to t, with a dripping lower edge. */
function tipCap(x, a, b, hw, t) {
  const dy = b - a, P1 = [x + hw * 0.3, a + dy * 0.62], P2 = [x + hw, b];
  const B = [(1 - t) ** 2 * x + 2 * (1 - t) * t * P1[0] + t * t * P2[0], (1 - t) ** 2 * a + 2 * (1 - t) * t * P1[1] + t * t * P2[1]];
  const Q = [x + t * (P1[0] - x), a + t * (P1[1] - a)], w = B[0] - x, y = B[1], dd = Math.max(3, w * 0.35);
  return Path(`M${r1(x)},${r1(a)}Q${pt(Q)} ${pt(B)}Q${r1(x + w * 0.72)},${r1(y + dd)} ${r1(x + w * 0.38)},${r1(y + 1)}` +
    `Q${r1(x)},${r1(y + dd * 1.2)} ${r1(x - w * 0.36)},${r1(y + 1)}Q${r1(x - w * 0.72)},${r1(y + dd)} ${r1(2 * x - B[0])},${r1(y)}` +
    `Q${r1(2 * x - Q[0])},${r1(Q[1])} ${r1(x)},${r1(a)}Z`, K.snow, 'm');
}
function pine(x, base, h, col, snow) {
  const top = base - h;
  const tiers = [[top + h * 0.3, top + h * 0.94, h * 0.41], [top + h * 0.13, top + h * 0.68, h * 0.31], [top, top + h * 0.43, h * 0.21]];
  let s = Rect(x - h * 0.05, base - h * 0.1, h * 0.1, h * 0.14, K.trunk, 'm');
  tiers.forEach(([a, b, hw], i) => {
    s += Path(tierPath(x, a, b, hw), col);
    if (snow >= 2) {
      s += Ell(x + hw * 0.72, b - 2.4, hw * 0.21, 3.4, K.snow, 'm');
      s += Ell(x - hw * 0.68, b - 2, hw * 0.19, 3.2, K.snow, 'm');
      if (i < 2) s += Ell(x + hw * 0.04, b + 1, hw * 0.15, 3, K.snow, 'm');
    }
  });
  if (snow) s += tipCap(x, top, top + h * 0.43, h * 0.21, snow >= 2 ? 0.46 : 0.32);
  return s;
}
/** A snow cap on a round crown blob. */
function blobCap(cx, cy, R, spread = 62) {
  const a = (spread * Math.PI) / 180, L = [cx - R * Math.sin(a), cy - R * Math.cos(a)], Rr = [cx + R * Math.sin(a), cy - R * Math.cos(a)];
  const y = L[1], w = Rr[0] - L[0];
  return Path(`M${pt(L)}A${r1(R)},${r1(R)} 0 0 1 ${pt(Rr)}Q${r1(Rr[0] - w * 0.12)},${r1(y + R * 0.24)} ${r1(Rr[0] - w * 0.28)},${r1(y + R * 0.05)}` +
    `Q${r1(cx)},${r1(y + R * 0.3)} ${r1(L[0] + w * 0.3)},${r1(y + R * 0.06)}Q${r1(L[0] + w * 0.12)},${r1(y + R * 0.22)} ${pt(L)}Z`, K.snow, 'm');
}
/** A round-crowned tree (the maples): overlapping outlined blobs with light discs; snow caps in winter. */
function roundTree(x, base, h, cols, snow) {
  const u = h / 4, top = base - h;
  let s = Path(`M${r1(x - u * 0.3)},${r1(base)}L${r1(x - u * 0.2)},${r1(top + u * 2.3)}L${r1(x - u * 0.55)},${r1(top + u * 1.9)}` +
    `L${r1(x - u * 0.38)},${r1(top + u * 1.75)}L${r1(x)},${r1(top + u * 2.05)}L${r1(x + u * 0.42)},${r1(top + u * 1.7)}` +
    `L${r1(x + u * 0.58)},${r1(top + u * 1.86)}L${r1(x + u * 0.2)},${r1(top + u * 2.3)}L${r1(x + u * 0.3)},${r1(base)}Z`, K.trunk);
  const blobs = [[-0.95, 1.78, 0.84], [0.97, 1.72, 0.86], [0, 0.96, 0.96], [-0.55, 2.38, 0.7], [0.6, 2.34, 0.72]];
  blobs.forEach(([dx, dy, rr], i) => {
    const c = cols[i % cols.length], cx = x + dx * u, cy = top + dy * u, R = rr * u;
    s += Circ(cx, cy, R, c);
    if (i < 3) s += Circ(cx - R * 0.38, cy - R * 0.36, R * 0.26, light(c, 0.32), 'n');
    if (snow && i < (snow >= 2 ? 3 : 1)) s += blobCap(cx, cy, R, i === 2 ? 64 : 52);
  });
  return s;
}

// ================================================================== backdrops (far land, water, near bank)
function mountainRange(rnd, { top = 40, bottom = 125, base = 230, snow = true, shade = false, fill = K.lav, x0 = -220, x1 = 3820, step = [300, 470], spread = 40 }) {
  const pts = [[x0, bottom]];
  let x = x0, peak = true;
  while (x < x1) {
    x += lerp(step[0], step[1], rnd()) / 2;
    pts.push([x, peak ? top + rnd() * spread : bottom - rnd() * 22]);
    peak = !peak;
  }
  let s = Path(poly([[x0, base], ...pts, [x, base]]), fill, 'n');
  for (let i = 1; i < pts.length - 1; i++) {
    const P = pts[i], L = pts[i - 1], R = pts[i + 1];
    if (!(P[1] < L[1] && P[1] < R[1])) continue;
    if (shade) s += Path(poly([P, R, [R[0], base], [lerp(P[0], R[0], 0.12), base]]), K.lavShade, 'n');
    if (snow) {
      const d = 19 + rnd() * 9;
      const a = [P[0] + ((L[0] - P[0]) * d) / (L[1] - P[1]), P[1] + d], b = [P[0] + ((R[0] - P[0]) * d) / (R[1] - P[1]), P[1] + d];
      const cap = [P, b];
      for (let k = 1; k < 4; k++) cap.push([lerp(b[0], a[0], k / 4), P[1] + d + (k % 2 ? 8 : -2)]);
      cap.push(a);
      s += Path(poly(cap), K.snow, 't');
    }
  }
  s += Line('M' + pts.map(pt).join('L'), 'lt');
  return s;
}
/** Rolling land from y (minus up to amp) down to the bottom. */
function rolling(rnd, { y, amp, fill, cls = 't', x0 = -150, x1 = 3750, step = [200, 360], pts }) {
  if (!pts) {
    pts = [];
    for (let x = x0; x < x1 + step[1]; x += lerp(step[0], step[1], rnd())) pts.push([x, y - rnd() * amp]);
  }
  const last = pts[pts.length - 1][0];
  return Path(curve(pts) + `L${r1(last)},312L${r1(pts[0][0])},312Z`, fill, cls);
}
function waterBody(rnd, x0, x1, top, { ice = false } = {}) {
  let s = Rect(x0, top, x1 - x0, 270 - top, ice ? '#C9DFF1' : K.water, 'n');
  s += Rect(x0, top, x1 - x0, 6, ice ? '#E4EFF9' : K.water2, 'n');
  const n = Math.round((x1 - x0) / 34);
  for (let i = 0; i < n; i++) {
    const x = lerp(x0 + 10, x1 - 30, rnd()), y = top + 12 + rnd() * 34, w = 10 + rnd() * 16;
    s += ice ? Line(seg(x, y, x + w, y + (rnd() - 0.5) * 4), 'lt', '#F4F8FC', 2.5) : Line(seg(x, y, x + w, y), 'lt', '#E9F5FC', 3);
  }
  return s + Line(seg(x0, top, x1, top), 'lt');
}
/** Small far trees with no outline, along a line. */
function distantTrees(rnd, y, color, ranges, density = 0.022) {
  let s = '';
  for (const [a, b] of ranges) {
    const n = Math.round((b - a) * density);
    for (let i = 0; i < n; i++) {
      const x = lerp(a, b, rnd()), h = 9 + rnd() * 13, yy = y + rnd() * 16;
      s += rnd() < 0.7 ? Path(poly([[x, yy - h], [x + h * 0.38, yy], [x - h * 0.38, yy]]), color, 'n') : Circ(x, yy - h * 0.4, h * 0.42, color, 'n');
    }
  }
  return s;
}
/** The near ground behind the fence: y about 178, dipping to 197 where water reaches the fence. */
function nearBank(rnd, fill, lows = []) {
  const pts = [];
  for (let x = -120; x <= 3720; x += 60) {
    let y = 178 + (rnd() - 0.5) * 5;
    for (const [a, b] of lows) y = lerp(y, 198, sstep(a - 100, a, x) * (1 - sstep(b, b + 100, x)));
    pts.push([x, y]);
  }
  return Path(curve(pts) + 'L3720,312L-120,312Z', fill, 'm');
}

// ================================================================== fence and ground (positions of ca.webp)
const POSTS = Array.from({ length: 24 }, (_, k) => 90 + 150 * k);
function fence(rnd, snow) {
  let s = Line('M-20,199.6' + POSTS.map((x, k) => `Q${x - 75},${r1(201.5 + rnd())} ${x},199.6`).join('') + 'Q3670,201 3640,199.6', 'lo');
  if (snow) s += Path(`M-20,203` + Array.from({ length: 48 }, (_, k) => `Q${-20 + k * 76 + 38},${r1(201 + rnd() * 3)} ${-20 + (k + 1) * 76},${r1(206 + rnd() * 4)}`).join('') + 'L3640,214L-20,214Z', K.snow, 'n');
  for (let k = -1; k < 24; k++) {
    const x0 = 90 + 150 * k, j = (rnd() - 0.5) * 2.4;
    for (const [yt, yb] of [[214, 226], [230, 241]]) {
      s += Rect(x0 - 4, yt + j, 158, yb - yt, K.tan, 'm', 5.5);
      s += Rect(x0 + 6, yt + j + 2.3, 138, 2.6, K.tanLight, 'n');
      if (snow && yt === 214) s += Path(`M${x0 + 8},${214.5 + j}Q${x0 + 40},${208 + j} ${x0 + 75},${210.5 + j}Q${x0 + 110},${207.5 + j} ${x0 + 140},${214.5 + j}Z`, K.snow, 't');
    }
  }
  for (const x of POSTS) {
    for (const sgn of [-1, 1]) s += Path(poly([[x + sgn * 16, 248], [x + sgn * 7.5, 248], [x - sgn * 10.5, 192.5], [x - sgn * 2, 192.5]]), K.post, 'm');
    s += Circ(x - 15, 220.2, 5.6, K.tanLight, 'm') + Circ(x - 15, 235.6, 5.2, K.tanLight, 'm');
    if (snow) s += Ell(x - 6.3, 192.6, 5.5, 3.2, K.snow, 't') + Ell(x + 6.3, 192.6, 5.5, 3.2, K.snow, 't');
  }
  return s;
}
function mapleLeaf(x, y, sz, rot, col) {
  const p = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + rot, r = i % 2 ? sz * 0.46 : sz * (i % 4 === 0 ? 1 : 0.8);
    p.push([x + Math.sin(a) * r, y - Math.cos(a) * r]);
  }
  return Path(poly(p), col, 't');
}
/** The strip in front of the fence (y 247..300; the game's field covers it from y 270). */
function ground(rnd, kind, leaves = 0) {
  const pts = [];
  for (let x = -100; x <= 3700; x += 60) pts.push([x, 249.5 + (rnd() - 0.5) * 5]);
  const edge = curve(pts) + 'L3700,312L-100,312Z';
  const base = kind === 'snow' ? K.snow : kind === 'grass' ? '#8CC055' : '#A3B158';
  const band = kind === 'snow' ? K.snowShade : kind === 'grass' ? '#79AD48' : '#8E9E4C';
  let s = Path(edge, base, 'o', 'stroke-width:6');
  s += Rect(-20, 258.5, 3640, 10.5, band, 'n');
  if (kind !== 'snow') {
    const tuft = kind === 'grass' ? '#5E9440' : '#7A8A3E';
    for (let x = -10; x < 3610; x += 14 + rnd() * 22) {
      const y = 254 + rnd() * 12, h = 4 + rnd() * 5;
      s += Line(`M${r1(x - 3)},${r1(y - h)}L${r1(x)},${r1(y)}L${r1(x + 3)},${r1(y - h * 0.9)}`, 'lt', tuft, 2);
    }
    if (kind === 'grass') for (let i = 0; i < 46; i++) s += Circ(rnd() * 3600, 253 + rnd() * 14, 2.2, rnd() < 0.5 ? '#FFFFFF' : '#F6D56A', 'n');
  }
  const LEAF = ['#D9452B', '#F59E43', '#F2C14E', '#B5562B'];
  for (let i = 0; i < leaves; i++) s += mapleLeaf(rnd() * 3600, 253 + rnd() * 13, 6.5 + rnd() * 2.5, rnd() * 6.28, LEAF[(rnd() * 4) | 0]);
  return s;
}

// ================================================================== landmarks (centred at cx; within cx ± 72)
const L = {};

/** PEI: a white tapered lighthouse with a red lantern, on red sandstone rocks over the sea, under snow. */
L.peiLighthouse = (cx, sn) => {
  const R = '#C4532F', Rd = '#9C3A22', Rl = '#DC7148';
  let s = Path(curve([[cx - 80, 246], [cx - 76, 212], [cx - 68, 188], [cx - 54, 169], [cx - 32, 158], [cx - 4, 155], [cx + 26, 156],
    [cx + 48, 163], [cx + 64, 177], [cx + 74, 198], [cx + 78, 246]]) + 'Z', R);
  s += Path(curve([[cx - 72, 214], [cx - 64, 190], [cx - 50, 173], [cx - 34, 165], [cx - 30, 177], [cx - 44, 191], [cx - 54, 214]]) + 'Z', Rl, 'n');
  for (const [y, a, b] of [[184, -60, 66], [198, -70, 72], [211, -74, 76]]) s += Line(`M${cx + a},${y}Q${cx - 18},${y - 6} ${cx + 4},${y - 1}T${cx + b},${y - 3}`, 'l', Rd, 3);
  // the tower
  const yb = 166, yt = 70, wb = 29, wt = 20;
  s += Path(poly([[cx - wb, yb], [cx - wt, yt], [cx + wt, yt], [cx + wb, yb]]), K.snow);
  s += Path(poly([[cx + wb * 0.36, yb - 2.5], [cx + wt * 0.36, yt + 2.5], [cx + wt - 2.5, yt + 2.5], [cx + wb - 2.5, yb - 2.5]]), K.snowShade, 'n');
  s += Line(seg(cx + wb * 0.36, yb - 2, cx + wt * 0.36, yt + 2), 'lt') + Line(seg(cx - wb * 0.36, yb - 2, cx - wt * 0.36, yt + 2), 'lt');
  s += Path(poly([[cx - wt - 1.4, yt + 11], [cx - wt, yt], [cx + wt, yt], [cx + wt + 1.4, yt + 11]]), K.red, 'm');
  s += Rect(cx - 7, yt + 27, 14, 18, K.red, 'm') + Rect(cx - 3.5, yt + 30.5, 7, 11, '#3D4A5C', 'n');
  s += Rect(cx - 7.5, yt + 60, 15, 17, K.red, 'm') + Rect(cx - 4, yt + 63.5, 8, 10, '#3D4A5C', 'n');
  s += Path(`M${cx - 8},${yb}L${cx - 8},${yb - 15}Q${cx},${yb - 23} ${cx + 8},${yb - 15}L${cx + 8},${yb}Z`, K.red, 'm');
  // lantern, gallery, dome
  s += Rect(cx - 16, yt - 34, 32, 27, K.yellow);
  s += Line(seg(cx - 5.5, yt - 33, cx - 5.5, yt - 8), 'lt') + Line(seg(cx + 5.5, yt - 33, cx + 5.5, yt - 8), 'lt');
  s += Line(seg(cx - 29, yt - 17, cx + 29, yt - 17), 'l');
  for (const dx of [-27, -14, 14, 27]) s += Line(seg(cx + dx, yt - 17, cx + dx, yt - 8), 'lt');
  s += Rect(cx - 31, yt - 9, 62, 9, K.red);
  s += Path(`M${cx - 20},${yt - 33}Q${cx - 19},${yt - 53} ${cx},${yt - 54}Q${cx + 19},${yt - 53} ${cx + 20},${yt - 33}Z`, K.red);
  s += Ell(cx - 7, yt - 44, 4, 6, light(K.red, 0.3), 'n', 20);
  s += Line(seg(cx, yt - 54, cx, yt - 61), 'l') + Circ(cx, yt - 64, 3.8, INK, 'n');
  // snow on the rocks, in front of the tower's foot
  if (sn) s += Path(`M${cx - 62},${174}Q${cx - 42},${152} ${cx - 4},${152}Q${cx + 36},${152} ${cx + 58},${168}` +
    `Q${cx + 50},${176} ${cx + 38},${170}Q${cx + 24},${179} ${cx + 9},${171}Q${cx - 8},${180} ${cx - 24},${171}Q${cx - 40},${180} ${cx - 50},${172}Q${cx - 56},${180} ${cx - 62},${174}Z`, K.snow, 'm');
  return s;
};

/** Ottawa, seen from Gatineau: the Peace Tower (stone, clock, green copper roof, flag) over the Centre Block,
 *  the Library of Parliament, on the cliff above the Ottawa River. */
L.peaceTower = (cx, sn, rnd) => {
  let s = '';
  // the cliff (Parliament Hill) from the buildings down to the river
  s += Path(curve([[cx - 300, 182], [cx - 262, 165], [cx - 200, 158], [cx, 156], [cx + 200, 158], [cx + 262, 165], [cx + 300, 182]]) + 'Z', '#B9A98E', 'm');
  for (const [a, b, y] of [[-240, -60, 168], [40, 230, 167], [-150, 120, 174]]) s += Line(`M${cx + a},${y}Q${cx + (a + b) / 2},${y - 3} ${cx + b},${y + 1}`, 'lt', '#9A8A70', 2.5);
  // the tower, behind the Centre Block
  const tw = 24, y0 = 62;
  s += Rect(cx - tw, y0, tw * 2, 98, K.stone);
  s += Rect(cx + 9, y0 + 2.5, tw - 11.5, 93, K.stoneShade, 'n');
  s += Line(seg(cx - 15, y0 + 34, cx - 15, 156) + seg(cx + 15, y0 + 34, cx + 15, 156), 'lt');
  // belfry: two tall pointed openings; the clock in a pointed stone frame
  for (const dx of [-7.5, 7.5]) s += Path(`M${cx + dx - 4.5},${y0 + 62}L${cx + dx - 4.5},${y0 + 42}Q${cx + dx},${y0 + 32} ${cx + dx + 4.5},${y0 + 42}L${cx + dx + 4.5},${y0 + 62}Z`, '#5A4636', 'm');
  s += Path(`M${cx - 19},${y0 + 31}L${cx - 19},${y0 + 15}L${cx},${y0 + 1}L${cx + 19},${y0 + 15}L${cx + 19},${y0 + 31}Z`, K.stone, 'm');
  s += Circ(cx, y0 + 18, 11.5, '#FFF6DF', 'm');
  s += Line(`M${cx},${y0 + 18}L${cx},${y0 + 10}M${cx},${y0 + 18}L${cx + 6},${y0 + 20}`, 'lt');
  // corner pinnacles, the steep copper roof with its little dormer, the flag
  for (const dx of [-tw, tw]) s += Path(poly([[cx + dx - 5, y0 + 5], [cx + dx - 5, y0 - 4], [cx + dx, y0 - 24], [cx + dx + 5, y0 - 4], [cx + dx + 5, y0 + 5]]), K.stone, 'm');
  s += Path(poly([[cx - 22, y0 + 1], [cx, y0 - 50], [cx + 22, y0 + 1]]), K.copper);
  s += Path(poly([[cx + 0.5, y0 - 45.5], [cx + 19, y0 - 1.5], [cx + 1.5, y0 - 1.5]]), K.copperShade, 'n');
  s += Path(poly([[cx - 6.5, y0 - 3], [cx - 6.5, y0 - 14], [cx, y0 - 23], [cx + 6.5, y0 - 14], [cx + 6.5, y0 - 3]]), K.copperLight, 'm');
  s += Rect(cx - 2.4, y0 - 13, 4.8, 8, '#2F4A40', 'n');
  s += Line(seg(cx, y0 - 50, cx, y0 - 58), "l", INK, 3.5);
  s += Rect(cx + 1.8, y0 - 58, 21, 11.5, K.snow, 't') + Rect(cx + 1.8, y0 - 58, 5.5, 11.5, K.red, 't') + Rect(cx + 17.3, y0 - 58, 5.5, 11.5, K.red, 't');
  s += Circ(cx + 12.5, y0 - 52.3, 2.4, K.red, 'n');
  // the Centre Block in front of the tower's foot: stone, windows, green copper roof, pavilions
  const yr = 128, yf = 139, yg = 158;
  s += Rect(cx - 160, yf, 320, yg - yf, K.stone, 'm');
  for (let x = cx - 152; x < cx + 150; x += 11) for (const y of [143, 150]) if (Math.abs(x + 2 - cx) > 14) s += Rect(x, y, 4.5, 6.5, '#6A5442', 'n');
  s += Path(poly([[cx - 162, yf], [cx - 154, yr], [cx + 154, yr], [cx + 162, yf]]), K.copper, 'm');
  for (let x = cx - 140; x <= cx + 140; x += 28) if (Math.abs(x - cx) > 26) s += Path(poly([[x - 4.5, yf - 1], [x - 4.5, yr + 3], [x, yr - 3], [x + 4.5, yr + 3], [x + 4.5, yf - 1]]), K.stone, 't');
  for (const dx of [-160, -88, 88, 160]) {
    s += Rect(cx + dx - 13, yf - 6, 26, yg - yf + 6, K.stone, 'm');
    s += Path(poly([[cx + dx - 15, yf - 5], [cx + dx, yf - 32], [cx + dx + 15, yf - 5]]), K.copper, 'm');
    s += Line(seg(cx + dx, yf - 32, cx + dx, yf - 40), 'lt');
  }
  // the tower's foot: a stone bay with the entrance arch
  s += Rect(cx - 16, yr - 6, 32, yg - yr + 6, K.stone, 'm');
  s += Path(`M${cx - 7},${yg}L${cx - 7},${yg - 12}Q${cx},${yg - 22} ${cx + 7},${yg - 12}L${cx + 7},${yg}Z`, '#5A4636', 'm');
  // the Library of Parliament (left, nearer the river)
  const lx = cx - 130;
  s += Rect(lx - 25, 124, 50, 36, K.stone, 'm');
  for (const dx of [-17, -6, 6, 17]) s += Path(`M${lx + dx - 3},${152}L${lx + dx - 3},${138}Q${lx + dx},${133} ${lx + dx + 3},${138}L${lx + dx + 3},${152}Z`, '#6A5442', 'n');
  s += Path(`M${lx - 27},${125}Q${lx - 25},${101} ${lx},${93}Q${lx + 25},${101} ${lx + 27},${125}Z`, K.copper, 'm');
  s += Line(`M${lx - 12},${123}Q${lx - 10},${105} ${lx},${95}M${lx + 12},${123}Q${lx + 10},${105} ${lx},${95}`, 'lt');
  s += Rect(lx - 7, 79, 14, 15, K.stone, 'm') + Path(poly([[lx - 9, 80], [lx, 65], [lx + 9, 80]]), K.copper, 'm') + Line(seg(lx, 65, lx, 57), 'lt');
  // a few autumn trees on the ends of the cliff, leaving the river and the tower clear
  const cols = [K.maple, K.orange, K.gold, K.redOrange, '#D9452B'];
  for (const [a, b] of [[-300, -175], [180, 300]]) {
    for (let x = cx + a; x < cx + b; x += 22 + rnd() * 16) {
      const c3 = [cols[(rnd() * 5) | 0], cols[(rnd() * 5) | 0], cols[(rnd() * 5) | 0]];
      s += roundTree(x, 181 + rnd() * 4, 30 + rnd() * 12, c3, 0);
    }
  }
  return s;
};

/** Toronto: the CN Tower (tall concrete shaft, the main pod, the SkyPod, the antenna) among small skyscrapers. */
L.cnTower = (cx, sn) => {
  let s = '';
  // tower (drawn first: the buildings stand in front of its foot)
  s += Path(`M${cx - 17},206Q${cx - 8},150 ${cx - 6},96L${cx + 6},96Q${cx + 8},150 ${cx + 17},206Z`, K.concrete);
  s += Path(`M${cx + 1.5},97L${cx + 5},97Q${cx + 7},150 ${cx + 14.5},204L${cx + 2.5},204Z`, K.concreteShade, 'n');
  s += Line(seg(cx, 98, cx, 200), 'lt', '#8C8494', 2.2);
  // main pod
  s += Path(`M${cx - 6},98Q${cx - 22},94 ${cx - 28},85L${cx + 28},85Q${cx + 22},94 ${cx + 6},98Z`, K.concrete);
  s += Rect(cx - 29.5, 76, 59, 9.5, K.glassDark);
  s += Line(seg(cx - 22, 80.7, cx - 4, 80.7), 'lt', '#9DB9D6', 2.2) + Line(seg(cx + 6, 80.7, cx + 14, 80.7), 'lt', '#9DB9D6', 2.2);
  s += Path(`M${cx - 27},76Q${cx - 20},68.5 ${cx - 8},67L${cx + 8},67Q${cx + 20},68.5 ${cx + 27},76Z`, K.concrete);
  if (sn) s += Path(`M${cx - 22},71Q${cx - 12},65.5 ${cx},66Q${cx + 12},65.5 ${cx + 22},71Q${cx + 11},71.5 ${cx},69.8Q${cx - 11},71.5 ${cx - 22},71Z`, K.snow, 't');
  // upper shaft, SkyPod, antenna
  s += Rect(cx - 4, 45, 8, 23, K.concrete, 'm');
  s += Rect(cx - 9, 38, 18, 9, K.glassDark, 'm');
  s += Path(poly([[cx - 3.2, 39], [cx - 1.6, 7], [cx + 1.6, 7], [cx + 3.2, 39]]), K.concrete, 'm');
  s += Circ(cx, 5, 2.6, K.red, 'n');
  // skyscrapers, two each side
  const bld = (x, w, top, fill, kind) => {
    let b = Rect(x, top, w, 212 - top, fill, 'm');
    const lite = light(fill, 0.45);
    if (kind === 'glass') for (let y = top + 8; y < 200; y += 9) b += Line(seg(x + 4, y, x + w - 4, y), 'lt', lite, 2);
    if (kind === 'ribs') for (let xx = x + 5; xx < x + w - 2; xx += 5.5) b += Line(seg(xx, top + 5, xx, 205), 'lt', dark(fill, 0.1), 1.8);
    if (kind === 'dots') for (let y = top + 7; y < 200; y += 8) for (let xx = x + 4; xx < x + w - 4; xx += 6) b += Rect(xx, y, 3, 4, dark(fill, 0.35), 'n');
    if (sn) b += Path(`M${x - 1.5},${top + 1}Q${x + w / 2},${top - 5} ${x + w + 1.5},${top + 1}Q${x + w * 0.7},${top + 5} ${x + w / 2},${top + 2.5}Q${x + w * 0.3},${top + 5.5} ${x - 1.5},${top + 1}Z`, K.snow, 't');
    return b;
  };
  s += bld(cx - 71, 25, 120, '#86A9CF', 'glass') + bld(cx + 46, 25, 128, '#5E7896', 'glass');
  s += bld(cx - 50, 27, 146, '#CDB9A0', 'dots') + bld(cx + 20, 28, 108, '#E9E6E1', 'ribs');
  return s;
};

/** Leamington: the big red tomato kiosk with its green stem and service window. */
L.bigTomato = (cx) => {
  const k = 0.88, X = (dx) => r1(cx + dx * k);
  let s = Rect(cx - 40, 196, 80, 16, '#BDB6AA', 'm');
  const body = `M${X(0)},103C${X(18)},93 ${X(48)},93 ${X(60)},110C${X(73)},126 ${X(72)},180 ${X(42)},199` +
    `C${X(22)},210 ${X(-22)},210 ${X(-42)},199C${X(-72)},180 ${X(-73)},126 ${X(-60)},110C${X(-48)},93 ${X(-18)},93 ${X(0)},103Z`;
  s += Path(body, '#E3412F');
  s += Path(`M${X(30)},101C${X(50)},100 ${X(66)},116 ${X(66)},146C${X(66)},178 ${X(48)},197 ${X(18)},203` +
    `C${X(46)},186 ${X(56)},162 ${X(54)},140C${X(52)},120 ${X(44)},108 ${X(30)},101Z`, '#BE3127', 'n');
  s += Line(`M${X(-20)},102Q${X(-38)},140 ${X(-30)},196M${X(20)},102Q${X(36)},140 ${X(30)},196`, 'l', '#B02E25', 3);
  s += Ell(X(-37), 128, 13, 8.5, '#F57D63', 'n', -38) + Ell(X(-43), 121, 4.5, 3, '#FFFFFF', 'n', -38);
  // service window with a little striped awning
  s += Rect(cx - 24, 150, 48, 31, '#FFF3DC', 'm', 4) + Rect(cx - 18, 155, 36, 21, '#6B3626', 'n', 2);
  s += Line(seg(cx - 21, 171, cx + 21, 171), 'l');
  s += Path(`M${cx - 29},150L${cx - 25},139L${cx + 25},139L${cx + 29},150Z`, K.snow, 'm');
  for (const dx of [-20, -6.7, 6.7, 20]) s += Path(poly([[cx + dx - 3.4, 140.5], [cx + dx + 3.4, 140.5], [cx + dx + 4.3, 148.5], [cx + dx - 4.3, 148.5]]), '#4E9A3E', 'n');
  // the leafy top and the stem
  const leaf = [];
  const tips = [[-46, 112], [-30, 92], [-6, 108], [16, 90], [44, 108], [20, 116], [-20, 117]];
  tips.forEach(([dx, dy], i) => {
    const prev = tips[(i + tips.length - 1) % tips.length];
    leaf.push([cx + (dx + prev[0]) * 0.22 * k, 103 + (dy + prev[1] - 206) * 0.16], [cx + dx * k, dy]);
  });
  s += Path(poly(leaf), '#4E9A3E');
  s += Path(`M${cx - 4},104Q${cx - 6},86 ${cx + 4},70L${cx + 13},73Q${cx + 5},88 ${cx + 6},104Z`, '#3F8635');
  s += Ell(cx + 8.5, 71.5, 4.8, 2.6, '#7CC05E', 't', 18);
  return s;
};

/** Saskatoon: a tall wooden prairie grain elevator, barn red with white trim, snow on its roofs. */
L.grainElevator = (cx, sn) => {
  const red = '#B9422F', shade = '#983426', roof = '#6E6461';
  let s = '';
  // driveway shed (left) and office (right)
  s += Path(poly([[cx - 62, 212], [cx - 62, 162], [cx - 36, 152], [cx - 36, 212]]), red);
  s += Path(poly([[cx - 66, 164], [cx - 36, 151], [cx - 36, 157], [cx - 64, 169]]), roof, 'm');
  s += Rect(cx - 57, 173, 17, 39, '#8A2E22', 'm') + Line(`M${cx - 57},173L${cx - 40},212M${cx - 40},173L${cx - 57},212`, 'lt', K.snow, 2.5);
  s += Path(poly([[cx + 36, 212], [cx + 36, 170], [cx + 66, 180], [cx + 66, 212]]), red);
  s += Path(poly([[cx + 36, 167], [cx + 70, 178], [cx + 70, 183], [cx + 36, 173]]), roof, 'm');
  s += Rect(cx + 45, 187, 13, 12, K.snow, 'm') + Rect(cx + 48, 190, 7, 6, '#3D4A5C', 'n');
  // the crib
  s += Rect(cx - 36, 72, 72, 140, red);
  s += Rect(cx + 19, 74.5, 14.5, 135, shade, 'n');
  s += Rect(cx - 33.5, 74.5, 4, 135, '#F4EEE6', 'n') + Rect(cx + 29.5, 74.5, 4, 135, '#E4DAD0', 'n');
  for (const dx of [-12, 6]) s += Line(seg(cx + dx, 104, cx + dx, 208), 'lt', '#9C3628', 2);
  s += Rect(cx - 30, 82, 60, 16, K.snow, 'm');
  s += `<text x="${cx}" y="94.5" text-anchor="middle" font-family="Inter, DejaVu Sans, Arial, sans-serif" font-weight="900" font-size="12" fill="${red}" textLength="54" lengthAdjust="spacingAndGlyphs">SASKATOON</text>`;
  s += Rect(cx - 6, 118, 12, 14, K.snow, 'm') + Rect(cx - 3, 121, 6, 8, '#3D4A5C', 'n');
  // main roof and the headhouse
  s += Path(poly([[cx - 43, 76], [cx, 50], [cx + 43, 76]]), roof);
  if (sn) s += Path(`M${cx - 43},76L${cx},50L${cx + 43},76Q${cx + 34},79 ${cx + 26},74Q${cx + 14},80 ${cx + 2},74Q${cx - 12},80 ${cx - 24},74Q${cx - 34},80 ${cx - 43},76Z`, K.snow, 'm');
  s += Rect(cx - 15, 32, 30, 30, red);
  s += Rect(cx + 6, 34.5, 6.5, 26, shade, 'n');
  s += Rect(cx - 5.5, 40, 11, 12, K.snow, 'm') + Rect(cx - 2.5, 43, 5, 6, '#3D4A5C', 'n');
  s += Path(poly([[cx - 20, 35], [cx, 18], [cx + 20, 35]]), roof);
  if (sn) {
    s += Path(`M${cx - 20},35L${cx},18L${cx + 20},35Q${cx + 12},38 ${cx + 6},33.5Q${cx},38 ${cx - 6},33.5Q${cx - 12},38 ${cx - 20},35Z`, K.snow, 'm');
    s += Path(`M${cx - 66},164L${cx - 36},151L${cx - 36},155Q${cx - 48},161 ${cx - 54},159Q${cx - 60},165 ${cx - 66},164Z`, K.snow, 't');
    s += Path(`M${cx + 36},167L${cx + 70},178Q${cx + 60},181 ${cx + 52},176Q${cx + 44},177 ${cx + 36},172Z`, K.snow, 't');
  }
  return s;
};

/** Kelowna: Ogopogo in Okanagan Lake: two big humps with orange fins, a tall neck and a friendly head. */
L.ogopogo = (cx) => {
  const g = '#4FA35A', belly = '#C9E27E', fin = K.orange, wl = 193;
  let s = '';
  const bez = (u, a, b, c, d) => (1 - u) ** 3 * a + 3 * (1 - u) ** 2 * u * b + 3 * (1 - u) * u * u * c + u ** 3 * d;
  const hump = (x0, x1, h, t) => {
    const k = 1.33, top = wl - h * k;
    let f = '';
    for (const u of [0.24, 0.5, 0.76]) {
      const bx = bez(u, x0, x0, x1, x1), by = bez(u, wl, top, top, wl);
      f += Path(poly([[bx - 6.5, by + 3], [bx + (u - 0.5) * 6, by - 11], [bx + 6.5, by + 3]]), fin, 'm');
    }
    const d = `M${x0},${wl}C${x0},${top} ${x1},${top} ${x1},${wl}L${x1 - t},${wl}C${x1 - t},${wl - (h - t) * k} ${x0 + t},${wl - (h - t) * k} ${x0 + t},${wl}Z`;
    return f + Path(d, g) + Path(`M${x0 + t * 0.4},${wl - 4}C${x0 + t * 0.4},${wl - h * 0.98} ${x1 - t * 0.7},${wl - h * 1.08} ${x1 - t * 0.55},${wl - h * 0.62}`, 'none', 'l', `stroke:${light(g, 0.32)};stroke-width:3.5`);
  };
  s += hump(cx - 63, cx - 25, 36, 16) + hump(cx - 31, cx + 12, 46, 18);
  // fins down the back of the neck
  for (const [x, y, a] of [[cx + 15, 152, -0.5], [cx + 13, 128, -0.2], [cx + 18, 104, 0.25]]) s += Path(poly([[x + 2, y - 9], [x - 11, y + a * 8], [x + 2, y + 9]]), fin, 'm');
  // neck and head (facing right, towards the dial)
  s += Path(`M${cx + 12},${wl}C${cx + 6},${164} ${cx + 30},${142} ${cx + 21},${110}C${cx + 16},${92} ${cx + 22},${70} ${cx + 42},${66}` +
    `C${cx + 58},${63} ${cx + 71},${72} ${cx + 73},${84}C${cx + 74},${95} ${cx + 67},${99} ${cx + 59},${99}C${cx + 51},${99} ${cx + 47},${105} ${cx + 47},${114}` +
    `C${cx + 47},${140} ${cx + 37},${162} ${cx + 44},${wl}Z`, g);
  s += Path(`M${cx + 42},${wl - 1}C${cx + 36},${162} ${cx + 45},${140} ${cx + 44},${116}C${cx + 44},${108} ${cx + 47},${103} ${cx + 53},${101}` +
    `C${cx + 43},${108} ${cx + 39},${122} ${cx + 38},${136}C${cx + 36},${158} ${cx + 30},${172} ${cx + 33},${wl - 1}Z`, belly, 'n');
  // horns, eye, nostril, smile, cheek
  s += Path(`M${cx + 28},${74}C${cx + 22},${64} ${cx + 26},${55} ${cx + 32},${56}C${cx + 33},${62} ${cx + 33},${67} ${cx + 35},${70}Z`, K.gold, 'm');
  s += Path(`M${cx + 40},${67}C${cx + 39},${57} ${cx + 45},${51} ${cx + 50},${53}C${cx + 48},${58} ${cx + 47},${63} ${cx + 48},${67}Z`, K.gold, 'm');
  s += Circ(cx + 45, 80, 7, K.snow, 'm') + Circ(cx + 47, 80.5, 3.4, INK, 'n') + Circ(cx + 45.6, 78.6, 1.2, K.snow, 'n');
  s += Ell(cx + 67, 80, 1.8, 2.4, INK, 'n');
  s += Line(`M${cx + 52},${92}Q${cx + 61},${96} ${cx + 69},${90}`, 'l', INK, 3);
  s += Ell(cx + 57, 87, 3.8, 2.4, '#F08C7A', 'n');
  // splashes where the body meets the water
  for (const [a, b] of [[-68, -20], [-37, 18], [6, 50]]) s += Path(`M${cx + a},${wl + 1}Q${cx + (a + b) / 2},${wl - 6} ${cx + b},${wl + 1}Q${cx + (a + b) / 2},${wl + 6} ${cx + a},${wl + 1}Z`, K.snow, 'm');
  return s;
};

// ================================================================== second elements (centred at cx; within cx ± 50)
const S = {};

/** A snug red farmhouse with a snowy roof and a smoking chimney. */
S.farmhouse = (cx, sn) => {
  const red = '#C8432F';
  let s = '';
  const smoke = [[cx + 25, 82, 6], [cx + 19, 66, 8], [cx + 25, 48, 10], [cx + 15, 30, 12]];
  for (const [x, y, r] of smoke) s += Circ(x, y, r, K.snow, 'm');
  s += Rect(cx + 18, 90, 13, 32, '#9C3424', 'm');
  s += Rect(cx - 40, 130, 80, 80, red);
  s += Rect(cx + 20, 133, 17.5, 75, '#A9372A', 'n');
  s += Path(poly([[cx - 49, 134], [cx, 96], [cx + 49, 134]]), '#7A3A2C');
  if (sn) {
    s += Path(`M${cx - 49},134L${cx},96L${cx + 49},134Q${cx + 40},140 ${cx + 32},133Q${cx + 22},141 ${cx + 12},133Q${cx},141 ${cx - 12},133Q${cx - 24},141 ${cx - 34},133Q${cx - 42},140 ${cx - 49},134Z`, K.snow);
    s += Ell(cx + 24.5, 90, 9, 3.5, K.snow, 'm');
  }
  for (const [x, y] of [[cx - 27, 146], [cx + 9, 146], [cx - 27, 172]]) {
    s += Rect(x, y, 18, 16, K.yellow, 'm');
    s += Line(`M${x + 9},${y}L${x + 9},${y + 16}M${x},${y + 8}L${x + 18},${y + 8}`, 'lt');
  }
  s += Rect(cx + 7, 172, 16, 38, '#6C3024', 'm');
  s += Path(poly([[cx - 10, 125], [cx, 116], [cx + 10, 125], [cx + 10, 128], [cx - 10, 128]]), K.snow, 't');
  return s;
};

/** A Quebec sugar shack (cabane à sucre) with its roof vent steaming. */
S.sugarShack = (cx) => {
  const wood = '#9A6A3E', woodD = '#7A5232', roof = '#6B3F2E';
  let s = '';
  const steam = [[cx - 3, 88, 9], [cx + 9, 72, 11], [cx - 4, 55, 12], [cx + 10, 38, 13]];
  for (const [x, y, r] of steam) s += Circ(x, y, r, '#F6F4F0', 'm');
  s += Rect(cx - 40, 150, 80, 62, wood);
  for (let x = cx - 30; x < cx + 40; x += 10) s += Line(seg(x, 154, x, 210), 'lt', woodD, 2);
  s += Path(poly([[cx - 49, 154], [cx, 120], [cx + 49, 154]]), roof);
  s += Rect(cx - 17, 103, 34, 17, wood, 'm');
  for (const dx of [-8, 0, 8]) s += Line(seg(cx + dx, 106, cx + dx, 117), 'lt', woodD, 2);
  s += Path(poly([[cx - 22, 106], [cx, 93], [cx + 22, 106]]), roof, 'm');
  s += Rect(cx - 11, 172, 22, 40, woodD, 'm');
  s += Rect(cx + 18, 166, 14, 13, K.yellow, 'm');
  // firewood
  for (const [x, y] of [[cx - 36, 205], [cx - 25, 205], [cx - 30.5, 196]]) s += Circ(x, y, 5.6, K.tanLight, 'm') + Circ(x, y, 1.6, '#9C846C', 'n');
  return s;
};

/** Toronto City Hall: two curved towers around the white council saucer. */
S.cityHall = (cx, sn) => {
  let s = '';
  const tower = (x0, x1, top, flip) => {
    const inner = flip ? x0 : x1, outer = flip ? x1 : x0, bulge = flip ? 9 : -9;
    let t = Path(`M${outer},212L${outer},${top + 10}Q${outer},${top} ${(x0 + x1) / 2 + (flip ? 4 : -4)},${top - 1}L${inner},${top + 3}L${inner},212Z`, K.concrete, 'm');
    const gx0 = flip ? x0 + 3 : x0 + 9, gx1 = flip ? x1 - 9 : x1 - 3;
    t += Rect(gx0, top + 8, gx1 - gx0, 200 - top, '#9EC2E3', 'n');
    for (let y = top + 13; y < 205; y += 7) t += Line(seg(gx0, y, gx1, y), 'lt', '#E9F2FA', 1.6);
    t += Line(seg(outer + bulge * 0.15, top + 8, outer + bulge * 0.15, 206), 'lt', K.concreteShade, 2);
    if (sn) t += Path(`M${outer},${top + 9}Q${outer},${top - 1} ${(x0 + x1) / 2},${top - 2}L${inner},${top + 2}L${inner},${top + 5}Q${(x0 + x1) / 2},${top + 3} ${outer},${top + 11}Z`, K.snow, 't');
    return t;
  };
  s += tower(cx - 44, cx - 14, 126, false) + tower(cx + 14, cx + 46, 100, true);
  s += Rect(cx - 52, 194, 104, 18, K.concrete, 'm');
  s += Path(`M${cx - 26},${192}Q${cx},${168} ${cx + 26},${192}Z`, K.snow, 'm') + Rect(cx - 22, 190, 44, 5, '#8C8494', 'n');
  return s;
};

/** A glass greenhouse, gable end on, tomato vines inside. */
S.greenhouseGable = (cx) => {
  let s = '';
  const x0 = cx - 46, x1 = cx + 46, yw = 140;
  s += Path(poly([[x0, 212], [x0, yw], [cx - 23, 116], [cx, yw], [cx + 23, 116], [x1, yw], [x1, 212]]), K.glass);
  for (let x = x0 + 9; x < x1; x += 11.5) s += Path(`M${x},${208}L${x},${168}`, 'none', 'lt', 'stroke:#4E9A3E;stroke-width:6');
  for (let i = 0; i < 9; i++) s += Circ(x0 + 9 + (i % 8) * 11.5 + 3, 176 + ((i * 7) % 4) * 7, 3.2, '#E3412F', 'n');
  for (let x = x0 + 11.5; x < x1 - 2; x += 11.5) s += Line(seg(x, yw - (x < cx ? (x - x0) : (x1 - x)) * 0.5 * (x > cx - 23 && x < cx + 23 ? 0 : 1) - 2, x, 210), 'lt', K.snow, 2.4);
  s += Line(seg(x0, 168, x1, 168), 'lt', K.snow, 2.4);
  s += Line(`M${x0 + 6},${150}L${x0 + 24},${128}M${cx + 6},${156}L${cx + 30},${126}`, 'lt', '#F6FBFF', 3);
  s += Path(poly([[x0, 212], [x0, yw], [cx - 23, 116], [cx, yw], [cx + 23, 116], [x1, yw], [x1, 212]]), 'none', 'm');
  s += Line(seg(cx, yw, cx, 212), 'lt');
  return s;
};

/** Saskatoon: the Bessborough, the château on the river (beige brick, green copper roofs, turrets). */
S.bessborough = (cx, sn) => {
  const brick = '#EAD5AA', brickS = '#D3B98A', win = '#7A5E48';
  let s = '';
  const windows = (x0, x1, y0, y1, dx = 9, dy = 13) => {
    let w = '';
    for (let y = y0; y < y1; y += dy) for (let x = x0; x <= x1; x += dx) w += Rect(x - 1.8, y, 3.6, 6, win, 'n');
    return w;
  };
  // low wings either side, each with its own steep roof
  for (const sg of [-1, 1]) {
    const x = cx + sg * 40 - 11;
    s += Rect(x, 160, 22, 52, brick, 'm') + windows(x + 6, x + 16, 168, 205, 10);
    s += Path(poly([[x - 3, 161], [x + 5, 142], [x + 17, 142], [x + 25, 161]]), K.copper, 'm');
  }
  // central block: facade, a big steep hipped roof with two rows of dormers, a gabled centre bay
  s += Rect(cx - 30, 116, 60, 96, brick, 'm');
  s += Rect(cx + 16, 118.5, 11.5, 92, brickS, 'n');
  s += windows(cx - 22, cx + 22, 124, 204, 11);
  s += Path(poly([[cx - 34, 117], [cx - 20, 68], [cx + 20, 68], [cx + 34, 117]]), K.copper);
  s += Path(poly([[cx + 6, 70.5], [cx + 18, 70.5], [cx + 30.5, 114.5], [cx + 12, 114.5]]), K.copperShade, 'n');
  for (const [x, y, w] of [[cx - 24, 102, 10], [cx + 14, 102, 10], [cx - 14, 83, 8], [cx + 6, 83, 8]]) {
    s += Path(poly([[x, y + 11], [x, y + 3], [x + w / 2, y - 3], [x + w, y + 3], [x + w, y + 11]]), brick, 't');
    s += Rect(x + w / 2 - 1.8, y + 3, 3.6, 6, win, 'n');
  }
  s += Path(poly([[cx - 9, 118], [cx - 9, 98], [cx, 88], [cx + 9, 98], [cx + 9, 118]]), brick, 'm') + Rect(cx - 2.2, 100, 4.4, 8, win, 'n');
  s += Line(seg(cx - 20, 68, cx - 20, 60) + seg(cx + 20, 68, cx + 20, 60), 'lt');
  // round turrets with tall cones at the corners of the central block
  for (const sg of [-1, 1]) {
    const x = cx + sg * 31;
    s += Rect(x - 8, 110, 16, 102, brick, 'm') + windows(x, x, 118, 204, 9);
    s += Path(`M${x - 10},${111}Q${x - 5},${88} ${x},${57}Q${x + 5},${88} ${x + 10},${111}Z`, K.copper, 'm');
    s += Line(seg(x, 57, x, 49), 'lt');
  }
  if (sn) {
    s += Path(`M${cx - 34},117L${cx - 32},110Q${cx - 16},114 ${cx},111Q${cx + 16},114 ${cx + 32},110L${cx + 34},117Q${cx + 16},119 ${cx},116Q${cx - 16},119 ${cx - 34},117Z`, K.snow, 't');
    for (const sg of [-1, 1]) {
      const x = cx + sg * 31;
      s += Path(`M${x - 10},${111}L${x - 9},${105}Q${x},${108} ${x + 9},${105}L${x + 10},${111}Q${x},${113} ${x - 10},${111}Z`, K.snow, 't');
      const wx = cx + sg * 40 - 11;
      s += Path(`M${wx - 3},161L${wx - 1},156Q${wx + 11},159 ${wx + 23},156L${wx + 25},161Q${wx + 11},163 ${wx - 3},161Z`, K.snow, 't');
    }
  }
  return s;
};

/** A sailboat on the lake. */
S.sailboat = (cx) => {
  let s = Line(seg(cx, 96, cx, 182), 'l', INK, 3.5);
  s += Path(poly([[cx + 3, 100], [cx + 3, 176], [cx + 40, 176]]), K.snow);
  s += Path(poly([[cx - 3, 110], [cx - 3, 174], [cx - 31, 174]]), K.cream);
  s += Path(poly([[cx + 1.5, 96], [cx + 14, 100], [cx + 1.5, 104]]), K.red, 't');
  s += Path(`M${cx - 40},178L${cx + 46},178Q${cx + 38},192 ${cx + 28},194L${cx - 30},194Q${cx - 36},188 ${cx - 40},178Z`, K.red);
  s += Line(seg(cx - 35, 185, cx + 40, 185), 'lt', K.snow, 3);
  s += Path(`M${cx - 48},${196}Q${cx},${190} ${cx + 50},${196}Q${cx},${201} ${cx - 48},${196}Z`, K.snow, 't');
  return s;
};

// ================================================================== decorations (the rest of the strip)
// FAR ones stand behind the near bank (and the trees); the others in front of it.
const D = {};
const FAR = new Set(['skyline', 'farElevators', 'winery']);
D.lobsterBoat = (rnd, season) => {
  const x = 2470, y = 186;
  let s = Path(`M${x - 46},${y - 12}L${x + 50},${y - 12}Q${x + 44},${y + 4} ${x + 34},${y + 5}L${x - 36},${y + 5}Q${x - 42},${y - 2} ${x - 46},${y - 12}Z`, K.snow);
  s += Line(seg(x - 42, y - 5, x + 46, y - 5), 'l', K.red, 4);
  s += Rect(x - 6, y - 34, 30, 22, K.snow, 'm') + Rect(x - 1, y - 29, 9, 8, '#3D4A5C', 'n') + Rect(x + 11, y - 29, 9, 8, '#3D4A5C', 'n');
  s += Path(poly([[x - 10, y - 34], [x - 4, y - 40], [x + 26, y - 40], [x + 28, y - 34]]), K.red, 'm');
  s += Line(seg(x - 26, y - 12, x - 26, y - 52), 'l') + Line(seg(x - 26, y - 46, x - 6, y - 40), 'lt');
  return s;
};
D.skyline = (rnd, season) => {
  // low distant downtown around the CN Tower (most of it under the HUD)
  let s = '';
  const tones = ['#B9C6DE', '#A9B7D4', '#C7D1E6'];
  for (let x = 1210; x < 1730; x += 18 + rnd() * 16) {
    if (x > LM - 78 && x < LM + 76) continue;
    const w = 16 + rnd() * 14, h = 22 + rnd() * 40;
    s += Rect(x, 196 - h, w, h + 16, tones[(rnd() * 3) | 0], 't');
  }
  return s;
};
function greenhouseBlock(x0, x1, top, base) {
  const bw = 26, bh = 11;
  let d = `M${x0},${base}L${x0},${top}`;
  for (let x = x0; x < x1 - 1; x += bw) d += `L${Math.min(x1, x + bw / 2)},${top - bh}L${Math.min(x1, x + bw)},${top}`;
  d += `L${x1},${base}Z`;
  let s = Path(d, K.glass, 'm');
  s += Rect(x0 + 2, top + 18, x1 - x0 - 4, base - top - 18, '#9CC97A', 'n');
  for (let x = x0 + 7; x < x1 - 4; x += 13) s += Circ(x, top + 26 + ((x * 7) % 3) * 4, 2.6, '#E3412F', 'n');
  for (let x = x0 + bw / 2; x < x1; x += bw / 2) s += Line(seg(x, x % bw === x0 % bw ? top : top, x, base - 2), 'lt', '#F4F9FD', 1.8);
  s += Line(seg(x0, top + 14, x1, top + 14), 'lt', '#F4F9FD', 1.8);
  return s + Path(d, 'none', 'm');
}
D.greenhouses = () => greenhouseBlock(880, 1350, 162, 212) + greenhouseBlock(1600, 1930, 166, 212) + greenhouseBlock(2700, 2960, 170, 212);
D.broadwayBridge = (rnd) => {
  const x0 = 2210, x1 = 2700, deck = 170;
  let s = '';
  for (let x = x0; x < x1; x += 70) {
    s += Path(`M${x},${198}Q${x + 35},${158} ${x + 70},${198}L${x + 64},${198}Q${x + 35},${168} ${x + 6},${198}Z`, K.concrete, 'm');
    for (const dx of [12, 24, 46, 58]) s += Line(seg(x + dx, deck + 6, x + dx, deck + 6 + Math.abs(35 - dx) * 0.55), 'lt');
  }
  s += Rect(x0 - 10, deck, x1 - x0 + 20, 8, K.concrete, 'm');
  s += Rect(x0 - 10, deck - 3, x1 - x0 + 20, 3, K.snow, 't');
  return s;
};
D.farElevators = () => {
  let s = '';
  for (const [x, k] of [[620, 0.42], [2930, 0.5], [3330, 0.36]]) {
    const w = 72 * k, h = 140 * k, b = 172;
    s += Rect(x - w / 2, b - h, w, h, '#B9A8B8', 't') + Rect(x - w * 0.2, b - h - 30 * k, w * 0.4, 30 * k, '#B9A8B8', 't');
    s += Path(poly([[x - w / 2 - 3, b - h + 2], [x, b - h - 22 * k], [x + w / 2 + 3, b - h + 2]]), K.snow, 't');
  }
  return s;
};
D.winery = () => {
  // a small Okanagan winery with a bell tower, on the hill east of the lake
  const x = 2590, b = 140;
  let s = Rect(x - 34, b - 22, 52, 26, '#F4EBDD', 'm') + Path(poly([[x - 38, b - 21], [x - 28, b - 32], [x + 12, b - 32], [x + 22, b - 21]]), '#C8643C', 'm');
  for (const dx of [-24, -12, 0]) s += Rect(x + dx, b - 15, 5, 8, '#7A5E48', 'n');
  s += Rect(x + 18, b - 58, 16, 62, '#E9DFCC', 'm') + Path(poly([[x + 15, b - 57], [x + 26, b - 74], [x + 37, b - 57]]), '#C8643C', 'm');
  s += Path(`M${x + 22},${b - 40}L${x + 22},${b - 48}Q${x + 26},${b - 53} ${x + 30},${b - 48}L${x + 30},${b - 40}Z`, '#5A4636', 'n');
  return s;
};

// ================================================================== the scene behind the fence
let clipN = 0;
/** A golden hill with vine rows following its top (clipped to the hill), and a few trees on it. */
function vineHill(rnd, pts, { fill = '#E2BE68', vine = '#5E9A3E', gap = 10 } = {}) {
  const id = `hill${++clipN}`, last = pts[pts.length - 1][0];
  const d = curve(pts) + `L${r1(last)},312L${r1(pts[0][0])},312Z`;
  let s = `<clipPath id="${id}"><path d="${d}"/></clipPath>` + Path(d, fill, 't');
  s += `<g clip-path="url(#${id})">`;
  for (let k = 1; k < 12; k++) s += Line(curve(pts.map(([x, y]) => [x, y + 6 + k * gap])), 'lt', vine, 4.5);
  return s + '</g>' + Path(d, 'none', 't');
}
function scene(rnd, c, season) {
  const sc = c.scene, sn = c.snow ?? season.snow;
  let s = '';
  const lows = [];
  if (sc.kind === 'coast') {
    s += waterBody(rnd, sc.sea - 40, 3720, sc.horizon);
    s += rolling(rnd, { fill: '#C3CDE8', pts: [[-150, 110], [150, 96], [420, 112], [700, 98], [960, 114], [1140, 130], [1270, 150], [1330, 168], [1380, 210]] });
    s += rolling(rnd, { fill: K.snowBlue, pts: [[-150, 140], [200, 126], [520, 140], [860, 128], [1100, 144], [1250, 162], [1340, 182], [1400, 220]] });
    s += distantTrees(rnd, 128, season.distant, [[0, 1100]]);
    lows.push([sc.sea + 60, 3720]);
  } else if (sc.kind === 'river') {
    s += mountainRange(rnd, { top: 70, bottom: 118, snow: false, shade: true, step: [420, 640], spread: 26 });
    s += rolling(rnd, { y: sc.bank, amp: 16, fill: '#D3A764' });
    for (const col of ['#E0873F', '#D9583A', '#E8B54C']) s += distantTrees(rnd, sc.bank - 8, col, [[0, 3600]], 0.014);
    s += waterBody(rnd, sc.from, sc.to, sc.waterTop);
    lows.push([sc.from + 80, sc.to - 80]);
  } else if (sc.kind === 'plain' || sc.kind === 'prairie') {
    s += rolling(rnd, { y: sc.horizon, amp: sc.kind === 'prairie' ? 3 : 7, fill: season.far, step: [300, 500] });
    if (sc.lake) s += waterBody(rnd, sc.lake[0], sc.lake[1], sc.horizon + 4) + Path(curve([[sc.lake[0] - 60, sc.horizon + 30], [sc.lake[0] + 30, sc.horizon + 6], [sc.lake[0] + 60, sc.horizon + 30]]) + 'Z', season.far, 'n');
    s += distantTrees(rnd, sc.horizon - 4, season.distant, [[0, 3600]], sc.kind === 'prairie' ? 0.012 : 0.024);
    if (sc.ice) { s += waterBody(rnd, sc.ice[0], sc.ice[1], 184, { ice: true }); lows.push([sc.ice[0] + 60, sc.ice[1] - 60]); }
  } else if (sc.kind === 'lake') {
    s += mountainRange(rnd, { top: 34, bottom: 112, snow: false, shade: true, step: [360, 560], spread: 36 });
    s += mountainRange(rnd, { top: 92, bottom: 140, snow: false, shade: false, fill: '#C3C2DC', step: [300, 420], spread: 20 });
    s += waterBody(rnd, -100, 3700, sc.top);
    s += vineHill(rnd, [[-150, 132], [180, 118], [480, 132], [760, 122], [1000, 136], [1180, 150], [sc.from - 40, 172], [sc.from + 30, 200], [sc.from + 60, 240]]);
    s += vineHill(rnd, [[sc.to - 60, 240], [sc.to - 30, 200], [sc.to + 40, 168], [sc.to + 220, 140], [2700, 126], [2980, 132], [3260, 118], [3500, 128], [3760, 120]]);
    lows.push([sc.from + 40, sc.to - 40]);
  }
  return { svg: s, lows, sn };
}

// ================================================================== a whole band
function bandSvg(id) {
  const c = CITIES[id], season = SEASONS[c.season], rnd = rng(c.seed);
  const { svg: back, lows, sn } = scene(rnd, c, season);
  let s = back;
  for (const d of c.decor || []) if (FAR.has(d)) s += D[d](rnd, season);
  s += nearBank(rnd, season.near, lows);
  for (const d of c.decor || []) if (!FAR.has(d)) s += D[d](rnd, season);
  s += L[c.landmark](LM, sn, rnd);
  if (c.second) s += S[c.second](SL, sn, rnd);
  // trees: a back row and a near row, kept off the landmark, the second element and the city's own clear spots
  const keep = [[LM - 92, LM + 92], [SL - 62, SL + 62], ...(c.keep || [])];
  const free = (x, hw) => !keep.some(([a, b]) => x + hw > a && x - hw < b);
  const mixKinds = Object.entries(c.trees);
  const pick = () => { let r = rnd(); for (const [k, p] of mixKinds) { if ((r -= p) <= 0) return k; } return mixKinds[0][0]; };
  const trees = [];
  for (const row of [{ base: 196, h: [48, 70], gap: [50, 150] }, { base: 216, h: [92, 132], gap: [70, 190] }]) {
    for (let x = -40; x < 3640; x += lerp(row.gap[0], row.gap[1], rnd())) {
      const kind = pick(), h = lerp(row.h[0], row.h[1], rnd()), hw = kind === 'pine' ? h * 0.42 : h * 0.47;
      if (!free(x, hw) || rnd() < 0.18) continue;
      trees.push({ x, kind, h, base: row.base + rnd() * 5, col: rnd() });
    }
  }
  trees.sort((a, b) => a.base - b.base);
  for (const t of trees) {
    s += t.kind === 'pine'
      ? pine(t.x, t.base, t.h, season.pines[(t.col * season.pines.length) | 0], sn)
      : roundTree(t.x, t.base, t.h, season.crowns[(t.col * season.crowns.length) | 0], sn);
  }
  s += fence(rnd, sn >= 1);
  s += ground(rnd, season.ground, c.leaves ?? (season.ground === 'leaves' ? 60 : 0));
  const css = `.o{stroke:${INK};stroke-width:5;stroke-linejoin:round;stroke-linecap:round}.m{stroke:${INK};stroke-width:3.5;stroke-linejoin:round;stroke-linecap:round}` +
    `.t{stroke:${INK};stroke-width:2.5;stroke-linejoin:round;stroke-linecap:round}.n{stroke:none}` +
    `.l,.lt,.lo{fill:none;stroke:${INK};stroke-linecap:round;stroke-linejoin:round}.l{stroke-width:3.5}.lt{stroke-width:2.5}.lo{stroke-width:5}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><style>${css}</style>${s}</svg>`;
}

// ================================================================== render: SVG -> PNG (Chromium) -> WebP (Pillow)
const PY_WEBP = `
import sys
from PIL import Image
src, dst, q = sys.argv[1], sys.argv[2], int(sys.argv[3])
im = Image.open(src).convert('RGBA')
assert im.size == (3600, 300), im.size
im.save(dst, 'WEBP', quality=q, method=6, alpha_quality=100, exact=False)
`;
const PY_PREVIEW = `
import sys, json
from PIL import Image, ImageDraw, ImageFont
rows = json.loads(sys.argv[2])
# game size on a 2x phone: the band shows 960 CSS px wide, 80 tall -> 1920x160 device px; slice f 0.33..0.67
SCALE = 1920 / 3600
x0, x1 = int(0.33 * 3600), int(0.67 * 3600)
sw, sh = round((x1 - x0) * SCALE), 160
pad, lab, field = 14, 30, 18
try:
    font = ImageFont.truetype('/usr/share/fonts/opentype/inter/Inter-SemiBold.otf', 15)
except Exception:
    font = ImageFont.load_default()
out = Image.new('RGB', (sw + 2 * pad, pad + len(rows) * (lab + sh + field + pad)), (246, 243, 236))
d = ImageDraw.Draw(out)
y = pad
for r in rows:
    band = Image.open(r['png']).convert('RGBA').crop((x0, 0, x1, 300)).resize((sw, sh), Image.LANCZOS)
    sky = Image.new('RGBA', (sw, sh + field), (0, 0, 0, 255))
    sd = ImageDraw.Draw(sky)
    for (a, b, c) in [(0, 0.34, (139, 189, 232)), (0.34, 0.64, (160, 202, 238)), (0.64, 1.0, (182, 215, 243))]:
        sd.rectangle((0, int(a * sh), sw, int(b * sh)), fill=c + (255,))
    sky.alpha_composite(band, (0, 0))
    # the game's field covers the band from y 270 of 300
    sd = ImageDraw.Draw(sky)
    fy = int(270 / 300 * sh)
    sd.rectangle((0, fy, sw, sh + field), fill=tuple(r['field']) + (255,))
    out.paste(sky.convert('RGB'), (pad, y + lab))
    d.text((pad, y + 2), r['label'], fill=(43, 23, 7), font=font)
    # always-visible gap (f 0.385..0.425) and the second slot (f 0.55..0.58)
    for (fa, fb, col) in [(0.385, 0.425, (214, 69, 48)), (0.55, 0.58, (48, 125, 88))]:
        xa = pad + round((fa * 3600 - x0) * SCALE); xb = pad + round((fb * 3600 - x0) * SCALE)
        yy = y + lab - 6
        d.line((xa, yy, xb, yy), fill=col, width=3)
        d.line((xa, yy - 3, xa, yy + 3), fill=col, width=2); d.line((xb, yy - 3, xb, yy + 3), fill=col, width=2)
    y += lab + sh + field + pad
out.save(sys.argv[1])
`;

async function main() {
  const { chromium } = require('playwright');
  fs.mkdirSync(BUILD, { recursive: true });
  const ids = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const todo = ids.length ? ids : Object.keys(CITIES);
  for (const id of todo) if (!CITIES[id]) throw new Error(`no row for ${id}`);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  for (const id of todo) {
    const svg = bandSvg(id), svgPath = path.join(BUILD, `${id}.svg`), png = path.join(BUILD, `${id}.png`), webp = path.join(HERE, `${id}.webp`);
    fs.writeFileSync(svgPath, svg);
    await page.setContent(`<!doctype html><html><head><style>html,body{margin:0;background:transparent}svg{display:block}</style></head><body>${svg}</body></html>`);
    await page.screenshot({ path: png, omitBackground: true, clip: { x: 0, y: 0, width: W, height: H } });
    let q = 90;
    for (;;) {
      execFileSync('python3', ['-c', PY_WEBP, png, webp, String(q)]);
      if (fs.statSync(webp).size <= 195 * 1024 || q <= 60) break;
      q -= 5;
    }
    console.log(`${id}: ${webp} ${(fs.statSync(webp).size / 1024).toFixed(0)} KB (q ${q})`);
  }
  await browser.close();
  const rows = Object.keys(CITIES).filter((id) => fs.existsSync(path.join(BUILD, `${id}.png`))).map((id) => {
    const c = CITIES[id], season = SEASONS[c.season];
    const field = season.ground === 'snow' ? [232, 236, 240] : [120, 85, 58];
    const words = (k) => k.replace(/([A-Z])/g, ' $1').toLowerCase();
    const label = `${c.name} (${id}):  ${words(c.landmark)}${c.second ? '  +  ' + words(c.second) : ''}  ·  ${c.season}${c.snow === 1 ? ', light snow' : ''}`;
    return { png: path.join(BUILD, `${id}.png`), label, field };
  });
  execFileSync('python3', ['-c', PY_PREVIEW, path.join(HERE, 'preview.png'), JSON.stringify(rows)]);
  console.log('preview:', path.join(HERE, 'preview.png'));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
