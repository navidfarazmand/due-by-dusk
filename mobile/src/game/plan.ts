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
  /** The rival's best day here; beating it takes the city crown. */
  record: number;
  totalDays: number;
  /** Keep this much cash after paying the deed for the second star. */
  spare: number;
  /** The day's gazette event this city leans towards (every other day). */
  signatureEvent: string;
  /** What a steady player earns on a day here once the whole ladder is out (used for bills, records, ad rewards). */
  dayRef: number;
  /** How heavy this farm's bills are against what its field pays. */
  billMul: number;
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

/**
 * A field's vegetables by size, smallest first: value, toughness and how often each comes up. Value per cut stays
 * about the same, so a tougher crop pays more only for a player who keeps up with it. On a farm, the vegetables the
 * player has known longest are the small ones and the farm's own new vegetable is the biggest.
 */
export const LADDER_VAL = [1, 3, 5, 7.5, 10, 12.5, 15, 18];
export const LADDER_HP = [1, 2.5, 4.5, 7, 10, 13, 16.5, 20];
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
  ca_charlottetown: 'gale', ca_gatineau: 'frost', ca_toronto: 'rain', ca_leamington: 'fair', ca_saskatoon: 'gale', ca_kelowna: 'frost',
  us_austin: 'stampede', us_desmoines: 'market', us_vidalia: 'fair',
  br_belem: 'rain', br_petrolina: 'market', br_sinop: 'gale', br_ribeirao: 'market', br_bento: 'fair',
  ma_marrakech: 'market', ma_meknes: 'stampede', ma_fes: 'market',
  fr_avignon: 'stampede', fr_beaune: 'market', fr_tours: 'fair', fr_roscoff: 'rain', fr_agen: 'gale',
  cn_guilin: 'rain', cn_hangzhou: 'fair', cn_chengdu: 'market',
  jp_sapporo: 'frost', jp_aomori: 'frost', jp_shizuoka: 'market', jp_kyoto: 'fair', jp_kagoshima: 'gale',
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

/** What a steady player (one who upgrades as they go) earns in a day at route index k, with the whole ladder out.
 * Measured with bot playthroughs (a player who buys upgrades with every spare dollar and pays its bills at about
 * two thirds of what its field makes): about 30% more each farm through Canada, then 45% more each farm. */
const DAYREF_CANADA = [230, 330, 430, 560, 720, 1000];
export function dayRef(k: number): number {
  if (k < DAYREF_CANADA.length) return DAYREF_CANADA[k];
  // the USA starts at about half again Kelowna: a player arrives with Canada's boss bounty and twelve days of upgrades
  // (and money steps up at every border)
  return Math.round(1550 * Math.pow(1.45, k - DAYREF_CANADA.length) * borderMul(k));
}

/**
 * An on-track player's field power when a farm starts at route index k (fieldPower in power.ts: damage per second
 * on one crop, crits averaged in, times the swing's area or the seeds per shot). Bot playthroughs on 29 Oct followed
 * 3.43 × 1.35^k through Canada within about 15%; from Des Moines it grows 50% a farm (the scythe, the flame weeder
 * and their attachments), 20% from Bento (the seed blaster) and 7% from Beaune (most upgrades are long builds).
 */
export function expectedPower(k: number): number {
  let v = 3.43 * Math.pow(1.35, Math.min(6, Math.max(0, k)));
  for (let i = 7; i <= k; i++) v *= i <= 12 ? 1.5 : i <= 17 ? 1.2 : 1.07;
  return v;
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
 * step with the expected power, so the bigger crops of a ladder keep taking a few cuts and upgrades keep paying. */
export function hpMul(k: number): number {
  const austin = 0.45 * Math.pow(1.135, 6) * 1.08;
  if (k <= 5) return 0.45 * Math.pow(1.135, k);
  if (k === 6) return austin;
  return (austin * expectedPower(k)) / expectedPower(6);
}

/** What crops are worth by route index: 11.5% a farm through Austin, 37% after, so an on-track player's day keeps up
 * with the bills (45% a farm) while the market stall, skills and a fuller field add the rest. */
export function valMul(k: number): number {
  return Math.pow(1.115, Math.min(6, k)) * Math.pow(1.37, Math.max(0, k - 6)) * borderMul(k);
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
  // 0.14 (the runaways, bots on 15 Nov: average and strong players, on-track builds, days 1 to 5, about 300 days):
  // a town's field is the country's runaways caught so far plus its own, so a town's day no longer follows the old
  // ladder. Charlottetown (carrots only) pays about half the old share; Saskatoon, Kelowna, Austin and the capitals
  // more. Towns in between are interpolated.
  [0, 0.172], [1, 0.349], [2, 0.328], [3, 0.403], [4, 0.521], [5, 0.484], [6, 0.445], [7, 0.331], [8, 0.303],
  [9, 0.39], [11, 0.552], [13, 0.455], [14, 0.459], [16, 0.481], [17, 0.351], [19, 0.287], [21, 0.336], [22, 0.284],
  [24, 0.385], [25, 0.24], [27, 0.315],
];
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
 * How hard town k's bills are (0.14; Navid, 14 Nov: "less ads in the beginning of the game, and then after some
 * cities the difficulty increases... stop the ad rise at medium 6 or 7 per 10 minute even less its ok"): what a bill
 * asks per day, against an average player's day there (AVG_POINTS, measured with on-track builds). The first two towns
 * leave money over for upgrades, so they need no ad; the third and fourth ask most of a day; from the fifth a bill asks
 * a whole average day. With the surprises (about 8% of a day) an average player who keeps up with upgrades is short
 * about 10% of a day, two ads in ten minutes, and one who falls behind (crops soften for a weaker build, but not all
 * the way) about six; a strong one needs none. It stops rising there.
 */
export const BILL_RATE = 1;
export function billPressure(k: number): number {
  if (k <= 0) return 0.7;
  if (k === 1) return 0.75;
  if (k === 2) return 0.9;
  if (k === 3) return 0.95;
  return BILL_RATE;
}
/** Each bill of a town asks this much more per day than the one before: upgrades should keep up. */
export const BILL_CLIMB = 0.01;
/** The rival's record: this many average settled days in one. The strong bot's best day (day 3, golden corn) is 1.8 to
 *  3 of them from Gatineau on, the average one's 1.15 to 1.5; on the first farms the two are close, so the record
 *  starts lower there (1.3 on Charlottetown) and a good first run can take the crown. */
export const RECORD_DAYS = 1.6;

function moneyStep(v: number): number {
  // three figures from a million up ($1.23M, $45.6M, $1.07B)
  if (v >= 1_000_000) return Math.pow(10, Math.floor(Math.log10(v)) - 2);
  return v < 100 ? 5 : v < 1000 ? 10 : v < 10000 ? 50 : v < 100000 ? 100 : 500;
}
function roundMoney(v: number): number {
  const st = moneyStep(v);
  return v < 100 ? Math.max(10, Math.round(v / st) * st) : Math.round(v / st) * st;
}
/** The smallest round amount that is at least `p` (a bill never asks less per day than the one before). */
function atLeast(p: number): number {
  const st = moneyStep(p);
  return Math.ceil(p / st - 1e-9) * st;
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
/** What town k's last bill asks per day (cached: every bill asks more per day than the one before). */
function lastRate(k: number): number {
  let v = LAST_RATE.get(k);
  if (v == null) {
    const b = planFor(ROUTE[k].id).bills;
    const last = b[b.length - 1];
    LAST_RATE.set(k, (v = last.amt / last.days));
  }
  return v;
}
export function planFor(cityId: string): CityPlan {
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
  let prevRate = k > 0 ? lastRate(k - 1) : 0;
  const bills: Bill[] = kinds.map((kind, i) => {
    const days = schedule[i];
    const from = i ? billDueDay(i - 1, k) + 1 : 1, to = billDueDay(i, k);
    let sum = 0;
    for (let d = from; d <= to; d++) sum += avgDay(k, d);
    // a boss town: time spent on the King earns nothing, so its bills are lighter; the bounty helps with the big bill
    const raw = sum * press * (1 + BILL_CLIMB * i) * mul * (boss && i < n - 1 ? 0.85 : 1);
    let amt = roundMoney(raw);
    if (amt / days < prevRate) amt = atLeast(prevRate * days);
    prevRate = amt / days;
    return { name: BILL_NAME[kind][0], note: BILL_NAME[kind][1], kind, days, amt };
  });
  // the goat and the crows come after two bills on the first farms, from the start later on
  const unlock = Math.min(5, Math.floor(k / 2));
  // the field (road.ts): the country's runaways caught so far, then this town's, the biggest crop. Sizes come from the
  // ladder; a field of one or two kinds uses its middle (a country's first town is not all tiny crops), except the
  // very first town, whose carrots fall to one swipe
  const kindsHere = fieldKinds(k, n);
  const top = LADDER_VAL.length - 1;
  const start = k === 0 ? 0 : Math.max(0, 3 - kindsHere.length);
  const stages: StageCrop[] = kindsHere.map((f, i) => ({ type: f.type, stage: f.stage, debut: f.debut, val: LADDER_VAL[Math.min(top, start + i)], hp: LADDER_HP[Math.min(top, start + i)] }));
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
    ? { ...BOSSES[city.country], focusSec: 14 + 4 * ci, share: 0.5, uptime: 0.45, hpMul: Math.round(0.6 * (12 + 0.45 * k) * totalDays), bounty: roundMoney(ref * mul) }
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
    val: valMul(k),
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
    tax: k > 0 ? roundMoney(avgHere * 0.5 * mul) : 0,
    repair: k > 0 ? roundMoney(avgHere * 0.8 * mul) : 0,
    cropVal,
    cropHp,
    // the rival's best day: about a good day with the whole ladder out, a little more on later farms, so a good
    // player can take the crown on a first run (stars open the next country)
    record: roundMoney(ref * avgDayShare(k) * (RECORD_DAYS - 0.3 * Math.max(0, 1 - k / 2)) * mul),
    totalDays,
    spare: roundMoney(bills[n - 1].amt * 0.5),
    signatureEvent: SIGNATURE[cityId] || 'market',
    dayRef: ref,
    billMul: mul,
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
