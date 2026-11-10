import { expect, test, type Locator, type Page } from '@playwright/test';

type Save = Record<string, unknown>;

const CA = ['ca_charlottetown', 'ca_gatineau', 'ca_toronto', 'ca_leamington', 'ca_saskatoon', 'ca_kelowna'];

function seeded(won: string[], wallet: number, extra: Save = {}): Save {
  const cities: Record<string, unknown> = {};
  for (const id of won) cities[id] = { won: true, stars: 2, bestDay: 200, crown: false, bestDays: 3, plays: 1, paid: 0 };
  return {
    // treeV 1: a save of 0.13 (the tree is the one upgrade system); a test of the migration leaves it out
    v: 3, econ: 10, treeV: 1, createdAt: 1, cities, run: null, wallet,
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
  await act(page, 'panel', 'tools');
  for (const tab of ['tools', 'perks', 'bills']) {
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
  // the panel's Upgrades tab is the upgrade tree (0.13), and its back button returns to the farmhouse
  await page.locator('.scr-modal .pn-head [data-act="tree"]').click();
  await expect(page.locator('.scr-tree .tr-map')).toBeVisible();
  await expect(page.locator('.scr-modal')).toBeHidden();
  await page.locator('.scr-tree [data-act="tree-back"]').click();
  await expect(page.locator('.scr-farmhouse .day-card')).toBeVisible();
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

test('an older save: learned skills become owned tree nodes, diamonds become tree credit, and no diamond is left on screen', async ({ page }) => {
  // a 0.12 save: three farms won (3 diamonds) and 4 from daily golds; Pasture accord (3) and Harvester's Awakening (1) learned
  const errors = await boot(page, seeded(CA.slice(0, 3), 0, { treeV: undefined, skills: ['core_awakening', 'gold_root', 'gold_treaty'], bonusDiamonds: 3 }));
  const g = await page.evaluate(() => (window as any).__DBD_APP.g);
  // Pasture accord is its node; the other 3 diamonds (two plain stat skills) are $1,000 of tree credit each
  expect(g.tree).toEqual({ a1: 1 });
  expect(g.treeCredit).toBe(3000);
  expect(g.treeV).toBe(1);
  expect(g.skills).toBeUndefined();
  expect(g.bonusDiamonds).toBeUndefined();
  await expect(page.locator('.shell-toast')).toContainText('$3,000', { timeout: 6000 });
  // the engine has the skill by its old name, and nothing else
  expect(await page.evaluate(() => (window as any).__DBD_ENGINE.state().learnedSkills)).toEqual(['gold_treaty']);
  // the menu's Barn opens the tree (the skill map is gone): the node is owned, the credit shows, and it buys a node
  await act(page, 'barn-menu');
  await expect(page.locator('.scr-modal [data-act="skills"]')).toHaveCount(0);
  await page.locator('.scr-modal [data-act="tree"]').click();
  await expect(page.locator('.scr-tree .tr-nd')).toHaveCount(103);
  await expect(page.locator('.scr-tree .tr-credit')).toContainText('$3,000');
  await expect(page.locator('.scr-tree .tr-nd[data-arg="a1"]')).toHaveClass(/\bown\b/);
  await page.locator('.scr-tree .tr-nd[data-arg="a1"]').click();
  await expect(page.locator('.scr-tree .tr-card')).toContainText('Pasture accord');
  await expect(page.locator('.scr-tree .tr-card')).toContainText('Yours');
  await page.locator('.scr-tree .tr-nd[data-arg="a2"]').click();
  await page.locator('.scr-tree [data-act="tree-buy"][data-arg="a2"]').click();
  const g2 = await page.evaluate(() => (window as any).__DBD_APP.g);
  expect(g2.tree.a2).toBe(1);
  expect(g2.treeCredit).toBe(3000 - 200);
  expect(g2.wallet).toBe(0);
  // no diamond anywhere: not on the tree, the menu, the Barn card or the daily farm
  for (const scr of ['menu', 'daily']) {
    await page.evaluate(sc => (window as any).__DBD_APP.show(sc), scr);
    expect(await page.evaluate(() => document.getElementById('dbdScreens')!.innerHTML.includes('#7FD1F5'))).toBe(false);
    expect(await page.locator('#dbdScreens').innerText()).not.toMatch(/diamond|◆/i);
  }
  // after a reload the save stays as it is (no second credit)
  await page.evaluate(() => (window as any).__DBD_APP.saveNow());
  await page.reload();
  await page.waitForFunction(() => !!(window as any).__DBD_APP);
  const g3 = await page.evaluate(() => (window as any).__DBD_APP.g);
  expect(g3.treeCredit).toBe(2800);
  expect(g3.tree).toEqual({ a1: 1, a2: 1 });
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
  await act(page, 'panel', 'tools');
  // the payout note sits behind an "i" next to the cash (Navid, 3 Nov), not above the cards
  await page.locator('.scr-modal .up-info').click();
  await expect(page.locator('.scr-modal .info-text')).toContainText('$500');
  await act(page, 'close');
  // $300 on the farm is below the $500 mark: no upgrade can be bought with it (the tree shows $0 to spend)
  await expect(page.locator('.scr-farmhouse .ft-badge')).toHaveCount(0);
  await act(page, 'tree');
  await expect(page.locator('.scr-tree .tr-cash')).toContainText('$0');
  await expect(page.locator('.scr-tree .tr-nd.ready')).toHaveCount(0);
  await page.locator('.scr-tree .tr-nd[data-arg="r2"]').click();
  await expect(page.locator('.scr-tree [data-act="tree-buy"][data-arg="r2"]')).toBeDisabled();
  await page.locator('.scr-tree [data-act="tree-back"]').click();
  await page.evaluate(() => (window as any).__DBD_ENGINE.addCash(300));
  await page.evaluate(() => (window as any).__DBD_APP.refresh());
  // $600 on the farm: $100 above the mark buys the cheapest upgrades
  await expect(page.locator('.scr-farmhouse .ft-badge')).toBeVisible();
  await act(page, 'tree');
  await expect(page.locator('.scr-tree .tr-cash')).toContainText('$100');
  await expect(page.locator('.scr-tree .tr-nd.ready').first()).toBeVisible();
  const cost = await page.evaluate(() => (window as any).__DBD_WORKSHOP.upgradeCost('hands', 2));
  await page.locator('.scr-tree .tr-nd[data-arg="r2"]').click();
  await page.locator('.scr-tree [data-act="tree-buy"][data-arg="r2"]').click();
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
  // the chip stays the power meter (empty again); the rush shows on the chain strip
  await expect(page.locator('#dbdRushLbl')).toHaveText('POWER');
  await expect(page.locator('#dbdRush.on')).toHaveCount(0);
  await expect(page.locator('#dbdNext')).toHaveText('RUSH!');
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

test('the upgrade tree from the farmhouse: opens on the trunk, a track level is bought with one big button, the badge counts what can be bought', async ({ page }) => {
  const errors = await boot(page, seeded(CA.slice(0, 2), 400));
  await act(page, 'play');
  await expect(page.locator('.scr-farmhouse .dc-day')).toBeVisible();
  // the tile's badge: tree nodes that can be bought now with the $400 of savings
  const ready = await page.evaluate(() => {
    const w = window as any;
    return w.__DBD_TREE.treeReady(w.__DBD_APP.g, 400).map((n: any) => n.id);
  });
  expect(ready.length).toBeGreaterThan(3);
  await expect(page.locator('.scr-farmhouse .fh-tile.big .ft-badge')).toHaveText(String(ready.length));
  await page.locator('.scr-farmhouse .fh-tile.big').click();
  await expect(page.locator('.scr-tree .tr-nd')).toHaveCount(103);
  // every node that can be bought now is ringed, and the trunk's card lists them
  await expect(page.locator('.scr-tree .tr-nd.ready')).toHaveCount(ready.length);
  await expect(page.locator('.scr-tree .tr-list .tr-row.ready')).toHaveCount(ready.length);
  // it opens centred on the trunk
  const mid = await page.evaluate(() => {
    const box = document.getElementById('dbdTreeMap')!.getBoundingClientRect();
    const t = document.querySelector('.scr-tree .tr-nd[data-arg="trunk"] circle')!.getBoundingClientRect();
    return { dx: (t.left + t.right) / 2 - (box.left + box.right) / 2, dy: (t.top + t.bottom) / 2 - (box.top + box.bottom) / 2 };
  });
  expect(Math.abs(mid.dx)).toBeLessThan(12);
  expect(Math.abs(mid.dy)).toBeLessThan(12);
  // the whole screen fits, and what gets tapped is big enough for a thumb
  const L = await boxes(page, ['.scr-tree .tr-top > *', '.scr-tree .tr-map', '.scr-tree .tr-card', '.scr-tree .tr-row', '.scr-tree .tr-top button']);
  // (the list of what is ready scrolls inside its card)
  for (const sel of ['.scr-tree .tr-top > *', '.scr-tree .tr-map', '.scr-tree .tr-card']) for (const b of L.b[sel]) expect(inside(b, L.vw, L.vh)).toBe(true);
  expect(inside(L.b['.scr-tree .tr-row'][0], L.vw, L.vh)).toBe(true);
  for (const b of [...L.b['.scr-tree .tr-row'], ...L.b['.scr-tree .tr-top button']]) expect(b.b - b.t).toBeGreaterThanOrEqual(40);
  // a node's own hit area on the map
  const hit = await page.evaluate(() => document.querySelector('.scr-tree .tr-nd[data-arg="b1"] circle')!.getBoundingClientRect().width);
  expect(hit).toBeGreaterThanOrEqual(40);
  // Sharper blade: the Workshop's level 6, its price, and one big Buy button
  await page.locator('.scr-tree .tr-nd[data-arg="b1"]').click();
  const card = page.locator('.scr-tree .tr-card');
  await expect(card).toContainText('Sharper blade');
  await expect(card).toContainText('Lv 6');
  const cost = await page.evaluate(() => (window as any).__DBD_WORKSHOP.upgradeCost('scythe', 6));
  const buy = page.locator('.scr-tree [data-act="tree-buy"][data-arg="b1"]');
  await expect(buy).toContainText('$' + cost);
  const B = await boxes(page, ['.scr-tree .tr-buy', '.scr-tree .tr-card']);
  const bb = B.b['.scr-tree .tr-buy'][0];
  expect(bb.b - bb.t).toBeGreaterThanOrEqual(48);
  expect(bb.r - bb.l).toBeGreaterThanOrEqual(150);
  expect(inside(bb, B.vw, B.vh)).toBe(true);
  await buy.click();
  // one state: the Workshop's level went up, the engine has it, savings paid, nothing was written twice
  const g = await page.evaluate(() => (window as any).__DBD_APP.g);
  expect(g.workshop.levels.scythe).toBe(7);
  expect(g.tree.b1).toBeUndefined();
  expect(g.wallet).toBe(400 - cost);
  expect(await page.evaluate(() => (window as any).__DBD_ENGINE.state().shed.scythe)).toBe(7);
  await expect(card).toContainText('Lv 7');
  // a node that is not built yet says so, without a version number, and has no Buy button
  const soon = await page.evaluate(() => {
    const T = (window as any).__DBD_TREE;
    const n = T.TREE.find((x: any) => x.kind !== 'trunk' && !T.nodeLive(x.id));
    return n ? n.id : '';
  });
  if (soon) {
    await page.locator(`.scr-tree .tr-nd[data-arg="${soon}"]`).click({ force: true });
    await expect(card).toContainText('Coming soon');
    await expect(card).not.toContainText('0.13');
    await expect(page.locator('.scr-tree [data-act="tree-buy"]')).toHaveCount(0);
  }
  await page.locator('.scr-tree [data-act="tree-zoom"][data-arg="1"]').click();
  await page.locator('.scr-tree [data-act="tree-back"]').click();
  await expect(page.locator('.scr-farmhouse .day-card')).toBeVisible();
  expect(errors).toEqual([]);
});

test('a long build: the fifth level of a track takes time, one build at a time, and the test ad finishes it', async ({ page }) => {
  const save = seeded(CA.slice(0, 2), 5000);
  (save.workshop as any).levels.scythe = 9;
  const errors = await boot(page, save);
  await act(page, 'play');
  await page.locator('.scr-farmhouse .fh-tile.big').click();
  await page.locator('.scr-tree .tr-nd[data-arg="b1"]').click();
  const buy = page.locator('.scr-tree [data-act="tree-buy"][data-arg="b1"]');
  // level 10 is a build: the button shows how long
  await expect(buy.locator('small')).toContainText('2m 30s');
  await buy.click();
  let g = await page.evaluate(() => (window as any).__DBD_APP.g);
  expect(g.workshop.levels.scythe).toBe(9);
  expect(g.workshop.job).toMatchObject({ id: 'scythe', level: 10 });
  expect(g.workshop.job.endsAt - g.workshop.job.startedAt).toBe(150_000);
  // the card shows the build and the rewarded ad that finishes it (never forced: a button)
  await expect(page.locator('.scr-tree .tr-card .tr-build')).toBeVisible();
  await expect(page.locator('.scr-tree [data-act="tree-buy"][data-arg="b1"]')).toHaveCount(0);
  const fin = page.locator('.scr-tree .tr-card [data-act="ad-finish"]');
  await expect(fin).toBeVisible();
  // one build at a time: another fifth level waits, an ordinary level does not
  await page.evaluate(() => {
    const a = (window as any).__DBD_APP;
    a.g.workshop.levels.hands = 4;
    a.refresh();
  });
  await page.locator('.scr-tree .tr-nd[data-arg="r2"]').click();
  await expect(page.locator('.scr-tree .tr-card .tr-buy')).toBeDisabled();
  await page.locator('.scr-tree .tr-nd[data-arg="r1"]').click();
  await page.locator('.scr-tree [data-act="tree-buy"][data-arg="r1"]').click();
  expect(await page.evaluate(() => (window as any).__DBD_APP.g.workshop.levels.swing)).toBe(3);
  // the farmhouse tile shows the clock too
  await page.locator('.scr-tree [data-act="tree-back"]').click();
  await expect(page.locator('.scr-farmhouse #dbdJobTile')).toBeVisible();
  await page.locator('.scr-farmhouse .fh-tile.big').click();
  // the chip in the top bar goes to the node being built; the test ad finishes it
  await page.locator('.scr-tree .tr-jobchip').click();
  await expect(page.locator('.scr-tree .tr-card')).toContainText('Sharper blade');
  await fin.click();
  await expect(page.locator('.test-ad')).toBeVisible();
  await expect.poll(async () => (await page.evaluate(() => (window as any).__DBD_APP.g.workshop)).levels.scythe, { timeout: 8000 }).toBe(10);
  g = await page.evaluate(() => (window as any).__DBD_APP.g);
  expect(g.workshop.job).toBeNull();
  expect(g.ads.finishes).toBe(1);
  expect(await page.evaluate(() => (window as any).__DBD_ENGINE.state().shed.scythe)).toBe(10);
  await expect(page.locator('.scr-tree .tr-card')).toContainText('Lv 10');
  // with no ad loaded the offer is not shown at all
  await page.evaluate(() => {
    const a = (window as any).__DBD_APP;
    a.g.workshop.levels.scythe = 14;
    a.refresh();
  });
  await page.locator('.scr-tree [data-act="tree-buy"][data-arg="b1"]').click();
  await expect(page.locator('.scr-tree .tr-card .tr-build')).toBeVisible();
  expect(errors).toEqual([]);
});

test('the tree: a node opens the next one, a keystone is a long build, and a free reset gives everything back as tree credit', async ({ page }) => {
  const errors = await boot(page, seeded(CA.slice(0, 2), 5000));
  await act(page, 'barn-menu');
  await page.locator('.scr-modal [data-act="tree"]').click();
  // Power cell from the trunk's list of what is ready, then Big power opens
  await page.locator('.scr-tree .tr-row[data-arg="p1"]').click();
  await page.locator('.scr-tree [data-act="tree-buy"][data-arg="p1"]').click();
  let g = await page.evaluate(() => (window as any).__DBD_APP.g);
  expect(g.tree.p1).toBe(1);
  expect(g.wallet).toBe(5000 - 20);
  expect(await page.evaluate(() => (window as any).__DBD_TREEFX.p1)).toBe(1);
  await page.locator('.scr-tree .tr-nd[data-arg="p2"]').click();
  await page.locator('.scr-tree [data-act="tree-buy"][data-arg="p2"]').click();
  // a track level too: the reset gives tracks back as well
  await page.locator('.scr-tree .tr-nd[data-arg="b1"]').click();
  await page.locator('.scr-tree [data-act="tree-buy"][data-arg="b1"]').click();
  g = await page.evaluate(() => (window as any).__DBD_APP.g);
  expect(g.workshop.levels.scythe).toBe(7);
  const paid = 5000 - g.wallet;
  const before = await page.evaluate(() => {
    const w = window as any;
    return w.__DBD_TREE.treeRefund(w.__DBD_APP.g);
  });
  // what the save's track levels cost at the Workshop's prices, plus what was just paid
  const seedValue = await page.evaluate(() => {
    const W = (window as any).__DBD_WORKSHOP, lv = { scythe: 6, swing: 2, hands: 2, days: 2, soil: 2, market: 2, clover: 1 } as Record<string, number>;
    let sum = 0;
    for (const [id, n] of Object.entries(lv)) for (let l = 0; l < n; l++) sum += W.upgradeCost(id, l);
    return sum;
  });
  expect(before).toBe(seedValue + paid);
  // a free reset: two taps
  await page.locator('.scr-tree [data-act="tree-reset"]').click();
  await expect(page.locator('.scr-tree [data-act="tree-reset"]')).toHaveClass(/\bred\b/);
  expect((await page.evaluate(() => (window as any).__DBD_APP.g)).tree.p1).toBe(1);
  await page.locator('.scr-tree [data-act="tree-reset"]').click();
  const g2 = await page.evaluate(() => (window as any).__DBD_APP.g);
  expect(Object.values(g2.tree).filter((v: any) => v > 0)).toHaveLength(0);
  expect(Object.values(g2.workshop.levels).every((v: any) => v === 0)).toBe(true);
  expect(g2.treeCredit).toBe(before);
  expect(g2.treeSpent).toBe(0);
  expect(g2.wallet).toBe(g.wallet);
  expect(await page.evaluate(() => (window as any).__DBD_ENGINE.state().shed.scythe)).toBe(0);
  expect(await page.evaluate(() => (window as any).__DBD_TREEFX.p1 || 0)).toBe(0);
  await expect(page.locator('.scr-tree .tr-credit')).toBeVisible();
  // tree credit is spent first: savings stay where they are
  await page.locator('.scr-tree .tr-row[data-arg="b1"]').click();
  await page.locator('.scr-tree [data-act="tree-buy"][data-arg="b1"]').click();
  const g3 = await page.evaluate(() => (window as any).__DBD_APP.g);
  expect(g3.workshop.levels.scythe).toBe(1);
  expect(g3.treeCredit).toBe(before - 70);
  expect(g3.wallet).toBe(g.wallet);
  expect(errors).toEqual([]);
});

/** A day on Toronto with the clock stopped and no finger on the field, for testing the tree's tricks one by one:
 *  `fx` sets the tree levels the engine reads (window.__DBD_TREEFX), `E` calls an engine hook. */
async function trickDay(page: Page, day = 1): Promise<string[]> {
  const errors = await boot(page, seeded(CA.slice(0, 2), 0));
  await act(page, 'play');
  await expect(page.locator('.scr-farmhouse .dc-day')).toBeVisible();
  if (day > 1) {
    await page.evaluate(d => {
      (window as any).__DBD_ENGINE.devDay(d);
      (window as any).__DBD_APP.show('farmhouse');
    }, day);
  }
  await act(page, 'start');
  await expect(page.locator('#dbdHud')).toBeVisible();
  // the clock stands still and the field is empty: only what a test puts on it is there
  await E(page, 'devClock', { stop: true, empty: true });
  return errors;
}
async function fx(page: Page, tree: Record<string, number>): Promise<void> {
  await page.evaluate(t => {
    (window as any).__DBD_TREEFX = t;
    (window as any).__DBD_ENGINE.refreshStats();
  }, tree);
}
async function E(page: Page, fn: string, ...args: unknown[]): Promise<any> {
  return page.evaluate(([f, a]) => (window as any).__DBD_ENGINE[f as string](...(a as unknown[])), [fn, args] as const);
}
/** Puts one ripe crop on the field and cuts it at once, outside any chain; returns what it paid. */
async function cut(page: Page, type = 'carrot', patch: Record<string, unknown> = {}, combo = 0): Promise<number> {
  // (the meter stays empty, so no power and no rush get in the way)
  await E(page, 'devClock', { combo, meter: 0, rush: 0 });
  const i = await E(page, 'devCrop', type, patch);
  expect(i).toBeGreaterThanOrEqual(0);
  return E(page, 'devCut', i);
}

test('tree tricks, blade and swing speed: each does what its text says (0.13)', async ({ page }) => {
  const errors = await trickDay(page);
  const len = (await E(page, 'state')).dayLen;
  const dmg = (await E(page, 'devTree')).dmg;
  // Heavy hand: the first hit of a crop is 20% harder (then 40%); the second is plain
  await fx(page, { b9: 2 });
  let i = await E(page, 'devCrop', 'carrot', { hp: 2 * dmg, maxHp: 2 * dmg });
  expect(await E(page, 'devHit', i, dmg * 0.1)).toBeCloseTo(dmg * 0.14, 5);
  expect(await E(page, 'devHit', i, dmg * 0.1)).toBeCloseTo(dmg * 0.1, 5);
  // Giant slayer: +30% on a crop that takes 4 or more cuts (then 45%, 60%), nothing on a smaller one
  await fx(page, { b10: 1 });
  i = await E(page, 'devCrop', 'carrot', { hp: 4 * dmg, maxHp: 4 * dmg, hit1: true });
  expect(await E(page, 'devHit', i, dmg * 0.1)).toBeCloseTo(dmg * 0.13, 5);
  await fx(page, { b10: 3 });
  expect(await E(page, 'devHit', i, dmg * 0.1)).toBeCloseTo(dmg * 0.16, 5);
  i = await E(page, 'devCrop', 'carrot', { hp: 3.9 * dmg, maxHp: 3.9 * dmg, hit1: true });
  expect(await E(page, 'devHit', i, dmg * 0.1)).toBeCloseTo(dmg * 0.1, 5);
  // Honed start: every swing crits for the first 3 s of the day (then 5 s); Charged edge: during the rush
  await fx(page, {});
  await E(page, 'devClock', { time: len - 1 });
  expect((await E(page, 'devTree')).sureCrit).toBe(false);
  await fx(page, { b6: 1 });
  expect((await E(page, 'devTree')).sureCrit).toBe(true);
  await E(page, 'devClock', { time: len - 4 });
  expect((await E(page, 'devTree')).sureCrit).toBe(false);
  await fx(page, { b6: 2 });
  expect((await E(page, 'devTree')).sureCrit).toBe(true);
  await fx(page, { x1: 1 });
  expect((await E(page, 'devTree')).sureCrit).toBe(false);
  await E(page, 'devClock', { rush: 2 });
  expect((await E(page, 'devTree')).sureCrit).toBe(true);
  // swing speed: Momentum +30% during the rush; Frenzy +1.5% a crop of the chain, up to 40%
  await fx(page, { x2: 1 });
  expect((await E(page, 'devTree')).swingBoost).toBeCloseTo(1.3, 5);
  await E(page, 'devClock', { rush: 0, combo: 10 });
  expect((await E(page, 'devTree')).swingBoost).toBeCloseTo(1, 5);
  await fx(page, { b16: 1 });
  expect((await E(page, 'devTree')).swingBoost).toBeCloseTo(1.15, 5);
  await E(page, 'devClock', { combo: 60 });
  expect((await E(page, 'devTree')).swingBoost).toBeCloseTo(1.4, 5);
  // Featherweight: +10% (then +20%), doubled while the field is at least four fifths full
  await E(page, 'devClock', { combo: 0 });
  await fx(page, { r14: 2 });
  expect((await E(page, 'devTree')).swingBoost).toBeCloseTo(1.2, 5);
  const max = (await E(page, 'stats')).max;
  for (let k = 0; k < Math.ceil(max * 0.8); k++) await E(page, 'devCrop', 'carrot', { x: 60 + 14 * k, y: 300 });
  expect((await E(page, 'devTree')).swingBoost).toBeCloseTo(1.4, 5);
  // Storm rod: crits throw lightning at one crop; Chain lightning: at a second
  await fx(page, {});
  expect((await E(page, 'devTree')).storm).toBe(false);
  await fx(page, { b5: 1 });
  expect(await E(page, 'devTree')).toMatchObject({ storm: true, stormN: 1 });
  await fx(page, { b5: 1, b8: 1 });
  expect((await E(page, 'devTree')).stormN).toBe(2);
  // Crit streak: with every swing a crit (Honed start), the fourth swing that lands is the ×5 one
  await fx(page, { b12: 1, b6: 2 });
  await E(page, 'devClock', { time: len });
  const big = await E(page, 'devCrop', 'carrot', { hp: 1e9, maxHp: 1e9 });
  const at = await page.evaluate(k => {
    const p = (window as any).__DBD_ENGINE.peek(), c = p.crops[k], r = document.getElementById('field')!.getBoundingClientRect();
    return { x: r.left + c.x * p.scale, y: r.top + (c.y - c.r * c.ds * 0.55) * p.scale };
  }, big);
  await page.evaluate(() => (window as any).__DBD_ENGINE.setTouchLift(0));
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await expect.poll(async () => (await E(page, 'devTree')).streakNext, { timeout: 5000 }).toBe(true);
  await page.mouse.up();
  expect(errors).toEqual([]);
});

test('tree tricks, what crops pay and the field: each does what its text says (0.13)', async ({ page }) => {
  // day 5: a market day for Market day, and a crop that joined the field this morning
  const errors = await trickDay(page, 5);
  const len = (await E(page, 'state')).dayLen;
  const mid = { time: len / 2 };
  await E(page, 'devClock', mid);
  const fresh = await page.evaluate(() => {
    const p = (window as any).__DBD_PLAN;
    return (p.crops.find((c: any) => c[2] === p.unlock + 4) || [''])[0];
  });
  expect(fresh).not.toBe('');
  const old = await page.evaluate(() => (window as any).__DBD_PLAN.crops[0][0]);
  // the plain price of each (the first cut of a kind also marks it as seen today)
  const base = await cut(page, old);
  const baseNew = await cut(page, fresh);
  expect(base).toBeGreaterThan(0);
  expect(await cut(page, old)).toBeCloseTo(base, 6);
  // Early bird: the first 4 s pay double. Harvest moon: the last 3 s
  await fx(page, { f16: 1 });
  expect(await cut(page, old)).toBeCloseTo(base, 6);
  await E(page, 'devClock', { time: len - 3 });
  expect(await cut(page, old)).toBeCloseTo(2 * base, 6);
  await fx(page, { f15: 1 });
  expect(await cut(page, old)).toBeCloseTo(base, 6);
  await E(page, 'devClock', { time: 2 });
  expect(await cut(page, old)).toBeCloseTo(2 * base, 6);
  await E(page, 'devClock', mid);
  // Crop rotation: this morning's new crop pays 25% more; the others do not
  await fx(page, { f11: 1 });
  expect(await cut(page, fresh)).toBeCloseTo(1.25 * baseNew, 6);
  expect(await cut(page, old)).toBeCloseTo(base, 6);
  // Market day: every fifth day, 30% more
  await fx(page, { m4: 1 });
  expect(await cut(page, old)).toBeCloseTo(1.3 * base, 6);
  // Organic label: twins and crops that sprouted again pay 50% more
  await fx(page, { x4: 1 });
  expect(await cut(page, old, { organic: true })).toBeCloseTo(1.5 * base, 6);
  expect(await cut(page, old)).toBeCloseTo(base, 6);
  // First of the day: the first crop of a kind pays ×5, the second does not
  await fx(page, { m6: 1 });
  const kind = await page.evaluate(([a, b]) => ['radish', 'cabbage', 'onion', 'pumpkin'].find(k => k !== a && k !== b)!, [old, fresh]);
  const first = await cut(page, kind);
  expect(first).toBeCloseTo(5 * (await cut(page, kind)), 6);
  // Bulk order: the tenth crop of a chain pays ×3 (then ×5)
  await fx(page, {});
  const tenth = await cut(page, old, {}, 9);
  await fx(page, { m3: 1 });
  expect(await cut(page, old, {}, 9)).toBeCloseTo(3 * tenth, 6);
  expect(await cut(page, old, {}, 8)).toBeLessThan(2 * tenth);
  await fx(page, { m3: 2 });
  expect(await cut(page, old, {}, 9)).toBeCloseTo(5 * tenth, 6);
  // Tip jar: a chain of 20 or more that ends drops 10% of what the chain paid
  await fx(page, { m11: 1 });
  const c1 = await cut(page, old); // a new chain
  const c2 = await cut(page, old, {}, 24); // ... now 25 long
  const before = (await E(page, 'peek')).today.earned;
  await E(page, 'devClock', { chainEnd: true });
  await expect.poll(async () => (await E(page, 'devTree')).combo).toBe(0);
  expect((await E(page, 'peek')).today.earned - before).toBe(Math.round((c1 + c2) * 0.1));
  // ... and a short chain drops nothing
  await cut(page, old);
  const b2 = (await E(page, 'peek')).today.earned;
  await E(page, 'devClock', { chainEnd: true });
  await expect.poll(async () => (await E(page, 'devTree')).combo).toBe(0);
  expect((await E(page, 'peek')).today.earned).toBe(b2);
  // Mulch: crops sprout 15% faster (then 30%)
  await fx(page, {});
  const spawn = (await E(page, 'devTree')).spawn;
  await fx(page, { f14: 1 });
  expect((await E(page, 'devTree')).spawn).toBeCloseTo(spawn / 1.15, 6);
  await fx(page, { f14: 2 });
  expect((await E(page, 'devTree')).spawn).toBeCloseTo(spawn / 1.3, 6);
  // Golden hour: in the last 5 s the sun waits while a chain of 10 or more is kept
  await fx(page, { f13: 1 });
  await E(page, 'devClock', { stop: false, time: 4, combo: 12 });
  await page.waitForTimeout(700);
  const st = await E(page, 'state');
  expect(st.time).toBeGreaterThan(3.9);
  expect((await E(page, 'devTree')).goldenHeld).toBeGreaterThan(0.3);
  // ... and runs again without the chain
  await E(page, 'devClock', { combo: 0 });
  await page.waitForTimeout(500);
  expect((await E(page, 'state')).time).toBeLessThan(3.9);
  expect(errors).toEqual([]);
});

test('tree tricks, the power and the reach of a swing: each does what its text says (0.13)', async ({ page }) => {
  const errors = await trickDay(page);
  const len = (await E(page, 'state')).dayLen;
  await E(page, 'devClock', { time: len / 2 });
  const T = () => E(page, 'devTree');
  const R = (await T()).R, dmg = (await T()).dmg;
  // a crop that can't be cut down, at a known spot, and what one swing takes off it
  const spot = await page.evaluate(() => {
    const p = (window as any).__DBD_ENGINE.peek();
    return { x: p.worldW * 0.5, y: 300 };
  });
  // (found by its health: a swing may cut down the crops around it, which moves it in the list)
  const hpOf = (_i: number) => page.evaluate(() => (window as any).__DBD_ENGINE.peek().crops.find((c: any) => c.hp > 1e8).hp);
  const big = await E(page, 'devCrop', 'carrot', { hp: 1e9, maxHp: 1e9, hit1: true, x: spot.x, y: spot.y });
  const cy = await page.evaluate(k => {
    const c = (window as any).__DBD_ENGINE.peek().crops[k];
    return c.y - c.r * c.ds * 0.55;
  }, big);
  // one swing at `dx` from the crop with the finger at `speed`; returns the damage in plain cuts (every swing a crit:
  // Honed start at dawn makes the test the same every time)
  const cm = 2.8;
  const swing = async (dx: number, speed = 0): Promise<number> => {
    const before = await hpOf(big);
    await E(page, 'devSwing', spot.x + dx, cy, speed);
    return (before - (await hpOf(big))) / (dmg * cm);
  };
  await E(page, 'devClock', { time: len, idle: 0 });
  await fx(page, { b6: 2 });
  expect(await swing(0)).toBeCloseTo(1, 4);
  // Sweet spot: +35% in the outer half of the swing (then 50%, 70%), nothing near the middle
  await fx(page, { b6: 2, r3: 1 });
  expect(await swing(R * 0.8)).toBeCloseTo(1.35, 4);
  expect(await swing(R * 0.3)).toBeCloseTo(1, 4);
  await fx(page, { b6: 2, r3: 3 });
  expect(await swing(R * 0.8)).toBeCloseTo(1.7, 4);
  // Wind trail: a fast finger stretches the swing by up to 30% (then 50%)
  const edge = await page.evaluate(k => {
    const c = (window as any).__DBD_ENGINE.peek().crops[k];
    return c.r * c.ds * 0.65;
  }, big);
  await fx(page, { b6: 2 });
  expect(await swing(R * 1.2 + edge, 1200)).toBe(0);
  await fx(page, { b6: 2, r4: 1 });
  expect(await swing(R * 1.2 + edge, 0)).toBe(0);
  expect(await swing(R * 1.2 + edge, 1200)).toBeCloseTo(1, 4);
  expect(await swing(R * 1.4 + edge, 1200)).toBe(0);
  await fx(page, { b6: 2, r4: 2 });
  expect(await swing(R * 1.4 + edge, 1200)).toBeCloseTo(1, 4);
  // Dancer: a swing with a fast finger hits twice
  await fx(page, { b6: 2, r16: 1 });
  expect(await swing(0, 300)).toBeCloseTo(1, 4);
  expect(await swing(0, 900)).toBeCloseTo(2, 4);
  // Spin cycle: every tenth swing that lands hits twice
  await fx(page, { b6: 2, r11: 1 });
  const n0 = (await T()).swingN;
  const got: number[] = [];
  for (let k = n0 + 1; k <= n0 + 10; k++) got.push(Math.round(await swing(0)) * (k % 10 === 0 ? -1 : 1));
  expect(got.filter(v => v === -2)).toHaveLength(1);
  expect(got.filter(v => v === 1)).toHaveLength(9);
  // Second wind: after 2 s without a cut, the next 5 swings are twice as fast
  await fx(page, { b6: 2, r9: 1 });
  await E(page, 'devClock', { idle: 1 });
  await swing(0);
  expect((await T()).swingBoost).toBeCloseTo(1, 5);
  await E(page, 'devClock', { idle: 2.5 });
  await swing(0);
  expect(await T()).toMatchObject({ windLeft: 5, swingBoost: 2 });
  for (let k = 0; k < 5; k++) await swing(0);
  expect(await T()).toMatchObject({ windLeft: 0, swingBoost: 1 });
  // Static: a crit that lands fills the meter by half a cut (the meter is 15 cuts)
  await fx(page, { b6: 2, p10: 1 });
  await E(page, 'devClock', { meter: 0, rush: 0 });
  await swing(0);
  await swing(0);
  expect((await T()).meter).toBeCloseTo(1 / 15, 6);
  // Sweep: a swing that hits 4 or more crops pays 25% more (then 50%)
  await fx(page, {});
  await E(page, 'devClock', { time: len / 2 });
  const one = await cut(page, 'carrot');
  const four = async (): Promise<number> => {
    await E(page, 'devClock', { combo: 0 });
    const pos = [[-0.4, -0.3], [0.4, -0.3], [-0.4, 0.4], [0.4, 0.4]];
    for (const [ax, ay] of pos) await E(page, 'devCrop', 'carrot', { hp: 1e-9, maxHp: 1, x: spot.x - 220 + ax * R, y: spot.y + ay * R });
    const before = (await E(page, 'peek')).today.earned;
    await E(page, 'devSwing', spot.x - 220, spot.y - 10, 0);
    return (await E(page, 'peek')).today.earned - before;
  };
  expect(await four()).toBeCloseTo(4 * one, 5);
  await fx(page, { r6: 1 });
  expect(await four()).toBeCloseTo(4 * one * 1.25, 5);
  await fx(page, { r6: 2 });
  expect(await four()).toBeCloseTo(4 * one * 1.5, 5);
  // Power payout: a crop the power cuts down pays 50% more (then double). Chain reaction: and half a cut in the meter
  await fx(page, { p14: 1 });
  expect(await cut(page, 'carrot')).toBeCloseTo(one, 6);
  await E(page, 'devClock', { powerKill: true });
  expect(await cut(page, 'carrot')).toBeCloseTo(1.5 * one, 6);
  await fx(page, { p14: 2, p16: 1 });
  expect(await cut(page, 'carrot')).toBeCloseTo(2 * one, 6);
  // (a cut fills the meter by itself too: one cut and Chain reaction's half)
  expect((await T()).meter).toBeCloseTo(1.5 / 15, 6);
  await E(page, 'devClock', { powerKill: false, meter: 0 });
  // Rush gold and Rush bloom: during the rush, three times the golden corn and crops sprouting twice as fast
  await fx(page, {});
  const gold = (await T()).golden;
  await E(page, 'devClock', { rush: 3 });
  expect(await T()).toMatchObject({ golden: gold, rushSprout: 1.35 });
  await fx(page, { p7: 1, p13: 1 });
  expect((await T()).golden).toBeCloseTo(3 * gold, 8);
  expect((await T()).rushSprout).toBe(2);
  await E(page, 'devClock', { rush: 0 });
  expect(await T()).toMatchObject({ golden: gold, rushSprout: 1 });
  // Aftershock: the power fires again half a second later
  await fx(page, { p11: 1 });
  await E(page, 'devPower', 1);
  expect((await T()).aftershock).toBe(true);
  await expect.poll(async () => (await E(page, 'peek')).today.aftershocks || 0, { timeout: 4000 }).toBe(1);
  expect((await E(page, 'peek')).today.powers).toBe(1);
  expect(errors).toEqual([]);
});

test('Tool master doubles a Whirlwind (0.13)', async ({ page }) => {
  const errors = await boot(page, seeded(CA.slice(0, 2), 0, { tools: { owned: ['sickle', 'scythe'], equipped: 'scythe', mods: {} } }));
  await act(page, 'play');
  await act(page, 'start');
  await expect(page.locator('#dbdHud')).toBeVisible();
  await E(page, 'devClock', { stop: true });
  await E(page, 'devPower', 1);
  const t1 = (await E(page, 'devTree')).vortexes[0].t;
  await fx(page, { p15: 1 });
  await E(page, 'devClock', { rush: 0 });
  await E(page, 'devPower', 1);
  const v = (await E(page, 'devTree')).vortexes;
  expect(v[v.length - 1].t / t1).toBeGreaterThan(1.9);
  expect(v[v.length - 1].t / t1).toBeLessThan(2.3);
  expect(errors).toEqual([]);
});

test('tree tricks, the ranch and the bank: each does what its text says (0.13)', async ({ page }) => {
  const errors = await trickDay(page);
  const len = (await E(page, 'state')).dayLen;
  await E(page, 'devClock', { time: len / 2, cash: 1000 });
  const T = () => E(page, 'devTree');
  const cash = async () => (await E(page, 'state')).cash;
  const earned = async () => (await E(page, 'peek')).today.earned;
  const mid = await page.evaluate(() => (window as any).__DBD_ENGINE.peek().worldW / 2);
  // a crow that carries $40 of the jar; a swipe gets the coins back
  const crow = (loot: number) => E(page, 'devClock', { crow: 'out', loot });
  // Crow bounty: a crow you chase off drops 2% of today's harvest. Crow hunter: it counts as a cut for the chain
  const one = await cut(page, 'carrot');
  await fx(page, {});
  await crow(40);
  let before = await cash();
  await E(page, 'devSwing', mid, 80, 0);
  expect((await cash()) - before).toBeCloseTo(40, 6);
  expect((await T()).combo).toBe(1);
  await fx(page, { a7: 1, x6: 1 });
  await E(page, 'devClock', { combo: 4 });
  await crow(0);
  before = await earned();
  await E(page, 'devSwing', mid, 80, 0);
  expect((await earned()) - before).toBeCloseTo(Math.round(one * 0.02), 6);
  expect((await T()).combo).toBe(5);
  // Farm dog: every 8 s it chases a crow off and brings back what it took; not sooner
  await fx(page, { a4: 1 });
  await page.waitForTimeout(400);
  await crow(25);
  before = await cash();
  await E(page, 'devClock', { ranch: 5 });
  expect((await cash()) - before).toBeCloseTo(0, 6);
  await E(page, 'devClock', { ranch: 3.5 });
  expect((await cash()) - before).toBeCloseTo(25, 6);
  // Pigeon post: a fertilizer bag every 12 s
  await fx(page, { a11: 1 });
  expect((await T()).props).toEqual([]);
  await E(page, 'devClock', { ranch: 11 });
  expect((await T()).props).toEqual([]);
  await E(page, 'devClock', { ranch: 1.5 });
  expect((await T()).props).toEqual(['fertilizer']);
  await E(page, 'devClock', { ranch: 12 });
  expect((await T()).props).toEqual(['fertilizer', 'fertilizer']);
  // Goat milk: the goat drops coins every 10 s it is on the field
  await fx(page, { x5: 1 });
  await E(page, 'devClock', { goat: true });
  before = await earned();
  await E(page, 'devClock', { ranch: 9 });
  expect((await earned()) - before).toBeCloseTo(0, 6);
  await E(page, 'devClock', { ranch: 1.2 });
  expect((await earned()) - before).toBeGreaterThan(0);
  // Duck pond: one hit frees a crop the boss's storm has caught (two without it)
  await fx(page, {});
  let i = await E(page, 'devCrop', 'carrot', { hp: 1e9, maxHp: 1e9, encase: { kind: 'ice', hits: 2 } });
  await E(page, 'devHit', i, 1);
  expect((await E(page, 'peek')).encased).toBe(1);
  await fx(page, { a13: 1 });
  i = await E(page, 'devCrop', 'carrot', { hp: 1e9, maxHp: 1e9, encase: { kind: 'ice', hits: 2 } });
  await E(page, 'devHit', i, 1);
  expect((await E(page, 'peek')).encased).toBe(1); // the first one, still caught
  // Clearing: a swing that cuts 3 or more crops at once leaves a fertilizer bag, one every 3 s at most
  await E(page, 'devClock', { empty: true });
  await fx(page, { x3: 1 });
  const R = (await T()).R;
  const three = async () => {
    for (const [ax, ay] of [[-0.4, -0.3], [0.4, -0.3], [0, 0.4]]) await E(page, 'devCrop', 'carrot', { hp: 1e-9, maxHp: 1, x: mid + ax * R, y: 300 + ay * R });
    await E(page, 'devSwing', mid, 290, 0);
  };
  await three();
  expect((await T()).props).toEqual(['fertilizer']);
  // (a second swing right away leaves no second bag; it may pick the first one up)
  await three();
  expect((await T()).props.length).toBeLessThanOrEqual(1);
  // Barn owl: in the last 3 s of the day a crow at the jar flies off with nothing
  await fx(page, { a6: 1 });
  await E(page, 'devClock', { time: 2, cash: 500, crow: 'in' });
  await expect.poll(async () => (await T()).crows, { timeout: 6000 }).toBe(0);
  expect(await cash()).toBeCloseTo(500, 6);
  // Barn cat: a bomb seed that is cut costs nothing and does not stun
  await E(page, 'devClock', { empty: true });
  await fx(page, { a15: 1 });
  await E(page, 'devClock', { bomb: [mid, 300], cash: 1000, time: len / 2 });
  // (the bomb is checked each frame under the finger: hold the finger there for a moment; last in this test, as
  // the mouse stays on the field afterwards)
  await page.evaluate(() => (window as any).__DBD_ENGINE.setTouchLift(0));
  const pt = await page.evaluate(m => {
    const p = (window as any).__DBD_ENGINE.peek(), r = document.getElementById('field')!.getBoundingClientRect();
    return { x: r.left + m * p.scale, y: r.top + 286 * p.scale };
  }, mid);
  await page.mouse.move(pt.x, pt.y);
  await page.mouse.down();
  await expect.poll(async () => (await E(page, 'peek')).bombs).toBe(0);
  await page.mouse.up();
  expect(await cash()).toBeCloseTo(1000, 6);
  expect((await E(page, 'peek')).stunned).toBe(false);
  expect(errors).toEqual([]);
});

test('Good lawyer lowers the late fees, Cashback pays 8% of a bill back the next morning, Insurance saves a quarter (0.13)', async ({ page }) => {
  const errors = await boot(page, seeded(CA.slice(0, 2), 0));
  await act(page, 'play');
  await expect(page.locator('.scr-farmhouse .dc-day')).toBeVisible();
  const due = async () => {
    await page.evaluate(() => {
      (window as any).__DBD_ENGINE.devDue();
      (window as any).__DBD_APP.show('farmhouse');
    });
  };
  // tonight's bill and no cash: the late day says what it costs, 20% without the lawyer, 10% with, free at level 2
  await due();
  await expect(page.locator('.scr-farmhouse .dc-late')).toContainText('20%');
  await fx(page, { m5: 1 });
  await page.evaluate(() => (window as any).__DBD_APP.show('farmhouse'));
  await expect(page.locator('.scr-farmhouse .dc-late')).toContainText('10%');
  expect((await E(page, 'state')).lateNext).toBeCloseTo(0.1, 9);
  await fx(page, { m5: 2 });
  await page.evaluate(() => (window as any).__DBD_APP.show('farmhouse'));
  await expect(page.locator('.scr-farmhouse .dc-late')).toContainText('0%');
  expect((await E(page, 'state')).lateNext).toBe(0);
  // the first late day of the farm is free; the second costs 40% less 10 points
  expect(await E(page, 'lateDay')).toBe(true);
  expect((await E(page, 'state')).lateNext).toBeCloseTo(0.3, 9);
  // Cashback: pay the bill with the keystone, and 8% of it comes back at the next dawn
  await fx(page, { m15: 1 });
  const bill = (await E(page, 'bill')).amt;
  await page.evaluate(b => {
    const e = (window as any).__DBD_ENGINE;
    e.devDue();
    e.setCash(b);
    (window as any).__DBD_APP.payBill();
  }, bill);
  await expect(page.locator('.scr-modal [data-act="chest-open"]')).toBeVisible();
  await page.locator('.scr-modal [data-act="chest-open"]').click();
  await takePerk(page.locator('.scr-modal [data-act="perk"]').first());
  expect((await E(page, 'state')).cash).toBe(0);
  await page.evaluate(() => (window as any).__DBD_APP.show('farmhouse'));
  await act(page, 'start');
  await expect(page.locator('#dbdHud')).toBeVisible();
  expect((await E(page, 'state')).cash).toBeGreaterThanOrEqual(Math.round(bill * 0.08));
  expect((await E(page, 'state')).cash).toBeLessThan(Math.round(bill * 0.08) + 1);
  // Insurance: the bank takes the farm with $400 on it, $100 of them above... no mark here, so a quarter is saved
  const saved = await page.evaluate(() => {
    const a = (window as any).__DBD_APP;
    a.g.tree.m12 = 1;
    a.foreclosed({ bill: 'New fence', short: 50, days: 4, cash: 400 });
    return { wallet: a.g.wallet, paid: a.g.cities.ca_toronto.paid };
  });
  expect(saved.wallet).toBe(100);
  expect(saved.paid).toBe(100);
  await expect(page.locator('.scr-lost .result-card')).toContainText('$100');
  expect(errors).toEqual([]);
});

test('tree tricks, batch five: bleeding, splinters, bees and honey, the hen, the ghost sickle (0.13)', async ({ page }) => {
  const errors = await trickDay(page);
  const len = (await E(page, 'state')).dayLen;
  await E(page, 'devClock', { time: len / 2 });
  const T = () => E(page, 'devTree');
  const earned = async () => (await E(page, 'peek')).today.earned;
  const hpOf = (min: number) => page.evaluate(m => (window as any).__DBD_ENGINE.peek().crops.find((c: any) => c.maxHp === m).hp, min);
  const mid = await page.evaluate(() => (window as any).__DBD_ENGINE.peek().worldW / 2);
  const dmg = (await T()).dmg;
  // Bleeding cut: a crop that is hit loses a third of the hit again over the next second (then a half, two thirds)
  await fx(page, { b4: 1 });
  let i = await E(page, 'devCrop', 'carrot', { hp: 1000, maxHp: 1000, hit1: true });
  expect(await E(page, 'devHit', i, 30)).toBeCloseTo(30, 6);
  await page.waitForTimeout(1500);
  expect(await hpOf(1000)).toBeCloseTo(1000 - 30 - 10, 4);
  await fx(page, { b4: 3 });
  await E(page, 'devHit', i, 30);
  await page.waitForTimeout(1500);
  expect(await hpOf(1000)).toBeCloseTo(960 - 30 - 20, 4);
  // Splinter: half of the damage left over when a crop falls jumps to the nearest crop (then all of it)
  await E(page, 'devClock', { empty: true });
  await fx(page, { b7: 1 });
  await E(page, 'devCrop', 'carrot', { hp: 2000, maxHp: 2000, hit1: true, x: mid + 60, y: 300 });
  i = await E(page, 'devCrop', 'carrot', { hp: 10, maxHp: 10, hit1: true, x: mid, y: 300 });
  await E(page, 'devHit', i, 110);
  expect(await hpOf(2000)).toBeCloseTo(2000 - 50, 6);
  await fx(page, { b7: 2 });
  i = await E(page, 'devCrop', 'carrot', { hp: 10, maxHp: 10, hit1: true, x: mid, y: 300 });
  await E(page, 'devHit', i, 110);
  expect(await hpOf(2000)).toBeCloseTo(1950 - 100, 6);
  // Beehive: every 3 s a bee lands on a ripe crop, and that crop pays ×2. Honey: 5% of what it paid, sold at sunset
  await E(page, 'devClock', { empty: true });
  await fx(page, {});
  const one = await cut(page, 'carrot');
  await fx(page, { a5: 1, a10: 1 });
  i = await E(page, 'devCrop', 'carrot', {});
  await E(page, 'devClock', { ranch: 2.5 });
  expect((await E(page, 'peek')).crops.filter((c: any) => c.bee).length).toBe(0);
  await E(page, 'devClock', { ranch: 0.6 });
  expect((await E(page, 'peek')).crops.filter((c: any) => c.bee).length).toBe(1);
  await E(page, 'devClock', { combo: 0, meter: 0, rush: 0 });
  expect(await E(page, 'devCut', i)).toBeCloseTo(2 * one, 6);
  expect(await cut(page, 'carrot')).toBeCloseTo(one, 6);
  // Hen house: an egg every 10 s; a swipe turns it into coins
  await fx(page, { a8: 1 });
  await E(page, 'devClock', { ranch: 10.5 });
  const props = (await E(page, 'peek')).props;
  expect(props.map((p: any) => p.kind)).toEqual(['egg']);
  let before = await earned();
  await E(page, 'devSwing', props[0].x, props[0].y - 14, 0);
  expect((await earned()) - before).toBeGreaterThan(0);
  expect((await T()).props).toEqual([]);
  // Ghost sickle: it swings where the finger was a moment ago, for 40% of a plain hit (then 70%)
  await E(page, 'devClock', { empty: true });
  await fx(page, { r7: 1 });
  await E(page, 'devCrop', 'carrot', { hp: 5000, maxHp: 5000, hit1: true, x: mid - 250, y: 300 });
  const gy = await page.evaluate(() => {
    const c = (window as any).__DBD_ENGINE.peek().crops.find((k: any) => k.maxHp === 5000);
    return c.y - c.r * c.ds * 0.55;
  });
  await E(page, 'devClock', { ghostAt: [mid - 250, gy] });
  // the finger is far from the crop; only the ghost reaches it
  await page.evaluate(([x, y]) => {
    const e = (window as any).__DBD_ENGINE;
    e.devClock({ ghostAt: [x, y] });
    e.devSwing(x + 400, y, 0);
  }, [mid - 250, gy]);
  expect(5000 - (await hpOf(5000))).toBeCloseTo(0.4 * dmg, 5);
  await fx(page, { r7: 2 });
  await page.evaluate(([x, y]) => {
    const e = (window as any).__DBD_ENGINE;
    e.devClock({ ghostAt: [x, y] });
    e.devSwing(x + 400, y, 0);
  }, [mid - 250, gy]);
  expect(5000 - (await hpOf(5000))).toBeCloseTo(1.1 * dmg, 5);
  // sunset: the honey is sold (5% of the $2×one the bee's crop paid)
  before = await earned();
  await E(page, 'devClock', { endDay: true });
  await expect(page.locator('.scr-sundown .sundown-card')).toBeVisible({ timeout: 15_000 });
  expect(errors).toEqual([]);
});

test("Armour breaker hurts the boss through its armour, and Rival's envy pays half the record with the crown (0.13)", async ({ page }) => {
  const errors = await boot(page, seeded(CA.slice(0, 5), 0, { tree: { m10: 1 } }));
  await page.evaluate(() => (window as any).__DBD_APP.farmHere('ca_kelowna'));
  await expect(page.locator('.scr-farmhouse .dc-day')).toBeVisible();
  await act(page, 'start');
  await expect(page.locator('#dbdHud')).toBeVisible();
  await E(page, 'devClock', { stop: true, empty: true });
  const boss = async () => (await E(page, 'peek')).crops.find((c: any) => c.boss);
  const b0 = await boss();
  expect(b0).toBeTruthy();
  const idx = (await E(page, 'peek')).crops.findIndex((c: any) => c.boss);
  // armour on: a hit clinks and does nothing
  await fx(page, {});
  await E(page, 'devHit', idx, 100);
  expect((await boss()).hp).toBe(b0.hp);
  // with Armour breaker: 20% of it gets through (then 40%)
  await fx(page, { b14: 1 });
  await E(page, 'devHit', idx, 100);
  expect(b0.hp - (await boss()).hp).toBeCloseTo(20, 6);
  await fx(page, { b14: 2 });
  await E(page, 'devHit', idx, 100);
  expect(b0.hp - (await boss()).hp).toBeCloseTo(60, 6);
  // Rival's envy: today beats the city's record, and Sundown shows the crown and half the record on top
  const record = await page.evaluate(() => (window as any).__DBD_PLAN.record);
  await page.evaluate(r => {
    const e = (window as any).__DBD_ENGINE;
    for (let k = 0; k < 400 && e.peek().today.earned < r + 50; k++) e.devCut(e.devCrop('carrot', {}));
    e.devClock({ endDay: true });
  }, record);
  await expect(page.locator('.scr-sundown .sd-crown')).toContainText('$' + Math.round(record / 2).toLocaleString('en-US'), { timeout: 15_000 });
  expect(errors).toEqual([]);
});

test('menu: the signpost (Design 4), Barn opens the upgrade tree or the Bling Barn, the plank opens the map', async ({ page }) => {
  const errors = await boot(page);
  await expect(page.locator('.scr-menu .sp-play')).toBeVisible();
  await expect(page.locator('.scr-menu [data-act="crowns"]')).toHaveCount(0);
  await act(page, 'barn-menu');
  await page.locator('.scr-modal [data-act="tree"]').click();
  await expect(page.locator('.scr-tree .tr-map')).toBeVisible();
  // back from the tree is the menu it was opened from
  await page.locator('.scr-tree [data-act="tree-back"]').click();
  await expect(page.locator('.scr-menu .sp-play')).toBeVisible();
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
  // Sundown's Upgrades button opens the upgrade tree (0.13), and its back button returns to Sundown
  await page.locator('.scr-sundown .sd-ups').click();
  await expect(page.locator('.scr-tree .tr-map')).toBeVisible();
  expect(await page.evaluate(() => (window as any).__DBD_APP.music.mood)).toBe('field');
  await page.locator('.scr-tree [data-act="tree-back"]').click();
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
  await page.locator('.scr-farmhouse .fh-tile.big').click();
  await page.locator('.scr-tree .tr-nd[data-arg="b1"]').click();
  const buy = page.locator('.scr-tree [data-act="tree-buy"]:not([disabled])').first();
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
