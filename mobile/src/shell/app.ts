// The game around the field: menu, world and country maps, the farmhouse between days, sundown,
// won and lost screens, the workshop, settings. Gemini's engine runs the days; this file runs the game.

import { COUNTRIES, ROUTE, type CountryCode, cityById, countryOf, isBossCity, routeIndex } from '../game/world';
import { cropName, planFor, toughnessFor, type CityPlan } from '../game/plan';
import { bestPower } from '../game/power';
import {
  GAME_SAVE_KEY, bankAfterWin, cityLock, cityProgress, countryLock, countryStars, crownCount, newGame, nextCity, paidAfterRun,
  parseGame, spendableFarmCash, starGate, starsFor, todayKey, toolLock, totalStars, type GameSave, type RunInfo,
} from '../game/progress';
import { diamondsLeft, learn, resetSkills, skillDef } from '../game/skills';
import { FLAIR, buyFlair, equipFlair, flairById, lookFor, ribbonsForWin, type FlairKind } from '../game/flair';
import { DAILY_AD_TRIES, MEDAL_NAME, MEDAL_RIBBONS, dailyFor, duelFor, medalOf, newDaily, sidePlan, triesLeft, type SideDef } from '../game/daily';
import { SHED_FX, UPGRADES, formatDuration, settleJob, startUpgrade, upgradeCost, upgradeDuration, type UpgradeId } from '../game/workshop';
import { TOOLS, isToolId, modCost, modLevel, toolDef, toolStats, toolSummary, type ToolId } from '../game/tools';
import { ART, BAND, MAP, NODES, PREVIEW, SPRITE, bandFor, spriteImg } from './art';
import { $, ICON, TOOL_ICON, cap, clamp, esc, money, stars } from './dom';
import { engine, on, type BillInfo, type ChestInfo, type DayEvent, type EngineState, type Today } from './engine';
import { CHEST_UP_ICON, chestBurst, chestName, chestSvg, newCropHtml, perkCard, perkIcon } from './chest';
import { rivalFace } from './rival';
import { FarmHud, deviceText, eventIcon, touchy } from './hud';
import { Coach, peek, type FieldPeek, type Pt } from './coach';
import { LANGS, deviceLang, isLang, lang, setLang, t, tn, tx, type Lang } from '../i18n/i18n';
import { watchLayout, layout } from './layout';
import { adsAvailable, canOffer, coinsWait, onAdsChanged, watch } from './offers';
import { PINS } from './pins';
import { LICENCE_URL, Music, TRACKS, trackById, type Mood } from './music';
import {
  barnHtml, calendarIcon, dailyHtml, duelCities, duelHtml, duelIcon, firstSkill, sideResultHtml, skillMapHtml,
  type DuelSetup, type SideOutcome,
} from './extras';
import { ribbonIcon } from './looks';

type Screen = 'menu' | 'world' | 'country' | 'farmhouse' | 'farm' | 'sundown' | 'won' | 'lost' | 'skills' | 'barn' | 'daily' | 'duel' | 'side';

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

/** Ribbons for finishing duels, at most this many a day. */
const DUEL_RIBBONS_PER_DAY = 2;

interface DayResult {
  day: number;
  today: Today;
  event: DayEvent | null;
  crownToday: boolean;
  doubled: boolean;
}

interface CityResult {
  kind: 'won' | 'lost';
  cityId: string;
  stars: number;
  spare: boolean;
  crown: boolean;
  firstWin: boolean;
  diamonds: number;
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
  private fhTab: 'workshop' | 'tools' | 'perks' | 'bills' = 'workshop';
  private toolSel: ToolId = 'sickle';
  private day: DayResult | null = null;
  private result: CityResult | null = null;
  private pendingEvent: DayEvent | null = null;
  private busy = false;
  private saveT = 0;
  private music: Music;
  private skillSel = '';
  private barnTab: FlairKind = 'finish';
  private barnSel = '';
  private side: SideRun | null = null;
  /** The intro (first Play): a boss finale played by the ghost finger on a side farm. */
  private intro: { snap: string; sound: boolean; ending: boolean; down: boolean; at: Pt | null } | null = null;
  private coach = new Coach();
  /** Charge Cleaves struck since launch (the cleave lesson watches it). */
  private cleaves = 0;
  /** No new field moment before this time (ms). */
  private momentCool = 0;
  /** Where the skill map and the Bling Barn go back to. */
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
    for (const s of ['menu', 'world', 'country', 'farmhouse', 'sundown', 'won', 'lost', 'skills', 'barn', 'daily', 'duel', 'side']) {
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
    this.hud = new FarmHud($('stage'), () => this.toggleSound());
    this.hud.onRivalBeaten = () => {
      try {
        navigator.vibrate?.([30, 40, 70]);
      } catch {
        /* no vibration */
      }
      if (!this.coach.busy && this.coachOn) void this.coach.momentEl(() => document.getElementById('dbdRival'), t('Crown!'), 1300, 0.35);
    };
    this.root.addEventListener('click', e => this.click(e));
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
    // v0.10 rebuilt the workshop and the farms: old upgrades were refunded, and an old farm's cash is saved too
    if (this.g.migratedRefund != null) {
      let farmCash = 0;
      if (this.g.migratedFarm) {
        const st = e.state();
        if (!st.won && !st.lost) farmCash = Math.max(0, Math.round(st.cash));
      }
      this.g.wallet += farmCash;
      const back = this.g.migratedRefund + farmCash;
      delete this.g.migratedRefund;
      delete this.g.migratedFarm;
      e.setShed(this.g.workshop.levels);
      this.saveNow();
      if (back > 0) setTimeout(() => this.toast(t('New workshop and longer farms: {amt} back in your savings.', { amt: money(back) })), 900);
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

  private tick(): void {
    if (this.settleWorkshop() && (this.scr === 'farmhouse' || this.modal.dataset.kind === 'workshop')) this.refresh();
    else if (this.g.workshop.job && this.scr === 'farmhouse' && this.fhTab === 'workshop') this.updateJobBar();
  }

  /** Finishes a workshop job whose time is up; returns true when one finished. */
  private settleWorkshop(force = false): boolean {
    const job = settleJob(this.g.workshop, Date.now(), force);
    if (!job) return false;
    engine().setShed(this.g.workshop.levels);
    this.save();
    const def = UPGRADES.find(u => u.id === job.id);
    if (def) this.toast(t('{name} {level} is ready.', { name: t(def.name), level: job.level }));
    return true;
  }

  // ------------------------------------------------------------------ engine events

  private wireEngine(): void {
    on('dayStart', d => {
      this.pendingEvent = d.event;
      this.day = null;
      if (this.intro) {
        this.hud.setRival(null);
        this.hud.dayStarted(d.event, true);
        return;
      }
      this.hud.setRival(this.rivalToday());
      // a lesson keeps the day's event banner out of its way
      const lesson = !this.side && !!this.g.run && this.dayLessons();
      this.hud.dayStarted(d.event, lesson);
    });
    on('cleave', () => this.cleaves++);
    on('bossDown', () => {
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
      const plan = planFor(run.cityId);
      const p = (this.g.cities[run.cityId] ||= { ...cityProgress(this.g, run.cityId) });
      const earned = Math.round(d.today.earned);
      p.bestDay = Math.max(p.bestDay, earned);
      run.bestDay = Math.max(run.bestDay, earned);
      const crownToday = !p.crown && earned >= plan.record;
      if (crownToday) {
        p.crown = true;
        this.g.ribbons += ribbonsForWin(0, 0, true, false);
      }
      this.g.totals.days++;
      this.g.totals.crops += d.today.count;
      this.g.totals.earned += d.today.earned;
      this.day = { day: d.day, today: d.today, event: this.pendingEvent, crownToday, doubled: false };
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
    const run = this.g.run;
    if (!run) return;
    const plan = planFor(run.cityId);
    const p = (this.g.cities[run.cityId] ||= { ...cityProgress(this.g, run.cityId) });
    const firstWin = !p.won;
    const res = starsFor({ won: true, cashLeft: d.cash, spare: plan.spare, crown: p.crown });
    const ribbons = ribbonsForWin(p.stars, res.stars, false, firstWin && plan.boss);
    this.g.ribbons += ribbons;
    p.won = true;
    p.stars = Math.max(p.stars, res.stars);
    p.bestDays = p.bestDays ? Math.min(p.bestDays, d.days) : d.days;
    let diamonds = 0;
    if (firstWin) diamonds = plan.boss ? 2 : 1;
    if (diamonds) engine().addDiamonds(diamonds);
    // what is left on the farm after the deed goes into savings, but only above what this farm had already paid you
    const banked = bankAfterWin(run, d.cash);
    this.g.wallet += banked;
    p.paid = paidAfterRun(run, banked);
    this.g.run = null;
    this.result = {
      kind: 'won', cityId: run.cityId, stars: res.stars, spare: res.spare, crown: p.crown, firstWin, diamonds, ribbons,
      days: d.days, earned: d.earned, harvested: d.harvested, wallet: this.g.wallet, banked, mark: run.mark, kept: Math.round(d.cash),
    };
    this.saveNow();
    this.show('won');
  }

  private foreclosed(d: { bill: string; short: number; days: number; cash: number; bossKept?: boolean }): void {
    const run = this.g.run;
    if (!run) return;
    // the bank keeps the farm and its cash; savings are untouched. Upgrades bought with its cash count as paid out
    const left = this.g.wallet;
    const p = (this.g.cities[run.cityId] ||= { ...cityProgress(this.g, run.cityId) });
    p.paid = paidAfterRun(run, 0);
    this.g.run = null;
    this.result = {
      kind: 'lost', cityId: run.cityId, stars: 0, spare: false, crown: false, firstWin: false, diamonds: 0,
      days: d.days, earned: 0, harvested: 0, wallet: left, banked: 0, mark: run.mark, short: d.short, bill: d.bill, bossKept: !!d.bossKept,
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
    this.music.setMood(s === 'farm' ? 'field' : 'menu');
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
      if (!chest) this.pointAtStart();
    }
    // the first ribbons and diamond: where they go
    if (s === 'won' && this.result && (this.result.ribbons || this.result.diamonds) && !this.g.seen.gains && this.coachOn) {
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
    if (!this.modal.hidden && this.modal.dataset.kind === 'workshop') this.renderWorkshopModal();
    layout(this.root);
  }

  private render(s: Screen): void {
    const el = this.sections[s];
    if (!el) return;
    if (s === 'menu') el.innerHTML = this.menuHtml();
    else if (s === 'world') el.innerHTML = this.worldHtml();
    else if (s === 'country') el.innerHTML = this.countryHtml();
    else if (s === 'farmhouse') el.innerHTML = this.farmhouseHtml();
    else if (s === 'sundown') el.innerHTML = this.sundownHtml();
    else if (s === 'won' || s === 'lost') el.innerHTML = this.resultHtml();
    else if (s === 'skills') el.innerHTML = skillMapHtml(this.g, this.skillSel || firstSkill(this.g));
    else if (s === 'barn') el.innerHTML = barnHtml(this.g, this.barnTab, this.barnSel, canOffer(this.g, 'ribbon'));
    else if (s === 'daily') el.innerHTML = this.backdrop() + this.dailyScreen();
    else if (s === 'duel') el.innerHTML = this.backdrop() + this.duelScreen();
    else if (s === 'side') el.innerHTML = this.backdrop() + (this.sideOut ? sideResultHtml(this.sideOut) : '');
    if (s === 'world') this.openClouds();
    this.syncSoundButtons();
    // every re-render (a country pin, a city node, a tab) must re-apply the art scaling
    layout(this.root);
  }

  // ------------------------------------------------------------------ clicks

  private click(e: Event): void {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!t || t.hasAttribute('disabled')) return;
    const act = t.dataset.act || '', arg = t.dataset.arg || '';
    this.music.unlock();
    try {
      engine().initAudio();
    } catch {
      /* not ready */
    }
    switch (act) {
      case 'go': this.show(arg as Screen); break;
      case 'play': this.play(); break;
      case 'continue': this.continueGame(); break;
      case 'country': this.worldSel = arg as CountryCode; this.render('world'); break;
      case 'enter': this.countrySel = arg as CountryCode; this.citySel = this.firstCityToShow(arg as CountryCode); this.show('country'); break;
      case 'city': this.citySel = arg; this.render('country'); break;
      case 'farm': this.farmHere(arg); break;
      case 'start': this.startDay(); break;
      case 'pay': this.payBill(); break;
      case 'bank': this.faceBank(); break;
      case 'tab': this.fhTab = arg as typeof this.fhTab; this.render('farmhouse'); break;
      case 'buy': this.buy(arg as UpgradeId); break;
      case 'tool': if (isToolId(arg)) { this.toolSel = arg; this.render('farmhouse'); } break;
      case 'equip': this.equip(arg); break;
      case 'buy-tool': this.buyTool(arg); break;
      case 'buy-mod': this.buyMod(arg); break;
      case 'credits': this.openCredits(); break;
      case 'music-picker': this.openMusicPicker(); break;
      case 'track-play': this.music.setPreview(this.music.previewing() === arg ? null : arg); this.openMusicPicker(); break;
      case 'track-field': this.pickTrack('field', arg); break;
      case 'track-menu': this.pickTrack('menu', arg); break;
      case 'perk': this.pickPerk(arg, t); break;
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
      case 'languages': this.openLanguages(); break;
      case 'lang': this.chooseLang(arg); break;
      case 'crowns': this.openCrowns(); break;
      case 'workshop': this.openWorkshopModal(); break;
      case 'sound': this.toggleSound(); break;
      case 'music': this.g.settings.music = !this.g.settings.music; this.save(); this.music.setEnabled(this.g.settings.music); this.openSettings(); break;
      case 'haptics': this.g.settings.haptics = !this.g.settings.haptics; this.save(); this.openSettings(); window.dispatchEvent(new CustomEvent('dbd:haptics', { detail: this.g.settings.haptics })); break;
      case 'close': this.closeModal(); break;
      case 'reset': this.confirmReset(); break;
      case 'reset-yes': this.resetGame(); break;
      case 'leave-yes': this.leaveRunAndStart(arg); break;
      case 'skills': this.backTo = this.scr === 'skills' || this.scr === 'barn' ? this.backTo : this.scr; this.skillSel = firstSkill(this.g); this.show('skills'); break;
      case 'back': this.show(this.backTo); break;
      case 'skill': this.skillSel = arg; this.render('skills'); break;
      case 'skill-learn': this.learnSkill(arg); break;
      case 'skill-reset': this.resetAllSkills(); break;
      case 'barn': this.backTo = this.scr === 'skills' || this.scr === 'barn' ? this.backTo : this.scr; this.barnSel = this.g.flair.equipped[this.barnTab]; this.show('barn'); break;
      case 'barn-tab': this.barnTab = arg as FlairKind; this.barnSel = this.g.flair.equipped[this.barnTab]; this.render('barn'); break;
      case 'barn-pick': this.barnSel = arg; this.render('barn'); break;
      case 'barn-buy': this.barnBuy(arg); break;
      case 'barn-equip': this.barnEquip(arg); break;
      case 'ad-ribbon': void this.adRibbon(); break;
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

  private continueGame(): void {
    if (this.g.run) {
      this.citySel = this.g.run.cityId;
      this.show('farmhouse');
      return;
    }
    this.showCountryOf(nextCity(this.g));
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
    if (this.g.run && this.g.run.cityId === cityId) {
      this.show('farmhouse');
      return;
    }
    if (this.g.run) {
      const cur = cityById(this.g.run.cityId)!;
      this.openModal('confirm', `<h2 class="m-title">${t('Leave {farm}?', { farm: esc(cur.short) })}</h2>
        <p class="m-text">${t('The bank keeps that farm and the cash on it. Your savings, tools and upgrades stay yours.')}</p>
        <div class="m-row"><button type="button" class="st-btn" data-act="close">${t('Stay')}</button><button type="button" class="st-btn gold" data-act="leave-yes" data-arg="${cityId}">${t('Leave and start {farm}', { farm: esc(cityById(cityId)!.short) })}</button></div>`);
      return;
    }
    this.beginRun(cityId);
  }

  private leaveRunAndStart(cityId: string): void {
    const old = this.g.run;
    if (old) {
      // the farm's cash stays with the bank; savings are untouched; upgrades bought with its cash count as paid out
      const p = (this.g.cities[old.cityId] ||= { ...cityProgress(this.g, old.cityId) });
      p.paid = paidAfterRun(old, 0);
      this.g.run = null;
    }
    this.closeModal();
    this.beginRun(cityId);
  }

  /** The plan the engine plays: the city's plan with crops as tough as this run's build calls for. */
  private farmPlan(run: RunInfo): CityPlan {
    const plan = planFor(run.cityId);
    return run.tough && run.tough !== 1 ? { ...plan, hp: plan.hp * run.tough } : plan;
  }

  private beginRun(cityId: string): void {
    const tools = this.g.tools.owned.map(id => toolStats(this.g.tools, id));
    // crops are tougher for a build ahead of the route and softer for one behind it (set once, when the farm starts)
    const tough = toughnessFor(routeIndex(cityId), bestPower(this.g.workshop.levels, tools, this.g.skills));
    const p = (this.g.cities[cityId] ||= { ...cityProgress(this.g, cityId) });
    const run: RunInfo = { cityId, startCash: 0, startedAt: Date.now(), bestDay: 0, mark: p.paid || 0, spent: 0, tough };
    const plan = this.farmPlan(run);
    // every farm starts with an empty cash box: its bills are paid from its own harvest
    const ok = engine().beginCity({ cityId, country: plan.country, cash: 0, shed: this.g.workshop.levels, plan, tools });
    if (!ok) return;
    this.g.run = run;
    p.plays++;
    this.citySel = cityId;
    this.fhTab = 'workshop';
    this.saveNow();
    this.show('farmhouse');
  }

  private startDay(): void {
    if (!this.g.run) return;
    const e = engine();
    if (e.state().pendingPerks) return;
    if (!this.g.seen.start) {
      this.g.seen.start = true;
      this.coach.cancel();
    }
    this.show('farm');
    if (!e.startDay()) this.show('farmhouse');
  }

  // ------------------------------------------------------------------ the coach: showing, not telling

  /** Tests can turn the coach off (window.__DBD_NO_COACH). */
  private get coachOn(): boolean {
    return !(window as unknown as { __DBD_NO_COACH?: boolean }).__DBD_NO_COACH;
  }

  /** Play on the menu: a new player first watches the intro, then lands on the first farm. */
  private play(): void {
    const fresh = this.coachOn && !this.g.seen.intro && !this.g.run && this.g.totals.days === 0 && totalStars(this.g) === 0;
    if (fresh) void this.playIntro();
    else this.show('world');
  }

  /** The intro (Navid, 30 Oct): the last seconds of a boss farm, played by the ghost finger. The boss falls to a
   * Charge Cleave, the deed is paid, and the player lands on their own first farm. */
  private async playIntro(): Promise<void> {
    const e = engine();
    if (this.side || this.intro || e.state().mode !== 'idle') return this.show('world');
    this.g.seen.intro = true;
    this.saveNow();
    const snap = e.snapshot();
    const sound = e.state().sound;
    const cityId = 'ca_kelowna';
    const plan = planFor(cityId);
    const levels = { scythe: 16, swing: 6, hands: 10, days: 2, soil: 8, market: 2, clover: 6 };
    const tool = toolStats({ owned: ['scythe'], equipped: 'scythe', mods: {} }, 'scythe');
    e.setSaving(false);
    e.setFieldSeed(20261030);
    e.setSkills([]);
    e.setTool(tool);
    if (!e.beginCity({ cityId, country: plan.country, cash: 0, shed: levels, plan, tools: [tool] })) {
      this.restoreFarm(snap, sound);
      return this.show('world');
    }
    this.intro = { snap, sound, ending: false, down: false, at: null };
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
      // the finisher: a second finger charges a Charge Cleave and lets go
      if (!it.down) {
        const q = at() || start;
        const p2 = { x: Math.min(innerWidth - 80, q.x + 250), y: Math.min(innerHeight - 70, q.y + 80) };
        co.showHand(1, { x: p2.x + 70, y: p2.y + 80 });
        await co.glide(1, p2, 320);
        co.press(1);
        await chase(700);
        co.lift(1);
        co.hideHand(1);
      }
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
    if (!this.g.run && cityLock(this.g, first).open) this.beginRun(first);
    else this.show('world');
  }

  /** The Start button gets a finger until it is pressed (first farm only). */
  private pointAtStart(): void {
    if (this.g.seen.start || this.coach.busy || !this.coachOn) return;
    const btn = () => this.sections.farmhouse.querySelector('[data-act="start"]');
    void this.coach.point(btn, t('Start'), () => this.scr !== 'farmhouse' || !this.modal.hidden);
  }

  /** Lessons at the start of a day on a real farm: cutting (a new player's first day), then the Charge Cleave.
   * Returns whether one started. */
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
    if (!seen.cleave && (st.day >= 2 || this.g.totals.days >= 1)) {
      const tries = seen.cleave2 ? 3 : seen.cleave1 ? 2 : 1;
      if (tries === 1) seen.cleave1 = true;
      else if (tries === 2) seen.cleave2 = true;
      this.save();
      this.momentCool = performance.now() + 16000;
      void this.coach.cleaveLesson(() => this.cleaves).then(ok => {
        if (ok || tries >= 2) seen.cleave = true;
        this.save();
      });
      return true;
    }
    return false;
  }

  /** The rival on today's HUD: the city's record holder, until the player takes the crown. */
  private rivalToday(): { name: string; record: number } | null {
    const run = this.g.run;
    if (this.side || !run) return null;
    const ct = cityById(run.cityId);
    if (!ct || cityProgress(this.g, run.cityId).crown) return null;
    return { name: ct.rival, record: planFor(run.cityId).record };
  }

  /** First sights on the field: slow motion and a spotlight that follows the thing (once each). */
  private watchField(now: number): void {
    if (this.scr !== 'farm' || this.side || this.intro || this.coach.busy || now < this.momentCool || !this.coachOn) return;
    const p = peek();
    if (!p || p.mode !== 'day' || p.time < 2) return;
    const seen = this.g.seen;
    const co = this.coach;
    const show = (key: string, find: () => Pt | null, word: string, r = 64) => {
      if (!find()) return false;
      seen[key] = true;
      this.save();
      this.momentCool = now + 6000;
      void co.moment(find, word, 1500, r);
      return true;
    };
    // something that moves is followed by matching the nearest one of its kind to where it was last
    const follow = (list: () => Array<{ x: number; y: number }>, lift = 0) => {
      let last: { x: number; y: number } | null = null;
      return (): Pt | null => {
        const all = list();
        if (!all.length) return null;
        let best = all[0];
        if (last) {
          let bd = Infinity;
          for (const a of all) {
            const d = Math.hypot(a.x - last.x, a.y - last.y);
            if (d < bd) {
              bd = d;
              best = a;
            }
          }
        }
        last = best;
        return co.toScreen(best.x, best.y - lift);
      };
    };
    const live = (pred: (c: FieldPeek['crops'][number]) => boolean) => () =>
      (peek()?.crops || []).filter(c => !c.dead && c.age > 0.4 && pred(c)).map(c => ({ x: c.x, y: c.y - c.r * c.ds * 0.55 }));
    if (!seen.mBoss && show('mBoss', follow(live(c => c.boss)), t('Knock it out!'), 110)) return;
    if (!seen.mRadish && show('mRadish', follow(live(c => c.type === 'radish')), t('It runs!'))) return;
    if (!seen.mGolden && show('mGolden', follow(() => peek()?.lucky || []), t('Golden!'))) return;
    const treaty = engine().state().perks.includes('treaty') || this.g.skills.includes('gold_treaty') || this.g.skills.includes('gold_herd');
    if (!seen.mGoat && !treaty && show('mGoat', follow(() => (peek()?.goat ? [peek()!.goat!] : []), 20), t("Don't touch!"), 70)) return;
    if (!seen.mGoatPet && treaty && show('mGoatPet', follow(() => (peek()?.goat ? [peek()!.goat!] : []), 20), t('Pet it: tips!'), 70)) return;
    if (!seen.mCrow && show('mCrow', follow(() => peek()?.crows || []), t('Shoo it!'))) return;
    if (!seen.mProp && show('mProp', follow(() => peek()?.props || []), t('Grab it!'))) return;
    if (!seen.mBolt && p.bolts > 0 && show('mBolt', () => co.toScreen(p.pointer.x, p.pointer.y), t('Lightning!'), 90)) return;
    // the HUD: the rival's record, the chain bonus, a harvest rush
    const hud = (key: string, id: string, word: string) => {
      const el = document.getElementById(id);
      if (!el || (el as HTMLElement).hidden || el.classList.contains('beaten')) return false;
      seen[key] = true;
      this.save();
      this.momentCool = now + 6000;
      void co.momentEl(() => document.getElementById(id), word);
      return true;
    };
    const h = engine().hud();
    const rv = this.rivalToday();
    if (!seen.mRival && rv && p.today.earned > 0 && p.time < 15 && hud('mRival', 'dbdRival', t('Beat {amt} today', { amt: money(rv.record) }))) return;
    if (!seen.mChain && h.tiers.length > 1 && h.combo >= h.tiers[1].count && hud('mChain', 'dbdChain', t('Chain bonus!'))) return;
    if (!seen.mRush && h.rushT > 0 && hud('mRush', 'dbdRush', t('Rush!'))) return;
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
        btn?.classList.add('taken');
        btn?.setAttribute('aria-disabled', 'true');
        const sub = box.querySelector('.chest-sub');
        if (sub) sub.textContent = t('Pick 1 more');
        return;
      }
      this.closeModal();
      this.render('farmhouse');
      if (info) this.toast(`${t(info.name)}: ${t(deviceText(info.line))}`);
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
      if (!run || rest > spendableFarmCash(run, this.farmCash()) || !engine().spendCash(rest)) return false;
      run.spent += rest;
    }
    this.g.wallet -= fromSavings;
    return true;
  }

  private buy(id: UpgradeId): void {
    const e = engine();
    const res = startUpgrade(this.g.workshop, id, Date.now(), cost => this.spend(cost));
    if (res.ok) {
      if (res.instant) e.setShed(this.g.workshop.levels);
      this.saveNow();
    }
    this.refresh();
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

  private coinsReward(): number {
    const cityId = this.g.run ? this.g.run.cityId : nextCity(this.g);
    const p = planFor(cityId);
    return Math.max(20, Math.round((p.dayRef * p.billMul * 0.6) / 10) * 10);
  }

  private async adCoins(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const ok = await watch(this.g, 'coins');
    this.busy = false;
    if (ok) {
      // free coins always go to savings (for upgrades and tools), whatever farm you are on
      const amt = this.coinsReward();
      this.g.wallet += amt;
      this.toast(t('+{amt} in your savings.', { amt: money(amt) }));
      this.saveNow();
    }
    this.refresh();
  }

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
    const ok = await watch(this.g, 'extraDay');
    this.busy = false;
    if (ok && engine().extraDay()) this.toast(t('One more day. The bank can wait until tomorrow.'));
    this.save();
    this.refresh();
  }

  // ------------------------------------------------------------------ skills and looks

  private applySkills(): void {
    try {
      engine().setSkills(this.g.skills);
    } catch {
      /* engine not ready yet; start() applies them */
    }
  }

  private applyLook(): void {
    (window as any).__DBD_LOOK = lookFor(this.g.flair);
  }

  private learnSkill(id: string): void {
    if (!learn(this.g, id)) return;
    this.applySkills();
    this.saveNow();
    const d = skillDef(id);
    if (d) this.toast(`${d.name} learned.`);
    this.render('skills');
  }

  private resetAllSkills(): void {
    if (!this.g.skills.length) return;
    resetSkills(this.g);
    this.applySkills();
    this.saveNow();
    this.toast(t('Skills reset. Every diamond is back.'));
    this.skillSel = firstSkill(this.g);
    this.render('skills');
  }

  private barnBuy(id: string): void {
    const res = buyFlair(this.g.flair, this.g.ribbons, id);
    if (!res.ok) return;
    this.g.ribbons -= res.cost;
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

  private async adRibbon(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const ok = await watch(this.g, 'ribbon');
    this.busy = false;
    if (ok) {
      this.g.ribbons += 1;
      this.toast('+1 ribbon.');
      this.saveNow();
    }
    this.refresh();
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
    return dailyHtml(def, st, triesLeft(st), st.adPlays < DAILY_AD_TRIES && canOffer(this.g, 'daily'));
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
      this.sideOut = { kind: 'daily', score, def: sr.def, medal: 0, newMedal: false, ribbons: 0, diamond: false, tries: triesLeft(this.g.daily), adTry: false };
    } else if (sr.kind === 'daily') {
      const st = this.dailyState();
      const before = st.medal;
      st.best = Math.max(st.best, score);
      const medal = medalOf(sr.def.targets, st.best);
      const ribbons = Math.max(0, MEDAL_RIBBONS[medal] - MEDAL_RIBBONS[before]);
      st.medal = medal;
      this.g.ribbons += ribbons;
      let diamond = false;
      if (medal >= 3 && !st.goldDiamond) {
        st.goldDiamond = true;
        this.g.bonusDiamonds += 1;
        diamond = true;
      }
      this.sideOut = {
        kind: 'daily', score, def: sr.def, medal, newMedal: medal > before, ribbons, diamond,
        tries: triesLeft(st), adTry: st.adPlays < DAILY_AD_TRIES && canOffer(this.g, 'daily'),
      };
    } else {
      const du = this.duel;
      if (!du) return this.show('menu');
      du.scores[sr.turn] = score;
      if (sr.turn === 0) this.sideOut = { kind: 'duel-pass', score, def: sr.def, scores: [...du.scores] as [number, number], names: du.names };
      else {
        const today = todayKey();
        if (this.g.duelDay.date !== today) this.g.duelDay = { date: today, rewarded: 0 };
        const ribbons = this.g.duelDay.rewarded < DUEL_RIBBONS_PER_DAY ? 1 : 0;
        this.g.duelDay.rewarded += ribbons;
        this.g.ribbons += ribbons;
        this.sideOut = { kind: 'duel-end', score, def: sr.def, scores: [...du.scores] as [number, number], names: du.names, ribbons };
      }
    }
    this.saveNow();
    this.show('side');
  }

  // ------------------------------------------------------------------ sound

  private toggleSound(): void {
    const e = engine();
    e.setSound(!e.state().sound);
    this.hud.syncSound(e.state().sound);
    this.syncSoundButtons();
    if (!this.modal.hidden && this.modal.dataset.kind === 'settings') this.openSettings();
  }

  private syncSoundButtons(): void {
    let on = true;
    try {
      on = engine().state().sound;
    } catch {
      /* engine not ready */
    }
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

  /** A shortcut to the skill map while diamonds are waiting to be spent. */
  private gemChip(): string {
    const n = diamondsLeft(this.g);
    return n ? `<button type="button" class="st-chip chip-row gem-chip" data-act="skills" aria-label="${n} diamonds to spend on the skill map">${ICON.diamond(20)}<span>${n}</span><small>${t('Skills')}</small></button>` : '';
  }

  private walletChip(): string {
    // between farms: savings (for upgrades and tools); on a farm: the farm's cash (for its bills), then savings
    if (!this.g.run)
      return `<div class="st-chip chip-row wallet-chip save-chip" aria-label="Savings ${money(this.g.wallet)}, for upgrades and tools">${ICON.piggy(22)}<span>${money(this.g.wallet)}</span></div>`;
    const save = this.g.wallet > 0 ? `<i class="wc-sep"></i>${ICON.piggy(18)}<span class="wc-save">${money(this.g.wallet)}</span>` : '';
    return `<div class="st-chip chip-row wallet-chip" aria-label="${t('Cash on this farm {amt}', { amt: money(this.farmCash()) })}${save ? `, ${t('savings {amt}', { amt: money(this.g.wallet) })}` : ''}">${ICON.coin(22)}<span>${money(this.farmCash())}</span>${save}</div>`;
  }

  // ------------------------------------------------------------------ menu

  private menuHtml(): string {
    const next = cityById(nextCity(this.g))!;
    const n = routeIndex(next.id) + 1;
    const cont = this.g.run
      ? t('Continue · {farm} · Day {day}', { farm: esc(next.short), day: engine().state().day })
      : t('Next · Farm {n} · {farm}', { n, farm: esc(next.short) });
    const dl = this.dailyState();
    const dailyMark = dl.medal ? `<i class="side-mark medal">${t(MEDAL_NAME[dl.medal]).charAt(0)}</i>` : dl.plays ? '' : `<i class="side-mark">${t('NEW')}</i>`;
    const gems = diamondsLeft(this.g);
    return `<div class="bg cover"><img class="art" src="${ART.menu}" alt="">
        ${this.menuSprite('lavender', 96, 230, 70, 'bob2')}${this.menuSprite('pei_russet', 168, 268, 100, 'bob')}
        ${this.menuSprite('carrot', 566, 238, 62, 'bob2')}${this.menuSprite('artichaut', 418, 270, 100, 'bob')}
        ${this.menuSprite('golden', 640, 252, 72, 'bob2')}${this.menuSprite('pumpkin', 700, 222, 100, 'bob')}</div>
      <div class="grp tc" style="width: 600px; height: 380px">
        <div class="menu-title"><h1 class="ink-title">${t('Due by Dusk')}</h1><p class="pill-dark">${t('A little farm. A very big debt.')}</p></div>
        <div class="menu-actions">
          <div class="menu-row">
            <button type="button" class="st-btn side-btn" data-act="daily">${calendarIcon(26)}<span>${t('Daily farm')}</span>${dailyMark}</button>
            <button type="button" class="st-btn gold big-play" data-act="play">${ICON.play()}${t('Play')}</button>
            <button type="button" class="st-btn side-btn" data-act="duel">${duelIcon(26)}<span>${t('Duel')}</span></button>
          </div>
          <button type="button" class="pill-cream" data-act="continue">${cont}</button>
        </div>
      </div>
      <div class="grp bl" style="width: 200px; height: 64px"><div class="corner-row">
        <button type="button" class="st-btn st-sq" data-act="settings" aria-label="${t('Settings')}">${ICON.gear()}</button>
        <button type="button" class="st-btn st-sq lang-btn" data-act="languages" aria-label="${t('Language')}">${GLOBE}<span>${lang().toUpperCase()}</span></button>
        <button type="button" class="st-btn st-sq" data-act="sound" aria-label="${t('Sound')}">${ICON.sound()}</button></div></div>
      <div class="grp br" style="width: 300px; height: 80px"><div class="dock">
        <button type="button" class="st-btn dock-btn" data-act="skills">${ICON.diamond(24)}<span>${t('Skills')}</span>${gems ? `<i class="dock-badge">${gems}</i>` : ''}</button>
        <button type="button" class="st-btn dock-btn" data-act="barn">${ribbonIcon(26)}<span>${t('Bling Barn')}</span></button>
        <button type="button" class="st-btn blue dock-btn" data-act="crowns">${ICON.crown('#FFC23D', 26)}<span>${t('Crowns')}</span></button></div></div>`;
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
      <div class="grp tr" style="width: 150px; height: 64px"><div class="st-chip top-chip right">${ICON.crown('#FFC23D', 24)}<span>${crownCount(this.g)} / ${ROUTE.length}</span></div></div>
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
    const plan = planFor(cityId);
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
        h += `<div class="cc-twist boss">${ICON.crown('#FFC23D', 18)}<p><b>${esc(t(plan.bossFight.name))}</b> ${pronoun(plan.bossFight.name) === 'her' ? t('guards the deed. Knock her out to win the farm.') : t('guards the deed. Knock him out to win the farm.')}</p></div>`;
      else
        h += `<div class="cc-twist"><span class="tw-ic">${eventIcon(plan.signatureEvent)}</span><p>${esc(t(EVENT_LINES[plan.signatureEvent] || ''))}</p></div>`;
    } else {
      h += `<div class="locked-box tall">${ICON.lock()}<span>${esc(lock.reason)}</span></div>`;
      h += `<p class="cc-desc">${esc(t(ct.desc))}</p>`;
    }
    h += `<div class="stat2"><div class="statbox"><div class="k">${t('{n} BILLS', { n: plan.bills.length })}</div><div class="v">${tn(plan.totalDays, '{n} day', '{n} days')}</div></div>
      <div class="statbox"><div class="k">${t('CITY CROWN')}</div><div class="v">${p.crown ? t('Yours!') : money(plan.record)}</div></div></div>`;
    if (p.won) h += `<p class="cc-best">${t('Paid you so far:')} <b>${money(p.paid || 0)}</b>${t('. Farming it again pays only what beats that.')}</p>`;
    else if (p.bestDay > 0) h += `<p class="cc-best">${t('Your best day here:')} <b>${money(p.bestDay)}</b></p>`;
    h += `<div class="cc-rival"><div class="trio">${this.trio(ct.country, 30)}</div><span>${t('Rival')}<br><b>${esc(ct.rival)}</b></span></div>`;
    if (!lock.open) h += `<button type="button" disabled class="st-btn btn-lg off">${t('Locked')}</button>`;
    else if (this.g.run && this.g.run.cityId === cityId) h += `<button type="button" class="st-btn gold btn-lg" data-act="farm" data-arg="${cityId}">${t('Continue · Day {day}', { day: engine().state().day })}</button>`;
    else h += `<button type="button" class="st-btn gold btn-lg" data-act="farm" data-arg="${cityId}">${p.won ? t('Farm again') : t('Farm here')}</button>`;
    return h;
  }

  // ------------------------------------------------------------------ farmhouse (between days)

  private farmhouseHtml(): string {
    const run = this.g.run;
    if (!run) return '';
    const e = engine();
    const st = e.state(), b = e.bill();
    const ct = cityById(run.cityId)!;
    const plan = planFor(run.cityId);
    let action: string;
    if (b.tonight && !b.canPay) action = `<button type="button" class="st-btn red btn-top" data-act="bank">${t('Face the bank')}</button>`;
    else if (b.tonight) action = `<button type="button" class="st-btn gold btn-top" data-act="pay">${t('Pay {amt}', { amt: money(b.amt) })}</button>`;
    else action = `<button type="button" class="st-btn gold btn-top" data-act="start">${t('Start day {day}', { day: st.day })}${ICON.next()}</button>`;
    const coinsOffer = canOffer(this.g, 'coins')
      ? `<button type="button" class="ad-chip" data-act="ad-coins">${ICON.play()}<span>${t('Free {amt}', { amt: money(this.coinsReward()) })}</span></button>`
      : '';
    const tabs = (['workshop', 'tools', 'perks', 'bills'] as const)
      .map(t => `<button type="button" class="${this.fhTab === t ? 'on' : ''}" data-act="tab" data-arg="${t}">${cap(t)}</button>`)
      .join('');
    let body = '';
    if (this.fhTab === 'workshop') body = this.workshopGrid();
    else if (this.fhTab === 'tools') body = this.toolsTab();
    else if (this.fhTab === 'perks') body = this.perksList(st.perks);
    else body = this.billsList();
    return `<div class="wood"></div>
      <div class="grp tl" style="width: 520px; height: 64px"><div class="fh-top">
        <button type="button" class="st-btn st-sq" data-act="map" data-arg="${run.cityId}" aria-label="${t('Back to the map')}">${ICON.back()}</button>
        <div class="st-chip fh-title"><h2>${esc(ct.short)}</h2><span class="sub">${t('Day {day}', { day: st.day })}${plan.boss ? ` · ${t('Boss')}` : ''}</span></div>
        ${this.walletChip()}${coinsOffer}</div></div>
      <div class="grp tr" style="width: 230px; height: 64px">${action}</div>
      <div class="grp ml" style="width: 240px; height: 300px">${this.noticeHtml(b, st)}</div>
      <div class="grp mr" style="width: 500px; height: 300px"><div class="st-chip fh-panel"><div class="seg tabs">${tabs}</div><div class="fh-body">${body}</div></div></div>`;
  }

  private noticeHtml(b: BillInfo, st: EngineState): string {
    const pct = clamp(st.cash / Math.max(1, b.amt), 0, 1);
    const due = b.tonight ? t('Due tonight') : `${t('Due day {day}', { day: b.dueDay })} · ${tn(b.left, '{n} day left', '{n} days left')}`;
    let offers = '';
    if (b.tonight && !b.canPay && !st.extraDayUsed && canOffer(this.g, 'extraDay'))
      offers = `<button type="button" class="ad-chip" data-act="ad-extra">${ICON.play()}<span>${t('+1 day')}</span></button>`;
    const boss = st.boss;
    let bossRow = '';
    if (boss && !boss.down) {
      const f = clamp(boss.hp / Math.max(1, boss.max), 0, 1);
      const txt = b.bossBlock
        ? `${esc(t(boss.name))} ${pronoun(boss.name) === 'her' ? t('is sitting on the deed. Knock her out first.') : t('is sitting on the deed. Knock him out first.')}`
        : `${esc(t(boss.name))} ${t('is on the farm. Bounty {amt}.', { amt: money(boss.bounty) })}`;
      bossRow = `<div class="n-boss${b.bossBlock ? ' hot' : ''}">${ICON.crown('#FFC23D', 18)}<span class="nb-t">${txt}</span><span class="nb-bar"><i style="width: ${(f * 100).toFixed(1)}%"></i></span></div>`;
    } else if (boss && boss.down) {
      bossRow = `<div class="n-boss done">${ICON.crown('#FFC23D', 18)}<span class="nb-t">${esc(t(boss.name))} ${t('is out cold.')}</span></div>`;
    }
    // bills are paid on the evening they are due
    const payLabel = b.bossBlock && st.cash >= b.amt ? t('Boss first') : b.tonight ? t('Pay {amt}', { amt: money(b.amt) }) : t('Pay on day {day}', { day: b.dueDay });
    return `<div class="notice${bossRow ? ' has-boss' : ''}">
        <div class="n-head">${t('GRUMBLE &amp; SONS SAVINGS &amp; LOAN')}</div>
        <div class="n-sub">${t('Notice {n} of {m}', { n: b.index + 1, m: b.count })}</div>
        <div class="n-name">${esc(t(b.name))}</div>
        <p class="n-note">${esc(t(b.note))}</p>
        <div class="n-amt">${money(b.amt)}</div>
        <div class="n-due${b.tonight ? ' hot' : ''}">${due}</div>
        <div class="n-meter${st.cash >= b.amt ? ' full' : ''}"><i style="width: ${(pct * 100).toFixed(1)}%"></i></div>
        
        ${bossRow}
        <div class="n-actions"><button type="button" class="st-btn btn-pay${b.canPay ? ' gold' : ''}" data-act="pay" ${b.canPay ? '' : 'disabled'}>${payLabel}</button>${offers}</div>
      </div>`;
  }

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
        return `<div class="mod-row"><span class="mod-txt"><b>${esc(t(m.name))}</b><span>${esc(t(m.line))}</span></span><span class="pips">${pips}</span>${btn}</div>`;
      })
      .join('');
    return `<div class="tools-tab"><div class="tool-list">${list}</div><div class="tool-detail">
        <div class="td-head">${TOOL_ICON[sel.id](30)}<span class="td-name">${esc(t(sel.name))}</span>${head}</div>
        <p class="td-blurb">${esc(t(sel.blurb))}</p><p class="td-stats">${esc(toolSummary(toolStats(T, sel.id)).join(' · '))}</p>
        <div class="mod-list">${mods}</div></div></div>`;
  }

  private updateJobBar(): void {
    const bar = document.getElementById('dbdJob');
    const job = this.g.workshop.job;
    if (!bar || !job) return;
    const left = job.endsAt - Date.now();
    const pct = clamp(1 - left / Math.max(1, job.endsAt - job.startedAt), 0, 1);
    const i = bar.querySelector<HTMLElement>('.jb-track i'), l = bar.querySelector<HTMLElement>('.jb-left');
    if (i) i.style.width = (pct * 100).toFixed(1) + '%';
    if (l) l.innerHTML = `${ICON.clock(11)} ${formatDuration(left)}`;
  }

  private workshopGrid(): string {
    const lv = this.g.workshop.levels;
    const job = this.g.workshop.job;
    const cash = this.wallet();
    const cards = UPGRADES.map(u => {
      const l = lv[u.id];
      const cost = upgradeCost(u.id, l);
      const dur = upgradeDuration(u.id, l);
      const building = job && job.id === u.id;
      let btn: string;
      if (cost == null) btn = `<button type="button" class="st-btn btn-buy off" disabled>${t('Maxed')}</button>`;
      else if (building) btn = `<button type="button" class="st-btn btn-buy off" disabled>${t('Building…')}</button>`;
      else {
        const blocked = (dur > 0 && !!job) || cash < cost;
        btn = `<button type="button" class="st-btn btn-buy${blocked ? ' off' : ' gold'}" data-act="buy" data-arg="${u.id}" ${blocked ? 'disabled' : ''}>${money(cost)}${dur ? `<small>${ICON.clock(11)}${formatDuration(dur)}</small>` : ''}</button>`;
      }
      const eff = cost != null ? `${esc(u.value(l))} → <b>${esc(u.value(l + 1))}</b> ${esc(t(u.unit))}` : `<b>${esc(u.value(l))}</b> ${esc(t(u.unit))}`;
      return `<div class="up-card"><div class="up-name">${esc(t(u.name))}</div>
        <div class="up-eff"><span class="up-lv" aria-label="${t('Level {n}', { n: l })}">${t('Lv {n}', { n: l })}</span> ${eff}</div>${btn}</div>`;
    }).join('');
    const run = this.g.run;
    const capped = run && run.mark > 0
      ? `<p class="up-cap">${ICON.coin(16)}<span>${t('This farm has paid you {amt} already. Its cash buys upgrades once you hold more than that; your savings always can.', { amt: money(run.mark) })}</span></p>`
      : '';
    return `${capped}<div class="up-grid">${cards}${this.jobCellHtml()}</div>`;
  }

  /** The eighth cell of the workshop grid: the upgrade being built, or how building works. */
  private jobCellHtml(): string {
    const job = this.g.workshop.job;
    if (!job) return `<div class="up-card job-cell idle">${ICON.clock(18)}<p>${t('Every fifth level is a bigger job: it takes a while, one job at a time.')}</p></div>`;
    const def = UPGRADES.find(u => u.id === job.id)!;
    const left = job.endsAt - Date.now();
    const pct = clamp(1 - left / Math.max(1, job.endsAt - job.startedAt), 0, 1);
    const ad = canOffer(this.g, 'finish') ? `<button type="button" class="ad-chip sm" data-act="ad-finish">${ICON.play()}<span>${t('Finish now')}</span></button>` : '';
    return `<div class="up-card job-cell" id="dbdJob"><div class="up-name">${esc(t(def.name))} ${job.level}</div>
      <span class="jb-track"><i style="width: ${(pct * 100).toFixed(1)}%"></i></span><span class="jb-left">${ICON.clock(11)} ${formatDuration(left)}</span>${ad}</div>`;
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
    const plan = this.g.run ? planFor(this.g.run.cityId) : null;
    const now = plan && plan.stages.filter(x => x.stage <= st.billsPaid).map(x => spriteImg(x.type, 22, cropName(x.type))).join('');
    const field = now ? `<p class="bl-field">${t('On the field now:')} ${now}<span>${t('Each bill paid brings a new crop.')}</span></p>` : '';
    // bills keep their schedule: each is due its own number of days after the one before it
    let due = st.due;
    return `${field}<div class="bill-list">${e
      .bills()
      .map((b, i) => {
        if (i > st.bill) due += b.days;
        const status = i < st.billsPaid ? 'paid' : i === st.bill ? 'now' : 'later';
        const next = plan && plan.stages[i + 1];
        const crop = next ? `<span class="b-crop" title="${t('Then: {crop}', { crop: esc(cropName(next.type)) })}">${spriteImg(next.type, 24, cropName(next.type))}</span>` : `<span class="b-crop"></span>`;
        return `<div class="bill-row ${status}"><span class="b-no">${i + 1}</span><span class="b-name">${esc(t(b.name))}</span><span class="b-amt">${money(b.amt)}</span><span class="b-st">${
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
    const ct = cityById(run.cityId)!;
    const plan = planFor(run.cityId);
    const p = cityProgress(this.g, run.cityId);
    const earned = Math.round(d.today.earned);
    const pct = Math.round(clamp(p.bestDay / plan.record, 0, 9) * 100);
    const amtTxt = money(b.amt) + '.00';
    const dots = ' ' + new Array(Math.max(2, 31 - b.name.length - amtTxt.length)).join('.') + ' ';
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
    const crownLine = d.crownToday
      ? `👑 ${t('New city crown! You beat {rival}.', { rival: esc(ct.rival) })}`
      : p.crown
        ? `👑 ${t('{farm} is yours. Best day {amt}.', { farm: esc(ct.short), amt: money(p.bestDay) })}`
        : t('City record: {have} of {rec}', { have: money(p.bestDay), rec: money(plan.record) });
    const dbl = !d.doubled && earned > 0 && canOffer(this.g, 'double')
      ? `<button type="button" class="st-btn blue btn-md flex1 ad-btn" data-act="ad-double">${ICON.play()}<span>${t('Double it: +{amt}', { amt: money(earned) })}</span></button>`
      : '';
    return `<div class="grp mc" style="width: 430px; height: 350px"><div class="st-chip sundown-card">
      <div class="sd-head"><h2>${t('Sundown!')}</h2><span class="eyebrow">${esc(ct.short.toUpperCase())} · ${t('DAY {day}', { day: d.day })}</span></div>
      <div class="stat3"><div class="statbox"><div class="k">${t('CROPS CUT')}</div><div class="v">${d.today.count}</div></div>
        <div class="statbox"><div class="k">${t('BEST CHAIN')}</div><div class="v">×${d.today.best}</div></div>
        <div class="statbox"><div class="k">${t('EARNED')}</div><div class="v money">${money(earned)}${d.doubled ? '<small> ×2</small>' : ''}</div></div></div>
      <div class="sd-notice"><div>${t('GRUMBLE &amp; SONS · NOTICE {n} OF {m}', { n: b.index + 1, m: b.count })}</div><div>${esc(t(b.name))}${dots}${amtTxt}</div><div class="sd-due">${dueLine}</div>${stamp}</div>
      <div class="sd-rec"><div class="sd-rec-row"><span>${crownLine}</span><span>${Math.min(100, pct)}%</span></div>
        <div class="meter"><i style="width: ${Math.min(100, pct)}%"></i></div></div>
      ${bossLine}
      <div class="sd-actions">${dbl}<button type="button" class="st-btn gold btn-md flex1" data-act="farmhouse">${t('Farmhouse')}${ICON.next()}</button></div>
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
      // star 2 is shown as the piggy bank filling past the farm's goal; star 3 as the rival's face
      const kept = Math.max(0, r.kept ?? r.banked + r.mark);
      const top = Math.max(kept, plan.spare) * 1.25;
      const keptPct = Math.min(100, (kept / Math.max(1, top)) * 100);
      const goalPct = Math.min(100, (plan.spare / Math.max(1, top)) * 100);
      const starRow = [
        `<div class="star-row ok" style="animation-delay: .25s">${ICON.star(true, 26)}<span>${t('Paid off the farm')}</span></div>`,
        `<div class="star-row spare-row${r.spare ? ' ok' : ''}" style="animation-delay: .5s">${ICON.star(r.spare, 26)}<span class="sp-pig">${ICON.piggy(24)}</span>
          <span class="sp-bar" aria-label="${t('Kept {amt} after the deed; the goal is {goal}', { amt: money(kept), goal: money(plan.spare) })}"><i style="--w: ${keptPct.toFixed(1)}%"></i><b style="left: ${goalPct.toFixed(1)}%"></b></span>
          <span class="sp-amt">${money(kept)}<small> / ${money(plan.spare)}</small></span></div>`,
        `<div class="star-row rival-row${r.crown ? ' ok' : ''}" style="animation-delay: .75s">${ICON.star(r.crown, 26)}<span class="rv-face${r.crown ? ' down' : ''}">${rivalFace(ct.rival, 30)}</span><span>${t('Beat {rival}', { rival: esc(ct.rival) })}</span></div>`,
      ].join('');
      const gains =
        (r.ribbons ? `<button type="button" class="dia dia-btn" data-act="barn" aria-label="${t('Spend ribbons in the Bling Barn')}">${ribbonIcon(18)} +${r.ribbons}</button>` : '') +
        (r.diamonds ? `<button type="button" class="dia dia-btn" data-act="skills" aria-label="${t('Spend it on the skill map')}">${ICON.diamond(16)} +${r.diamonds}</button>` : '');
      return `<div class="grp mc" style="width: 470px; height: 350px"><div class="st-chip result-card">
        <div class="letter-head"><span class="eyebrow">${t('GRUMBLE &amp; SONS SAVINGS &amp; LOAN')}</span><span class="stamp ok big">${t('PAID IN FULL')}</span></div>
        <h2 class="r-title">${t('The {farm} farm is yours.', { farm: esc(ct.short) })}</h2>
        <p class="r-text">${t('Dear former customer, enclosed is the deed. We are, frankly, upset.')}</p>
        <div class="star-rows">${starRow}</div>${plan.bossFight ? this.clearedLine(ct.country) : ''}
        <div class="r-rewards"><span>${tn(r.days, '{n} day', '{n} days')} · ${t('{amt} earned', { amt: money(r.earned) })} · ${
          r.mark > 0
            ? r.banked > 0
              ? t('+{amt} above your best', { amt: money(r.banked) })
              : t('nothing above your best of {amt}', { amt: money(r.mark) })
            : t('+{amt} saved', { amt: money(r.banked) })
        }</span><span class="r-gains">${gains}</span></div>
        <div class="r-actions"><button type="button" class="st-btn blue btn-md flex1" data-act="map" data-arg="${r.cityId}">${t('Map')}</button>
          ${nextOpen ? `<button type="button" class="st-btn gold btn-md flex1" data-act="next-city">${t('Next farm')}${ICON.next()}</button>` : ''}</div>
      </div></div>`;
    }
    return `<div class="grp mc" style="width: 450px; height: 330px"><div class="st-chip result-card lost">
      <div class="letter-head"><span class="eyebrow">${t('GRUMBLE &amp; SONS SAVINGS &amp; LOAN')}</span><span class="stamp bad big">${t('FORECLOSED')}</span></div>
      <h2 class="r-title">${t('The bank took the farm.')}</h2>
      <p class="r-text">${
        r.bossKept && plan.bossFight
          ? t('Dear farmer, {boss} was still sitting on the deed at sunset. The farm, the tractor and the goat now belong to us. The goat is already a problem.', { boss: esc(t(plan.bossFight.name)) })
          : t('Dear farmer, regarding your {bill}: you were {amt} short. The farm, the tractor and the goat now belong to us. The goat is already a problem.', { bill: esc(t(r.bill || 'bill').toLowerCase()), amt: money(r.short || 0) })
      }</p>
      <p class="r-text">${t('You keep your upgrades, your tools and your {amt} of savings.', { amt: money(r.wallet) })}</p>
      <div class="r-actions"><button type="button" class="st-btn blue btn-md flex1" data-act="map" data-arg="${r.cityId}">${t('Map')}</button>
        <button type="button" class="st-btn gold btn-md flex1" data-act="retry" data-arg="${r.cityId}">${t('Try again')}</button></div>
    </div></div>`;
  }

  // ------------------------------------------------------------------ modals

  private openModal(kind: string, inner: string, width = 380): void {
    if (kind !== 'tracks') this.music.setPreview(null);
    this.modal.dataset.kind = kind;
    this.modal.innerHTML = `<div class="grp mc" style="width: ${width}px; height: 330px"><div class="st-chip modal-card" style="width: ${width}px">${inner}</div></div>`;
    this.modal.hidden = false;
    layout(this.root);
  }

  private closeModal(): void {
    this.modal.hidden = true;
    this.modal.dataset.kind = '';
    this.music.setPreview(null);
  }

  /** The chest after a bill: tap to open, then pick a perk for this farm (two from a diamond chest). Before it is
   * opened, a rewarded ad can upgrade it once. */
  private showChest(c: ChestInfo, again = false): void {
    if (!c || !c.perks || !c.perks.length) return;
    if (this.scr !== 'farmhouse') this.show('farmhouse');
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
    this.openModal('perks', `<div class="chest-box ch-t${c.tier}${two ? ' two' : ''}${two && picks < 2 ? ' one-left open' : ''}">
        <div class="chest-head"><span class="eyebrow">${t('BILL {n} OF {m} PAID', { n: st.billsPaid, m: st.billCount })}</span><h2 class="m-title">${esc(t(chestName(c.tier) + '!'))}</h2>${sub}</div>
        <button type="button" class="chest-btn" data-act="chest-open" aria-label="${t('Open the chest')}"><span class="ch-stage">${chestBurst(c.tier)}${chestSvg(c.tier)}</span><span class="chest-tap">${t('Tap to open')}</span></button>
        ${up}
        <div class="chest-cards perk-grid">${cards}</div>
        ${this.newCropLine()}
      </div>`, two ? 600 : 480);
    // the first chest: a finger taps it
    if (!this.g.seen.chest && !again && this.coachOn) {
      this.g.seen.chest = true;
      this.save();
      const box = () => this.modal.querySelector<HTMLElement>('.chest-box');
      void this.coach.point(
        () => this.modal.querySelector('.chest-btn'),
        t('Tap'),
        () => this.modal.hidden || !!box()?.classList.contains('open'),
        20000,
      );
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

  private openChest(): void {
    const box = this.modal.querySelector<HTMLElement>('.chest-box');
    if (!box || box.classList.contains('open')) return;
    box.classList.add('open');
    try {
      navigator.vibrate?.(18);
    } catch {
      /* no vibration */
    }
  }

  /** The crop that joined the field with the bill just paid, if any. */
  private newCropLine(): string {
    const run = this.g.run;
    if (!run) return '';
    const plan = this.farmPlan(run);
    const e = engine();
    const st = e.state();
    const stage = plan.stages[st.billsPaid];
    if (!stage || st.billsPaid <= 0) return '';
    const cur = e.stats() as unknown as { dmg: number; vm: number };
    const pay = stage.val * (cur.vm || 1);
    const hp = stage.hp * plan.hp * (1 + plan.hpDay * Math.max(0, st.day - 1));
    const cuts = Math.max(1, Math.ceil(hp / Math.max(0.01, cur.dmg || 1) - 1e-6));
    return newCropHtml(stage.type, t(cropName(stage.type)), pay, cuts, money);
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
  }

  /** The language list: each language in its own name. */
  private openLanguages(): void {
    const rows = LANGS.map(
      l => `<button type="button" class="st-btn lang-row${l.id === lang() ? ' gold' : ''}" data-act="lang" data-arg="${l.id}" aria-pressed="${l.id === lang()}" lang="${l.id}">${esc(l.name)}</button>`,
    ).join('');
    this.openModal('languages', `<h2 class="m-title">${GLOBE} ${t('Language')}</h2><div class="lang-list">${rows}</div>
      <div class="m-row"><button type="button" class="st-btn" data-act="settings">${t('Back')}</button><button type="button" class="st-btn gold" data-act="close">${t('Done')}</button></div>`, 360);
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
    const ft = trackById(this.music.picked('field')), mt = trackById(this.music.picked('menu'));
    const cur = LANGS.find(l => l.id === lang()) || LANGS[0];
    this.openModal('settings', `<h2 class="m-title">${t('Settings')}</h2>
      <button type="button" class="music-row" data-act="languages"><span class="mr-k">${GLOBE} ${t('Language')}</span><span class="mr-v"><b>${esc(cur.name)}</b></span>${ICON.next()}</button>
      ${row('music', t('Music'), s.music)}
      <button type="button" class="music-row" data-act="music-picker"><span class="mr-k">${t('Tracks')}</span><span class="mr-v">${t('Field:')} <b>${esc(ft ? ft.title : '')}</b> ${t('· Menus:')} <b>${esc(mt ? mt.title : '')}</b></span>${ICON.next()}</button>
      <p class="m-text mus-status">${t('Music now:')} <b>${esc(t(this.music.status()))}</b></p>
      ${row('sound', t('Sound effects'), sound)}${row('haptics', t('Vibration'), s.haptics)}
      <div class="m-links"><a id="linkPrivacyPolicy" href="https://khoreh.com/due-by-dusk/privacy.html">${t('Privacy policy')}</a>
        <button type="button" class="linkish" id="btnPrivacyChoices" hidden>${t('Privacy choices')}</button>
        <button type="button" class="linkish" data-act="credits">${t('Credits')}</button>
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
    const sale = tool && !this.g.tools.owned.includes(tool.id) ? ` ${t('The {tool} is now for sale in the farmhouse.', { tool: esc(t(tool.name).toLowerCase()) })}` : '';
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
      <p class="m-text">${t('Fonts: Lilita One, Nunito, Courier Prime, Figtree and Big Shoulders Stencil, under the SIL Open Font License.')}</p>
      <div class="m-row"><button type="button" class="st-btn" data-act="settings">${t('Back')}</button><button type="button" class="st-btn gold" data-act="close">${t('Done')}</button></div>`, 420);
  }

  private openCrowns(): void {
    const rows = COUNTRIES.map(c => {
      const n = c.cities.filter(x => cityProgress(this.g, x.id).crown).length;
      return `<div class="crown-row"><span>${esc(t(c.name))}</span><span>${ICON.crown(n ? '#FFC23D' : '#E4DACA', 18)} ${n}/${c.cities.length}</span></div>`;
    }).join('');
    this.openModal('crowns', `<h2 class="m-title">${ICON.crown('#FFC23D', 24)} ${t('City crowns')}</h2>
      <p class="m-text">${t("Beat a city's best day to take its crown from the rival who holds it. {n} ★ so far.", { n: totalStars(this.g) })}</p>
      <div class="crown-grid">${rows}</div><button type="button" class="st-btn gold btn-md" data-act="close">${t('Done')}</button>`, 400);
  }

  private openWorkshopModal(): void {
    this.openModal('workshop', '', 520);
    this.renderWorkshopModal();
  }

  private renderWorkshopModal(): void {
    const card = this.modal.querySelector('.modal-card');
    if (card) card.innerHTML = `<h2 class="m-title">${t('Workshop')}</h2>${this.workshopGrid()}<button type="button" class="st-btn gold btn-md" data-act="close">${t('Done')}</button>`;
  }

  private confirmReset(): void {
    this.openModal('confirm', `<h2 class="m-title">${t('Start over?')}</h2>
      <p class="m-text">${t("This wipes every farm, star, crown and upgrade on this device. It can't be undone.")}</p>
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
