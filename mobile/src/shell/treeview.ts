// The upgrade tree's screen (0.13: the game's one upgrade system). The whole map from src/game/tree.ts on a dusk sky,
// to pan (the map scrolls) and zoom, with a card for the chosen node. A player buys upgrades every evening, so it
// opens centred on the trunk with every node that can be bought now ringed in gold, the trunk's card lists them, and
// a node's card has one big Buy button with the price. Pure render functions; GameApp owns the state and the clicks.

import { t } from '../i18n/i18n';
import {
  BRANCHES, TREE, TREE_WORKSHOP, buildingNode, canBuyNode, nodeDuration, treeHasAny, treeLevel, treeNode, type BuyCheck, type TreeBranch, type TreeNode,
} from '../game/tree';
import { formatDuration, upgradeDef } from '../game/workshop';
import type { GameSave } from '../game/progress';
import { glyphPath } from './treeglyphs';
import { ICON, esc, money } from './dom';

const COL: Record<string, string> = {
  blade: '#FF6B57', power: '#B48CFF', reach: '#5FB4FF', field: '#6CD07A', market: '#FFC23D', ranch: '#E5A56C', bridge: '#CFC6B8', trunk: '#FFC23D',
};
export const TREE_ZOOMS = [620, 820, 1100];

/** What the screen needs besides the save. */
export interface TreeUi {
  sel: string;
  zoom: number;
  resetArmed: boolean;
  /** Everything a node can be bought with now: tree credit, savings and the farm's cash above its mark. */
  money: number;
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

/** A small tree: the sign of tree credit (it buys upgrades only). */
export function creditIcon(size = 18): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22V13" stroke="#2B1708" stroke-width="3.4" stroke-linecap="round"/><path d="M12 2.5c4.6 0 7.5 3 7.5 6.6 0 3.4-3 5.9-7.5 5.9s-7.5-2.5-7.5-5.9c0-3.6 2.9-6.6 7.5-6.6Z" fill="#6DBE45" stroke="#2B1708" stroke-width="2.2" stroke-linejoin="round"/><circle cx="12" cy="9" r="2.6" fill="#FFC23D" stroke="#2B1708" stroke-width="1.6"/></svg>`;
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
}

function view(g: GameSave, n: TreeNode, ui: TreeUi, building: string | null): View {
  const chk = canBuyNode(g, n);
  return { have: treeLevel(g, n.id), chk, ready: chk.ok && chk.cost <= ui.money, building: building === n.id };
}

function nodeSvg(n: TreeNode, v: View, sel: string): string {
  const [x, y] = P[n.id];
  const col = n.kind === 'bridge' ? COL.bridge : COL[n.branch];
  const have = v.have > 0;
  const fill = have ? col : '#221A38';
  const ink = have || n.kind === 'key' || n.kind === 'trunk' ? '#161126' : '#FFF1D6';
  // a node that is out of reach (locked, its partner owned, not built yet) is dimmed
  const far = !have && !v.building && !v.chk.ok && (v.chk.why === 'locked' || v.chk.why === 'pair' || v.chk.why === 'soon');
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
  const cls = `tr-nd${v.ready ? ' ready' : ''}${far ? ' far' : ''}${have ? ' own' : ''}`;
  // a clear circle makes the node easy to hit with a thumb
  return `<g class="${cls}" data-act="tree-node" data-arg="${n.id}" role="button" aria-label="${esc(t(n.name))}"><circle cx="${x}" cy="${y}" r="26" fill="transparent"/><g class="tr-art">${halo}${shape}${icon}</g>${buy}${clock}${lv}</g>`;
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
    action = `<button type="button" class="st-btn tr-buy${v.ready ? ' gold' : ' off'}" data-act="tree-buy" data-arg="${n.id}" ${v.ready ? '' : 'disabled'}><span>${esc(t('Buy'))}</span><b>${money(chk.cost)}</b>${dur}</button>`;
  } else if (chk.why === 'busy') {
    const dur = nodeDuration(n, have);
    action = `<button type="button" class="st-btn tr-buy off" disabled><span>${esc(t('Building…'))}</span><b>${money(chk.cost || 0)}</b><small>${ICON.clock(12)}${formatDuration(dur)}</small></button>`;
  } else {
    const why: Record<string, string> = {
      soon: t('Coming soon.'), max: have && n.levels > 1 ? t('Maxed') : '', pair: t('You own its partner keystone.'), locked: t('Buy a node next to it first.'),
    };
    if (why[chk.why]) action = `<p class="tr-small">${esc(why[chk.why])}</p>`;
  }
  const pair = n.pair && !have ? `<p class="tr-small">${esc(t('Or {name}: you can own one of the two.', { name: t(treeNode(n.pair)!.name) }))}</p>` : '';
  return `<div class="tr-card">
    <span class="tr-kind"><i style="background:${col}"></i>${esc(where)}</span>
    <div class="tr-head">${glyph(n, 30, col)}<h3>${esc(t(n.name))}</h3></div>
    <p>${esc(t(n.effect))}</p>${pair}
    ${state ? `<div class="tr-meta">${state}</div>` : ''}
    ${action}
  </div>`;
}

/** The tree screen: the map (it scrolls; + and - zoom) and the chosen node's card. */
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
  const nodes = TREE.map(n => nodeSvg(n, view(g, n, ui, building), sel)).join('');
  const px = TREE_ZOOMS[Math.max(0, Math.min(TREE_ZOOMS.length - 1, ui.zoom))];
  const credit = g.treeCredit || 0, cash = Math.max(0, ui.money - credit);
  const job = g.workshop.job;
  const jobChip = job && building
    ? `<button type="button" class="tr-chip tr-jobchip" data-act="tree-pick" data-arg="${building}" aria-label="${esc(t('Building…'))}">${ICON.clock(15)}<span id="dbdTreeJob">${formatDuration(job.endsAt - ui.now)}</span></button>`
    : '';
  return `<div class="tr-wrap">
    <div class="tr-top"><button type="button" class="st-btn st-sq" data-act="tree-back" aria-label="${t('Back')}">${ICON.back()}</button>
      <h2>${t('Upgrades')}</h2>
      <div class="tr-chips">${credit > 0 ? `<span class="tr-chip tr-credit" aria-label="${esc(t('Tree credit {amt}: it buys upgrades only', { amt: money(credit) }))}">${creditIcon(18)}<span>${short(credit)}</span></span>` : ''}<span class="tr-chip tr-cash" aria-label="${esc(t('Cash for upgrades {amt}', { amt: money(cash) }))}">${ICON.coin(18)}<span>${short(cash)}</span></span>${jobChip}</div>
      ${treeHasAny(g) ? `<button type="button" class="st-btn btn-sm tr-reset${ui.resetArmed ? ' red' : ''}" data-act="tree-reset"${ui.resetArmed ? ` aria-label="${esc(t('Tap again to reset'))}"` : ''}>${esc(ui.resetArmed ? t('Sure?') : t('Reset'))}</button>` : ''}
      <div class="tr-zoom"><button type="button" class="st-btn st-sq" data-act="tree-zoom" data-arg="-1" aria-label="${t('Zoom out')}">−</button><button type="button" class="st-btn st-sq" data-act="tree-zoom" data-arg="1" aria-label="${t('Zoom in')}">+</button></div></div>
    <div class="tr-body">
      <div class="tr-map" id="dbdTreeMap"><svg viewBox="0 0 1000 1000" width="${px}" height="${px}" role="img" aria-label="${t('Upgrade tree')}">${rings}${labels}${links}${nodes}</svg></div>
      ${cardHtml(g, treeNode(sel)!, ui, building)}
    </div>
  </div>`;
}

/** Keep the chosen node in view after a redraw (the map scrolls). */
export function centerTree(root: HTMLElement, sel: string, zoom: number): void {
  const box = root.querySelector<HTMLElement>('#dbdTreeMap');
  if (!box) return;
  const px = TREE_ZOOMS[Math.max(0, Math.min(TREE_ZOOMS.length - 1, zoom))];
  const [x, y] = P[sel] || P.trunk;
  box.scrollLeft = (x / 1000) * px - box.clientWidth / 2;
  box.scrollTop = (y / 1000) * px - box.clientHeight / 2;
}
