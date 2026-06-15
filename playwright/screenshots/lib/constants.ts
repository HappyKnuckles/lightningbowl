/**
 * Single source of truth for "now". Both the in-browser clock freeze
 * (stabilize.ts) and the seeded game dates (fixtures-data/games.ts) are
 * computed against this instant, so relative dates, "session" groupings and
 * date pickers are byte-for-byte identical on every run, forever.
 *
 * Pick a fixed, mid-week, mid-day UTC instant well in the past so nothing in
 * the UI ever renders a "future" game.
 */
export const REFERENCE_NOW = Date.UTC(2025, 4, 14, 12, 0, 0); // 2025-05-14T12:00:00Z (Wed)

/** Deterministic seeded PRNG (mulberry32) for any place that needs jitter. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Output roots (relative to repo root). A shot's `target` decides which one it
 * lands in: `'app'` images are bundled into the PWA (referenced by the install
 * prompt + web manifest); `'docs'` images are feature documentation only and are
 * NOT shipped, since Angular only copies `src/assets`.
 */
export const APP_SCREENSHOT_ROOT = 'src/assets/screenshots';
export const DOCS_SCREENSHOT_ROOT = 'docs/screenshots';

/** Back-compat alias — the generated manifest.json still lives under assets. */
export const SCREENSHOT_ROOT = APP_SCREENSHOT_ROOT;

/**
 * Staging dir for `app` shots, OUTSIDE the served `src/` tree. `ng serve`
 * watches `src/assets`, so writing app PNGs there during a run triggers a
 * rebuild (and, with live-reload on, a page reload) mid-capture. Instead we
 * write app shots here and promote them into APP_SCREENSHOT_ROOT in
 * global-teardown, once the dev server is no longer serving captures.
 */
export const APP_STAGING_ROOT = 'playwright/.shots';

/** The FINAL, committed location a shot's PNGs end up in (used by the manifest). */
export function screenshotRoot(target: 'app' | 'docs' = 'docs'): string {
  return target === 'app' ? APP_SCREENSHOT_ROOT : DOCS_SCREENSHOT_ROOT;
}

/**
 * Where a shot is WRITTEN during the run. `docs` shots already live outside
 * `src/`, so they're written in place; `app` shots are staged (see above).
 */
export function captureRoot(target: 'app' | 'docs' = 'docs'): string {
  return target === 'app' ? APP_STAGING_ROOT : DOCS_SCREENSHOT_ROOT;
}
