import { existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Page } from '@playwright/test';
import { captureRoot } from './constants';
import { installMocks } from './mocks';
import { applySeed } from './seed';
import { getSeedBundle } from '../fixtures-data/seed-profiles';
import {
  injectFreezeStyles,
  installStabilizers,
  settle,
  waitForAppReady,
  waitForCharts,
  waitForImages,
  waitForNetworkIdle,
  waitForNoLoading,
} from './stabilize';
import type { ShotContext, ShotDefinition } from './types';
import { VIEWPORTS, type ViewportName } from './viewports';

const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_FULL_HEIGHT = 6000;

/** Resolve and validate the on-disk path for a shot, enforcing the convention. */
export function resolveOutputPath(shot: ShotDefinition, viewport: ViewportName): string {
  if (!NAME_RE.test(shot.feature)) throw new Error(`Invalid feature folder "${shot.feature}" (shot ${shot.id}); use kebab-case.`);
  if (!NAME_RE.test(shot.name)) throw new Error(`Invalid screenshot name "${shot.name}" (shot ${shot.id}); use kebab-case.`);
  const suffix = VIEWPORTS[viewport].suffix;
  return join(process.cwd(), captureRoot(shot.target), shot.feature, `${shot.name}${suffix}.png`);
}

/**
 * Capture one shot at one viewport. Owns the full deterministic pipeline:
 * mocks → stabilizers → blank page → seed storage → navigate → wait → shoot.
 * Returns the absolute file path written.
 */
export async function captureShot(page: Page, shot: ShotDefinition, viewport: ViewportName, baseURL: string): Promise<string> {
  const outPath = resolveOutputPath(shot, viewport);
  mkdirSync(dirname(outPath), { recursive: true });

  await installMocks(page);
  await installStabilizers(page);

  // Blank, same-origin document so seeding lands in the app's IndexedDB before
  // any app code runs (no race with Ionic Storage's create()).
  await page.route('**/__seed_blank__', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><title>seed</title>' }),
  );
  await page.goto(`${baseURL}/__seed_blank__`, { waitUntil: 'domcontentloaded' });
  const bundle = getSeedBundle(shot.seed ?? 'rich');
  if (shot.extraLocal) bundle.local = { ...bundle.local, ...shot.extraLocal };
  await applySeed(page, bundle);

  // Force Ionic's iOS mode for mobile so screenshots match the App Store look.
  const modeParam = viewport === 'mobile' ? `${shot.route.includes('?') ? '&' : '?'}ionic:mode=ios` : '';
  await gotoWithBoot(page, `${baseURL}${shot.route}${modeParam}`);

  const ctx: ShotContext = { page, viewport, isWide: viewport === 'desktop' };

  await waitForAppReady(page);
  await injectFreezeStyles(page);
  await waitForImages(page);
  await waitForNetworkIdle(page);

  if (shot.prepare) await shot.prepare(ctx);

  await waitForCharts(page);
  await settle(page);
  if (shot.ready) await shot.ready(ctx);
  await settle(page, 200);

  // Never capture the global loading overlay — wait until isLoading is false.
  await waitForNoLoading(page);

  await write(page, shot, outPath);
  validate(outPath, shot, viewport);
  return outPath;
}

/**
 * Navigate and wait for the Ionic shell, retrying with a reload. The Angular
 * dev server (vite) lazily optimizes dependencies on the first request and can
 * serve transient `504 Outdated Optimize Dep` for module chunks until that
 * completes; a reload after the optimizer has run boots cleanly. Seeded storage
 * persists across reloads, so retrying is safe.
 */
async function gotoWithBoot(page: Page, url: string): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('ion-app', { state: 'attached', timeout: attempt < 3 ? 15_000 : 30_000 });
      return;
    } catch (err) {
      lastErr = err;
      await page.waitForTimeout(1500);
    }
  }
  throw lastErr;
}

async function write(page: Page, shot: ShotDefinition, outPath: string): Promise<void> {
  if (shot.clip) {
    await page.locator(shot.clip).first().screenshot({ path: outPath });
    return;
  }
  if (shot.fullPage) {
    await captureFullContent(page, outPath);
    return;
  }
  await page.screenshot({ path: outPath });
}

/**
 * Ionic's <ion-content> scrolls inside its own container, so Playwright's
 * `fullPage` (which relies on document scroll) only grabs the viewport. Instead
 * we grow the viewport to the content's scroll height and shoot that.
 */
async function captureFullContent(page: Page, outPath: string): Promise<void> {
  const width = page.viewportSize()?.width ?? 0;
  const needed = await page.evaluate(() => {
    const content = document.querySelector('.ion-page:not(.ion-page-hidden) ion-content') || document.querySelector('ion-content');
    const inner = content?.shadowRoot?.querySelector('.inner-scroll') as HTMLElement | null;
    const scrollH = inner ? inner.scrollHeight : document.body.scrollHeight;
    const header = document.querySelector('.ion-page:not(.ion-page-hidden) ion-header') || document.querySelector('ion-header');
    const headerH = header ? (header as HTMLElement).getBoundingClientRect().height : 0;
    return Math.ceil(scrollH + headerH);
  });
  const height = Math.min(Math.max(needed, page.viewportSize()?.height ?? 0), MAX_FULL_HEIGHT);
  if (width) {
    await page.setViewportSize({ width, height });
    await settle(page, 250);
    await waitForImages(page);
    await waitForCharts(page);
  }
  await page.screenshot({ path: outPath });
}

function validate(outPath: string, shot: ShotDefinition, viewport: ViewportName): void {
  if (!existsSync(outPath)) throw new Error(`Screenshot was not written: ${outPath} (shot ${shot.id} @ ${viewport})`);
  const { size } = statSync(outPath);
  if (size < 1024) throw new Error(`Screenshot looks empty (${size} bytes): ${outPath} (shot ${shot.id} @ ${viewport})`);
}
