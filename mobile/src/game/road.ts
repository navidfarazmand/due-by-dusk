// The road (0.14; Navid, 14-15 Nov 2026): the runaways.
//
// The player's vegetables ran away around the world; the player follows them, paying the bank on the way. Every town
// is one runaway: a vegetable of that country. It is spotted after the town's first bill, everywhere by the middle of
// the town, and caught when the town's big bill is paid (then it works in the Pen, src/game/pen.ts).
//   - A country's vegetables stay in that country (Navid: "its ridiculous to have pineapple in egypt"): crossing a
//     border, the field starts again with the new country's first runaway.
//   - Inside a country the field keeps the runaways already caught there (the newest few), so it grows town by town
//     and never starts again until the border.
//   - Towns per country follow the cities on the maps: Canada 6, Brazil 5, France 5, the others 3 (28 in all), one
//     vegetable each; the last town of a country is its capital, with the King.
// A player's own cutting of a vegetable raises what it pays (its level), and levels never reset.
// Pure data and maths, no DOM.

import { ROUTE } from './world';

/** Each town's runaway: the vegetable it brings. */
export const RUNAWAY: Record<string, string> = {
  ca_charlottetown: 'carrot', ca_gatineau: 'radish', ca_toronto: 'fiddlehead', ca_leamington: 'pumpkin', ca_saskatoon: 'saskaberry', ca_kelowna: 'pei_russet',
  us_austin: 'habanero', us_desmoines: 'sweetcorn', us_vidalia: 'brisket_onion',
  br_belem: 'mandioca', br_petrolina: 'abacaxi', br_sinop: 'guarana', br_ribeirao: 'berry', br_bento: 'onion',
  ma_marrakech: 'chickpea', ma_meknes: 'olive', ma_fes: 'eggplant',
  fr_avignon: 'lavender', fr_beaune: 'echalote', fr_tours: 'artichaut', fr_roscoff: 'cabbage', fr_agen: 'potato',
  cn_guilin: 'bittermelon', cn_hangzhou: 'lotusroot', cn_chengdu: 'bokchoy',
  jp_sapporo: 'kabocha', jp_shizuoka: 'wasabi', jp_kagoshima: 'daikon',
};

/** Kept for older callers: the vegetables a town brings (one, its runaway). */
export const DEBUT: Record<string, string[]> = Object.fromEntries(Object.entries(RUNAWAY).map(([k, v]) => [k, [v]]));

/** The runaways caught before town k in the same country, oldest first. */
export function countryKnown(k: number): string[] {
  const c = ROUTE[k];
  if (!c) return [];
  const out: string[] = [];
  for (let i = 0; i < k; i++) if (ROUTE[i].country === c.country && RUNAWAY[ROUTE[i].id]) out.push(RUNAWAY[ROUTE[i].id]);
  return out;
}

/** Every vegetable met before town k, in road order (all countries). */
export function knownBefore(k: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < k && i < ROUTE.length; i++) if (RUNAWAY[ROUTE[i].id]) out.push(RUNAWAY[ROUTE[i].id]);
  return out;
}

/** The town (route index) a vegetable is first met in, or -1. */
export function debutFarm(type: string): number {
  return ROUTE.findIndex(c => RUNAWAY[c.id] === type);
}

export interface FieldKind {
  type: string;
  /** Bills paid in the town before it joins the field (0: there from the first morning). */
  stage: number;
  /** This town's runaway. */
  debut: boolean;
  /** The runaway: bills paid before it is everywhere (it is rare from `stage` until then). */
  common?: number;
}

/** The most kinds a field holds: the runaway and the newest caught ones of its country. */
export const FIELD_KINDS = 5;

/**
 * Town k's field, smallest first: the country's runaways caught so far (the newest four) from the first morning, then
 * the town's own runaway, the biggest crop. With others on the field it is spotted (rare) once the first bill is paid
 * and everywhere from the middle bill on; in a country's first town it is there from the start.
 */
export function fieldKinds(k: number, bills: number): FieldKind[] {
  const own = RUNAWAY[ROUTE[k].id];
  const known = countryKnown(k).slice(-(FIELD_KINDS - 1));
  const out: FieldKind[] = known.map(type => ({ type, stage: 0, debut: false }));
  if (own) {
    if (!known.length) out.push({ type: own, stage: 0, debut: true, common: 0 });
    else out.push({ type: own, stage: 1, debut: true, common: Math.max(1, Math.ceil(bills / 2)) });
  }
  return out;
}

// ---------------------------------------------------------------- levels: what the player's own cutting earns

/** A vegetable's level rises with the player's own cuts of it (a daily farm or a duel does not count). Each level
 *  above the first pays 8% more; ten levels. */
export const CROP_LEVEL_MAX = 10;
export const CROP_LEVEL_PAY = 0.08;
const LEVEL_FIRST = 25;
const LEVEL_GROW = 1.5;

/** Cuts in all to reach a level (level 1: 0; then 25, 63, 119, 203, 330, 520, 805, 1232, 1873). */
export function cutsForLevel(level: number): number {
  let sum = 0;
  for (let l = 1; l < Math.min(CROP_LEVEL_MAX, level); l++) sum += Math.round(LEVEL_FIRST * Math.pow(LEVEL_GROW, l - 1));
  return sum;
}

export function cropLevel(cuts: number): number {
  let level = 1;
  while (level < CROP_LEVEL_MAX && cuts >= cutsForLevel(level + 1)) level++;
  return level;
}

/** How far along the next level is, 0..1 (1 at the top level). */
export function cropLevelProgress(cuts: number): number {
  const lv = cropLevel(cuts);
  if (lv >= CROP_LEVEL_MAX) return 1;
  const a = cutsForLevel(lv), b = cutsForLevel(lv + 1);
  return Math.max(0, Math.min(1, (cuts - a) / (b - a)));
}

/** What a vegetable pays at a level, against level 1. */
export function cropPay(level: number): number {
  return 1 + CROP_LEVEL_PAY * (Math.max(1, Math.min(CROP_LEVEL_MAX, level)) - 1);
}

/** Pay multipliers by vegetable for the engine (window.__DBD_CROPLV), from the save's cut counts. */
export function cropPayTable(cuts: Record<string, number> | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [type, n] of Object.entries(cuts || {})) {
    const m = cropPay(cropLevel(n));
    if (m > 1) out[type] = m;
  }
  return out;
}

/** A typical player's cuts of each vegetable when town k starts (for the bots that tune the bills): the average bot
 *  cuts about 20 crops a day, so about 100 of each vegetable of a field over a town. */
export const TYPICAL_CUTS = 100;
export function typicalCuts(k: number, billsOf: (i: number) => number): Record<string, number> {
  const out: Record<string, number> = {};
  for (let i = 0; i < k; i++) for (const f of fieldKinds(i, billsOf(i))) out[f.type] = (out[f.type] || 0) + TYPICAL_CUTS;
  return out;
}
