import type { PlaywrightTestConfig } from '@playwright/test';

const isCI = process.env.CI === '1' || process.env.CI === 'true';

const config: PlaywrightTestConfig = {
  testDir: './tests',
  reporter: [['list'], ['html', { outputFolder: 'reports/playwright', open: 'never' }]],
  outputDir: 'reports/playwright-results',
  use: {
    baseURL: 'http://127.0.0.1:3100',
  },
  webServer: {
    command: isCI
      ? 'rm -rf .next && pnpm build && pnpm start --hostname 127.0.0.1 --port 3100'
      : 'pnpm dev --hostname 127.0.0.1 --port 3100',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: false,
    cwd: __dirname,
  },
};

export default config;
