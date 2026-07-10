import type { Page, Route } from '@playwright/test';

const json = (route: Route, data: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(data) });

/**
 * The Ball Library, Arsenal and Pattern Library are captured against the LIVE
 * APIs so they show real balls/patterns and real product imagery. We therefore
 * mock nothing data-related — we only neutralise fire-and-forget side-effect
 * endpoints (analytics, telemetry, OCR, the GitHub update check, lottie) so
 * they never error, slow the run, or pop an "update available" prompt over a
 * screenshot.
 */
export async function installMocks(page: Page): Promise<void> {
  await page.route('**/analytics.nicolas-hoffmann.dev/**', (route) => route.fulfill({ status: 204, body: '' }));
  await page.route('**/ocr.lightningbowl.de/**', (route) => json(route, {}));
  await page.route('**/api.emailjs.com/**', (route) => route.fulfill({ status: 200, body: 'OK' }));
  await page.route('**/api.github.com/**', (route) => json(route, [])); // commit/update check -> "no update"
  await page.route('**/lottie.host/**', (route) => json(route, {}));
  await page.route('**/_vercel/**', (route) => route.fulfill({ status: 204, body: '' }));
  await page.route(/vercel-(insights|scripts|analytics)\.com/, (route) => route.fulfill({ status: 204, body: '' }));
}
