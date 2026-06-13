import type { Page, Route } from '@playwright/test';
import { BALLS, BRANDS, CORES, COVERSTOCKS, NOMINATIM_RESPONSE, OVERPASS_RESPONSE, PATTERN_CATEGORIES, PATTERNS } from '../fixtures-data/remote';
import { BOWWWL_LOGO, ballThumb, MAP_MARKER, MAP_MARKER_SHADOW, MAP_TILE, patternChart, type FulfillImage } from './assets';

const json = (route: Route, data: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(data) });

const image = (route: Route, img: FulfillImage) =>
  route.fulfill({ status: 200, contentType: img.contentType, headers: { 'access-control-allow-origin': '*' }, body: img.body });

const seedFromUrl = (url: string): number => {
  const m = url.match(/(\d+)\.(png|jpg|jpeg|svg|pdf)/i) || url.match(/-(\d+)(?:[^\d]|$)/);
  return m ? parseInt(m[1], 10) || 0 : 0;
};

/**
 * Install every external-service mock for the screenshot run. All app data
 * comes from fixtures-data/* so the result is fully offline & identical on
 * every run. Call once per page before navigating.
 */
export async function installMocks(page: Page): Promise<void> {
  // ---- Ball catalogue (bowwwl proxy) -------------------------------------
  await page.route('**/proxy.lightningbowl.de/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const pageParam = new URL(route.request().url()).searchParams.get('page');
    if (path.endsWith('/balls-pages')) return json(route, pageParam && pageParam !== '0' ? [] : BALLS);
    if (path.endsWith('/all-balls')) return json(route, BALLS);
    if (path.endsWith('/brands')) return json(route, BRANDS);
    if (path.endsWith('/cores')) return json(route, CORES);
    if (path.endsWith('/coverstocks')) return json(route, COVERSTOCKS);
    if (path.endsWith('/core-balls')) return json(route, BALLS.slice(0, 5));
    if (path.endsWith('/coverstock-balls')) return json(route, BALLS.slice(2, 7));
    if (path.endsWith('/brand')) return json(route, BALLS.slice(0, 6));
    return json(route, []);
  });

  // ---- Pattern library ----------------------------------------------------
  await page.route('**/pattern.lightningbowl.de/api/**', (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path.endsWith('/patterns/all-stripped')) return json(route, { count: PATTERNS.length, patterns: PATTERNS });
    if (path.endsWith('/patterns/charts'))
      return json(route, {
        count: PATTERNS.length,
        patterns: PATTERNS.map((p) => ({ url: p.url, title: p.title, chart_standard: p.chart_standard, chart_horizontal: p.chart_horizontal })),
      });
    if (path.endsWith('/patterns/all')) return json(route, { count: PATTERNS.length, patterns: PATTERNS });
    if (path.endsWith('/categories')) return json(route, PATTERN_CATEGORIES);
    if (path.endsWith('/stats')) return json(route, {});
    if (path.endsWith('/search')) {
      const q = (url.searchParams.get('q') || '').toLowerCase();
      const patterns = PATTERNS.filter((p) => p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
      return json(route, { patterns, count: patterns.length, query: q, numeric_query: false, threshold: 0.3 });
    }
    // Single pattern by url: /patterns/<url>
    const single = path.match(/\/patterns\/([^/]+)$/);
    if (single) {
      const found = PATTERNS.find((p) => p.url === single[1]);
      return json(route, found ?? PATTERNS[0]);
    }
    if (path.includes('/patterns')) return json(route, { total: PATTERNS.length, patterns: PATTERNS, page: 0, per_page: 50 });
    return json(route, {});
  });

  // ---- Remote imagery -----------------------------------------------------
  await page.route('**/images.lightningbowl.de/**', (route) => image(route, patternChart(seedFromUrl(route.request().url()))));
  await page.route('**/bowwwl.com/**', (route) => {
    const url = route.request().url();
    if (url.includes('logo')) return image(route, BOWWWL_LOGO);
    return image(route, ballThumb(seedFromUrl(url)));
  });

  // ---- Alley map: OSM tiles, Overpass, Nominatim, Leaflet marker icons ----
  await page.route(/tile\.openstreetmap\.org\/.*\.png/, (route) => image(route, MAP_TILE));
  await page.route('**/overpass-api.de/**', (route) => json(route, OVERPASS_RESPONSE));
  await page.route('**/nominatim.openstreetmap.org/**', (route) => json(route, NOMINATIM_RESPONSE));
  await page.route('**/raw.githubusercontent.com/**', (route) => image(route, MAP_MARKER));
  await page.route('**/cdnjs.cloudflare.com/**', (route) => image(route, MAP_MARKER_SHADOW));

  // ---- Telemetry / side-effect endpoints: neutralise ----------------------
  await page.route('**/analytics.nicolas-hoffmann.dev/**', (route) => route.fulfill({ status: 204, body: '' }));
  await page.route('**/ocr.lightningbowl.de/**', (route) => json(route, {}));
  await page.route('**/api.emailjs.com/**', (route) => route.fulfill({ status: 200, body: 'OK' }));
  await page.route('**/api.github.com/**', (route) => json(route, [])); // commit/update check -> "no update"
  await page.route('**/lottie.host/**', (route) => json(route, {}));
  await page.route('**/_vercel/**', (route) => route.fulfill({ status: 204, body: '' }));
  await page.route(/vercel-(insights|scripts|analytics)\.com/, (route) => route.fulfill({ status: 204, body: '' }));
}
