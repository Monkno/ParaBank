import { defineConfig } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests/unit',
  outputDir: './test-results/unit',
  fullyParallel: true,
  retries: 0,
  forbidOnly: isCI,
  timeout: 10_000,
  reporter: isCI ? [['list'], ['github']] : [['list']],
  projects: [{ name: 'unit' }],
});
