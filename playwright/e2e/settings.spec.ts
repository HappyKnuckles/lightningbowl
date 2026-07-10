import { test, expect } from './lib/app';
import { SettingsPage } from '../screenshots/pages/settings.page';

test.describe('settings', () => {
  test('renders the settings list', async ({ app }) => {
    await app.boot('/tabs/settings');

    await expect(app.active().locator('ion-title').first()).toContainText('Settings');
    await expect(app.active().getByText('Color Theme')).toBeVisible();
    await expect(app.active().getByText('Cloud Sync')).toBeVisible();
    await expect(app.active().getByText('Spare Names')).toBeVisible();
  });

  test('changing the colour theme persists and is applied', async ({ app }) => {
    // The seed boots with the "Gray" theme.
    await app.boot('/tabs/settings');

    await new SettingsPage(app.page).openThemePicker();
    await app.page.locator('ion-popover').getByText('Blue', { exact: true }).click();

    // Persisted to localStorage…
    await expect.poll(() => app.page.evaluate(() => localStorage.getItem('theme'))).toBe('Blue');
    // …and applied as the active theme class on <html>.
    await expect(app.page.locator('html')).toHaveClass(/blue/);
  });

  test('opens the Cloud Sync modal', async ({ app }) => {
    await app.boot('/tabs/settings');

    await new SettingsPage(app.page).openCloudSync();

    await expect(app.page.locator('ion-modal.show-modal')).toBeVisible();
  });
});
