import { expect, test, type Page } from '@playwright/test';

type Save = Record<string, unknown>;

const CA = ['ca_charlottetown', 'ca_gatineau', 'ca_toronto', 'ca_leamington', 'ca_saskatoon', 'ca_kelowna'];

function seeded(won: string[], wallet: number, extra: Save = {}): Save {
  const cities: Record<string, unknown> = {};
  for (const id of won) cities[id] = { won: true, stars: 2, bestDay: 200, crown: false, bestDays: 3, plays: 1 };
  return {
    v: 3, createdAt: 1, cities, run: null, wallet,
    workshop: { levels: { scythe: 6, swing: 2, hands: 2, days: 2, soil: 2, market: 2, clover: 1 }, job: null },
    tools: { owned: ['sickle'], equipped: 'sickle', mods: {} },
    ads: { date: '', coins: 0, doubles: 0, finishes: 0, lastCoinsAt: 0 },
    settings: { music: false, haptics: true }, seen: {}, totals: { days: 0, crops: 0, earned: 0 },
    ...extra,
  };
}

async function boot(page: Page, save?: Save): Promise<string[]> {
  await page.addInitScript(s => {
    if (sessionStorage.getItem('dbd-e2e')) return;
    localStorage.clear();
    if (s) localStorage.setItem('dbd-game-v3', s);
    sessionStorage.setItem('dbd-e2e', '1');
  }, save ? JSON.stringify(save) : '');
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
  await expect(page.locator('.scr-farmhouse .notice')).toContainText('Notice 1 of 2');
  await fast(page);
  await act(page, 'start');
  await expect(page.locator('#dbdHud')).toBeVisible();
  await expect(page.locator('.scr-sundown .sundown-card')).toBeVisible({ timeout: 20_000 });
  await act(page, 'farmhouse');
  await expect(page.locator('.scr-farmhouse .fh-title')).toContainText('Day 2');
  expect(errors).toEqual([]);
});

test('the farmhouse fits the screen on every tab', async ({ page }) => {
  await boot(page, seeded(CA.slice(0, 5), 3000, { tools: { owned: ['sickle', 'scythe'], equipped: 'sickle', mods: {} } }));
  await page.evaluate(() => (window as any).__DBD_APP.farmHere('ca_kelowna'));
  await expect(page.locator('.scr-farmhouse')).toBeVisible();
  for (const tab of ['workshop', 'tools', 'perks', 'bills']) {
    await act(page, 'tab', tab);
    const r = await page.evaluate(() => {
      const box = (sel: string) => {
        const b = document.querySelector(sel)!.getBoundingClientRect();
        return { l: b.left, r: b.right, t: b.top, b: b.bottom };
      };
      return {
        notice: box('.scr-farmhouse .notice'), panel: box('.scr-farmhouse .fh-panel'), top: box('.scr-farmhouse .fh-top'),
        action: box('.scr-farmhouse .btn-top'), pay: box('.scr-farmhouse .btn-pay'), vw: innerWidth, vh: innerHeight,
      };
    });
    expect(r.notice.r).toBeLessThanOrEqual(r.panel.l + 1);
    expect(r.top.r).toBeLessThanOrEqual(r.action.l + 1);
    expect(r.top.b).toBeLessThanOrEqual(r.panel.t + 1);
    for (const b of [r.notice, r.panel, r.action]) {
      expect(b.l).toBeGreaterThanOrEqual(0);
      expect(b.r).toBeLessThanOrEqual(r.vw);
      expect(b.b).toBeLessThanOrEqual(r.vh);
    }
    expect(r.pay.b).toBeLessThanOrEqual(r.notice.b);
  }
});

test('tools: buy the scythe, put it in hand and add an attachment', async ({ page }) => {
  await boot(page, seeded(CA, 8000));
  await page.evaluate(() => (window as any).__DBD_APP.farmHere('us_austin'));
  await act(page, 'tab', 'tools');
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
  await expect(page.locator('.scr-farmhouse .notice')).toContainText('King Russet');
  // pay the first two bills with test money so the deed is the current bill
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => (window as any).__DBD_ENGINE.addCash(5000));
    await page.evaluate(() => (window as any).__DBD_APP.payBill());
    await page.locator('.scr-modal [data-act="perk"]').first().click();
  }
  const bill = await page.evaluate(() => (window as any).__DBD_ENGINE.bill());
  expect(bill.name).toBe('The deed');
  expect(bill.bossBlock).toBe(true);
  expect(bill.canPay).toBe(false);
  await expect(page.locator('.scr-farmhouse .btn-pay')).toHaveText('Boss first');
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
  const errors = await boot(page, seeded(CA.slice(0, 2), 150, { run: { cityId: 'ca_toronto', startCash: 150, startedAt: 1, bestDay: 0 } }));
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
  await expect(page.locator('.scr-farmhouse .fh-title')).toContainText('Toronto');
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
