// The upgrade tree for 0.13 (design; Navid, 5 Nov: "make at least 100", "super beautiful with minimal icons").
// One tree bought with cash replaces the Workshop and the diamond skill map. Six branches grow from a trunk; the
// Workshop's level tracks are the first nodes of their branches (they keep power in step with the bills all the way to
// Japan); new tricks hang off them; each branch ends in two keystones, of which a player can own one; a bridge joins
// each pair of neighbouring branches. 103 nodes. Not wired into the game yet: effects marked "today" in the handoff
// already exist in the engine (hasSkill or the Workshop); the rest need engine work. Prices are a first guess for
// the bots to tune. Review page: https://claude.ai/artifact/7t59cN7bWpBkviWoQnjKLF

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
  /** Price of each level; a track lists its first level, later levels cost 12% more each. */
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

/** [glyph, name, levels ('T60': a track to level 60, 'K': keystone, or 1-3), effect] */
type Row = [string, string, string | number, string];
const ROWS: Record<TreeBranch, Row[]> = {
  blade: [
    ['edge', 'Sharper blade', 'T60', '+4% damage a level.'],
    ['clover', 'Lucky clover', 'T20', '+0.8% crit chance a level.'],
    ['star', 'Keen edge', 3, 'Crits hit ×3.2 instead of ×2.8 (then ×3.6, ×4).'],
    ['drop', 'Bleeding cut', 3, 'A crop you hit keeps losing a third of the hit over a second (then a half, two thirds).'],
    ['bolt', 'Storm rod', 1, 'Crits throw lightning at a crop nearby.'],
    ['sun', 'Honed start', 2, 'For the first 3 s of each day every swing crits (then 5 s).'],
    ['burst', 'Splinter', 2, 'When a crop falls, half the damage left over jumps to the nearest crop (then all of it).'],
    ['bolt2', 'Chain lightning', 1, "Storm rod's lightning jumps on to a second crop."],
    ['weight', 'Heavy hand', 2, '+20% damage on the first hit of every crop (then 40%).'],
    ['axe', 'Giant slayer', 3, '+30% damage on crops that take 4 or more cuts (then 45%, 60%).'],
    ['scale', "Reaper's verdict", 1, 'Crops under 25% health fall at once (not bosses).'],
    ['stars', 'Crit streak', 1, 'Three crits in a row and the next swing hits ×5.'],
    ['sprout', 'Clean cut', 1, 'A crop you cut down leaves clean soil: the next one there grows 30% faster.'],
    ['shield', 'Armour breaker', 2, "Hits on the boss's armour still do 20% damage (then 40%)."],
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
    ['spark', 'Static', 1, 'Every crit puts a little into the meter.'],
    ['rings', 'Aftershock', 1, 'A second, smaller power fires a moment later in the same place.'],
    ['plus', 'Overcharge', 1, 'The meter keeps filling to 150%; an overcharged power fires twice.'],
    ['seed', 'Rush bloom', 1, 'During the rush, crops sprout twice as fast.'],
    ['coin', 'Power payout', 2, 'Crops your power cuts down pay 50% more (then double).'],
    ['tool', 'Tool master', 'K', "Each tool's power doubles: a Cleave twice as wide, a Whirlwind twice as long, a Fire wave twice as far, 24 seeds in a Seed storm."],
    ['recycle', 'Chain reaction', 'K', 'Every crop your power cuts down puts a little back into the meter.'],
  ],
  reach: [
    ['arrows', 'Wider swing', 'T40', '+2% reach a level.'],
    ['chevrons', 'Quicker hands', 'T40', '+2% swing speed a level.'],
    ['target', 'Sweet spot', 3, 'Crops at the rim of your swing take 35% more (then 50%, 70%).'],
    ['wind', 'Wind trail', 2, 'A fast finger stretches the swing by up to 30% (then 50%).'],
    ['boomerang', 'Boomerang', 3, 'Every sixth swing throws the sickle out and back along your path (then every fifth, fourth).'],
    ['fan', 'Sweep', 2, 'A swing that hits 4 or more crops pays 25% more (then 50%).'],
    ['ghost', 'Ghost sickle', 2, 'A ghost sickle follows a moment behind your finger at 40% damage (then 70%).'],
    ['bounce', 'Ricochet', 1, 'The boomerang bounces once off the edge of the field.'],
    ['pause', 'Second wind', 1, 'After 2 s without a cut, your next 5 swings are twice as fast.'],
    ['arc', 'Wide arc', 2, 'Your swing covers a 25% wider arc (then 50%).'],
    ['spin', 'Spin cycle', 1, 'Every tenth swing spins twice.'],
    ['eye', 'Afterimage', 1, "The ghost sickle's hits can crit."],
    ['tap', 'Quickdraw', 1, 'A swing starts the moment your finger reaches a crop.'],
    ['feather', 'Featherweight', 2, '+10% swing speed, and 10% more on a crowded field (then 20%).'],
    ['orbit', 'Orbit', 'K', 'Two small sickles circle your finger, each hitting for 30%.'],
    ['zigzag', 'Dancer', 'K', 'Swings while your finger moves fast hit twice.'],
  ],
  field: [
    ['grain', 'Richer soil', 'T25', 'About ¾ of a crop more on the field a level.'],
    ['sun', 'Longer days', 'T15', '+1 s of daylight a level.'],
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
    ['hourglass', 'Golden hour', 1, 'In the last 5 s of the day, the sun waits while you keep a chain of 10 or more.'],
    ['leaf', 'Mulch', 2, 'Crops sprout 15% faster (then 30%).'],
    ['moon', 'Harvest moon', 'K', 'In the last 3 s of every day the whole field ripens and pays double.'],
    ['bird', 'Early bird', 'K', 'In the first 4 s of every day every crop pays double.'],
  ],
  market: [
    ['cart', "Farmers' market", 'T30', '+3% crop prices a level.'],
    ['scroll', 'Retained counsel', 3, 'Every bill costs 4% less (then 8%, 12%).'],
    ['box', 'Bulk order', 2, 'Every tenth crop in a chain pays ×3 (then ×5).'],
    ['calendar', 'Market day', 1, 'One day in five, every crop pays 30% more.'],
    ['gavel', 'Good lawyer', 2, 'Late fees are 10 points lower (10%, 30%, 50%). Level 2: the first late day of a farm is free.'],
    ['medal', 'First of the day', 1, 'The first crop of each kind each day pays ×5.'],
    ['bank', 'Compound reserve', 3, 'Every night, 4% interest on the cash you hold (then 8%, 12%), up to 40% of a good day.'],
    ['coin', 'Sovereign mint', 1, "Lucky crops and the country's three pay 50% more."],
    ['percent', 'Coupon book', 3, 'Upgrades cost 5% less (then 10%, 15%).'],
    ['crown', "Rival's envy", 1, "Beating the city's record pays a bonus of half the record."],
    ['jar', 'Tip jar', 1, 'A chain of 20 or more drops a tip: 10% of what the chain paid.'],
    ['umbrella', 'Insurance', 1, 'If the bank takes a farm, a quarter of its cash goes to your savings.'],
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
  ['bolt', 'Charged edge', 1, 'During the rush, every hit crits.'],
  ['chevrons', 'Momentum', 1, 'During the rush, swings are 30% faster.'],
  ['basket', 'Clearing', 1, 'A swing that cuts 3 or more crops at once leaves a fertilizer bag.'],
  ['tag', 'Organic label', 1, 'Twins and crops that sprout again pay 50% more.'],
  ['milk', 'Goat milk', 1, 'The goat drops coins every 10 s.'],
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

/** Level tracks that are today's Workshop upgrades (bought in the farmhouse, shown on the tree). */
export const TREE_WORKSHOP: Record<string, string> = { b1: 'scythe', b2: 'clover', r1: 'swing', r2: 'hands', f1: 'soil', f2: 'days', m1: 'market' };
/** Tricks that are today's diamond skills: owning either one gives the effect. */
export const TREE_SKILL: Record<string, string> = {
  b11: 'reap_exec', p5: 'reap_cleave', p8: 'reap_vortex', f3: 'soil_twin', f4: 'soil_dew', f7: 'soil_bounty', f8: 'soil_eden',
  m2: 'gold_lawyer', m7: 'gold_interest', m8: 'gold_midas', a1: 'gold_treaty', a14: 'gold_herd',
};
/** New tricks the engine already does (window.__DBD_TREEFX): Power cell, Big power, Chain fuel, Long rush, Spark start,
 *  Rooster, Keen edge, Golden soil, Deed discount, Scarecrow. */
export const TREE_NEW_LIVE = ['p1', 'p2', 'p3', 'p4', 'p6', 'a3', 'b3', 'f5', 'm14', 'a2'];

const NODE: Record<string, TreeNode> = {};
for (const n of TREE) NODE[n.id] = n;
export function treeNode(id: string): TreeNode | undefined {
  return NODE[id];
}

/** Whether a node can be bought in the tree today. */
export function nodeLive(id: string): boolean {
  return !!TREE_SKILL[id] || TREE_NEW_LIVE.includes(id);
}

/** The price of the next level (a track's levels cost 12% more each). */
export function nodeCost(n: TreeNode, level: number): number {
  if (n.kind === 'track') return Math.round(n.price[0] * Math.pow(1.12, level));
  return n.price[Math.min(level, n.price.length - 1)];
}

export type BuyCheck = { ok: true; cost: number } | { ok: false; why: 'workshop' | 'soon' | 'max' | 'locked' | 'pair' };

/** `have(id)`: the level the player has of a node (bought in the tree, learned as a skill, or a Workshop level). */
export function canBuyNode(n: TreeNode, have: (id: string) => number): BuyCheck {
  if (TREE_WORKSHOP[n.id]) return { ok: false, why: 'workshop' };
  if (!nodeLive(n.id)) return { ok: false, why: 'soon' };
  const lv = have(n.id);
  if (lv >= n.levels) return { ok: false, why: 'max' };
  if (n.pair && have(n.pair) > 0) return { ok: false, why: 'pair' };
  if (!n.parents.some(p => p === 'trunk' || have(p) > 0)) return { ok: false, why: 'locked' };
  return { ok: true, cost: nodeCost(n, lv) };
}
