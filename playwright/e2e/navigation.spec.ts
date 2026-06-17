import { test, expect } from './lib/app';

/**
 * Tab-bar navigation: the four primary tabs switch routes in-place, and the
 * "More" sheet routes to the secondary pages.
 */
test.describe('tab navigation', () => {
  test('switches between the primary tabs', async ({ app }) => {
    await app.boot('/tabs/add');

    await app.tapTab('stats');
    await expect(app.page).toHaveURL(/\/tabs\/stats/);
    await expect(app.active().locator('ion-title').first()).toContainText('Stats');

    await app.tapTab('history');
    await expect(app.page).toHaveURL(/\/tabs\/history/);
    await expect(app.active().locator('ion-title').first()).toContainText('History');

    await app.tapTab('league');
    await expect(app.page).toHaveURL(/\/tabs\/league/);
    await expect(app.active().locator('ion-title').first()).toContainText('Leagues');

    await app.tapTab('add');
    await expect(app.page).toHaveURL(/\/tabs\/add/);
    await expect(app.active().locator('ion-title').first()).toContainText('New Game');
  });

  test('the More sheet routes to Settings', async ({ app }) => {
    await app.boot('/tabs/add');

    await app.openMore('Settings');

    await expect(app.page).toHaveURL(/\/tabs\/settings/);
    await expect(app.active().locator('ion-title').first()).toContainText('Settings');
  });

  test('the More sheet routes to the Arsenal', async ({ app }) => {
    await app.boot('/tabs/add');

    await app.openMore('Arsenal');

    await expect(app.page).toHaveURL(/\/tabs\/arsenal/);
    await expect(app.active().locator('ion-title').first()).toContainText('Arsenal');
  });
});
