import { test } from '@playwright/test';
import { installMocks } from './lib/mocks';
import { installStabilizers, waitForAppReady } from './lib/stabilize';
import { applySeed } from './lib/seed';
import { getSeedBundle } from './fixtures-data/seed-profiles';

test('debug stats charts', async ({ page, baseURL }) => {
  const logs: string[] = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

  await installMocks(page);
  await installStabilizers(page);
  await page.route('**/__seed_blank__', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>seed</title>' }));
  await page.goto(`${baseURL}/__seed_blank__`);
  await applySeed(page, getSeedBundle('rich'));
  await page.goto(`${baseURL}/tabs/stats`, { waitUntil: 'domcontentloaded' });
  await waitForAppReady(page);
  await page.waitForTimeout(6000);

  const info = await page.evaluate(() => {
    const canvases = Array.from(document.querySelectorAll('canvas')) as HTMLCanvasElement[];
    return canvases.map((c) => {
      const r = c.getBoundingClientRect();
      let content = false;
      try {
        const d = c.getContext('2d')!.getImageData(0, 0, Math.min(c.width, 60), Math.min(c.height, 60)).data;
        for (let p = 4; p < d.length; p += 4)
          if (d[p] !== d[0] || d[p + 1] !== d[1] || d[p + 2] !== d[2] || d[p + 3] !== d[3]) {
            content = true;
            break;
          }
      } catch {
        content = true;
      }
      return { w: c.width, h: c.height, cw: Math.round(r.width), ch: Math.round(r.height), vis: c.offsetParent !== null, content };
    });
  });
  // eslint-disable-next-line no-console
  console.log('CANVASES:', JSON.stringify(info));
  // eslint-disable-next-line no-console
  console.log(
    'LOGS:',
    logs
      .filter((l) => /error|chart|Chart/i.test(l))
      .slice(0, 20)
      .join(' || '),
  );
});
