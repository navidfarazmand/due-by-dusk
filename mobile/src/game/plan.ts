// Town plans: what each of the 28 towns asks of the player. Pure data and maths, no DOM, so it can be tested.
//
// 0.14 (Navid, 15 Nov 2026): a town is 2 to 7 bills, each 2 to 7 days, random but short at the start of a town and
// long at its end; a bill is rent, the bank's loan, or the town's big bill (the last one, which catches the runaway).
// Every bill asks more per day than the one before, all the way along the road. Tax and repairs come as surprises
// (src/shell/app.ts) and are sized here. Older notes follow.
//
// A farm is a run of bills; the last one is the deed. v0.12 (Navid, 5 Nov): the first bill is due after 2 days, the
// next after 3, then 4, then 5 (and 5 from then on). v0.13 (Navid, 10 Nov; src/game/road.ts): the farms are one road.
// A vegetable is met once: Charlottetown brings one with each bill, every later farm opens with vegetables the player
// knows and brings its own new one when the first bill is paid. Bigger crops pay more and take more cuts. Bills
// follow what the field can pay, tuned with bots so a weak player can't pay even with an ad, an average one pays
// with one ad, and a computer-strong one needs none. Farm by farm, crops get tougher (hp) and pay more (val); at
// every border money steps up (BORDER_STEP): what crops pay, the bills and the upgrades of that country's reach.

import { COUNTRIES, ROUTE, type CityDef, type CountryCode, cityById, countryOf, isBossCity, routeIndex } from './world';
import { FIELD_KINDS, fieldKinds } from './road';

/** Rent and the bank's loan come and go; the big bill is a town's last, and paying it catches the runaway. */
export type BillKind = 'rent' | 'bank' | 'big';

export interface Bill {
  name: string;
  kind: BillKind;
  amt: number;
  /** Days from the previous bill (or the start of the farm) until this one is due at sunset. */
  days: number;
  note: string;
}

export type CropWeight = [type: string, weight: number, unlockAt: number];

/** One vegetable of a farm's field: it joins once `stage` bills are paid (0: there from the first morning). */
export interface StageCrop {
  type: string;
  stage: number;
  /** New to the road on this farm (road.ts). */
  debut?: boolean;
  /** Base value and toughness, before the city's multipliers (val, hp) and the player's upgrades. */
  val: number;
  hp: number;
}

/** The country boss: a giant crowned crop that stays on the boss farm until knocked out. */
export interface BossFight {
  type: string;
  name: string;
  /** Boss health is set when the farm starts: this many seconds of steady hitting with the player's
   * strongest tool (so it stays a fight however the player built up). */
  focusSec: number;
  /** Fallback health factor (× the crop's health × the city's crop health) when no tool info is given. */
  hpMul: number;
  /** v0.12: share of the farm's field time a player hitting only the boss needs to knock it out (0.5: halfway through
   *  the farm), and the share of time its armour is off (it only takes damage right after it eats). */
  share?: number;
  uptime?: number;
  /** Paid out when the boss is knocked out. */
  bounty: number;
}

export interface CityPlan {
  cityId: string;
  country: CountryCode;
  /** Position on the route, 0..29. */
  index: number;
  boss: boolean;
  bills: Bill[];
  /** Crop health multiplier for this city, and how much it grows per day and per bill paid on the farm. */
  hp: number;
  hpDay: number;
  hpBill: number;
  /** Crop value multiplier for this city. */
  val: number;
  /** Field fullness (max crops) and how fast new crops appear. */
  density: number;
  spawn: number;
  /** 0.15.1: crops grow this many times as fast as on a bare field (practice and the intro: GROW_FAST). */
  grow?: number;
  /** Seconds of daylight before upgrades, and extra seconds on later farms. */
  dayBase: number;
  dayBonus: number;
  /** Content level added to the bills paid: the goat and the crows come at 2. Crop unlocks carry it too. */
  unlock: number;
  goldAt: number;
  crops: CropWeight[];
  /** 'bill': a crop's unlockAt counts bills paid on the farm (0.13); without it, the farm's content level. */
  cropBy?: 'bill';
  /** The farm's vegetables, smallest first, each with the bills paid before it joins (road.ts). */
  stages: StageCrop[];
  /** The town's runaway (road.ts): spotted after `stage` bills, everywhere after `common`. */
  runaway: string;
  /** Surprises (0.14): sizes of a tax and a repair here, or 0 where none come (the first town). */
  tax: number;
  repair: number;
  /** Base value and toughness per crop type on this farm (the engine uses these instead of the crop's own). */
  cropVal: Record<string, number>;
  cropHp: Record<string, number>;
  totalDays: number;
  /** Keep this much cash after paying the deed for the second star. */
  spare: number;
  /** 0.16: the second star, a big day: earn this much in one day (half again an average player's day here). */
  bigDay: number;
  /** The day's gazette event this city leans towards (every other day). */
  signatureEvent: string;
  /** What a steady player earns on a day here once the whole ladder is out (used for bills and ad rewards). */
  dayRef: number;
  /** How heavy this farm's bills are against what its field pays. */
  billMul: number;
  /** The player's bill scale this plan was made with (0.15: bills follow the player's own days; 1 for the town's own bills). */
  scale: number;
  /** Only on boss farms. The deed cannot be paid until the boss is knocked out. */
  bossFight?: BossFight;
}

/** One boss per country, a giant crowned member of its trio. */
export const BOSSES: Record<CountryCode, { type: string; name: string }> = {
  CA: { type: 'pei_russet', name: 'King Russet' },
  US: { type: 'sweetcorn', name: 'King Corn' },
  BR: { type: 'abacaxi', name: 'Queen Abacaxi' },
  MA: { type: 'chickpea', name: 'King Chickpea' },
  FR: { type: 'artichaut', name: 'King Artichaut' },
  CN: { type: 'bittermelon', name: 'King Bitter Melon' },
  JP: { type: 'kabocha', name: 'King Kabocha' },
};

/** 0.14: kept for older callers; a town's bills come from billSchedule. */
export const BILL_COUNT: Record<CountryCode, number> = { CA: 5, US: 5, BR: 6, MA: 6, FR: 6, CN: 7, JP: 7 };

/** A small seeded random number source (mulberry32), so a town's bills are the same every time it is played. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The first town's bills: 2, 3 and 4 days (the game is still teaching). */
export const FIRST_TOWN_DAYS = [2, 3, 4];
const SCHEDULES = new Map<number, number[]>();
/**
 * Town k's bills, as the days each one gives (Navid, 15 Nov: "something between 2-7 bills, each between 2-7 days").
 * Random but the same every time: a country's first town has 2 or 3 bills, its capital 5 to 7, the others 3 to 6;
 * a town's first bill gives 2 or 3 days, its big bill 5 to 7, and the ones between lean longer as the town goes on.
 */
export function billSchedule(k: number): number[] {
  const cached = SCHEDULES.get(k);
  if (cached) return cached;
  const city = ROUTE[Math.max(0, Math.min(ROUTE.length - 1, k))];
  let days: number[];
  if (k <= 0) days = FIRST_TOWN_DAYS.slice();
  else {
    const rnd = seeded(hashId(city.id));
    const list = countryOf(city.country).cities;
    const pos = list.findIndex(x => x.id === city.id);
    // a country's first town has one kind of crop (its runaway), so it is short
    const [lo, hi] = pos === 0 ? [2, 3] : pos === list.length - 1 ? [5, 7] : [3, 6];
    const n = lo + Math.floor(rnd() * (hi - lo + 1));
    days = [];
    for (let i = 0; i < n; i++) {
      const t = n > 1 ? i / (n - 1) : 1;
      let d = Math.round(2 + 4 * t + (rnd() - 0.5) * 2.4);
      if (i === 0) d = Math.min(d, 3);
      // the big bill is the longest (and so the biggest) of its town
      if (i === n - 1) d = Math.max(d, 5, ...days);
      days.push(Math.max(2, Math.min(7, d)));
    }
  }
  SCHEDULES.set(k, days);
  return days;
}
/** Days bill `i` of town k gives you, from the one before (or the start of the town). */
export function billDays(i: number, k = 0): number {
  const s = billSchedule(k);
  return s[Math.max(0, Math.min(s.length - 1, i))];
}
/** The town's day on which bill `i` is due. */
export function billDueDay(i: number, k = 0): number {
  const s = billSchedule(k);
  let d = 0;
  for (let j = 0; j <= Math.min(i, s.length - 1); j++) d += s[j];
  return d;
}
/** Seconds of daylight with no upgrades. v0.12 (Navid, 5 Nov): 15 s; Longer days and skills add up to about 30. */
export const DAY_SECONDS = 15;
/** 0.15.1: practice and the intro grow crops five times as fast as a bare field (about a third of a second, as all
 *  crops did before), so the lessons come quickly. The engine's GROW_BASE is the bare field's 1.8 s. */
export const GROW_FAST = 5;
/** 0.15.1: and they sprout three times as fast as their town's field would (a bare field sprouts one every 5 s), so
 *  practice's six carrots and chain of six still come in a few seconds. */
export const PRACTICE_SPAWN = 3;
/** 0.16: the second star's big day, in an average player's days there. */
export const BIG_DAY = 1.5;
/** 0.16: practice's carrots take 2 cuts, as the first town's do (a one-cut carrot was "wrong"). */
export const PRACTICE_CROP_HP = 1.5;

/**
 * A field's vegetables by size, smallest first: value, toughness and how often each comes up. Value per cut stays
 * about the same, so a tougher crop pays more only for a player who keeps up with it. On a farm, the vegetables the
 * player has known longest are the small ones and the farm's own new vegetable is the biggest.
 */
export const LADDER_VAL = [1, 3, 5, 7.5, 10, 12.5, 15, 18];
export const LADDER_HP = [1, 2.5, 4.5, 7, 10, 13, 16.5, 20];
/** 0.16: a crop's health on its town's first day is at least this (a sickle without upgrades hits for 1): 2 cuts
 *  (Navid, 18 Nov: 3 cuts for a carrot was "a bit steep ... try 2"). */
export const FIRST_TOWN_CROP_HP = 1.5;
export const MIN_CROP_HP = 1.5;
const LADDER_W = [14, 16, 18, 20, 22, 22, 22, 22];

/**
 * Bill pressure per country (and per city in Canada). The first farm is gentle; from the third on the bills take
 * most of a good player's day, so rewarded ads, smart upgrades and the odd retry matter.
 */
const CANADA_MUL = [1, 1, 1, 1, 1, 1];
const BILL_MUL: Record<CountryCode, number> = { CA: 1, US: 1, BR: 1, MA: 1, FR: 1, CN: 1, JP: 1 };
export function billMul(cityId: string): number {
  const c = cityById(cityId);
  if (!c) return 1;
  if (c.country === 'CA') {
    const i = countryOf('CA').cities.findIndex(x => x.id === cityId);
    return CANADA_MUL[Math.max(0, i)] ?? BILL_MUL.CA;
  }
  return BILL_MUL[c.country];
}

const GENERIC_BILLS: Array<[string, string]> = [
  ['Seed loan', 'For the carrot seeds. We trust you. Mostly.'],
  ['New fence', 'Your goat ate the old one. The goat denies this.'],
  ['Tractor transmission', 'It only drives in reverse now. Charming, but no.'],
  ['Pond water rights', 'The ducks have retained counsel.'],
  ['Barn roof', 'The pigeons have filed a formal complaint.'],
  ["Grandma's pie insurance", 'Required by the county fair. Do not ask why.'],
  ['Property tax', 'The county noticed you are doing well.'],
  ["The scarecrow's lawyer", 'He is suing for back pay. He has a point.'],
];

const LOCAL_BILLS: Record<CountryCode, Array<[string, string]>> = {
  CA: [
    ['Snow tires', 'For the tractor. It refuses to skate.'],
    ['Maple tap rental', 'The trees want a cut of the syrup.'],
    ['Hockey rink permit', 'The potatoes flooded the back field again.'],
    ['Moose crossing sign', 'He was here first. He has made that clear.'],
    ['Toque for the scarecrow', 'It is minus thirty. Have a heart.'],
  ],
  US: [
    ['Cattle guard', 'The cows have learned to jump.'],
    ['Corn maze licence', 'Three tourists still have not come out.'],
    ['BBQ smoker repair', 'It smoked the shed. Delicious, but expensive.'],
    ['Rodeo insurance', 'The peppers will not stop entering.'],
  ],
  BR: [
    ['Rain gutters', 'It rained for nine days. The tenth day too.'],
    ['Samba school dues', 'The pineapples insist on parade practice.'],
    ['Football pitch rental', 'The berries need a home ground.'],
    ['Hammock tax', 'Every worker wants one. Fair enough.'],
  ],
  MA: [
    ['Well digging', 'The oasis is lovely. The bucket rope is not.'],
    ['Mint tea supply', 'Three glasses per meeting. It adds up.'],
    ['Souk stall rent', 'Prime spot, between the olives and the lanterns.'],
    ['Camel parking', 'He does not fit in the barn.'],
  ],
  FR: [
    ['Bakery tab', 'Two baguettes a day adds up. Three on Sundays.'],
    ['Lavender still', 'The perfume is free. The still is not.'],
    ['Château roof tiles', 'The marquis next door complains about the view.'],
    ['Root cellar lock', 'The artichoke knight lost the key. Again.'],
  ],
  CN: [
    ['Terrace repair', 'The steps washed out. All nine hundred of them.'],
    ['Tea house rent', 'Long talks need comfortable chairs.'],
    ['Kite festival fee', 'The bok choy entered the advanced category.'],
    ['Dragon boat paint', 'Bright red, two coats. The river is watching.'],
  ],
  JP: [
    ['Snow shovels', 'Hokkaido snow is not a suggestion.'],
    ['Hot spring pass', 'The pumpkin needs a long soak after work.'],
    ['Bullet train freight', 'The wasabi gets there before you do.'],
    ['Ash cleanup', 'The volcano sneezed. On everything.'],
  ],
};

const SIGNATURE: Record<string, string> = {
  ca_charlottetown: 'gale', ca_gatineau: 'frost', ca_toronto: 'rain', ca_saskatoon: 'gale', ca_kelowna: 'frost',
  us_austin: 'stampede', us_desmoines: 'market', us_circleville: 'fair', us_vidalia: 'fair',
  br_belem: 'rain', br_petrolina: 'market', br_sinop: 'gale', br_bento: 'fair',
  ma_marrakech: 'market', ma_meknes: 'stampede', ma_larache: 'gale', ma_fes: 'market',
  fr_avignon: 'stampede', fr_beaune: 'market', fr_tours: 'fair', fr_agen: 'gale',
  cn_guilin: 'rain', cn_hangzhou: 'fair', cn_wuhan: 'frost', cn_chengdu: 'market',
  jp_sapporo: 'frost', jp_shizuoka: 'market', jp_kagoshima: 'gale',
};

/** Money steps up at every border (v0.13; Navid, 10 Nov: "we have to make the new bills much more expensive so that it
 *  cannot be paid by old farms at all. bills as well as upgrades… the upgrades jump from 50 to 200 then to 2000"):
 *  what crops pay, the bills, the record and the bounty of a farm are this many times the country before, on top of
 *  the farm-by-farm growth. Upgrades step with them (workshop.ts, tools.ts, tree.ts), so the balance inside a country
 *  is the same as without the step, and money from an earlier country buys little in the next. */
export const BORDER_STEP = 4;
/** Borders crossed before farm k (0 in Canada, 6 in Japan). */
export function borders(k: number): number {
  const c = ROUTE[Math.max(0, Math.min(ROUTE.length - 1, k))];
  return Math.max(0, COUNTRIES.findIndex(x => x.code === c.country));
}
export function borderMul(k: number): number {
  return Math.pow(BORDER_STEP, borders(k));
}

/**
 * Where town k sits on the money curves below (0.15). The curves were measured on the road of 0.13/0.14 (Canada 6
 * towns, the USA 3, Brazil 5, Morocco 3, France 5, China 3, Japan 3); Navid set Canada 5, Japan 3 and the others 4 on
 * 15 Nov. Each country's towns are spread over its old stretch of the curves, so a country starts and ends at the same
 * money, power and toughness as before, and the upgrade prices (which step at the old borders) stay in step.
 */
const OLD_SPAN: Record<CountryCode, [number, number]> = { CA: [0, 5], US: [6, 8], BR: [9, 13], MA: [14, 16], FR: [17, 21], CN: [22, 24], JP: [25, 27] };
export function econPos(k: number): number {
  const last = ROUTE.length - 1;
  if (k > last) return econPos(last) + (k - last);
  if (k < 0) return k;
  const c = ROUTE[k];
  const towns = ROUTE.filter(x => x.country === c.country);
  const i = towns.indexOf(c);
  const [a, b] = OLD_SPAN[c.country];
  return towns.length > 1 ? a + ((b - a) * i) / (towns.length - 1) : a;
}

/** What a steady player (one who upgrades as they go) earns in a day at route index k, with the whole ladder out.
 * Measured with bot playthroughs (a player who buys upgrades with every spare dollar and pays its bills at about
 * two thirds of what its field makes): about 30% more each farm through Canada, then 45% more each farm (positions
 * on the old road, econPos). */
const DAYREF_CANADA = [230, 330, 430, 560, 720, 1000];
function dayRefAt(x: number): number {
  if (x <= 0) return DAYREF_CANADA[0];
  if (x < DAYREF_CANADA.length - 1) {
    const i = Math.floor(x);
    return DAYREF_CANADA[i] * Math.pow(DAYREF_CANADA[i + 1] / DAYREF_CANADA[i], x - i);
  }
  if (x <= DAYREF_CANADA.length - 1) return DAYREF_CANADA[DAYREF_CANADA.length - 1];
  // the USA starts at about half again Kelowna: a player arrives with Canada's boss bounty and twelve days of upgrades
  return 1550 * Math.pow(1.45, x - DAYREF_CANADA.length);
}
export function dayRef(k: number): number {
  const x = econPos(k);
  // money steps up at every border
  return Math.round(dayRefAt(x) * (x < DAYREF_CANADA.length ? 1 : borderMul(k)));
}

/**
 * An on-track player's field power when a farm starts at route index k (fieldPower in power.ts: damage per second
 * on one crop, crits averaged in, times the swing's area or the seeds per shot). Bot playthroughs on 29 Oct followed
 * 3.43 × 1.35^k through Canada within about 15%; from Des Moines it grows 50% a farm (the scythe, the flame weeder
 * and their attachments), 20% from Bento (the seed blaster) and 7% from Beaune (most upgrades are long builds).
 * (Positions on the old road, econPos.)
 */
function expectedAt(x: number): number {
  const c = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  return Math.exp(Math.log(3.43) + c(x, 0, 6) * Math.log(1.35) + c(x - 6, 0, 6) * Math.log(1.5) + c(x - 12, 0, 5) * Math.log(1.2) + Math.max(0, x - 17) * Math.log(1.07));
}
export function expectedPower(k: number): number {
  return expectedAt(econPos(k));
}

/**
 * Crops on a farm are tougher for a player ahead of the expected power and softer for one behind it: by the square
 * root of the ratio, set when the farm starts. An upgrade or a new tool still pays, but half as steeply, so a strong
 * player can't run away from the bills and a weak one can catch up (29 Oct: fixed toughness swung between a wall
 * in the USA and a runaway in Brazil, where a bot with the scythe and the flame weeder one-shot every crop).
 */
export function toughnessFor(k: number, power: number): number {
  const r = power / expectedPower(k);
  if (!(r > 0) || !Number.isFinite(r)) return 1;
  return Math.min(4, Math.max(0.5, Math.sqrt(r)));
}

/** How tough crops are by route index (before toughnessFor): 13.5% a farm through Canada, 22.5% into Austin, then in
 * step with the expected power, so the bigger crops of a ladder keep taking a few cuts and upgrades keep paying
 * (positions on the old road, econPos). */
export function hpMul(k: number): number {
  const x = econPos(k);
  const austin = 0.45 * Math.pow(1.135, 6) * 1.08;
  if (x <= 5) return 0.45 * Math.pow(1.135, x);
  if (x < 6) {
    const kelowna = 0.45 * Math.pow(1.135, 5);
    return kelowna * Math.pow(austin / kelowna, x - 5);
  }
  return (austin * expectedAt(x)) / expectedAt(6);
}

/** What crops are worth by route index: 11.5% a farm through Austin, 37% after, so an on-track player's day keeps up
 * with the bills (45% a farm) while the market stall, skills and a fuller field add the rest. */
export function valMul(k: number): number {
  const x = econPos(k);
  return Math.pow(1.115, Math.min(6, x)) * Math.pow(1.37, Math.max(0, x - 6)) * borderMul(k);
}

/**
 * Bills from the bots (v0.12, Navid 5 Nov: "you did bad even with an ad, you should not have enough to pay the bill.
 * you are medium and with ad yes you can pay the bill, you are great? you don't need to watch the ad. but my great i
 * mean like computer great, not human great"). scripts/bots.mjs plays real 15 s days with three players (strong,
 * average, weak) and on-track builds; these numbers are what the average one earned.
 *
 * DAY_SHAPES: an average day by day of the farm, against its settled days. In Canada and the USA (two runs of days
 * 1, 2, 3, 5, 8, 12 and 19 per player and farm) day 1 is carrots only, golden corn makes day 3 the best day, and after
 * that each tougher crop pays about what it costs to cut. Later farms (one run of days 1, 3, 8 and 19 on Belém,
 * Bento, Avignon, Agen, Sapporo and Kagoshima) are front-loaded: an on-track build cuts the first crops as fast as
 * they come, and the longer ladders get tough. Between the rows the shape is blended by farm.
 */
// v0.13 (the road): from the second farm on the field opens with vegetables the player knows, so the days are about
// even: bots on 11 Nov (two runs a farm through the USA, one on every other later farm) earned about 40% more on
// day 1 (a fresh field) in Canada and the USA and an even day from Brazil on.
// 0.14: a town's field opens with the runaways already caught in the country (or, in a country's first town, its
// runaway) and value per cut is about the same for every crop size, so a town's days are about even.
// Bots on 15 Nov: the first town's days are even too (carrots only, all town long).
const DAY_SHAPES: Array<[k: number, days: number[], later: number]> = [
  [0, [1, 1, 1, 1, 1], 1],
  [1, [1, 1, 1, 1, 1], 1],
];
function shapeRow(i: number, d: number): number {
  const [, days, later] = DAY_SHAPES[i];
  return d >= 1 && d <= days.length ? days[d - 1] : later;
}
export function dayShape(d: number, k = 0): number {
  const R = DAY_SHAPES;
  if (k <= R[0][0]) return shapeRow(0, d);
  for (let i = 1; i < R.length; i++)
    if (k <= R[i][0]) {
      const t = (k - R[i - 1][0]) / (R[i][0] - R[i - 1][0]);
      return shapeRow(i - 1, d) * (1 - t) + shapeRow(i, d) * t;
    }
  return shapeRow(R.length - 1, d);
}
/** An average player's settled day on farm k, as a share of dayRef(k) (measured on 25 s days before v0.12). */
const AVG_POINTS: Array<[k: number, share: number]> = [
  // 0.15, evening of 15 Nov (bots on the thinner field: 3 crops and a sprout every 2 s on a bare field, half a crop
  // and 5% faster a Richer soil level; average and strong players, on-track builds, days 1 to 6 of every town). The
  // average bot cuts about 11 crops a day in Charlottetown (26 before), 17 to 24 through the USA, 30 to 55 later.
  // 0.15.1 (18 Nov) keeps it: the field is thinner again (1 crop, a sprout every 5 s, crops that ripen in 1.8 s) and
  // each crop pays more instead (FIELD_PAY), so a day earns about what it did (Charlottetown, 0.066, is measured
  // again: about 0.73 of its 0.15.0 day). Bills follow each player's own days, so this table sets no ads: billPressure
  // does.
  [0, 0.066], [1, 0.182], [2, 0.155], [3, 0.235], [4, 0.237],
  [5, 0.197], [6, 0.183], [7, 0.137], [8, 0.222],
  [9, 0.335], [10, 0.317], [11, 0.285], [12, 0.327],
  [13, 0.398], [14, 0.358], [15, 0.277], [16, 0.358],
  [17, 0.32], [18, 0.304], [19, 0.214], [20, 0.243],
  [21, 0.264], [22, 0.241], [23, 0.217], [24, 0.244],
  [25, 0.205], [26, 0.227], [27, 0.235],
];
/**
 * What a crop pays more, by town, on the field of 0.15.1 (Navid, 18 Nov: a bare field of 1 crop and a sprout every 5 s,
 * crops that take 1.8 s to ripen). The bots cut about 4 crops a day in Charlottetown (11 on the 0.15.0 field), 10 to 14
 * through the USA and 17 to 37 later, and earned 0.27 to 0.8 of their 0.15.0 day; each crop pays the inverse (smoothed
 * over five towns, and kept rising town by town), and a day earns about what it did: the money on screen keeps its size,
 * and the bills their amounts. Charlottetown's crops pay 2.7 times, which brings its day to about 0.73 of 0.15.0's,
 * and its average day (AVG_POINTS) is that, so the first town still leaves money over and needs no ads.
 */
const FIELD_PAY = [
  2.7, 2.41, 2.32, 2.07, 2.03, 2.03, 1.93, 1.85, 1.84, 1.87, 1.81, 1.72, 1.69, 1.7, 1.66, 1.59, 1.58, 1.6, 1.57, 1.46, 1.45,
  1.47, 1.41, 1.37, 1.4, 1.48, 1.44, 1.48,
];
export function fieldPay(k: number): number {
  return FIELD_PAY[Math.max(0, Math.min(FIELD_PAY.length - 1, k))];
}
export function avgDayShare(k: number): number {
  const P = AVG_POINTS;
  if (k <= P[0][0]) return P[0][1];
  for (let i = 1; i < P.length; i++) if (k <= P[i][0]) { const [k0, a] = P[i - 1], [k1, b] = P[i]; return a + ((b - a) * (k - k0)) / (k1 - k0); }
  return P[P.length - 1][1];
}
/** What an average player earns on day `d` of farm k. */
export function avgDay(k: number, d: number): number {
  return dayRef(k) * avgDayShare(k) * dayShape(d, k);
}
/**
 * How hard town k's bills are, against an average player's day there (AVG_POINTS: the bots on on-track builds). Navid
 * (14-15 Nov): "less ads in the beginning ... stop the ad rise at medium 6 or 7 per 10 minute even less its ok", then
 * "change the ads to play from town 2 and then in town 3 more than 2, then in town 4 full ads". The first town leaves
 * money over for upgrades; the second asks a whole day (the surprises, about 8% of a day, make the ads); the third a
 * little more; from the fourth BILL_RATE, about 6 ads in ten minutes for an average player with the surprises and some
 * upgrades. A town's bills then follow the player's own days (paceMul), so this holds for weaker players too, and a
 * strong one needs about 2 or 3.
 * 0.15.1 (Navid, 18 Nov: "please make the game harder ... i don't know why you keep pushing the ads to be as minimum
 * as possible"): as bills follow each player's days, a harder field alone adds no ads; this is what does. Town 2 asks
 * 1.1 of a day, town 3 1.2 and from town 4 1.3 (were 1.0, 1.1, 1.15): about 7 to 8 ads in ten minutes from town 4
 * (about 5 before); the first town still needs none.
 * 0.16 (Navid, 19 Nov: "i was wrong about making it harder ... i cannot keep up and have to watch ads every day, even
 * i can't pay for skills. maybe make it a bit easier for everyone for the bill?"): a bill asks a little less than the
 * day it covers, so the bills can be paid without an ad and some money is left for skills: 0.6 of a day in the first
 * town, 0.8 in the second, 0.85 in the third and 0.9 from the fourth. Ads (the day doubled, free coins) now buy the
 * skills, which cost far more (tree.ts), and help when a surprise or a bad day comes.
 */
export const BILL_RATE = 0.9;
export function billPressure(k: number): number {
  if (k <= 0) return 0.6;
  if (k === 1) return 0.8;
  if (k === 2) return 0.85;
  return BILL_RATE;
}

// ---------------------------------------------------------------- the player's pace (0.15)

/**
 * Bills follow the player's own days (0.15; Navid, 15 Nov: "strong players also have to watch ads ... your idea that
 * the bills have to be based on their own earning is a smart move", then "ads should be for everyone"). The pace is
 * what the player's recent days earned against an average player's day in the same town (1: average), perks taken
 * out; the first day sets it. When a town starts, its bills, tax, repairs, the King's bounty and the tree's prices are
 * its own times paceMul(pace), and they stay so until the town ends: all the way, above the average as below it, so a
 * strong player needs about as many ads as anyone.
 */
export const PACE_LEARN = 0.25;
export const PACE_UP = 1;
/** The pace stays in this range (a player eight times an average one still gets their own bills). */
export const PACE_MIN = 0.25;
export const PACE_MAX = 8;
/** The pace after one more day that earned `rel` times an average day (a moving average, about the last week). */
export function updatePace(pace: number | undefined, rel: number): number {
  const r = Math.max(PACE_MIN, Math.min(PACE_MAX, Number.isFinite(rel) ? rel : 1));
  const p = pace != null && pace > 0 && Number.isFinite(pace) ? pace : r;
  return Math.round((p * (1 - PACE_LEARN) + r * PACE_LEARN) * 1000) / 1000;
}
/** The bill scale for a pace (1 with no days yet). */
export function paceMul(pace: number | undefined): number {
  if (pace == null || !(pace > 0) || !Number.isFinite(pace)) return 1;
  const p = Math.max(PACE_MIN, Math.min(PACE_MAX, pace));
  return Math.round((p <= 1 ? p : Math.pow(p, PACE_UP)) * 100) / 100;
}

/** Each bill of a town asks this much more per day than the one before: upgrades should keep up. */
export const BILL_CLIMB = 0.01;

function moneyStep(v: number): number {
  // three figures from a million up ($1.23M, $45.6M, $1.07B)
  if (v >= 1_000_000) return Math.pow(10, Math.floor(Math.log10(v)) - 2);
  return v < 100 ? 5 : v < 1000 ? 10 : v < 10000 ? 50 : v < 100000 ? 100 : 500;
}
function roundMoney(v: number): number {
  const st = moneyStep(v);
  return v < 100 ? Math.max(10, Math.round(v / st) * st) : Math.round(v / st) * st;
}
/**
 * Clean amounts for everything the bank asks (0.15; Navid, 15 Nov: "make sure the bills are clean numbers like 5000$
 * or 8000$. Don't make something like 4987$ which may rise the attention of players"): one of these times a power of
 * ten ($1,100, $2,800, $5,000, $75,000, $1.3M), so a bill looks set by the bank, not worked out from the player's days.
 */
const NICE = [1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.8, 2, 2.2, 2.5, 2.8, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 9, 10];
function decade(v: number): number {
  let e = Math.pow(10, Math.floor(Math.log10(v)));
  if (v / e >= 10 - 1e-9) e *= 10;
  if (v / e < 1 - 1e-9) e /= 10;
  return e;
}
export function niceMoney(v: number): number {
  if (!(v > 0)) return 0;
  if (v < 10) return Math.max(5, Math.round(v / 5) * 5);
  const e = decade(v), f = v / e;
  let best = 1;
  for (const n of NICE) if (Math.abs(Math.log(f / n)) < Math.abs(Math.log(f / best))) best = n;
  return Math.round(best * e);
}
/** The smallest clean amount that is at least `v` (a bill never asks less per day than the one before). */
export function niceAtLeast(v: number): number {
  if (!(v > 0)) return 0;
  if (v <= 10) return Math.max(5, Math.ceil(v / 5 - 1e-9) * 5);
  const e = decade(v);
  for (const n of NICE) if (n * e >= v - 1e-6 * e) return Math.round(n * e);
  return Math.round(10 * e);
}

/** Rent or the bank's loan for every bill but the last, which is the town's big bill (the same every time). */
function billKinds(city: CityDef, k: number, n: number): BillKind[] {
  const rnd = seeded(hashId(city.id) ^ 0x9e3779b9);
  const out: BillKind[] = [];
  for (let i = 0; i < n - 1; i++) out.push(k === 0 && i === 0 ? 'bank' : rnd() < 0.5 ? 'rent' : 'bank');
  out.push('big');
  return out;
}
export const BILL_NAME: Record<BillKind, [string, string]> = {
  rent: ['Rent', 'The landlord wants his field rent.'],
  bank: ['Bank loan', 'Grumble & Sons want their payment.'],
  big: ['The big bill', 'Pay it and the runaway is caught.'],
};
// (the country lists of funny bills from 0.12 stay for the daily farm and future use)
void GENERIC_BILLS;
void LOCAL_BILLS;

const LAST_RATE = new Map<number, number>();
/** What town k's last bill asks per day before rounding (cached; the bank's rate never goes down, see planFor). */
function lastRate(k: number): number {
  let v = LAST_RATE.get(k);
  if (v == null) {
    planFor(ROUTE[k].id);
    v = LAST_RATE.get(k) ?? 0;
  }
  return v;
}
export function planFor(cityId: string, scale = 1): CityPlan {
  scale = Number.isFinite(scale) && scale > 0 ? Math.round(Math.max(0.3, Math.min(3, scale)) * 100) / 100 : 1;
  const k = routeIndex(cityId);
  if (k < 0) throw new Error('unknown city ' + cityId);
  const city = ROUTE[k];
  const boss = isBossCity(cityId);
  const schedule = billSchedule(k);
  const n = schedule.length;
  const ref = dayRef(k);
  const mul = billMul(cityId);
  const kinds = billKinds(city, k, n);
  const press = billPressure(k);
  // 0.14 (Navid, 11 Nov: "bills will get cheap with new city/farm"): a short bill asks less money than a long one, but
  // no bill asks less per day than the one before it, here and in the town before (each asks 1% more before rounding)
  // (0.15: with the player's scale on both, so a player at a steady pace never sees them get cheaper either). The rule
  // holds for the bank's own rate; the amounts are then rounded to clean money (up or down, at most about 6%), since a
  // floor on rounded amounts kept stepping up to the next clean amount (+11% a bill in Des Moines).
  let prevRate = k > 0 ? lastRate(k - 1) * scale : 0;
  const bills: Bill[] = kinds.map((kind, i) => {
    const days = schedule[i];
    const from = i ? billDueDay(i - 1, k) + 1 : 1, to = billDueDay(i, k);
    let sum = 0;
    for (let d = from; d <= to; d++) sum += avgDay(k, d);
    // a boss town: time spent on the King earns nothing, so its bills are lighter; the bounty helps with the big bill
    let raw = sum * press * (1 + BILL_CLIMB * i) * mul * (boss && i < n - 1 ? 0.85 : 1) * scale;
    if (raw / days < prevRate) raw = prevRate * days;
    prevRate = raw / days;
    if (scale === 1 && i === n - 1) LAST_RATE.set(k, prevRate);
    const amt = niceMoney(raw);
    return { name: BILL_NAME[kind][0], note: BILL_NAME[kind][1], kind, days, amt };
  });
  // the goat and the crows come after two bills on the first farms, from the start later on
  const unlock = Math.min(5, Math.floor(k / 2));
  // the field (road.ts): the country's runaways caught so far, then this town's, the biggest crop. Sizes come from the
  // ladder; a field of one or two kinds uses its middle (a country's first town is not all tiny crops), except the
  // very first town, whose carrots are the ladder's smallest
  const kindsHere = fieldKinds(k, n);
  const top = LADDER_VAL.length - 1;
  const start = k === 0 ? 0 : Math.max(0, 3 - kindsHere.length);
  // 0.16 (Navid, 18 Nov: "for first levels the sickle can cut carrot in one cut which is wrong"; then "try 2"): no
  // crop falls to one cut of a sickle without upgrades: every town's softest crop takes at least 2 (MIN_CROP_HP: health
  // on the town's first day, a sickle without upgrades hitting for 1)
  const floorHp = (k === 0 ? FIRST_TOWN_CROP_HP : MIN_CROP_HP) / hpMul(k);
  const stages: StageCrop[] = kindsHere.map((f, i) => ({ type: f.type, stage: f.stage, debut: f.debut, val: LADDER_VAL[Math.min(top, start + i)], hp: Math.max(floorHp, LADDER_HP[Math.min(top, start + i)]) }));
  const crops: CropWeight[] = [];
  kindsHere.forEach((f, i) => {
    const w = LADDER_W[Math.min(top, start + i)];
    // the runaway: rare once spotted, everywhere from the middle of the town
    if (f.common != null && f.common > f.stage) {
      crops.push([f.type, w * 0.3, f.stage]);
      crops.push([f.type, w * 0.7, f.common]);
    } else crops.push([f.type, w, f.stage]);
  });
  void FIELD_KINDS;
  const cropVal: Record<string, number> = {};
  const cropHp: Record<string, number> = {};
  for (const s of stages) {
    cropVal[s.type] = s.val;
    cropHp[s.type] = s.hp;
  }
  const totalDays = billDueDay(n - 1, k);
  const avgHere = ref * avgDayShare(k);
  // Bosses take longer in later countries: 14 s of steady hitting in Canada, 38 s in Japan.
  const ci = COUNTRIES.findIndex(c => c.code === city.country);
  const bossFight: BossFight | undefined = boss
    ? { ...BOSSES[city.country], focusSec: 14 + 4 * ci, share: 0.5, uptime: 0.45, hpMul: Math.round(0.6 * (12 + 0.45 * k) * totalDays), bounty: niceMoney(ref * mul * scale) }
    : undefined;
  return {
    cityId,
    country: city.country,
    index: k,
    boss,
    bills,
    hp: hpMul(k),
    // crops toughen a little each day; each bill brings a tougher crop instead of toughening the old ones
    hpDay: 0.02,
    hpBill: 1,
    // (0.15.1: and what the thinner field makes up for, FIELD_PAY)
    val: valMul(k) * fieldPay(k),
    density: 1 + 0.02 * k,
    spawn: 1 + 0.015 * k,
    dayBase: DAY_SECONDS,
    dayBonus: Math.floor(k / 10),
    unlock,
    goldAt: unlock + 2,
    crops,
    cropBy: 'bill',
    stages,
    runaway: kindsHere.length ? kindsHere[kindsHere.length - 1].type : '',
    // surprises (0.14): none in the first town; a tax about half an average day, a repair a little under a day
    tax: k > 0 ? niceMoney(avgHere * 0.5 * mul * scale) : 0,
    repair: k > 0 ? niceMoney(avgHere * 0.8 * mul * scale) : 0,
    cropVal,
    cropHp,
    totalDays,
    spare: niceMoney(bills[n - 1].amt * 0.5),
    // 0.16 (Navid, 19 Nov, of the star for money kept: "just because i didn't spend my money on skill the last night
    // i won another star???"): the second star is for playing well, a day that earns half again an average day here
    // (a quarter again in a King's town, where time on the King earns nothing). The same for every player.
    bigDay: niceMoney((boss ? 1.25 : BIG_DAY) * ref * avgDayShare(k)),
    signatureEvent: SIGNATURE[cityId] || 'market',
    dayRef: ref,
    billMul: mul,
    scale,
    ...(bossFight ? { bossFight } : {}),
  };
}

/** Tree credit for winning a farm the first time: two of its average days (a boss farm: four). */
export function winCredit(plan: CityPlan): number {
  return roundMoney(plan.dayRef * avgDayShare(plan.index) * (plan.boss ? 4 : 2));
}
/** Tree credit for the day's first gold medal on the daily farm: an average day on the farthest farm reached. */
export function goldCredit(k: number): number {
  return roundMoney(dayRef(k) * avgDayShare(k));
}

const STAPLE_NAMES: Record<string, string> = {
  carrot: 'Gym-Bro Carrot', radish: 'Runaway Radish', cabbage: 'Lord Cabbage', onion: 'Drama-Queen Onion',
  pumpkin: 'Grandma Pumpkin', berry: 'Briar-Berry Twins', potato: 'Couch Potato', golden: 'Golden Corn',
};

/** A crop's name as the game shows it. */
export function cropName(type: string): string {
  if (STAPLE_NAMES[type]) return STAPLE_NAMES[type];
  for (const c of COUNTRIES) {
    const i = c.trio.indexOf(type);
    if (i >= 0) return c.trioNames[i];
  }
  return type.replace(/_/g, ' ');
}

export function allPlans(): CityPlan[] {
  return ROUTE.map(c => planFor(c.id));
}

export { COUNTRIES };
