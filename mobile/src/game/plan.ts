// City plans: what each of the 30 farms asks of the player. Pure data and maths, no DOM, so it can be tested.
//
// A farm is a run of bills, each due two days after the one before; the last one is the deed. The field starts
// with carrots only, and every bill paid adds the next crop on the farm's ladder: radishes, then the country's
// three, then staples. Each new crop pays more and takes more cuts than the one before (Navid, 29 Oct: "only
// carrots first day (much cheaper!) then if i can overcome the first bill, the second bill come with second
// vegetable which is red radish, etc."). Bills follow what the field can pay at each step.
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

/** Bills per farm in each country (the boss farm has one more). Every bill is due two days after the last. */
export const BILL_COUNT: Record<CountryCode, number> = { CA: 5, US: 5, BR: 6, MA: 6, FR: 6, CN: 7, JP: 7 };
export const DAYS_PER_BILL = 2;
/** Seconds of daylight with no upgrades (Gemini's build had 14; Navid: days were far too short). */
export const DAY_SECONDS = 25;

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

/** Share of the day's pay each bill asks for, per day it gives you: about half on the first farm, rising to
 * about three quarters from the USA on, and a little more for the later bills of a farm. */
const PRESSURE = [0.5, 0.58, 0.63, 0.66, 0.68];
export function billPressure(k: number): number {
  return PRESSURE[k] ?? 0.7;
}
function billShare(i: number, n: number, k: number): number {
  return billPressure(k) * (n <= 1 ? 1 : 0.9 + 0.2 * (i / (n - 1)));
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
    ['Wine cellar lock', 'The artichoke knight lost the key. Again.'],
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

function roundMoney(v: number): number {
  if (v < 100) return Math.max(10, Math.round(v / 5) * 5);
  if (v < 1000) return Math.round(v / 10) * 10;
  if (v < 10000) return Math.round(v / 50) * 50;
  return Math.round(v / 500) * 500;
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
  const bills: Bill[] = names.map((nm, i) => ({
    name: nm[0],
    note: nm[1],
    days: DAYS_PER_BILL,
    // a boss farm pays a bounty and has one more crop: all its bills are heavier, the deed most of all
    amt: roundMoney(ref * STAGE_PAY[i] * DAYS_PER_BILL * billShare(i, n, k) * mul * (boss ? (i === n - 1 ? 1.2 : 1.06) : 1)),
  }));
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
  const totalDays = n * DAYS_PER_BILL;
  // Bosses take longer in later countries: 14 s of steady hitting in Canada, 38 s in Japan.
  const ci = COUNTRIES.findIndex(c => c.code === city.country);
  const bossFight: BossFight | undefined = boss
    ? { ...BOSSES[city.country], focusSec: 14 + 4 * ci, hpMul: Math.round(0.6 * (12 + 0.45 * k) * totalDays), bounty: roundMoney(ref * mul) }
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
    record: roundMoney(ref * STAGE_PAY[n - 1] * (0.95 + 0.01 * k)),
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
