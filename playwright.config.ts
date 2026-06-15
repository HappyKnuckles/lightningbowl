import { defineConfig, devices } from '@playwright/test';
import { VIEWPORTS } from './playwright/screenshots/lib/viewports';

/**
 * Playwright configuration for the automated screenshot system.
 *
 * This config is intentionally NOT a visual-regression setup. We do not use
 * `toHaveScreenshot()` snapshots; instead each test writes a deterministic PNG
 * directly into `src/assets/screenshots/<feature>/<page>[_wide].png` driven by
 * the registry in `playwright/screenshots/registry.ts`.
 *
 * Run everything with:  npm run update:screenshots
 *
 * See playwright/screenshots/README.md for the full architecture.
 */
export default defineConfig({
  testDir: './playwright/screenshots',
  // The capture-fixtures helper is opt-in (npm run capture:fixtures) and should
  // not run as part of the normal screenshot pass.
  testIgnore: ['**/capture-fixtures.spec.ts'],
  // Setup prepares a staging dir; teardown promotes `app` shots into src/assets
  // and writes the manifest (kept out of the run so ng serve doesn't rebuild).
  globalSetup: './playwright/screenshots/lib/global-setup.ts',
  globalTeardown: './playwright/screenshots/lib/global-teardown.ts',

  // Screenshots must be reproducible, so no parallel non-determinism inside a
  // single shot. Multiple shots can still run concurrently against the dev
  // server; keep the worker count modest so `ng serve` is not overwhelmed.
  fullyParallel: true,
  workers: process.env['CI'] ? 1 : 6,
  // A flaky external dev-server hiccup should not fail the whole pass.
  retries: process.env['CI'] ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },

  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright/.report' }]],
  outputDir: 'playwright/.artifacts',

  use: {
    baseURL: process.env['SCREENSHOT_BASE_URL'] ?? 'http://localhost:4200',
    // Deterministic locale/timezone so any date/number formatting is stable.
    locale: 'en-US',
    timezoneId: 'UTC',
    // OS-level motion is disabled per-page via page.emulateMedia('reduce') in
    // stabilize.ts (combined with the CSS/JS freeze), removing Ionic page
    // transitions, ripples and CSS keyframes.
    // The alley map reads navigator.geolocation. Pin it to a fixed location and
    // pre-grant the permission so the map always centers identically.
    geolocation: { latitude: 40.7128, longitude: -74.006 },
    permissions: ['geolocation'],
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'off',
    video: 'off',
  },

  projects: [
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: VIEWPORTS.mobile.viewport,
        deviceScaleFactor: VIEWPORTS.mobile.deviceScaleFactor,
        isMobile: true,
        hasTouch: true,
        // iPhone UA makes Ionic render its iOS mode, matching the App Store look.
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      },
    },
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: VIEWPORTS.desktop.viewport,
        deviceScaleFactor: VIEWPORTS.desktop.deviceScaleFactor,
        isMobile: false,
        hasTouch: false,
      },
    },
  ],

  webServer: {
    command: process.env['SCREENSHOT_SERVE_CMD'] ?? 'npm run start',
    url: process.env['SCREENSHOT_BASE_URL'] ?? 'http://localhost:4200',
    reuseExistingServer: !process.env['CI'],
    timeout: 240_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
