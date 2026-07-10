import type { Locator, Page } from '@playwright/test';
import { settle } from '../lib/stabilize';

/**
 * Shared, resilient primitives for driving the Ionic UI. Page objects extend
 * this; registry `prepare` hooks call the semantic methods so the registry
 * stays declarative and selectors live in exactly one place.
 */
export class BasePage {
  constructor(protected readonly page: Page) {}

  /** The currently-visible Ionic page (ignores the hidden outgoing page). */
  active(): Locator {
    return this.page.locator('.ion-page:not(.ion-page-hidden)').last();
  }

  /** The top-most open modal's page, if any. */
  modal(): Locator {
    return this.page.locator('ion-modal.show-modal .ion-page, ion-modal.modal-default.show-modal').last();
  }

  async waitForModal(): Promise<void> {
    await this.page.locator('ion-modal.show-modal').last().waitFor({ state: 'visible', timeout: 15_000 });
    await settle(this.page, 300);
  }

  /** Open the header filter modal (the funnel icon in the end toolbar slot). */
  async openFilter(): Promise<void> {
    await this.page.locator('ion-button:has(ion-icon[name="filter-outline"])').first().click();
    await this.waitForModal();
  }

  /** Click a segment tab by its visible label, scoped to the active surface. */
  async switchSegment(label: string, scope: Locator = this.page.locator('body')): Promise<void> {
    await scope.locator('ion-segment-button', { hasText: label }).first().click();
    await settle(this.page, 450);
  }

  /** Type into the page's searchbar and wait for the 300ms debounce. */
  async search(text: string, scope: Locator = this.active()): Promise<void> {
    const input = scope.locator('ion-searchbar input').first();
    await input.click();
    await input.fill(text);
    await settle(this.page, 500);
  }

  /** Scroll the active page's <ion-content> down by `px` (instant, deterministic). */
  async scrollContentBy(px: number, scope: Locator = this.active()): Promise<void> {
    const content = scope.locator('ion-content').first();
    await content.evaluate((el: any, y: number) => el.scrollToPoint(0, y, 0), px);
    await settle(this.page, 300);
  }

  /** Trigger an ion-refresher by pulling down. */
  async refresh(scope: Locator = this.active()): Promise<void> {
    const content = scope.locator('ion-content').first();

    // Scroll to top first
    await content.evaluate((el: any) => el.scrollToTop(0));
    await settle(this.page, 200);

    const box = await content.boundingBox();
    if (!box) {
      throw new Error('ion-content not visible');
    }

    const x = box.x + box.width / 2;
    const startY = box.y + 80;
    const endY = startY + 150;

    await this.page.mouse.move(x, startY);
    await this.page.mouse.down();

    // Drag slowly downward
    await this.page.mouse.move(x, endY, { steps: 20 });

    await this.page.mouse.up();

    await settle(this.page, 1000);
  }

  async waitForActionSheet(): Promise<void> {
    await this.page.locator('ion-action-sheet').waitFor({ state: 'visible', timeout: 10_000 });
    await settle(this.page, 300);
  }

  async clickActionSheetButton(text: string): Promise<void> {
    await this.page.locator('ion-action-sheet button', { hasText: text }).first().click();
    await settle(this.page, 400);
  }

  async waitForAlert(): Promise<void> {
    // Scope to the *presented* alert: declarative `<ion-alert [isOpen]>` instances
    // (e.g. add-game's "fill all inputs" error) stay in the DOM as `.overlay-hidden`,
    // so a bare `ion-alert` locator matches two elements and trips strict mode.
    await this.page.locator('ion-alert:not(.overlay-hidden)').first().waitFor({ state: 'visible', timeout: 10_000 });
    await settle(this.page, 300);
  }

  async clickAlertButton(text: string): Promise<void> {
    await this.page.locator('ion-alert:not(.overlay-hidden) button', { hasText: text }).first().click();
    await settle(this.page, 400);
  }

  /** Long-press an element (drives Ionic's appLongPress directive, ~1s). */
  async longPress(locator: Locator, ms = 1200): Promise<void> {
    const box = await locator.boundingBox();
    if (!box) throw new Error('longPress target not visible');
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await this.page.mouse.move(x, y);
    await this.page.mouse.down();
    await this.page.waitForTimeout(ms);
    await this.page.mouse.up();
    await settle(this.page, 400);
  }

  /** Wait until the list/feed has rendered at least `min` of `selector`. */
  async waitForCount(selector: string, min = 1): Promise<void> {
    await this.page
      .waitForFunction(({ sel, n }) => document.querySelectorAll(sel).length >= n, { sel: selector, n: min }, { timeout: 20_000 })
      .catch(() => undefined);
  }
}
