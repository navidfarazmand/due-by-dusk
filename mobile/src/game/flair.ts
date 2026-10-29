// The Bling Barn: looks-only items bought with ribbons (county-fair ribbons, earned for new stars, crowns,
// bosses, daily medals and duel wins). Nothing here changes how the game plays.

export type FlairKind = 'finish' | 'trail' | 'bird' | 'coin';

/** What the engine reads from window.__DBD_LOOK. */
export interface Look {
  metal?: string[];
  wood?: string[];
  trim?: string;
  accent?: string;
  toy?: string;
  rainbow?: boolean;
  trail?: string;
  bird?: [string, string];
  coin?: string[];
}

export interface FlairItem {
  id: string;
  kind: FlairKind;
  name: string;
  /** One line for the shop. */
  line: string;
  price: number;
  /** Swatch colours for the shop card. */
  swatch: string[];
  look: Look;
}

export const FLAIR_KINDS: Array<{ kind: FlairKind; name: string; line: string }> = [
  { kind: 'finish', name: 'Tool finish', line: 'Colours for every tool you carry.' },
  { kind: 'trail', name: 'Swing trail', line: 'The streak your blade leaves.' },
  { kind: 'bird', name: 'Birds', line: 'Who comes to peck at the crops.' },
  { kind: 'coin', name: 'Coins', line: 'What flies into your jar.' },
];

export const FLAIR: FlairItem[] = [
  { id: 'finish_classic', kind: 'finish', name: 'Old faithful', line: "Grandpa's steel and ash. Still sharp.", price: 0, swatch: ['#e2e8f0', '#94a3b8', '#c27838'], look: {} },
  {
    id: 'finish_gold', kind: 'finish', name: 'Golden harvest', line: 'Solid gold, as far as the bank knows.', price: 6, swatch: ['#ffe48a', '#f2b632', '#8b5a2b'],
    look: { metal: ['#fffbe6', '#ffe48a', '#f2b632', '#a8740f', '#7a5208'], wood: ['#4a2a0e', '#8b5a2b', '#d9a066', '#ffc23d'], trim: '#fff3b0', accent: '#ffc23d', toy: '#ffc23d' },
  },
  {
    id: 'finish_candy', kind: 'finish', name: 'Candy cane', line: 'Pink, mint and a little sticky.', price: 8, swatch: ['#ffd6ec', '#ff9ccf', '#5fd1c4'],
    look: { metal: ['#ffffff', '#ffd6ec', '#ff9ccf', '#d9468f', '#9c2f66'], wood: ['#2a6f6a', '#5fd1c4', '#c7f5ef', '#ff9ccf'], trim: '#7fe0d6', accent: '#ff6fb5', toy: '#ff9ccf' },
  },
  {
    id: 'finish_midnight', kind: 'finish', name: 'Midnight', line: 'For farming after dusk. Not allowed, but stylish.', price: 8, swatch: ['#9fb0e8', '#2c3a73', '#3b3b5c'],
    look: { metal: ['#e6ecff', '#9fb0e8', '#5a6fb8', '#2c3a73', '#1a2350'], wood: ['#1b1b2f', '#3b3b5c', '#7a7aa8', '#9fb0e8'], trim: '#c7d2fe', accent: '#6366f1', toy: '#5a6fb8' },
  },
  {
    id: 'finish_lava', kind: 'finish', name: 'Lava forged', line: 'Still warm. Hold it by the wooden end.', price: 10, swatch: ['#ffb35c', '#f2542d', '#5a2c12'],
    look: { metal: ['#fff3d6', '#ffb35c', '#f2542d', '#8a1c0c', '#4a0e06'], wood: ['#2b1708', '#5a2c12', '#a0522d', '#f2542d'], trim: '#ffb35c', accent: '#f2542d', toy: '#f2542d' },
  },
  { id: 'finish_rainbow', kind: 'finish', name: 'Rainbow', line: 'Loud on purpose. The colours keep moving.', price: 16, swatch: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff'], look: { rainbow: true, trim: '#ffffff' } },

  { id: 'trail_classic', kind: 'trail', name: 'Sunbeam', line: 'A clean, warm swish.', price: 0, swatch: ['#ffe082', '#fffbeb'], look: { trail: 'classic' } },
  { id: 'trail_fire', kind: 'trail', name: 'Fire', line: 'Every swipe leaves a little heat behind.', price: 5, swatch: ['#ff7828', '#ffdc78'], look: { trail: 'fire' } },
  { id: 'trail_ice', kind: 'trail', name: 'Frost', line: 'Cold, crisp and very Canadian.', price: 5, swatch: ['#78c8ff', '#e6f8ff'], look: { trail: 'ice' } },
  { id: 'trail_leaf', kind: 'trail', name: 'Clover', line: 'Fresh green, like a lucky field.', price: 5, swatch: ['#6ec850', '#dcffbe'], look: { trail: 'leaf' } },
  { id: 'trail_candy', kind: 'trail', name: 'Bubblegum', line: 'Pink and fizzy. Do not chew.', price: 6, swatch: ['#ff78c8', '#ffe6f5'], look: { trail: 'candy' } },
  { id: 'trail_rainbow', kind: 'trail', name: 'Rainbow', line: 'Shows the whole field how good you are.', price: 12, swatch: ['#ff6b6b', '#ffd93d', '#4d96ff'], look: { trail: 'rainbow' } },

  { id: 'bird_crow', kind: 'bird', name: 'Crow', line: 'The original troublemaker.', price: 0, swatch: ['#1e293b', '#f59e0b'], look: { bird: ['#1e293b', '#f59e0b'] } },
  { id: 'bird_jay', kind: 'bird', name: 'Blue jay', line: 'Loud, proud and very blue.', price: 4, swatch: ['#3b82f6', '#1f2937'], look: { bird: ['#3b82f6', '#1f2937'] } },
  { id: 'bird_cardinal', kind: 'bird', name: 'Cardinal', line: 'Red as October in Gatineau.', price: 4, swatch: ['#dc2626', '#f59e0b'], look: { bird: ['#dc2626', '#f59e0b'] } },
  { id: 'bird_gull', kind: 'bird', name: 'Seagull', line: 'Steals fries. And crops.', price: 4, swatch: ['#f1f5f9', '#f59e0b'], look: { bird: ['#f1f5f9', '#f59e0b'] } },
  { id: 'bird_finch', kind: 'bird', name: 'Goldfinch', line: 'Small, bright and always in a hurry.', price: 8, swatch: ['#facc15', '#f97316'], look: { bird: ['#facc15', '#f97316'] } },

  { id: 'coin_gold', kind: 'coin', name: 'Gold', line: 'Good old coins.', price: 0, swatch: ['#f6cf6d', '#a56d24'], look: {} },
  { id: 'coin_silver', kind: 'coin', name: 'Silver', line: 'Shiny, quiet, very polite.', price: 3, swatch: ['#e5e7eb', '#6b7280'], look: { coin: ['#6b7280', '#e5e7eb', '#ffffff', '#9ca3af', '#ffffff'] } },
  { id: 'coin_rose', kind: 'coin', name: 'Rose gold', line: 'Fancy money for a fancy farmer.', price: 5, swatch: ['#f4b6c2', '#9f4f5a'], look: { coin: ['#9f4f5a', '#f4b6c2', '#ffe4ea', '#c9737f', '#fff5f7'] } },
  { id: 'coin_emerald', kind: 'coin', name: 'Emerald', line: 'Green like the crops that paid for them.', price: 6, swatch: ['#34d399', '#065f46'], look: { coin: ['#065f46', '#34d399', '#d1fae5', '#047857', '#ecfdf5'] } },
];

export interface FlairState {
  owned: string[];
  equipped: Record<FlairKind, string>;
}

export function newFlair(): FlairState {
  return { owned: FLAIR.filter(f => f.price === 0).map(f => f.id), equipped: { finish: 'finish_classic', trail: 'trail_classic', bird: 'bird_crow', coin: 'coin_gold' } };
}

export function flairById(id: string): FlairItem | undefined {
  return FLAIR.find(f => f.id === id);
}

export function parseFlair(o: any): FlairState {
  const f = newFlair();
  if (!o || typeof o !== 'object') return f;
  if (Array.isArray(o.owned)) for (const id of o.owned) if (typeof id === 'string' && flairById(id) && !f.owned.includes(id)) f.owned.push(id);
  if (o.equipped && typeof o.equipped === 'object') {
    for (const k of Object.keys(f.equipped) as FlairKind[]) {
      const id = o.equipped[k];
      const item = typeof id === 'string' ? flairById(id) : undefined;
      if (item && item.kind === k && f.owned.includes(id)) f.equipped[k] = id;
    }
  }
  return f;
}

export function buyFlair(f: FlairState, ribbons: number, id: string): { ok: boolean; cost: number } {
  const item = flairById(id);
  if (!item || f.owned.includes(id) || ribbons < item.price) return { ok: false, cost: 0 };
  f.owned.push(id);
  f.equipped[item.kind] = id;
  return { ok: true, cost: item.price };
}

export function equipFlair(f: FlairState, id: string): boolean {
  const item = flairById(id);
  if (!item || !f.owned.includes(id)) return false;
  f.equipped[item.kind] = id;
  return true;
}

/** The engine look for what is equipped. */
export function lookFor(f: FlairState): Look {
  const out: Look = {};
  for (const k of Object.keys(f.equipped) as FlairKind[]) Object.assign(out, flairById(f.equipped[k])?.look || {});
  return out;
}

/** Ribbons for a city result: one per new star, two for a first crown, three for a first boss win. */
export function ribbonsForWin(oldStars: number, newStars: number, newCrown: boolean, firstBossWin: boolean): number {
  return Math.max(0, newStars - oldStars) + (newCrown ? 2 : 0) + (firstBossWin ? 3 : 0);
}
