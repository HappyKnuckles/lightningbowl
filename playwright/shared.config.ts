import { defineConfig, devices } from '@playwright/test';

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
