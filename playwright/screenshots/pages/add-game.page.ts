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

  /** Toggle the pin-deck input mode via the bowling-ball header button. */
  async enablePinInput(): Promise<void> {
    await this.page.locator('ion-buttons[slot="end"] ion-button:has(ion-icon[name^="bowling-ball"])').first().click();
    await settle(this.page, 400);
  }

  /** Open the "Choose series mode" action sheet (tap the title). */
  async openModeSheet(): Promise<void> {
    await this.page.locator('ion-title').first().click();
    await this.waitForActionSheet();
  }

  /** Pick a mode from the action sheet, e.g. "3 Series". */
  async selectMode(label: string): Promise<void> {
    await this.openModeSheet();
    await this.clickActionSheetButton(label);
    await settle(this.page, 600);
  }
}
