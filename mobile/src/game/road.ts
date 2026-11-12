// The road (0.13; Navid, 10 Nov): the 30 farms are one road, not 30 fresh starts.
//
// Until 0.12 every farm began again on carrots and climbed the same ladder, so a player with a strong sickle met
// easy carrots in every city ("we reset the difficulty for each farm… we introduce some common vegetables and then
// some country-based ones again and again from zero to the full set"). Now a vegetable is met once:
//   - Charlottetown brings one with each bill: carrots, then radishes, the Hoser Russet, Lord Cabbage ("introduce only
//     carrot in first bill then second bill with the new vegetable and so on");
//   - every farm after it opens with vegetables the player already knows and brings one new one, its own, once the
//     first bill is paid ("previously unlocked vegetables as well as one new specific vegetable at the new bill");
//   - the long countries' boss farms bring none (the boss is the event).
// A player's own cutting of a vegetable raises what it pays (its level), and levels never reset.
// Pure data and maths, no DOM.

import { ROUTE } from './world';

/** The vegetable(s) each farm brings to the road, in the order they join its field. A country's three debut on its
 *  own farms (each in the city known for it); the common ones fill the farms in between. */
export const DEBUT: Record<string, string[]> = {
  ca_charlottetown: ['carrot', 'radish', 'pei_russet', 'cabbage'],
  ca_gatineau: ['fiddlehead'], ca_toronto: ['onion'], ca_leamington: ['pumpkin'], ca_saskatoon: ['saskaberry'], ca_kelowna: [],
  us_austin: ['habanero'], us_desmoines: ['sweetcorn'], us_vidalia: ['brisket_onion'],
  br_belem: ['mandioca'], br_petrolina: ['abacaxi'], br_sinop: ['guarana'], br_ribeirao: ['berry'], br_bento: [],
  ma_marrakech: ['chickpea'], ma_meknes: ['olive'], ma_fes: ['eggplant'],
  fr_avignon: ['lavender'], fr_beaune: ['echalote'], fr_tours: ['artichaut'], fr_roscoff: ['potato'], fr_agen: [],
  cn_guilin: ['bittermelon'], cn_hangzhou: ['lotusroot'], cn_chengdu: ['bokchoy'],
  jp_sapporo: ['kabocha'], jp_aomori: ['daikon'], jp_shizuoka: ['wasabi'], jp_kyoto: [], jp_kagoshima: [],
};

/** Every vegetable met before farm k, in the order the road brought them. */
export function knownBefore(k: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < k && i < ROUTE.length; i++) out.push(...(DEBUT[ROUTE[i].id] || []));
  return out;
}

/** The farm (route index) a vegetable is first met on, or -1. */
export function debutFarm(type: string): number {
  return ROUTE.findIndex(c => (DEBUT[c.id] || []).includes(type));
}

export interface FieldKind {
  type: string;
  /** Bills paid on the farm before it joins the field (0: there from the first morning). */
  stage: number;
  /** New to the road on this farm. */
  debut: boolean;
}

/** How many of the newest known vegetables a field always carries; older ones take turns in what room is left. */
const RECENT = 3;

/**
 * The vegetables of farm k's field, smallest first: `size` kinds in all (a farm has as many as it has bills).
 * Known ones are there from the first morning: the three newest, and older ones taking turns farm by farm, so a
 * carrot still turns up in Japan. The farm's own new vegetable joins when the first bill is paid and is the biggest
 * crop of the field. Charlottetown, where nothing is known yet, brings one with each bill.
 */
export function fieldKinds(k: number, size: number): FieldKind[] {
  const own = DEBUT[ROUTE[k].id] || [];
  const known = knownBefore(k);
  if (!known.length) return own.map((type, i) => ({ type, stage: i, debut: true }));
  const room = Math.max(1, size - own.length);
  const recent = known.slice(-Math.min(RECENT, room));
  const older = known.slice(0, known.length - recent.length);
  // older vegetables take turns: a different run of them on each farm, kept in the order the road brought them
  const want = Math.min(older.length, room - recent.length);
  const turns = new Set<string>();
  for (let j = 0; j < want; j++) turns.add(older[(k * 3 + j) % older.length]);
  const pick = older.filter(t => turns.has(t));
  return [...pick, ...recent].map(type => ({ type, stage: 0, debut: false })).concat(own.map((type, i) => ({ type, stage: i + 1, debut: true })));
}

// ---------------------------------------------------------------- levels: what the player's own cutting earns

/** A vegetable's level rises with the player's own cuts of it on farms they do not own yet (a farm already won, a
 *  daily farm or a duel does not count, so an easy old farm can't be ground for levels). Each level above the first
 *  pays 8% more; ten levels. */
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

/** A typical player's cuts of each vegetable when farm k starts (for the bots that tune the bills): the average bot
 *  cuts about 20 crops a day, so about 100 of each vegetable of a field over a farm. */
export const TYPICAL_CUTS = 100;
export function typicalCuts(k: number, sizeOf: (i: number) => number): Record<string, number> {
  const out: Record<string, number> = {};
  for (let i = 0; i < k; i++) for (const f of fieldKinds(i, sizeOf(i))) out[f.type] = (out[f.type] || 0) + TYPICAL_CUTS;
  return out;
}
