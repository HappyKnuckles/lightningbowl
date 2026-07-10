import { test, expect } from './lib/app';
import { HistoryPage } from '../screenshots/pages/history.page';

/**
 * Integration coverage for the game filter: the modal updates filters live,
 * the footer shows the live result count, applying narrows the History list,
 * and the active filters surface as chips. Exhaustive predicate correctness is
 * covered by the unit tests (game-filter.service.spec.ts) — these assert the
 * modal → service → list/chips/count wiring stays consistent.
 */

/** Read the live "Confirm (N Games)" count from the filter modal footer. */
async function footerCount(app: { page: import('@playwright/test').Page }): Promise<number> {
  const confirm = app.page.locator('ion-modal.show-modal ion-footer ion-button');
  await expect(confirm).toContainText(/\(\d+ Games\)/);
  const label = (await confirm.textContent()) ?? '';
  return parseInt(/\((\d+) Games\)/.exec(label)![1], 10);
}

test.describe('history filters', () => {
  test('excluding practice games narrows the list, shows a chip, and counts stay consistent', async ({ app }) => {
    await app.boot('/tabs/history');
    const history = new HistoryPage(app.page);
    await history.waitForGames();

    const initial = await app.active().locator('ion-accordion').count();
    expect(initial).toBeGreaterThan(0);

    await history.openFilter();
    await app.page.locator('ion-modal.show-modal ion-toggle', { hasText: 'Exclude practice games' }).click();

    // The footer reflects the narrowed result count live, before applying.
    const narrowed = await footerCount(app);
    expect(narrowed).toBeGreaterThan(0);
    expect(narrowed).toBeLessThan(initial);

    await app.page.locator('ion-modal.show-modal ion-footer ion-button').click();

    // List, header badge and footer count all agree; an active-filter chip shows.
    await expect(app.active().locator('ion-accordion')).toHaveCount(narrowed);
    await expect(app.active().locator('ion-header ion-badge').first()).toHaveText(String(narrowed));
    await expect(app.active().locator('app-generic-filter-active ion-chip').first()).toBeVisible();
  });

  test('only-clean-games narrows the list', async ({ app }) => {
    await app.boot('/tabs/history');
    const history = new HistoryPage(app.page);
    await history.waitForGames();
    const initial = await app.active().locator('ion-accordion').count();

    await history.openFilter();
    await app.page.locator('ion-modal.show-modal ion-toggle', { hasText: 'Only clean games' }).click();
    const narrowed = await footerCount(app);
    expect(narrowed).toBeGreaterThan(0);
    expect(narrowed).toBeLessThan(initial);

    await app.page.locator('ion-modal.show-modal ion-footer ion-button').click();
    await expect(app.active().locator('ion-accordion')).toHaveCount(narrowed);
  });

  test('Reset clears an active filter and restores the full list', async ({ app }) => {
    await app.boot('/tabs/history');
    const history = new HistoryPage(app.page);
    await history.waitForGames();
    const initial = await app.active().locator('ion-accordion').count();

    // Apply a filter first.
    await history.openFilter();
    await app.page.locator('ion-modal.show-modal ion-toggle', { hasText: 'Exclude practice games' }).click();
    await app.page.locator('ion-modal.show-modal ion-footer ion-button').click();
    await expect(app.active().locator('app-generic-filter-active ion-chip').first()).toBeVisible();

    // Reopen, Reset, and confirm: chips disappear and the full list is back.
    await history.openFilter();
    await app.page.locator('ion-modal.show-modal ion-button', { hasText: 'Reset' }).click();
    expect(await footerCount(app)).toBe(initial);
    await app.page.locator('ion-modal.show-modal ion-footer ion-button').click();

    await expect(app.active().locator('app-generic-filter-active')).toHaveCount(0);
    await expect(app.active().locator('ion-accordion')).toHaveCount(initial);
  });
});
