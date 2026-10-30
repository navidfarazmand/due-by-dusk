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

const COACH_HTML = `<div id="dbdCoach" hidden>
  <div class="co-block"></div>
  <div class="co-bars"><i></i><i></i></div>
  <div class="co-veil"></div>
  <div class="co-hole" hidden></div>
  <div class="co-cap" hidden></div>
  <div class="co-hand" data-i="0" hidden><span class="co-press"></span>${HAND}</div>
  <div class="co-hand" data-i="1" hidden><span class="co-press"></span>${HAND}</div>
  <div class="co-boom" hidden></div>
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
  private token = 0;
  private handAt: Pt[] = [{ x: -99, y: -99 }, { x: -99, y: -99 }];
  private down = [false, false];
  private onSkip: (() => void) | null = null;
  /** A lesson or moment is on screen. */
  busy = false;

  constructor() {
    document.body.insertAdjacentHTML('beforeend', COACH_HTML);
    this.root = document.getElementById('dbdCoach') as HTMLElement;
    const q = (s: string) => this.root.querySelector(s) as HTMLElement;
    this.veil = q('.co-veil');
    this.hole = q('.co-hole');
    this.cap = q('.co-cap');
    this.hands = Array.from(this.root.querySelectorAll<HTMLElement>('.co-hand'));
    this.boom = q('.co-boom');
    this.skip = q('.co-skip') as HTMLButtonElement;
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

  /** Shows finger `i` at `p` (it only touches the field when `press` is used). */
  showHand(i: 0 | 1, p: Pt): void {
    const h = this.hands[i];
    h.hidden = false;
    this.handAt[i] = { ...p };
    h.style.transform = `translate(${(p.x - TIP.x).toFixed(1)}px, ${(p.y - TIP.y).toFixed(1)}px)`;
    if (this.down[i]) this.touch('pointermove', i, p);
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
      this.touch('pointerdown', i, this.handAt[i]);
    }
  }

  lift(i: 0 | 1): void {
    this.hands[i]?.classList.remove('down');
    if (this.down[i]) {
      this.down[i] = false;
      this.touch('pointerup', i, this.handAt[i]);
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
    this.showHand(0, { x: p.x + 40, y: p.y + 60 });
    await this.glide(0, p, 420);
    for (let k = 0; k < times; k++) {
      this.press(0, false);
      await this.wait(220);
      this.lift(0);
      await this.wait(380);
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

  /** The Charge Cleave: one finger on the crops, a second finger held anywhere, lift it. Then the player's turn. */
  async cleaveLesson(cleaved: () => number): Promise<boolean> {
    let learned = false;
    await this.run(async () => {
      await this.until(() => (peek()?.crops || []).filter(c => !c.dead && c.age > 0.35).length >= 3, 2500);
      this.setTime(0.0001);
      const spotC = densest(this);
      if (!spotC) return;
      const p1 = spotC;
      const w = innerWidth,
        h = innerHeight;
      const p2 = { x: Math.min(w - 70, p1.x + 230), y: Math.min(h - 60, p1.y + 70) };
      this.spot(p1, 96);
      if (touchy) {
        this.showHand(0, { x: p1.x - 90, y: p1.y + 60 });
        await this.glide(0, p1, 450);
        this.setTime(0.5);
        this.press(0);
        await this.wait(350);
        this.showHand(1, { x: p2.x + 60, y: p2.y + 60 });
        await this.glide(1, p2, 380);
        this.say(t('Hold a 2nd finger'), { x: p2.x, y: p2.y - 78 }, 28);
        this.press(1);
        await this.until(() => (peek()?.chargeT || 0) >= 0.98, 2500);
        this.say(t('Lift!'), { x: p2.x, y: p2.y - 78 }, 40);
        await this.wait(250);
        const n = cleaved();
        this.lift(1);
        await this.until(() => cleaved() > n, 900);
        await this.wait(450);
        this.lift(0);
        this.hideHand(1);
        this.hideHand(0);
      } else {
        // mouse: hold the button over the crops, let go
        this.showHand(0, { x: p1.x - 90, y: p1.y + 60 });
        await this.glide(0, p1, 450);
        this.setTime(0.5);
        this.say(t('Hold the button'), { x: p1.x, y: p1.y - 90 }, 28);
        this.hands[0].classList.add('down');
        await this.wait(1100);
        this.say(t('Let go!'), { x: p1.x, y: p1.y - 90 }, 40);
        this.hands[0].classList.remove('down');
        await this.wait(700);
        this.hideHand(0);
      }
      // your turn
      this.setTime(0.0001);
      this.spot(null);
      const q = densest(this) || p1;
      this.say(t('Your turn'), { x: q.x, y: q.y - 90 });
      if (touchy) {
        this.showHand(0, q);
        this.showHand(1, { x: Math.min(w - 70, q.x + 230), y: Math.min(h - 60, q.y + 70) });
        for (const k of this.hands) k.classList.add('hint');
      }
      const touched = await this.until(() => !!peek()?.pointer.active, 15000);
      for (const k of this.hands) k.classList.remove('hint');
      this.hideHand(0);
      this.hideHand(1);
      this.hush();
      this.restoreTime();
      if (!touched) return;
      const n0 = cleaved();
      learned = await this.until(() => cleaved() > n0, 9000);
      if (learned) {
        this.say(t('Cleave!'), undefined, 42);
        await this.wait(900);
      }
    });
    return learned;
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
