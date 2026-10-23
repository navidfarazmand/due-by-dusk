import { expect, test, type Page } from '@playwright/test';

async function state(page: Page) {
  return page.evaluate(() => (window as any).__DBD_TEST.getState());
}

async function boot(page: Page) {
  await page.goto('/');
  await page.waitForFunction(() => !!(window as any).__DBD_TEST);
  await expect(page.locator('[data-act="start"]')).toBeVisible();
  await expect.poll(() => page.locator('#field').evaluate((element: HTMLCanvasElement) => {
    const pixel = element.getContext('2d')!.getImageData(Math.floor(element.width / 2), Math.floor(element.height / 2), 1, 1).data;
    return pixel[3];
  }), { message: 'The game paints actual scenery on the field canvas.' }).toBeGreaterThan(0);
}

test('bottom dock leaves every crop clear and gear pauses until explicit resume', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await boot(page);
  await expect(page.locator('#btnManagement')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#managementDrawer')).not.toBeVisible();
  const geometry = await page.evaluate(() => {
    const stage = document.querySelector('#stage')!.getBoundingClientRect();
    const dock = document.querySelector('.bottom-dock')!.getBoundingClientRect();
    return { width: stage.width, height: stage.height, stageBottom: stage.bottom, dockTop: dock.top, dockBottom: dock.bottom, scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight, widthScreen: innerWidth, heightScreen: innerHeight };
  });
  expect(geometry.width).toBeGreaterThan(geometry.widthScreen * .93);
  expect(geometry.height).toBeGreaterThan(geometry.heightScreen * .5);
  expect(geometry.stageBottom).toBeLessThanOrEqual(geometry.dockTop + 1);
  expect(geometry.dockBottom).toBeCloseTo(geometry.heightScreen, 0);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.widthScreen);
  expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.heightScreen);
  await page.screenshot({ path: testInfo.outputPath('landscape-ready.png') });
  await page.locator('[data-act="start"]').click();
  await expect.poll(async () => (await state(page)).mode).toBe('day');
  await expect(page.locator('#billHud')).toBeVisible();
  await expect(page.locator('#hudLight')).toBeVisible();
  const placement = await page.evaluate(() => {
    const field = document.querySelector('#stage')!.getBoundingClientRect();
    const dockIds = ['hudToday', 'hCash', 'hDay', 'billHud', 'hudLight', 'multiplierValue', 'chainCount', 'rushLabel', 'btnPause', 'btnManagement'];
    const controls = [...document.querySelectorAll<HTMLButtonElement>('button')].filter(button => button.getClientRects().length > 0 && getComputedStyle(button).visibility === 'visible');
    return {
      dockItems: dockIds.map(id => {
        const element = document.getElementById(id)!, rect = element.getBoundingClientRect();
        return { id, insideField: !!element.closest('#stage'), top: rect.top, fieldBottom: field.bottom };
      }),
      controls: controls.map(button => ({ id: button.id || button.textContent, width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })),
      tipBottom: document.querySelector('.field-messages')!.getBoundingClientRect().bottom,
      fieldTop: field.top,
    };
  });
  for (const item of placement.dockItems) {
    expect(item.insideField, `${item.id} must live outside the playable field`).toBe(false);
    expect(item.top, `${item.id} must not cover a crop`).toBeGreaterThanOrEqual(item.fieldBottom - 1);
  }
  for (const control of placement.controls) {
    // Translated drawers can introduce sub-pixel floating-point differences.
    expect(control.width, `${control.id} touch width`).toBeGreaterThanOrEqual(43.99);
    expect(control.height, `${control.id} touch height`).toBeGreaterThanOrEqual(43.99);
  }
  expect(placement.tipBottom).toBeLessThanOrEqual(placement.fieldTop + 1);
  await page.locator('#btnManagement').click();
  await expect(page.locator('#managementDrawer')).toBeVisible();
  await expect.poll(async () => (await state(page)).paused).toBe(true);
  const pausedTime = (await state(page)).time;
  await page.waitForTimeout(350);
  expect((await state(page)).time).toBe(pausedTime);
  const closeBounds = await page.locator('#btnManagementClose').boundingBox();
  expect(closeBounds!.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: testInfo.outputPath('landscape-management.png') });
  await page.locator('#btnManagementClose').click();
  await expect(page.locator('#managementDrawer')).not.toBeVisible();
  expect((await state(page)).paused).toBe(true);
  await page.locator('#btnManagement').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#managementDrawer')).not.toBeVisible();
  expect((await state(page)).paused).toBe(true);
  await page.locator('#btnResume').click();
  await expect.poll(async () => (await state(page)).paused).toBe(false);
  await expect.poll(async () => (await state(page)).time).toBeLessThan(pausedTime);
  // Capture mature crops after the brief first-harvest instruction has faded.
  await page.waitForTimeout(3000);
  await page.screenshot({ path: testInfo.outputPath('landscape-harvest.png') });
  expect(errors).toEqual([]);
});

test('mature vegetables are finger sized and the lowest crop can be harvested by touch', async ({ page, context }, testInfo) => {
  await boot(page);
  await page.locator('[data-act="start"]').click();
  await expect.poll(async () => (await state(page)).cropTargets?.length || 0, { timeout: 7000 }).toBeGreaterThan(0);
  const targets = (await state(page)).cropTargets as Array<{ screenX: number; screenY: number; fingerX: number; fingerY: number; diameter: number }>;
  const field = (await page.locator('#field').boundingBox())!;
  for (const target of targets) {
    expect(target.diameter, 'Smallest mature vegetable must have a visible 32 CSS pixel diameter').toBeGreaterThanOrEqual(32);
    expect(target.fingerX).toBeGreaterThanOrEqual(field.x + 32);
    expect(target.fingerX).toBeLessThanOrEqual(field.x + field.width - 32);
    expect(target.fingerY).toBeGreaterThanOrEqual(field.y + 15);
    expect(target.fingerY).toBeLessThanOrEqual(field.y + field.height - 15);
  }
  const lowest = targets.reduce((a, b) => a.fingerY > b.fingerY ? a : b);
  const readEarned = async () => Number((await page.locator('#hudEarn').innerText()).replace(/[^\d.-]/g, ''));
  const before = await readEarned();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: lowest.fingerX, y: lowest.fingerY, id: 1 }] });
  try {
    // Onions and cabbages need several ordinary swings. Keep the finger on the
    // actual lowest crop until it pays out, independently of its random health.
    await expect.poll(readEarned, { timeout: 6000 }).toBeGreaterThan(before);
  } finally {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  await page.screenshot({ path: testInfo.outputPath('lowest-crop-touch-harvest.png') });
  await cdp.detach();
});

test('each completed farm awards one point and reloading never duplicates it', async ({ page }) => {
  await boot(page);
  const before = await state(page);
  expect(before.meta.diamonds).toBe(0);
  await page.evaluate(() => (window as any).__DBD_TEST.completeFarmForTest());
  expect((await state(page)).meta.diamonds).toBe(before.meta.diamonds + 1);
  await page.reload();
  await page.waitForFunction(() => !!(window as any).__DBD_TEST);
  expect((await state(page)).meta.diamonds).toBe(before.meta.diamonds + 1);
  await page.evaluate(() => (window as any).__DBD_TEST.completeFarmForTest());
  expect((await state(page)).meta.diamonds).toBe(before.meta.diamonds + 2);
  await page.reload();
  await page.waitForFunction(() => !!(window as any).__DBD_TEST);
  expect((await state(page)).meta.diamonds).toBe(before.meta.diamonds + 2);
});

test('touch hold charges and release fires a cleave', async ({ page, context }) => {
  await boot(page);
  await page.locator('[data-act="start"]').click();
  await expect.poll(async () => (await state(page)).mode).toBe('day');
  const field = await page.locator('#field').boundingBox();
  const x = field!.x + field!.width * .51, y = field!.y + field!.height * .7;
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  await expect.poll(async () => (await state(page)).chargeT, { timeout: 5000 }).toBeGreaterThanOrEqual(.72);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const released = await state(page);
  expect(released.chargeT).toBeLessThan(.1);
  if ('cleaveRingCount' in released) expect(released.cleaveRingCount).toBeGreaterThan(0);
  await cdp.detach();
});

test('interrupting a harvest reloads the saved checkpoint without adding cash', async ({ page }) => {
  await boot(page);
  const before = await state(page);
  await page.locator('[data-act="start"]').click();
  await expect.poll(async () => (await state(page)).mode).toBe('day');
  const field = await page.locator('#field').boundingBox();
  await page.mouse.move(field!.x + field!.width * .3, field!.y + field!.height * .6);
  await page.mouse.move(field!.x + field!.width * .75, field!.y + field!.height * .75, { steps: 15 });
  await page.locator('#btnManagement').click();
  await page.reload();
  await page.waitForFunction(() => !!(window as any).__DBD_TEST);
  const after = await state(page);
  expect(after.mode).toBe('idle');
  expect(after.farm.cash).toBe(before.farm.cash);
  expect(after.farm.day).toBe(before.farm.day);
  await page.reload();
  await page.waitForFunction(() => !!(window as any).__DBD_TEST);
  expect((await state(page)).farm.cash).toBe(before.farm.cash);
});

test('all boot assets are local and harvesting continues without network', async ({ page, context }) => {
  const remoteRequests: string[] = [];
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) && ['http:', 'https:'].includes(url.protocol)) {
      remoteRequests.push(url.href);
      return route.abort();
    }
    return route.continue();
  });
  await boot(page);
  await page.locator('[data-act="start"]').click();
  await expect.poll(async () => (await state(page)).mode).toBe('day');
  const initialTime = (await state(page)).time;
  await context.setOffline(true);
  await expect.poll(async () => (await state(page)).time).toBeLessThan(initialTime - .3);
  expect(remoteRequests).toEqual([]);
  await expect(page.locator('#field')).toBeVisible();
});
