import type { Page, Route } from '@playwright/test';
import type { Ball } from '../../../src/app/core/models/ball.model';
import type { Pattern } from '../../../src/app/core/models/pattern.model';

/**
 * Opt-in data mocks for the network-backed libraries (Ball / Pattern). The
 * screenshot system deliberately hits the LIVE APIs; e2e instead serves small,
 * fixed fixtures so the Ball/Pattern Library tests are deterministic and offline.
 *
 * Playwright applies the most recently registered matching route first, so the
 * broad catch-all is registered before the specific endpoints.
 */

const json = (route: Route, data: unknown) =>
  route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(data) });

// 1×1 transparent PNG so ball thumbnails resolve instantly instead of hanging
// the image waiters on unreachable hosts.
const PNG_1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC', 'base64');

const firstPage = (url: string): boolean => {
  const page = new URL(url).searchParams.get('page');
  return page === null || page === '0' || page === '1';
};

/** Mock the bowwwl proxy: catalogue (for search), paged grid, and thumbnails. */
export async function installBowwwlMocks(page: Page, balls: Ball[]): Promise<void> {
  // Catch-all (lowest priority): any other bowwwl call → empty list.
  await page.route(/proxy\.lightningbowl\.de\/api\//, (route) => json(route, []));
  // The full catalogue drives the search (Fuse over allBalls) + facade boot.
  await page.route(/\/all-balls(\?|$)/, (route) => json(route, balls));
  // Paged grid: the first page returns the fixture; later pages stop the scroll.
  await page.route(/\/balls-pages\?/, (route) => json(route, firstPage(route.request().url()) ? balls : []));
  // Ball thumbnails (bowwwl.com) → instant 1×1 PNG so image waiters don't hang.
  await page.route(/bowwwl\.com\//, (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PNG_1x1 }));
}

/** Mock the pattern API: paged library list + title search. */
export async function installPatternMocks(page: Page, patterns: Pattern[]): Promise<void> {
  // Catch-all (lowest priority): a shape that satisfies both list + search readers.
  await page.route(/pattern\.lightningbowl\.de\/api\//, (route) => json(route, { patterns: [], total: 0, count: 0 }));
  // The full stripped catalogue drives the facade boot: `allPatterns` gates the
  // searchbar (`searchDisabled()` is true while empty) and feeds the typeahead.
  // Its URL carries no query string, so without this it fell to the catch-all
  // above and the search input stayed [disabled] forever.
  await page.route(/\/patterns\/all-stripped/, (route) => json(route, { count: patterns.length, patterns }));
  // Library list, paged.
  await page.route(/\/patterns\?page=/, (route) => {
    const isFirst = firstPage(route.request().url());
    return json(route, { total: isFirst ? patterns.length : 0, patterns: isFirst ? patterns : [] });
  });
  // Title search.
  await page.route(/\/search\?q=/, (route) => {
    const q = (new URL(route.request().url()).searchParams.get('q') ?? '').toLowerCase();
    const matched = patterns.filter((p) => p.title.toLowerCase().includes(q));
    return json(route, { patterns: matched, count: matched.length, query: q, numeric_query: false, threshold: 0 });
  });
}
