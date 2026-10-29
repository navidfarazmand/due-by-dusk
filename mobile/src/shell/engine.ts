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
  canPay: boolean;
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
  hud(): HudState;
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
  setPaused(v: boolean): void;
  setTool(t: unknown): void;
  statsWith(t: unknown): Record<string, number | string | boolean>;
  initAudio(): void;
  nextEvent(): DayEvent;
}

export interface EngineEvents {
  dayStart: { day: number; dayLen: number; event: DayEvent };
  dayEnd: { today: Today; day: number; cash: number };
  idle: { day: number };
  billPaid: { index: number; name: string; amt: number; day: number; last: boolean };
  perks: { ids: string[]; perks: PerkInfo[] };
  cityWon: { days: number; harvested: number; earned: number; paidTotal: number; cash: number; grit: number; bestChain: number };
  foreclosed: { bill: string; amt: number; short: number; grit: number; days: number; billsPaid: number; billTotal: number; paidTotal: number; cash: number; bossKept?: boolean };
  bossAppear: { name: string; hp: number; max: number };
  bossStomp: { phase: number; name: string };
  bossDown: { name: string; bounty: number; day: number };
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
