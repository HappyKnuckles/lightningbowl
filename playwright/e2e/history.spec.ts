import { test, expect } from './lib/app';
import { HistoryPage } from '../screenshots/pages/history.page';

test.describe('game history', () => {
  test('renders the seeded games with a matching count badge', async ({ app }) => {
    await app.boot('/tabs/history');
    const history = new HistoryPage(app.page);
    await history.waitForGames();

    const cards = app.active().locator('ion-accordion');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    // The header badge reflects the number of (filtered) games shown.
    const badge = app.active().locator('ion-header ion-badge').first();
    await expect(badge).toHaveText(String(count));

    // Each card surfaces a total score.
    await expect(app.active().locator('.score-text').first()).toContainText(/\d+/);
  });

  test('expanding a game reveals its scorecard', async ({ app }) => {
    await app.boot('/tabs/history');
    const history = new HistoryPage(app.page);

    await history.expandFirstGame();

    // The accordion content (the per-frame grid) is only mounted once expanded.
    await expect(app.active().locator('ion-accordion div[slot="content"]').first()).toBeVisible();
  });

  test('shows the empty state when there are no games', async ({ app }) => {
    await app.boot('/tabs/history', { seed: 'empty' });

    await expect(app.active().getByText('Start playing a few games to see your history here!')).toBeVisible();
    await expect(app.active().locator('ion-accordion')).toHaveCount(0);
  });

  test('opens the filter modal', async ({ app }) => {
    await app.boot('/tabs/history');
    const history = new HistoryPage(app.page);
    await history.waitForGames();

    await history.openFilter();

    await expect(app.page.locator('ion-modal.show-modal')).toBeVisible();
  });
});
