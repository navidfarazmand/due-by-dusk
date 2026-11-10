// The upgrade tree (0.13; Navid, 5 Nov: "make at least 100", "super beautiful with minimal icons"; "tree is a yes").
// One tree bought with cash is the game's one upgrade system: it replaced the Workshop list and the diamond skill
// map. Six branches grow from a trunk; the Workshop's level tracks are the first nodes of their branches (their
// prices, level caps and timed builds are the Workshop's own, src/game/workshop.ts: the bills are tuned by bots
// against them, and their levels live in the same place as before, `workshop.levels`); tricks hang off them; each
// branch ends in two keystones, of which a player can own one; a bridge joins each pair of neighbouring branches.
// 103 nodes. Keystones and every fifth level of a track take time to build (one build at a time, the Workshop's job).
// A reset is free and gives back everything paid as tree credit. Prices of the tricks are a first guess for the bots
// to tune. Review page: https://claude.ai/artifact/7t59cN7bWpBkviWoQnjKLF

import { TIMED_EVERY, emptyLevels, settleJob, upgradeCost, upgradeDef, upgradeDuration, type UpgradeId, type WorkshopState } from './workshop';

export type TreeBranch = 'blade' | 'power' | 'reach' | 'field' | 'market' | 'ranch';
export type NodeKind = 'trunk' | 'track' | 'trick' | 'key' | 'bridge';

export interface TreeNode {
  id: string;
  branch: TreeBranch | 'trunk' | 'bridge';
  kind: NodeKind;
  /** A line icon's name (the renderer owns the drawings). */
  glyph: string;
  name: string;
  effect: string;
  /** Levels to buy (a track's is its top level). */
  levels: number;
  /** Price of each level. A track lists its first level: a Workshop track's prices are the Workshop's (nodeCost);
   *  Power cell, the one track that is the tree's own, costs 12% more a level. */
  price: number[];
  /** Any one of these opens it. */
  parents: string[];
  /** A keystone's partner: own one of the two. */
  pair?: string;
  /** Map position: steps from the trunk and sideways spread (-2..2) within the branch. */
  d: number;
  s: number;
  /** A bridge's two branches. */
  between?: [TreeBranch, TreeBranch];
}

export const BRANCHES: Array<{ id: TreeBranch; name: string; about: string }> = [
  { id: 'blade', name: 'Blade', about: 'damage and crits' },
  { id: 'power', name: 'Power', about: 'the power meter' },
  { id: 'reach', name: 'Reach', about: 'area and speed' },
  { id: 'field', name: 'Field', about: 'crops and daylight' },
  { id: 'market', name: 'Market', about: 'prices and bills' },
  { id: 'ranch', name: 'Rancher', about: 'animals and pests' },
];

/** Every branch has the same shape: 16 places, by steps from the trunk (d), sideways (s) and what opens them. */
const SLOTS: Array<{ d: number; s: number; p: number[] }> = [
  { d: 1, s: 0, p: [] },
  { d: 2, s: 0, p: [0] },
  { d: 3, s: -1, p: [1] },
  { d: 3, s: 1, p: [1] },
  { d: 4, s: -1.8, p: [2] },
  { d: 4, s: 0, p: [2, 3] },
  { d: 4, s: 1.8, p: [3] },
  { d: 5, s: -2, p: [4] },
  { d: 5, s: 0, p: [5] },
  { d: 5, s: 2, p: [6] },
  { d: 6, s: -2.2, p: [7] },
  { d: 6, s: -0.75, p: [8] },
  { d: 6, s: 0.75, p: [8] },
  { d: 6, s: 2.2, p: [9] },
  { d: 7, s: -1, p: [10, 11] },
  { d: 7, s: 1, p: [12, 13] },
];

/** [glyph, name, levels ('T60': a track to level 60, 'K': keystone, or 1-3), effect]. A Workshop track's top level
 *  is the Workshop's (a unit test keeps the two the same). */
type Row = [string, string, string | number, string];
const ROWS: Record<TreeBranch, Row[]> = {
  blade: [
    ['edge', 'Sharper blade', 'T100', '+4% damage a level.'],
    ['clover', 'Lucky clover', 'T30', '+0.8% crit chance a level.'],
    ['star', 'Keen edge', 3, 'Crits hit ×3.2 instead of ×2.8 (then ×3.6, ×4).'],
    ['drop', 'Bleeding cut', 3, 'A crop you hit keeps losing a third of the hit over a second (then a half, two thirds).'],
    ['bolt', 'Storm rod', 1, 'Crits throw lightning at a crop nearby.'],
    ['sun', 'Honed start', 2, 'For the first 3 s of each day every swing crits (then 5 s).'],
    ['burst', 'Splinter', 2, 'When a crop falls, half the damage left over jumps to the nearest crop (then all of it).'],
    ['bolt2', 'Chain lightning', 1, "Storm rod's lightning jumps on to a second crop."],
    ['weight', 'Heavy hand', 2, '+20% damage on the first hit of every crop (then 40%).'],
    ['axe', 'Giant slayer', 3, '+30% damage on crops that take 4 or more cuts (then 45%, 60%). Not bosses.'],
    ['scale', "Reaper's verdict", 1, 'Crops under 25% health fall at once (not bosses).'],
    ['stars', 'Crit streak', 1, 'After three crits in a row, the next swing hits ×5.'],
    ['sprout', 'Clean cut', 1, 'A crop you cut down leaves clean soil: the next one there grows 30% faster.'],
    ['shield', 'Armour breaker', 2, "Hits on the boss's armour still do 20% of their damage (then 40%)."],
    ['swirl', 'Twin blade', 'K', 'Every fourth swing goes all the way round.'],
    ['flame', 'Frenzy', 'K', 'Each crop in a chain makes you swing 1.5% faster, up to 40%, until the chain breaks.'],
  ],
  power: [
    ['battery', 'Power cell', 'T20', 'The power meter fills 5% faster a level.'],
    ['up', 'Big power', 3, 'Your power hits 20% harder (then 40%, 60%).'],
    ['link', 'Chain fuel', 1, 'From ×1.5 on, chained crops fill the meter twice as fast.'],
    ['clock', 'Long rush', 2, 'The rush lasts 1 s longer (then 2 s).'],
    ['wave', 'Sundering cleave', 1, 'The meter fills 50% faster and your power hits a wider circle.'],
    ['half', 'Spark start', 2, 'Each day starts with the meter a quarter full (then half).'],
    ['corn', 'Rush gold', 1, 'During the rush, golden corn comes three times as often.'],
    ['tornado', 'Whirlwind echo', 1, 'Your power leaves a spinning vortex that keeps cutting for 1.8 s.'],
    ['sprout', 'Green thumb', 1, 'Your power ripens the young crops around it.'],
    ['spark', 'Static', 1, 'Every crit that lands fills the meter by half a cut.'],
    ['rings', 'Aftershock', 1, 'A second power at half strength fires half a second later in the same place.'],
    ['plus', 'Overcharge', 1, 'The meter keeps filling to 150%; an overcharged power fires twice.'],
    ['seed', 'Rush bloom', 1, 'During the rush, crops sprout twice as fast.'],
    ['coin', 'Power payout', 2, 'Crops your power cuts down pay 50% more (then double).'],
    ['tool', 'Tool master', 'K', "Each tool's power doubles: a Cleave twice as wide, a Whirlwind twice as long, a Fire wave twice as far, 24 seeds in a Seed storm."],
    ['recycle', 'Chain reaction', 'K', 'Every crop your power cuts down fills the meter by half a cut.'],
  ],
  reach: [
    ['arrows', 'Wider swing', 'T30', '+2% reach a level.'],
    ['chevrons', 'Quicker hands', 'T30', '+2% swing speed a level.'],
    ['target', 'Sweet spot', 3, 'Crops in the outer half of your swing take 35% more (then 50%, 70%).'],
    ['wind', 'Wind trail', 2, 'A fast finger stretches the swing by up to 30% (then 50%).'],
    ['boomerang', 'Boomerang', 3, 'Every sixth swing throws the sickle out and back along your path (then every fifth, fourth).'],
    ['fan', 'Sweep', 2, 'A swing that hits 4 or more crops pays 25% more (then 50%).'],
    ['ghost', 'Ghost sickle', 2, 'A ghost sickle follows a moment behind your finger and hits for 40% (then 70%).'],
    ['bounce', 'Ricochet', 1, 'The boomerang bounces once off the edge of the field.'],
    ['pause', 'Second wind', 1, 'After 2 s without a cut, your next 5 swings are twice as fast.'],
    ['arc', 'Wide arc', 2, 'Your swing covers a 25% wider arc (then 50%).'],
    ['spin', 'Spin cycle', 1, 'Every tenth swing that lands hits twice.'],
    ['eye', 'Afterimage', 1, "The ghost sickle's hits can crit."],
    ['tap', 'Quickdraw', 1, 'A swing starts the moment your finger reaches a crop.'],
    ['feather', 'Featherweight', 2, '+10% swing speed, doubled while the field is nearly full (then +20%).'],
    ['orbit', 'Orbit', 'K', 'Two small sickles circle your finger, each hitting for 30%.'],
    ['zigzag', 'Dancer', 'K', 'Swings while your finger moves fast hit twice.'],
  ],
  field: [
    ['grain', 'Richer soil', 'T24', 'About ¾ of a crop more on the field a level.'],
    ['sun', 'Longer days', 'T20', '+0.5 s of daylight a level.'],
    ['twin', 'Twin germination', 1, 'One new crop in five sprouts with a twin.'],
    ['sunrise', 'Dawn abundance', 3, 'Every day starts with 3 more ripe crops (then 5, 8).'],
    ['corn', 'Golden soil', 2, 'Golden corn comes twice as often (then three times).'],
    ['roots', 'Deep roots', 1, 'Crops grow 20% bigger and pay 20% more, and take 10% more to cut.'],
    ['flask', 'Artisan compost', 1, 'Fertilizer bags and clover treats show up twice as often.'],
    ['loop', 'Perennial bloom', 1, 'One cut crop in four sprouts again at once.'],
    ['cloud', 'Rain dance', 1, 'Mild, sprouting days (showers, a thaw) come twice as often.'],
    ['book', 'Almanac', 1, "The day's event is 50% stronger (a market day pays +37% instead of +25%)."],
    ['rotate', 'Crop rotation', 1, "The morning's new crop pays 25% more on its first day."],
    ['vault', 'Seed vault', 1, 'The last crop of the ladder joins a day sooner.'],
    ['hourglass', 'Golden hour', 1, 'In the last 5 s of the day, the sun waits while you keep a chain of 10 or more (up to 5 s a day).'],
    ['leaf', 'Mulch', 2, 'Crops sprout 15% faster (then 30%).'],
    ['moon', 'Harvest moon', 'K', 'In the last 3 s of every day the whole field ripens and pays double.'],
    ['bird', 'Early bird', 'K', 'In the first 4 s of every day every crop pays double.'],
  ],
  market: [
    ['cart', "Farmers' market", 'T60', '+3% crop prices a level.'],
    ['scroll', 'Retained counsel', 3, 'Every bill costs 4% less (then 8%, 12%).'],
    ['box', 'Bulk order', 2, 'Every tenth crop in a chain pays ×3 (then ×5).'],
    ['calendar', 'Market day', 1, 'Every fifth day of a farm, every crop pays 30% more.'],
    ['gavel', 'Good lawyer', 2, 'Late fees are 10 points lower (10%, 30%, 50%). Level 2: the first late day of a farm is free.'],
    ['medal', 'First of the day', 1, 'The first crop of each kind each day pays ×5.'],
    ['bank', 'Compound reserve', 3, 'Every night, 4% interest on the cash you hold (then 8%, 12%), up to 40% of a good day.'],
    ['coin', 'Sovereign mint', 1, "Lucky crops and the country's three pay 50% more."],
    ['percent', 'Coupon book', 3, 'Everything in the tree costs 5% less (then 10%, 15%).'],
    ['crown', "Rival's envy", 1, "Taking a city's crown pays a bonus of half its record."],
    ['jar', 'Tip jar', 1, 'A chain of 20 or more drops a tip: 10% of what the chain paid.'],
    ['umbrella', 'Insurance', 1, 'If the bank takes a farm, a quarter of its cash above what the farm has paid you goes to your savings.'],
    ['tag', 'Deal of the day', 1, 'One upgrade a day costs 25% less.'],
    ['deed', 'Deed discount', 1, 'The deed costs 10% less.'],
    ['cash', 'Cashback', 'K', 'Grumble & Sons pay back 8% of every bill you pay, the next morning.'],
    ['chart', 'Futures', 'K', 'A bill paid a day early costs 15% less.'],
  ],
  ranch: [
    ['goat', 'Pasture accord', 1, 'The goat never headbutts; it tips you instead.'],
    ['hat', 'Scarecrow', 2, 'Thief crows take half as much (then nothing: they only come to look).'],
    ['comb', 'Rooster', 1, 'Each day starts with a 2 s rush.'],
    ['paw', 'Farm dog', 1, 'Every 8 s the dog chases a crow off and brings back what it took.'],
    ['bee', 'Beehive', 2, 'Every 3 s a bee lands on a crop: it pays ×2 (then every 2 s).'],
    ['owl', 'Barn owl', 1, "In the last 3 s of the day crows can't land."],
    ['feather', 'Crow bounty', 1, "A crow you chase off drops coins: 2% of today's harvest."],
    ['egg', 'Hen house', 1, 'A hen lays an egg on the field every 10 s; swipe it for coins.'],
    ['clover', 'Goat treats', 1, 'Clover treats keep the goat calm twice as long.'],
    ['honey', 'Honey', 1, 'Every crop a bee visits adds honey, sold at sunset for 5% of what it paid.'],
    ['mail', 'Pigeon post', 1, 'A pigeon drops a fertilizer bag every 12 s.'],
    ['paw2', 'Sheepdog', 1, 'The dog also herds the goat away from your crops.'],
    ['wave', 'Duck pond', 1, "Crops frozen, buried or bogged down by the boss's storm come free with one hit."],
    ['herd', 'Loyal goat herd', 1, 'The goat harvests the crops it walks past.'],
    ['cat', 'Barn cat', 'K', "The boss's bomb seeds get batted away: no stun, no loss."],
    ['goat2', 'Goat army', 'K', 'Two loyal goats.'],
  ],
};

/** Between each branch and the next one round the trunk. */
const BRIDGES: Row[] = [
  ['bolt', 'Charged edge', 1, 'During the rush, every swing crits.'],
  ['chevrons', 'Momentum', 1, 'During the rush, swings are 30% faster.'],
  ['basket', 'Clearing', 1, 'A swing that cuts 3 or more crops at once leaves a fertilizer bag (one every 3 s at most).'],
  ['tag', 'Organic label', 1, 'Twins and crops that sprout again pay 50% more.'],
  ['milk', 'Goat milk', 1, 'The goat drops coins every 10 s it is on the field.'],
  ['bow', 'Crow hunter', 1, 'Crows you chase off count as cuts for your chain.'],
];

/** A first guess at prices by steps from the trunk: cheap near it (Canada), a keystone around Morocco and France. */
const TIER = [0, 20, 200, 800, 3000, 12000, 50000, 300000];
const PREFIX: Record<TreeBranch, string> = { blade: 'b', power: 'p', reach: 'r', field: 'f', market: 'm', ranch: 'a' };

function build(): TreeNode[] {
  const out: TreeNode[] = [
    {
      id: 'trunk', branch: 'trunk', kind: 'trunk', glyph: 'toolbox', name: 'Toolbox', levels: 1, price: [0], parents: [], d: 0, s: 0,
      effect: 'The middle of the tree, yours from the start. The first node of every branch opens from here.',
    },
  ];
  for (const b of BRANCHES) {
    ROWS[b.id].forEach((row, i) => {
      const [glyph, name, lv, effect] = row;
      const slot = SLOTS[i];
      const id = PREFIX[b.id] + (i + 1);
      const kind: NodeKind = typeof lv === 'string' ? (lv === 'K' ? 'key' : 'track') : 'trick';
      const levels = kind === 'track' ? Number(String(lv).slice(1)) : kind === 'key' ? 1 : (lv as number);
      const base = TIER[slot.d];
      const price = kind === 'track' ? [base] : Array.from({ length: levels }, (_, k) => base * Math.pow(10, k));
      out.push({
        id, branch: b.id, kind, glyph, name, effect, levels, price, d: slot.d, s: slot.s,
        parents: slot.p.length ? slot.p.map(j => PREFIX[b.id] + (j + 1)) : ['trunk'],
        ...(kind === 'key' ? { pair: PREFIX[b.id] + (i === 14 ? 16 : 15) } : {}),
      });
    });
  }
  BRIDGES.forEach((row, i) => {
    const a = BRANCHES[i].id, c = BRANCHES[(i + 1) % BRANCHES.length].id;
    out.push({
      id: 'x' + (i + 1), branch: 'bridge', kind: 'bridge', glyph: row[0], name: row[1], effect: row[3], levels: 1, price: [TIER[5]],
      parents: [PREFIX[a] + 7, PREFIX[c] + 5], d: 4.75, s: 0, between: [a, c],
    });
  });
  return out;
}

export const TREE: TreeNode[] = build();

/** Level tracks that are the Workshop's upgrades: the same levels (`workshop.levels`), prices, caps and build times. */
export const TREE_WORKSHOP: Record<string, UpgradeId> = { b1: 'scythe', b2: 'clover', r1: 'swing', r2: 'hands', f1: 'soil', f2: 'days', m1: 'market' };
/** Tricks that were diamond skills until 0.12 (the engine still knows them by these names: `hasSkill`). */
export const TREE_SKILL: Record<string, string> = {
  b11: 'reap_exec', p5: 'reap_cleave', p8: 'reap_vortex', f3: 'soil_twin', f4: 'soil_dew', f7: 'soil_bounty', f8: 'soil_eden',
  m2: 'gold_lawyer', m7: 'gold_interest', m8: 'gold_midas', a1: 'gold_treaty', a14: 'gold_herd',
};
/** Tricks the engine does through window.__DBD_TREEFX (`tfx(id)` in gemini-engine.js). A node that is in none of
 *  these three lists is not built yet: the tree shows it as "Coming soon" and does not sell it. */
export const TREE_NEW_LIVE = [
  'p1', 'p2', 'p3', 'p4', 'p6', 'a3', 'b3', 'f5', 'm14', 'a2',
  // 0.13, batch 1: blade and swing speed
  'b5', 'b6', 'b8', 'b9', 'b10', 'b12', 'b16', 'x1', 'x2', 'r14',
  // batch 2: what crops pay, and the field
  'f11', 'f13', 'f14', 'f15', 'f16', 'm3', 'm4', 'm6', 'm11', 'x4',
  // batch 3: the power and the swing's reach
  'p7', 'p10', 'p11', 'p13', 'p14', 'p15', 'p16', 'r3', 'r4', 'r6', 'r9', 'r11', 'r16',
  // batch 4: the ranch, the bank and three bridges (Coupon book and Insurance are the shell's: prices, a foreclosure)
  'a4', 'a6', 'a7', 'a11', 'a13', 'a15', 'x3', 'x5', 'x6', 'm5', 'm9', 'm12', 'm15',
  // batch 5: bleeding, splinters, the boss's armour, bees, the hen, the ghost sickle, the crown's bonus
  'b4', 'b7', 'b14', 'r7', 'r12', 'a5', 'a8', 'a10', 'm10',
];

const NODE: Record<string, TreeNode> = {};
for (const n of TREE) NODE[n.id] = n;
export function treeNode(id: string): TreeNode | undefined {
  return NODE[id];
}

/** Whether a node works in the game (and so can be bought). */
export function nodeLive(id: string): boolean {
  return !!TREE_WORKSHOP[id] || !!TREE_SKILL[id] || TREE_NEW_LIVE.includes(id);
}

/** The list price of a node's next level, from `level`. A Workshop track costs what the Workshop charges. */
export function nodeCost(n: TreeNode, level: number): number {
  const w = TREE_WORKSHOP[n.id];
  if (w) return upgradeCost(w, level) ?? 0;
  if (n.kind === 'track') return Math.round(n.price[0] * Math.pow(1.12, level));
  return n.price[Math.min(level, n.price.length - 1)];
}

/** A keystone takes as long as the Workshop's longest build. */
export const KEY_BUILD_MS = 30 * 60 * 1000;

/** How long a node's next level takes to build, in ms (0: at once). Every fifth level of a track is a timed build
 *  (the Workshop's own times: 2 minutes, then a quarter longer each time, up to half an hour), and so is a keystone. */
export function nodeDuration(n: TreeNode, level: number): number {
  const w = TREE_WORKSHOP[n.id];
  if (w) return upgradeDuration(w, level);
  if (n.kind === 'key') return KEY_BUILD_MS;
  if (n.kind !== 'track') return 0;
  const next = level + 1;
  if (next % TIMED_EVERY !== 0) return 0;
  return Math.round(Math.min(30, 2 * Math.pow(1.25, next / TIMED_EVERY - 1)) * 60) * 1000;
}

/** The part of the game save the tree lives in. Track levels are the Workshop's (`workshop.levels`); every other node's
 *  level is in `tree`; the one build in progress is the Workshop's job (its id is a Workshop upgrade or a node id). */
export interface TreeHolder {
  workshop: WorkshopState;
  tree?: Record<string, number>;
  /** Buys tree nodes only (a reset's refund, the old diamonds, a farm won, a daily gold medal). Spent first. */
  treeCredit?: number;
  /** Everything paid for what is in the tree now: what a reset gives back. */
  treeSpent?: number;
}

/** The level a player has of a node (a build in progress does not count yet). */
export function treeLevel(g: TreeHolder, id: string): number {
  if (id === 'trunk') return 1;
  const w = TREE_WORKSHOP[id];
  if (w) return g.workshop.levels[w] || 0;
  return (g.tree && g.tree[id]) || 0;
}

/** The node being built, if any. */
export function buildingNode(g: TreeHolder): string | null {
  const job = g.workshop.job;
  if (!job) return null;
  for (const [id, w] of Object.entries(TREE_WORKSHOP)) if (w === job.id) return id;
  return NODE[job.id] ? job.id : null;
}

/** Tricks that make tree nodes cheaper (Coupon book, m9: 5% a level). Workshop tracks included. A reset gives back
 *  what was paid (`treeSpent`), not the list price, so a discount can't be turned into credit. */
export function treeDiscount(g: TreeHolder): number {
  return 1 - 0.05 * Math.min(3, treeLevel(g, 'm9'));
}

/** What the player pays for a node's next level. */
export function nodePrice(g: TreeHolder, n: TreeNode): number {
  return Math.max(0, Math.round(nodeCost(n, treeLevel(g, n.id)) * treeDiscount(g)));
}

export type BuyCheck =
  | { ok: true; cost: number; dur: number }
  | { ok: false; why: 'soon' | 'max' | 'locked' | 'pair' | 'busy' | 'building'; cost?: number };

/** Whether a node's next level is for sale now (money aside), and its price and build time. */
export function canBuyNode(g: TreeHolder, n: TreeNode): BuyCheck {
  if (n.kind === 'trunk') return { ok: false, why: 'max' };
  if (!nodeLive(n.id)) return { ok: false, why: 'soon' };
  const lv = treeLevel(g, n.id);
  if (lv >= n.levels) return { ok: false, why: 'max' };
  const building = buildingNode(g);
  if (building === n.id) return { ok: false, why: 'building' };
  if (n.pair && (treeLevel(g, n.pair) > 0 || building === n.pair)) return { ok: false, why: 'pair' };
  // a node opens when a neighbour towards the trunk is owned; one you already have (an older save's track level, a
  // skill learned with diamonds) stays open
  if (lv === 0 && !n.parents.some(p => treeLevel(g, p) > 0)) return { ok: false, why: 'locked' };
  const cost = nodePrice(g, n), dur = nodeDuration(n, lv);
  // one build at a time
  if (dur > 0 && building) return { ok: false, why: 'busy', cost };
  return { ok: true, cost, dur };
}

export type BuyResult = { ok: true; instant: boolean; cost: number } | { ok: false; why: 'soon' | 'max' | 'locked' | 'pair' | 'busy' | 'building' | 'cash' };

/** Buys a node's next level, or starts building it. `pay(cost)` takes the money (tree credit, savings, farm cash). */
export function buyNode(g: TreeHolder, n: TreeNode, now: number, pay: (cost: number) => boolean): BuyResult {
  const chk = canBuyNode(g, n);
  if (!chk.ok) return { ok: false, why: chk.why };
  if (!pay(chk.cost)) return { ok: false, why: 'cash' };
  g.treeSpent = (g.treeSpent || 0) + chk.cost;
  const lv = treeLevel(g, n.id), w = TREE_WORKSHOP[n.id];
  if (chk.dur > 0) {
    g.workshop.job = { id: w || n.id, level: lv + 1, startedAt: now, endsAt: now + chk.dur };
    return { ok: true, instant: false, cost: chk.cost };
  }
  if (w) g.workshop.levels[w] = lv + 1;
  else (g.tree ||= {})[n.id] = lv + 1;
  return { ok: true, instant: true, cost: chk.cost };
}

/** Finishes the build if its time is up (or `force`: a rewarded ad). Returns what was built. */
export function settleTree(g: TreeHolder, now: number, force = false): { node: TreeNode; level: number } | null {
  const job = g.workshop.job;
  if (!job) return null;
  if (!force && now < job.endsAt) return null;
  const id = buildingNode(g);
  if (id && !TREE_WORKSHOP[id]) {
    const tree = (g.tree ||= {});
    tree[id] = Math.max(tree[id] || 0, Math.min(NODE[id].levels, job.level));
    g.workshop.job = null;
  } else settleJob(g.workshop, now, true);
  return id ? { node: NODE[id], level: job.level } : null;
}

/** What everything in the tree costs at list prices (a build in progress included): the ledger of an older save. */
export function treeListValue(g: TreeHolder): number {
  let sum = 0;
  for (const n of TREE) {
    if (n.kind === 'trunk') continue;
    const lv = Math.min(n.levels, treeLevel(g, n.id));
    for (let l = 0; l < lv; l++) sum += nodeCost(n, l);
  }
  const b = buildingNode(g);
  if (b && g.workshop.job) sum += nodeCost(NODE[b], Math.max(0, g.workshop.job.level - 1));
  return sum;
}

/** What a reset gives back: everything paid for the tree (tracks and a build in progress included). */
export function treeRefund(g: TreeHolder): number {
  return Math.max(0, Math.round(g.treeSpent ?? treeListValue(g)));
}

/** True when there is anything to reset. */
export function treeHasAny(g: TreeHolder): boolean {
  return !!g.workshop.job || TREE.some(n => n.kind !== 'trunk' && treeLevel(g, n.id) > 0);
}

/** A free reset: every node and track level goes, a build stops, and what was paid comes back as tree credit. */
export function resetTree(g: TreeHolder): number {
  const back = treeRefund(g);
  g.workshop.levels = emptyLevels();
  g.workshop.job = null;
  g.tree = {};
  g.treeSpent = 0;
  g.treeCredit = (g.treeCredit || 0) + back;
  return back;
}

/** Nodes whose next level can be bought right now with `money` (tree credit, savings and spendable farm cash). */
export function treeReady(g: TreeHolder, money: number): TreeNode[] {
  return TREE.filter(n => {
    const c = canBuyNode(g, n);
    return c.ok && c.cost <= money;
  });
}

// ---------------------------------------------------------------- diamonds, retired in 0.13

/** What one old diamond is worth in tree credit. Derived from the 12 skill nodes: each node's first-level price
 *  divided by the diamonds its skill cost gives $7 to $16,667 a diamond; the middle of the twelve is $1,000 (the
 *  mean, $3,765, is pulled up by two $50,000 nodes). A farm won pays one diamond's worth, a boss farm two, a daily
 *  gold medal one. */
export const DIAMOND_CREDIT = 1000;

/** What each diamond skill cost (skills.ts until 0.12), and the tree nodes that are the same effect now. A skill
 *  with no node (plain stat boosts: the level tracks do that) is paid back as tree credit. Retained counsel and
 *  Compound reserve gave their top level's effect (12%), and Reaper's verdict also threw lightning at two crops
 *  (Storm rod and Chain lightning). */
export const OLD_SKILLS: Record<string, { cost: number; nodes?: Array<[string, number]> }> = {
  core_awakening: { cost: 1 },
  reap_root: { cost: 2 }, reap_swift: { cost: 3 }, reap_dash: { cost: 3 },
  reap_cleave: { cost: 3, nodes: [['p5', 1]] }, reap_vortex: { cost: 3, nodes: [['p8', 1]] },
  reap_exec: { cost: 4, nodes: [['b11', 1], ['b5', 1], ['b8', 1]] },
  soil_root: { cost: 2 }, soil_sun: { cost: 3 },
  soil_twin: { cost: 3, nodes: [['f3', 1]] }, soil_dew: { cost: 3, nodes: [['f4', 1]] },
  soil_bounty: { cost: 3, nodes: [['f7', 1]] }, soil_eden: { cost: 4, nodes: [['f8', 1]] },
  gold_root: { cost: 2 },
  gold_lawyer: { cost: 3, nodes: [['m2', 3]] }, gold_interest: { cost: 3, nodes: [['m7', 3]] },
  gold_treaty: { cost: 3, nodes: [['a1', 1]] }, gold_herd: { cost: 3, nodes: [['a14', 1]] },
  gold_midas: { cost: 4, nodes: [['m8', 1]] },
};

/**
 * Moves an older save into the tree (once): learned skills become owned nodes, every other diamond (unspent, or
 * spent on a skill that has no node) becomes tree credit at DIAMOND_CREDIT, and the ledger of what the tree cost
 * starts: track levels and nodes bought with cash at list prices, a skill's nodes at what its diamonds are worth
 * (so a reset pays a diamond back at the same rate, spent or not). `earned`: the diamonds the save had earned
 * (farms won, boss farms twice, daily golds). Returns the credit given for diamonds and the nodes the skills became.
 */
export function migrateSkills(g: TreeHolder, skills: readonly string[], earned: number): { credit: number; nodes: string[] } {
  const tree = (g.tree ||= {});
  const paid = treeListValue(g);
  let kept = 0;
  const got: string[] = [];
  for (const id of new Set(skills)) {
    const old = OLD_SKILLS[id];
    if (!old || !old.nodes) continue;
    let used = false;
    for (const [nid, lv] of old.nodes) {
      if ((tree[nid] || 0) < lv) {
        tree[nid] = lv;
        used = true;
        got.push(nid);
      }
    }
    // a skill whose node was already bought with cash in the 0.12.3 tree is paid back like an unspent diamond
    if (used) kept += old.cost;
  }
  const credit = Math.max(0, Math.floor(earned) - kept) * DIAMOND_CREDIT;
  g.treeCredit = (g.treeCredit || 0) + credit;
  g.treeSpent = paid + kept * DIAMOND_CREDIT;
  return { credit, nodes: got };
}
