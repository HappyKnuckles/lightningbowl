import { waitForCharts } from '../lib/stabilize';
import { BasePage } from './base.page';

/** Statistics page (segments: Overall, Throws, Spares, Pins, Sessions). */
export class StatsPage extends BasePage {
  async openTab(label: 'Overall' | 'Throws' | 'Spares' | 'Pins' | 'Sessions'): Promise<void> {
    await this.switchSegment(label, this.active());
    await waitForCharts(this.page);
  }
}
