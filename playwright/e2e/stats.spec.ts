import { test, expect } from './lib/app';
import { StatsPage } from '../screenshots/pages/stats.page';
import { AddGamePage } from '../screenshots/pages/add-game.page';
import { waitForCharts } from '../screenshots/lib/stabilize';

test.describe('statistics', () => {
  test('shows the overall average and renders charts', async ({ app }) => {
    await app.boot('/tabs/stats');
    await waitForCharts(app.page);

    // The Overall "Average" feature card shows a formatted number for the seed.
    await expect(app.active().locator('.feature-val').first()).toContainText(/\d/);

    // Charts are drawn on <canvas> once the seeded games are aggregated.
    expect(await app.active().locator('canvas').count()).toBeGreaterThan(0);
  });

  test('switches between the stat segments', async ({ app }) => {
    await app.boot('/tabs/stats');
    const stats = new StatsPage(app.page);

    for (const tab of ['Throws', 'Spares', 'Pins', 'Sessions'] as const) {
      await stats.switchSegment(tab, app.active());
      const button = app.active().locator('ion-segment-button', { hasText: tab }).first();
      await expect(button).toHaveClass(/segment-button-checked/);
    }
  });

  test('shows the empty state when there are no games', async ({ app }) => {
    await app.boot('/tabs/stats', { seed: 'empty' });

    await expect(app.active().getByText('Start playing a few games to see your stats here!')).toBeVisible();
    // No segment toolbar without games.
    await expect(app.active().locator('ion-segment-button')).toHaveCount(0);
  });

  test('adding games updates the Stats view', async ({ app }) => {
    // Start with no games, then play + save two complete games on the pin deck.
    await app.boot('/tabs/add', { seed: 'empty', extraLocal: { pinInputMode: 'true' } });
    const addGame = new AddGamePage(app.page);
    for (let i = 0; i < 2; i++) {
      await addGame.recordGutterGame();
      await addGame.saveSingleGame();
    }

    await app.tapTab('stats');

    // The Overall "Games" stat reflects the two saved games.
    const gamesStat = app
      .active()
      .locator('dl')
      .filter({ has: app.page.locator('dt.chip-key', { hasText: /^Games$/ }) })
      .locator('dd.chip-val');
    await expect(gamesStat).toHaveText('2');
  });
});
