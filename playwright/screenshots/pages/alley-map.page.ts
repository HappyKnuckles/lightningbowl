import { settle } from '../lib/stabilize';
import { BasePage } from './base.page';

/** Alley Map page (Leaflet + Overpass markers). */
export class AlleyMapPage extends BasePage {
  /** Wait for tiles to paint and the bowling-alley markers to appear. */
  async waitForMap(): Promise<void> {
    await this.page
      .locator('#map_canvas .leaflet-tile-loaded')
      .first()
      .waitFor({ state: 'attached', timeout: 20_000 })
      .catch(() => undefined);
    await this.page
      .locator('img.leaflet-marker-icon')
      .first()
      .waitFor({ state: 'visible', timeout: 20_000 })
      .catch(() => undefined);
    await settle(this.page, 900);
  }

  /** Open the popup for the first bowling-alley marker. */
  async selectFirstAlley(): Promise<void> {
    await this.waitForMap();
    await this.page.locator('img.leaflet-marker-icon').first().click();
    await this.page
      .locator('.leaflet-popup')
      .first()
      .waitFor({ state: 'visible', timeout: 8_000 })
      .catch(() => undefined);
    await settle(this.page, 500);
  }

  /** Type a location into the search bar and let the map recenter. */
  async searchLocation(text: string): Promise<void> {
    await this.waitForMap();
    await this.search(text);
    await settle(this.page, 900);
    await this.waitForMap();
  }
}
