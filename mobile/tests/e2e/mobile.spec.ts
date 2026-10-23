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

test('landscape field fills the screen and gear pauses until explicit resume', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await boot(page);
  await expect(page.locator('#btnManagement')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#managementDrawer')).not.toBeVisible();
  const geometry = await page.evaluate(() => {
    const stage = document.querySelector('#stage')!.getBoundingClientRect();
    return { width: stage.width, height: stage.height, scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight, widthScreen: innerWidth, heightScreen: innerHeight };
  });
  expect(geometry.width).toBeGreaterThan(geometry.widthScreen * .93);
  expect(geometry.height).toBeGreaterThan(geometry.heightScreen * .77);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.widthScreen);
  expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.heightScreen);
  await page.screenshot({ path: testInfo.outputPath('landscape-ready.png') });
  await page.locator('[data-act="start"]').click();
  await expect.poll(async () => (await state(page)).mode).toBe('day');
  await expect(page.locator('#billHud')).toBeVisible();
  await expect(page.locator('#hudLight')).toBeVisible();
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
