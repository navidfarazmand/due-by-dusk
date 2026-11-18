// The upgrade tree's screen (0.13: the game's one upgrade system). The whole map from src/game/tree.ts on a dusk sky,
// to pan (the map scrolls) and zoom, with a card for the chosen node. A player buys upgrades every evening, so it
// opens centred on the trunk with every node that can be bought now ringed in gold, the trunk's card lists them, and
// a node's card has one big Buy button with the price. Pure render functions; GameApp owns the state and the clicks.
// 0.13.1 (Navid, 14 Nov): one money, gold (tree credit is gone); a node not next to one you own is locked: a padlock,
// faded, and no name or effect until it is next in line; no reset.

import { lang, t } from '../i18n/i18n';
import {
  BRANCHES, TREE, TREE_WORKSHOP, buildingNode, canBuyNode, nodeDuration, nodeText, treeLevel, treeNode, wayOpen, type BuyCheck, type TreeBranch, type TreeNode,
} from '../game/tree';
import { formatDuration, upgradeDef } from '../game/workshop';
import type { GameSave } from '../game/progress';
import { glyphPath } from './treeglyphs';
import { ICON, esc, money } from './dom';

const COL: Record<string, string> = {
  blade: '#FF6B57', power: '#B48CFF', reach: '#5FB4FF', field: '#6CD07A', market: '#FFC23D', ranch: '#E5A56C', bridge: '#CFC6B8', trunk: '#FFC23D',
};
/** The map's size in CSS pixels (it is square): where it opens and how big a pinch can make it. The smallest is the
 *  size that shows the whole tree (treeFitPx). 0.15.1: any size between, by pinching (treezoom.ts). */
export const TREE_PX = { start: 820, max: 1600 };
/** The − and + buttons zoom by this much. */
export const TREE_STEP = 1.35;

/** What the screen needs besides the save. */
export interface TreeUi {
  sel: string;
  /** The map's size in CSS pixels. */
  px: number;
  /** The whole tree in one view (0.15.1): no card, the buttons float on the map. */
  full?: boolean;
  /** Everything a node can be bought with now: savings and the farm's cash above its mark. */
  money: number;
  /** The node just bought: it and the Buy button pop once. */
  bought?: string;
  /** A rewarded ad is loaded for "Finish now". */
  ad: boolean;
  now: number;
}

const bIndex: Record<string, number> = {};
BRANCHES.forEach((b, i) => (bIndex[b.id] = i));

const C = 500, R0 = 40, STEP = 52, LAT = 52;
function pos(n: TreeNode): [number, number] {
  if (n.kind === 'trunk') return [C, C];
  const r = R0 + STEP * n.d;
  const axis = -Math.PI / 2 + (n.kind === 'bridge' ? bIndex[n.between![0]] : bIndex[n.branch]) * (Math.PI / 3);
  const a = n.kind === 'bridge' ? axis + Math.PI / 6 : axis + (n.s * LAT) / r;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
}
const P: Record<string, [number, number]> = {};
for (const n of TREE) P[n.id] = pos(n);

/** A padlock in the tree's 24-unit glyph box (a locked node). */
const LOCK_PATH = 'M7.5 11V8.2a4.5 4.5 0 0 1 9 0V11 M5.5 11h13v9.5h-13z M12 14.6v2.6';

/** A node is open when it is the trunk, owned, being built, or next to one you own (a node not built yet does not shut
 *  the way: wayOpen). Only open nodes show what they are. */
export function nodeOpen(g: GameSave, n: TreeNode, building: string | null): boolean {
  return n.kind === 'trunk' || treeLevel(g, n.id) > 0 || building === n.id || wayOpen(g, n);
}

/** Short money for the map and the lists ($12k); the Buy button shows the exact price. */
function short(v: number): string {
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(v % 1e6 ? 1 : 0).replace(/\.0$/, '') + 'M';
  if (v >= 10000) return '$' + Math.round(v / 1000) + 'k';
  return money(v);
}

interface View {
  have: number;
  chk: BuyCheck;
  /** Can be bought right now with the money at hand. */
  ready: boolean;
  building: boolean;
  /** Next to a node you own (or owned): its name, effect and price can be seen. */
  open: boolean;
}

function view(g: GameSave, n: TreeNode, ui: TreeUi, building: string | null): View {
  const chk = canBuyNode(g, n);
  return { have: treeLevel(g, n.id), chk, ready: chk.ok && chk.cost <= ui.money, building: building === n.id, open: nodeOpen(g, n, building) };
}

/** A locked node: its outline only, faded, with a padlock instead of its sign. */
function lockedSvg(n: TreeNode, sel: string): string {
  const [x, y] = P[n.id];
  const col = n.kind === 'bridge' ? COL.bridge : COL[n.branch];
  const r = n.kind === 'key' ? 24 : n.kind === 'track' ? 21 : n.kind === 'bridge' ? 16 : 19;
  const shape = n.kind === 'key'
    ? `<path d="M${x} ${y - r} L${x + r} ${y} L${x} ${y + r} L${x - r} ${y} Z" fill="#221A38" stroke="${col}" stroke-width="2.5"/>`
    : n.kind === 'track'
      ? `<rect x="${x - r}" y="${y - r}" width="${r * 2}" height="${r * 2}" rx="12" fill="#221A38" stroke="${col}" stroke-width="2.5"/>`
      : `<circle cx="${x}" cy="${y}" r="${r}" fill="#221A38" stroke="${col}" stroke-width="2.5"/>`;
  const s = n.kind === 'bridge' ? 14 : 18;
  const halo = n.id === sel ? `<circle cx="${x}" cy="${y}" r="${r + 9}" fill="none" stroke="#FFF1D6" stroke-width="3" opacity=".6"/>` : '';
  return `<g class="tr-nd locked" data-act="tree-node" data-arg="${n.id}" role="button" aria-label="${esc(t('Locked'))}"><circle cx="${x}" cy="${y}" r="26" fill="transparent"/><g class="tr-art">${halo}${shape}<g transform="translate(${x - s / 2} ${y - s / 2}) scale(${s / 24})"><path d="${LOCK_PATH}" fill="none" stroke="#FFF1D6" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></g></g></g>`;
}

function nodeSvg(n: TreeNode, v: View, sel: string, bought?: string): string {
  if (!v.open) return lockedSvg(n, sel);
  const [x, y] = P[n.id];
  const col = n.kind === 'bridge' ? COL.bridge : COL[n.branch];
  const have = v.have > 0;
  const fill = have ? col : '#221A38';
  const ink = have || n.kind === 'key' || n.kind === 'trunk' ? '#161126' : '#FFF1D6';
  // next in line but out of reach (its partner owned, not built yet) is dimmed
  const far = !have && !v.building && !v.chk.ok && (v.chk.why === 'pair' || v.chk.why === 'soon');
  let shape = '', size = 20, ring = 27;
  if (n.kind === 'trunk') {
    shape = `<circle cx="${x}" cy="${y}" r="29" fill="${COL.trunk}" stroke="#161126" stroke-width="3"/>`;
    size = 30;
    ring = 38;
  } else if (n.kind === 'track') {
    shape = `<rect x="${x - 21}" y="${y - 21}" width="42" height="42" rx="12" fill="${fill}" stroke="${col}" stroke-width="3"/>`;
    size = 24;
    ring = 31;
  } else if (n.kind === 'key') {
    const h = 27;
    shape = `<path d="M${x} ${y - h} L${x + h} ${y} L${x} ${y + h} L${x - h} ${y} Z" fill="${col}" stroke="#161126" stroke-width="3" opacity="${have ? 1 : 0.85}"/>`;
    size = 24;
    ring = 34;
  } else if (n.kind === 'bridge') {
    shape = `<circle cx="${x}" cy="${y}" r="16" fill="${fill}" stroke="${COL[n.between![0]]}" stroke-width="3" stroke-dasharray="12.6 12.6"/><circle cx="${x}" cy="${y}" r="16" fill="none" stroke="${COL[n.between![1]]}" stroke-width="3" stroke-dasharray="12.6 12.6" stroke-dashoffset="12.6"/>`;
    size = 18;
    ring = 24;
  } else {
    shape = `<circle cx="${x}" cy="${y}" r="19" fill="${fill}" stroke="${col}" stroke-width="2.5"/>`;
    if (n.levels > 1)
      for (let k = 0; k < n.levels; k++)
        shape += `<circle cx="${x + (k - (n.levels - 1) / 2) * 7}" cy="${y + 26}" r="2.2" fill="${k < v.have ? '#FFF1D6' : col}" opacity="${k < v.have ? 1 : 0.55}"/>`;
  }
  const halo = n.id === sel ? `<circle cx="${x}" cy="${y}" r="${ring + 2}" fill="none" stroke="#FFF1D6" stroke-width="3"/>` : '';
  const icon = `<g transform="translate(${x - size / 2} ${y - size / 2}) scale(${size / 24})"><path d="${glyphPath(n.glyph)}" fill="none" stroke="${ink}" stroke-width="${n.kind === 'trunk' || n.kind === 'key' ? 2.1 : 1.8}" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  // a track shows its level, on the corner across from the "+"
  const lx = x - ring * 0.72, ly = y - ring * 0.72;
  const lv = n.kind === 'track' && v.have > 0
    ? `<g><rect x="${lx - 12}" y="${ly - 8.5}" width="24" height="17" rx="8.5" fill="#161126" stroke="${col}" stroke-width="1.5"/><text x="${lx}" y="${ly + 4.2}" text-anchor="middle" font-size="12" fill="#FFF1D6">${v.have}</text></g>`
    : '';
  // for sale and affordable now: a gold ring that breathes and a gold "+" on the corner
  const buy = v.ready
    ? `<circle class="tr-ring" cx="${x}" cy="${y}" r="${ring}" fill="none" stroke="#FFD36A" stroke-width="3.5"/><g class="tr-plus"><circle cx="${x + ring * 0.72}" cy="${y - ring * 0.72}" r="9" fill="#FFC23D" stroke="#161126" stroke-width="2"/><path d="M${x + ring * 0.72 - 4.5} ${y - ring * 0.72} h9 M${x + ring * 0.72} ${y - ring * 0.72 - 4.5} v9" stroke="#161126" stroke-width="2.4" stroke-linecap="round"/></g>`
    : '';
  const clock = v.building
    ? `<g><circle cx="${x + ring * 0.72}" cy="${y - ring * 0.72}" r="9" fill="#FFF1D6" stroke="#161126" stroke-width="2"/><path d="M${x + ring * 0.72} ${y - ring * 0.72 - 4.5} v4.5 l3 2" fill="none" stroke="#161126" stroke-width="2" stroke-linecap="round"/></g>`
    : '';
  const cls = `tr-nd${v.ready ? ' ready' : ''}${far ? ' far' : ''}${have ? ' own' : ''}${bought === n.id ? ' bought' : ''}`;
  // a clear circle makes the node easy to hit with a thumb
  // just bought: a gold burst behind it (the node itself pops, see .tr-nd.bought)
  const burst = bought === n.id ? `<circle class="tr-burst" cx="${x}" cy="${y}" r="${ring}" fill="none" stroke="#FFD36A" stroke-width="5"/>` : '';
  return `<g class="${cls}" data-act="tree-node" data-arg="${n.id}" role="button" aria-label="${esc(t(n.name))}"><circle cx="${x}" cy="${y}" r="26" fill="transparent"/>${burst}<g class="tr-art" style="transform-origin: ${x}px ${y}px">${halo}${shape}${icon}</g>${buy}${clock}${lv}</g>`;
}

/** The way from a node back to the trunk (lit up when it is chosen). */
function wayHome(id: string): Set<string> {
  const on = new Set<string>(['trunk']);
  let n = treeNode(id);
  while (n && n.kind !== 'trunk') {
    on.add(n.id);
    n = treeNode(n.parents[0]);
  }
  return on;
}

function glyph(n: TreeNode, size: number, col: string): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="${glyphPath(n.glyph)}" fill="none" stroke="${col}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/** The build in progress: a bar, the time left and (while an ad is loaded) "Finish now". */
function jobHtml(g: GameSave, ui: TreeUi): string {
  const job = g.workshop.job;
  if (!job) return '';
  const left = job.endsAt - ui.now;
  const pct = Math.max(0, Math.min(1, 1 - left / Math.max(1, job.endsAt - job.startedAt)));
  const ad = ui.ad ? `<button type="button" class="ad-chip tr-fin" data-act="ad-finish">${ICON.play()}<span>${t('Finish now')}</span></button>` : '';
  return `<div class="tr-build" id="dbdJob"><span class="jb-track"><i style="width: ${(pct * 100).toFixed(1)}%"></i></span><span class="jb-left">${ICON.clock(13)} ${formatDuration(left)}</span></div>${ad}`;
}

/** The trunk's card: what can be bought right now (or, with nothing in reach, the cheapest things to save for). */
function listHtml(g: GameSave, ui: TreeUi, building: string | null): string {
  const rows: Array<{ n: TreeNode; cost: number; ready: boolean }> = [];
  for (const n of TREE) {
    const c = canBuyNode(g, n);
    if (c.ok) rows.push({ n, cost: c.cost, ready: c.cost <= ui.money });
  }
  rows.sort((a, b) => a.cost - b.cost);
  const ready = rows.filter(r => r.ready);
  const show = ready.length ? ready : rows.slice(0, 5);
  const list = show
    .map(r => {
      const col = COL[r.n.branch] || COL.bridge;
      const lv = r.n.kind === 'track' ? ` <small>${treeLevel(g, r.n.id) + 1}</small>` : '';
      return `<button type="button" class="tr-row${r.ready ? ' ready' : ''}" data-act="tree-pick" data-arg="${r.n.id}">${glyph(r.n, 22, col)}<span>${esc(t(r.n.name))}${lv}</span><b>${short(r.cost)}</b></button>`;
    })
    .join('');
  const job = building ? `<div class="tr-jobline">${jobHtml(g, ui)}</div>` : '';
  return `<div class="tr-card tr-list">
    <span class="tr-kind"><i style="background:${COL.trunk}"></i>${esc(ready.length ? t('Ready to buy') : t('Save up for'))}</span>
    ${job}<div class="tr-rows">${list}</div></div>`;
}

function cardHtml(g: GameSave, n: TreeNode, ui: TreeUi, building: string | null): string {
  if (n.kind === 'trunk') return listHtml(g, ui, building);
  const col = n.kind === 'bridge' ? COL.bridge : COL[n.branch];
  const where = n.kind === 'bridge'
    ? `${t(BRANCHES[bIndex[n.between![0]]].name)} + ${t(BRANCHES[bIndex[n.between![1]]].name)}`
    : t(BRANCHES[bIndex[n.branch as TreeBranch]].name);
  const v = view(g, n, ui, building);
  // locked: nothing about it until a neighbour is owned
  if (!v.open)
    return `<div class="tr-card tr-lockcard">
    <div class="tr-head">${ICON.lock('#FFF1D6', 26)}<h3>${esc(t('Locked'))}</h3></div>
    <p class="tr-small">${esc(t('Buy a node next to it first.'))}</p>
  </div>`;
  const have = v.have;
  // where the player stands: a track's number now and after the next level, a trick's level, or "Yours"
  let state = '';
  const w = TREE_WORKSHOP[n.id];
  if (w) {
    const d = upgradeDef(w);
    state = have >= n.levels
      ? `<b class="own">${esc(t('Lv {n}', { n: have }))}</b><b>${esc(d.value(have))} ${esc(t(d.unit))}</b>`
      : `<b class="${have ? 'own' : ''}">${esc(t('Lv {n}', { n: have }))}</b><b>${esc(d.value(have))} → ${esc(d.value(have + 1))} ${esc(t(d.unit))}</b>`;
  } else if (n.levels > 1) state = `<b class="${have ? 'own' : ''}">${esc(t('Level {n} of {m}', { n: have, m: n.levels }))}</b>`;
  else if (have) state = `<b class="own">${esc(t('Yours'))}</b>`;
  const chk = v.chk;
  let action = '';
  if (v.building) action = jobHtml(g, ui);
  else if (chk.ok) {
    const dur = chk.dur ? `<small>${ICON.clock(12)}${formatDuration(chk.dur)}</small>` : '';
    action = `<button type="button" class="st-btn tr-buy${v.ready ? ' gold' : ' off'}${ui.bought === n.id ? ' bought' : ''}" data-act="tree-buy" data-arg="${n.id}" ${v.ready ? '' : 'disabled'}><span>${esc(t('Buy'))}</span><b>${money(chk.cost)}</b>${dur}</button>`;
  } else if (chk.why === 'busy') {
    const dur = nodeDuration(n, have);
    action = `<button type="button" class="st-btn tr-buy off" disabled><span>${esc(t('Building…'))}</span><b>${money(chk.cost || 0)}</b><small>${ICON.clock(12)}${formatDuration(dur)}</small></button>`;
  } else {
    const why: Record<string, string> = {
      soon: t('Coming soon.'), max: have && n.levels > 1 ? t('Maxed') : '', pair: t('You own its partner keystone.'),
    };
    if (why[chk.why]) action = `<p class="tr-small">${esc(why[chk.why])}</p>`;
  }
  const pair = n.pair && !have ? `<p class="tr-small">${esc(t('Or {name}: you can own one of the two.', { name: t(treeNode(n.pair)!.name) }))}</p>` : '';
  return `<div class="tr-card">
    <span class="tr-kind"><i style="background:${col}"></i>${esc(where)}</span>
    <div class="tr-head">${glyph(n, 30, col)}<h3>${esc(t(n.name))}</h3></div>
    <p>${esc(effectLine(n, n.kind === 'trick' ? Math.min(n.levels, have + 1) : 1))}</p>${pair}
    ${state ? `<div class="tr-meta">${state}</div>` : ''}
    ${action}
  </div>`;
}

/** What a node does at a level, in the player's language: only that level's number (Navid, 15 Nov). */
function effectLine(n: TreeNode, level: number): string {
  const x = nodeText(n, level);
  if (x.v == null) return t(x.text);
  const loc = ({ en: 'en-US', fr: 'fr-FR', es: 'es-ES', pt: 'pt-BR', de: 'de-DE' } as const)[lang()];
  return t(x.text, { v: x.v.toLocaleString(loc) });
}

/** Four corners out (full screen) or in (back). */
function fullIcon(full: boolean): string {
  const d = full
    ? 'M9 4v5H4 M15 4v5h5 M9 20v-5H4 M15 20v-5h5'
    : 'M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5';
  return `<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/** The tree screen: the map (drag it, pinch it, or − and +; full screen shows it all) and the chosen node's card. */
export function treeMapHtml(g: GameSave, ui: TreeUi): string {
  const sel = treeNode(ui.sel) ? ui.sel : 'trunk';
  const building = buildingNode(g);
  const on = wayHome(sel);
  let links = '';
  for (const n of TREE) {
    for (const p of n.parents) {
      const [x1, y1] = P[p], [x2, y2] = P[n.id];
      const lit = on.has(p) && on.has(n.id);
      links += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(255,194,61,.09)" stroke-width="10" stroke-linecap="round"/>` +
        `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${lit ? '#FFD36A' : 'rgba(255,194,61,.34)'}" stroke-width="3" stroke-linecap="round"${n.kind === 'bridge' ? ' stroke-dasharray="6 7"' : ''}/>`;
    }
    if (n.pair && n.id < n.pair) {
      const [x1, y1] = P[n.id], [x2, y2] = P[n.pair];
      links += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(255,194,61,.34)" stroke-width="3" stroke-dasharray="3 8" stroke-linecap="round"/>`;
    }
  }
  let rings = '';
  for (let d = 1; d <= 7; d++) rings += `<circle cx="${C}" cy="${C}" r="${R0 + STEP * d}" fill="none" stroke="#FFF1D6" stroke-width="1" opacity=".07" stroke-dasharray="2 7"/>`;
  const labels = BRANCHES.map((b, i) => {
    const a = -Math.PI / 2 + i * (Math.PI / 3), r = R0 + STEP * 7 + 58;
    return `<text x="${C + r * Math.cos(a)}" y="${C + r * Math.sin(a) + 9}" text-anchor="middle" font-size="26" fill="${COL[b.id]}">${esc(t(b.name))}</text>`;
  }).join('');
  const nodes = TREE.map(n => nodeSvg(n, view(g, n, ui, building), sel, ui.bought)).join('');
  const px = Math.round(Math.max(120, Math.min(TREE_PX.max, ui.px || TREE_PX.start)));
  const job = g.workshop.job;
  const jobChip = job && building
    ? `<button type="button" class="tr-chip tr-jobchip" data-act="tree-pick" data-arg="${building}" aria-label="${esc(t('Building…'))}">${ICON.clock(15)}<span id="dbdTreeJob">${formatDuration(job.endsAt - ui.now)}</span></button>`
    : '';
  const full = !!ui.full;
  const fullBtn = `<button type="button" class="st-btn st-sq tr-full" data-act="tree-full" aria-label="${esc(t(full ? 'Exit full screen' : 'Full screen'))}" aria-pressed="${full}">${fullIcon(full)}</button>`;
  return `<div class="tr-wrap${full ? ' full' : ''}">
    <div class="tr-top"><button type="button" class="st-btn st-sq tr-back" data-act="tree-back" aria-label="${t('Back')}">${ICON.back()}</button>
      <h2>${t('Skills')}</h2>
      <div class="tr-chips"><span class="tr-chip tr-cash" aria-label="${esc(t('Cash for upgrades {amt}', { amt: money(ui.money) }))}">${ICON.coin(18)}<span>${short(ui.money)}</span></span>${jobChip}</div>
      <div class="tr-zoom"><button type="button" class="st-btn st-sq" data-act="tree-zoom" data-arg="-1" aria-label="${t('Zoom out')}">−</button><button type="button" class="st-btn st-sq" data-act="tree-zoom" data-arg="1" aria-label="${t('Zoom in')}">+</button>${fullBtn}</div></div>
    <div class="tr-body">
      <div class="tr-map" id="dbdTreeMap"><svg viewBox="0 0 1000 1000" width="${px}" height="${px}" role="img" aria-label="${t('Upgrade tree')}">${rings}${labels}${links}${nodes}</svg></div>
      ${full ? '' : cardHtml(g, treeNode(sel)!, ui, building)}
    </div>
  </div>`;
}

/** Keep the chosen node in view after a redraw (the map scrolls). */
export function centerTree(root: HTMLElement, sel: string, px: number): void {
  const box = root.querySelector<HTMLElement>('#dbdTreeMap');
  if (!box) return;
  const [x, y] = P[sel] || P.trunk;
  box.scrollLeft = (x / 1000) * px - box.clientWidth / 2;
  box.scrollTop = (y / 1000) * px - box.clientHeight / 2;
}

/** The size that shows the whole tree in the map's box (the smallest a pinch goes). */
export function treeFitPx(root: HTMLElement): number {
  const box = root.querySelector<HTMLElement>('#dbdTreeMap');
  if (!box) return TREE_PX.start;
  return Math.max(120, Math.floor(Math.min(box.clientWidth, box.clientHeight)));
}

/** Resize the map's SVG in place (a pinch redraws nothing else). */
export function sizeTree(root: HTMLElement, px: number): void {
  const svg = root.querySelector<SVGSVGElement>('#dbdTreeMap svg');
  if (!svg) return;
  const v = String(Math.round(px));
  svg.setAttribute('width', v);
  svg.setAttribute('height', v);
}
