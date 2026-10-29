// Tools and their attachments. One tool is in your hands at a time; the workshop upgrades work with all of them.
// Each tool plays differently (the engine reads `style` from window.__DBD_TOOL):
//  - Sickle: the starter. A quick swing around your finger.
//  - Scythe: wide and heavy. Slower swings that catch more crops at once.
//  - Flame weeder: a fast flame; crops keep cooking for a moment after you move on.
//  - Seed blaster: shoots seeds at the nearest crops in range, so you don't have to reach them.
// A new tool goes on sale when you beat the boss of a country. Attachments are bought per tool (3 levels each).

import type { CountryCode } from './world';

export type ToolId = 'sickle' | 'scythe' | 'flame' | 'blaster';

/** What the engine reads. Multipliers apply on top of the workshop levels. */
export interface ToolStats {
  style: ToolId;
  dmg: number;
  speed: number;
  reach: number;
  /** Added crit chance (0.03 = +3 points). */
  crit: number;
  value: number;
  /** Added golden-crop chance. */
  gold: number;
  /** Seconds a crop keeps burning after the flame touches it. */
  burn: number;
  /** Seeds per shot (each to a different crop). */
  targets: number;
  /** Seed blaster range in field units (the field is about 900 wide). */
  range: number;
  storm: boolean;
  frost: boolean;
}

export interface ModDef {
  id: string;
  name: string;
  /** What one level adds, as shown on the button. */
  line: string;
  max: number;
  base: number;
  growth: number;
  apply: (s: ToolStats, level: number) => void;
}

export interface ToolDef {
  id: ToolId;
  name: string;
  blurb: string;
  price: number;
  /** Beat this country's boss to put the tool on sale (null: you start with it). */
  after: CountryCode | null;
  base: Omit<ToolStats, 'style'>;
  mods: ModDef[];
}

const BASE: Omit<ToolStats, 'style'> = {
  dmg: 1, speed: 1, reach: 1, crit: 0, value: 1, gold: 0, burn: 0, targets: 1, range: 0, storm: false, frost: false,
};

export const TOOLS: ToolDef[] = [
  {
    id: 'sickle', name: 'Sickle', price: 0, after: null,
    blurb: 'Quick swings around your finger. Good at everything, great at nothing.',
    base: { ...BASE },
    mods: [
      { id: 'whetstone', name: 'Whetstone', line: '+12% damage', max: 3, base: 40, growth: 2.2, apply: (s, l) => { s.dmg *= 1 + 0.12 * l; } },
      { id: 'grip', name: 'Long grip', line: '+7% reach', max: 3, base: 50, growth: 2.2, apply: (s, l) => { s.reach *= 1 + 0.07 * l; } },
      { id: 'charm', name: 'Lucky charm', line: '+3% crit chance', max: 3, base: 60, growth: 2.2, apply: (s, l) => { s.crit += 0.03 * l; } },
    ],
  },
  {
    id: 'scythe', name: 'Scythe', price: 900, after: 'CA',
    blurb: 'A wide, heavy sweep. Slower swings, but it cuts a whole patch at once.',
    base: { ...BASE, dmg: 1.3, speed: 0.8, reach: 1.38 },
    mods: [
      { id: 'wide', name: 'Wide blade', line: '+8% reach', max: 3, base: 320, growth: 2.0, apply: (s, l) => { s.reach *= 1 + 0.08 * l; } },
      { id: 'weight', name: 'Counterweight', line: '+10% swing speed', max: 3, base: 380, growth: 2.0, apply: (s, l) => { s.speed *= 1 + 0.1 * l; } },
      {
        id: 'storm', name: 'Storm rod', line: 'Crits throw lightning, +3% crit', max: 3, base: 480, growth: 2.0,
        apply: (s, l) => { if (l > 0) s.storm = true; s.crit += 0.03 * l; },
      },
    ],
  },
  {
    id: 'flame', name: 'Flame weeder', price: 2400, after: 'US',
    blurb: 'A fast, hot flame. Crops keep cooking for a moment after you move on.',
    base: { ...BASE, dmg: 0.55, speed: 2.3, reach: 1.15, burn: 1.4 },
    mods: [
      { id: 'tank', name: 'Bigger tank', line: '+0.5 s of burning', max: 3, base: 800, growth: 2.0, apply: (s, l) => { s.burn += 0.5 * l; } },
      { id: 'nozzle', name: 'Hot nozzle', line: '+12% damage', max: 3, base: 900, growth: 2.0, apply: (s, l) => { s.dmg *= 1 + 0.12 * l; } },
      { id: 'cone', name: 'Wide cone', line: '+8% reach', max: 3, base: 1000, growth: 2.0, apply: (s, l) => { s.reach *= 1 + 0.08 * l; } },
    ],
  },
  {
    id: 'blaster', name: 'Seed blaster', price: 6000, after: 'BR',
    blurb: 'Fires seeds at the nearest crops in range. Hit them from across the field.',
    base: { ...BASE, dmg: 2.3, speed: 1.0, reach: 0.8, range: 230 },
    mods: [
      { id: 'scope', name: 'Scope', line: '+18% range', max: 3, base: 2000, growth: 2.0, apply: (s, l) => { s.range *= 1 + 0.18 * l; } },
      { id: 'barrel', name: 'Extra barrel', line: '+1 seed per shot', max: 3, base: 2600, growth: 2.0, apply: (s, l) => { s.targets += l; } },
      {
        id: 'golden', name: 'Golden seeds', line: '+8% crop prices', max: 3, base: 3000, growth: 2.0,
        apply: (s, l) => { s.value *= 1 + 0.08 * l; s.gold += 0.004 * l; },
      },
    ],
  },
];

export interface ToolsState {
  owned: ToolId[];
  equipped: ToolId;
  /** Attachment levels, keyed "tool.mod". */
  mods: Record<string, number>;
}

export function newTools(): ToolsState {
  return { owned: ['sickle'], equipped: 'sickle', mods: {} };
}

export function toolDef(id: ToolId): ToolDef {
  const t = TOOLS.find(x => x.id === id);
  if (!t) throw new Error('unknown tool ' + id);
  return t;
}

export function isToolId(v: unknown): v is ToolId {
  return typeof v === 'string' && TOOLS.some(t => t.id === v);
}

export function modLevel(st: ToolsState, tool: ToolId, mod: string): number {
  return st.mods[`${tool}.${mod}`] || 0;
}

/** Price of the next level of an attachment, or null when it is maxed. */
export function modCost(tool: ToolId, mod: string, level: number): number | null {
  const m = toolDef(tool).mods.find(x => x.id === mod);
  if (!m || level >= m.max) return null;
  const raw = m.base * Math.pow(m.growth, level);
  return raw < 1000 ? Math.round(raw / 10) * 10 : Math.round(raw / 50) * 50;
}

/** The stats of a tool with its attachments (the equipped one by default). */
export function toolStats(st: ToolsState, id: ToolId = st.equipped): ToolStats {
  const def = toolDef(id);
  const s: ToolStats = { style: id, ...def.base };
  for (const m of def.mods) {
    const l = modLevel(st, id, m.id);
    if (l > 0) m.apply(s, l);
  }
  return s;
}

/** Validates saved tool data. */
export function parseTools(o: any): ToolsState {
  const t = newTools();
  if (!o || typeof o !== 'object') return t;
  if (Array.isArray(o.owned)) for (const id of o.owned) if (isToolId(id) && !t.owned.includes(id)) t.owned.push(id);
  if (isToolId(o.equipped) && t.owned.includes(o.equipped)) t.equipped = o.equipped;
  if (o.mods && typeof o.mods === 'object') {
    for (const def of TOOLS) {
      for (const m of def.mods) {
        const v = o.mods[`${def.id}.${m.id}`];
        if (typeof v === 'number' && Number.isFinite(v) && v > 0) t.mods[`${def.id}.${m.id}`] = Math.min(m.max, Math.floor(v));
      }
    }
  }
  return t;
}

/** Short stat lines for the tool card, relative to the sickle. */
export function toolSummary(s: ToolStats): string[] {
  const pct = (v: number) => `×${v.toFixed(2)}`;
  const out = [`Damage ${pct(s.dmg)}`, `Speed ${pct(s.speed)}`];
  if (s.style === 'blaster') out.push(`Range ${Math.round(s.range)}`, `${s.targets} seed${s.targets > 1 ? 's' : ''} a shot`);
  else out.push(`Reach ${pct(s.reach)}`);
  if (s.burn > 0) out.push(`Burns ${s.burn.toFixed(1)} s`);
  if (s.crit > 0) out.push(`+${Math.round(s.crit * 100)}% crit`);
  if (s.value > 1) out.push(`Prices ${pct(s.value)}`);
  if (s.storm) out.push('Lightning on crits');
  return out;
}
