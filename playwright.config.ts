import { defineConfig, devices } from '@playwright/test';

const serverPort = process.env.PW_SERVER_PORT ?? '3001';
const clientPort = process.env.PW_CLIENT_PORT ?? '5173';
const baseURL = process.env.PW_BASE_URL ?? `http://localhost:${clientPort}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm run build -w shared && npm run dev:server',
      url: `http://localhost:${serverPort}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        PORT: serverPort,
        ...(process.env.MONGO_URL ? { MONGO_URL: process.env.MONGO_URL } : {}),
      },
    },
    {
      command: `node_modules/.bin/vite client --port ${clientPort} --strictPort`,
      url: `http://localhost:${clientPort}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { VITE_API_PROXY_TARGET: `http://localhost:${serverPort}` },
    },
  ],
});
