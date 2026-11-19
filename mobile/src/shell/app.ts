// The game around the field: menu, world and country maps, the farmhouse between days, sundown,
// won and lost screens, the upgrade tree, settings. Gemini's engine runs the days; this file runs the game.

import { Capacitor } from '@capacitor/core';
import { COUNTRIES, ROUTE, type CountryCode, cityById, countryOf, isBossCity, routeIndex } from '../game/world';
import { GROW_FAST, PRACTICE_CROP_HP, PRACTICE_SPAWN, cropName, goldCredit, niceMoney, paceMul, planFor, toughnessFor, updatePace, winCredit, type BillKind, type CityPlan, avgDay } from '../game/plan';
import { CROP_LEVEL_MAX, cropLevel, cropLevelProgress, cropPay, cropPayTable } from '../game/road';
import { bestPower } from '../game/power';
import {
  DEFAULT_TOUCH_LIFT, GAME_SAVE_KEY, RECENT_DAYS, coinsForDays, MAX_TOUCH_LIFT, bankAfterWin, cityLock, cityProgress, countryLock, countryStars, frontierCity, newGame, nextCity, paidAfterRun,
  jarAfterForeclosure, parseGame, spendableFarmCash, starGate, starsFor, todayKey, toolLock, totalStars, type GameSave, type RunInfo,
} from '../game/progress';
import { FLAIR, buyFlair, equipFlair, flairById, lookFor, type FlairKind } from '../game/flair';
import { DAILY_AD_TRIES, MEDAL_NAME, dailyFor, duelFor, medalOf, newDaily, sidePlan, triesLeft, type SideDef } from '../game/daily';
import { SHED_FX, emptyLevels, formatDuration, type Levels, type UpgradeId } from '../game/workshop';
import { POWER_UNLOCK_LINE, TOOLS, anyPower, hasPower, isToolId, modCost, modLevel, newTools, toolDef, toolStats, toolSummary, type ToolId } from '../game/tools';
import { ART, BAND, MAP, NODES, PREVIEW, SPRITE, bandFor, cropChip, spriteImg } from './art';
import { $, ICON, TOOL_ICON, cap, clamp, esc, money, stars } from './dom';
import { engine, on, type BillInfo, type ChestInfo, type DayEvent, type EngineState, type Today } from './engine';
import { CHEST_UP_ICON, chestBurst, chestName, chestSvg, newTodayHtml, perkCard, perkIcon } from './chest';
import { FarmHud, deviceText, eventIcon, touchy } from './hud';
import { REPORT_EMAIL, reportDetails, sendReport, watchErrors, watchShake } from '../platform/report';
import { checkForUpdate, startUpdate, type UpdateOffer } from '../platform/update';
import { Coach, cropIcon, peek, type FieldPeek, type Pt, type TipOpts } from './coach';
import { playStory } from './story';
import { LANGS, deviceLang, inner, isLang, lang, setLang, t, tn, tx, type Lang } from '../i18n/i18n';
import { watchLayout, layout } from './layout';
import { adsAvailable, canOffer, coinsWait, offerAllowed, onAdsChanged, watch } from './offers';
import { PINS } from './pins';
import { DEFAULT_VOLUME, LICENCE_URL, Music, TRACKS, trackById, volGain, type Mood } from './music';
import {
  barnHtml, calendarIcon, dailyHtml, duelCities, duelHtml, duelIcon, sideResultHtml,
  type DuelSetup, type SideOutcome,
} from './extras';
import { ribbonIcon } from './looks';
import { arthurOnCard } from './arthur';
import { TREE_PX, TREE_STEP, centerTree, sizeTree, treeFitPx, treeMapHtml } from './treeview';
import { attachTreeGestures, zoomTreeBy, type TreeZoomHost } from './treezoom';
import { hapticImpact } from '../platform/mobile';
import { addWorker, collectPen, newPen, penFill, penRate, penStored, workerCount, workerLevel, workerRate as workerRateOf, PEN_CAP_HOURS } from '../game/pen';
import { TREE_SKILL, buildingNode, buyNode, setTreeMoney, setTreePower, settleTree, treeLevel as treeLevelOf, treeNode, treeReady } from '../game/tree';

type Screen = 'menu' | 'world' | 'country' | 'farmhouse' | 'farm' | 'sundown' | 'won' | 'lost' | 'tree' | 'barn' | 'daily' | 'duel' | 'side' | 'pen';

/** A side farm in progress (the daily farm or one duel turn): the real farm waits in a snapshot. */
interface SideRun {
  kind: 'daily' | 'duel';
  def: SideDef;
  snap: string;
  sound: boolean;
  /** The daily farm's date (a try that ends after midnight scores nothing). */
  date: string;
  /** Duel: whose turn (0 or 1). */
  turn: number;
  score: number;
}

interface DuelState extends DuelSetup {
  seed: number;
  scores: [number, number];
  /** Who plays first this round (alternates on rematch). */
  first: number;
}


interface DayResult {
  day: number;
  /** Tax still owed that the collector took from today's harvest (0.14). */
  collector?: number;
  /** Vegetables whose level rose with today's cuts (0.13, the road). */
  levelUps?: Array<{ type: string; level: number }>;
  today: Today;
  event: DayEvent | null;
  doubled: boolean;
}

interface CityResult {
  kind: 'won' | 'lost';
  /** The farm was already the player's when the run started (0.13): nothing went to savings. */
  own?: boolean;
  cityId: string;
  stars: number;
  /** The second star: 0.16, a big day (it was money kept after the big bill; the name stays for old saves). */
  spare: boolean;
  /** The second star's goal in this run (0.16: the town's big day), and the run's best day. */
  goal?: number;
  best?: number;
  /** 0.15 (the third star, after rivals and crowns left): caught without the bank ever coming in this town. */
  firstTry: boolean;
  firstWin: boolean;
  /** Tree credit for a first win (a boss farm pays twice). */
  credit: number;
  ribbons?: number;
  days: number;
  earned: number;
  harvested: number;
  wallet: number;
  /** Savings banked from this run, and what the farm had paid before it (0 on a first win). */
  banked: number;
  mark: number;
  /** Cash left on the farm after the deed (the second star wants the farm's spare goal). */
  kept?: number;
  short?: number;
  bill?: string;
  bossKept?: boolean;
}

/** 0.14: a bill's kind on its icon: rent is the house, the bank's loan the bank, the big bill a sealed letter. */
const BANK_ICON = (size: number) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9.5 12 4l9 5.5Z" fill="#FFC23D" stroke="#2B1708" stroke-width="1.8" stroke-linejoin="round"/><path d="M5.8 11v6.5M10 11v6.5M14 11v6.5M18.2 11v6.5" stroke="#2B1708" stroke-width="2.3" stroke-linecap="round"/><path d="M3.5 20h17" stroke="#2B1708" stroke-width="2.4" stroke-linecap="round"/></svg>`;
const BIG_BILL_ICON = (size: number) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h10l4 4v14H5Z" fill="#FFF7E0" stroke="#2B1708" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 8h6M8 11h8M8 14h5" stroke="#2B1708" stroke-width="1.6" stroke-linecap="round"/><circle cx="15.6" cy="17.2" r="3.3" fill="#E03131" stroke="#2B1708" stroke-width="1.4"/><path d="M14.4 17.2h2.4" stroke="#FFD9D9" stroke-width="1.2" stroke-linecap="round"/></svg>`;
function billIcon(kind: BillKind | undefined, size: number): string {
  return kind === 'rent' ? ICON.house(size) : kind === 'bank' ? BANK_ICON(size) : kind === 'big' ? BIG_BILL_ICON(size) : ICON.notice(size);
}

/** 0.16: the things to grab on the field, as the field draws them (gemini-engine.js, drawPropsCrowsAndWeather), for
 *  their tips: a fertilizer bag (a sack with a sprout, +4), a clover treat (a four-leaf clover on a gold coin), an egg. */
const PROP_ICON: Record<'fertilizer' | 'clover' | 'egg', string> = {
  fertilizer: `<svg width="40" height="44" viewBox="-20 -44 40 48" aria-hidden="true"><path d="M-12 -2 Q-15 -20 -7 -24 L7 -24 Q15 -20 12 -2 Q0 2 -12 -2 Z" fill="#C89B5E" stroke="#2B1708" stroke-width="2"/><rect x="-8" y="-28" width="16" height="5" rx="2" fill="#A7783F" stroke="#2B1708" stroke-width="2"/><path d="M0 -28 V-36" stroke="#166534" stroke-width="2"/><ellipse cx="-5" cy="-38" rx="5" ry="3" transform="rotate(-29 -5 -38)" fill="#4ade80" stroke="#2B1708" stroke-width="1.4"/><ellipse cx="5" cy="-39" rx="5" ry="3" transform="rotate(29 5 -39)" fill="#4ade80" stroke="#2B1708" stroke-width="1.4"/><circle cx="0" cy="-12" r="7.5" fill="#16a34a" stroke="#2B1708" stroke-width="1.4"/><text x="0" y="-9" text-anchor="middle" font-size="9" font-weight="bold" fill="#fff" font-family="sans-serif">+4</text></svg>`,
  clover: `<svg width="36" height="36" viewBox="-16 -29 32 32" aria-hidden="true"><circle cx="0" cy="-13" r="13" fill="#FFC23D" stroke="#2B1708" stroke-width="2"/><g fill="#22c55e" stroke="#2B1708" stroke-width="1.4"><circle cx="-4.2" cy="-17.2" r="4.6"/><circle cx="4.2" cy="-17.2" r="4.6"/><circle cx="-4.2" cy="-8.8" r="4.6"/><circle cx="4.2" cy="-8.8" r="4.6"/></g><circle cx="0" cy="-13" r="2.4" fill="#FFE27A"/></svg>`,
  egg: `<svg width="30" height="36" viewBox="-12 -24 24 26" aria-hidden="true"><ellipse cx="0" cy="-11" rx="8.5" ry="11" fill="#fffbeb" stroke="#78532a" stroke-width="1.6"/><ellipse cx="-3" cy="-15" rx="2.2" ry="3.2" fill="#fff"/></svg>`,
};

/** 0.14: the Pen's sign, a fence with a gate. */
const PEN_ICON = (size: number) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21V8l2-2 2 2v13M10 21V8l2-2 2 2v13M17 21V8l2-2 2 2v13" fill="#E5A56C" stroke="#2B1708" stroke-width="1.7" stroke-linejoin="round"/><path d="M2 11.5h20M2 17h20" stroke="#2B1708" stroke-width="2.2" stroke-linecap="round"/></svg>`;

/** The language button's globe. */
const GLOBE = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2B1708" stroke-width="2.2" aria-hidden="true"><circle cx="12" cy="12" r="9.2" fill="#6EC6F0"/><path d="M3 12h18M12 2.8c3 3.2 3 15.2 0 18.4M12 2.8c-3 3.2-3 15.2 0 18.4"/></svg>`;

const EVENT_LINES: Record<string, string> = {
  market: 'Market days: prices are up.',
  gale: 'Windy days: leaves fly and crops sway.',
  rain: 'Rainy days: puddles and fast growth.',
  frost: 'Frosty mornings: frozen crops take extra hits.',
  fair: 'County fair: pumpkins and onions pay more.',
  stampede: 'Restless goat days: watch your step.',
};

export class GameApp {
  private g: GameSave;
  private root: HTMLElement;
  private sections: Record<string, HTMLElement> = {};
  private modal!: HTMLElement;
  private hud: FarmHud;
  private scr: Screen = 'menu';
  private worldSel: CountryCode = 'CA';
  private countrySel: CountryCode = 'CA';
  private citySel = ROUTE[0].id;
  private fhTab: 'tools' | 'perks' | 'bills' = 'tools';
  private toolSel: ToolId = 'sickle';
  /** The language list was opened from Settings (it then offers Back as well as Done). */
  private langFromSettings = false;
  /** When a purchase last warned about tonight's bill (a second tap within 5 s buys anyway). */
  /** The tap that asked to spend: tonight's-bill check repeats it after "Buy anyway" (found again by its act, as the
   *  panel may have been drawn again meanwhile). */
  private lastAct = { act: '', arg: '' };
  private billOk = false;
  /** The perk card picked out, waiting for a second tap (Navid, 4 Nov: confirm before taking a perk). */
  private perkSel = '';
  /** 'day' when the chest opened from Sundown's next-day button: picking the perk starts the day. */
  private afterChest = '';
  /** When the effects slider last played its sample coin. */
  private lastVolSample = 0;
  private day: DayResult | null = null;
  private result: CityResult | null = null;
  private pendingEvent: DayEvent | null = null;
  private busy = false;
  private saveT = 0;
  private music: Music;
  private barnTab: FlairKind = 'finish';
  private barnSel = '';
  private side: SideRun | null = null;
  /** The intro (first Play): a boss finale played by the ghost finger on a side farm. */
  /** The intro or the practice farm (both are side farms the real farm waits behind). `replay`: started from
   *  Settings, so it ends on the menu instead of starting the first farm. */
  private intro: { snap: string; sound: boolean; ending: boolean; down: boolean; at: Pt | null; practice?: boolean; replay?: boolean } | null = null;
  private coach = new Coach();
  /** No new field moment before this time (ms). */
  private momentCool = 0;
  /** A "something new" card is holding the field. */
  private carding = false;
  /** When the game last came back to the screen (the shake waits a moment after it). */
  private shownAt = 0;
  /** Where the player was when they opened Report a problem. */
  private reportPlace: { screen: string; farm?: string; day?: number; lang: string } | null = null;
  /** The update pop-up was shown this launch, and what it offered. */
  private updateAsked = false;
  private updateOffer: UpdateOffer | null = null;
  /** Where the upgrade tree and the Bling Barn go back to. */
  private backTo: Screen = 'menu';
  private sideOut: SideOutcome | null = null;
  private duel: DuelState | null = null;

  constructor(private persist: (key: string, value: string) => void) {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(GAME_SAVE_KEY);
    } catch {
      /* private mode */
    }
    this.g = parseGame(raw);
    // the player's language, else the phone's (when it is one of ours); the engine's field words follow it
    setLang(isLang(this.g.settings.lang) ? this.g.settings.lang : deviceLang());
    (window as unknown as { __DBD_T?: (s: string) => string }).__DBD_T = tx;
    this.localizeStatic();
    // the workshop's step sizes, read by the engine's stats
    (window as any).__DBD_SHED_FX = SHED_FX;
    this.music = new Music(this.g.settings.music, { field: this.g.settings.fieldTrack, menu: this.g.settings.menuTrack });
    this.music.setVolumes(this.volume('music'), this.volume('sound'));
    (window as any).__dbdRooster = () => {
      try {
        return this.music.crow(engine().state().sound);
      } catch {
        return false;
      }
    };
    this.root = document.createElement('div');
    this.root.id = 'dbdScreens';
    document.body.append(this.root);
    for (const s of ['menu', 'world', 'country', 'farmhouse', 'sundown', 'won', 'lost', 'tree', 'barn', 'daily', 'duel', 'side', 'pen']) {
      const el = document.createElement('section');
      el.className = 'scr scr-' + s;
      el.dataset.scr = s;
      el.hidden = true;
      this.root.append(el);
      this.sections[s] = el;
    }
    this.modal = document.createElement('section');
    this.modal.className = 'scr scr-modal';
    this.modal.hidden = true;
    this.root.append(this.modal);
    // the field's sound button opens the pause card, which holds the music and effects switches (Navid, 3 Nov)
    this.hud = new FarmHud($('stage'), () => this.pauseForSound());
    this.root.addEventListener('click', e => this.click(e));
    // 0.15.1: the Skills map pans with a finger and zooms with two (treezoom.ts)
    attachTreeGestures(this.sections.tree, this.treeHost);
    // Settings → the two volume sliders: heard while dragging, saved on release
    this.root.addEventListener('input', e => this.volumeInput(e, false));
    this.root.addEventListener('change', e => this.volumeInput(e, true));
    watchLayout(this.root);
    onAdsChanged(() => this.refresh());
    const c = cityById(nextCity(this.g));
    if (c) {
      this.worldSel = c.country;
      this.countrySel = c.country;
      this.citySel = c.id;
    }
  }

  // ------------------------------------------------------------------ boot and saving

  /** Called once the engine is ready: make the engine's farm match the saved game. */
  start(): void {
    const e = engine();
    this.wireEngine();
    e.setSfxVolume(volGain(this.volume('sound')));
    e.setTouchLift(this.touchLift());
    this.wirePauseCard();
    // Report a problem: one strong shake anywhere, or Settings → Report a problem
    watchErrors();
    // (0.15.2: not while the game is in the background or in its first 3 s back, when a phone moves as apps are switched)
    watchShake(
      () => this.openReport(),
      () => this.g.settings.shakeReport !== false && this.modal.hidden && !document.hidden && Date.now() - this.shownAt > 3000,
    );
    // 0.15.2: the report card closes when the game goes to the background (its email app opened, or the player left);
    // a tester (Samsung, 18 Nov) came back from another app to a card whose buttons no longer answered
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.modal.dataset.kind === 'report') this.closeModal();
      } else this.shownAt = Date.now();
    });
    // v0.10 rebuilt the workshop and the farms: old upgrades were refunded, and an old farm's cash is saved too
    if (this.g.migratedRefund != null) {
      let farmCash = 0;
      if (this.g.migratedFarm) {
        const st = e.state();
        if (!st.won && !st.lost) farmCash = Math.max(0, Math.round(st.cash));
      }
      this.g.wallet += farmCash;
      const back = this.g.migratedRefund + farmCash;
      const road = !!this.g.migratedRoad, hadTown = !!this.g.migratedFarm;
      delete this.g.migratedRefund;
      delete this.g.migratedFarm;
      delete this.g.migratedRoad;
      e.setShed(this.g.workshop.levels);
      this.saveNow();
      // 0.14: the town in progress starts again with the new bills, its cash in the jar
      if (road) {
        if (hadTown)
          setTimeout(() => this.toast(back > 0 ? t('New towns and bills: your town starts again, and its {amt} went to your jar.', { amt: money(back) }) : t('New towns and bills: your town starts again.'), 3600), 900);
      } else if (back > 0) setTimeout(() => this.toast(t('New workshop and longer farms: {amt} back in your savings.', { amt: money(back) })), 900);
    }
    // 0.13: learned skills are tree nodes now and diamonds became money (progress.ts); say so once
    if (this.g.migratedTree) {
      const m = this.g.migratedTree;
      delete this.g.migratedTree;
      this.saveNow();
      if (m.credit > 0) setTimeout(() => this.toast(t('Skills moved to the upgrade tree. Your diamonds became {amt} in your savings.', { amt: money(m.credit) }), 4200), 1400);
      else setTimeout(() => this.toast(t('Your skills moved to the upgrade tree.'), 3200), 1400);
    }
    // 0.13.1 (Navid, 14 Nov: "why it has two different currency... shouldn't be all gold?"): one money. Tree credit
    // (0.13.0) goes into savings, which buy upgrades and tools
    if ((this.g.treeCredit || 0) > 0) {
      this.g.wallet += this.g.treeCredit || 0;
      this.g.treeCredit = 0;
      this.saveNow();
    }
    const run = this.g.run;
    if (run) {
      const st = e.state();
      const plan = this.farmPlan(run);
      if (st.cityId === run.cityId && !st.won && !st.lost) {
        e.setPlan(plan);
        e.setShed(this.g.workshop.levels);
      } else {
        // The farm save does not match (cleared storage, older build): restart this farm cleanly. A farm started
        // before v0.9 carried the savings in its cash, so they go back to savings.
        if (run.startCash > 0) this.g.wallet += run.startCash;
        run.startCash = 0;
        const tools = this.g.tools.owned.map(id => toolStats(this.g.tools, id));
        e.beginCity({ cityId: run.cityId, country: plan.country, cash: 0, shed: this.g.workshop.levels, plan, tools });
      }
    } else e.setShed(this.g.workshop.levels);
    this.settleWorkshop();
    this.applyTool();
    this.applySkills();
    this.applyLook();
    this.toolSel = this.g.tools.equipped;
    setInterval(() => this.tick(), 1000);
    const loop = (t: number) => {
      this.hud.frame(t);
      this.watchField(t);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    this.hud.syncSound(e.state().sound);
    this.show('menu');
    if (Capacitor.isNativePlatform()) {
      // Navid, 4 Nov: still no sound until a button was tapped. The app's WebView now plays without a gesture.
      this.music.unlock();
      try {
        engine().initAudio();
      } catch {
        /* the engine starts its sound on the first tap */
      }
    }
  }

  hapticsOn(): boolean {
    return this.g.settings.haptics;
  }

  private save(): void {
    clearTimeout(this.saveT);
    this.saveT = window.setTimeout(() => this.saveNow(), 50);
  }

  private saveNow(): void {
    const json = JSON.stringify(this.g);
    try {
      localStorage.setItem(GAME_SAVE_KEY, json);
    } catch {
      /* storage full or blocked; the native mirror below still runs */
    }
    this.persist(GAME_SAVE_KEY, json);
  }

  /** Cash on the farm that is running (0 between farms). Bills are paid from this only. */
  private farmCash(): number {
    return this.g.run ? engine().state().cash : 0;
  }

  /** Everything upgrades can be bought with: savings plus the farm's cash above its mark (see progress.ts). */
  private wallet(): number {
    return this.g.wallet + spendableFarmCash(this.g.run, this.farmCash());
  }

  /** Everything a tree node can be bought with: savings, then the farm's cash above its mark. */
  private treeMoney(): number {
    this.syncTreeMoney();
    return this.wallet();
  }

  /** 0.15: the tree's prices follow the player's own day where they are (an average day there times their pace). */
  private syncTreeMoney(): void {
    const run = this.g.run;
    const k = Math.max(0, routeIndex(run ? run.cityId : frontierCity(this.g)));
    // 0.16 (Navid, 19 Nov, asked whether a better player should pay more: "Same skill prices"): an average player's
    // day there, for everyone; the bills still follow the player's own days
    setTreeMoney(avgDay(k, 3), 1);
    // 0.16: the Power branch opens with the first tool that has its power bar
    setTreePower(anyPower(this.g.tools));
  }

  private tick(): void {
    if (this.settleWorkshop() && (this.scr === 'farmhouse' || this.scr === 'tree')) this.refresh();
    else if (this.g.workshop.job && (this.scr === 'farmhouse' || this.scr === 'tree')) this.updateJobBar();
  }

  /** Finishes the tree's build when its time is up (or `force`: a rewarded ad); returns true when one finished. */
  private settleWorkshop(force = false): boolean {
    const done = settleTree(this.g, Date.now(), force);
    if (!done) return false;
    engine().setShed(this.g.workshop.levels);
    this.applySkills();
    this.save();
    this.toast(done.node.kind === 'track' ? t('{name} {level} is ready.', { name: t(done.node.name), level: done.level }) : t('{name}: yours.', { name: t(done.node.name) }));
    return true;
  }

  // ------------------------------------------------------------------ engine events

  private wireEngine(): void {
    on('dayStart', d => {
      this.pendingEvent = d.event;
      this.day = null;
      if (this.intro) {
        this.hud.dayStarted(d.event, true);
        return;
      }
      // a lesson keeps the day's event banner out of its way
      const lesson = !this.side && !!this.g.run && this.dayLessons();
      this.hud.dayStarted(d.event, lesson);
    });
    on('crowSteal', () => this.hud.arthurCrow(true));
    on('crowBack', () => this.hud.arthurCrow(false));
    on('billPaid', () => {
      if (!this.side && !this.intro) this.hud.arthurBillPaid();
    });
    on('bossDown', () => {
      this.hud.arthurShock();
      if (this.intro) this.intro.down = true;
    });
    on('dayEnd', d => {
      this.hud.dayEnded();
      if (this.intro) return;
      if (this.side) {
        this.side.score = Math.round(d.today.earned);
        return;
      }
      const run = this.g.run;
      if (!run) return;
      const plan = this.farmPlan(run);
      const p = (this.g.cities[run.cityId] ||= { ...cityProgress(this.g, run.cityId) });
      const earned = Math.round(d.today.earned);
      p.bestDay = Math.max(p.bestDay, earned);
      run.bestDay = Math.max(run.bestDay, earned);
      // 0.15: the player's pace (the next towns' bills follow it): today against an average day here, the town's perks
      // taken out. Not on a King's town, where time on the King earns nothing.
      if (!plan.boss) {
        const boost = engine().perkBoost?.() || 1;
        this.g.pace = updatePace(this.g.pace, earned / (avgDay(plan.index, d.day) * boost));
      }
      // the road (0.13): today's cuts raise each vegetable's level, on a farm the player does not own yet
      const levelUps: Array<{ type: string; level: number }> = [];
      if (!run.own && d.today.kinds) {
        const cuts = (this.g.cropCuts ||= {});
        for (const [type, n] of Object.entries(d.today.kinds)) {
          if (type === 'golden' || !(n > 0)) continue;
          const before = cropLevel(cuts[type] || 0);
          cuts[type] = (cuts[type] || 0) + n;
          const after = cropLevel(cuts[type]);
          if (after > before) levelUps.push({ type, level: after });
        }
        if (levelUps.length) this.applyCropLevels();
      }
      // 0.14: tax still owed comes out of the day's harvest
      let collector = 0;
      if ((run.debt || 0) > 0) {
        const cash = Math.max(0, Math.floor(engine().state().cash));
        collector = Math.min(run.debt || 0, cash);
        if (collector > 0) engine().spendCash(collector);
        run.debt = Math.max(0, (run.debt || 0) - collector);
      }
      this.g.recentEarn = [...(this.g.recentEarn || []), earned].slice(-RECENT_DAYS);
      this.g.totals.days++;
      this.g.totals.crops += d.today.count;
      this.g.totals.earned += d.today.earned;
      this.day = { day: d.day, today: d.today, event: this.pendingEvent, doubled: false, levelUps, collector };
      this.save();
    });
    on('idle', () => {
      if (this.intro) {
        this.finishIntro();
        return;
      }
      if (this.side) {
        this.endSide();
        return;
      }
      if (this.scr === 'farm' && this.day) this.show('sundown');
    });
    on('perks', d => this.showChest({ tier: d.tier, perks: d.perks }));
    on('cityWon', d => this.cityWon(d));
    on('foreclosed', d => this.foreclosed(d));
  }

  private cityWon(d: { days: number; harvested: number; earned: number; paidTotal: number; cash: number }): void {
    this.afterChest = '';
    const run = this.g.run;
    if (!run) return;
    const plan = this.farmPlan(run);
    const p = (this.g.cities[run.cityId] ||= { ...cityProgress(this.g, run.cityId) });
    const firstWin = !p.won;
    // 0.15: the third star is for a town caught on the first try (the bank never came here)
    // 0.16: the second star is a big day (plan.bigDay in one day of the town)
    const res = starsFor({ won: true, bestDay: run.bestDay, bigDay: plan.bigDay, firstTry: !(p.fails || 0) });
    p.won = true;
    p.stars = Math.max(p.stars, res.stars);
    p.bestDays = p.bestDays ? Math.min(p.bestDays, d.days) : d.days;
    // a first win pays tree credit: two of the farm's average days (a boss farm four), so it is worth having on
    // every farm of the road (0.12's diamond was a flat amount)
    const credit = firstWin ? winCredit(plan) : 0;
    if (credit) this.g.wallet += credit;
    // 0.14 (one jar): what is left in the jar after the big bill comes back as savings and goes on to the next town
    const banked = Math.max(0, Math.round(d.cash));
    this.catchRunaway(run.cityId);
    this.g.wallet += banked;
    p.paid = paidAfterRun(run, banked);
    this.g.run = null;
    this.result = {
      kind: 'won', cityId: run.cityId, stars: res.stars, spare: res.big, goal: plan.bigDay, best: run.bestDay, firstTry: res.firstTry, firstWin, credit,
      days: d.days, earned: d.earned, harvested: d.harvested, wallet: this.g.wallet, banked, mark: run.mark, kept: Math.round(d.cash), own: !!run.own,
    };
    this.saveNow();
    this.show('won');
  }

  private foreclosed(d: { bill: string; short: number; days: number; cash: number; bossKept?: boolean }): void {
    const run = this.g.run;
    if (!run) return;
    // 0.14 (one jar): the bank takes half the jar (a quarter with the tree's Insurance, m12) and the town is tried again
    const insured = jarAfterForeclosure(d.cash, (this.g.tree || {}).m12 > 0);
    this.g.wallet += insured;
    void bankAfterWin;
    const left = this.g.wallet;
    const p = (this.g.cities[run.cityId] ||= { ...cityProgress(this.g, run.cityId) });
    p.paid = paidAfterRun(run, insured);
    // 0.15: this town can no longer be caught on the first try (the third star)
    p.fails = (p.fails || 0) + 1;
    this.g.run = null;
    this.result = {
      kind: 'lost', cityId: run.cityId, stars: 0, spare: false, firstTry: false, firstWin: false, credit: 0,
      days: d.days, earned: 0, harvested: 0, wallet: left, banked: insured, mark: run.mark, short: d.short, bill: d.bill, bossKept: !!d.bossKept,
    };
    this.saveNow();
    this.show('lost');
  }

  // ------------------------------------------------------------------ navigation

  private show(s: Screen): void {
    this.scr = s;
    if (!this.intro) this.coach.cancel();
    this.closeModal();
    for (const [k, el] of Object.entries(this.sections)) el.hidden = k !== s;
    this.root.style.display = s === 'farm' ? 'none' : '';
    document.body.classList.toggle('dbd-onscr', s !== 'farm');
    this.hud.show(s === 'farm');
    // the tree opened from Sundown keeps the field music (only the farmhouse and the menus bring the menu track)
    this.music.setMood(s === 'farm' || s === 'sundown' || (s === 'tree' && this.backTo === 'sundown') ? 'field' : 'menu');
    if (s !== 'farm') this.render(s);
    layout(this.root);
    if (s === 'farmhouse' && this.g.run) {
      let chest = false;
      try {
        const c = engine().pendingChest();
        if (c) {
          this.showChest(c);
          chest = true;
        }
      } catch {
        /* engine not ready */
      }
      if (!chest && !this.showGoals()) this.pointAtStart();
    } else if (s === 'tree') this.treeLesson();
    // the first win's credit: where it goes
    if (s === 'won' && this.result && this.result.credit && !this.g.seen.gains && this.coachOn) {
      this.g.seen.gains = true;
      this.save();
      // after the stars have landed
      setTimeout(() => {
        if (this.scr === 'won' && !this.coach.busy)
          void this.coach.point(() => this.sections.won.querySelector('.r-gains'), t('Spend them!'), () => this.scr !== 'won', 4200);
      }, 1700);
    }
  }

  private refresh(): void {
    if (this.scr !== 'farm') this.render(this.scr);
    if (!this.modal.hidden && this.modal.dataset.kind === 'panel') this.renderPanel();
    layout(this.root);
  }

  private render(s: Screen): void {
    const el = this.sections[s];
    if (!el) return;
    this.syncTreeMoney();
    if (s === 'menu') {
      el.innerHTML = this.menuHtml();
      // 0.14: back in the game, the Pen's earnings first (after the screen is up)
      setTimeout(() => {
        if (this.scr === 'menu') this.penWelcome();
      }, 400);
    }
    else if (s === 'world') el.innerHTML = this.worldHtml();
    else if (s === 'country') el.innerHTML = this.countryHtml();
    else if (s === 'farmhouse') el.innerHTML = this.farmhouseHtml();
    else if (s === 'sundown') el.innerHTML = this.sundownHtml();
    else if (s === 'won' || s === 'lost') {
      el.innerHTML = this.resultHtml();
      if (s === 'won') arthurOnCard(el.querySelector<HTMLCanvasElement>('.r-arthur'), 'won');
    }
    else if (s === 'pen') el.innerHTML = this.penHtml();
    else if (s === 'tree') {
      // keep the map where it was scrolled, unless it was just opened or zoomed, or a node was picked from a list
      const box = el.querySelector<HTMLElement>('#dbdTreeMap');
      const keep = box && !this.treeRecenter ? [box.scrollLeft, box.scrollTop] : null;
      el.innerHTML = treeMapHtml(this.g, {
        sel: this.treeSel, px: this.treePx, full: this.treeFull, money: this.treeMoney(), ad: canOffer(this.g, 'finish'), now: Date.now(), bought: this.treeBought,
      });
      this.treeBought = '';
      const nb = el.querySelector<HTMLElement>('#dbdTreeMap');
      if (keep && nb) [nb.scrollLeft, nb.scrollTop] = keep;
      else requestAnimationFrame(() => centerTree(el, this.treeSel, this.treePx));
      this.treeRecenter = false;
    }
    else if (s === 'barn') el.innerHTML = barnHtml(this.g, this.barnTab, this.barnSel, this.wallet());
    else if (s === 'daily') el.innerHTML = this.backdrop() + this.dailyScreen();
    else if (s === 'duel') el.innerHTML = this.backdrop() + this.duelScreen();
    else if (s === 'side') el.innerHTML = this.backdrop() + (this.sideOut ? sideResultHtml(this.sideOut) : '');
    if (s === 'world') this.openClouds();
    if (s === 'farmhouse' && !this.modal.hidden && this.modal.dataset.kind === 'panel') this.renderPanel();
    this.syncSoundButtons();
    // every re-render (a country pin, a city node, a tab) must re-apply the art scaling
    layout(this.root);
  }

  // ------------------------------------------------------------------ clicks

  private click(e: Event): void {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!t || t.hasAttribute('disabled')) return;
    const act = t.dataset.act || '', arg = t.dataset.arg || '';
    this.lastAct = { act, arg };
    this.music.unlock();
    try {
      engine().initAudio();
    } catch {
      /* not ready */
    }
    switch (act) {
      case 'go': this.show(arg as Screen); break;
      case 'play': this.play(); break;
      case 'continue': this.openMapAt(this.g.run ? this.g.run.cityId : nextCity(this.g)); break;
      case 'country': this.worldSel = arg as CountryCode; this.render('world'); break;
      case 'enter': this.countrySel = arg as CountryCode; this.citySel = this.firstCityToShow(arg as CountryCode); this.show('country'); break;
      case 'city': this.citySel = arg; this.render('country'); break;
      case 'farm': this.farmHere(arg); break;
      case 'start': this.startDay(); break;
      case 'surprise-ok': this.closeModal(); this.startDay(); break;
      case 'repair-now': if (this.payRepair()) { this.closeModal(); this.startDay(); } break;
      case 'repair': if (this.payRepair()) this.render('farmhouse'); break;
      case 'pay': this.payBill(); break;
      case 'bank': this.faceBank(); break;
      case 'tab':
      case 'panel': this.openPanel(arg); break;
      case 'tool': if (isToolId(arg)) { this.toolSel = arg; this.refresh(); } break;
      case 'equip': this.equip(arg); break;
      case 'buy-tool': this.buyTool(arg); break;
      case 'buy-mod': this.buyMod(arg); break;
      case 'credits': this.openCredits(); break;
      case 'music-picker': this.openMusicPicker(); break;
      case 'track-play': this.music.setPreview(this.music.previewing() === arg ? null : arg); this.openMusicPicker(); break;
      case 'track-field': this.pickTrack('field', arg); break;
      case 'track-menu': this.pickTrack('menu', arg); break;
      case 'perk': this.tapPerk(arg, t); break;
      case 'next-day': this.nextDay(); break;
      case 'chest-open': this.openChest(); break;
      case 'ad-chest': void this.adChest(); break;
      case 'ad-double': void this.adDouble(); break;
      case 'ad-coins': void this.adCoins(); break;
      case 'ad-finish': void this.adFinish(); break;
      case 'ad-extra': void this.adExtraDay(); break;
      case 'farmhouse': this.show('farmhouse'); break;
      case 'next-city': this.nextAfterWin(); break;
      case 'retry': this.farmHere(arg); break;
      case 'map': this.showCountryOf(arg || this.citySel); break;
      case 'settings': this.openSettings(); break;
      case 'languages': this.langFromSettings = arg === 'settings'; this.openLanguages(); break;
      case 'lang': this.chooseLang(arg); break;
      case 'info': this.openInfo(arg); break;
      case 'report': this.openReport(); break;
      case 'report-send': void this.submitReport(); break;
      case 'shakeReport': this.g.settings.shakeReport = this.g.settings.shakeReport === false; this.save(); this.openSettings(); break;
      case 'update-now': this.closeModal(); if (this.updateOffer) void startUpdate(this.updateOffer); break;
      case 'replay-practice': this.closeModal(); void this.playPractice(true); break;
      case 'replay-story': this.closeModal(); void playStory(); break;
      case 'replay-intro': this.closeModal(); void this.playIntro(true); break;
      case 'sound': this.toggleEffects(); break;
      case 'music': this.g.settings.music = !this.g.settings.music; this.save(); this.music.setEnabled(this.g.settings.music); this.openSettings(); break;
      case 'haptics': this.g.settings.haptics = !this.g.settings.haptics; this.save(); this.openSettings(); window.dispatchEvent(new CustomEvent('dbd:haptics', { detail: this.g.settings.haptics })); break;
      case 'close': this.closeModal(); break;
      case 'goals': this.openGoals(); break;
      case 'sp-why': this.toggleWhy(); break;
      case 'goals-ok': this.closeModal(); if (this.scr === 'farmhouse') this.pointAtStart(); break;
      case 'reset': this.confirmReset(); break;
      case 'reset-yes': this.resetGame(); break;
      case 'leave-yes': this.leaveRunAndStart(arg); break;
      case 'barn-menu': this.openBarnMenu(); break;
      case 'back': this.show(this.backTo); break;
      case 'tree': this.openTree(); break;
      case 'tree-back': this.show(this.backTo === 'tree' ? 'menu' : this.backTo); break;
      // (in full screen a tap on a node comes back to the map at its size before, on that node)
      case 'tree-node': if (this.treeFull) this.leaveTreeFull(arg); else { this.treeSel = arg; this.render('tree'); } break;
      case 'tree-full': this.toggleTreeFull(); break;
      // from a list (what is ready to buy, the build in progress): the map goes to the node
      case 'tree-pick': this.treeSel = arg; this.treeRecenter = true; this.render('tree'); break;
      case 'tree-buy': this.buyTreeNode(arg); break;
      case 'pen': this.openPen(); break;
      case 'pen-back': this.show(this.penBack); break;
      case 'pen-collect': this.collectPen(false); break;
      case 'pen-double': void this.collectPen(true); break;
      case 'tree-zoom': zoomTreeBy(this.sections.tree, this.treeHost, Number(arg) > 0 ? TREE_STEP : 1 / TREE_STEP); break;
      case 'barn': if (!this.modal.hidden) this.closeModal(); this.backTo = this.scr === 'tree' || this.scr === 'barn' ? this.backTo : this.scr; this.barnSel = this.g.flair.equipped[this.barnTab]; this.show('barn'); break;
      case 'barn-tab': this.barnTab = arg as FlairKind; this.barnSel = this.g.flair.equipped[this.barnTab]; this.render('barn'); break;
      case 'barn-pick': this.barnSel = arg; this.render('barn'); break;
      case 'barn-buy': this.barnBuy(arg); break;
      case 'barn-equip': this.barnEquip(arg); break;
      case 'daily': this.show('daily'); break;
      case 'daily-play': this.playDaily(); break;
      case 'ad-daily': void this.adDailyTry(); break;
      case 'duel': this.openDuel(); break;
      case 'duel-city': if (this.duel && cityById(arg)) { this.duel.cityId = arg; this.render('duel'); } break;
      case 'duel-tool': if (this.duel && isToolId(arg)) { this.duel.tool = arg; this.render('duel'); } break;
      case 'duel-start': this.duelTurn(0); break;
      case 'duel-p2': this.duelTurn(1); break;
      case 'duel-rematch': this.duelRematch(); break;
      case 'duel-quit': this.duel = null; this.show('menu'); break;
    }
  }

  /** The menu's next-farm pill: the world map, with the farm's country picked. */
  private openMapAt(cityId: string): void {
    const c = cityById(cityId) || ROUTE[0];
    this.countrySel = c.country;
    this.worldSel = c.country;
    this.citySel = c.id;
    this.show('world');
  }

  private showCountryOf(cityId: string): void {
    const c = cityById(cityId) || ROUTE[0];
    this.countrySel = c.country;
    this.worldSel = c.country;
    this.citySel = c.id;
    this.show('country');
  }

  private firstCityToShow(code: CountryCode): string {
    if (this.g.run && cityById(this.g.run.cityId)?.country === code) return this.g.run.cityId;
    const list = countryOf(code).cities;
    for (const c of list) if (cityLock(this.g, c.id).open && !cityProgress(this.g, c.id).won) return c.id;
    for (let i = list.length - 1; i >= 0; i--) if (cityLock(this.g, list[i].id).open) return list[i].id;
    return list[0].id;
  }

  // ------------------------------------------------------------------ farm actions

  private farmHere(cityId: string): void {
    if (!cityLock(this.g, cityId).open) return;
    // 0.14: a town is never played again: its runaway is caught and working in the Pen
    if (cityProgress(this.g, cityId).won && !(this.g.run && this.g.run.cityId === cityId)) {
      this.toast(t('{name} is already caught.', { name: t(cropName(planFor(cityId).runaway)) }));
      return;
    }
    if (this.g.run && this.g.run.cityId === cityId) {
      this.show('farmhouse');
      return;
    }
    if (this.g.run) {
      const cur = cityById(this.g.run.cityId)!;
      this.openModal('confirm', `<h2 class="m-title">${t('Leave {farm}?', { farm: esc(cur.short) })}</h2>
        <p class="m-text">${t('Your jar, your tools and your upgrades come along.')}</p>
        <div class="m-row"><button type="button" class="st-btn" data-act="close">${t('Stay')}</button><button type="button" class="st-btn gold" data-act="leave-yes" data-arg="${cityId}">${t('Leave and start {farm}', { farm: esc(cityById(cityId)!.short) })}</button></div>`);
      return;
    }
    this.beginRun(cityId);
  }

  private leaveRunAndStart(cityId: string): void {
    const old = this.g.run;
    if (old) {
      // 0.14 (one jar): leaving a town takes its jar along
      this.g.wallet += Math.max(0, Math.round(this.farmCash()));
      this.g.run = null;
    }
    this.closeModal();
    this.beginRun(cityId);
  }

  /** The plan the engine plays: the city's plan with crops as tough as this run's build calls for, and (0.15) the
   *  bills set for the player's pace when the town started (they never change while it runs). */
  private farmPlan(run: RunInfo): CityPlan {
    const plan = planFor(run.cityId, run.scale ?? 1);
    return run.tough && run.tough !== 1 ? { ...plan, hp: plan.hp * run.tough } : plan;
  }

  /** A town's plan as this player gets it: the running town's as it started, any other as it would start now. */
  private planOf(cityId: string): CityPlan {
    const run = this.g.run;
    return run && run.cityId === cityId ? this.farmPlan(run) : planFor(cityId, this.paceScale());
  }

  /** 0.15 (Navid, 15 Nov: bills "based on their own earning"): the bill scale for a town started now, from the
   *  player's pace (1 until they have days behind them). */
  private paceScale(): number {
    return paceMul(this.g.pace);
  }

  private beginRun(cityId: string): void {
    const tools = this.g.tools.owned.map(id => toolStats(this.g.tools, id));
    // crops are tougher for a build ahead of the route and softer for one behind it (set once, when the farm starts)
    // (by the highest track levels the player has had, so a reset just before a farm can't soften its crops)
    const tough = toughnessFor(routeIndex(cityId), bestPower(this.peakLevels(), tools, []));
    const p = (this.g.cities[cityId] ||= { ...cityProgress(this.g, cityId) });
    // 0.14, one jar (Navid, 15 Nov): the savings go into the town's jar and pay its bills; what is left after the big
    // bill comes back out as savings for the next town
    const jar = Math.max(0, Math.round(this.g.wallet));
    const run: RunInfo = { cityId, startCash: jar, startedAt: Date.now(), bestDay: 0, mark: 0, spent: 0, tough, scale: this.paceScale() };
    const plan = this.farmPlan(run);
    const ok = engine().beginCity({ cityId, country: plan.country, cash: jar, shed: this.g.workshop.levels, plan, tools });
    if (!ok) return;
    this.g.wallet = 0;
    this.g.run = run;
    this.applyRepair();
    p.plays++;
    this.citySel = cityId;
    this.fhTab = 'tools';
    this.saveNow();
    this.show('farmhouse');
  }

  /** Sundown → the next day at once (Navid, 4 Nov). On a bill night the bill is paid first; its chest opens over
   *  Sundown and picking the perk starts the day. The field music plays on; the rooster crows at dawn. */
  private nextDay(): void {
    if (!this.g.run) return;
    const e = engine();
    const b = e.bill();
    if (b.tonight) {
      if (!b.canPay || b.bossBlock) return void this.show('farmhouse');
      this.afterChest = 'day';
      e.payBill();
      this.save();
      if (!this.g.run || this.scr === 'won' || this.scr === 'lost') {
        this.afterChest = '';
        return;
      }
      if (e.state().pendingPerks) return;
      this.afterChest = '';
    }
    this.startDay();
  }

  private startDay(): void {
    if (!this.g.run) return;
    const e = engine();
    if (e.state().pendingPerks) return;
    // 0.14: a tax or a repair may come up this morning (its card's button starts the day)
    if (this.rollSurprise()) return;
    if (!this.g.seen.start) {
      this.g.seen.start = true;
      this.coach.cancel();
    }
    const paidNow = e.state().billsPaid;
    this.show('farm');
    if (!e.startDay()) this.show('farmhouse');
    else if (this.g.run.stageSeen !== paidNow) {
      this.g.run.stageSeen = paidNow;
      this.save();
    }
  }

  // ------------------------------------------------------------------ the Pen (0.14)

  /** A town's big bill is paid: its runaway goes to work in the Pen. */
  private catchRunaway(cityId: string): void {
    const type = planFor(cityId).runaway;
    if (!type) return;
    const pen = (this.g.pen ||= newPen());
    addWorker(pen, type);
  }

  /** Where the Pen's back button goes. */
  private penBack: Screen = 'menu';

  /** An average day at the farthest town reached: the Pen counts its money in it. */
  private penDay(): number {
    return avgDay(routeIndex(frontierCity(this.g)), 3);
  }

  private openPen(): void {
    if (!this.modal.hidden) this.closeModal();
    if (this.scr !== 'pen') this.penBack = this.scr === 'won' || this.scr === 'lost' ? 'world' : this.scr;
    this.show('pen');
  }

  /** Collects the Pen into the jar (the town's when one is being played, else savings); an ad doubles it. */
  private async collectPen(double: boolean): Promise<void> {
    const pen = this.g.pen;
    if (!pen || this.busy) return;
    const now = Date.now();
    let amt = penStored(pen, now, this.penDay(), this.g.cropCuts);
    if (amt <= 0) return;
    if (double) {
      this.busy = true;
      const ok = await watch(this.g, 'pen');
      this.busy = false;
      if (!ok) return;
      amt = penStored(pen, Date.now(), this.penDay(), this.g.cropCuts) * 2;
    }
    collectPen(pen, Date.now(), this.penDay(), this.g.cropCuts);
    if (this.g.run) {
      try {
        engine().addCash(amt);
      } catch {
        this.g.wallet += amt;
      }
    } else this.g.wallet += amt;
    this.saveNow();
    try {
      engine().uiSound?.('buy');
    } catch {
      /* engine not ready */
    }
    void hapticImpact('medium');
    this.toast(t('+{amt} from the Pen', { amt: money(amt) }));
    if (!this.modal.hidden && this.modal.dataset.kind === 'pen-back') this.closeModal();
    if (this.scr === 'pen') this.render('pen');
    else this.refresh();
  }

  private penPop = '';

  /** The Pen: what it holds, the collect buttons, and every runaway (caught ones at work, the rest still out there). */
  private penHtml(): string {
    const pen = (this.g.pen ||= newPen());
    const now = Date.now();
    const day = this.penDay();
    const held = penStored(pen, now, day, this.g.cropCuts);
    const fill = penFill(pen, now);
    const rate = penRate(pen, day, this.g.cropCuts);
    const caught = workerCount(pen);
    const cards = ROUTE.map(c => {
      const type = planFor(c.id).runaway;
      const w = pen.workers[type];
      if (!w)
        return `<div class="pen-cell out" aria-label="${esc(t('Still out there'))}"><span class="pen-spr">${spriteImg(type, 54)}</span><b>?</b><small>${esc(c.short)}</small></div>`;
      // 0.15 (Navid): a worker's level is its vegetable's level, raised by cutting that vegetable in the field
      const cuts = (this.g.cropCuts || {})[type] || 0;
      const lv = workerLevel(type, this.g.cropCuts);
      const hour = Math.round(workerRateOf(lv, day));
      const bar = lv >= CROP_LEVEL_MAX
        ? `<span class="pen-max">${t('Top level')}</span>`
        : `<span class="pen-next" aria-label="${t('Cut more to level {n}', { n: lv + 1 })}"><i style="width: ${(cropLevelProgress(cuts) * 100).toFixed(0)}%"></i></span>`;
      return `<div class="pen-cell${this.penPop === type ? ' pop' : ''}"><i class="pen-lv">${lv}</i><span class="pen-spr work">${spriteImg(type, 54, cropName(type))}</span>
        <b>${esc(t(cropName(type)))}</b><small>${t('{amt}/h', { amt: money(hour) })}</small>${bar}</div>`;
    }).join('');
    this.penPop = '';
    const canDouble = held > 0 && canOffer(this.g, 'pen');
    return `<div class="pen-wrap">
      <div class="pen-top"><button type="button" class="st-btn st-sq" data-act="pen-back" aria-label="${t('Back')}">${ICON.back()}</button>
        <h2>${t('The Pen')}</h2><span class="tr-chip">${ICON.coin(18)}<span>${money(this.wallet())}</span></span>
        <span class="pen-count">${t('{n} of {m} caught', { n: caught, m: ROUTE.length })}</span></div>
      <div class="pen-body">
        <div class="pen-take">
          <span class="pen-held money">${money(held)}</span>
          <span class="pen-bar" aria-label="${Math.round(fill * 100)}%"><i style="width: ${(fill * 100).toFixed(1)}%"></i></span>
          <span class="pen-rate">${caught ? t('{amt} an hour · full after {h} hours', { amt: money(Math.round(rate)), h: PEN_CAP_HOURS }) : t('Catch a runaway and it works here.')}</span>
          <button type="button" class="st-btn gold btn-md${held > 0 ? '' : ' off'}" data-act="pen-collect"${held > 0 ? '' : ' disabled'}>${t('Collect')}</button>
          ${canDouble ? `<button type="button" class="st-btn blue btn-md ad-btn" data-act="pen-double">${ICON.play()}<span>${t('Double it: +{amt}', { amt: money(held) })}</span></button>` : ''}
        </div>
        <div class="pen-grid">${cards}</div>
      </div></div>`;
  }

  /** The Pen holds something worth collecting (the menu sign's badge). */
  private penReady(): boolean {
    const pen = this.g.pen;
    return !!pen && workerCount(pen) > 0 && penFill(pen, Date.now()) >= 0.15;
  }

  /** Coming back to the game: what the Pen earned meanwhile, once a session, when it is worth a look. */
  private penShown = false;
  private penWelcome(): void {
    if (this.penShown || !this.modal.hidden || this.intro) return;
    const pen = this.g.pen;
    if (!pen || !workerCount(pen)) return;
    const held = penStored(pen, Date.now(), this.penDay(), this.g.cropCuts);
    if (held <= 0 || penFill(pen, Date.now()) < 0.15) return;
    this.penShown = true;
    const canDouble = canOffer(this.g, 'pen');
    this.openModal('pen-back', `<h2 class="m-title">${t('The Pen')}</h2>
      <p class="m-text">${t('Your runaways earned this while you were away.')}</p>
      <b class="pen-held money">${money(held)}</b>
      <div class="m-row"><button type="button" class="st-btn gold btn-md flex1" data-act="pen-collect">${t('Collect')}</button>
        ${canDouble ? `<button type="button" class="st-btn blue btn-md flex1 ad-btn" data-act="pen-double">${ICON.play()}<span>${t('Double it: +{amt}', { amt: money(held) })}</span></button>` : ''}</div>`, 400);
  }

  // ------------------------------------------------------------------ surprises (0.14)

  /** How many crops a field grows while a repair waits (0.7: about one row in three closed). */
  private static readonly REPAIR_MUL = 0.7;

  /** The engine grows fewer crops while a repair waits to be paid. */
  private applyRepair(): void {
    const run = this.g.run;
    (window as unknown as { __DBD_REPAIR?: number }).__DBD_REPAIR = run && run.repair ? GameApp.REPAIR_MUL : 1;
    try {
      engine().setShed(this.g.workshop.levels);
    } catch {
      /* engine not ready */
    }
  }

  /**
   * Navid, 15 Nov: "let's show these tax and repairs suddenly come up so player should keep some cash always... you can
   * only see these bills ahead of time not tax and sudden repairs". From the second town on, a morning may bring a tax
   * (taken at once from the jar; what the jar can't cover the collector takes from the day's harvest, plus 20%) or a
   * repair (fewer crops until it is paid, from the farmhouse). Seeded by the run and the day, so a reload can't dodge
   * one. Returns true when a card is shown (its button starts the day).
   */
  private rollSurprise(): boolean {
    const run = this.g.run;
    if (!run || (window as unknown as { __DBD_NO_SURPRISES?: boolean }).__DBD_NO_SURPRISES) return false;
    const plan = this.farmPlan(run);
    if (!plan.tax && !plan.repair) return false;
    const e = engine();
    const st = e.state();
    if (st.day <= 1 || run.surpriseDay === st.day) return false;
    run.surpriseDay = st.day;
    let h = 2166136261;
    for (const ch of `${run.cityId}:${run.startedAt}:${st.day}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    const r = ((h >>> 0) % 10000) / 10000;
    const forced = (window as unknown as { __DBD_SURPRISE?: string }).__DBD_SURPRISE;
    const kind = forced || (r < 0.07 ? 'tax' : r < 0.13 && !run.repair ? 'repair' : '');
    this.save();
    if (kind === 'tax' && plan.tax > 0) {
      // the tree's Tax lawyer (m10, 0.15) halves it
      const tax = (this.g.tree || {}).m10 > 0 ? niceMoney(plan.tax / 2) : plan.tax;
      const cash = Math.max(0, Math.floor(st.cash));
      const paid = Math.min(cash, tax);
      if (paid > 0) e.spendCash(paid);
      const owed = tax - paid;
      if (owed > 0) run.debt = (run.debt || 0) + Math.round(owed * 1.2);
      this.saveNow();
      // 0.16 (Navid, 19 Nov: "i just saw a tax day, this as well as repair also should be explained. why? what
      // happened?"): the card says who took it, from where, and why the jar should keep some cash
      this.surpriseCard(
        'tax',
        t('Tax day!'),
        t("The town's tax collector came by and took this from your jar.") +
          (owed > 0 ? ' ' + t('Your jar was short, so he takes {amt} from today\'s harvest.', { amt: money(Math.round(owed * 1.2)) }) : ''),
        `<b class="sp-amt money">-${money(tax)}</b>`,
        `<button type="button" class="st-btn gold btn-md flex1" data-act="surprise-ok">${t('Start')}${ICON.next()}</button>`,
      );
      return true;
    }
    if (kind === 'repair' && plan.repair > 0 && !run.repair) {
      const whats = ['The fence broke', 'The well cracked', 'The barn roof leaks', 'The tractor broke down'];
      const what = whats[Math.floor(r * 1000) % whats.length];
      run.repair = { what, amt: plan.repair };
      this.applyRepair();
      this.saveNow();
      const can = this.wallet() >= plan.repair;
      this.surpriseCard(
        'repair',
        t(what),
        t('Until you fix it, {p}% fewer crops grow. Fix it now, or later from the farmhouse.', { p: Math.round((1 - GameApp.REPAIR_MUL) * 100) }),
        `<b class="sp-amt money">${money(plan.repair)}</b>`,
        `<button type="button" class="st-btn btn-md flex1" data-act="surprise-ok">${t('Later')}</button>` +
          `<button type="button" class="st-btn gold btn-md flex1${can ? '' : ' off'}" data-act="repair-now"${can ? '' : ' disabled'}>${ICON.wrench(24)}<span>${t('Fix {amt}', { amt: money(plan.repair) })}</span></button>`,
      );
      return true;
    }
    return false;
  }

  /** The card for a surprise: what came up, what it costs, and the way on. */
  private surpriseCard(kind: string, title: string, text: string, amt: string, buttons: string): void {
    const icon = kind === 'tax' ? ICON.notice(54) : ICON.wrench(54);
    // (0.16: and why it came, behind an (i) (Navid, 19 Nov: "make the 'taxes and repairs come by suprises, from...' into
    // a (i) so it doesn't show everytime and also doesn't fill the whole screen"): surprises are not shown ahead, so the
    // jar should keep some cash)
    this.openModal('surprise', `<div class="sp-card ${kind}"><span class="sp-icon">${icon}</span><h2 class="m-title">${esc(title)}<button type="button" class="up-info sp-i" data-act="sp-why" aria-label="${t('Why?')}" aria-expanded="false"><i class="info-i">i</i></button></h2>${amt}
      ${text ? `<p class="m-text">${esc(text)}</p>` : ''}<p class="sp-why" hidden>${ICON.notice(16)}<span>${esc(t('Taxes and repairs come by surprise, from the second town on. Keep some cash in your jar for them.'))}</span></p><div class="m-row">${buttons}</div></div>`, 380);
    try {
      navigator.vibrate?.([30, 50, 30]);
    } catch {
      /* no vibration */
    }
  }

  /** The surprise card's (i): why taxes and repairs come, shown or hidden again. */
  private toggleWhy(): void {
    const why = this.modal.querySelector<HTMLElement>('.sp-why');
    if (!why) return;
    why.hidden = !why.hidden;
    this.modal.querySelector('[data-act="sp-why"]')?.setAttribute('aria-expanded', String(!why.hidden));
  }

  /** Pays the waiting repair from the jar (the farmhouse's Fix button, or the surprise card's). */
  private payRepair(): boolean {
    const run = this.g.run;
    if (!run || !run.repair) return false;
    if (!this.spend(run.repair.amt)) {
      this.toast(t('Not enough money.'));
      return false;
    }
    run.repair = null;
    this.applyRepair();
    this.saveNow();
    try {
      engine().uiSound?.('buy');
    } catch {
      /* engine not ready */
    }
    return true;
  }

  // ------------------------------------------------------------------ the coach: showing, not telling

  /** Tests can turn the coach off (window.__DBD_NO_COACH). */
  private get coachOn(): boolean {
    return !(window as unknown as { __DBD_NO_COACH?: boolean }).__DBD_NO_COACH;
  }

  /** Play on the menu: a new player first watches the intro, then lands on the first farm. After that, Play goes
   *  straight to the day card of the farm in progress, or starts the next farm on the route (Navid, 3 Nov: four taps
   *  from Play to the field was too many). The world map is the next-farm pill. */
  private play(): void {
    // a new player starts on Level 0, the practice farm (Navid, 3 Nov); the intro film is in Settings
    const fresh = this.coachOn && !this.g.seen.intro && !this.g.seen.practice && !this.g.run && this.g.totals.days === 0 && totalStars(this.g) === 0;
    // 0.16 (Navid, 18 Nov: "what is the story of the game at all"): the story first, then the practice farm
    if (fresh && !this.g.seen.story) {
      this.g.seen.story = true;
      this.saveNow();
      return void playStory().then(() => this.playPractice(false));
    }
    if (fresh) return void this.playPractice(false);
    if (this.g.run) {
      this.citySel = this.g.run.cityId;
      this.show('farmhouse');
      return;
    }
    const next = nextCity(this.g);
    if (next && cityLock(this.g, next).open) {
      this.citySel = next;
      this.farmHere(next);
    } else this.show('world');
  }

  /** Level 0, the practice farm (v0.11.1): the first farm's carrots with the daylight clock stopped. Each step waits
   *  for the player (cut, the jar, a chain); then the sun runs and the day ends on the player's first real farm. */
  private async playPractice(replay: boolean): Promise<void> {
    const e = engine();
    if (this.side || this.intro || e.state().mode !== 'idle') return this.show('world');
    const seen = this.g.seen;
    seen.practice = true;
    seen.cut = true;
    this.saveNow();
    const snap = e.snapshot();
    const sound = e.state().sound;
    const cityId = ROUTE[0].id;
    const plan = planFor(cityId);
    const tool = toolStats(newTools(), 'sickle');
    e.setSaving(false);
    e.setFieldSeed(20261103);
    e.setSkills([]);
    this.clearTreeFx();
    e.setTool(tool);
    // 0.15: a bare field is thin now (3 crops, one every 2 s); practice has a well-fed field, so six carrots and a
    // chain of six come quickly
    // (0.15.1: and its crops ripen quickly, as all did before)
    // 0.16: practice's carrots take 2 cuts (PRACTICE_CROP_HP)
    const cropHp = { ...plan.cropHp, [plan.runaway || 'carrot']: PRACTICE_CROP_HP / Math.max(0.01, plan.hp) };
    if (!e.beginCity({ cityId, country: plan.country, cash: 0, shed: { ...emptyLevels(), soil: 16 }, plan: { ...plan, grow: GROW_FAST, spawn: PRACTICE_SPAWN, cropHp }, tools: [tool] })) {
      this.restoreFarm(snap, sound);
      return this.show('world');
    }
    this.intro = { snap, sound, ending: false, down: false, at: null, practice: true, replay };
    this.show('farm');
    if (!e.startDay()) {
      this.finishIntro();
      return;
    }
    e.setClock(false);
    await this.coach.practice({
      jar: () => document.getElementById('dbdBank'),
      bill: () => document.querySelector('#dbdBank .hb-bill'),
      chain: () => document.getElementById('dbdChain'),
      sun: () => document.querySelector('#dbdHud .hb-dialbg'),
      combo: () => {
        try {
          return engine().hud().combo;
        } catch {
          return 0;
        }
      },
      onSun: () => {
        e.setClock(true);
        e.setDayLeft(8);
      },
      onSkip: () => this.endPractice(),
    });
  }

  /** Skip practice (or Back to menu on the pause card): the practice day ends now. */
  private endPractice(): void {
    const it = this.intro;
    if (!it || !it.practice || it.ending) return;
    it.ending = true;
    this.coach.cancel();
    const e = engine();
    if (e.state().mode === 'day') {
      e.setPaused(false);
      if (e.endDayNow()) return;
    }
    this.finishIntro();
  }

  /** The intro (Navid, 30 Oct): the last seconds of a boss farm, played by the ghost finger. The boss falls to the
   * scythe's whirlwind (its power, v0.12), the deed is paid, and the player lands on their own first farm. Since v0.11.1 new players start
   * on the practice farm; the intro plays from Settings. */
  private async playIntro(replay = false): Promise<void> {
    const e = engine();
    if (this.side || this.intro || e.state().mode !== 'idle') return this.show('world');
    this.g.seen.intro = true;
    this.saveNow();
    const snap = e.snapshot();
    const sound = e.state().sound;
    const cityId = 'ca_kelowna';
    const plan = planFor(cityId);
    const levels = { scythe: 16, swing: 6, hands: 10, days: 2, soil: 16, market: 2, clover: 6 };
    const tool = toolStats({ owned: ['scythe'], equipped: 'scythe', mods: { 'scythe.charge': 1 } }, 'scythe');
    e.setSaving(false);
    e.setFieldSeed(20261030);
    e.setSkills([]);
    this.clearTreeFx();
    e.setTool(tool);
    if (!e.beginCity({ cityId, country: plan.country, cash: 0, shed: levels, plan: { ...plan, grow: GROW_FAST, spawn: PRACTICE_SPAWN }, tools: [tool] })) {
      this.restoreFarm(snap, sound);
      return this.show('world');
    }
    this.intro = { snap, sound, ending: false, down: false, at: null, replay };
    $('dbdHud').classList.add('intro');
    this.show('farm');
    if (!e.startDay()) {
      this.finishIntro();
      return;
    }
    const co = this.coach;
    const it = this.intro;
    await co.run(async () => {
      co.cinema(true, () => this.endIntro());
      const boss = () => peek()?.crops.find(c => c.boss && !c.dead) || null;
      await co.until(() => !!boss(), 3000);
      e.introFinale(5, 10.5);
      const at = (): Pt | null => {
        const b = boss();
        if (!b) return null;
        it.at = co.cropAt(b);
        return it.at;
      };
      const start = at() || { x: innerWidth / 2, y: innerHeight * 0.6 };
      co.showHand(0, { x: start.x - 170, y: start.y + 100 });
      await co.wait(500);
      await co.glide(0, at, 650);
      co.press(0);
      const t0 = performance.now();
      const chase = (ms: number) =>
        co.tween(
          ms,
          () => {
            const q = at();
            if (!q) return;
            const a = (performance.now() - t0) / 240;
            co.showHand(0, { x: q.x + Math.cos(a) * 18, y: q.y + Math.sin(a * 1.3) * 12 });
          },
          t => t,
        );
      await chase(1700);
      // the finisher (v0.12): the power meter is full, and the scythe's whirlwind follows the finger onto the boss
      if (!it.down) e.introPower();
      const t1 = performance.now();
      while (!it.down && performance.now() - t1 < 5000) await chase(250);
      co.lift(0);
      co.hideHand(0);
      if (it.down) {
        await co.explode(it.at || start);
        await co.deed();
      }
    });
    this.endIntro();
  }

  /** Skip, or the finale is over: end the side day (its idle event finishes the intro). */
  private endIntro(): void {
    const it = this.intro;
    if (!it || it.ending) return;
    it.ending = true;
    this.coach.cancel();
    const e = engine();
    if (e.state().mode === 'day' && e.endDayNow()) return;
    this.finishIntro();
  }

  /** Back to the real game: the player's first farm, with a finger on its Start button. */
  private finishIntro(): void {
    const it = this.intro;
    if (!it) return;
    this.intro = null;
    this.coach.cancel();
    $('dbdHud').classList.remove('intro');
    let soundNow = it.sound;
    try {
      soundNow = engine().state().sound;
    } catch {
      /* keep the old setting */
    }
    this.restoreFarm(it.snap, soundNow);
    const first = ROUTE[0].id;
    if (it.replay) this.show('menu');
    else if (!this.g.run && cityLock(this.g, first).open) {
      // (0.16: the town's goals card opens on it, so no toast over it)
      this.beginRun(first);
    } else this.show('world');
  }

  /** 0.16: a lesson that goes on on another screen (the Skills lesson opens the tree). */
  private lesson = '';

  /** 0.16 (Navid, 19 Nov: "when can we see if we keep 22$ we can win another star?"; his pick: "Skill star + show
   *  goals"): a town's three stars, on the first morning of every run there, before its tips. Returns true when the
   *  card opened. */
  private showGoals(): boolean {
    const run = this.g.run;
    if (!run || run.goals || !this.coachOn || this.coach.busy || !this.modal.hidden) return false;
    let day = 0;
    try {
      day = engine().state().day;
    } catch {
      return false;
    }
    if (day !== 1) return false;
    run.goals = true;
    this.save();
    this.openGoals();
    return true;
  }

  /** The three stars of the running town (the stars on the day card open it again). The first-try star is crossed out
   *  once the bank has taken the town. */
  private openGoals(): void {
    const run = this.g.run;
    if (!run) return;
    const plan = this.farmPlan(run);
    const ct = cityById(run.cityId)!;
    const p = this.g.cities[run.cityId];
    const missed = !!(p && p.fails);
    const goal = (cls: string, icon: string, label: string, i: number) =>
      `<div class="gl-goal${cls}" style="animation-delay: ${(0.12 + 0.15 * i).toFixed(2)}s">${ICON.star(false, 30)}<span class="gl-ic">${icon}</span><b>${label}</b></div>`;
    this.openModal('goals', `<div class="gl-head"><span class="eyebrow">${esc(ct.short.toUpperCase())}</span><h2 class="m-title">${t('Win 3 stars here')}</h2></div>
      <div class="gl-goals">${goal('', spriteImg(plan.runaway, 42, ''), t('Catch the runaway'), 0)}${goal('', ICON.coin(38), t('A big day: {amt}', { amt: money(plan.bigDay) }), 1)}${goal(missed ? ' miss' : '', '<i class="gl-1st">1</i>', t('Catch it on the first try'), 2)}</div>
      <button type="button" class="st-btn gold btn-md" data-act="goals-ok">${t("Let's go!")}</button>`, 440);
  }

  /** The farmhouse's lessons (0.16; Navid, 18 Nov: "why on earth you didn't talk about bills ... what is a chest or
   *  perk?"; "upgrading tool also should be one of the toturials"), each once, each a few tips on the thing itself:
   *  the first farm's day card (its bill, its days, its runaway, then Start), then, when the player can pay for them,
   *  the Power booster in Tools (the power bar is a tool upgrade now) and a first skill, then the Perks and the Pen. */
  private pointAtStart(): void {
    if (this.coach.busy || !this.coachOn || !this.g.run || this.scr !== 'farmhouse' || !this.modal.hidden) return;
    const seen = this.g.seen;
    const fh = this.sections.farmhouse;
    const q = (sel: string) => () => fh.querySelector(sel);
    const e = engine();
    const st = e.state();
    const run = this.g.run;
    const plan = this.farmPlan(run);
    const steps: Array<TipOpts | (() => Promise<void>)> = [];
    const mark = (key: string) => {
      seen[key] = true;
      this.save();
    };
    if (!seen.start) {
      // the first farm: its bill, its days and its runaway, then Start
      if (!seen.tour && routeIndex(run.cityId) === 0 && st.day === 1) {
        mark('tour');
        const due = e.bill();
        steps.push(
          {
            el: q('.dc-bill'),
            arthur: true,
            title: t('Your first bill: {amt}', { amt: money(due.amt) }),
            text: t('Due on day {day}. At dusk that day, your jar pays it.', { day: due.dueDay }),
          },
          { el: q('.dc-dots'), title: t('{n} days in this town', { n: plan.totalDays }), text: t('Each dot is a day. The red dots are bill days.') },
          { el: q('.dc-rw'), icon: cropIcon(plan.runaway), title: t("This town's runaway"), text: t('Pay the last bill, the big one, and you catch it.') },
        );
      }
      steps.push({
        el: q('[data-act="start"]'),
        mode: 'press',
        hand: 'tap',
        title: t('Start the day!'),
        text: t('Cut all you can before the sun sets.'),
        done: () => this.scr !== 'farmhouse' || !this.modal.hidden,
      });
      void this.coach.tour(steps);
      return;
    }
    // the power bar is a tool upgrade (0.16): when the Power booster is within reach, Tools, then its button
    const boost = modCost(this.g.tools.equipped, 'charge', 0);
    if (!seen.lessonTools && !anyPower(this.g.tools) && boost != null && this.wallet() >= boost) {
      mark('lessonTools');
      const buy = () => this.modal.querySelector('.mod-row[data-mod="charge"] [data-act="buy-mod"]');
      void this.coach.tour([
        {
          el: q('[data-act="panel"][data-arg="tools"]'),
          mode: 'press',
          hand: 'tap',
          title: t('Unlock your power bar!'),
          text: t('You have enough for the Power booster. Open Tools.'),
          done: () => !!buy(),
        },
        {
          el: buy,
          mode: 'press',
          hand: 'tap',
          title: t('Buy the Power booster'),
          text: t('It gives your sickle a power bar.'),
          done: () => hasPower(this.g.tools),
        },
        {
          el: () => this.modal.querySelector('.mod-row[data-mod="charge"]'),
          icon: '<span class="ct-emo">⚡</span>',
          title: t('Your power bar is unlocked!'),
          text: t('Cut crops to fill it. When it is full, your sickle cleaves everything around it.'),
        },
      ]);
      return;
    }
    // a first skill, when one is within reach: Skills (the tree goes on with treeLesson)
    if (!seen.lessonSkill && this.upgradesReady() > 0) {
      mark('lessonSkill');
      this.lesson = 'skill';
      void this.coach.tour([
        {
          el: q('[data-act="tree"]'),
          mode: 'press',
          hand: 'tap',
          title: t('You can buy a skill!'),
          text: t('Skills make you stronger, in every town. Open Skills.'),
          done: () => this.scr !== 'farmhouse',
        },
      ]);
      return;
    }
    // after the first chest: where the farm's perks are
    if (!seen.lessonPerks && seen.chest && st.perks.length) {
      mark('lessonPerks');
      void this.coach.tour([{ el: q('[data-act="panel"][data-arg="perks"]'), title: t('Your perks are here'), text: t('They help you on this farm until you catch its runaway.') }]);
      return;
    }
    // after the first catch: the Pen
    if (!seen.lessonPen && workerCount(this.g.pen) > 0) {
      mark('lessonPen');
      void this.coach.tour([{ el: q('[data-act="pen"]'), title: t('Your runaways work in the Pen'), text: t('They earn coins, even while the game is closed. Collect them here.') }]);
    }
  }

  /** The Skills lesson on the tree (0.16): a skill ready to buy, then its Buy button. */
  private treeLesson(): void {
    if (this.lesson !== 'skill' || !this.coachOn) return;
    this.lesson = '';
    const tr = this.sections.tree;
    let id = '';
    let before = 0;
    void this.coach.tour([
      {
        el: () => tr.querySelector('.tr-row.ready'),
        mode: 'press',
        hand: 'tap',
        title: t('Pick a skill'),
        text: t('These are the ones you can buy now.'),
        done: () => {
          const b = tr.querySelector<HTMLElement>('.tr-buy');
          if (!b) return false;
          id = b.dataset.arg || '';
          before = id ? treeLevelOf(this.g, id) : 0;
          return true;
        },
      },
      {
        el: () => tr.querySelector('.tr-buy'),
        mode: 'press',
        hand: 'tap',
        title: t('Buy it'),
        text: t('The coins come out of your jar.'),
        done: () => !!id && treeLevelOf(this.g, id) > before,
      },
      { el: () => tr.querySelector('.tr-card'), icon: '<span class="ct-emo">⭐</span>', title: t('Yours, for good!'), text: t('Skills stay with you in every town.') },
    ]);
  }

  /** The lesson at the start of a day on a real farm: cutting, on a new player's first day (the power meter has a
   * card instead, v0.12). Returns whether it started. */
  private dayLessons(): boolean {
    if (!this.coachOn) return false;
    const seen = this.g.seen;
    const st = engine().state();
    if (!seen.cut && this.g.totals.days === 0) {
      seen.cut = true;
      this.save();
      this.momentCool = performance.now() + 16000;
      void this.coach.cutLesson(() => document.getElementById('dbdBank'));
      return true;
    }
    seen.cut = true;
    void st;
    return false;
  }

  /** First sights on the field (v0.11.1): the field holds still and a card says what the new thing is, until the
   *  player taps (Navid, 3 Nov: no more dimmed screen and words that vanish in three seconds). Once each.
   *  0.16 (Navid, 18 Nov: "it is not showing which menu you are talking about ... you just showed a message there!"):
   *  each one is a tip on the thing itself: the field dims around it, a ring pulses on it and an arrow points at it. */
  private watchField(now: number): void {
    if (this.scr !== 'farm' || this.side || this.intro || this.coach.busy || this.carding || now < this.momentCool || !this.coachOn) return;
    const p = peek();
    if (!p || p.mode !== 'day' || p.time < 2 || engine().state().paused) return;
    const seen = this.g.seen;
    const co = this.coach;
    const tip = (key: string, o: TipOpts) => {
      seen[key] = true;
      this.save();
      this.carding = true;
      void co
        .run(async () => {
          await co.tip({ mode: 'tap', ...o });
        })
        .then(() => {
          this.carding = false;
          this.momentCool = performance.now() + 4000;
        });
      return true;
    };
    const spotAt = (x: number, y: number) => () => co.toScreen(x, y);
    const liveOne = (pred: (c: FieldPeek['crops'][number]) => boolean) => (p.crops || []).find(c => !c.dead && c.age > 0.4 && pred(c));
    const cropSpot = (c: FieldPeek['crops'][number]) => () => co.cropAt(c);
    const st = engine().state();
    const boss = liveOne(c => c.boss);
    if (!seen.mBoss2 && st.boss && st.boss.onField && boss)
      return void tip('mBoss2', { at: cropSpot(boss), r: 90, icon: '<span class="ct-emo">👑</span>', title: t('{boss} is here', { boss: t(st.boss.name) }), text: t('It eats your best crops. Hit it right after it eats, when its armour is off. The big bill waits until it is down.') });
    if (!seen.mBomb && p.bombAt)
      return void tip('mBomb', { at: spotAt(p.bombAt.x, p.bombAt.y), r: 50, icon: '<span class="ct-emo">💣</span>', title: t('Bomb seeds'), text: t("Don't cut them! Swipe around them, or you lose cash and your sickle gets dizzy.") });
    if (!seen.mEncase && p.encasedAt) {
      const k = p.encaseKind;
      return void tip('mEncase', { at: spotAt(p.encasedAt.x, p.encasedAt.y), r: 56, icon: `<span class="ct-emo">${k === 'ice' ? '🧊' : k === 'sand' ? '🏜️' : '🟫'}</span>`, title: k === 'ice' ? t('Frozen solid') : k === 'sand' ? t('Buried in sand') : t('Stuck in mud'), text: t("Two hits free the crop. The boss's storm pays no bonus.") });
    }
    const radish = liveOne(c => c.type === 'radish');
    if (!seen.mRadish && radish)
      return void tip('mRadish', { at: cropSpot(radish), r: 56, icon: cropIcon('radish'), title: t('Runaway Radish'), text: t('It runs from your sickle. Corner it against the edge.') });
    const lucky = (p.lucky || [])[0];
    if (!seen.mGolden && lucky)
      return void tip('mGolden', { at: spotAt(lucky.x, lucky.y), r: 56, icon: cropIcon('golden'), title: t('A golden crop'), text: t('Worth far more than the others. Cut it before it goes back into the ground.') });
    const tr = this.g.tree || {};
    const treaty = st.perks.includes('treaty') || tr.a1 > 0 || tr.a14 > 0;
    if (!seen.mGoat && !treaty && p.goat)
      return void tip('mGoat', { at: spotAt(p.goat.x, p.goat.y - 24), r: 62, icon: '<span class="ct-emo">🐐</span>', title: t('The goat'), text: t("Don't touch it! A bumped goat gets angry and costs you daylight.") });
    if (!seen.mGoatPet && treaty && p.goat)
      return void tip('mGoatPet', { at: spotAt(p.goat.x, p.goat.y - 24), r: 62, icon: '<span class="ct-emo">🐐</span>', title: t('A friendly goat'), text: t('Touch it with your sickle: it tips you cash.') });
    const crow = (p.crows || [])[0];
    if (!seen.mThief && crow)
      return void tip('mThief', { at: spotAt(crow.x, crow.y), r: 50, icon: '<span class="ct-emo">🐦</span>', title: t('A thief crow'), text: t('It steals coins from your jar. Swipe it before it flies off and you get them back.') });
    // 0.16 (Navid, 18 Nov: "i though it gives me 4 new vegetable. but instead it only gave me a dollar amount ... no
    // explanation of what they are!"): each kind of thing to grab has its own look and its own tip
    for (const f of p.props || []) {
      const kind = f.kind === 'fertilizer' || f.kind === 'egg' ? f.kind : 'clover';
      const key = kind === 'fertilizer' ? 'mFert' : kind === 'egg' ? 'mEgg' : 'mClover';
      if (seen[key]) continue;
      const words =
        kind === 'fertilizer'
          ? [t('A fertilizer bag'), t('Swipe it: 4 new crops sprout on the field.')]
          : kind === 'egg'
            ? [t('An egg'), t('Swipe it for coins.')]
            : [t('A clover treat'), t('Swipe it for coins. It calms the goat too.')];
      return void tip(key, { at: spotAt(f.x, f.y - 18), r: 46, icon: PROP_ICON[kind], title: words[0], text: words[1] });
    }
    // 0.16.1 (Navid, 19 Nov: "please also add the epxlantion for tutourail as well"): the day's event, once its card has
    // gone into the badge beside the jar
    const badge = document.getElementById('dbdBadge');
    const banner = document.getElementById('dbdBanner');
    if (!seen.mEvent && badge && !badge.hidden && badge.style.visibility !== 'hidden' && (!banner || banner.hidden))
      return void tip('mEvent', { el: () => document.getElementById('dbdBadge'), pad: 6, icon: `<span class="ct-emo">${esc(badge.textContent || '')}</span>`, title: t("Today's event"), text: t('Every day brings its own event. Tap here to read it again.') });
    if (!seen.mBolt && p.bolts > 0) return void tip('mBolt', { icon: '<span class="ct-emo">⚡</span>', title: t('Lightning'), text: t('Your crits throw lightning at crops nearby.') });
    // the HUD: the chain bonus, the power bar, a harvest rush
    const h = engine().hud();
    const chainEl = () => document.getElementById('dbdChain');
    if (!seen.mChain && h.tiers.length > 1 && h.combo >= h.tiers[1].count)
      return void tip('mChain', { el: chainEl, pad: 6, icon: '<span class="ct-emo">🔗</span>', title: t('Chain bonus!'), text: t('Cut crops quickly, one after another: every crop in a long chain pays more.') });
    // 0.16: the power bar, the first day a tool has one (once for each tool, v0.12)
    const style = String(engine().stats().style || 'sickle') as ToolId;
    const pk = style === 'sickle' ? 'mPower' : 'mPower_' + style;
    if (!seen[pk] && h.powerOn !== false && h.rushT <= 0) {
      const what: Record<ToolId, string> = {
        sickle: t("Cut crops to fill it; a chain fills it faster. When it's full, your sickle cleaves everything around it."),
        scythe: t("Cut crops to fill it; a chain fills it faster. When it's full, a whirlwind follows your finger."),
        flame: t("Cut crops to fill it; a chain fills it faster. When it's full, a ring of fire sets the crops around you alight."),
        blaster: t("Cut crops to fill it; a chain fills it faster. When it's full, a storm of seeds hits crops all over the field."),
      };
      return void tip(pk, { el: () => document.getElementById('dbdRush'), pad: 6, icon: '<span class="ct-emo">⚡</span>', title: t('Your power bar'), text: what[style] || what.sickle });
    }
    if (!seen.mRush && h.rushT > 0)
      return void tip('mRush', { el: chainEl, pad: 6, icon: '<span class="ct-emo">⚡</span>', title: t('Harvest Rush!'), text: t('For a few seconds every crop pays 50% more and the field grows faster.') });
  }

  private payBill(): void {
    if (!this.g.run) return;
    engine().payBill();
    this.save();
    if (this.scr === 'farmhouse' && this.g.run) this.render('farmhouse');
  }

  private faceBank(): void {
    engine().foreclose();
  }

  /** A question on a card over a dimmed screen. */
  private confirmVeil(title: string, body: string, no: string, yes: string, onYes: () => void): void {
    document.querySelector('.dbd-veil')?.remove();
    const v = document.createElement('div');
    v.className = 'dbd-veil';
    v.setAttribute('role', 'alertdialog');
    v.setAttribute('aria-modal', 'true');
    v.innerHTML = `<div class="st-chip veil-card"><h3>${esc(title)}</h3><p>${esc(body)}</p>
      <div class="m-row"><button type="button" class="st-btn btn-md flex1" data-veil="no">${esc(no)}</button><button type="button" class="st-btn gold btn-md flex1" data-veil="yes">${esc(yes)}</button></div></div>`;
    v.addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-veil]');
      if (b?.dataset.veil === 'yes') {
        v.remove();
        onYes();
      } else if (b || e.target === v) v.remove();
    });
    document.body.append(v);
    v.querySelector<HTMLElement>('[data-veil="yes"]')?.focus();
  }

  /** A perk card: the first tap picks it out and asks to confirm, a second tap on it takes it (Navid, 4 Nov). */
  private tapPerk(id: string, btn?: HTMLElement): void {
    if (this.picking || btn?.classList.contains('taken')) return;
    if (this.perkSel === id) {
      this.perkSel = '';
      return this.pickPerk(id, btn);
    }
    this.perkSel = id;
    const box = this.modal.querySelector<HTMLElement>('.chest-box');
    box?.classList.add('has-sel');
    box?.querySelectorAll<HTMLElement>('.perk-card').forEach(c => {
      const on = c.dataset.arg === id;
      c.classList.toggle('sel', on);
      c.querySelector('.pk-ok')?.remove();
      if (on) c.insertAdjacentHTML('beforeend', `<span class="pk-ok">${ICON.check(16)}<span>${t('Take it')}</span></span>`);
    });
  }

  private clearPerkSel(): void {
    this.perkSel = '';
    const box = this.modal.querySelector<HTMLElement>('.chest-box');
    box?.classList.remove('has-sel');
    box?.querySelectorAll('.perk-card').forEach(c => {
      c.classList.remove('sel');
      c.querySelector('.pk-ok')?.remove();
    });
  }

  private picking = false;
  private pickPerk(id: string, btn?: HTMLElement): void {
    if (this.picking || btn?.classList.contains('taken')) return;
    const box = this.modal.querySelector<HTMLElement>('.chest-box');
    const done = () => {
      this.picking = false;
      const info = engine().perkInfo(id);
      const before = engine().pendingChest();
      const finished = engine().choosePerk(id);
      if (!finished) {
        // a diamond chest: the first of its two picks is in; that card stays lit and the others wait
        const after = engine().pendingChest();
        if (!box || !before || !after || (after.picks || 1) >= (before.picks || 1)) return;
        box.classList.remove('picked');
        box.classList.add('one-left');
        this.clearPerkSel();
        btn?.classList.add('taken');
        btn?.setAttribute('aria-disabled', 'true');
        const sub = box.querySelector('.chest-sub');
        if (sub) sub.textContent = t('Pick 1 more');
        return;
      }
      this.closeModal();
      if (info) this.toast(`${t(info.name)}: ${t(deviceText(info.line))}`);
      if (this.afterChest === 'day') {
        this.afterChest = '';
        return this.startDay();
      }
      this.render('farmhouse');
    };
    if (box && btn && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.picking = true;
      box.classList.add('open', 'picked');
      btn.classList.add('chosen');
      setTimeout(done, 420);
    } else done();
  }

  /** Pays for upgrades and tools: savings first, then the farm's cash above its mark. */
  private spend(cost: number): boolean {
    if (this.wallet() < cost) return false;
    const fromSavings = Math.min(this.g.wallet, cost);
    const rest = cost - fromSavings;
    if (rest > 0) {
      const run = this.g.run;
      if (!run || rest > spendableFarmCash(run, this.farmCash())) return false;
      // tonight's bill: a purchase that would leave too little for it asks first, on a card over a dimmed screen
      // (Navid, 3 Nov; 4 Nov: the toast was hidden under the panels)
      try {
        const b = engine().bill(), cash = this.farmCash();
        if (b.tonight && cash >= b.amt && cash - rest < b.amt && !this.billOk) {
          const { act, arg } = this.lastAct;
          this.confirmVeil(
            t("Tonight's bill"),
            t("That leaves {left}, and tonight's bill is {amt}.", { left: money(cash - rest), amt: money(b.amt) }),
            t('Keep my cash'),
            t('Buy anyway'),
            () => {
              this.billOk = true;
              try {
                const sel = `[data-act="${CSS.escape(act)}"]${arg ? `[data-arg="${CSS.escape(arg)}"]` : ''}`;
                this.root.querySelector<HTMLElement>(sel)?.click();
              } finally {
                this.billOk = false;
              }
            },
          );
          return false;
        }
      } catch {
        /* engine not ready */
      }
      if (!engine().spendCash(rest)) return false;
      run.spent += rest;
    }
    this.g.wallet -= fromSavings;
    return true;
  }

  private applyTool(): void {
    try {
      engine().setTool(toolStats(this.g.tools));
    } catch {
      /* engine not ready yet; start() applies it */
    }
  }

  private equip(id: string): void {
    const T = this.g.tools;
    if (!isToolId(id) || !T.owned.includes(id)) return;
    T.equipped = id;
    this.applyTool();
    this.saveNow();
    this.toast(t('{tool} in hand.', { tool: t(toolDef(id).name) }));
    this.refresh();
  }

  private buyTool(id: string): void {
    const T = this.g.tools;
    if (!isToolId(id) || T.owned.includes(id) || !toolLock(this.g, id).open) return;
    const def = toolDef(id);
    if (!this.spend(def.price)) return;
    T.owned.push(id);
    T.equipped = id;
    this.applyTool();
    this.saveNow();
    this.toast(t("{tool} bought. It's in your hands.", { tool: t(def.name) }));
    this.refresh();
  }

  private buyMod(key: string): void {
    const [tool, mod] = key.split('.');
    const T = this.g.tools;
    if (!isToolId(tool) || !T.owned.includes(tool)) return;
    const l = modLevel(T, tool, mod), cost = modCost(tool, mod, l);
    if (cost == null || !this.spend(cost)) return;
    T.mods[key] = l + 1;
    this.applyTool();
    this.saveNow();
    this.refresh();
  }

  private nextAfterWin(): void {
    const r = this.result;
    if (!r) return this.show('world');
    const i = routeIndex(r.cityId);
    const next = ROUTE[i + 1];
    if (next && cityLock(this.g, next.id).open) this.showCountryOf(next.id);
    else this.showCountryOf(r.cityId);
  }

  // ------------------------------------------------------------------ rewarded ads

  private async adDouble(): Promise<void> {
    const d = this.day;
    if (!d || d.doubled || this.busy) return;
    this.busy = true;
    const ok = await watch(this.g, 'double');
    this.busy = false;
    if (ok && !d.doubled) {
      d.doubled = true;
      engine().addCash(Math.round(d.today.earned));
      this.toast(`+${money(d.today.earned)} doubled!`);
      this.save();
    }
    this.refresh();
  }

  /** v0.12.1 (Navid: "Free $710" on Austin's first morning, for a $740 seed loan): half an average day of the farm
   *  you're on, on the day you're on. It used to be one of your own recent days, from any farm. */
  private coinsReward(): number {
    const cityId = this.g.run ? this.g.run.cityId : nextCity(this.g);
    const p = this.planOf(cityId);
    let day = 1;
    try {
      if (this.g.run) day = engine().state().day;
    } catch {
      /* engine not ready */
    }
    void coinsForDays;
    // 0.15: in step with the player's bills (they follow the pace)
    return Math.max(20, Math.round((0.5 * avgDay(p.index, day) * p.billMul * p.scale) / 10) * 10);
  }

  private async adCoins(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const ok = await watch(this.g, 'coins');
    this.busy = false;
    if (ok) {
      // v0.12: no savings any more, so free coins go to the farm you're on
      const amt = this.coinsReward();
      if (this.g.run) engine().addCash(amt);
      else this.g.wallet += amt;
      this.toast(t('+{amt} on your farm.', { amt: money(amt) }));
      this.saveNow();
    }
    this.refresh();
  }

  /** "Finish now": a rewarded ad finishes the tree's build (offered only while an ad is loaded). */
  private async adFinish(): Promise<void> {
    if (!this.g.workshop.job || this.busy) return;
    this.busy = true;
    const ok = await watch(this.g, 'finish');
    this.busy = false;
    if (ok) this.settleWorkshop(true);
    this.saveNow();
    this.refresh();
  }

  private async adExtraDay(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    if (!canOffer(this.g, 'extraDay')) {
      this.busy = false;
      this.toast(t("The ad isn't ready yet. Try again in a moment."));
      return;
    }
    const ok = await watch(this.g, 'extraDay');
    this.busy = false;
    if (ok && (engine() as unknown as { lateDay(): boolean }).lateDay()) this.toast(t('A late day. Pay before sunset, or the bank comes closer.'));
    this.save();
    this.refresh();
  }

  // ------------------------------------------------------------------ skills and looks

  /** The tree reaches the engine two ways: every node's level as window.__DBD_TREEFX (`tfx(id)`), and the tricks that
   *  were diamond skills by their old names (`hasSkill`). */
  private applySkills(): void {
    const tree = this.g.tree || {};
    (window as any).__DBD_TREEFX = { ...tree };
    this.applyCropLevels();
    const skills = Object.keys(tree).filter(id => tree[id] > 0 && TREE_SKILL[id]).map(id => TREE_SKILL[id]);
    try {
      engine().setSkills(skills);
    } catch {
      /* engine not ready yet; start() applies them */
    }
  }

  /** Side farms (the daily farm, duels, practice, the intro) run without the player's tree. */
  private clearTreeFx(): void {
    (window as any).__DBD_TREEFX = {};
    (window as any).__DBD_CROPLV = {};
  }

  /** What each vegetable pays for its level (0.13, the road), for the engine. */
  private applyCropLevels(): void {
    (window as any).__DBD_CROPLV = cropPayTable(this.g.cropCuts);
  }

  /** The highest track levels the player has had (kept in the save). */
  private peakLevels(): Levels {
    const lv = this.g.workshop.levels, pk = (this.g.peak ||= { ...lv });
    for (const k of Object.keys(lv) as UpgradeId[]) pk[k] = Math.max(pk[k] || 0, lv[k]);
    return pk;
  }

  /** Opens the tree centred on the trunk, whose card lists what can be bought now. */
  private openTree(): void {
    if (!this.modal.hidden) this.closeModal();
    if (this.scr !== 'tree') this.backTo = this.scr === 'barn' ? this.backTo : this.scr;
    this.treeSel = 'trunk';
    this.treeRecenter = true;
    if (this.treeFull) {
      this.treeFull = false;
      this.treePx = this.treePxBack;
    }
    this.show('tree');
  }

  /** Full screen (0.15.1; Navid, 18 Nov: "a full screen icon on top right so people can view their skill tree in one
   *  view"): the whole tree fits the screen and the card steps aside; a tap on a node, or the button again, comes back
   *  to the map at its size before. */
  private toggleTreeFull(): void {
    if (this.treeFull) {
      this.leaveTreeFull(this.treeSel);
      return;
    }
    this.treePxBack = this.treePx;
    this.treeFull = true;
    this.treeRecenter = true;
    this.render('tree');
    // the map's box is bigger without the card: fit the tree to it once it is drawn
    requestAnimationFrame(() => {
      const el = this.sections.tree;
      this.treeHost.setPx(treeFitPx(el));
      centerTree(el, 'trunk', this.treePx);
    });
  }

  private leaveTreeFull(sel: string): void {
    this.treeFull = false;
    this.treePx = this.treePxBack;
    this.treeSel = sel;
    this.treeRecenter = true;
    this.render('tree');
  }

  /** Pays for a tree node: savings, then the farm's cash above its mark (`spend`). */
  private payTree(cost: number): boolean {
    return this.spend(cost);
  }

  /** Buy a node's next level in the tree, or start building it (a keystone, every fifth level of a track). */
  private buyTreeNode(id: string): void {
    const n = treeNode(id);
    if (!n) return;
    this.syncTreeMoney();
    const res = buyNode(this.g, n, Date.now(), cost => this.payTree(cost));
    if (!res.ok) {
      // 'cash' with the veil up: the tonight's-bill question is being asked (spend)
      if (res.why === 'cash' && !document.querySelector('.dbd-veil')) this.toast(t('Not enough money for {name}.', { name: t(n.name) }));
      this.render('tree');
      return;
    }
    this.peakLevels();
    this.applySkills();
    try {
      engine().setShed(this.g.workshop.levels);
    } catch {
      /* engine not ready */
    }
    this.saveNow();
    // 0.13.1 (Navid, 14 Nov: "i don't hear no sound effect and no vibration. not even button goes down and come up"):
    // a sound, a buzz, and the node and the Buy button pop once
    try {
      engine().uiSound?.(res.instant ? 'buy' : 'build');
    } catch {
      /* engine not ready */
    }
    void hapticImpact('medium');
    this.treeBought = n.id;
    if (!res.instant) this.toast(t('Building {name}.', { name: t(n.name) }));
    this.render('tree');
  }

  private applyLook(): void {
    (window as any).__DBD_LOOK = lookFor(this.g.flair);
  }

  /** The tree screen: the chosen node, the map's size in pixels (a pinch or − and + change it) and full screen. */
  private treeSel = 'trunk';
  private treePx = TREE_PX.start;
  private treeFull = false;
  /** The map's size before full screen, to come back to. */
  private treePxBack = TREE_PX.start;
  private treeRecenter = true;
  /** What the map's gestures and buttons resize: between the whole tree in view and TREE_PX.max. */
  private readonly treeHost: TreeZoomHost = {
    px: () => this.treePx,
    setPx: (px: number) => {
      const el = this.sections.tree;
      const min = Math.min(TREE_PX.start, treeFitPx(el));
      this.treePx = Math.round(Math.max(min, Math.min(TREE_PX.max, px)));
      sizeTree(el, this.treePx);
      return this.treePx;
    },
  };
  /** The node just bought: it pops once on the next draw. */
  private treeBought = '';

  private barnBuy(id: string): void {
    // 0.15 (Navid): looks are bought with cash, and dear
    const item = flairById(id);
    if (!item || this.g.flair.owned.includes(id) || !this.spend(item.price)) return;
    buyFlair(this.g.flair, item.price, id);
    this.applyLook();
    this.saveNow();
    this.toast(`${flairById(id)!.name}: it's yours.`);
    this.render('barn');
  }

  private barnEquip(id: string): void {
    if (!equipFlair(this.g.flair, id)) return;
    this.applyLook();
    this.saveNow();
    this.render('barn');
  }

  // ------------------------------------------------------------------ daily farm and duels

  /** Today's daily state (a new day starts fresh). */
  private dailyState() {
    const d = todayKey();
    if (this.g.daily.date !== d) this.g.daily = newDaily(d);
    return this.g.daily;
  }

  private dailyScreen(): string {
    const st = this.dailyState();
    const def = dailyFor(st.date);
    return dailyHtml(def, st, triesLeft(st), st.adPlays < DAILY_AD_TRIES && canOffer(this.g, 'daily'), goldCredit(routeIndex(frontierCity(this.g))));
  }

  private playDaily(): void {
    const st = this.dailyState();
    if (triesLeft(st) <= 0) return;
    const def = dailyFor(st.date);
    if (!this.startSide('daily', def, 0)) return;
    st.plays++;
    this.saveNow();
  }

  private async adDailyTry(): Promise<void> {
    const st = this.dailyState();
    if (this.busy || st.adPlays >= DAILY_AD_TRIES) return;
    this.busy = true;
    const ok = await watch(this.g, 'daily');
    this.busy = false;
    if (ok) {
      st.adPlays++;
      this.saveNow();
      this.playDaily();
      return;
    }
    this.refresh();
  }

  private openDuel(): void {
    const cities = duelCities(id => cityLock(this.g, id).open);
    const cityId = this.duel && cities.includes(this.duel.cityId) ? this.duel.cityId : cities[cities.length - 1];
    this.duel = {
      cityId,
      tool: this.duel ? this.duel.tool : this.g.tools.equipped,
      names: [t('Player 1'), t('Player 2')],
      seed: 0,
      scores: [0, 0],
      first: 0,
    };
    this.show('duel');
  }

  private duelScreen(): string {
    if (!this.duel) this.openDuel();
    const cities = duelCities(id => cityLock(this.g, id).open);
    return duelHtml(this.duel!, cities, TOOLS.map(t => t.id));
  }

  /** Plays one duel turn: 0 is whoever goes first this round, 1 the other player. */
  private duelTurn(turn: number): void {
    const du = this.duel;
    if (!du) return;
    if (turn === 0) {
      du.seed = (Math.random() * 0xffffffff) >>> 0 || 1;
      du.scores = [0, 0];
    }
    this.startSide('duel', duelFor(du.cityId, du.tool, du.seed), turn);
  }

  private duelRematch(): void {
    const du = this.duel;
    if (!du) return this.openDuel();
    du.first = 1 - du.first;
    du.names = [du.names[1], du.names[0]];
    this.duelTurn(0);
  }

  /** Starts a one-day side farm; the real farm waits in a snapshot until endSide(). */
  private startSide(kind: SideRun['kind'], def: SideDef, turn: number): boolean {
    const e = engine();
    if (this.side || e.state().mode !== 'idle') {
      this.toast(t('Finish the day on your farm first.'));
      return false;
    }
    const snap = e.snapshot();
    const sound = e.state().sound;
    e.setSaving(false);
    e.setFieldSeed(def.seed);
    e.setSkills([]);
    this.clearTreeFx();
    const tool = toolStats({ owned: [def.tool], equipped: def.tool, mods: {} }, def.tool);
    e.setTool(tool);
    const plan = sidePlan(def.cityId, def.tool, def.levels);
    if (!e.beginCity({ cityId: def.cityId, country: plan.country, cash: 0, shed: def.levels, plan, tools: [tool] })) {
      this.restoreFarm(snap, sound);
      return false;
    }
    this.side = { kind, def, snap, sound, turn, score: 0, date: todayKey() };
    const du = this.duel;
    // the bank chip shows the next medal (or, for the second duel player, the score to beat)
    if (kind === 'duel' && du && turn === 1) this.hud.setGoal(() => ({ name: t('To beat'), amt: Math.max(1, du.scores[0] + 1) }));
    else
      this.hud.setGoal(cash => {
        const m = medalOf(def.targets, cash);
        return m >= 3 ? { name: t('Gold!'), amt: def.targets[2] } : { name: t(MEDAL_NAME[m + 1]), amt: def.targets[m] };
      });
    this.show('farm');
    if (!e.startDay()) {
      this.side = null;
      this.restoreFarm(snap, sound);
      this.show('menu');
      return false;
    }
    return true;
  }

  /** Puts the real farm back exactly as it was before the side farm (keeping the sound setting as it is now). */
  private restoreFarm(snap: string, sound: boolean): void {
    const e = engine();
    e.setFieldSeed(0);
    e.restore(snap);
    if (this.g.run) e.setPlan(this.farmPlan(this.g.run));
    e.setSaving(true);
    e.setSound(sound);
    this.hud.syncSound(sound);
    this.applySkills();
    e.setShed(this.g.workshop.levels);
    this.applyTool();
    this.hud.setGoal(null);
  }

  /** The side day is over: score it, restore the farm, show the result. */
  private endSide(): void {
    const sr = this.side;
    if (!sr) return;
    this.side = null;
    let soundNow = sr.sound;
    try {
      soundNow = engine().state().sound;
    } catch {
      /* keep the old setting */
    }
    this.restoreFarm(sr.snap, soundNow);
    const score = sr.score;
    if (sr.kind === 'daily' && this.dailyState().date !== sr.date) {
      // the try started on another day: show the score, but today's medals start fresh
      this.sideOut = { kind: 'daily', score, def: sr.def, medal: 0, newMedal: false, ribbons: 0, credit: 0, tries: triesLeft(this.g.daily), adTry: false };
    } else if (sr.kind === 'daily') {
      const st = this.dailyState();
      const before = st.medal;
      st.best = Math.max(st.best, score);
      const medal = medalOf(sr.def.targets, st.best);
      st.medal = medal;
      // the day's first gold medal pays tree credit (a diamond until 0.12)
      let credit = 0;
      if (medal >= 3 && !st.goldPaid) {
        st.goldPaid = true;
        credit = goldCredit(routeIndex(frontierCity(this.g)));
        this.g.wallet += credit;
      }
      this.sideOut = {
        kind: 'daily', score, def: sr.def, medal, newMedal: medal > before, credit,
        tries: triesLeft(st), adTry: st.adPlays < DAILY_AD_TRIES && canOffer(this.g, 'daily'),
      };
    } else {
      const du = this.duel;
      if (!du) return this.show('menu');
      du.scores[sr.turn] = score;
      if (sr.turn === 0) this.sideOut = { kind: 'duel-pass', score, def: sr.def, scores: [...du.scores] as [number, number], names: du.names };
      else {
        this.sideOut = { kind: 'duel-end', score, def: sr.def, scores: [...du.scores] as [number, number], names: du.names };
      }
    }
    this.saveNow();
    this.show('side');
  }

  // ------------------------------------------------------------------ sound

  /** Music or effects playing (what a mute button shows). */
  private anySound(): boolean {
    let sfx = true;
    try {
      sfx = engine().state().sound;
    } catch {
      /* engine not ready */
    }
    return sfx || this.g.settings.music;
  }

  /** Settings → Sound effects switch (the signpost menu has no mute button; sound lives in Settings). */
  private toggleEffects(): void {
    const e = engine();
    e.setSound(!e.state().sound);
    this.hud.syncSound(e.state().sound);
    this.syncSoundButtons();
    if (!this.modal.hidden && this.modal.dataset.kind === 'settings') this.openSettings();
  }

  /** The field's sound button: pause, with the music and effects switches on the pause card. */
  private pauseForSound(): void {
    try {
      engine().setPaused(true);
    } catch {
      /* engine not ready */
    }
  }

  /** The switches on the pause card (rebuilt each time it opens). */
  private renderPauseSound(): void {
    const box = document.getElementById('pauseSound');
    if (!box) return;
    let sfx = true;
    try {
      sfx = engine().state().sound;
    } catch {
      /* engine not ready */
    }
    const row = (act: string, label: string, onv: boolean) =>
      `<button type="button" class="toggle-row" data-pact="${act}" aria-pressed="${onv}"><span class="tg${onv ? ' on' : ''}"><i></i></span>${label}</button>`;
    box.innerHTML = row('music', t('Music'), this.g.settings.music) + row('sfx', t('Sound effects'), sfx);
    const q = document.getElementById('btnQuitDay');
    const practice = !!this.intro?.practice;
    if (q) {
      q.hidden = !!this.intro && !practice;
      q.textContent = practice ? t('Skip practice') : t('Back to menu');
    }
    const n = document.getElementById('pauseNote');
    if (n) n.textContent = this.side ? t('The day ends now with what you have earned.') : t('This day starts over next time.');
    if (n) n.hidden = !!this.intro;
  }

  /** The pause card: switches, and Back to menu (Navid, 3 Nov: there was no way out of a day). */
  private wirePauseCard(): void {
    const ov = document.getElementById('pauseOverlay');
    if (!ov) return;
    new MutationObserver(() => {
      if (!ov.hidden) this.renderPauseSound();
    }).observe(ov, { attributes: true, attributeFilter: ['hidden'] });
    ov.addEventListener('click', ev => {
      const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-pact], #btnQuitDay');
      if (!el) return;
      if (el.id === 'btnQuitDay') {
        this.quitDay();
        return;
      }
      if (el.dataset.pact === 'music') {
        this.g.settings.music = !this.g.settings.music;
        this.music.setEnabled(this.g.settings.music);
        this.save();
      } else {
        const e = engine();
        e.setSound(!e.state().sound);
        this.hud.syncSound(e.state().sound);
      }
      this.syncSoundButtons();
      this.renderPauseSound();
    });
  }

  /** Leaves the day from the pause card. A real farm goes back to dawn (as if the app had been closed); a daily
   *  farm or a duel turn ends now with what it has earned. */
  private quitDay(): void {
    const e = engine();
    if (this.intro?.practice) return this.endPractice();
    if (e.state().mode !== 'day' || this.intro) return;
    if (this.side) {
      e.setPaused(false);
      e.endDayNow();
      return;
    }
    e.abandonDay();
    this.day = null;
    this.hud.dayEnded();
    this.coach.cancel();
    this.show('menu');
  }

  /** A volume slider's value in percent (80 % until the player moves it). */
  private volume(kind: 'music' | 'sound'): number {
    const v = kind === 'music' ? this.g.settings.musicVol : this.g.settings.sfxVol;
    return typeof v === 'number' ? v : DEFAULT_VOLUME;
  }

  /** Settings → Finger offset: CSS px the sickle sits above a finger. */
  private touchLift(): number {
    const v = this.g.settings.touchLift;
    return typeof v === 'number' ? v : DEFAULT_TOUCH_LIFT;
  }

  /** A volume slider moved (`done` on release). Moving one up also switches that sound back on. */
  private volumeInput(ev: Event, done: boolean): void {
    const el = ev.target as HTMLInputElement | null;
    if (!el || !el.matches || !el.matches('input[data-vol]')) return;
    if (el.dataset.vol === 'lift') {
      const px = Math.max(0, Math.min(MAX_TOUCH_LIFT, Math.round(Number(el.value) || 0)));
      el.style.setProperty('--p', String(px / MAX_TOUCH_LIFT));
      this.g.settings.touchLift = px;
      const v = el.parentElement?.querySelector('.lift-v');
      if (v) v.textContent = px ? '' : t('Off');
      try {
        engine().setTouchLift(px);
      } catch {
        /* engine not ready */
      }
      if (done) this.save();
      return;
    }
    const kind = el.dataset.vol === 'music' ? 'music' : 'sound';
    const pct = Math.max(0, Math.min(100, Math.round(Number(el.value) || 0)));
    el.style.setProperty('--p', String(pct / 100));
    if (kind === 'music') this.g.settings.musicVol = pct;
    else this.g.settings.sfxVol = pct;
    let on = true;
    if (kind === 'music') {
      if (pct > 0 && !this.g.settings.music) {
        this.g.settings.music = true;
        this.music.setEnabled(true);
      }
      on = this.g.settings.music;
    } else {
      try {
        const e = engine();
        if (pct > 0 && !e.state().sound) {
          e.setSound(true);
          this.hud.syncSound(true);
          this.syncSoundButtons();
        }
        on = e.state().sound;
        // a coin at the new level: on release, and now and then while dragging
        const now = performance.now();
        const sample = done || now - this.lastVolSample > 220;
        if (sample) this.lastVolSample = now;
        e.setSfxVolume(volGain(pct), sample);
      } catch {
        /* engine not ready */
      }
    }
    this.music.setVolumes(this.volume('music'), this.volume('sound'));
    // the switch next to the slider (no re-render: that would drop the finger's drag)
    const tg = el.parentElement?.querySelector<HTMLElement>('.toggle-row');
    if (tg) {
      tg.setAttribute('aria-pressed', String(on));
      tg.querySelector('.tg')?.classList.toggle('on', on);
    }
    if (done) this.save();
  }

  private syncSoundButtons(): void {
    let on = true;
    try {
      on = engine().state().sound;
    } catch {
      /* engine not ready */
    }
    on = this.anySound();
    this.root.querySelectorAll<HTMLElement>('[data-act="sound"]').forEach(b => {
      b.setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
      const w = b.querySelector<SVGElement>('.w'), x = b.querySelector<SVGElement>('.x');
      if (w) w.style.display = on ? '' : 'none';
      if (x) x.style.display = on ? 'none' : '';
    });
  }

  // ------------------------------------------------------------------ small pieces

  private toast(msg: string, ms = 2200): void {
    const t = document.createElement('div');
    t.className = 'shell-toast';
    t.textContent = msg;
    document.body.append(t);
    setTimeout(() => t.classList.add('out'), ms);
    setTimeout(() => t.remove(), ms + 500);
  }

  private trio(code: CountryCode, h: number): string {
    const c = countryOf(code);
    return c.trio.map((ty, i) => spriteImg(ty, h - (i ? 2 : 0), t(c.trioNames[i]))).join('');
  }

  /** A shortcut to the upgrade tree while something there can be bought. */
  private gemChip(): string {
    const n = this.upgradesReady();
    return n ? `<button type="button" class="st-chip chip-row gem-chip" data-act="tree" aria-label="${tn(n, '{n} upgrade ready to buy', '{n} upgrades ready to buy')}">${ICON.wrench(20)}<span>${n}</span><small>${t('Skills')}</small></button>` : '';
  }

  private walletChip(): string {
    // between farms: savings (for upgrades and tools); on a farm: the farm's cash (for its bills), then savings
    if (!this.g.run)
      return `<div class="st-chip chip-row wallet-chip save-chip" aria-label="${t('Savings {amt}, for upgrades and tools', { amt: money(this.g.wallet) })}">${ICON.piggy(22)}<span>${money(this.g.wallet)}</span></div>`;
    const save = this.g.wallet > 0 ? `<i class="wc-sep"></i>${ICON.piggy(18)}<span class="wc-save">${money(this.g.wallet)}</span>` : '';
    return `<div class="st-chip chip-row wallet-chip" aria-label="${t('Cash on this farm {amt}', { amt: money(this.farmCash()) })}${save ? `, ${t('savings {amt}', { amt: money(this.g.wallet) })}` : ''}">${ICON.coin(22)}<span>${money(this.farmCash())}</span>${save}</div>`;
  }

  // ------------------------------------------------------------------ menu

  private menuHtml(): string {
    const next = cityById(nextCity(this.g))!;
    const n = routeIndex(next.id) + 1;
    const dl = this.dailyState();
    const dailyMark = dl.medal ? `<i class="side-mark medal">${t(MEDAL_NAME[dl.medal]).charAt(0)}</i>` : dl.plays ? '' : `<i class="side-mark">${t('NEW')}</i>`;
    const gems = this.upgradesReady();
    const plank = this.g.run
      ? t('{farm} · Day {day}', { farm: esc(next.short), day: engine().state().day })
      : t('Farm {n} · {farm}', { n, farm: esc(next.short) });
    // Design 4, the signpost (Navid picked it, 3 Nov): Play is the big board; the plank above it is the next farm and
    // opens the world map; three arrow signs go to the daily farm, duels and the barn (upgrades and the Bling Barn).
    // Language and sound live in Settings (the gear).
    const shape = (d: string) =>
      `<svg class="sp-shape" viewBox="0 0 100 50" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" vector-effect="non-scaling-stroke"/></svg>`;
    const leftArrow = shape('M12 2 H98 V48 H12 L1 25 Z'), rightArrow = shape('M2 2 H86 L99 25 L86 48 H2 Z');
    return `<div class="bg cover"><img class="art" src="${ART.menu}" alt="">
        ${this.menuSprite('lavender', 96, 230, 70, 'bob2')}${this.menuSprite('pei_russet', 168, 268, 100, 'bob')}
        ${this.menuSprite('carrot', 300, 236, 62, 'bob2')}${this.menuSprite('artichaut', 372, 272, 100, 'bob')}</div>
      <div class="grp tl" style="width: 440px; height: 130px"><div class="menu-title sp-title"><h1 class="ink-title">${t('Due by Dusk')}</h1><p class="pill-dark">${t('A little farm. A very big debt.')}</p></div></div>
      <div class="grp tr" style="width: 64px; height: 70px"><button type="button" class="st-btn sp-gear" data-act="settings" aria-label="${t('Settings')}">${ICON.gear()}</button></div>
      <div class="grp mr" style="width: 340px; height: 350px"><div class="signpost">
        <i class="sp-post" aria-hidden="true"></i><i class="sp-mound" aria-hidden="true"></i>
        <button type="button" class="sp-plank" data-act="continue" aria-label="${t('World map')}">${ICON.pin(18)}<span>${plank}</span><span class="sp-map">${t('Map')}</span></button>
        <button type="button" class="st-btn gold sp-play" data-act="play">${ICON.play()}<span>${t('Play')}</span><i class="nail a"></i><i class="nail b"></i><i class="nail c"></i><i class="nail d"></i></button>
        <button type="button" class="sp-sign sp-l sp-daily" data-act="daily">${leftArrow}${calendarIcon(26)}<span>${t('Daily farm')}</span>${dailyMark}</button>
        <button type="button" class="sp-sign sp-r sp-duel" data-act="duel">${rightArrow}${duelIcon(26)}<span>${t('Duel')}</span></button>
        <button type="button" class="sp-sign sp-r sp-pen" data-act="pen">${rightArrow}${PEN_ICON(26)}<span>${t('Pen')}</span>${this.penReady() ? '<i class="dock-badge">$</i>' : ''}</button>
        <button type="button" class="sp-sign sp-l sp-barn" data-act="barn-menu">${leftArrow}${ICON.wrench(22)}${ribbonIcon(22)}<span class="sp-two"><b>${t('Barn')}</b><small>${t('Skills · Bling Barn')}</small></span>${gems ? `<i class="dock-badge">${gems}</i>` : ''}</button>
      </div></div>`;
  }

  /** The signpost's Barn sign: the upgrade tree or the Bling Barn. */
  private openBarnMenu(): void {
    const gems = this.upgradesReady();
    this.openModal('barn-menu', `<h2 class="m-title">${t('Barn')}</h2>
      <div class="m-row barn-pick">
        <button type="button" class="st-btn bp-btn" data-act="tree">${ICON.wrench(36)}<b>${t('Skills')}</b><small>${t('One tree of upgrades that last')}</small>${gems ? `<i class="dock-badge">${gems}</i>` : ''}</button>
        <button type="button" class="st-btn bp-btn" data-act="barn">${ribbonIcon(36)}<b>${t('Bling Barn')}</b><small>${t('Looks for your farm')}</small></button>
      </div>
      <button type="button" class="st-btn btn-md" data-act="close">${t('Back')}</button>`, 460);
  }

  /** The menu's farm at dusk, dimmed, behind the daily farm and duel cards. */
  private backdrop(): string {
    return `<div class="bg cover"><img class="art" src="${ART.menu}" alt=""></div><div class="side-tint"></div>`;
  }

  private menuSprite(type: string, x: number, y: number, h: number, cls: string): string {
    const u = SPRITE[type];
    return u ? `<img class="${cls}" src="${u}" alt="" style="position: absolute; left: ${x}px; top: ${y}px; height: ${h}px" draggable="false">` : '';
  }

  // ------------------------------------------------------------------ world map

  private worldHtml(): string {
    let pins = '';
    for (const c of COUNTRIES) {
      const p = PINS[c.code];
      if (!p) continue;
      const lock = countryLock(this.g, c.code);
      const won = c.cities.filter(x => cityProgress(this.g, x.id).won).length;
      const flag = lock.open ? p.flag : p.flag.replace('<svg ', '<svg style="opacity: .6" ');
      const flagHtml = `<span class="flag">${flag}${lock.open ? '' : `<span class="lock">${ICON.lock('#2B1708', 11)}</span>`}</span>`;
      const lbl = `<span class="lbl">${esc(c.code === 'US' ? t('USA') : t(c.name))} · ${won}/${c.cities.length}</span>`;
      const cls = `pin${lock.open ? ' open' : ''}${this.worldSel === c.code ? ' sel' : ''}${won === c.cities.length ? ' done' : ''}`;
      pins += `<button type="button" class="${cls}" data-act="country" data-arg="${c.code}" aria-label="${esc(t(c.name))}${lock.open ? '' : `, ${t('locked')}`}" style="left: ${p.left}px; top: ${p.top}px">${p.labelFirst ? lbl + flagHtml : flagHtml + lbl}</button>`;
    }
    const clouds = ['a', 'b', 'c', 'd']
      .map((k, i) => {
        const pos = [['-60px', '-40px', 560], ['380px', '-60px', 580], ['-120px', '160px', 600], ['360px', '150px', 620]][i];
        return `<img class="cloud" data-cloud="${k}" src="${ART.cloud}" alt="" style="left: ${pos[0]}; top: ${pos[1]}; width: ${pos[2]}px">`;
      })
      .join('');
    const c = countryOf(this.worldSel);
    const lock = countryLock(this.g, c.code);
    const st = countryStars(this.g, c.code);
    let card = `<div class="card-head"><span class="card-name">${esc(t(c.name))}</span><span class="pill-dark pill-sm">${tn(c.cities.length, '{n} farm', '{n} farms')}</span></div>
      <p class="card-text">${esc(t(c.blurb))}</p>`;
    if (lock.open) {
      card += `<div class="card-foot"><div class="trio">${this.trio(c.code, 46)}</div><div class="card-stars">${ICON.star(true, 16)} ${st}/${c.cities.length * 3}</div>
        <button type="button" class="st-btn gold btn-md" data-act="enter" data-arg="${c.code}">${t('Enter')}</button></div>`;
    } else {
      card += `<div class="locked-box">${ICON.lock()}<span>${esc(lock.reason)}</span></div>`;
    }
    return `<div class="bg fit"><img class="art" id="dbdWorldArt" src="${ART.world}" alt="${t('World map with the farm route')}">${pins}${clouds}</div>
      <div class="grp tl" style="width: 330px; height: 64px"><button type="button" class="st-btn st-sq top-btn" data-act="go" data-arg="menu" aria-label="${t('Back to menu')}">${ICON.back()}</button>
        <h2 class="st-chip top-chip">${t('World map')}</h2></div>
      <div class="grp tr" style="width: 150px; height: 64px"><button type="button" class="st-chip top-chip right crown-chip" data-act="pen" aria-label="${t('The Pen')}">${PEN_ICON(24)}<span>${workerCount(this.g.pen)} / ${ROUTE.length}</span></button></div>
      <div class="grp br" style="width: 300px; height: 200px"><div class="st-chip country-card">${card}</div></div>`;
  }

  private cloudT = 0;
  private openClouds(): void {
    const sec = this.sections.world;
    const art = sec.querySelector<HTMLElement>('#dbdWorldArt');
    const clouds = sec.querySelectorAll<HTMLElement>('[data-cloud]');
    const to: Record<string, string> = { a: 'translate(-640px, -160px)', b: 'translate(640px, -160px)', c: 'translate(-680px, 160px)', d: 'translate(680px, 180px)' };
    const parted = () => {
      if (art) art.style.transform = 'scale(1)';
      clouds.forEach(c => (c.style.transform = to[c.dataset.cloud || 'a']));
    };
    clearTimeout(this.cloudT);
    let reduce = false;
    try {
      reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      /* ignore */
    }
    const fresh = sec.dataset.opened !== '1';
    sec.dataset.opened = '1';
    sec.classList.add('snap');
    if (fresh && !reduce) {
      if (art) art.style.transform = 'scale(1.12)';
      clouds.forEach(c => (c.style.transform = 'translate(0, 0)'));
      void sec.offsetWidth;
      sec.classList.remove('snap');
      this.cloudT = window.setTimeout(parted, 400);
    } else {
      parted();
      void sec.offsetWidth;
      sec.classList.remove('snap');
    }
  }

  // ------------------------------------------------------------------ country map

  private countryHtml(): string {
    const c = countryOf(this.countrySel);
    const cc = c.code.toLowerCase();
    const nodes = NODES[cc] || {};
    const mapUrl = MAP[cc];
    const won = c.cities.filter(x => cityProgress(this.g, x.id).won).length;
    const current = this.g.run && cityById(this.g.run.cityId)?.country === c.code ? this.g.run.cityId : this.firstCityToShow(c.code);
    let pins = '';
    c.cities.forEach((ct, i) => {
      let pos = nodes[ct.id];
      if (!pos) pos = { x: 70 + i * (420 / Math.max(1, c.cities.length - 1)), y: 250 - (i % 2) * 70 };
      const p = cityProgress(this.g, ct.id);
      const lock = cityLock(this.g, ct.id);
      const isCur = ct.id === current && lock.open && !p.won;
      const size = isCur ? 48 : 40;
      const cls = `node${isCur ? ' cur' : ''}${p.won ? ' won' : ''}${lock.open ? '' : ' locked'}${this.citySel === ct.id ? ' sel' : ''}${isBossCity(ct.id) ? ' boss' : ''}`;
      const inner = p.crown ? ICON.crown('#FFF4DC', 22) : String(i + 1);
      if (isCur) {
        pins += `<span class="pulse" aria-hidden="true" style="left: ${(pos.x - 24).toFixed(1)}px; top: ${(pos.y - 24).toFixed(1)}px"></span>`;
        pins += `<span class="pill-dark here" aria-hidden="true" style="left: ${(pos.x - 42).toFixed(1)}px; top: ${(pos.y - 50).toFixed(1)}px">${this.g.run && this.g.run.cityId === ct.id ? t('Your farm') : t('You are here')}</span>`;
      }
      pins += `<button type="button" class="${cls}" data-act="city" data-arg="${ct.id}" aria-label="${t('Farm {n}, {farm}', { n: i + 1, farm: esc(ct.short) })}" style="left: ${(pos.x - size / 2).toFixed(1)}px; top: ${(pos.y - size / 2).toFixed(1)}px">${inner}</button>`;
      if (isBossCity(ct.id)) pins += `<span class="boss-tag" aria-hidden="true" style="left: ${(pos.x + 14).toFixed(1)}px; top: ${(pos.y + 12).toFixed(1)}px">${t('BOSS')}</span>`;
    });
    const art = mapUrl
      ? `<img class="art" src="${mapUrl}" alt="${t('Map of {country}', { country: esc(t(c.name)) })}">`
      : `<img class="art map-fallback" src="${ART.world}" alt="">`;
    return `<div class="bg fit">${art}${pins}</div>
      <div class="grp tl" style="width: 400px; height: 64px"><button type="button" class="st-btn st-sq top-btn" data-act="go" data-arg="world" aria-label="${t('Back to world map')}">${ICON.back()}</button>
        <div class="st-chip top-chip"><h2>${esc(t(c.name))}</h2><span class="sub">${t('{won} of {n} farms won', { won, n: c.cities.length })}</span></div></div>
      <div class="grp bl" style="width: 330px; height: 64px"><div class="bl-row">${this.walletChip()}${this.gemChip()}</div></div>
      <div class="grp tr" style="width: 262px; height: 390px"><div class="st-chip city-card">${this.cityCardHtml(this.citySel)}</div></div>`;
  }

  private cityCardHtml(cityId: string): string {
    const ct = cityById(cityId)!;
    const c = countryOf(ct.country);
    const plan = this.planOf(cityId);
    const p = cityProgress(this.g, cityId);
    const lock = cityLock(this.g, cityId);
    const n = c.cities.findIndex(x => x.id === cityId) + 1;
    const preview = PREVIEW[cityId] || bandFor(cityId, ct.country);
    let h = `<div class="cc-top"><span class="eyebrow">${t('FARM {n} OF {m}', { n, m: c.cities.length })}${plan.boss ? ` · ${t('BOSS')}` : ''}</span><span class="stars">${stars(p.stars)}</span></div>
      <h3 class="cc-name">${esc(ct.name)}</h3>`;
    if (lock.open) {
      const bossSpr = plan.bossFight ? SPRITE[plan.bossFight.type] : '';
      h += preview
        ? `<div class="cc-preview" style="background-image: url('${preview}')" role="img" aria-label="${t('The {farm} farm', { farm: esc(ct.short) })}">${bossSpr ? `<span class="cc-boss"><img src="${bossSpr}" alt="" draggable="false">${ICON.crown('#FFC23D', 26)}</span>` : ''}</div>`
        : `<div class="cc-preview empty">${bossSpr ? `<span class="cc-boss"><img src="${bossSpr}" alt="" draggable="false">${ICON.crown('#FFC23D', 26)}</span>` : ''}</div>`;
      if (plan.bossFight)
        h += `<div class="cc-twist boss">${ICON.crown('#FFC23D', 18)}<p><b>${esc(t(plan.bossFight.name))}</b> ${pronoun(plan.bossFight.name) === 'her' ? t('guards the big bill. Knock her out to pay it.') : t('guards the big bill. Knock him out to pay it.')}</p></div>`;
      else
        h += `<div class="cc-twist"><span class="tw-ic">${eventIcon(plan.signatureEvent)}</span><p>${esc(t(EVENT_LINES[plan.signatureEvent] || ''))}</p></div>`;
    } else {
      h += `<div class="locked-box tall">${ICON.lock()}<span>${esc(lock.reason)}</span></div>`;
      h += `<p class="cc-desc">${esc(t(ct.desc))}</p>`;
    }
    h += `<div class="stat2"><div class="statbox"><div class="k">${t('{n} BILLS', { n: plan.bills.length })}</div><div class="v">${tn(plan.totalDays, '{n} day', '{n} days')}</div></div>
      <div class="statbox"><div class="k">${t('BIG BILL')}</div><div class="v">${money(plan.bills[plan.bills.length - 1].amt)}</div></div></div>`;
    if (p.bestDay > 0) h += `<p class="cc-best">${t('Your best day here:')} <b>${money(p.bestDay)}</b></p>`;
    // 0.14: the town's runaway (caught ones are in the Pen)
    const rw = plan.runaway;
    h += `<div class="cc-rival cc-runaway"><div class="trio">${spriteImg(rw, 34, cropName(rw))}</div><span>${p.won ? t('Caught') : t('Runaway')}<br><b>${esc(t(cropName(rw)))}</b></span></div>`;
    if (!lock.open) h += `<button type="button" disabled class="st-btn btn-lg off">${t('Locked')}</button>`;
    else if (this.g.run && this.g.run.cityId === cityId) h += `<button type="button" class="st-btn gold btn-lg" data-act="farm" data-arg="${cityId}">${t('Continue · Day {day}', { day: engine().state().day })}</button>`;
    else if (p.won) h += `<button type="button" class="st-btn btn-lg" data-act="pen">${t('In the Pen')}</button>`;
    else h += `<button type="button" class="st-btn gold btn-lg" data-act="farm" data-arg="${cityId}">${t('Chase it')}</button>`;
    return h;
  }

  // ------------------------------------------------------------------ farmhouse (between days)

  // The farmhouse between days (v0.11, Navid's pick of ten: "Day card first"). The day is the big thing in the
  // middle with one button; the shop (upgrades, tools, perks, bills) waits behind four tiles and opens in a panel.
  private farmhouseHtml(): string {
    const run = this.g.run;
    if (!run) return '';
    const e = engine();
    const st = e.state(), b = e.bill();
    const ct = cityById(run.cityId)!;
    const plan = this.farmPlan(run);
    // the one big button: start the day, or pay tonight's bill, or face the bank
    let main: string;
    // short on the bill: a late day (an ad) is the big choice while there are late days left; the bank is the small one
    // (v0.12, Navid 5 Nov: late fees of 20%, 40%, 60%, an ad for each late day, the bank after the third)
    const late = (st as unknown as { late?: number }).late || 0;
    const short = b.tonight && !b.canPay, extraLeft = short && late < 3;
    if (extraLeft)
      main = `<button type="button" class="st-btn blue dc-go dc-more ad-btn" data-act="ad-extra">${ICON.play()}<span>${t('Late day {n} of 3', { n: late + 1 })}</span></button>`;
    else if (short) main = `<button type="button" class="st-btn red dc-go" data-act="bank">${t('Face the bank')}</button>`;
    else if (b.tonight) main = `<button type="button" class="st-btn gold dc-go" data-act="pay">${ICON.coin(30)}<span>${t('Pay {amt}', { amt: money(b.amt) })}</span></button>`;
    else
      main = `<button type="button" class="st-btn gold dc-go" data-act="start" aria-label="${t('Start day {day}', { day: st.day })}">${ICON.sunrise(46)}<span>${t('Start')}</span>${ICON.next()}</button>`;
    const extra = extraLeft ? `<button type="button" class="st-btn red dc-bank-sm" data-act="bank">${t('Face the bank')}</button>` : '';
    // free coins pay about one of the player's own days, so they wait for the first day played (Navid, 3 Nov)
    const coinsOffer = canOffer(this.g, 'coins') && (this.g.recentEarn || []).length > 0
      ? `<button type="button" class="ad-chip" data-act="ad-coins">${ICON.play()}<span>${t('Free {amt}', { amt: money(this.coinsReward()) })}</span></button>`
      : '';
    // the farm's days: the ones played, today, and the days a bill is due
    const bills = e.bills();
    const dueDays = new Set<number>();
    let d = st.due;
    dueDays.add(d);
    for (let i = st.bill + 1; i < bills.length; i++) {
      d += bills[i].days;
      dueDays.add(d);
    }
    const total = Math.max(d, st.day);
    let dots = '';
    for (let i = 1; i <= total; i++) dots += `<i class="${i < st.day ? 'done' : i === st.day ? 'now' : dueDays.has(i) ? 'bill' : ''}"></i>`;
    // the bill coming up, and the boss when there is one
    const covered = st.cash >= b.amt;
    const pct = clamp(st.cash / Math.max(1, b.amt), 0, 1);
    const kind = plan.bills[b.index]?.kind;
    const billRow = `<div class="dc-bill${covered ? ' ok' : ''}${b.tonight ? ' hot' : ''}${kind ? ' ' + kind : ''}" data-act="panel" data-arg="bills" role="button" aria-label="${t('Bills')}">${billIcon(kind, 30)}
        <span class="dc-bt"><b>${esc(t(b.name))}</b><span>${b.tonight ? t('Due tonight') : t('Due day {day}', { day: b.dueDay })}</span></span>
        <span class="dc-amt">${money(b.amt)}</span>${covered ? ICON.check(26) : `<span class="dc-meter" aria-label="${Math.round(pct * 100)}%"><i style="width: ${(pct * 100).toFixed(1)}%"></i></span>`}</div>`;
    const boss = st.boss;
    const bossRow =
      boss && !boss.down
        ? `<div class="dc-boss${b.bossBlock ? ' hot' : ''}">${ICON.crown('#FFC23D', 18)}<b>${esc(t(boss.name))}</b><span class="nb-bar"><i style="width: ${(clamp(boss.hp / Math.max(1, boss.max), 0, 1) * 100).toFixed(1)}%"></i></span></div>`
        : '';
    // v0.12: a new crop every morning. Short on tonight's bill, the place says what a late day costs (v0.12.1, Navid:
    // not a sentence in a button)
    const lateRow = extraLeft
      ? `<p class="dc-late">${t('One more day for an ad: Grumble & Sons keep {p}% of what you earn that day. After 3 late days, the bank takes the farm.', { p: Math.round(100 * ((st as unknown as { lateNext?: number }).lateNext ?? [0.2, 0.4, 0.6][late])) })}</p>`
      : '';
    // 0.14: a repair waiting to be paid (fewer crops until then)
    const repairRow = !bossRow && !lateRow && run.repair
      ? `<div class="dc-repair">${ICON.wrench(24)}<span>${esc(t(run.repair.what))}</span><button type="button" class="st-btn gold btn-sm" data-act="repair">${t('Fix {amt}', { amt: money(run.repair.amt) })}</button></div>`
      : '';
    const newRow = bossRow || lateRow || repairRow ? '' : this.newTodayRow();
    // the tiles: what is waiting behind each
    const ups = this.upgradesReady();
    const job = this.g.workshop.job;
    const jobLine = job ? `<span class="ft-job" id="dbdJobTile">${ICON.clock(12)} ${formatDuration(job.endsAt - Date.now())}</span>` : '';
    const perkIcons = st.perks
      .slice(-4)
      .map(id => {
        const p = e.perkInfo(id);
        return p ? perkIcon(p.icon, 22) : '';
      })
      .join('');
    const tool = TOOL_ICON[this.g.tools.equipped];
    // 0.15 (Navid, 15 Nov: "the Day card ... why not updated with our new setting? ... adding pen and removing one of
    // these"; 23:44: "put perk instead of bills. also why on earth the two right boxes are not same size as two left
    // boxes ... please also design more different designs"; 16 Nov, of four designs: "i pick this one"): one board,
    // the day on the left (the bill on it opens the town's bills) and four tiles of one size in a square on the right:
    // Skills, Tools, the Pen (how full it is, a coin when it is worth a look) and the town's Perks.
    const pen = this.g.pen, penN = workerCount(pen), pfill = penFill(pen, Date.now());
    const badge = ups ? `<i class="ft-badge" aria-label="${tn(ups, '{n} upgrade ready to buy', '{n} upgrades ready to buy')}">${ups}</i>` : '';
    const penBadge = this.penReady() ? '<i class="ft-badge">$</i>' : '';
    const penBar = `<span class="ft-pen" aria-label="${Math.round(pfill * 100)}%"><i style="width: ${(penN ? pfill * 100 : 0).toFixed(0)}%"></i></span>`;
    return `<div class="wood"></div>
      <div class="grp tl" style="width: 420px; height: 64px"><div class="fh-top">
        <button type="button" class="st-btn st-sq" data-act="map" data-arg="${run.cityId}" aria-label="${t('Back to the map')}">${ICON.back()}</button>
        ${this.walletChip()}${coinsOffer}</div></div>
      <div class="grp mcb fh-v3"><div class="st-chip fh-board">
        <div class="day-card">
          <div class="dc-city"><span>${esc(ct.short)}</span><button type="button" class="dc-stars" data-act="goals" aria-label="${t('Win 3 stars here')}">${[0, 1, 2].map(i => ICON.star(i < cityProgress(this.g, run.cityId).stars, 15)).join('')}</button>${plan.boss ? `<i class="dc-boss-tag">${t('BOSS')}</i>` : ''}${plan.runaway ? `<span class="dc-rw" aria-label="${esc(t('Runaway: {name}', { name: t(cropName(plan.runaway)) }))}">${spriteImg(plan.runaway, 26, '')}</span>` : ''}</div>
          <h2 class="dc-day">${t('Day {day}', { day: st.day })}</h2>
          <div class="dc-dots${total > 20 ? ' many' : ''}" role="img" aria-label="${t('Day {day} of {n}', { day: st.day, n: total })}">${dots}</div>
          ${billRow}${bossRow}${lateRow}${repairRow}${newRow}
          <div class="dc-go-row">${extra}${main}</div>
        </div>
        <div class="fb-grid">
          <button type="button" class="st-btn fh-tile" data-act="tree">${ICON.wrench(48)}<b>${t('Skills')}</b>${jobLine}${badge}</button>
          <button type="button" class="st-btn fh-tile" data-act="panel" data-arg="tools">${tool ? tool(46) : ''}<b>${t('Tools')}</b></button>
          <button type="button" class="st-btn fh-tile" data-act="pen">${PEN_ICON(48)}<b>${t('Pen')}</b>${penBar}${penBadge}</button>
          <button type="button" class="st-btn fh-tile" data-act="panel" data-arg="perks">${ICON.chest(48)}<b>${t('Perks')}</b>${perkIcons ? `<span class="ft-perks">${perkIcons}</span>` : ''}</button>
        </div></div></div>`;
  }

  /** Tree nodes the player could buy right now (the badge on the Upgrades tile and the Barn sign). */
  private upgradesReady(): number {
    let money = this.g.wallet;
    try {
      money = this.treeMoney();
    } catch {
      /* engine not ready: savings and nothing else */
    }
    return treeReady(this.g, money).length;
  }

  /** The panel behind the farmhouse tiles: tools, perks and bills, one tab each. Its Upgrades tab is the tree. */
  private openPanel(tab: string): void {
    if (tab === 'workshop') return this.openTree();
    if (tab !== 'tools' && tab !== 'perks' && tab !== 'bills') return;
    this.fhTab = tab;
    if (this.modal.hidden || this.modal.dataset.kind !== 'panel') this.openModal('panel', '', 560);
    this.renderPanel();
  }

  private renderPanel(): void {
    const card = this.modal.querySelector('.modal-card');
    if (!card || !this.g.run) return;
    const st = engine().state();
    const tabs = `<button type="button" data-act="tree">${t('Skills')}</button>` + (
      [
        ['tools', t('Tools')],
        ['perks', t('Perks')],
        ['bills', t('Bills')],
      ] as const
    )
      .map(([id, label]) => `<button type="button" class="${this.fhTab === id ? 'on' : ''}" data-act="panel" data-arg="${id}">${label}</button>`)
      .join('');
    let body = '';
    if (this.fhTab === 'tools') body = this.toolsTab();
    else if (this.fhTab === 'perks') body = this.perksList(st.perks);
    else body = this.billsList();
    // the payout note lives behind an "i" next to the cash so it no longer pushes the cards down (Navid, 3 Nov)
    const run = this.g.run;
    const info = run.own || run.mark > 0
      ? `<button type="button" class="up-info" data-act="info" data-arg="mark" aria-label="${t('About this farm\'s cash')}"><i class="info-i">i</i></button>`
      : '';
    card.innerHTML = `<div class="pn-head">${this.walletChip()}${info}<div class="seg tabs">${tabs}</div></div><div class="fh-body pn-body">${body}</div>
      <button type="button" class="st-btn gold btn-md pn-done" data-act="close">${t('Done')}</button>`;
    layout(this.root);
  }

  /** v0.11.4 (Navid, 4 Nov): the tool's art and text took a third of the panel and pushed its attachments out of sight,
   *  and the attachment lines were cut off. The blurb shows only for a tool you don't own; the lines wrap. */
  private toolsTab(): string {
    const T = this.g.tools;
    const cash = this.wallet();
    const sel = toolDef(this.toolSel);
    const list = TOOLS.map(tl => {
      const owned = T.owned.includes(tl.id), lock = toolLock(this.g, tl.id);
      const status = T.equipped === tl.id ? t('In hand') : owned ? t('Owned') : lock.open ? money(tl.price) : t('Locked');
      const cls = `tool-row${this.toolSel === tl.id ? ' sel' : ''}${owned ? ' owned' : lock.open ? ' sale' : ' locked'}`;
      return `<button type="button" class="${cls}" data-act="tool" data-arg="${tl.id}">${TOOL_ICON[tl.id](32)}<span class="tr-txt"><b>${esc(t(tl.name))}</b><span>${status}</span></span></button>`;
    }).join('');
    const owned = T.owned.includes(sel.id), lock = toolLock(this.g, sel.id);
    let head: string;
    if (T.equipped === sel.id) head = `<span class="pill-dark pill-sm">${t('In your hands')}</span>`;
    else if (owned) head = `<button type="button" class="st-btn gold btn-sm" data-act="equip" data-arg="${sel.id}">${t('Use this')}</button>`;
    else if (lock.open) {
      const can = cash >= sel.price;
      head = `<button type="button" class="st-btn btn-sm${can ? ' gold' : ' off'}" data-act="buy-tool" data-arg="${sel.id}" ${can ? '' : 'disabled'}>${t('Buy {amt}', { amt: money(sel.price) })}</button>`;
    } else head = `<span class="lock-chip">${ICON.lock('#5A3E2B', 12)}${esc(lock.reason)}</span>`;
    const mods = sel.mods
      .map(m => {
        const l = modLevel(T, sel.id, m.id), cost = modCost(sel.id, m.id, l);
        const pips = Array.from({ length: m.max }, (_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('');
        let btn: string;
        if (cost == null) btn = `<button type="button" class="st-btn btn-mod off" disabled>${t('Max')}</button>`;
        else if (!owned) btn = `<button type="button" class="st-btn btn-mod off" disabled>${money(cost)}</button>`;
        else {
          const can = cash >= cost;
          btn = `<button type="button" class="st-btn btn-mod${can ? ' gold' : ' off'}" data-act="buy-mod" data-arg="${sel.id}.${m.id}" ${can ? '' : 'disabled'}>${money(cost)}</button>`;
        }
        // 0.16: the Power booster's first level gives the tool its power bar
        const unlock = m.id === 'charge' && l === 0;
        return `<div class="mod-row${unlock ? ' mod-unlock' : ''}" data-mod="${m.id}"><span class="mod-txt"><b>${esc(t(m.name))}</b><span>${esc(t(unlock ? POWER_UNLOCK_LINE : m.line))}</span></span><span class="pips">${pips}</span>${btn}</div>`;
      })
      .join('');
    return `<div class="tools-tab"><div class="tool-list">${list}</div><div class="tool-detail">
        <div class="td-head">${TOOL_ICON[sel.id](30)}<span class="td-name">${esc(t(sel.name))}</span>${head}</div>
        ${owned ? '' : `<p class="td-blurb">${esc(t(sel.blurb))}</p>`}<p class="td-stats">${esc(toolSummary(toolStats(T, sel.id)).join(' · '))}</p>
        <div class="mod-list">${mods}</div></div></div>`;
  }

  /** The build in progress, once a second: the farmhouse tile, the tree's chip and the bar on its card. */
  private updateJobBar(): void {
    const job = this.g.workshop.job;
    if (!job) return;
    const left = job.endsAt - Date.now();
    const tile = document.getElementById('dbdJobTile');
    if (tile) tile.innerHTML = `${ICON.clock(12)} ${formatDuration(left)}`;
    const chip = document.getElementById('dbdTreeJob');
    if (chip) chip.textContent = formatDuration(left);
    const bar = document.getElementById('dbdJob');
    if (!bar) return;
    const pct = clamp(1 - left / Math.max(1, job.endsAt - job.startedAt), 0, 1);
    const i = bar.querySelector<HTMLElement>('.jb-track i'), l = bar.querySelector<HTMLElement>('.jb-left');
    if (i) i.style.width = (pct * 100).toFixed(1) + '%';
    if (l) l.innerHTML = `${ICON.clock(13)} ${formatDuration(left)}`;
  }

  private perksList(ids: string[]): string {
    if (!ids.length) return `<p class="fh-empty">${t('Pay a bill to pick your first perk for this farm.')}</p>`;
    const counts: Record<string, number> = {};
    for (const id of ids) counts[id] = (counts[id] || 0) + 1;
    return `<div class="perk-list">${Object.entries(counts)
      .map(([id, n]) => {
        const p = engine().perkInfo(id);
        return p ? `<div class="perk-row"><b>${esc(t(p.name))}${n > 1 ? ` ×${n}` : ''}</b><span>${esc(t(deviceText(p.line)))}</span></div>` : '';
      })
      .join('')}</div>`;
  }

  private billsList(): string {
    const e = engine();
    const st = e.state();
    const plan = this.g.run ? this.farmPlan(this.g.run) : null;
    // the field's vegetables, each with its level (0.13, the road)
    const cuts = this.g.cropCuts || {};
    const now = plan && plan.stages.filter(x => x.stage <= st.billsPaid).map(x => cropChip(x.type, cropLevel(cuts[x.type] || 0), 22)).join('');
    const field = now ? `<p class="bl-field">${t('On the field now:')} ${now}</p>` : '';
    // bills keep their schedule: each is due its own number of days after the one before it
    let due = st.due;
    return `${field}<div class="bill-list">${e
      .bills()
      .map((b, i) => {
        if (i > st.bill) due += b.days;
        const status = i < st.billsPaid ? 'paid' : i === st.bill ? 'now' : 'later';
        const next = plan && plan.stages.find(x => x.stage === i + 1);
        const crop = next ? `<span class="b-crop" title="${t('Then: {crop}', { crop: esc(cropName(next.type)) })}">${spriteImg(next.type, 24, cropName(next.type))}</span>` : `<span class="b-crop"></span>`;
        const kind = plan?.bills[i]?.kind;
        return `<div class="bill-row ${status}${kind ? ' ' + kind : ''}"><span class="b-no">${billIcon(kind, 20)}</span><span class="b-name">${esc(t(b.name))}</span><span class="b-amt">${money(b.amt)}</span><span class="b-st">${
          status === 'paid' ? t('Paid ✓') : t('Due day {day}', { day: i === st.bill ? st.due : due })
        }</span>${crop}</div>`;
      })
      .join('')}</div>`;
  }

  // ------------------------------------------------------------------ sundown

  private sundownHtml(): string {
    const d = this.day;
    const run = this.g.run;
    if (!d || !run) return '';
    const e = engine();
    const b = e.bill();
    const plan = this.farmPlan(run);
    const earned = Math.round(d.today.earned);
    const amtTxt = money(b.amt) + '.00';
    const dots = ' ' + new Array(Math.max(2, 31 - t(b.name).length - amtTxt.length)).join('.') + ' ';
    const cashNow = e.state().cash;
    const stamp = b.bossBlock && cashNow >= b.amt
      ? `<span class="stamp bad">${t('BOSS FIRST')}</span>`
      : b.covered
        ? `<span class="stamp ok">${t('COVERED')}</span>`
        : `<span class="stamp bad">${t('SHORT {amt}', { amt: money(b.amt - cashNow) })}</span>`;
    const boss = e.state().boss;
    let bossLine = '';
    if (d.today.boss && boss) bossLine = `<div class="sd-boss win">${ICON.crown('#FFC23D', 18)}<span>${t('{boss} knocked out! Bounty +{amt}', { boss: esc(t(boss.name)), amt: money(d.today.boss) })}</span></div>`;
    else if (boss && !boss.down)
      bossLine = `<div class="sd-boss">${ICON.crown('#FFC23D', 18)}<span>${t('{boss}: {n}% left', { boss: esc(t(boss.name)), n: Math.max(1, Math.round((boss.hp / Math.max(1, boss.max)) * 100)) })}</span><span class="nb-bar"><i style="width: ${(clamp(boss.hp / Math.max(1, boss.max), 0, 1) * 100).toFixed(1)}%"></i></span></div>`;
    const dueLine = b.tonight ? t('Due tonight.') : tn(b.left, 'Due in {n} day.', 'Due in {n} days.');
    // 0.16.1 (Navid, 19 Nov: "after i don't know like 10 ads ... i couldn't see ads and double my money"): no daily cap,
    // and while AdMob has no ad ready the button says so (it wakes up when one loads) instead of going away
    const dblOpen = !d.doubled && earned > 0 && offerAllowed(this.g, 'double');
    const dbl = dblOpen && canOffer(this.g, 'double')
      ? `<button type="button" class="st-btn blue btn-md flex1 ad-btn" data-act="ad-double">${ICON.play()}<span>${t('Double it: +{amt}', { amt: money(earned) })}</span></button>`
      : dblOpen
        ? `<button type="button" class="st-btn blue btn-md flex1 ad-btn off" disabled aria-disabled="true">${ICON.play()}<span>${t('No ad right now')}</span></button>`
        : '';
    // v0.11.1 (Navid, 3 Nov: less text, bigger numbers): what the day earned, big; the bill on one line; crops and the
    // chain behind the "i"
    void dots;
    // a late day: what Grumble & Sons took at sunset (v0.12)
    const fee = (d.today as { fee?: number }).fee || 0, feeRate = (d.today as { feeRate?: number }).feeRate || 0;
    const feeLine = fee > 0 ? `<div class="sd-fee">${t('Late fee: Grumble & Sons took {amt} ({p}%)', { amt: money(fee), p: Math.round(feeRate * 100) })}</div>` : '';
    // straight to the next day (Navid, 4 Nov); on a bill night only when the bill can be paid now
    const nextBtn = !b.tonight || (b.canPay && !b.bossBlock)
      ? `<button type="button" class="st-btn gold btn-md flex1 sd-next" data-act="next-day">${b.tonight ? `<span class="sn-two"><span>${t('Pay {amt}', { amt: money(b.amt) })}</span><small>${t('Next day')}</small></span>` : t('Next day')}${ICON.next()}</button>`
      : '';
    // vegetables whose level rose today: the sprite and its new level
    const lvNow = d.levelUps && d.levelUps.length
      ? `<div class="sd-lv">${d.levelUps.slice(0, 5).map(u => `<span class="sd-lvup">${cropChip(u.type, u.level, 24)}<i>▲</i></span>`).join('')}</div>`
      : '';
    // v0.12.1 (Navid: "it doesn't show how much money i have left"): the jar is on the card. v0.13.1 (Navid, 14 Nov:
    // "the money in the jar should be less bold than what we earned today. also what we earned today should come on
    // top"): today's harvest is the big number, the jar a smaller line under it
    return `<div class="grp mc" style="width: 430px; height: 300px"><div class="st-chip sundown-card slim">
      <button type="button" class="st-btn sd-home" data-act="farmhouse" aria-label="${t('Farmhouse')}">${ICON.house(22)}</button>
      <div class="sd-head"><h2>${t('Sundown!')}</h2>
        <button type="button" class="up-info" data-act="info" data-arg="day" aria-label="${t('About today')}"><i class="info-i">i</i></button></div>
      <div class="sd-hero"><span class="sd-today"><b class="sd-big money">+${money(earned)}</b>${d.doubled ? '<span class="sd-x2">×2</span>' : ''}<span class="sd-lbl">${t('today')}</span></span>
        <span class="sd-cash"><span class="money">${money(cashNow)}</span><span class="sd-lbl">${t('in the jar')}</span></span></div>
      <div class="sd-bill">${billIcon(plan.bills[b.index]?.kind, 26)}<span class="sb-what"><span class="sb-name">${esc(t(b.name))}</span><span class="sb-due">${dueLine}</span></span><b class="sb-amt">${money(b.amt)}</b>${stamp}</div>
      ${feeLine}${d.collector ? `<div class="sd-fee">${ICON.notice(18)}<span>${t('The collector took {amt} for the tax.', { amt: money(d.collector) })}</span></div>` : ''}${bossLine}${lvNow}
      <div class="sd-actions${dbl && nextBtn ? ' three' : ''}">${dbl}${nextBtn ? `<button type="button" class="st-btn btn-md sd-house sd-ups" data-act="tree" aria-label="${t('Skills')}">${ICON.wrench(28)}</button>${nextBtn}` : `<button type="button" class="st-btn gold btn-md flex1" data-act="farmhouse">${t('Farmhouse')}${ICON.next()}</button>`}</div>
    </div></div>`;
  }

  // ------------------------------------------------------------------ won / lost

  private resultHtml(): string {
    const r = this.result;
    if (!r) return '';
    const ct = cityById(r.cityId)!;
    const plan = planFor(r.cityId);
    if (r.kind === 'won') {
      const next = ROUTE[routeIndex(r.cityId) + 1];
      const nextOpen = next && cityLock(this.g, next.id).open;
      // 0.16 (Navid, 19 Nov: "what is that piggy bank?? i have no idea what is that 22$ and what is the star given"):
      // each star says what it is for in words. Star 2 is a big day (best day / the goal), star 3 a first-try catch
      const goal = r.goal ?? plan.bigDay;
      const best = Math.max(0, r.best ?? 0);
      const starRow = [
        `<div class="star-row ok" style="animation-delay: .25s">${ICON.star(true, 26)}<span>${t('Caught the runaway')}</span></div>`,
        `<div class="star-row big-row${r.spare ? ' ok' : ''}" style="animation-delay: .5s">${ICON.star(r.spare, 26)}<span>${t('A big day: {amt}', { amt: money(goal) })}</span>
          <span class="sp-amt">${t('Best: {amt}', { amt: money(best) })}</span></div>`,
        `<div class="star-row try-row${r.firstTry ? ' ok' : ''}" style="animation-delay: .75s">${ICON.star(r.firstTry, 26)}<span>${t('Caught on the first try')}</span></div>`,
      ].join('');
      // the first win's credit says what it is for
      const gains = r.credit
        ? `<button type="button" class="dia dia-btn" data-act="tree" aria-label="${t('Skills')}">${ICON.coin(18)} +${money(r.credit)} <small>${t('for Skills')}</small></button>`
        : '';
      return `<div class="grp mc" style="width: 470px; height: 350px"><div class="st-chip result-card">
        <div class="letter-head"><span class="eyebrow">${t('GRUMBLE &amp; SONS SAVINGS &amp; LOAN')}</span><span class="stamp ok big">${t('PAID IN FULL')}</span></div>
        <h2 class="r-title r-caught">${spriteImg(plan.runaway, 44, cropName(plan.runaway))}<span>${t('Caught: {name}!', { name: esc(t(cropName(plan.runaway))) })}</span><button type="button" class="up-info" data-act="info" data-arg="farm" aria-label="${t('About this farm')}"><i class="info-i">i</i></button></h2>
        <div class="star-rows">${starRow}</div>${plan.bossFight ? this.clearedLine(ct.country) : ''}
        <div class="r-rewards">${
          r.banked > 0
            ? `<span class="r-saved"><b class="money">${money(r.banked)}</b> ${t('in your jar')}</span>`
            : '<canvas class="r-arthur" data-w="140" data-h="56" data-tall="60" data-dx="9" aria-hidden="true"></canvas>'
        }<span class="r-gains">${gains}</span></div>
        <div class="r-actions"><button type="button" class="st-btn blue btn-md flex1" data-act="map" data-arg="${r.cityId}">${t('Map')}</button>
          <button type="button" class="st-btn btn-md flex1" data-act="pen">${t('The Pen')}</button>
          ${nextOpen ? `<button type="button" class="st-btn gold btn-md flex1" data-act="next-city">${t('Next town')}${ICON.next()}</button>` : ''}</div>
      </div></div>`;
    }
    return `<div class="grp mc" style="width: 450px; height: 330px"><div class="st-chip result-card lost">
      <div class="letter-head"><span class="eyebrow">${t('GRUMBLE &amp; SONS SAVINGS &amp; LOAN')}</span><span class="stamp bad big">${t('FORECLOSED')}</span></div>
      <h2 class="r-title">${(this.g.tree || {}).m12 > 0 ? t('The bank took a quarter of your jar.') : t('The bank took half your jar.')}</h2>
      <p class="r-text">${
        r.bossKept && plan.bossFight
          ? t('Dear farmer, {boss} was still sitting on the big bill at sunset. The goat is already a problem.', { boss: esc(t(plan.bossFight.name)) })
          : t('Dear farmer, regarding your {bill}: you were {amt} short. The goat is already a problem.', { bill: esc(inner(t(r.bill || 'bill'))), amt: money(r.short || 0) })
      }</p>
      <p class="r-text">${r.wallet > 0 ? t('You keep your upgrades, your tools and {amt}. Try {farm} again.', { amt: money(r.wallet), farm: esc(ct.short) }) : t('You keep your upgrades and your tools. Try {farm} again.', { farm: esc(ct.short) })}</p>
      <div class="r-actions"><button type="button" class="st-btn blue btn-md flex1" data-act="map" data-arg="${r.cityId}">${t('Map')}</button>
        <button type="button" class="st-btn gold btn-md flex1" data-act="retry" data-arg="${r.cityId}">${t('Try again')}</button></div>
    </div></div>`;
  }

  // ------------------------------------------------------------------ modals

  private openModal(kind: string, inner: string, width = 380): void {
    if (kind !== 'tracks') this.music.setPreview(null);
    this.modal.dataset.kind = kind;
    delete this.modal.dataset.chest;
    this.modal.innerHTML = `<div class="grp mc" style="width: ${width}px; height: 330px"><div class="st-chip modal-card" style="width: ${width}px">${inner}</div></div>`;
    this.modal.hidden = false;
    layout(this.root);
  }

  private closeModal(): void {
    this.modal.hidden = true;
    this.modal.dataset.kind = '';
    delete this.modal.dataset.chest;
    this.music.setPreview(null);
  }

  /** The chest after a bill: tap to open, then pick a perk for this farm (two from a diamond chest). Before it is
   * opened, a rewarded ad can upgrade it once. */
  private showChest(c: ChestInfo, again = false): void {
    if (!c || !c.perks || !c.perks.length) return;
    if (this.scr !== 'farmhouse' && !(this.scr === 'sundown' && this.afterChest === 'day')) this.show('farmhouse');
    this.perkSel = '';
    if (!again && this.modal.dataset.kind === 'perks' && !this.modal.hidden) return;
    const st = engine().state();
    const picks = Math.max(1, c.picks || 1);
    const two = c.tier >= 4;
    const cards = c.perks.map((p, i) => perkCard(p, i, deviceText(p.line), touchy)).join('');
    const up =
      !c.upgraded && c.tier < 4 && canOffer(this.g, 'chest')
        ? `<button type="button" class="st-btn blue btn-md ad-btn chest-up" data-act="ad-chest">${ICON.play()}<span>${t('Upgrade')}</span>${CHEST_UP_ICON}</button>`
        : '';
    const sub = two ? `<p class="chest-sub picks">${picks > 1 ? t('Pick 2') : t('Pick 1 more')}</p>` : '';
    // 0.16: a new chest drops in on a dark stage with turning light (the stage is the modal's, while it is closed)
    const fresh = !again && !(two && picks < 2);
    this.openModal('perks', `<div class="chest-box ch-t${c.tier}${two ? ' two' : ''}${two && picks < 2 ? ' one-left open' : ''}${fresh ? ' arrive' : ''}">
        <div class="chest-head"><span class="eyebrow">${t('BILL {n} OF {m} PAID', { n: st.billsPaid, m: st.billCount })}</span><h2 class="m-title">${esc(t(chestName(c.tier) + '!'))}</h2>${sub}</div>
        <button type="button" class="chest-btn" data-act="chest-open" aria-label="${t('Open the chest')}"><span class="ch-stage">${chestBurst(c.tier)}${chestSvg(c.tier)}</span><span class="chest-tap">${t('Tap to open')}</span></button>
        ${up}
        <div class="chest-cards perk-grid">${cards}</div>
      </div>`, two ? 600 : 480);
    this.modal.dataset.chest = two && picks < 2 ? 'open' : 'closed';
    try {
      navigator.vibrate?.(fresh ? [10, 60, 30] : 10);
    } catch {
      /* no vibration */
    }
    // the first chest (0.16; Navid, 18 Nov: "what is a chest or perk?"): what it is, then the perks, on the things themselves
    if (!this.g.seen.chest && !again && this.coachOn) {
      this.g.seen.chest = true;
      this.save();
      const box = () => this.modal.querySelector<HTMLElement>('.chest-box');
      const perksUp = () => this.modal.hidden || this.modal.dataset.kind !== 'perks';
      void this.coach.tour([
        () => this.coach.wait(900),
        {
          el: () => this.modal.querySelector('.ch-stage'),
          round: true,
          mode: 'press',
          hand: 'tap',
          icon: ICON.chest(36),
          title: t('A chest for paying a bill!'),
          text: t('Every bill you pay brings one. Tap it to open it.'),
          done: () => perksUp() || !!box()?.classList.contains('open') || !!box()?.classList.contains('opening'),
        },
        () => this.coach.wait(1500),
        {
          el: () => (perksUp() ? null : this.modal.querySelector('.chest-cards')),
          title: t('Pick a perk'),
          text: t('A perk helps you on this farm, until you catch its runaway.'),
          done: perksUp,
        },
        {
          el: () => (perksUp() ? null : this.modal.querySelector('.chest-cards')),
          mode: 'press',
          hand: 'tap',
          title: t('Tap a card, then tap it again'),
          text: t('The second tap takes it.'),
          done: () => perksUp() || !!this.modal.querySelector('.perk-card.taken'),
        },
      ]);
    }
  }

  /** Rewarded ad on a closed chest: it shakes, flashes and comes back as a better one. */
  private async adChest(): Promise<void> {
    const box = this.modal.querySelector<HTMLElement>('.chest-box');
    if (this.busy || !box || box.classList.contains('open')) return;
    this.busy = true;
    const ok = await watch(this.g, 'chest');
    this.busy = false;
    if (!ok) {
      this.refreshChestOffer();
      return;
    }
    const c = engine().upgradeChest();
    this.saveNow();
    if (!c) return;
    const still = this.modal.querySelector<HTMLElement>('.chest-box');
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (still && !calm) {
      still.classList.add('upgrading');
      await new Promise(r => setTimeout(r, 900));
    }
    this.showChest(c, true);
    this.modal.querySelector<HTMLElement>('.chest-box')?.classList.add('upgraded');
    try {
      navigator.vibrate?.([20, 40, 30]);
    } catch {
      /* no vibration */
    }
  }

  /** Drops the upgrade button when no ad can be offered any more. */
  private refreshChestOffer(): void {
    if (canOffer(this.g, 'chest')) return;
    this.modal.querySelector('.chest-up')?.remove();
  }

  /** 0.16: the chest rattles and glows for half a second, then the lid flies open with a flash and the cards fly out. */
  private openChest(): void {
    const box = this.modal.querySelector<HTMLElement>('.chest-box');
    if (!box || box.classList.contains('open') || box.classList.contains('opening')) return;
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const open = () => {
      box.classList.remove('opening', 'arrive');
      box.classList.add('open');
      this.modal.dataset.chest = 'open';
      try {
        navigator.vibrate?.([30, 40, 60]);
      } catch {
        /* no vibration */
      }
    };
    if (calm) return open();
    box.classList.add('opening');
    try {
      navigator.vibrate?.([12, 50, 12, 50, 12]);
    } catch {
      /* no vibration */
    }
    setTimeout(() => {
      if (box.isConnected) open();
    }, 520);
  }

  /** The vegetable that joins the field this morning: the one the bill paid last night brought (0.13, the road). */
  private newTodayRow(): string {
    const run = this.g.run;
    if (!run) return '';
    const plan = this.farmPlan(run);
    const e = engine();
    const st = e.state();
    if (st.billsPaid <= 0 || run.stageSeen === st.billsPaid) return '';
    const i = plan.stages.findIndex(x => x.stage === st.billsPaid);
    const stage = plan.stages[i];
    if (!stage) return '';
    const cur = e.stats() as unknown as { dmg: number; vm: number };
    const pay = stage.val * (cur.vm || 1) * cropPay(cropLevel((this.g.cropCuts || {})[stage.type] || 0));
    const hp = stage.hp * plan.hp * (1 + plan.hpDay * Math.max(0, st.day - 1));
    const cuts = Math.max(1, Math.ceil(hp / Math.max(0.01, cur.dmg || 1) - 1e-6));
    return newTodayHtml(stage.type, t(cropName(stage.type)), pay, cuts, money);
  }

  /** Words that live in index.html (the pause card). */
  private localizeStatic(): void {
    const set = (sel: string, txt: string) => {
      const el = document.querySelector(sel);
      if (el) el.textContent = t(txt);
    };
    set('#pauseTitle', 'A little breather.');
    set('#pauseOverlay .pause-card p', 'Your crops can wait. The daylight is paused until you return.');
    set('#btnResume', 'Back to the field');
    set('#btnQuitDay', 'Back to menu');
  }

  /** The language list: each language in its own name. */
  private openLanguages(): void {
    const rows = LANGS.map(
      l => `<button type="button" class="st-btn lang-row${l.id === lang() ? ' gold' : ''}" data-act="lang" data-arg="${l.id}" aria-pressed="${l.id === lang()}" lang="${l.id}">${esc(l.name)}</button>`,
    ).join('');
    this.openModal('languages', `<h2 class="m-title">${GLOBE} ${t('Language')}</h2><div class="lang-list">${rows}</div>
      ${this.langFromSettings
        ? `<div class="m-row"><button type="button" class="st-btn" data-act="settings">${t('Back')}</button><button type="button" class="st-btn gold" data-act="close">${t('Done')}</button></div>`
        : `<button type="button" class="st-btn gold btn-md" data-act="close">${t('Done')}</button>`}`, 360);
  }

  private chooseLang(id: string): void {
    if (!isLang(id)) return;
    this.g.settings.lang = id;
    setLang(id as Lang);
    this.localizeStatic();
    this.saveNow();
    // everything on screen is drawn again in the new language
    if (this.scr !== 'farm') this.render(this.scr);
    this.openLanguages();
  }

  private openSettings(): void {
    const s = this.g.settings;
    let sound = true;
    try {
      sound = engine().state().sound;
    } catch {
      /* ignore */
    }
    const row = (act: string, label: string, onv: boolean) =>
      `<button type="button" class="toggle-row" data-act="${act}" aria-pressed="${onv}"><span class="tg${onv ? ' on' : ''}"><i></i></span>${label}</button>`;
    // a switch and a volume slider on one line (v0.11: Navid wanted the music and the effects set apart)
    const vol = (act: 'music' | 'sound', label: string, onv: boolean, aria: string) => {
      const pct = this.volume(act);
      return `<div class="vol-row">${row(act, label, onv)}<input type="range" class="vol" data-vol="${act}" min="0" max="100" step="5" value="${pct}" style="--p:${pct / 100}" aria-label="${aria}"></div>`;
    };
    // Finger offset (v0.11.1): how far above the finger the sickle sits, so the finger does not hide the crops
    const lift = this.touchLift();
    const liftRow = touchy || (navigator.maxTouchPoints || 0) > 0
      ? `<div class="vol-row lift-row"><span class="vol-k">${t('Finger offset')} <i class="lift-v">${lift ? '' : t('Off')}</i></span><input type="range" class="vol" data-vol="lift" min="0" max="${MAX_TOUCH_LIFT}" step="5" value="${lift}" style="--p:${lift / MAX_TOUCH_LIFT}" aria-label="${t('How far above your finger the sickle cuts')}"></div>`
      : '';
    const ft = trackById(this.music.picked('field')), mt = trackById(this.music.picked('menu'));
    const cur = LANGS.find(l => l.id === lang()) || LANGS[0];
    // the music's state only shows when something is wrong (it helped find a phone that stayed silent)
    const mst = this.music.status(), musicTrouble = /^can't|^starting \(/.test(mst);
    this.openModal('settings', `<h2 class="m-title">${t('Settings')}</h2>
      <button type="button" class="music-row" data-act="languages" data-arg="settings"><span class="mr-k">${GLOBE} ${t('Language')}</span><span class="mr-v"><b>${esc(cur.name)}</b></span>${ICON.next()}</button>
      ${vol('music', t('Music'), s.music, t('Music volume'))}
      <button type="button" class="music-row" data-act="music-picker"><span class="mr-k">${t('Tracks')}</span><span class="mr-v">${t('Field:')} <b>${esc(ft ? ft.title : '')}</b> ${t('· Menus:')} <b>${esc(mt ? mt.title : '')}</b></span>${ICON.next()}</button>
      ${musicTrouble ? `<p class="m-text mus-status">${t('Music now:')} <b>${esc(t(mst))}</b></p>` : ''}
      ${vol('sound', t('Sound effects'), sound, t('Sound effects volume'))}${row('haptics', t('Vibration'), s.haptics)}
      ${liftRow}${touchy || (navigator.maxTouchPoints || 0) > 0 ? row('shakeReport', t('Shake to report a problem'), s.shakeReport !== false) : ''}
      <button type="button" class="st-btn btn-md report-btn" data-act="report">${t('Report a problem')}</button>
      <div class="m-links"><a id="linkPrivacyPolicy" href="https://khoreh.com/due-by-dusk/privacy.html">${t('Privacy policy')}</a>
        <button type="button" class="linkish" id="btnPrivacyChoices" hidden>${t('Privacy choices')}</button>
        <button type="button" class="linkish" data-act="credits">${t('Credits')}</button>
        <button type="button" class="linkish" data-act="replay-story">${t('The story')}</button>
        <button type="button" class="linkish" data-act="replay-practice">${t('Practice farm')}</button>
        <button type="button" class="linkish" data-act="replay-intro">${t('Watch the intro')}</button>
        <button type="button" class="linkish" data-act="reset">${t('Start over')}</button></div>
      <button type="button" class="st-btn gold btn-md" data-act="close">${t('Done')}</button>`);
    window.dispatchEvent(new Event('dbd:privacy-links'));
  }

  private clearedLine(code: CountryCode): string {
    const i = COUNTRIES.findIndex(c => c.code === code);
    const next = COUNTRIES[i + 1];
    const c = countryOf(code);
    if (!next) return `<p class="r-boss">${ICON.crown('#FFC23D', 18)}<span>${t('{country} is cleared. That was the last boss. The bank is speechless.', { country: esc(t(c.name)) })}</span></p>`;
    const lock = countryLock(this.g, next.code);
    const tail = lock.open
      ? t('{country} is open.', { country: esc(t(next.name)) })
      : t('Earn {n} more ★ in {country} to open {next}.', { n: starGate(code) - countryStars(this.g, code), country: esc(t(c.name)), next: esc(t(next.name)) });
    const tool = TOOLS.find(tl => tl.after === code);
    const sale = tool && !this.g.tools.owned.includes(tool.id) ? ` ${t('The {tool} is now for sale in the farmhouse.', { tool: esc(inner(t(tool.name))) })}` : '';
    return `<p class="r-boss">${ICON.crown('#FFC23D', 18)}<span>${t("{country}'s boss is out cold.", { country: esc(t(c.name)) })} ${tail}${sale}</span></p>`;
  }

  private pickTrack(m: Mood, id: string): void {
    if (!trackById(id)) return;
    this.music.pick(m, id);
    if (m === 'field') this.g.settings.fieldTrack = id;
    else this.g.settings.menuTrack = id;
    this.saveNow();
    this.openMusicPicker();
  }

  /** Settings → Tracks: play any track, and choose one for the field and one for the menus. */
  private openMusicPicker(): void {
    const playing = this.music.previewing();
    const rows = TRACKS.map(tk => {
      const f = this.music.picked('field') === tk.id, m = this.music.picked('menu') === tk.id, p = playing === tk.id;
      return `<div class="track-row${p ? ' playing' : ''}">
        <button type="button" class="tr-play" data-act="track-play" data-arg="${tk.id}" aria-label="${p ? t('Stop') : t('Play')} ${esc(tk.title)}">${p ? ICON.pause() : ICON.play()}</button>
        <span class="tr-info"><b>${esc(tk.title)}</b><span>${esc(t(tk.feel))}</span></span>
        <button type="button" class="tr-slot${f ? ' on' : ''}" data-act="track-field" data-arg="${tk.id}" aria-pressed="${f}">${t('Field')}</button>
        <button type="button" class="tr-slot${m ? ' on' : ''}" data-act="track-menu" data-arg="${tk.id}" aria-pressed="${m}">${t('Menus')}</button></div>`;
    }).join('');
    const settingsOff = this.g.settings.music ? '' : `<p class="m-text">${t('Music is switched off in Settings; turn it on to hear your picks while you play.')}</p>`;
    this.openModal('tracks', `<h2 class="m-title">${t('Music')}</h2>${settingsOff}<div class="track-list">${rows}</div>
      <div class="m-row"><button type="button" class="st-btn" data-act="settings">${t('Back')}</button><button type="button" class="st-btn gold" data-act="close">${t('Done')}</button></div>`, 470);
  }

  private openCredits(): void {
    const rows = TRACKS.map(
      t => `<div class="credit-row"><span>“${esc(t.title)}” by ${esc(t.by)}.
        <a href="${LICENCE_URL[t.licence]}" target="_blank" rel="noopener">${esc(t.licence)}</a>${t.changes ? ` · ${esc(t.changes)}` : ''}</span></div>`,
    ).join('');
    this.openModal('credits', `<h2 class="m-title">${t('Credits')}</h2><span class="eyebrow">${t('MUSIC')}</span>${rows}
      <span class="eyebrow">${t('SOUND')}</span><div class="credit-row"><span>“Cartoon Rooster Sounds” by DRAGON-STUDIO (Pixabay). <a href="https://pixabay.com/service/license-summary/" target="_blank" rel="noopener">Pixabay Content License</a> · ${t('Loudness matched and re-encoded.')}</span></div>
      <p class="m-text">${t('Fonts: Lilita One, Nunito, Courier Prime, Figtree and Big Shoulders Stencil, under the SIL Open Font License.')}</p>
      <div class="m-row"><button type="button" class="st-btn" data-act="settings">${t('Back')}</button><button type="button" class="st-btn gold" data-act="close">${t('Done')}</button></div>`, 420);
  }

  /** Report a problem: a small card, then the phone's email app (outside the game) with the game's details; the
   *  player writes what happened there. No typing inside the game: the keyboard covered half the landscape screen
   *  (Navid, 4 Nov). A running day pauses. */
  private openReport(): void {
    try {
      if (engine().state().mode === 'day') engine().setPaused(true);
    } catch {
      /* engine not ready */
    }
    const run = this.g.run;
    const ct = run ? cityById(run.cityId) : null;
    let day: number | undefined;
    try {
      day = run ? engine().state().day : undefined;
    } catch {
      /* engine not ready */
    }
    this.reportPlace = { screen: this.scr, farm: ct?.short, day, lang: lang() };
    this.openModal('report', `<h2 class="m-title">${t('Report a problem')}</h2>
      <p class="m-text">${t('Your email app opens with the game\'s details. Write what happened there and send it.')}</p>
      <div class="m-row"><button type="button" class="st-btn" data-act="close">${t('Cancel')}</button><button type="button" class="st-btn gold" data-act="report-send">${REPORT_EMAIL ? t('Open email') : t('Copy report')}</button></div>`, 400);
  }

  /** What the report email carries under the player's words (also for the tests). */
  reportText(): string {
    return reportDetails(this.reportPlace || { screen: this.scr, lang: lang() });
  }

  private async submitReport(): Promise<void> {
    const details = reportDetails(this.reportPlace || { screen: this.scr, lang: lang() });
    // 0.15.2: the card closes first, and the email app opens once the game has drawn without it, so the game never
    // waits behind the email app with the card still up (the email app opens in its own task: ExternalLinksPlugin)
    this.closeModal();
    await new Promise<void>(res => requestAnimationFrame(() => requestAnimationFrame(() => res())));
    const how = await sendReport(t('What happened?'), details);
    if (how !== 'email') this.toast(how === 'copied' ? t('Report copied. Paste it in a message to the developer.') : t("Couldn't send the report. Please try again."), 3200);
  }

  /** Google Play has a newer version: a pop-up on a menu screen (not during a day), at most once per launch. */
  async offerUpdate(): Promise<void> {
    if (this.updateAsked) return;
    const offer = await checkForUpdate();
    if (!offer) return;
    const tryShow = () => {
      if (this.updateAsked) return;
      let busy = true;
      try {
        busy = engine().state().mode !== 'idle';
      } catch {
        /* engine not ready */
      }
      if (busy || this.scr === 'farm' || this.intro || this.side || !this.modal.hidden) {
        setTimeout(tryShow, 4000);
        return;
      }
      this.updateAsked = true;
      this.updateOffer = offer;
      this.openModal('update', `<h2 class="m-title">${t('A new version is ready!')}</h2>
        <p class="m-text">${t('Update Due by Dusk to enjoy the full experience: the newest farms, fixes and surprises. It only takes a moment, and your farm is saved.')}</p>
        <div class="m-row"><button type="button" class="st-btn" data-act="close">${t('Later')}</button><button type="button" class="st-btn gold" data-act="update-now">${t('Update now')}</button></div>`, 400);
    };
    tryShow();
  }

  /** A small "i" card: words that used to sit on screen all the time. */
  private openInfo(what: string): void {
    const run = this.g.run;
    let txt = '';
    if (what === 'mark' && run && run.own) txt = t('This farm is already yours. Its cash pays its bills and nothing else.');
    else if (what === 'mark' && run)
      txt = t('This farm has paid you {amt} already. Its cash buys upgrades once you hold more than that; your savings always can.', { amt: money(run.mark) });
    const rows = (list: Array<[string, string]>) =>
      `<div class="info-rows">${list.map(([k, v]) => `<div class="ir"><span>${k}</span><b>${v}</b></div>`).join('')}</div>`;
    if (what === 'day' && this.day && run) {
      const d = this.day, p = cityProgress(this.g, run.cityId), b = engine().bill();
      this.openModal('info', `<h2 class="m-title">${t('Today')}</h2>${rows([
        [t('Crops cut'), String(d.today.count)],
        [t('Best chain'), '×' + d.today.best],
        [t('Your best day here:'), money(p.bestDay)],
        [t('Bill'), t('Notice {n} of {m}', { n: b.index + 1, m: b.count })],
      ])}<button type="button" class="st-btn gold btn-md" data-act="close">${t('Got it')}</button>`, 380);
      return;
    }
    const r = this.result;
    if (what === 'farm' && r && r.kind === 'won') {
      this.openModal('info', `<h2 class="m-title">${t('Dear customer, the big bill is paid. We are, frankly, upset.')}</h2>${rows([
        [t('Days'), String(r.days)],
        [t('Earned'), money(r.earned)],
        [t('In your jar'), money(r.banked)],
      ])}<button type="button" class="st-btn gold btn-md" data-act="close">${t('Got it')}</button>`, 400);
      return;
    }
    if (!txt) return;
    this.openModal('info', `<p class="m-text info-text">${ICON.coin(18)} ${txt}</p><button type="button" class="st-btn gold btn-md" data-act="close">${t('Got it')}</button>`, 380);
  }

  private confirmReset(): void {
    this.openModal('confirm', `<h2 class="m-title">${t('Start over?')}</h2>
      <p class="m-text">${t("This wipes every town, star and upgrade on this device. It can't be undone.")}</p>
      <div class="m-row"><button type="button" class="st-btn" data-act="close">${t('Keep my game')}</button><button type="button" class="st-btn red" data-act="reset-yes">${t('Start over')}</button></div>`);
  }

  private resetGame(): void {
    this.g = newGame();
    this.saveNow();
    engine().setShed(this.g.workshop.levels);
    this.toolSel = 'sickle';
    this.applyTool();
    this.applySkills();
    this.applyLook();
    this.music.setEnabled(true);
    engine().setCash(0);
    this.closeModal();
    this.show('menu');
  }
}

/** "him" or "her" from a boss title. */
function pronoun(name: string): string {
  return /^queen\b/i.test(name) ? 'her' : 'him';
}

export function bandRegistry(): Record<string, { url: string }> {
  const out: Record<string, { url: string }> = {};
  for (const [k, url] of Object.entries(BAND)) out['band_' + (k.length === 2 ? k.toUpperCase() : k)] = { url };
  return out;
}

export type { CityPlan };
