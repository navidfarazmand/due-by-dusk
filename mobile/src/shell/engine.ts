// Typed bridge to Gemini's farm engine (window.__DBD_ENGINE) and its events (window.__dbdEvent).

import type { CityPlan } from '../game/plan';
import type { Levels } from '../game/workshop';

export type EngineMode = 'idle' | 'day' | 'dusk';

export interface BossHud {
  name: string;
  type: string;
  hp: number;
  max: number;
  down: boolean;
  phase: number;
  onField: boolean;
  bounty: number;
}

export interface EngineState {
  mode: EngineMode;
  paused: boolean;
  day: number;
  cash: number;
  bill: number;
  billsPaid: number;
  billCount: number;
  due: number;
  played: boolean;
  won: boolean;
  lost: boolean;
  pendingPerks: string[] | null;
  perks: string[];
  extraDayUsed: boolean;
  boss: BossHud | null;
  lastEarn: number;
  lastCount: number;
  lastBest: number;
  harvested: number;
  earned: number;
  paidTotal: number;
  bestChain: number;
  cityId: string;
  country: string;
  sound: boolean;
  diamonds: number;
  grit: number;
  learnedSkills: string[];
  shed: Levels;
  time: number;
  dayLen: number;
}

export interface BillInfo {
  index: number;
  count: number;
  name: string;
  amt: number;
  note: string;
  left: number;
  tonight: boolean;
  dueDay: number;
  /** Paying is allowed: enough cash and the bill is due tonight. */
  canPay: boolean;
  /** Enough cash for it (it may not be due yet). */
  covered: boolean;
  /** The deed is waiting for the boss to be knocked out. */
  bossBlock: boolean;
}

export interface HudState {
  mode: EngineMode;
  paused: boolean;
  cash: number;
  today: number;
  count: number;
  best: number;
  bill: { name: string; amt: number } | null;
  billNo: number;
  billTotal: number;
  combo: number;
  comboT: number;
  grace: number;
  mult: number;
  tiers: Array<{ count: number; mul: number }>;
  rushCharge: number;
  rushGoal: number;
  rushT: number;
  rushDur: number;
  time: number;
  dayLen: number;
  sound: boolean;
  boss: BossHud | null;
}

export interface PerkInfo {
  id: string;
  name: string;
  line: string;
  /** 1 wooden, 2 silver, 3 gold chest. */
  tier: number;
  icon: string;
}

export interface ChestInfo {
  /** 1 wooden, 2 silver, 3 gold, 4 diamond (an ad upgrade: four gold perks, pick two). */
  tier: number;
  perks: PerkInfo[];
  /** Perks still to pick from this chest (2 for a diamond chest). */
  picks?: number;
  /** Already upgraded with an ad (once per chest). */
  upgraded?: boolean;
}

export interface DayEvent {
  id: string;
  title: string;
  desc: string;
}

export interface Today {
  earned: number;
  count: number;
  best: number;
  bonus: number;
  rushes: number;
  lucky: number;
  /** Boss bounty paid today (0 if none). */
  boss?: number;
}

export interface EngineApi {
  state(): EngineState;
  bill(): BillInfo;
  bills(): Array<BillInfo & { days: number }>;
  perkInfo(id: string): PerkInfo | null;
  /** The chest waiting after a bill (null when none). */
  pendingChest(): ChestInfo | null;
  /** After a rewarded ad: the waiting chest becomes a better one (null if it can't). */
  upgradeChest(): ChestInfo | null;
  /** The intro (side farm only): the boss falls after about `sec` seconds of hitting; `left` seconds of light. */
  introFinale(sec: number, left: number): boolean;
  /** Ends a side farm's day now. */
  endDayNow(): boolean;
  hud(): HudState;
  /** The current day's stats (damage, reach, prices…). */
  stats(): Record<string, number | string | boolean>;
  beginCity(o: { cityId: string; country: string; cash: number; shed: Levels; plan: CityPlan; tools?: unknown[] }): boolean;
  setPlan(p: CityPlan): void;
  startDay(): boolean;
  payBill(): boolean;
  choosePerk(id: string): boolean;
  foreclose(): boolean;
  extraDay(): boolean;
  addCash(amt: number): boolean;
  spendCash(amt: number): boolean;
  setCash(amt: number): void;
  setShed(levels: Levels): void;
  refreshStats(): void;
  addDiamonds(n: number): void;
  setSound(on: boolean): void;
  /** The effects volume (a gain, 0..1); `sample` plays a coin at the new level. */
  setSfxVolume(v: number, sample?: boolean): void;
  setPaused(v: boolean): void;
  setTool(t: unknown): void;
  statsWith(t: unknown): Record<string, number | string | boolean>;
  initAudio(): void;
  nextEvent(): DayEvent;
  /** The whole engine state as JSON, to run a side farm (daily farm, duel) and come back. */
  snapshot(): string;
  restore(json: string): boolean;
  /** Side farms don't save, so their day can't overwrite the real farm. */
  setSaving(on: boolean): void;
  /** Seeded field: the n-th crop, prop, crow and goat are the same for everyone on that seed (0 = random). */
  setFieldSeed(seed: number): void;
  /** The skills learned on the skill map. */
  setSkills(ids: string[]): void;
}

export interface EngineEvents {
  dayStart: { day: number; dayLen: number; event: DayEvent };
  dayEnd: { today: Today; day: number; cash: number };
  idle: { day: number };
  billPaid: { index: number; name: string; amt: number; day: number; last: boolean };
  perks: { ids: string[]; tier: number; picks?: number; perks: PerkInfo[] };
  cityWon: { days: number; harvested: number; earned: number; paidTotal: number; cash: number; grit: number; bestChain: number };
  foreclosed: { bill: string; amt: number; short: number; grit: number; days: number; billsPaid: number; billTotal: number; paidTotal: number; cash: number; bossKept?: boolean };
  bossAppear: { name: string; hp: number; max: number };
  bossStomp: { phase: number; name: string };
  bossDown: { name: string; bounty: number; day: number };
  cleave: { killed: number; x: number; y: number };
}

type Handler<K extends keyof EngineEvents> = (detail: EngineEvents[K]) => void;
const handlers: Record<string, Array<(detail: unknown) => void>> = {};

export function on<K extends keyof EngineEvents>(type: K, fn: Handler<K>): void {
  (handlers[type] ||= []).push(fn as (detail: unknown) => void);
}

export function installEventBridge(): void {
  (window as any).__dbdEvent = (type: keyof EngineEvents, detail: any) => {
    for (const fn of handlers[type] || []) fn(detail);
  };
}

export function engine(): EngineApi {
  const api = (window as any).__DBD_ENGINE as EngineApi | undefined;
  if (!api) throw new Error('engine not ready');
  return api;
}

export function engineReady(): boolean {
  return !!(window as any).__DBD_ENGINE;
}

/** Resolves once the engine's farm scene has created its API (a few frames after start). */
export function whenEngineReady(): Promise<EngineApi> {
  return new Promise(resolve => {
    const tick = () => {
      const api = (window as any).__DBD_ENGINE as EngineApi | undefined;
      if (api) {
        try {
          if (api.state().mode) {
            resolve(api);
            return;
          }
        } catch {
          /* not yet */
        }
      }
      setTimeout(tick, 30);
    };
    tick();
  });
}
