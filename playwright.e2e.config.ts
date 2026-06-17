import { defineConfig, devices, isCI, env, sharedConfig, sharedUse, makeWebServer } from './playwright/shared.config';

/**
 * FUNCTIONAL end-to-end suite. Separate from the screenshot generator: no
 * globalSetup/teardown promoting PNGs into src/assets, no per-viewport projects,
 * no manifest. Specs only drive the app and assert behaviour, but REUSE the
 * screenshot system's infrastructure via the `app` fixture.
 *
 *   npm run e2e         # headless
 *   npm run e2e:ui      # interactive
 *   npm run e2e:headed  # real browser
 */
export default defineConfig({
  ...sharedConfig,
  testDir: './playwright/e2e',
  workers: isCI ? 1 : 4,
  retries: isCI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright/.e2e-report' }]],
  outputDir: 'playwright/.e2e-artifacts',

  use: {
    ...sharedUse,
    baseURL: env('E2E_BASE_URL', 'http://localhost:4200'),
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
  ],

  webServer: makeWebServer('E2E_BASE_URL', 'E2E_SERVE_CMD'),
});
