// The upgrade tree in the game (0.13 preview, Navid 5 Nov: "try to make it"): the whole map from src/game/tree.ts on
// a dusk sky, to pan (the map scrolls) and zoom, with a card for the chosen node. It shows what the player already
// has: the Workshop levels on the level tracks, and learned skills on their nodes. Buying in the tree comes with 0.13.

import { t } from '../i18n/i18n';
import { BRANCHES, TREE, TREE_SKILL, TREE_WORKSHOP, canBuyNode, type TreeNode, type TreeBranch } from '../game/tree';
import type { GameSave } from '../game/progress';
import { glyphPath } from './treeglyphs';
import { esc } from './dom';

const COL: Record<string, string> = {
  blade: '#FF6B57', power: '#B48CFF', reach: '#5FB4FF', field: '#6CD07A', market: '#FFC23D', ranch: '#E5A56C', bridge: '#CFC6B8', trunk: '#FFC23D',
};
const TRACK_LEVEL = TREE_WORKSHOP;
const SKILL_OF = TREE_SKILL;
export const TREE_ZOOMS = [620, 820, 1100];

const byId: Record<string, TreeNode> = {};
for (const n of TREE) byId[n.id] = n;
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

/** What the player has of a node today: a level (tracks), 1 (owned), or 0. */
export function treeHave(g: GameSave, n: TreeNode): number {
  if (n.kind === 'trunk') return 1;
  const w = TRACK_LEVEL[n.id];
  if (w) return (g.workshop.levels as unknown as Record<string, number>)[w] || 0;
  const bought = (g.tree && g.tree[n.id]) || 0;
  const s = SKILL_OF[n.id];
  return Math.max(bought, s && g.skills.includes(s) ? 1 : 0);
}

function money(v: number): string {
  return v >= 1e6 ? '$' + (v / 1e6).toFixed(v % 1e6 ? 1 : 0) + 'M' : v >= 1000 ? '$' + Math.round(v / 1000) + 'k' : '$' + v;
}

function nodeSvg(g: GameSave, n: TreeNode, sel: string): string {
  const [x, y] = P[n.id];
  const col = n.kind === 'bridge' ? COL.bridge : COL[n.branch];
  const have = treeHave(g, n) > 0;
  const fill = have ? col : '#221A38';
  const ink = have || n.kind === 'key' || n.kind === 'trunk' ? '#161126' : '#FFF1D6';
  let shape = '', size = 20;
  if (n.kind === 'trunk') {
    shape = `<circle cx="${x}" cy="${y}" r="29" fill="${COL.trunk}" stroke="#161126" stroke-width="3"/>`;
    size = 30;
  } else if (n.kind === 'track') {
    shape = `<rect x="${x - 21}" y="${y - 21}" width="42" height="42" rx="12" fill="${fill}" stroke="${col}" stroke-width="3"/>`;
    size = 24;
  } else if (n.kind === 'key') {
    const h = 27;
    shape = `<path d="M${x} ${y - h} L${x + h} ${y} L${x} ${y + h} L${x - h} ${y} Z" fill="${col}" stroke="#161126" stroke-width="3" opacity="${have ? 1 : 0.85}"/>`;
    size = 24;
  } else if (n.kind === 'bridge') {
    shape = `<circle cx="${x}" cy="${y}" r="16" fill="${fill}" stroke="${COL[n.between![0]]}" stroke-width="3" stroke-dasharray="12.6 12.6"/><circle cx="${x}" cy="${y}" r="16" fill="none" stroke="${COL[n.between![1]]}" stroke-width="3" stroke-dasharray="12.6 12.6" stroke-dashoffset="12.6"/>`;
    size = 18;
  } else {
    shape = `<circle cx="${x}" cy="${y}" r="19" fill="${fill}" stroke="${col}" stroke-width="2.5"/>`;
    if (n.levels > 1) for (let k = 0; k < n.levels; k++) shape += `<circle cx="${x + (k - (n.levels - 1) / 2) * 7}" cy="${y + 26}" r="2.2" fill="${col}"/>`;
  }
  const halo = n.id === sel ? `<circle cx="${x}" cy="${y}" r="${n.kind === 'key' ? 36 : n.kind === 'trunk' ? 38 : 29}" fill="none" stroke="#FFF1D6" stroke-width="3"/>` : '';
  const icon = `<g transform="translate(${x - size / 2} ${y - size / 2}) scale(${size / 24})"><path d="${glyphPath(n.glyph)}" fill="none" stroke="${ink}" stroke-width="${n.kind === 'trunk' || n.kind === 'key' ? 2.1 : 1.8}" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  return `<g class="tr-nd" data-act="tree-node" data-arg="${n.id}" role="button" aria-label="${esc(n.name)}">${halo}${shape}${icon}</g>`;
}

/** The way from a node back to the trunk (lit up when it is chosen). */
function wayHome(id: string): Set<string> {
  const on = new Set<string>(['trunk']);
  let n: TreeNode | undefined = byId[id];
  while (n && n.kind !== 'trunk') {
    on.add(n.id);
    n = byId[n.parents[0]];
  }
  return on;
}

function cardHtml(g: GameSave, n: TreeNode): string {
  const col = n.kind === 'bridge' ? COL.bridge : COL[n.branch];
  const where = n.kind === 'trunk' ? t('Trunk') : n.kind === 'bridge'
    ? `${t(BRANCHES[bIndex[n.between![0]]].name)} + ${t(BRANCHES[bIndex[n.between![1]]].name)}`
    : t(BRANCHES[bIndex[n.branch as TreeBranch]].name);
  const have = treeHave(g, n);
  let state: string;
  if (n.kind === 'trunk') state = t('Yours from the start');
  else if (n.kind === 'track') state = t('Level {n} of {m}', { n: have, m: n.levels });
  else if (have >= n.levels) state = t('Yours');
  else if (have) state = t('Level {n} of {m}', { n: have, m: n.levels });
  else state = t('Not yours yet');
  // what the player can do here (0.13 preview: today's skills and ten new tricks can be bought)
  const chk = n.kind === 'trunk' ? null : canBuyNode(n, id => (byId[id] ? treeHave(g, byId[id]) : 0));
  const why: Record<string, string> = {
    workshop: t('Upgrade it in the farmhouse.'), soon: t('Coming in 0.13.'), max: '', pair: t('You own its partner keystone.'),
    locked: t('Buy a node next to it first.'),
  };
  const action = !chk ? '' : chk.ok
    ? `<button type="button" class="st-btn gold btn-sm tr-buy" data-act="tree-buy" data-arg="${n.id}">${esc(t('Buy for {amt}', { amt: money(chk.cost) }))}</button>`
    : why[chk.why] ? `<p class="tr-small">${esc(why[chk.why])}</p>` : '';
  const price = n.kind === 'trunk' ? '' : n.kind === 'track' ? `${t('from')} ${money(n.price[0])}` : n.price.map(money).join(' · ');
  const pair = n.pair ? `<p class="tr-small">${esc(t('Or {name}: you can own one of the two.', { name: byId[n.pair].name }))}</p>` : '';
  return `<div class="tr-card">
    <span class="tr-kind"><i style="background:${col}"></i>${esc(where)}</span>
    <div class="tr-head"><svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true"><path d="${glyphPath(n.glyph)}" fill="none" stroke="${col}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><h3>${esc(n.name)}</h3></div>
    <p>${esc(n.effect)}</p>${pair}
    <div class="tr-meta"><b class="${have ? 'own' : ''}">${esc(state)}</b>${price ? `<b>${esc(price)}</b>` : ''}</div>
    ${action}
  </div>`;
}

/** The tree screen: the map (it scrolls; + and - zoom) and the chosen node's card. */
export function treeMapHtml(g: GameSave, sel: string, zoom: number): string {
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
  const nodes = TREE.map(n => nodeSvg(g, n, sel)).join('');
  const owned = TREE.filter(n => n.kind !== 'trunk' && treeHave(g, n) > 0).length;
  const px = TREE_ZOOMS[Math.max(0, Math.min(TREE_ZOOMS.length - 1, zoom))];
  return `<div class="tr-wrap">
    <div class="tr-top"><button type="button" class="st-btn st-sq" data-act="tree-back" aria-label="${t('Back')}">${backIcon()}</button>
      <div class="tr-titles"><h2>${t('Upgrade tree')}</h2><p>${t('{n} nodes · you have {m} · savings {amt}', { n: TREE.length, m: owned, amt: money(Math.round(g.wallet || 0)) })}</p></div>
      <div class="tr-zoom"><button type="button" class="st-btn st-sq" data-act="tree-zoom" data-arg="-1" aria-label="${t('Zoom out')}">−</button><button type="button" class="st-btn st-sq" data-act="tree-zoom" data-arg="1" aria-label="${t('Zoom in')}">+</button></div></div>
    <div class="tr-body">
      <div class="tr-map" id="dbdTreeMap"><svg viewBox="0 0 1000 1000" width="${px}" height="${px}" role="img" aria-label="${t('Upgrade tree')}">${rings}${labels}${links}${nodes}</svg></div>
      ${cardHtml(g, byId[sel] || byId.trunk)}
    </div>
  </div>`;
}

function backIcon(): string {
  return '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 L8 12 L15 19" fill="none" stroke="#2B1708" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
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
