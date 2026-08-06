import { defineConfig, devices } from '@playwright/test';

/**
 * E2E / browser harness.
 *
 * Runs against a deployed target rather than a local server: booting locally
 * needs DATABASE_URL and JWT_SECRET_KEY, and .env.example carries several
 * conflicting DATABASE_URL entries, so a local run is the slower and less
 * representative option.
 *
 *   npm run test:e2e
 *   E2E_BASE_URL=https://ccw-erp-git-my-branch.vercel.app npm run test:e2e
 *
 * Authenticated specs need credentials. They are read from the environment and
 * the suite FAILS LOUDLY when they are absent — it does not skip quietly. A
 * suite that reports green because it silently skipped the half that matters is
 * worse than one that reports red.
 */
const BASE_URL = process.env.E2E_BASE_URL || 'https://ccw-crm-web.vercel.app';

export default defineConfig({
  testDir: './e2e',
  // Deployed target under mobile-throttled audits elsewhere; give pages room.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 810 } },
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'] },
    },
  ],

  // Visual baselines live next to the specs; regenerate with --update-snapshots.
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
});
