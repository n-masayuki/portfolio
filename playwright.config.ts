import { defineConfig, devices } from '@playwright/test';

// Astroの開発・プレビュー用ポートと分ける。
const testPort = process.env.PLAYWRIGHT_TEST_PORT ?? '14322';
const baseURL = `http://127.0.0.1:${testPort}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 3,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    serviceWorkers: 'block',
    reducedMotion: 'reduce',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL ?? 'chromium',
      },
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'], defaultBrowserType: 'webkit' },
    },
  ],
  // 開発サーバーではなく、ビルド済みの配布物をテストする。
  webServer: {
    command: 'node scripts/test-server.mjs',
    env: { PLAYWRIGHT_TEST_PORT: testPort },
    url: baseURL,
    reuseExistingServer: false,
  },
});
