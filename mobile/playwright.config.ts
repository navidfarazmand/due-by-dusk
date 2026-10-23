import { defineConfig } from '@playwright/test';

const baseURL = process.env.DBD_BASE_URL || 'http://127.0.0.1:5173';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    browserName: 'chromium',
    hasTouch: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'landscape-phone', use: { viewport: { width: 844, height: 390 } } },
    { name: 'small-landscape-phone', use: { viewport: { width: 667, height: 375 } } },
    { name: 'a71-landscape', use: { viewport: { width: 914, height: 412 } } },
    { name: 'a71-compact-landscape', use: { viewport: { width: 800, height: 360 } } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: process.env.DBD_SKIP_SERVER === '1' ? undefined : {
    command: `npm run dev -- --port ${new URL(baseURL).port || '5173'}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
