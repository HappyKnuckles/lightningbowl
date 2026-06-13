import { settle } from '../lib/stabilize';
import { BasePage } from './base.page';

/** Settings page + its modals/popovers. */
export class SettingsPage extends BasePage {
  async openSpareNames(): Promise<void> {
    await this.page.locator('#spare-names-modal').click();
    await this.waitForModal();
  }

  async openFeedback(): Promise<void> {
    await this.page.locator('#feedback-modal').click();
    await this.waitForModal();
  }

  async openCloudSync(): Promise<void> {
    await this.page.locator('ion-item', { hasText: 'Cloud Sync' }).first().click();
    await this.waitForModal();
  }

  /** Open the Color Theme picker popover (showcases theming). */
  async openThemePicker(): Promise<void> {
    await this.page.locator('ion-item:has(ion-icon[name="color-palette-outline"]) ion-select').click();
    await this.page.locator('ion-popover, ion-alert, ion-action-sheet').first().waitFor({ state: 'visible', timeout: 8_000 });
    await settle(this.page, 400);
  }
}
