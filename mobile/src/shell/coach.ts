// The coach (v0.11): the game shows how it plays instead of telling it (Navid, 30 Oct: "no text, most of them
// should be shown in action and in real game playback or as interactive tutorial").
//
// Pieces: a ghost finger that can play the real field (it sends the same pointer events a finger does), a
// spotlight, a word or two, cinema bars and slow motion. Lessons are short async scripts; each one runs once and is
// remembered in GameSave.seen. Field "moments" (the first runaway radish, goat, golden crop...) are spotted by
// peeking at the engine each frame.

import { t } from '../i18n/i18n';
import { engine } from './engine';
import { touchy } from './hud';
import { arthurTalk } from './arthur';
import { SPRITE } from './art';

/** A crop's picture for a tip's bubble. */
export function cropIcon(type: string): string {
  const u = SPRITE[type];
  return u ? `<img src="${u}" alt="" draggable="false">` : '';
}

const INK = '#2B1708';
/** Pointer ids for the ghost fingers (well away from real ones). */
export const GHOST1 = 9101;
export const GHOST2 = 9102;

export interface Pt {
  x: number;
  y: number;
}

/** What the engine's peek() returns (world units; `scale` turns them into CSS pixels on the canvas). */
export interface FieldPeek {
  scale: number;
  worldW: number;
  crops: Array<{ x: number; y: number; r: number; ds: number; hp: number; type: string; dead: boolean; age: number; boss: boolean }>;
  chargeT: number;
  pointer: { x: number; y: number; active: boolean; charge2: boolean };
  today: { earned: number; count: number; best: number; rushes?: number };
  mode: string;
  time: number;
  goat: { x: number; y: number; angry: boolean } | null;
  crows: Pt[];
  props: Array<{ kind: string; x: number; y: number }>;
  bolts: number;
  lucky: Pt[];
  frosted: number;
  /** v0.12: the boss's bomb seeds and storm casings, the coins thief crows carry, and its armour. */
  bombs?: number;
  /** 0.16: where the first bomb seed and the first caught crop are. */
  bombAt?: Pt | null;
  encasedAt?: Pt | null;
  encased?: number;
  encaseKind?: string;
  crowLoot?: number;
  bossFull?: boolean;
  stunned?: boolean;
}

export function peek(): FieldPeek | null {
  try {
    return (engine() as unknown as { peek(): FieldPeek }).peek();
  } catch {
    return null;
  }
}

/** Thrown into a running script when it is cancelled (skip, screen change). */
class Stop extends Error {}

const HAND = `<svg width="56" height="70" viewBox="0 0 48 60" aria-hidden="true"><path d="M17 5c2.8 0 4.6 2 4.6 4.8V25l2.6-.6c2.4-.5 4.3.6 4.9 2.6l2.7-.6c2.4-.4 4.3.8 4.8 3l2-.3c2.5-.2 4.3 1.5 4.3 4v9.2C43 51 37 56 29.5 56h-6.2c-4.3 0-8.1-2-10.5-5.5L4.9 39.3c-1.5-2.3-.9-5.2 1.4-6.6 2.1-1.2 4.7-.6 6.2 1.3l.1.1V9.8C12.6 7 14.3 5 17 5Z" fill="#fff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M24.2 25v6.5M31.6 27.6v5.6M38.4 30.2v4.6" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/></svg>`;
/** Where the fingertip sits in the hand drawing (CSS px). */
const TIP = { x: 20, y: 6 };

/** The tips' arrow (0.16): a fat gold arrow pointing up; it is turned towards the thing the tip is about. */
const ARROW = `<svg width="46" height="52" viewBox="0 0 46 52" aria-hidden="true"><path d="M23 3 L42 25 H31 V48 H15 V25 H4 Z" fill="#FFC23D" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M23 10 L35 23" stroke="#FFF4B0" stroke-width="3" stroke-linecap="round"/></svg>`;

const COACH_HTML = `<div id="dbdCoach" hidden>
  <div class="co-block"></div>
  <div class="co-bars"><i></i><i></i></div>
  <div class="co-veil"></div>
  <div class="co-hole" hidden></div>
  <div class="ct-spot" hidden></div>
  <div class="ct-blk" data-s="t" hidden></div><div class="ct-blk" data-s="b" hidden></div><div class="ct-blk" data-s="l" hidden></div><div class="ct-blk" data-s="r" hidden></div>
  <div class="ct-catch" hidden></div>
  <div class="ct-arrow" hidden>${ARROW}</div>
  <div class="ct-tip" hidden role="status" aria-live="polite"><span class="ct-who" hidden></span><span class="ct-body"><b class="ct-t"></b><span class="ct-d"></span><span class="ct-p" hidden><i class="ct-pf"></i><b class="ct-pt"></b></span></span><span class="ct-go" hidden></span></div>
  <div class="ct-burst" hidden></div>
  <div class="co-cap" hidden></div>
  <div class="co-hand" data-i="0" hidden><span class="co-press"></span>${HAND}</div>
  <div class="co-hand" data-i="1" hidden><span class="co-press"></span>${HAND}</div>
  <div class="co-boom" hidden></div>
  <div class="co-step" hidden><b class="cs-t"></b><span class="cs-d"></span><span class="cs-p" hidden></span></div>
  <button type="button" class="st-btn co-skip" hidden>Skip<svg width="14" height="16" viewBox="0 0 16 18" aria-hidden="true"><path d="M5 3l6 6-6 6" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
</div>`;

type Ease = (t: number) => number;
const easeInOut: Ease = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export class Coach {
  private root: HTMLElement;
  private veil: HTMLElement;
  private hole: HTMLElement;
  private cap: HTMLElement;
  private hands: HTMLElement[];
  private boom: HTMLElement;
  private skip: HTMLButtonElement;
  private step: HTMLElement;
  private token = 0;
  private handAt: Pt[] = [{ x: -99, y: -99 }, { x: -99, y: -99 }];
  private down = [false, false];
  private onSkip: (() => void) | null = null;
  private tips: Tips;
  /** A lesson or moment is on screen. */
  busy = false;

  constructor() {
    document.body.insertAdjacentHTML('beforeend', COACH_HTML);
    this.root = document.getElementById('dbdCoach') as HTMLElement;
    this.tips = new Tips(this.root);
    const q = (s: string) => this.root.querySelector(s) as HTMLElement;
    this.veil = q('.co-veil');
    this.hole = q('.co-hole');
    this.cap = q('.co-cap');
    this.hands = Array.from(this.root.querySelectorAll<HTMLElement>('.co-hand'));
    this.boom = q('.co-boom');
    this.skip = q('.co-skip') as HTMLButtonElement;
    this.step = q('.co-step');
    this.skip.firstChild && (this.skip.firstChild.textContent = t('Skip'));
    this.skip.addEventListener('click', () => {
      const f = this.onSkip;
      this.onSkip = null;
      this.cancel();
      f?.();
    });
  }

  // ---------------------------------------------------------------- running scripts

  /** Starts a script; any script already running stops first. Resolves false when it was cancelled. */
  async run(fn: () => Promise<void>): Promise<boolean> {
    this.cancel();
    const my = ++this.token;
    this.busy = true;
    this.root.hidden = false;
    try {
      await fn();
      return true;
    } catch (e) {
      if (!(e instanceof Stop)) console.error('[coach]', e);
      return false;
    } finally {
      if (my === this.token) this.clear();
    }
  }

  /** Stops whatever is running and puts everything back (time, fingers, overlay). */
  cancel(): void {
    this.token++;
    this.clear();
  }

  private live(my: number): void {
    if (my !== this.token) throw new Stop();
  }

  private clear(): void {
    this.lift(0);
    this.lift(1);
    this.restoreTime();
    this.hideTip();
    this.busy = false;
    this.root.hidden = true;
    this.root.classList.remove('cinema', 'blocking');
    this.veil.classList.remove('on');
    this.hole.hidden = true;
    this.cap.hidden = true;
    for (const h of this.hands) h.hidden = true;
    this.boom.hidden = true;
    this.skip.hidden = true;
    this.onSkip = null;
    this.step.hidden = true;
  }

  /** The practice farm's step card at the top of the field: what to do now, and how far along (no dimming). */
  stepCard(title: string, line: string, progress?: string): void {
    const s = this.step;
    (s.querySelector('.cs-t') as HTMLElement).textContent = title;
    (s.querySelector('.cs-d') as HTMLElement).textContent = line;
    const p = s.querySelector('.cs-p') as HTMLElement;
    p.hidden = !progress;
    p.textContent = progress || '';
    if (s.hidden) {
      s.hidden = false;
      s.classList.remove('pop');
      void s.offsetWidth;
      s.classList.add('pop');
    }
  }

  /** A Skip button without the cinema bars (the practice farm). */
  showSkip(label: string, onSkip: () => void): void {
    if (this.skip.firstChild) this.skip.firstChild.textContent = label;
    this.skip.hidden = false;
    this.skip.classList.add('low');
    this.onSkip = onSkip;
  }

  wait(ms: number): Promise<void> {
    const my = this.token;
    return new Promise((res, rej) =>
      setTimeout(() => {
        if (my !== this.token) rej(new Stop());
        else res();
      }, ms),
    );
  }

  /** Waits until `pred` is true (checked every frame) or `ms` pass; resolves whether it came true. */
  until(pred: () => boolean, ms: number): Promise<boolean> {
    const my = this.token;
    const t0 = performance.now();
    return new Promise((res, rej) => {
      const tick = () => {
        if (my !== this.token) return rej(new Stop());
        let ok = false;
        try {
          ok = pred();
        } catch {
          ok = false;
        }
        if (ok) return res(true);
        if (performance.now() - t0 >= ms) return res(false);
        requestAnimationFrame(tick);
      };
      tick();
    });
  }

  /** Runs `step(t)` every frame for `ms` (t from 0 to 1). */
  tween(ms: number, step: (t: number) => void, ease: Ease = easeInOut): Promise<void> {
    const my = this.token;
    const t0 = performance.now();
    return new Promise((res, rej) => {
      const tick = () => {
        if (my !== this.token) return rej(new Stop());
        const t = Math.min(1, (performance.now() - t0) / Math.max(1, ms));
        step(ease(t));
        if (t >= 1) return res();
        requestAnimationFrame(tick);
      };
      tick();
    });
  }

  // ---------------------------------------------------------------- the field

  /** The field's speed before the coach changed it (tests run it faster). */
  private baseScale: number | null = null;

  /** Slow motion (a tiny value holds the field still); `restoreTime` puts back the speed it had. */
  setTime(k: number): void {
    const w = window as unknown as { __DBD_TIMESCALE?: number };
    if (this.baseScale === null) this.baseScale = w.__DBD_TIMESCALE || 1;
    w.__DBD_TIMESCALE = k;
  }

  restoreTime(): void {
    if (this.baseScale === null) return;
    (window as unknown as { __DBD_TIMESCALE?: number }).__DBD_TIMESCALE = this.baseScale;
    this.baseScale = null;
  }

  private canvas(): HTMLCanvasElement | null {
    return document.getElementById('field') as HTMLCanvasElement | null;
  }

  /** A field position (world units) on screen. */
  toScreen(wx: number, wy: number): Pt {
    const c = this.canvas(),
      p = peek();
    if (!c || !p) return { x: wx, y: wy };
    const r = c.getBoundingClientRect();
    return { x: r.left + wx * p.scale, y: r.top + wy * p.scale };
  }

  /** The middle of a crop's body on screen. */
  cropAt(c: { x: number; y: number; r: number; ds: number }): Pt {
    return this.toScreen(c.x, c.y - c.r * c.ds * 0.55);
  }

  /** Sends a real pointer event to the field, as a finger would. */
  private touch(kind: 'pointerdown' | 'pointermove' | 'pointerup', i: 0 | 1, p: Pt): void {
    const c = this.canvas();
    if (!c) return;
    try {
      c.dispatchEvent(
        new PointerEvent(kind, { pointerId: i ? GHOST2 : GHOST1, pointerType: 'touch', isPrimary: i === 0, clientX: p.x, clientY: p.y, bubbles: true, cancelable: true }),
      );
    } catch {
      /* old browsers: no PointerEvent constructor */
    }
  }

  // ---------------------------------------------------------------- the ghost finger

  /** True while the ghost finger only points at the screen (tapHint): no finger offset then. */
  private pic = false;

  /** Where finger `i` touches so that it acts at `p`: the sickle finger sits below its target by the player's
   *  finger offset (Settings), as a real finger would, so the sickle lands on what the coach aims at. */
  private aim(i: 0 | 1, p: Pt): Pt {
    if (i !== 0 || this.pic) return p;
    try {
      return engine().fingerAt(p.x, p.y);
    } catch {
      return p;
    }
  }

  /** Shows finger `i` aiming at `p` (it only touches the field when `press` is used). */
  showHand(i: 0 | 1, p: Pt): void {
    const h = this.hands[i];
    h.hidden = false;
    this.handAt[i] = { ...p };
    const q = this.aim(i, p);
    h.style.transform = `translate(${(q.x - TIP.x).toFixed(1)}px, ${(q.y - TIP.y).toFixed(1)}px)`;
    if (this.down[i]) this.touch('pointermove', i, q);
  }

  hideHand(i: 0 | 1): void {
    this.lift(i);
    this.hands[i].hidden = true;
  }

  /** Finger `i` presses the field (real input when `real`, a picture otherwise). */
  press(i: 0 | 1, real = true): void {
    this.hands[i].classList.add('down');
    if (real && !this.down[i]) {
      this.down[i] = true;
      this.touch('pointerdown', i, this.aim(i, this.handAt[i]));
    }
  }

  lift(i: 0 | 1): void {
    this.hands[i]?.classList.remove('down');
    if (this.down[i]) {
      this.down[i] = false;
      this.touch('pointerup', i, this.aim(i, this.handAt[i]));
    }
  }

  /** Glides finger `i` to `to` (or along a target that moves, when `to` is a function). */
  async glide(i: 0 | 1, to: Pt | (() => Pt | null), ms: number): Promise<void> {
    const from = { ...this.handAt[i] };
    await this.tween(ms, t => {
      const end = typeof to === 'function' ? to() : to;
      if (!end) return;
      this.showHand(i, { x: from.x + (end.x - from.x) * t, y: from.y + (end.y - from.y) * t });
    });
  }

  /** Taps an element on screen (a button the player should press next): a picture only. */
  async tapHint(el: Element, times = 2): Promise<void> {
    const r = el.getBoundingClientRect();
    const p = { x: r.left + r.width * 0.6, y: r.top + r.height * 0.6 };
    this.pic = true;
    try {
      this.showHand(0, { x: p.x + 40, y: p.y + 60 });
      await this.glide(0, p, 420);
      for (let k = 0; k < times; k++) {
        this.press(0, false);
        await this.wait(220);
        this.lift(0);
        await this.wait(380);
      }
    } finally {
      this.pic = false;
    }
  }

  // ---------------------------------------------------------------- spotlight, words, effects

  /** Dims everything but a circle at `p` (screen px). */
  spot(p: Pt | null, r = 70): void {
    this.hole.hidden = true;
    if (!p) {
      this.veil.classList.remove('on');
      return;
    }
    this.veil.style.background = `radial-gradient(circle at ${p.x.toFixed(0)}px ${p.y.toFixed(0)}px, rgba(24,11,3,0) ${r}px, rgba(24,11,3,.6) ${r + 16}px)`;
    this.veil.classList.add('on');
  }

  /** Dims everything but an element (a button, a chip). */
  spotEl(el: Element | null, pad = 8): void {
    this.veil.classList.remove('on');
    if (!el) {
      this.hole.hidden = true;
      return;
    }
    const r = el.getBoundingClientRect();
    Object.assign(this.hole.style, {
      left: `${r.left - pad}px`,
      top: `${r.top - pad}px`,
      width: `${r.width + pad * 2}px`,
      height: `${r.height + pad * 2}px`,
    });
    this.hole.hidden = false;
  }

  /** One or two words, big, at `p` (or across the top). */
  say(text: string, p?: Pt, size = 34): void {
    const c = this.cap;
    c.textContent = text;
    c.style.fontSize = `${size}px`;
    const w = innerWidth,
      h = innerHeight;
    const x = p ? Math.max(90, Math.min(w - 90, p.x)) : w / 2;
    const y = p ? Math.max(size + 16, Math.min(h - 12, p.y)) : Math.round(h * 0.2);
    c.style.left = `${x.toFixed(0)}px`;
    c.style.top = `${y.toFixed(0)}px`;
    c.hidden = false;
    c.classList.remove('pop');
    void c.getBoundingClientRect();
    c.classList.add('pop');
  }

  hush(): void {
    this.cap.hidden = true;
  }

  /** Cinema bars and a Skip button; the player's own touches are held back meanwhile. */
  cinema(on: boolean, onSkip?: () => void): void {
    if (this.skip.firstChild) this.skip.firstChild.textContent = t('Skip');
    this.root.classList.toggle('cinema', on);
    this.root.classList.toggle('blocking', on);
    this.skip.hidden = !on;
    this.skip.classList.remove('low');
    this.onSkip = on ? onSkip || null : null;
  }

  /** The knockout: a white flash, a shock ring and a shower of coins. */
  async explode(at: Pt): Promise<void> {
    const b = this.boom;
    b.style.setProperty('--x', `${at.x.toFixed(0)}px`);
    b.style.setProperty('--y', `${at.y.toFixed(0)}px`);
    let bits = '';
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * Math.PI * 2 + (k % 3) * 0.2;
      const d = 120 + ((k * 53) % 110);
      bits += `<i style="--dx: ${(Math.cos(a) * d).toFixed(0)}px; --dy: ${(Math.sin(a) * d - 40).toFixed(0)}px; --dl: ${((k % 6) * 0.03).toFixed(2)}s"></i>`;
    }
    b.innerHTML = `<span class="co-flash"></span><span class="co-ring"></span>${bits}`;
    b.hidden = false;
    document.body.classList.remove('co-shake');
    void document.body.getBoundingClientRect();
    document.body.classList.add('co-shake');
    try {
      navigator.vibrate?.([40, 30, 80]);
    } catch {
      /* no vibration */
    }
    await this.wait(900);
    document.body.classList.remove('co-shake');
  }

  /** The bank's letter with PAID IN FULL stamped on it (the end of the intro). */
  async deed(): Promise<void> {
    const b = this.boom;
    b.innerHTML = `<div class="co-deed"><div class="co-paper"><span class="co-bank">${t('GRUMBLE &amp; SONS SAVINGS &amp; LOAN')}</span><b>${t('The farm is yours.')}</b><span class="co-stamp">${t('PAID IN FULL')}</span></div></div>`;
    b.hidden = false;
    await this.wait(2600);
  }

  // ---------------------------------------------------------------- lessons on the field

  /** Day 1: the ghost cuts a carrot for real (coins fly to the jar), then it's the player's turn. */
  async cutLesson(bank: () => Element | null): Promise<void> {
    await this.run(async () => {
      const my = this.token;
      // let the first crops pop out of the ground, then hold the field still
      await this.until(() => (peek()?.crops || []).filter(c => !c.dead && c.age > 0.35).length >= 2, 2500);
      this.setTime(0.0001);
      const target = nearestCrop(this, { x: innerWidth * 0.5, y: innerHeight * 0.58 });
      if (!target) return;
      const at = () => {
        const p = peek();
        const c = p?.crops.find(k => k.x === target.x && k.y === target.y);
        return c && !c.dead ? this.cropAt(c) : null;
      };
      const p0 = at();
      if (!p0) return;
      this.spot(p0, 64);
      this.showHand(0, { x: p0.x - 120, y: p0.y + 40 });
      this.say(touchy ? t('Drag over it') : t('Move over it'), { x: p0.x, y: p0.y - 70 });
      await this.wait(700);
      this.live(my);
      // the ghost plays for real, in slow motion
      this.setTime(0.45);
      this.press(0);
      const before = peek()?.today.count || 0;
      await this.glide(0, () => at() || this.handAt[0], 700);
      const cut = await this.until(() => (peek()?.today.count || 0) > before, 2600);
      const t0 = performance.now();
      while (!cut && performance.now() - t0 < 900) {
        await this.glide(0, () => at() || this.handAt[0], 160);
      }
      this.lift(0);
      this.hideHand(0);
      this.spot(null);
      // the coins fly to the jar: that's what pays the bill
      const jar = bank();
      if (jar) {
        this.spotEl(jar, 6);
        const r = jar.getBoundingClientRect();
        this.say(t('Coins pay the bill'), { x: r.left + r.width / 2 + 40, y: r.bottom + 44 }, 28);
      }
      await this.wait(1500);
      // your turn: the field waits for the first touch
      this.hole.hidden = true;
      this.setTime(0.0001);
      const next = nearestCrop(this, { x: innerWidth * 0.55, y: innerHeight * 0.6 });
      const p1 = next ? this.cropAt(next) : { x: innerWidth / 2, y: innerHeight * 0.6 };
      this.spot(p1, 70);
      this.say(t('Your turn'), { x: p1.x, y: p1.y - 76 });
      this.showHand(0, { x: p1.x - 60, y: p1.y + 30 });
      this.hands[0].classList.add('hint');
      const touched = await this.until(() => !!peek()?.pointer.active, 15000);
      this.hands[0].classList.remove('hint');
      this.hideHand(0);
      this.spot(null);
      this.hush();
      this.restoreTime();
      if (!touched) return;
      const count = peek()?.today.count || 0;
      if (await this.until(() => (peek()?.today.count || 0) > count, 6000)) {
        this.say(t('Nice!'), undefined, 40);
        await this.wait(800);
      }
    });
  }

  /** Level 0, the practice farm (v0.11.1, Navid 3 Nov: "make a level 0 where people can train, and it should wait until
   *  the player actually does it"). The daylight clock is stopped (the shell's job) while the player learns to cut and
   *  chain; each step waits for the player. Resolves when the player has done them all.
   *  0.16 (Navid, 18 Nov: "our toturial is shit. please look at other games that clearly show player what to do
   *  beautifully and with animation"): every step is a tip on the thing itself: the carrot lit with a hand dragging over
   *  it, a bar for five carrots, the jar and Arthur's bill pointed at, a bar for the chain, then the sun. */
  async practice(o: {
    jar: () => Element | null;
    bill: () => Element | null;
    chain: () => Element | null;
    sun: () => Element | null;
    combo: () => number;
    onSun: () => void;
    onSkip: () => void;
  }): Promise<void> {
    await this.run(async () => {
      this.showSkip(t('Skip practice'), o.onSkip);
      const count = () => peek()?.today.count || 0;
      await this.until(() => (peek()?.crops || []).filter(c => !c.dead && c.age > 0.35).length >= 2, 3000);
      // 1. a carrot lit up, a ghost hand dragging across it, until the player cuts one
      let aim: Pt | null = null;
      let lock: { x: number; y: number } | null = null;
      const carrot = (): Pt | null => {
        const p = peek();
        let c = lock && p ? p.crops.find(k => !k.dead && k.x === lock!.x && k.y === lock!.y) : undefined;
        if (!c) {
          const n = nearestCrop(this, aim || { x: innerWidth * 0.5, y: innerHeight * 0.62 });
          c = n && p ? p.crops.find(k => k.x === n.x && k.y === n.y) : undefined;
          lock = c ? { x: c.x, y: c.y } : null;
        }
        if (!c) return aim;
        aim = this.cropAt(c);
        return aim;
      };
      await this.tip({
        at: carrot,
        r: 64,
        mode: 'play',
        hand: 'drag',
        dim: true,
        icon: cropIcon('carrot'),
        title: touchy ? t('Drag your finger over the carrot') : t('Move the mouse over the carrot'),
        text: t('Keep the sickle on it: a carrot takes 2 cuts.'),
        done: () => count() >= 1,
      });
      await this.cheer(aim, t('Nice!'));
      // 2. five carrots, with a bar
      const goal = 5;
      await this.tip({
        mode: 'play',
        dim: false,
        place: 'top',
        icon: cropIcon('carrot'),
        title: t('Cut 5 carrots'),
        text: t('Every carrot pays you coins.'),
        progress: () => ({ text: `${Math.min(count(), goal)} / ${goal}`, share: count() / goal }),
        done: () => count() >= goal,
      });
      await this.cheer(null, t('Great!'));
      // 3. the coins are in the jar; 4. Arthur's bill
      await this.tip({ el: o.jar, pad: 6, title: t('Your coins go into this jar'), text: t('The jar pays your bills.') });
      await this.tip({ el: o.bill, pad: 6, arthur: true, title: t('And this is my bill!'), text: t('At dusk on its day, your jar pays me. If it is short, I take half of it!') });
      // 5. a chain, with a bar
      const chainGoal = 5;
      await this.tip({
        el: o.chain,
        pad: 6,
        mode: 'play',
        dim: false,
        title: t('Now make a chain'),
        text: t('Cut carrots one right after another. A long chain pays more.'),
        progress: () => ({ text: `${t('Chain')} ${Math.min(o.combo(), chainGoal)} / ${chainGoal}`, share: o.combo() / chainGoal }),
        done: () => o.combo() >= chainGoal,
      });
      await this.cheer(null, t('Nice!'));
      // 6. the sun: the shell starts the clock; the day ends at dusk
      await this.tip({ el: o.sun, pad: 4, title: t('The sun is your clock'), text: t('When it sets, the day ends. Cut all you can!') });
      o.onSun();
      await this.until(() => peek()?.mode !== 'day', 30000);
    });
  }

  /** A first-time sight on the field: slow motion, a spotlight that follows it, a word or two. */
  async moment(where: () => Pt | null, word: string, ms = 1500, r = 64): Promise<void> {
    await this.run(async () => {
      const p = where();
      if (!p) return;
      this.setTime(0.22);
      this.spot(p, r);
      this.say(word, { x: p.x, y: p.y - r - 14 }, 32);
      await this.tween(
        ms,
        () => {
          const q = where();
          if (!q) return;
          this.spot(q, r);
          this.cap.style.left = `${Math.max(90, Math.min(innerWidth - 90, q.x)).toFixed(0)}px`;
          this.cap.style.top = `${Math.max(48, q.y - r - 14).toFixed(0)}px`;
        },
        t => t,
      );
    });
  }

  /** A first sight on the HUD (the rival, the chain, a rush): slow motion and a spotlight on it. */
  async momentEl(el: () => Element | null, word: string, ms = 1500, slow = 0.3): Promise<void> {
    await this.run(async () => {
      const e = el();
      if (!e) return;
      this.setTime(slow);
      this.spotEl(e, 6);
      const r = e.getBoundingClientRect();
      const below = r.bottom + 70 < innerHeight;
      this.say(word, { x: r.left + r.width / 2, y: below ? r.bottom + 52 : r.top - 10 }, 30);
      await this.wait(ms);
    });
  }

  // ---------------------------------------------------------------- tips (0.16)

  private hideTip(): void {
    this.tips?.hide();
  }

  /** One tip, inside a running script: it stays until the player taps (a 'tap' tip) or does what it asks (`done`).
   *  Resolves true when it was done, false when it gave up (`ms`). */
  async tip(o: TipOpts): Promise<boolean> {
    const my = this.token;
    const mode = o.mode || 'tap';
    this.root.hidden = false;
    this.tips.show(o, cv => arthurTalk(cv));
    let held = false;
    if (o.hold ?? mode === 'tap') {
      try {
        held = engine().hold(true);
      } catch {
        held = false;
      }
    }
    let tapped = false;
    const off = mode === 'tap' ? this.tips.onTap(() => (tapped = true)) : null;
    // a 'tap' tip can't be tapped away in its first moments (a tap meant for the field must not skip it)
    const t0 = performance.now();
    const minMs = mode === 'tap' ? 450 : 0;
    const hand = o.hand;
    this.pic = true;
    try {
      return await new Promise<boolean>((res, rej) => {
        const tick = () => {
          if (my !== this.token) return rej(new Stop());
          const now = performance.now();
          let c = this.tips.place(o);
          if (o.progress) this.tips.setProgress(o);
          // the ghost hand: on the spotlight's middle, or on the thing `handOn` names (none while it is missing)
          if (o.handOn) {
            const he = o.handOn();
            const hr = he ? he.getBoundingClientRect() : null;
            c = hr && hr.width > 0 ? { cx: hr.left + hr.width / 2, cy: hr.top + hr.height / 2 } : null;
          }
          if (hand && c) {
            const k = ((now - t0) % 1400) / 1400;
            if (hand === 'tap') {
              this.showHand(0, { x: c.cx + 6, y: c.cy + 10 - (k < 0.3 ? (0.3 - k) * 40 : 0) });
              if (k > 0.3 && k < 0.55) this.hands[0].classList.add('down');
              else this.hands[0].classList.remove('down');
            } else {
              const span = 90;
              const x = c.cx - span + span * 2 * Math.min(1, k / 0.75);
              this.showHand(0, { x, y: c.cy + 12 });
              this.hands[0].classList.toggle('down', k < 0.78);
            }
          } else if (hand) this.hands[0].hidden = true;
          let ok = false;
          try {
            ok = o.done ? o.done() : false;
          } catch {
            ok = false;
          }
          if (ok) return res(true);
          if (mode === 'tap' && tapped && now - t0 >= minMs) return res(true);
          if (mode === 'tap') tapped = false;
          if (o.ms && now - t0 > o.ms) return res(false);
          requestAnimationFrame(tick);
        };
        tick();
      });
    } finally {
      off?.();
      this.pic = false;
      if (hand) {
        this.hands[0].classList.remove('down');
        this.hands[0].hidden = true;
      }
      this.tips.hide();
      if (held) {
        try {
          engine().hold(false);
        } catch {
          /* the engine is gone */
        }
      }
    }
  }

  /** Tips one after another, as a script of their own (Skip ends them). Resolves true if all were shown. */
  async tour(steps: Array<TipOpts | (() => Promise<void>)>, onSkip?: () => void): Promise<boolean> {
    return this.run(async () => {
      if (onSkip) this.showSkip(t('Skip'), onSkip);
      for (const s of steps) {
        if (typeof s === 'function') await s();
        else await this.tip(s);
      }
    });
  }

  /** Well done: a burst of stars and a word. */
  async cheer(at: Pt | null, word = t('Nice!')): Promise<void> {
    const p = at || { x: innerWidth / 2, y: innerHeight * 0.45 };
    this.tips.burst(p);
    this.say(word, { x: p.x, y: p.y - 40 }, 40);
    await this.wait(750);
    this.hush();
  }

  /** Points at a button the player should press (the Start button, a chest): waits until `done`. */
  async point(el: () => Element | null, word: string, done: () => boolean, ms = 60000): Promise<void> {
    await this.run(async () => {
      const e = el();
      if (!e) return;
      this.spotEl(e, 8);
      const r = e.getBoundingClientRect();
      const below = r.bottom + 90 < innerHeight;
      this.say(word, { x: r.left + r.width / 2, y: below ? r.bottom + 110 : r.top - 16 }, 32);
      const t0 = performance.now();
      while (!done() && performance.now() - t0 < ms) {
        const e2 = el();
        if (!e2) break;
        this.spotEl(e2, 8);
        await this.tapHint(e2, 1);
      }
    });
  }
}

export interface TipOpts {
  /** What the tip is about: a thing on screen, or a point on the field (screen px); neither: the bubble sits mid-screen. */
  el?: () => Element | null;
  at?: () => Pt | null;
  /** A field point's spotlight radius, and the margin around an element (screen px). */
  r?: number;
  pad?: number;
  /** A round spotlight on an element (a button, a chip). */
  round?: boolean;
  /** An icon (HTML) or Arthur Grumble, who speaks for the bank. */
  icon?: string;
  arthur?: boolean;
  title: string;
  text?: string;
  /** 'tap': a tap anywhere goes on (the field holds still); 'press': only the lit thing can be pressed, and the tip
   *  goes when done() is true; 'play': the field plays on, and the tip goes when done() is true. */
  mode?: 'tap' | 'press' | 'play';
  done?: () => boolean;
  /** A live progress line ("2 / 5") and how full its bar is (0..1). */
  progress?: () => { text: string; share: number } | null;
  /** A ghost hand on the thing: tapping it, or dragging across it. */
  hand?: 'tap' | 'drag';
  /** The hand on this instead of the spotlight's middle (no hand while it is missing). */
  handOn?: () => Element | null;
  /** A second thing lit and pressable with `el` (the spotlight takes in both). */
  also?: () => Element | null;
  /** Hold the field still while the tip is up (default: for 'tap' tips). */
  hold?: boolean;
  /** Dim everything around the spotlight (default: not for 'play' tips). */
  dim?: boolean;
  /** Give up after this long (ms; 'press' and 'play' tips). */
  ms?: number;
  /** Where the bubble goes: by the thing (default), or at the top or the bottom of the screen. */
  place?: 'auto' | 'top' | 'bottom';
}

/** The tips (0.16; Navid, 18 Nov: "the tutorial is not interactive at all. it is not showing which menu you are talking
 *  about"; "please look at other games that clearly show player what to do beautifully and with animation"): the
 *  screen dims around the thing a tip is about, a gold ring pulses on it, a fat arrow bounces at it, a ghost hand shows
 *  what to do, and a bubble of a few words says why. A tip that asks for something waits until the player does it. */
export class Tips {
  private wrap: HTMLElement;
  private spot: HTMLElement;
  private blks: HTMLElement[];
  private catcher: HTMLElement;
  private arrow: HTMLElement;
  private tip: HTMLElement;
  private who: HTMLElement;
  private go: HTMLElement;
  private burstEl: HTMLElement;
  private shownAt: Pt | null = null;
  private placed = { x: -1, y: -1 };

  constructor(root: HTMLElement) {
    const q = (s: string) => root.querySelector(s) as HTMLElement;
    this.wrap = root;
    this.spot = q('.ct-spot');
    this.blks = Array.from(root.querySelectorAll<HTMLElement>('.ct-blk'));
    this.catcher = q('.ct-catch');
    this.arrow = q('.ct-arrow');
    this.tip = q('.ct-tip');
    this.who = q('.ct-who');
    this.go = q('.ct-go');
    this.burstEl = q('.ct-burst');
  }

  /** Shows a tip's bubble with its words (the spotlight and the arrow follow in `place`). */
  show(o: TipOpts, arthur: (cv: HTMLCanvasElement) => void): void {
    const tip = this.tip;
    (tip.querySelector('.ct-t') as HTMLElement).textContent = o.title;
    const d = tip.querySelector('.ct-d') as HTMLElement;
    d.textContent = o.text || '';
    d.hidden = !o.text;
    const who = this.who;
    if (o.arthur) {
      // 0.16.1 (Navid, 19 Nov: "the circle is only show hat and top of arthur's face. not his whole face or body"):
      // all of his face, hat to bow tie, inside the circle
      who.innerHTML = `<canvas class="ct-arthur" data-w="48" data-h="48" data-tall="42"></canvas>`;
      who.hidden = false;
      who.className = 'ct-who arthur';
      arthur(who.querySelector('canvas') as HTMLCanvasElement);
    } else if (o.icon) {
      who.innerHTML = o.icon;
      who.hidden = false;
      who.className = 'ct-who';
    } else {
      who.innerHTML = '';
      who.hidden = true;
    }
    const mode = o.mode || 'tap';
    this.go.hidden = mode !== 'tap';
    this.go.textContent = t('Tap to continue');
    tip.classList.toggle('acting', mode !== 'tap');
    tip.hidden = false;
    tip.classList.remove('pop');
    void tip.offsetWidth;
    tip.classList.add('pop');
    this.placed = { x: -1, y: -1 };
    this.shownAt = null;
    this.setProgress(o);
  }

  setProgress(o: TipOpts): void {
    const p = this.tip.querySelector('.ct-p') as HTMLElement;
    const v = o.progress ? o.progress() : null;
    p.hidden = !v;
    if (!v) return;
    (p.querySelector('.ct-pt') as HTMLElement).textContent = v.text;
    (p.querySelector('.ct-pf') as HTMLElement).style.width = `${Math.round(Math.max(0, Math.min(1, v.share)) * 100)}%`;
  }

  /** Puts the spotlight, the arrow and the bubble around the target (called every frame). */
  place(o: TipOpts): { cx: number; cy: number } | null {
    const vw = innerWidth,
      vh = innerHeight;
    const mode = o.mode || 'tap';
    let box: { l: number; t: number; w: number; h: number; round: boolean } | null = null;
    const el = o.el ? o.el() : null;
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        const pad = o.pad ?? 8;
        let [l, tp, rt, bt] = [r.left, r.top, r.right, r.bottom];
        // a second thing (0.16.1: the chest's Upgrade button beside the chest): one spotlight around both
        const a2 = o.also ? o.also() : null;
        const r2 = a2 ? a2.getBoundingClientRect() : null;
        const two = !!r2 && r2.width > 0 && r2.height > 0;
        if (r2 && two) [l, tp, rt, bt] = [Math.min(l, r2.left), Math.min(tp, r2.top), Math.max(rt, r2.right), Math.max(bt, r2.bottom)];
        box = { l: l - pad, t: tp - pad, w: rt - l + pad * 2, h: bt - tp + pad * 2, round: !!o.round && !two };
      }
    } else if (o.at) {
      const p = o.at();
      if (p) {
        const rr = o.r ?? 60;
        box = { l: p.x - rr, t: p.y - rr, w: rr * 2, h: rr * 2, round: true };
      }
    }
    const dim = o.dim ?? mode !== 'play';
    const spot = this.spot;
    if (box) {
      Object.assign(spot.style, { left: `${box.l.toFixed(1)}px`, top: `${box.t.toFixed(1)}px`, width: `${box.w.toFixed(1)}px`, height: `${box.h.toFixed(1)}px` });
      spot.classList.toggle('round', box.round);
      spot.classList.toggle('dim', dim);
      spot.hidden = false;
    } else {
      spot.hidden = true;
    }
    this.wrap.classList.toggle('ct-dimall', dim && !box);
    // only the lit thing can be pressed ('press'): blockers cover the rest
    const blk = mode === 'press' && box;
    for (const b of this.blks) b.hidden = !blk;
    if (blk && box) {
      const [top, bot, left, right] = this.blks;
      Object.assign(top.style, { left: '0', top: '0', width: '100%', height: `${Math.max(0, box.t)}px` });
      Object.assign(bot.style, { left: '0', top: `${box.t + box.h}px`, width: '100%', bottom: '0', height: 'auto' });
      Object.assign(left.style, { left: '0', top: `${box.t}px`, width: `${Math.max(0, box.l)}px`, height: `${box.h}px` });
      Object.assign(right.style, { left: `${box.l + box.w}px`, top: `${box.t}px`, right: '0', width: 'auto', height: `${box.h}px` });
    }
    // the bubble: below the thing if there is room, else above, else beside it
    const tip = this.tip;
    const tr = tip.getBoundingClientRect();
    const tw = tr.width,
      th = tr.height;
    const gap = 58;
    let bx: number, by: number, dir: 'up' | 'down' | 'left' | 'right' | '' = '';
    if (!box || o.place === 'top' || o.place === 'bottom') {
      bx = (vw - tw) / 2;
      by = o.place === 'bottom' ? vh - th - 14 : o.place === 'top' ? 12 : (vh - th) / 2;
      if (box) dir = by > box.t + box.h ? 'up' : by + th < box.t ? 'down' : '';
    } else {
      const cx = box.l + box.w / 2;
      if (box.t + box.h + gap + th < vh - 6) {
        by = box.t + box.h + gap;
        dir = 'up';
      } else if (box.t - gap - th > 6) {
        by = box.t - gap - th;
        dir = 'down';
      } else {
        by = Math.max(8, Math.min(vh - th - 8, box.t + box.h / 2 - th / 2));
        dir = box.l + box.w / 2 > vw / 2 ? 'right' : 'left';
      }
      if (dir === 'left') bx = box.l + box.w + gap;
      else if (dir === 'right') bx = box.l - gap - tw;
      else bx = cx - tw / 2;
      bx = Math.max(10, Math.min(vw - tw - 10, bx));
    }
    // keep it still unless the thing really moved
    if (Math.abs(bx - this.placed.x) > 6 || Math.abs(by - this.placed.y) > 6) {
      this.placed = { x: bx, y: by };
      tip.style.left = `${bx.toFixed(0)}px`;
      tip.style.top = `${by.toFixed(0)}px`;
    }
    // the arrow, between the bubble and the thing, pointing at it
    const ar = this.arrow;
    if (box && dir) {
      const cx = box.l + box.w / 2,
        cy = box.t + box.h / 2;
      let ax = cx,
        ay = cy,
        rot = 0;
      if (dir === 'up') {
        ay = box.t + box.h + 4;
        rot = 0;
      } else if (dir === 'down') {
        ay = box.t - 4 - 52;
        rot = 180;
      } else if (dir === 'left') {
        ax = box.l + box.w + 4;
        ay = cy - 26;
        rot = -90;
      } else {
        ax = box.l - 4 - 46;
        ay = cy - 26;
        rot = 90;
      }
      if (dir === 'up' || dir === 'down') ax = Math.max(8, Math.min(vw - 54, cx - 23));
      ar.style.left = `${ax.toFixed(0)}px`;
      ar.style.top = `${ay.toFixed(0)}px`;
      ar.style.setProperty('--rot', `${rot}deg`);
      ar.hidden = false;
    } else ar.hidden = true;
    this.catcher.hidden = mode !== 'tap';
    if (!box) return null;
    return { cx: box.l + box.w / 2, cy: box.t + box.h / 2 };
  }

  /** A burst of gold stars at a point: well done. */
  burst(at: Pt): void {
    const b = this.burstEl;
    let html = '';
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const d = 60 + (k % 3) * 22;
      html += `<i style="--dx: ${(Math.cos(a) * d).toFixed(0)}px; --dy: ${(Math.sin(a) * d).toFixed(0)}px; --dl: ${((k % 4) * 0.03).toFixed(2)}s"></i>`;
    }
    b.innerHTML = html;
    b.style.left = `${at.x.toFixed(0)}px`;
    b.style.top = `${at.y.toFixed(0)}px`;
    b.hidden = false;
    b.classList.remove('go');
    void b.offsetWidth;
    b.classList.add('go');
    setTimeout(() => (b.hidden = true), 900);
  }

  hide(): void {
    this.spot.hidden = true;
    for (const b of this.blks) b.hidden = true;
    this.catcher.hidden = true;
    this.arrow.hidden = true;
    this.tip.hidden = true;
    this.wrap.classList.remove('ct-dimall');
    this.who.innerHTML = '';
  }

  /** The catcher: the next tap on it (a 'tap' tip goes on). */
  onTap(fn: () => void): () => void {
    const h = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      const pe = e as PointerEvent;
      if (pe.isTrusted) swallowClick(pe.clientX, pe.clientY);
      fn();
    };
    this.catcher.addEventListener('pointerdown', h);
    return () => this.catcher.removeEventListener('pointerdown', h);
  }
}

/** 0.16.1 (Navid, 19 Nov: the first chest's perk "doesn't show the first chosen perk ... it bugged and selected another
 *  one"): a phone sends its click after the finger lifts, and by then the tip is gone, so the click landed on whatever
 *  was under it (a card, a button). A tap that moves a tip on presses nothing else: that click is dropped. */
function swallowClick(x: number, y: number): void {
  const t0 = performance.now();
  const eat = (ev: MouseEvent) => {
    if (performance.now() - t0 < 900 && Math.hypot(ev.clientX - x, ev.clientY - y) < 48) {
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
    }
    off();
  };
  const off = () => {
    window.removeEventListener('click', eat, true);
    clearTimeout(timer);
  };
  const timer = setTimeout(off, 900);
  window.addEventListener('click', eat, true);
}

/** The live crop nearest to a screen point. */
function nearestCrop(co: Coach, at: Pt): { x: number; y: number; r: number; ds: number } | null {
  const p = peek();
  if (!p) return null;
  let best: FieldPeek['crops'][number] | null = null,
    bd = Infinity;
  for (const c of p.crops) {
    if (c.dead || c.boss || c.age < 0.3) continue;
    const s = co.cropAt(c);
    const d = Math.hypot(s.x - at.x, s.y - at.y);
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}

/** The screen point with the most live crops around it (where a cleave pays most). */
function densest(co: Coach): Pt | null {
  const p = peek();
  if (!p) return null;
  const live = p.crops.filter(c => !c.dead && !c.boss && c.age > 0.3).map(c => co.cropAt(c));
  if (!live.length) return null;
  let best = live[0],
    bn = -1;
  for (const a of live) {
    const n = live.filter(b => Math.hypot(a.x - b.x, a.y - b.y) < 120).length;
    if (n > bn) {
      bn = n;
      best = a;
    }
  }
  return best;
}
