// City plans: what each of the 30 farms asks of the player. Pure data and maths, no DOM, so it can be tested.
//
// A farm is a run of bills; the last one is the deed. v0.12 (Navid, 5 Nov): the first bill is due after 2 days, the
// next after 3, then 4, then 5 (and 5 from then on), and a new crop joins the field every morning: day 1 carrots,
// day 2 radishes, then the country's three, then staples, so the field is full by about day 6. Each new crop pays
// more and takes more cuts than the one before. Bills follow what the field can pay, tuned with bots so a weak
// player can't pay even with an ad, an average one pays with one ad, and a computer-strong one needs none.
// City by city, crops get tougher (hp) and pay more (val), and farms get longer.

import { COUNTRIES, ROUTE, type CityDef, type CountryCode, cityById, countryOf, isBossCity, routeIndex } from './world';

export interface Bill {
  name: string;
  amt: number;
  /** Days from the previous bill (or the start of the farm) until this one is due at sunset. */
  days: number;
  note: string;
}

export type CropWeight = [type: string, weight: number, unlockAt: number];

/** One step of a farm's crop ladder: the crop that joins the field once `stage` bills are paid. */
export interface StageCrop {
  type: string;
  stage: number;
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
  /** The crop ladder (stage 0 is carrots only). */
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
export function billDays(i: number): number {
  return Math.min(5, 2 + Math.max(0, i));
}
/** The farm's day on which bill `i` is due. */
export function billDueDay(i: number): number {
  let d = 0;
  for (let j = 0; j <= i; j++) d += billDays(j);
  return d;
}
/** Which rung of the crop ladder is out on a day (day 1 is carrots only, a new crop every morning). */
export function stageOnDay(day: number, rungs: number): number {
  return Math.max(0, Math.min(rungs - 1, day - 1));
}
/** Seconds of daylight with no upgrades. v0.12 (Navid, 5 Nov): 15 s; Longer days and skills add up to about 30. */
export const DAY_SECONDS = 15;

/**
 * The crop ladder: value, toughness and how often it comes up, by stage. Value per cut stays about the same, so a
 * tougher crop pays more only for a player who keeps up with it.
 */
export const LADDER_VAL = [1, 3, 5, 7.5, 10, 12.5, 15, 18];
export const LADDER_HP = [1, 2.5, 4.5, 7, 10, 13, 16.5, 20];
const LADDER_W = [14, 16, 18, 20, 22, 22, 22, 22];

/** What a day pays at each stage of the ladder, against a day with the whole ladder out (dayRef). Measured with
 * bot playthroughs: carrots alone pay about a fifth of a full field; golden corn, the goat and the crows arrive at
 * the third stage. */
export const STAGE_PAY = [0.25, 0.43, 0.75, 0.92, 1, 1.06, 1.12, 1.18];

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

/** Staples that fill the end of a long ladder when the city's own list runs out. */
const STAPLES = ['cabbage', 'onion', 'pumpkin', 'berry', 'potato'];

/** The crops of a farm in the order they join the field: carrots, radishes, the country's three (in the city's
 * own order, its favourite first), then the city's staples. */
export function ladderFor(city: CityDef): string[] {
  const trio = countryOf(city.country).trio;
  const own = city.crops.filter(c => trio.includes(c));
  for (const t of trio) if (!own.includes(t)) own.push(t);
  const staples = city.crops.filter(c => !trio.includes(c) && c !== 'carrot' && c !== 'radish' && c !== 'golden');
  for (const s of STAPLES) if (!staples.includes(s)) staples.push(s);
  return ['carrot', 'radish', ...own, ...staples];
}

/** What a steady player (one who upgrades as they go) earns in a day at route index k, with the whole ladder out.
 * Measured with bot playthroughs (a player who buys upgrades with every spare dollar and pays its bills at about
 * two thirds of what its field makes): about 30% more each farm through Canada, then 45% more each farm. */
const DAYREF_CANADA = [230, 330, 430, 560, 720, 1000];
export function dayRef(k: number): number {
  if (k < DAYREF_CANADA.length) return DAYREF_CANADA[k];
  // the USA starts at about half again Kelowna: a player arrives with Canada's boss bounty and twelve days of upgrades
  return Math.round(1550 * Math.pow(1.45, k - DAYREF_CANADA.length));
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
  return Math.pow(1.115, Math.min(6, k)) * Math.pow(1.37, Math.max(0, k - 6));
}

/**
 * Bills from the bots (v0.12, Navid 5 Nov: "you did bad even with an ad, you should not have enough to pay the bill.
 * you are medium and with ad yes you can pay the bill, you are great? you don't need to watch the ad. but my great i
 * mean like computer great, not human great"). scripts/bots.mjs plays real 15 s days with three players (strong,
 * average, weak) and on-track builds; these numbers are what the average one earned.
 *
 * DAY_SHAPE: an average day by day of the farm, against its settled days (the mean of days 5-19). Day 1 is carrots
 * only; golden corn comes on day 3, the best day; after that each tougher crop pays about what it costs to cut.
 */
const DAY_SHAPE = [0.61, 0.88, 1.15, 1.13, 1.11];
/** Days 6 on, against the settled days (whose mean includes day 5's 1.11). */
const LATER_DAY = 0.96;
export function dayShape(d: number): number {
  return d >= 1 && d <= DAY_SHAPE.length ? DAY_SHAPE[d - 1] : LATER_DAY;
}
/** An average player's settled day on farm k, as a share of dayRef(k) (measured on 25 s days before v0.12). */
const AVG_POINTS: Array<[k: number, share: number]> = [
  // Canada and the USA: each farm measured (two runs of days 1, 2, 3, 5, 8, 12 and 19 per player)
  [0, 0.307], [1, 0.341], [2, 0.253], [3, 0.32], [4, 0.3], [5, 0.294], [6, 0.246], [7, 0.308], [8, 0.251],
  // later countries: provisional until their bots are in
  [29, 0.27],
];
export function avgDayShare(k: number): number {
  const P = AVG_POINTS;
  if (k <= P[0][0]) return P[0][1];
  for (let i = 1; i < P.length; i++) if (k <= P[i][0]) { const [k0, a] = P[i - 1], [k1, b] = P[i]; return a + ((b - a) * (k - k0)) / (k1 - k0); }
  return P[P.length - 1][1];
}
/** What an average player earns on day `d` of farm k. */
export function avgDay(k: number, d: number): number {
  return dayRef(k) * avgDayShare(k) * dayShape(d);
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

export function planFor(cityId: string): CityPlan {
  const k = routeIndex(cityId);
  if (k < 0) throw new Error('unknown city ' + cityId);
  const city = ROUTE[k];
  const boss = isBossCity(cityId);
  const n = BILL_COUNT[city.country] + (boss ? 1 : 0);
  const ref = dayRef(k);
  const mul = billMul(cityId);
  const names = pickBillNames(city, k, n);
  let prevAmt = 0;
  const bills: Bill[] = names.map((nm, i) => {
    const from = i ? billDueDay(i - 1) + 1 : 1, to = billDueDay(i);
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
      days: billDays(i),
      // a boss farm: time spent on the boss earns nothing, so its bills are lighter; the bounty helps with the deed
      // later bills climb a little (a perk comes with every bill paid, and upgrades keep coming)
      amt: (prevAmt = Math.max(roundMoney((sum + BILL_OVER * best) * (1 + BILL_CLIMB * i) * mul * (boss ? (i === n - 1 ? 1 : 0.85) : 1)), moreThan(prevAmt))),
    };
  });
  // the goat and the crows come after two bills on the first farms, from the start later on
  const unlock = Math.min(5, Math.floor(k / 2));
  const ladder = ladderFor(city).slice(0, n);
  const stages: StageCrop[] = ladder.map((type, i) => ({ type, stage: i, val: LADDER_VAL[i], hp: LADDER_HP[i] }));
  const crops: CropWeight[] = stages.map(s => [s.type, LADDER_W[s.stage], unlock + s.stage]);
  const cropVal: Record<string, number> = {};
  const cropHp: Record<string, number> = {};
  for (const s of stages) {
    cropVal[s.type] = s.val;
    cropHp[s.type] = s.hp;
  }
  const totalDays = billDueDay(n - 1);
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
