import type { Locator } from '@playwright/test';
import { test, expect } from './lib/app';
import { HistoryPage } from '../screenshots/pages/history.page';

/**
 * Integration coverage for the game filter: the modal updates filters live,
 * the footer shows the live result count, applying narrows the History list,
 * and the active filters surface as chips. Exhaustive predicate correctness is
 * covered by the unit tests (game-filter.service.spec.ts) — these assert the
 * modal → service → list/chips/count wiring stays consistent.
 */

/**
 * Read the history header badge: the total number of games matching the current
 * filter. This — not the number of rendered `ion-accordion`s — is the count to
 * assert against. GameListComponent lazy-loads in batches (`initialBatchSize`,
 * 25 by default), so the DOM only ever holds a prefix of the result set.
 */
async function badgeCount(app: { active: () => Locator }): Promise<number> {
  const badge = app.active().locator('ion-header ion-badge').first();
  await expect(badge).toHaveText(/^\d+$/);
  return Number(await badge.textContent());
}

/** Assert the rendered rows are a non-empty prefix of `total`. */
async function expectRenderedPrefix(app: { active: () => Locator }, total: number): Promise<void> {
  const rendered = await app.active().locator('ion-accordion').count();
  expect(rendered).toBeGreaterThan(0);
  expect(rendered).toBeLessThanOrEqual(total);
}

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

    const initial = await badgeCount(app);
    expect(initial).toBeGreaterThan(0);

    await history.openFilter();
    await app.page.locator('ion-modal.show-modal ion-toggle', { hasText: 'Exclude practice games' }).click();

    // The footer reflects the narrowed result count live, before applying.
    const narrowed = await footerCount(app);
    expect(narrowed).toBeGreaterThan(0);
    expect(narrowed).toBeLessThan(initial);

    await app.page.locator('ion-modal.show-modal ion-footer ion-button').click();

    // List, header badge and footer count all agree; an active-filter chip shows.
    await expect(app.active().locator('ion-header ion-badge').first()).toHaveText(String(narrowed));
    await expectRenderedPrefix(app, narrowed);
    await expect(app.active().locator('app-generic-filter-active ion-chip').first()).toBeVisible();
  });

  test('only-clean-games narrows the list', async ({ app }) => {
    await app.boot('/tabs/history');
    const history = new HistoryPage(app.page);
    await history.waitForGames();
    const initial = await badgeCount(app);

    await history.openFilter();
    await app.page.locator('ion-modal.show-modal ion-toggle', { hasText: 'Only clean games' }).click();
    const narrowed = await footerCount(app);
    expect(narrowed).toBeGreaterThan(0);
    expect(narrowed).toBeLessThan(initial);

    await app.page.locator('ion-modal.show-modal ion-footer ion-button').click();
    await expect(app.active().locator('ion-header ion-badge').first()).toHaveText(String(narrowed));
    await expectRenderedPrefix(app, narrowed);
  });

  test('asks before a series game shown on its own changes the league of its whole series', async ({ app }) => {
    await app.boot('/tabs/history');
    const history = new HistoryPage(app.page);
    await history.waitForGames();

    // the seeded perfect game is one game of a Monday Night League series
    await history.openFilter();
    await app.page.locator('ion-modal.show-modal ion-toggle', { hasText: 'Only perfect games' }).click();
    await app.page.locator('ion-modal.show-modal ion-footer ion-button').click();
    await expect(app.active().locator('ion-header ion-badge').first()).toHaveText('1');

    // the edit option behind the game, as swiping it open shows it
    const sliding = app.active().locator('ion-item-sliding.sliding').first();
    await sliding.evaluate((el: HTMLElement & { open?: (side: string) => Promise<void> }) => el.open?.('start'));
    await sliding.locator('ion-item-options[side="start"] ion-item-option').first().click();
    await app.active().locator('app-league-selector.league ion-item').first().click();
    await app.page.locator('ion-modal.show-modal').last().locator('ion-item', { hasText: 'City Classic' }).first().click();
    await app.active().locator('.action-row').getByRole('button', { name: 'Save' }).click();

    const alert = app.page.locator('ion-alert:not(.overlay-hidden)').first();
    await expect(alert).toContainText('Change the whole series?');
    await expect(alert).toContainText('This game is part of a 3-game series. The new league will apply to all 3 games.');
    if (process.env.SHOT_DIR) await app.page.screenshot({ path: `${process.env.SHOT_DIR}/series-alert.png` });
    await alert.getByRole('button', { name: 'Change series' }).click();

    await expect(app.active().locator('.sliding h2.title').first()).toHaveText('City Classic');
  });

  test('Reset clears an active filter and restores the full list', async ({ app }) => {
    await app.boot('/tabs/history');
    const history = new HistoryPage(app.page);
    await history.waitForGames();
    const initial = await badgeCount(app);

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
    await expect(app.active().locator('ion-header ion-badge').first()).toHaveText(String(initial));
    await expectRenderedPrefix(app, initial);
  });
});
