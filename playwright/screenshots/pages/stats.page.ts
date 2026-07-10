import { waitForCharts } from '../lib/stabilize';
import { BasePage } from './base.page';

/** Statistics page (segments: Overall, Throws, Spares, Pins, Sessions). */
export class StatsPage extends BasePage {
  async openTab(label: 'Overall' | 'Throws' | 'Spares' | 'Pins' | 'Sessions'): Promise<void> {
    await this.switchSegment(label, this.active());
    await this.refresh();
    await waitForCharts(this.page);
  }

  /**
   * Stats pages are very long, so we capture the phone-size viewport instead of
   * the full page. Nudge the content down past the summary header so the shot
   * frames the charts, then re-wait for any charts that just scrolled in.
   */
  async scrollDown(px = 420): Promise<void> {
    await this.scrollContentBy(px);
    await waitForCharts(this.page);
  }
}
