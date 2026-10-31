// Screens around the route: the skill map, the Bling Barn (looks only), the daily farm and the duel.
// Pure render functions; GameApp owns the state and the clicks.

import { SKILLS, BRANCH_NAME, diamondsEarned, diamondsLeft, reqsMet, revealed, canLearn, skillDef, type Branch, type SkillDef } from '../game/skills';
import { FLAIR, FLAIR_KINDS, flairById, type FlairItem, type FlairKind } from '../game/flair';
import { MEDAL_NAME, MEDAL_RIBBONS, medalOf, type SideDef, type DailyState } from '../game/daily';
import { ROUTE, cityById, countryOf } from '../game/world';
import { toolDef, type ToolId } from '../game/tools';
import type { GameSave } from '../game/progress';
import { ART, PREVIEW, bandFor } from './art';
import { ICON, TOOL_ICON, INK, esc, money } from './dom';
import { barnPreview, flairIcon, ribbonIcon, skillGlyph } from './looks';
import { inner, lang, t, tn } from '../i18n/i18n';

const LOCALE = { en: 'en-US', fr: 'fr-FR', es: 'es-ES', pt: 'pt-BR', de: 'de-DE' } as const;

export const BRANCH_COL: Record<Branch, string> = { core: '#FFF4DC', reap: '#F07A62', soil: '#6DBE45', gold: '#FFC23D' };

/** Node size on the map: the core is biggest, the three-diamond capstones next. */
function radius(d: SkillDef): number {
  if (!d.reqs.length) return 26;
  return d.cost >= 3 ? 23 : d.cost === 1 ? 20 : 18;
}

// a fixed sprinkle of stars behind the map
const STARS = (() => {
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  let out = '';
  for (let i = 0; i < 90; i++)
    out += `<circle cx="${(r() * 844).toFixed(0)}" cy="${(r() * 390).toFixed(0)}" r="${(0.7 + r() * 1).toFixed(1)}" fill="#FFF4DC" opacity="${(0.25 + r() * 0.55).toFixed(2)}"/>`;
  return out;
})();

export function skillMapHtml(g: GameSave, sel: string): string {
  const learned = (id: string) => g.skills.includes(id);
  let links = '';
  for (const d of SKILLS) {
    if (!revealed(g, d)) continue;
    for (const r of d.reqs) {
      const a = skillDef(r)!;
      const both = learned(r) && learned(d.id);
      const open = learned(r) && !learned(d.id);
      if (!both && !open && !revealed(g, a)) continue;
      const st = both
        ? `stroke="${BRANCH_COL[d.branch]}" stroke-width="5"`
        : open
          ? `stroke="#FFF4DC" stroke-width="3" stroke-dasharray="2 7" opacity=".9"`
          : `stroke="#7D6FB8" stroke-width="2.5" opacity=".55"`;
      links += `<line x1="${a.x}" y1="${a.y}" x2="${d.x}" y2="${d.y}" ${st} stroke-linecap="round"/>`;
    }
  }
  let nodes = '';
  let clouds = '';
  for (const d of SKILLS) {
    const r = radius(d);
    if (!revealed(g, d)) {
      clouds += `<img class="sk-cloud" src="${ART.cloud}" alt="" style="left: ${d.x - 36}px; top: ${d.y - 21}px; width: 72px">`;
      continue;
    }
    const own = learned(d.id);
    const ready = !own && reqsMet(g, d);
    const state = own ? 'own' : ready ? 'ready' : 'dim';
    const label = `${t(d.name)}, ${own ? t('learned') : ready ? `${t('ready')}, ${tn(d.cost, '{n} diamond', '{n} diamonds')}` : t('locked')}`;
    nodes += `<button type="button" class="sk-node ${state}${sel === d.id ? ' sel' : ''}" data-act="skill" data-arg="${d.id}" aria-label="${esc(label)}" aria-pressed="${sel === d.id}"
      style="left: ${d.x - r}px; top: ${d.y - r}px; width: ${2 * r}px; height: ${2 * r}px; --c: ${BRANCH_COL[d.branch]}">${skillGlyph(d.id, Math.round(r * 1.08))}</button>`;
  }
  const labels = `<span class="sk-lbl" style="left: 92px; top: 221px; color: ${BRANCH_COL.reap}">${t('REAP')}</span>
    <span class="sk-lbl" style="left: 391px; top: 184px; color: ${BRANCH_COL.soil}">${t('SOIL')}</span>
    <span class="sk-lbl" style="left: 397px; top: 232px; color: ${BRANCH_COL.gold}">${t('FORTUNE')}</span>`;
  const left = diamondsLeft(g), earned = diamondsEarned(g);
  return `<div class="bg fit sk-map"><svg class="sk-sky" viewBox="0 0 844 390" width="844" height="390" aria-hidden="true">${STARS}${links}</svg>${labels}${nodes}${clouds}</div>
    <div class="grp tl" style="width: 330px; height: 64px"><button type="button" class="st-btn st-sq top-btn" data-act="back" aria-label="${t('Back')}">${ICON.back()}</button>
      <div class="sk-titles"><h2>${t('Skill map')}</h2><p>${t('Win a farm, earn a diamond. Boss farms give two.')}</p></div></div>
    <div class="grp tr" style="width: 250px; height: 390px">
      <p class="sk-gems">${ICON.diamond(18)}<b>${left}</b> ${t('to spend · {n} earned', { n: earned })}</p>
      <div class="st-chip sk-card">${skillCardHtml(g, sel)}</div></div>`;
}

function skillCardHtml(g: GameSave, id: string): string {
  const d = skillDef(id) || SKILLS[0];
  const own = g.skills.includes(d.id);
  const chk = canLearn(g, d.id);
  const status = own ? 'Learned' : chk.ok ? 'Ready' : reqsMet(g, d) ? 'Ready' : 'Locked';
  const statusTxt = status === 'Learned' ? t('Learned') : status === 'Ready' ? t('Ready') : t('Locked');
  const kids = SKILLS.filter(s => s.reqs.includes(d.id));
  const kidNames = kids.map(k => (revealed(g, k) || own ? t(k.name) : '?')).join(', ');
  const needs = d.reqs.map(r => t(skillDef(r)!.name)).join(d.reqMode === 'any' ? ` ${t('or')} ` : ', ');
  const rel = !d.reqs.length
    ? `<b>${t('Leads to:')}</b> ${esc(kidNames)}`
    : kids.length
      ? `<b>${t('Needs:')}</b> ${esc(needs)}<br><b>${t('Leads to:')}</b> ${esc(kidNames)}`
      : `<b>${t('Needs:')}</b> ${esc(needs)}`;
  let foot: string;
  if (own) foot = `<p class="sk-why">${t('Learned. Reset any time to move your diamonds.')}</p>`;
  else if (chk.ok)
    foot = `<button type="button" class="st-btn gold sk-learn" data-act="skill-learn" data-arg="${d.id}">${t('Learn · {n}', { n: d.cost })} ${ICON.diamond(18)}</button>`;
  else foot = `<p class="sk-why">${esc(t(chk.reason || 'Not yet.'))}</p>`;
  const reset = g.skills.length ? `<button type="button" class="linkish sk-reset" data-act="skill-reset">${t('Reset all skills · diamonds back')}</button>` : '';
  return `<div class="sk-head"><span class="sk-dot" style="background: ${BRANCH_COL[d.branch]}"></span><span class="eyebrow">${esc(t(BRANCH_NAME[d.branch]).toUpperCase())} · ${d.cost} ◆</span>
      <span class="sk-pill ${status.toLowerCase()}">${statusTxt}</span></div>
    <div class="sk-name"><span class="sk-ic" style="background: ${BRANCH_COL[d.branch]}">${skillGlyph(d.id, 26)}</span><h3>${esc(t(d.name))}</h3></div>
    <p class="sk-desc">${esc(t(d.effect))}</p><p class="sk-rel">${rel}</p>
    <div class="sk-foot">${foot}${reset}</div>`;
}

/** The first skill worth looking at: one ready to learn, else the core. */
export function firstSkill(g: GameSave): string {
  const ready = SKILLS.find(d => !g.skills.includes(d.id) && reqsMet(g, d));
  return ready ? ready.id : SKILLS[0].id;
}

// ------------------------------------------------------------------ Bling Barn

export function barnHtml(g: GameSave, tab: FlairKind, sel: string, ribbonAd: boolean): string {
  const tabs = FLAIR_KINDS.map(
    k => `<button type="button" role="tab" class="bb-tab${tab === k.kind ? ' on' : ''}" aria-selected="${tab === k.kind}" data-act="barn-tab" data-arg="${k.kind}">${esc(t(k.name))}</button>`,
  ).join('');
  const items = FLAIR.filter(f => f.kind === tab);
  const cur = flairById(sel) && flairById(sel)!.kind === tab ? flairById(sel)! : flairById(g.flair.equipped[tab])!;
  const cards = items
    .map(it => {
      const own = g.flair.owned.includes(it.id), on = g.flair.equipped[tab] === it.id;
      const price = on ? t('In use') : own ? t('Owned') : it.price === 0 ? t('Free') : `${ribbonIcon(14)}${it.price}`;
      return `<button type="button" class="bb-card${cur.id === it.id ? ' sel' : ''}" data-act="barn-pick" data-arg="${it.id}" aria-pressed="${cur.id === it.id}" aria-label="${esc(t(it.name))}, ${on ? t('in use') : own ? t('owned') : tn(it.price, '{n} ribbon', '{n} ribbons')}">
        ${on ? `<span class="bb-on">${t('ON')}</span>` : ''}${flairIcon(it, 76, 60)}<b>${esc(t(it.name))}</b><span class="bb-price">${price}</span></button>`;
    })
    .join('');
  const look = (k: FlairKind) => (tab === k ? cur : flairById(g.flair.equipped[k])!);
  const own = g.flair.owned.includes(cur.id), on = g.flair.equipped[tab] === cur.id;
  let action: string;
  if (on) action = `<p class="bb-why">${t('In use on your farm.')}</p>`;
  else if (own) action = `<button type="button" class="st-btn blue bb-act" data-act="barn-equip" data-arg="${cur.id}">${t('Use this')}</button>`;
  else if (g.ribbons >= cur.price) action = `<button type="button" class="st-btn gold bb-act" data-act="barn-buy" data-arg="${cur.id}">${t('Buy')} · ${ribbonIcon(20)} ${cur.price}</button>`;
  else action = `<p class="bb-why">${t('Needs {n} ribbons. You have {have}. Win stars, crowns and daily medals to earn more.', { n: cur.price, have: g.ribbons })}</p>`;
  const ad = ribbonAd ? `<button type="button" class="ad-chip" data-act="ad-ribbon">${ICON.play()}<span>${t('Free ribbon')}</span></button>` : '';
  return `<div class="bb-planks"></div>
    <div class="grp tl" style="width: 480px; height: 390px">
      <button type="button" class="st-btn st-sq top-btn" data-act="back" aria-label="${t('Back')}">${ICON.back()}</button>
      <div class="bb-titles"><h2>${t('Bling Barn')}</h2><p>${t('Looks only. Never changes your stats.')}</p></div>
      <div class="bb-tabs" role="tablist" aria-label="${t('Bling Barn shelves')}">${tabs}</div>
      <div class="bb-grid">${cards}</div></div>
    <div class="grp tr" style="width: 266px; height: 390px">
      <div class="bb-chips">${ad}<p class="st-chip bb-ribbons">${ribbonIcon(20)}<b>${g.ribbons}</b> ${t('ribbons')}</p></div>
      <div class="st-chip bb-panel">
      <div class="bb-scene-box">${barnPreview(look('finish'), look('trail'), look('bird'), look('coin'))}</div>
      <h3>${esc(t(cur.name))}</h3><p class="bb-line">${esc(t(cur.line))}</p><div class="bb-foot">${action}</div></div></div>`;
}

// ------------------------------------------------------------------ daily farm and duel

const MEDAL_COL = ['#E4DACA', '#D08A4E', '#C9D3DD', '#FFC23D'];

export function medalIcon(m: number, size = 26): string {
  const c = MEDAL_COL[m] || MEDAL_COL[0];
  return `<svg width="${size}" height="${size}" viewBox="0 0 26 26" aria-hidden="true">
    <path d="M8 2 L11 10 M18 2 L15 10" stroke="${m ? '#E5484D' : '#B9AE9E'}" stroke-width="4" stroke-linecap="round"/>
    <circle cx="13" cy="16" r="8.4" fill="${c}" stroke="${INK}" stroke-width="2.2"/>
    ${m ? `<path d="M13 11.4 l1.5 3 3.3.4-2.4 2.3.6 3.3-3-1.6-3 1.6.6-3.3-2.4-2.3 3.3-.4z" fill="#FFFFFF" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>` : ''}</svg>`;
}

export function calendarIcon(size = 24): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" fill="#FFFDF4" stroke="${INK}" stroke-width="2.2"/>
    <path d="M3 10 H21" stroke="${INK}" stroke-width="2.2"/><rect x="3" y="5" width="18" height="5" rx="2.5" fill="#F07A62" stroke="${INK}" stroke-width="2.2"/>
    <path d="M8 3 V7 M16 3 V7" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/><path d="M12 12.4 l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z" fill="#FFC23D" stroke="${INK}" stroke-width="1.1"/></svg>`;
}

export function duelIcon(size = 24): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 21 L14 9" stroke="${INK}" stroke-width="4.4" stroke-linecap="round"/><path d="M5 21 L14 9" stroke="#C27838" stroke-width="2" stroke-linecap="round"/>
    <path d="M19 21 L10 9" stroke="${INK}" stroke-width="4.4" stroke-linecap="round"/><path d="M19 21 L10 9" stroke="#C27838" stroke-width="2" stroke-linecap="round"/>
    <path d="M13.4 9.6 C19 9.4 21 3.6 16.6 1.6 C17.6 5.2 15.6 7.2 12 7 Z" fill="#E2E8F0" stroke="${INK}" stroke-width="1.7" stroke-linejoin="round"/>
    <path d="M10.6 9.6 C5 9.4 3 3.6 7.4 1.6 C6.4 5.2 8.4 7.2 12 7 Z" fill="#E2E8F0" stroke="${INK}" stroke-width="1.7" stroke-linejoin="round"/></svg>`;
}

function farmStrip(cityId: string): string {
  const ct = cityById(cityId)!;
  const pv = PREVIEW[cityId] || bandFor(cityId, ct.country);
  return pv ? `<div class="dl-strip" style="background-image: url('${pv}')" role="img" aria-label="${t('The {farm} farm', { farm: esc(ct.short) })}"></div>` : `<div class="dl-strip empty"></div>`;
}

function toolChip(tool: ToolId): string {
  return `<span class="dl-tool">${TOOL_ICON[tool] ? TOOL_ICON[tool](30) : ''}<b>${esc(t(toolDef(tool).name))}</b></span>`;
}

function targetsRow(targets: [number, number, number], best: number): string {
  const m = medalOf(targets, best);
  return `<div class="dl-targets">${[1, 2, 3]
    .map(i => `<div class="dl-t${m >= i ? ' got' : ''}">${medalIcon(i, 26)}<span><b>${t(MEDAL_NAME[i]).toUpperCase()}</b>${money(targets[i - 1])}</span></div>`)
    .join('')}</div>`;
}

export function dailyHtml(def: SideDef & { date: string }, d: DailyState, tries: number, adTry: boolean): string {
  const ct = cityById(def.cityId)!;
  const c = countryOf(ct.country);
  const medal = d.medal;
  const when = new Date(def.date + 'T12:00:00');
  const dateTxt = isNaN(when.getTime()) ? def.date : when.toLocaleDateString(LOCALE[lang()], { weekday: 'long', month: 'long', day: 'numeric' });
  let play: string;
  if (tries > 0) play = `<button type="button" class="st-btn gold btn-md flex1" data-act="daily-play">${ICON.play()}<span>${tn(tries, 'Play · {n} try left', 'Play · {n} tries left')}</span></button>`;
  else if (adTry) play = `<button type="button" class="st-btn blue btn-md flex1 ad-btn" data-act="ad-daily">${ICON.play()}<span>${t('Watch an ad: one more try')}</span></button>`;
  else play = `<p class="dl-done">${t("That's all for today. A new farm opens tomorrow.")}</p>`;
  const bestTxt = d.plays
    ? `${t('Your best today:')} <b>${money(d.best)}</b>${medal ? ` · ${t(MEDAL_NAME[medal])}` : ''}`
    : adTry
      ? t('One free try today, and up to two more with a short video. Your best try counts.')
      : t('One free try today. Your best try counts.');
  return `<div class="grp mc" style="width: 500px; height: 350px"><div class="st-chip dl-card">
    <div class="dl-head"><span class="dl-cal">${calendarIcon(22)}</span><span class="eyebrow">${t('DAILY FARM')} · ${esc(dateTxt.toUpperCase())}</span>${medal ? `<span class="dl-medal">${medalIcon(medal, 30)}</span>` : ''}</div>
    <div class="dl-farm">${farmStrip(def.cityId)}<div class="dl-farm-txt"><h2>${esc(ct.short)}, ${esc(c.code === 'US' ? t('USA') : t(c.name))}</h2>${toolChip(def.tool)}</div></div>
    <p class="dl-text">${t("One day, no bills. Everyone gets the same field and the same upgrades, so it's all down to your swipes.")}</p>
    ${targetsRow(def.targets, d.best)}
    <p class="dl-best">${bestTxt}</p>
    <p class="dl-rew">${medalIcon(1, 16)} ${MEDAL_RIBBONS[1]} ${ribbonIcon(14)} · ${medalIcon(2, 16)} ${MEDAL_RIBBONS[2]} ${ribbonIcon(14)} · ${medalIcon(3, 16)} ${MEDAL_RIBBONS[3]} ${ribbonIcon(14)} ${t('and a {gem} once a day', { gem: ICON.diamond(14) })}</p>
    <div class="r-actions"><button type="button" class="st-btn btn-md" data-act="go" data-arg="menu">${t('Back')}</button>${play}</div>
  </div></div>`;
}

export interface DuelSetup {
  cityId: string;
  tool: ToolId;
  names: [string, string];
}

export function duelHtml(s: DuelSetup, cities: string[], tools: ToolId[]): string {
  const ct = cityById(s.cityId)!;
  const i = cities.indexOf(s.cityId);
  const n = cities.length;
  const toolBtns = tools
    .map(tl => `<button type="button" class="du-tool${s.tool === tl ? ' on' : ''}" data-act="duel-tool" data-arg="${tl}" aria-pressed="${s.tool === tl}">${TOOL_ICON[tl](28)}<span>${esc(t(toolDef(tl).name))}</span></button>`)
    .join('');
  return `<div class="grp mc" style="width: 520px; height: 350px"><div class="st-chip du-card">
    <div class="dl-head"><span class="dl-cal">${duelIcon(22)}</span><span class="eyebrow">${t('DUEL · TWO PLAYERS, ONE PHONE')}</span></div>
    <h2 class="du-title">${t('Same farm. Same crops. Most money wins.')}</h2>
    <p class="dl-text">${t('Each player farms one day on the same field with the same tool and upgrades. Pass the phone in between.')}</p>
    <div class="du-row" role="group" aria-label="${t('Farm')}">
      <button type="button" class="st-btn st-sq du-arrow" data-act="duel-city" data-arg="${cities[(i - 1 + n) % n]}" aria-label="${t('Previous farm')}">${ICON.back()}</button>
      <div class="du-farm">${farmStrip(s.cityId)}<b>${esc(ct.short)}</b></div>
      <button type="button" class="st-btn st-sq du-arrow" data-act="duel-city" data-arg="${cities[(i + 1) % n]}" aria-label="${t('Next farm')}"><span style="transform: scaleX(-1); display: flex">${ICON.back()}</span></button></div>
    <div class="du-row" role="group" aria-label="${t('Tool')}"><div class="du-tools">${toolBtns}</div></div>
    <div class="r-actions"><button type="button" class="st-btn btn-md" data-act="go" data-arg="menu">${t('Back')}</button>
      <button type="button" class="st-btn gold btn-md flex1" data-act="duel-start">${ICON.play()}<span>${t('{name} goes first', { name: esc(s.names[0]) })}</span></button></div>
  </div></div>`;
}

export interface SideOutcome {
  kind: 'daily' | 'duel-pass' | 'duel-end';
  score: number;
  def: SideDef;
  /** Daily: the medal now held today, whether it improved, ribbons and diamond won. */
  medal?: number;
  newMedal?: boolean;
  ribbons?: number;
  diamond?: boolean;
  tries?: number;
  adTry?: boolean;
  /** Duel: both scores and names. */
  scores?: [number, number];
  names?: [string, string];
}

export function sideResultHtml(o: SideOutcome): string {
  const ct = cityById(o.def.cityId)!;
  if (o.kind === 'daily') {
    const m = o.medal || 0;
    const got = medalOf(o.def.targets, o.score);
    const head = got ? `${t(MEDAL_NAME[got])}!` : t('No medal this time');
    const next = got < 3 ? t('{medal} needs {amt}.', { medal: t(MEDAL_NAME[got + 1]), amt: money(o.def.targets[got]) }) : t('The best a farmer can do. Come back tomorrow.');
    const rew = [
      o.ribbons ? `<span class="dia">+${o.ribbons} ${ribbonIcon(18)}</span>` : '',
      o.diamond ? `<span class="dia">+1 ${ICON.diamond(16)}</span>` : '',
    ].join('');
    let again = '';
    if (o.tries && o.tries > 0) again = `<button type="button" class="st-btn gold btn-md flex1" data-act="daily-play">${t('Again · {n} left', { n: o.tries })}</button>`;
    else if (o.adTry) again = `<button type="button" class="st-btn blue btn-md flex1 ad-btn" data-act="ad-daily">${ICON.play()}<span>${t('One more try')}</span></button>`;
    return `<div class="grp mc" style="width: 440px; height: 320px"><div class="st-chip result-card dl-res">
      <div class="letter-head"><span class="eyebrow">${t('DAILY FARM')} · ${esc(ct.short.toUpperCase())}</span></div>
      <div class="dl-res-top"><span class="dl-res-medal${got ? ' pop' : ''}">${medalIcon(got, 64)}</span><div><h2 class="r-title">${head}</h2>
        <p class="dl-score">${money(o.score)}</p></div></div>
      <p class="r-text">${got && o.newMedal ? t('Your best medal today: {medal}.', { medal: t(MEDAL_NAME[m]) }) : m ? t("Today's best stays {medal}.", { medal: t(MEDAL_NAME[m]) }) : ''} ${next}</p>
      ${targetsRow(o.def.targets, o.score)}
      <div class="r-rewards"><span>${esc(ct.short)} · ${esc(t(toolDef(o.def.tool).name))}</span>${rew}</div>
      <div class="r-actions"><button type="button" class="st-btn btn-md flex1" data-act="go" data-arg="menu">${t('Menu')}</button>${again}</div></div></div>`;
  }
  const names = o.names || [t('Player 1'), t('Player 2')];
  const sc = o.scores || [0, 0];
  if (o.kind === 'duel-pass')
    return `<div class="grp mc" style="width: 420px; height: 300px"><div class="st-chip result-card du-pass">
      <div class="letter-head"><span class="eyebrow">${t('DUEL')} · ${esc(ct.short.toUpperCase())}</span></div>
      <h2 class="r-title">${t('{name} harvested {amt}.', { name: esc(names[0]), amt: money(sc[0]) })}</h2>
      <p class="r-text">${t('Pass the phone to {name}. Same field, same crops, same {tool}. Beat {amt} to win.', { name: esc(names[1]), tool: esc(inner(t(toolDef(o.def.tool).name))), amt: money(sc[0]) })}</p>
      <div class="du-hand" aria-hidden="true">${duelIcon(54)}</div>
      <div class="r-actions"><button type="button" class="st-btn btn-md" data-act="duel-quit">${t('Stop')}</button>
        <button type="button" class="st-btn gold btn-md flex1" data-act="duel-p2">${ICON.play()}<span>${t('{name}, start', { name: esc(names[1]) })}</span></button></div></div></div>`;
  const win = sc[0] === sc[1] ? -1 : sc[0] > sc[1] ? 0 : 1;
  const title = win < 0 ? t("It's a tie!") : t('{name} wins!', { name: esc(names[win === 0 ? 0 : 1]) });
  const col = (i: number) => `<div class="du-score${win === i ? ' win' : ''}"><span>${esc(names[i])}</span><b>${money(sc[i])}</b>${win === i ? ICON.crown('#FFC23D', 26) : ''}</div>`;
  return `<div class="grp mc" style="width: 440px; height: 300px"><div class="st-chip result-card du-end">
    <div class="letter-head"><span class="eyebrow">${t('DUEL')} · ${esc(ct.short.toUpperCase())}</span>${o.ribbons ? `<span class="du-rib">+${o.ribbons} ${ribbonIcon(16)}</span>` : ''}</div>
    <h2 class="r-title">${title}</h2>
    <div class="du-scores">${col(0)}${col(1)}</div>
    <p class="r-text">${win < 0 ? t('Down to the last coin. Rematch?') : t('By {amt}. The rematch uses a new field.', { amt: money(Math.abs(sc[0] - sc[1])) })}</p>
    <div class="r-actions"><button type="button" class="st-btn btn-md flex1" data-act="go" data-arg="menu">${t('Menu')}</button>
      <button type="button" class="st-btn gold btn-md flex1" data-act="duel-rematch">${t('Rematch')}</button></div></div></div>`;
}

/** Cities a duel can be played on: every farm the player has opened. */
export function duelCities(open: (id: string) => boolean): string[] {
  const list = ROUTE.filter(c => open(c.id)).map(c => c.id);
  return list.length ? list : [ROUTE[0].id];
}

export type { FlairItem };
