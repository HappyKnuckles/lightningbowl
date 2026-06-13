import { settle } from '../lib/stabilize';
import { BasePage } from './base.page';

/** Game History page. */
export class HistoryPage extends BasePage {
  async waitForGames(): Promise<void> {
    await this.waitForCount('ion-accordion', 1);
  }

  /** Expand the first game card to reveal its scorecard (game details). */
  async expandFirstGame(): Promise<void> {
    await this.waitForGames();
    await this.page.locator('ion-accordion .expansion-header').first().click();
    await settle(this.page, 600);
  }
}
