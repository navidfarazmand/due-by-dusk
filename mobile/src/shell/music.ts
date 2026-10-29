// Music and the rooster. Two looping tracks (one for the field, one for everything around it) that
// crossfade when the screen changes, plus a rooster crow at dawn. Plain <audio> elements, so they
// stream instead of sitting decoded in memory; they wait for the first tap before making a sound.

import fieldUrl from '../audio/field.mp3';
import menuUrl from '../audio/menu.mp3';
import roosterUrl from '../audio/rooster.mp3';

export type Mood = 'menu' | 'field';

const VOLUME: Record<Mood, number> = { field: 0.5, menu: 0.4 };
const FADE_PER_SEC = 1.4;

/** Shown in Settings → Credits. CC BY requires the credit and a note of changes. */
export const AUDIO_CREDITS = [
  {
    what: 'Field music',
    title: 'Hillbilly Swing',
    by: 'Kevin MacLeod (incompetech.com)',
    licence: 'CC BY 4.0',
    url: 'https://creativecommons.org/licenses/by/4.0/',
    note: 'Shortened and re-encoded to loop.',
  },
  {
    what: 'Menu music',
    title: "Gone Fishin'",
    by: 'Memoraphile (You’re Perfect Studio)',
    licence: 'CC0',
    url: 'https://creativecommons.org/publicdomain/zero/1.0/',
    note: '',
  },
  {
    what: 'Rooster',
    title: 'Rooster Crow',
    by: 'Mike Koenig (SoundBible.com)',
    licence: 'CC BY 3.0',
    url: 'https://creativecommons.org/licenses/by/3.0/',
    note: 'Trimmed and re-encoded.',
  },
];

export class Music {
  private tracks: Record<Mood, HTMLAudioElement>;
  private vol: Record<Mood, number> = { field: 0, menu: 0 };
  private mood: Mood = 'menu';
  private unlocked = false;
  private hidden = false;
  private adOn = false;
  private raf = 0;
  private last = 0;
  private rooster: HTMLAudioElement;

  constructor(private enabled: boolean) {
    const make = (src: string) => {
      const a = new Audio(src);
      a.loop = true;
      a.preload = 'auto';
      a.volume = 0;
      return a;
    };
    this.tracks = { field: make(fieldUrl), menu: make(menuUrl) };
    this.rooster = new Audio(roosterUrl);
    this.rooster.preload = 'auto';
    this.rooster.volume = 0.55;
    document.addEventListener('visibilitychange', () => this.setHidden(document.hidden));
    window.addEventListener('dbd:ad-open', () => {
      this.adOn = true;
      this.setHidden(this.hidden);
    });
    window.addEventListener('dbd:ad-close', () => {
      this.adOn = false;
      this.setHidden(document.hidden);
    });
  }

  /** Call from a user gesture: browsers only allow audio after one. */
  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    this.apply();
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.apply();
  }

  setMood(m: Mood): void {
    if (this.mood === m) return;
    this.mood = m;
    this.apply();
  }

  setHidden(h: boolean): void {
    this.hidden = h;
    if (h || this.adOn) {
      // stop right away when the app goes to the background
      for (const k of ['field', 'menu'] as Mood[]) {
        this.vol[k] = 0;
        this.tracks[k].volume = 0;
        this.tracks[k].pause();
      }
    }
    this.apply();
  }

  /** The dawn crow. Returns true when it played (so the engine skips its own dawn chime). */
  crow(soundOn: boolean): boolean {
    if (!soundOn || !this.unlocked || this.hidden) return false;
    try {
      this.rooster.currentTime = 0;
      void this.rooster.play().catch(() => {});
      return true;
    } catch {
      return false;
    }
  }

  private target(k: Mood): number {
    return this.enabled && this.unlocked && !this.hidden && !this.adOn && this.mood === k ? VOLUME[k] : 0;
  }

  private apply(): void {
    if (this.raf) return;
    this.last = 0;
    const step = (t: number) => {
      const dt = this.last ? Math.min(0.1, (t - this.last) / 1000) : 0.016;
      this.last = t;
      let busy = false;
      for (const k of ['field', 'menu'] as Mood[]) {
        const a = this.tracks[k];
        const goal = this.target(k);
        const v = this.vol[k];
        const nv = v < goal ? Math.min(goal, v + FADE_PER_SEC * VOLUME[k] * dt) : Math.max(goal, v - FADE_PER_SEC * VOLUME[k] * dt);
        this.vol[k] = nv;
        a.volume = Math.max(0, Math.min(1, nv));
        if (nv > 0 && a.paused) void a.play().catch(() => {});
        if (nv <= 0 && !a.paused) a.pause();
        if (nv !== goal) busy = true;
      }
      this.raf = busy ? requestAnimationFrame(step) : 0;
    };
    this.raf = requestAnimationFrame(step);
  }
}
