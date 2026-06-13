import { settle, waitForCharts } from '../lib/stabilize';
import { BasePage } from './base.page';

/** Leagues page + league detail modal. */
export class LeaguePage extends BasePage {
  async waitForLeagues(): Promise<void> {
    await this.waitForCount('ion-content ion-item', 1);
  }

  /** Open the detail modal for the first non-practice league. */
  async openFirstLeague(): Promise<void> {
    await this.waitForLeagues();
    await this.page.locator('ion-content .sliding ion-item').first().click();
    await this.waitForModal();
    await waitForCharts(this.page);
  }

  /** Switch a tab inside the open league modal. */
  async openModalTab(label: 'Overall' | 'Spares' | 'Pins' | 'Games'): Promise<void> {
    await this.switchSegment(label, this.page.locator('ion-modal.show-modal'));
    await waitForCharts(this.page);
  }

  /** Open the "Add League" dialog (the + header button). */
  async openCreateDialog(): Promise<void> {
    await this.page.locator('ion-button:has(ion-icon[name="add-outline"])').first().click();
    await this.waitForAlert();
  }

  /** Reveal the swipe edit option on the first league and open the rename dialog. */
  async openEditDialog(): Promise<void> {
    await this.waitForLeagues();
    const sliding = this.page.locator('ion-item-sliding').first();
    await sliding.evaluate((el: HTMLElement & { open?: (s: string) => Promise<void> }) => el.open?.('start'));
    await settle(this.page, 400);
    await sliding.locator('ion-item-option').first().click();
    await this.waitForAlert();
  }

  /** Enter the league visibility-edit (checkbox) mode via a long press. */
  async enterVisibilityEdit(): Promise<void> {
    await this.waitForLeagues();
    await this.longPress(this.page.locator('ion-content .sliding ion-item').first());
    await this.waitForCount('ion-checkbox', 1);
  }
}
