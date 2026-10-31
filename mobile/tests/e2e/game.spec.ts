import { expect, test, type Page } from '@playwright/test';

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

/** Speeds the field up for tests (the engine multiplies its time step). */
async function fast(page: Page, k = 8): Promise<void> {
  await page.evaluate(v => ((window as any).__DBD_TIMESCALE = v), k);
}

test('menu to the first farm and through one day', async ({ page }) => {
  const errors = await boot(page);
  await act(page, 'play');
  await expect(page.locator('.scr-world')).toBeVisible();
  await act(page, 'enter', 'CA');
  await expect(page.locator('.scr-country .city-card')).toContainText('Charlottetown');
  await act(page, 'farm', 'ca_charlottetown');
  // the day card: the day, the bill coming up, and one big button
  await expect(page.locator('.scr-farmhouse .dc-day')).toHaveText('Day 1');
  await expect(page.locator('.scr-farmhouse .dc-bill')).toContainText('Seed loan');
  await expect(page.locator('.scr-farmhouse .dc-bill')).toContainText('Due day 2');
  // the first bill is paid on the evening it is due, not before: the button starts the day
  await expect(page.locator('.scr-farmhouse .dc-go[data-act="start"]')).toBeVisible();
  await expect(page.locator('.scr-farmhouse .dc-dots i')).toHaveCount(10);
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
  await expect(page.locator('.mod-row').first().locator('.pips i.on')).toHaveCount(1);
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
    await page.locator('.scr-modal [data-act="perk"]').first().click();
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

test('languages: German from the menu, the whole game follows, kept after a reload', async ({ page }) => {
  const errors = await boot(page);
  await page.locator('.scr-menu [data-act="languages"]').click();
  await expect(page.locator('.scr-modal .lang-row')).toHaveCount(5);
  // opened from the menu: Done only (Back would lead to Settings)
  await expect(page.locator('.scr-modal [data-act="settings"]')).toHaveCount(0);
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
  await act(page, 'skills');
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
  await act(page, 'barn');
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
  await act(page, 'continue');
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

test('a new player: Play runs the intro (the boss falls), then the first farm points at Start', async ({ page }) => {
  const errors = await boot(page, undefined, true);
  await act(page, 'play');
  await expect(page.locator('#dbdCoach.cinema')).toBeVisible();
  await expect(page.locator('#dbdHud')).toBeVisible();
  // the finale plays itself: the boss is knocked out and the bank stamps the deed
  await expect(page.locator('#dbdCoach .co-stamp')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.scr-farmhouse')).toBeVisible({ timeout: 15_000 });
  const st = await page.evaluate(() => ({ run: (window as any).__DBD_APP.g.run?.cityId, seen: (window as any).__DBD_APP.g.seen, cash: (window as any).__DBD_ENGINE.state().cash }));
  expect(st.run).toBe('ca_charlottetown');
  expect(st.seen.intro).toBe(true);
  expect(st.cash).toBe(0);
  await expect(page.locator('#dbdCoach .co-hole')).toBeVisible();
  await act(page, 'start');
  await expect(page.locator('#dbdHud')).toBeVisible();
  // day 1: the ghost cuts a carrot, then the field waits for the player
  await expect(page.locator('#dbdCoach .co-cap')).toHaveText(/Your turn/, { timeout: 12_000 });
  const t = await page.evaluate(() => (window as any).__DBD_ENGINE.peek().time);
  await page.waitForTimeout(1500);
  const t2 = await page.evaluate(() => (window as any).__DBD_ENGINE.peek().time);
  expect(Math.abs(t2 - t)).toBeLessThan(0.05);
  expect(errors).toEqual([]);
});

test('Skip ends the intro at once', async ({ page }) => {
  const errors = await boot(page, undefined, true);
  await act(page, 'play');
  await expect(page.locator('#dbdCoach .co-skip')).toBeVisible();
  await page.locator('#dbdCoach .co-skip').click();
  await expect(page.locator('.scr-farmhouse')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('#dbdCoach.cinema')).toHaveCount(0);
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
  await page.locator('.scr-modal [data-act="perk"]').nth(0).click();
  await expect(page.locator('.scr-modal .chest-box.one-left')).toBeVisible();
  await expect(page.locator('.scr-modal')).toBeVisible();
  await page.locator('.scr-modal [data-act="perk"]:not(.taken)').first().click();
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

test('the first farm: carrots only, a bill paid on its evening opens a chest, and the radish joins the field', async ({ page }) => {
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
  await expect(page.locator('.scr-modal .chest-new')).toContainText('Runaway Radish');
  await expect(page.locator('.scr-modal [data-act="perk"]').first()).toBeHidden();
  await act(page, 'chest-open');
  await expect(page.locator('.scr-modal [data-act="perk"]')).toHaveCount(3);
  await expect(page.locator('.scr-modal .perk-card.pk-t1').first()).toBeVisible();
  const L = await boxes(page, ['.scr-modal .modal-card', '.scr-modal .perk-card']);
  for (const c of [...L.b['.scr-modal .modal-card'], ...L.b['.scr-modal .perk-card']]) expect(inside(c, L.vw, L.vh)).toBe(true);
  await page.locator('.scr-modal [data-act="perk"]').first().click();
  await expect(page.locator('.scr-modal')).toBeHidden();
  const st = await page.evaluate(() => (window as any).__DBD_ENGINE.state());
  expect(st.billsPaid).toBe(1);
  expect(st.perks).toHaveLength(1);
  // a fresh field after paying shows the radish among the carrots
  const seen = new Set<string>();
  for (let i = 0; i < 6 && !seen.has('radish'); i++) {
    const t = await page.evaluate(() => {
      (window as any).__DBD_ENGINE.refreshStats();
      return (window as any).__DBD_ENGINE.peek().crops.map((c: any) => c.type);
    });
    t.forEach((x: string) => seen.add(x));
  }
  expect([...seen].every(x => x === 'carrot' || x === 'radish')).toBe(true);
  expect(seen.has('radish')).toBe(true);
  expect(errors).toEqual([]);
});

test('a farm pays out once: a replay keeps its cash for the bills and banks only what beats the best', async ({ page }) => {
  const save = seeded([], 0);
  (save.cities as any).ca_charlottetown = { won: true, stars: 1, bestDay: 200, crown: false, bestDays: 10, plays: 1, paid: 500 };
  const errors = await boot(page, save);
  await act(page, 'play');
  await act(page, 'enter', 'CA');
  await act(page, 'city', 'ca_charlottetown');
  await expect(page.locator('.scr-country .city-card')).toContainText('Paid you so far: $500');
  await page.evaluate(() => (window as any).__DBD_APP.farmHere('ca_charlottetown'));
  await page.evaluate(() => (window as any).__DBD_ENGINE.addCash(300));
  await page.evaluate(() => (window as any).__DBD_APP.refresh());
  await act(page, 'panel', 'workshop');
  await expect(page.locator('.scr-modal .up-cap')).toContainText('$500');
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

test('touch: the sickle sits under the finger, and a second finger charges the cleave', async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => (window as any).__DBD_APP.farmHere('ca_charlottetown'));
  await act(page, 'start');
  await expect(page.locator('#dbdHud')).toBeVisible();
  const box = (await page.locator('#field').boundingBox())!;
  const fire = (type: string, id: number, x: number, y: number) =>
    page.evaluate(([type, id, x, y]) => {
      const cv = document.getElementById('field')!;
      cv.dispatchEvent(new PointerEvent(type as string, { pointerId: id as number, pointerType: 'touch', isPrimary: id === 1, clientX: x as number, clientY: y as number, bubbles: true }));
    }, [type, id, x, y]);
  const x = box.x + box.width * 0.5, y = box.y + box.height * 0.92;
  await fire('pointerdown', 1, x, y);
  await fire('pointermove', 1, x + 4, y);
  const p1 = await page.evaluate(() => { const e = (window as any).__DBD_ENGINE.peek(); return { ...e.pointer, scale: e.scale }; });
  // no lift above the finger, even at the bottom of the screen
  expect(Math.abs(p1.y * p1.scale - (y - box.y))).toBeLessThan(2);
  expect(Math.abs(p1.x * p1.scale - (x + 4 - box.x))).toBeLessThan(2);
  // one finger held still does not charge
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => (window as any).__DBD_ENGINE.peek().chargeT)).toBeLessThan(0.05);
  // a second finger anywhere charges; lifting it lets the cleave go
  await fire('pointerdown', 2, box.x + box.width * 0.2, box.y + box.height * 0.5);
  await page.waitForFunction(() => (window as any).__DBD_ENGINE.peek().chargeT >= 0.9, null, { timeout: 4000 });
  // moving the second finger does not move the sickle
  await fire('pointermove', 2, box.x + 20, box.y + 20);
  const p2 = await page.evaluate(() => (window as any).__DBD_ENGINE.peek().pointer);
  expect(Math.abs(p2.x - p1.x)).toBeLessThan(1);
  await fire('pointerup', 2, box.x + 20, box.y + 20);
  await page.waitForFunction(() => (window as any).__DBD_ENGINE.peek().chargeT === 0, null, { timeout: 2000 });
  await fire('pointerup', 1, x + 4, y);
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
  await act(page, 'play');
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
