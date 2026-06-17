import { test as base, expect, type Page } from '@playwright/test';
import { installMocks } from '../../screenshots/lib/mocks';
import { applySeed } from '../../screenshots/lib/seed';
import { getSeedBundle } from '../../screenshots/fixtures-data/seed-profiles';
import { installStabilizers, settle, waitForAppReady } from '../../screenshots/lib/stabilize';
import type { SeedProfileName } from '../../screenshots/lib/types';
import type { Ball } from '../../../src/app/core/models/ball.model';
import { installBowwwlMocks, installPatternMocks } from './api-mocks';
import REAL_BALLS from '../../screenshots/fixtures-data/real-balls.json';
import { PATTERNS } from '../fixtures/patterns';

/**
 * Functional-e2e harness. This is the single entry point every spec uses to get
 * a booted, deterministically-seeded app, and it reuses the screenshot system's
 * proven plumbing so the two stay in lock-step:
 *
 *   - `installMocks`        — neutralises telemetry/OCR/update-check side effects
 *   - `installStabilizers`  — reduced motion, killed animations, pinned RNG
 *   - `applySeed`           — writes games/leagues/arsenal into IndexedDB + localStorage
 *   - `waitForAppReady`     — waits for the Ionic shell, fonts, no skeletons/loader
 *
 * The page objects in `playwright/screenshots/pages/*` are reused verbatim, so
 * selectors live in exactly one place across screenshots AND e2e.
 */

export interface BootOptions {
  /** Which seed profile to load before navigating. Defaults to "rich". */
  seed?: SeedProfileName;
  /** Extra localStorage entries merged on top of the seed (drafts, prefs, …). */
  extraLocal?: Record<string, string>;
  /**
   * Mock a network-backed library API with a fixed fixture so its page is
   * deterministic offline. Omit to leave the live API in place (the default).
   */
  mockApi?: 'balls' | 'patterns';
}

export class AppHarness {
  constructor(
    readonly page: Page,
    private readonly baseURL: string,
  ) {}

  /**
   * Seed storage and navigate to `route` (e.g. "/tabs/history"), resolving once
   * the Ionic shell is ready and all skeletons/loaders are gone.
   */
  async boot(route: string, opts: BootOptions = {}): Promise<void> {
    const { page, baseURL } = this;

    await installMocks(page);
    if (opts.mockApi === 'balls') await installBowwwlMocks(page, REAL_BALLS as unknown as Ball[]);
    if (opts.mockApi === 'patterns') await installPatternMocks(page, PATTERNS);
    await installStabilizers(page);

    // Blank, same-origin document so seeding lands in the app's IndexedDB BEFORE
    // any app code runs — no race with Ionic Storage's create() on first nav.
    await page.route('**/__e2e_blank__', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><title>seed</title>' }),
    );
    await page.goto(`${baseURL}/__e2e_blank__`, { waitUntil: 'domcontentloaded' });

    const bundle = getSeedBundle(opts.seed ?? 'rich');
    if (opts.extraLocal) bundle.local = { ...bundle.local, ...opts.extraLocal };
    await applySeed(page, bundle);

    await this.gotoWithBoot(`${baseURL}${route}`);
    await waitForAppReady(page);
    await settle(page, 200);
  }

  /**
   * The currently-visible routed page. Scoped to the router outlet so it never
   * resolves to a kept-mounted modal's `.ion-page` (e.g. settings' feedback
   * modal, which renders its own `ion-title`).
   */
  active() {
    return this.page.locator('ion-router-outlet > .ion-page:not(.ion-page-hidden)').last();
  }

  /** Tap a bottom tab-bar button by its `tab` attribute (add/stats/history/league). */
  async tapTab(tab: 'add' | 'stats' | 'history' | 'league'): Promise<void> {
    await this.page.locator(`ion-tab-button[tab="${tab}"]`).click();
    await settle(this.page, 400);
  }

  /** Open a "More" sheet entry (Arsenal, Ball Library, Settings, …) by label. */
  async openMore(label: string): Promise<void> {
    await this.page.locator('ion-tab-button#more').click();
    await this.page.locator('ion-modal.show-modal ion-item', { hasText: label }).first().waitFor({ state: 'visible' });
    await this.page.locator('ion-modal.show-modal ion-item', { hasText: label }).first().click();
    await settle(this.page, 500);
  }

  /**
   * Navigate within the booted SPA, retrying with a reload. The Angular dev
   * server (vite) lazily optimises dependencies on first request and can serve a
   * transient 504 for module chunks; a reload after the optimiser has run boots
   * cleanly, and the seeded storage survives the reload.
   */
  private async gotoWithBoot(url: string): Promise<void> {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await this.page.goto(url, { waitUntil: 'domcontentloaded' });
        await this.page.waitForSelector('ion-app', { state: 'attached', timeout: attempt < 3 ? 15_000 : 30_000 });
        return;
      } catch (err) {
        lastErr = err;
        await this.page.waitForTimeout(1500);
      }
    }
    throw lastErr;
  }
}

/** The custom test object: every spec gets an `app` harness pre-wired with baseURL. */
export const test = base.extend<{ app: AppHarness }>({
  app: async ({ page, baseURL }, use) => {
    await use(new AppHarness(page, baseURL ?? 'http://localhost:4200'));
  },
});

export { expect };
