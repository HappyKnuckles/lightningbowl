import { test } from '@playwright/test';
import { captureShot } from './lib/capture';
import { REGISTRY } from './registry';
import { ALL_VIEWPORTS, type ViewportName } from './lib/viewports';

/**
 * Generates every screenshot in the registry, for the active Playwright project
 * (one project = one viewport). Run all viewports with `npm run update:screenshots`.
 *
 * Each registry entry becomes one test, so failures are isolated and you can
 * regenerate a single shot with:  npx playwright test -g "games.history"
 */
for (const shot of REGISTRY) {
  test(shot.id, async ({ page }, testInfo) => {
    const viewport = testInfo.project.name as ViewportName;

    // Honour per-shot viewport restrictions.
    const allowed = shot.viewports ?? ALL_VIEWPORTS;
    test.skip(!allowed.includes(viewport), `Shot "${shot.id}" not configured for the ${viewport} viewport`);

    const baseURL = (testInfo.project.use.baseURL as string) ?? 'http://localhost:4200';
    const file = await captureShot(page, shot, viewport, baseURL);

    // Surface the written path in the report for quick inspection.
    await testInfo.attach('screenshot', { path: file, contentType: 'image/png' });
  });
}
