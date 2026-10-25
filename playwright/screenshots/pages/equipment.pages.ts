import type { Locator } from '@playwright/test';
import { settle, waitForCharts, waitForImages } from '../lib/stabilize';
import { BasePage } from './base.page';

/** Ball Library page. */
export class BallsPage extends BasePage {
  async waitForBalls(): Promise<void> {
    await this.waitForSkeletons();
    await this.waitForCount('ion-card', 3);
    await waitForImages(this.page);
  }

  /** Open the similar-movement bottom sheet from the first ball card title. */
  async openSimilarBalls(): Promise<void> {
    await this.waitForBalls();
    await this.page.locator('ion-card ion-card-title').first().click();
    await this.waitForModal();
    await waitForImages(this.page);
  }
}

/** Arsenal page (segments: Arsenal, Compare Chart). */
export class ArsenalPage extends BasePage {
  async waitForArsenal(): Promise<void> {
    await this.waitForCount('ion-reorder-group ion-item-sliding', 1);
    await waitForImages(this.page);
  }

  async openCompareChart(): Promise<void> {
    await this.switchSegment('Compare Chart', this.active());
    await waitForCharts(this.page);
  }

  /** Open the detail modal for the first arsenal ball. */
  async openFirstBall(): Promise<void> {
    await this.waitForArsenal();
    await this.page.locator('ion-reorder-group ion-item[button]').first().click();
    await this.waitForModal();
    await waitForImages(this.page);
  }

  /** Open the "add ball" typeahead modal (+ header button). */
  async openAddBall(): Promise<void> {
    await this.page.locator('#addBall').click();
    await this.waitForModal();
    await waitForImages(this.page);
  }
}

/** Ball Comparison page (segments: Compare, Chart). */
export class BallComparisonPage extends BasePage {
  /** Select the first `count` balls through the add-ball typeahead. */
  async addBalls(count = 3): Promise<void> {
    await this.page.locator('ion-button:has(ion-icon[name="add"])').first().click();
    await this.waitForModal();
    const checkboxes = this.page.locator('ion-modal.show-modal ion-checkbox');
    await checkboxes.first().waitFor({ state: 'visible' });
    for (let i = 0; i < count; i++) {
      await checkboxes.nth(i).click();
      await settle(this.page, 150);
    }
    await this.page.locator('ion-modal.show-modal ion-buttons[slot="end"] ion-button', { hasText: 'Save' }).click();
    await settle(this.page, 600);
    await waitForCharts(this.page);
    await waitForImages(this.page);
  }

  async openChartTab(): Promise<void> {
    await this.switchSegment('Chart', this.active());
    await waitForCharts(this.page);
  }
}
