// Arthur Grumble of Grumble & Sons (v0.12, Navid 5 Nov: "yes to arthur"): Top Hat Tubby, simpler and animated.
// The drawing is arthur-art.js (window.DBD_ARTHUR: create, draw, react); this gives him a canvas and his moods:
//   start of the day: neutral · behind on tonight's bill: gloats, more the further behind and the nearer dusk ·
//   ahead (the bill is covered): angry · the morning after a bill is paid: stomps, then sulks ·
//   his crow chased off: shock · his crow steals: a quick gloat · the farm won: faints · the farm lost: a jig.
import './arthur-art.js';

export type ArthurMood = 'neutral' | 'gloat' | 'sad' | 'angry';
export type ArthurReaction = 'stomp' | 'shock' | 'faint' | 'recover';

interface ArthurState {
  react(name: ArthurReaction): void;
}
interface ArthurArt {
  create(): ArthurState;
  draw(ctx: CanvasRenderingContext2D, st: ArthurState, x: number, y: number, h: number, mood: ArthurMood, intensity: number, t: number, dt: number, reduced: boolean): void;
}

const art = (): ArthurArt | null => (window as unknown as { DBD_ARTHUR?: ArthurArt }).DBD_ARTHUR || null;

function calm(): boolean {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * One Arthur on a canvas, feet at the bottom centre. `w`, `h` are the canvas's CSS size before any group scaling;
 * `tall` is his height in those units. Call frame() every animation frame while it is on screen.
 */
export class ArthurView {
  mood: ArthurMood = 'neutral';
  intensity = 0;
  private st: ArthurState | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private k = 0;
  private measured = 0;
  private reduced = calm();

  constructor(
    private cv: HTMLCanvasElement,
    private w: number,
    private h: number,
    private tall: number,
    private feet = 4,
    private dx = 0,
  ) {
    addEventListener('resize', () => (this.measured = 0));
  }

  private state(): ArthurState | null {
    const a = art();
    if (!a) return null;
    if (!this.st) this.st = a.create();
    return this.st;
  }

  react(r: ArthurReaction): void {
    this.state()?.react(r);
  }

  /** Size the bitmap to the canvas as it is on screen (the HUD and the cards are scaled with --s). */
  private fit(now: number): boolean {
    if (this.measured && now - this.measured < 1.5) return this.k > 0;
    this.measured = now;
    const r = this.cv.getBoundingClientRect();
    if (!(r.width > 0)) return false;
    const k = Math.min(4, (r.width / this.w) * Math.min(3, devicePixelRatio || 1));
    if (Math.abs(k - this.k) > 0.01) {
      this.k = k;
      this.cv.width = Math.max(1, Math.round(this.w * k));
      this.cv.height = Math.max(1, Math.round(this.h * k));
    }
    if (!this.ctx) this.ctx = this.cv.getContext('2d');
    return !!this.ctx;
  }

  /** `now` in seconds. */
  frame(now: number, dt: number): void {
    const a = art(),
      st = this.state();
    if (!a || !st || !this.fit(now) || !this.ctx) return;
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.cv.width, this.cv.height);
    c.setTransform(this.k, 0, 0, this.k, 0, 0);
    a.draw(c, st, this.w / 2 + this.dx, this.h - this.feet, this.tall, this.mood, this.intensity, now, dt, this.reduced);
  }
}

/** Runs an Arthur on a card (won: he faints; lost: he dances) until the canvas leaves the page. */
export function arthurOnCard(cv: HTMLCanvasElement | null, kind: 'won' | 'lost'): void {
  if (!cv) return;
  const v = new ArthurView(cv, Number(cv.dataset.w) || 120, Number(cv.dataset.h) || 96, Number(cv.dataset.tall) || 74, 3, Number(cv.dataset.dx) || 0);
  v.mood = kind === 'won' ? 'sad' : 'gloat';
  v.intensity = kind === 'won' ? 0 : 1;
  let last = 0;
  const t0 = performance.now();
  let fainted = false;
  const loop = (ms: number) => {
    if (!cv.isConnected) return;
    const now = ms / 1000;
    const dt = last ? Math.min(0.1, now - last) : 1 / 60;
    last = now;
    // the deed is paid: he sulks for a moment, then faints (and stays down)
    if (kind === 'won' && !fainted && ms - t0 > 700) {
      fainted = true;
      v.react('faint');
    }
    v.frame(now, dt);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
