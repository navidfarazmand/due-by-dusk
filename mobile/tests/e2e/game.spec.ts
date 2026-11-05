import { expect, test, type Locator, type Page } from '@playwright/test';

type Save = Record<string, unknown>;

const CA = ['ca_charlottetown', 'ca_gatineau', 'ca_toronto', 'ca_leamington', 'ca_saskatoon', 'ca_kelowna'];

function seeded(won: string[], wallet: number, extra: Save = {}): Save {
  const cities: Record<string, unknown> = {};
  for (const id of won) cities[id] = { won: true, stars: 2, bestDay: 200, crown: false, bestDays: 3, plays: 1, paid: 0 };
  return {
    v: 3, econ: 10, createdAt: 1, cities, run: null, wallet,
    workshop: { levels: { scythe: 6, swing: 2, hands: 2, days: 2, soil: 2, market: 2, clover: 1 }, job: null },
    tools: { owned: ['sickle'], equipped: 'sickle', mods: {} },
    ads: { date: '', coins: 0, doubles: 0, finishes: 0, lastCoinsAt: 0 },
    settings: { music: false, haptics: true }, seen: {}, totals: { days: 0, crops: 0, earned: 0 },
    ...extra,
  };
}

async function boot(page: Page, save?: Save, coach = false): Promise<string[]> {
  await page.addInitScript(([s, c]) => {
    // the coach (intro, lessons, first sights) holds the field still for the player: most tests turn it off
    if (!c) (window as any).__DBD_NO_COACH = true;
    if (sessionStorage.getItem('dbd-e2e')) return;
    localStorage.clear();
    if (s) localStorage.setItem('dbd-game-v3', s);
    sessionStorage.setItem('dbd-e2e', '1');
  }, [save ? JSON.stringify(save) : '', coach] as const);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?testads=1');
  await expect(page.locator('.scr-menu')).toBeVisible();
  await page.waitForFunction(() => !!(window as any).__DBD_APP);
  return errors;
}

async function act(page: Page, a: string, arg?: string): Promise<void> {
  await page.locator(`#dbdScreens [data-act="${a}"]${arg ? `[data-arg="${arg}"]` : ''}`).first().click();
}

/** Perks ask to confirm (v0.11.4, Navid 4 Nov): the first tap picks the card out and shows "Take it", the second takes it. */
async function takePerk(card: Locator): Promise<void> {
  await card.click();
  await expect(card).toHaveClass(/\bsel\b/);
  await expect(card.locator('.pk-ok')).toBeVisible();
  await card.click();
}

/** Speeds the field up for tests (the engine multiplies its time step). */
async function fast(page: Page, k = 8): Promise<void> {
  await page.evaluate(v => ((window as any).__DBD_TIMESCALE = v), k);
}

test('menu to the first farm and through one day', async ({ page }) => {
  const errors = await boot(page);
  // the next-farm pill opens the world map; Play goes straight to the next farm's day card (Navid, 3 Nov)
  await act(page, 'continue');
  await expect(page.locator('.scr-world')).toBeVisible();
  await act(page, 'enter', 'CA');
  await expect(page.locator('.scr-country .city-card')).toContainText('Charlottetown');
  await page.evaluate(() => (window as any).__DBD_APP.show('menu'));
  await act(page, 'play');
  // the day card: the day, the bill coming up, and one big button
  await expect(page.locator('.scr-farmhouse .dc-day')).toHaveText('Day 1');
  await expect(page.locator('.scr-farmhouse .dc-bill')).toContainText('Seed loan');
  await expect(page.locator('.scr-farmhouse .dc-bill')).toContainText('Due day 2');
  // the first bill is paid on the evening it is due, not before: the button starts the day
  await expect(page.locator('.scr-farmhouse .dc-go[data-act="start"]')).toBeVisible();
  // a Canadian farm is 19 days (v0.12: bills of 2, 3, 4, 5 and 5 days)
  await expect(page.locator('.scr-farmhouse .dc-dots i')).toHaveCount(19);
  await fast(page);
  await act(page, 'start');
  await expect(page.locator('#dbdHud')).toBeVisible();
  await expect(page.locator('.scr-sundown .sundown-card')).toBeVisible({ timeout: 20_000 });
  await act(page, 'farmhouse');
  await expect(page.locator('.scr-farmhouse .dc-day')).toHaveText('Day 2');
  expect(errors).toEqual([]);
});

test('the farmhouse fits the screen: the day card between the tiles, and every panel tab', async ({ page }) => {
  await boot(page, seeded(CA.slice(0, 5), 3000, { tools: { owned: ['sickle', 'scythe'], equipped: 'sickle', mods: {} } }));
  await page.evaluate(() => (window as any).__DBD_APP.farmHere('ca_kelowna'));
  await expect(page.locator('.scr-farmhouse')).toBeVisible();
  const boxes2 = (sels: string[]) =>
    page.evaluate(ss => {
      const out: Record<string, { l: number; r: number; t: number; b: number }> = {};
      for (const sel of ss) {
        const b = document.querySelector(sel)!.getBoundingClientRect();
        out[sel] = { l: b.left, r: b.right, t: b.top, b: b.bottom };
      }
      return { out, vw: innerWidth, vh: innerHeight };
    }, sels);
  const L = await boxes2(['.scr-farmhouse .fh-top', '.scr-farmhouse .grp.ml', '.scr-farmhouse .day-card', '.scr-farmhouse .grp.mr', '.scr-farmhouse .dc-go']);
  const [top, left, card, right, go] = Object.values(L.out);
  expect(left.r).toBeLessThanOrEqual(card.l + 1);
  expect(card.r).toBeLessThanOrEqual(right.l + 1);
  expect(top.b).toBeLessThanOrEqual(card.t + 1);
  for (const b of [left, card, right, go]) {
    expect(b.l).toBeGreaterThanOrEqual(0);
    expect(b.r).toBeLessThanOrEqual(L.vw);
    expect(b.b).toBeLessThanOrEqual(L.vh);
  }
  expect(go.b).toBeLessThanOrEqual(card.b);
  await act(page, 'panel', 'workshop');
  for (const tab of ['workshop', 'tools', 'perks', 'bills']) {
    // the panel's own tabs (the tiles behind it are covered)
    await page.locator(`.scr-modal .pn-head [data-act="panel"][data-arg="${tab}"]`).click();
    await expect(page.locator(`.scr-modal .pn-head [data-arg="${tab}"].on`)).toBeVisible();
    const P = await boxes2(['.scr-modal .modal-card', '.scr-modal .pn-done']);
    const [m, done] = Object.values(P.out);
    expect(m.l).toBeGreaterThanOrEqual(0);
    expect(m.r).toBeLessThanOrEqual(P.vw);
    expect(m.b).toBeLessThanOrEqual(P.vh + 1);
    expect(done.b).toBeLessThanOrEqual(m.b);
  }
});

test('tools: buy the scythe, put it in hand and add an attachment', async ({ page }) => {
  await boot(page, seeded(CA, 15000));
  await page.evaluate(() => (window as any).__DBD_APP.farmHere('us_austin'));
  await act(page, 'panel', 'tools');
  await act(page, 'tool', 'scythe');
  await act(page, 'buy-tool', 'scythe');
  await expect(page.locator('.tool-detail .td-head')).toContainText('In your hands');
  expect(await page.evaluate(() => (window as any).__DBD_ENGINE.stats().style)).toBe('scythe');
  await act(page, 'buy-mod', 'scythe.wide');
  // the Power booster (the Charge handle until 0.11) is the first row; the wide blade is the second
  await expect(page.locator('.mod-row').nth(1).locator('.pips i.on')).toHaveCount(1);
  const g = await page.evaluate(() => (window as any).__DBD_APP.g);
  expect(g.tools.owned).toContain('scythe');
  expect(g.tools.mods['scythe.wide']).toBe(1);
});

test('boss farm: the deed waits until the boss is knocked out', async ({ page }) => {
  const errors = await boot(page, seeded(CA.slice(0, 5), 0));
  await page.evaluate(() => (window as any).__DBD_APP.farmHere('ca_kelowna'));
  await expect(page.locator('.scr-farmhouse .dc-boss')).toContainText('King Russet');
  // pay the first five bills with test money (each on its due evening) so the deed is the current bill
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => {
      const e = (window as any).__DBD_ENGINE;
      e.addCash(50_000);
      e.devDue();
      (window as any).__DBD_APP.payBill();
    });
    await page.locator('.scr-modal [data-act="chest-open"]').click();
    await takePerk(page.locator('.scr-modal [data-act="perk"]').first());
    await expect(page.locator('.scr-modal')).toBeHidden();
  }
  const bill = await page.evaluate(() => (window as any).__DBD_ENGINE.bill());
  expect(bill.name).toBe('The deed');
  expect(bill.bossBlock).toBe(true);
  expect(bill.canPay).toBe(false);
  // the deed waits in the boss's pocket: the boss row is lit and the day can still start
  await expect(page.locator('.scr-farmhouse .dc-boss.hot')).toBeVisible();
  await expect(page.locator('.scr-farmhouse .dc-go[data-act="start"]')).toBeVisible();
  // a test tool strong enough to knock the boss out in a moment
  await page.evaluate(() =>
    (window as any).__DBD_ENGINE.setTool({ style: 'blaster', dmg: 1e5, speed: 3, reach: 1, crit: 0, value: 1, gold: 0, burn: 0, targets: 40, range: 3000, storm: false, frost: false }),
  );
  await act(page, 'start');
  await expect(page.locator('#dbdHud')).toBeVisible();
  await page.waitForFunction(() => (window as any).__DBD_ENGINE.hud().boss?.onField);
  // v0.12: its armour only comes off right after it eats; take it off for the test
  await page.evaluate(() => (window as any).__DBD_ENGINE.devBoss(0, 0, 30));
  const box = (await page.locator('#field').boundingBox())!;
  for (let i = 0; i < 30; i++) {
    await page.mouse.move(box.x + box.width / 2 + (i % 5) * 8, box.y + box.height * 0.6);
    const down = await page.evaluate(() => (window as any).__DBD_ENGINE.state().boss.down);
    if (down) break;
    await page.waitForTimeout(150);
  }
  expect(await page.evaluate(() => (window as any).__DBD_ENGINE.state().boss.down)).toBe(true);
  await fast(page);
  await expect(page.locator('.scr-sundown .sd-boss.win')).toContainText('knocked out', { timeout: 20_000 });
  // optional ad: double the day
  await act(page, 'ad-double');
  await expect(page.locator('.scr-sundown [data-act="ad-double"]')).toHaveCount(0, { timeout: 5000 });
  await act(page, 'farmhouse');
  await page.evaluate(() => (window as any).__DBD_ENGINE.devDue());
  await page.evaluate(() => (window as any).__DBD_APP.refresh());
  await act(page, 'pay');
  await expect(page.locator('.scr-won .result-card')).toContainText('Kelowna');
  await expect(page.locator('.scr-won .r-boss')).toContainText("Canada's boss is out cold");
  expect(errors).toEqual([]);
});

test('settings show the credits and keep the toggles', async ({ page }) => {
  await boot(page);
  await act(page, 'settings');
  await expect(page.locator('.scr-modal')).toContainText('Settings');
  await act(page, 'music');
  await act(page, 'credits');
  await expect(page.locator('.scr-modal')).toContainText('Kevin MacLeod');
  await expect(page.locator('.scr-modal')).toContainText('CC BY 4.0');
  await act(page, 'close');
  const g = await page.evaluate(() => (window as any).__DBD_APP.g);
  expect(g.settings.music).toBe(false);
});

test('volume: music and sound effects each have a slider, kept after a reload', async ({ page }) => {
  await boot(page);
  await act(page, 'settings');
  const music = page.locator('.scr-modal input[data-vol="music"]');
  const sfx = page.locator('.scr-modal input[data-vol="sound"]');
  await expect(music).toHaveValue('80');
  await expect(sfx).toHaveValue('80');
  // switch the effects off, then move their slider: they come back on at the new level
  await page.locator('.scr-modal [data-act="sound"]').click();
  expect(await page.evaluate(() => (window as any).__DBD_ENGINE.state().sound)).toBe(false);
  await page.locator('.scr-modal input[data-vol="sound"]').fill('35');
  expect(await page.evaluate(() => (window as any).__DBD_ENGINE.state().sound)).toBe(true);
  await expect(page.locator('.scr-modal .vol-row:has([data-vol="sound"]) .toggle-row')).toHaveAttribute('aria-pressed', 'true');
  await music.fill('0');
  const g = await page.evaluate(() => (window as any).__DBD_APP.g.settings);
  expect(g.musicVol).toBe(0);
  expect(g.sfxVol).toBe(35);
  await page.evaluate(() => (window as any).__DBD_APP.saveNow());
  await page.reload();
  await page.waitForFunction(() => !!(window as any).__DBD_APP);
  await act(page, 'settings');
  await expect(page.locator('.scr-modal input[data-vol="music"]')).toHaveValue('0');
  await expect(page.locator('.scr-modal input[data-vol="sound"]')).toHaveValue('35');
});

test('languages: German from Settings, the whole game follows, kept after a reload', async ({ page }) => {
  const errors = await boot(page);
  // the signpost menu keeps the language in Settings (Navid picked Design 4, 3 Nov)
  await act(page, 'settings');
  await page.locator('.scr-modal [data-act="languages"]').click();
  await expect(page.locator('.scr-modal .lang-row')).toHaveCount(5);
  await page.locator('.scr-modal [data-act="lang"][data-arg="de"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.locator('.scr-modal [data-act="lang"][data-arg="de"]')).toHaveAttribute('aria-pressed', 'true');
  await act(page, 'close');
  await expect(page.locator('.scr-menu [data-act="play"]')).toContainText('Spielen');
  await page.reload();
  await page.waitForFunction(() => !!(window as any).__DBD_APP);
  await expect(page.locator('.scr-menu [data-act="play"]')).toContainText('Spielen');
  await page.evaluate(() => (window as any).__DBD_APP.farmHere('ca_charlottetown'));
  await expect(page.locator('.scr-farmhouse .dc-day')).toHaveText('Tag 1');
  await expect(page.locator('.scr-farmhouse .dc-bill')).toContainText('Saatkredit');
  // from Settings the list has Back as well
  await page.evaluate(() => (window as any).__DBD_APP.openSettings());
  await expect(page.locator('.scr-modal')).toContainText('Soundeffekte');
  await page.locator('.scr-modal [data-act="languages"]').click();
  await expect(page.locator('.scr-modal [data-act="settings"]')).toHaveCount(1);
  await page.locator('.scr-modal [data-act="lang"][data-arg="en"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('.scr-farmhouse .dc-day')).toHaveText('Day 1');
  expect(errors).toEqual([]);
});

type Box = { l: number; r: number; t: number; b: number };

async function boxes(page: Page, sels: string[]): Promise<{ vw: number; vh: number; b: Record<string, Box[]> }> {
  return page.evaluate(list => {
    const out: Record<string, { l: number; r: number; t: number; b: number }[]> = {};
    for (const sel of list)
      out[sel] = [...document.querySelectorAll(sel)]
        .filter(e => (e as HTMLElement).offsetParent !== null)
        .map(e => {
          const r = e.getBoundingClientRect();
          return { l: r.left, r: r.right, t: r.top, b: r.bottom };
        });
    return { vw: innerWidth, vh: innerHeight, b: out };
  }, sels);
}

const inside = (x: Box, vw: number, vh: number) => x.l >= -1 && x.t >= -1 && x.r <= vw + 1 && x.b <= vh + 1;
const apart = (a: Box, c: Box) => a.r <= c.l + 1 || c.r <= a.l + 1 || a.b <= c.t + 1 || c.b <= a.t + 1;

test('skill map: learn a skill, the farm uses it, reset gives the diamonds back', async ({ page }) => {
  const errors = await boot(page, seeded(CA.slice(0, 3), 0));
  await act(page, 'barn-menu');
  await page.locator('.scr-modal [data-act="skills"]').click();
  await expect(page.locator('.scr-skills .sk-card')).toContainText("Harvester's Awakening");
  await expect(page.locator('.scr-skills .sk-gems')).toContainText('3 to spend');
  const L = await boxes(page, ['.scr-skills .sk-node', '.scr-skills .sk-card', '.scr-skills .sk-gems', '.scr-skills .top-btn']);
  const card = L.b['.scr-skills .sk-card'][0];
  for (const n of L.b['.scr-skills .sk-node']) {
    expect(inside(n, L.vw, L.vh)).toBe(true);
    expect(apart(n, card)).toBe(true);
  }
  expect(inside(card, L.vw, L.vh)).toBe(true);
  await act(page, 'skill-learn', 'core_awakening');
  await act(page, 'skill', 'reap_root');
  await act(page, 'skill-learn', 'reap_root');
  await expect(page.locator('.scr-skills .sk-gems')).toContainText('0 to spend');
  expect(await page.evaluate(() => (window as any).__DBD_ENGINE.state().learnedSkills)).toEqual(['core_awakening', 'reap_root']);
  await act(page, 'skill-reset');
  await expect(page.locator('.scr-skills .sk-gems')).toContainText('3 to spend');
  expect(await page.evaluate(() => (window as any).__DBD_ENGINE.state().learnedSkills)).toEqual([]);
  expect(errors).toEqual([]);
});

test('Bling Barn: buy a bird with ribbons and the field uses its colours', async ({ page }) => {
  const errors = await boot(page, seeded(CA.slice(0, 2), 0, { ribbons: 10 }));
  await act(page, 'barn-menu');
  await page.locator('.scr-modal [data-act="barn"]').click();
  await act(page, 'barn-tab', 'bird');
  await act(page, 'barn-pick', 'bird_jay');
  await expect(page.locator('.scr-barn .bb-panel h3')).toHaveText('Blue jay');
  const L = await boxes(page, ['.scr-barn .bb-card', '.scr-barn .bb-panel', '.scr-barn .bb-tab', '.scr-barn .bb-chips']);
  const panel = L.b['.scr-barn .bb-panel'][0];
  for (const c of [...L.b['.scr-barn .bb-card'], ...L.b['.scr-barn .bb-tab']]) {
    expect(inside(c, L.vw, L.vh)).toBe(true);
    expect(apart(c, panel)).toBe(true);
  }
  await act(page, 'barn-buy', 'bird_jay');
  await expect(page.locator('.scr-barn .bb-ribbons')).toContainText('6');
  const g = await page.evaluate(() => (window as any).__DBD_APP.g);
  expect(g.flair.equipped.bird).toBe('bird_jay');
  expect(await page.evaluate(() => (window as any).__DBD_LOOK.bird)).toEqual(['#3b82f6', '#1f2937']);
  expect(errors).toEqual([]);
});

test('daily farm: one try on a seeded field, then the real farm is back as it was', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = await boot(page, seeded(CA.slice(0, 2), 150, { run: { cityId: 'ca_toronto', startCash: 0, startedAt: 1, bestDay: 0, mark: 0, spent: 0 } }));
  const before = await page.evaluate(() => (window as any).__DBD_ENGINE.state());
  expect(before.cityId).toBe('ca_toronto');
  await act(page, 'daily');
  await expect(page.locator('.scr-daily .dl-card')).toContainText('1 try left');
  const L = await boxes(page, ['.scr-daily .dl-card']);
  expect(inside(L.b['.scr-daily .dl-card'][0], L.vw, L.vh)).toBe(true);
  await fast(page, 10);
  await act(page, 'daily-play');
  await expect(page.locator('#dbdHud')).toBeVisible();
  expect(await page.evaluate(() => (window as any).__DBD_ENGINE.state().cityId)).not.toBe('');
  await expect(page.locator('.scr-side .dl-res')).toBeVisible({ timeout: 25_000 });
  const after = await page.evaluate(() => (window as any).__DBD_ENGINE.state());
  expect(after.cityId).toBe('ca_toronto');
  expect(after.cash).toBe(before.cash);
  expect(after.day).toBe(before.day);
  const g = await page.evaluate(() => (window as any).__DBD_APP.g);
  expect(g.daily.plays).toBe(1);
  // the second try is a rewarded ad, never forced
  await expect(page.locator('.scr-side [data-act="ad-daily"]')).toBeVisible();
  await page.locator('.scr-side [data-act="go"]').click();
  await act(page, 'play');
  await expect(page.locator('.scr-farmhouse .dc-city')).toContainText('Toronto');
  expect(errors).toEqual([]);
});

test('duel: two players take a turn each on the same field', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = await boot(page, seeded(CA.slice(0, 3), 0));
  await act(page, 'duel');
  await expect(page.locator('.scr-duel .du-card')).toBeVisible();
  const L = await boxes(page, ['.scr-duel .du-card']);
  expect(inside(L.b['.scr-duel .du-card'][0], L.vw, L.vh)).toBe(true);
  await act(page, 'duel-tool', 'scythe');
  await fast(page, 10);
  await act(page, 'duel-start');
  await expect(page.locator('.scr-side .du-pass')).toBeVisible({ timeout: 25_000 });
  const seed1 = await page.evaluate(() => (window as any).__DBD_APP.duel.seed);
  await act(page, 'duel-p2');
  await expect(page.locator('.scr-side .du-end')).toBeVisible({ timeout: 25_000 });
  const du = await page.evaluate(() => (window as any).__DBD_APP.duel);
  expect(du.seed).toBe(seed1);
  expect(du.tool).toBe('scythe');
  await page.locator('.scr-side [data-act="go"]').click();
  await expect(page.locator('.scr-menu')).toBeVisible();
  expect(errors).toEqual([]);
});

test('music: pick a field track and a menu track in Settings', async ({ page }) => {
  const errors = await boot(page);
  await act(page, 'settings');
  await act(page, 'music-picker');
  await expect(page.locator('.scr-modal .track-row')).toHaveCount(8);
  await expect(page.locator('.scr-modal .tr-slot.on[data-act="track-field"]')).toHaveAttribute('data-arg', 'meatball');
  await expect(page.locator('.scr-modal .tr-slot.on[data-act="track-menu"]')).toHaveAttribute('data-arg', 'gone_fishin');
  await act(page, 'track-field', 'hillbilly');
  await act(page, 'track-menu', 'fireflies');
  const s = await page.evaluate(() => (window as any).__DBD_APP.g.settings);
  expect(s.fieldTrack).toBe('hillbilly');
  expect(s.menuTrack).toBe('fireflies');
  const L = await boxes(page, ['.scr-modal .modal-card']);
  expect(inside(L.b['.scr-modal .modal-card'][0], L.vw, L.vh)).toBe(true);
  expect(errors).toEqual([]);
});

/** A real finger that chases the nearest ripe crop (the practice farm's steps wait for real cuts). */
async function harvest(page: Page, ms: number): Promise<void> {
  await page.evaluate(() => {
    const cv = document.getElementById('field')!, r = cv.getBoundingClientRect();
    cv.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: r.left + r.width / 2, clientY: r.top + r.height * 0.6, bubbles: true }));
  });
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    await page.evaluate(() => {
      const e = (window as any).__DBD_ENGINE, k = e.peek(), cv = document.getElementById('field')!, r = cv.getBoundingClientRect();
      const live = k.crops.filter((c: any) => !c.dead && c.age > 0.4);
      if (!live.length) return;
      live.sort((a: any, b: any) => Math.hypot(a.x - k.pointer.x, a.y - k.pointer.y) - Math.hypot(b.x - k.pointer.x, b.y - k.pointer.y));
      const c = live[0];
      const f = e.fingerAt(r.left + c.x * k.scale, r.top + (c.y - c.r * c.ds * 0.5) * k.scale);
      cv.dispatchEvent(new PointerEvent('pointermove', { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: f.x + (Math.random() - 0.5) * 20, clientY: f.y, bubbles: true }));
    });
    await page.waitForTimeout(60);
  }
  await page.evaluate(() => {
    document.getElementById('field')!.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true }));
  });
}

test('a new player: Play opens the practice farm; each step waits for the player; then the first farm', async ({ page }) => {
  const errors = await boot(page, undefined, true);
  await act(page, 'play');
  const step = page.locator('#dbdCoach .co-step .cs-t');
  await expect(step).toContainText(/drag over a carrot|mouse over a carrot/);
  // the sun waits: the daylight clock does not run while the player learns
  const t0 = await page.evaluate(() => (window as any).__DBD_ENGINE.state().time);
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => (window as any).__DBD_ENGINE.state().time)).toBe(t0);
  await expect(page.locator('#dbdCoach.cinema')).toHaveCount(0);
  await harvest(page, 3500);
  await expect(step).toHaveText(/Coins go to your jar|Make a chain|The sun is your clock/, { timeout: 8000 });
  await page.waitForTimeout(3500);
  await harvest(page, 8000);
  await expect(step).toHaveText('The sun is your clock', { timeout: 10_000 });
  await expect(page.locator('.scr-farmhouse')).toBeVisible({ timeout: 20_000 });
  const st = await page.evaluate(() => ({ run: (window as any).__DBD_APP.g.run?.cityId, seen: (window as any).__DBD_APP.g.seen, cash: (window as any).__DBD_ENGINE.state().cash }));
  expect(st.run).toBe('ca_charlottetown');
  expect(st.seen.practice).toBe(true);
  expect(st.cash).toBe(0);
  await expect(page.locator('#dbdCoach .co-hole')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Skip practice lands on the first farm; the intro plays from Settings and Skip ends it', async ({ page }) => {
  const errors = await boot(page, undefined, true);
  await act(page, 'play');
  await expect(page.locator('#dbdCoach .co-skip')).toBeVisible();
  await page.locator('#dbdCoach .co-skip').click();
  await expect(page.locator('.scr-farmhouse')).toBeVisible({ timeout: 8000 });
  expect(await page.evaluate(() => (window as any).__DBD_APP.g.run?.cityId)).toBe('ca_charlottetown');
  // the intro film, from Settings, ends back on the menu with the farm as it was
  await page.evaluate(() => (window as any).__DBD_APP.show('menu'));
  await act(page, 'settings');
  await page.locator('.scr-modal [data-act="replay-intro"]').click();
  await expect(page.locator('#dbdCoach.cinema')).toBeVisible();
  await page.locator('#dbdCoach .co-skip').click();
  await expect(page.locator('.scr-menu')).toBeVisible({ timeout: 8000 });
  expect(await page.evaluate(() => (window as any).__DBD_APP.g.run?.cityId)).toBe('ca_charlottetown');
  expect(errors).toEqual([]);
});

test('something new on a real farm holds the field with a card until a tap', async ({ page }) => {
  const errors = await boot(page, seeded([], 0), true);
  await page.evaluate(() => { const g = (window as any).__DBD_APP.g; g.seen = { intro: true, practice: true, cut: true, start: true, cleave: true, mBoss: true, mBoss2: true, mBomb: true, mEncase: true, mRadish: true, mGolden: true, mGoat: true, mGoatPet: true, mCrow: true, mThief: true, mProp: true, mBolt: true, mRival: true, mRush: true }; });
  await page.evaluate(() => (window as any).__DBD_APP.farmHere('ca_charlottetown'));
  await act(page, 'start');
  await expect(page.locator('#dbdHud')).toBeVisible();
  // the chain bonus is the one left to see: cut until it shows
  await harvest(page, 9000);
  await expect(page.locator('#dbdBanner.new-thing')).toBeVisible({ timeout: 6000 });
  await expect(page.locator('#dbdCoach .co-veil.on')).toHaveCount(0);
  const t1 = await page.evaluate(() => (window as any).__DBD_ENGINE.state().time);
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => (window as any).__DBD_ENGINE.state().time)).toBe(t1);
  await page.mouse.click(300, 300);
  await expect(page.locator('#dbdBanner.new-thing')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('an ad upgrades a closed chest; a diamond chest gives two of four gold perks', async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => (window as any).__DBD_APP.farmHere('ca_charlottetown'));
  await expect(page.locator('.scr-farmhouse')).toBeVisible();
  await page.evaluate(() => {
    const w = window as any;
    w.__DBD_CHEST_ROLL = 0;
    w.__DBD_UPGRADE_ROLL = 0.95; // wooden goes all the way to diamond
    w.__DBD_ENGINE.addCash(400);
    w.__DBD_ENGINE.devDue();
    w.__DBD_APP.payBill();
  });
  await expect(page.locator('.scr-modal .chest-box.ch-t1')).toBeVisible();
  await act(page, 'ad-chest');
  await expect(page.locator('.scr-modal .chest-box.ch-t4')).toBeVisible({ timeout: 6000 });
  await expect(page.locator('.scr-modal .chest-box')).toContainText('A diamond chest');
  // one upgrade per chest
  await expect(page.locator('.scr-modal [data-act="ad-chest"]')).toHaveCount(0);
  await act(page, 'chest-open');
  await expect(page.locator('.scr-modal [data-act="perk"]')).toHaveCount(4);
  await expect(page.locator('.scr-modal .perk-card.pk-t3')).toHaveCount(4);
  const L = await boxes(page, ['.scr-modal .modal-card', '.scr-modal .perk-card']);
  for (const c of [...L.b['.scr-modal .modal-card'], ...L.b['.scr-modal .perk-card']]) expect(inside(c, L.vw, L.vh)).toBe(true);
  await takePerk(page.locator('.scr-modal [data-act="perk"]').nth(0));
  await expect(page.locator('.scr-modal .chest-box.one-left')).toBeVisible();
  await expect(page.locator('.scr-modal')).toBeVisible();
  await takePerk(page.locator('.scr-modal [data-act="perk"]:not(.taken)').first());
  await expect(page.locator('.scr-modal')).toBeHidden();
  const st = await page.evaluate(() => (window as any).__DBD_ENGINE.state());
  expect(st.perks).toHaveLength(2);
  expect(st.pendingPerks).toBeNull();
  const ads = await page.evaluate(() => (window as any).__DBD_APP.g.ads.chests);
  expect(ads).toBe(1);
  expect(errors).toEqual([]);
});

test('perks from silver and gold chests survive a reload', async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => (window as any).__DBD_APP.farmHere('ca_charlottetown'));
  await expect(page.locator('.scr-farmhouse')).toBeVisible();
  const ok = await page.evaluate(() => (window as any).__DBD_ENGINE.devPerks(['coffee2', 'spite3', 'heavy']));
  expect(ok).toBe(true);
  await page.reload();
  await page.waitForFunction(() => !!(window as any).__DBD_ENGINE && !!(window as any).__DBD_APP);
  const perks = await page.evaluate(() => (window as any).__DBD_ENGINE.state().perks);
  expect(perks).toEqual(expect.arrayContaining(['coffee2', 'spite3', 'heavy']));
  expect(errors).toEqual([]);
});

test('the first farm: carrots only on day 1, a bill paid on its evening opens a chest, and a new crop joins each morning', async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => (window as any).__DBD_APP.farmHere('ca_charlottetown'));
  await expect(page.locator('.scr-farmhouse')).toBeVisible();
  // the field holds carrots only before the first bill
  const types0 = await page.evaluate(() => (window as any).__DBD_ENGINE.peek().crops.map((c: any) => c.type));
  expect(new Set(types0)).toEqual(new Set(['carrot']));
  await page.evaluate(() => {
    const e = (window as any).__DBD_ENGINE;
    (window as any).__DBD_CHEST_ROLL = 0; // chests are rolled: this one is wooden
    e.addCash(400);
    e.devDue();
    (window as any).__DBD_APP.payBill();
  });
  await expect(page.locator('.scr-modal .chest-box')).toBeVisible();
  await expect(page.locator('.scr-modal .chest-box')).toContainText('A wooden chest');
  // v0.12: crops come by day, so the chest no longer names one
  await expect(page.locator('.scr-modal .chest-new')).toHaveCount(0);
  await expect(page.locator('.scr-modal [data-act="perk"]').first()).toBeHidden();
  await act(page, 'chest-open');
  await expect(page.locator('.scr-modal [data-act="perk"]')).toHaveCount(3);
  await expect(page.locator('.scr-modal .perk-card.pk-t1').first()).toBeVisible();
  const L = await boxes(page, ['.scr-modal .modal-card', '.scr-modal .perk-card']);
  for (const c of [...L.b['.scr-modal .modal-card'], ...L.b['.scr-modal .perk-card']]) expect(inside(c, L.vw, L.vh)).toBe(true);
  // one tap only picks the card out: nothing is taken yet
  await page.locator('.scr-modal [data-act="perk"]').first().click();
  await expect(page.locator('.scr-modal')).toBeVisible();
  expect(await page.evaluate(() => (window as any).__DBD_ENGINE.state().perks)).toHaveLength(0);
  await page.locator('.scr-modal [data-act="perk"]').first().click();
  await expect(page.locator('.scr-modal')).toBeHidden();
  const st = await page.evaluate(() => (window as any).__DBD_ENGINE.state());
  expect(st.billsPaid).toBe(1);
  expect(st.perks).toHaveLength(1);
  // day 3: the day card names this morning's new crop, and the field holds it with the carrots and the radish
  await expect(page.locator('.scr-farmhouse .dc-day')).toHaveText('Day 3');
  await expect(page.locator('.scr-farmhouse .dc-new')).toContainText('New today');
  const fresh = await page.locator('.scr-farmhouse .dc-new').getAttribute('data-crop');
  expect(fresh && fresh !== 'carrot' && fresh !== 'radish').toBeTruthy();
  const seen = new Set<string>();
  for (let i = 0; i < 8 && !seen.has(fresh!); i++) {
    const t = await page.evaluate(() => {
      (window as any).__DBD_ENGINE.refreshStats();
      return (window as any).__DBD_ENGINE.peek().crops.map((c: any) => c.type);
    });
    t.forEach((x: string) => seen.add(x));
  }
  // golden corn can come up from day 3 too
  expect([...seen].every(x => x === 'carrot' || x === 'radish' || x === 'golden' || x === fresh)).toBe(true);
  expect(seen.has(fresh!)).toBe(true);
  expect(errors).toEqual([]);
});

test('a farm pays out once: a replay keeps its cash for the bills and banks only what beats the best', async ({ page }) => {
  const save = seeded([], 0);
  (save.cities as any).ca_charlottetown = { won: true, stars: 1, bestDay: 200, crown: false, bestDays: 10, plays: 1, paid: 500 };
  const errors = await boot(page, save);
  await act(page, 'continue');
  await act(page, 'enter', 'CA');
  await act(page, 'city', 'ca_charlottetown');
  await expect(page.locator('.scr-country .city-card')).toContainText('Paid you so far: $500');
  await page.evaluate(() => (window as any).__DBD_APP.farmHere('ca_charlottetown'));
  await page.evaluate(() => (window as any).__DBD_ENGINE.addCash(300));
  await page.evaluate(() => (window as any).__DBD_APP.refresh());
  await act(page, 'panel', 'workshop');
  // the payout note sits behind an "i" next to the cash (Navid, 3 Nov), not above the cards
  await page.locator('.scr-modal .up-info').click();
  await expect(page.locator('.scr-modal .info-text')).toContainText('$500');
  await act(page, 'close');
  await act(page, 'panel', 'workshop');
  // $300 on the farm is below the $500 mark: no upgrade can be bought with it
  await expect(page.locator('.scr-modal .btn-buy.gold')).toHaveCount(0);
  await expect(page.locator('.scr-farmhouse .ft-badge')).toHaveCount(0);
  await page.evaluate(() => (window as any).__DBD_ENGINE.addCash(300));
  await page.evaluate(() => (window as any).__DBD_APP.refresh());
  // $600 on the farm: $100 above the mark buys the cheapest upgrades
  await expect(page.locator('.scr-modal .btn-buy.gold').first()).toBeVisible();
  await expect(page.locator('.scr-farmhouse .ft-badge')).toBeVisible();
  const cost = await page.evaluate(() => (window as any).__DBD_WORKSHOP.upgradeCost('hands', 2));
  await act(page, 'buy', 'hands');
  const g = await page.evaluate(() => (window as any).__DBD_APP.g);
  expect(g.workshop.levels.hands).toBe(3);
  expect(cost).toBeLessThanOrEqual(100);
  expect(g.run.spent).toBe(cost);
  expect(errors).toEqual([]);
});

test('touch: the sickle sits above the finger by the finger offset (0 = under it)', async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => (window as any).__DBD_APP.farmHere('ca_charlottetown'));
  await act(page, 'start');
  await expect(page.locator('#dbdHud')).toBeVisible();
  const box = (await page.locator('#field').boundingBox())!;
  const fire = (type: string, x: number, y: number) =>
    page.evaluate(([type, x, y]) => {
      const cv = document.getElementById('field')!;
      cv.dispatchEvent(new PointerEvent(type as string, { pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: x as number, clientY: y as number, bubbles: true }));
    }, [type, x, y]);
  const sickle = () => page.evaluate(() => { const e = (window as any).__DBD_ENGINE.peek(); return { x: e.pointer.x * e.scale, y: e.pointer.y * e.scale }; });
  const x = box.x + box.width * 0.5, y = box.y + box.height * 0.5;
  // the default offset: 40 px above the finger in the middle of the field
  await fire('pointerdown', x, y);
  await fire('pointermove', x + 4, y);
  let s = await sickle();
  expect(Math.abs(s.x - (x + 4 - box.x))).toBeLessThan(2);
  expect(Math.abs(s.y - (y - box.y - 40))).toBeLessThan(2);
  // the ghost finger's inverse lands the sickle where it aims, even in the fade near the bottom edge
  for (const fy of [0.5, 0.85, 0.95]) {
    const ty = box.y + box.height * fy;
    const f = await page.evaluate(([x, y]) => (window as any).__DBD_ENGINE.fingerAt(x, y), [x, ty]);
    await fire('pointermove', f.x, f.y);
    s = await sickle();
    expect(Math.abs(s.y - (ty - box.y))).toBeLessThan(1.5);
  }
  await fire('pointerup', x, y);
  // Settings → Finger offset at Off: exactly under the finger again
  await page.evaluate(() => (window as any).__DBD_ENGINE.setTouchLift(0));
  await fire('pointerdown', x, y);
  await fire('pointermove', x, y + 2);
  s = await sickle();
  expect(Math.abs(s.y - (y + 2 - box.y))).toBeLessThan(2);
  await fire('pointerup', x, y);
  expect(errors).toEqual([]);
});

test('settings: the finger offset slider reaches the field and is kept after a reload', async ({ page }) => {
  const errors = await boot(page);
  await act(page, 'settings');
  const slider = page.locator('.scr-modal input[data-vol="lift"]');
  await expect(slider).toHaveValue('40');
  await slider.fill('0');
  await expect(page.locator('.scr-modal .lift-v')).toHaveText('Off');
  expect(await page.evaluate(() => (window as any).__DBD_APP.g.settings.touchLift)).toBe(0);
  await slider.fill('60');
  await expect(page.locator('.scr-modal .lift-v')).toHaveText('');
  await page.evaluate(() => (window as any).__DBD_APP.saveNow());
  await page.reload();
  await page.waitForFunction(() => !!(window as any).__DBD_APP);
  await act(page, 'settings');
  await expect(page.locator('.scr-modal input[data-vol="lift"]')).toHaveValue('60');
  expect(errors).toEqual([]);
});

test('touch: a second finger does nothing; a still finger just keeps cutting (v0.12: no charging)', async ({ page }) => {
  const errors = await boot(page, seeded([], 0, { tools: { owned: ['sickle'], equipped: 'sickle', mods: { 'sickle.charge': 1 } } }));
  await page.evaluate(() => (window as any).__DBD_APP.farmHere('ca_charlottetown'));
  await act(page, 'start');
  await expect(page.locator('#dbdHud')).toBeVisible();
  const box = (await page.locator('#field').boundingBox())!;
  const fire = (type: string, id: number, x: number, y: number) =>
    page.evaluate(([type, id, x, y]) => {
      const cv = document.getElementById('field')!;
      cv.dispatchEvent(new PointerEvent(type as string, { pointerId: id as number, pointerType: 'touch', isPrimary: id === 1, clientX: x as number, clientY: y as number, bubbles: true }));
    }, [type, id, x, y]);
  const x = box.x + box.width * 0.5, y = box.y + box.height * 0.6;
  await fire('pointerdown', 1, x, y);
  const p1 = await page.evaluate(() => (window as any).__DBD_ENGINE.peek().pointer);
  await fire('pointerdown', 2, box.x + box.width * 0.2, box.y + box.height * 0.5);
  await fire('pointermove', 2, box.x + 20, box.y + 20);
  const p2 = await page.evaluate(() => (window as any).__DBD_ENGINE.peek().pointer);
  expect(Math.abs(p2.x - p1.x)).toBeLessThan(1);
  await fire('pointerup', 2, box.x + 20, box.y + 20);
  await page.waitForTimeout(900);
  // holding still charges nothing, and lifting strikes nothing
  const powers0 = await page.evaluate(() => (window as any).__DBD_ENGINE.peek().today.powers || 0);
  await fire('pointerup', 1, x, y);
  expect(await page.evaluate(() => (window as any).__DBD_ENGINE.peek().chargeT)).toBe(0);
  expect(await page.evaluate(() => (window as any).__DBD_ENGINE.peek().today.powers || 0)).toBe(powers0);
  expect(errors).toEqual([]);
});

test('the power meter: a card at half full (once), then the tool\'s power and the rush fire together', async ({ page }) => {
  const errors = await boot(page, seeded([], 0), true);
  await page.evaluate(() => { const g = (window as any).__DBD_APP.g; g.seen = { intro: true, practice: true, cut: true, start: true, cleave: true, mBoss: true, mBoss2: true, mBomb: true, mEncase: true, mRadish: true, mGolden: true, mGoat: true, mGoatPet: true, mCrow: true, mThief: true, mProp: true, mBolt: true, mRival: true, mChain: true, mRush: true }; });
  await page.evaluate(() => (window as any).__DBD_APP.farmHere('ca_charlottetown'));
  await act(page, 'start');
  await expect(page.locator('#dbdHud')).toBeVisible();
  // beside the sun dial, a bar with no number on it
  await expect(page.locator('#dbdHud .grp.tc #dbdRush')).toBeVisible();
  await expect(page.locator('#dbdRushLbl')).toHaveText('POWER');
  await page.waitForTimeout(2200);
  await page.evaluate(() => (window as any).__DBD_ENGINE.devPower(0.6));
  await expect(page.locator('#dbdBanner.new-thing')).toBeVisible({ timeout: 6000 });
  await expect(page.locator('#dbdBanner')).toContainText('Your power meter');
  await page.mouse.click(300, 300);
  await expect(page.locator('#dbdBanner.new-thing')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__DBD_APP.g.seen.mPower)).toBe(true);
  // full: the sickle's Cleave and the Harvest Rush, at once
  await page.evaluate(() => {
    const w = window as any;
    w.__pw = [];
    const prev = w.__dbdEvent;
    w.__dbdEvent = (type: string, d: unknown) => { w.__pw.push(type); if (prev) prev(type, d); };
  });
  await page.evaluate(() => (window as any).__DBD_ENGINE.devPower(1));
  const h = await page.evaluate(() => (window as any).__DBD_ENGINE.hud());
  expect(h.rushT).toBeGreaterThan(2);
  expect(h.rushCharge).toBe(0);
  const got: string[] = await page.evaluate(() => (window as any).__pw);
  expect(got).toContain('power');
  expect(got).toContain('cleave');
  await expect(page.locator('#dbdRush.on')).toBeVisible();
  await expect(page.locator('#dbdRushLbl')).toHaveText('RUSH!');
  expect(await page.evaluate(() => (window as any).__DBD_ENGINE.peek().today.powers)).toBe(1);
  expect(errors).toEqual([]);
});

test('pause: sound switches on the card, and Back to menu leaves the day (it starts over)', async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => (window as any).__DBD_APP.farmHere('ca_charlottetown'));
  const day0 = await page.evaluate(() => (window as any).__DBD_ENGINE.state().day);
  await act(page, 'start');
  await expect(page.locator('#dbdHud')).toBeVisible();
  // the field's sound button pauses and shows the music and effects switches
  await page.locator('#dbdSound').click();
  await expect(page.locator('#pauseOverlay')).toBeVisible();
  await page.locator('#pauseSound [data-pact="sfx"]').click();
  expect(await page.evaluate(() => (window as any).__DBD_ENGINE.state().sound)).toBe(false);
  await page.locator('#btnQuitDay').click();
  await expect(page.locator('.scr-menu')).toBeVisible();
  const st = await page.evaluate(() => (window as any).__DBD_ENGINE.state());
  expect(st.mode).toBe('idle');
  expect(st.day).toBe(day0);
  expect(errors).toEqual([]);
});

test('the day\'s event badge holds the field until the next tap', async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => (window as any).__DBD_APP.farmHere('ca_charlottetown'));
  await act(page, 'start');
  await expect(page.locator('#dbdBadge')).toBeVisible({ timeout: 8000 });
  await page.locator('#dbdBadge').click();
  await expect(page.locator('#dbdBanner.held')).toBeVisible();
  const t1 = await page.evaluate(() => (window as any).__DBD_ENGINE.state().time);
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => (window as any).__DBD_ENGINE.state().time)).toBe(t1);
  await page.mouse.click(300, 300);
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => (window as any).__DBD_ENGINE.state().time)).toBeLessThan(t1);
  expect(errors).toEqual([]);
});

test('the 0.13 upgrade tree (a preview): 103 nodes from the skill map, the Workshop and learned skills on it', async ({ page }) => {
  const errors = await boot(page, seeded(CA.slice(0, 2), 0, { skills: ['core_awakening', 'gold_root', 'gold_lawyer'] }));
  await page.evaluate(() => (window as any).__DBD_APP.show('skills'));
  await act(page, 'tree');
  await expect(page.locator('.scr-tree .tr-nd')).toHaveCount(103);
  await page.locator('.scr-tree [data-act="tree-node"][data-arg="m2"]').click();
  await expect(page.locator('.scr-tree .tr-card')).toContainText('Retained counsel');
  // the skill learned with diamonds is its first level; the next one can be bought in the tree
  await expect(page.locator('.scr-tree .tr-card')).toContainText('Level 1 of 3');
  await page.locator('.scr-tree [data-act="tree-node"][data-arg="b9"]').click();
  await expect(page.locator('.scr-tree .tr-card')).toContainText('Coming in 0.13');
  await page.locator('.scr-tree [data-act="tree-zoom"][data-arg="1"]').click();
  await page.locator('.scr-tree [data-act="tree-back"]').click();
  await expect(page.locator('.scr-skills')).toBeVisible();
  expect(errors).toEqual([]);
});

test('the upgrade tree sells a node with savings, and the next one opens (0.13 preview)', async ({ page }) => {
  const errors = await boot(page, seeded(CA.slice(0, 2), 5000));
  await page.evaluate(() => (window as any).__DBD_APP.show('skills'));
  await act(page, 'tree');
  await page.locator('.scr-tree [data-act="tree-node"][data-arg="p1"]').click();
  await page.locator('.scr-tree [data-act="tree-buy"][data-arg="p1"]').click();
  const g = await page.evaluate(() => (window as any).__DBD_APP.g);
  expect(g.tree.p1).toBe(1);
  expect(g.wallet).toBeLessThan(5000);
  expect(await page.evaluate(() => (window as any).__DBD_TREEFX.p1)).toBe(1);
  await page.locator('.scr-tree [data-act="tree-node"][data-arg="p2"]').click();
  await expect(page.locator('.scr-tree [data-act="tree-buy"][data-arg="p2"]')).toBeVisible();
  // a free reset: two taps, and what it cost comes back as tree credit
  const spent = 5000 - g.wallet;
  await page.locator('.scr-tree [data-act="tree-reset"]').click();
  await page.locator('.scr-tree [data-act="tree-reset"]').click();
  const g2 = await page.evaluate(() => (window as any).__DBD_APP.g);
  expect(Object.values(g2.tree).filter((v: any) => v > 0)).toHaveLength(0);
  expect(g2.treeCredit).toBe(spent);
  expect(errors).toEqual([]);
});

test('menu: the signpost (Design 4), Barn opens skills or the Bling Barn, the plank opens the map', async ({ page }) => {
  const errors = await boot(page);
  await expect(page.locator('.scr-menu .sp-play')).toBeVisible();
  await expect(page.locator('.scr-menu [data-act="crowns"]')).toHaveCount(0);
  await act(page, 'barn-menu');
  await page.locator('.scr-modal [data-act="skills"]').click();
  await expect(page.locator('.scr-skills')).toBeVisible();
  await page.evaluate(() => (window as any).__DBD_APP.show('menu'));
  await act(page, 'continue');
  await expect(page.locator('.scr-world')).toBeVisible();
  expect(errors).toEqual([]);
});

test('a newer version on Play: one pop-up on a menu screen', async ({ page }) => {
  await page.addInitScript(() => { (window as any).__DBD_FAKE_UPDATE = { version: '1200', immediate: true }; });
  const errors = await boot(page);
  await expect(page.locator('.scr-modal')).toContainText('A new version is ready!', { timeout: 8000 });
  await expect(page.locator('.scr-modal [data-act="update-now"]')).toBeVisible();
  await act(page, 'close');
  // once per launch
  await page.waitForTimeout(5000);
  await expect(page.locator('.scr-modal')).toBeHidden();
  expect(errors).toEqual([]);
});

test('Report a problem: from Settings and by one strong shake; no typing in the game, the email app gets the details', async ({ page }) => {
  const errors = await boot(page);
  await act(page, 'settings');
  await page.locator('.scr-modal [data-act="report"]').click();
  await expect(page.locator('.scr-modal h2')).toHaveText('Report a problem');
  // nothing to type here: no keyboard over the landscape screen
  await expect(page.locator('.scr-modal textarea, .scr-modal input[type="text"]')).toHaveCount(0);
  await expect(page.locator('.scr-modal [data-act="report-send"]')).toHaveText('Open email');
  const details = await page.evaluate(() => (window as any).__DBD_APP.reportText());
  expect(details).toContain('Due by Dusk 0.12');
  await act(page, 'close');
  // a gentle movement does nothing; one strong shake opens it (and pauses a day)
  await page.evaluate(() => (window as any).__DBD_APP.farmHere('ca_charlottetown'));
  await act(page, 'start');
  await expect(page.locator('#dbdHud')).toBeVisible();
  const shake = (x: number) => page.evaluate(v => window.dispatchEvent(new DeviceMotionEvent('devicemotion', { acceleration: { x: v, y: 0, z: 0 }, accelerationIncludingGravity: { x: v, y: 9.8, z: 0 }, interval: 16 })), x);
  await shake(6);
  await expect(page.locator('.scr-modal')).toBeHidden();
  await shake(34);
  await expect(page.locator('.scr-modal h2')).toHaveText('Report a problem');
  expect(await page.evaluate(() => (window as any).__DBD_ENGINE.state().paused)).toBe(true);
  expect(await page.evaluate(() => (window as any).__DBD_APP.reportText())).toContain('Charlottetown');
  expect(errors).toEqual([]);
});

test('the field keeps crops away from the screen edges', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => (window as any).__DBD_APP.farmHere('ca_charlottetown'));
  await fast(page, 6);
  await act(page, 'start');
  await expect(page.locator('#dbdHud')).toBeVisible();
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const p = (window as any).__DBD_ENGINE.peek();
      return { pad: p.pad, w: p.worldW, xs: p.crops.filter((c: any) => !c.boss).map((c: any) => c.x) };
    });
    expect(r.pad).toBeGreaterThan(30 + r.w * 0.03);
    for (const cx of r.xs) {
      expect(cx).toBeGreaterThanOrEqual(r.pad - 0.5);
      expect(cx).toBeLessThanOrEqual(r.w - r.pad + 0.5);
    }
  }
});

test('cards keep their text inside on a short phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 740, height: 340 });
  const errors = await boot(page, seeded(CA.slice(0, 1), 0));
  await act(page, 'continue');
  await act(page, 'enter', 'CA');
  const spills = () =>
    page.evaluate(() => {
      const out: string[] = [];
      for (const el of document.querySelectorAll('#dbdScreens .statbox, #dbdScreens .up-card, #dbdScreens .day-card, #dbdScreens .fh-tile, #dbdScreens .card-foot, #dbdScreens .city-card')) {
        const h = el as HTMLElement;
        if (!h.offsetParent) continue;
        const r = h.getBoundingClientRect();
        if (r.right > innerWidth + 1 || r.bottom > innerHeight + 1) out.push('off screen: ' + h.className);
        for (const k of h.querySelectorAll('*')) {
          const c = (k as HTMLElement).getBoundingClientRect();
          if (!c.width || getComputedStyle(k).display === 'none') continue;
          if (c.right > r.right + 1.5 || c.bottom > r.bottom + 1.5) out.push(`${h.className} > ${(k as HTMLElement).className || k.tagName}`);
        }
      }
      return out;
    });
  expect(await spills()).toEqual([]);
  await act(page, 'farm', 'ca_gatineau');
  await expect(page.locator('.scr-farmhouse')).toBeVisible();
  expect(await spills()).toEqual([]);
  expect(errors).toEqual([]);
});

test('Sundown goes straight to the next day, and the field music plays on (v0.11.4)', async ({ page }) => {
  const errors = await boot(page);
  await act(page, 'play');
  await expect(page.locator('.scr-farmhouse .dc-day')).toHaveText('Day 1');
  await fast(page);
  await act(page, 'start');
  await expect(page.locator('.scr-sundown .sundown-card')).toBeVisible({ timeout: 20_000 });
  // no bill tonight: Next day is the big button, Upgrades a small one, the farmhouse in the corner; the money you have
  // is the big number (v0.12.1); the music stays the field's
  await expect(page.locator('.scr-sundown [data-act="next-day"]')).toBeVisible();
  await expect(page.locator('.scr-sundown [data-act="farmhouse"]')).toBeVisible();
  await expect(page.locator('.scr-sundown .sd-big')).toHaveText(await page.evaluate(() => '$' + Math.round((window as any).__DBD_ENGINE.state().cash).toLocaleString('en-US')));
  await page.locator('.scr-sundown [data-act="panel"][data-arg="workshop"]').click();
  await expect(page.locator('.scr-modal')).toBeVisible();
  await act(page, 'close');
  await expect(page.locator('.scr-sundown .sundown-card')).toBeVisible();
  expect(await page.evaluate(() => (window as any).__DBD_APP.music.mood)).toBe('field');
  await act(page, 'next-day');
  await expect(page.locator('#dbdHud')).toBeVisible();
  expect(await page.evaluate(() => (window as any).__DBD_ENGINE.state().day)).toBe(2);
  // day 2 is the first bill night: with the cash for it, the button pays and the chest opens over Sundown
  await page.evaluate(() => (window as any).__DBD_ENGINE.addCash(5000));
  await expect(page.locator('.scr-sundown .sundown-card')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.scr-sundown [data-act="next-day"]')).toContainText("Next day");
  await act(page, 'next-day');
  await expect(page.locator('.scr-sundown')).toBeVisible();
  await page.locator('.scr-modal [data-act="chest-open"]').click();
  await takePerk(page.locator('.scr-modal [data-act="perk"]').first());
  await expect(page.locator('#dbdHud')).toBeVisible();
  const st = await page.evaluate(() => (window as any).__DBD_ENGINE.state());
  expect(st.day).toBe(3);
  expect(st.billsPaid).toBe(1);
  expect(await page.evaluate(() => (window as any).__DBD_APP.music.mood)).toBe('field');
  // the farmhouse brings the menu music
  await expect(page.locator('.scr-sundown .sundown-card')).toBeVisible({ timeout: 20_000 });
  await act(page, 'farmhouse');
  expect(await page.evaluate(() => (window as any).__DBD_APP.music.mood)).toBe('menu');
  expect(errors).toEqual([]);
});

test("a purchase that leaves too little for tonight's bill asks on a card over a dimmed screen (v0.11.4)", async ({ page }) => {
  const errors = await boot(page, seeded(CA.slice(0, 2), 0));
  await act(page, 'play');
  await expect(page.locator('.scr-farmhouse .dc-day')).toBeVisible();
  // tonight's bill and no cash: the extra-day ad is blue like every ad (it was yellow like Start)
  await page.evaluate(() => {
    (window as any).__DBD_ENGINE.devDue();
    (window as any).__DBD_APP.show('farmhouse');
  });
  await expect(page.locator('.scr-farmhouse [data-act="ad-extra"]')).toHaveClass(/\bblue\b/);
  // just a little more cash than the bill asks
  await page.evaluate(() => {
    const e = (window as any).__DBD_ENGINE;
    e.addCash(e.bill().amt + 20);
    (window as any).__DBD_APP.show('farmhouse');
  });
  await page.locator('#dbdScreens [data-act="panel"][data-arg="workshop"], #dbdScreens [data-act="workshop"]').first().click();
  const buy = page.locator('.scr-modal [data-act="buy"]:not([disabled])').first();
  await expect(buy).toBeVisible();
  const before = await page.evaluate(() => JSON.stringify((window as any).__DBD_APP.g.workshop.levels));
  await buy.click();
  const veil = page.locator('.dbd-veil');
  await expect(veil).toBeVisible();
  await expect(veil).toContainText("Tonight's bill");
  await veil.locator('[data-veil="no"]').click();
  await expect(veil).toHaveCount(0);
  expect(await page.evaluate(() => JSON.stringify((window as any).__DBD_APP.g.workshop.levels))).toBe(before);
  await buy.click();
  await veil.locator('[data-veil="yes"]').click();
  await expect(veil).toHaveCount(0);
  expect(await page.evaluate(() => JSON.stringify((window as any).__DBD_APP.g.workshop.levels))).not.toBe(before);
  expect(errors).toEqual([]);
});

test('the boss eats crops, its armour is off only after it eats, and thief crows give coins back when shooed (v0.12)', async ({ page }) => {
  const errors = await boot(page, seeded(CA.slice(0, 5), 0));
  await page.evaluate(() => (window as any).__DBD_APP.farmHere('ca_kelowna'));
  await expect(page.locator('.scr-farmhouse .dc-boss')).toContainText('King Russet');
  await page.evaluate(() => { (window as any).__DBD_ENGINE.devDay(5); (window as any).__DBD_ENGINE.addCash(500); });
  // a finger parked out of the way
  await page.evaluate(() => { (window as any).__DBD_BOT = (dt: number, w: any) => { w.pointer.x = w.worldW * 0.95; w.pointer.y = w.bottom - 30; w.pointer.active = false; }; });
  await act(page, 'start');
  await page.waitForFunction(() => (window as any).__DBD_ENGINE.hud().boss?.onField);
  await page.evaluate(() => (window as any).__DBD_ENGINE.hold(false));
  // armoured: a hit does nothing
  const hp0 = await page.evaluate(() => (window as any).__DBD_ENGINE.hud().boss.hp);
  // it eats within a few seconds, and then its armour is off
  await page.waitForFunction(() => (window as any).__DBD_ENGINE.peek().bossFull, undefined, { timeout: 15_000 });
  expect(hp0).toBeGreaterThan(0);
  // bomb seeds and the storm come with its later phases
  await page.evaluate(() => (window as any).__DBD_ENGINE.devBoss(2, 0.3));
  await page.waitForFunction(() => (window as any).__DBD_ENGINE.peek().bombs > 0, undefined, { timeout: 10_000 });
  await page.waitForFunction(() => (window as any).__DBD_ENGINE.peek().encased > 0, undefined, { timeout: 10_000 });
  expect(await page.evaluate(() => (window as any).__DBD_ENGINE.peek().encaseKind)).toBe('ice');
  await page.evaluate(() => { (window as any).__DBD_BOT = null; });
  expect(errors).toEqual([]);
});


test('late fees: up to three late days, each with an ad; the collector takes 20%, 40%, 60%; then only the bank (v0.12)', async ({ page }) => {
  const errors = await boot(page);
  await act(page, 'play');
  await expect(page.locator('.scr-farmhouse .dc-day')).toBeVisible();
  // the seed loan is due tonight and there's no cash for it
  await page.evaluate(() => { (window as any).__DBD_ENGINE.devDue(); (window as any).__DBD_APP.show('farmhouse'); });
  const lateBtn = page.locator('.scr-farmhouse [data-act="ad-extra"]');
  await expect(lateBtn).toContainText('Late day 1 of 3');
  // what it costs is on a row of its own, not in the button (v0.12.1)
  await expect(page.locator('.scr-farmhouse .dc-late')).toContainText('20%');
  await lateBtn.click();
  await expect.poll(() => page.evaluate(() => (window as any).__DBD_ENGINE.state().late)).toBe(1);
  // the late day: earn, and at sunset Grumble & Sons take 20% of it
  await page.evaluate(() => { (window as any).__DBD_TIMESCALE = 8; });
  await act(page, 'start');
  await page.evaluate(() => (window as any).__DBD_ENGINE.addCash(10));
  await expect(page.locator('.scr-sundown .sundown-card')).toBeVisible({ timeout: 20_000 });
  const fee = await page.evaluate(() => (window as any).__DBD_APP.day.today);
  if (fee.earned > 0) await expect(page.locator('.scr-sundown .sd-fee')).toContainText('20%');
  expect(fee.feeRate).toBe(0.2);
  await act(page, 'farmhouse');
  // still short: late days 2 and 3, at 40% and 60%
  for (const [n, p] of [[2, '40%'], [3, '60%']] as const) {
    await expect(lateBtn).toContainText(`Late day ${n} of 3`);
    await expect(page.locator('.scr-farmhouse .dc-late')).toContainText(p);
    await lateBtn.click();
    await expect.poll(() => page.evaluate(() => (window as any).__DBD_ENGINE.state().late)).toBe(n);
    await act(page, 'start');
    await expect(page.locator('.scr-sundown .sundown-card')).toBeVisible({ timeout: 20_000 });
    await act(page, 'farmhouse');
  }
  // three late days used: no ad any more, only the bank
  await expect(lateBtn).toHaveCount(0);
  await expect(page.locator('.scr-farmhouse .dc-go[data-act="bank"]')).toBeVisible();
  // paying the bill clears the late days
  await page.evaluate(() => { (window as any).__DBD_ENGINE.addCash(100000); (window as any).__DBD_APP.payBill(); });
  expect(await page.evaluate(() => (window as any).__DBD_ENGINE.state().late)).toBe(0);
  expect(errors).toEqual([]);
});
