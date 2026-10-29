// The farm HUD from Claude's v3 test: coin bank with the jar the coins fly into, chain pill, sun dial,
// Harvest Rush chip, sound and pause buttons, and the day's event banner that shrinks into a badge.

import { clamp, money, cap } from './dom';
import { engine, type DayEvent, type HudState } from './engine';

const EVENT_ICON: Record<string, string> = { market: '💰', gale: '🍂', rain: '🌧️', frost: '❄️', fair: '🧶', stampede: '🐐' };
// Gemini's and Claude's bill names, shortened to fit the bank chip (the notice keeps the full name)
const SHORT: Record<string, string> = {
  'Tractor transmission': 'Tractor', 'Pond water rights': 'Pond rights', "Grandma's pie insurance": 'Pie cover',
  'Property tax': 'Taxes', "The scarecrow's lawyer": 'Lawyer', 'Moose crossing sign': 'Moose sign',
  'Toque for the scarecrow': 'Toque', 'Hockey rink permit': 'Rink permit', 'BBQ smoker repair': 'Smoker',
  'Corn maze licence': 'Corn maze', 'Football pitch rental': 'Pitch', 'Samba school dues': 'Samba dues',
  'Château roof tiles': 'Roof tiles', 'Bullet train freight': 'Train freight', 'Kite festival fee': 'Kite fee',
  'Dragon boat paint': 'Boat paint', 'Souk stall rent': 'Stall rent', 'Wine cellar lock': 'Cellar lock',
};
const touchy = (() => {
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
})();

export function eventIcon(id: string): string {
  return EVENT_ICON[id] || '📰';
}

/** Phone players never see keyboard or mouse instructions. */
export function deviceText(t: string): string {
  return touchy ? String(t).replace(/Hold click\/Space:?/gi, 'Hold still:').replace(/click\/Space/gi, 'hold still') : t;
}

export const HUD_HTML = `<div id="dbdHud" hidden>
  <div class="grp tl">
    <div class="st-chip hb-bank" id="dbdBank">
      <div class="hb-cash" id="dbdCash">$0</div>
      <div class="hb-bar"><i id="dbdBillFill"></i></div>
      <div class="hb-bill"><span id="dbdBillName">Seed loan</span> <b id="dbdBillAmt">$20</b></div>
      <svg class="hb-jar" id="dbdJar" viewBox="0 0 30 34" aria-hidden="true">
        <defs><clipPath id="dbdJarClip"><path d="M7 9 L23 9 Q27 11 27 17 L27 27 Q27 31 23 31 L7 31 Q3 31 3 27 L3 17 Q3 11 7 9 Z"/></clipPath></defs>
        <rect x="8" y="3.5" width="14" height="5" rx="2" fill="#B9824B" stroke="#2B1708" stroke-width="2.2"/>
        <path d="M7 9 L23 9 Q27 11 27 17 L27 27 Q27 31 23 31 L7 31 Q3 31 3 27 L3 17 Q3 11 7 9 Z" fill="#DDF2FA"/>
        <g clip-path="url(#dbdJarClip)"><g id="dbdJarGold" transform="translate(0 22)"><rect x="2" y="9" width="26" height="24" fill="#FFC23D"/>
          <circle cx="6.5" cy="9.5" r="3.4" fill="#E3961C"/><circle cx="13" cy="9.5" r="3.4" fill="#E3961C"/><circle cx="19.5" cy="9.5" r="3.4" fill="#E3961C"/><circle cx="26" cy="9.5" r="3.4" fill="#E3961C"/></g></g>
        <path d="M7 9 L23 9 Q27 11 27 17 L27 27 Q27 31 23 31 L7 31 Q3 31 3 27 L3 17 Q3 11 7 9 Z" fill="none" stroke="#2B1708" stroke-width="2.4" stroke-linejoin="round"/>
        <path d="M6.5 21 L6.5 13.5" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </div>
    <button type="button" class="hb-badge" id="dbdBadge" hidden aria-label="Today's event">🐐</button>
    <div class="hb-chain" id="dbdChain">
      <span class="hb-mult" id="dbdMult">×1</span><span class="hb-clbl" id="dbdChainLbl">Chain 0</span>
      <span class="hb-cbar"><i id="dbdChainFill"></i></span><span class="hb-next" id="dbdNext">×1.25 at 8</span><i class="hb-ctimer" id="dbdChainTimer"></i>
    </div>
  </div>
  <div class="grp tc">
    <svg class="hb-dial" viewBox="0 0 160 70" aria-hidden="true">
      <path d="M40 60 A40 40 0 0 1 120 60 Z" fill="#FFF4DC" stroke="#2B1708" stroke-width="3" stroke-linejoin="round"/>
      <path d="M30 58 A50 50 0 0 1 130 58" fill="none" stroke="#2B1708" stroke-width="13" stroke-linecap="round"/>
      <path d="M30 58 A50 50 0 0 1 130 58" fill="none" stroke="#FFF4DC" stroke-width="7" stroke-linecap="round"/>
      <path id="dbdArc" d="M30 58 A50 50 0 0 1 130 58" fill="none" stroke="#FFC23D" stroke-width="7" stroke-linecap="round" stroke-dasharray="157.1" stroke-dashoffset="157.1"/>
      <circle id="dbdSun" cx="30" cy="58" r="10" fill="#FFD45C" stroke="#2B1708" stroke-width="3"/>
    </svg>
    <div class="hb-secs" id="dbdSecs">18s</div>
    <div class="st-chip hb-boss" id="dbdBoss" hidden>
      <svg class="hb-bcrown" viewBox="0 0 24 18" aria-hidden="true"><path d="M2 16 L1 3 L7 9 L12 1 L17 9 L23 3 L22 16 Z" fill="#FFC23D" stroke="#2B1708" stroke-width="2.2" stroke-linejoin="round"/><circle cx="12" cy="11" r="2.2" fill="#E5484D"/></svg>
      <span class="hb-bname" id="dbdBossName">King</span><span class="hb-bbar"><i id="dbdBossFill"></i></span>
    </div>
  </div>
  <div class="grp tr">
    <div class="st-chip hb-rush" id="dbdRush"><span class="rl" id="dbdRushLbl">RUSH</span><span class="rn" id="dbdRushN">0/22</span><span class="rbar"><i id="dbdRushFill"></i></span></div>
    <button type="button" class="st-btn st-sq hb-sound" id="dbdSound" aria-label="Sound">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2B1708" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="#2B1708"/><path class="w" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/><path class="x" d="M15.5 9.5l5 5M20.5 9.5l-5 5" style="display:none"/></svg>
    </button>
    <button type="button" class="st-btn st-sq hb-pause" id="dbdPause" aria-label="Pause">
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><rect x="3.5" y="2.5" width="4.5" height="15" rx="1.6" fill="#2B1708"/><rect x="12" y="2.5" width="4.5" height="15" rx="1.6" fill="#2B1708"/></svg>
    </button>
  </div>
  <div class="hb-bwrap"><div class="hb-banner" id="dbdBanner" hidden><span class="bic" id="dbdBannerIc">🐐</span><span class="btx"><span class="bt" id="dbdBannerT">Pasture stampede</span><span class="bd" id="dbdBannerD"></span></span></div></div>
</div>`;

type El = Record<string, HTMLElement & SVGElement>;

/** On side farms (daily, duel) the bank chip shows a target instead of a bill. */
export type HudGoal = (cash: number) => { name: string; amt: number };

export class FarmHud {
  private root: HTMLElement;
  private E: El = {} as El;
  private shown = 0;
  private lastCash = 0;
  private lastTier = 0;
  private lastT = 0;
  private bannerT = 0;
  private ev: DayEvent | null = null;
  private goal: HudGoal | null = null;
  visible = false;

  constructor(stage: HTMLElement, private onSound: () => void) {
    stage.insertAdjacentHTML('beforeend', HUD_HTML);
    this.root = document.getElementById('dbdHud') as HTMLElement;
    for (const k of ['Bank', 'Cash', 'BillFill', 'BillName', 'BillAmt', 'Jar', 'JarGold', 'Badge', 'Chain', 'Mult', 'ChainLbl', 'ChainFill', 'Next', 'ChainTimer',
      'Arc', 'Sun', 'Secs', 'Boss', 'BossName', 'BossFill', 'Rush', 'RushLbl', 'RushN', 'RushFill', 'Sound', 'Pause', 'Banner', 'BannerIc', 'BannerT', 'BannerD']) {
      this.E[k] = document.getElementById('dbd' + k) as HTMLElement & SVGElement;
    }
    this.E.Pause.addEventListener('click', () => engine().setPaused(true));
    this.E.Sound.addEventListener('click', () => this.onSound());
    this.E.Badge.addEventListener('click', () => this.showBanner(false));
    (window as any).__dbdCoin = () => this.coin();
  }

  setGoal(g: HudGoal | null): void {
    this.goal = g;
  }

  show(on: boolean): void {
    this.visible = on;
    this.root.hidden = !on;
  }

  dayStarted(ev: DayEvent): void {
    this.ev = ev;
    try {
      const h = engine().hud();
      this.shown = h.cash;
      this.lastCash = h.cash;
    } catch {
      /* engine not ready */
    }
    this.lastTier = 0;
    this.show(true);
    setTimeout(() => this.showBanner(true), 30);
  }

  dayEnded(): void {
    clearTimeout(this.bannerT);
    this.E.Banner.hidden = true;
  }

  syncSound(on: boolean): void {
    const w = this.E.Sound.querySelector('.w') as SVGElement | null, x = this.E.Sound.querySelector('.x') as SVGElement | null;
    if (w) w.style.display = on ? '' : 'none';
    if (x) x.style.display = on ? 'none' : '';
    this.E.Sound.setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
  }

  private coin(): void {
    this.shown += Math.max(1, (this.lastCash - this.shown) * 0.35);
    if (this.shown > this.lastCash) this.shown = this.lastCash;
    const jar = this.E.Jar;
    jar.classList.remove('bump');
    void jar.getBoundingClientRect();
    jar.classList.add('bump');
  }

  frame(now: number): void {
    const dt = this.lastT ? Math.min(0.1, (now - this.lastT) / 1000) : 0.016;
    this.lastT = now;
    if (!this.visible) return;
    let h: HudState;
    try {
      h = engine().hud();
    } catch {
      return;
    }
    const E = this.E;
    this.lastCash = h.cash;
    if (h.cash < this.shown) this.shown = h.cash;
    else this.shown += (h.cash - this.shown) * Math.min(1, dt * 0.9);
    if (Math.abs(h.cash - this.shown) < 0.5) this.shown = h.cash;
    E.Cash.textContent = money(this.shown);
    const goal = this.goal ? this.goal(h.cash) : null;
    const bill = goal || h.bill;
    const amt = bill ? bill.amt : 1,
      prog = clamp(this.shown / amt, 0, 1),
      covered = this.shown >= amt;
    E.BillFill.style.width = (prog * 100).toFixed(1) + '%';
    E.JarGold.setAttribute('transform', 'translate(0 ' + (22 * (1 - prog)).toFixed(2) + ')');
    E.Bank.classList.toggle('covered', covered);
    E.BillName.textContent = bill ? SHORT[bill.name] || bill.name : '';
    E.BillAmt.textContent = covered ? '✓' : money(amt);
    const tiers = h.tiers;
    let ti = 0;
    for (let i = 0; i < tiers.length; i++) if (h.combo >= tiers[i].count) ti = i;
    const last = tiers.length - 1,
      next = tiers[Math.min(ti + 1, last)];
    E.Chain.classList.toggle('on', h.combo > 0);
    E.Chain.classList.toggle('rush', h.rushT > 0);
    E.Mult.textContent = '×' + String(Math.round(h.mult * 100) / 100);
    E.ChainLbl.textContent = 'Chain ' + h.combo;
    const fill = ti === last ? 1 : clamp((h.combo - tiers[ti].count) / Math.max(1, next.count - tiers[ti].count), 0, 1);
    E.ChainFill.style.width = (fill * 100).toFixed(1) + '%';
    E.Next.textContent = h.rushT > 0 ? 'RUSH!' : ti === last ? 'max!' : '×' + next.mul + ' at ' + next.count;
    E.ChainTimer.style.width = (242 * clamp(h.comboT / Math.max(0.01, h.grace), 0, 1)).toFixed(1) + 'px';
    if (ti > this.lastTier) {
      E.Chain.classList.remove('bump');
      void E.Chain.getBoundingClientRect();
      E.Chain.classList.add('bump');
    }
    this.lastTier = ti;
    const f = clamp(1 - h.time / Math.max(0.01, h.dayLen), 0, 1),
      ang = Math.PI + f * Math.PI,
      late = h.mode === 'day' && h.time < 5;
    E.Arc.setAttribute('stroke-dashoffset', (157.1 * (1 - f)).toFixed(2));
    E.Arc.setAttribute('stroke', late ? '#F26B3A' : '#FFC23D');
    E.Sun.setAttribute('cx', (80 + 50 * Math.cos(ang)).toFixed(2));
    E.Sun.setAttribute('cy', (58 + 50 * Math.sin(ang)).toFixed(2));
    E.Sun.setAttribute('fill', late ? '#FF9A3D' : '#FFD45C');
    E.Secs.textContent = Math.ceil(Math.max(0, h.time)) + 's';
    E.Secs.classList.toggle('late', late);
    const rushing = h.rushT > 0;
    E.Rush.classList.toggle('on', rushing);
    E.RushLbl.textContent = rushing ? 'RUSH!' : 'RUSH';
    E.RushN.textContent = rushing ? h.rushT.toFixed(1) + 's' : h.rushCharge + '/' + h.rushGoal;
    E.RushFill.style.width = ((rushing ? h.rushT / h.rushDur : h.rushCharge / h.rushGoal) * 100).toFixed(1) + '%';
    const bo = h.boss;
    const bossOn = !!(bo && bo.onField && !bo.down);
    if (E.Boss.hidden === bossOn) E.Boss.hidden = !bossOn;
    if (bo && bossOn) {
      if (E.BossName.textContent !== bo.name) E.BossName.textContent = bo.name;
      E.BossFill.style.width = (clamp(bo.hp / Math.max(1, bo.max), 0, 1) * 100).toFixed(1) + '%';
      E.Boss.classList.toggle('angry', bo.phase > 0);
    }
  }

  private showBanner(first: boolean): void {
    const E = this.E;
    if (!this.ev) return;
    clearTimeout(this.bannerT);
    const icon = eventIcon(this.ev.id);
    E.BannerIc.textContent = icon;
    E.Badge.textContent = icon;
    E.BannerT.textContent = cap(this.ev.title);
    E.BannerD.textContent = deviceText(this.ev.desc);
    E.Banner.getAnimations().forEach(a => a.cancel());
    E.Banner.hidden = false;
    E.Banner.animate([{ opacity: 0, transform: 'translateY(12px) scale(.92)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], { duration: 220, easing: 'ease-out' });
    if (first) E.Badge.hidden = true;
    this.bannerT = window.setTimeout(() => this.shrink(), first ? 2600 : 1800);
  }

  private shrink(): void {
    const E = this.E;
    if (E.Banner.hidden) return;
    E.Badge.hidden = false;
    E.Badge.style.visibility = 'hidden';
    const b = E.Badge.getBoundingClientRect(),
      r = E.Banner.getBoundingClientRect();
    const s = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--s')) || 1;
    const dx = (b.left + b.width / 2 - (r.left + r.width / 2)) / s,
      dy = (b.top + b.height / 2 - (r.top + r.height / 2)) / s;
    const k = Math.max(0.12, b.width / Math.max(1, r.width));
    const a = E.Banner.animate(
      [{ transform: 'translate(0px, 0px) scale(1)', opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) scale(${k})`, opacity: 0.25 }],
      { duration: 460, easing: 'cubic-bezier(.55,0,.75,.2)', fill: 'forwards' },
    );
    a.onfinish = () => {
      E.Banner.hidden = true;
      a.cancel();
      E.Badge.style.visibility = '';
      E.Badge.classList.remove('pop');
      void E.Badge.getBoundingClientRect();
      E.Badge.classList.add('pop');
    };
  }
}
