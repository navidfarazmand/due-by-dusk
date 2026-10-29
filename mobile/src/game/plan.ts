// City plans: what each of the 30 farms asks of the player. Pure data and maths, no DOM, so it can be tested.
//
// Difficulty rises city by city along the route:
//  - crops get tougher (HP) and pay more (value),
//  - the bank sends more bills over more days,
//  - fields get fuller and new crops, the goat and the crows unlock.
// A player who keeps upgrading in the workshop keeps pace; one who doesn't falls behind and has to
// replay earlier farms for coins and stars. Numbers here are the first balance pass; tune freely.

import { COUNTRIES, ROUTE, type CityDef, type CountryCode, countryOf, isBossCity, routeIndex } from './world';

export interface Bill {
  name: string;
  amt: number;
  /** Days from the previous bill (or the start of the farm) until this one is due at sunset. */
  days: number;
  note: string;
}

export type CropWeight = [type: string, weight: number, unlockAt: number];

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
  /** Extra seconds of daylight. */
  dayBonus: number;
  /** Content level: 1 adds cabbages and onions, 2 the goat, crows and pumpkins, 3 berries, 4 golden corn, 5 potatoes. */
  unlock: number;
  goldAt: number;
  crops: CropWeight[];
  /** The rival's best day here; beating it takes the city crown. */
  record: number;
  totalDays: number;
  /** Finish the farm within this many days for the second star. */
  par: number;
  /** The day's gazette event this city leans towards (every other day). */
  signatureEvent: string;
  /** What a steady player earns on a day here (used for bills, records, ad rewards). */
  dayRef: number;
}

/** Bills per country, as days until each is due (the last one is always the deed). */
const BILL_DAYS: Record<CountryCode, number[]> = {
  CA: [2, 1],
  US: [2, 1, 2],
  BR: [2, 2, 2],
  MA: [2, 1, 2, 2],
  FR: [2, 2, 2, 2],
  CN: [2, 1, 2, 2, 2],
  JP: [2, 2, 2, 2, 2],
};

/** Share of a steady day's earnings each bill asks for, per day it gives you; it rises through the farm. */
function billShare(i: number, n: number): number {
  return n <= 1 ? 0.8 : 0.58 + 0.32 * (i / (n - 1));
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

/** Staple crops with the content level that unlocks them. */
const STAPLES: CropWeight[] = [
  ['carrot', 18, 0],
  ['radish', 16, 0],
  ['cabbage', 12, 1],
  ['onion', 12, 1],
  ['pumpkin', 6, 2],
  ['berry', 12, 3],
  ['potato', 5, 5],
];

/** What a steady player (one who upgrades as they go) earns in a day at route index k. */
export function dayRef(k: number): number {
  const crops = 12 + 0.45 * k;
  const value = 9.8 * Math.pow(1.12, k);
  const market = 1 + 0.05 * k;
  return Math.round(crops * value * market * 0.85);
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
  for (const b of pool) {
    if (out.length >= n - 1) break;
    if (seen.has(b[0])) continue;
    seen.add(b[0]);
    out.push(b);
  }
  out.push(['The deed', `Pay this and the ${city.short} farm is yours. Forever. Probably.`]);
  return out;
}

export function planFor(cityId: string): CityPlan {
  const k = routeIndex(cityId);
  if (k < 0) throw new Error('unknown city ' + cityId);
  const city = ROUTE[k];
  const country = countryOf(city.country);
  const boss = isBossCity(cityId);
  const days = BILL_DAYS[city.country].slice();
  if (boss) days.push(2); // the boss farm has one more bill: the deed, due after two more days
  const ref = dayRef(k);
  const names = pickBillNames(city, k, days.length);
  const bills: Bill[] = days.map((d, i) => ({
    name: names[i][0],
    note: names[i][1],
    days: d,
    amt: roundMoney(ref * d * billShare(i, days.length) * (boss && i === days.length - 1 ? 1.15 : 1)),
  }));
  const unlock = Math.min(5, Math.floor(k / 2));
  const [lead, second, third] = country.trio;
  // The city's own crop list from Gemini leads with its favourite; keep that one first.
  const order = [city.crops.find(c => country.trio.includes(c)) || lead, second, third, lead].filter(
    (c, i, a) => a.indexOf(c) === i,
  );
  const crops: CropWeight[] = [
    [order[0], 30, 0],
    [order[1], 24, 0],
    [order[2], 24, 0],
    ...STAPLES,
  ];
  const totalDays = days.reduce((a, b) => a + b, 0);
  return {
    cityId,
    country: city.country,
    index: k,
    boss,
    bills,
    hp: 0.45 * Math.pow(1.16, k),
    hpDay: 0.06,
    hpBill: 1.1,
    val: Math.pow(1.12, k),
    density: 1 + 0.02 * k,
    spawn: 1 + 0.015 * k,
    dayBonus: Math.floor(k / 6),
    unlock,
    goldAt: 4,
    crops,
    record: roundMoney(ref * 1.5),
    totalDays,
    par: Math.max(2, totalDays - 1),
    signatureEvent: SIGNATURE[cityId] || 'market',
    dayRef: ref,
  };
}

export function allPlans(): CityPlan[] {
  return ROUTE.map(c => planFor(c.id));
}

export { COUNTRIES };
