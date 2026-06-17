import { test, expect } from './lib/app';
import { LeaguePage } from '../screenshots/pages/league.page';

test.describe('leagues', () => {
  test('lists the seeded leagues', async ({ app }) => {
    await app.boot('/tabs/league');
    const league = new LeaguePage(app.page);
    await league.waitForLeagues();

    await expect(app.active().getByText('Monday Night League').first()).toBeVisible();
    expect(await app.active().locator('ion-content ion-item').count()).toBeGreaterThan(0);
  });

  test('opens the "Add League" dialog', async ({ app }) => {
    await app.boot('/tabs/league');

    await new LeaguePage(app.page).openCreateDialog();

    const alert = app.page.locator('ion-alert:not(.overlay-hidden)').first();
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('Add League');
    await expect(alert.locator('input').first()).toBeVisible();
  });

  test('opens a league detail modal', async ({ app }) => {
    await app.boot('/tabs/league');

    await new LeaguePage(app.page).openFirstLeague();

    const modal = app.page.locator('ion-modal.show-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('ion-segment-button', { hasText: 'Overall' })).toBeVisible();
  });

  test('shows the empty state when there are no games', async ({ app }) => {
    await app.boot('/tabs/league', { seed: 'empty' });

    await expect(app.active().getByText('Start playing a few games to see your leagues here!')).toBeVisible();
  });
});
