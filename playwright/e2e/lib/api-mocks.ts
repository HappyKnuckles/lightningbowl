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

/** Hosts the app may use as `ballApiEndpoint`: own ball API, bowwwl proxy, proxy previews. */
const BALL_API_HOST = /(?:balls|proxy)\.lightningbowl\.de\/api\/|lightningbowl-bowwwl-proxy-[^/]*\.vercel\.app\/api\//;

const lower = (value: unknown): string => String(value ?? '').toLowerCase();

/**
 * Minimal stand-in for `GET balls`: search (substring on name, brand, core,
 * coverstock; comma-separated terms), weight, exact `id`/`name` lists and
 * Spring-style paging. Enough for the app's list, pickers and name lookups.
 */
function queryBalls(url: string, balls: Ball[]) {
  const params = new URL(url).searchParams;
  const terms = lower(params.get('search') ?? params.get('q') ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const weight = params.get('weight');
  const ids = params.getAll('id');
  const names = params.getAll('name').map(lower);

  const matches = balls.filter((ball) => {
    if (weight && Number(ball.core_weight) !== Number(weight)) return false;
    if (ids.length > 0 && !ids.includes(ball.ball_id)) return false;
    if (names.length > 0 && !names.includes(lower(ball.ball_name))) return false;
    if (terms.length === 0) return true;
    const text = [ball.ball_name, ball.brand_name, ball.core_name, ball.coverstock_name].map(lower).join(' ');
    return terms.some((term) => text.includes(term));
  });

  const page = Number(params.get('page') ?? 0);
  const size = Number(params.get('size') ?? 20);
  return {
    content: matches.slice(page * size, page * size + size),
    page: { number: page, size, totalElements: matches.length, totalPages: Math.ceil(matches.length / size) },
  };
}

/** Mock the ball API (own backend or bowwwl proxy) and the bowwwl thumbnails. */
export async function installBowwwlMocks(page: Page, balls: Ball[]): Promise<void> {
  // Catch-all (lowest priority): brands/cores/coverstocks and anything else → empty list.
  await page.route(BALL_API_HOST, (route) => json(route, []));
  // List, search, filters and paging.
  await page.route(/\/api\/balls(\?|$)/, (route) => json(route, queryBalls(route.request().url(), balls)));
  // One ball in all its weights: own API `balls/{id}`, proxy `ball?id=`.
  await page.route(/\/api\/balls\/[^/?]+(\?|$)|\/api\/ball\?/, (route) => {
    const url = new URL(route.request().url());
    const id = url.searchParams.get('id') ?? decodeURIComponent(url.pathname.split('/').pop() ?? '');
    const weight = url.searchParams.get('weight');
    const variants = balls.filter((b) => b.ball_id === id && (!weight || Number(b.core_weight) === Number(weight)));
    return variants.length > 0
      ? json(route, variants)
      : route.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"Ball not found"}' });
  });
  // Similar reaction: own API `balls/{id}/similar`, proxy `similar-balls`.
  await page.route(/\/api\/balls\/[^/?]+\/similar|\/api\/similar-balls/, (route) => json(route, []));
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
