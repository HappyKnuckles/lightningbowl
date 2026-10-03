import type { Locator } from '@playwright/test';
import { settle } from '../lib/stabilize';
import { BasePage } from './base.page';

/** New Game / score-entry page. */
export class AddGamePage extends BasePage {
  /** Dismiss the "Resume Session?" alert by restoring the seeded draft. */
  async resumeDraft(): Promise<void> {
    await this.waitForAlert();
    await this.clickAlertButton('Yes, Resume');
    await settle(this.page, 500);
  }

  /** Toggle the pin-deck input mode via the pin header button. */
  async enablePinInput(): Promise<void> {
    await this.active().locator('ion-header ion-buttons[slot="end"] ion-button:has(ion-icon[src*="pin.svg"])').first().click();
    await settle(this.page, 400);
  }

  /**
   * Open the "Choose series mode" action sheet (tap the title).
   *
   * Scoped to the active page's header: `app-side-menu` is mounted before the
   * router outlet in app.component.html, so a page-wide `ion-title` locator
   * resolves to the menu's hidden "Quick actions" title and the click times out.
   */
  async openModeSheet(): Promise<void> {
    await this.active().locator('ion-header ion-title').first().click();
    await this.waitForActionSheet();
  }

  /** Pick a mode from the action sheet, e.g. "3 Series". */
  async selectMode(label: string): Promise<void> {
    await this.openModeSheet();
    await this.clickActionSheetButton(label);
    await settle(this.page, 600);
  }

  /** The pin deck's "gutter" (−) quick-action button. */
  private gutterButton(): Locator {
    return this.page.locator('app-pin-input .quick-actions ion-button', { hasText: /^\s*-\s*$/ });
  }

  /**
   * Bring the deck up, the way a bowler does before their first ball.
   *
   * Mobile presents the deck as a bottom sheet that a score-cell tap raises and
   * that puts itself away once a game is finished — so after a save the next
   * game starts with no deck on screen. Desktop renders it inline and always
   * visible, where this is a no-op.
   */
  private async openPinDeck(): Promise<void> {
    const deck = this.page.locator('app-pin-input');
    if (await deck.isVisible()) return;

    await this.active().locator('.score-cell').first().click();
    await deck.waitFor({ state: 'visible' });
    await settle(this.page, 300);
  }

  /**
   * Play a complete, valid pin-mode game by guttering every ball (9 open frames
   * of two balls + the 10th's two balls = 20 throws, totalling 0). Clicks until
   * the deck reports the game complete.
   *
   * <ion-button> is a custom element, so Playwright's toBeDisabled()/isEnabled()
   * ignore its `disabled` attribute; Ionic reflects it as aria-disabled, which we
   * use to drive the loop. The final ball completes the game async (disabling the
   * button mid-click), so the click race is swallowed.
   */
  async recordGutterGame(): Promise<void> {
    await this.openPinDeck();

    const gutter = this.gutterButton();
    for (let i = 0; i < 24 && !(await this.isGameComplete()); i++) {
      await gutter.click({ timeout: 2000 }).catch(() => undefined);
      await settle(this.page, 150);
    }
  }

  /**
   * True once the active game is complete — the deck has locked input, or (on
   * mobile) put its sheet away, which is how the app signals "nothing left to
   * throw". Both mean the deck is no longer accepting a ball.
   */
  async isGameComplete(): Promise<boolean> {
    const gutter = this.gutterButton();
    if (!(await gutter.isVisible())) return true;
    return (await gutter.getAttribute('aria-disabled')) === 'true';
  }

  /** Persist the current single game via the "Save Score" button. */
  async saveSingleGame(): Promise<void> {
    await this.active().locator('ion-button', { hasText: 'Save Score' }).click();
    await settle(this.page, 600);
  }
}
