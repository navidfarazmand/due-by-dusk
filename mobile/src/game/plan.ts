// City plans: what each of the 30 farms asks of the player. Pure data and maths, no DOM, so it can be tested.
//
// A farm is a run of bills; the last one is the deed. v0.12 (Navid, 5 Nov): the first bill is due after 2 days, the
// next after 3, then 4, then 5 (and 5 from then on). v0.13 (Navid, 10 Nov; src/game/road.ts): the farms are one road.
// A vegetable is met once: Charlottetown brings one with each bill, every later farm opens with vegetables the player
// knows and brings its own new one when the first bill is paid. Bigger crops pay more and take more cuts. Bills
// follow what the field can pay, tuned with bots so a weak player can't pay even with an ad, an average one pays
// with one ad, and a computer-strong one needs none. Farm by farm, crops get tougher (hp) and pay more (val); at
// every border money steps up (BORDER_STEP): what crops pay, the bills and the upgrades of that country's reach.

import { COUNTRIES, ROUTE, type CityDef, type CountryCode, cityById, countryOf, isBossCity, routeIndex } from './world';
import { fieldKinds } from './road';

export interface Bill {
  name: string;
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

/** Bills per farm in each country (the boss farm has one more). */
export const BILL_COUNT: Record<CountryCode, number> = { CA: 5, US: 5, BR: 6, MA: 6, FR: 6, CN: 7, JP: 7 };
/** Days a bill gives you, from the one before (Navid, 5 Nov: 2, 3, 4, 5, then 5). */
export function billDays(i: number, k = 0): number {
  // v0.13 (Navid, 11 Nov: "bills will get cheap with new city/farm"): the 2, 3, 4, 5 days stay on the first farm,
  // where they teach the game; from the second farm on every bill gives 4 days, so a farm's first bill is not a
  // small two-day bill after the last farm's five-day deed
  if (k > 0) return LATER_BILL_DAYS;
  return Math.min(5, 2 + Math.max(0, i));
}
export const LATER_BILL_DAYS = 4;
/** The farm's day on which bill `i` is due. */
export function billDueDay(i: number, k = 0): number {
  let d = 0;
  for (let j = 0; j <= i; j++) d += billDays(j, k);
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
const DAY_SHAPES: Array<[k: number, days: number[], later: number]> = [
  [0, [0.61, 0.88, 1.15, 1.13, 1.11], 0.96],
  [8, [1.4, 1.1, 1.0, 1.0, 1.0], 1],
  [13, [1.0, 1.0, 1.0, 1.0, 1.0], 1],
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
  // v0.13 (the road, bots on 11 Nov): the field no longer starts again on carrots, so an average day pays about a
  // third more than 0.12's measurements (×1.15 on Gatineau, ×1.38 on the rest of Canada, ×1.33 in the USA, ×1.4 in
  // Brazil, ×1.27 after); Charlottetown, which still brings a vegetable with each bill, is as it was
  [0, 0.307], [1, 0.392], [2, 0.349], [3, 0.442], [4, 0.414], [5, 0.406], [6, 0.327], [7, 0.41], [8, 0.334],
  [9, 0.406], [13, 0.37], [14, 0.364], [19, 0.277], [29, 0.182],
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
/** A bill asks for an average player's days plus this share of the best of them: one doubled day (an ad) covers it,
 *  so an average player pays with one ad, a computer-strong one with none, and a weak one not even with an ad. */
export const BILL_OVER = 0.5;
/** Each bill of a farm asks this much more than the one before, for the same days: upgrades should keep up. */
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
/** At least a little more than `p`, in round money (each bill of a farm asks more than the one before). */
function moreThan(p: number): number {
  const v = roundMoney(p * 1.01 + 5);
  return v > p ? v : p + moneyStep(p);
}

function pickBillNames(city: CityDef, k: number, n: number): Array<[string, string]> {
  const local = LOCAL_BILLS[city.country];
  const pool: Array<[string, string]> = [];
  // Mix the country's own bills with the classics, rotating so neighbouring cities differ.
  for (let i = 0; i < Math.max(local.length, GENERIC_BILLS.length); i++) {
    if (i < local.length) pool.push(local[(i + k) % local.length]);
    if (i < GENERIC_BILLS.length) pool.push(GENERIC_BILLS[(i + k * 2) % GENERIC_BILLS.length]);
  }
  const seen = new Set<string>();
  const out: Array<[string, string]> = [];
  // the first bill of every farm is the seed loan: the carrots have to come from somewhere
  out.push(GENERIC_BILLS[0]);
  seen.add(GENERIC_BILLS[0][0]);
  for (const b of pool) {
    if (out.length >= n - 1) break;
    if (seen.has(b[0])) continue;
    seen.add(b[0]);
    out.push(b);
  }
  out.length = Math.min(out.length, n - 1);
  out.push(['The deed', `Pay this and the ${city.short} farm is yours. Forever. Probably.`]);
  return out;
}

const DEEDS = new Map<number, number>();
/** What farm k's deed asks (cached: each farm's bills start above the farm before). */
function deedOf(k: number): number {
  let v = DEEDS.get(k);
  if (v == null) {
    const b = planFor(ROUTE[k].id).bills;
    DEEDS.set(k, (v = b[b.length - 1].amt));
  }
  return v;
}
export function planFor(cityId: string): CityPlan {
  const k = routeIndex(cityId);
  if (k < 0) throw new Error('unknown city ' + cityId);
  const city = ROUTE[k];
  const boss = isBossCity(cityId);
  const n = BILL_COUNT[city.country] + (boss ? 1 : 0);
  const ref = dayRef(k);
  const mul = billMul(cityId);
  const names = pickBillNames(city, k, n);
  // v0.13 (Navid, 11 Nov): bills never get cheaper from one farm to the next: the first bill asks more than the
  // farm before asked for its deed
  let prevAmt = k > 0 ? deedOf(k - 1) : 0;
  const bills: Bill[] = names.map((nm, i) => {
    const from = i ? billDueDay(i - 1, k) + 1 : 1, to = billDueDay(i, k);
    let sum = 0,
      best = 0;
    for (let d = from; d <= to; d++) {
      const v = avgDay(k, d);
      sum += v;
      best = Math.max(best, v);
    }
    return {
      name: nm[0],
      note: nm[1],
      days: billDays(i, k),
      // a boss farm: time spent on the boss earns nothing, so its bills are lighter; the bounty helps with the deed
      // later bills climb a little (a perk comes with every bill paid, and upgrades keep coming)
      amt: (prevAmt = Math.max(roundMoney((sum + BILL_OVER * best) * (1 + BILL_CLIMB * i) * mul * (boss ? (i === n - 1 ? 1 : 0.85) : 1)), moreThan(prevAmt))),
    };
  });
  // the goat and the crows come after two bills on the first farms, from the start later on
  const unlock = Math.min(5, Math.floor(k / 2));
  // the field's vegetables, smallest first (road.ts): the ones the player knows, then this farm's own new one
  const top = LADDER_VAL.length - 1;
  const stages: StageCrop[] = fieldKinds(k, n).map((f, i) => ({ type: f.type, stage: f.stage, debut: f.debut, val: LADDER_VAL[Math.min(top, i)], hp: LADDER_HP[Math.min(top, i)] }));
  const crops: CropWeight[] = stages.map((s, i) => [s.type, LADDER_W[Math.min(top, i)], s.stage]);
  const cropVal: Record<string, number> = {};
  const cropHp: Record<string, number> = {};
  for (const s of stages) {
    cropVal[s.type] = s.val;
    cropHp[s.type] = s.hp;
  }
  const totalDays = billDueDay(n - 1, k);
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
