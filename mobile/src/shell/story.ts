// The story (0.16; Navid, 18 Nov: "why on earth you didn't talk about bills, what is the story of the game at all").
// Four short animated scenes before the practice farm, a few words each (about eight, as tutorials should):
//   1. the farm at dusk: the vegetables run away;
//   2. the world map: they hide in towns all over it, a flag pops up for each country;
//   3. Arthur Grumble slaps down a bill: his bank lends a farm in every town, pay its bills on time;
//   4. a net drops on a runaway: pay a town's last, big bill and it is caught, and it works in the Pen.
// A tap goes to the next scene (not before it has played a moment); Skip ends it. Plays again from Settings.

import { t } from '../i18n/i18n';
import { ART, SPRITE } from './art';
import { ArthurView } from './arthur';
import { PINS } from './pins';
import { money } from './dom';
import { planFor } from '../game/plan';
import { ROUTE } from '../game/world';

const INK = '#2B1708';

/** The country's runaway the map shows peeking out by its flag. */
const MAP_CROPS: Array<[string, string]> = [
  ['CA', 'carrot'], ['US', 'habanero'], ['BR', 'mandioca'], ['MA', 'chickpea'], ['FR', 'lavender'], ['CN', 'bittermelon'], ['JP', 'kabocha'],
];
/** The vegetables that run off the farm, where they run to (share of the stage) and when they start. */
const RUNNERS: Array<[string, number, number, number]> = [
  ['carrot', -0.62, -0.05, 0.15], ['radish', 0.6, -0.12, 0.3], ['cabbage', -0.45, 0.18, 0.45], ['pumpkin', 0.5, 0.2, 0.55], ['onion', 0.1, -0.32, 0.7], ['potato', -0.15, 0.3, 0.85],
];

function img(type: string, h: number, cls = ''): string {
  const u = SPRITE[type];
  return u ? `<img class="${cls}" src="${u}" alt="" style="height: ${h}px" draggable="false">` : '';
}

const NET = `<svg viewBox="0 0 120 100" aria-hidden="true"><path d="M8 92 Q60 -20 112 92" fill="rgba(255,248,220,.15)" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><path d="M22 92 Q60 6 98 92 M36 92 Q60 30 84 92 M50 92 Q60 52 70 92" fill="none" stroke="${INK}" stroke-width="3"/><path d="M14 70 H106 M24 46 H96 M40 24 H80" stroke="${INK}" stroke-width="3"/><path d="M60 2 V-30" stroke="${INK}" stroke-width="6" stroke-linecap="round"/></svg>`;
const PEN = `<svg viewBox="0 0 220 80" aria-hidden="true"><g fill="#C68A4E" stroke="${INK}" stroke-width="4" stroke-linejoin="round">${[10, 60, 110, 160, 200]
  .map(x => `<path d="M${x} 78 V20 L${x + 6} 10 L${x + 12} 20 V78 Z"/>`)
  .join('')}<rect x="4" y="30" width="212" height="10" rx="3"/><rect x="4" y="56" width="212" height="10" rx="3"/></g></svg>`;

function scene(i: number): string {
  if (i === 0) {
    const runners = RUNNERS.map(
      ([type, dx, dy, dl], k) =>
        `<span class="sty-run" style="--dx: ${dx}; --dy: ${dy}; --dl: ${dl}s; left: ${44 + (k % 3) * 5}%; top: ${60 + Math.floor(k / 3) * 8}%"><span class="sty-hop">${img(type, 64)}<i class="sty-bang">!</i></span><i class="sty-dust"></i></span>`,
    ).join('');
    return `<div class="sty-scene s-farm"><img class="sty-bg" src="${ART.menu}" alt="" draggable="false">${runners}</div>`;
  }
  if (i === 1) {
    const pins = MAP_CROPS.map(([code, type], k) => {
      const p = PINS[code];
      if (!p) return '';
      return `<span class="sty-pin" style="left: ${((p.left / 844) * 100).toFixed(2)}%; top: ${((p.top / 390) * 100).toFixed(2)}%; --dl: ${(0.25 + k * 0.22).toFixed(2)}s">${img(type, 46, 'sty-peek')}<span class="sty-flag">${p.flag}</span></span>`;
    }).join('');
    return `<div class="sty-scene s-map"><div class="sty-map"><img class="sty-mapimg" src="${ART.world}" alt="" draggable="false">${pins}</div></div>`;
  }
  if (i === 2) {
    return `<div class="sty-scene s-bank"><div class="sty-wall"></div><canvas class="sty-arthur" data-w="200" data-h="220" data-tall="190"></canvas>
      <div class="sty-bill"><span class="sb-bank">${t('GRUMBLE &amp; SONS SAVINGS &amp; LOAN')}</span><b>${t('Bank loan')}</b><span class="sb-amt">${money(planFor(ROUTE[0].id).bills[0].amt)}</span><span class="sb-due">${t('Due at dusk')}</span><span class="sb-stamp">${t('PAY ON TIME')}</span></div></div>`;
  }
  return `<div class="sty-scene s-catch"><img class="sty-bg" src="${ART.menu}" alt="" draggable="false"><span class="sty-catchme">${img('carrot', 80)}</span><span class="sty-net">${NET}</span>
    <span class="sty-caught">${t('CAUGHT!')}</span><span class="sty-pen">${PEN}<span class="sty-worker">${img('carrot', 44)}</span><i class="sty-coin" style="--dl: 2.6s"></i><i class="sty-coin" style="--dl: 3s"></i><i class="sty-coin" style="--dl: 3.4s"></i></span></div>`;
}

const CAPTIONS: Array<[string, string]> = [
  ['Oh no! Your vegetables ran away!', 'They left the farm in the night.'],
  ['They are hiding all over the world.', 'One in every town, from Canada to Japan.'],
  ["Arthur's bank lends you a farm in each town.", 'Pay his bills on time, or he takes half your jar.'],
  ["Pay a town's last, big bill to catch its runaway.", 'Caught runaways work for you in the Pen.'],
];

/** Plays the story; resolves when it is over or skipped. */
export function playStory(): Promise<void> {
  return new Promise(resolve => {
    const root = document.createElement('div');
    root.id = 'dbdStory';
    root.innerHTML = `<div class="sty-stage"></div>
      <div class="sty-cap"><b class="sty-t"></b><span class="sty-d"></span></div>
      <div class="sty-dots">${CAPTIONS.map(() => '<i></i>').join('')}</div>
      <span class="sty-tap">${t('Tap to continue')}</span>
      <button type="button" class="st-btn sty-skip">${t('Skip')}<svg width="14" height="16" viewBox="0 0 16 18" aria-hidden="true"><path d="M5 3l6 6-6 6" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
    document.body.append(root);
    const stage = root.querySelector('.sty-stage') as HTMLElement;
    const cap = root.querySelector('.sty-cap') as HTMLElement;
    const tap = root.querySelector('.sty-tap') as HTMLElement;
    let i = -1,
      shownAt = 0,
      done = false,
      raf = 0;
    let arthur: ArthurView | null = null;
    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      root.classList.add('out');
      setTimeout(() => {
        root.remove();
        resolve();
      }, 320);
    };
    const loop = (ms: number) => {
      if (done) return;
      if (arthur) arthur.frame(ms / 1000, 1 / 60);
      raf = requestAnimationFrame(loop);
    };
    const next = () => {
      if (done) return;
      i++;
      if (i >= CAPTIONS.length) return finish();
      stage.innerHTML = scene(i);
      const [title, line] = CAPTIONS[i];
      (cap.querySelector('.sty-t') as HTMLElement).textContent = t(title);
      (cap.querySelector('.sty-d') as HTMLElement).textContent = t(line);
      cap.classList.remove('pop');
      void cap.offsetWidth;
      cap.classList.add('pop');
      root.querySelectorAll('.sty-dots i').forEach((d, k) => d.classList.toggle('on', k <= i));
      tap.classList.remove('on');
      shownAt = performance.now();
      // the tap hint comes once the scene has played a moment
      setTimeout(() => {
        if (!done) tap.classList.add('on');
      }, 1500);
      const cv = stage.querySelector<HTMLCanvasElement>('.sty-arthur');
      arthur = null;
      if (cv) {
        arthur = new ArthurView(cv, 200, 220, 190, 6, 0);
        arthur.mood = 'gloat';
        arthur.intensity = 1;
      }
      try {
        navigator.vibrate?.(12);
      } catch {
        /* no vibration */
      }
    };
    root.addEventListener('pointerdown', e => {
      if ((e.target as HTMLElement).closest('.sty-skip')) return;
      e.preventDefault();
      if (performance.now() - shownAt < 700) return;
      next();
    });
    (root.querySelector('.sty-skip') as HTMLElement).addEventListener('click', e => {
      e.stopPropagation();
      finish();
    });
    next();
    raf = requestAnimationFrame(loop);
  });
}
