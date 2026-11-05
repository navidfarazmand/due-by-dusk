// Bots that play real days of Due by Dusk, to tune the bills (v0.12, Navid 5 Nov: "you did bad even with an ad, you
// should not have enough to pay the bill. you are medium and with ad yes you can pay the bill, you are great? you don't
// need to watch the ad. but my great i mean like computer great, not human great").
//
// Three players steer the sickle every engine step through the dev hook window.__DBD_BOT (see update() in
// gemini-engine.js), so sped-up time stays exact:
//   strong  — computer-strong: fast, never idle, always on the nearest ripe crop, steps around the goat;
//   average — a decent human: slower, retargets every quarter second, a short pause now and then;
//   weak    — slow, late to react, often pauses with the finger off the glass (the chain breaks).
// Each farm is played with an on-track build (upgrades whose field power matches expectedPower in plan.ts).
//
// Run the dev server (npm run dev), then:  node scripts/bots.mjs [farmIndex,...] [days,...] [reps]
// e.g. node scripts/bots.mjs 0,2,5 1,2,3,4,5,6,9 2      (writes bots-out.json next to this script)
// PW_CHROMIUM=/path/to/chromium sets the browser; DBD_URL the dev server.
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const URL = process.env.DBD_URL || 'http://localhost:5173';
const FARMS = (process.argv[2] || '0').split(',').map(Number);
const DAYS = (process.argv[3] || '1,3,6').split(',').map(Number);
const REPS = Number(process.argv[4] || 1);
const SKILLS = ['strong', 'average', 'weak'];
const ROUTE = ['ca_charlottetown', 'ca_gatineau', 'ca_toronto', 'ca_leamington', 'ca_saskatoon', 'ca_kelowna', 'us_austin', 'us_desmoines', 'us_vidalia', 'br_belem', 'br_petrolina', 'br_sinop', 'br_ribeirao', 'br_bento', 'ma_marrakech', 'ma_meknes', 'ma_fes', 'fr_avignon', 'fr_beaune', 'fr_tours', 'fr_roscoff', 'fr_agen', 'cn_guilin', 'cn_hangzhou', 'cn_chengdu', 'jp_sapporo', 'jp_aomori', 'jp_shizuoka', 'jp_kyoto', 'jp_kagoshima'];

// ---- an on-track build: the field power expectedPower(k) asks for (mirrors power.ts and plan.ts, sickle only)
const FX = { dmg: 1.04, reach: 0.02, speed: 0.02, crit: 0.008 };
const power = (L) => {
  const dmg = FX.dmg ** L.scythe, tick = 3.2 * (1 + FX.speed * L.hands), crit = Math.min(0.65, 0.04 + FX.crit * L.clover);
  const reach = 1 + FX.reach * L.swing;
  return dmg * tick * (1 + crit * 1.8) * reach * reach;
};
const expected = (k) => { let v = 3.43 * 1.35 ** Math.min(6, Math.max(0, k)); for (let i = 7; i <= k; i++) v *= i <= 12 ? 1.5 : i <= 17 ? 1.2 : 1.07; return v; };
// a typical way to spend: blade first, then handle and hands, and some of the rest
const levels = (a) => ({ scythe: Math.round(a), swing: Math.round(a / 2), hands: Math.round(a / 2), clover: Math.round(a / 3), soil: Math.round(a / 3), days: Math.min(20, Math.round(a / 4)), market: Math.round(a / 3) });
function buildFor(k) {
  for (let a = 0; a <= 160; a += 0.25) { const L = levels(a); if (power(L) >= expected(k)) return L; }
  return levels(160);
}
function saveFor(k) {
  const cities = {};
  for (let i = 0; i < k; i++) cities[ROUTE[i]] = { won: true, stars: 3, bestDay: 0, crown: false, bestDays: 3, plays: 1, paid: 0 };
  return { v: 3, econ: 10, createdAt: 1, cities, run: null, wallet: 0,
    workshop: { levels: buildFor(k), job: null }, tools: { owned: ['sickle'], equipped: 'sickle', mods: {} },
    ads: { date: '', coins: 0, doubles: 0, finishes: 0, lastCoinsAt: 0 },
    settings: { music: false, haptics: false, lang: 'en' }, seen: { intro: true, practice: true, start: true }, totals: { days: 9, crops: 500, earned: 2000 } };
}

// ---- the bots, in the page: they move the engine's pointer (world units) every step
function installBots() {
  const PROFILE = {
    strong: { speed: 2.0, react: 0.05, idleRate: 0, idleMin: 0, idleMax: 0, lift: false, pick: 1, dodgeGoat: true },
    average: { speed: 0.9, react: 0.25, idleRate: 0.25, idleMin: 0.25, idleMax: 0.6, lift: false, pick: 2, dodgeGoat: false },
    weak: { speed: 0.5, react: 0.5, idleRate: 0.6, idleMin: 0.4, idleMax: 1.1, lift: true, pick: 3, dodgeGoat: false },
  };
  window.__botStart = (skill, seed) => {
    const P = PROFILE[skill];
    let s = seed >>> 0;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const B = { t: 0, next: 0, idle: 0, target: null, wander: 0 };
    window.__DBD_BOT = (dt, w) => {
      const p = w.pointer;
      B.t += dt;
      if (B.idle > 0) {
        B.idle -= dt;
        if (P.lift) { p.active = false; p.down = false; }
        return;
      }
      if (B.t >= B.next) {
        B.next = B.t + P.react;
        // a pause now and then (idleRate pauses a second on average)
        if (P.idleRate && rnd() < P.idleRate * P.react) { B.idle = P.idleMin + rnd() * (P.idleMax - P.idleMin); return; }
        const live = w.crops.filter((c) => !c.dead && c.age > 0.4 && !c.boss);
        const goat = w.goat;
        const ok = P.dodgeGoat && goat ? live.filter((c) => Math.hypot(c.x - goat.x, c.y - goat.y) > w.reach * 1.6) : live;
        const list = (ok.length ? ok : live).map((c) => [Math.hypot(c.x - p.x, c.y - c.r * c.ds * 0.5 - p.y), c]).sort((a, b) => a[0] - b[0]);
        B.target = list.length ? list[Math.min(list.length - 1, Math.floor(rnd() * P.pick))][1] : null;
      }
      const c = B.target;
      let tx, ty;
      if (c && !c.dead) { tx = c.x; ty = c.y - c.r * c.ds * 0.5; }
      else { B.wander += dt; tx = w.worldW * (0.5 + 0.3 * Math.sin(B.wander)); ty = (w.top + w.bottom) / 2; }
      const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy), step = P.speed * w.worldW * dt;
      const nx = d > step ? p.x + (dx / d) * step : tx + Math.cos(B.t * 9) * w.reach * 0.3, ny = d > step ? p.y + (dy / d) * step : ty + Math.sin(B.t * 9) * w.reach * 0.3;
      p.vx = (nx - p.x) / Math.max(dt, 1e-3);
      p.vy = (ny - p.y) / Math.max(dt, 1e-3);
      p.x = nx; p.y = ny; p.ax = nx; p.ay = ny;
      p.active = true; p.down = true; p.placed = true; p.kind = 'touch';
    };
  };
}

async function playDay(page, skill, seed) {
  await page.evaluate(([sk, sd]) => window.__botStart(sk, sd), [skill, seed]);
  const r = await page.evaluate(async () => {
    const app = window.__DBD_APP, e = window.__DBD_ENGINE, wait = (ms) => new Promise((res) => setTimeout(res, ms));
    window.__DBD_TIMESCALE = 4;
    const day0 = e.state().day;
    app.startDay();
    let started = false;
    const t0 = performance.now();
    while (performance.now() - t0 < 60000) {
      await wait(120);
      try { e.hold(false); } catch (err) { /* nothing held */ }
      const st = e.state();
      if (st.mode === 'day') started = true;
      else if (started) break;
      else if (performance.now() - t0 > 3000) break;
    }
    // the evening plays out; the next day can only be set up once the farm is idle again
    for (let i = 0; i < 100 && e.state().mode !== 'idle'; i++) await wait(100);
    window.__DBD_TIMESCALE = 1;
    const d = app.day || {};
    const today = d.today || {};
    return { started, day: day0, earned: started ? Math.round(today.earned || 0) : -1, count: today.count || 0, best: today.best || 0 };
  });
  await page.evaluate(() => { window.__DBD_BOT = null; });
  return r;
}

const opts = process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {};
const browser = await chromium.launch(opts);
const out = [];
for (const k of FARMS) {
  const build = buildFor(k);
  for (const skill of SKILLS) {
    for (let rep = 0; rep < REPS; rep++) {
      const ctx = await browser.newContext({ viewport: { width: 844, height: 390 } });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.addInitScript(([save]) => {
        window.__DBD_NO_COACH = true;
        window.__DBD_NO_WEATHER = true;
        if (sessionStorage.getItem('bot')) return;
        localStorage.clear(); localStorage.setItem('dbd-game-v3', save); sessionStorage.setItem('bot', '1');
      }, [JSON.stringify(saveFor(k))]);
      await page.addInitScript(installBots);
      await page.goto(URL + '/?testads=1');
      await page.waitForFunction(() => !!(window.__DBD_APP && window.__DBD_ENGINE));
      await page.evaluate((id) => window.__DBD_APP.farmHere(id), ROUTE[k]);
      await page.waitForTimeout(400);
      const tough = await page.evaluate(() => (window.__DBD_APP.g.run || {}).tough || 1);
      for (const day of DAYS) {
        const okDay = await page.evaluate((d) => { window.__DBD_APP.show('farmhouse'); return window.__DBD_ENGINE.devDay(d); }, day);
        if (!okDay) console.log('could not set day', day);
        const r = await playDay(page, skill, 1000 * k + 97 * day + rep * 7 + skill.length);
        out.push({ k, city: ROUTE[k], skill, rep, ...r, day, tough: Math.round(tough * 100) / 100 });
        const note = (r.day !== day ? ' (engine day ' + r.day + ')' : '') + (r.started ? '' : ' NOT STARTED');
        console.log('k=' + k + ' ' + skill.padEnd(7) + ' rep' + rep + ' day ' + day + ': $' + r.earned + ' (' + r.count + ' crops)' + note);
      }
      if (errors.length) console.log('page errors:', errors.slice(0, 3).join(' | '));
      await ctx.close();
    }
  }
  console.log(`k=${k} build`, JSON.stringify(build));
}
await browser.close();
const file = process.env.BOTS_OUT || join(dirname(fileURLToPath(import.meta.url)), 'bots-out.json');
writeFileSync(file, JSON.stringify(out, null, 1));
console.log('wrote', file);
