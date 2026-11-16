import { defineConfig, devices } from '@playwright/test';

/**
 * Alt-port e2e config used by the historical backfill verification (the user's
 * 3001/5173 stack must not be restarted). Start the API on 3101 and the Vite
 * client on 5174 first, then:
 *
 *   npx playwright test --config=e2e/playwright.alt.config.ts
 */
export default defineConfig({
  testDir: '.',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_ALT_BASE_URL ?? 'http://localhost:5174',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
