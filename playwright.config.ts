import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

const isCI = !!process.env.CI;

function configuredWorkers(): number {
  const raw = process.env.WORKERS;
  if (raw === undefined) {
    return 1;
  }

  const workers = Number(raw);
  if (!Number.isInteger(workers) || workers < 1 || workers > 2) {
    throw new Error(`WORKERS must be 1 or 2 for the shared public demo; received ${JSON.stringify(raw)}`);
  }
  return workers;
}

export default defineConfig({
  testDir: './tests',
  testIgnore: ['unit/**'],
  outputDir: './test-results',
  globalSetup: './src/setup/preflight.ts',

  fullyParallel: true,

  /**
   * 1 by default. The ceiling here is not the driver or the server but a
   * Cloudflare rate limit in front of the shared demo: at 4 workers the suite
   * tripped it 35 seconds in and every subsequent request from this address was
   * answered 429 ("Error 1015 - you are being rate limited") for roughly five
   * minutes. Two workers have passed in isolation but also tripped the limit in a
   * later full run, so they remain an explicit opt-in rather than the safe default.
   * See STRATEGY.md, "The Cloudflare rate limit".
   */
  workers: configuredWorkers(),

  // Retry policy belongs to each workload below: safe reads may retry once,
  // while anything that writes is never replayed against the shared database.
  retries: 0,
  forbidOnly: isCI,
  // Stop a systemic outage or rate limit from needlessly hammering the shared
  // third-party demo for the rest of the run.
  maxFailures: 1,

  timeout: 120_000,
  expect: { timeout: 20_000 },

  reporter: isCI
    ? [['list'], ['html', { open: 'never' }], ['github']]
    : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: process.env.BASE_URL ?? 'https://parabank.parasoft.com',

    actionTimeout: 25_000,
    navigationTimeout: 60_000,

    // Capture the execution that actually failed. With `on-first-retry`, a
    // locally failing test (zero retries) produced no trace at all.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },

    /**
     * Pinned, not incidental. ParaBank stores a transaction date as midnight UTC
     * and renders it with `new Date(ms).getDate()`, i.e. in the *browser's* zone,
     * so any browser west of UTC shows every transaction one day early
     * (defect D07). Pinning UTC makes the date-search cases deterministic on any
     * developer's machine; the defect itself is recorded as D07 in STRATEGY.md rather than
     * papered over here.
     */
    timezoneId: 'UTC',
    locale: 'en-US',
  },

  projects: [
    {
      name: 'functional-read-only',
      grep: /@read-only/,
      grepInvert: /@known-defect/,
      retries: isCI ? 1 : 0,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'functional-mutating',
      grep: /@mutating/,
      grepInvert: /@known-defect/,
      retries: 0,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'known-defect',
      grep: /@known-defect/,
      retries: 0,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
