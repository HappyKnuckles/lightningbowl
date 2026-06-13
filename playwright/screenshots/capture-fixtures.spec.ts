import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from '@playwright/test';

/**
 * OPT-IN fixture recorder — `npm run capture:fixtures`.
 *
 * Visits the data-driven pages against the LIVE APIs (no mocks) and records the
 * real responses into playwright/screenshots/fixtures-data/captured/*.json.
 * Review them, then paste the parts you want into remote.ts so the offline
 * mocks reflect current production data. This keeps the mocked screenshots
 * faithful without ever depending on the network at screenshot time.
 *
 * Requires an internet connection and the dev server running.
 */
const OUT_DIR = join(process.cwd(), 'playwright/screenshots/fixtures-data/captured');

const CAPTURES: { name: string; urlIncludes: string; route: string }[] = [
  { name: 'balls-all', urlIncludes: 'all-balls', route: '/tabs/balls' },
  { name: 'balls-pages', urlIncludes: 'balls-pages', route: '/tabs/balls' },
  { name: 'patterns-stripped', urlIncludes: 'patterns/all-stripped', route: '/tabs/pattern' },
  { name: 'patterns-charts', urlIncludes: 'patterns/charts', route: '/tabs/pattern' },
];

test('record live API fixtures', async ({ page, baseURL }) => {
  mkdirSync(OUT_DIR, { recursive: true });
  const seen = new Set<string>();

  page.on('response', async (res) => {
    const url = res.url();
    const match = CAPTURES.find((c) => url.includes(c.urlIncludes));
    if (!match || seen.has(match.name) || !res.ok()) return;
    try {
      const body = await res.json();
      writeFileSync(join(OUT_DIR, `${match.name}.json`), JSON.stringify(body, null, 2), 'utf8');
      seen.add(match.name);
      // eslint-disable-next-line no-console
      console.log(`captured ${match.name} from ${url}`);
    } catch {
      /* non-JSON response, ignore */
    }
  });

  for (const route of [...new Set(CAPTURES.map((c) => c.route))]) {
    await page.goto(`${baseURL}${route}`, { waitUntil: 'networkidle' }).catch(() => undefined);
    await page.waitForTimeout(2500);
  }

  // eslint-disable-next-line no-console
  console.log(`\nFixtures written to ${OUT_DIR}\nReview and merge into remote.ts.\n`);
});
