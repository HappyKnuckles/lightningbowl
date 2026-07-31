import { defineConfig, devices } from '@playwright/test';
import { VIEWPORTS } from './screenshots/lib/viewports';

const isCI = !!process.env['CI'];

/** Read an env var with a default, so call sites stay terse. */
const env = (key: string, fallback: string) => process.env[key] ?? fallback;

/**
 * Everything both the functional e2e suite and the screenshot pipeline share:
 * deterministic locale/timezone, pinned geolocation for the alley map, the same
 * timeouts, and a dev-server boot. Each config spreads this and overrides only
 * what genuinely differs (testDir, projects, reporters' output folders, the
 * screenshot capture mode, and the screenshot config's global setup/teardown).
 */
export const sharedUse = {
  locale: 'en-US',
  timezoneId: 'UTC',
  geolocation: { latitude: 40.7128, longitude: -74.006 },
  permissions: ['geolocation'],
  actionTimeout: 15_000,
  navigationTimeout: 30_000,
  trace: 'retain-on-failure' as const,
  video: 'off' as const,
};

/**
 * Context overrides that make Chromium present as a phone: iPhone 15 Pro
 * viewport, touch, and an iOS user agent so Ionic renders in `ios` mode — the
 * exact environment the screenshot system's `mobile` project captures in.
 * deviceScaleFactor is deliberately NOT set: the screenshot config adds @3x for
 * crisp PNGs, while the functional e2e suite keeps the default (behaviour is
 * identical, rendering is cheaper).
 */
export const mobileUse = {
  ...devices['Desktop Chrome'],
  viewport: VIEWPORTS.mobile.viewport,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
};

export const sharedConfig = {
  fullyParallel: true,
  forbidOnly: isCI,
  timeout: 90_000,
  expect: { timeout: 15_000 },
} as const;

/** Build the dev-server block from a pair of env-var names. */
export const makeWebServer = (urlEnv: string, cmdEnv: string) => ({
  command: env(cmdEnv, 'npm run start'),
  url: env(urlEnv, 'http://localhost:4200'),
  reuseExistingServer: !isCI,
  timeout: 240_000,
  stdout: 'pipe' as const,
  stderr: 'pipe' as const,
});

export { defineConfig, devices, isCI, env };
