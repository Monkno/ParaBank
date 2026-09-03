import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',

  fullyParallel: true,

  /**
   * 2, measured. The ceiling here is not the driver or the server but a
   * Cloudflare rate limit in front of the shared demo: at 4 workers the suite
   * tripped it 35 seconds in and every subsequent request from this address was
   * answered 429 ("Error 1015 - you are being rate limited") for roughly five
   * minutes. At 2 workers the same 46 browser tests finish in 74 seconds with no
   * throttling at all. More parallelism buys nothing and costs the whole run.
   * See STRATEGY.md, "Parallelism".
   */
  workers: process.env.WORKERS ? Number(process.env.WORKERS) : 2,

  /**
   * The public demo answers a request in 250 ms on a good day and stalls for 20 s
   * on a bad one, and its database is periodically wiped by whoever hits
   * admin.htm. Retries absorb that noise without hiding defects, because
   * `trace: 'on-first-retry'` means every retry leaves evidence to read.
   */
  retries: isCI ? 2 : 1,
  forbidOnly: isCI,

  timeout: 120_000,
  expect: { timeout: 20_000 },

  reporter: isCI
    ? [['list'], ['html', { open: 'never' }], ['github']]
    : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: process.env.BASE_URL ?? 'https://parabank.parasoft.com',

    actionTimeout: 25_000,
    navigationTimeout: 60_000,

    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },

    /**
     * Pinned, not incidental. ParaBank stores a transaction date as midnight UTC
     * and renders it with `new Date(ms).getDate()`, i.e. in the *browser's* zone,
     * so any browser west of UTC shows every transaction one day early
     * (defect D07). Pinning UTC makes the date-search cases deterministic on any
     * developer's machine; `tests/accounts/timezone.spec.ts` overrides it back to
     * a negative offset to assert the defect itself rather than paper over it.
     */
    timezoneId: 'UTC',
    locale: 'en-US',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
