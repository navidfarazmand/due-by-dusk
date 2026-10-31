// Music and the rooster. Eight looping tracks; the player picks one for the field and one for everything
// around it (Settings → Music). They crossfade when the screen changes. Plain <audio> elements stream
// instead of sitting decoded in memory, and only the tracks in use are created. Nothing plays before
// the first touch (browsers require one).

import hillbilly from '../audio/music/hillbilly.mp3';
import meatball from '../audio/music/meatball.mp3';
import nothingBroken from '../audio/music/nothing_broken.mp3';
import onePolka from '../audio/music/one_polka.mp3';
import joyfulJungle from '../audio/music/joyful_jungle.mp3';
import jamboree from '../audio/music/jamboree.mp3';
import fireflies from '../audio/music/fireflies.mp3';
import goneFishin from '../audio/music/gone_fishin.mp3';
import roosterUrl from '../audio/rooster.mp3';

export type Mood = 'menu' | 'field';

export interface Track {
  id: string;
  title: string;
  by: string;
  licence: 'CC BY 4.0' | 'CC BY 3.0' | 'CC0';
  /** Where the credit links to. */
  source: string;
  /** What it sounds like, for the picker. */
  feel: string;
  url: string;
  /** Changes made for the game (CC BY asks for a note). */
  changes: string;
}

const BY4 = 'https://creativecommons.org/licenses/by/4.0/';
const BY3 = 'https://creativecommons.org/licenses/by/3.0/';
const CC0 = 'https://creativecommons.org/publicdomain/zero/1.0/';
export const LICENCE_URL: Record<Track['licence'], string> = { 'CC BY 4.0': BY4, 'CC BY 3.0': BY3, CC0 };

export const TRACKS: Track[] = [
  { id: 'meatball', title: 'Meatball Parade', by: 'Kevin MacLeod (incompetech.com)', licence: 'CC BY 4.0', source: 'https://incompetech.com', feel: 'Comic ukulele and brass, 150 BPM', url: meatball, changes: 'Shortened to loop and re-encoded.' },
  { id: 'hillbilly', title: 'Hillbilly Swing', by: 'Kevin MacLeod (incompetech.com)', licence: 'CC BY 4.0', source: 'https://incompetech.com', feel: 'Banjo and fiddle hoedown, 145 BPM', url: hillbilly, changes: 'Shortened to loop and re-encoded.' },
  { id: 'nothing_broken', title: 'Nothing Broken', by: 'Kevin MacLeod (incompetech.com)', licence: 'CC BY 4.0', source: 'https://incompetech.com', feel: 'Happy clarinets and flutes, 158 BPM', url: nothingBroken, changes: 'Intro and ending trimmed to loop, re-encoded.' },
  { id: 'one_polka', title: 'One', by: 'pheonton (OpenGameArt)', licence: 'CC BY 3.0', source: 'https://opengameart.org/content/one', feel: 'Silly polka, 130 BPM', url: onePolka, changes: 'Shortened to loop and re-encoded.' },
  { id: 'joyful_jungle', title: 'Joyful Jungle', by: 'MintoDog (OpenGameArt)', licence: 'CC0', source: 'https://opengameart.org/content/joyful-jungle', feel: 'Bouncy loop, 140 BPM', url: joyfulJungle, changes: '' },
  { id: 'jamboree', title: 'Jumping Jamboree', by: 'tcarisland (OpenGameArt)', licence: 'CC BY 4.0', source: 'https://opengameart.org/content/jumping-jamboree', feel: 'Banjo, xylophone and cowbell march, 128 BPM', url: jamboree, changes: 'Intro and ending trimmed to loop, re-encoded.' },
  { id: 'gone_fishin', title: "Gone Fishin'", by: 'Memoraphile @ You’re Perfect Studio (OpenGameArt)', licence: 'CC0', source: 'https://opengameart.org/content/gone-fishin', feel: 'Lazy banjo loop', url: goneFishin, changes: '' },
  { id: 'fireflies', title: 'Fireflies and Stardust', by: 'Kevin MacLeod (incompetech.com)', licence: 'CC BY 4.0', source: 'https://incompetech.com', feel: 'Relaxed banjo, mandolin and violin', url: fireflies, changes: 'Shortened to loop and re-encoded.' },
];

export const DEFAULT_TRACKS: Record<Mood, string> = { field: 'meatball', menu: 'gone_fishin' };

export function trackById(id: string): Track | undefined {
  return TRACKS.find(t => t.id === id);
}

const VOLUME: Record<Mood, number> = { field: 0.5, menu: 0.4 };
const PREVIEW_VOLUME = 0.45;
const FADE_PER_SEC = 0.9;
/** The rooster at full effects volume (it follows the Sound effects slider, not the music). */
const ROOSTER_VOLUME = 0.45;

/** Settings → volume sliders (v0.11): 0–100 %, 80 % by default. */
export const DEFAULT_VOLUME = 80;

/** A slider's percent as a gain. Squared, so the slider feels even to the ear (50 % is about -12 dB). */
export function volGain(pct: number): number {
  const v = Math.max(0, Math.min(1, (Number.isFinite(pct) ? pct : DEFAULT_VOLUME) / 100));
  return v * v;
}

/** One-file builds inline audio as data: URLs; blob URLs stream and seek better, so convert them. */
function playableSrc(src: string, set: (url: string) => void): void {
  if (!src.startsWith('data:')) {
    set(src);
    return;
  }
  fetch(src)
    .then(r => r.blob())
    .then(b => set(URL.createObjectURL(b)))
    .catch(() => set(src));
}

export class Music {
  private els = new Map<string, HTMLAudioElement>();
  private vol = new Map<string, number>();
  private choice: Record<Mood, string>;
  private mood: Mood = 'menu';
  private preview: string | null = null;
  private unlocked = false;
  private hidden = false;
  private adOn = false;
  private raf = 0;
  private last = 0;
  private rooster: HTMLAudioElement;
  /** Elements this class paused on purpose (any other pause is the system's, and gets retried). */
  private ourPause = new WeakSet<HTMLAudioElement>();
  private lastError = '';
  private retries = 0;
  /** The player's music volume, as a gain (Settings). */
  private gain = volGain(DEFAULT_VOLUME);
  /** The effects volume, for the rooster. */
  private sfxGain = volGain(DEFAULT_VOLUME);

  constructor(
    private enabled: boolean,
    choice?: Partial<Record<Mood, string>>,
  ) {
    this.choice = { ...DEFAULT_TRACKS };
    if (choice?.field && trackById(choice.field)) this.choice.field = choice.field;
    if (choice?.menu && trackById(choice.menu)) this.choice.menu = choice.menu;
    this.rooster = new Audio();
    this.rooster.preload = 'auto';
    this.rooster.volume = ROOSTER_VOLUME * this.sfxGain;
    playableSrc(roosterUrl, u => (this.rooster.src = u));
    document.addEventListener('visibilitychange', () => this.setHidden(document.hidden));
    window.addEventListener('dbd:ad-open', () => {
      this.adOn = true;
      this.setHidden(this.hidden);
    });
    window.addEventListener('dbd:ad-close', () => {
      this.adOn = false;
      this.setHidden(document.hidden);
    });
    // Every kind of tap counts: some phones only allow sound after the finger lifts (touchend, click), not on
    // pointerdown. Navid's phone stayed silent until he toggled the sound button.
    const gesture = () => this.unlock();
    for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'])
      document.addEventListener(ev, gesture, { capture: true, passive: true });
    // A watchdog: if the track that should be playing is paused, stalled or broken, start it again.
    setInterval(() => this.watch(), 1500);
  }

  /** Call from a user gesture: browsers only allow audio after one. Starts the wanted track right here, inside
   * the gesture, then the fade loop takes over. */
  unlock(): void {
    const first = !this.unlocked;
    this.unlocked = true;
    const w = this.wanted();
    if (w) {
      const a = this.el(w.id);
      if (a.paused) {
        if ((this.vol.get(w.id) || 0) <= 0) {
          this.vol.set(w.id, 0.01);
          a.volume = 0.01;
        }
        this.tryPlay(a);
      }
    }
    if (first || w) this.apply();
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  /** For the settings screen: what the music is doing right now. */
  status(): string {
    if (!this.enabled && !this.preview) return 'off';
    if (!this.unlocked) return 'waiting for a tap';
    if (this.hidden || this.adOn) return 'paused';
    const w = this.wanted();
    if (!w) return 'off';
    const a = this.els.get(w.id);
    if (!a) return 'starting';
    if (a.error) return `can't play (error ${a.error.code})`;
    if (!a.paused && a.currentTime > 0) return 'playing';
    return this.lastError ? `starting (${this.lastError})` : 'starting';
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.apply();
  }

  /** The two volume sliders, in percent. The music fades to its new level. */
  setVolumes(music: number, sfx: number): void {
    this.gain = volGain(music);
    this.sfxGain = volGain(sfx);
    this.apply();
  }

  setMood(m: Mood): void {
    if (this.mood === m) return;
    this.mood = m;
    this.apply();
  }

  /** The track picked for a slot. */
  picked(m: Mood): string {
    return this.choice[m];
  }

  pick(m: Mood, id: string): void {
    if (!trackById(id)) return;
    this.choice[m] = id;
    this.apply();
  }

  /** Plays a track on its own while the music picker is open (null ends the preview). */
  setPreview(id: string | null): void {
    const next = id && trackById(id) ? id : null;
    if (next === this.preview) return;
    this.preview = next;
    if (next) this.unlock();
    this.apply();
  }

  previewing(): string | null {
    return this.preview;
  }

  setHidden(h: boolean): void {
    this.hidden = h;
    if (h || this.adOn) {
      // stop right away when the app goes to the background or an ad plays
      for (const [id, a] of this.els) {
        this.vol.set(id, 0);
        a.volume = 0;
        this.pause(a);
      }
    }
    this.apply();
  }

  /** The dawn crow. Returns true when it played (so the engine skips its own dawn chime). */
  crow(soundOn: boolean): boolean {
    if (!soundOn || !this.unlocked || this.hidden) return false;
    try {
      this.rooster.volume = Math.min(1, ROOSTER_VOLUME * this.sfxGain);
      this.rooster.currentTime = 0;
      void this.rooster.play().catch(() => {});
      return true;
    } catch {
      return false;
    }
  }

  private tryPlay(a: HTMLAudioElement): void {
    this.ourPause.delete(a);
    try {
      const p = a.play();
      if (p && typeof p.catch === 'function')
        p.then(() => {
          this.lastError = '';
        }).catch((e: unknown) => {
          this.lastError = e instanceof Error ? e.name : 'blocked';
        });
    } catch (e) {
      this.lastError = e instanceof Error ? e.name : 'blocked';
    }
  }

  private pause(a: HTMLAudioElement): void {
    if (a.paused) return;
    this.ourPause.add(a);
    a.pause();
  }

  private el(id: string): HTMLAudioElement {
    let a = this.els.get(id);
    if (a) return a;
    const t = trackById(id)!;
    a = new Audio();
    a.loop = true;
    a.preload = 'auto';
    a.volume = 0;
    const el = a;
    // the system can pause a track (audio focus, a call): when that happens and it should still play, retry
    el.addEventListener('pause', () => {
      if (this.ourPause.has(el)) return;
      setTimeout(() => this.watch(), 400);
    });
    playableSrc(t.url, u => (el.src = u));
    this.els.set(id, a);
    this.vol.set(id, 0);
    return a;
  }

  /** The watchdog: whatever should be playing, is. A broken element is replaced. */
  private watch(): void {
    const w = this.wanted();
    if (!w) return;
    let a = this.els.get(w.id);
    if (a && a.error) {
      // replace a track that failed to load
      this.els.delete(w.id);
      this.vol.delete(w.id);
      a = undefined;
      this.retries++;
    }
    if (!a) a = this.el(w.id);
    if (a.paused) {
      if ((this.vol.get(w.id) || 0) <= 0) this.vol.set(w.id, 0.01);
      a.volume = Math.max(0.01, Math.min(1, this.vol.get(w.id) || 0.01));
      this.tryPlay(a);
      this.apply();
    }
  }

  /** Which track should be heard now, and how loud. */
  private wanted(): { id: string; vol: number } | null {
    if (!this.unlocked || this.hidden || this.adOn) return null;
    // a preview in the track picker plays even when the slider is at zero (at the default level then)
    if (this.preview) return { id: this.preview, vol: PREVIEW_VOLUME * (this.gain > 0 ? this.gain : volGain(DEFAULT_VOLUME)) };
    if (!this.enabled || this.gain <= 0) return null;
    return { id: this.choice[this.mood], vol: VOLUME[this.mood] * this.gain };
  }

  private apply(): void {
    const w = this.wanted();
    if (w) this.el(w.id);
    if (this.raf) return;
    this.last = 0;
    const step = (t: number) => {
      const dt = this.last ? Math.min(0.1, (t - this.last) / 1000) : 0.016;
      this.last = t;
      const want = this.wanted();
      let busy = false;
      for (const [id, a] of this.els) {
        const goal = want && want.id === id ? want.vol : 0;
        const v = this.vol.get(id) || 0;
        const stepV = FADE_PER_SEC * 0.5 * dt;
        const nv = v < goal ? Math.min(goal, v + stepV) : Math.max(goal, v - stepV);
        this.vol.set(id, nv);
        a.volume = Math.max(0, Math.min(1, nv));
        if (nv > 0 && a.paused) this.tryPlay(a);
        if (nv <= 0 && !a.paused) this.pause(a);
        if (nv !== goal) busy = true;
      }
      this.raf = busy ? requestAnimationFrame(step) : 0;
    };
    this.raf = requestAnimationFrame(step);
  }
}
