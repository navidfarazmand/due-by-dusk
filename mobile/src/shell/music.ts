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

  constructor(
    private enabled: boolean,
    choice?: Partial<Record<Mood, string>>,
  ) {
    this.choice = { ...DEFAULT_TRACKS };
    if (choice?.field && trackById(choice.field)) this.choice.field = choice.field;
    if (choice?.menu && trackById(choice.menu)) this.choice.menu = choice.menu;
    this.rooster = new Audio();
    this.rooster.preload = 'auto';
    this.rooster.volume = 0.7;
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
  }

  /** Call from a user gesture: browsers only allow audio after one. */
  unlock(): void {
    if (!this.unlocked) {
      this.unlocked = true;
      this.apply();
      return;
    }
    // a later touch retries anything the browser refused to start
    for (const [id, a] of this.els) if ((this.vol.get(id) || 0) > 0 && a.paused) void a.play().catch(() => {});
  }

  isUnlocked(): boolean {
    return this.unlocked;
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
        a.pause();
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

  private el(id: string): HTMLAudioElement {
    let a = this.els.get(id);
    if (a) return a;
    const t = trackById(id)!;
    a = new Audio();
    a.loop = true;
    a.preload = 'auto';
    a.volume = 0;
    playableSrc(t.url, u => (a!.src = u));
    this.els.set(id, a);
    this.vol.set(id, 0);
    return a;
  }

  /** Which track should be heard now, and how loud. */
  private wanted(): { id: string; vol: number } | null {
    if (!this.unlocked || this.hidden || this.adOn) return null;
    if (this.preview) return { id: this.preview, vol: PREVIEW_VOLUME };
    if (!this.enabled) return null;
    return { id: this.choice[this.mood], vol: VOLUME[this.mood] };
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
        if (nv > 0 && a.paused) void a.play().catch(() => {});
        if (nv <= 0 && !a.paused) a.pause();
        if (nv !== goal) busy = true;
      }
      this.raf = busy ? requestAnimationFrame(step) : 0;
    };
    this.raf = requestAnimationFrame(step);
  }
}
