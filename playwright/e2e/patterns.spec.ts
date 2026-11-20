import { test, expect } from './lib/app';
import { PatternPage } from '../screenshots/pages/pattern.page';

/**
 * Pattern Library against a mocked pattern API (`boot('/tabs/pattern',
 * { mockApi: 'patterns' })` serves the fixture). Covers the list rendering and
 * the searchbar narrowing to a matching pattern.
 */
test.describe('pattern library (mocked API)', () => {
  test('renders patterns and search narrows them', async ({ app }) => {
    await app.boot('/tabs/pattern', { mockApi: 'patterns' });
    const patterns = new PatternPage(app.page);
    await patterns.waitForPatterns();

    const total = await patterns.active().locator('ion-card').count();
    expect(total).toBeGreaterThanOrEqual(3);

    await patterns.search('Cheetah');

    await expect(patterns.active().locator('ion-card').filter({ hasText: 'PBA Cheetah 35' }).first()).toBeVisible();
    expect(await patterns.active().locator('ion-card').count()).toBeLessThan(total);
  });

  test("opens a pattern with its oil data, which the list doesn't load", async ({ app }) => {
    const details: string[] = [];
    app.page.on('request', (r) => /\/api\/patterns\/(?!all-stripped|charts)/.test(r.url()) && details.push(r.url()));
    await app.boot('/tabs/pattern', { mockApi: 'patterns' });

    await new PatternPage(app.page).openFirstPattern();

    await expect(app.page.locator('ion-modal.show-modal app-pattern-info')).toBeVisible();
    expect(details).toHaveLength(1);
  });
});
