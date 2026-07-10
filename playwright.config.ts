import { defineConfig, devices, isCI, env, sharedConfig, sharedUse, mobileUse, makeWebServer } from './playwright/shared.config';
import { VIEWPORTS } from './playwright/screenshots/lib/viewports';

/**
 * Automated screenshot system. NOT visual-regression: instead of
 * toHaveScreenshot() snapshots, each test writes a deterministic PNG into
 * src/assets/screenshots/<feature>/<page>[_wide].png from the registry.
 *
 *   npm run update:screenshots
 *   see playwright/screenshots/README.md
 */
export default defineConfig({
  ...sharedConfig,
  testDir: './playwright/screenshots',
  testIgnore: ['**/capture-fixtures.spec.ts'],
  globalSetup: './playwright/screenshots/lib/global-setup.ts',
  globalTeardown: './playwright/screenshots/lib/global-teardown.ts',
  workers: isCI ? 1 : 6,
  retries: isCI ? 1 : 0,
  reporter: [[isCI ? 'github' : 'list'], ['html', { open: 'never', outputFolder: 'playwright/.report' }]],
  outputDir: 'playwright/.artifacts',

  use: {
    ...sharedUse,
    baseURL: env('SCREENSHOT_BASE_URL', 'http://localhost:4200'),
    screenshot: 'off',
  },

  projects: [
    {
      name: 'mobile',
      use: { ...mobileUse, deviceScaleFactor: VIEWPORTS.mobile.deviceScaleFactor },
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

  webServer: makeWebServer('SCREENSHOT_BASE_URL', 'SCREENSHOT_SERVE_CMD'),
});
