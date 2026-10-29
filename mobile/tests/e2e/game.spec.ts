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
  await boot(page, seeded(CA, 5000));
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
