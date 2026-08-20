import { settle, waitForImages } from '../lib/stabilize';
import { BasePage } from './base.page';

/** Pattern Library page + pattern detail modal. */
export class PatternPage extends BasePage {
  async waitForPatterns(): Promise<void> {
    await this.waitForSkeletons();
    await this.waitForCount('ion-card', 3);
    await waitForImages(this.page);
  }

  /** Open the detail modal for the first pattern card. */
  async openFirstPattern(): Promise<void> {
    await this.waitForPatterns();
    await this.page.locator('ion-card[button]').first().click();
    await this.waitForModal();
    await waitForImages(this.page);
    await settle(this.page, 300);
  }
}
