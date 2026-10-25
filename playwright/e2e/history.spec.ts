import { test, expect } from './lib/app';
import { HistoryPage } from '../screenshots/pages/history.page';

test.describe('game history', () => {
  test('renders the seeded games with a matching count badge', async ({ app }) => {
    await app.boot('/tabs/history');
    const history = new HistoryPage(app.page);
    await history.waitForGames();

    // The header badge is the total number of (filtered) games. The list itself
    // lazy-loads in batches (GameListComponent's `initialBatchSize`, 25 by
    // default), so the DOM holds a non-empty prefix of that total rather than
    // all of it — asserting DOM count === badge only held while every row fit
    // in the first batch.
    const badge = app.active().locator('ion-header ion-badge').first();
    await expect(badge).toHaveText(/^\d+$/);
    const total = Number(await badge.textContent());
    expect(total).toBeGreaterThan(0);

    const rendered = await app.active().locator('ion-accordion').count();
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThanOrEqual(total);

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
